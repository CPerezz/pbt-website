import { CLIENT, DATA, countUp, fmt, getJSON, h, hover, onVisible } from './bench.js';

const BASE = `${DATA}import/`;
const { rig, rounds } = await getJSON(`${BASE}rounds.json`);
const latest = rounds.at(-1);
const res = await getJSON(`${BASE}${latest.id}/results.json`);
const root = document.getElementById('hub');

// The test machine, drawn: measured cores lit, the shared memory limit.
const rigStrip = h('div', { class: 'row', style: 'gap:22px;align-items:center;margin-top:26px' },
  hover(h('div', { class: 'cores' }, Array.from({ length: rig.cores_total }, (_, i) => h('i', { class: i >= rig.cores_total - rig.cores_measured ? 'on' : '' }))),
    `${rig.cpu}: ${rig.cores_note}`),
  h('span', { class: 'chip' }, `${rig.cores_measured} of ${rig.cores_total} cores`),
  hover(h('span', { class: 'chip' }, `${rig.mem_gib} GiB · EL + CL`), rig.mem_note),
  hover(h('span', { class: 'chip' }, 'NVMe'), rig.disk),
  h('span', { class: 'chip' }, rig.cl),
  h('span', { class: 'chip' }, 'mainnet'));

// Import tile: a compact race of the latest round.
const max = Math.max(...res.clients.map((c) => c.imports[0].duration_s));
const lanes = res.clients.map((c) => {
  const w = c.imports[0];
  const fill = h('div', { class: 'fill', style: `background:${CLIENT[c.id]};box-shadow:0 0 10px ${CLIENT[c.id]}` });
  const t = h('span', {}, fmt.dur(w.duration_s)); // the tile is a link; provenance lives on the import page
  onVisible(fill, () => {
    fill.style.width = `${(w.duration_s / max) * 100}%`;
    countUp(t, w.duration_s, fmt.dur, 1200);
  });
  return h('div', { class: 'lane' },
    h('span', { style: `color:${CLIENT[c.id]};font-weight:600` }, c.name),
    h('div', { class: 'track', style: 'height:12px' }, fill),
    h('span', { class: 'big', style: 'font-size:22px;text-align:right' }, t));
});
const importTile = h('a', { class: 'tile', href: 'import/' },
  h('div', { class: 'row', style: 'justify-content:space-between;align-items:center' },
    h('span', { class: 'lbl', style: 'color:#33FF33' }, 'EIP-8347 import'),
    h('span', { class: 'pill on' }, `${latest.label} · ${latest.date}`)),
  h('div', { class: 'big' }, 'A synced node imports a shared PBT snapshot'),
  h('div', { style: 'display:flex;flex-direction:column;gap:10px;margin-top:6px' }, lanes),
  h('div', { class: 'row', style: 'justify-content:space-between;align-items:center;margin-top:4px' },
    h('span', { style: 'color:#33FF33;font-size:12px' }, `✓ same root · ${fmt.short(res.pair.pbt_root)}`),
    h('span', { class: 'btn2' }, 'Open →')));

const selfTile = h('div', { class: 'tile next', 'aria-disabled': 'true' },
  h('span', { class: 'lbl' }, 'Self-migration'),
  h('div', { class: 'big', style: 'color:#B9C2B9' }, 'A node builds the PBT from its own state'),
  h('span', { class: 'pill off', style: 'align-self:flex-start' }, 'next round'));

root.append(
  h('span', { class: 'lbl' }, 'PBT Lab · benchmarks'),
  h('h1', { class: 'h1', style: 'margin-top:14px' }, 'Mainnet, ', h('span', { class: 'glow' }, 'measured.')),
  rigStrip,
  h('div', { class: 'tiles' }, importTile, selfTile),
);
