const WebSocket = require('ws');
const { launchWorker } = require('./launchWorker');
const { reduceEvents } = require('./eventsReducer');

// Heroku provides a PORT env var that we have to use
const port = process.env.PORT || 8080;
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
      let events = [];
      let isFinished = false;

      const worker = launchWorker(payload, evtString => {
        if (!isFinished) {
          const evt = JSON.parse(evtString);
          events.push(evt);

          if (evt.type === 'Done') {
            const reducedEvents = reduceEvents(events);
            console.log(reducedEvents.map(JSON.stringify))
            ws.send(JSON.stringify(reducedEvents));
          }
        }
      });
    } else {
      console.error('Unknown message type:', type);
    }
  });
});
