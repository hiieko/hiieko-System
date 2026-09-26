"""
Layer 1 contract tests — raw OCR output without field extraction.

These tests use a fake engine to verify the contract independently of
PaddleOCR. The fake engine is registered via the engine registry.
"""

from app.schemas import RawOcrResult, RawOcrPage, RawOcrLine


class _FakeEngine:
    """A fake OCR engine for contract testing."""

    @staticmethod
    def run_ocr(content: bytes, mime_type: str) -> RawOcrResult:
        """Return a deterministic RawOcrResult for testing."""
        lines = [
            RawOcrLine(
                text="BON FISCAL",
                confidence=0.95,
                bbox=[[10, 0], [200, 0], [200, 30], [10, 30]],
                page=0,
            ),
            RawOcrLine(
                text="MAGAZIN TEST SRL",
                confidence=0.92,
                bbox=[[10, 35], [250, 35], [250, 55], [10, 55]],
                page=0,
            ),
            RawOcrLine(
                text="CUI RO12345678",
                confidence=0.88,
                bbox=[[10, 60], [200, 60], [200, 80], [10, 80]],
                page=0,
            ),
            RawOcrLine(
                text="TOTAL 123,45 LEI",
                confidence=0.90,
                bbox=[[10, 85], [200, 85], [200, 105], [10, 105]],
                page=0,
            ),
        ]
        page = RawOcrPage(
            page=0,
            lines=lines,
            engine_order=list(range(len(lines))),
        )
        return RawOcrResult(
            pages=[page],
            ordered_text="BON FISCAL\nMAGAZIN TEST SRL\nCUI RO12345678\nTOTAL 123,45 LEI",
            engine="fake",
            engine_version="0.0.0-test",
            document_hash="abc123",
        )


def test_raw_ocr_result_shape():
    """RawOcrResult has the expected fields and types."""
    result = _FakeEngine.run_ocr(b"", "image/jpeg")

    assert isinstance(result, RawOcrResult)
    assert isinstance(result.pages, list)
    assert len(result.pages) >= 1
    assert isinstance(result.ordered_text, str)
    assert result.engine == "fake"
    assert result.document_hash == "abc123"


def test_raw_ocr_page_shape():
    """Each RawOcrPage has the expected structure."""
    result = _FakeEngine.run_ocr(b"", "image/jpeg")
    page = result.pages[0]

    assert isinstance(page, RawOcrPage)
    assert page.page == 0
    assert isinstance(page.lines, list)
    assert isinstance(page.engine_order, list)
    assert len(page.engine_order) == len(page.lines)


def test_raw_ocr_line_shape():
    """Each RawOcrLine has the expected fields."""
    result = _FakeEngine.run_ocr(b"", "image/jpeg")
    line = result.pages[0].lines[0]

    assert isinstance(line, RawOcrLine)
    assert isinstance(line.text, str)
    assert isinstance(line.confidence, float)
    assert isinstance(line.bbox, list)
    assert len(line.bbox) == 4  # quadrilateral
    assert all(len(point) == 2 for point in line.bbox)  # (x, y) pairs
    assert isinstance(line.page, int)


def test_raw_ocr_confidence_range():
    """Confidence values are within [0, 1]."""
    result = _FakeEngine.run_ocr(b"", "image/jpeg")
    for page in result.pages:
        for line in page.lines:
            assert 0.0 <= line.confidence <= 1.0


def test_raw_ocr_bbox_format():
    """Bounding boxes are [[x1,y1],[x2,y1],[x2,y2],[x1,y2]]."""
    result = _FakeEngine.run_ocr(b"", "image/jpeg")
    for page in result.pages:
        for line in page.lines:
            # Each bbox has 4 points
            assert len(line.bbox) == 4
            # Each point has 2 coordinates
            for point in line.bbox:
                assert len(point) == 2
                assert isinstance(point[0], float)
                assert isinstance(point[1], float)


def test_raw_ocr_ordered_text_matches_lines():
    """ordered_text is derived from line texts in engine order."""
    result = _FakeEngine.run_ocr(b"", "image/jpeg")
    expected = "\n".join(
        result.pages[0].lines[i].text
        for i in result.pages[0].engine_order
    )
    assert result.ordered_text == expected


def test_raw_ocr_round_trips_through_model_dump():
    """RawOcrResult can be serialized and deserialized."""
    result = _FakeEngine.run_ocr(b"", "image/jpeg")
    dumped = result.model_dump()
    restored = RawOcrResult.model_validate(dumped)

    assert restored.engine == result.engine
    assert len(restored.pages) == len(result.pages)
    assert len(restored.pages[0].lines) == len(result.pages[0].lines)
    for original, restored_line in zip(
        result.pages[0].lines, restored.pages[0].lines
    ):
        assert original.text == restored_line.text
        assert original.confidence == restored_line.confidence
        assert original.bbox == restored_line.bbox
