const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// After the answer text has streamed, the stream stays open while citations are checked (and, if needed, the
// answer is repaired) and refined. The backend reports each step with a stable code; the client used to hide every
// status once text existed, so users watched a blinking cursor for up to 20 s and then saw the text swapped.

const src = path.resolve(__dirname, '../src');
const read = (rel) => fs.readFileSync(path.join(src, rel), 'utf8');
const stripComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const slice = (code, start, end) => {
  const from = code.indexOf(start);
  assert.ok(from !== -1, `missing: ${start}`);
  const to = code.indexOf(end, from + start.length);
  assert.ok(to !== -1, `missing after ${start}: ${end}`);
  return code.slice(from, to);
};
const STATUS_KEYS = ['chat.status.checkingCitations', 'chat.status.refiningCitations', 'chat.status.summarizingSections'];

function load(rel, stubs = {}) {
  const filename = path.join(src, rel);
  const loaded = new Module(filename, module);
  loaded.require = (id) => (id in stubs ? stubs[id] : require(id));
  const out = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  loaded._compile(out, filename);
  return loaded.exports;
}

test('the status event keeps its code, and only a string code', async () => {
  const api = load('lib/api.ts');
  const sse = load('lib/sse.ts', { './api': api });
  const seen = [];
  const frames = [
    'event: tool_status\ndata: {"message":"Checking citation support...","code":"checking_citations"}\n\n',
    'event: tool_status\ndata: {"message":"Summarizing the document section by section…"}\n\n',
    'event: tool_status\ndata: {"message":"x","code":7}\n\n',
  ].join('');
  let sent = false;
  const body = { getReader: () => ({
    read: async () => (sent ? { done: true } : (sent = true, { done: false, value: new TextEncoder().encode(frames) })),
    cancel: async () => {},
  }) };
  const original = global.fetch;
  global.fetch = async () => ({ ok: true, status: 200, body });
  try {
    const noop = () => {};
    await sse.chatStream('s1', 'q', noop, noop, noop, noop, undefined, 'quick', 'en', undefined, null,
      undefined, (status) => seen.push(status));
  } finally {
    global.fetch = original;
  }
  assert.deepEqual(seen, [
    { message: 'Checking citation support...', code: 'checking_citations' },
    { message: 'Summarizing the document section by section…' },
    { message: 'x' },
  ]);
});

test('the first text retires an earlier status; a status set after text survives later text', () => {
  const store = load('store/index.ts', {
    '../lib/models': { DEFAULT_MODE: 'quick', isKnownMode: (value) => ['quick', 'balanced'].includes(value) },
  }).useDocTalkStore;
  const s = () => store.getState();
  s().setMessages([{ id: 'a', role: 'assistant', text: '', createdAt: 0 }]);
  s().setLastMessageToolStatus('Summarizing the document section by section…');
  s().updateLastMessage('The keeper');
  s().flushPendingText();
  assert.equal(s().messages[0].text, 'The keeper');
  assert.equal(s().messages[0].toolStatus, undefined, 'a status shown before the answer is stale once text arrives');

  s().setLastMessageToolStatus('Checking citation support…');
  s().updateLastMessage(' leaves.');
  s().flushPendingText();
  assert.equal(s().messages[0].text, 'The keeper leaves.');
  assert.equal(s().messages[0].toolStatus, 'Checking citation support…');

  // A tool action has no text at all: its status stays the content.
  s().setMessages([{ id: 't', role: 'assistant', text: '', createdAt: 0 }]);
  s().setLastMessageToolStatus('Exporting…');
  s().flushPendingText();
  assert.equal(s().messages[0].toolStatus, 'Exporting…');
});

test('both stream handlers flush the text before showing a status, in the user’s language', () => {
  const code = stripComments(read('lib/useChatStream.ts'));
  assert.match(code, /const statusText = useCallback\(\(status: \{ message: string; code\?: string \}\) =>/);
  for (const key of STATUS_KEYS) assert.match(code, new RegExp(`'${key.replace(/\./g, '\\.')}'`));
  const handlers = code.match(/\(status\) => \{ if \(active\(\)\) \{ flushPendingText\(\); setLastMessageToolStatus\(statusText\(status\)\); \} \}/g) || [];
  assert.equal(handlers.length, 2, 'chat and continue streams both use the flushing, translated handler');
  assert.doesNotMatch(code, /\(\{ message \}\) => \{ if \(active\(\)\) setLastMessageToolStatus\(message\); \}/);
});

test('the bubble shows the status under the text while the stream is still open', () => {
  const code = stripComments(read('components/Chat/MessageBubble.tsx'));
  assert.match(code, /\{isAssistant && message\.toolStatus && \(!message\.text \|\| isStreaming\) \? \(/);
  const block = slice(code, '{isAssistant && message.toolStatus && (!message.text || isStreaming) ? (', ') : null}');
  assert.match(block, /aria-live="polite"/);
  assert.match(block, /motion-reduce:animate-none/);
  assert.doesNotMatch(block, /\b(gray|indigo|violet|purple)-\d|transition-all|text-\[(?:[0-9]|1[01])px\]/);
  // Before any text, the waiting line names the step the server reported (e.g. a section-by-section summary).
  assert.match(code, /\{message\.toolStatus \? <span>\{message\.toolStatus\}<\/span> : !isBeyond && <span>\{t\('chat\.searching'\)\}<\/span>\}/);
});

test('the three status strings exist in all eleven locales', () => {
  for (const locale of ['en', 'zh', 'ja', 'ko', 'es', 'de', 'fr', 'pt', 'it', 'ar', 'hi']) {
    const messages = JSON.parse(read(`i18n/locales/${locale}.json`));
    for (const key of STATUS_KEYS) {
      assert.ok(typeof messages[key] === 'string' && messages[key].trim(), `${locale}: ${key} is missing`);
    }
  }
  const en = JSON.parse(read('i18n/locales/en.json'));
  const code = read('lib/useChatStream.ts');
  for (const key of STATUS_KEYS) {
    const m = code.match(new RegExp(`'${key.replace(/\./g, '\\.')}', '((?:[^'\\\\]|\\\\.)*)'`));
    assert.ok(m, `${key} has no English fallback`);
    assert.equal(m[1], en[key], `${key}: the fallback drifted from en.json`);
  }
});
