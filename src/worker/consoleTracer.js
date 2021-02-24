// This is to target console related function call
// To instrument enterFunc and exitFunc while getting the line code ref for client side render
// Only work at global level

const traceConsole = (babel) => {
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

  const transformConsole = (node, oriBodyArray, idx) => {
    const callee = node.expression.callee;
    const object = callee.object.name;
    const start = callee.start;
    const end = callee.end;

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

  return {
    visitor: {
      Program(path) {
        for (let i = 0; i < path.node.body.length; i++) {
          if (checker(path.node.body[i])) {
            console.log(path.node.body[i]);
            transformConsole(path.node.body[i], path.node.body, i);
            // Add by 2 here and another 1 at for loop
            // This is because we're appending to the original AST body array
            // Hence it is mutating by 3 position
            i = i + 2;
          } else {
          }
        }
      },
    },
  };
};

module.exports = { traceConsole };
