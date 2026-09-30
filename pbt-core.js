// PBT core: Keccak-256, BLAKE3 (single-chunk), EIP-8297 binary tree (binarize/merkleize/witness),
// world reconstruction from fixtures. Pure functions, no DOM.
(function (G) {
  const hex2b = h => { h = h.replace(/^0x/, ''); const o = new Uint8Array(h.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i * 2, 2), 16); return o; };
  const b2hex = b => '0x' + Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  const cat = (...a) => { const n = a.reduce((s, x) => s + x.length, 0), o = new Uint8Array(n); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };

  // ---------- Keccak-256 (EVM) ----------
  const RC = ['0000000000000001','0000000000008082','800000000000808a','8000000080008000','000000000000808b','0000000080000001','8000000080008081','8000000000008009','000000000000008a','0000000000000088','0000000080008009','000000008000000a','000000008000808b','800000000000008b','8000000000008089','8000000000008003','8000000000008002','8000000000000080','000000000000800a','800000008000000a','8000000080008081','8000000000008080','0000000080000001','8000000080008008'].map(h => BigInt('0x' + h));
  const ROT = [0,1,62,28,27,36,44,6,55,20,3,10,43,25,39,41,45,15,21,8,18,2,61,56,14];
  const M64 = (1n << 64n) - 1n;
  const rotl = (x, n) => n === 0 ? x : ((x << BigInt(n)) | (x >> BigInt(64 - n))) & M64;
  function keccakF(A) {
    const C = new Array(5), B = new Array(25);
    for (let r = 0; r < 24; r++) {
      for (let x = 0; x < 5; x++) C[x] = A[x] ^ A[x + 5] ^ A[x + 10] ^ A[x + 15] ^ A[x + 20];
      for (let x = 0; x < 5; x++) { const D = C[(x + 4) % 5] ^ rotl(C[(x + 1) % 5], 1); for (let y = 0; y < 5; y++) A[x + 5 * y] ^= D; }
      for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) B[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(A[x + 5 * y], ROT[x + 5 * y]);
      for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) A[x + 5 * y] = B[x + 5 * y] ^ ((~B[(x + 1) % 5 + 5 * y] & M64) & B[(x + 2) % 5 + 5 * y]);
      A[0] ^= RC[r];
    }
  }
  function keccak256(msg) {
    const rate = 136, padLen = rate - (msg.length % rate);
    const p = new Uint8Array(msg.length + padLen); p.set(msg); p[msg.length] |= 0x01; p[p.length - 1] |= 0x80;
    const A = new Array(25).fill(0n);
    for (let off = 0; off < p.length; off += rate) {
      for (let i = 0; i < rate / 8; i++) { let v = 0n; for (let k = 7; k >= 0; k--) v = (v << 8n) | BigInt(p[off + i * 8 + k]); A[i] ^= v; }
      keccakF(A);
    }
    const out = new Uint8Array(32);
    for (let i = 0; i < 4; i++) { let v = A[i]; for (let k = 0; k < 8; k++) { out[i * 8 + k] = Number(v & 0xffn); v >>= 8n; } }
    return out;
  }

  // ---------- BLAKE3 (inputs <= 1024 bytes: one chunk, all this tree ever hashes) ----------
  const IV = [0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A, 0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19];
  const PERM = [2, 6, 3, 10, 7, 0, 4, 13, 1, 11, 12, 5, 9, 14, 15, 8];
  const rotr = (x, n) => ((x >>> n) | (x << (32 - n))) >>> 0;
  function g(s, a, b, c, d, x, y) {
    s[a] = (s[a] + s[b] + x) >>> 0; s[d] = rotr(s[d] ^ s[a], 16); s[c] = (s[c] + s[d]) >>> 0; s[b] = rotr(s[b] ^ s[c], 12);
    s[a] = (s[a] + s[b] + y) >>> 0; s[d] = rotr(s[d] ^ s[a], 8); s[c] = (s[c] + s[d]) >>> 0; s[b] = rotr(s[b] ^ s[c], 7);
  }
  function compress(cv, m, blockLen, flags) {
    const s = [cv[0], cv[1], cv[2], cv[3], cv[4], cv[5], cv[6], cv[7], IV[0], IV[1], IV[2], IV[3], 0, 0, blockLen, flags];
    let w = m.slice();
    for (let r = 0; r < 7; r++) {
      g(s, 0, 4, 8, 12, w[0], w[1]); g(s, 1, 5, 9, 13, w[2], w[3]); g(s, 2, 6, 10, 14, w[4], w[5]); g(s, 3, 7, 11, 15, w[6], w[7]);
      g(s, 0, 5, 10, 15, w[8], w[9]); g(s, 1, 6, 11, 12, w[10], w[11]); g(s, 2, 7, 8, 13, w[12], w[13]); g(s, 3, 4, 9, 14, w[14], w[15]);
      if (r < 6) w = PERM.map(i => w[i]);
    }
    for (let i = 0; i < 8; i++) s[i] = (s[i] ^ s[i + 8]) >>> 0;
    return s.slice(0, 8);
  }
  function blake3(msg) {
    if (msg.length > 1024) throw new Error('blake3: single-chunk only');
    let cv = IV.slice(); const nBlocks = Math.max(1, Math.ceil(msg.length / 64));
    for (let bi = 0; bi < nBlocks; bi++) {
      const blk = new Uint8Array(64), part = msg.subarray(bi * 64, bi * 64 + 64); blk.set(part);
      const m = []; for (let i = 0; i < 16; i++) m.push((blk[i * 4] | blk[i * 4 + 1] << 8 | blk[i * 4 + 2] << 16 | blk[i * 4 + 3] << 24) >>> 0);
      let f = 0; if (bi === 0) f |= 1; if (bi === nBlocks - 1) f |= 2 | 8;
      cv = compress(cv, m, part.length, f);
    }
    const out = new Uint8Array(32); cv.forEach((w, i) => { out[i * 4] = w & 255; out[i * 4 + 1] = w >>> 8 & 255; out[i * 4 + 2] = w >>> 16 & 255; out[i * 4 + 3] = w >>> 24 & 255; });
    return out;
  }

  // ---------- EIP-8297 tree ----------
  const bitAt = (b, i) => (b[i >> 3] >> (7 - (i & 7))) & 1;
  const bitsStr = (b, from, to) => { let s = ''; for (let i = from; i < to; i++) s += bitAt(b, i); return s; };
  function encodeBitPrefix(bits) {
    const n = bits.length, out = new Uint8Array(2 + Math.ceil(n / 8)); out[0] = n >> 8; out[1] = n & 255;
    for (let i = 0; i < n; i++) if (bits[i] === '1') out[2 + (i >> 3)] |= 1 << (7 - (i & 7));
    return out;
  }
  const cmpBytes = (a, b) => { const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) if (a[i] !== b[i]) return a[i] - b[i]; return a.length - b.length; };
  // entries: [{key:hex, value:hex}] -> node tree. Branch: {type,prefix(bitstring),pos(start bit),split(bit index),path(bitstring to split, exclusive),left,right}
  function binarize(entries) {
    const E = entries.map(e => ({ key: e.key.toLowerCase(), value: e.value.toLowerCase(), kb: hex2b(e.key) }));
    E.sort((a, b) => cmpBytes(a.kb, b.kb));
    function build(lo, hi, pos, path) {
      if (hi - lo === 1) { const e = E[lo]; return { type: 'leaf', key: e.key, value: e.value, kb: e.kb, pos, path }; }
      const a = E[lo].kb, z = E[hi - 1].kb; let s = pos;
      while (bitAt(a, s) === bitAt(z, s)) s++;
      let mid = lo; while (bitAt(E[mid].kb, s) === 0) mid++;
      const prefix = bitsStr(a, pos, s), p2 = path + prefix;
      return { type: 'branch', prefix, pos, split: s, path: p2, left: build(lo, mid, s + 1, p2 + '0'), right: build(mid, hi, s + 1, p2 + '1') };
    }
    return E.length ? build(0, E.length, 0, '') : null;
  }
  function merkleize(n) {
    if (!n) return new Uint8Array(32);
    if (n.hash) return n.hash;
    if (n.type === 'leaf') n.hash = blake3(cat([0], n.kb, hex2b(n.value)));
    else n.hash = blake3(cat([1], encodeBitPrefix(n.prefix), merkleize(n.left), merkleize(n.right)));
    return n.hash;
  }
  function walk(n, fn, parent = null, depth = 0) { if (!n) return; fn(n, parent, depth); if (n.type === 'branch') { walk(n.left, fn, n, depth + 1); walk(n.right, fn, n, depth + 1); } }
  // witness path identical to gen_fixtures.witness_path
  function witness(root, keyHex) {
    const kb = hex2b(keyHex), levels = []; let n = root, pos = 0, bytes = 0; const nodes = [];
    while (n) {
      nodes.push(n);
      if (n.type === 'leaf') { const present = n.key === keyHex.toLowerCase(); return { present, levels, nodes, terminal: n, bytes: bytes + (present ? 32 : n.kb.length + 32) }; }
      const pl = n.prefix.length;
      if (pos + pl > kb.length * 8 || bitsStr(kb, pos, pos + pl) !== n.prefix) {
        let nb = n; while (nb.type === 'branch') nb = nb.left;
        return { present: false, levels, nodes, terminal: nb, divergedAt: n, bytes: bytes + nb.kb.length + 32 };
      }
      pos += pl; const bit = bitAt(kb, pos); pos++;
      const chosen = bit ? n.right : n.left, sib = bit ? n.left : n.right;
      levels.push({ branch: n, prefixLen: pl, dir: bit, sibling: sib });
      bytes += 2 + Math.ceil(pl / 8) + 32; n = chosen;
    }
    return { present: false, levels, nodes, bytes };
  }
  // positions touched, exactly as compute_recompute_stats (path[:i] for i in 0..len)
  function recomputeSet(root, keys) {
    const set = new Map();
    for (const k of keys) { const w = witness(root, k); w.nodes.forEach(n => set.set(n.type === 'leaf' ? 'L' + n.key : 'B' + n.path, n)); }
    return set;
  }
  function applyWrites(map, writes, dir = 1) { // map: Map key->value
    for (const w of writes) { const v = dir > 0 ? w.after : w.before; const k = w.key.toLowerCase(); if (v == null) map.delete(k); else map.set(k, v.toLowerCase()); }
    return map;
  }
  const toEntries = m => Array.from(m, ([key, value]) => ({ key, value }));
  const rootOf = m => b2hex(merkleize(binarize(toEntries(m))));

  // ---------- embedding helpers ----------
  const addr32 = a => { const o = new Uint8Array(32); o.set(hex2b(a), 12); return o; };
  const u256be = bi => { const o = new Uint8Array(32); let v = BigInt(bi); for (let i = 31; i >= 0; i--) { o[i] = Number(v & 255n); v >>= 8n; } return o; };
  const bytesToBig = b => BigInt(b2hex(b));
  const E = {
    headerStem: a => cat([0], blake3(addr32(a))),
    headerKey: (a, sub) => cat([0], blake3(addr32(a)), [sub]),
    codeChunkKey: (codeHash, i) => cat([1], blake3(cat(hex2b(codeHash), u256be(Math.floor(i / 256)))), [i % 256]),
    storageKey(a, slot) {
      slot = BigInt(slot);
      if (slot < 64n) return { zone: 'header', sub: 64 + Number(slot), key: E.headerKey(a, 64 + Number(slot)) };
      const ti = slot / 256n, sub = Number(slot % 256n), a32 = addr32(a);
      return { zone: 'storage', treeIndex: ti, sub, bucket: cat([0xff], blake3(a32)), group: blake3(cat(a32, u256be(ti))), key: cat([0xff], blake3(a32), blake3(cat(a32, u256be(ti))), [sub]) };
    },
    mappingSlot: (keyAddr, base) => bytesToBig(keccak256(cat(addr32(keyAddr), u256be(base)))),
    chunkify(code) {
      const n = Math.ceil(code.length / 31), chunks = []; let pushRemain = 0; const pd = new Uint8Array(code.length);
      for (let pc = 0; pc < code.length;) { const op = code[pc]; if (op >= 0x60 && op <= 0x7f) { const L = op - 0x5f; for (let j = 1; j <= L && pc + j < code.length; j++) pd[pc + j] = 1; pc += L + 1; } else pc++; }
      for (let i = 0; i < n; i++) {
        let lead = 0; while (31 * i + lead < code.length && pd[31 * i + lead] && lead < 31) lead++;
        const body = new Uint8Array(31); body.set(code.subarray(31 * i, 31 * i + 31));
        const c = cat([lead], body); chunks.push({ i, lead, bytes: c, absent: c.every(x => x === 0) });
      }
      return chunks;
    },
    createAddress(sender, nonce) { // rlp([sender, nonce]) for nonce < 0x80 or small ints
      const s = hex2b(sender); let nb;
      if (nonce === 0) nb = new Uint8Array([0x80]); else if (nonce < 0x80) nb = new Uint8Array([nonce]);
      else { const bs = []; let v = nonce; while (v) { bs.unshift(v & 255); v >>= 8; } nb = cat([0x80 + bs.length], bs); }
      const payload = cat([0x94], s, nb), rlp = cat([0xc0 + payload.length], payload);
      return b2hex(keccak256(rlp).subarray(12));
    },
  };

  // ---------- world reconstruction (inverse of gen_fixtures build_W1/W0/WB) ----------
  function buildWorlds(fx) {
    const J = id => fx.journeys.find(j => j.id === id);
    const W1 = new Map(); fx.nodes.filter(n => n.type === 'leaf').forEach(n => W1.set(n.key.toLowerCase(), n.value.toLowerCase()));
    // W0 = W1 minus distribution: holder balances removed, deployer balance back to full supply, VT1 deposit undone
    const W0 = new Map(W1);
    const j2 = J('J2'), j7 = J('J7'), deployerKey = j2.derivation_steps[8].output.key.toLowerCase();
    for (const k of [...W0.keys()]) if (k.startsWith('0xff') && k !== deployerKey) W0.delete(k);
    W0.set(deployerKey, j2.writes.find(w => w.key.toLowerCase() === deployerKey).after.toLowerCase());
    const vt1Basic = j7.writes.find(w => w.action === 'update'), vt1Slot = j7.writes.find(w => w.action === 'delete');
    W0.set(vt1Basic.key.toLowerCase(), vt1Basic.after.toLowerCase()); W0.delete(vt1Slot.key.toLowerCase());
    const WB = applyWrites(new Map(W0), j2.writes, -1);
    const WA = applyWrites(new Map(WB), J('J3').writes, -1);
    const W1J4a = applyWrites(new Map(W1), J('J4a').writes, 1);
    return { W1, W0, WB, WA, 'W1+J4a': W1J4a };
  }

  // incremental insertion (order-independence demo, A0.B3): mutates/returns root; hashing done after
  function insertIncr(n, key, value) {
    const kb = hex2b(key);
    const rec = (n, pos) => {
      if (!n) return { type: 'leaf', key, value, kb };
      if (n.type === 'leaf') {
        let s = pos; while (bitAt(n.kb, s) === bitAt(kb, s)) s++;
        const nl = { type: 'leaf', key, value, kb }, pre = bitsStr(kb, pos, s);
        return bitAt(kb, s) ? { type: 'branch', prefix: pre, left: n, right: nl } : { type: 'branch', prefix: pre, left: nl, right: n };
      }
      const pl = n.prefix.length; let d = 0; while (d < pl && String(bitAt(kb, pos + d)) === n.prefix[d]) d++;
      if (d < pl) {
        const old = { type: 'branch', prefix: n.prefix.slice(d + 1), left: n.left, right: n.right }, nl = { type: 'leaf', key, value, kb };
        return bitAt(kb, pos + d) ? { type: 'branch', prefix: n.prefix.slice(0, d), left: old, right: nl } : { type: 'branch', prefix: n.prefix.slice(0, d), left: nl, right: old };
      }
      const b = bitAt(kb, pos + pl);
      if (b) n.right = rec(n.right, pos + pl + 1); else n.left = rec(n.left, pos + pl + 1);
      return n;
    };
    return rec(n, 0);
  }

  G.PBTCore = { insertIncr, hex2b, b2hex, cat, keccak256, blake3, bitAt, bitsStr, encodeBitPrefix, binarize, merkleize, walk, witness, recomputeSet, applyWrites, toEntries, rootOf, addr32, u256be, E, buildWorlds };
})(typeof window !== 'undefined' ? window : self);
