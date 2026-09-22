import hashlib
import os
from .parser_ro import parse_text
from .schemas import NormalizedDocument, Recognition


def _result_value(item: object, name: str, default: object):
    if isinstance(item, dict):
        return item.get(name, default)
    payload = getattr(item, "json", None)
    if isinstance(payload, dict):
        result = payload.get("res")
        if isinstance(result, dict) and name in result:
            return result[name]
    return getattr(item, name, default)


def parse_efactura(content: bytes) -> NormalizedDocument:
    import xml.etree.ElementTree as ET
    root = ET.fromstring(content)
    tags = {element.tag.rsplit("}", 1)[-1].lower(): (element.text or "").strip() for element in root.iter() if (element.text or "").strip()}
    structured = [
        f"FACTURA {tags.get('id', '')}",
        f"CUI {tags.get('companyid', '')}",
        f"DATA {tags.get('issuedate', '')}",
        f"TOTAL {tags.get('payableamount', '')} {tags.get('documentcurrencycode', 'RON')}",
    ]
    text = " ".join(structured + [value.strip() for value in root.itertext() if value.strip()])
    result = parse_text(text, "efactura_xml")
    result.raw_text = text[:20000]
    result.review_required = True
    return result


def run_document(content: bytes, mime_type: str) -> NormalizedDocument:
    digest = hashlib.sha256(content).hexdigest()
    if mime_type in ("application/xml", "text/xml") or content.lstrip().startswith(b"<?xml"):
        result = parse_efactura(content)
    else:
        os.environ.setdefault("PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT", "False")
        from paddleocr import PaddleOCR
        from .preprocess import preprocess_image
        ocr = PaddleOCR(lang="ro", use_doc_orientation_classify=True, use_doc_unwarping=True)
        images = [content]
        if mime_type == "application/pdf":
            import fitz
            document = fitz.open(stream=content, filetype="pdf")
            images = [page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False).tobytes("png") for page in document]
        text_parts = []
        recognition = []
        for image in images:
            result_data = ocr.predict(preprocess_image(image))
            for item in result_data:
                values = _result_value(item, "rec_texts", [])
                scores = _result_value(item, "rec_scores", [])
                boxes = _result_value(item, "rec_polys", [])
                for index, text in enumerate(values):
                    text_parts.append(str(text))
                    score = scores[index] if index < len(scores) else None
                    box = boxes[index].tolist() if index < len(boxes) and hasattr(boxes[index], "tolist") else boxes[index] if index < len(boxes) else None
                    recognition.append(Recognition(text=str(text), confidence=float(score) if score is not None else None, box=box))
        result = parse_text("\n".join(text_parts))
        result.recognition = recognition
    result.document_hash = digest
    return result
