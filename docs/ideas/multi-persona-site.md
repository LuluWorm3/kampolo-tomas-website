# Multi-persona recruiting site ("looks normal, is over-engineered underneath")

Idea one-pager. Date: 2026-11-07. Status: direction chosen by the owner; execution tracked in [../ROADMAP.md](../ROADMAP.md).

## Problem statement

How might we turn one calm, corporate-looking portfolio into a site that can quietly become whatever each employer needs (legacy-safe corporate, data/informatics, design, e-commerce), give each of those a short link Kampolo can send for a specific role, and still look like a normal professional site until a visitor digs deeper?

## Audience and success

- **Audience (decided):** both first-wave audiences equally: Namibian/SA corporates and public sector (HR skim-readers, conservative, print-friendly) AND remote/international tech and product teams (judge by craft and demos). The site must pass a strict corporate skim and still impress a technical reviewer.
- **Success:** a recruiter on any of the four personas reaches a relevant CV and a way to contact Kampolo in under a minute; the corporate view never feels gimmicky; hidden depth is discoverable but never in the way.
- **Ship first (decided):** the corporate / legacy-safe persona, hardened. Other personas follow.

## Recommended direction: "Sleeper site"

Default view = what exists now: calm, Swiss, high-contrast, print-ready. Underneath:

1. **Persona engine.** Personas are CSS-variable themes plus content overrides (headline, project order, which CV). Selected by short role URLs (`/data`, `/design`, `/shop`, `/bank`) and a quiet persona switcher.
2. **Personas map to the CV modes already defined in the master profile** (full profile, no family business, operational, data/AI focus), so each role link has a matching CV PDF.
3. **Documents section** with a safe public set (CV PDF, MIT and HP certificates, redacted transcript, reference letters with author consent) and a "request the rest by email" path.
4. **Proof labs instead of claims:** a data dashboard on synthetic data, an image-placement lab (responsive images, layout stability, lazy loading) for e-commerce roles, a design-system gallery.
5. **Swarm as the signature reveal:** switching persona triggers the existing swarm rebuild, which visibly re-lays the page into the new design.
6. **Hidden depth:** unlisted pages and easter eggs (terminal page, `/lab`, `/now`, more codes), all opt-in and never auto-playing.

## Key assumptions to validate

- [ ] Recruiters actually open role-specific links. Test: privacy-friendly per-link counts after the first ten applications.
- [ ] The corporate default does not read as gimmicky. Test: show it to two non-technical people, 30 seconds each.
- [ ] Persona pages are worth the build time versus applying. Test: time-box each persona (see roadmap) and stop when the box is spent.
- [ ] The site works acceptably on the oldest browsers target employers use. Test: define the support target and check it (Phase 1).
- [ ] Document publishing is safe. Test: redaction checklist for every file before it goes live.

## MVP scope

In: hardened corporate default; CV and documents section; `/data` persona with tailored headline, project order and CV; swarm-on-switch; the existing chatbot with a key configured.
Out (for MVP): design and e-commerce personas, analytics, the job-description matcher, extra hidden pages.

## Not doing (and why)

- **A framework or build pipeline for the whole site.** Vanilla HTML/CSS/JS is a feature: it is legacy-safe, fast and reviewable. At most a tiny dependency-free script to generate per-persona HTML.
- **Gated or logged-in documents.** Adds risk and friction; "request by email" covers sensitive items.
- **Publishing ID, date of birth, home address, student number, phone 2.** Never on the site.
- **Autoplaying effects or sound.** Corporate readers must never be surprised.
- **Claims not backed by evidence.** See the guardrails in `AGENTS.md`.
- **Weeks of polish before applying.** Time-boxes in the roadmap.

## Open questions

- Per-persona link previews: separate static HTML files per role (needs a small generator script) versus Netlify rewrites to one page (previews would all show the default). Recommendation: small generator script.
- Which design styles go in the design persona's gallery (Swiss, editorial, brutalist, others)?
- Which reference-letter authors have agreed to publication?
- Custom domain, or stay on the netlify.app address?
