const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// "Save quote" from the reader's evidence bar (plan .collab/plans/2026-09-22-next-strategy.md §2.1, §6):
// the retained cohort verifies by clicking citations, so the save lives where the click lands.
const filename = path.resolve(__dirname, '../src/lib/citationSave.ts');
const loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { saveCitationAsQuote, citedClaim, fallbackTopic } = loaded.exports;

const citation = (over = {}) => ({
  refIndex: 1,
  chunkId: 'c1',
  page: 4,
  bboxes: [],
  textSnippet: 'Chunk text about interest rates in the second half.',
  focusSnippet: 'Interest rates rose to 5.25% in July.',
  ...over,
});
const serverQuote = (over = {}) => ({
  id: 'q1', documentId: 'd1', page: 4, pageEnd: 4, quoteText: 'Interest rates rose to 5.25 % in July.', bboxes: [],
  tier: 'normalized', score: 97, verifierVersion: 'v1', sourceKind: 'extracted_text', note: null, createdAt: '', updatedAt: '',
  ...over,
});
const apiError = (status, code) => Object.assign(new Error(`HTTP ${status}`), { status, code, detail: {} });
function recorder(impl) {
  const fn = async (...args) => { fn.calls.push(args); return impl(...args); };
  fn.calls = [];
  return fn;
}
const cps = (text, until) => Array.from(text.slice(0, until)).length;

test('an anonymous reader is sent to sign in and nothing is saved', async () => {
  const save = recorder(() => serverQuote());
  assert.deepEqual(await saveCitationAsQuote(citation(), { isLoggedIn: false, documentId: 'd1', save }), { kind: 'signin' });
  assert.equal(save.calls.length, 0);
});

test('saving sends only the chunk, the supporting sentence, the page and where the save came from', async () => {
  const save = recorder(() => serverQuote());
  await saveCitationAsQuote(citation({ focusSnippet: '  Interest rates rose to 5.25% in July.  ' }), {
    isLoggedIn: true, documentId: 'd1', save, source: 'citation_popover',
  });
  assert.deepEqual(save.calls, [['d1', {
    chunkId: 'c1', quoteText: 'Interest rates rose to 5.25% in July.', pageHint: 4, source: 'citation_popover',
  }]]);
});

test('a citation from another document is saved to that document', async () => {
  const save = recorder(() => serverQuote());
  await saveCitationAsQuote(citation({ documentId: 'd2' }), { isLoggedIn: true, documentId: 'd1', save });
  assert.equal(save.calls[0][0], 'd2');
});

test('a saved outcome carries the server row and nothing from the client', async () => {
  const quote = serverQuote();
  const outcome = await saveCitationAsQuote(citation(), { isLoggedIn: true, documentId: 'd1', save: async () => quote });
  assert.deepEqual(Object.keys(outcome).sort(), ['kind', 'quote']);
  assert.equal(outcome.kind, 'saved');
  assert.equal(outcome.quote, quote);
});

test('no supporting sentence opens the panel on the cited claim without a save call', async () => {
  const save = recorder(() => serverQuote());
  const text = 'The report covers 2026. Rates rose to 5.25% in July. Costs fell.';
  const outcome = await saveCitationAsQuote(citation({ focusSnippet: undefined, offset: text.indexOf(' Costs') }), {
    isLoggedIn: true, documentId: 'd1', save, messageText: text,
  });
  assert.deepEqual(outcome, { kind: 'fallback', reason: 'no_snippet', topic: 'Rates rose to 5.25% in July.' });
  assert.equal(save.calls.length, 0);
});

test('a citation without a chunk cannot be saved and opens the panel instead', async () => {
  const save = recorder(() => serverQuote());
  const outcome = await saveCitationAsQuote(citation({ chunkId: '' }), { isLoggedIn: true, documentId: 'd1', save });
  assert.equal(outcome.kind, 'fallback');
  assert.equal(save.calls.length, 0);
});

test('a quote the server cannot verify opens the panel on the cited claim', async () => {
  const text = 'The report covers 2026. Rates rose to 5.25% in July. Costs fell.';
  const outcome = await saveCitationAsQuote(citation({ offset: text.indexOf(' Costs') }), {
    isLoggedIn: true, documentId: 'd1', messageText: text,
    save: async () => { throw apiError(422, 'QUOTE_NOT_VERIFIABLE'); },
  });
  assert.deepEqual(outcome, { kind: 'fallback', reason: 'not_verifiable', topic: 'Rates rose to 5.25% in July.' });
});

test('the save cap reads as a limit, not as an error', async () => {
  const outcome = await saveCitationAsQuote(citation(), {
    isLoggedIn: true, documentId: 'd1', save: async () => { throw apiError(403, 'SAVED_QUOTES_LIMIT_REACHED'); },
  });
  assert.deepEqual(outcome, { kind: 'limit' });
});

test('any other failure is an error that keeps the original error', async () => {
  const error = apiError(500, null);
  const outcome = await saveCitationAsQuote(citation(), { isLoggedIn: true, documentId: 'd1', save: async () => { throw error; } });
  assert.deepEqual(outcome, { kind: 'error', error });
});

test('the cited claim is the whole answer sentence around the marker offset', () => {
  const text = 'Revenue grew. Costs fell sharply while margins improved. Next year looks flat.';
  assert.equal(citedClaim(text, { refIndex: 1, offset: text.indexOf(' while') }), 'Costs fell sharply while margins improved.');
});

test('a marker right after the full stop cites the sentence that just ended', () => {
  const text = 'Revenue grew. Rates rose to 5.25% in July. Costs fell.';
  assert.equal(citedClaim(text, { refIndex: 1, offset: text.indexOf(' Costs') }), 'Rates rose to 5.25% in July.');
});

test('offsets count codepoints, so emoji before the marker do not shift it into another sentence', () => {
  // 25 astral characters: read as UTF-16 units, the offset would land 25 units early, inside the first sentence.
  const text = `Pics ${'😀'.repeat(25)} row. Rates rose sharply today. Done.`;
  assert.equal(citedClaim(text, { refIndex: 1, offset: cps(text, text.indexOf(' Done')) }), 'Rates rose sharply today.');
});

test('legacy citations without an offset find their textual [n] marker', () => {
  assert.equal(citedClaim('Intro text. Rates rose sharply [2] in July. End.', { refIndex: 2 }), 'Rates rose sharply in July.');
});

test('markers, list bullets and markdown emphasis are stripped from the claim', () => {
  const text = 'Summary:\n- **Rates** rose to 5% [1][3] in `July`.\n- Costs fell.';
  assert.equal(citedClaim(text, { refIndex: 1 }), 'Rates rose to 5% in July.');
});

test('CJK sentences split on full-width punctuation', () => {
  const text = '利率上升。七月利率达到百分之五点二五。成本下降。';
  assert.equal(citedClaim(text, { refIndex: 1, offset: cps(text, text.indexOf('成本')) }), '七月利率达到百分之五点二五。');
});

test('no usable claim gives null', () => {
  assert.equal(citedClaim('', { refIndex: 1, offset: 0 }), null);
  assert.equal(citedClaim('Short. [1]', { refIndex: 1 }), null);
  assert.equal(citedClaim('No marker here at all.', { refIndex: 4 }), null);
});

test('a claim longer than the 300-character topic limit is cut at a word boundary', () => {
  const text = `${'word '.repeat(90).trim()}.`;
  const claim = citedClaim(text, { refIndex: 1, offset: Array.from(text).length });
  assert.ok(claim.length <= 300, `length ${claim.length}`);
  assert.match(claim, /word$/);
});

test('the fallback topic prefers the claim, then the supporting sentence, then the chunk text', () => {
  const text = 'Rates rose in July again.';
  assert.equal(fallbackTopic(text, citation({ offset: Array.from(text).length })), 'Rates rose in July again.');
  assert.equal(fallbackTopic(undefined, citation()), 'Interest rates rose to 5.25% in July.');
  assert.equal(fallbackTopic(undefined, citation({ focusSnippet: undefined })), 'Chunk text about interest rates in the second half.');
});
