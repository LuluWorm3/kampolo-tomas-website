// Hidden terminal page (/terminal/). Everything runs in the browser; nothing is sent anywhere.
(function () {
  var out = document.getElementById('termOut');
  var form = document.getElementById('termForm');
  var input = document.getElementById('termIn');
  var history = [];
  var pos = 0;

  var PROJECTS = [
    ['chatbot-platform', 'Multi-channel chatbot platform. Personal, main author, built with Claude Code. Channels mock-tested, not live.'],
    ['usco-ai', 'Embeddable AI sales assistant (Next.js, Prisma, PostgreSQL). Main human committer.'],
    ['janeebra', 'Business discovery platform. Contributor during a work-integrated-learning placement.'],
    ['shipcheck', 'Personal verify-before-you-claim standard for AI coding assistants.'],
    ['patient-records', 'Relational database prototype modelled on DHIS2. University, 2025.'],
    ['uptime', 'Python network uptime monitor with email alerts and daily reports. University, 2025.'],
    ['audit', 'Security audit and hardening of a simulated enterprise network. University, 2025.'],
    ['hr', 'HR system support module with role-based access control. University, 2024.'],
  ];

  function line(text, cls) {
    var d = document.createElement('div');
    d.className = 'term__line' + (cls ? ' ' + cls : '');
    d.textContent = text;
    out.appendChild(d);
    return d;
  }
  function link(label, href) {
    var d = document.createElement('div');
    d.className = 'term__line';
    var a = document.createElement('a');
    a.href = href;
    a.textContent = label;
    d.appendChild(a);
    out.appendChild(d);
  }
  function lines(arr) { arr.forEach(function (t) { line(t); }); }

  var COMMANDS = {
    help: function () {
      lines([
        'Commands:',
        '  about        who I am',
        '  projects     what I have built',
        '  skills       what I work with',
        '  contact      how to reach me',
        '  cv           CV downloads',
        '  documents    certificates and other documents',
        '  ls           list the hidden pages',
        '  theme dark|light   switch theme',
        '  swarm        run the swarm on the main site',
        '  clear        clear the screen',
        '  exit         back to the site',
      ]);
    },
    about: function () {
      lines([
        'Kampolo Tomas Vaino Amunyela. Software engineer and IT specialist, Windhoek, Namibia.',
        'Informatics graduate (NUST) on a work-integrated-learning placement as a software engineer.',
        'React Native, Node.js, Python, databases, networking, applied AI. 19 MIT Universal AI certificates.',
      ]);
    },
    whoami: function () { COMMANDS.about(); },
    projects: function () { PROJECTS.forEach(function (p) { line(p[0].padEnd(18) + p[1]); }); },
    skills: function () {
      lines([
        'strongest   TypeScript, JavaScript, Node.js, Microsoft 365 administration, hardware support',
        'working     React, React Native, Next.js, Python, SQL databases, REST APIs, access control, networking',
        'learning    Firestore security rules, web scraping, Playwright, machine learning',
        '(self-assessed; the site shows the same levels)',
      ]);
    },
    contact: function () {
      line('email     kampolotomasva@gmail.com');
      line('phone     +264 81 850 3687');
      line('linkedin  linkedin.com/in/kampolo-tomas-8453b129b');
    },
    cv: function () {
      link('Kampolo-Tomas-CV.pdf (one page)', '/files/Kampolo-Tomas-CV.pdf');
      link('Kampolo-Tomas-CV-Data.pdf (data and AI)', '/files/Kampolo-Tomas-CV-Data.pdf');
      link('Kampolo-Tomas-CV-Full.pdf (full)', '/files/Kampolo-Tomas-CV-Full.pdf');
    },
    documents: function () { link('/documents/', '/documents/'); },
    ls: function () {
      ['/lab/', '/now/', '/uses/', '/terminal/', '/swarm.html'].forEach(function (p) { link(p, p); });
    },
    theme: function (args) {
      var t = args[0];
      if (t !== 'dark' && t !== 'light') { line('usage: theme dark|light', 'term__err'); return; }
      document.documentElement.setAttribute('data-theme', t);
      try { localStorage.setItem('theme', t); } catch (e) {}
      line('theme set to ' + t);
    },
    swarm: function () { line('launching swarm...'); setTimeout(function () { location.href = '/?swarm=1'; }, 500); },
    clear: function () { out.textContent = ''; },
    exit: function () { location.href = '/'; },
    sudo: function (args) {
      if (args.join(' ') === 'hire kampolo') {
        lines(['[sudo] password for recruiter: ********', 'Permission granted. Excellent choice.', 'Next step: email kampolotomasva@gmail.com']);
      } else {
        line('kampolo is not in the sudoers file. This incident will not be reported.', 'term__err');
      }
    },
  };

  function run(raw) {
    var cmd = raw.trim();
    var echo = line('kampolo@portfolio:~$ ' + raw, 'term__cmd');
    if (!cmd) return;
    history.push(cmd);
    pos = history.length;
    var parts = cmd.split(/\s+/);
    var name = parts[0].toLowerCase();
    var fn = Object.prototype.hasOwnProperty.call(COMMANDS, name) ? COMMANDS[name] : null;
    if (!fn) { line('command not found: ' + name + '. Try help.', 'term__err'); return; }
    fn(parts.slice(1));
    window.scrollTo(0, document.body.scrollHeight);
    return echo;
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); run(input.value); input.value = ''; });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowUp') { if (pos > 0) { pos--; input.value = history[pos]; } e.preventDefault(); }
    else if (e.key === 'ArrowDown') { if (pos < history.length - 1) { pos++; input.value = history[pos]; } else { pos = history.length; input.value = ''; } e.preventDefault(); }
    else if (e.key === 'Tab') {
      e.preventDefault();
      var v = input.value.toLowerCase();
      var match = Object.keys(COMMANDS).filter(function (c) { return v && c.indexOf(v) === 0; });
      if (match.length === 1) input.value = match[0];
    }
  });
  document.getElementById('term').addEventListener('click', function () { input.focus(); });

  lines(['Kampolo Tomas, portfolio terminal. Type help to begin.', '']);
  input.focus();
})();
