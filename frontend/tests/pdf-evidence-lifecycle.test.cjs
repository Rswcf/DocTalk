// Exercise the actual measurement effect with DOM/scheduler boundaries mocked.
// Geometry correctness is covered separately by real-PDF browser acceptance.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/components/PdfViewer/PageWithHighlights.tsx');
const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const source = ts.createSourceFile(filename, js, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
let body;
(function visit(node) {
 if (ts.isCallExpression(node) && node.expression.getText(source)==='useLayoutEffect') body=node.arguments[0].body.getText(source);
 ts.forEachChild(node,visit);
})(source);
assert.ok(body);
function harness() {
 const updates=[];let notifications=0;
 const scope={
  root:{current:{querySelector:()=>({getBoundingClientRect:()=>({width:612,height:792,left:0,top:0})}),querySelectorAll:()=>[]}},
  pageFailed:false,pageDims:{w:612,h:792},scale:1,searchQuery:'',textEpoch:1,textFailed:false,
  textRenderRef:{current:{scale:1,searchQuery:''}},candidate:'A complete source.',navigationId:1,pageNumber:1,regions:[],
  measuredRef:{current:null},setEvidence:value=>updates.push(value),onEvidenceReady:()=>notifications++,
  requestAnimationFrame:()=>1,cancelAnimationFrame(){},ResizeObserver:class {observe(){} disconnect(){}},
  findEvidenceRange:()=>null,mergeEvidenceLines:()=>[],groupEvidenceMargins:regions=>regions,validEvidenceBox:()=>true,evidenceOverlap:()=>true,
 };
 return {scope,updates,notifications:()=>notifications,effect:()=>Function(...Object.keys(scope),body.slice(1,-1))(...Object.values(scope))?.()};
}
function seedExact(h) {
 h.scope.measuredRef.current={kind:'exact',rects:[{x:.1,y:.1,w:.3,h:.02}],ready:true,candidate:h.scope.candidate,navigationId:1,textEpoch:1};
}
test('zoom keeps exact geometry until the new text layer completes',()=>{
 const h=harness();seedExact(h);h.scope.scale=1.5;h.effect();
 assert.equal(h.updates.length,0);assert.equal(h.notifications(),0);
 // A completed empty layer is distinct from a partially rebuilt layer.
 h.scope.textRenderRef.current.scale=1.5;h.scope.textEpoch++;h.effect();
 assert.deepEqual(h.updates.at(-1),{kind:'page',rects:[],ready:true});
});
test('search rebuild preserves the same evidence without status announcements',()=>{
 const h=harness();seedExact(h);h.scope.searchQuery='source';h.effect();
 assert.equal(h.updates.length,0);assert.equal(h.notifications(),0);
});
test('a new citation during zoom cannot inherit old exact geometry',()=>{
 const h=harness();seedExact(h);h.scope.scale=1.5;h.scope.navigationId=2;h.effect();
 assert.deepEqual(h.updates.at(-1),{kind:'page',rects:[],ready:false});
});
test('repeated identical measurements do not rerender the viewer',()=>{
 const h=harness();h.effect();h.effect();h.effect();
 assert.equal(h.updates.length,1);assert.equal(h.notifications(),1);
 h.scope.navigationId++;h.effect();assert.equal(h.notifications(),2);
});
test('a page load failure ends pending evidence readiness without inventing geometry',()=>{
 const h=harness();seedExact(h);h.scope.pageDims=null;h.scope.pageFailed=true;h.effect();
 assert.deepEqual(h.updates.at(-1),{kind:'page',rects:[],ready:true});
 assert.equal(h.scope.measuredRef.current,null,'recovery must republish even if geometry matches the last successful render');
});

let errorBody;
(function visit(node) {
 if (ts.isVariableDeclaration(node) && node.name.getText(source)==='onTextFailed') errorBody=node.initializer.arguments[0].body.getText(source);
 ts.forEachChild(node,visit);
})(source);
test('expected PDF text-render cancellation is not a source failure',()=>{
 const failures=[];
 const invoke=Function('error','setTextFailed',errorBody.slice(1,-1));
 invoke({name:'AbortException'},value=>failures.push(value));
 assert.deepEqual(failures,[]);
 invoke(new Error('Text extraction failed'),value=>failures.push(value));
 assert.deepEqual(failures,[true]);
});
