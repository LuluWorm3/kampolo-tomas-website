/* Bauhaus Edition: "Werkstatt" (the + beside Bauhaus in the Style lab). Lazy-loaded by editions-plus.js on first entry; styles: edition-bauhaus.css.
   Registered with the shared engine, which handles entering (swarm), the HUD with Pause and Leave. The page becomes a workshop and a curriculum:
   a fixed drafting board holds fourteen geometric pieces (bars, circles, squares, triangles) that assemble, linked to the scroll, into a pictogram for
   every chapter. Each piece is a real button: activating one re-composes the picture (colours turn, the picture mirrors). A contents strip of the
   six finished pictograms links to the chapters. Phones and reduced motion get no fixed board and no scroll-linked assembly: every chapter opens with
   its finished pictogram as a static header. All words come from text already on the page. destroy() removes everything added (track()).
   Classic script. Styles are set through classes and CSSOM only (the CSP blocks style attributes). Prefix rule: new classes and attributes start with bh-. */
(function () {
  var P = window.PlusEditions;
  if (!P) return;
  var U = P.util;
  var el = U.el;
  var sv = U.sv;
  var reduce = U.reduce;
  var phone = window.matchMedia('(max-width: 720px)');
  var root = document.documentElement;

  // Fourteen pieces, bars first so they lie behind the rest: 3 bars, 2 circles, 7 squares, 2 triangles.
  var KINDS = ['b', 'b', 'b', 'c', 'c', 's', 's', 's', 's', 's', 's', 's', 't', 't'];
  var KNAME = { b: 'Bar', c: 'Circle', s: 'Square', t: 'Triangle' };
  var SHIFT = { r: 'b', b: 'y', y: 'r' };

  // Each form: [piece, x, y, width, height, degrees, colour] on a 100 x 100 board; width and height are in tens (a piece is 10 wide at 1).
  // r red, b blue, y yellow, k ink. Pieces a form does not use wait in the parts tray along the board's top and bottom edges.
  var FORMS = {
    home: ['trio', [[3, 32, 38, 5.6, 5.6, 0, 'r'], [5, 72, 32, 4.4, 4.4, 0, 'b'], [12, 54, 70, 5, 4.2, 0, 'y'], [0, 50, 60, 9.6, 0.35, -8, 'k'], [4, 80, 76, 1.8, 1.8, 0, 'k'], [6, 14, 80, 1.5, 1.5, 45, 'b']]],
    about: ['circle in square', [[5, 50, 50, 8, 8, 0, 'b'], [3, 50, 50, 5.2, 5.2, 0, 'r'], [4, 50, 50, 1.8, 1.8, 0, 'y'], [6, 83, 83, 1.6, 1.6, 0, 'y']]],
    experience: ['stairs', [[0, 50, 90, 9.4, 0.3, 0, 'k'], [5, 20, 76, 2.5, 2.5, 0, 'y'], [6, 49, 76, 2.5, 2.5, 0, 'b'], [7, 49, 47, 2.5, 2.5, 0, 'b'], [8, 78, 76, 2.5, 2.5, 0, 'r'], [9, 78, 47, 2.5, 2.5, 0, 'r'], [10, 78, 18, 2.5, 2.5, 0, 'r'], [3, 20, 53, 1.6, 1.6, 0, 'k']]],
    projects: ['stacked blocks', [[5, 50, 80, 8, 2.2, 0, 'b'], [6, 34, 52, 3.2, 3.2, 0, 'r'], [7, 66, 57, 2.4, 2.4, 0, 'y'], [8, 34, 26, 2, 2, 0, 'k'], [12, 66, 33, 2.4, 2, 0, 'r'], [3, 84, 61, 1.6, 1.6, 0, 'k']]],
    skills: ['square chart', null],
    education: ['rising triangle', [[0, 50, 90, 9.4, 0.3, 0, 'k'], [12, 50, 52, 8, 7.2, 0, 'y'], [13, 50, 66, 4.4, 3.9, 0, 'r'], [4, 50, 11, 1.3, 1.3, 0, 'k']]],
    contact: ['circle and line', [[0, 60, 41, 6, 0.5, -30, 'k'], [3, 34, 56, 6, 6, 0, 'r'], [4, 86, 26, 1.8, 1.8, 0, 'b'], [5, 14, 16, 1.6, 1.6, 0, 'y']]],
  };
  var ORDER = ['about', 'experience', 'projects', 'skills', 'education', 'contact'];

  // Where a piece waits: in the parts tray along the board's top and bottom edges (a piece the picture does not use), or tumbling across the
  // board (every piece, between two pictures, so a chapter change looks like the pieces being swept up and dealt out again).
  var rnd = U.mulberry(21);
  var TRAY = KINDS.map(function (k, i) {
    return { x: 6.5 + i * 6.7, y: i % 2 ? 95.5 : 4.5, sx: k === 'b' ? 2 : 0.9, sy: k === 'b' ? 0.25 : 0.9, r: Math.round(rnd() * 160 - 80), c: 'x' };
  });
  var SCATTER = KINDS.map(function (k) {
    return { x: 14 + rnd() * 72, y: 16 + rnd() * 68, sx: k === 'b' ? 3.4 : 1.5 + rnd() * 0.6, sy: k === 'b' ? 0.4 : 1.5 + rnd() * 0.6, r: Math.round(rnd() * 180 - 90), c: 'x' };
  });

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function txt(n) { return n ? (n.textContent || '').replace(/\s+/g, ' ').trim() : ''; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(t) { return t * t * (3 - 2 * t); }
  function r2(v) { return Math.round(v * 100) / 100; }

  // The squares of the Skills chart are sized by the levels already on the page (first skill group), so the picture is the data.
  function levelsOf() {
    var out = [];
    var g = document.querySelector('#skills .skill-list');
    if (g) [].forEach.call(g.children, function (li) { var v = parseInt(li.getAttribute('data-level'), 10); if (v > 0 && v <= 5) out.push(v); });
    return out.length ? out.slice(0, 7) : [4, 4, 4, 3, 3, 3, 2];
  }
  function skillsForm(levels) {
    var f = [[0, 50, 82, 9.6, 0.3, 0, 'k'], [1, 50, 62, 9.6, 0.1, 0, 'k'], [2, 50, 44, 9.6, 0.1, 0, 'k']];
    var sizes = levels.map(function (l) { return l * 3.6; });
    var total = sizes.reduce(function (a, b) { return a + b; }, 0) + (sizes.length - 1) * 1.2;
    var x = (100 - total) / 2;
    sizes.forEach(function (w, i) {
      f.push([5 + i, x + w / 2, 80 - w / 2, w / 10, w / 10, 0, levels[i] > 3 ? 'r' : levels[i] > 2 ? 'b' : 'y']);
      x += w + 1.2;
    });
    return f;
  }
  // The finished layout of a chapter as fourteen slots (a piece the picture does not use is null).
  function formOf(id, levels) {
    var def = FORMS[id] || FORMS.home;
    var rows = id === 'skills' ? skillsForm(levels) : def[1];
    var out = [];
    for (var i = 0; i < KINDS.length; i++) out.push(null);
    rows.forEach(function (a) { out[a[0]] = { x: a[1], y: a[2], sx: a[3], sy: a[4], r: a[5], c: a[6] }; });
    return out;
  }
  function kindOf(id) { return (FORMS[id] || FORMS.home)[0]; }

  // Playing re-composes a picture: the primary colours turn (n mod 3) and the picture mirrors on odd turns.
  function turned(s, n) {
    var c = s.c;
    for (var k = 0; k < n % 3; k++) if (SHIFT[c]) c = SHIFT[c];
    var m = n % 2 === 1;
    return { x: m ? 100 - s.x : s.x, y: s.y, sx: s.sx, sy: s.sy, r: m ? -s.r : s.r, c: c };
  }

  // A finished pictogram as SVG (for the contents strip and the static headers). Decorative.
  function pictogram(id, cls, levels) {
    var svg = sv('svg', { viewBox: '0 0 100 100', 'class': cls, 'aria-hidden': 'true', focusable: 'false' });
    formOf(id, levels).forEach(function (s, i) {
      if (!s) return;
      var k = KINDS[i];
      var w = s.sx * 10;
      var h = s.sy * 10;
      var g = sv('g', { transform: 'translate(' + r2(s.x) + ' ' + r2(s.y) + ') rotate(' + s.r + ')', 'class': 'bh-f bh-f--' + s.c });
      var n;
      if (k === 'c') n = sv('ellipse', { cx: 0, cy: 0, rx: r2(w / 2), ry: r2(h / 2) });
      else if (k === 't') n = sv('polygon', { points: '0,' + r2(-h / 2) + ' ' + r2(w / 2) + ',' + r2(h / 2) + ' ' + r2(-w / 2) + ',' + r2(h / 2) });
      else n = sv('rect', { x: r2(-w / 2), y: r2(-h / 2), width: r2(w), height: r2(h) });
      g.appendChild(n);
      svg.appendChild(g);
    });
    return svg;
  }

  P.register('bauhaus-plus', {
    label: 'Bauhaus Edition', xp: 'kt-bauhaus-xp', word: 'Werkstatt ', canvas: false, pausable: true,
    note: 'Bauhaus Edition: a complete redesign, Werkstatt. A drafting board of circles, squares, triangles and bars assembles a pictogram for every chapter as you scroll (circle in square, stairs, stacked blocks, a chart of squares, a rising triangle, a circle and a line), and every shape is a button that re-composes it. Phones and reduced motion get the finished pictograms as static headers.',
    engine: function (c, list) {
      var T = U.track();
      var M = null;
      var alive = true;
      var queued = false;
      var update = function () {};
      var plays = {};
      var levels = levelsOf();
      var hero = document.getElementById('home');

      list.forEach(function (s, i) {
        T.cls(s, 'bh-chapter');
        T.attr(s, 'data-bh-n', pad(i));
        T.attr(s, 'data-bh-kind', kindOf(s.id));
      });
      if (hero) T.cls(hero, 'bh-hero');

      /* ---------- the contents strip: six finished pictograms that link to the chapters (both modes) ---------- */
      var heroWrap = hero && hero.querySelector('.wrap');
      if (heroWrap) {
        var nav = el('nav', 'bh-curr');
        nav.setAttribute('aria-label', 'Werkstatt contents');
        var ol = el('ol', 'bh-curr__list');
        ORDER.forEach(function (id) {
          var s = document.getElementById(id);
          if (!s || list.indexOf(s) < 0) return;
          var li = el('li', 'bh-curr__item');
          var a = el('a', 'bh-curr__link');
          a.href = '#' + id;
          var tile = el('span', 'bh-curr__tile');
          tile.appendChild(pictogram(id, 'bh-curr__svg', levels));
          a.appendChild(tile);
          a.appendChild(el('span', 'bh-curr__n', txt(s.querySelector('.section__num'))));
          a.appendChild(el('span', 'bh-curr__t', txt(s.querySelector('.section__title'))));
          li.appendChild(a);
          ol.appendChild(li);
        });
        nav.appendChild(ol);
        T.node(nav, heroWrap);
      }

      /* ---------- a chapter's caption, read from the page ---------- */
      function caption(i) {
        var s = list[i];
        var num = txt(s.querySelector('.section__num'));
        var title = txt(s.querySelector('.section__title')) || txt(hero && hero.querySelector('.hero__title')).replace(/\.$/, '');
        return { n: s === hero ? 'Werkstatt 00' : 'Werkstatt ' + num, t: s === hero ? 'Home' : title, k: kindOf(s.id) };
      }

      /* ---------- stage mode: the fixed drafting board with scroll-linked assembly ---------- */
      function buildStage(Mk) {
        var forms = list.map(function (s) { return formOf(s.id, levels); });
        var stage = el('div', 'bh-stage');
        var cap = el('p', 'bh-stage__cap');
        cap.setAttribute('aria-hidden', 'true');
        var capN = el('b');
        var capT = el('span');
        cap.appendChild(capN);
        cap.appendChild(capT);
        var board = el('div', 'bh-board');
        board.setAttribute('role', 'group');
        var hint = el('p', 'bh-stage__hint', 'The shapes are buttons: click or press Enter to re-compose the picture.');
        hint.setAttribute('aria-hidden', 'true');
        var live = el('p', 'bh-sr');
        live.setAttribute('role', 'status');
        stage.appendChild(cap);
        stage.appendChild(board);
        stage.appendChild(hint);
        stage.appendChild(live);

        var count = { b: 0, c: 0, s: 0, t: 0 };
        function put(b, s, o) {
          b.style.left = r2(s.x) + '%';
          b.style.top = r2(s.y) + '%';
          b.style.width = r2(s.sx * 10) + '%';
          b.style.height = r2(s.sy * 10) + '%';
          b.style.transform = 'translate(-50%,-50%) rotate(' + r2(s.r) + 'deg)';
          b.style.opacity = r2(o);
          if (b.getAttribute('data-bh-c') !== s.c) b.setAttribute('data-bh-c', s.c);
        }
        var pieces = KINDS.map(function (k, i) {
          count[k]++;
          var b = el('button', 'bh-piece bh-piece--' + k);
          b.type = 'button';
          b.setAttribute('aria-label', KNAME[k] + ' ' + count[k] + ': re-compose the picture');
          b.tabIndex = i ? -1 : 0;
          b.appendChild(el('i', 'bh-shape'));
          put(b, TRAY[i], 0.45);
          board.appendChild(b);
          return b;
        });

        var cur = -1;
        var assembled = '';
        function label(i) { var k = caption(i); return k.n + ', ' + k.t + ', ' + k.k; }
        function show(i) {
          cur = i;
          var k = caption(i);
          capN.textContent = k.n;
          capT.textContent = ' · ' + k.t + ' · ' + k.k;
          board.setAttribute('aria-label', 'Pictogram for ' + k.t + ': ' + k.k + '. Arrow keys move between shapes.');
        }

        update = function () {
          // The anchor line sits high on tall screens so short chapters still hold it; each chapter assembles over a ramp
          // that is never more than a quarter of its own height, so even the shortest one is fully assembled mid-way.
          var vh = window.innerHeight;
          var A = Math.min(vh * 0.5, 420);
          var best = 0;
          var be = -1;
          list.forEach(function (s, k) {
            var r = s.getBoundingClientRect();
            var ramp = Math.max(60, Math.min(vh * 0.36, 220, r.height * 0.25));
            var e = ease(clamp(Math.min((A - r.top) / ramp, (r.bottom - A) / ramp), 0, 1));
            if (e > be) { be = e; best = k; }
          });
          var e = U.motion() ? be : 1;
          if (best !== cur) show(best);
          var n = plays[list[best].id] || 0;
          pieces.forEach(function (b, i) {
            var to = forms[best][i];
            to = to ? turned(to, n) : TRAY[i];
            var f = SCATTER[i];
            var t = ease(clamp(e * 1.5 - 0.5 * (i / 13), 0, 1));
            put(b, { x: f.x + (to.x - f.x) * t, y: f.y + (to.y - f.y) * t, sx: f.sx + (to.sx - f.sx) * t, sy: f.sy + (to.sy - f.sy) * t, r: f.r + (to.r - f.r) * t, c: to.c }, (to.c === 'x' ? 0.8 - 0.4 * t : 0.7 + 0.3 * t));
          });
          var a = e > 0.98 ? '1' : '0';
          if (a !== assembled) { assembled = a; board.setAttribute('data-bh-e', a); }
        };

        function recompose(b) {
          var id = list[cur].id;
          plays[id] = (plays[id] || 0) + 1;
          b.classList.remove('bh-pop');
          void b.offsetWidth;
          b.classList.add('bh-pop');
          live.textContent = '';
          live.textContent = label(cur) + ': re-composed, arrangement ' + (plays[id] % 6 + 1) + ' of 6';
          update();
        }
        pieces.forEach(function (b) { Mk.on(b, 'click', function () { recompose(b); }); });
        Mk.on(board, 'keydown', function (ev) {
          var at = pieces.indexOf(document.activeElement);
          if (at < 0) return;
          var to = at;
          if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') to = (at + 1) % pieces.length;
          else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') to = (at + pieces.length - 1) % pieces.length;
          else if (ev.key === 'Home') to = 0;
          else if (ev.key === 'End') to = pieces.length - 1;
          else return;
          ev.preventDefault();
          pieces[at].tabIndex = -1;
          pieces[to].tabIndex = 0;
          pieces[to].focus();
        });

        Mk.node(stage, document.body, hero);
        void board.offsetWidth;
        update();
      }

      /* ---------- static mode: every chapter opens with its finished pictogram, nothing pinned or scroll-linked ---------- */
      function buildPlates(Mk) {
        list.forEach(function (s) {
          var fig = el('figure', 'bh-plate');
          fig.setAttribute('aria-hidden', 'true');
          fig.appendChild(pictogram(s.id, 'bh-plate__svg', levels));
          var head = s === hero ? s.querySelector('.wrap') : s.querySelector('.section__head');
          if (head) Mk.node(fig, head, head.firstChild);
        });
        update = function () {};
      }

      function applyMode() {
        if (M) M.undo();
        M = U.track();
        var mode = reduce.matches || phone.matches ? 'static' : 'stage';
        M.attr(root, 'data-bh-mode', mode);
        if (mode === 'stage') buildStage(M); else buildPlates(M);
      }
      function schedule() {
        if (queued || !alive) return;
        queued = true;
        requestAnimationFrame(function () { queued = false; if (alive) update(); });
      }

      T.on(window, 'scroll', schedule, { passive: true });
      T.on(phone, 'change', applyMode);
      T.on(reduce, 'change', applyMode);
      applyMode();

      return {
        start: function () { schedule(); },
        setMotion: function () { schedule(); },
        setActive: function () { schedule(); },
        resize: function () { schedule(); },
        destroy: function () {
          alive = false;
          if (M) M.undo();
          M = null;
          T.undo();
        },
      };
    },
  });
})();
