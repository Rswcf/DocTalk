const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('./_load-ts.cjs');

// TXT on the evidence path (owner decision 2026-10-11): the same
// locateTextEvidence -> marks -> shownEvidenceStatus path as the other text
// formats, rendered as plain text (lib/plainEvidence.ts) instead of Markdown.

const SRC = path.resolve(__dirname, '../src');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');
const stripComments = (code) => code.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const VIEWER = 'components/TextViewer/TextViewer.tsx';
const { locateTextEvidence, splitSentences } = require(path.join(SRC, 'lib/textEvidence.ts'));
const { plainEvidenceSegments } = require(path.join(SRC, 'lib/plainEvidence.ts'));
const { shownEvidenceStatus } = require(path.join(SRC, 'lib/evidenceStatus.ts'));

// Synthetic pages and chunks from the 2026-10-11 browser run (lighthouse-log.txt,
// oasis-library-ar.txt), as stored by the parse worker.
const LOG_PAGE = "THE LIGHTHOUSE KEEPER'S LOG — EXTRACT\n\nWeek one.\nThe lamp at Carrow Head was lit at 18:42 on the first evening, eleven minutes after sunset.\nThe new keeper, Ada Morrow, found the paraffin store half empty and wrote to the board for forty more gallons.\nFog rolled in on the third night and the horn sounded for six hours without a break.\n\nWeek two.\nA coal steamer named the Wrenfield passed within half a mile of the reef and signalled her thanks with three short blasts.\nThe weather glass fell sharply on Thursday, and the keeper fastened the storm shutters before noon.\nBy Friday morning the swell had torn away the lower landing stage, which had stood since 1871.\n\nWeek three.\nRepairs to the landing stage took nine days and used two hundred feet of oak planking from the mainland yard.\nThe relief boat could not land for twelve days, so the keepers lived on ship's biscuit and tinned beef.\nAda Morrow recorded that the lens was polished every morning, even on the days when no ship was seen.\n\nWeek four.\nAn inspector from the board arrived on the twenty-second day and counted every gallon of oil.\nHe praised the clean brasswork but criticised the state of the rain tanks, which held only a week of water.\nBefore leaving he signed the log and noted that the light had never once failed during the month.\n";
const LOG_CHUNKS = [
  "THE LIGHTHOUSE KEEPER'S LOG — EXTRACT\n\nWeek one. The lamp at Carrow Head was lit at 18:42 on the first evening, eleven minutes after sunset. The new keeper, Ada Morrow, found the paraffin store half empty and wrote to the board for forty more gallons. Fog rolled in on the third night and the horn sounded for six hours without a break. Week two. A coal steamer named the Wrenfield passed within half a mile of the reef and signalled her thanks with three short blasts. The weather glass fell sharply on Thursday, and the keeper fastened the storm shutters before noon. By Friday morning the swell had torn away the lower landing stage, which had stood since 1871. Week three. Repairs to the landing stage took nine days and used two hundred feet of oak planking from the mainland yard. The relief boat could not land for twelve days, so the keepers lived on ship's biscuit and tinned beef. Ada Morrow recorded that the lens was polished every morning, even on the days when no ship was seen. Week four. An inspector from the board arrived on the twenty-second day and counted every gallon of oil. He praised the clean brasswork but criticised the state of the rain tanks, which held only a week of water. Before leaving he signed the log and noted that the light had never once failed during the month.",
  "An inspector from the board arrived on the twenty-second day and counted every gallon of oil. He praised the clean brasswork but criticised the state of the rain tanks, which held only a week of water. Before leaving he signed the log and noted that the light had never once failed during the month.",
  "He praised the clean brasswork but criticised the state of the rain tanks, which held only a week of water. Before leaving he signed the log and noted that the light had never once failed during the month."
];
const AR_PAGE = "تقرير المكتبة العامة في مدينة الواحة\n\nافتتحت المكتبة العامة أبوابها للزوار في الخامس من مارس عام ألفين وواحد وعشرين.\nتضم المكتبة اليوم ثمانية عشر ألف كتاب باللغتين العربية والإنجليزية.\nيعمل في المكتبة اثنا عشر موظفا موزعين على ثلاث نوبات في الأسبوع.\n\nقسم الأطفال\nيقع قسم الأطفال في الطابق الأرضي بجوار الحديقة الداخلية.\nتقام فيه جلسة لقراءة القصص كل يوم سبت عند الساعة العاشرة صباحا.\nحضر هذه الجلسات أكثر من تسعمائة طفل خلال العام الماضي.\n\nقاعة الدراسة\nتتسع قاعة الدراسة في الطابق الثاني لستين طالبا في وقت واحد.\nتبقى القاعة مفتوحة حتى منتصف الليل خلال فترة الامتحانات.\nيطلب من الزوار الحفاظ على الهدوء وعدم إدخال الطعام إلى القاعة.\n\nخطط المستقبل\nتخطط إدارة المكتبة لإضافة مختبر رقمي يحتوي على عشرين حاسوبا.\nمن المتوقع أن يكتمل المشروع في نهاية عام ألفين وسبعة وعشرين.\n";
const AR_CHUNKS = [
  "تقرير المكتبة العامة في مدينة الواحة\n\nافتتحت المكتبة العامة أبوابها للزوار في الخامس من مارس عام ألفين وواحد وعشرين. تضم المكتبة اليوم ثمانية عشر ألف كتاب باللغتين العربية والإنجليزية. يعمل في المكتبة اثنا عشر موظفا موزعين على ثلاث نوبات في الأسبوع. قسم الأطفال\nيقع قسم الأطفال في الطابق الأرضي بجوار الحديقة الداخلية. تقام فيه جلسة لقراءة القصص كل يوم سبت عند الساعة العاشرة صباحا. حضر هذه الجلسات أكثر من تسعمائة طفل خلال العام الماضي. قاعة الدراسة\nتتسع قاعة الدراسة في الطابق الثاني لستين طالبا في وقت واحد. تبقى القاعة مفتوحة حتى منتصف الليل خلال فترة الامتحانات. يطلب من الزوار الحفاظ على الهدوء وعدم إدخال الطعام إلى القاعة. خطط المستقبل\nتخطط إدارة المكتبة لإضافة مختبر رقمي يحتوي على عشرين حاسوبا. من المتوقع أن يكتمل المشروع في نهاية عام ألفين وسبعة وعشرين.",
  "تبقى القاعة مفتوحة حتى منتصف الليل خلال فترة الامتحانات. يطلب من الزوار الحفاظ على الهدوء وعدم إدخال الطعام إلى القاعة. خطط المستقبل\nتخطط إدارة المكتبة لإضافة مختبر رقمي يحتوي على عشرين حاسوبا. من المتوقع أن يكتمل المشروع في نهاية عام ألفين وسبعة وعشرين."
];

const page = (text) => [{ page_number: 1, text }];
const full = (chunk) => ({ page: 1, pageEnd: 1, contextText: `[page 1] ${chunk}` });
// What TextViewer renders for one page, and the status it then shows.
function render(pages, citation, chunkText, focus) {
  const evidence = locateTextEvidence(pages, citation, chunkText, focus);
  const marks = evidence.ranges.map(range => ({
    start: range.start, end: range.end, kind: range.emphasis ? 'exact' : 'region',
    anchor: evidence.anchor?.page === range.page && evidence.anchor.start === range.start,
  }));
  const segments = plainEvidenceSegments(pages[0].text, marks);
  const rendered = { exact: 0, region: 0, bodies: 1 };
  for (const segment of segments) if (segment.mark) rendered[segment.mark.kind]++;
  const text = (kind) => segments.filter(s => s.mark?.kind === kind).map(s => s.parts.map(p => p.text).join(''));
  return { evidence, segments, status: shownEvidenceStatus(evidence.kind, rendered), exact: text('exact'), region: text('region') };
}
const joined = (segments) => segments.map(s => s.parts.map(p => p.text).join('')).join('');

// Browser acceptance 2026-10-11, P2-5: the five TXT citations the old prefix
// match got wrong. Stored citations from the golden run.
test('P2-5 txt1-q1-c1: the focus is exact, not the log title + "Week o"', () => {
  // context_text was cut at 900, so the viewer fetches the whole chunk.
  const cut = `[page 1] ${LOG_CHUNKS[0]}`.slice(0, 900);
  const focus = 'Repairs to the landing stage took nine days and used two hundred feet of oak planking from the mainland yard.';
  const result = render(page(LOG_PAGE), { page: 1, pageEnd: 1, contextText: cut }, LOG_CHUNKS[0], focus);
  assert.equal(result.status, 'exact');
  assert.deepEqual(result.exact, [focus]);
  assert.equal(result.evidence.anchor.start, LOG_PAGE.indexOf('Repairs'));
});

test('P2-5 txt1-q2-c1: the whole cited chunk is the region and the quoted sentence is exact', () => {
  const focus = 'He praised the clean brasswork but criticised the state of the rain tanks, which held only a week of water.';
  const result = render(page(LOG_PAGE), full(LOG_CHUNKS[1]), LOG_CHUNKS[1], focus);
  assert.equal(result.status, 'exact');
  assert.deepEqual(result.exact, [focus]);
  assert.ok(result.region.some(text => text.includes('counted every gallon of oil.')), 'not cut at "gallon of o"');
  assert.ok(!result.region.some(text => text.includes('Week four')), 'nothing outside the chunk');
});

test('P2-5 txt1-q2-c2: the quoted sentence is exact to its last word', () => {
  const focus = 'He praised the clean brasswork but criticised the state of the rain tanks, which held only a week of water.';
  const result = render(page(LOG_PAGE), full(LOG_CHUNKS[2]), LOG_CHUNKS[2], focus);
  assert.equal(result.status, 'exact');
  assert.deepEqual(result.exact, [focus]);
});

test('P2-5 artxt-q1-c1: the Arabic chunk is marked whole, children\'s-section sentence included', () => {
  const result = render(page(AR_PAGE), full(AR_CHUNKS[0]), AR_CHUNKS[0], null);
  assert.equal(result.status, 'region');
  const marked = result.region.join('\n');
  assert.ok(marked.includes('حضر هذه الجلسات أكثر من تسعمائة طفل خلال العام الماضي.'));
  assert.ok(marked.includes('قسم الأطفال'));
});

test('P2-5 artxt-q2-c1: the digital-lab sentences are marked, not a study-hall sentence alone', () => {
  const result = render(page(AR_PAGE), full(AR_CHUNKS[1]), AR_CHUNKS[1], null);
  assert.equal(result.status, 'region');
  const marked = result.region.join('\n');
  assert.ok(marked.includes('تخطط إدارة المكتبة لإضافة مختبر رقمي يحتوي على عشرين حاسوبا.'));
  assert.ok(marked.includes('من المتوقع أن يكتمل المشروع في نهاية عام ألفين وسبعة وعشرين.'));
  assert.ok(!marked.includes('تتسع قاعة الدراسة'), 'the sentence before the chunk is not marked');
});

test('TXT renders literally: Markdown and HTML characters stay text and still align', () => {
  const text = [
    '# Budget notes',
    'Totals use *gross* figures &amp; exclude <b>VAT</b> refunds from the quarter.',
    'Line items marked ** are estimates until the auditor signs them off.',
    '',
    'Questions go to the finance desk.',
  ].join('\n');
  const chunk = splitSentences(text).join(' ');
  const focus = 'Totals use *gross* figures &amp; exclude <b>VAT</b> refunds from the quarter.';
  const result = render(page(text), full(chunk), chunk, focus);
  assert.equal(joined(result.segments), text, 'every character renders as written');
  assert.equal(result.status, 'exact');
  assert.deepEqual(result.exact, [focus], 'the mark holds the literal * & < > characters');
  assert.ok(result.region.some(r => r.startsWith('# Budget notes')), 'a leading # is text, inside the region');
  assert.ok(result.region.some(r => r.includes('marked ** are estimates')));
});

test('TXT: an Arabic page keeps its text and direction; the evidence sits on its own characters', () => {
  const focus = 'تخطط إدارة المكتبة لإضافة مختبر رقمي يحتوي على عشرين حاسوبا.';
  const result = render(page(AR_PAGE), full(AR_CHUNKS[1]), AR_CHUNKS[1], focus);
  assert.equal(joined(result.segments), AR_PAGE);
  assert.equal(result.status, 'exact');
  assert.deepEqual(result.exact, [focus]);
  const code = stripComments(read(VIEWER));
  const plain = code.slice(code.indexOf('function PlainEvidenceContent('), code.indexOf('function PlainTextContent('));
  assert.match(plain, /<pre dir="auto"/, 'each page sets its own direction (RTL for Arabic)');
  assert.match(plain, /<p dir="auto"/, 'the page caption too');
});

test('TXT: an ambiguous passage marks nothing and the status is page', () => {
  const repeated = 'The generator is tested on the first Monday of every month.';
  const text = `Maintenance schedule.\n${repeated}\nSafety drills.\n${repeated}`;
  const result = render(page(text), full(repeated), repeated, repeated);
  assert.equal(result.evidence.kind, 'page');
  assert.equal(result.status, 'page');
  assert.ok(result.segments.every(s => !s.mark));
  assert.equal(joined(result.segments), text);
});

test('TXT: search matches split cleanly around and inside evidence marks', () => {
  const text = 'Alpha beta gamma. Delta beta epsilon.';
  const segments = plainEvidenceSegments(text, [{ start: 0, end: 17, kind: 'region', anchor: true }], { starts: [6, 24], length: 4, active: 24 });
  assert.equal(joined(segments), text);
  assert.deepEqual(segments.map(s => [s.mark?.kind ?? null, s.parts.map(p => `${p.search ?? '-'}:${p.text}`)]), [
    ['region', ['-:Alpha ', 'match:beta', '-: gamma.']],
    [null, ['-: Delta ', 'active:beta', '-: epsilon.']],
  ]);
  assert.equal(segments[0].mark.anchor, true);
  // Overlapping or out-of-range marks never render twice or past the text.
  const clamped = plainEvidenceSegments('abcdef', [{ start: 2, end: 9, kind: 'exact' }, { start: 1, end: 3, kind: 'region' }]);
  assert.equal(joined(clamped), 'abcdef');
  assert.equal(clamped.filter(s => s.mark).length, 1);
});

test('TextViewer puts TXT on the evidence path; a missing-file PDF keeps the snippet match', () => {
  const code = stripComments(read(VIEWER));
  assert.match(code, /const isPlainEvidence = !isMarkdown && fileType === 'txt';/);
  assert.match(code, /const usesEvidence = isMarkdown \|\| isPlainEvidence;/);
  assert.match(code, /const evidenceCitation = usesEvidence \? citation \?\? null : null;/);
  assert.match(code, /\) : isPlainEvidence \? \(\s*<PlainEvidenceContent/);
  const plain = code.slice(code.indexOf('function PlainEvidenceContent('), code.indexOf('function PlainTextContent('));
  assert.match(plain, /plainEvidenceSegments\(text, markRanges,/);
  assert.match(plain, /<EvidenceMark key=\{i\} data-dt-evidence=\{segment\.mark\.kind\} data-dt-evidence-anchor=\{segment\.mark\.anchor \? 'true' : undefined\}>/);
  assert.match(plain, /<PageBodyMounted \/>/, 'the status leaves loading once the body mounts');
  assert.doesNotMatch(plain, /ReactMarkdown|dangerouslySetInnerHTML|rehype/, 'plain text is never parsed');
  // The old prefix match survives only for missing-file PDFs.
  assert.match(code, /findSnippetInPage\(page\.text, highlightSnippet\)/);
  assert.match(code, /<PlainTextContent\s/);
});
