import os
import uuid
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from .pipeline import run_document

app = FastAPI(title="HIIEKO PaddleOCR service", version="1.0.0")
MAX_FILE_BYTES = int(os.getenv("OCR_MAX_FILE_BYTES", "10000000"))
SERVICE_TOKEN = os.getenv("OCR_SERVICE_TOKEN", "")


@app.get("/health")
def health():
    return {"status": "ok", "provider": "paddleocr", "model": "PP-OCRv6"}


@app.post("/v1/ocr/document")
async def ocr_document(
    file: UploadFile = File(...),
    authorization: str | None = Header(default=None),
    x_correlation_id: str | None = Header(default=None),
):
    correlation_id = x_correlation_id or str(uuid.uuid4())
    if SERVICE_TOKEN and authorization != f"Bearer {SERVICE_TOKEN}":
        raise HTTPException(401, detail={"code": "unauthorized", "correlation_id": correlation_id})
    if file.content_type not in {"image/jpeg", "image/png", "image/webp", "application/pdf", "application/xml", "text/xml"}:
        raise HTTPException(415, detail={"code": "unsupported_mime", "correlation_id": correlation_id})
    content = await file.read(MAX_FILE_BYTES + 1)
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(413, detail={"code": "file_too_large", "correlation_id": correlation_id})
    try:
        result = run_document(content, file.content_type or "application/octet-stream")
        return {"correlation_id": correlation_id, "document_state": "needs_review", "ocr": result.model_dump()}
    except Exception as exc:
        raise HTTPException(422, detail={"code": "processing_failed", "message": str(exc), "correlation_id": correlation_id})


