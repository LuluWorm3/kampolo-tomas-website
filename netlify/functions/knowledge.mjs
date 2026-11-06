// Facts the chatbot is allowed to use. Edit here, redeploy, and the bot updates.
// Built from the master profile and a read-only scan of local project folders,
// then trimmed after a fact-check pass: anything unverified or confidential is omitted.
export const KNOWLEDGE = `
# Verified facts about Kampolo Tomas

## Who he is
- Kampolo Tomas (full name Kampolo Tomas Vaino Amunyela). Namibian, based in Windhoek.
- Languages: Oshindonga, English, Afrikaans.
- Early-career software engineer and IT specialist: web, mobile and backend development plus several years of hands-on IT support.

## Current role
- Software Engineer (work-integrated-learning placement) at Kellerman ICT on the Janeebra platform, from mid-2026, under senior developer supervision with a Git pull request workflow.
- He is a contributor, not the sole author, and the code belongs to the employer, so it is not public.
- Work he lists from the placement: mobile features in React Native and Expo (in-app password change, dark mode), mobile performance work, a polls feature across mobile, web, admin and API with an SSRF guard on image ingest, backend REST APIs, Firestore security rules, and an automated API security test suite in pytest.
- He also wrote poll-core, a small dependency-free TypeScript library for poll logic shared by several clients.

## Earlier work
- IT Support Specialist (freelance), Windhoek, Jan 2021 to present: hardware maintenance, network configuration, Microsoft 365 administration (users, permissions, Azure AD, Teams, SharePoint, OneDrive), troubleshooting TCP/IP, DNS, DHCP, VPN and email on Windows, macOS and Linux.
- General IT and Administration Assistant, Benito Trading Enterprises (family business), 2020 to present: equipment and printer support, quotations, basic graphic design.
- In 2024 he supervised a subcontracted team (working hours, equipment tracking, incident handling).

## Education and certifications
- Bachelor of Informatics, Namibia University of Science and Technology (NUST). Expected completion October 2026. Do not say he has graduated.
- Modules include Business Intelligence and Analytics, Database Programming, Information Systems Security, Systems Analysis and Design, Data Networks, Website Development.
- 19 MIT Open Learning course certificates (Feb to Jun 2026) in the Universal AI programme: Python, machine learning, neural networks, deep learning, computer vision, LLMs, LLM-based AI agents, multimodal AI, prescriptive AI, explainability, AI ethics. These are course certificates, not a degree.
- HP LIFE (IT for Business Success, Customer Experience, Social Media Marketing), Simplilearn Project Management 101.
- Member of the ISACA Windhoek Chapter. Team leader of the NUST Capital Edge team in the NSIC 2026 stock trading competition.

## Projects
Personal and team projects (2026):
- Multi-channel chatbot platform: personal project, he is the main author (about 105 of 115 commits) and built it with Claude Code. WhatsApp, Messenger, Instagram, Telegram, SMS and web chat, a visual flow builder, AI replies, shared inbox, broadcasts and a public API. Node.js, Express, SQLite, one runtime dependency, 35 migrations, roughly 65 test files. Security features: TOTP two-factor login, hashed scoped API keys, signed webhooks, SSRF guard. Channel integrations are tested with mocks and have not been run on live channels yet.
- USCO AI: embeddable AI sales-assistant chat widget SaaS (Next.js, Prisma, PostgreSQL, Stripe). Visitors are qualified, leads captured, and chats handed to a human. He is the main human committer alongside AI-assisted commits. Do not claim it is live or has customers.
- shipcheck: his personal standard for AI coding assistants (match the existing codebase, prove claims with executed checks), published as a Claude Code skill with adapters for other tools. Do not claim adoption.
University projects (prototypes, self-reported):
- Patient Records Data Management System (2025): relational database prototype modelled on DHIS2 structures, with role-based access, reports and backup and recovery procedures.
- Automated Network Uptime Monitor (2025): Python tool that pings nodes, emails alerts, logs uptime and produces daily reports.
- IT Infrastructure Security Audit (2025): audit and hardening of a simulated network, plus incident response procedures.
- HR Management System, Technical Support Module (2024): backend with role-based access control, performance tuning, documentation.

## Skills (self-assessed)
- Strongest: TypeScript, JavaScript, Node.js and Express, Microsoft 365 administration, hardware troubleshooting, AI-assisted development.
- Working level: React, React Native and Expo, Next.js, Firebase and Firestore, SQLite, PostgreSQL, MySQL, Python, REST API design, access control, API security testing, Git workflow, networking.
- Foundational: PHP, Django REST, Firestore security rules, web scraping, Playwright, business intelligence, machine learning from coursework.

## Availability and contact
- For current availability, roles or start dates, tell the visitor to contact him directly.
- Email: kampolotomasva@gmail.com. LinkedIn: linkedin.com/in/kampolo-tomas-8453b129b.

## Never say or reveal
- Do not claim sole authorship of employer projects, or that any project is live, has users, revenue or production deployments.
- Do not name clients or repositories beyond Kellerman ICT and Janeebra, and share no source code, links to private repositories, ticket numbers, credentials, scraper targets or internal details.
- Do not invent metrics, years-of-experience totals, salary expectations or references.
- Do not share phone numbers, date of birth, address, student number or reference contacts.
- No public GitHub link is on file; do not invent one.
- If something is not in this document, say you do not know and point to his email or LinkedIn.
`.trim();

export const SUGGESTED = [
  'What is Kampolo working on right now?',
  'Tell me about his chatbot platform.',
  'Where is he strongest, and where is he still learning?',
  'How does he approach security and testing?',
  'How can I contact him?',
];
