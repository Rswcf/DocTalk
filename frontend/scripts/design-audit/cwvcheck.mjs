// Lab Core Web Vitals for a page: every LCP candidate (which element, when), every layout
// shift (and what moved), long tasks, and the fonts the page downloaded. Cold load, cache off.
//
// usage: node cwvcheck.mjs <url> [mobile|desktop] [runs]
//   mobile:  412x823 @1.75x, Android UA, 4x CPU slowdown, Lighthouse's applied "slow 4G"
//            (562.5 ms RTT, 1474.56 kbps down, 675 kbps up)
//   desktop: 1350x940 @1x, no CPU slowdown, 40 ms RTT, 10 Mbps
// It waits 9 s after load so late candidates count (the landing's answer card arrives ~3 s in)
// and never touches the page, because any input ends LCP recording.
// BLOCK=pattern,pattern blocks matching URLs, e.g. to measure a page without an unused preload.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';

const [url, profileName = 'mobile', runsArg = '3'] = process.argv.slice(2);
if (!url) {
  console.error('usage: node cwvcheck.mjs <url> [mobile|desktop] [runs]');
  process.exit(2);
}
const PROFILES = {
  mobile: {
    metrics: { width: 412, height: 823, deviceScaleFactor: 1.75, mobile: true },
    ua: 'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    cpu: 4,
    net: { latency: 562.5, downloadThroughput: (1474.56 * 1024) / 8, uploadThroughput: (675 * 1024) / 8 },
  },
  desktop: {
    metrics: { width: 1350, height: 940, deviceScaleFactor: 1, mobile: false },
    ua: null,
    cpu: 1,
    net: { latency: 40, downloadThroughput: (10240 * 1024) / 8, uploadThroughput: (10240 * 1024) / 8 },
  },
};
const P = PROFILES[profileName];
const RUNS = Number(runsArg);
const BLOCK = (process.env.BLOCK || '').split(',').filter(Boolean);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Installed before any page script runs; describes elements while they are still in the DOM.
const OBSERVER = `(() => {
  const describe = (el) => {
    if (!el) return null;
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '';
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (cls ? '.' + cls : '') +
      ' "' + (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 50) + '"';
  };
  const out = (window.__cwv = { lcp: [], shifts: [], longtasks: [] });
  new PerformanceObserver((l) => l.getEntries().forEach((e) =>
    out.lcp.push({ t: Math.round(e.startTime), size: e.size, el: describe(e.element), url: e.url || '' })
  )).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((l) => l.getEntries().forEach((e) =>
    out.shifts.push({ t: Math.round(e.startTime), value: +e.value.toFixed(4), input: e.hadRecentInput,
      moved: (e.sources || []).map((s) => describe(s.node)) })
  )).observe({ type: 'layout-shift', buffered: true });
  new PerformanceObserver((l) => l.getEntries().forEach((e) =>
    out.longtasks.push({ t: Math.round(e.startTime), d: Math.round(e.duration) })
  )).observe({ type: 'longtask', buffered: true });
})();`;

async function run(n) {
  const port = 9300 + Math.floor(Math.random() * 400);
  const dir = fs.mkdtempSync(os.tmpdir() + '/cwvcheck-');
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
  try {
    let ws;
    for (let i = 0; i < 50 && !ws; i++) {
      await sleep(200);
      try {
        const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        ws = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
      } catch {}
    }
    const sock = new WebSocket(ws);
    await new Promise((r) => sock.addEventListener('open', r, { once: true }));
    let id = 0;
    const pending = new Map();
    const fonts = [];
    let loaded = false;
    sock.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
      if (m.method === 'Network.responseReceived' && m.params.type === 'Font') fonts.push(m.params.response.url.split('/').pop());
      if (m.method === 'Page.loadEventFired') loaded = true;
    });
    const send = (method, params = {}) => new Promise((res) => { const k = ++id; pending.set(k, res); sock.send(JSON.stringify({ id: k, method, params })); });
    await send('Page.enable');
    await send('Network.enable');
    await send('Network.setCacheDisabled', { cacheDisabled: true });
    if (BLOCK.length) await send('Network.setBlockedURLs', { urls: BLOCK });
    await send('Network.emulateNetworkConditions', { offline: false, ...P.net });
    await send('Emulation.setDeviceMetricsOverride', P.metrics);
    if (P.ua) await send('Emulation.setUserAgentOverride', { userAgent: P.ua });
    await send('Emulation.setCPUThrottlingRate', { rate: P.cpu });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: OBSERVER });
    await send('Page.navigate', { url });
    for (let i = 0; i < 300 && !loaded; i++) await sleep(100);
    await sleep(9000);
    const r = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__cwv)', returnByValue: true });
    const cwv = JSON.parse(r.result.result.value);
    // A preloaded face that nothing on the page uses stays 'unloaded' in document.fonts.
    const used = await send('Runtime.evaluate', { returnByValue: true, expression:
      "[...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/^__|_[0-9a-f]{6}$/g, '') + ' ' + f.style).filter((v, i, a) => a.indexOf(v) === i).join(', ')" });
    cwv.used = used.result.result.value;
    sock.close();
    const cls = cwv.shifts.filter((s) => !s.input).reduce((a, s) => a + s.value, 0);
    const lcp = cwv.lcp[cwv.lcp.length - 1];
    const tbt = cwv.longtasks.reduce((a, t) => a + Math.max(0, t.d - 50), 0);
    return { n, lcp, cls: +cls.toFixed(4), tbt, cwv, fonts };
  } finally {
    const exited = new Promise((r) => chrome.once('exit', r));
    chrome.kill();
    await exited;
    try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
  }
}

const results = [];
for (let i = 1; i <= RUNS; i++) results.push(await run(i));
for (const r of results) {
  console.log(`run ${r.n}: LCP ${r.lcp?.t} ms (${r.lcp?.el}, ${r.lcp?.size}px²)  CLS ${r.cls}  TBT~${r.tbt} ms`);
  console.log('   LCP candidates:', r.cwv.lcp.map((c) => `${c.t}ms ${c.size}px² ${c.el}`).join(' | '));
  for (const s of r.cwv.shifts) console.log(`   shift ${s.t}ms ${s.value}${s.input ? ' (after input)' : ''}: ${s.moved.join(' ; ')}`);
}
const med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
console.log(`\n${profileName} ${url}: median LCP ${med(results.map((r) => r.lcp?.t ?? 0))} ms, median CLS ${med(results.map((r) => r.cls))}, median TBT~${med(results.map((r) => r.tbt))} ms`);
console.log('fonts downloaded (run 1):', results[0].fonts.join(', ') || 'none');
console.log('fonts the page used (run 1):', results[0].cwv.used || 'none');
if (BLOCK.length) console.log('blocked:', BLOCK.join(', '));
