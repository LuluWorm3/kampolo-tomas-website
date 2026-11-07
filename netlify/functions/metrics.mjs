// Prometheus text exposition of the site's counters, for a Prometheus, Grafana Alloy or Grafana Cloud scraper. Prometheus pulls from running
// servers and this site is static, so this endpoint is the bridge. Needs METRICS_TOKEN as a bearer token (a different token from OWNER_TOKEN, so a
// scraper can be given read access to numbers only). Counters add up every retained day (90 days); when old days drop off a counter can fall,
// which Prometheus treats as a reset. Labels stay low-cardinality (paths and models are capped in the store).
import { guard } from './lib/auth.mjs';
import { getDefaultStore } from './lib/store.mjs';
import { readDays, lastDays, tokensToday, VITALS } from './lib/stats.mjs';

const esc = (v) => String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
const line = (name, labels, value) => {
  const l = Object.entries(labels).map(([k, v]) => `${k}="${esc(v)}"`).join(',');
  return `${name}${l ? '{' + l + '}' : ''} ${value}`;
};

export function render(total, extra = {}) {
  const c = total.counts;
  const out = [];
  const family = (name, help, type, rows) => { out.push(`# HELP ${name} ${help}`, `# TYPE ${name} ${type}`, ...rows); };
  const bydim = (dim) => Object.entries(c).filter(([k]) => k.startsWith(dim + '|')).map(([k, v]) => [k.slice(dim.length + 1), v]);

  family('kt_events_total', 'Events counted on the site, by event name.', 'counter', bydim('ev').map(([k, v]) => line('kt_events_total', { event: k }, v)));
  family('kt_page_views_total', 'Page views by path.', 'counter', bydim('path').map(([k, v]) => line('kt_page_views_total', { path: k }, v)));
  family('kt_persona_views_total', 'Page views by persona view.', 'counter', bydim('persona').map(([k, v]) => line('kt_persona_views_total', { persona: k }, v)));
  family('kt_device_views_total', 'Page views by device class.', 'counter', bydim('device').map(([k, v]) => line('kt_device_views_total', { device: k }, v)));
  family('kt_errors_total', 'Browser errors reported.', 'counter', [line('kt_errors_total', {}, c['ev|error'] || 0)]);
  const chat = (k) => c['chat|' + k] || 0;
  family('kt_chat_requests_total', 'Chat requests by outcome.', 'counter', ['ok', 'failed', 'capped', 'ratelimited'].map((s) => line('kt_chat_requests_total', { status: s }, chat('status|' + s))));
  family('kt_chat_tokens_total', 'Chat tokens used, by direction.', 'counter', [line('kt_chat_tokens_total', { direction: 'in' }, chat('in')), line('kt_chat_tokens_total', { direction: 'out' }, chat('out'))]);
  family('kt_chat_failovers_total', 'Times the chat moved to the next provider or model.', 'counter', [line('kt_chat_failovers_total', {}, chat('failovers'))]);
  const vrows = [];
  for (const [name, def] of Object.entries(VITALS)) {
    let run = 0;
    def.edges.forEach((edge, i) => { run += c[`vital|${name}|${i}`] || 0; vrows.push(line('kt_web_vital_bucket_total', { vital: name, le: edge }, run)); });
    run += c[`vital|${name}|${def.edges.length}`] || 0;
    vrows.push(line('kt_web_vital_bucket_total', { vital: name, le: '+Inf' }, run));
  }
  family('kt_web_vital_bucket_total', 'Web Vitals samples at or below each upper bound (cumulative).', 'counter', vrows);
  family('kt_chat_tokens_today', 'Chat tokens used so far today across all instances.', 'gauge', [line('kt_chat_tokens_today', {}, extra.tokensToday || 0)]);
  family('kt_chat_daily_token_cap', 'The daily chat token cap.', 'gauge', [line('kt_chat_daily_token_cap', {}, extra.dailyCap || 0)]);
  return out.join('\n') + '\n';
}

export default async (req, context) => {
  if (req.method !== 'GET') return new Response(null, { status: 405 });
  const ip = context?.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown';
  const denied = await guard(req, process.env.METRICS_TOKEN, ip);
  if (denied) return denied;
  const store = await getDefaultStore();
  const { total } = await readDays(store, lastDays(90));
  let tokens = 0;
  try { tokens = await tokensToday(store, { ttl: 0 }); } catch { tokens = 0; }
  const cap = Number(process.env.CHAT_DAILY_TOKEN_CAP) > 0 ? Number(process.env.CHAT_DAILY_TOKEN_CAP) : 400000;
  return new Response(render(total, { tokensToday: tokens, dailyCap: cap }), { headers: { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8', 'Cache-Control': 'no-store' } });
};

export const config = { path: '/api/metrics' };
