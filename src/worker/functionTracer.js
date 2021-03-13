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

  const makeTracerErrorFunc = (type, nextId, fnName, start, end) => {
    const tracerEnterFunc = t.memberExpression(
      t.identifier('Tracer'),
      t.identifier(`${type}`)
    );

    const errorMessage = t.memberExpression(
      t.identifier('e'),
      t.identifier(`message`)
    );

    return t.callExpression(tracerEnterFunc, [
      errorMessage,
      nextId,
      t.stringLiteral(`${fnName}`),
      t.numericLiteral(start),
      t.numericLiteral(end),
    ]);
  };

  const transformConsoleInFunc = (node, oriBodyArray, idx) => {
    const callee = node.expression.callee;
    const object = callee.object.name;

    const start = callee.start;
    const end = callee.end;
    console.log(node.expression.callee);
    const property = callee.property.name;
    fnName = `${object}.${property}`;
    // Check type of console call expression
    const nextId = t.callExpression(t.identifier('nextId'), []);

    // Make Tracer Function to instrument
    const tracerEnter = makeTracerFunc('enterFunc', nextId, fnName, start, end);
    const tracerExit = makeTracerFunc('exitFunc', nextId, fnName, start, end);

    // Insert the tracer by mutating original Array
    oriBodyArray.splice(idx, 0, tracerEnter);
    oriBodyArray.splice(idx + 2, 0, tracerExit);
  };

  function checker(node) {
    try {
      let res =
        node['expression']['callee']['object']['name'] &&
        node['expression']['callee']['object']['name'] == 'console' &&
        node['expression']['callee']['property']['name'];
      return res;
    } catch (error) {
      console.log('error here');
      return false;
    }
  }

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
    const tracerError = makeTracerErrorFunc(
      'errorFunc',
      nextId,
      fnName,
      start,
      end
    );
    const tracerExit = makeTracerFunc('exitFunc', nextId, fnName, start, end);
    // Rethrow Error to ensure original try catch still get the thrown error
    const reThrowError = t.throwStatement(t.identifier('e'));

    // Make Catch Block with tracerError
    const catchExp = t.expressionStatement(tracerError);
    const catchBlockStatement = t.blockStatement([catchExp, reThrowError]);
    const catchBlock = t.catchClause(t.identifier('e'), catchBlockStatement);

    // Make Finally Block with tracerExit
    const finallyExp = t.expressionStatement(tracerExit);
    const finallyBlockStatement = t.blockStatement([finallyExp]);

    // Make a copy of the existing node.body to avoid circular injection via the push container

    const oriCodeBlockStatement = JSON.parse(JSON.stringify(path.node.body));

    for (let i = 0; i < oriCodeBlockStatement.body.length; i++) {
      if (checker(oriCodeBlockStatement.body[i])) {
        transformConsoleInFunc(
          oriCodeBlockStatement.body[i],
          oriCodeBlockStatement.body,
          i
        );
        i = i + 2;
      } else {
      }
    }

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
