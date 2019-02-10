# JavaScript Visualizer 9000 Server

Produces events for code submitted by https://jsv9000.app. The repo for the client is [here](https://github.com/Hopding/js-visualizer-9000-client).

For example, upon receiving this input code:

```js
function logA() {
  console.log('A');
}
function logB() {
  console.log('B');
}
function logC() {
  console.log('C');
}
function logD() {
  console.log('D');
}

// Click the "RUN" button to learn how this works!
logA();
setTimeout(logB, 0);
Promise.resolve().then(logC);
logD();

// NOTE:
//   This is an interactive vizualization. So try
//   editing this code and see what happens. You
//   can also try playing with some of the examples
//   from the dropdown!
```

The server logs the following:

```
Received: {"type":"RunCode","payload":"function logA() { console.log('A') }\nfunction logB() { console.log('B') }\nfunction logC() { console.log('C') }\nfunction logD() { console.log('D') }\n\n// Click the \"RUN\" button to learn how this works!\nlogA();\nsetTimeout(logB, 0);\nPromise.resolve().then(logC);\nlogD();\n\n// NOTE:\n//   This is an interactive vizualization. So try \n//   editing this code and see what happens. You\n//   can also try playing with some of the examples \n//   from the dropdown!"}
Worker MESSAGE: {"type":"EnterFunction","payload":{"id":0,"name":"logA","start":0,"end":36}}
Worker MESSAGE: {"type":"ConsoleLog","payload":{"message":"A\n"}}
Worker MESSAGE: {"type":"ExitFunction","payload":{"id":0,"name":"logA","start":0,"end":36}}
Worker MESSAGE: {"type":"InitTimeout","payload":{"id":5,"callbackName":"logB"}}
Worker MESSAGE: {"type":"InitPromise","payload":{"id":6,"parentId":2}}
Worker MESSAGE: {"type":"ResolvePromise","payload":{"id":6}}
Worker MESSAGE: {"type":"InitPromise","payload":{"id":7,"parentId":6}}
Worker MESSAGE: {"type":"EnterFunction","payload":{"id":1,"name":"logD","start":111,"end":147}}
Worker MESSAGE: {"type":"ConsoleLog","payload":{"message":"D\n"}}
Worker MESSAGE: {"type":"ExitFunction","payload":{"id":1,"name":"logD","start":111,"end":147}}
Worker MESSAGE: {"type":"BeforePromise","payload":{"id":7}}
Worker MESSAGE: {"type":"EnterFunction","payload":{"id":2,"name":"logC","start":74,"end":110}}
Worker MESSAGE: {"type":"ConsoleLog","payload":{"message":"C\n"}}
Worker MESSAGE: {"type":"ExitFunction","payload":{"id":2,"name":"logC","start":74,"end":110}}
Worker MESSAGE: {"type":"ResolvePromise","payload":{"id":7}}
Worker MESSAGE: {"type":"AfterPromise","payload":{"id":7}}
Worker MESSAGE: {"type":"BeforeTimeout","payload":{"id":5}}
Worker MESSAGE: {"type":"EnterFunction","payload":{"id":3,"name":"logB","start":37,"end":73}}
Worker MESSAGE: {"type":"ConsoleLog","payload":{"message":"B\n"}}
Worker MESSAGE: {"type":"ExitFunction","payload":{"id":3,"name":"logB","start":37,"end":73}}
Worker EXIT: 0
{ resolvedPromiseIds: [ 6, 7 ],
  promisesWithInvokedCallbacksInfo: [ { id: 7, name: 'logC' } ],
  parentsIdsOfPromisesWithInvokedCallbacks: [ { id: 6, name: 'logC' } ] }
[ '{"type":"EnterFunction","payload":{"id":0,"name":"logA","start":0,"end":36}}',
  '{"type":"ConsoleLog","payload":{"message":"A\\n"}}',
  '{"type":"ExitFunction","payload":{"id":0,"name":"logA","start":0,"end":36}}',
  '{"type":"InitTimeout","payload":{"id":5,"callbackName":"logB"}}',
  '{"type":"InitPromise","payload":{"id":6,"parentId":2}}',
  '{"type":"ResolvePromise","payload":{"id":6}}',
  '{"type":"EnqueueMicrotask","payload":{"name":"logC"}}',
  '{"type":"InitPromise","payload":{"id":7,"parentId":6}}',
  '{"type":"EnterFunction","payload":{"id":1,"name":"logD","start":111,"end":147}}',
  '{"type":"ConsoleLog","payload":{"message":"D\\n"}}',
  '{"type":"ExitFunction","payload":{"id":1,"name":"logD","start":111,"end":147}}',
  '{"type":"BeforePromise","payload":{"id":7}}',
  '{"type":"DequeueMicrotask","payload":{}}',
  '{"type":"EnterFunction","payload":{"id":2,"name":"logC","start":74,"end":110}}',
  '{"type":"ConsoleLog","payload":{"message":"C\\n"}}',
  '{"type":"ExitFunction","payload":{"id":2,"name":"logC","start":74,"end":110}}',
  '{"type":"ResolvePromise","payload":{"id":7}}',
  '{"type":"AfterPromise","payload":{"id":7}}',
  '{"type":"Rerender","payload":{}}',
  '{"type":"BeforeTimeout","payload":{"id":5}}',
  '{"type":"EnterFunction","payload":{"id":3,"name":"logB","start":37,"end":73}}',
  '{"type":"ConsoleLog","payload":{"message":"B\\n"}}',
  '{"type":"ExitFunction","payload":{"id":3,"name":"logB","start":37,"end":73}}' ]
```
