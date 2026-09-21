// Does the landing card make the right compact decision when the web fonts arrive late?
// usage: node fontdelay.mjs <base-url>
// env: DELAY=4000 (ms added to every .woff2 response), LOCALES="en ja hi", VIEWPORTS="1440x900 1366x768"
// For each case it waits until the page has settled, then compares the card's actual state with
// the decision a measurement in the real face gives: full card height (stage compact class taken
// off for one synchronous read) against the first screen. "wrong" = the two disagree.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';

const [base] = process.argv.slice(2);
const DELAY = Number(process.env.DELAY || 4000);
const LOCALES = (process.env.LOCALES || 'en ja hi').split(' ');
const VIEWPORTS = (process.env.VIEWPORTS || '1440x900 1366x768 1280x720').split(' ');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const STATE = `(() => {
  const stage = document.querySelector('.ed-night-stage');
  const card = document.querySelector('.ed-night-card');
  const compact = stage.classList.contains('is-compact');
  const cardTop = card.getBoundingClientRect().top + window.scrollY;
  stage.classList.remove('is-compact');
  const full = card.offsetHeight;
  if (compact) stage.classList.add('is-compact');
  const wantCompact = cardTop + full + 24 > window.innerHeight;
  return { compact, wantCompact, fonts: document.fonts.status, cardBottom: Math.round(card.getBoundingClientRect().bottom), vh: innerHeight, full };
})()`;

async function check(loc, vp) {
  const [width, height] = vp.split('x').map(Number);
  const port = 9300 + Math.floor(Math.random() * 400);
  const dir = fs.mkdtempSync(os.tmpdir() + '/fontdelay-');
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
  try {
    let ws;
    for (let i = 0; i < 50 && !ws; i++) {
      await sleep(200);
      try { ws = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl; } catch {}
    }
    const sock = new WebSocket(ws);
    await new Promise((r) => sock.addEventListener('open', r, { once: true }));
    let id = 0;
    const pending = new Map();
    const send = (method, params = {}) => new Promise((res) => { const k = ++id; pending.set(k, res); sock.send(JSON.stringify({ id: k, method, params })); });
    sock.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
      if (m.method === 'Fetch.requestPaused') {
        setTimeout(() => send('Fetch.continueRequest', { requestId: m.params.requestId }), DELAY);
      }
    });
    await send('Network.enable');
    await send('Network.setCacheDisabled', { cacheDisabled: true });
    if (DELAY > 0) await send('Fetch.enable', { patterns: [{ urlPattern: '*.woff2', requestStage: 'Request' }] });
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: `${base}/${loc === 'en' ? '' : loc}` });
    await sleep(DELAY + 9000);
    const r = await send('Runtime.evaluate', { expression: STATE, returnByValue: true });
    sock.close();
    return r.result.result.value;
  } finally {
    const exited = new Promise((r) => chrome.once('exit', r));
    chrome.kill();
    await exited;
    try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
  }
}

let wrong = 0;
for (const loc of LOCALES) {
  for (const vp of VIEWPORTS) {
    const s = await check(loc, vp);
    const ok = s.compact === s.wantCompact;
    if (!ok) wrong += 1;
    console.log(`${loc.padEnd(3)} ${vp.padEnd(9)} compact=${String(s.compact).padEnd(5)} real-face decision=${String(s.wantCompact).padEnd(5)} card bottom ${s.cardBottom}/${s.vh} fonts=${s.fonts} ${ok ? 'ok' : 'WRONG'}`);
  }
}
console.log(`\nfont delay ${DELAY} ms: ${wrong} wrong decision(s)`);
