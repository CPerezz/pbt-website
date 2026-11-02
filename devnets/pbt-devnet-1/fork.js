// Crossing the fork, then the disk, memory and block cost left after disposal.
import { COL, avatar, color, date, fmt, h, hover, ms, nearest, num, pct, s, scale, secHead, strip, term, vline } from './kit.js';

export default async function (root, ctx) {
  const f = await ctx.data('fork.json'), { dev } = ctx;
  const file = 'fork.json', hosts = dev.nodes.map((n) => n.host);
  const source = (text, view = 'n1_fork', attrs = {}) => num(text, file, view, attrs);
  const shade = (host) => `color-mix(in srgb, ${color(host)} ${100 - (Number(host.split('-')[1]) - 1) * 24}%, ${COL.ink})`;
  const node = (host) => h('span', { class: 'fork-node', style: `color:${shade(host)}` }, avatar(host.split('-')[0], 15), host);
  const rawRatio = (host) => f.after[host].post_ms / f.after[host].pre_ms;
  const range = (client, key, decimals = 0) => {
    const values = hosts.filter((host) => host.startsWith(`${client}-`)).map((host) => (key === 'ratio' ? rawRatio(host) : f.after[host][key]));
    const lo = fmt.n(Math.min(...values), decimals), hi = fmt.n(Math.max(...values), decimals);
    return lo === hi ? lo : `${lo}–${hi}`;
  };
  const ratio = (client, decimals = 1) => `${range(client, 'ratio', decimals)}×`;
  const nmRatios = hosts.filter((host) => host.startsWith('nethermind-')).map(rawRatio);
  const nmMean = nmRatios.reduce((sum, v) => sum + v, 0) / nmRatios.length;

  root.append(h('style', {}, `
    #fork .fork-caption { display:flex;justify-content:space-between;gap:8px 20px;flex-wrap:wrap;margin:0 0 12px;font-size:11px;color:var(--muted) }
    #fork .fork-node { display:inline-flex;align-items:center;gap:6px;white-space:nowrap;font-size:11px;font-weight:600 }
    #fork .fork-key { display:flex;gap:8px 15px;flex-wrap:wrap;margin:0 0 10px }
    #fork .fork-key .sw { width:18px;height:3px }
    #fork .fork-first { width:100%;border-collapse:collapse;table-layout:fixed;font-size:11px;margin-top:12px }
    #fork .fork-first th,#fork .fork-first td { padding:6px 4px;text-align:right;border-bottom:1px solid var(--line);font-weight:400;white-space:nowrap }
    #fork .fork-first th:first-child { text-align:left;width:95px;color:var(--muted) }
    #fork .fork-first thead th { font-size:10px }
    #fork .fork-note { font-size:11px;color:var(--muted);margin:9px 0 0;line-height:1.6 }
    #fork .fork-after { margin-top:22px }
    #fork .fork-head,#fork .fork-row { display:grid;grid-template-columns:135px 1fr 1fr 1.25fr;gap:22px;align-items:center }
    #fork .fork-head { padding:0 0 10px;border-bottom:1px solid var(--line) }
    #fork .fork-row { padding:12px 0;border-bottom:1px solid rgba(226,230,226,.06) }
    #fork .fork-metric { min-width:0;font-size:11px }
    #fork .fork-values { display:flex;gap:5px;align-items:baseline;flex-wrap:wrap;line-height:1.5;margin-bottom:5px }
    #fork .fork-track { height:6px;background:rgba(226,230,226,.06);border-radius:2px;margin-top:4px;cursor:help }
    #fork .fork-fill { height:100%;border-radius:2px;min-width:1px }
    #fork .fork-sub { font-size:10px;color:var(--muted);line-height:1.5;margin-top:5px }
    #fork .fork-mobile { display:none }
    #fork .strip { grid-template-columns:repeat(4,minmax(0,1fr)) }
    @media(max-width:760px) {
      #fork .fork-head { display:none }
      #fork .fork-row { grid-template-columns:1fr;gap:13px;padding:16px 0 }
      #fork .fork-mobile { display:block;margin-bottom:4px }
      #fork .fork-row>.fork-node { font-size:13px }
      #fork .strip { grid-template-columns:repeat(2,minmax(0,1fr)) }
    }
  `));
  root.append(secHead('The fork', [
    term('fork', 'binaryTrieTime'), ' is the scheduled switch from the Merkle-Patricia state root to the binary-tree root in each block header. The ',
    term('window', 'window'), ' keeps the old tree available until the fork is final, then ', term('disposal', 'disposal'), ' can retire it.'
  ]));

  const W = 1120, H = 294, L = 64, R = 1102, T = 31, B = 256;
  const xs = scale(-7200, 21600, L, R), logs = scale(1, 4, B, T);
  const ys = (v) => logs(Math.log10(Math.max(10, v)));
  const svg = s('svg', { class: 'fork-crossing', viewBox: `0 0 ${W} ${H}`, style: 'width:100%;display:block;cursor:crosshair', role: 'img',
    'aria-label': 'Per-node two-minute median newPayload times, two hours before to six hours after the fork; gaps are downtime' });
  const svgNumber = (text, attrs) => hover(s('a', { class: 'num', href: new URL(file, ctx.base).href, target: '_blank', rel: 'noopener' },
    s('text', { fill: COL.muted, 'font-size': 10, ...attrs, text })), `<b>${file}</b><br>blocks_node`);
  for (const v of [10, 100, 1000, 10000]) {
    svg.append(s('line', { x1: L, x2: R, y1: ys(v), y2: ys(v), stroke: COL.line }),
      svgNumber(v >= 1000 ? `${v / 1000} s` : `${v} ms`, { x: L - 9, y: ys(v) + 4, 'text-anchor': 'end' }));
  }
  for (let hour = -2; hour <= 6; hour++) {
    const x = xs(hour * 3600);
    svg.append(s('line', { x1: x, x2: x, y1: T, y2: B, stroke: COL.line, 'stroke-dasharray': '2 5' }),
      svgNumber(`${hour < 0 ? '−' : hour > 0 ? '+' : ''}${Math.abs(hour)} h`, { x, y: B + 20, 'text-anchor': 'middle' }));
  }
  svg.append(s('rect', { x: xs(0), y: T, width: xs(dev.fork.window_close_t - dev.fork.t) - xs(0), height: B - T, fill: COL.green, opacity: 0.045 }));
  vline(svg, xs(0), T, B, COL.red, 'fork');
  vline(svg, xs(dev.fork.window_close_t - dev.fork.t), T, B, COL.green, 'window closed', 12);
  const rings = new Map();
  for (const host of hosts) {
    let d = '', connected = false;
    for (const [t, value] of f.series[host]) {
      if (value == null) { connected = false; continue; }
      d += `${connected ? 'L' : 'M'}${xs(t).toFixed(1)},${ys(value).toFixed(1)} `;
      connected = true;
    }
    svg.append(s('path', { 'data-host': host, d, fill: 'none', stroke: shade(host), 'stroke-width': 1.25,
      'stroke-linejoin': 'round', 'stroke-dasharray': host.endsWith('-2') ? '5 2' : host.endsWith('-3') ? '2 2' : null, opacity: 0.88 }));
    const ring = s('circle', { r: 3, fill: COL.bg, stroke: shade(host), 'stroke-width': 1.5, style: 'display:none;pointer-events:none' });
    rings.set(host, ring);
    svg.append(ring);
  }
  const guide = s('line', { y1: T, y2: B, stroke: COL.ink2, 'stroke-dasharray': '2 3', style: 'display:none;pointer-events:none' });
  svg.append(guide);
  hover(svg, (e) => {
    const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
    const rel = Math.max(-7200, Math.min(21600, xs.inv(q.x)));
    guide.style.display = '';
    guide.setAttribute('x1', xs(rel)); guide.setAttribute('x2', xs(rel));
    return `<span class="lbl">nearest two-minute samples · UTC</span><br>` + hosts.map((host) => {
      const rows = f.series[host];
      let i = nearest(rows, rel);
      if (i > 0 && Math.abs(rows[i - 1][0] - rel) < Math.abs(rows[i][0] - rel)) i--;
      const [t, value] = rows[i], ring = rings.get(host);
      ring.style.display = value == null ? 'none' : '';
      if (value != null) { ring.setAttribute('cx', xs(t)); ring.setAttribute('cy', ys(value)); }
      return `<b style="color:${shade(host)}">${host}</b> · ${date(f.fork_t + t)} · ${value == null ? 'down / no sample' : ms(value)}`;
    }).join('<br>') + `<br><span class="muted">${file} · blocks_node</span>`;
  });
  svg.addEventListener('pointerleave', () => { guide.style.display = 'none'; rings.forEach((ring) => { ring.style.display = 'none'; }); });

  const first = h('table', { class: 'fork-first', 'aria-label': 'First ten post-fork blocks per node' },
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'first ten'), ...hosts.map((host) => h('th', { scope: 'col', style: `color:${shade(host)}` }, host)))),
    h('tbody', {}, ...[['p50', 'p50_ms'], ['maximum', 'max_ms']].map(([label, key]) => h('tr', {},
      h('th', { scope: 'row' }, label), ...hosts.map((host) => h('td', {}, source(ms(f.first10[host][key]))))))));
  const nonValid = Object.values(f.first10).reduce((sum, row) => sum + row.non_valid_first_hour, 0);
  root.append(h('div', { class: 'panel' },
    h('div', { class: 'fork-caption' }, h('span', {}, term('newpayload', 'newPayload'), ' · ', source('2-min', 'blocks_node'), ' medians · log scale · gaps = node down'),
      h('span', {}, num(date(dev.fork.t) + ' UTC', 'devnet.json', 'boundaries'), ' · block ', num(fmt.n(dev.fork.block), 'devnet.json', 'boundaries'))),
    h('div', { class: 'fork-key legend' }, ...hosts.map((host) => h('span', {}, h('i', { class: 'sw', style: `background:${shade(host)}` }), host))),
    h('div', { class: 'scroll' }, h('div', {}, svg)),
    h('div', { class: 'scroll' }, h('div', { style: 'min-width:1000px' }, first)),
    h('p', { class: 'fork-note' }, source(fmt.n(nonValid)), ' non-VALID responses in the first hour across all nodes that answered; downtime is not a VALID response. Samples below ',
      source(ms(10), 'blocks_node'), ' sit at the chart floor; hover shows their measured time.')));

  const maxDisk = Math.max(...hosts.map((host) => f.after[host].disk_released_gib));
  const maxRSS = Math.max(...hosts.flatMap((host) => [f.after[host].rss_pre_gib, f.after[host].rss_post_gib]));
  const maxBlock = Math.max(...hosts.flatMap((host) => [f.after[host].pre_ms, f.after[host].post_ms]));
  const bar = (value, max, col, tip, opacity = 1) => hover(h('div', { class: 'fork-track' },
    h('div', { class: 'fork-fill', style: `width:${value / max * 100}%;background:${col};opacity:${opacity}` })), tip);
  const mobile = (text) => h('span', { class: 'lbl fork-mobile' }, text);
  const after = h('div', { class: 'panel fork-after' },
    h('div', { class: 'fork-caption' }, h('span', {}, 'After the fork · same scale within each column · hover bars for details'),
      h('span', {}, h('span', { style: 'color:var(--muted)' }, 'faint = before'), ' · bright = after')),
    h('div', { class: 'fork-head' }, h('span', { class: 'lbl' }, 'node'), h('span', { class: 'lbl' }, 'disk released · GiB'),
      h('span', { class: 'lbl' }, 'memory · GiB'), h('span', { class: 'lbl' }, term('fullblock', 'full-block'), ' cost · ms')));
  for (const host of hosts) {
    const a = f.after[host], col = shade(host), ratioColor = a.ratio > 1.5 ? COL.red : a.ratio < 0.95 ? COL.green : COL.ink2;
    const retained = host.startsWith('nethermind-') || host.startsWith('erigon-');
    const diskTip = `<b>${host} · disk released</b><br>${fmt.n(a.disk_released_gib)} GiB<br>Before disposal → minimum datadir size afterwards${retained ? '<br>Kept the old tree’s bytes' : ''}<br><span class="muted">${file} · n1_fork</span>`;
    const memoryTip = `<b>${host} · memory (RSS)</b><br>${fmt.n(a.rss_pre_gib, 1)} → ${fmt.n(a.rss_post_gib, 1)} GiB<br>24 h before → after the fork<br>Post-fork cap: ${a.cap_post_gib} GiB${host.startsWith('geth-') ? ' (raised at restart)' : ''}<br><span class="muted">${file} · n1_fork</span>`;
    const blockTip = `<b>${host} · median per full block</b><br>Two trees + load: ${ms(a.pre_ms)}<br>Binary only: ${ms(a.post_ms)}<br><b>${fmt.n(a.ratio, 2)}×</b> · ${a.build}<br>${fmt.n(a.post_blocks)} post-fork blocks<br><span class="muted">${file} · n2_postfork_cost</span>`;
    after.append(h('div', { class: 'fork-row', 'data-host': host }, node(host),
      h('div', { class: 'fork-metric' }, mobile('disk released · GiB'),
        h('div', { class: 'fork-values', style: 'color:var(--green)' }, source(`${fmt.n(a.disk_released_gib)} GiB`)),
        bar(a.disk_released_gib, maxDisk, COL.green, diskTip), retained ? h('div', { class: 'fork-sub' }, 'kept the old tree’s bytes') : null),
      h('div', { class: 'fork-metric' }, mobile('memory · GiB'),
        h('div', { class: 'fork-values' }, source(fmt.n(a.rss_pre_gib, 1)), '→', source(`${fmt.n(a.rss_post_gib, 1)} GiB`)),
        bar(a.rss_pre_gib, maxRSS, col, memoryTip, 0.3), bar(a.rss_post_gib, maxRSS, col, memoryTip),
        h('div', { class: 'fork-sub' }, source('24 h'), ' before → after', host.startsWith('geth-') ? [' · restart cap ', source(`${a.cap_post_gib} GiB`)] : [])),
      h('div', { class: 'fork-metric' }, mobile('full-block cost · ms'),
        h('div', { class: 'fork-values' }, source(fmt.n(a.pre_ms), 'n2_postfork_cost'), '→', source(`${fmt.n(a.post_ms)} ms`, 'n2_postfork_cost'),
          source(`${fmt.n(a.ratio, 2)}×`, 'n2_postfork_cost', { style: `color:${ratioColor};margin-left:auto` })),
        bar(a.pre_ms, maxBlock, col, blockTip, 0.3), bar(a.post_ms, maxBlock, ratioColor, blockTip),
        h('div', { class: 'fork-sub' }, source(a.build, 'n2_postfork_cost')))));
  }
  after.append(h('p', { class: 'fork-note' }, term('twotrees', 'Two trees'), ' + load → binary only; these after-fork medians use the builds named on each row, not the older builds in the crossing chart. ',
    'geth-2: ', source(fmt.n(f.after['geth-2'].post_blocks), 'n2_postfork_cost'), ' post-fork blocks on ', source(f.after['geth-2'].build, 'n2_postfork_cost'), '.'));
  root.append(after);

  root.append(strip([
    { label: 'nodes on one root', value: source(`${Object.keys(f.first10).length} / ${dev.nodes.length}`, 'watch_samples'), note: 'all crossed the fork' },
    { label: 'boundary participation', value: source(pct(f.boundary.participation), 'network'), note: term('participation', 'validator participation') },
    { label: 'boundary missed slots', value: source(fmt.n(f.boundary.missed_slots), 'network'), note: 'at the transition, not the whole run' },
    { label: 'window closed', value: num(`+${dev.fork.window_close_min} min`, 'devnet.json', 'boundaries'), note: [num(date(dev.fork.window_close_t) + ' UTC', 'devnet.json', 'boundaries'), ' · fork finalized'] },
    { label: 'disk released', value: source(`${range('geth', 'disk_released_gib')} GiB`), note: ['geth · Besu ', source(`${range('besu', 'disk_released_gib')} GiB`)] },
    { label: 'geth block cost', value: source(ratio('geth'), 'n2_postfork_cost'), note: 'binary only / two trees + load' },
    { label: 'Nethermind / Besu', value: source(ratio('nethermind', 2), 'n2_postfork_cost'), note: ['Nethermind · Besu ', source(ratio('besu'), 'n2_postfork_cost')] },
    { label: 'erigon block cost', value: source(ratio('erigon'), 'n2_postfork_cost'), note: 'binary only / two trees + load' },
  ]));
  root.append(h('p', { class: 'reading' }, h('b', {}, 'Reading. '), 'All ', source(String(hosts.length), 'watch_samples'), ' nodes crossed on one root. ',
    'On the binary tree today, geth is ', source(ratio('geth'), 'n2_postfork_cost'), ' slower per full block; Nethermind is about ', source(`${fmt.n(nmMean, 1)}×`, 'n2_postfork_cost'),
    ', Besu ', source(ratio('besu'), 'n2_postfork_cost'), ', and erigon ', source(ratio('erigon'), 'n2_postfork_cost'), ' their pre-fork cost. ',
    'This is geth’s code path today, not the design: the same binary tree costs Nethermind less than its Merkle-Patricia trie did.'));
}
