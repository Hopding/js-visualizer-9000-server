const { Worker } = require('worker_threads');

const WORKER_FILE = './src/worker/worker.js';

const action = (type, payload) => JSON.stringify({ type, payload });
const Messages = {
  UncaughtError: (error) => action('UncaughtError', { error }),
  Done: (exitCode) => action('Done', { exitCode }),
}

const launchWorker = (jsSourceCode, onEvent) => {
  const worker = new Worker(WORKER_FILE, { workerData: jsSourceCode });

  worker.on('message', (message) => {
    console.log('Worker MESSAGE:', message)
    onEvent(message);
  });

  worker.on('error', (error) => {
    console.error('Worker ERROR:', error)
    onEvent(Messages.UncaughtError({
      name: error.name,
      stack: error.stack,
      message: error.message,
    }));
  });

  worker.on('exit', (code) => {
    console.log('Worker EXIT:', code)
    onEvent(Messages.Done(code));
  });

  return worker;
};

module.exports = { launchWorker };
