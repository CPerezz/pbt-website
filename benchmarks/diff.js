// Round-diff views. Each results section can swap its animated view of the runs on the page for a static comparison
// of every published run, grouped by client, oldest first. The ± compares a run with the same client's previous run
// on the same snapshot; runs shown in the section's normal view are highlighted.
import { COL, CLIENT, fmt, h, hover, num, who } from './bench.js';

const ms = (v) => (v >= 1000 ? `${fmt.n(v / 1000, 2)} s` : `${fmt.n(v, v < 100 ? 1 : 0)} ms`);
const val = (m, r) => { try { return m.get(r) ?? null; } catch { return null; } };
const CAVEAT = ' Each build ran once, on different mainnet hours, so small changes can be noise.';

const STYLE = `
  .rd { display: grid; gap: 0 16px; align-items: center }
  .rd .hd { padding: 0 0 10px; border-bottom: 1px solid var(--line); align-self: end }
  .rd .grp { grid-column: 1 / -1; display: flex; align-items: baseline; gap: 12px; padding: 16px 0 6px }
  .rd .run { display: contents }
  .rd .run > div { padding: 8px 0; border-bottom: 1px solid rgba(226,230,226,.05) }
  .rd .run.dim > div:not(.lab), .rd .run.dim .lab > :not(.out) { opacity: .5 }
  .rd .run:hover > div, .rd .run:hover .lab > * { opacity: 1 }
  .rd .out { color: ${COL.red}; border-color: rgba(240,80,74,.6); background: rgba(240,80,74,.1); cursor: help }
  .rd .lab { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding-left: 10px !important; border-left: 2px solid transparent }
  .rd .v { display: flex; align-items: baseline; gap: 8px; font-size: 13px; margin-bottom: 5px; white-space: nowrap }
  .rd .d { font-size: 11px }
  .rd .bar { position: relative; height: 6px; border-radius: 3px; background: rgba(226,230,226,.07) }
  .rd .bar .f { height: 100%; border-radius: 3px }
  .rd .bar i { position: absolute; top: -3px; bottom: -3px; border-left: 1.5px dashed var(--ink2) }
  .rd .stg { display: flex; height: 20px; border-radius: 3px; overflow: hidden }
  .rd .stg > span { flex: none; height: 100%; border-right: 2px solid var(--bg); overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
    font-size: 9.5px; line-height: 20px; padding: 0 5px; color: var(--bg); font-weight: 600; cursor: help }
  .rd .axis { display: flex; justify-content: space-between; font-size: 10px; color: var(--muted) }
`;

// Change from the previous run: points for a share, relative otherwise; coloured only where better/worse is clear.
function delta(m, v, pv, prev) {
  if (pv == null) return null;
  const tip = `vs ${prev.round.label}${prev.tag ? ` ${prev.tag}` : ''} (${m.show(pv)})`;
  if (v === pv) return hover(h('span', { class: 'd muted' }, '='), tip);
  const better = m.better === 'up' ? v > pv : m.better === 'down' ? v < pv : null;
  const pts = Math.abs(v - pv) * 100;
  const text = m.share ? `${v >= pv ? '+' : '−'}${fmt.n(pts, pts < 1 ? 1 : 0)} pts` : fmt.pct(pv, v);
  return hover(h('span', { class: 'd', style: `color:${better == null ? COL.ink2 : better ? COL.green : COL.red}` }, text), tip);
}
// Group header + one row per run, for every client in publication order. `head(mine)` may add cells to the
// group header row (e.g. that client's time axis); without it the header spans the row.
function rows(ctx, cells, head) {
  const shown = new Set(ctx.res.clients.map((c) => c.run));
  const ids = [...new Set(ctx.runs.map((r) => r.id))];
  return ids.flatMap((id) => {
    const mine = ctx.runs.filter((r) => r.id === id);
    const where = [...new Set(mine.map((r) => r.round.label.toLowerCase()))];
    const name = h('div', { class: 'grp', style: head ? 'grid-column:auto' : '' }, who({ ...mine[0], badge: null }, 20),
      h('span', { class: 'muted', style: 'font-size:11px' },
        `${mine.length} run${mine.length > 1 ? 's' : ''} · ${where.length === ctx.rounds.length ? 'every round' : `${new Intl.ListFormat('en').format(where)} only`}`));
    return [name, ...(head ? head(mine) : []), ...mine.map((r, i) => {
      const prev = mine.slice(0, i).reverse().find((p) => p.pair.anchor_block === r.pair.anchor_block);
      const b = r.builds[0];
      const lab = h('div', { class: 'lab', style: shown.has(r.run) ? `border-left-color:${CLIENT[id]}` : '' },
        h('a', { class: 'chip', href: `#${r.round.id}`, title: `Show ${r.round.label}` }, `${r.round.label} · ${fmt.day(r.round.date)}`),
        hover(h('a', { class: 'chip', href: `https://github.com/${b.repo}/commit/${b.commit}`, target: '_blank', rel: 'noopener' },
          r.tag ? `${r.tag} · ${b.commit.slice(0, 7)}` : b.commit.slice(0, 7)), `${b.repo}@${b.commit}${r.note ? `<br>${r.note}` : ''}`),
        r.latest === false && hover(h('span', { class: 'chip out' }, 'not in Latest'),
          r.note ?? 'Kept for comparison; not shown as this client\u2019s current run.'));
      return h('div', { class: `run${shown.has(r.run) ? '' : ' dim'}` }, lab, ...cells(r, prev));
    })];
  });
}

// A table of metrics: value, ± vs previous run, and a bar scaled within the column (tick = the client's normal value).
function table(ctx, metrics) {
  const maxOf = metrics.map((m) => m.max ?? Math.max(...ctx.runs.flatMap((r) => [val(m, r), m.ref?.(r)]).filter((v) => v != null)));
  const head = [h('div', { class: 'hd' }), ...metrics.map((m) => hover(h('div', { class: 'hd lbl', style: 'cursor:help' },
    m.label, m.unit && h('span', { style: 'text-transform:none;letter-spacing:0' }, ` · ${m.unit}`)), m.def))];
  const body = rows(ctx, (r, prev) => metrics.map((m, k) => {
    const v = val(m, r), pv = prev && val(m, prev), col = CLIENT[r.id];
    if (v == null) return h('div', {}, h('div', { class: 'v muted' }, '—'));
    const ref = m.ref?.(r);
    return h('div', {},
      h('div', { class: 'v' }, num(m.show(v), ctx.src(m.src ? m.src(r) : r.imports[0].src)), delta(m, v, pv, prev)),
      m.bar !== false && h('div', { class: 'bar' },
        h('div', { class: 'f', style: `background:${col};width:${Math.max(1, (v / maxOf[k]) * 100)}%` }),
        ref != null && h('i', { style: `left:${(ref / maxOf[k]) * 100}%` })));
  }));
  return h('div', { style: 'overflow-x:auto' },
    h('div', { class: 'rd', style: `grid-template-columns:minmax(210px,250px) repeat(${metrics.length},minmax(0,1fr));min-width:${300 + metrics.length * 120}px` }, head, body));
}

// Import, replayed → each client's imports on that client's own time axis (so builds compare at a glance), then the
// total time and the worst lag behind the chain head.
function stages(ctx) {
  const head = [h('div', { class: 'hd' }), h('div', { class: 'hd lbl' }, 'phases'),
    hover(h('div', { class: 'hd lbl', style: 'cursor:help' }, 'import time'), 'From the restart with the import flags to the client\u2019s own \u201cdone\u201d line.'),
    hover(h('div', { class: 'hd lbl', style: 'cursor:help' }, 'max lag'), 'Worst distance behind the chain head during the import.')];
  const span = (mine) => Math.ceil(Math.max(...mine.map((r) => r.imports[0].duration_s)) / 1800) * 1800; // to the next 30 min
  const axisOf = new Map();
  const groupAxis = (mine) => {
    const a = span(mine), step = a > 3 * 3600 ? 3600 : 1800;
    axisOf.set(mine[0].id, a);
    return [h('div', { class: 'axis', style: 'align-self:end;padding-bottom:4px' },
      Array.from({ length: a / step + 1 }, (_, i) => h('span', {}, fmt.hm(i * step).replace(/ 00m$/, '')))), h('div', {}), h('div', {})];
  };
  const tMetric = { show: fmt.dur, better: 'down' };
  const body = rows(ctx, (r, prev) => {
    const w = r.imports[0], col = CLIENT[r.id], axis = axisOf.get(r.id);
    const before = new Map((prev?.imports[0].stages ?? []).map((s) => [s.label, s.end - s.start]));
    const bar = h('div', { class: 'stg', style: `width:${(w.duration_s / axis) * 100}%` }, w.stages.map((s, i) => {
      const d = s.end - s.start, pd = before.get(s.label);
      return hover(h('span', { style: `width:${(d / w.duration_s) * 100}%;background:${col};opacity:${i % 2 ? 0.72 : 1}` }, s.label),
        `<b>${s.label}</b><br>${fmt.dur(d)}${pd ? ` · ${fmt.pct(pd, d)} vs ${prev.round.label}${prev.tag ? ` ${prev.tag}` : ''}` : ''}`);
    }));
    const lag = w.follow?.head_lag_max_blocks;
    return [h('div', {}, bar),
      h('div', { class: 'v' }, num(fmt.hm(w.duration_s), ctx.src(w.src)), delta(tMetric, w.duration_s, prev?.imports[0].duration_s, prev),
        w.root_verified && hover(h('span', { style: 'color:var(--green);font-size:11px' }, '✓'), 'the client\u2019s own log reports the expected PBT root')),
      h('div', { class: 'v' }, lag == null ? '—' : num(`${fmt.n(lag)} block${lag === 1 ? '' : 's'}`, ctx.src(w.src)))];
  }, groupAxis);
  return h('div', { style: 'overflow-x:auto' },
    h('div', { class: 'rd', style: 'grid-template-columns:minmax(210px,250px) minmax(0,1fr) 120px 90px;min-width:860px' }, head, body));
}

const F = (r) => r.imports[0].follow, B = (r) => r.baseline.follow;
export const DIFFS = {
  race: {
    explain: 'Every published import, oldest first, each client\u2019s on its own time axis so its builds line up: the bar is the import\u2019s phases (hover one for its time and change), then the total time and the worst lag behind the chain head.',
    render: stages,
  },
  kept: {
    explain: 'Block processing during every published import, oldest first. The dashed tick is the client\u2019s normal value, from its baseline.',
    render: (ctx) => table(ctx, [
      { label: 'newPayload p50', unit: 'ms', better: 'down', show: ms, get: (r) => F(r).newpayload_ms.p50, ref: (r) => B(r).newpayload_ms.p50,
        def: 'Half the blocks validated during the import took at most this long.' },
      { label: 'p95', unit: 'ms', better: 'down', show: ms, get: (r) => F(r).newpayload_ms.p95, ref: (r) => B(r).newpayload_ms.p95,
        def: '95 % of the blocks took at most this long.' },
      { label: 'p99', unit: 'ms', better: 'down', show: ms, get: (r) => F(r).newpayload_ms.p99, ref: (r) => B(r).newpayload_ms.p99,
        def: '99 % of the blocks took at most this long.' },
      { label: 'throughput', unit: '% of normal', better: 'up', share: true, max: 1, show: (v) => `${fmt.n(v * 100, 0)} %`,
        get: (r) => F(r).mgas_per_s / B(r).mgas_per_s, ref: () => 1,
        def: 'Gas processed per second while importing, as a share of the same client\u2019s normal rate (its 4-hour baseline).' },
      { label: 'head coverage', better: 'up', share: true, bar: false, show: (v) => `${fmt.n(v * 100, 1)} %`, get: (r) => F(r).head_coverage,
        def: 'Share of the window\u2019s slots with a validated block; mainnet misses about 1 % of slots.' },
      { label: 'max lag', unit: 'blocks', better: 'down', bar: false, show: (v) => fmt.n(v), get: (r) => F(r).head_lag_max_blocks,
        def: 'Worst distance behind the chain head during the import.' },
    ]),
  },
  cost: {
    explain: 'What every published import consumed, oldest first, for the whole node (block processing included).',
    render: (ctx) => table(ctx, [
      { label: 'avg cores', unit: `of ${ctx.res.rig.cores_measured}`, better: null, max: ctx.res.rig.cores_measured, show: (v) => fmt.n(v, 2),
        get: (r) => r.imports[0].res.avg_cores, def: 'CPU time divided by the import\u2019s duration: how busy the node kept its cores.' },
      { label: 'CPU time', unit: 'CPU-s', better: 'down', show: (v) => fmt.n(v), get: (r) => r.imports[0].res.cpu_s,
        def: 'Total CPU seconds the node used during the import.' },
      { label: 'memory peak', unit: 'GB', better: 'down', show: (v) => fmt.n(v, 1), get: (r) => r.imports[0].res.anon_peak_gb,
        def: 'The execution client\u2019s largest process memory during the import (page cache not counted).' },
      { label: 'page cache peak', unit: 'GB', better: null, show: (v) => fmt.n(v, 1), get: (r) => r.imports[0].res.page_cache_peak_gb,
        def: 'File data the kernel kept in memory for the client; it grows into whatever the limit leaves free.' },
      { label: 'disk read', unit: 'GB', better: 'down', show: (v) => fmt.n(v), get: (r) => r.imports[0].res.test_disk_read_gb,
        def: 'Bytes read from the test disk during the import.' },
      { label: 'disk written', unit: 'GB', better: 'down', show: (v) => fmt.n(v), get: (r) => r.imports[0].res.test_disk_write_gb,
        def: 'Bytes written to the test disk during the import.' },
    ]),
  },
  disk: {
    explain: 'What the tree took on disk in every published import, oldest first. Each client stores it in its own layout.',
    render: (ctx) => table(ctx, [
      { label: 'PBT on disk', unit: 'GiB', better: 'down', show: (v) => fmt.n(v, 1), get: (r) => r.sizes.pbt_gib, src: (r) => r.sizes.src[1],
        def: 'What the tree added to the database (geth: the database\u2019s whole growth, attributed to the tree).' },
      { label: 'peak extra disk', unit: 'GiB', better: 'down', show: (v) => fmt.n(v, 1), get: (r) => r.imports[0].disk_peak_gib,
        def: 'How much fuller the test disk got at its peak during the import, temporary files included.' },
      { label: 'bytes per leaf', unit: 'B', better: 'down', show: (v) => fmt.n(v, 1), get: (r) => (r.sizes.pbt_gib * 2 ** 30) / r.pair.leaves,
        src: (r) => r.sizes.src[1], def: 'PBT on disk divided by the tree\u2019s leaves.' },
    ]),
  },
};

// Adds a [view | Compare rounds] switch to a section's title row; the diff is built on first use.
export function addSwitch(id, root, ctx) {
  const spec = DIFFS[id], headBlock = root.querySelector('.sec-head')?.parentElement;
  if (!spec || !headBlock) return;
  const head = headBlock.querySelector('.sec-head'), explain = headBlock.querySelector('.explain');
  const legend = [...head.children].slice(1); // chips explaining the animated view, not the diff
  const normal = h('div', {}), alt = h('div', { hidden: true });
  [...root.children].filter((el) => el !== headBlock && el.tagName !== 'STYLE').forEach((el) => normal.append(el));
  root.append(normal, alt);
  const a = h('button', { class: 'pill on', type: 'button' }, ctx.res.round.label);
  const b = h('button', { class: 'pill', type: 'button' }, 'Compare rounds');
  const set = (diff) => {
    if (diff && !alt.childElementCount) alt.append(h('style', {}, STYLE), h('p', { class: 'explain' }, spec.explain + CAVEAT), spec.render(ctx));
    if (diff) ctx.clock.pause(); // the diff is static; stop the replay behind it
    normal.hidden = diff; alt.hidden = !diff; if (explain) explain.hidden = diff;
    legend.forEach((el) => { el.hidden = diff; });
    a.classList.toggle('on', !diff); b.classList.toggle('on', diff);
    a.setAttribute('aria-pressed', String(!diff)); b.setAttribute('aria-pressed', String(diff));
  };
  a.onclick = () => set(false); b.onclick = () => set(true);
  head.append(h('span', { class: 'grow' }),
    h('div', { class: 'row', role: 'group', 'aria-label': 'Section view', style: 'gap:6px;align-self:center' }, a, b));
  set(false);
}
