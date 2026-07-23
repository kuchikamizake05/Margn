import importlib.util
import math
import unittest
from pathlib import Path


SCRIPT = Path(__file__).parents[1] / "scripts" / "run_fixed_price_benchmark.py"
SPEC = importlib.util.spec_from_file_location("benchmark", SCRIPT)
benchmark = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(benchmark)


class FormulaTests(unittest.TestCase):
    def test_reconstructed_cost_matches_manual_fixture(self):
        cost = benchmark.reconstructed_cost(20_000, 5_000, 0.75, 4.50)
        self.assertAlmostEqual(cost, 0.0375)

    def test_price_floor_for_thirty_percent_margin(self):
        self.assertAlmostEqual(benchmark.price_floor(0.07, 0.30), 0.10)

    def test_cash_loss_and_target_margin_are_distinct(self):
        self.assertFalse(benchmark.cash_loss(0.008, 0.01))
        self.assertTrue(benchmark.target_margin_failure(0.008, 0.01, 0.30))

    def test_percentile_uses_linear_interpolation(self):
        self.assertEqual(benchmark.percentile([1, 2, 3, 4], 0.50), 2.5)

    def test_invalid_margin_is_rejected(self):
        with self.assertRaises(ValueError):
            benchmark.price_floor(1, 1)


class DeterminismTests(unittest.TestCase):
    def test_special_token_marker_is_counted_as_document_text(self):
        encoding = benchmark.tiktoken.get_encoding("o200k_base")
        count = benchmark.count_tokens(encoding, "quoted marker: <|endoftext|>")
        self.assertGreater(count, 0)

    def test_retry_selection_is_deterministic(self):
        first = benchmark.deterministic_selected(20260723, "abc", 0.10)
        second = benchmark.deterministic_selected(20260723, "abc", 0.10)
        self.assertEqual(first, second)

    def test_request_contains_all_required_payload(self):
        row = {
            "context": "ctx",
            "question": "q?",
            "choice_A": "a",
            "choice_B": "b",
            "choice_C": "c",
            "choice_D": "d",
        }
        request = benchmark.build_request(row)
        for value in ("ctx", "q?", "A. a", "B. b", "C. c", "D. d"):
            self.assertIn(value, request)

    def test_summary_separates_loss_from_margin_failure(self):
        records = [{"cost_usd": 0.008}]
        summary = benchmark.summarize_records(records, [0.01], 0.30)
        price = summary["prices"]["0.010000"]
        self.assertEqual(price["cash_loss_rate"], 0)
        self.assertEqual(price["target_margin_failure_rate"], 1)


if __name__ == "__main__":
    unittest.main()
