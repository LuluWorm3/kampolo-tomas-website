/* Minimalism Edition, "Less, but better" (the + beside Minimalism in the Style lab). Lazy-loaded by editions-plus.js on first entry; styles: edition-minimal.css.
   Progressive disclosure: every chapter is one screen with one sentence taken from text already on the page (the lead, the intro, or the first line).
   A density control (keys 1, 2, 3) shows only those sentences (Essence), adds headings and dates (Summary) or shows everything (Full). The rest of a
   chapter opens in a sheet: the chapter's own content, lifted by CSS, behind a real disclosure button (aria-expanded, Escape closes, focus returns).
   Nothing is cloned and nothing but a few helper nodes is added; hidden pieces are display:none through classes, and Full is always one key away.
   Registered with the shared engine, which handles entering (swarm), the HUD, Pause and Leave. Classic script. Styles are set through classes and
   CSSOM only (the CSP blocks style attributes). Prefix rule: new classes and attributes start with mn-. */
(function () {
  var P = window.PlusEditions;
  if (!P) return;
  var U = P.util;
  var el = U.el;
  var reduce = U.reduce;
  var root = document.documentElement;

  var MODES = [
    { id: 'essence', label: 'Essence', key: '1', what: 'one sentence for each chapter' },
    { id: 'summary', label: 'Summary', key: '2', what: 'those sentences plus headings and dates' },
    { id: 'full', label: 'Full', key: '3', what: 'everything on the page' },
  ];
  var chosen = 'essence'; // survives leaving and entering again within a visit
  // Pieces Summary keeps next to the sentence: headings, dates, names and the real links.
  var SUM = '.section__head, .hero__meta, .hero__title, .hero__role, .hero__actions, .facts, .job__head, .job__org, .project > summary, .skills__group > h3, .edu__date, .edu__item > h3, .contact__links';
  var FOCUSABLE = 'a[href], button, input, textarea, select, summary, [tabindex]';

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function clean(s) { return s.replace(/\s+/g, ' ').trim(); }
  function firstSentence(s) { var m = s.match(/^.*?[.!?](?=\s|$)/); return m ? m[0] : s; }
  function typing(t) { return !!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable || !!(t.closest && t.closest('.chat'))); }
  function sizeClass(n) { return n <= 60 ? 'mn-s1' : n <= 125 ? 'mn-s2' : 'mn-s3'; }
  function list(root0, sel) { return Array.prototype.slice.call(root0.querySelectorAll(sel)); }

  // The one sentence of a chapter: an element that is already the lead or intro, else a copy of the first real line (Experience, Education).
  function findLead(wrap) {
    var own = wrap.querySelector('.hero__lead, .about__lead, .section__intro');
    if (own) return { node: own, made: false };
    var bullet = wrap.querySelector('.job li');
    var edu = wrap.querySelector('.edu__item > p:last-child');
    var text = bullet ? clean(bullet.textContent) : edu ? firstSentence(clean(edu.textContent)) : '';
    if (!text) {
      var p = wrap.querySelector('p:not(.section__num):not(.form__hp)');
      if (p) return { node: p, made: false };
      return null;
    }
    return { node: el('p', 'mn-gen', text), made: true };
  }

  P.register('minimal-plus', {
    label: 'Minimalism Edition', xp: 'kt-minimal-xp', word: 'chapter ', canvas: false, pausable: true,
    note: 'Minimalism Edition: one sentence for each chapter. Press 1, 2 or 3 (or use the three words at the top right) for Essence, Summary or Full. Details open in a sheet; j and k, or the arrow keys, step between chapters.',
    engine: function (c, chapters) {
      var t = U.track();
      var mode = chosen;
      var cur = 0;
      var opened = null;
      var infos = [];
      var names = [];
      var initialOpen = list(document, 'main details').map(function (d) { return [d, d.open]; });

      // Start where the reader is: the chapter at the middle of the screen.
      var mid = window.innerHeight / 2;
      chapters.forEach(function (s, i) { if (s.getBoundingClientRect().top <= mid) cur = i; });

      /* ---- per chapter: the sentence, what each density hides, the Details button, the sheet's close button */
      chapters.forEach(function (s, i) {
        var wrap = s.querySelector(':scope > .wrap');
        var h2 = s.querySelector('h2');
        var name = s.getAttribute('data-section') || (h2 ? clean(h2.textContent) : s.id);
        names.push(name);
        if (!wrap) { infos.push(null); return; }
        t.cls(s, 'mn-ch');
        t.attr(s, 'aria-label', name);
        t.cls(wrap, 'mn-sheet');
        t.attr(wrap, 'id', 'mn-sheet-' + s.id);

        var found = findLead(wrap);
        var lead = found && found.node;
        if (lead) {
          if (found.made) {
            var head = wrap.querySelector(':scope > .section__head');
            t.node(lead, wrap, head ? head.nextSibling : wrap.firstChild);
          }
          t.cls(lead, 'mn-lead');
          t.cls(lead, sizeClass(clean(lead.textContent).length));
        }

        // Mark the topmost pieces to hide: Essence keeps the sentence, Summary also keeps the headings and dates.
        var keep1 = lead ? [lead] : [];
        var keep2 = keep1.concat(list(wrap, SUM));
        function seen(e, group) { return group.some(function (g) { return g === e || g.contains(e) || e.contains(g); }); }
        var vis1 = new Set([wrap]);
        var vis2 = new Set([wrap]);
        list(wrap, '*').forEach(function (e) {
          var p = e.parentElement;
          var a = seen(e, keep1);
          var b = a || seen(e, keep2);
          if (a) vis1.add(e); else if (vis1.has(p)) t.cls(e, 'mn-h1');
          if (b) vis2.add(e); else if (vis2.has(p)) t.cls(e, 'mn-h2');
        });

        var act = el('div', 'mn-act');
        var more = el('button', 'mn-more', 'Details');
        more.type = 'button';
        more.setAttribute('aria-expanded', 'false');
        more.setAttribute('aria-controls', 'mn-sheet-' + s.id);
        more.setAttribute('aria-label', name + ': details');
        act.appendChild(more);
        t.node(act, s);
        var close = el('button', 'mn-close', 'Close');
        close.type = 'button';
        close.setAttribute('aria-label', 'Close ' + name + ' details');
        t.node(close, wrap, wrap.firstChild);
        infos.push({ ch: s, wrap: wrap, more: more, close: close, name: name, restore: null, trigger: null });
        more.addEventListener('click', function () { if (opened === infos[i]) closeSheet(true); else openSheet(infos[i], more); });
      });

      /* ---- the sheet: open, close, keep focus inside */
      var scrim = el('div', 'mn-scrim');
      scrim.setAttribute('aria-hidden', 'true');
      t.node(scrim, document.body);
      t.on(scrim, 'click', function () { closeSheet(true); });

      function refresh() {
        infos.forEach(function (n) { if (n) n.ch.classList.toggle('mn-read', mode === 'full' || n === opened); });
      }
      function openSheet(n, trigger, details) {
        if (opened) closeSheet(false);
        opened = n;
        n.trigger = trigger;
        n.restore = null;
        if (details) { n.restore = [details, details.open]; details.open = true; }
        n.ch.classList.add('mn-open');
        n.wrap.setAttribute('role', 'dialog');
        n.wrap.setAttribute('aria-modal', 'true');
        n.wrap.setAttribute('aria-label', n.name + ' details');
        n.more.setAttribute('aria-expanded', 'true');
        root.classList.add('mn-sheet-open');
        refresh();
        n.wrap.scrollTop = 0;
        var target = details ? details.querySelector('summary') : n.close;
        if (details) details.scrollIntoView({ block: 'start', behavior: 'instant' });
        target.focus({ preventScroll: true });
      }
      function closeSheet(returnFocus) {
        var n = opened;
        if (!n) return;
        opened = null;
        n.ch.classList.remove('mn-open');
        n.wrap.removeAttribute('role');
        n.wrap.removeAttribute('aria-modal');
        n.wrap.removeAttribute('aria-label');
        n.more.setAttribute('aria-expanded', 'false');
        if (n.restore) n.restore[0].open = n.restore[1];
        root.classList.remove('mn-sheet-open');
        refresh();
        if (returnFocus && n.trigger) n.trigger.focus({ preventScroll: true });
      }
      function trap(e) {
        var f = list(opened.wrap, FOCUSABLE).filter(function (x) { return !x.disabled && x.tabIndex >= 0 && x.getClientRects().length; });
        if (!f.length) return;
        var a = document.activeElement;
        if (!opened.wrap.contains(a)) { e.preventDefault(); f[0].focus(); }
        else if (e.shiftKey && a === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && a === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
      infos.forEach(function (n) { if (n) n.close.addEventListener('click', function () { closeSheet(true); }); });
      // Without the sheet open a project's summary opens the sheet at that project (the sheet itself behaves like the page).
      t.on(document, 'click', function (e) {
        var sm = e.target.closest && e.target.closest('.mn-ch summary');
        if (!sm || mode === 'full' || sm.closest('.mn-open')) return;
        var n = infos[chapters.indexOf(sm.closest('.mn-ch'))];
        if (!n) return;
        e.preventDefault();
        openSheet(n, sm, sm.parentNode);
      }, true);

      /* ---- density: Essence, Summary, Full */
      var group = el('div', 'mn-density');
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', 'Density');
      var live = el('p', 'mn-sr');
      live.setAttribute('role', 'status');
      var buttons = MODES.map(function (m) {
        var b = el('button');
        b.type = 'button';
        b.setAttribute('aria-keyshortcuts', m.key);
        b.title = m.label + ': ' + m.what + ' (key ' + m.key + ')';
        var k = el('span', 'mn-key', m.key);
        k.setAttribute('aria-hidden', 'true');
        b.appendChild(document.createTextNode(m.label));
        b.appendChild(k);
        b.addEventListener('click', function () { setMode(m.id, true); });
        group.appendChild(b);
        return b;
      });
      var nav = document.getElementById('nav');
      t.node(group, document.body, nav ? nav.nextSibling : document.body.firstChild);
      t.node(live, document.body, group.nextSibling);

      function setMode(id, announce) {
        if (opened) closeSheet(false);
        mode = chosen = id;
        MODES.forEach(function (m, i) {
          root.classList.toggle('mn-d-' + m.id, m.id === id);
          buttons[i].setAttribute('aria-pressed', String(m.id === id));
          if (m.id === id) {
            live.textContent = m.label + ' is showing ' + m.what + '.' + (id === 'full' ? '' : ' Some content is hidden: choose Full to read everything.');
            if (announce) buttons[i].focus({ preventScroll: true });
          }
        });
        refresh();
        if (chapters[cur]) chapters[cur].scrollIntoView({ block: 'start', behavior: 'instant' });
      }

      /* ---- where you are: caption, dot rail with a hairline that draws from chapter to chapter */
      var where = el('p', 'mn-where');
      where.setAttribute('aria-hidden', 'true');
      t.node(where, document.body);
      var rail = el('nav', 'mn-rail');
      rail.setAttribute('aria-label', 'Chapters');
      var ol = el('ol');
      var dots = chapters.map(function (s, i) {
        var li = el('li');
        var a = el('a');
        a.href = '#' + s.id;
        a.appendChild(el('span', 'mn-rail__name', names[i]));
        li.appendChild(a);
        ol.appendChild(li);
        return a;
      });
      rail.appendChild(ol);
      t.node(rail, document.body);
      function mark() {
        where.textContent = names[cur] + '  ' + pad(cur + 1) + ' / ' + pad(chapters.length);
        rail.style.setProperty('--mn-p', chapters.length > 1 ? String(cur / (chapters.length - 1)) : '0');
        dots.forEach(function (a, i) { if (i === cur) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
      }

      /* ---- fades: a chapter fades in the first time it is reached (not under reduced motion) */
      if ('IntersectionObserver' in window && !reduce.matches) {
        var io = t.observer(new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (!e.isIntersecting) return;
            t.cls(e.target, 'mn-in');
            io.unobserve(e.target);
          });
        }, { rootMargin: '0px 0px -12% 0px' }));
        infos.forEach(function (n) { if (n) { t.cls(n.ch, 'mn-fade'); io.observe(n.ch); } });
      }

      /* ---- keys: 1 2 3 for density, j k and the left and right arrows to step, Escape closes the sheet */
      function onKey(e) {
        if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
        if (opened) {
          if (e.key === 'Escape') { e.preventDefault(); closeSheet(true); } else if (e.key === 'Tab') trap(e);
          return;
        }
        if (typing(e.target)) return;
        var m = MODES.filter(function (x) { return x.key === e.key; })[0];
        if (m) { e.preventDefault(); setMode(m.id, false); return; }
        var d = (e.key === 'ArrowRight' || e.key === 'j') ? 1 : (e.key === 'ArrowLeft' || e.key === 'k') ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        chapters[Math.min(chapters.length - 1, Math.max(0, cur + d))].scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'start' });
      }
      t.on(document, 'keydown', onKey);

      setMode(mode, false);
      mark();

      return {
        start: function () {},
        setActive: function (id) {
          for (var i = 0; i < chapters.length; i++) if (chapters[i].id === id) { cur = i; break; }
          mark();
        },
        resize: function () {},
        destroy: function () {
          closeSheet(false);
          initialOpen.forEach(function (p) { p[0].open = p[1]; });
          MODES.forEach(function (m) { root.classList.remove('mn-d-' + m.id); });
          chapters.forEach(function (s) { s.classList.remove('mn-read'); });
          root.classList.remove('mn-sheet-open');
          t.undo();
        },
      };
    },
  });
})();
