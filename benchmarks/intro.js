import { CLIENT, REDUCED, countUp, fmt, h, hover, num, onVisible, s, scramble } from './bench.js';

// What goes in and what must come out: mainnet state → the snapshot pair → the clients → one PBT root.
export default async function (root, ctx) {
  const { pair, round, clients } = ctx.res;
  const src = ctx.src('results.json');
  root.append(h('style', {}, `
    .flow { display: grid; grid-template-columns: 1fr 40px 1.3fr 40px 1fr 40px 1.1fr; align-items: stretch; margin-top: 40px }
    .flow .panel { display: flex; flex-direction: column; gap: 10px; min-width: 0 }
    .flow .arrow { display: flex; align-items: center; justify-content: center }
    .flow .stat { display: flex; justify-content: space-between; gap: 10px; align-items: baseline }
    @media (max-width: 900px) { .flow { grid-template-columns: 1fr } .flow .arrow { height: 34px } .flow .arrow svg { transform: rotate(90deg) } }
  `));

  const arrow = () => h('div', { class: 'arrow' }, s('svg', { width: 34, height: 14, viewBox: '0 0 34 14' },
    s('line', { x1: 0, y1: 7, x2: 27, y2: 7, stroke: '#33FF33', 'stroke-width': 1.5, 'stroke-dasharray': '4 3' },
      REDUCED ? null : s('animate', { attributeName: 'stroke-dashoffset', from: 14, to: 0, dur: '1s', repeatCount: 'indefinite' })),
    s('path', { d: 'M26 2 L33 7 L26 12', fill: 'none', stroke: '#33FF33', 'stroke-width': 1.5 })));

  // 1. Mainnet state at the anchor.
  const anchor = h('div', { class: 'panel' },
    h('span', { class: 'lbl' }, 'mainnet state at block'),
    h('div', { class: 'big', style: 'font-size:clamp(30px,3.2vw,44px)' }, num(`#${fmt.n(pair.anchor_block)}`, src)),
    h('span', { class: 'lbl' }, 'MPT state root'),
    hover(h('div', { class: 'muted', style: 'font-size:12px' }, fmt.short(pair.anchor_state_root)), pair.anchor_state_root));

  // 2. The pair every client imports: two files sized by bytes, and what they hold.
  const maxB = Math.max(pair.snapshot_bytes, pair.preimages_bytes);
  const file = (label, bytes, color) => {
    const fill = h('div', { class: 'fill', style: `background:${color};box-shadow:0 0 10px ${color}` });
    onVisible(fill, () => { fill.style.width = `${(bytes / maxB) * 100}%`; });
    return h('div', {},
      h('div', { class: 'stat' }, h('span', { class: 'lbl' }, label), h('span', { class: 'big', style: 'font-size:24px' }, num(fmt.gb(bytes), src))),
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
    file('PBT snapshot', pair.snapshot_bytes, '#33FF33'),
    file('preimages', pair.preimages_bytes, '#B9C2B9'),
    h('div', { style: 'display:flex;flex-direction:column;gap:3px;margin-top:4px' }, counts));

  // 3. The clients and the branch each one ran.
  const who = h('div', { class: 'panel' }, h('span', { class: 'lbl' }, 'imported by'),
    clients.map((c) => h('div', { style: 'display:flex;flex-direction:column;gap:2px;padding:7px 0;border-bottom:1px solid rgba(226,230,226,.06)' },
      h('span', { style: `display:flex;gap:8px;align-items:center;font-weight:600;color:${CLIENT[c.id]};font-size:15px` }, h('span', { class: 'dot', style: `background:${CLIENT[c.id]}` }), c.name),
      h('span', { class: 'muted', style: 'font-size:10.5px;padding-left:16px;overflow-wrap:anywhere' }, `${c.builds[0].ref}@${c.builds[0].commit.slice(0, 8)}`))));

  // 4. The root they must all reproduce.
  const rootText = h('div', { style: 'font-size:12px;color:#33FF33;word-break:break-all;line-height:1.45' }, '0x' + '·'.repeat(64));
  onVisible(rootText, () => scramble(rootText, pair.pbt_root, 1600), 0.6);
  const ticks = clients.map((c) => {
    const ok = c.imports.every((w) => w.root_verified);
    return hover(h('span', { style: `color:${ok ? CLIENT[c.id] : '#F0504A'};font-size:15px;font-weight:600` }, ok ? `✓ ${c.name}` : `✗ ${c.name}`),
      `${c.name}: ${ok ? 'its own log verified this root' : 'root not verified'} (${c.imports.length} run${c.imports.length > 1 ? 's' : ''})`);
  });
  const rootBox = h('div', { class: 'panel', style: 'border-color:rgba(51,255,51,.45);box-shadow:0 0 24px rgba(51,255,51,.08)' },
    h('span', { class: 'lbl' }, `expected PBT root · ${pair.hash_suite}`), rootText,
    h('div', { style: 'display:flex;flex-direction:column;gap:4px;margin-top:auto' }, ticks));

  root.append(
    h('div', { class: 'row', style: 'gap:10px;align-items:center;margin-bottom:18px' },
      h('span', { class: 'lbl' }, 'Mainnet benchmark · EIP-8347 import'), h('span', { class: 'chip' }, `${round.label} · ${round.date}`)),
    h('h1', { class: 'h1' }, `One snapshot, ${['zero', 'one', 'two', 'three', 'four', 'five', 'six'][clients.length] ?? clients.length} clients, `,
      h('span', { class: 'glow' }, 'one root.')),
    h('div', { class: 'flow' }, anchor, arrow(), pairBox, arrow(), who, arrow(), rootBox),
  );
}
