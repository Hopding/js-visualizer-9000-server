const { parentPort, workerData } = require('worker_threads');
const asyncHooks = require('async_hooks');
const fs = require('fs');
const fetch = require('node-fetch');
const falafel = require('falafel');
const prettyFormat = require('pretty-format');
const _ = require('lodash');
const util = require('util');

const LOG_FILE = './log.txt';
fs.writeFileSync(LOG_FILE, '');
const log = (...msg) => fs.appendFileSync(
  LOG_FILE,
  msg.map(m => _.isString(m) ? m : prettyFormat(m)).join(' ') + '\n'
);

const message = (type, payload) => ({ type, payload });
const Messages = {
  EnterFunction: (id, name) => message('EnterFunction', { id, name }),
  ExitFunction: (id, name) => message('ExitFunction', { id, name }),
  ErrorFunction: (id, name) => message('ErrorFunction', { id, name }),
  InitPromise: (id) => message('InitPromise', { id }),
  ResolvePromise: (id) => message('ResolvePromise', { id }),
  BeforePromise: (id) => message('BeforePromise', { id }),
  InitTimeout: (id, callbackName) => message('InitTimeout', { id, callbackName }),
  BeforeTimeout: (id) => message('BeforeTimeout', { id }),
}

const postMessage = (msgObj) => parentPort.postMessage(JSON.stringify(msgObj));

// We only care about these async hook types:
//   Microtask, Timeout
const ignoredAsyncHookTypes = [
  // 'FSEVENTWRAP', 'FSREQCALLBACK', 'GETADDRINFOREQWRAP', 'GETNAMEINFOREQWRAP',
  // 'HTTPPARSER', 'JSSTREAM', 'PIPECONNECTWRAP', 'PIPEWRAP', 'PROCESSWRAP',
  // 'QUERYWRAP', 'SHUTDOWNWRAP', 'SIGNALWRAP', 'STATWATCHER', 'TCPCONNECTWRAP',
  // 'TCPSERVERWRAP', 'TCPWRAP', 'TTYWRAP', 'UDPSENDWRAP', 'UDPWRAP', 'WRITEWRAP',
  // 'ZLIB', 'SSLCONNECTION', 'PBKDF2REQUEST', 'RANDOMBYTESREQUEST', 'TLSWRAP',
  // 'DNSCHANNEL',
];
const isIgnoredHookType = (type) => ignoredAsyncHookTypes.includes(type);

const eid = asyncHooks.executionAsyncId();
const tid = asyncHooks.triggerAsyncId();

const asyncIdToResource = {};

const init = (asyncId, type, triggerAsyncId, resource) => {
  if (isIgnoredHookType(type)) return;

  if (type === 'PROMISE') {
    log('ASYNC_HOOK:', type, resource, resource.promise.then);
    for (var key in resource.promise) {
      log('KEY:', key)
    }
  } else if (type === 'Timeout') {
    log('ASYNC_HOOK:', type, resource._onTimeout);
  } else {
    log('ASYNC_HOOK:', asyncId, type, resource);
  }

  asyncIdToResource[asyncId] = resource;
  if (type === 'PROMISE') {
    postMessage(Messages.InitPromise(asyncId));
  }
  if (type === 'Timeout') {
    const callbackName = resource._onTimeout.name || 'anonymous';
    postMessage(Messages.InitTimeout(asyncId, callbackName));
  }
}

const before = (asyncId) => {
  const resource = asyncIdToResource[asyncId] || {};
  log('BEFORE:', asyncId, util.inspect(resource,
    { showHidden: true, getters: true, showProxy: true }))

  const resourceName = (resource.constructor).name;
  if (resourceName === 'PromiseWrap') {
    postMessage(Messages.BeforePromise(asyncId));
  }
  if (resourceName === 'Timeout') {
    postMessage(Messages.BeforeTimeout(asyncId));
  }
}

const after = (asyncId) => {
  const resource = asyncIdToResource[asyncId] || {};
  log('AFTER:', asyncId, util.inspect(resource,
    { showHidden: true, getters: true, showProxy: true }))
  log()
}

const destroy = (asyncId) => {
  const resource = asyncIdToResource[asyncId] || {};
  log('DESTROY:', asyncId, util.inspect(resource,
    { showHidden: true, getters: true, showProxy: true }))
}

const promiseResolve = (asyncId) => {
  const promise = asyncIdToResource[asyncId].promise;
  log('PROMISE_RESOLVE:', asyncId, util.inspect(promise,
    { showHidden: true, getters: true, showProxy: true }))

  postMessage(Messages.ResolvePromise(asyncId));
}

asyncHooks
  .createHook({ init, before, after, destroy, promiseResolve })
  .enable();

const functionDefinitionTypes = [
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
];

const traceBlock = (code, fnName) => `{
  const idWithExtensionToAvoidConflicts = nextId();
  FunctionTracer.onEnter(idWithExtensionToAvoidConflicts, '${fnName}');
  try {
    ${code}
  } catch (e) {
    FunctionTracer.onError(idWithExtensionToAvoidConflicts, '${fnName}');
    throw e;
  } finally {
    FunctionTracer.onExit(idWithExtensionToAvoidConflicts, '${fnName}');
  }
}`

const jsSourceCode = workerData;

// TODO: HANDLE IMPLICIT RETURNS FROM ARROW FNS!
// TODO: HANDLE GENERATORS/ASYNC-AWAIT
const output = falafel(jsSourceCode, (node) => {
  const parentType = node.parent && node.parent.type;
  const isBlockStatement = node.type === 'BlockStatement';
  const isFunctionBody = functionDefinitionTypes.includes(parentType);

  if (isBlockStatement && isFunctionBody) {
    const fnName = (node.parent.id && node.parent.id.name) || 'anonymous';
    const block = node.source();
    const blockWithoutCurlies = block.substring(1, block.length - 1);
    node.update(traceBlock(blockWithoutCurlies, fnName))
  }
});

const modifiedSource = output.toString();

// TODO: Maybe change this name to avoid conflicts?
const nextId = (() => {
  let id = 0;
  return () => id++;
})();

const FunctionTracer = {
  onEnter: (id, name) => postMessage(Messages.EnterFunction(id, name)),
  onExit: (id, name) => postMessage(Messages.ExitFunction(id, name)),
  onError: (id, name) => postMessage(Messages.ErrorFunction(id, name)),
};

const fn = new Function('nextId', 'FunctionTracer', 'fetch', modifiedSource);

fn(nextId, FunctionTracer, fetch);
