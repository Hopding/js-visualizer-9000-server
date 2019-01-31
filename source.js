function funcOne(cb) { cb(); }
function microtaskTwo()
   {
}

const x = function() {}
funcOne(() =>



{




})
const y = ()=>{
  const foo = 'bar'
}

funcOne(function abacus() {
  throw new Error('OMG')
})

setTimeout(function lulz()


{
  throw new Error('LULZ')
}, 0)

fetch('https://www.google.com')
  .then(function fetchCallback1(res) {
    return res.text()
  })
  .then(function fetchCallback2(text) {
    console.log('TEXT:', text.length)
  })
  .catch(function fetchErrorCallback(err) {
    console.error('Error:', err.message)
  })
