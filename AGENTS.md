# AGENTS.md

Guidance for any AI coding agent or chatbot working in this repository. Read this file, then [docs/ROADMAP.md](docs/ROADMAP.md) for what is done and what is next.

## What this is

Personal portfolio for Kampolo Tomas Vaino Amunyela (software engineer and IT specialist, Windhoek, Namibia). Deployed on Netlify (a dedicated account, deployed with `scripts/deploy.mjs`) at https://kampolo-tomas.netlify.app. Goal: a calm corporate-looking site that can become role-specific personas for different employers, with hidden depth underneath. Idea write-up: [docs/ideas/multi-persona-site.md](docs/ideas/multi-persona-site.md).

## Stack and layout

Dependency-free static site. No build step, no framework.

- `index.html`, `styles.css`, `script.js`: the site (Swiss style, light/dark, XP and badges, chat widget, swarm effect, persona switching and labs).
- `edition.js` and `studio.js`: the Renaissance Edition, opened by the + beside Renaissance in the Style lab (`data-style="renaissance-plus"`; plain `renaissance` is a separate simple skin). It restructures the page into pinned painted stages driven by one scroll engine, and restores everything when left. Its look is the last block of `styles.css`. Backgrounds are public-domain paintings: edit `scripts/paintings.json`, run `node scripts/fetch-paintings.mjs` (checks licences; originals go to gitignored `scripts/private/`) and `python scripts/build-paintings.py` (writes `img/renaissance/*-dark.webp` and `-light.webp`, and `scripts/art-credits.json` for `/documents/`). The Studio scene is the owner's own pair of pictures (the same painting with the easel canvas holding only the pencil drawing, and with the portrait painted in): save them as `scripts/private/studio-custom-start.jpg` and `studio-custom.jpg` (gitignored) and run `python scripts/build-paintings.py`. It writes `scene-studio-dark.webp` (the underdrawing, the page background), `scene-studio-patch.webp` (only the figure, cut out where the two pictures differ) and `studio.json` (the patch position); `studio.js` paints the patch over the background stroke by stroke. `edition.js` also holds the coordinates of the monitor screen (`STUDIO.screen`), measured in the 1600x1000 scene image, so a new painting needs those retuned. `404.html` uses the same unicorn painting.
- `edition-editorial.js` / `edition-editorial.css`: the Editorial Edition, "The Kampolo Issue" (`data-style="editorial-plus"`), a scrolling magazine. The script builds a cover (the hero), a contents page of real links, a pinned feature opener before every section (the Renaissance paintings in `img/renaissance/` as halftone print plates, loaded lazily with an IntersectionObserver) and a running head and folio on each spread; the section slides over its opener as a folded page. All issue copy is read from text already on the page; `destroy()` removes everything it added. Phones and reduced motion get static plate headers. It registers through `PlusEditions.register`, so it needs `editions-plus.js` first.
- The + editions for every style except Renaissance live in one shared engine plus one file pair per edition. `editions-plus.js` / `editions-plus.css` are the shared engine (`window.PlusEditions`: entering with the swarm, the HUD with Pause motion and Leave, theme sync, teardown) and the shared rules (HUD, Pause, the chat launcher and panel-title glyph mask). Each edition is `edition-<name>.js` + `edition-<name>.css` for `swiss`, `editorial`, `brutalist`, `bauhaus`, `minimal`, `neural` and `cosmos` (style names `<name>-plus`), **lazy-loaded** on first entry by `ensure()` in the engine (the `LAZY` table lists the files; a new edition needs one line there), so visitors who never open the Style lab download none of them. An edition's script calls `PlusEditions.register(name, { label, xp, word, note, canvas, pausable, engine })`, where `engine(canvas, chapters)` returns `{ start, setActive, resize, destroy }` (and optionally `setMotion`, `recolor`). Helpers on `PlusEditions.util`: `el`, `sv`, `chapters`, `motion`, `reduce`, `mulberry`, `hexA`, `palette`, `glow`, `makeStage`, `makeLoop` and `track()`, which records every node, class, attribute, property, listener and observer an edition adds so one `undo()` removes them. **Prefix rule:** new classes and attributes an edition adds start with its prefix (`sx-` for Swiss, since `sw-` is the Style lab's colour swatches, then `br-`, `bh-`, `mn-`, `nn-`, `cs-`, `ed-`; `px-` is the shared engine and the older code), so `scripts/e2e.mjs` can prove that leaving leaves nothing behind. Each edition's CSS holds its light and dark tokens, its look, its section layouts for Experience, Projects, Skills, Education and Contact, and its chat rules and glyph. The Editorial Edition, "The Kampolo Issue" (`edition-editorial.js`), is a scrolling magazine: a cover, a contents page of real links, a pinned feature opener per section (the Renaissance paintings as halftone plates, lazy-loaded) and a running head and folio on each spread; all copy is read from text already on the page. Renaissance has its own, separate engine (`edition.js`); `script.js` routes a click on any + to the right one. `particles/` is a hidden `noindex` page of five small canvas effects, linked from `/lab/`. The plain skins only get colour, type and border matching for the chat, in a block in `styles.css`; their launcher keeps its "?".
- `personas.js`: persona text and project order. `track.js`: shared analytics beacon. `terminal.js`: the hidden terminal.
- **Generated, do not edit by hand:** `data/ design/ shop/ bank/` (role views), `cv/`, `documents/`, `lab/` (hub and one page per lab, from `scripts/labs/*.mjs`), `now/ uses/ terminal/ owner/`, `files/*.pdf` (CVs). Edit the sources (`index.html`, `personas.js`, `scripts/cv-data.mjs`, `scripts/documents.mjs`, `scripts/build.mjs`) and run `node scripts/build.mjs --pdf`. Demo images: `python scripts/build-shop-images.py`.
- `swarm.html`: hidden, unlisted, `noindex` page explaining the swarm. Generated once from real code excerpts; update if `script.js` swarm code changes.
- `netlify/functions/chat.mjs`: chat, streaming and job-ad matcher (`/api/chat`) calling the Claude API. Key comes from the `ANTHROPIC_API_KEY` env var, never from the client.
- `netlify/functions/ping.mjs`: event counter (`/api/ping`). It whitelists and size-limits every field (`lib/stats.mjs`) and keeps only counts: event names, paths, persona, referrer host, country code, device class, Web Vitals, sanitised error groups and feature timings, stored one document per function instance and day (`lib/store.mjs`: Netlify Blobs live, a local folder in development, memory in tests). **Keep it that way: no IPs, user agents, cookies, identifiers or message text.** `track.js` sends views and downloads; `obs.js` sends errors, Web Vitals and feature timings (it observes the swarm, the editions and the chat from outside) through swappable sinks (`obs.addSink`; Sentry would be one). `?audit=1` on any page shows a live frame-rate meter and sends nothing.
- `netlify/functions/chat.mjs` also records usage as numbers and enforces a global daily token cap (`CHAT_DAILY_TOKEN_CAP`, default 400,000) from the shared counters.
- `netlify/functions/owner.mjs` (`/api/owner/*`, `OWNER_TOKEN` bearer token, constant-time compare, delay and lock-out on wrong tries) and `ownerapp/` (`owner.js`, `owner.css`) with the generated, unlisted `/owner/` page: traffic, health, chat cost, the feature audit and set-up status. `netlify/functions/metrics.mjs` (`/api/metrics`, separate `METRICS_TOKEN`) renders the counters as Prometheus text. Never put a token, key or DSN in the repo. See `docs/observability.md` (counting, settings, Prometheus scrape config, how to switch Sentry on). `netlify/functions/package.json` holds the functions' only dependency (`@netlify/blobs`, approved); the site itself has none.
- `netlify/functions/knowledge.mjs`: the only facts the chatbot may use, plus its "never say" list.
- `netlify.toml`: headers, CSP, functions directory. Keep the CSP working when adding scripts or styles (inline `style=` attributes are blocked; set styles through CSS classes or CSSOM in JS).
- `thanks.html`, `404.html`, `robots.txt`, `favicon.svg`, `og-image.png`.

Note: **deploy with `node scripts/deploy.mjs --site <id> [--prod]`**, which publishes only the public files (it leaves out `docs/`, `scripts/`, `netlify/` source, `AGENTS.md`, `CLAUDE.md`, `README.md` and `netlify.toml`) and uploads the functions separately. Do not deploy the repo root: Netlify serves files case-insensitively but its `[[redirects]]` rules in `netlify.toml` are case-sensitive, so `/DOCS/...` and `/Scripts/...` were readable even though `/docs/*` was blocked. The redirects stay as a second layer. Never put secrets or private details in this repo. If the GitHub repository is public, these notes are public too. The SEO and AI-answer review, with what has been checked and what is open, is in [docs/seo-and-aeo-review.md](docs/seo-and-aeo-review.md).

## Run locally

```bash
python -m http.server 8765
```

Open http://127.0.0.1:8765/index.html. End-to-end checks of the Style lab and chat (real Chrome over the DevTools protocol, no packages): run `node scripts/dev.mjs 8888` in one terminal and `node scripts/e2e.mjs` in another (`--only chat|sections`, `--style a,b`, `--theme light|dark`, `--shots dir`). The per-section assertions live in `scripts/e2e-concepts/<style>.json`; add one when you add a section concept. Lab pages are checked by `node scripts/e2e-labs.mjs [--lab slug]`. The functions are tested with `node --test scripts/test-functions.mjs`, the owner page with `node scripts/e2e-owner.mjs` (starts its own mock server with demo data: `node scripts/dev.mjs --mock-api`), and performance and leaks with `node scripts/audit.mjs` (findings in `docs/audit/performance-and-cost.md`). `/api/chat` does not exist locally (the chat shows an offline message); test the function with a mocked `fetch` or `netlify dev`.

## Conventions

- Match the existing code: vanilla JS, small functions, CSS variables for colour, the 12-column grid, one typeface, one accent.
- Accessibility is required: keyboard use, visible focus, reduced motion. Effects are opt-in and must have a calm variant under `prefers-reduced-motion`.
- Corporate default must stay calm. Nothing autoplays.
- Prefer progressive enhancement: content must be readable without JavaScript.
- Do not add dependencies or a build step without the owner's approval.

## Guardrails: content and claims

These come from a fact-check pass against the owner's real repositories. Do not weaken them.

- No claim without evidence. Do not invent metrics, years, customers, revenue, or "live in production".
- Employer work (Kellerman ICT, Janeebra) is described generically as "contributor", never as sole author. No client repo names, ticket numbers, internal URLs, scraper targets, credentials or source code.
- USCO AI ownership is unconfirmed (see roadmap Phase 0). Do not expand its description until confirmed.
- Do not claim Flutter, PHP or Django expertise. Other projects found in the owner's folders but not shown on the site have unconfirmed ownership; do not add them without asking.
- Do not say the owner has graduated until confirmed. MIT credentials are 19 course certificates, not a degree.
- Skill levels are self-assessed; keep them honest.
- Never publish: date of birth, home address, student number, second phone, ID numbers, reference contact details (without consent). The owner confirmed the public email `kampolotomasva@gmail.com` and the phone number already on the site are fine.
- The chatbot answers only from `knowledge.mjs`; keep that file in sync with `index.html`.

## Secrets and safety

- Never commit secrets, API keys, `.env` files or service-account files.
- Treat visitor input (chat, contact form) as untrusted. The chat function caps input, caps output, rate-limits, and tells the model to ignore instructions in user messages. Keep it that way.

## Gotchas

- `script.js` is a classic script: its top-level `const`/`function` names are global and can shadow browser globals. A chat variable once named `history` broke `history.pushState`; do not name top-level variables `history`, `name`, `status`, `location`, `event`, etc.
- When editing files with scripts that call `String.replace` with code in the replacement, `$$` collapses to `$` and `$'` inserts text. Use a function replacement or slice and concatenate.
- `track.js` must load before `script.js` (both are `defer`); `script.js` falls back to a no-op if it is missing.
- The CV content in `scripts/cv-data.mjs` is a public-safe copy of the owner's private master profile. Keep it in sync by hand, and never add private details to it.

## Working rules

- Ask the owner before committing or pushing. Branches as of 2026-11-07: `main` is untouched; the site rebuild is on `feature/swiss-rebuild`; this guidance and the roadmap are on `docs/persona-roadmap` (both pushed); roadmap Phases 0 to 5 are on `feature/personas-and-cv`, stacked on top. Nothing is merged yet.
- Update `docs/ROADMAP.md` checkboxes in the same change as the work, and add decisions to its log.
- Verify before claiming done: run the page, check the console, test the relevant flow. Say plainly what was not tested.
- Reference material (private, outside this repo): the owner's master profile and application archive. Do not copy private details from it into the repo.
