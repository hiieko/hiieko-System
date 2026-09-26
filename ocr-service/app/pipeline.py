"""OCR pipeline — orchestrates engine, reading-order, extraction, and e-Factura parsing."""

import hashlib
from .engines import run_ocr
from .parser_ro import parse_text
from .schemas import RawOcrResult, NormalizedDocument, Recognition
from .layout import reorder_result
from .fields.extractor import extract_fields


def parse_efactura(content: bytes) -> NormalizedDocument:
    import xml.etree.ElementTree as ET

    root = ET.fromstring(content)
    tags = {
        element.tag.rsplit("}", 1)[-1].lower(): (element.text or "").strip()
        for element in root.iter()
        if (element.text or "").strip()
    }
    structured = [
        f"FACTURA {tags.get('id', '')}",
        f"CUI {tags.get('companyid', '')}",
        f"DATA {tags.get('issuedate', '')}",
        f"TOTAL {tags.get('payableamount', '')} {tags.get('documentcurrencycode', 'RON')}",
    ]
    text = " ".join(
        structured + [value.strip() for value in root.itertext() if value.strip()]
    )
    result = parse_text(text, "efactura_xml")
    result.raw_text = text[:20000]
    result.review_required = True
    return result


def run_raw_document(content: bytes, mime_type: str) -> RawOcrResult:
    """Layer 1: raw OCR output — no field extraction."""
    if mime_type in ("application/xml", "text/xml") or content.lstrip().startswith(
        b"<?xml"
    ):
        import hashlib

        import xml.etree.ElementTree as ET

        root = ET.fromstring(content)
        tags = {
            element.tag.rsplit("}", 1)[-1].lower(): (element.text or "").strip()
            for element in root.iter()
            if (element.text or "").strip()
        }
        text = " ".join(
            [value.strip() for value in root.itertext() if value.strip()]
        )
        digest = hashlib.sha256(content).hexdigest()
        from .schemas import RawOcrPage, RawOcrLine

        return RawOcrResult(
            pages=[
                RawOcrPage(
                    page=0,
                    lines=[
                        RawOcrLine(text=text, confidence=1.0, bbox=[[0, 0], [0, 0], [0, 0], [0, 0]], page=0)
                    ],
                    engine_order=[0],
                )
            ],
            ordered_text=text,
            engine="efactura_xml",
            engine_version="",
            document_hash=digest,
        )
    return run_ocr(content, mime_type)


def run_document(content: bytes, mime_type: str) -> NormalizedDocument:
    """Layer 1 + Layer 2: full OCR with field extraction."""
    digest = hashlib.sha256(content).hexdigest()
    if mime_type in ("application/xml", "text/xml") or content.lstrip().startswith(
        b"<?xml"
    ):
        result = parse_efactura(content)
    else:
        raw = run_raw_document(content, mime_type)
        # Phase 2: reorder pages into reading order
        reordered_pages = reorder_result(raw.pages)
        # Phase 3: extract fields from reordered pages
        extracted = extract_fields(reordered_pages)
        recognition = []
        for page in reordered_pages:
            for line in page.lines:
                recognition.append(
                    Recognition(
                        text=line.text,
                        confidence=line.confidence,
                        box=line.bbox,
                    )
                )
        result = NormalizedDocument(
            document_type=extracted["document_type"],
            merchant_name=extracted["merchant_name"],
            merchant_cui=extracted["merchant_cui"],
            invoice_series=extracted["invoice_series"],
            document_number=extracted["document_number"],
            document_date=extracted["document_date"],
            currency=extracted["currency"],
            subtotal=extracted["subtotal"],
            vat=extracted["vat"],
            total=extracted["total"],
            payment_method=extracted["payment_method"],
            raw_text=_all_text(reordered_pages)[:20000],
            provider=extracted["provider"],
            confidence=extracted["confidence"],
            fields=extracted["fields"],
            low_confidence_fields=extracted["low_confidence_fields"],
            unresolved=extracted["unresolved"],
            review_required=extracted["review_required"],
            validation_errors=extracted["validation_errors"],
            recognition=recognition,
        )
    result.document_hash = digest
    return result


def _all_text(pages: list) -> str:
    """Join all line texts in reading order."""
    return "\n".join(
        line.text for page in pages for line in page.lines
    )
