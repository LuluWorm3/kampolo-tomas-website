/* Two pieces of the Renaissance Edition's Studio scene: the code editor on the monitor (real code from this repository, typed out
   while the scene is on screen) and the reveal that paints the owner's portrait onto the easel canvas, stroke by stroke, over the
   underdrawing. Mounted and unmounted by edition.js. Classic script, no dependencies. */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var editors = [];
  var reveals = [];

  // A real excerpt from this repository.
  var CODE = {
    file: 'track.js',
    code: "function track(event, detail) {\n  try {\n    if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;\n    if (!navigator.sendBeacon) return;\n    var body = JSON.stringify({ e: event, d: detail ? String(detail).slice(0, 40) : '', p: location.pathname.slice(0, 40) });\n    navigator.sendBeacon('/api/ping', new Blob([body], { type: 'application/json' }));\n  } catch (e) {}\n}",
  };

  var TOKEN = /(\/\/[^\n]*)|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")|(\b\d[\d_]*\b)|([A-Za-z_$][\w$]*)|(\s+)|([\s\S])/g;
  var KEYWORD = /^(const|let|var|function|return|if|else|try|catch|for|of|export|default|new|await|async|typeof|class|import|from)$/;

  function tokenize(src) {
    var out = [];
    var m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(src))) {
      var cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'n' : m[4] ? (KEYWORD.test(m[4]) ? 'k' : '') : '';
      out.push({ cls: cls, text: m[0] });
    }
    return out;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function Editor() {
    var lines = [[]];
    tokenize(CODE.code).forEach(function (t) {
      t.text.split('\n').forEach(function (part, i) {
        if (i > 0) lines.push([]);
        if (part) lines[lines.length - 1].push({ cls: t.cls, text: part });
      });
    });
    this.lines = lines;
    this.total = CODE.code.length;
    this.divs = [];
    this.spans = [];
    this.started = false;
    this.done = false;
    this.raf = 0;
    this.root = el('div', 'studio__ide');
    this.root.setAttribute('aria-hidden', 'true');
    var bar = el('div', 'ide__bar');
    ['r', 'y', 'g'].forEach(function (c) { bar.appendChild(el('i', 'ide__dot ide__dot--' + c)); });
    bar.appendChild(el('span', 'ide__tab', CODE.file));
    bar.appendChild(el('span', 'ide__tab ide__tab--dim', 'script.js'));
    this.code = el('div', 'ide__code');
    this.caret = el('span', 'ide__caret', '​');
    this.root.appendChild(bar);
    this.root.appendChild(this.code);
    this.root.appendChild(el('div', 'ide__status', CODE.file + '  ·  UTF-8  ·  JavaScript'));
    if (reduce.matches) this.finish();
  }

  Editor.prototype.typeTo = function (n) {
    var pos = 0;
    var last = null;
    for (var li = 0; li < this.lines.length; li++) {
      if (pos > n) break;
      var div = this.divs[li];
      if (!div) {
        div = el('div', 'ide__line');
        this.code.appendChild(div);
        this.divs[li] = div;
        this.spans[li] = [];
      }
      last = div;
      var line = this.lines[li];
      for (var ti = 0; ti < line.length; ti++) {
        var t = line[ti];
        if (pos >= n) break;
        var span = this.spans[li][ti];
        if (!span) {
          span = el('span', t.cls ? 'tok-' + t.cls : '');
          div.appendChild(span);
          this.spans[li][ti] = span;
        }
        var text = t.text.slice(0, n - pos);
        if (span.textContent !== text) span.textContent = text;
        pos += t.text.length;
      }
      pos += 1;
    }
    if (last) last.appendChild(this.caret);
  };

  // Types the whole excerpt out once, over a few seconds, at an even human pace.
  Editor.prototype.start = function () {
    var self = this;
    if (this.started || this.done) return;
    this.started = true;
    var t0 = performance.now();
    function tick(now) {
      var p = Math.min(1, (now - t0) / 7000);
      self.typeTo(Math.floor(self.total * p));
      if (p < 1) self.raf = requestAnimationFrame(tick); else self.finish();
    }
    this.raf = requestAnimationFrame(tick);
  };

  Editor.prototype.finish = function () {
    cancelAnimationFrame(this.raf);
    this.typeTo(this.total);
    this.done = true;
  };

  Editor.prototype.destroy = function () {
    cancelAnimationFrame(this.raf);
    this.root.remove();
  };


  /* ---------- the reveal: the finished figure is painted over the underdrawing in three passes of brush strokes ---------- */
  function load(url) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = url;
    });
  }

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Strokes sweep the area in rows, like a hand working across a canvas: coarse blocks first, then smaller, then fine.
  function strokes(W, H, passes, seed) {
    var rand = rng(seed);
    var list = [];
    passes.forEach(function (p, pi) {
      var step = p.size * 0.6;
      var row = 0;
      for (var y = -step / 2; y < H + step; y += step, row++) {
        var dir = row % 2 === 0 ? 1 : -1;
        for (var k = 0, nx = Math.ceil(W / step) + 2; k < nx; k++) {
          if (rand() > p.cover) continue;
          var x = (dir === 1 ? k : nx - 1 - k) * step - step / 2;
          var a = (dir === 1 ? 0.25 : Math.PI - 0.25) + (rand() - 0.5) * 0.9;
          list.push({ x: x + (rand() - 0.5) * step * 0.6, y: y + (rand() - 0.5) * step * 0.6, rx: p.size * (0.8 + rand() * 0.5), ry: p.size * (0.32 + rand() * 0.2), a: a, src: p.src, alpha: p.alpha, pass: pi });
        }
      }
    });
    return list;
  }

  function Reveal(canvas, url) {
    var self = this;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;
    this.ready = false;
    this.started = false;
    this.done = false;
    this.pending = false;
    this.raf = 0;
    this.destroyed = false;
    load(url).then(function (img) {
      if (self.destroyed) return;
      self.patch = img;
      // a soft block-in of the figure: a blurred copy kept inside the figure's own outline
      var small = document.createElement('canvas');
      small.width = Math.max(6, Math.round(self.W / 12));
      small.height = Math.max(6, Math.round(self.H / 12));
      small.getContext('2d').drawImage(img, 0, 0, small.width, small.height);
      var under = document.createElement('canvas');
      under.width = self.W;
      under.height = self.H;
      var g = under.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(small, 0, 0, self.W, self.H);
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(img, 0, 0, self.W, self.H);
      self.under = under;
      var u = Math.max(self.W, self.H) / 430;
      self.list = strokes(self.W, self.H, [{ size: 34 * u, src: 'under', alpha: 1, cover: 1 }, { size: 15 * u, src: 'patch', alpha: 0.75, cover: 0.9 }, { size: 7 * u, src: 'patch', alpha: 1, cover: 0.85 }], 11);
      // each pass gets its own share of the time, so the figure is blocked in, built up, then detailed
      self.ends = [0, 1, 2].map(function (k) { var n = 0; self.list.forEach(function (s) { if (s.pass <= k) n++; }); return n; });
      self.ready = true;
      if (reduce.matches) self.finish(); else if (self.pending) self.start();
    }).catch(function () {});
  }

  Reveal.prototype.dab = function (s) {
    var g = this.ctx;
    var img = s.src === 'under' ? this.under : this.patch;
    var r = Math.max(s.rx, s.ry) + 2;
    var sx = Math.max(0, s.x - r), sy = Math.max(0, s.y - r);
    var sw = Math.min(this.W - sx, r * 2), sh = Math.min(this.H - sy, r * 2);
    if (sw <= 0 || sh <= 0) return;
    g.save();
    g.globalAlpha = s.alpha;
    g.beginPath();
    g.ellipse(s.x, s.y, s.rx, s.ry, s.a, 0, Math.PI * 2);
    g.clip();
    g.drawImage(img, sx / this.W * img.width, sy / this.H * img.height, sw / this.W * img.width, sh / this.H * img.height, sx, sy, sw, sh);
    g.restore();
  };

  Reveal.prototype.start = function () {
    var self = this;
    if (this.started || this.done) return;
    if (!this.ready) { this.pending = true; return; }
    this.started = true;
    var T = 9000;
    var t0 = performance.now();
    var idx = 0;
    function frame(now) {
      if (self.destroyed || self.done) return;
      var p = Math.min(1, (now - t0) / T);
      var e = self.ends;
      var target = Math.floor(p < 0.25 ? e[0] * (p / 0.25) : p < 0.6 ? e[0] + (e[1] - e[0]) * ((p - 0.25) / 0.35) : e[1] + (e[2] - e[1]) * Math.min(1, (p - 0.6) / 0.4));
      while (idx < target) { self.dab(self.list[idx]); idx++; }
      if (p < 1) { self.raf = requestAnimationFrame(frame); return; }
      self.settle();
    }
    this.raf = requestAnimationFrame(frame);
  };

  // A last, quick glaze of the finished figure over the strokes, so no gaps or soft edges remain.
  Reveal.prototype.settle = function () {
    var self = this;
    var t0 = performance.now();
    function frame(now) {
      if (self.destroyed || self.done) return;
      var p = Math.min(1, (now - t0) / 700);
      self.ctx.globalAlpha = 0.18;
      self.ctx.drawImage(self.patch, 0, 0, self.W, self.H);
      self.ctx.globalAlpha = 1;
      if (p < 1) self.raf = requestAnimationFrame(frame); else self.finish();
    }
    this.raf = requestAnimationFrame(frame);
  };

  Reveal.prototype.finish = function () {
    if (!this.patch) { this.pending = false; return; }
    cancelAnimationFrame(this.raf);
    this.ctx.clearRect(0, 0, this.W, this.H);
    this.ctx.globalAlpha = 1;
    this.ctx.drawImage(this.patch, 0, 0, this.W, this.H);
    this.done = true;
  };

  Reveal.prototype.destroy = function () {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
  };

  function createReveal(canvas, url) {
    var r = new Reveal(canvas, url);
    reveals.push(r);
    return r;
  }

  function create() {
    var ed = new Editor();
    editors.push(ed);
    return ed;
  }

  function unmountAll() {
    editors.forEach(function (e) { e.destroy(); });
    editors = [];
    reveals.forEach(function (r) { r.destroy(); });
    reveals = [];
  }

  window.Studio = { create: create, createReveal: createReveal, unmountAll: unmountAll };
})();
