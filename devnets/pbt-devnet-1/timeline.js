// Nine days on one clock: every node's migration, its failures, the fork, and the single tree after it.
import { COL, color, cursor, date, dayControls, dayTicks, dur, fmt, h, hatch, hover, nodeLabel, num, s, scale, secHead, strip, term, vline } from './kit.js';

const W = 1120, X0 = 150, X1 = 1110, TOP = 26, RH = 50;
const KIND = {
  oom_kill: ['OOM kill', COL.red], jvm_heap_oom: ['JVM heap exhausted', COL.orange], segv: ['SIGSEGV', COL.lilac],
  replay_stall: ['replay stalled', COL.amber], crash_loop: ['crash loop', COL.muted],
};

export default async function (root, ctx) {
  const tl = await ctx.data('timeline.json');
  const { clock, T0 } = ctx;
  const t1 = tl.t1, xs = scale(tl.t0, t1, X0, X1);
  const H = TOP + RH * tl.lanes.length + 30;
  const sw = (col, cls = '') => h('span', { class: `sw ${cls}`, style: `background:${col}` });

  root.append(secHead('Nine days, nine nodes',
    ['One lane per node, UTC. A node builds and verifies its binary tree (solid), ', term('replay', 'replays'), ' the blocks the chain produced meanwhile (hatched), then follows with ',
      term('twotrees', 'two trees'), ' (thin line) until the ', term('fork', 'fork'), ', after which one tree remains (green). Red strips are hours in which the node answered fewer than half the blocks; dots are failures, triangles new builds. Press play, or hover anything.'],
    h('span', { class: 'legend' }, h('span', {}, sw(COL.ink2), 'build + verify'), h('span', {}, sw('repeating-linear-gradient(45deg,rgba(226,230,226,.25),rgba(226,230,226,.25) 2px,rgba(226,230,226,.8) 2px,rgba(226,230,226,.8) 3px)'), 'replay'),
      h('span', {}, sw(COL.ink2, 'thin'), 'two trees'), h('span', {}, sw(COL.green, 'thin'), 'one tree'), h('span', {}, sw(COL.red), 'not validating'))));

  // Live readout next to the controls: how many nodes are validating / migrating at the cursor.
  const live = h('span', { class: 'muted', style: 'font-size:12px;min-width:220px' });
  root.append(h('div', { class: 'row', style: 'align-items:center;gap:18px;margin-bottom:14px' }, h('div', { style: 'flex:1;min-width:320px' }, dayControls(clock, T0)), live));
  clock.on((v) => {
    const t = T0 + v;
    const validating = tl.lanes.filter((l) => !l.down_hours.some((hr) => t >= hr && t < hr + 3600)).length;
    const migrating = tl.lanes.filter((l) => l.runs.some((r) => r.status === 'valid' && t >= r.start && t < (r.synced ?? r.complete ?? r.start))).length;
    live.textContent = `${validating} of ${tl.lanes.length} validating · ${migrating} migrating${t >= tl.fork_t ? ' · after the fork' : t >= tl.xen_t ? ' · XEN load' : ''}`;
  });

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, style: 'width:100%;display:block;overflow:visible' });
  svg.append(s('defs', null, hatch('tl-hatch', COL.ink2)));
  dayTicks(svg, xs, tl.t0, t1, TOP - 6, TOP + RH * tl.lanes.length);
  vline(svg, xs(tl.xen_t), TOP - 12, TOP + RH * tl.lanes.length, COL.amber, 'XEN load');
  vline(svg, xs(tl.fork_t), TOP - 12, TOP + RH * tl.lanes.length, COL.red, 'fork');

  const file = 'timeline.json';
  const tip = (title, lines) => `<b>${title}</b><br>${lines.filter(Boolean).join('<br>')}`;
  tl.lanes.forEach((l, i) => {
    const y = TOP + i * RH, col = color(l.host), mid = y + RH / 2;
    nodeLabel(svg, 0, mid + 4, l.host);
    svg.append(s('text', { x: 118, y: mid + 4, 'font-size': 10, fill: COL.muted, text: `${l.cap_gib}G` }));
    svg.append(s('line', { x1: X0, x2: X1, y1: mid, y2: mid, stroke: COL.line }));

    // Hours not validating: a red strip along the bottom of the lane.
    for (const hr of l.down_hours) {
      svg.append(hover(s('rect', { x: xs(hr), y: y + RH - 9, width: Math.max(xs(Math.min(hr + 3600, t1)) - xs(hr), 1), height: 5, fill: COL.red, opacity: 0.6 }),
        tip('not validating', [`${date(hr)}–${date(hr + 3600).slice(6)} UTC`, 'answered VALID for fewer than half the hour\u2019s blocks'])));
    }
    // Runs: valid = solid build + hatched replay + label; failed / superseded = an outlined attempt.
    const valid = l.runs.filter((r) => r.status === 'valid').sort((a, b) => a.start - b.start);
    for (const r of l.runs) {
      const a = r.start, b = r.complete ?? r.synced ?? r.start, c = r.synced ?? b;
      const name = r.method === 'self' ? 'self-conversion' : 'snapshot import';
      if (r.status !== 'valid') {
        svg.append(hover(s('rect', { x: xs(a), y: mid - 8, width: Math.max(xs(b) - xs(a), 2), height: 16, fill: 'none', stroke: col, 'stroke-dasharray': '2 2', opacity: 0.7 }),
          tip(`${name} · ${r.status} attempt`, [`started ${date(a)}`, r.complete ? `stopped ${date(r.complete)}` : null, 'not counted: superseded by a later run'])));
        continue;
      }
      svg.append(hover(s('rect', { x: xs(a), y: mid - 10, width: Math.max(xs(b) - xs(a), 2), height: 20, fill: col, rx: 2 }),
        tip(`${name} · build + verify`, [`${date(a)} → ${date(b)}`, `<b>${dur(b - a)}</b> to a verified tree`])));
      svg.append(hover(s('rect', { x: xs(b), y: mid - 7, width: Math.max(xs(c) - xs(b), 1), height: 14, fill: 'url(#tl-hatch)', stroke: col, 'stroke-width': 0.6 }),
        tip(`${name} · replay`, [`${date(b)} → ${date(c)}`, `<b>${dur(c - b)}</b> replaying to the head`, `at the head <b>${dur(r.t_total_s ?? c - a)}</b> after the start`])));
      const nxt = Math.min(...valid.filter((o) => o.start > c).map((o) => o.start), tl.fork_t);
      svg.append(hover(s('rect', { x: xs(c), y: mid - 1.5, width: Math.max(xs(nxt) - xs(c), 0), height: 3, fill: col, opacity: 0.55 }),
        tip('two trees', [`${date(c)} → ${date(nxt)}`, 'maintaining the MPT and the binary tree on every block'])));
      svg.append(s('text', { x: xs(c) + 5, y: mid - 5, 'font-size': 9.5, fill: COL.ink, text: `${r.method === 'self' ? 'self' : 'import'} ${dur(r.t_total_s ?? c - a)}` }));
    }
    if (l.dual_from) {
      svg.append(hover(s('rect', { x: xs(l.dual_from), y: mid - 1.5, width: xs(tl.fork_t) - xs(l.dual_from), height: 3, fill: col, opacity: 0.55 }),
        tip('dual commitment', [`from ${date(l.dual_from)}`, 'erigon keeps a binary commitment next to its hexary one by design'])));
      svg.append(s('text', { x: xs(l.dual_from) + 5, y: mid - 5, 'font-size': 9.5, fill: COL.muted, text: 'two trees (hex + bin)' }));
    }
    svg.append(hover(s('rect', { x: xs(tl.fork_t), y: mid - 1.5, width: xs(t1) - xs(tl.fork_t), height: 3, fill: COL.green, opacity: 0.8 }),
      tip('one tree', [`from the fork, ${date(tl.fork_t)}`, 'the MPT is disposed of once the fork is final'])));
    // Builds and failures.
    for (const b of l.builds ?? []) {
      svg.append(hover(s('path', { d: `M${xs(b.t)} ${mid - 24} l4 7 h-8 z`, fill: COL.muted, opacity: 0.9 }), tip('new build', [date(b.t), `<code>${b.sha}</code>${b.label ? ` · ${b.label}` : ''}`])));
    }
    for (const e of l.events ?? []) {
      const [label, kcol] = KIND[e.kind] ?? [e.kind, COL.muted];
      const el = e.kind === 'crash_loop'
        ? s('rect', { x: xs(e.t) - 1, y: mid - 24, width: 2, height: 8, fill: kcol })
        : s('circle', { cx: xs(e.t), cy: mid - 20, r: 3.2, fill: kcol, stroke: COL.bg, 'stroke-width': 1 });
      svg.append(hover(el, tip(label, [`${date(e.t)} UTC`, e.recovered_t ? `answering VALID again after <b>${dur(e.recovered_t - e.t)}</b>` : null, e.note])));
    }
  });
  cursor(svg, clock, xs, T0, TOP - 6, TOP + RH * tl.lanes.length);
  root.append(h('div', { class: 'scroll' }, h('div', {}, svg)));

  // Numbers.
  const runs = tl.lanes.flatMap((l) => l.runs.filter((r) => r.status === 'valid'));
  const n16 = runs.filter((r) => tl.lanes.find((l) => l.host === r.run_id.split('/')[0]).cap_gib === 16).length;
  const events = tl.lanes.flatMap((l) => l.events ?? []);
  const fails = events.filter((e) => e.kind !== 'crash_loop');
  const n = (k) => fails.filter((e) => e.kind === k).length;
  const downH = tl.lanes.reduce((a, l) => a + l.down_hours.length, 0);
  root.append(strip([
    { label: 'migrations counted', value: num(String(runs.length), file, 'a1_runs'), note: `${n16} on 16 GiB, ${runs.length - n16} on 32 GiB; two nodes migrated twice` },
    { label: 'dual commitments', value: num(String(tl.lanes.filter((l) => l.dual_from).length), file, 'c0_states'), note: 'erigon-1 and erigon-2, both trees from 10-25' },
    { label: 'failures', value: num(String(fails.length), file, 'k1_failures'), note: `${n('oom_kill')} OOM kills · ${n('jvm_heap_oom')} JVM heap · ${n('segv')} SIGSEGV · ${n('replay_stall')} stalls; ${events.length - fails.length} crash-loop restarts` },
    { label: 'node-hours not validating', value: num(String(downH), file, 'h2_node_hourly'), note: `of ${fmt.n(tl.lanes.length * Math.round((t1 - tl.t0) / 3600))} node-hours · ${fmt.n(100 * downH / (tl.lanes.length * (t1 - tl.t0) / 3600), 1)} %` },
    { label: 'crossed the fork', value: num(`${tl.lanes.length} / ${tl.lanes.length}`, file, 'n1_fork'), note: `on one root, ${date(tl.fork_t)} UTC` },
  ]));
  root.append(h('p', { class: 'reading' },
    h('b', {}, 'Reading. '), 'geth and Nethermind migrated on day one, Besu on 10-23; nethermind-1 and besu-1 did it a second time on 10-27, self-converting under the ', term('xen', 'XEN load'),
    '. Day one\u2019s dashed outlines are first attempts on early builds. The red after the fork is the two 16 GiB geths (OOM-killed four minutes in, back after 3h40m), geth-2 (26 h, recovered on a new start-up path) and the erigons (stalled for an hour); the migrations themselves left no red.'));
}
