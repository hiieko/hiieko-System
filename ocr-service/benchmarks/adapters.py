"""
Benchmark arms for the OCR engine spike.

Three independent arms are exposed, each returning a benchmark-only
``ArmResult`` (never a production ``NormalizedDocument``):

  * ``run_hiieko_arm``        — HIIEKO Layer-2 extractor over synthetic
                                OCR lines (no engine involved).
  * ``run_xml_arm``           — direct e-Factura / XML parsing.
  * ``run_pp_structure_v3_arm`` — PaddleOCR PP-StructureV3, opt-in.

The PP-StructureV3 arm is strictly opt-in: it refuses to run unless
``HIIEKO_BENCH_ENABLE_PADDLE=1`` and both ``paddlepaddle`` and
``paddleocr`` are importable. It never triggers an automatic model
download on its own behalf; model provisioning is the operator's
responsibility (documented in the final report).
"""

from __future__ import annotations

import importlib.util
import os
import time
from dataclasses import dataclass, field
from pathlib import Path

PP_ENABLE_ENV = "HIIEKO_BENCH_ENABLE_PADDLE"
PP_DEVICE_ENV = "HIIEKO_BENCH_DEVICE"

PREDICTION_FIELDS = (
    "document_type",
    "merchant_name",
    "merchant_cui",
    "document_number",
    "document_date",
    "currency",
    "subtotal",
    "vat",
    "total",
    "payment_method",
    "items",
)


@dataclass
class ArmResult:
    arm: str
    available: bool
    reason: str = "ok"
    elapsed_ms: float | None = None
    prediction: dict = field(default_factory=dict)
    text: str = ""
    error: str | None = None
    meta: dict = field(default_factory=dict)


def _build_pages(page_dicts: list[dict]):
    from app.schemas import RawOcrLine, RawOcrPage

    pages = []
    for page in page_dicts:
        lines = [
            RawOcrLine(
                text=line["text"],
                confidence=line.get("confidence", 0.9),
                bbox=line.get("bbox", [[0, 0], [1, 0], [1, 1], [0, 1]]),
                page=page.get("page", 0),
            )
            for line in page["lines"]
        ]
        pages.append(
            RawOcrPage(
                page=page.get("page", 0),
                lines=lines,
                engine_order=list(range(len(lines))),
            )
        )
    return pages


def _pages_from_text(text: str):
    """Wrap plain text lines as synthetic pages for the HIIEKO extractor."""
    lines = [line for line in text.splitlines() if line.strip()]
    return _build_pages(
        [
            {
                "page": 0,
                "lines": [
                    {
                        "text": line,
                        "confidence": 1.0,
                        "bbox": [[0, i * 20], [1000, i * 20], [1000, i * 20 + 18], [0, i * 20 + 18]],
                    }
                    for i, line in enumerate(lines)
                ],
            }
        ]
    )


def _extract_prediction(result: dict) -> dict:
    prediction = {name: result.get(name) for name in PREDICTION_FIELDS if name != "items"}
    prediction["items"] = [item.model_dump() for item in result.get("items", [])]
    return prediction


def run_hiieko_arm(fixture: dict) -> ArmResult:
    from app.fields.extractor import extract_fields

    pages = _build_pages(fixture["hiieko_input"]["pages"])
    started = time.perf_counter()
    result = extract_fields(pages)
    elapsed_ms = (time.perf_counter() - started) * 1000
    return ArmResult(
        arm="hiieko",
        available=True,
        elapsed_ms=elapsed_ms,
        prediction=_extract_prediction(result),
        meta={
            "note": "HIIEKO Layer-2 extractor over synthetic OCR lines; "
            "no OCR engine is executed.",
            "pages": len(pages),
        },
    )


def run_xml_arm(fixture: dict, fixtures_dir: Path) -> ArmResult:
    from app.pipeline import parse_efactura

    relative = fixture.get("xml_input")
    if not relative:
        return ArmResult(arm="xml_efactura", available=False, reason="fixture has no xml_input")

    started = time.perf_counter()
    document = parse_efactura((fixtures_dir / relative).read_bytes())
    elapsed_ms = (time.perf_counter() - started) * 1000
    dump = document.model_dump()
    return ArmResult(
        arm="xml_efactura",
        available=True,
        elapsed_ms=elapsed_ms,
        prediction=dump,
        text=dump.get("raw_text", ""),
        meta={"provider": dump.get("provider")},
    )


def pp_structure_v3_status() -> tuple[bool, str]:
    if os.getenv(PP_ENABLE_ENV) != "1":
        return False, f"disabled (set {PP_ENABLE_ENV}=1 and provision models out-of-band)"
    if importlib.util.find_spec("paddle") is None:
        return False, "paddlepaddle is not installed"
    if importlib.util.find_spec("paddleocr") is None:
        return False, "paddleocr is not installed"
    return True, "ok"


def normalize_pp_structure_result(result: object) -> dict:
    """
    Map one PP-StructureV3 result object to benchmark-only fields.

    Pure and defensive because the result shape varies across 3.x
    releases: accepts dict-like or attribute access, reads ``markdown``,
    ``rec_texts`` or a nested ``overall_ocr_res``.
    """

    def get(key: str, default=None):
        try:
            return result[key]  # type: ignore[index]
        except Exception:
            pass
        return getattr(result, key, default)

    markdown = get("markdown", "") or ""
    rec_texts = get("rec_texts", None)
    if rec_texts is None:
        overall = get("overall_ocr_res", None)
        if isinstance(overall, dict):
            rec_texts = overall.get("rec_texts", [])
        elif overall is not None:
            rec_texts = getattr(overall, "rec_texts", [])
        else:
            rec_texts = []
    rec_texts = [str(item) for item in (rec_texts or [])]
    text = markdown.strip() or "\n".join(rec_texts)
    return {"markdown": markdown, "rec_texts": rec_texts, "text": text}


def run_pp_structure_v3_arm(fixture: dict, fixtures_dir: Path) -> ArmResult:
    available, reason = pp_structure_v3_status()
    if not available:
        return ArmResult(arm="pp_structure_v3", available=False, reason=reason)

    relative = fixture.get("image_input")
    if not relative:
        return ArmResult(
            arm="pp_structure_v3",
            available=False,
            reason="fixture has no image_input (no synthetic image is generated)",
        )

    from paddleocr import PPStructureV3

    lang = fixture.get("pp_lang", "latin")
    device = os.getenv(PP_DEVICE_ENV, "cpu")
    try:
        pipeline = PPStructureV3(lang=lang, device=device)
        started = time.perf_counter()
        output = pipeline.predict(str(fixtures_dir / relative))
        elapsed_ms = (time.perf_counter() - started) * 1000
    except Exception as exc:  # pragma: no cover - requires real models
        return ArmResult(arm="pp_structure_v3", available=True, error=str(exc))

    normalized = [normalize_pp_structure_result(item) for item in output]
    text = "\n".join(page["text"] for page in normalized if page["text"])

    prediction: dict = {}
    extractor_error = None
    if text:
        try:
            from app.fields.extractor import extract_fields

            prediction = _extract_prediction(extract_fields(_pages_from_text(text)))
        except Exception as exc:  # pragma: no cover
            extractor_error = str(exc)

    return ArmResult(
        arm="pp_structure_v3",
        available=True,
        elapsed_ms=elapsed_ms,
        prediction=prediction,
        text=text,
        error=extractor_error,
        meta={"lang": lang, "device": device, "pages": len(normalized)},
    )
