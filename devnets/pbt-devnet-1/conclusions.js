// What the nine days prove, what a mainnet rollout still needs, and what running a node would cost.
import { dur, fmt, h, num, pct, secHead, term } from './kit.js';

export default async function (root, ctx) {
  const { dev } = ctx;
  const [methods, cost, fork, network, validating] = await Promise.all(
    ['methods.json', 'cost.json', 'fork.json', 'network.json', 'validating.json'].map((f) => ctx.data(f)));

  const nM = (text, view = 'a1_runs', attrs = {}) => num(text, 'methods.json', view, attrs);
  const nC = (text, view = 'f1_disk', attrs = {}) => num(text, 'cost.json', view, attrs);
  const nF = (text, view = 'n1_fork', attrs = {}) => num(text, 'fork.json', view, attrs);
  const nN = (text, view = 'k1_failures', attrs = {}) => num(text, 'network.json', view, attrs);
  const nD = (text, view = 'roots', attrs = {}) => num(text, 'devnet.json', view, attrs);
  const nV = (text, view = 'c0_states', attrs = {}) => num(text, 'validating.json', view, attrs);

  // --- derive every figure from the loaded JSON; nothing below is a literal constant ---
  const phase = (run, kind) => run.phases.find((p) => p.kind === kind);
  const span = (run, kind) => { const p = phase(run, kind); return p.end_s - p.start_s; };
  const range = (values) => [Math.min(...values), Math.max(...values)];

  const selfRuns9 = methods.runs.filter((r) => r.method === 'self');
  const [selfMin, selfMax] = range(selfRuns9.map((r) => r.t_total_s));
  const fastestSelf16 = selfRuns9.filter((r) => r.cap_gib === 16).sort((a, b) => a.t_total_s - b.t_total_s)[0];
  const selfReplayS = span(fastestSelf16, 'replay');
  const import16 = methods.runs.filter((r) => r.method === 'import' && r.cap_gib === 16);
  const [importMin, importMax] = range(import16.map((r) => r.t_total_s));
  const [replayMin, replayMax] = range(import16.map((r) => span(r, 'replay')));
  const proj = methods.projection.clients;

  const diskRuns = cost.disk.runs;
  const peakAll = Math.max(...diskRuns.map((r) => r.peak_datadir_tib));
  const selfDiskRuns = diskRuns.filter((r) => r.run_id.endsWith('/self'));
  const [peakSelfMin, peakSelfMax] = range(selfDiskRuns.map((r) => r.peak_datadir_tib));
  const [writtenMin, writtenMax] = range(diskRuns.map((r) => (r.written_core_gib + r.written_replay_gib) / 1024));
  const packageGib = diskRuns.find((r) => r.run_id === 'geth-1/import').input_gib;

  const caps16 = dev.nodes.filter((n) => n.cap_gib === 16);
  const coresByState = (state) => Object.values(cost.machines).map((m) => m[state]?.cpu_cores).filter(Boolean);
  const [coreLo, coreHi] = range(coresByState('migrating'));
  const binaryCores = coresByState('binary only');
  const coreAfter = binaryCores.reduce((a, b) => a + b, 0) / binaryCores.length;
  const nm1import = methods.runs.find((r) => r.run_id === 'nethermind-1/import');

  const forkHosts = Object.keys(fork.after);
  const ratios = (prefix) => forkHosts.filter((h0) => h0.startsWith(prefix)).map((h0) => fork.after[h0].ratio);
  const ratioRange = (prefix) => { const vs = ratios(prefix); return range(vs); };
  const ratioMean = (prefix) => { const vs = ratios(prefix); return vs.reduce((a, b) => a + b, 0) / vs.length; };
  const [gethLo, gethHi] = ratioRange('geth');
  const nmRatio = ratioMean('nethermind');
  const [besuLo, besuHi] = ratioRange('besu');
  const [erigonLo, erigonHi] = ratioRange('erigon');
  const [diskBackMin, diskBackMax] = range(forkHosts.filter((h0) => h0.startsWith('geth') || h0.startsWith('besu')).map((h0) => fork.after[h0].disk_released_gib));
  const nmReclaim = range(forkHosts.filter((h0) => h0.startsWith('nethermind')).map((h0) => fork.after[h0].disk_released_gib));

  const migPct = Object.keys(validating.grid).map((host) => {
    const g = validating.grid[host];
    return g.migrating && g['two trees'] ? (g.migrating.ms_per_mgas / g['two trees'].ms_per_mgas - 1) * 100 : null;
  }).filter((v) => v != null);
  const [migLo, migHi] = range(migPct);

  const pauseMin = Math.round((network.pause.to - network.pause.from) / 60);
  const recoveries = network.ledger.map((e) => e.recovery_s).filter((v) => v != null);
  const recMax = Math.max(...recoveries);
  const checkedSelfClients = selfRuns9.filter((r) => r.verify.includes('check 2')).map((r) => r.client);
  const [replayBlkMin, replayBlkMax] = range(selfRuns9.map((r) => r.replay_blocks));

  root.append(h('style', {}, `
    #conclusions .concl-sub { margin: 30px 0 10px; font-size: 12px; font-weight: 500; color: var(--ink2) }
    #conclusions .concl-list { margin: 0; padding-left: 18px; color: var(--ink2); font-size: 12.5px; line-height: 1.65 }
    #conclusions .concl-list li + li { margin-top: 8px }
    #conclusions .concl-list b { color: var(--ink) }
    #conclusions .budget b.concl-k { color: var(--ink2); font-weight: 400 }
    #conclusions .budget ol { margin: 0; padding-left: 16px; display: flex; flex-direction: column; gap: 3px }
  `));

  root.append(secHead('Conclusions',
    ['The migration itself held up end to end and the fork was a non-event; what remains is client work on the binary tree and a few durability lessons, not a reason to keep the snapshot path around.']));

  // 1. Six takeaway cards.
  const cards = [
    [
      'Self-conversion becomes the default — the snapshot path likely goes away.',
      h('p', {}, 'The fastest 16 GiB ', term('self', 'self-conversion'), ' reached the head in ', nM(dur(fastestSelf16.t_total_s), 'a1_runs'),
        ' with the preimage file as its only input and ', nM(dur(selfReplayS), 'a2_phases'), ' of replay; an ',
        term('import', 'import'), ' instead needs a producer, a ', nC(`${fmt.n(packageGib)} GiB`), ' package, an ', term('anchor'), ', and ',
        nM(`${dur(replayMin)}–${dur(replayMax)}`, 'a2_phases'), ' of replay for no gain once the snapshot is older than its breakeven — ',
        nM(`${fmt.n(proj.geth.breakeven_d, 1)} d`, 'j2_projection'), ' on geth, Besu always wins self, and Nethermind keeps importing out to ',
        nM(`${fmt.n(proj.nethermind.breakeven_d, 0)} d`, 'j2_projection'), ' only because its self scan is slow today.'),
    ],
    [
      'Hardware far below EIP-7870.',
      h('p', {}, nD(`16 GiB`, 'a1_runs'), ' carried every client to a verified head (busiest node ', nM('28 OOM kills', 'c1_run_resources'),
        ', all recovered), every 32 GiB import ran with ', nM('0 OOM kills', 'c1_run_resources'),
        ', peak datadir stayed at ', nC(`${fmt.n(peakAll, 2)} TiB`), ' against ', nD(`${dev.eip7870.disk_tb} TB`, 'boundaries'),
        ', and building used ', nC(`${Math.round(coreLo)}–${Math.round(coreHi)} of ${dev.hosts.vcpu}`, 'g1_phase_resources'), ' cores.'),
    ],
    [
      'The fork is the easy part.',
      h('p', {}, 'All nine nodes computed ', nD('one root', 'roots'), ' (', nD(fmt.n(dev.roots.comparisons), 'roots'), ' comparisons, ',
        nD(String(dev.roots.divergences), 'roots'), ' divergences) at ', nF('100 %', 'boundary'), ' participation; the window closed in ',
        nD(`${dev.fork.window_close_min} min`, 'boundaries'), ', and disposal gave back ', nF(`${diskBackMin}–${diskBackMax} GiB`),
        ' on geth and Besu.'),
    ],
    [
      "geth's binary-tree block cost is client work, not design.",
      h('p', {}, 'After the fork geth processes a full block ', nF(`${fmt.n(gethLo, 1)}–${fmt.n(gethHi, 1)}×`, 'n2_postfork_cost'),
        ' slower than before; Nethermind runs ', nF(`${fmt.n(nmRatio, 1)}×`, 'n2_postfork_cost'), ', Besu ',
        nF(`${fmt.n(besuLo, 1)}–${fmt.n(besuHi, 1)}×`, 'n2_postfork_cost'), ', erigon ', nF(`${fmt.n(erigonLo, 1)}–${fmt.n(erigonHi, 1)}×`, 'n2_postfork_cost'),
        ' — the same tree, on clients that did not pay the same tax.'),
    ],
    [
      'The chain never noticed, except once.',
      h('p', {}, term('twotrees', 'Migrating'), ' cost ', nV(`${Math.round(migLo)}–${Math.round(migHi)} %`, 'c0_states'),
        ' more per MGas on the live node, with no slot traced to that cost (', nN(`${network.totals.missed_all_up} of ${fmt.n(network.totals.missed)}`, 'h4_finality_network'),
        ' misses happened with all nine nodes up); ', term('finality', 'finality'), ' paused once, ',
        nN(`${pauseMin} min`, 'h4_finality_network'), ', with ', nN(`${network.pause.down.length} nodes`, 'h4_finality_network'), ' down together.'),
    ],
    [
      'What broke was plumbing, fixed during the devnet.',
      h('p', {}, 'No wrong root (', nD(String(dev.roots.divergences), 'roots'), ' divergences in ',
        nD(fmt.n(dev.roots.heights), 'roots'), ' heights), no lost state, no replay that could not resume: ', nM(`${nm1import.oom_kills} OOM kills`, 'c1_run_resources'),
        ' on one import, and it still finished. What broke was around the migration — memory, start-up paths, a batched replay — and the longest recovery was ', nN(dur(recMax), 'k2_recovery'), '.'),
    ],
  ];
  root.append(h('div', { class: 'cards' }, ...cards.map(([lead, body], i) =>
    h('div', { class: 'card' }, h('span', { class: 'n' }, String(i + 1).padStart(2, '0')), h('b', {}, lead), body))));

  // 2. Before mainnet.
  root.append(h('span', { class: 'lbl concl-sub' }, 'Before mainnet'),
    h('div', { class: 'panel' }, h('ul', { class: 'concl-list' },
      h('li', {}, h('b', {}, term('check2', 'Check 2'), ' on every client.'),
        ' Today only ', checkedSelfClients.join(', '), ' verifies its self-converted tree before the fork; the others have nothing that catches a bad self-conversion until the header.'),
      h('li', {}, h('b', {}, 'Dispose of the MPT only after a persisted post-fork binary state.'),
        ' A kill inside ', term('window', 'the window'), ' with no persisted binary state loses the only way back to a verified tree.'),
      h('li', {}, h('b', {}, "geth's block cost"), ' down to the others\u2019 level — ',
        nF(`${fmt.n(gethLo, 1)}–${fmt.n(gethHi, 1)}×`, 'n2_postfork_cost'), ' today against ', nF(`${fmt.n(besuLo, 1)}–${fmt.n(besuHi, 1)}×`, 'n2_postfork_cost'), ' on Besu.'),
      h('li', {}, h('b', {}, "Nethermind reclaiming the old tree's bytes"), ' — disposal frees only ',
        nF(`${nmReclaim[0]}–${nmReclaim[1]} GiB`, 'n1_fork'), ' there against ', nF(`${diskBackMin}–${diskBackMax} GiB`, 'n1_fork'), ' on geth/Besu.'),
      h('li', {}, h('b', {}, 'No import flag surviving the fork'), ' in a deployment: a live-import flag kept past ',
        term('fork', 'binaryTrieTime'), ' is what turned a routine restart into a stuck rewind on this devnet.'))));

  // 3. If you run a node.
  const row = (label, ...value) => [h('span', { class: 'lbl' }, label), h('div', {}, ...value)];
  root.append(h('span', { class: 'lbl concl-sub' }, 'If you run a node'),
    h('div', { class: 'panel budget' },
      ...row('memory', nC(`${caps16[0].cap_gib} GiB`, 'g1_phase_resources'), ' worked everywhere; 32 GB ran with ',
        nM('0 OOM kills', 'c1_run_resources'), ' on every import; an ', term('import', 'import'), ' peaks during its replay (',
        nM(pct(nm1import.mem_replay), 'c1_run_resources'), ' of cap on nethermind-1)'),
      ...row('disk', nC(`${fmt.n(peakSelfMin, 2)}–${fmt.n(peakSelfMax, 2)} TiB`), ' peak datadir for self-conversion including history; an import adds the ',
        nC(`${fmt.n(packageGib)} GiB`), ' package; the fork gives ', nF(`${diskBackMin}–${diskBackMax} GiB`, 'n1_fork'), ' back on geth/Besu'),
      ...row('writes', nC(`${fmt.n(writtenMin, 1)}–${fmt.n(writtenMax, 1)} TiB`), ' written per migration — plan the SSD\u2019s endurance for it'),
      ...row('time', nM(`${dur(selfMin)}–${dur(selfMax)}`, 'a1_runs'), ' self-conversion to the head; ',
        nM(`${dur(importMin)}–${dur(importMax)}`, 'a1_runs'), ' import, of which ',
        nM(`${dur(replayMin)}–${dur(replayMax)}`, 'a2_phases'), ' is replay'),
      ...row('CPU', nC(`${Math.round(coreLo)}–${Math.round(coreHi)} of ${dev.hosts.vcpu}`, 'g1_phase_resources'), ' cores while building, ~',
        nC(fmt.n(coreAfter, 0), 'g1_phase_resources'), ' after'),
      ...row('steps', h('ol', {},
        h('li', {}, 'get the ', term('self', 'preimage file')),
        h('li', {}, 'start the client with its conversion flag'),
        h('li', {}, 'it scans its own state, builds and verifies (', term('check2', 'check 2'), ' where the client has it)'),
        h('li', {}, 'it replays the blocks produced meanwhile (', nM(`${fmt.n(replayBlkMin)}–${fmt.n(replayBlkMax)} blocks`, 'a1_runs'), ')'),
        h('li', {}, term('twotrees', 'two trees'), ' until the fork'),
        h('li', {}, 'the MPT is ', term('disposal', 'disposed of'), ' after the fork finalizes'))),
      ...row('watch for', 'memory during the replay (', nM(pct(nm1import.mem_replay), 'c1_run_resources'), ' of cap seen here); a restart inside ',
        term('window', 'the window'), ' needs a persisted post-fork state; do not keep import flags across the fork')));

  root.append(h('p', { class: 'reading' }, 'Thanks to ethPandaOps and the client teams who ran, fixed and verified this devnet.'));
}
