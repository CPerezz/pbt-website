#!/usr/bin/env python3
"""Publish gate for uploads/devnets and devnets/ (everything here goes live on GitHub Pages): no local paths, no name of
the private dataset repo, every JSON file the pages reference exists and parses with the contract's top-level keys, and —
when the catalog's export script is reachable — a fresh export is byte-identical. Run before pushing:
python3 uploads/devnets/check.py"""
import filecmp, json, os, re, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
PAGE = os.path.normpath(f"{HERE}/../../devnets")
EXPORT = os.path.expanduser("~/dev/pbt-devnet-1-watch/report/export_site.py")
PY = os.path.expanduser("~/dev/pbt-devnet-1-watch/report/.venv/bin/python")
LEAK = re.compile(r"(?<![\w<>.!-])/(mnt|opt|home|etc|usr|var|srv|root|Users|tmp)/")
PRIVATE = re.compile("pbt-devnet-1-" + "data", re.I)  # the dataset repo's name must not appear on the site
KEYS = {
    "devnet.json": {"window", "fork", "nodes", "roots", "load", "hosts", "eip7870", "state"},
    "timeline.json": {"t0", "t1", "fork_t", "xen_t", "lanes"},
    "methods.json": {"runs", "projection"},
    "validating.json": {"states", "grid", "ratio", "hourly", "replay"},
    "cost.json": {"states", "machines", "memory", "disk"},
    "fork.json": {"fork_t", "series", "first10", "after"},
    "network.json": {"hourly", "valid_share", "totals", "pause", "ledger", "fixes"},
}

fail = []
for base in (HERE, PAGE):
    for root, dirs, files in os.walk(base):
        dirs[:] = [d for d in dirs if d != "__pycache__"]
        for f in files:
            p = os.path.join(root, f)
            if f.endswith((".png", ".jpg", ".webp")):
                continue
            txt = open(p, errors="ignore").read()
            for rx, what in ((LEAK, "local path"), (PRIVATE, "private repo name")):
                m = rx.search(txt)
                if m:
                    fail.append(f"{what} {m.group(0)!r} in {os.path.relpath(p, base)}")
for devnet in sorted(d for d in os.listdir(HERE) if os.path.isdir(f"{HERE}/{d}")):
    d = f"{HERE}/{devnet}"
    for name, keys in KEYS.items():
        p = f"{d}/{name}"
        if not os.path.exists(p):
            fail.append(f"{devnet}: missing {name}")
            continue
        try:
            obj = json.load(open(p))
        except ValueError as e:
            fail.append(f"{devnet}/{name}: {e}")
            continue
        missing = keys - set(obj)
        if missing:
            fail.append(f"{devnet}/{name}: missing keys {sorted(missing)}")
        if "_views" not in obj:
            fail.append(f"{devnet}/{name}: no _views")
    # Every data file a page module names must exist.
    page = f"{PAGE}/{devnet}"
    if os.path.isdir(page):
        for f in os.listdir(page):
            if f.endswith(".js"):
                for ref in set(re.findall(r"'([\w-]+\.json)'", open(f"{page}/{f}").read())):
                    if not os.path.exists(f"{d}/{ref}"):
                        fail.append(f"{devnet}/{f} references missing {ref}")
    total = sum(os.path.getsize(f"{d}/{f}") for f in os.listdir(d) if f.endswith(".json"))
    if total > 1.5e6:
        fail.append(f"{devnet}: JSON total {total / 1e6:.2f} MB > 1.5 MB")
    if os.path.exists(EXPORT) and os.path.exists(PY):
        with tempfile.TemporaryDirectory() as tmp:
            r = subprocess.run([PY, EXPORT, "--out", tmp], capture_output=True, text=True)
            if r.returncode:
                fail.append(f"{devnet}: export failed: {r.stderr.strip().splitlines()[-1] if r.stderr.strip() else r.returncode}")
            else:
                for f in sorted(os.listdir(tmp)):
                    if not os.path.exists(f"{d}/{f}") or not filecmp.cmp(f"{tmp}/{f}", f"{d}/{f}", shallow=False):
                        fail.append(f"{devnet}/{f} is stale: rerun export_site.py")
print("\n".join(fail) or "ok")
sys.exit(bool(fail))
