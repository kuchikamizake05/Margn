#!/usr/bin/env python3
"""Test whether `asp-match` ranking ignores value signals, across several needs.

This is the core evidence for Margn: retrieval is good, ranking is absent.
Requires a registered User agent id (role fixed at create).
"""
import json, subprocess, os, time, sys

CLI = os.path.expanduser("~/.local/bin/onchainos")
AGENT = os.environ.get("MARGN_AGENT_ID", "7520")

NEEDS = [
    "get latest crypto news headlines",
    "check a wallet balance on ethereum",
    "audit a smart contract for vulnerabilities",
    "get token price and market data",
    "generate an image from a text prompt",
    "swap tokens on a dex",
    "translate text to another language",
    "analyze a crypto portfolio",
]

# "good enough to trust": platform's own scores, plus proven sales.
MIN_SEC, MIN_FB = 4.5, 90


def rows(need):
    r = subprocess.run([CLI, "agent", "asp-match", "--task-desc", need,
                        "--agent-id", AGENT, "--format", "json"],
                       capture_output=True, text=True, timeout=120)
    d = json.loads(r.stdout)
    if not d.get("ok"):
        print(f"  !! {need}: {d.get('error')}", file=sys.stderr)
        return None
    out = []
    for i, x in enumerate(d["data"]["recommendations"], 1):
        s = x["services"][0]
        out.append({"rank": i, "agent": x["providerAgentId"],
                    "price": float(s["feeAmount"]) if s.get("feeAmount") is not None else None,
                    "fb": x.get("feedbackRate"), "sec": x.get("securityRate"),
                    "sold": x.get("soldCount") or 0, "name": s.get("serviceName")})
    return out


def main():
    print(f"buyer agent: #{AGENT}\n")
    print(f"{'need':<42} {'n':>3} {'top1$':>9} {'cheapest$':>10} {'rank_cheap':>11} {'best_value':>12}")
    print("-" * 95)
    summary, failures = [], 0
    for need in NEEDS:
        rs = rows(need)
        if not rs:
            continue
        priced = [r for r in rs if r["price"] is not None]
        if not priced:
            continue
        cheapest = min(priced, key=lambda r: r["price"])
        good = [r for r in priced
                if (r["sec"] or 0) >= MIN_SEC and (r["fb"] or 0) >= MIN_FB and r["sold"] > 0]
        best = min(good, key=lambda r: r["price"]) if good else None
        blabel = "—" if best is None else "#%s r%d" % (best["agent"], best["rank"])
        print(f"{need:<42} {len(rs):>3} {priced[0]['price']:>9.6g} {cheapest['price']:>10.6g} "
              f"{cheapest['rank']:>11} {blabel:>12}")
        summary.append((need, rs, best))
        time.sleep(0.3)

    print("\n\n=== where the value-best option ranks vs a worse option above it ===")
    for need, rs, best in summary:
        if not best:
            continue
        above = [r for r in rs if r["rank"] < best["rank"] and r["price"] is not None]
        worse = [r for r in above
                 if r["price"] > best["price"] and (r["sec"] is None or r["sec"] < best["sec"])]
        if not worse:
            continue
        failures += 1
        w = max(worse, key=lambda r: r["price"])
        ratio = w["price"] / best["price"] if best["price"] > 0 else float("inf")
        print(f"\n{need}")
        print(f"  best-by-value : #{best['agent']} rank {best['rank']:>2}  ${best['price']:<10.6g}"
              f" sec={best['sec']} fb={best['fb']} sold={best['sold']}")
        print(f"  ranked ABOVE  : #{w['agent']} rank {w['rank']:>2}  ${w['price']:<10.6g}"
              f" sec={w['sec']} fb={w['fb']} sold={w['sold']}   -> {ratio:,.0f}x pricier")

    print(f"\n\nRANKING FAILURES: {failures}/{len(summary)} needs")
    assert failures > 0, "no ranking failure found — re-check the claim before shipping it"


if __name__ == "__main__":
    main()
