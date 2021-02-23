// Inspired by: http://alltom.com/pages/instrumenting-javascript/
// This is the target code to get after instrumenting
// const traceBlock = (code, fnName, start, end) => `{
//   const idWithExtensionToAvoidConflicts = nextId();
//   Tracer.enterFunc(idWithExtensionToAvoidConflicts, '${fnName}', ${start}, ${end});
//   try {
//     ${code}
//   } catch (e) {
//     Tracer.errorFunc(e.message, idWithExtensionToAvoidConflicts, '${fnName}', ${start}, ${end});
//     throw e;
//   } finally {
//     Tracer.exitFunc(idWithExtensionToAvoidConflicts, '${fnName}', ${start}, ${end});
//   }
// }`;

const traceFunction = (babel) => {
  const t = babel.types;

  const makeTracerFunc = (type, nextId, fnName, start, end) => {
    const tracerEnterFunc = t.memberExpression(
      t.identifier('Tracer'),
      t.identifier(`${type}`)
    );
    return t.callExpression(tracerEnterFunc, [
      nextId,
      t.stringLiteral(`${fnName}`),
      t.numericLiteral(start),
      t.numericLiteral(end),
    ]);
  };

  const transformFunction = (path) => {
    let start, end, fnName, oriBody;
    start = path.node.start;
    end = path.node.end;
    oriBody = path.node.body.body;
    // Check type of function
    if (path.node.type === 'FunctionDeclaration' || 'FunctionExpression') {
      path.node.id && path.node.id.name
        ? (fnName = path.node.id.name)
        : 'anonymous';
    } else if (path.node.type === 'ArrowFunctionExpression') {
      fnName = path.container.id.name;
    } else {
      throw new Error('Unsupported type:', path.node.type);
    }

    const nextId = t.callExpression(t.identifier('nextId'), []);

    // Make Tracer Function to instrument
    const tracerEnter = makeTracerFunc('enterFunc', nextId, fnName, start, end);
    const tracerError = makeTracerFunc('errorFunc', nextId, fnName, start, end);
    const tracerExit = makeTracerFunc('exitFunc', nextId, fnName, start, end);

    // Make Catch Block with tracerError
    const catchExp = t.expressionStatement(tracerError);
    const catchBlockStatement = t.blockStatement([catchExp]);
    const catchBlock = t.catchClause(t.identifier('e'), catchBlockStatement);

    // Make Finally Block with tracerExit
    const finallyExp = t.expressionStatement(tracerExit);
    const finallyBlockStatement = t.blockStatement([finallyExp]);

    // Make a copy of the existing node.body to avoid circular injection via the push container
    const oriCodeBlockStatement = JSON.parse(JSON.stringify(path.node.body));

    // Push the Tracer Enter Func to run before original code
    oriCodeBlockStatement.body.unshift(tracerEnter);

    // Build the final try-catch-finally block
    const tryBlock = t.tryStatement(
      oriCodeBlockStatement,
      catchBlock,
      finallyBlockStatement
    );

    // Clear the existing body
    oriBody.length = 0;

    path.get('body').pushContainer('body', tryBlock);
  };

  return {
    visitor: {
      FunctionDeclaration(path) {
        transformFunction(path);
      },
      FunctionExpression(path) {
        transformFunction(path);
      },
    },
  };
};

module.exports = { traceFunction };
