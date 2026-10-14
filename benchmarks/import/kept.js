// "Still validating?" — did each node keep validating blocks during its import?
import { COL, DATA, REDUCED, countUp, fmt, h, hover, logScale, num, onVisible, s, scale, tip } from '../bench.js';

const W = 1120, AX = { fill: COL.muted, 'font-size': 10 };
const ms = (v) => (v >= 1000 ? `${fmt.n(v / 1000, 2)} s` : `${fmt.n(v, v < 100 ? 1 : 0)} ms`);
const pctColor = (from, to, higherIsBetter) => ((to > from) === higherIsBetter ? COL.green : COL.red);
// SVG number with provenance (num() is HTML-only).
const snum = (text, src, attrs = {}) =>
  hover(s('a', { href: src, target: '_blank' }, s('text', attrs, text)), `<span class="lbl">source</span><br><b>${src.replace(DATA, '')}</b> ↗`);

export default async function (root, ctx) {
  root.append(h('div', { class: 'sec-head' },
    h('h2', { class: 'h2' }, 'Still validating?'),
    h('span', { class: 'cap' }, 'Every dot is a block the node validated during the import, over its own baseline.')));

  const cs = ctx.res.clients.filter((c) => c.imports[0].files.newpayload);
  const rows = await Promise.all(cs.map((c) => ctx.csv(c.imports[0].files.newpayload)));
  cs.forEach((c, i) => root.append(panel(c, rows[i], ctx)));
  root.append(dumbbell(ctx));
}

function panel(c, rows, ctx) {
  const imp = c.imports[0], base = c.baseline.follow, f = imp.follow, col = ctx.color(c.id);
  const bms = base.newpayload_ms, fms = f.newpayload_ms;
  const H = 300, L = 54, R = W - 96, T = 24, B = H - 28;
  const x = scale(0, imp.duration_s, L, R), y = logScale(5, 5000, B, T);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, style: 'width:100%;display:block;cursor:crosshair', role: 'img',
    'aria-label': `${c.name}: newPayload time per block during the import` });

  // Stage bands.
  imp.stages.forEach((st, i) => {
    const x0 = x(st.start - imp.start), x1 = x(st.end - imp.start);
    svg.append(s('rect', { x: x0, y: T, width: x1 - x0, height: B - T, fill: i % 2 ? 'rgba(226,230,226,.025)' : 'rgba(226,230,226,.06)' }),
      s('text', { x: x0 + 6, y: T - 8, ...AX, 'font-size': 9, text: st.label }));
  });
  // Gridlines + axes.
  for (const v of [10, 100, 1000]) {
    svg.append(s('line', { x1: L, x2: R, y1: y(v), y2: y(v), stroke: COL.line }),
      s('text', { x: L - 8, y: y(v) + 3, 'text-anchor': 'end', ...AX, text: v >= 1000 ? '1 s' : `${v} ms` }));
  }
  const step = imp.duration_s > 3 * 3600 ? 3600 : 1800;
  for (let t = 0; t <= imp.duration_s; t += step) {
    svg.append(s('text', { x: x(t), y: H - 8, 'text-anchor': 'middle', ...AX, text: t ? `+${fmt.hm(t)}` : 'start' }));
  }
  // Baseline band p50–p95.
  const bsrc = ctx.src(c.baseline.src);
  svg.append(
    s('rect', { x: L, y: y(bms.p95), width: R - L, height: y(bms.p50) - y(bms.p95), fill: 'rgba(143,154,143,.13)' }),
    s('line', { x1: L, x2: R, y1: y(bms.p50), y2: y(bms.p50), stroke: COL.muted, 'stroke-dasharray': '4 4' }),
    s('text', { x: R + 6, y: y(bms.p50) + 10, ...AX, text: 'baseline p50' }),
    s('text', { x: R + 6, y: y(bms.p95) - 2, ...AX, text: 'p95' }),
  );
  // Dots.
  const pts = rows.filter((r) => r.t && r.newpayload_ms != null).map((r) => ({ r, cx: x(r.t - imp.start), cy: y(r.newpayload_ms) }));
  const g = s('g');
  for (const p of pts) {
    p.el = s('circle', { cx: p.cx, cy: p.cy, r: 1.8, fill: col,
      style: REDUCED ? '' : `opacity:0;transition:opacity .3s ease ${((p.cx - L) / (R - L)) * 1600}ms` });
    g.append(p.el);
  }
  svg.append(g);
  // Outliers > 1 s: value + thin leader, alternating sides so neighbours don't collide.
  const isrc = ctx.src(imp.src);
  pts.filter((p) => p.r.newpayload_ms > 1000).forEach((p, i) => {
    const dx = i % 2 ? 46 : -46, ly = T + 26 + (i % 2) * 14;
    svg.append(s('line', { x1: p.cx, y1: p.cy - 3, x2: p.cx + dx, y2: ly + 3, stroke: COL.muted, 'stroke-width': 0.6 }),
      snum(ms(p.r.newpayload_ms), isrc, { x: p.cx + dx, y: ly, 'text-anchor': i % 2 ? 'start' : 'end', fill: col, 'font-size': 11 }));
  });

  // Hover: nearest dot within 12 px.
  const ring = s('circle', { r: 5, fill: 'none', stroke: COL.ink, 'stroke-width': 1, style: 'display:none;pointer-events:none' });
  svg.append(ring);
  svg.addEventListener('pointermove', (e) => {
    const m = svg.getScreenCTM().inverse(), q = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
    let best = null, bd = 144 / m.a / m.a;
    for (const p of pts) { const d = (p.cx - q.x) ** 2 + (p.cy - q.y) ** 2; if (d < bd) { bd = d; best = p; } }
    if (!best) { ring.style.display = 'none'; return tip.hide(); }
    ring.setAttribute('cx', best.cx); ring.setAttribute('cy', best.cy); ring.style.display = '';
    tip.show(`<b>block ${best.r.block}</b><br>${ms(best.r.newpayload_ms)} · ${fmt.n(best.r.gas_used / 1e6, 1)} Mgas<br><span class="lbl">t+${fmt.dur(best.r.t - imp.start)}</span>`, e);
  });
  svg.addEventListener('pointerleave', () => { ring.style.display = 'none'; tip.hide(); });

  // Side stats.
  const counters = [];
  const big = (v, f0, src) => { const a = num(f0(v), src, { class: 'num big' }); counters.push([a, v, f0]); return a; };
  const pair = (label, b, i, f0, better) => h('div', {},
    h('div', { class: 'lbl' }, label),
    h('div', { style: 'display:flex;align-items:baseline;gap:6px;flex-wrap:wrap' },
      num(f0(b), bsrc, { class: 'num muted', style: 'font-family:VT323,monospace;font-size:22px' }),
      h('span', { class: 'muted' }, '→'), big(i, f0, isrc),
      better != null && num(fmt.pct(b, i), isrc, { class: 'num', style: `font-size:12px;color:${pctColor(b, i, better)}` })));
  const msN = (v) => fmt.n(v, v < 100 ? 1 : 0);
  const stats = h('div', { style: 'flex:1 1 210px;display:grid;gap:12px;align-content:start' },
    pair('newPayload p50 · ms', bms.p50, fms.p50, msN, false),
    pair('newPayload p99 · ms', bms.p99, fms.p99, msN, null),
    pair('throughput · MGas/s', base.mgas_per_s, f.mgas_per_s, (v) => fmt.n(v, 0), true),
    h('div', {}, h('div', { class: 'lbl' }, 'head coverage'), big(f.head_coverage * 100, (v) => `${fmt.n(v, 1)} %`, isrc)),
    f.head_lag_max_blocks <= 1
      ? hover(h('span', { class: 'chip', style: `border-color:${COL.green};color:${COL.green};justify-self:start` },
          '● never behind'), `max head lag during the import: <b>${fmt.n(f.head_lag_max_blocks)} block</b>`)
      : h('div', {}, h('div', { class: 'lbl' }, 'max head lag · blocks'), big(f.head_lag_max_blocks, (v) => fmt.n(v), isrc)),
  );

  const el = h('div', { class: 'panel reveal', style: `margin-bottom:14px;border-left:3px solid ${col}` },
    h('div', { style: 'display:flex;align-items:center;gap:10px;margin-bottom:6px' },
      h('span', { class: 'dot', style: `background:${col}` }), h('b', {}, c.name),
      h('span', { class: 'lbl' }, 'blocks validated during import'), num(fmt.n(pts.length), isrc, { class: 'num', style: `color:${col}` }),
      h('span', { class: 'lbl' }, `· import ${fmt.hm(imp.duration_s)}`)),
    h('div', { style: 'display:flex;gap:18px;flex-wrap:wrap' }, h('div', { style: 'flex:4 1 560px;min-width:0' }, svg), stats));
  onVisible(el, () => {
    for (const p of pts) p.el.style.opacity = 1;
    for (const [a, v, f0] of counters) countUp(a, v, f0);
  }, 0.2);
  return el;
}

function dumbbell(ctx) {
  const cs = ctx.res.clients.filter((c) => c.baseline.follow && c.imports[0].follow);
  const vals = cs.flatMap((c) => [c.baseline.follow.mgas_per_s, c.imports[0].follow.mgas_per_s]);
  const max = Math.ceil(Math.max(...vals) / 500) * 500;
  const RH = 46, T = 30, H = T + cs.length * RH + 24, L = 130, R = W - 40, x = scale(0, max, L, R);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, style: 'width:100%;display:block', role: 'img', 'aria-label': 'Throughput, baseline vs import, per client' });
  for (let v = 0; v <= max; v += 500) {
    svg.append(s('line', { x1: x(v), x2: x(v), y1: T - 10, y2: H - 22, stroke: COL.line }),
      s('text', { x: x(v), y: H - 8, 'text-anchor': 'middle', ...AX, text: fmt.n(v) }));
  }
  const moves = [];
  cs.forEach((c, i) => {
    const col = ctx.color(c.id), cy = T + i * RH + RH / 2, b = c.baseline.follow.mgas_per_s;
    const w = c.imports[0], to = w.follow.mgas_per_s;
    const x0 = x(b), x1 = x(to), dir = Math.sign(x1 - x0) || 1;
    svg.append(s('text', { x: L - 16, y: cy + 4, 'text-anchor': 'end', fill: col, 'font-size': 12, text: c.name }));
    const arrow = s('g', { style: REDUCED ? '' : 'opacity:0;transition:opacity .4s ease 1s' },
      s('line', { x1: x0 - dir * 8, x2: x1 + dir * 9, y1: cy, y2: cy, stroke: col, 'stroke-width': 1.5 }),
      s('path', { d: `M${x1 + dir * 8},${cy} l${-dir * 7},-4 v8 z`, fill: col }),
      snum(fmt.pct(b, to), ctx.src(w.src), { x: (x0 + x1) / 2, y: cy - 10, 'text-anchor': 'middle', 'font-size': 11, fill: pctColor(b, to, true) }));
    const dot = s('circle', { cx: x1, cy, r: 6, fill: col, stroke: col, 'stroke-width': 2,
      style: REDUCED ? '' : `transform:translateX(${x0 - x1}px);transition:transform 1.2s cubic-bezier(.2,.9,.25,1)` });
    svg.append(arrow,
      hover(s('circle', { cx: x0, cy, r: 6, fill: COL.bg, stroke: col, 'stroke-width': 1.5 }), `${c.name} baseline: <b>${fmt.n(b, 1)} MGas/s</b>`),
      hover(dot, `${c.name} during import: <b>${fmt.n(to, 1)} MGas/s</b>`),
      snum(fmt.n(b, 0), ctx.src(c.baseline.src), { x: x0, y: cy + 20, 'text-anchor': 'middle', ...AX }),
      snum(fmt.n(to, 0), ctx.src(w.src), { x: x1, y: cy + 20, 'text-anchor': 'middle', ...AX, fill: col }));
    moves.push([dot, arrow]);
  });
  const el = h('div', { class: 'panel reveal' },
    h('div', { style: 'display:flex;align-items:center;gap:8px' },
      h('span', { class: 'lbl' }, 'throughput · MGas/s · ○ baseline → ● during import'),
      hover(h('span', { class: 'muted', style: 'cursor:help' }, 'ⓘ'),
        'Each client ran in a different 4-hour stretch of mainnet: compare each client with its own baseline.')),
    svg);
  onVisible(el, () => { for (const [d, a] of moves) { d.style.transform = 'none'; a.style.opacity = 1; } });
  return el;
}
