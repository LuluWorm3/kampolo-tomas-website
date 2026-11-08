// Deploys the committed site to Netlify from a clean copy, so internal files are never published.
//   node scripts/deploy.mjs --site <site id or name> [--prod] [--message "text"] [--dry-run]
// Why: Netlify serves files case-insensitively but its redirect rules are case-sensitive, so blocking /docs/* did not stop /DOCS/... .
// Publishing the whole repository root therefore exposed the notes, the build scripts and the function source. This script copies only
// the public files into one folder and the functions into another, so the others are not on the site at all.
// Needs the Netlify CLI, signed in to the account that owns the site. Deploys HEAD (what is committed), not the working tree.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name) => { const i = process.argv.indexOf('--' + name); return i > -1 ? process.argv[i + 1] : ''; };
const flag = (name) => process.argv.includes('--' + name);
const SITE = arg('site');
if (!SITE) { console.error('usage: node scripts/deploy.mjs --site <id|name> [--prod] [--message "text"] [--dry-run]'); process.exit(2); }

// Never published: notes, build and test scripts, function source (deployed separately), repo and config files.
const EXCLUDE = new Set(['docs', 'scripts', 'netlify', 'AGENTS.md', 'CLAUDE.md', 'README.md', 'netlify.toml', '.gitignore', '.gitattributes']);

// npm and netlify are .cmd shims on Windows and need a shell, which joins arguments without quoting them; git and tar do not.
const SHELL = new Set(['npm', 'netlify']);
function run(cmd, args, opts = {}) {
  const shell = process.platform === 'win32' && SHELL.has(cmd);
  const r = spawnSync(cmd, shell ? args.map((a) => (/\s/.test(a) ? `"${a}"` : a)) : args, { stdio: 'inherit', shell, ...opts });
  if (r.status !== 0) { console.error(`failed: ${cmd} ${args.join(' ')}`); process.exit(r.status || 1); }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-'));
const exportDir = path.join(tmp, 'export');
const proj = path.join(tmp, 'proj');
const site = path.join(proj, 'site');
const fns = path.join(proj, 'functions');
fs.mkdirSync(exportDir, { recursive: true });
fs.mkdirSync(site, { recursive: true });

// 1. what is committed
const archive = path.join(tmp, 'head.tar');
run('git', ['-C', ROOT, 'archive', '--format=tar', '-o', archive, 'HEAD']);
run('tar', ['-xf', 'head.tar', '-C', 'export'], { cwd: tmp }); // relative paths: GNU tar reads a drive letter followed by a colon as a remote host

// 2. public files only
for (const name of fs.readdirSync(exportDir)) {
  if (EXCLUDE.has(name)) continue;
  fs.cpSync(path.join(exportDir, name), path.join(site, name), { recursive: true });
}

// 3. functions and their dependency
fs.cpSync(path.join(exportDir, 'netlify', 'functions'), fns, { recursive: true });
if (fs.existsSync(path.join(fns, 'package.json'))) run('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], { cwd: fns });

// 4. the same config, pointing at the two folders
let toml = fs.readFileSync(path.join(exportDir, 'netlify.toml'), 'utf8');
toml = toml.replace(/^(\s*publish\s*=\s*).*$/m, '$1"site"').replace(/^(\s*functions\s*=\s*).*$/m, '$1"functions"');
fs.writeFileSync(path.join(proj, 'netlify.toml'), toml);

const leaked = ['docs', 'scripts', 'netlify', 'AGENTS.md', 'README.md', 'CLAUDE.md', 'netlify.toml'].filter((n) => fs.existsSync(path.join(site, n)));
if (leaked.length) { console.error('internal files in the public folder: ' + leaked.join(', ')); process.exit(1); }
console.log(`public folder: ${fs.readdirSync(site).length} entries; functions: ${fs.readdirSync(fns).filter((n) => n !== 'node_modules').length} entries`);

if (flag('dry-run')) { console.log('dry run: nothing uploaded. Folder kept at ' + proj); process.exit(0); }

const args = ['deploy', '--site', SITE, '--dir', 'site', '--functions', 'functions', '--message', arg('message') || 'Deploy from scripts/deploy.mjs'];
if (flag('prod')) args.push('--prod');
run('netlify', args, { cwd: proj });
fs.rmSync(tmp, { recursive: true, force: true });
