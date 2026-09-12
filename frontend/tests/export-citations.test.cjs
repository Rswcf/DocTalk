const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');

function load(relativePath, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', relativePath);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const realRequire = loaded.require.bind(loaded);
  loaded.require = (request) => Object.hasOwn(mocks, request) ? mocks[request] : realRequire(request);
  loaded._compile(compiled, filename);
  return loaded.exports;
}

const citationText = load('lib/citationText.ts');
const { mapCitationPayload } = load('lib/api.ts');
const { renumberCitations } = load('lib/citations.ts');
const { renderConversationAsMarkdown, exportConversationAsMarkdown } = load('lib/export.ts', {
  './citationText': citationText, './utils': { sanitizeFilename: (value) => value },
});
const cases = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../backend/tests/fixtures/export_citations.json'), 'utf8'));
function mapMessages(item) {
  return item.messages.map((message) => ({
    role: message.role, text: message.content,
    citations: renumberCitations(message.citations.map(mapCitationPayload)),
  }));
}

for (const item of cases) {
  test(item.name, () => {
    const messages = mapMessages(item);
    const snapshot = JSON.stringify(messages);
    const md = renderConversationAsMarkdown(messages, 'Citation QA');
    for (const answer of item.answers) assert.ok(md.includes(answer), answer);
    const refs = [...md.matchAll(/^\[\^(\d+)\]: (.*)$/gm)];
    assert.deepEqual(refs.map((match) => Number(match[1])), item.sources.map((_, i) => i + 1));
    item.sources.forEach((source, i) => assert.ok(refs[i][2].includes(source)));
    assert.equal(JSON.stringify(messages), snapshot);
  });
}

test('reader/copy marker insertion preserves Unicode and same-offset order', () => {
  assert.equal(citationText.insertCitationMarkers('😀预算。 More', [
    { refIndex: 2, offset: 4 }, { refIndex: 1, offset: 4 },
  ]), '😀预算。[2][1] More');
});

test('same local ID at the same offset retains distinct clickable sources', () => {
  const citations = [
    { refIndex: 1, offset: 5, chunkId: 'a', page: 1 },
    { refIndex: 1, offset: 5, chunkId: 'b', page: 2 },
    { refIndex: 1, offset: 5, chunkId: 'b', page: 2 },
  ];
  const display = citationText.uniqueCitationIndexes(citations);
  assert.deepEqual(display.map((c) => c.refIndex), [1, 2, 2]);
  assert.equal(citationText.insertCitationMarkers('Both.', display), 'Both.[1][2]');
  assert.equal(display.find((c) => c.refIndex === 2).chunkId, 'b');
  assert.deepEqual(citations.map((c) => c.refIndex), [1, 1, 1]);
});

test('continued structured citations reserve legacy indexes for the original source', () => {
  const display = citationText.uniqueCitationIndexes([
    { refIndex: 1, chunkId: 'old', page: 1 },
    { refIndex: 1, chunkId: 'new', page: 2, offset: 12 },
  ]);
  assert.deepEqual(display.map((c) => c.refIndex), [1, 2]);
  assert.equal(citationText.insertCitationMarkers('Old.[1] New.', display), 'Old.[1] New.[2]');
  assert.equal(display.find((c) => c.refIndex === 2).chunkId, 'new');
});

test('actual download receives reconstructed Markdown in its Blob', async () => {
  const previous = { document: global.document, create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  let blob;
  let clicked = false;
  const anchor = { click: () => { clicked = true; } };
  try {
    global.document = { createElement: () => anchor, body: { appendChild() {}, removeChild() {} } };
    URL.createObjectURL = (value) => { blob = value; return 'blob:qa'; };
    URL.revokeObjectURL = () => {};
    exportConversationAsMarkdown(mapMessages(cases[0]), 'Citation QA');
    assert.equal(clicked, true);
    assert.ok(anchor.download.endsWith('.md'));
    const text = await blob.text();
    assert.ok(text.includes('A 42.[^1]') && text.includes('B 84.[^2]'));
    assert.ok(text.includes('alpha.pdf') && text.includes('beta.pdf'));
  } finally {
    global.document = previous.document;
    URL.createObjectURL = previous.create;
    URL.revokeObjectURL = previous.revoke;
  }
});

test('page ranges survive presentation and same-chunk citations on different pages', () => {
  assert.equal(citationText.citationPageRange({page: 4, pageEnd: 6}), '4–6');
  assert.equal(citationText.citationPageRange({page: 4, pageEnd: 4}), '4');
  assert.equal(citationText.citationPageRange({page: 4, pageEnd: 2}), '4');
  const a = {refIndex: 1, chunkId: 'cross-page', page: 4, pageEnd: 4};
  const b = {...a, page: 5, pageEnd: 5};
  assert.notEqual(citationText.citationSourceKey(a), citationText.citationSourceKey(b));
});
test('reader bottom cards and inline sources keep distinct locations with stable numbering', () => {
  const raw = [{refIndex: 2, chunkId:'one', page:5, pageEnd:6, offset:10}, {refIndex:2,chunkId:'one',page:5,pageEnd:5,offset:20}];
  const display = citationText.uniqueCitationIndexes(renumberCitations(raw));
  assert.deepEqual(display.map(c=>c.refIndex), [1,2]);
  assert.deepEqual(citationText.uniqueCitationIndexes(display), display);
});
