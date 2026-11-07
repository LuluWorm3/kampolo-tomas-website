// Private owner API: aggregates of the site's own counters. Every route needs the OWNER_TOKEN bearer token (see lib/auth.mjs).
// GET /api/owner/summary?days=7   traffic, referrers, countries, devices, events, Web Vitals, feature timings, error groups, chat usage and cost
// GET /api/owner/config           which settings are present (true or false only, never values)
import { guard, MIN_TOKEN_LENGTH } from './lib/auth.mjs';
import { getDefaultStore } from './lib/store.mjs';
import { readDays, lastDays, prune, tokensToday, VITALS, FEATURE_EDGES, percentile } from './lib/stats.mjs';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

function top(counts, dim, n = 12) {
  const pre = dim + '|';
  return Object.entries(counts).filter(([k]) => k.startsWith(pre)).map(([k, v]) => ({ key: k.slice(pre.length), n: v })).sort((a, b) => b.n - a.n).slice(0, n);
}
const get = (counts, k) => counts[k] || 0;

function vitalSummary(counts, name) {
  const edges = VITALS[name].edges;
  const buckets = edges.map((_, i) => get(counts, `vital|${name}|${i}`)).concat([get(counts, `vital|${name}|${edges.length}`)]);
  const n = buckets.reduce((a, b) => a + b, 0);
  const p75 = percentile(buckets, edges, 0.75);
  const rating = p75 === null ? 'none' : p75 <= VITALS[name].good ? 'good' : p75 <= VITALS[name].poor ? 'needs improvement' : 'poor';
  return { n, p75, good: VITALS[name].good, poor: VITALS[name].poor, unit: VITALS[name].unit, rating, buckets };
}

export function buildSummary(total, byDay, days, env = {}, extra = {}) {
  const c = total.counts;
  const vitals = {};
  for (const name of Object.keys(VITALS)) vitals[name] = vitalSummary(c, name);
  const paths = top(c, 'path', 10).map((x) => x.key);
  const vitalsByPath = {};
  for (const p of paths) {
    const row = {};
    for (const name of Object.keys(VITALS)) {
      const edges = VITALS[name].edges;
      const b = edges.map((_, i) => get(c, `vitalp|${p}|${name}|${i}`)).concat([get(c, `vitalp|${p}|${name}|${edges.length}`)]);
      row[name] = { n: b.reduce((x, y) => x + y, 0), p75: percentile(b, edges, 0.75) };
    }
    vitalsByPath[p] = row;
  }
  const featNames = [...new Set(Object.keys(c).filter((k) => k.startsWith('feat|')).map((k) => k.split('|')[1]))];
  const features = featNames.map((name) => {
    const n = get(c, `feat|${name}|n`);
    const b = FEATURE_EDGES.map((_, i) => get(c, `featb|${name}|${i}`)).concat([get(c, `featb|${name}|${FEATURE_EDGES.length}`)]);
    return { name, n, avgMs: n ? Math.round(get(c, `feat|${name}|ms`) / n) : 0, p75Ms: percentile(b, FEATURE_EDGES, 0.75) };
  }).sort((a, b) => b.n - a.n);
  const errors = Object.entries(total.errors).map(([hash, e]) => ({ hash, ...e })).sort((a, b) => (a.last < b.last ? 1 : -1)).slice(0, 40);

  let prices = {};
  try { prices = env.CHAT_PRICES ? JSON.parse(env.CHAT_PRICES) : {}; } catch { prices = {}; }
  const models = [...new Set(Object.keys(c).filter((k) => k.startsWith('chatm|')).map((k) => k.split('|')[1]))].map((model) => {
    const tin = get(c, `chatm|${model}|in`);
    const tout = get(c, `chatm|${model}|out`);
    const pr = prices[model];
    return { model, tokensIn: tin, tokensOut: tout, estimatedUSD: pr && Number.isFinite(pr.in) && Number.isFinite(pr.out) ? Math.round((tin * pr.in + tout * pr.out) / 1e4) / 100 : null };
  });
  const okCount = get(c, 'chat|status|ok');
  return {
    generated: new Date().toISOString(),
    days,
    views: { total: get(c, 'ev|view'), byDay: days.map((d) => ({ day: d, views: get(byDay[d].counts, 'ev|view') })) },
    paths: top(c, 'path'),
    personas: top(c, 'persona'),
    referrers: top(c, 'ref'),
    countries: top(c, 'country'),
    devices: top(c, 'device'),
    events: Object.fromEntries(['chat', 'match', 'swarm', 'download', 'doc_request', 'persona', 'edition', 'error'].map((e) => [e, get(c, 'ev|' + e)])),
    details: top(c, 'det', 20),
    vitals,
    vitalsByPath,
    features,
    errors,
    chat: {
      requests: get(c, 'chat|req'),
      ok: okCount, failed: get(c, 'chat|status|failed'), capped: get(c, 'chat|status|capped'), ratelimited: get(c, 'chat|status|ratelimited'),
      tokensIn: get(c, 'chat|in'), tokensOut: get(c, 'chat|out'), failovers: get(c, 'chat|failovers'),
      avgMs: okCount ? Math.round(get(c, 'chat|ms') / okCount) : 0,
      byMode: top(c, 'chat', 60).filter((x) => x.key.startsWith('mode|')).map((x) => ({ mode: x.key.slice(5), n: x.n })),
      models,
      cap: { tokensToday: extra.tokensToday ?? 0, dailyCap: Number(env.CHAT_DAILY_TOKEN_CAP) > 0 ? Number(env.CHAT_DAILY_TOKEN_CAP) : 400000 },
      priceConfigured: Object.keys(prices).length > 0,
    },
    notes: { store: extra.store || '', counting: 'Counts are written per function instance and added up here; a request that arrives while an instance is being replaced can be missed, so treat small differences as noise.' },
  };
}

export function configStatus(env, store) {
  return {
    ownerToken: Boolean(env.OWNER_TOKEN && env.OWNER_TOKEN.length >= MIN_TOKEN_LENGTH),
    metricsToken: Boolean(env.METRICS_TOKEN && env.METRICS_TOKEN.length >= MIN_TOKEN_LENGTH),
    chatKey: Boolean(env.ANTHROPIC_API_KEY),
    chatDailyCap: Boolean(Number(env.CHAT_DAILY_TOKEN_CAP) > 0),
    chatPrices: Boolean(env.CHAT_PRICES),
    sentryDsn: Boolean(env.SENTRY_DSN),
    store: store ? store.kind : 'none',
  };
}

export default async (req, context) => {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  const ip = context?.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown';
  const denied = await guard(req, process.env.OWNER_TOKEN, ip);
  if (denied) return denied;

  const url = new URL(req.url);
  const route = url.pathname.replace(/^\/api\/owner\/?/, '').replace(/\/$/, '');
  const store = await getDefaultStore();

  if (route === 'config') return json(configStatus(process.env, store));
  if (route === 'summary' || route === '') {
    const requested = Number(url.searchParams.get('days'));
    const n = [1, 7, 30, 90].includes(requested) ? requested : 7;
    const days = lastDays(n);
    const { byDay, total } = await readDays(store, days);
    let tokens = 0;
    try { tokens = await tokensToday(store, { ttl: 0 }); } catch { tokens = 0; }
    prune(store, 90).catch(() => {});
    return json(buildSummary(total, byDay, days, process.env, { tokensToday: tokens, store: store.kind }));
  }
  return json({ error: 'Not found' }, 404);
};

export const config = { path: '/api/owner/*' };
