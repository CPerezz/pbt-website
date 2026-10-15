// Home page: live-data mini race inside the "Mainnet benchmarks" card. The whole card is one link, so nothing
// in here is a link of its own (provenance links live on the benchmarks page).
import { CLIENT, DATA, fmt, getJSON, h, onVisible, reveal, scale, who } from './benchmarks/bench.js';

const root = document.getElementById('race');
if (root) {
  try {
    const { rounds } = await getJSON(`${DATA}import/rounds.json`);
    const round = rounds.at(-1);
    const base = `${DATA}import/${round.id}/`;
    const res = await getJSON(`${base}results.json`);
    const max = Math.max(...res.clients.map((c) => c.imports[0].duration_s));
    const pct = scale(0, max, 6, 100);

    const bars = res.clients.map((c) => {
      const w = c.imports[0], col = CLIENT[c.id];
      const fill = h('div', { class: 'fill', style: `background:${col};box-shadow:0 0 10px ${col}` });
      onVisible(fill, () => { fill.style.width = `${pct(w.duration_s)}%`; });
      return h('div', { style: 'display:flex;flex-direction:column;gap:5px' },
        h('div', { class: 'row', style: 'justify-content:space-between;align-items:center' },
          who(c, 20), h('span', { style: `color:${col};font-weight:600;font-size:13px` }, fmt.dur(w.duration_s))),
        h('div', { class: 'track' }, fill));
    });

    const allVerified = res.clients.every((c) => c.imports[0].root_verified);
    const rootLine = h('div', { class: 'row', style: 'gap:6px;align-items:center;font-size:11px;color:#8F9A8F' },
      allVerified ? h('span', { style: 'color:#33FF33' }, '✓') : h('span', { style: 'color:#F0504A' }, '✗'),
      h('span', { title: res.pair.pbt_root }, 'same PBT root, verified by every client'));

    root.append(
      h('div', { class: 'row', style: 'justify-content:space-between;align-items:baseline;margin-bottom:16px' },
        h('span', { class: 'lbl' }, 'EIP-8347 import · mainnet'), h('span', { class: 'chip' }, `${round.label} · ${round.date}`)),
      h('div', { style: 'display:flex;flex-direction:column;gap:14px;margin-bottom:14px' }, ...bars),
      rootLine,
    );
  } catch (e) {
    console.error('race tile:', e);
    root.append(h('div', { class: 'cap' }, 'Could not load live benchmark data.'));
  }
}

reveal();
