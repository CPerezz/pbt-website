// Reproduce: every step from a bare machine to this page's numbers. Collapsed by default; one button copies the
// same steps as Markdown for a coding agent. Steps are data, rendered twice (page + Markdown), so they can't drift.
import { fmt, h, secHead, who } from './bench.js';

export default async function (root, ctx) {
  const { res } = ctx;
  const { rig, pair, round } = res;
  // Clients with a recipe in rounds.json (`reproduce`); `{field}` tokens are filled from the round's pair.
  const clients = res.clients.filter((c) => c.reproduce);
  const fill = (lines) => lines.map((l) => l.replace(/\{(\w+)\}/g, (_, k) => pair[k]));
  const perClient = (pick) => clients.map((c) => ({ client: c, lines: fill(pick(c)) }));

  const steps = [
    { line: `Give EL + CL ${rig.cores_measured} cores of their own and ${rig.mem_gib} GiB, no swap: one cgroup v2 slice made an exclusive cpuset partition.`,
      code: ['# systemd slice unit', '[Slice]', 'AllowedCPUs=<core-ids>', `MemoryMax=${rig.mem_gib}G`, 'MemorySwapMax=0', '',
        '# its cores leave every other slice',
        'echo <core-ids> > /sys/fs/cgroup/pbt.slice/cpuset.cpus.exclusive',
        'echo root > /sys/fs/cgroup/pbt.slice/cpuset.cpus.partition'] },
    { line: 'Build each client at the commit it ran.', perClient: perClient((c) => c.reproduce.build) },
    { line: `Export the snapshot pair with erigon at the anchor block. The pair (${fmt.gb(pair.snapshot_bytes + pair.preimages_bytes)}) is not hosted, so reproducing means exporting it yourself.`,
      code: [`git clone https://github.com/${pair.producer_build.repo} && git -C erigon checkout ${pair.producer_build.commit}   # ${pair.producer_build.ref}`,
        `erigon snapshots export-pbt --datadir <erigon-datadir> --out <pair>   # node stopped at block ${fmt.n(pair.anchor_block)}`,
        `jq -r .pbtRoot <pair>/pbt-snapshot.meta.json   # ${pair.pbt_root}`] },
    { line: 'Sync, then settle inside the limits (EL within 1 block of the CL head for 60 min) and pass every preflight check.',
      links: clients.map((c) => [`${c.name} preflight.txt`, ctx.src(`${c.id}/${c.baseline.phase}/preflight.txt`)]) },
    { line: 'Record 4 hours of block processing, then restart the node with the import flags; it keeps following the chain. Log every engine_newPayload latency and the cgroup\u2019s CPU, memory and I/O every 5 s.',
      perClient: perClient((c) => c.reproduce.import) },
    { line: `Done when the client logs the line below; the PBT root it reports must equal ${pair.pbt_root}.`,
      perClient: clients.map((c) => ({ client: c, lines: [`${c.reproduce.done}…`] })) },
    { line: 'Rebuild every number on this page from the raw files.', code: [`python3 build_results.py ${round.id}`] },
  ];

  // ---- Markdown for an agent ----
  const fence = (lines) => ['```sh', ...lines, '```'];
  const markdown = () => [
    `# Reproduce: EIP-8347 import benchmark, ${round.label} (${round.date})`,
    '',
    `Page: ${location.origin}${location.pathname}`,
    `Raw data: ${ctx.tree}`,
    '',
    `Goal: on a synced Ethereum mainnet node, import the EIP-8347 snapshot pair anchored at block ${pair.anchor_block} ` +
      `(expected PBT root ${pair.pbt_root}) into each client while it keeps validating blocks, and measure time, ` +
      'newPayload latency, CPU, memory, disk I/O and database growth against a 4-hour baseline.',
    '',
    ...steps.flatMap((st, i) => [
      `## ${i + 1}. ${st.line}`, '',
      ...(st.code ? [...fence(st.code), ''] : []),
      ...(st.perClient || []).flatMap(({ client, lines }) => [`### ${client.name}`, ...fence(lines), '']),
      ...(st.links || []).map(([t, u]) => `- ${t}: ${u}`), ...(st.links ? [''] : []),
    ]),
  ].join('\n');

  // ---- Page ----
  root.append(h('style', {}, `
    .agent { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 14px 16px; border: 1px solid rgba(51,255,51,.35);
      border-radius: 8px; background: rgba(51,255,51,.05); font-size: 13px }
    .repro summary { cursor: pointer; margin-top: 14px; color: var(--green); font-size: 12.5px; list-style: none; display: inline-flex; gap: 8px }
    .repro summary::-webkit-details-marker { display: none }
    .repro summary::before { content: '▸'; transition: transform .15s }
    .repro[open] summary::before { transform: rotate(90deg) }
    .pipe { position: relative; display: flex; flex-direction: column; gap: 30px; margin-top: 22px }
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

  const copyBtn = (label, text, cls = 'btn2') => {
    const btn = h('button', { class: cls, type: 'button' }, label);
    btn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(typeof text === 'function' ? text() : text);
      btn.textContent = 'copied ✓'; setTimeout(() => { btn.textContent = label; }, 1400);
    });
    return btn;
  };
  const code = (lines) => h('div', { class: 'codewrap' }, copyBtn('copy', lines.join('\n')), h('pre', { class: 'code' }, lines.join('\n')));
  const who16 = (c) => h('div', { style: 'margin-bottom:6px' }, who(c, 16, 'font-weight:400'));

  const pipe = h('div', { class: 'pipe' }, steps.map((st, i) => h('div', { class: 'step' },
    h('div', { class: 'step-n' }, String(i + 1)),
    h('div', { class: 'step-body' },
      h('div', { style: 'font-size:13px' }, st.line),
      st.code && code(st.code),
      st.perClient && h('div', { class: 'cols2' }, st.perClient.map(({ client, lines }) => h('div', {}, who16(client), code(lines)))),
      st.links && h('div', { class: 'row', style: 'gap:10px' },
        st.links.map(([t, u]) => h('a', { class: 'chip', href: u, target: '_blank', rel: 'noopener' }, `${t} ↗`)))))));

  root.append(
    secHead('Reproduce',
      'New rounds follow as clients get faster, and anyone can run one. This is the full recipe: machine limits, client builds, exporting the snapshot, the exact import commands, and the log check that makes a run count.'),
    h('div', { class: 'agent' },
      h('span', { style: 'flex:1 1 320px' }, 'Want to run a benchmark like this one? ',
        h('b', { style: 'color:var(--green)' }, 'Point your coding agent at these steps'),
        ': every command, commit and expected root, as Markdown.'),
      copyBtn('copy steps for your agent', markdown, 'btn')),
    h('details', { class: 'repro' }, h('summary', {}, `show the ${steps.length} steps`), pipe),
  );
}
