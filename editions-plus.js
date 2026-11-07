/* Shared engine for the + editions (Swiss, Editorial, Brutalist, Bauhaus, Minimalism, Neural, Cosmos), exposed as window.PlusEditions.
   An edition is a pair of files, edition-<name>.js and edition-<name>.css, loaded on first use by ensure() below, so visitors who never open the
   Style lab download none of them. The script calls PlusEditions.register(name, def); this engine then handles entering (the swarm runs, the style
   swaps halfway), the HUD with Pause motion and Leave, theme sync and the leftover-free teardown. util gives editions the shared helpers
   (el, sv, chapters, motion, reduce, mulberry, hexA, palette, glow, makeStage, makeLoop) and track(), which records everything an edition adds so
   one undo() removes it. Classic script, loaded after script.js. Styles are set through classes and CSSOM only (the CSP blocks style attributes). */
(function () {
  var root = document.documentElement;
  var reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  var darkMq = window.matchMedia('(prefers-color-scheme: dark)');
  var SVGNS = 'http://www.w3.org/2000/svg';

  // Registered by each edition's own script, which is loaded on first use (see LAZY and ensure below).
  var EDITIONS = {};
  var LAZY = {
    'swiss-plus': { js: '/edition-swiss.js', css: '/edition-swiss.css' },
    'editorial-plus': { js: '/edition-editorial.js', css: '/edition-editorial.css' },
    'brutalist-plus': { js: '/edition-brutalist.js', css: '/edition-brutalist.css' },
    'bauhaus-plus': { js: '/edition-bauhaus.js', css: '/edition-bauhaus.css' },
    'minimal-plus': { js: '/edition-minimal.js', css: '/edition-minimal.css' },
    'neural-plus': { js: '/edition-neural.js', css: '/edition-neural.css' },
    'cosmos-plus': { js: '/edition-cosmos.js', css: '/edition-cosmos.css' },
  };
  var tried = {};
  var waiting = {};

  var current = null;
  var state = null;
  var paused = false;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function sv(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  function motion() { return !reduceMq.matches && !paused; }

  function chapters() {
    var list = [];
    var home = document.getElementById('home');
    if (home) list.push(home);
    document.querySelectorAll('main .section').forEach(function (s) { if (s.offsetParent !== null) list.push(s); });
    return list;
  }

  function syncPicker() {
    var cur = root.getAttribute('data-style') || 'swiss';
    document.querySelectorAll('.style-picker button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.style === cur)); });
  }

  // Loads an edition's stylesheet and script once, then calls back (also when loading fails, so nothing waits forever).
  function ensure(name, cb) {
    if (EDITIONS[name] || !LAZY[name] || tried[name]) { cb(); return; }
    if (waiting[name]) { waiting[name].push(cb); return; }
    waiting[name] = [cb];
    var pending = 2;
    function done() {
      if (--pending) return;
      tried[name] = true;
      var cbs = waiting[name];
      delete waiting[name];
      cbs.forEach(function (f) { f(); });
    }
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = LAZY[name].css;
    link.onload = link.onerror = done;
    document.head.appendChild(link);
    var script = document.createElement('script');
    script.src = LAZY[name].js;
    script.onload = script.onerror = done;
    document.head.appendChild(script);
  }

  // Records what an edition adds (nodes, classes, attributes, properties, listeners, observers) so one undo() puts the page back.
  function track() {
    var nodes = [];
    var classes = [];
    var attrs = [];
    var props = [];
    var undos = [];
    return {
      node: function (n, parent, before) { (parent || document.body).insertBefore(n, before || null); nodes.push(n); return n; },
      cls: function (target, name) { if (!target.classList.contains(name)) { target.classList.add(name); classes.push([target, name]); } },
      attr: function (target, key, value) { attrs.push([target, key, target.hasAttribute(key) ? target.getAttribute(key) : null]); target.setAttribute(key, value); },
      prop: function (target, key, value) { props.push([target, key, target.style.getPropertyValue(key)]); target.style.setProperty(key, value); },
      on: function (target, type, fn, opts) { target.addEventListener(type, fn, opts); undos.push(function () { target.removeEventListener(type, fn, opts); }); },
      observer: function (o) { undos.push(function () { o.disconnect(); }); return o; },
      undo: function () {
        undos.reverse().forEach(function (f) { f(); });
        props.reverse().forEach(function (p) { if (p[2]) p[0].style.setProperty(p[1], p[2]); else p[0].style.removeProperty(p[1]); });
        attrs.reverse().forEach(function (a) { if (a[2] === null) a[0].removeAttribute(a[1]); else a[0].setAttribute(a[1], a[2]); });
        classes.reverse().forEach(function (c) { c[0].classList.remove(c[1]); });
        nodes.reverse().forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
        nodes = []; classes = []; attrs = []; props = []; undos = [];
      },
    };
  }

  function mulberry(seed) {
    var a = seed;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hexA(hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function palette() {
    var cs = getComputedStyle(root);
    function v(k, d) { return (cs.getPropertyValue(k) || '').trim() || d; }
    return { a: v('--px-a', '#8f84ff'), b: v('--px-b', '#36e0c4'), c: v('--px-c', '#b69cff'), ink: v('--px-ink', '#e8eaff'), dark: v('--px-dark', '1') === '1' };
  }

  function glow(ctx, x, y, r, hex, a) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hexA(hex, a));
    g.addColorStop(1, hexA(hex, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function makeStage(canvas) {
    var s = { ctx: canvas.getContext('2d'), w: 0, h: 0, dpr: 1 };
    s.resize = function () {
      s.dpr = Math.min(2, window.devicePixelRatio || 1);
      s.w = window.innerWidth;
      s.h = window.innerHeight;
      canvas.width = Math.round(s.w * s.dpr);
      canvas.height = Math.round(s.h * s.dpr);
      s.ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    };
    return s;
  }

  function makeLoop(step) {
    var raf = 0;
    var last = 0;
    var on = false;
    function frame(t) {
      raf = 0;
      if (!on) return;
      var dt = Math.min(40, last ? t - last : 16);
      last = t;
      step(dt, t);
      raf = requestAnimationFrame(frame);
    }
    return {
      start: function () { if (on) return; on = true; last = 0; raf = requestAnimationFrame(frame); },
      stop: function () { on = false; if (raf) cancelAnimationFrame(raf); raf = 0; },
      running: function () { return on; },
    };
  }

  /* Cosmos: three star layers that drift with scroll, a nebula, orbit rings with small planets, an occasional shooting star. */
  function cosmosEngine(canvas, list) {
    var st = makeStage(canvas);
    var ctx = st.ctx;
    var pal = palette();
    var rnd = mulberry(5);
    var time = 0;
    var shoot = null;
    var nextShoot = 6000;
    var queued = false;
    var layers = [[130, 0.03, 0.5, 1.0], [70, 0.08, 0.8, 1.6], [26, 0.16, 1.2, 2.3]].map(function (L) {
      var stars = [];
      for (var i = 0; i < L[0]; i++) stars.push({ x: rnd(), y: rnd(), s: L[2] + rnd() * (L[3] - L[2]), p: rnd() * 6.28, f: 0.6 + rnd() * 1.4, c: rnd() < 0.3 ? 1 : 0 });
      return { sp: L[1], stars: stars };
    });
    var RINGS = [0.16, 0.26, 0.38, 0.52];

    st.resize();

    function draw() {
      var w = st.w;
      var h = st.h;
      var sy = window.scrollY || 0;
      var live = loop.running();
      ctx.clearRect(0, 0, w, h);
      glow(ctx, w * 0.78 + (live ? Math.sin(time / 9000) * 30 : 0), h * 0.3, Math.max(w, h) * 0.55, pal.b, pal.dark ? 0.16 : 0.18);
      glow(ctx, w * 0.12, h * 0.9, Math.max(w, h) * 0.5, pal.c, pal.dark ? 0.12 : 0.12);

      var cx = w * 0.8;
      var cy = h * 0.55;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.18);
      RINGS.forEach(function (r, i) {
        var rx = w * r;
        var ry = rx * 0.42;
        ctx.strokeStyle = hexA(pal.ink, pal.dark ? 0.12 : 0.18);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, 6.2832); ctx.stroke();
        var ang = (live ? time / (26000 * (i + 1)) : 0) + i * 1.7;
        ctx.fillStyle = i % 2 ? pal.b : pal.a;
        ctx.beginPath(); ctx.arc(Math.cos(ang) * rx, Math.sin(ang) * ry, 2.6 + (i % 2), 0, 6.2832); ctx.fill();
      });
      ctx.restore();
      glow(ctx, cx, cy, 130, pal.a, pal.dark ? 0.35 : 0.3);
      ctx.fillStyle = pal.a;
      ctx.beginPath(); ctx.arc(cx, cy, 6, 0, 6.2832); ctx.fill();

      layers.forEach(function (L) {
        L.stars.forEach(function (s) {
          var y = (((s.y * h - sy * L.sp) % h) + h) % h;
          var tw = live ? 0.65 + 0.35 * Math.sin(time / 700 * s.f + s.p) : 0.85;
          ctx.globalAlpha = (pal.dark ? 0.9 : 0.5) * tw;
          ctx.fillStyle = s.c ? pal.b : pal.ink;
          ctx.beginPath(); ctx.arc(s.x * w, y, s.s * (pal.dark ? 1 : 0.8), 0, 6.2832); ctx.fill();
        });
      });
      ctx.globalAlpha = 1;

      if (shoot) {
        var p = (time - shoot.t) / 900;
        if (p >= 1) { shoot = null; } else {
          var x = shoot.x - p * 240;
          var y2 = shoot.y + p * 120;
          var g = ctx.createLinearGradient(x, y2, x + 90, y2 - 45);
          g.addColorStop(0, hexA(pal.ink, (1 - p) * 0.9));
          g.addColorStop(1, hexA(pal.ink, 0));
          ctx.strokeStyle = g;
          ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(x, y2); ctx.lineTo(x + 90, y2 - 45); ctx.stroke();
        }
      }
    }

    var loop = makeLoop(function (dt, t) {
      time = t;
      if (!shoot && t > nextShoot) { shoot = { x: st.w * (0.45 + rnd() * 0.55), y: st.h * rnd() * 0.4, t: t }; nextShoot = t + 8000 + rnd() * 7000; }
      draw();
    });

    function once() { draw(); }
    function onScroll() {
      if (loop.running() || queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; once(); });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    once();

    return {
      start: function () { if (motion()) loop.start(); else once(); },
      setMotion: function (on) { if (on) loop.start(); else { loop.stop(); once(); } },
      setActive: function () {},
      resize: function () { st.resize(); if (!loop.running()) once(); },
      recolor: function () { pal = palette(); if (!loop.running()) once(); },
      destroy: function () { loop.stop(); window.removeEventListener('scroll', onScroll); },
    };
  }

  function teardown() {
    if (!state) { current = null; return; }
    state.engine.destroy();
    window.removeEventListener('resize', state.onResize);
    state.io.disconnect();
    state.nodes.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    root.removeAttribute('data-px-paused');
    paused = false;
    state = null;
    current = null;
  }

  function build(name) {
    var ed = EDITIONS[name];
    current = name;
    var list = chapters();
    var canvas = null;
    var nodes = [];
    if (ed.canvas !== false) {
      canvas = el('canvas', 'px-canvas');
      canvas.setAttribute('aria-hidden', 'true');
      document.body.insertBefore(canvas, document.body.firstChild);
      nodes.push(canvas);
    }

    var engine = ed.engine(canvas, list);

    var hud = el('div', 'px-hud');
    hud.setAttribute('role', 'group');
    hud.setAttribute('aria-label', ed.label + ' controls');
    var focus = el('p', 'px-hud__focus');
    focus.setAttribute('aria-hidden', 'true');
    var focusName = el('b', '', 'Home');
    focus.appendChild(document.createTextNode(ed.word || 'section '));
    focus.appendChild(focusName);
    hud.appendChild(focus);
    if (!reduceMq.matches && (engine.setMotion || ed.pausable)) {
      var pause = el('button', 'px-btn', 'Pause motion');
      pause.type = 'button';
      pause.title = 'Pause motion';
      pause.setAttribute('aria-pressed', 'false');
      pause.addEventListener('click', function () {
        paused = !paused;
        pause.setAttribute('aria-pressed', String(paused));
        pause.textContent = paused ? 'Resume motion' : 'Pause motion';
        pause.title = pause.textContent;
        if (engine.setMotion) engine.setMotion(motion());
        // Editions that animate with CSS are paused by this attribute (see editions-plus2.css).
        if (paused) root.setAttribute('data-px-paused', '1'); else root.removeAttribute('data-px-paused');
      });
      hud.appendChild(pause);
    }
    var leaveBtn = el('button', 'px-btn', 'Leave the Edition');
    leaveBtn.type = 'button';
    leaveBtn.title = 'Leave the Edition';
    leaveBtn.addEventListener('click', leave);
    hud.appendChild(leaveBtn);
    document.body.appendChild(hud);
    nodes.push(hud);

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        engine.setActive(e.target.id);
        focusName.textContent = e.target.getAttribute('data-section') || e.target.id;
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    list.forEach(function (s) { io.observe(s); });

    var rafId = 0;
    function onResize() {
      if (rafId) return;
      rafId = requestAnimationFrame(function () {
        rafId = 0;
        engine.resize();
      });
    }
    window.addEventListener('resize', onResize);

    state = { engine: engine, io: io, nodes: nodes, onResize: onResize };
    engine.start();

    try {
      if (!sessionStorage.getItem(ed.xp) && typeof award === 'function') { sessionStorage.setItem(ed.xp, '1'); award(25, ed.label); }
    } catch (e) {}
    var note = document.getElementById('styleNote');
    if (note) note.textContent = ed.note;
  }

  function sync() {
    var name = root.getAttribute('data-style');
    if (!EDITIONS[name] && LAZY[name] && !tried[name]) { ensure(name, sync); return; }
    var want = EDITIONS[name] ? name : null;
    if (want !== current) {
      teardown();
      if (want) build(want);
    } else if (state && state.engine.recolor) {
      state.engine.recolor();
    }
  }

  function enter(name) {
    if ((!EDITIONS[name] && !LAZY[name]) || root.getAttribute('data-style') === name) return;
    ensure(name, function () {
      var go = function () { root.setAttribute('data-style', name); syncPicker(); };
      if (typeof swarmRebuild === 'function') swarmRebuild({ quiet: true, onHalf: go }); else go();
    });
  }

  function leave() {
    root.removeAttribute('data-style');
    // Where the Style lab is live this also resets its note; elsewhere there is no handler and the click does nothing.
    var swiss = document.querySelector('.style-picker [data-style="swiss"]');
    if (swiss) swiss.click();
    syncPicker();
    window.scrollTo(0, 0);
  }

  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-style', 'data-theme'] });
  var onScheme = function () { if (state && state.engine.recolor) state.engine.recolor(); };
  if (darkMq.addEventListener) darkMq.addEventListener('change', onScheme);
  if (reduceMq.addEventListener) reduceMq.addEventListener('change', function () { if (state && state.engine.setMotion) state.engine.setMotion(motion()); });

  window.PlusEditions = {
    enter: enter,
    leave: leave,
    active: function () { return current; },
    register: function (name, def) { EDITIONS[name] = def; },
    util: { el: el, sv: sv, chapters: chapters, motion: motion, reduce: reduceMq, mulberry: mulberry, hexA: hexA, palette: palette, glow: glow, makeStage: makeStage, makeLoop: makeLoop, track: track },
  };

  // Editions register when their script has loaded (on first use), so the URL entry waits for it.
  function fromUrl() {
    var q = location.search.match(/[?&]style=([a-z]+-plus)/);
    if (q && (EDITIONS[q[1]] || LAZY[q[1]])) ensure(q[1], function () { root.setAttribute('data-style', q[1]); sync(); });
    else sync();
  }
  // Deferred scripts run while readyState is still 'interactive'; DOMContentLoaded fires after all of them.
  if (document.readyState === 'complete') fromUrl(); else document.addEventListener('DOMContentLoaded', fromUrl);
})();
