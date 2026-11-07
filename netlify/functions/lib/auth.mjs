// Bearer-token check for the owner and metrics endpoints. The token lives only in a Netlify environment variable and in the owner's browser tab.
// Comparison is on SHA-256 digests with timingSafeEqual; wrong tries are delayed and counted per visitor (in memory only, never stored or logged).
import { createHash, timingSafeEqual } from 'node:crypto';

export const MIN_TOKEN_LENGTH = 24;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS = 5;
const fails = new Map();

const digest = (s) => createHash('sha256').update(String(s)).digest();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function resetAuthForTests() { fails.clear(); }

// Returns null when the request is allowed, or a Response to send back.
export async function guard(req, expected, ip = 'unknown', { delayMs = 600, now = Date.now() } = {}) {
  const json = (body, status, extra = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra } });
  if (!expected || String(expected).length < MIN_TOKEN_LENGTH) return json({ error: 'This endpoint is not configured.' }, 503);
  const recent = (fails.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_FAILS) return json({ error: 'Too many wrong tries. Wait a few minutes.' }, 429, { 'Retry-After': '600' });
  const header = req.headers.get('authorization') || '';
  const given = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const ok = given.length > 0 && timingSafeEqual(digest(given), digest(expected));
  if (ok) return null;
  recent.push(now);
  fails.set(ip, recent);
  if (delayMs) await sleep(delayMs);
  return json({ error: 'Not authorised.' }, 401, { 'WWW-Authenticate': 'Bearer' });
}
