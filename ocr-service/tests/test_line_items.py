"""
Regression tests for generic line-item extraction (OCR Fix 1).

All tests construct synthetic RawOcrPage objects already in reading
order, simulating what Phase 2 (reorder_result) produces. No real
customer data and no merchant-specific rules.

Extraction contract under test:
- Only rows with OCR evidence for their numeric columns are filled.
- Ambiguous rows keep quantity/unit_price/total unset (LineItem allows
  None) so human review decides.
- Totals, VAT, subtotal, payment, and metadata lines are never
  products. Header and total field extraction is unchanged.
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


# ── 1. Multiple line items ──────────────────────────────────────────


def test_multiple_romanian_invoice_line_items():
    pages = [_page([
        ("FACTURĂ", 0.96),
        ("SC EXEMPLU SRL", 0.88),
        ("CUI 18543210", 0.90),
        ("DENUMIRE CANTITATE PRET UNITAR VALOARE", 0.90),
        ("Paine integrala 2 4,50 9,00", 0.91),
        ("Lapte 1L 6 3,25 19,50", 0.89),
        ("Ulei floarea soarelui 1 18,00 18,00", 0.90),
        ("SUBTOTAL 46,50", 0.91),
        ("TVA 19% 8,84", 0.90),
        ("TOTAL 55,34 RON", 0.93),
    ])]
    result = extract_fields(pages)
    items = result["items"]
    assert len(items) == 3

    assert items[0].description == "Paine integrala"
    assert items[0].quantity == 2
    assert items[0].unit_price == 4.50
    assert items[0].total == 9.00

    assert items[1].description == "Lapte 1L"
    assert items[1].quantity == 6
    assert items[1].unit_price == 3.25
    assert items[1].total == 19.50

    assert items[2].description == "Ulei floarea soarelui"
    assert items[2].quantity == 1
    assert items[2].unit_price == 18.00
    assert items[2].total == 18.00


# ── 2. Romanian decimal commas ──────────────────────────────────────


def test_romanian_decimal_commas_and_thousands():
    pages = [_page([
        ("BON FISCAL", 0.95),
        ("PIATA CENTRALA", 0.88),
        ("Cantitatile sunt in kilograme", 0.85),
        ("Paine rustica 2,5 12,50 31,25", 0.90),
        ("Salata de vinete 1 1.000,00 1.000,00", 0.88),
        ("TOTAL 1.031,25 LEI", 0.93),
    ])]
    result = extract_fields(pages)
    items = result["items"]
    assert len(items) == 2

    assert items[0].description == "Paine rustica"
    assert items[0].quantity == 2.5
    assert items[0].unit_price == 12.50
    assert items[0].total == 31.25

    assert items[1].description == "Salata de vinete"
    assert items[1].quantity == 1
    assert items[1].unit_price == 1000.00
    assert items[1].total == 1000.00

    # Header total with Romanian thousands/decimal separators unchanged.
    assert result["total"] == 1031.25


# ── 3. English invoice rows ─────────────────────────────────────────


def test_english_invoice_rows():
    pages = [_page([
        ("INVOICE", 0.97),
        ("Supplier Ltd", 0.85),
        ("DATE 2026-09-18", 0.93),
        ("DESCRIPTION QTY UNIT PRICE AMOUNT", 0.90),
        ("Consulting service 1 100.00 100.00", 0.91),
        ("Hosting plan 3 20.50 61.50", 0.90),
        ("SUBTOTAL 161.50", 0.91),
        ("VAT 20% 32.30", 0.90),
        ("TOTAL 193.80 EUR", 0.94),
    ])]
    result = extract_fields(pages)
    items = result["items"]
    assert len(items) == 2

    assert items[0].description == "Consulting service"
    assert items[0].quantity == 1
    assert items[0].unit_price == 100.00
    assert items[0].total == 100.00

    assert items[1].description == "Hosting plan"
    assert items[1].quantity == 3
    assert items[1].unit_price == 20.50
    assert items[1].total == 61.50

    # Document-level fields on the English layout are unchanged.
    assert result["document_type"] == "FACTURA"
    assert result["currency"] == "EUR"
    assert result["subtotal"] == 161.50
    assert result["vat"] == 32.30
    assert result["total"] == 193.80
    assert result["validation_errors"] == []


# ── 4. Missing quantities or prices ─────────────────────────────────


def test_missing_quantity_or_price_left_unset():
    pages = [_page([
        ("FACTURĂ", 0.96),
        ("Paine integrala 4,50", 0.90),
        ("Lapte 2 6,50", 0.89),
        ("Consultanta 1 120,00 120,00", 0.91),
    ])]
    result = extract_fields(pages)
    items = result["items"]
    # The single-amount row ("Paine integrala 4,50") carries no
    # unambiguous numeric column and is not emitted.
    assert len(items) == 2

    # Two columns: the first is quantity-like, but the second could be
    # a unit price or a line total, so only the quantity is trusted.
    assert items[0].description == "Lapte"
    assert items[0].quantity == 2
    assert items[0].unit_price is None
    assert items[0].total is None

    # Fully evidenced row is still extracted.
    assert items[1].description == "Consultanta"
    assert items[1].quantity == 1
    assert items[1].unit_price == 120.00
    assert items[1].total == 120.00


# ── 5. Ambiguous rows are not confidently extracted ─────────────────


def test_ambiguous_rows_stay_unset():
    pages = [_page([
        ("FACTURĂ", 0.96),
        ("Consultanta 100,00 19,00 119,00", 0.88),
        ("Paine 2 4,50 10,00", 0.87),
    ])]
    result = extract_fields(pages)
    items = result["items"]
    assert len(items) == 2

    # Leading amount is not quantity-like in context (no consistent
    # qty × unit = total): every numeric field stays unset.
    assert items[0].description == "Consultanta"
    assert items[0].quantity is None
    assert items[0].unit_price is None
    assert items[0].total is None

    # qty × unit does not match the printed total: nothing is asserted.
    assert items[1].description == "Paine"
    assert items[1].quantity is None
    assert items[1].unit_price is None
    assert items[1].total is None


def test_page_numbers_and_contact_noise_are_not_items():
    pages = [_page([
        ("FACTURĂ", 0.96),
        ("Paine 2 4,50 9,00", 0.90),
        ("1/2", 0.85),
        ("Pagina 2 din 2", 0.85),
        ("0721 123 456", 0.84),
    ])]
    result = extract_fields(pages)
    assert len(result["items"]) == 1
    assert result["items"][0].description == "Paine"


def test_discount_lines_are_not_items():
    pages = [_page([
        ("FACTURĂ", 0.96),
        ("Paine 2 4,50 9,00", 0.90),
        ("Reducere fidelitate -1,00", 0.88),
        ("TOTAL 8,00", 0.92),
    ])]
    result = extract_fields(pages)
    assert len(result["items"]) == 1
    assert result["items"][0].description == "Paine"
    assert result["total"] == 8.00


# ── 6. VAT, subtotal, and grand total excluded from products ────────


def test_totals_vat_and_payment_lines_excluded_from_items():
    pages = [_page([
        ("BON FISCAL", 0.95),
        ("MAGAZIN EXEMPLU", 0.90),
        ("CUI RO1234567", 0.86),
        ("Paine 2 4,50 9,00", 0.91),
        ("SUBTOTAL 9,00", 0.90),
        ("TVA 19% 1,71", 0.90),
        ("TOTAL DE PLATA 10,71 LEI", 0.93),
        ("NUMERAR", 0.85),
    ])]
    result = extract_fields(pages)
    items = result["items"]
    assert len(items) == 1
    assert items[0].description == "Paine"
    assert items[0].total == 9.00

    for item in items:
        upper = item.description.upper()
        assert "TOTAL" not in upper
        assert "TVA" not in upper
        assert "SUBTOTAL" not in upper

    # Document-level totals are still extracted.
    assert result["subtotal"] == 9.00
    assert result["vat"] == 1.71
    assert result["total"] == 10.71
    assert result["payment_method"] == "cash"
    assert result["document_type"] == "BON_FISCAL"


# ── 7. Multi-line descriptions and multi-page documents ────────────


def test_multi_line_description_single_page():
    pages = [_page([
        ("FACTURĂ", 0.96),
        ("Paine integrala", 0.90),
        ("cu seminte de dovleac", 0.88),
        ("2 4,50 9,00", 0.91),
        ("TOTAL 9,00 RON", 0.93),
    ])]
    result = extract_fields(pages)
    items = result["items"]
    assert len(items) == 1
    assert items[0].description == "Paine integrala cu seminte de dovleac"
    assert items[0].quantity == 2
    assert items[0].unit_price == 4.50
    assert items[0].total == 9.00


def test_multi_page_document_items_and_headers():
    pages = [
        _page([
            ("FACTURĂ", 0.96),
            ("SC EXEMPLU SRL", 0.88),
            ("CUI 18543210", 0.90),
            ("SERIA AB NR. 12", 0.85),
            ("Consultanta financiara", 0.89),
            ("pentru luna septembrie", 0.88),
        ], page_num=0),
        _page([
            ("1 350,00 350,00", 0.91),
            ("TOTAL 350,00 RON", 0.93),
            ("DATA 18.09.2026", 0.92),
        ], page_num=1),
    ]
    result = extract_fields(pages)
    items = result["items"]
    assert len(items) == 1
    assert items[0].description == "Consultanta financiara pentru luna septembrie"
    assert items[0].quantity == 1
    assert items[0].unit_price == 350.00
    assert items[0].total == 350.00

    # Headers on later pages are still extracted.
    assert result["total"] == 350.00
    assert result["document_date"] == "18.09.2026"
    assert result["merchant_cui"] == "18543210"
    assert result["document_number"] == "12"


def test_items_continue_after_page_break_totals():
    # Page 1 has its own totals; page 2 items must still be extracted.
    pages = [
        _page([
            ("FACTURĂ", 0.96),
            ("Paine 2 4,50 9,00", 0.90),
            ("SUBTOTAL 9,00", 0.90),
        ], page_num=0),
        _page([
            ("Lapte 6 3,25 19,50", 0.89),
            ("TOTAL 28,50 RON", 0.93),
        ], page_num=1),
    ]
    result = extract_fields(pages)
    items = result["items"]
    assert len(items) == 2
    assert items[0].description == "Paine"
    assert items[1].description == "Lapte"
    assert items[1].total == 19.50


# ── 8. Header and total extraction behavior preserved ───────────────


def test_header_and_total_extraction_preserved_with_items():
    pages = [_page([
        ("FACTURĂ", 0.96),
        ("SC EXEMPLU SRL", 0.88),
        ("CIF 18543210", 0.90),
        ("SERIA AB NR. 1234", 0.85),
        ("DATA 18.09.2026", 0.92),
        ("Paine integrala 2 4,50 9,00", 0.91),
        ("BAZA 9,00", 0.91),
        ("TVA 190,00", 0.90),
        ("TOTAL 1.190,00 RON", 0.93),
        ("CARD", 0.80),
    ])]
    result = extract_fields(pages)
    assert result["document_type"] == "FACTURA"
    assert result["merchant_name"] == "SC EXEMPLU SRL"
    assert result["merchant_cui"] == "18543210"
    assert result["invoice_series"] == "AB"
    assert result["document_number"] == "1234"
    assert result["document_date"] == "18.09.2026"
    assert result["subtotal"] == 9.00
    assert result["vat"] == 190.00
    assert result["total"] == 1190.00
    assert result["payment_method"] == "card"
    assert result["currency"] == "RON"

    # The product row did not disturb any of the above.
    assert len(result["items"]) == 1
    assert result["items"][0].description == "Paine integrala"
    assert result["items"][0].total == 9.00


# ── Explicit quantity syntax and continuation amounts ───────────────


def test_qty_x_price_syntax():
    pages = [_page([
        ("BON FISCAL", 0.95),
        ("Cafea 2 x 4,50 = 9,00", 0.90),
        ("2 x Apa minerala", 0.89),
        ("TOTAL 9,00", 0.92),
    ])]
    result = extract_fields(pages)
    items = result["items"]
    assert len(items) == 2
    assert items[0].description == "Cafea"
    assert items[0].quantity == 2
    assert items[0].unit_price == 4.50
    assert items[0].total == 9.00
    assert items[1].description == "Apa minerala"
    assert items[1].quantity == 2


def test_bare_amount_line_fills_missing_total():
    pages = [_page([
        ("BON FISCAL", 0.95),
        ("Paine 2 x 4,50", 0.90),
        ("9,00", 0.88),
        ("TOTAL 9,00", 0.92),
    ])]
    result = extract_fields(pages)
    items = result["items"]
    assert len(items) == 1
    assert items[0].description == "Paine"
    assert items[0].quantity == 2
    assert items[0].unit_price == 4.50
    assert items[0].total == 9.00


def test_per_line_vat_column_handled():
    pages = [_page([
        ("FACTURĂ", 0.96),
        ("Consultanta 1 500,00 95,00 595,00", 0.90),
        ("TOTAL 595,00 RON", 0.93),
    ])]
    result = extract_fields(pages)
    items = result["items"]
    assert len(items) == 1
    assert items[0].quantity == 1
    assert items[0].unit_price == 500.00
    assert items[0].total == 595.00


def test_no_items_on_documents_without_product_rows():
    pages = [_page([
        ("FACTURĂ", 0.96),
        ("SC EXEMPLU SRL", 0.88),
        ("CIF 18543210", 0.90),
        ("SERIA AB NR. 1234", 0.85),
        ("DATA 18.09.2026", 0.92),
        ("TOTAL 1.190,00 RON", 0.93),
    ])]
    result = extract_fields(pages)
    assert result["items"] == []
    assert result["total"] == 1190.00


# ── 9. OCR Fix 1.1 — summary/payment lines are not products ────────


def test_payment_and_summary_lines_not_items():
    pages = [_page([
        ("INVOICE", 0.97),
        ("Widget Co", 0.85),
        ("Consulting 1 120.00 120.00", 0.90),
        ("Payment 120.00", 0.88),
        ("Shipping 15.00", 0.88),
        ("Sales Tax 20.00", 0.87),
        ("Rest 5.00", 0.86),
        ("Balance Due 120.00", 0.86),
        ("TOTAL 120.00 USD", 0.93),
    ])]
    result = extract_fields(pages)
    items = result["items"]
    assert len(items) == 1
    assert items[0].description == "Consulting"


def test_isolated_single_amount_row_not_emitted():
    pages = [_page([
        ("INVOICE", 0.97),
        ("Consulting 1 100.00 100.00", 0.90),
        ("Gadget 25.00", 0.88),
    ])]
    result = extract_fields(pages)
    items = result["items"]
    assert len(items) == 1
    assert items[0].description == "Consulting"


# ── 10. OCR Fix 1.1 — merchant lines never leak into items ─────────


def test_first_line_merchant_not_buffered_into_item():
    pages = [_page([
        ("MAGAZIN EXEMPLU", 0.90),
        ("Paine integrala", 0.88),
        ("2 4,50 9,00", 0.91),
    ])]
    result = extract_fields(pages)
    items = result["items"]
    assert len(items) == 1
    assert items[0].description == "Paine integrala"
    assert items[0].quantity == 2
    assert items[0].unit_price == 4.50
    assert items[0].total == 9.00


def test_merchant_line_not_merged_into_inline_item():
    pages = [_page([
        ("INVOICE", 0.97),
        ("Supplier Ltd", 0.85),
        ("Consulting 1 100.00 100.00", 0.90),
    ])]
    result = extract_fields(pages)
    items = result["items"]
    assert len(items) == 1
    assert items[0].description == "Consulting"


# ── 11. OCR Fix 1.1 — two-amount rows assign quantity only ─────────


def test_two_amount_row_assigns_quantity_only():
    pages = [_page([
        ("FACTURĂ", 0.96),
        ("Paine 2 9,00", 0.90),
    ])]
    result = extract_fields(pages)
    items = result["items"]
    assert len(items) == 1
    assert items[0].description == "Paine"
    assert items[0].quantity == 2
    assert items[0].unit_price is None
    assert items[0].total is None


# ── 12. OCR Fix 1.1 — locale-aware comma/period separation ─────────


def test_ambiguous_thousands_token_skipped_when_locale_unknown():
    pages = [_page([
        ("Widgets 1,234 2.00", 0.90),
    ])]
    result = extract_fields(pages)
    assert result["items"] == []


def test_thousands_token_resolved_for_english_locale():
    pages = [_page([
        ("INVOICE", 0.97),
        ("Widgets 1,234 2.00", 0.90),
    ])]
    result = extract_fields(pages)
    items = result["items"]
    assert len(items) == 1
    assert items[0].description == "Widgets"
    assert items[0].quantity == 1234.0


def test_comma_decimals_resolved_for_romanian_locale():
    pages = [_page([
        ("FACTURĂ", 0.96),
        ("Widgets 1,234 2,00", 0.90),
    ])]
    result = extract_fields(pages)
    items = result["items"]
    assert len(items) == 1
    assert items[0].description == "Widgets"
    assert items[0].quantity == 1.234


# ── 13. OCR Fix 1.1 — DATA/DATE/COD are only metadata in context ───


def test_date_and_code_product_names_are_not_metadata():
    pages = [_page([
        ("FACTURĂ", 0.96),
        ("Data centru 1 10,00 10,00", 0.90),
        ("Date zaharoase 2 5,00 10,00", 0.89),
        ("Consumabile cod maro 1 7,00 7,00", 0.90),
        ("TOTAL 27,00 RON", 0.93),
    ])]
    result = extract_fields(pages)
    items = result["items"]
    assert len(items) == 3
    assert items[0].description == "Data centru"
    assert items[1].description == "Date zaharoase"
    assert items[2].description == "Consumabile cod maro"
    assert items[2].quantity == 1
    assert items[2].unit_price == 7.00
    assert items[2].total == 7.00


def test_date_and_code_metadata_lines_excluded():
    pages = [_page([
        ("FACTURĂ", 0.96),
        ("DATA 18.09.2026", 0.92),
        ("Cod produs 123", 0.88),
        ("Paine 2 4,50 9,00", 0.90),
        ("TOTAL 9,00 RON", 0.93),
    ])]
    result = extract_fields(pages)
    items = result["items"]
    assert len(items) == 1
    assert items[0].description == "Paine"


# ── 14. OCR Fix 1.1 — line-total tolerance is proportional ─────────


def test_implausible_line_total_rejected():
    pages = [_page([
        ("FACTURĂ", 0.96),
        ("Item 1 100,00 101,90", 0.90),
    ])]
    result = extract_fields(pages)
    items = result["items"]
    assert len(items) == 1
    assert items[0].description == "Item"
    assert items[0].quantity is None
    assert items[0].unit_price is None
    assert items[0].total is None


def test_rounding_within_tolerance_accepted():
    pages = [_page([
        ("FACTURĂ", 0.96),
        ("Rulment 2 4,505 9,01", 0.90),
    ])]
    result = extract_fields(pages)
    items = result["items"]
    assert len(items) == 1
    assert items[0].quantity == 2
    assert items[0].unit_price == 4.505
    assert items[0].total == 9.01


# ── 15. OCR Fix 1.1 — article codes are not amounts ────────────────


def test_long_numeric_code_not_treated_as_amount():
    pages = [_page([
        ("FACTURĂ", 0.96),
        ("Produs 100200300 2 5,00 10,00", 0.90),
        ("TOTAL 10,00 RON", 0.93),
    ])]
    result = extract_fields(pages)
    items = result["items"]
    assert len(items) == 1
    assert items[0].description == "Produs 100200300"
    assert items[0].quantity == 2
    assert items[0].unit_price == 5.00
    assert items[0].total == 10.00


def test_long_numeric_code_line_with_single_amount_not_item():
    pages = [_page([
        ("FACTURĂ", 0.96),
        ("Produs 100200300 5,00", 0.90),
    ])]
    result = extract_fields(pages)
    assert result["items"] == []


# ── 16. OCR Fix 1.1 — qty × description strips trailing amount ─────


def test_qty_description_syntax_strips_trailing_amount():
    pages = [_page([
        ("BON FISCAL", 0.95),
        ("2 x Paineca 9,00", 0.90),
    ])]
    result = extract_fields(pages)
    items = result["items"]
    assert len(items) == 1
    assert items[0].description == "Paineca"
    assert items[0].quantity == 2
    assert items[0].total == 9.00


# ── 17. OCR Fix 1.1 — article-count lines do not close the zone ────


def test_article_count_line_does_not_close_item_zone():
    pages = [_page([
        ("BON FISCAL", 0.95),
        ("Paine 1 10,00 10,00", 0.90),
        ("TOTAL BUCATI 3", 0.88),
        ("Lapte 1 5,00 5,00", 0.89),
    ])]
    result = extract_fields(pages)
    items = result["items"]
    assert len(items) == 2
    assert items[0].description == "Paine"
    assert items[1].description == "Lapte"
    assert items[1].total == 5.00


# ── 18. OCR Fix 1.1 — dotted amounts are not phone noise ───────────


def test_dotted_amount_not_treated_as_phone_noise():
    pages = [_page([
        ("BON FISCAL", 0.95),
        ("Paine 2 x 4,50", 0.90),
        ("123456.78", 0.88),
    ])]
    result = extract_fields(pages)
    items = result["items"]
    assert len(items) == 1
    assert items[0].description == "Paine"
    assert items[0].total == 123456.78


# ── 19. OCR Fix 1.1 — XML e-Factura path yields no items ───────────


def test_xml_efactura_path_returns_no_items():
    from app.pipeline import parse_efactura

    xml = (
        b'<?xml version="1.0" encoding="UTF-8"?>'
        b'<Invoice xmlns="urn:oasis:names:specification:'
        b'ubl:schema:xsd:Invoice-2">'
        b"<ID>F-123</ID>"
        b"<IssueDate>2026-09-18</IssueDate>"
        b"<AccountingSupplierParty><Party><PartyName>"
        b"<Name>Supplier Ltd</Name></PartyName>"
        b"<PartyTaxScheme><CompanyID>RO1234567</CompanyID>"
        b"</PartyTaxScheme></Party></AccountingSupplierParty>"
        b'<LegalMonetaryTotal><PayableAmount currencyID="RON">'
        b"119.00</PayableAmount></LegalMonetaryTotal>"
        b"</Invoice>"
    )
    doc = parse_efactura(xml)
    assert doc.provider == "efactura_xml"
    assert doc.items == []
