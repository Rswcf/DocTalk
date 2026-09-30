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

const { readAttribution, referrerHost, safeUtm, safeLandingPath } = loadTs('../src/lib/attribution.ts');

test('private and dynamic routes never leak ids or tokens into landing_path', () => {
  assert.equal(safeLandingPath('/d/182c1d7b-29df-4600-add2-420384c725a4'), '/d/*');
  assert.equal(safeLandingPath('/shared/abcDEF123tokenXYZ'), '/shared/*');
  assert.equal(safeLandingPath('/collections/9f0e7c1a-1111-2222-3333-444455556666'), '/collections/*');
  assert.equal(safeLandingPath('/auth'), '/auth');
  assert.equal(safeLandingPath('/auth/verify-request/extra'), '/auth/*');
  assert.equal(safeLandingPath('/profile'), '/profile');
  assert.equal(safeLandingPath('/%40user%40mail.com'), '/*');
  // Public marketing pages are kept as-is, locale prefix included.
  assert.equal(safeLandingPath('/'), '/');
  assert.equal(safeLandingPath('/zh'), '/zh');
  assert.equal(safeLandingPath('/es/use-cases/students'), '/es/use-cases/students');
  assert.equal(safeLandingPath('/blog/chatpdf-alternatives-2026'), '/blog/chatpdf-alternatives-2026');
  assert.equal(safeLandingPath('/blog/category/guides'), '/blog/category/guides');
  assert.equal(safeLandingPath('/demo/alphabet-earnings'), '/demo/alphabet-earnings');
  assert.equal(safeLandingPath('/pricing/'), '/pricing');
});

test('utm values that could carry personal data are dropped', () => {
  assert.equal(safeUtm('chatgpt.com'), 'chatgpt.com');
  assert.equal(safeUtm('Newsletter_Oct'), 'newsletter_oct');
  assert.equal(safeUtm('jane.doe@example.com'), undefined);
  assert.equal(safeUtm('+49 151 2345678'), undefined);
  assert.equal(safeUtm('user-4915123456789'), undefined);
  assert.equal(safeUtm('9f0e7c1a-1111-2222-3333-444455556666'), undefined);
  assert.equal(safeUtm('a/b?c=d'), undefined);
  assert.equal(safeUtm(''), undefined);
});

test('own subdomains, previews, return hops and non-web referrers are not sources', () => {
  const here = 'www.doctalk.site';
  for (const ref of [
    'https://app.doctalk.site/x',
    'https://doctalk-liard.vercel.app/',
    'https://doctalk-git-main-rswcf.vercel.app/pricing',
    'https://checkout.stripe.com/c/pay/cs_live_x',
    'https://mail.google.com/mail/u/0/',
    'https://outlook.live.com/mail/0/',
    'https://accounts.youtube.com/',
    'android-app://com.google.android.gm/',
    'javascript:alert(1)',
  ]) {
    assert.equal(referrerHost(ref, here), undefined, ref);
  }
  assert.equal(referrerHost('https://some-other.vercel.app/', here), 'some-other.vercel.app');
});

test('first touch is cached: a later location change does not rewrite it', () => {
  global.window = { location: { href: 'https://www.doctalk.site/blog/chatpdf-alternatives-2026?utm_source=chatgpt.com' } };
  global.document = { referrer: 'https://chatgpt.com/' };
  try {
    const fresh = loadTs('../src/lib/attribution.ts');
    global.window.location.href = 'https://www.doctalk.site/pricing';
    global.document.referrer = '';
    assert.deepEqual(fresh.getAttribution(), {
      ref_host: 'chatgpt.com',
      utm_source: 'chatgpt.com',
      landing_path: '/blog/chatpdf-alternatives-2026',
    });
  } finally {
    delete global.window;
    delete global.document;
  }
});

test('ChatGPT referral with utm tags is captured as first touch', () => {
  assert.deepEqual(
    readAttribution(
      'https://chatgpt.com/',
      'https://www.doctalk.site/blog/chatpdf-alternatives-2026?utm_source=chatgpt.com',
    ),
    {
      ref_host: 'chatgpt.com',
      utm_source: 'chatgpt.com',
      landing_path: '/blog/chatpdf-alternatives-2026',
    },
  );
});

test('own hosts and sign-in hops are not a traffic source', () => {
  assert.equal(referrerHost('https://www.doctalk.site/pricing', 'www.doctalk.site'), undefined);
  assert.equal(referrerHost('https://doctalk.site/', 'www.doctalk.site'), undefined);
  assert.equal(referrerHost('https://accounts.google.com/', 'www.doctalk.site'), undefined);
  assert.equal(referrerHost('https://login.microsoftonline.com/x', 'www.doctalk.site'), undefined);
  assert.equal(referrerHost('https://www.perplexity.ai/search/1', 'www.doctalk.site'), 'www.perplexity.ai');
});

test('empty or malformed input yields no keys, never throws', () => {
  assert.deepEqual(readAttribution('', 'https://www.doctalk.site/'), { landing_path: '/' });
  assert.deepEqual(readAttribution('not a url', 'also not a url'), {});
});

test('over-long utm values are dropped, not truncated', () => {
  const out = readAttribution('', `https://www.doctalk.site/?utm_campaign=${'x'.repeat(200)}&utm_source=${'y'.repeat(64)}`);
  assert.equal(out.utm_campaign, undefined);
  assert.equal(out.utm_source, 'y'.repeat(64));
});

test('trackEvent attaches attribution only to the pre-signup funnel events', async () => {
  const sent = [];
  global.window = { location: { pathname: '/', href: 'https://www.doctalk.site/' } };
  global.fetch = (_url, init) => {
    sent.push(JSON.parse(init.body));
    return Promise.resolve();
  };
  const attribution = {
    ATTRIBUTED_EVENTS: new Set(['landing_cta_clicked', 'auth_modal_opened', 'auth_provider_clicked']),
    getAttribution: () => ({ ref_host: 'chatgpt.com', utm_source: 'chatgpt.com', landing_path: '/' }),
  };
  const { trackEvent } = loadTs('../src/lib/analytics.ts', { './attribution': attribution });
  try {
    trackEvent('landing_cta_clicked', { cta: 'hero' });
    trackEvent('paywall_opened', { reason: 'limit' });
    trackEvent('auth_provider_clicked', { ref_host: 'explicit.example' });
  } finally {
    delete global.window;
    delete global.fetch;
  }
  assert.equal(sent[0].properties.ref_host, 'chatgpt.com');
  assert.equal(sent[0].properties.cta, 'hero');
  assert.equal(sent[1].properties.ref_host, undefined);
  // Caller-supplied params win over captured attribution.
  assert.equal(sent[2].properties.ref_host, 'explicit.example');
});
