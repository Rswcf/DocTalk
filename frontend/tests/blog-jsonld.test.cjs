const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');

function loadTs(relPath, stubs = {}) {
  const filename = path.resolve(__dirname, relPath);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const realRequire = mod.require.bind(mod);
  mod.require = (request) => (request in stubs ? stubs[request] : realRequire(request));
  mod._compile(compiled, filename);
  return mod.exports;
}

const headings = loadTs('../src/lib/blogHeadings.ts');
const schema = loadTs('../src/lib/blogSchema.ts', { './blogHeadings': headings });
const BLOG = path.resolve(__dirname, '../content/blog');
const posts = fs.readdirSync(BLOG).filter((f) => f.endsWith('.md')).map((f) => {
  const raw = fs.readFileSync(path.join(BLOG, f), 'utf8');
  const [, front, body] = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  return { slug: f.replace(/\.md$/, ''), category: (front.match(/^category:\s*"?([^"\n]+)"?/m) || [])[1], body };
});

test('FAQ pairs come from the "## Frequently Asked Questions" section only', () => {
  const md = [
    '## Intro', 'Text.', '### Not a FAQ', 'Ignore me.',
    '## Frequently Asked Questions',
    '### Is it **free**?', 'Yes — see [pricing](/pricing). Use `utm_source` and utm_medium as-is.',
    '', 'Second paragraph with *emphasis* and _underscored_ text.',
    '### Empty?', '',
    '## Final Thoughts', '### Not a FAQ either', 'Nope.',
  ].join('\n');
  assert.deepEqual(schema.extractFaq(md), [{
    question: 'Is it free?',
    answer: 'Yes — see pricing. Use utm_source and utm_medium as-is. Second paragraph with emphasis and underscored text.',
  }]);
});

test('ranked items take the number and the name before the dash, with the page anchor', () => {
  const md = [
    '## The 3 Best Tools',
    '### 1. DocTalk — Best for Verification', 'x',
    '### 2. [ChatPDF](https://chatpdf.com) — Simplest PDF Chat', 'x',
    '### 3. Gemini Notebook (formerly NotebookLM) — Best Free Option', 'x',
    '## Comparison Table', '### 4. Not ranked', 'x',
  ].join('\n');
  const items = schema.extractRankedItems(md);
  assert.deepEqual(items.map((i) => [i.position, i.name]), [
    [1, 'DocTalk'], [2, 'ChatPDF'], [3, 'Gemini Notebook (formerly NotebookLM)'],
  ]);
  // Anchors are the ids the post page renders for those headings.
  const ids = [...headings.extractHeadingIdsByOffset(md).values()];
  for (const item of items) assert.ok(ids.includes(item.anchor), item.anchor);
});

test('jsonLdString cannot close the script tag', () => {
  assert.equal(schema.jsonLdString({ a: '</script><b>' }).includes('<'), false);
});

test('every real post with an FAQ section yields complete question/answer pairs', () => {
  let withFaq = 0;
  for (const post of posts) {
    if (!/^##\s+(Frequently Asked Questions|FAQs?)\s*$/im.test(post.body)) continue;
    withFaq += 1;
    const faq = schema.extractFaq(post.body);
    const asked = (post.body.split(/^##\s+(?:Frequently Asked Questions|FAQs?)\s*$/im)[1].split(/^##\s/m)[0].match(/^###\s/gm) || []).length;
    assert.equal(faq.length, asked, `${post.slug}: ${faq.length} of ${asked} questions extracted`);
    for (const { question, answer } of faq) {
      assert.ok(question.length > 5 && !/[*`[\]]/.test(question), `${post.slug}: bad question "${question}"`);
      assert.ok(answer.length > 20 && !/\]\(|\*\*|`/.test(answer), `${post.slug}: markdown left in answer to "${question}"`);
    }
  }
  assert.ok(withFaq >= 10, `only ${withFaq} posts have an FAQ section`);
});

test('the ranked comparison posts list every numbered pick', () => {
  for (const slug of ['chatpdf-alternatives-2026', 'best-ai-pdf-tools-2026']) {
    const post = posts.find((p) => p.slug === slug);
    assert.equal(post.category, 'comparisons');
    const items = schema.extractRankedItems(post.body);
    assert.equal(items.length, 7, `${slug}: ${items.length} ranked items`);
    assert.deepEqual(items.map((i) => i.position), [1, 2, 3, 4, 5, 6, 7]);
    assert.equal(items[0].name, 'DocTalk');
  }
});
