// Across rounds: every published run, grouped by client, oldest first. Bars compare runs within a column; the ±
// compares a run with the same client's previous run on the same snapshot. Rows shown further down are highlighted.
import { COL, CLIENT, fmt, h, hover, num, onVisible, secHead, who } from './bench.js';

const ms = (v) => (v >= 1000 ? `${fmt.n(v / 1000, 2)} s` : `${fmt.n(v, 0)} ms`);
// What an operator feels first, wall time last. `ref` = the client's own normal value (baseline), drawn as a tick.
const METRICS = [
  { label: 'block throughput', unit: '% of normal', better: 'up', fixedMax: 1,
    def: 'Gas processed per second while importing, as a share of the same client\u2019s normal rate (its 4-hour baseline). 100 % = no slowdown.',
    get: (r) => r.imports[0].follow.mgas_per_s / r.baseline.follow.mgas_per_s, show: (v) => `${fmt.n(v * 100, 0)} %`, ref: () => 1 },
  { label: 'newPayload p95', unit: 'ms', better: 'down',
    def: '95 % of the blocks validated during the import took at most this long. The tick is the same client\u2019s normal p95.',
    get: (r) => r.imports[0].follow.newpayload_ms.p95, show: ms, ref: (r) => r.baseline.follow.newpayload_ms.p95 },
  { label: 'peak extra disk', unit: 'GiB', better: 'down',
    def: 'How much fuller the test disk got at its peak during the import, temporary files included (5 s samples).',
    get: (r) => r.imports[0].disk_peak_gib, show: (v) => `${fmt.n(v, 0)} GiB` },
  { label: 'memory peak', unit: 'GB', better: 'down',
    def: 'The execution client\u2019s largest process memory during the import (page cache not counted).',
    get: (r) => r.imports[0].res.anon_peak_gb, show: (v) => `${fmt.n(v, 1)} GB` },
  { label: 'import time', unit: '', better: 'down',
    def: 'From the restart with the import flags to the client\u2019s own \u201cdone\u201d line.',
    get: (r) => r.imports[0].duration_s, show: fmt.hm },
];

export default async function (root, ctx) {
  if (!ctx.history) { root.closest('section').hidden = true; return; } // one run per client: nothing to compare yet
  const runs = ctx.runs, shown = new Set(ctx.res.clients.map((c) => c.run));
  const val = (m, r) => { try { return m.get(r) ?? null; } catch { return null; } };
  const maxOf = METRICS.map((m) => m.fixedMax ?? Math.max(...runs.flatMap((r) => [val(m, r), m.ref?.(r)]).filter((v) => v != null)));

  root.append(h('style', {}, `
    .hist { display: grid; grid-template-columns: minmax(210px, 250px) repeat(${METRICS.length}, minmax(0, 1fr)); gap: 0 16px; min-width: 860px }
    .hist .hd { padding: 0 0 10px; border-bottom: 1px solid var(--line) }
    .hist .grp { grid-column: 1 / -1; display: flex; align-items: baseline; gap: 12px; padding: 16px 0 6px }
    .hist .run { display: contents }
    .hist .run > div { padding: 8px 0; border-bottom: 1px solid rgba(226,230,226,.05); transition: opacity .2s }
    .hist .run.dim > div { opacity: .5 }
    .hist .run:hover > div { opacity: 1 }
    .hist .lab { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding-left: 10px !important; border-left: 2px solid transparent }
    .hist .v { display: flex; align-items: baseline; gap: 8px; font-size: 13px; margin-bottom: 5px; white-space: nowrap }
    .hist .d { font-size: 11px }
    .hist .bar { position: relative; height: 6px; border-radius: 3px; background: rgba(226,230,226,.07) }
    .hist .bar .fill { height: 100%; border-radius: 3px }
    .hist .bar i { position: absolute; top: -3px; bottom: -3px; border-left: 1.5px dashed var(--ink2) }
  `));

  const head = [h('div', { class: 'hd' }), ...METRICS.map((m) => hover(h('div', { class: 'hd lbl', style: 'cursor:help' },
    m.label, m.unit && h('span', { style: 'text-transform:none;letter-spacing:0' }, ` · ${m.unit}`)), m.def))];

  const grows = [];
  const ids = [...new Set(runs.map((r) => r.id))];
  const body = ids.flatMap((id) => {
    const mine = runs.filter((r) => r.id === id), col = CLIENT[id];
    const where = [...new Set(mine.map((r) => r.round.label.toLowerCase()))];
    const grp = h('div', { class: 'grp' }, who(mine[0], 20),
      h('span', { class: 'muted', style: 'font-size:11px' },
        `${mine.length} run${mine.length > 1 ? 's' : ''} · ${where.length === ctx.rounds.length ? 'every round' : `${new Intl.ListFormat('en').format(where)} only`}`));
    return [grp, ...mine.map((r, i) => {
      const prev = mine.slice(0, i).reverse().find((p) => p.pair.anchor_block === r.pair.anchor_block);
      const b = r.builds[0];
      const lab = h('div', { class: 'lab', style: shown.has(r.run) ? `border-left-color:${col}` : '' },
        h('a', { class: 'chip', href: `#${r.round.id}`, title: `Open ${r.round.label}` }, `${r.round.label} · ${fmt.day(r.round.date)}`),
        hover(h('a', { class: 'chip', href: `https://github.com/${b.repo}/commit/${b.commit}`, target: '_blank', rel: 'noopener' },
          r.tag ? `${r.tag} · ${b.commit.slice(0, 7)}` : b.commit.slice(0, 7)), `${b.repo}@${b.commit}${r.note ? `<br>${r.note}` : ''}`),
        r.latest === false && hover(h('span', { class: 'muted', style: 'font-size:11px;cursor:help' }, 'not in Latest'), r.note ?? 'Kept for comparison; not shown as this client\u2019s current run.'));
      const cells = METRICS.map((m, k) => {
        const v = val(m, r), pv = prev && val(m, prev);
        if (v == null) return h('div', {}, h('div', { class: 'v muted' }, '—'), h('div', { class: 'bar' }));
        const better = pv != null && (m.better === 'up' ? v > pv : v < pv);
        const fill = h('div', { class: 'fill', style: `background:${col};width:0` });
        grows.push([fill, `${Math.max(1, (v / maxOf[k]) * 100)}%`]);
        const ref = m.ref?.(r);
        return h('div', {},
          h('div', { class: 'v' }, num(m.show(v), ctx.src(r.imports[0].src)),
            // a share (throughput kept) moves in points; everything else as a relative change
            pv != null && hover(h('span', { class: 'd', style: `color:${better ? COL.green : COL.red}` },
              m.fixedMax ? `${v >= pv ? '+' : '−'}${fmt.n(Math.abs(v - pv) * 100, 0)} pts` : fmt.pct(pv, v)),
              `vs ${prev.round.label}${prev.tag ? ` ${prev.tag}` : ''} (${m.show(pv)})`)),
          h('div', { class: 'bar' }, fill, ref != null && h('i', { style: `left:${(ref / maxOf[k]) * 100}%` })));
      });
      return h('div', { class: `run${shown.has(r.run) ? '' : ' dim'}` }, lab, ...cells);
    })];
  });

  root.append(
    secHead('Across rounds',
      'Clients keep improving their import, so the benchmark is rerun as new builds land, and not every client is in every round. Each row is one published run; a client\u2019s runs share the same machine, snapshot and starting database, so a change between them comes from the build, or from mainnet: each run met different blocks, and each build ran once. ' +
      'Bars compare runs within a column, the ± is the change from the same client\u2019s previous run, and the highlighted rows are the ones shown below.'),
    h('div', { style: 'overflow-x:auto' }, h('div', { class: 'hist' }, head, body)),
  );
  onVisible(root, () => grows.forEach(([el, w]) => { el.style.width = w; }), 0.2);
}
