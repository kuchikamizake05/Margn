# Margn — 90-Second Demo Script

Real terminal, no slides. **Max 90 seconds** (OKX.AI Genesis Hackathon rule).
Narration below is ~140 words (~53s spoken at 160 wpm), leaving ~34s for
commands, zoom, and result holds. Refer to other people's ASPs **by ID, never by
name** — they are fellow participants (§8 `MARGN-VERIFIED.md`).

Endpoint: `https://margn.margnhq.workers.dev` · ASP `#8646` **Listed — eligible
for task recommendations** (approved, `active`) · all services `fee 0`.

---

## ⚠️ Do this ON RECORDING DAY (before you hit record)

The market moves ~2,000 tx/day; a target flips dead↔alive and ranks shift. Every
number and ID you show on camera must come from **that morning's** runs.

```bash
cd research/marketplace-scan
python3 scan.py                                   # fresh timestamped snapshot
python3 matchtest.py | tee matchtest-$(date +%Y-%m-%dT%H%M).txt   # value gap still there? read the real rows
python3 find-dead-demo-target.py                  # dead-but-online targets valid today
cd ../../endpoint
npm run build:snapshot                            # rebuild Worker snapshot (auto-picks newest scan)
npx wrangler deploy                               # deploy — URL and registry never change
```

Then re-confirm **the three exact commands** you will run on camera, and swap the
IDs/prices/service name below to that day's real values:

```bash
# 1) dead probe — must be alive:false
curl -sS -X POST https://margn.margnhq.workers.dev/v1/verify \
  -H 'content-type: application/json' -d '{"agentId":"<DEAD_ID>"}' | jq '{agent_id,alive,http_status,interpretation,latency_ms}'
# 2) the overpriced rank-N provider for the value-gap beat — must resolve (right serviceName) and return a real check
curl -sS -X POST https://margn.margnhq.workers.dev/v1/check \
  -H 'content-type: application/json' \
  -d '{"agentId":"<OVERPRICED_ID>","serviceName":"<EXACT_SERVICE>","need":"<need>","price":<PRICE>}' | jq '{agent_id,http_status,interpretation,platform_scores,market_matches,market_median,price_position}'
```

**Never run `onchainos agent update`** (re-triggers QA). `wrangler deploy` is safe.

**Targets confirmed 24 Jul (re-confirm the morning of):**
- Dead: `#5053` — ephemeral tunnel, `alive:false`, HTTP 530.
- Value gap for "crypto news": `#3152` (overpriced) vs `#2013` (cheaper, better).
  `#3152` is **multi-service** → the check MUST pass an exact `serviceName`, or it
  returns `AMBIGUOUS_SERVICE`. Verify the service name from that day's snapshot.

---

## 0–7s · Context

Screen: the OKX.AI confirmation card (or Margn landing UI).

> "Before an OKX.AI buyer pays, they see a provider and a price. They don't see
> whether the service even works right now."

Focal point on screen: **Know before you pay.**

---

## 7–23s · Dead provider nobody flags

Screen: show the platform's `onlineStatus=1` for the agent, then run:

```bash
curl -sS -X POST https://margn.margnhq.workers.dev/v1/verify \
  -H 'content-type: application/json' -d '{"agentId":"5053"}' | jq '{agent_id,alive,http_status,interpretation,latency_ms}'
```
(The `jq` whitelist also drops `agent_name` — never show a participant's name.)

> "The platform marks agent #5053 online. Margn probes the real endpoint now —
> HTTP 530, unreachable. Twenty-six of 563 online-labeled agents show this gap."

Hold the result on screen ≥2s.

---

## 23–48s · The value-signal gap

Screen: run OKX's own `asp-match`, then zoom to **only the two relevant rows**.

```bash
onchainos agent asp-match --task-desc "get latest crypto news headlines"
```

> "For crypto news, OKX ranks #3152 above #2013 — yet #2013 is ~55× cheaper,
> security 5 versus 2, 1,670 sales versus one. Same pattern across all seven
> testable needs."

Focal callout (use that day's real numbers):

```
#3152   $0.55 · security 2 · 1 sale
#2013   $0.01 · security 5 · 1,670 sales
```

Don't linger on the full table.

---

## 48–74s · The product moment (longest hold — this is Margn)

One `check` — not quote-then-check:

```bash
curl -sS -X POST https://margn.margnhq.workers.dev/v1/check \
  -H 'content-type: application/json' \
  -d '{"agentId":"3152","serviceName":"Crypto News Feed","need":"crypto news","price":0.55}' | jq '{agent_id,http_status,interpretation,platform_scores,market_matches,market_median,price_position}'
```

> "One Margn check adds the missing context: endpoint status, the platform's own
> scores, 56 comparable services, a 0.10 median — and this offer at 5.5× above
> median. Margn doesn't pick a winner. It exposes measurable facts before payment."

This is the frame that must breathe. Let it sit.

---

## 74–90s · Proof and close

Screen: the `#8646` **Listed** listing → Margn landing UI → end card (≥3s).

> "Verify checks liveness. Quote shows the market. Check combines both. Margn is
> live on OKX.AI. Know before you pay."

End card (hold ≥3s):

```
MARGN
Know before you pay.
margn.margnhq.workers.dev
```

---

## Visual direction

- Record **16:9**; terminal font **28–32px** minimum.
- **One focal point per beat**; zoom/callout only on the numbers that matter.
- Commands **pre-typed** — never type a long `curl` live on camera.
- **English subtitles** — the video plays muted in the X feed.
- **Never** show another participant's name (the `jq` whitelists enforce this).
- End card on screen ≥3s.

## Rules (do not break)

- Real terminal, no slides.
- Other ASPs by **ID**, never by name.
- **Don't** hide probe latency — it's the proof it's real.
- **Don't** say "we fix OKX" → "we read a signal that's already there".
- **Never** say "best" — Margn is transparent, it does not rank or recommend.
- Every number on screen comes from **recording-day** runs, not from this doc.

## Cut for time — keep these for the README, not the 90s video

- Healthy-provider (402) contrast — one dead probe is enough.
- A standalone `quote` call — `check` already shows the whole product.
- The `low_sample` thin-market honesty beat (`summarize a pdf document`).

## Tool notes (already handled)

- `quote` requires all query tokens, relaxing only when the full-token sample is
  thin, so `crypto news` returns ~56 related services, not 400+ with an outlier.
- `quote`/`check` flag `low_sample`/`market_low_sample` under five matches.
- `verify` never caches, times out upstream at 5s, never returns 500.
- Multi-service agents return `AMBIGUOUS_SERVICE` unless given an exact
  `serviceName` — Margn never guesses which endpoint you meant.
