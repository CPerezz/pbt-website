// Setup: the hosts against EIP-7870, who ran what on which build, the three ways to a binary tree, and the load spamoor put through it.
import { COL, NAME, avatar, color, date, fmt, h, hover, nearest, num, onVisible, s, scale, secHead, strip, term } from './kit.js';

const METHOD_LABEL = { import: 'import', self: 'self-conversion', dual: 'dual commitment' };
const METHOD_TERM = { import: 'import', self: 'self', dual: 'dual' };
const ERA_COLOR = { mainnet: COL.muted, pre: COL.blue, xen: COL.amber, synthetic: COL.lilac };
const shaShort = (sha) => (sha.length > 10 ? `${sha.slice(0, 8)}…${sha.slice(-4)}` : sha);
const buildText = (b) => (b.label === `build ${b.sha}` ? shaShort(b.sha) : `${shaShort(b.sha)} \u00b7 ${b.label}`);
const threads = (spec) => +spec.match(/(\d+)t/)[1];

export default async function (root, ctx) {
  const { dev } = ctx;
  const [methods, cost, timeline] = await Promise.all([ctx.data('methods.json'), ctx.data('cost.json'), ctx.data('timeline.json')]);

  root.append(h('style', {}, `
    .setup-bars { display: flex; flex-direction: column; gap: 5px; margin-top: 6px }
    .setup-bars .barline { display: grid; grid-template-columns: 128px 1fr auto; gap: 8px; align-items: center; font-size: 11px }
    .setup-bars .barline .track { height: 8px }
    .setup-pipe { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin: 10px 0 2px }
    .setup-pipe .chip { white-space: normal; text-align: left; max-width: 420px }
    .setup-pipe .plabel { min-width: 104px; font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: .06em }
    .setup-node { display: flex; flex-direction: column; gap: 8px; min-width: 0 }
    .setup-node .builds { display: flex; flex-wrap: wrap; gap: 4px }
    .setup-era { display: flex; flex-direction: column; gap: 4px; margin-top: 6px }
    .setup-era .barline { display: grid; grid-template-columns: 112px 1fr auto; gap: 8px; align-items: center; font-size: 11px }
    .setup-era .barline .track { height: 8px }
    @media (max-width: 760px) { .setup-bars .barline, .setup-era .barline { grid-template-columns: 96px 1fr auto } .setup-pipe .chip { max-width: 100% } }
  `));

  const impRuns = methods.runs.filter((r) => r.method === 'import');
  const selRuns = methods.runs.filter((r) => r.method === 'self');
  const range = (runs) => [Math.min(...runs.map((r) => r.replay_blocks)), Math.max(...runs.map((r) => r.replay_blocks))];
  const [impLo, impHi] = range(impRuns);
  const [selLo, selHi] = range(selRuns);
  const freq = new Map();
  for (const r of cost.disk.runs) freq.set(r.input_gib, (freq.get(r.input_gib) ?? 0) + 1);
  const inputGib = Math.round([...freq.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  const erigonDual = timeline.lanes.filter((l) => l.client === 'erigon');

  const mg = dev.load.mgas_s, ratio = (v) => fmt.n(v / mg.mainnet, 1);

  root.append(secHead('Setup',
    [`Every node ran on the same host \u2014 ${dev.hosts.vcpu} vCPU, ${fmt.n(dev.hosts.ram_gib, 1)} GiB of memory, one ${fmt.n(dev.hosts.disk_tib, 2)} TiB disk \u2014 with execution caps at half or less of what `,
      term('eip7870', 'EIP-7870'), ' asks for a full node. ',
      'Nine nodes of four clients built their binary tree three ways on builds rebuilt through the fork, under a load spamoor pushed well past mainnet\u2019s.']));

  // --- Hosts vs EIP-7870 ---------------------------------------------------
  const bars = (label, items, fmtVal) => {
    const max = Math.max(...items.map((i) => i.val));
    const lines = items.map(({ name, val, col, tip }) => {
      const fill = h('div', { class: 'fill', style: `background:${col};width:0` });
      const line = hover(h('div', { class: 'barline' },
        h('span', { class: 'muted' }, name), h('div', { class: 'track' }, fill), h('span', {}, fmtVal(val))), tip);
      onVisible(line, () => { fill.style.width = `${Math.max(2, (val / max) * 100)}%`; });
      return line;
    });
    return h('div', {}, h('span', { class: 'lbl' }, label), h('div', { class: 'setup-bars' }, lines));
  };
  const eip = dev.eip7870;
  const memItems = [
    { name: `16 GiB \u00d75`, val: 16 * 2 ** 30, col: COL.green, tip: `<b>16 GiB</b> = ${fmt.n(16 * 2 ** 30 / 1e9, 1)} GB \u00b7 5 hosts (geth-1/3, nethermind-1, besu-1, erigon-2)` },
    { name: `32 GiB \u00d74`, val: 32 * 2 ** 30, col: COL.green, tip: `<b>32 GiB</b> = ${fmt.n(32 * 2 ** 30 / 1e9, 1)} GB \u00b7 4 hosts (geth-2, nethermind-2, besu-2, erigon-1)` },
    { name: 'EIP-7870 full', val: eip.full_ram_gb * 1e9, col: COL.muted, tip: `<b>${eip.full_ram_gb} GB</b> \u00b7 EIP-7870\u2019s full-node recommendation` },
    { name: 'EIP-7870 attester', val: eip.attester_ram_gb * 1e9, col: COL.muted, tip: `<b>${eip.attester_ram_gb} GB</b> \u00b7 EIP-7870\u2019s attester recommendation` },
  ];
  const diskBytes = dev.hosts.disk_tib * 2 ** 40, eipDiskBytes = eip.disk_tb * 1e12;
  const diskItems = [
    { name: `${fmt.n(dev.hosts.disk_tib, 2)} TiB fitted`, val: diskBytes, col: COL.green, tip: `<b>${fmt.n(dev.hosts.disk_tib, 2)} TiB</b> = ${fmt.n(diskBytes / 1e12, 2)} TB \u00b7 one disk per host` },
    { name: `EIP-7870 \u00b7 ${eip.disk_tb} TB`, val: eipDiskBytes, col: COL.muted, tip: `<b>${eip.disk_tb} TB</b> NVMe recommendation` },
  ];
  const cpuItems = [
    { name: `${dev.hosts.vcpu} vCPU`, val: dev.hosts.vcpu, col: COL.green, tip: `<b>${dev.hosts.vcpu} vCPU</b> \u00b7 the host\u2019s container` },
    { name: `EIP-7870 full \u00b7 ${eip.full_cpu}`, val: threads(eip.full_cpu), col: COL.muted, tip: `<b>${eip.full_cpu}</b> \u00b7 EIP-7870\u2019s full-node recommendation` },
    { name: `EIP-7870 attester \u00b7 ${eip.attester_cpu}`, val: threads(eip.attester_cpu), col: COL.muted, tip: `<b>${eip.attester_cpu}</b> \u00b7 EIP-7870\u2019s attester recommendation` },
  ];
  root.append(h('div', { class: 'panel', style: 'display:grid;gap:16px' },
    bars('memory', memItems, (v) => `${fmt.n(v / 1e9, 1)} GB`),
    bars('disk', diskItems, (v) => `${fmt.n(v / 1e12, 2)} TB`),
    bars('cpu', cpuItems, (v) => `${v} threads`)));

  // --- Nodes and builds ------------------------------------------------------
  const nodeCard = (n) => h('div', { class: 'panel setup-node' },
    h('div', { class: 'row', style: 'align-items:center;gap:8px' },
      avatar(n.client, 20), h('span', { style: `color:${color(n.host)};font-weight:600` }, n.host), h('span', { class: 'muted', style: 'font-size:11px' }, NAME[n.client])),
    h('div', { class: 'row', style: 'gap:6px' },
      h('span', { class: 'chip' }, term('cap', `${n.cap_gib} GiB`)),
      ...n.methods.map((m) => h('span', { class: 'chip' }, term(METHOD_TERM[m] ?? m, METHOD_LABEL[m] ?? m)))),
    h('div', { class: 'builds' },
      ...[...n.builds].sort((a, b) => a.t - b.t).map((b) =>
        hover(h('span', { class: 'chip' }, buildText(b)), `<b>${date(b.t)} UTC</b>`))));
  root.append(h('div', { style: 'margin-top:22px' },
    h('span', { class: 'lbl' }, `${dev.nodes.length} nodes \u00b7 ${new Set(dev.nodes.map((n) => n.client)).size} clients`),
    h('div', { class: 'grid3', style: 'margin-top:10px' }, ...dev.nodes.map(nodeCard))));

  // --- Methods pipeline --------------------------------------------------
  const arrow = () => s('svg', { width: 22, height: 10, viewBox: '0 0 22 10', style: 'flex:none' },
    s('line', { x1: 0, y1: 5, x2: 15, y2: 5, stroke: COL.green, 'stroke-width': 1.3 }),
    s('path', { d: 'M14 1.5 L20 5 L14 8.5', fill: 'none', stroke: COL.green, 'stroke-width': 1.3 }));
  const chips = (...labels) => labels.flatMap((l, i) => [h('span', { class: 'chip' }, l), i < labels.length - 1 ? arrow() : null]);
  const pipe = (label, ...labels) => h('div', { class: 'setup-pipe' }, h('span', { class: 'plabel' }, label), ...chips(...labels));
  root.append(h('div', { class: 'panel', style: 'margin-top:14px;display:flex;flex-direction:column;gap:4px' },
    h('span', { class: 'lbl' }, 'the three methods'),
    pipe('import',
      h('span', {}, 'snapshot + ', term('preimages', 'preimages'), ' (', num(`${inputGib} GiB`, 'cost.json', 'c1_run_resources'), ')'),
      h('span', {}, `verify vs #${fmt.n(dev.state.anchor_block)} (`, term('check1', 'check 1'), ' \u00b7 ', term('check2', 'check 2'), ')'),
      'write the tree',
      h('span', {}, term('replay', 'replay'), ' ', num(`${Math.round(impLo / 1000)}\u2013${Math.round(impHi / 1000)}k`, 'methods.json', 'd2_replay'), ' blocks')),
    pipe('self-conversion',
      h('span', {}, 'own flat state at P + preimage file'),
      'build',
      'check 2 (geth only)',
      h('span', {}, term('replay', 'replay'), ' the blocks produced meanwhile (', num(`${fmt.n(selLo / 1000, 1)}\u2013${fmt.n(selHi / 1000, 1)}k`, 'methods.json', 'd2_replay'), ')')),
    pipe('dual commitment',
      h('span', {}, avatar('erigon', 14), ' erigon'),
      h('span', {}, term('dual', 'binary commitment next to the hexary one'), ' from ', num(erigonDual.map((l) => date(l.dual_from).slice(0, 5)).join(' / '), 'timeline.json', 'c0_states')))));

  // --- Load ----------------------------------------------------------------
  const metrics = [
    { key: 'mgas', label: 'gas / block', unit: 'Mgas', d: 1 },
    { key: 'txs', label: 'txs / block', unit: 'txs', d: 0 },
    { key: 'writes', label: 'writes / block', unit: 'writes', d: 0 },
    { key: 'creates', label: 'creates / block', unit: 'creates', d: 0 },
  ];
  const eraPanel = ({ key, label, unit, d }) => {
    const max = Math.max(...dev.load.eras.map((e) => e[key]));
    const base = dev.load.eras.find((e) => e.id === 'mainnet')[key];
    const lines = dev.load.eras.map((e) => {
      const fill = h('div', { class: 'fill', style: `background:${ERA_COLOR[e.id]};width:0` });
      const mult = e.id === 'mainnet' ? '' : ` \u00b7 ${fmt.n(e[key] / base, 1)}\u00d7`;
      const line = hover(h('div', { class: 'barline' },
        h('span', { class: 'muted' }, e.label), h('div', { class: 'track' }, fill),
        h('span', {}, `${fmt.n(e[key], d)}${mult}`)), `<b>${e.label}</b><br>${fmt.n(e[key], d)} ${unit}/block${e.id === 'mainnet' ? '' : ` \u00b7 ${fmt.n(e[key] / base, 2)}\u00d7 mainnet`}`);
      onVisible(line, () => { fill.style.width = `${Math.max(2, (e[key] / max) * 100)}%`; });
      return line;
    });
    return h('div', { class: 'panel' }, h('span', { class: 'lbl' }, label), h('div', { class: 'setup-era' }, lines));
  };
  root.append(h('div', { style: 'margin-top:22px' },
    h('span', { class: 'lbl' }, 'load \u00b7 spamoor\u2019s three shapes vs mainnet'),
    h('div', { class: 'grid3', style: '--n:4;margin-top:10px' }, ...metrics.map(eraPanel))));

  const hourly = dev.load.hourly;
  const W = 1120, X0 = 40, X1 = 1110, H1 = 90, H2 = 70, GAP = 26, T = 10;
  const t0 = dev.window.t0, t1 = dev.window.t1;
  const xs = scale(t0, t1, X0, X1);
  const maxMgas = Math.ceil(Math.max(...hourly.map((r) => r[1])));
  const maxTx = Math.ceil(Math.max(...hourly.map((r) => r[2])) / 10) * 10;
  const yMgas = scale(0, maxMgas, T + H1, T);
  const yTx = scale(0, maxTx, T + H1 + GAP + H2, T + H1 + GAP);
  const svgH = T + H1 + GAP + H2 + 24;
  const svg = s('svg', { viewBox: `0 0 ${W} ${svgH}`, style: 'width:100%;display:block;overflow:visible' });
  const poly = (y, key, col) => s('polyline', {
    fill: 'none', stroke: col, 'stroke-width': 1.4, 'stroke-linejoin': 'round',
    points: hourly.map((r) => `${xs(r[0]).toFixed(1)},${y(r[key]).toFixed(1)}`).join(' '),
  });
  svg.append(
    s('text', { x: X0 - 6, y: T + 8, 'text-anchor': 'end', 'font-size': 10, fill: COL.muted, text: `${maxMgas}` }),
    s('text', { x: X0 - 6, y: T + H1, 'text-anchor': 'end', 'font-size': 10, fill: COL.muted, text: '0 Mgas/s' }),
    s('line', { x1: X0, x2: X1, y1: T + H1, y2: T + H1, stroke: COL.line }),
    s('line', { x1: xs(t0), x2: xs(t1), y1: yMgas(mg.mainnet), y2: yMgas(mg.mainnet), stroke: COL.muted, 'stroke-width': 1, 'stroke-dasharray': '3 3' }),
    s('text', { x: X1, y: yMgas(mg.mainnet) - 4, 'text-anchor': 'end', 'font-size': 9, fill: COL.muted, text: `mainnet ${fmt.n(mg.mainnet, 1)}` }),
    poly(yMgas, 1, COL.green),
    s('text', { x: X0 - 6, y: T + H1 + GAP + 8, 'text-anchor': 'end', 'font-size': 10, fill: COL.muted, text: `${maxTx}` }),
    s('text', { x: X0 - 6, y: T + H1 + GAP + H2, 'text-anchor': 'end', 'font-size': 10, fill: COL.muted, text: '0 tx/s' }),
    s('line', { x1: X0, x2: X1, y1: T + H1 + GAP + H2, y2: T + H1 + GAP + H2, stroke: COL.line }),
    poly(yTx, 2, COL.blue));
  for (const [t, kol, label] of [[dev.xen_t, COL.amber, 'XEN load'], [dev.fork.t, COL.red, 'fork']]) {
    svg.append(s('line', { x1: xs(t), x2: xs(t), y1: T - 4, y2: T + H1 + GAP + H2, stroke: kol, 'stroke-width': 1.2, 'stroke-dasharray': '4 3' }),
      s('text', { x: xs(t) + 4, y: T + 4, 'font-size': 9.5, fill: kol, text: label }));
  }
  for (let t = (Math.floor(t0 / 86400) + 1) * 86400; t <= t1; t += 86400) {
    svg.append(s('line', { x1: xs(t), x2: xs(t), y1: T - 4, y2: T + H1 + GAP + H2, stroke: COL.line, 'stroke-dasharray': '2 4' }),
      s('text', { x: xs(t), y: T + H1 + GAP + H2 + 16, 'text-anchor': 'middle', 'font-size': 9.5, fill: COL.muted, text: date(t).slice(0, 5) }));
  }
  const vcursor = s('line', { y1: T - 4, y2: T + H1 + GAP + H2, stroke: COL.ink, 'stroke-width': 1, opacity: 0, style: 'pointer-events:none' });
  svg.append(vcursor);
  hover(svg, (e) => {
    const b = svg.getBoundingClientRect();
    const t = Math.max(t0, Math.min(t1, xs.inv(((e.clientX - b.left) / b.width) * W)));
    const row = hourly[nearest(hourly, t)];
    vcursor.setAttribute('x1', xs(row[0])); vcursor.setAttribute('x2', xs(row[0])); vcursor.setAttribute('opacity', 1);
    return `<b>${date(row[0])} UTC</b><br><span style="color:${COL.green}">${fmt.n(row[1], 2)} Mgas/s</span><br><span style="color:${COL.blue}">${fmt.n(row[2], 1)} tx/s</span>`;
  });
  svg.addEventListener('pointerleave', () => vcursor.setAttribute('opacity', 0));
  root.append(h('div', { class: 'panel', style: 'margin-top:14px' },
    h('div', { class: 'legend', style: 'margin-bottom:6px' },
      h('span', {}, h('span', { class: 'sw', style: `background:${COL.green}` }), 'Mgas/s'),
      h('span', {}, h('span', { class: 'sw', style: `background:${COL.blue}` }), 'tx/s'),
      h('span', {}, h('span', { class: 'sw thin', style: `background:${COL.muted}` }), 'mainnet Mgas/s')),
    h('div', { class: 'scroll' }, h('div', {}, svg))));

  // --- Strip + reading -----------------------------------------------------
  const xen = dev.load.eras.find((e) => e.id === 'xen'), base = dev.load.eras.find((e) => e.id === 'mainnet');
  const diskRatio = fmt.n(diskBytes / eipDiskBytes, 2);
  root.append(strip([
    { label: 'memory caps', value: num('16 / 32 GiB', 'devnet.json', 'hosts'), note: [term('eip7870', 'EIP-7870'), ' asks 32 / 64 GB \u2014 \u2248\u00bd of a full node\u2019s RAM'] },
    { label: 'disk', value: num(`${diskRatio}\u00d7`, 'devnet.json', 'hosts'), note: `${fmt.n(dev.hosts.disk_tib, 2)} TiB fitted (${fmt.n(diskBytes / 1e12, 2)} TB) vs EIP-7870\u2019s ${eip.disk_tb} TB` },
    { label: 'cores', value: num(String(dev.hosts.vcpu), 'devnet.json', 'hosts'), note: 'vCPU per host, shared with the consensus client' },
    { label: 'sustained throughput', value: num(`${ratio(mg.before)}\u2013${ratio(mg.under)}\u00d7`, 'devnet.json', 'workload_devnet'), note: `${mg.before}/${mg.under}/${mg.after_fork} Mgas/s before/under/after the fork vs mainnet\u2019s ${mg.mainnet}` },
    { label: 'XEN load block', value: num(`${fmt.n(xen.mgas, 0)} Mgas`, 'devnet.json', 'workload_devnet'), note: `${fmt.n(xen.writes / base.writes, 1)}\u00d7 mainnet\u2019s writes \u00b7 ${fmt.n(xen.creates / base.creates, 1)}\u00d7 creates, every other block near-empty` },
  ]));
  root.append(h('p', { class: 'reading' },
    h('b', {}, 'Reading. '), 'Every cap sits at half or less of ', term('eip7870', 'EIP-7870'), "\u2019s ask, and the fitted disk is ", diskRatio, '\u00d7 its 4 TB; nothing here needed more than that to migrate a mainnet-sized state. ',
    "Spamoor's XEN load filled every other block to ", fmt.n(xen.mgas, 0), ' Mgas with ', fmt.n(xen.creates / base.creates, 1),
    '\u00d7 mainnet\u2019s contract creations \u2014 a full-then-empty pattern EIP-1559\u2019s base fee would not let mainnet itself produce.'));
}
