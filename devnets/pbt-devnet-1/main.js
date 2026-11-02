import { Clock, h, reveal } from '../../benchmarks/bench.js';
import { BASE, data } from './kit.js';

const dev = await data('devnet.json');

// Shared context for every section: export default async function (root, ctx).
// One nine-day clock: t = seconds since the devnet's first hour; 1 real second = 12,000 s (the nine days in a minute).
const clock = new Clock(dev.window.t1 - dev.window.t0, 12000);
const ctx = {
  dev, data, base: BASE, clock,
  T0: dev.window.t0, T1: dev.window.t1, FORK: dev.fork.t, XEN: dev.xen_t,
  nodes: dev.nodes, node: (host) => dev.nodes.find((n) => n.host === host),
};

const files = ['devnet', 'timeline', 'methods', 'validating', 'cost', 'fork', 'network'];
document.getElementById('foot').append(
  'Data: ',
  ...files.flatMap((f, i) => [i ? ' · ' : '', h('a', { href: `${BASE}${f}.json` }, `${f}.json`)]),
  ' — every number on this page links to the file it comes from; each file names the catalog views behind it.',
);

await Promise.all(['intro', 'timeline', 'methods', 'validating', 'cost', 'fork', 'network', 'setup', 'conclusions', 'provenance'].map(async (id) => {
  const sec = document.getElementById(id);
  try {
    const mod = await import(`./${id}.js`);
    await mod.default(sec.querySelector('.wrap') || sec, ctx);
  } catch (e) {
    console.error(`section ${id}:`, e);
  }
}));
reveal();
