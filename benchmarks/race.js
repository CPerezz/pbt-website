// Hero: every import replayed on one clock (t = seconds since each import's own start).
import { COL, DATA, avatar, controls, countUp, fmt, h, hover, logScale, num, onVisible, s, scale, scramble, secHead, term } from './bench.js';

const W = 1120, X0 = 160, X1 = 900, FX = 922; // label column | race track | finish column
const BIN = 300, SLOT = 12, GENESIS = 1606824023; // 5-min comb bins; mainnet beacon slots
const LANE = 25, LRH = 54, LBH = 36; // slot lens: cells per row, row height, bar area height
const ms = (v) => `${fmt.n(v, v < 100 ? 1 : 0)} ms`;
const bar = (px) => h('span', { style: `width:3px;height:${px}px;background:${COL.ink2};border-radius:1px` });
const swatch = (...kids) => h('span', { style: 'display:inline-flex;align-items:flex-end;gap:2px;height:11px' }, ...kids);
const median = (a) => { const v = [...a].sort((p, q) => p - q), m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
const source = (src) => `<span class="lbl">source</span><br><b>${src.replace(DATA, '')}</b> ↗`;

export default async function (root, ctx) {
  const { res, clock } = ctx;
  root.append(secHead('Import, replayed',
    ['In an EIP-8347 migration, a node imports a snapshot of the new tree, taken at the ', term('anchor', 'anchor block'),
      ` (#${fmt.n(res.pair.anchor_block)}), while it keeps processing new blocks. Here that import and its correctness checks replay on a live mainnet node (1 s = ${clock.speed / 60} min): `,
      'the long bar is the import\u2019s phases, the small bars above it count blocks validated every 5 min, the ✓ is the client\u2019s own root check, and under each name sits its worst lag behind the chain head.'],
    h('span', { class: 'cap row', style: 'gap:8px' },
      h('span', { class: 'chip' }, swatch(...[5, 9, 11, 7, 10].map(bar)), 'blocks per 5 min'),
      h('span', { class: 'chip' }, swatch(bar(11)), 'one block (height = ', term('newpayload', 'newPayload'), ' time)'))));
  root.append(h('div', { style: 'margin-bottom:18px' }, controls(clock)));

  // Lanes: each client's imports in order; any import after the first renders as a thinner ghost lane.
  const lanes = [];
  for (const c of res.clients) c.imports.forEach((w, i) => lanes.push({ c, w, ghost: i > 0, run1: c.imports[0] }));
  const csvs = await Promise.all(lanes.map((l) => (l.w.files.newpayload ? ctx.csv(l.w.files.newpayload) : null)));

  // Block data per lane: rows inside the import window, 5-min bins, slot → block.
  lanes.forEach((l, li) => {
    if (!csvs[li]) return;
    const { w } = l, d = w.duration_s;
    const rows = csvs[li].filter((r) => r.t != null && r.t >= w.start && r.t <= w.end).sort((a, b) => a.t - b.t);
    const bins = Array.from({ length: Math.ceil(d / BIN) }, (_, b) =>
      ({ a: b * BIN, b: Math.min(d, (b + 1) * BIN), slots: Math.max(1, Math.round((Math.min(d, (b + 1) * BIN) - b * BIN) / SLOT)), ms: [] }));
    for (const r of rows) bins[Math.min(bins.length - 1, Math.floor((r.t - w.start) / BIN))].ms.push(r.newpayload_ms);
    let cum = 0;
    for (const bn of bins) { bn.before = cum; cum += bn.ms.length; }
    l.data = { rows, bins, offs: rows.map((r) => r.t - w.start), bySlot: new Map(rows.map((r) => [Math.floor((r.t - GENESIS) / SLOT), r])) };
  });
  // Blocks received by t (binary search on sorted offsets).
  const count = (offs, t) => { let lo = 0, hi = offs.length; while (lo < hi) { const m = (lo + hi) >> 1; offs[m] <= t ? (lo = m + 1) : (hi = m); } return lo; };

  const hours = Math.ceil(clock.duration / 3600);
  const x = scale(0, hours * 3600, X0, X1);
  let y = 30;
  for (const l of lanes) { l.y = y; l.k = l.ghost ? 0.6 : 1; y += l.ghost ? 62 : 78; }
  const H = y;

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, style: 'width:100%;display:block;overflow:visible' });
  const clip = s('rect', { x: 0, y: 0, width: X0, height: H });
  svg.append(s('defs', null,
    s('clipPath', { id: 'race-done' }, clip),
    s('filter', { id: 'race-glow', x: '-200%', y: '-50%', width: '500%', height: '200%' },
      s('feGaussianBlur', { stdDeviation: 3, result: 'b' }), s('feMerge', null, s('feMergeNode', { in: 'b' }), s('feMergeNode', { in: 'SourceGraphic' })))));

  for (let i = 0; i <= hours; i++) {
    svg.append(s('line', { x1: x(i * 3600), x2: x(i * 3600), y1: 18, y2: H - 8, stroke: COL.line, 'stroke-dasharray': i ? '2 4' : null }),
      s('text', { x: x(i * 3600), y: 12, 'text-anchor': 'middle', 'font-size': 10, fill: COL.muted, text: `${i}h` }));
  }

  const wrap = h('div', { style: 'position:relative;container-type:inline-size' }, svg);
  const scroller = h('div', { style: 'min-width:760px' }, wrap);
  root.append(h('div', { style: 'overflow-x:auto' }, scroller));
  const at = (el, px, py) => { el.style.cssText += `;position:absolute;left:${(px / W) * 100}%;top:${(py / H) * 100}%`; wrap.append(el); return el; };
  const done = (el) => (el.setAttribute('clip-path', 'url(#race-done)'), el);

  lanes.forEach((l) => {
    const { c, w, k, data } = l, col = ctx.color(c.id), d = w.duration_s;
    const rh = 14 * k, by = l.y + rh + 4, bh = 16 * k, base = l.y + rh;
    const xe = x(d);

    // Label column: name + live block counter (or run 2 + change vs run 1).
    let counter;
    if (l.ghost) {
      const pct = s('a', { href: ctx.src(w.src), target: '_blank' },
        s('text', { x: 0, y: by + bh + 12, 'font-size': 10, fill: COL.muted, text: `${fmt.pct(l.run1.duration_s, d)} vs run 1` }));
      hover(pct, `<b>${fmt.dur(d)}</b> vs <b>${fmt.dur(l.run1.duration_s)}</b> (run 1)<br>${source(ctx.src(w.src))}`);
      svg.append(s('text', { x: 0, y: by + bh - 1, 'font-size': 12, 'font-weight': 600, fill: col, opacity: 0.7, text: 'run 2' }), pct);
    } else {
      svg.append(avatar(c.id, 24, { x: 0, y: by - 18 }), s('text', { x: 30, y: by + 2, 'font-size': 15, 'font-weight': 600, fill: col, text: c.name }));
      // Under the name: the run's badge (round · build) when the view needs it, then blocks so far and worst lag.
      const ln = (i) => by + 18 + (c.badge ? i : i - 1) * 14;
      if (c.badge) svg.append(hover(s('text', { x: 30, y: ln(0), 'font-size': 10, fill: COL.ink2, text: c.badge }),
        `${c.round.label} · ${fmt.day(c.round.date)}<br><b>${c.builds[0].repo}@${c.builds[0].commit}</b>${c.note ? `<br>${c.note}` : ''}`));
      if (data) {
        const src = ctx.src(w.files.newpayload);
        counter = s('text', { x: 30, y: ln(1), 'font-size': 10.5, fill: COL.muted });
        svg.append(hover(s('a', { href: src, target: '_blank' }, counter), source(src)));
      }
      if (w.follow) {
        const lag = w.follow.head_lag_max_blocks, src = ctx.src(w.src);
        svg.append(hover(s('a', { href: src, target: '_blank' },
          s('text', { x: 30, y: ln(2), 'font-size': 10.5, fill: COL.muted, text: `max lag ${fmt.n(lag)} block${lag === 1 ? '' : 's'}` })),
          `Worst distance behind the chain head during the import<br>${source(src)}`));
      }
    }

    const g = s('g', { opacity: l.ghost ? 0.6 : 1 });
    svg.append(g);

    // Ribbon: block comb (one bar per 5-min bin), or an empty row when no newPayload was recorded.
    const comb = [];
    let focus;
    if (data) {
      for (const bn of data.bins) {
        const bx = x(bn.a), bw = Math.max(1, x(bn.b) - bx - 2), full = (Math.min(1, bn.ms.length / bn.slots)) * rh;
        const solid = s('rect', { x: bx, y: base, width: bw, height: 0, fill: col });
        const hit = s('rect', { x: bx, y: l.y, width: bw, height: rh, fill: 'transparent', style: 'cursor:help' });
        hover(hit, `<span class="lbl">${c.name}</span><br><b>t+${fmt.hm(bn.a)} – t+${fmt.hm(bn.b)}</b> · ${bn.ms.length} / ${bn.slots} slots`
          + (bn.ms.length ? ` · median newPayload ${ms(median(bn.ms))}` : ''));
        g.append(s('rect', { x: bx, y: base - full, width: bw, height: full, fill: col, opacity: 0.12 }), solid, hit);
        comb.push({ bn, solid, h: 0 });
      }
      focus = s('rect', { y: l.y - 1.5, height: rh + 3, fill: 'none', stroke: COL.green, 'stroke-width': 1.2, rx: 1, 'pointer-events': 'none' });
      g.append(focus);
    } else {
      g.append(hover(s('rect', { x: X0, y: l.y, width: xe - X0, height: rh, fill: 'transparent', style: 'cursor:help' }), 'no newPayload recorded in this window'));
    }

    // Stage bar: outlined segments, solid copy clipped to the clock.
    for (const st of w.stages) {
      const a = st.start - w.start, b = st.end - w.start, sx = x(a), sw = Math.max(1, x(b) - sx - 1);
      const seg = s('g', { style: 'cursor:help' },
        s('rect', { x: sx, y: by, width: sw, height: bh, rx: 2, fill: col, 'fill-opacity': 0.08, stroke: col, 'stroke-opacity': 0.6 }),
        done(s('rect', { x: sx, y: by, width: sw, height: bh, rx: 2, fill: col })));
      hover(seg, `<span class="lbl">${c.name}${l.ghost ? ' · run 2' : ''}</span><br><b>${st.label}</b><br>${fmt.dur(b - a)} · starts t+${fmt.hm(a)}`);
      g.append(seg);
      if (!l.ghost && st.label.length * 6 + 6 < sw)
        g.append(s('text', { x: sx + sw / 2, y: by + bh + 13, 'text-anchor': 'middle', 'font-size': 9.5, fill: COL.muted, text: st.label }));
    }

    // The client's mark rides the front of its bar while the import runs.
    const hr = 11 * k, hy = by + bh / 2;
    const head = s('g', {}, s('circle', { cy: hy, r: hr, fill: COL.bg, stroke: col, 'stroke-width': 1.5, filter: 'url(#race-glow)' }),
      avatar(c.id, hr * 1.3, { x: -hr * 0.65, y: hy - hr * 0.65 }));
    const fin = s('line', { x1: xe, x2: xe, y1: l.y - 4, y2: by + bh + 4, stroke: col, 'stroke-width': 2 });
    g.append(fin, head);

    // Finish column (HTML so numbers are provenance links).
    const fy = l.ghost ? l.y - 6 : l.y - 4;
    const dur = num(fmt.dur(d), ctx.src(w.src), { class: 'num big', style: `color:${col};font-size:max(${l.ghost ? 14 : 18}px,${(l.ghost ? 22 : 34) / 11.2}cqw)` });
    const box = at(h('div', { style: 'display:flex;flex-direction:column;gap:3px;align-items:flex-start;visibility:hidden' }, dur), FX, fy);
    let chip;
    if (w.root_verified) {
      chip = h('a', { class: 'chip', href: ctx.src(w.stages_src), target: '_blank', rel: 'noopener',
        style: `color:${COL.green};border-color:rgba(51,255,51,.45);font-size:max(8px,${(l.ghost ? 9.5 : 11) / 11.2}cqw);padding:1px 6px` });
      hover(chip, `<span class="lbl">PBT root</span><br><b>${res.pair.pbt_root}</b><br>verified by the client's own log<br>${source(ctx.src(w.stages_src))}`);
      box.append(chip);
    }

    let shown = false, first = true, lastN = -1, lastBin = -1;
    l.update = (t) => {
      const fx = x(Math.min(t, d));
      head.setAttribute('transform', `translate(${fx} 0)`);
      head.style.display = t < d ? '' : 'none';
      const isDone = t >= d;
      fin.style.display = isDone ? '' : 'none';

      if (data) {
        const n = count(data.offs, t);
        if (n !== lastN) { lastN = n; if (counter) counter.textContent = `${fmt.n(n)} blocks`; }
        for (const cb of comb) {
          const got = t >= cb.bn.b ? cb.bn.ms.length : t < cb.bn.a ? 0 : n - cb.bn.before;
          const hh = Math.min(1, got / cb.bn.slots) * rh;
          if (hh !== cb.h) { cb.h = hh; cb.solid.setAttribute('y', base - hh); cb.solid.setAttribute('height', hh); }
        }
        const b = isDone ? -1 : Math.floor(t / BIN);
        if (b !== lastBin) {
          lastBin = b;
          focus.style.display = b < 0 ? 'none' : '';
          if (b >= 0) { focus.setAttribute('x', x(b * BIN) - 1.5); focus.setAttribute('width', comb[b].solid.getAttribute('width') - -3); }
        }
      }

      if (isDone === shown) return;
      shown = isDone;
      box.style.visibility = isDone ? 'visible' : 'hidden';
      if (!isDone) return;
      if (first) countUp(dur, d, fmt.dur);
      if (chip) scramble(chip, `${fmt.short(res.pair.pbt_root)} ✓`, 900);
      first = false;
    };
  });

  const cursor = s('line', { y1: 18, y2: H - 8, stroke: COL.green, 'stroke-width': 1.2, 'stroke-dasharray': '4 3', opacity: 0.9 });
  svg.append(cursor);

  // Slot lens: the 25 beacon slots of the comb bin under the cursor, one cell per slot.
  const lensLanes = lanes.filter((l) => l.data);
  const LH = lensLanes.length * LRH + 6;
  const lens = s('svg', { viewBox: `0 0 ${W} ${LH}`, style: 'width:100%;display:block;overflow:visible' });
  const cw = (X1 - X0) / LANE, ly = logScale(5, 5000, 0, LBH);
  scroller.append(h('div', { class: 'lbl', style: `margin:22px 0 8px;padding-left:${(X0 / W) * 100}%` },
    'zoom · the 5 minutes at the cursor · one cell per 12 s slot'), lens);
  lensLanes.forEach((l, i) => {
    const { c, w, data } = l, col = ctx.color(c.id), d = w.duration_s, top = i * LRH + 4, base = top + LBH;
    lens.append(avatar(c.id, 18, { x: 0, y: top + LBH / 2 - 9 }), s('text', { x: 24, y: top + LBH / 2 + 5, 'font-size': 13, 'font-weight': 600, fill: col, text: c.name }),
      ...(c.badge ? [s('text', { x: 24, y: top + LBH / 2 + 19, 'font-size': 9.5, fill: COL.muted, text: c.badge })] : []),
      s('line', { x1: X0, x2: X1, y1: base - ly(1000), y2: base - ly(1000), stroke: COL.line, 'stroke-dasharray': '2 4' }),
      s('text', { x: X1 + 4, y: base - ly(1000) + 3, 'font-size': 9, fill: COL.muted, text: '1 s' }));
    const range = s('text', { x: FX, y: top + LBH / 2 + 4, 'font-size': 10.5, fill: COL.muted });
    lens.append(range);
    const cells = Array.from({ length: LANE }, (_, j) => {
      const cx = X0 + j * cw + 3, bw = cw - 6;
      const cell = { key: '', slot: 0, r: null, st: 'p' };
      cell.box = s('rect', { x: cx, y: top, width: bw, height: LBH, rx: 1.5, fill: 'transparent', stroke: col, style: 'cursor:help' });
      cell.bar = s('rect', { x: cx, width: bw, rx: 1.5, fill: col, 'pointer-events': 'none' });
      hover(cell.box, () => cell.st === 'b'
        ? `<span class="lbl">${c.name} · slot ${fmt.n(cell.slot)}</span><br><b>block ${cell.r.block}</b><br>newPayload <b>${ms(cell.r.newpayload_ms)}</b><br>gas used ${fmt.n(cell.r.gas_used)}`
        : `<span class="lbl">${c.name}</span><br>slot ${fmt.n(cell.slot)} · ${cell.st === 'm' ? 'no block received (missed slot)' : 'not reached yet'}`);
      lens.append(cell.box, cell.bar);
      return cell;
    });
    let lastB = -1;
    l.lens = (t) => {
      const b = Math.floor(Math.min(t, d - 1) / BIN);
      const s0 = Math.floor((w.start + b * BIN - GENESIS) / SLOT);
      if (b !== lastB) { lastB = b; range.textContent = `t+${fmt.hm(b * BIN)} – t+${fmt.hm(Math.min(d, (b + 1) * BIN))}`; }
      for (let j = 0; j < LANE; j++) {
        const cell = cells[j], slot = s0 + j, r = data.bySlot.get(slot);
        const st = r && r.t - w.start <= t ? 'b' : GENESIS + (slot + 1) * SLOT - w.start <= t ? 'm' : 'p';
        const key = st + slot;
        if (key === cell.key) continue;
        Object.assign(cell, { key, slot, st, r: st === 'b' ? r : null });
        const hh = st === 'b' ? Math.max(2, Math.min(LBH, ly(r.newpayload_ms))) : 0;
        cell.bar.setAttribute('y', base - hh); cell.bar.setAttribute('height', hh);
        cell.box.setAttribute('stroke-opacity', st === 'b' ? 0.25 : st === 'm' ? 0.6 : 0.15);
        cell.box.setAttribute('stroke-dasharray', st === 'm' ? '3 3' : 'none');
      }
    };
  });

  clock.on((t) => {
    const cx = x(t);
    clip.setAttribute('width', cx);
    cursor.setAttribute('x1', cx); cursor.setAttribute('x2', cx);
    for (const l of lanes) { l.update(t); if (l.lens) l.lens(t); }
  });
  onVisible(root, () => clock.play(), 0.35);
}
