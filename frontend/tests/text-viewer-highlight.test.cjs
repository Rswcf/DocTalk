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

// ---- Converted DOCX/PPTX: page N is LibreOffice's, not the extractor's -----
const { convertedPageIndex, uniqueInPageRange } = require(path.join(SRC, 'lib/convertedEvidence.ts'));

test('a converted-PDF candidate is kept only when unique in the whole document and on the cited page', () => {
  const sentence = 'All analyses followed the intention-to-treat principle.';
  const index = convertedPageIndex([
    `study design the trial enrolled 412 adults. ${sentence.toLowerCase()}`,
    'site enrolled completed northfield 88 81',
    `outcomes the primary outcome was blood pressure. ${sentence.toLowerCase()}`,
  ]);
  // Repeated in two sections: never trusted, whichever page is cited.
  assert.equal(uniqueInPageRange(index, 3, 3, sentence), false);
  assert.equal(uniqueInPageRange(index, 1, 1, sentence), false);
  // Unique, but on another page than the cited one (DOCX section 2 is not PDF page 2).
  assert.equal(uniqueInPageRange(index, 2, 2, 'The primary outcome was blood pressure.'), false);
  assert.equal(uniqueInPageRange(index, 3, 3, 'The primary outcome was blood pressure.'), true);
  assert.equal(uniqueInPageRange(index, 2, 3, 'The primary outcome was blood pressure.'), true);
  // A word the text layer splits ("enrol led") still counts once; nothing counts twice.
  assert.equal(uniqueInPageRange(convertedPageIndex(['the trial enrol led 412 adults']), 1, 1, 'The trial enrolled 412 adults'), true);
  assert.equal(uniqueInPageRange(index, 1, 3, null), false);
  assert.equal(uniqueInPageRange(index, 1, 3, '   '), false);
});

test('the converted viewer filters its text candidates; the native PDF viewer passes them through', () => {
  const viewer = stripComments(read('components/PdfViewer/PdfViewer.tsx'));
  assert.match(viewer, /if \(!syntheticBoxes\) return \{ highlightSnippet: snippetProp, highlightFocus: focusProp \};/);
  assert.match(viewer, /uniqueInPageRange\(convertedIndex, citation\.page, citation\.pageEnd \|\| citation\.page, text\)/);
  // The guard lives outside every effect body: the per-page props read the filtered names.
  assert.match(viewer, /\? highlightSnippet : null\}/);
  assert.match(viewer, /\? highlightFocus : null\}/);
  const memo = viewer.indexOf('const { highlightSnippet, highlightFocus } = useMemo(');
  assert.ok(memo > 0 && memo < viewer.indexOf('useEffect(() => {\n    if (!numPages'), 'declared before the navigation effects');
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

const LONG_REF = '&CounterClockwiseContourIntegral;'; // 33 source characters, renders as one

test('Codex r1 #3: a long character reference never widens a mark to its whole text node', () => {
  const source = `Before ${LONG_REF} after.`;
  const entity = render(source, [span(source, LONG_REF, 'exact', true)]);
  assert.deepEqual(marks(entity), [{ kind: 'exact', anchor: true, text: '∳' }]);
  assert.deepEqual(marks(render(source, [span(source, 'after.', 'exact')])).map(m => m.text), ['after.']);
  assert.deepEqual(marks(render(source, [{ start: 0, end: source.length, kind: 'region' }])).map(m => m.text), ['Before ∳ after.']);
});

test('an unalignable range that is ambiguous, or cut inside a reference, renders no mark', () => {
  const repeated = `aaa bbb ${LONG_REF} aaa bbb`;
  const second = repeated.lastIndexOf('aaa bbb');
  assert.deepEqual(marks(render(repeated, [{ start: second, end: second + 7, kind: 'exact', anchor: true }])), []);
  // "ContourIntegral;" first occurs inside the reference; its rendered twin
  // later in the node is a different passage.
  const cut = `Sign ${LONG_REF} then ContourIntegral; again.`;
  assert.deepEqual(marks(render(cut, [span(cut, 'ContourIntegral;', 'exact')])), []);
  assert.deepEqual(marks(render(cut, [span(cut, 'then ContourIntegral;', 'exact')])).map(m => m.text), ['then ContourIntegral;']);
});

test('Codex r2 #2: a range cut inside a reference or escape renders no mark, even when the node aligns', () => {
  const entity = 'Prices &amp; fees apply.';
  const at = entity.indexOf('&amp;');
  assert.deepEqual(marks(render(entity, [{ start: at, end: at + 2, kind: 'exact' }])), [], 'the range ends inside &amp;');
  assert.deepEqual(marks(render(entity, [{ start: at + 1, end: at + 10, kind: 'exact' }])), [], 'the range starts inside &amp;');
  assert.deepEqual(marks(render(entity, [{ start: at, end: at + 5, kind: 'exact' }])).map(m => m.text), ['&amp;']);
  const escape = 'Prices \\*apply\\* now.';
  const slash = escape.indexOf('\\*');
  assert.deepEqual(marks(render(escape, [{ start: slash + 1, end: slash + 2, kind: 'exact' }])), [], 'the range starts inside \\*');
  assert.deepEqual(marks(render(escape, [{ start: slash + 1, end: slash + 7, kind: 'exact' }])), [], 'the range starts inside \\*');
  assert.deepEqual(marks(render(escape, [{ start: slash, end: slash + 2, kind: 'exact' }])).map(m => m.text), ['*']);
});

test('code text is never decoded: a reference inside inline code is searched as written', () => {
  // Fourteen backticks defeat the alignment, so the range is searched.
  const fence = '`'.repeat(14);
  const source = `${fence} x &lt; < ${fence}`;
  const html = render(source, [span(source, '&lt;', 'exact')]);
  assert.deepEqual(marks(html).map(m => m.text), ['&amp;lt;'], 'the literal &lt;, not the later <');
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

const { articleEvidence, articlePage, bodyRanges } = require(path.join(SRC, 'lib/articleEvidence.ts'));

/** What the URL article view renders, and the status TextViewer shows. */
function renderArticle(pages, located) {
  const shown = articleEvidence(pages, located);
  const rendered = pages.flatMap((page) => {
    const article = articlePage(page);
    const ranges = shown.ranges.filter(r => r.page === page.page_number)
      .map(r => ({ start: r.start, end: r.end, kind: r.emphasis ? 'exact' : 'region' }));
    const body = bodyRanges(article, ranges);
    return body.length ? marks(render(article.body, body)) : [];
  });
  return { status: shown.kind, rendered };
}
function assertStatusMatchesMarks({ status, rendered }, label) {
  if (status === 'page') assert.deepEqual(rendered, [], `${label}: page shows no mark`);
  else if (status === 'exact') assert.ok(rendered.some(m => m.kind === 'exact'), `${label}: exact shows an exact mark`);
  else assert.ok(rendered.length && rendered.every(m => m.kind === 'region'), `${label}: region shows region marks only`);
}

test('Codex r2 #3: the URL article view never claims an exact passage it does not render', () => {
  const text = '## Market Dynamics\n\nEnterprise buyers increasingly demand team workspaces and SSO.';
  const pages = [{ page_number: 1, text }];
  const body = 'Enterprise buyers increasingly demand team workspaces and SSO.';
  for (const chunk of [null, `Market Dynamics\n\n${body}`, text]) {
    const located = locateTextEvidence(pages, { page: 1, pageEnd: 1 }, chunk, 'Market Dynamics');
    assert.equal(located.kind, 'exact', 'the focus is the heading the article view strips');
    const shown = renderArticle(pages, located);
    assert.deepEqual(shown, { status: 'page', rendered: [] }, String(chunk));
  }
  // A focus in the body stays exact; a region over heading and body is clipped to the body.
  const focused = renderArticle(pages, locateTextEvidence(pages, { page: 1, pageEnd: 1 }, text, body));
  assert.equal(focused.status, 'exact');
  assert.deepEqual(focused.rendered.map(m => [m.kind, m.text]), [['exact', body]]);
  const regionOnly = renderArticle(pages, locateTextEvidence(pages, { page: 1, pageEnd: 1 }, text, null));
  assert.equal(regionOnly.status, 'region');
  assert.deepEqual(regionOnly.rendered.map(m => [m.kind, m.text]), [['region', body]]);
  for (const [label, shown] of [['focused', focused], ['region', regionOnly]]) assertStatusMatchesMarks(shown, label);
});

test('the article body offset is exact even when the body repeats its own heading', () => {
  const text = '## Revenue grew strongly\n\nRevenue grew';
  const article = articlePage({ page_number: 1, text });
  assert.equal(article.body, 'Revenue grew');
  assert.equal(article.bodyStart, text.length - 'Revenue grew'.length, 'not indexOf, which finds it inside the heading');
  assert.deepEqual(bodyRanges(article, [{ start: article.bodyStart, end: text.length }]), [{ start: 0, end: 12 }]);
});

test('TextViewer passes URL evidence through articleEvidence before it sets the status', () => {
  const code = stripComments(read('components/TextViewer/TextViewer.tsx'));
  assert.match(code, /const result = isUrlSource \? articleEvidence\(pages, located\) : located;\s*setEvidence\(\{ citation: target, status: result\.kind, byPage: marksByPage\(result\) \}\)/);
  assert.match(code, /bodyRanges\(article, marks\)/);
  assert.doesNotMatch(code, /page\.text\.indexOf\(body\)/);
});

const { shownEvidenceStatus } = require(path.join(SRC, 'lib/evidenceStatus.ts'));

/** The marks a page renders, and the status the evidence bar shows for them:
 *  each rendered <mark> is one EvidenceMark, which reports its kind. */
function shownFor(source, ranges, located) {
  const rendered = marks(render(source, ranges));
  const count = (kind) => rendered.filter(m => m.kind === kind).length;
  return { status: shownEvidenceStatus(located, { exact: count('exact'), region: count('region'), bodies: 1 }), rendered };
}

test('the anchor moves to the first mark when its own range renders none; the status says region', () => {
  const source = 'Kept paragraph text here.\n\n<div>raw html is dropped</div>';
  const ranges = [
    span(source, 'Kept paragraph text here.'),
    span(source, 'raw html is dropped', 'exact', true),
  ];
  assert.deepEqual(marks(render(source, ranges)), [{ kind: 'region', anchor: true, text: 'Kept paragraph text here.' }]);
  const shown = shownFor(source, ranges, 'exact');
  assert.equal(shown.status, 'region', 'the exact range rendered no mark');
  assertStatusMatchesMarks(shown, 'anchor moved');
});

test('status: an exact range inside raw HTML renders no mark, so the status is page', () => {
  const source = 'Intro paragraph here.\n\n<div>raw html is dropped</div>';
  const shown = shownFor(source, [span(source, 'raw html is dropped', 'exact', true)], 'exact');
  assert.deepEqual(shown, { status: 'page', rendered: [] });
});

test('status: a range dropped by the reference cut guard leaves page', () => {
  const source = 'Prices &amp; fees apply.';
  const at = source.indexOf('&amp;');
  const shown = shownFor(source, [{ start: at, end: at + 2, kind: 'exact', anchor: true }], 'exact');
  assert.deepEqual(shown, { status: 'page', rendered: [] });
});

test('status: a range dropped by an ambiguous alignment leaves page', () => {
  const source = `aaa bbb ${LONG_REF} aaa bbb`;
  const second = source.lastIndexOf('aaa bbb');
  const shown = shownFor(source, [{ start: second, end: second + 7, kind: 'region', anchor: true }], 'region');
  assert.deepEqual(shown, { status: 'page', rendered: [] });
});

test('status: a rendered exact mark still reads exact', () => {
  const source = 'First sentence here. The key claim is this one. Last sentence there.';
  const shown = shownFor(source, [
    span(source, 'First sentence here.'),
    span(source, 'The key claim is this one.', 'exact', true),
    span(source, 'Last sentence there.'),
  ], 'exact');
  assert.equal(shown.status, 'exact');
  assertStatusMatchesMarks(shown, 'normal exact');
});

test('status: never more than was located, loading until a Markdown body mounts', () => {
  assert.equal(shownEvidenceStatus('region', { exact: 1, region: 0, bodies: 1 }), 'region');
  assert.equal(shownEvidenceStatus('exact', { exact: 0, region: 0, bodies: 0 }), 'loading');
  for (const located of ['page', 'loading', 'unavailable']) {
    assert.equal(shownEvidenceStatus(located, { exact: 2, region: 2, bodies: 1 }), located);
  }
});

test('TextViewer derives the status line from the marks that mounted', () => {
  const code = stripComments(read(VIEWER));
  assert.match(code, /const kind = attributes\['data-dt-evidence'\] === 'exact' \? 'exact' : 'region';\s*useLayoutEffect\(\(\) => report\?\.\(kind\), \[report, kind\]\);/);
  assert.match(code, /<\/ReactMarkdown>\s*<PageBodyMounted \/>\s*<\/Suspense>/);
  assert.match(code, /const evidenceStatus = shownEvidenceStatus\(locatedStatus, renderedMarks\);/);
  assert.match(code, /const hasMarks = renderedMarks\.exact \+ renderedMarks\.region > 0;/);
  assert.match(code, /<RenderedMarksContext\.Provider value=\{reportRendered\}>/);
  // The label and the caption read the shown status, never the located one.
  assert.doesNotMatch(code, /evidence\.\$\{locatedStatus\}|locatedStatus === 'page'/);
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
  const run = (pages) => {
    const evidence = locateTextEvidence(pages, { page: 1, pageEnd: 1 }, chunk, 'The chair asked for a revised forecast.');
    assert.equal(evidence.kind, 'exact');
    const ranges = evidence.ranges.map(r => ({ start: r.start, end: r.end, kind: r.emphasis ? 'exact' : 'region', anchor: r.start === evidence.anchor.start }));
    return marks(render(page, ranges)).map(m => `${m.kind}:${m.text}`);
  };
  const table = ['region:Item', 'region:Amount', 'region:Research', 'region:4.2 million', 'exact:The chair asked for a revised forecast.'];
  // The served title verifies the glued head, so the first sentence is marked too.
  assert.deepEqual(run([{ page_number: 1, text: page, section_title: 'Budget Review' }]), ['region:The committee reviewed the budget in March.', ...table]);
  // Without it the sentence glued to the title stays unmarked.
  assert.deepEqual(run([{ page_number: 1, text: page }]), table);
});

// ---- TextViewer: status line, caption fallback, scroll, rendering cost ----
const VIEWER = 'components/TextViewer/TextViewer.tsx';

test('the text view has a focusable evidence status line for the mobile focus hook', () => {
  const code = stripComments(read(VIEWER));
  assert.match(code, /<span role="status" className="dt-evidence-status min-w-0" tabIndex=\{-1\}>/);
  assert.match(code, /t\('evidence\.reference', \{ index: evidenceCitation\.refIndex, page: citationPageRange\(evidenceCitation\) \}\)/);
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
  assert.match(code, /const captionPage = evidenceCitation && evidenceStatus === 'page' \? evidenceCitation\.page : null;/);
  assert.match(code, /\{captionPage != null && \(/);
  // Only a missing-file PDF keeps matching the backend snippet; no evidence format uses it.
  assert.match(code, /if \(usesEvidence \|\| !highlightSnippet \|\| !targetPage\) return null;/);
});

// Browser acceptance P2-3 (next start): a ?highlight= link marked the passage
// but left the pane at scrollTop 78 with the mark below the window, and
// ?page=5 never showed page 5. react-markdown is lazy and page bodies mount in
// different commits; the scroll ran while the pages above were still spinners.
const textJump = require(path.resolve(__dirname, '../src/lib/textJump.ts'));

test('Browser P2-3: a jump waits until every lazy page body has mounted', () => {
  assert.equal(textJump.bodiesReady(5, 4, true), false, 'one page still shows its spinner');
  assert.equal(textJump.bodiesReady(5, 5, true), true);
  assert.equal(textJump.bodiesReady(0, 0, true), false, 'no pages yet');
  assert.equal(textJump.bodiesReady(3, 0, false), true, 'plain text renders at once');
  const citation = {};
  const state = { ready: true, citation, pendingAnchor: citation, mountedAnchorFor: null, caption: false };
  assert.equal(textJump.jumpTarget({ ...state, ready: false }), 'wait');
  assert.equal(textJump.jumpTarget(state), 'page', '?page=N, or a citation whose anchor has not mounted yet');
  assert.equal(textJump.jumpTarget({ ...state, caption: true }), 'caption');
  assert.equal(textJump.jumpTarget({ ...state, mountedAnchorFor: citation }), 'anchor', 'the anchor mounted before the bodies were ready');
  assert.equal(textJump.jumpTarget({ ...state, mountedAnchorFor: {} }), 'page', 'an anchor of another citation is never the target');
  assert.equal(textJump.jumpTarget({ ...state, pendingAnchor: null, mountedAnchorFor: citation }), 'done', 'the anchor already scrolled itself');
  assert.equal(textJump.jumpTarget({ ...state, citation: null, pendingAnchor: null }), 'page');
  assert.equal(textJump.anchorScrolls({ ready: false, citation, pendingAnchor: citation }), false, 'a mark that mounts early only records itself');
  assert.equal(textJump.anchorScrolls({ ready: true, citation, pendingAnchor: citation }), true);
  assert.equal(textJump.anchorScrolls({ ready: true, citation, pendingAnchor: {} }), false);
});

test('Browser P2-3: TextViewer arms a jump at once and scrolls only once the bodies are ready', () => {
  const code = stripComments(read(VIEWER));
  assert.match(code, /const bodiesReady = allBodiesMounted\(pages\.length, renderedMarks\.bodies, isMarkdown\);/);
  const arm = code.slice(code.indexOf('pendingAnchor.current = active;'), code.indexOf('}, [targetPage, scrollNonce, pages, usesEvidence]);'));
  assert.ok(arm.length > 0, 'the arming effect is found');
  assert.match(arm, /pendingJump\.current = \{ page: targetPage, citation: active \};/);
  assert.doesNotMatch(arm, /scrollIntoView|requestAnimationFrame/, 'arming never scrolls');
  assert.match(code, /if \(!pendingJump\.current \|\| !bodiesReady\) return;/);
  assert.match(code, /\}, \[targetPage, scrollNonce, pages, usesEvidence, bodiesReady\]\);/);
  // The anchor records itself, and scrolls only when the jump would.
  assert.match(code, /mountedAnchor\.current = \{ citation: currentEvidence\.citation, element \};/);
  assert.match(code, /if \(!anchorScrolls\(\{ ready: bodiesReady, citation: currentEvidence\.citation, pendingAnchor: pendingAnchor\.current \}\)\) return;/);
  assert.match(code, /\}, \[currentEvidence, bodiesReady\]\);/);
  // The reader scrolling first cancels both.
  assert.match(code, /const cancelPendingAnchor = useCallback\(\(\) => \{ pendingAnchor\.current = null; pendingJump\.current = null; \}, \[\]\);/);
  for (const handler of ['onWheelCapture', 'onPointerDownCapture', 'onKeyDownCapture']) {
    assert.match(code, new RegExp(`${handler}=\\{cancelPendingAnchor\\}`), `${handler} cancels a late scroll`);
  }
  assert.match(code, /mark: EvidenceMark/);
});

test('a late chunk fetch for an earlier citation is dropped', () => {
  const code = stripComments(read(VIEWER));
  const end = code.indexOf('}, [evidenceCitation, highlightFocus, pages, isUrlSource]);');
  assert.ok(end > 0, 'the evidence effect ends where the test expects');
  const effect = code.slice(code.indexOf('const settle = (chunkText'), end);
  assert.match(effect, /let cancelled = false;/);
  assert.match(effect, /if \(cancelled\) return;/);
  assert.match(effect, /return \(\) => \{ cancelled = true; \};/);
  assert.match(code, /const currentEvidence = evidence && evidence\.citation === evidenceCitation \? evidence : null;/);
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
