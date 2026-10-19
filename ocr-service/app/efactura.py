"""
Deterministic, namespace-aware e-Factura (UBL) extraction.

Structured UBL XML is parsed directly instead of being flattened into
text and run through the Romanian OCR text heuristics. All lookups are
by local tag name, so any namespace prefix (or no namespace at all) is
accepted. Monetary values are handled with :class:`decimal.Decimal` and
only converted to ``float`` at the schema boundary.

Missing elements never fabricate values: absent fields stay ``None``.
Malformed (not well-formed) XML raises ``xml.etree.ElementTree.ParseError``
so the API layer can map it to a processing error, while well-formed but
unsupported XML is returned safely with empty fields.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from decimal import Decimal, InvalidOperation

from .schemas import LineItem, NormalizedDocument, OcrField
from .validators import valid_cui, valid_date, validate_totals

PROVIDER = "efactura_xml"
_INVOICE_ROOT = "invoice"
_EFACTURA_ROOTS = ("invoice", "creditnote")


def _local(tag: str) -> str:
    """Local (namespace-stripped, lower-cased) name of an element tag."""
    return tag.rpartition("}")[2].lower()


def _children(element: ET.Element, name: str) -> list[ET.Element]:
    return [child for child in element if _local(child.tag) == name]


def _first(element: ET.Element, name: str) -> ET.Element | None:
    for child in element:
        if _local(child.tag) == name:
            return child
    return None


def _descendant(element: ET.Element, name: str) -> ET.Element | None:
    for child in element.iter():
        if _local(child.tag) == name:
            return child
    return None


def _text(element: ET.Element | None) -> str | None:
    if element is None:
        return None
    text = (element.text or "").strip()
    return text or None


def _first_text(element: ET.Element | None, name: str) -> str | None:
    if element is None:
        return None
    return _text(_first(element, name))


def _descendant_text(element: ET.Element | None, name: str) -> str | None:
    if element is None:
        return None
    return _text(_descendant(element, name))


def _to_decimal(value: str | None) -> Decimal | None:
    if value is None:
        return None
    text = value.strip().replace(" ", "")
    if not text:
        return None
    try:
        return Decimal(text)
    except InvalidOperation:
        return None


def _to_float(value: Decimal | None) -> float | None:
    return float(value) if value is not None else None


def _normalize_cui(value: str | None) -> str | None:
    if value is None:
        return None
    text = value.strip().upper()
    if text.startswith("RO"):
        text = text[2:].strip()
    return text or None


def _vat(tax_total: ET.Element | None) -> Decimal | None:
    """Prefer the top-level TaxTotal/TaxAmount; fall back to summing TaxSubtotal."""
    amount = _to_decimal(_first_text(tax_total, "taxamount"))
    if amount is not None:
        return amount
    if tax_total is None:
        return None
    summed: Decimal | None = None
    for subtotal in _children(tax_total, "taxsubtotal"):
        sub_amount = _to_decimal(_first_text(subtotal, "taxamount"))
        if sub_amount is not None:
            summed = sub_amount if summed is None else summed + sub_amount
    return summed


def _line_items(root: ET.Element) -> list[LineItem]:
    items: list[LineItem] = []
    for line in _children(root, "invoiceline"):
        item = _first(line, "item")
        description = _first_text(item, "name") or _first_text(item, "description")
        quantity = _to_decimal(_first_text(line, "invoicedquantity"))
        price = _first(line, "price")
        unit_price = _to_decimal(_first_text(price, "priceamount"))
        line_total = _to_decimal(_first_text(line, "lineextensionamount"))
        if (
            description is None
            and quantity is None
            and unit_price is None
            and line_total is None
        ):
            continue
        items.append(
            LineItem(
                description=description or "",
                quantity=_to_float(quantity),
                unit_price=_to_float(unit_price),
                total=_to_float(line_total),
            )
        )
    return items


def parse_efactura_xml(content: bytes) -> NormalizedDocument:
    root = ET.fromstring(content)
    root_name = _local(root.tag)

    merchant_name: str | None = None
    merchant_cui: str | None = None
    number: str | None = None
    issue_date: str | None = None
    currency: str | None = None
    subtotal_f: float | None = None
    vat_f: float | None = None
    total_f: float | None = None
    items: list[LineItem] = []

    if root_name in _EFACTURA_ROOTS:
        supplier = _first(root, "accountingsupplierparty")
        merchant_name = _descendant_text(supplier, "registrationname")
        if merchant_name is None:
            merchant_name = _descendant_text(supplier, "name")
        merchant_cui = _normalize_cui(_descendant_text(supplier, "companyid"))

        number = _first_text(root, "id")
        issue_date = _first_text(root, "issuedate")
        currency = _first_text(root, "documentcurrencycode")

        legal = _first(root, "legalmonetarytotal")
        subtotal = _to_decimal(_first_text(legal, "taxexclusiveamount"))
        if subtotal is None:
            subtotal = _to_decimal(_first_text(legal, "lineextensionamount"))
        total = _to_decimal(_first_text(legal, "payableamount"))
        if total is None:
            total = _to_decimal(_first_text(legal, "taxinclusiveamount"))
        vat = _vat(_first(root, "taxtotal"))

        subtotal_f = _to_float(subtotal)
        vat_f = _to_float(vat)
        total_f = _to_float(total)
        items = _line_items(root)

    fields: dict[str, OcrField] = {}

    def add(name: str, value: object, confidence: float) -> None:
        if value is not None:
            fields[name] = OcrField(value=value, confidence=confidence)

    add("merchant_name", merchant_name, 0.9)
    add("merchant_cui", merchant_cui, 0.9 if valid_cui(merchant_cui) else 0.4)
    add("document_number", number, 0.9)
    add("document_date", issue_date, 0.9 if valid_date(issue_date) else 0.4)
    for name, value in (("subtotal", subtotal_f), ("vat", vat_f), ("total", total_f)):
        add(name, value, 0.9)

    if root_name == _INVOICE_ROOT:
        document_type = "FACTURA"
    else:
        document_type = "OTHER"

    validation_errors = validate_totals(subtotal_f, vat_f, total_f)
    confidence = min((field.confidence or 0.0 for field in fields.values()), default=0.0)
    low_confidence = [
        name for name, field in fields.items() if (field.confidence or 0.0) < 0.6
    ]

    raw_text = " ".join(
        value.strip() for value in root.itertext() if value and value.strip()
    )[:20000]

    return NormalizedDocument(
        document_type=document_type,
        merchant_name=merchant_name,
        merchant_cui=merchant_cui,
        document_number=number,
        document_date=issue_date,
        currency=currency,
        subtotal=subtotal_f,
        vat=vat_f,
        total=total_f,
        items=items,
        raw_text=raw_text,
        provider=PROVIDER,
        confidence=confidence,
        fields=fields,
        low_confidence_fields=low_confidence,
        review_required=True,
        validation_errors=validation_errors,
    )
