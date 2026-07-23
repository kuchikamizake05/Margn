# Fixed-Price ASP Economics Benchmark

## Material Passport

- Origin Skill: experiment-agent
- Origin Mode: run
- Origin Date: 2026-07-23
- Verification Status: VERIFIED — see `VALIDATION.md`
- Version Label: exp_result_v1

## Experiment Result

- **ID:** margn-v4-longbench-cost-20260723
- **Type:** analysis
- **Status:** completed
- **Command:** `python scripts/run_fixed_price_benchmark.py --config research/fixed-price-benchmark/config.json`
- **Working Directory:** repository root
- **API inference calls:** 0
- **Dataset revision:** `2b48e494f2c7a2f0af81aae178e05c7e1dde0fe9`
- **Dataset SHA-256:** `15d61c22d92c96900b3c4948b6aeea218d3214b676a65df48e7b8555604c7fe2`
- **Rows analyzed:** 503 valid / 503 total

## Primary results

Primary price: **$0.010 per order**. Target gross margin: **30%**.

| Model | Compatible | P50 cost | P95 cost | P95/P50 | Cash-loss rate | Fails 30% margin |
|---|---:|---:|---:|---:|---:|---:|
| gpt-5.4-nano | 442/503 | $0.016972 | $0.056540 | 3.33x | 62.4% | 71.5% |
| gpt-5.4-mini | 442/503 | $0.063644 | $0.212024 | 3.33x | 97.1% | 100.0% |

**Preregistered decision:** `H1_SUPPORTED`.<br>
**Robust to ±10% token-count sensitivity:** `true`.

Exact deterministic rerun matched all seven generated artifacts byte-for-byte. See [`VALIDATION.md`](VALIDATION.md) for the reproducibility record and 11/11 fallacy scan.

## Interpretation boundary

These are reconstructed lower-bound costs for a public long-context multiple-choice benchmark. They exclude actual reasoning tokens, tools, infrastructure, payment fees, refunds, and most retries. They do not establish that any OKX.AI seller is losing money or wants this product.

## Figures

- `results/figures/cost-distribution.svg`
- `results/figures/price-coverage.svg`

## Anomalies detected

None during the completed run. Workloads above a model's context window are reported as incompatible and are not silently truncated.
