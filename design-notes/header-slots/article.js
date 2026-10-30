// Header-slots design note: fills every [data-n] number and draws the figures from data/summary.json.
// Each number links to the raw query output it comes from (the site's provenance rule).
import { h, s, COL, scale, fmt, getJSON, hover, reveal } from '../../benchmarks/bench.js';

const DATA = new URL('data/', import.meta.url).href;
const S = await getJSON(`${DATA}summary.json`);

const get = (path) => path.split('.').reduce((o, k) => o?.[k], S);
const pct = (v, d = 1) => `${fmt.n(v * 100, d)} %`;
const F = {
  pct: (v) => pct(v), pct0: (v) => pct(v, 0), pct2: (v) => pct(v, 2), n: (v) => fmt.n(v), n1: (v) => fmt.n(v, 1),
  n2: (v) => fmt.n(v, 2), kb: (v) => `${fmt.n(v, 1)} KB`, b: (v) => `${fmt.n(v)} B`, s: (v) => String(v),
  sn2: (v) => `${v >= 0 ? '+' : '−'}${fmt.n(Math.abs(v), 2)}`, m: (v) => `${fmt.n(v / 1e6, 1)} M`,
};
const UNIT = { kb: [(v) => fmt.n(v, 1), ' KB'], b: [(v) => fmt.n(v), ' B'] };
const fmtv = (f, v) => !Array.isArray(v) ? F[f](v)
  : UNIT[f] ? v.map(UNIT[f][0]).join('–') + UNIT[f][1]
  : v.map((x) => F[f](x)).join(v.length > 2 ? ' · ' : '–');
const compact = (v) => v >= 1e6 ? `${fmt.n(v / 1e6, 1)} M` : v >= 1e3 ? `${fmt.n(v / 1e3, 0)} k` : fmt.n(v, 0);
// A published number links to its source file; hover shows the raw file(s) and queries.
function link(text, src) {
  if (!src?.length) return h('span', {}, text);
  const a = h('a', { class: 'num', href: `${DATA}${src[0]}`, target: '_blank', rel: 'noopener' }, text);
  return hover(a, `<span class="lbl">source</span><br>${src.map((x) => `<b>data/${x}</b>`).join('<br>')}`);
}

for (const el of document.querySelectorAll('[data-n]')) {
  const node = get(el.dataset.n);
  if (!node) { el.textContent = '?'; console.warn('missing', el.dataset.n); continue; }
  el.replaceChildren(link(fmtv(el.dataset.f || 'n', node.v), node.src));
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

function bars(id, items, { height = 220, color = COL.green, yfmt = (v) => fmt.n(v), log = false, title = '' } = {}) {
  const svg = frame(id, height, title);
  if (!svg) return;
  const W = svg.W, L = 64, R = 12, T = 14, B = 34, max = Math.max(...items.map((d) => d.v));
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
  return { svg, L, R, T, B, bw, y };
}

// Header stem: 256 sub-indices, coloured by what EIP-8297 puts there.
function stem() {
  const svg = frame('fig-stem', 250, 'Sub-indices of an account header stem');
  if (!svg) return;
  const zones = (i) => i === 0 ? ['basic data: nonce, balance, code size', COL.blue]
    : i === 1 ? ['code hash', COL.amber] : i === 2 ? ['7702 delegation', COL.lilac]
    : i < 64 ? ['reserved for future header fields (unused)', 'rgba(226,230,226,.08)']
    : i < 128 ? [`storage slot ${i - 64}`, COL.mint] : ['unused since code left the header', 'rgba(226,230,226,.05)'];
  const cell = 25, x0 = 30, y0 = 18;
  for (let i = 0; i < 256; i++) {
    const [what, fill] = zones(i);
    const r = s('rect', { x: x0 + (i % 32) * cell, y: y0 + Math.floor(i / 32) * cell, width: cell - 3, height: cell - 3,
      rx: 3, fill, stroke: 'rgba(226,230,226,.12)' });
    svg.append(hover(r, `sub-index <b>${i}</b><br>${what}`));
  }
  svg.append(txt(x0, 236, 'Hover a cell. Row = 32 sub-indices. Mint = storage slots 0–63 (sub-indices 64–127): one subtree under the bits 01.'));
}

function a3() {
  const g = S.a3.grid.v;
  const cell = (pr, pw) => pct(g.find((x) => x.p_read === pr && x.p_write === pw).share);
  table('tbl-grid', ['header-slot read costs ↓ · further header write costs →', '0', '100', '500', '1,000'],
    [0, 100, 200].map((pr) => [String(pr), ...[0, 100, 500, 1000].map((pw) => cell(pr, pw))]));
  const b = S.a3.bins.v, n = Object.values(b).reduce((x, y) => x + y, 0);
  const names = { b0: '0', b1: '≤1 %', b2: '1–2 %', b5: '2–5 %', b10: '5–10 %', b20: '10–20 %', b100: '>20 %' };
  bars('fig-bins', Object.entries(b).map(([k, v]) => ({ label: names[k], v: v / n, color: k === 'b0' ? COL.muted : COL.green })),
    { yfmt: (v) => pct(v, 0), title: 'Share of transactions by gas saved' });
  const pts = S.a3.per_chunk.v;
  const svg = frame('fig-time', 200, 'Gas saved per sampled chunk');
  if (svg) {
    const W = svg.W, L = 64, R = 12, T = 12, B = 30, max = Math.max(...pts.map((p) => p.share)) * 1.1;
    const x = scale(0, pts.length - 1, L, W - R), y = scale(0, max, 200 - B, T);
    for (const t of [0, 0.5, 1]) svg.append(txt(L - 8, y(max * t) + 4, pct(max * t, 0), { 'text-anchor': 'end' }),
      s('line', { x1: L, x2: W - R, y1: y(max * t), y2: y(max * t), stroke: COL.line, 'stroke-dasharray': '2 4' }));
    svg.append(s('path', { d: pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.share)}`).join(''), fill: 'none',
      stroke: COL.green, 'stroke-width': 1.5 }));
    pts.forEach((p, i) => svg.append(hover(s('circle', { cx: x(i), cy: y(p.share), r: 3, fill: COL.green }),
      `${p.date} · block ${fmt.n(p.block)}<br><b>${pct(p.share)}</b> of gas`)));
    [0, Math.floor(pts.length / 2), pts.length - 1].forEach((i) =>
      svg.append(txt(x(i), 200 - 10, pts[i].date, { 'text-anchor': i ? (i === pts.length - 1 ? 'end' : 'middle') : 'start' })));
  }
  table('tbl-top-contracts', ['contract', 'share of header-slot charges', 'header slots used', 'most-read slots'],
    S.a3.top_contracts.v.map((r) => [addr(r.a), pct(r.share), String(r.slots_used), r.top_slots]));
  table('tbl-top-targets', ['transaction target', 'share of all savings', 'txs (sampled)', 'their gas saved'],
    S.a3.top_targets.v.map((r) => [addr(r.a), pct(r.share_of_saving), fmt.n(r.txs), pct(r.their_gas_saved)]));
}

function c1() {
  const sw = S.c1.sweep.v;
  const col = (n) => n === 64 ? COL.green : COL.ink2;
  bars('fig-sweep-paths', sw.map((r) => ({ label: `N=${r.n}`, v: r.paths_pb, color: col(r.n) })),
    { height: 180, yfmt: (v) => fmt.n(v, 0), title: 'Storage paths avoided per block' });
  // Only N where both the read and the write rule were measured, so the bars compare like with like.
  bars('fig-sweep-gas', sw.filter((r) => r.a2 != null).map((r) => ({ label: `N=${r.n}`, v: r.a1 + r.a2, color: col(r.n),
    tip: `N=${r.n}: reads <b>${pct(r.a1)}</b> + writes <b>${pct(r.a2)}</b>` })),
    { height: 180, yfmt: (v) => pct(v), title: 'Gas saved under the A rules' });
  table('tbl-sweep', ['header slots N', 'storage paths avoided / block (reads)', 'net write paths / block',
    'gas saved: reads', 'gas saved: writes'],
    sw.map((r) => [String(r.n), fmt.n(r.paths_pb, 1), F.sn2(r.write_net_pb), pct(r.a1), r.a2 == null ? '—' : pct(r.a2)]));
  const hst = S.c1.hist.v;
  const res = bars('fig-hist', hst.read.map((v, i) => ({ label: i % 32 === 0 ? String(i) : null, v,
    color: i < 64 ? COL.mint : COL.ink2, tip: `slot <b>${i}</b><br>reads ${fmt.n(v)} · writes ${fmt.n(hst.write[i])}` })),
  { height: 220, log: true, yfmt: compact, title: 'Cold charges by slot number' });
  if (res) for (const n of [4, 64, 128, 192]) {
    const x = res.L + n * res.bw;
    res.svg.append(s('line', { x1: x, x2: x, y1: res.T, y2: 220 - res.B, stroke: n === 64 ? COL.green : COL.orange,
      'stroke-dasharray': '3 3' }), txt(x + 3, res.T + 10, `N=${n}`, { fill: n === 64 ? COL.green : COL.orange }));
  }
}

function b2() {
  const hh = S.b2.hist_h.v;
  bars('fig-h', hh.map(([k, n]) => ({ label: k % 8 === 0 || k === 1 ? String(k) : null, v: n,
    tip: `<b>${fmt.n(n)}</b> contracts hold ${k} live header slot${k > 1 ? 's' : ''}` })),
  { height: 200, log: true, color: COL.mint, yfmt: compact, title: 'Contracts by live header slots' });
  bars('fig-eras-create', S.b2.eras.v.map((r) => ({ label: r.mblock % 5 === 0 || r.mblock === 1 ? `${r.mblock}M` : null, v: r.header_only,
    tip: `blocks ${r.mblock}M: <b>${pct(r.header_only)}</b> of ${fmt.n(r.n)} sampled storage-holding creations` })),
  { height: 170, color: COL.mint, yfmt: (v) => pct(v, 0), title: 'Header-only share of new storage-holding contracts' });
}

function c2() {
  table('tbl-proxies', ['proxy', 'share of proxy-slot charges'], S.c2.top.v.map((r) => [addr(r.a), pct(r.share)]));
}

function d() {
  bars('fig-eras', S.d1.eras.v.map((r) => ({ label: r.mblock % 5 === 0 || r.mblock === 1 ? `${r.mblock}M` : null, v: r.share,
    tip: `blocks ${r.mblock}M: <b>${pct(r.share)}</b> of ${fmt.n(r.writes)} sampled writes hit slots 0–63` })),
  { height: 180, color: COL.mint, yfmt: (v) => pct(v, 0), title: 'Share of slot writes in slots 0–63, by million-block era' });
  table('tbl-delegates', ['delegate code', 'accounts writing', 'slot writes', 'in slots 0–63'],
    S.d2.top.v.map((r) => [addr(r.a), fmt.n(r.accounts), fmt.n(r.writes), pct(r.hdr_share)]));
}

stem(); a3(); c1(); b2(); c2(); d();
reveal();
