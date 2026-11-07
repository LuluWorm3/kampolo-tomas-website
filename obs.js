// Observability for the site, shared by every page: errors, Web Vitals and the cost of the heavy features (swarm, + editions, chat).
// One small API, window.obs, with swappable sinks. The default sink sends a few numbers to /api/ping (see netlify/functions/lib/stats.mjs for the
// exact fields): no cookies, no identifiers, no message text, and nothing at all when the browser has Do Not Track switched on.
// Another sink (for example Sentry, see docs/observability.md) is added with obs.addSink(name, fn) without changing any caller.
// Nothing here edits other scripts: the heavy features are observed from outside (a mutation observer and a fetch wrapper).
(function () {
  'use strict';

  // ?audit=1 on any page shows a small live meter (frames per second, slowest recent frame, long tasks, page weight, memory where the browser
  // reports it) so the heavy features can be tried on a real device. It sends nothing anywhere.
  if (/[?&]audit=1(&|$)/.test(location.search)) {
    var box = document.createElement('div');
    box.className = 'obs-meter';
    box.setAttribute('aria-hidden', 'true');
    var cs = box.style;
    cs.position = 'fixed'; cs.left = '8px'; cs.bottom = '8px'; cs.zIndex = '2147483000'; cs.pointerEvents = 'none';
    cs.font = '11px/1.35 ui-monospace, Consolas, monospace'; cs.background = 'rgba(0,0,0,0.82)'; cs.color = '#fff'; cs.padding = '6px 8px'; cs.whiteSpace = 'pre';
    var frames = [];
    var long = { n: 0, ms: 0 };
    try { new PerformanceObserver(function (l) { l.getEntries().forEach(function (e) { long.n++; long.ms += e.duration; }); }).observe({ entryTypes: ['longtask'] }); } catch (e) { /* not supported */ }
    var last = 0;
    (function tick(t) { if (last) frames.push(t - last); last = t; if (frames.length > 300) frames.shift(); requestAnimationFrame(tick); })(0);
    setInterval(function () {
      var recent = frames.slice(-60);
      var avg = recent.length ? recent.reduce(function (a, b) { return a + b; }, 0) / recent.length : 0;
      var worst = frames.length ? Math.max.apply(null, frames) : 0;
      var kb = 0;
      try { performance.getEntriesByType('resource').forEach(function (r) { kb += r.transferSize || 0; }); } catch (e) { /* ignore */ }
      var mem = performance.memory ? '  heap ' + Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB' : '';
      box.textContent = 'fps ' + (avg ? Math.round(1000 / avg) : 0) + '  worst ' + Math.round(worst) + ' ms\nlong tasks ' + long.n + ' (' + Math.round(long.ms) + ' ms)\nnodes ' + document.getElementsByTagName('*').length + '  weight ' + Math.round(kb / 1024) + ' KB' + mem;
    }, 1000);
    document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(box); });
    if (document.body) document.body.appendChild(box);
  }

  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') { window.obs = { sinks: {}, report: function () {}, addSink: function () {}, feature: function () {}, off: true }; return; }

  var sinks = {};
  var counts = { error: 0, total: 0 };
  var MAX_EVENTS = 60;
  var seen = {};
  var debug = /[?&]obs=debug(&|$)/.test(location.search);
  var path = location.pathname.slice(0, 40);

  function device() { var w = window.innerWidth; return w < 700 ? 'phone' : w < 1100 ? 'tablet' : 'desktop'; }
  function refHost() {
    try {
      if (!document.referrer) return '';
      var h = new URL(document.referrer).hostname.toLowerCase();
      return h && h !== location.hostname ? h.slice(0, 60) : '';
    } catch (e) { return ''; }
  }

  // The built-in sink: one beacon per event to our own endpoint.
  sinks.own = function (ev) {
    try {
      if (!navigator.sendBeacon) return;
      navigator.sendBeacon('/api/ping', new Blob([JSON.stringify(ev)], { type: 'application/json' }));
    } catch (e) { /* never break the page */ }
  };
  if (debug) sinks.console = function (ev) { try { console.info('[obs]', ev); } catch (e) { /* ignore */ } };

  function report(ev) {
    if (counts.total >= MAX_EVENTS) return;
    counts.total++;
    ev.p = ev.p || path;
    Object.keys(sinks).forEach(function (k) { try { sinks[k](ev); } catch (e) { /* a broken sink must not stop the others */ } });
  }

  // ---- errors: reported once per kind, message, file and line, at most five per page view ----
  function reportError(kind, message, file, line) {
    if (counts.error >= 5) return;
    var key = kind + '|' + message + '|' + file + '|' + line;
    if (seen[key]) return;
    seen[key] = true;
    counts.error++;
    report({ e: 'error', d: kind, m: String(message || '').slice(0, 160), f: String(file || '').split('/').pop().split('?')[0].slice(0, 60), l: line | 0 });
  }
  window.addEventListener('error', function (e) {
    if (e.target && e.target !== window) return; // failed images and scripts are not script errors
    if (!e.message || e.message === 'Script error.') return;
    reportError('error', e.message, e.filename, e.lineno);
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    reportError('rejection', r && r.message ? r.message : String(r), '', 0);
  });
  document.addEventListener('securitypolicyviolation', function (e) {
    var blocked = '';
    try { blocked = e.blockedURI && e.blockedURI.indexOf('://') > -1 ? new URL(e.blockedURI).hostname : e.blockedURI; } catch (x) { blocked = ''; }
    reportError('csp', (e.effectiveDirective || e.violatedDirective || 'csp') + ' blocked ' + (blocked || 'inline'), '', 0);
  });

  // ---- Web Vitals, reported once when the page is hidden or closed ----
  var vit = { LCP: null, CLS: 0, INP: null, TTFB: null };
  var sent = false;
  function observe(type, cb, extra) {
    try {
      var o = new PerformanceObserver(function (list) { list.getEntries().forEach(cb); });
      o.observe(Object.assign({ type: type, buffered: true }, extra || {}));
    } catch (e) { /* not supported in this browser */ }
  }
  observe('largest-contentful-paint', function (e) { vit.LCP = e.startTime; });
  var win = { value: 0, first: 0, last: 0 };
  observe('layout-shift', function (e) {
    if (e.hadRecentInput) return;
    if (win.value && e.startTime - win.last < 1000 && e.startTime - win.first < 5000) { win.value += e.value; win.last = e.startTime; } else { win.value = e.value; win.first = win.last = e.startTime; }
    if (win.value > vit.CLS) vit.CLS = win.value;
  });
  observe('event', function (e) { if (e.interactionId && (vit.INP === null || e.duration > vit.INP)) vit.INP = e.duration; }, { durationThreshold: 40 });
  try { var nav = performance.getEntriesByType('navigation')[0]; if (nav && nav.responseStart > 0) vit.TTFB = nav.responseStart; } catch (e) { /* ignore */ }
  function sendVitals() {
    if (sent) return;
    sent = true;
    Object.keys(vit).forEach(function (k) { if (vit[k] !== null && isFinite(vit[k])) report({ e: 'vital', d: k, v: Math.round(vit[k] * 1000) / 1000 }); });
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') sendVitals(); });
  window.addEventListener('pagehide', sendVitals);

  // ---- how long the heavy features take, observed from outside ----
  function feature(name, ms) { if (isFinite(ms) && ms >= 0) report({ e: 'feature', d: String(name).slice(0, 40), v: Math.round(ms) }); }

  // The swarm: its overlay is in the page while it runs.
  var swarmAt = 0;
  // A + edition: from choosing it to its controls appearing, and one count per edition entered.
  var editionAt = 0;
  var editionName = '';
  new MutationObserver(function (muts) {
    muts.forEach(function (m) {
      if (m.type === 'attributes' && m.target === document.documentElement && m.attributeName === 'data-style') {
        var s = document.documentElement.getAttribute('data-style') || '';
        if (/-plus$/.test(s) && s !== editionName) { editionName = s; editionAt = performance.now(); report({ e: 'edition', d: s }); }
        else if (!/-plus$/.test(s)) { editionName = ''; editionAt = 0; }
      }
      m.addedNodes && m.addedNodes.forEach(function (n) {
        if (n.nodeType !== 1) return;
        if (n.classList.contains('swarm')) swarmAt = performance.now();
        if (editionAt && (n.classList.contains('px-hud') || n.classList.contains('ren-top'))) { feature('edition:' + editionName, performance.now() - editionAt); editionAt = 0; }
      });
      m.removedNodes && m.removedNodes.forEach(function (n) {
        if (n.nodeType === 1 && n.classList.contains('swarm') && swarmAt) { feature('swarm', performance.now() - swarmAt); swarmAt = 0; }
      });
    });
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-style'], childList: true, subtree: true });

  // The chat: time from sending to the response arriving (the first byte for a streamed answer).
  if (window.fetch) {
    var realFetch = window.fetch;
    window.fetch = function (input) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      if (url.indexOf('/api/chat') === -1) return realFetch.apply(this, arguments);
      var t0 = performance.now();
      var p = realFetch.apply(this, arguments);
      p.then(function (res) { feature(res.ok ? 'chat' : 'chat:error', performance.now() - t0); }, function () { feature('chat:error', performance.now() - t0); });
      return p;
    };
  }

  window.obs = {
    sinks: sinks,
    report: report,
    feature: feature,
    addSink: function (name, fn) { sinks[name] = fn; },
    device: device,
    refHost: refHost,
  };
})();
