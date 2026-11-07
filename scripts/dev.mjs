// Local dev server: serves the site and runs the Netlify functions at /api/*, reading secrets from .env.
// Usage: node scripts/dev.mjs [port] [--mock-api]   (default 8888). No packages needed.
// --mock-api serves the owner and metrics endpoints from an in-memory store filled with made-up demo traffic, with the tokens printed at start,
// so the /owner/ page can be previewed and tested without Netlify. Without it the endpoints use the .env tokens and a local .local-store/ folder.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a))) || 8888;
const mock = process.argv.includes('--mock-api');

const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#') && m[2] && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.pdf': 'application/pdf', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
};
// Mirrors the 404 rules in netlify.toml, and never serves dotfiles such as .env.
const BLOCKED = /^\/(\.|docs\/|netlify\/|scripts\/|AGENTS\.md|CLAUDE\.md|README\.md)|\/\./i;

const fn = (name) => () => import(pathToFileURL(path.join(root, 'netlify/functions/' + name + '.mjs')).href);
const functions = {
  '/api/chat': fn('chat'),
  '/api/ping': fn('ping'),
  '/api/metrics': fn('metrics'),
};
const OWNER_PREFIX = '/api/owner';

if (mock) {
  process.env.OWNER_TOKEN = process.env.OWNER_TOKEN || 'demo-owner-token-demo-owner-12345';
  process.env.METRICS_TOKEN = process.env.METRICS_TOKEN || 'demo-metrics-token-demo-metrics-1234';
  const { memoryStore, setStore } = await import(pathToFileURL(path.join(root, 'netlify/functions/lib/store.mjs')).href);
  const { seed } = await import(pathToFileURL(path.join(root, 'scripts/seed-demo-stats.mjs')).href);
  const store = memoryStore();
  await seed(store);
  setStore(store);
}

async function runFunction(mod, req, res) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const request = new Request('http://localhost:' + port + req.url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
  const response = await mod.default(request, { ip: req.socket.remoteAddress });
  res.writeHead(response.status, Object.fromEntries(response.headers));
  if (!response.body) return res.end();
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (functions[url.pathname]) return await runFunction(await functions[url.pathname](), req, res);
    if (url.pathname === OWNER_PREFIX || url.pathname.startsWith(OWNER_PREFIX + '/')) return await runFunction(await fn('owner')(), req, res);
    let rel = decodeURIComponent(url.pathname);
    if (BLOCKED.test(rel) || rel.includes('..')) { res.writeHead(404); return res.end('Not found'); }
    let file = path.join(root, rel);
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(fs.readFileSync(path.join(root, '404.html'))); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  } catch (err) {
    console.error('dev server error:', err && err.message);
    if (!res.headersSent) res.writeHead(500);
    res.end('Server error');
  }
}).listen(port, '127.0.0.1', () => {
  const key = process.env.ANTHROPIC_API_KEY ? 'set' : 'NOT SET (chat will show its offline message)';
  console.log('Site + functions on http://localhost:' + port + '   ANTHROPIC_API_KEY: ' + key);
  if (mock) console.log('Mock API with demo data. Owner page: http://localhost:' + port + '/owner/   token: ' + process.env.OWNER_TOKEN + '   metrics token: ' + process.env.METRICS_TOKEN);
});
