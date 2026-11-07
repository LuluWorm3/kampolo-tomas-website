/* The private owner page: traffic, health, chat cost, the feature audit and set-up status. The page ships no data: everything comes from
   /api/owner/* with the bearer token typed in this tab (kept in sessionStorage only, never in a URL). All text is put in with textContent. */
(function () {
  'use strict';
  var root = document.getElementById('owner-root');
  var KEY = 'kt-owner-token';
  var state = { days: 7, tab: 'traffic', data: null, cfg: null };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function add(parent) { for (var i = 1; i < arguments.length; i++) if (arguments[i]) parent.appendChild(arguments[i]); return parent; }
  function token() { try { return sessionStorage.getItem(KEY) || ''; } catch (e) { return ''; } }
  function setToken(t) { try { if (t) sessionStorage.setItem(KEY, t); else sessionStorage.removeItem(KEY); } catch (e) { /* private mode */ } }
  function api(path) {
    return fetch(path, { headers: { Authorization: 'Bearer ' + token() }, cache: 'no-store' }).then(function (r) {
      return r.json().then(function (b) { return { ok: r.ok, status: r.status, body: b }; }, function () { return { ok: false, status: r.status, body: {} }; });
    });
  }
  function fmt(n) { return Number(n || 0).toLocaleString('en'); }
  function when(iso) { try { return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return iso; } }

  /* ---------------------------------------------------------------- small building blocks */
  function kpi(label, value, note) {
    var d = el('div', 'ow-kpi');
    add(d, el('p', 'ow-kpi__v', value), el('p', 'ow-kpi__l', label));
    if (note) d.appendChild(el('p', 'ow-kpi__n', note));
    return d;
  }
  function section(title, intro) {
    var s = el('section', 'ow-sec');
    s.appendChild(el('h2', '', title));
    if (intro) s.appendChild(el('p', 'ow-note', intro));
    return s;
  }
  function bars(items, empty) {
    if (!items || !items.length) return el('p', 'ow-note', empty || 'Nothing yet.');
    var max = Math.max.apply(null, items.map(function (i) { return i.n; })) || 1;
    var ul = el('ul', 'ow-bars');
    items.forEach(function (i) {
      var li = el('li');
      add(li, el('span', 'ow-bars__k', i.key), el('span', 'ow-bars__n', fmt(i.n)));
      var track = el('span', 'ow-bars__t');
      var fill = el('i');
      fill.style.width = Math.max(2, Math.round((i.n / max) * 100)) + '%';
      track.appendChild(fill);
      li.appendChild(track);
      ul.appendChild(li);
    });
    return ul;
  }
  function table(caption, head, rows, cls) {
    var t = el('table', 'lab-table ' + (cls || ''));
    t.appendChild(el('caption', '', caption));
    var tr = el('tr');
    head.forEach(function (h) { tr.appendChild(el('th', h.num ? 'num' : '', h.t || h)); });
    t.appendChild(el('thead')).appendChild(tr);
    var tb = el('tbody');
    rows.forEach(function (r) {
      var row = el('tr');
      r.forEach(function (c, i) { row.appendChild(el('td', head[i] && head[i].num ? 'num' : '', c)); });
      tb.appendChild(row);
    });
    t.appendChild(tb);
    return t;
  }
  function details(summary, node) { var d = el('details', 'ow-det'); d.appendChild(el('summary', '', summary)); d.appendChild(node); return d; }

  /* ---------------------------------------------------------------- charts */
  function dayChart(byDay) {
    var NS = 'http://www.w3.org/2000/svg';
    var w = 640, h = 170, padL = 6, padB = 22, top = 10;
    var max = Math.max(1, Math.max.apply(null, byDay.map(function (d) { return d.views; })));
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.setAttribute('class', 'ow-chart');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Page views per day: ' + byDay.map(function (d) { return d.day + ' ' + d.views; }).join(', '));
    var bw = (w - padL * 2) / byDay.length;
    byDay.forEach(function (d, i) {
      var bh = Math.round(((h - padB - top) * d.views) / max);
      var r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', String(padL + i * bw + bw * 0.12));
      r.setAttribute('width', String(Math.max(1, bw * 0.76)));
      r.setAttribute('y', String(h - padB - bh));
      r.setAttribute('height', String(Math.max(d.views ? 2 : 0, bh)));
      r.setAttribute('class', 'ow-chart__bar');
      var t = document.createElementNS(NS, 'title');
      t.textContent = d.day + ': ' + d.views + ' views';
      r.appendChild(t);
      svg.appendChild(r);
    });
    [[0, 'start'], [byDay.length - 1, 'end']].forEach(function (p) {
      var tx = document.createElementNS(NS, 'text');
      tx.setAttribute('x', String(p[1] === 'start' ? padL : w - padL));
      tx.setAttribute('y', String(h - 6));
      tx.setAttribute('text-anchor', p[1]);
      tx.setAttribute('class', 'ow-chart__lab');
      tx.textContent = byDay[p[0]].day.slice(5);
      svg.appendChild(tx);
    });
    return svg;
  }

  function vitalRow(name, v) {
    var row = el('li', 'ow-vital');
    var head = el('p', 'ow-vital__h');
    var shown = v.p75 === null ? 'no data' : (name === 'CLS' ? v.p75 : fmt(v.p75)) + (v.unit ? ' ' + v.unit : '');
    add(head, el('b', '', name), el('span', '', shown), el('span', 'lab-badge', v.rating));
    var meter = el('span', 'ow-vital__bar');
    var max = v.poor * 1.5;
    var g = el('i', 'ow-vital__good'); g.style.width = (v.good / max) * 100 + '%';
    var m = el('i', 'ow-vital__mid'); m.style.width = ((v.poor - v.good) / max) * 100 + '%';
    add(meter, g, m);
    if (v.p75 !== null) { var mark = el('b', 'ow-vital__mark'); mark.style.left = Math.min(99, (v.p75 / max) * 100) + '%'; meter.appendChild(mark); }
    add(row, head, meter, el('p', 'ow-note', 'Good up to ' + v.good + (v.unit ? ' ' + v.unit : '') + ', poor above ' + v.poor + '. ' + fmt(v.n) + ' samples, 75th percentile.'));
    return row;
  }

  /* ---------------------------------------------------------------- panels */
  function trafficPanel(d) {
    var p = el('div', 'ow-panel');
    var k = el('div', 'ow-kpis');
    add(k, kpi('Page views', fmt(d.views.total)), kpi('Chat messages', fmt(d.events.chat)), kpi('Job-ad matcher', fmt(d.events.match)), kpi('Swarm runs', fmt(d.events.swarm)), kpi('CV downloads', fmt(d.events.download)), kpi('Document requests', fmt(d.events.doc_request)), kpi('Edition entries', fmt(d.events.edition)));
    p.appendChild(k);
    var s1 = section('Views per day');
    add(s1, dayChart(d.views.byDay), details('Show the numbers as a table', table('Page views per day', ['Day', { t: 'Views', num: true }], d.views.byDay.map(function (x) { return [x.day, fmt(x.views)]; }))));
    p.appendChild(s1);
    var grid = el('div', 'ow-grid');
    [['Pages', d.paths], ['Views by persona', d.personas], ['Where visitors came from', d.referrers], ['Countries', d.countries], ['Device size', d.devices],
      ['Editions entered', d.details.filter(function (x) { return x.key.indexOf('edition:') === 0; }).map(function (x) { return { key: x.key.slice(8), n: x.n }; })],
      ['Other detail', d.details.filter(function (x) { return x.key.indexOf('edition:') !== 0; })]].forEach(function (g) {
      var s = section(g[0]);
      s.appendChild(bars(g[1]));
      grid.appendChild(s);
    });
    p.appendChild(grid);
    return p;
  }

  function healthPanel(d) {
    var p = el('div', 'ow-panel');
    var s1 = section('Web Vitals', 'Measured in visitors\' browsers, 75th percentile (an approximation from counted ranges).');
    var ul = el('ul', 'ow-vitals');
    Object.keys(d.vitals).forEach(function (n) { ul.appendChild(vitalRow(n, d.vitals[n])); });
    s1.appendChild(ul);
    var paths = Object.keys(d.vitalsByPath);
    if (paths.length) {
      s1.appendChild(details('By page (75th percentile)', table('Web Vitals by page', ['Page', { t: 'LCP ms', num: true }, { t: 'INP ms', num: true }, { t: 'CLS', num: true }, { t: 'TTFB ms', num: true }], paths.map(function (path) {
        var r = d.vitalsByPath[path];
        function c(n) { return r[n].p75 === null ? '-' : String(r[n].p75); }
        return [path, c('LCP'), c('INP'), c('CLS'), c('TTFB')];
      }))));
    }
    p.appendChild(s1);

    var s2 = section('Errors', 'Grouped by message, file and line, with web addresses, e-mail addresses and long numbers removed. The most recent first.');
    if (!d.errors.length) s2.appendChild(el('p', 'ow-note', 'No errors reported in this period.'));
    else s2.appendChild(table('Error groups', ['Kind', 'Message', 'Where', { t: 'Count', num: true }, 'Last seen'], d.errors.map(function (e) { return [e.kind, e.msg || '(no message)', (e.file || '-') + (e.line ? ':' + e.line : '') + ' on ' + (e.path || '/'), fmt(e.n), when(e.last)]; })));
    p.appendChild(s2);

    var s3 = section('Heavy features', 'How long visitors waited for the swarm, a + edition or a chat answer.');
    if (!d.features.length) s3.appendChild(el('p', 'ow-note', 'No timings yet.'));
    else s3.appendChild(table('Feature timings', ['Feature', { t: 'Times', num: true }, { t: 'Average ms', num: true }, { t: '75th percentile ms', num: true }], d.features.map(function (f) { return [f.name, fmt(f.n), fmt(f.avgMs), f.p75Ms === null ? '-' : fmt(f.p75Ms)]; })));
    p.appendChild(s3);
    return p;
  }

  function costPanel(d) {
    var c = d.chat;
    var p = el('div', 'ow-panel');
    var k = el('div', 'ow-kpis');
    add(k, kpi('Requests', fmt(c.requests)), kpi('Answered', fmt(c.ok)), kpi('Failed', fmt(c.failed)), kpi('Stopped by the daily cap', fmt(c.capped)), kpi('Stopped by the visitor limit', fmt(c.ratelimited)), kpi('Tokens in', fmt(c.tokensIn)), kpi('Tokens out', fmt(c.tokensOut)), kpi('Average answer ms', fmt(c.avgMs)), kpi('Provider failovers', fmt(c.failovers)));
    p.appendChild(k);
    var s1 = section('Daily cap', 'The assistant stops answering for the rest of the day when the cap is reached (CHAT_DAILY_TOKEN_CAP in Netlify).');
    var m = el('meter', 'ow-meter');
    m.min = 0; m.max = c.cap.dailyCap; m.value = Math.min(c.cap.tokensToday, c.cap.dailyCap); m.setAttribute('aria-label', 'Tokens used today of the daily cap');
    add(s1, m, el('p', '', fmt(c.cap.tokensToday) + ' of ' + fmt(c.cap.dailyCap) + ' tokens used today.'));
    p.appendChild(s1);
    var s2 = section('By model', c.priceConfigured ? 'Estimates use the prices you set in CHAT_PRICES. They are not a bill.' : 'No prices are set, so there is no cost estimate. Set CHAT_PRICES in Netlify, for example {"model-name":{"in":1,"out":5}} in US dollars per million tokens, to see one.');
    if (!c.models.length) s2.appendChild(el('p', 'ow-note', 'No answers in this period.'));
    else s2.appendChild(table('Tokens and estimated cost by model', ['Model', { t: 'Tokens in', num: true }, { t: 'Tokens out', num: true }, { t: 'Estimated US$', num: true }], c.models.map(function (x) { return [x.model, fmt(x.tokensIn), fmt(x.tokensOut), x.estimatedUSD === null ? 'not set' : x.estimatedUSD.toFixed(2)]; })));
    p.appendChild(s2);
    var s3 = section('By kind');
    s3.appendChild(bars(c.byMode.map(function (x) { return { key: x.mode, n: x.n }; })));
    p.appendChild(s3);
    return p;
  }

  function auditPanel() {
    var p = el('div', 'ow-panel');
    var s = section('Feature audit', 'Measured on a throttled CPU in a real browser by scripts/audit.mjs (frame times, long tasks, memory, bytes, leaks). Run it again with: node scripts/audit.mjs --out ownerapp/audit.json');
    p.appendChild(s);
    var holder = el('div');
    s.appendChild(holder);
    s.appendChild(el('p', 'ow-note', 'To measure a real device, open any page with ?audit=1 on the end of the address: a small live meter shows frames per second, long tasks and page weight.'));
    fetch('/ownerapp/audit.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (a) {
      if (!a) { holder.appendChild(el('p', 'ow-note', 'No audit results yet. Run scripts/audit.mjs and save them to ownerapp/audit.json.')); return; }
      var rows = Object.keys(a.scenarios).map(function (k) {
        var r = a.scenarios[k];
        var s = r.summary || r.scroll || {};
        return [k, s.frameP95 !== undefined ? String(s.frameP95) : '-', s.fps !== undefined ? String(s.fps) : '-', s.longTaskMs !== undefined ? String(s.longTaskMs) : '-', r.heapGrowthMB !== undefined ? String(r.heapGrowthMB) : (r.leftHeapMB !== undefined ? String(r.leftHeapMB) : '-'), r.nodeGrowth !== undefined ? String(r.nodeGrowth) : (r.leftNodes !== undefined ? String(r.leftNodes) : '-')];
      });
      holder.appendChild(el('p', 'ow-note', 'Run on ' + a.meta.when + ', CPU throttled ' + a.meta.cpuThrottle + 'x, ' + a.meta.chrome + '.'));
      holder.appendChild(table('Audit results', ['Scenario', { t: 'p95 frame ms', num: true }, { t: 'Frames per second', num: true }, { t: 'Long task ms', num: true }, { t: 'Memory left behind MB', num: true }, { t: 'Nodes left behind', num: true }], rows));
    }, function () { holder.appendChild(el('p', 'ow-note', 'The audit results could not be loaded.')); });
    return p;
  }

  function extrasPanel(cfg) {
    var p = el('div', 'ow-panel');
    var s = section('Set-up status', 'Presence only: values are never shown. Set these in Netlify under Site configuration, Environment variables.');
    function row(name, ok, help) { return [name, ok ? 'Set' : 'Not set', help]; }
    s.appendChild(table('Settings', ['Setting', 'Status', 'What it does'], [
      row('OWNER_TOKEN', cfg.ownerToken, 'Opens this page (24 characters or more).'),
      row('METRICS_TOKEN', cfg.metricsToken, 'Lets a Prometheus or Grafana scraper read /api/metrics (24 characters or more).'),
      row('ANTHROPIC_API_KEY', cfg.chatKey, 'Switches the assistant on.'),
      row('CHAT_DAILY_TOKEN_CAP', cfg.chatDailyCap, 'Daily spending ceiling for the assistant (400,000 tokens when not set).'),
      row('CHAT_PRICES', cfg.chatPrices, 'Lets the Cost tab estimate spend.'),
      row('SENTRY_DSN', cfg.sentryDsn, 'For the Sentry error sink (see docs/observability.md).'),
      ['Counter store', cfg.store, 'Netlify Blobs on the live site, a local folder or memory in development.'],
    ]));
    p.appendChild(s);
    var s2 = section('Worth adding next', 'None of these are switched on yet. Each is optional.');
    s2.appendChild(table('Extras', ['Extra', 'Status', 'Why'], [
      ['Uptime checks on / and /api/chat', 'Not set up', 'Tells you when the site or the assistant is down, before a visitor does.'],
      ['E-mail alert on an error spike or when the chat cap is hit', 'Not set up', 'You hear about problems without opening this page.'],
      ['Sentry for browser and function errors', 'Ready to plug in', 'obs.js has a place for it; needs a DSN and your approval of the SDK file.'],
      ['Prometheus or Grafana Cloud scraping /api/metrics', 'Endpoint ready', 'Dashboards and alert rules; see docs/observability.md.'],
      ['Security headers and CSP self-check', 'Not set up', 'Catches a weakened policy before it ships.'],
      ['Lighthouse budgets in CI', 'Not set up', 'Stops a slow change from being merged.'],
      ['Link checker and dependency audit', 'Not set up', 'Finds broken links and risky packages in the functions folder.'],
      ['Backups and secret rotation note', 'Not set up', 'The repository is the backup; tokens should be rotated yearly.'],
    ]));
    p.appendChild(s2);
    return p;
  }

  /* ---------------------------------------------------------------- shell */
  var TABS = [['traffic', 'Traffic'], ['health', 'Health'], ['cost', 'Chat cost'], ['audit', 'Feature audit'], ['extras', 'Set-up']];

  function render() {
    root.textContent = '';
    var bar = el('div', 'ow-bar');
    var tabs = el('div', 'lab-controls');
    tabs.setAttribute('role', 'group'); tabs.setAttribute('aria-label', 'Sections');
    TABS.forEach(function (t) {
      var b = el('button', '', t[1]); b.type = 'button'; b.setAttribute('aria-pressed', String(state.tab === t[0]));
      b.addEventListener('click', function () { state.tab = t[0]; render(); });
      tabs.appendChild(b);
    });
    var range = el('div', 'lab-controls');
    range.setAttribute('role', 'group'); range.setAttribute('aria-label', 'Period');
    [1, 7, 30, 90].forEach(function (n) {
      var b = el('button', '', n === 1 ? 'Today' : n + ' days'); b.type = 'button'; b.setAttribute('aria-pressed', String(state.days === n));
      b.addEventListener('click', function () { state.days = n; load(); });
      range.appendChild(b);
    });
    var out = el('button', 'btn btn--line', 'Sign out'); out.type = 'button';
    out.addEventListener('click', function () { setToken(''); state.data = null; login(); });
    add(bar, tabs, range, out);
    root.appendChild(bar);
    if (state.data && state.data.notes.store === 'memory') root.appendChild(el('p', 'ow-banner', 'Demo data from a local preview: every number below is made up.'));
    var body = el('div', 'ow-body');
    if (state.tab === 'traffic') body.appendChild(trafficPanel(state.data));
    else if (state.tab === 'health') body.appendChild(healthPanel(state.data));
    else if (state.tab === 'cost') body.appendChild(costPanel(state.data));
    else if (state.tab === 'audit') body.appendChild(auditPanel());
    else body.appendChild(extrasPanel(state.cfg));
    root.appendChild(body);
    root.appendChild(el('p', 'ow-note', 'Generated ' + when(state.data.generated) + '. ' + state.data.notes.counting));
  }

  function load() {
    return api('/api/owner/summary?days=' + state.days).then(function (r) {
      if (!r.ok) { setToken(''); login(r.status === 401 ? 'The token was not accepted.' : r.status === 429 ? 'Too many wrong tries. Wait a few minutes.' : 'Could not load the numbers (' + r.status + ').'); return; }
      state.data = r.body;
      return api('/api/owner/config').then(function (c) { state.cfg = c.body; render(); });
    });
  }

  function login(message) {
    root.textContent = '';
    var f = el('form', 'ow-login');
    f.setAttribute('autocomplete', 'off');
    var label = el('label', '', 'Owner token');
    var input = el('input'); input.type = 'password'; input.required = true; input.autocomplete = 'off'; input.id = 'ow-token'; input.spellcheck = false;
    label.setAttribute('for', 'ow-token');
    var go = el('button', 'btn btn--solid', 'Open'); go.type = 'submit';
    var msg = el('p', 'ow-msg', message || ''); msg.setAttribute('role', 'alert');
    add(f, label, input, go, msg);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      setToken(input.value.trim());
      input.value = '';
      go.disabled = true;
      load().then(function () { go.disabled = false; }, function () { go.disabled = false; login('Could not reach the server.'); });
    });
    root.appendChild(f);
    input.focus();
  }

  if (token()) load().catch(function () { login('Could not reach the server.'); }); else login();
})();
