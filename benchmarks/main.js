import { CLIENT, Clock, fmt, getCSV, h, loadRuns, reveal } from './bench.js';
import { addSwitch } from './diff.js';

// The hash picks the view: '' / #latest = each client's newest run, #r1, #r2… = one round as published.
const data = await loadRuns();
const key = location.hash.slice(1);
const view = data.view(data.rounds.some((r) => r.id === key) ? key : 'latest');
const repo = 'https://github.com/CPerezz/pbt-website/tree/main/uploads/benchmarks/import';

// Shared context handed to every section module: export default async function (root, ctx).
// Every data path is relative to import/, so a view may mix runs from several rounds.
const ctx = {
  res: view,
  runs: data.runs,
  rounds: data.rounds,
  src: (rel) => data.base + rel,
  csv: (rel) => getCSV(data.base + rel),
  color: (id) => CLIENT[id],
  clock: new Clock(Math.max(...view.clients.flatMap((c) => c.imports.map((w) => w.duration_s)))),
  tree: view.id === 'latest' ? repo : `${repo}/${view.id}`,
  resultsSrc: data.base + view.results.at(-1),
  history: data.runs.some((r, i, a) => a.findIndex((q) => q.id === r.id) !== i), // some client has 2+ runs
};

document.getElementById('views').append(
  h('a', { class: `pill${view.id === 'latest' ? ' on' : ''}`, href: '#latest' }, 'Latest'),
  ...data.rounds.map((r) => h('a', { class: `pill${r.id === view.id ? ' on' : ''}`, href: `#${r.id}` }, `${r.label} · ${fmt.day(r.date)}`)),
);
const links = [
  ...view.results.map((p) => [p, data.base + p]),
  ['raw files', ctx.tree],
  ['build_results.py', `${data.base}build_results.py`],
];
document.getElementById('foot').append(
  'Data: ',
  ...links.flatMap(([t, u], i) => [i ? ' · ' : '', h('a', { href: u }, t)]),
  ' — every number on this page links to the file it comes from.',
);
addEventListener('hashchange', () => location.reload());

await Promise.all(['intro', 'race', 'kept', 'cost', 'disk', 'setup', 'reproduce'].map(async (id) => {
  const sec = document.getElementById(id);
  try {
    const mod = await import(`./${id}.js`);
    const root = sec.querySelector('.wrap') || sec;
    await mod.default(root, ctx);
    if (ctx.history) addSwitch(id, root, ctx); // results sections get a "Compare rounds" switch
  } catch (e) {
    console.error(`section ${id}:`, e);
  }
}));
reveal();
