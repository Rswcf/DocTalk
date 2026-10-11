const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.resolve(__dirname, '../src');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');
const stripComments = (code) => code.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const READER = 'app/d/[documentId]/DocumentReaderPageClient.tsx';

// ---- Reader wiring ---------------------------------------------------------

test('both text-view sites receive the focus sentence and the citation', () => {
  const code = stripComments(read(READER));
  const viewers = code.match(/<TextViewer [^>]*\/>/g) || [];
  assert.equal(viewers.length, 2, 'missing-file and non-PDF text views');
  for (const viewer of viewers) {
    assert.match(viewer, /highlightFocus=\{highlightFocus\}/);
    assert.match(viewer, /citation=\{activeCitation\}/);
    // TXT and missing-file PDFs keep matching the backend's own snippet.
    assert.match(viewer, /highlightSnippet=\{highlightSnippet\}/);
  }
});

test('synthetic boxes are set only for the converted DOCX/PPTX viewer', () => {
  const code = stripComments(read(READER));
  const viewers = code.match(/<PdfViewer[\s\S]*?\/>/g) || [];
  assert.equal(viewers.length, 2, 'native and converted PDF viewers');
  const [native, converted] = viewers;
  assert.match(native, /highlights=\{pdfPreviewMode === 'translated' \? \[\] : highlights\}/);
  assert.match(native, /highlightSnippet=\{pdfPreviewMode === 'translated' \? null : highlightSnippet\}/);
  assert.doesNotMatch(native, /syntheticBoxes/, 'the native PDF path is unchanged');
  assert.match(converted, /pdfUrl=\{convertedPdfUrl\}/);
  assert.match(converted, /syntheticBoxes=\{fileType !== 'pdf'\}/);
  assert.match(converted, /highlightSnippet=\{activeCitationPassage\}/);
});

test('synthetic boxes reach the page as no region and a text-layer candidate', () => {
  const viewer = stripComments(read('components/PdfViewer/PdfViewer.tsx'));
  assert.match(viewer, /const highlights = syntheticBoxes \? NO_BOXES : boxHighlights;/);
  const page = stripComments(read('components/PdfViewer/PageWithHighlights.tsx'));
  const candidate = page.slice(page.indexOf('const candidate ='), page.indexOf(';', page.indexOf('const candidate =')) + 1);
  assert.match(candidate, /syntheticBoxes\s*\?\s*highlightFocus \|\| highlightSnippet \|\| null/);
  // The native PDF expression is kept verbatim on the other branch.
  assert.match(candidate, /: highlightFocus \|\| \(highlights\.some\(box => box\.x === 0 && box\.y === 0 && box\.w === 1 && box\.h === 1\) \? highlightSnippet : null\)/);
});
