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
