const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Opt-in "beyond the document" answers (design: .collab/reviews/2026-09-22-needs-analysis/07-scope-rule-design-fable.md
// §2). The user asks for one by name, the answer is labelled, and nothing in it is a citation. The backend enforces
// the same boundary (backend/tests/test_chat_scope.py); these tests hold the client to it.

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
const KEYS = {
  action: 'chat.beyondDocument.action',
  actionHint: 'chat.beyondDocument.actionHint',
  label: 'chat.beyondDocument.label',
  userTag: 'chat.beyondDocument.userTag',
  signIn: 'chat.beyondDocument.signIn',
};

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

async function withFetch(fake, run) {
  const original = global.fetch;
  global.fetch = fake;
  try {
    return await run();
  } finally {
    global.fetch = original;
  }
}

function sseBody(text) {
  let sent = false;
  return {
    getReader: () => ({
      read: async () => {
        if (sent) return { done: true, value: undefined };
        sent = true;
        return { done: false, value: new TextEncoder().encode(text) };
      },
      cancel: async () => {},
    }),
  };
}

const noop = () => {};

// ── Transport ──

test('chatStream asks for a beyond-document answer only when told to', async () => {
  const api = load('lib/api.ts');
  const sse = load('lib/sse.ts', { './api': api });
  const bodies = [];
  await withFetch(async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return { ok: false, status: 500, body: null, text: async () => '' };
  }, async () => {
    const send = (scope) => sse.chatStream(
      's1', 'Who wrote this novel?', noop, noop, noop, noop, undefined, 'quick', 'en', undefined, null,
      undefined, undefined, undefined, undefined, undefined, scope,
    );
    await send('beyond_document');
    await send(undefined);
    await send('document');
  });
  assert.equal(bodies[0].answer_scope, 'beyond_document');
  assert.ok(!('answer_scope' in bodies[1]));
  assert.ok(!('answer_scope' in bodies[2]), 'the grounded answer is the absence of the field, never a value');
});

test('the done event hands the answer scope to the client, and only the two known values', async () => {
  const api = load('lib/api.ts');
  const sse = load('lib/sse.ts', { './api': api });
  const scopeOf = async (raw) => {
    let done;
    const frame = `event: done\ndata: ${JSON.stringify({ message_id: 'm1', ...raw })}\n\n`;
    await withFetch(async () => ({ ok: true, status: 200, body: sseBody(frame) }), () => sse.chatStream(
      's1', 'q', noop, noop, noop, (d) => { done = d; },
    ));
    return done.answer_scope;
  };
  assert.equal(await scopeOf({ answer_scope: 'beyond_document' }), 'beyond_document');
  assert.equal(await scopeOf({ answer_scope: 'document' }), 'document');
  assert.equal(await scopeOf({ answer_scope: 'web' }), undefined);
  assert.equal(await scopeOf({}), undefined);
});

test('a reload keeps the label, the tag and the Continue button', async () => {
  const api = load('lib/api.ts');
  const at = '2026-09-22T10:00:00Z';
  const { messages } = await withFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      messages: [
        { id: 'u1', role: 'user', content: 'Who wrote this novel?', metadata_json: { answer_scope: 'beyond_document' }, created_at: at },
        { id: 'a1', role: 'assistant', content: 'A writer.', citations: null, metadata_json: { answer_scope: 'beyond_document', truncated: true }, created_at: at },
        { id: 'u2', role: 'user', content: 'What happens in chapter 2?', metadata_json: {}, created_at: at },
        { id: 'a2', role: 'assistant', content: 'The keeper leaves.', citations: [], metadata_json: { answer_scope: 'web', truncated: 'yes' }, created_at: at },
      ],
    }),
  }), () => api.getMessages('s1'));
  assert.equal(messages[0].answerScope, 'beyond_document');
  assert.equal(messages[1].answerScope, 'beyond_document');
  assert.equal(messages[1].isTruncated, true);
  assert.notEqual(messages[2].answerScope, 'beyond_document');
  assert.notEqual(messages[3].answerScope, 'beyond_document', 'an unknown scope is read as the document');
  assert.notEqual(messages[3].isTruncated, true, 'only a literal true restores the Continue button');
});

// ── Send path ──

test('sendMessage tags the question and the placeholder, so the label shows from the first token', () => {
  const code = stripComments(read('lib/useChatStream.ts'));
  const fn = slice(code, 'const sendMessage = useCallback(async', 'const bumpDemoUsageForRegenOrContinue');
  assert.match(fn, /async \(text: string, options\?: \{ answerScope\?: 'beyond_document' \}\)/);
  assert.match(slice(fn, 'const userMsg: Message = {', '};'), /\.\.\.\(answerScope \? \{ answerScope \} : \{\}\)/);
  assert.match(slice(fn, 'const asstMsg: Message = {', '};'), /\.\.\.\(answerScope \? \{ answerScope \} : \{\}\)/);
  assert.match(fn, /trackEvent\('chat_message_sent', \{[^}]*answer_scope: answerScope \?\? 'document'/);
  assert.match(fn, /streamAssistantResponse\(text, undefined, undefined, answerScope\)/);
  const stream = slice(code, 'const streamAssistantResponse = useCallback', 'const sendMessage = useCallback');
  assert.match(stream, /retry,\s*answerScope,\s*\);/);
});

test('regenerating a beyond answer asks for beyond again; a grounded one stays grounded', () => {
  const code = stripComments(read('lib/useChatStream.ts'));
  const fn = slice(code, 'const regenerateLastResponse = useCallback', 'const continueGenerating = useCallback');
  assert.match(fn, /const answerScope = msgs\[lastUserIdx\]\.answerScope === 'beyond_document' \? 'beyond_document' : undefined;/);
  assert.match(fn, /role: 'assistant', text: '', citations: \[\], createdAt: Date\.now\(\), \.\.\.\(answerScope \? \{ answerScope \} : \{\}\)/);
  assert.match(fn, /\}, retry, answerScope\);/);
});

test('the done handler records the scope and never offers Quote Finder on a beyond answer', () => {
  const code = stripComments(read('lib/useChatStream.ts'));
  const fn = slice(code, 'const handleStreamDone = useCallback', 'const handleAnswerRepaired');
  assert.match(fn, /answerScope: d\.answer_scope \?\? 'document'/);
  assert.match(fn, /quoteFinderHint: d\.answer_scope === 'beyond_document' \? false : d\.quote_finder_hint === true/);
  assert.match(fn, /trackEvent\('chat_message_completed', \{[^}]*answer_scope: d\.answer_scope \?\? 'document'/);
});

test('askBeyondDocument re-asks the last question with the scope, and never for an anonymous visitor', () => {
  const code = stripComments(read('lib/useChatStream.ts'));
  const fn = slice(code, 'const askBeyondDocument = useCallback', 'const stopStreaming = useCallback');
  const refuse = fn.indexOf('if (maxUserMessages != null)');
  assert.ok(refuse !== -1, 'the anonymous demo guard is missing');
  assert.match(fn.slice(refuse), /^if \(maxUserMessages != null\) \{\s*onRequireAuth\(\);\s*return false;\s*\}/);
  assert.ok(refuse < fn.indexOf("trackEvent('beyond_document_clicked'"), 'no private event before the anonymous guard');
  assert.ok(refuse < fn.indexOf('sendMessage('), 'no request before the anonymous guard');
  assert.match(fn, /last\?\.role !== 'assistant' \|\| last\.isError \|\| last\.answerScope === 'beyond_document'/);
  assert.match(fn, /trackEvent\('beyond_document_clicked', \{ source: 'answer_action', mode: selectedMode, document_kind: useDocTalkStore\.getState\(\)\.isDemo \? 'demo' : 'own' \}\)/);
  assert.match(fn, /return sendMessage\(question\.text, \{ answerScope: 'beyond_document' \}\);/);
  assert.match(slice(code, 'return useMemo(() => ({', '}), ['), /askBeyondDocument,/);
});

test('a refused anonymous request reads as a sign-in, not a failure', () => {
  const billing = load('lib/billingLinks.ts');
  const { errorCopy } = load('lib/errorCopy.ts', { './billingLinks': billing });
  const tOr = (_key, fallback) => fallback;
  const copy = errorCopy({ code: 'BEYOND_DOCUMENT_REQUIRES_SIGN_IN', status: 403 }, (k) => k, tOr);
  assert.equal(copy.cta?.href, '/auth');
  assert.equal(copy.severity, 'info');
  assert.match(copy.body, /sign in/i);
});

// ── Rendering ──

test('the chat panel offers the action on the last answer only, and anonymous visitors get sign-in first', () => {
  const code = stripComments(read('components/Chat/ChatPanel.tsx'));
  assert.match(code, /const isAnonymousDemo = maxUserMessages != null;/);
  const handler = slice(code, 'const handleAskBeyondDocument = useCallback', '}, [');
  assert.match(handler, /if \(isAnonymousDemo\) \{\s*openAuthModal\(\{ source: 'beyond_document' \}\);\s*return;\s*\}/);
  assert.doesNotMatch(handler.slice(0, handler.indexOf('return;')), /trackEvent|askBeyondDocument\(/);
  assert.match(handler, /void askBeyondDocument\(\);/);
  assert.match(code, /onAskBeyondDocument=\{isLastAssistantMsg \? handleAskBeyondDocument : undefined\}/);
  assert.match(code, /isAnonBeyondDocument=\{isAnonymousDemo\}/);
  // The row never builds citation cards for a beyond answer.
  assert.match(code, /if \(message\.role !== 'assistant' \|\| message\.answerScope === 'beyond_document'\) return undefined;/);
});

test('the action renders only on the last finished grounded answer', () => {
  const code = stripComments(read('components/Chat/MessageBubble.tsx'));
  assert.match(code, /const isBeyond = message\.answerScope === 'beyond_document';/);
  assert.match(code, /\{isAssistant && isLastAssistant && onAskBeyondDocument && !isStreaming && !isError && !isBeyond && !message\.artifacts\?\.length && !message\.toolStatus && message\.text && \(/);
  const button = slice(code, 'onClick={onAskBeyondDocument}', '</button>');
  assert.match(button, new RegExp(`isAnonBeyondDocument\\s*\\? tOr\\('${KEYS.signIn}'`));
  assert.match(button, new RegExp(`tOr\\('${KEYS.action}'`));
  assert.match(button, new RegExp(`title=\\{tOr\\('${KEYS.actionHint}'`));
});

test('a beyond answer carries its label and none of the citation surfaces', () => {
  const code = stripComments(read('components/Chat/MessageBubble.tsx'));
  assert.match(code, /const displayCitations = useMemo\(\(\) => \(isBeyond \? \[\] : uniqueCitationIndexes\(message\.citations \|\| \[\]\)\), \[isBeyond, message\.citations\]\);/);
  assert.match(code, new RegExp(`\\{isAssistant && !isError && isBeyond && \\([\\s\\S]{0,400}tOr\\('${KEYS.label}'`));
  assert.match(code, /\{isAssistant && !isBeyond && \(\s*<SourcesStrip/);
  assert.match(code, /\{isAssistant && !isStreaming && !isBeyond && message\.quoteFinderHint && message\.quoteFinderTopic && onTryQuoteFinder && \(/);
  // The label sits above the pending indicator too, so it is there before the first token.
  const label = code.indexOf(`tOr('${KEYS.label}'`);
  assert.ok(label !== -1 && label < code.indexOf("t('chat.searching')"), 'the label must render before the streaming placeholder');
});

test('the re-asked question carries its tag', () => {
  const code = stripComments(read('components/Chat/MessageBubble.tsx'));
  assert.match(code, new RegExp(`\\{isBeyond && \\([\\s\\S]{0,300}tOr\\('${KEYS.userTag}'`));
});

// ── Copy and palette ──

test('the five strings exist in English, and each fallback in the components matches it', () => {
  const en = JSON.parse(read('i18n/locales/en.json'));
  for (const key of Object.values(KEYS)) {
    assert.ok(typeof en[key] === 'string' && en[key].trim(), `en: ${key} is missing`);
  }
  const code = read('components/Chat/MessageBubble.tsx');
  for (const key of Object.values(KEYS)) {
    const m = code.match(new RegExp(`tOr\\('${key.replace(/\./g, '\\.')}', '((?:[^'\\\\]|\\\\.)*)'\\)`));
    assert.ok(m, `${key} is not rendered with a tOr fallback`);
    assert.equal(m[1].replace(/\\'/g, "'"), en[key], `${key}: the fallback drifted from en.json`);
  }
  // No promise of web access; "not verified against the document" is not "the document is wrong".
  assert.doesNotMatch(en[KEYS.action] + en[KEYS.actionHint] + en[KEYS.label], /\b(web|internet|online|search)\b/i);
  assert.match(en[KEYS.label], /not verified/i);
});

test('the new controls follow the app palette rules', () => {
  const code = read('components/Chat/MessageBubble.tsx');
  const blocks = [
    slice(code, '{isAssistant && isLastAssistant && onAskBeyondDocument', '</button>'),
    slice(code, '{isAssistant && !isError && isBeyond && (', '</p>'),
    slice(code, '{isBeyond && (', '</span>'),
  ];
  for (const block of blocks) {
    assert.doesNotMatch(block, /\b(gray|indigo|violet|purple)-\d/);
    assert.doesNotMatch(block, /transition-all/);
    assert.doesNotMatch(block, /text-\[(?:[0-9]|1[01])px\]/);
    for (const [token] of block.matchAll(/[\w:-]*(?:bg|text|border)-white\/\d+/g)) {
      assert.ok(token.startsWith('dark:'), `light-surface ${token} needs a light-mode value`);
    }
  }
});

// ── Sharing (slice 2): a shared beyond answer must never look like a cited one ──

test('the share preview shows the label, so what gets approved is what goes public', () => {
  const api = stripComments(read('lib/api.ts'));
  const previewType = slice(api, 'export interface AnswerSharePreview', 'export async function getAnswerSharePreview');
  assert.match(previewType, /answer_scope\?: 'beyond_document';/);
  const dialog = stripComments(read('components/Chat/ShareAnswerDialog.tsx'));
  assert.match(dialog, new RegExp(`\\{message\\.answer_scope === 'beyond_document' && \\([\\s\\S]{0,300}tOr\\('${KEYS.label}'`));
});

test('the public shared page labels a beyond answer and tags the question it re-asked', () => {
  const page = stripComments(read('app/shared/[token]/page.tsx'));
  assert.match(page, /answer_scope\?: 'beyond_document';/);
  const en = JSON.parse(read('i18n/locales/en.json'));
  // The public page is server-rendered English; its copy must not drift from the in-app strings.
  const label = page.indexOf(en[KEYS.label]);
  const tag = page.indexOf(en[KEYS.userTag]);
  assert.ok(label !== -1, 'the public page does not show the label');
  assert.ok(tag !== -1, 'the public page does not show the tag');
  assert.match(page.slice(Math.max(0, label - 400), label), /msg\.role === 'assistant' && msg\.answer_scope === 'beyond_document'/);
  assert.match(page.slice(Math.max(0, tag - 400), tag), /msg\.role === 'user' && msg\.answer_scope === 'beyond_document'/);
  // Night marketing surface: the label uses the muted ink, never the citation amber or the verified olive.
  assert.doesNotMatch(page.slice(Math.max(0, label - 400), label), /--ed-(evidence|olive|verified)/);
});
