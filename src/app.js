const {
  Worker, isMainThread, parentPort, workerData
} = require('worker_threads');

const WebSocket = require('ws');

const { addTracingInstrumentation } = require('./instrumentor');

const WORKER_FILE = './src/worker.js';

const Messages = {
  RunCode: 'RunCode',
};

const port = 8080;

const wss = new WebSocket.Server({ port });

console.log('Running server on port:', port);

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    console.log('Received:', message)
    const { type, payload } = JSON.parse(message);
    if (type === Messages.RunCode) {
      // const fn = addTracingInstrumentation({
      //   jsSourceCode: payload,
      //   onEnter: (id, name) => console.log('Enter:', name, 'Id:', id),
      //   onError: (id, name) => console.log('Error:', name, 'Id:', id),
      //   onExit: (id, name) => console.log('Exit:', name, 'Id:', id),
      //   onUncaughtError: (e) => console.log('Uncaught Error:', e.message),
      // })
      // fn();

      const worker = new Worker(WORKER_FILE, { workerData: payload });
      worker.on('message', (message) => {
        console.log('Worker message:', message)
      });
      worker.on('error', (error) => {
        console.error('Worker error:', error)
      });
      worker.on('exit', (code) => {
        if (code !== 0)
          console.error(`Worker stopped with exit code ${code}`);
      });
    } else {
      console.error('Unknown message type:', type);
    }
  });
  ws.send('something');
});
