# SEO and AI-answer review (7 November 2026)

Source: a review of the deployed site, pasted by the owner on 8 November 2026. Each point below has a **status** from checking it against the repo and the live site on that day. Work through it as the project goes on, and tick items off in [ROADMAP.md](ROADMAP.md).

## Overall assessment

This is a personal portfolio for one person, and its job is narrow: when a recruiter, an employer or an AI assistant looks up "Kampolo Tomas", they should find this site and get an accurate, consistent picture. Topic traffic does not really matter. What matters is owning the name, being consistent, and having claims that can be checked.

The basics are in place. The homepage is plain server-rendered HTML that reads fine without JavaScript, with one H1, a clean H2/H3 outline, a good title, Open Graph tags and a reasonable Person schema. The CV is real HTML as well as PDFs. The role views and lab pages are correctly `noindex`.

The real problems are not missing technical extras. They are which domain is the real one, internal notes that are publicly readable, and inconsistent claims that search engines and AI answer engines will repeat.

## Prioritised issues

### 1. Two Netlify sites, and every canonical points to the other one (high)
Canonical URLs, `og:url`, `og:image`, the sitemap and robots.txt all use `kampolo-tomas-website.netlify.app`.
- **Status: confirmed.** The new site (`kampolo-tomas-portfolio.netlify.app`, on the dedicated account) is private until its visibility is set to Public, and has the same files.
- If `-website` stays the real site this is fine, but `-portfolio` must never be public with these canonicals, or it becomes an unindexable duplicate.
- If the site moves, every canonical, `og:url`, `og:image`, sitemap and robots URL changes with it and the old site should 301 to the new one. Plan agreed on 8 November: deploy to the new account under a temporary name, delete the old site, then rename the new one to `kampolo-tomas-website`, so no URL changes.
- **Recommendation: a custom domain** (for example `kampolotomas.com`). It is the most valuable SEO and AI-citation change for a personal brand, and it survives renaming a Netlify project. Needs the owner to buy and choose it.

### 2. Internal notes were publicly readable (high)
**Status: confirmed, and wider than the review said.** Netlify serves files case-insensitively but its redirect rules are case-sensitive. On the live site `/agents.md`, `/readme.md`, `/DOCS/ROADMAP.md`, `/Scripts/build.mjs` and `/NETLIFY/functions/chat.mjs` all returned 200 while the lowercase or exact-case paths returned 404. So the notes, build scripts and function source were readable by changing the letter case.
- **Fixed in the repo:** `scripts/deploy.mjs` now deploys only the public files: `docs/`, `scripts/`, `netlify/` (function source goes up separately), `AGENTS.md`, `CLAUDE.md`, `README.md` and `netlify.toml` are not in the published folder at all. The new site has been deployed this way. Use `node scripts/deploy.mjs --site <id> --prod`.
- **Still open:** the old site `kampolo-tomas-website` was last deployed from the repo root, so it still exposes them until it is deleted or redeployed with the script. No secrets were in those files (checked); they hold notes and source.
- The redirect rules in `netlify.toml` stay as a second layer, but they are not the protection.

### 3. Claims that disagree with each other (high for AI answers)
- **Graduation: confirmed.** The meta description, hero, persona lines and CV profile say "Informatics graduate". About says "I'm completing a Bachelor of Informatics". Education says "Graduating 2026". The chatbot knowledge says not to say he has graduated. It is now November 2026: **the owner must confirm the real status**, then one wording goes everywhere (homepage, role views, CV and PDFs, chatbot knowledge, LinkedIn).
- **Name:** "Kampolo Tomas" and "Kampolo Tomas Vaino Amunyela" are both used, which is fine. LinkedIn should use the same full name.
- **Skills: confirmed.** `PHP · Django REST` is listed at level 2 on the homepage, while AGENTS.md says not to claim PHP or Django expertise. Remove it, or keep it clearly marked as basic. Needs the owner's decision.

### 4. Little evidence that can be checked or linked (medium)
Only LinkedIn is linked. None of the eight projects links anywhere, including shipcheck, which is marked Published.
- Link a public GitHub profile in the contact section and in the Person schema `sameAs`.
- Link published work such as the shipcheck repository.
- Optional: one short page for one or two flagship projects (what it is, the owner's role, stack, what was verified). Only for projects whose ownership is confirmed (USCO AI is not yet).

### 5. Demo sections dilute what the homepage is about (medium-low)
**Status: partly done.** The new lab pages under `/lab/` replace the Data and Image labs, but the inline `#data-lab`, `#shop-lab` and Style lab sections are still in `index.html` (hidden in the default view, still in the HTML a crawler reads). Plan: remove the inline Data and Image labs from `index.html` once the lab pages are live and checked. The Style lab stays inline in `/design/` because its picker opens the + editions.

### 6. Minor items
- **Meta description: confirmed, 187 characters** (cut off in results). Put role, location and what the owner is open to in the first ~150.
- `/documents/` is indexable but thin; `noindex` or leaving it out of the sitemap are both fine.
- Person schema: add `url`, a GitHub `sameAs` and `worksFor` (Kellerman ICT, described generically). Nothing else is needed.
- **`netlify.toml` with absolute Windows paths: not reproduced.** The repo and the deployed copy both have `publish = "."` and `functions = "netlify/functions"`. The review may have seen a config dump from another folder. Note that `publish = "."` is exactly what caused issue 2, so any future Git-based deploy needs a publish folder that holds only public files (a copy step), or Netlify will publish the notes again.

## Next steps
1. Set the new site's visibility to Public, check it, delete the old site, rename the new one to `kampolo-tomas-website` (or move to a custom domain and update every canonical and URL).
2. Owner confirms the graduation status; one wording everywhere.
3. Owner decides on the PHP and Django line.
4. Add the GitHub and project links and put GitHub in `sameAs`.
5. Remove the inline Data and Image labs from `index.html`.
6. Shorten the meta description to about 150 characters.
7. Optional: one or two short project pages.

Not recommended for a single-person portfolio: more structured-data types, an `llms.txt`, a bigger sitemap, FAQ markup or keyword expansion.
