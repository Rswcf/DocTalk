// cdpshot.mjs <url> <out.png> [width=1440] [height=900] [waitMs=4000] [fullPage=0]
// Real-time headless screenshot over the Chrome DevTools Protocol, so rAF-driven
// canvas animations actually run (the --screenshot flag's virtual time starves them).
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [url, out, w = '1440', h = '900', waitMs = '4000', full = '0'] = process.argv.slice(2);
const CH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9300 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), 'cdpshot-'));
const chrome = spawn(CH, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--hide-scrollbars', ...(process.env.EXTRA_FLAGS ? process.env.EXTRA_FLAGS.split(' ') : []), '--force-device-scale-factor=1', `--window-size=${w},${h}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kill = () => { try { chrome.kill('SIGKILL'); } catch {} };
const timer = setTimeout(() => { console.error('TIMEOUT'); kill(); process.exit(2); }, 45000);
try {
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(150);
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch {}
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile: +w < 768 });
  // optional: SCHEME=dark|light and REDUCE=1 emulate the user's OS settings
  const features = [];
  if (process.env.SCHEME) features.push({ name: 'prefers-color-scheme', value: process.env.SCHEME });
  if (process.env.REDUCE) features.push({ name: 'prefers-reduced-motion', value: 'reduce' });
  if (features.length) await send('Emulation.setEmulatedMedia', { features });
  await send('Page.enable');
  await send('Page.navigate', { url });
  if (process.env.INJECT_CSS) {
    await sleep(800);
    await send('Runtime.evaluate', { expression: 'document.head.insertAdjacentHTML("beforeend", "<style>" + ' + JSON.stringify(process.env.INJECT_CSS) + ' + "</style>")' });
  }
  await sleep(+waitMs);
  let clip;
  if (full === '1') {
    const m = await send('Page.getLayoutMetrics');
    const cs = m.result.cssContentSize || m.result.contentSize;
    clip = { x: 0, y: 0, width: +w, height: Math.min(cs.height, 8000), scale: 1 };
  }
  const shot = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip, captureBeyondViewport: true } : {}) });
  writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
  console.log(`ok ${out} (${w}x${h}${full === '1' ? ', full page' : ''}, waited ${waitMs}ms)`);
  ws.close();
} catch (e) { console.error('FAILED', e.message); process.exitCode = 1; }
finally { clearTimeout(timer); kill(); }
