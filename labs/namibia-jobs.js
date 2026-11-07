/* Namibia jobs map: radar, ranked dots, slope chart and tile map, hand-written SVG, no libraries.
   Reads /labs/namibia-jobs.json (written from scripts/lab-data/namibia-labour.csv by scripts/lab-data/build-namibia.mjs).
   No inline styles (CSP): presentation is set through classes and SVG attributes. */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var app = document.getElementById('nj-app');
  if (!app) return;

  var SCALE_MAX = 70;
  var RING_STEP = 10;
  var BINS = [20, 30, 40, 50]; /* tile colour bins: <20, 20-29.9, 30-39.9, 40-49.9, 50+ */
  var SPOKE_ORDER = ['Kunene', 'Omusati', 'Oshana', 'Ohangwena', 'Kavango West', 'Kavango East', 'Zambezi', 'Oshikoto', 'Otjozondjupa', 'Omaheke', 'Khomas', 'Hardap', '//Kharas', 'Erongo'];
  var CODES = { '//Kharas': 'KHA', Erongo: 'ERO', Hardap: 'HAR', 'Kavango East': 'KAE', 'Kavango West': 'KAW', Khomas: 'KHO', Kunene: 'KUN', Ohangwena: 'OHA', Omaheke: 'OMA', Omusati: 'OMU', Oshana: 'OSA', Oshikoto: 'OSK', Otjozondjupa: 'OTJ', Zambezi: 'ZAM' };
  /* Tile map positions [column, row], roughly like the map and not to scale. */
  var TILES = { Omusati: [1, 0], Ohangwena: [2, 0], 'Kavango West': [3, 0], 'Kavango East': [4, 0], Zambezi: [5, 0], Kunene: [0, 1], Oshana: [1, 1], Oshikoto: [2, 1], Otjozondjupa: [3, 1], Erongo: [1, 2], Khomas: [2, 2], Omaheke: [3, 2], Hardap: [2, 3], '//Kharas': [2, 4] };
  var VIEWS = [['radar', 'Radar'], ['dots', 'Ranked dots'], ['slope', 'Slope chart'], ['tiles', 'Tile map']];
  var SHAPES = ['circle', 'square', 'diamond', 'triangle', 'cross'];
  /* Slope chart pairs: [2018 series id, 2023 series id]. */
  var PAIRS = [
    ['2018-overall-broad', '2023-overall-19th-icls', 'All 15+: 2018 broad and 2023'],
    ['2018-overall-strict', '2023-overall-19th-icls', 'All 15+: 2018 strict and 2023'],
    ['2018-youth-broad', '2023-youth-19th-icls', 'Youth 15 to 34: 2018 broad and 2023']
  ];

  var data, byId, idx = {};
  var state = { view: 'radar', selected: ['2023-overall-19th-icls', '2023-youth-19th-icls'], pair: 0, tile: '2023-overall-19th-icls', nat: false, focus: null };
  var width = 0;
  var chartBox, readout, note, controlsBox, legendBox;

  function el(tag, attrs, parent, text) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
    if (text !== undefined) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  function h(tag, cls, parent, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  function f1(v) { return (Math.round(v * 10) / 10).toFixed(1); }
  function nf(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function val(sid, region) { return byId[sid].values[region].value; }
  function label(s) { return s.year + ' ' + (s.measure === 'youth' ? 'youth 15 to 34' : 'all 15+') + ' · ' + (s.definition === '19th-icls' ? '19th ICLS' : s.definition); }
  function short(region) { return width < 560 ? CODES[region] : region; }

  function marker(i, x, y, r, parent, cls) {
    var c = 's' + i + ' mk ' + (cls || ''), shape = SHAPES[i % SHAPES.length], n;
    if (shape === 'circle') n = el('circle', { cx: x, cy: y, r: r, class: c }, parent);
    else if (shape === 'square') n = el('rect', { x: x - r, y: y - r, width: 2 * r, height: 2 * r, class: c }, parent);
    else if (shape === 'diamond') n = el('polygon', { points: [x, y - r * 1.3, x + r * 1.3, y, x, y + r * 1.3, x - r * 1.3, y].join(' '), class: c }, parent);
    else if (shape === 'triangle') n = el('polygon', { points: [x, y - r * 1.25, x + r * 1.2, y + r, x - r * 1.2, y + r].join(' '), class: c }, parent);
    else { var a = r * 0.55, b = r * 1.3; n = el('polygon', { points: [x - a, y - b, x + a, y - b, x + a, y - a, x + b, y - a, x + b, y + a, x + a, y + a, x + a, y + b, x - a, y + b, x - a, y + a, x - b, y + a, x - b, y - a, x - a, y - a].join(' '), class: c }, parent); }
    return n;
  }

  function regionLabelText(region, ids) {
    return region + ': ' + ids.map(function (id) { return label(byId[id]) + ' ' + f1(val(id, region)) + ' percent'; }).join('; ');
  }

  /* ---------- shared pieces ---------- */
  function svgRoot(w, hgt, title) {
    var s = el('svg', { viewBox: '0 0 ' + w + ' ' + hgt, width: w, height: hgt, class: 'nj-svg', focusable: 'false' });
    el('title', {}, s, title);
    return s;
  }
  function group(parent, regionNames, aria) {
    return el('g', { role: 'group', 'aria-label': aria }, parent);
  }
  function regionHit(g, region, ids) {
    g.setAttribute('class', (g.getAttribute('class') || '') + ' reg');
    g.setAttribute('data-region', region);
    g.setAttribute('role', 'img');
    g.setAttribute('aria-label', regionLabelText(region, ids));
    g.setAttribute('tabindex', '-1');
    g.addEventListener('mouseenter', function () { setFocus(region, false); });
    g.addEventListener('focus', function () { setFocus(region, false); });
    g.addEventListener('click', function () { setFocus(region, false); });
  }

  /* ---------- radar ---------- */
  function drawRadar() {
    var w = Math.max(300, Math.min(width, 720));
    var small = w < 560;
    var R = w / 2 - (small ? 48 : 112), side = Math.round(2 * R + (small ? 76 : 90));
    var cx = w / 2, cy = side / 2;
    var svg = svgRoot(w, side, 'Radar chart of unemployment rate by region');
    var rings = el('g', { class: 'rings', 'aria-hidden': 'true' }, svg);
    for (var v = RING_STEP; v <= SCALE_MAX; v += RING_STEP) el('circle', { cx: cx, cy: cy, r: R * v / SCALE_MAX, class: 'ring' + (v === SCALE_MAX ? ' ring--outer' : '') }, rings);
    var n = SPOKE_ORDER.length;
    function pt(i, v) { var a = -Math.PI / 2 + 2 * Math.PI * i / n; return [cx + Math.cos(a) * R * v / SCALE_MAX, cy + Math.sin(a) * R * v / SCALE_MAX, a]; }
    SPOKE_ORDER.forEach(function (r, i) { var p = pt(i, SCALE_MAX); el('line', { x1: cx, y1: cy, x2: p[0], y2: p[1], class: 'spoke' }, rings); });
    for (var t = 20; t < SCALE_MAX; t += 20) el('text', { x: cx + 4, y: cy - R * t / SCALE_MAX - 3, class: 'ringlab' }, rings, t + '%');

    var ids = state.selected;
    if (state.nat) ids.forEach(function (id) { el('circle', { cx: cx, cy: cy, r: R * byId[id].values[data.national].value / SCALE_MAX, class: 'natring s' + idx[id] }, svg); });
    ids.forEach(function (id) {
      var pts = SPOKE_ORDER.map(function (r, i) { var p = pt(i, val(id, r)); return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
      el('polygon', { points: pts, class: 'poly s' + idx[id], 'aria-hidden': 'true' }, svg);
    });
    var regs = group(svg, null, 'Regions, use the arrow keys to move between them');
    SPOKE_ORDER.forEach(function (r, i) {
      var g = el('g', { class: 'rg' }, regs), edge = pt(i, SCALE_MAX), lp = pt(i, SCALE_MAX + (small ? 9 : 7));
      el('line', { x1: cx, y1: cy, x2: edge[0], y2: edge[1], class: 'hit' }, g);
      el('line', { x1: cx, y1: cy, x2: edge[0], y2: edge[1], class: 'spoke-on' }, g);
      ids.forEach(function (id) { var p = pt(i, val(id, r)); marker(idx[id], p[0], p[1], 3.6, g, 'pt'); });
      var cos = Math.cos(lp[2]), anchor = Math.abs(cos) < 0.2 ? 'middle' : cos > 0 ? 'start' : 'end';
      el('text', { x: lp[0], y: lp[1] + 4 + Math.sin(lp[2]) * 6, 'text-anchor': anchor, class: 'rlab' }, g, short(r));
      regionHit(g, r, ids);
    });
    return svg;
  }

  /* ---------- ranked dots ---------- */
  function drawDots() {
    var ids = state.selected, w = Math.max(300, Math.min(width, 860));
    var small = w < 560, left = small ? 92 : 120, right = 24, top = 30, row = 28;
    var order = state.selected.slice().sort(function (a, b) { return idx[a] - idx[b]; });
    var sortId = order[0];
    var regions = data.regions.slice().sort(function (a, b) { return val(sortId, b) - val(sortId, a); });
    var hgt = top + regions.length * row + 14;
    var plot = w - left - right;
    function x(v) { return left + plot * v / SCALE_MAX; }
    var svg = svgRoot(w, hgt, 'Ranked dot plot of unemployment rate by region');
    var grid = el('g', { 'aria-hidden': 'true' }, svg);
    for (var v = 0; v <= SCALE_MAX; v += RING_STEP) {
      el('line', { x1: x(v), y1: top - 8, x2: x(v), y2: hgt - 10, class: 'ring' }, grid);
      el('text', { x: x(v), y: top - 14, 'text-anchor': 'middle', class: 'ringlab' }, grid, v + '%');
    }
    if (state.nat) ids.forEach(function (id) { var nx = x(byId[id].values[data.national].value); el('line', { x1: nx, y1: top - 8, x2: nx, y2: hgt - 10, class: 'natline s' + idx[id] }, grid); });
    var regs = group(svg, null, 'Regions ranked by ' + label(byId[sortId]) + ', use the arrow keys to move between them');
    regions.forEach(function (r, i) {
      var y = top + i * row + row / 2;
      var g = el('g', { class: 'rg' }, regs);
      el('rect', { x: 0, y: y - row / 2, width: w, height: row, class: 'hit hit--row' }, g);
      el('text', { x: left - 10, y: y + 4, 'text-anchor': 'end', class: 'rlab' }, g, short(r));
      var vs = ids.map(function (id) { return val(id, r); });
      el('line', { x1: x(Math.min.apply(null, vs)), y1: y, x2: x(Math.max.apply(null, vs)), y2: y, class: 'dotspan' }, g);
      ids.forEach(function (id) { marker(idx[id], x(val(id, r)), y, 5, g, 'pt'); });
      regionHit(g, r, ids);
    });
    state.sortedBy = label(byId[sortId]);
    return svg;
  }

  /* ---------- slope chart ---------- */
  function spread(items, gap, min, max) {
    /* push labels apart so they stay readable: items are {y}, sorted by y */
    items.sort(function (a, b) { return a.y - b.y; });
    items.forEach(function (it) { it.ly = it.y; });
    for (var pass = 0; pass < 30; pass++) {
      for (var i = 1; i < items.length; i++) { var d = items[i].ly - items[i - 1].ly; if (d < gap) { var m = (gap - d) / 2; items[i - 1].ly -= m; items[i].ly += m; } }
      items[0].ly = Math.max(items[0].ly, min);
      items[items.length - 1].ly = Math.min(items[items.length - 1].ly, max);
    }
  }
  function drawSlope() {
    var pair = PAIRS[state.pair], a = pair[0], b = pair[1], ids = [a, b];
    var w = Math.max(300, Math.min(width, 760)), small = w < 560, hgt = small ? 520 : 560;
    var top = 56, bottom = 18, lx = small ? 98 : 150, rx = w - (small ? 98 : 150);
    var vs = data.regions.map(function (r) { return val(a, r); }).concat(data.regions.map(function (r) { return val(b, r); }));
    var lo = Math.floor(Math.min.apply(null, vs) / 10) * 10, hi = Math.ceil(Math.max.apply(null, vs) / 10) * 10;
    function y(v) { return top + (hgt - top - bottom) * (1 - (v - lo) / (hi - lo)); }
    var svg = svgRoot(w, hgt, 'Slope chart: ' + pair[2]);
    el('text', { x: lx, y: 18, 'text-anchor': 'middle', class: 'slopehead' }, svg, String(byId[a].year) + ' ' + byId[a].definition);
    el('text', { x: rx, y: 18, 'text-anchor': 'middle', class: 'slopehead' }, svg, String(byId[b].year) + ' census');
    el('text', { x: w / 2, y: 38, 'text-anchor': 'middle', class: 'ringlab' }, svg, 'Axis runs from ' + lo + '% to ' + hi + '% and is shared by both sides');
    el('line', { x1: lx, y1: top - 6, x2: lx, y2: hgt - bottom + 6, class: 'ring ring--outer' }, svg);
    el('line', { x1: rx, y1: top - 6, x2: rx, y2: hgt - bottom + 6, class: 'ring ring--outer' }, svg);
    var L = data.regions.map(function (r) { return { r: r, y: y(val(a, r)) }; }), Rr = data.regions.map(function (r) { return { r: r, y: y(val(b, r)) }; });
    spread(L, 15, top - 4, hgt - bottom + 4); spread(Rr, 15, top - 4, hgt - bottom + 4);
    var ly = {}, ry = {};
    L.forEach(function (it) { ly[it.r] = it.ly; }); Rr.forEach(function (it) { ry[it.r] = it.ly; });
    var regs = group(svg, null, 'Regions, use the arrow keys to move between them');
    data.regions.slice().sort(function (p, q) { return val(b, q) - val(b, p); }).forEach(function (r) {
      var g = el('g', { class: 'rg' }, regs), va = val(a, r), vb = val(b, r);
      el('line', { x1: lx, y1: y(va), x2: rx, y2: y(vb), class: 'slopeline hit hit--line' }, g);
      el('line', { x1: lx, y1: y(va), x2: rx, y2: y(vb), class: 'slopeline' }, g);
      marker(idx[a], lx, y(va), 4, g, 'pt'); marker(idx[b], rx, y(vb), 4, g, 'pt');
      el('text', { x: lx - 10, y: ly[r] + 4, 'text-anchor': 'end', class: 'rlab' }, g, short(r) + ' ' + f1(va));
      el('text', { x: rx + 10, y: ry[r] + 4, 'text-anchor': 'start', class: 'rlab' }, g, f1(vb) + ' ' + short(r));
      regionHit(g, r, ids);
    });
    return svg;
  }

  /* ---------- tile map ---------- */
  function bin(v) { var i = 0; while (i < BINS.length && v >= BINS[i]) i++; return i + 1; }
  function drawTiles() {
    var id = state.tile, w = Math.max(300, Math.min(width, 720)), gap = 5;
    var size = Math.min((w - gap * 5) / 6, 112), hgt = size * 5 + gap * 4 + 4;
    var ox = (w - (size * 6 + gap * 5)) / 2;
    var svg = svgRoot(w, hgt, 'Tile map of unemployment rate by region, ' + label(byId[id]));
    var regs = group(svg, null, 'Regions, use the arrow keys to move between them');
    data.regions.forEach(function (r) {
      var t = TILES[r], x = ox + t[0] * (size + gap), y = 2 + t[1] * (size + gap), v = val(id, r);
      var g = el('g', { class: 'rg' }, regs);
      el('rect', { x: x, y: y, width: size, height: size, class: 'tile b' + bin(v) }, g);
      el('text', { x: x + size / 2, y: y + size * 0.3, 'text-anchor': 'middle', class: 'tilecode' }, g, CODES[r]);
      el('text', { x: x + size / 2, y: y + size * 0.62, 'text-anchor': 'middle', class: 'tileval' }, g, f1(v));
      el('text', { x: x + size / 2, y: y + size * 0.86, 'text-anchor': 'middle', class: 'tilename' }, g, r === 'Otjozondjupa' ? 'Otjozond.' : r);
      regionHit(g, r, [id]);
    });
    return svg;
  }
  function drawTileLegend() {
    var box = h('div', 'nj-legend nj-legend--bins', null);
    var names = ['under 20', '20 to 29.9', '30 to 39.9', '40 to 49.9', '50 or more'];
    names.forEach(function (n, i) { var s = h('span', 'nj-bin', box); h('i', 'nj-binsw b' + (i + 1), s); s.appendChild(document.createTextNode(n + '%')); });
    return box;
  }

  /* ---------- notes and readout ---------- */
  function compareNote(ids) {
    var ss = ids.map(function (i) { return byId[i]; });
    var years = {}, defs = {};
    ss.forEach(function (s) { years[s.year] = 1; defs[s.definition] = 1; });
    var parts = [];
    var base = ss.length === 1 ? 'Showing ' + label(ss[0]) + '. Definition: ' + ss[0].definition_text + '. Source: ' + ss[0].source + '.' : '';
    if (Object.keys(years).length > 1) {
      return { warn: true, text: 'Comparing 2018 and 2023 side by side: the 2018 figures come from a household survey and the 2023 figures from the census. ' + (defs.broad ? 'The 2018 broad rate does not require that people searched for work; the 2023 rate does. ' : '') + (defs.strict ? 'The 2018 strict rate uses the same wording of the definition as 2023, but it is still a survey set beside a census. ' : '') + 'The Namibia Statistics Agency says their results cannot be directly compared, so read the gap as a side-by-side, not as a measured change.' };
    }
    if (Object.keys(defs).length > 1 || ss.length > 1) parts.push('Same year, same source' + (Object.keys(defs).length > 1 ? ', different definitions' : ' and definition') + '. Youth means ages 15 to 34; the all-ages series covers everyone from 15.');
    return { warn: false, text: base || parts.join(' ') };
  }
  function renderNote(ids) {
    var n = compareNote(ids);
    note.className = 'nj-note' + (n.warn ? ' nj-note--warn' : '');
    note.textContent = '';
    if (n.warn) h('strong', null, note, 'Definition changed. ');
    note.appendChild(document.createTextNode(n.text));
  }
  function activeIds() { return state.view === 'slope' ? PAIRS[state.pair].slice(0, 2) : state.view === 'tiles' ? [state.tile] : state.selected; }

  function renderReadout() {
    var r = state.focus;
    readout.textContent = '';
    if (!r) { h('p', 'lab-note', readout, 'Hover or focus a region to read its exact values, counts and source. Keyboard: Tab to the chart, then the arrow keys, Home and End.'); return; }
    h('h3', 'nj-readout__name', readout, r);
    var ul = h('ul', 'nj-readout__list', readout);
    activeIds().forEach(function (id) {
      var s = byId[id], v = s.values[r], li = h('li', null, ul);
      h('i', 'nj-sw s' + idx[id], li);
      h('strong', null, li, f1(v.value) + '%');
      li.appendChild(document.createTextNode(' ' + label(s) + ': ' + nf(v.unemployed) + ' unemployed of ' + nf(v.labour_force) + ' in the labour force. Source: ' + s.table + ', page ' + s.page_printed + (s.page_printed !== s.page_pdf ? ' (PDF ' + s.page_pdf + ')' : '') + '.'));
    });
    var nat = activeIds().map(function (id) { return label(byId[id]) + ' ' + f1(byId[id].values[data.national].value) + '%'; }).join(', ');
    h('p', 'lab-note', readout, 'Namibia overall: ' + nat + '.');
  }

  function setFocus(region, moveFocus) {
    state.focus = region;
    var regs = chartBox.querySelectorAll('.reg');
    for (var i = 0; i < regs.length; i++) {
      var on = regs[i].getAttribute('data-region') === region;
      regs[i].classList.toggle('is-on', on);
      regs[i].setAttribute('tabindex', on ? '0' : '-1');
      if (on && moveFocus) regs[i].focus();
    }
    if (!region) { var first = regs[0]; if (first) first.setAttribute('tabindex', '0'); }
    renderReadout();
  }
  function onKey(e) {
    var keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1, Home: 'h', End: 'e' };
    if (!(e.key in keys)) return;
    var regs = [].slice.call(chartBox.querySelectorAll('.reg'));
    if (!regs.length) return;
    var cur = regs.findIndex(function (n) { return n === document.activeElement || n.contains(document.activeElement); });
    var next = e.key === 'Home' ? 0 : e.key === 'End' ? regs.length - 1 : (Math.max(cur, 0) + keys[e.key] + regs.length) % regs.length;
    e.preventDefault();
    setFocus(regs[next].getAttribute('data-region'), true);
  }

  /* ---------- controls ---------- */
  function button(parent, text, pressed, onClick, extra) {
    var b = h('button', extra || '', parent);
    b.type = 'button';
    b.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    b.addEventListener('click', onClick);
    return b;
  }
  function renderControls() {
    controlsBox.textContent = '';
    var viewRow = h('div', 'lab-controls', controlsBox);
    viewRow.setAttribute('role', 'group'); viewRow.setAttribute('aria-label', 'Chart type');
    VIEWS.forEach(function (v) {
      var b = button(viewRow, v[1], state.view === v[0], function () { state.view = v[0]; render(); });
      b.textContent = v[1];
    });
    var row = h('div', 'lab-controls', controlsBox);
    row.setAttribute('role', 'group');
    if (state.view === 'radar' || state.view === 'dots') {
      row.setAttribute('aria-label', 'Series to show');
      data.series.forEach(function (s) {
        var on = state.selected.indexOf(s.id) > -1;
        var b = button(row, '', on, function () {
          var i = state.selected.indexOf(s.id);
          if (i > -1 && state.selected.length === 1) return;
          if (i > -1) state.selected.splice(i, 1); else state.selected.push(s.id);
          render();
        }, 'nj-ser');
        h('i', 'nj-sw s' + idx[s.id], b); b.appendChild(document.createTextNode(label(s)));
      });
      var nb = button(row, '', state.nat, function () { state.nat = !state.nat; render(); }, 'nj-nat');
      nb.textContent = 'Namibia overall';
    } else if (state.view === 'tiles') {
      row.setAttribute('aria-label', 'Shade tiles by');
      data.series.forEach(function (s) {
        var b = button(row, '', state.tile === s.id, function () { state.tile = s.id; render(); }, 'nj-ser');
        b.textContent = label(s);
      });
    } else {
      row.setAttribute('aria-label', 'Comparison to draw');
      PAIRS.forEach(function (p, i) { var b = button(row, '', state.pair === i, function () { state.pair = i; render(); }); b.textContent = p[2]; });
    }
  }

  function renderLegend() {
    legendBox.textContent = '';
    if (state.view === 'tiles') {
      legendBox.appendChild(drawTileLegend());
      h('p', 'lab-note', legendBox, 'The colour bins are fixed, so the 2018 strict series reads as mostly pale. Tile positions are approximate and not to scale.');
    } else if (state.view === 'radar') {
      h('p', 'lab-note', legendBox, 'Each spoke is one region, in rough order from the north-west clockwise. Rings run from 10% to 70%, the same scale for every series.');
    } else if (state.view === 'dots') {
      h('p', 'lab-note', legendBox, 'Regions are ranked by ' + state.sortedBy + ' (the first series switched on). The line joins the lowest and highest selected value for each region. Scale 0% to 70%.');
    } else {
      h('p', 'lab-note', legendBox, 'Both sides share one axis. Lines show the two published figures side by side; they are not a measured change because the definitions and instruments differ.');
    }
  }

  function render() {
    renderControls();
    chartBox.textContent = '';
    var svg = state.view === 'radar' ? drawRadar() : state.view === 'dots' ? drawDots() : state.view === 'slope' ? drawSlope() : drawTiles();
    chartBox.appendChild(svg);
    chartBox.className = 'nj-chart nj-chart--' + state.view;
    renderNote(activeIds());
    renderLegend();
    var regs = chartBox.querySelectorAll('.reg');
    if (state.focus && !chartBox.querySelector('.reg[data-region="' + state.focus.replace(/"/g, '') + '"]')) state.focus = null;
    setFocus(state.focus, false);
    if (regs.length && !state.focus) regs[0].setAttribute('tabindex', '0');
  }

  function init(json) {
    data = json; byId = {};
    data.series.forEach(function (s, i) { byId[s.id] = s; idx[s.id] = i; });
    app.textContent = '';
    controlsBox = h('div', 'nj-controls', app);
    note = h('p', 'nj-note', app);
    note.setAttribute('role', 'status');
    chartBox = h('div', 'nj-chart', app);
    legendBox = h('div', 'nj-legendbox', app);
    readout = h('div', 'nj-readout', app);
    readout.setAttribute('aria-live', 'polite');
    chartBox.addEventListener('keydown', onKey);
    width = Math.floor(app.getBoundingClientRect().width);
    render();
    var timer = 0, last = width;
    function onResize() {
      clearTimeout(timer);
      timer = setTimeout(function () { var w = Math.floor(app.getBoundingClientRect().width); if (w && Math.abs(w - last) > 1) { last = w; width = w; render(); } }, 120);
    }
    if (window.ResizeObserver) new ResizeObserver(onResize).observe(app); else window.addEventListener('resize', onResize);
  }

  fetch(app.getAttribute('data-src'), { credentials: 'same-origin' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(init)
    .catch(function () { app.textContent = 'The chart data could not be loaded. The table below has every figure.'; });
})();
