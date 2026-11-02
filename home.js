// Home page: live-data mini race inside the "Mainnet benchmarks" card, and the nine lanes of pbt-devnet-1 inside the
// "Devnets" card. Each card is one link, so nothing in here is a link of its own (provenance links live on the pages).
import { CLIENT, COL, DATA, fmt, getJSON, h, onVisible, reveal, s, scale, who } from './benchmarks/bench.js';

// "Design notes" card: the 256 sub-indices of an account header stem; mint = storage slots 0–63.
const stem = document.getElementById('stem-mini');
if (stem) for (let i = 0; i < 256; i++)
  stem.append(h('i', { class: i === 0 ? 'b' : i === 1 ? 'c' : i === 2 ? 'd' : i >= 64 && i < 128 ? 's' : null }));

const root = document.getElementById('race');
if (root) {
  try {
    const { rounds } = await getJSON(`${DATA}import/rounds.json`);
    const round = rounds.at(-1);
    const base = `${DATA}import/${round.id}/`;
    const res = await getJSON(`${base}results.json`);
    const max = Math.max(...res.clients.map((c) => c.imports[0].duration_s));
    const pct = scale(0, max, 6, 100);

    const bars = res.clients.map((c) => {
      const w = c.imports[0], col = CLIENT[c.id];
      const fill = h('div', { class: 'fill', style: `background:${col};box-shadow:0 0 10px ${col}` });
      onVisible(fill, () => { fill.style.width = `${pct(w.duration_s)}%`; });
      return h('div', { style: 'display:flex;flex-direction:column;gap:5px' },
        h('div', { class: 'row', style: 'justify-content:space-between;align-items:center' },
          who(c, 20), h('span', { style: `color:${col};font-weight:600;font-size:13px` }, fmt.dur(w.duration_s))),
        h('div', { class: 'track' }, fill));
    });

    const allVerified = res.clients.every((c) => c.imports[0].root_verified);
    const rootLine = h('div', { class: 'row', style: 'gap:6px;align-items:center;font-size:11px;color:#8F9A8F' },
      allVerified ? h('span', { style: 'color:#33FF33' }, '✓') : h('span', { style: 'color:#F0504A' }, '✗'),
      h('span', { title: res.pair.pbt_root }, 'same PBT root, verified by every client'));

    root.append(
      h('div', { class: 'row', style: 'justify-content:space-between;align-items:baseline;margin-bottom:16px' },
        h('span', { class: 'lbl' }, 'EIP-8347 import · mainnet'), h('span', { class: 'chip' }, `${round.label} · ${round.date}`)),
      h('div', { style: 'display:flex;flex-direction:column;gap:14px;margin-bottom:14px' }, ...bars),
      rootLine,
    );
  } catch (e) {
    console.error('race tile:', e);
    root.append(h('div', { class: 'cap' }, 'Could not load live benchmark data.'));
  }
}

// Devnets card: one thin lane per node — build (solid), replay (hatched), two trees (line), the fork, one tree (green).
const dev = document.getElementById('devnet');
if (dev) {
  try {
    const tl = await getJSON(new URL('uploads/devnets/pbt-devnet-1/timeline.json', import.meta.url).href);
    const W = 320, X0 = 78, X1 = 318, RH = 19, TOP = 6, H = TOP + RH * tl.lanes.length + 4;
    const xs = scale(tl.t0, tl.t1, X0, X1);
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, style: 'width:100%;display:block;overflow:visible', 'aria-hidden': 'true' });
    svg.append(s('defs', null, s('pattern', { id: 'home-hatch', width: 4, height: 4, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
      s('rect', { width: 4, height: 4, fill: COL.ink2, opacity: 0.25 }), s('rect', { width: 1.5, height: 4, fill: COL.ink2, opacity: 0.9 }))));
    svg.append(s('line', { x1: xs(tl.fork_t), x2: xs(tl.fork_t), y1: 0, y2: H, stroke: COL.red, 'stroke-dasharray': '3 2', 'stroke-width': 1 }));
    tl.lanes.forEach((l, i) => {
      const y = TOP + i * RH + RH / 2, col = CLIENT[l.client];
      svg.append(s('text', { x: 0, y: y + 3.5, 'font-size': 9.5, 'font-weight': 600, fill: col, text: l.host }));
      svg.append(s('line', { x1: X0, x2: X1, y1: y, y2: y, stroke: COL.line }));
      for (const r of l.runs.filter((r) => r.status === 'valid')) {
        const b = r.complete ?? r.synced, c = r.synced ?? b;
        svg.append(s('rect', { x: xs(r.start), y: y - 5, width: Math.max(xs(b) - xs(r.start), 1.5), height: 10, fill: col, rx: 1 }));
        svg.append(s('rect', { x: xs(b), y: y - 3.5, width: Math.max(xs(c) - xs(b), 1), height: 7, fill: 'url(#home-hatch)' }));
        svg.append(s('rect', { x: xs(c), y: y - 1, width: Math.max(xs(tl.fork_t) - xs(c), 0), height: 2, fill: col, opacity: 0.55 }));
      }
      if (l.dual_from) svg.append(s('rect', { x: xs(l.dual_from), y: y - 1, width: xs(tl.fork_t) - xs(l.dual_from), height: 2, fill: col, opacity: 0.55 }));
      svg.append(s('rect', { x: xs(tl.fork_t), y: y - 1, width: xs(tl.t1) - xs(tl.fork_t), height: 2, fill: COL.green, opacity: 0.8 }));
      for (const e of l.events ?? []) svg.append(s('circle', { cx: xs(e.t), cy: y - 7, r: 1.6, fill: COL.red }));
    });
    dev.append(
      h('div', { class: 'row', style: 'justify-content:space-between;align-items:baseline;margin-bottom:12px' },
        h('span', { class: 'lbl' }, 'EIP-8347 live migration · nine nodes'), h('span', { class: 'chip' }, '2026-10-22 → 10-30')),
      svg,
      h('div', { class: 'row', style: 'gap:6px;align-items:center;font-size:11px;color:#8F9A8F;margin-top:12px' },
        h('span', { style: 'color:#33FF33' }, '✓'), h('span', {}, 'one root at the fork, 0 divergences in 34,391 comparisons')),
    );
  } catch (e) {
    console.error('devnet tile:', e);
    dev.append(h('div', { class: 'cap' }, 'Could not load devnet data.'));
  }
}

reveal();
