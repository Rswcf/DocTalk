// Contrast audit for the Night marketing surface.
// usage: node nightaudit.mjs <base-url> <urls-file> <out.json>   (SCHEME=light|dark)
// Loads each page in headless Chrome over CDP, waits, and reports every visible
// text element whose colour against its composited background is below WCAG AA
// (4.5:1, or 3:1 for large text).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';

const [base, listFile, outFile] = process.argv.slice(2);
const urls = fs.readFileSync(listFile, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9300 + Math.floor(Math.random() * 400);
const profile = fs.mkdtempSync(os.tmpdir() + '/nightaudit-');
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const AUDIT = `(() => {
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const parse = (s) => { const m = s && s.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  function background(el) {
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return base;
  }
  const out = [];
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = node.textContent.trim();
    if (!text) continue;
    const el = node.parentElement;
    if (!el || seen.has(el)) continue;
    seen.add(el);
    if (el.closest('[aria-hidden="true"], script, style, noscript, .sr-only')) continue; // not painted for sighted users
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    let op = 1; for (let e = el; e; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity);
    if (op < 0.5) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const fill = parse(cs.webkitTextFillColor);
    if (fill && fill.a === 0) continue; // gradient-clipped text (the night h1)
    const fg = parse(cs.color);
    if (!fg || fg.a === 0) continue;
    const bg = background(el);
    const fgc = over(fg, bg);
    const L1 = lum(fgc), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight, 10);
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const min = large ? 3 : 4.5;
    if (ratio < min) {
      out.push({ text: text.slice(0, 60), ratio: +ratio.toFixed(2), min, color: cs.color, bg: 'rgb(' + [bg.r, bg.g, bg.b].map(Math.round).join(', ') + ')', size, tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 70) });
    }
  }
  const root = document.querySelector('#page-content .dt-editorial');
  return { night: !!(root && root.classList.contains('dt-night')), stage: root ? getComputedStyle(root).backgroundColor : null, offenders: out };
})()`;

async function main() {
  let ws;
  for (let i = 0; i < 50 && !ws; i++) {
    await sleep(200);
    try { const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); ws = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl; } catch {}
  }
  const sock = new WebSocket(ws);
  await new Promise((r) => sock.addEventListener('open', r, { once: true }));
  let id = 0; const pending = new Map();
  sock.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  const send = (method, params = {}) => new Promise((res) => { const n = ++id; pending.set(n, res); sock.send(JSON.stringify({ id: n, method, params })); });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: process.env.SCHEME || 'light' }] });
  const results = [];
  for (const u of urls) {
    const url = u.startsWith('http') ? u : base + u;
    await send('Page.navigate', { url });
    await sleep(+(process.env.WAIT || 3500));
    if (process.env.INJECT) await send('Runtime.evaluate', { expression: `document.querySelector('main').insertAdjacentHTML('afterbegin', '<p style="color:#2a2825;font-size:16px">LOW CONTRAST PROBE</p><p style="color:#948f86;font-size:14px">OK PROBE ink-3</p>')` });
    const r = await send('Runtime.evaluate', { expression: AUDIT, returnByValue: true });
    const v = r.result?.result?.value || { error: JSON.stringify(r.result?.exceptionDetails || r.error) };
    results.push({ url: u, ...v });
    process.stdout.write(`${u}  night=${v.night} offenders=${v.offenders ? v.offenders.length : 'ERR'}\n`);
  }
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  sock.close(); chrome.kill();
}
main().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
