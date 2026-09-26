"""
PaddleOCR engine adapter — the ONLY module that imports paddleocr.

Exposes a uniform `run_ocr(content: bytes, mime_type: str) -> RawOcrResult`
interface so the rest of the pipeline never depends on the PaddleOCR API.

Supports:
  - image/jpeg, image/png, image/webp
  - application/pdf (rasterised via PyMuPDF)

Callers never import paddleocr directly.
"""

import hashlib
import os
from ..schemas import RawOcrResult, RawOcrPage, RawOcrLine


def _get_version() -> str:
    try:
        from paddleocr import __version__

        return __version__
    except Exception:
        return ""


# ── Global singleton: loaded once at import time ──────────────────────────
_ocr_instance = None


def _get_ocr():
    global _ocr_instance
    if _ocr_instance is None:
        # PaddlePaddle 3.3.x has a oneDNN bug on Windows; pin to 3.2.x.
        os.environ.setdefault("PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT", "False")
        from paddleocr import PaddleOCR

        _ocr_instance = PaddleOCR(
            lang="ro",
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
        )
    return _ocr_instance


def run_ocr(content: bytes, mime_type: str) -> RawOcrResult:
    """Run PaddleOCR on an image or PDF and return Layer 1 raw result."""
    digest = hashlib.sha256(content).hexdigest()

    from ..preprocess import preprocess_image

    ocr = _get_ocr()

    images: list[bytes] = [content]
    if mime_type == "application/pdf":
        import fitz

        document = fitz.open(stream=content, filetype="pdf")
        images = [
            page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False).tobytes("png")
            for page in document
        ]

    pages: list[RawOcrPage] = []
    for page_idx, image_bytes in enumerate(images):
        result_data = ocr.predict(preprocess_image(image_bytes))
        lines: list[RawOcrLine] = []
        engine_order: list[int] = []
        for item in result_data:
            values = _result_value(item, "rec_texts", [])
            scores = _result_value(item, "rec_scores", [])
            boxes = _result_value(item, "rec_polys", [])
            for index, text in enumerate(values):
                score = scores[index] if index < len(scores) else 0.0
                box = _to_bbox(boxes[index]) if index < len(boxes) else [[0, 0], [0, 0], [0, 0], [0, 0]]
                lines.append(
                    RawOcrLine(
                        text=str(text),
                        confidence=float(score),
                        bbox=box,
                        page=page_idx,
                    )
                )
                engine_order.append(len(lines) - 1)
        pages.append(
            RawOcrPage(page=page_idx, lines=lines, engine_order=engine_order)
        )

    ordered_text = "\n".join(
        line.text for page in pages for line in page.lines
    )

    return RawOcrResult(
        pages=pages,
        ordered_text=ordered_text,
        engine="paddleocr",
        engine_version=_get_version(),
        document_hash=digest,
    )


def _result_value(item: object, name: str, default: object):
    """Extract a value from PaddleOCR 3.x predict output (dict or object)."""
    if isinstance(item, dict):
        return item.get(name, default)
    # PaddleOCR 3.7 returns OCRResult objects with attributes directly
    if hasattr(item, name):
        return getattr(item, name, default)
    # Fallback: try json property (older PaddleX format)
    payload = getattr(item, "json", None)
    if isinstance(payload, dict):
        result = payload.get("res")
        if isinstance(result, dict) and name in result:
            return result[name]
    return default


def _to_bbox(poly) -> list[list[float]]:
    """Normalise a polygon/bbox to [[x1,y1],[x2,y1],[x2,y2],[x1,y2]]."""
    if hasattr(poly, "tolist"):
        poly = poly.tolist()
    if isinstance(poly, list) and len(poly) == 4:
        if all(isinstance(p, (list, tuple)) and len(p) == 2 for p in poly):
            return [[float(v) for v in p] for p in poly]
        # flat [x1,y1,x2,y2,...]
        return [[poly[i], poly[i + 1]] for i in range(0, len(poly), 2)]
    # Handle 2D numpy arrays with shape (4,2) or (N,2)
    if hasattr(poly, '__len__') and len(poly) >= 4:
        try:
            return [[float(poly[i][0]), float(poly[i][1])] for i in range(4)]
        except (TypeError, IndexError):
            pass
    return [[0, 0], [0, 0], [0, 0], [0, 0]]
