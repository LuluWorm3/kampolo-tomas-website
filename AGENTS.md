# AGENTS.md

Guidance for any AI coding agent or chatbot working in this repository. Read this file, then [docs/ROADMAP.md](docs/ROADMAP.md) for what is done and what is next.

## What this is

Personal portfolio for Kampolo Tomas Vaino Amunyela (software engineer and IT specialist, Windhoek, Namibia). Deployed on Netlify at https://kampolo-tomas-website.netlify.app from `main`. Goal: a calm corporate-looking site that can become role-specific personas for different employers, with hidden depth underneath. Idea write-up: [docs/ideas/multi-persona-site.md](docs/ideas/multi-persona-site.md).

## Stack and layout

Dependency-free static site. No build step, no framework.

- `index.html`, `styles.css`, `script.js`: the site (Swiss style, light/dark, XP and badges, chat widget, swarm effect).
- `swarm.html`: hidden, unlisted, `noindex` page explaining the swarm. Generated once from real code excerpts; update if `script.js` swarm code changes.
- `netlify/functions/chat.mjs`: chat endpoint (`/api/chat`) calling the Claude API. Key comes from the `ANTHROPIC_API_KEY` env var, never from the client.
- `netlify/functions/knowledge.mjs`: the only facts the chatbot may use, plus its "never say" list.
- `netlify.toml`: headers, CSP, functions directory. Keep the CSP working when adding scripts or styles (inline `style=` attributes are blocked; set styles through CSS classes or CSSOM in JS).
- `thanks.html`, `404.html`, `robots.txt`, `favicon.svg`, `og-image.png`.

Note: Netlify publishes the repo root (`publish = "."`), so internal notes (`docs/`, `AGENTS.md`, `CLAUDE.md`, `netlify/`) are blocked from the live site by `[[redirects]]` in `netlify.toml`. Keep those rules when editing it, and never put secrets or private details in this repo. If the GitHub repository is public, these notes are public too.

## Run locally

```bash
python -m http.server 8765
```

Open http://127.0.0.1:8765/index.html. `/api/chat` does not exist locally (the chat shows an offline message); test the function with a mocked `fetch` or `netlify dev`.

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

## Working rules

- Ask the owner before committing or pushing. Branches as of 2026-11-07: `main` is untouched; the site rebuild is committed on `feature/swiss-rebuild`; this guidance and the roadmap live on `docs/persona-roadmap`, stacked on top of it. Nothing is pushed or merged yet.
- Update `docs/ROADMAP.md` checkboxes in the same change as the work, and add decisions to its log.
- Verify before claiming done: run the page, check the console, test the relevant flow. Say plainly what was not tested.
- Reference material (private, outside this repo): the owner's master profile and application archive. Do not copy private details from it into the repo.
