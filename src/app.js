const WebSocket = require('ws');
const { launchWorker } = require('./launchWorker');
const { reduceEvents } = require('./eventsReducer');

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

    // TODO: Implement support for a termination-message
    if (type === Messages.RunCode) {
      let events = [];

      launchWorker(payload, evtString => {
        const evt = JSON.parse(evtString);
        events.push(evt);

        if (evt.type === 'Done') {
          const reducedEvents = reduceEvents(events);
          console.log(reducedEvents.map(JSON.stringify))
          ws.send(JSON.stringify(reducedEvents));
        }
      });

    } else {
      console.error('Unknown message type:', type);
    }
  });
});
