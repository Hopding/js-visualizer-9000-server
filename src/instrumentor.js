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
  onUncaughtError,
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

  // const FunctionTracer = {
    // enter: (id, name) => console.log('Enter:', name, 'Id:', id),
    // error: (id, name) => console.log('Error:', name, 'Id:', id),
    // exit: (id, name) => console.log('Exit:', name, 'Id:', id),
  // };

  const FunctionTracer = { onEnter, onExit, onError };

  const fn = new Function('nextId', 'FunctionTracer', 'fetch', modifiedSource);

  return () => {
    try {
      fn(nextId, FunctionTracer, fetch);
    } catch (e) {
      onUncaughtError(e);
    }
  }
}

module.exports = { addTracingInstrumentation };
