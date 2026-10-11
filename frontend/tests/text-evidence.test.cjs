const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
require('./_load-ts.cjs');

const citationText = require(path.resolve(__dirname, '../src/lib/citationText.ts'));

// ---- Step 0: what the wire actually carries -------------------------------
// chat_service._citation_payload: text_snippet = "{section_title}: " + chunk
// text (cut at 100); context_text = "[page N] " / "[page N–M] " + chunk text
// (cut at 900 code points).

test('chunk text comes from context_text without its page prefix', () => {
  const chunk = citationText.citationChunkText({ contextText: '[page 3] Revenue grew 12% in Q3. Costs fell.' });
  assert.deepEqual(chunk, { text: 'Revenue grew 12% in Q3. Costs fell.', truncated: false, pageStart: 3, pageEnd: 3 });
  const range = citationText.citationChunkText({ contextText: '[page 3–4] Spans two pages.' });
  assert.equal(range.pageStart, 3);
  assert.equal(range.pageEnd, 4);
  assert.equal(range.text, 'Spans two pages.');
});

test('citations without context text have no chunk text (quote cards, saved quotes, deep links)', () => {
  assert.equal(citationText.citationChunkText({ contextText: undefined }), null);
  assert.equal(citationText.citationChunkText({ contextText: '   ' }), null);
});

test('a context cut at the backend limit is flagged, counting code points like Python', () => {
  const body = 'a'.repeat(891);
  assert.equal(citationText.citationChunkText({ contextText: `[page 1] ${body}` }).truncated, true);
  // 450 astral characters are 900 UTF-16 units but only 450 Python code points.
  assert.equal(citationText.citationChunkText({ contextText: `[page 1] ${'😀'.repeat(450)}` }).truncated, false);
});

test('the converted-PDF passage never ends in a cut fragment', () => {
  const sentence = 'The board approved the budget. ';
  const context = `[page 2] ${sentence.repeat(40)}`.slice(0, 900);
  const passage = citationText.citationPassage({ contextText: context, textSnippet: 'Title: The board' });
  assert.ok(passage.endsWith('approved the budget.'));
  assert.ok(!passage.startsWith('[page'));
  assert.equal(citationText.citationPassage({ textSnippet: 'A saved quote.' }), 'A saved quote.');
  assert.equal(citationText.dropTrailingFragment('One. Two thr'), 'One.');
  assert.equal(citationText.dropTrailingFragment('第一句。第二'), '第一句。');
  assert.equal(citationText.dropTrailingFragment('| a | b |\n| 1 | 2'), '| a | b |');
  assert.equal(citationText.dropTrailingFragment('v3.5 is out'), '');
});

// ---- locateTextEvidence ----------------------------------------------------
const { locateTextEvidence, splitSentences } = require(path.resolve(__dirname, '../src/lib/textEvidence.ts'));

// Emulates parse_service: each page body is one block; its sentences are
// stripped and rejoined with one space (none beside CJK); a title block that is
// not classified as a heading is its own unit, glued on with a space.
const CJK = /[　-〿぀-ヿ一-鿿＀-￯]/;
function chunkOf(units) {
  let text = '';
  for (const raw of units) {
    const part = raw.trim();
    if (!part) continue;
    if (!text) { text = part; continue; }
    const prev = text.at(-1), first = part[0];
    const space = !' \n([{'.includes(prev) && !' \n,.;:!?)]}。！？；，、'.includes(first) && !CJK.test(prev) && !CJK.test(first);
    text += (space ? ' ' : '') + part;
  }
  return text;
}
const bodyUnits = (text) => splitSentences(text.replace(/ /g, ' ').trim());
const marked = (pages, result) => result.ranges.map(r => ({
  page: r.page, emphasis: r.emphasis, text: pages.find(p => p.page_number === r.page).text.slice(r.start, r.end),
}));
const cite = (page, extra = {}) => ({ page, pageEnd: page, ...extra });

const DOCX_PAGE = [
  'The committee met on 4 March to review the annual budget.',
  'Spending on research rose by 12 percent compared with last year.',
  '',
  '| Item | Amount |',
  '| --- | --- |',
  '| Research | 4.2 million |',
  '| Travel | 0.3 million |',
  '',
  'The chair asked for a revised forecast by June.',
].join('\n');

test('sentence split mirrors parse_service (ASCII only before whitespace, CJK always)', () => {
  assert.deepEqual(splitSentences('Version 3.5 is out. See e.g. the notes! 第一句。第二句'), ['Version 3.5 is out.', 'See e.g.', 'the notes!', '第一句。', '第二句']);
});

test('a verified glued title is dropped and the whole page body, tables included, is the region', () => {
  // /text-content serves section_title when the title was read as a heading.
  const pages = [{ page_number: 1, text: DOCX_PAGE, section_title: 'Budget Review' }];
  const chunk = chunkOf(['Budget Review', ...bodyUnits(DOCX_PAGE)]);
  assert.ok(chunk.startsWith('Budget Review The committee met'), 'title glued onto the first sentence');
  const result = locateTextEvidence(pages, cite(1), chunk, null);
  assert.equal(result.kind, 'region');
  const text = marked(pages, result).map(r => r.text).join('|');
  assert.match(text, /^The committee met on 4 March/);
  assert.match(text, /\| Research \| 4\.2 million \|/);
  assert.match(text, /revised forecast by June\.$/);
  assert.ok(!text.includes('Budget Review'));
});

test('an unverified glued title leaves its sentence unmarked; the rest of the page is the region', () => {
  // A DOCX heading is neither in the page text nor served when it was glued.
  const pages = [{ page_number: 1, text: DOCX_PAGE }];
  const result = locateTextEvidence(pages, cite(1), chunkOf(['Budget Review', ...bodyUnits(DOCX_PAGE)]), null);
  assert.equal(result.kind, 'region');
  const text = marked(pages, result).map(r => r.text).join('|');
  assert.match(text, /^Spending on research rose/);
  assert.match(text, /revised forecast by June\.$/);
  assert.ok(!text.includes('The committee met'), 'the sentence glued to the title is not marked');
});

test('Codex r1 #2: content in front of a page start is never dropped as a title', () => {
  const text = 'Acme Corp reported revenue growth after the merger and announced a new audit plan for Europe.';
  const pages = [{ page_number: 1, text }];
  const chunk = `The court rejected ${text}`;
  const result = locateTextEvidence(pages, cite(1), chunk, null);
  assert.equal(result.kind, 'page');
  assert.deepEqual(result.ranges, []);
  // As the focus alone it is not marked either.
  assert.equal(locateTextEvidence(pages, cite(1), null, chunk).kind, 'page');
  // The same shape with the page's served title is the glued-title case.
  const titled = [{ page_number: 1, text, section_title: 'The court rejected' }];
  assert.equal(locateTextEvidence(titled, cite(1), chunk, null).kind, 'region');
});

test('verified titles: a PPTX/URL first line, a CJK title rejoined, a title split at its own sentence break', () => {
  // URL pages keep their "# heading" block as the first line.
  const url = '## Market Dynamics\n\nEnterprise buyers increasingly demand team workspaces and SSO.';
  const urlChunk = chunkOf(['Market Dynamics', ...bodyUnits(url)]);
  assert.equal(locateTextEvidence([{ page_number: 1, text: url }], cite(1), urlChunk, null).kind, 'region');
  // "1. 系统总览" is rejoined by the chunker without the space beside CJK.
  const zh = '本系统由前端、后端和存储三部分组成，各部分独立部署。';
  const zhChunk = chunkOf(['1.', '系统总览', ...bodyUnits(zh)]);
  assert.ok(zhChunk.startsWith('1.系统总览本系统'));
  const zhResult = locateTextEvidence([{ page_number: 1, text: zh, section_title: '1. 系统总览' }], cite(1), zhChunk, zh);
  assert.equal(zhResult.kind, 'exact');
  // "2. Results" keeps its space, so only "Results" is glued to the page start.
  const en = 'The primary outcome improved in every arm of the trial.';
  const enChunk = chunkOf(['Earlier page ends here.', '2.', 'Results', ...bodyUnits(en)]);
  assert.ok(enChunk.includes('2. Results The primary'));
  const pages = [{ page_number: 1, text: 'Earlier page ends here.' }, { page_number: 2, text: en, section_title: '2. Results' }];
  const enResult = locateTextEvidence(pages, { page: 2, pageEnd: 2, contextText: `[page 1–2] ${enChunk}` }, enChunk, en);
  assert.equal(enResult.kind, 'exact');
  assert.equal(marked(pages, enResult).find(r => r.emphasis).text, en);
});

test('the focus sentence is the exact emphasis inside the region', () => {
  const pages = [{ page_number: 1, text: DOCX_PAGE }];
  const chunk = chunkOf(bodyUnits(DOCX_PAGE));
  const result = locateTextEvidence(pages, cite(1), chunk, 'Spending on research rose by 12 percent compared with last year.');
  assert.equal(result.kind, 'exact');
  const exact = marked(pages, result).filter(r => r.emphasis);
  assert.deepEqual(exact.map(r => r.text), ['Spending on research rose by 12 percent compared with last year.']);
  assert.equal(result.anchor.start, DOCX_PAGE.indexOf('Spending'));
});

test('a focus that the page does not contain verbatim is not emphasised', () => {
  const pages = [{ page_number: 1, text: DOCX_PAGE }];
  const result = locateTextEvidence(pages, cite(1), chunkOf(bodyUnits(DOCX_PAGE)), 'Spending on research rose by 13 percent compared with last year.');
  assert.equal(result.kind, 'region');
  assert.ok(result.ranges.every(r => !r.emphasis));
});

test('whitespace drift (newlines rejoined as spaces) still matches', () => {
  const text = 'First line of the note.\nSecond line continues here.\n\nA new paragraph starts now.';
  const pages = [{ page_number: 2, text }];
  const chunk = chunkOf(bodyUnits(text));
  assert.ok(!chunk.includes('\n\n'));
  const result = locateTextEvidence(pages, cite(2), chunk, null);
  assert.equal(result.kind, 'region');
  assert.deepEqual(marked(pages, result).map(r => r.text), [text]);
});

test('a repeated passage is never highlighted, even when the chunk contains it', () => {
  const text = 'Terms apply to all customers.\nPayment is due in 30 days.\nTerms apply to all customers.';
  const pages = [{ page_number: 1, text }];
  const result = locateTextEvidence(pages, cite(1), 'Terms apply to all customers.', 'Terms apply to all customers.');
  assert.equal(result.kind, 'page');
  assert.deepEqual(result.ranges, []);
});

test('an unlocated sentence splits the region; it is never bridged', () => {
  const text = 'Alpha sentence is long enough here. The middle sentence reads one way. Gamma sentence is long enough too.';
  const pages = [{ page_number: 1, text }];
  // The middle sentence differs from the page text.
  const chunk = 'Alpha sentence is long enough here. The middle sentence reads another way. Gamma sentence is long enough too.';
  const ranges = marked(pages, locateTextEvidence(pages, cite(1), chunk, null)).map(r => r.text);
  assert.deepEqual(ranges, ['Alpha sentence is long enough here.', 'Gamma sentence is long enough too.']);
});

test('one short located sentence is not enough for a region', () => {
  const pages = [{ page_number: 1, text: 'Revenue rose. Costs fell sharply in the third quarter of the year.' }];
  assert.equal(locateTextEvidence(pages, cite(1), 'Revenue rose. Costs fell by half.', null).kind, 'page');
});

test('a text from another document locates nothing', () => {
  const pages = [{ page_number: 1, text: DOCX_PAGE }];
  const other = 'Completely different content about weather patterns in spring.';
  assert.equal(locateTextEvidence(pages, cite(1), other, other).kind, 'page');
});

test('word boundaries hold: a needle inside a longer word does not match', () => {
  const pages = [{ page_number: 1, text: 'The therapist reviewed the positions carefully.' }];
  assert.equal(locateTextEvidence(pages, cite(1), null, 'rapist reviewed the position').kind, 'page');
});

test('Markdown syntax and entities are compared as stored on both sides', () => {
  const text = 'Use the **bold** form for emphasis.\nPrices &amp; fees are listed below in the table.';
  const pages = [{ page_number: 1, text }];
  const result = locateTextEvidence(pages, cite(1), chunkOf(bodyUnits(text)), 'Use the **bold** form for emphasis.');
  assert.equal(result.kind, 'exact');
  assert.equal(marked(pages, result).find(r => r.emphasis).text, 'Use the **bold** form for emphasis.');
});

test('PPTX: a repeated title and speaker notes stay inside one slide region', () => {
  const text = 'Quarterly Results\nRevenue up in every region\nMargins held steady\n\n**Speaker Notes:**\nMention the new contract in Spain.';
  const pages = [{ page_number: 3, text }];
  const chunk = chunkOf(['Quarterly Results', ...bodyUnits(text)]);
  const result = locateTextEvidence(pages, cite(3), chunk, null);
  assert.equal(result.kind, 'region');
  assert.match(marked(pages, result)[0].text, /^Quarterly Results\nRevenue up/);
  assert.match(marked(pages, result).at(-1).text, /new contract in Spain\.$/);
});

test('XLSX: a verified sheet name glued onto the table is dropped', () => {
  const text = '| Region | Q1 | Q2 |\n| --- | --- | --- |\n| North | 120 | 140 |\n| South | 95 | 101 |';
  const pages = [{ page_number: 1, text, section_title: 'Sales 2026' }, { page_number: 2, text: '| Region | Q1 |\n| --- | --- |\n| West | 7 |' }];
  const chunk = chunkOf(['Sales 2026', ...bodyUnits(text)]);
  const result = locateTextEvidence(pages, cite(1), chunk, null);
  assert.equal(result.kind, 'region');
  assert.deepEqual(marked(pages, result).map(r => r.text), [text]);
});

test('XLSX: an unverified sheet name leaves the header row unmarked; the other rows are the region', () => {
  // Sheet names are not in the page text, and /text-content serves none for them.
  const text = '| Region | Q1 | Q2 |\n| --- | --- | --- |\n| North | 120 | 140 |\n| South | 95 | 101 |';
  const pages = [{ page_number: 1, text }, { page_number: 2, text: '| Region | Q1 |\n| --- | --- |\n| West | 7 |' }];
  const result = locateTextEvidence(pages, cite(1), chunkOf(['Sales 2026', ...bodyUnits(text)]), null);
  assert.equal(result.kind, 'region');
  assert.deepEqual(marked(pages, result).map(r => r.text), [text.slice(text.indexOf('| --- |'))]);
});

test('XLSX: a chunk across two sheets marks both tables, never the sheet names', () => {
  const s1 = '| Item | Q1 | Q2 |\n| --- | --- | --- |\n| Travel | 1200 | 950 |\n| Software | 4300 | 4300 |';
  const s2 = '| Team | People |\n| --- | --- |\n| Research | 12 |\n| Support | 7 |';
  // parse_service output for this workbook (backend/tests/test_extractors_office.py).
  const chunk = chunkOf(['Budget', ...bodyUnits(s1), 'Headcount', ...bodyUnits(s2)]);
  assert.ok(chunk.includes('| 4300 | 4300 | Headcount | Team |'), 'sheet name glued between the tables');
  const citation = { page: 1, pageEnd: 2, contextText: `[page 1–2] ${chunk}` };
  const titled = [{ page_number: 1, text: s1, section_title: 'Budget' }, { page_number: 2, text: s2, section_title: 'Headcount' }];
  const verified = locateTextEvidence(titled, citation, chunk, null);
  assert.equal(verified.kind, 'region');
  assert.deepEqual(marked(titled, verified).map(r => `${r.page}:${r.text}`), [`1:${s1}`, `2:${s2}`]);
  // Without served titles: "Headcount" sits between the end of sheet 1 and
  // the start of sheet 2, so it is dropped and both rows around it are marked;
  // "Budget" opens the chunk with no page end in front of it, so its header
  // row stays unmarked. "| --- | --- |" also occurs inside sheet 1's rule.
  const pages = [{ page_number: 1, text: s1 }, { page_number: 2, text: s2 }];
  const unverified = locateTextEvidence(pages, citation, chunk, null);
  assert.deepEqual(marked(pages, unverified).map(r => `${r.page}:${r.text}`), [
    '1:| --- | --- | --- |\n| Travel | 1200 | 950 |\n| Software | 4300 | 4300 |', '2:| Team | People |', '2:| Research | 12 |\n| Support | 7 |',
  ]);
  assert.ok(!marked(pages, unverified).some(r => /Budget|Headcount|\| Item \|/.test(r.text)));
});

test('a page end glued to the next verified title is located when the chunk runs through it', () => {
  const p1 = 'Opening sentence of the slide body.\nRevenue by region\nNorth up four points';
  const p2 = 'Costs fell for the third quarter running.';
  const pages = [{ page_number: 1, text: p1 }, { page_number: 2, text: p2, section_title: 'Operating Costs' }];
  const chunk = chunkOf([...bodyUnits(p1), 'Operating Costs', ...bodyUnits(p2)]);
  assert.ok(chunk.includes('North up four points Operating Costs Costs fell'));
  const citation = { page: 1, pageEnd: 2, contextText: `[page 1–2] ${chunk}` };
  const result = locateTextEvidence(pages, citation, chunk, null);
  assert.deepEqual(marked(pages, result).map(r => `${r.page}:${r.text}`), [`1:${p1}`, `2:${p2}`]);
  assert.ok(!marked(pages, result).some(r => r.text.includes('Operating Costs')));
  // An unverified title between the end of page 1 and the start of page 2 is
  // bracketed by page text on both sides: dropped, never marked.
  const untitled = [{ page_number: 1, text: p1 }, { page_number: 2, text: p2 }];
  const unverified = locateTextEvidence(untitled, citation, chunk, null);
  assert.deepEqual(marked(untitled, unverified).map(r => `${r.page}:${r.text}`), [`1:${p1}`, `2:${p2}`]);
  assert.ok(!marked(untitled, unverified).some(r => r.text.includes('Operating Costs')));
});

// Browser acceptance 2026-10-11, P2-1: page texts and chunk shapes from the
// golden documents (depot-manual.docx, coastal-handbook.md, highlight-fixture.md).
const DEPOT = [
  'This manual describes how the Harbor Street depot receives, stores and dispatches medical supplies.\nIt applies to all forty-two staff members who work the morning, evening and night shifts.\n\n| Shift | Start | End | Staff |\n| --- | --- | --- | --- |\n| Morning | 06:00 | 14:00 | 18 |\n| Evening | 14:00 | 22:00 | 15 |\n| Night | 22:00 | 06:00 | 9 |\n',
  'Every inbound pallet is scanned at bay three before it leaves the loading dock.\nCold-chain items must reach the refrigerated room within eighteen minutes of the truck doors opening.\nDamaged cartons are photographed and the images are attached to the receiving record the same day.',
  'Shelving in aisle seven is reserved for controlled substances and needs two badge scans to open.\nHeavy items above twenty kilograms are stored below waist height on the lowest two shelves.',
];
const depotPages = () => DEPOT.map((text, i) => ({ page_number: i + 1, text }));
const depotChunk = chunkOf(['Purpose and scope', ...bodyUnits(DEPOT[0]), 'Receiving goods', ...bodyUnits(DEPOT[1]), 'Storage rules', ...bodyUnits(DEPOT[2])]);

test('Browser P2-1: a heading between a table and the next page is dropped; the last row and the first sentence are marked', () => {
  assert.ok(depotChunk.includes('| Night | 22:00 | 06:00 | 9 | Receiving goods Every inbound pallet'), 'one piece: last row, heading, first sentence');
  const pages = depotPages();
  const result = locateTextEvidence(pages, { page: 1, pageEnd: 3, contextText: `[page 1–3] ${depotChunk}` }, depotChunk, null);
  const text = marked(pages, result).map(r => r.text).join('|');
  assert.match(text, /\| Night \| 22:00 \| 06:00 \| 9 \|/);
  assert.match(text, /Every inbound pallet is scanned at bay three/);
  for (const heading of ['Purpose and scope', 'Receiving goods', 'Storage rules']) assert.ok(!text.includes(heading), heading);
  // The chunk opens with its first heading: nothing in front of it is located,
  // so its sentence stays unmarked (Codex r1 #2).
  assert.ok(!text.includes('This manual describes'));
});

test('Browser P2-1: a heading after a piece that ends the previous page is dropped; that page\'s first sentence is marked', () => {
  const pages = depotPages();
  assert.ok(depotChunk.includes('the same day. Storage rules Shelving in aisle seven'), 'heading glued onto the next piece');
  const result = locateTextEvidence(pages, { page: 3, pageEnd: 3, contextText: `[page 1–3] ${depotChunk}` }, depotChunk, null);
  assert.deepEqual(marked(pages, result).map(r => `${r.page}:${r.text}`), [`3:${DEPOT[2]}`]);
});

test('Browser P2-1: a heading after a code block, a CJK heading and an Arabic heading are dropped between pages', () => {
  const code = ['Cloud cover is estimated in eighths of the visible sky.\n\n```\nlog format: HH:MM  speed_kn\n```\n',
    'Seal counts happen at low water, when the animals haul out on the Shingle Bank.\nBirds are counted with the block method.'];
  const codePages = code.map((text, i) => ({ page_number: i + 1, text }));
  const codeChunk = chunkOf([...bodyUnits(code[0]), 'Wildlife counts', ...bodyUnits(code[1])]);
  assert.ok(codeChunk.includes('``` Wildlife counts Seal counts happen'));
  const seals = locateTextEvidence(codePages, { page: 1, pageEnd: 2, contextText: `[page 1–2] ${codeChunk}` }, codeChunk, null);
  assert.ok(marked(codePages, seals).some(r => r.page === 2 && r.text.startsWith('Seal counts happen at low water')));
  assert.ok(!marked(codePages, seals).some(r => r.text.includes('Wildlife counts')));

  const md = ['Use `--strict` mode \\*only\\* when the probe is calibrated &amp; dry.\n',
    '本研究共调查了三十八处湿地。水样均在清晨采集，以减少昼夜温差的影响。\n',
    'شملت الدراسة ثمانية وثلاثين موقعا من الأراضي الرطبة. جمعت العينات عند الفجر.\n'];
  const mdPages = md.map((text, i) => ({ page_number: i + 1, text }));
  const mdChunk = chunkOf([...bodyUnits(md[0]), '中文摘要', ...bodyUnits(md[1]), 'ملخص', ...bodyUnits(md[2])]);
  assert.ok(mdChunk.includes('dry.中文摘要本研究') && mdChunk.includes('的影响。ملخص شملت'));
  const result = locateTextEvidence(mdPages, { page: 1, pageEnd: 3, contextText: `[page 1–3] ${mdChunk}` }, mdChunk, null);
  const text = marked(mdPages, result).map(r => `${r.page}:${r.text}`);
  assert.ok(text.some(r => r.startsWith('1:Use `--strict` mode')), 'the line glued to the CJK heading');
  assert.ok(text.some(r => r.startsWith('2:本研究共调查了')));
  assert.ok(text.some(r => r.startsWith('3:شملت الدراسة')), 'the first Arabic sentence');
  assert.ok(!text.some(r => r.includes('中文摘要') || r.includes('ملخص')));
});

test('Browser P2-1: unbracketed text in front of a page start is still never dropped', () => {
  const pages = [
    { page_number: 1, text: 'Alpha sentence one opens the first page. Beta sentence two closes the first page.' },
    { page_number: 2, text: 'Gamma sentence starts the second page with enough words.' },
  ];
  const cite = { page: 1, pageEnd: 2 };
  // The piece before the glued text ends mid-page, not at the end of page 1.
  const midPage = 'Alpha sentence one opens the first page. Title words Gamma sentence starts the second page with enough words.';
  const mid = locateTextEvidence(pages, { ...cite, contextText: `[page 1–2] ${midPage}` }, midPage, null);
  assert.ok(!marked(pages, mid).some(r => r.page === 2));
  // Glued text longer than a title is not a glued title.
  for (const glued of ['A long run of words '.repeat(8).trim()]) {
    const chunk = `Beta sentence two closes the first page. ${glued} Gamma sentence starts the second page with enough words.`;
    const result = locateTextEvidence(pages, { ...cite, contextText: `[page 1–2] ${chunk}` }, chunk, null);
    assert.ok(!marked(pages, result).some(r => r.page === 2), JSON.stringify(glued.slice(0, 20)));
  }
});

test('a glued title that matches the end of a page outside the chunk is not marked', () => {
  // A contents page ends with the next section's title; the chunk starts at that section.
  const toc = 'Contents\n1. Introduction and scope\nStudy design and methods';
  const body = 'The trial enrolled 412 adults across six clinics. Follow-up lasted twelve months.';
  const pages = [{ page_number: 1, text: toc }, { page_number: 2, text: body }];
  const chunk = chunkOf(['Study design and methods', ...bodyUnits(body)]);
  const result = locateTextEvidence(pages, { page: 2, pageEnd: 2, contextText: `[page 2] ${chunk}` }, chunk, null);
  assert.deepEqual([...new Set(result.ranges.map(r => r.page))], [2]);
  assert.ok(!marked(pages, result).some(r => r.text.includes('Study design')));
});

test('a page end that repeats elsewhere in the chunk range is not marked', () => {
  const p1 = 'First page opens here.\n| Total | 4,200 |';
  const p2 = 'Second page opens here.\n| Total | 4,200 |';
  const p3 = 'Third page carries the conclusion of the report.';
  const pages = [{ page_number: 1, text: p1 }, { page_number: 2, text: p2 }, { page_number: 3, text: p3 }];
  const piece = chunkOf(['| Total | 4,200 |', 'Summary', ...bodyUnits(p3)]);
  const result = locateTextEvidence(pages, { page: 1, pageEnd: 3, contextText: `[page 1–3] ${piece}` }, piece, null);
  assert.ok(!result.ranges.some(r => r.page !== 3), 'the ambiguous table row stays unmarked');
});

test('a head that is neither a page end nor a verified title refuses the split; lines are located one by one', () => {
  const lines = [
    'Pricing implementation status for every plan tier',
    'Credit rescaling deployed across all existing ledgers',
    'Free tier reduced so that upgrade pressure appears early',
    'Plus tier launched for casual users between Free and Pro',
    'Annual pricing introduced with a twenty percent discount',
  ];
  const p1 = [...lines, 'Credit packs repriced against the subscriptions'].join('\n');
  const p2 = 'Current pricing structure\n| Tier | Monthly |\n| --- | --- |\n| Free | 0 |';
  const pages = [{ page_number: 1, text: p1 }, { page_number: 2, text: p2 }];
  // The chunk's copy of page 1 lacks its last line, so no page-end match exists.
  const chunk = chunkOf([lines.join('\n'), 'Current pricing structure', ...bodyUnits(p2)]);
  const result = locateTextEvidence(pages, { page: 1, pageEnd: 2, contextText: `[page 1–2] ${chunk}` }, chunk, null);
  const text = marked(pages, result).map(r => `${r.page}:${r.text}`);
  // The last line carries the glued title and is not page 1's end, so the
  // text in front of page 2's start is unverified: its first line is not marked.
  assert.deepEqual(text, [`1:${lines.slice(0, 4).join('\n')}`, `2:${p2.slice(p2.indexOf('| Tier'))}`]);
});

test('a chunk spanning two pages marks both; a narrowed citation marks only its page', () => {
  const p1 = 'Opening statement of the report sits here.\n| A | B |\n| --- | --- |\n| 1 | 2 |';
  const p2 = 'The second page begins with this sentence. It ends here with a conclusion.';
  const pages = [{ page_number: 1, text: p1 }, { page_number: 2, text: p2 }];
  const chunk = chunkOf([...bodyUnits(p1), ...bodyUnits(p2)]);
  const both = locateTextEvidence(pages, { page: 1, pageEnd: 2, contextText: `[page 1–2] ${chunk}` }, chunk, null);
  assert.deepEqual([...new Set(both.ranges.map(r => r.page))], [1, 2]);
  assert.ok(marked(pages, both).some(r => r.text.endsWith('| 1 | 2 |')), 'the undelimited table end is located on page 1');
  const narrowed = locateTextEvidence(pages, { page: 2, pageEnd: 2, contextText: `[page 1–2] ${chunk}` }, chunk, null);
  assert.deepEqual([...new Set(narrowed.ranges.map(r => r.page))], [2]);
});

test('uniqueness is checked over the chunk range, not only the narrowed page', () => {
  const sentence = 'This exact sentence appears on both pages of the file.';
  const pages = [{ page_number: 1, text: sentence }, { page_number: 2, text: `${sentence} Another line follows it here.` }];
  const result = locateTextEvidence(pages, { page: 2, pageEnd: 2, contextText: '[page 1–2] x' }, null, sentence);
  assert.equal(result.kind, 'page');
  // Without the chunk's own range (Quote Finder, saved quotes, deep links) the
  // whole document is the uniqueness scope: page 2 alone must not make it unique.
  assert.equal(locateTextEvidence(pages, { page: 2, pageEnd: 2 }, null, sentence).kind, 'page');
});

test('Codex r1 #1: a chunk sentence repeated on another page is not marked on the cited page', () => {
  const sentence = 'This exact warning appears in both sections of the policy.';
  const pages = [
    { page_number: 1, text: `Section one opens here.\n${sentence}` },
    { page_number: 2, text: `Section two opens here.\n${sentence}` },
  ];
  const result = locateTextEvidence(pages, { page: 2, pageEnd: 2 }, sentence, sentence);
  assert.equal(result.kind, 'page');
  assert.deepEqual(result.ranges, []);
});

test('a repeated sentence inside a located chunk is left unmarked; the rest of the chunk still marks', () => {
  const repeated = 'All analyses followed the intention-to-treat principle.';
  const p2 = `The primary outcome was the change in blood pressure. ${repeated} Secondary outcomes included adherence and adverse events.`;
  const pages = [{ page_number: 1, text: `The trial enrolled 412 adults. ${repeated}` }, { page_number: 2, text: p2 }];
  const result = locateTextEvidence(pages, { page: 2, pageEnd: 2 }, p2, repeated);
  assert.equal(result.kind, 'region', 'the repeated focus is not emphasised');
  assert.deepEqual(marked(pages, result).map(r => r.text), [
    'The primary outcome was the change in blood pressure.',
    'Secondary outcomes included adherence and adverse events.',
  ]);
});

test('an out-of-order coincidence is dropped, keeping the chunk order', () => {
  const text = 'Second sentence of the chunk sits first here. Filler text between them stays. First sentence of the chunk sits last here. Third sentence closes the chunk on this page.';
  const pages = [{ page_number: 1, text }];
  const chunk = 'First sentence of the chunk sits last here. Second sentence of the chunk sits first here. Third sentence closes the chunk on this page.';
  const result = locateTextEvidence(pages, cite(1), chunk, null);
  assert.equal(result.kind, 'region');
  assert.deepEqual(marked(pages, result).map(r => r.text), ['First sentence of the chunk sits last here. Third sentence closes the chunk on this page.']);
});

test('a chunk mostly absent from its pages marks nothing, focus included', () => {
  // Two boilerplate lines are unique on the page, but the chunk is elsewhere.
  const text = 'participant API as FastAPI\nparticipant Q as Qdrant service\nAn unrelated paragraph about deployment follows here.';
  const pages = [{ page_number: 4, text }];
  const chunk = [
    'participant API as FastAPI',
    'participant Q as Qdrant service',
    'API->>Q: search the vectors for the question embedding',
    'Q-->>API: the top ranked chunks with their scores',
    'API->>API: rerank, build the prompt and stream the answer',
    'Note over API: citations are verified before the done event',
  ].join('\n');
  const result = locateTextEvidence(pages, cite(4), chunk, 'participant Q as Qdrant service');
  assert.equal(result.kind, 'page');
  assert.deepEqual(result.ranges, []);
});

test('focus without chunk text (Quote Finder, saved quote) is exact only when unique', () => {
  const pages = [{ page_number: 4, text: DOCX_PAGE }];
  const quote = 'The chair asked for a revised forecast by June.';
  const result = locateTextEvidence(pages, { page: 4, pageEnd: 4, focusSnippet: quote }, null);
  assert.equal(result.kind, 'exact');
  assert.deepEqual(marked(pages, result).map(r => r.text), [quote]);
});

test('CJK: sentences without spaces match, and a glued title is split off', () => {
  const text = '本研究分析了三年的销售数据。结果显示，线上渠道增长最快。\n线下门店保持稳定。';
  const pages = [{ page_number: 1, text }];
  const chunk = chunkOf(['研究概述', ...bodyUnits(text)]);
  assert.ok(chunk.startsWith('研究概述本研究'), 'no space is inserted beside CJK');
  const result = locateTextEvidence(pages, cite(1), chunk, '结果显示，线上渠道增长最快。');
  assert.equal(result.kind, 'exact');
  assert.equal(marked(pages, result).find(r => r.emphasis).text, '结果显示，线上渠道增长最快。');
  assert.ok(!marked(pages, result).some(r => r.text.includes('研究概述')));
});

test('Codex r1 #4: a short CJK focus inside a longer run is not marked on its own', () => {
  const pages = [{ page_number: 1, text: '本合同有效期限届满后自动续约，除非双方提前书面终止。' }];
  const result = locateTextEvidence(pages, cite(1), null, '合同有效期限');
  assert.equal(result.kind, 'page');
  assert.deepEqual(result.ranges, []);
  // A saved quote is its own chunk text: the same fragment is still refused.
  assert.equal(locateTextEvidence(pages, cite(1), '合同有效期限', '合同有效期限').kind, 'page');
  // Thai is written without spaces between words as well.
  const thai = [{ page_number: 1, text: 'สัญญานี้มีผลบังคับใช้ทันที หลังจากลงนามแล้ว' }];
  assert.equal(locateTextEvidence(thai, cite(1), null, 'ญญานี้มีผลบังคับ').kind, 'page');
});

test('Codex r2 #1: a mixed Latin and CJK focus inside a longer run is not marked on its own', () => {
  const cases = [
    ['本AI合同有效期限。', 'AI合同有效期限'], // starts in Latin, Han before it
    ['前文AI契約有効期限。', 'AI契約有効期限'], // Kana/Han before a Latin start
    ['本合同有效期限AI版本已签署。', '本合同有效期限AI'], // ends in Latin, Han after it
    ['依据第5条规定执行。', '据第5条规定'], // a Han start with Han before it
  ];
  for (const [text, focus] of cases) {
    const result = locateTextEvidence([{ page_number: 1, text }], cite(1), null, focus);
    assert.equal(result.kind, 'page', focus);
    assert.deepEqual(result.ranges, [], focus);
  }
  // Bounded by punctuation, the same focus is exact.
  const pages = [{ page_number: 1, text: '根据「AI合同有效期限」条款。' }];
  const result = locateTextEvidence(pages, cite(1), null, 'AI合同有效期限');
  assert.equal(result.kind, 'exact');
  assert.deepEqual(marked(pages, result).map(r => r.text), ['AI合同有效期限']);
});

test('a CJK focus bounded by punctuation or a page edge is exact on its own', () => {
  const text = '第一条　总则。\n本合同有效期限届满后自动续约，除非双方提前书面终止。\n第二条　费用';
  const pages = [{ page_number: 1, text }];
  for (const focus of ['本合同有效期限届满后自动续约，', '除非双方提前书面终止。', '第二条　费用']) {
    const result = locateTextEvidence(pages, cite(1), null, focus);
    assert.equal(result.kind, 'exact', focus);
    assert.deepEqual(marked(pages, result).map(r => r.text), [focus]);
  }
  const thai = [{ page_number: 1, text: 'สัญญานี้มีผลบังคับใช้ทันที หลังจากลงนามแล้ว' }];
  assert.equal(locateTextEvidence(thai, cite(1), null, 'หลังจากลงนามแล้ว').kind, 'exact');
});

test('Arabic: right-to-left text matches as stored', () => {
  const text = 'يتكون النموذج من ست طبقات متطابقة. تم تدريب النموذج لمدة ثلاثة أيام ونصف.';
  const pages = [{ page_number: 1, text }];
  const result = locateTextEvidence(pages, cite(1), chunkOf(bodyUnits(text)), 'تم تدريب النموذج لمدة ثلاثة أيام ونصف.');
  assert.equal(result.kind, 'exact');
  assert.equal(marked(pages, result).find(r => r.emphasis).text, 'تم تدريب النموذج لمدة ثلاثة أيام ونصف.');
});

test('missing pages and empty input fall back to page', () => {
  assert.equal(locateTextEvidence([], cite(1), 'Anything at all here.', null).kind, 'page');
  assert.equal(locateTextEvidence([{ page_number: 1, text: DOCX_PAGE }], cite(9), chunkOf(bodyUnits(DOCX_PAGE)), null).kind, 'page');
  assert.equal(locateTextEvidence([{ page_number: 1, text: DOCX_PAGE }], cite(1), null, null).kind, 'page');
});
