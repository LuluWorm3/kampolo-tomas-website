// Fills a store with 30 days of made-up traffic so the owner page can be previewed locally (node scripts/dev.mjs --mock-api) and tested.
// Everything here is invented: the numbers, the referrer hosts (reserved example names), the error and the model name. Never used on the live site.
import { createRecorder, parsePing, VITALS } from '../netlify/functions/lib/stats.mjs';

function rng(seed) {
  let a = seed;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export async function seed(store, { days = 30, now = new Date() } = {}) {
  const r = rng(7);
  const pick = (list, weights) => { const t = weights.reduce((a, b) => a + b, 0); let x = r() * t; for (let i = 0; i < list.length; i++) { x -= weights[i]; if (x <= 0) return list[i]; } return list[0]; };
  const PATHS = [['/', 'corporate'], ['/data/', 'data'], ['/design/', 'design'], ['/shop/', 'shop'], ['/bank/', 'bank'], ['/cv/', 'corporate'], ['/lab/namibia-jobs/', 'data']];
  const REFS = ['', 'example.org', 'search.example', 'social.example', 'jobs.example'];
  const COUNTRIES = ['NA', 'ZA', 'US', 'GB', 'DE', ''];
  const VITAL_CENTRE = { LCP: 1900, INP: 120, CLS: 0.05, TTFB: 350 };
  for (let back = days - 1; back >= 0; back--) {
    const t = new Date(now.getTime() - back * 86400000);
    const rec = createRecorder(store, { now: () => t, shard: 'demo' + back });
    const views = 12 + Math.floor(r() * 30) + (back % 7 === 1 ? 20 : 0);
    for (let i = 0; i < views; i++) {
      const [p, persona] = pick(PATHS, [8, 4, 3, 2, 1, 3, 2]);
      await rec.record(parsePing({ e: 'view', d: persona, p, r: pick(REFS, [6, 2, 2, 1, 2]), w: pick(['desktop', 'phone', 'tablet'], [5, 4, 1]) }, pick(COUNTRIES, [6, 2, 1, 1, 1, 1])));
      if (r() < 0.8) for (const name of Object.keys(VITALS)) {
        const c = VITAL_CENTRE[name];
        await rec.record(parsePing({ e: 'vital', d: name, v: Math.max(0, c * (0.4 + r() * 1.6)), p }));
      }
      if (r() < 0.12) await rec.record(parsePing({ e: 'chat', d: '', p }));
      if (r() < 0.06) await rec.record(parsePing({ e: 'swarm', d: 'effect', p }));
      if (r() < 0.05) await rec.record(parsePing({ e: 'download', d: 'Kampolo-Tomas-CV.pdf', p }));
      if (r() < 0.1) { const ed = pick(['swiss-plus', 'neural-plus', 'cosmos-plus', 'editorial-plus', 'renaissance-plus'], [2, 3, 3, 2, 3]); await rec.record(parsePing({ e: 'edition', d: ed, p })); await rec.record(parsePing({ e: 'feature', d: 'edition:' + ed, v: 200 + r() * 1800 })); }
      if (r() < 0.04) await rec.record(parsePing({ e: 'feature', d: 'swarm', v: 9000 + r() * 6000 }));
      if (r() < 0.03) await rec.record(parsePing({ e: 'error', d: 'error', p, m: 'Cannot read properties of null (reading style)', f: 'script.js', l: 612 }));
    }
    const chats = Math.floor(r() * 7);
    for (let i = 0; i < chats; i++) await rec.record({ k: 'chat_usage', status: 'ok', mode: r() < 0.8 ? 'chat' : 'match', provider: 'demo', model: 'demo-model', failovers: r() < 0.05 ? 1 : 0, tokensIn: 1800 + Math.floor(r() * 600), tokensOut: 120 + Math.floor(r() * 200), ms: 900 + r() * 1500 });
    if (back === 0) { await rec.record({ k: 'chat_usage', status: 'ratelimited' }); await rec.record({ k: 'chat_usage', status: 'failed', failovers: 2 }); }
  }
}
