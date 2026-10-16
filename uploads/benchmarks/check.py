#!/usr/bin/env python3
"""Publish gate for uploads/benchmarks and benchmarks/ (everything here goes live on GitHub Pages): no local
paths, every round's results.json rebuilds identically, every file it references exists. Run before pushing:
python3 uploads/benchmarks/check.py"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
PAGE = os.path.normpath(f"{HERE}/../../benchmarks")
sys.path.insert(0, f"{HERE}/import")
sys.dont_write_bytecode = True  # a .pyc embeds this machine's absolute path
from build_results import build

LEAK = re.compile(r"(?<![\w<>.!-])/(mnt|opt|home|etc|usr|var|srv|root|Users|tmp)/")
fail = []
for base in (HERE, PAGE):
    for root, dirs, files in os.walk(base):
        dirs[:] = [d for d in dirs if d != "__pycache__"]  # gitignored, never published
        for f in files:
            p = os.path.join(root, f)
            m = LEAK.search(open(p, errors="ignore").read())
            if m:
                fail.append(f"local path {m.group(0)!r} in {os.path.relpath(p, base)}")
for r in json.load(open(f"{HERE}/import/rounds.json"))["rounds"]:
    res = json.loads(json.dumps(build(r["id"])))
    if json.load(open(f"{HERE}/import/{r['id']}/results.json")) != res:
        fail.append(f"{r['id']}/results.json is stale: run build_results.py {r['id']}")
    # results.json paths are relative to import/ (a run may use another round's baseline)
    fail += [f"{r['id']}: missing {x}" for x in re.findall(r'"([\w./-]+\.(?:csv|json|txt))"', json.dumps(res))
             if not os.path.exists(f"{HERE}/import/{x}")]
print("\n".join(fail) or "ok")
sys.exit(bool(fail))
