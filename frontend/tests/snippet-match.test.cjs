const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/lib/snippetMatch.ts');
const loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { findSnippetInPage } = loaded.exports;

const PAGE = 'Electricity for the valley comes from three run-of-river turbines on the Selka River. '
  + 'The turbines produce about 900 kilowatts at peak flow in May. Power lines run on wooden poles '
  + 'along the valley road and are trimmed clear of branches each August.';
const at = (needle) => PAGE.indexOf(needle);

test('a snippet that is the chunk text matches where the passage starts', () => {
  const snippet = 'Power lines run on wooden poles along the valley road and are trimmed clear of branches each Augu';
  assert.deepEqual(findSnippetInPage(PAGE, snippet), [at('Power lines'), snippet.length]);
});

test('a stored legacy "{section_title}: " snippet still matches the passage, not the title', () => {
  const match = findSnippetInPage(PAGE, 'Power Grid: Power lines run on wooden poles along the valley road and are trimmed clear of b');
  assert.equal(match[0], at('Power lines'));
});

test('a legacy section title that itself contains ": " is skipped too', () => {
  const match = findSnippetInPage(PAGE, 'Chapter 4: Power Grid: The turbines produce about 900 kilowatts at peak flow in May.');
  assert.equal(match[0], at('The turbines produce'));
});

test('a snippet whose own text contains ": " matches whole when the page has it', () => {
  const page = 'Intro. Note: payment is due within sixty days of the invoice date. Payment is due within sixty days of the invoice date.';
  const match = findSnippetInPage(page, 'Note: payment is due within sixty days of the invoice date.');
  assert.deepEqual(match, [page.indexOf('Note:'), 'Note: payment is due within sixty days of the invoice date.'.length]);
});

test('a short text after a ": " never stands in for a snippet that missed', () => {
  // The snippet misses on the line break after "If the Buyer"; its own tail
  // "see Schedule 4." must not jump to the unrelated first line instead.
  const page = 'Late fees: see Schedule 4.\n\nRemedies\nIf the Buyer\nfails to pay, the Seller may suspend delivery. Late fees: see Schedule 4.';
  assert.equal(findSnippetInPage(page, 'If the Buyer fails to pay, the Seller may suspend delivery. Late fees: see Schedule 4.'), null);
  assert.equal(findSnippetInPage(page, 'Remedies: If the Buyer fails to pay, the Seller may suspend delivery. Late fees: see Schedule 4.'), null);
});

test('the old " — " title separator is still understood', () => {
  const match = findSnippetInPage(PAGE, 'Power Grid — The turbines produce about 900 kilowatts at peak flow in May.');
  assert.equal(match[0], at('The turbines produce'));
});

test('no match, empty input and too-short remainders return null', () => {
  assert.equal(findSnippetInPage(PAGE, 'Water Supply: The northern reservoir holds 4.2 million litres.'), null);
  assert.equal(findSnippetInPage(PAGE, ''), null);
  assert.equal(findSnippetInPage('', 'Power lines run on wooden poles'), null);
  assert.equal(findSnippetInPage(PAGE, 'A very long section heading: May.'), null);
});
