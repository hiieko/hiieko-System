import os
import uuid
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from .pipeline import run_document, run_raw_document
from .engines import get_version, list_engines
from .schemas import OcrEngineInfo

app = FastAPI(title="HIIEKO PaddleOCR service", version="1.0.0")
MAX_FILE_BYTES = int(os.getenv("OCR_MAX_FILE_BYTES", "10000000"))
SERVICE_TOKEN = os.getenv("OCR_SERVICE_TOKEN", "")

ACCEPTED_MIME = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
    "application/xml",
    "text/xml",
}


@app.get("/health")
def health():
    version = get_version("paddleocr")
    return OcrEngineInfo(
        status="ok",
        provider="paddleocr",
        version=version or "",
        model=f"paddleocr-{version}" if version else "paddleocr",
    ).model_dump()


@app.post("/v1/ocr/raw")
async def ocr_raw(
    file: UploadFile = File(...),
    authorization: str | None = Header(default=None),
    x_correlation_id: str | None = Header(default=None),
):
    """Layer 1: raw OCR output — no field extraction."""
    correlation_id = x_correlation_id or str(uuid.uuid4())
    if SERVICE_TOKEN and authorization != f"Bearer {SERVICE_TOKEN}":
        raise HTTPException(401, detail={"code": "unauthorized", "correlation_id": correlation_id})
    if file.content_type not in ACCEPTED_MIME:
        raise HTTPException(415, detail={"code": "unsupported_mime", "correlation_id": correlation_id})
    content = await file.read(MAX_FILE_BYTES + 1)
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(413, detail={"code": "file_too_large", "correlation_id": correlation_id})
    try:
        raw = run_raw_document(content, file.content_type or "application/octet-stream")
        return {
            "correlation_id": correlation_id,
            "document_state": "ocr_completed",
            "raw": raw.model_dump(),
        }
    except Exception as exc:
        raise HTTPException(422, detail={"code": "processing_failed", "message": str(exc), "correlation_id": correlation_id})


@app.post("/v1/ocr/document")
async def ocr_document(
    file: UploadFile = File(...),
    authorization: str | None = Header(default=None),
    x_correlation_id: str | None = Header(default=None),
):
    """Layer 1 + Layer 2: full OCR with field extraction."""
    correlation_id = x_correlation_id or str(uuid.uuid4())
    if SERVICE_TOKEN and authorization != f"Bearer {SERVICE_TOKEN}":
        raise HTTPException(401, detail={"code": "unauthorized", "correlation_id": correlation_id})
    if file.content_type not in ACCEPTED_MIME:
        raise HTTPException(415, detail={"code": "unsupported_mime", "correlation_id": correlation_id})
    content = await file.read(MAX_FILE_BYTES + 1)
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(413, detail={"code": "file_too_large", "correlation_id": correlation_id})
    try:
        result = run_document(content, file.content_type or "application/octet-stream")
        # Compute document_state based on extraction confidence
        doc_state = (
            "failed"
            if result.fields and all(
                f.confidence is not None and f.confidence < 0.3
                for f in result.fields.values()
            )
            else "needs_review"
            if result.low_confidence_fields or result.unresolved or result.review_required
            else "ocr_completed"
        )
        return {
            "correlation_id": correlation_id,
            "document_state": doc_state,
            "ocr": result.model_dump(),
        }
    except Exception as exc:
        raise HTTPException(422, detail={"code": "processing_failed", "message": str(exc), "correlation_id": correlation_id})


