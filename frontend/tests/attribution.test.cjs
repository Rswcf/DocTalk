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

const { readAttribution, referrerHost } = loadTs('../src/lib/attribution.ts');

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

test('values are capped at 64 characters', () => {
  const long = 'x'.repeat(200);
  const out = readAttribution('', `https://www.doctalk.site/?utm_campaign=${long}`);
  assert.equal(out.utm_campaign.length, 64);
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
