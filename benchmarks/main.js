import { CLIENT, DATA, Clock, getCSV, getJSON, h, reveal } from './bench.js';

const BASE = `${DATA}import/`;
const { rounds } = await getJSON(`${BASE}rounds.json`);
const round = rounds.find((r) => `#${r.id}` === location.hash) || rounds.at(-1);
const base = `${BASE}${round.id}/`;
const res = await getJSON(`${base}results.json`);

// Shared context handed to every section module: export default async function (root, ctx).
const tParam = new URLSearchParams(location.search).get('t');
const clock = new Clock(Math.max(...res.clients.flatMap((c) => c.imports.map((w) => w.duration_s))));
const paused = tParam != null && !Number.isNaN(+tParam);
if (paused) clock.seek(+tParam);
const ctx = {
  res,
  base,
  round,
  paused,
  src: (rel) => base + rel,
  csv: (rel) => getCSV(base + rel),
  color: (id) => CLIENT[id],
  client: (id) => res.clients.find((c) => c.id === id),
  clock,
};

document.getElementById('rounds').append(
  ...rounds.map((r) => h('a', { class: `pill${r.id === round.id ? ' on' : ''}`, href: `#${r.id}` }, `${r.label} · ${r.date}`)),
);
const links = [
  ['results.json', `${base}results.json`],
  ['raw files', `https://github.com/CPerezz/pbt-website/tree/main/uploads/benchmarks/import/${round.id}`],
  ['build_results.py', `${BASE}build_results.py`],
];
document.getElementById('foot').append(
  'Data: ',
  ...links.flatMap(([t, u], i) => [i ? ' · ' : '', h('a', { href: u }, t)]),
  ' — every number on this page links to the file it comes from.',
);
addEventListener('hashchange', () => location.reload());

await Promise.all(['intro', 'race', 'kept', 'cost', 'disk', 'setup'].map(async (id) => {
  const sec = document.getElementById(id);
  try {
    const mod = await import(`./${id}.js`);
    await mod.default(sec.querySelector('.wrap') || sec, ctx);
  } catch (e) {
    console.error(`section ${id}:`, e);
  }
}));
if (paused) document.getElementById('race').scrollIntoView();
reveal();
