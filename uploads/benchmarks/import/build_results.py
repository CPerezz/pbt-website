#!/usr/bin/env python3
"""Builds <round>/results.json, everything the import page reads for one round, from the round's raw files and its
entry in rounds.json. Usage, from this folder: python3 build_results.py r1"""
import csv, json, os, re, sys
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
GIB = 2 ** 30


def iso(ts):
    return datetime.strptime(ts, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp()


def unit(u, seconds):
    return {"cpu_s": round(u["cpu_seconds"]), "avg_cores": round(u["cpu_seconds"] / seconds, 2),
            "anon_peak_gb": round(u["anon_peak_bytes"] / 1e9, 1), "page_cache_peak_gb": round(u["file_peak_bytes"] / 1e9, 1),
            "test_disk_read_gb": round(u["test_disk_read_bytes"] / 1e9), "test_disk_write_gb": round(u["test_disk_write_bytes"] / 1e9)}


def window(d, client, phase):
    rel = f"{client}/{phase}"
    s = json.load(open(f"{d}/{rel}/summary.json"))
    # The EL service's counters, or `tool` when the step ran as a separate process (summary.json leaves `el` empty).
    u = s["el"] if s["el"]["cpu_seconds"] is not None else s["tool"]
    w = {"phase": phase, "src": f"{rel}/summary.json", "start": s["start"], "end": s["end"], "duration_s": s["seconds"],
         "res": unit(u, s["seconds"]), "thermal": s["thermal"],
         "files": {f[:-4].split("-")[0]: f"{rel}/{f}" for f in ("newpayload.csv", "resources-15s.csv")
                   if os.path.exists(f"{d}/{rel}/{f}")}}
    if s["newPayload_ms"]["n"]:
        w["follow"] = {"blocks": s["blocks"], "head_coverage": s["head_coverage"], "newpayload_ms": s["newPayload_ms"],
                       "mgas_per_s": s["mgas_per_s"], "ms_per_mgas": s["ms_per_mgas"],
                       "head_lag_max_blocks": s["head_lag_blocks"]["max"], "stats_window_s": s["rate_window_seconds"]}
    return w


def stages(d, client, phase, marks, w, root_check):
    rows = list(csv.DictReader(open(f"{d}/{client}/{phase}/stages.csv")))
    first = lambda prefix: next(iso(r["first_utc"]) for r in rows if r["stage"].startswith(prefix))
    starts = [w["start"]] + [first(p) for _, p in marks[1:]]
    w["stages"] = [{"label": l, "start": t, "end": starts[i + 1] if i + 1 < len(starts) else w["end"]}
                   for i, ((l, _), t) in enumerate(zip(marks, starts))]
    w["root_verified"] = any(r["stage"].startswith(root_check) for r in rows)
    w["stages_src"] = f"{client}/{phase}/stages.csv"


def geth_inspect(path):
    out = {}
    for line in open(path):
        m = re.match(r"\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*([\d.]+)\s*(B|KiB|MiB|GiB|TiB)\s*\|\s*(\d+)\s*\|", line)
        if m:
            mult = {"B": 1, "KiB": 2 ** 10, "MiB": 2 ** 20, "GiB": GIB, "TiB": 2 ** 40}[m.group(4)]
            out[f"{m.group(1)} / {m.group(2)}"] = float(m.group(3)) * mult / GIB
        m = re.search(r'unaccounted data\s+size="([\d.]+) GiB"', line)
        if m:
            out["Key-Value store / unaccounted"] = float(m.group(1))
    out["total"] = next(v for k, v in out.items() if k.endswith("/ Total"))
    return out


def besu_rocksdb(path):
    out = {}
    for line in open(path):
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) == 5 and cells[1].isdigit():
            n, u = cells[2].split()
            out[cells[0]] = float(n) * {"GiB": 1, "MiB": 2 ** -10, "KiB": 2 ** -20, "B": 1 / GIB}[u]
    out["total"] = out.pop("ESTIMATED TOTAL")
    return out


def du(path):
    out = {}
    for line in open(path):
        b, p = line.rstrip("\n").split("\t", 1)
        m = re.search(r"nethermind_db/mainnet(?:/([^/]+))?$", p)
        if m:
            out[m.group(1) or "total"] = int(b) / GIB
    return out


def sizes(d, cfg):
    read = {"geth-inspect": geth_inspect, "besu-rocksdb": besu_rocksdb, "du": du}[cfg["kind"]]
    before, after = read(f"{d}/{cfg['before']}"), read(f"{d}/{cfg['after']}")
    parts = [{"label": k.split(" / ")[-1], "gib": round(after.get(k, 0) - before.get(k, 0), 1)} for k in cfg["pbt"]]
    return {"before_gib": round(before["total"], 1), "after_gib": round(after["total"], 1),
            "pbt_gib": round(sum(p["gib"] for p in parts), 1), "pbt_parts": parts, "attributed": cfg["attributed"],
            "src": [cfg["before"], cfg["after"]]}


def build(rid):
    manifest = json.load(open(f"{HERE}/rounds.json"))
    rnd = next(r for r in manifest["rounds"] if r["id"] == rid)
    d = f"{HERE}/{rid}"
    clients = []
    for c in rnd["clients"]:
        imports = []
        for ph in c["imports"]:
            w = window(d, c["id"], ph)
            stages(d, c["id"], ph, c["stages"], w, c["root_check"])
            imports.append(w)
        clients.append({"id": c["id"], "name": c["name"], "builds": c["builds"], "runtime": c["runtime"],
                        "baseline": window(d, c["id"], c["baseline"]), "imports": imports,
                        "sizes": sizes(d, c["sizes"]), "reproduce": c.get("reproduce")})
    return {"round": {k: rnd[k] for k in ("id", "label", "date")}, "rig": manifest["rig"], "pair": rnd["pair"],
            "clients": clients}


if __name__ == "__main__":
    rid = sys.argv[1]
    json.dump(build(rid), open(f"{HERE}/{rid}/results.json", "w"), indent=1)
    print(f"wrote {rid}/results.json")
