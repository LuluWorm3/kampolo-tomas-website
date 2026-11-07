// CV content for the generated CV pages and PDFs (scripts/build.mjs).
// Public-safe subset only: no date of birth, postal address, student number, ID numbers,
// second phone or reference contact details. References are "available on request".
// Claims must match docs/ and netlify/functions/knowledge.mjs.

export const PERSON = {
  name: 'Kampolo Tomas Vaino Amunyela',
  title: 'Software Engineer & IT Specialist',
  location: 'Windhoek, Namibia',
  email: 'kampolotomasva@gmail.com',
  phone: '+264 81 850 3687',
  linkedin: 'linkedin.com/in/kampolo-tomas-8453b129b',
  site: 'kampolo-tomas-website.netlify.app',
};

const JOBS = {
  kellerman: {
    role: 'Software Engineer (Work-Integrated Learning)',
    org: 'Kellerman ICT — Janeebra platform, Windhoek',
    dates: 'Jul 2026 – Present',
    bullets: [
      'Built mobile features in React Native and Expo, including in-app password change and dark mode aligned to the web design system.',
      'Contributed to a polls feature across mobile, web, admin and API, and to mobile performance work.',
      'Developed backend REST APIs and authored Firestore security rules for role-based access control.',
      'Created an automated API security test suite in pytest.',
      'Work through a Git pull request workflow under senior developer supervision.',
    ],
  },
  freelance: {
    role: 'IT Support Specialist (Freelance)',
    org: 'Independent Contractor, Windhoek',
    dates: 'Jan 2021 – Present',
    bullets: [
      'Delivered hardware maintenance, network configuration and system administration for individuals and small businesses.',
      'Administered Microsoft 365: user accounts, permissions, Azure AD, Teams, SharePoint and OneDrive.',
      'Troubleshot TCP/IP, DNS, DHCP, VPN and email across Windows, macOS and Linux.',
      'Kept asset registers, job logs and technical documentation.',
    ],
  },
  benito: {
    role: 'General IT & Administration Assistant',
    org: 'Benito Trading Enterprises, Outapi / Windhoek',
    dates: '2020 – Present',
    bullets: [
      'Set up and maintained equipment, high-volume printers and office systems.',
      'Produced graphic design and branded materials for clients.',
      'Supervised a subcontracted team in 2024: working hours, equipment tracking and incident handling.',
    ],
  },
};

const PROJECTS = {
  chatbot: {
    name: 'Multi-channel chatbot platform',
    year: '2026 · Personal',
    text: 'Chatbot platform with a visual flow builder, AI replies, shared inbox and public API (Node.js, Express, SQLite). Two-factor login, hashed API keys, signed webhooks. Main author, built with Claude Code; channels tested with mocks, not yet live.',
  },
  patient: {
    name: 'Patient Records Data Management System',
    year: '2025 · University',
    text: 'Relational database prototype modelled on DHIS2 structures, with role-based access control, data-entry forms, query reports and a backup and recovery procedure.',
  },
  uptime: {
    name: 'Automated Network Uptime Monitor',
    year: '2025 · University',
    text: 'Python tool that pings critical nodes, emails alerts on failure, logs uptime history to a database and produces daily availability reports.',
  },
  audit: {
    name: 'IT Infrastructure Security Audit',
    year: '2025 · University',
    text: 'Audit of a simulated enterprise network: found access-control and compliance weaknesses, applied hardening and defined incident response procedures.',
  },
  hr: {
    name: 'HR Management System — Support Module',
    year: '2024 · University',
    text: 'Backend module with role-based access control and performance optimisation, with admin documentation and user guides.',
  },
  shipcheck: {
    name: 'shipcheck',
    year: '2026 · Personal',
    text: 'A personal standard for AI coding assistants: match the codebase, and back every "done" claim with a check that was run. Published as a Claude Code skill with adapters for other tools.',
  },
};

const EDU = [
  {
    name: 'Bachelor of Informatics',
    org: 'Namibia University of Science and Technology (NUST), Windhoek',
    dates: 'Final year, 2026',
    text: 'Business Intelligence & Analytics, Data Analytics, Database Programming, Information Systems Security, Systems Analysis & Design, Data Networks, Website Development.',
  },
  {
    name: 'National Senior Certificate (Grade 12)',
    org: 'Ruacana Vocational Senior Secondary School',
    dates: '2020',
    text: '',
  },
];

const MIT_SHORT = 'MIT Open Learning — Universal AI Programme: 19 course certificates (Feb–Jun 2026) covering Python, data analytics and machine learning, neural networks, deep learning and computer vision, large language models, LLM-based AI agents, multimodal AI, prescriptive AI, explainability and AI ethics.';
const MIT_FULL = [
  'Introduction to Universal AI', 'Python Coding, Parts 1–2', 'Foundations of Data Analytics and Machine Learning',
  'Supervised and Unsupervised Learning', 'Foundations of Neural Networks', 'Deep Learning and Computer Vision',
  'Hands-on Deep Learning', 'Large Language Models', 'LLM-based AI Agents', 'Multimodal AI',
  'Model-Driven Prescriptive AI, Parts 1–2', 'Data-Driven Prescriptive AI', 'Explainability and Fairness',
  'Explanation, Reasoning and AI Ethics', 'Generative AI, the Future of Work and Human Creativity',
  'AI and Entrepreneurship', 'AI and Sustainability: Transportation',
];
const OTHER_CERTS = 'HP LIFE (IT for Business Success, Customer Experience for Business Success, Social Media Marketing, Jun 2026); Simplilearn Project Management 101; IT Customer Support Basics.';

const COMMUNITY = 'Member, ISACA Windhoek Chapter. Team leader, NUST Capital Edge — NSIC 2026 stock trading competition.';

export const MODES = {
  general: {
    file: 'Kampolo-Tomas-CV',
    label: 'CV — one page',
    blurb: 'Best for corporate, IT and software roles.',
    summary: 'Informatics graduate building mobile, web and backend software with React Native, Node.js and Python, on a foundation of IT support, networking, databases and applied AI. Currently a software engineer on a work-integrated-learning placement.',
    pages: 1,
    sections: [
      { title: 'Experience', kind: 'jobs', items: [{ ...JOBS.kellerman, bullets: JOBS.kellerman.bullets.slice(0, 4) }, { ...JOBS.freelance, bullets: JOBS.freelance.bullets.slice(0, 3) }, { ...JOBS.benito, bullets: JOBS.benito.bullets.slice(0, 2) }] },
      { title: 'Education', kind: 'edu', items: EDU },
      { title: 'Selected projects', kind: 'projects', items: [PROJECTS.chatbot, PROJECTS.patient, PROJECTS.uptime, PROJECTS.audit] },
      { title: 'Certifications', kind: 'text', items: [MIT_SHORT, OTHER_CERTS] },
      { title: 'Skills', kind: 'skills', items: [
        ['Software', 'TypeScript, JavaScript, Node.js, React, React Native, Expo, Python, Next.js'],
        ['Data', 'PostgreSQL, MySQL, SQLite, Firebase / Firestore, business intelligence'],
        ['Security & IT', 'Access control, API security testing, Microsoft 365, networking (TCP/IP, DNS, DHCP, VPN), hardware support'],
        ['Tools', 'Git, pytest, Vitest, Claude Code'],
      ] },
      { title: 'Community & languages', kind: 'text', items: [COMMUNITY, 'Languages: Oshindonga, English, Afrikaans.'] },
    ],
  },
  data: {
    file: 'Kampolo-Tomas-CV-Data',
    label: 'CV — data & AI, one page',
    blurb: 'Best for data, analytics and junior AI roles.',
    summary: 'Informatics graduate focused on data: relational database design, SQL, business intelligence and reporting, with 19 MIT Universal AI certificates in machine learning, deep learning and large language models, plus the engineering skills to build and ship it.',
    pages: 1,
    sections: [
      { title: 'Education & certifications', kind: 'edu', items: [EDU[0], { name: 'MIT Open Learning — Universal AI Programme', org: '19 course certificates', dates: 'Feb – Jun 2026', text: MIT_SHORT.replace('MIT Open Learning — Universal AI Programme: 19 course certificates (Feb–Jun 2026) covering ', 'Covering ') }] },
      { title: 'Data projects', kind: 'projects', items: [PROJECTS.patient, PROJECTS.uptime, PROJECTS.hr, PROJECTS.chatbot] },
      { title: 'Experience', kind: 'jobs', items: [{ ...JOBS.kellerman, bullets: [JOBS.kellerman.bullets[2], JOBS.kellerman.bullets[3], JOBS.kellerman.bullets[1]] }, { ...JOBS.freelance, bullets: [JOBS.freelance.bullets[0], JOBS.freelance.bullets[3]] }] },
      { title: 'Skills', kind: 'skills', items: [
        ['Data', 'Relational design, SQL, PostgreSQL, MySQL, SQLite, DHIS2 data structures, business intelligence, data analytics'],
        ['AI / ML', 'Machine learning, neural networks, deep learning, computer vision, LLMs, AI agents (coursework and projects)'],
        ['Engineering', 'Python, TypeScript, Node.js, Git, pytest, REST APIs'],
        ['IT', 'Microsoft 365, networking, access control, technical documentation'],
      ] },
      { title: 'Other', kind: 'text', items: [OTHER_CERTS, COMMUNITY, 'Languages: Oshindonga, English, Afrikaans.'] },
    ],
  },
  full: {
    file: 'Kampolo-Tomas-CV-Full',
    label: 'CV — full',
    blurb: 'Everything, for application forms and detailed reviews.',
    summary: 'Informatics graduate building mobile, web and backend software with React Native, Node.js and Python, on a foundation of IT support, networking, databases and applied AI. Currently a software engineer on a work-integrated-learning placement at Kellerman ICT.',
    pages: 2,
    sections: [
      { title: 'Experience', kind: 'jobs', items: [JOBS.kellerman, JOBS.freelance, JOBS.benito] },
      { title: 'Education', kind: 'edu', items: EDU },
      { title: 'Projects', kind: 'projects', items: [PROJECTS.chatbot, PROJECTS.shipcheck, PROJECTS.patient, PROJECTS.uptime, PROJECTS.audit, PROJECTS.hr] },
      { title: 'Certifications', kind: 'text', items: ['MIT Open Learning — Universal AI Programme, 19 course certificates (Feb–Jun 2026): ' + MIT_FULL.join('; ') + '.', OTHER_CERTS] },
      { title: 'Skills', kind: 'skills', items: [
        ['Software', 'TypeScript, JavaScript, Node.js, Express, React, React Native, Expo, Next.js, Python; foundational PHP and Django REST'],
        ['Data', 'PostgreSQL, MySQL, SQLite, Firebase / Firestore, business intelligence, data analytics'],
        ['AI', 'LLM integration and chat flows, AI-assisted development, machine learning and AI agents (coursework)'],
        ['Security', 'Access control and RBAC, API security testing, Firestore security rules (foundational), vulnerability assessment'],
        ['IT & networking', 'Microsoft 365 administration (Azure AD, Teams, SharePoint, OneDrive), TCP/IP, DNS, DHCP, VPN, firewall configuration, hardware troubleshooting'],
        ['Tools', 'Git, pytest, Vitest, Claude Code, technical documentation'],
      ] },
      { title: 'Community & languages', kind: 'text', items: [COMMUNITY, 'Languages: Oshindonga, English, Afrikaans. Nationality: Namibian.'] },
    ],
  },
};
