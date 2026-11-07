// Privacy-friendly event counter. Receives an event name, a short detail and the page path (plus, for some events, a referrer host, a device class,
// a Web Vital, a sanitised error or a feature timing: see lib/stats.mjs for the exact fields). It stores only counts: each instance keeps its own
// per-day document in the store, and each event is also one line in the Netlify function log. No IP address, user agent, cookie or message text
// is kept. The visitor's IP is used for an in-memory rate limit only and is never written anywhere.
import { parsePing, createRecorder } from './lib/stats.mjs';
import { getDefaultStore } from './lib/store.mjs';

const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 120;
const hits = new Map();

// Local development and tests send everything from one loopback address; real visitors never do.
const LOOPBACK = /^(::1|127\.|::ffff:127\.)/;

function limited(ip, now = Date.now()) {
  if (LOOPBACK.test(ip)) return false;
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 2000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  return recent.length > MAX_PER_WINDOW;
}

let recorder = null;
async function getRecorder() {
  if (!recorder) recorder = createRecorder(await getDefaultStore());
  return recorder;
}
export function resetForTests() { recorder = null; hits.clear(); }

export default async (req, context) => {
  if (req.method !== 'POST') return new Response(null, { status: 405 });

  const ip = context?.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown';
  if (limited(ip)) return new Response(null, { status: 429 });

  let body;
  try {
    const text = await req.text();
    if (text.length > 1024) return new Response(null, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }

  const rec = parsePing(body, context?.geo?.country?.code || '');
  if (!rec) return new Response(null, { status: 400 });

  // The log line keeps the original shape for the simple events and adds the clean error group for errors.
  console.log(JSON.stringify(rec.k === 'error' ? { event: 'error', kind: rec.kind, hash: rec.hash, path: rec.path } : { event: rec.name || rec.k, detail: rec.detail || rec.persona || '', path: rec.path || '' }));
  try { await (await getRecorder()).record(rec); } catch { /* counting must never break the page */ }
  return new Response(null, { status: 204 });
};

export const config = { path: '/api/ping' };
