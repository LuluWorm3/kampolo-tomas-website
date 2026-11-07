// Downloads the photographs listed in scripts/photos.json into scripts/private/shop-src/ (gitignored).
// A photo is only saved when Wikimedia Commons reports a licence that allows reuse: CC0, public domain, CC BY or CC BY-SA
// (never NC or ND), with a named author for the credit line. Anything else is skipped and reported. The verified credit
// (title, author, licence, licence link, page, retrieval date) is written back into scripts/photos.json, which the build
// reads to print the credit under every image.
// Usage: node scripts/fetch-photos.mjs [id ...]   (default: every entry). Plain Node, no packages.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'scripts', 'private', 'shop-src');
const file = path.join(root, 'scripts', 'photos.json');
const UA = 'KampoloPortfolio/1.0 (kampolotomasva@gmail.com; personal portfolio build script)';
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
const only = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(u) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(u, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    if (r.status === 429 || r.status >= 500) { await sleep(2500 * (i + 1)); continue; }
    if (!r.ok) throw new Error(r.status + ' ' + u);
    return r;
  }
  throw new Error('gave up on ' + u);
}
const text = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

// Accepted: CC0, public domain, CC BY x.y and CC BY-SA x.y. Rejected: NC, ND, "free use", FAL, unknown.
const OK = [/^cc0\b/i, /^public domain\b/i, /^pd\b/i, /^cc[ -]by(-sa)?[ -]\d(\.\d)?(\s|$)/i];
const BAD = /-nc|-nd|\bnc\b|\bnd\b|non-?commercial|no ?deriv|copyrighted|fair use|gfdl only/i;

async function check(ref) {
  const api = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata|url|size|mime&titles=' + encodeURIComponent('File:' + ref);
  const page = Object.values((await (await get(api)).json()).query.pages)[0];
  const info = page.imageinfo && page.imageinfo[0];
  if (!info) return { skip: 'file not found on Commons' };
  if (!/jpeg/.test(info.mime)) return { skip: 'not a JPEG (' + info.mime + ')' };
  const m = info.extmetadata;
  const v = (k) => (m[k] && m[k].value) || '';
  const licence = v('LicenseShortName');
  if (!licence || BAD.test(licence) || !OK.some((re) => re.test(licence))) return { skip: 'licence is "' + licence + '"' };
  const needsCredit = !/^(cc0|public domain|pd)/i.test(licence);
  // Wikitext signatures such as "Name (talk) 10:12, 29 June 2017 (UTC)" are reduced to the name.
  const author = text(v('Artist')).replace(/\(\s*talk\s*\)/gi, '').replace(/\d{1,2}:\d{2},? \d{1,2} \w+ \d{4} \(UTC\)/, '').replace(/[\s(]+$/, '').trim() || (needsCredit ? '' : 'Unknown author');
  if (!author) return { skip: 'no author named, so the credit line cannot be shown' };
  return {
    url: info.url,
    size: [info.width, info.height],
    notes: text(v('Restrictions')),
    credit: {
      title: ref.replace(/\.[a-z]+$/i, '').replace(/_/g, ' '),
      author: author.length > 140 ? author.slice(0, 137) + '...' : author,
      licence,
      licenceUrl: v('LicenseUrl') || '',
      page: info.descriptionurl,
      source: 'Wikimedia Commons',
      retrieved: new Date().toISOString().slice(0, 10),
    },
  };
}

const entries = [manifest.hero, ...manifest.products];
let saved = 0, skipped = 0;
for (const p of entries) {
  if (only.length && !only.includes(p.id)) continue;
  try {
    const found = await check(p.ref);
    if (found.skip) { skipped++; console.log('REJECT', p.id.padEnd(16), found.skip, '(' + p.ref + ')'); continue; }
    const dest = path.join(out, p.id + '.jpg');
    const body = Buffer.from(await (await get(found.url)).arrayBuffer());
    fs.writeFileSync(dest, body);
    p.credit = found.credit;
    saved++;
    console.log('SAVED ', p.id.padEnd(16), Math.round(body.length / 1024) + ' KB', found.size.join('x'), '|', found.credit.licence, '|', found.credit.author.slice(0, 40), found.notes ? '| NOTE: ' + found.notes : '');
    await sleep(600);
  } catch (e) {
    console.log('FAIL  ', p.id.padEnd(16), e.message);
  }
}
fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
console.log(`\n${saved} saved, ${skipped} rejected. Credits written to scripts/photos.json.`);
