from app.parser_ro import parse_text
from app.validators import parse_amount, validate_totals, valid_date


def test_fuel_receipt():
    result = parse_text("BON FISCAL\nOMV PETROM\nCUI RO1234567\nTOTAL DE PLATA 234,50 LEI\nTVA 37,50")
    assert result.document_type == "BON_FISCAL"
    assert result.total == 234.50
    assert result.currency == "LEI"


def test_invoice_variants_and_romanian_amounts():
    result = parse_text("FACTURĂ\nSC EXEMPLU SRL\nCIF 18543210\nSERIA AB NR. 1234\nDATA 18.09.2026\nBAZA 1.000,00\nTVA 190,00\nTOTAL 1.190,00 RON\nCARD")
    assert result.document_type == "FACTURA"
    assert result.total == 1190
    assert result.subtotal == 1000
    assert result.vat == 190
    assert result.payment_method == "card"


def test_english_invoice_and_validation():
    result = parse_text("INVOICE\nSupplier Ltd\nDATE 2026-09-18\nSUBTOTAL 100.00\nVAT 20.00\nTOTAL 120.00 EUR")
    assert result.document_type == "FACTURA"
    assert result.currency == "EUR"
    assert validate_totals(result.subtotal, result.vat, result.total) == []


def test_bad_total_requires_review():
    result = parse_text("FACTURA\nTOTAL 100,00\nTVA 19,00\nSUBTOTAL 90,00")
    assert "subtotal_vat_total_mismatch" in result.validation_errors
    assert result.review_required is True


def test_amounts_dates_and_missing_total():
    assert parse_amount("1.234,56") == 1234.56
    assert parse_amount("1,234.56") == 1234.56
    assert valid_date("31.02.2026") is False
    assert parse_text("BON FISCAL\nNUMERAR\nTOTAL").total is None


def test_efactura_like_xml_text_is_normalized():
    result = parse_text("FACTURA ID 1001 CUI 1234567 DATA 01/09/2026 TOTAL 59,50 RON")
    assert result.document_number == "1001"
    assert result.total == 59.5
