/* Swiss Edition: "Sheet Atlas" (the + beside Swiss in the Style lab; style name swiss-plus). Lazy-loaded by editions-plus.js on first entry;
   styles: edition-swiss.css. Registered with the shared engine, which handles entering (swarm), the HUD, Pause and Leave.
   The page becomes a series of International Typographic Style poster sheets seen through one fixed frame: a visible 12 x 8 grid with crop and
   registration marks, coordinate labels A1 to L8, an index rail, a footer caption and one red circle that moves to a named grid cell on every
   sheet. Experience is a timeline drawn to scale (years parsed from the dates already on the page), Skills are bars scaled to the data-level,
   Projects an index with the open project on the right half, Education four cells, Contact giant links. Press G for the coordinates.
   Every word comes from text already on the page; the rest is chrome. destroy() removes everything this file added. Classic script.
   Styles are set through classes and CSSOM only (the CSP blocks style attributes). Prefix rule: new classes and attributes start with sx-. */
(function () {
  var P = window.PlusEditions;
  if (!P) return;
  var U = P.util;
  var el = U.el;
  var root = document.documentElement;
  // The framed, snapping version needs room and motion; phones and reduced motion get the same sheets stacked in one column.
  var LIVE = window.matchMedia('(min-width: 961px) and (prefers-reduced-motion: no-preference)');
  var COLS = 'ABCDEFGHIJKL';
  var AX0 = 2020; // the timeline axis runs from the start of 2020 to the end of 2026
  var AX1 = 2027;
  var MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  // Where the red circle sits on each sheet: centre column and row in grid units (12 x 8) and its diameter in rows.
  var DOT = {
    home: [10.3, 2, 4], about: [1.6, 6.3, 3], experience: [6.5, 0.9, 1.6], projects: [11, 0.95, 1.8],
    skills: [10.2, 0.95, 1.8], education: [4.6, 0.95, 1.8], contact: [1.5, 6.6, 2.4],
  };
  var DOT_OTHER = [1.5, 6.7, 2.6];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function txt(n) { return n ? (n.textContent || '').replace(/\s+/g, ' ').trim() : ''; }
  function cell(x, y) { return COLS.charAt(Math.max(0, Math.min(11, Math.floor(x)))) + (Math.max(0, Math.min(7, Math.floor(y))) + 1); }
  function numOf(s) { var t = txt(s.querySelector('.section__num')); return /^\d+$/.test(t) ? t : (s.id === 'home' ? '00' : '+'); }
  function hide(n) { n.setAttribute('aria-hidden', 'true'); return n; }

  // "Jul 2026" is 2026.5 and "2020" is 2020.0; as the end of a range a bare year runs to its December.
  function point(t, end) {
    var m = t.match(/(?:([A-Za-z]{3})[a-z]*\.?\s+)?((?:19|20)\d\d)/);
    if (!m) return null;
    var mi = m[1] ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
    var y = +m[2];
    if (mi < 0) return end ? y + 1 : y;
    return y + (mi + (end ? 1 : 0)) / 12;
  }
  // Reads "Jan 2021 – Present" into { s, e, open } on the axis; null when the text holds no year.
  function span(text) {
    var parts = text.split(/\s*[–—-]\s*/);
    var s = point(parts[0], false);
    if (s === null) return null;
    var open = parts.length > 1 && /present|now|current/i.test(parts[1]);
    var e = open ? AX1 : point(parts[parts.length > 1 ? 1 : 0], true);
    if (e === null) return null;
    s = Math.max(AX0, Math.min(AX1, s));
    e = Math.max(AX0, Math.min(AX1, e));
    if (e <= s) e = Math.min(AX1, s + 0.06);
    return { s: s, e: e, open: open };
  }
  function pct(v) { return ((v - AX0) / (AX1 - AX0)) * 100; }

  P.register('swiss-plus', {
    label: 'Swiss Edition', xp: 'kt-swiss-xp', word: 'sheet ', canvas: false, pausable: true,
    note: 'Swiss Edition: a complete redesign, the Sheet Atlas. Every section is a numbered poster sheet on a visible 12 by 8 grid with crop marks, coordinates and one red circle that moves to a named cell. Press G for the grid coordinates.',
    engine: function (c, list) {
      var T = U.track();
      var body = document.body;
      var nums = list.map(numOf);
      var total = 0;
      nums.forEach(function (n) { if (/^\d+$/.test(n) && +n > total) total = +n; });
      function name(i) { return list[i].getAttribute('data-section') || list[i].id; }
      function caption(i) { return 'Sheet ' + (nums[i] === '+' ? '+' : nums[i] + ' / ' + pad(total)) + ', ' + name(i) + ', grid 12 × 8'; }

      T.cls(root, 'sx-on');

      /* ---------- every chapter is a sheet; each carries its own caption for the stacked (phone, reduced motion) version ---------- */
      list.forEach(function (s, i) {
        T.cls(s, 'sx-sheet');
        T.attr(s, 'data-sx-n', nums[i]);
        var wrap = s.querySelector(':scope > .wrap');
        if (wrap) T.node(hide(el('p', 'sx-tag', caption(i))), wrap, wrap.firstChild);
      });

      /* ---------- the cover is a poster: a measurement ruler runs along the bottom ---------- */
      var home = document.getElementById('home');
      var homeWrap = home && home.querySelector(':scope > .wrap');
      if (homeWrap) {
        var ruler = hide(el('div', 'sx-ruler'));
        for (var k = 1; k <= 12; k++) ruler.appendChild(el('span', '', pad(k)));
        T.node(ruler, homeWrap);
      }

      /* ---------- Experience: a timeline drawn to scale, 2020 to 2026, from the dates already on each job ---------- */
      var jobsEl = document.querySelector('#experience .jobs');
      if (jobsEl) {
        var axis = hide(el('ol', 'sx-axis'));
        for (var y = AX0; y < AX1; y++) axis.appendChild(el('li', '', String(y)));
        T.node(axis, jobsEl, jobsEl.firstChild);
        [].forEach.call(jobsEl.querySelectorAll('.job'), function (job, i) {
          var sp = span(txt(job.querySelector('.job__date')));
          if (!sp) return;
          var head = job.querySelector('.job__head');
          var lane = hide(el('div', 'sx-lane'));
          var bar = el('i', 'sx-bar' + (sp.open ? ' sx-bar--open' : '') + (i === 0 ? ' sx-bar--now' : ''));
          bar.style.setProperty('--sx-s', pct(sp.s).toFixed(2) + '%');
          bar.style.setProperty('--sx-w', (pct(sp.e) - pct(sp.s)).toFixed(2) + '%');
          lane.appendChild(bar);
          T.node(lane, job, head ? head.nextSibling : job.firstChild);
          T.prop(job, '--sx-s', pct(sp.s).toFixed(2) + '%');
          if (pct(sp.s) > 55) T.cls(job, 'sx-late');
        });
      }

      /* ---------- Projects: an index; the open project's detail takes the right half of the sheet (one open at a time) ---------- */
      var projs = [].slice.call(document.querySelectorAll('#projects .project'));
      var was = projs.map(function (d) { return d.open; });
      projs.forEach(function (d) {
        var bodyEl = d.querySelector('.project__body');
        var idx = txt(d.querySelector('.project__idx'));
        if (bodyEl && idx) T.node(hide(el('span', 'sx-big', idx)), bodyEl, bodyEl.firstChild);
        function only() { if (d.open) projs.forEach(function (o) { if (o !== d && o.open) o.open = false; }); }
        var sum = d.querySelector('summary');
        // A click closes the others at once (the toggle event comes a task later and covers the keyboard and script cases).
        if (sum) T.on(sum, 'click', function () { if (!d.open) projs.forEach(function (o) { if (o !== d && o.open) o.open = false; }); });
        T.on(d, 'toggle', only);
      });
      if (projs[0] && LIVE.matches && !projs.some(function (d) { return d.open; })) projs[0].open = true;

      /* ---------- Education: four cells, each labelled with the grid cell it sits in ---------- */
      [].forEach.call(document.querySelectorAll('#education .edu__item'), function (item, i) {
        T.attr(item, 'data-sx-c', COLS.charAt(Math.min(i, 3) * 3) + '3');
      });

      /* ---------- the grid: 96 real cells (hairlines, coordinates on G), a column highlight, and the red circle ---------- */
      var grid = hide(el('div', 'sx-grid'));
      for (var r = 0; r < 8; r++) for (var q = 0; q < 12; q++) {
        var cellEl = el('i', 'sx-cell');
        cellEl.setAttribute('data-sx-c', COLS.charAt(q) + (r + 1));
        grid.appendChild(cellEl);
      }
      grid.appendChild(el('i', 'sx-hlc'));
      grid.appendChild(el('i', 'sx-hlx'));
      T.node(grid, body, body.firstChild);
      var dotbox = hide(el('div', 'sx-dotbox'));
      var dot = el('i', 'sx-dot');
      dotbox.appendChild(dot);
      T.node(dotbox, body, body.firstChild);

      /* ---------- the frame: window, crop and registration marks, axis letters and numbers, caption ---------- */
      var chrome = hide(el('div', 'sx-chrome'));
      chrome.appendChild(el('div', 'sx-win'));
      ['tl', 'tr', 'bl', 'br'].forEach(function (p) { chrome.appendChild(el('i', 'sx-crop sx-crop--' + p)); });
      ['b', 'r'].forEach(function (p) { chrome.appendChild(el('i', 'sx-reg sx-reg--' + p)); });
      var axx = el('div', 'sx-axx');
      for (var a = 0; a < 12; a++) axx.appendChild(el('span', '', COLS.charAt(a)));
      var axy = el('div', 'sx-axy');
      for (var b = 1; b <= 8; b++) axy.appendChild(el('span', '', String(b)));
      chrome.appendChild(axx);
      chrome.appendChild(axy);
      var cap = el('p', 'sx-cap');
      var capSheet = el('b', 'sx-cap__a');
      var capDot = el('span', 'sx-cap__b');
      var capCur = el('span', 'sx-cap__c', 'Cursor –');
      var capKey = el('span', 'sx-cap__k');
      capKey.appendChild(el('kbd', '', 'G'));
      capKey.appendChild(document.createTextNode(' coordinates'));
      [capSheet, capDot, capCur, capKey].forEach(function (n) { cap.appendChild(n); });
      chrome.appendChild(cap);
      T.node(chrome, body);

      /* ---------- the index rail: real links to every sheet ---------- */
      var rail = el('nav', 'sx-rail');
      rail.setAttribute('aria-label', 'Sheet index');
      var links = list.map(function (s, i) {
        var a2 = el('a', 'sx-rail__a');
        a2.href = '#' + s.id;
        a2.appendChild(el('b', '', nums[i]));
        a2.appendChild(el('span', '', name(i)));
        rail.appendChild(a2);
        return a2;
      });
      var footer = document.querySelector('.footer');
      T.node(rail, footer ? footer.parentNode : body, footer || null);

      /* ---------- the red circle and the caption follow the sheet in view ---------- */
      function place(id) {
        var i = 0;
        for (var j = 0; j < list.length; j++) if (list[j].id === id) i = j;
        var d = DOT[id] || DOT_OTHER;
        dot.style.setProperty('--sx-dx', String(d[0]));
        dot.style.setProperty('--sx-dy', String(d[1]));
        dot.style.setProperty('--sx-ds', String(d[2]));
        capSheet.textContent = caption(i);
        capDot.textContent = 'Red circle ' + cell(d[0], d[1]);
        links.forEach(function (l, n) {
          l.classList.toggle('sx-here', n === i);
          if (n === i) l.setAttribute('aria-current', 'location'); else l.removeAttribute('aria-current');
        });
      }
      place(list.length ? list[0].id : 'home');

      /* ---------- signature: hover or focus a cell and its column lights up; G toggles the coordinates ---------- */
      var raf = 0;
      var px = 0;
      var py = 0;
      function off() { grid.classList.remove('sx-hot'); capCur.textContent = 'Cursor –'; }
      function show(x, y) {
        var rc = grid.getBoundingClientRect();
        if (!LIVE.matches || rc.width < 10) { off(); return; }
        var ci = Math.floor(((x - rc.left) / rc.width) * 12);
        var ri = Math.floor(((y - rc.top) / rc.height) * 8);
        if (ci < 0 || ci > 11 || ri < 0 || ri > 7) { off(); return; }
        grid.style.setProperty('--sx-hc', String(ci + 1));
        grid.style.setProperty('--sx-hr', String(ri + 1));
        grid.classList.add('sx-hot');
        capCur.textContent = 'Cursor ' + COLS.charAt(ci) + (ri + 1);
      }
      T.on(document, 'pointermove', function (e) {
        px = e.clientX;
        py = e.clientY;
        if (!raf) raf = requestAnimationFrame(function () { raf = 0; show(px, py); });
      }, { passive: true });
      T.on(root, 'mouseleave', off);
      T.on(document, 'focusin', function (e) {
        var t = e.target;
        if (!t || !t.getBoundingClientRect) return;
        var rc = t.getBoundingClientRect();
        show(rc.left + Math.min(rc.width / 2, 60), rc.top + Math.min(rc.height / 2, 24));
      });
      T.on(document, 'keydown', function (e) {
        if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || String(e.key).toLowerCase() !== 'g') return;
        var t = e.target;
        if (t && (/^(input|textarea|select)$/i.test(t.tagName) || t.isContentEditable)) return;
        root.classList.toggle('sx-coords');
      });

      return {
        start: function () {},
        setActive: place,
        resize: function () { off(); },
        destroy: function () {
          if (raf) cancelAnimationFrame(raf);
          T.undo();
          root.classList.remove('sx-coords');
          projs.forEach(function (d, i) { d.open = was[i]; });
        },
      };
    },
  });
})();
