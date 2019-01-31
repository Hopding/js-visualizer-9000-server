const WebSocket = require('ws');
const { launchWorker } = require('./launchWorker');

const port = 8080;
const wss = new WebSocket.Server({ port });
console.log('Running server on port:', port);

const Messages = {
  RunCode: 'RunCode',
};

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    console.log('Received:', message)
    const { type, payload } = JSON.parse(message);
    if (type === Messages.RunCode) {
      launchWorker(payload, event => {
        console.log('Sending:', event);
        ws.send(event)
      });
    } else {
      console.error('Unknown message type:', type);
    }
  });
});

// require('./appHooks')
