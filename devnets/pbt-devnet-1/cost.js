// Whole-node resources, memory on the shared clock, and the disk cost of the counted runs.
import { CLIENT, COL, HOSTS, NAME, avatar, clientOf, color, cursor, date, dayControls, dayTicks, dur, fmt, h, hatch, hover, nearest, num, pct, s, scale, secHead, strip, term, vline } from './kit.js';

const FILE = 'cost.json', RESOURCE = 'resources · c0_states';
const range = (xs, digits = 1) => `${fmt.n(Math.min(...xs), digits)}–${fmt.n(Math.max(...xs), digits)}`;
const dash = ['', '6 3', '2 3'];
// nearest() returns the first sample at or after t; compare its predecessor for the closest peak.
function sampleAt(rows, t) {
  if (!rows.length || t < rows[0][0] || t > rows[rows.length - 1][0] + 600) return null;
  let i = nearest(rows, t);
  if (i && t - rows[i - 1][0] < rows[i][0] - t) i--;
  return Math.abs(rows[i][0] - t) <= 600 ? rows[i] : null;
}
const capAt = (mem, t) => mem.cap_changes.reduce((cap, [at, next]) => at <= t ? next : cap, mem.cap_gib);

export default async function (root, ctx) {
  const cost = await ctx.data(FILE), { dev, clock, T0, T1, FORK, XEN } = ctx;
  const hosts = HOSTS.filter((host) => cost.machines[host]);
  const n = (text, view = RESOURCE, attrs = {}) => num(text, FILE, view, attrs);
  const sn = (svg, text, x, y, width, view = RESOURCE, col = COL.ink2) => svg.append(
    s('foreignObject', { x, y: y - 12, width, height: 19 }, n(text, view, { style: `font-size:10px;white-space:nowrap;color:${col}` })));
  root.append(h('style', {}, `
    #cost .cost-sub { margin:26px 0 10px; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap }
    #cost .cost-grid { display:grid; grid-template-columns:145px repeat(${cost.states.length},minmax(0,1fr)); min-width:1040px; gap:3px; align-items:stretch }
    #cost .cost-host { display:flex; align-items:center; gap:7px; font-size:11px; padding-right:8px }
    #cost .cost-gauges { padding:7px 8px; display:grid; grid-template-columns:1fr 1fr; gap:5px 9px; background:rgba(226,230,226,.025); border-bottom:1px solid rgba(226,230,226,.045) }
    #cost .cost-gauge { min-width:0; font-size:9.5px; line-height:1.3 }
    #cost .cost-gauge > span { display:flex; justify-content:space-between; gap:3px }
    #cost .cost-track { height:3px; margin-top:2px; background:rgba(226,230,226,.09); border-radius:2px; overflow:hidden }
    #cost .cost-track i { display:block; height:100% }
    #cost .cost-none { display:flex; align-items:center; justify-content:center; color:var(--muted) }
    #cost .cost-memory .panel { min-width:0; padding:12px }
    #cost .cost-memory .scroll > div { min-width:460px }
    #cost .cost-readouts { display:flex; flex-wrap:wrap; gap:5px 16px; min-height:43px; margin-top:6px; font-size:10px }
    #cost .cost-readout { display:flex; align-items:center; gap:6px; white-space:nowrap }
    #cost .cost-note { color:var(--muted); font-size:11px; line-height:1.5; margin:9px 0 0 }
    #cost .cost-disk > div { min-width:1040px }
    #cost .strip { grid-template-columns:repeat(4,minmax(0,1fr)) }
    #cost .stat .big { font-size:27px }
    @media (max-width:760px) {
      #cost .cost-memory { grid-template-columns:1fr }
      #cost .strip { grid-template-columns:repeat(2,minmax(0,1fr)) }
      #cost .stat .big { font-size:25px }
    }
  `));
  root.append(secHead('What the machines did', [
    'For each node and state: busy cores out of ', num(String(dev.hosts.vcpu), 'devnet.json', 'hosts'),
    ', disk-busy share, time waiting on IO, and ', term('anon', 'anonymous memory'), ' as a share of the ', term('cap', 'cap'),
    '. The grid summarizes time in each state; the memory peaks below follow the shared clock, and the disk bars separate space occupied from bytes written.'
  ]));

  const legend = h('div', { class: 'legend', style: 'margin-bottom:10px' },
    h('span', {}, 'C · busy cores'), h('span', {}, 'D · disk busy'), h('span', {}, 'I · IO wait'),
    h('span', {}, 'M · memory p95'), h('span', { style: `color:${COL.red}` }, 'memory ≥ ', n(pct(0.9))),
    h('span', { class: 'muted' }, 'OOM minutes excluded · · = no state samples'));
  const grid = h('div', { class: 'cost-grid', role: 'table', 'aria-label': 'Whole-node resources by host and state' },
    h('div', { class: 'hdr', style: 'text-align:left' }, 'node / initial cap'),
    ...cost.states.map((state) => h('div', { class: 'hdr' }, state)));
  const gauge = (label, value, share, col) => h('div', { class: 'cost-gauge' },
    h('span', {}, h('span', { class: 'muted' }, label), n(value)),
    h('div', { class: 'cost-track' }, h('i', { style: `width:${Math.min(1, Math.max(0, share)) * 100}%;background:${col}` })));
  for (const host of hosts) {
    const mem = cost.memory[host], col = color(host);
    grid.append(h('div', { class: 'cost-host' }, avatar(clientOf(host), 15), h('span', { style: `color:${col}` }, host),
      n(`${mem.cap_gib}G`, 'resources', { style: 'color:var(--muted);font-size:10px' })));
    for (const state of cost.states) {
      const r = cost.machines[host][state];
      if (!r) { grid.append(h('div', { class: 'cost-none', 'aria-label': `${host}, ${state}: no samples` }, '·')); continue; }
      grid.append(hover(h('div', { class: 'cost-gauges', role: 'cell', 'aria-label': `${host}, ${state}` },
        gauge('C', `${fmt.n(r.cpu_cores, 1)} c`, r.cpu_cores / dev.hosts.vcpu, col),
        gauge('D', pct(r.disk_busy), r.disk_busy, col),
        gauge('I', pct(r.io_wait), r.io_wait, COL.amber),
        gauge('M', pct(r.mem_p95), r.mem_p95, r.mem_p95 >= 0.9 ? COL.red : col)),
      `<b style="color:${col}">${host} · ${state}</b><br>${fmt.n(r.cpu_cores, 1)} of ${dev.hosts.vcpu} cores busy<br>` +
      `${pct(r.disk_busy)} disk busy · ${pct(r.io_wait)} IO wait<br>${pct(r.mem_p95)} memory p95 / cap<br>` +
      `${dur(r.hours * 3600)} in this state · OOM minutes excluded`));
    }
  }
  root.append(legend, h('div', { class: 'scroll' }, grid));

  const liveDate = n('', 'resources', { class: 'num lbl' });
  root.append(h('div', { class: 'cost-sub' }, h('span', { class: 'lbl' }, 'Memory / current cap · ', n('10-min peaks', 'resources')), liveDate),
    h('div', { style: 'margin-bottom:12px' }, dayControls(clock, T0)));
  clock.on((v) => { liveDate.textContent = `${date(T0 + v)} UTC`; });
  const panels = h('div', { class: 'grid3 cost-memory', style: '--n:2' });
  for (const client of ['geth', 'nethermind', 'besu', 'erigon']) {
    const members = HOSTS.filter((host) => clientOf(host) === client && cost.memory[host]);
    const W = 520, H = 232, L = 38, R = 470, TOP = 24, B = 190;
    const xs = scale(T0, T1, L, R), ys = scale(0, 1.05, B, TOP);
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, style: 'width:100%;display:block', role: 'img', 'aria-label': `${NAME[client]} memory as a share of the current cap` });
    dayTicks(svg, xs, T0, T1, TOP, B, false);
    for (let t = (Math.floor(T0 / 86400) + 1) * 86400; t <= T1; t += 86400) sn(svg, date(t).slice(0, 5), xs(t) - 15, B + 30, 34, 'resources', COL.muted);
    for (const value of [0, 0.5, 1]) {
      svg.append(s('line', { x1: L, x2: R, y1: ys(value), y2: ys(value), stroke: COL.line }));
      sn(svg, pct(value), 0, ys(value) + 5, 38, 'resources', COL.muted);
    }
    for (const [value, col] of [[0.85, COL.amber], [0.95, COL.red]]) {
      svg.append(s('line', { x1: L, x2: R, y1: ys(value), y2: ys(value), stroke: col, opacity: 0.6, 'stroke-dasharray': '4 4' }));
      sn(svg, pct(value), R + 5, ys(value) + 5, 44, 'resources', col);
    }
    vline(svg, xs(XEN), TOP - 5, B, COL.amber, 'XEN load');
    vline(svg, xs(FORK), TOP - 5, B, COL.red, 'fork');
    const readouts = h('div', { class: 'cost-readouts' }), updates = [];
    members.forEach((host, index) => {
      const mem = cost.memory[host], rows = mem.series.filter(([t]) => t >= T0 && t <= T1), col = CLIENT[client];
      const paths = ['', ''];
      let last = null, lastPart = -1;
      for (const row of rows) {
        const part = mem.counted_from != null && row[0] < mem.counted_from ? 0 : 1;
        const connect = last && row[0] - last[0] <= 1800;
        if (connect && part !== lastPart) paths[part] += `M${xs(last[0]).toFixed(1)},${ys(last[1]).toFixed(1)}`;
        paths[part] += `${connect && (part === lastPart || paths[part]) ? 'L' : 'M'}${xs(row[0]).toFixed(1)},${ys(row[1]).toFixed(1)}`;
        last = row; lastPart = part;
      }
      paths.forEach((d, part) => svg.append(s('path', { d, fill: 'none', stroke: col, 'stroke-width': 1.5, opacity: part ? 0.95 : 0.2, 'stroke-dasharray': dash[index], 'stroke-linejoin': 'round' })));
      for (const t of mem.oom) if (t >= T0 && t <= T1) {
        svg.append(hover(s('rect', { x: xs(t) - 1.5, y: B + 3 + index * 4, width: 3, height: 5, fill: COL.red }), `<b>${host} · OOM</b><br>${date(t)} UTC<br>memory cap exceeded`));
      }
      for (const [t, cap] of mem.cap_changes) if (t >= T0 && t <= T1) {
        const row = sampleAt(rows, t), yy = row ? ys(row[1]) : B;
        svg.append(hover(s('path', { d: `M${xs(t)} ${yy - 5} l4 5 l-4 5 l-4 -5 z`, fill: COL.bg, stroke: col, 'stroke-width': 1.2 }),
          `<b>${host} · cap → ${cap} GiB</b><br>${date(t)} UTC<br>The denominator increases: a lower fraction need not mean less memory.`));
      }
      const point = s('circle', { r: 3, fill: col, stroke: COL.bg, 'stroke-width': 1, style: 'pointer-events:none;display:none' });
      svg.append(point);
      const value = n('·', 'resources', { style: `color:${col}` });
      const lineKey = s('svg', { width: 20, height: 8 }, s('line', { x1: 0, x2: 20, y1: 4, y2: 4, stroke: col, 'stroke-width': 2, 'stroke-dasharray': dash[index] }));
      readouts.append(h('div', { class: 'cost-readout' }, lineKey, h('span', {}, host), value));
      updates.push((t) => {
        const row = sampleAt(rows, t);
        value.textContent = row ? `${pct(row[1])} / ${capAt(mem, row[0])} GiB` : '· no sample';
        point.style.display = row ? '' : 'none';
        if (row) { point.setAttribute('cx', xs(row[0])); point.setAttribute('cy', ys(row[1])); }
      });
    });
    hover(svg, (e) => {
      const rect = svg.getBoundingClientRect(), t = Math.max(T0, Math.min(T1, xs.inv((e.clientX - rect.left) / rect.width * W)));
      return `<span class="lbl">${date(t)} UTC · nearest peak</span><br>` + members.map((host) => {
        const mem = cost.memory[host], row = sampleAt(mem.series, t);
        return `<b style="color:${CLIENT[client]}">${host}</b> ${row ? `${pct(row[1])} / ${capAt(mem, row[0])} GiB · ${date(row[0])}` : '· no sample'}`;
      }).join('<br>');
    });
    cursor(svg, clock, xs, T0, TOP, B);
    clock.on((v) => updates.forEach((update) => update(T0 + v)));
    const changes = members.flatMap((host) => cost.memory[host].cap_changes);
    panels.append(h('div', { class: 'panel' }, h('div', { class: 'row', style: 'align-items:center;gap:7px' }, avatar(client, 19), h('b', { style: `color:${CLIENT[client]}` }, NAME[client])),
      h('div', { class: 'scroll' }, h('div', {}, svg)), readouts,
      h('p', { class: 'cost-note' }, changes.length ? ['Diamonds: geth restarted after the fork on ', n(`${Math.max(...changes.map(([, cap]) => cap))} GiB`, 'resources'), '; the larger cap makes the fraction drop.'] : 'Dim lines precede the counted run; red ticks mark OOMs.')));
  }
  root.append(panels, h('p', { class: 'cost-note' }, 'Solid / dashed / dotted lines distinguish nodes within a client. Gaps mean missing samples; dim lines precede the counted run, red ticks are recorded OOMs, and diamonds mark cap changes.'));

  const disk = cost.disk, runs = disk.runs;
  root.append(h('div', { class: 'cost-sub' }, h('span', { class: 'lbl' }, 'Disk per ', n(`${Math.min(...dev.nodes.map((node) => node.cap_gib))} GiB`, 'c1_run_resources'), ' run'),
    h('span', { class: 'legend' }, h('span', {}, 'solid · build + verify'), h('span', {}, 'hatched · ', term('replay', 'replay')), h('span', { style: `color:${COL.green}` }, 'green · ', term('disposal', 'disposal')))));
  const W = 1120, H = 92 + runs.length * 43, TOP = 76, B = TOP + runs.length * 43;
  const peak = scale(0, disk.eip7870_tib * 1.06, 184, 478);
  const writtenMax = Math.ceil(Math.max(...runs.map((r) => r.written_core_gib + r.written_replay_gib)) / 500) * 500;
  const written = scale(0, writtenMax, 540, 810), released = scale(0, Math.max(...runs.map((r) => r.released_gib)) * 1.08, 880, 1080);
  const diskSvg = s('svg', { viewBox: `0 0 ${W} ${H}`, style: 'width:100%;display:block', role: 'img', 'aria-label': 'Peak datadir, bytes written, and disk released for each counted run' });
  diskSvg.append(s('defs', {}, ...runs.map((r, i) => hatch(`cost-replay-${i}`, color(r.run_id.split('/')[0])))));
  for (const [x, label] of [[184, 'PEAK DATADIR · TiB'], [540, 'WRITTEN · GiB'], [880, 'RELEASED · GiB']]) diskSvg.append(s('text', { x, y: 15, fill: COL.muted, 'font-size': 11, text: label }));
  for (const [value, col, label, y] of [[disk.fitted_tib, COL.red, 'fitted', 36], [disk.eip7870_tib, COL.muted, 'EIP-7870', 54]]) {
    diskSvg.append(s('line', { x1: peak(value), x2: peak(value), y1: TOP - 8, y2: B - 12, stroke: col, 'stroke-dasharray': '4 4' }));
    sn(diskSvg, `${label} ${fmt.n(value, 2)} TiB`, 184, y, 290, 'c1_run_resources', col);
  }
  sn(diskSvg, `scale 0–${fmt.n(writtenMax)} GiB`, 540, 43, 270, 'c1_run_resources', COL.muted);
  sn(diskSvg, `after the fork · ${date(FORK)} UTC`, 880, 43, 238, 'n1_fork', COL.muted);
  runs.forEach((r, i) => {
    const [host, method] = r.run_id.split('/'), col = color(host), y = TOP + i * 43;
    const tip = `<b style="color:${col}">${host} · ${method === 'self' ? 'self-conversion' : 'snapshot import'}</b><br>` +
      `peak datadir <b>${fmt.n(r.peak_datadir_tib, 2)} TiB</b><br>build + verify written ${fmt.n(r.written_core_gib, 1)} GiB<br>` +
      `replay written ${fmt.n(r.written_replay_gib, 1)} GiB<br>input ${fmt.n(r.input_gib, 1)} GiB · scratch ${fmt.n(r.scratch_gib, 1)} GiB<br>` +
      `released at the fork ${fmt.n(r.released_gib)} GiB`;
    diskSvg.append(s('text', { x: 0, y: y + 9, 'font-size': 11, fill: col, text: host }),
      s('text', { x: 0, y: y + 24, 'font-size': 10, fill: COL.muted, text: method === 'self' ? 'self-conversion' : 'snapshot import' }));
    for (const [a, b] of [[184, 478], [540, 810], [880, 1080]]) diskSvg.append(s('line', { x1: a, x2: b, y1: y + 17, y2: y + 17, stroke: COL.line }));
    diskSvg.append(hover(s('rect', { x: peak(0), y, width: peak(r.peak_datadir_tib) - peak(0), height: 18, fill: col, rx: 2 }), tip),
      hover(s('rect', { x: written(0), y, width: written(r.written_core_gib) - written(0), height: 18, fill: col, rx: 2 }), tip),
      hover(s('rect', { x: written(r.written_core_gib), y, width: Math.max(1, written(r.written_replay_gib) - written(0)), height: 18, fill: `url(#cost-replay-${i})`, stroke: col, 'stroke-width': 0.5 }), tip),
      hover(s('rect', { x: released(0), y, width: released(r.released_gib) - released(0), height: 18, fill: COL.green, rx: 2 }), tip));
    sn(diskSvg, fmt.n(r.peak_datadir_tib, 2), peak(r.peak_datadir_tib) + 5, y + 14, 45, 'c1_run_resources');
    sn(diskSvg, fmt.n(r.written_core_gib + r.written_replay_gib), written(r.written_core_gib + r.written_replay_gib) + 5, y + 14, 52, 'c1_run_resources');
    sn(diskSvg, fmt.n(r.released_gib), released(r.released_gib) + 5, y + 14, 38, 'n1_fork', COL.green);
  });
  root.append(h('div', { class: 'scroll cost-disk' }, h('div', {}, diskSvg)), h('p', { class: 'cost-note' },
    'Input and scratch sizes are on hover. The release is per host, so a host shown with both methods repeats the same disposal; Nethermind reclaimed only ',
    n(`${Math.min(...runs.filter((r) => clientOf(r.run_id) === 'nethermind').map((r) => r.released_gib))} GiB`, 'n1_fork'), ' in the recorded window.'));

  const building = hosts.map((host) => cost.machines[host].migrating).filter(Boolean);
  const after = hosts.map((host) => cost.machines[host]['binary only'].cpu_cores).sort((a, b) => a - b);
  const smallCap = Math.min(...dev.nodes.map((node) => node.cap_gib));
  const memoryMax = hosts.filter((host) => cost.memory[host].cap_gib === smallCap).flatMap((host) =>
    Object.entries(cost.machines[host]).map(([state, r]) => ({ host, state, ...r }))).sort((a, b) => b.mem_p95 - a.mem_p95)[0];
  const self = runs.filter((r) => r.run_id.endsWith('/self')), imports = runs.filter((r) => r.run_id.endsWith('/import'));
  root.append(strip([
    { label: 'cores while building', value: n(`${range(building.map((r) => r.cpu_cores))} c`), note: ['of ', num(String(dev.hosts.vcpu), 'devnet.json', 'hosts'), ' cores · build + verify'] },
    { label: 'cores after the fork', value: n(`≈ ${fmt.n(after[Math.floor(after.length / 2)], 0)} core`), note: ['median node · range ', n(range(after)), ' cores'] },
    { label: 'disk busy while building', value: n(`${range(building.map((r) => r.disk_busy * 100), 0)} %`), note: 'busy share, not bytes written' },
    { label: 'memory: the only shortage', value: n(`${pct(memoryMax.mem_p95)} p95`), note: [memoryMax.host, ' · ', memoryMax.state, ' · ', n(`${smallCap} GiB`, 'resources'), ' cap'] },
    { label: 'peak datadir · self', value: n(`${range(self.map((r) => r.peak_datadir_tib), 2)} TiB`, 'c1_run_resources'), note: 'self-conversion peaks while building' },
    { label: 'peak datadir · import', value: n(`${range(imports.map((r) => r.peak_datadir_tib), 2)} TiB`, 'c1_run_resources'), note: 'imports peak during replay' },
    { label: 'written · build + replay', value: n(`${range(runs.map((r) => (r.written_core_gib + r.written_replay_gib) / 1024), 2)} TiB`, 'c1_run_resources'), note: 'counted runs · not occupied space' },
    { label: 'released at the fork', value: n(`${range(runs.map((r) => r.released_gib), 0)} GiB`, 'n1_fork'), note: 'Nethermind retained most of its space' },
  ]));
  root.append(h('p', { class: 'reading' }, h('b', {}, 'Reading. '),
    n(`${smallCap} GiB`, 'c1_run_resources'), ' worked on every client; ', num(`${dev.eip7870.full_ram_gb} GB`, 'devnet.json', 'hosts'), ' is a comfortable budget, with memory the only resource that ran short. A ', term('import', 'snapshot import'), ' peaks in its replay, a ', term('self', 'self-conversion'), ' while building. Disk is about writes, not size: ',
    n(`${range(runs.map((r) => (r.written_core_gib + r.written_replay_gib) / 1024), 2)} TiB`, 'c1_run_resources'), ' written for a ',
    n(`${range(runs.map((r) => r.peak_datadir_tib), 2)} TiB`, 'c1_run_resources'), ' peak datadir.'));
}
