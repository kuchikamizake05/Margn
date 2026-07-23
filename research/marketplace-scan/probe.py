#!/usr/bin/env python3
"""Probe A2MCP endpoints for liveness. 402 = healthy x402 service.

Caveat kept deliberately: probes with GET. Some endpoints are POST-only (OKX's
own docs warn about this), so 405/404 overstates breakage — the 402 rate is a
LOWER BOUND on health, never report it as a verdict.
"""
import json, os, sys, glob, collections, random, ssl
import concurrent.futures as cf
import urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
SAMPLE = int(os.environ.get("PROBE_SAMPLE", "300"))
SEED = 7

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE


def probe(item):
    url, meta = item
    req = urllib.request.Request(url, headers={"User-Agent": "margn-probe/0.1"})
    try:
        with urllib.request.urlopen(req, timeout=8, context=ctx) as r:
            return (url, meta, r.status, None)
    except urllib.error.HTTPError as e:
        return (url, meta, e.code, None)
    except Exception as e:
        return (url, meta, None, type(e).__name__)


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else sorted(glob.glob(os.path.join(HERE, "agents-*.json")))[-1]
    d = json.load(open(path))
    agents = d["agents"]

    eps = {}
    for a in agents.values():
        for s in (a.get("services") or []):
            if s.get("endpoint"):
                eps.setdefault(s["endpoint"], (a.get("agentId"), a.get("name"), a.get("onlineStatus")))
    urls = list(eps.items())
    random.seed(SEED)
    random.shuffle(urls)
    urls = urls[:SAMPLE]
    print(f"source: {os.path.basename(path)}")
    print(f"unique endpoints: {len(eps)}, probing {len(urls)} (seed={SEED})")

    with cf.ThreadPoolExecutor(max_workers=40) as ex:
        res = list(ex.map(probe, urls))

    codes = collections.Counter(r[2] if r[2] is not None else f"ERR:{r[3]}" for r in res)
    print("\nSTATUS DISTRIBUTION:")
    for k, v in codes.most_common():
        print(f"  {str(k):24s} {v:4d}  {100*v/len(res):5.1f}%")

    healthy = codes.get(402, 0)
    dead = sum(v for k, v in codes.items() if isinstance(k, str) and k.startswith("ERR"))
    print(f"\n402 (healthy, LOWER BOUND): {healthy}/{len(res)} = {100*healthy/len(res):.1f}%")
    print(f"unreachable:                {dead}/{len(res)} = {100*dead/len(res):.1f}%")

    print("\nonlineStatus vs reachability:")
    for st in (1, 0):
        sub = [r for r in res if r[1][2] == st]
        if sub:
            ok = sum(1 for r in sub if r[2] == 402)
            up = sum(1 for r in sub if r[2] is not None)
            print(f"  onlineStatus={st}: n={len(sub):3d}  402={ok:3d} ({100*ok/len(sub):.0f}%)"
                  f"  any-response={up} ({100*up/len(sub):.0f}%)")


if __name__ == "__main__":
    main()
