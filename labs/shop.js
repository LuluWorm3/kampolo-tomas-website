/* Shop lab (/lab/shop/): loading comparison with real in-browser measurements, a slow-connection estimate and a test purchase flow.
   Vanilla JS, no network except the lab's own JSON and images, no cookies, no storage. All shop data is sample data. */
(function () {
  'use strict';
  var app = document.getElementById('shopx-app');
  if (!app) return;

  var D = null; // labs/shop-products.json
  var BYTES = {}; // pathname -> real file size in bytes

  /* ---------- small helpers ---------- */
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === false || v == null) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    [].concat(kids == null ? [] : kids).forEach(function (c) {
      if (c == null || c === false) return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function money(n) { return 'N$ ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function bytesText(n) { return n >= 1048576 ? (n / 1048576).toFixed(2) + ' MB' : Math.round(n / 1024) + ' KB'; }
  function msText(n) { return n == null ? 'n/a' : n >= 1000 ? (n / 1000).toFixed(2) + ' s' : Math.round(n) + ' ms'; }
  function say(msg) {
    var live = document.getElementById('shopx-live');
    live.textContent = '';
    setTimeout(function () { live.textContent = msg; }, 40);
  }
  function byId(id) { return D.products.filter(function (p) { return p.id === id; })[0]; }

  /* ---------- image markup ---------- */
  var SIZES_CARD = '(max-width: 720px) 90vw, 280px';
  var SIZES_DETAIL = '(max-width: 720px) 90vw, 520px';
  function srcset(item, ext) {
    return item.img.widths.map(function (w) { return '/img/lab-shop/' + item.id + '-' + w + '.' + ext + ' ' + w + 'w'; }).join(', ');
  }
  function lqipSpan(url) {
    var s = h('span', { class: 'shopx-lq', 'aria-hidden': 'true' });
    s.style.backgroundImage = 'url("' + url + '")';
    return s;
  }
  function watchLoad(img, wrap) {
    // Hide the placeholder only once the photo has been decoded, so there is never a grey gap between the two.
    var done = function () { wrap.classList.add('is-loaded'); };
    var ready = function () { if (img.decode) img.decode().then(done, done); else done(); };
    if (img.complete && img.naturalWidth) ready(); else { img.addEventListener('load', ready); img.addEventListener('error', done); }
  }
  /* The careful markup: fixed size, srcset and sizes, WebP with JPEG fallback, lazy loading, blurred placeholder. */
  function picture(item, sizes, o) {
    o = o || {};
    var q = o.q || '';
    var set = function (ext) { return srcset(item, ext).replace(/\.(webp|jpg) /g, '.$1' + q + ' '); };
    var img = h('img', {
      src: '/img/lab-shop/' + item.id + '-800.jpg' + q, srcset: set('jpg'), sizes: sizes,
      width: item.img.w, height: item.img.h, loading: o.eager ? null : 'lazy', decoding: 'async', alt: item.alt,
      fetchpriority: o.eager ? 'high' : null,
    });
    var wrap = h('div', { class: 'shopx-img' }, [lqipSpan(item.img.lqip), h('picture', null, [h('source', { type: 'image/webp', srcset: set('webp'), sizes: sizes }), img])]);
    watchLoad(img, wrap);
    return wrap;
  }
  function credit(c) {
    return h('p', { class: 'lab-note shopx-credit' }, ['Photo: “' + c.title + '” by ' + c.author + ', ', c.licenceUrl ? h('a', { href: c.licenceUrl, rel: 'noopener' }, c.licence) : c.licence, '. ', h('a', { href: c.page, rel: 'noopener' }, 'Source'), '.']);
  }

  /* =====================================================================
     A. Loading comparison
     ===================================================================== */
  var support = {};
  var log = { cls: [], lcp: [] };
  function observe(type, push) {
    try {
      if (!PerformanceObserver.supportedEntryTypes || PerformanceObserver.supportedEntryTypes.indexOf(type) < 0) { support[type] = false; return; }
      new PerformanceObserver(function (list) { list.getEntries().forEach(push); }).observe({ type: type });
      support[type] = true;
    } catch (e) { support[type] = false; }
  }
  function startObservers() {
    observe('layout-shift', function (e) { if (!e.hadRecentInput) log.cls.push({ t: e.startTime, v: e.value }); });
    observe('largest-contentful-paint', function (e) { log.lcp.push({ t: e.startTime, el: e.element }); });
  }

  var runCount = 0;
  function naiveGrid(q) {
    var grid = h('div', { class: 'shopx-grid' });
    D.products.forEach(function (p) {
      grid.appendChild(h('figure', null, [
        h('img', { src: '/img/lab-shop/full/' + p.id + '.jpg' + q, alt: p.alt }),
        h('figcaption', { text: p.name }),
      ]));
    });
    return grid;
  }
  function carefulGrid(q) {
    var grid = h('div', { class: 'shopx-grid' });
    D.products.forEach(function (p, i) {
      grid.appendChild(h('figure', null, [picture(p, '(max-width: 720px) 44vw, 200px', { q: q, eager: i < 2 }), h('figcaption', { text: p.name })]));
    });
    return grid;
  }
  /* Hold the images back (simulation): the grid is built inert, the file URLs are put back after `ms`. */
  function holdImages(grid, ms) {
    var held = [];
    grid.querySelectorAll('img, source').forEach(function (n) {
      var rec = { n: n, src: n.getAttribute('src'), set: n.getAttribute('srcset') };
      held.push(rec);
      n.removeAttribute('src'); n.removeAttribute('srcset');
    });
    setTimeout(function () { held.forEach(function (r) { if (r.set) r.n.setAttribute('srcset', r.set); if (r.src) r.n.setAttribute('src', r.src); }); }, ms);
  }

  function runOne(kind, delay) {
    var stage = document.getElementById(kind === 'naive' ? 'shopx-stage-naive' : 'shopx-stage-opt');
    var id = ++runCount;
    var q = '?run=' + id + Date.now().toString(36);
    stage.textContent = '';
    stage.scrollTop = 0;
    // The browser only counts layout shifts and paints that happen inside the viewport, so bring the grid into view first.
    stage.scrollIntoView({ block: 'center', behavior: 'auto' });
    var grid = kind === 'naive' ? naiveGrid(q) : carefulGrid(q);
    var loadedAt = new Map();
    grid.querySelectorAll('img').forEach(function (i) { i.addEventListener('load', function () { loadedAt.set(i, performance.now()); }); });
    if (delay) holdImages(grid, delay);
    var t0 = performance.now();
    stage.appendChild(grid);
    return settle(stage, grid, t0, delay).then(function () { return sleep(700); }).then(function () { return summarise(q, t0, grid, stage, loadedAt); });
  }

  function settle(stage, grid, t0, delay) {
    var imgs = [].slice.call(grid.querySelectorAll('img'));
    var left = 0;
    imgs.forEach(function (img) {
      if (img.loading === 'lazy') return;
      left++;
      var done = function () { left--; };
      if (img.complete && img.src) { left--; return; }
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });
    return new Promise(function (resolve) {
      var quiet = 0;
      var timer = setInterval(function () {
        var loading = imgs.filter(function (i) { return i.currentSrc && !i.complete; }).length;
        var waited = performance.now() - t0 > (delay || 0) + 500;
        quiet = left <= 0 && loading === 0 && waited ? quiet + 100 : 0;
        if (quiet >= 600 || performance.now() - t0 > 25000 + (delay || 0)) { clearInterval(timer); resolve(); }
      }, 100);
    });
  }

  function summarise(q, t0, grid, stage, loadedAt) {
    var end = performance.now();
    var res = performance.getEntriesByType('resource').filter(function (r) { return r.name.indexOf(q) > -1 && r.name.indexOf('/img/lab-shop/') > -1; });
    var measured = res.reduce(function (s, r) { return s + (r.transferSize || r.encodedBodySize || 0); }, 0);
    var decl = 0, loaded = 0;
    grid.querySelectorAll('img').forEach(function (i) {
      if (i.currentSrc && i.complete && i.naturalWidth) { loaded++; decl += BYTES[new URL(i.currentSrc).pathname] || 0; }
    });
    var last = res.reduce(function (m, r) { return Math.max(m, r.responseEnd); }, 0);
    var cls = log.cls.filter(function (e) { return e.t >= t0 && e.t <= end; }).reduce(function (s, e) { return s + e.v; }, 0);
    // The largest image visible in the grid, and when it finished loading (the load event; one number that works in every browser).
    var box = stage.getBoundingClientRect(), largest = null, area = 0;
    loadedAt.forEach(function (t, img) {
      var r = img.getBoundingClientRect();
      var a = Math.max(0, Math.min(r.right, box.right) - Math.max(r.left, box.left)) * Math.max(0, Math.min(r.bottom, box.bottom) - Math.max(r.top, box.top));
      if (a > area || (a === area && largest !== null && t < loadedAt.get(largest))) { area = a; largest = img; }
    });
    var lcp = log.lcp.filter(function (e) { return e.t >= t0 && e.el && stage.contains(e.el); }).sort(function (a, b) { return b.t - a.t; })[0];
    return {
      cls: support['layout-shift'] ? cls : null,
      paint: largest ? loadedAt.get(largest) - t0 : null,
      lcp: support['largest-contentful-paint'] ? (lcp ? lcp.t - t0 : null) : undefined,
      done: last ? last - t0 : null, req: res.length, measured: measured, decl: decl, loaded: loaded, total: D.products.length,
    };
  }

  function fill(k, text) { var c = $('[data-k="' + k + '"]'); if (c) c.textContent = text; }
  function show(kind, r) {
    var k = kind === 'naive' ? 'naive' : 'opt';
    var clsLabel = r.cls == null ? 'not supported' : r.cls.toFixed(3) + (r.cls <= 0.1 ? ' (good)' : r.cls <= 0.25 ? ' (needs work)' : ' (poor)');
    fill('cls-' + k, clsLabel);
    fill('paint-' + k, r.paint === null ? 'not reported' : msText(r.paint));
    fill('lcp-' + k, r.lcp === undefined ? 'not supported' : r.lcp === null ? 'none' : msText(r.lcp));
    fill('done-' + k, msText(r.done));
    fill('req-' + k, r.req + (r.loaded < r.total ? ' (' + r.loaded + ' of ' + r.total + ' images; the rest wait until scrolled into view)' : ''));
    fill('bytes-' + k, r.measured ? bytesText(r.measured) : 'not reported');
    fill('decl-' + k, bytesText(r.decl));
  }

  var running = false;
  function runCompare() {
    if (running) return;
    running = true;
    var btn = document.getElementById('shopx-run');
    var status = document.getElementById('shopx-status');
    var delay = parseInt(document.getElementById('shopx-delay').value, 10) || 0;
    btn.disabled = true;
    btn.setAttribute('aria-disabled', 'true');
    status.textContent = 'Measuring the careless markup…';
    document.querySelectorAll('#shopx-results td').forEach(function (c) { c.textContent = '…'; });
    var a, b;
    runOne('naive', delay).then(function (r) {
      a = r; show('naive', r);
      status.textContent = 'Measuring the careful markup…';
      return runOne('opt', delay);
    }).then(function (r) {
      b = r; show('opt', r);
      var cls = function (x) { return x.cls == null ? 'layout shift not supported' : 'layout shift ' + x.cls.toFixed(3); };
      status.textContent = 'Done. Careless: ' + cls(a) + ', ' + a.req + ' requests, ' + bytesText(a.measured || a.decl) + ' received. Careful: ' + cls(b) + ', ' + b.req + ' requests, ' + bytesText(b.measured || b.decl) + ' received.';
      document.getElementById('shopx-results').setAttribute('data-done', '1');
    }).catch(function (e) {
      status.textContent = 'The measurement failed: ' + e.message;
    }).then(function () {
      running = false; btn.disabled = false; btn.removeAttribute('aria-disabled');
    });
  }

  /* =====================================================================
     B. Slow-connection estimate
     ===================================================================== */
  var PROFILES = [
    { name: 'Weak mobile data', mbit: 0.4, rtt: 400 },
    { name: 'Basic mobile data', mbit: 1.6, rtt: 150 },
    { name: 'Good 4G', mbit: 9, rtt: 70 },
    { name: 'Fixed line or Wi-Fi', mbit: 40, rtt: 20 },
  ];
  function secs(bytes, p) { return (p.rtt + (bytes * 8) / (p.mbit * 1000)) / 1000; }
  function renderSpeeds() {
    var which = document.getElementById('shopx-speed-for').value;
    var items = which === 'all' ? D.products : [byId(which)];
    var sum = function (f) { return items.reduce(function (s, p) { return s + f(p); }, 0); };
    var cols = [sum(function (p) { return p.img.full.bytes; }), sum(function (p) { return p.img.bytes.webp['400']; }), sum(function (p) { return p.img.bytes.webp['800']; })];
    document.getElementById('shopx-speed-cap').textContent = 'Estimated download time for ' + (which === 'all' ? 'all ' + items.length + ' photos' : items[0].name) + '. File sizes: ' + cols.map(bytesText).join(', ') + '.';
    var body = $('#shopx-speed tbody');
    body.textContent = '';
    var max = secs(cols[0], PROFILES[0]);
    PROFILES.forEach(function (p) {
      var tr = h('tr', null, [h('th', { scope: 'row', text: p.name + ' (' + p.mbit + ' Mbit/s, ' + p.rtt + ' ms)' })]);
      cols.forEach(function (b) {
        var s = secs(b, p);
        var bar = h('span', { class: 'shopx-bar', 'aria-hidden': 'true' }, h('i'));
        bar.firstChild.style.width = Math.max(2, Math.round((s / max) * 100)) + '%';
        tr.appendChild(h('td', { class: 'num' }, [h('span', { text: s < 10 ? s.toFixed(1) + ' s' : Math.round(s) + ' s' }), bar]));
      });
      body.appendChild(tr);
    });
  }

  /* =====================================================================
     C. The shop
     ===================================================================== */
  var S = { view: 'list', cat: 'All', pid: null, vi: 0, qty: 1, cart: [], form: { delivery: 'deliver', pay: 'cod' }, order: null };
  var VAT, ZONES, REGIONS = [];

  function lineTotal(l) { return byId(l.pid).variants[l.vi].price * l.qty; }
  function subtotal() { return S.cart.reduce(function (s, l) { return s + lineTotal(l); }, 0); }
  function count() { return S.cart.reduce(function (s, l) { return s + l.qty; }, 0); }
  function zoneFor(region) { return ZONES.filter(function (z) { return z.regions.indexOf(region) > -1; })[0]; }
  function delivery() {
    if (S.form.delivery === 'collect') return { fee: 0, text: 'Collect in store: free', note: 'Collect at the sample shop, Windhoek.' };
    var z = zoneFor(S.form.region);
    if (!z) return { fee: null, text: 'Choose a region', note: '' };
    var sub = subtotal();
    var free = sub >= D.shop.freeDeliveryFrom;
    return { fee: free ? 0 : z.fee, text: free ? 'Free (order over ' + money(D.shop.freeDeliveryFrom) + ')' : money(z.fee), note: z.name + ', ' + z.days };
  }
  function vatIn(total) { return Math.round((total * 100 * VAT) / (1 + VAT)) / 100; }

  function go(view, extra) {
    S.view = view;
    Object.keys(extra || {}).forEach(function (k) { S[k] = extra[k]; });
    render(true);
  }

  function bar() {
    var n = count();
    return h('div', { class: 'shopx-bar-top' }, [
      h('p', { class: 'shopx-brand' }, [h('strong', { text: 'Sample Shop' }), ' ', h('span', { class: 'lab-badge', text: 'Fictional' })]),
      h('nav', { 'aria-label': 'Shop' }, [
        h('button', { type: 'button', class: 'shopx-link', onclick: function () { go('list'); }, 'aria-current': S.view === 'list' ? 'page' : null }, 'Products'),
        h('button', { type: 'button', class: 'shopx-link', id: 'shopx-cartbtn', onclick: function () { go('cart'); }, 'aria-current': S.view === 'cart' ? 'page' : null }, 'Cart (' + n + ')'),
      ]),
    ]);
  }
  function steps() {
    var order = ['cart', 'checkout', 'done'], labels = ['Cart', 'Your details', 'Confirmation'];
    return h('ol', { class: 'shopx-steps', 'aria-label': 'Progress' }, order.map(function (v, i) {
      return h('li', { 'aria-current': S.view === v ? 'step' : null, class: S.view === v ? 'is-on' : '' }, (i + 1) + '. ' + labels[i]);
    }));
  }
  function heading(text) { return h('h4', { class: 'shopx-h', tabindex: '-1', id: 'shopx-h', text: text }); }

  function render(focus) {
    app.textContent = '';
    app.appendChild(bar());
    var view = h('div', { class: 'shopx-view' });
    app.appendChild(view);
    var fn = { list: vList, product: vProduct, cart: vCart, checkout: vCheckout, done: vDone }[S.view];
    fn(view);
    if (focus) {
      var hd = document.getElementById('shopx-h');
      if (hd) hd.focus({ preventScroll: true });
      var top = app.getBoundingClientRect().top;
      if (top < 0) window.scrollTo(0, window.pageYOffset + top - 12);
    }
  }
  function updateCartBtn() { var b = document.getElementById('shopx-cartbtn'); if (b) b.textContent = 'Cart (' + count() + ')'; }

  /* ----- list ----- */
  function vList(view) {
    var cats = ['All'];
    D.products.forEach(function (p) { if (cats.indexOf(p.category) < 0) cats.push(p.category); });
    var hero = D.hero;
    var heroImg = h('img', { src: '/img/lab-shop/hero-1200.jpg', srcset: hero.wide.widths.map(function (w) { return '/img/lab-shop/hero-' + w + '.jpg ' + w + 'w'; }).join(', '), sizes: '(max-width: 720px) 100vw, 800px', width: hero.wide.w, height: hero.wide.h, loading: 'eager', decoding: 'async', alt: hero.alt });
    var heroWrap = h('div', { class: 'shopx-hero' }, [
      lqipSpan(hero.lqip),
      h('picture', null, [
        h('source', { media: '(max-width: 600px)', type: 'image/webp', srcset: hero.phone.widths.map(function (w) { return '/img/lab-shop/hero-m-' + w + '.webp ' + w + 'w'; }).join(', '), sizes: '100vw' }),
        h('source', { media: '(max-width: 600px)', srcset: hero.phone.widths.map(function (w) { return '/img/lab-shop/hero-m-' + w + '.jpg ' + w + 'w'; }).join(', '), sizes: '100vw' }),
        h('source', { type: 'image/webp', srcset: hero.wide.widths.map(function (w) { return '/img/lab-shop/hero-' + w + '.webp ' + w + 'w'; }).join(', '), sizes: '(max-width: 720px) 100vw, 800px' }),
        heroImg,
      ]),
    ]);
    watchLoad(heroImg, heroWrap);
    view.appendChild(heroWrap);
    view.appendChild(credit(hero.credit));
    view.appendChild(heading('Products'));
    view.appendChild(h('div', { class: 'lab-controls', role: 'group', 'aria-label': 'Filter by category' }, cats.map(function (c) {
      return h('button', { type: 'button', 'aria-pressed': S.cat === c ? 'true' : 'false', onclick: function () { S.cat = c; render(false); var f = [].slice.call(app.querySelectorAll('.lab-controls button')).filter(function (b) { return b.textContent === c; })[0]; if (f) f.focus(); say('Showing ' + (c === 'All' ? 'all products' : c)); } }, c);
    })));
    var list = h('ul', { class: 'shopx-cards' });
    D.products.filter(function (p) { return S.cat === 'All' || p.category === S.cat; }).forEach(function (p) {
      var from = Math.min.apply(null, p.variants.map(function (v) { return v.price; }));
      list.appendChild(h('li', { class: 'shopx-card' }, [
        picture(p, SIZES_CARD),
        h('h5', { text: p.name }),
        h('p', { class: 'shopx-meta' }, [p.category + ' · from ', h('strong', { text: money(from) })]),
        h('button', { type: 'button', class: 'shopx-btn', 'aria-label': 'View ' + p.name, onclick: function () { go('product', { pid: p.id, vi: 0, qty: 1 }); } }, 'View'),
      ]));
    });
    view.appendChild(list);
    view.appendChild(h('p', { class: 'lab-note', text: 'Prices include VAT. Sample prices.' }));
  }

  /* ----- product ----- */
  function vProduct(view) {
    var p = byId(S.pid);
    view.appendChild(h('p', null, h('button', { type: 'button', class: 'shopx-link', onclick: function () { go('list'); } }, '← All products')));
    var price = h('p', { class: 'shopx-price', id: 'shopx-price', 'aria-live': 'polite' });
    var setPrice = function () { price.textContent = money(p.variants[S.vi].price) + ' each, VAT included'; };
    setPrice();
    var radios = h('fieldset', { class: 'shopx-fieldset' }, [h('legend', { text: p.variantLabel })].concat(p.variants.map(function (v, i) {
      var id = 'shopx-v' + i;
      var input = h('input', { type: 'radio', name: 'variant', id: id, value: i, checked: i === S.vi, onchange: function () { S.vi = i; setPrice(); } });
      return h('div', { class: 'shopx-opt' }, [input, h('label', { for: id }, v.name + ' · ' + money(v.price))]);
    })));
    var qty = h('input', { type: 'number', id: 'shopx-qty', min: '1', max: '20', value: String(S.qty), inputmode: 'numeric', onchange: function (e) { S.qty = Math.min(20, Math.max(1, parseInt(e.target.value, 10) || 1)); e.target.value = S.qty; } });
    var msg = h('p', { class: 'shopx-added', id: 'shopx-added', hidden: true });
    view.appendChild(h('div', { class: 'shopx-detail' }, [
      picture(p, SIZES_DETAIL, { eager: true }),
      h('div', { class: 'shopx-info' }, [
        heading(p.name),
        h('p', { class: 'shopx-meta', text: p.category }),
        h('p', { text: p.blurb }),
        radios, price,
        h('div', { class: 'shopx-row' }, [h('label', { for: 'shopx-qty' }, 'Quantity'), qty]),
        h('button', { type: 'button', class: 'shopx-btn shopx-btn--solid', onclick: function () {
          S.qty = Math.min(20, Math.max(1, parseInt(qty.value, 10) || 1));
          var line = S.cart.filter(function (l) { return l.pid === p.id && l.vi === S.vi; })[0];
          if (line) line.qty = Math.min(20, line.qty + S.qty); else S.cart.push({ pid: p.id, vi: S.vi, qty: S.qty });
          var t = 'Added ' + S.qty + ' × ' + p.name + ' (' + p.variants[S.vi].name + '). The cart has ' + count() + ' item' + (count() === 1 ? '' : 's') + '.';
          msg.hidden = false; msg.textContent = t; updateCartBtn(); say(t);
        } }, 'Add to cart'),
        msg,
        h('p', null, h('button', { type: 'button', class: 'shopx-link', onclick: function () { go('cart'); } }, 'Go to the cart')),
        credit(p.credit),
      ]),
    ]));
  }

  /* ----- cart ----- */
  function summaryBox(withDelivery) {
    var sub = subtotal(), d = withDelivery ? delivery() : null;
    var total = sub + (d && d.fee ? d.fee : 0);
    var rows = [
      h('div', null, [h('dt', { text: 'Items (VAT included)' }), h('dd', { text: money(sub) })]),
      h('div', null, [h('dt', { text: 'Delivery' }), h('dd', { id: 'shopx-fee', text: withDelivery ? (d.fee == null ? 'Choose a region' : d.text) : 'Chosen at checkout' })]),
      h('div', { class: 'shopx-total' }, [h('dt', { text: 'Total' }), h('dd', { id: 'shopx-total', text: money(total) })]),
      h('div', null, [h('dt', { text: 'VAT included (' + Math.round(VAT * 100) + '%)' }), h('dd', { id: 'shopx-vat', text: money(vatIn(total)) })]),
    ];
    return h('dl', { class: 'shopx-sum' }, rows);
  }
  function vCart(view) {
    view.appendChild(steps());
    view.appendChild(heading('Your cart'));
    if (!S.cart.length) {
      view.appendChild(h('p', { text: 'The cart is empty.' }));
      view.appendChild(h('button', { type: 'button', class: 'shopx-btn', onclick: function () { go('list'); } }, 'Browse the products'));
      return;
    }
    var body = h('tbody');
    var table = h('table', { class: 'lab-table shopx-cart' }, [
      h('caption', { class: 'shopx-sr', text: 'Items in your cart' }),
      h('thead', null, h('tr', null, [h('th', { scope: 'col', text: 'Item' }), h('th', { scope: 'col', class: 'num', text: 'Price' }), h('th', { scope: 'col', text: 'Quantity' }), h('th', { scope: 'col', class: 'num', text: 'Total' }), h('th', { scope: 'col' }, h('span', { class: 'shopx-sr', text: 'Remove' }))])),
      body,
    ]);
    var sumHost = h('div', { class: 'shopx-sumhost' });
    var refresh = function () { sumHost.textContent = ''; sumHost.appendChild(summaryBox(false)); updateCartBtn(); };
    var change = function (l, n, name) {
      l.qty = Math.min(20, Math.max(1, n));
      render(false);
      var again = document.getElementById('shopx-q' + S.cart.indexOf(l)); if (again) again.focus();
      say('Quantity of ' + name + ' is now ' + l.qty + '. Cart total ' + money(subtotal()) + '.');
    };
    S.cart.forEach(function (l, i) {
      var p = byId(l.pid), v = p.variants[l.vi], name = p.name + ' (' + v.name + ')';
      var q = h('input', { type: 'number', id: 'shopx-q' + i, min: '1', max: '20', value: String(l.qty), 'aria-label': 'Quantity of ' + name, inputmode: 'numeric', onchange: function (e) { change(l, parseInt(e.target.value, 10) || 1, name); } });
      body.appendChild(h('tr', null, [
        h('th', { scope: 'row' }, [h('span', { text: p.name }), h('br'), h('span', { class: 'lab-note', text: v.name })]),
        h('td', { class: 'num', text: money(v.price) }),
        h('td', null, h('span', { class: 'shopx-qty' }, [
          h('button', { type: 'button', class: 'shopx-step', 'aria-label': 'Decrease quantity of ' + name, onclick: function () { change(l, l.qty - 1, name); } }, '−'),
          q,
          h('button', { type: 'button', class: 'shopx-step', 'aria-label': 'Increase quantity of ' + name, onclick: function () { change(l, l.qty + 1, name); } }, '+'),
        ])),
        h('td', { class: 'num', text: money(lineTotal(l)) }),
        h('td', null, h('button', { type: 'button', class: 'shopx-link', 'aria-label': 'Remove ' + name, onclick: function () {
          S.cart.splice(i, 1); render(false); say('Removed ' + name + '. The cart has ' + count() + ' item' + (count() === 1 ? '' : 's') + '.');
          var f = document.getElementById('shopx-q0') || document.getElementById('shopx-h'); if (f) f.focus();
        } }, 'Remove')),
      ]));
    });
    refresh();
    view.appendChild(h('div', { class: 'shopx-cols' }, [
      h('div', { class: 'shopx-tablewrap' }, table),
      h('div', null, [h('h5', { text: 'Order summary' }), sumHost, h('p', { class: 'lab-note', text: 'Delivery is free from ' + money(D.shop.freeDeliveryFrom) + ' and is worked out at checkout from the region.' }), h('button', { type: 'button', class: 'shopx-btn shopx-btn--solid', onclick: function () { go('checkout'); } }, 'Go to checkout')]),
    ]));
  }

  /* ----- checkout ----- */
  var RULES = {
    name: function (v) { return v.trim().length >= 2 ? '' : 'Enter your full name.'; },
    email: function (v) { return !v.trim() ? 'Enter your email address.' : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Enter an email address like name@example.com.'; },
    phone: function (v) { var s = v.replace(/[\s-]/g, ''); return !s ? 'Enter a phone number.' : /^(\+264|0)\d{8,9}$/.test(s) ? '' : 'Enter a Namibian number such as 081 123 4567 or +264 81 123 4567.'; },
    region: function (v) { return v ? '' : 'Choose your delivery region.'; },
    town: function (v) { return v.trim() ? '' : 'Enter your town or settlement.'; },
    address: function (v) { return v.trim().length >= 3 ? '' : 'Enter a street address or P.O. Box.'; },
    consent: function (v) { return v ? '' : 'Tick the box to confirm you understand this is a test.'; },
  };
  var LABEL = { name: 'Full name', email: 'Email address', phone: 'Phone number', region: 'Region', town: 'Town or settlement', address: 'Street address or P.O. Box', consent: 'Test confirmation' };

  function field(id, label, o) {
    o = o || {};
    var hint = o.hint ? h('p', { class: 'shopx-hint', id: 'hint-' + id, text: o.hint }) : null;
    var control;
    if (o.select) {
      control = h('select', { id: 'f-' + id, name: id, autocomplete: o.auto || null, 'aria-describedby': 'err-' + id });
      control.appendChild(h('option', { value: '', text: 'Choose a region' }));
      o.select.forEach(function (r) { control.appendChild(h('option', { value: r, text: r })); });
    } else {
      control = h('input', { id: 'f-' + id, name: id, type: o.type || 'text', autocomplete: o.auto || null, inputmode: o.mode || null, 'aria-describedby': (hint ? 'hint-' + id + ' ' : '') + 'err-' + id, spellcheck: 'false' });
    }
    control.value = S.form[id] || '';
    control.addEventListener('input', function () { S.form[id] = control.value; if (control.getAttribute('aria-invalid') === 'true') check(id); });
    control.addEventListener('change', function () { S.form[id] = control.value; if (id === 'region') updateSummary(); });
    return h('div', { class: 'shopx-f', id: 'wrap-' + id }, [h('label', { for: 'f-' + id }, [label, o.req === false ? ' (optional)' : '']), hint, control, h('p', { class: 'shopx-err', id: 'err-' + id })]);
  }
  function check(id) {
    var el = document.getElementById('f-' + id), err = document.getElementById('err-' + id);
    if (!el || !err) return '';
    var v = id === 'consent' ? el.checked : el.value;
    var msg = RULES[id](v);
    err.textContent = msg;
    if (msg) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
    return msg;
  }
  function updateSummary() {
    var d = delivery();
    var total = subtotal() + (d.fee || 0);
    var set = function (id, t) { var e = document.getElementById(id); if (e) e.textContent = t; };
    set('shopx-fee', d.fee == null ? 'Choose a region' : d.text);
    set('shopx-total', money(total));
    set('shopx-vat', money(vatIn(total)));
    set('shopx-feenote', d.note);
    if (d.fee != null) say('Delivery: ' + d.text + (d.note ? ', ' + d.note : '') + '. Total ' + money(total) + '.');
  }
  function vCheckout(view) {
    if (!S.cart.length) { S.view = 'cart'; return vCart(view); }
    view.appendChild(steps());
    view.appendChild(heading('Checkout'));
    var summary = h('div', { class: 'shopx-sumhost' }, summaryBox(true));
    var lines = h('ul', { class: 'shopx-lines' }, S.cart.map(function (l) { var p = byId(l.pid); return h('li', { text: l.qty + ' × ' + p.name + ' (' + p.variants[l.vi].name + ')' }); }));
    var errBox = h('div', { class: 'shopx-errsum', id: 'shopx-errsum', role: 'alert', tabindex: '-1', hidden: true });

    var addr = h('div', { id: 'shopx-addr' }, [
      field('region', 'Region', { select: REGIONS, auto: 'address-level1' }),
      field('town', 'Town or settlement', { auto: 'address-level2' }),
      field('address', 'Street address or P.O. Box', { auto: 'street-address' }),
    ]);
    var setMethod = function (m) { S.form.delivery = m; addr.hidden = m === 'collect'; updateSummary(); };
    var radio = function (name, id, value, label, checked, on) {
      return h('div', { class: 'shopx-opt' }, [h('input', { type: 'radio', name: name, id: id, value: value, checked: checked, onchange: on }), h('label', { for: id }, label)]);
    };
    var consent = h('input', { type: 'checkbox', id: 'f-consent', name: 'consent', 'aria-describedby': 'err-consent', checked: !!S.form.consent, onchange: function (e) { S.form.consent = e.target.checked; if (e.target.getAttribute('aria-invalid') === 'true') check('consent'); } });

    var form = h('form', { class: 'shopx-form', id: 'shopx-form', novalidate: true, 'aria-label': 'Checkout form', onsubmit: function (e) { e.preventDefault(); submit(); } }, [
      errBox,
      h('fieldset', { class: 'shopx-fieldset' }, [h('legend', { text: 'Your details' }), field('name', 'Full name', { auto: 'name' }), field('email', 'Email address', { type: 'email', auto: 'email', mode: 'email' }), field('phone', 'Phone number', { type: 'tel', auto: 'tel', mode: 'tel', hint: 'For example 081 123 4567 or +264 81 123 4567.' })]),
      h('fieldset', { class: 'shopx-fieldset' }, [h('legend', { text: 'Delivery' }),
        radio('delivery', 'f-deliver', 'deliver', 'Deliver to me', S.form.delivery === 'deliver', function () { setMethod('deliver'); }),
        radio('delivery', 'f-collect', 'collect', 'Collect at the sample shop in Windhoek (free)', S.form.delivery === 'collect', function () { setMethod('collect'); }),
        addr]),
      h('fieldset', { class: 'shopx-fieldset' }, [h('legend', { text: 'Payment (sample)' }),
        radio('pay', 'f-cod', 'cod', 'Pay when the order arrives', S.form.pay === 'cod', function () { S.form.pay = 'cod'; }),
        radio('pay', 'f-eft', 'eft', 'Pay by bank transfer (details would be sent after the order)', S.form.pay === 'eft', function () { S.form.pay = 'eft'; }),
        h('p', { class: 'lab-note', text: 'No card or bank details are asked for, because nothing is charged in this test.' })]),
      h('div', { class: 'shopx-f' }, [h('div', { class: 'shopx-opt' }, [consent, h('label', { for: 'f-consent' }, 'I understand this is a test order. Nothing is sent, saved or charged.')]), h('p', { class: 'shopx-err', id: 'err-consent' })]),
      h('div', { class: 'shopx-actions' }, [h('button', { type: 'submit', class: 'shopx-btn shopx-btn--solid' }, 'Place test order'), h('button', { type: 'button', class: 'shopx-link', onclick: function () { go('cart'); } }, 'Back to the cart')]),
    ]);
    addr.hidden = S.form.delivery === 'collect';
    view.appendChild(h('div', { class: 'shopx-cols' }, [form, h('div', null, [h('h5', { text: 'Your order' }), lines, summary, h('p', { class: 'lab-note', id: 'shopx-feenote', text: delivery().note })])]));
    var sel = document.getElementById('f-region'); if (sel) sel.value = S.form.region || '';
  }

  function submit() {
    var ids = ['name', 'email', 'phone'];
    if (S.form.delivery !== 'collect') ids.push('region', 'town', 'address');
    ids.push('consent');
    var errors = [];
    ids.forEach(function (id) { var m = check(id); if (m) errors.push({ id: id, msg: m }); });
    var box = document.getElementById('shopx-errsum');
    if (errors.length) {
      box.hidden = false; box.textContent = '';
      box.appendChild(h('h5', { text: errors.length === 1 ? 'There is 1 problem with the form' : 'There are ' + errors.length + ' problems with the form' }));
      box.appendChild(h('ul', null, errors.map(function (e) {
        return h('li', null, h('a', { href: '#f-' + e.id, onclick: function (ev) { ev.preventDefault(); document.getElementById('f-' + e.id).focus(); } }, LABEL[e.id] + ': ' + e.msg));
      })));
      box.focus();
      return;
    }
    box.hidden = true;
    var d = delivery(), sub = subtotal(), total = sub + (d.fee || 0);
    S.order = {
      ref: 'TEST-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
      name: S.form.name.trim(), email: S.form.email.trim(), collect: S.form.delivery === 'collect',
      where: S.form.delivery === 'collect' ? 'Collect at the sample shop, Windhoek' : S.form.address.trim() + ', ' + S.form.town.trim() + ', ' + S.form.region,
      pay: S.form.pay === 'cod' ? 'Pay when the order arrives' : 'Bank transfer',
      lines: S.cart.map(function (l) { var p = byId(l.pid); return l.qty + ' × ' + p.name + ' (' + p.variants[l.vi].name + ')'; }),
      sub: sub, fee: d.fee, feeText: d.text, total: total, vat: vatIn(total), eta: d.note,
    };
    S.cart = []; S.form = { delivery: 'deliver', pay: 'cod' };
    go('done');
  }

  /* ----- done ----- */
  function vDone(view) {
    var o = S.order;
    if (!o) { S.view = 'list'; return vList(view); }
    view.appendChild(steps());
    view.appendChild(heading('Test order placed'));
    view.appendChild(h('p', { class: 'shopx-notice' }, [h('strong', { text: 'Nothing was sent, saved or charged. ' }), 'This was a practice run: no email was sent, no payment was taken, and the details you typed were only used in this page. They are gone as soon as you start again or reload.']));
    view.appendChild(h('dl', { class: 'shopx-sum' }, [
      h('div', null, [h('dt', { text: 'Test reference' }), h('dd', { text: o.ref })]),
      h('div', null, [h('dt', { text: 'For' }), h('dd', { text: o.name })]),
      h('div', null, [h('dt', { text: o.collect ? 'Collection' : 'Delivery to' }), h('dd', { text: o.where + (o.eta && !o.collect ? ' (' + o.eta + ')' : '') })]),
      h('div', null, [h('dt', { text: 'Payment' }), h('dd', { text: o.pay })]),
    ]));
    view.appendChild(h('ul', { class: 'shopx-lines' }, o.lines.map(function (t) { return h('li', { text: t }); })));
    view.appendChild(h('dl', { class: 'shopx-sum' }, [
      h('div', null, [h('dt', { text: 'Items (VAT included)' }), h('dd', { text: money(o.sub) })]),
      h('div', null, [h('dt', { text: 'Delivery' }), h('dd', { text: o.feeText })]),
      h('div', { class: 'shopx-total' }, [h('dt', { text: 'Total' }), h('dd', { text: money(o.total) })]),
      h('div', null, [h('dt', { text: 'VAT included (' + Math.round(VAT * 100) + '%)' }), h('dd', { text: money(o.vat) })]),
    ]));
    view.appendChild(h('button', { type: 'button', class: 'shopx-btn', onclick: function () { S.order = null; S.cat = 'All'; go('list'); } }, 'Start another test order'));
  }

  /* =====================================================================
     start
     ===================================================================== */
  function init(data) {
    D = data;
    VAT = D.shop.vat.rate;
    ZONES = D.shop.zones;
    ZONES.forEach(function (z) { REGIONS = REGIONS.concat(z.regions); });
    REGIONS.sort();
    D.products.forEach(function (p) {
      BYTES['/img/lab-shop/full/' + p.id + '.jpg'] = p.img.full.bytes;
      ['webp', 'jpg'].forEach(function (ext) { Object.keys(p.img.bytes[ext]).forEach(function (w) { BYTES['/img/lab-shop/' + p.id + '-' + w + '.' + ext] = p.img.bytes[ext][w]; }); });
    });
    startObservers();
    document.getElementById('shopx-run').addEventListener('click', runCompare);
    var sel = document.getElementById('shopx-speed-for');
    sel.appendChild(h('option', { value: 'all', text: 'All ' + D.products.length + ' photos' }));
    D.products.forEach(function (p) { sel.appendChild(h('option', { value: p.id, text: p.name })); });
    sel.addEventListener('change', renderSpeeds);
    renderSpeeds();
    render(false);
    document.documentElement.setAttribute('data-shopx', 'ready');
  }

  fetch('/labs/shop-products.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(init).catch(function (e) {
    app.textContent = 'The sample shop could not be loaded (' + e.message + ').';
  });
})();
