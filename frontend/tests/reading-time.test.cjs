const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const translations = require('../src/i18n/locales/en.json');
function load(file, replacements = {}) {
  const m = new Module(file, module);
  m.filename = file;
  m.paths = Module._nodeModulePaths(path.dirname(file));
  const base = m.require.bind(m);
  m.require = (id) => id in replacements ? replacements[id] : base(id);
  m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.React, esModuleInterop: true,
  }}).outputText, file);
  return m.exports;
}
const metrics = load(path.resolve(__dirname, '../src/lib/textMetrics.ts'));
function render(text) {
  const wrapper = ({ children }) => React.createElement('div', null, children);
  const replacements = {
    react: { ...React, useState: () => [text, () => {}] },
    'next/link': wrapper,
    '../../../i18n': { useLocale: () => ({ t: (key, values = {}) =>
      Object.entries(values).reduce((s, [k,v]) => s.replaceAll('{'+k+'}', String(v)), translations[key] || key) }) },
    '../../../lib/textMetrics': metrics,
  };
  for (const name of ['MarketingShell','EdPageHero','EdSection','EdProse','EdRelatedLinks','EdCtaBanner']) {
    replacements['../../../components/marketing/' + name] = wrapper;
  }
  const Component = load(path.resolve(__dirname, '../src/app/tools/reading-time/ReadingTimeClient.tsx'), replacements).default;
  return renderToStaticMarkup(React.createElement(Component));
}
test('rendered Reading Time uses shared segmentation for continuous Chinese and mixed text', () => {
  for (const text of ['你好世界。你好文档！', '你好 world。', '这是连续中文文本没有空格但应该按词语计算阅读时间'.repeat(50)]) {
    const words = metrics.getWords(text).length;
    assert.ok(words > 1);
    const output = render(text);
    assert.match(output, new RegExp('>'+words.toLocaleString()+'<'));
    const seconds = Math.ceil(words / 150 * 60);
    if (text.length > 1000) assert.ok(seconds > 1);
    assert.ok(output.includes(seconds < 60 ? seconds+' sec' : Math.floor(seconds/60)+' min'));
  }
});
test('rendered English formulas and empty/cleared states remain correct', () => {
  const english = render(Array(250).fill('word').join(' '));
  assert.ok(english.includes('>250<'));
  assert.ok(english.includes('1 min 40 sec'));
  for (const text of ['', ' \n ', '…！？']) {
    const empty = render(text);
    assert.ok(empty.includes('>0<'));
    assert.ok(empty.includes('--'));
  }
});
