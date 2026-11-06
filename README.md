# Kampolo Tomas — Personal Website

Personal portfolio site for **Kampolo Tomas Vaino Amunyela** — Software Engineer & IT Specialist based in Windhoek, Namibia.

Built as a lightweight, dependency-free static site (HTML, CSS, vanilla JavaScript) and deployed on Netlify.

## Structure

```
website/
├── index.html      # Single-page site content, SEO meta, JSON-LD
├── styles.css      # Styling, dark/light themes, responsive layout
├── script.js       # Theme toggle, mobile nav, scroll reveal/spy/progress
├── favicon.svg     # Site icon
├── og-image.png    # Social share preview (1200x630)
├── swarm.html      # Hidden, unlisted write-up of the swarm effect (noindex)
├── thanks.html     # Shown after the contact form is submitted
├── 404.html        # Not-found page
├── robots.txt
├── netlify/functions/chat.mjs       # Chatbot endpoint (/api/chat) → Claude API
├── netlify/functions/knowledge.mjs  # The only facts the chatbot may use
├── netlify.toml    # Deploy config, security headers, CSP
└── README.md
```

## Running locally

No build step is required. Open `index.html` directly in a browser, or serve it:

```bash
npx serve .
```

## Chatbot

The assistant calls `/api/chat`, a Netlify Function that holds the API key server-side. To enable it, set `ANTHROPIC_API_KEY` in Netlify (Site configuration → Environment variables) and redeploy. Until then the widget shows an "offline" message. Edit `knowledge.mjs` to change what it knows. Requests are length-capped and rate-limited per IP (best effort, per function instance).

## Gamification

XP, levels and badges are decorative and stored in the visitor's own `localStorage`; nothing is sent to a server.

## Contact form

The form uses Netlify Forms (`data-netlify`), so submissions only work once deployed. Enable email notifications under Site configuration → Forms in the Netlify dashboard.

## Deployment

Hosted on GitHub and continuously deployed to Netlify. Pushing to the `main` branch triggers a new Netlify deploy.

## Contact

- Email: kampolotomasva@gmail.com
- LinkedIn: https://linkedin.com/in/kampolo-tomas-8453b129b
