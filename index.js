require('./src/app');

// const asyncHooks = require('async_hooks');
// const fs = require('fs');
// const falafel = require('falafel');
// // const recast = require("recast");
// const fetch = require('node-fetch');
// const WebSocket = require('ws');
//
// const LOG_FILE = './log.txt';
//
// fs.writeFileSync(LOG_FILE, '');
//
// const log = (...msg) => {
//   fs.appendFileSync(LOG_FILE, msg.join(' ') + '\n');
// }
//
// const init = (asyncId, type, triggerAsyncId, resource) => {
//   const onTimeout = resource._onTimeout;
//   if (onTimeout) {
//     log(`INIT: ${type}, ${resource.constructor.name}, ${Object.getOwnPropertyNames(resource)}`);
//     log('  onTimeout:', onTimeout);
//   }
// }
//
// const eid = asyncHooks.executionAsyncId();
// const tid = asyncHooks.triggerAsyncId();
//
// const asyncHook = asyncHooks.createHook({
//   init,
//   // before,
//   // after,
//   // destroy,
//   // promiseResolve,
// });
//
// asyncHook.enable();
//
// const jsSource = String(fs.readFileSync('./source.js'));
//
// const functionDefinitionTypes = [
//   'FunctionDeclaration',
//   'FunctionExpression',
//   'ArrowFunctionExpression',
// ];
//
// const traceBlock = (code, fnName) => `{
//   const idWithExtensionToAvoidConflicts = nextId();
//   FunctionTracer.enter(idWithExtensionToAvoidConflicts, '${fnName}');
//   try {
//     ${code}
//   } catch (e) {
//     FunctionTracer.error(idWithExtensionToAvoidConflicts, '${fnName}');
//   } finally {
//     FunctionTracer.exit(idWithExtensionToAvoidConflicts, '${fnName}');
//   }
// }`
//
// // TODO: HANDLE IMPLICIT RETURNS FROM ARROW FNS!
// // TODO: HANDLE GENERATORS/ASYNC-AWAIT
// const output = falafel(jsSource, (node) => {
//   const parentType = node.parent && node.parent.type;
//   const isBlockStatement = node.type === 'BlockStatement';
//   const isFunctionBody = functionDefinitionTypes.includes(parentType);
//
//   if (isBlockStatement && isFunctionBody) {
//     const fnName = (node.parent.id && node.parent.id.name) || 'anonymous';
//     const block = node.source();
//     const blockWithoutCurlies = block.substring(1, block.length - 1);
//     node.update(traceBlock(blockWithoutCurlies, fnName))
//   }
// });
//
// const modifiedSource = output.toString();
//
// // console.log('=============== Modified Source ===============');
// // console.log(modifiedSource);
// // console.log('===============================================');
//
// const nextId = (() => {
//   let id = 0;
//   return () => id++;
// })();
//
// const FunctionTracer = {
//   enter: (id, name) => console.log('Enter:', name, 'Id:', id),
//   error: (id, name) => console.log('Error:', name, 'Id:', id),
//   exit: (id, name) => console.log('Exit:', name, 'Id:', id),
// };
//
// const fn = new Function('nextId', 'FunctionTracer', 'fetch', modifiedSource);
// fn(nextId, FunctionTracer, fetch);
//
//
// const wss = new WebSocket.Server({ port: 8080 });
//
// wss.on('connection', (ws) => {
//   ws.on('message', (message) => {
//     console.log('received: %s', message);
//   });
//
//   ws.send('something');
// });
