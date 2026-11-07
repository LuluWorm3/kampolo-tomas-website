/* The Editorial Edition: "The Kampolo Issue" (the + beside Editorial in the Style lab). Styles: edition-editorial.css.
   Registered with the shared engine in editions-plus.js, which handles entering (swarm), the HUD, Pause and Leave. This script builds the magazine
   out of the page itself: a cover (the hero), a contents page, a feature opener in front of every section, a running head and folio on every
   spread, and a colophon. Every word comes from text already on the page; the paintings are the public-domain scenes of the Renaissance Edition,
   shown as print plates. destroy() removes every node, class and attribute it added and restores the drop-cap paragraph.
   Classic script, loaded after editions-plus2.js. Styles are set through classes and CSSOM only (the CSP blocks style attributes). */
(function () {
  var P = window.PlusEditions;
  if (!P) return;
  var el = P.util.el;
  var reduce = P.util.reduce;
  var phone = window.matchMedia('(max-width: 720px)');

  // Real captions for the paintings in img/renaissance (see scripts/paintings.json and /documents/).
  var PLATES = {
    about: 'Titian, Portrait of a Man, c. 1515',
    experience: 'Pieter Bruegel the Elder, The Harvesters, 1565',
    projects: 'Canaletto, The Grand Canal, Venice, 1730s',
    skills: 'Johannes Vermeer, Young Woman with a Lute, c. 1662–63',
    education: 'Rembrandt, Aristotle with a Bust of Homer, 1653',
    contact: 'Johannes Vermeer, Young Woman with a Water Pitcher, c. 1662',
  };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function txt(n) { return n ? (n.textContent || '').replace(/\s+/g, ' ').trim() : ''; }
  function sentences(t) { return (t.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [t]).map(function (s) { return s.trim(); }).filter(Boolean); }
  function first(t) { return sentences(t)[0] || ''; }
  function last(t) { var s = sentences(t); return s[s.length - 1] || ''; }
  function q(sec, sel) { return sec.querySelector(sel); }
  function nth(sec, sel, i) { var all = sec.querySelectorAll(sel); return all[i] || all[0] || null; }

  // The line each section shows on the cover and the contents page, and its pull quote: both read from text the section already holds.
  var LINES = {
    about: function (s) { return txt(q(s, '.about__lead')); },
    experience: function (s) { var j = q(s, '.job'); return j ? [txt(q(j, 'h3')), txt(q(j, '.job__org'))].filter(Boolean).join(', ') : ''; },
    projects: function (s) { return txt(q(s, '.project__name')); },
    skills: function (s) { return [].map.call(s.querySelectorAll('.skills__group h3'), txt).join(', '); },
    education: function (s) { return txt(q(s, '.edu__item h3')); },
    contact: function (s) { return first(txt(q(s, '.about__lead'))); },
  };
  var QUOTES = {
    about: function (s) { return last(txt(q(s, '.about__cols .col-6:first-child p:last-child'))); },
    experience: function (s) { return txt(nth(s, '.job li', 2)); },
    projects: function (s) { return last(txt(q(s, '.section__intro'))); },
    skills: function (s) { return last(txt(q(s, '.section__intro'))); },
    education: function (s) { return txt(nth(s, '.edu__item h3', 1)); },
    contact: function (s) { return first(txt(q(s, '.about__lead'))); },
  };
  function lineOf(s) { var f = LINES[s.id]; return (f ? f(s) : first(txt(q(s, '.section__intro')))) || ''; }
  function quoteOf(s) { var f = QUOTES[s.id]; return (f ? f(s) : first(txt(q(s, '.section__intro')))) || lineOf(s); }

  P.register('editorial-plus', {
    label: 'Editorial Edition', xp: 'kt-editorial-xp', word: 'page ', canvas: false, pausable: true,
    note: 'Editorial Edition: a complete redesign. The site is a magazine issue: a cover, a contents page, then every section as a full-page feature opener with a screened painting that the spread slides over, with running heads, columns and a colophon.',
    engine: function (c, list) {
      var added = [];
      var undo = [];
      function mark(n) { added.push(n); return n; }

      var hero = document.getElementById('home');
      var main = document.getElementById('main');
      var footer = document.querySelector('.footer');
      var pages = list.filter(function (s) { return s.id !== 'home'; });
      var pairs = [];
      var plates = [];

      /* ---------- the cover: the hero is the cover, so its real buttons stay the real controls ---------- */
      if (hero) {
        hero.classList.add('ed-cover');
        undo.push(function () { hero.classList.remove('ed-cover'); });
        var wrap = hero.querySelector('.wrap');
        var title = hero.querySelector('.hero__title');
        var br = title && title.querySelector('br');
        if (br) { // "Kampolo<br>Tomas." reads as one nameplate on a wide screen, so the break needs a space beside it
          var space = document.createTextNode(' ');
          br.parentNode.insertBefore(space, br);
          undo.push(function () { space.remove(); });
        }
        if (wrap) {
          var cover = mark(plate('ed-plate--cover', 'On the cover: the studio'));
          wrap.appendChild(cover);
          var lines = mark(el('ul', 'ed-lines'));
          lines.setAttribute('aria-hidden', 'true');
          pages.slice(0, 6).forEach(function (s) {
            var li = el('li');
            li.appendChild(el('span', 'ed-kicker', number(s) + ' · ' + s.getAttribute('data-section')));
            li.appendChild(el('span', 'ed-lines__line', lineOf(s)));
            lines.appendChild(li);
          });
          wrap.appendChild(lines);
        }
      }

      function number(s) {
        var n = txt(q(s, '.section__num'));
        return /^\d+$/.test(n) ? n : '+';
      }

      function plate(cls, caption) {
        var fig = el('figure', 'ed-plate ' + cls);
        var frame = el('div', 'ed-plate__frame');
        var img = el('div', 'ed-plate__img');
        frame.appendChild(img);
        fig.appendChild(frame);
        if (caption) fig.appendChild(el('figcaption', 'ed-plate__cap', caption));
        plates.push(img);
        return fig;
      }

      /* ---------- the contents page: real links, in reading order ---------- */
      if (hero && hero.parentNode) {
        var nav = mark(el('nav', 'ed-contents'));
        nav.setAttribute('aria-label', 'Contents');
        var w = el('div', 'wrap ed-contents__wrap');
        var head = el('div', 'ed-contents__head');
        head.appendChild(el('p', 'ed-kicker', 'In this issue'));
        head.appendChild(el('h2', 'ed-contents__title', 'Contents'));
        var stand = txt(document.querySelector('#about .about__lead'));
        if (stand) head.appendChild(el('p', 'ed-contents__stand', stand));
        head.appendChild(plate('ed-plate--cover ed-plate--detail', 'Inside: the studio, at work'));
        var ol = el('ol', 'ed-toc');
        pages.forEach(function (s, i) {
          var li = el('li');
          var a = el('a');
          a.href = '#' + s.id;
          a.appendChild(el('span', 'ed-toc__t', s.getAttribute('data-section') || txt(q(s, 'h2'))));
          var dots = el('span', 'ed-toc__dots');
          dots.setAttribute('aria-hidden', 'true');
          a.appendChild(dots);
          a.appendChild(el('span', 'ed-toc__n', pad(3 + i * 2)));
          var d = lineOf(s);
          if (d) a.appendChild(el('span', 'ed-toc__d', d));
          li.appendChild(a);
          ol.appendChild(li);
        });
        w.appendChild(head);
        w.appendChild(ol);
        nav.appendChild(w);
        hero.parentNode.insertBefore(nav, hero.nextSibling);
      }

      /* ---------- one feature opener and one spread per section ---------- */
      pages.forEach(function (s, i) {
        var title = s.getAttribute('data-section') || txt(q(s, 'h2'));
        var folio = pad(3 + i * 2);
        var scene = PLATES[s.id] ? s.id : '';

        s.classList.add('ed-page');
        if (!scene) s.classList.add('ed-page--type');
        s.setAttribute('data-folio', folio);

        var run = mark(el('div', 'ed-run'));
        run.setAttribute('aria-hidden', 'true');
        run.appendChild(el('span', '', 'Kampolo Tomas · ' + title));
        run.appendChild(el('span', '', 'p. ' + folio));
        s.insertBefore(run, s.firstChild);
        var foot = mark(el('div', 'ed-folio', '— ' + folio + ' —'));
        foot.setAttribute('aria-hidden', 'true');
        s.appendChild(foot);

        var op = mark(el('div', 'ed-opener' + (scene ? '' : ' ed-opener--type')));
        op.setAttribute('aria-hidden', 'true');
        if (scene) op.setAttribute('data-scene', scene);
        op.appendChild(el('div', 'ed-opener__veil'));
        var ow = el('div', 'ed-opener__wrap');
        var top = el('p', 'ed-opener__top');
        var num = number(s);
        top.appendChild(el('span', '', num === '+' ? 'Special feature' : 'Feature ' + num));
        top.appendChild(el('span', '', 'The Kampolo Issue'));
        ow.appendChild(top);
        if (scene) ow.appendChild(plate('', 'Plate ' + num + '. ' + PLATES[scene]));
        var body = el('div', 'ed-opener__text');
        body.appendChild(el('p', 'ed-opener__num', num));
        body.appendChild(el('p', 'ed-opener__title', title));
        var quote = quoteOf(s);
        if (quote) {
          var bq = el('p', 'ed-opener__quote', quote);
          bq.appendChild(el('cite', '', title + ', p. ' + folio));
          body.appendChild(bq);
        }
        ow.appendChild(body);
        op.appendChild(ow);
        s.parentNode.insertBefore(op, s);
        pairs.push({ op: op, sec: s, last: -1 });

        undo.push(function () { s.classList.remove('ed-page', 'ed-page--type', 'ed-fold', 'ed-in'); s.removeAttribute('data-folio'); });
      });

      /* ---------- the colophon ---------- */
      if (footer) {
        var colo = mark(el('p', 'ed-colo', 'Colophon'));
        colo.setAttribute('aria-hidden', 'true');
        footer.insertBefore(colo, footer.firstChild);
      }

      /* ---------- a drop cap on the first paragraph that can take one ---------- */
      // The drop cap is its own element: CSS ::first-letter would also take the apostrophe of "I'm", so a paragraph that starts with a contraction is skipped.
      var para = null;
      Array.prototype.some.call(document.querySelectorAll('.about__cols .col-6:first-child > p'), function (p) {
        var m = (p.textContent || '').trim();
        if (m && !/^\S['’]/.test(m)) { para = p; return true; }
        return false;
      });
      var tnode = para && para.firstChild && para.firstChild.nodeType === 3 ? para.firstChild : null;
      if (tnode) {
        var text = tnode.textContent;
        var at = text.search(/\S/);
        if (at > -1) {
          var span = el('span', 'ed-drop', text.charAt(at));
          var lead = at ? document.createTextNode(text.slice(0, at)) : null;
          tnode.textContent = text.slice(at + 1);
          para.insertBefore(span, tnode);
          if (lead) para.insertBefore(lead, span);
          undo.push(function () {
            if (lead) lead.remove();
            span.remove();
            tnode.textContent = text;
          });
        }
      }

      /* ---------- plates load when they are near the screen, not all at once ---------- */
      var near = null;
      if ('IntersectionObserver' in window) {
        near = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (!e.isIntersecting) return;
            e.target.classList.add('is-near');
            near.unobserve(e.target);
          });
        }, { rootMargin: '60% 0px 60% 0px' });
        plates.forEach(function (n) { near.observe(n); });
      } else {
        plates.forEach(function (n) { n.classList.add('is-near'); });
      }

      /* ---------- the spreads fold in as you reach them (CSS decides; phones and reduced motion skip it) ---------- */
      var fold = null;
      if ('IntersectionObserver' in window && !reduce.matches && !phone.matches) {
        fold = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (!e.isIntersecting) return;
            e.target.classList.add('ed-in');
            fold.unobserve(e.target);
          });
        }, { threshold: 0.06 });
        pages.forEach(function (s) { s.classList.add('ed-fold'); fold.observe(s); });
      }

      /* ---------- the opener stays pinned (CSS sticky); as the page covers it, it dims and is finally hidden ---------- */
      var ticking = false;
      function frame() {
        ticking = false;
        var still = reduce.matches || phone.matches;
        var vh = window.innerHeight || 1;
        pairs.forEach(function (p) {
          var pr = 0;
          var covered = false;
          if (!still) {
            var t = p.sec.getBoundingClientRect().top;
            pr = Math.min(1, Math.max(0, 1 - t / vh));
            covered = t < -0.3 * vh;
          }
          if (Math.abs(pr - p.last) > 0.004) { p.op.style.setProperty('--p', pr.toFixed(3)); p.last = pr; }
          p.op.classList.toggle('is-covered', covered);
        });
      }
      function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
      window.addEventListener('scroll', onScroll, { passive: true });
      frame();

      return {
        start: function () { frame(); },
        setActive: function () {},
        resize: function () { frame(); },
        destroy: function () {
          window.removeEventListener('scroll', onScroll);
          if (near) near.disconnect();
          if (fold) fold.disconnect();
          added.forEach(function (n) { n.remove(); });
          undo.reverse().forEach(function (f) { f(); });
        },
      };
    },
  });
})();
