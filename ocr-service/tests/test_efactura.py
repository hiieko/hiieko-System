"""
Structured e-Factura (UBL) XML extraction tests.

These verify deterministic, namespace-aware extraction into the existing
``NormalizedDocument`` / ``LineItem`` schemas. They use synthetic XML
only; passing them is not evidence of real-document accuracy.
"""

import xml.etree.ElementTree as ET

import pytest

from app.efactura import parse_efactura_xml
from app.pipeline import parse_efactura

_NS = (
    'xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" '
    'xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" '
    'xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"'
)

_FULL_INVOICE = f"""<?xml version="1.0" encoding="UTF-8"?>
<Invoice {_NS}>
  <cbc:ID>F-1234</cbc:ID>
  <cbc:IssueDate>2026-09-18</cbc:IssueDate>
  <cbc:DocumentCurrencyCode>RON</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>SC EXEMPLU SRL</cbc:Name></cac:PartyName>
      <cac:PartyLegalEntity><cbc:CompanyID>18543210</cbc:CompanyID></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="RON">8.84</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="RON">46.50</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="RON">8.84</cbc:TaxAmount>
      <cac:TaxCategory><cbc:Percent>19</cbc:Percent></cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="RON">46.50</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="RON">46.50</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="RON">55.34</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="RON">55.34</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:InvoicedQuantity unitCode="EA">2</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="RON">9.00</cbc:LineExtensionAmount>
    <cac:Item><cbc:Name>Paine integrala</cbc:Name></cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="RON">4.50</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>
  <cac:InvoiceLine>
    <cbc:InvoicedQuantity unitCode="EA">6</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="RON">19.50</cbc:LineExtensionAmount>
    <cac:Item><cbc:Name>Lapte 1L</cbc:Name></cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="RON">3.25</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>
</Invoice>
"""


def test_header_fields_and_totals():
    result = parse_efactura_xml(_FULL_INVOICE.encode("utf-8"))
    assert result.document_type == "FACTURA"
    assert result.merchant_name == "SC EXEMPLU SRL"
    assert result.merchant_cui == "18543210"
    assert result.document_number == "F-1234"
    assert result.document_date == "2026-09-18"
    assert result.currency == "RON"
    assert result.subtotal == 46.50
    assert result.vat == 8.84
    assert result.total == 55.34
    assert result.provider == "efactura_xml"
    assert result.review_required is True
    assert result.validation_errors == []


def test_line_items_mapped_to_schema():
    result = parse_efactura_xml(_FULL_INVOICE.encode("utf-8"))
    assert len(result.items) == 2
    first = result.items[0]
    assert first.description == "Paine integrala"
    assert first.quantity == 2.0
    assert first.unit_price == 4.5
    assert first.total == 9.0
    second = result.items[1]
    assert second.description == "Lapte 1L"
    assert second.quantity == 6.0
    assert second.unit_price == 3.25
    assert second.total == 19.5


def test_fields_dictionary_uses_existing_schema():
    result = parse_efactura_xml(_FULL_INVOICE.encode("utf-8"))
    assert result.fields["total"].value == 55.34
    assert result.fields["merchant_cui"].value == "18543210"


def test_namespace_free_tags_are_supported():
    xml = """<Invoice>
      <ID>F-9</ID>
      <IssueDate>2026-01-02</IssueDate>
      <DocumentCurrencyCode>RON</DocumentCurrencyCode>
      <AccountingSupplierParty><Party>
        <PartyName><Name>Fara Namespace SRL</Name></PartyName>
      </Party></AccountingSupplierParty>
      <LegalMonetaryTotal>
        <TaxExclusiveAmount>10.00</TaxExclusiveAmount>
        <PayableAmount>11.90</PayableAmount>
      </LegalMonetaryTotal>
    </Invoice>"""
    result = parse_efactura_xml(xml.encode("utf-8"))
    assert result.merchant_name == "Fara Namespace SRL"
    assert result.document_number == "F-9"
    assert result.document_date == "2026-01-02"
    assert result.subtotal == 10.0
    assert result.total == 11.9


def test_alternate_namespace_prefixes_are_supported():
    xml = """<a:Invoice
        xmlns:a="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
        xmlns:b="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
      <b:ID>ALT-1</b:ID>
      <b:DocumentCurrencyCode>EUR</b:DocumentCurrencyCode>
    </a:Invoice>"""
    result = parse_efactura_xml(xml.encode("utf-8"))
    assert result.document_number == "ALT-1"
    assert result.currency == "EUR"


def test_cui_ro_prefix_is_stripped():
    xml = f"""<Invoice {_NS}>
      <cbc:ID>F-1</cbc:ID>
      <cac:AccountingSupplierParty><cac:Party>
        <cac:PartyLegalEntity><cbc:CompanyID>RO18543210</cbc:CompanyID></cac:PartyLegalEntity>
      </cac:Party></cac:AccountingSupplierParty>
    </Invoice>"""
    result = parse_efactura_xml(xml.encode("utf-8"))
    assert result.merchant_cui == "18543210"


def test_missing_optional_values_do_not_fabricate():
    xml = f'<Invoice {_NS}><cbc:ID>ONLY-ID</cbc:ID></Invoice>'
    result = parse_efactura_xml(xml.encode("utf-8"))
    assert result.document_number == "ONLY-ID"
    assert result.merchant_name is None
    assert result.merchant_cui is None
    assert result.document_date is None
    assert result.currency is None
    assert result.subtotal is None
    assert result.vat is None
    assert result.total is None
    assert result.items == []
    assert result.review_required is True


def test_empty_invoice_lines_are_skipped():
    xml = f"""<Invoice {_NS}>
      <cbc:ID>F-2</cbc:ID>
      <cac:InvoiceLine></cac:InvoiceLine>
      <cac:InvoiceLine>
        <cbc:InvoicedQuantity>1</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount>5.00</cbc:LineExtensionAmount>
        <cac:Item><cbc:Name>Produs</cbc:Name></cac:Item>
        <cac:Price><cbc:PriceAmount>5.00</cbc:PriceAmount></cac:Price>
      </cac:InvoiceLine>
    </Invoice>"""
    result = parse_efactura_xml(xml.encode("utf-8"))
    assert len(result.items) == 1
    assert result.items[0].description == "Produs"


def test_vat_falls_back_to_tax_subtotals():
    xml = f"""<Invoice {_NS}>
      <cbc:ID>F-3</cbc:ID>
      <cac:TaxTotal>
        <cac:TaxSubtotal><cbc:TaxAmount>1.10</cbc:TaxAmount></cac:TaxSubtotal>
        <cac:TaxSubtotal><cbc:TaxAmount>2.20</cbc:TaxAmount></cac:TaxSubtotal>
      </cac:TaxTotal>
    </Invoice>"""
    result = parse_efactura_xml(xml.encode("utf-8"))
    assert result.vat == pytest.approx(3.30)


def test_totals_are_decimal_safe():
    xml = f"""<Invoice {_NS}>
      <cbc:ID>F-4</cbc:ID>
      <cac:LegalMonetaryTotal>
        <cbc:TaxExclusiveAmount>0.10</cbc:TaxExclusiveAmount>
        <cbc:PayableAmount>0.30</cbc:PayableAmount>
      </cac:LegalMonetaryTotal>
    </Invoice>"""
    result = parse_efactura_xml(xml.encode("utf-8"))
    assert result.subtotal == 0.1
    assert result.total == 0.3


def test_mismatched_totals_are_flagged():
    xml = f"""<Invoice {_NS}>
      <cbc:ID>F-5</cbc:ID>
      <cac:TaxTotal><cbc:TaxAmount>9.00</cbc:TaxAmount></cac:TaxTotal>
      <cac:LegalMonetaryTotal>
        <cbc:TaxExclusiveAmount>10.00</cbc:TaxExclusiveAmount>
        <cbc:PayableAmount>30.00</cbc:PayableAmount>
      </cac:LegalMonetaryTotal>
    </Invoice>"""
    result = parse_efactura_xml(xml.encode("utf-8"))
    assert "subtotal_vat_total_mismatch" in result.validation_errors
    assert result.review_required is True


def test_malformed_xml_raises_parse_error():
    with pytest.raises(ET.ParseError):
        parse_efactura_xml(b"<Invoice><ID>F-1")


def test_unsupported_xml_is_handled_safely():
    xml = "<Order><ID>X-1</ID></Order>"
    result = parse_efactura_xml(xml.encode("utf-8"))
    assert result.document_type == "OTHER"
    assert result.fields == {}
    assert result.review_required is True


def test_pipeline_delegates_to_structured_extractor():
    result = parse_efactura(_FULL_INVOICE.encode("utf-8"))
    assert result.merchant_name == "SC EXEMPLU SRL"
    assert result.total == 55.34
    assert len(result.items) == 2
