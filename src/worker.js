const { parentPort, workerData } = require('worker_threads');
const asyncHooks = require('async_hooks');
const util = require('util');
const fs = require('fs');

const fetch = require('node-fetch');
const _ = require('lodash');
const falafel = require('falafel');
const prettyFormat = require('pretty-format');

// const LOG_FILE = './log.txt';
// fs.writeFileSync(LOG_FILE, '');
// const log = (...msg) => fs.appendFileSync(
//   LOG_FILE,
//   msg.map(m => _.isString(m) ? m : prettyFormat(m)).join(' ') + '\n'
// );

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

  InitTimeout: (id, callbackName) => event('InitTimeout', { id, callbackName }),
  BeforeTimeout: (id) => event('BeforeTimeout', { id }),
}

const postEvent = (event) => parentPort.postMessage(JSON.stringify(event));

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
}

const after = (asyncId) => {
  const resource = asyncIdToResource[asyncId] || {};
  const resourceName = (resource.constructor).name;
  if (resourceName === 'PromiseWrap') {
    postEvent(Events.AfterPromise(asyncId));
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

// TODO: HANDLE IMPLICIT RETURNS FROM ARROW FNS!
// TODO: HANDLE GENERATORS/ASYNC-AWAIT
const output = falafel(jsSourceCode, (node) => {
  log('NODE TYPE:', node.type);

  const parentType = node.parent && node.parent.type;
  const isBlockStatement = node.type === 'BlockStatement';
  const isFunctionBody = functionDefinitionTypes.includes(parentType);
  const isArrowFnReturnType = arrowFnImplicitReturnTypesRegex.test(node.type);
  const isArrowFn = node.type === 'ArrowFunctionExpression';

  if (isBlockStatement && isFunctionBody) {
    const { start, end } = node.parent;
    const fnName = (node.parent.id && node.parent.id.name) || 'anonymous';
    const block = node.source();
    const blockWithoutCurlies = block.substring(1, block.length - 1);
    node.update(traceBlock(blockWithoutCurlies, fnName, start, end))
  }
  else if (isArrowFnReturnType && isFunctionBody) {
    const { start, end } = node.parent;
    const fnName = (node.parent.id && node.parent.id.name) || 'anonymous';
    const block = node.source();
    const returnedBlock = `return (${block});`;
    node.update(traceBlock(returnedBlock, fnName, start, end))
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

const modifiedSource = output.toString();

// TODO: Maybe change this name to avoid conflicts?
const nextId = (() => {
  let id = 0;
  return () => id++;
})();

const arrToPrettyStr = (arr) =>
  arr.map(a => _.isString(a) ? a : prettyFormat(a)).join(' ') + '\n'

const Tracer = {
  enterFunc: (id, name, start, end) => postEvent(Events.EnterFunction(id, name, start, end)),
  exitFunc: (id, name, start, end) => postEvent(Events.ExitFunction(id, name, start, end)),
  errorFunc: (message, id, name, start, end) => postEvent(Events.ErrorFunction(message, id, name, start, end)),
  log: (...args) => postEvent(Events.ConsoleLog(arrToPrettyStr(args))),
  warn: (...args) => postEvent(Events.ConsoleWarn(arrToPrettyStr(args))),
  error: (...args) => postEvent(Events.ConsoleError(arrToPrettyStr(args))),
};

const fn = new Function(
  'nextId',
  'Tracer',
  'fetch',
  'lodash',
  '_',
  modifiedSource,
);

const origConsoleLog = console.log;
const origConsoleWarn = console.warn;
const origConsoleError = console.error;
console.log = Tracer.log;
console.warn = Tracer.warn;
console.error = Tracer.error;

fn(
  nextId,
  Tracer,
  fetch,
  _,
  _,
);
