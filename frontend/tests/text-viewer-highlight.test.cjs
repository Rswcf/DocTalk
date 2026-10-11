const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('./_load-ts.cjs');

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

// ---- rehypeMarkRanges through the real react-markdown pipeline -------------
const { rehypeMarkRanges } = require(path.join(SRC, 'lib/rehypeMarkRanges.ts'));
const { locateTextEvidence } = require(path.join(SRC, 'lib/textEvidence.ts'));
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

let Markdown, remarkGfm;
test.before(async () => {
  Markdown = (await import('react-markdown')).default;
  remarkGfm = (await import('remark-gfm')).default;
});

function render(source, ranges, components) {
  const rehypePlugins = ranges ? [[rehypeMarkRanges, { ranges, source }]] : [];
  return renderToStaticMarkup(React.createElement(Markdown, { remarkPlugins: [remarkGfm], rehypePlugins, components }, source));
}
const marks = (html) => [...html.matchAll(/<mark data-dt-evidence="(\w+)"( data-dt-evidence-anchor="true")?>([\s\S]*?)<\/mark>/g)]
  .map(([, kind, anchor, text]) => ({ kind, anchor: Boolean(anchor), text }));
const span = (source, text, kind = 'region', anchor) => {
  const start = source.indexOf(text);
  assert.ok(start >= 0, `fixture contains ${text}`);
  return { start, end: start + text.length, kind, anchor };
};

test('marks land on GFM table cells, never on the pipes', () => {
  const source = 'Intro paragraph.\n\n| Item | Amount |\n| --- | --- |\n| Research | 4.2 million |\n| Travel | 0.3 million |';
  const html = render(source, [span(source, '| Research | 4.2 million |')]);
  assert.deepEqual(marks(html).map(m => m.text), ['Research', '4.2 million']);
  assert.match(html, /<td><mark data-dt-evidence="region">Research<\/mark><\/td>/);
  assert.ok(!marks(html).some(m => m.text.includes('|')));
});

test('escapes, entities and indented continuation lines map onto rendered text', () => {
  const source = 'Prices &amp; fees \\*apply\\* now.\n   Second line of the same paragraph.';
  const html = render(source, [{ start: 0, end: source.length, kind: 'region' }]);
  assert.deepEqual(marks(html).map(m => m.text), ['Prices &amp; fees *apply* now.\nSecond line of the same paragraph.']);
  const partial = render(source, [span(source, 'fees \\*apply\\*')]);
  assert.deepEqual(marks(partial).map(m => m.text), ['fees *apply*']);
});

test('inline code keeps its backticks out of the mark; fenced code maps after its fence line', () => {
  const source = 'Run `npm test` before you push.\n\n```\nnpm run build\n```';
  const html = render(source, [{ start: 0, end: source.length, kind: 'region' }]);
  assert.match(html, /<code><mark data-dt-evidence="region">npm test<\/mark><\/code>/);
  assert.match(html, /<pre><code><mark data-dt-evidence="region">npm run build\n<\/mark><\/code><\/pre>/);
  // Only the covered lines of a block, never the fence or the info string.
  const block = 'Intro.\n\n```mermaid\nsequenceDiagram\n  A->>B: first call\n  B-->>A: reply\n```';
  const partial = render(block, [span(block, 'A->>B: first call', 'exact', true)]);
  assert.deepEqual(marks(partial), [{ kind: 'exact', anchor: true, text: 'A-&gt;&gt;B: first call' }]);
  assert.doesNotMatch(partial, /<mark[^>]*>[^<]*mermaid/);
});

test('a code block is marked only where the range covers it', () => {
  const source = '```\nalpha beta gamma\n```';
  assert.deepEqual(marks(render(source, [span(source, 'beta')])).map(m => m.text), ['beta']);
  const indented = '- item\n\n  ```\n  one two\n  three four\n  ```';
  assert.deepEqual(marks(render(indented, [span(indented, 'three four')])).map(m => m.text), ['three four']);
  const fenceOnly = render('```\nalpha\n```\n\nZeta.', [{ start: 0, end: 3, kind: 'region' }]);
  assert.deepEqual(marks(fenceOnly), [], 'the fence line alone marks nothing');
});

test('the anchor moves to the first mark when its own range renders none', () => {
  const source = 'Kept paragraph text here.\n\n<div>raw html is dropped</div>';
  const html = render(source, [
    span(source, 'Kept paragraph text here.'),
    span(source, 'raw html is dropped', 'exact', true),
  ]);
  assert.deepEqual(marks(html), [{ kind: 'region', anchor: true, text: 'Kept paragraph text here.' }]);
});

test('exact emphasis splits a region into flat marks; only one anchor is emitted', () => {
  const source = 'First sentence here. The key claim is this one. Last sentence there.';
  const html = render(source, [
    span(source, 'First sentence here.'),
    span(source, 'The key claim is this one.', 'exact', true),
    span(source, 'Last sentence there.'),
  ]);
  assert.deepEqual(marks(html), [
    { kind: 'region', anchor: false, text: 'First sentence here.' },
    { kind: 'exact', anchor: true, text: 'The key claim is this one.' },
    { kind: 'region', anchor: false, text: 'Last sentence there.' },
  ]);
  assert.doesNotMatch(html, /<mark[^>]*><mark/, 'marks are never nested');
});

test('a range across paragraphs, lists and emphasis marks each text node it covers', () => {
  const source = 'One **bold** claim.\n\n- item alpha\n- item beta';
  const html = render(source, [{ start: 0, end: source.length, kind: 'region' }]);
  assert.deepEqual(marks(html).map(m => m.text), ['One ', 'bold', ' claim.', 'item alpha', 'item beta']);
});

test('no ranges renders exactly the plain Markdown', () => {
  const source = '# Title\n\nBody with a [link](https://example.com).';
  assert.equal(render(source, []), render(source, null));
});

test('a custom mark component receives the evidence attributes', () => {
  const source = 'Anchor me here please.';
  let seen;
  const components = { mark: (props) => { seen = props; return React.createElement('mark', props); } };
  render(source, [{ start: 0, end: source.length, kind: 'exact', anchor: true }], components);
  assert.equal(seen['data-dt-evidence'], 'exact');
  assert.equal(seen['data-dt-evidence-anchor'], 'true');
});

test('end to end: a DOCX chunk with a glued title highlights its table cells', () => {
  const page = 'The committee reviewed the budget in March.\n\n| Item | Amount |\n| --- | --- |\n| Research | 4.2 million |\n\nThe chair asked for a revised forecast.';
  const chunk = 'Budget Review The committee reviewed the budget in March. | Item | Amount |\n| --- | --- |\n| Research | 4.2 million |\n\nThe chair asked for a revised forecast.';
  const evidence = locateTextEvidence([{ page_number: 1, text: page }], { page: 1, pageEnd: 1 }, chunk, 'The chair asked for a revised forecast.');
  assert.equal(evidence.kind, 'exact');
  const ranges = evidence.ranges.map(r => ({ start: r.start, end: r.end, kind: r.emphasis ? 'exact' : 'region', anchor: r.start === evidence.anchor.start }));
  const html = render(page, ranges);
  assert.deepEqual(marks(html).map(m => `${m.kind}:${m.text}`), [
    'region:The committee reviewed the budget in March.', 'region:Item', 'region:Amount', 'region:Research', 'region:4.2 million',
    'exact:The chair asked for a revised forecast.',
  ]);
});

// ---- TextViewer: status line, caption fallback, scroll, rendering cost ----
const VIEWER = 'components/TextViewer/TextViewer.tsx';

test('the text view has a focusable evidence status line for the mobile focus hook', () => {
  const code = stripComments(read(VIEWER));
  assert.match(code, /<span role="status" className="dt-evidence-status min-w-0" tabIndex=\{-1\}>/);
  assert.match(code, /t\('evidence\.reference', \{ index: markdownCitation\.refIndex, page: citationPageRange\(markdownCitation\) \}\)/);
  assert.match(code, /`evidence\.\$\{evidenceStatus\}`/);
  // The reader focuses the first .dt-evidence-status after a mobile citation tap.
  assert.match(stripComments(read(READER)), /document\.querySelector<HTMLElement>\('\.dt-evidence-status'\)\?\.focus/);
});

test('every evidence status the text view can show has a key in all 11 locales', () => {
  const statuses = ['loading', 'exact', 'region', 'page', 'unavailable', 'hidden', 'hide', 'show', 'return', 'reference'];
  const dir = path.join(SRC, 'i18n/locales');
  const files = fs.readdirSync(dir).filter(name => name.endsWith('.json'));
  assert.equal(files.length, 11);
  for (const file of files) {
    const messages = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    for (const status of statuses) assert.ok(messages[`evidence.${status}`], `${file} has evidence.${status}`);
  }
});

test('the page caption is the fallback only when no passage was located', () => {
  const code = stripComments(read(VIEWER));
  assert.match(code, /const captionPage = markdownCitation && evidenceStatus === 'page' \? markdownCitation\.page : null;/);
  assert.match(code, /\{captionPage != null && \(/);
  // Plain text keeps matching the backend snippet; Markdown never uses it.
  assert.match(code, /if \(isMarkdown \|\| !highlightSnippet \|\| !targetPage\) return null;/);
});

test('the anchor mark scrolls once per navigation; the page start stays the immediate fallback', () => {
  const code = stripComments(read(VIEWER));
  assert.match(code, /pendingAnchor\.current = active;/);
  assert.match(code, /if \(active && pendingAnchor\.current !== active\) return;/);
  assert.match(code, /if \(!element \|\| !currentEvidence \|\| pendingAnchor\.current !== currentEvidence\.citation\) return;/);
  for (const handler of ['onWheelCapture', 'onPointerDownCapture', 'onKeyDownCapture']) {
    assert.match(code, new RegExp(`${handler}=\\{cancelPendingAnchor\\}`), `${handler} cancels a late scroll`);
  }
  assert.match(code, /mark: EvidenceMark/);
});

test('a late chunk fetch for an earlier citation is dropped', () => {
  const code = stripComments(read(VIEWER));
  const effect = code.slice(code.indexOf('const settle = (chunkText'), code.indexOf('}, [markdownCitation, highlightFocus, pages]);'));
  assert.match(effect, /let cancelled = false;/);
  assert.match(effect, /if \(cancelled\) return;/);
  assert.match(effect, /return \(\) => \{ cancelled = true; \};/);
  assert.match(code, /const currentEvidence = evidence && evidence\.citation === markdownCitation \? evidence : null;/);
});

test('Markdown pages are memoized with stable plugin lists', () => {
  const code = stripComments(read(VIEWER));
  assert.match(code, /const MarkdownContent = React\.memo\(function MarkdownContent/);
  assert.match(code, /const REMARK_PLUGINS: PluggableList = \[remarkGfm\];/);
  assert.match(code, /markRanges\.length \? \[\[rehypeMarkRanges, \{ ranges: markRanges, source: text \}\]\] : NO_REHYPE_PLUGINS/);
  assert.match(code, /markRanges=\{evidenceByPage\.get\(page\.page_number\) \|\| NO_MARKS\}/);
  assert.match(code, /markRanges=\{bodyMarks\.get\(page\.page_number\) \|\| NO_MARKS\}/);
  assert.doesNotMatch(code, /remarkPlugins=\{\[remarkGfm\]\}/);
});

test('evidence marks use highlight tokens and respect reduced motion', () => {
  const css = read('app/globals.css');
  const block = css.slice(css.indexOf('mark[data-dt-evidence] {'), css.indexOf('@media (prefers-reduced-motion: reduce) { mark[data-dt-evidence]'));
  assert.match(block, /var\(--highlight-base\)/);
  assert.match(block, /var\(--highlight-strong\)/);
  assert.doesNotMatch(block, /transition:\s*all|#[0-9a-f]{3,6}/i, 'no transition-all, no hard-coded colours');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ mark\[data-dt-evidence\] \{ transition: none; \} \}/);
  assert.doesNotMatch(stripComments(read(VIEWER)), /transition-all/);
});
