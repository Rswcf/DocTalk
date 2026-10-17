const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const { renderToStaticMarkup } = require('react-dom/server');
const React = require('react');
function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: filename,
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = name => Object.hasOwn(mocks, name) ? mocks[name] : original(name);
  loaded._compile(compiled, filename);
  return loaded.exports;
}
const api = load('lib/api.ts');
const { chatStream } = load('lib/sse.ts', { './api': api });
const { default: CitationCard } = load('components/Chat/CitationCard.tsx', {
  '../../lib/citationText': load('lib/citationText.ts'),
  '../../i18n': { useLocale: () => ({ t: (key, values) => `${key} ${JSON.stringify(values)}` }) },
});
const focus = 'This document does not state the company founding year.';
const payload = { ref_index: 1, chunk_id: 'chunk', page: 3, page_end: 3, text_snippet: focus, focus_snippet: focus, bboxes: [], offset: 6 };
test('initial stream, refined stream and restored API preserve projected excerpt and page in the actual card', async () => {
  const original = global.fetch;
  global.fetch = async () => new Response([
    `event: citation\ndata: ${JSON.stringify(payload)}\n\n`,
    `event: citations_refined\ndata: ${JSON.stringify({ citations: [payload] })}\n\n`,
    'event: done\ndata: {"message_id":"answer"}\n\n',
  ].join(''), { headers: { 'content-type': 'text/event-stream' } });
  try {
    const observed = [api.mapCitationPayload(payload)];
    await chatStream('session', 'question', () => {}, c => observed.push(c), e => { throw e; }, () => {}, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, cs => observed.push(...cs));
    assert.equal(observed.length, 3);
    for (const citation of observed) {
      assert.equal(citation.page, 3); assert.equal(citation.pageEnd, 3);
      assert.equal(citation.textSnippet, focus);
      const html = renderToStaticMarkup(React.createElement(CitationCard, citation));
      assert.ok(html.includes(focus)); assert.ok(!html.includes('Revenue'));
      assert.ok(html.includes('3'));
    }
  } finally { global.fetch = original; }
});
