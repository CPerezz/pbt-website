#!/usr/bin/env python3
"""Run the header-slot case-study queries through the panda CLI.

    python3 run.py              # every job; finished labels are skipped, so it resumes
    python3 run.py tx_savings   # one job

Each job writes ../data/raw/<job>.jsonl, one line per run: {"label", "columns", "rows"}.
Needs `panda` logged in (`panda auth login`). Stdlib only.
"""
import json
import os
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "..", "data", "raw")

USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7"
PROXY_SLOTS = [  # EIP-1967
    "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",  # implementation
    "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103",  # admin
    "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50",  # beacon
]


def slot(n):
    return "'0x%064x'" % n


CONST = {f"L{n}": slot(n) for n in (2, 4, 16, 32, 64, 128, 192, 256)}
CONST.update(ZERO=slot(0), USDT=f"'{USDT}'", PROXY=", ".join(f"'{s}'" for s in PROXY_SLOTS))

# Windows (see ../method.html). Storage reads are complete from block 24,700,000.
CHUNKS = [(24_700_000 + k * 10_000, 24_700_000 + k * 10_000 + 999) for k in range(161)]
ERAS = [(s, s + 199) for s in range(1_000_000, 26_250_001, 250_000)]
WINDOW = (26_285_600, 26_299_999)  # two contiguous days
MODEL_WINDOWS = [(s, s + 249) for s in (24_900_000, 25_400_000, 25_900_000, 26_299_000)]  # 1,000 blocks, spread
STATE_BLOCK = 26_300_000
C3_PREFIXES = ["0x17", "0x5a", "0xc3", "0xe8"]  # 1/64 of addresses


def rng(a, b):
    return f"meta_network_name = 'mainnet' AND block_number BETWEEN {a} AND {b}"


def rngs(ranges):
    return "meta_network_name = 'mainnet' AND (" + " OR ".join(
        f"(block_number BETWEEN {a} AND {b})" for a, b in ranges) + ")"


_lock = threading.Lock()


def done_labels(job):
    path = os.path.join(RAW, job + ".jsonl")
    if not os.path.exists(path):
        return set()
    with open(path) as f:
        return {json.loads(line)["label"] for line in f}


def rows(job):
    """[(label, dict-row)] of a finished job."""
    out = []
    with open(os.path.join(RAW, job + ".jsonl")) as f:
        for line in f:
            rec = json.loads(line)
            out += [(rec["label"], dict(zip(rec["columns"], r))) for r in rec["rows"]]
    return out


def query(datasource, sql):
    for attempt in range(5):
        p = subprocess.run(["panda", "clickhouse", "query-raw", "--", datasource, sql],
                           capture_output=True, text=True)
        if p.returncode == 0:
            return json.loads(p.stdout)
        if not any(k in p.stderr.lower() for k in ("timeout", "timed out", "429", "502", "503", "504", "eof", "connection")):
            break  # a SQL error won't fix itself
        time.sleep(10 * (attempt + 1))
    raise RuntimeError(p.stderr.strip()[-800:])


def run(job, sql_file, datasource, items, workers=4):
    """items: [(label, params)]. Appends one jsonl line per label, skipping labels already done."""
    done = done_labels(job)
    todo = [(lab, prm) for lab, prm in items if lab not in done]
    tmpl = open(os.path.join(HERE, sql_file)).read()
    os.makedirs(RAW, exist_ok=True)
    print(f"{job}: {len(todo)} to run, {len(done)} cached", flush=True)

    def one(item):
        label, params = item
        t = time.time()
        res = query(datasource, tmpl.format(**CONST, **params))
        line = json.dumps({"label": label, "columns": res["columns"], "rows": res["rows"]})
        with _lock:
            with open(os.path.join(RAW, job + ".jsonl"), "a") as f:
                f.write(line + "\n")
        print(f"  {job} {label} {len(res['rows'])} rows {time.time() - t:.1f}s", flush=True)

    with ThreadPoolExecutor(workers) as ex:
        list(ex.map(one, todo))


def batches(addrs, n=1500):
    addrs = sorted(addrs)
    for i in range(0, len(addrs), n):
        yield f"b{i // n:03d}", ", ".join(f"'{a}'" for a in addrs[i:i + n])


def main(only):
    raw, refined = "clickhouse-raw", "clickhouse-refined"
    chunk_items = [(f"{a}-{b}", {"R": rng(a, b)}) for a, b in CHUNKS]
    win = {"R": rng(*WINDOW)}
    jobs = {
        "blocks_meta":    lambda: run("blocks_meta", "blocks_meta.sql", raw, [("all", {"BLOCKS": ", ".join(
            str(b) for b in sorted({a for a, _ in CHUNKS} | {a for a, _ in ERAS} | set(WINDOW)))})], 1),
        "gates":          lambda: run("gates", "gates.sql", raw, chunk_items),
        "access_totals":  lambda: run("access_totals", "access_totals.sql", raw, chunk_items),
        "write_totals":   lambda: run("write_totals", "write_totals.sql", raw, chunk_items),
        "tx_savings":     lambda: run("tx_savings", "tx_savings.sql", raw, chunk_items),
        "paths_reads":    lambda: run("paths_reads", "paths_reads.sql", raw, chunk_items),
        "paths_writes":   lambda: run("paths_writes", "paths_writes.sql", raw, chunk_items),
        "creations":      lambda: run("creations", "creations.sql", raw, chunk_items),
        "hist":           lambda: run("hist", "hist.sql", raw, chunk_items),
        "top_contracts":  lambda: run("top_contracts", "top_contracts.sql", raw, chunk_items),
        "top_targets":    lambda: run("top_targets", "top_targets.sql", raw, chunk_items),
        "top_proxies":    lambda: run("top_proxies", "top_proxies.sql", raw, chunk_items),
        "trend_writes":   lambda: run("trend_writes", "trend_writes.sql", raw, [("eras", {"R": rngs(ERAS)})], 1),
        "creations_eras": lambda: run("creations_eras", "creations.sql", raw, [("eras", {"R": rngs(ERAS)})], 1),
        "warm8289":       lambda: run("warm8289", "warm8289.sql", raw,
                                      [("window", dict(win, SKIP_FROM=WINDOW[0] + 128))], 1),
        "model_paths":    lambda: run("model_paths", "model_paths.sql", raw, [("model", {"R": rngs(MODEL_WINDOWS)})], 1),
        "delegates":      lambda: run("delegates", "delegates.sql", raw,
                                      [("window", dict(win, T_END="2026-10-30"))], 1),
        "state_prefix":   lambda: run("state_prefix", "state_prefix.sql", refined,
                                      [(f"0x{p:02x}", {"PREFIX": f"0x{p:02x}"}) for p in range(256)], 3),
        "state_n":        lambda: run("state_n", "state_n.sql", refined,
                                      [(f"0x{p:02x}", {"PREFIX": f"0x{p:02x}"}) for p in range(256)], 3),
        "c3_accessed":    lambda: run("c3_accessed", "c3_accessed.sql", raw,
                                      [(p, dict(win, PREFIX=p)) for p in C3_PREFIXES], 2),
        "active_slots":   lambda: run("active_slots", "active_slots.sql", refined, [
            (lab, {"ADDRS": lst, "X": WINDOW[1]}) for lab, lst in
            batches({r["a"] for _, r in rows("model_paths")})], 2),
        "c3_live_header": lambda: run("c3_live_header", "c3_live_header.sql", refined, [
            (lab, {"ADDRS": lst, "X": WINDOW[1]}) for lab, lst in
            batches({r["a"] for _, r in rows("c3_accessed")})], 2),
    }
    for name, fn in jobs.items():
        if not only or name in only:
            fn()


if __name__ == "__main__":
    main(set(sys.argv[1:]))
