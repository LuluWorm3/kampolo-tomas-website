// Storage behind the site's counters: one tiny interface (get, set, list, delete) with three backends.
//   Netlify Blobs  when running on Netlify (the @netlify/blobs package declared in netlify/functions/package.json)
//   a folder       for local runs (.local-store/, gitignored)
//   memory         for tests
// Writers never share a key (see stats.mjs: one document per function instance and day), so no read-modify-write races.
import fs from 'node:fs';
import path from 'node:path';

export function memoryStore() {
  const m = new Map();
  return {
    kind: 'memory',
    async get(k) { return m.has(k) ? structuredClone(m.get(k)) : null; },
    async set(k, v) { m.set(k, structuredClone(v)); },
    async list(prefix) { return [...m.keys()].filter((k) => k.startsWith(prefix)).sort(); },
    async delete(k) { m.delete(k); },
  };
}

export function fileStore(dir) {
  const file = (k) => path.join(dir, encodeURIComponent(k) + '.json');
  return {
    kind: 'file',
    async get(k) { try { return JSON.parse(fs.readFileSync(file(k), 'utf8')); } catch { return null; } },
    async set(k, v) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file(k), JSON.stringify(v)); },
    async list(prefix) {
      if (!fs.existsSync(dir)) return [];
      return fs.readdirSync(dir).filter((n) => n.endsWith('.json')).map((n) => decodeURIComponent(n.slice(0, -5))).filter((k) => k.startsWith(prefix)).sort();
    },
    async delete(k) { try { fs.unlinkSync(file(k)); } catch { /* already gone */ } },
  };
}

async function blobsStore() {
  const { getStore } = await import('@netlify/blobs');
  const s = getStore({ name: 'kt-stats' });
  return {
    kind: 'blobs',
    async get(k) { return (await s.get(k, { type: 'json' })) ?? null; },
    async set(k, v) { await s.setJSON(k, v); },
    async list(prefix) { const r = await s.list({ prefix }); return (r.blobs || []).map((b) => b.key).sort(); },
    async delete(k) { await s.delete(k); },
  };
}

let cached = null;
// The store the functions use. Tests and the mock server replace it with setStore().
export async function getDefaultStore(env = process.env) {
  if (cached) return cached;
  const onNetlify = env.NETLIFY || env.NETLIFY_BLOBS_CONTEXT || env.NETLIFY_LOCAL;
  if (onNetlify) {
    try { cached = await blobsStore(); } catch (err) { console.warn(JSON.stringify({ store: 'blobs_unavailable', reason: String(err && err.message || err).slice(0, 80) })); }
  }
  if (!cached) cached = fileStore(path.resolve(env.KT_LOCAL_STORE || '.local-store'));
  return cached;
}
export function setStore(s) { cached = s; }
