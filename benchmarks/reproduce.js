// A numbered pipeline: every step it takes to get from a bare machine to this page's numbers.
import { h, hover, fmt, who } from './bench.js';

export default async function (root, ctx) {
  const { res } = ctx;
  const { rig, pair, clients, round } = res;
  const besu = clients.find((c) => c.id === 'besu');
  const nethermind = clients.find((c) => c.id === 'nethermind');

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
    .code { background: rgba(255,255,255,.03); border: 1px solid var(--line); border-radius: 6px; padding: 10px 46px 10px 12px;
      font-size: 11.5px; line-height: 1.55; overflow-x: auto; white-space: pre; margin: 0 }
  `));

  const head = h('div', { class: 'sec-head' },
    h('h2', { class: 'h2' }, 'Reproduce'),
    h('span', { class: 'cap' }, 'Every step from a bare machine to the numbers above — nothing on this page runs itself.'));

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

  // Each client's own build commands, from its builds[] entries (chips elsewhere on the page link the same repos).
  const buildCmds = (c) => {
    if (c.id === 'besu') {
      const besuBuild = c.builds.find((b) => b.repo.endsWith('/besu'));
      const slBuild = c.builds.find((b) => b.repo.endsWith('besu-stateless'));
      return [
        `git clone https://github.com/${slBuild.repo} <src>/besu-stateless && cd <src>/besu-stateless`,
        `git checkout ${slBuild.commit}   # ${slBuild.ref}`,
        `./gradlew build publishToMavenLocal -x test`,
        ``,
        `git clone https://github.com/${besuBuild.repo} <src>/besu && cd <src>/besu`,
        `git checkout ${besuBuild.commit}   # ${besuBuild.ref}`,
        `./gradlew installDist -x test`,
      ];
    }
    if (c.id === 'nethermind') {
      const base = c.builds.find((b) => b.commit);
      const fix = c.builds.find((b) => b.pr);
      return [
        `git clone https://github.com/${base.repo} <src>/nethermind && cd <src>/nethermind`,
        `git checkout ${base.commit}   # ${base.ref}`,
        fix ? `git fetch origin pull/${fix.pr}/head && git cherry-pick FETCH_HEAD   # ${base.repo}#${fix.pr}` : null,
        `dotnet publish src/Nethermind/Nethermind.Runner -c release -o <out> -p:BuildTimestamp=0`,
      ].filter(Boolean);
    }
    return c.builds.map((b) => `git clone https://github.com/${b.repo} <src> && git -C <src> checkout ${b.commit ?? `pull/${b.pr}/head`}`);
  };

  const buildCol = (c) => h('div', {},
    h('div', { style: 'margin-bottom:6px' }, who(c, 16, 'font-weight:400')),
    code(buildCmds(c)));

  // Import flags: far-future PBT fork schedule, same constant on both published clients (plan §3).
  const BT = 4100000000;
  const importFlagsCmds = (c) => {
    if (c.id === 'besu') return [
      `besu --network=mainnet --data-path=<datadir> ... \\`,
      `  --override-genesis-config=binaryTrieTime=${BT} \\`,
      `  --Xpbt-snapshot-file=<pair>/pbt-snapshot.bin \\`,
      `  --Xpbt-preimages-file=<pair>/framed.bin \\`,
      `  --Xpbt-snapshot-anchor-block-hash=${pair.anchor_hash}`,
    ];
    if (c.id === 'nethermind') return [
      `nethermind --config mainnet --data-dir <datadir> ... \\`,
      `  --Init.ChainSpecPath <chainspec-pbt.json> \\`,
      `  --Pbt.Enabled true --Sync.FastSync false \\`,
      `  --Pbt.MigrationSnapshotPath <pair>/pbt-snapshot.bin \\`,
      `  --Pbt.MigrationPreimagesPath <pair>/framed.bin \\`,
      `  --Pbt.MigrationAnchor ${pair.anchor_block}`,
    ];
    return [];
  };
  const flagsCol = (c) => h('div', {},
    h('div', { style: 'margin-bottom:6px' }, who(c, 16, 'font-weight:400')),
    code(importFlagsCmds(c)));

  // "Done" rows: fetch each client's own stages.csv and show the stage that gates the window — the same line
  // each harness script greps for before it trusts the root (plan §4).
  const doneMatch = { besu: 'bootstrapped from snapshot', nethermind: 'Imported the PBT migration anchor' };
  const doneRows = [besu, nethermind].map((c) => {
    const w = c.imports.at(-1);
    const row = h('div', { style: 'display:grid;grid-template-columns:130px 1fr;gap:10px;align-items:baseline' },
      who(c, 16, 'font-weight:400'), h('span', { class: 'muted', style: 'font-size:11.5px' }, 'loading…'));
    ctx.csv(w.stages_src).then((rows) => {
      const done = rows.find((r) => r.stage.includes(doneMatch[c.id])) ?? rows.at(-1);
      row.lastChild.replaceWith(hover(
        h('span', { style: 'font-size:11.5px' }, `"${done.stage}" → root `, h('b', { style: 'color:var(--green)' }, fmt.short(pair.pbt_root, 6, 4))),
        `${w.stages_src} · root_verified: ${w.root_verified}`));
    }).catch(() => { row.lastChild.textContent = 'log unavailable'; });
    return row;
  });

  const pairTotal = fmt.gb(pair.snapshot_bytes + pair.preimages_bytes);

  const pipe = h('div', { class: 'pipe' },
    step(1, `Reserve ${rig.cores_measured} of the box's ${rig.cores_total} cores and ${rig.mem_gib} GiB for EL + CL + the timing proxy, no swap, as one exclusive cgroup v2 partition.`,
      code([
        '# systemd slice unit',
        '[Slice]',
        'AllowedCPUs=<core-id-range>',
        `MemoryMax=${rig.mem_gib}G`,
        'MemorySwapMax=0',
        '',
        '# make it an exclusive cpuset partition: its cores leave every other slice',
        'echo <core-id-range> > /sys/fs/cgroup/pbt.slice/cpuset.cpus.exclusive',
        'echo root > /sys/fs/cgroup/pbt.slice/cpuset.cpus.partition',
      ])),
    step(2, 'Build each client at the commit it ran (chips in Setup → builds link the same source).',
      h('div', { class: 'cols2' }, buildCol(besu), buildCol(nethermind))),
    step(3, `Produce the snapshot pair once, with erigon, at the anchor — it is nobody's benchmark input to build, only to consume. The pair (${pairTotal}) is not hosted; reproducing this page means generating it yourself.`,
      code([
        'erigon snapshots export-pbt --datadir <erigon-datadir> --out <pair>',
        `# pbt-snapshot.meta.json.pbtRoot must equal ${fmt.short(pair.pbt_root, 6, 4)}`,
      ])),
    step(4, 'Sync outside the limits, settle inside them (EL within 1 block of the CL head for 60 min), then gate on a scripted preflight.',
      code([
        '# settle: head lag <= 1 block and >= 250 blocks advanced over the last 60 min',
        '# preflight: ~20 checks — sync state, idle disk, dropped page cache, cgroup limits, anchor canonical + finalized',
      ]),
      h('div', { class: 'row', style: 'gap:10px' }, ...[besu, nethermind].map((c) =>
        h('a', { class: 'chip', href: ctx.src(`${c.id}/${c.baseline.phase}/preflight.txt`), target: '_blank', rel: 'noopener' }, `${c.name} preflight.txt ↗`)))),
    step(5, '4 hours of ordinary block processing, then restart in place with the import flags — besu and Nethermind keep following the head throughout. Record every engine_newPayload latency and the service\u2019s cgroup CPU/memory/I/O every 5 s while it runs.',
      h('div', { class: 'cols2' }, flagsCol(besu), flagsCol(nethermind))),
    step(6, 'Done when the client\u2019s own log reports the line below and the snapshot\u2019s pbtRoot — that match is the whole point of the dual-check.',
      ...doneRows),
    step(7, 'Every number on this page is derived, not hand-typed — rebuild them from the raw files.',
      code([`python3 build_results.py ${round.id}`])),
  );

  root.append(head, pipe);
}
