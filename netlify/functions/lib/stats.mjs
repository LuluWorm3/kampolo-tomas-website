// Privacy-friendly counters. What is kept: event names, page paths, persona names, referrer host, two-letter country, device class, error groups
// (a sanitised message, file name and line) and numbers (timings, token counts). Never kept: IP addresses, user agents, cookies, message text.
//
// Concurrency: every function instance writes only its own document per day (`stats/<day>/<shard>`), holding the running totals since that instance
// started. Readers list the day's documents and add them up. No two writers share a key, so there is no read-modify-write race.
import { randomBytes } from 'node:crypto';

export const EVENTS = new Set(['view', 'persona', 'chat', 'match', 'swarm', 'download', 'doc_request', 'vital', 'error', 'feature', 'edition']);
export const DEVICES = new Set(['phone', 'tablet', 'desktop']);
export const ERROR_KINDS = new Set(['error', 'rejection', 'csp']);

// Web Vitals: bucket edges (upper bounds) and the "good" and "poor" thresholds from web.dev.
export const VITALS = {
  LCP: { edges: [500, 1000, 1500, 2000, 2500, 3000, 4000, 6000, 10000], good: 2500, poor: 4000, unit: 'ms' },
  INP: { edges: [50, 100, 150, 200, 300, 500, 800, 1500], good: 200, poor: 500, unit: 'ms' },
  CLS: { edges: [0.01, 0.05, 0.1, 0.15, 0.25, 0.5, 1], good: 0.1, poor: 0.25, unit: '' },
  TTFB: { edges: [100, 200, 400, 800, 1200, 1800, 3000], good: 800, poor: 1800, unit: 'ms' },
};
export const FEATURE_EDGES = [100, 250, 500, 1000, 2000, 4000, 8000, 16000, 32000];

const SAFE = /^[\w .:/-]{0,40}$/;
const HOST = /^[a-z0-9]([a-z0-9.-]{0,58}[a-z0-9])?$/;
const FILE = /^[\w.-]{0,60}$/;
const MAX_KEYS_PER_DIM = 120;
const MAX_ERRORS = 60;

export function bucket(value, edges) {
  for (let i = 0; i < edges.length; i++) if (value <= edges[i]) return i;
  return edges.length;
}

// Approximate percentile from a histogram of bucket counts; returns the upper edge of the bucket holding it (null when empty).
export function percentile(counts, edges, p) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return null;
  let run = 0;
  for (let i = 0; i < counts.length; i++) {
    run += counts[i];
    if (run / total >= p) return i < edges.length ? edges[i] : edges[edges.length - 1] * 1.5;
  }
  return edges[edges.length - 1];
}

export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// Error text from the browser can hold URLs, e-mail addresses or long numbers: keep the shape, drop the specifics.
export function sanitizeMessage(s) {
  return String(s || '')
    .replace(/https?:\/\/\S+/gi, '<url>')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<email>')
    .replace(/\d{4,}/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

// Turns a request body into a clean record, or null when it is not acceptable. geo is the two-letter country code, if the platform gives one.
export function parsePing(body, geo = '') {
  if (!body || typeof body !== 'object') return null;
  const str = (v) => (typeof v === 'string' ? v : '');
  const e = str(body.e);
  const d = str(body.d);
  const p = str(body.p);
  if (!EVENTS.has(e) || !SAFE.test(p)) return null;
  const country = /^[A-Z]{2}$/.test(geo) ? geo : '';
  const num = (v, max) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : null);
  if (e === 'vital') {
    const value = num(body.v, 600000);
    if (!VITALS[d] || value === null) return null;
    return { k: 'vital', name: d, value, path: p };
  }
  if (e === 'error') {
    const kind = ERROR_KINDS.has(d) ? d : '';
    const file = str(body.f).split(/[\\/]/).pop();
    if (!kind || !FILE.test(file)) return null;
    const msg = sanitizeMessage(body.m);
    const line = num(body.l, 1000000) ?? 0;
    return { k: 'error', kind, msg, file, line, path: p, hash: hashStr(kind + '|' + msg + '|' + file + '|' + line) };
  }
  if (e === 'feature') {
    const value = num(body.v, 10000000);
    if (!SAFE.test(d) || !d || value === null) return null;
    return { k: 'feature', name: d, value };
  }
  if (!SAFE.test(d)) return null;
  if (e === 'view') {
    const ref = str(body.r).toLowerCase();
    const device = str(body.w);
    return { k: 'view', path: p, persona: d || 'corporate', ref: HOST.test(ref) ? ref : '', device: DEVICES.has(device) ? device : '', country };
  }
  return { k: 'event', name: e, detail: d, path: p };
}

export function freshDoc(day) {
  return { v: 1, day, counts: {}, errors: {} };
}

function bump(doc, dim, key, n = 1) {
  const full = dim + '|' + key;
  if (!(full in doc.counts)) {
    let same = 0;
    const pre = dim + '|';
    for (const k in doc.counts) if (k.startsWith(pre)) same++;
    if (same >= MAX_KEYS_PER_DIM) { doc.counts[dim + '|other'] = (doc.counts[dim + '|other'] || 0) + n; return; }
  }
  doc.counts[full] = (doc.counts[full] || 0) + n;
}

// Adds one record to a day document (pure: no storage). now is an ISO time used for error first/last seen.
export function apply(doc, rec, now = new Date().toISOString()) {
  if (rec.k === 'view') {
    bump(doc, 'ev', 'view');
    bump(doc, 'path', rec.path || '/');
    bump(doc, 'persona', rec.persona);
    if (rec.ref) bump(doc, 'ref', rec.ref);
    if (rec.country) bump(doc, 'country', rec.country);
    if (rec.device) bump(doc, 'device', rec.device);
  } else if (rec.k === 'event') {
    bump(doc, 'ev', rec.name);
    if (rec.detail) bump(doc, 'det', rec.name + ':' + rec.detail);
  } else if (rec.k === 'vital') {
    const i = bucket(rec.value, VITALS[rec.name].edges);
    bump(doc, 'vital', rec.name + '|' + i);
    if (rec.path) bump(doc, 'vitalp', rec.path + '|' + rec.name + '|' + i);
  } else if (rec.k === 'feature') {
    bump(doc, 'feat', rec.name + '|n');
    bump(doc, 'feat', rec.name + '|ms', Math.round(rec.value));
    bump(doc, 'featb', rec.name + '|' + bucket(rec.value, FEATURE_EDGES));
  } else if (rec.k === 'error') {
    bump(doc, 'ev', 'error');
    const x = doc.errors[rec.hash];
    if (x) { x.n++; x.last = now; } else if (Object.keys(doc.errors).length < MAX_ERRORS) doc.errors[rec.hash] = { n: 1, kind: rec.kind, msg: rec.msg, file: rec.file, line: rec.line, path: rec.path, first: now, last: now };
    else bump(doc, 'ev', 'error_overflow');
  } else if (rec.k === 'chat_usage') {
    bump(doc, 'chat', 'req');
    bump(doc, 'chat', 'status|' + rec.status);
    if (rec.tokensIn) bump(doc, 'chat', 'in', rec.tokensIn);
    if (rec.tokensOut) bump(doc, 'chat', 'out', rec.tokensOut);
    if (rec.model) { bump(doc, 'chatm', rec.model + '|in', rec.tokensIn || 0); bump(doc, 'chatm', rec.model + '|out', rec.tokensOut || 0); }
    if (rec.failovers) bump(doc, 'chat', 'failovers', rec.failovers);
    if (rec.ms) { bump(doc, 'chat', 'ms', Math.round(rec.ms)); }
    if (rec.mode) bump(doc, 'chat', 'mode|' + rec.mode);
  }
  return doc;
}

export function dayKey(d = new Date()) { return d.toISOString().slice(0, 10); }
export function newShard() { return randomBytes(4).toString('hex'); }

// Records into this instance's own document for the current day and writes it to the store.
export function createRecorder(store, { now = () => new Date(), shard = newShard() } = {}) {
  let day = '';
  let doc = null;
  let chain = Promise.resolve();
  return {
    shard,
    record(rec) {
      const t = now();
      const d = dayKey(t);
      if (d !== day) { day = d; doc = freshDoc(d); }
      apply(doc, rec, t.toISOString());
      const snapshot = structuredClone(doc);
      const key = `stats/${d}/${shard}`;
      chain = chain.then(() => store.set(key, snapshot)).catch((err) => { console.warn(JSON.stringify({ stats: 'write_failed', reason: String(err && err.message || err).slice(0, 80) })); });
      return chain;
    },
  };
}

export function mergeInto(total, doc) {
  for (const k in doc.counts) total.counts[k] = (total.counts[k] || 0) + doc.counts[k];
  for (const h in doc.errors) {
    const e = doc.errors[h];
    const x = total.errors[h];
    if (!x) total.errors[h] = { ...e };
    else { x.n += e.n; if (e.first < x.first) x.first = e.first; if (e.last > x.last) x.last = e.last; }
  }
  return total;
}

export function lastDays(n, now = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(dayKey(new Date(now.getTime() - i * 86400000)));
  return out;
}

// Reads and adds up every instance's document for each day. Returns { byDay: { 'YYYY-MM-DD': doc }, total: doc }.
export async function readDays(store, days) {
  const byDay = {};
  const total = freshDoc('total');
  for (const d of days) {
    const day = freshDoc(d);
    for (const key of await store.list(`stats/${d}/`)) {
      const doc = await store.get(key);
      if (doc && doc.counts) mergeInto(day, doc);
    }
    byDay[d] = day;
    mergeInto(total, day);
  }
  return { byDay, total };
}

// Deletes day documents older than keepDays. Called opportunistically by the owner endpoint.
export async function prune(store, keepDays = 90, now = new Date()) {
  const cutoff = dayKey(new Date(now.getTime() - keepDays * 86400000));
  let n = 0;
  for (const key of await store.list('stats/')) {
    const day = key.split('/')[1];
    if (day && day < cutoff) { await store.delete(key); n++; }
  }
  return n;
}

// Today's chat tokens across all instances, cached briefly so the chat function does not read the store on every request.
const capCache = { at: 0, tokens: 0 };
export async function tokensToday(store, { now = Date.now(), ttl = 30000 } = {}) {
  if (now - capCache.at < ttl) return capCache.tokens;
  const { total } = await readDays(store, [dayKey(new Date(now))]);
  capCache.tokens = (total.counts['chat|in'] || 0) + (total.counts['chat|out'] || 0);
  capCache.at = now;
  return capCache.tokens;
}
export function resetCapCache() { capCache.at = 0; capCache.tokens = 0; }
// The instance that just spent tokens knows about them at once; other instances catch up within the cache time.
export function addTokensToCache(n) { capCache.tokens += n; }
