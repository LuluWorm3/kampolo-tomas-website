# Observability: what the site counts, where to see it, and how to plug in Sentry and Prometheus

Internal notes (blocked from the live site by `netlify.toml`). Never put a token, a key or a DSN in this repository.

## What is counted, and what is not

Counted, as numbers only: page views (path, persona view, referrer host, two-letter country, screen size class), events (chat, job-ad matcher, swarm, downloads, document requests, persona switches, + editions entered), Web Vitals (LCP, INP, CLS, TTFB), how long the swarm, a + edition or a chat answer took, browser errors (grouped; web addresses, e-mail addresses and long numbers removed from the message), and chat usage (outcome, model, tokens, timing).

Never kept: IP addresses, user agents, cookies, identifiers, message text, anything typed into the chat or the contact form. A visitor's IP is used for an in-memory rate limit and then forgotten. Nothing is sent when the browser has Do Not Track switched on. The public description is on `/documents/` (from `scripts/documents.mjs`).

## How it works

- `track.js` sends the page view and downloads; `obs.js` sends errors, Web Vitals and feature timings (it watches the swarm, the + editions and the chat from outside, so no other script was edited). Both send to `/api/ping`.
- `netlify/functions/ping.mjs` validates every event against a whitelist and size limits (`lib/stats.mjs`) and adds it to a **per-instance, per-day document** in the store (`stats/<day>/<instance>`). Readers add the documents up. No two writers share a key, so there is no read-modify-write race (Netlify advises against counters built on read-modify-write in Blobs).
- The store is Netlify Blobs on the live site (`@netlify/blobs`, declared in `netlify/functions/package.json`, Node 22.12 or newer), a `.local-store/` folder locally, and memory in tests (`lib/store.mjs`). Days older than 90 are deleted.
- `chat.mjs` records usage as numbers and enforces a **daily token cap** across every instance (`CHAT_DAILY_TOKEN_CAP`, default 400,000 tokens). The per-visitor limit stays as a second layer.
- Counts can be slightly low if a request lands while an instance is being replaced. Treat small differences as noise.

## Settings (Netlify, Site configuration, Environment variables)

| Name | Needed for | Notes |
|---|---|---|
| `OWNER_TOKEN` | the `/owner/` page and `/api/owner/*` | 24 characters or more. Without it the endpoints answer 503. |
| `METRICS_TOKEN` | `/api/metrics` | 24 characters or more, different from the owner token. |
| `ANTHROPIC_API_KEY` | the assistant | already used. |
| `CHAT_DAILY_TOKEN_CAP` | daily spending ceiling | optional; tokens per day. |
| `CHAT_PRICES` | cost estimate in the owner page | optional JSON of US dollars per million tokens, e.g. `{"model-name":{"in":1,"out":5}}`. Without it the page shows tokens only. |
| `SENTRY_DSN` | the Sentry sink | optional, see below. |

Generate a token with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

## The owner page

`/owner/` is unlisted, `noindex` and not linked from anywhere; the page ships no data. Open it, paste `OWNER_TOKEN` (kept in `sessionStorage` for the tab only), and read Traffic, Health, Chat cost, Feature audit and Set-up. Five wrong tries from one visitor lock it for ten minutes. To try it without Netlify: `node scripts/dev.mjs --mock-api` (demo data, tokens printed at start).

## Prometheus and Grafana

Prometheus pulls from servers that are always running, and a static Netlify site is not one, so `/api/metrics` renders the counters in Prometheus text format for something that is. With a `METRICS_TOKEN` set, a scrape job looks like this (Grafana Alloy, Grafana Cloud's Prometheus, or a Prometheus you run):

```yaml
scrape_configs:
  - job_name: kampolo-site
    scheme: https
    metrics_path: /api/metrics
    scrape_interval: 5m
    authorization:
      type: Bearer
      credentials_file: /etc/prometheus/kampolo-metrics-token   # a file holding METRICS_TOKEN
    static_configs:
      - targets: ['kampolo-tomas-website.netlify.app']
```

Series: `kt_events_total{event}`, `kt_page_views_total{path}`, `kt_persona_views_total{persona}`, `kt_device_views_total{device}`, `kt_errors_total`, `kt_chat_requests_total{status}`, `kt_chat_tokens_total{direction}`, `kt_chat_failovers_total`, `kt_web_vital_bucket_total{vital,le}`, and the gauges `kt_chat_tokens_today` and `kt_chat_daily_token_cap`. Counters add up the retained 90 days; when old days drop off a counter can fall, which Prometheus treats as a reset, so use `increase()` and `rate()`.

Alert ideas: `kt_chat_tokens_today / kt_chat_daily_token_cap > 0.8`; `increase(kt_errors_total[1h]) > 5`; `increase(kt_chat_requests_total{status="failed"}[1h]) > 3`; the LCP 75th percentile from `kt_web_vital_bucket_total` above 4000 ms.

## Sentry (not switched on)

`obs.js` sends everything through sinks (`obs.addSink(name, fn)`); Sentry is one more sink and needs no change to any caller. To switch it on:

1. Create a free Sentry project (browser JavaScript) and copy its DSN. A DSN is not a secret, but keep it out of source control and set it as `SENTRY_DSN`.
2. Approve the Sentry browser SDK as a dependency. It would be added as a self-hosted file (for example `vendor/sentry.min.js`, version pinned and checked), not loaded from a third-party CDN.
3. Update the CSP in `netlify.toml`: `connect-src 'self' https://<your-sentry-ingest-host>` and nothing broader.
4. Initialise with `sendDefaultPii: false`, no session replay, a low `tracesSampleRate`, and a `beforeSend` that drops URLs, request bodies and anything typed by a visitor. Register it as an `obs` sink for errors only.
5. For the functions, wrap the handlers with the Sentry Node handler and keep message text out of breadcrumbs.

Until then errors still reach the Health tab through the built-in sink.

## Other extras (listed on the owner page, none switched on)

Uptime checks on `/` and `/api/chat`; an e-mail alert for an error spike or the chat cap; a security-headers and CSP self-check; Lighthouse budgets in CI; a link checker; a dependency audit for `netlify/functions`; a note on backups and yearly token rotation.

## Testing

`node --test scripts/test-functions.mjs` (counters, validation, privacy, auth, owner API, metrics format, chat cap), `node scripts/e2e-owner.mjs` (the page, against `node scripts/dev.mjs --mock-api`), `node scripts/audit.mjs` (performance and leaks).
