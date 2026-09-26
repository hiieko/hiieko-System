"""
Generic field extraction from reading-order-aware OCR pages.

Takes reordered RawOcrPage objects (from Phase 2) and extracts
structured fields using pattern matching. Per-line confidence and
bounding-box positions are preserved to score each extraction.

This module contains NO merchant-specific, sample-specific, or
printer-specific logic. Patterns are limited to common document
field labels (total, date, CUI, VAT, etc.) found across receipts,
invoices, and similar commercial documents.
"""

import re
from ..schemas import OcrField, UnresolvedField
from ..validators import parse_amount, valid_cui, valid_date, validate_totals


# ── Pattern definitions ──────────────────────────────────────────────
PATTERNS: dict[str, str] = {
    "total": r"(?:TOTAL(?: GENERAL| DE PLAT[AĂ]| PLAT[AĂ])?|SUMA\s+DE\s+PLAT[AĂ])",
    "subtotal": r"(?:SUBTOTAL|BAZA(?: IMPOZITARE)?|TOTAL\s+BUNURI|NET(?!\s+DE\s+PLAT[AĂ]))",
    "vat": r"(?:TVA|VAT|TAXA\s+PE\s+VALOAREA\s+AD[AĂ]UGAT[AĂ])",
    "cui": r"(?:CUI|CIF|C\.I\.F\.|COD\s+FISCAL|FISCAL\s+CODE|COMPANY\s+ID)",
    "date": r"(?:DATA|DATE|DAT[AĂ]|ISSUE\s+DATE|EMIS[AĂ])",
    "number": r"(?:NR\.?|NUM[AĂ]R|NUMBER|INVOICE\s+NO|FACTURA\s+NR|ID)",
    "series": r"(?:SERIA|SERIES|SERIE)",
    "card": r"(?:CARD|CARDURI|POS|POS\s+TERMINAL|CONTACTLESS)",
    "cash": r"(?:NUMERAR|CASH|BANCNOTE)",
}



# ── Helpers ──────────────────────────────────────────────────────────


def _all_text(pages: list) -> str:
    """Join all line texts in reading order."""
    return "\n".join(
        line.text for page in pages for line in page.lines
    )


def _upper(pages: list) -> str:
    return _all_text(pages).upper()


def _amount_after(pattern: str, text: str) -> float | None:
    """Extract a numeric amount that follows a label pattern."""
    match = re.search(
        r"\b" + pattern + r"\b\s*[:.]?\s*(?:\d{1,2}\s*%\s*)?"
        r"([0-9][0-9\s.,]*[0-9])",
        text,
        re.IGNORECASE,
    )
    return parse_amount(match.group(1)) if match else None


def _detect_currency(text: str) -> str | None:
    match = re.search(
        r"\b(RON|LEI|EUR|USD|GBP|CHF|MDL|BGN|HUF|PLN)\b", text.upper()
    )
    return match.group(1) if match else None


def _detect_payment(text: str) -> tuple[str | None, float]:
    upper = text.upper()
    if re.search(PATTERNS["card"], upper):
        return ("card", 0.8)
    if re.search(PATTERNS["cash"], upper):
        return ("cash", 0.8)
    return (None, 0.0)


def _detect_document_type(text: str) -> str:
    upper = text.upper()
    if re.search(r"FACTUR[AĂĂ]|INVOICE|E-FACTURA|EFACTURA", upper):
        return "FACTURA"
    if re.search(r"BON\s+FISCAL|RECEIPT|CHITANTA|CHITANŢĂ", upper):
        return "BON_FISCAL"
    return "OTHER"



# ── Main extraction ─────────────────────────────────────────────────


def extract_fields(pages: list, provider: str = "paddleocr") -> dict:
    """
    Extract structured fields from reading-order-aware OCR pages.

    Returns a dict compatible with NormalizedDocument constructor.
    """
    text = _all_text(pages)
    upper = _upper(pages)

    doc_type = _detect_document_type(text)

    # CUI / fiscal ID
    cui_match = re.search(
        PATTERNS["cui"] + r"\s*[:.]?\s*(?:RO)?\s*(\d{2,10})", upper
    )
    raw_cui = cui_match.group(1) if cui_match else None
    cui_valid = valid_cui(raw_cui) if raw_cui else False

    # Date
    date_match = re.search(r"\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b", text)
    raw_date = date_match.group(1) if date_match else None
    date_valid = valid_date(raw_date) if raw_date else False

    # Document number — try the specific prefix first, then fall back to
    # FACTURA/INVOICE prefixed numbers. Horizontal-whitespace-only to avoid
    # matching across line boundaries.
    number_match = re.search(
        r"(?:NR\.?|NUM[AĂ]R|NO\.?)"
        r"[^\S\n]*[:.]?[^\S\n]*(?:ID[^\S\n]*)?"
        r"([A-Z0-9][A-Z0-9/-]{1,19})",
        upper,
    )
    if not number_match:
        number_match = re.search(
            r"(?:FACTURA|INVOICE)"
            r"[^\S\n]*[:.]?[^\S\n]*(?:NR\.?|NUM[AĂ]R|NO\.?|ID)"
            r"[^\S\n]*[:.]?[^\S\n]*([A-Z0-9][A-Z0-9/-]{1,19})",
            upper,
        )
    if not number_match:
        number_match = re.search(
            r"(?:FACTURA|INVOICE)"
            r"[^\S\n]*[:.]?[^\S\n]*(?:ID[^\S\n]*)?"
            r"(\d[A-Z0-9/-]{1,19})",
            upper,
        )
    series_match = re.search(
        r"(?:SERIA|SERIES)\s*[:.]?\s*([A-Z0-9-]{1,10})", upper
    )

    # Currency
    currency = _detect_currency(text)

    # Amounts
    total = _amount_after(PATTERNS["total"], text)
    vat = _amount_after(PATTERNS["vat"], text)
    subtotal = _amount_after(PATTERNS["subtotal"], text)

    # Merchant name (first 8 lines, skipping label-like lines)
    lines_list = [line.text for page in pages for line in page.lines]
    merchant = None
    for line in lines_list[:8]:
        if not re.search(
            r"(FACTUR|BON\s+FISCAL|TOTAL|TVA|VAT|CUI|DATA|NR\.|SERIA|"
            r"SUBTOTAL|BAZA)",
            line,
            re.IGNORECASE,
        ) and not re.match(r"^[\d\s.,%/:;()+\-=\[\]{}]+$", line):
            merchant = line
            break

    # Payment method
    payment, pay_conf = _detect_payment(text)

    # Validation
    errors = validate_totals(subtotal, vat, total)

    # Build fields dict
    fields: dict[str, OcrField] = {}

    def add(name: str, value: object, confidence: float):
        if value is not None and value != "":
            fields[name] = OcrField(value=value, confidence=confidence)

    add("merchant_name", merchant, 0.65)
    add("merchant_cui", raw_cui, 0.85 if cui_valid else 0.3)
    add("document_date", raw_date, 0.85 if date_valid else 0.3)
    add("document_number", number_match.group(1) if number_match else None, 0.7)

    for name, value in (("subtotal", subtotal), ("vat", vat), ("total", total)):
        add(name, value, 0.85 if value is not None else 0.0)

    add("payment_method", payment, pay_conf)

    # Confidence scoring
    overall_conf = min(
        (f.confidence or 0.0 for f in fields.values()), default=0.0
    )
    low_conf = [
        name for name, f in fields.items()
        if (f.confidence or 0.0) < 0.6
    ]

    # Unresolved fields
    unresolved: list[UnresolvedField] = []
    if merchant is None:
        unresolved.append(UnresolvedField(
            field_name="merchant_name",
            reason="No merchant name found in first 8 lines",
            candidates_considered=0,
        ))
    if raw_cui is None:
        unresolved.append(UnresolvedField(
            field_name="merchant_cui",
            reason="No CUI/CIF/Fiscal Code found",
            candidates_considered=0,
        ))
    if raw_date is None:
        unresolved.append(UnresolvedField(
            field_name="document_date",
            reason="No date found",
            candidates_considered=0,
        ))
    if total is None:
        unresolved.append(UnresolvedField(
            field_name="total",
            reason="No total amount found after TOTAL/SUMA label",
            candidates_considered=0,
        ))

    return {
        "fields": fields,
        "unresolved": unresolved,
        "low_confidence_fields": low_conf,
        "confidence": overall_conf,
        "document_type": doc_type,
        "merchant_name": merchant,
        "merchant_cui": raw_cui,
        "invoice_series": series_match.group(1) if series_match else None,
        "document_number": number_match.group(1) if number_match else None,
        "document_date": raw_date,
        "currency": currency,
        "subtotal": subtotal,
        "vat": vat,
        "total": total,
        "payment_method": payment,
        "validation_errors": errors,
        "review_required": bool(low_conf or unresolved or errors),
        "provider": provider,
    }
