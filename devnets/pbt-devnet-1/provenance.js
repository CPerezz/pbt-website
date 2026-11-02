import { COL, day, h, hover, num, s, secHead, term } from './kit.js';

export default async function (root, ctx) {
  const files = ['devnet.json', 'timeline.json', 'methods.json', 'validating.json', 'cost.json', 'fork.json', 'network.json'];
  const data = await Promise.all(files.map((file) => ctx.data(file)));
  const dualFrom = Math.min(...data[1].lanes.filter((lane) => lane.client === 'erigon').map((lane) => lane.dual_from));
  const rpc = () => hover(h('span', { class: 'term' }, 'RPC'), 'Remote procedure calls: queries to the clients for headers and state snapshots.');
  const arrow = () => h('div', { class: 'provenance-arrow', 'aria-hidden': 'true' },
    s('svg', { width: 28, height: 14, viewBox: '0 0 28 14' },
      s('path', { d: 'M0 7 H26 M20 1 L26 7 L20 13', fill: 'none', stroke: COL.green, 'stroke-width': 1.5 })));

  root.append(h('style', {}, `
    #provenance .provenance-chain { display: flex; align-items: stretch; gap: 12px }
    #provenance .provenance-chain .panel { flex: 1; min-width: 0 }
    #provenance .provenance-chain .provenance-files { flex: 1.35 }
    #provenance .provenance-arrow { display: flex; align-items: center; justify-content: center; flex: none }
    #provenance .provenance-chain p { margin: 10px 0 0; font-size: 12px; line-height: 1.65; color: var(--ink2) }
    #provenance .provenance-files .row { gap: 7px; margin-top: 12px }
    #provenance .provenance-not-in { margin-top: 16px }
    #provenance .provenance-not-in ul { margin: 10px 0 0; padding-left: 18px; color: var(--ink2); font-size: 12px; line-height: 1.65 }
    #provenance .provenance-not-in li + li { margin-top: 8px }
    @media (max-width: 760px) {
      #provenance .provenance-chain { flex-direction: column; gap: 8px }
      #provenance .provenance-arrow { height: 28px }
      #provenance .provenance-arrow svg { transform: rotate(90deg) }
    }
  `));

  root.append(secHead('Provenance', ['Every number comes from the devnet’s observations, derived into catalog views and exported as the JSON files linked below.']),
    h('div', { class: 'provenance-chain' },
      h('div', { class: 'panel' }, h('span', { class: 'lbl' }, 'Sources'),
        h('p', {}, 'The devnet’s central logs · Prometheus · xatu (beacon sentries) · the clients’ ', rpc())),
      arrow(),
      h('div', { class: 'panel' }, h('span', { class: 'lbl' }, 'Post-mortem catalog'),
        h('p', {}, h('b', {}, 'DuckDB views'), h('br'), 'Every raw pull derived into views; each file below names the views behind it.')),
      arrow(),
      h('div', { class: 'panel provenance-files' }, h('span', { class: 'lbl' }, 'The files this page reads'),
        h('div', { class: 'row' }, files.map((file, i) => hover(
          h('a', { class: 'chip', href: ctx.base + file, target: '_blank', rel: 'noopener', title: `Catalog views: ${data[i]._views.join(', ')}` }, file, ' ↗'),
          `<span class="lbl">catalog views</span><br><b>${file}</b><br>${data[i]._views.join('<br>')}`))))),
    h('div', { class: 'panel provenance-not-in' }, h('span', { class: 'lbl' }, 'Not in'),
      h('ul', {},
        h('li', {}, 'RPC and host snapshots end ', num('10-27', 'devnet.json', 'rpc_headers'), ' UTC: the gateway and hosts were gone at the final pull; post-fork per-block figures come from xatu.'),
        h('li', {}, 'erigon’s own migration path is not instrumented: its ', term('dual', 'binary commitment'), ' appears from ', num(day(dualFrom), 'timeline.json', 'c0_states'), ' UTC as a state, not a run.'),
        h('li', {}, 'Root agreement is sampled by our watch at shared heights, not something the nodes verify among themselves.'),
        h('li', {}, 'Memory excludes the ', num('ten minutes', 'cost.json', 'resources'), ' around each OOM kill in the by-state figures.'))),
    h('p', { class: 'reading' }, 'The catalog and the raw pulls are not published; the files above are the whole of what this page reads.'));
}
