import { CLIENT, REDUCED, avatar, countUp, fmt, h, hover, num, onVisible, s, scramble, term, who } from './bench.js';

// What goes in and what must come out: mainnet state → the snapshot pair → the clients → one PBT root.
export default async function (root, ctx) {
  const { pair, round, clients, rig } = ctx.res;
  const src = ctx.src('results.json');
  root.append(h('style', {}, `
    .flow { display: grid; grid-template-columns: 1fr 40px 1.3fr 40px 1fr 40px 1.1fr; align-items: stretch; margin-top: 40px }
    .flow .panel { display: flex; flex-direction: column; gap: 10px; min-width: 0 }
    .flow .arrow { display: flex; align-items: center; justify-content: center }
    .flow .stat { display: flex; justify-content: space-between; gap: 10px; align-items: baseline }
    .ctx-p { max-width: 680px; font-size: 13.5px; line-height: 1.6; color: var(--ink2); margin: 0; text-wrap: pretty }
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

  // 5. Context: what this round measures and how, plus links out. Names and numbers come from the round's data.
  const names = clients.map((c) => c.name).join(clients.length > 2 ? ', ' : ' and ');
  const ctxBlock = h('div', { style: 'margin-top:22px;display:flex;flex-direction:column;gap:10px' },
    h('p', { class: 'ctx-p' },
      eip(8347), " moves Ethereum's state from the Merkle Patricia Trie to the Partitioned Binary Tree of ", eip(8297),
      ` off the consensus-critical path. The state at a finalized anchor block is converted once and distributed as a verifiable snapshot plus a preimage file; each node imports that pair, checks it against the anchor's MPT state root, and the tree becomes canonical at one hard fork. This round measures the import on mainnet: ${names} each imported the same pair, exported at block ${fmt.n(pair.anchor_block)}, while still validating new blocks.`),
    h('p', { class: 'ctx-p' },
      `Each client ran alone on the same machine, limited to ${rig.cores_measured} cores and ${rig.mem_gib} GiB of memory shared with its consensus client (${rig.cl}). After a 4-hour baseline of ordinary block processing, we restarted it with the import flags. A proxy between the consensus client and the execution client timed every engine_newPayload, and the node's cgroup gave CPU, memory and disk every 5 s. An import counts only when the client's own log reports the expected PBT root.`));
  // Hash links would reload the page (the hash selects the round), so these scroll instead.
  const jump = (label, id) => h('a', { class: 'chip', href: '', onclick: (e) => {
    e.preventDefault(); document.getElementById(id).scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
  } }, label);
  const linkRow = h('div', { class: 'row', style: 'gap:8px;margin-top:2px' },
    h('a', { class: 'chip', href: eipUrl(8347), target: '_blank', rel: 'noopener' }, 'EIP-8347 ↗'),
    h('a', { class: 'chip', href: eipUrl(8297), target: '_blank', rel: 'noopener' }, 'EIP-8297 ↗'),
    jump('client builds ↓', 'builds'),
    h('a', { class: 'chip', href: ctx.tree, target: '_blank', rel: 'noopener' }, 'raw data ↗'),
    jump('reproduce ↓', 'reproduce'));

  root.append(
    h('div', { class: 'row', style: 'gap:10px;align-items:center;margin-bottom:18px' },
      h('span', { class: 'lbl' }, 'Mainnet benchmark · EIP-8347 import'), h('span', { class: 'chip' }, `${round.label} · ${round.date}`)),
    h('h1', { class: 'h1' }, `One snapshot, ${['zero', 'one', 'two', 'three', 'four', 'five', 'six'][clients.length] ?? clients.length} clients, `,
      h('span', { class: 'glow' }, 'one root.')),
    ctxBlock, linkRow,
    h('div', { class: 'flow' }, anchor, arrow(), pairBox, arrow(), clientsBox, arrow(), rootBox),
  );
}
