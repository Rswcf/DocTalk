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
const i18n = { useLocale: () => ({ t: (key, values) => `${key} ${JSON.stringify(values)}`, tOr: (_key, fallback, values = {}) => fallback.replace(/\{(\w+)\}/g, (m, k) => (k in values ? String(values[k]) : m)) }) };
const sourceList = load('lib/sourceList.ts');
let storeState = { documentName: 'Report.pdf', citationTarget: null };
const { default: SourcesStrip } = load('components/Chat/SourcesStrip.tsx', {
  '../../lib/citationText': load('lib/citationText.ts'),
  '../../lib/sourceList': sourceList,
  '../../i18n': i18n,
  '../../store': { useDocTalkStore: (select) => select(storeState) },
  './SourceListToggle': load('components/Chat/SourceListToggle.tsx', { '../../i18n': i18n, '../../lib/sourceList': sourceList }),
});
const strip = (citations, props = {}) => renderToStaticMarkup(React.createElement(SourcesStrip, { citations, ...props }));
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
      const html = strip([citation]);
      assert.ok(html.includes(focus)); assert.ok(!html.includes('Revenue'));
      assert.ok(html.includes('3'));
    }
  } finally { global.fetch = original; }
});

test('a cross-page source chip names the passage instead of rendering an empty excerpt', () => {
  const html = strip([{ refIndex: 9, chunkId: 'x', textSnippet: 'Spans two pages', page: 4, pageEnd: 5, bboxes: [] }]);
  assert.ok(html.includes('Cited passage'));
  assert.ok(!/text-\[1[01]px\]/.test(html), 'app UI renders nothing below 12px');
});

test('the source strip marks the citation the reader shows and keeps it visible when collapsed', () => {
  const citations = Array.from({ length: 15 }, (_, i) => ({ refIndex: i + 1, chunkId: `c${i}`, textSnippet: `Passage ${i + 1}.`, page: 2, pageEnd: 2, bboxes: [] }));
  storeState = { documentName: 'Report.pdf', citationTarget: { messageId: 'm1', citation: citations[11] } };
  try {
    const html = strip(citations, { messageId: 'm1' });
    assert.equal((html.match(/dt-source-chip/g) || []).length, 6);
    assert.match(html, /aria-current="location"[^>]*>[\s\S]*?Passage 12\./);
    assert.ok(html.includes('Show all 15 sources'));
    const other = strip(citations, { messageId: 'm2' });
    assert.equal((other.match(/dt-source-chip/g) || []).length, 5);
    assert.ok(!other.includes('aria-current'));
  } finally {
    storeState = { documentName: 'Report.pdf', citationTarget: null };
  }
});

test('each source chip is named by its visible text: number, excerpt, page (review 2026-11-23 F3)', () => {
  const citations = [1, 2].map((n) => ({ refIndex: n, chunkId: `k${n}`, textSnippet: `Distinct passage ${n}.`, page: 4, pageEnd: 4, bboxes: [] }));
  const html = strip(citations);
  assert.doesNotMatch(html, /dt-source-chip[^>]*aria-label=/, 'an aria-label would hide the number and the excerpt');
  for (const n of [1, 2]) {
    const chip = html.match(new RegExp(`<button[^>]*aria-describedby="([^"]+-jump-${n})"[^>]*>([\\s\\S]*?)</button>`));
    assert.ok(chip, `chip ${n} has no description`);
    assert.ok(chip[2].includes(`>${n}<`) && chip[2].includes(`Distinct passage ${n}.`));
    assert.match(html, new RegExp(`id="${chip[1]}"[^>]*>citation\\.jumpTo`));
  }
});
