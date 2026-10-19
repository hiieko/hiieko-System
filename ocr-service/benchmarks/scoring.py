"""
Ground-truth scoring for the OCR engine benchmark.

Pure, dependency-free helpers so they work in any environment (and in
unit tests) without PaddleOCR installed. No production module imports
this file.

Field-level comparison is exact after normalisation for text fields,
numeric within a tolerance for money fields, digit-normalised for CUI
and calendar-normalised for dates. A ground-truth value of ``None``
means "not applicable for this document" and is excluded from scoring
rather than counted as a miss.
"""

from __future__ import annotations

import re
from datetime import date, datetime

_WS_RE = re.compile(r"\s+")
_NON_DIGIT_RE = re.compile(r"[^0-9]")
_TOKEN_RE = re.compile(r"[a-z0-9ăâîșț]+")

TEXT_FIELDS = (
    "merchant_name",
    "document_number",
    "document_date",
    "currency",
    "payment_method",
    "document_type",
)
NUMERIC_FIELDS = ("subtotal", "vat", "total")
CUI_FIELDS = ("merchant_cui",)
ALL_FIELDS = TEXT_FIELDS + NUMERIC_FIELDS + CUI_FIELDS

ITEM_NUMERIC_FIELDS = ("quantity", "unit_price", "total")
DEFAULT_ABS_TOL = 0.01


def normalize_text(value: object) -> str:
    if value is None:
        return ""
    return _WS_RE.sub(" ", str(value)).strip().casefold()


def tokens(value: object) -> list[str]:
    return _TOKEN_RE.findall(normalize_text(value))


def token_f1(predicted: object, truth: object) -> float:
    """Token-level F1 for descriptive text (a softer merchant-name metric)."""
    pred_tokens = tokens(predicted)
    truth_tokens = tokens(truth)
    if not truth_tokens:
        return 1.0 if not pred_tokens else 0.0
    from collections import Counter

    remaining = Counter(truth_tokens)
    overlap = 0
    for token in pred_tokens:
        if remaining[token] > 0:
            remaining[token] -= 1
            overlap += 1
    if overlap == 0:
        return 0.0
    precision = overlap / len(pred_tokens)
    recall = overlap / len(truth_tokens)
    return 2 * precision * recall / (precision + recall)


def canonical_cui(value: object) -> str:
    if value is None:
        return ""
    return _NON_DIGIT_RE.sub("", str(value).upper())


def parse_date(value: object) -> date | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    for fmt in ("%d.%m.%Y", "%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def numeric_match(predicted: object, truth: object, abs_tol: float = DEFAULT_ABS_TOL) -> bool:
    if predicted is None or truth is None:
        return predicted is None and truth is None
    try:
        return abs(float(predicted) - float(truth)) <= abs_tol
    except (TypeError, ValueError):
        return False


def field_match(field: str, predicted: object, truth: object, abs_tol: float = DEFAULT_ABS_TOL) -> bool:
    if field in CUI_FIELDS:
        pred_cui = canonical_cui(predicted)
        return pred_cui != "" and pred_cui == canonical_cui(truth)
    if field in NUMERIC_FIELDS:
        return numeric_match(predicted, truth, abs_tol)
    if field == "document_date":
        pred_date = parse_date(predicted)
        return pred_date is not None and pred_date == parse_date(truth)
    return normalize_text(predicted) == normalize_text(truth) and normalize_text(truth) != ""


def score_fields(
    prediction: dict,
    ground_truth: dict,
    abs_tol: float = DEFAULT_ABS_TOL,
) -> dict:
    results: dict[str, bool] = {}
    f1_values: dict[str, float] = {}
    for field in ALL_FIELDS:
        truth = ground_truth.get(field)
        if truth is None or truth == "":
            continue
        predicted = prediction.get(field)
        results[field] = field_match(field, predicted, truth, abs_tol)
        if field == "merchant_name":
            f1_values[field] = token_f1(predicted, truth)
    total = len(results)
    matched = sum(1 for value in results.values() if value)
    return {
        "fields": results,
        "matched": matched,
        "total": total,
        "accuracy": (matched / total) if total else 1.0,
        "token_f1": f1_values,
    }


def score_items(
    predicted_items: list | None,
    truth_items: list | None,
    abs_tol: float = DEFAULT_ABS_TOL,
) -> dict:
    predicted_items = predicted_items or []
    truth_items = truth_items or []

    if not truth_items:
        extra = 0 if not predicted_items else len(predicted_items)
        return {
            "truth_count": 0,
            "pred_count": len(predicted_items),
            "matched": 0,
            "precision": 1.0 if extra == 0 else 0.0,
            "recall": 1.0,
            "f1": 1.0 if extra == 0 else 0.0,
            "row_accuracy": 1.0,
            "per_field": {field: 0 for field in ITEM_NUMERIC_FIELDS},
            "field_totals": {field: 0 for field in ITEM_NUMERIC_FIELDS},
        }

    used: set[int] = set()
    per_field = {field: 0 for field in ITEM_NUMERIC_FIELDS}
    field_totals = {field: 0 for field in ITEM_NUMERIC_FIELDS}
    matched = 0
    rows_correct = 0

    for truth_item in truth_items:
        best_index = None
        for index, predicted_item in enumerate(predicted_items):
            if index in used:
                continue
            if normalize_text(predicted_item.get("description")) == normalize_text(
                truth_item.get("description")
            ):
                best_index = index
                break
        if best_index is None:
            continue
        used.add(best_index)
        matched += 1
        predicted_item = predicted_items[best_index]
        row_ok = True
        for field in ITEM_NUMERIC_FIELDS:
            truth_value = truth_item.get(field)
            if truth_value is None:
                continue
            field_totals[field] += 1
            if numeric_match(predicted_item.get(field), truth_value, abs_tol):
                per_field[field] += 1
            else:
                row_ok = False
        if row_ok:
            rows_correct += 1

    precision = matched / len(predicted_items) if predicted_items else 1.0
    recall = matched / len(truth_items)
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0
    return {
        "truth_count": len(truth_items),
        "pred_count": len(predicted_items),
        "matched": matched,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "row_accuracy": rows_correct / len(truth_items),
        "per_field": per_field,
        "field_totals": field_totals,
    }


def score_document(
    prediction: dict,
    ground_truth: dict,
    abs_tol: float = DEFAULT_ABS_TOL,
) -> dict:
    return {
        "fields": score_fields(prediction, ground_truth, abs_tol),
        "items": score_items(prediction.get("items"), ground_truth.get("items"), abs_tol),
    }
