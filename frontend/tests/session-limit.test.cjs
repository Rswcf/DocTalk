const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');

function load(relativePath, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', relativePath);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const realRequire = loaded.require.bind(loaded);
  loaded.require = (request) => Object.hasOwn(mocks, request) ? mocks[request] : realRequire(request);
  loaded._compile(compiled, filename);
  return loaded.exports;
}

const messages = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/i18n/locales/en.json'), 'utf8'));
const interpolate = (text, params = {}) => Object.entries(params).reduce(
  (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)), text,
);
const t = (key, params) => interpolate(messages[key] || key, params);
const tOr = (key, fallback, params) => interpolate(messages[key] || fallback, params);
const copyModule = load('lib/errorCopy.ts', { './billingLinks': load('lib/billingLinks.ts') });
const limitError = { code: 'SESSION_LIMIT_REACHED', detail: { limit: 3 }, status: 403 };
const userMessage = { id: 'u1', role: 'user', text: 'Question', createdAt: 1 };
const assistantMessage = { id: 'a1', role: 'assistant', text: 'Welcome', createdAt: 2 };
const row = (id) => ({ session_id: id, title: id, message_count: 0, created_at: '2026-09-10', last_activity_at: '2026-09-10' });

function nodes(element) {
  if (!element || typeof element !== 'object') return [];
  if (Array.isArray(element)) return element.flatMap(nodes);
  return [element, ...nodes(element.props?.children)];
}
function textOf(element) {
  if (element == null || typeof element === 'boolean') return '';
  if (Array.isArray(element)) return element.map(textOf).join('');
  if (typeof element !== 'object') return String(element);
  return textOf(element.props?.children);
}
function button(tree, label) {
  const found = nodes(tree).find((node) => node.type === 'button' && textOf(node) === label);
  assert.ok(found, `Missing button: ${label}`);
  return found;
}

function harness({ isDemo = false, transcript = [userMessage], createResult, createError, deferCreate = false, initialSessions = [row('current'), row('older'), row('oldest')] } = {}) {
  const store = load('store/index.ts', {
    '../lib/models': { DEFAULT_MODE: 'quick', isKnownMode: () => false },
  }).useDocTalkStore;
  const state = store.getState();
  state.setDocument('doc-1');
  state.setIsDemo(isDemo);
  state.setDocumentStatus('ready');
  state.setSessions([row('current'), row('older'), row('oldest')]);
  state.setSessionId('current');
  state.setMessages(transcript);
  state.setDemoMessagesUsed(7);
  state.setDemoRestoredUserMsgCount(transcript.filter((m) => m.role === 'user').length);
  const calls = { create: [], get: [], billing: [], accounting: [], pointers: [], delete: [], events: [] };
  for (const name of ['setDemoMessagesUsed', 'setDemoRestoredUserMsgCount', 'bumpDemoAccountingEpoch']) {
    const original = store.getState()[name];
    store.setState({ [name]: (...args) => { calls.accounting.push([name, ...args]); original(...args); } });
  }
  const slots = [];
  let index = 0;
  let switchCleanup;
  const react = {
    useState(initial) {
      const current = index++;
      if (!slots[current]) slots[current] = { value: initial };
      return [slots[current].value, (next) => { slots[current].value = typeof next === 'function' ? next(slots[current].value) : next; }];
    },
    useRef(initial) {
      const current = index++;
      if (!slots[current]) slots[current] = { current: initial };
      return slots[current];
    },
    useEffect(effect, deps) {
      // Exercise the dropdown's switch cancellation lifecycle without DOM effects.
      if (!switchCleanup && deps?.includes(store.getState().endTranscriptRestore)) switchCleanup = effect();
    },
    useMemo: (fn) => fn(),
  };
  const useStore = (selector) => selector ? selector(store.getState()) : store.getState();
  useStore.getState = store.getState;
  const pendingMessages = [];
  let resolveCreate;
  const api = {
    ApiError: class ApiError extends Error {},
    listSessions: async () => ({ sessions: initialSessions }),
    createSession: async (id) => {
      calls.create.push(id);
      if (createError) throw createError;
      if (deferCreate) return new Promise((resolve) => { resolveCreate = resolve; });
      return createResult || { session_id: 'new', created_at: '2026-09-10' };
    },
    getMessages: (id) => new Promise((resolve, reject) => {
      calls.get.push(id);
      pendingMessages.push({ resolve, reject });
    }),
    deleteSession: async (id) => { calls.delete.push(id); },
  };
  const demoStorage = {
    clearDemoSession() {}, readDemoSession: () => null,
    writeDemoSession: (...args) => calls.pointers.push(args),
  };
  const Component = load('components/SessionDropdown.tsx', {
    react,
    'lucide-react': Object.fromEntries(['ChevronDown', 'Plus', 'Trash2', 'Home', 'X'].map((name) => [name, () => null])),
    'next/link': { __esModule: true, default: 'a' },
    'next/navigation': { useRouter: () => ({ push() {} }) },
    'next-auth/react': { useSession: () => ({ status: 'authenticated' }) },
    '../store': { useDocTalkStore: useStore },
    '../i18n': { useLocale: () => ({ t, tOr }) },
    '../lib/api': api,
    '../lib/errorCopy': copyModule,
    '../lib/analytics': { trackEvent: (...args) => calls.events.push(args) },
    '../lib/billing': {
      startPlanAwareBillingAction: async (args) => { calls.billing.push(args); },
      getBillingErrorMessage: () => 'Billing failed',
    },
    '../lib/useDropdownKeyboard': { useDropdownKeyboard: () => () => {} },
    '../lib/demoSessionStorage': demoStorage,
    '../lib/useUserProfile': { useUserProfile: () => ({ profile: { plan: 'free' } }) },
  }).default;
  const render = () => { index = 0; return Component(); };
  nodes(render()).find((node) => node.props?.['data-tour']).props.onClick();
  return {
    store, calls, render,
    unmount: () => switchCleanup?.(),
    startInitialRestore(documentId = 'doc-1', storage = demoStorage) {
      let cleanup;
      let sessionError = null;
      const { useChatSession } = load('lib/useChatSession.ts', {
        react: {
          useState: () => [null, (error) => { sessionError = error; }],
          useEffect: (effect) => { cleanup = effect(); },
        },
        '../store': { useDocTalkStore: useStore },
        './api': api,
        './demoSessionStorage': storage,
      });
      useChatSession(documentId);
      return { cancel: () => cleanup?.(), getError: () => sessionError };
    },
    resolveCreate: (data) => resolveCreate(data),
    resolveMessages: (data, index = 0) => pendingMessages[index].resolve(data),
    rejectMessages: (error, index = 0) => pendingMessages[index].reject(error),
  };
}

test('signed-in demo session wall renders only upload exit to existing dashboard', async () => {
  const h = harness({ isDemo: true, createError: limitError });
  await button(h.render(), t('session.newChat')).props.onClick();
  const tree = h.render();
  assert.match(textOf(tree), /The demo allows 3 conversations per sample document\. Upload your own document to keep going\./);
  const upload = nodes(tree).find((node) => node.type === 'a' && textOf(node) === 'Upload your own document');
  assert.equal(upload?.props.href, '/');
  assert.equal(upload.props.onClick, undefined, 'upload must never invoke checkout');
  assert.doesNotMatch(textOf(tree), /Free keeps|Upgrade|Delete a conversation/);
  assert.deepEqual(h.calls.billing, []);
});

test('own-document wall renders both exits and preserves plan-aware upgrade', async () => {
  const h = harness({ createError: limitError });
  await button(h.render(), t('session.newChat')).props.onClick();
  let tree = h.render();
  assert.match(textOf(tree), /Free keeps 3 open conversations per document\. Delete one to start another, or upgrade for unlimited\./);
  const upgrade = button(tree, 'Upgrade');
  await upgrade.props.onClick();
  assert.deepEqual(h.calls.billing, [{ plan: 'plus', billing: 'monthly', source: 'session_dropdown', reason: 'session_limit', currentPlan: 'free' }]);
  button(tree, 'Delete a conversation').props.onClick();
  tree = h.render();
  assert.deepEqual(h.calls.delete, [], 'affordance must request confirmation');
  await button(tree, t('common.yes')).props.onClick({ stopPropagation() {} });
  assert.deepEqual(h.calls.delete, ['older']);
  assert.equal(h.store.getState().sessions.length, 2);
  assert.equal(h.store.getState().sessionId, 'current');
});

for (const transcript of [[], [assistantMessage]]) {
  test(`New chat reuses current session with ${transcript.length} assistant messages and zero users`, async () => {
    const h = harness({ isDemo: true, transcript });
    const before = h.store.getState();
    await button(h.render(), t('session.newChat')).props.onClick();
    const after = h.store.getState();
    assert.deepEqual(h.calls.create, []);
    assert.equal(after.sessionId, 'current');
    assert.deepEqual(after.messages, []);
    assert.equal(after.sessions.length, 3);
    assert.equal(after.demoMessagesUsed, before.demoMessagesUsed);
    assert.equal(after.demoRestoredUserMsgCount, before.demoRestoredUserMsgCount);
    assert.equal(after.demoAccountingEpoch, before.demoAccountingEpoch);
    assert.deepEqual(h.calls.accounting, []);
    assert.deepEqual(h.calls.pointers, []);
    assert.equal(nodes(h.render()).some((node) => node.props?.role === 'menu'), false);
  });
}

test('New chat uses live user messages, not stale render or row message_count', async () => {
  const h = harness({ transcript: [] });
  const onClick = button(h.render(), t('session.newChat')).props.onClick;
  h.store.getState().addMessage(userMessage);
  await onClick();
  assert.deepEqual(h.calls.create, ['doc-1']);
  assert.equal(h.store.getState().sessionId, 'new');
  assert.deepEqual(h.store.getState().messages, []);
  assert.deepEqual(h.calls.accounting, [], 'authenticated create without demo usage makes no accounting writes');
});

test('nonempty demo create preserves original baseline, epoch and stored-pointer install', async () => {
  const h = harness({ isDemo: true, createResult: { session_id: 'new', created_at: '2026-09-10', demo_messages_used: 9 } });
  const onClick = button(h.render(), t('session.newChat')).props.onClick;
  await Promise.all([onClick(), onClick()]);
  assert.deepEqual(h.calls.create, ['doc-1'], 'same-render double click creates one row');
  assert.deepEqual(h.calls.accounting, [['setDemoRestoredUserMsgCount', 0], ['setDemoMessagesUsed', 9], ['bumpDemoAccountingEpoch']]);
  assert.deepEqual(h.calls.pointers, [['doc-1', 'new']]);
  assert.equal(h.store.getState().demoMessagesUsed, 9);
  assert.equal(h.store.getState().demoRestoredUserMsgCount, 0);
  assert.deepEqual(h.store.getState().messages, []);
});

test('New chat does not reuse the temporary empty pane while switching sessions', async () => {
  const h = harness();
  const switching = nodes(h.render()).find((node) => node.type === 'button' && textOf(node).startsWith('older')).props.onClick();
  assert.deepEqual(h.store.getState().messages, []);
  await button(h.render(), t('session.newChat')).props.onClick();
  assert.deepEqual(h.calls.create, []);
  h.resolveMessages({ messages: [userMessage] });
  await switching;
  assert.deepEqual(h.store.getState().messages, [userMessage]);
});

test('deleting the last empty session still creates a real replacement', async () => {
  const h = harness({ transcript: [] });
  h.store.getState().setSessions([row('current')]);
  button(h.render(), t('session.deleteChat')).props.onClick();
  await button(h.render(), t('common.yes')).props.onClick();
  assert.deepEqual(h.calls.delete, ['current']);
  assert.deepEqual(h.calls.create, ['doc-1']);
  assert.equal(h.store.getState().sessionId, 'new');
});

test('demo metadata resets on document change/reset and survives same-document locale refresh', () => {
  const h = harness({ isDemo: true });
  const store = h.store;
  store.getState().setDocument('doc-1');
  assert.equal(store.getState().isDemo, true);
  store.getState().setDocument('doc-2');
  assert.equal(store.getState().isDemo, false);
  assert.equal(store.getState().documentStatus, 'idle');
  store.getState().setIsDemo(true);
  store.getState().clearDocumentTransientState();
  assert.equal(store.getState().isDemo, true);
  assert.equal(store.getState().demoMessagesUsed, 7);
  assert.deepEqual(h.calls.accounting, []);
  store.getState().setIsDemo(true);
  store.getState().reset();
  assert.equal(store.getState().isDemo, false);
  assert.equal(store.getState().messagesSessionId, null);
  const loader = fs.readFileSync(path.resolve(__dirname, '../src/lib/useDocumentLoader.ts'), 'utf8');
  assert.match(loader, /if \(cancelled\) return;[\s\S]*setIsDemo\(Boolean\(info.is_demo\)\)/);
  assert.doesNotMatch(loader, /\[isDemo, setIsDemo\] = useState/);
});

test('anonymous demo code stays separate and session CTA keyboard activation does not bubble into New chat', () => {
  const copy = copyModule.errorCopy({ code: 'DEMO_SESSION_LIMIT_REACHED' }, t, tOr, { isDemo: true });
  assert.equal(copy.cta, undefined);
  assert.match(copy.body, /capacity/);
  const source = fs.readFileSync(path.resolve(__dirname, '../src/components/SessionDropdown.tsx'), 'utf8');
  assert.match(source, /event.key === 'Enter' \|\| event.key === ' '[\s\S]*?event.stopPropagation\(\)/);
});

test('all session-limit copy keys are flat, nonempty and interpolated in all 11 locales', () => {
  const keys = ['errors.SESSION_LIMIT_REACHED.body', 'errors.SESSION_LIMIT_REACHED.demoTitle', 'errors.SESSION_LIMIT_REACHED.demoBody', 'errors.cta.uploadDocument', 'errors.cta.deleteConversation'];
  for (const locale of ['en', 'zh', 'ja', 'ko', 'es', 'de', 'fr', 'pt', 'it', 'ar', 'hi']) {
    const dict = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../src/i18n/locales/${locale}.json`), 'utf8'));
    for (const key of keys) assert.ok(typeof dict[key] === 'string' && dict[key].trim(), `${locale}: ${key}`);
    for (const key of keys.filter((key) => /body$/i.test(key))) assert.equal((dict[key].match(/\{limit\}/g) || []).length, 1, `${locale}: ${key} placeholder`);
  }
});

test('session switching waits for initial restore and an in-flight switch', async () => {
  const h = harness();
  const switchTo = (title) => nodes(h.render()).find((node) => node.type === 'button' && textOf(node).startsWith(title)).props.onClick();
  h.store.getState().setSessionId('current');
  const restoreToken = h.store.getState().beginTranscriptRestore();
  await switchTo('older');
  assert.equal(h.store.getState().sessionId, 'current', 'initial restore must finish first');
  h.store.getState().setMessages([userMessage]);
  h.store.getState().endTranscriptRestore(restoreToken);
  const first = switchTo('older');
  await switchTo('oldest');
  assert.equal(h.store.getState().sessionId, 'older', 'do not overlap transcript loads');
  await button(h.render(), t('session.newChat')).props.onClick();
  assert.deepEqual(h.calls.create, []);
  h.resolveMessages({ messages: [userMessage] });
  await first;
  assert.equal(h.store.getState().messagesSessionId, 'older');
});

test('late session-switch response cannot install messages or accounting on another document', async () => {
  const h = harness();
  const switching = nodes(h.render()).find((node) => node.type === 'button' && textOf(node).startsWith('older')).props.onClick();
  h.store.getState().setDocument('doc-2');
  h.store.getState().setSessionId('doc-2-session');
  h.store.getState().setMessages([userMessage]);
  h.resolveMessages({ messages: [], demo_messages_used: 100 });
  await switching;
  assert.deepEqual(h.store.getState().messages, [userMessage]);
  assert.equal(h.store.getState().messagesSessionId, 'doc-2-session');
  assert.deepEqual(h.calls.accounting, []);
});

test('demo cap still offers upload during a same-document metadata refresh', async () => {
  const h = harness({ isDemo: true, createError: limitError });
  h.store.getState().clearDocumentTransientState();
  h.store.getState().setDocument('doc-1');
  await button(h.render(), t('session.newChat')).props.onClick();
  assert.match(textOf(h.render()), /The demo allows 3 conversations/);
  assert.doesNotMatch(textOf(h.render()), /Upgrade/);
});

test('failed session switch restores the loaded transcript and allows retry without counter writes', async () => {
  const h = harness({ isDemo: true });
  const switchToOlder = () => nodes(h.render()).find((node) => node.type === 'button' && textOf(node).startsWith('older')).props.onClick();
  const first = switchToOlder();
  h.rejectMessages(new TypeError('fetch failed'));
  await first;
  assert.equal(h.store.getState().sessionId, 'current');
  assert.equal(h.store.getState().messagesSessionId, 'current');
  assert.deepEqual(h.store.getState().messages, [userMessage]);
  assert.deepEqual(h.calls.accounting, []);
  const retry = switchToOlder();
  h.resolveMessages({ messages: [] }, 1);
  await retry;
  assert.equal(h.store.getState().sessionId, 'older');
  assert.equal(h.store.getState().messagesSessionId, 'older');
  assert.deepEqual(h.calls.accounting, []);
});

const settle = () => new Promise((resolve) => setImmediate(resolve));
const switchTo = (h, title) => nodes(h.render()).find((node) => node.type === 'button' && textOf(node).startsWith(title)).props.onClick();

test('initial GET failure and capped create fallback allow exactly one explicit session retry GET', async () => {
  const h = harness({ createError: limitError });
  const restore = h.startInitialRestore();
  await settle();
  assert.deepEqual(h.calls.get, ['current']);
  assert.ok(h.store.getState().transcriptRestoreInFlight);
  await switchTo(h, 'older');
  await button(h.render(), t('session.newChat')).props.onClick();
  assert.deepEqual(h.calls.get, ['current'], 'pending initial restore blocks switching');
  assert.deepEqual(h.calls.create, [], 'pending initial restore blocks New Chat');
  h.rejectMessages(new TypeError('initial GET failed'));
  await settle();
  assert.deepEqual(h.calls.create, ['doc-1']);
  assert.equal(restore.getError(), limitError);
  assert.equal(h.store.getState().sessionId, 'current');
  assert.equal(h.store.getState().messagesSessionId, null);
  assert.equal(h.store.getState().transcriptRestoreInFlight, null);
  const retry = switchTo(h, 'older');
  assert.deepEqual(h.calls.get, ['current', 'older'], 'one explicit click issues exactly one retry GET');
  h.resolveMessages({ messages: [userMessage, assistantMessage] }, 1);
  await retry;
  assert.equal(h.store.getState().sessionId, 'older');
  assert.equal(h.store.getState().messagesSessionId, 'older');
  assert.deepEqual(h.store.getState().messages, [userMessage, assistantMessage]);
  assert.equal(h.store.getState().transcriptRestoreInFlight, null);
});

for (const owner of [null, 'foreign']) {
  test(`unknown/foreign ownership (${owner}) creates instead of reusing an empty transcript`, async () => {
    const h = harness({ transcript: [], createError: limitError });
    h.store.getState().setMessages([], owner);
    await button(h.render(), t('session.newChat')).props.onClick();
    assert.deepEqual(h.calls.create, ['doc-1']);
    assert.equal(h.store.getState().messagesSessionId, owner);
    assert.equal(h.store.getState().sessionId, 'current');
    assert.deepEqual(h.calls.accounting, []);
    assert.deepEqual(h.calls.pointers, []);
  });
}

test('failed retry preserves unknown ownership so New Chat still falls through to create', async () => {
  const h = harness({ transcript: [], createError: limitError });
  h.store.getState().setSessionId('current');
  const retry = switchTo(h, 'older');
  h.rejectMessages(new TypeError('retry GET failed'));
  await retry;
  assert.equal(h.store.getState().sessionId, 'current');
  assert.equal(h.store.getState().messagesSessionId, null, 'failed load is never certified empty');
  assert.equal(h.store.getState().transcriptRestoreInFlight, null);
  await button(h.render(), t('session.newChat')).props.onClick();
  assert.deepEqual(h.calls.create, ['doc-1']);
  assert.deepEqual(h.calls.accounting, []);
});

test('initial restore clears pending on success and rejects a changed session identity', async () => {
  for (const changeSession of [false, true]) {
    const h = harness();
    h.startInitialRestore();
    await settle();
    if (changeSession) {
      h.store.getState().setSessionId('older');
      h.store.getState().setMessages([assistantMessage]);
    }
    h.resolveMessages({ messages: [userMessage] });
    await settle();
    assert.equal(h.store.getState().transcriptRestoreInFlight, null);
    assert.deepEqual(h.store.getState().messages, changeSession ? [assistantMessage] : [userMessage]);
    assert.equal(h.store.getState().messagesSessionId, changeSession ? 'older' : 'current');
    assert.deepEqual(h.calls.create, []);
  }
});

test('cancelled initial restore releases immediately and its late finally cannot unlock a newer restore', async () => {
  const h = harness();
  const first = h.startInitialRestore();
  await settle();
  first.cancel();
  assert.equal(h.store.getState().transcriptRestoreInFlight, null);
  h.startInitialRestore();
  await settle();
  const newerToken = h.store.getState().transcriptRestoreInFlight;
  assert.ok(newerToken);
  h.resolveMessages({ messages: [userMessage] });
  await settle();
  assert.equal(h.store.getState().transcriptRestoreInFlight, newerToken);
  assert.deepEqual(h.store.getState().messages, []);
  h.resolveMessages({ messages: [assistantMessage] }, 1);
  await settle();
  assert.equal(h.store.getState().transcriptRestoreInFlight, null);
  assert.deepEqual(h.store.getState().messages, [assistantMessage]);
});

test('pending restore resets on document change/reset and survives same-document transient refresh', () => {
  const h = harness();
  const state = h.store.getState();
  const token = state.beginTranscriptRestore();
  state.setDocument('doc-1');
  state.clearDocumentTransientState();
  assert.equal(h.store.getState().transcriptRestoreInFlight, token);
  state.setDocument('doc-2');
  assert.equal(h.store.getState().transcriptRestoreInFlight, null);
  state.beginTranscriptRestore();
  state.reset();
  assert.equal(h.store.getState().transcriptRestoreInFlight, null);
});

for (const isDemo of [false, true]) {
  test(`session limit analytics include request document and demo context (${isDemo}) outside reader routes`, async () => {
    const h = harness({ isDemo, createError: limitError });
    const events = [];
    const analytics = load('lib/analytics.ts');
    const originalWindow = global.window;
    const originalFetch = global.fetch;
    try {
      global.window = { location: { pathname: '/' }, gtag: (...args) => events.push(args) };
      global.fetch = async () => ({});
      await button(h.render(), t('session.newChat')).props.onClick();
      assert.equal(h.calls.events.length, 1);
      analytics.trackEvent(...h.calls.events[0]);
      assert.deepEqual(events, [['event', 'limit_hit', {
        path: '/', source: 'session_dropdown', reason: 'session_limit', document_id: 'doc-1', is_demo: isDemo,
      }]]);
    } finally {
      global.window = originalWindow;
      global.fetch = originalFetch;
    }
  });
}

test('unmount cancels a pending switch and its late completion cannot affect a newer restore', async () => {
  const h = harness();
  const pending = switchTo(h, 'older');
  h.unmount();
  assert.equal(h.store.getState().transcriptRestoreInFlight, null);
  const newerToken = h.store.getState().beginTranscriptRestore();
  h.store.getState().setSessionId('oldest');
  h.store.getState().setMessages([assistantMessage]);
  h.resolveMessages({ messages: [userMessage], demo_messages_used: 100 });
  await pending;
  assert.equal(h.store.getState().transcriptRestoreInFlight, newerToken);
  assert.deepEqual(h.store.getState().messages, [assistantMessage]);
  assert.deepEqual(h.calls.accounting, []);
});


for (const outcome of ['success-before-survivor', 'success-after-survivor', 'survivor-failure', 'no-survivor', 'create-failure', 'deleted-get-failure']) {
  test(`active deletion supersedes initial restore: ${outcome}`, async () => {
    const noSurvivor = outcome === 'no-survivor' || outcome === 'create-failure';
    const h = harness({
      initialSessions: noSurvivor ? [row('current')] : [row('current'), row('older')],
      createError: outcome === 'create-failure' ? new TypeError('create failed') : undefined,
      deferCreate: outcome === 'no-survivor',
    });
    const deletedMessage = { ...userMessage, id: 'deleted-message', text: 'Deleted transcript' };
    const survivorMessage = { ...userMessage, id: 'survivor-message', text: 'Survivor transcript' };
    const installed = [];
    h.store.subscribe((state) => installed.push(...state.messages));
    h.startInitialRestore();
    await settle();
    const initialToken = h.store.getState().transcriptRestoreInFlight;
    assert.ok(initialToken);
    const accountingBefore = [...h.calls.accounting];
    button(h.render(), t('session.deleteChat')).props.onClick();
    const deleting = button(h.render(), t('common.yes')).props.onClick();
    await settle();
    assert.deepEqual(h.calls.delete, ['current']);
    assert.notEqual(h.store.getState().sessionId, 'current', 'retire deleted identity before any replacement await');
    assert.notEqual(h.store.getState().transcriptRestoreInFlight, initialToken, 'release superseded token even if GET hangs');
    assert.deepEqual(h.calls.get, noSurvivor ? ['current'] : ['current', 'older']);
    if (outcome === 'no-survivor') {
      assert.equal(h.store.getState().sessionId, null);
      assert.equal(h.store.getState().transcriptRestoreInFlight, null);
      h.resolveMessages({ messages: [deletedMessage] });
      await settle();
      assert.equal(h.store.getState().sessionId, null, 'late restore cannot revive deleted id during create');
      h.resolveCreate({ session_id: 'new', created_at: '2026-09-10' });
    }
    if (outcome === 'success-before-survivor') {
      const replacementToken = h.store.getState().transcriptRestoreInFlight;
      h.resolveMessages({ messages: [deletedMessage] });
      await settle();
      assert.equal(h.store.getState().transcriptRestoreInFlight, replacementToken, 'old finally cannot release replacement token');
    }
    if (!noSurvivor) {
      if (outcome === 'survivor-failure') h.rejectMessages(new TypeError('replacement GET failed'), 1);
      else h.resolveMessages({ messages: [survivorMessage] }, 1);
    }
    await deleting;
    if (outcome === 'deleted-get-failure') h.rejectMessages(new TypeError('deleted GET failed'));
    else h.resolveMessages({ messages: [deletedMessage] });
    await settle();
    const live = h.store.getState();
    assert.equal(live.sessionId, noSurvivor ? (outcome === 'create-failure' ? null : 'new') : 'older');
    assert.deepEqual(live.messages, noSurvivor || outcome === 'survivor-failure' ? [] : [survivorMessage]);
    assert.equal(installed.some((message) => message.id === deletedMessage.id), false, 'deleted transcript must never be installed, even transiently');
    assert.equal(live.transcriptRestoreInFlight, null);
    assert.deepEqual(h.calls.create, noSurvivor ? ['doc-1'] : [], 'old restore must not start a fallback create');
    assert.deepEqual(h.calls.accounting, accountingBefore);
    assert.deepEqual(h.calls.pointers, []);
    if (outcome === 'survivor-failure') {
      assert.equal(live.messagesSessionId, null, 'failed survivor GET must remain unknown, not certify empty');
      nodes(h.render()).find((node) => node.props?.['data-tour']).props.onClick();
      const retry = switchTo(h, 'older');
      h.resolveMessages({ messages: [survivorMessage] }, 2);
      await retry;
      assert.equal(h.store.getState().sessionId, 'older');
      assert.deepEqual(h.store.getState().messages, [survivorMessage]);
    }
  });
}


for (const oldOutcome of ['success', 'failure']) {
  test(`active deletion supersedes dropdown switch and its late ${oldOutcome}`, async () => {
    const h = harness();
    const oldSwitch = switchTo(h, 'older');
    button(h.render(), t('session.deleteChat')).props.onClick();
    const deleting = button(h.render(), t('common.yes')).props.onClick();
    await settle();
    assert.deepEqual(h.calls.delete, ['older']);
    assert.deepEqual(h.calls.get, ['older', 'current']);
    const replacementToken = h.store.getState().transcriptRestoreInFlight;
    if (oldOutcome === 'success') h.resolveMessages({ messages: [assistantMessage], demo_messages_used: 100 });
    else h.rejectMessages(new TypeError('old switch failed'));
    await oldSwitch;
    assert.equal(h.store.getState().sessionId, 'current');
    assert.equal(h.store.getState().transcriptRestoreInFlight, replacementToken);
    assert.deepEqual(h.store.getState().messages, []);
    assert.deepEqual(h.calls.accounting, []);
    h.resolveMessages({ messages: [userMessage] }, 1);
    await deleting;
    assert.equal(h.store.getState().messagesSessionId, 'current');
    assert.deepEqual(h.store.getState().messages, [userMessage]);
  });
}
