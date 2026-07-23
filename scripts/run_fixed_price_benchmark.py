#!/usr/bin/env python3
"""Reconstruct fixed-price ASP inference costs without calling a model API."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import random
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable

import ijson
import requests
import tiktoken


REQUIRED_FIELDS = (
    "_id",
    "domain",
    "sub_domain",
    "difficulty",
    "length",
    "question",
    "choice_A",
    "choice_B",
    "choice_C",
    "choice_D",
    "answer",
    "context",
)


def load_config(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def dataset_url(dataset: dict[str, Any]) -> str:
    return (
        f"https://huggingface.co/datasets/{dataset['repo']}/resolve/"
        f"{dataset['revision']}/{dataset['file']}"
    )


def sha256_file(path: Path, chunk_size: int = 8 * 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(chunk_size):
            digest.update(chunk)
    return digest.hexdigest()


def download_dataset(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and destination.stat().st_size > 0:
        print(f"[download] using cache: {destination} ({destination.stat().st_size:,} bytes)")
        return

    temporary = destination.with_suffix(destination.suffix + ".part")
    print(f"[download] {url}")
    with requests.get(url, stream=True, timeout=(30, 120)) as response:
        response.raise_for_status()
        expected = int(response.headers.get("content-length", 0))
        downloaded = 0
        next_log = 16 * 1024 * 1024
        with temporary.open("wb") as handle:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if not chunk:
                    continue
                handle.write(chunk)
                downloaded += len(chunk)
                if downloaded >= next_log:
                    suffix = f"/{expected:,}" if expected else ""
                    print(f"[download] {downloaded:,}{suffix} bytes")
                    next_log += 16 * 1024 * 1024
    temporary.replace(destination)
    print(f"[download] complete: {destination.stat().st_size:,} bytes")


def iter_dataset(path: Path) -> Iterable[dict[str, Any]]:
    with path.open("rb") as handle:
        yield from ijson.items(handle, "item")


def validate_row(row: dict[str, Any], seen_ids: set[str]) -> str | None:
    missing = [field for field in REQUIRED_FIELDS if field not in row or row[field] is None]
    if missing:
        return "missing:" + ",".join(missing)
    row_id = str(row["_id"])
    if row_id in seen_ids:
        return "duplicate_id"
    if row["length"] not in {"short", "medium", "long"}:
        return "invalid_length"
    if row["answer"] not in {"A", "B", "C", "D"}:
        return "invalid_answer"
    return None


def build_request(row: dict[str, Any]) -> str:
    return (
        "Select the correct answer. Reply with only A, B, C, or D.\n\n"
        f"Context:\n{row['context']}\n\n"
        f"Question:\n{row['question']}\n\n"
        f"A. {row['choice_A']}\n"
        f"B. {row['choice_B']}\n"
        f"C. {row['choice_C']}\n"
        f"D. {row['choice_D']}"
    )


def resolve_encoding(model_id: str, fallback: str) -> tuple[Any, str, bool]:
    try:
        encoding = tiktoken.encoding_for_model(model_id)
        return encoding, encoding.name, False
    except KeyError:
        encoding = tiktoken.get_encoding(fallback)
        return encoding, encoding.name, True


def count_tokens(encoding: Any, text: str) -> int:
    """Count untrusted document text without interpreting embedded control markers."""
    return len(encoding.encode(text, disallowed_special=()))


def reconstructed_cost(
    input_tokens: float,
    output_tokens: float,
    input_rate: float,
    output_rate: float,
) -> float:
    return input_tokens / 1_000_000 * input_rate + output_tokens / 1_000_000 * output_rate


def price_floor(cost: float, target_margin: float) -> float:
    if not 0 <= target_margin < 1:
        raise ValueError("target_margin must be in [0, 1)")
    return cost / (1 - target_margin)


def cash_loss(cost: float, selling_price: float) -> bool:
    return cost > selling_price


def target_margin_failure(cost: float, selling_price: float, target_margin: float) -> bool:
    return price_floor(cost, target_margin) > selling_price


def percentile(values: list[float], quantile: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    position = (len(ordered) - 1) * quantile
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return ordered[lower]
    weight = position - lower
    return ordered[lower] * (1 - weight) + ordered[upper] * weight


def deterministic_selected(seed: int, row_id: str, rate: float) -> bool:
    payload = f"{seed}:{rate:.6f}:{row_id}".encode("utf-8")
    value = int.from_bytes(hashlib.sha256(payload).digest()[:8], "big") / 2**64
    return value < rate


def summarize_records(
    records: list[dict[str, Any]],
    prices: list[float],
    target_margin: float,
) -> dict[str, Any]:
    costs = [record["cost_usd"] for record in records]
    p50 = percentile(costs, 0.50)
    p95 = percentile(costs, 0.95)
    percentiles = {
        "min": min(costs) if costs else None,
        "p50": p50,
        "p90": percentile(costs, 0.90),
        "p95": p95,
        "p99": percentile(costs, 0.99),
        "max": max(costs) if costs else None,
    }
    price_metrics: dict[str, Any] = {}
    for price in prices:
        key = f"{price:.6f}"
        n = len(records)
        losses = sum(cash_loss(record["cost_usd"], price) for record in records)
        failures = sum(
            target_margin_failure(record["cost_usd"], price, target_margin)
            for record in records
        )
        price_metrics[key] = {
            "cash_loss_count": losses,
            "cash_loss_rate": losses / n if n else None,
            "target_margin_failure_count": failures,
            "target_margin_failure_rate": failures / n if n else None,
        }
    return {
        "n": len(records),
        "cost_usd": percentiles,
        "p95_over_p50": p95 / p50 if p50 and p95 is not None else None,
        "p95_price_floor_30_usd": price_floor(p95, target_margin) if p95 is not None else None,
        "prices": price_metrics,
    }


def audit_ids(rows: list[dict[str, Any]], per_length: int, seed: int) -> set[str]:
    grouped: dict[str, list[str]] = defaultdict(list)
    for row in rows:
        grouped[row["length"]].append(row["_id"])
    selected: set[str] = set()
    for index, length in enumerate(("short", "medium", "long")):
        ids = sorted(grouped[length])
        random.Random(seed + index).shuffle(ids)
        selected.update(ids[:per_length])
    return selected


def analyze_model(
    model_records: list[dict[str, Any]],
    config: dict[str, Any],
    context_window: int,
) -> dict[str, Any]:
    eligible = [record for record in model_records if record["compatible"]]
    incompatible = [record for record in model_records if not record["compatible"]]
    base = summarize_records(eligible, config["price_grid_usd"], config["target_margin"])
    base.update(
        {
            "population_n": len(model_records),
            "compatible_n": len(eligible),
            "incompatible_n": len(incompatible),
            "incompatibility_rate": len(incompatible) / len(model_records) if model_records else None,
            "context_window_tokens": context_window,
        }
    )

    guardrails: dict[str, Any] = {}
    for cap in config["guardrail_caps"]:
        accepted = [record for record in eligible if record["total_tokens"] <= cap]
        rejected = [record for record in eligible if record["total_tokens"] > cap]
        summary = summarize_records(accepted, config["price_grid_usd"], config["target_margin"])
        summary.update(
            {
                "accepted_n": len(accepted),
                "rejected_n": len(rejected),
                "acceptance_rate_among_compatible": len(accepted) / len(eligible) if eligible else None,
                "rejection_rate_among_compatible": len(rejected) / len(eligible) if eligible else None,
            }
        )
        guardrails[str(cap)] = summary

    by_length = {
        length: summarize_records(
            [record for record in eligible if record["length"] == length],
            config["price_grid_usd"],
            config["target_margin"],
        )
        for length in ("short", "medium", "long")
    }

    domains = sorted({record["domain"] for record in eligible})
    by_domain = {
        domain: summarize_records(
            [record for record in eligible if record["domain"] == domain],
            config["price_grid_usd"],
            config["target_margin"],
        )
        for domain in domains
    }
    leave_one_domain_out = {
        domain: summarize_records(
            [record for record in eligible if record["domain"] != domain],
            [config["primary_price_usd"]],
            config["target_margin"],
        )
        for domain in domains
    }

    sensitivity: dict[str, Any] = {}
    for multiplier in config["token_sensitivity"]:
        adjusted: list[dict[str, Any]] = []
        for record in model_records:
            total_tokens = math.ceil(record["total_tokens"] * multiplier)
            if total_tokens > context_window:
                continue
            adjusted.append(
                {
                    **record,
                    "cost_usd": record["cost_usd"] * multiplier,
                    "total_tokens": total_tokens,
                }
            )
        sensitivity[f"{multiplier:.2f}"] = summarize_records(
            adjusted,
            [config["primary_price_usd"]],
            config["target_margin"],
        )

    retry_sensitivity: dict[str, Any] = {}
    for retry_rate in config["retry_rates"]:
        adjusted = []
        selected_count = 0
        for record in eligible:
            selected = deterministic_selected(config["seed"], record["_id"], retry_rate)
            selected_count += int(selected)
            adjusted.append({**record, "cost_usd": record["cost_usd"] * (2 if selected else 1)})
        summary = summarize_records(
            adjusted,
            [config["primary_price_usd"]],
            config["target_margin"],
        )
        summary["selected_for_retry_n"] = selected_count
        retry_sensitivity[f"{retry_rate:.2f}"] = summary

    return {
        "baseline": base,
        "guardrails": guardrails,
        "by_length": by_length,
        "by_domain": by_domain,
        "leave_one_domain_out": leave_one_domain_out,
        "token_sensitivity": sensitivity,
        "retry_sensitivity": retry_sensitivity,
    }


def write_csv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def svg_cost_distribution(path: Path, records: list[dict[str, Any]], models: list[str]) -> None:
    width, height = 900, 500
    left, right, top, bottom = 85, 30, 45, 70
    plot_w, plot_h = width - left - right, height - top - bottom
    series = {
        model: sorted(record["cost_usd"] for record in records if record["model"] == model and record["compatible"])
        for model in models
    }
    positive = [value for values in series.values() for value in values if value > 0]
    ymin, ymax = math.log10(min(positive)), math.log10(max(positive))
    colors = ["#2563eb", "#dc2626"]
    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<rect width="100%" height="100%" fill="white"/>',
        '<text x="450" y="25" text-anchor="middle" font-family="sans-serif" font-size="18">Reconstructed cost distribution (compatible workloads)</text>',
        f'<line x1="{left}" y1="{top + plot_h}" x2="{left + plot_w}" y2="{top + plot_h}" stroke="#111"/>',
        f'<line x1="{left}" y1="{top}" x2="{left}" y2="{top + plot_h}" stroke="#111"/>',
        f'<text x="{left + plot_w / 2}" y="{height - 20}" text-anchor="middle" font-family="sans-serif">Workload percentile</text>',
        f'<text x="20" y="{top + plot_h / 2}" transform="rotate(-90 20 {top + plot_h / 2})" text-anchor="middle" font-family="sans-serif">Cost USD (log scale)</text>',
    ]
    for index, (model, values) in enumerate(series.items()):
        points = []
        for i, value in enumerate(values):
            x = left + (i / max(1, len(values) - 1)) * plot_w
            y = top + (1 - (math.log10(value) - ymin) / max(1e-12, ymax - ymin)) * plot_h
            points.append(f"{x:.2f},{y:.2f}")
        lines.append(f'<polyline points="{" ".join(points)}" fill="none" stroke="{colors[index]}" stroke-width="2"/>')
        lines.append(f'<text x="{left + 15}" y="{top + 20 + index * 22}" font-family="sans-serif" fill="{colors[index]}">{model}</text>')
    for tick in (0, 25, 50, 75, 100):
        x = left + tick / 100 * plot_w
        lines.append(f'<text x="{x}" y="{top + plot_h + 25}" text-anchor="middle" font-family="sans-serif" font-size="12">{tick}%</text>')
    lines.append("</svg>")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")


def svg_price_coverage(path: Path, summary: dict[str, Any], prices: list[float], models: list[str]) -> None:
    width, height = 900, 500
    left, right, top, bottom = 75, 30, 50, 90
    plot_w, plot_h = width - left - right, height - top - bottom
    colors = ["#2563eb", "#dc2626"]
    group_w = plot_w / len(prices)
    bar_w = group_w / (len(models) + 1)
    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<rect width="100%" height="100%" fill="white"/>',
        '<text x="450" y="27" text-anchor="middle" font-family="sans-serif" font-size="18">Share meeting 30% margin target</text>',
        f'<line x1="{left}" y1="{top + plot_h}" x2="{left + plot_w}" y2="{top + plot_h}" stroke="#111"/>',
        f'<line x1="{left}" y1="{top}" x2="{left}" y2="{top + plot_h}" stroke="#111"/>',
    ]
    for tick in range(0, 101, 20):
        y = top + plot_h - tick / 100 * plot_h
        lines.append(f'<text x="{left - 10}" y="{y + 4}" text-anchor="end" font-family="sans-serif" font-size="12">{tick}%</text>')
        lines.append(f'<line x1="{left}" y1="{y}" x2="{left + plot_w}" y2="{y}" stroke="#ddd"/>')
    for p_index, price in enumerate(prices):
        key = f"{price:.6f}"
        group_x = left + p_index * group_w
        for m_index, model in enumerate(models):
            failure = summary["models"][model]["baseline"]["prices"][key]["target_margin_failure_rate"]
            success = 1 - failure
            bar_h = success * plot_h
            x = group_x + (m_index + 0.5) * bar_w
            y = top + plot_h - bar_h
            lines.append(f'<rect x="{x:.2f}" y="{y:.2f}" width="{bar_w * 0.8:.2f}" height="{bar_h:.2f}" fill="{colors[m_index]}"/>')
        lines.append(f'<text x="{group_x + group_w / 2}" y="{top + plot_h + 25}" text-anchor="middle" font-family="sans-serif" font-size="12">${price:g}</text>')
    for index, model in enumerate(models):
        x = left + index * 190
        lines.append(f'<rect x="{x}" y="{height - 35}" width="14" height="14" fill="{colors[index]}"/>')
        lines.append(f'<text x="{x + 20}" y="{height - 23}" font-family="sans-serif" font-size="12">{model}</text>')
    lines.append("</svg>")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")


def fmt_money(value: float | None) -> str:
    return "n/a" if value is None else f"${value:.6f}"


def fmt_pct(value: float | None) -> str:
    return "n/a" if value is None else f"{value * 100:.1f}%"


def render_report(config: dict[str, Any], summary: dict[str, Any], command: str) -> str:
    rows = []
    primary_key = f"{config['primary_price_usd']:.6f}"
    for model in config["models"]:
        model_id = model["id"]
        baseline = summary["models"][model_id]["baseline"]
        primary = baseline["prices"][primary_key]
        rows.append(
            f"| {model_id} | {baseline['compatible_n']}/{baseline['population_n']} | "
            f"{fmt_money(baseline['cost_usd']['p50'])} | {fmt_money(baseline['cost_usd']['p95'])} | "
            f"{baseline['p95_over_p50']:.2f}x | {fmt_pct(primary['cash_loss_rate'])} | "
            f"{fmt_pct(primary['target_margin_failure_rate'])} |"
        )
    decision = summary["decision"]
    return f"""# Fixed-Price ASP Economics Benchmark

## Material Passport

- Origin Skill: experiment-agent
- Origin Mode: run
- Origin Date: 2026-07-23
- Verification Status: UNVERIFIED
- Version Label: exp_result_v1

## Experiment Result

- **ID:** {config['experiment_id']}
- **Type:** analysis
- **Status:** completed
- **Command:** `{command}`
- **Working Directory:** repository root
- **API inference calls:** 0
- **Dataset revision:** `{config['dataset']['revision']}`
- **Dataset SHA-256:** `{summary['dataset']['sha256']}`
- **Rows analyzed:** {summary['dataset']['valid_rows']} valid / {summary['dataset']['total_rows']} total

## Primary results

Primary price: **${config['primary_price_usd']:.3f} per order**. Target gross margin: **{config['target_margin'] * 100:.0f}%**.

| Model | Compatible | P50 cost | P95 cost | P95/P50 | Cash-loss rate | Fails 30% margin |
|---|---:|---:|---:|---:|---:|---:|
{chr(10).join(rows)}

**Preregistered decision:** `{decision['verdict']}`.<br>
**Robust to ±10% token-count sensitivity:** `{str(decision['robust_to_token_sensitivity']).lower()}`.

## Interpretation boundary

These are reconstructed lower-bound costs for a public long-context multiple-choice benchmark. They exclude actual reasoning tokens, tools, infrastructure, payment fees, refunds, and most retries. They do not establish that any OKX.AI seller is losing money or wants this product.

## Figures

- `results/figures/cost-distribution.svg`
- `results/figures/price-coverage.svg`

## Anomalies detected

None during the completed run. Workloads above a model's context window are reported as incompatible and are not silently truncated.
"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True, type=Path)
    args = parser.parse_args()

    root = Path.cwd()
    config = load_config(args.config)
    paths = {key: root / value for key, value in config["paths"].items()}
    cache_path = paths["cache_dir"] / config["dataset"]["file"]
    url = dataset_url(config["dataset"])
    download_dataset(url, cache_path)
    dataset_hash = sha256_file(cache_path)
    print(f"[dataset] sha256={dataset_hash}")

    encodings: dict[str, tuple[Any, str, bool]] = {}
    for model in config["models"]:
        encodings[model["id"]] = resolve_encoding(model["id"], config["fallback_tokenizer"])
        _, encoding_name, proxy = encodings[model["id"]]
        print(f"[tokenizer] {model['id']} -> {encoding_name} (proxy={proxy})")

    valid_rows: list[dict[str, Any]] = []
    rejected: list[dict[str, str]] = []
    seen_ids: set[str] = set()
    total_rows = 0
    token_cache_by_encoding: dict[str, dict[str, int]] = defaultdict(dict)
    records: list[dict[str, Any]] = []

    for total_rows, row in enumerate(iter_dataset(cache_path), start=1):
        reason = validate_row(row, seen_ids)
        if reason:
            rejected.append({"_id": str(row.get("_id", "")), "reason": reason})
            continue
        row_id = str(row["_id"])
        seen_ids.add(row_id)
        request = build_request(row)
        row_meta = {
            "_id": row_id,
            "domain": str(row["domain"]),
            "sub_domain": str(row["sub_domain"]),
            "difficulty": str(row["difficulty"]),
            "length": str(row["length"]),
        }
        valid_rows.append(row_meta)
        for model in config["models"]:
            encoding, encoding_name, proxy = encodings[model["id"]]
            if encoding_name not in token_cache_by_encoding[row_id]:
                token_cache_by_encoding[row_id][encoding_name] = count_tokens(encoding, request)
            input_tokens = token_cache_by_encoding[row_id][encoding_name]
            output_tokens = count_tokens(encoding, str(row["answer"]))
            total_tokens_for_call = input_tokens + output_tokens
            cost = reconstructed_cost(
                input_tokens,
                output_tokens,
                model["input_usd_per_million"],
                model["output_usd_per_million"],
            )
            records.append(
                {
                    **row_meta,
                    "model": model["id"],
                    "tokenizer": encoding_name,
                    "tokenizer_is_proxy": proxy,
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "total_tokens": total_tokens_for_call,
                    "compatible": total_tokens_for_call <= model["context_window_tokens"],
                    "cost_usd": cost,
                    "price_floor_30_usd": price_floor(cost, config["target_margin"]),
                }
            )
        if total_rows % 10 == 0:
            print(f"[tokenize] {total_rows}/{config['dataset']['expected_rows']} rows")

    if total_rows != config["dataset"]["expected_rows"]:
        raise RuntimeError(
            f"Expected {config['dataset']['expected_rows']} rows, found {total_rows}; "
            "dataset revision or parser output changed"
        )

    selected_audit_ids = audit_ids(valid_rows, config["audit_sample_per_length"], config["seed"])
    for row in valid_rows:
        row["audit_subset"] = row["_id"] in selected_audit_ids

    manifest_fields = ["_id", "domain", "sub_domain", "difficulty", "length", "audit_subset"]
    write_csv(paths["manifest_csv"], valid_rows, manifest_fields)
    per_call_fields = [
        "_id", "domain", "sub_domain", "difficulty", "length", "model", "tokenizer",
        "tokenizer_is_proxy", "input_tokens", "output_tokens", "total_tokens", "compatible",
        "cost_usd", "price_floor_30_usd",
    ]
    write_csv(paths["per_call_csv"], records, per_call_fields)

    model_summaries = {}
    for model in config["models"]:
        model_records = [record for record in records if record["model"] == model["id"]]
        model_summaries[model["id"]] = analyze_model(
            model_records,
            config,
            model["context_window_tokens"],
        )

    primary_key = f"{config['primary_price_usd']:.6f}"
    material_models = []
    robust_models = []
    for model in config["models"]:
        model_id = model["id"]
        baseline = model_summaries[model_id]["baseline"]
        fail_rate = baseline["prices"][primary_key]["target_margin_failure_rate"]
        material = baseline["p95_over_p50"] >= 3 or fail_rate > 0.10
        if material:
            material_models.append(model_id)
        sensitivity_material = []
        for result in model_summaries[model_id]["token_sensitivity"].values():
            sensitivity_fail = result["prices"][primary_key]["target_margin_failure_rate"]
            sensitivity_material.append(result["p95_over_p50"] >= 3 or sensitivity_fail > 0.10)
        if material and all(sensitivity_material):
            robust_models.append(model_id)

    summary = {
        "experiment_id": config["experiment_id"],
        "dataset": {
            "repo": config["dataset"]["repo"],
            "revision": config["dataset"]["revision"],
            "source_url": url,
            "sha256": dataset_hash,
            "total_rows": total_rows,
            "valid_rows": len(valid_rows),
            "rejected_rows": rejected,
            "length_counts": dict(sorted(Counter(row["length"] for row in valid_rows).items())),
            "audit_subset_n": len(selected_audit_ids),
        },
        "assumptions": {
            "infrastructure_cost_usd": 0,
            "tool_cost_usd": 0,
            "payment_fee_usd": 0,
            "baseline_retry_rate": 0,
            "output_is_minimum_one-letter_proxy": True,
        },
        "models": model_summaries,
        "decision": {
            "verdict": "H1_SUPPORTED" if material_models else "H0_NOT_REJECTED",
            "material_models": material_models,
            "robust_models": robust_models,
            "robust_to_token_sensitivity": bool(robust_models),
        },
    }

    paths["rate_cards_json"].write_text(
        json.dumps({"models": config["models"]}, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    paths["summary_json"].write_text(
        json.dumps(summary, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    model_ids = [model["id"] for model in config["models"]]
    svg_cost_distribution(paths["cost_figure_svg"], records, model_ids)
    svg_price_coverage(paths["coverage_figure_svg"], summary, config["price_grid_usd"], model_ids)
    command = f"python scripts/run_fixed_price_benchmark.py --config {args.config.as_posix()}"
    paths["report_md"].write_text(render_report(config, summary, command), encoding="utf-8")
    print(f"[complete] {paths['summary_json']}")
    return 0


if __name__ == "__main__":
    started = time.monotonic()
    try:
        raise SystemExit(main())
    finally:
        print(f"[runtime] {time.monotonic() - started:.1f}s", file=sys.stderr)
