"""
Regression tests for the Romanian proforma-invoice parsing defects.

The fixture reproduces the reading-order OCR output of a real tabular
Romanian proforma (supplier/client names, registration numbers and the
line description are anonymized; the OCR noise, label placement and
numeric formatting are preserved). It exercises:

- supplier identification when the header line is OCR-garbled,
- document number that is absent (label present, no numeric value),
- a VAT rate ("Cota TVA:21%") that must not be read as a VAT amount,
- a bare "Total" and a separate "Total plata" on different lines,
- label/value printed on separate lines,
- a false-positive payment method ("POS" inside "Post").

The unit tests below cover each fix in isolation on minimal input.
"""

from app.fields.extractor import extract_fields
from app.schemas import NormalizedDocument, RawOcrLine, RawOcrPage


def _page(lines: list[tuple[str, float]], page_num: int = 0) -> RawOcrPage:
    result = []
    for idx, (text, conf) in enumerate(lines):
        result.append(
            RawOcrLine(
                text=text,
                confidence=conf,
                bbox=[[0, 0], [100, 0], [100, 20], [0, 20]],
                page=page_num,
            )
        )
    return RawOcrPage(
        page=page_num, lines=result, engine_order=list(range(len(result)))
    )


# Reading order of the real OCR output (anonymized identifying text).
_PROFORMA_LINES: list[str] = [
    "EON\u4e00",
    "A",
    "uma",
    "SRL",
    "alll1ia   n 026",
    "Nr aviz nu",
    "Cota TVA:21%",
    "S.C. EXEMPLU S.R.L.",
    "Client:",
    "CLIENT DEMO S.R.L",
    "Reg. Com.: J2025089791007",
    "Reg. Com.:J2020008949402",
    "CIF: RO52950178",
    "CIF: RO42849908",
    "Adresa:Str Hipodrom nr 6",
    "Adresa: Bucuresti, sectorul 3,",
    "Buzau, Jud. Buzau",
    "str. Theodor Pallady, nr.51n",
    "IBAN:RO20BTRLRONCRT0DC7731701",
    "Banca: Banca Transilvania",
    "Pret unitar",
    "Valoarea",
    "Valoarea",
    "Nr. crt",
    "Denumirea produselor sau serviciilor",
    "U.M.",
    "Cant.",
    "(fara TVA)",
    "-RON-",
    "TVA",
    "-RON-",
    "-RON-",
    "0",
    "1",
    "2",
    "3",
    "4",
    "5(3x4)",
    "6",
    "1",
    "Post de transformare in avelopa de beton",
    "buc",
    "1,00",
    "374.716,70",
    "374.716,70",
    "78.690,51",
    "20/0.4 kV, 400 kVA",
    "Proiect Falciu",
    "bromsmm",
    "er026",
    "a n",
    "e s",
    "tut",
    "amul",
    "CNP:1790516100031",
    "Total",
    "374.716,70",
    "Numele delegatului:",
    "78.690,51",
    "B.I./C.I.:-",
    "Mijloc transport:",
    "Total plata",
    "Expedierea s-a efectuat in prezenta noastra la data de",
    "453.407,21",
    "01.10.2026",
    "Semnaturile:",
    "Semnatura de primire:",
]


def test_proforma_document_level_fields():
    pages = [_page([(line, 0.9) for line in _PROFORMA_LINES])]
    result = extract_fields(pages)

    # The garbled banner does not identify the supplier, but the
    # registered legal-entity line does.
    assert result["merchant_name"] == "S.C. EXEMPLU S.R.L."
    assert result["merchant_cui"] == "52950178"
    assert result["document_date"] == "01.10.2026"
    assert result["currency"] == "RON"

    # The header garbled "FACTURA PROFORMA", so no fiscal-factura claim
    # is made.
    assert result["document_type"] == "OTHER"

    # "Nr aviz nu" is a label, not a number: leave the field unset and
    # flag it for review instead of inventing a value.
    assert result["document_number"] is None
    assert "document_number" in [u.field_name for u in result["unresolved"]]
    assert result["review_required"] is True

    # "Total" (net) and "Total plata" (gross), values on later lines.
    assert result["subtotal"] == 374716.70
    assert result["total"] == 453407.21

    # "Cota TVA:21%" is a rate, not the VAT amount; the amount is
    # derived from total - subtotal and stays consistent.
    assert result["vat"] == 78690.51
    assert result["vat_rates"] == [21.0]
    assert result["validation_errors"] == []

    # "Post de transformare ..." must not be read as the card/POS
    # payment method.
    assert result["payment_method"] is None

    # The product row's printed line value is captured.
    assert len(result["items"]) == 1
    assert "Post de transformare" in result["items"][0].description
    assert result["items"][0].total == 374716.70


# ── Focused unit tests for each fix ─────────────────────────────────


def test_vat_rate_is_not_treated_as_amount_and_vat_is_derived():
    pages = [_page([
        ("FACTURA", 0.96),
        ("Cota TVA:21%", 0.90),
        ("BAZA 1.000,00", 0.90),
        ("Total 1.210,00", 0.92),
    ])]
    result = extract_fields(pages)
    assert result["subtotal"] == 1000.00
    assert result["total"] == 1210.00
    assert result["vat"] == 210.00
    assert result["vat_rates"] == [21.0]
    assert result["validation_errors"] == []


def test_strong_total_wins_and_bare_total_becomes_subtotal():
    pages = [_page([
        ("FACTURA", 0.96),
        ("Total", 0.90),
        ("100,00", 0.90),
        ("Total plata", 0.90),
        ("121,00", 0.92),
    ])]
    result = extract_fields(pages)
    assert result["subtotal"] == 100.00
    assert result["total"] == 121.00
    assert result["vat"] == 21.00  # derived


def test_number_label_without_digit_is_not_a_document_number():
    pages = [_page([
        ("FACTURA", 0.96),
        ("Nr aviz nu", 0.90),
    ])]
    result = extract_fields(pages)
    assert result["document_number"] is None
    assert "document_number" in [u.field_name for u in result["unresolved"]]


def test_glued_address_number_is_not_a_document_number():
    # Address fragments attach the number to the label ("nr.51n"),
    # unlike a real document number which is separated by a space.
    pages = [_page([
        ("FACTURA", 0.96),
        ("STR. EXEMPLU NR.51N", 0.85),
    ])]
    result = extract_fields(pages)
    assert result["document_number"] is None


def test_merchant_prefers_registered_company_line():
    pages = [_page([
        ("NOISE LINE", 0.90),
        ("EON\u4e00", 0.90),
        ("SRL", 0.90),
        ("Nr aviz nu", 0.90),
        ("S.C. EXEMPLU S.R.L.", 0.90),
        ("Client:", 0.90),
        ("CLIENT DEMO S.R.L", 0.90),
    ])]
    result = extract_fields(pages)
    assert result["merchant_name"] == "S.C. EXEMPLU S.R.L."


def test_payment_method_not_triggered_by_post_substring():
    pages = [_page([
        ("FACTURA", 0.96),
        ("Post de transformare", 0.90),
        ("Total 9,00", 0.92),
    ])]
    result = extract_fields(pages)
    assert result["payment_method"] is None


def test_proforma_heading_is_not_an_ordinary_factura():
    pages = [_page([
        ("FACTURA PROFORMA", 0.95),
        ("S.C. EXEMPLU S.R.L.", 0.90),
        ("Total 100,00", 0.92),
    ])]
    result = extract_fields(pages)
    assert result["document_type"] == "FACTURA_PROFORMA"
    # The OCR layer's contract accepts the proforma type.
    assert NormalizedDocument(
        document_type="FACTURA_PROFORMA", provider="paddleocr", confidence=0.9
    ).document_type == "FACTURA_PROFORMA"
