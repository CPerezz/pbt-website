// Hero: what pbt-devnet-1 was, the nine nodes, the one root, the numbers to keep, and a map of the page.
import { CLIENT, NAME, REDUCED, avatar, clientOf, color, countUp, date, dur, fmt, h, hover, num, onVisible, s, scramble, strip, term } from './kit.js';

export default async function (root, ctx) {
  const { dev } = ctx;
  const methods = await ctx.data('methods.json');
  root.append(h('style', {}, `
    .flow { display: grid; grid-template-columns: 1.1fr 40px 1.5fr 40px 1.1fr; align-items: stretch; margin-top: 14px }
    .flow .panel { display: flex; flex-direction: column; gap: 10px; min-width: 0 }
    .flow .arrow { display: flex; align-items: center; justify-content: center }
    .flow .stat2 { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; font-size: 12px }
    .flow .stat2 b { font-family: VT323, monospace; font-size: 22px; font-weight: 400; color: var(--ink) }
    .nodes { display: grid; grid-template-columns: 1fr; gap: 0 }
    .noderow { display: flex; align-items: center; gap: 8px; padding: 3px 0; border-bottom: 1px solid rgba(226,230,226,.06); font-size: 12px; min-width: 0 }
    .noderow .host { font-weight: 600; min-width: 104px }
    .noderow .muted { min-width: 44px }
    .noderow .chip { padding: 1px 6px; font-size: 10px }
    .lead { max-width: 700px; font-size: 14px; line-height: 1.6; color: var(--ink2); margin: 18px 0 0; text-wrap: pretty }
    .agenda { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin-top: 30px }
    .agenda a { display: flex; flex-direction: column; gap: 6px; padding: 11px 12px; border: 1px solid var(--line); border-radius: 8px;
      background: var(--panel); color: var(--ink); text-decoration: none; transition: border-color .15s, transform .15s }
    .agenda a:hover { border-color: var(--green); color: var(--ink); transform: translateY(-2px) }
    .agenda .n { font-family: VT323, monospace; font-size: 18px; color: var(--green); line-height: 1 }
    .agenda b { font-size: 12.5px; font-weight: 600 }
    .agenda span { font-size: 11px; color: var(--muted); line-height: 1.4 }
    @media (max-width: 900px) { .agenda { grid-template-columns: repeat(2, minmax(0, 1fr)) } }
    @media (max-width: 480px) { .status, #intro .chip { white-space: normal; text-align: center } .stat .big { font-size: 26px } }
    @media (max-width: 900px) { .flow { grid-template-columns: 1fr } .flow .arrow { height: 34px } .flow .arrow svg { transform: rotate(90deg) } }
  `));

  const eip = (n) => h('a', { href: `https://eips.ethereum.org/EIPS/eip-${n}`, target: '_blank', rel: 'noopener' }, `EIP-${n}`);
  const arrow = () => h('div', { class: 'arrow' }, s('svg', { width: 34, height: 14, viewBox: '0 0 34 14' },
    s('line', { x1: 0, y1: 7, x2: 27, y2: 7, stroke: '#33FF33', 'stroke-width': 1.5, 'stroke-dasharray': '4 3' },
      REDUCED ? null : s('animate', { attributeName: 'stroke-dashoffset', from: 14, to: 0, dur: '1s', repeatCount: 'indefinite' })),
    s('path', { d: 'M26 2 L33 7 L26 12', fill: 'none', stroke: '#33FF33', 'stroke-width': 1.5 })));

  // 1. The state every node started from.
  const st = dev.state;
  const counts = [['accounts', st.accounts], ['storage slots', st.slots], ['contract codes', st.codes], ['binary-tree leaves', st.leaves]]
    .filter(([, v]) => v != null).map(([label, v]) => {
      const b = h('b', {}, '0');
      onVisible(b, () => countUp(b, v, (x) => fmt.n(Math.round(x))), 0.6);
      return h('div', { class: 'stat2' }, h('span', { class: 'muted' }, label), num(b, 'devnet.json', 'manifest'));
    });
  const stateBox = h('div', { class: 'panel' },
    h('span', { class: 'lbl' }, 'state at the ', term('anchor', 'anchor block'), st.anchor_block ? ` · #${fmt.n(st.anchor_block)}` : ''),
    h('div', { class: 'muted', style: 'font-size:12px' }, "mainnet's state, forked and bloated by ethPandaOps", st.vs_mainnet_leaves ? ` (${st.vs_mainnet_leaves} leaves vs mainnet)` : ''),
    h('div', { style: 'display:flex;flex-direction:column;gap:4px;margin-top:2px' }, counts));

  // 2. The nine nodes and how each built its tree.
  const label = { import: 'import', self: 'self-conversion', dual: 'dual commitment' };
  const tkey = { import: 'import', self: 'self', dual: 'dual' };
  const nodeRow = (n) => h('div', { class: 'noderow' },
    avatar(n.client, 18), h('span', { class: 'host', style: `color:${CLIENT[n.client]}` }, n.host),
    h('span', { class: 'muted' }, `${n.cap_gib} GiB`),
    ...n.methods.map((m) => h('span', { class: 'chip' }, term(tkey[m] ?? m, label[m] ?? m))));
  const nodesBox = h('div', { class: 'panel' },
    h('span', { class: 'lbl' }, `${dev.nodes.length} nodes · ${new Set(dev.nodes.map((n) => n.client)).size} clients · 3 methods`),
    h('div', { class: 'nodes' }, ...dev.nodes.map(nodeRow)),
    h('div', { class: 'muted', style: 'font-size:11px' }, 'nethermind-1 and besu-1 migrated twice: an import on day one, a self-conversion under the load on 10-27.'));

  // 3. The root all nine had to agree on at the fork.
  const r = dev.roots;
  const rootLine = h('div', { style: 'font-size:12px;color:#33FF33;word-break:break-all;line-height:1.45' }, '0x' + '·'.repeat(64));
  if (dev.fork.root) onVisible(rootLine, () => scramble(rootLine, dev.fork.root, 1600), 0.6);
  const ticks = dev.nodes.map((n) => h('div', { class: 'row', style: 'gap:8px;align-items:center;font-size:12px' },
    h('span', { style: 'color:#33FF33' }, '✓'), avatar(n.client, 14), h('span', { style: `color:${CLIENT[n.client]};font-weight:600` }, n.host),
    h('span', { class: 'muted' }, r.per_host?.[n.host] != null ? `${fmt.n(r.per_host[n.host])} root checks` : '')));
  const rootBox = h('div', { class: 'panel', style: 'border-color:rgba(51,255,51,.45);box-shadow:0 0 24px rgba(51,255,51,.08)' },
    h('span', { class: 'lbl' }, 'one root at the ', term('fork', 'fork'), ` · block #${fmt.n(dev.fork.block)} · ${date(dev.fork.t)} UTC`),
    dev.fork.root ? rootLine : null,
    h('div', { class: 'stat2' }, h('span', { class: 'muted' }, 'root comparisons across nodes'), num(h('b', {}, fmt.n(r.comparisons)), 'devnet.json', 'roots')),
    h('div', { class: 'stat2' }, h('span', { class: 'muted' }, 'divergences'), num(h('b', { style: 'color:#33FF33' }, String(r.divergences)), 'devnet.json', 'roots')),
    h('div', { style: 'display:flex;flex-direction:column;gap:3px;margin-top:auto' }, ticks));

  // Numbers to keep.
  const best = (pred) => methods.runs.filter(pred).sort((a, b) => a.t_total_s - b.t_total_s)[0];
  const self16 = best((x) => x.method === 'self' && x.cap_gib === 16);
  const caps16 = dev.nodes.filter((n) => n.cap_gib === 16).length;
  const keep = strip([
    { label: 'root divergences', value: num(h('span', { class: 'glow' }, String(r.divergences)), 'devnet.json', 'roots'), note: `${fmt.n(r.heights)} heights, ${fmt.n(r.comparisons)} pairwise comparisons, four clients, three methods` },
    { label: 'memory caps', value: num(`${caps16}× 16 GiB`, 'devnet.json', 'hosts'), note: [`${dev.nodes.length - caps16}× 32 GiB · `, term('eip7870', 'EIP-7870'), ' asks 32 / 64 GB'] },
    { label: 'self-conversion → head', value: num(dur(self16.t_total_s), 'methods.json', 'a1_runs'), note: `${self16.host} on 16 GiB, validating throughout` },
    { label: 'load vs mainnet', value: num(`${fmt.n(dev.load.mgas_s.before / dev.load.mgas_s.mainnet, 1)}–${fmt.n(dev.load.mgas_s.under / dev.load.mgas_s.mainnet, 1)}×`, 'devnet.json', 'workload_devnet'), note: `${dev.load.mgas_s.before}–${dev.load.mgas_s.under} Mgas/s sustained, nine days` },
    { label: 'the fork', value: num('9 / 9', 'devnet.json', 'n1_fork'), note: `crossed on one root · window closed in ${dev.fork.window_close_min} min` },
  ]);

  const lead = h('p', { class: 'lead' },
    eip(8347), " moves Ethereum's state from the Merkle-Patricia trie to the binary tree of ", eip(8297),
    ' without stopping the chain. pbt-devnet-1 was the first time nine nodes did it together: a mainnet-sized state, three times mainnet\u2019s load, memory caps at half of what operators are told to buy, and a fork at the end. Everything below was measured on those nodes.');

  const G = '#33FF33', M = 'rgba(226,230,226,.3)';
  const glyph = (...kids) => s('svg', { width: 44, height: 20, viewBox: '0 0 44 20', 'aria-hidden': 'true' }, ...kids);
  const glyphs = {
    timeline: glyph([2, 6, 10, 14, 18].map((y, i) => s('rect', { x: i % 2 ? 6 : 0, y, width: i % 2 ? 30 : 36, height: 2.5, rx: 1, fill: i < 3 ? G : M }))),
    methods: glyph(s('rect', { x: 0, y: 3, width: 26, height: 6, rx: 1, fill: G }), s('rect', { x: 26, y: 3, width: 16, height: 6, rx: 1, fill: M }), s('rect', { x: 0, y: 12, width: 24, height: 6, rx: 1, fill: G })),
    validating: glyph(s('line', { x1: 0, x2: 44, y1: 12, y2: 12, stroke: M, 'stroke-dasharray': '2 2' }), [[3, 10], [9, 13], [15, 8], [21, 12], [27, 9], [33, 14], [39, 10]].map(([x, y]) => s('circle', { cx: x, cy: y, r: 1.8, fill: G }))),
    cost: glyph([0, 1, 2, 3].map((i) => s('rect', { x: i * 11, y: 4, width: 9, height: 12, rx: 2, fill: i < 2 ? G : 'none', stroke: i < 2 ? G : M }))),
    fork: glyph(s('path', { d: 'M0 14 L18 14 L24 6 L44 6', fill: 'none', stroke: G, 'stroke-width': 1.6 }), s('line', { x1: 21, x2: 21, y1: 1, y2: 19, stroke: '#F0504A', 'stroke-dasharray': '2 2' })),
    network: glyph(s('path', { d: 'M0 6 L10 6 L14 12 L20 6 L44 6', fill: 'none', stroke: G, 'stroke-width': 1.6 }), [4, 12, 20, 28, 36].map((x) => s('rect', { x, y: 15, width: 3, height: 4, fill: M }))),
    setup: glyph([0, 1, 2, 3, 4, 5].map((i) => s('circle', { cx: 4 + i * 7, cy: 10, r: 2.6, fill: G }))),
    conclusions: glyph(s('path', { d: 'M2 10 L8 16 L20 4', fill: 'none', stroke: G, 'stroke-width': 1.8 }), s('rect', { x: 26, y: 9, width: 16, height: 2, fill: M })),
    provenance: glyph(s('path', { d: 'M2 5 L8 10 L2 15', fill: 'none', stroke: G, 'stroke-width': 1.6 }), s('rect', { x: 12, y: 13, width: 10, height: 2, fill: G })),
  };
  const agenda = h('nav', { class: 'agenda', 'aria-label': 'On this page' }, [
    ['timeline', 'Nine days, nine nodes', 'Every migration, failure and the fork on one clock'],
    ['methods', 'Import vs self-conversion', 'Where the hours go, and the breakeven'],
    ['validating', 'Still validating?', 'Block processing by state, and the replay'],
    ['cost', 'What the machines did', 'Cores, memory against the cap, disk'],
    ['fork', 'The fork', 'Crossing on one root, disposing of the MPT'],
    ['network', 'The network · what broke', 'Participation, finality, the failure ledger'],
    ['setup', 'Setup', 'Hosts and caps vs EIP-7870, builds, load'],
    ['conclusions', 'Conclusions', 'What to take from it, before mainnet'],
    ['provenance', 'Provenance', 'Where every number comes from'],
  ].map(([id, title, line], i) => h('a', { href: `#${id}`, onclick: (e) => {
    e.preventDefault();
    document.getElementById(id).scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
  } }, h('div', { class: 'row', style: 'justify-content:space-between;align-items:center' }, h('span', { class: 'n' }, String(i + 1)), glyphs[id]),
    h('b', {}, title), h('span', {}, line))));

  root.append(
    h('div', { class: 'row', style: 'gap:10px;align-items:center;margin-bottom:18px;row-gap:8px' },
      h('span', { class: 'lbl' }, 'Devnet · EIP-8347 live migration'),
      hover(h('span', { class: 'status' }, h('span', { class: 'dot' }), `terminated · ${date(dev.window.t1)} UTC`), `The chain's last block, #${fmt.n(dev.window.chain_end_block)}, ${date(dev.window.t1)} UTC; the hosts were gone the same evening.`),
      h('span', { class: 'chip' }, `${date(dev.window.t0).slice(0, 5)} → ${date(dev.window.t1).slice(0, 5)} · 2026`)),
    h('h1', { class: 'h1' }, 'pbt-devnet-1, ', h('span', { class: 'glow' }, 'in numbers.')),
    lead,
    keep,
    h('p', { class: 'explain', style: 'margin:30px 0 0' },
      'Left to right: the state every node started from, the nine nodes and how each one built its binary tree (a ', term('import', 'snapshot import'), ', a ', term('self', 'self-conversion'),
      ' of its own state, or erigon\u2019s ', term('dual', 'dual commitment'), '), and the root all nine had to compute at the fork.'),
    h('div', { class: 'flow' }, stateBox, arrow(), nodesBox, arrow(), rootBox),
    agenda,
  );
}
