# Margn — Project Context

Handoff context so any agent can continue without re-deriving. Keep this current
when durable facts change; don't record play-by-play or ephemeral state (e.g.
"N commits unpushed").

## What Margn is

A **pre-purchase check for OKX.AI buyers**. When a buyer confirms a purchase they
see only Provider + Price — no liveness, no security score, no market price
range. Margn fills that gap. It is a **layer on top of OKX's `asp-match`**, never
a replacement. Buyer-side. The full pitch is `MARGN-VERIFIED.md` (the submitted
idea).

Core evidence: OKX's `asp-match` retrieves well but does **not rank by value** —
across 7 testable needs, the best-by-value option ranks below a pricier, worse
one every time (7/7). Second evidence: 26 of 563 agents the platform flags
`onlineStatus=1` ("online") are actually dead when probed (~4.6%).

**Principles that must not be broken:** never claim "best" (claim "transparent");
only measured facts (price, liveness, platform's own scores); never cache
liveness (prices may be cached); never position Margn as replacing `asp-match`.

## Status (update when it changes)

- **ASP `#8646` "Margn"** — role ASP, category SOFTWARE_SERVICES, all services
  `fee 0`. Under review by OKX. `create` txHash
  `0x9b8c112e2b69f0f4cc1af06c1eb65381d5566c69086c919392e12ae9f0c23c14`.
- **Worker live:** `https://margn.margnhq.workers.dev` (Cloudflare account
  `amantajati15@gmail.com`, subdomain `margnhq`). Three POST routes:
  `/v1/verify` `/v1/quote` `/v1/check`.
- **Cost so far: $0.** Cloudflare free tier; registration gas is sponsored (a
  $0-balance wallet completed the on-chain create).

### Reading approval status correctly (gotcha)

The **authoritative** signal is `approvalLabel` from
`onchainos agent get-my-agents` (e.g. "Listing under review", "Review not
submitted"). The numeric `approvalStatus` in `agent service-list` is NOT a simple
pending/rejected/approved code — it changes between internal review sub-stages
(seen going 2→3 while still "under review"). Do not infer rejection from the
number; read the label, and check `approvalRemark` for any rejection reason.

## Hard constraints (verified against CLI v4.3.0, not docs)

- **Never run `onchainos agent update` while under review** — it re-triggers QA
  and can reset the queue position. Changing code/snapshot behind the same URL
  via `wrangler deploy` is safe; the on-chain registry is untouched. Only the
  three endpoint URL strings, name, description, avatar, and fees are registered.
- **A2MCP endpoints are plain REST** (POST in, JSON out) — no MCP handshake, no
  x402. Services are `fee 0`, which passes review (verified: agents 6711, 2162).
- **Two gates:** QA runs instantly at `create`; the review queue is at
  `activate`. A bad listing is caught at `create`, not days later.
- **`agent #7520` is role User** and cannot become an ASP (role is fixed at
  create). The ASP is the separate `#8646`.
- Multiple ASPs per wallet are allowed (`pre-check` → `uniqueness: multiple`), so
  a rejected attempt is recoverable.
- Avatars must be uploaded via `onchainos agent upload --file` (external image
  links are rejected).
- `validate-listing` does NOT exist in the CLI — Sako wrote
  `endpoint/scripts/validate-listing.mjs` to replace it.

## Deadline

Submission closes **27 Jul 2026, 23:59 UTC = 28 Jul 06:59 WIB**. Requires: ASP
live (passing review), an X post with a ≤90s demo tagged `#OKXAI`, and the Google
Form. The review queue is the biggest risk and is outside our control; we entered
it early with dated proof (`docs/demo/proof/`).

## Repo layout

- `MARGN-VERIFIED.md` — the submitted idea; every number is measured, reproducible
  from `research/marketplace-scan/`.
- `research/marketplace-scan/` — `scan.py` → `stats.py`/`probe.py`/`matchtest.py`.
  Scans are timestamped to the minute and `scan.py` refuses to overwrite, so
  published numbers always trace to a source file. `find-dead-demo-target.py`
  finds online-but-dead agents.
- `endpoint/` — Cloudflare Worker (Sako's domain). `src/app.ts` is the whole app;
  `data/market-snapshot.json` is the price/agent snapshot; `test/` has the suite
  (50 tests). `npm run build:snapshot` rebuilds the snapshot from the newest
  `agents-*.json`; `npx wrangler deploy` ships it.
- `docs/listing.md` — the exact registered payload for #8646.
- `docs/demo/demo-script.md` — the 90s demo, beat-by-beat, with a recording-day
  prep checklist. Re-measure numbers and re-confirm targets on recording day.
- `docs/brainstorming/` — archived ideas (v1–v5). Ideas 4/5 (profitability /
  margin-at-risk) are Sako's; the submitted idea is the buyer-side check.
- `EXECUTION.md` — the 4-day plan and Diaz/Sako task split.

## Endpoint contract

```
POST /v1/verify  {"agentId":"5053"[,"serviceName":"..."]}          → live probe, never cached, 5s timeout
POST /v1/quote   {"need":"crypto news"}                            → market price range from snapshot
POST /v1/check   {"agentId":"5053","price":0.55[,"need":"...","serviceName":"..."]} → both + price_position vs median
GET  /                                                             → HTML landing page (3 live buttons)
```

- `verify` only probes endpoints present in the snapshot (SSRF-safe); agents
  registered after the last scan return `AGENT_NOT_FOUND`. Refresh the snapshot to
  cover new agents (incl. Margn itself).
- **Multi-service agents never auto-resolve.** If an agent exposes >1 probeable
  service and no `serviceName` is given, verify/check return `AMBIGUOUS_SERVICE`
  with a `services` list (capped at 15, plus `services_total`). Pass an exact
  `serviceName` to target one; a wrong name returns `SERVICE_NOT_FOUND`. This
  replaced the old silent cheapest-service pick — a correctness fix.
- verify/check output includes `platform_scores` (`sold_count`, `feedback_rate`,
  `security_rate`) straight from the snapshot — the "platform's own scores" claim.
- `check` compares against `need` when given, else the resolved service's name.
- `quote`/`check` require ALL query tokens, relaxing to a majority only when the
  full-token sample is < 5, and return `low_sample`/`market_low_sample` when fewer
  than five services match.
- Never returns 500; any error is a 200 with an `error` field.
- `GET /` serves a human landing page (branding + verify/quote/check buttons with
  status badges); `GET`/`HEAD` on `/` return 200 so the URL isn't a dead 405 when
  clicked. All other non-POST → 405, unknown routes → 404.
- Use **single-service** agent IDs for verify/check demos so the probe resolves to
  the intended endpoint without a `serviceName`. `#3152` is multi-service — either
  pass `serviceName` or avoid it as a live target.

## Team

Diaz (wallet, CLI, scans, identity, demo) and Sako (endpoint, assets). Ownership
is split by directory to avoid collisions: `research/marketplace-scan/**`,
`docs/demo/**`, `MARGN-VERIFIED.md` are Diaz's; `endpoint/**`, `assets/**`,
`docs/listing.md` are Sako's. **Never have both edit the same file.** If you touch
Sako's `endpoint/` (as happened for the S4 quote fix), tell Sako to pull before
they edit it. Remote: `origin` = github.com/kuchikamizake05/Margn.

## What's left

1. OKX approval (waiting; not in our control).
2. Record the demo (`docs/demo/demo-script.md`), post on X with `#OKXAI`.
3. Submit the Google Form before the deadline.
4. `hackathon.md` (rules) is untracked — commit or leave local, Diaz's call.

## Environment note

This session's sandbox can reach `api.cloudflare.com`, npm, and the onchainos
backend, but NOT arbitrary hosts (the Worker URL, other ASPs). Probes of the live
Worker must be run by the user via `! curl` from their own machine.
