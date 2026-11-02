// Validation stays live while the binary tree is built; compare work-normalized cost, then replay throughput.
import { CLIENT, COL, HOSTS, NAME, avatar, clientOf, color, date, day, fmt, h, hover, ms, nearest, num, s, scale, secHead, strip, term, vline } from './kit.js';

const FILE = 'validating.json';
const STATE = {
  'one tree': 'Only the Merkle-Patricia tree is maintained, before migration.',
  migrating: 'The binary tree is being built and checked beside live validation.',
  replaying: 'The binary tree catches up from access lists beside live validation.',
  'two trees': 'Both trees are maintained on every block, before the extra load.',
  'two trees + load': 'Both trees are maintained under the storage-heavy XEN load.',
  'binary only': 'Only the binary tree remains; geth uses its fixed post-fork builds.',
};
const range = (values, digits = 1) => {
  const lo = Math.min(...values), hi = Math.max(...values);
  return fmt.n(lo, digits) + (fmt.n(lo, digits) === fmt.n(hi, digits) ? '' : `–${fmt.n(hi, digits)}`);
};

export default async function (root, ctx) {
  const data = await ctx.data(FILE), dev = ctx.dev;
  const clients = [...new Set(dev.nodes.map((n) => n.client))];
  const hosts = HOSTS.filter((host) => data.grid[host]);
  const source = (view) => `<span class="lbl">source</span><br>${FILE} · ${view}`;
  const tip = (title, lines, view) => `<b>${title}</b><br>${lines.join('<br>')}<br>${source(view)}`;
  const linked = (text, view, html) => hover(num(text, FILE, view), html);
  const snum = (text, view, attrs) => hover(s('a', { class: 'num', href: new URL(FILE, ctx.base).href, target: '_blank', rel: 'noopener' },
    s('text', attrs, text)), source(view));
  const sw = (col) => h('span', { class: 'sw', style: `background:${col}` });
  const node = (host) => h('span', { class: 'val-host', style: `color:${color(host)}` }, avatar(clientOf(host), 16), host);

  root.append(h('style', {}, `
    #validating .val-sub { margin: 24px 0 10px; font-size: 12px; font-weight: 500; color: var(--ink2) }
    #validating .val-note { margin: 8px 0 14px; font-size: 11px; color: var(--muted); line-height: 1.6 }
    #validating .val-host { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; white-space: nowrap }
    #validating .val-grid { grid-template-columns: 140px repeat(6,minmax(76px,1fr)) 175px; align-items: stretch }
    #validating .val-grid > .val-host { padding: 6px 0 }
    #validating .val-grid .hdr { display: flex; align-items: center; justify-content: center; line-height: 1.4; padding: 7px 3px }
    #validating .val-grid .cell { display: flex; align-items: center; justify-content: center; min-height: 34px }
    #validating .val-grid .val-ratio { flex-wrap: wrap; column-gap: 5px; font-size: 10px; border: 1px solid var(--line) }
    #validating .val-grid .val-ratio b { font-size: 11px; font-weight: 500 }
    #validating .val-panels { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 14px }
    #validating .val-panel { min-width: 0; padding: 12px }
    #validating .val-panel-head { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 14px; margin-bottom: 6px }
    #validating .val-panel .legend { gap: 10px; font-size: 10px }
    #validating .val-panel svg { width: 100%; display: block }
    #validating .val-panel svg text { font-size: 10px }
    #validating .val-replay { margin-top: 12px }
    #validating .stat .big { white-space: normal; font-size: 28px }
    #validating .val-stat-line { display: block; margin-top: 3px }
    @media (max-width: 760px) {
      #validating .val-panels { grid-template-columns: 1fr }
      #validating .val-grid { min-width: 930px }
      #validating .strip { grid-template-columns: repeat(2,minmax(0,1fr)) }
    }
  `));
  root.append(secHead('Still validating?', [
    'A node building its binary tree is still a validator: it keeps processing new blocks while the build runs. We measure ',
    term('newpayload', 'newPayload'), ' on ', term('fullblock', 'full blocks'), ' per ', term('mgasfrac', 'MGas'), ' so load levels compare.',
  ]));

  // Each state is a separate sample population; the final column is the fixed-build pre/post comparison.
  const values = hosts.flatMap((host) => Object.values(data.grid[host]).map((v) => v.ms_per_mgas));
  const low = Math.log(Math.min(...values)), high = Math.log(Math.max(...values));
  const grid = h('div', { class: 'grid-tbl val-grid', 'aria-label': 'Median validation milliseconds per MGas by host and state' },
    h('div', { class: 'hdr', style: 'justify-content:flex-start' }, 'node · ms / MGas'),
    ...data.states.map((state) => hover(h('div', { class: 'hdr' },
      state === 'two trees' ? term('twotrees', state) : state === 'two trees + load' ? [term('twotrees', 'two trees'), ' + ', term('xen', 'load')] : state), STATE[state])),
    h('div', { class: 'hdr' }, 'two trees + load → binary only · ms / block'));
  for (const host of hosts) {
    grid.append(node(host));
    for (const state of data.states) {
      const v = data.grid[host][state];
      if (!v) {
        grid.append(hover(h('div', { class: 'cell none' }, '·'), tip(`${host} · ${state}`, ['No sampled state for this node.', STATE[state]], 'c0_states')));
        continue;
      }
      const alpha = 0.08 + 0.42 * (high === low ? 0 : (Math.log(v.ms_per_mgas) - low) / (high - low));
      const html = tip(`${host} · ${state}`, [
        `${fmt.n(v.ms_per_mgas, 2)} ms per MGas`, `${ms(v.ms_per_block)} per full block`, `${fmt.n(v.n)} full blocks`, STATE[state],
        ...(state === 'binary only' ? [`sample from ${date(data.binary_only_from[host])} UTC`] : []),
      ], 'c0_states · blocks_node');
      grid.append(hover(h('div', { class: 'cell', style: `background:color-mix(in srgb,${color(host)} ${alpha * 100}%,transparent)` },
        linked(fmt.n(v.ms_per_mgas, 2), 'c0_states', html)), html));
    }
    const r = data.ratio[host], col = r.ratio > 1.5 ? COL.red : r.ratio < 0.95 ? COL.green : COL.ink2;
    const html = tip(`${host} · binary only / two trees + load`, [
      `${ms(r.pre_ms)} → ${ms(r.post_ms)} per full block`, `${fmt.n(r.ratio, 2)}× the pre-fork cost`,
      `post-fork sample from ${date(data.binary_only_from[host])} UTC`, 'Matched post-fork-cost windows; geth uses the fixed builds.',
    ], 'n2_postfork_cost');
    grid.append(hover(h('div', { class: 'cell val-ratio', style: `color:${col}` },
      linked(`${fmt.n(r.pre_ms)} → ${fmt.n(r.post_ms)}`, 'n2_postfork_cost', html),
      h('b', {}, linked(`(${fmt.n(r.ratio, 2)}×)`, 'n2_postfork_cost', html))), html));
  }
  root.append(h('div', { class: 'scroll' }, h('div', {}, grid)),
    h('p', { class: 'val-note' }, 'Brighter cells mean higher cost on a logarithmic colour scale; · means no sampled state. The ratio uses matched cost windows, not the whole-state medians; binary-only geth cells start on the fixed builds.'));

  // Static hourly medians: independent client y scales, common UTC x scale, and no interpolation across long gaps.
  root.append(h('h3', { class: 'val-sub' }, 'Block-processing time through the devnet'),
    h('div', { class: 'legend' }, h('span', {}, sw('rgba(226,230,226,.2)'), 'migration + catch-up'),
      h('span', {}, sw(COL.amber), term('xen', 'XEN load')), h('span', {}, sw(COL.red), term('fork', 'fork'))),
    h('p', { class: 'val-note' }, 'Hourly median ms per full block, including earlier builds; each client has its own linear scale. Gaps are missing samples, not zero cost.'));
  const panels = h('div', { class: 'val-panels' });
  for (const client of clients) {
    const members = hosts.filter((host) => clientOf(host) === client);
    const W = 520, H = 230, L = 44, R = 506, T = 25, B = 200;
    const max = Math.max(...members.flatMap((host) => data.hourly[host].map((p) => p[1])));
    const xs = scale(dev.window.t0, dev.window.t1, L, R), ys = scale(0, max, B, T);
    const shade = (i) => i ? `color-mix(in srgb,${CLIENT[client]} ${100 - i * 28}%,white)` : CLIENT[client];
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `${NAME[client]} hourly median newPayload milliseconds on full blocks`, style: 'cursor:crosshair' });
    members.forEach((host, i) => {
      for (const [a, b] of data.migrating_spans[host] ?? []) {
        svg.append(hover(s('rect', { x: xs(a), y: T, width: xs(b) - xs(a), height: B - T, fill: shade(i), opacity: 0.09 }),
          tip(`${host} · migration + catch-up`, [`${date(a)} → ${date(b)} UTC`], 'a1_runs')));
      }
    });
    for (const v of [0, max / 2, max]) {
      svg.append(s('line', { x1: L, x2: R, y1: ys(v), y2: ys(v), stroke: COL.line }),
        snum(fmt.n(v, 0), 'blocks_node', { x: L - 7, y: ys(v) + 3, fill: COL.muted, 'text-anchor': 'end' }));
    }
    for (let t = (Math.floor(dev.window.t0 / 86400) + 1) * 86400; t <= dev.window.t1; t += 86400) {
      svg.append(s('line', { x1: xs(t), x2: xs(t), y1: T, y2: B, stroke: COL.line, 'stroke-dasharray': '2 4' }));
      if (new Date(t * 1000).getUTCDate() % 2 === 0) svg.append(snum(day(t), 'blocks_node', { x: xs(t), y: B + 17, fill: COL.muted, 'text-anchor': 'middle' }));
    }
    svg.append(s('text', { x: L - 7, y: T - 12, fill: COL.muted, 'text-anchor': 'end', text: 'ms' }));
    const points = [];
    members.forEach((host, i) => {
      const rows = data.hourly[host];
      const path = rows.map(([t, value], j) => `${!j || t - rows[j - 1][0] > 7200 ? 'M' : 'L'}${xs(t).toFixed(2)},${ys(value).toFixed(2)}`).join(' ');
      svg.append(s('path', { d: path, fill: 'none', stroke: shade(i), 'stroke-width': 1.5, 'stroke-linejoin': 'round', 'pointer-events': 'none' }));
      for (const row of rows) {
        points.push({ host, row, x: xs(row[0]), y: ys(row[1]), col: shade(i) });
        svg.append(s('circle', { cx: xs(row[0]), cy: ys(row[1]), r: 1.3, fill: shade(i), 'pointer-events': 'none' }));
      }
    });
    vline(svg, xs(dev.xen_t), T, B, COL.amber, 'XEN');
    vline(svg, xs(dev.fork.t), T, B, COL.red, 'fork');
    const ring = s('circle', { r: 4, fill: COL.bg, stroke: COL.ink, 'stroke-width': 1.5, style: 'display:none;pointer-events:none' });
    svg.append(ring);
    hover(svg, (e) => {
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
      let best, distance = Infinity;
      for (const host of members) {
        const rows = data.hourly[host], at = nearest(rows, xs.inv(p.x));
        for (const j of new Set([Math.max(0, at - 1), at])) {
          const row = rows[j], x = xs(row[0]), y = ys(row[1]);
          const d = (p.x - x) ** 2 + (p.y - y) ** 2;
          if (d < distance) { distance = d; best = { host, row, x, y }; }
        }
      }
      ring.setAttribute('cx', best.x); ring.setAttribute('cy', best.y); ring.style.display = '';
      return tip(best.host, [`${date(best.row[0])} UTC`, `${ms(best.row[1])} hourly median`, `${fmt.n(best.row[2])} full blocks`], 'blocks_node');
    });
    svg.addEventListener('pointerleave', () => { ring.style.display = 'none'; });
    panels.append(h('div', { class: 'panel val-panel' },
      h('div', { class: 'val-panel-head' }, avatar(client, 18), h('b', { style: `color:${CLIENT[client]}` }, NAME[client]),
        h('span', { class: 'legend' }, ...members.map((host, i) => h('span', {}, sw(shade(i)), host)))), svg));
  }
  root.append(panels);

  // One throughput scale for live and synthetic blocks; a second scale answers the operator's mainnet-day question.
  root.append(h('h3', { class: 'val-sub' }, 'Catching the new tree up to the head'),
    h('p', { class: 'val-note' }, term('replay', 'Replay'), ' advances the binary tree from block access lists; the live-block rate transfers to mainnet because live blocks have comparable writes per block, unlike the heavier ', term('synthetic', 'synthetic history'), '.'),
    h('div', { class: 'legend' }, h('span', {}, sw(COL.ink2), 'live blocks / s'),
      h('span', {}, sw('rgba(226,230,226,.3)'), 'synthetic blocks / s'), h('span', {}, sw(COL.green), 'a day of mainnet · minutes')));
  const W = 1120, T = 32, RH = 40, H = T + RH * data.replay.length + 26;
  const L = 215, R = 650, ML = 765, MR = 1045;
  const rateMax = Math.max(...data.replay.flatMap((r) => [r.live_blk_s, r.synthetic_blk_s]));
  const minuteMax = Math.max(...data.replay.map((r) => r.min_per_mainnet_day_live));
  const xs = scale(0, rateMax, L, R), mins = scale(0, minuteMax, ML, MR);
  const replaySvg = s('svg', { viewBox: `0 0 ${W} ${H}`, style: 'width:100%;display:block', role: 'img', 'aria-label': 'Replay throughput and minutes for a day of mainnet per migration run' });
  replaySvg.append(s('text', { x: L, y: 13, fill: COL.muted, 'font-size': 10, text: 'blocks / s · higher is faster' }),
    s('text', { x: ML, y: 13, fill: COL.muted, 'font-size': 10, text: 'mainnet day · lower is faster' }));
  for (const [x, max, view] of [[xs, rateMax, 'd4_replay_mainnet_minutes'], [mins, minuteMax, 'd4_replay_mainnet_minutes']]) {
    for (const value of [0, max / 2, max]) replaySvg.append(
      s('line', { x1: x(value), x2: x(value), y1: T - 8, y2: H - 22, stroke: COL.line, 'stroke-dasharray': '2 4' }),
      snum(fmt.n(value, 1), view, { x: x(value), y: H - 6, fill: COL.muted, 'font-size': 10, 'text-anchor': 'middle' }));
  }
  data.replay.forEach((run, i) => {
    const host = run.run_id.split('/')[0], method = run.run_id.split('/')[1], y = T + i * RH, col = color(host);
    replaySvg.append(avatar(clientOf(host), 16, { x: 0, y: y + 1 }),
      s('text', { x: 23, y: y + 13, fill: col, 'font-size': 11, text: `${host} · ${method}` }));
    const html = tip(run.run_id, [
      `${fmt.n(run.live_blk_s, 1)} live blocks/s`,
      run.synthetic_blk_s > 0 ? `${fmt.n(run.synthetic_blk_s, 1)} synthetic blocks/s` : 'No synthetic-history replay in this run.',
      `${fmt.n(run.min_per_mainnet_day_live, 1)} min per mainnet day at the live-block rate`,
      `${fmt.n(run.min_per_mainnet_day_write_scaled, 1)} min per mainnet day when scaled by storage writes`,
      'Live estimate: replay a mainnet day’s block count at this live-block rate.',
      'Write-scaled estimate: match a mainnet day’s storage-write volume instead.',
    ], 'd4_replay_mainnet_minutes');
    replaySvg.append(hover(s('rect', { x: L, y, width: xs(run.live_blk_s) - L, height: 10, rx: 2, fill: col, class: 'val-live' }), html),
      hover(s('a', { class: 'num', href: new URL(FILE, ctx.base).href, target: '_blank', rel: 'noopener' },
        s('text', { x: xs(run.live_blk_s) + 6, y: y + 9, fill: col, 'font-size': 10, text: fmt.n(run.live_blk_s, 1) })), html));
    if (run.synthetic_blk_s > 0) replaySvg.append(hover(s('rect', { x: L, y: y + 14, width: xs(run.synthetic_blk_s) - L, height: 7, rx: 2, fill: col, opacity: 0.3, class: 'val-synthetic' }), html));
    replaySvg.append(hover(s('rect', { x: ML, y: y + 2, width: mins(run.min_per_mainnet_day_live) - ML, height: 14, rx: 2, fill: COL.green, opacity: 0.75, class: 'val-mainnet' }), html),
      hover(s('a', { class: 'num', href: new URL(FILE, ctx.base).href, target: '_blank', rel: 'noopener' },
        s('text', { x: mins(run.min_per_mainnet_day_live) + 7, y: y + 13, fill: COL.green, 'font-size': 11, text: `${fmt.n(run.min_per_mainnet_day_live, 1)} min` })), html));
  });
  root.append(h('div', { class: 'scroll val-replay' }, h('div', {}, replaySvg)));

  const migrating = Object.fromEntries(clients.filter((c) => c !== 'erigon').map((client) => [client, hosts.filter((host) => clientOf(host) === client)
    .map((host) => data.grid[host]).filter((g) => g.migrating && g['two trees']).map((g) => 100 * (g.migrating.ms_per_mgas / g['two trees'].ms_per_mgas - 1))]));
  const erigon = hosts.filter((host) => clientOf(host) === 'erigon').map((host) => data.grid[host]['two trees'].ms_per_mgas / data.grid[host]['one tree'].ms_per_mgas - 1);
  const ratios = (client) => hosts.filter((host) => clientOf(host) === client).map((host) => data.ratio[host].ratio);
  const lines = (items) => items.map((item) => h('span', { class: 'val-stat-line' }, item));
  root.append(strip([
    { label: 'migrating / two trees', value: num(`+${range(Object.values(migrating).flat(), 0)} %`, FILE, 'c0_states'),
      note: lines(Object.entries(migrating).map(([client, values]) => [NAME[client], ' ', num(`+${range(values, 0)} %`, FILE, 'c0_states')])), },
    { label: 'two trees / one tree', value: num(`+${range(erigon.map((v) => v * 100), 0)} %`, FILE, 'c0_states'), note: 'erigon baseline · cost per MGas' },
    { label: 'binary / two trees + load', value: num(`${range(ratios('geth'), 1)}×`, FILE, 'n2_postfork_cost'),
      note: lines(clients.map((client) => [NAME[client], ' ', num(`${range(ratios(client), 2)}×`, FILE, 'n2_postfork_cost')])) },
    { label: 'replay · live blocks / s', value: num(range(data.replay.map((r) => r.live_blk_s)), FILE, 'd4_replay_mainnet_minutes'), note: 'access-list replay, not transaction execution' },
    { label: 'a day of mainnet', value: num(`${range(data.replay.map((r) => r.min_per_mainnet_day_live))} min`, FILE, 'd4_replay_mainnet_minutes'), note: 'at the live-block rate · write-scaled estimates on hover' },
  ]));
  root.append(h('p', { class: 'reading' }, h('b', {}, 'Reading. '),
    'Building the tree adds ', num(`+${range(Object.values(migrating).flat(), 0)} %`, FILE, 'c0_states'), ' per MGas against maintaining two trees, not a pause in validation. ',
    'geth is ', num(`${range(ratios('geth'), 1)}×`, FILE, 'n2_postfork_cost'), ' slower on the binary tree today while the others are broadly as fast or faster (erigon spans ',
    num(`${range(ratios('erigon'), 2)}×`, FILE, 'n2_postfork_cost'), '). This is client work, not design.'));
}
