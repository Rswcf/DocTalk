// Regression harness for actual PDF navigation control flow.
// Transpiles/extracts the actual PdfViewer useEffect; mocks only DOM and scheduling.
// This validates navigation control flow, not React lifecycle or browser geometry.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const ts = require(path.join(root, 'node_modules/typescript'));
const filename = path.join(root, 'src/components/PdfViewer/PdfViewer.tsx');
const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const source = ts.createSourceFile(filename, js, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const bodies = [];
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect'
      && node.arguments[0]?.getText(source).includes('const key =')) bodies.push(node.arguments[0].body.getText(source));
  ts.forEachChild(node, visit);
}
visit(source);
assert.equal(bodies.length, 1, 'locate exactly one navigation effect');
function harness(dimensions = [{}]) {
  let id = 0;
  const frames = new Map(), scrolls = [];
  const scope = {
    numPages: 2, currentPage: 1, scrollNonce: 1, scale: 1, citation: undefined,
    containerRef: { current: { clientHeight: 500, scrollTop: 0, scrollLeft: 0,
      getBoundingClientRect: () => ({ top: 0, left: 0, right: 600 }), scrollTo: (value) => scrolls.push(value) } },
    pageRefs: { current: [{ querySelector: () => null, getBoundingClientRect: () => ({ top: 100, height: 1000 }) }] },
    navigationRef: { current: null }, isScrollingToPage: { current: false },
    setVisibleRange() {}, setVisiblePage() {}, BUFFER: 3,
    highlights: [], pageDimensions: dimensions,
    requestAnimationFrame(fn) { frames.set(++id, fn); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    setTimeout: () => 1, clearTimeout() {}, scrollBehavior: () => 'auto',
  };
  const invoke = Function(...Object.keys(scope), bodies[0].slice(1, -1));
  let cleanup;
  return {
    scope, scrolls,
    effect() { cleanup?.(); cleanup = invoke(...Object.values(scope)); },
    frame() { const entry = frames.entries().next().value; if (entry) { frames.delete(entry[0]); entry[1](); } },
    drain() { while (frames.size) this.frame(); },
    cancelByInput() { scope.navigationRef.current.pending = false; },
    cleanup() { cleanup?.(); cleanup = undefined; },
  };
}
{
  const h = harness(); h.effect(); h.frame(); h.cancelByInput(); h.drain();
  assert.equal(h.scrolls.length, 0, 'input between the two frames cancels queued navigation'); h.cleanup();
}
{
  const h = harness(); h.effect(); h.drain(); assert.equal(h.scrolls.length, 1);
  assert.equal(h.scope.navigationRef.current.pending, false);
  h.scope.scale = 1.5; h.scope.highlights = []; h.effect(); h.drain();
  assert.equal(h.scrolls.length, 1, 'completed navigation does not replay on scale/new highlights');
  h.scope.scrollNonce++; h.effect(); h.drain();
  assert.equal(h.scrolls.length, 2, 'new explicit navigation still works'); h.cleanup();
}
{
  const h = harness([]); h.effect(); h.drain();
  assert.equal(h.scope.navigationRef.current.pending, true);
  h.scope.pageDimensions = [{}]; h.effect(); h.drain();
  assert.equal(h.scrolls.length, 2, 'pending navigation compensates once dimensions arrive');
  assert.equal(h.scope.navigationRef.current.pending, false); h.cleanup();
}
{
  const h = harness([]); h.effect(); h.drain(); h.cancelByInput();
  h.scope.pageDimensions = [{}]; h.effect(); h.drain();
  assert.equal(h.scrolls.length, 1, 'late dimensions do not override subsequent user input'); h.cleanup();
}
{
  const h = harness(); h.effect(); h.frame(); h.cleanup(); h.drain();
  assert.equal(h.scrolls.length, 0, 'effect cleanup cancels its queued frame');
}


let zoomBody;
function findZoom(node) {
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'useLayoutEffect'
      && node.arguments[0]?.getText(source).includes('zoomAnchorRef')) zoomBody = node.arguments[0].body.getText(source);
  ts.forEachChild(node, findZoom);
}
findZoom(source);
assert.ok(zoomBody);
const zoomScrolls = [];
const zoomRef = {current: {page: 7, ratio: 0.4}};
// Reader viewport center at 500; physical page 7 has changed height after zoom.
Function('zoomAnchorRef', 'containerRef', 'pageRefs', zoomBody.slice(1,-1))(
  zoomRef,
  {current: {scrollTop: 6000, clientHeight: 800, getBoundingClientRect:()=>({top:100}), scrollTo:v=>zoomScrolls.push(v)}},
  {current: Array.from({length:7},()=>({getBoundingClientRect:()=>({top:300,height:1250})}))},
);
assert.equal(zoomScrolls[0].top, 6300, 'preserve the same physical page and fractional position after zoom');
assert.equal(zoomRef.current, null);
// Observer notifications contain only changed entries. The toolbar still must
// reflect the most visible page among all pages, not just the notified subset.
let observerBody;
function findObserver(node) {
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect'
      && node.arguments[0]?.getText(source).includes('let maxHeight')) observerBody = node.arguments[0].body.getText(source);
  ts.forEachChild(node, findObserver);
}
findObserver(source);
let observed, selectedPage;
const observedStore = {currentPage:1,scrollNonce:9};
const observedNavigation = {current:{key:'1:9',pending:false}};
Function('numPages','containerRef','isScrollingToPage','pageRefs','setVisiblePage','IntersectionObserver','useDocTalkStore','navigationRef',observerBody.slice(1,-1))(
  2, {current:{getBoundingClientRect:()=>({top:100,bottom:900})}}, {current:false},
  {current:[{getBoundingClientRect:()=>({top:-500,bottom:250})},{getBoundingClientRect:()=>({top:270,bottom:1070})}]},
  page=>{selectedPage=page;}, class {constructor(callback){observed=callback;} observe(){} disconnect(){}},
  {getState:()=>observedStore,setState:update=>Object.assign(observedStore,update)}, observedNavigation,
);
observed([{target:'only previous page changed',intersectionRatio:0.2}]);
assert.equal(selectedPage,2);
assert.equal(observedStore.currentPage,2, 'manual position survives viewer remount');
assert.deepEqual(observedNavigation.current,{key:'2:9',pending:false}, 'manual observation never starts navigation');
observedStore.currentPage=1;
observedNavigation.current={key:'1:10',pending:true};
observed([]);
assert.equal(observedStore.currentPage,1, 'observation cannot override pending explicit navigation');

{
  const h = harness(); let ready = false;
  h.scope.citation = {page:1};
  h.scope.pageRefs.current[0].querySelector = selector => selector.includes('ready') ? (ready ? {} : null) : ready ? {getBoundingClientRect:()=>({top:340,left:50,right:400})} : null;
  h.effect();h.drain();assert.equal(h.scope.navigationRef.current.pending,true,'stage page while text renders');
  const staged=h.scrolls.length;h.effect();h.drain();assert.equal(h.scrolls.length,staged,'do not repeatedly jump while waiting');
  ready=true;h.effect();h.drain();assert.equal(h.scrolls.at(-1).top,180,'align measured first line with context above');
  assert.equal(h.scope.navigationRef.current.pending,false);h.cleanup();
}

{
 const h=harness();h.scope.currentPage=99;h.effect();h.drain();
 assert.equal(h.scope.navigationRef.current.pending,false,'unavailable pages cannot leave navigation pending forever');
 assert.equal(h.scrolls.length,0);
}
console.log('Navigation lifecycle, evidence readiness, zoom and observer regression scenarios passed; no browser/network/DB access.');
