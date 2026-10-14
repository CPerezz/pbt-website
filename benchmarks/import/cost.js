// What it cost: CPU, memory and disk of each client's import, replayed on the shared clock.
import { COL, controls, countUp, fmt, h, hover, num, onVisible, s, scale } from '../bench.js';

export default async function (root, ctx) {
  const { res, clock } = ctx;
  const CORES = res.rig.cores_measured;
  const LIMIT = (res.rig.mem_gib * 2 ** 30) / 1e9; // cgroup limit in GB
  const cols = await Promise.all(res.clients.map(async (c) => {
    const imp = c.imports[0];
    return { c, imp, rows: await ctx.csv(imp.files.resources), src: ctx.src(imp.files.resources) };
  }));
  const diskMax = Math.max(...cols.flatMap(({ rows }) => rows.flatMap((r) => [r.test_disk_read_mbps ?? 0, r.test_disk_write_mbps ?? 0])));

  // Last row at or before the import's own t (frozen on the last sample once the import ended).
  const at = ({ imp, rows }, t) => {
    const ts = imp.start + Math.min(t, imp.duration_s);
    let lo = 0, hi = rows.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (rows[m].t <= ts) lo = m; else hi = m - 1; }
    return rows[lo];
  };
  const v = (x) => x ?? 0;

  const updates = [];
  const panel = (col) => {
    const { c, imp, src } = col, color = ctx.color(c.id), r = imp.res;
    const cells = Array.from({ length: CORES }, () => h('div', { style: `height:100%;width:0;background:${color};box-shadow:0 0 10px ${color}` }));
    const cpuNow = num('', src, { class: 'num big', style: `color:${color}` });
    const avg = num(fmt.n(0, 2), ctx.src(imp.src));

    const seg = (bg) => h('div', { style: `position:absolute;top:0;bottom:0;background:${bg}` });
    const anon = seg(color), cache = seg(`${color}4D`), cl = seg(COL.muted);
    const heap = 'dotnet_heap_gb' in (col.rows[0] || {}) ? h('div', { style: `position:absolute;top:-4px;bottom:-4px;width:2px;background:${COL.ink};box-shadow:0 0 6px ${COL.ink}` }) : null;
    let cur = col.rows[0];
    const tank = hover(h('div', { class: 'track', style: 'position:relative;height:22px;overflow:visible;border-radius:4px' }, anon, cache, cl, heap), () =>
      `<b style="color:${color}">EL anon</b> ${fmt.n(v(cur.el_anon_gb), 1)} GB<br><b>EL page cache</b> ${fmt.n(v(cur.el_page_cache_gb), 1)} GB<br>` +
      `<b>CL anon</b> ${fmt.n(v(cur.cl_anon_gb), 1)} GB` + (heap ? `<br><b>.NET heap</b> ${fmt.n(v(cur.dotnet_heap_gb), 1)} GB` : '') +
      `<br><span class="lbl">limit ${res.rig.mem_gib} GiB = ${fmt.n(LIMIT, 2)} GB</span>`);

    const bar = () => {
      const fill = h('div', { class: 'fill', style: `background:${color};transition:none` });
      const val = num('', src, { style: 'min-width:86px;text-align:right' });
      return { fill, val, el: h('div', { style: 'display:flex;align-items:center;gap:8px' }, h('div', { class: 'track', style: 'flex:1' }, fill), val) };
    };
    const rd = bar(), wr = bar();

    const box = h('div', { class: 'panel', style: 'display:flex;flex-direction:column;gap:14px;transition:opacity .4s' },
      h('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap' },
        h('span', { class: 'big', style: `color:${color}` }, c.name)),
      h('div', {},
        h('div', { class: 'lbl' }, `CPU · ${CORES} cores`),
        h('div', { style: 'display:flex;gap:4px;height:26px;margin:6px 0' },
          cells.map((f) => h('div', { style: 'flex:1;border:1px solid var(--line);border-radius:3px;overflow:hidden' }, f))),
        h('div', { style: 'display:flex;align-items:baseline;gap:10px' }, cpuNow, h('span', { class: 'lbl' }, 'cores · avg ', avg))),
      h('div', {},
        h('div', { style: 'display:flex;justify-content:space-between' }, h('span', { class: 'lbl' }, 'Memory'), h('span', { class: 'lbl' }, `${res.rig.mem_gib} GiB limit`)),
        h('div', { style: 'margin:8px 0' }, tank),
        h('div', { class: 'lbl' }, 'peak process ', num(`${fmt.n(r.anon_peak_gb, 1)} GB`, ctx.src(imp.src), { style: `color:${color}` }))),
      h('div', {},
        h('div', { class: 'lbl' }, 'Disk'),
        h('div', { style: 'display:grid;grid-template-columns:auto 1fr;gap:6px 8px;align-items:center;margin:6px 0' },
          h('span', { class: 'lbl' }, 'read'), rd.el, h('span', { class: 'lbl' }, 'write'), wr.el),
        h('div', { class: 'lbl' },
          num(`${fmt.n(r.test_disk_read_gb)} GB`, ctx.src(imp.src), { style: `color:${color}` }), ' read · ',
          num(`${fmt.n(r.test_disk_write_gb)} GB`, ctx.src(imp.src), { style: `color:${color}` }), ' written')));

    onVisible(box, () => countUp(avg, r.avg_cores, (x) => fmt.n(x, 2)));
    const pct = (gb) => `${(100 * v(gb)) / LIMIT}%`;
    updates.push((t) => {
      const x = (cur = at(col, t));
      box.style.opacity = t > imp.duration_s ? 0.55 : 1;
      const k = v(x.el_cores);
      cells.forEach((f, i) => { f.style.width = `${100 * Math.max(0, Math.min(1, k - i))}%`; });
      cpuNow.textContent = fmt.n(k, 2);
      let left = 0;
      for (const [el, gb] of [[anon, x.el_anon_gb], [cache, x.el_page_cache_gb], [cl, x.cl_anon_gb]]) {
        el.style.left = `${(100 * left) / LIMIT}%`; el.style.width = pct(gb); left += v(gb);
      }
      if (heap) heap.style.left = pct(x.dotnet_heap_gb);
      for (const [b, mbps] of [[rd, x.test_disk_read_mbps], [wr, x.test_disk_write_mbps]]) {
        b.fill.style.width = `${(100 * v(mbps)) / diskMax}%`; b.val.textContent = `${fmt.n(v(mbps))} MB/s`;
      }
    });
    return box;
  };

  // Line charts sharing x = seconds since import start.
  const W = 1120, L = 48, R = 12, H = 96, T = 10;
  const x = scale(0, clock.duration, L, W - R);
  const chart = (label, key, max, unit, d, axis) => {
    const y = scale(0, max, T + H, T);
    const cursor = s('line', { y1: T, y2: T + H, stroke: COL.green, 'stroke-width': 1.5 });
    const ticks = axis ? Array.from({ length: Math.floor(clock.duration / 3600) + 1 }, (_, i) => i * 3600) : [];
    const svg = s('svg', { viewBox: `0 0 ${W} ${T + H + (axis ? 22 : 6)}`, style: 'width:100%;display:block' },
      s('line', { x1: L, x2: W - R, y1: T + H, y2: T + H, stroke: COL.line }),
      s('text', { x: L - 6, y: T + 8, 'text-anchor': 'end', fill: COL.muted, 'font-size': 10, text: fmt.n(max, d) }),
      s('text', { x: L - 6, y: T + H, 'text-anchor': 'end', fill: COL.muted, 'font-size': 10, text: '0' }),
      ticks.map((tt) => s('text', { x: x(tt), y: T + H + 16, 'text-anchor': 'middle', fill: COL.muted, 'font-size': 10, text: `${tt / 3600}h` })),
      cols.map(({ c, imp, rows }) => s('polyline', {
        fill: 'none', stroke: ctx.color(c.id), 'stroke-width': 1.4, 'stroke-linejoin': 'round',
        points: rows.filter((r) => r[key] != null && r.t >= imp.start).map((r) => `${x(r.t - imp.start).toFixed(1)},${y(Math.min(max, r[key])).toFixed(1)}`).join(' '),
      })),
      cursor);
    hover(svg, (e) => {
      const b = svg.getBoundingClientRect();
      const t = Math.max(0, Math.min(clock.duration, x.inv(((e.clientX - b.left) / b.width) * W)));
      return `<span class="lbl">t+${fmt.hm(t)} · ${label}</span><br>` + cols.map((col) => {
        const val = t > col.imp.duration_s ? '—' : `${fmt.n(v(at(col, t)[key]), d)} ${unit}`;
        return `<b style="color:${ctx.color(col.c.id)}">${col.c.name}</b> ${val}`;
      }).join('<br>');
    });
    updates.push((t) => { cursor.setAttribute('x1', x(t)); cursor.setAttribute('x2', x(t)); });
    return h('div', {}, h('div', { class: 'lbl', style: 'margin:10px 0 2px' }, label), svg);
  };
  const maxOf = (key) => Math.max(...cols.flatMap(({ rows }) => rows.map((r) => v(r[key]))));

  root.append(
    h('div', { class: 'sec-head' }, h('h2', { class: 'h2' }, 'What it cost'),
      h('span', { class: 'cap' }, 'CPU, memory and disk of each import, replayed side by side.')),
    h('div', { style: 'margin-bottom:18px' }, controls(clock)),
    h('div', { class: 'grid3', style: `--n:${cols.length}` }, cols.map(panel)),
    h('div', { class: 'panel', style: 'margin-top:14px' },
      chart('CPU cores', 'el_cores', CORES, 'cores', 2, false),
      chart('process memory (EL anon)', 'el_anon_gb', Math.ceil(maxOf('el_anon_gb')), 'GB', 1, false),
      chart('disk write', 'test_disk_write_mbps', Math.ceil(maxOf('test_disk_write_mbps') / 100) * 100, 'MB/s', 0, true)),
  );
  clock.on((t) => updates.forEach((u) => u(t)));
  onVisible(root, () => { if (!clock.playing) { clock.seek(0); clock.play(); } });
}
