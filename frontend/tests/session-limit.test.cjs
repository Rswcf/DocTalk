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

function harness({ isDemo = false, transcript = [userMessage], createError } = {}) {
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
  const api = {
    createSession: async (id) => {
      calls.create.push(id);
      if (createError) throw createError;
      return { session_id: 'new', created_at: '2026-09-10' };
    },
    getMessages: async (id) => { calls.get.push(id); return { messages: [] }; },
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

test('demo cap still offers upload during a same-document metadata refresh', async () => {
  const h = harness({ isDemo: true, createError: limitError });
  h.store.getState().clearDocumentTransientState();
  h.store.getState().setDocument('doc-1');
  await button(h.render(), t('session.newChat')).props.onClick();
  assert.match(textOf(h.render()), /The demo allows 3 conversations/);
  assert.doesNotMatch(textOf(h.render()), /Upgrade/);
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
