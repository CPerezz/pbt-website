#!/usr/bin/env python3
"""Turn ../data/raw/*.jsonl (written by run.py) into ../data/summary.json, the only file the article reads.

    python3 analyze.py

Every published value is {"v": value, "src": [raw file, query file]} so the page can link each number to the data
and the SQL behind it. Stdlib only.
"""
import json
import math
import os
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
RAW = os.path.join(DATA, "raw")

# Exact counts from our EIP-8347 mainnet snapshot pair (copied from pbt-bench-export/round2/pair-meta.json).
SNAPSHOT_META = "snapshot-pair-meta.json"
_snap = json.load(open(os.path.join(DATA, SNAPSHOT_META)))
ACCOUNTS, BUCKETS, SNAPSHOT_BLOCK = _snap["headerCount"], _snap["storageCount"], _snap["block"]
MODEL_BLOCKS = 1_000
WINDOW_BLOCKS = 14_400
C3_SCALE = 64  # c3 samples 4 of 256 address prefixes
USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7"
NS = (2, 4, 16, 32, 64, 128, 192, 256)


def rows(job):
    out = []
    with open(os.path.join(RAW, job + ".jsonl")) as f:
        for line in f:
            rec = json.loads(line)
            out += [(rec["label"], {k: num(v) for k, v in zip(rec["columns"], r)}) for r in rec["rows"]]
    return out


def num(v):
    if isinstance(v, str):
        try:
            return int(v)
        except ValueError:
            try:
                return float(v)
            except ValueError:
                return v
    return v


def total(job, *keys):
    t = defaultdict(float)
    for _, r in rows(job):
        for k in keys or r.keys():
            if isinstance(r.get(k), (int, float)):
                t[k] += r[k]
    return t


def val(v, *jobs, digits=None):
    if digits is not None:
        if isinstance(v, float):
            v = round(v, digits)
        elif isinstance(v, list):
            v = [round(x, digits) if isinstance(x, float) else x for x in v]
    return {"v": v, "src": [f"raw/{j}.jsonl" for j in jobs]}


def main():
    s = {}

    # ---- windows and gates ------------------------------------------------------------------------------------------
    dates = {}
    for _, r in rows("blocks_meta"):
        dates[r["block_number"]] = r["t"][:10]
    chunks = sorted(lab for lab, _ in rows("gates"))
    g = total("gates")
    first = int(chunks[0].split("-")[0])
    last = int(chunks[-1].split("-")[1])
    blocks = 1_000 * len(chunks)
    s["meta"] = {
        "chunks": val(len(chunks), "gates"), "blocks": val(blocks, "gates"),
        "from_block": val(first, "gates"), "to_block": val(last, "gates"),
        "from_date": val(dates.get(first, ""), "blocks_meta"), "to_date": val(dates.get(last - 999, ""), "blocks_meta"),
        # tx and charge counts come from the deduplicated jobs (gates only checks completeness).
        "txs": val(int(total("tx_savings")["txs"]), "tx_savings"),
        "reads": val(int(total("access_totals")["accesses"]), "access_totals"),
        "gate_diffs_missing": val(int(g["diffs_missing_from_reads"]), "gates"),
        "gate_txs_missing": val(int(g["txs_missing_balance_reads"]), "gates"),
        "accounts": {"v": ACCOUNTS, "src": [SNAPSHOT_META]}, "buckets": {"v": BUCKETS, "src": [SNAPSHOT_META]},
        "snapshot_block": {"v": SNAPSHOT_BLOCK, "src": [SNAPSHOT_META]},
    }

    # ---- A1: reads -----------------------------------------------------------------------------------------------
    at = total("access_totals")
    ts = total("tx_savings")
    gas = ts["gas"]
    hdr = at["hdr64"]
    s["a1"] = {
        "charges": val(int(at["accesses"]), "access_totals"),
        "hdr": val(int(hdr), "access_totals"),
        "hdr_share": val(hdr / at["accesses"], "access_totals", digits=4),
        "usdt_share": val(at["hdr64_usdt"] / hdr, "access_totals", digits=4),
        "gas": val(gas, "tx_savings"),
        "gas_per_block": val(gas / blocks, "tx_savings", digits=0),
        "txs_per_block": val(ts["txs"] / blocks, "tx_savings", digits=1),
        "txs_hdr_share": val(ts["txs_hdr"] / ts["txs"], "tx_savings", digits=4),
        "saved_r0": val(2100 * hdr / gas, "access_totals", "tx_savings", digits=4),
        "saved_r100": val(2000 * hdr / gas, "access_totals", "tx_savings", digits=4),
        "saved_r200": val(1900 * hdr / gas, "access_totals", "tx_savings", digits=4),
        "saved_r100_nousdt": val(2000 * ts["hdr_access_nousdt"] / gas, "tx_savings", digits=4),
    }
    w = rows("warm8289")[0][1]
    s["a1"]["warm8"] = val(w["warm8"] / w["hdr_charges"], "warm8289", digits=4)
    s["a1"]["warm32"] = val(w["warm32"] / w["hdr_charges"], "warm8289", digits=4)
    s["a1"]["warm128"] = val(w["warm128"] / w["hdr_charges"], "warm8289", digits=4)
    s["a1"]["saved_r100_after_8289"] = val(2000 * hdr / gas * (1 - w["warm32"] / w["hdr_charges"]),
                                           "access_totals", "tx_savings", "warm8289", digits=4)

    pr = total("paths_reads")
    s["a1"].update({
        "header_stems_pb": val(pr["header_stems"] / blocks, "paths_reads", digits=1),
        "storage_accounts_pb": val(pr["storage_accounts"] / blocks, "paths_reads", digits=1),
        "slots_pb": val(pr["slots"] / blocks, "paths_reads", digits=1),
        "hdr_slots_pb": val(pr["hdr_slots"] / blocks, "paths_reads", digits=1),
        "paths_saved_pb": val(pr["s64"] / blocks, "paths_reads", digits=1),
        "paths_saved_alone_pb": val(pr["s64_no_other"] / blocks, "paths_reads", digits=1),
        "zone_paths_pb": val(pr["zone_paths_8297"] / blocks, "paths_reads", digits=1),
        "zone_paths_no_header_pb": val(pr["zone_paths_no_header"] / blocks, "paths_reads", digits=1),
        "zone_paths_cut": val(1 - pr["zone_paths_8297"] / pr["zone_paths_no_header"], "paths_reads", digits=4),
        "buckets_pb": val(pr["buckets_8297"] / blocks, "paths_reads", digits=1),
    })
    p50 = sorted(r["s64_p50"] for _, r in rows("paths_reads"))
    s["a1"]["paths_saved_p50_range"] = val([p50[0], p50[len(p50) // 2], p50[-1]], "paths_reads")

    # Witness model: the siblings a block witness no longer carries because a header-slot read opens no new path.
    act = {r["a"]: r["slots"] for _, r in rows("active_slots")}
    lb, la = math.log2(BUCKETS), math.log2(ACCOUNTS)

    def siblings(r, lg):
        g0 = r["g0_alone"] * (1 + lb + lg) - r["g0_alone_log2k"] + max(0.0, r["g0_with"] * lg - r["g0_with_log2g"])
        extra = max(0, r["px_alone_slots"] - r["px_alone"])
        px = (r["px_alone"] * (1 + lb + lg) - r["px_alone_log2k"] + extra * lg
              + max(0.0, r["px_with_slots"] * lg - r["px_with_log2g"]))
        return g0, px

    sib = {"hi": [0.0, 0.0], "lo": [0.0, 0.0]}
    pairs_g0 = pairs_px = 0
    for _, r in rows("model_paths"):
        n = act.get(r["a"], 1)
        for key, groups in (("hi", max(1, n)), ("lo", max(1, n - 64))):
            g0, px = siblings(r, math.log2(groups))
            sib[key][0] += g0
            sib[key][1] += px
        pairs_g0 += r["g0_alone"] + r["g0_with"]
        pairs_px += r["px_alone_slots"] + r["px_with_slots"]
    kb = lambda x: 32 * x / MODEL_BLOCKS / 1024
    s["model"] = {
        "header_path": val(2 + la, digits=1), "bucket_path": val(1 + lb, digits=1),
        "a1_kb_pb": val([kb(sib["lo"][0]), kb(sib["hi"][0])], "model_paths", "active_slots", digits=1),
        "a1_bytes_per_path": val([32 * sib["lo"][0] / max(1, pairs_g0), 32 * sib["hi"][0] / max(1, pairs_g0)],
                                 "model_paths", "active_slots", digits=0),
        "c2_kb_pb": val([kb(sib["lo"][1]), kb(sib["hi"][1])], "model_paths", "active_slots", digits=1),
        "c2_bytes_per_slot": val([32 * sib["lo"][1] / max(1, pairs_px), 32 * sib["hi"][1] / max(1, pairs_px)],
                                 "model_paths", "active_slots", digits=0),
    }

    # ---- A2: writes ----------------------------------------------------------------------------------------------
    wt = total("write_totals")
    s["a2"] = {
        "hdr_writes": val(int(wt["hdr_writes64"]), "write_totals"),
        "hdr_changes_share": val(wt["hdr_changes64"] / wt["changes_all"], "write_totals", digits=4),
        "creates_share": val(wt["hdr_creates64"] / wt["hdr_writes64"], "write_totals", digits=4),
        "pairs": val(int(wt["pairs64"]), "write_totals"),
        "pairs_2plus": val(wt["pairs64_2plus"] / wt["pairs64"], "write_totals", digits=4),
        "pairs_dirty": val(wt["pairs64_dirty"] / wt["pairs64"], "write_totals", digits=4),
        "disc": val(int(wt["disc64"]), "write_totals"),
        "disc_share": val(wt["disc64"] / wt["hdr_changes64"], "write_totals", digits=4),
    }
    for p in (0, 100, 500, 1000):
        s["a2"][f"saved_w{p}"] = val((2900 - p) * wt["disc64"] / gas, "write_totals", "tx_savings", digits=4)

    # ---- A3: the full rule ---------------------------------------------------------------------------------------
    grid = []
    for pr_ in (0, 100, 200):
        for pw in (0, 100, 500, 1000):
            grid.append({"p_read": pr_, "p_write": pw,
                         "share": round(((2100 - pr_) * hdr + (2900 - pw) * wt["disc64"]) / gas, 4)})
    default = (2000 * hdr + 2800 * wt["disc64"]) / gas
    nousdt = (2000 * ts["hdr_access_nousdt"] + 2800 * ts["disc_nousdt"]) / gas
    bins = ["b0", "b1", "b2", "b5", "b10", "b20", "b100"]
    per_chunk = []
    for lab, r in sorted(rows("tx_savings")):
        a = int(lab.split("-")[0])
        per_chunk.append({"block": a, "date": dates.get(a, ""),
                          "share": round((2000 * r["hdr_access"] + 2800 * r["disc"]) / r["gas"], 4)})
    shares = sorted(c["share"] for c in per_chunk)
    s["a3"] = {
        "grid": val(grid, "access_totals", "write_totals", "tx_savings"),
        "default": val(default, "tx_savings", digits=4),
        "default_nousdt": val(nousdt, "tx_savings", digits=4),
        "more_txs": val(default / (1 - default), "tx_savings", digits=4),
        "txs_gain": val(ts["txs_gain"] / ts["txs"], "tx_savings", digits=4),
        "bins": val({b: int(ts[b]) for b in bins}, "tx_savings"),
        "per_chunk": val(per_chunk, "tx_savings", "blocks_meta"),
        "chunk_range": val([shares[0], shares[len(shares) // 2], shares[-1]], "tx_savings"),
    }
    top = defaultdict(lambda: [0, 0, ""])
    for _, r in rows("top_contracts"):
        t = top[r["a"]]
        t[0] += r["hdr_access"]
        t[1] = max(t[1], r["hdr_slots_used"])
        t[2] = t[2] or r["top_slots"]
    s["a3"]["top_contracts"] = val([{"a": a, "share": round(v[0] / hdr, 4), "slots_used": v[1], "top_slots": v[2]}
                                    for a, v in sorted(top.items(), key=lambda kv: -kv[1][0])[:15]], "top_contracts")
    tgt = defaultdict(lambda: [0, 0, 0])
    for _, r in rows("top_targets"):
        t = tgt[r["target"]]
        t[0] += r["saved"]
        t[1] += r["txs"]
        t[2] += r["gas"]
    saved_total = 2000 * hdr + 2800 * wt["disc64"]
    s["a3"]["top_targets"] = val([{"a": a, "share_of_saving": round(v[0] / saved_total, 4), "txs": v[1],
                                   "their_gas_saved": round(v[0] / v[2], 4) if v[2] else 0}
                                  for a, v in sorted(tgt.items(), key=lambda kv: -kv[1][0])[:15]], "top_targets")

    # ---- B1: one path instead of two -----------------------------------------------------------------------------
    pw_ = total("paths_writes")
    dirty_8297 = pw_["header_changed"] + pw_["header_dirty_by_slots64"] + pw_["zone_groups_other"] + pw_["g0_zone_8297"]
    s["b1"] = {
        "shared_pb": val(pw_["shared64"] / blocks, "paths_writes", digits=2),
        "split_pb": val(pw_["split64"] / blocks, "paths_writes", digits=2),
        "net_pb": val((pw_["shared64"] - pw_["split64"]) / blocks, "paths_writes", digits=2),
        "dirty_pb": val(dirty_8297 / blocks, "paths_writes", digits=0),
        "net_share": val((pw_["shared64"] - pw_["split64"]) / dirty_8297, "paths_writes", digits=5),
        "header_changed_pb": val(pw_["header_changed"] / blocks, "paths_writes", digits=0),
        "hdr_only_pb": val(pw_["header_dirty_by_slots64"] / blocks, "paths_writes", digits=1),
    }
    hw = (pw_["header_changed"] + pw_["header_dirty_by_slots64"]) / blocks
    kw = (pw_["zone_groups_other"] + pw_["g0_zone_8297"]) / blocks
    # Hashes per path: a shared write saves the contract's group-0 path below the part shared with the block's other
    # storage paths (log2 kw levels); a split write adds a header path below the shared top (log2 hw). The bucket
    # depth of the "shared" contracts (log2 groups) comes from the model windows; the counts from the full window.
    mw = [r for _, r in rows("model_writes")]
    sh = sum(r["shared64"] for r in mw)
    lg_sh = sum(r["shared64"] * math.log2(max(1, act.get(r["a"], 1))) for r in mw) / max(1, sh)
    save_path = 1 + lb + lg_sh - math.log2(kw)
    cost_path = 2 + la - math.log2(hw)
    s["b1"]["hashes_saved_path"] = val(save_path, "model_writes", "active_slots", "paths_writes", digits=1)
    s["b1"]["hashes_added_path"] = val(cost_path, "paths_writes", digits=1)
    s["b1"]["hashes_pb"] = val((pw_["shared64"] * save_path - pw_["split64"] * cost_path) / blocks,
                               "paths_writes", "model_writes", "active_slots", digits=1)
    s["b1"]["hashes_total_pb"] = val(hw * cost_path + kw * (save_path), "paths_writes", digits=0)
    split_top = sorted(mw, key=lambda r: -r["split64"])[:5]
    s["b1"]["split_top"] = val([{"a": r["a"], "split": r["split64"]} for r in split_top], "model_writes")

    # ---- B2: contracts that live in their header -----------------------------------------------------------------
    cr = total("creations")
    holding = cr["header_only"] + cr["zone_only"] + cr["both"]
    s["b2"] = {
        "creations": val(int(cr["creations"]), "creations"),
        "no_storage": val(cr["no_storage"] / cr["creations"], "creations", digits=4),
        "header_only": val(cr["header_only"] / holding, "creations", digits=4),
        "zone_only": val(cr["zone_only"] / holding, "creations", digits=4),
        "both": val(cr["both"] / holding, "creations", digits=4),
    }
    eras = []
    for _, r in rows("creations_eras"):
        hold = r["header_only"] + r["zone_only"] + r["both"]
        if hold:
            eras.append({"mblock": r["mblock"], "header_only": round(r["header_only"] / hold, 4), "n": hold})
    s["b2"]["eras"] = val(eras, "creations_eras")
    st = defaultdict(float)
    hist_h = defaultdict(int)
    for _, r in rows("state_prefix"):
        st["contracts"] += r["contracts"]
        st["hdr_slots"] += r["h"] * r["contracts"]
        st["zone_slots"] += r["zone_slots"]
        st["zone_groups"] += r["zone_groups"]
        if r["has_bucket"]:
            st["with_bucket"] += r["contracts"]
        if r["h"] > 0:
            hist_h[r["h"]] += r["contracts"]
    s["b2"].update({
        "contracts": val(int(st["contracts"]), "state_prefix"),
        "no_bucket": val(1 - st["with_bucket"] / st["contracts"], "state_prefix", digits=4),
        "with_bucket": val(int(st["with_bucket"]), "state_prefix"),
        "hdr_slots": val(int(st["hdr_slots"]), "state_prefix"),
        "zone_slots": val(int(st["zone_slots"]), "state_prefix"),
        "hdr_slots_share": val(st["hdr_slots"] / (st["hdr_slots"] + st["zone_slots"]), "state_prefix", digits=4),
        "zone_groups": val(int(st["zone_groups"]), "state_prefix"),
        "hist_h": val([[h, hist_h[h]] for h in sorted(hist_h)], "state_prefix"),
    })
    nh = sum(hist_h.values())
    s["b2"]["h_eq1"] = val(hist_h.get(1, 0), "state_prefix")
    s["b2"]["h_le4_share"] = val(sum(n for k, n in hist_h.items() if k <= 4) / nh, "state_prefix", digits=4)
    wavg = lambda xs: sum(r["header_only"] * r["n"] for r in xs) / max(1, sum(r["n"] for r in xs))
    s["b2"]["create_early"] = val(wavg([r for r in eras if r["mblock"] <= 14]), "creations_eras", digits=4)
    s["b2"]["create_late"] = val(wavg([r for r in eras if r["mblock"] >= 22]), "creations_eras", digits=4)

    # ---- C1: how many header slots -------------------------------------------------------------------------------
    sweep = []
    for n in NS:
        row = {"n": n,
               "paths_pb": round(pr[f"s{n}"] / blocks, 1),
               "write_net_pb": round((pw_[f"shared{n}"] - pw_.get(f"split{n}", 0)) / blocks, 2),
               "a1": round(2000 * at[f"hdr{n}"] / gas, 4),
               "a2": round(2800 * wt[f"disc{n}"] / gas, 4) if f"disc{n}" in wt else None}
        sweep.append(row)
    hist = {"read": [0] * 256, "write": [0] * 256}
    for _, r in rows("hist"):
        hist[r["kind"]][r["idx"]] += r["n"]
    reads256 = sum(hist["read"])
    s["c1"] = {"sweep": val(sweep, "paths_reads", "paths_writes", "access_totals", "write_totals", "tx_savings"),
               "hist": val(hist, "hist"),
               "below4": val(sum(hist["read"][:4]) / reads256, "hist", digits=4),
               "below16": val(sum(hist["read"][:16]) / reads256, "hist", digits=4),
               "below64": val(sum(hist["read"][:64]) / reads256, "hist", digits=4),
               "n4_vs_64": val(at["hdr4"] / at["hdr64"], "access_totals", digits=4),
               "n64_vs_256": val(at["hdr64"] / at["hdr256"], "access_totals", digits=4),
               "paths_n64_vs_256": val(pr["s64"] / pr["s256"], "paths_reads", digits=4)}

    # ---- C2: proxy slots -----------------------------------------------------------------------------------------
    pxt = defaultdict(int)
    for _, r in rows("top_proxies"):
        pxt[r["a"]] += r["proxy_access"]
    s["c2"] = {
        "charges": val(int(at["proxy"]), "access_totals"),
        "share": val(at["proxy"] / at["accesses"], "access_totals", digits=4),
        "paths_pb": val(pr["px_paths"] / blocks, "paths_reads", digits=1),
        "contracts_pb": val(pr["px_contracts"] / blocks, "paths_reads", digits=1),
        "whole_bucket_pb": val(pr["px_whole_bucket"] / blocks, "paths_reads", digits=1),
        "gas": val(2000 * at["proxy"] / gas, "access_totals", "tx_savings", digits=4),
        "top": val([{"a": a, "share": round(n / at["proxy"], 4)}
                    for a, n in sorted(pxt.items(), key=lambda kv: -kv[1])[:10]], "top_proxies"),
    }

    # ---- C3: one flat record per header --------------------------------------------------------------------------
    blk = {r["a"]: r["blocks"] for _, r in rows("c3_accessed")}
    hh = {r["a"]: r["h"] for _, r in rows("c3_live_header")}
    reads = sum(blk.values())
    carried = sum(n * hh.get(a, 0) for a, n in blk.items())
    with_slots = sum(n for a, n in blk.items() if hh.get(a, 0) > 0)
    s["c3"] = {
        "lookups_saved_pb": val(pr["hdr_slots"] / blocks, "paths_reads", digits=1),
        "lookups_share": val(pr["hdr_slots"] / pr["slots"], "paths_reads", digits=4),
        "account_reads_pb": val(pr["header_stems"] / blocks, "paths_reads", digits=0),
        "sample_reads_pb": val(reads / WINDOW_BLOCKS * C3_SCALE, "c3_accessed", digits=0),
        "reads_with_slots": val(with_slots / reads, "c3_accessed", "c3_live_header", digits=4),
        "bytes_per_read": val(32 * carried / reads, "c3_accessed", "c3_live_header", digits=1),
        "kb_pb": val(32 * carried / WINDOW_BLOCKS * C3_SCALE / 1024, "c3_accessed", "c3_live_header", digits=1),
        "kb_pb_actual": val(32 * carried / reads * pr["header_stems"] / blocks / 1024,
                            "c3_accessed", "c3_live_header", "paths_reads", digits=1),
    }

    # ---- D1: trend ----------------------------------------------------------------------------------------------
    s["d1"] = {
        "eras": val([{"mblock": r["mblock"], "share": round(r["hdr_writes"] / r["writes"], 4), "writes": r["writes"]}
                     for _, r in rows("trend_writes") if r["writes"]], "trend_writes"),
        "reads_by_chunk": val([{"block": int(lab.split("-")[0]), "date": dates.get(int(lab.split("-")[0]), ""),
                                "share": round(r["hdr64"] / r["accesses"], 4)}
                               for lab, r in sorted(rows("access_totals"))], "access_totals", "blocks_meta"),
        "reads_range": val(sorted(r["hdr64"] / r["accesses"] for _, r in rows("access_totals"))[::80],
                           "access_totals", digits=4),
    }
    tw = [r for _, r in rows("trend_writes") if r["writes"]]
    era = lambda lo, hi: sum(r["hdr_writes"] for r in tw if lo <= r["mblock"] <= hi) / sum(
        r["writes"] for r in tw if lo <= r["mblock"] <= hi)
    s["d1"]["writes_2017_2020"] = val(era(4, 10), "trend_writes", digits=4)
    s["d1"]["writes_since_2021"] = val(era(11, 26), "trend_writes", digits=4)
    s["d1"]["writes_recent"] = val(era(24, 26), "trend_writes", digits=4)

    # ---- D2: EIP-7702 accounts ----------------------------------------------------------------------------------
    dg = [r for _, r in rows("delegates")]
    sw = sum(r["slot_writes"] for r in dg)
    s["d2"] = {
        "delegated": val(dg[0]["delegated_eoas"] if dg else 0, "delegates"),
        "slot_writes": val(sw, "delegates"),
        "hdr_share": val(sum(r["hdr_writes"] for r in dg) / sw if sw else 0, "delegates", digits=4),
        "nonce_share": val(sum(r["writes_with_nonce_change"] for r in dg) / sw if sw else 0, "delegates", digits=4),
        "targets": val(len(dg), "delegates"),
        "top": val([{"a": r["target"], "accounts": r["accounts"], "writes": r["slot_writes"],
                     "hdr_share": round(r["hdr_writes"] / r["slot_writes"], 4)} for r in dg[:10]], "delegates"),
    }

    labels_path = os.path.join(DATA, "labels.json")
    if os.path.exists(labels_path):
        s["labels"] = json.load(open(labels_path))
    with open(os.path.join(DATA, "summary.json"), "w") as f:
        json.dump(s, f, indent=1)
    print(json.dumps({k: {kk: vv["v"] for kk, vv in v.items() if isinstance(vv, dict) and "v" in vv
                          and not isinstance(vv["v"], (list, dict))} for k, v in s.items() if k != "labels"}, indent=1))


if __name__ == "__main__":
    main()
