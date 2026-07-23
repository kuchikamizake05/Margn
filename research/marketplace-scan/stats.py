#!/usr/bin/env python3
"""Marketplace stats from a scan file. Usage: stats.py [agents-YYYY-MM-DD.json]"""
import json, os, sys, glob, collections

HERE = os.path.dirname(os.path.abspath(__file__))


def load(path=None):
    if path is None:
        cands = sorted(glob.glob(os.path.join(HERE, "agents-*.json")))
        if not cands:
            sys.exit("no agents-*.json found; run scan.py first")
        path = cands[-1]
    with open(path) as f:
        d = json.load(f)
    return path, d


def main():
    path, d = load(sys.argv[1] if len(sys.argv) > 1 else None)
    agents = d["agents"]
    A = list(agents.values())
    n = len(A)
    print(f"SOURCE: {os.path.basename(path)}  scanned_at={d.get('scanned_at')}")
    print(f"UNIQUE AGENTS: {n}")

    svcs = [(a, s) for a in A for s in (a.get("services") or [])]
    print(f"SERVICES: {len(svcs)}")

    off = [a for a in A if a.get("onlineStatus") != 1]
    print(f"\nOFFLINE: {len(off)}/{n} = {100*len(off)/n:.1f}%")

    sold = [(a.get("soldCount") or 0) for a in A]
    zero, tot = sum(1 for s in sold if s == 0), sum(sold)
    print(f"ZERO SALES: {zero}/{n} = {100*zero/n:.1f}%")
    print(f"TOTAL SALES: {tot}")
    top = sorted(A, key=lambda a: -(a.get("soldCount") or 0))[:8]
    print("\nTOP SELLERS:")
    for a in top:
        sc = a.get("soldCount") or 0
        print(f"  {a['name'][:34]:36s} {sc:7d}  {100*sc/tot:5.1f}%")

    for field in ("feedbackRate", "securityRate"):
        vals = [a.get(field) for a in A]
        nn = [v for v in vals if v is not None]
        print(f"\n{field}: present {len(nn)}/{n} ({100*len(nn)/n:.0f}%), null {n-len(nn)}")
        if nn:
            top_val = 100 if field == "feedbackRate" else 5.0
            print(f"  min={min(nn)} max={max(nn)}  below-top: {sum(1 for v in nn if v < top_val)}"
                  f"  at-top: {sum(1 for v in nn if v >= top_val)}")

    cats = collections.Counter(cn for a in A for cn in (a.get("categoryName") or ["<none>"]))
    print("\nCATEGORIES:")
    for k, v in cats.most_common():
        print(f"  {k:30s} {v:4d}  {100*v/n:5.1f}%")

    allp = [float(s["feeAmount"]) for _, s in svcs if s.get("feeAmount") is not None]
    nz = [x for x in allp if x > 0]
    print(f"\nPRICES: n={len(allp)}, free={len(allp)-len(nz)}")
    if nz:
        print(f"  min={min(nz):.8g} max={max(nz):.6g} spread={max(nz)/min(nz):,.0f}x")
        print(f"  most common: {collections.Counter(nz).most_common(5)}")

    st = collections.Counter(s.get("serviceType") for _, s in svcs)
    eps = {s["endpoint"] for _, s in svcs if s.get("endpoint")}
    print(f"\nSERVICE TYPES: {dict(st)}")
    print(f"UNIQUE ENDPOINTS: {len(eps)}")


if __name__ == "__main__":
    main()
