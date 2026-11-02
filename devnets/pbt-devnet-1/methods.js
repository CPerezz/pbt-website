// Completed migrations: the phases, the 16 GiB comparison, and the snapshot-age model.
import { CLIENT, COL, NAME, avatar, dur, fmt, h, hatch, hover, nodeLabel, num, pct, s, scale, secHead, strip, term } from './kit.js';

const FILE = 'methods.json', CLIENTS = ['geth', 'nethermind', 'besu'];
const W = 1120, AX = { fill: COL.muted, 'font-size': 10 };
const scroll = (svg) => h('div', { class: 'scroll' }, h('div', {}, svg));
const elapsed = (sec) => new Date(sec * 1000).toISOString().slice(11, 19);

export default async function (root, ctx) {
  const data = await ctx.data(FILE), runs16 = data.runs.filter((r) => r.cap_gib === 16);
  const n = (text, view = 'a1_runs', attrs = {}) => num(text, FILE, view, attrs);
  // SVG equivalent of num(): keep the chart labels linked, too.
  const sn = (text, view, attrs) => hover(s('a', { class: 'num', href: ctx.base + FILE, target: '_blank', rel: 'noopener' },
    s('text', attrs, text)), `<span class="lbl">source</span><br><b>${FILE}</b><br>${view} ↗`);
  const sw = (bg) => h('span', { class: 'sw', style: `background:${bg}` });

  root.append(h('style', {}, `
    #methods .methods-label { margin: 24px 0 10px }
    #methods .methods-controls { align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px }
    #methods .methods-matrix { grid-template-columns: 112px repeat(2,minmax(0,1fr)); align-items: stretch; gap: 8px }
    #methods .methods-client { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600 }
    #methods .methods-matrix .cell { text-align: left; padding: 12px 14px; background: var(--panel); border: 1px solid var(--line); cursor: auto }
    #methods .methods-matrix .hdr { text-align: left }
    #methods .methods-method { display: none }
    #methods .methods-run { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 8px }
    #methods .methods-detail { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 9px; line-height: 1.6 }
    #methods .methods-detail .k { min-width: 132px; font-size: 11px }
    #methods .methods-verify { margin-top: 6px; color: var(--ink2); font-size: 11px; overflow-wrap: anywhere }
    #methods .methods-model { margin-top: 24px }
    #methods .methods-model p { margin: 6px 0 12px; font-size: 12px; color: var(--ink2); max-width: 920px }
    #methods .methods-readout { gap: 10px; margin-top: 12px }
    #methods .methods-readout .panel { display: flex; flex-direction: column; gap: 7px; font-size: 12px; padding: 10px 12px }
    #methods .methods-readout .methods-client { justify-content: space-between }
    #methods .methods-readout .methods-times { display: flex; flex-wrap: wrap; gap: 4px 10px; color: var(--ink2) }
    #methods .strip { grid-template-columns: repeat(3,minmax(0,1fr)) }
    #methods .stat .big { font-size: 25px; white-space: normal }
    #methods .stat .note { display: flex; flex-wrap: wrap; gap: 0 4px }
    @media (max-width: 760px) {
      #methods .methods-matrix { grid-template-columns: minmax(0,1fr) }
      #methods .methods-matrix > .hdr { display: none }
      #methods .methods-client { margin-top: 8px }
      #methods .methods-method { display: inline; color: var(--muted); margin-right: auto; font-size: 10px; text-transform: uppercase }
      #methods .methods-readout .methods-client { margin-top: 0 }
      #methods .strip { grid-template-columns: minmax(0,1fr) }
      #methods .stat .big { font-size: 29px }
    }
  `));
  root.append(secHead('Import vs self-conversion', [
    'An ', term('import', 'import'), ' builds the binary tree from a snapshot package made elsewhere, then catches up from its ', term('anchor', 'anchor block'), '. ',
    'A ', term('self', 'self-conversion'), ' scans the node’s own state and builds the tree locally, using only the ', term('preimages', 'preimage'), ' file.',
  ], h('span', { class: 'legend' },
    h('span', {}, sw(`linear-gradient(90deg,${CLIENT.geth} 0 33%,${CLIENT.nethermind} 33% 66%,${CLIENT.besu} 66%)`), 'build · client colour'),
    h('span', {}, sw(COL.green), 'verify'),
    h('span', {}, sw('repeating-linear-gradient(45deg,rgba(226,230,226,.25) 0 3px,rgba(226,230,226,.85) 3px 4px)'), term('replay', 'replay')))));

  // One elapsed-time scale, rebuilt when the larger-cap imports are included.
  const phaseBox = h('div', { class: 'methods-phases' });
  const buttons = [false, true].map((expanded) => h('button', {
    type: 'button', class: `pill${expanded ? '' : ' on'}`, 'aria-pressed': String(!expanded),
    onclick: () => drawRuns(expanded),
  }, expanded ? '+ 32 GiB imports' : '16 GiB runs'));
  root.append(h('div', { class: 'row methods-controls' },
    h('div', { class: 'toggle', 'aria-label': 'Migration runs shown' }, ...buttons),
    h('span', { class: 'muted', style: 'font-size:11px' }, 'Completed runs · elapsed hours from the first phase · hover a phase')), phaseBox);

  function drawRuns(expanded) {
    buttons.forEach((b, i) => { b.classList.toggle('on', i === Number(expanded)); b.setAttribute('aria-pressed', String(i === Number(expanded))); });
    const shown = CLIENTS.flatMap((client) => [
      ...runs16.filter((r) => r.client === client).sort((a, b) => a.method.localeCompare(b.method)),
      ...(expanded ? data.runs.filter((r) => r.client === client && r.cap_gib === 32) : []),
    ]);
    const L = 164, R = W - 90, T = 34, RH = 56, B = T + shown.length * RH;
    const max = Math.max(...shown.map((r) => r.t_total_s)), x = scale(0, max, L, R);
    const svg = s('svg', { viewBox: `0 0 ${W} ${B + 16}`, style: 'width:100%;display:block', role: 'img',
      'aria-label': `Migration phase durations for ${shown.length} completed runs; hours from the first phase` });
    svg.append(s('defs', {}, ...CLIENTS.map((client) => hatch(`methods-replay-${client}`, CLIENT[client]))));
    for (let t = 0; t <= max; t += 3600) {
      svg.append(s('line', { x1: x(t), x2: x(t), y1: T - 10, y2: B - 8, stroke: COL.line, 'stroke-dasharray': t ? '2 4' : null }),
        s('text', { x: x(t), y: 15, 'text-anchor': 'middle', ...AX, text: `${t / 3600}h` }));
    }
    shown.forEach((r, i) => {
      const y = T + i * RH, col = CLIENT[r.client];
      const lane = s('g', { 'data-run': r.run_id });
      nodeLabel(lane, 0, y + 15, r.host);
      lane.append(sn(`${r.method} · ${r.cap_gib}G`, 'a1_runs', { x: 26, y: y + 31, ...AX }),
        s('line', { x1: L, x2: R, y1: y + 14, y2: y + 14, stroke: COL.line }));
      // Paint narrow commit phases last so their hover targets remain reachable.
      [...r.phases].sort((a, b) => (b.end_s - b.start_s) - (a.end_s - a.start_s)).forEach((p) => {
        const width = x(p.end_s) - x(p.start_s), mid = (x(p.start_s) + x(p.end_s)) / 2;
        const fill = p.kind === 'replay' ? `url(#methods-replay-${r.client})` : p.kind === 'verify' ? COL.green : col;
        const label = p.name.replace(/^U\S+\s+/, '');
        const tip = `<b>${r.host} · ${r.method}</b><br>${p.name}<br><b>${dur(p.end_s - p.start_s)}</b><br>` +
          `elapsed ${elapsed(p.start_s)} → ${elapsed(p.end_s)}<br>${fmt.n(r.replay_blocks)} blocks replayed in this run`;
        const phase = s('g', { 'data-phase': p.name, tabindex: 0, role: 'img', 'aria-label': `${r.host} ${r.method}: ${p.name}, ${dur(p.end_s - p.start_s)}` },
          s('title', {}, `${p.name}: ${dur(p.end_s - p.start_s)}; ${elapsed(p.start_s)} → ${elapsed(p.end_s)}; ${fmt.n(r.replay_blocks)} blocks replayed`),
          s('rect', { x: x(p.start_s), y: y + 3, width: Math.max(width, 1), height: 22, fill, opacity: p.kind === 'verify' ? 0.8 : 1, stroke: COL.bg, 'stroke-width': 0.5 }));
        if (width > label.length * 6.2 + 12) phase.append(s('text', { x: mid, y: y + 17, 'text-anchor': 'middle', 'font-size': 10, fill: p.kind === 'replay' ? COL.ink : COL.bg, text: label, 'pointer-events': 'none' }));
        phase.append(s('rect', { x: mid - Math.max(width, 6) / 2, y: y + 3, width: Math.max(width, 6), height: 22, fill: 'transparent', style: 'cursor:help' }));
        lane.append(hover(phase, tip));
      });
      lane.append(sn(dur(r.t_total_s), 'a1_runs', { x: x(r.t_total_s) + 8, y: y + 18, fill: col, 'font-size': 12, 'font-weight': 600 }));
      svg.append(lane);
    });
    phaseBox.replaceChildren(scroll(svg));
  }
  drawRuns(false);

  // Best completed run for each method on the smaller memory cap.
  root.append(h('div', { class: 'lbl methods-label' }, 'Best completed runs · ', n(`${runs16[0].cap_gib} GiB`), ' caps · ',
    num(`${fmt.n(ctx.dev.state.leaves / 1e9, 2)} B leaves`, 'devnet.json', 'manifest')));
  const matrix = h('div', { class: 'grid-tbl methods-matrix', 'aria-label': 'Best completed 16 GiB runs by client and method' },
    h('div', { class: 'hdr' }, 'Client'), h('div', { class: 'hdr' }, 'Import'), h('div', { class: 'hdr' }, 'Self-conversion'));
  const detail = (label, ...value) => h('div', { class: 'methods-detail' }, h('span', { class: 'k' }, label), ...value);
  const memory = (v) => n(pct(v), 'c1_run_resources', { style: `color:${v >= 0.9 ? COL.red : COL.ink}` });
  const verification = (text) => text.split(/(check 1|check 2)/).map((part) => part === 'check 1' ? term('check1', part) : part === 'check 2' ? term('check2', part) : part);
  CLIENTS.forEach((client) => {
    matrix.append(h('div', { class: 'methods-client', style: `color:${CLIENT[client]}` }, avatar(client, 20), NAME[client]));
    for (const method of ['import', 'self']) {
      const r = runs16.filter((run) => run.client === client && run.method === method).sort((a, b) => a.t_total_s - b.t_total_s)[0];
      const unchecked = r.verify.startsWith('none');
      matrix.append(h('div', { class: 'cell', 'data-run': r.run_id },
        h('div', { class: 'methods-run' }, h('span', { class: 'methods-method' }, method === 'self' ? 'Self-conversion' : 'Import'),
          h('b', { style: `color:${CLIENT[client]}` }, r.host), h('span', { class: 'muted' }, '·'), n(h('code', {}, r.build))),
        detail(unchecked ? 'Tree built, unchecked' : 'Tree verified in', n(dur(r.t_core_s))),
        detail('At the head in', n(dur(r.t_total_s))),
        detail('Blocks replayed', n(fmt.n(r.replay_blocks))),
        detail('Peak memory', memory(r.mem_core), '→', memory(r.mem_replay)),
        detail('OOM kills in run', n(String(r.oom_kills), 'failures', { style: `color:${r.oom_kills > 0 ? COL.red : COL.ink}` })),
        h('div', { class: 'methods-verify' }, h('span', { class: 'k' }, 'Verification: '), ...verification(r.verify))));
    }
  });
  root.append(matrix);

  // Snapshot-age model, not the heavier synthetic history measured in the bars above.
  const projection = data.projection, ages = projection.ages_d, models = projection.clients;
  const L = 48, R = W - 22, T = 32, B = 266, H = 310;
  const x = scale(ages[0], ages.at(-1), L, R);
  const ymax = Math.ceil(Math.max(...CLIENTS.flatMap((client) => [...models[client].import_h, models[client].self_h])) / 2) * 2;
  const y = scale(0, ymax, B, T);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, style: 'width:100%;display:block', role: 'img',
    'aria-label': 'Modelled hours to the head versus snapshot age: solid import lines and dashed self-conversion lines' });
  for (let hours = 0; hours <= ymax; hours += 2) {
    svg.append(s('line', { x1: L, x2: R, y1: y(hours), y2: y(hours), stroke: COL.line }),
      s('text', { x: L - 8, y: y(hours) + 3, 'text-anchor': 'end', ...AX, text: `${hours}h` }));
  }
  for (let age = ages[0]; age <= ages.at(-1); age += 5) {
    svg.append(s('text', { x: x(age), y: B + 17, 'text-anchor': 'middle', ...AX, text: `${age}d` }));
  }
  svg.append(s('text', { x: L, y: 14, ...AX, text: 'hours to the head · mainnet-scaled replay model' }),
    s('text', { x: R, y: H - 5, 'text-anchor': 'end', ...AX, text: 'snapshot age · days' }));
  const dots = {}, readouts = {};
  CLIENTS.forEach((client) => {
    const m = models[client], col = CLIENT[client];
    svg.append(hover(s('polyline', { fill: 'none', stroke: col, 'stroke-width': 2,
      points: ages.map((age, i) => `${x(age)},${y(m.import_h[i])}`).join(' ') }), `${NAME[client]} · import<br>${m.basis}`),
    hover(s('line', { x1: L, x2: R, y1: y(m.self_h), y2: y(m.self_h), stroke: col, 'stroke-width': 1.5, 'stroke-dasharray': '6 4', opacity: 0.8 }),
      `${NAME[client]} · self-conversion<br>${dur(m.self_h * 3600)} to the head<br>${m.basis}`));
    if (m.breakeven_d != null) {
      const bx = x(m.breakeven_d), by = y(m.self_h), above = client === 'geth';
      svg.append(hover(s('circle', { cx: bx, cy: by, r: 5, fill: COL.bg, stroke: col, 'stroke-width': 1.5 }),
        `${NAME[client]} · breakeven at ${fmt.n(m.breakeven_d, 1)} days<br>self-conversion wins with an older snapshot`),
        s('line', { x1: bx, x2: bx, y1: by + (above ? -7 : 7), y2: by + (above ? -27 : 23), stroke: col, opacity: 0.6 }),
        sn(`${NAME[client]} · ${fmt.n(m.breakeven_d, 1)}d`, 'j2_projection', { x: bx + 7, y: by + (above ? -30 : 36), fill: col, 'font-size': 10 }));
    }
    dots[client] = s('circle', { r: 4, fill: col, stroke: COL.bg, 'stroke-width': 1.5, 'pointer-events': 'none' });
  });
  const ageLine = s('line', { y1: T, y2: B, stroke: COL.ink, 'stroke-width': 1, 'stroke-dasharray': '3 3', opacity: 0.7, 'pointer-events': 'none' });
  svg.append(ageLine, ...Object.values(dots));
  const ageNumber = n('', 'j2_projection'), ageLabel = h('span', { class: 't', 'aria-live': 'polite' }, ageNumber);
  const input = h('input', { type: 'range', min: ages[0], max: ages.at(-1), step: 1, value: 7, 'aria-label': 'Snapshot age in days', oninput: (e) => updateAge(+e.target.value) });
  const readout = h('div', { class: 'grid3 methods-readout', 'aria-live': 'polite' }, ...CLIENTS.map((client) => {
    const m = models[client], imp = n('', 'j2_projection'), self = n(dur(m.self_h * 3600), 'j2_projection'), winner = h('b');
    readouts[client] = { imp, winner };
    return h('div', { class: 'panel', 'data-client': client },
      h('div', { class: 'methods-client', style: `color:${CLIENT[client]}` },
        h('span', { class: 'who' }, avatar(client, 17), NAME[client]), winner),
      h('div', { class: 'methods-times' }, h('span', {}, 'import ', imp), h('span', {}, 'self ', self)),
      h('div', { class: 'muted', style: 'font-size:11px' }, 'Breakeven: ',
        m.breakeven_d == null && m.wins === 'self' ? n('never · self always wins', 'j2_projection') : n(`${fmt.n(m.breakeven_d, 1)} days`, 'j2_projection')));
  }));
  root.append(h('div', { class: 'panel methods-model' },
    h('div', { class: 'row methods-controls' }, h('span', { class: 'lbl' }, 'How old can the snapshot be?'),
      h('span', { class: 'legend' }, h('span', {}, sw(COL.ink2), 'import'), h('span', {}, sw('repeating-linear-gradient(90deg,var(--ink2) 0 5px,transparent 5px 8px)'), 'self-conversion'))),
    h('p', {}, 'The import’s ', term('bal', 'replay'), ' grows with every block since the snapshot, while self-conversion does not; this model scales live-block replay to mainnet’s storage writes, rather than the devnet’s ', term('synthetic', 'synthetic history'), '.'),
    h('label', { class: 'slider' }, h('span', { class: 'lbl' }, 'Snapshot age'), input, ageLabel), scroll(svg), readout));
  function updateAge(age) {
    const i = ages.indexOf(age);
    ageNumber.textContent = `${age} days`;
    input.setAttribute('aria-valuetext', `${age} days`);
    ageLine.setAttribute('x1', x(age)); ageLine.setAttribute('x2', x(age));
    CLIENTS.forEach((client) => {
      const m = models[client], imp = m.import_h[i], out = readouts[client];
      dots[client].setAttribute('cx', x(age)); dots[client].setAttribute('cy', y(imp));
      out.imp.textContent = dur(imp * 3600);
      out.winner.textContent = `${imp < m.self_h ? 'import' : imp > m.self_h ? 'self' : 'tie'}${imp === m.self_h ? '' : ' wins'}`;
    });
  }
  updateAge(+input.value);

  const range = (method, key, format) => {
    const values = runs16.filter((r) => r.method === method).map((r) => r[key]);
    return `${format(Math.min(...values))}–${format(Math.max(...values))}`;
  };
  root.append(strip([
    { label: 'Import · tree verified', value: n(range('import', 't_core_s', dur)), note: ['Self: ', n(range('self', 't_core_s', dur)), ' · built, not independently checked on every client'] },
    { label: 'Import · at the head', value: n(range('import', 't_total_s', dur)), note: ['Self: ', n(range('self', 't_total_s', dur))] },
    { label: 'Import · blocks replayed', value: n(range('import', 'replay_blocks', fmt.n)), note: ['Self: ', n(range('self', 'replay_blocks', fmt.n)), ' blocks'] },
    ...CLIENTS.map((client) => ({ label: `${NAME[client]} · breakeven`,
      value: n(models[client].breakeven_d == null ? 'never' : `${fmt.n(models[client].breakeven_d, 1)} days`, 'j2_projection'),
      note: models[client].wins === 'self' ? 'Self-conversion wins even with a fresh snapshot' : 'Self-conversion wins beyond this snapshot age' })),
  ]));
  const nm = (method) => runs16.find((r) => r.client === 'nethermind' && r.method === method);
  root.append(h('p', { class: 'reading' }, h('b', {}, 'Reading. '),
    'Import needs the snapshot package, its anchor, and about a week of replay; self-conversion needs only the preimage file and replays the blocks produced while it builds. ',
    'Nethermind’s scan-and-build self path is the slow one today: ', n(`${fmt.n(nm('self').t_core_s / nm('import').t_core_s, 1)}×`),
    ' the import stream’s tree-building time. ',
    'A built tree is not necessarily a checked tree: Nethermind and Besu’s self-conversions had no in-client verification until the fork’s header.'));
}
