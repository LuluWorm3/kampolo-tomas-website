/* Brutalist Edition: "Concrete OS" (the + beside Brutalist in the Style lab). Lazy-loaded by editions-plus.js on first entry; styles: edition-brutalist.css.
   Registered with the shared engine, which handles entering (swarm), the HUD, Pause and Leave. The page becomes a desktop: the nav is the menubar, every
   section is a window with a title bar (collapse, maximise, close), a taskbar lists the windows and reopens closed ones, and a small read-only terminal
   answers help, ls, open, theme, whoami and clear. A short boot log made from page facts runs on entry (Escape or the button skips it; phones and
   reduced motion get none). Every word comes from text already on the page. Nothing here sends anything anywhere; terminal input is untrusted text and
   is only ever shown with textContent. P.util.track() records every node, class, attribute and listener, so destroy() puts the page back exactly.
   Classic script. Styles are set through classes and CSSOM only (the CSP blocks style attributes). Prefix rule: new classes and attributes start with br-. */
(function () {
  var P = window.PlusEditions;
  if (!P) return;
  var U = P.util;
  var el = U.el;
  var phone = window.matchMedia('(max-width: 720px)');
  var darkMq = window.matchMedia('(prefers-color-scheme: dark)');

  function norm(s) { return (s || '').replace(/\s+/g, ' ').trim(); }
  function txt(n) { return n ? norm(n.textContent) : ''; }
  // textContent with <br> read as a space ("Kampolo<br>Tomas." is one name)
  function plain(n) { return n ? norm([].map.call(n.childNodes, function (c) { return c.nodeName === 'BR' ? ' ' : c.textContent; }).join('')) : ''; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function rep(ch, n) { var s = ''; for (var i = 0; i < n; i++) s += ch; return s; }
  function hide(n) { n.setAttribute('aria-hidden', 'true'); return n; }
  function theme() { return document.documentElement.getAttribute('data-theme') || (darkMq.matches ? 'dark' : 'light'); }

  P.register('brutalist-plus', {
    label: 'Brutalist Edition', xp: 'kt-brutalist-xp', word: 'window ', canvas: false, pausable: true,
    note: 'Brutalist Edition: a complete redesign. The page is a desktop of raw concrete: a menubar, a taskbar, every section a window you can collapse, maximise or close, and a small terminal that answers help, ls and open.',
    engine: function (c, list) {
      var t = U.track();
      var timers = [];
      var wins = [];
      var front = null;
      var held = null;
      var boot = null;
      var done = false;

      function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
      function flag(node, name, on) { if (on) t.cls(node, name); else node.classList.remove(name); }
      function byId(id) { for (var i = 0; i < wins.length; i++) if (wins[i].id === id) return wins[i]; return null; }
      function byEl(n) { for (var i = 0; i < wins.length; i++) if (wins[i].sec === n) return wins[i]; return null; }
      function stateOf(w) { return w.closed ? 'closed' : w.min ? 'collapsed' : 'open'; }

      /* ---------- the windows ---------- */
      function paint(w) {
        var on = w === front && !w.closed;
        w.bMin.setAttribute('aria-expanded', String(!w.min));
        w.bMax.setAttribute('aria-pressed', String(w.max));
        w.task.classList.toggle('br-off', w.closed);
        w.task.classList.toggle('br-dim', w.min && !w.closed);
        w.task.classList.toggle('br-on', on);
        w.task.setAttribute('aria-pressed', String(on));
        w.task.setAttribute('aria-label', w.title + ' window, ' + stateOf(w));
      }
      function setMin(w, v) { w.min = v; flag(w.sec, 'br-min', v); paint(w); }
      function setMax(w, v) { w.max = v; flag(w.sec, 'br-max', v); paint(w); }
      function setClosed(w, v) { w.closed = v; flag(w.sec, 'br-closed', v); paint(w); if (v) w.task.focus(); }
      function raise(w) {
        if (front === w) return;
        if (front) flag(front.sec, 'br-front', false);
        front = w;
        flag(w.sec, 'br-front', true);
        wins.forEach(paint);
      }
      function reveal(w, scroll) {
        w.closed = false; flag(w.sec, 'br-closed', false);
        setMin(w, false);
        raise(w);
        if (scroll) w.sec.scrollIntoView();
      }

      function btn(cls, label) {
        var b = el('button', 'br-b ' + cls, label);
        b.type = 'button';
        b.setAttribute('aria-label', label);
        b.title = label;
        return b;
      }

      function addWindow(sec, id, title, bodyEl) {
        var file = title.toUpperCase().replace(/\s+/g, '_') + (id === 'home' ? '.SYS' : '.EXE');
        var w = { sec: sec, id: id, title: title, min: false, max: false, closed: false };
        t.cls(sec, 'br-win');
        var body = bodyEl || sec.querySelector(':scope > .wrap');
        if (body && !body.id) t.attr(body, 'id', 'br-body-' + id);

        var bar = el('div', 'br-bar');
        bar.setAttribute('role', 'group');
        bar.setAttribute('aria-label', title + ' window');
        bar.appendChild(hide(el('span', 'br-bar__sys')));
        bar.appendChild(hide(el('span', 'br-bar__name', file)));
        bar.appendChild(hide(el('span', 'br-bar__fill')));
        var ctl = el('div', 'br-bar__ctl');
        w.bMin = btn('br-b--min', 'Collapse ' + title + ' window');
        if (body) w.bMin.setAttribute('aria-controls', body.id);
        w.bMax = btn('br-b--max', 'Maximise ' + title + ' window');
        w.bClose = btn('br-b--close', 'Close ' + title + ' window');
        ctl.appendChild(w.bMin); ctl.appendChild(w.bMax); ctl.appendChild(w.bClose);
        bar.appendChild(ctl);
        t.node(bar, sec, sec.firstChild);

        w.bMin.addEventListener('click', function () { setMin(w, !w.min); });
        w.bMax.addEventListener('click', function () { setMax(w, !w.max); });
        w.bClose.addEventListener('click', function () { setClosed(w, true); });
        wins.push(w);
        return w;
      }

      var hero = document.getElementById('home');
      var terminalSec = null;
      var out = null;
      var inp = null;
      var homeWin = null;
      list.forEach(function (s) {
        var title = s.getAttribute('data-section') || txt(s.querySelector('h2')) || s.id;
        var w = addWindow(s, s.id, title);
        if (s === hero) homeWin = w;
      });

      /* ---------- the terminal window (after the cover, in reading order) ---------- */
      if (hero && hero.parentNode) {
        terminalSec = el('section', 'br-term-win');
        terminalSec.id = 'br-terminal';
        terminalSec.setAttribute('aria-label', 'Terminal');
        var tbody = el('div', 'br-term');
        tbody.id = 'br-body-terminal';
        out = el('div', 'br-term__out');
        out.setAttribute('role', 'log');
        out.setAttribute('tabindex', '0');
        out.setAttribute('aria-label', 'Terminal output');
        var form = el('form', 'br-term__form');
        form.setAttribute('autocomplete', 'off');
        var ps = el('label', 'br-term__ps', 'guest@kampolo:~$');
        ps.setAttribute('for', 'br-term-in');
        inp = el('input', 'br-term__in');
        inp.id = 'br-term-in';
        inp.type = 'text';
        inp.maxLength = 80;
        inp.setAttribute('autocapitalize', 'off');
        inp.setAttribute('autocomplete', 'off');
        inp.setAttribute('spellcheck', 'false');
        form.appendChild(ps); form.appendChild(inp);
        tbody.appendChild(out); tbody.appendChild(form);
        terminalSec.appendChild(tbody);
        t.node(terminalSec, hero.parentNode, hero.nextSibling);
        var tw = addWindow(terminalSec, 'terminal', 'Terminal', tbody);
        // addWindow appended the terminal last; reading order puts it second
        wins.pop(); wins.splice(1, 0, tw);
        tbody.addEventListener('click', function () { var s = window.getSelection && window.getSelection(); if (!s || !String(s)) inp.focus(); });
      }

      // the cascade: windows step across four staggered offsets, in reading order
      wins.forEach(function (w, i) { t.cls(w.sec, 'br-w' + (i % 4)); });

      /* ---------- the taskbar ---------- */
      var task = el('nav', 'br-task');
      task.setAttribute('aria-label', 'Windows');
      var desk = el('button', 'br-task__b br-task__desk', 'Desktop');
      desk.type = 'button';
      desk.title = 'Collapse every window; press again to bring them back';
      desk.setAttribute('aria-pressed', 'false');
      task.appendChild(desk);
      wins.forEach(function (w) {
        w.task = el('button', 'br-task__b', w.title);
        w.task.type = 'button';
        task.appendChild(w.task);
        paint(w);
        w.task.addEventListener('click', function () {
          if (w.closed || w.min) { reveal(w, true); return; }
          var r = w.sec.getBoundingClientRect();
          var seen = r.top < window.innerHeight * 0.6 && r.bottom > window.innerHeight * 0.3;
          if (w === front && seen) setMin(w, true); else { raise(w); w.sec.scrollIntoView(); }
        });
      });
      desk.addEventListener('click', function () {
        if (held) { held.forEach(function (w) { setMin(w, false); }); held = null; } else {
          held = wins.filter(function (w) { return !w.closed && !w.min; });
          if (held.length) held.forEach(function (w) { setMin(w, true); }); else held = null;
        }
        desk.setAttribute('aria-pressed', String(!!held));
      });
      t.node(task, document.body);
      if (homeWin) raise(homeWin);

      /* click or focus raises a window; a link to a window that is closed or collapsed opens it first */
      function touch(e) {
        var s = e.target && e.target.closest ? e.target.closest('.br-win, .br-term-win') : null;
        var w = s && byEl(s);
        if (w && !w.closed) raise(w);
      }
      t.on(document, 'focusin', touch);
      t.on(document, 'pointerdown', touch);
      t.on(document, 'click', function (e) {
        var a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
        var w = a && byId(a.getAttribute('href').slice(1));
        if (w && (w.closed || w.min)) reveal(w, false);
      }, true);

      /* ---------- Experience as a git log --graph: lanes drawn with glyphs, the real titles and dates ---------- */
      function cmd(parent, before, command, note) {
        var d = el('div', 'br-cmd');
        d.appendChild(hide(el('span', 'br-cmd__ps', '$')));
        var line = el('span', 'br-cmd__line', ' ' + command);
        line.setAttribute('aria-hidden', 'true');
        d.appendChild(line);
        if (note) d.appendChild(hide(el('span', 'br-cmd__out', note)));
        return t.node(d, parent, before);
      }
      [].forEach.call(document.querySelectorAll('.jobs'), function (jobs) {
        var js = jobs.querySelectorAll(':scope > .job');
        var n = js.length;
        if (!n) return;
        cmd(jobs, jobs.firstChild, 'git log --graph');
        function lanes(node, mark) {
          var a = [];
          for (var k = 0; k < n; k++) a.push(k === node ? mark : '|');
          return a.join(' ');
        }
        [].forEach.call(js, function (job, i) {
          t.cls(job, 'br-g' + Math.min(n, 6));
          var gl = hide(el('div', 'br-gl'));
          var rows = [i ? lanes(-1, '|') : '', lanes(i, ' ')];
          for (var k = 0; k < 70; k++) rows.push(lanes(-1, '|'));
          gl.appendChild(el('pre', 'br-gl__rail', rows.join('\n')));
          var node = el('span', 'br-gl__node', '*');
          t.prop(node, 'left', (2 * i) + 'ch');
          gl.appendChild(node);
          t.node(gl, job, job.firstChild);
        });
      });

      /* ---------- Projects as a directory listing ---------- */
      [].forEach.call(document.querySelectorAll('.projects'), function (box) {
        var dirs = box.querySelectorAll('details.project').length;
        if (dirs) cmd(box, box.firstChild, 'ls -l projects/', 'total ' + dirs);
      });

      /* ---------- Skills as a process monitor: ASCII bars from data-level ---------- */
      [].forEach.call(document.querySelectorAll('.skills'), function (sk) {
        var groups = sk.querySelectorAll('.skills__group').length;
        var tasks = sk.querySelectorAll('.skill-list li').length;
        if (tasks) cmd(sk, sk.firstChild, 'top', 'tasks ' + tasks + ' in ' + groups + ' groups. Levels are self-assessed, 1 to 5.');
      });
      [].forEach.call(document.querySelectorAll('.skills__group'), function (g) {
        var i = 0;
        [].forEach.call(g.querySelectorAll('.skill-list li'), function (li) {
          var lv = Math.max(0, Math.min(5, parseInt(li.getAttribute('data-level'), 10) || 0));
          i++;
          t.node(hide(el('span', 'br-pid', pad(i))), li, li.firstChild);
          var m = hide(el('span', 'br-meter'));
          m.appendChild(document.createTextNode('['));
          m.appendChild(el('span', 'br-meter__f', rep('#', lv)));
          m.appendChild(el('span', 'br-meter__e', rep('-', 5 - lv)));
          m.appendChild(document.createTextNode('] ' + lv + '/5'));
          t.node(m, li);
          t.node(el('span', 'br-sr', 'level ' + lv + ' of 5'), li);
        });
      });

      /* ---------- the terminal: read-only, offline, nothing leaves the page ---------- */
      function facts() {
        var ids = wins.map(function (w) { return w.id; });
        var rows = [
          ['system', 'concrete os, a desktop for ' + plain(document.querySelector('#home .hero__title'))],
          ['role', txt(document.querySelector('#home .hero__role'))],
          ['status', txt(document.querySelector('#home .hero__status'))],
          ['theme', theme()],
          ['windows', ids.length + ': ' + ids.join(', ')],
          ['found', document.querySelectorAll('.skill-list li').length + ' skills, ' + document.querySelectorAll('details.project').length + ' projects, ' + document.querySelectorAll('.job').length + ' jobs'],
          ['ready', 'type help in the terminal'],
        ];
        return rows.filter(function (r) { return r[1]; });
      }
      function fmt(r) { return '[ ok ] ' + r[0] + rep(' ', Math.max(1, 9 - r[0].length)) + r[1]; }

      if (out) {
        var hist = [];
        var hp = 0;
        var say = function (s, cls) {
          var d = el('div', 'br-term__ln' + (cls ? ' ' + cls : ''), s);
          out.appendChild(d);
          out.scrollTop = out.scrollHeight;
        };
        var CMDS = {
          help: function () {
            ['commands:', '  help               show this list', '  ls                 list the windows and their state',
              '  open <window>      open, raise and scroll to a window', '  theme [light|dark] show or switch the theme',
              '  whoami             whose desktop this is', '  clear              empty the screen',
              'Read-only. Nothing you type here is sent anywhere.'].forEach(function (s) { say(s); });
          },
          ls: function () {
            wins.forEach(function (w, i) { say(pad(i + 1) + '  ' + w.id + rep(' ', Math.max(1, 14 - w.id.length)) + stateOf(w)); });
          },
          open: function (a) {
            if (!a.length) { say('usage: open <window>   (see ls)', 'br-term__err'); return; }
            var q = a.join(' ').toLowerCase();
            var hit = null;
            var near = wins.filter(function (w) { return w.id === q || w.title.toLowerCase() === q; });
            if (near.length === 1) hit = near[0]; else {
              near = wins.filter(function (w) { return w.id.indexOf(q) === 0; });
              if (near.length === 1) hit = near[0];
            }
            if (!hit) { say('no such window: ' + a.join(' ').slice(0, 40), 'br-term__err'); return; }
            reveal(hit, true);
            say('opened ' + hit.id);
          },
          theme: function (a) {
            if (!a.length) { say('theme: ' + theme()); return; }
            var want = a[0].toLowerCase();
            if (want !== 'light' && want !== 'dark') { say('usage: theme [light|dark]', 'br-term__err'); return; }
            if (want !== theme()) { var tb = document.getElementById('themeToggle'); if (tb) tb.click(); }
            say('theme: ' + want);
          },
          whoami: function () {
            say(plain(document.querySelector('#home .hero__title')));
            say(txt(document.querySelector('#home .hero__role')));
          },
          clear: function () { out.textContent = ''; },
        };
        var run = function (raw) {
          say('guest@kampolo:~$ ' + raw, 'br-term__cmd');
          var line = raw.trim();
          if (!line) return;
          hist.push(line);
          hp = hist.length;
          var parts = line.split(/\s+/);
          var name = parts[0].toLowerCase();
          if (Object.prototype.hasOwnProperty.call(CMDS, name)) CMDS[name](parts.slice(1));
          else say('command not found: ' + name.slice(0, 40) + '. Try help.', 'br-term__err');
        };
        facts().forEach(function (r) { say(fmt(r)); });
        inp.form.addEventListener('submit', function (e) { e.preventDefault(); run(inp.value); inp.value = ''; });
        inp.addEventListener('keydown', function (e) {
          if (e.key === 'ArrowUp') { if (hp > 0) { hp--; inp.value = hist[hp]; } e.preventDefault(); }
          else if (e.key === 'ArrowDown') { if (hp < hist.length - 1) { hp++; inp.value = hist[hp]; } else { hp = hist.length; inp.value = ''; } e.preventDefault(); }
          else if (e.key === 'Tab') {
            var v = inp.value.toLowerCase();
            var names = Object.keys(CMDS).concat(wins.map(function (w) { return 'open ' + w.id; }));
            var hit = names.filter(function (n) { return v && n.indexOf(v) === 0; });
            if (hit.length === 1) { inp.value = hit[0]; e.preventDefault(); }
          }
        });
      }

      /* ---------- the boot log: page facts, typed once; Escape or the button skips it ---------- */
      function endBoot(instant) {
        if (!boot) return;
        var b = boot;
        boot = null;
        document.removeEventListener('keydown', b.onKey, true);
        function gone() { if (b.ov.parentNode) b.ov.parentNode.removeChild(b.ov); }
        if (instant) gone(); else { b.ov.classList.add('br-boot--out'); later(gone, 300); }
        if (b.prev && b.prev.focus && document.contains(b.prev)) b.prev.focus({ preventScroll: true });
      }
      function startBoot() {
        var rows = facts();
        var ov = el('div', 'br-boot');
        ov.setAttribute('role', 'dialog');
        ov.setAttribute('aria-modal', 'true');
        ov.setAttribute('aria-label', 'Boot log');
        var log = el('div', 'br-boot__log');
        ov.appendChild(el('p', 'br-boot__title', 'Concrete OS'));
        var skip = el('button', 'br-boot__skip', 'Skip (Esc)');
        skip.type = 'button';
        ov.appendChild(log); ov.appendChild(skip);
        var onKey = function (e) {
          if (e.key === 'Escape') { e.preventDefault(); endBoot(true); } else if (e.key === 'Tab') { e.preventDefault(); skip.focus(); }
        };
        boot = { ov: ov, onKey: onKey, prev: document.activeElement };
        document.addEventListener('keydown', onKey, true);
        skip.addEventListener('click', function () { endBoot(true); });
        ov.addEventListener('click', function () { endBoot(true); });
        t.node(ov, document.body);
        skip.focus({ preventScroll: true });
        var i = 0;
        (function step() {
          if (!boot || boot.ov !== ov) return;
          if (i < rows.length) {
            log.appendChild(el('div', 'br-boot__ln', fmt(rows[i])));
            i++;
            later(step, 150);
          } else later(function () { endBoot(false); }, 450);
        })();
      }

      return {
        start: function () { if (!done && U.motion() && !phone.matches) startBoot(); },
        setActive: function (id) { var w = byId(id); if (w && !w.closed) raise(w); },
        setMotion: function (on) { if (!on) endBoot(true); },
        resize: function () {},
        destroy: function () {
          done = true;
          endBoot(true);
          timers.forEach(clearTimeout);
          t.undo();
        },
      };
    },
  });
})();
