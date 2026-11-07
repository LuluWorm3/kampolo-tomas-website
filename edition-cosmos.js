/* Cosmos Edition, "Flight" (the + beside Cosmos in the Style lab; style name cosmos-plus). Lazy-loaded by editions-plus.js on first entry; styles:
   edition-cosmos.css. A pinned full-screen canvas is the camera: stars fly past at a speed that follows scroll velocity, and a click on a link to
   a section (menu, orrery, buttons) fires a short warp. Every chapter is a system drawn in canvas with its own palette: the cover a star with
   orbits, About a home world, Experience a ringed planet, Projects one planet per project on the page, Skills constellations in a nebula,
   Education a giant with one moon per entry, Contact a pulsar. The page content sits on glass data slates beside the planet, in reading order.
   Dark is a night sky; light is a daylight star chart in line art. At 720px and below, with reduced motion, or paused, the planets stay but the
   camera does not move: no warp, no streaks, single-column slates. All copy is read from text already on the page. Classic script.
   Prefix rule: every class an edition adds starts with cs-; P.util.track() records them so destroy() leaves nothing behind. */
(function () {
  var P = window.PlusEditions;
  if (!P) return;
  var U = P.util;
  var el = U.el;
  var sv = U.sv;
  var motion = U.motion;
  var mulberry = U.mulberry;
  var hexA = U.hexA;
  var palette = U.palette;
  var glow = U.glow;
  var makeLoop = U.makeLoop;
  var track = U.track;
  var reduceMq = U.reduce;
  var TAU = 6.2832;
  var coarseMq = window.matchMedia('(pointer: coarse)');

  // Per chapter: two nebula colours for the dark sky, the line colour for the daylight chart, and the kind of system it holds.
  var CH = {
    home: { k: 'star', g: ['#ffb347', '#4f6bff'], l: '#a85a00' },
    about: { k: 'world', g: ['#3aa6ff', '#2fd6a0'], l: '#1f5fb8' },
    experience: { k: 'ringed', g: ['#ffb347', '#c0562b'], l: '#a85a00' },
    projects: { k: 'fleet', g: ['#b69cff', '#ff6fa8'], l: '#6a4cc4' },
    skills: { k: 'const', g: ['#7aa7ff', '#36e0c4'], l: '#2f5fd0' },
    education: { k: 'moons', g: ['#e08cff', '#7a5cd6'], l: '#8a3fb0' },
    contact: { k: 'pulsar', g: ['#7ff0ff', '#ff5fb0'], l: '#0a7a8a' },
  };
  // Eight looks for the project planets (dark shading, atmosphere, bands) and eight line colours for the chart.
  var PLANETS = [
    { hi: '#ffd0e6', mid: '#d9488f', lo: '#3b0a2e', atm: '#ff8bd0', bands: ['#ff9bd0', '#a52a6e'] },
    { hi: '#bff6ee', mid: '#1fb5a0', lo: '#052b2a', atm: '#6ff5dc', bands: ['#8cf0e0', '#0c7c70'] },
    { hi: '#e1d4ff', mid: '#7a5cd6', lo: '#150a3a', atm: '#b69cff', ring: 1 },
    { hi: '#ffe6b0', mid: '#d98a1f', lo: '#3a1d02', atm: '#ffb347', bands: ['#ffd27a', '#a8620e'] },
    { hi: '#dff4ff', mid: '#5aa8e8', lo: '#0a2442', atm: '#8fd0ff', moon: 1 },
    { hi: '#e9ffc8', mid: '#7cc23a', lo: '#12300a', atm: '#b6f26b', bands: ['#c4f08a', '#4f8a1f'] },
    { hi: '#ffd2c4', mid: '#e2563a', lo: '#3a0e06', atm: '#ff8a6a', ring: 1, spots: 1 },
    { hi: '#d6dcff', mid: '#4d5fe0', lo: '#0a0f3a', atm: '#8b9bff', bands: ['#9aa6ff', '#2e3cb0'], moon: 1 },
  ];
  var LINES = ['#a82f6e', '#0e7a6b', '#6a4cc4', '#a85a00', '#1f5fb8', '#3f7a0c', '#b83a1c', '#3a48c0'];
  var WORLD = { hi: '#bfe6ff', mid: '#1f6fb8', lo: '#04152e', atm: '#7fd0ff' };
  var GIANT = { hi: '#f2d8ff', mid: '#a05cd6', lo: '#1c0a3a', atm: '#e08cff', bands: ['#e9b8ff', '#6a3aa8'] };
  var RINGED = { hi: '#ffe9bd', mid: '#d98a3a', lo: '#2e1503', atm: '#ffb347', bands: ['#ffd9a0', '#9a5420'] };
  var MOON = { hi: '#f4f1ff', mid: '#9a96c8', lo: '#14122e', atm: '#b69cff' };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function two(n) { return (n < 10 ? '0' : '') + n; }
  function mix(a, b, t) {
    function p(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    var x = p(a);
    var y = p(b);
    var c = [0, 1, 2].map(function (i) { return Math.round(x[i] + (y[i] - x[i]) * t); });
    return '#' + ((1 << 24) | (c[0] << 16) | (c[1] << 8) | c[2]).toString(16).slice(1);
  }
  function short(s, n) { s = (s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  function cosmosEngine(canvas, list) {
    var tk = track();
    var ctx = canvas.getContext('2d');
    var pal = palette();
    var dark = pal.dark;
    var ink = pal.ink;
    var muted = '#b3aedd';
    var paper = '#e9effb';
    var W = 0;
    var H = 0;
    var small = false;
    var T = 0;
    var vel = 0;
    var warp = 0;
    var lastSy = 0;
    var lastDraw = 0;
    var active = '';
    var queued = 0;
    var measureT = 0;
    var shoot = null;
    var nextShoot = 6000;
    var rnd = mulberry(5);
    var chap = [];
    var bodies = [];
    var geo = { left: 0, width: 0 };
    var home = list.filter(function (s) { return s.id === 'home'; })[0];
    var place = '';
    var orrery = null;
    var readout = null;
    var made = [];
    var lit = null;
    var key = '';

    // The home world sits where the hero says the owner is: the text after the last slash of the hero's meta line.
    var meta = home && home.querySelector('.hero__meta');
    if (meta) place = short(meta.textContent.split('/').pop(), 28);

    // ---- stars: x, y in [-1, 1] and a depth z; screen offset = (x, y) * K / z, so a star flies outward as z falls
    var N = 230;
    var sx = new Float32Array(N);
    var sy = new Float32Array(N);
    var sz = new Float32Array(N);
    var sc = new Uint8Array(N);
    // mode 0: anywhere on screen (first fill); 1: far ahead, near the centre (flying forward); 2: at the edge, close (flying back)
    function respawn(i, mode) {
      var z = mode === 1 ? 0.75 + rnd() * 0.25 : mode === 2 ? 0.06 + rnd() * 0.1 : 0.08 + rnd() * 0.92;
      var K = Math.max(W, H) * 0.07 || 1;
      var spread = mode === 1 ? 1 : 0.55 / K;
      sx[i] = (rnd() * 2 - 1) * (mode === 1 ? 1 : Math.min(W * spread * z, 12));
      sy[i] = (rnd() * 2 - 1) * (mode === 1 ? 1 : Math.min(H * spread * z, 12));
      sz[i] = z;
      sc[i] = rnd() < 0.3 ? 1 : 0;
    }
    function seed() { for (var q = 0; q < N; q++) respawn(q, 0); }
    // ---- continents of the home world
    var land = [];
    for (var c0 = 0; c0 < 7; c0++) {
      var pts = [];
      for (var j = 0; j < 9; j++) pts.push(0.65 + rnd() * 0.5);
      land.push(c0 === 0 ? { lon: 0.298, lat: -0.394, sz: 0.34, pts: pts } : { lon: rnd() * TAU, lat: (rnd() - 0.5) * 2.0, sz: 0.16 + rnd() * 0.18, pts: pts });
    }

    function isLive() { return motion() && !small; }

    // ---- geometry of the page, read once and again when the layout changes (never per frame)
    function measure() {
      var top = window.scrollY || 0;
      small = window.innerWidth <= 720;
      chap = list.map(function (s) {
        var r = s.getBoundingClientRect();
        var h = s.querySelector('.section__head') || s.querySelector('.hero__meta');
        var hr = h ? h.getBoundingClientRect() : r;
        return { id: s.id, el: s, top: r.top + top, bot: r.bottom + top, name: s.getAttribute('data-section') || s.id, ht: hr.top + top, hh: hr.height };
      });
      bodies.forEach(function (b) {
        if (!b.el) return;
        var r = b.el.getBoundingClientRect();
        var sm = b.el.querySelector('summary');
        b.top = r.top + top;
        b.h = sm ? sm.offsetHeight : r.height;
      });
      var wr = document.querySelector('#main .wrap');
      var rr = wr ? wr.getBoundingClientRect() : { left: 0, width: window.innerWidth };
      geo.left = rr.left;
      geo.width = rr.width;
    }
    function lazyMeasure() {
      clearTimeout(measureT);
      measureT = setTimeout(function () { measure(); if (!loop.running()) once(); }, 180);
    }

    function build() {
      bodies = [];
      list.forEach(function (s, ci) {
        var d = CH[s.id];
        tk.cls(s, 'cs-sys');
        if (!d) { tk.cls(s, 'cs-at-c'); return; }
        var side = d.k === 'ringed' || d.k === 'moons' ? -1 : d.k === 'const' ? 0 : 1;
        tk.cls(s, 'cs-k-' + d.k);
        tk.cls(s, side < 0 ? 'cs-at-r' : side ? 'cs-at-l' : 'cs-at-c');
        if (d.k === 'fleet') {
          s.querySelectorAll('.project').forEach(function (p, i) {
            tk.cls(p, 'cs-planet');
            tk.cls(p, 'cs-p' + (i % 8));
            bodies.push({ k: 'planet', ci: ci, sec: s, el: p, i: i, side: 1 });
          });
        } else if (d.k === 'moons') {
          bodies.push({ k: 'giant', ci: ci, sec: s, side: -1 });
          s.querySelectorAll('.edu__item').forEach(function (p, i) {
            tk.cls(p, 'cs-moon');
            bodies.push({ k: 'moon', ci: ci, sec: s, el: p, i: i, side: -1 });
          });
        } else bodies.push({ k: d.k, ci: ci, sec: s, side: side });
      });
    }

    function size() {
      small = window.innerWidth <= 720;
      var dpr = Math.min(window.innerWidth <= 900 || coarseMq.matches ? 1.5 : 2, window.devicePixelRatio || 1);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      N = small ? 110 : 230;
      seed();
    }
    function readTheme() {
      pal = palette();
      dark = pal.dark;
      ink = pal.ink;
      var cs = getComputedStyle(document.documentElement);
      muted = (cs.getPropertyValue('--muted') || '').trim() || muted;
      paper = (cs.getPropertyValue('--bg') || '').trim() || paper;
    }

    // ---- drawing helpers
    function label(x, y, txt, a) {
      if (a < 0.55 || small) return;
      ctx.font = '11px ui-monospace, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = hexA(muted, a);
      txt = txt.toUpperCase();
      var half = ctx.measureText(txt).width / 2 + 12;
      ctx.fillText(txt, clamp(x, half, W - half), y);
    }
    function disc(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }
    // A sphere: shaded and lit from the upper left at night; a graticule globe with hatching in line art by day.
    function ball(x, y, r, s, li, rot, seed) {
      var k;
      if (dark) {
        glow(ctx, x, y, r * 1.8, s.atm, 0.26);
        var g = ctx.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.08, x, y, r);
        g.addColorStop(0, s.hi); g.addColorStop(0.5, s.mid); g.addColorStop(1, s.lo);
        ctx.fillStyle = g; disc(x, y, r); ctx.fill();
        ctx.save(); disc(x, y, r); ctx.clip();
        if (s.bands) {
          ctx.translate(x, y); ctx.rotate(-0.12);
          for (k = 0; k < 8; k++) { ctx.fillStyle = hexA(s.bands[k % 2], 0.3); ctx.fillRect(-r * 1.2, -r + (k * 0.26 + Math.sin(rot + k) * 0.01) * r, r * 2.4, r * 0.12 * (1 + (k % 3) * 0.5)); }
          ctx.rotate(0.12); ctx.translate(-x, -y);
        }
        if (s.spots) { var rs = mulberry(seed + 3); ctx.fillStyle = 'rgba(0,0,0,0.28)'; for (k = 0; k < 6; k++) { disc(x + (rs() - 0.5) * r * 1.3, y + (rs() - 0.5) * r * 1.3, r * (0.07 + rs() * 0.1)); ctx.fill(); } }
        var sh = ctx.createRadialGradient(x + r * 0.55, y + r * 0.45, r * 0.15, x + r * 0.55, y + r * 0.45, r * 1.35);
        sh.addColorStop(0, 'rgba(0,0,6,0)'); sh.addColorStop(1, 'rgba(0,0,6,0.78)');
        ctx.fillStyle = sh; ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.restore();
        ctx.strokeStyle = hexA(s.atm, 0.4); ctx.lineWidth = 1; disc(x, y, r); ctx.stroke();
      } else {
        ctx.fillStyle = paper; disc(x, y, r); ctx.fill();
        ctx.fillStyle = hexA(li, 0.08); ctx.fill();
        ctx.save(); disc(x, y, r); ctx.clip();
        ctx.strokeStyle = hexA(li, 0.5); ctx.lineWidth = 1;
        for (k = 1; k <= 3; k++) { ctx.beginPath(); ctx.ellipse(x, y, Math.abs(Math.cos(k * 0.785 + rot * 0.4)) * r, r, 0, 0, TAU); ctx.stroke(); }
        for (k = -2; k <= 2; k++) { ctx.beginPath(); ctx.ellipse(x, y + k * r * 0.34, Math.sqrt(Math.max(0, 1 - Math.pow(k * 0.34, 2))) * r, r * 0.07, 0, 0, TAU); ctx.stroke(); }
        ctx.strokeStyle = hexA(li, 0.55);
        for (k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(x, y, r * (0.8 + k * 0.045), 0.15, 1.35); ctx.stroke(); }
        ctx.restore();
        ctx.strokeStyle = li; ctx.lineWidth = 1.6; disc(x, y, r); ctx.stroke();
      }
    }
    function rings(x, y, r, s, li, front) {
      var from = front ? 0 : Math.PI;
      var to = front ? Math.PI : TAU;
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.3);
      [[1.55, 0.1, 0.7], [1.82, 0.17, 0.5], [2.1, 0.05, 0.6]].forEach(function (R) {
        ctx.lineWidth = dark ? R[1] * r : (R[0] > 1.8 ? 1.8 : 1);
        ctx.strokeStyle = dark ? hexA(s.hi, R[2]) : hexA(li, 0.8);
        ctx.beginPath(); ctx.ellipse(0, 0, R[0] * r, R[0] * r * 0.27, 0, from, to); ctx.stroke();
      });
      ctx.restore();
    }
    function orbitMoon(x, y, r, ang, mr, al) {
      var mx = x + Math.cos(ang) * r * 1.75;
      var my = y + Math.sin(ang) * r * 0.5;
      ctx.globalAlpha = al;
      ball(mx, my, mr, MOON, dark ? '#b69cff' : '#44557c', 0, 1);
      ctx.globalAlpha = 1;
    }
    function worldBall(x, y, r, al, rot, showPin) {
      ball(x, y, r, WORLD, '#1f5fb8', rot, 1);
      ctx.save(); disc(x, y, r); ctx.clip();
      var pin = null;
      land.forEach(function (L, i) {
        var dl = L.lon - rot;
        var cz = Math.cos(L.lat) * Math.cos(dl);
        if (cz < -0.2) return;
        var px = x + Math.cos(L.lat) * Math.sin(dl) * r;
        var py = y - Math.sin(L.lat) * r;
        var kx = Math.max(0.25, cz);
        ctx.save(); ctx.translate(px, py); ctx.scale(kx, 1);
        ctx.beginPath();
        var n9 = L.pts.length;
        var xy = L.pts.map(function (v, j) { var a = j / n9 * TAU; return [Math.cos(a) * L.sz * r * v, Math.sin(a) * L.sz * r * v]; });
        ctx.moveTo((xy[0][0] + xy[n9 - 1][0]) / 2, (xy[0][1] + xy[n9 - 1][1]) / 2);
        xy.forEach(function (q0, j) { var q1 = xy[(j + 1) % n9]; ctx.quadraticCurveTo(q0[0], q0[1], (q0[0] + q1[0]) / 2, (q0[1] + q1[1]) / 2); });
        ctx.closePath();
        if (dark) { ctx.fillStyle = hexA('#3aa56b', 0.85); ctx.fill(); ctx.strokeStyle = hexA('#bfe6ff', 0.3); ctx.stroke(); } else { ctx.strokeStyle = '#1f5fb8'; ctx.lineWidth = 1.3; ctx.stroke(); }
        ctx.restore();
        if (i === 0 && cz > 0.05) pin = { x: px, y: py };
      });
      if (dark) { // night-side lights, and a thin cloud arc
        var sh = ctx.createRadialGradient(x + r * 0.55, y + r * 0.45, r * 0.15, x + r * 0.55, y + r * 0.45, r * 1.35);
        sh.addColorStop(0, 'rgba(0,0,6,0)'); sh.addColorStop(1, 'rgba(0,0,6,0.7)');
        ctx.fillStyle = sh; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      ctx.restore();
      if (pin && showPin) {
        ctx.strokeStyle = dark ? '#ffb347' : '#a85a00'; ctx.lineWidth = 1.5; disc(pin.x, pin.y, 5); ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle; disc(pin.x, pin.y, 1.8); ctx.fill();
        if (place) {
          ctx.textAlign = 'left'; ctx.font = '11px ui-monospace, Consolas, monospace';
          var pw = ctx.measureText(place.toUpperCase()).width;
          ctx.fillStyle = dark ? 'rgba(3,4,12,0.7)' : hexA(paper, 0.92); ctx.fillRect(pin.x + 6, pin.y - 21, pw + 8, 16);
          ctx.fillStyle = hexA(dark ? '#ffd9a0' : '#7a3f00', al); ctx.fillText(place.toUpperCase(), pin.x + 10, pin.y - 9);
        }
      }
    }
    function pulsar(x, y, r, al, li, live) {
      var col = dark ? '#7ff0ff' : li;
      var a = live ? T / 1500 : -0.55;
      var k;
      ctx.save(); ctx.translate(x, y);
      for (k = 0; k < 4; k++) {
        var p = live ? ((T / 2800 + k / 4) % 1) : (k + 0.35) / 4;
        ctx.strokeStyle = hexA(col, (1 - p) * 0.5 * al); ctx.lineWidth = dark ? 1.4 : 1;
        if (!dark) ctx.setLineDash([4, 5]);
        disc(0, 0, r * (0.22 + p * 1.5)); ctx.stroke();
        ctx.setLineDash([]);
      }
      [a, a + Math.PI].forEach(function (an) {
        ctx.save(); ctx.rotate(an);
        if (dark) {
          var g = ctx.createLinearGradient(0, 0, r * 3.4, 0);
          g.addColorStop(0, hexA('#d6fbff', 0.8 * al)); g.addColorStop(1, hexA('#ff5fb0', 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 3.4, -r * 0.2); ctx.lineTo(r * 3.4, r * 0.2); ctx.closePath(); ctx.fill();
        } else {
          ctx.strokeStyle = hexA(li, 0.8 * al); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(r * 0.2, 0); ctx.lineTo(r * 3.2, 0); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(r * 0.5, 0); ctx.lineTo(r * 3.2, r * 0.16); ctx.moveTo(r * 0.5, 0); ctx.lineTo(r * 3.2, -r * 0.16); ctx.stroke();
        }
        ctx.restore();
      });
      ctx.restore();
      if (dark) glow(ctx, x, y, r * 0.9, '#7ff0ff', 0.7 * al);
      ctx.fillStyle = dark ? '#ffffff' : li; disc(x, y, r * 0.13); ctx.fill();
      if (!dark) { ctx.strokeStyle = li; ctx.lineWidth = 1.2; disc(x, y, r * 0.24); ctx.stroke(); }
    }
    function sun(x, y, r, al, li, live) {
      var k;
      var col = dark ? '#ffb347' : li;
      ctx.save(); ctx.translate(x, y); ctx.rotate(live ? T / 40000 : 0);
      [0.55, 0.85, 1.2, 1.65].forEach(function (f, i) {
        ctx.strokeStyle = hexA(dark ? ink : li, (dark ? 0.16 : 0.4) * al); ctx.lineWidth = 1;
        if (!dark && i % 2) ctx.setLineDash([3, 5]);
        ctx.beginPath(); ctx.ellipse(0, 0, r * f * 1.6, r * f * 0.62, 0, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
        var an = (live ? T / (9000 * (i + 1)) : 0) + i * 1.9;
        ctx.fillStyle = i % 2 ? '#7aa7ff' : '#ffd9a0';
        if (!dark) ctx.fillStyle = paper;
        disc(Math.cos(an) * r * f * 1.6, Math.sin(an) * r * f * 0.62, 3 + (i % 2)); ctx.fill();
        if (!dark) { ctx.strokeStyle = li; ctx.stroke(); }
      });
      for (k = 0; k < 14; k++) {
        var a = k / 14 * TAU;
        ctx.strokeStyle = hexA(col, (dark ? 0.5 : 0.7) * al); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42); ctx.lineTo(Math.cos(a) * r * (k % 2 ? 0.58 : 0.74), Math.sin(a) * r * (k % 2 ? 0.58 : 0.74)); ctx.stroke();
      }
      ctx.restore();
      if (dark) { glow(ctx, x, y, r * 1.7, '#ffb347', 0.5 * al); ctx.fillStyle = '#fff3d6'; } else { ctx.fillStyle = paper; }
      disc(x, y, r * 0.3); ctx.fill();
      if (!dark) { ctx.strokeStyle = li; ctx.lineWidth = 1.6; ctx.stroke(); }
    }
    function nebula(x, y, r, al, i0, li) {
      var f = [[0, 0, 1], [0.7, 0.25, 0.7], [-0.6, 0.15, 0.8]];
      f.forEach(function (o, i) {
        var col = i % 2 ? CH.skills.g[1] : CH.skills.g[0];
        if (dark) glow(ctx, x + o[0] * r, y + o[1] * r, r * o[2], col, 0.34 * al);
        else { ctx.strokeStyle = hexA(li, 0.3 * al); ctx.setLineDash([2, 6]); disc(x + o[0] * r, y + o[1] * r, r * o[2] * 0.5); ctx.stroke(); ctx.setLineDash([]); }
      });
      var pts = [[-0.9, 0.2], [-0.55, -0.1], [-0.15, 0.25], [0.2, -0.2], [0.55, 0.05], [0.9, -0.3]];
      ctx.strokeStyle = hexA(dark ? ink : li, 0.35 * al); ctx.lineWidth = 1; ctx.beginPath();
      pts.forEach(function (p, i) { var px = x + p[0] * r * 0.9; var py = y + p[1] * r * 0.5; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
      ctx.stroke();
      pts.forEach(function (p, i) { ctx.fillStyle = hexA(dark ? '#ffffff' : li, 0.9 * al); disc(x + p[0] * r * 0.9, y + p[1] * r * 0.5, 1.6 + (i % 3)); ctx.fill(); });
    }

    // ---- where a body is on screen this frame. u < 0: already passing the camera; u > 0: still far ahead.
    function zone(side) {
      var gap = 24;
      var inner = Math.max(0, geo.width - gap * 2);
      var col = Math.min(640, inner * 0.56);
      if (side > 0) { var l = geo.left + gap + col + gap; return { x: (l + W) / 2, w: W - l }; }
      var rgt = geo.left + geo.width - gap - col - gap;
      return { x: rgt / 2, w: rgt };
    }
    function put(b, sy0, live) {
      var c = chap[b.ci];
      if (!c) { b.on = false; return; }
      var top = c.top - sy0;
      var bot = c.bot - sy0;
      var mid = (top + bot) / 2;
      var u;
      var r;
      b.on = true;
      b.s = 1; b.a = 1;
      if (small) {
        var hy = c.ht - sy0 + c.hh / 2;
        if (b.k === 'planet' || b.k === 'moon') { b.x = 28; b.y = b.top - sy0 + b.h / 2; b.r = b.k === 'moon' ? 9 : (b.el.open ? 14 : 11); }
        else { b.x = W - 56; b.y = hy; b.r = b.k === 'giant' ? 24 : b.k === 'star' ? 40 : b.k === 'ringed' ? 22 : 28; if (b.k === 'star') b.y = c.top - sy0 + 78; }
        b.on = b.y > -80 && b.y < H + 80;
        b.depth = 0;
        return;
      }
      var z = zone(b.side || 1);
      if (b.k === 'planet') {
        var ay = b.top - sy0 + b.h / 2;
        u = (ay - H / 2) / H;
        r = (b.el.open ? 54 : 30 + (b.i % 3) * 3.5) * Math.min(1, z.w / 330);
        b.x = z.x + Math.sin(b.i * 1.1 + 0.5) * z.w * 0.16;
        b.y = ay;
      } else if (b.k === 'moon') {
        var my = b.top - sy0 + b.h / 2;
        u = (my - H / 2) / H;
        r = (9 + (b.i % 2) * 3) * Math.min(1.3, z.w / 300);
        b.x = z.x + Math.sin(b.i * 1.7 + 1) * z.w * 0.3;
        b.y = my;
      } else {
        r = Math.min(z.w * (b.k === 'giant' ? 0.3 : 0.4), H * (b.k === 'star' ? 0.3 : 0.26), 190);
        if (b.k === 'const') { r = Math.min(W * 0.34, 330); if (live || !reduceMq.matches) z = { x: W * 0.5, w: W }; else { z = zone(1); r = Math.min(z.w * 0.4, 260); } }
        if (live) { u = (mid - H / 2) / H * 0.8; b.y = H / 2 + (mid - H / 2) * 0.55; } else { u = 0; b.y = clamp(H / 2, top + r * 1.15, bot - r * 1.15); }
        b.x = z.x;
        if (b.k === 'giant') b.x = z.x * 0.55;
      }
      b.r = r;
      if (live) {
        var f = Math.min(1, Math.abs(u));
        b.s = u > 0 ? 1 - 0.36 * f : 1 + 0.22 * f;
        b.a = u > 0 ? 1 - 0.5 * f : 1 - 0.85 * f;
        if (u < 0) b.x += (b.side || 1) * f * z.w * 0.32;
      }
      b.s *= 1 + warp * 0.1;
      b.depth = u;
      b.on = b.a > 0.03 && b.y > -b.r * 3.5 && b.y < H + b.r * 3.5;
    }

    function drawBody(b, live, near) {
      var d = CH[b.sec.id] || CH.home;
      var li = dark ? d.l : d.l;
      var x = b.x;
      var y = b.y;
      var r = b.r * b.s;
      var al = b.a;
      ctx.globalAlpha = al;
      if (b.k === 'star') sun(x, y, r, al, li, live);
      else if (b.k === 'world') {
        worldBall(x, y, r, al, live ? 0.298 + 0.3 - T / 12000 : 0.298 + 0.3, true);
        orbitMoon(x, y, r, live ? T / 5200 : 2.4, Math.max(7, r * 0.1), al);
        label(x, y + r * 1.32, chap[b.ci].name + ' / home world', al);
      } else if (b.k === 'ringed') {
        rings(x, y, r, RINGED, '#a85a00', false);
        ball(x, y, r, RINGED, '#a85a00', live ? T / 4000 : 0, 2);
        rings(x, y, r, RINGED, '#a85a00', true);
        label(x, y + r * 1.4, chap[b.ci].name + ' / ringed giant', al);
      } else if (b.k === 'planet') {
        var s = PLANETS[b.i % 8];
        var pl = LINES[b.i % 8];
        if (s.ring) rings(x, y, r * 0.8, s, pl, false);
        ball(x, y, r, s, pl, live ? T / 3000 + b.i : b.i, b.i);
        if (s.ring) rings(x, y, r * 0.8, s, pl, true);
        if (s.moon) orbitMoon(x, y, r * 0.8, (live ? T / 2400 : 1.2) + b.i, Math.max(3, r * 0.17), al);
        if (b.el.open) { ctx.strokeStyle = hexA(dark ? s.atm : pl, 0.7); ctx.lineWidth = 1; ctx.setLineDash([3, 5]); disc(x, y, r * 1.45); ctx.stroke(); ctx.setLineDash([]); }
        if (near && !small) label(x, y + r + 16, two(b.i + 1) + ' ' + short(b.el.querySelector('.project__name').textContent, 30), al);
      } else if (b.k === 'giant') {
        ball(x, y, r, GIANT, '#8a3fb0', live ? T / 5000 : 0, 5);
        if (!small) label(x, y + r * 1.25, chap[b.ci].name + ' / giant with moons', al);
      } else if (b.k === 'moon') {
        var g = bodies.filter(function (o) { return o.k === 'giant' && o.ci === b.ci; })[0];
        if (g && !small && g.on) {
          var rad = Math.hypot(x - g.x, b.y - g.y);
          ctx.strokeStyle = hexA(dark ? ink : '#8a3fb0', dark ? 0.13 : 0.3); ctx.lineWidth = 1; if (!dark) ctx.setLineDash([2, 5]);
          disc(g.x, g.y, rad); ctx.stroke(); ctx.setLineDash([]);
        }
        ball(x, y, r, MOON, '#8a3fb0', 0, 7 + b.i);
      } else if (b.k === 'pulsar') {
        pulsar(x, y, r, al, li, live);
        if (!small) label(x, y + Math.min(r * 1.6, 200), chap[b.ci].name + ' / pulsar signal', al);
      } else if (b.k === 'const') {
        if (reduceMq.matches && !small) nebula(x, y, r, al, 0, li);
        else { nebula(W * 0.72, H * 0.1, small ? 70 : W * 0.17, al, 0, li); nebula(W * 0.26, H * 0.97, small ? 60 : W * 0.15, al, 0, li); }
      }
      ctx.globalAlpha = 1;
    }

    // ---- one frame
    function draw(dt) {
      var live = isLive();
      var top = window.scrollY || 0;
      var docH = Math.max(1, document.documentElement.scrollHeight - H);
      var p = clamp(top / docH, 0, 1);
      var i;
      // the camera: velocity follows scroll, warp is a short boost after a click on a link to a section
      if (live) {
        vel += ((top - lastSy) / Math.max(dt, 1) - vel) * 0.2;
        warp = Math.max(0, warp - dt / 950);
      } else { vel = 0; warp = 0; }
      lastSy = top;
      // chapter palette mixes between neighbouring chapters as you fly
      var fi = 0;
      var mid = top + H * 0.5;
      for (; fi < chap.length - 1 && chap[fi + 1].top <= mid; fi++);
      var c = chap[fi];
      var nx = chap[fi + 1];
      var t = c ? clamp((mid - c.top) / Math.max(1, (nx ? nx.top : c.bot) - c.top), 0, 1) : 0;
      var g0 = (CH[c && c.id] || CH.home).g;
      var g1 = (CH[nx && nx.id] || CH[c && c.id] || CH.home).g;
      var ga = mix(g0[0], g1[0], t);
      var gb = mix(g0[1], g1[1], t);

      ctx.clearRect(0, 0, W, H);
      if (dark) { glow(ctx, W * 0.8, H * 0.28, Math.max(W, H) * 0.6, ga, 0.2); glow(ctx, W * 0.1, H * 0.95, Math.max(W, H) * 0.55, gb, 0.16); } else { glow(ctx, W * 0.82, H * 0.2, Math.max(W, H) * 0.6, mix(ga, '#ffffff', 0.4), 0.14); }
      // polar graticule, rolled by the distance flown
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(p * 1.3);
      var R = Math.hypot(W, H) / 2;
      ctx.strokeStyle = hexA(dark ? ink : '#2f5fd0', dark ? 0.07 : 0.2); ctx.lineWidth = 1;
      if (!dark) ctx.setLineDash([2, 6]);
      [0.2, 0.4, 0.65, 0.95].forEach(function (f) { disc(0, 0, R * f); ctx.stroke(); });
      ctx.setLineDash([]);
      ctx.beginPath();
      for (i = 0; i < 12; i++) { var a = i / 12 * TAU; ctx.moveTo(Math.cos(a) * R * 0.2, Math.sin(a) * R * 0.2); ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R); }
      ctx.stroke();
      ctx.restore();

      // stars
      var K = Math.max(W, H) * 0.07;
      var dz = live ? -(0.00003 + vel * 0.00026 + warp * 0.0036) * dt : 0;
      var trail = live ? Math.min(0.45, Math.abs(dz) * (dt > 0 ? 190 / Math.max(dt, 8) : 0)) : 0;
      var cx = W / 2;
      var cy = H / 2;
      ctx.lineCap = 'round';
      for (i = 0; i < N; i++) {
        if (live) sz[i] += dz;
        if (sz[i] < 0.05) respawn(i, 1);
        else if (sz[i] > 1.05) respawn(i, 2);
        var z = sz[i];
        var px = cx + sx[i] * K / z;
        var py = cy + sy[i] * K / z;
        if (px < -20 || px > W + 20 || py < -20 || py > H + 20) { if (live) respawn(i, dz > 0 ? 2 : 1); continue; }
        var near = 1 - z;
        var al = clamp(near * 1.3 + 0.12, 0, 1) * (dark ? 0.95 : 0.6);
        if (live) al *= 0.78 + 0.22 * Math.sin(T / 600 * (1 + (i % 5) * 0.3) + i);
        var col = sc[i] ? (dark ? pal.b : '#2f5fd0') : ink;
        if (live && trail > 0.004) {
          var z2 = clamp(z + (dz < 0 ? trail : -trail), 0.03, 1.2);
          ctx.strokeStyle = hexA(col, al); ctx.lineWidth = 0.6 + near * 1.4;
          ctx.beginPath(); ctx.moveTo(cx + sx[i] * K / z2, cy + sy[i] * K / z2); ctx.lineTo(px, py); ctx.stroke();
        } else {
          var rs = (0.5 + near * 1.5) * (dark ? 1 : 0.85);
          ctx.fillStyle = hexA(col, al); disc(px, py, rs); ctx.fill();
          if (!dark && rs > 1.5) { ctx.strokeStyle = hexA(col, al * 0.8); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(px - 4, py); ctx.lineTo(px + 4, py); ctx.moveTo(px, py - 4); ctx.lineTo(px, py + 4); ctx.stroke(); }
        }
      }
      if (warp > 0.02) glow(ctx, cx, cy, Math.max(W, H) * 0.5, dark ? '#bcd0ff' : '#2f5fd0', 0.28 * warp);

      if (live && dark && !shoot && T > nextShoot) { shoot = { x: W * (0.45 + rnd() * 0.55), y: H * rnd() * 0.4, t: T }; nextShoot = T + 9000 + rnd() * 7000; }
      if (shoot) {
        var sp = (T - shoot.t) / 900;
        if (sp >= 1) shoot = null; else {
          var qx = shoot.x - sp * 240;
          var qy = shoot.y + sp * 120;
          var lg = ctx.createLinearGradient(qx, qy, qx + 90, qy - 45);
          lg.addColorStop(0, hexA(ink, (1 - sp) * 0.9)); lg.addColorStop(1, hexA(ink, 0));
          ctx.strokeStyle = lg; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(qx + 90, qy - 45); ctx.stroke();
        }
      }

      // bodies, far ones first; the flight path joins the project planets
      var vis = [];
      bodies.forEach(function (b) { put(b, top, live); if (b.on) vis.push(b); });
      vis.sort(function (a2, b2) { return b2.depth - a2.depth; });
      var fleet = vis.filter(function (b) { return b.k === 'planet'; });
      if (fleet.length > 1) {
        ctx.strokeStyle = hexA(dark ? ink : '#6a4cc4', dark ? 0.16 : 0.4); ctx.lineWidth = 1; ctx.setLineDash([3, 6]);
        ctx.beginPath();
        fleet.forEach(function (b, n) { if (n) ctx.lineTo(b.x, b.y); else ctx.moveTo(b.x, b.y); });
        ctx.stroke(); ctx.setLineDash([]);
      }
      var nearest = null;
      var best = 1e9;
      fleet.forEach(function (b) { var dd = Math.abs(b.y - H * 0.5); if (dd < best) { best = dd; nearest = b; } });
      vis.forEach(function (b) { drawBody(b, live, b === nearest || (b.el && b.el.open)); });
      ctx.textAlign = 'start';

      updateReadout(p, fi);
    }

    function updateReadout(p, fi) {
      if (!readout) return;
      var c = chap[fi];
      var hh = Math.floor(p * 24);
      var mm = Math.floor((p * 24 - hh) * 60);
      var dec = Math.round(Math.sin(p * TAU) * 35);
      var k = fi + '|' + hh + '|' + mm + '|' + dec + '|' + Math.round(p * 1000) + '|' + (warp > 0.05 ? 1 : 0);
      if (k === key) return;
      key = k;
      readout.sys.textContent = 'SYS ' + two(fi + 1) + '/' + two(chap.length) + ' ' + (c ? c.name : '');
      readout.ra.textContent = 'RA ' + two(hh) + 'h ' + two(mm) + 'm  DEC ' + (dec < 0 ? '-' : '+') + two(Math.abs(dec)) + '°';
      readout.dist.textContent = 'TRAVELLED ' + (p * 100).toFixed(1) + ' ly';
      readout.fill.style.transform = 'scaleX(' + p.toFixed(3) + ')';
      if (warp > 0.05) readout.box.classList.add('cs-warp'); else readout.box.classList.remove('cs-warp');
    }

    var loop = makeLoop(function (dt, t) {
      T = t;
      var calm = Math.abs(vel) < 0.02 && warp === 0;
      var gap = small || coarseMq.matches ? 32 : calm ? 30 : 0;
      if (gap && t - lastDraw < gap) return;
      var d2 = lastDraw ? t - lastDraw : dt;
      lastDraw = t;
      draw(Math.min(60, d2));
    });
    function once() { if (!loop.running()) draw(16); }
    function onScroll() {
      if (loop.running() || queued) return;
      queued = requestAnimationFrame(function () { queued = 0; once(); });
      lazyMeasure();
    }
    function begin() { if (isLive() && !document.hidden) loop.start(); else { loop.stop(); once(); } }

    // ---- the orrery: the same links as the menu, one dot per chapter in that chapter's colour
    function buildOrrery() {
      var box = el('nav', 'cs-orrery');
      box.setAttribute('aria-label', 'Orrery: jump to a section');
      var svg = sv('svg', { viewBox: '0 0 160 160', focusable: 'false' });
      var radii = [20, 36, 52, 68];
      radii.forEach(function (r) { svg.appendChild(sv('circle', { cx: 80, cy: 80, r: r, class: 'cs-orrery__ring' })); });
      svg.appendChild(sv('circle', { cx: 80, cy: 80, r: 8, class: 'cs-orrery__sun' }));
      list.forEach(function (s, i) {
        var ang = i * 2.4 + 0.6;
        var r = radii[i % 4];
        var a = sv('a', { href: '#' + s.id, class: 'cs-orrery__planet cs-o-' + s.id, 'data-id': s.id, 'aria-label': s.getAttribute('data-section') || s.id });
        a.appendChild(sv('circle', { cx: (80 + Math.cos(ang) * r).toFixed(1), cy: (80 + Math.sin(ang) * r).toFixed(1), r: 5 }));
        var tt = sv('title', {});
        tt.textContent = s.getAttribute('data-section') || s.id;
        a.appendChild(tt);
        svg.appendChild(a);
      });
      box.appendChild(svg);
      return tk.node(box);
    }
    function buildReadout() {
      var box = el('aside', 'cs-readout');
      box.setAttribute('aria-hidden', 'true');
      var o = { box: box, sys: el('span', 'cs-readout__sys'), ra: el('span', 'cs-readout__row'), dist: el('span', 'cs-readout__row'), fill: el('i', 'cs-readout__fill') };
      var bar = el('i', 'cs-readout__bar');
      bar.appendChild(o.fill);
      [o.sys, o.ra, o.dist, bar].forEach(function (n) { box.appendChild(n); });
      tk.node(box);
      return o;
    }

    // ---- a line and stars through each skill group (kept from the first Cosmos Edition, now drawn on the slates)
    function clearConstellations() { made.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); }); made = []; }
    function constellations(instant) {
      var JIT = [6, 34, 12, 42, 18, 38, 8, 30];
      document.querySelectorAll('#skills .skill-list').forEach(function (ul) {
        if (ul.offsetParent === null) return;
        tk.cls(ul, 'cs-const-list');
        var h = ul.offsetHeight;
        var pts = [];
        ul.querySelectorAll('li').forEach(function (li, i) { pts.push({ x: JIT[i % JIT.length], y: li.offsetTop + li.offsetHeight / 2, l: parseInt(li.getAttribute('data-level'), 10) || 2 }); });
        if (pts.length < 2) return;
        var svg = sv('svg', { class: 'cs-const', width: '48', height: String(h), viewBox: '0 0 48 ' + h, 'aria-hidden': 'true', focusable: 'false' });
        var path = sv('path', { class: 'cs-const__line', d: pts.map(function (q2, i) { return (i ? 'L' : 'M') + q2.x + ' ' + q2.y.toFixed(1); }).join(' ') });
        svg.appendChild(path);
        pts.forEach(function (q2) { svg.appendChild(sv('circle', { class: 'cs-const__star', cx: q2.x, cy: q2.y.toFixed(1), r: (1.4 + q2.l * 0.6).toFixed(1) })); });
        tk.node(svg, ul);
        made.push(svg);
        var len = path.getTotalLength();
        path.style.strokeDasharray = String(len);
        path.style.strokeDashoffset = (instant || reduceMq.matches) ? '0' : String(len);
        ul._csPath = path;
        if (lit && !instant) lit.observe(ul);
      });
    }

    return {
      start: function () {
        size();
        readTheme();
        build();
        measure();
        orrery = buildOrrery();
        readout = buildReadout();
        lit = tk.observer(new IntersectionObserver(function (entries) {
          entries.forEach(function (e) { if (e.isIntersecting && e.target._csPath) { e.target._csPath.style.strokeDashoffset = '0'; lit.unobserve(e.target); } });
        }, { threshold: 0.3 }));
        constellations(false);
        tk.on(window, 'scroll', onScroll, { passive: true });
        // A click on a link to a section sends the camera into warp (the page itself scrolls smoothly).
        tk.on(document, 'click', function (e) {
          var a = e.target.closest && e.target.closest('a[href^="#"]');
          if (a && a.getAttribute('href').length > 1 && isLive()) warp = 1;
        }, true);
        tk.on(document, 'visibilitychange', begin);
        var ro = tk.observer(new ResizeObserver(lazyMeasure));
        var main = document.getElementById('main');
        if (main) ro.observe(main);
        var vis = tk.observer(new IntersectionObserver(function (es) { if (es[0].isIntersecting) begin(); else loop.stop(); }));
        vis.observe(canvas);
        document.fonts && document.fonts.ready && document.fonts.ready.then(lazyMeasure);
        begin();
      },
      setMotion: function () { begin(); },
      setActive: function (id) {
        active = id;
        if (!orrery) return;
        orrery.querySelectorAll('.cs-orrery__planet').forEach(function (a) { a.classList.toggle('cs-here', a.getAttribute('data-id') === id); });
      },
      resize: function () {
        size();
        measure();
        clearConstellations();
        constellations(true);
        key = '';
        begin();
        if (!loop.running()) once();
      },
      recolor: function () { readTheme(); if (!loop.running()) once(); },
      destroy: function () {
        loop.stop();
        clearTimeout(measureT);
        if (queued) cancelAnimationFrame(queued);
        made.forEach(function (n) { delete n._csPath; });
        document.querySelectorAll('#skills .skill-list').forEach(function (ul) { delete ul._csPath; });
        tk.undo();
      },
    };
  }

  P.register('cosmos-plus', {
    label: 'Cosmos Edition', xp: 'kt-cosmos-xp', word: 'sector ', engine: cosmosEngine, pausable: true,
    note: 'Cosmos Edition: a complete redesign. Fly through a universe, one system per chapter: a star, a home world, a ringed giant, a planet for every project, constellations, moons and a pulsar. Scroll to fly; a menu click warps. Daylight mode is a star chart in line art.',
  });
})();
