"""
Tests for the isolated OCR benchmark harness (PP-StructureV3 spike).

These tests must pass with no OCR engine installed: the PP-StructureV3
arm is only exercised for its graceful-skip path and for the pure
result-normalisation helper.
"""

from benchmarks import adapters
from benchmarks.adapters import (
    normalize_pp_structure_result,
    pp_structure_v3_status,
    run_pp_structure_v3_arm,
)
from benchmarks.harness import (
    DEFAULT_FIXTURES_DIR,
    format_report,
    load_documents,
    run_benchmark,
)
from benchmarks.scoring import (
    canonical_cui,
    field_match,
    numeric_match,
    parse_date,
    score_document,
    score_fields,
    score_items,
    token_f1,
)


def _fixture(document_id: str) -> dict:
    for document in load_documents():
        if document["id"] == document_id:
            return document
    raise AssertionError(f"missing fixture {document_id}")


def test_fixtures_are_loadable_and_synthetic():
    documents = load_documents()
    assert len(documents) >= 3
    for document in documents:
        assert document["source"] == "synthetic"
        assert "ground_truth" in document


def test_numeric_match_tolerance():
    assert numeric_match(55.34, 55.34)
    assert numeric_match(55.34, 55.335, abs_tol=0.01)
    assert not numeric_match(55.34, 55.0)
    assert numeric_match(None, None)
    assert not numeric_match(None, 1.0)
    assert not numeric_match("abc", 1.0)


def test_parse_date_formats():
    assert parse_date("18.09.2026") == parse_date("2026-09-18")
    assert parse_date("18/09/2026") == parse_date("2026-09-18")
    assert parse_date(None) is None
    assert parse_date("not a date") is None


def test_canonical_cui_strips_prefix_and_noise():
    assert canonical_cui("RO18543210") == "18543210"
    assert canonical_cui("RO 18543210") == "18543210"
    assert canonical_cui("18543210") == "18543210"
    assert canonical_cui(None) == ""


def test_token_f1_partial_overlap():
    assert token_f1("SC EXEMPLU SRL", "SC EXEMPLU SRL") == 1.0
    assert token_f1("EXEMPLU SRL", "SC EXEMPLU SRL") < 1.0
    assert token_f1("totally different", "SC EXEMPLU SRL") == 0.0


def test_field_match_rules():
    assert field_match("merchant_cui", "RO18543210", "18543210")
    assert field_match("document_date", "18.09.2026", "2026-09-18")
    assert field_match("total", 55.34, 55.34)
    assert not field_match("total", 55.0, 55.34)
    assert field_match("currency", "ron", "RON")
    assert not field_match("currency", "RON", "LEI")


def test_score_fields_excludes_unscored_truth():
    ground_truth = {"merchant_name": "SC EXEMPLU SRL", "document_number": None}
    prediction = {"merchant_name": "SC EXEMPLU SRL", "document_number": "X"}
    result = score_fields(prediction, ground_truth)
    assert result["total"] == 1
    assert result["matched"] == 1
    assert result["accuracy"] == 1.0


def test_score_items_precision_recall():
    truth = [
        {"description": "Paine", "quantity": 2, "unit_price": 4.5, "total": 9.0},
        {"description": "Lapte", "quantity": 6, "unit_price": 3.25, "total": 19.5},
    ]
    predicted = [
        {"description": "Paine", "quantity": 2, "unit_price": 4.5, "total": 9.0},
    ]
    result = score_items(predicted, truth)
    assert result["matched"] == 1
    assert result["recall"] == 0.5
    assert result["precision"] == 1.0
    assert result["row_accuracy"] == 0.5


def test_score_document_combines_fields_and_items():
    truth = {
        "total": 55.34,
        "items": [{"description": "Paine", "quantity": 2, "unit_price": 4.5, "total": 9.0}],
    }
    prediction = {
        "total": 55.34,
        "items": [{"description": "Paine", "quantity": 2, "unit_price": 4.5, "total": 9.0}],
    }
    result = score_document(prediction, truth)
    assert result["fields"]["accuracy"] == 1.0
    assert result["items"]["row_accuracy"] == 1.0


def test_hiieko_arm_reads_synthetic_invoice():
    result = adapters.run_hiieko_arm(_fixture("synthetic_invoice_ro_001"))
    assert result.available
    assert result.prediction["merchant_name"] == "SC EXEMPLU SRL"
    assert result.prediction["total"] == 55.34
    assert len(result.prediction["items"]) == 3


def test_xml_arm_scores_against_ground_truth():
    fixture = _fixture("synthetic_efactura_ubl_001")
    result = adapters.run_xml_arm(fixture, DEFAULT_FIXTURES_DIR)
    assert result.available
    assert result.prediction["total"] == 55.34
    assert result.prediction["subtotal"] == 46.5
    assert result.prediction["vat"] == 8.84
    assert result.prediction["merchant_name"] == "SC EXEMPLU SRL"
    assert result.prediction["merchant_cui"] == "18543210"
    assert result.prediction["document_number"] == "F-1234"
    assert result.prediction["document_date"] == "2026-09-18"
    assert result.prediction["provider"] == "efactura_xml"
    assert len(result.prediction["items"]) == 3

    score = score_document(result.prediction, fixture["ground_truth"])
    assert score["fields"]["accuracy"] == 1.0
    assert score["items"]["row_accuracy"] == 1.0


def test_pp_structure_v3_disabled_by_default(monkeypatch):
    monkeypatch.delenv(adapters.PP_ENABLE_ENV, raising=False)
    available, reason = pp_structure_v3_status()
    assert available is False
    assert "disabled" in reason


def test_pp_structure_v3_arm_skips_without_paddle(monkeypatch):
    monkeypatch.setenv(adapters.PP_ENABLE_ENV, "1")
    result = run_pp_structure_v3_arm(_fixture("synthetic_invoice_ro_001"), DEFAULT_FIXTURES_DIR)
    assert result.arm == "pp_structure_v3"
    if not result.available:
        assert "not installed" in result.reason or "no image_input" in result.reason
    else:
        # Reachable only when paddle + models are provisioned: it must
        # either succeed or surface a captured error, never raise.
        assert result.error is None or isinstance(result.error, str)


def test_normalize_pp_structure_result_dict():
    result = {"markdown": "# Invoice\nTotal 55.34", "rec_texts": ["Total 55.34"]}
    normalized = normalize_pp_structure_result(result)
    assert normalized["text"] == "# Invoice\nTotal 55.34"
    assert normalized["rec_texts"] == ["Total 55.34"]


def test_normalize_pp_structure_result_nested_ocr():
    class _Nested:
        rec_texts = ["FACTURA", "TOTAL 55.34"]

    class _Result:
        markdown = ""
        overall_ocr_res = _Nested()

    normalized = normalize_pp_structure_result(_Result())
    assert normalized["text"] == "FACTURA\nTOTAL 55.34"


def test_run_benchmark_over_all_arms_is_offline():
    rows = run_benchmark()
    assert rows
    hiieko_rows = [row for row in rows if row["arm"] == "hiieko" and row["available"]]
    assert hiieko_rows
    assert all(row["score"]["fields"]["accuracy"] == 1.0 for row in hiieko_rows)
    pp_rows = [row for row in rows if row["arm"] == "pp_structure_v3"]
    assert all(row["available"] is False for row in pp_rows)


def test_format_report_marks_skipped_arms():
    report = format_report(run_benchmark())
    assert "SKIPPED" in report
    assert "pp_structure_v3" in report
