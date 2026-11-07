# Kampolo Tomas — Personal Website

Personal portfolio site for **Kampolo Tomas Vaino Amunyela** — Software Engineer & IT Specialist based in Windhoek, Namibia.

Built as a lightweight, dependency-free static site (HTML, CSS, vanilla JavaScript) and deployed on Netlify.

## Structure

```
website/
├── index.html      # The page: content, SEO meta, JSON-LD. Source of truth for the role pages
├── styles.css      # Styling, dark/light themes, responsive layout
├── script.js       # Theme, nav, XP and badges, chat, swarm, persona switching, labs
├── personas.js     # Persona text and project order (read by script.js and the generator)
├── track.js        # Privacy-friendly event beacon shared by every page
├── terminal.js     # The hidden terminal page
├── favicon.svg     # Site icon
├── og-image.png    # Social share preview (1200x630)
├── swarm.html      # Hidden, unlisted write-up of the swarm effect (noindex)
├── data/ design/ shop/ bank/   # GENERATED role views (do not edit by hand)
├── cv/ documents/ lab/ now/ uses/ terminal/   # GENERATED pages (cv and documents public, the rest hidden)
├── files/          # CV PDFs (generated) and any documents you publish
├── img/shop/       # Generated demo images for the Image lab
├── scripts/        # build.mjs, cv-data.mjs, documents.mjs, build-shop-images.py
├── docs/           # ROADMAP.md, browser-support.md, ideas/
├── thanks.html     # Shown after the contact form is submitted
├── 404.html        # Not-found page
├── robots.txt
├── netlify/functions/chat.mjs       # Chat, streaming and job-ad matcher (/api/chat) → Claude API
├── netlify/functions/ping.mjs       # Event counter (/api/ping), logs event names only
├── netlify/functions/knowledge.mjs  # The only facts the chatbot may use
├── netlify.toml    # Deploy config, security headers, CSP
└── README.md
```

## Generating files

Persona pages, CV pages, the documents page and the hidden pages are generated. After changing `index.html`, `personas.js`, `scripts/cv-data.mjs` or `scripts/documents.mjs`, run:

```bash
node scripts/build.mjs          # pages
node scripts/build.mjs --pdf    # pages and CV PDFs (needs Chrome or Edge)
python scripts/build-shop-images.py   # only if the demo images change (needs Pillow)
```

To publish a document, put the redacted PDF in `files/` with the name listed in `scripts/documents.mjs` and re-run the first command.

## Running locally

No build step is required. Open `index.html` directly in a browser, or serve it:

```bash
npx serve .
```

To test the chatbot locally, put your key in `.env` (gitignored) as `ANTHROPIC_API_KEY=...` and run `node scripts/dev.mjs`, then open http://localhost:8888. It serves the site and runs the functions at `/api/*`.

## Chatbot

The assistant calls `/api/chat`, a Netlify Function that holds the API key server-side. To enable it, set `ANTHROPIC_API_KEY` in Netlify (Site configuration → Environment variables) and redeploy. Until then the widget shows an "offline" message.

Models are tried in order and the next one answers if one fails (`netlify/functions/providers.mjs`). `CHAT_PROVIDERS` sets the provider order (default `claude`) and `CLAUDE_MODELS` the Claude models in order (default `claude-haiku-5-5,claude-sonnet-5-5`). Gemini and Ollama are not added yet. Edit `knowledge.mjs` to change what it knows. Requests are length-capped and rate-limited per IP (best effort, per function instance).

## Gamification

XP, levels and badges are decorative and stored in the visitor's own `localStorage`; nothing is sent to a server.

## Contact form

The form uses Netlify Forms (`data-netlify`), so submissions only work once deployed. Enable email notifications under Site configuration → Forms in the Netlify dashboard.

## Deployment

Hosted on GitHub and continuously deployed to Netlify. Pushing to the `main` branch triggers a new Netlify deploy.

## Contact

- Email: kampolotomasva@gmail.com
- LinkedIn: https://linkedin.com/in/kampolo-tomas-8453b129b
