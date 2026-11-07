/* The Renaissance Edition (the + beside Renaissance), choreographed after the Awwwards entry The Renaissance Edition.
   Turning on data-style="renaissance-plus" re-skins the page (styles.css); this script restructures it into pinned painted
   stages driven by scroll: fixed chrome (top bar, wordmark, Roman chapter list), Stage A (interior, drifting cards,
   a fanned deck, a hand with a phone, a sliding demo panel), Stage B (the painter's studio, studio.js), then each chapter as a
   pinned scene that a torn-paper edge wipes over. Everything it moves is put back when the Edition is left.
   Entering runs the swarm effect and swaps the style halfway through. Classic script, loaded after script.js and studio.js. */
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  var EMAIL = 'kampolotomasva@gmail.com';

  // Real excerpts from this repository, shown as the "underdrawing" beneath each scene.
  var UNDER = {
    home: { file: 'track.js', code: "if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;\nnavigator.sendBeacon('/api/ping', new Blob([body], { type: 'application/json' }));" },
    'ren-studio': { file: 'script.js', code: 'swarmRebuild({ quiet: true, onHalf: () => applyPersona(key, true) });' },
    about: { file: 'netlify/functions/ping.mjs', code: "const EVENTS = new Set(['view', 'persona', 'chat', 'match', 'swarm', 'download', 'doc_request']);" },
    experience: { file: 'netlify/functions/providers.mjs', code: '  for (const step of steps) {\n    try {\n      return await step.provider.run({ ...args, env, model: step.model });\n    } catch (err) {' },
    projects: { file: 'netlify/functions/chat.mjs', code: 'const WINDOW_MS = 10 * 60 * 1000;\nconst MAX_PER_WINDOW = 15;' },
    skills: { file: 'netlify/functions/chat.mjs', code: 'const MAX_MESSAGES = 10;\nconst MAX_CHARS = 600;\nconst MAX_AD_CHARS = 3000;' },
    education: { file: 'netlify/functions/providers.mjs', code: '// Haiku thinks by default and spends the small token cap, so the visible answer is cut short or empty.\n// Sonnet rejects "disabled" (400) and does not need it.' },
    contact: { file: 'netlify/functions/ping.mjs', code: 'if (!EVENTS.has(e) || !SAFE.test(d) || !SAFE.test(p)) return new Response(null, { status: 400 });' },
  };

  // Ledes for chapters that have no lead paragraph of their own; they only restate what the section already says.
  var LEDES = {
    experience: 'A software engineering placement, freelance IT support, and general IT and administration.',
    education: 'A Bachelor of Informatics, the Universal AI programme with 19 certificates, and HP LIFE.',
  };

  var CARDS = [
    { t: 'React Native', c: '#c4572a', x: 56, y: 12, s: 1.15, r: 10 },
    { t: 'Node.js', c: '#3c7a4a', x: 74, y: 40, s: 0.8, r: -14 },
    { t: 'Python', c: '#2f5f9e', x: 46, y: 66, s: 1.35, r: 18 },
    { t: 'Claude API', c: '#8a3fa0', x: 86, y: 74, s: 0.95, r: -8 },
    { t: 'SQL', c: '#b8902f', x: 64, y: 100, s: 1.5, r: 22 },
    { t: 'Firebase', c: '#444444', x: 90, y: 116, s: 1.1, r: -20 },
  ];

  var DEMO_AD = 'Senior Flutter developer, 8+ years of experience, strong Dart, led a team of five. Remote friendly. Firebase a plus.';
  var DEMO_OUT = 'Fit: Weak - the advert wants a senior Flutter/Dart developer with 8+ years and team leadership, while the facts show early-career experience and no Flutter or Dart work.\nMatches:\n- Mobile apps in React Native and Expo.\n- Firebase and Firestore at a working level.\nGaps:\n- Flutter and Dart: not shown anywhere in the facts.\n- 8+ years: he is early-career.\nNext step: email Kampolo.';

  var undo = [];
  var extras = [];
  var scenes = [];
  var stageA = null;
  var stageB = null;
  var nav = null;
  var io = null;
  var near = null;
  var live = null;
  var intro = null;
  var introTimer = null;
  var ticking = false;
  var typing = 0;
  var placed = null;

  function active() { return root.getAttribute('data-style') === 'renaissance-plus'; }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function clamp(v) { return Math.min(1, Math.max(0, v)); }
  function seg(p, a, b) { return clamp((p - a) / (b - a)); }
  function ease(t) { return t * t * (3 - 2 * t); }

  function syncPicker() {
    var cur = root.getAttribute('data-style') || 'swiss';
    document.querySelectorAll('.style-picker button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.style === cur)); });
  }

  function setLayer(on) {
    if (on) root.setAttribute('data-layer', 'on'); else root.removeAttribute('data-layer');
    var btn = document.getElementById('renLayerBtn');
    if (btn) btn.setAttribute('aria-pressed', String(on));
    if (on && typeof track === 'function') track('swarm', 'layer');
  }

  /* ---------- fixed chrome ---------- */
  function chrome() {
    var top = el('div', 'ren-top');
    var brand = el('span', '', 'Kampolo Tomas');
    brand.appendChild(el('em', '', 'Edition MMXXVI'));
    var menuBtn = el('button', '', 'Editions ▾');
    menuBtn.type = 'button';
    menuBtn.setAttribute('aria-haspopup', 'true');
    menuBtn.setAttribute('aria-expanded', 'false');
    top.appendChild(brand);
    top.appendChild(menuBtn);

    var menu = el('ul', 'ren-menu');
    menu.hidden = true;
    [['Classic site', leave], ['Renaissance (simple skin)', function () { root.setAttribute('data-style', 'renaissance'); syncPicker(); }]].forEach(function (it) {
      var li = el('li');
      var b = el('button', '', it[0]);
      b.type = 'button';
      b.addEventListener('click', function () { menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); it[1](); });
      li.appendChild(b);
      menu.appendChild(li);
    });
    menuBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
      menuBtn.setAttribute('aria-expanded', String(!menu.hidden));
    });
    function closeMenu(e) { if (e.target !== menuBtn && !menu.contains(e.target)) { menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); } }
    document.addEventListener('click', closeMenu);
    undo.push(function () { document.removeEventListener('click', closeMenu); });

    var cta = el('div', 'ren-cta');
    var mail = el('a', '', 'Email');
    mail.href = 'mailto:' + EMAIL;
    var pill = el('a', 'ren-cta__pill', 'Contact');
    pill.href = '#contact';
    cta.appendChild(mail);
    cta.appendChild(pill);

    var mark = el('p', 'ren-mark');
    ['The', 'Kampolo', 'Edition'].forEach(function (w, i) { if (i) mark.appendChild(document.createElement('br')); mark.appendChild(document.createTextNode(w)); });

    [top, menu, cta, mark].forEach(function (n) { document.body.appendChild(n); extras.push(n); });
  }

  /* ---------- Stage A: the interior, cards, a deck, a phone, a demo panel ---------- */
  function buildStageA(hero, motion) {
    var wrap = hero.querySelector('.wrap');
    if (!wrap) return;
    var sticky = el('div', 'ren-sticky');
    var art = el('div', 'ren-art');
    sticky.appendChild(art);

    var a = { hero: hero, wrap: wrap, sticky: sticky, cards: [], fan: null, phone: null, assist: null, demo: null, out: null, typed: false };
    if (motion) {
      CARDS.forEach(function (c) {
        var card = el('div', 'ren-card');
        card.style.left = c.x + '%';
        card.style.top = c.y + 'vh';
        var inner = el('div', 'ren-card__in');
        var dot = el('span', 'ren-card__dot');
        dot.style.setProperty('--dot', c.c);
        inner.appendChild(dot);
        inner.appendChild(document.createTextNode(c.t));
        card.appendChild(inner);
        sticky.appendChild(card);
        a.cards.push({ el: card, s: c.s, r: c.r });
      });

      var fan = el('div', 'ren-fan');
      var fin = el('div', 'ren-fan__in');
      var names = Array.prototype.map.call(document.querySelectorAll('#projectList .project__name'), function (n) { return n.textContent.trim(); }).slice(0, 6);
      if (!names.length) names = ['Projects'];
      names.forEach(function (n, i) {
        var c = el('div', 'ren-fan__card');
        c.style.setProperty('--i', String(i));
        c.appendChild(el('b', '', String(i + 1).padStart(2, '0')));
        c.appendChild(document.createTextNode(n));
        fin.appendChild(c);
      });
      fan.appendChild(fin);
      sticky.appendChild(fan);
      a.fan = fan;

      var phone = el('div', 'ren-phone');
      var body = el('div', 'ren-phone__body');
      body.appendChild(el('span', 'ren-phone__bar'));
      body.appendChild(el('div', 'ren-phone__head', "Kampolo's assistant"));
      body.appendChild(el('div', 'ren-phone__msg ren-phone__msg--me', 'What does Kampolo do?'));
      body.appendChild(el('div', 'ren-phone__msg ren-phone__msg--bot', 'He is a software engineer and IT specialist based in Windhoek, Namibia.'));
      body.appendChild(el('div', 'ren-phone__in', 'Ask about Kampolo'));
      phone.appendChild(body);
      sticky.appendChild(phone);
      a.phone = phone;

      var assist = el('div', 'ren-assist');
      assist.appendChild(el('h2', '', 'Ask the assistant'));
      assist.appendChild(el('p', '', 'A chatbot that answers only from the facts on this page, and says so when it does not know.'));
      var ask = el('button', 'btn', 'Open the chat');
      ask.type = 'button';
      ask.addEventListener('click', function () { var f = document.querySelector('.chat-fab'); if (f) f.click(); });
      assist.appendChild(ask);
      sticky.appendChild(assist);
      a.assist = assist;

      var demo = el('div', 'ren-demo');
      var win = el('div', 'ren-demo__win');
      var bar = el('div', 'ide__bar');
      ['r', 'y', 'g'].forEach(function (c) { bar.appendChild(el('i', 'ide__dot ide__dot--' + c)); });
      bar.appendChild(el('span', 'ide__tab', 'Job advert matcher'));
      var dbody = el('div', 'ren-demo__body');
      dbody.appendChild(el('p', 'ren-demo__label', 'Pasted advert'));
      dbody.appendChild(el('p', 'ren-demo__ad', DEMO_AD));
      dbody.appendChild(el('p', 'ren-demo__label', 'Example answer'));
      a.out = el('pre', 'ren-demo__out');
      dbody.appendChild(a.out);
      win.appendChild(bar);
      win.appendChild(dbody);
      demo.appendChild(win);
      demo.appendChild(el('p', 'ren-demo__cap', 'Paste a job advert and the assistant scores the fit using only the facts on this page.'));
      sticky.appendChild(demo);
      a.demo = demo;
    }

    var parent = wrap.parentNode;
    var next = wrap.nextSibling;
    sticky.appendChild(wrap);
    hero.appendChild(sticky);
    hero.classList.add('ren-a');
    undo.push(function () { wrap.style.removeProperty('visibility'); parent.insertBefore(wrap, next); sticky.remove(); hero.classList.remove('ren-a'); hero.style.removeProperty('--hp'); });
    stageA = a;
  }

  function startTyping(a) {
    if (a.typed || !a.out) return;
    a.typed = true;
    var t0 = performance.now();
    function tick(now) {
      var n = Math.floor(DEMO_OUT.length * Math.min(1, (now - t0) / 4200));
      a.out.textContent = DEMO_OUT.slice(0, n);
      if (n < DEMO_OUT.length && stageA === a) typing = requestAnimationFrame(tick);
    }
    typing = requestAnimationFrame(tick);
  }

  /* ---------- Stage B: the painter at work. His own painting is the stage: code runs on the monitor, and the portrait is painted onto
     the easel canvas over the underdrawing. Coordinates are in the 1600x1000 scene image (scene-studio-dark.webp). ---------- */
  var STUDIO = {
    screen: { quad: [[203, 364], [500, 368], [498, 596], [202, 598]], clip: [[203, 364], [500, 368], [500, 483], [450, 551], [412, 598], [202, 598]], local: [400, 315] },
  };
  var overlays = [];

  function percentClip(pts, quad) {
    var xs = quad.map(function (q) { return q[0]; });
    var ys = quad.map(function (q) { return q[1]; });
    var x0 = Math.min.apply(null, xs), y0 = Math.min.apply(null, ys);
    var w = Math.max.apply(null, xs) - x0, h = Math.max.apply(null, ys) - y0;
    return 'polygon(' + pts.map(function (q) { return ((q[0] - x0) / w * 100).toFixed(2) + '% ' + ((q[1] - y0) / h * 100).toFixed(2) + '%'; }).join(',') + ')';
  }

  // CSS matrix3d that maps a w x h element onto a four-sided shape (top-left, top-right, bottom-right, bottom-left) in screen pixels.
  function quadMatrix(w, h, q) {
    var x0 = q[0][0], y0 = q[0][1], x1 = q[1][0], y1 = q[1][1], x2 = q[2][0], y2 = q[2][1], x3 = q[3][0], y3 = q[3][1];
    var dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
    var dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
    var g = 0, hh = 0, a, b, d, e;
    if (dx3 !== 0 || dy3 !== 0) {
      var den = dx1 * dy2 - dx2 * dy1;
      g = (dx3 * dy2 - dx2 * dy3) / den;
      hh = (dx1 * dy3 - dx3 * dy1) / den;
    }
    a = x1 - x0 + g * x1; b = x3 - x0 + hh * x3; d = y1 - y0 + g * y1; e = y3 - y0 + hh * y3;
    return 'matrix3d(' + [a / w, d / w, 0, g / w, b / h, e / h, 0, hh / h, 0, 0, 1, 0, x0, y0, 0, 1].map(function (n) { return n.toFixed(6); }).join(',') + ')';
  }

  function buildStageB(main, motion) {
    var sec = el('section', 'ren-b');
    sec.id = 'ren-studio';
    sec.setAttribute('data-section', 'Studio');
    sec.setAttribute('role', 'img');
    sec.setAttribute('aria-label', 'A painting of a gentleman in a rose velvet cloak, seen from behind, painting a portrait on an easel while code runs on a monitor beside him.');
    var sticky = el('div', 'ren-sticky');
    var art = el('div', 'ren-art');
    sticky.appendChild(art);

    var screen = el('div', 'ren-screen');
    art.appendChild(screen);

    var word = el('div', 'ren-word');
    word.appendChild(el('p', 'section__num'));
    word.appendChild(el('h2', '', 'Studio'));
    word.appendChild(el('p', 'ren-lede', 'Real code on the monitor, and a portrait that goes on to the canvas one brush stroke at a time.'));
    sticky.appendChild(word);
    sec.appendChild(sticky);
    main.insertBefore(sec, main.firstChild);

    var studio = window.Studio ? window.Studio.create() : null;
    if (studio) screen.appendChild(studio.root);
    overlays = [{ el: screen, spec: STUDIO.screen }];
    overlays.forEach(function (o) {
      o.el.style.width = o.spec.local[0] + 'px';
      o.el.style.height = o.spec.local[1] + 'px';
      o.el.style.clipPath = percentClip(o.spec.clip, o.spec.quad);
    });
    undo.push(function () { sec.remove(); overlays = []; });
    stageB = { sec: sec, sticky: sticky, motion: motion, studio: studio, reveal: null };
    placed = { art: art, canvas: null, patch: null };

    // The figure patch is a cut-out of the finished picture, placed exactly over the underdrawing.
    fetch('/img/renaissance/studio.json').then(function (r) { return r.json(); }).then(function (j) {
      if (!placed || !stageB || stageB.sec !== sec || !window.Studio) return;
      var canvas = el('canvas', 'ren-reveal');
      canvas.width = j.patch.w;
      canvas.height = j.patch.h;
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', 'A painted portrait of Kampolo Tomas on the easel');
      art.appendChild(canvas);
      placed.canvas = canvas;
      placed.patch = j.patch;
      stageB.reveal = window.Studio.createReveal(canvas, '/img/renaissance/scene-studio-patch.webp');
      if (!motion) stageB.reveal.finish();
      placeStudio();
    }).catch(function () {});

    // The code and the portrait both start the first time the studio is on screen.
    if ('IntersectionObserver' in window && motion) {
      var seen = new IntersectionObserver(function (entries) {
        if (entries.some(function (e) { return e.isIntersecting; })) {
          seen.disconnect();
          if (studio) studio.start();
          if (stageB && stageB.reveal) stageB.reveal.start(); else if (stageB) stageB.startReveal = true;
        }
      }, { threshold: 0.35 });
      seen.observe(sec);
      undo.push(function () { seen.disconnect(); });
    } else if (studio) {
      studio.finish();
    }
    placeStudio();
    window.addEventListener('resize', placeStudio);
  }

  // The overlays are laid onto the painting with the same "cover" maths as its background, so they stay glued to it at any size.
  function placeStudio() {
    if (!placed) return;
    var w = placed.art.offsetWidth;
    var h = placed.art.offsetHeight;
    var focus = (getComputedStyle(placed.art).getPropertyValue('--focus') || '50% 50%').trim().split(/\s+/).map(function (v) { return parseFloat(v) / 100; });
    var s = Math.max(w / 1600, h / 1000);
    var ox = (w - 1600 * s) * (isNaN(focus[0]) ? 0.5 : focus[0]);
    var oy = (h - 1000 * s) * (isNaN(focus[1]) ? 0.5 : focus[1]);
    var map = function (pt) { return [ox + pt[0] * s, oy + pt[1] * s]; };
    overlays.forEach(function (o) {
      o.el.style.transform = quadMatrix(o.spec.local[0], o.spec.local[1], o.spec.quad.map(map));
    });
    if (placed.canvas && placed.patch) {
      var st = placed.canvas.style;
      st.left = (ox + placed.patch.x * s).toFixed(1) + 'px';
      st.top = (oy + placed.patch.y * s).toFixed(1) + 'px';
      st.width = (placed.patch.w * s).toFixed(1) + 'px';
      st.height = (placed.patch.h * s).toFixed(1) + 'px';
      if (stageB && stageB.startReveal && stageB.reveal) { stageB.startReveal = false; stageB.reveal.start(); }
    }
  }

  /* ---------- chapters: a pinned scene, then paper with a torn edge that wipes over it ---------- */
  function tornPolygon() {
    var pts = ['0 60%'];
    var x = 0;
    var seed = 7;
    var rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    while (x < 100) {
      x += 0.6 + rnd() * 1.4;
      pts.push(Math.min(x, 100).toFixed(2) + '% ' + (22 + rnd() * 58).toFixed(1) + '%');
    }
    pts.push('100% 100%', '0 100%');
    return 'polygon(' + pts.join(',') + ')';
  }

  function buildChapter(section) {
    var wrap = section.querySelector('.wrap');
    var head = section.querySelector('.section__head');
    if (!wrap || !head) return null;
    var scene = el('div', 'ren-scene');
    scene.appendChild(el('div', 'ren-art'));
    var word = el('div', 'ren-word');
    var lead = section.querySelector('.about__lead, .section__intro');
    var text = lead ? lead.textContent.replace(/\s+/g, ' ').trim() : LEDES[section.id] || '';
    var headParent = head.parentNode;
    var headNext = head.nextSibling;
    word.appendChild(head);
    if (text) word.appendChild(el('p', 'ren-lede', text));
    scene.appendChild(word);

    var paper = el('div', 'ren-paper');
    var tear = el('div', 'ren-tear');
    tear.appendChild(document.createElement('i'));
    var wrapParent = wrap.parentNode;
    var wrapNext = wrap.nextSibling;
    paper.appendChild(tear);
    paper.appendChild(wrap);
    section.appendChild(scene);
    section.appendChild(paper);
    undo.push(function () {
      headParent.insertBefore(head, headNext);
      wrapParent.insertBefore(wrap, wrapNext);
      scene.remove();
      paper.remove();
    });
    return { section: section, scene: scene, paper: paper };
  }

  /* ---------- one scroll engine for everything that moves ---------- */
  function applyA(hp, vh) {
    var a = stageA;
    a.sticky.style.setProperty('--p', (hp * 0.7).toFixed(4));
    // The title block fades out by 25% of the way through; once gone it must not stay in the keyboard order.
    a.wrap.style.visibility = hp > 0.24 ? 'hidden' : '';
    if (!a.cards.length) return;
    a.cards.forEach(function (c) {
      c.el.style.transform = 'translate3d(0,' + (-(hp * c.s * 1.9 * vh)).toFixed(1) + 'px,0) rotate(' + (c.r + hp * c.s * 140).toFixed(1) + 'deg)';
    });
    a.fan.style.opacity = (1 - seg(hp, 0.3, 0.52)).toFixed(3);
    a.fan.style.transform = 'translate3d(0,' + (-seg(hp, 0.08, 0.5) * 0.24 * vh).toFixed(1) + 'px,0)';
    var py = (1 - ease(seg(hp, 0.14, 0.4))) * 1.08 - seg(hp, 0.46, 0.78) * 0.75;
    a.phone.style.transform = 'translate3d(0,' + (py * vh).toFixed(1) + 'px,0)';
    var assistOpacity = seg(hp, 0.2, 0.3) * (1 - seg(hp, 0.46, 0.58));
    a.assist.style.opacity = assistOpacity.toFixed(3);
    a.assist.style.visibility = assistOpacity < 0.02 ? 'hidden' : '';
    a.assist.style.transform = 'translate3d(0,' + ((-seg(hp, 0.4, 0.7) * 0.3 + (1 - seg(hp, 0.2, 0.32)) * 0.06) * vh).toFixed(1) + 'px,0)';
    var dy = (1 - ease(seg(hp, 0.5, 0.72))) * 1.04 - seg(hp, 0.9, 1) * 0.2;
    a.demo.style.transform = 'translate3d(0,' + (dy * vh).toFixed(1) + 'px,0)';
    if (seg(hp, 0.55, 0.75) > 0.4) startTyping(a);
  }

  function frame() {
    ticking = false;
    var vh = window.innerHeight;
    if (stageA) {
      var r = stageA.hero.getBoundingClientRect();
      var hp = clamp(-r.top / Math.max(1, r.height - vh));
      stageA.hero.style.setProperty('--hp', hp.toFixed(4));
      applyA(hp, vh);
    }
    if (stageB) {
      var rb = stageB.sec.getBoundingClientRect();
      stageB.sticky.style.setProperty('--p', (seg(clamp(-rb.top / Math.max(1, rb.height - vh)), 0.55, 1)).toFixed(4));
    }
    scenes.forEach(function (s) {
      var rs = s.section.getBoundingClientRect();
      if (rs.bottom < 0 || rs.top > vh * 1.2) return;
      s.scene.style.setProperty('--p', clamp(1 - s.paper.getBoundingClientRect().top / vh).toFixed(4));
    });
  }

  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(frame); }
  }

  /* ---------- build and teardown ---------- */
  function teardown() {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    cancelAnimationFrame(typing);
    window.removeEventListener('resize', placeStudio);
    placed = null;
    if (io) { io.disconnect(); io = null; }
    if (near) { near.disconnect(); near = null; }
    if (live) { live.disconnect(); live = null; }
    if (window.Studio) window.Studio.unmountAll();
    while (undo.length) undo.pop()();
    extras.forEach(function (n) { n.remove(); });
    extras = [];
    if (nav) { nav.remove(); nav = null; }
    document.querySelectorAll('.ren-under').forEach(function (n) { n.remove(); });
    document.querySelectorAll('.section__num[data-roman]').forEach(function (n) { n.removeAttribute('data-roman'); });
    scenes = [];
    stageA = null;
    stageB = null;
    root.style.removeProperty('--torn');
    root.classList.remove('ren-static');
    root.removeAttribute('data-layer');
    dismissIntro(true);
  }

  function build() {
    teardown();
    var motion = !reduce.matches;
    if (!motion) root.classList.add('ren-static');
    root.style.setProperty('--torn', tornPolygon());
    var hero = document.getElementById('home');
    var main = document.getElementById('main');
    if (!hero || !main) return;
    chrome();
    buildStageA(hero, motion);
    buildStageB(main, motion);
    var sections = Array.prototype.filter.call(main.querySelectorAll('.section'), function (s) { return s.offsetParent !== null; });
    sections.forEach(function (s) { var c = buildChapter(s); if (c) scenes.push(c); });

    var stops = [{ el: hero, id: 'home', label: 'Home', host: stageA && stageA.sticky }, { el: stageB.sec, id: 'ren-studio', label: 'Studio', host: stageB.sticky }];
    scenes.forEach(function (c) { stops.push({ el: c.section, id: c.section.id, label: c.section.getAttribute('data-section') || c.section.id, host: c.scene }); });

    stops.forEach(function (st, i) {
      var roman = ROMAN[i] || String(i + 1);
      var num = st.id === 'home' || !st.host ? null : st.host.querySelector('.section__num');
      if (num) num.setAttribute('data-roman', roman);
      if (!st.host) return;
      var u = UNDER[st.id] || UNDER.about;
      var d = el('div', 'ren-under');
      d.setAttribute('aria-hidden', 'true');
      d.appendChild(el('p', 'ren-under__file', 'Underdrawing: ' + u.file));
      d.appendChild(el('pre', '', u.code));
      st.host.appendChild(d);
    });

    nav = el('nav', 'ren-index');
    nav.setAttribute('aria-label', 'Chapters');
    var ol = el('ol');
    stops.forEach(function (st, i) {
      var li = el('li');
      var a = el('a');
      a.href = '#' + st.id;
      a.appendChild(el('span', '', st.label));
      a.appendChild(el('i', '', (ROMAN[i] || String(i + 1)).toLowerCase()));
      li.appendChild(a);
      ol.appendChild(li);
    });
    nav.appendChild(ol);
    var layer = el('button', '', 'Hidden layer (X)');
    layer.type = 'button';
    layer.id = 'renLayerBtn';
    layer.setAttribute('aria-pressed', 'false');
    layer.addEventListener('click', function () { setLayer(root.getAttribute('data-layer') !== 'on'); });
    var exit = el('button', '', 'Leave the Edition');
    exit.type = 'button';
    exit.addEventListener('click', leave);
    nav.appendChild(layer);
    nav.appendChild(exit);
    var legal = el('p', 'ren-legal');
    legal.appendChild(document.createTextNode('© 2026 Kampolo Tomas · '));
    var docs = el('a', '', 'Documents');
    docs.href = '/documents/';
    legal.appendChild(docs);
    nav.appendChild(legal);
    document.body.appendChild(nav);

    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          nav.querySelectorAll('a').forEach(function (a) { a.removeAttribute('aria-current'); });
          var a = nav.querySelector('a[href="#' + e.target.id + '"]');
          if (a) a.setAttribute('aria-current', 'true');
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      stops.forEach(function (st) { io.observe(st.el); });
    }

    // Paintings load only when their scene is within about a screen and a half of the viewport.
    var arts = Array.prototype.slice.call(document.querySelectorAll('.ren-art'));
    if ('IntersectionObserver' in window) {
      live = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { e.target.classList.toggle('is-live', e.isIntersecting); });
      });
      arts.forEach(function (a) { live.observe(a); });
      near = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-near'); near.unobserve(e.target); } });
      }, { rootMargin: '150% 0px' });
      arts.forEach(function (a) { near.observe(a); });
    } else {
      arts.forEach(function (a) { a.classList.add('is-near'); });
    }

    if (motion) {
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
      frame();
    }
  }

  function dismissIntro(now) {
    clearTimeout(introTimer);
    if (!intro) return;
    var n = intro;
    intro = null;
    if (now) { n.remove(); return; }
    n.classList.add('is-out');
    setTimeout(function () { n.remove(); }, 700);
  }

  function showIntro() {
    try {
      if (sessionStorage.getItem('kt-edition-intro')) return;
      sessionStorage.setItem('kt-edition-intro', '1');
    } catch (e) {}
    if (reduce.matches) return;
    intro = el('div', 'ren-intro');
    intro.setAttribute('role', 'dialog');
    intro.setAttribute('aria-label', 'Introduction');
    var framed = el('div', 'ren-intro__frame');
    framed.appendChild(el('p', 'ren-intro__year', 'MMXXVI'));
    framed.appendChild(el('p', 'ren-intro__title', 'The Kampolo Edition'));
    framed.appendChild(el('p', 'ren-intro__sub', 'A portfolio in chapters'));
    var skip = el('button', 'ren-intro__skip', 'Skip');
    skip.type = 'button';
    skip.addEventListener('click', function () { dismissIntro(false); });
    intro.appendChild(framed);
    intro.appendChild(skip);
    document.body.appendChild(intro);
    skip.focus();
    introTimer = setTimeout(function () { dismissIntro(false); }, 2800);
  }

  function enter() {
    if (active()) return;
    var go = function () { root.setAttribute('data-style', 'renaissance-plus'); syncPicker(); };
    if (typeof swarmRebuild === 'function') swarmRebuild({ quiet: true, onHalf: go }); else go();
  }

  function leave() {
    root.removeAttribute('data-style');
    syncPicker();
    window.scrollTo(0, 0);
  }

  new MutationObserver(function () {
    if (active()) {
      build();
      showIntro();
      try {
        if (!sessionStorage.getItem('kt-edition-xp') && typeof award === 'function') { sessionStorage.setItem('kt-edition-xp', '1'); award(25, 'Renaissance Edition'); }
      } catch (e) {}
    } else {
      teardown();
    }
  }).observe(root, { attributes: true, attributeFilter: ['data-style'] });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && intro) { dismissIntro(false); return; }
    if ((e.key === 'x' || e.key === 'X') && active() && !e.ctrlKey && !e.metaKey && !e.altKey) {
      var t = e.target;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      setLayer(root.getAttribute('data-layer') !== 'on');
    }
  });

  var btn = document.getElementById('editionBtn');
  if (btn) btn.addEventListener('click', enter);

  window.Edition = { enter: enter, leave: leave, active: active, refresh: function () { if (active()) build(); } };

  if (/[?&]style=renaissance-plus\b/.test(location.search)) root.setAttribute('data-style', 'renaissance-plus');
})();
