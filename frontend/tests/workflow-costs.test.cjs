const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const filename=path.resolve(__dirname,'../src/components/WorkflowCost.tsx');
const loaded=new Module(filename,module);
loaded.paths=Module._nodeModulePaths(path.dirname(filename));
const original=loaded.require.bind(loaded);
loaded.require=name=>name==='../i18n'?{useLocale:()=>({t:(key,values)=>`${key} ${JSON.stringify(values||{})}`})}:original(name);
loaded._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},fileName:filename,
}).outputText,filename);
const render=(name,props)=>renderToStaticMarkup(React.createElement(loaded.exports[name],props));
test('running reservations are not presented as settled charges',()=>{
  const html=render('WorkflowCostSummary',{status:'running',preDebited:30,cost:0});
  assert.match(html,/workflowCost.working/);assert.doesNotMatch(html,/workflowCost.actual/);
});
test('settlement displays exact refund or additional charge without treating estimate as a cap',()=>{
  const refunded=render('WorkflowCostSummary',{status:'succeeded',preDebited:30,cost:2});
  assert.match(refunded,/workflowCost.returned.*28/);assert.match(refunded,/workflowCost.actual.*2/);
  const additional=render('WorkflowCostSummary',{status:'succeeded',preDebited:15,cost:20});
  assert.match(additional,/workflowCost.additional.*5/);assert.doesNotMatch(additional,/workflowCost.returned/);
});
test('legacy result without a recorded reservation never invents a refund',()=>{
  const html=render('WorkflowCostSummary',{status:'succeeded',cost:2});
  assert.match(html,/workflowCost.actual/);assert.doesNotMatch(html,/returned|additional/);
});
test('failed estimate does not show a zero-cost promise, and quote empty-result charging is disclosed',()=>{
  const failed=render('WorkflowCostEstimate',{failed:true,retry(){}});
  assert.match(failed,/workflowCost.unavailable/);assert.doesNotMatch(failed,/workflowCost.estimate/);
  const ready=render('WorkflowCostEstimate',{amount:15,balance:100,failed:false,retry(){},quoteSearch:true});
  assert.match(ready,/workflowCost.quoteEmpty/);assert.match(ready,/workflowCost.failureRule/);
});
