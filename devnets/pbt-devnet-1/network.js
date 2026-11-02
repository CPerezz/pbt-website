// Hourly health of the network: participation, finality, who was missing, and the ledger of what broke.
import {
  COL, HOSTS, avatar, clientOf, color, cursor, date, day, dayTicks, dur, fmt, h, hover, num, pct, s, scale, secHead, strip, term, vline,
} from './kit.js';

const W = 1120, X0 = 150, X1 = 1110;
const TOP = 24, RA = 110, GAP1 = 30, RB = 86, GAP2 = 22, RC = 13;
const KIND = {
  oom_kill: ['OOM kill', COL.red],
  jvm_heap_oom: ['JVM heap OOM', COL.orange],
  segv: ['SIGSEGV', COL.lilac],
  replay_stall: ['replay stall', COL.amber],
  shadow_stopped: ['shadow stopped', COL.muted],
  crash_restart: ['crash loop', COL.muted],
};
const cellColor = (v) => (v >= 0.9 ? COL.green : v >= 0.5 ? COL.amber : COL.red);

export default async function (root, ctx) {
  const net = await ctx.data('network.json');
  const file = 'network.json';
  const { hourly, totals, pause, ledger, fixes, valid_share: shares } = net;
  const sw = (col, cls = '') => h('span', { class: `sw ${cls}`, style: `background:${col}` });

  root.append(h('style', {}, `
    .net-ledger-day td { padding: 14px 8px 6px; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); border-bottom: 1px solid var(--line) }
    .net-fixes { display: flex; flex-wrap: wrap; gap: 8px 16px; margin: 14px 0 0 }
    .net-fix { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--ink2) }
    .net-fix b { font-weight: 600 }
    .net-repro { margin-top: 10px }
    .net-repro summary { cursor: pointer; color: var(--green); font-size: 12.5px; list-style: none; display: inline-flex; gap: 8px; user-select: none; margin-bottom: 10px }
    .net-repro summary::-webkit-details-marker { display: none }
    .net-repro summary::before { content: '\u25b8'; transition: transform .15s }
    .net-repro[open] summary::before { transform: rotate(90deg) }
    .net-classes td:nth-child(2) { font-size: 11px }
  `));

  root.append(secHead('The network \u00b7 what broke',
    ['Hourly ', term('participation'), ' is the share of attestations that landed in an epoch; the chain needs two thirds to finalize. ',
      term('finality', 'Finality distance'), ' counts how many epochs behind the head the last finalized checkpoint sat \u2014 2 is normal. ',
      term('missed', 'Missed slots'), ' are slots with no block, almost always costed by whichever node was down that hour.'],
    h('span', { class: 'legend' },
      h('span', {}, sw(COL.green), 'participation'), h('span', {}, sw(COL.ink2, 'thin'), 'nodes validating (right axis)'),
      h('span', {}, sw(COL.ink2), 'finality distance'), h('span', {}, sw(COL.red), '> 2 epochs'),
      h('span', {}, sw(COL.line), 'missed slots'),
      h('span', {}, sw(COL.green), '\u2265 90 % VALID'), h('span', {}, sw(COL.amber), '50\u201390 %'), h('span', {}, sw(COL.red), '< 50 %'))));

  const t0h = hourly[0].t, t1h = hourly[hourly.length - 1].t;
  const xs = scale(t0h, t1h, X0, X1);
  const hourW = (X1 - X0) / hourly.length;

  const yA0 = TOP, yA1 = TOP + RA;
  const yB0 = yA1 + GAP1, yB1 = yB0 + RB;
  const yC0 = yB1 + GAP2, yC1 = yC0 + RC * HOSTS.length;
  const TOTAL_H = yC1 + 28;

  const scaleP = scale(0, 1, yA1, yA0);
  const scaleV = scale(0, 9, yA1, yA0);
  const lagMax = Math.max(6, Math.max(...hourly.map((r) => r.finality_lag)) + 1);
  const missedMax = Math.max(20, Math.max(...hourly.map((r) => r.missed)) * 1.08);
  const scaleLag = scale(0, lagMax, yB1, yB0);
  const scaleMissed = scale(0, missedMax, yB1, yB0);

  const svg = s('svg', { viewBox: `0 0 ${W} ${TOTAL_H}`, style: 'width:100%;display:block;overflow:visible' });

  dayTicks(svg, xs, t0h, t1h, TOP - 6, yC1);
  vline(svg, xs(ctx.XEN), TOP - 10, yC1, COL.amber, 'XEN load');
  vline(svg, xs(ctx.FORK), TOP - 10, yC1, COL.red, 'fork');

  // Pause: a faint wash across all three bands, a bracket above band A, one hover with the full story.
  const px0 = xs(pause.from), px1 = xs(pause.to), pauseDur = pause.to - pause.from;
  svg.append(s('rect', { x: px0, y: TOP, width: Math.max(px1 - px0, 2), height: yC1 - TOP, fill: COL.red, opacity: 0.07, style: 'pointer-events:none' }));
  svg.append(
    s('line', { x1: px0, x2: px1, y1: TOP - 14, y2: TOP - 14, stroke: COL.red, 'stroke-width': 1.3 }),
    s('line', { x1: px0, x2: px0, y1: TOP - 14, y2: TOP - 8, stroke: COL.red, 'stroke-width': 1.3 }),
    s('line', { x1: px1, x2: px1, y1: TOP - 14, y2: TOP - 8, stroke: COL.red, 'stroke-width': 1.3 }),
    s('text', { x: (px0 + px1) / 2, y: TOP - 18, 'text-anchor': 'middle', 'font-size': 9.5, fill: COL.red, text: `finality paused \u00b7 ${fmt.hm(pauseDur)}` }));
  svg.append(hover(s('rect', { x: px0 - 4, y: TOP - 20, width: Math.max(px1 - px0 + 8, 10), height: 24, fill: 'transparent', style: 'cursor:help' }),
    `<b>finality paused</b><br>${date(pause.from)} \u2192 ${date(pause.to)} UTC \u00b7 <b>${fmt.hm(pauseDur)}</b><br>${pause.epochs} epochs behind \u00b7 participation down to ${pct(pause.participation_min)}<br>${pause.validating} / 9 validating \u00b7 down: ${pause.down.join(', ')}`));

  // Band A: participation (left axis, 0-100 %) and nodes validating (right axis, 0-9, grey steps).
  svg.append(s('text', { x: 0, y: yA0 - 8, 'font-size': 10, fill: COL.muted, text: 'participation \u00b7 nodes validating' }));
  svg.append(
    s('text', { x: X0 - 8, y: yA0 + 3, 'text-anchor': 'end', 'font-size': 9, fill: COL.muted, text: '100 %' }),
    s('text', { x: X0 - 8, y: yA1 + 3, 'text-anchor': 'end', 'font-size': 9, fill: COL.muted, text: '0 %' }),
    s('text', { x: X1 + 8, y: yA0 + 3, 'font-size': 9, fill: COL.muted, text: '9' }),
    s('text', { x: X1 + 8, y: yA1 + 3, 'font-size': 9, fill: COL.muted, text: '0' }));
  const y23 = scaleP(2 / 3);
  svg.append(s('line', { x1: X0, x2: X1, y1: y23, y2: y23, stroke: COL.line, 'stroke-dasharray': '2 4' }),
    s('text', { x: X0 + 4, y: y23 - 3, 'font-size': 9, fill: COL.muted, text: '2/3' }));

  let dp = '';
  for (const r of hourly) {
    if (r.participation == null) continue;
    dp += (dp ? ' L ' : 'M ') + xs(r.t) + ' ' + scaleP(r.participation);
  }
  svg.append(s('path', { d: dp, fill: 'none', stroke: COL.green, 'stroke-width': 1.5 }));

  let dv = '';
  hourly.forEach((r, i) => {
    const x = xs(r.t), y = scaleV(r.validating);
    dv += i === 0 ? `M ${x} ${y}` : ` H ${x} V ${y}`;
  });
  dv += ` H ${xs(t1h + 3600)}`;
  svg.append(s('path', { d: dv, fill: 'none', stroke: COL.ink2, 'stroke-width': 1.2, opacity: 0.8 }));

  for (const r of hourly) {
    const x = xs(r.t), w = Math.max(hourW - 0.5, 1);
    svg.append(hover(s('rect', { x, y: yA0, width: w, height: RA, fill: 'transparent', style: 'cursor:help' }),
      `<b>${date(r.t)} UTC</b><br>participation ${pct(r.participation)} \u00b7 ${r.validating} / 9 validating`));
  }

  // Band B: finality distance (bars, red above 2) with missed slots per hour dim behind.
  svg.append(s('text', { x: 0, y: yB0 - 8, 'font-size': 10, fill: COL.muted, text: 'finality distance (epochs) \u00b7 missed slots' }));
  const y2ep = scaleLag(2);
  svg.append(s('line', { x1: X0, x2: X1, y1: y2ep, y2: y2ep, stroke: COL.line, 'stroke-dasharray': '2 4' }),
    s('text', { x: X0 + 4, y: y2ep - 3, 'font-size': 9, fill: COL.muted, text: '2 epochs' }));

  for (const r of hourly) {
    const x = xs(r.t), w = Math.max(hourW - 1, 1);
    const my = scaleMissed(r.missed);
    svg.append(s('rect', { x, y: my, width: w, height: yB1 - my, fill: COL.line, opacity: 0.55 }));
    const ly = scaleLag(r.finality_lag), lw = Math.max(w * 0.55, 1), lx = x + (w - lw) / 2;
    svg.append(s('rect', { x: lx, y: ly, width: lw, height: yB1 - ly, fill: r.finality_lag > 2 ? COL.red : COL.ink2 }));
    svg.append(hover(s('rect', { x, y: yB0, width: w, height: RB, fill: 'transparent', style: 'cursor:help' }),
      `<b>${date(r.t)} UTC</b><br>finality ${r.finality_lag} epoch${r.finality_lag === 1 ? '' : 's'} behind \u00b7 ${r.missed} missed slots`));
  }

  // Band C: VALID share per node per hour.
  svg.append(s('text', { x: 0, y: yC0 - 8, 'font-size': 10, fill: COL.muted, text: 'VALID share per node' }));
  HOSTS.forEach((host, i) => {
    const y = yC0 + i * RC, col = color(host);
    svg.append(s('text', { x: 0, y: y + RC - 3, 'font-size': 9.5, 'font-weight': 600, fill: col, text: host }));
    for (const [t, v] of shares[host] ?? []) {
      const x = xs(t), w = Math.max(hourW - 0.5, 1);
      svg.append(hover(s('rect', { x, y: y + 1, width: w, height: RC - 2, fill: cellColor(v) }),
        `<b>${host}</b> \u00b7 ${date(t)} UTC<br>VALID ${pct(v)} of the hour's blocks`));
    }
  });

  cursor(svg, ctx.clock, xs, ctx.T0, TOP - 10, yC1);
  root.append(h('div', { class: 'scroll' }, h('div', {}, svg)));

  // Readout at the cursor (the clock controls live on the timeline section).
  const readout = h('div', { class: 'muted', style: 'font-size:11.5px;margin:6px 0 0' });
  root.append(readout);
  ctx.clock.on((v) => {
    const t = ctx.T0 + v;
    const idx = Math.max(0, Math.min(hourly.length - 1, Math.round((t - t0h) / 3600)));
    const r = hourly[idx];
    const down = HOSTS.filter((host) => (shares[host]?.[idx]?.[1] ?? 1) < 0.5);
    readout.textContent = `${date(r.t)} UTC \u2014 participation ${pct(r.participation)} \u00b7 ${r.validating} / 9 validating \u00b7 finality ${r.finality_lag} epochs \u00b7 ${r.missed} missed${down.length ? ` \u00b7 down: ${down.join(', ')}` : ''}`;
  });

  // Failure classes: one row per kind, always visible, each matched to the nearest fix per host.
  const nearestFix = (host, t) => fixes.filter((f) => f.host === host && f.t >= t).sort((a, b) => a.t - b.t)[0];
  const recRange = (list) => {
    const rec = list.map((e) => e.recovery_s).filter((v) => v != null);
    if (!rec.length) return '\u2014';
    const lo = Math.min(...rec), hi = Math.max(...rec);
    return lo === hi ? dur(lo) : `${dur(lo)}\u2013${dur(hi)}`;
  };
  const classRows = Object.keys(KIND).map((kind) => {
    const events = ledger.filter((e) => e.kind === kind);
    if (!events.length) return null;
    const byHost = new Map();
    for (const e of events) { if (!byHost.has(e.host)) byHost.set(e.host, []); byHost.get(e.host).push(e); }
    const nodes = HOSTS.filter((host) => byHost.has(host));
    const matchedFixes = nodes.map((host) => nearestFix(host, Math.min(...byHost.get(host).map((e) => e.t)))).filter(Boolean);
    return { kind, nodes, byHost, events, matchedFixes };
  }).filter(Boolean);

  root.append(h('div', { class: 'lbl', style: 'margin:30px 0 10px' }, 'Failure classes'));
  root.append(h('table', { class: 'ledger net-classes' },
    h('thead', {}, h('tr', {}, h('th', {}, 'class'), h('th', {}, 'nodes'), h('th', {}, 'count'), h('th', {}, 'back to VALID'), h('th', {}, 'fix'))),
    h('tbody', {}, ...classRows.map(({ kind, nodes, byHost, events, matchedFixes }) => {
      const [kLabel, kCol] = KIND[kind];
      return h('tr', {},
        h('td', {}, h('span', { class: 'dot', style: `background:${kCol}` }), ' ', kLabel),
        h('td', {}, nodes.map((host, i) => [i ? ', ' : '', h('span', { style: `color:${color(host)}` }, host), ` \u00d7${byHost.get(host).length}`])),
        h('td', {}, String(events.length)),
        h('td', {}, recRange(events)),
        h('td', {}, matchedFixes.length
          ? matchedFixes.map((f, i) => [i ? ' ' : '', f.url ? h('a', { class: 'chip', href: f.url, target: '_blank', rel: 'noopener' }, f.label) : h('span', { class: 'chip' }, f.label)])
          : '\u2014'));
    }))));

  // Full ledger, collapsible: grouped by day, consecutive same-kind events per node-day collapsed into one row.
  const buildLabel = (note) => { const m = /\(([^)]+)\)$/.exec(note); return m && m[1] !== 'nan' ? m[1] : null; };
  const DROP_NOTE = new Set(['oom_kill', 'jvm_heap_oom']);
  const byDay = new Map();
  for (const e of ledger) {
    const k = day(e.t);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(e);
  }
  const rows = [];
  for (const dKey of [...byDay.keys()].sort()) {
    const events = byDay.get(dKey).sort((a, b) => a.t - b.t);
    const groups = new Map();
    for (const e of events) {
      const key = `${e.host}|${e.kind}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(e);
    }
    const grouped = [...groups.values()].sort((a, b) => a[0].t - b[0].t);
    rows.push({ heading: dKey }, ...grouped.map((list) => ({ list })));
  }

  const tbody = h('tbody');
  let rowCount = 0;
  for (const row of rows) {
    if (row.heading) { tbody.append(h('tr', { class: 'net-ledger-day' }, h('td', { colspan: 5 }, row.heading))); continue; }
    rowCount++;
    const { list } = row, first = list[0], n = list.length;
    const [kLabel, kCol] = KIND[first.kind] ?? [first.kind, COL.muted];
    const recText = recRange(list);
    const when = n > 1 ? `${date(first.t)} \u2192 ${date(list[n - 1].t).slice(6)}` : date(first.t);
    let note;
    if (first.kind === 'crash_restart') {
      const build = buildLabel(list[n - 1].note);
      note = `${n} crash-loop restart${n === 1 ? '' : 's'}${build ? ` \u00b7 ${build}` : ''}`;
    } else if (DROP_NOTE.has(first.kind)) {
      note = n > 1 ? `${n} ${kLabel}s \u00b7 back to VALID in ${recText} each` : '';
    } else {
      note = n > 1 ? `${n} ${kLabel} events \u00b7 ${list[n - 1].note}` : first.note;
    }
    tbody.append(h('tr', {},
      h('td', {}, h('span', { class: 'dot', style: `background:${kCol}` }), ' ', kLabel),
      h('td', {}, avatar(clientOf(first.host), 14), ' ', h('b', { style: `color:${color(first.host)}` }, first.host)),
      h('td', {}, when),
      h('td', {}, recText),
      h('td', { style: 'font-size:11px;color:var(--ink2)' }, note)));
  }
  root.append(h('details', { class: 'net-repro' },
    h('summary', {}, `Every event, by day \u00b7 ${rowCount} rows`),
    h('table', { class: 'ledger' },
      h('thead', {}, h('tr', {}, h('th', {}, 'kind'), h('th', {}, 'node'), h('th', {}, 'when'), h('th', {}, 'back to VALID'), h('th', {}, 'note'))),
      tbody)));

  root.append(h('div', { class: 'lbl', style: 'margin:20px 0 0' }, 'Fixes'));
  root.append(h('div', { class: 'net-fixes' }, ...fixes.map((f) => h('div', { class: 'net-fix' },
    h('span', {}, date(f.t)), '\u00b7', avatar(clientOf(f.host), 13), h('b', { style: `color:${color(f.host)}` }, f.host), '\u00b7',
    f.url ? h('a', { class: 'chip', href: f.url, target: '_blank', rel: 'noopener' }, f.label) : h('span', {}, f.label)))));

  root.append(strip([
    { label: 'slots missed', value: num(`${fmt.n(totals.missed)} / ${fmt.n(totals.slots)}`, file, 'h1_network_hourly'), note: `${pct(totals.missed / totals.slots)} of all slots` },
    { label: 'hours with a node down', value: num(pct(totals.missed_share_node_down), file, 'h2_node_hourly'), note: `of missed slots \u00b7 r = ${totals.corr}` },
    { label: 'missed, all nine up', value: num(String(totals.missed_all_up), file, 'h1_network_hourly'), note: 'slots, not a node-down hour' },
    { label: 'reorgs seen by > 2 sentries', value: num(String(totals.network_reorgs), file, 'h4_finality_network'), note: `${fmt.n(totals.sentry_reorgs)} sentry-only events` },
    { label: 'finality pauses', value: num(`1 \u00b7 ${fmt.hm(pauseDur)}`, file, 'h4_finality_network'), note: `${pause.validating} / 9 validating, ${pause.down.length} down` },
  ]));

  root.append(h('p', { class: 'reading' }, h('b', {}, 'Reading. '),
    'The ', num(String(ledger.length), file, 'failures'), ' lines in the ledger are plumbing around the migration, not a migration failure: no wrong root, no lost state, and every replay resumed on its own \u2014 ',
    num(`${fixes.length} fixes`, file, 'k2_recovery'), ' shipped during the nine days. The only finality pause, ', num(fmt.hm(pauseDur), file, 'h4_finality_network'),
    ', came from ', num(String(pause.down.length), file, 'h4_finality_network'), ' nodes (', pause.down.join(', '), ') down together on fork day.'));
}
