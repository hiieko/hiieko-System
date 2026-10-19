"""
Benchmark harness: load fixtures, run arms, score, report.

Run with ``python -m benchmarks`` from ``ocr-service``. The harness is
offline and needs no OCR engine: the HIIEKO and XML arms are
deterministic, and the PP-StructureV3 arm is skipped unless explicitly
enabled.
"""

from __future__ import annotations

import json
from pathlib import Path

from .adapters import (
    ArmResult,
    run_hiieko_arm,
    run_pp_structure_v3_arm,
    run_xml_arm,
)
from .scoring import DEFAULT_ABS_TOL, score_document

DEFAULT_FIXTURES_DIR = Path(__file__).parent / "fixtures"
ALL_ARMS = ("hiieko", "xml_efactura", "pp_structure_v3")


def load_documents(fixtures_dir: Path | None = None) -> list[dict]:
    directory = fixtures_dir or DEFAULT_FIXTURES_DIR
    manifest = json.loads((directory / "documents.json").read_text(encoding="utf-8"))
    return manifest["documents"]


def _run_arm(arm: str, document: dict, fixtures_dir: Path) -> ArmResult:
    if arm == "hiieko":
        if not document.get("hiieko_input"):
            return ArmResult(arm=arm, available=False, reason="fixture has no hiieko_input")
        return run_hiieko_arm(document)
    if arm == "xml_efactura":
        return run_xml_arm(document, fixtures_dir)
    if arm == "pp_structure_v3":
        return run_pp_structure_v3_arm(document, fixtures_dir)
    raise ValueError(f"unknown arm: {arm}")


def run_benchmark(
    fixtures_dir: Path | None = None,
    arms: tuple[str, ...] = ALL_ARMS,
    abs_tol: float = DEFAULT_ABS_TOL,
) -> list[dict]:
    directory = fixtures_dir or DEFAULT_FIXTURES_DIR
    rows: list[dict] = []
    for document in load_documents(directory):
        for arm in arms:
            result = _run_arm(arm, document, directory)
            if not result.available:
                rows.append(
                    {
                        "document_id": document["id"],
                        "document_type": document.get("document_type"),
                        "arm": arm,
                        "available": False,
                        "reason": result.reason,
                    }
                )
                continue
            score = score_document(result.prediction, document["ground_truth"], abs_tol)
            rows.append(
                {
                    "document_id": document["id"],
                    "document_type": document.get("document_type"),
                    "arm": arm,
                    "available": True,
                    "error": result.error,
                    "elapsed_ms": result.elapsed_ms,
                    "prediction": result.prediction,
                    "score": score,
                    "meta": result.meta,
                }
            )
    return rows


def format_report(rows: list[dict]) -> str:
    lines: list[str] = []
    header = f"{'document':34} {'arm':16} {'fields':>8} {'items F1':>9} {'rows':>6} {'ms':>9}"
    lines.append(header)
    lines.append("-" * len(header))
    for row in rows:
        if not row["available"]:
            lines.append(
                f"{row['document_id']:34} {row['arm']:16} {'SKIPPED':>8} "
                f"{'':>9} {'':>6}   {row['reason']}"
            )
            continue
        fields = row["score"]["fields"]
        items = row["score"]["items"]
        elapsed = row["elapsed_ms"]
        elapsed_text = f"{elapsed:.1f}" if elapsed is not None else "-"
        lines.append(
            f"{row['document_id']:34} {row['arm']:16} "
            f"{fields['matched']:>3}/{fields['total']:<3} "
            f"{items['f1']:>9.2f} {items['row_accuracy']:>6.2f} {elapsed_text:>9}"
        )
    return "\n".join(lines)
