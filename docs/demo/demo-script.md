# Margn — 90-Second Demo Script

Real terminal, no slides. Every command below is confirmed working (24 Jul 2026).
Refer to other people's ASPs **by ID, never by name** — they are fellow
participants (§8 `MARGN-VERIFIED.md`).

Endpoint: `https://margn.margnhq.workers.dev` · ASP `#8646` · all services `fee 0`.

---

## ⚠️ Do this ON RECORDING DAY (not before)

The market moves ~2,000 transactions/day; a target can flip dead↔alive and the
ranking can shift. Run this the morning you record:

```bash
cd research/marketplace-scan
python3 scan.py                                   # fresh timestamped snapshot
python3 matchtest.py    | tee matchtest-$(date +%Y-%m-%dT%H%M).txt   # ranking gap still there?
python3 find-dead-demo-target.py                  # dead-but-online targets valid today
cd ../../endpoint
npm run build:snapshot                            # rebuild Worker snapshot (auto-picks newest scan)
npx wrangler deploy                               # deploy it — URL and registry never change
```

Then re-confirm every target you will show on camera:

```bash
curl -sS -X POST https://margn.margnhq.workers.dev/v1/verify \
  -H 'content-type: application/json' -d '{"agentId":"<DEAD_ID>"}'   # must be alive:false
curl -sS -X POST https://margn.margnhq.workers.dev/v1/verify \
  -H 'content-type: application/json' -d '{"agentId":"<LIVE_ID>"}'   # must be alive:true
```

**Never run `onchainos agent update`** — it re-triggers QA while the listing is
under review. `wrangler deploy` is safe: it changes code behind the same URL, the
on-chain registry is untouched.

**Targets confirmed 24 Jul** (replace if the morning rescan finds cleaner ones):
- Dead: `#5053` or `#4999` — ephemeral tunnels, permanently down, `alive:false`
- Live: `#5524` or `#1500` — confirm `alive:true` before recording

Pick **single-service** agents for `verify`/`check` so the probe resolves
unambiguously to the endpoint you mean. A multi-service agent (e.g. `#3152`,
`#2013`) now returns `AMBIGUOUS_SERVICE` with the list of services instead of
guessing — to target one you must pass `"serviceName":"<exact name>"`. That
refusal is itself a good demo beat ("Margn won't guess across 80 services"), but
for the clean live/dead contrast use a single-service agent.

---

## Beat 1 · 0–15s · The dead provider nobody flags

```bash
curl -sS -X POST https://margn.margnhq.workers.dev/v1/verify \
  -H 'content-type: application/json' -d '{"agentId":"5053"}' | jq 'del(.agent_name)'
```
Shows: `"alive": false … "http_status": 530`. The `jq` drops `agent_name` so a
fellow participant's provider is never shown by name on camera.

> "The platform marks this provider **online**. Margn probes it live — it's dead.
> A buyer would pay for a service that can't run, and nothing tells them."

Then the systematic number (from `find-dead-demo-target.py`):

> "And this isn't one unlucky case. **26 of 563 agents the platform flags as
> online are actually unreachable.** The flag can't be trusted. The only source
> of truth is a live probe."

Quick contrast — a healthy ASP:
```bash
curl -sS -X POST https://margn.margnhq.workers.dev/v1/verify \
  -H 'content-type: application/json' -d '{"agentId":"5524"}' | jq 'del(.agent_name)'
```
> "This one's alive. Binary. Not up for debate."

---

## Beat 2 · 15–50s · The ranking gap — the core evidence

Run OKX's own `asp-match`, full screen, uncut:
```bash
onchainos agent asp-match --task-desc "get latest crypto news headlines"
```

Zoom into two rows (read the exact numbers from that day's `matchtest` run):

> "Rank 3: **$0.55 · security 2.0 · 1 sale.** Rank 5: **$0.01 · security 5.0 ·
> 1,670 sales** — better on every metric OKX measures itself, yet ranked
> *below* it."

> "This is OKX's own API. Run the same command yourself right now."

Systematic:

> "Tested across 7 needs that run cleanly. In **7 of 7**, the best-by-value
> option ranks below a pricier, worse one. Retrieval works. Ranking doesn't
> exist yet."

**Framing:** don't say asp-match is "broken" — retrieval is its job and it works.
What doesn't exist yet is the **ranking layer on top**. Margn is that layer, not
a replacement for asp-match.

---

## Beat 3 · 50–75s · Margn fills the card

A buyer's confirmation card shows only Provider + Price. Margn adds the missing
context.

```bash
curl -sS -X POST https://margn.margnhq.workers.dev/v1/quote \
  -H 'content-type: application/json' -d '{"need":"crypto news"}'
```
Shows: `matches: 56 · min 0 · median 0.1 · max 4`.
> "The market price range for this need: min, median, max — from 56 comparable
> services."

```bash
curl -sS -X POST https://margn.margnhq.workers.dev/v1/check \
  -H 'content-type: application/json' -d '{"agentId":"<LIVE_ID>","price":<PRICE>}' | jq 'del(.agent_name)'
```
> "Combined: alive or dead, plus where the price sits against the market —
> 'Nx above median'. Context, not a 'best' verdict."

Use a **single-service** agent for `check`, and confirm its output on recording
day. Running it on the overpriced rank-3 provider from Beat 2 reinforces the gap
(shows it sitting far above median).

Honesty beat (optional, strong): show a thin market.
```bash
curl -sS -X POST https://margn.margnhq.workers.dev/v1/quote \
  -H 'content-type: application/json' -d '{"need":"summarize a pdf document"}'
```
> "Only one service matches, so Margn flags `low_sample` and says the range is
> indicative — it never fakes confidence it doesn't have."

Then the line that ties it together:

> "The signal was in OKX's API the whole time. Nobody was reading it."

---

## Beat 4 · 75–90s · Close

> "Three tools. `verify` — alive or dead, right now. `quote` — the market price
> range. `check` — both at once. All measured facts, never a quality judgment."

Show Margn is a real, live ASP (if approved: screenshot of the #8646 listing; if
still pending: `onchainos agent service-list --agent-id 8646` showing the three
registered services). Done.

---

## Rules (do not break)

- Real terminal, no slides.
- Other ASPs referred to **by ID**, never by name.
- **Don't** hide probe latency — it's the proof it's real.
- **Don't** say "we fix OKX" → "we read a signal that's already there".
- **Never** use the word "best" anywhere.
- Every number on screen must come from **recording-day** runs, not copied from
  the docs.

## Notes on the tools (already handled)

- `quote` matching is tightened (S4): it requires all query tokens and only
  relaxes when the full-token sample is thin, so `crypto news` returns 56 related
  services (~$4 max), not 415 with a $66 outlier.
- `quote`/`check` return `low_sample` / `market_low_sample` when fewer than five
  services match, so a thin market isn't shown as a confident range.
- `verify` never caches, times out upstream at 5s, and never returns 500.
