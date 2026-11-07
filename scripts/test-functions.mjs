// Tests for the Netlify functions' counters, owner API, metrics and chat cap. Plain node:test, no packages, an in-memory store, no network.
//   node --test scripts/test-functions.mjs     (or: node scripts/test-functions.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryStore, setStore } from '../netlify/functions/lib/store.mjs';
import { parsePing, apply, freshDoc, createRecorder, readDays, lastDays, percentile, sanitizeMessage, tokensToday, resetCapCache, dayKey, VITALS } from '../netlify/functions/lib/stats.mjs';
import { guard, resetAuthForTests } from '../netlify/functions/lib/auth.mjs';

const store = memoryStore();
setStore(store);
const TOKEN = 'owner-token-owner-token-1234567890';
const METRICS = 'metrics-token-metrics-token-12345678';
process.env.OWNER_TOKEN = TOKEN;
process.env.METRICS_TOKEN = METRICS;

const post = (body, headers = {}) => new Request('http://x/api/ping', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers });
const get = (url, token) => new Request('http://x' + url, { headers: token ? { authorization: 'Bearer ' + token } : {} });

test('parsePing accepts the known events and cleans the fields', () => {
  assert.deepEqual(parsePing({ e: 'view', d: 'data', p: '/data/', r: 'Example.COM', w: 'phone' }, 'NA'), { k: 'view', path: '/data/', persona: 'data', ref: 'example.com', device: 'phone', country: 'NA' });
  assert.deepEqual(parsePing({ e: 'view', d: '', p: '/', r: 'not a host', w: 'toaster' }, 'na'), { k: 'view', path: '/', persona: 'corporate', ref: '', device: '', country: '' });
  assert.deepEqual(parsePing({ e: 'swarm', d: 'effect', p: '/' }), { k: 'event', name: 'swarm', detail: 'effect', path: '/' });
  assert.deepEqual(parsePing({ e: 'vital', d: 'LCP', v: 1800, p: '/' }), { k: 'vital', name: 'LCP', value: 1800, path: '/' });
  assert.deepEqual(parsePing({ e: 'feature', d: 'swarm', v: 4200 }), { k: 'feature', name: 'swarm', value: 4200 });
});

test('parsePing refuses anything outside the whitelist or the size and range limits', () => {
  assert.equal(parsePing(null), null);
  assert.equal(parsePing({ e: 'login', d: '', p: '/' }), null);
  assert.equal(parsePing({ e: 'view', d: '<script>', p: '/' }), null);
  assert.equal(parsePing({ e: 'view', d: '', p: '/' + 'a'.repeat(60) }), null);
  assert.equal(parsePing({ e: 'vital', d: 'FOO', v: 1, p: '/' }), null);
  assert.equal(parsePing({ e: 'vital', d: 'LCP', v: -1, p: '/' }), null);
  assert.equal(parsePing({ e: 'vital', d: 'LCP', v: 'fast', p: '/' }), null);
  assert.equal(parsePing({ e: 'vital', d: 'CLS', v: Infinity, p: '/' }), null);
  assert.equal(parsePing({ e: 'error', d: 'boom', p: '/' }), null);
  assert.equal(parsePing({ e: 'feature', d: 'x', v: 1e9, p: '/' }), null);
});

test('error messages lose URLs, e-mail addresses and long numbers, and group by hash', () => {
  const rec = parsePing({ e: 'error', d: 'error', p: '/', m: 'Failed https://x.example/a?token=abc for jo@mail.com id 12345678', f: 'http://x/js/app.js', l: 12 });
  assert.equal(rec.msg, 'Failed <url> for <email> id #');
  assert.equal(rec.file, 'app.js');
  assert.match(rec.hash, /^[0-9a-f]{8}$/);
  assert.equal(parsePing({ e: 'error', d: 'error', p: '/', m: 'Failed https://y.example/b for jo@mail.com id 87654321', f: 'app.js', l: 12 }).hash, rec.hash);
  assert.equal(sanitizeMessage('x'.repeat(500)).length, 120);
  assert.equal(parsePing({ e: 'error', d: 'error', p: '/', m: 'a', f: 'bad name!.js', l: 1 }), null);
});

test('records carry no IP address, user agent or free text', () => {
  const rec = parsePing({ e: 'view', d: 'data', p: '/', ip: '10.1.2.3', ua: 'Mozilla', text: 'hello there' }, 'NA');
  assert.equal(JSON.stringify(rec).includes('10.1.2.3'), false);
  assert.equal(JSON.stringify(rec).includes('Mozilla'), false);
  assert.equal(JSON.stringify(rec).includes('hello'), false);
});

test('each instance writes its own document and readers add them up', async () => {
  const s = memoryStore();
  const a = createRecorder(s, { shard: 'aaaa' });
  const b = createRecorder(s, { shard: 'bbbb' });
  await Promise.all([a.record(parsePing({ e: 'view', d: 'data', p: '/data/' }, 'NA')), b.record(parsePing({ e: 'view', d: 'data', p: '/data/' }, 'ZA')), a.record(parsePing({ e: 'view', d: 'shop', p: '/shop/' }))]);
  await b.record(parsePing({ e: 'error', d: 'error', p: '/', m: 'same', f: 'a.js', l: 1 }));
  await a.record(parsePing({ e: 'error', d: 'error', p: '/', m: 'same', f: 'a.js', l: 1 }));
  const keys = await s.list('stats/');
  assert.equal(keys.length, 2);
  const { total } = await readDays(s, [dayKey()]);
  assert.equal(total.counts['ev|view'], 3);
  assert.equal(total.counts['path|/data/'], 2);
  assert.equal(total.counts['country|NA'], 1);
  assert.equal(total.counts['country|ZA'], 1);
  assert.equal(Object.values(total.errors)[0].n, 2);
});

test('a dimension stops growing at its cap and the rest are counted as other', () => {
  const doc = freshDoc('d');
  for (let i = 0; i < 200; i++) apply(doc, { k: 'view', path: '/p' + i, persona: 'x', ref: '', device: '', country: '' });
  const paths = Object.keys(doc.counts).filter((k) => k.startsWith('path|'));
  assert.ok(paths.length <= 121);
  assert.ok(doc.counts['path|other'] >= 80);
});

test('percentile reads a histogram', () => {
  assert.equal(percentile([0, 0, 0], [10, 20], 0.75), null);
  assert.equal(percentile([4, 0, 0], [10, 20], 0.75), 10);
  assert.equal(percentile([1, 1, 2], [10, 20], 0.75), 30);
  assert.equal(percentile([1, 1, 2], [10, 20], 0.25), 10);
});

test('ping handler: methods, size, validation, counting, rate limit, and nothing identifying is stored', async () => {
  const ping = await import('../netlify/functions/ping.mjs');
  ping.resetForTests();
  assert.equal((await ping.default(new Request('http://x/api/ping'), {})).status, 405);
  assert.equal((await ping.default(post('x'.repeat(2000)), {})).status, 413);
  assert.equal((await ping.default(post('not json'), {})).status, 400);
  assert.equal((await ping.default(post({ e: 'nope', d: '', p: '/' }), {})).status, 400);
  const res = await ping.default(post({ e: 'view', d: 'shop', p: '/shop/', r: 'news.example', w: 'desktop' }), { ip: '203.0.113.77', geo: { country: { code: 'NA' } } });
  assert.equal(res.status, 204);
  const keys = await store.list('stats/');
  assert.equal(keys.length, 1);
  const dump = JSON.stringify(await store.get(keys[0]));
  assert.ok(dump.includes('ref|news.example'));
  assert.ok(dump.includes('country|NA'));
  assert.equal(dump.includes('203.0.113.77'), false);
  let last;
  for (let i = 0; i < 125; i++) last = await ping.default(post({ e: 'chat', d: '', p: '/' }), { ip: '198.51.100.9' });
  assert.equal(last.status, 429);
});

test('auth guard: not configured, short token, wrong, right, and lock-out after repeated misses', async () => {
  resetAuthForTests();
  const r = (t) => new Request('http://x/', { headers: t ? { authorization: 'Bearer ' + t } : {} });
  assert.equal((await guard(r(TOKEN), undefined, 'ip1', { delayMs: 0 })).status, 503);
  assert.equal((await guard(r('short'), 'short', 'ip1', { delayMs: 0 })).status, 503);
  assert.equal((await guard(r(), TOKEN, 'ip2', { delayMs: 0 })).status, 401);
  assert.equal((await guard(r('wrong'), TOKEN, 'ip2', { delayMs: 0 })).status, 401);
  assert.equal(await guard(r(TOKEN), TOKEN, 'ip2', { delayMs: 0 }), null);
  for (let i = 0; i < 5; i++) await guard(r('nope' + i), TOKEN, 'ip3', { delayMs: 0 });
  assert.equal((await guard(r(TOKEN), TOKEN, 'ip3', { delayMs: 0 })).status, 429);
  const resp = await guard(r('x'), TOKEN, 'ip4', { delayMs: 0 });
  assert.equal(resp.headers.get('cache-control'), 'no-store');
});

test('owner API: needs the token, returns aggregates, config shows only true or false', async () => {
  resetAuthForTests();
  const owner = await import('../netlify/functions/owner.mjs');
  assert.equal((await owner.default(get('/api/owner/summary'), { ip: 'o1' })).status, 401);
  const ok = await owner.default(get('/api/owner/summary?days=7', TOKEN), { ip: 'o2' });
  assert.equal(ok.status, 200);
  const body = await ok.json();
  assert.equal(body.days.length, 7);
  assert.ok(body.views.total >= 1);
  assert.ok(body.paths.some((p) => p.key === '/shop/'));
  assert.ok(body.vitals.LCP && body.vitals.CLS && body.vitals.INP && body.vitals.TTFB);
  assert.equal(JSON.stringify(body).includes(TOKEN), false);
  const cfg = await (await owner.default(get('/api/owner/config', TOKEN), { ip: 'o2' })).json();
  assert.equal(cfg.ownerToken, true);
  assert.equal(JSON.stringify(cfg).includes(TOKEN), false);
  assert.equal(JSON.stringify(cfg).includes(METRICS), false);
  assert.equal((await owner.default(get('/api/owner/nothing', TOKEN), { ip: 'o2' })).status, 404);
  assert.equal((await owner.default(new Request('http://x/api/owner/summary', { method: 'POST', headers: { authorization: 'Bearer ' + TOKEN } }), { ip: 'o2' })).status, 405);
});

test('metrics: token required and the text format is valid', async () => {
  resetAuthForTests();
  const m = await import('../netlify/functions/metrics.mjs');
  assert.equal((await m.default(get('/api/metrics', TOKEN), { ip: 'm1' })).status, 401);
  const res = await m.default(get('/api/metrics', METRICS), { ip: 'm2' });
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.match(res.headers.get('content-type'), /text\/plain/);
  assert.match(text, /# TYPE kt_events_total counter/);
  const bad = text.split('\n').filter((l) => l && !l.startsWith('#') && !/^[a-zA-Z_:][a-zA-Z0-9_:]*(\{([a-z_]+="[^"\n]*"(,|(?=\})))+\})? -?\d+(\.\d+)?$/.test(l));
  assert.deepEqual(bad, []);
  assert.match(text, /kt_page_views_total\{path="\/shop\/"\} 1/);
  assert.match(text, /kt_web_vital_bucket_total\{vital="LCP",le="\+Inf"\}/);
  assert.equal(Object.keys(VITALS).every((v) => text.includes(`vital="${v}"`)), true);
});

test('chat: the daily token cap blocks the request, and a normal answer records tokens (numbers only)', async () => {
  const chat = await import('../netlify/functions/chat.mjs');
  const realFetch = globalThis.fetch;
  process.env.ANTHROPIC_API_KEY = 'test-key';
  process.env.CHAT_PROVIDERS = 'claude';
  process.env.CLAUDE_MODELS = 'claude-sonnet-5-5';
  globalThis.fetch = async (url) => {
    if (String(url).includes('api.anthropic.com')) return new Response(JSON.stringify({ content: [{ type: 'text', text: 'He builds apps.' }], usage: { input_tokens: 1200, output_tokens: 40 } }), { status: 200 });
    return realFetch(url);
  };
  try {
    resetCapCache();
    process.env.CHAT_DAILY_TOKEN_CAP = '5000';
    const ask = (ip) => chat.default(new Request('http://x/api/chat', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: 'What has he built?' }] }) }), { ip });
    const first = await ask('c1');
    assert.equal(first.status, 200);
    assert.equal((await first.json()).reply, 'He builds apps.');
    await new Promise((r) => setTimeout(r, 20));
    const { total } = await readDays(store, [dayKey()]);
    assert.equal(total.counts['chat|in'], 1200);
    assert.equal(total.counts['chat|out'], 40);
    assert.equal(total.counts['chat|status|ok'], 1);
    assert.equal(JSON.stringify(total).includes('What has he built'), false);
    assert.equal(JSON.stringify(total).includes('He builds apps'), false);
    for (let i = 0; i < 4; i++) await ask('c' + (i + 2));
    await new Promise((r) => setTimeout(r, 20));
    const blocked = await ask('c9');
    assert.equal(blocked.status, 503);
    assert.match((await blocked.json()).error, /resting/);
    await new Promise((r) => setTimeout(r, 20));
    const after = await readDays(store, [dayKey()]);
    assert.ok(after.total.counts['chat|status|capped'] >= 1);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.CHAT_DAILY_TOKEN_CAP;
    resetCapCache();
  }
});

test('lastDays gives consecutive dates ending today and tokensToday sums across instances', async () => {
  const days = lastDays(3);
  assert.equal(days.length, 3);
  assert.equal(days[2], dayKey());
  const s = memoryStore();
  await createRecorder(s, { shard: 's1' }).record({ k: 'chat_usage', status: 'ok', tokensIn: 10, tokensOut: 5 });
  await createRecorder(s, { shard: 's2' }).record({ k: 'chat_usage', status: 'ok', tokensIn: 20, tokensOut: 5 });
  resetCapCache();
  assert.equal(await tokensToday(s, { ttl: 0 }), 40);
});
