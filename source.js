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
