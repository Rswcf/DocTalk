const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
function load(relative) {
  const file = path.resolve(__dirname, '../src', relative);
  const m = new Module(file, module);
  m.filename = file;
  m.paths = Module._nodeModulePaths(path.dirname(file));
  m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText, file);
  return m.exports;
}
const { contentLocaleFromPath } = load('i18n/routing.ts');
const { getSentences, getWords } = load('lib/textMetrics.ts');
test('fixed marketing content follows routes, app views retain preference', () => {
  for (const [route, locale] of [['/features','en'],['/pricing','en'],['/trust/','en'],['/ar/features','ar'],['/de','de'],['/zh/demo','zh'],['/',null],['/demo',null],['/d/test',null],['/billing',null]]) assert.equal(contentLocaleFromPath(route), locale, route);
});
test('sentences handle Unicode punctuation, abbreviations, decimals and trailing fragments', () => {
  for (const [text, count] of [['',0],[' \n ',0],['...!?',0],['你好世界。今天很好！',2],['Dr. Smith paid 3.14 dollars. Next sentence.',2],['Done. Unfinished thought',2],['你好！Hello world. 再见？',3],['مرحباً بالعالم! كيف الحال؟',2],['One... Two?!',2]]) assert.equal(getSentences(text), count, text);
});
test('word segmentation counts words, not Han characters or punctuation', () => {
  assert.equal(getWords('hello, world!').length, 2);
  assert.deepEqual(getWords('你好世界'), ['你好','世界']);
  assert.equal(getWords('你好 world。').length, 2);
});
test('older browser fallback counts CJK sentence boundaries', () => {
  const original = Intl.Segmenter;
  try { Intl.Segmenter = undefined; assert.equal(getSentences('你好。下一句！'), 2); assert.equal(getSentences('Costs 3.14. Next.'), 2); }
  finally { Intl.Segmenter = original; }
});
