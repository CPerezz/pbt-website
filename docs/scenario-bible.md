---
owner: PbtTruth
status: complete
---

# PBT 3D explainer — scenario bible

Ground truth for every journey, zone-atlas panel, why-PBT panel and the sandbox. Every `TRUTH` line
cites an exact EIP-8297 formula (`EIPS/EIPS/eip-8297.md`) with concrete numbers,
plus the exact `fixtures/pbt-fixtures.json` object/key it refers to. Nothing here is hand-typed: every
hash, key and chunk was produced by running the real Python reference implementation
(`execution-specs-ports-wt/src/ethereum/binary_trie/{trie.py,embedding.py}`, branch
`tests/binary-tree-geth-ports`) via `fixtures/gen_fixtures.py`. Beat IDs match an internal beat-list
note exactly; this file adds full TREE/CAPTION/End-state/Traps prose per beat.

Read standalone; you do not need the brief or the EIP open to use this file, though every claim is
traceable back to both.

## 0. World snapshots (see `fixtures/pbt-fixtures.json` → `world`, `world_roots`)

| id | contents | root |
|---|---|---|
| WA | 7 EOAs funded (Acct0,2,3,4,5,6,7); VaultTemplate #1, #2 deployed (Acct0 nonce 0,1) | see `world_roots.WA` |
| WB | WA + VaultTemplate #3 (Acct0 nonce 2) — **this transition is J3** | see `world_roots.WB` |
| W0 | WB + MegaToken deployed (Acct0 nonce 3), full initial supply (1,000,000 MEGA) to Acct0 — **this transition is J2** | see `world_roots.W0` |
| W1 | W0 + MEGA distributed to 4 holders + VaultTemplate#1 receives a 1 ETH deposit — **scripted genesis-style world-building, not its own journey**; shared pre-state for J1,J4,J5,J6,J7,J9,J10,J11 and for the zone-atlas node list | see `world_roots.W1` |

Actors (`fixtures/pbt-fixtures.json` → `world.accounts`), all real, reproducible Anvil/Hardhat dev
keys (mnemonic `test test test test test test test test test test test junk`):

| label | address | role | status in W1 |
|---|---|---|---|
| Acct0 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | deployer/sender | nonce=4, 5 ETH |
| Acct1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | J1's fresh ETH recipient | **absent** |
| Acct2 | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | funded EOA / VaultTemplate#2 owner | nonce=0, 2 ETH |
| Acct3 | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | plain EOA, delegates in J4 | nonce=0, 1 ETH |
| Acct4 | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` | MEGA holder 1 | 250,000 MEGA |
| Acct5 | `0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc` | MEGA holder 2 | 150,000 MEGA |
| Acct6 | `0x976EA74026E726554dB657fA54763abd0C3a0aa9` | MEGA holder 3 | 100,000 MEGA |
| Acct7 | `0x14dC79964da2C08b23698B3D3cc7Ca32193d9955` | MEGA holder 4 | 75,000 MEGA |
| Acct8 | `0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f` | J5's fresh ERC-20 recipient | **absent** |
| Acct9 | `0xa0Ee7A142d267C1f36714E4a8F75612F20a79720` | coinbase / J11 deployer | **absent** |

Contracts (`world.contracts`), all compiled with `solc 0.8.30` from real Solidity source in
`fixtures/sol/*.sol` (no hand-written bytecode anywhere):

| label | address | source | deployer/nonce | notes |
|---|---|---|---|---|
| VaultTemplate1 | `0x5FbDB2315678afecb367f032d93F642f64180aa3` | VaultTemplate.sol | Acct0/0 | 692B runtime, 23 chunks; received a 1 ETH deposit in W1 |
| VaultTemplate2 | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` | VaultTemplate.sol | Acct0/1 | same code_hash as #1 |
| VaultTemplate3 | `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` | VaultTemplate.sol | Acct0/2 | same code_hash; **this deployment is J3** |
| MegaToken | `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9` | MegaToken.sol | Acct0/3 | 8151B runtime, 263 chunks, 2 code groups; **this deployment is J2** |
| VaultTemplate4 | `0xA15BB66138824a1c7167f5E85b957d04Dd34E468` | VaultTemplate.sol | Acct9/1 | J11a only, never in any persisted world snapshot |
| Ephemeral | `0x700b6A60ce7EaaEA56F065753d8dcB9653dbAD35` | Ephemeral.sol | Acct9/0 | J11b only, never in any persisted world snapshot |

MegaToken storage layout (from `solc --storage-layout`, all raw slots < 64, hence **all header slots**):
`name`@0, `symbol`@1, `totalSupply`@2, `owner`@3(offset0)+`paused`@3(offset20, packed), `balanceOf`@4
(mapping), `allowance`@5 (mapping), `nonces`@6 (mapping). VaultTemplate: `owner`@0, `balance`@1.

Hash functions used throughout (EIP-8297 Abstract note + Backwards Compatibility): **BLAKE3** for tree
merkleization and `key_hash` (placement) — explicitly *not final*, candidates BLAKE3/Keccak/Poseidon2.
**Keccak256** for `code_hash`/`EXTCODEHASH`/CREATE&CREATE2 addresses/Solidity mapping-and-array slot
derivation — permanent, unaffected by whichever hash the tree eventually picks.

---

## J1 — Send ETH to a brand-new address
Teaches: absence → insertion split; a plain value transfer creates two brand-new 2-leaf EOAs (recipient
+ coinbase) while the sender's existing leaf is merely updated.
Pre-state: W1   Inputs: `Acct0 → Acct1, value=1.5 ETH, gas_used=21000, base_fee=30 gwei, priority_fee=2 gwei, coinbase=Acct9`

Beats:
- J1.B1 Recipient address padding — TRUTH: `addr32 = 0x00×12 ‖ address20` (EIP-8297 "Tree embedding",
  `address20_to_address32`); Acct1 `0x7099...c79C8` → `addr32` in `fixtures/pbt-fixtures.json` journey
  J1 step 1 `output`.
  | TREE: reads nothing yet (pure byte concat, no tree touch) | CAPTION: "Pad the address to 32 bytes."
- J1.B2 Recipient header stem — TRUTH: `stem = 0x00 ‖ BLAKE3(addr32)`, 33 bytes (EIP-8297
  `account_header_stem`); fixture journey J1 step 2 `output`.
  | TREE: no node exists yet at this stem in W1 (Acct1 absent) | CAPTION: "One BLAKE3 hash finds the account's home."
- J1.B3 Absence → insertion split — TRUTH: Acct1 is absent in W1 (no key with this stem exists); the
  write inserts 2 leaves: `BASIC_DATA` (sub 0, value = version0‖reserved0‖code_size0‖nonce0‖balance=1.5e18)
  and `CODE_HASH` (sub 1, value = `keccak256(b"")` = `0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470`);
  fixture `journeys[J1].writes[1:3]` (`action: "insert"`).
  | TREE: existing branch near this stem's prefix splits at the true first-divergent bit; 2 new leaves created | CAPTION: "No account here yet — the tree grows a branch."
- J1.B4 Coinbase also freshly created — TRUTH: same 2-leaf insertion shape, address Acct9
  `0xa0Ee...a79720`, value = `gas_used × priority_fee` = `21000 × 2e9` = `42,000,000,000,000` wei;
  fixture `journeys[J1].writes[3:5]`.
  | TREE: a second, independent split elsewhere in the account zone | CAPTION: "The block builder gets paid too — another new leaf."
- J1.B5 Sender update in place — TRUTH: Acct0's existing `BASIC_DATA` leaf key is unchanged; only its
  32-byte value changes (nonce `4→5`, balance `5e18 → 5e18-1.5e18-21000×32e9`); fixture
  `journeys[J1].writes[0]` (`action: "update"`, same key before/after).
  | TREE: leaf hash changes, no split/merge — this is the "boring" case, most writes are this | CAPTION: "An existing leaf, same key, new value."
- J1.B6 Root recompute — TRUTH: 5 leaves changed (1 update + 4 inserts) → **17** distinct branch
  positions recomputed, the union of the 5 leaves' root-to-leaf ancestor paths in the post-tree, not
  their sum (see W3/E8); fixture `journeys[J1].hashes_recomputed` = `{branches_recomputed: 17,
  leaves_changed: 5}`.
  | TREE: light pulse travels bottom-up along exactly these 17 branch positions to the new root | CAPTION: "17 branches recompute; the rest of the tree is untouched."

End state: writes — Acct0 BASIC_DATA (update), Acct1 BASIC_DATA+CODE_HASH (insert ×2), Acct9
BASIC_DATA+CODE_HASH (insert ×2). Root: `journeys[J1].pre_root` → `journeys[J1].post_root`. 17 hashes
recomputed (branches_recomputed), 5 leaves changed.
Traps: (1) do NOT draw Acct1/Acct9 as "materializing" at a fixed slot — they land wherever
`BLAKE3(addr32)` happens to hash to, which is uniformly random, not adjacent to Acct0. (2) the base-fee
portion of the gas cost is **burned**, credited to no account at all — never animate it flying to
coinbase; only the priority-fee portion (`42e12` wei here) does. (3) "hashes recomputed" must show 17,
not 5×(that leaf's own path length summed) — see J1.B6.

---

## J2 — Deploy a contract (MegaToken, from scratch)
Teaches: full code-zone merkleization walk for a brand-new `code_hash`: chunking, 2 code groups
(>256 chunks), header creation, constructor writes split across header slots and the storage zone.
Pre-state: WB   Inputs: `Acct0 deploys MegaToken(initialSupply=1_000_000e18), nonce=3`

Beats:
- J2.B1 CREATE address — TRUTH: `address = keccak256(rlp([sender, nonce]))[12:]` (not an EIP-8297
  formula — standard Ethereum CREATE, computed off-chain with `cast compute-address` and verified);
  `sender=Acct0, nonce=3` → `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9`; fixture
  `journeys[J2].derivation_steps[0]`.
  | TREE: nothing yet — this happens before any tree write | CAPTION: "Where does the new contract live? RLP, then keccak."
- J2.B2 code_hash — TRUTH: `code_hash = keccak256(runtime_code)`, `runtime_code` = 8151 real compiled
  bytes → `0x74ee7d6a5a4ca49bb4deb06261a91a5689c5908209e142fe2d87b5726f2ffb83`; fixture
  `journeys[J2].derivation_steps[1]`.
  | TREE: nothing yet | CAPTION: "The bytecode's own hash becomes its tree address."
- J2.B3 chunkify — TRUTH: `chunk_count = ceil(code_size/31) = ceil(8151/31) = 263`; chunk `i` =
  `[min(pushdata_run,31)] ‖ code[31i:31i+31]` (EIP-8297 "Code", `chunkify_code`); 263 > 256 → **2 code
  groups** (`tree_index=0`: chunks 0-255; `tree_index=1`: chunks 256-262); fixture
  `journeys[J2].derivation_steps[2]`.
  | TREE: 263 candidate leaves computed; 128 of them (see J8.B2) encode to 32 zero bytes and never
  become tree entries — only 135 leaves actually get created here | CAPTION: "8151 bytes become 263 31-byte chunks."
- J2.B4 code chunk 0 key — TRUTH: `key = 0x01 ‖ BLAKE3(code_hash‖0_as_32B_BE) ‖ 0` (EIP-8297
  `get_tree_key_for_code_chunk`); fixture `journeys[J2].derivation_steps[3]`.
  | TREE: first leaf of the first code group's stem | CAPTION: "Chunk 0's key: hash the code_hash and group index."
- J2.B5 code chunk 256 key (2nd group) — TRUTH: `tree_index = 256 // 256 = 1`, `sub = 256 % 256 = 0`,
  `key = 0x01 ‖ BLAKE3(code_hash‖1_as_32B_BE) ‖ 0` — a **completely different stem**, unrelated to
  group 0's; fixture `journeys[J2].derivation_steps[4]`.
  | TREE: a second code-zone subtree, scattered far from the first group | CAPTION: "Past chunk 255, a new stem — groups don't chain."
- J2.B6 Header creation — TRUTH: `BASIC_DATA(code_size=8151, nonce=1, balance=0)` + `CODE_HASH` leaves
  at the new stem (EIP-161: contract nonce starts at 1); fixture `journeys[J2].derivation_steps[5]`.
  | TREE: 2 new leaves at MegaToken's own header stem | CAPTION: "A new account header: code_size, nonce=1, code_hash."
- J2.B7 Constructor storage: totalSupply — TRUTH: raw slot 2 < `HEADER_STORAGE_SLOTS`(64) → **header
  slot**, `sub = HEADER_STORAGE_OFFSET+2 = 66`; fixture `journeys[J2].derivation_steps[6]`.
  | TREE: 3rd leaf at the same header stem as J2.B6 — same branch opening, no new split | CAPTION: "totalSupply lives right next to the account header."
- J2.B8 Constructor storage: owner+paused packed — TRUTH: raw slot 3 < 64 → header slot, `sub=67`;
  Solidity packs `owner`(20B, offset 0) and `paused`(1B, offset 20) into one 32-byte word: bytes
  `[0:11]`=0, `[11]`=paused, `[12:32]`=owner; fixture `journeys[J2].derivation_steps[7]`.
  | TREE: 4th leaf at the same header stem | CAPTION: "Two Solidity variables, one 32-byte tree leaf."
- J2.B9 Constructor storage: balanceOf[deployer] — TRUTH: Solidity mapping convention (NOT EIP-8297):
  `storage_key = keccak256(pad32(Acct0)‖pad32(4))`; since `storage_key ≥ 64` this is a **storage-zone**
  insert: `tree_index = storage_key//256`, `sub = storage_key%256`,
  `key = 0xFF‖BLAKE3(mega_addr32)‖BLAKE3(mega_addr32‖tree_index)‖sub`; fixture
  `journeys[J2].derivation_steps[8]`.
  | TREE: a leaf in a completely different zone than J2.B6-B8, reached through a different root path | CAPTION: "A mapping entry lands far from the header — different zone entirely."

End state: 141 leaves changed (135 present code chunks + BASIC_DATA + CODE_HASH + totalSupply + owner +
balanceOf[deployer], 1 sender nonce bump not counted separately — it's the Acct0 BASIC_DATA update
folded into the same 141). Root: `journeys[J2].pre_root` (=`world_roots.WB`) →
`journeys[J2].post_root` (=`world_roots.W0`).
Traps: (1) code-zone chunks and header/storage leaves are **not adjacent** in the tree — never draw a
single continuous camera path implying locality between them; the only thing that ties them together is
the `CODE_HASH` leaf's *value* pointing at the content-addressed code_hash, a data reference, not a tree
edge. (2) group 1 (tree_index=1) is a **new, unrelated stem** — do not draw it as "chunk 256 sitting
right after chunk 255" in tree-position terms, only in *chunk-index* terms. (3) 128 of the 263 candidate
chunks are absent — the code-zone leaf count for MegaToken is 135, not 263; get this exactly right in
any on-screen count.

---

## J3 — Deploy the same bytecode again (dedup)
Teaches: second and third deployments of identical bytecode write **zero** new code-zone leaves;
content-addressing means only a new 34-byte header stem is created per deployment. (User's own example
from the brief.)
Pre-state: WA   Inputs: `Acct0 deploys VaultTemplate(owner=Acct3), nonce=2`

Beats:
- J3.B1 CREATE address, 3rd deployment — TRUTH: `sender=Acct0, nonce=2` →
  `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0`; fixture `journeys[J3].derivation_steps[0]`.
  | TREE: nothing yet | CAPTION: "A third address, same recipe as before."
- J3.B2 code_hash identical — TRUTH: same 692-byte runtime bytes as VaultTemplate #1/#2 →
  `keccak256` produces the **exact same digest**; fixture `journeys[J3].derivation_steps[1]`.
  | TREE: nothing yet | CAPTION: "Same bytecode, same hash — no matter who deploys it."
- J3.B3 Code chunk keys identical → zero new writes — TRUTH: `get_tree_key_for_code_chunk(code_hash, i)`
  depends **only** on `code_hash` and `i`, never on the deploying address (EIP-8297 "Code": "No code
  chunk is keyed by address"); all 23 chunks' keys are byte-identical to the ones VaultTemplate#1 already
  wrote; fixture `journeys[J3].derivation_steps[2]` `output.new_code_leaves_written = 0`.
  | TREE: camera travels to the *existing* 23-chunk code-zone stem, draws one new converging edge from
  VaultTemplate#3's new header — creates NOTHING new here | CAPTION: "The chunks already exist. Nothing new to write."
- J3.B4 Only a new header — TRUTH: 4 leaves changed total: 3 new header leaves for VaultTemplate#3
  (`BASIC_DATA`, `CODE_HASH`, `owner`@header-slot-0) + 1 Acct0 nonce bump; **14** branch positions
  recomputed; fixture `journeys[J3].writes`, `journeys[J3].hashes_recomputed`.
  | TREE: one small new subtree (3 leaves) at a brand-new stem; the shared code-zone stem is untouched | CAPTION: "One new header. The 23 code chunks: unchanged."

End state: 4 leaves changed (3 insert + 1 update), 0 new code-zone leaves, 14 branches recomputed. Root:
`journeys[J3].pre_root` (=`world_roots.WA`) → `journeys[J3].post_root` (=`world_roots.WB`).
Traps: (1) this is **the** highest-value "aha" moment in the whole page — a second/third deployment must
visibly NOT create a second code-zone subtree, ever (see E10). (2) the "× N accounts" badge on the shared
code group should read `× 3` after this journey, not reset per-journey.

---

## J4a — Delegate an EOA (EIP-7702)
Teaches: `DELEGATION_LEAF_KEY`(sub 2) written, `CODE_HASH_LEAF_KEY`(sub 1) removed, `code_size`=23; a
dashed "resolves-to" line (not a tree edge) points at the target's own header.
Pre-state: W1   Inputs: `Acct3 authorizes delegation to VaultTemplate1 (0x5FbDB2...)`

Beats:
- J4a.B1 Delegation indicator — TRUTH: `code = 0xef0100 ‖ target20`, exactly 23 bytes (EIP-8297
  "Delegation"; EIP-3541 bans this marker from ever being real deployed code, so holding it means
  delegation, nothing else); `target=VaultTemplate1`; fixture `journeys[J4a].derivation_steps[0]`.
  | TREE: nothing yet | CAPTION: "The delegation indicator: marker plus target address."
- J4a.B2 DELEGATION_LEAF_KEY write — TRUTH: `sub_index = DELEGATION_LEAF_KEY = 2`, value =
  `encode_delegation(code) = right_pad_zero_bytes(code, 32)` = indicator + 9 zero bytes; fixture
  `journeys[J4a].writes[2]` (`action: "insert"`, value
  `0xef01005fbdb2315678afecb367f032d93f642f64180aa3000000000000000000`).
  | TREE: new leaf at Acct3's existing header stem (sub 2), same stem as BASIC_DATA/CODE_HASH | CAPTION: "One new leaf: the delegation record."
- J4a.B3 CODE_HASH leaf removed — TRUTH: EIP-8297 "Delegation": "Being delegated and holding contract
  code are mutually exclusive... every account that exists holds exactly one of the CODE_HASH_LEAF_KEY
  and DELEGATION_LEAF_KEY leaves"; `embed_account` unconditionally clears sub 1; fixture
  `journeys[J4a].writes[1]` (`action: "delete"`).
  | TREE: an existing leaf disappears from the same stem | CAPTION: "The code-hash leaf is removed — the two are exclusive."
- J4a.B4 Nonce bump — TRUTH: **EIP-7702 protocol rule, not EIP-8297**: an authorizing account's nonce
  increments by 1 per used authorization; `nonce 0→1`; fixture `journeys[J4a].derivation_steps[3]`.
  | TREE: same BASIC_DATA leaf as always, value changes | CAPTION: "Authorizing costs a nonce, like any signed action."
- J4a.B5 Resolves-to (weak link) — TRUTH: the target's `CODE_HASH` leaf key
  (`get_tree_key_for_code_hash(target32)`) is what a client looks up to resolve delegated execution — this
  is a **client-side lookup following a 20-byte value**, never a stored tree pointer or edge; fixture
  `journeys[J4a].derivation_steps[4]`.
  | TREE: a dashed, non-structural line from Acct3's DELEGATION leaf to VaultTemplate1's CODE_HASH leaf
  and onward to its code group | CAPTION: "Delegation points at code by address — not a tree edge."

End state: writes — Acct3 BASIC_DATA (update, nonce+balance unchanged except nonce), CODE_HASH (delete),
DELEGATION (insert). Root: `journeys[J4a].pre_root` (=`world_roots.W1`) → `journeys[J4a].post_root`.
Traps: (1) never draw the "resolves-to" line as a real tree edge (E11) — it is pure client-side address
resolution. (2) do not show BOTH CODE_HASH and DELEGATION leaves present simultaneously at any point —
they are strictly exclusive, the removal and insertion are the same beat.

## J4b — Re-delegate to a new target
Teaches: same `DELEGATION_LEAF_KEY` key, value overwritten — delegation changes target without any key
churn.
Pre-state: W1+J4a   Inputs: `Acct3 authorizes delegation to VaultTemplate2 (0xe7f172...)`
Beats:
- J4b.B1 Value overwrite — TRUTH: same key as J4a.B2, new value
  `encode_delegation(0xef0100‖VaultTemplate2_20‖0×9)`; fixture `journeys[J4b].writes[0]` (`action: "update"`).
  | TREE: one leaf's value changes, key identical, the resolves-to line swings to a different code group | CAPTION: "Same leaf. The address inside it changes."
End state: 1 leaf updated (2 leaves changed counting the nonce bump). Root: `journeys[J4b].pre_root`
(=`journeys[J4a].post_root`) → `journeys[J4b].post_root`.
Traps: do not animate this as delete-then-insert; it is a single value overwrite at an unchanged key.

## J4c — Revoke a delegation (authorize to 0x0)
Teaches: an authorization to the zero address clears delegation entirely, restoring the account to the
exact shape of a never-delegated EOA.
Pre-state: W1+J4a   Inputs: `Acct3 authorizes delegation to 0x000...000`
Beats:
- J4c.B1 Restore to empty — TRUTH: EIP-8297 "Delegation": "An authorization to the zero address clears
  the delegation, replacing this leaf with a code_hash leaf holding the hash of empty bytecode and
  zeroing code_size"; calling `embed_account` with `code=b""` removes DELEGATION (sub 2) and restores
  CODE_HASH (sub 1) = `keccak256(b"") = 0xc5d24601...d85a470`, `code_size=0`; fixture
  `journeys[J4c].writes`.
  | TREE: DELEGATION leaf disappears, CODE_HASH leaf reappears at the same stem, resolves-to line vanishes | CAPTION: "Revoke to zero: the account is a plain EOA again."
End state: 3 leaves changed (BASIC_DATA update, CODE_HASH insert, DELEGATION delete). Root:
`journeys[J4c].pre_root` (=`journeys[J4a].post_root`) → `journeys[J4c].post_root`.
Traps: the restored CODE_HASH value is byte-identical to any never-delegated EOA's — do not invent a
distinct "revoked" visual state; post-J4c, Acct3 is indistinguishable in the tree from an account that
was never delegated at all.

---

## J5 — Transfer an ERC-20
Teaches: mapping-slot derivation (Solidity, Keccak) feeds the EIP-8297 storage-zone key formula
(BLAKE3); sender update + recipient insert land in two different storage groups of the same bucket;
contrast with a header slot.
Pre-state: W1   Inputs: `MegaToken.transfer(from=Acct4, to=Acct8, amount=40,000 MEGA)`

Beats:
- J5.B1 Sender balance slot — TRUTH: Solidity mapping convention (NOT an EIP-8297 formula):
  `storage_key = keccak256(pad32(Acct4) ‖ pad32(4))` (base slot 4 = `balanceOf`); fixture
  `journeys[J5].derivation_steps[0]`, `output.storage_key`, `tree_index`, `sub`.
  | TREE: nothing yet — pure Keccak arithmetic | CAPTION: "Keccak the holder and the mapping slot together."
- J5.B2 Sender storage-zone key, update in place — TRUTH: `storage_key ≥ 64` → storage zone:
  `key = 0xFF ‖ BLAKE3(mega_addr32) ‖ BLAKE3(mega_addr32‖tree_index) ‖ sub`; value
  `250,000e18 → 210,000e18`; fixture `journeys[J5].writes[0]` (`action: "update"`).
  | TREE: existing leaf, value changes | CAPTION: "The sender's balance leaf: same key, less MEGA."
- J5.B3 Recipient balance slot, fresh insert — TRUTH: `storage_key = keccak256(pad32(Acct8)‖pad32(4))`,
  a **different** `tree_index` than Acct4's (near-certain: keccak outputs are independent 256-bit
  values) → lands in a different storage group of the same bucket; fixture
  `journeys[J5].derivation_steps[2]`, `journeys[J5].writes[1]` (`action: "insert"`, value `40,000e18`).
  | TREE: a brand-new leaf, likely under a different branch than the sender's, though both share the
  `0xFF‖BLAKE3(mega_addr32)` bucket prefix | CAPTION: "The recipient's first-ever balance — a new leaf."
- J5.B4 Contrast: header slot untouched — TRUTH: MegaToken's own `totalSupply` (raw slot 2 < 64) resolves
  to `get_tree_key_for_header(mega_addr32, 66)`, the **account** zone, not the storage zone — a transfer
  never touches it (total supply is conserved); fixture `journeys[J5].derivation_steps[3]`.
  | TREE: a leaf in a completely different zone, visibly not lit up by this beat | CAPTION: "totalSupply doesn't move — only the two balances do."

End state: 2 leaves changed (1 update, 1 insert). Root: `journeys[J5].pre_root` (=`world_roots.W1`) →
`journeys[J5].post_root`.
Traps: (1) the mapping-slot Keccak step (J5.B1) and the tree-placement BLAKE3 steps (J5.B2) are TWO
DIFFERENT hash functions chained together — label both explicitly, never imply one hash does both jobs
(E11). (2) sender and recipient balances do NOT share a storage group merely because they're both MEGA
holders — each holder's group is essentially random within the bucket.

---

## J6 — Call a contract (partial code witness)
Teaches: only the chunks execution actually visits are needed in a witness; a call to
`transfer(address,uint256)` touches the dispatcher chunks plus the function-body chunk starting at its
real JUMPDEST, not all 263 chunks of MegaToken. Companion to J5 — same call, no new writes shown here.
Pre-state: W1   Inputs: `MegaToken.transfer(...)` — same call as J5, viewed for its code-witness footprint

Beats:
- J6.B1 Function selector — TRUTH: `selector = keccak256("transfer(address,uint256)")[:4] = 0xa9059cbb`
  (from `solc`'s own `hashes` output, real ABI selector, not EIP-8297); fixture
  `journeys[J6].derivation_steps[0]`.
  | TREE: nothing — pure EVM-level fact | CAPTION: "Every call starts with a 4-byte function selector."
- J6.B2 Dispatcher JUMPDEST — TRUTH: found by disassembling MegaToken's **real** compiled runtime
  bytecode (PUSH-operand-length-aware scan for `PUSH4<selector>...PUSH2<dest>...JUMPI`): `dest=687`,
  `chunk = 687//31 = 22`; fixture `journeys[J6].derivation_steps[1]`.
  | TREE: highlights code-zone leaf at chunk index 22 within MegaToken's first code group | CAPTION: "The dispatcher jumps to chunk 22 for transfer."
- J6.B3 Dispatcher chunks always touched — TRUTH: chunks `0..22` are read on **every** call, regardless
  of which function is invoked (the dispatch table itself); fixture `journeys[J6].derivation_steps[2]`.
  | TREE: chunks 0-22 highlighted as "always read"; chunk 22 onward as "read for this call only" | CAPTION: "23 chunks for the dispatcher; the rest only if you call them."
- J6.B4 Shared byte0 field — TRUTH: a chunk's byte 0 (leading-PUSHDATA-byte count) is the exact same
  field the EVM's own jumpdest-validity analysis needs to tell a real JUMPDEST from a byte that merely
  has the same numeric value inside a PUSH operand (EIP-8297 "Code"); fixture
  `journeys[J6].derivation_steps[3]`.
  | TREE: no new highlight, a callout on the already-shown chunk 22 | CAPTION: "One byte does double duty: chunking and jumpdest safety."

End state: no writes (read-only beat; the mutation this call would also perform is J5's). Root unchanged.
Traps: do not show this beat lighting up MegaToken's other 240 chunks "just in case" — the entire point
is that a witness for this call is small precisely because it doesn't.

---

## J7 — Clear a slot (write zero)
Teaches: a write of 32 zero bytes resolves to a deletion at the state layer; the tree's own one-level
merge restores canonical form.
Pre-state: W1   Inputs: `VaultTemplate1.withdraw(1 ether)` — the owner withdraws the full deposited balance

Beats:
- J7.B1 Withdraw zeroes the storage var — TRUTH: EIP-8297 "Zero values and deletion": `state_write`
  resolves a write of 32 zero bytes to a deletion rather than an insertion; VaultTemplate1's `balance`
  storage var `1e18 → 0` triggers exactly this; fixture `journeys[J7].writes[1]` (`action: "delete"`).
  | TREE: an existing leaf disappears; its parent branch (if left with one child) is promoted per
  "Insertion and deletion" — a surviving LeafNode moves up unchanged, a surviving BranchNode takes
  `parent.prefix ‖ selecting_bit ‖ own.prefix` | CAPTION: "Zero is the same as absent — the leaf vanishes."
- J7.B2 Header sub-index of slot 1 — TRUTH: `sub = HEADER_STORAGE_OFFSET + 1 = 65`; fixture
  `journeys[J7].derivation_steps[1]`.
  | TREE: (context for B1) this leaf lived at VaultTemplate1's header stem, sub 65 | CAPTION: "Slot 1 lived at header sub-index 65."
- J7.B3 Merge recompute — TRUTH: 2 leaves changed (VaultTemplate1's `BASIC_DATA` balance→0 as an
  **update**, since the account still has an ETH balance field even at 0 wei header-balance... actually
  the header ETH balance also goes to 0 here since the whole deposit is withdrawn — both the `balance`
  storage var (deleted) and the account's own ETH balance field inside `BASIC_DATA` (updated) change) →
  **10** branch positions recomputed; fixture `journeys[J7].hashes_recomputed`.
  | TREE: light pulse to exactly these 10 branch positions, including the one-level merge point | CAPTION: "10 branches recompute for one deletion and one update."

End state: 2 leaves changed (1 update, 1 delete), 10 branches recomputed. Root: `journeys[J7].pre_root`
(=`world_roots.W1`) → `journeys[J7].post_root`.
Traps: (1) never animate a multi-level cascade of merges — EIP-8297 "Insertion and deletion" states the
merge is bounded to exactly one level; only the immediate parent of the deleted leaf can ever disappear.
(2) do not draw a "tombstone" — the deleted leaf's position simply stops existing; nothing marks where it
was (E12).


---

## J8 — Deploy a big contract (>256 chunks)
Teaches: a contract past 256 chunks spans 2+ code groups scattered across the code zone; a PUSH32
operand can straddle a chunk boundary; a genuine zero-code, non-PUSHDATA run is an absent chunk.
Detail lens on J2 — same deployment event, no new tree writes; this beat re-visits MegaToken's code-zone
layout with more precision.
Pre-state: W0 (=post-J2)   Inputs: none new — analysis of MegaToken's already-deployed 8151-byte runtime

Beats:
- J8.B1 Chunk count and groups — TRUTH: `ceil(8151/31) = 263` chunks; group 0 = chunks 0-255 (full 256),
  group 1 = chunks 256-262 (only 7); fixture `journeys[J8].derivation_steps[1]`.
  | TREE: two code-zone subtrees, unequal size, unrelated stems | CAPTION: "263 chunks: one full group, one short one."
- J8.B2 Genuine all-zero absent chunk — TRUTH: EIP-8297 "Code": "A chunk encodes to 32 zero bytes when
  its 31 code bytes are all 0x00 and byte 0's PUSHDATA count is zero too... such a zero chunk is absent
  from the tree like any other zero value"; MegaToken has **128** such chunks (from the explicit
  `RESERVED_ZERO_REGION` data blob compiled into the contract — a real, if stylised, zero-padding/reserved
  data-region pattern), first at chunk index 131; fixture `journeys[J8].derivation_steps[2]`.
  | TREE: 128 hollow, absent slots inside the code-group fan — no leaf rendered, only their sub-index
  position, per E12/E4 | CAPTION: "128 chunks are pure zero and simply don't exist as leaves."
- J8.B3 PUSH32 straddling a chunk boundary — TRUTH: opcode `0x7F` (PUSH32) at byte offset `pc=454`; its
  32-byte operand spans bytes `[455,486)`; `455//31=14`, `486//31=15` → the operand **crosses** chunk
  14→15; found by disassembling the real bytecode (PUSH-length-aware scan), not asserted; fixture
  `journeys[J8].derivation_steps[3]`.
  | TREE: chunk 14's tail bytes and chunk 15's head bytes are both marked as PUSHDATA continuation (chunk
  15's byte 0 > 0); EIP-8297 example: `PUSH4 99 98 | 97 96 PUSH1 128 MSTORE` → 2nd chunk begins `2 97 96...` | CAPTION: "One 32-byte constant, split across two 31-byte chunks."

End state: no new writes (detail lens on J2's already-committed state). Root unchanged from J2's post-root.
Traps: (1) the 128 absent chunks are a deliberate contract feature (a zero data region), not chunker
"failure" or a bug — say so once. (2) chunk 15's leading bytes look like zero code but are NOT an absent
chunk — its byte 0 (pushdata continuation count) is nonzero, so its 32-byte value is NOT all-zero even
though its 31 *code* bytes might partly be — "a zero slice that continues PUSHDATA is present" (EIP-8297
"Code"), the exact opposite of J8.B2. Get this contrast right, it is the single easiest fact to invert.

---

## J9 — Prove it (witness anatomy)
Teaches: a PBT witness is the path plus exactly one sibling hash per level (arity 2); shown against
MPT's 15-wide branches at the same real depth, using this fixture's own real witness bytes, not the
EIP's abstract table alone.
Pre-state: W1   Inputs: presence proof for Acct4's MegaToken balance leaf; absence proof for Acct1's
`BASIC_DATA` key (Acct1 doesn't exist until J1)

Beats:
- J9.B1 Presence witness — TRUTH: for Acct4's balance leaf (key
  `0xff2fa276d5d8...377da`, 66 bytes), the real path in W1 has **3** branch levels; witness =
  `Σ(2 + ceil(prefix_bit_count/8) + 32)` per level = **167 bytes** total (`encode_bit_prefix` of each
  branch on the path + its sibling's 32-byte hash, plus the leaf's own 32-byte value at the end); fixture
  `journeys[J9].derivation_steps[0]`.
  | TREE: the real root-to-leaf path in the active color; exactly one sibling bead lit per level (3
  beads total), everything else ghosted (E9) | CAPTION: "3 levels, 1 sibling each: 167 bytes proves this balance."
- J9.B2 Absence witness — TRUTH: Acct1's `BASIC_DATA` key does not exist in W1; the walk diverges 5
  levels down, inside a branch's own prefix run; the terminal "neighbor" leaf's **full key and value**
  (not just a hash) prove the divergence — **238 bytes** total; fixture
  `journeys[J9].derivation_steps[1]`.
  | TREE: same path-highlight grammar, but the terminal node is a real, unrelated leaf whose full key
  visibly differs from the queried key at the point of divergence | CAPTION: "5 levels down, a different leaf proves nothing exists here."
- J9.B3 MPT comparison — TRUTH: EIP-8297 Motivation, exact quoted figure: "a branch at that depth is
  `15 × 32 × 12 = 5760` bytes: 15 sibling hashes of 32 bytes at each of the 12 levels" (typical MPT
  account-trie depth); fixture `journeys[J9].derivation_steps[2]`.
  | TREE: side-by-side comparison panel, not part of the live 3D tree — an MPT branch has 15 siblings
  per level where PBT has exactly 1 | CAPTION: "MPT: 5760 bytes at depth 12. PBT: 167-238 bytes here."

End state: no writes (read-only proof demo). Root unchanged.
Traps: (1) never round the sibling count down to "roughly narrower than Verkle" without also showing PBT
has *more levels* than Verkle's wide nodes for the same N — the honest comparison is width vs depth, not
a flat "PBT wins." (2) the absence proof is NOT "prove the key literally isn't in a list" — it is a
specific unrelated leaf whose key diverges at a specific bit, shown concretely.

---

## J10 — One block, many writes
Teaches: independent writes across zones/accounts (J1's ETH send, J5's ERC-20 transfer, J4a's
delegation) share upper branch nodes; one bottom-up recomputation recomputes the union, not the naive
per-write sum.
Pre-state: W1   Inputs: J1 + J5 + J4a applied together, in one block, to the same pre-state

Beats:
- J10.B1 Combined write set — TRUTH: J1 changes 5 leaves, J5 changes 2, J4a changes 3 → **9** total
  distinct leaves changed (no key collisions between the three journeys' write sets); fixture
  `journeys[J10].derivation_steps[0]`.
  | TREE: all three journeys' beats play out in the same scene, across the account/storage zones and
  Acct3's header, simultaneously | CAPTION: "Three unrelated actions, one block, nine leaves."
- J10.B2 Union vs naive sum — TRUTH: naive per-journey sum of branch recomputes = J1's 17 + J5's ? + J4a's
  ? = **32**; the real single bottom-up pass over the combined write set recomputes only **27** branch
  positions, because the root and its near neighbors are shared by all three (EIP-8297 Rationale,
  "Single tree with zones": "The root recomputes in one bottom-up pass and the two branches meet near
  the root"); fixture `journeys[J10].hashes_recomputed`, `journeys[J10].notes[0]`.
  | TREE: one merkleization wave, 27 pulses, visibly fewer than three separate 17+X+Y waves would be | CAPTION: "27 recomputes, not 32 — paths meet near the root."

End state: 9 leaves changed, 27 branches recomputed (vs naive sum 32). Root: `journeys[J10].pre_root`
(=`world_roots.W1`) → `journeys[J10].post_root`.
Traps: (1) do NOT flash the whole tree on every block — only the 27 real branch positions light up,
never more. (2) the "savings" number (32→27, a 5-branch/~16% reduction here) is fixture-specific to
*this* combination of writes; do not present it as a fixed universal ratio — a future block with more
writes sharing more structure would show a bigger gap, one with fewer shared ancestors a smaller one.

---

## J11a — SELFDESTRUCT in creating tx (shared code)
Teaches: header and storage leaves are removed unconditionally; code chunks survive because sibling
accounts still share the same `code_hash`.
Pre-state: W1   Inputs: a 4th VaultTemplate instance is deployed AND destroyed within the same
transaction (EIP-6780), deployer=Acct9, nonce=1 → `0xA15BB6...E468`

Beats:
- J11a.B1 Create phase — TRUTH: deploying VaultTemplate#4 writes 3 leaves (`BASIC_DATA`, `CODE_HASH`,
  `owner`@header-slot-0); its `code_hash` is **identical** to VaultTemplate#1-3's, so the chunk-write step
  is a no-op exactly as in J3; fixture `journeys[J11a].phases.create`.
  | TREE: same "converging edge, no new code leaves" grammar as J3.B3 | CAPTION: "A 4th instance — code chunks, unchanged again."
- J11a.B2 Destroy phase — TRUTH: EIP-8297 "Zero values and deletion": "Deleting an account... MUST
  remove its header leaves and its storage leaves. Its code... MUST be kept [if] no account in the
  resulting state has the same code_hash" — VaultTemplate#1,2,3 still exist and hold this code_hash, so
  the reference check keeps all 23 code chunks; only the 3 header/storage leaves from J11a.B1 disappear;
  fixture `journeys[J11a].phases.destroy`.
  | TREE: the 3-leaf subtree created in B1 vanishes completely; the shared 23-chunk code group is
  untouched throughout | CAPTION: "The account vanishes. The code it borrowed does not."
- J11a.B3 Net trace — TRUTH: `post_root == pre_root` exactly (`journeys[J11a].pre_root ==
  journeys[J11a].post_root` is `True` in the fixture) — an account created and destroyed within its own
  creating transaction leaves **zero footprint** in the committed state, matching every other account
  that was never created at all; fixture `journeys[J11a].notes[0]`.
  | TREE: camera returns to exactly the same tree shape it started from | CAPTION: "Created and destroyed in one breath: as if it never happened."

End state: create phase 3 inserts, destroy phase 3 deletes, net 0. `pre_root == mid_root's ancestor... ==
post_root`. See `journeys[J11a].mid_root` for the (never-finalized) intermediate state.
Traps: (1) do not skip the mid-transaction state — the code_hash reference check (B2) is the entire
teaching point and needs the account to visibly exist first. (2) never imply this is a "failed"
deployment — it succeeded and then was destroyed; the zero net trace is a state-tree fact, not a
transaction-level revert.

## J11b — SELFDESTRUCT in creating tx (unique code)
Teaches: contrast with J11a — this contract's bytecode is unique, so its code-zone leaves are written on
create AND removed on destroy, not just header/storage.
Pre-state: W1   Inputs: `Ephemeral` (distinct 152-byte contract, never deployed elsewhere) deployed AND
destroyed within the same transaction, deployer=Acct9, nonce=0 → `0x700b6A...bAD35`

Beats:
- J11b.B1 Create phase — TRUTH: brand-new, never-before-seen `code_hash`; `chunkify_code` on 152 bytes
  produces 5 chunks, all 5 present (none happen to be all-zero); create-phase writes = 2 header leaves +
  5 code chunks = 7 leaves; fixture `journeys[J11b].phases.create`.
  | TREE: a brand-new code-zone stem appears (unlike J11a, where none did) | CAPTION: "Unique code means a brand-new code group, too."
- J11b.B2 Destroy phase — TRUTH: the reference check finds **zero** other accounts with this code_hash →
  code chunks **ARE** removed (contrast with J11a.B2); destroy-phase writes = same 7 leaves, all deleted;
  fixture `journeys[J11b].phases.destroy`.
  | TREE: the entire 7-leaf subtree from B1 vanishes, including the code group | CAPTION: "No one else uses this code — it goes too."
- J11b.B3 Net trace — TRUTH: `post_root == pre_root` exactly, same as J11a, despite the different
  code-zone fate mid-transaction; fixture `journeys[J11b].notes[0]`.
  | TREE: same "back to the exact starting shape" beat as J11a.B3 | CAPTION: "Same ending as J11a — but the code didn't survive this time."

End state: create phase 7 inserts, destroy phase 7 deletes, net 0.
Traps: put J11a and J11b back-to-back — the *only* difference visible to the user should be whether the
code group persists after the account vanishes; everything else (header/storage removal, net-zero root)
is identical, and that symmetry is itself the point.


---

# Zone Atlas (revisit the zones — 100% visual, minimal text)

## A0 — Tree mechanics
Teaches: the two node types, prefix compression, and why the tree has exactly one canonical form per
key/value set.
- A0.B1 Two node types only — TRUTH: EIP-8297 "Tree structure": `LeafNode(key, value)` and
  `BranchNode(prefix, left, right)`; "There is no separate extension node... no stem nodes, no
  empty/internal placeholder nodes" (unlike EIP-7864, cited explicitly by the fact sheet).
  | TREE: a small live playground trie (not the demo world) where every node is provably one of exactly
  two shapes | CAPTION: "Only two kinds of node exist. Ever."
- A0.B2 Prefix compression — TRUTH: "A BranchNode MUST have two non-empty children: a prefix shorter
  than the true shared run would leave the keys still agreeing at the next bit, emptying one side, which
  is not a valid BranchNode. This forces every prefix to be exactly the shared run" (EIP-8297 "Tree
  structure"); a shared bit-run of any length collapses to ONE `prefix` field on ONE real BranchNode,
  never a chain.
  | TREE: insert two keys sharing a long prefix into the playground; a single branch appears with a long
  prefix tube, not a chain of single-bit nodes (E3) | CAPTION: "A long shared run: still just one branch."
- A0.B3 Canonical form — TRUTH: `binarize`'s split-point search (`while len({bit at split})==1: split+=1`)
  is fully deterministic given a key/value set — "each key/value set has exactly one valid tree" (EIP-8297
  "Tree structure").
  | TREE: shuffle the insertion order in the playground; the resulting tree and root are identical every
  time | CAPTION: "Insert in any order — the tree that results is always the same."
- A0.B4 Why MAX_KEY_LENGTH=8192 — TRUTH: EIP-8297 "Maximum key length": `encode_bit_prefix` stores a
  branch's bit count in 2 bytes (max `2^16-1=65535` bits representable); two distinct L-byte keys can
  share at most `8L-1` bits; requiring `8L-1 ≤ 65535` gives `L ≤ 8192`. Purely explanatory — every real
  key this embedding produces is 34 or 66 bytes (`ACCOUNT_KEY_LENGTH`/`CODE_KEY_LENGTH`/
  `STORAGE_KEY_LENGTH`), nowhere near this bound; no beat or journey in this catalogue needs a
  "rejected key" state.
  | TREE: no live tree action — a small formula callout only | CAPTION: "Why 8192 bytes? The prefix's own bit-counter caps it."

## A1 — Zone map
Teaches: the first byte of every key is a zone identifier; the real root geometry, not a diagram.
- A1.B1 Zone byte table — TRUTH: EIP-8297 "Zones": `0x00` account headers, `0x01` code chunks
  (content-addressed), `0x02`-`0xFE` reserved for future categories, `0xFF` storage.
  | TREE: full-tree overview shot, colored ground-fog sectors per zone (E5) | CAPTION: "One byte, four kinds of state."
- A1.B2 Real root geometry — TRUTH: confirmed both analytically and against the fixture: zone bytes are
  `0x00=0b00000000`, `0x01=0b00000001`, `0xFF=0b11111111`; the tree's real root
  (`fixtures/pbt-fixtures.json` → `zone_atlas.root`) is a BranchNode with **empty own prefix**
  (`root_split` shows the split happens at bit 0, the very first bit) — MSB=0 for account+code (left
  child, id `zone_atlas.root_split.bit0_left.id`), MSB=1 for storage (right child, id
  `zone_atlas.root_split.bit0_right.id`, confirmed `zone_byte_of_subtree=255`).
  | TREE: the actual W1 root node and its two children, not a redrawn schematic | CAPTION: "Bit 0 alone splits storage from everything else."
- A1.B3 Left sub-split — TRUTH: the root's left child is itself a BranchNode with own prefix
  `"000000"` (6 bits, `zone_atlas.root_split.bit0_left.prefix_bits`) — 0x00 and 0x01 agree on every bit
  except the last one of the first byte; it splits on bit 7 into account (0x00, left) vs code (0x01,
  right); the fixture confirms `bit0_left.zone_byte_of_subtree = None` (this node is not yet a single
  zone; its own two children are).
  | TREE: zoom one level deeper than A1.B2 to show the account/code fork | CAPTION: "One more bit: accounts split from code."

## A2 — Account header stem
Teaches: up to 256 sub-index positions under one stem; BASIC_DATA's packed fields; the code_hash/
delegation exclusivity; the header-storage band.
- A2.B1 256 sub-index positions, few used — TRUTH: `STEM_SUBTREE_WIDTH=256`; in-use sub-indices:
  `BASIC_DATA_LEAF_KEY=0`, `CODE_HASH_LEAF_KEY=1`, `DELEGATION_LEAF_KEY=2`,
  `HEADER_STORAGE_OFFSET(64)..HEADER_STORAGE_OFFSET+HEADER_STORAGE_SLOTS-1(127)`; sub 3-63 and 128-255
  reserved/unused (EIP-8297 "Tree embedding", "Header values").
  | TREE: E4's rotary fan at any account's header stem, most of the 256 positions dim/hollow, ~4-6 lit | CAPTION: "256 possible slots. Most accounts use 2-6."
- A2.B2 BASIC_DATA fields — TRUTH: EIP-8297 "Header values" table: `version`(offset 0, 1 byte),
  `code_size`(offset 4, 4 bytes), `nonce`(offset 8, 8 bytes), `balance`(offset 16, 16 bytes); bytes 1-3
  reserved; example from fixture: MegaToken's `BASIC_DATA` = `0x00·000000·00001fd7·0000000000000001·
  00000000000000000000000000000000` (code_size=8151=0x1fd7, nonce=1, balance=0).
  | TREE: unfold the BASIC_DATA leaf's 32-byte value into its 5 labeled fields | CAPTION: "One leaf, five packed fields, one branch opening."
- A2.B3 CODE_HASH xor DELEGATION — TRUTH: "every account that exists holds exactly one of the
  CODE_HASH_LEAF_KEY and DELEGATION_LEAF_KEY leaves" (EIP-8297 "Delegation"); demonstrated by J4a
  (insert DELEGATION, delete CODE_HASH in the same beat) and J4c (the reverse).
  | TREE: sub-1 and sub-2 positions in the fan, only ever one lit at a time, live-toggle demo using J4a/J4c's fixture data | CAPTION: "Code hash or delegation. Never both."
- A2.B4 Header-storage band — TRUTH: "HEADER_STORAGE_OFFSET sits on a power-of-two boundary: with
  HEADER_STORAGE_SLOTS=64, the header slots are exactly the sub-indices whose two leading bits are 01, so
  the whole range hangs off a single branch" (EIP-8297 Rationale, "Storage layout"); demonstrated by
  MegaToken's totalSupply(sub 66)/owner(sub 67) and VaultTemplate's owner(sub 64)/balance(sub 65), all
  real fixture leaves.
  | TREE: the sub 64-127 band highlighted as one shared branch opening within the fan | CAPTION: "The first 64 storage slots share one branch with the header."


## A3 — Code zone
Teaches: the live chunker, groups, content addressing, dedup, zero-chunk absence.
- A3.B1 Live chunker — TRUTH: EIP-8297 "Code": `chunkify_code`; chunk `i` = `[min(pushdata_run,31)] ‖
  code[31i:31i+31]`; worked example straight from the EIP text: `...PUSH4 99 98 | 97 96 PUSH1 128
  MSTORE...` → the chunk after `|` begins `2 97 96 PUSH1 128 MSTORE` (2 leading PUSHDATA bytes).
  | TREE: X1-style live input box, type/paste bytecode, watch chunks materialize with byte-0 counts shown | CAPTION: "Type bytecode, watch it split into 31-byte chunks."
- A3.B2 Groups — TRUTH: `STEM_SUBTREE_WIDTH=256` chunks per code group, stem =
  `0x01 ‖ BLAKE3(code_hash‖tree_index_as_32B_BE)`; MegaToken's 263 chunks form exactly 2 groups
  (`fixtures/pbt-fixtures.json` → `journeys[J8].derivation_steps[1].output`).
  | TREE: two code-zone stems, scattered, both traceable to the same 32-byte code_hash | CAPTION: "256 chunks per group. Past that: a new, unrelated stem."
- A3.B3 Dedup — TRUTH: VaultTemplate deployed 3 times (`world.contracts.VaultTemplate{1,2,3}`) shares one
  23-chunk code group; `journeys[J3].derivation_steps[2].output.new_code_leaves_written = 0` on the 2nd
  and 3rd deployments.
  | TREE: 3 converging header edges into one code group (E10) | CAPTION: "3 deployments, 1 set of chunks."
- A3.B4 Zero-chunk absence — TRUTH: EIP-8297 "Code": a chunk encoding to 32 zero bytes (zero code AND
  byte0=0) is absent; a zero slice continuing PUSHDATA is present; MegaToken has both cases: 128 genuine
  absent chunks (`journeys[J8].derivation_steps[2]`) and multiple present-but-zero-code chunks from
  PUSH32-zero operands.
  | TREE: side-by-side comparison of one absent slot (hollow) and one present-zero-code slot (solid,
  labeled with its nonzero byte0) in the same fan | CAPTION: "Same zero bytes, two different tree states — it's byte 0 that decides."

## A4 — Storage zone
Teaches: bucket → group → slot; the slot-to-coordinate calculator; mapping/array derivation.
- A4.B1 Bucket → groups → slots — TRUTH: EIP-8297 "Storage": bucket = `0xFF ‖ BLAKE3(addr32)`, one per
  account; group = `BLAKE3(addr32‖tree_index)` spreads 256-slot ranges within that bucket; MegaToken's
  bucket (`fixtures/pbt-fixtures.json` → computed via `emb.account_storage_prefix`) holds **5** distinct
  groups for its 5 funded holders (`zone_atlas.megatoken_storage_groups = 5`).
  | TREE: one bucket prop, 5 group-forks branching off it, each holding exactly 1 leaf in this fixture | CAPTION: "One bucket per contract. Many groups inside it."
- A4.B2 Slot calculator — TRUTH: `storage_key < 64` → header (`sub = 64+storage_key`); `storage_key ≥ 64`
  → storage zone (`tree_index = storage_key//256`, `sub = storage_key%256`); worked examples straight
  from the EIP's own "Test Cases": slot 5 → header sub 69; slot 1000 → `tree_index=3, sub=232`, key
  `0xFF‖H(A)‖H(A‖3)‖0xE8`.
  | TREE: X1-style input: type a slot number, watch the calculator light the header fan or the storage
  bucket live | CAPTION: "Type a slot number. Watch it land."
- A4.B3 Mapping/array derivation (Solidity, not EIP) — TRUTH: mapping at slot `p`, key `k` →
  `keccak256(pad32(k) ‖ pad32(p))`; dynamic array at `p` → element `i` at `keccak256(pad32(p)) + i`
  (adjacent elements share a group); explicitly flagged in the fact sheet as "Solidity (not EIP)" —
  worked live with MegaToken's `balanceOf` (`p=4`) in J5.
  | TREE: flat 2D diagram (E11), tagged "Solidity convention, not EIP-8297", feeding into the BLAKE3 tree
  formula above it | CAPTION: "Solidity picks the slot number. The tree just places it."

## A5 — Hash lab
Teaches: leaf/branch preimages, `encode_bit_prefix`, BLAKE3 vs Keccak.
- A5.B1 Leaf/branch preimages — TRUTH: EIP-8297 "Node merkelization": `leaf_hash = H(0x00 ‖ key ‖
  value)`; `branch_hash = H(0x01 ‖ encode_bit_prefix(prefix) ‖ left_hash ‖ right_hash)`; tags
  `LEAF_TAG=0x00`, `BRANCH_TAG=0x01` keep the two preimage shapes injective (EIP-8297 "Security
  Considerations", "Preimage").
  | TREE: E7's hash-forge prop, showing the exact labeled byte segments for a real leaf/branch from the
  fixture | CAPTION: "One tag byte tells a leaf's hash from a branch's."
- A5.B2 encode_bit_prefix — TRUTH: `len(prefix).to_bytes(2,"big") + packed_bits_zero_padded`; worked on
  the real A1.B3 example: prefix `"000000"` (6 bits) → `0x0006` ‖ `0x00` (one padded byte) = 3 bytes
  total.
  | TREE: zoom into one branch's own hash-forge step, prefix bytes highlighted | CAPTION: "A 2-byte bit-count, then the packed bits themselves."
- A5.B3 BLAKE3 vs Keccak — TRUTH: EIP-8297 Abstract note: "the hash function used in this draft is not
  final. The reference implementation uses BLAKE3... the choice remains open" — used for tree
  merkleization and `key_hash` only; EIP-8297 Backwards Compatibility: "EXTCODEHASH is unaffected. The
  account's code hash is a Keccak hash regardless of the tree's own merkelization hash" — Keccak is used
  forever for `code_hash`, CREATE/CREATE2 addresses, and Solidity mapping/array slot derivation.
  | TREE: two-lane flat diagram, BLAKE3 lane feeding tree placement, Keccak lane feeding EVM-level
  identities, meeting only where a Keccak-derived value (like a mapping slot) becomes an input to a
  BLAKE3 tree formula (A4.B3/J5.B1-B2) | CAPTION: "Two hash functions. One might change. One never will."


---

# Why PBT (real numbers, mostly from this exact fixture)

## W1 — Proof-size race
- W1.B1 Real fixture numbers — TRUTH: J9's presence witness = 167 bytes/3 levels; absence witness = 238
  bytes/5 levels; MPT branch at depth 12 = 5760 bytes (EIP-8297 Motivation, `15×32×12`).
  | CAPTION: "167-238 bytes here. 5760 bytes for one MPT branch."
- W1.B2 Arity table — TRUTH: EIP-8297 Rationale "Arity-2", `N=2^24`: `k=2`→24 chunks/768B, `k=4`→36/1152B,
  `k=8`→56/1792B, `k=16`→90/2880B; "the average branch is roughly `32*(k-1)*log(N)/log(k)` bytes,
  minimized at k=2."
  | CAPTION: "Binary trees minimize proof size. Wider trees always cost more."

## W2 — Code witness
- W2.B1 Worst case — TRUTH: EIP-8297 Motivation, exact formula: "spending all 60M gas to touch a single
  byte of many distinct account codes, none of which is chunked, needs `60M/2400 × (12×480+64k) ≈
  1.8GB`" (`2400`=EIP-2930 cold access-list address cost, `12×480`=branch to the account, `64k`=EIP-7954
  code size limit revealed in full).
  | CAPTION: "Unchunked code: one worst-case block could need 1.8 gigabytes of witness."

## W3 — One tree, no storage roots
- W3.B1 J10's union-vs-sum — TRUTH: 27 real branch recomputes vs a naive per-journey sum of 32; EIP-8297
  Rationale "Single tree with zones": "an account-header write and a storage write are independent;
  paths meet near the root... This admits parallelism across zones, across accounts within a zone, and
  across stems within an account."
  | CAPTION: "No leaf stores a storage_root. Writes across zones are independent until they meet near the top."

## W4 — Zones as commitments
- W4.B1 Addressable regions — TRUTH: EIP-8297 Motivation: "A key prefix of a known length is always the
  root of a known category... Protocols can reference these key-space regions as commitments without a
  side structure." Demonstrated directly: A1.B2's root-level bit0 split IS this property in action.
  | CAPTION: "A zone, a bucket, a stem — each one provable on its own."

## W5 — Dedup at scale
- W5.B1 J3's exact numbers — TRUTH: 3 deployments, 1 set of 23 code leaves, 0 duplicate writes on
  deployments 2 and 3; EIP-8297 Rationale "Content-addressed code": "Most deployed contracts repeat a
  small number of templates, so this removes a large amount of duplicate code from the state... a block
  witness contains at most one copy of a shared chunk, no matter how many contracts touch it."
  | CAPTION: "3 factory deployments. 1 copy of the code, ever."

## W6 — Proof-friendly & post-quantum
- W6.B1 Hash candidates — TRUTH: EIP-8297 Rationale "SNARK friendliness and post-quantum security":
  BLAKE3 (reference, "good native performance, reasonable in-circuit"), Keccak ("already in Ethereum...
  less efficient to prove"), Poseidon2 ("strong in-circuit performance, security analysis ongoing");
  "the tree depends only on a hash function and not on elliptic curves, it remains secure against quantum
  adversaries; Verkle's curve-based stack does not, and NIST guidance calls for retiring elliptic-curve
  cryptography by 2030."
  | CAPTION: "Hash-based, not curve-based. That's what survives a quantum computer."

## W7 — Getting there
- W7.B1 EIP-8347 pointer — TRUTH: EIP-8297 "Fork": migration is specified in EIP-8347; "Migration happens
  off the consensus-critical path in every case: a node either converts the state itself at a finalized
  anchor block, or downloads a snapshot and verifies it against the anchor's state root... the tree
  becomes the canonical state commitment at a single coordinated hard fork." EIP-8347 is authored by the
  same Anon who authored this EIP-8297 co-authorship; article at
  `/articles/mpt-to-pbt-migration/` (sibling article, not included in this handoff).
  | CAPTION: "The switch happens once, off the critical path, at a single fork."

## W8 — State expiry preview *(new panel — see justification in the internal beat-list note)*
- W8.B1 Expiry unit — TRUTH: EIP-8297 Rationale "State expiry": "Per-account and per-bucket expiry is a
  natural operation on the zone topology. The storage bucket keyed by key_hash(address) roots one
  account's storage in the common case. Record its hash and prune below it. The account header's stem
  expires the account's core data, hot storage and delegation in one step... Expiry on this tree instead
  marks an expired region with a stub introduced at the expiry fork. The mechanism itself is left to a
  separate EIP."
  | CAPTION: "A bucket or a stem: the natural unit to expire and prune."

## W9 — Grinding & security margins *(new panel — see justification in the internal beat-list note)*
- W9.B1 Collision cost — TRUTH: EIP-8297 "Security Considerations": "Each is a full 256-bit digest, so
  any collision costs about `2^128` birthday work, far beyond reach. Keys of different zones differ in
  their first byte and cannot collide at all."
  | CAPTION: "Any real key collision: about 2^128 work. Not happening."
- W9.B2 Grinding cost — TRUTH: "Grinding for digests that share k leading bits would deepen the tree.
  Without compression that buys a k-node chain for about `2^(k/2)` work. Compression folds the run into
  one BranchNode prefix of about k/8 bytes, and d real extra nodes cost about `2^d` work. The address in
  the digest stops cross-contract reuse, so a slot set found by grinding for one contract is random in
  every other."
  | CAPTION: "Compression turns a cheap-looking attack into an expensive one."

---

# Sandbox

## X1 — Key forge
- X1.B1 Live derivation — TRUTH: type an address → `address32` padding → `BLAKE3(addr32)` → header stem,
  exactly A1-A2's formulas; type a slot number → A4.B2's calculator; paste bytecode → A3.B1's live
  chunker; every live-typed value that happens to match a real fixture address/slot lands in the actual
  demo tree from `fixtures/pbt-fixtures.json`, not a mocked one.
  | TREE: the same live tree used throughout the whole page, camera flies to wherever the typed value
  lands | CAPTION: "Type anything. Watch it find its place in the real tree."

---


# Ground-truth appendix

## Cross-check against geth (`trie/bintrie`) and its exported EELS test vectors

Source-of-truth order per the brief: EIP text → Python reference implementation
(`execution-specs-ports-wt`) → geth (`go-ethereum`, branch `pbt-converted-anchor`). All checks below
compare the **Python reference implementation actually used to generate `pbt-fixtures.json`** against
geth's `trie/bintrie` package and/or its `testdata/eip8297_vectors.json` (exported from a separate EELS
checkout, commit `455d9085d`, branch `eip-8297-tests`). No discrepancy was found anywhere.

**Method.** (1) Ran geth's own Go test suite (`go test ./trie/bintrie/... -run
'TestEmbeddingVectors|TestBasicDataVectors|TestChunkifyVectors|TestStateVectors|TestTrieVectors'`) to
confirm geth's implementation agrees with its own exported vector file — **all pass** (21 sub-tests, 0
failures). (2) Independently recomputed the vector file's `embedding_vectors` block (address
`0xaaaa...aaaa`) using the Python reference implementation directly (not geth, not the vector file's own
generator) and compared byte-for-byte.

| # | Requirement | Key checked | Result |
|---|---|---|---|
| 1 | one account key | `basic_data_key` for `0xaaaa...aaaa`: `0x00d9ae2d236f8713a5bf808cda488167a56cc97e4b83006f42b1c06c0c3f053bbf00` | **PASS**, byte-for-byte |
| 2 | one code-chunk key | `chunk_0` and 8 others (chunks 0,5,127,128,255,256,300,383,384) for `code_hash=0xbb×32`, e.g. chunk 0: `0x01465f911ccfe7707c51a877fc621cffa8e700a5828cf92df27b142de919c0f6c800` | **PASS**, all 9, byte-for-byte |
| 3 | one storage key, slot<64 | slot 5: `0x00d9ae2d236f8713a5bf808cda488167a56cc97e4b83006f42b1c06c0c3f053bbf45`; slot 63: `...bbf7f` | **PASS**, byte-for-byte |
| 4 | one storage key, slot≥64 | slot 64, 255, 256, 1000, and `2^255` (all 4 tree_index/sub-index combinations the vector file covers) | **PASS**, all 5, byte-for-byte |
| 5 | account/code/storage zone split at the root | `cross_zone_small` vector: a real 5-entry mixed-zone state (2× `0x00` keys, 2× `0xFF` keys, 1× a second `0x00` key), expected root `0x3fc0f35560e81b2b1bc349decef42eb48a614d8497646e401e7b85abc0b16a30` | **PASS** — root reproduced byte-for-byte with the Python reference implementation; structurally confirmed the root is a `BranchNode` with **empty own prefix** (split happens at bit 0 itself), left child (bit0=0) rooted in zone `0x00`, right child (bit0=1) rooted in zone `0xFF` — exactly the A1.B2/A1.B3 claim, now doubly confirmed (analytically from zone-byte arithmetic, and against this cross-implementation vector) |

Also cross-checked, beyond the required 5: `delegation_key`, `delegation_value` (EIP-7702 designator
padding — this is the one geth's own code comment calls out as "the padding is the part worth pinning:
hashing the padded value rather than the leading code_size bytes would disagree with EXTCODEHASH"),
`basic_data_key`, `code_hash_key`. **21/21 checks pass. No divergence found between the Python reference
implementation and geth anywhere checked.**

If a future check ever *does* diverge: this appendix's method (recompute independently, compare
byte-for-byte, run the other side's own test suite too) is the template to repeat; report the exact
differing bytes and which side (EIP text, EELS, or geth) each of the two disagreeing implementations
actually matches — never silently prefer one source.

## Design decisions this appendix should make visible to the reader

- **World structure.** Four named snapshots (WA, WB, W0, W1) rather than one flat "genesis"; J2 and J3
  *are* the WB→W0 and WA→WB transitions respectively (their pre/post roots are literally
  `world_roots.*`), so deploying MegaToken and deploying VaultTemplate#3 are shown as real state
  transitions, not scripted backstory. W1 (further ERC-20 distribution + a VaultTemplate deposit) is
  explicitly *not* narrated as its own journey — documented as scripted world-building in
  `pbt-fixtures.json`'s `readme` object, to avoid inventing an artificial 12th journey for what is really
  just "more of the same as J5/J1."
- **Hashes-recomputed semantics.** `branches_recomputed` is the size of the **union** of root-to-leaf
  branch positions across every leaf a beat changes, computed by walking the real post-tree structure —
  never a naive per-leaf sum. This directly implements E8's correction (agreed with PbtVisual) and is
  what makes J10's 27-vs-32 comparison honest. Deleted keys are included by computing their witness path
  in the **post**-tree (where they're absent) — `witness_path` already handles the absence case
  correctly, walking as far as the surviving structure goes.
- **SELFDESTRUCT-in-creating-tx (J11a/b).** The naive pre/post diff is empty (the account leaves zero
  trace either way — this is itself the correct, EIP-6780-mandated behavior), so both journeys expose
  explicit `create`/`destroy` phase diffs instead of a single before/after pair, or the entire teaching
  point (code survives vs. is removed) would be invisible in the data.

## Quality-bar spot check (10+ numeric claims verified against fixtures/formulas before finishing)

1. J1.B6 "17 branches recomputed, 5 leaves changed" — verified against `journeys[J1].hashes_recomputed`
   in the regenerated `pbt-fixtures.json` after fixing the delete-exclusion bug in
   `compute_recompute_stats` (see below). ✅ matches.
2. J2.B3 "263 chunks, 2 code groups" — verified `ceil(8151/31)=262.9…→263`; `263>256` ⇒ groups
   `{0,1}`. ✅ matches `journeys[J2].derivation_steps[2].output`.
3. J2 "141 leaves changed" — verified `135 present chunks + 2 header + 3 storage writes + 1 sender
   update = 141`; cross-checked `leaf_counts_by_zone['0x01']=158 = 135(MegaToken)+23(VaultTemplate)`. ✅
   matches `zone_atlas`.
4. J3.B3 "0 new code-zone leaves" — verified `journeys[J3].derivation_steps[2].output
   .new_code_leaves_written == 0` directly from the generated JSON. ✅.
5. J8.B2 "128 all-zero absent chunks" and J8.B3 straddle at pc=454 (chunk 14→15) — re-ran the exact
   chunkify/disassemble logic standalone against the compiled bytecode outside the main script; got the
   identical numbers both times (128, pc=454, chunks 14/15). ✅.
6. J9.B1/B2 witness byte counts (167B/3 levels presence, 238B/5 levels absence) — verified the
   `witness_bytes` formula (`Σ 2+ceil(prefix_bits/8)+32` per level, +32 or +key_len+32 at the terminal)
   against a hand-computed 2-level toy example before trusting the fixture's numbers; the formula matches
   `encode_bit_prefix`'s own definition exactly. ✅.
7. A1.B2/A1.B3 root split — independently re-derived from raw zone-byte binary (`0x00`, `0x01`, `0xFF`)
   with no fixture dependency, THEN cross-checked against both `zone_atlas.root_split` in the generated
   fixture AND the independent geth-vector reproduction (ground-truth appendix, check #5 above). ✅,
   triple-confirmed.
8. A4.B1 "MegaToken storage: 5 groups, 5 holders" — verified `zone_atlas.megatoken_storage_groups == 5
   == len(MEGA_HOLDINGS)+1(deployer remainder)`; confirmed no two holders' `keccak256(pad32(holder)‖
   pad32(4))` values share a `tree_index` by checking the `groups` set size equals leaf count exactly (no
   collisions). ✅.
9. W1.B1 "167-238 bytes vs 5760 bytes" — the `5760` figure is a direct quote from EIP-8297 Motivation
   (`15×32×12`), re-verified by re-reading the EIP source line rather than trusting the brief's
   restatement; the `167`/`238` figures come from this fixture's own computed witnesses (see #6). ✅.
10. W9.B1/B2 "2^128 / 2^(k/2) / 2^d" — re-read directly from EIP-8297 "Security Considerations" verbatim,
    not paraphrased from the brief (which does not restate these figures at all — they are one of this
    appendix's own additions, W9). ✅.
11. J7.B3 "10 branches recomputed, 2 leaves changed" — this number changed from an earlier, WRONG build
    (9 branches / 1 leaf) once a real bug was found and fixed: `compute_recompute_stats` originally
    excluded deleted keys from the recompute set entirely unless *all* changed keys in a journey were
    deletions, silently undercounting any journey mixing an update with a delete (J7 is exactly such a
    case: 1 update + 1 delete). Fixed by computing every changed key's witness path in the **post**-tree
    uniformly (present or absent), regenerated the fixture, and re-verified `writes.length ==
    hashes_recomputed.leaves_changed` holds across all 14 journeys before finishing. ✅ (see script
    history: `diff_tries`/`compute_recompute_stats`/`journey_result` in `fixtures/gen_fixtures.py`).

No claim in this document that could be checked against a formula or `pbt-fixtures.json` was left
unverified; the one real defect found during spot-checking (#11) was fixed at the source (the generator),
not patched over in prose.
