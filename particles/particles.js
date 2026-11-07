(function () {
  var wrap = document.getElementById('wrap'), cv = document.getElementById('cv'), ctx = cv.getContext('2d');
  var hire = document.getElementById('hire'), pauseBtn = document.getElementById('pause');
  var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  var W = 0, H = 0, cur = null, raf = 0, last = 0, paused = false, t = 0;
  var mouse = { x: -999, y: -999, in: false };
  var pal = {};

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function readPal() {
    var cs = getComputedStyle(wrap);
    pal = { bg: cs.getPropertyValue('--s-bg').trim(), a: cs.getPropertyValue('--s-a').trim(), b: cs.getPropertyValue('--s-b').trim(), ink: cs.getPropertyValue('--s-ink').trim() };
  }
  function alpha(c, a) { ctx.globalAlpha = Math.max(0, Math.min(1, a)); ctx.fillStyle = c; ctx.strokeStyle = c; }
  function dot(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill(); }
  function motion() { return !mq.matches && !paused; }

  /* ---------- Neural: nodes, links, pulses along links, click bursts ---------- */
  var neural = {
    hint: 'Click to burst', name: 'Neural: bursts and flowing signals',
    desc: 'Nodes drift and link up when close. Small signals travel along the links, the cursor tugs nearby nodes, and a click sends a ring of sparks outwards.',
    init: function () {
      this.n = []; this.p = []; this.s = [];
      var c = Math.round(Math.min(34, W / 24));
      for (var i = 0; i < c; i++) this.n.push({ x: rnd(0, W), y: rnd(0, H), vx: rnd(-.15, .15), vy: rnd(-.15, .15), r: rnd(1.8, 3.6) });
    },
    step: function (dt) {
      var k = dt / 16, self = this;
      this.n.forEach(function (n) {
        var dx = mouse.x - n.x, dy = mouse.y - n.y, d = Math.hypot(dx, dy);
        if (mouse.in && d < 140 && d > 1) { n.vx += dx / d * .012 * k; n.vy += dy / d * .012 * k; }
        n.vx *= .995; n.vy *= .995;
        n.x += n.vx * k; n.y += n.vy * k;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
      });
      if (Math.random() < .08 && this.p.length < 22) {
        var a = this.n[(Math.random() * this.n.length) | 0], b = this.n[(Math.random() * this.n.length) | 0];
        if (a !== b && Math.hypot(a.x - b.x, a.y - b.y) < 150) this.p.push({ a: a, b: b, t: 0 });
      }
      this.p.forEach(function (p) { p.t += dt / 700; });
      this.p = this.p.filter(function (p) { return p.t < 1; });
      this.s.forEach(function (s) { s.x += s.vx * k; s.y += s.vy * k; s.vx *= .97; s.vy *= .97; s.life -= dt / 900; });
      this.s = this.s.filter(function (s) { return s.life > 0; });
    },
    draw: function () {
      var n = this.n, i, j;
      ctx.lineWidth = 1;
      for (i = 0; i < n.length; i++) for (j = i + 1; j < n.length; j++) {
        var d = Math.hypot(n[i].x - n[j].x, n[i].y - n[j].y);
        if (d < 150) { alpha(pal.a, (1 - d / 150) * .5); ctx.beginPath(); ctx.moveTo(n[i].x, n[i].y); ctx.lineTo(n[j].x, n[j].y); ctx.stroke(); }
      }
      this.p.forEach(function (p) { alpha(pal.b, 1); dot(p.a.x + (p.b.x - p.a.x) * p.t, p.a.y + (p.b.y - p.a.y) * p.t, 2.4); });
      n.forEach(function (o) { alpha(pal.a, .9); dot(o.x, o.y, o.r); });
      this.s.forEach(function (s) { alpha(pal.b, s.life); dot(s.x, s.y, 2); });
    },
    click: function (x, y) {
      for (var i = 0; i < 26; i++) { var a = i / 26 * 6.2832, v = rnd(2, 4.2); this.s.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1 }); }
    }
  };

  /* ---------- Cosmos: stars scatter from the cursor, dust trails it ---------- */
  var cosmos = {
    hint: 'Move through the stars', name: 'Cosmos: scatter and dust trail',
    desc: 'Stars flee the cursor and spring back to their place. Moving leaves a short trail of dust, and a click sends out a shockwave that pushes every star away.',
    init: function () {
      this.s = []; this.d = [];
      var c = Math.round(Math.min(260, W * H / 1700));
      for (var i = 0; i < c; i++) { var x = rnd(0, W), y = rnd(0, H); this.s.push({ hx: x, hy: y, x: x, y: y, vx: 0, vy: 0, r: rnd(.6, 2), f: rnd(.5, 2), p: rnd(0, 6.28), c: Math.random() < .3 }); }
      this.lm = { x: -999, y: -999 };
    },
    step: function (dt) {
      var k = dt / 16;
      this.s.forEach(function (s) {
        var dx = s.x - mouse.x, dy = s.y - mouse.y, d = Math.hypot(dx, dy);
        if (mouse.in && d < 110 && d > .5) { var f = (1 - d / 110) * 2.4 * k; s.vx += dx / d * f; s.vy += dy / d * f; }
        s.vx += (s.hx - s.x) * .02 * k; s.vy += (s.hy - s.y) * .02 * k;
        s.vx *= .88; s.vy *= .88; s.x += s.vx * k; s.y += s.vy * k;
      });
      if (mouse.in && Math.hypot(mouse.x - this.lm.x, mouse.y - this.lm.y) > 6) {
        this.d.push({ x: mouse.x + rnd(-4, 4), y: mouse.y + rnd(-4, 4), vx: rnd(-.3, .3), vy: rnd(-.3, .3), life: 1 });
        this.lm.x = mouse.x; this.lm.y = mouse.y;
      }
      this.d.forEach(function (p) { p.x += p.vx * k; p.y += p.vy * k; p.life -= dt / 800; });
      this.d = this.d.filter(function (p) { return p.life > 0 && true; });
      if (this.d.length > 140) this.d.splice(0, this.d.length - 140);
    },
    draw: function () {
      var tt = t;
      this.s.forEach(function (s) { alpha(s.c ? pal.b : pal.ink, .55 + .4 * Math.sin(tt / 700 * s.f + s.p)); dot(s.x, s.y, s.r); });
      this.d.forEach(function (p) { alpha(pal.a, p.life * .8); dot(p.x, p.y, 1.6 * p.life + .4); });
    },
    click: function (x, y) {
      this.s.forEach(function (s) { var dx = s.x - x, dy = s.y - y, d = Math.hypot(dx, dy) || 1; var f = Math.max(0, 1 - d / 260) * 14; s.vx += dx / d * f; s.vy += dy / d * f; });
    }
  };

  /* ---------- Bauhaus: particles gather into a circle, square or triangle ---------- */
  var bauhaus = {
    hint: 'Click for the next shape', name: 'Bauhaus: gathering shapes',
    desc: 'Primary-colour particles drift loose, then pull together into a circle, a square and a triangle in turn. A click moves on to the next shape straight away.',
    init: function () {
      this.p = []; this.shape = 0; this.timer = 0;
      for (var i = 0; i < 180; i++) this.p.push({ x: rnd(0, W), y: rnd(0, H), vx: 0, vy: 0, tx: 0, ty: 0, c: i % 3 });
      this.assign();
    },
    pts: function (shape, n) {
      var cx = W / 2, cy = H / 2, R = Math.min(W, H) * .3, out = [], i;
      for (i = 0; i < n; i++) {
        var u = i / n;
        if (shape === 0) out.push([cx + Math.cos(u * 6.2832) * R, cy + Math.sin(u * 6.2832) * R]);
        else if (shape === 1) {
          var s = u * 4, e = Math.floor(s), f = s - e, q = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]];
          out.push([cx + (q[e][0] + (q[e + 1][0] - q[e][0]) * f) * R, cy + (q[e][1] + (q[e + 1][1] - q[e][1]) * f) * R]);
        } else {
          var v = [[0, -1.1], [1.05, .8], [-1.05, .8], [0, -1.1]], s3 = u * 3, e3 = Math.floor(s3), f3 = s3 - e3;
          out.push([cx + (v[e3][0] + (v[e3 + 1][0] - v[e3][0]) * f3) * R, cy + (v[e3][1] + (v[e3 + 1][1] - v[e3][1]) * f3) * R]);
        }
      }
      return out;
    },
    assign: function () {
      var tg = this.pts(this.shape, this.p.length);
      this.p.forEach(function (p, i) { p.tx = tg[i][0]; p.ty = tg[i][1]; });
    },
    step: function (dt) {
      var k = dt / 16;
      this.timer += dt;
      if (this.timer > 3400) { this.timer = 0; this.shape = (this.shape + 1) % 3; this.assign(); }
      this.p.forEach(function (p) {
        p.vx += (p.tx - p.x) * .012 * k; p.vy += (p.ty - p.y) * .012 * k;
        var dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
        if (mouse.in && d < 60 && d > .5) { p.vx += dx / d * .8 * k; p.vy += dy / d * .8 * k; }
        p.vx *= .9; p.vy *= .9; p.x += p.vx * k; p.y += p.vy * k;
      });
    },
    draw: function () {
      var cols = [pal.a, pal.b, pal.ink];
      this.p.forEach(function (p) { alpha(cols[p.c], .95); ctx.fillRect(p.x - 2.5, p.y - 2.5, 5, 5); });
    },
    click: function () { this.timer = 0; this.shape = (this.shape + 1) % 3; this.assign(); }
  };

  /* ---------- Brutalist: square debris off the button ---------- */
  var brutalist = {
    hint: 'Click the button', name: 'Brutalist: pixel debris',
    desc: 'The button throws hard-edged squares that fall under gravity, spin and bounce off the floor before they fade. The button stays a normal button, so the keyboard works too.',
    init: function () {
      this.d = [];
      // a few squares already resting on the floor, so the still frame (reduced motion or paused) is not empty
      this.rest = [];
      for (var i = 0; i < 18; i++) { var sz = rnd(8, 18); this.rest.push({ x: rnd(sz, W - sz), y: H - sz / 2 - 1, s: sz, rot: rnd(-.5, .5) }); }
    },
    step: function (dt) {
      var k = dt / 16;
      this.d.forEach(function (p) {
        p.vy += .35 * k; p.x += p.vx * k; p.y += p.vy * k; p.rot += p.vr * k; p.life -= dt / 1700;
        if (p.y > H - p.s) { p.y = H - p.s; p.vy *= -.5; p.vx *= .85; }
      });
      this.d = this.d.filter(function (p) { return p.life > 0; });
      if (this.d.length > 220) this.d.splice(0, this.d.length - 220);
    },
    draw: function () {
      this.rest.forEach(function (p, i) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        alpha(i % 3 ? pal.ink : pal.a, 1);
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s);
        ctx.lineWidth = 2; ctx.strokeStyle = pal.ink; ctx.strokeRect(-p.s / 2, -p.s / 2, p.s, p.s);
        ctx.restore();
      });
      this.d.forEach(function (p, i) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        alpha(i % 3 ? pal.ink : pal.a, Math.min(1, p.life * 2));
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s);
        ctx.lineWidth = 2; ctx.strokeStyle = pal.ink; ctx.strokeRect(-p.s / 2, -p.s / 2, p.s, p.s);
        ctx.restore();
      });
    },
    click: function (x, y) {
      for (var i = 0; i < 36; i++) this.d.push({ x: x + rnd(-40, 40), y: y + rnd(-10, 10), vx: rnd(-6, 6), vy: rnd(-10, -2), s: rnd(6, 16), rot: rnd(0, 6), vr: rnd(-.25, .25), life: 1 });
    }
  };

  /* ---------- Swiss: dots hop between grid intersections ---------- */
  var swiss = {
    hint: 'Move over the grid', name: 'Swiss: snapping to the grid',
    desc: 'A sparse grid of fixed points. A few dots hop from one intersection to the next and always land exactly on the grid. The point under the cursor is marked with a red crosshair.',
    init: function () {
      this.g = Math.max(36, Math.round(W / 16)); this.dots = [];
      this.cols = Math.floor(W / this.g); this.rows = Math.floor(H / this.g);
      this.ox = (W - (this.cols - 1) * this.g) / 2; this.oy = (H - (this.rows - 1) * this.g) / 2;
      for (var i = 0; i < 12; i++) {
        var c = (Math.random() * this.cols) | 0, r = (Math.random() * this.rows) | 0;
        this.dots.push({ c: c, r: r, x: this.ox + c * this.g, y: this.oy + r * this.g, hop: rnd(0, 1200), big: i < 2 });
      }
    },
    step: function (dt) {
      var self = this;
      this.dots.forEach(function (d) {
        d.hop -= dt;
        if (d.hop <= 0) {
          d.hop = rnd(700, 1500);
          if (Math.random() < .5) d.c = Math.max(0, Math.min(self.cols - 1, d.c + (Math.random() < .5 ? -1 : 1)));
          else d.r = Math.max(0, Math.min(self.rows - 1, d.r + (Math.random() < .5 ? -1 : 1)));
        }
        d.x += (self.ox + d.c * self.g - d.x) * Math.min(1, dt / 90);
        d.y += (self.oy + d.r * self.g - d.y) * Math.min(1, dt / 90);
      });
    },
    draw: function () {
      var c, r, g = this.g;
      alpha(pal.b, .45);
      for (c = 0; c < this.cols; c++) for (r = 0; r < this.rows; r++) ctx.fillRect(this.ox + c * g - 1, this.oy + r * g - 1, 2, 2);
      this.dots.forEach(function (d) { alpha(pal.ink, 1); dot(d.x, d.y, d.big ? 9 : 4); });
      if (mouse.in) {
        var mc = Math.max(0, Math.min(this.cols - 1, Math.round((mouse.x - this.ox) / g))), mr = Math.max(0, Math.min(this.rows - 1, Math.round((mouse.y - this.oy) / g)));
        var px = this.ox + mc * g, py = this.oy + mr * g;
        alpha(pal.a, 1); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(px - 14, py); ctx.lineTo(px + 14, py); ctx.moveTo(px, py - 14); ctx.lineTo(px, py + 14); ctx.stroke();
        dot(px, py, 6);
      }
    },
    click: function (x, y) {
      var near = this.dots[0], best = 1e9, self = this;
      this.dots.forEach(function (d) { var dd = Math.hypot(d.x - x, d.y - y); if (dd < best) { best = dd; near = d; } });
      near.c = Math.max(0, Math.min(this.cols - 1, Math.round((x - this.ox) / this.g)));
      near.r = Math.max(0, Math.min(this.rows - 1, Math.round((y - this.oy) / this.g)));
      near.hop = 1000;
    }
  };

  var demos = { neural: neural, cosmos: cosmos, bauhaus: bauhaus, brutalist: brutalist, swiss: swiss };

  function size() {
    var r = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
    W = Math.round(r.width); H = Math.round(r.height);
    cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  function render() {
    ctx.globalAlpha = 1; ctx.clearRect(0, 0, W, H);
    cur.draw(); ctx.globalAlpha = 1;
  }
  function frame(ts) {
    raf = 0;
    var dt = Math.min(40, last ? ts - last : 16); last = ts; t = ts;
    cur.step(dt); render();
    if (motion()) raf = requestAnimationFrame(frame);
  }
  function run() {
    cancelAnimationFrame(raf); raf = 0; last = 0;
    if (motion()) raf = requestAnimationFrame(frame);
    else { for (var i = 0; i < 90; i++) cur.step(16); render(); }
  }
  function select(name) {
    wrap.setAttribute('data-demo', name);
    cur = demos[name]; readPal(); size(); cur.init();
    hire.hidden = name !== 'brutalist';
    document.getElementById('hint').textContent = cur.hint;
    document.getElementById('name').textContent = cur.name;
    document.getElementById('desc').textContent = cur.desc;
    document.querySelectorAll('.tab').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.d === name)); });
    try { history.replaceState(null, '', '#' + name); } catch (e) {}
    run();
  }

  function pos(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  cv.addEventListener('pointermove', function (e) { var p = pos(e); mouse.x = p.x; mouse.y = p.y; mouse.in = true; if (!motion()) render(); });
  cv.addEventListener('pointerleave', function () { mouse.in = false; mouse.x = mouse.y = -999; if (!motion()) render(); });
  cv.addEventListener('pointerdown', function (e) { if (!motion()) return; var p = pos(e); cur.click(p.x, p.y); });
  hire.addEventListener('click', function () {
    if (!motion()) return;
    var br = hire.getBoundingClientRect(), cr = cv.getBoundingClientRect();
    cur.click(br.left - cr.left + br.width / 2, br.top - cr.top + br.height / 2);
  });
  document.querySelectorAll('.tab').forEach(function (b) { b.addEventListener('click', function () { select(b.dataset.d); }); });
  pauseBtn.addEventListener('click', function () {
    paused = !paused; pauseBtn.setAttribute('aria-pressed', String(paused)); pauseBtn.textContent = paused ? 'Resume motion' : 'Pause motion'; run();
  });
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { size(); cur.init(); run(); }, 120); });
  function onScheme() { readPal(); if (!motion()) render(); }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', onScheme);
  new MutationObserver(onScheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  mq.addEventListener('change', function () { document.getElementById('rm').hidden = !mq.matches; run(); });
  document.getElementById('rm').hidden = !mq.matches;

  var start = (location.hash || '').slice(1);
  select(demos[start] ? start : 'neural');
})();
