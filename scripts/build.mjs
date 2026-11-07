// Generates the files that are derived from other files. Plain Node, no dependencies.
//   node scripts/build.mjs          persona pages (/data/, /design/, /shop/, /bank/), /cv/, /documents/
//   node scripts/build.mjs --pdf    also render the CV PDFs into /files/ using Chrome or Edge (headless)
// index.html is the source of truth for the page; personas.js for persona text and project order.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { PERSON, MODES } from './cv-data.mjs';
import { DOCUMENTS } from './documents.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://kampolo-tomas-website.netlify.app';
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const write = (f, s) => { fs.mkdirSync(path.dirname(path.join(ROOT, f)), { recursive: true }); fs.writeFileSync(path.join(ROOT, f), s); };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Labs: each file in scripts/labs/ (not starting with _) default-exports one proof of concept; see labPage() below. */
const FIELDS = { data: 'Data', shop: 'E-commerce', design: 'Design and AI', systems: 'IT and systems' };
const LABS = [];
const labsDir = path.join(ROOT, 'scripts', 'labs');
if (fs.existsSync(labsDir)) {
  for (const f of fs.readdirSync(labsDir).filter((n) => n.endsWith('.mjs') && !n.startsWith('_')).sort()) {
    const lab = (await import(pathToFileURL(path.join(labsDir, f)).href)).default;
    for (const k of ['slug', 'field', 'title', 'blurb', 'personas', 'page']) if (!lab || lab[k] === undefined) throw new Error(`scripts/labs/${f}: missing "${k}"`);
    if (!FIELDS[lab.field]) throw new Error(`scripts/labs/${f}: unknown field "${lab.field}"`);
    LABS.push(lab);
  }
}

const ctx = { window: {} };
vm.runInNewContext(read('personas.js'), ctx);
const PERSONAS = ctx.window.PERSONAS;

/* ---------- persona pages ---------- */
function reorderProjects(html, order) {
  const re = /<details class="project" data-project="([^"]+)">[\s\S]*?<\/details>/g;
  const blocks = new Map();
  let first = -1, last = 0, m;
  while ((m = re.exec(html))) {
    if (first < 0) first = m.index;
    last = m.index + m[0].length;
    blocks.set(m[1], m[0]);
  }
  const ids = [...order.filter((id) => blocks.has(id)), ...[...blocks.keys()].filter((id) => !order.includes(id))];
  const rebuilt = ids.map((id, i) => blocks.get(id).replace(/<span class="project__idx">\d+<\/span>/, `<span class="project__idx">${String(i + 1).padStart(2, '0')}</span>`));
  const sepMatch = html.slice(first, last).match(/<\/details>(\s*)<details/);
  const sep = sepMatch ? sepMatch[1] : '\n\n          ';
  return html.slice(0, first) + rebuilt.join(sep) + html.slice(last);
}

function setSlot(html, name, text) {
  const re = new RegExp('(<(\\w+)[^>]*data-slot="' + name + '"[^>]*>)([\\s\\S]*?)(</\\2>)');
  if (!re.test(html)) throw new Error('slot not found: ' + name);
  return html.replace(re, (_, open, _tag, _inner, close) => open + esc(text) + close);
}

function personaPage(base, key) {
  const p = PERSONAS[key];
  const url = SITE + p.path;
  let h = base;
  h = h.replace('<html lang="en">', `<html lang="en" data-persona="${key}">`);
  h = h.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(p.title)}</title>`);
  h = h.replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(p.description)}$2`);
  h = h.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(p.title)}$2`);
  h = h.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(p.description)}$2`);
  h = h.replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`);
  h = h.replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${esc(p.title)}$2`);
  h = h.replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${esc(p.description)}$2`);
  h = h.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`);
  h = h.replace('<meta name="author" content="Kampolo Tomas" />', '<meta name="author" content="Kampolo Tomas" />\n  <meta name="robots" content="noindex, follow" />');
  h = setSlot(h, 'role', p.role);
  h = setSlot(h, 'lead', p.lead);
  h = setSlot(h, 'status', p.status);
  h = h.replace(/<a href="[^"]*" class="btn btn--line" data-cv-link>/, `<a href="${p.cv}" class="btn btn--line" data-cv-link>`);
  h = reorderProjects(h, p.projects);
  h = h.replace(/<option value="corporate" selected>/, '<option value="corporate">').replace(`<option value="${key}">`, `<option value="${key}" selected>`);
  const labs = LABS.filter((l) => l.personas.includes(key));
  if (labs.length) {
    const links = labs.map((l) => `<a href="/lab/${l.slug}/">${esc(l.title)}</a>`).join(' · ');
    h = h.replace('  </main>', `    <aside class="wrap lab-link" aria-label="Optional demos"><p>Want to see it working? ${links}<span>Optional. Opens a separate page.</span></p></aside>
  </main>`);
  }
  return h;
}

/* ---------- shared shell for generated site pages ---------- */
function shell({ title, description, canonical, noindex, label, body, css = [], scripts = [], track = true }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  ${noindex ? '<meta name="robots" content="noindex, nofollow" />' : ''}
  <link rel="canonical" href="${canonical}" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${SITE}/og-image.png" />
  <script>
    (function () {
      try { var t = localStorage.getItem('theme'); if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t); } catch (e) {}
    })();
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/styles.css" />
${css.map((href) => `  <link rel="stylesheet" href="${href}" />`).join('\n')}
</head>
<body>
  <div class="wrap doc__top">
    <a href="/">← Back to the site</a>
    <span class="section__num">${esc(label)}</span>
  </div>
${body}
  <footer class="footer">
    <div class="wrap footer__inner">
      <span>Kampolo Tomas · Windhoek, Namibia</span>
      <a href="mailto:${PERSON.email}" class="footer__top">${PERSON.email}</a>
    </div>
  </footer>
  ${track ? ['<script src="/track.js" defer></script>', '<script src="/obs.js" defer></script>'].join('\n  ') : ''}
${scripts.map((src) => `  <script src="${src}" defer></script>`).join('\n')}
</body>
</html>
`;
}

/* ---------- CV ---------- */
function cvBody(modeKey, embedded = false) {
  const m = MODES[modeKey];
  const sec = (title, inner) => `<section class="cv-sec"><h2>${esc(title)}</h2>${inner}</section>`;
  const parts = [];
  const nameTag = embedded ? 'p' : 'h1';
  parts.push(`<header class="cv-head"><${nameTag} class="cv-name">${esc(PERSON.name)}</${nameTag}><p class="cv-title">${esc(PERSON.title)}</p><p class="cv-contact">${[PERSON.location, PERSON.email, PERSON.phone, PERSON.linkedin, PERSON.site].map(esc).join(' · ')}</p></header>`);
  parts.push(sec('Profile', `<p>${esc(m.summary)}</p>`));
  for (const s of m.sections) {
    let inner = '';
    if (s.kind === 'jobs') inner = s.items.map((j) => `<article class="cv-item"><div class="cv-row"><b>${esc(j.role)}</b><span>${esc(j.dates)}</span></div><p class="cv-sub">${esc(j.org)}</p><ul>${j.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul></article>`).join('');
    else if (s.kind === 'edu') inner = s.items.map((e) => `<article class="cv-item"><div class="cv-row"><b>${esc(e.name)}</b><span>${esc(e.dates)}</span></div><p class="cv-sub">${esc(e.org)}</p>${e.text ? `<p>${esc(e.text)}</p>` : ''}</article>`).join('');
    else if (s.kind === 'projects') inner = s.items.map((p) => `<article class="cv-item"><div class="cv-row"><b>${esc(p.name)}</b><span>${esc(p.year)}</span></div><p>${esc(p.text)}</p></article>`).join('');
    else if (s.kind === 'skills') inner = s.items.map(([g, t]) => `<p><b>${esc(g)}:</b> ${esc(t)}</p>`).join('');
    else inner = s.items.map((t) => `<p>${esc(t)}</p>`).join('');
    parts.push(sec(s.title, inner));
  }
  parts.push('<p class="cv-foot">References available on request.</p>');
  return parts.join('\n');
}

const PRINT_CSS = `@page { size: A4; margin: 10mm 13mm; }
* { box-sizing: border-box; }
body { margin: 0; font: 8.8pt/1.3 Arial, Helvetica, sans-serif; color: #000; background: #fff; }
h1 { font-size: 17pt; margin: 0; letter-spacing: -0.02em; }
.cv-title { font-size: 10.5pt; font-weight: 700; margin: 1px 0 2px; }
.cv-contact { margin: 0 0 4px; font-size: 8.6pt; }
h2 { font-size: 8.8pt; text-transform: uppercase; letter-spacing: 0.09em; border-bottom: 1.2px solid #000; margin: 6px 0 2px; padding-bottom: 1px; }
p { margin: 0 0 2px; }
.cv-item { margin-bottom: 3px; break-inside: avoid; }
.cv-row { display: flex; justify-content: space-between; gap: 12px; }
.cv-row span { white-space: nowrap; }
.cv-sub { font-style: italic; margin: 0 0 1px; }
ul { margin: 1px 0 0; padding-left: 14px; }
li { margin: 0 0 1px; }
.cv-foot { margin-top: 6px; font-size: 8.4pt; }
`;

function cvPrintPage(modeKey) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(PERSON.name)} — ${esc(MODES[modeKey].label)}</title><style>${PRINT_CSS}</style></head><body>${cvBody(modeKey)}</body></html>`;
}

function cvLanding() {
  const rows = Object.entries(MODES).map(([key, m]) => `
            <li><span>${esc(m.label)}</span><div><a href="/files/${m.file}.pdf" download>Download PDF</a><p>${esc(m.blurb)}</p></div></li>`).join('');
  const body = `
  <header class="doc__hero">
    <div class="wrap">
      <p class="section__num">Curriculum vitae</p>
      <h1>CV.</h1>
      <p>Black-and-white, print-ready, and kept in sync with the site. Pick the version that fits the role. References and other documents are on the <a class="inline-link" href="/documents/">documents page</a>.</p>
    </div>
  </header>
  <main>
    <section class="doc__block">
      <div class="wrap grid">
        <header class="section__head col-3"><p class="section__num">01</p><h2 class="section__title">Download</h2></header>
        <div class="col-9"><ul class="contact__links cv-downloads">${rows}
          </ul></div>
      </div>
    </section>
    <section class="doc__block">
      <div class="wrap grid">
        <header class="section__head col-3"><p class="section__num">02</p><h2 class="section__title">Read online</h2></header>
        <div class="col-9"><article class="cv-doc" aria-label="Full CV">${cvBody('full', true)}</article></div>
      </div>
    </section>
  </main>`;
  return shell({ title: 'CV — Kampolo Tomas', description: 'Curriculum vitae of Kampolo Tomas Vaino Amunyela: download as PDF or read online.', canonical: SITE + '/cv/', noindex: false, label: 'CV', body });
}

/* ---------- documents ---------- */
function artCredits() {
  const file = path.join(ROOT, 'scripts', 'art-credits.json');
  if (!fs.existsSync(file)) return '';
  const items = JSON.parse(fs.readFileSync(file, 'utf8')).map((c) => `
          <li class="doc-row"><div><b>${esc(c.title)}</b><p>${esc(c.artist)}, ${esc(c.date)}. ${esc(c.museum)}. ${esc(c.licence)}.</p></div><div class="doc-row__action"><a href="${esc(c.page)}" rel="noopener">Source</a></div></li>`).join('');
  return `
    <section class="doc__block">
      <div class="wrap grid">
        <header class="section__head col-3"><p class="section__num">02</p><h2 class="section__title">Art credits</h2></header>
        <div class="col-9"><p>The paintings in the Renaissance Edition are public-domain works, graded for light and dark. Thank you to the museums that make them free to use.</p><ul class="doc-list">${items}
          </ul></div>
      </div>
    </section>`;
}

function countedBlock() {
  return `
    <section class="doc__block" id="counting">
      <div class="wrap grid">
        <header class="section__head col-3"><p class="section__num">03</p><h2 class="section__title">What this site counts</h2></header>
        <div class="col-9">
          <p>To see how the site is used and whether it works, it counts a few things as plain numbers: which pages are opened, which view of the site (Data, Design, Shop, Classic), which website sent the visitor (the host name only), the country (two letters) and whether the screen is a phone, tablet or desktop; how fast pages load; errors in the page, with web addresses, e-mail addresses and long numbers removed; how long the heavier effects take; and how many tokens and seconds the chat assistant used.</p>
          <p>It does not keep IP addresses, browser details, cookies, anything you type into the chat or the contact form, or anything that identifies you. Nothing is counted when your browser sends Do Not Track. The counts are stored in Netlify's own storage, 90 days at most, and only the owner can read them.</p>
        </div>
      </div>
    </section>`;
}

function documentsPage() {
  const rows = DOCUMENTS.map((d) => {
    const req = `mailto:${PERSON.email}?subject=${encodeURIComponent('Document request: ' + d.name)}&body=${encodeURIComponent('Hello Kampolo,\n\nCould you please send me: ' + d.name + '.\n\nThank you.')}`;
    let action;
    if (d.links) action = d.links.map(([l, href]) => `<a href="${href}" download>${esc(l)}</a>`).join(' · ');
    else if (d.file && fs.existsSync(path.join(ROOT, 'files', d.file))) action = `<a href="/files/${d.file}" download>Download PDF</a>`;
    else action = `<a href="${req}">Request by email</a>`;
    return `
          <li class="doc-row"><div><b>${esc(d.name)}</b><p>${esc(d.detail)}</p></div><div class="doc-row__action">${action}</div></li>`;
  }).join('');
  const body = `
  <header class="doc__hero">
    <div class="wrap">
      <p class="section__num">Documents</p>
      <h1>Documents.</h1>
      <p>Public documents can be downloaded here. Published copies have ID numbers, student numbers and home address removed. Anything not listed, or not yet published, is available by email.</p>
    </div>
  </header>
  <main>
    <section class="doc__block">
      <div class="wrap grid">
        <header class="section__head col-3"><p class="section__num">01</p><h2 class="section__title">Files</h2></header>
        <div class="col-9"><ul class="doc-list">${rows}
          </ul></div>
      </div>
    </section>${artCredits()}${countedBlock()}
  </main>`;
  return shell({ title: 'Documents — Kampolo Tomas', description: 'CV, certificates and other documents of Kampolo Tomas, available for download or on request.', canonical: SITE + '/documents/', noindex: false, label: 'Documents', body });
}

/* ---------- PDFs ---------- */
function findBrowser() {
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  return candidates.find((c) => fs.existsSync(c));
}

function renderPdfs() {
  const browser = findBrowser();
  if (!browser) throw new Error('No Chrome or Edge found for PDF rendering');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-'));
  fs.mkdirSync(path.join(ROOT, 'files'), { recursive: true });
  for (const [key, m] of Object.entries(MODES)) {
    const html = path.join(tmp, key + '.html');
    const out = path.join(ROOT, 'files', m.file + '.pdf');
    fs.writeFileSync(html, cvPrintPage(key));
    const r = spawnSync(browser, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${out}`, pathToFileURL(html).href], { stdio: 'pipe', timeout: 60000 });
    if (!fs.existsSync(out)) throw new Error('PDF not produced for ' + key + ': ' + String(r.stderr));
    const pages = (fs.readFileSync(out).toString('latin1').match(/\/Type\s*\/Page(?![a-z])/g) || []).length;
    console.log(`pdf ${m.file}.pdf: ${pages} page(s), target ${m.pages}` + (pages > m.pages ? '  <-- TOO LONG' : ''));
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}

/* ---------- hidden pages ---------- */
function hiddenPage({ dir, title, label, description, inner, css, scripts }) {
  const body = `
  <header class="doc__hero">
    <div class="wrap">
      <p class="section__num">${esc(label)}</p>
      <h1>${esc(title)}</h1>
      <p>${esc(description)}</p>
    </div>
  </header>
  <main>${inner}
  </main>`;
  write(`${dir}/index.html`, shell({ title: `${title} — Kampolo Tomas`, description, canonical: `${SITE}/${dir}/`, noindex: true, label, body, css, scripts }));
}

function block(num, title, inner) {
  return `
    <section class="doc__block">
      <div class="wrap grid">
        <header class="section__head col-3"><p class="section__num">${num}</p><h2 class="section__title">${esc(title)}</h2></header>
        <div class="col-9">${inner}</div>
      </div>
    </section>`;
}

/* A lab is a standalone, unlisted page: the situation, what to look at, the demo, how it is built, limits and sources.
   The module's page() returns { situation, look: [html], demo, built, limits, scripts?: [src], css?: [href] } (trusted HTML written in the repo). */
function labPage(lab) {
  const p = lab.page({ esc, block });
  const personas = lab.personas.map((k) => PERSONAS[k]).filter(Boolean);
  const back = personas.map((x) => `<a class="inline-link" href="${x.path}">Back to the ${esc(x.label)} view</a>`).join(' · ');
  const inner = block('01', 'The situation', `<p>${p.situation}</p>`)
    + block('02', 'What to look at', `<ol class="lab-look">${p.look.map((t) => `<li>${t}</li>`).join('')}</ol>`)
    + block('03', 'The demo', `<div class="lab-demo" id="lab-demo">${p.demo}</div>`)
    + block('04', 'How it is built', p.built)
    + block('05', 'Limits and sources', `<div class="lab-limits">${p.limits}</div>`)
    + block('06', 'Elsewhere', `<p>${back ? back + ' · ' : ''}<a class="inline-link" href="/lab/">All labs</a></p>`);
  hiddenPage({ dir: `lab/${lab.slug}`, title: lab.title, label: `Lab · ${FIELDS[lab.field]}`, description: lab.blurb, inner, css: ['/labs/lab.css', ...(p.css || [])], scripts: p.scripts || [] });
}

function hiddenPages() {
  const hasLab = (persona) => LABS.some((l) => l.personas.includes(persona));
  const labItems = LABS.map((l) => `
          <li><span>${esc(FIELDS[l.field])}</span><div><a href="/lab/${l.slug}/">${esc(l.title)}</a><p>${esc(l.blurb)}</p></div></li>`).join('');
  hiddenPage({
    dir: 'lab', title: 'The lab.', label: 'Hidden page',
    description: 'You found the back room. Everything here is optional, and none of it appears in the navigation.',
    inner: block('01', 'Demos', `<ul class="contact__links">
          ${labItems}
          ${hasLab('data') ? '' : '<li><span>Data</span><a href="/data/#data-lab">Dashboard on synthetic data</a></li>'}
          <li><span>Design</span><a href="/design/#design-lab">Style lab: re-skin the site live</a></li>
          ${hasLab('shop') ? '' : '<li><span>Shop</span><a href="/shop/#shop-lab">Image placement and layout shift</a></li>'}
          <li><span>Terminal</span><a href="/terminal/">Command line version of this site</a></li>
          <li><span>Swarm</span><a href="/swarm.html">How the cursor swarm works</a></li>
          <li><span>Particles</span><a href="/particles/">Five small canvas effects, one per style</a></li>
        </ul>`) + block('02', 'Pages', `<ul class="contact__links">
          <li><span>Now</span><a href="/now/">What I am working on</a></li>
          <li><span>Uses</span><a href="/uses/">Tools and stack</a></li>
        </ul>`) + block('03', 'Secrets', `<p>There are a few more. Hints, not instructions:</p>
        <ul class="hint-list">
          <li>A famous cheat code opens something on the main page.</li>
          <li>The assistant is happy to be asked for something cool, and to explain itself.</li>
          <li>The logo has a short temper.</li>
          <li>Press the question mark key on the main page.</li>
          <li>A backtick opens a door.</li>
        </ul>`),
  });
  hiddenPage({
    dir: 'now', title: 'Now.', label: 'Hidden page',
    description: 'What I am working on, last updated 7 November 2026.',
    inner: block('01', 'Working on', `<ul class="contact__links">
          <li><span>Job</span><p>Software engineer on a work-integrated-learning placement at Kellerman ICT, contributing to a business discovery platform.</p></li>
          <li><span>Personal</span><p>A multi-channel chatbot platform, and USCO AI, an embeddable AI sales assistant.</p></li>
          <li><span>This site</span><p>Turning it into role-specific views, with a CV, documents and a few secrets.</p></li>
        </ul>`) + block('02', 'Looking for', `<p>Graduate software, IT and data roles. The fastest way to reach me is <a class="inline-link" href="mailto:kampolotomasva@gmail.com">kampolotomasva@gmail.com</a>.</p>`),
  });
  hiddenPage({
    dir: 'uses', title: 'Uses.', label: 'Hidden page',
    description: 'Tools and stack, from my public profile.',
    inner: block('01', 'Stack', `<ul class="tags tags--big"><li>Python</li><li>JavaScript</li><li>TypeScript</li><li>React</li><li>Node.js</li><li>PHP</li><li>Django</li><li>Firebase</li><li>MySQL</li><li>PostgreSQL</li><li>HTML</li><li>CSS</li><li>Tailwind</li><li>Bootstrap</li></ul>`)
      + block('02', 'Tools', `<ul class="tags tags--big"><li>VS Code</li><li>PyCharm</li><li>Android Studio</li><li>Git</li><li>GitHub</li><li>Docker</li><li>Postman</li><li>Figma</li><li>Linux</li><li>Azure</li><li>Claude Code</li></ul>`)
      + block('03', 'This site', `<p>No framework and no build step for the page itself: HTML, CSS and vanilla JavaScript, hosted on Netlify, with one Netlify Function for the chat assistant.</p>`),
  });
  hiddenPage({
    dir: 'terminal', title: 'Terminal.', label: 'Hidden page',
    description: 'The site as a command line. Type help.',
    inner: `
    <div class="wrap term-wrap">
      <div class="term" id="term" role="application" aria-label="Terminal">
        <div id="termOut" aria-live="polite"></div>
        <form id="termForm" class="term__form"><label for="termIn" class="term__prompt">kampolo@portfolio:~$</label><input id="termIn" autocomplete="off" spellcheck="false" autocapitalize="off" /></form>
      </div>
      <p class="term__hint">Keyboard only. Up and down arrows recall commands, Tab completes. Nothing you type leaves your browser.</p>
    </div>
    <script src="/terminal.js" defer></script>`,
  });
}

/* ---------- the private owner page: ships no data and counts no views; the numbers come from /api/owner/* with a token ---------- */
function ownerPage() {
  const body = `
  <header class="doc__hero">
    <div class="wrap">
      <p class="section__num">Owner</p>
      <h1>Owner.</h1>
      <p>Private numbers for this site: traffic, health, the cost of the assistant and the performance audit. Nothing links here.</p>
    </div>
  </header>
  <main><div class="wrap" id="owner-root"><noscript><p>This page needs JavaScript.</p></noscript></div></main>`;
  write('owner/index.html', shell({ title: 'Owner — Kampolo Tomas', description: 'Private.', canonical: `${SITE}/owner/`, noindex: true, label: 'Owner', body, css: ['/labs/lab.css', '/ownerapp/owner.css'], scripts: ['/ownerapp/owner.js'], track: false }));
}

/* ---------- run ---------- */
const base = read('index.html');
for (const key of Object.keys(PERSONAS)) {
  if (key === 'corporate') continue;
  write(`${key}/index.html`, personaPage(base, key));
}
write('cv/index.html', cvLanding());
write('documents/index.html', documentsPage());
hiddenPages();
for (const lab of LABS) labPage(lab);
ownerPage();
console.log('built:', Object.keys(PERSONAS).filter((k) => k !== 'corporate').map((k) => `/${k}/`).join(' '), '/cv/ /documents/ /lab/ /now/ /uses/ /terminal/', LABS.map((l) => `/lab/${l.slug}/`).join(' '));
if (process.argv.includes('--pdf')) renderPdfs();
