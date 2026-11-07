// Performance and resource audit for the site's heavy features, in real Chrome over the DevTools protocol. No packages: Node 22+ and Chrome.
//   node scripts/dev.mjs 8888                       (in another terminal)
//   node scripts/audit.mjs [--out file.json] [--only a,b] [--cpu 4] [--quick] [--check]
// Scenarios (--only): load, idle, swarm, editions, renaissance, leaks, chat, particles, labs. Each is measured with the CPU throttled (default 4x,
// roughly a mid-range phone). It records frame times (p50, p95, jank), long tasks, rAF callbacks per frame, timers per second, running animations,
// DOM nodes, JS heap, event listeners, bytes and requests, and for the leak scenario the change after repeated enter/leave cycles.
// --check compares the results with scripts/audit-budgets.json and exits 1 on a breach (used as the performance gate).
// Caveat: headless Chrome rasterises in software, so paint-heavy effects (blur, blend modes) look slower here than on a real GPU.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const arg = (n, f) => { const i = process.argv.indexOf('--' + n); return i > -1 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) : f; };
const BASE = arg('base', 'http://localhost:8888');
const CPU = Number(arg('cpu', 4));
const QUICK = !!arg('quick', false);
const CHECK = !!arg('check', false);
const OUT = arg('out', '');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ONLY = (arg('only', 'load,idle,swarm,editions,renaissance,leaks,chat,particles,labs') + '').split(',');
const CHROME = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => fs.existsSync(p));
if (!CHROME) { console.error('Chrome not found: set CHROME'); process.exit(2); }

const PLUS = ['swiss-plus', 'editorial-plus', 'brutalist-plus', 'bauhaus-plus', 'minimal-plus', 'neural-plus', 'cosmos-plus'].filter((n) => !arg('editions', '') || (arg('editions', '') + '').split(',').includes(n));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Compares results with scripts/audit-budgets.json and prints every breach. Returns the number of breaches.
function evaluate(results) {
  const b = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'audit-budgets.json'), 'utf8'));
  let n = 0;
  const breach = (k, v, lim) => { if (v > lim) { n++; console.log('BREACH', k, v, '>', lim); } };
  for (const [name, r] of Object.entries(results.scenarios)) {
    if (name.startsWith('edition:')) { const x = b.edition; breach(`${name} scroll p95 frame ms`, r.scroll.frameP95, x.frameP95Ms); breach(`${name} idle p95 frame ms`, r.idle.frameP95, x.frameP95Ms); breach(`${name} entry KB`, r.entry.bytesKB, x.entryKB); breach(`${name} nodes left behind`, r.leftNodes, x.nodesLeftBehind); }
    if (name.startsWith('leak:')) { const x = b.leak; breach(`${name} heap growth MB`, r.heapGrowthMB, x.heapGrowthMB); breach(`${name} node growth`, r.nodeGrowth, x.nodeGrowth); breach(`${name} listener growth`, r.listenerGrowth, x.listenerGrowth); }
    if (name.startsWith('swarm:')) { const x = b.swarm; breach(`${name} p95 frame ms`, r.summary.frameP95, x.frameP95Ms); breach(`${name} long task ms`, r.summary.longTaskMs, x.longTaskMs); }
    if (name === 'idle:default') breach('idle p95 frame ms', r.summary.frameP95, b.idle.frameP95Ms);
    if (name === 'chat:stream') breach('chat p95 frame ms', r.summary.frameP95, b.chat.frameP95Ms);
    if (name.startsWith('load:')) breach(`${name} script KB`, r.byTypeKB.Script || 0, b.load.scriptKB);
  }
  console.log(n ? `${n} budget breach(es)` : 'all budgets met');
  return n;
}

// --from file.json checks saved results against the budgets without running anything.
const FROM = arg('from', '');
if (FROM) { const saved = JSON.parse(fs.readFileSync(FROM, 'utf8')); process.exit(evaluate(saved) ? 1 : 0); }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-'));
const port = 9500 + Math.floor(Math.random() * 400);
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--js-flags=--expose-gc', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let targets;
for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.find((t) => t.type === 'page')) break; } catch { /* retry */ } await sleep(250); }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const handlers = {};
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else if (d.method && handlers[d.method]) handlers[d.method](d.params); };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => { const r = (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result; if (r?.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval failed'); return r?.result?.value; };

// ---- bytes and requests ----
let net = { bytes: 0, requests: 0, byType: {} };
const reqType = new Map();
handlers['Network.responseReceived'] = (p) => reqType.set(p.requestId, p.type);
handlers['Network.loadingFinished'] = (p) => { net.bytes += p.encodedDataLength || 0; net.requests += 1; const t = reqType.get(p.requestId) || 'Other'; net.byType[t] = (net.byType[t] || 0) + (p.encodedDataLength || 0); };
const netReset = () => { net = { bytes: 0, requests: 0, byType: {} }; };

const SAMPLER = `(function(){
  if (window.__aud) return;
  var a = window.__aud = { frames: [], raf: 0, timers: 0, long: [], shifts: 0, on: false, t0: 0 };
  var raf = window.requestAnimationFrame;
  window.requestAnimationFrame = function (cb) { a.raf++; return raf.call(window, cb); };
  var st = window.setTimeout; window.setTimeout = function () { a.timers++; return st.apply(window, arguments); };
  var si = window.setInterval; window.setInterval = function () { a.timers++; return si.apply(window, arguments); };
  var last = 0;
  function tick(t) { if (a.on) { if (last) a.frames.push(t - last); last = t; } else last = 0; raf.call(window, tick); }
  raf.call(window, tick);
  try { new PerformanceObserver(function (l) { l.getEntries().forEach(function (e) { if (a.on) a.long.push(e.duration); }); }).observe({ entryTypes: ['longtask'] }); } catch (e) {}
  try { new PerformanceObserver(function (l) { l.getEntries().forEach(function (e) { if (a.on && !e.hadRecentInput) a.shifts += e.value; }); }).observe({ entryTypes: ['layout-shift'] }); } catch (e) {}
  a.start = function () { a.frames = []; a.long = []; a.shifts = 0; a.raf = 0; a.timers = 0; a.t0 = performance.now(); a.on = true; };
  a.stop = function () {
    a.on = false;
    return { dur: performance.now() - a.t0, frames: a.frames.slice(), long: a.long.slice(), shifts: a.shifts, raf: a.raf, timers: a.timers,
      anims: document.getAnimations ? document.getAnimations().length : 0, nodes: document.getElementsByTagName('*').length, canvases: document.querySelectorAll('canvas').length };
  };
})()`;

function pct(arr, p) { if (!arr.length) return 0; const s = arr.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; }
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
function summarize(s) {
  const f = s.frames;
  const sec = s.dur / 1000;
  return {
    seconds: round(sec),
    fps: round(f.length / sec),
    frameP50: round(pct(f, 0.5)), frameP95: round(pct(f, 0.95)), frameMax: round(Math.max(0, ...f)),
    jankPct: round(100 * f.filter((x) => x > 50).length / Math.max(1, f.length)),
    longTasks: s.long.length, longTaskMs: round(s.long.reduce((x, y) => x + y, 0), 0),
    rafPerFrame: round(Math.max(0, s.raf / Math.max(1, f.length) ), 2), timersPerSec: round(s.timers / sec, 1),
    animations: s.anims, canvases: s.canvases, layoutShift: round(s.shifts, 3),
  };
}

async function metrics() {
  await send('HeapProfiler.collectGarbage');
  const m = Object.fromEntries((await send('Performance.getMetrics')).result.metrics.map((x) => [x.name, x.value]));
  return { heapMB: round(m.JSHeapUsedSize / 1048576, 2), nodes: m.Nodes, listeners: m.JSEventListeners, docs: m.Documents, layouts: m.LayoutCount, styleRecalcs: m.RecalcStyleCount, scriptMs: round(m.ScriptDuration * 1000, 0), layoutMs: round(m.LayoutDuration * 1000, 0), styleMs: round(m.RecalcStyleDuration * 1000, 0), taskMs: round(m.TaskDuration * 1000, 0) };
}

async function fresh(url, { vp = 'desktop', cpu = CPU, reduce = false } = {}) {
  const w = vp === 'phone' ? 390 : 1440, h = vp === 'phone' ? 844 : 900;
  await send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: vp === 'phone' });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }, { name: 'prefers-color-scheme', value: 'light' }] });
  netReset();
  await send('Page.navigate', { url: BASE + url });
  await sleep(2200);
  await ev(`sessionStorage.setItem('kt-edition-intro','1'); 1`);
  const loaded = { ...net, byType: { ...net.byType } };
  await send('Emulation.setCPUThrottlingRate', { rate: cpu });
  return loaded;
}
const startS = () => ev('window.__aud.start(), 1');
const stopS = async () => summarize(await ev('window.__aud.stop()'));
const until = (cond, ms = 15000) => ev(`new Promise(function(r){ var t0=performance.now(); (function p(){ if (${cond}) r(Math.round(performance.now()-t0)); else if (performance.now()-t0>${ms}) r(-1); else setTimeout(p, 50); })(); })`);
const scrollRun = (ms) => ev(`new Promise(function(r){ var h=document.documentElement.scrollHeight-innerHeight; var t0=performance.now(); (function s(){ var k=Math.min(1,(performance.now()-t0)/${ms}); window.scrollTo(0,h*k); if(k<1) requestAnimationFrame(s); else { window.scrollTo(0,0); r(1); } })(); })`);

const R = { meta: { when: new Date().toISOString().slice(0, 10), cpuThrottle: CPU, quick: QUICK, chrome: 'headless=new, software rasteriser' }, scenarios: {} };
const log = (k, v) => { R.scenarios[k] = v; console.log(k, JSON.stringify(v.summary || v).slice(0, 220)); };

async function run() {
  const idleMs = QUICK ? 2000 : 4000;
  const scrollMs = QUICK ? 3000 : 7000;

  if (ONLY.includes('load')) {
    for (const [name, url] of [['load:corporate', '/'], ['load:design', '/design/'], ['load:data', '/data/']]) {
      const loaded = await fresh(url);
      const m = await metrics();
      log(name, { bytesKB: round(loaded.bytes / 1024, 0), requests: loaded.requests, byTypeKB: Object.fromEntries(Object.entries(loaded.byType).map(([k, v]) => [k, round(v / 1024, 0)])), ...m, note: 'uncompressed: the local server does not gzip' });
    }
  }

  if (ONLY.includes('idle')) {
    await fresh('/design/'); await ev(SAMPLER); await sleep(300);
    await startS(); await sleep(idleMs);
    log('idle:default', { summary: await stopS(), ...(await metrics()) });
  }

  if (ONLY.includes('swarm')) {
    for (const speed of QUICK ? [4] : [1, 4]) {
      await fresh('/design/'); await ev(SAMPLER); await sleep(300);
      const before = await metrics();
      netReset();
      await startS();
      const done = await ev(`(function(){ swarmRebuild(); return new Promise(function(r){ setTimeout(function(){ var b=document.querySelector('.sw-speed'); if (b && ${speed} >= 2) { b.click(); if (${speed} === 4) b.click(); } }, 150); var t0=performance.now(); var iv=setInterval(function(){ if (!document.querySelector('.swarm')) { clearInterval(iv); r(Math.round(performance.now()-t0)); } else if (performance.now()-t0 > 90000) { clearInterval(iv); r(-1); } }, 100); }); })()`);
      const s = await stopS();
      const after = await metrics();
      log(`swarm:${speed}x`, { summary: s, runMs: done, heapDeltaMB: round(after.heapMB - before.heapMB, 2), nodesDelta: after.nodes - before.nodes, listenersDelta: after.listeners - before.listeners, scriptMs: after.scriptMs - before.scriptMs, layoutMs: after.layoutMs - before.layoutMs, layouts: after.layouts - before.layouts, styleRecalcs: after.styleRecalcs - before.styleRecalcs });
    }
  }

  async function edition(name, vp = 'desktop') {
    const loaded = await fresh('/design/', { vp }); await ev(SAMPLER); await sleep(300);
    const before = await metrics();
    netReset();
    const t0 = Date.now();
    await ev(name === 'renaissance-plus' ? `window.Edition.enter(), 1` : `document.documentElement.setAttribute('data-style','${name}'), 1`);
    const ready = await until(name === 'renaissance-plus' ? `!!document.querySelector('.ren-top')` : `!!document.querySelector('.px-hud')`);
    const enterMs = Date.now() - t0;
    const entry = { bytesKB: round(net.bytes / 1024, 0), requests: net.requests };
    await sleep(1200);
    await startS(); await sleep(idleMs);
    const idle = await stopS();
    await startS(); await scrollRun(scrollMs);
    const scroll = await stopS();
    const active = await metrics();
    await ev(name === 'renaissance-plus' ? `window.Edition.leave(), 1` : `(function(){ var b=document.querySelector('.px-hud .px-btn:last-child'); if (b) b.click(); return 1; })()`);
    await sleep(1500);
    const left = await metrics();
    return { ready, enterMs, entry, idle, scroll, activeNodes: active.nodes - before.nodes, activeHeapMB: round(active.heapMB - before.heapMB, 2), activeListeners: active.listeners - before.listeners, leftNodes: left.nodes - before.nodes, leftHeapMB: round(left.heapMB - before.heapMB, 2), leftListeners: left.listeners - before.listeners, summary: scroll };
  }

  if (ONLY.includes('editions')) {
    for (const name of PLUS) log(`edition:${name}`, await edition(name));
    if (!QUICK) log('edition:neural-plus:phone', await edition('neural-plus', 'phone'));
    if (!QUICK) log('edition:cosmos-plus:phone', await edition('cosmos-plus', 'phone'));
  }

  if (ONLY.includes('renaissance')) log('edition:renaissance-plus', await edition('renaissance-plus'));

  if (ONLY.includes('leaks')) {
    const cycles = QUICK ? 3 : 5;
    for (const name of [...PLUS, 'renaissance-plus']) {
      await fresh('/design/'); await ev(SAMPLER); await sleep(300);
      const series = [];
      for (let i = 0; i < cycles; i++) {
        await ev(name === 'renaissance-plus' ? `window.Edition.enter(), 1` : `document.documentElement.setAttribute('data-style','${name}'), 1`);
        await until(name === 'renaissance-plus' ? `!!document.querySelector('.ren-top')` : `!!document.querySelector('.px-hud')`);
        await sleep(900);
        await ev(name === 'renaissance-plus' ? `window.Edition.leave(), 1` : `(function(){ var b=document.querySelector('.px-hud .px-btn:last-child'); if (b) b.click(); return 1; })()`);
        await sleep(900);
        series.push(await metrics());
      }
      const a = series[0], b = series[series.length - 1];
      log(`leak:${name}`, { cycles, heapMB: series.map((x) => x.heapMB), nodes: series.map((x) => x.nodes), listeners: series.map((x) => x.listeners), heapGrowthMB: round(b.heapMB - a.heapMB, 2), nodeGrowth: b.nodes - a.nodes, listenerGrowth: b.listeners - a.listeners });
    }
  }

  if (ONLY.includes('chat')) {
    await fresh('/design/'); await ev(SAMPLER); await sleep(300);
    await ev(`(function(){ var orig = window.fetch; window.fetch = function (u, o) { if (/\\/api\\/chat/.test(String(u))) { return Promise.resolve(new Response(new ReadableStream({ start: function (c) { var i = 0; var t = setInterval(function () { c.enqueue(new TextEncoder().encode('word' + i + ' ')); if (++i > 80) { clearInterval(t); c.close(); } }, 40); } }), { status: 200, headers: { 'Content-Type': 'text/plain' } })); } return orig.apply(this, arguments); }; return 1; })()`);
    const before = await metrics();
    await ev(`document.getElementById('chatFab').click(), 1`); await sleep(500);
    await startS();
    await ev(`(function(){ var i = document.getElementById('chatInput'); i.value = 'What has he built?'; document.getElementById('chatForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); return 1; })()`);
    await sleep(4200);
    const s = await stopS();
    const after = await metrics();
    log('chat:stream', { summary: s, heapDeltaMB: round(after.heapMB - before.heapMB, 2), nodesDelta: after.nodes - before.nodes, listenersDelta: after.listeners - before.listeners, replyChars: await ev(`(document.querySelector('#chatLog .msg--bot:last-child')||{textContent:''}).textContent.length`) });
  }

  if (ONLY.includes('particles')) {
    const loaded = await fresh('/particles/'); await ev(SAMPLER); await sleep(300);
    await startS(); await sleep(idleMs);
    log('particles:idle', { summary: await stopS(), loadKB: round(loaded.bytes / 1024, 0), ...(await metrics()) });
  }

  if (ONLY.includes('labs')) {
    const slugs = fs.readdirSync(path.join(ROOT, 'lab')).filter((n) => fs.existsSync(path.join(ROOT, 'lab', n, 'index.html')));
    for (const slug of slugs) {
      const loaded = await fresh(`/lab/${slug}/`); await ev(SAMPLER); await sleep(300);
      await startS(); await sleep(QUICK ? 1500 : 3000);
      log(`lab:${slug}`, { summary: await stopS(), loadKB: round(loaded.bytes / 1024, 0), requests: loaded.requests, ...(await metrics()) });
    }
  }
}

await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('Performance.enable'); await send('HeapProfiler.enable');
await send('Page.addScriptToEvaluateOnNewDocument', { source: SAMPLER });
let failed = 0;
try {
  await run();
} finally {
  ws.close(); proc.kill();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* chrome may still hold the profile */ }
}

if (OUT) { fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(R, null, 1)); console.log('wrote', OUT); }

if (CHECK) failed = evaluate(R);
process.exit(failed ? 1 : 0);
