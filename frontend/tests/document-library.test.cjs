const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const ts=require('typescript');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(api) {
  let cursor=0,effects=[],timerId=0;const slots=[],cleanups=[],timers=new Map();
  const react={
    useState(value){const i=cursor++;slots[i]||={value};return[slots[i].value,next=>{slots[i].value=typeof next==='function'?next(slots[i].value):next;}];},
    useCallback(fn){cursor++;return fn;},
    useEffect(effect,deps){const i=cursor++;if(!slots[i]||deps.some((v,j)=>!Object.is(v,slots[i].deps[j]))){slots[i]={deps};effects.push({i,effect});}},
  };
  const oldSet=global.setTimeout,oldClear=global.clearTimeout;
  global.setTimeout=(fn,delay)=>{assert.equal(delay,300);timers.set(++timerId,fn);return timerId;};global.clearTimeout=id=>timers.delete(id);
  const filename=path.resolve(__dirname,'../src/lib/useDocumentLibrary.ts'),loaded=new Module(filename,module);
  loaded.paths=Module._nodeModulePaths(path.dirname(filename));loaded.require=key=>key==='react'?react:api;
  loaded._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
  return {
    render(account='owner',enabled=true){cursor=0;effects=[];const result=loaded.exports.useDocumentLibrary(enabled,account);for(const {i,effect} of effects){cleanups[i]?.();cleanups[i]=effect();}return result;},
    debounce(){for(const [id,fn] of timers){timers.delete(id);fn();}},
    cleanup(){cleanups.forEach(fn=>fn?.());global.setTimeout=oldSet;global.clearTimeout=oldClear;},
  };
}
const rows=n=>Array.from({length:n},(_,i)=>({id:String(i),filename:`report-${i}.pdf`}));
test('library pages use a lookahead and search the server after debounce',async()=>{
 const calls=[];const h=harness({getMyDocuments:async(signal,options)=>{calls.push(options);return rows(21);}});
 try{
  h.render();await tick();let state=h.render();assert.equal(state.documents.length,20);assert.equal(state.hasNext,true);
  state.next();h.render();await tick();assert.equal(calls.at(-1).offset,20);
  h.render().setQuery('  old annual  ');h.render();assert.equal(calls.length,2);h.debounce();h.render();await tick();
  assert.deepEqual(calls.at(-1),{q:'old annual',sort:'newest',offset:0,limit:21});
  h.render().setSort('name');h.render();await tick();assert.equal(calls.at(-1).sort,'name');
 }finally{h.cleanup();}
});
test('late library responses cannot expose a previous account or previous query',async()=>{
 const pending=[];const h=harness({getMyDocuments:(signal,options)=>new Promise(resolve=>pending.push({signal,options,resolve}))});
 try{
  h.render('A');h.render('B');assert.equal(pending[0].signal.aborted,true);
  pending[0].resolve([{id:'private-A'}]);await tick();assert.deepEqual(h.render('B').documents,[]);
  pending[1].resolve([{id:'owned-B'}]);await tick();assert.equal(h.render('B').documents[0].id,'owned-B');
  assert.deepEqual(h.render('C').documents,[]);
 }finally{h.cleanup();}
});
test('load failures remain distinguishable from empty results and can retry',async()=>{
 let fail=true;const h=harness({getMyDocuments:async()=>{if(fail)throw new Error('offline');return [];}});
 try{h.render();await tick();assert.equal(h.render().error,true);fail=false;h.render().refresh();h.render();await tick();assert.equal(h.render().error,false);assert.deepEqual(h.render().documents,[]);}finally{h.cleanup();}
});
test('removing the last row of a later page returns to the preceding page',async()=>{
 const calls=[];const h=harness({getMyDocuments:async(signal,options)=>{calls.push(options.offset);return options.offset?[]:rows(20);}});
 try{h.render();await tick();h.render().next();h.render();await tick();h.render();await tick();assert.equal(h.render().page,0);assert.deepEqual(calls,[0,20,0]);}finally{h.cleanup();}
});


test('same-account refresh preserves rows while a new response is pending', async () => {
 let resolve; let calls=0;
 const h=harness({getMyDocuments:()=> ++calls===1 ? Promise.resolve(rows(2)) : new Promise(r=>{resolve=r;})});
 try {
  h.render();await tick();h.render().refresh();h.render();
  assert.equal(h.render().documents.length,2);assert.equal(h.render().loading,true);
  assert.deepEqual(h.render('new-account').documents,[]);
  resolve([]);await tick();
 }finally{h.cleanup();}
});

test('failed navigation cannot label previous-page rows with the requested page number', async () => {
 const h=harness({getMyDocuments:async(signal,options)=>{if(options.offset)throw new Error('offline');return rows(21);}});
 try {
  h.render();await tick();assert.equal(h.render().documents.length,20);
  h.render().next();h.render();await tick();
  assert.equal(h.render().page,1);assert.equal(h.render().error,true);assert.deepEqual(h.render().documents,[]);
  h.render().previous();h.render();await tick();
  assert.equal(h.render().page,0);assert.equal(h.render().documents.length,20);
 }finally{h.cleanup();}
});
