/* Design system gallery: reads the site's real tokens and components live. Vanilla JS, no requests, no inline styles (colours are set through the CSS object model). */
(function () {
  'use strict';
  var root = document.documentElement;
  var demo = document.getElementById('lab-demo');
  if (!demo || !window.getComputedStyle) return;
  var $ = function (id) { return document.getElementById(id); };
  var make = function (tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

  var ROLES = {
    '--bg': 'Page background, and the face of buttons and fields.',
    '--bg-alt': 'The alternate section band.',
    '--text': 'Body text, headings and solid buttons.',
    '--muted': 'Captions and secondary text.',
    '--rule': 'Heavy rules, and the edge of buttons, fields and tags.',
    '--hair': 'Hairline dividers. Decorative.',
    '--accent': 'The single accent: numbers, dates, dashes and the focus ring.',
    '--on-accent': 'Text drawn on an accent fill.',
    '--gap': 'The grid gutter and the page side padding.',
    '--max': 'Maximum width of the page content.',
    '--font': 'The one typeface stack.'
  };
  /* The pairings the stylesheet actually uses. min is the WCAG 2 target: 4.5 for small text, 3 for the edge of a control, null for decoration. */
  var PAIRS = [
    { fg: '--text', bg: '--bg', use: 'Body text and headings', min: 4.5 },
    { fg: '--text', bg: '--bg-alt', use: 'Text on the alternate band', min: 4.5 },
    { fg: '--muted', bg: '--bg', use: 'Captions and secondary text', min: 4.5 },
    { fg: '--muted', bg: '--bg-alt', use: 'Secondary text on the alternate band', min: 4.5 },
    { fg: '--accent', bg: '--bg', use: 'Numbers, dates and the focus ring', min: 4.5 },
    { fg: '--accent', bg: '--bg-alt', use: 'Accent text on the alternate band', min: 4.5 },
    { fg: '--on-accent', bg: '--accent', use: 'Text on an accent fill (skip link, button hover)', min: 4.5 },
    { fg: '--rule', bg: '--bg', use: 'Edge of buttons, fields and tags', min: 3, line: true },
    { fg: '--hair', bg: '--bg', use: 'Hairline dividers', min: null, line: true }
  ];
  var SKINS = [['swiss', 'Swiss'], ['editorial', 'Editorial'], ['brutalist', 'Brutalist'], ['renaissance', 'Renaissance'], ['bauhaus', 'Bauhaus'], ['minimal', 'Minimalism'], ['neural', 'Neural'], ['cosmos', 'Cosmos']];

  /* ---------- colour maths ---------- */
  var canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  var ctx = canvas.getContext && canvas.getContext('2d', { willReadFrequently: true });
  var SENTINEL = 'rgb(1, 2, 3)';
  var probeWrap = make('span', 'ds-probe');
  probeWrap.style.color = SENTINEL;
  var probe = make('span');
  probeWrap.appendChild(probe);
  demo.appendChild(probeWrap);

  /* Any CSS colour (including var(--x), hsl, oklch, names) to {r,g,b,a} in sRGB, or null. */
  function parse(css) {
    if (typeof css !== 'string' || !css.trim()) return null;
    probe.style.color = '';
    probe.style.color = css.trim();
    if (!probe.style.color) return null;
    var c = getComputedStyle(probe).color;
    if (c === SENTINEL && css.trim().replace(/\s+/g, '') !== 'rgb(1,2,3)') return null; /* inherited: undefined var(), currentcolor, inherit */
    var m = c.match(/^rgba?\(([^)]+)\)$/);
    if (m) {
      var p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    }
    if (!ctx) return null;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    var d = ctx.getImageData(0, 0, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
  }
  var over = function (f, b) { var a = f.a; return { r: f.r * a + b.r * (1 - a), g: f.g * a + b.g * (1 - a), b: f.b * a + b.b * (1 - a), a: 1 }; };
  var lin = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  var lum = function (c) { return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b); };
  var ratioOf = function (f, b) { var a = lum(f), c = lum(b); return (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05); };
  var hex = function (c) { return '#' + [c.r, c.g, c.b].map(function (v) { var h = Math.round(v).toString(16); return h.length < 2 ? '0' + h : h; }).join(''); };
  var same = function (a, b) { return Math.abs(a.r - b.r) < 1 && Math.abs(a.g - b.g) < 1 && Math.abs(a.b - b.b) < 1 && Math.abs(a.a - b.a) < 0.02; };
  /* Two decimals, but never shown as meeting a threshold the exact value misses (4.499 shows as 4.49). */
  function fmt(r) {
    var s = Math.round(r * 100) / 100;
    [3, 4.5, 7].forEach(function (t) { if (s >= t && r < t) s = Math.floor(r * 100) / 100; });
    return s.toFixed(2);
  }
  var pageBg = function () { return parse('var(--bg)') || { r: 255, g: 255, b: 255, a: 1 }; };
  /* Text colour and background (CSS strings) to a ratio, blending any transparency; null if either is not a colour. */
  function ratio(fgCss, bgCss) {
    var f = parse(fgCss), b = parse(bgCss);
    if (!f || !b) return null;
    if (b.a < 1) b = over(b, pageBg());
    if (f.a < 1) f = over(f, b);
    return ratioOf(f, b);
  }

  /* ---------- tokens ---------- */
  function discover() {
    var names = [];
    Array.prototype.forEach.call(document.styleSheets, function (sheet) {
      var rules;
      try { rules = sheet.cssRules; } catch (e) { return; } /* a cross-origin sheet (the font CSS) cannot be read */
      Array.prototype.forEach.call(rules, function (rule) {
        if (rule.type === 1 && rule.selectorText === ':root') {
          Array.prototype.forEach.call(rule.style, function (p) { if (p.indexOf('--') === 0 && names.indexOf(p) < 0) names.push(p); });
        }
      });
    });
    return names;
  }
  var tokenVal = function (n) { return getComputedStyle(root).getPropertyValue(n).trim(); };
  var all = discover();
  var colours = all.filter(function (n) { return CSS.supports('color', tokenVal(n)); });
  var others = all.filter(function (n) { return colours.indexOf(n) < 0; });

  var swatchEls = {}, otherEls = {};
  var swUl = $('ds-swatches'), otUl = $('ds-other');
  colours.forEach(function (n) {
    var li = make('li', 'ds-sw');
    var face = make('span', 'ds-sw__face');
    var chip = make('i');
    chip.style.background = 'var(' + n + ')';
    face.appendChild(chip);
    var val = make('span', 'ds-sw__val');
    li.append(face, make('code', 'ds-sw__name', n), val, make('span', 'ds-sw__role', ROLES[n] || ''));
    swUl.appendChild(li);
    swatchEls[n] = val;
  });
  others.forEach(function (n) {
    var li = make('li', 'ds-ot');
    var val = make('code', 'ds-ot__val');
    li.append(make('code', 'ds-ot__name', n), val, make('span', 'ds-ot__role', ROLES[n] || ''));
    otUl.appendChild(li);
    otherEls[n] = val;
  });
  var tokenRGBA = function () { var m = {}; colours.forEach(function (n) { m[n] = parse('var(' + n + ')'); }); return m; };
  function tagged(c, map) {
    var names = Object.keys(map).filter(function (n) { return map[n] && same(map[n], c); });
    return hex(c) + (c.a < 1 ? ' at ' + Math.round(c.a * 100) + '%' : '') + (names.length ? ' (' + names.join(', ') + ')' : '');
  }

  /* One pass over the pairings in whatever theme and style are applied right now. */
  function measure() {
    return PAIRS.filter(function (p) { return colours.indexOf(p.fg) > -1 && colours.indexOf(p.bg) > -1; }).map(function (p) {
      var r = ratio('var(' + p.fg + ')', 'var(' + p.bg + ')');
      return { pair: p, ratio: r, pass: p.min == null ? null : r >= p.min };
    });
  }

  function renderPairs(rows) {
    var body = $('ds-pairs').querySelector('tbody');
    body.textContent = '';
    rows.forEach(function (x) {
      var p = x.pair, tr = make('tr');
      var sample = make('td'); sample.setAttribute('data-label', 'Sample');
      var chip = make('span', 'ds-chip' + (p.line ? ' ds-chip--line' : ''), p.line ? '' : 'Aa');
      chip.setAttribute('aria-hidden', 'true');
      chip.style.color = 'var(' + p.fg + ')';
      chip.style.backgroundColor = 'var(' + p.bg + ')';
      sample.appendChild(chip);
      var use = make('td', null, p.use); use.setAttribute('data-label', 'Used for');
      var pair = make('td'); pair.setAttribute('data-label', 'Pair');
      pair.appendChild(make('code', null, p.fg + ' on ' + p.bg));
      var num = make('td', 'num', x.ratio == null ? '–' : fmt(x.ratio) + ' : 1'); num.setAttribute('data-label', 'Ratio');
      var res = make('td', x.pass == null ? 'ds-na' : x.pass ? 'ds-pass' : 'ds-fail', x.pass == null ? 'Decorative, not graded' : x.pass ? '✓ Pass, target ' + p.min + ' : 1' : '✕ Below target ' + p.min + ' : 1');
      res.setAttribute('data-label', 'Result');
      tr.append(sample, use, pair, num, res);
      body.appendChild(tr);
    });
  }

  /* ---------- component and type readouts ---------- */
  var SHORT = { 'background-color': 'background', 'border-top-color': 'border', 'border-bottom-color': 'border', 'border-top-width': 'border width', 'padding-left': 'padding-left', 'padding-top': 'padding-top', 'column-gap': 'column gap', 'font-size': 'size', 'font-weight': 'weight', 'line-height': 'line height', 'letter-spacing': 'tracking', color: 'colour' };
  function renderSpecs(map) {
    Array.prototype.forEach.call(demo.querySelectorAll('[data-probe]'), function (box) {
      var el = box.querySelector(box.getAttribute('data-probe'));
      var out = box.querySelector('.ds-spec');
      if (!el || !out) return;
      var cs = getComputedStyle(el);
      var props = (box.getAttribute('data-props') || 'font-size,font-weight,line-height,letter-spacing,color').split(',');
      out.textContent = box.getAttribute('data-probe').replace('.ds-real ', '') + ' → ' + props.map(function (p) {
        var v = cs.getPropertyValue(p).trim();
        if (/color$/.test(p) || p === 'color') { var c = parse(v); if (c) v = tagged(c, map); }
        return (SHORT[p] || p) + ' ' + v;
      }).join(' · ');
    });
  }

  function renderSpacing() {
    var gap = tokenVal('--gap'), max = tokenVal('--max');
    var w = Math.round($('ds-gapbar').parentNode.getBoundingClientRect().width);
    $('ds-gap-note').textContent = '--gap is ' + gap + ' (the bar above), --max is ' + max + ', and the column this sits in is ' + w + 'px wide, so it is the narrower of the two that sets the line length.';
  }

  /* ---------- theme ---------- */
  function renderTheme() {
    var scheme = getComputedStyle(root).colorScheme || 'light';
    var skin = root.getAttribute('data-style');
    var btn = $('ds-theme-btn');
    var dark = scheme.indexOf('dark') > -1;
    btn.textContent = dark ? 'Switch to light theme' : 'Switch to dark theme';
    btn.disabled = !!skin;
    $('ds-theme-note').textContent = skin
      ? 'Colour scheme in use: ' + (dark ? 'dark' : 'light') + '. The ' + skin + ' style carries its own palette, so the light and dark switch applies to Swiss only.'
      : 'Colour scheme in use: ' + (dark ? 'dark' : 'light') + (root.getAttribute('data-theme') ? ', your choice.' : ', following your system setting.');
  }
  $('ds-theme-btn').addEventListener('click', function () {
    var dark = (getComputedStyle(root).colorScheme || '').indexOf('dark') > -1;
    var next = dark ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) { /* storage blocked: the choice just is not remembered */ }
  });

  /* ---------- contrast checker ---------- */
  var fgIn = $('ds-fg'), bgIn = $('ds-bg');
  var LEVELS = [['AA · small text', 4.5], ['AA · large text', 3], ['AAA · small text', 7], ['AAA · large text', 4.5], ['AA · borders and icons that mark a control', 3]];
  function renderChecker() {
    var f = parse(fgIn.value), b = parse(bgIn.value);
    fgIn.setAttribute('aria-invalid', String(!f));
    bgIn.setAttribute('aria-invalid', String(!b));
    var summary = $('ds-cc-summary'), body = $('ds-cc-table').querySelector('tbody');
    if (f) { $('ds-fg-chip').style.background = fgIn.value; $('ds-preview').style.color = fgIn.value; }
    if (b) { $('ds-bg-chip').style.background = bgIn.value; $('ds-preview').style.backgroundColor = bgIn.value; }
    body.textContent = '';
    if (!f || !b) {
      summary.textContent = (!f ? 'The text colour' : 'The background colour') + ' is not a CSS colour I can read. Try #1a1a1a, rgb(26 26 26), hsl(0 0% 10%) or var(--text).';
      return;
    }
    var r = ratio(fgIn.value, bgIn.value);
    var small = r >= 7 ? 'passes AAA' : r >= 4.5 ? 'passes AA, not AAA' : 'fails AA';
    var large = r >= 4.5 ? 'passes AAA' : r >= 3 ? 'passes AA, not AAA' : 'fails AA';
    summary.textContent = fmt(r) + ' to 1. Small text ' + small + '. Large text ' + large + '.';
    LEVELS.forEach(function (l) {
      var ok = r >= l[1], tr = make('tr');
      var a = make('td', null, l[0]); a.setAttribute('data-label', 'Level');
      var n = make('td', null, l[1] + ' to 1'); n.setAttribute('data-label', 'Needs');
      var c = make('td', ok ? 'ds-pass' : 'ds-fail', ok ? '✓ Pass' : '✕ Fail'); c.setAttribute('data-label', 'Result');
      tr.append(a, n, c);
      body.appendChild(tr);
    });
  }
  var pick = $('ds-pick');
  pick.appendChild(make('option', null, 'Choose a pairing'));
  PAIRS.forEach(function (p, i) {
    var o = make('option', null, p.fg + ' on ' + p.bg);
    o.value = String(i);
    pick.appendChild(o);
  });
  pick.addEventListener('change', function () {
    var p = PAIRS[parseInt(pick.value, 10)];
    if (!p) return;
    fgIn.value = 'var(' + p.fg + ')';
    bgIn.value = 'var(' + p.bg + ')';
    renderChecker();
  });
  $('ds-swap').addEventListener('click', function () { var t = fgIn.value; fgIn.value = bgIn.value; bgIn.value = t; renderChecker(); });
  fgIn.addEventListener('input', renderChecker);
  bgIn.addEventListener('input', renderChecker);

  /* ---------- keyboard ---------- */
  var FOCUSABLE = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [tabindex]';
  function visible(el) {
    if (el.disabled || el.tabIndex < 0 || el.closest('[inert]') || !el.getClientRects().length) return false;
    return getComputedStyle(el).visibility !== 'hidden';
  }
  function nameOf(el) {
    var t = el.getAttribute('aria-label');
    if (!t && el.getAttribute('aria-labelledby')) t = el.getAttribute('aria-labelledby').split(/\s+/).map(function (id) { var n = $(id); return n ? n.textContent : ''; }).join(' ');
    if (!t && el.labels && el.labels.length) t = el.labels[0].textContent;
    if (!t) t = el.textContent || el.getAttribute('title') || el.getAttribute('placeholder') || el.value || '';
    return t.replace(/\s+/g, ' ').trim();
  }
  function kindOf(el) {
    var tag = el.tagName.toLowerCase();
    if (tag === 'a') return 'link';
    if (tag === 'summary') return 'disclosure';
    if (tag === 'input') return (el.type === 'checkbox' || el.type === 'radio' ? el.type : 'text field');
    if (tag === 'textarea') return 'text area';
    return tag;
  }
  /* The order Tab follows: elements with a positive tabindex first (ascending), then the rest in document order. */
  function tabOrder() {
    var list = Array.prototype.filter.call(document.querySelectorAll(FOCUSABLE), visible).map(function (el, i) { return { el: el, i: i, t: el.tabIndex }; });
    list.sort(function (a, b) { var x = a.t > 0 ? a.t : Infinity, y = b.t > 0 ? b.t : Infinity; return x === y ? a.i - b.i : x - y; });
    return list.map(function (x) { return x.el; });
  }
  var order = [];
  function showOrder() {
    order = tabOrder();
    var ol = $('ds-order');
    ol.textContent = '';
    order.forEach(function (el) {
      var li = make('li');
      li.append(make('span', 'ds-order__kind', kindOf(el)), document.createTextNode(' ' + (nameOf(el) || '(no name)')));
      ol.appendChild(li);
    });
    $('ds-order-count').textContent = order.length + ' stops. Tab walks them in this order; Shift+Tab walks it backwards. Tab through the page and the current stop is marked.';
  }
  $('ds-order-btn').addEventListener('click', function () {
    var wrap = $('ds-order-wrap'), open = wrap.hidden;
    if (open) showOrder();
    wrap.hidden = !open;
    this.setAttribute('aria-expanded', String(open));
    this.textContent = open ? 'Hide the tab order' : 'List the tab order of this page';
  });
  document.addEventListener('focusin', function (e) {
    var ol = $('ds-order');
    if (!ol || $('ds-order-wrap').hidden) return;
    var at = order.indexOf(e.target);
    Array.prototype.forEach.call(ol.children, function (li, i) { if (i === at) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
  });

  function effectiveBg(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      var c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.99) return c;
    }
    return pageBg();
  }
  $('ds-focus').addEventListener('focusin', function (e) {
    var el = e.target, cs = getComputedStyle(el), map = tokenRGBA(), msg;
    var bg = effectiveBg(el), read = $('ds-focus-read');
    if (!el.matches(':focus-visible')) {
      read.textContent = 'This control took focus from the pointer, and browsers hide the ring for that on buttons and links. Press Tab to land on it by keyboard and see the ring.';
      return;
    }
    var ow = parseFloat(cs.outlineWidth) || 0;
    if (cs.outlineStyle !== 'none' && ow > 0) {
      var oc = parse(cs.outlineColor);
      msg = 'Outline ' + cs.outlineWidth + ' ' + cs.outlineStyle + ' ' + tagged(oc, map) + ', offset ' + cs.outlineOffset + '. Against the background behind it: ' + fmt(ratioOf(oc, bg)) + ' to 1 (a focus indicator needs 3 to 1).';
    } else {
      var bc = parse(cs.borderTopColor);
      msg = 'The outline is removed for this field and the border changes instead: ' + cs.borderTopWidth + ' ' + tagged(bc, map) + '. Against the background behind it: ' + fmt(ratioOf(bc, bg)) + ' to 1 (needs 3 to 1).';
    }
    read.textContent = kindOf(el) + ' "' + nameOf(el) + '": ' + msg;
  });

  /* ---------- reduced motion ---------- */
  var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  var rm = $('ds-rm'), dot = $('ds-rm-dot');
  function renderMotion() {
    $('ds-rm-media').textContent = mq.matches ? 'reduce' : 'no-preference';
    rm.setAttribute('data-reduced', String(mq.matches));
    $('ds-rm-scroll').textContent = getComputedStyle(root).scrollBehavior;
    $('ds-rm-dur').textContent = getComputedStyle(dot).transitionDuration.split(',')[0];
  }
  var calm = function () { return mq.matches || rm.classList.contains('is-calm'); };
  $('ds-rm-play').addEventListener('click', function () {
    rm.classList.toggle('is-moved');
    renderMotion();
    $('ds-rm-note').textContent = calm()
      ? 'The calm variant is on, so the dot jumped with no transition (0s). The same state is reached without the movement.'
      : 'The dot moved over ' + $('ds-rm-dur').textContent + '. With reduced motion on, it would jump instead.';
  });
  $('ds-rm-calm').addEventListener('click', function () {
    var on = rm.classList.toggle('is-calm');
    this.setAttribute('aria-pressed', String(on));
    renderMotion();
  });
  if (mq.addEventListener) mq.addEventListener('change', renderMotion); else if (mq.addListener) mq.addListener(renderMotion);

  /* ---------- styles on this page only ---------- */
  var skinBtns = Array.prototype.slice.call(demo.querySelectorAll('[data-skin]'));
  function setSkin(name) {
    if (name === 'swiss') root.removeAttribute('data-style'); else root.setAttribute('data-style', name);
    skinBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-skin') === name)); });
    var label = SKINS.filter(function (s) { return s[0] === name; })[0][1];
    $('ds-skin-note').textContent = 'Style: ' + label + (name === 'swiss' ? ', the default.' : '. The tokens above were read again from the new style.');
  }
  skinBtns.forEach(function (b) { b.addEventListener('click', function () { setSkin(b.getAttribute('data-skin')); }); });
  $('ds-skin-reset').addEventListener('click', function () { setSkin('swiss'); });

  $('ds-audit-btn').addEventListener('click', function () {
    var prev = root.getAttribute('data-style');
    var tbody = $('ds-audit').querySelector('tbody');
    tbody.textContent = '';
    SKINS.forEach(function (s) {
      if (s[0] === 'swiss') root.removeAttribute('data-style'); else root.setAttribute('data-style', s[0]);
      var rows = measure().filter(function (x) { return x.pass != null; });
      var bad = rows.filter(function (x) { return !x.pass; });
      var tr = make('tr');
      var a = make('td', null, s[1]); a.setAttribute('data-label', 'Style');
      var n = make('td', 'num', (rows.length - bad.length) + ' of ' + rows.length); n.setAttribute('data-label', 'Passing');
      var c = make('td', bad.length ? 'ds-fail' : 'ds-pass', bad.length ? bad.map(function (x) { return x.pair.fg + ' on ' + x.pair.bg + ' ' + fmt(x.ratio); }).join('; ') : 'None'); c.setAttribute('data-label', 'Below target');
      tr.append(a, n, c);
      tbody.appendChild(tr);
    });
    if (prev) root.setAttribute('data-style', prev); else root.removeAttribute('data-style');
    $('ds-audit').hidden = false;
  });

  /* ---------- form and buttons ---------- */
  var form = $('ds-form'), formNote = $('ds-form-note');
  form.addEventListener('submit', function (e) { e.preventDefault(); formNote.textContent = 'The form is valid. Nothing was sent: it has no action and makes no request.'; });
  form.addEventListener('invalid', function (e) { formNote.textContent = (nameOf(e.target) || 'A field') + ': ' + e.target.validationMessage; }, true);
  Array.prototype.forEach.call(demo.querySelectorAll('button[data-demo-action]'), function (b) {
    b.addEventListener('click', function () { $('ds-btn-note').textContent = '"' + b.textContent + '" pressed. Nothing happens by design.'; });
  });

  /* ---------- render everything from the live stylesheet ---------- */
  function render() {
    var map = tokenRGBA(), rows = measure();
    colours.forEach(function (n) { var c = map[n]; swatchEls[n].textContent = tokenVal(n) + (c && !/^#/.test(tokenVal(n)) ? ' · ' + hex(c) : ''); });
    others.forEach(function (n) { otherEls[n].textContent = tokenVal(n); });
    renderPairs(rows);
    var graded = rows.filter(function (x) { return x.pass != null; });
    $('ds-fact-colours').textContent = String(colours.length);
    $('ds-fact-other').textContent = String(others.length);
    $('ds-fact-pass').textContent = graded.filter(function (x) { return x.pass; }).length + '/' + graded.length;
    renderSpecs(map);
    renderSpacing();
    renderTheme();
    renderChecker();
    renderMotion();
  }
  var queued = false;
  function schedule() { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; render(); }); }
  new MutationObserver(schedule).observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-style', 'style', 'class'] });
  var dark = window.matchMedia('(prefers-color-scheme: dark)');
  if (dark.addEventListener) dark.addEventListener('change', schedule); else if (dark.addListener) dark.addListener(schedule);
  window.addEventListener('resize', renderSpacing);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);

  window.DesignSystemLab = { ratio: ratio, parse: parse, fmt: fmt, tokens: function () { return { colours: colours.slice(), others: others.slice() }; }, measure: measure, tabOrder: tabOrder };
  render();
})();
