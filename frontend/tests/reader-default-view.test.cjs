const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('./_load-ts.cjs');

// Owner decision 2026-10-11: a DOCX opens in the text view (citations are
// located in the extractor's own pages there; the slide view's page N is a
// LibreOffice PDF page). PPTX keeps the slide view. The toggle still switches.

const { defaultReaderView, readerView } = require(path.resolve(__dirname, '../src/lib/readerView.ts'));
const READER = path.resolve(__dirname, '../src/app/d/[documentId]/DocumentReaderPageClient.tsx');
const stripComments = (code) => code.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('DOCX opens in the text view; PPTX and other types in the slide view', () => {
  assert.equal(defaultReaderView('docx'), 'text');
  assert.equal(defaultReaderView('DOCX'), 'text');
  assert.equal(defaultReaderView('pptx'), 'slide');
  assert.equal(defaultReaderView('pdf'), 'slide');
  assert.equal(defaultReaderView(undefined), 'slide');
});

test('the toggle choice holds for its own document only', () => {
  const choice = { documentId: 'a', view: 'slide' };
  assert.equal(readerView(choice, 'a', 'docx'), 'slide', 'the reader can still switch a DOCX to the slide view');
  assert.equal(readerView(choice, 'b', 'docx'), 'text', 'a slide choice on another document does not carry over');
  assert.equal(readerView({ documentId: 'a', view: 'text' }, 'b', 'pptx'), 'slide');
  assert.equal(readerView(null, 'a', 'docx'), 'text');
});

test('the reader derives its view from the document type, with no other initial view', () => {
  const code = stripComments(fs.readFileSync(READER, 'utf8'));
  assert.doesNotMatch(code, /useState<'slide' \| 'text'>/, 'no fixed initial view');
  assert.match(code, /const viewMode = readerView\(viewChoice, documentId, fileType\);/);
  // The only writes are the two toggle buttons.
  assert.deepEqual(code.match(/setViewMode\([^)]*\)/g), ["setViewMode('slide')", "setViewMode('text')"]);
  assert.deepEqual(code.match(/setViewChoice\(/g), ['setViewChoice(']);
  assert.match(code, /const useConvertedPdf = hasConvertedPdf && viewMode === 'slide' && convertedPdfUrl;/);
});
