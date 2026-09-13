const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const Module=require('node:module');
const ts=require('typescript');
const filename=path.resolve(__dirname,'../src/store/index.ts');
const loaded=new Module(filename,module);loaded.paths=Module._nodeModulePaths(path.dirname(filename));
const original=loaded.require.bind(loaded);
loaded.require=name=>name==='../lib/models'?{DEFAULT_MODE:'quick',isKnownMode:value=>['quick','balanced'].includes(value)}:original(name);
loaded._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
const store=loaded.exports.useDocTalkStore;
const citation={refIndex:1,chunkId:'chunk',page:3,textSnippet:'Source',focusSnippet:'Exact source',bboxes:[{page:3,x:.1,y:.1,w:.6,h:.2},{page:4,x:.1,y:.1,w:.6,h:.2}]};
test('single-page citation excludes other chunk pages and retains answer origin',()=>{
 store.getState().navigateToCitation(citation,'answer');
 assert.deepEqual(store.getState().highlights.map(x=>x.page),[3]);
 assert.equal(store.getState().citationTarget.messageId,'answer');
 assert.equal(citation.bboxes.length,2,'does not mutate the stored answer');
});
test('honest page ranges retain both pages and repeated clicks create new navigation identity',()=>{
 store.getState().navigateToCitation({...citation,pageEnd:4});
 assert.deepEqual(store.getState().highlights.map(x=>x.page),[3,4]);
 const previous=store.getState().citationTarget.citation,nonce=store.getState().scrollNonce;
 store.getState().navigateToCitation(citation);
 assert.notEqual(store.getState().citationTarget.citation,previous);
 assert.equal(store.getState().scrollNonce,nonce+1);
 assert.equal(store.getState().citationTarget.messageId,undefined,'quote/tool navigation cannot retain old answer origin');
});
test('clearing a document removes its evidence, focus and citation identity',()=>{
 store.getState().clearDocumentTransientState();
 assert.equal(store.getState().citationTarget,null);assert.equal(store.getState().highlightFocus,null);assert.deepEqual(store.getState().highlights,[]);
});
