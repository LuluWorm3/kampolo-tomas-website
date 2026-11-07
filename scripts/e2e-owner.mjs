// End-to-end checks for the private owner page, in real Chrome over the DevTools protocol, against a local mock server with demo data.
//   node scripts/build.mjs && node scripts/e2e-owner.mjs      (starts its own server on port 8890: node scripts/dev.mjs 8890 --mock-api)
// Covers: nothing sensitive in the page source, login and a wrong token, the delay on wrong tries, every panel, charts with table equivalents,
// the token living only in sessionStorage, sign out, lock-out after repeated wrong tries, the metrics endpoint, console errors, overflow, contrast.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : '';
const PORT = 8890;
const BASE = `http://localhost:${PORT}`;
const TOKEN = 'demo-owner-token-demo-owner-12345';
const METRICS = 'demo-metrics-token-demo-metrics-1234';
const CHROME = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => fs.existsSync(p));
if (!CHROME) { console.error('Chrome not found: set CHROME'); process.exit(2); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); if (!ok) console.log('FAIL', id, detail); };

const server = spawn(process.execPath, [path.join(ROOT, 'scripts', 'dev.mjs'), String(PORT), '--mock-api'], { cwd: ROOT, stdio: 'ignore' });
for (let i = 0; i < 60; i++) { try { const r = await fetch(BASE + '/owner/'); if (r.status) break; } catch { /* starting */ } await sleep(250); }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-owner-'));
const port = 9500 + Math.floor(Math.random() * 400);
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let targets;
for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.find((t) => t.type === 'page')) break; } catch { /* retry */ } await sleep(250); }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); let errors = []; const requests = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); return; }
  if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map((a) => a.value || a.description).join(' '));
  if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') errors.push(d.params.entry.text + ' ' + (d.params.entry.url || ''));
  if (d.method === 'Network.requestWillBeSent') requests.push(d.params.request.url);
};
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const run = async (expression) => { const r = (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result; if (r?.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval failed'); return r?.result?.value; };
await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable');

const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

async function open(vp = { w: 1440, h: 900 }, theme = 'light') {
  await send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: vp.w < 700 });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] });
  await send('Page.navigate', { url: BASE + '/owner/' });
  await sleep(1200);
  await run(`sessionStorage.clear(); localStorage.clear(); 1`);
  errors = []; requests.length = 0;
  await send('Page.navigate', { url: BASE + '/owner/' });
  await sleep(1200);
}
const login = async (tok) => {
  await run(`(function(){ var i = document.getElementById('ow-token'); i.value = '${tok}'; document.querySelector('.ow-login').dispatchEvent(new Event('submit', { cancelable: true })); return 1; })()`);
};
const snap = async (name) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await sleep(250); const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(r.result.data, 'base64')); };
const waitFor = (cond, ms = 6000) => run(`new Promise(function(r){ var t0 = performance.now(); (function p(){ if (${cond}) r(true); else if (performance.now() - t0 > ${ms}) r(false); else setTimeout(p, 50); })(); })`);

try {
  // ---- the page itself holds nothing sensitive and counts nothing ----
  const html = await (await fetch(BASE + '/owner/')).text();
  check('page: noindex', /<meta name="robots" content="noindex/.test(html));
  check('page: no data, no token in the source', !html.includes(TOKEN) && !/\d{3,} views/.test(html));
  check('page: does not load the analytics scripts (its own visits are not counted)', !/track\.js|obs\.js/.test(html));
  check('api: summary refuses a request without a token', (await fetch(BASE + '/api/owner/summary')).status === 401);
  check('api: metrics refuses a request without a token', (await fetch(BASE + '/api/metrics')).status === 401);
  check('api: the owner token does not open the metrics endpoint', (await fetch(BASE + '/api/metrics', { headers: { authorization: 'Bearer ' + TOKEN } })).status === 401);
  const metrics = await (await fetch(BASE + '/api/metrics', { headers: { authorization: 'Bearer ' + METRICS } })).text();
  check('api: metrics gives Prometheus text', /# TYPE kt_events_total counter/.test(metrics) && /kt_page_views_total\{path="\/"\} \d+/.test(metrics));
  check('api: responses are not cacheable', (await fetch(BASE + '/api/owner/summary', { headers: { authorization: 'Bearer ' + TOKEN } })).headers.get('cache-control') === 'no-store');

  // ---- login ----
  await open();
  check('login: the form is shown first', await run(`!!document.getElementById('ow-token') && document.getElementById('ow-token').type === 'password'`));
  check('login: the input has a label', await run(`!!document.querySelector('label[for=ow-token]')`));
  const t0 = Date.now();
  await login('this-is-a-wrong-token-1234567890');
  check('login: a wrong token is refused with a message', await waitFor(`/not accepted/.test(document.querySelector('.ow-msg').textContent)`));
  check('login: a wrong answer is delayed', Date.now() - t0 >= 500, String(Date.now() - t0));
  check('login: a wrong token is not kept', await run(`sessionStorage.length === 0`));
  await login(TOKEN);
  check('login: the right token opens the dashboard', await waitFor(`!!document.querySelector('.ow-kpis')`));
  check('login: the token is only in sessionStorage', await run(`sessionStorage.getItem('kt-owner-token') === '${TOKEN}' && localStorage.length === 0 && document.cookie === '' && location.href.indexOf('token') === -1 && location.search === ''`));
  check('login: the token is never sent anywhere but the API as a header', requests.every((u) => !u.includes(TOKEN)));
  await snap('traffic-7');
  check('demo banner is shown for mock data', await run(`!!document.querySelector('.ow-banner') && /made up/.test(document.querySelector('.ow-banner').textContent)`));

  // ---- traffic ----
  check('traffic: seven bars for seven days', await run(`document.querySelectorAll('.ow-chart__bar').length === 7`));
  check('traffic: the chart has a text description', await run(`/Page views per day/.test(document.querySelector('.ow-chart').getAttribute('aria-label'))`));
  check('traffic: the table equivalent matches the chart', await run(`(function(){ var d = document.querySelector('.ow-det'); d.open = true; var rows = [...d.querySelectorAll('tbody tr')]; var bars = [...document.querySelectorAll('.ow-chart__bar title')].map(function(t){ return t.textContent; }); return rows.length === 7 && rows.every(function(r, i){ return bars[i].indexOf(r.children[0].textContent) === 0 && bars[i].indexOf(r.children[1].textContent.replace(/,/g,'')) > -1; }); })()`));
  check('traffic: page, persona, referrer, country and device lists are filled', await run(`document.querySelectorAll('.ow-bars').length >= 6 && [...document.querySelectorAll('.ow-bars')].slice(0, 5).every(function(u){ return u.children.length > 0; })`));
  await run(`[...document.querySelectorAll('.ow-bar .lab-controls')][1].children[2].click(); 1`);
  check('traffic: the 30 day range shows thirty bars', await waitFor(`document.querySelectorAll('.ow-chart__bar').length === 30`));

  // ---- health, cost, audit, set-up ----
  const tab = (name) => run(`[...document.querySelectorAll('.ow-bar .lab-controls')][0].children[${name}].click(); 1`);
  await tab(1); await snap('health');
  check('health: four Web Vitals with a rating and thresholds', await run(`document.querySelectorAll('.ow-vital').length === 4 && [...document.querySelectorAll('.ow-vital .lab-badge')].every(function(b){ return b.textContent.length > 2; })`));
  check('health: the error table is filled and says what was removed', await run(`document.querySelectorAll('table caption').length >= 2 && [...document.querySelectorAll('.ow-note')].some(function(n){ return /removed/.test(n.textContent); })`));
  check('health: feature timings are listed', await run(`[...document.querySelectorAll('table caption')].some(function(c){ return c.textContent === 'Feature timings'; })`));
  await tab(2); await snap('cost');
  check('cost: tokens, the cap meter and a model table', await run(`!!document.querySelector('meter.ow-meter') && [...document.querySelectorAll('table caption')].some(function(c){ return /estimated cost/.test(c.textContent); })`));
  check('cost: without prices there is no invented estimate', await run(`[...document.querySelectorAll('tbody td')].some(function(t){ return t.textContent === 'not set'; })`));
  await tab(3); await snap('audit');
  check('audit: a message or a table is shown', await waitFor(`document.querySelector('.ow-panel .ow-note') !== null && (document.querySelector('table') !== null || /No audit results/.test(document.querySelector('.ow-panel').textContent))`));
  await tab(4); await snap('setup');
  check('set-up: shows set or not set, never a value', await run(`(function(){ var t = document.body.textContent; return /OWNER_TOKEN/.test(t) && !t.includes('${TOKEN}') && !t.includes('${METRICS}'); })()`));
  check('set-up: the owner token reads as set', await run(`[...document.querySelectorAll('tbody tr')].some(function(r){ return r.children[0].textContent === 'OWNER_TOKEN' && r.children[1].textContent === 'Set'; })`));

  // ---- layout, contrast, errors ----
  for (const [vp, theme] of [[{ w: 1440, h: 900 }, 'light'], [{ w: 1440, h: 900 }, 'dark'], [{ w: 390, h: 844 }, 'light'], [{ w: 390, h: 844 }, 'dark']]) {
    await open(vp, theme);
    await login(TOKEN);
    await waitFor(`!!document.querySelector('.ow-kpis')`);
    const tag = `${vp.w}px ${theme}`;
    await snap(`traffic-${vp.w}-${theme}`);
    check(`${tag}: no horizontal overflow`, await run(`document.documentElement.scrollWidth <= ${vp.w} + 1`), String(await run(`document.documentElement.scrollWidth`)));
    const pairs = await run(`(function(){ function p(c){ var m=c.match(/rgba?\\(([^)]+)\\)/); if(!m) return null; var a=m[1].split(/[ ,\\/]+/).map(parseFloat); return {r:a[0],g:a[1],b:a[2],a:a.length>3?a[3]:1}; }
      function bg(e){ for(var n=e;n;n=n.parentElement){ var c=p(getComputedStyle(n).backgroundColor); if(c&&c.a>0.99) return c; } return {r:255,g:255,b:255}; }
      var out=[]; document.querySelectorAll('main p, main li, main td, main th, main h2, main button, main label, main summary').forEach(function(e){ if(!e.offsetParent||!e.textContent.trim()||e.children.length>3) return; var f=p(getComputedStyle(e).color); var b=bg(e); if(f) out.push({f:[f.r,f.g,f.b],b:[b.r,b.g,b.b],big:parseFloat(getComputedStyle(e).fontSize)>=24,t:e.textContent.trim().slice(0,24)}); }); return out; })()`);
    const low = pairs.filter((q) => ratio(lum(...q.f), lum(...q.b)) < (q.big ? 3 : 4.5));
    check(`${tag}: text contrast`, low.length === 0, low.slice(0, 3).map((q) => q.t + ' ' + ratio(lum(...q.f), lum(...q.b)).toFixed(2)).join(' | '));
    check(`${tag}: no console or CSP errors`, errors.length === 0, errors.slice(0, 2).join(' | '));
  }

  // ---- sign out, then lock-out after repeated wrong tries ----
  await open();
  await login(TOKEN);
  await waitFor(`!!document.querySelector('.ow-kpis')`);
  await run(`[...document.querySelectorAll('.ow-bar > .btn')][0].click(); 1`);
  check('sign out: back to the form with the token gone', await waitFor(`!!document.getElementById('ow-token')`) && await run(`sessionStorage.length === 0`));
  for (let i = 0; i < 5; i++) { await login('wrong-token-wrong-token-wrong-' + i); await waitFor(`/not accepted|Too many/.test(document.querySelector('.ow-msg').textContent)`); }
  await login(TOKEN);
  check('lock-out: after repeated wrong tries even the right token waits', await waitFor(`/Too many/.test(document.querySelector('.ow-msg').textContent)`));
} finally {
  ws.close(); proc.kill(); server.kill();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* chrome may still hold the profile */ }
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
