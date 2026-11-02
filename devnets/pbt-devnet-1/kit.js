// Devnet page kit: bench.js plus what a nine-day, nine-node devnet needs (data base, provenance, glossary, day clock, lanes).
import { CLIENT, COL, GLOSSARY, REDUCED, avatar, fmt, getJSON, h, hover, s } from '../../benchmarks/bench.js';
export { CLIENT, COL, REDUCED, avatar, countUp, fmt, h, hover, onVisible, s, scale, secHead, scramble } from '../../benchmarks/bench.js';

export const BASE = new URL('../../uploads/devnets/pbt-devnet-1/', import.meta.url).href;
export const data = (file) => getJSON(BASE + file);

export const HOSTS = ['geth-1', 'geth-2', 'geth-3', 'nethermind-1', 'nethermind-2', 'besu-1', 'besu-2', 'erigon-1', 'erigon-2'];
export const clientOf = (host) => host.split('-')[0];
export const color = (host) => CLIENT[clientOf(host)];
export const NAME = { geth: 'geth', nethermind: 'Nethermind', besu: 'Besu', erigon: 'erigon' };
export const STATE_COLOR = { 'one tree': COL.muted, migrating: COL.blue, replaying: COL.lilac, 'two trees': COL.ink2, 'two trees + load': COL.amber, 'binary only': COL.green };

// A published number: links to the JSON file it comes from; hover names the file and the catalog view behind it.
export const num = (text, file, view, attrs = {}) =>
  hover(h('a', { class: 'num', href: BASE + file, target: '_blank', rel: 'noopener', ...attrs }, text),
    `<span class="lbl">source</span><br><b>${file}</b>${view ? `<br><span class="muted">${view}</span>` : ''} ↗`);

// Glossary: the benchmarks terms plus the devnet's. term(key, text?) → dotted-underline span, hover defines it.
export const TERMS = {
  ...GLOSSARY,
  anchor: 'The finalized block N whose state the snapshot was taken from. A snapshot import rebuilds the tree at N, then replays every block since N.',
  bal: 'Block-level access list: the keys a block touched. The replay re-applies blocks from their access lists instead of re-executing them.',
  replay: 'Catching the binary tree up to the chain head from the blocks\u2019 access lists: a week of blocks (52–58 k) after a snapshot import, the few hundred blocks produced during a self-conversion.',
  check1: 'Check 1: the binary tree\u2019s root equals the root the snapshot header commits to.',
  check2: 'Check 2: the old MPT root is re-derived from the new tree\u2019s leaves and must match the block header, proving the tree holds exactly the committed state (40–50 min on geth).',
  self: 'Self-conversion: the node scans its own flat state at a block P of its choosing and builds the binary tree from it, with the preimage file as the only input. No snapshot, no anchor.',
  import: 'Snapshot import: the node consumes a 163 GB snapshot + preimages package produced elsewhere, verifies it against block N\u2019s header, then replays every block since N.',
  twotrees: 'Between its migration and the fork a node maintains both trees on every block: the MPT the chain still commits to, and the binary tree it will switch to.',
  dual: 'erigon\u2019s own design: a binary commitment kept next to its hexary one from 10-25, no snapshot or conversion step.',
  fork: 'binaryTrieTime, 2026-10-29 09:00 UTC: from block 24,551,102 the header\u2019s state root is the binary tree\u2019s. Every node must compute the same root or reject the block.',
  window: 'The 19 minutes between the fork block and its finalization, during which a reorg could still cross back; both trees are kept until it closes.',
  disposal: 'Deleting the MPT once the fork is final: a tree\u2019s worth of disk (and memory) comes back.',
  participation: 'Share of the validators\u2019 attestations that arrived in an epoch; finality needs two thirds.',
  finality: 'Finality distance: how many epochs behind the head the last finalized checkpoint is; 2 is normal, more means finality is lagging or paused.',
  missed: 'Slots in which no block was produced. On a nine-validator devnet, one node down costs roughly one slot in nine.',
  xen: 'The storage-heavy load phase from 10-26: spamoor filled every other block to ~193 Mgas with ~2,000 storage writes and 222 contract creations each.',
  synthetic: 'The 50,400 blocks produced before the devnet opened (5,534 storage writes each) that every snapshot import had to replay to reach the head.',
  fullblock: 'A block with at least 50 Mgas of gas used; latency figures use full blocks so empty blocks do not pull the medians down.',
  mgasfrac: 'Median engine_newPayload time divided by the block\u2019s gas in MGas: processing cost per unit of work, comparable across load levels.',
  anon: GLOSSARY.anon,
  cap: 'The execution container\u2019s memory limit (cgroup): 16 GiB on five nodes, 32 GiB on four; the kernel kills the process when it is exceeded (OOM kill).',
  eip7870: 'EIP-7870\u2019s hardware recommendations (March 2026): 32 GB RAM and 4 TB NVMe for a full node, 64 GB for an attester.',
};
export const term = (key, text) => hover(h('span', { class: 'term' }, text ?? key), TERMS[key] ?? key);

// Dates: the page is UTC throughout.
const mon = (t) => new Date(t * 1000);
export const date = (t) => mon(t).toISOString().slice(5, 16).replace('T', ' ');   // "10-29 09:00"
export const day = (t) => mon(t).toISOString().slice(5, 10);                       // "10-29"
// Durations the way the article writes them: 2h41m, 3m 28s, 40 s.
export const dur = (sec) => {
  const v = Math.round(sec), hh = Math.floor(v / 3600), mm = Math.floor((v % 3600) / 60), ss = v % 60;
  return hh ? `${hh}h${String(mm).padStart(2, '0')}m` : mm ? `${mm}m ${String(ss).padStart(2, '0')}s` : `${ss} s`;
};

// Nine-day clock controls: ▶/❚❚, scrubber, a date readout. t is seconds since T0.
export function dayControls(clock, t0) {
  const btn = h('button', { 'aria-label': 'Play or pause the nine days', onclick: () => clock.toggle() });
  const range = h('input', {
    type: 'range', min: 0, max: Math.ceil(clock.duration / 600) * 600, step: 600, value: 0, 'aria-label': 'Day and hour of the devnet',
    oninput: (e) => { const v = +e.target.value; clock.pause(); clock.seek(v); },
  });
  const t = h('span', { class: 't' });
  clock.on((v) => { btn.textContent = clock.playing ? '❚❚' : '▶'; range.value = v; t.textContent = date(t0 + v); });
  return h('div', { class: 'clock' }, btn, t, range, h('span', { class: 'lbl' }, `1 s = ${fmt.n(clock.speed / 3600, 1)} h · UTC`));
}

// Stats strip: [{ label, value: node|string, note? }] → a row of small panels.
export const strip = (items) => h('div', { class: 'strip' },
  ...items.map(({ label, value, note }) => h('div', { class: 'stat' },
    h('span', { class: 'lbl' }, label), h('div', { class: 'big' }, value), note ? h('span', { class: 'note' }, ...[].concat(note)) : null)));

// SVG helpers shared by the lane charts.
export const hatch = (id, col) => s('pattern', { id, width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
  s('rect', { width: 6, height: 6, fill: col, opacity: 0.25 }), s('rect', { width: 2, height: 6, fill: col, opacity: 0.9 }));
export const dayTicks = (svg, xs, t0, t1, yTop, yBot, label = true) => {
  for (let t = (Math.floor(t0 / 86400) + 1) * 86400; t <= t1; t += 86400) {
    svg.append(s('line', { x1: xs(t), x2: xs(t), y1: yTop, y2: yBot, stroke: COL.line, 'stroke-dasharray': '2 4' }));
    if (label) svg.append(s('text', { x: xs(t), y: yBot + 13, 'text-anchor': 'middle', 'font-size': 10, fill: COL.muted, text: day(t) }));
  }
};
export const vline = (svg, x, y0, y1, col, label, dy = -4) => {
  svg.append(s('line', { x1: x, x2: x, y1: y0, y2: y1, stroke: col, 'stroke-width': 1.2, 'stroke-dasharray': '4 3' }));
  if (label) svg.append(s('text', { x: x + 4, y: y0 + dy, 'font-size': 10, fill: col, text: label }));
};
// A cursor following the clock across an x scale over absolute time.
export const cursor = (svg, clock, xs, t0, y0, y1) => {
  const line = s('line', { y1: y0, y2: y1, stroke: COL.green, 'stroke-width': 1.5, opacity: 0.9, style: 'pointer-events:none' });
  svg.append(line);
  clock.on((v) => { const x = xs(t0 + v); line.setAttribute('x1', x); line.setAttribute('x2', x); });
  return line;
};
// Node label in an SVG: avatar + host name in the client's colour.
export const nodeLabel = (svg, x, y, host, size = 12) => {
  svg.append(avatar(clientOf(host), size + 4, { x, y: y - size }), s('text', { x: x + size + 10, y: y + 1, 'font-size': size, 'font-weight': 600, fill: color(host), text: host }));
};
// Nearest index in a sorted array of [t, ...] rows.
export const nearest = (rows, t) => { let lo = 0, hi = rows.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; rows[m][0] < t ? (lo = m + 1) : (hi = m); } return lo; };
export const ms = (v) => `${fmt.n(v, v < 100 ? 1 : 0)} ms`;
export const pct = (v) => v == null ? '—' : `${Math.round(v * 100)} %`;
export const motion = !REDUCED;
