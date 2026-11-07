// Validates scripts/lab-data/namibia-labour.csv and writes labs/namibia-jobs.json, the file the Namibia jobs lab loads.
//   node scripts/lab-data/build-namibia.mjs [csv] [json]   (exit code 1 on any problem, nothing is written)
// Every row is a figure transcribed from a Namibia Statistics Agency publication, with its table and page. The checks:
// header, no blank cells, known regions, 14 regions plus Namibia for every series, no duplicates, value between 0 and 100,
// and value matching unemployed / labour force (the printed rate is rounded, so it may differ by 0.06 at most).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CSV = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'scripts', 'lab-data', 'namibia-labour.csv');
const OUT = process.argv[3] ? path.resolve(process.argv[3]) : path.join(ROOT, 'labs', 'namibia-jobs.json');

const HEADER = ['region', 'year', 'measure', 'definition', 'value', 'unemployed', 'labour_force', 'publication', 'table', 'page_printed', 'page_pdf', 'source_url', 'retrieved'];
const NATIONAL = 'Namibia';
const REGIONS = ['//Kharas', 'Erongo', 'Hardap', 'Kavango East', 'Kavango West', 'Khomas', 'Kunene', 'Ohangwena', 'Omaheke', 'Omusati', 'Oshana', 'Oshikoto', 'Otjozondjupa', 'Zambezi'];
const MEASURES = { overall: 'all people 15 and over', youth: 'youth aged 15 to 34' };
const DEFINITIONS = {
  broad: 'broad (searching for work not required)',
  strict: 'strict (searched for work and available)',
  '19th-icls': '19th ICLS (searched for work and available)',
};
const SOURCES = { 2018: 'Labour Force Survey 2018', 2023: 'Population and Housing Census 2023' };
const MAX_ROUNDING = 0.06;

function parseCsv(text) {
  const rows = [];
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (!line.trim()) continue;
    const cells = [];
    let cur = '', quoted = false;
    for (const ch of line) {
      if (ch === '"') quoted = !quoted;
      else if (ch === ',' && !quoted) { cells.push(cur); cur = ''; }
      else cur += ch;
    }
    cells.push(cur);
    rows.push(cells);
  }
  return rows;
}

const problems = [];
const fail = (msg) => problems.push(msg);

const rows = parseCsv(fs.readFileSync(CSV, 'utf8'));
if (rows[0].join() !== HEADER.join()) fail(`header must be: ${HEADER.join(',')}`);
const series = new Map();
rows.slice(1).forEach((cells, i) => {
  const where = `row ${i + 2}`;
  if (cells.length !== HEADER.length) return fail(`${where}: ${cells.length} cells, expected ${HEADER.length}`);
  const r = Object.fromEntries(HEADER.map((h, k) => [h, cells[k].trim()]));
  for (const h of HEADER) if (!r[h]) fail(`${where}: "${h}" is blank`);
  if (r.region !== NATIONAL && !REGIONS.includes(r.region)) fail(`${where}: unknown region "${r.region}"`);
  if (!SOURCES[r.year]) fail(`${where}: year ${r.year} has no source`);
  if (!MEASURES[r.measure]) fail(`${where}: unknown measure "${r.measure}"`);
  if (!DEFINITIONS[r.definition]) fail(`${where}: unknown definition "${r.definition}"`);
  if (!/^https:\/\//.test(r.source_url)) fail(`${where}: source_url must be https`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.retrieved)) fail(`${where}: retrieved must be YYYY-MM-DD`);
  if (!/^\d+$/.test(r.page_printed) || !/^\d+$/.test(r.page_pdf)) fail(`${where}: pages must be whole numbers`);
  const value = Number(r.value), u = Number(r.unemployed), lf = Number(r.labour_force);
  if (!(value >= 0 && value <= 100)) fail(`${where}: value ${r.value} is outside 0 to 100`);
  if (!Number.isInteger(u) || !Number.isInteger(lf) || u < 0 || lf <= 0 || u > lf) fail(`${where}: unemployed ${r.unemployed} and labour force ${r.labour_force} must be whole numbers with unemployed <= labour force`);
  else if (Math.abs((u / lf) * 100 - value) > MAX_ROUNDING) fail(`${where} ${r.region} ${r.year} ${r.measure}: value ${value} but ${u} / ${lf} = ${((u / lf) * 100).toFixed(2)}`);

  const id = `${r.year}-${r.measure}-${r.definition}`;
  if (!series.has(id)) series.set(id, { id, year: Number(r.year), measure: r.measure, definition: r.definition, publication: r.publication, table: r.table, page_printed: r.page_printed, page_pdf: r.page_pdf, source_url: r.source_url, retrieved: r.retrieved, values: {} });
  const s = series.get(id);
  for (const k of ['publication', 'table', 'page_printed', 'page_pdf', 'source_url', 'retrieved']) if (s[k] !== r[k]) fail(`${where}: ${k} differs inside series ${id}`);
  if (s.values[r.region]) fail(`${where}: duplicate ${r.region} in ${id}`);
  s.values[r.region] = { value, unemployed: u, labour_force: lf };
});
for (const s of series.values()) for (const name of [NATIONAL, ...REGIONS]) if (!s.values[name]) fail(`series ${s.id} is missing ${name}`);

if (problems.length) {
  console.error(`namibia-labour.csv: ${problems.length} problem(s)\n - ${problems.join('\n - ')}`);
  process.exit(1);
}

const order = ['2023-overall-19th-icls', '2023-youth-19th-icls', '2018-overall-broad', '2018-overall-strict', '2018-youth-broad'];
const list = [...series.values()].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
for (const s of list) {
  s.source = SOURCES[s.year];
  s.measure_text = MEASURES[s.measure];
  s.definition_text = DEFINITIONS[s.definition];
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ national: NATIONAL, regions: REGIONS, series: list }, null, 1) + '\n');
console.log(`namibia-labour.csv: ${rows.length - 1} rows, ${list.length} series, 14 regions plus Namibia each. Wrote ${path.relative(ROOT, OUT)}`);
