const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/lib/pdfEvidence.ts');
const loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { findEvidenceRange, mergeEvidenceLines, groupEvidenceRegions, groupEvidenceMargins } = loaded.exports;
const box = (x=.1,y=.1,w=.7,h=.02)=>({x,y,w,h});
const run = (text,x=.1,y=.1,w=.7)=>({text,box:box(x,y,w)});

test('whole evidence is required; of and pos cannot stand in for the requested sentence',()=>{
 assert.equal(findEvidenceRange([run('of'),run('pos',.1,.15)],'The encoder is composed of a stack of N = 6 identical layers.',[]),null);
});
test('full quote spanning lines maps back to the exact original character offsets',()=>{
 const result=findEvidenceRange([run('Encoder: The encoder has six'),run('identical layers. More context.',.1,.13)],'The encoder has six identical layers.',[]);
 assert.deepEqual(result,{start:{run:0,offset:9},end:{run:1,offset:17}});
});
test('typographic ligatures map all expanded characters back to the original glyph',()=>{
 assert.deepEqual(findEvidenceRange([run('An efﬁcient model.')],'efficient',[]),{start:{run:0,offset:3},end:{run:0,offset:11}});
});
test('explicit line-end hyphenation is joined without deleting meaningful in-line hyphens',()=>{
 assert.ok(findEvidenceRange([run('A position-'),run('wise network.',.1,.13)],'A positionwise network.',[]));
 assert.equal(findEvidenceRange([run('A self-attention layer.')],'A selfattention layer.',[]),null);
});
test('whitespace normalization does not join different words or accept embedded substrings',()=>{
 assert.equal(findEvidenceRange([run('the rapist')],'therapist',[]),null);
 assert.equal(findEvidenceRange([run('position')],'pos',[]),null);
 assert.equal(findEvidenceRange([run('interest rates 10.81')],'interest rates 1081',[]),null);
});
test('repeated passages are ambiguous, except when only one is inside the cited region',()=>{
 const runs=[run('The model has six layers.'),run('The model has six layers.',.1,.6)];
 assert.equal(findEvidenceRange(runs,'The model has six layers.',[]),null);
 assert.equal(findEvidenceRange(runs,'The model has six layers.',[box(.1,.59,.7,.05)]).start.run,1);
});
test('a quote outside the cited region cannot become a precise highlight',()=>{
 assert.equal(findEvidenceRange([run('Exact source.',.1,.7)],'Exact source.',[box(.1,.1,.7,.2)]),null);
});
test('changed numbers, punctuation or incomplete cross-page quotes do not match',()=>{
 assert.equal(findEvidenceRange([run('The model trained for 3.5 days.')],'The model trained for 3.8 days.',[]),null);
 assert.equal(findEvidenceRange([run('Only the first half')],'Only the first half and the second half.',[]),null);
});
test('CJK, Arabic and surrogate-pair offsets remain usable',()=>{
 assert.ok(findEvidenceRange([run('模型由六层组成。')],'模型由六层组成。',[]));
 assert.ok(findEvidenceRange([run('يتكون النموذج من ست طبقات.')],'يتكون النموذج من ست طبقات.',[]));
 assert.deepEqual(findEvidenceRange([run('🧪 Six layers.')],'Six layers.',[]),{start:{run:0,offset:3},end:{run:0,offset:14}});
});
test('separate RTL word runs preserve geometric word spacing',()=>{
 assert.deepEqual(findEvidenceRange([run('يتكون',.7,.1,.1),run('النموذج',.55,.1,.13)],'يتكون النموذج',[]),
   {start:{run:0,offset:0},end:{run:1,offset:7}});
});
test('line rectangles merge adjacent fragments and duplicates, without crossing columns',()=>{
 const lines=mergeEvidenceLines([box(.1,.2,.15),box(.1,.2,.15),box(.25,.2,.15),box(.6,.2,.2),box(.1,.25,.3)]);
 assert.equal(lines.length,3);assert.ok(Math.abs(lines[0].w-.3)<.0001);
});
test('fallback produces grouped margin ranges, rejecting dummy and malformed boxes',()=>{
 const groups=groupEvidenceRegions([box(.1,.1,.6),box(.1,.13,.6),box(.1,.6,.6),box(0,0,1,1),box(NaN,.1,.5),box(.9,.1,.3)]);
 assert.equal(groups.length,2);assert.ok(Math.abs(groups[0].h-.05)<.0001);
});
test('coarse table markers join at the outer margin, without broadening match regions',()=>{
 const regions=[box(.1,.2,.3,.3),box(.5,.2,.1,.3),box(.7,.2,.1,.3),box(.1,.8,.5,.02)];
 const before=structuredClone(regions);
 const margins=groupEvidenceMargins(regions);
 assert.equal(margins.length,2);assert.equal(margins[0].x,.1);
 assert.ok(Math.abs(margins[0].w-.7)<.0001);
 assert.deepEqual(regions,before);
 assert.equal(findEvidenceRange([run('Uncited gap.',.42,.3,.03)],'Uncited gap.',regions),null);
});
