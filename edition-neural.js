/* Neural Edition: "Console", an AI lab's site (the + beside Neural in the Style lab). Lazy-loaded by editions-plus.js on first entry; styles: edition-neural.css.
   The hero becomes a prompt box that types the pitch from the hero text already on the page, a fixed rail lists the chapters as network layers with
   activation bars driven by scroll, the canvas behind draws the chapters as a layered graph (the active layer lit, an edge pulsing towards the next),
   projects become model cards with a metadata table read from each project's own meta line, skills become an embedding map (a plain list is one
   toggle away) and contact becomes an API request and response. Every word comes from text already on the page. All additions are recorded by
   PlusEditions.util.track(), so leaving removes them. Motion stops under prefers-reduced-motion, on phones or with Pause motion.
   Classic script. Prefix rule: new classes and attributes start with nn-. Styles are set through classes and CSSOM only (the CSP blocks style attributes). */
(function () {
  var P = window.PlusEditions;
  if (!P) return;
  var U = P.util;
  var el = U.el;
  var sv = U.sv;
  var mulberry = U.mulberry;
  var hexA = U.hexA;
  var palette = U.palette;
  var glow = U.glow;
  var makeStage = U.makeStage;
  var makeLoop = U.makeLoop;
  var phoneMq = window.matchMedia('(max-width: 720px)');
  var coarseMq = window.matchMedia('(pointer: coarse)');

  function txt(n) { return n ? (n.textContent || '').replace(/\s+/g, ' ').trim() : ''; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function calm() { return !U.motion() || phoneMq.matches; }

  // What each chapter's satellite nodes are, read from the page: [selector, label source, sized by data-level]
  var SAT = {
    home: ['.hero__actions .btn'],
    about: ['.facts > div'],
    experience: ['.job h3'],
    projects: ['.project__name'],
    skills: ['.skill-list li', 1],
    education: ['.edu__item h3'],
    contact: ['.contact__links li'],
  };

  /* ---------- The graph behind the page: one hub per chapter in a column, satellites from the page's own items ---------- */
  function graph(canvas, list) {
    var st = makeStage(canvas);
    var ctx = st.ctx;
    var pal = palette();
    var rnd = mulberry(11);
    var nodes = [];
    var edges = [];
    var hubs = [];
    var hubAt = {};
    var mouse = { x: -9999, y: -9999 };
    var active = list[0] ? list[0].id : 'home';
    var time = 0;
    var acc = 0;
    var want = false;
    var groups = [].slice.call(document.querySelectorAll('#skills .skills__group'));

    st.resize();
    list.forEach(function (s, i) {
      var hub = { id: s.id, hub: true, r: 7, rr: 7, x: 0, y: 0, vx: 0, vy: 0, a: 1, g: 0, ax: 0, ay: 0 };
      hubs.push(hub);
      nodes.push(hub);
      hubAt[s.id] = i;
      if (i) edges.push({ a: hubs[i - 1], b: hub, len: 150, k: 0.0006, chain: true });
    });
    anchors();
    hubs.forEach(function (hub) { hub.x = hub.ax; hub.y = hub.ay; });
    list.forEach(function (s, i) {
      var def = SAT[s.id];
      if (!def) return;
      [].forEach.call(s.querySelectorAll(def[0]), function (it) {
        var lvl = def[1] ? parseInt(it.getAttribute('data-level'), 10) || 2 : 0;
        var r = def[1] ? 1.6 + lvl * 0.8 : 2.8;
        var grp = it.closest('.skills__group');
        var hub = hubs[i];
        var c = { id: '', ch: s.id, hub: false, label: txt(it), r: r, rr: r, x: hub.x + (rnd() - 0.5) * 120, y: hub.y + (rnd() - 0.5) * 120, vx: 0, vy: 0, a: 1, g: grp ? groups.indexOf(grp) : i };
        nodes.push(c);
        edges.push({ a: hub, b: c, len: def[1] ? 70 : 62, k: 0.02 });
      });
    });

    function anchors() {
      var n = hubs.length;
      hubs.forEach(function (hub, i) {
        hub.ax = st.w * (0.07 + 0.86 * (n > 1 ? i / (n - 1) : 0.5));
        hub.ay = st.h * (0.5 + 0.2 * Math.sin(i * 1.9 + 0.6));
      });
    }

    function target(n) { return n.hub ? (n.id === active ? 1 : 0.55) : (n.ch === active ? 1 : 0.2); }

    function tick(dt) {
      var k = dt / 16;
      var w = st.w;
      var h = st.h;
      var i;
      var j;
      for (i = 0; i < nodes.length; i++) {
        var a = nodes[i];
        for (j = i + 1; j < nodes.length; j++) {
          var b = nodes[j];
          var dx = a.x - b.x;
          var dy = a.y - b.y;
          var d2 = dx * dx + dy * dy;
          if (d2 > 50000) continue;
          if (d2 < 36) d2 = 36;
          var d = Math.sqrt(d2);
          var f = ((a.hub || b.hub) ? 2400 : 420) / d2 * k;
          a.vx += (dx / d) * f; a.vy += (dy / d) * f;
          b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
        }
      }
      edges.forEach(function (e) {
        var dx = e.b.x - e.a.x;
        var dy = e.b.y - e.a.y;
        var d = Math.sqrt(dx * dx + dy * dy) || 1;
        var len = e.chain ? e.len : e.len * (e.a.id === active ? 1.45 : 1);
        var f = (d - len) * e.k * k;
        e.a.vx += (dx / d) * f; e.a.vy += (dy / d) * f;
        e.b.vx -= (dx / d) * f; e.b.vy -= (dy / d) * f;
      });
      nodes.forEach(function (n) {
        if (n.hub) {
          // The lit layer drifts out to the free side of the page; the others hold their column.
          var lit = n.id === active;
          var tx = lit ? w * (w > 720 ? 0.8 : 0.9) : n.ax;
          var ty = lit ? h * (w > 720 ? 0.42 : 0.55) : n.ay;
          n.vx += (tx - n.x) * (lit ? 0.01 : 0.004) * k; n.vy += (ty - n.y) * (lit ? 0.01 : 0.004) * k;
        }
        var mx = mouse.x - n.x;
        var my = mouse.y - n.y;
        var md = Math.sqrt(mx * mx + my * my);
        if (md < 200 && md > 1) {
          var pull = 0.05 * (1 - md / 200) * k;
          n.vx += (mx / md) * pull; n.vy += (my / md) * pull;
        }
        if (n.x < 30) n.vx += 0.05 * k; if (n.x > w - 30) n.vx -= 0.05 * k;
        if (n.y < 30) n.vy += 0.05 * k; if (n.y > h - 30) n.vy -= 0.05 * k;
        var damp = Math.pow(0.9, k);
        n.vx *= damp; n.vy *= damp;
        n.x += n.vx * k; n.y += n.vy * k;
        n.rr += ((n.hub && n.id === active ? n.r * 1.9 : n.r) - n.rr) * 0.08 * Math.min(k, 3);
        n.a += (target(n) - n.a) * 0.08 * Math.min(k, 3);
      });
    }

    function line(e, alpha, width) {
      ctx.strokeStyle = hexA(pal.a, alpha);
      ctx.lineWidth = width;
      ctx.beginPath(); ctx.moveTo(e.a.x, e.a.y); ctx.lineTo(e.b.x, e.b.y); ctx.stroke();
    }

    function dot(ax, ay, bx, by, p, r, hex) {
      ctx.fillStyle = hex;
      ctx.beginPath(); ctx.arc(ax + (bx - ax) * p, ay + (by - ay) * p, r, 0, 6.2832); ctx.fill();
    }

    function draw() {
      var live = loop.running();
      var ai = hubAt[active] || 0;
      var next = hubs[ai + 1];
      var base = pal.dark ? 0.2 : 0.3;
      ctx.clearRect(0, 0, st.w, st.h);
      ctx.globalAlpha = st.w > 720 ? 1 : 0.42; // text covers the whole phone screen, so the graph is dimmer there
      edges.forEach(function (e, idx) {
        var cur;
        if (e.chain) {
          if (e.a.id === active) { line(e, 0.75, 1.8); if (live) for (var q = 0; q < 3; q++) dot(e.a.x, e.a.y, e.b.x, e.b.y, ((time / 2200) + q / 3) % 1, 2.8, pal.b); else dot(e.a.x, e.a.y, e.b.x, e.b.y, 0.5, 2.8, pal.b); }
          else line(e, e.b.id === active ? 0.45 : base * 0.5, 1);
          return;
        }
        cur = e.a.id === active;
        line(e, (cur ? 0.5 : base * 0.45) * (0.4 + 0.6 * e.b.a), cur ? 1.3 : 1);
        if (cur) {
          if (live) dot(e.a.x, e.a.y, e.b.x, e.b.y, ((time / 2600) + idx * 0.31) % 1, 1.8, pal.b);
          if (next) {
            ctx.strokeStyle = hexA(pal.b, 0.16);
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(e.b.x, e.b.y); ctx.lineTo(next.x, next.y); ctx.stroke();
            if (live) dot(e.b.x, e.b.y, next.x, next.y, ((time / 3000) + idx * 0.17) % 1, 1.5, pal.a);
          }
        }
      });
      nodes.forEach(function (n) {
        var on = n.hub ? n.id === active : n.ch === active;
        if (n.hub) {
          if (st.w > 720) glow(ctx, n.x, n.y, n.rr * 5, on ? pal.b : pal.a, (on ? 0.4 : 0.14) * n.a);
          ctx.fillStyle = hexA(on ? pal.b : pal.a, 0.35 + 0.65 * n.a);
          ctx.beginPath(); ctx.arc(n.x, n.y, n.rr, 0, 6.2832); ctx.fill();
          if (on) {
            ctx.strokeStyle = hexA(pal.b, 0.6);
            ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.arc(n.x, n.y, n.rr + 5 + (live ? Math.sin(time / 400) * 2 : 0), 0, 6.2832); ctx.stroke();
          }
        } else {
          ctx.fillStyle = hexA([pal.b, pal.a, pal.c][n.g % 3], 0.85 * n.a);
          ctx.beginPath(); ctx.arc(n.x, n.y, n.rr, 0, 6.2832); ctx.fill();
        }
        if (Math.hypot(mouse.x - n.x, mouse.y - n.y) < 60 && (n.label || n.hub)) {
          ctx.font = '11px ui-monospace, Consolas, monospace';
          ctx.fillStyle = hexA(pal.ink, 0.95);
          ctx.fillText((n.label || n.id).toLowerCase(), n.x + n.rr + 6, n.y + 4);
        }
      });
      ctx.globalAlpha = 1;
    }

    var loop = makeLoop(function (dt, t) {
      if (coarseMq.matches) { acc += dt; if (acc < 32) return; dt = acc; acc = 0; } // 30 frames a second at most on touch screens
      time = t;
      tick(dt);
      draw();
    });

    function settle(n) { for (var i = 0; i < n; i++) tick(16); }
    function still() {
      settle(260);
      nodes.forEach(function (n) { n.a = target(n); });
      draw();
    }
    function onMove(e) { mouse.x = e.clientX; mouse.y = e.clientY; if (!loop.running()) draw(); }
    function onLeave() { mouse.x = -9999; mouse.y = -9999; if (!loop.running()) draw(); }

    settle(300);
    nodes.forEach(function (n) { n.a = target(n); n.rr = n.hub && n.id === active ? n.r * 1.9 : n.r; });
    draw();

    return {
      onMove: onMove,
      onLeave: onLeave,
      run: function (on) {
        want = on;
        if (on && !document.hidden) loop.start(); else { loop.stop(); still(); }
      },
      hidden: function () { if (document.hidden) loop.stop(); else if (want) loop.start(); },
      setActive: function (id) { active = id; if (!loop.running()) still(); },
      resize: function () {
        var ow = st.w || 1;
        var oh = st.h || 1;
        st.resize();
        nodes.forEach(function (n) { n.x *= st.w / ow; n.y *= st.h / oh; });
        anchors();
        if (!loop.running()) still();
      },
      recolor: function () { pal = palette(); if (!loop.running()) draw(); },
      stop: function () { loop.stop(); },
    };
  }

  /* ---------- The embedding map: a 2D scatter, positions fixed by a seeded generator and clustered by skill group ---------- */
  function skillsMap(sec, T) {
    var list = sec.querySelector('.skills');
    var groups = [].slice.call(sec.querySelectorAll('.skills__group'));
    if (!list || !groups.length) return null;
    var data = groups.map(function (g) {
      return { name: txt(g.querySelector('h3')), items: [].map.call(g.querySelectorAll('.skill-list li'), function (li) { return { name: txt(li), lvl: parseInt(li.getAttribute('data-level'), 10) || 1 }; }) };
    });
    var box = el('div', 'nn-skills');
    var tools = el('div', 'nn-skills__tools');
    var toggle = el('div', 'nn-view');
    toggle.setAttribute('role', 'group');
    toggle.setAttribute('aria-label', 'Show skills as');
    var bMap = el('button', '', 'Map');
    var bList = el('button', '', 'List');
    bMap.type = bList.type = 'button';
    toggle.appendChild(bMap);
    toggle.appendChild(bList);
    tools.appendChild(toggle);
    tools.appendChild(el('p', 'nn-skills__axes', 'embedding · 2 dimensions · ' + data.reduce(function (n, g) { return n + g.items.length; }, 0) + ' points'));
    box.appendChild(tools);
    var fig = el('figure', 'nn-map');
    var svg = sv('svg', { 'class': 'nn-map__svg', role: 'group', 'aria-label': 'Skills embedding map. Use the arrow keys to move between points.' });
    fig.appendChild(svg);
    fig.appendChild(el('figcaption', 'nn-map__cap', 'Positions are illustrative, not measured: grouped by skill group, sized by my self-assessed level (1 to 5). Hover or focus a point for its name, or switch to the list.'));
    box.appendChild(fig);
    T.node(box, list.parentNode, list);

    var pts = [];
    var labels = [];
    var cur = 0;

    function plot(narrow) {
      var W = narrow ? 340 : 880;
      var H = narrow ? 580 : 430;
      var rnd = mulberry(29);
      var placed = [];
      pts = []; labels = [];
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      var i;
      for (i = 1; i < (narrow ? 4 : 11); i++) {
        svg.appendChild(sv('line', { 'class': 'nn-grid', x1: 0, y1: H * i / (narrow ? 4 : 11), x2: W, y2: H * i / (narrow ? 4 : 11) }));
      }
      for (i = 1; i < (narrow ? 4 : 11); i++) {
        svg.appendChild(sv('line', { 'class': 'nn-grid', x1: W * i / (narrow ? 4 : 11), y1: 0, x2: W * i / (narrow ? 4 : 11), y2: H }));
      }
      var N = data.length;
      var order = [];
      var lay = svg.appendChild(sv('g', { 'aria-hidden': 'true' }));
      var pg = svg.appendChild(sv('g'));
      var lg = svg.appendChild(sv('g', { 'aria-hidden': 'true' }));
      data.forEach(function (g, gi) {
        var cx;
        var cy;
        var R;
        if (narrow) { cx = W * (gi % 2 ? 0.62 : 0.38); cy = H * (0.17 + 0.33 * gi); R = 68; }
        else { var ang = -Math.PI / 2 + gi * 2 * Math.PI / N; cx = W / 2 + Math.cos(ang) * W * 0.28; cy = H / 2 + Math.sin(ang) * H * 0.2; R = 96; }
        lay.appendChild(sv('circle', { 'class': 'nn-halo nn-g' + (gi % 3), cx: cx, cy: cy, r: R + 14 }));
        var t = sv('text', { 'class': 'nn-cname nn-g' + (gi % 3), x: cx, y: Math.max(16, cy - R - 20), 'text-anchor': 'middle' });
        t.textContent = g.name;
        lay.appendChild(t);
        var mine = [];
        g.items.map(function (it, ii) { return { it: it, ii: ii }; }).sort(function (a, b) { return b.it.lvl - a.it.lvl; }).forEach(function (o) {
          var r = 4.5 + o.it.lvl * 2.2;
          var x = cx;
          var y = cy;
          for (var tries = 0; tries < 90; tries++) {
            var an = rnd() * 6.2832;
            var d = Math.sqrt(rnd()) * R;
            var px = cx + Math.cos(an) * d;
            var py = cy + Math.sin(an) * d * (narrow ? 0.9 : 0.8);
            if (px - r < 6 || px + r > W - 6 || py - r < 26 || py + r > H - 6) continue;
            if (placed.every(function (p) { return Math.hypot(p.x - px, p.y - py) > p.r + r + 9; })) { x = px; y = py; break; }
          }
          var p = { x: x, y: y, r: r, gi: gi, name: o.it.name, lvl: o.it.lvl, group: g.name, ord: 0 };
          placed.push(p);
          mine.push(p);
          order.push({ p: p, k: gi * 100 + o.ii });
        });
        mine.forEach(function (p, k) {
          var near = null;
          for (var m = 0; m < k; m++) if (!near || Math.hypot(mine[m].x - p.x, mine[m].y - p.y) < Math.hypot(near.x - p.x, near.y - p.y)) near = mine[m];
          if (near) lay.appendChild(sv('line', { 'class': 'nn-edge nn-g' + (gi % 3), x1: near.x, y1: near.y, x2: p.x, y2: p.y }));
        });
      });
      order.sort(function (a, b) { return a.k - b.k; });
      order.forEach(function (o, k) {
        var p = o.p;
        var g = sv('g', { 'class': 'nn-pt nn-g' + (p.gi % 3), tabindex: k === cur ? '0' : '-1', role: 'img', 'aria-label': p.name + ', ' + p.group + ', level ' + p.lvl + ' of 5', 'data-k': k });
        g.appendChild(sv('circle', { 'class': 'nn-pt__ring', cx: p.x, cy: p.y, r: p.r + 6 }));
        g.appendChild(sv('circle', { 'class': 'nn-pt__dot', cx: p.x, cy: p.y, r: p.r }));
        pg.appendChild(g);
        var lx = Math.min(W - 70, Math.max(70, p.x));
        var ly = p.y - p.r - 10 < 14 ? p.y + p.r + 16 : p.y - p.r - 10;
        var l = sv('text', { 'class': 'nn-lbl', x: lx, y: ly, 'text-anchor': 'middle' });
        l.textContent = p.name + ' · ' + p.lvl + '/5';
        lg.appendChild(l);
        pts.push(g);
        labels.push(l);
      });
    }

    function show(k, on) { if (labels[k]) labels[k].classList.toggle('nn-show', on); if (pts[k]) pts[k].classList.toggle('nn-hot', on); }
    function idx(e) { var g = e.target.closest ? e.target.closest('.nn-pt') : null; return g ? parseInt(g.getAttribute('data-k'), 10) : -1; }
    svg.addEventListener('pointerover', function (e) { var k = idx(e); if (k > -1) show(k, true); });
    svg.addEventListener('pointerout', function (e) { var k = idx(e); if (k > -1 && document.activeElement !== pts[k]) show(k, false); });
    svg.addEventListener('focusin', function (e) { var k = idx(e); if (k > -1) { pts[cur].setAttribute('tabindex', '-1'); cur = k; pts[k].setAttribute('tabindex', '0'); show(k, true); } });
    svg.addEventListener('focusout', function (e) { var k = idx(e); if (k > -1) show(k, false); });
    svg.addEventListener('keydown', function (e) {
      var step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      var to = e.key === 'Home' ? 0 : e.key === 'End' ? pts.length - 1 : step ? Math.max(0, Math.min(pts.length - 1, cur + step)) : -1;
      if (to < 0) return;
      e.preventDefault();
      pts[to].focus();
    });

    function view(v) {
      sec.setAttribute('data-nn-view', v);
      bMap.setAttribute('aria-pressed', String(v === 'map'));
      bList.setAttribute('aria-pressed', String(v === 'list'));
    }
    bMap.addEventListener('click', function () { view('map'); });
    bList.addEventListener('click', function () { view('list'); });
    T.attr(sec, 'data-nn-view', 'map');
    view(phoneMq.matches ? 'list' : 'map');
    var narrowNow = phoneMq.matches;
    plot(narrowNow);
    return { rebuild: function () { if (phoneMq.matches !== narrowNow) { narrowNow = phoneMq.matches; cur = 0; plot(narrowNow); view(narrowNow ? 'list' : 'map'); } } };
  }

  P.register('neural-plus', {
    label: 'Neural Edition', xp: 'kt-neural-xp', word: 'layer ', pausable: true,
    note: 'Neural Edition: a complete redesign, an AI lab’s console. The hero is a prompt that types the pitch, the chapters are network layers with scroll-driven activations, projects are model cards, skills an embedding map and contact an API call. Pause motion stops the graph.',
    engine: function (canvas, list) {
      var T = U.track();
      var timers = [];
      var hero = document.getElementById('home');
      var g = graph(canvas, list);
      var typing = null;
      var prompt = null;
      var fills = [];
      var links = [];
      var secs = list.slice();
      var map = null;
      var raf = 0;

      function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }

      /* ---------- chapters as layers: a tag in every head, and a data attribute that marks the one in view ---------- */
      secs.forEach(function (s, i) {
        T.attr(s, 'data-nn-on', i ? '0' : '1');
        var def = SAT[s.id];
        var n = def ? s.querySelectorAll(def[0]).length : 0;
        var kind = i === 0 ? 'input' : i === secs.length - 1 ? 'output' : 'hidden';
        var tag = el('p', 'nn-layer');
        tag.setAttribute('aria-hidden', 'true');
        tag.appendChild(el('b', '', 'L' + pad(i)));
        tag.appendChild(document.createTextNode(' · ' + kind + (n ? ' · ' + n + ' nodes' : '')));
        var head = s.querySelector('.section__head');
        if (head) T.node(tag, head, head.firstChild);
      });

      /* ---------- the hero: a window with a prompt that types the pitch ---------- */
      var row = hero && hero.querySelector('.hero__row');
      var role = hero && hero.querySelector('.hero__role');
      var lead = hero && hero.querySelector('.hero__lead');
      if (row && role && lead) {
        T.cls(hero, 'nn-hero');
        var bar = el('div', 'nn-bar');
        bar.setAttribute('aria-hidden', 'true');
        bar.appendChild(el('i', 'nn-bar__dots'));
        bar.appendChild(el('span', 'nn-bar__t', 'L00 · input · prompt'));
        bar.appendChild(el('span', 'nn-bar__s', 'ready'));
        T.node(bar, row, row.firstChild);
        prompt = el('div', 'nn-prompt');
        prompt.setAttribute('aria-hidden', 'true');
        var q = el('p', 'nn-prompt__q');
        var a = el('p', 'nn-prompt__a');
        [q, a].forEach(function (p) {
          p.appendChild(el('span', 'nn-prompt__ghost'));
          p.appendChild(el('span', 'nn-prompt__live'));
        });
        prompt.appendChild(q);
        prompt.appendChild(a);
        T.node(prompt, row, role);
        T.attr(hero, 'data-nn-live', '0');
        var caret = el('i', 'nn-caret');
        var ql = q.lastChild;
        var al = a.lastChild;
        var qn = ql.appendChild(document.createTextNode(''));
        var an = al.appendChild(document.createTextNode(''));
        var qg = q.firstChild.appendChild(document.createTextNode(''));
        var ag = a.firstChild.appendChild(document.createTextNode(''));
        var sync = function () {
          qg.nodeValue = txt(role);
          ag.nodeValue = txt(lead);
          qn.nodeValue = qg.nodeValue;
          an.nodeValue = ag.nodeValue;
        };
        sync();
        var mo = T.observer(new MutationObserver(function () { if (!typing.timer) sync(); }));
        mo.observe(role, { childList: true, characterData: true, subtree: true });
        mo.observe(lead, { childList: true, characterData: true, subtree: true });
        // Typing: three characters every 22 ms, the question first and then the answer; the whole text when motion is off.
        typing = {
          timer: 0,
          run: function () {
            var qt = txt(role);
            var at = txt(lead);
            var i = 0;
            var total = qt.length + at.length;
            typing.stop();
            qn.nodeValue = ''; an.nodeValue = '';
            ql.appendChild(caret);
            typing.timer = setInterval(function () {
              i = Math.min(total, i + 3);
              qn.nodeValue = qt.slice(0, Math.min(i, qt.length));
              if (i > qt.length) { if (caret.parentNode !== al) al.appendChild(caret); an.nodeValue = at.slice(0, i - qt.length); }
              if (i >= total) typing.stop(true);
            }, 22);
          },
          stop: function (keepCaret) {
            if (typing.timer) clearInterval(typing.timer);
            typing.timer = 0;
            qn.nodeValue = txt(role);
            an.nodeValue = txt(lead);
            if (keepCaret) al.appendChild(caret); else if (caret.parentNode) caret.parentNode.removeChild(caret);
          },
        };
      }

      /* ---------- the layers rail: real links, one activation bar each, driven by scroll ---------- */
      var rail = el('nav', 'nn-rail');
      rail.setAttribute('aria-label', 'Layers');
      var ol = el('ol');
      secs.forEach(function (s, i) {
        var li = el('li');
        var aEl = el('a');
        aEl.href = '#' + s.id;
        var n = el('span', 'nn-rail__n', 'L' + pad(i));
        n.setAttribute('aria-hidden', 'true');
        aEl.appendChild(n);
        aEl.appendChild(el('span', 'nn-rail__t', s.getAttribute('data-section') || s.id));
        var bar2 = el('i', 'nn-rail__bar');
        bar2.setAttribute('aria-hidden', 'true');
        var fill = el('b');
        bar2.appendChild(fill);
        aEl.appendChild(bar2);
        li.appendChild(aEl);
        ol.appendChild(li);
        fills.push(fill);
        links.push(aEl);
      });
      rail.appendChild(ol);
      T.node(rail);

      function activate() {
        raf = 0;
        var vh = window.innerHeight;
        var mid = vh / 2;
        secs.forEach(function (s, i) {
          var r = s.getBoundingClientRect();
          var dist = mid < r.top ? r.top - mid : mid > r.bottom ? mid - r.bottom : 0;
          var v = Math.max(0, 1 - dist / (vh * 0.6));
          fills[i].style.setProperty('--nn-a', (v * v * (3 - 2 * v)).toFixed(3));
        });
      }
      function queue() { if (!raf) raf = requestAnimationFrame(activate); }
      T.on(window, 'scroll', queue, { passive: true });
      T.on(window, 'resize', queue);
      activate();

      /* ---------- experience: a node on the trunk per role; a role still running ("Present") has a live node ---------- */
      [].forEach.call(document.querySelectorAll('#experience .job'), function (job) {
        if (/present/i.test(txt(job.querySelector('.job__date')))) T.cls(job, 'nn-now');
      });

      /* ---------- projects: a model card with type, year and status taken from each project's own meta line ---------- */
      [].forEach.call(document.querySelectorAll('#projects .project'), function (pr) {
        var sum = pr.querySelector('summary');
        var meta = txt(pr.querySelector('.project__meta'));
        if (!sum || !meta) return;
        var parts = meta.split(/\s*·\s*/);
        var rows = [['type', parts[0]], ['year', parts[1]], ['status', parts.slice(2).join(' · ')]].filter(function (r) { return r[1]; });
        var t = el('span', 'nn-meta');
        t.setAttribute('aria-hidden', 'true');
        rows.forEach(function (r) {
          var rowEl = el('span', 'nn-meta__row');
          rowEl.appendChild(el('span', 'nn-meta__k', r[0]));
          rowEl.appendChild(el('span', 'nn-meta__v' + (r[0] === 'status' && /progress/i.test(r[1]) ? ' nn-meta__v--live' : ''), r[1]));
          t.appendChild(rowEl);
        });
        T.node(t, sum);
      });

      /* ---------- skills: the embedding map and the toggle ---------- */
      var skills = document.getElementById('skills');
      if (skills) map = skillsMap(skills, T);

      /* ---------- contact: the real links are the response; a request line sits above them ---------- */
      var links2 = document.querySelector('#contact .contact__links');
      if (links2) {
        var req = el('div', 'nn-req');
        req.setAttribute('aria-hidden', 'true');
        req.appendChild(el('span', 'nn-req__verb', 'GET'));
        req.appendChild(el('span', 'nn-req__path', '/contact'));
        req.appendChild(el('span', 'nn-req__h', 'accept: application/json'));
        req.appendChild(el('span', 'nn-req__ok', '200 OK'));
        T.node(req, links2.parentNode, links2);
      }

      /* ---------- motion: the graph and the typing run only when motion is on and the screen is not a phone ---------- */
      function motionNow() {
        var live = !calm();
        if (hero && prompt) hero.setAttribute('data-nn-live', live ? '1' : '0');
        if (live) g.run(true); else { g.run(false); if (typing) typing.stop(); }
      }
      T.on(phoneMq, 'change', function () { motionNow(); if (map) map.rebuild(); });
      T.on(document, 'visibilitychange', function () { g.hidden(); });
      T.on(window, 'pointermove', g.onMove, { passive: true });
      T.on(document, 'pointerleave', g.onLeave);

      return {
        start: function () {
          motionNow();
          if (typing && !calm()) later(function () { if (!calm()) typing.run(); }, 650);
        },
        setMotion: function () { motionNow(); },
        setActive: function (id) {
          g.setActive(id);
          secs.forEach(function (s, i) {
            var on = s.id === id;
            s.setAttribute('data-nn-on', on ? '1' : '0');
            if (on) links[i].setAttribute('aria-current', 'location'); else links[i].removeAttribute('aria-current');
          });
        },
        resize: function () { g.resize(); queue(); },
        recolor: function () { g.recolor(); },
        destroy: function () {
          g.stop();
          if (typing) { if (typing.timer) clearInterval(typing.timer); }
          timers.forEach(clearTimeout);
          if (raf) cancelAnimationFrame(raf);
          T.undo();
        },
      };
    },
  });
})();
