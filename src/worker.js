const {
  Worker, isMainThread, parentPort, workerData
} = require('worker_threads');
const fetch = require('node-fetch');
const falafel = require('falafel');

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

const addTracingInstrumentation = ({
  jsSourceCode,
  onEnter,
  onExit,
  onError,
}) => {
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

  const nextId = (() => {
    let id = 0;
    return () => id++;
  })();

  const FunctionTracer = { onEnter, onExit, onError };

  const fn = new Function('nextId', 'FunctionTracer', 'fetch', modifiedSource);

  return () => fn(nextId, FunctionTracer, fetch);
}

const jsSourceCode = workerData;

const message = (type, payload) => ({ type, payload });
const Messages = {
  EnterFunction: (id, name) => message('EnterFunction', { id, name }),
  ExitFunction: (id, name) => message('ExitFunction', { id, name }),
  ErrorFunction: (id, name) => message('ErrorFunction', { id, name }),
}

const postMessage = (msgObj) => parentPort.postMessage(JSON.stringify(msgObj));

const fn = addTracingInstrumentation({
  jsSourceCode,
  onEnter: (id, name) => postMessage(Messages.EnterFunction(id, name)),
  onExit: (id, name) => postMessage(Messages.ExitFunction(id, name)),
  onError: (id, name) => postMessage(Messages.ErrorFunction(id, name)),
})
fn();
