// PBT content: every journey beat / atlas facet / why panel as data, with every number read from
// the fixture or recomputed via PBTCore. Captions come from scenario-bible.md.
(function (G) {
  const short = (h, a = 6, b = 4) => !h ? '' : (h.length <= a + b + 3 ? h : h.slice(0, a) + '…' + h.slice(-b));
  const commas = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fmtUnits = (wei, dec = 18) => { wei = BigInt(wei); const neg = wei < 0n; if (neg) wei = -wei; const base = 10n ** BigInt(dec), i = wei / base, f = (wei % base).toString().padStart(dec, '0').replace(/0+$/, ''); return (neg ? '-' : '') + commas(i.toString()) + (f ? '.' + f : ''); };
  const u = (hex, a, b) => BigInt('0x' + (hex.replace(/^0x/, '').slice(a * 2, b * 2) || '0'));
  const decodeBasic = v => ({ version: Number(u(v, 0, 1)), codeSize: Number(u(v, 4, 8)), nonce: Number(u(v, 8, 16)), balance: u(v, 16, 32) });
  const TAG = { keccak: 'KECCAK-256 · EVM · permanent', blake3: 'key_hash = BLAKE3 · tree · not final', none: 'no hash' };

  function makeCtx(fx, C, W, combined) {
    const J = id => fx.journeys.find(j => j.id === id);
    const A = {}; Object.entries(fx.world.accounts).forEach(([k, v]) => A[k] = v.address);
    Object.entries(fx.world.contracts).forEach(([k, v]) => A[k] = v.address);
    const hx = b => C.b2hex(b);
    const hdr = (lab, sub) => hx(C.E.headerKey(A[lab], sub));
    const stemOf = lab => hx(C.E.headerStem(A[lab]));
    const code = { VT: J('J3').derivation_steps[1].output, Mega: J('J2').derivation_steps[1].output, Eph: J('J11b').phases.create.writes.find(w => w.key.endsWith('01') && w.key.startsWith('0x00')).after };
    const chunkKey = (which, i) => hx(C.E.codeChunkKey(code[which], i));
    const codeStem = (which, g = 0) => chunkKey(which, g * 256).slice(0, 68);
    const megaSlot = holder => C.E.mappingSlot(A[holder], 4);
    const stor = holder => hx(C.E.storageKey(A.MegaToken, megaSlot(holder)).key);
    const bucket = lab => hx(C.cat([0xff], C.blake3(C.addr32(A[lab]))));
    // key -> human label
    const stems = {}; Object.keys(A).forEach(l => stems[stemOf(l)] = l);
    const cstems = { [codeStem('VT')]: ['VaultTemplate code', 0], [codeStem('Mega')]: ['MegaToken code', 0], [codeStem('Mega', 1)]: ['MegaToken code', 1], [codeStem('Eph')]: ['Ephemeral code', 0] };
    const holders = {}; ['Acct0', 'Acct4', 'Acct5', 'Acct6', 'Acct7', 'Acct8'].forEach(h => holders[stor(h)] = h);
    const VARS = { MegaToken: ['name', 'symbol', 'totalSupply', 'owner+paused'], VaultTemplate1: ['owner', 'balance'], VaultTemplate2: ['owner', 'balance'], VaultTemplate3: ['owner', 'balance'], VaultTemplate4: ['owner', 'balance'] };
    let alias = null;
    const nice = l => (alias && alias[l]) || l.replace(/^VaultTemplate(\d)$/, 'VaultTemplate #$1');
    function describe(key) {
      key = key.toLowerCase(); const z = key.slice(2, 4), sub = parseInt(key.slice(-2), 16);
      if (z === '00') {
        const lab = stems[key.slice(0, 68)] || 'account';
        const s = sub === 0 ? 'BASIC_DATA' : sub === 1 ? 'CODE_HASH' : sub === 2 ? 'DELEGATION' : (sub >= 64 && sub < 128 ? `slot ${sub - 64}` + (VARS[lab] && VARS[lab][sub - 64] ? ` (${VARS[lab][sub - 64]})` : '') : `sub ${sub}`);
        return { who: nice(lab), what: s, zone: 0 };
      }
      if (z === '01') { const c = cstems[key.slice(0, 68)]; return { who: c ? c[0] : 'code', what: `chunk ${(c ? c[1] * 256 : 0) + sub}`, zone: 1 }; }
      if (z === 'ff') { const h = holders[key]; return { who: 'MegaToken storage', what: h ? `balanceOf[${h}]` : `sub ${sub}`, zone: 255 }; }
      return { who: 'reserved', what: '', zone: 2 };
    }
    return { fx, C, W, J, A, hdr, stemOf, code, chunkKey, codeStem, megaSlot, stor, bucket, describe, nice, combined, short, fmtUnits, decodeBasic, commas, TAG, setAlias: a => { alias = a; } };
  }

  // helpers building diagram steps
  const box = (l, v, sub, full) => ({ k: 'box', l, v, sub, full: full || v });
  const arr = (tag, t, sol) => ({ k: 'arrow', tag, t, sol: !!sol });

  function build(x) {
    const { C, W, J, A, hdr, chunkKey, codeStem, stor, short, fmtUnits, decodeBasic } = x;
    const apply = (pre, writes) => C.applyWrites(new Map(pre), writes);
    const hr = j => j.hashes_recomputed.branches_recomputed;
    const J1 = J('J1'), J2 = J('J2'), J3 = J('J3'), J4a = J('J4a'), J4b = J('J4b'), J4c = J('J4c'), J5 = J('J5'), J6 = J('J6'), J7 = J('J7'), J8 = J('J8'), J9 = J('J9'), J10 = J('J10'), J11a = J('J11a'), J11b = J('J11b');
    const out = s => s.output;
    const create = (sender, nonce) => { const s = C.hex2b(sender), nb = nonce === 0 ? [0x80] : [nonce], pl = C.cat([0x94], s, nb), rlp = C.cat([0xc0 + pl.length], pl); return { rlp: C.b2hex(rlp), dig: C.b2hex(C.keccak256(rlp)) }; };
    const mapStep = (holder, base) => { const pre = C.cat(C.addr32(A[holder]), C.u256be(base)); const sk = C.keccak256(pre); const big = BigInt(C.b2hex(sk)); return { pre: C.b2hex(pre), sk: C.b2hex(sk), ti: '0x' + (big / 256n).toString(16), sub: Number(big % 256n) }; };
    const S = { VT: codeStem('VT'), M0: codeStem('Mega', 0), M1: codeStem('Mega', 1), E: codeStem('Eph') };
    const W1 = W.W1;
    const jr = (j, extra) => Object.assign({ id: j.id, title: j.title, pre: j.pre_root, post: j.post_root, preState: j.pre_state }, extra);

    // ---------------- J1 (v4: sender + recipient only; recipient uses the fixture's Acct9 address, shown as Acct1) ----------------
    const j1s = J1.derivation_steps, w1 = J1.writes, ec = j1s[5].inputs;
    const a0 = hdr('Acct0', 0), r0 = hdr('Acct9', 0), r1 = hdr('Acct9', 1);
    const wr = [{ key: r0, before: null, after: w1[1].after, action: 'insert' }, { key: r1, before: null, after: w1[2].after, action: 'insert' }];
    const W1a = apply(W1, [w1[0]]), W1b = apply(W1, [w1[0], ...wr]);
    const econ = { value: String(ec.value), gas: ec.gas_used, base: ec.base_fee_wei, tip: ec.priority_fee_wei };
    const J1o = jr(J1, {
      short: 'Send ETH', teaches: 'Find the sender and update it in place. The recipient is missing, so the tree grows a new path for it.', links: [], alias: { Acct9: 'Acct1' },
      beats: [
        { id: 'J1.B1', name: 'The transaction', cap: 'A plain {b|value transfer}. First, the tree has to find both accounts.', w: W1, tier: 'tree', noLayout: true, focus: [a0],
          fx: Object.assign({ kind: 'tx', from: 'Acct0', to: 'Acct9' }, econ) },
        { id: 'J1.B2', name: 'Sender · derive its key', cap: 'Turn the {a|sender}\'s address into a {g|34-byte tree key}.', w: W1, tier: 'zone', zone: 0, layout: 'Acct0', layoutRole: 'sender', focus: [a0],
          fx: { kind: 'derive', lab: 'Acct0', role: 'sender' } },
        { id: 'J1.B3', name: 'Sender · walk the trie', cap: 'Follow the key {g|bit by bit} from the root down to the {a|sender}\'s leaf.', w: W1, tier: 'zone', zone: 0, follow: 'path', layout: 'Acct0', layoutRole: 'sender', walk: a0,
          fx: { kind: 'walk', role: 'sender' } },
        { id: 'J1.B4', name: 'Sender · read BASIC_DATA', cap: 'The leaf holds {b|BASIC_DATA}: 32 bytes, five packed fields.', w: W1, tier: 'node', zone: 0, follow: 'path', layout: 'Acct0', layoutRole: 'sender', layoutRead: true, focus: [a0], path: [a0],
          fx: { kind: 'decode', value: w1[0].before } },
        { id: 'J1.B5', name: 'Sender · compute and write', cap: 'New nonce and balance, packed back into the {b|same leaf}.', w: W1a, tier: 'node', zone: 0, follow: 'path', layout: 'Acct0', layoutRole: 'sender', focus: [a0], path: [a0],
          fx: Object.assign({ kind: 'ledger', before: w1[0].before, after: w1[0].after, to: 'Acct9' }, econ) },
        { id: 'J1.B6', name: 'Recipient · derive its key', cap: 'Same recipe for the {a|recipient}.', w: W1a, tier: 'zone', zone: 0, layout: 'Acct9', layoutRole: 'recipient',
          fx: { kind: 'derive', lab: 'Acct9', role: 'recipient' } },
        { id: 'J1.B7', name: 'Recipient · walk finds nothing', cap: 'The walk lands on a {b|different leaf}: the {a|recipient} is not in the tree.', w: W1a, tier: 'zone', zone: 0, follow: 'path', layout: 'Acct9', layoutRole: 'recipient', walk: r0,
          fx: { kind: 'walk', role: 'recipient' } },
        { id: 'J1.B8', name: 'Recipient · create the account', cap: 'Grow a new {g|path}, then the {a|account}: a split, a stem opening, two leaves.', w: W1b, preW: W1a, tier: 'node', minR: 7, zone: 0, follow: 'path', layout: 'Acct9', layoutRole: 'recipient', focus: [r0, r1], path: [r0], autoLabel: false,
          fx: { kind: 'grow', keys: [r0, r1], value: w1[1].after } },
        { id: 'J1.B9', name: 'Root recompute', cap: 'Rehash {g|only the touched paths}, bottom-up, into a new root.', w: W1b, tier: 'tree', follow: 'path', noLayout: true,
          wave: [w1[0].key, r0, r1], fx: { kind: 'root' } },
      ] });
    J1o.post = C.rootOf(W1b); J1o.derived = true; J1o.writesV4 = [w1[0], ...wr];

    // ================= v6 · shared window builders =================
    const VM = '#D55E00', G = '#33FF33', BL = '#6CB8EA', AM = '#E69F00', MINT = '#1FC08F', OR = '#FF9F43', RED = '#F0504A', INK = '#E2E6E2', MUT = '#8F9A8F', LIL = '#B57BFF';
    const KEMPTY = '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470';
    const { code } = x;
    const hb = h => (h || '').replace(/^0x/, '').toLowerCase().match(/../g) || [];
    const cs = (hex, s, stag) => hb(hex).map((t, i) => ({ t, s, dl: stag ? i * stag : undefined }));
    const seq = (kicker, fact, n, fn, o) => Object.assign({ kind: 'seq', kicker, fact, frames: Array.from({ length: n }, (_, k) => fn(k)) }, o || {});
    const seqF = (kicker, fact, frames, o) => Object.assign({ kind: 'seq', kicker, fact, frames }, o || {});
    const sp = (from, n, l, c, o) => Object.assign({ from, n, l, c }, o || {});
    const pips = (ls, cur) => ls.map((l, i) => ({ l: (i < cur ? '✓ ' : '') + l, st: i < cur ? 'done' : i === cur ? 'cur' : 'todo' }));
    const party = (role, name, addr, st, ok) => ({ role, name, addr: addr ? short(addr, 10, 8) : '', st, ok });
    const flow = (from, to, tok, o) => Object.assign({ from, to, tok }, o || {});
    const gridOf = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));
    const ghost32 = n => gridOf(n || 32, () => ({ t: '', s: 'ghost' }));
    const BIN = n => { const e = Object.entries((x.combined && x.combined.contracts) || {}).find(([k]) => k.split(':')[1] === n); return e ? e[1]['bin-runtime'] : ''; };
    const nameOfAddr = a => { a = '0x' + a.replace(/^0x/, '').toLowerCase().slice(-40); const l = Object.keys(A).find(q => A[q].toLowerCase() === a); return l ? x.nice(l) : short(a, 6, 4); };
    const lk = k => k.toLowerCase();
    const vstr = (w, v) => { const d = x.describe(w.key).what; if (/totalSupply/.test(d)) return fmtUnits(BigInt(v)) + ' MEGA';
      if (/owner/.test(d)) return nameOfAddr(v.slice(-40)) + (/paused/.test(d) ? ' · paused ' + (parseInt(v.slice(24, 26), 16) ? 'true' : 'false') : '');
      if (/name|symbol/.test(d)) { const n = parseInt(v.slice(-2), 16); if (!(n % 2) && n <= 62) return '"' + (v.slice(2, 2 + n).match(/../g) || []).map(c => String.fromCharCode(parseInt(c, 16))).join('') + '"'; }
      if (/\(balance\)/.test(d)) return fmtUnits(BigInt(v)) + ' ETH'; return short(v); };
    const wval = (w, v) => { if (v == null) return '—'; const d = x.describe(w.key), wh = d.what;
      if (wh === 'BASIC_DATA') { const q = decodeBasic(v); return `nonce ${q.nonce} · ${fmtUnits(q.balance)} ETH` + (q.codeSize ? ` · code ${q.codeSize} B` : ''); }
      if (wh === 'CODE_HASH') return v === KEMPTY ? 'keccak("") · no code' : short(v) + (v === code.VT ? ' → VaultTemplate code' : v === code.Mega ? ' → MegaToken code' : '');
      if (wh === 'DELEGATION') return '0xef0100 ‖ ' + nameOfAddr(v.slice(8, 48));
      if (d.zone === 255) return fmtUnits(BigInt(v)) + ' MEGA';
      return vstr(w, v); };
    const TAGC = { insert: [G, '+ new'], update: [OR, '~ updated'], delete: [RED, '− removed'] };
    const wrow = (w, o) => { const d = x.describe(w.key), t = TAGC[w.action] || [INK, ''];
      const val = w.action === 'delete' ? wval(w, w.before) : w.action === 'update' ? `${wval(w, w.before)} → ${wval(w, w.after)}` : wval(w, w.after);
      return Object.assign({ l: (d.who !== 'account' ? d.who + ' · ' : '') + d.what, sub: val, v: t[1], vc: t[0], fs: '18px', pills: [] }, o || {}); };
    const diffT = (before, after, on, labs, upd) => { const b0 = hb(before || '0x' + '00'.repeat(32)), b1 = hb(after || '0x' + '00'.repeat(32)), ch = b1.filter((t, i) => t !== b0[i]).length;
      return [{ l: labs[0], lc: on ? RED : MUT, h: '22px', fs: '10px', cells: b0.map((t, i) => ({ t, s: on && t !== b1[i] ? 'RED' : on ? 'dim' : 'plain', dl: i * 16 })) },
        { l: labs[1], lc: upd ? OR : G, r: on ? `${ch} of 32 bytes changed` : '', h: '22px', fs: '10px', cells: b1.map((t, i) => ({ t, s: on && t !== b0[i] ? (upd ? 'OR' : 'G') : on ? 'dim' : 'plain', dl: i * 16 })) }]; };
    const rootFx = done => ({ kind: 'root', done });
    const hashTrack = (l, tag, c) => ({ l, lc: c, cells: ghost32(), hash: { tag, c } });
    const hdone = (t, tag, c) => Object.assign(t, { hash: { tag, c, done: true } });
    const basicTrack = (v, l, lc) => { const q = decodeBasic(v); return { l, lc: lc || G, h: '24px', fs: '10px', cells: hb(v).map((t, i) => ({ t, s: i < 4 ? 'zero' : i < 8 ? 'am' : i < 16 ? 'bl' : 'plain', dl: i * 12 })),
      spans: [sp(5, 4, 'code_size', AM, { v: String(q.codeSize) }), sp(9, 8, 'nonce', BL, { v: String(q.nonce) }), sp(17, 16, 'balance', INK, { v: fmtUnits(q.balance) + ' ETH' })] }; };
    const stemGrid = (l, r, fn) => ({ l, r, cells: gridOf(256, fn) });
    const hdrCell = (subs, extra) => i => (extra && extra(i)) || (subs.has(i) ? 'bl' : i < 3 ? 'hdr' : i >= 64 && i < 128 ? 'band' : 'off');
    const createFx = (senderLab, nonce, name, addr) => { const c = create(A[senderLab], nonce), rb = hb(c.rlp), db = hb(c.dig), P = [0, 1, 2, 2, 3];
      const rlpT = { l: `RLP([sender, nonce]) · ${rb.length} bytes`, lc: INK, cells: rb.map((t, i) => ({ t, s: i < 2 ? 'wh' : i < rb.length - 1 ? 'bl' : 'am', dl: i * 20 })), spans: [sp(1, 2, 'headers', MUT, { al: 'left' }), sp(3, rb.length - 3, 'sender · 20 B', BL), sp(rb.length, 1, 'nonce', AM, { al: 'right' })] };
      return seq('Contract address · CREATE', { l: 'Address', v: `${name} · ${short(addr, 6, 4)}`, c: BL }, 5, k => ({
        title: k < 4 ? `Where will ${name} live?` : `${name} lives at ${short(addr, 8, 6)}`,
        pips: pips(['sender + nonce', 'RLP', 'keccak256', 'last 20 bytes'], P[k]), auto: k === 2 ? 2600 : undefined,
        bigs: k === 0 ? [{ l: 'sender', v: x.nice(senderLab), c: BL }, { l: 'its nonce', v: String(nonce), c: INK }] : k === 4 ? [{ l: 'new address', v: short(addr, 10, 8), c: G, hl: true }] : [],
        tracks: [...(k >= 1 ? [rlpT] : []), ...(k === 2 ? [hashTrack('keccak256 · hashing…', 'keccak256', INK)] : []),
          ...(k >= 3 ? [hdone({ l: 'keccak256 · 32 bytes', lc: INK, cells: db.map((t, i) => ({ t, s: k >= 4 ? (i < 12 ? 'dim' : 'G') : 'wh', dl: i * 26 })), spans: k >= 4 ? [sp(1, 12, 'dropped', MUT), sp(13, 20, 'address · last 20 bytes', G)] : [] }, 'keccak256', INK)] : [])],
        narr: [`Nobody picks a contract's address. It follows from the deployer (${x.nice(senderLab)}) and its nonce (${nonce}).`, 'RLP-encode the pair: two header bytes, the 20-byte sender, then the nonce.', 'Hash those bytes with keccak256, the EVM\u2019s own hash…', '…out come 32 bytes.', `Keep the last 20. From here on the tree treats ${name} like any account: its key will be BLAKE3 of this address.`][k] })); };
    const depFx = (senderLab, nonce, name, bin, size, checks, extraNarr) => { const rowsOf = s => [0, 1, 2, 3, 4, 5].map(r => ({ t: (bin.slice(r * 24, r * 24 + 24).match(/../g) || []).join(' '), s, dl: r * 160 }));
      return seq('The transaction · deployment', { l: 'Deploy', v: `${name} · ${size} B of code`, c: INK }, 4, k => ({ title: `${x.nice(senderLab)} deploys ${name}`,
        dep: { from: { role: 'deployer · pays gas', name: x.nice(senderLab), addr: short(A[senderLab], 8, 6), pill: `nonce ${nonce}` }, a1: k >= 1, a2: k >= 2,
          code: { hide: k < 1, l: k >= 2 ? 'returned · runtime code' : 'tx payload · init code', lc: k >= 2 ? AM : MUT, bc: k >= 2 ? AM : 'rgba(226,230,226,.2)', r: k >= 2 ? size + ' B' : 'no recipient', rows: rowsOf(k >= 2 ? 'am' : 'on'), foot: k >= 2 ? `… ${size - 72} more bytes` : 'the EVM runs it once: the constructor' },
          to: { hide: k < 2, role: 'new account', name, addr: 'address: derived next', st: '∅ not in the tree', ok: false } },
        checks: k >= 3 ? checks : [],
        narr: [`${x.nice(senderLab)} sends a transaction with no recipient.`, 'Its payload is code. The EVM runs it once, as the constructor.', `The constructor returns ${size} bytes of runtime code: what ${name} will run from now on. It needs an account to live in.`, extraNarr || 'For the tree, a deployment is four jobs.'][k] })); };
    const codeHashFx = (name, bin, size, hash) => seq('Code hash', { l: 'code_hash', v: short(hash, 8, 6), c: AM }, 3, k => ({ title: k < 2 ? `${size} bytes of runtime code` : 'One hash names the code', auto: k === 1 ? 2600 : undefined,
      tracks: [{ l: `runtime code · bytes 0–31 of ${size}`, lc: INK, cells: cs('0x' + bin.slice(0, 64), 'plain') }, ...(k === 1 ? [hashTrack(`keccak256(code) · hashing all ${size} bytes…`, 'keccak256', INK)] : []),
        ...(k === 2 ? [hdone({ l: 'keccak256(code) · 32 bytes', lc: AM, cells: cs(hash, 'am', 26), spans: [sp(1, 32, 'code_hash · the same value EXTCODEHASH returns', AM)] }, 'keccak256', INK)] : [])],
      narr: [`The runtime code: what runs whenever someone calls ${name}.`, 'Hash all of it with keccak256…', 'The tree files code under this hash, not under the contract\u2019s address. Identical code gives an identical hash.'][k] }));
    const tapeFrames = (name, bin, size, nCh) => { const R = Math.min(nCh, 24), more = nCh > R ? ` · first ${R} of ${nCh}` : '', chs = C.E.chunkify(C.hex2b(bin));
      const tape = (lead, st) => gridOf(R * (lead ? 32 : 31), i => { const w = lead ? 32 : 31, r = Math.floor(i / w), c = i % w; if (lead && c === 0) return 'lead'; const bi = r * 31 + c - (lead ? 1 : 0); return bi >= size ? 'off' : st(r); });
      return [
        { title: `${size} bytes, one long string`, grids: [{ l: `${name} runtime code · ${size} bytes`, r: 'as the EVM sees it', cols: 31, h: '5px', cells: tape(false, () => 'byte') }], narr: 'To the EVM, code is one long byte string.' },
        { title: `Cut every 31 bytes → ${nCh} pieces`, grids: [{ l: `${nCh} pieces of 31 bytes${more}`, r: 'boundaries ignore instructions', lc: AM, cols: 31, h: '5px', rowStag: 90, cells: tape(false, r => r % 2 ? 'amb' : 'am') }], narr: 'Cut it every 31 bytes, whatever instruction happens to sit on a boundary.' },
        { title: 'Each piece gets a byte 0', grids: [{ l: `${nCh} chunks × 32 bytes${more}`, r: 'white = byte 0', lc: AM, cols: 32, h: '5px', rowStag: 60, cells: tape(true, r => r % 2 ? 'amb' : 'am') }], narr: 'Each piece gets one leading byte: how many of its first bytes are PUSH data spilling over from the piece before. 1 + 31 = 32 bytes, one leaf value.' },
        { title: 'Chunk 0, up close', tracks: [{ l: 'chunk 0 · leaf value · 32 bytes', lc: AM, cells: [{ t: hb(C.b2hex(chs[0].bytes))[0], s: 'WH' }, ...cs('0x' + bin.slice(0, 62), 'am', 20)], spans: [sp(1, 1, 'byte 0', INK, { al: 'left', v: String(chs[0].lead) }), sp(2, 31, '31 bytes of code', AM)] }],
          narr: `Here byte 0 is ${chs[0].lead}. With it, a verifier can tell real jump targets from PUSH data without the previous chunk.` }]; };
    const chunkKeyFrames = (hash, dg, id) => { id = id || 0; const g = Math.floor(id / 256), sub = id % 256, subH = sub.toString(16).padStart(2, '0'), P = ['code_hash ‖ tree_index', 'BLAKE3', 'zone + sub'];
      const ti = { l: `tree_index = ${id} ÷ 256 = ${g} · 32 bytes`, lc: INK, cells: gridOf(32, i => ({ t: i < 31 ? '00' : g.toString(16).padStart(2, '0'), s: i < 31 ? 'zero' : 'WH' })) }, ch = { l: 'code_hash', lc: AM, cells: cs(hash, 'am') };
      return [
        { title: `Where does chunk ${id} go?`, pips: pips(P, 0), tracks: [ch, ti], narr: 'A chunk\u2019s key starts from two inputs: the code_hash and its group number, tree_index = chunk ÷ 256.' },
        { title: `Where does chunk ${id} go?`, auto: 2600, pips: pips(P, 1), tracks: [ch, ti, hashTrack('key_hash · hashing…', 'BLAKE3', G)], narr: 'Hash both with key_hash (BLAKE3)…' },
        { title: 'The group\u2019s stem', pips: pips(P, 1), tracks: [ch, ti, hdone({ l: 'BLAKE3(code_hash ‖ tree_index) · 32 bytes', lc: G, cells: cs(dg, 'g', 24) }, 'BLAKE3', G)], narr: `…32 bytes shared by chunks ${g * 256}–${g * 256 + 255} of this code: the group\u2019s stem.` },
        { title: `Chunk ${id}\u2019s tree key`, pips: pips(P, 3), tracks: [{ l: `chunk ${id} key · 34 bytes · 272 bits`, lc: AM, cells: [{ t: '01', s: 'AM' }, ...cs(dg, 'g'), { t: subH, s: 'WH' }], spans: [sp(1, 1, 'zone 0x01', AM, { al: 'left' }), sp(2, 32, 'group stem', G), sp(34, 1, 'sub ' + sub, INK, { al: 'right' })] }],
          narr: `Zone byte 0x01 (code) in front, the chunk\u2019s place in its group (${sub}) at the end. These 34 bytes are the path to follow in the tree.` }]; };
    // storage key for a mapping entry, with keccak and two BLAKE3 animations
    const mapFx = (holder, o) => { o = o || {}; const m = mapStep(holder, 4), sk = C.E.storageKey(A.MegaToken, BigInt(m.sk)), kh = C.b2hex(sk.key), bucketH = '0x' + kh.slice(4, 68), groupH = '0x' + kh.slice(68, 132), pre = hb(m.pre), who = x.nice(holder);
      const a32 = C.b2hex(C.addr32(A.MegaToken)), P = ['holder ‖ slot', 'keccak256', 'split', 'bucket', 'group', 'tree key'];
      const inA = { l: `pad32(${who}) · the mapping key`, lc: BL, cells: pre.slice(0, 32).map((t, i) => ({ t, s: i < 12 ? 'zero' : 'bl' })) }, inB = { l: 'pad32(4) · balanceOf is declared at slot 4', lc: INK, cells: pre.slice(32).map((t, i) => ({ t, s: i < 31 ? 'zero' : 'WH' })) };
      const slotT = st => ({ l: 'keccak256(both) · the storage slot', lc: INK, cells: cs(m.sk, st ? 'mint' : 'wh', st ? 0 : 24), spans: st ? [sp(1, 31, 'tree_index = slot ÷ 256', MINT), sp(32, 1, 'sub', INK, { al: 'right' })] : [] });
      const addrT = { l: 'addr32(MegaToken) · the contract that owns the storage', lc: BL, cells: cs(a32, 'bl') };
      const F = [
        { title: `Where is balanceOf[${who}]?`, pips: pips(P, 0), tracks: [inA, inB], narr: `balanceOf is a mapping declared at slot 4. Solidity finds ${who}\u2019s entry by hashing the holder together with that slot number.` },
        { title: `Where is balanceOf[${who}]?`, pips: pips(P, 1), auto: 2600, tracks: [inA, inB, hashTrack('keccak256 · hashing 64 bytes…', 'keccak256', INK)], narr: 'keccak256 of those 64 bytes…' },
        { title: 'The storage slot', pips: pips(P, 1), tracks: [inA, inB, hdone(slotT(false), 'keccak256', INK)], narr: '…is the storage slot. That is Solidity\u2019s rule; PBT leaves it alone.' },
        { title: 'Group and position', pips: pips(P, 2), tracks: [slotT(true)], bigs: [{ l: 'tree_index', v: short(m.ti, 8, 4), c: MINT }, { l: 'sub', v: String(sk.sub), c: INK, hl: true }], narr: 'The slot is far above 63, so it goes to the storage zone (0xFF). Its first 31 bytes pick a group of 256 slots, the last byte a position inside it.' },
        { title: 'The bucket', pips: pips(P, 3), auto: 2600, tracks: [addrT, hashTrack('key_hash · hashing…', 'BLAKE3', MINT)], narr: 'The contract\u2019s address, hashed with key_hash (BLAKE3)…' },
        { title: 'The bucket', pips: pips(P, 3), tracks: [addrT, hdone({ l: 'bucket · BLAKE3(addr32(MegaToken)) · shared by all MegaToken storage', lc: MINT, cells: cs(bucketH, 'MINT', 22) }, 'BLAKE3', MINT)], narr: '…gives the bucket: one prefix for all of MegaToken\u2019s storage.' },
        { title: 'The group', pips: pips(P, 4), auto: 2600, tracks: [{ l: 'addr32(MegaToken) ‖ tree_index · 64 bytes', lc: BL, cells: cs(a32, 'bl') }, hashTrack('key_hash · hashing…', 'BLAKE3', MINT)], bigs: [{ l: 'tree_index', v: short(m.ti, 8, 4), c: MINT }], narr: 'The address again, with the group number appended, hashed once more…' },
        { title: 'The group', pips: pips(P, 4), tracks: [{ l: 'bucket', lc: MINT, cells: cs(bucketH, 'MINT') }, hdone({ l: 'group · BLAKE3(addr32 ‖ tree_index)', lc: MINT, cells: cs(groupH, 'mint', 22) }, 'BLAKE3', MINT)], narr: '…gives the group: where these 256 slots sit inside the bucket.' },
        { title: `balanceOf[${who}]\u2019s tree key`, pips: pips(P, 6), tracks: [{ l: 'bucket', lc: MINT, cells: cs(bucketH, 'MINT') }, { l: 'group', lc: MINT, cells: cs(groupH, 'mint') }], bigs: [{ l: 'zone', v: '0xFF', c: MINT }, { l: 'sub', v: String(sk.sub), c: INK }, { l: 'key length', v: '66 B', c: INK }],
          narr: `Zone 0xFF, bucket, group, then sub ${sk.sub}: a 66-byte key. The next walk follows it.` }];
      const idx = o.brief ? [0, 1, 2, 8] : [0, 1, 2, 3, 4, 5, 6, 7, 8];
      return seqF('Storage key · mapping', { l: `balanceOf[${who}]`, v: `FF ‖ ${bucketH.slice(2, 8)}… ‖ ${groupH.slice(2, 8)}… ‖ ${sk.sub}`, c: MINT }, [...idx.map(i => F[i]), ...(o.extra || [])], o.fx); };
    // header-band slot key (slots 0–63)
    const slotKeyFx = (lab, slot, name, valStr, valC, present) => { const st = x.stemOf(lab), sub = 64 + slot, has = new Set(present || [0, 1]);
      return seq('Storage key · header slot', { l: `slot ${slot} key`, v: `00 ‖ stem ‖ 0x${sub.toString(16)}`, c: BL }, 3, k => ({ title: [`${name} → slot ${slot}`, `Where does slot ${slot} live?`, `Slot ${slot}\u2019s tree key`][k],
        rows: k === 0 ? [{ l: 'Solidity layout', sub: name, v: 'slot ' + slot, fs: '24px' }, ...(valStr ? [{ l: 'value', v: valStr, vc: valC || BL, fs: '24px' }] : [])] : [],
        grids: k === 1 ? [stemGrid(`${x.nice(lab)}\u2019s stem · 256 sub-indices`, '64–127 = storage slots 0–63', hdrCell(has, i => i === sub ? 'lit' : null))] : [],
        tracks: k === 2 ? [{ l: `slot ${slot} key · 34 bytes`, lc: BL, cells: [{ t: '00', s: 'BL' }, ...cs('0x' + st.slice(4), 'bl'), { t: sub.toString(16), s: 'WH' }], spans: [sp(1, 1, 'zone 0x00', BL, { al: 'left' }), sp(2, 32, `${x.nice(lab)}\u2019s stem · same as its header`, BL), sp(34, 1, 'sub ' + sub, INK, { al: 'right' })] }] : [],
        narr: [`Solidity stores ${name} in slot ${slot}.`, `EIP-8297 keeps slots 0–63 inside the account\u2019s own stem, at sub-index 64 + slot. Only slots 64 and up go to the storage zone (0xFF).`, `So slot ${slot} shares the header\u2019s stem and takes sub-index 0x${sub.toString(16)}. One walk reaches the header and its hot storage alike.`][k] })); };

    // ---------------- J2 · deploy MegaToken ----------------
    const j2s = J2.derivation_steps, w2 = J2.writes, mh = k => k.startsWith(x.stemOf('MegaToken'));
    const codeW = w2.filter(w => w.key.startsWith('0x01')), preJ2 = W.WB;
    const hdrW = subs => w2.filter(w => mh(lk(w.key)) && subs.includes(parseInt(w.key.slice(-2), 16)));
    const acct0W = w2.filter(w => lk(w.key) === a0), bandW = w2.filter(w => mh(lk(w.key)) && parseInt(w.key.slice(-2), 16) >= 64);
    const depKey = lk(out(j2s[8]).key), depW = w2.find(w => lk(w.key) === depKey);
    const w2a = apply(preJ2, codeW), w2b = apply(w2a, [...hdrW([0, 1]), ...acct0W]), w2x = apply(w2b, bandW), w2e = apply(preJ2, w2);
    const megaBasic = hdr('MegaToken', 0), mbv = w2.find(w => lk(w.key) === megaBasic).after, mb = decodeBasic(mbv);
    const binM = BIN('MegaToken'), nCh = out(j2s[2]).chunk_count, nAbsM = nCh - codeW.length, szM = j2s[1].inputs.runtime_code_bytes;
    const presM = new Set(codeW.map(w => { const k = lk(w.key); return (k.startsWith(S.M1) ? 256 : 0) + parseInt(k.slice(-2), 16); }));
    const ck0 = lk(out(j2s[3])), ck256 = lk(out(j2s[4])), dg0 = '0x' + ck0.slice(4, 68), dg1 = '0x' + ck256.slice(4, 68);
    let sharedG = 0; { const p = C.hex2b(dg0), q = C.hex2b(dg1); while (sharedG < 256 && C.bitAt(p, sharedG) === C.bitAt(q, sharedG)) sharedG++; }
    const a0b = decodeBasic(acct0W[0].before), a0a = decodeBasic(acct0W[0].after), ownerW = (hdrW([67])[0] || {}).after;
    const bandSubs = new Set(bandW.map(w => parseInt(w.key.slice(-2), 16)));
    const codeKeysM = codeW.map(w => lk(w.key)).sort();
    const J2o = jr(J2, {
      short: 'Deploy a contract', teaches: 'Chunk the code by content, look it up, write it, then build the account: header, header slots, and a mapping entry in the storage zone.', links: [['A3', 'Code zone'], ['A4', 'Storage zone'], ['W2', 'Code witness']],
      beats: [
        { id: 'J2.B1', name: 'The transaction', cap: 'A {b|deployment}: code in, a new account out.', w: preJ2, tier: 'tree', noLayout: true,
          fx: depFx('Acct0', 3, 'MegaToken', binM, szM, [{ g: '1', gc: BL, l: 'Work out its address', d: 'from the deployer and its nonce' }, { g: '2', gc: AM, l: 'Store the code', d: 'unless the tree already has it' }, { g: '3', gc: BL, l: 'Create the account header', d: 'BASIC_DATA + CODE_HASH' }, { g: '4', gc: MINT, l: 'Keep the constructor\u2019s writes', d: 'header slots, and a mapping entry in the storage zone' }]) },
        { id: 'J2.B2', name: 'CREATE address', cap: 'Where does the new contract live? {b|RLP}, then {b|keccak}.', w: preJ2, tier: 'tree', noLayout: true, fx: createFx('Acct0', 3, 'MegaToken', out(j2s[0])) },
        { id: 'J2.B3', name: 'code_hash', cap: 'The bytecode\'s own hash becomes its {c|name in the tree}.', w: preJ2, tier: 'zone', zone: 1, noLayout: true, fx: codeHashFx('MegaToken', binM, szM, out(j2s[1])) },
        { id: 'J2.B4', name: 'Chunkify', cap: '{b|' + szM + ' bytes} become {c|' + nCh + ' 31-byte chunks}.', w: preJ2, tier: 'zone', zone: 1, noLayout: true,
          fx: seqF('Chunking', { l: 'Chunks', v: `${nCh} × 31 B`, c: AM }, tapeFrames('MegaToken', binM, szM, nCh)) },
        { id: 'J2.B5', name: 'Chunk 0\'s key', cap: 'Hash the {c|code_hash} and group number with {g|BLAKE3}.', w: preJ2, tier: 'zone', zone: 1, noLayout: true,
          fx: seqF('Key derivation · code chunk', { l: 'Chunk 0 key', v: `01 ‖ ${dg0.slice(2, 8)}… ‖ 00`, c: AM }, chunkKeyFrames(out(j2s[1]), dg0, 0)) },
        { id: 'J2.B6', name: 'Walk the code zone', cap: 'Is this code {c|already stored}? Follow chunk 0\'s key.', w: preJ2, tier: 'zone', zone: 1, follow: 'path', walk: ck0, noLayout: true,
          fx: { kind: 'walk', role: 'code lookup', subject: 'chunk 0 of MegaToken\u2019s code' } },
        { id: 'J2.B7', name: 'Write the chunks', cap: 'New code: {c|' + codeW.length + ' chunk leaves} land in the code zone.', w: w2a, preW: preJ2, tier: 'zone', zone: 1, stagger: 'chunk', codeLayout: 'Mega', focus: [ck0, ck256].filter(k => codeKeysM.includes(k)).concat(['stem:' + S.M0]),
          fx: seqF('Code · insert', { l: 'Wrote', v: `${codeW.length} chunk leaves · 2 groups`, c: G }, [
            { title: 'Not found: write it', grids: [{ l: `${nCh} chunks`, r: `${codeW.length} to write · ${nAbsM} all-zero`, cells: gridOf(nCh, i => presM.has(i) ? 'am' : 'ghost') }], narr: `The walk proved chunk 0 isn\u2019t there, so no account has this code yet. ${nAbsM} chunks are pure zeros; zero means absent, so they are never stored.` },
            { title: `Write ${codeW.length} chunk leaves`, btn: 'Write the chunks', run: 'world', grids: [{ l: `${nCh} chunks`, r: 'green = written now', cells: gridOf(nCh, i => presM.has(i) ? 'G' : 'ghost'), stag: 5 }], narr: 'Watch them land in the code zone, one group stem at a time.' },
            { title: `${nCh} chunks, 2 groups`, look: { focus: ['stem:' + S.M0, 'stem:' + S.M1], labels: [{ at: 'stem:' + S.M0, html: 'group 0 · chunks 0–255' }, { at: 'stem:' + S.M1, html: `group 1 · chunks 256–${nCh - 1}` }], frame: ['stem:' + S.M0, 'stem:' + S.M1], tier: 'zone' },
              grids: [{ l: 'group 0 · chunks 0–255 · one stem', lc: AM, cells: gridOf(256, i => presM.has(i) ? 'G' : 'ghost') }, { l: `group 1 · chunks 256–${nCh - 1} · a second, unrelated stem`, lc: AM, cells: gridOf(nCh - 256, i => presM.has(256 + i) ? 'G' : 'ghost') }],
              bigs: [{ l: 'group 0', v: String([...presM].filter(i => i < 256).length) + ' leaves', c: AM }, { l: 'group 1', v: String([...presM].filter(i => i >= 256).length) + ' leaves', c: AM }],
              narr: `Every 256 chunks share one stem. Chunk 256 starts group 1: tree_index 1 hashes to an unrelated stem (only ${sharedG} leading bits in common), so the two groups sit far apart.` }],
            { reveal: ck0, revealText: 'The code layout lists every chunk by group: green = written now, dashed = all-zero, never stored. Hover one to find its leaf.' }) },
        { id: 'J2.B7b', name: 'Zone byte', cap: 'One byte up front says {g|which zone}: account, code, or storage.', w: w2a, tier: 'tree', noLayout: true,
          fx: seq('Domain separation · zone byte', { l: 'Zone byte', v: 'account 0x00 · code 0x01 · storage 0xFF', c: BL }, 1, () => ({
            title: 'One byte says which zone',
            bigs: [{ l: 'accounts · next', v: '0x00', c: BL }, { l: 'code · just written', v: '0x01', c: AM }, { l: 'storage · coming up', v: '0xFF', c: MINT }],
            narr: `Every key in the tree starts with a zone byte, before anything else is hashed in: 0x00 for account headers and their slots, 0x01 for code chunks (what MegaToken\u2019s code just used), 0xFF for storage above slot 63 (where balanceOf[Acct0] will land). Next: MegaToken\u2019s own account key, zone 0x00.` })) },
        { id: 'J2.B8', name: 'Find MegaToken · key', cap: 'The new account\'s {g|34-byte key}.', w: w2a, tier: 'zone', zone: 0, layout: 'MegaToken', layoutRole: 'new contract', focus: [megaBasic], fx: { kind: 'derive', lab: 'MegaToken', role: 'new contract', fast: true } },
        { id: 'J2.B9', name: 'Walk finds nothing', cap: 'The walk lands on a {b|different leaf}: no account yet.', w: w2a, tier: 'zone', zone: 0, follow: 'path', layout: 'MegaToken', layoutRole: 'new contract', walk: megaBasic, fx: { kind: 'walk', role: 'new contract', subject: 'MegaToken' } },
        { id: 'J2.B10', codeLayout: 'Mega', name: 'Write the header', cap: 'A new {a|account header}: code_size, nonce 1, code_hash.', w: w2b, preW: w2a, tier: 'node', minR: 7, zone: 0, follow: 'path', path: [megaBasic], layout: 'MegaToken', layoutRole: 'new contract', focus: [megaBasic, hdr('MegaToken', 1)],
          fx: seq('Account header · new', { l: 'Header', v: `code_size ${mb.codeSize} · nonce ${mb.nonce}`, c: G }, 2, k => ({ title: k ? 'Write the header' : 'A header for a contract',
            tracks: [basicTrack(mbv, 'sub 0 · BASIC_DATA · 32 bytes')],
            rows: [{ l: 'sub 1 · CODE_HASH', sub: 'the code_hash: the only link to the chunks', v: short(out(j2s[1]), 6, 4), vc: AM, fs: '20px' }, { l: 'sub 2 · DELEGATION', sub: 'stays empty: an account holds CODE_HASH or DELEGATION, never both', v: '∅', vc: MUT, fs: '20px' }, { l: 'Acct0 · BASIC_DATA', sub: 'the deployer pays with a nonce', v: `nonce ${a0b.nonce} → ${a0a.nonce}`, vc: OR, fs: '20px' }],
            btn: k ? 'Write the header' : undefined, run: k ? 'world' : undefined,
            narr: [`BASIC_DATA packs code_size (${mb.codeSize}), nonce and balance. Contracts start at nonce 1. CODE_HASH is the only link to the chunks. There is no delegation flag: DELEGATION is its own leaf (sub 2), and a contract with code never has one.`, 'A path grows to MegaToken\u2019s stem and both leaves hang there (green). Acct0\u2019s BASIC_DATA updates in place (orange).'][k] }),
            { reveal: megaBasic, revealText: 'MegaToken\u2019s header holds BASIC_DATA (sub 0) and CODE_HASH (sub 1). Look around, then continue.' }) },
        { id: 'J2.B11', codeLayout: 'Mega', name: 'Header slots', cap: 'Slots below 64 sit {b|right beside the header}.', w: w2x, preW: w2b, tier: 'node', minR: 7, zone: 0, follow: 'path', path: [megaBasic], layout: 'MegaToken', layoutRole: 'new contract', focus: bandW.map(w => lk(w.key)),
          fx: seq('Storage · header slots', { l: 'Header slots', v: bandW.map(w => 'sub ' + parseInt(w.key.slice(-2), 16)).join(', '), c: G }, ownerW ? 4 : 3, k => { const last = ownerW ? 3 : 2;
            return { title: k === 0 ? '256 positions per stem' : k === last ? `Write ${bandW.length} slots` : k === 1 ? 'slot n → sub 64 + n' : 'Two variables, one word',
              grids: k === 2 && ownerW ? [] : [stemGrid('MegaToken\u2019s stem · 256 sub-indices', '0–2 header · 64–127 slots 0–63', hdrCell(new Set([0, 1]), i => k >= 1 && bandSubs.has(i) ? (k === last ? 'G' : 'lit') : null))],
              rows: k >= 1 && !(k === 2 && ownerW) ? bandW.map(w => ({ l: x.describe(w.key).what, sub: 'sub ' + parseInt(w.key.slice(-2), 16), v: vstr(w, w.after), vc: k === last ? G : INK, fs: '18px' })) : [],
              tracks: k === 2 && ownerW ? [{ l: 'slot 3 → sub 67 · 32 bytes', lc: INK, cells: hb(ownerW).map((t, i) => ({ t, s: i < 11 ? 'zero' : i === 11 ? 'OR' : 'bl', dl: i * 14 })), spans: [sp(1, 11, 'unused', MUT), sp(12, 1, 'paused', OR), sp(13, 20, 'owner · 20 B', BL, { v: nameOfAddr(ownerW.slice(-40)) })] }] : [],
              btn: k === last ? 'Write the slots' : undefined, run: k === last ? 'world' : undefined,
              narr: k === 0 ? 'Every account stem has 256 positions. Storage slots 0–63 live at 64–127, next to the header.' : k === last ? `${bandW.length} leaves under the same stem, right beside the header. Reading them later needs no second walk.`
                : k === 1 ? `The constructor sets ${bandW.length} slots below 64: name, symbol, totalSupply, owner. Each lands at 64 + its slot number.` : 'owner (20 bytes) and paused (1 byte) share slot 3: Solidity packs them into one word, and the tree stores that word as it is.' }; },
            { reveal: lk((bandW[0] || {}).key || megaBasic), revealText: 'The constructor\u2019s small slots now sit in the header band (subs 64–127) of MegaToken\u2019s stem. Look around, then continue.' }) },
        { id: 'J2.B12', name: 'balanceOf[deployer] · key', cap: 'A {s|mapping entry}: keccak, then two BLAKE3 hashes.', w: w2x, tier: 'zone', zone: 255, noLayout: true, fx: mapFx('Acct0') },
        { id: 'J2.B13', codeLayout: 'Mega', name: 'Write balanceOf[deployer]', cap: 'The first leaf in {s|MegaToken\'s storage bucket}.', w: w2e, preW: w2x, tier: 'zone', zone: 255, follow: 'zone', layout: 'MegaToken', layoutRole: 'new contract', focus: [depKey], path: [depKey],
          fx: seq('Storage · insert', { l: 'Wrote', v: `balanceOf[Acct0] = ${fmtUnits(BigInt(depW.after))}`, c: G }, 2, k => ({ title: k ? 'A new leaf in the storage zone' : 'The whole supply, to the deployer',
            rows: [{ l: 'balanceOf[Acct0]', sub: 'minted by the constructor', v: fmtUnits(BigInt(depW.after)) + ' MEGA', vc: G, fs: '26px' }],
            tracks: [{ l: 'leaf value · 32 bytes', lc: G, h: '22px', fs: '10px', cells: hb(depW.after).map((t, i) => ({ t, s: t !== '00' ? 'G' : 'zero', dl: i * 14 })) }],
            btn: k ? 'Write it' : undefined, run: k ? 'world' : undefined,
            narr: ['Nothing else lives in the storage zone yet, so there is nothing to walk past: this leaf starts it.', 'Same contract, different zone: the balance hangs under 0xFF, far from MegaToken\u2019s header. No storage root links them.'][k] }),
            { reveal: depKey, revealText: 'The balance sits in MegaToken\u2019s storage bucket (zone 0xFF), listed under the header in the layout. Look around, then continue.' }) },
        { id: 'J2.B14', name: 'Root recompute', cap: 'Rehash {g|only the touched paths}, bottom-up.', w: w2e, tier: 'tree', follow: 'path', noLayout: true, wave: w2.map(w => w.key), fx: rootFx('One deployment, one new root. Explore it: green = created, orange = updated.') },
      ] });

    // ---------------- J3 · same bytecode again ----------------
    const j3s = J3.derivation_steps, w3 = J3.writes, preJ3 = W.WA, w3a = apply(preJ3, w3);
    const vt3 = [hdr('VaultTemplate3', 0), hdr('VaultTemplate3', 1), hdr('VaultTemplate3', 64)];
    const dedup = labs => labs.map(l => ({ a: hdr(l, 1), b: 'stem:' + S.VT, kind: 'dedup' }));
    const nVT = j3s[2].inputs.chunk_count, binVT = BIN('VaultTemplate'), szVT = binVT.length / 2;
    const w3h = w3.filter(w => [vt3[0], vt3[1], a0].includes(lk(w.key))), w3s = w3.find(w => lk(w.key) === vt3[2]), wH = apply(preJ3, w3h), a0w3 = w3.find(w => lk(w.key) === a0);
    const vtBasicV = w3.find(w => lk(w.key) === vt3[0]).after, vtKeys = [...preJ3.keys()].filter(k => k.startsWith(S.VT)).sort();
    const vt0 = x.chunkKey('VT', 0), dgVT = '0x' + vt0.slice(4, 68), own3 = nameOfAddr(w3s.after.slice(-40));
    const J3o = jr(J3, {
      short: 'Deploy the same bytecode', teaches: 'Look the code up by its hash: it is already stored. Only the new header and its storage are written.', links: [['A3', 'Code zone · dedup'], ['W5', 'Dedup at scale']],
      beats: [
        { id: 'J3.B1', name: 'The transaction', cap: 'A {b|third copy} of the same contract.', w: preJ3, tier: 'tree', noLayout: true,
          fx: depFx('Acct0', 2, 'VaultTemplate #3', binVT, szVT, [{ g: '1', gc: BL, l: 'Work out its address', d: 'from Acct0 and nonce 2' }, { g: '2', gc: AM, l: 'Store the code?', d: 'first check whether the tree already has it' }, { g: '3', gc: BL, l: 'Create the account header', d: 'BASIC_DATA + CODE_HASH' }, { g: '4', gc: BL, l: 'Store slot 0 · owner', d: 'the constructor\u2019s one write' }],
            'Same bytecode as VaultTemplate #1 and #2. Still four jobs, but job 2 may turn out to be free.') },
        { id: 'J3.B2', name: 'CREATE address', cap: 'A third address, {b|same recipe}.', w: preJ3, tier: 'tree', noLayout: true, fx: createFx('Acct0', 2, 'VaultTemplate #3', out(j3s[0])) },
        { id: 'J3.B3', name: 'code_hash', cap: 'Hash the code: {c|its name in the tree}.', w: preJ3, tier: 'zone', zone: 1, noLayout: true, fx: codeHashFx('VaultTemplate', binVT, szVT, code.VT) },
        { id: 'J3.B4', name: 'Chunkify', cap: '{b|' + szVT + ' bytes} become {c|' + nVT + ' chunks}.', w: preJ3, tier: 'zone', zone: 1, noLayout: true, fx: seqF('Chunking', { l: 'Chunks', v: `${nVT} × 31 B`, c: AM }, tapeFrames('VaultTemplate', binVT, szVT, nVT)) },
        { id: 'J3.B5', name: 'Chunk 0\'s key', cap: 'Hash the {c|code_hash} and group number with {g|BLAKE3}.', w: preJ3, tier: 'zone', zone: 1, noLayout: true, fx: seqF('Key derivation · code chunk', { l: 'Chunk 0 key', v: `01 ‖ ${dgVT.slice(2, 8)}… ‖ 00`, c: AM }, chunkKeyFrames(code.VT, dgVT, 0)) },
        { id: 'J3.B6', name: 'Walk the code zone', cap: 'Follow chunk 0\'s key {g|bit by bit}. Is it there?', w: preJ3, tier: 'zone', zone: 1, follow: 'path', walk: vt0, noLayout: true,
          fx: { kind: 'walk', role: 'code lookup', subject: 'chunk 0 of this code', found: 'Chunk 0 of this exact code is already in the tree.' } },
        { id: 'J3.B7', name: 'All chunks present', cap: 'Every chunk is {c|already stored}. Nothing to write.', w: preJ3, tier: 'zone', zone: 1, frame: ['stem:' + S.VT], codeLayout: 'VT', layout: 'VaultTemplate3', layoutRole: 'new contract', focus: ['stem:' + S.VT], links: dedup(['VaultTemplate1', 'VaultTemplate2']), labels: [{ at: 'stem:' + S.VT, html: 'VaultTemplate code · × 2 accounts', badge: true }], flashKeys: vtKeys, flashIv: 110,
          fx: seq('Code · dedup', { l: 'Code leaves written', v: `0 · ${nVT} reused`, c: G }, 3, k => ({ title: k < 2 ? `Check all ${nVT} chunks` : 'Nothing to write', mode: 'hud', auto: k === 0 ? 300 : undefined, run: k === 1 ? 'flash' : undefined,
            grids: [{ l: `VaultTemplate code · ${nVT} chunks`, r: k ? 'found in the tree' : 'looking up…', cols: nVT, h: '16px', stag: 110, cells: gridOf(nVT, () => k ? 'am' : 'ghost') }],
            rows: k === 2 ? ['VaultTemplate1', 'VaultTemplate2'].map(l => ({ l: x.nice(l), sub: 'CODE_HASH', v: '✓ same hash', vc: G, fs: '20px' })) : [],
            bigs: k === 2 ? [{ l: 'new code leaves', v: '0', c: G, hl: true }, { l: 'chunks reused', v: String(nVT), c: AM }] : [],
            narr: ['Chunk 0 was there. Check the rest: same stem, sub-index 0 to ' + (nVT - 1) + '.', `All ${nVT} chunk leaves already exist, lit one by one in the code zone. They hold exactly these bytes.`, 'VaultTemplate #1 and #2 carry the same code_hash, so their code is this code. The code zone is not touched.'][k] })) },
        { id: 'J3.B8', name: 'Find VaultTemplate #3 · key', cap: 'The new account\'s {g|34-byte key}.', w: preJ3, tier: 'zone', zone: 0, layout: 'VaultTemplate3', layoutRole: 'new contract', focus: [vt3[0]], fx: { kind: 'derive', lab: 'VaultTemplate3', role: 'new contract', fast: true } },
        { id: 'J3.B9', name: 'Walk finds nothing', cap: 'The walk lands on a {b|different leaf}: no account yet.', w: preJ3, tier: 'zone', zone: 0, follow: 'path', layout: 'VaultTemplate3', layoutRole: 'new contract', walk: vt3[0], fx: { kind: 'walk', role: 'new contract', subject: 'VaultTemplate #3' } },
        { id: 'J3.B10', codeLayout: 'VT', name: 'Write the header', cap: '{a|BASIC_DATA} and {a|CODE_HASH}: a new header.', w: wH, preW: preJ3, tier: 'node', minR: 7, zone: 0, follow: 'path', path: [vt3[0]], layout: 'VaultTemplate3', layoutRole: 'new contract', focus: [vt3[0], vt3[1]], links: dedup(['VaultTemplate1', 'VaultTemplate2', 'VaultTemplate3']),
          fx: seq('Account header · new', { l: 'Header', v: `code_size ${decodeBasic(vtBasicV).codeSize} · nonce 1 · shared code`, c: G }, 2, k => ({ title: k ? 'Two new leaves' : 'A header that points at shared code',
            tracks: [basicTrack(vtBasicV, 'sub 0 · BASIC_DATA')],
            rows: [{ l: 'sub 1 · CODE_HASH', sub: 'same value as VaultTemplate #1 and #2', v: short(code.VT, 6, 4), vc: AM, fs: '20px' }, { l: 'sub 2 · DELEGATION', sub: 'stays empty: an account holds CODE_HASH or DELEGATION, never both', v: '∅', vc: MUT, fs: '20px' }, ...(a0w3 ? [{ l: 'Acct0 · BASIC_DATA', sub: 'the deployer pays with a nonce', v: `nonce ${decodeBasic(a0w3.before).nonce} → ${decodeBasic(a0w3.after).nonce}`, vc: OR, fs: '20px' }] : [])],
            btn: k ? 'Write the header' : undefined, run: k ? 'world' : undefined,
            narr: ['BASIC_DATA records the code size and nonce 1. CODE_HASH links to the code: the same hash as the two older copies. No delegation flag: DELEGATION would be its own leaf at sub 2, and code rules it out.', 'A path grows to VaultTemplate #3\u2019s stem and both leaves hang there (green). Acct0\u2019s nonce updates in place (orange). The dashed lines: three CODE_HASH leaves, one set of chunks.'][k] }),
            { reveal: vt3[1], revealText: 'VaultTemplate #3\u2019s header is in: BASIC_DATA and CODE_HASH. Look around, then continue to its storage.' }) },
        { id: 'J3.B11', codeLayout: 'VT', name: 'Slot 0 · owner', cap: 'The constructor stores the {b|owner} in slot 0.', w: wH, tier: 'node', zone: 0, layout: 'VaultTemplate3', layoutRole: 'new contract', focus: [vt3[0], vt3[1]], fx: slotKeyFx('VaultTemplate3', 0, 'owner (constructor argument)', own3) },
        { id: 'J3.B12', codeLayout: 'VT', name: 'Walk to slot 0', cap: 'Follow slot 0\'s key: {b|the stem exists}, the leaf doesn\'t.', w: wH, tier: 'zone', zone: 0, follow: 'path', layout: 'VaultTemplate3', layoutRole: 'new contract', walk: vt3[2], fx: { kind: 'walk', role: 'owner slot', subject: 'slot 0' } },
        { id: 'J3.B13', codeLayout: 'VT', name: 'Write slot 0', cap: 'The {b|owner} lands next to the header.', w: w3a, preW: wH, tier: 'node', minR: 7, zone: 0, follow: 'path', path: [vt3[2]], layout: 'VaultTemplate3', layoutRole: 'new contract', focus: [vt3[2]],
          fx: seq('Storage · insert', { l: 'Wrote', v: 'slot 0 = ' + own3, c: G }, 2, k => ({ title: k ? 'Insert the leaf' : 'owner, as 32 bytes',
            tracks: [{ l: 'sub 64 · slot 0 · owner', lc: G, h: '24px', fs: '10px', cells: hb(w3s.after).map((t, i) => ({ t, s: i < 12 ? 'zero' : 'bl', dl: i * 12 })), spans: [sp(1, 12, 'zero padding', MUT), sp(13, 20, 'owner · ' + own3, BL)] }],
            btn: k ? 'Write it' : undefined, run: k ? 'world' : undefined,
            narr: ['The owner\u2019s address, left-padded to 32 bytes.', 'The walk stopped at a leaf in this same stem, so the new leaf splits off right beside it. Header and hot storage: one stem, one walk.'][k] }),
            { reveal: vt3[2], revealText: 'Slot 0 sits in the header band (sub 64) of VaultTemplate #3\u2019s stem. Look around, then continue.' }) },
        { id: 'J3.B14', name: 'Root recompute', cap: 'Rehash {g|only the touched paths}.', w: w3a, tier: 'tree', follow: 'path', noLayout: true, wave: w3.map(w => w.key), fx: rootFx(`A full deployment for ${w3.length} leaves and zero code writes. Explore it: green = created, orange = updated.`) },
      ] });

    // ---------------- J4a · delegate an EOA ----------------
    const j4s = J4a.derivation_steps, a3 = k => hdr('Acct3', k), w4 = J4a.writes, w4a = apply(W1, w4);
    const n0 = decodeBasic(w4[0].before).nonce, n1 = decodeBasic(w4[0].after).nonce, ind = out(j4s[0]), lv = out(j4s[2]), tgt1 = j4s[0].inputs.target;
    const tgtCode = lk(out(j4s[5]).target_code_hash_key), vtChunks = [...W1.keys()].filter(k => k.startsWith(S.VT)).sort();
    const acct3Grid = (fn) => stemGrid('Acct3\u2019s stem · 256 sub-indices', 'sub 0 BASIC_DATA · 1 CODE_HASH · 2 DELEGATION', fn);
    const J4ao = jr(J4a, {
      short: 'Delegate an EOA', teaches: 'DELEGATION is written, CODE_HASH removed: an account holds one or the other, never both.', links: [['A2', 'Account header'], ['A5', 'Hash lab']],
      beats: [
        { id: 'J4a.B1', name: 'The transaction', cap: 'An {a|EOA} borrows a contract\'s code.', w: W1, tier: 'tree', noLayout: true,
          fx: seq('The transaction · EIP-7702', { l: 'Authorize', v: 'Acct3 → VaultTemplate #1', c: INK }, 3, k => ({ title: 'Acct3 delegates to VaultTemplate #1',
            flow: flow(party('signer · plain EOA', 'Acct3', A.Acct3, '✓ in the tree', true), party('delegate target', 'VaultTemplate #1', A.VaultTemplate1, k >= 1 ? '✓ has code' : '', true), 'authorization', { moved: k >= 1 }),
            rows: k === 1 ? [{ l: 'chain_id', v: 'this chain', fs: '18px' }, { l: 'address', sub: 'the code to borrow', v: 'VaultTemplate #1', vc: BL, fs: '18px' }, { l: 'nonce', sub: 'Acct3\u2019s current nonce', v: String(n0), fs: '18px' }, { l: 'signature', sub: 'by Acct3\u2019s key', v: '✓ y_parity, r, s', vc: G, fs: '18px' }] : [],
            checks: k >= 2 ? [{ g: '+', l: 'Write a DELEGATION leaf', d: 'sub 2 of Acct3\u2019s stem' }, { g: '−', gc: RED, l: 'Remove CODE_HASH', d: 'sub 1' }, { g: '~', gc: OR, l: 'Bump the nonce', d: 'inside BASIC_DATA, sub 0' }] : [],
            narr: ['An EIP-7702 transaction carries a signed authorization from Acct3.', 'The authorization names the code to borrow and is signed at Acct3\u2019s current nonce, so it can\u2019t be replayed.', 'From now on, calls to Acct3 run VaultTemplate\u2019s code. For the tree: three writes, all under Acct3\u2019s stem.'][k] })) },
        { id: 'J4a.B2', name: 'Find Acct3 · key', cap: 'Same recipe as always: {g|address → key}.', w: W1, tier: 'zone', zone: 0, layout: 'Acct3', layoutRole: 'delegator', focus: [a3(0)], fx: { kind: 'derive', lab: 'Acct3', role: 'delegator', fast: true } },
        { id: 'J4a.B3', name: 'Find Acct3 · walk', cap: 'Follow the key {g|bit by bit} to Acct3\'s leaf.', w: W1, tier: 'zone', zone: 0, follow: 'path', layout: 'Acct3', layoutRole: 'delegator', walk: a3(0), fx: { kind: 'walk', role: 'delegator', subject: 'Acct3' } },
        { id: 'J4a.B4', name: 'Delegation indicator', cap: 'Marker {b|0xef0100}, then the target address.', w: W1, tier: 'node', zone: 0, layout: 'Acct3', layoutRole: 'delegator', focus: [a3(0)],
          fx: seq('Delegation indicator', { l: 'Indicator', v: '0xef0100 ‖ ' + short(tgt1, 6, 4), c: INK }, 3, k => ({ title: ['A marker that can\u2019t be code', '+ the target address', 'Padded into one leaf'][k],
            tracks: [{ l: k ? 'indicator · 23 bytes' : 'marker · 3 bytes', lc: INK, cells: hb(ind).map((t, i) => ({ t: i < 3 || k ? t : '', s: i < 3 ? 'WH' : k ? 'bl' : 'ghost', dl: i < 3 ? 0 : (i - 3) * 30 })), spans: [sp(1, 3, '0xef0100', INK, { al: 'left' }), ...(k ? [sp(4, 20, 'target · VaultTemplate #1', BL)] : [])] },
              ...(k === 2 ? [{ l: 'leaf value · 32 bytes', lc: G, cells: hb(lv).map((t, i) => ({ t, s: i < 3 ? 'WH' : i < 23 ? 'bl' : 'zero', dl: i * 14 })), spans: [sp(24, 9, 'zero padding', MUT)] }] : [])],
            narr: ['0xef can never start deployed code (EIP-3541), so a value starting 0xef0100 can\u2019t be mistaken for real code.', 'Then the 20-byte address of the code to borrow. 23 bytes in all.', 'Right-padded to 32 bytes, it fits one leaf.'][k] })) },
        { id: 'J4a.B5', name: 'Write the delegation', cap: '{a|DELEGATION} in, {a|CODE_HASH} out, {b|nonce} up.', w: w4a, preW: W1, tier: 'node', minR: 7, zone: 0, follow: 'path', path: [a3(0)], layout: 'Acct3', layoutRole: 'delegator', focus: [a3(2), a3(0)],
          fx: seq('Account header · update', { l: 'Wrote', v: `+DELEGATION · −CODE_HASH · nonce ${n0}→${n1}`, c: OR }, 2, k => ({ title: k ? 'Code or delegation, never both' : 'Three writes under one stem',
            grids: [acct3Grid(i => i === 0 ? (k ? 'OR' : 'bl') : i === 1 ? (k ? 'gone' : 'bl') : i === 2 ? (k ? 'G' : 'off') : i < 3 ? 'hdr' : i >= 64 && i < 128 ? 'band' : 'off')],
            rows: w4.map(w => wrow(w)),
            btn: k ? 'Write them' : undefined, run: k ? 'world' : undefined,
            narr: ['BASIC_DATA gets the new nonce, CODE_HASH goes, DELEGATION arrives. All three share Acct3\u2019s stem.', 'Orange: updated in place. Green: new. Dashed: removed. The CODE_HASH leaf really leaves the tree; its branch folds away.'][k] }),
            { reveal: a3(2), revealText: 'Acct3\u2019s stem now holds BASIC_DATA and DELEGATION; CODE_HASH is gone. Look around, then continue.' }) },
        { id: 'J4a.B6', name: 'Resolves-to', cap: 'The tree stores {b|an address}, not an edge.', w: w4a, tier: 'tree', frame: [a3(2), tgtCode, 'stem:' + S.VT], focus: [a3(2)], noLayout: true, codeLayout: 'VT',
          links: [{ a: a3(2), b: tgtCode, kind: 'resolves' }, { a: tgtCode, b: 'stem:' + S.VT, kind: 'dedup' }],
          fx: seq('Resolving a call', { l: 'Resolves to', v: 'VaultTemplate code', c: AM }, 3, k => ({ title: ['1 · read DELEGATION', '2 · read the target\u2019s CODE_HASH', '3 · load the chunks'][k], mode: 'hud',
            pips: pips(['Acct3 · DELEGATION', 'VaultTemplate #1 · CODE_HASH', 'code chunks'], k),
            look: [{ focus: [a3(2)], ring: { [a3(2)]: 0xFFFFFF }, labels: [{ at: a3(2), html: 'DELEGATION → VaultTemplate #1' }], tier: 'node' }, { focus: [a3(2), tgtCode], ring: { [tgtCode]: 0xFFFFFF }, labels: [{ at: tgtCode, html: 'VaultTemplate #1 · CODE_HASH' }], frame: [a3(2), tgtCode], tier: 'zone' },
              { focus: [tgtCode, 'stem:' + S.VT], frame: [tgtCode, 'stem:' + S.VT], labels: [{ at: 'stem:' + S.VT, html: 'VaultTemplate code', badge: true }], tier: 'zone' }][k],
            flash: k === 2 ? vtChunks : undefined, run: k === 2 ? 'flash' : undefined,
            narr: ['A call to Acct3 first reads its DELEGATION leaf and takes the 20-byte address inside.', 'That address is VaultTemplate #1. Its CODE_HASH says which code to run.', 'The code_hash leads to the chunks. The dashed lines are lookups a client makes; none of them is stored in the tree.'][k] }), { mode: 'hud' }) },
        { id: 'J4a.B7', name: 'Root recompute', cap: 'Rehash {g|only the touched paths}.', w: w4a, tier: 'tree', follow: 'path', noLayout: true, wave: w4.map(w => w.key), fx: rootFx('One authorization, one new root. Explore it: green = created, orange = updated, red = removed.') },
      ] });
    const preA = W['W1+J4a'], w4b = apply(preA, J4b.writes), w4c = apply(preA, J4c.writes), dl4 = J4b.writes.find(w => lk(w.key) === a3(2)), tgt2 = hdr('VaultTemplate2', 1);
    const J4bo = jr(J4b, {
      short: 'Re-delegate', teaches: 'Same key, new value: the leaf stays put and the tree keeps its shape.', links: [['A2', 'Account header']],
      beats: [
        { id: 'J4b.B1', name: 'The transaction', cap: 'Point Acct3 at {b|different code}.', w: preA, tier: 'tree', noLayout: true,
          fx: seq('The transaction · EIP-7702', { l: 'Re-authorize', v: 'Acct3 → VaultTemplate #2', c: INK }, 2, k => ({ title: 'Acct3 switches target',
            flow: flow(party('signer · delegated to #1', 'Acct3', A.Acct3, '✓ has DELEGATION', true), party('new target', 'VaultTemplate #2', A.VaultTemplate2, '✓ has code', true), 'authorization', { moved: k >= 1 }),
            checks: k ? [{ g: '~', gc: OR, l: 'Overwrite DELEGATION', d: 'same key, new target inside' }, { g: '~', gc: OR, l: 'Bump the nonce', d: 'BASIC_DATA' }] : [],
            narr: ['Acct3 is already delegated to VaultTemplate #1. It signs a new authorization naming VaultTemplate #2.', 'No leaf is created or removed this time: two updates in place.'][k] })) },
        { id: 'J4b.B2', name: 'Find the DELEGATION leaf', cap: 'Walk to {a|sub 2} of Acct3\'s stem.', w: preA, tier: 'zone', zone: 0, follow: 'path', layout: 'Acct3', layoutRole: 'delegator', walk: a3(2), fx: { kind: 'walk', role: 'delegation', subject: 'Acct3\u2019s DELEGATION', found: 'This is the leaf to overwrite.' } },
        { id: 'J4b.B3', name: 'Overwrite the target', cap: 'Same leaf. The {b|address inside it} changes.', w: w4b, preW: preA, tier: 'node', minR: 7, zone: 0, follow: 'path', path: [a3(2)], layout: 'Acct3', layoutRole: 'delegator', focus: [a3(2), a3(0)],
          fx: seq('Account header · update', { l: 'DELEGATION', v: '→ VaultTemplate #2', c: OR }, 2, k => ({ title: k ? 'Only the address changes' : 'Same key, new value',
            tracks: diffT(dl4.before, dl4.after, true, ['DELEGATION before · → VaultTemplate #1', 'DELEGATION after · → VaultTemplate #2'], true), rows: J4b.writes.map(w => wrow(w)),
            btn: k ? 'Overwrite it' : undefined, run: k ? 'world' : undefined,
            narr: ['Red: the old target\u2019s bytes. Orange: the new ones. The marker and padding stay.', 'Both leaves update in place (orange). Nothing moves, no branch changes shape: only the hashes above them.'][k] }),
            { reveal: a3(2), revealText: 'Acct3\u2019s DELEGATION leaf now points at VaultTemplate #2. Look around, then continue.' }) },
        { id: 'J4b.B4', name: 'Resolves to #2', cap: 'Calls now load {c|VaultTemplate #2\'s} CODE_HASH.', w: w4b, tier: 'tree', frame: [a3(2), tgt2], focus: [a3(2), tgt2], noLayout: true, links: [{ a: a3(2), b: tgt2, kind: 'resolves' }, { a: tgt2, b: 'stem:' + S.VT, kind: 'dedup' }],
          fx: seq('Resolving a call', { l: 'Resolves to', v: 'VaultTemplate #2 → same code', c: AM }, 1, () => ({ title: 'New pointer, same chunks', mode: 'hud',
            look: { focus: [a3(2), tgt2, 'stem:' + S.VT], frame: [a3(2), tgt2, 'stem:' + S.VT], labels: [{ at: tgt2, html: 'VaultTemplate #2 · CODE_HASH' }, { at: 'stem:' + S.VT, html: 'VaultTemplate code', badge: true }], tier: 'zone' },
            narr: 'The lookup now goes through VaultTemplate #2. It deploys the same bytecode as #1, so it lands on the very same chunks: dedup in action.' }), { mode: 'hud' }) },
        { id: 'J4b.B5', name: 'Root recompute', cap: 'Rehash {g|one path}.', w: w4b, tier: 'tree', follow: 'path', noLayout: true, wave: J4b.writes.map(w => w.key), fx: rootFx('Two values changed in one stem: one path rehashed. Explore it: orange = updated.') },
      ] });
    const J4co = jr(J4c, {
      short: 'Revoke delegation', teaches: 'Authorize the zero address: DELEGATION goes, CODE_HASH comes back. A plain EOA again.', links: [['A2', 'Account header']],
      beats: [
        { id: 'J4c.B1', name: 'The transaction', cap: 'Delegate to {b|nobody}.', w: preA, tier: 'tree', noLayout: true,
          fx: seq('The transaction · EIP-7702', { l: 'Revoke', v: 'Acct3 → 0x0', c: INK }, 2, k => ({ title: 'Acct3 revokes its delegation',
            flow: flow(party('signer · delegated to #1', 'Acct3', A.Acct3, '✓ has DELEGATION', true), party('target', '0x0', '0x' + '00'.repeat(20), '∅ the zero address', false), 'authorization', { moved: k >= 1 }),
            checks: k ? [{ g: '−', gc: RED, l: 'Remove DELEGATION', d: 'sub 2' }, { g: '+', l: 'Write CODE_HASH = keccak("")', d: 'sub 1 · the hash of empty code' }, { g: '~', gc: OR, l: 'Bump the nonce', d: 'BASIC_DATA' }] : [],
            narr: ['Authorizing the zero address is how EIP-7702 clears a delegation.', 'The swap from J4a, in reverse.'][k] })) },
        { id: 'J4c.B2', name: 'Find the DELEGATION leaf', cap: 'Walk to {a|sub 2} of Acct3\'s stem.', w: preA, tier: 'zone', zone: 0, follow: 'path', layout: 'Acct3', layoutRole: 'delegator', walk: a3(2), fx: { kind: 'walk', role: 'delegation', subject: 'Acct3\u2019s DELEGATION', found: 'This is the leaf to remove.' } },
        { id: 'J4c.B3', name: 'Back to an EOA', cap: 'The account is a {a|plain EOA} again.', w: w4c, preW: preA, tier: 'node', minR: 7, zone: 0, follow: 'path', path: [a3(0)], layout: 'Acct3', layoutRole: 'delegator', focus: [a3(1), a3(0)],
          fx: seq('Account header · update', { l: 'Restored', v: '−DELEGATION · +CODE_HASH = keccak("")', c: OR }, 2, k => ({ title: k ? 'Indistinguishable from never delegated' : 'Undo the swap',
            grids: [acct3Grid(i => i === 0 ? (k ? 'OR' : 'bl') : i === 1 ? (k ? 'G' : 'off') : i === 2 ? (k ? 'gone' : 'bl') : i < 3 ? 'hdr' : i >= 64 && i < 128 ? 'band' : 'off')],
            rows: J4c.writes.map(w => wrow(w)),
            btn: k ? 'Write them' : undefined, run: k ? 'world' : undefined,
            narr: ['DELEGATION goes; CODE_HASH comes back as keccak(""), the hash of empty code; code_size returns to 0.', 'Acct3 now looks exactly like an EOA that never delegated. There is no separate “revoked” state.'][k] }),
            { reveal: a3(1), revealText: 'Acct3\u2019s stem is back to BASIC_DATA + CODE_HASH. Look around, then continue.' }) },
        { id: 'J4c.B4', name: 'Root recompute', cap: 'Rehash {g|one path}.', w: w4c, tier: 'tree', follow: 'path', noLayout: true, wave: J4c.writes.map(w => w.key), fx: rootFx('Delegation cleared, one new root. Explore it: green = created, orange = updated, red = removed.') },
      ] });

    // ---------------- J5 · ERC-20 transfer ----------------
    const j5s = J5.derivation_steps, w5 = J5.writes, up5 = w5.find(w => w.action === 'update'), in5 = w5.find(w => w.action === 'insert');
    const sk4 = lk(up5.key), sk8 = lk(in5.key), amt = BigInt(up5.before) - BigInt(up5.after), w5a = apply(W1, [up5]), w5b = apply(W1, w5), ts = lk(out(j5s[3]));
    const J5o = jr(J5, {
      short: 'Transfer an ERC-20', teaches: 'Keccak picks the slot; BLAKE3 places it in the storage zone. Only two storage leaves change.', links: [['A4', 'Storage zone'], ['A5', 'Two hash functions']],
      beats: [
        { id: 'J5.B1', name: 'The transaction', cap: 'Tokens move, but {s|only storage} changes.', w: W1, tier: 'tree', noLayout: true,
          fx: seq('The transaction', { l: 'Transfer', v: `${fmtUnits(amt)} MEGA · Acct4 → Acct8`, c: INK }, 3, k => ({ title: `Send ${fmtUnits(amt)} MEGA`,
            flow: flow(party('sender · holds MEGA', 'Acct4', A.Acct4, k >= 2 ? '✓ has a balance' : '', true), party('recipient', 'Acct8', A.Acct8, k >= 2 ? '∅ no balance yet' : '', false), fmtUnits(amt) + ' MEGA', { moved: k >= 1, gas: 'via MegaToken.transfer()' }),
            checks: k >= 2 ? [{ g: '1', gc: MINT, l: 'balanceOf[Acct4]', d: 'find it, subtract' }, { g: '2', gc: MINT, l: 'balanceOf[Acct8]', d: 'not there yet: insert it' }] : [],
            narr: ['Acct4 calls transfer(Acct8, amount) on MegaToken.', 'The tokens never leave MegaToken: its balanceOf mapping just changes two entries.', 'So the tree needs two storage keys, one per holder.'][k] })) },
        { id: 'J5.B2', name: 'Sender · slot key', cap: '{b|Keccak} picks the slot, {g|BLAKE3} places it.', w: W1, tier: 'zone', zone: 255, noLayout: true, fx: mapFx('Acct4') },
        { id: 'J5.B3', name: 'Sender · walk', cap: 'Follow the {g|66-byte key} down to the leaf.', w: W1, tier: 'zone', zone: 255, follow: 'path', layout: 'MegaToken', layoutRole: 'token contract', walk: sk4, fx: { kind: 'walk', role: 'sender balance', subject: 'balanceOf[Acct4]' } },
        { id: 'J5.B4', name: 'Sender · update', cap: 'Same key, {s|less MEGA}.', w: w5a, preW: W1, tier: 'node', zone: 255, follow: 'path', layout: 'MegaToken', layoutRole: 'token contract', focus: [sk4], path: [sk4],
          fx: seq('Compute · sender balance', { l: 'Wrote', v: `balanceOf[Acct4] = ${fmtUnits(BigInt(up5.after))}`, c: OR }, 4, k => ({ title: k < 3 ? 'New balance' : 'Write it back',
            rows: [{ l: 'balance now', v: fmtUnits(BigInt(up5.before)) + ' MEGA' }, { l: '− sent', sub: 'to Acct8', v: fmtUnits(amt) + ' MEGA', hide: k < 1 },
              { l: '= new balance', lc: OR, v: fmtUnits(BigInt(up5.after)) + ' MEGA', vc: OR, fs: '34px', bt: '1px solid rgba(226,230,226,.18)', pad: '10px 0 2px', hide: k < 2 }],
            tracks: k >= 3 ? diffT(up5.before, up5.after, true, ['leaf before', 'leaf after'], true) : [],
            btn: k === 3 ? 'Write it' : undefined, run: k === 3 ? 'world' : undefined,
            narr: ['The leaf holds Acct4\u2019s balance as a plain 32-byte number.', `${fmtUnits(amt)} MEGA leave.`, 'What is left is the new balance.', 'Same key, same leaf, new value (orange). The tree keeps its shape.'][k] }),
            { reveal: sk4, revealText: 'balanceOf[Acct4] sits in MegaToken\u2019s storage bucket, listed under the header in the layout. Look around, then continue.' }) },
        { id: 'J5.B5', name: 'Recipient · slot key', cap: 'Same recipe for the {s|recipient}.', w: w5a, tier: 'zone', zone: 255, noLayout: true, fx: mapFx('Acct8', { brief: true }) },
        { id: 'J5.B6', name: 'Recipient · walk finds nothing', cap: 'The walk ends on a {b|different leaf}.', w: w5a, tier: 'zone', zone: 255, follow: 'path', layout: 'MegaToken', layoutRole: 'token contract', walk: sk8, fx: { kind: 'walk', role: 'recipient balance', subject: 'balanceOf[Acct8]' } },
        { id: 'J5.B7', name: 'Recipient · insert', cap: 'Acct8\'s first-ever balance: a {s|new leaf}.', w: w5b, preW: w5a, tier: 'node', minR: 7, zone: 255, follow: 'path', layout: 'MegaToken', layoutRole: 'token contract', focus: [sk8], path: [sk8],
          fx: seq('Insertion · storage', { l: 'Created', v: `balanceOf[Acct8] = ${fmtUnits(BigInt(in5.after))}`, c: G }, 2, k => ({ title: k ? 'Insert the leaf' : 'A brand-new entry',
            rows: [{ l: 'balanceOf[Acct8]', sub: 'was absent, which means zero', v: fmtUnits(BigInt(in5.after)) + ' MEGA', vc: G, fs: '30px' }],
            tracks: [{ l: 'leaf value · 32 bytes', lc: G, h: '22px', fs: '10px', cells: hb(in5.after).map((t, i) => ({ t, s: t !== '00' ? 'G' : 'zero', dl: i * 14 })) }],
            btn: k ? 'Insert it' : undefined, run: k ? 'world' : undefined,
            narr: ['No leaf yet, so the balance was zero. Now it isn\u2019t.', 'Same move as a new account: a branch appears where the two keys part, and the new leaf hangs on it (green).'][k] }),
            { reveal: sk8, revealText: 'A new leaf in MegaToken\u2019s bucket, beside the other balances. Look around, then continue.' }) },
        { id: 'J5.B8', name: 'What didn\'t move', cap: '{b|totalSupply} stays put in the header.', w: w5b, tier: 'tree', frame: [sk4, sk8, ts], noLayout: true, focus: [sk4, sk8],
          fx: seq('Untouched', { l: 'totalSupply', v: 'unchanged', c: INK }, 1, () => ({ title: 'Two leaves, nothing else', mode: 'hud',
            look: { focus: [sk4, sk8, ts], ring: { [ts]: 0x8a8a8a }, labels: [{ at: ts, html: 'totalSupply · header sub 66 · <b>not touched</b>' }, { at: sk4, html: 'balanceOf[Acct4] · updated' }, { at: sk8, html: 'balanceOf[Acct8] · new' }], frame: [sk4, sk8, ts], tier: 'tree' },
            narr: 'A transfer moves balances, not the supply. MegaToken\u2019s header, in the account zone, is untouched: only the two storage leaves changed.' }), { mode: 'hud' }) },
        { id: 'J5.B9', name: 'Root recompute', cap: 'Rehash {g|two paths}, bottom-up.', w: w5b, tier: 'tree', follow: 'path', noLayout: true, wave: w5.map(w => w.key), fx: rootFx('Two storage leaves, one new root. Explore it: green = created, orange = updated.') },
      ] });

    // ---------------- J6 · call a contract ----------------
    const j6s = J6.derivation_steps, disp = out(j6s[2]).chunks, jd = out(j6s[1]), cj = jd.chunk_of_jumpdest;
    const selDig = C.b2hex(C.keccak256(new TextEncoder().encode('transfer(address,uint256)')));
    const c22 = chunkKey('Mega', cj), v22 = W1.get(c22) || '0x' + '00'.repeat(32), lead22 = parseInt(v22.slice(2, 4), 16), dispKeys = disp.map(i => chunkKey('Mega', i)).filter(k => W1.has(k));
    const J6o = jr(J6, {
      short: 'Call a contract', teaches: 'A call reads only the chunks it executes: that is all a witness has to carry.', links: [['A3', 'Code zone'], ['W2', 'Code witness']],
      beats: [
        { id: 'J6.B1', name: 'The call', cap: 'Running code means {c|reading chunks}.', w: W1, tier: 'tree', noLayout: true,
          fx: seq('The transaction', { l: 'Call', v: 'Acct4 → MegaToken.transfer', c: INK }, 2, k => ({ title: 'Call MegaToken',
            flow: flow(party('caller', 'Acct4', A.Acct4, '✓ in the tree', true), party('contract', 'MegaToken', A.MegaToken, k ? `${nCh} chunks of code` : '', true), 'transfer(…)', { moved: k >= 1 }),
            narr: ['Acct4 calls transfer on MegaToken.', 'A stateless verifier gets a witness, not the whole state. It must contain every chunk this call executes, and only those.'][k] })) },
        { id: 'J6.B2', name: 'Function selector', cap: 'Every call starts with a {b|4-byte selector}.', w: W1, tier: 'zone', zone: 1, noLayout: true,
          fx: seq('Calldata', { l: 'Selector', v: out(j6s[0]), c: INK }, 3, k => ({ title: k < 2 ? 'transfer(address,uint256)' : 'selector = ' + out(j6s[0]), auto: k === 1 ? 2600 : undefined,
            bigs: k === 0 ? [{ l: 'signature', v: 'transfer(address,uint256)', c: INK, fs: '24px' }] : [],
            tracks: k === 1 ? [hashTrack('keccak256(signature) · hashing…', 'keccak256', INK)] : k === 2 ? [hdone({ l: 'keccak256(signature)', lc: INK, cells: hb(selDig).map((t, i) => ({ t, s: i < 4 ? 'WH' : 'dim', dl: i * 20 })), spans: [sp(1, 4, 'selector', INK, { al: 'left' })] }, 'keccak256', INK)] : [],
            narr: ['The calldata names a function by its signature.', 'Hash it with keccak256…', '…and keep the first 4 bytes: that is what the dispatcher compares.'][k] })) },
        { id: 'J6.B3', name: 'Dispatcher jump', cap: 'The dispatcher jumps to {c|chunk ' + cj + '}.', w: W1, tier: 'zone', zone: 1, noLayout: true,
          fx: seq('Execution · code', { l: 'JUMPDEST', v: `pc ${jd.jumpdest_pc} · chunk ${cj}`, c: AM }, 2, k => ({ title: k ? `pc ${jd.jumpdest_pc} → chunk ${cj}` : 'Match the selector, jump',
            bigs: [{ l: 'JUMPDEST pc', v: String(jd.jumpdest_pc), c: INK }, { l: 'chunk = pc ÷ 31', v: String(Math.floor(jd.jumpdest_pc / 31)), c: AM, hl: true, hide: !k }],
            narr: ['The dispatcher compares the selector against each function it knows, then jumps to the matching body.', `A program counter maps to a chunk by plain division: ${jd.jumpdest_pc} ÷ 31 = ${Math.floor(jd.jumpdest_pc / 31)}. To keep executing, the EVM needs that chunk.`][k] })) },
        { id: 'J6.B4', name: `Chunk ${cj}'s key`, cap: 'Hash the {c|code_hash} and group number with {g|BLAKE3}.', w: W1, tier: 'zone', zone: 1, noLayout: true,
          fx: seqF('Key derivation · code chunk', { l: `Chunk ${cj} key`, v: `01 ‖ ${dg0.slice(2, 8)}… ‖ ${cj.toString(16)}`, c: AM }, chunkKeyFrames(code.Mega, dg0, cj)) },
        { id: 'J6.B5', name: `Load chunk ${cj}`, cap: 'Walk the code zone {g|bit by bit}.', w: W1, tier: 'zone', zone: 1, follow: 'path', walk: c22, codeLayout: 'Mega', codeLit: [cj], fx: { kind: 'walk', role: 'code read', subject: `chunk ${cj}`, found: 'Its 32 bytes go into the witness.' } },
        { id: 'J6.B6', name: 'Dispatcher chunks', cap: '{c|' + disp.length + ' chunks} for this call; the rest stay home.', w: W1, tier: 'zone', zone: 1, frame: ['stem:' + S.M0], codeLayout: 'Mega', codeDisp: disp, focus: ['stem:' + S.M0], flashKeys: dispKeys, flashColor: 0xB57BFF, flashIv: 160,
          fx: seq('Code witness', { l: 'Chunks read', v: `${disp.length} of ${nCh}`, c: LIL }, 3, k => ({ title: k === 2 ? `${disp.length} of ${nCh} chunks` : 'Which chunks run?', mode: 'hud', auto: k === 0 ? 300 : undefined, run: k === 1 ? 'flash' : undefined,
            grids: [{ l: `MegaToken code · ${nCh} chunks`, r: k ? 'lilac = executed' : '', cells: gridOf(nCh, i => k && disp.includes(i) ? 'disp' : presM.has(i) ? 'am' : 'ghost'), stag: k === 1 ? 2 : 0 }],
            bigs: k === 2 ? [{ l: 'chunks in the witness', v: String(disp.length), c: LIL, hl: true }, { l: 'left out', v: String(nCh - disp.length), c: MUT }] : [],
            narr: ['Follow execution: the dispatcher, then the function body.', 'Each chunk it touches lights up in the code zone (lilac).', `Only those ${disp.length} go in the witness, each with its tree proof. Without chunking the whole ${szM}-byte contract would have to ship.`][k] })) },
        { id: 'J6.B7', name: 'Byte 0', cap: '{b|One byte} makes a chunk safe to jump into.', w: W1, tier: 'node', zone: 1, codeLayout: 'Mega', codeLit: [cj], focus: [c22],
          fx: seq('Chunk anatomy', { l: 'Byte 0', v: `chunk ${cj} · ${lead22}`, c: INK }, 1, () => ({ title: `Chunk ${cj}, byte by byte`, mode: 'hud',
            look: { focus: [c22], ring: { [c22]: 0xFFFFFF }, labels: [{ at: c22, html: `chunk ${cj} · byte 0 = ${lead22}` }], tier: 'node' },
            tracks: [{ l: `chunk ${cj} · leaf value`, lc: AM, cells: hb(v22).map((t, i) => ({ t, s: i === 0 ? 'WH' : i <= lead22 ? 'or' : 'am', dl: i * 12 })), spans: [sp(1, 1, 'byte 0', INK, { al: 'left', v: String(lead22) }), ...(lead22 ? [sp(2, lead22, 'PUSH data', OR)] : []), sp(2 + lead22, 31 - lead22, 'code', AM)] }],
            narr: lead22 ? `Byte 0 says the first ${lead22} bytes continue a PUSH from the previous chunk, so they can\u2019t be jump targets. The jump is checked without chunk ${cj - 1}.` : `Byte 0 is 0: no PUSH data spills in from chunk ${cj - 1}, so every JUMPDEST here is real. The jump is checked from this chunk alone.` }), { mode: 'hud' }) },
      ] });

    // ---------------- J7 · clear a slot ----------------
    const w7 = J7.writes, s65 = hdr('VaultTemplate1', 65), s64 = hdr('VaultTemplate1', 64), del7 = w7.find(w => w.action === 'delete'), upd7 = w7.find(w => w.action === 'update');
    const bal7 = BigInt(del7.before), own7 = W1.get(s64), own7n = own7 ? nameOfAddr(own7.slice(-40)) : 'owner', w7a = apply(W1, w7);
    const vt1Subs = new Set([...W1.keys()].filter(k => k.startsWith(x.stemOf('VaultTemplate1')) && k.length === 70).map(k => parseInt(k.slice(-2), 16)));
    const vtGrid = fn => stemGrid('VaultTemplate #1\u2019s stem · 256 sub-indices', '64–127 = slots 0–63', hdrCell(vt1Subs, fn));
    const J7o = jr(J7, {
      short: 'Clear a slot', teaches: 'Writing zero deletes the leaf; the tree merges one level, and nothing else moves.', links: [['A0', 'Tree mechanics'], ['A2', 'Header band']],
      beats: [
        { id: 'J7.B1', name: 'The transaction', cap: 'A vault {b|pays out} everything.', w: W1, tier: 'tree', noLayout: true,
          fx: seq('The transaction', { l: 'Withdraw', v: `${fmtUnits(bal7)} ETH out of VaultTemplate #1`, c: INK }, 2, k => ({ title: 'Empty the vault',
            flow: flow(party('contract · the vault', 'VaultTemplate #1', A.VaultTemplate1, `holds ${fmtUnits(bal7)} ETH`, true), party('owner', own7n, own7 ? '0x' + own7.slice(-40) : null, '', true), fmtUnits(bal7) + ' ETH', { moved: k >= 1, gas: 'withdraw()' }),
            checks: k ? [{ g: '~', gc: OR, l: 'BASIC_DATA · balance', d: `${fmtUnits(bal7)} → 0 ETH` }, { g: '−', gc: RED, l: 'slot 1 · balance variable', d: 'set to zero, which means: delete' }] : [],
            narr: [`${own7n} calls withdraw() on VaultTemplate #1.`, 'The vault\u2019s ETH and its own bookkeeping variable both drop to zero. Watch what the tree does with a zero. (The recipient\u2019s side is left out of this fixture.)'][k] })) },
        { id: 'J7.B2', name: 'Slot 1 → sub 65', cap: 'Slot 1 lives at {a|header sub 65}.', w: W1, tier: 'node', zone: 0, layout: 'VaultTemplate1', layoutRole: 'the vault', focus: [s65], fx: slotKeyFx('VaultTemplate1', 1, 'balance (uint256)', fmtUnits(bal7) + ' ETH', INK, [...vt1Subs]) },
        { id: 'J7.B3', name: 'Walk to slot 1', cap: 'Follow the key to the leaf we\'re about to {b|delete}.', w: W1, tier: 'zone', zone: 0, follow: 'path', layout: 'VaultTemplate1', layoutRole: 'the vault', walk: s65, fx: { kind: 'walk', role: 'slot 1', subject: 'slot 1', found: 'This leaf is about to go.' } },
        { id: 'J7.B4', name: 'Zero means delete', cap: '{b|Zero is the same as absent}.', w: w7a, preW: W1, tier: 'node', minR: 7, zone: 0, follow: 'path', path: [lk(upd7.key)], layout: 'VaultTemplate1', layoutRole: 'the vault', focus: [lk(upd7.key), s64],
          fx: seq('Storage · delete', { l: 'Deleted', v: 'sub 65 · slot 1 = 0', c: RED }, 2, k => ({ title: k ? 'The leaf is gone' : 'Write zero',
            rows: w7.map(w => wrow(w)),
            tracks: k ? [] : diffT(del7.before, '0x' + '00'.repeat(32), true, ['slot 1 before', 'slot 1 after · 32 zero bytes'], false),
            grids: [vtGrid(i => i === 65 ? (k ? 'gone' : 'lit') : i === 0 && k ? 'OR' : null)],
            btn: k ? 'Write zero' : undefined, run: k ? 'world' : undefined,
            narr: ['Slot 1 becomes 32 zero bytes. BASIC_DATA\u2019s balance drops to zero too.', 'EIP-8297 turns a zero write into a deletion: the leaf leaves the tree (dashed) and BASIC_DATA updates in place (orange). Zero and absent are the same state.'][k] }),
            { reveal: lk(upd7.key), revealText: 'Sub 65 is gone from the vault\u2019s stem; BASIC_DATA holds the new balance. Look around, then continue.' }) },
        { id: 'J7.B5', name: 'The tree merges', cap: 'One leaf gone: {g|one level} folds away.', w: w7a, tier: 'node', minR: 7, zone: 0, follow: 'path', path: [s64], focus: [s64], layout: 'VaultTemplate1', layoutRole: 'the vault',
          fx: seq('Structure · merge', { l: 'Merged', v: 'one branch removed', c: G }, 3, k => ({ title: ['Its branch had two children', 'Now it has one', 'The sibling moves up'][k], mode: 'hud',
            look: { focus: [s64], ring: { [s64]: 0xFFFFFF }, labels: [{ at: s64, html: ['slot 0 · the deleted leaf\u2019s sibling', 'a branch with one child is not allowed', 'slot 0 · now one level higher'][k] }], tier: 'node', path: [s64] },
            checks: [{ g: '1', l: 'The leaf is gone', d: 'its parent branch is left with one child', hl: k === 0 }, { g: '2', l: 'That branch dissolves', d: 'a branch must have two children', hl: k === 1, hide: k < 1 }, { g: '3', l: 'The sibling takes its place', d: 'its prefix absorbs the old branch\u2019s bits', hl: k === 2, hide: k < 2 }, { g: '✓', l: 'Nothing else changes shape', hide: k < 2 }],
            narr: ['Slot 0 (owner) was the deleted leaf\u2019s sibling under one branch.', 'With slot 1 gone, that branch would have a single child, which the canonical form forbids.', 'So the branch disappears and slot 0 moves up one level. Deletion is insertion in reverse, bounded to one level.'][k] }), { mode: 'hud' }) },
        { id: 'J7.B6', name: 'Root recompute', cap: 'Rehash {g|only the touched paths}.', w: w7a, tier: 'tree', follow: 'path', noLayout: true, wave: w7.map(w => w.key), fx: rootFx('A deletion and an update, one new root. Explore it: orange = updated, red = removed.') },
      ] });

    // ---------------- J8 · a big contract ----------------
    const j8s = J8.derivation_steps, g8 = out(j8s[1]), ab = out(j8s[2]), p32 = out(j8s[3]);
    const c14 = chunkKey('Mega', p32.chunk_before), c15 = chunkKey('Mega', p32.chunk_after), v14 = W.W0.get(c14) || '', v15 = W.W0.get(c15) || '';
    const opCell = (ci, i) => { const pc = 31 * ci + i - 1; return i === 0 ? 'WH' : pc >= p32.operand_start && pc <= p32.operand_end ? 'OR' : pc === p32.push32_opcode_pc ? 'LIL' : 'am'; };
    const absIdx = gridOf(nCh, i => i).filter(i => !presM.has(i));
    const J8o = jr(J8, {
      short: 'A big contract', teaches: 'Two groups, absent zero chunks, and a PUSH32 cut across a chunk boundary.', links: [['A3', 'Code zone']],
      beats: [
        { id: 'J8.B1', name: `${nCh} chunks, 2 groups`, cap: '{c|' + out(j8s[0]) + ' chunks}: one full group, one short one.', w: W.W0, tier: 'zone', zone: 1, codeLayout: 'Mega', frame: ['stem:' + S.M0, 'stem:' + S.M1], focus: ['stem:' + S.M0, 'stem:' + S.M1], flashKeys: codeKeysM, flashIv: 12,
          fx: seq('Code · groups', { l: 'Groups', v: `${g8.group_0_size} + ${g8.group_1_size} chunks`, c: AM }, 3, k => ({ title: ['Too big for one group', 'Two stems', 'Far apart in the tree'][k], mode: k ? 'hud' : undefined, run: k === 1 ? 'flash' : undefined,
            look: k === 2 ? { focus: ['stem:' + S.M0, 'stem:' + S.M1], labels: [{ at: 'stem:' + S.M0, html: 'group 0 · 256 chunks', badge: true }, { at: 'stem:' + S.M1, html: `group 1 · ${g8.group_1_size} chunks`, badge: true }], frame: ['stem:' + S.M0, 'stem:' + S.M1], tier: 'zone' } : undefined,
            grids: [{ l: `group 0 · ${g8.group_0_size} chunks`, lc: AM, cells: gridOf(256, i => presM.has(i) ? 'am' : 'ghost') }, { l: `group 1 · ${g8.group_1_size} chunks`, lc: AM, cells: gridOf(nCh - 256, i => presM.has(256 + i) ? 'am' : 'ghost') }],
            bigs: k === 2 ? [{ l: 'group 0 stem', v: short(S.M0, 6, 4), c: AM, fs: '22px' }, { l: 'group 1 stem', v: short(S.M1, 6, 4), c: AM, fs: '22px' }, { l: 'shared bits', v: String(sharedG), c: INK, fs: '22px' }] : [],
            narr: [`MegaToken has ${nCh} chunks: more than the 256 one group holds.`, 'Every chunk leaf lights up in the code zone, group by group.', `Group 1\u2019s stem comes from tree_index 1, so it shares only ${sharedG} bits with group 0\u2019s: the two groups land in unrelated parts of the code zone.`][k] })) },
        { id: 'J8.B2', name: 'Absent zero chunks', cap: '{c|' + ab.absent_chunk_count + ' chunks} are pure zero and never stored.', w: W.W0, tier: 'zone', zone: 1, codeLayout: 'Mega', codeLit: ab.first_indices.slice(0, 1), focus: ['stem:' + S.M0], frame: ['stem:' + S.M0],
          fx: seq('Code · absence', { l: 'Absent', v: `${ab.absent_chunk_count} chunks`, c: RED }, 2, k => ({ title: k ? 'Zero means absent' : `${ab.absent_chunk_count} chunks that don\u2019t exist`,
            grids: [{ l: `MegaToken code · ${nCh} chunks`, r: `first absent · ${ab.first_indices[0]}`, cells: gridOf(nCh, i => presM.has(i) ? 'am' : 'gone'), stag: 0 }],
            tracks: k ? [{ l: `chunk ${ab.first_indices[0]} · what it would hold`, lc: RED, h: '20px', fs: '9.5px', cells: gridOf(32, () => ({ t: '00', s: 'zero' })) }] : [],
            bigs: k ? [] : [{ l: 'absent chunks', v: String(ab.absent_chunk_count), c: RED, hl: true }, { l: 'stored', v: String(nCh - ab.absent_chunk_count), c: AM }],
            narr: ['MegaToken compiles in a block of zero bytes on purpose (a data region). Red dashes: those chunks.', 'Each would be 32 zero bytes, byte 0 included. Zero means absent, so the tree simply has no leaf there; a read returns zeros anyway, and code_size still says how long the code is.'][k] })) },
        { id: 'J8.B3', name: 'PUSH32 across a boundary', cap: 'One {b|32-byte constant}, split across two chunks.', w: W.W0, tier: 'node', zone: 1, codeLayout: 'Mega', codeLit: [p32.chunk_before, p32.chunk_after], focus: [c14, c15],
          fx: seq('Chunk anatomy', { l: 'PUSH32', v: `pc ${p32.push32_opcode_pc} · chunks ${p32.chunk_before}→${p32.chunk_after}`, c: OR }, 2, k => ({ title: k ? `Byte 0 of chunk ${p32.chunk_after}` : 'A constant cut in two', mode: 'hud',
            look: { focus: [c14, c15], ring: { [c14]: 0xFFFFFF, [c15]: 0x33FF33 }, labels: [{ at: c14, html: `chunk ${p32.chunk_before} · PUSH32 starts here` }, { at: c15, html: `chunk ${p32.chunk_after} · byte 0 = ${parseInt(v15.slice(2, 4), 16)}` }], tier: 'node' },
            tracks: [{ l: `chunk ${p32.chunk_before}`, lc: AM, h: '22px', fs: '10px', cells: hb(v14).map((t, i) => ({ t, s: opCell(p32.chunk_before, i) })) }, { l: `chunk ${p32.chunk_after}`, lc: AM, h: '22px', fs: '10px', cells: hb(v15).map((t, i) => ({ t, s: k && i === 0 ? 'G' : opCell(p32.chunk_after, i) })), spans: k ? [sp(1, 1, 'byte 0', G, { al: 'left', v: String(parseInt(v15.slice(2, 4), 16)) })] : [] }],
            narr: [`PUSH32 at pc ${p32.push32_opcode_pc} (lilac) carries 32 bytes of data (orange). The 31-byte cut lands right through it.`, `So chunk ${p32.chunk_after}\u2019s byte 0 counts the PUSH data it inherits. Those bytes can never be jump targets, and the chunk is never all-zero, so it is always stored.`][k] }), { mode: 'hud' }) },
      ] });

    // ---------------- J9 · prove it ----------------
    const j9s = J9.derivation_steps, pres = lk(j9s[0].inputs.key), absk = lk(j9s[1].inputs.key);
    const rt1 = C.binarize(C.toEntries(W1)); C.merkleize(rt1);
    const witFx = (key, present, lab) => { const w = C.witness(rt1, key), L = w.levels, n = L.length;
      const lvl = (i, cur) => ({ g: L[i].dir ? 'R' : 'L', l: `level ${i} · bit ${L[i].branch.split} → ${L[i].dir ? 'right' : 'left'}`, d: `sibling ${short(C.b2hex(L[i].sibling.hash), 6, 4)} · 32 B + ${2 + Math.ceil(L[i].prefixLen / 8)} B prefix`, hl: i === cur });
      const term = { g: present ? '◈' : '◇', gc: present ? G : VM, l: present ? 'the leaf itself' : 'the leaf found instead', d: present ? '32-byte value' : `full key + value · ${w.terminal.kb.length + 32} B` };
      const frames = [{ title: present ? `Prove ${lab}` : `Prove ${lab} is not there`, bigs: [{ l: 'levels on the path', v: String(n), c: G }], look: { focus: ['root'], tier: 'zone', frame: ['root', key], keep: true },
        narr: present ? 'To check one leaf against the root, a verifier needs the leaf plus one sibling hash per branch on its path.' : 'Absence is proven the same way: walk as far as the key goes, and show what is there instead.' }];
      for (let i = 0; i < n; i++) frames.push({ title: `Level ${i}: take the sibling`, checks: L.slice(0, i + 1).map((_, q) => lvl(q, i)),
        look: { focus: [`node:${key}:${i}`, `sib:${key}:${i}`], ring: { [`sib:${key}:${i}`]: 0xFFFFFF }, labels: [{ at: `sib:${key}:${i}`, html: `sibling · level ${i}` }], tier: 'node', keep: true },
        narr: `The key\u2019s bit ${L[i].branch.split} goes ${L[i].dir ? 'right' : 'left'}. The other side\u2019s hash (white) goes into the witness.` });
      frames.push({ title: `${w.bytes} bytes`, checks: [...L.map((_, q) => lvl(q, -1)), term], bigs: [{ l: 'witness size', v: w.bytes + ' B', c: G, hl: true }, { l: 'siblings', v: String(n), c: INK }],
        look: { focus: [w.terminal.key], ring: { [w.terminal.key]: present ? 0x33FF33 : 0xD55E00 }, labels: [{ at: w.terminal.key, html: present ? lab : 'leaf found instead · parts from our key' }], tier: 'node', keep: true },
        narr: present ? 'Hash upward, pairing with each sibling. If the result equals the root, the balance is proven.' : 'The leaf at the end has a key that parts from ours. If ours existed it would have to be here, so it doesn\u2019t.' });
      return seqF(present ? 'Witness · presence' : 'Witness · absence', { l: 'Witness', v: `${n} siblings · ${w.bytes} B`, c: G }, frames.map(f => Object.assign({ mode: 'hud' }, f)), { mode: 'hud' }); };
    const J9o = jr(J9, {
      short: 'Prove it', teaches: 'A witness is the path plus one sibling hash per level.', links: [['W1', 'Proof-size race']],
      beats: [
        { id: 'J9.B1', name: 'Presence witness', cap: '{g|' + out(j9s[0]).levels + ' levels}, one sibling each.', w: W1, tier: 'zone', zone: 255, frame: ['root', pres], follow: 'path', witness: pres, noLayout: true, fx: witFx(pres, true, 'balanceOf[Acct4]') },
        { id: 'J9.B2', name: 'Absence witness', cap: 'A {b|different leaf} proves nothing exists here.', w: W1, tier: 'zone', zone: 0, frame: ['root', 'stem:' + x.stemOf('Acct0')], follow: 'path', witness: absk, noLayout: true, fx: witFx(absk, false, 'an absent key') },
        { id: 'J9.B3', name: 'MPT comparison', cap: 'MPT: {b|' + out(j9s[2]) + ' bytes} for one branch.', w: W1, tier: 'tree', ghostAll: true, noLayout: true,
          fx: seq('Proof size', { l: 'PBT vs MPT', v: `${out(j9s[0]).witness_bytes}–${out(j9s[1]).witness_bytes} B vs ${out(j9s[2])} B`, c: G }, 2, k => ({ title: k ? 'Binary wins on proof size' : 'Why the MPT is bigger',
            bars: k ? [{ l: `PBT presence · ${out(j9s[0]).levels} levels`, v: out(j9s[0]).witness_bytes, vs: out(j9s[0]).witness_bytes + ' B', c: G }, { l: `PBT absence · ${out(j9s[1]).levels} levels`, v: out(j9s[1]).witness_bytes, vs: out(j9s[1]).witness_bytes + ' B', c: G }, { l: 'MPT branch · 12 levels × 15 siblings', v: out(j9s[2]), vs: out(j9s[2]) + ' B', c: INK }] : [],
            grids: k ? [] : [{ l: 'one MPT level · 15 siblings × 32 B', r: 'vs one PBT level · 1 sibling', cols: 16, h: '14px', cells: gridOf(16, i => i === 0 ? 'G' : 'band') }],
            narr: ['A hexary Merkle-Patricia node has 16 children, so each level of a proof carries 15 sibling hashes. A binary node has 2: one sibling.', 'More levels, far fewer bytes. Here the real witnesses are a fraction of one MPT branch.'][k], foot: k ? '15 × 32 × 12 = 5760 (EIP-8297 Motivation)' : '' })) },
      ] });

    // ---------------- J10 · one block ----------------
    const j10s = J10.derivation_steps, w10 = J10.writes, w10a = apply(W1, w10), inJ = id => w10.filter(w => (J(id).writes || []).some(q => lk(q.key) === lk(w.key))).map(w => lk(w.key));
    const k1 = inJ('J1'), k5 = inJ('J5'), k4 = inJ('J4a');
    const J10o = jr(J10, {
      short: 'One block, many writes', teaches: 'Three actions, one tree: their paths meet near the root and are rehashed once.', links: [['W3', 'One tree, no storage roots']],
      beats: [
        { id: 'J10.B1', name: 'Combined write set', cap: 'Three unrelated actions, one block.', w: w10a, preW: W1, tier: 'tree', noLayout: true, focus: w10.map(w => lk(w.key)),
          fx: seq('The block', { l: 'Leaves changed', v: String(out(j10s[0]).total_leaves_changed), c: INK }, 4, k => ({ title: ['A send', '+ a token transfer', '+ a delegation', 'Apply all writes'][k], mode: 'hud', btn: k === 3 ? 'Apply the block' : undefined, run: k === 3 ? 'world' : undefined,
            look: k < 3 ? { focus: [k1, k5, k4][k], frame: [k1, k5, k4][k], tier: 'zone', ring: Object.fromEntries([k1, k5, k4][k].map(q => [q, 0xFFFFFF])) } : undefined,
            checks: [{ g: String(j10s[0].inputs.j1_leaves_changed), gc: BL, l: 'Send ETH', d: 'J1 · account zone', hl: k === 0 }, { g: String(j10s[0].inputs.j5_leaves_changed), gc: MINT, l: 'Transfer MEGA', d: 'J5 · storage zone', hl: k === 1, hide: k < 1 }, { g: String(j10s[0].inputs.j4a_leaves_changed), gc: BL, l: 'Delegate Acct3', d: 'J4a · account zone', hl: k === 2, hide: k < 2 }],
            bigs: k === 3 ? [{ l: 'leaves changed', v: String(out(j10s[0]).total_leaves_changed), c: G, hl: true }] : [],
            narr: ['First, an ETH transfer: two accounts in the account zone (white).', 'Then a token transfer: two leaves in MegaToken\u2019s storage bucket.', 'Then Acct3\u2019s delegation: one stem in the account zone.', 'A block applies every write, then hashes once.'][k] })) },
        { id: 'J10.B2', name: 'One pass', cap: 'Rehash the {g|union} of all paths.', w: w10a, tier: 'tree', follow: 'path', noLayout: true, wave: w10.map(w => w.key), fx: rootFx('One pass over the union: ancestors shared near the root are hashed once.') },
        { id: 'J10.B3', name: 'Union vs naive sum', cap: '{g|' + hr(J10) + ' recomputes}, not ' + j10s[1].inputs.naive_sum + '.', w: w10a, tier: 'tree', noLayout: true,
          fx: seq('Merkleize · cost', { l: 'Hashes', v: `${hr(J10)} vs ${j10s[1].inputs.naive_sum}`, c: G }, 1, () => ({ title: 'Shared paths are hashed once', mode: 'hud',
            bars: [{ l: 'one pass over the union', v: hr(J10), c: G }, { l: 'each action on its own', v: j10s[1].inputs.naive_sum, c: INK }],
            narr: 'Separately, each action would rehash the top of the tree again. In one tree, one pass covers all three, with no per-account storage roots to update.', foot: 'This saving is specific to this fixture, not a universal ratio.' }), { mode: 'hud' }) },
      ] });

    const journeys = [J1o, J2o, J3o, J4ao, J4bo, J4co, J5o, J6o, J7o, J8o, J9o, J10o];
    journeys.forEach(j => j.writes = (J(j.id).writes && J(j.id).writes.length) ? J(j.id).writes : (J(j.id).phases ? [...J(j.id).phases.create.writes] : []));
    J1o.writes = J1o.writesV4;
    return { journeys, S };
  }
  // ---------------- Zone Atlas (self-paced facets) ----------------
  function buildAtlas(x, S) {
    const { C, W, J, A, hdr, fx, short } = x, W1 = W.W1, za = fx.zone_atlas;
    const vt1b = hdr('VaultTemplate1', 0), a0s = x.stemOf('Acct0');
    return [
      { id: 'A0', name: 'Tree mechanics', facets: [
        { id: 'A0.B1', name: 'Two node types', cap: 'Only {b|two kinds of node} exist. Ever.', w: W1, tier: 'node', zone: 0, focus: [vt1b, 'parent:' + vt1b], widget: 'nodetypes',
          labels: [{ at: vt1b, html: 'LeafNode(key, value)' }, { at: 'parent:' + vt1b, html: 'BranchNode(prefix, left, right)', off: -1 }] },
        { id: 'A0.B2', name: 'Prefix compression', cap: 'A long shared run: {g|still just one branch}.', w: W1, tier: 'node', zone: 0, focus: ['stem:' + a0s], widget: 'chain', corridor: 'stem:' + a0s },
        { id: 'A0.B3', name: 'Canonical form', cap: 'Insert in any order — the tree that results is {b|always the same}.', w: W1, tier: 'tree', widget: 'shuffle' },
        { id: 'A0.B4', name: 'MAX_KEY_LENGTH = 8192', cap: 'Why 8192 bytes? The prefix\'s own {b|bit-counter} caps it.', w: W1, tier: 'tree', widget: 'maxkey' },
      ] },
      { id: 'A1', name: 'Zone map', facets: [
        { id: 'A1.B1', name: 'Zone byte table', cap: 'One byte, {b|four kinds} of state.', w: W1, tier: 'tree', widget: 'zonetable', sectorLabels: true },
        { id: 'A1.B2', name: 'Real root geometry', cap: '{b|Bit 0} alone splits {s|storage} from everything else.', w: W1, tier: 'zone', frame: ['root', 'rootL', 'rootR'], focus: ['root', 'rootL', 'rootR'], minR: 5, widget: 'rootsplit',
          labels: [{ at: 'root', html: 'root · prefix ' + za.root.prefix_bit_count + ' bits' }, { at: 'rootL', html: 'bit 0 = 0 → account + code' }, { at: 'rootR', html: 'bit 0 = 1 → storage (0xFF)' }] },
        { id: 'A1.B3', name: 'Left sub-split', cap: 'One more bit: {a|accounts} split from {c|code}.', w: W1, tier: 'zone', frame: ['rootL', 'rootLL', 'rootLR'], focus: ['rootL', 'rootLL', 'rootLR'], minR: 5, widget: 'rootsplit',
          labels: [{ at: 'rootL', html: 'prefix "' + za.root_split.bit0_left.prefix_bits + '" · splits on bit 7' }, { at: 'rootLL', html: '0x00 · account' }, { at: 'rootLR', html: '0x01 · code' }] },
      ] },
      { id: 'A2', name: 'Account header', facets: [
        { id: 'A2.B1', name: '256 sub-index positions', cap: '{b|256 possible slots}. Most accounts use 2–6.', w: W1, tier: 'node', zone: 0, focus: ['stem:' + x.stemOf('MegaToken')], fan: { at: x.stemOf('MegaToken'), zone: 0, title: 'MegaToken stem', slots: 'auto' }, chips: ['slotsused:' + x.stemOf('MegaToken')] },
        { id: 'A2.B2', name: 'BASIC_DATA fields', cap: 'One leaf, {b|five packed fields}, one branch opening.', w: W1, tier: 'node', zone: 0, focus: [hdr('MegaToken', 0)], fan: { at: x.stemOf('MegaToken'), zone: 0, title: 'MegaToken stem', slots: 'auto', lit: [0] }, bytes: 'basic:' + hdr('MegaToken', 0) },
        { id: 'A2.B3', name: 'CODE_HASH xor DELEGATION', cap: 'Code hash or delegation. {b|Never both}.', w: W1, tier: 'node', zone: 0, focus: ['stem:' + x.stemOf('Acct3')], widget: 'deleg' },
        { id: 'A2.B4', name: 'Header-storage band', cap: 'The first {b|64 storage slots} share one branch with the header.', w: W1, tier: 'node', zone: 0, frame: ['stem:' + x.stemOf('MegaToken'), 'stem:' + x.stemOf('VaultTemplate1')],
          fans: [{ at: x.stemOf('MegaToken'), zone: 0, title: 'MegaToken', sub: 'subs 66, 67', slots: 'auto', band: [64, 127] }, { at: x.stemOf('VaultTemplate1'), zone: 0, title: 'VaultTemplate #1', sub: 'subs 64, 65', slots: 'auto', band: [64, 127] }] },
      ] },
      { id: 'A3', name: 'Code zone', facets: [
        { id: 'A3.B1', name: 'Live chunker', cap: 'Type bytecode, watch it split into {c|31-byte chunks}.', w: W1, tier: 'zone', zone: 1, widget: 'chunker' },
        { id: 'A3.B2', name: 'Groups', cap: '{c|256 chunks per group}. Past that: a new, unrelated stem.', w: W1, tier: 'zone', zone: 1, frame: ['stem:' + S.M0, 'stem:' + S.M1],
          fans: [{ at: S.M0, zone: 1, title: 'group 0', sub: 'tree_index 0', slots: 'auto' }, { at: S.M1, zone: 1, title: 'group 1', sub: 'tree_index 1', slots: 'auto' }], chips: [{ l: 'Chunks', v: String(J('J8').derivation_steps[0].output) }, { l: 'Groups', v: '2' }] },
        { id: 'A3.B3', name: 'Dedup', cap: '{b|3 deployments}, {c|1 set of chunks}.', w: W1, tier: 'zone', zone: 1, frame: ['stem:' + S.VT, hdr('VaultTemplate1', 1), hdr('VaultTemplate2', 1), hdr('VaultTemplate3', 1)],
          focus: ['stem:' + S.VT], links: ['VaultTemplate1', 'VaultTemplate2', 'VaultTemplate3'].map(l => ({ a: hdr(l, 1), b: 'stem:' + S.VT, kind: 'dedup' })), labels: [{ at: 'stem:' + S.VT, html: '× 3 accounts', badge: true }], chips: [{ l: 'Deployments', v: String(fx.why_pbt.W5_dedup_at_scale.vaulttemplate_deployments) }, { l: 'Code leaves', v: String(J('J3').derivation_steps[2].inputs.chunk_count) }, { l: 'Dedup saves', v: 2 * J('J3').derivation_steps[2].inputs.chunk_count + ' leaves' }] },
        { id: 'A3.B4', name: 'Zero-chunk absence', cap: 'Same zero bytes, two tree states — {b|byte 0 decides}.', w: W1, tier: 'node', zone: 1, focus: ['stem:' + S.M0], widget: 'zerochunk' },
      ] },
      { id: 'A4', name: 'Storage zone', facets: [
        { id: 'A4.B1', name: 'Bucket → groups → slots', cap: '{s|One bucket} per contract. Many groups inside it.', w: W1, tier: 'zone', zone: 255, follow: 'zone', focus: ['stem:' + x.bucket('MegaToken')], labelsHolders: true,
          chips: [{ l: 'Buckets', v: '1' }, { l: 'Groups', v: String(za.megatoken_storage_groups) }, { l: 'Leaves', v: String(za.leaf_counts_by_zone['0xff']) }] },
        { id: 'A4.B2', name: 'Slot calculator', cap: 'Type a slot number. {b|Watch it land}.', w: W1, tier: 'zone', zone: 0, widget: 'slotcalc' },
        { id: 'A4.B3', name: 'Mapping derivation', cap: 'Solidity picks the slot number. {b|The tree just places it}.', w: W1, tier: 'zone', zone: 255, widget: 'mapcalc' },
      ] },
      { id: 'A5', name: 'Hash lab', facets: [
        { id: 'A5.B1', name: 'Leaf / branch preimages', cap: 'One {b|tag byte} tells a leaf\'s hash from a branch\'s.', w: W1, tier: 'zone', frame: ['root', hdr('Acct0', 0)], focus: ['root', hdr('Acct0', 0)], widget: 'preimage' },
        { id: 'A5.B2', name: 'encode_bit_prefix', cap: 'A {b|2-byte bit-count}, then the packed bits themselves.', w: W1, tier: 'zone', focus: ['rootL'], frame: ['root', 'rootL'], minR: 4, widget: 'bitprefix' },
        { id: 'A5.B3', name: 'BLAKE3 vs Keccak', cap: 'Two hash functions. {b|One might change. One never will.}', w: W1, tier: 'tree', widget: 'twolane' },
      ] },
    ];
  }

  // ---------------- Why PBT ----------------
  function buildWhy(x, S, journeys) {
    const { fx, J, hdr, short } = x, wp = fx.why_pbt, j9 = J('J9').derivation_steps, j10 = J('J10'), W1 = x.W.W1;
    const pres = j9[0].inputs.key.toLowerCase();
    const worst = 60000000 / 2400 * (12 * 480 + 65536);
    const arity = wp.W1_proof_size.eip_arity_table;
    return [
      { id: 'W1', name: 'Proof-size race', facets: [
        { id: 'W1.B1', name: 'Real fixture numbers', cap: '{g|' + j9[0].output.witness_bytes + '–' + j9[1].output.witness_bytes + ' bytes} here. ' + wp.W1_proof_size.mpt_branch_bytes_depth12 + ' bytes for one MPT branch.', w: W1, tier: 'zone', zone: 255, frame: ['root', pres], follow: 'path', witness: pres,
          panel: { kind: 'bars', rows: [{ l: 'PBT presence · ' + j9[0].output.levels + ' levels', v: j9[0].output.witness_bytes, c: '#33FF33' }, { l: 'PBT absence · ' + j9[1].output.levels + ' levels', v: j9[1].output.witness_bytes, c: '#33FF33' }, { l: 'MPT branch · depth 12', v: wp.W1_proof_size.mpt_branch_bytes_depth12, c: '#E2E6E2' }], note: 'MPT: 15 siblings × 32 B × 12 levels. PBT: one sibling per level, but more levels — width vs depth.' },
          chips: [{ l: 'PBT', v: j9[0].output.witness_bytes + ' B', l2: 'MPT', v2: wp.W1_proof_size.mpt_branch_bytes_depth12 + ' B' }] },
        { id: 'W1.B2', name: 'Arity table', cap: '{b|Binary trees minimize proof size.} Wider trees always cost more.', w: W1, tier: 'tree', ghostAll: true,
          panel: { kind: 'bars', rows: arity.map(a => ({ l: `k=${a.k} · ${a.chunks} chunks`, v: a.bytes, c: a.k === 2 ? '#33FF33' : '#E2E6E2' })), note: 'N = 2^24; average branch ≈ 32·(k−1)·log N / log k bytes (EIP-8297 Rationale).' },
          chips: [{ l: 'k=2', v: arity[0].bytes + ' B', l2: 'k=16', v2: arity[3].bytes + ' B' }] },
      ] },
      { id: 'W2', name: 'Code witness', facets: [
        { id: 'W2.B1', name: 'Worst case', cap: 'Unchunked code: one worst-case block could need {b|1.8 gigabytes} of witness.', w: W1, tier: 'tree', ghostAll: true,
          panel: { kind: 'big', big: '≈ ' + (worst / 1e9).toFixed(1) + ' GB', lines: ['60,000,000 gas ÷ 2400 per cold account = 25,000 accounts', '× (12 × 480 B branch + 65,536 B full code) = ' + x.commas(String(worst)) + ' B'], note: 'EIP-8297 Motivation. With 31-byte chunks, a witness carries only the chunks actually executed (J6).' },
          chips: [{ l: 'Unchunked', v: '≈1.8 GB', l2: 'J6 call', v2: J('J6').derivation_steps[2].output.chunks.length + ' chunks' }] },
      ] },
      { id: 'W3', name: 'One tree, no storage roots', facets: [
        { id: 'W3.B1', name: 'Union vs sum', cap: 'No leaf stores a {s|storage_root}. Writes meet only near the top.', w: x.C.applyWrites(new Map(W1), j10.writes), tier: 'tree', follow: 'path', wave: j10.writes.map(w => w.key),
          panel: { kind: 'bars', rows: [{ l: 'Real single pass (union)', v: j10.hashes_recomputed.branches_recomputed, c: '#33FF33' }, { l: 'Naive per-action sum', v: j10.derivation_steps[1].inputs.naive_sum, c: '#E2E6E2' }], note: 'J1 + J5 + J4a in one block. Fixture-specific; more shared ancestors means a bigger gap.', unit: ' hashes' },
          chips: [{ l: 'Union', v: String(j10.hashes_recomputed.branches_recomputed), l2: 'Naive', v2: String(j10.derivation_steps[1].inputs.naive_sum) }] },
      ] },
      { id: 'W4', name: 'Zones as commitments', facets: [
        { id: 'W4.B1', name: 'Addressable regions', cap: 'A zone, a bucket, a stem — {b|each one provable} on its own.', w: W1, tier: 'tree', follow: 'zone', zone: 255, focus: ['rootR'],
          panel: { kind: 'rows', rows: Object.entries(wp.W4_zones_as_commitments.zone_byte_ranges).map(([k, v]) => ({ l: v, v: k })), note: 'A key prefix of known length is always the root of a known category — no side structure needed.' } },
      ] },
      { id: 'W5', name: 'Dedup at scale', facets: [
        { id: 'W5.B1', name: 'Three deployments', cap: '{b|3 factory deployments}. {c|1 copy of the code}, ever.', w: W1, tier: 'zone', zone: 1, frame: ['stem:' + S.VT, hdr('VaultTemplate1', 1), hdr('VaultTemplate2', 1), hdr('VaultTemplate3', 1)],
          links: ['VaultTemplate1', 'VaultTemplate2', 'VaultTemplate3'].map(l => ({ a: hdr(l, 1), b: 'stem:' + S.VT, kind: 'dedup' })), labels: [{ at: 'stem:' + S.VT, html: '× 3 accounts', badge: true }],
          chips: [{ l: 'Deployments', v: String(wp.W5_dedup_at_scale.vaulttemplate_deployments), l2: 'Code sets', v2: '1' }, { l: 'Dup writes', v: String(wp.W5_dedup_at_scale.code_leaves_written_after_first_deploy) }] },
      ] },
      { id: 'W6', name: 'Proof-friendly, post-quantum', facets: [
        { id: 'W6.B1', name: 'Hash candidates', cap: '{b|Hash-based, not curve-based.} That\'s what survives a quantum computer.', w: W1, tier: 'zone', frame: ['root', 'rootL', 'rootR'], focus: ['root'], minR: 5, labels: [{ at: 'root', html: 'H = ' + wp.W6_hash_agnostic.reference_hash + ' · not final' }],
          panel: { kind: 'rows', rows: [{ l: 'BLAKE3', v: 'reference · good native, reasonable in-circuit' }, { l: 'Keccak', v: 'already in Ethereum · slower to prove' }, { l: 'Poseidon2', v: 'strong in-circuit · analysis ongoing' }], note: 'Final choice: open (final = ' + wp.W6_hash_agnostic.final + '). No elliptic curves anywhere — unlike Verkle.' } },
      ] },
      { id: 'W7', name: 'Getting there', facets: [
        { id: 'W7.B1', name: 'EIP-8347', cap: 'The switch happens {b|once}, off the critical path, at a single fork.', w: W1, tier: 'tree', ghostAll: true,
          panel: { kind: 'rows', rows: [{ l: 'Spec', v: wp.W7_migration_pointer.eip }, { l: 'Path A', v: 'convert state locally at a finalized anchor block' }, { l: 'Path B', v: 'download a snapshot, verify against the anchor root' }, { l: 'Cutover', v: 'one coordinated hard fork' }], note: 'See the companion MPT → PBT migration article.' } },
      ] },
      { id: 'W8', name: 'State expiry preview', facets: [
        { id: 'W8.B1', name: 'Expiry unit', cap: 'A {s|bucket} or a {a|stem}: the natural unit to expire and prune.', w: W1, tier: 'tree', frame: ['stem:' + x.bucket('MegaToken'), 'stem:' + x.stemOf('Acct2')], focus: ['stem:' + x.bucket('MegaToken'), 'stem:' + x.stemOf('Acct2')],
          labels: [{ at: 'stem:' + x.bucket('MegaToken'), html: 'speculative stub · bucket', badge: true }, { at: 'stem:' + x.stemOf('Acct2'), html: 'speculative stub · header stem', badge: true }],
          panel: { kind: 'rows', rows: [{ l: 'Unit', v: wp.W8_state_expiry_preview.unit_of_expiry }], note: 'Not implemented. EIP-8297 Rationale leaves the mechanism to a separate EIP.' } },
      ] },
      { id: 'W9', name: 'Grinding & margins', facets: [
        { id: 'W9.B1', name: 'Collision cost', cap: 'Any real key collision: about {b|2^' + wp.W9_grinding_and_security.collision_work_bits + ' work}. Not happening.', w: W1, tier: 'tree', ghostAll: true,
          panel: { kind: 'big', big: '2^' + wp.W9_grinding_and_security.collision_work_bits, lines: ['256-bit digests → birthday bound 2^128', 'Keys in different zones differ in byte 0: cannot collide at all'] }, chips: [{ l: 'Collision', v: '2^128' }] },
        { id: 'W9.B2', name: 'Grinding cost', cap: 'Compression turns a cheap-looking attack into an {b|expensive one}.', w: W1, tier: 'node', zone: 0, focus: ['stem:' + x.stemOf('Acct0')], corridor: 'stem:' + x.stemOf('Acct0'),
          panel: { kind: 'rows', rows: [{ l: 'No compression', v: 'k shared bits → k-node chain for ~2^(k/2) work' }, { l: 'PBT', v: 'run folds into one prefix of ~k/8 bytes; d real extra nodes cost ~2^d' }], note: 'The address inside the digest stops cross-contract reuse of ground slot sets.' },
          chips: [{ l: 'Uncompressed', v: '2^(k/2)', l2: 'PBT', v2: '2^d' }] },
      ] },
    ];
  }

  G.PBTBeats = { makeCtx, build, buildAtlas, buildWhy, short, fmtUnits, decodeBasic, TAG };
})(window);
