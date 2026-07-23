#!/usr/bin/env python3
"""Census the OKX.AI marketplace via `onchainos agent search`.

`--query` is mandatory, so a census is the union of many queries. Broad queries
("a", "the") each return ~the whole marketplace, so this union is a census, not
a sample.

QUERIES is FROZEN — it is recorded inside every output file, and changing it
breaks comparability between dates. If it must change, note it in
Margn/MARGN-VERIFIED.md §7.

Writes: agents-<YYYY-MM-DD>T<HHMM>.json   (consumed by stats.py / probe.py)
"""
import json, subprocess, sys, os, time, datetime

CLI = os.path.expanduser("~/.local/bin/onchainos")
OUT = os.path.dirname(os.path.abspath(__file__))

# 45 queries. Recovered verbatim from the "queries" field of
# agents-2026-07-23.json, which scan.py itself wrote at scan time.
QUERIES = [
    # the 8 needs named in the docs
    "search", "token", "wallet", "audit", "news", "swap", "kline", "image",
    # broadeners
    "agent", "data", "ai", "defi", "nft", "trading", "analysis", "market",
    "price", "chart", "security", "code", "content", "video", "music",
    "translate", "weather", "research", "social", "api", "crypto", "bitcoin",
    "ethereum", "solana", "portfolio", "yield", "signal", "report", "generate",
    "text", "chat", "tool", "service", "finance", "art", "design", "write",
]


def search(query, page):
    """One page of results. Returns (list, total) or (None, None) on failure."""
    try:
        r = subprocess.run(
            [CLI, "agent", "search", "--query", query,
             "--page-size", "100", "--page", str(page)],
            capture_output=True, text=True, timeout=90)
        d = json.loads(r.stdout)
    except Exception as e:
        print(f"  !! {query} p{page}: {e}", file=sys.stderr)
        return None, None
    if not d.get("ok"):
        print(f"  !! {query} p{page}: {d.get('error')}", file=sys.stderr)
        return None, None
    return d["data"].get("list") or [], d["data"].get("total", 0)


def main():
    if not os.path.exists(CLI):
        sys.exit(f"onchainos not found at {CLI} — see README.md")

    agents, hits = {}, {}
    for q in QUERIES:
        page, got = 1, 0
        while True:
            lst, total = search(q, page)
            if lst is None:
                break
            for a in lst:
                agents[str(a["agentId"])] = a
            got += len(lst)
            if page * 100 >= total or not lst:
                break
            page += 1
            time.sleep(0.2)
        hits[q] = got
        print(f"{q:12s} total={got:4d}  cumulative_unique={len(agents)}", file=sys.stderr)
        time.sleep(0.2)

    if not agents:
        sys.exit("no agents collected — is the wallet session still valid? "
                 "run: onchainos wallet status")

    # Timestamped to the minute: a same-day rerun must never overwrite the
    # evidence behind an earlier run's published numbers.
    stamp = datetime.datetime.now().strftime("%Y-%m-%dT%H%M")
    path = os.path.join(OUT, f"agents-{stamp}.json")
    if os.path.exists(path):
        sys.exit(f"refusing to overwrite existing scan: {path}")
    with open(path, "w") as f:
        json.dump({"scanned_at": datetime.datetime.now().isoformat(timespec="seconds"),
                   "queries": QUERIES, "hits": hits, "agents": agents}, f)
    print(f"\nunique agents: {len(agents)} -> {path}", file=sys.stderr)


if __name__ == "__main__":
    main()
