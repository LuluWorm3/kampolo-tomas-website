// Older browsers without IntersectionObserver: show everything, skip scroll tracking.
if (!('IntersectionObserver' in window)) {
  window.IntersectionObserver = function (cb, opts) {
    this.observe = opts && opts.rootMargin ? () => {} : (el) => cb([{ isIntersecting: true, target: el }]);
    this.unobserve = () => {};
  };
}

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const track = window.track || (() => {});

$('#year').textContent = new Date().getFullYear();

/* ---------- Progress / gamification ---------- */
const RANKS = [
  { xp: 0, name: 'Visitor' },
  { xp: 40, name: 'Reader' },
  { xp: 100, name: 'Explorer' },
  { xp: 180, name: 'Collaborator' },
  { xp: 280, name: 'Insider' },
  { xp: 400, name: 'Colleague' },
];
const SECTION_XP = 10;
const PROJECT_XP = 15;
const BADGES = [
  { id: 'explorer', name: 'Explorer', hint: 'Visit every section' },
  { id: 'curious', name: 'Curious', hint: 'Open 5 projects' },
  { id: 'talker', name: 'Conversationalist', hint: 'Ask the assistant a question' },
  { id: 'night', name: 'Night Owl', hint: 'Try dark mode' },
  { id: 'networker', name: 'Networker', hint: 'Copy my email address' },
  { id: 'cheat', name: 'Cheat Code', hint: 'Find the secret' },
  { id: 'curiousdev', name: 'Under the Hood', hint: 'Ask how the swarm works' },
  { id: 'shapeshifter', name: 'Shapeshifter', hint: 'Switch the site to another view' },
  { id: 'door', name: 'Secret Door', hint: 'Find the door in the logo' },
  { id: 'hacker', name: 'Hacker', hint: 'Find the terminal' },
];
const STORE = 'kt-progress-v1';
const fresh = () => ({ xp: 0, sections: [], projects: [], badges: [], once: [] });

let state = fresh();
try {
  const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
  if (saved && typeof saved.xp === 'number') state = { ...fresh(), ...saved };
} catch (e) {}

const save = () => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {} };

function rankFor(xp) {
  let i = 0;
  RANKS.forEach((r, idx) => { if (xp >= r.xp) i = idx; });
  return i;
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function renderHud() {
  const i = rankFor(state.xp);
  const cur = RANKS[i].xp;
  const next = RANKS[i + 1] ? RANKS[i + 1].xp : null;
  $('#hudLevel').textContent = i + 1;
  $('#hudXp').textContent = state.xp;
  $('#hudFill').style.width = (next ? ((state.xp - cur) / (next - cur)) * 100 : 100) + '%';
  $('#dlgLevel').textContent = i + 1;
  $('#dlgRank').textContent = RANKS[i].name;
  $('#dlgXp').textContent = state.xp;
  $('#dlgNext').textContent = next === null ? 'max' : next;
  $('#badgeList').replaceChildren(
    ...BADGES.map((b) => {
      const li = document.createElement('li');
      const got = state.badges.includes(b.id);
      li.className = got ? 'got' : '';
      const t = document.createElement('b');
      t.textContent = b.name;
      li.append(t, got ? 'Unlocked' : b.hint);
      return li;
    })
  );
}

function award(xp, reason) {
  const before = rankFor(state.xp);
  state.xp += xp;
  if (rankFor(state.xp) > before) toast(`Level up — ${RANKS[rankFor(state.xp)].name}`);
  else if (reason) toast(`+${xp} XP · ${reason}`);
  save();
  renderHud();
}

function unlock(id) {
  if (state.badges.includes(id)) return;
  state.badges.push(id);
  const b = BADGES.find((x) => x.id === id);
  toast(`Badge unlocked: ${b.name}`);
  award(25);
}

function once(key, xp, reason) {
  if (state.once.includes(key)) return false;
  state.once.push(key);
  award(xp, reason);
  return true;
}

/* ---------- Theme ---------- */
const root = document.documentElement;
const themeToggle = $('#themeToggle');
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
const currentTheme = () => root.getAttribute('data-theme') || (systemDark.matches ? 'dark' : 'light');
const syncThemeLabel = () =>
  themeToggle.setAttribute('aria-label', currentTheme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');

themeToggle.addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  try { localStorage.setItem('theme', next); } catch (e) {}
  syncThemeLabel();
  if (next === 'dark') unlock('night');
});
if (systemDark.addEventListener) systemDark.addEventListener('change', syncThemeLabel);
else if (systemDark.addListener) systemDark.addListener(syncThemeLabel);
syncThemeLabel();

/* ---------- Navigation ---------- */
const navToggle = $('#navToggle');
const navLinks = $('#navLinks');
function closeMenu() {
  navLinks.classList.remove('open');
  navToggle.classList.remove('open');
  navToggle.setAttribute('aria-expanded', 'false');
}
navToggle.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  navToggle.classList.toggle('open', open);
  navToggle.setAttribute('aria-expanded', String(open));
});
$$('a', navLinks).forEach((a) => a.addEventListener('click', closeMenu));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

/* ---------- Skill pips ---------- */
$$('.skill-list li').forEach((li) => li.style.setProperty('--l', li.dataset.level));

/* ---------- Reveal, spy, progress bar ---------- */
const reveal = new IntersectionObserver(
  (entries) => entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add('is-visible'); reveal.unobserve(en.target); }
  }),
  { threshold: 0.1 }
);
$$('.section, .hero').forEach((s) => reveal.observe(s));

const links = new Map($$('a[href^="#"]', navLinks).map((a) => [a.getAttribute('href').slice(1), a]));
const allSections = $$('[data-section]');
const spy = new IntersectionObserver(
  (entries) => entries.forEach((en) => {
    if (!en.isIntersecting) return;
    links.forEach((a) => { a.classList.remove('active'); a.removeAttribute('aria-current'); });
    const a = links.get(en.target.id);
    if (a) { a.classList.add('active'); a.setAttribute('aria-current', 'true'); }
    const name = en.target.dataset.section;
    if (name && !state.sections.includes(name)) {
      state.sections.push(name);
      award(SECTION_XP, `Visited ${name}`);
      if (allSections.filter((s) => s.offsetParent !== null).every((s) => state.sections.includes(s.dataset.section))) unlock('explorer');
    }
  }),
  { rootMargin: '-45% 0px -50% 0px' }
);
allSections.forEach((s) => spy.observe(s));

const bar = $('#progress');
let ticking = false;
function updateBar() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  bar.style.transform = `scaleX(${max > 0 ? Math.min(window.scrollY / max, 1) : 0})`;
  ticking = false;
}
window.addEventListener('scroll', () => {
  if (!ticking) { ticking = true; requestAnimationFrame(updateBar); }
}, { passive: true });
updateBar();

/* ---------- Projects ---------- */
$$('.project').forEach((d) => d.addEventListener('toggle', () => {
  if (!d.open) return;
  const id = d.dataset.project;
  if (state.projects.includes(id)) return;
  state.projects.push(id);
  award(PROJECT_XP, 'Opened a project');
  if (state.projects.length >= 5) unlock('curious');
}));

/* ---------- Copy email ---------- */
$$('[data-copy]').forEach((a) => a.addEventListener('contextmenu', () => unlock('networker')));
document.addEventListener('copy', () => {
  const sel = String(window.getSelection());
  if (sel.includes('kampolotomasva@gmail.com')) unlock('networker');
});

/* ---------- Progress dialog ---------- */
const dlg = $('#progressDialog');
if (typeof dlg.showModal !== 'function') $('#hudBtn').hidden = true;
$('#hudBtn').addEventListener('click', () => { renderHud(); dlg.showModal(); });
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
$('#resetProgress').addEventListener('click', () => { state = fresh(); save(); renderHud(); toast('Progress reset'); });

/* ---------- Konami easter egg ---------- */
const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let kpos = 0;
document.addEventListener('keydown', (e) => {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  kpos = key === KONAMI[kpos] ? kpos + 1 : key === KONAMI[0] ? 1 : 0;
  if (kpos === KONAMI.length) {
    kpos = 0;
    document.body.classList.toggle('rave');
    toast('Cheat code accepted. Colour mode on.');
    unlock('cheat');
    swarmRebuild();
  }
});

/* ---------- Swarm rebuild (unlocked by the Konami code, or by asking the chatbot) ---------- */
const swarmBtn = $('#swarmBtn');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const AGENTS = [
  ['layout', '#e30613'], ['type', '#0a84ff'], ['grid', '#30d158'], ['chat', '#ff9f0a'],
  ['xp', '#bf5af2'], ['a11y', '#64d2ff'], ['seo', '#ff375f'], ['copy', '#ffd60a'],
  ['tests', '#32d74b'], ['motion', '#5e5ce6'], ['color', '#ac8e68'], ['qa', '#ff6482'],
];
const CURSOR_SVG = '<svg viewBox="0 0 20 24" width="20" height="24" aria-hidden="true"><path d="M2 2v18l5-4.2 3.2 6.7 3-1.4-3.2-6.6H17z" fill="var(--c)" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>';
let swarmRun = null;

function swarmRebuild(opts = {}) {
  if (swarmRun) return;
  // Started on purpose by the visitor, so it always runs. Reduced motion gets a calm version:
  // no flicker, no smooth scrolling, faster and shorter cursor moves.
  const calm = reducedMotion.matches;
  document.body.classList.toggle('swarm-calm', calm);
  swarmBtn.hidden = false;
  track('swarm', opts.onHalf ? 'persona' : 'effect');

  const docTop = (el) => el.getBoundingClientRect().top + scrollY;
  const layers = $$('.hero__title, .hero__role, .section__head, .job, .project, .skills__group, .edu__item, .facts > div, .contact__links li')
    .filter((el) => el.getBoundingClientRect().width > 0)
    .sort((x, y) => docTop(x) - docTop(y));
  const run = { stop: false, speed: 1, done: 0, focusY: 0 };
  let halved = false;
  const todo = layers.slice();
  swarmRun = run;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms / run.speed));

  const overlay = document.createElement('div');
  overlay.className = 'swarm';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.style.height = document.documentElement.scrollHeight + 'px';

  const hud = document.createElement('div');
  hud.className = 'swarm-hud';
  hud.setAttribute('role', 'status');
  hud.innerHTML =
    '<span class="swarm-hud__dots"></span>' +
    '<span class="swarm-hud__text"><b class="sw-agents"></b> agents · <b class="sw-done">0</b> / <b class="sw-total"></b> layers</span>' +
    '<span class="swarm-hud__meter"><i></i></span>' +
    '<button type="button" class="sw-speed" aria-label="Change speed">1x</button>' +
    '<button type="button" class="sw-stop" aria-label="Stop the swarm">×</button>';
  $('.sw-agents', hud).textContent = AGENTS.length;
  $('.sw-total', hud).textContent = layers.length;
  AGENTS.slice(0, 4).forEach(([, c]) => {
    const d = document.createElement('i');
    d.style.setProperty('--c', c);
    $('.swarm-hud__dots', hud).appendChild(d);
  });
  document.body.append(overlay, hud);

  const progress = () => {
    $('.sw-done', hud).textContent = run.done;
    $('.swarm-hud__meter i', hud).style.width = (layers.length ? (run.done / layers.length) * 100 : 100) + '%';
  };
  $('.sw-speed', hud).addEventListener('click', (e) => {
    run.speed = run.speed === 1 ? 2 : run.speed === 2 ? 4 : 1;
    e.currentTarget.textContent = run.speed + 'x';
  });
  const stop = () => { run.stop = true; };
  $('.sw-stop', hud).addEventListener('click', stop);
  const onKey = (e) => { if (e.key === 'Escape') stop(); };
  document.addEventListener('keydown', onKey);

  const maxX = () => Math.max(40, document.documentElement.clientWidth - 90);
  const agents = AGENTS.map(([name, color]) => {
    const el = document.createElement('div');
    el.className = 'swarm-agent';
    el.style.setProperty('--c', color);
    el.innerHTML = CURSOR_SVG + '<span class="swarm-agent__name"></span>';
    $('.swarm-agent__name', el).textContent = name;
    el.style.transitionDuration = '0s';
    el.style.transform = 'translate(' + Math.random() * maxX() + 'px, ' + (scrollY + Math.random() * 200) + 'px)';
    overlay.appendChild(el);
    return { el, color };
  });
  void overlay.offsetHeight; // commit start positions before animating

  function build(el, color) {
    const r = el.getBoundingClientRect();
    const box = document.createElement('div');
    box.className = 'swarm-box';
    box.style.setProperty('--c', color);
    box.style.left = r.left + scrollX + 'px';
    box.style.top = r.top + scrollY + 'px';
    box.style.width = r.width + 'px';
    box.style.height = r.height + 'px';
    const tag = document.createElement('span');
    tag.textContent = Math.round(r.width) + ' × ' + Math.round(r.height);
    box.appendChild(tag);
    overlay.appendChild(box);
    el.classList.add('sw-building');
    setTimeout(() => { el.classList.remove('sw-building'); box.remove(); }, 650 / run.speed);
    run.done++;
    progress();
    if (opts.onHalf && !halved && run.done >= layers.length / 2) { halved = true; opts.onHalf(); }
  }

  async function work(agent, idx) {
    while (!run.stop && todo.length) {
      // The lead agent takes the earliest unbuilt layer and the page follows it;
      // the others take whichever unbuilt layer is nearest to where the lead is working.
      let pick = 0;
      if (idx !== 0) {
        let best = Infinity;
        todo.forEach((t, i) => {
          const d = Math.abs(docTop(t) - run.focusY);
          if (d < best) { best = d; pick = i; }
        });
      }
      const el = todo.splice(pick, 1)[0];
      const r = el.getBoundingClientRect();
      if (idx === 0) {
        run.focusY = r.top + scrollY;
        window.scrollTo({ top: Math.max(0, run.focusY - innerHeight * 0.3), behavior: calm ? 'auto' : 'smooth' });
      }
      const x = Math.min(maxX(), Math.max(8, r.left + r.width * (0.2 + Math.random() * 0.6)));
      const y = r.top + scrollY + r.height * (0.15 + Math.random() * 0.7);
      agent.el.style.transitionDuration = ((calm ? 0.25 : 0.7) / run.speed) + 's';
      agent.el.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
      await sleep(750 + Math.random() * 350);
      if (run.stop) break;
      build(el, agent.color);
      await sleep(300);
    }
  }

  Promise.all(agents.map(work)).then(async () => {
    const completed = !run.stop;
    if (completed) {
      $('.swarm-hud__text', hud).textContent = 'Rebuilt ✓';
      await sleep(900);
    }
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    hud.remove();
    layers.forEach((l) => l.classList.remove('sw-building'));
    swarmRun = null;
    document.body.classList.remove('swarm-calm');
    if (opts.onHalf && !halved) opts.onHalf();
    if (completed) {
      if (opts.quiet) window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
      else afterSwarm();
    }
  });
}

swarmBtn.hidden = !state.badges.includes('cheat');

/* ---------- Chat ---------- */
const chat = $('#chatPanel');
const fab = $('#chatFab');
const log = $('#chatLog');
const form = $('#chatForm');
const input = $('#chatInput');
const sendBtn = $('#chatSend');
const chips = $('#chatChips');
const SUGGESTED = [
  'Show me something cool',
  'Match a job ad',
  'What is Kampolo working on right now?',
  'Tell me about his chatbot platform.',
  'Where is he strongest, and where is he still learning?',
  'How does he approach security and testing?',
  'How can I contact him?',
];
const chatHistory = [];
let busy = false;

function addMsg(text, kind) {
  const el = document.createElement('div');
  el.className = `msg msg--${kind}`;
  el.textContent = text;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
  return el;
}

function openChat() {
  chat.hidden = false;
  fab.hidden = true;
  fab.setAttribute('aria-expanded', 'true');
  if (!log.children.length) {
    addMsg("Hi — I'm an AI assistant that answers questions about Kampolo using only his profile. What would you like to know?", 'bot');
    SUGGESTED.forEach((q) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = q;
      b.addEventListener('click', () => ask(q));
      chips.appendChild(b);
    });
  }
  input.focus();
}
function closeChat() {
  chat.hidden = true;
  fab.hidden = false;
  fab.setAttribute('aria-expanded', 'false');
  fab.focus();
}
fab.addEventListener('click', openChat);
$('#chatClose').addEventListener('click', closeChat);
$$('[data-open-chat]').forEach((b) => b.addEventListener('click', openChat));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !chat.hidden) closeChat(); });

// "Show me something cool" and friends are handled here, not by the model: they start the swarm.
const COOL = /something cool|anything cool|(show|give|do|got).{0,20}(something|anything|stuff).{0,12}(cool|awesome|impressive|fun|wild|neat)|\b(wow|impress|surprise) me\b/i;
const SASS = [
  "Oh, you want a show? Fine. Buckle up.",
  "Bold of you to ask a portfolio for entertainment. Challenge accepted.",
  "Cool, huh? Hold my agents.",
  "You could've just asked about his skills, but sure, let's do the dramatic thing.",
];
function sassyShow() {
  const line = SASS[Math.floor(Math.random() * SASS.length)];
  addMsg(reducedMotion.matches ? line + ' (Gentle mode on: your device prefers reduced motion.)' : line, 'bot');
  unlock('cheat');
  setTimeout(() => { closeChat(); swarmRebuild(); }, 450);
}

// "How was that done?" gets a short answer and a link to the hidden write-up page.
const HOW = /\bhow\s+(was|is|did|does|do)\s+(that|this|it|the\s+(swarm|animation|effect|cursors?|site|website|page))\b.{0,25}(done|made|built|work|works|happen)|\bhow\s+did\s+you\s+(do|build|make|code|create)\s+(that|this|it|the\s+(swarm|animation|effect|site|website|page))|show me (the )?code|behind the scenes|swarm code/i;

function addLinkMsg(text, href, label) {
  const el = addMsg(text, 'bot');
  el.appendChild(document.createElement('br'));
  const a = document.createElement('a');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = label;
  a.className = 'msg__link';
  el.appendChild(a);
  log.scrollTop = log.scrollHeight;
}

function explainSwarm() {
  swarmBtn.hidden = false;
  addLinkMsg(
    "Short version: twelve small agents each grab a block of the page, fly to it and 'rebuild' it while the page follows the lead agent. It's plain JavaScript and CSS, no libraries. I put the real code on a hidden page:",
    '/swarm.html',
    'Open the swarm write-up →'
  );
  unlock('curiousdev');
}

function afterSwarm() {
  window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  once('swarm', 30, 'Swarm rebuild');
  openChat();
  addMsg('And that was the swarm. Curious how it was done?', 'bot');
  chips.replaceChildren();
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = 'How was that done?';
  b.addEventListener('click', () => ask('How was that done?'));
  chips.appendChild(b);
}

// A pasted job advert is compared with Kampolo's profile by the assistant, honestly, including gaps.
const MATCH = /job\s+(ad|advert|description|posting|spec)|does he (fit|match)|match (me|a job|this job)|fit (this|the) (role|job)/i;
const matchForm = $('#matchForm');
const matchText = $('#matchText');

function openMatch() {
  chips.replaceChildren();
  matchForm.hidden = false;
  matchText.focus();
}

function friendlyError(err) {
  const m = err && err.message;
  return m && m !== 'offline' && m !== 'Failed to fetch'
    ? m
    : 'The assistant is offline right now. You can email Kampolo at kampolotomasva@gmail.com.';
}

// Sends the request; reads a streamed plain-text answer when the browser supports it, JSON otherwise.
async function streamAnswer(payload, typing) {
  const canStream = !!(window.ReadableStream && window.TextDecoder);
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ stream: canStream }, payload)),
  });
  const type = res.headers.get('content-type') || '';
  if (!res.ok || type.indexOf('text/plain') !== 0 || !res.body) {
    const data = await res.json().catch(() => ({}));
    typing.remove();
    if (!res.ok || !data.reply) throw new Error(data.error || 'offline');
    addMsg(data.reply, 'bot');
    return data.reply;
  }
  typing.remove();
  const el = addMsg('', 'bot');
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let text = '';
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    text += dec.decode(chunk.value, { stream: true });
    el.textContent = text;
    log.scrollTop = log.scrollHeight;
  }
  text = text.trim();
  if (!text) { el.remove(); throw new Error('offline'); }
  return text;
}

matchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (busy) return;
  const ad = matchText.value.trim();
  if (ad.length < 60) { addMsg('Paste the full job advert (at least a few sentences).', 'err'); return; }
  busy = true;
  sendBtn.disabled = true;
  matchForm.hidden = true;
  addMsg('Job advert pasted (' + ad.length + ' characters). Comparing it with the profile...', 'user');
  const typing = addMsg('Thinking…', 'bot');
  typing.classList.add('msg--typing');
  track('match');
  try {
    await streamAnswer({ mode: 'match', jobAd: ad }, typing);
    matchText.value = '';
    if (once('match', 20, 'Compared a job ad')) unlock('talker');
  } catch (err) {
    typing.remove();
    addMsg(friendlyError(err), 'err');
    matchForm.hidden = false;
  } finally {
    busy = false;
    sendBtn.disabled = false;
  }
});

async function ask(text) {
  text = text.trim();
  if (!text || busy) return;
  chips.replaceChildren();
  track('chat');
  if (COOL.test(text)) {
    addMsg(text, 'user');
    input.value = '';
    sassyShow();
    return;
  }
  if (HOW.test(text)) {
    addMsg(text, 'user');
    input.value = '';
    explainSwarm();
    return;
  }
  if (MATCH.test(text)) {
    addMsg(text, 'user');
    input.value = '';
    addMsg('Sure. Paste the job advert below and I will compare it with his profile, including the gaps.', 'bot');
    openMatch();
    return;
  }
  busy = true;
  sendBtn.disabled = true;
  addMsg(text, 'user');
  chatHistory.push({ role: 'user', content: text });
  input.value = '';
  const typing = addMsg('Thinking…', 'bot');
  typing.classList.add('msg--typing');

  try {
    const reply = await streamAnswer({ messages: chatHistory.slice(-10) }, typing);
    chatHistory.push({ role: 'assistant', content: reply });
    if (once('chat', 20, 'Asked the assistant')) unlock('talker');
  } catch (err) {
    typing.remove();
    chatHistory.pop();
    addMsg(friendlyError(err), 'err');
  } finally {
    busy = false;
    sendBtn.disabled = false;
    input.focus();
  }
}
form.addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });

/* ---------- Personas: live switch (through the swarm), labs ---------- */
const PERSONAS = window.PERSONAS || {};
const personaSelect = $('#personaSelect');
let currentPersona = document.documentElement.getAttribute('data-persona') || 'corporate';

function personaFromPath(path) {
  const norm = path.slice(-1) === '/' ? path : path + '/';
  return Object.keys(PERSONAS).find((k) => PERSONAS[k].path === norm) || 'corporate';
}

function applyPersona(key, push) {
  const p = PERSONAS[key];
  if (!p) return;
  currentPersona = key;
  const rootEl = document.documentElement;
  if (key === 'corporate') rootEl.removeAttribute('data-persona');
  else rootEl.setAttribute('data-persona', key);
  ['role', 'lead', 'status'].forEach((slot) => $$('[data-slot="' + slot + '"]').forEach((el) => { el.textContent = p[slot]; }));
  $$('[data-cv-link]').forEach((a) => a.setAttribute('href', p.cv));
  document.title = p.title;
  const list = $('#projectList');
  p.projects.forEach((id, i) => {
    const el = list.querySelector('[data-project="' + id + '"]');
    if (!el) return;
    $('.project__idx', el).textContent = String(i + 1).padStart(2, '0');
    list.appendChild(el);
  });
  if (personaSelect) personaSelect.value = key;
  if (push) history.pushState({ persona: key }, '', p.path);
  initLabs(key);
  track('persona', key);
  if (window.Edition) window.Edition.refresh();
}

function switchPersona(key) {
  if (key === currentPersona || swarmRun) { if (personaSelect) personaSelect.value = currentPersona; return; }
  unlock('shapeshifter');
  swarmRebuild({ quiet: true, onHalf: () => applyPersona(key, true) });
}

if (personaSelect) personaSelect.addEventListener('change', () => switchPersona(personaSelect.value));
window.addEventListener('popstate', () => applyPersona((history.state && history.state.persona) || personaFromPath(location.pathname), false));

const labsReady = {};
function initLabs(key) {
  if (key === 'data' && !labsReady.data) { labsReady.data = true; initDataLab(); }
  if (key === 'design' && !labsReady.design) { labsReady.design = true; initStyleLab(); }
  if (key === 'shop' && !labsReady.shop) { labsReady.shop = true; initImageLab(); }
}

/* Data lab: synthetic availability data, drawn as an SVG bar chart */
function initDataLab() {
  let seed = 7;
  const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const days = [];
  for (let i = 1; i <= 30; i++) {
    let v = 99.55 + rnd() * 0.45;
    if (i === 6 || i === 17 || i === 24) v = 97.2 + rnd() * 1.4;
    days.push({ day: i, v: Math.round(v * 100) / 100 });
  }
  const mean = days.reduce((s, d) => s + d.v, 0) / days.length;
  const low = days.filter((d) => d.v < 99);
  const worst = days.reduce((m, d) => (d.v < m.v ? d : m), days[0]);
  const kpi = [
    [mean.toFixed(2) + '%', 'Mean availability'],
    [String(low.length), 'Days below 99%'],
    [worst.v.toFixed(2) + '%', 'Lowest day (day ' + worst.day + ')'],
    [String(low.length * 2), 'Alert emails (synthetic)'],
  ];
  const k = $('#kpis');
  kpi.forEach(([n, l]) => {
    const d = document.createElement('div');
    d.className = 'kpi';
    const b = document.createElement('b');
    b.textContent = n;
    const s = document.createElement('span');
    s.textContent = l;
    d.append(b, s);
    k.appendChild(d);
  });
  const NS = 'http://www.w3.org/2000/svg';
  const svg = $('#uptimeChart');
  const x0 = 38, y0 = 190, w = 550, h = 170, min = 96, max = 100;
  const y = (v) => y0 - ((Math.max(min, v) - min) / (max - min)) * h;
  const el = (name, attrs) => { const n = document.createElementNS(NS, name); Object.keys(attrs).forEach((a) => n.setAttribute(a, attrs[a])); return n; };
  [96, 97, 98, 99, 100].forEach((t) => {
    svg.appendChild(el('line', { x1: x0, x2: x0 + w, y1: y(t), y2: y(t), class: t === 99 ? 'chart__limit' : 'chart__grid' }));
    const tx = el('text', { x: x0 - 6, y: y(t) + 3, 'text-anchor': 'end', class: 'chart__tick' });
    tx.textContent = t + '%';
    svg.appendChild(tx);
  });
  const bw = w / days.length;
  days.forEach((d, i) => {
    svg.appendChild(el('rect', { x: x0 + i * bw + 2, y: y(d.v), width: bw - 4, height: y0 - y(d.v), class: d.v < 99 ? 'bar bar--low' : 'bar' }));
    if (i % 5 === 0 || i === days.length - 1) {
      const tx = el('text', { x: x0 + i * bw + bw / 2, y: y0 + 14, 'text-anchor': 'middle', class: 'chart__tick' });
      tx.textContent = 'd' + d.day;
      svg.appendChild(tx);
    }
  });
  const table = $('#dataTable');
  const head = document.createElement('tr');
  ['Day', 'Availability %'].forEach((t) => { const th = document.createElement('th'); th.textContent = t; head.appendChild(th); });
  table.appendChild(head);
  days.forEach((d) => {
    const tr = document.createElement('tr');
    [d.day, d.v.toFixed(2)].forEach((t) => { const td = document.createElement('td'); td.textContent = t; tr.appendChild(td); });
    table.appendChild(tr);
  });
}

/* Style lab: re-skin the whole page by switching design tokens */
function initStyleLab() {
  const NOTES = {
    swiss: 'Swiss: strict grid, one sans-serif typeface, one accent colour, heavy rules. The default of this site.',
    editorial: 'Editorial: serif type, warm paper background, hairline rules and a restrained rust accent.',
    brutalist: 'Brutalist: monospace type, thick black borders, hard offset shadows and one loud accent.',
    renaissance: 'Renaissance: parchment colours, oxblood ink, small-capital headings and double-line borders.',
    'renaissance-plus': 'Renaissance Edition: a complete redesign. The site becomes a gallery of painted scenes in light and dark, with huge headlines, a Roman chapter index, torn-paper edges and a hidden layer (press X) that shows the real code under each painting.',
    'swiss-plus': 'Swiss Edition: a complete redesign. Every section is a numbered poster sheet on a visible grid, with giant outlined numerals and one red circle that moves from sheet to sheet.',
    'editorial-plus': 'Editorial Edition: a complete redesign. The site is a magazine issue: a cover, a contents page, then every section as a full-page feature opener with a screened painting that the spread slides over, with running heads, columns and a colophon.',
    'brutalist-plus': 'Brutalist Edition: a complete redesign. Raw monospace, every block is an OS-style window with a hard shadow, and a marquee of skills scrolls under the headline.',
    'bauhaus-plus': 'Bauhaus Edition: a complete redesign. A circle, a square and a triangle in primary colours re-compose behind every chapter, and each section is a numbered studio.',
    'minimal-plus': 'Minimalism Edition: a complete redesign. Lots of empty space, slow fades and a quiet counter. Press j and k, or the left and right arrow keys, to step between chapters.',
    'neural-plus': 'Neural Edition: a complete redesign. The profile becomes a graph of glowing nodes behind glass cards. Move the cursor to pull nodes together; Pause motion stops it.',
    'cosmos-plus': 'Cosmos Edition: a complete redesign. Scroll through a parallax sky, navigate with the orrery, and trace each skill group as a constellation. Daylight mode is a sky chart.',
    bauhaus: 'Bauhaus: primary colours, geometric sans-serif, heavy blocks and round and square forms.',
    minimal: 'Minimalism: white space, light type weights and almost no lines. Content first, nothing else.',
    neural: 'Neural: the AI-company look. Deep navy, a soft glow, rounded cards and a gradient headline.',
    cosmos: 'Cosmos: deep space, slowly drifting stars, a neon accent and glowing type. Stars stand still if you prefer reduced motion.',
  };
  const note = $('#styleNote');
  const buttons = $$('.style-picker button');
  function setStyle(name) {
    if (name === 'swiss') document.documentElement.removeAttribute('data-style');
    else document.documentElement.setAttribute('data-style', name);
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.style === name)));
    note.textContent = NOTES[name];
  }
  buttons.forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.style === 'renaissance-plus' && window.Edition && !window.Edition.active()) window.Edition.enter();
    else if (/^[a-z]+-plus$/.test(b.dataset.style) && window.PlusEditions) window.PlusEditions.enter(b.dataset.style);
    else setStyle(b.dataset.style);
  }));
  setStyle(document.documentElement.getAttribute('data-style') || 'swiss');
}

/* Image lab: placeholder blur, live layout-shift and transfer numbers, naive comparison */
function initImageLab() {
  const box = $('#imgMetrics');
  let cls = 0;
  function render() {
    const res = performance.getEntriesByType('resource').filter((r) => r.name.indexOf('/img/shop/') > -1);
    const bytes = res.reduce((s, r) => s + (r.transferSize || r.encodedBodySize || 0), 0);
    const pending = $$('#shop-lab img').filter((i) => !i.complete).length;
    box.textContent = 'Layout shift (CLS): ' + cls.toFixed(3) + '  ·  Images requested: ' + res.length + '  ·  Transferred: ' + Math.round(bytes / 1024) + ' KB  ·  Still waiting (lazy): ' + pending;
  }
  try {
    new PerformanceObserver((list) => {
      list.getEntries().forEach((e) => { if (!e.hadRecentInput) cls += e.value; });
      render();
    }).observe({ type: 'layout-shift', buffered: true });
  } catch (e) {}
  try { new PerformanceObserver(render).observe({ type: 'resource', buffered: true }); } catch (e) {}
  $('#shop-lab').addEventListener('load', render, true);
  render();

  const naive = $('#naiveToggle');
  const nbox = $('#naiveBox');
  naive.addEventListener('click', () => {
    const open = nbox.hidden;
    nbox.hidden = !open;
    naive.setAttribute('aria-expanded', String(open));
    naive.textContent = open ? 'Hide the naive markup' : 'Compare with naive markup';
    if (open && !nbox.children.length) {
      const p = document.createElement('p');
      p.className = 'style-note';
      const ref = $('.product__img');
      const probe = (dims) => {
        const wrap = document.createElement('div');
        wrap.style.width = ref.getBoundingClientRect().width + 'px';
        const im = document.createElement('img');
        im.alt = '';
        if (dims) { im.width = 1200; im.height = 900; }
        im.style.width = '100%';
        im.style.height = 'auto';
        wrap.appendChild(im);
        nbox.appendChild(wrap);
        const reserved = Math.round(im.getBoundingClientRect().height);
        wrap.remove();
        return reserved;
      };
      p.textContent = 'Same images, but one large JPEG each, no dimensions, no lazy loading. Before an image arrives, the optimised markup reserves ' + probe(true) + ' px of height per image and the naive markup reserves ' + probe(false) + ' px, so the naive page jumps as its images load. Compare the transferred size above.';
      const grid = document.createElement('div');
      grid.className = 'naive-grid';
      ['mug', 'lamp', 'pack', 'phones', 'plant', 'book'].forEach((n) => {
        const im = document.createElement('img');
        im.src = '/img/shop/' + n + '-1200.jpg?naive=1';
        im.alt = '';
        grid.appendChild(im);
      });
      nbox.append(p, grid);
    }
    render();
  });
}
$$('.product__img').forEach((el) => { if (el.dataset.lqip) el.style.backgroundImage = 'url(' + el.dataset.lqip + ')'; });

if (personaSelect) personaSelect.value = currentPersona;
initLabs(currentPersona);

/* ---------- More secrets ---------- */
const brand = $('.nav__brand');
let brandClicks = 0;
let brandTimer;
brand.addEventListener('click', () => {
  brandClicks++;
  clearTimeout(brandTimer);
  brandTimer = setTimeout(() => { brandClicks = 0; }, 3000);
  if (brandClicks >= 7) {
    brandClicks = 0;
    unlock('door');
    toast('Secret door found. Opening the lab...');
    setTimeout(() => { location.href = '/lab/'; }, 1200);
  }
});
document.addEventListener('keydown', (e) => {
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
  if (e.key === '?') toast('Hints: a famous cheat code, the assistant, the logo, and the backtick key.');
  else if (e.key === '`') { unlock('hacker'); location.href = '/terminal/'; }
});
window.kampolo = {
  help: () => 'kampolo.swarm()  kampolo.lab()  kampolo.terminal()',
  swarm: () => swarmRebuild(),
  lab: () => { location.href = '/lab/'; },
  terminal: () => { location.href = '/terminal/'; },
};
console.info('%cHello, curious one.%c Try kampolo.help()', 'font-weight:700;color:#e30613', '');
if (/[?&]swarm=1(&|$)/.test(location.search)) { unlock('cheat'); setTimeout(() => swarmRebuild(), 700); }

renderHud();
