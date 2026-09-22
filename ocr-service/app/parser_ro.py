import re
from .schemas import NormalizedDocument, OcrField
from .validators import parse_amount, valid_cui, valid_date, validate_totals

LABELS = {
    "total": r"(?:TOTAL(?:\s+DE\s+PLAT[AĂĂ]| GENERAL)?|SUMA\s+DE\s+PLAT[AĂĂ])",
    "subtotal": r"(?:SUBTOTAL|BAZA(?:\s+IMPOZITARE)?|TOTAL\s+BUNURI|NET)",
    "vat": r"(?:TVA|VAT)",
    "cui": r"(?:CUI|CIF|C\.I\.F\.|COD\s+FISCAL|RO)",
}


def _amount_after(pattern: str, text: str) -> float | None:
    match = re.search(r"\b" + pattern + r"\b\s*[:.]?\s*(?:\d{1,2}\s*%\s*)?([0-9][0-9\s.,]*[0-9])", text, re.I)
    return parse_amount(match.group(1)) if match else None


def parse_text(text: str, provider: str = "paddleocr") -> NormalizedDocument:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    upper = text.upper()
    currency_match = re.search(r"\b(RON|LEI|EUR|USD)\b", upper)
    cui_match = re.search(LABELS["cui"] + r"\s*[:.]?\s*(?:RO)?\s*(\d{2,10})", upper)
    date_match = re.search(r"\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b", text)
    number_match = re.search(r"(?:NR\.?|NUM[AĂ]R|FACTURA)\s*[:.]?\s*(?:ID\s*)?([A-Z0-9/-]{2,20})", upper)
    series_match = re.search(r"SERIA\s*[:.]?\s*([A-Z0-9-]{1,10})", upper)
    total = _amount_after(LABELS["total"], text)
    vat = _amount_after(LABELS["vat"], text)
    subtotal = _amount_after(LABELS["subtotal"], text)
    merchant = next((line for line in lines[:8] if not re.search(r"(FACTUR|BON|TOTAL|TVA|CUI|DATA|NR\.)", line, re.I) and not line.isdigit()), None)
    fields = {}
    def add(name: str, value: object, confidence: float):
        if value is not None:
            fields[name] = OcrField(value=value, confidence=confidence)
    add("merchant_name", merchant, 0.65)
    add("merchant_cui", cui_match.group(1) if cui_match else None, 0.85 if valid_cui(cui_match.group(1) if cui_match else None) else 0.3)
    add("document_date", date_match.group(1) if date_match else None, 0.85 if valid_date(date_match.group(1) if date_match else None) else 0.3)
    add("document_number", number_match.group(1) if number_match else None, 0.7)
    for name, value in (("subtotal", subtotal), ("vat", vat), ("total", total)):
        add(name, value, 0.85 if value is not None else 0)
    payment = "card" if re.search(r"\b(CARD|CARDURI|POS)\b", upper) else "cash" if re.search(r"\b(NUMERAR|CASH)\b", upper) else None
    add("payment_method", payment, 0.8)
    errors = validate_totals(subtotal, vat, total)
    confidence = min((field.confidence or 0 for field in fields.values()), default=0.0)
    low = [name for name, field in fields.items() if (field.confidence or 0) < 0.6]
    return NormalizedDocument(
        document_type="FACTURA" if re.search(r"FACTUR[AĂĂ]|INVOICE", upper) else "BON_FISCAL" if re.search(r"BON\s+FISCAL|RECEIPT", upper) else "OTHER",
        merchant_name=merchant,
        merchant_cui=cui_match.group(1) if cui_match else None,
        invoice_series=series_match.group(1) if series_match else None,
        document_number=number_match.group(1) if number_match else None,
        document_date=date_match.group(1) if date_match else None,
        currency=currency_match.group(1) if currency_match else None,
        subtotal=subtotal, vat=vat, total=total, payment_method=payment,
        raw_text=text[:20000], provider=provider, confidence=confidence,
        fields=fields, low_confidence_fields=low, review_required=True,
        validation_errors=errors,
    )
