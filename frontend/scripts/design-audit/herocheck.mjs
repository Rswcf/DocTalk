// Hero geometry + pixel check across viewports (review 2026-09-21 MAJOR-1/3).
// usage: node herocheck.mjs <base-url> <out-dir>   → writes <loc>-<WxH>.png, <loc>-<WxH>-off.png, geometry.json
// env: VIEWPORTS="1440x900 1366x768" LOCALES="en de ja" (default en). The -off render removes the claim
// pool AND the field's fade mask: identical passage pixels in both renders mean neither dims the citation.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';

const [base, outDir] = process.argv.slice(2);
const VIEWPORTS = (process.env.VIEWPORTS || '1440x900 1366x768 1366x650 1280x720 1024x768 1920x1080').split(' ');
const LOCALES = (process.env.LOCALES || 'en').split(' ');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9300 + Math.floor(Math.random() * 400);
const profile = fs.mkdtempSync(os.tmpdir() + '/herocheck-');
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(outDir, { recursive: true });

const GEOMETRY = `(() => {
  const stage = document.querySelector('.ed-night-stage');
  const claim = document.querySelector('.ed-night-claim');
  const card = document.querySelector('.ed-night-card');
  const sr = stage.getBoundingClientRect(), cr = claim.getBoundingClientRect(), kr = card.getBoundingClientRect();
  const gap = Math.min(64, Math.max(32, Math.round(stage.clientHeight * 0.06))); /* HeroSection passageGap() */
  const at = document.elementFromPoint(innerWidth / 2, cr.bottom + gap + 20);
  return {
    vh: innerHeight, stageTop: Math.round(sr.top), stageH: Math.round(sr.height),
    claimBottom: Math.round(cr.bottom), poolBottom: Math.round(cr.bottom + 32) /* .ed-night-claim::before bottom */, passageTop: Math.round(cr.bottom + gap),
    cardTop: Math.round(kr.top), cardBottom: Math.round(kr.bottom), cardLeft: Math.round(kr.left),
    cardOpacity: getComputedStyle(card).opacity,
    topmostAtPassage: at ? at.tagName.toLowerCase() + '.' + String(at.className).split(' ')[0] : null,
    h1px: parseFloat(getComputedStyle(document.querySelector('.ed-night-claim h1')).fontSize),
  };
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
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  const out = {};
  for (const loc of LOCALES) for (const vp of VIEWPORTS) {
    const [w, h] = vp.split('x').map(Number);
    const key = `${loc}-${vp}`;
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: `${base}${loc === 'en' ? '' : '/' + loc}/?still` });
    await sleep(3000);
    const g = await send('Runtime.evaluate', { expression: GEOMETRY, returnByValue: true });
    out[key] = g.result?.result?.value || g.result?.exceptionDetails;
    const a = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${outDir}/${key}.png`, Buffer.from(a.result.data, 'base64'));
    await send('Runtime.evaluate', { expression: `document.head.insertAdjacentHTML('beforeend','<style>.dt-editorial .ed-night-claim::before{display:none!important}.dt-editorial .ed-night-field{-webkit-mask-image:none!important;mask-image:none!important}</style>')` });
    await sleep(400);
    const b = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${outDir}/${key}-off.png`, Buffer.from(b.result.data, 'base64'));
    process.stdout.write(`${key} ${JSON.stringify(out[key])}\n`);
  }
  fs.writeFileSync(`${outDir}/geometry.json`, JSON.stringify(out, null, 2));
  sock.close(); chrome.kill();
}
main().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
