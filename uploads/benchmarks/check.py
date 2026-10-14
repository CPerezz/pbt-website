#!/usr/bin/env python3
"""Publish gate for uploads/benchmarks (everything here goes live on GitHub Pages): no local paths, every round's
results.json rebuilds identically, every file it references exists. Run before pushing: python3 uploads/benchmarks/check.py"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, f"{HERE}/import")
from build_results import build

LEAK = re.compile(r"(?<![\w<>.!-])/(mnt|opt|home|etc|usr|var|srv|root|Users|tmp)/")
fail = []
for root, _, files in os.walk(HERE):
    for f in files:
        p = os.path.join(root, f)
        m = LEAK.search(open(p, errors="ignore").read())
        if m:
            fail.append(f"local path {m.group(0)!r} in {os.path.relpath(p, HERE)}")
for r in json.load(open(f"{HERE}/import/rounds.json"))["rounds"]:
    d = f"{HERE}/import/{r['id']}"
    res = json.loads(json.dumps(build(r["id"])))
    if json.load(open(f"{d}/results.json")) != res:
        fail.append(f"{r['id']}/results.json is stale: run build_results.py {r['id']}")
    fail += [f"{r['id']}: missing {x}" for x in re.findall(r'"([\w./-]+\.(?:csv|json|txt))"', json.dumps(res))
             if not os.path.exists(f"{d}/{x}")]
print("\n".join(fail) or "ok")
sys.exit(bool(fail))
