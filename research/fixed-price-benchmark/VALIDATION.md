# Validation Report — Fixed-Price ASP Economics Benchmark

## Material Passport

- Origin Skill: experiment-agent
- Origin Mode: validate
- Origin Date: 2026-07-23
- Verification Status: VERIFIED
- Version Label: validation_v1

## Validation Report

- **Source:** `margn-v4-longbench-cost-20260723`
- **Overall confidence:** CAUTION
- **Reason:** arithmetic and reproducibility are strong, but external validity to real OKX.AI ASP traffic remains unproven.

## Statistical findings

This is a deterministic finite-benchmark reconstruction, not a random-sample hypothesis test. No p-values or confidence intervals are reported.

| Metric | Result | Interpretation | Confidence |
|---|---:|---|---|
| Valid dataset rows | 503/503 | Complete census of the pinned LongBench v2 revision | SOLID |
| Compatible with 400k context window | 442/503 (87.9%) | 61 rows are incompatibility cases, not loss cases | SOLID |
| GPT-5.4 nano P95/P50 cost | 3.33x | Meets preregistered material-variance threshold | SOLID for benchmark; CAUTION externally |
| Nano failure of 30% margin at $0.01 | 71.5% | 316 of 442 compatible workloads exceed the target-margin price floor | SOLID for benchmark; CAUTION externally |
| Mini failure of 30% margin at $0.01 | 100.0% | All 442 compatible workloads exceed the target-margin price floor | SOLID for benchmark; CAUTION externally |
| Nano 32k guardrail | 0% target-margin failures among 116 accepted | Arithmetic benefit is paired with 73.8% rejection of compatible workloads | SOLID for simulation; no causal product claim |
| Leave-one-domain-out nano failure rate | 68.2%–78.6% | Primary pattern is not eliminated by removing any one domain | SOLID for benchmark robustness |
| Token sensitivity ±10% | H1 retained for both models | Conclusion is not driven by a small tokenizer-count deviation | SOLID |

## Warnings

| Type | Detail | Affected claims |
|---|---|---|
| External validity | LongBench v2 intentionally emphasizes difficult long-context work and is not sampled from OKX.AI orders. | Prevalence of margin risk in the marketplace |
| Tokenizer proxy | `o200k_base` is used because `tiktoken` 0.12.0 does not map the two model IDs directly. | Exact billed token counts |
| Lower-bound output | Output is a one-letter answer proxy and excludes possible reasoning tokens. | Absolute cost, especially for reasoning-enabled execution |
| Missing cost categories | Tools, infrastructure, payment fees, refunds, and baseline retries are zero. | Total seller cost and net margin |
| Price anchor | $0.01 is a sensitivity point informed by a local marketplace snapshot, not a category-specific representative price. | General marketplace mispricing claims |
| Compatibility selection | Primary cost rates exclude 61 rows above 400k tokens, while reporting them separately. | Direct comparison to an uncapped workload population |
| Demand gap | The experiment contains no seller interviews, production telemetry, willingness-to-pay, or product usage. | Product demand and winnability |

## Fallacy scan

- **Coverage:** 11/11 fallacy types checked

| Fallacy | Severity | Finding | Control applied |
|---|---|---|---|
| Simpson's paradox | NOTE | No direction reversal found across length strata; leave-one-domain-out rates remain material. | Results reported overall, by length, and by domain. |
| Ecological fallacy | CAUTION | Benchmark workload results cannot be attributed to individual ASP sellers. | Claims remain at reference-workload level. |
| Berkson's paradox | CAUTION | LongBench is a selected difficult long-context benchmark. | No claim that it represents the natural OKX.AI workload mix. |
| Collider bias | NOTE | No regression or conditioned causal model is used. | Not applicable to the arithmetic reconstruction. |
| Base-rate neglect | CAUTION | A single $0.01 price could hide category-specific marketplace distributions. | Full price grid and denominators are reported. |
| Regression to the mean | NOTE | No pre/post selection on extreme outcomes. | Not applicable. |
| Survivorship bias | CAUTION | Compatible-only cost rates omit 61 over-window rows. | Incompatibility rate is explicit and excluded rows are never called losses. |
| Look-elsewhere effect | NOTE | Multiple breakdowns are descriptive; the primary metric and threshold were preregistered. | Decision uses the committed protocol, not the most favorable subgroup. |
| Garden of forking paths | NOTE | Protocol and thresholds were committed before execution (`b2c59f9`). | Tokenizer crash fix changed parsing only and has a regression test. |
| Correlation ≠ causation | CAUTION | A simulated guardrail does not prove that Margn improves real seller margin. | Language is limited to reconstructed arithmetic effects. |
| Reverse causality | NOTE | No directional behavioral association is estimated. | Not applicable. |

## Reproducibility

- **Method:** deterministic exact rerun
- **Environment:** Windows, Python 3.12.13, `tiktoken==0.12.0`, `ijson==3.4.0.post0`, `requests==2.34.2`
- **Original completed runtime:** 136.7 seconds
- **Rerun runtime:** 204.5 seconds
- **Verdict:** REPRODUCIBLE
- **Comparison:** 7/7 output artifacts matched byte-for-byte by SHA-256; timing was not compared.

| Artifact | Original vs rerun |
|---|---|
| `data/dataset-manifest.csv` | MATCH |
| `data/rate-cards.json` | MATCH |
| `results/per-call-costs.csv` | MATCH |
| `results/summary.json` | MATCH |
| `results/figures/cost-distribution.svg` | MATCH |
| `results/figures/price-coverage.svg` | MATCH |
| `REPORT.md` | MATCH before this validation annotation |

## Valid conclusion

The benchmark verifies that fixed-price long-context services can have materially different reconstructed input costs and that model/context guardrails can change the feasible price floor. It does not verify that current OKX.AI sellers are mispriced, experience this workload mix, or would adopt Margn.
