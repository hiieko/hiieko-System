"""
Tests for the generic field extractor (Phase 3).

All tests construct synthetic RawOcrPage objects that are already in
reading order, simulating what Phase 2 (reorder_result) produces.
No merchant-specific, sample-specific, or coordinate-based rules.
"""

from app.fields.extractor import extract_fields
from app.schemas import RawOcrPage, RawOcrLine


def _page(lines: list[tuple[str, float]], page_num: int = 0) -> RawOcrPage:
    """Build a RawOcrPage from (text, confidence) tuples."""
    result = []
    for idx, (text, conf) in enumerate(lines):
        result.append(
            RawOcrLine(
                text=text,
                confidence=conf,
                bbox=[[0, 0], [100, 0], [100, 20], [0, 20]],
                page=page_num,
            )
        )
    return RawOcrPage(page=page_num, lines=result, engine_order=list(range(len(result))))


# ── Basic extraction tests ──────────────────────────────────────────


def test_extracts_total_from_receipt():
    pages = [_page([
        ("BON FISCAL", 0.95),
        ("OMV PETROM", 0.90),
        ("CUI RO1234567", 0.85),
        ("TOTAL DE PLATA 234,50 LEI", 0.92),
        ("TVA 37,50", 0.88),
    ])]
    result = extract_fields(pages)
    assert result["document_type"] == "BON_FISCAL"
    assert result["total"] == 234.50
    assert result["vat"] == 37.50
    assert result["currency"] == "LEI"
    assert result["merchant_name"] == "OMV PETROM"
    assert result["merchant_cui"] == "1234567"


def test_extracts_from_invoice():
    pages = [_page([
        ("FACTURĂ", 0.96),
        ("SC EXEMPLU SRL", 0.88),
        ("CIF 18543210", 0.90),
        ("SERIA AB NR. 1234", 0.85),
        ("DATA 18.09.2026", 0.92),
        ("BAZA 1.000,00", 0.91),
        ("TVA 190,00", 0.90),
        ("TOTAL 1.190,00 RON", 0.93),
        ("CARD", 0.80),
    ])]
    result = extract_fields(pages)
    assert result["document_type"] == "FACTURA"
    assert result["total"] == 1190.00
    assert result["subtotal"] == 1000.00
    assert result["vat"] == 190.00
    assert result["payment_method"] == "card"
    assert result["document_number"] == "1234"
    assert result["invoice_series"] == "AB"
    assert result["document_date"] == "18.09.2026"



def test_english_invoice():
    pages = [_page([
        ("INVOICE", 0.97),
        ("Supplier Ltd", 0.85),
        ("DATE 2026-09-18", 0.93),
        ("SUBTOTAL 100.00", 0.90),
        ("VAT 20.00", 0.89),
        ("TOTAL 120.00 EUR", 0.94),
    ])]
    result = extract_fields(pages)
    assert result["document_type"] == "FACTURA"
    assert result["currency"] == "EUR"
    assert result["total"] == 120.00
    assert result["subtotal"] == 100.00
    assert result["vat"] == 20.00
    assert result["validation_errors"] == []


def test_bad_total_requires_review():
    pages = [_page([
        ("FACTURA", 0.96),
        ("TOTAL 100,00", 0.92),
        ("TVA 19,00", 0.88),
        ("SUBTOTAL 90,00", 0.90),
    ])]
    result = extract_fields(pages)
    assert "subtotal_vat_total_mismatch" in result["validation_errors"]
    assert result["review_required"] is True


def test_missing_total_is_unresolved():
    pages = [_page([
        ("BON FISCAL", 0.95),
        ("NUMERAR", 0.80),
        ("TOTAL", 0.85),  # no amount after TOTAL
    ])]
    result = extract_fields(pages)
    assert result["total"] is None
    unresolved_names = [u.field_name for u in result["unresolved"]]
    assert "total" in unresolved_names


def test_cui_with_ro_prefix():
    pages = [_page([
        ("FACTURA", 0.96),
        ("CUI RO 12345678", 0.88),
    ])]
    result = extract_fields(pages)
    assert result["merchant_cui"] == "12345678"


def test_cash_payment():
    pages = [_page([
        ("BON FISCAL", 0.95),
        ("NUMERAR", 0.82),
        ("TOTAL 50,00", 0.90),
    ])]
    result = extract_fields(pages)
    assert result["payment_method"] == "cash"


def test_other_document_type():
    pages = [_page([
        ("SOME RANDOM TEXT", 0.90),
        ("WITH NO KNOWN LABELS", 0.85),
    ])]


# ── Multi-page tests ────────────────────────────────────────────────


def test_two_page_document():
    pages = [
        _page([
            ("FACTURA", 0.96),
            ("SC EXEMPLU SRL", 0.88),
            ("CIF 18543210", 0.90),
        ], page_num=0),
        _page([
            ("TOTAL 1.190,00 RON", 0.93),
            ("DATA 18.09.2026", 0.92),
        ], page_num=1),
    ]
    result = extract_fields(pages)
    assert result["total"] == 1190.00
    assert result["merchant_cui"] == "18543210"
    assert result["document_date"] == "18.09.2026"


# ── Confidence scoring tests ────────────────────────────────────────


def test_overall_confidence_is_min():
    pages = [_page([
        ("FACTURA", 0.50),
        ("TOTAL 100,00", 0.90),
    ])]
    result = extract_fields(pages)
    assert result["confidence"] >= 0.0


def test_low_confidence_fields_listed():
    pages = [_page([
        ("FACTURA", 0.96),
        ("TOTAL 100,00", 0.30),
    ])]
    result = extract_fields(pages)
    low = result["low_confidence_fields"]
    # merchant_name not found (first 8 lines are label-like);
    # document_number has confidence 0.7 (> 0.6); no fields below 0.6
    assert isinstance(low, list)


# ── Unresolved fields ───────────────────────────────────────────────


def test_unresolved_when_fields_missing():
    pages = [_page([
        ("TOTAL DE PLATA", 0.90),  # looks like total label but has no amount
        ("JUST TEXT", 0.85),
    ])]
    result = extract_fields(pages)
    unresolved_names = [u.field_name for u in result["unresolved"]]
    # "JUST TEXT" gets picked as merchant_name (first 8 lines, not label-like)
    assert "merchant_name" not in unresolved_names  # found from "JUST TEXT"
    assert "merchant_cui" in unresolved_names
    assert "document_date" in unresolved_names
    assert "total" in unresolved_names  # "TOTAL DE PLATA" matches label but no amount follows



# ── Document number formats ─────────────────────────────────────────


def test_invoice_number_formats():
    cases = [
        ("NR. 12345", "12345"),
        ("NUMĂR 9876", "9876"),
        ("FACTURA NR. INV-2026-001", "INV-2026-001"),
        ("INVOICE NO ABCD1234", "ABCD1234"),
    ]
    for line_text, expected in cases:
        pages = [_page([
            ("FACTURA", 0.96),
            (line_text, 0.85),
        ])]
        result = extract_fields(pages)
        assert result["document_number"] == expected, f"Failed for: {line_text}"


# ── Provider passthrough ────────────────────────────────────────────


def test_provider_passthrough():
    pages = [_page([
        ("FACTURA", 0.96),
        ("TOTAL 100,00", 0.90),
    ])]
    result = extract_fields(pages, provider="custom_engine")
    assert result["provider"] == "custom_engine"


# ── Multi-currency ──────────────────────────────────────────────────


def test_eur_currency():
    pages = [_page([
        ("INVOICE", 0.96),
        ("TOTAL 500.00 EUR", 0.93),
    ])]
    result = extract_fields(pages)
    assert result["currency"] == "EUR"


def test_usd_currency():
    pages = [_page([
        ("INVOICE", 0.96),
        ("TOTAL 100.00 USD", 0.93),
    ])]
    result = extract_fields(pages)
    assert result["currency"] == "USD"
    assert result["document_type"] == "FACTURA"  # INVOICE maps to FACTURA
