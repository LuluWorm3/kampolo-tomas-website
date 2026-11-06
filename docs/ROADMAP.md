# Roadmap and completion plan

Single source of truth for what is done, what is next, and what is blocked. Any person or AI agent picking up this repo should read [../AGENTS.md](../AGENTS.md) first, then this file. Update the checkboxes in the same change as the work.

Last updated: 2026-11-07. Live site: https://kampolo-tomas-website.netlify.app (deployed from `main` on Netlify).

North star: one calm, corporate-looking site that can become whatever each employer needs, with role-specific links. Full idea write-up: [ideas/multi-persona-site.md](ideas/multi-persona-site.md).

## Decisions log

| Date | Decision |
|---|---|
| 2026-11-07 | Audience: corporates/public sector and remote tech/product, equally. |
| 2026-11-07 | Ship the corporate / legacy-safe persona first; other personas later. |
| 2026-11-07 | Role links are short paths: `/data`, `/design`, `/shop`, `/bank`. |
| 2026-11-07 | Email `kampolotomasva@gmail.com` may be public. |
| 2026-11-07 | Documents to publish: CV PDF, MIT and HP certificates, academic transcript (redacted), reference/recommendation letters (with author consent). Anything else "safe and public" is fine; the rest by email request. |
| 2026-11-07 | Stack stays dependency-free static HTML/CSS/JS on Netlify, plus Netlify Functions for the chatbot. |

## Phase 0: blockers (do before anything else)

- [x] Site rebuild committed on branch `feature/swiss-rebuild` (2026-11-07); roadmap and notes on `docs/persona-roadmap`. Still to do: push, review, merge into `main` (owner decides when).
- [ ] Set `ANTHROPIC_API_KEY` in Netlify (Site configuration, Environment variables) and redeploy, so the chatbot answers. Until then it shows an offline message.
- [ ] Confirm the owner may show USCO AI publicly (its remote sits under a different GitHub account and organisation). If not, make it generic or remove it.
- [ ] Confirm naming Kellerman ICT and Janeebra publicly is acceptable.
- [ ] Review skill levels in `index.html` (self-assessed; two were lowered because scans did not back them).
- [ ] Fix the master profile's stale "18 MIT certificates" (correct figure is 19).
- [ ] Add `sitemap.xml` and canonical URL (live URL above).
- [ ] Update "Graduating 2026" once graduation status is known.

## Phase 1: corporate default, hardened, plus CV and documents (time-box: 1 week)

- [ ] Define the browser support target (suggestion: last five years of evergreen browsers, graceful degradation below). Audit `color-mix`, CSS masks, `<dialog>`, `inset` and provide fallbacks or hide the effect.
- [ ] No-JavaScript check: every section readable, links work, contact form works.
- [ ] Print stylesheet check on a real printer or PDF export.
- [ ] Accessibility pass (keyboard, screen reader, contrast, reduced motion). Skill `design:accessibility-review` can help.
- [ ] Performance budget: no layout shift, fonts and images optimised, check Lighthouse.
- [ ] `/cv` page: one-page and full CV as PDF, generated from `MASTER_PROFILE_KampoloTomas.md`, black and white print-ready. Source of truth is the profile in the private export folder, not this repo.
- [ ] Documents section: MIT certificates, HP LIFE certificates, redacted transcript, reference/recommendation letters. Per-file checklist: redact student number, ID numbers, DOB, home address; get author consent for letters; add a "request more documents by email" mailto with a prefilled subject.
- [ ] Public email shown in header or contact area (already in contact; confirm placement).

## Phase 2: persona engine and role URLs (time-box: 1 week)

- [ ] Persona data model: headline, lead, project order, featured skills, CV file, accent/theme variables. Keep it in one small data file.
- [ ] Role paths `/data`, `/design`, `/shop`, `/bank`. Decide generation approach (open question in the idea doc; recommendation: small dependency-free generator producing one static HTML file per persona so link previews are correct).
- [ ] Persona switcher (quiet, in the nav or footer).
- [ ] `/data` persona first: leads with analytics, SQL, BI and MIT AI work; matching CV (master profile mode 4).
- [ ] Netlify redirects/headers for role paths; `noindex` where duplicate content is a concern.

## Phase 3: persona designs and proof labs (time-box: 2 weeks, one persona at a time)

- [ ] Data / Informatics: dashboard layout with a small chart view on synthetic data (state clearly it is synthetic).
- [ ] Design / UI: gallery of design systems Kampolo can implement (Swiss is live; add two or three more, switchable).
- [ ] E-commerce / image-heavy: product-grid demo and an "image lab" showing responsive `srcset`, lazy loading, stable layout and performance numbers.
- [ ] Corporate / legacy ("bank"): stricter, plainer variant aimed at mature corporates and legacy-system environments.

## Phase 4: swarm as signature, hidden pages, easter eggs

- [ ] Persona switch triggers the swarm rebuild (reuse `swarmRebuild()` in `script.js`).
- [ ] Hidden pages (unlisted, `noindex`): terminal-style page, `/lab`, `/now`, `/uses`.
- [ ] More easter eggs and badges; keep them opt-in, never autoplay, always respect reduced motion (calm mode exists).
- [ ] Every hidden page links back to the main site.

## Phase 5: chatbot upgrades and analytics

- [ ] Job-description matcher: visitor pastes a job ad, the bot says honestly where Kampolo matches and where not (grounded only in `netlify/functions/knowledge.mjs`).
- [ ] Streaming replies.
- [ ] Privacy-friendly analytics (visits per role link, chat questions, swarm triggers). No personal data.
- [ ] Rate limiting that survives across function instances (current limiter is per-instance, best effort).

## Done so far (committed on `feature/swiss-rebuild`, 2026-11-07; not yet merged to `main`)

- [x] Swiss redesign (12-column grid, one typeface, one accent), light/dark, print styles.
- [x] Real project content from a read-only scan of Kampolo's folders, fact-checked, employer work described generically.
- [x] Chatbot: widget in `script.js`, Netlify Function `netlify/functions/chat.mjs` (key stays server-side, input caps, rate limit), facts in `netlify/functions/knowledge.mjs`. Needs the API key (Phase 0).
- [x] Gamification: XP, levels, badges, localStorage only.
- [x] Swarm rebuild animation (12 agent cursors) triggered by the Konami code or by asking the chatbot for "something cool"; calm variant for reduced motion.
- [x] Hidden page `swarm.html` explaining the swarm with real code excerpts; chatbot links to it when asked how it was done.
- [x] Contact form (Netlify Forms), `thanks.html`, `404.html`, favicon, OG image, `robots.txt`, security headers and CSP in `netlify.toml`.

## Risks

- **Time sink:** polish replaces applying. Mitigation: time-boxes above; apply to roles in parallel.
- **Gimmick perception:** corporate readers may dislike effects. Mitigation: calm default, opt-in effects.
- **Legacy browsers:** newer CSS may not work. Mitigation: Phase 1 audit.
- **Document exposure:** personal data in certificates and transcripts. Mitigation: redaction checklist, consent for letters.
- **Over-claiming:** see `AGENTS.md` guardrails.
- **Chatbot abuse or cost:** capped input, capped output, rate limit, grounded prompt; watch the Anthropic usage dashboard.

## Not doing

- A JavaScript framework or build pipeline for the whole site.
- Logged-in or gated documents.
- Publishing ID, date of birth, home address, student number, second phone, or reference contact details without consent.
- Autoplaying effects or sound.
- Any claim not backed by evidence.
