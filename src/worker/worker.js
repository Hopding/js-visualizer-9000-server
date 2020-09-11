const { parentPort, workerData } = require('worker_threads');
const asyncHooks = require('async_hooks');
const util = require('util');
const fs = require('fs');
const babel = require('babel-core');
const { VM } = require('vm2');

const fetch = require('node-fetch');
const _ = require('lodash');
const falafel = require('falafel');
const prettyFormat = require('pretty-format');

const { traceLoops } = require('./loopTracer');

const LOG_FILE = './log.txt';
fs.writeFileSync(LOG_FILE, '');
const log = (...msg) => fs.appendFileSync(
  LOG_FILE,
  msg.map(m => _.isString(m) ? m : prettyFormat(m)).join(' ') + '\n'
);

const event = (type, payload) => ({ type, payload });
const Events = {
  ConsoleLog: (message) => event('ConsoleLog', { message }),
  ConsoleWarn: (message) => event('ConsoleWarn', { message }),
  ConsoleError: (message) => event('ConsoleError', { message }),

  EnterFunction: (id, name, start, end) => event('EnterFunction', { id, name, start, end }),
  ExitFunction: (id, name, start, end) => event('ExitFunction', { id, name, start, end }),
  ErrorFunction: (message, id, name, start, end) => event('ErrorFunction', { message, id, name, start, end }),

  InitPromise: (id, parentId) => event('InitPromise', { id, parentId }),
  ResolvePromise: (id) => event('ResolvePromise', { id }),
  BeforePromise: (id) => event('BeforePromise', { id }),
  AfterPromise: (id) => event('AfterPromise', { id }),

  InitMicrotask: (id, parentId) => event('InitMicrotask', { id, parentId }),
  BeforeMicrotask: (id) => event('BeforeMicrotask', { id }),
  AfterMicrotask: (id) => event('AfterMicrotask', { id }),

  InitTimeout: (id, callbackName) => event('InitTimeout', { id, callbackName }),
  BeforeTimeout: (id) => event('BeforeTimeout', { id }),

  UncaughtError: (error) => event('UncaughtError', {
    name: (error || {}).name,
    stack: (error || {}).stack,
    message: (error || {}).message,
  }),
  EarlyTermination: (message) => event('EarlyTermination', { message }),
};

let events = [];
const postEvent = (event) => {
  events.push(event);
  parentPort.postMessage(JSON.stringify(event));
}

// We only care about these async hook types:
//   PROMISE, Timeout
const ignoredAsyncHookTypes = [
  'FSEVENTWRAP', 'FSREQCALLBACK', 'GETADDRINFOREQWRAP', 'GETNAMEINFOREQWRAP',
  'HTTPPARSER', 'JSSTREAM', 'PIPECONNECTWRAP', 'PIPEWRAP', 'PROCESSWRAP',
  'QUERYWRAP', 'SHUTDOWNWRAP', 'SIGNALWRAP', 'STATWATCHER', 'TCPCONNECTWRAP',
  'TCPSERVERWRAP', 'TCPWRAP', 'TTYWRAP', 'UDPSENDWRAP', 'UDPWRAP', 'WRITEWRAP',
  'ZLIB', 'SSLCONNECTION', 'PBKDF2REQUEST', 'RANDOMBYTESREQUEST', 'TLSWRAP',
  'DNSCHANNEL',
];
const isIgnoredHookType = (type) => ignoredAsyncHookTypes.includes(type);

const eid = asyncHooks.executionAsyncId();
const tid = asyncHooks.triggerAsyncId();

const asyncIdToResource = {};

const init = (asyncId, type, triggerAsyncId, resource) => {
  asyncIdToResource[asyncId] = resource;
  if (type === 'PROMISE') {
    postEvent(Events.InitPromise(asyncId, triggerAsyncId));
  }
  if (type === 'Timeout') {
    const callbackName = resource._onTimeout.name || 'anonymous';
    postEvent(Events.InitTimeout(asyncId, callbackName));
  }
  if (type === 'Microtask') {
    postEvent(Events.InitMicrotask(asyncId, triggerAsyncId));
  }
}

const before = (asyncId) => {
  const resource = asyncIdToResource[asyncId] || {};
  const resourceName = (resource.constructor).name;
  if (resourceName === 'PromiseWrap') {
    postEvent(Events.BeforePromise(asyncId));
  }
  if (resourceName === 'Timeout') {
    postEvent(Events.BeforeTimeout(asyncId));
  }
  if (resourceName === 'AsyncResource') {
    postEvent(Events.BeforeMicrotask(asyncId));
  }
}

const after = (asyncId) => {
  const resource = asyncIdToResource[asyncId] || {};
  const resourceName = (resource.constructor).name;
  if (resourceName === 'PromiseWrap') {
    postEvent(Events.AfterPromise(asyncId));
  }
  if (resourceName === 'AsyncResource') {
    postEvent(Events.AfterMicrotask(asyncId));
  }
}

const destroy = (asyncId) => {
  const resource = asyncIdToResource[asyncId] || {};
}

const promiseResolve = (asyncId) => {
  const promise = asyncIdToResource[asyncId].promise;
  postEvent(Events.ResolvePromise(asyncId));
}

asyncHooks
  .createHook({ init, before, after, destroy, promiseResolve })
  .enable();

const functionDefinitionTypes = [
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
];
const arrowFnImplicitReturnTypesRegex = /Literal|Identifier|(\w)*Expression/;

// Inspired by: http://alltom.com/pages/instrumenting-javascript/
const traceBlock = (code, fnName, start, end) => `{
  const idWithExtensionToAvoidConflicts = nextId();
  Tracer.enterFunc(idWithExtensionToAvoidConflicts, '${fnName}', ${start}, ${end});
  try {
    ${code}
  } catch (e) {
    Tracer.errorFunc(e.message, idWithExtensionToAvoidConflicts, '${fnName}', ${start}, ${end});
    throw e;
  } finally {
    Tracer.exitFunc(idWithExtensionToAvoidConflicts, '${fnName}', ${start}, ${end});
  }
}`

const jsSourceCode = workerData;

// TODO: Convert all this to babel transform(s)
// TODO: HANDLE GENERATORS/ASYNC-AWAIT
const output = falafel(jsSourceCode, (node) => {

  const parentType = node.parent && node.parent.type;
  const isBlockStatement = node.type === 'BlockStatement';
  const isFunctionBody = functionDefinitionTypes.includes(parentType);
  const isArrowFnReturnType = arrowFnImplicitReturnTypesRegex.test(node.type);
  const isArrowFunctionBody = parentType === 'ArrowFunctionExpression';
  const isArrowFn = node.type === 'ArrowFunctionExpression';

  if (isBlockStatement && isFunctionBody) {
    const { start, end } = node.parent;
    const fnName = (node.parent.id && node.parent.id.name) || 'anonymous';
    const block = node.source();
    const blockWithoutCurlies = block.substring(1, block.length - 1);
    node.update(traceBlock(blockWithoutCurlies, fnName, start, end))
  }
  else if (isArrowFnReturnType && isArrowFunctionBody) {
    const { start, end, params } = node.parent;

    const isParamIdentifier = params.some(param => param === node);

    if (!isParamIdentifier) {
      const fnName = (node.parent.id && node.parent.id.name) || 'anonymous';
      const block = node.source();
      const returnedBlock = `return (${block});`;
      node.update(traceBlock(returnedBlock, fnName, start, end))
    }
  }
  else if (isArrowFn) {
    const body = node.source();
    const firstCurly = body.indexOf('{');
    const lastCurly = body.lastIndexOf('}');
    const bodyHasCurlies = firstCurly !== -1 && lastCurly !== -1;

    // We already updated all arrow function bodies to have curlies, so here
    // we can assume if a body looks like `({ ... })`, then we need to remove
    // the parenthesis.
    if (bodyHasCurlies) {
      const parensNeedStripped = body[firstCurly - 1] === '(';
      if (parensNeedStripped) {
        const bodyBlock = body.substring(firstCurly, lastCurly + 1);
        const bodyWithoutParens = `() => ${bodyBlock}`;
        node.update(bodyWithoutParens);
      }
    }
  }

});

const modifiedSource = babel
  .transform(output.toString(), { plugins: [traceLoops] })
  .code;

// TODO: Maybe change this name to avoid conflicts?
const nextId = (() => {
  let id = 0;
  return () => id++;
})();

const arrToPrettyStr = (arr) =>
  arr.map(a => _.isString(a) ? a : prettyFormat(a)).join(' ') + '\n'

const START_TIME = Date.now();
const TIMEOUT_MILLIS = 5000;
const EVENT_LIMIT = 500;

const Tracer = {
  enterFunc: (id, name, start, end) => postEvent(Events.EnterFunction(id, name, start, end)),
  exitFunc: (id, name, start, end) => postEvent(Events.ExitFunction(id, name, start, end)),
  errorFunc: (message, id, name, start, end) => postEvent(Events.ErrorFunction(message, id, name, start, end)),
  log: (...args) => postEvent(Events.ConsoleLog(arrToPrettyStr(args))),
  warn: (...args) => postEvent(Events.ConsoleWarn(arrToPrettyStr(args))),
  error: (...args) => postEvent(Events.ConsoleError(arrToPrettyStr(args))),
  iterateLoop: () => {
    const hasTimedOut = (Date.now() - START_TIME) > TIMEOUT_MILLIS;
    const reachedEventLimit = events.length >= EVENT_LIMIT;
    const shouldTerminate = reachedEventLimit || hasTimedOut;
    if (shouldTerminate) {
      postEvent(Events.EarlyTermination(hasTimedOut
        ? `Terminated early: Timeout of ${TIMEOUT_MILLIS} millis exceeded.`
        : `Termianted early: Event limit of ${EVENT_LIMIT} exceeded.`
      ));
      process.exit(1);
    }
  },
};

// E.g. call stack size exceeded errors...
process.on('uncaughtException', (err) => {
  postEvent(Events.UncaughtError(err));
  process.exit(1);
});

const vm = new VM({
  timeout: 6000,
  sandbox: {
    nextId,
    Tracer,
    fetch,
    _,
    lodash: _,
    setTimeout,
    queueMicrotask,
    console: {
      log: Tracer.log,
      warn: Tracer.warn,
      error: Tracer.error,
    },
  },
});

vm.run(modifiedSource);
