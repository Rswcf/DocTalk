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

function harness({ isDemo = false, transcript = [userMessage], createResult, createError } = {}) {
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
  const calls = { create: [], billing: [], accounting: [], pointers: [], delete: [] };
  for (const name of ['setDemoMessagesUsed', 'setDemoRestoredUserMsgCount', 'bumpDemoAccountingEpoch']) {
    const original = store.getState()[name];
    store.setState({ [name]: (...args) => { calls.accounting.push([name, ...args]); original(...args); } });
  }
  const slots = [];
  let index = 0;
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
    useEffect() {},
    useMemo: (fn) => fn(),
  };
  const useStore = (selector) => selector ? selector(store.getState()) : store.getState();
  useStore.getState = store.getState;
  const pendingMessages = [];
  const Component = load('components/SessionDropdown.tsx', {
    react,
    'lucide-react': Object.fromEntries(['ChevronDown', 'Plus', 'Trash2', 'Home', 'X'].map((name) => [name, () => null])),
    'next/link': { __esModule: true, default: 'a' },
    'next/navigation': { useRouter: () => ({ push() {} }) },
    'next-auth/react': { useSession: () => ({ status: 'authenticated' }) },
    '../store': { useDocTalkStore: useStore },
    '../i18n': { useLocale: () => ({ t, tOr }) },
    '../lib/api': {
      createSession: async (id) => {
        calls.create.push(id);
        if (createError) throw createError;
        return createResult || { session_id: 'new', created_at: '2026-09-10' };
      },
      getMessages: () => new Promise((resolve, reject) => { pendingMessages.push({ resolve, reject }); }),
      deleteSession: async (id) => { calls.delete.push(id); },
    },
    '../lib/errorCopy': copyModule,
    '../lib/analytics': { trackEvent() {} },
    '../lib/billing': {
      startPlanAwareBillingAction: async (args) => { calls.billing.push(args); },
      getBillingErrorMessage: () => 'Billing failed',
    },
    '../lib/useDropdownKeyboard': { useDropdownKeyboard: () => () => {} },
    '../lib/demoSessionStorage': {
      clearDemoSession() {}, readDemoSession: () => null,
      writeDemoSession: (...args) => calls.pointers.push(args),
    },
    '../lib/useUserProfile': { useUserProfile: () => ({ profile: { plan: 'free' } }) },
  }).default;
  const render = () => { index = 0; return Component(); };
  nodes(render()).find((node) => node.props?.['data-tour']).props.onClick();
  return {
    store, calls, render,
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
  await switchTo('older');
  assert.equal(h.store.getState().sessionId, 'current', 'initial restore must finish first');
  h.store.getState().setMessages([userMessage]);
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
