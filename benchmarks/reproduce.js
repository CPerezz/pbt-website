// A numbered pipeline: every step it takes to get from a bare machine to this page's numbers.
import { h, hover, fmt, who } from './bench.js';

export default async function (root, ctx) {
  const { res } = ctx;
  const { rig, pair, round } = res;
  // Clients with a recipe in rounds.json (`reproduce`); `{field}` tokens are filled from the round's pair.
  const clients = res.clients.filter((c) => c.reproduce);
  const fill = (lines) => lines.map((l) => l.replace(/\{(\w+)\}/g, (_, k) => pair[k]));

  root.append(h('style', {}, `
    .pipe { position: relative; display: flex; flex-direction: column; gap: 30px; margin-top: 26px }
    .pipe::before { content: ''; position: absolute; left: 15px; top: 8px; bottom: 8px; width: 1px; background: var(--line) }
    .step { position: relative; display: flex; gap: 16px; align-items: flex-start }
    .step-n { flex: none; width: 32px; height: 32px; border-radius: 50%; border: 1px solid rgba(51,255,51,.45); background: var(--bg);
      display: flex; align-items: center; justify-content: center; font-family: VT323, monospace; font-size: 17px; color: var(--green); z-index: 1 }
    .step-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px }
    .cols2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; min-width: 0 }
    .cols2 > div { min-width: 0 }
    @media (max-width: 760px) { .cols2 { grid-template-columns: 1fr } }
    .codewrap { position: relative }
    .codewrap .btn2 { position: absolute; top: 6px; right: 6px; padding: 4px 9px; font-size: 10.5px }
    .code { background: rgba(255,255,255,.03); border: 1px solid var(--line); border-radius: 6px; padding: 34px 12px 10px;
      font-size: 11.5px; line-height: 1.55; overflow-x: auto; white-space: pre; margin: 0 }
  `));

  const head = h('div', { class: 'sec-head' },
    h('h2', { class: 'h2' }, 'Reproduce'),
    h('span', { class: 'cap' }, 'Every step from a bare machine to the numbers above.'));

  // Copyable code block with a copy button.
  const code = (lines) => {
    const text = lines.join('\n');
    const pre = h('pre', { class: 'code' }, text);
    const btn = h('button', { class: 'btn2', type: 'button' }, 'copy');
    btn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(text);
      btn.textContent = 'copied'; setTimeout(() => { btn.textContent = 'copy'; }, 1200);
    });
    return h('div', { class: 'codewrap' }, btn, pre);
  };

  const step = (n, line, ...body) => h('div', { class: 'step' },
    h('div', { class: 'step-n' }, String(n)),
    h('div', { class: 'step-body' }, h('div', { style: 'font-size:13px' }, line), ...body));

  const cols = (lines) => h('div', { class: 'cols2' }, clients.map((c) =>
    h('div', {}, h('div', { style: 'margin-bottom:6px' }, who(c, 16, 'font-weight:400')), code(fill(lines(c))))));

  // The line in each client's own log that ends the import window, read from its published stages.csv.
  const doneRows = clients.map((c) => {
    const w = c.imports.at(-1);
    const row = h('div', { style: 'display:grid;grid-template-columns:130px 1fr;gap:10px;align-items:baseline' },
      who(c, 16, 'font-weight:400'), h('span', { class: 'muted', style: 'font-size:11.5px' }, 'loading…'));
    ctx.csv(w.stages_src).then((rows) => {
      const done = rows.find((r) => r.stage.startsWith(c.reproduce.done));
      row.lastChild.replaceWith(hover(
        h('span', { style: 'font-size:11.5px' }, `"${done.stage}" → root `, h('b', { style: 'color:var(--green)' }, fmt.short(pair.pbt_root, 6, 4))),
        `${w.stages_src} · root verified: ${w.root_verified}`));
    }).catch(() => { row.lastChild.textContent = 'log unavailable'; });
    return row;
  });

  const pipe = h('div', { class: 'pipe' },
    step(1, `Give EL + CL ${rig.cores_measured} cores of their own and ${rig.mem_gib} GiB, no swap: one cgroup v2 slice made an exclusive cpuset partition.`,
      code([
        '# systemd slice unit',
        '[Slice]',
        'AllowedCPUs=<core-ids>',
        `MemoryMax=${rig.mem_gib}G`,
        'MemorySwapMax=0',
        '',
        '# its cores leave every other slice',
        'echo <core-ids> > /sys/fs/cgroup/pbt.slice/cpuset.cpus.exclusive',
        'echo root > /sys/fs/cgroup/pbt.slice/cpuset.cpus.partition',
      ])),
    step(2, 'Build each client at the commit it ran.', cols((c) => c.reproduce.build)),
    step(3, `Export the snapshot pair with erigon at the anchor block. The pair (${fmt.gb(pair.snapshot_bytes + pair.preimages_bytes)}) is not hosted, so reproducing means exporting it yourself.`,
      code([
        `git clone https://github.com/${pair.producer_build.repo} && git -C erigon checkout ${pair.producer_build.commit}   # ${pair.producer_build.ref}`,
        `erigon snapshots export-pbt --datadir <erigon-datadir> --out <pair>   # node stopped at block ${fmt.n(pair.anchor_block)}`,
        `jq -r .pbtRoot <pair>/pbt-snapshot.meta.json   # ${pair.pbt_root}`,
      ])),
    step(4, 'Sync, then settle inside the limits (EL within 1 block of the CL head for 60 min) and pass every preflight check.',
      h('div', { class: 'row', style: 'gap:10px' }, clients.map((c) =>
        h('a', { class: 'chip', href: ctx.src(`${c.id}/${c.baseline.phase}/preflight.txt`), target: '_blank', rel: 'noopener' }, `${c.name} preflight.txt ↗`)))),
    step(5, 'Record 4 hours of block processing, then restart the node with the import flags; it keeps following the chain. Log every engine_newPayload latency and the cgroup\u2019s CPU, memory and I/O every 5 s.',
      cols((c) => c.reproduce.import)),
    step(6, 'Done when the client logs the line below; the PBT root it reports must equal the snapshot\u2019s.',
      ...doneRows),
    step(7, 'Rebuild every number on this page from the raw files.',
      code([`python3 build_results.py ${round.id}`])),
  );

  root.append(head, pipe);
}
