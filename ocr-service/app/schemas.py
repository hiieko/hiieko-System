from typing import Any, Literal
from pydantic import BaseModel, Field


class OcrField(BaseModel):
    value: str | float | int | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)


class LineItem(BaseModel):
    description: str
    quantity: float | None = None
    unit_price: float | None = None
    total: float | None = None


class RawOcrLine(BaseModel):
    """A single line of OCR output from the engine — Layer 1 contract."""

    text: str
    confidence: float
    bbox: list[list[float]]  # [[x1,y1],[x2,y1],[x2,y2],[x1,y2]]
    page: int = 0


class RawOcrPage(BaseModel):
    """All lines belonging to one page — Layer 1 contract."""

    page: int
    lines: list[RawOcrLine]
    engine_order: list[int]  # indices into lines in engine-native order


class RawOcrResult(BaseModel):
    """Layer 1 output: raw OCR data before any field extraction."""

    pages: list[RawOcrPage]
    ordered_text: str = ""
    engine: str = "paddleocr"
    engine_version: str = ""
    document_hash: str = ""


class Recognition(BaseModel):
    text: str
    confidence: float | None = Field(default=None, ge=0, le=1)
    box: list[list[float]] | None = None


class UnresolvedField(BaseModel):
    """Records why a field could not be extracted — never null."""

    field_name: str
    reason: str
    candidates_considered: int = 0


class NormalizedDocument(BaseModel):
    document_type: Literal["BON_FISCAL", "FACTURA", "OTHER"] = "OTHER"
    merchant_name: str | None = None
    merchant_cui: str | None = None
    invoice_series: str | None = None
    document_number: str | None = None
    document_date: str | None = None
    due_date: str | None = None
    address: str | None = None
    currency: str | None = None
    subtotal: float | None = None
    vat: float | None = None
    vat_rates: list[float] = Field(default_factory=list)
    total: float | None = None
    payment_method: str | None = None
    items: list[LineItem] = Field(default_factory=list)
    recognition: list[Recognition] = Field(default_factory=list)
    description: str | None = None
    raw_text: str = ""
    provider: str
    confidence: float = Field(ge=0, le=1)
    fields: dict[str, OcrField] = Field(default_factory=dict)
    low_confidence_fields: list[str] = Field(default_factory=list)
    unresolved: list[UnresolvedField] = Field(default_factory=list)
    review_required: bool = True
    validation_errors: list[str] = Field(default_factory=list)
    document_hash: str | None = None


class OcrResponse(BaseModel):
    correlation_id: str
    document_state: Literal["ocr_completed", "needs_review", "failed"]
    ocr: NormalizedDocument


class RawOcrResponse(BaseModel):
    """Layer 1 API response — raw OCR data only, no field extraction."""

    correlation_id: str
    document_state: Literal["ocr_completed", "failed"]
    raw: RawOcrResult


class XmlResponse(BaseModel):
    correlation_id: str
    document_state: Literal["ocr_completed", "needs_review"]
    ocr: NormalizedDocument
    original_format: Literal["efactura_xml"] = "efactura_xml"


class OcrEngineInfo(BaseModel):
    """Reported by /health for honest engine identification."""

    status: str = "ok"
    provider: str = "paddleocr"
    version: str = ""
    model: str = ""
