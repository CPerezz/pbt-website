import { CLIENT, REDUCED, avatar, countUp, fmt, h, hover, num, onVisible, s, scramble, term, who } from './bench.js';

// What goes in and what must come out: mainnet state → the snapshot pair → the clients → one PBT root.
export default async function (root, ctx) {
  const { pair, round, clients } = ctx.res;
  const src = ctx.src('results.json');
  root.append(h('style', {}, `
    .flow { display: grid; grid-template-columns: 1fr 40px 1.3fr 40px 1fr 40px 1.1fr; align-items: stretch; margin-top: 40px }
    .flow .panel { display: flex; flex-direction: column; gap: 10px; min-width: 0 }
    .flow .arrow { display: flex; align-items: center; justify-content: center }
    .flow .stat { display: flex; justify-content: space-between; gap: 10px; align-items: baseline }
    .lead { max-width: 640px; font-size: 14px; line-height: 1.6; color: var(--ink2); margin: 18px 0 0; text-wrap: pretty }
    .agenda { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; margin-top: 34px }
    .agenda a { display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 1px solid var(--line); border-radius: 8px;
      background: var(--panel); color: var(--ink); text-decoration: none; transition: border-color .15s, transform .15s }
    .agenda a:hover { border-color: var(--green); color: var(--ink); transform: translateY(-2px) }
    .agenda .n { font-family: VT323, monospace; font-size: 18px; color: var(--green); line-height: 1 }
    .agenda b { font-size: 12.5px; font-weight: 600 }
    .agenda span { font-size: 11px; color: var(--muted); line-height: 1.4 }
    @media (max-width: 900px) { .agenda { grid-template-columns: repeat(2, minmax(0, 1fr)) } }
    @media (max-width: 900px) { .flow { grid-template-columns: 1fr } .flow .arrow { height: 34px } .flow .arrow svg { transform: rotate(90deg) } }
  `));

  const eipUrl = (n) => `https://eips.ethereum.org/EIPS/eip-${n}`;
  const eip = (n) => h('a', { href: eipUrl(n), target: '_blank', rel: 'noopener' }, `EIP-${n}`);

  const arrow = () => h('div', { class: 'arrow' }, s('svg', { width: 34, height: 14, viewBox: '0 0 34 14' },
    s('line', { x1: 0, y1: 7, x2: 27, y2: 7, stroke: '#33FF33', 'stroke-width': 1.5, 'stroke-dasharray': '4 3' },
      REDUCED ? null : s('animate', { attributeName: 'stroke-dashoffset', from: 14, to: 0, dur: '1s', repeatCount: 'indefinite' })),
    s('path', { d: 'M26 2 L33 7 L26 12', fill: 'none', stroke: '#33FF33', 'stroke-width': 1.5 })));

  // 1. Mainnet state at the anchor.
  const anchor = h('div', { class: 'panel' },
    h('span', { class: 'lbl' }, 'state at the ', term('anchor', 'anchor block')),
    h('div', { class: 'big', style: 'font-size:clamp(30px,3.2vw,44px)' }, num(`#${fmt.n(pair.anchor_block)}`, src)),
    h('span', { class: 'lbl' }, term('mptroot', 'MPT state root')),
    hover(h('div', { class: 'muted', style: 'font-size:12px' }, fmt.short(pair.anchor_state_root)), pair.anchor_state_root));

  // 2. The pair every client imports: two files sized by bytes, and what they hold.
  const maxB = Math.max(pair.snapshot_bytes, pair.preimages_bytes);
  const file = (label, bytes, color) => {
    const fill = h('div', { class: 'fill', style: `background:${color};box-shadow:0 0 10px ${color}` });
    onVisible(fill, () => { fill.style.width = `${(bytes / maxB) * 100}%`; });
    return h('div', {},
      h('div', { class: 'stat' }, h('span', { class: 'lbl' }, ...(Array.isArray(label) ? label : [label])), h('span', { class: 'big', style: 'font-size:24px' }, num(fmt.gb(bytes), src))),
      h('div', { class: 'track' }, fill));
  };
  const counts = [['accounts', pair.accounts], ['storage slots', pair.slots], ['PBT leaves', pair.leaves], ['contract codes', pair.code_count]]
    .map(([label, v]) => {
      const n = num(fmt.n(v), src);
      onVisible(n, () => countUp(n, v));
      return h('div', { class: 'stat' }, h('span', { class: 'lbl' }, label), h('span', { style: `font-size:13px;color:${label === 'PBT leaves' ? '#33FF33' : '#E2E6E2'}` }, n));
    });
  const pairBox = h('div', { class: 'panel', style: 'border-color:rgba(51,255,51,.3)' },
    h('div', {}, h('div', { class: 'lbl', style: 'color:#33FF33' }, 'EIP-8347 snapshot pair'), h('div', { class: 'muted', style: 'font-size:11px' }, `exported by ${pair.producer}`)),
    file([term('pbt', 'PBT'), ' snapshot'], pair.snapshot_bytes, '#33FF33'),
    file(term('preimages', 'preimages'), pair.preimages_bytes, '#B9C2B9'),
    h('div', { style: 'display:flex;flex-direction:column;gap:3px;margin-top:4px' }, counts));

  // 3. The clients and the branch each one ran.
  const clientsBox = h('div', { class: 'panel' }, h('span', { class: 'lbl' }, 'imported by'),
    clients.map((c) => h('div', { style: 'display:flex;flex-direction:column;gap:2px;padding:7px 0;border-bottom:1px solid rgba(226,230,226,.06)' },
      who(c, 26, 'font-size:15px'),
      h('span', { class: 'muted', style: 'font-size:10.5px;padding-left:34px;overflow-wrap:anywhere' }, `${c.builds[0].ref}@${c.builds[0].commit.slice(0, 8)}`))));

  // 4. The root they must all reproduce.
  const rootText = h('div', { style: 'font-size:12px;color:#33FF33;word-break:break-all;line-height:1.45' }, '0x' + '·'.repeat(64));
  onVisible(rootText, () => scramble(rootText, pair.pbt_root, 1600), 0.6);
  const ticks = clients.map((c) => {
    const ok = c.imports.every((w) => w.root_verified);
    return hover(h('span', { style: `display:inline-flex;align-items:center;gap:8px;color:${ok ? CLIENT[c.id] : '#F0504A'};font-size:15px;font-weight:600` }, ok ? '✓' : '✗', avatar(c.id, 18), c.name),
      `${c.name}: ${ok ? 'its own log verified this root' : 'root not verified'} (${c.imports.length} run${c.imports.length > 1 ? 's' : ''})`);
  });
  const rootBox = h('div', { class: 'panel', style: 'border-color:rgba(51,255,51,.45);box-shadow:0 0 24px rgba(51,255,51,.08)' },
    h('span', { class: 'lbl' }, `expected PBT root · ${pair.hash_suite}`), rootText,
    h('div', { style: 'display:flex;flex-direction:column;gap:4px;margin-top:auto' }, ticks));

  // 5. One line of context, then a map of the page: each card scrolls to its section (a hash link would reload the
  // page, since the hash selects the round) and opens it if it's collapsed.
  const names = clients.map((c) => c.name).join(clients.length > 2 ? ', ' : ' and ');
  const lead = h('p', { class: 'lead' },
    eip(8347), " moves Ethereum's state to the Partitioned Binary Tree of ", eip(8297), ' through one verifiable snapshot. ',
    `Here, ${names} import that snapshot on a live mainnet node while it keeps validating blocks.`);

  const G = '#33FF33', M = 'rgba(226,230,226,.3)';
  const glyph = (...kids) => s('svg', { width: 44, height: 20, viewBox: '0 0 44 20', 'aria-hidden': 'true' }, ...kids);
  const glyphs = {
    race: glyph([4, 7, 10, 13, 16, 18].map((y, i) => s('rect', { x: i * 7, y: 20 - y, width: 5, height: y, rx: 1, fill: i < 4 ? G : M }))),
    kept: glyph(s('line', { x1: 0, x2: 44, y1: 12, y2: 12, stroke: M, 'stroke-dasharray': '2 2' }),
      [[3, 10], [9, 13], [15, 8], [21, 12], [27, 9], [33, 14], [39, 10]].map(([x, y]) => s('circle', { cx: x, cy: y, r: 1.8, fill: G }))),
    cost: glyph([0, 1, 2, 3].map((i) => s('rect', { x: i * 11, y: 4, width: 9, height: 12, rx: 2, fill: i < 2 ? G : 'none', stroke: i < 2 ? G : M }))),
    disk: glyph(s('rect', { x: 0, y: 6, width: 30, height: 8, rx: 2, fill: M }), s('rect', { x: 30, y: 6, width: 14, height: 8, rx: 2, fill: G })),
    setup: glyph([0, 1, 2, 3, 4, 5].map((i) => s('circle', { cx: 4 + i * 7, cy: 10, r: 2.6, fill: G }))),
    reproduce: glyph(s('path', { d: 'M2 5 L8 10 L2 15', fill: 'none', stroke: G, 'stroke-width': 1.6 }),
      s('rect', { x: 12, y: 13, width: 10, height: 2, fill: G })),
  };
  const agenda = h('nav', { class: 'agenda', 'aria-label': 'On this page' }, [
    ['race', 'Import, replayed', 'How long each import takes'],
    ['kept', 'Still validating?', 'Do blocks keep flowing meanwhile'],
    ['cost', 'What it cost', 'CPU, memory and disk'],
    ['disk', 'What the PBT adds', 'Disk the new tree takes'],
    ['setup', 'Setup', 'Same machine, same limits'],
    ['reproduce', 'Reproduce', 'Run it yourself'],
  ].map(([id, title, line], i) => h('a', { href: '', onclick: (e) => {
    e.preventDefault();
    const el = document.getElementById(id);
    el.querySelector('details')?.setAttribute('open', '');
    el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
  } }, h('div', { class: 'row', style: 'justify-content:space-between;align-items:center' }, h('span', { class: 'n' }, String(i + 1)), glyphs[id]),
    h('b', {}, title), h('span', {}, line))));

  root.append(
    h('div', { class: 'row', style: 'gap:10px;align-items:center;margin-bottom:18px' },
      h('span', { class: 'lbl' }, 'Mainnet benchmark · EIP-8347 import'), h('span', { class: 'chip' }, `${round.label} · ${round.date}`)),
    h('h1', { class: 'h1' }, `One snapshot, ${['zero', 'one', 'two', 'three', 'four', 'five', 'six'][clients.length] ?? clients.length} clients, `,
      h('span', { class: 'glow' }, 'one root.')),
    lead,
    h('div', { class: 'flow' }, anchor, arrow(), pairBox, arrow(), clientsBox, arrow(), rootBox),
    agenda,
  );
}
