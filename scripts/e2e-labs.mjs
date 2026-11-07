// End-to-end checks for the lab pages (/lab/<slug>/), in real Chrome over the DevTools protocol. No packages: Node 22+ and Chrome.
//   node scripts/dev.mjs 8888          (in another terminal)
//   node scripts/e2e-labs.mjs [--base http://localhost:8888] [--lab slug,slug] [--shots dir]
// Per lab and theme and viewport: loads, noindex, no console or CSP errors, no horizontal overflow, every internal link and image
// resolves, body-text contrast, one h1, buttons and inputs have names, reduced motion stops animations. A lab may add its own checks
// in scripts/labs/<slug>.e2e.json: [{ "name": "...", "js": "<expression that must be true>" }].
// Exit code 1 when any check fails.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const arg = (name, fallback) => { const i = process.argv.indexOf('--' + name); return i > -1 ? process.argv[i + 1] : fallback; };
const BASE = arg('base', 'http://localhost:8888');
const SHOTS = arg('shots', '');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => fs.existsSync(p));
if (!CHROME) { console.error('Chrome not found: set CHROME'); process.exit(2); }

const labsDir = path.join(ROOT, 'scripts', 'labs');
const all = fs.existsSync(labsDir) ? fs.readdirSync(labsDir).filter((n) => n.endsWith('.mjs') && !n.startsWith('_')).map((n) => n.replace(/\.mjs$/, '')) : [];
const only = arg('lab', '');
const SLUGS = [];
for (const f of all) {
  const lab = (await import(new URL('file:///' + path.join(labsDir, f + '.mjs').replace(/\\/g, '/')).href)).default;
  if (!only || only.split(',').includes(lab.slug)) SLUGS.push({ slug: lab.slug, file: f });
}
if (!SLUGS.length) { console.log('no labs found'); process.exit(0); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); if (!ok) console.log('FAIL', id, detail); };

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-labs-'));
const port = 9500 + Math.floor(Math.random() * 400);
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let targets;
for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.find((t) => t.type === 'page')) break; } catch { /* retry */ } await sleep(250); }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); let errors = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); return; }
  if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map((a) => a.value || a.description).join(' '));
  if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') errors.push(d.params.entry.text + ' ' + (d.params.entry.url || ''));
};
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const run = async (expression) => { const r = (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result; if (r?.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval failed'); return r?.result?.value; };
await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');

const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

const VPS = [{ w: 1440, h: 900, name: 'desktop' }, { w: 390, h: 844, name: 'phone' }];
const t0 = Date.now();
try {
  for (const { slug, file } of SLUGS) for (const theme of ['light', 'dark']) for (const vp of VPS) {
    const tag = `lab ${slug} ${theme} ${vp.name}`;
    errors = [];
    await send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: vp.w < 700 });
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await send('Page.navigate', { url: `${BASE}/lab/${slug}/` });
    await sleep(2000);
    check(`${tag}: noindex`, await run(`!!document.querySelector('meta[name=robots][content*=noindex]')`));
    check(`${tag}: one h1`, (await run(`document.querySelectorAll('h1').length`)) === 1);
    check(`${tag}: no horizontal overflow`, await run(`document.documentElement.scrollWidth <= ${vp.w} + 1`), await run(`document.documentElement.scrollWidth`));
    check(`${tag}: demo present`, await run(`!!document.getElementById('lab-demo') && document.getElementById('lab-demo').getBoundingClientRect().height > 40`));
    const bad = await run(`(async function(){
      var out = [];
      var hrefs = [...new Set([...document.querySelectorAll('a[href^="/"], link[href^="/"], script[src^="/"], img[src^="/"], source[srcset^="/"]')].map(function(n){ return (n.getAttribute('href')||n.getAttribute('src')||n.getAttribute('srcset')).split(/[ ,]/)[0].split('#')[0]; }).filter(Boolean))];
      for (var i = 0; i < hrefs.length; i++) { try { var r = await fetch(hrefs[i], { method: 'GET' }); if (!r.ok) out.push(hrefs[i] + ' ' + r.status); } catch (e) { out.push(hrefs[i] + ' error'); } }
      return out; })()`);
    check(`${tag}: internal links and assets resolve`, bad.length === 0, bad.join(', '));
    const bro = await run(`[...document.querySelectorAll('button, input:not([type=hidden]), select, textarea')].filter(function(n){ var l = (n.getAttribute('aria-label') || n.textContent || '').trim() || (n.id && document.querySelector('label[for="'+n.id+'"]')) || n.closest('label') || n.getAttribute('title'); return !l; }).map(function(n){ return n.tagName + '#' + n.id; })`);
    check(`${tag}: controls have names`, bro.length === 0, bro.join(', '));
    const pairs = await run(`(function(){ function p(c){ var m=c.match(/rgba?\\(([^)]+)\\)/); if(!m) return null; var a=m[1].split(/[ ,\\/]+/).map(parseFloat); return {r:a[0],g:a[1],b:a[2],a:a.length>3?a[3]:1}; }
      function bg(e){ for(var n=e;n;n=n.parentElement){ var c=p(getComputedStyle(n).backgroundColor); if(c&&c.a>0.99) return c; } return {r:255,g:255,b:255}; }
      var out=[]; document.querySelectorAll('main p, main li, main td, main th, main figcaption, main h2, main h3, main a').forEach(function(e){ if(!e.offsetParent || !e.textContent.trim() || e.children.length>3) return; var f=p(getComputedStyle(e).color); var b=bg(e); if(f) out.push({f:[f.r,f.g,f.b],b:[b.r,b.g,b.b],big:parseFloat(getComputedStyle(e).fontSize)>=24||(parseFloat(getComputedStyle(e).fontSize)>=18.6&&parseInt(getComputedStyle(e).fontWeight)>=700), t:e.textContent.trim().slice(0,24)}); }); return out; })()`);
    const low = pairs.filter((q) => ratio(lum(...q.f), lum(...q.b)) < (q.big ? 3 : 4.5));
    check(`${tag}: text contrast`, low.length === 0, low.slice(0, 3).map((q) => q.t + ' ' + ratio(lum(...q.f), lum(...q.b)).toFixed(2)).join(' | '));
    const extra = path.join(labsDir, file + '.e2e.json');
    if (fs.existsSync(extra)) for (const c of JSON.parse(fs.readFileSync(extra, 'utf8'))) {
      let got; try { got = await run(`(async function(){ return !!(${c.js}); })()`); } catch (e) { got = 'ERR ' + e.message; }
      check(`${tag}: ${c.name}`, got === true, String(got));
    }
    check(`${tag}: no console errors`, errors.length === 0, errors.slice(0, 2).join(' | '));
    if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); const s = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); fs.writeFileSync(path.join(SHOTS, `${slug}-${theme}-${vp.name}.png`), Buffer.from(s.result.data, 'base64')); }
  }
  for (const { slug } of SLUGS) {
    errors = [];
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await send('Page.navigate', { url: `${BASE}/lab/${slug}/` });
    await sleep(1500);
    const moving = await run(`[...document.querySelectorAll('main *')].filter(function(n){ var cs=getComputedStyle(n); return cs.animationName!=='none' && parseFloat(cs.animationDuration)>0; }).length`);
    check(`lab ${slug}: reduced motion stops animations`, moving === 0, String(moving));
  }
} finally {
  ws.close(); proc.kill();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* chrome may still hold the profile */ }
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed in ${Math.round((Date.now() - t0) / 1000)}s`);
process.exit(failed.length ? 1 : 0);
