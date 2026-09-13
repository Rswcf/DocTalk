const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function harness(relative, name, mocks = {}) {
  const slots = [], cleanups = [];
  let cursor = 0, effects = [];
  const react = {
    useRef(value) { return slots[cursor++] ||= { current: value }; },
    useState(value) { const i = cursor++; slots[i] ||= { value }; return [slots[i].value, next => { slots[i].value = typeof next === 'function' ? next(slots[i].value) : next; }]; },
    useCallback(fn) { cursor++; return fn; },
    useEffect(effect, deps) {
      const i = cursor++;
      if (!slots[i] || deps.some((v, j) => !Object.is(v, slots[i].deps[j]))) {
        slots[i] = { deps }; effects.push({ i, effect });
      }
    },
  };
  const filename = path.resolve(__dirname, '../src/lib', relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename,'utf8'), {
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},fileName:filename,
  }).outputText;
  const loaded = new Module(filename,module);
  const dependencies = {react, ...mocks};
  loaded.require = request => { assert.ok(Object.hasOwn(dependencies, request),request); return dependencies[request]; };
  loaded._compile(compiled,filename);
  return {
    render(...args) {
      cursor=0; effects=[];
      const result=loaded.exports[name](...args);
      for (const {i,effect} of effects) { cleanups[i]?.(); cleanups[i]=effect(); }
      return result;
    },
    unmount() { cleanups.forEach(fn=>fn?.()); },
  };
}
const url='http://files.test/document.pdf?signature=expired';
const deferred=()=>{let resolve; const promise=new Promise(r=>{resolve=r;}); return {promise,resolve};};

test('PDF automatically renews once, ignores duplicate failures, and allows a manual retry',async()=>{
  const h=harness('usePdfRecovery.ts','usePdfRecovery'); let calls=0;
  const refresh=async()=>{calls++;throw Error('offline');};
  await h.render(url,refresh).retry(true);
  await h.render(url,refresh).retry(true);
  assert.equal(calls,1);
  await h.render(url,refresh).retry(); assert.equal(calls,2);
  assert.equal(h.render(url,refresh).refreshing,false); h.unmount();
});
test('PDF concurrent errors coalesce and same signed URL forces a fresh loading task',async()=>{
  const h=harness('usePdfRecovery.ts','usePdfRecovery'), pending=deferred(); let calls=0;
  const refresh=()=>{calls++;return pending.promise;};
  const request=h.render(url,refresh).retry(true);
  await h.render(url,refresh).retry(); assert.equal(calls,1);
  assert.equal(h.render(url,refresh).refreshing,true);
  pending.resolve(url); await request;
  assert.equal(h.render(url,refresh).revision,1); h.unmount();
});
test('a new signature does not reset the automatic retry budget; a new file does',async()=>{
  const h=harness('usePdfRecovery.ts','usePdfRecovery');let calls=0;
  const refresh=async()=>{calls++;return url+'2';};
  await h.render(url,refresh).retry(true);
  await h.render(url+'2',refresh).retry(true); assert.equal(calls,1);
  await h.render('http://files.test/second.pdf',refresh).retry(true);assert.equal(calls,2);h.unmount();
});
test('switching documents and unmounting discard pending retry completions',async()=>{
  const h=harness('usePdfRecovery.ts','usePdfRecovery'), pending=deferred();
  const request=h.render(url,()=>pending.promise).retry(true);
  h.render('http://files.test/second.pdf');pending.resolve(url);await request;
  assert.equal(h.render('http://files.test/second.pdf').revision,0);
  const last=deferred(), active=h.render('http://files.test/second.pdf',()=>last.promise).retry();
  h.unmount();last.resolve('http://files.test/second.pdf');await active;
});
test('stable proxy URLs have manual retry without automatic network loops',async()=>{
  const h=harness('usePdfRecovery.ts','usePdfRecovery');
  await h.render(url).retry(true);assert.equal(h.render(url).revision,0);
  await h.render(url).retry();assert.equal(h.render(url).revision,1);h.unmount();
});

test('file renewal only updates its URL, preserves reader state, and drops a stale document response',async()=>{
  let activeDocument, pdfUrl, cleared=0;const pending=[];
  const store={setDocument:id=>{activeDocument=id;},setPdfUrl:value=>{pdfUrl=value;},
    clearDocumentTransientState:()=>{cleared++;},setDocumentName(){},setDocumentStatus(){},setIsDemo(){},
    setLastDocument(){},setDocumentSummary(){},setSuggestedQuestions(){}};
  const noMetadata=new Promise(()=>{}), locale={t:key=>key,tOr:key=>key};
  const h=harness('useDocumentLoader.ts','useDocumentLoader',{
    './api':{ApiError:class extends Error{},getDocument:()=>noMetadata,getDocumentFileUrl:()=>{const d=deferred();pending.push(d);return d.promise;},getConvertedFileUrl:async()=>({url:'converted'})},
    './errorCopy':{errorCopy:()=>({}),parseWorkerErrorMsg:()=>({})},'./utils':{sanitizeFilename:x=>x},
    '../i18n':{useLocale:()=>locale},'../store':{useDocTalkStore:()=>store},
  });
  try {
    const loader=h.render('first'); const renewal=loader.refreshPdfUrl();pending[0].resolve({url:'renewed'});await renewal;
    assert.equal(pdfUrl,'renewed');assert.equal(cleared,1);assert.equal(activeDocument,'first');
    locale.t=key=>'new-locale:'+key;h.render('first');assert.equal(cleared,1,'locale change does not wipe reader position/search');
    const stale=h.render('first').refreshPdfUrl();h.render('second');pending[1].resolve({url:'old-document'});
    assert.equal(await stale,undefined);assert.equal(pdfUrl,null);assert.equal(activeDocument,'second');
    await h.render('second').refreshConvertedPdfUrl();assert.equal(h.render('second').convertedPdfUrl,'converted');
  } finally { h.unmount(); }
});
