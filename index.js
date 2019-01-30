const asyncHooks = require('async_hooks');
const fs = require('fs');

const init = (asyncId, type, triggerAsyncId, resource) => {
  // console.log('INIT:', type)
  const msg = `INIT: ${type}, ${resource.constructor.name}`
  fs.appendFileSync('./log.txt', msg);
}

const eid = asyncHooks.executionAsyncId();
const tid = asyncHooks.triggerAsyncId();

const asyncHook = asyncHooks.createHook({
  init,
  // before,
  // after,
  // destroy,
  // promiseResolve,
});

asyncHook.enable();

/******************************************************************************/

function funcOne() { }
function funcTwo() {
  funcOne()
}

function taskOne() { }
function taskTwo() { }

function microtaskOne() { }
function microtaskTwo() { }

setTimeout(taskOne, 0)
// Promise.resolve().then(microtaskOne)
// setTimeout(taskTwo, 5)
// Promise.resolve().then(microtaskTwo)
// funcTwo();
