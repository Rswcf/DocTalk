const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
// Minimal deterministic hook lifecycle. Executes the real page module; JSX
// children stay inert so tests can invoke actual page callbacks without APIs.
module.exports = function pageHarness(store, api) {
  const slots = []; let cursor = 0; let effects = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
  const react = {
    useState(initial) { const i = cursor++; slots[i] ??= { value: initial }; return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useMemo(fn, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) slots[i] = { value: fn(), deps }; return slots[i].value; },
    useCallback(fn, deps) { return react.useMemo(() => fn, deps); },
    useEffect(fn, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) { const old = slots[i]; slots[i] = { deps }; effects.push(() => { old?.cleanup?.(); slots[i].cleanup = fn(); }); } },
  };
  let route = 'C', account = 'user1', status = 'authenticated';
  const pushes = [], router = { push: value => pushes.push(value) };
  const SessionList = () => null, ChatPanel = () => null, LoadingScreen = () => null;
  const useStore = () => store.getState(); useStore.getState = store.getState; useStore.setState = store.setState;
  const filename = path.resolve(__dirname, '../src/app/collections/[collectionId]/page.tsx');
  const mocks = {
    react, 'next/navigation': { useParams: () => ({ collectionId: route }), useRouter: () => router },
    'next-auth/react': { useSession: () => ({ status, data: { user: { id: account } } }) },
    '../../../lib/api': api, '../../../store': { useDocTalkStore: useStore },
    '../../../lib/collectionSessions': require('../src/lib/collectionSessions.ts'),
    '../../../i18n': { useLocale: () => ({ t: key => key, tOr: (_, fallback) => fallback }) },
    '../../../lib/useUserPlanProfile': { useUserPlanProfile: () => ({ userPlan: 'plus', profile: {} }) },
    '../../../components/Collections/SessionList': { __esModule: true, default: SessionList },
    '../../../components/Chat': { ChatPanel }, '../../../components/ui/LoadingScreen': { LoadingScreen },
  };
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const actual = mod.require.bind(mod);
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id === 'react/jsx-runtime' ? actual(id) : new Proxy({}, { get: (_, key) => key === '__esModule' ? true : () => null });
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
  let tree;
  function find(predicate, node = tree) {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) return node.map(n => find(predicate, n ?? null)).find(Boolean);
    if (predicate(node)) return node;
    return find(predicate, node.props?.children ?? null);
  }
  return {
    render() { cursor = 0; tree = mod.exports.default(); return tree; },
    commit() { const work = effects; effects = []; work.forEach(fn => fn()); },
    route(id) { route = id; }, account(id) { account = id; }, status(value) { status = value; }, pushes,
    sessions: () => find(n => n.type === SessionList), chat: () => find(n => n.type === ChatPanel), loading: () => find(n => n.type === LoadingScreen),
    retry: () => find(n => n.type === 'button' && n.props.children === 'Retry'),
    alert: () => find(n => n.props?.role === 'alert'),
  };
};
