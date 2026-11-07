// Downloads the paintings listed in scripts/paintings.json into scripts/private/paintings-src/ (gitignored).
// A work is only saved when its source says it is public domain: the Met API's isPublicDomain flag, or a Wikimedia Commons
// licence of "Public domain" / "CC0". Anything else is skipped and reported. Credits metadata is saved beside each image.
// Usage: node scripts/fetch-paintings.mjs [id ...]   (default: every entry). Plain Node, no packages.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'scripts', 'private', 'paintings-src');
const UA = 'KampoloPortfolio/1.0 (kampolotomasva@gmail.com; personal portfolio build script)';
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'paintings.json'), 'utf8'));
const only = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });

const json = async (u) => { const r = await fetch(u, { headers: { 'User-Agent': UA } }); if (!r.ok) throw new Error(r.status + ' ' + u); return r.json(); };
async function save(u, file) {
  const r = await fetch(u, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!r.ok) throw new Error(r.status + ' ' + u);
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  return fs.statSync(file).size;
}

async function met(p) {
  const o = await json('https://collectionapi.metmuseum.org/public/collection/v1/objects/' + p.ref);
  if (o.isPublicDomain !== true || !o.primaryImage) return { skip: 'not marked public domain by the Met' };
  return { url: o.primaryImage, licence: 'CC0 (The Met Open Access)', page: o.objectURL, accession: o.accessionNumber };
}

async function commons(p) {
  const api = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata|url&titles=' + encodeURIComponent('File:' + p.ref);
  const d = await json(api);
  const page = Object.values(d.query.pages)[0];
  const info = page.imageinfo && page.imageinfo[0];
  if (!info) return { skip: 'file not found on Commons' };
  const lic = (info.extmetadata.LicenseShortName && info.extmetadata.LicenseShortName.value) || '';
  if (!/public domain|^pd\b|cc0/i.test(lic)) return { skip: 'licence is "' + lic + '"' };
  return { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(p.ref) + '?width=2800', licence: lic, page: info.descriptionurl };
}

for (const p of manifest.paintings) {
  if (only.length && !only.includes(p.id)) continue;
  try {
    const found = p.source === 'met' ? await met(p) : await commons(p);
    if (found.skip) { console.log('SKIP ', p.id.padEnd(18), found.skip); continue; }
    const file = path.join(out, p.id + '.jpg');
    const size = await save(found.url, file);
    fs.writeFileSync(path.join(out, p.id + '.json'), JSON.stringify({ ...p, licence: found.licence, page: found.page }, null, 2));
    console.log('SAVED', p.id.padEnd(18), Math.round(size / 1024) + ' KB', found.licence);
  } catch (e) {
    console.log('FAIL ', p.id.padEnd(18), e.message);
  }
}
