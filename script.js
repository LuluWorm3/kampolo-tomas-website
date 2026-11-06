const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

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
systemDark.addEventListener('change', syncThemeLabel);
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
    links.forEach((a) => a.classList.remove('active'));
    const a = links.get(en.target.id);
    if (a) a.classList.add('active');
    const name = en.target.dataset.section;
    if (name && !state.sections.includes(name)) {
      state.sections.push(name);
      award(SECTION_XP, `Visited ${name}`);
      if (allSections.every((s) => state.sections.includes(s.dataset.section))) unlock('explorer');
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

function swarmRebuild() {
  if (swarmRun) return;
  // Started on purpose by the visitor, so it always runs. Reduced motion gets a calm version:
  // no flicker, no smooth scrolling, faster and shorter cursor moves.
  const calm = reducedMotion.matches;
  document.body.classList.toggle('swarm-calm', calm);
  swarmBtn.hidden = false;

  const docTop = (el) => el.getBoundingClientRect().top + scrollY;
  const layers = $$('.hero__title, .hero__role, .section__head, .job, .project, .skills__group, .edu__item, .facts > div, .contact__links li')
    .filter((el) => el.getBoundingClientRect().width > 0)
    .sort((x, y) => docTop(x) - docTop(y));
  const run = { stop: false, speed: 1, done: 0, focusY: 0 };
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
    if (completed) afterSwarm();
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
  'What is Kampolo working on right now?',
  'Tell me about his chatbot platform.',
  'Where is he strongest, and where is he still learning?',
  'How does he approach security and testing?',
  'How can I contact him?',
];
const history = [];
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
    'swarm.html',
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

async function ask(text) {
  text = text.trim();
  if (!text || busy) return;
  chips.replaceChildren();
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
  busy = true;
  sendBtn.disabled = true;
  addMsg(text, 'user');
  history.push({ role: 'user', content: text });
  input.value = '';
  const typing = addMsg('Thinking…', 'bot');
  typing.classList.add('msg--typing');

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history.slice(-10) }),
    });
    const data = await res.json().catch(() => ({}));
    typing.remove();
    if (!res.ok || !data.reply) throw new Error(data.error || 'offline');
    addMsg(data.reply, 'bot');
    history.push({ role: 'assistant', content: data.reply });
    if (once('chat', 20, 'Asked the assistant')) unlock('talker');
  } catch (err) {
    typing.remove();
    history.pop();
    const msg = err.message && err.message !== 'offline' && err.message !== 'Failed to fetch'
      ? err.message
      : "The assistant is offline right now. You can email Kampolo at kampolotomasva@gmail.com.";
    addMsg(msg, 'err');
  } finally {
    busy = false;
    sendBtn.disabled = false;
    input.focus();
  }
}
form.addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });

renderHud();
