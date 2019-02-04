const traceLoops = (babel) => {
  const t = babel.types;

  const transformLoop = (path) => {
    const iterateLoop = t.memberExpression(
      t.identifier('Tracer'),
      t.identifier('iterateLoop'),
    );
    const callIterateLoop = t.callExpression(iterateLoop, []);
    path.get('body').pushContainer('body', callIterateLoop);
  };

  return {
    visitor: {
      WhileStatement: transformLoop,
      DoWhileStatement: transformLoop,
      ForStatement: transformLoop,
      ForInStatement: transformLoop,
      ForOfStatement: transformLoop,
    }
  };
};

module.exports = { traceLoops };
