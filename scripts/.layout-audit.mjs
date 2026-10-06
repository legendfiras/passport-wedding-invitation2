import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const [chromePath, pageUrl, suffix = 'audit'] = process.argv.slice(2);
const profile = await mkdtemp(join(tmpdir(), 'passport-layout-'));
const chrome = spawn(chromePath, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu', '--hide-scrollbars', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
const websocketUrl = await new Promise((resolveUrl, reject) => {
  const timer = setTimeout(() => reject(new Error('Chrome DevTools did not start.')), 15000);
  chrome.stderr.on('data', chunk => { const match = chunk.toString().match(/DevTools listening on (ws:\/\/\S+)/); if (match) { clearTimeout(timer); resolveUrl(match[1]); } });
  chrome.once('exit', code => reject(new Error(`Chrome exited early (${code}).`)));
});
const socket = new WebSocket(websocketUrl);
await new Promise((resolveOpen, reject) => { socket.addEventListener('open', resolveOpen, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let nextId = 0;
const pending = new Map();
const errors = [];
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id) { const request = pending.get(message.id); pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }
  else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  else if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry.text);
});
function send(method, params = {}, sessionId) { const id = ++nextId; socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); return new Promise((resolveRequest, reject) => pending.set(id, { resolve: resolveRequest, reject })); }
const delay = ms => new Promise(resolveDelay => setTimeout(resolveDelay, ms));
const target = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
await send('Page.enable', {}, sessionId); await send('Runtime.enable', {}, sessionId); await send('Log.enable', {}, sessionId);
async function evaluate(expression) { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId); return result.result.value; }
async function ready() { for (let i = 0; i < 60; i++) { if (await evaluate('document.readyState') === 'complete') return; await delay(100); } throw new Error('Page did not load.'); }
async function shot(name, full = false) { const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full }, sessionId); const path = join(tmpdir(), name); await writeFile(path, Buffer.from(result.data, 'base64')); return path; }
const rectExpression = selector => `(() => { const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height),bottom:Math.round(r.bottom)} })()`;

async function audit(label, width, height) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: width < 700 }, sessionId);
  await send('Page.navigate', { url: pageUrl }, sessionId); await ready(); await delay(400);
  const initial = {
    viewport: { width, height, dpr: await evaluate('devicePixelRatio') },
    entry: await evaluate(rectExpression('#passportEntry')),
    stage: await evaluate(rectExpression('.passport-stage')),
    cover: await evaluate(rectExpression('.cover-face')),
    action: await evaluate(rectExpression('.passport-action')),
    horizontalOverflow: await evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth'),
  };
  const closedScreenshot = await shot(`passport-${label}-${suffix}-closed.png`);
  await evaluate("document.getElementById('openInvitation').click()"); await delay(3800);
  const opened = await evaluate(`(async () => {
    const rect = selector => { const r=document.querySelector(selector).getBoundingClientRect(); return {top:Math.round(r.top+scrollY),height:Math.round(r.height),bottom:Math.round(r.bottom+scrollY)} };
    const backgrounds = [];
    for (const element of document.querySelectorAll('*')) {
      const style = getComputedStyle(element); const match = style.backgroundImage.match(/url\\(["']?(.*?)["']?\\)/);
      if (!match || !match[1] || match[1].startsWith('data:')) continue;
      const box = element.getBoundingClientRect();
      backgrounds.push({ className: element.className || element.tagName, file: new URL(match[1], location.href).pathname.split('/').pop(), width: Math.round(box.width), height: Math.round(box.height), backgroundSize: style.backgroundSize });
    }
    return {
      sections: ['.hero','.story','.destinations','.rsvp'].map(selector => ({selector,...rect(selector)})),
      book: rect('#bookMount'),
      documentHeight: document.documentElement.scrollHeight,
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      backgrounds,
      rsvpReachable: !!document.getElementById('rsvpForm'),
    };
  })()`);
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 700 }, sessionId);
  const openedScreenshot = await shot(`passport-${label}-${suffix}-opened-full.png`, true);
  return { label, initial, opened, closedScreenshot, openedScreenshot };
}
try {
  const results = [await audit('mobile', 390, 844), await audit('desktop', 1440, 1000)];
  console.log(JSON.stringify({ results, errors }, null, 2));
} finally {
  await send('Browser.close').catch(() => {}); socket.close(); await new Promise(resolveExit => chrome.once('exit', resolveExit));
  if (resolve(profile).startsWith(resolve(tmpdir()))) await rm(profile, { recursive: true, force: true }).catch(() => {});
}
