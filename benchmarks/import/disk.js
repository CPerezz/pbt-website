// What the PBT adds on disk: database before → after per client, and bytes per PBT leaf.
import { COL, REDUCED, h, fmt, hover, num, onVisible } from '../bench.js';

const GREEN = COL.green;
const HATCH = `repeating-linear-gradient(135deg, rgba(51,255,51,.55) 0 4px, rgba(51,255,51,.12) 4px 9px)`;
const pctW = (v, max) => `${(v / max) * 100}%`;

export default async function (root, ctx) {
  const { res } = ctx;
  const max = Math.max(...res.clients.map((c) => c.sizes.after_gib));
  const grows = []; // [el, width] animated on visible

  const head = h('div', { class: 'sec-head' },
    h('h2', { class: 'h2' }, 'What the PBT adds'),
    h('span', { class: 'cap' }, 'Same tree, every client: database size before and after the import.'));

  const rows = res.clients.map((c) => {
    const z = c.sizes, col = ctx.color(c.id);
    const pbt = h('div', {
      style: `height:100%;width:0;transition:width 1.2s cubic-bezier(.2,.9,.25,1);background:${z.attributed ? HATCH : GREEN};` +
        (z.attributed ? `outline:1.5px dashed ${GREEN};outline-offset:-1.5px;` : `box-shadow:0 0 14px rgba(51,255,51,.35);`) +
        'border-radius:0 4px 4px 0;cursor:help',
    });
    grows.push([pbt, pctW(z.pbt_gib, max)]);
    hover(pbt, `<span class="lbl">PBT · ${z.pbt_gib} GiB</span><br>` +
      z.pbt_parts.map((p) => `${p.label} <b>${p.gib} GiB</b>`).join('<br>') +
      (z.attributed ? '<br><span class="lbl">attribution</span><br>growth of these db-inspect categories, not a direct measurement' : ''));
    const bars = h('div', { style: 'display:grid;gap:5px' },
      h('div', { style: `height:4px;border-radius:2px;width:${pctW(z.before_gib, max)};background:${COL.muted};opacity:.5` }),
      h('div', { style: 'display:flex;height:18px' },
        h('div', { style: `width:${pctW(z.after_gib - z.pbt_gib, max)};background:rgba(143,154,143,.35);border-radius:4px 0 0 4px` }),
        pbt));
    return h('div', { style: 'display:grid;grid-template-columns:minmax(80px,110px) minmax(0,1fr) auto;gap:14px;align-items:center' },
      h('span', { style: `color:${col};font-weight:600` }, h('span', { class: 'dot', style: `background:${col};margin-right:7px` }), c.name),
      bars,
      h('div', { style: 'text-align:right;white-space:nowrap' },
        h('div', { class: 'muted', style: 'font-size:11px' },
          num(`${fmt.n(z.before_gib, 1)}`, ctx.src(z.src[0])), ' → ', num(`${fmt.n(z.after_gib, 1)} GiB`, ctx.src(z.src[1]))),
        h('div', { class: 'big', style: `color:${GREEN}` }, '+', num(`${fmt.n(z.pbt_gib, 1)} GiB`, ctx.src(z.src[1])), h('span', { class: 'lbl', style: 'margin-left:6px' }, 'PBT'))));
  });

  const legend = h('div', { class: 'row lbl', style: 'gap:18px;margin-top:4px' },
    h('span', {}, h('span', { style: `display:inline-block;width:22px;height:4px;background:${COL.muted};opacity:.5;vertical-align:middle;margin-right:6px` }), 'before'),
    h('span', {}, h('span', { style: 'display:inline-block;width:22px;height:10px;background:rgba(143,154,143,.35);vertical-align:middle;margin-right:6px' }), 'after'),
    h('span', {}, h('span', { style: `display:inline-block;width:22px;height:10px;background:${GREEN};vertical-align:middle;margin-right:6px` }), 'PBT'),
    res.clients.some((c) => c.sizes.attributed) &&
      h('span', {}, h('span', { style: `display:inline-block;width:22px;height:10px;background:${HATCH};outline:1px dashed ${GREEN};vertical-align:middle;margin-right:6px` }), 'PBT, attributed'),
    h('span', { class: 'grow' }), h('span', {}, `0 → ${fmt.n(max, 0)} GiB`));

  // Bytes per PBT leaf, vs the snapshot file's bytes per leaf.
  const { leaves, snapshot_bytes } = res.pair;
  const snap = snapshot_bytes / leaves;
  const per = res.clients.map((c) => ({ c, b: (c.sizes.pbt_gib * 2 ** 30) / leaves }));
  const bmax = Math.max(...per.map((p) => p.b)) * 1.08;
  const leafRows = per.map(({ c, b }) => {
    const fill = h('div', { class: 'fill', style: `background:${ctx.color(c.id)};height:14px;border-radius:3px` });
    grows.push([fill, pctW(b, bmax)]);
    return h('div', { style: 'display:grid;grid-template-columns:minmax(80px,110px) minmax(0,1fr) 84px;gap:14px;align-items:center' },
      h('span', { style: `color:${ctx.color(c.id)}` }, c.name),
      h('div', { style: 'height:14px' }, fill),
      h('span', { class: 'big', style: 'font-size:26px;text-align:right' }, num(`${fmt.n(b, 1)} B`, ctx.src(c.sizes.src[1]))));
  });
  const refLine = h('div', {
    style: `position:absolute;top:-4px;bottom:-4px;left:calc(${pctW(snap, bmax)});border-left:1.5px dashed ${COL.ink2};pointer-events:none`,
  });
  const chip = hover(h('span', { class: 'chip', style: 'cursor:help' }, 'layouts differ'),
    'Each client stores the tree its own way; these are each client\'s real disk cost for the same tree.');
  const leafChart = h('div', { class: 'panel', style: 'margin-top:22px;display:grid;gap:10px' },
    h('div', { class: 'row', style: 'align-items:center;gap:10px' },
      h('span', { class: 'lbl' }, 'bytes per PBT leaf'),
      h('span', { class: 'muted', style: 'font-size:11px' }, num(fmt.n(leaves), ctx.src('results.json')), ' leaves'),
      h('span', { class: 'grow' }), chip),
    // the ref line sits in a box aligned with the bar column
    h('div', { style: 'display:grid;grid-template-columns:minmax(80px,110px) minmax(0,1fr) 84px;gap:14px' },
      h('span'),
      h('div', { style: 'position:relative;font-size:11px;color:var(--ink2);height:16px' },
        h('span', { style: `position:absolute;left:${pctW(snap, bmax)};transform:translateX(-50%);white-space:nowrap` },
          'snapshot file ', num(`${fmt.n(snap, 1)} B`, ctx.src('results.json'))))),
    h('div', { style: 'position:relative;display:grid;gap:10px' },
      ...leafRows,
      h('div', { style: 'position:absolute;inset:0;display:grid;grid-template-columns:minmax(80px,110px) minmax(0,1fr) 84px;gap:14px;pointer-events:none' },
        h('span'), h('div', { style: 'position:relative' }, refLine))));

  root.append(head, h('div', { class: 'panel', style: 'display:grid;gap:18px' }, ...rows, legend), leafChart);

  const go = () => grows.forEach(([el, w]) => { el.style.width = w; });
  if (REDUCED) go(); else onVisible(root, go, 0.2);
}
