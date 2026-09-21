// MAJOR-2 check: does a parked pointer keep the citation field's loop alive?
// usage: node rafcheck.mjs <url>
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
const [url] = process.argv.slice(2);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9300 + Math.floor(Math.random() * 400);
const profile = fs.mkdtempSync(os.tmpdir() + '/rafcheck-');
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const COUNT = `new Promise((resolve) => { let n = 0; const orig = window.requestAnimationFrame; window.requestAnimationFrame = (cb) => { n++; return orig.call(window, cb); }; setTimeout(() => { window.requestAnimationFrame = orig; resolve(n); }, 2000); })`;
async function main() {
  let ws;
  for (let i = 0; i < 50 && !ws; i++) { await sleep(200); try { const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); ws = l.find((t) => t.type === 'page')?.webSocketDebuggerUrl; } catch {} }
  const sock = new WebSocket(ws); await new Promise((r) => sock.addEventListener('open', r, { once: true }));
  let id = 0; const pending = new Map();
  sock.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  const send = (method, params = {}) => new Promise((res) => { const n = ++id; pending.set(n, res); sock.send(JSON.stringify({ id: n, method, params })); });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  await sleep(7000); // let the sequence finish
  const count = async () => (await send('Runtime.evaluate', { expression: COUNT, awaitPromise: true, returnByValue: true })).result.result.value;
  console.log('idle, no pointer:           rAF in 2s =', await count());
  for (let i = 0; i < 12; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 600 + i * 15, y: 720 }); await sleep(40); }
  console.log('while the pointer moves:    rAF in 2s =', await count());
  await sleep(3500); // parked: idle timer 1.2s + fade
  console.log('pointer parked 3.5s later:  rAF in 2s =', await count());
  const at = await send('Runtime.evaluate', { expression: `(() => { const e = document.elementFromPoint(720, 720); return e.tagName + '.' + e.className; })()`, returnByValue: true });
  console.log('topmost element under the pointer:', at.result.result.value);
  sock.close(); chrome.kill();
}
main().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
