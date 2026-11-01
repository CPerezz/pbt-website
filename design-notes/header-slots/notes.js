// The first 64 slots: fills every [data-n] number and draws the figures of this topic's notes from data/summary.json.
// Each number links to the raw query output it comes from (the site's provenance rule).
import { h, s, COL, scale, fmt, getJSON, hover, reveal } from '../../benchmarks/bench.js';

const DATA = new URL('data/', import.meta.url).href;
const S = await getJSON(`${DATA}summary.json`);

const get = (path) => path.split('.').reduce((o, k) => o?.[k], S);
const pct = (v, d = 1) => `${fmt.n(v * 100, d)}\u00a0%`;
const F = {
  pct: (v) => pct(v), pct0: (v) => pct(v, 0), pct2: (v) => pct(v, 2), n: (v) => fmt.n(v), n1: (v) => fmt.n(v, 1),
  n2: (v) => fmt.n(v, 2), kb: (v) => `${fmt.n(v, 1)}\u00a0KB`, b: (v) => `${fmt.n(v)}\u00a0B`, s: (v) => String(v),
  sn2: (v) => `${v >= 0 ? '+' : '−'}${fmt.n(Math.abs(v), 2)}`, m: (v) => `${fmt.n(v / 1e6, 1)}\u00a0M`,
  gb: (v) => `${fmt.n(v, 2)}\u00a0GB`,
};
const UNIT = { kb: [(v) => fmt.n(v, 1), '\u00a0KB'], b: [(v) => fmt.n(v), '\u00a0B'] };
const fmtv = (f, v) => !Array.isArray(v) ? F[f](v)
  : UNIT[f] ? v.map(UNIT[f][0]).join('–') + UNIT[f][1]
  : v.map((x) => F[f](x)).join(v.length > 2 ? ' · ' : '–');
const compact = (v) => v >= 1e6 ? `${fmt.n(v / 1e6, 1)}\u00a0M` : v >= 1e3 ? `${fmt.n(v / 1e3, 0)}\u00a0k` : fmt.n(v, 0);
// A published number links to its source file; hover shows the raw file(s) and queries.
function link(text, src) {
  if (!src?.length) return h('span', {}, text);
  const a = h('a', { class: 'num', href: `${DATA}${src[0]}`, target: '_blank', rel: 'noopener' }, text);
  return hover(a, `<span class="lbl">source</span><br>${src.map((x) => `<b>data/${x}</b>`).join('<br>')}`);
}

// Numbers inside the index stay plain text: its rows are links themselves, and every number links again in its note.
for (const el of document.querySelectorAll('[data-n]')) {
  const node = get(el.dataset.n);
  if (!node) { el.textContent = '?'; console.warn('missing', el.dataset.n); continue; }
  const text = fmtv(el.dataset.f || 'n', node.v);
  el.replaceChildren(el.closest('.toc') ? text : link(text, node.src));
}

// Interactive index: hovering or focusing a note shows its kind, verdict and TL;DR in the side panel.
const KIND = { 'k-claim': 'claim', 'k-question': 'question', 'k-proposal': 'proposal' };
const preview = document.getElementById('toc-preview');
for (const item of document.querySelectorAll('.toc-item')) {
  const show = () => {
    document.querySelector('.toc-item.on')?.classList.remove('on');
    item.classList.add('on');
    const k = [...item.classList].find((c) => c in KIND);
    preview.replaceChildren(
      h('div', { class: 'pv-head' }, h('span', { class: `kind ${k}` }, KIND[k]), item.querySelector('.chip').cloneNode(true)),
      h('span', { class: 'pv-title' }, item.querySelector('.toc-title').textContent),
      item.querySelector('.tldr').cloneNode(true),
      h('a', { class: 'pv-go', href: item.getAttribute('href') }, 'read the note →'));
  };
  item.addEventListener('pointerenter', show);
  item.addEventListener('focus', show);
}

const label = (a) => S.labels?.[a] ?? (a ? fmt.short(a, 6, 4) : 'contract creation');
const addr = (a) => a ? h('a', { href: `https://etherscan.io/address/${a}`, target: '_blank', rel: 'noopener', class: 'addr' }, label(a)) : label(a);

function table(id, head, body) {
  const el = document.getElementById(id);
  if (!el) return;
  el.replaceChildren(h('table', { class: 'tbl' },
    h('thead', {}, h('tr', {}, head.map((x) => h('th', {}, x)))),
    h('tbody', {}, body.map((r) => h('tr', {}, r.map((x) => h('td', {}, x)))))));
}

// ---- figure helpers -------------------------------------------------------------------------------------------
// Half-width figures (inside .two) get a narrower viewBox so their text stays readable.
function frame(id, height, title) {
  const host = document.getElementById(id);
  if (!host) return null;
  const W = host.closest('.two') ? 430 : 860;
  const svg = s('svg', { viewBox: `0 0 ${W} ${height}`, width: '100%', role: 'img', 'aria-label': title });
  svg.W = W;
  host.replaceChildren(svg);
  return svg;
}
const txt = (x, y, t, a = {}) => s('text', { x, y, fill: COL.muted, 'font-size': 11, ...a }, t);

// Axis titles (y rotated on the left, x under the tick labels) and a one-row legend above the plot.
// Legend items: [label, colour, 'bar' | 'dot' | 'dash'].
function axes(svg, { L, R, T, B, H }, xlab, ylab, legend) {
  if (xlab) svg.append(txt(L + (svg.W - L - R) / 2, H - 6, xlab, { 'text-anchor': 'middle', fill: COL.ink2 }));
  if (ylab) {
    const m = (T + H - B) / 2;
    svg.append(txt(12, m, ylab, { 'text-anchor': 'middle', fill: COL.ink2, transform: `rotate(-90 12 ${m})` }));
  }
  let x = L;
  for (const [label, color, mark] of legend ?? []) {
    svg.append(mark === 'dash'
      ? s('line', { x1: x, x2: x + 14, y1: 12, y2: 12, stroke: color, 'stroke-width': 1.5, 'stroke-dasharray': '4 3' })
      : mark === 'dot' ? s('circle', { cx: x + 7, cy: 12, r: 3.5, fill: color })
      : s('rect', { x, y: 7, width: 11, height: 11, rx: 2, fill: color }), txt(x + 18, 16, label));
    x += 18 + label.length * 6.7 + 16;
  }
}

function bars(id, items, { height = 220, color = COL.green, yfmt = (v) => fmt.n(v), log = false, title = '',
  xlab = '', ylab = '', legend = null } = {}) {
  const svg = frame(id, height, title);
  if (!svg) return;
  const W = svg.W, L = ylab ? 76 : 64, R = 12, T = legend ? 30 : 14, B = xlab ? 50 : 34;
  const max = Math.max(...items.map((d) => d.v));
  const y = log ? (v) => T + (height - T - B) * (1 - Math.log10(Math.max(v, 1)) / Math.log10(max))
    : scale(0, max, height - B, T);
  const bw = (W - L - R) / items.length;
  svg.append(s('line', { x1: L, x2: W - R, y1: height - B, y2: height - B, stroke: COL.line }));
  for (const t of [0, 0.5, 1]) {
    const v = log ? Math.pow(10, Math.log10(max) * t) : max * t;
    svg.append(txt(L - 8, y(v) + 4, yfmt(v), { 'text-anchor': 'end' }),
      s('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), stroke: COL.line, 'stroke-dasharray': '2 4' }));
  }
  items.forEach((d, i) => {
    const x = L + i * bw, top = y(d.v);
    const r = s('rect', { x: x + bw * 0.12, y: top, width: Math.max(1, bw * 0.76), height: height - B - top,
      fill: d.color ?? color, rx: 2 });
    svg.append(hover(r, d.tip ?? `${d.label}: <b>${yfmt(d.v)}</b>`));
    if (d.label != null)
      svg.append(txt(x + bw / 2, height - B + 16, d.label, { 'text-anchor': 'middle' }));
  });
  const box = { svg, L, R, T, B, H: height, bw, y };
  axes(svg, box, xlab, ylab, legend);
  return box;
}

// Header stem before (EIP-8297 today) and after these notes: the three fields, then 32 storage slots, the three
// EIP-1967 proxy slots and reserved positions up to 64.
const PROXY = ['EIP-1967 implementation', 'EIP-1967 admin', 'EIP-1967 beacon'];
const FIELD = [['basic data: nonce, balance, code size', COL.blue], ['code hash', COL.amber], ['7702 delegation', COL.lilac]];
const RESERVED = ['reserved for future header fields', 'rgba(226,230,226,.10)'];
const BEFORE = (i) => i < 3 ? FIELD[i] : i < 64 ? RESERVED : i < 128 ? [`storage slot ${i - 64}`, COL.mint]
  : ['unused since code left the header', 'rgba(226,230,226,.04)'];
const AFTER = (i) => i < 3 ? FIELD[i] : i < 35 ? [`storage slot ${i - 3}`, COL.mint]
  : i < 38 ? [`proxy slot: ${PROXY[i - 35]}`, COL.orange] : RESERVED;
function stem() {
  const cell = 25, x0 = 30, H = 372;
  const svg = frame('fig-stem', H, 'Account header stem before and after');
  if (!svg) return;
  const grid = (y0, n, zone, title, note) => {
    svg.append(txt(x0, y0 - 8, title, { fill: COL.ink, 'font-size': 12 }),
      txt(x0 + 32 * cell - 3, y0 - 8, note, { 'text-anchor': 'end' }));
    for (let i = 0; i < n; i++) {
      const [what, fill] = zone(i);
      svg.append(hover(s('rect', { x: x0 + (i % 32) * cell, y: y0 + Math.floor(i / 32) * cell, width: cell - 3,
        height: cell - 3, rx: 3, fill, stroke: 'rgba(226,230,226,.12)' }), `position <b>${i}</b><br>${what}`));
    }
  };
  grid(26, 256, BEFORE, 'Before: EIP-8297 today', '256 positions · slots 0–63 at 64–127');
  grid(266, 64, AFTER, 'After: these notes applied', '64 positions · slots 0–31 at 3–34');
  [['basic data', COL.blue], ['code hash', COL.amber], ['delegation', COL.lilac], ['storage slots', COL.mint],
    ['proxy slots', COL.orange], ['reserved', RESERVED[1]]].forEach(([k, c], j) => svg.append(
    s('rect', { x: x0 + j * 130, y: H - 22, width: 12, height: 12, rx: 2, fill: c, stroke: 'rgba(226,230,226,.2)' }),
    txt(x0 + j * 130 + 18, H - 12, k)));
}

function a3() {
  const g = S.a3.grid.v;
  const cell = (pr, pw) => pct(g.find((x) => x.p_read === pr && x.p_write === pw).share);
  table('tbl-grid', ['header-slot read costs ↓ · further header write costs →', '0', '100', '500', '1,000'],
    [0, 100, 200].map((pr) => [String(pr), ...[0, 100, 500, 1000].map((pw) => cell(pr, pw))]));
  const b = S.a3.bins.v, n = Object.values(b).reduce((x, y) => x + y, 0);
  const names = { b0: '0', b1: '≤1 %', b2: '1–2 %', b5: '2–5 %', b10: '5–10 %', b20: '10–20 %', b100: '>20 %' };
  bars('fig-bins', Object.entries(b).map(([k, v]) => ({ label: names[k], v: v / n, color: k === 'b0' ? COL.muted : COL.green })),
    { height: 250, yfmt: (v) => pct(v, 0), title: 'Share of transactions by gas saved',
      xlab: 'gas saved, as a share of its own gas', ylab: 'share of transactions',
      legend: [['saves nothing', COL.muted, 'bar'], ['saves some gas', COL.green, 'bar']] });
  const pts = S.a3.per_chunk.v, avg = S.a3.default.v, H = 250;
  const svg = frame('fig-time', H, 'Gas saved per sampled chunk');
  if (svg) {
    const W = svg.W, L = 76, R = 12, T = 30, B = 50, max = Math.max(...pts.map((p) => p.share)) * 1.1;
    const x = scale(0, pts.length - 1, L, W - R), y = scale(0, max, H - B, T);
    for (const t of [0, 0.5, 1]) svg.append(txt(L - 8, y(max * t) + 4, pct(max * t, 0), { 'text-anchor': 'end' }),
      s('line', { x1: L, x2: W - R, y1: y(max * t), y2: y(max * t), stroke: COL.line, 'stroke-dasharray': '2 4' }));
    svg.append(s('line', { x1: L, x2: W - R, y1: y(avg), y2: y(avg), stroke: COL.ink2, 'stroke-width': 1.5,
      'stroke-dasharray': '4 3' }));
    svg.append(s('path', { d: pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.share)}`).join(''), fill: 'none',
      stroke: COL.green, 'stroke-width': 1.5 }));
    pts.forEach((p, i) => svg.append(hover(s('circle', { cx: x(i), cy: y(p.share), r: 3, fill: COL.green }),
      `${p.date} · block ${fmt.n(p.block)}<br><b>${pct(p.share)}</b> of gas`)));
    [0, Math.floor(pts.length / 2), pts.length - 1].forEach((i) =>
      svg.append(txt(x(i), H - B + 16, pts[i].date, { 'text-anchor': i ? (i === pts.length - 1 ? 'end' : 'middle') : 'start' })));
    axes(svg, { L, R, T, B, H }, 'sampled 1,000-block ranges, in time order', 'share of gas saved',
      [['one range', COL.green, 'dot'], [`all ranges: ${pct(avg)}`, COL.ink2, 'dash']]);
  }
  table('tbl-top-contracts', ['contract', 'share of header-slot charges', 'header slots used', 'most-read slots'],
    S.a3.top_contracts.v.map((r) => [addr(r.a), pct(r.share), String(r.slots_used), r.top_slots]));
  table('tbl-top-targets', ['transaction target', 'share of all savings', 'txs (sampled)', 'their gas saved'],
    S.a3.top_targets.v.map((r) => [addr(r.a), pct(r.share_of_saving), fmt.n(r.txs), pct(r.their_gas_saved)]));
}

// Header size N: EIP-8297 uses 64, EIP-7864 4, and 32 is the candidate in between.
const NCOL = { 4: COL.orange, 32: COL.amber, 64: COL.green };
function c1() {
  const sw = S.c1.sweep.v;
  const col = (n) => NCOL[n] ?? COL.ink2;
  const nkey = [['EIP-7864', COL.orange, 'bar'], ['candidate', COL.amber, 'bar'], ['EIP-8297', COL.green, 'bar']];
  bars('fig-sweep-paths', sw.map((r) => ({ label: `N=${r.n}`, v: r.paths_pb, color: col(r.n) })),
    { height: 220, yfmt: (v) => fmt.n(v, 0), title: 'Storage paths avoided per block',
      xlab: 'header slots N', ylab: 'paths avoided / block', legend: nkey });
  bars('fig-sweep-size', sw.map((r) => ({ label: `N=${r.n}`, v: r.hdr_slots * 32 / 1e9, color: col(r.n),
    tip: `N=${r.n}: <b>${compact(r.hdr_slots)}</b> live header slots, ${fmt.n(r.hdr_slots * 32 / 1e9, 2)}\u00a0GB of values` })),
    { height: 220, yfmt: (v) => `${fmt.n(v, 1)}\u00a0GB`, title: 'Live header slot values across all accounts',
      xlab: 'header slots N', ylab: 'slot values, all accounts', legend: nkey });
  const size = (n) => n * 32 >= 1024 ? `${fmt.n(n * 32 / 1024)}\u00a0KB` : `${n * 32}\u00a0B`;
  table('tbl-sweep', ['header slots N', 'cold storage charges caught', 'storage paths avoided / block', 'write paths / block',
    'gas saved', 'contracts with no bucket', 'live header slots', 'most one header holds'],
    sw.map((r) => [r.n === 256 ? '256 *' : String(r.n), pct(r.reads_share), fmt.n(r.paths_pb, 1), F.sn2(r.write_net_pb),
      r.a2 == null ? `${pct(r.a1)} (reads)` : pct(r.a1 + r.a2), pct(r.no_bucket),
      `${compact(r.hdr_slots)} · ${fmt.n(r.hdr_slots * 32 / 1e9, 1)}\u00a0GB`, size(r.n)]));
  const hst = S.c1.hist.v;
  const res = bars('fig-hist', hst.read.map((v, i) => ({ label: i % 32 === 0 ? String(i) : null, v,
    color: i < 64 ? COL.mint : COL.ink2, tip: `slot <b>${i}</b><br>reads ${fmt.n(v)} · writes ${fmt.n(hst.write[i])}` })),
  { height: 250, log: true, yfmt: compact, title: 'Cold charges by slot number', xlab: 'slot number',
    ylab: 'cold charges (log)', legend: [['inside today\u2019s header', COL.mint, 'bar'], ['outside', COL.ink2, 'bar']] });
  if (res) for (const n of [4, 32, 64]) {
    const x = res.L + n * res.bw;
    res.svg.append(s('line', { x1: x, x2: x, y1: res.T, y2: res.H - res.B, stroke: NCOL[n], 'stroke-dasharray': '3 3' }),
      txt(x + 3, res.T + 10, `N=${n}`, { fill: NCOL[n] }));
  }
}

function b2() {
  const hh = S.b2.hist_h.v;
  bars('fig-h', hh.map(([k, n]) => ({ label: k % 8 === 0 || k === 1 ? String(k) : null, v: n,
    tip: `<b>${fmt.n(n)}</b> contracts hold ${k} live header slot${k > 1 ? 's' : ''}` })),
  { height: 230, log: true, color: COL.mint, yfmt: compact, title: 'Contracts by live header slots',
    xlab: 'live slots in 0–63', ylab: 'contracts (log)' });
  bars('fig-eras-create', S.b2.eras.v.map((r) => ({ label: r.mblock % 5 === 0 || r.mblock === 1 ? `${r.mblock}M` : null, v: r.header_only,
    tip: `blocks ${r.mblock}M: <b>${pct(r.header_only)}</b> of ${fmt.n(r.n)} sampled storage-holding creations` })),
  { height: 210, color: COL.mint, yfmt: (v) => pct(v, 0), title: 'Header-only share of new storage-holding contracts',
    xlab: 'block height', ylab: 'share of new contracts' });
}

function c2() {
  table('tbl-proxies', ['proxy', 'share of proxy-slot charges'], S.c2.top.v.map((r) => [addr(r.a), pct(r.share)]));
}

function d() {
  bars('fig-eras', S.d1.eras.v.map((r) => ({ label: r.mblock % 5 === 0 || r.mblock === 1 ? `${r.mblock}M` : null, v: r.share,
    tip: `blocks ${r.mblock}M: <b>${pct(r.share)}</b> of ${fmt.n(r.writes)} sampled writes hit slots 0–63` })),
  { height: 210, color: COL.mint, yfmt: (v) => pct(v, 0), title: 'Share of slot writes in slots 0–63, by million-block era',
    xlab: 'block height', ylab: 'share of slot writes' });
  table('tbl-delegates', ['delegate code', 'accounts writing', 'slot writes', 'in slots 0–63'],
    S.d2.top.v.map((r) => [addr(r.a), fmt.n(r.accounts), fmt.n(r.writes), pct(r.hdr_share)]));
}

stem(); a3(); c1(); b2(); c2(); d();
reveal();
