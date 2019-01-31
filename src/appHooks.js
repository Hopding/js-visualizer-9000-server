const asyncHooks = require('async_hooks');
const fs = require('fs');
const fetch = require('node-fetch');
const prettyFormat = require('pretty-format');
const _ = require('lodash');
const util = require('util');

// const { queueMicrotask } = require('queue_microtask');

const LOG_FILE = './log-app.txt';
fs.writeFileSync(LOG_FILE, '');
const log = (...msg) => fs.appendFileSync(
  LOG_FILE,
  msg.map(m => _.isString(m) ? m : prettyFormat(m)).join(' ') + '\n'
);

// We only care about these async hook types:
//   Microtask, Timeout
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

const asyncIdToPromise = {};
const allMap = {};

const init = (asyncId, type, triggerAsyncId, resource) => {
  allMap[asyncId] = resource;
  if (isIgnoredHookType(type)) return;
  if (type === 'PROMISE') {
    log('ASYNC_HOOK:', asyncId, type, resource, resource.promise.then);
    for (var key in resource.promise) {
      log('KEY:', key)
    }
    asyncIdToPromise[asyncId] = resource.promise;
  } else if (type === 'Timeout') {
    log('ASYNC_HOOK:', asyncId, type, resource._onTimeout);
  } else if (type === 'TickObject') {
    log('ASYNC_HOOK:', asyncId, type);
  } else {
    log('ASYNC_HOOK:', asyncId, type);
  }

  const trigger = asyncIdToPromise[triggerAsyncId];
  log('TRIGGER:', triggerAsyncId, trigger)

  // log('ACTIVE_HANDLES', process._getActiveHandles().map(o => o.constructor.name));
  // log('ACTIVE_REQUESTS', process._getActiveRequests().map(o => o.constructor.name));
}

const before = (asyncId) => {
  const promise = (asyncIdToPromise[asyncId] || allMap[asyncId] || { constructor: {} }).constructor.name;
  log('BEFORE:', asyncId, util.inspect(promise,
    { showHidden: true, getters: true, showProxy: true }))

  // log('ACTIVE_HANDLES', process._getActiveHandles().map(o => o.constructor.name));
  // log('ACTIVE_REQUESTS', process._getActiveRequests().map(o => o.constructor.name));
}

const after = (asyncId) => {
  const promise = (asyncIdToPromise[asyncId] || allMap[asyncId] || { constructor: {} }).constructor.name;
  log('AFTER:', asyncId, util.inspect(promise,
    { showHidden: true, getters: true, showProxy: true }))
  log()
}
const destroy = (asyncId) => {
  const promise = (asyncIdToPromise[asyncId] || allMap[asyncId] || { constructor: {} }).constructor.name;
  log('DESTROY:', asyncId, util.inspect(promise,
    { showHidden: true, getters: true, showProxy: true }))
}

const promiseResolve = (asyncId) => {
  const promise = (asyncIdToPromise[asyncId] || allMap[asyncId] || { constructor: {} }).constructor.name;
  log('PROMISE_RESOLVE:', asyncId, util.inspect(promise,
    { showHidden: true, getters: true, showProxy: true }))

  // log('ACTIVE_HANDLES', process._getActiveHandles().map(o => o.constructor.name));
  // log('ACTIVE_REQUESTS', process._getActiveRequests().map(o => o.constructor.name));
}

asyncHooks
  .createHook({ init, before, after, destroy, promiseResolve })
  .enable();

// Promise.resolve().then(function foobar() {
//   console.log('TEST!')
// })

log('\nRUNNING\n')

setTimeout(function myTimeout() {}, 0);
fetch('https://www.google.com')
  .then(
    function foobar() {
      // log(' ===== foobar() =====')
      return Promise.resolve().then(() => {
        // log(' ===== Hello Newbs! ===== ')
      })
    }
  )
  .catch(
    function quxbaz() {
      // log(' ===== quxbaz() =====')
    }
  )
  .then(
    function bingbang() {
      // log(' ===== bingbang() =====')
    }
  )


// const p = fetch('https://www.google.com');
//
// p.then(
//     function foobar() {
      // log(' ===== foobar(1) =====')
      // Promise.resolve().then(() => {
      //   log(' ===== Hello Newbs! ===== ')
      // })
      // log(' ===== foobar(2) =====')
//     }
//   )
//   .catch(
//     function quxbaz() {
//       log(' ===== quxbaz() =====')
//     }
//   )
//   .then(
//     function bingbang() {
//       log(' ===== bingbang() =====')
//     }
//   )
