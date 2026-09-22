const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Academic long-tail on /use-cases/students (plan .collab/plans/2026-09-22-next-strategy.md §2.2, owner-approved
// 2026-09-22 including the zh/es search titles): deepen the one academic page instead of adding a sibling, and
// give the cohort that retains (thesis writers) the verified-quote story in every locale.

const src = path.resolve(__dirname, '../src');
const LOCALES = ['en', 'zh', 'ja', 'ko', 'es', 'de', 'fr', 'pt', 'it', 'ar', 'hi'];
const messages = Object.fromEntries(
  LOCALES.map((l) => [l, JSON.parse(fs.readFileSync(path.join(src, 'i18n/locales', `${l}.json`), 'utf8'))]),
);
const SECTION = ['title', 'p1', 'p2', 'p3'].map((k) => `useCasesStudents.verifiedQuotes.${k}`);

test('the verified-quotes section renders on the students page and exists in all eleven locales', () => {
  const content = fs.readFileSync(path.join(src, 'app/use-cases/students/StudentsContent.tsx'), 'utf8');
  for (const key of SECTION) assert.ok(content.includes(`'${key}'`), `StudentsContent does not render ${key}`);
  for (const locale of LOCALES) {
    for (const key of SECTION) assert.ok(messages[locale][key]?.trim(), `${locale}: ${key} is missing`);
  }
});

test('the verified-quotes copy names the feature as the product does and never promises a word-for-word match', () => {
  // Trust copy is per kind (.claude/rules/frontend.md, Quote Finder UI): a word-for-word claim belongs only to
  // page_text results, so marketing copy about every result must not make it anywhere on this page.
  for (const locale of LOCALES) {
    const page = Object.entries(messages[locale]).filter(([key]) => key.startsWith('useCasesStudents.'));
    const text = SECTION.map((key) => messages[locale][key]).join(' ');
    assert.doesNotMatch(
      page.map(([, value]) => value).join(' '),
      /word-for-word|verbatim|逐字|一字不差|逐語|一字一句|そのまま|그대로|축어|wörtlich|Wort für Wort|mot pour mot|mot à mot|textuellement|palabra por palabra|palavra por palavra|parola per parola|حرفي|शब्दशः|हूबहू/i,
      `${locale}: unconditional verbatim claim`,
    );
    assert.ok(text.includes(messages[locale]['quoteFinder.toolbarLabel']), `${locale}: does not name the feature as the UI does`);
  }
});

test('the zh and es search titles carry the academic long-tail terms', () => {
  const zh = messages.zh;
  const es = messages.es;
  assert.match(zh['useCasesStudents.metaTitle'], /论文\s*AI/);
  for (const term of ['读论文', '文献阅读']) {
    assert.ok(`${zh['useCasesStudents.metaTitle']} ${zh['useCasesStudents.metaDescription']}`.includes(term), `zh meta lacks ${term}`);
  }
  assert.match(es['useCasesStudents.metaTitle'], /IA para investigar gratis/i);
});

test('the citations feature page links to the students page in the reader\'s locale', () => {
  // Its use-case cards passed a bare path, so /zh/features/citations sent readers to the English students page.
  const content = fs.readFileSync(path.join(src, 'app/features/citations/CitationsContent.tsx'), 'utf8');
  const hrefs = [...content.matchAll(/\bhref:\s*([^,\n}]+)/g)].map((m) => m[1].trim());
  assert.ok(hrefs.length > 0);
  for (const value of hrefs) assert.match(value, /^href\(/, `link bypasses the locale helper: ${value}`);
});

test('the ranking academic blog post links to the students page', () => {
  const post = fs.readFileSync(path.resolve(__dirname, '../content/blog/ai-research-paper-summarizer.md'), 'utf8');
  assert.match(post, /\]\(\/use-cases\/students\)/);
});
