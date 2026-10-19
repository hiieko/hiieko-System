"""CLI entry point: ``python -m benchmarks``."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .harness import ALL_ARMS, DEFAULT_FIXTURES_DIR, format_report, run_benchmark


def main() -> int:
    parser = argparse.ArgumentParser(description="HIIEKO OCR engine benchmark (PP-StructureV3 spike)")
    parser.add_argument("--fixtures-dir", type=Path, default=DEFAULT_FIXTURES_DIR)
    parser.add_argument(
        "--arm",
        action="append",
        choices=ALL_ARMS,
        dest="arms",
        help="restrict to one arm (repeatable); default: all",
    )
    parser.add_argument("--abs-tol", type=float, default=0.01)
    parser.add_argument("--json", action="store_true", help="emit machine-readable JSON")
    args = parser.parse_args()

    arms = tuple(args.arms) if args.arms else ALL_ARMS
    rows = run_benchmark(args.fixtures_dir, arms, args.abs_tol)

    if args.json:
        print(json.dumps(rows, indent=2, ensure_ascii=False))
    else:
        print(format_report(rows))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
