// End-to-end checks for the Style lab editions and the chat widget, in real Chrome over the DevTools protocol.
// No packages: Node 22+ (global WebSocket and fetch) and an installed Chrome.
//   node scripts/dev.mjs 8888            (in another terminal)
//   node scripts/e2e.mjs [--base http://localhost:8888] [--only chat|sections] [--style name,name] [--theme light|dark] [--shots dir]
// Exit code 1 when any check fails. Each case enters a style by clicking its button in the picker, like a visitor.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

const arg = (name, fallback) => { const i = process.argv.indexOf('--' + name); return i > -1 ? process.argv[i + 1] : fallback; };
const BASE = arg('base', 'http://localhost:8888');
const ONLY = arg('only', 'all');
const SHOTS = arg('shots', '');
const CHROME = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => fs.existsSync(p));
if (!CHROME) { console.error('Chrome not found: set CHROME'); process.exit(2); }

const SKINS = ['swiss', 'editorial', 'brutalist', 'renaissance', 'bauhaus', 'minimal', 'neural', 'cosmos'];
const PLUS = SKINS.map((s) => s + '-plus');
const STYLES = arg('style', [...SKINS, ...PLUS].join(',')).split(',');
const THEMES = arg('theme', 'light,dark').split(',');
const VIEWPORTS = [{ w: 1440, h: 900, name: 'desktop' }, { w: 390, h: 844, name: 'phone' }];

// Per-edition concept for each section: a computed-style or DOM assertion that proves the layout idea is applied (filled in with the sections).
// One file per edition in scripts/e2e-concepts/<style>.json: { "<section id>": { "name": "...", "js": "<expression that must be true>" } }.
const CONCEPTS = {};
{
  const dir = new URL('./e2e-concepts/', import.meta.url);
  if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) if (f.endsWith('.json')) CONCEPTS[f.replace(/\.json$/, '')] = JSON.parse(fs.readFileSync(new URL(f, dir), 'utf8'));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok, detail }); if (!ok) console.log('FAIL', id, detail); };

// ---- minimal PNG decoder (8-bit, non-interlaced) to measure what is really behind text ----
function decodePng(buf) {
  let p = 8; let w = 0; let h = 0; let ct = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p); const type = buf.toString('ascii', p + 4, p + 8); const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; }
    if (type === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3; const raw = zlib.inflateSync(Buffer.concat(idat)); const stride = w * bpp; const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]; const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)); const out = px.subarray(y * stride, (y + 1) * stride); const prev = y ? px.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? out[i - bpp] : 0; const b = prev ? prev[i] : 0; const c = prev && i >= bpp ? prev[i - bpp] : 0;
      let v = row[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c; const pa = Math.abs(pp - a); const pb = Math.abs(pp - b); const pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[i] = v & 255;
    }
  }
  return { w, h, bpp, px };
}
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

// ---- browser ----
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-'));
const port = 9500 + Math.floor(Math.random() * 400);
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let targets;
for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.find((t) => t.type === 'page')) break; } catch { /* retry */ } await sleep(250); }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); let consoleErrors = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); return; }
  if (d.method === 'Runtime.exceptionThrown') consoleErrors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') consoleErrors.push(d.params.args.map((a) => a.value || a.description).join(' '));
  if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') consoleErrors.push(d.params.entry.text + ' ' + (d.params.entry.url || ''));
};
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const run = async (expression) => { const r = (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result; if (r?.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval failed'); return r?.result?.value; };
const shot = async (clip) => decodePng(Buffer.from((await send('Page.captureScreenshot', { format: 'png', clip: clip && { ...clip, scale: 1 } })).result.data, 'base64'));
const save = async (name) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64')); };
await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');

// ---- in-page helpers, injected once per page load ----
const HELPERS = `(function(){
  function parse(c){ var m=c.match(/rgba?\\(([^)]+)\\)/); if(m){var p=m[1].split(/[ ,\\/]+/).map(parseFloat); return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1};}
    m=c.match(/color\\(srgb ([^)]+)\\)/); if(m){var q=m[1].split(/[ \\/]+/).map(parseFloat); return {r:q[0]*255,g:q[1]*255,b:q[2]*255,a:q.length>3?q[3]:1};} return {r:0,g:0,b:0,a:0}; }
  window.__bg=function(el){ var layers=[]; for(var n=el;n&&n.nodeType===1;n=n.parentElement){ var cs=getComputedStyle(n); if(cs.backgroundImage&&cs.backgroundImage!=='none') return {image:true}; var c=parse(cs.backgroundColor); if(c.a>0){layers.push(c); if(c.a>=0.999) break;} }
    var base={r:255,g:255,b:255}; var cur=base; for(var i=layers.length-1;i>=0;i--){var l=layers[i]; cur={r:cur.r*(1-l.a)+l.r*l.a,g:cur.g*(1-l.a)+l.g*l.a,b:cur.b*(1-l.a)+l.b*l.a};} return cur; };
  window.__fg=function(el){ var c=parse(getComputedStyle(el).color); return c; };
  window.__rect=function(sel){ var e=document.querySelector(sel); if(!e) return null; var r=e.getBoundingClientRect(); return {x:r.left+scrollX,y:r.top+scrollY,w:r.width,h:r.height}; };
  return 1; })()`;

async function load(theme, vp, reduced = false, query = '') {
  await send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: vp.w < 700 });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }] });
  await send('Page.navigate', { url: BASE + '/design/' + query });
  await sleep(1700);
  await run(`sessionStorage.setItem('kt-edition-intro','1'); localStorage.setItem('kt-theme','${theme}'); document.documentElement.dataset.theme='${theme}'; 1`);
  await run(HELPERS);
}
async function enter(style) {
  consoleErrors = [];
  await run(`(function(){ var b=document.querySelector('.style-picker [data-style="${style}"]'); if(!b) throw new Error('no button for ${style}'); b.click(); return 1; })()`);
  await sleep(3200);
}
const lumOf = (c) => lum(c.r, c.g, c.b);

// ---------------------------------------------------------------- chat
async function chatCase(style, theme, vp) {
  const tag = `chat ${style} ${theme} ${vp.name}`;
  await load(theme, vp);
  await enter(style);
  check(`${tag}: style applied`, await run(`(document.documentElement.dataset.style||'swiss')==='${style}'`));
  const plus = style.endsWith('-plus');
  const fab = await run(`(function(){var s=document.querySelector('#chatFab span'); var cs=getComputedStyle(s); var b=getComputedStyle(s,'::before'); var f=document.getElementById('chatFab'); var r=f.getBoundingClientRect();
    return {text:s.textContent.trim(), fs:cs.fontSize, mask:(b.webkitMaskImage||b.maskImage||''), inView:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight, w:r.width, h:r.height, name:f.textContent.replace(/\\s+/g,' ').trim()};})()`);
  check(`${tag}: launcher in view and named`, fab.inView && /Ask about Kampolo/.test(fab.name), JSON.stringify(fab));
  if (plus) check(`${tag}: launcher glyph drawn`, /data:image\/svg/.test(fab.mask) && fab.fs === '0px', JSON.stringify(fab));
  else check(`${tag}: skin launcher keeps its "?"`, fab.text === '?' && fab.fs !== '0px' && !/data:image/.test(fab.mask), JSON.stringify(fab));
  await save(`chat-${style}-${theme}-${vp.name}-fab`);

  await run(`(function(){ document.getElementById('chatFab').click(); var log=document.getElementById('chatLog'); log.innerHTML='';
    function m(c,t){var d=document.createElement('div'); d.className='msg '+c; d.textContent=t; log.appendChild(d);}
    m('msg--bot','Hello, I answer questions about Kampolo from his profile.'); m('msg--user','Which projects used AI coding assistants?'); m('msg--bot','Two of them, and the site says which parts he wrote himself.'); m('msg--err','Sample error line.'); return 1;})()`);
  await sleep(900);
  const panel = await run(`(function(){var c=document.getElementById('chatPanel'); var r=c.getBoundingClientRect(); var cs=getComputedStyle(c);
    return {open:!c.hidden&&cs.display!=='none', inView:r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1, anim:cs.animationName, w:r.width};})()`);
  check(`${tag}: panel opens inside the viewport`, panel.open && panel.inView, JSON.stringify(panel));
  await save(`chat-${style}-${theme}-${vp.name}-panel`);

  const focusable = await run(`['#chatClose','#chatInput','#chatSend'].every(function(s){var e=document.querySelector(s); var cs=getComputedStyle(e); return e&&e.tabIndex>=0&&cs.visibility!=='hidden'&&cs.display!=='none';})`);
  check(`${tag}: close, input and send are focusable`, focusable);

  // Text contrast: solid backgrounds are computed; the header over a painting is measured from real pixels with its text hidden.
  const pairs = await run(`(function(){var out=[]; function add(n,sel){var e=document.querySelector(sel); if(!e) return; var bg=__bg(e); var fg=__fg(e); out.push({n:n,bg:bg,fg:fg});}
    add('bot bubble','#chatLog .msg--bot'); add('user bubble','#chatLog .msg--user'); add('error line','#chatLog .msg--err'); add('send button','#chatSend'); add('input','#chatInput'); add('head title','.chat__head strong'); add('head sub','.chat__head span'); return out;})()`);
  for (const p of pairs) {
    if (p.bg.image) {
      const sel = p.n === 'head sub' ? '.chat__head span' : p.n === 'head title' ? '.chat__head strong' : p.n === 'send button' ? '#chatSend' : p.n === 'user bubble' ? '#chatLog .msg--user' : '#chatLog .msg--bot';
      const rect = await run(`__rect('${sel}')`);
      await run(`(function(){var e=document.querySelector('${sel}'); e.style.color='transparent'; e.style.webkitTextFillColor='transparent'; return 1;})()`);
      const img = await shot({ x: rect.x + rect.w * 0.2, y: rect.y + rect.h * 0.25, width: Math.max(1, rect.w * 0.6), height: Math.max(1, rect.h * 0.5) });
      await run(`(function(){var e=document.querySelector('${sel}'); e.style.color=''; e.style.webkitTextFillColor=''; return 1;})()`);
      const ls = []; for (let i = 0; i < img.px.length; i += img.bpp) ls.push(lum(img.px[i], img.px[i + 1], img.px[i + 2]));
      ls.sort((a, b) => a - b); const worst = ls[Math.floor(ls.length * 0.97)];
      const r = ratio(lumOf(p.fg), worst);
      check(`${tag}: ${p.n} contrast over image >= 4.5`, r >= 4.5, r.toFixed(2));
    } else {
      const r = ratio(lumOf(p.fg), lumOf(p.bg));
      check(`${tag}: ${p.n} contrast >= 4.5`, r >= 4.5, r.toFixed(2));
    }
  }
  await run(`document.getElementById('chatClose').click(); 1`);
  check(`${tag}: no console errors`, consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '));
}

// ---------------------------------------------------------------- sections and edition lifecycle
async function sectionCase(style, theme, vp) {
  const tag = `sections ${style} ${theme} ${vp.name}`;
  await load(theme, vp);
  await enter(style);
  const ids = JSON.parse(await run(`JSON.stringify([...document.querySelectorAll('#home, main .section')].filter(function(s){return s.id && (s.offsetParent!==null||getComputedStyle(s).position==='sticky');}).map(function(s){return s.id;}))`));
  check(`${tag}: has the core sections`, ['home', 'about', 'experience', 'projects', 'skills', 'education', 'contact'].every((x) => ids.includes(x)), ids.join(','));
  for (const sid of ids) {
    await run(`(function(){var e=document.getElementById('${sid}'); window.scrollTo({top:'${sid}'==='home'?0:e.getBoundingClientRect().top+scrollY-20,behavior:'instant'}); window.dispatchEvent(new Event('scroll')); return 1;})()`);
    await sleep(900);
    const m = await run(`(function(){var d=document.documentElement; var e=document.getElementById('${sid}'); var r=e.getBoundingClientRect(); var txt=e.innerText.trim().length; return {overflow:d.scrollWidth>${vp.w}+1, sw:d.scrollWidth, h:r.height, txt:txt};})()`);
    check(`${tag}/${sid}: fits the width`, !m.overflow, `scrollWidth ${m.sw}`);
    check(`${tag}/${sid}: has content`, m.h > 80 && m.txt > 10, JSON.stringify(m));
    const concept = CONCEPTS[style]?.[sid];
    if (concept) {
      const got = await run(`(function(){ try { return !!(${concept.js}); } catch(e){ return 'ERR '+e.message; } })()`);
      check(`${tag}/${sid}: concept "${concept.name}" applied`, got === true, String(got));
    }
    await save(`sec-${style}-${theme}-${vp.name}-${sid}`);
  }
  // text contrast of body copy and headings in this edition
  const body = await run(`(function(){var out=[]; ['.about__cols p','.job li','.project__body p','.skill-list li','.edu__item p','.contact__links a','.section__title'].forEach(function(s){var e=document.querySelector(s); if(!e) return; out.push({s:s,bg:__bg(e),fg:__fg(e),big:s==='.section__title'});}); return out;})()`);
  for (const p of body) {
    if (p.bg.image) continue;
    const r = ratio(lumOf(p.fg), lumOf(p.bg));
    check(`${tag}: ${p.s} contrast >= ${p.big ? 3 : 4.5}`, r >= (p.big ? 3 : 4.5), r.toFixed(2));
  }
  check(`${tag}: no console errors`, consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '));
}

async function lifecycleCase(style, theme) {
  const vp = VIEWPORTS[0]; const tag = `leave ${style} ${theme}`;
  await load(theme, vp);
  // What the page itself holds (cover, main, footer), minus the classes the site's own scripts toggle: entering and leaving must give it back unchanged.
  const snap = `[...document.querySelectorAll('#home, #main, .footer')].map(function(n){return n.outerHTML;}).join('').replace(/\\s*\\b(is-visible|active)\\b/g,'').replace(/ aria-current="[^"]*"/g,'').replace(/ class="\\s*"/g,'').replace(/ hidden=""/g,'')`;
  const before = await run(snap);
  await enter(style);
  if (style === 'renaissance-plus') await run(`window.Edition.leave(); 1`);
  else await run(`(function(){var b=document.querySelector('.px-hud .px-btn:last-child'); if(!b) throw new Error('no leave button'); b.click(); return 1;})()`);
  await sleep(1800);
  // Leftovers are found by prefix: every class an edition adds starts with its prefix (px- is the shared engine and the older editions), and
  // the attributes it sets are data-sheet, data-page, data-studio or data-folio. The classes the site's own scripts toggle are not in the list.
  const left = await run(`(function(){var d=document.documentElement; var re=/(^|\s)(px|sx|br|bh|mn|nn|cs|ed|ren)-/; var nodes=[...document.querySelectorAll('[class]')].filter(function(n){ return re.test(typeof n.className==='string'?n.className:(n.className.baseVal||'')); }); return {style:d.dataset.style||'', leftovers:nodes.length, sample:nodes.slice(0,3).map(function(n){return n.tagName+'.'+String(n.className.baseVal!==undefined?n.className.baseVal:n.className).slice(0,40);}), classes:0, attrs:document.querySelectorAll('[data-sheet],[data-page],[data-studio],[data-folio]').length};})()`);
  check(`${tag}: leaves cleanly`, !/-plus$/.test(left.style) && left.leftovers === 0 && left.classes === 0 && left.attrs === 0, JSON.stringify(left));
  if (style === 'editorial-plus') {
    const after = await run(snap);
    let at = 0; while (at < before.length && before[at] === after[at]) at++;
    check(`${tag}: page markup is restored exactly`, before === after, `first difference at ${at}: ${JSON.stringify(before.slice(Math.max(0, at - 40), at + 60))} vs ${JSON.stringify(after.slice(Math.max(0, at - 40), at + 60))}`);
  }
}

async function reducedMotionCase(style) {
  const tag = `reduced-motion ${style}`;
  await load('light', VIEWPORTS[0], true);
  await enter(style);
  await run(`document.getElementById('chatFab').click(); 1`); await sleep(600);
  const anim = await run(`getComputedStyle(document.getElementById('chatPanel')).animationName`);
  check(`${tag}: chat panel does not animate`, anim === 'none', anim);
  const moving = await run(`[...document.querySelectorAll('body *')].filter(function(n){var cs=getComputedStyle(n); return cs.animationName!=='none' && parseFloat(cs.animationDuration)>0 && n.getBoundingClientRect().width>0 && n.id!=='chatPanel';}).map(function(n){return n.tagName+'.'+String(n.className).slice(0,24)+':'+getComputedStyle(n).animationName;}).slice(0,5)`);
  check(`${tag}: no running animations`, moving.length === 0, moving.join(', '));
}

// ---------------------------------------------------------------- Editorial Edition: pinned openers, lazy plates, static layouts
// Contrast of an element's text against the real pixels behind it (its text is made transparent for the capture).
const pixelRatio = async (sel, insetTop = 0) => {
  const fg = await run(`__fg(document.querySelector(${JSON.stringify(sel)}))`);
  const rect = await run(`__rect(${JSON.stringify(sel)})`);
  await run(`(function(){var e=document.querySelector(${JSON.stringify(sel)}); [e].concat([].slice.call(e.querySelectorAll('*'))).forEach(function(n){n.style.color='transparent'; n.style.webkitTextFillColor='transparent';}); return 1;})()`);
  const img = await shot({ x: rect.x, y: rect.y + insetTop, width: Math.max(1, rect.w), height: Math.max(1, rect.h - insetTop) });
  await run(`(function(){var e=document.querySelector(${JSON.stringify(sel)}); [e].concat([].slice.call(e.querySelectorAll('*'))).forEach(function(n){n.style.color=''; n.style.webkitTextFillColor='';}); return 1;})()`);
  const ls = []; for (let i = 0; i < img.px.length; i += img.bpp) ls.push(lum(img.px[i], img.px[i + 1], img.px[i + 2]));
  ls.sort((a, b) => a - b);
  const worst = lumOf(fg) > 0.35 ? ls[Math.floor(ls.length * 0.97)] : ls[Math.floor(ls.length * 0.03)];
  return ratio(lumOf(fg), worst);
};
async function editorialCase(theme) {
  const tag = `editorial ${theme}`;
  const desk = VIEWPORTS[0];
  await load(theme, desk, false, '?style=editorial-plus');
  consoleErrors = [];
  await sleep(900);
  await run(`window.scrollTo({top:0,behavior:'instant'}); window.dispatchEvent(new Event('scroll')); 1`);
  await sleep(1300);
  const scenes = () => run(`performance.getEntriesByType('resource').map(function(r){return r.name.split('/').pop();}).filter(function(n){return /^scene-/.test(n);})`);
  const top = await scenes();
  check(`${tag}: at the top only the plates near the screen are fetched`, top.length >= 1 && top.length <= 3 && !top.some((n) => /contact|education|skills/.test(n)), top.join(','));
  check(`${tag}: only this theme's painting is fetched`, top.every((n) => n === 'scene-studio-dark.webp' || n.includes('-' + theme + '.')), top.join(','));
  const consoleBefore = consoleErrors.length;

  // pinned: an opener holds the screen while its section slides over it
  const pin = await run(`(function(){var o=document.querySelector('.ed-opener'); var cs=getComputedStyle(o); return {pos:cs.position, h:o.offsetHeight, vh:innerHeight, aria:o.getAttribute('aria-hidden'), nextTag:o.nextElementSibling.tagName};})()`);
  check(`${tag}: opener is pinned, full height, decorative`, pin.pos === 'sticky' && pin.h >= pin.vh - 1 && pin.aria === 'true' && pin.nextTag === 'SECTION', JSON.stringify(pin));
  await run(`(function(){var s=document.getElementById('experience'); window.scrollTo({top:s.getBoundingClientRect().top+scrollY-${desk.h * 0.5},behavior:'instant'}); window.dispatchEvent(new Event('scroll')); return 1;})()`);
  await sleep(1200);
  const mid = await run(`(function(){var s=document.getElementById('experience'); var o=s.previousElementSibling; return {opTop:Math.round(o.getBoundingClientRect().top), secTop:Math.round(s.getBoundingClientRect().top), p:parseFloat(o.style.getPropertyValue('--p')||'0'), z:[getComputedStyle(o).zIndex,getComputedStyle(s).zIndex]};})()`);
  check(`${tag}: opener stays pinned while the page covers it`, mid.opTop === 0 && Math.abs(mid.secTop - desk.h * 0.5) < 3 && mid.p > 0.35 && mid.p < 0.65 && +mid.z[1] > +mid.z[0], JSON.stringify(mid));
  await save(`editorial-${theme}-fold`);

  // a real contents link lands on the opener, and its plate has loaded by then
  await run(`document.querySelector('.ed-toc a[href="#projects"]').click(); 1`);
  await sleep(2400);
  const jump = await run(`(function(){var s=document.getElementById('projects'); var o=s.previousElementSibling; var im=o.querySelector('.ed-plate__img'); return {opTop:Math.round(o.getBoundingClientRect().top), secTop:Math.round(s.getBoundingClientRect().top), img:getComputedStyle(im).backgroundImage, op:getComputedStyle(im).opacity};})()`);
  check(`${tag}: a contents link lands on the opener with its plate loaded`, Math.abs(jump.opTop) < 3 && /scene-projects/.test(jump.img) && jump.op === '1', JSON.stringify(jump));
  await save(`editorial-${theme}-opener`);
  // text next to the plates, from real pixels
  const title = await pixelRatio('.ed-opener:has(+ #projects) .ed-opener__title');
  check(`${tag}: opener title contrast >= 3`, title >= 3, title.toFixed(2));
  const quote = await pixelRatio('.ed-opener:has(+ #projects) .ed-opener__quote', 20); // below the quote's own double rule
  check(`${tag}: opener pull quote contrast >= 4.5`, quote >= 4.5, quote.toFixed(2));

  await run(`window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}); window.dispatchEvent(new Event('scroll')); 1`);
  await sleep(1300);
  const all = await scenes();
  check(`${tag}: reaching the end has fetched every plate once`, ['about', 'experience', 'projects', 'skills', 'education', 'contact'].every((n) => all.some((f) => f.includes('scene-' + n + '-' + theme))) && new Set(all).size === all.length, all.join(','));
  check(`${tag}: no console errors`, consoleErrors.length === consoleBefore, consoleErrors.slice(0, 2).join(' | '));

  // phone: nothing pinned, each opener a short plate header, one column
  await load(theme, VIEWPORTS[1], false, '?style=editorial-plus');
  await sleep(900);
  const ph = await run(`(function(){var o=document.querySelector('.ed-opener'); var d=document.documentElement; var cols=[...document.querySelectorAll('#about .about__cols .col-6, #education .edu')].map(function(n){return getComputedStyle(n).columnCount;}); var t=document.querySelector('.hero__title'); return {pos:getComputedStyle(o).position, h:o.offsetHeight, vh:innerHeight, over:d.scrollWidth>innerWidth+1, cols:cols, title:t.scrollWidth<=t.clientWidth+1};})()`);
  check(`${tag} phone: static plate headers, single columns, no overflow`, ph.pos === 'relative' && ph.h <= ph.vh * 0.5 && !ph.over && ph.cols.every((c) => c === 'auto' || c === '1') && ph.title, JSON.stringify(ph));
  // reduced motion: static as well, and no fold-in classes
  await load(theme, desk, true, '?style=editorial-plus');
  await sleep(900);
  const rm = await run(`(function(){var o=document.querySelector('.ed-opener'); return {pos:getComputedStyle(o).position, h:o.offsetHeight, vh:innerHeight, fold:document.querySelectorAll('.ed-fold').length, veil:getComputedStyle(o.querySelector('.ed-opener__veil')).display};})()`);
  check(`${tag} reduced motion: nothing pinned or folding`, rm.pos === 'relative' && rm.h < rm.vh && rm.fold === 0 && rm.veil === 'none', JSON.stringify(rm));
}

// Editions load on first use: the default page requests none of their files, and entering one requests only its own pair.
async function lazyCase() {
  const names = ['swiss', 'editorial', 'brutalist', 'bauhaus', 'minimal', 'neural', 'cosmos'];
  const got = `performance.getEntriesByType('resource').map(function(e){return e.name.replace(location.origin,'');}).filter(function(n){return /\\/edition-[a-z]+\\.(js|css)$/.test(n);})`;
  await load('light', VIEWPORTS[0]);
  check('lazy: the default page requests no edition files', (await run(got)).length === 0, JSON.stringify(await run(got)));
  for (const n of names) {
    await load('light', VIEWPORTS[0]);
    await enter(n + '-plus');
    const files = await run(got);
    check(`lazy: entering ${n}-plus requests only its own files`, files.length === 2 && files.every((f) => f.includes('/edition-' + n + '.')), JSON.stringify(files));
  }
  await load('light', VIEWPORTS[0]);
  await run(`history.replaceState(null,'','/design/?style=neural-plus'); location.reload(); 1`);
  await sleep(3500);
  check('lazy: ?style=neural-plus loads the edition from the URL', (await run(`document.documentElement.dataset.style`)) === 'neural-plus', await run(`document.documentElement.dataset.style`));
}

// The first case of a run pays for cold server caches and the lazy edition files; a warm-up pass keeps that out of the results.
async function warmUp() {
  await load('light', VIEWPORTS[0]);
  await enter('swiss-plus');
  await sleep(1500);
}

const t0 = Date.now();
try {
  await warmUp();
  for (const style of STYLES) for (const theme of THEMES) for (const vp of VIEWPORTS) {
    if (ONLY === 'all' || ONLY === 'chat') await chatCase(style, theme, vp);
    if ((ONLY === 'all' || ONLY === 'sections') && style.endsWith('-plus')) await sectionCase(style, theme, vp);
  }
  if ((ONLY === 'all' || ONLY === 'sections') && STYLES.includes('editorial-plus')) for (const theme of THEMES) await editorialCase(theme);
  if (ONLY === 'all' || ONLY === 'sections') for (const style of STYLES.filter((s) => s.endsWith('-plus'))) await lifecycleCase(style, THEMES[0]);
  if (ONLY === 'all' || ONLY === 'sections') await lazyCase();
  if (ONLY === 'all' || ONLY === 'chat') for (const style of STYLES.filter((s) => s.endsWith('-plus'))) await reducedMotionCase(style);
} finally {
  ws.close(); proc.kill();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* chrome may still hold the profile */ }
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed in ${Math.round((Date.now() - t0) / 1000)}s`);
for (const f of failed) console.log(' FAIL', f.id, f.detail);
process.exit(failed.length ? 1 : 0);
