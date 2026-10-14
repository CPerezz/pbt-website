// The machine and the method: rig, preflight, builds.
import { COL, h, s, hover, onVisible } from './bench.js';

const GREEN = COL.green;

export default async function (root, ctx) {
  const { res } = ctx;
  const { rig, clients } = res;

  const head = h('div', { class: 'sec-head' },
    h('h2', { class: 'h2' }, 'Setup'),
    h('span', { class: 'cap' }, 'One rig, the same checklist, before every run.'));

  // --- Rig diagram --------------------------------------------------------
  const sq = 16, gap = 4, cols = 10;
  const cores = Array.from({ length: rig.cores_total }, (_, i) =>
    s('rect', {
      x: (i % cols) * (sq + gap), y: Math.floor(i / cols) * (sq + gap), width: sq, height: sq, rx: 2,
      fill: i < rig.cores_measured ? GREEN : 'rgba(226,230,226,.14)',
      style: i < rig.cores_measured ? 'filter:drop-shadow(0 0 4px rgba(51,255,51,.6))' : '',
    }));
  const coreSvg = hover(
    s('svg', { viewBox: `0 0 ${cols * (sq + gap)} ${2 * (sq + gap)}`, width: cols * (sq + gap), height: 2 * (sq + gap) }, ...cores),
    `${rig.cores_measured} isolated · measured<br>${rig.cores_note}`);

  const thermal = (() => {
    let maxT = 0, throttles = 0;
    for (const c of clients) for (const w of [c.baseline, ...c.imports, ...(c.after ? [c.after] : [])]) {
      if (!w.thermal) continue;
      maxT = Math.max(maxT, w.thermal.package_temp_max_c || 0);
      throttles += (w.thermal.package_throttles || 0) + (w.thermal.measured_core_throttles || 0);
    }
    return { maxT, throttles };
  })();

  const memFill = h('div', { class: 'fill', style: `background:${GREEN};box-shadow:0 0 8px rgba(51,255,51,.4)` });
  onVisible(memFill, () => { memFill.style.width = '100%'; });

  const rigBox = h('div', { class: 'panel', style: 'display:grid;gap:16px' },
    h('div', { class: 'row', style: 'gap:28px;align-items:flex-start' },
      h('div', {},
        h('div', { class: 'lbl' }, `cpu · ${rig.cores_measured} of ${rig.cores_total} cores`),
        coreSvg,
        h('div', { class: 'muted', style: 'font-size:10px;margin-top:4px' }, rig.cpu)),
      h('div', { style: 'min-width:180px;flex:1' },
        h('div', { class: 'lbl' }, `memory · ${rig.mem_gib} GiB`),
        h('div', { class: 'track', style: 'margin-top:6px' }, memFill),
        h('div', { class: 'muted', style: 'font-size:10px;margin-top:4px' }, rig.mem_note)),
      hover(h('div', { class: 'chip' }, 'disk · NVMe'), rig.disk),
      hover(h('div', { class: 'chip' }, `CL · ${rig.cl}`), 'Consensus client paired with each EL under test.')),
    hover(
      h('div', { class: 'row', style: 'gap:6px;align-items:center' },
        h('span', { class: 'dot', style: `background:${thermal.throttles ? COL.red : GREEN}` }),
        h('span', { class: 'lbl' }, `${thermal.maxT.toFixed(0)} °C peak · ${thermal.throttles} throttle event${thermal.throttles === 1 ? '' : 's'}`)),
      'Peak package temperature and throttle count across every baseline/import window, all clients.'));

  // --- Method pipeline -----------------------------------------------------
  const steps = ['sync', 'settle 60 min', 'preflight', 'baseline 4 h', 'import', 'sizes'];
  const arrow = () => s('svg', { width: 20, height: 10, viewBox: '0 0 20 10', style: 'flex:none' },
    s('line', { x1: 0, y1: 5, x2: 14, y2: 5, stroke: GREEN, 'stroke-width': 1.5 }),
    s('path', { d: 'M13 1 L19 5 L13 9', fill: 'none', stroke: GREEN, 'stroke-width': 1.5 }));
  const pipeline = h('div', { class: 'row', style: 'align-items:center;flex-wrap:wrap;gap:6px' },
    ...steps.flatMap((st, i) => [h('span', { class: 'chip' }, st), i < steps.length - 1 ? arrow() : null]));

  // Preflight pips, per client, fetched live.
  const preflightRows = clients.map((c) => {
    const row = h('div', { class: 'row', style: 'gap:3px' });
    const line = h('div', { style: 'display:grid;grid-template-columns:90px 1fr;gap:10px;align-items:center' },
      h('span', { style: `color:${ctx.color(c.id)}` }, c.name), row);
    fetch(ctx.src(`${c.id}/${c.baseline.phase}/preflight.txt`)).then((r) => r.text()).then((txt) => {
      const lines = txt.trim().split('\n');
      for (const l of lines) {
        const pass = l.startsWith('PASS');
        row.append(hover(h('span', {
          style: `width:8px;height:8px;border-radius:50%;display:inline-block;background:${pass ? GREEN : COL.red}`,
        }), l));
      }
    }).catch(() => { row.append(h('span', { class: 'muted', style: 'font-size:11px' }, 'preflight log unavailable')); });
    return line;
  });

  const methodBox = h('div', { class: 'panel', style: 'display:grid;gap:16px;margin-top:18px' },
    pipeline,
    h('div', { style: 'display:grid;gap:8px' },
      h('span', { class: 'lbl' }, 'preflight · one pip per check'),
      ...preflightRows));

  // --- Builds ----------------------------------------------------------------
  const buildChip = (b) => {
    if (b.pr != null) {
      const c = h('a', { class: 'chip', href: `https://github.com/${b.repo}/pull/${b.pr}`, target: '_blank', rel: 'noopener' }, `${b.repo}#${b.pr}`);
      return b.repo === 'NethermindEth/nethermind' && b.pr === 14642
        ? hover(c, 'our fix: out-of-memory during the import on mainnet') : c;
    }
    return h('a', { class: 'chip', href: `https://github.com/${b.repo}/commit/${b.commit}`, target: '_blank', rel: 'noopener' }, `${b.repo}@${b.commit}`);
  };
  const buildRows = clients.map((c) => h('div', { style: 'display:grid;grid-template-columns:90px 1fr;gap:10px;align-items:center;padding:5px 0;border-bottom:1px solid rgba(226,230,226,.06)' },
    h('span', { style: `color:${ctx.color(c.id)}` }, c.name),
    h('div', { class: 'row', style: 'gap:6px;align-items:center' },
      ...c.builds.map(buildChip), h('span', { class: 'muted', style: 'font-size:11px' }, c.runtime))));
  const buildsBox = h('div', { class: 'panel', style: 'display:grid;gap:4px;margin-top:18px' },
    h('span', { class: 'lbl' }, 'builds'), ...buildRows);
  root.append(head, rigBox, methodBox, buildsBox);
}
