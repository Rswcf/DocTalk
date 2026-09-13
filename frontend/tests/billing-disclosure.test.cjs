const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const ts=require('typescript');
function load(file,mocks={}) {
  const filename=path.resolve(__dirname,'../src/lib',file), loaded=new Module(filename,module);
  loaded.paths=Module._nodeModulePaths(path.dirname(filename));
  const original=loaded.require.bind(loaded);
  loaded.require=key=>Object.hasOwn(mocks,key)?mocks[key]:original(key);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},fileName:filename,
  }).outputText,filename);
  return loaded.exports;
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(api) {
  let cursor=0,effects=[];
  const slots=[],cleanups=[],timers=new Map();let timerId=0;
  const react={
    useState(value){const i=cursor++;slots[i]||={value};return [slots[i].value,next=>{slots[i].value=typeof next==='function'?next(slots[i].value):next;}];},
    useCallback(fn){cursor++;return fn;},
    useEffect(effect,deps){const i=cursor++;if(!slots[i]||deps.some((v,j)=>!Object.is(v,slots[i].deps[j]))){slots[i]={deps};effects.push({i,effect});}},
  };
  const oldSet=global.setTimeout,oldClear=global.clearTimeout;
  global.setTimeout=(fn,delay)=>{assert.equal(delay,3000);timers.set(++timerId,fn);return timerId;};
  global.clearTimeout=id=>timers.delete(id);
  const hook=load('useCheckoutStatus.ts',{react,'./api':api}).useCheckoutStatus;
  return {
    timers,
    render(id='cs_own',enabled=true){cursor=0;effects=[];const result=hook(id,enabled);for(const {i,effect} of effects){cleanups[i]?.();cleanups[i]=effect();}return result;},
    async next(){const entry=timers.entries().next().value;assert.ok(entry);timers.delete(entry[0]);entry[1]();await tick();},
    cleanup(){cleanups.forEach(fn=>fn?.());global.setTimeout=oldSet;global.clearTimeout=oldClear;},
  };
}
class ApiError extends Error {constructor(status){super();this.status=status;}}

test('annual full amount is independent of rounded monthly price',()=>{
  const {formatStripePlanPrice:format}=load('planPricing.ts');
  const prices=[{plan:'plus',period:'annual',currency:'USD',amount_minor:10000}];
  assert.equal(format(prices,'plus','annual','en'),'$8.33');
  assert.equal(format(prices,'plus','annual','en',false),'$100.00');
  assert.equal(format([],'plus','annual','en',false),'—');
  prices[0].amount_minor=9588;assert.equal(format(prices,'plus','annual','en',false),'$95.88');
});
test('checkout polls payment and fulfillment separately and stops on server completion',async()=>{
  const values=['payment_pending','processing','complete'];let calls=0;
  const h=harness({ApiError,getCheckoutStatus:async()=>({status:values[calls++]})});
  try{
    h.render();await tick();assert.equal(h.render().status,'payment_pending');
    await h.next();assert.equal(h.render().status,'processing');
    await h.next();assert.equal(h.render().status,'complete');assert.equal(h.timers.size,0);
  }finally{h.cleanup();}
});
test('success URL without a checkout ID cannot claim a purchase or query Stripe',async()=>{
  let calls=0;const h=harness({ApiError,getCheckoutStatus:async()=>{calls++;return {status:'complete'};}});
  try{h.render(null);assert.equal(h.render(null).status,'unavailable');assert.equal(calls,0);}finally{h.cleanup();}
});
test('unfulfilled checkout has bounded polling and an explicit fresh retry',async()=>{
  let calls=0;const h=harness({ApiError,getCheckoutStatus:async()=>{calls++;return {status:'processing'};}});
  try{
    h.render();await tick();for(let i=1;i<20;i++)await h.next();
    assert.equal(calls,20);assert.equal(h.render().status,'delayed');assert.equal(h.timers.size,0);
    h.render().retry();h.render();await tick();assert.equal(calls,21);assert.equal(h.render().status,'processing');
  }finally{h.cleanup();}
});
test('not-owned checkout stops immediately and a stale request cannot confirm another checkout',async()=>{
  let resolve;const pending=new Promise(r=>{resolve=r;});
  const h=harness({ApiError,getCheckoutStatus:id=>id==='cs_old'?pending:Promise.reject(new ApiError(404))});
  try{
    h.render('cs_old');h.render('cs_new');await tick();assert.equal(h.render('cs_new').status,'unavailable');
    resolve({status:'complete'});await tick();assert.equal(h.render('cs_new').status,'unavailable');assert.equal(h.timers.size,0);
  }finally{h.cleanup();}
});
test('checkout API encodes IDs and requests noncached status',async()=>{
  const original=global.fetch,calls=[];
  global.fetch=async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({status:'processing'}));};
  try{
    const api=load('api.ts');assert.deepEqual(await api.getCheckoutStatus('cs_test&other=value'),{status:'processing'});
    assert.ok(calls[0].url.endsWith('session_id=cs_test%26other%3Dvalue'));
    assert.equal(calls[0].options.cache,'no-store');
  }finally{global.fetch=original;}
});
