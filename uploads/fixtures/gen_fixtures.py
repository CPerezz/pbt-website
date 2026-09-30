#!/usr/bin/env python3
"""
Generate pbt-fixtures.json for the PBT 3D explainer.

Builds a demo EIP-8297 state tree entirely through the REAL reference
implementation (execution-specs-ports-wt, branch tests/binary-tree-geth-ports,
src/ethereum/binary_trie/{trie.py,embedding.py}) -- every key, every hash and
every chunk in this file's output was computed by that code, never
hand-typed. Run with that checkout's own environment:

    cd /path/to/execution-specs-ports-wt
    uv run python /path/to/pbt-website/uploads/fixtures/gen_fixtures.py

Real, compiled Solidity bytecode lives in fixtures/sol/{VaultTemplate,MegaToken,
Ephemeral}.sol, compiled with solc into fixtures/sol/combined.json (see
compile.sh). Real EOA addresses are the standard Anvil/Hardhat dev accounts
(mnemonic "test test test test test test test test test test test junk").
Real CREATE/CREATE2 addresses were computed with `cast compute-address` /
`cast create2` and are pasted as constants below with their derivation shown
in scenario-bible.md.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.environ.get("EXECUTION_SPECS_PORTS_SRC", "/path/to/execution-specs-ports-wt/src"))

from ethereum.binary_trie.trie import (  # noqa: E402
    BinaryTrie,
    BranchNode,
    LeafNode,
    MAX_KEY_LENGTH,
    binarize,
    copy_trie,
    encode_bit_prefix,
    merkleize,
    root as trie_root,
    trie_set,
)
from ethereum.binary_trie import embedding as emb  # noqa: E402
from ethereum.crypto.hash import keccak256  # noqa: E402
from ethereum_types.bytes import Bytes, Bytes20, Bytes32  # noqa: E402
from ethereum_types.numeric import U8, U32, U64, U256, Uint  # noqa: E402

ETHER = 10**18


# --------------------------------------------------------------------------
# World constants -- every address/bytecode below is real (compiled or a
# well-known deterministic dev key), never fabricated. See scenario-bible.md
# "Ground truth appendix" for the derivation of every CREATE/CREATE2 address.
# --------------------------------------------------------------------------

ACCOUNTS = {
    # label: (address_hex, role)
    "Acct0": ("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", "deployer/sender (anvil dev #0)"),
    "Acct1": ("0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "J1 fresh ETH recipient (anvil dev #1)"),
    "Acct2": ("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", "funded EOA / VaultTemplate#2 owner (anvil dev #2)"),
    "Acct3": ("0x90F79bf6EB2c4f870365E785982E1f101E93b906", "delegating EOA, J4 (anvil dev #3)"),
    "Acct4": ("0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", "MegaToken holder 1 (anvil dev #4)"),
    "Acct5": ("0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc", "MegaToken holder 2 (anvil dev #5)"),
    "Acct6": ("0x976EA74026E726554dB657fA54763abd0C3a0aa9", "MegaToken holder 3 (anvil dev #6)"),
    "Acct7": ("0x14dC79964da2C08b23698B3D3cc7Ca32193d9955", "MegaToken holder 4 (anvil dev #7)"),
    "Acct8": ("0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f", "J5 fresh ERC-20 recipient (anvil dev #8)"),
    "Acct9": ("0xa0Ee7A142d267C1f36714E4a8F75612F20a79720", "coinbase / J11 deployer (anvil dev #9)"),
}

CONTRACTS = {
    # label: (address_hex, source_contract, deployer_label, nonce)
    "VaultTemplate1": ("0x5FbDB2315678afecb367f032d93F642f64180aa3", "VaultTemplate", "Acct0", 0),
    "VaultTemplate2": ("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", "VaultTemplate", "Acct0", 1),
    "VaultTemplate3": ("0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0", "VaultTemplate", "Acct0", 2),
    "MegaToken": ("0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9", "MegaToken", "Acct0", 3),
    # J11 ephemeral deploy-then-destroy-in-same-tx examples (never in any
    # persisted world snapshot; constructed only inside the J11 journey).
    "Ephemeral": ("0x700b6A60ce7EaaEA56F065753d8dcB9653dbAD35", "Ephemeral", "Acct9", 0),
    "VaultTemplate4": ("0xA15BB66138824a1c7167f5E85b957d04Dd34E468", "VaultTemplate", "Acct9", 1),
}

CREATE2_EXAMPLE = {
    "deployer": ACCOUNTS["Acct0"][0],
    "salt": "0x0000000000000000000000000000000000000000000000000000000000000001",
    "source_contract": "VaultTemplate",
    "constructor_arg": ACCOUNTS["Acct0"][0],
    "initcode_keccak": "0x69c37de55c5510475c6558e775a2fb0d4e2bf9d53a255dd495050b1fad33f94c",
    "address": "0x6A2341510D05F1ECf853dcF94d024D35050D3D99",
}


def load_combined_json():
    with open(os.path.join(HERE, "sol", "combined.json")) as f:
        return json.load(f)


def a20(addr_hex: str) -> Bytes20:
    return Bytes20(bytes.fromhex(addr_hex[2:]))


def a32(addr_hex: str) -> Bytes32:
    return emb.address20_to_address32(a20(addr_hex))


def hx(b) -> str:
    return "0x" + bytes(b).hex()


# --------------------------------------------------------------------------
# Tree-walk helpers. These call the REAL binarize()/merkleize() from
# trie.py on every (sub)node; no hash or key in the output is hand-computed.
# --------------------------------------------------------------------------

def node_zone(path_bits):
    """Zone byte implied by >=8 accumulated path bits, else None (mixed)."""
    if len(path_bits) < 8:
        return None
    z = 0
    for b in path_bits[:8]:
        z = (z << 1) | b
    return z


def flatten_tree(trie_obj: BinaryTrie):
    """Flatten a whole trie into (nodes, root_id, root_hash_hex).

    Node ids are the first 14 hex chars of that node's own real merkleize()
    hash -- stable, collision-safe at this fixture's scale, and directly
    traceable back to the hashing formula that produced them.
    """
    if len(trie_obj._data) == 0:
        return [], None, "0x" + "00" * 32
    top = binarize(trie_obj._data, Uint(0))
    nodes = []

    def walk(n, path_bits, parent_id):
        h = merkleize(n)
        h_hex = hx(h)
        node_id = h_hex[2:16]
        depth = len(path_bits)
        if isinstance(n, LeafNode):
            zone = n.key[0]
            nodes.append({
                "id": node_id,
                "type": "leaf",
                "parent": parent_id,
                "children": None,
                "bit_depth": depth,
                "zone": zone,
                "hash": h_hex,
                "key": hx(n.key),
                "value": hx(n.value),
            })
            return node_id
        prefix_bits = list(n.prefix)
        own_path = list(path_bits) + prefix_bits
        zone = node_zone(own_path)
        left_id = walk(n.left, own_path + [0], node_id)
        right_id = walk(n.right, own_path + [1], node_id)
        nodes.append({
            "id": node_id,
            "type": "branch",
            "parent": parent_id,
            "children": [left_id, right_id],
            "bit_depth": depth,
            "prefix_bit_count": len(prefix_bits),
            "prefix_bits": "".join(str(b) for b in prefix_bits),
            "zone": zone,
            "hash": h_hex,
        })
        return node_id

    root_id = walk(top, [], None)
    return nodes, root_id, hx(merkleize(top))


def key_bits(key: bytes):
    return [(byte >> (7 - i)) & 1 for byte in key for i in range(8)]


def witness_path(trie_obj: BinaryTrie, key: bytes):
    """Root-to-key witness: for every branch on the path, its own prefix
    (needed to rebuild that branch's preimage) and its sibling's hash.
    Works whether `key` is present (presence witness, path ends in a
    LeafNode with key==target) or absent (the path ends either at a
    LeafNode with a *different* key -- the divergence point -- or the
    walk cannot consume all of `key`'s bits, meaning it diverges from an
    internal branch's prefix).
    Returns dict: present(bool), levels: [{prefix_bit_count, sibling_hash,
    sibling_is_leaf, direction}], terminal: leaf key/value if reached, or
    divergent-neighbor key/value if absent, witness_bytes (int).
    """
    if len(trie_obj._data) == 0:
        return {"present": False, "levels": [], "terminal": None, "witness_bytes": 0}
    top = binarize(trie_obj._data, Uint(0))
    kb = key_bits(key)
    levels = []
    witness_bytes = 0
    node = top
    pos = 0
    while True:
        if isinstance(node, LeafNode):
            present = bytes(node.key) == key
            return {
                "present": present,
                "levels": levels,
                "terminal": {"key": hx(node.key), "value": hx(node.value)},
                "witness_bytes": witness_bytes + (len(node.key) + 32 if not present else 32),
            }
        prefix = list(node.prefix)
        # Does `key` still agree with this branch's own prefix?
        if pos + len(prefix) > len(kb) or kb[pos:pos + len(prefix)] != prefix:
            # Diverges inside this branch's own prefix run: key is absent,
            # and the whole subtree below is the "neighbor" for the proof.
            neighbor = node
            while isinstance(neighbor, BranchNode):
                neighbor = neighbor.left
            return {
                "present": False,
                "levels": levels,
                "terminal": {"key": hx(neighbor.key), "value": hx(neighbor.value)},
                "witness_bytes": witness_bytes + len(neighbor.key) + 32,
            }
        pos += len(prefix)
        bit = kb[pos]
        pos += 1
        left_h, right_h = merkleize(node.left), merkleize(node.right)
        chosen, sibling, sibling_h = (
            (node.left, node.right, right_h) if bit == 0 else (node.right, node.left, left_h)
        )
        levels.append({
            "prefix_bit_count": len(prefix),
            "direction": bit,
            "sibling_hash": hx(sibling_h),
            "sibling_is_leaf": isinstance(sibling, LeafNode),
        })
        witness_bytes += 2 + (len(prefix) + 7) // 8 + 32  # encode_bit_prefix(this node) + sibling hash
        node = chosen


# --------------------------------------------------------------------------
# Diffing: every journey is "copy a snapshot trie, call the real embed_*
# functions, diff trie._data before/after." The diff and the recompute
# count are derived, never manually asserted.
# --------------------------------------------------------------------------

def diff_tries(before: BinaryTrie, after: BinaryTrie):
    b, a = before._data, after._data
    changed = []
    for k in sorted(set(b) | set(a)):
        bv, av = b.get(k), a.get(k)
        if bv == av:
            continue
        action = "insert" if bv is None else ("delete" if av is None else "update")
        changed.append({
            "key": hx(k),
            "before": hx(bv) if bv is not None else None,
            "after": hx(av) if av is not None else None,
            "action": action,
        })
    return changed


def compute_recompute_stats(after: BinaryTrie, changed_keys):
    """Distinct branch-node *positions* (by root-to-leaf decision prefix)
    that are ancestors of >=1 changed leaf in the post-tree -- every one of
    them necessarily gets a new hash. See scenario-bible.md ground-truth
    appendix for the derivation (E8 in pbt-visual-encodings.md)."""
    if len(after._data) == 0:
        return {"branches_recomputed": 0, "leaves_changed": len(changed_keys)}
    positions = set()
    for k_hex in changed_keys:
        key = bytes.fromhex(k_hex[2:])
        w = witness_path(after, key)
        path = tuple((lv["prefix_bit_count"], lv["direction"]) for lv in w["levels"])
        for i in range(len(path) + 1):
            positions.add(path[:i])
    return {"branches_recomputed": len(positions), "leaves_changed": len(changed_keys)}


def journey_result(journey_id, title, teaches, pre_id, pre_trie, post_trie,
                    derivation_steps, notes=None):
    changed = diff_tries(pre_trie, post_trie)
    changed_keys = [c["key"] for c in changed]
    recompute = compute_recompute_stats(post_trie, changed_keys) if changed_keys else {"branches_recomputed": 0, "leaves_changed": 0}
    return {
        "id": journey_id,
        "title": title,
        "teaches": teaches,
        "pre_state": pre_id,
        "pre_root": hx(trie_root(pre_trie)),
        "post_root": hx(trie_root(post_trie)),
        "derivation_steps": derivation_steps,
        "writes": changed,
        "hashes_recomputed": recompute,
        "notes": notes or [],
    }


# --------------------------------------------------------------------------
# World construction. WA -> WB (J3, dedup) -> W0 (J2, from-scratch deploy)
# -> W1 (full curated demo world; the shared pre-state for most journeys).
# --------------------------------------------------------------------------

def eoa(trie_obj, label, nonce, balance_wei):
    addr = a32(ACCOUNTS[label][0])
    emb.embed_account(trie_obj, addr, U64(nonce), U256(balance_wei), emb.EMPTY_CODE_HASH, Bytes(b""))


def deploy(trie_obj, label, runtime_code: bytes, nonce=1, balance_wei=0):
    addr = a32(CONTRACTS[label][0])
    ch = keccak256(runtime_code)
    emb.embed_account(trie_obj, addr, U64(nonce), U256(balance_wei), ch, Bytes(runtime_code))
    return ch


def mapping_slot(key_addr32: bytes, base_slot: int) -> int:
    """Solidity storage convention (not EIP-8297): mapping at slot p, key k
    -> keccak256(pad32(k) || pad32(p)). Real Keccak256, same function
    embedding.py uses for code_hash."""
    packed = key_addr32.rjust(32, b"\x00") + base_slot.to_bytes(32, "big")
    return int.from_bytes(keccak256(Bytes(packed)), "big")


# --------------------------------------------------------------------------
# World snapshots
# --------------------------------------------------------------------------

def build_WA():
    """3 funded EOAs deployed VaultTemplate #1 and #2 only; every other EOA
    that will ever appear is already funded with its starting ETH balance
    (so later journeys' `before` values are non-trivial where that matters).
    Acct1, Acct8, Acct9 stay ABSENT here (and through W1) -- they are the
    fixture's insertion examples."""
    t = BinaryTrie()
    eoa(t, "Acct0", nonce=2, balance_wei=5 * ETHER)  # 2 deployments done so far
    eoa(t, "Acct2", nonce=0, balance_wei=2 * ETHER)
    eoa(t, "Acct3", nonce=0, balance_wei=1 * ETHER)
    eoa(t, "Acct4", nonce=0, balance_wei=ETHER // 2)
    eoa(t, "Acct5", nonce=0, balance_wei=ETHER // 2)
    eoa(t, "Acct6", nonce=0, balance_wei=ETHER // 2)
    eoa(t, "Acct7", nonce=0, balance_wei=ETHER // 2)
    combined = load_combined_json()
    vault_rt = bytes.fromhex(combined["contracts"]["VaultTemplate.sol:VaultTemplate"]["bin-runtime"])
    deploy(t, "VaultTemplate1", vault_rt, nonce=1, balance_wei=0)
    emb.embed_storage_slot(t, a32(CONTRACTS["VaultTemplate1"][0]), U256(0), Bytes32(a32(ACCOUNTS["Acct0"][0])))
    deploy(t, "VaultTemplate2", vault_rt, nonce=1, balance_wei=0)
    emb.embed_storage_slot(t, a32(CONTRACTS["VaultTemplate2"][0]), U256(0), Bytes32(a32(ACCOUNTS["Acct2"][0])))
    return t


def build_WB(WA):
    """WA + VaultTemplate #3, the SAME bytecode deployed a 3rd time. This
    transition *is* J3 (dedup)."""
    t = copy_trie(WA)
    combined = load_combined_json()
    vault_rt = bytes.fromhex(combined["contracts"]["VaultTemplate.sol:VaultTemplate"]["bin-runtime"])
    t2 = copy_trie(t)
    t2._data = dict(t._data)
    deploy(t2, "VaultTemplate3", vault_rt, nonce=1, balance_wei=0)
    emb.embed_storage_slot(t2, a32(CONTRACTS["VaultTemplate3"][0]), U256(0), Bytes32(a32(ACCOUNTS["Acct3"][0])))
    eoa(t2, "Acct0", nonce=3, balance_wei=5 * ETHER)
    return t2


def build_W0(WB):
    """WB + MegaToken deployed from scratch, constructor mints the full
    initial supply to the deployer. This transition *is* J2."""
    t = copy_trie(WB)
    combined = load_combined_json()
    mega_rt = bytes.fromhex(combined["contracts"]["MegaToken.sol:MegaToken"]["bin-runtime"])
    initial_supply = 1_000_000 * ETHER
    deploy(t, "MegaToken", mega_rt, nonce=1, balance_wei=0)
    mega32 = a32(CONTRACTS["MegaToken"][0])
    emb.embed_storage_slot(t, mega32, U256(2), Bytes32(initial_supply.to_bytes(32, "big")))  # totalSupply
    owner_slot = bytes(11) + bytes([0]) + bytes(a20(ACCOUNTS["Acct0"][0]))  # owner (paused=false)
    emb.embed_storage_slot(t, mega32, U256(3), Bytes32(owner_slot))
    bal_slot = mapping_slot(bytes(a20(ACCOUNTS["Acct0"][0])), 4)
    emb.embed_storage_slot(t, mega32, U256(bal_slot), Bytes32(initial_supply.to_bytes(32, "big")))
    eoa(t, "Acct0", nonce=4, balance_wei=5 * ETHER)
    return t


MEGA_HOLDINGS = {"Acct4": 250_000, "Acct5": 150_000, "Acct6": 100_000, "Acct7": 75_000}


def build_W1(W0):
    """W0 + ERC-20 distributed to 4 holders (deployer keeps the remainder)
    + VaultTemplate#1 receives a deposit. This is scripted genesis-style
    world-building, not narrated as its own journey (documented in the
    fixture readme); it is the shared pre-state most journeys branch from."""
    t = copy_trie(W0)
    mega32 = a32(CONTRACTS["MegaToken"][0])
    distributed = 0
    for label, whole_tokens in MEGA_HOLDINGS.items():
        amount = whole_tokens * ETHER
        distributed += amount
        slot = mapping_slot(bytes(a20(ACCOUNTS[label][0])), 4)
        emb.embed_storage_slot(t, mega32, U256(slot), Bytes32(amount.to_bytes(32, "big")))
    deployer_remainder = 1_000_000 * ETHER - distributed
    deployer_slot = mapping_slot(bytes(a20(ACCOUNTS["Acct0"][0])), 4)
    emb.embed_storage_slot(t, mega32, U256(deployer_slot), Bytes32(deployer_remainder.to_bytes(32, "big")))
    # VaultTemplate#1 receives a 1 ETH deposit: header ETH balance AND its
    # own `balance` storage var (slot 1, header sub-index 65) both become 1e18.
    vault1 = a32(CONTRACTS["VaultTemplate1"][0])
    combined = load_combined_json()
    vault_rt = bytes.fromhex(combined["contracts"]["VaultTemplate.sol:VaultTemplate"]["bin-runtime"])
    deploy(t, "VaultTemplate1", vault_rt, nonce=1, balance_wei=1 * ETHER)
    emb.embed_storage_slot(t, vault1, U256(1), Bytes32((1 * ETHER).to_bytes(32, "big")))
    return t


# --------------------------------------------------------------------------
# Minimal EVM disassembler (PUSH-operand-length aware) -- used only by J6
# to find real PC ranges for "which chunks does a call touch."
# --------------------------------------------------------------------------

def disassemble(code: bytes):
    out, pc, n = [], 0, len(code)
    while pc < n:
        op = code[pc]
        if 0x60 <= op <= 0x7F:
            length = op - 0x5F
            out.append((pc, op, code[pc + 1:pc + 1 + length]))
            pc += 1 + length
        else:
            out.append((pc, op, None))
            pc += 1
    return out


def find_selector_jumpdest(code: bytes, selector_hex: str):
    """Find the JUMPDEST PC a dispatcher jumps to for `selector_hex`
    (4 bytes) by locating PUSH4<selector> and reading the nearest
    following PUSH2 operand before a JUMPI."""
    sel = bytes.fromhex(selector_hex)
    instrs = disassemble(code)
    for i, (pc, op, operand) in enumerate(instrs):
        if op == 0x63 and operand == sel:  # PUSH4 <selector>
            for j in range(i + 1, min(i + 6, len(instrs))):
                pc2, op2, operand2 = instrs[j]
                if op2 == 0x61 and operand2 is not None:  # PUSH2 <dest>
                    dest = int.from_bytes(operand2, "big")
                    if instrs[j + 1][1] == 0x57:  # JUMPI
                        return dest
    return None


# --------------------------------------------------------------------------
# Journeys
# --------------------------------------------------------------------------

def journey_J1(W1):
    """Send ETH to a brand-new address; fee recipient also freshly created."""
    pre = W1
    post = copy_trie(pre)
    value = 3 * ETHER // 2  # 1.5 ETH
    gas_used = 21000
    base_fee, priority_fee = 30 * 10**9, 2 * 10**9
    total_fee = gas_used * (base_fee + priority_fee)
    priority_paid = gas_used * priority_fee
    sender_before = 5 * ETHER
    sender_after = sender_before - value - total_fee
    eoa(post, "Acct0", nonce=5, balance_wei=sender_after)
    eoa(post, "Acct1", nonce=0, balance_wei=value)
    eoa(post, "Acct9", nonce=0, balance_wei=priority_paid)
    acct1_32, acct9_32 = a32(ACCOUNTS["Acct1"][0]), a32(ACCOUNTS["Acct9"][0])
    steps = [
        {"label": "recipient address padding", "formula": "addr32 = 0x00*12 || address20",
         "inputs": {"address": ACCOUNTS["Acct1"][0]}, "output": hx(acct1_32)},
        {"label": "recipient header stem", "formula": "stem = 0x00 || key_hash(addr32); key_hash = BLAKE3",
         "inputs": {"addr32": hx(acct1_32)}, "output": hx(emb.account_header_stem(acct1_32))},
        {"label": "recipient BASIC_DATA key", "formula": "key = get_tree_key(0x00, key_hash(addr32), 0)",
         "inputs": {}, "output": hx(emb.get_tree_key_for_basic_data(acct1_32))},
        {"label": "recipient CODE_HASH key (EOA: keccak(\"\"))",
         "formula": "key = get_tree_key(0x00, key_hash(addr32), 1); value = keccak256(b\"\")",
         "inputs": {}, "output": {"key": hx(emb.get_tree_key_for_code_hash(acct1_32)), "value": hx(emb.EMPTY_CODE_HASH)}},
        {"label": "fee recipient (coinbase) header stem, same formula, new address",
         "formula": "stem = 0x00 || key_hash(addr32)",
         "inputs": {"address": ACCOUNTS["Acct9"][0]}, "output": hx(emb.account_header_stem(acct9_32))},
        {"label": "balance arithmetic (EVM/EIP-1559 economics, not a tree formula)",
         "formula": "sender_after = sender_before - value - gas_used*(base_fee+priority_fee); coinbase += gas_used*priority_fee; base_fee portion is burned (credited nowhere)",
         "inputs": {"sender_before": sender_before, "value": value, "gas_used": gas_used, "base_fee_wei": base_fee, "priority_fee_wei": priority_fee},
         "output": {"sender_after": sender_after, "coinbase_credit": priority_paid}},
    ]
    return journey_result("J1", "Send ETH to a brand-new address", "Absence -> insertion split; a plain value transfer creates two brand-new 2-leaf EOAs (recipient + coinbase) while the sender's existing BASIC_DATA leaf is merely updated.", "W1", pre, post, steps)


def journey_J2(WB, W0):
    mega32 = a32(CONTRACTS["MegaToken"][0])
    combined = load_combined_json()
    mega_rt = bytes.fromhex(combined["contracts"]["MegaToken.sol:MegaToken"]["bin-runtime"])
    ch = keccak256(mega_rt)
    n_chunks = len(emb.chunkify_code(Bytes(mega_rt)))
    deployer_bal_slot = mapping_slot(bytes(a20(ACCOUNTS["Acct0"][0])), 4)
    steps = [
        {"label": "CREATE address (already computed off-chain, cast compute-address)",
         "formula": "address = keccak256(rlp([sender, nonce]))[12:]",
         "inputs": {"sender": ACCOUNTS["Acct0"][0], "nonce": 3}, "output": CONTRACTS["MegaToken"][0]},
        {"label": "code_hash", "formula": "code_hash = keccak256(runtime_code)",
         "inputs": {"runtime_code_bytes": len(mega_rt)}, "output": hx(ch)},
        {"label": "chunkify_code", "formula": "chunk_count = ceil(code_size/31); chunk[i] = [min(pushdata_run,31)] || code[31i:31i+31]",
         "inputs": {"code_size": len(mega_rt)}, "output": {"chunk_count": n_chunks, "code_groups": [0, 1]}},
        {"label": "code chunk 0 key (first code group)",
         "formula": "key = 0x01 || key_hash(code_hash || 0_as_32B_BE) || 0",
         "inputs": {}, "output": hx(emb.get_tree_key_for_code_chunk(ch, Uint(0)))},
        {"label": "code chunk 256 key (second code group, tree_index=1)",
         "formula": "key = 0x01 || key_hash(code_hash || 1_as_32B_BE) || 0",
         "inputs": {}, "output": hx(emb.get_tree_key_for_code_chunk(ch, Uint(256)))},
        {"label": "header creation", "formula": "BASIC_DATA(code_size, nonce=1, balance=0) + CODE_HASH leaf",
         "inputs": {"code_size": len(mega_rt), "nonce": 1}, "output": hx(emb.get_tree_key_for_code_hash(mega32))},
        {"label": "constructor storage: totalSupply (header slot, slot 2 < 64)",
         "formula": "key = get_tree_key_for_header(addr32, 64+2)",
         "inputs": {"slot": 2}, "output": hx(emb.get_tree_key_for_storage_slot(mega32, U256(2)))},
        {"label": "constructor storage: owner (header slot, slot 3 < 64, packed with paused)",
         "formula": "key = get_tree_key_for_header(addr32, 64+3)",
         "inputs": {"slot": 3}, "output": hx(emb.get_tree_key_for_storage_slot(mega32, U256(3)))},
        {"label": "constructor storage: balanceOf[deployer] (Solidity mapping, storage zone since slot>=64)",
         "formula": "storage_key = keccak256(pad32(deployer) || pad32(4)); key = 0xFF || key_hash(addr32) || key_hash(addr32||tree_index) || sub",
         "inputs": {"mapping_base_slot": 4, "holder": ACCOUNTS["Acct0"][0]},
         "output": {"storage_key": deployer_bal_slot, "tree_index": deployer_bal_slot // 256, "sub": deployer_bal_slot % 256,
                    "key": hx(emb.get_tree_key_for_storage_slot(mega32, U256(deployer_bal_slot)))}},
    ]
    return journey_result("J2", "Deploy a contract (from scratch)", "Full code-zone merkleization walk for a brand-new code_hash: chunking, 2 code groups (>256 chunks), header creation, constructor writes split across header slots and the storage zone.", "WB", WB, W0, steps)


def journey_J3(WA, WB):
    combined = load_combined_json()
    vault_rt = bytes.fromhex(combined["contracts"]["VaultTemplate.sol:VaultTemplate"]["bin-runtime"])
    ch = keccak256(vault_rt)
    steps = [
        {"label": "CREATE address for 3rd deployment",
         "formula": "address = keccak256(rlp([sender, nonce]))[12:]",
         "inputs": {"sender": ACCOUNTS["Acct0"][0], "nonce": 2}, "output": CONTRACTS["VaultTemplate3"][0]},
        {"label": "code_hash is IDENTICAL to VaultTemplate #1 and #2",
         "formula": "code_hash = keccak256(runtime_code); same runtime_code bytes as the first 2 deployments",
         "inputs": {}, "output": hx(ch)},
        {"label": "code chunk keys are therefore IDENTICAL too -> no new code-zone leaves",
         "formula": "get_tree_key_for_code_chunk(code_hash, i) depends only on code_hash and i, never on the deploying address",
         "inputs": {"chunk_count": len(emb.chunkify_code(Bytes(vault_rt)))},
         "output": {"new_code_leaves_written": 0}},
        {"label": "only a new header is created for the new address",
         "formula": "BASIC_DATA + CODE_HASH leaves at the new address's own stem",
         "inputs": {}, "output": hx(emb.account_header_stem(a32(CONTRACTS["VaultTemplate3"][0])))},
    ]
    return journey_result("J3", "Deploy the same bytecode again (dedup)", "Second and third deployments of identical bytecode write zero new code-zone leaves; content-addressing means only a new 34-byte header stem is created per deployment.", "WA", WA, WB, steps)


def journey_J4(W1):
    """3 sub-journeys sharing one pre-state: add delegation, re-delegate,
    revoke to zero. Returns (J4a, J4b_pre, results dict)."""
    acct3 = a32(ACCOUNTS["Acct3"][0])
    target1 = a32(CONTRACTS["VaultTemplate1"][0])
    target2 = a32(CONTRACTS["VaultTemplate2"][0])
    marker = bytes(emb.DELEGATION_MARKER)

    # J4a: add delegation to VaultTemplate1
    pre_a = W1
    post_a = copy_trie(pre_a)
    code_a = marker + bytes(a20(CONTRACTS["VaultTemplate1"][0]))
    emb.embed_account(post_a, acct3, U64(1), U256(1 * ETHER), emb.EMPTY_CODE_HASH, Bytes(code_a))
    steps_a = [
        {"label": "delegation indicator", "formula": "code = 0xef0100 || target20 (23 bytes)",
         "inputs": {"target": CONTRACTS["VaultTemplate1"][0]}, "output": hx(code_a)},
        {"label": "DELEGATION_LEAF_KEY", "formula": "key = get_tree_key_for_header(addr32, 2)",
         "inputs": {}, "output": hx(emb.get_tree_key_for_delegation(acct3))},
        {"label": "delegation value (padded to 32B)", "formula": "encode_delegation(code) = right_pad_zero_bytes(code, 32)",
         "inputs": {}, "output": hx(emb.encode_delegation(Bytes(code_a)))},
        {"label": "CODE_HASH leaf removed", "formula": "embed_account unconditionally clears CODE_HASH when is_delegation(code)",
         "inputs": {}, "output": {"code_hash_leaf_present_after": False}},
        {"label": "nonce bump (EIP-7702 protocol rule, not EIP-8297)",
         "formula": "authorizing account's nonce += 1 per used authorization", "inputs": {}, "output": {"nonce_after": 1}},
        {"label": "resolves-to: target's own header/code (weak link, not a tree edge)",
         "formula": "target's CODE_HASH leaf and code group are looked up by client software following the 20-byte target, never a stored tree pointer",
         "inputs": {}, "output": {"target_code_hash_key": hx(emb.get_tree_key_for_code_hash(target1))}},
    ]
    j4a = journey_result("J4a", "Delegate an EOA (EIP-7702)", "sub2 written, sub1 removed, code_size=23; a dashed resolves-to link (not a tree edge) points at the target's own CODE_HASH leaf.", "W1", pre_a, post_a, steps_a)

    # J4b: re-delegate (from post_a) to VaultTemplate2
    pre_b = post_a
    post_b = copy_trie(pre_b)
    code_b = marker + bytes(a20(CONTRACTS["VaultTemplate2"][0]))
    emb.embed_account(post_b, acct3, U64(2), U256(1 * ETHER), emb.EMPTY_CODE_HASH, Bytes(code_b))
    steps_b = [
        {"label": "delegation value overwritten in place (same DELEGATION_LEAF_KEY)",
         "formula": "encode_delegation(0xef0100 || target2_20 || 0*9)", "inputs": {"target": CONTRACTS["VaultTemplate2"][0]},
         "output": hx(emb.encode_delegation(Bytes(code_b)))},
    ]
    j4b = journey_result("J4b", "Re-delegate to a new target", "Same DELEGATION_LEAF_KEY leaf, value overwritten; the resolves-to link now points at a different code group.", "W1+J4a", pre_b, post_b, steps_b)

    # J4c: revoke to zero (from post_a)
    pre_c = post_a
    post_c = copy_trie(pre_c)
    emb.embed_account(post_c, acct3, U64(2), U256(1 * ETHER), emb.EMPTY_CODE_HASH, Bytes(b""))
    steps_c = [
        {"label": "authorization to the zero address clears delegation",
         "formula": "code=b\"\" -> is_delegation(code) is False -> DELEGATION_LEAF_KEY removed, CODE_HASH leaf restored to keccak(\"\")",
         "inputs": {}, "output": {"delegation_leaf_present_after": False,
                                    "code_hash_after": hx(emb.EMPTY_CODE_HASH), "code_size_after": 0}},
    ]
    j4c = journey_result("J4c", "Revoke a delegation (authorize to 0x0)", "Delegation leaf removed; CODE_HASH leaf restored to keccak(\"\") with code_size zeroed, exactly the shape of a never-delegated EOA.", "W1+J4a", pre_c, post_c, steps_c)

    return j4a, j4b, j4c


def journey_J5(W1):
    pre = W1
    post = copy_trie(pre)
    mega32 = a32(CONTRACTS["MegaToken"][0])
    amount = 40_000 * ETHER
    sender_slot = mapping_slot(bytes(a20(ACCOUNTS["Acct4"][0])), 4)
    recip_slot = mapping_slot(bytes(a20(ACCOUNTS["Acct8"][0])), 4)
    sender_before = MEGA_HOLDINGS["Acct4"] * ETHER
    emb.embed_storage_slot(post, mega32, U256(sender_slot), Bytes32((sender_before - amount).to_bytes(32, "big")))
    emb.embed_storage_slot(post, mega32, U256(recip_slot), Bytes32(amount.to_bytes(32, "big")))
    steps = [
        {"label": "sender balance slot (mapping, Solidity convention)",
         "formula": "storage_key = keccak256(pad32(Acct4) || pad32(4))",
         "inputs": {"holder": ACCOUNTS["Acct4"][0], "base_slot": 4},
         "output": {"storage_key": sender_slot, "tree_index": sender_slot // 256, "sub": sender_slot % 256}},
        {"label": "sender storage-zone key", "formula": "key = 0xFF || key_hash(addr32) || key_hash(addr32||tree_index) || sub",
         "inputs": {}, "output": hx(emb.get_tree_key_for_storage_slot(mega32, U256(sender_slot)))},
        {"label": "recipient balance slot (fresh insert)", "formula": "storage_key = keccak256(pad32(Acct8) || pad32(4))",
         "inputs": {"holder": ACCOUNTS["Acct8"][0], "base_slot": 4},
         "output": {"storage_key": recip_slot, "tree_index": recip_slot // 256, "sub": recip_slot % 256}},
        {"label": "contrast: MegaToken's OWN totalSupply is a header slot (slot 2 < 64), unaffected by a transfer",
         "formula": "get_tree_key_for_storage_slot(mega32, 2) resolves to the header stem, not the storage zone",
         "inputs": {}, "output": hx(emb.get_tree_key_for_storage_slot(mega32, U256(2)))},
    ]
    return journey_result("J5", "Transfer an ERC-20", "Mapping-slot derivation (Solidity, Keccak) feeds the EIP-8297 storage-zone key formula (BLAKE3); sender update + recipient insert in two different storage groups of the same bucket; contrast with a header slot.", "W1", pre, post, steps)


def journey_J6(W1):
    """Read-only companion to J5: which code chunks does a `transfer` call
    touch. No new tree writes beyond J5's; this beat is about witness/chunk
    read granularity, not a mutation."""
    combined = load_combined_json()
    mega_rt = bytes.fromhex(combined["contracts"]["MegaToken.sol:MegaToken"]["bin-runtime"])
    selector = combined["contracts"]["MegaToken.sol:MegaToken"]["hashes"]["transfer(address,uint256)"]
    dest = find_selector_jumpdest(mega_rt, selector)
    n_chunks = len(emb.chunkify_code(Bytes(mega_rt)))
    dispatcher_last_chunk = (dest - 1) // 31 if dest else None
    return {
        "id": "J6", "title": "Call a contract (partial code witness)",
        "teaches": "Only the chunks execution actually visits are needed in a witness; a call to transfer(address,uint256) touches the dispatcher chunks plus the function-body chunk starting at its real JUMPDEST, not all 263 chunks of MegaToken.",
        "pre_state": "W1", "pre_root": hx(trie_root(W1)), "post_root": hx(trie_root(W1)),
        "derivation_steps": [
            {"label": "function selector", "formula": "selector = first 4 bytes of keccak256(\"transfer(address,uint256)\")",
             "inputs": {}, "output": "0x" + selector},
            {"label": "dispatcher JUMPDEST for this selector (found by disassembling the real runtime bytecode)",
             "formula": "scan PUSH4<selector> ... PUSH2<dest> ... JUMPI in the compiled dispatcher",
             "inputs": {}, "output": {"jumpdest_pc": dest, "chunk_of_jumpdest": dest // 31 if dest else None}},
            {"label": "dispatcher chunks (every call touches these first)",
             "formula": "chunks 0..floor((jumpdest_pc-1)/31)", "inputs": {},
             "output": {"chunks": list(range(0, (dispatcher_last_chunk or 0) + 1))}},
            {"label": "PUSHDATA jumpdest-validity byte reused for witness/EVM alike",
             "formula": "chunk byte0 = leading PUSHDATA run length also tells the EVM whether the JUMPDEST at this offset is real code or mid-operand data",
             "inputs": {}, "output": {"note": "same byte0 field serves chunking and jumpdest-analysis"}},
        ],
        "writes": [], "hashes_recomputed": {"branches_recomputed": 0, "leaves_changed": 0},
        "notes": ["Companion to J5; touches the same account, writes nothing new -- see J5 for the storage-zone mutation this call would also perform."],
    }


def journey_J7(W1):
    pre = W1
    post = copy_trie(pre)
    vault1 = a32(CONTRACTS["VaultTemplate1"][0])
    combined = load_combined_json()
    vault_rt = bytes.fromhex(combined["contracts"]["VaultTemplate.sol:VaultTemplate"]["bin-runtime"])
    deploy(post, "VaultTemplate1", vault_rt, nonce=1, balance_wei=0)  # full withdrawal: ETH balance -> 0
    emb.embed_storage_slot(post, vault1, U256(1), Bytes32(b"\x00" * 32))  # balance slot -> 0 (deletes leaf)
    slot_key = emb.get_tree_key_for_storage_slot(vault1, U256(1))
    steps = [
        {"label": "withdraw(1 ether): balance storage var -> 0", "formula": "state_write collapses a 32-zero-byte write to a deletion",
         "inputs": {"key": hx(slot_key)}, "output": {"leaf_present_after": False}},
        {"label": "header sub-index of slot 1", "formula": "sub = HEADER_STORAGE_OFFSET + 1 = 65",
         "inputs": {}, "output": 65},
    ]
    return journey_result("J7", "Clear a slot (write zero)", "A write of 32 zero bytes resolves to a deletion at the state layer; the tree's own one-level merge (surviving sibling promoted, prefix spliced if it's a branch) restores canonical form.", "W1", pre, post, steps)


def journey_J8(W0):
    """Detail lens on J2's own deployment (MegaToken IS the >256-chunk
    contract); no new tree writes, just the code-zone breakdown."""
    combined = load_combined_json()
    mega_rt = bytes.fromhex(combined["contracts"]["MegaToken.sol:MegaToken"]["bin-runtime"])
    ch = keccak256(mega_rt)
    chunks = emb.chunkify_code(Bytes(mega_rt))
    zero_idx = [i for i, c in enumerate(chunks) if bytes(c) == b"\x00" * 32]
    straddle = None
    for pc, op, operand in disassemble(mega_rt):
        if op == 0x7F and operand is not None:  # PUSH32
            start, end = pc + 1, pc + 32  # operand byte range [start, end]
            if start // 31 != end // 31:
                straddle = {"push32_opcode_pc": pc, "operand_start": start, "operand_end": end,
                            "chunk_before": start // 31, "chunk_after": end // 31}
                break
    return {
        "id": "J8", "title": "Deploy a big contract (>256 chunks)",
        "teaches": "A contract past 256 chunks spans 2+ code groups scattered across the code zone (each keyed by key_hash(code_hash||tree_index), unrelated stems); a PUSH32 operand can straddle a chunk boundary; a genuine zero-code, non-PUSHDATA run is an absent chunk.",
        "pre_state": "W0 (=post-J2)", "pre_root": hx(trie_root(W0)), "post_root": hx(trie_root(W0)),
        "derivation_steps": [
            {"label": "chunk count", "formula": "ceil(code_size/31)", "inputs": {"code_size": len(mega_rt)}, "output": len(chunks)},
            {"label": "code groups", "formula": "tree_index = chunk_id // 256; group 0 = chunks 0-255, group 1 = chunks 256+",
             "inputs": {}, "output": {"group_0_size": 256, "group_1_size": len(chunks) - 256,
                                        "group_0_stem": hx(bytes([1]) + emb.key_hash(bytes(ch) + (0).to_bytes(32, "big"))),
                                        "group_1_stem": hx(bytes([1]) + emb.key_hash(bytes(ch) + (1).to_bytes(32, "big")))}},
            {"label": "genuine all-zero absent chunk", "formula": "chunk encodes to 32 zero bytes (zero code AND byte0=0) -> absent, from RESERVED_ZERO_REGION",
             "inputs": {}, "output": {"absent_chunk_count": len(zero_idx), "first_indices": zero_idx[:5]}},
            {"label": "PUSH32 straddling a chunk boundary", "formula": "opcode 0x7F operand is 32 bytes > 31-byte chunk width",
             "inputs": {}, "output": straddle},
        ],
        "writes": [], "hashes_recomputed": {"branches_recomputed": 0, "leaves_changed": 0},
        "notes": ["Same deployment as J2; this beat is a detail lens on its code-zone layout, not a separate write."],
    }


def journey_J9(W1):
    mega32 = a32(CONTRACTS["MegaToken"][0])
    holder_slot = mapping_slot(bytes(a20(ACCOUNTS["Acct4"][0])), 4)
    holder_key = emb.get_tree_key_for_storage_slot(mega32, U256(holder_slot))
    presence = witness_path(W1, bytes(holder_key))
    absent_key = emb.get_tree_key_for_basic_data(a32(ACCOUNTS["Acct1"][0]))
    absence = witness_path(W1, bytes(absent_key))
    mpt_branch_bytes_at_depth12 = 15 * 32 * 12  # EIP-8297 Motivation, exact figure
    return {
        "id": "J9", "title": "Prove it (witness anatomy)",
        "teaches": "A PBT witness is the path plus exactly one sibling hash per level (arity 2); shown against MPT's 15-wide branches at the same real depth.",
        "pre_state": "W1", "pre_root": hx(trie_root(W1)), "post_root": hx(trie_root(W1)),
        "derivation_steps": [
            {"label": "presence witness: Acct4's MegaToken balance leaf", "formula": "per level: encode_bit_prefix(this branch) + sibling hash",
             "inputs": {"key": hx(holder_key)},
             "output": {"levels": len(presence["levels"]), "witness_bytes": presence["witness_bytes"]}},
            {"label": "absence witness: Acct1's BASIC_DATA key (Acct1 does not exist in W1)",
             "formula": "walk diverges at the first bit where the key differs from the tree; terminal neighbor leaf's full key+value proves the divergence",
             "inputs": {"key": hx(absent_key)},
             "output": {"present": absence["present"], "levels": len(absence["levels"]), "witness_bytes": absence["witness_bytes"]}},
            {"label": "MPT comparison (EIP-8297 Motivation, exact quoted figure)",
             "formula": "15 siblings * 32 bytes * 12 levels (typical MPT account-trie depth)",
             "inputs": {}, "output": mpt_branch_bytes_at_depth12},
        ],
        "writes": [], "hashes_recomputed": {"branches_recomputed": 0, "leaves_changed": 0}, "notes": [],
    }


def journey_J10(W1, j1_post, j5_post, j4a_post):
    """One block: J1's ETH send + J5's ERC-20 transfer + J4a's delegation,
    all applied together to W1, to show the union-of-paths hash-recompute
    saving vs the naive per-write sum."""
    pre = W1
    post = copy_trie(pre)
    for k, v in j1_post._data.items():
        if pre._data.get(k) != v:
            trie_set(post, k, v)
    for k, v in j5_post._data.items():
        if pre._data.get(k) != v:
            trie_set(post, k, v)
    for k, v in j4a_post._data.items():
        if pre._data.get(k) != v:
            trie_set(post, k, v)
    changed = diff_tries(pre, post)
    changed_keys = [c["key"] for c in changed]
    combined_stats = compute_recompute_stats(post, changed_keys)
    j1_changed = len(diff_tries(pre, j1_post))
    j5_changed = len(diff_tries(pre, j5_post))
    j4a_changed = len(diff_tries(pre, j4a_post))
    j1_stats = compute_recompute_stats(j1_post, [c["key"] for c in diff_tries(pre, j1_post)])
    j5_stats = compute_recompute_stats(j5_post, [c["key"] for c in diff_tries(pre, j5_post)])
    j4a_stats = compute_recompute_stats(j4a_post, [c["key"] for c in diff_tries(pre, j4a_post)])
    naive_sum = j1_stats["branches_recomputed"] + j5_stats["branches_recomputed"] + j4a_stats["branches_recomputed"]
    return {
        "id": "J10", "title": "One block, many writes",
        "teaches": "Independent writes across zones/accounts (J1's ETH send, J5's ERC-20 transfer, J4a's delegation) share upper branch nodes; one bottom-up recomputation recomputes the union, not the naive per-write sum.",
        "pre_state": "W1", "pre_root": hx(trie_root(pre)), "post_root": hx(trie_root(post)),
        "derivation_steps": [
            {"label": "combined write set", "formula": "union of J1 + J5 + J4a's individual key/value changes applied to one trie",
             "inputs": {"j1_leaves_changed": j1_changed, "j5_leaves_changed": j5_changed, "j4a_leaves_changed": j4a_changed},
             "output": {"total_leaves_changed": len(changed_keys)}},
            {"label": "branch recompute: union vs naive sum",
             "formula": "branches_recomputed(union) <= branches_recomputed(J1)+branches_recomputed(J5)+branches_recomputed(J4a); equality only if the three write sets share no ancestor",
             "inputs": {"naive_sum": naive_sum}, "output": combined_stats["branches_recomputed"]},
        ],
        "writes": changed, "hashes_recomputed": combined_stats,
        "notes": [f"Naive per-journey sum would be {naive_sum} branch recomputes; the real single bottom-up pass recomputes {combined_stats['branches_recomputed']} because paths meet near the root (EIP-8297 Rationale, \"Single tree with zones\")."],
    }


def journey_J11(W1):
    """Two variants of SELFDESTRUCT in the creating tx (EIP-6780). Both
    phases (create, destroy) are recorded explicitly: the NET diff against
    W1 is empty either way (an account created and destroyed in its own
    creating tx leaves no trace in the committed state -- EIP-6780), so the
    teaching point lives in the two phases' writes, not in a pre/post root
    difference."""
    combined = load_combined_json()
    vault_rt = bytes.fromhex(combined["contracts"]["VaultTemplate.sol:VaultTemplate"]["bin-runtime"])
    eph_rt = bytes.fromhex(combined["contracts"]["Ephemeral.sol:Ephemeral"]["bin-runtime"])

    def phased_result(jid, title, teaches, pre, mid, post, create_steps, destroy_steps):
        create_writes = diff_tries(pre, mid)
        destroy_writes = diff_tries(mid, post)
        create_keys = [c["key"] for c in create_writes]
        destroy_keys = [c["key"] for c in destroy_writes]
        create_stats = compute_recompute_stats(mid, create_keys)
        destroy_stats = compute_recompute_stats(post, destroy_keys) if destroy_keys else {"branches_recomputed": 0, "leaves_changed": 0}
        return {
            "id": jid, "title": title, "teaches": teaches,
            "pre_state": "W1", "pre_root": hx(trie_root(pre)),
            "mid_root": hx(trie_root(mid)), "post_root": hx(trie_root(post)),
            "phases": {
                "create": {"writes": create_writes, "hashes_recomputed": create_stats, "derivation_steps": create_steps},
                "destroy": {"writes": destroy_writes, "hashes_recomputed": destroy_stats, "derivation_steps": destroy_steps},
            },
            "notes": [f"post_root == pre_root ({hx(trie_root(post)) == hx(trie_root(pre))}): created-and-destroyed in one tx leaves zero trace in the committed state (EIP-6780)."],
        }

    # J11a: deploy+destroy a 4th VaultTemplate instance (code shared with #1-3)
    pre_a = W1
    mid_a = copy_trie(pre_a)
    vt4 = a32(CONTRACTS["VaultTemplate4"][0])
    deploy(mid_a, "VaultTemplate4", vault_rt, nonce=1, balance_wei=0)
    emb.embed_storage_slot(mid_a, vt4, U256(0), Bytes32(a32(ACCOUNTS["Acct9"][0])))
    post_a = copy_trie(mid_a)
    emb.remove_account(post_a, vt4)
    ch_vault = keccak256(vault_rt)
    other_holders_of_code = ["VaultTemplate1", "VaultTemplate2", "VaultTemplate3"]
    create_steps_a = [
        {"label": "deploy: code_hash identical to 3 existing siblings -> chunk writes are no-ops (same as J3)",
         "formula": "code_hash = keccak256(runtime_code)", "inputs": {}, "output": hx(ch_vault)},
        {"label": "new header created at VaultTemplate#4's own address", "formula": "BASIC_DATA + CODE_HASH + owner slot(0, header)",
         "inputs": {}, "output": hx(emb.account_header_stem(vt4))},
    ]
    destroy_steps_a = [
        {"label": "SELFDESTRUCT in creating tx (EIP-6780): header + storage removed unconditionally",
         "formula": "remove_account: remove_subtree(header_stem) + remove_subtree(storage_prefix)", "inputs": {}, "output": {"header_removed": True, "storage_removed": True}},
        {"label": "code_hash still referenced by 3 other live accounts -> code chunks NOT removed",
         "formula": "reference check: does any account in the resulting state have this code_hash?",
         "inputs": {"code_hash": hx(ch_vault), "other_holders": [CONTRACTS[l][0] for l in other_holders_of_code]},
         "output": {"code_chunks_removed": False}},
    ]
    j11a = phased_result("J11a", "SELFDESTRUCT in creating tx (shared code)",
                          "Header and storage leaves are removed unconditionally; code chunks survive because 3 sibling VaultTemplate instances still share the same code_hash -- the account leaves no trace, but the code stays exactly because other accounts still reference it.",
                          pre_a, mid_a, post_a, create_steps_a, destroy_steps_a)

    # J11b: deploy+destroy Ephemeral (unique code, no other holder)
    pre_b = W1
    mid_b = copy_trie(pre_b)
    eph = a32(CONTRACTS["Ephemeral"][0])
    deploy(mid_b, "Ephemeral", eph_rt, nonce=1, balance_wei=0)
    post_b = copy_trie(mid_b)
    emb.remove_account(post_b, eph)
    ch_eph = keccak256(eph_rt)
    emb.remove_code_chunks(post_b, ch_eph, Bytes(eph_rt))
    create_steps_b = [
        {"label": "deploy: brand-new unique code_hash -> new code chunks written",
         "formula": "code_hash = keccak256(runtime_code); chunkify_code", "inputs": {},
         "output": {"code_hash": hx(ch_eph), "chunk_count": len(emb.chunkify_code(Bytes(eph_rt)))}},
    ]
    destroy_steps_b = [
        {"label": "SELFDESTRUCT in creating tx: header + storage removed unconditionally",
         "formula": "remove_account", "inputs": {}, "output": {"header_removed": True, "storage_removed": True}},
        {"label": "code_hash referenced by no other account -> code chunks ARE removed",
         "formula": "reference check against the resulting state finds zero holders", "inputs": {"code_hash": hx(ch_eph)},
         "output": {"code_chunks_removed": True, "chunk_count": len(emb.chunkify_code(Bytes(eph_rt)))}},
    ]
    j11b = phased_result("J11b", "SELFDESTRUCT in creating tx (unique code)",
                          "Contrast with J11a: this contract's bytecode is unique, so its code-zone leaves are written on create AND removed on destroy, not just header/storage -- both variants still leave zero net trace in the committed root.",
                          pre_b, mid_b, post_b, create_steps_b, destroy_steps_b)
    return j11a, j11b


# --------------------------------------------------------------------------
# Zone atlas (A0-A5) + Why-PBT (W1-W9) stats, all computed from W1's real
# tree -- never hand-asserted.
# --------------------------------------------------------------------------

def compute_zone_atlas(W1, nodes, root_id):
    root_node = next(n for n in nodes if n["id"] == root_id)
    left_id, right_id = root_node["children"]
    left = next(n for n in nodes if n["id"] == left_id)
    right = next(n for n in nodes if n["id"] == right_id)
    zone_counts = {}
    for n in nodes:
        if n["type"] == "leaf":
            z = n["zone"]
            zone_counts[z] = zone_counts.get(z, 0) + 1
    mega32 = a32(CONTRACTS["MegaToken"][0])
    bucket_prefix = emb.account_storage_prefix(mega32)
    groups = set()
    for n in nodes:
        if n["type"] == "leaf" and bytes.fromhex(n["key"][2:]).startswith(bytes(bucket_prefix)):
            key = bytes.fromhex(n["key"][2:])
            groups.add(key[:65])  # zone(1) + key_hash(addr)(32) + key_hash(addr||tree_index)(32)
    return {
        "root": {"id": root_id, "prefix_bit_count": 0, "children": [left_id, right_id]},
        "root_split": {
            "bit0_left": {"id": left_id, "zone_byte_of_subtree": left["zone"], "prefix_bits": left.get("prefix_bits")},
            "bit0_right": {"id": right_id, "zone_byte_of_subtree": right["zone"], "prefix_bits": right.get("prefix_bits")},
        },
        "leaf_counts_by_zone": {("0x%02x" % z if z is not None else "mixed"): c for z, c in zone_counts.items()},
        "megatoken_storage_groups": len(groups),
        "total_nodes": len(nodes),
        "total_leaves": sum(1 for n in nodes if n["type"] == "leaf"),
        "total_branches": sum(1 for n in nodes if n["type"] == "branch"),
        "max_leaf_bit_depth": max(n["bit_depth"] for n in nodes if n["type"] == "leaf"),
    }


def compute_why_pbt(W1, atlas, j3, j9):
    return {
        "W1_proof_size": {
            "pbt_witness_bytes_example": j9["derivation_steps"][0]["output"]["witness_bytes"],
            "pbt_witness_levels_example": j9["derivation_steps"][0]["output"]["levels"],
            "mpt_branch_bytes_depth12": j9["derivation_steps"][2]["output"],
            "eip_arity_table": [
                {"k": 2, "chunks": 24, "bytes": 768}, {"k": 4, "chunks": 36, "bytes": 1152},
                {"k": 8, "chunks": 56, "bytes": 1792}, {"k": 16, "chunks": 90, "bytes": 2880},
            ],
        },
        "W2_code_witness": {"worst_case_unchunked_block_bytes": "60_000_000/2400 * (12*480 + 65536) ~= 1.8e9",
                              "note": "EIP-8297 Motivation, exact formula and figure"},
        "W3_one_tree_no_storage_roots": {
            "total_nodes": atlas["total_nodes"], "account_and_storage_share_one_root": True,
        },
        "W4_zones_as_commitments": {"zone_byte_ranges": {"account": "0x00", "code": "0x01", "reserved": "0x02-0xFE", "storage": "0xFF"}},
        "W5_dedup_at_scale": {"vaulttemplate_deployments": 3, "code_leaves_written_after_first_deploy": 0,
                                 "source": j3["id"]},
        "W6_hash_agnostic": {"reference_hash": "BLAKE3", "candidates": ["BLAKE3", "Keccak", "Poseidon2"], "final": False},
        "W7_migration_pointer": {"eip": "EIP-8347", "note": "migration off consensus-critical path, single coordinated fork"},
        "W8_state_expiry_preview": {
            "unit_of_expiry": "storage bucket (key_hash(address)) or account header stem",
            "note": "EIP-8297 Rationale 'State expiry': expiry marks a region with a stub at the expiry fork; mechanism itself is a separate EIP",
        },
        "W9_grinding_and_security": {
            "collision_work_bits": 128,
            "grinding_k_shared_bits_cost": "2^(k/2) work for a k-node chain without compression",
            "grinding_with_compression_extra_nodes_d": "2^d work for d real extra nodes after prefix compression",
            "note": "EIP-8297 Security Considerations, exact figures",
        },
    }


README = {
    "purpose": "Ground-truth fixture for the PBT 3D explainer. Every key/hash/chunk was produced by the real EIP-8297 reference implementation (execution-specs-ports-wt, src/ethereum/binary_trie/{trie.py,embedding.py}), never hand-typed.",
    "world_snapshots": {
        "WA": "3 EOAs funded, VaultTemplate #1 and #2 deployed",
        "WB": "WA + VaultTemplate #3 (=post-J3, dedup)",
        "W0": "WB + MegaToken deployed with full initial supply to the deployer (=post-J2)",
        "W1": "W0 + ERC-20 distributed to 4 holders + VaultTemplate#1 receives a deposit; the shared pre-state for most journeys and for the top-level node/leaf list below",
    },
    "top_level_nodes_leaves": "computed on W1; node.id is the first 14 hex chars of that node's own real merkleize() hash",
    "journeys": "each has pre_state (a world snapshot id, or 'W1+J4a' meaning W1 after J4a's writes), pre_root/post_root, derivation_steps (label/formula/inputs/output using real computed values), writes (key/before/after/action), hashes_recomputed ({branches_recomputed, leaves_changed} -- branches_recomputed is the union of root-to-changed-leaf branch positions in the post-tree, see compute_recompute_stats)",
    "zone_atlas": "computed from W1: root_split confirms which side bit0=0/1 lands on; leaf_counts_by_zone; megatoken_storage_groups counts distinct (zone||key_hash(addr)||key_hash(addr||tree_index)) prefixes actually populated",
    "why_pbt": "W1-W9; W1/W2/W6/W7/W9 numbers are EIP-8297 text figures (Motivation/Rationale/Security Considerations), W3/W4/W5/W8 are computed from this fixture",
    "hash_function": "BLAKE3 for tree merkleization and key_hash (EIP-8297, explicitly not final); Keccak256 for code_hash/EXTCODEHASH/CREATE addresses/Solidity mapping-and-array slot derivation (unaffected by PBT's hash choice, EIP-8297 Backwards Compatibility)",
}


def main():
    WA = build_WA()
    WB = build_WB(WA)
    W0 = build_W0(WB)
    W1 = build_W1(W0)

    j1 = journey_J1(W1)
    j2 = journey_J2(WB, W0)
    j3 = journey_J3(WA, WB)
    j4a, j4b, j4c = journey_J4(W1)
    j5 = journey_J5(W1)
    j6 = journey_J6(W1)
    j7 = journey_J7(W1)
    j8 = journey_J8(W0)
    j9 = journey_J9(W1)

    # rebuild post-tries for J1/J5/J4a to feed J10 (journey_result doesn't
    # return the post trie object, only its root/diff, so recompute here)
    j1_post = copy_trie(W1)
    eoa(j1_post, "Acct0", nonce=5, balance_wei=5 * ETHER - (3 * ETHER // 2) - 21000 * 32 * 10**9)
    eoa(j1_post, "Acct1", nonce=0, balance_wei=3 * ETHER // 2)
    eoa(j1_post, "Acct9", nonce=0, balance_wei=21000 * 2 * 10**9)
    j5_post = copy_trie(W1)
    mega32 = a32(CONTRACTS["MegaToken"][0])
    amount = 40_000 * ETHER
    sender_slot = mapping_slot(bytes(a20(ACCOUNTS["Acct4"][0])), 4)
    recip_slot = mapping_slot(bytes(a20(ACCOUNTS["Acct8"][0])), 4)
    emb.embed_storage_slot(j5_post, mega32, U256(sender_slot), Bytes32((MEGA_HOLDINGS["Acct4"] * ETHER - amount).to_bytes(32, "big")))
    emb.embed_storage_slot(j5_post, mega32, U256(recip_slot), Bytes32(amount.to_bytes(32, "big")))
    j4a_post = copy_trie(W1)
    code_a = bytes(emb.DELEGATION_MARKER) + bytes(a20(CONTRACTS["VaultTemplate1"][0]))
    emb.embed_account(j4a_post, a32(ACCOUNTS["Acct3"][0]), U64(1), U256(1 * ETHER), emb.EMPTY_CODE_HASH, Bytes(code_a))

    j10 = journey_J10(W1, j1_post, j5_post, j4a_post)
    j11a, j11b = journey_J11(W1)

    nodes, root_id, root_hash = flatten_tree(W1)
    atlas = compute_zone_atlas(W1, nodes, root_id)
    why_pbt = compute_why_pbt(W1, atlas, j3, j9)

    out = {
        "readme": README,
        "world": {
            "accounts": {k: {"address": v[0], "role": v[1]} for k, v in ACCOUNTS.items()},
            "contracts": {k: {"address": v[0], "source": v[1], "deployer": v[2], "nonce": v[3]} for k, v in CONTRACTS.items()},
            "create2_example": CREATE2_EXAMPLE,
            "mega_holdings_whole_tokens": MEGA_HOLDINGS,
        },
        "world_roots": {
            "WA": hx(trie_root(WA)), "WB": hx(trie_root(WB)),
            "W0": hx(trie_root(W0)), "W1": hx(trie_root(W1)),
        },
        "final_root": root_hash,
        "nodes": nodes,
        "journeys": [j1, j2, j3, j4a, j4b, j4c, j5, j6, j7, j8, j9, j10, j11a, j11b],
        "zone_atlas": atlas,
        "why_pbt": why_pbt,
    }

    out_path = os.path.join(HERE, "pbt-fixtures.json")
    with open(out_path, "w") as f:
        json.dump(out, f, indent=1)
    size = os.path.getsize(out_path)
    print(f"wrote {out_path} ({size} bytes, {size/1e6:.2f} MB)")
    print(f"nodes={len(nodes)} leaves={atlas['total_leaves']} branches={atlas['total_branches']}")
    print(f"leaf_counts_by_zone={atlas['leaf_counts_by_zone']}")
    print(f"megatoken_storage_groups={atlas['megatoken_storage_groups']}")
    print(f"root_split bit0_left zone={atlas['root_split']['bit0_left']['zone_byte_of_subtree']} bit0_right zone={atlas['root_split']['bit0_right']['zone_byte_of_subtree']}")
    assert size < 2_000_000, "fixture exceeds 2MB budget"


if __name__ == "__main__":
    main()
