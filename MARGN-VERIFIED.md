# Margn — Pre-purchase checks for OKX.AI

> **At the moment money moves, buyers see Provider, Service, and Price. No
> liveness. No security score. No market price range.
> Margn fills that card.**

**Document status.** Supersedes `MARGN.md` (v1, CFO agent), `MARGN-v2.md`
(v2, margin engine), and `MARGN-ROUTER.md` (v3, routing layer). All three are
kept as archives—do not use them for the submission.

Every number here comes from a single measurement on this machine—
**July 23, 2026, 19:55 WIB**—and was not copied from earlier documents. Most
figures in those three older documents are **inaccurate**—see §7.

The scripts and raw data live in `research/marketplace-scan/` and can be rerun
at any time: `scan.py` → `stats.py` · `probe.py` · `matchtest.py`. Every run
writes a minute-level timestamped file (`agents-2026-07-23T1955.json`) and
refuses to overwrite a previous run, so every figure quoted in this document
can always be traced back to its source file.

---

## 1. What is actually broken

`asp-match` is OKX's first-party matcher. It retrieves relevant services well.
It **does not rank by value at all.**

The request `"get latest crypto news headlines"`, run from agent #7520:

| # | Agent | Price | feedbackRate | securityRate | Sold |
| --- | --- | --- | --- | --- | --- |
| 1 | #4464 | $0.01 | — | — | 5 |
| 2 | #5325 | $0.10 | — | — | — |
| **3** | **#3152** | **$0.55** | **0.0** | **2.00** | **1** |
| 4 | #5077 | $0.05 | — | — | 3 |
| **5** | **#2013** | **$0.01** | **100.0** | **5.00** | **1,670** |
| 6 | #6923 | $0.005 | — | — | 14 |
| 7 | #5209 | $0.05 | — | — | 2 |
| 8 | #4462 | $0.01 | — | — | 6 |
| 9 | #5634 | $0.06 | 100.0 | 5.00 | 1 |
| 10 | #3577 | $0.05 | 100.0 | 5.00 | 4 |

Compare ranks 3 and 5. **#2013 is better on every metric measured by the
platform itself**—55× cheaper, reputation 100.0 versus 0.0, security 5.00
versus 2.00, and **1,670 sales versus 1**. It is still ranked below the other
option.

This is not a case of "the cheaper option losing." The most proven seller in
the entire list loses to a seller with one sale and a feedback rating of zero.

### And it is systematic, not one unlucky case

Eight different needs were tested. In **all 7 of the 7 tests that completed**,
the best-value option ranked below an option that was both more expensive
*and* worse:

| Need | Best option's rank | Option ranked above it |
| --- | --- | --- |
| analyze portfolio | 5 | **800×** more expensive, no scores |
| crypto news | 5 | 55× more expensive, `securityRate` 2.0, 1 sale |
| swap on dex | 5 | 40× more expensive, no scores |
| translate text | 7 | 20× more expensive, no scores |
| generate image | 9 | 3× more expensive |
| wallet balance | 10 | $0.8 versus $0, no scores |
| smart contract audit | 10 | $1.0 versus $0, no scores |

The eighth need (`"get token price and market data"`) could not be tested:
`asp-match` returned `code=4001: SearchApi.taskSearchAgentPost failed`.
This is **deterministic, not transient**—the phrase `"token price data"` always
fails while `"token price"` succeeds. It is a minor platform bug; do not use it
as an attack, but be aware that it exists.

Retrieval is good. **Ranking is absent.**

Judges can verify this entire table with a single CLI command on their own
machines. The reference point is OKX's own API.

### ⚠️ Rankings shift daily—do not hard-code one number

On July 22, ranks 1–5 for `crypto news` were identical to today's, but #2118
($0.001 · security 4.75 · 221 sales) **fell out of the top 10** within 24 hours.
Yesterday's headline figure—550×—became 55× today.

**Practical consequence:** do not put a single ratio in the demo title or X
post. What remains stable is **the mechanism** (rank 3 = $0.55, security 2.0,
1 sale—exactly unchanged across two days), not the ratio itself. Rerun
`matchtest.py` on the day the demo is recorded and quote that day's figure.

---

## 2. Market conditions, measured

A union of **45 `onchainos agent search` queries** (the query list is frozen in
`scan.py` and stored in every output file so measurements can be compared).
Broad queries (`"a"`, `"the"`) both return nearly the entire market, making
this effectively a census rather than a sample.

| Metric | July 23 | July 22 | Δ |
| --- | --- | --- | --- |
| Unique agents | **1,006** | 985 | +21 |
| Services | **2,439** (A2MCP 1,673 · A2A 766) | 2,344 | +95 |
| Unique endpoints | **1,585** | 1,486 | +99 |
| Total sales | **27,971** | 25,932 | **+2,039 in one day** |
| Currently offline | **218 (21.7%)** | 22.4% | −0.7 pp |
| **Zero sales** | **554 (55.1%)** | 55.5% | −0.4 pp |
| Top seller (PixelBrief) | 10,217 = **36.5%** | 39.0% | −2.5 pp |

The market is growing by roughly 2,000 transactions per day as the deadline
approaches, yet **the share that has never sold anything is barely moving**—
55%. Growth flows to agents that are already winning.

**Categories do not help buyers choose:**
Software services 669 (66.5%) · Finance 156 (15.5%) · Lifestyle 102 (10.1%) ·
Art creation 67 (6.7%) · other 13.

**Prices span nine orders of magnitude.** There are 2,273 paid services and
169 free ones. The lowest price is $0.000001 and the highest is $5,000. The
most common prices are $0.01 (320 services), $0.1 (289), and $1.0 (278).

### Findings that constrain the design

```
feedbackRate : present for 257/1006  (26%)  — null for 749
securityRate : present for 258/1006  (26%)  — null for 748
```

**74% of agents have neither a reputation nor security score.** Of the 258
with a `securityRate`, 175 score 5.0—so only 83 agents (8% of the market) are
actually differentiated by it. This ratio is stable across all measurements.

The consequence is clear: **reputation cannot be the backbone of ranking.**
The only signals available across the entire market are **price** and
**liveness**. Those are what Margn measures.

### Liveness measured directly

A probe of 300 out of 1,585 endpoints (random sample, fixed seed = 7):

| Result | Count | % |
| --- | --- | --- |
| `402` — healthy, ready for payment | 206 | **68.7%** |
| `404` / `405` / `403` / `406` / `400` / `422` | 64 | 21.3% |
| `200` — not charging | 20 | 6.7% |
| unreachable (timeout / DNS) | 10 | **3.3%** |

Some `405` responses may come from POST-only endpoints that I probed with
GET—OKX's own documentation warns about this. **That makes ~69% a lower
bound**, and it must be presented as a lower bound rather than a verdict.

**Probe results vary by ±3 pp between runs** on the same seed and sample
(67.0% · 65.3% · 68.7% measured across two days). That is network variance,
not market change. Quote this as "roughly two-thirds," not as a precise figure.

**`onlineStatus` cannot be trusted as a liveness signal.** Of the 297 endpoints
the platform marks `onlineStatus=1` (online), only **68% actually return `402`**
and 3% do not respond at all. This is the most direct justification for
`verify()`: the only way to know whether an ASP is alive is to call it now,
not read its flag.

---

## 3. Hard constraint: no autonomous buyers

Verified against the official `okx/onchainos-skills` repository.

- `okx-agent-payments-protocol/SKILL.md` —
  *"You MUST stop and confirm before paying — do not auto-pay."*
  The mandatory confirmation gate goes through `AskUserQuestion`; `payment pay`
  requires `--yes`, which they call *"the fund-moving confirming gate"*.
- `okx-ai/references/watch-core.md` — a user's response
  *"is not a license to autonomously pick a provider, start a negotiation,
  solicit quotes..."*
- `task-user-actions-publish.md` — *"Display the service list to the user and
  ask them to pick one"*, *"Loop until a match is found or the user gives up"*.

Only the stages **after** a choice has been made are autonomous: negotiation
(up to 2 rounds), delivery, and sub-session.

**The division is simple: humans choose and pay; agents execute.**

### Two ideas this eliminates

1. **A runtime router.** The concept of being "called before every purchase" at
   machine frequency has no caller. A $0.001 × high-volume model has no basis.
2. **Pay-per-call for Margn itself.** If Margn is sold as an A2MCP, every call
   to Margn triggers a payment confirmation prompt for the human. Asking
   someone to approve one payment dialog for advice about the purchase they
   are already approving in the adjacent dialog creates more friction than
   value.

This is not a reason to give up. It is a reason to change the product's form.

---

## 4. The form that survives

Not a router. **A pre-purchase check for humans**, called once per buying
decision—not once per API call.

The confirmation card a buyer sees before funds move contains exactly this:

| Field | Value |
| --- | --- |
| Provider | Agent 864 |
| Service Price | 0.08 USDT |

No liveness. No score. No price context. Margn fills those gaps.

### Product surface

| Tool | Function | Data source |
| --- | --- | --- |
| `verify(agentId)` | Alive or dead **right now**—a direct probe, never cached | HTTP probe |
| `quote(need)` | Market price range for that need: min · median · max | 2,273 public prices |
| `check(agentId, price)` | Both results + price position within the market | both |

`verify()` is the most important tool, not `route()`. "This endpoint is dead"
is binary and indisputable. "This is too expensive" can always be debated.

### Principles that must not be broken

- **Never claim "best."** Claim "transparent." Show the range, flag outliers,
  explain why, and let the human decide.
- **Never use subjective quality judgments.** Use only measured facts: price,
  liveness, and the platform's own scores.
- **Liveness must never be cached.** Prices may be cached.
- **Never position Margn as a replacement for `asp-match`.** It is always a
  layer on top.

---

## 5. The 90-second demo

All data is real, and judges can independently verify all of it.

| Time | Content |
| --- | --- |
| 0–10 sec | `verify()` catches a dead ASP. *"You are about to pay for a service that does not work. Nothing tells you that."* Binary, indisputable. |
| 10–35 sec | Run OKX's built-in `asp-match`, full screen and uncut. Zoom in on rank 3: **$0.55 · feedback 0.0 · security 2.0**. *"This is OKX's own API. Run the same command right now."* |
| 35–55 sec | Margn side by side: rank 5 = $0.01, reputation 100, security 5.00, **1,670 sales**—better on every metric, still ranked lower. *"The signal is already in OKX's API. Nobody reads it."* |
| 55–75 sec | The 7-of-7 table: the gap is systematic. Then the long-tail effect—**55% of agents have never sold anything**. |
| 75–90 sec | Three tools, one sentence each. Done. |

**Avoid this:** do not use slides (use the real terminal only); do not name an
ASP shown as a bad example—use its ID, because they are fellow participants;
do not hide probe latency; do not say "we fix OKX"—say "we read signals that
are already there."

---

## 6. Registration and deadline

Submissions close on **July 27, 2026, at 23:59 UTC**, and the ASP must already
be **live**, not merely submitted. OKX's review queue is outside our control—
this is the biggest risk, and it has nothing to do with the idea's quality.

**A2MCP requires an already-deployed endpoint.** From
`identity-register.md` §6: *"Require `https://`, publicly reachable, and really
deployed"*—`localhost`, private IPs, mock URLs, and placeholders are rejected.
The endpoint is **permanent on-chain**; replacing it requires an update
transaction.

The order is therefore: **endpoint first, then register once with the final
URL.** Do not be tempted to register A2A just to enter the queue—A2A turns each
purchase into a negotiated escrow task, the wrong shape for a quick check, and
the service type cannot be changed after creation.

**Registration checklist** (all are mandatory, `severity: block`):

- Name must be 3–25 characters, contain no "test" marker, and use no public
  figure's name
- Description must be ≤500 characters
- **1:1 image file for the avatar**—image links are rejected, and ASPs have no
  default
- Service description must have **two sections on separate lines**: ① what it
  does + who it is for, ② what the caller must provide. Each must be ≤200
  characters. Prohibited: example prompts, GitHub links, tech-stack details,
  disclaimers
- Fee must be a plain numeric string, implicitly USDT, with ≤6 decimals—it is
  mandatory for A2MCP, but **`"0"` is valid and passes review** (verified in the
  market: agents #6711 and #2162 sell A2MCP services with `fee: "0"`)

> Note: `validate-listing` **does not exist** in CLI v4.3.0. The first four
> rules above are also not validated at runtime—they come from
> `okx/onchainos-skills`. Follow them anyway, but do not expect identical error
> messages.

### Verified directly in the CLI (July 23)

- **A2MCP is not an MCP server.** Registered endpoints are ordinary REST
  endpoints—`/audit`, `/analyze`, `/v1/quote`. HTTPS accepting POST and
  returning JSON is enough; there is no JSON-RPC and no handshake.
- **There are two gates, not one.** Content QA runs immediately during
  `agent create`; the actual review queue begins at `agent activate`. A format
  error is caught immediately, not after waiting for days.
- **`agent update` triggers QA again.** Once approved, do not touch it.
  Changing the code behind the URL does not touch the registry at all—the only
  dangerous change is altering the endpoint string.
- **More than one ASP per wallet is allowed** (`pre-check` → `uniqueness:
  "multiple"`), so a failed first attempt is not the end.
- **The avatar must be uploaded with `agent upload --file`**, then the returned
  CDN URL is passed to `--picture`. External image links are rejected.

**Already prepared on this machine:** `onchainos` v4.3.0 · Apple login
`0xd4cc…4078` · User agent **#7520 "Margn Recon"** (User role; the ASP identity
will be a separate agent because roles cannot be changed after creation).
`pre-check --role asp` → `canCreate: true`, `aspCount: 0`.

---

## 7. Corrections to the older documents

Figures in `MARGN-v2.md` and `MARGN-ROUTER.md` were measured on July 21 on a
different machine. They were remeasured on July 22 and 23:

| Old claim | Measured (July 23) | |
| --- | --- | --- |
| 140 agents | **1,006** | 7× larger |
| 477 services | **2,439** | 5× larger |
| 34% offline | **21.7%** | overstated |
| 39% zero sales | **55.1%** | understated |
| 47% concentration | **36.5%** | overstated |
| 81% healthy endpoints | **~69%** | overstated |
| `securityRate` = most discriminating signal | null for 74% of agents | **claim removed** |

What **survives intact** is the `asp-match` ranking gap, reproduced on two
consecutive days and shown to be systematic across every testable need. Rank 3
for `crypto news`—#3152, $0.55, security 2.0, 1 sale—did not move at all in
24 hours.

The three figures underpinning the old demo—47%, 39%, 34%—are all wrong. If
judges check them themselves, which they can do with one command, credibility
is gone instantly. **Do not use the old figures anywhere.**

**Rule going forward:** rerun `scan.py` + `matchtest.py` on the day the demo is
recorded and on submission day. The market moves by roughly 2,000 transactions
per day; a three-day-old figure can already be wrong.

---

## 8. Risks—honestly

**OKX could build this itself in a week.** There is no moat; this is sorting
using fields already available in its API. Mitigation: the prize includes a
partnership, so being "absorbed by OKX" is not a loss—proving the need first is
a strong position.

**Sparse reputation data.** 74% of the market has no scores. The product may
promise only what can be measured across the entire market: price and
liveness.

**Judging other participants is sensitive.** Margn ranks ASPs owned by other
hackathon participants. Keep the ranking transparent and based on measured
facts.

**Deadline and review dependency.** See §6. This is the biggest determinant,
and it is not about the idea.

**Output quality is not measured.** Margn measures price, liveness, and
reputation—not result quality. A $0.001 service and a $0.55 service are not
necessarily equivalent. That is why the product presents context rather than
a "best" verdict.

---

## 9. Track fit

| Track | Prize | Fit |
| --- | --- | --- |
| **Software Utility** | 2,500 USDT each | **Primary target**—pure infrastructure, the least crowded field |
| **Best Product** | $20k (1st $10k) | Upside if execution is polished |
| ~~Revenue Rocket~~ | — | **Drop it.** Structurally impossible (§3), not merely constrained by time |

---

## 10. Next steps

1. Build the minimal endpoint: `verify` · `quote` · `check`—POST in, JSON out.
   **No x402:** all three are registered with `fee: "0"`, so there is no
   payment confirmation gate preventing agents from calling Margn (§3), and no
   payment flow needs to be implemented at all.
2. Deploy to stable, permanent public HTTPS. Use a custom domain—the URL is
   permanent on-chain, so moving hosts later only requires a DNS change rather
   than an `agent update` that triggers QA again.
3. Prepare a 1:1 avatar and listing text that follows the §6 checklist.
4. Register the ASP identity once, using the final URL.
5. Record the §5 demo and post it on X with `#OKXAI`.
6. Submit the Google Form before July 27 at 23:59 UTC.

> **Methodology note.** Agents, services, prices, categories, scores, and
> `asp-match` results are full measurements (July 23, 2026, union of 45
> queries). Endpoint health is a sample of 300 out of 1,585 and is presented as
> a lower bound. Scripts, raw data, and output from every run live in
> `research/marketplace-scan/` (`agents-<date>T<time>.json`, `stats-*.txt`,
> `probe-*.txt`, `matchtest-*.txt`) and can be rerun and compared at any time.
> Filenames include the time and `scan.py` refuses to overwrite an existing
> run, so every figure in this document retains an intact source file.
