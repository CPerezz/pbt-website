#!/usr/bin/env python3
"""Name the addresses the notes list, by asking the contracts themselves (cast + a public RPC).

    python3 labels.py    # after analyze.py; writes ../data/labels.json, then rerun analyze.py

Pools are named from token0/token1/fee, tokens from symbol(), anything else from name(). Addresses nothing answers for
keep their short hex form on the page.
"""
import json
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
RPC = os.environ.get("ETH_RPC_URL", "https://ethereum-rpc.publicnode.com")
KNOWN = {  # system contracts and well-known singletons without a name() function
    "0x00000000219ab540356cbb839cbe05303d7705fa": "Beacon deposit contract",
    "0x00000961ef480eb55e80d19ad83579a64c007002": "EIP-7002 withdrawal requests",
    "0x0000bbddc7ce488642fb579f8b00f3a590007251": "EIP-7251 consolidation requests",
    "0x0000000071727de22e5e9d8baf0edac6f37da032": "ERC-4337 EntryPoint v0.7",
    "0x000f3df6d732807ef1319fb7b8bb8522d0beac02": "EIP-4788 beacon roots",
    "0x0000f90827f1c53a10cb7a02335b175320002935": "EIP-2935 block hashes",
}
V2_FACTORY = "0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f"
V3_FACTORY = "0x1f98431c8ad98523631ae4a59f267346ea31f984"
def call(addr, sig):
    p = subprocess.run(["cast", "call", addr, sig, "--rpc-url", RPC], capture_output=True, text=True, timeout=30)
    return p.stdout.strip().strip('"') if p.returncode == 0 and p.stdout.strip() else None


def name(addr):
    if addr in KNOWN:
        return KNOWN[addr]
    factory = (call(addr, "factory()(address)") or "").lower()
    t0, t1 = call(addr, "token0()(address)"), call(addr, "token1()(address)")
    if t0 and t1:
        s0, s1 = call(t0, "symbol()(string)") or t0[:8], call(t1, "symbol()(string)") or t1[:8]
        fee = call(addr, "fee()(uint24)")
        if fee:
            kind = "Uniswap V3" if factory == V3_FACTORY else "V3-style pool"
            return f"{kind} {s0}/{s1} {int(fee.split()[0]) / 10000:g}%"
        return f"{'Uniswap V2' if factory == V2_FACTORY else 'V2-style pair'} {s0}/{s1}"
    if factory == V2_FACTORY:
        return "Uniswap V2 router"
    if factory == V3_FACTORY:
        return "Uniswap V3 router"
    sym = call(addr, "symbol()(string)")
    if sym:
        return sym
    return call(addr, "name()(string)")
def main():
    s = json.load(open(os.path.join(DATA, "summary.json")))
    addrs = {r["a"] for key in (("a3", "top_contracts"), ("a3", "top_targets"), ("c2", "top"), ("d2", "top"))
             for r in s[key[0]][key[1]]["v"] if r["a"]}
    out = {}
    for a in sorted(addrs):
        n = name(a)
        if n:
            out[a] = n
        print(a, n)
    json.dump(out, open(os.path.join(DATA, "labels.json"), "w"), indent=1, sort_keys=True)


if __name__ == "__main__":
    main()
