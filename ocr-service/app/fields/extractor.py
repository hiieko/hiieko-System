"""
Generic field extraction from reading-order-aware OCR pages.

Takes reordered RawOcrPage objects (from Phase 2) and extracts
structured fields using pattern matching. Per-line confidence and
bounding-box positions are preserved to score each extraction.

This module contains NO merchant-specific, sample-specific, or
printer-specific logic. Patterns are limited to common document
field labels (total, date, CUI, VAT, etc.) found across receipts,
invoices, and similar commercial documents.
"""

import re
from ..schemas import LineItem, OcrField, UnresolvedField
from ..validators import parse_amount, valid_cui, valid_date, validate_totals


# ── Pattern definitions ──────────────────────────────────────────────
PATTERNS: dict[str, str] = {
    "total": r"(?:TOTAL(?: GENERAL| DE PLAT[AĂ]| PLAT[AĂ])?|SUMA\s+DE\s+PLAT[AĂ])",
    "subtotal": r"(?:SUBTOTAL|BAZA(?: IMPOZITARE)?|TOTAL\s+BUNURI|NET(?!\s+DE\s+PLAT[AĂ]))",
    "vat": r"(?:TVA|VAT|TAXA\s+PE\s+VALOAREA\s+AD[AĂ]UGAT[AĂ])",
    "cui": r"(?:CUI|CIF|C\.I\.F\.|COD\s+FISCAL|FISCAL\s+CODE|COMPANY\s+ID)",
    "date": r"(?:DATA|DATE|DAT[AĂ]|ISSUE\s+DATE|EMIS[AĂ])",
    "number": r"(?:NR\.?|NUM[AĂ]R|NUMBER|INVOICE\s+NO|FACTURA\s+NR|ID)",
    "series": r"(?:SERIA|SERIES|SERIE)",
    "card": r"(?:CARD|CARDURI|POS|POS\s+TERMINAL|CONTACTLESS)",
    "cash": r"(?:NUMERAR|CASH|BANCNOTE)",
}

# Total labels are split by strength: an explicit "amount payable" label
# always wins for the grand total, while a bare "TOTAL" (no qualifier) is
# the amount due before it, i.e. the net/subtotal when a strong total is
# also present.
_STRONG_TOTAL_LABEL = (
    r"(?:TOTAL\s+DE\s+PLAT[AĂ]|TOTAL\s+PLAT[AĂ]|TOTAL\s+GENERAL|"
    r"SUMA\s+DE\s+PLAT[AĂ]|TOTAL\s+DE\s+ACHITAT|GRAND\s+TOTAL|"
    r"AMOUNT\s+DUE)"
)
_SUBTOTAL_LABEL = (
    r"(?:SUBTOTAL|SUB\s*TOTAL|BAZA(?:\s+IMPOZITARE)?|TOTAL\s+BUNURI|"
    r"TOTAL\s+VALOARE|VALOARE\s+F[AĂ]R[AĂ]\s+TVA|NET(?!\s+DE\s+PLAT[AĂ]))"
)
_BARE_TOTAL_LABEL = (
    r"(?:TOTAL|SUMA)(?!\s+DE\s+PLAT[AĂ]|\s+PLAT[AĂ]|\s+GENERAL|\s+BUNURI|"
    r"\s+VALOARE|\s+F[AĂ]R[AĂ]|\s+DE\s+ACHITAT|\s+BUC)"
)

# A registered company line (legal-form suffix plus a real name token).
_COMPANY_SUFFIX_RE = re.compile(
    r"\bS\.?\s?R\.?\s?L\.?\b|\bS\.?\s?A\.?\b", re.IGNORECASE
)
_LEGAL_FORM_RE = re.compile(r"\bS\.?\s?C\.?\b", re.IGNORECASE)

# A money token that never spans two numbers ("234,50 100,00") and is
# rendered in Romanian or English formatting.
_AMOUNT_ONLY_RE = re.compile(
    r"\d[\d.,]*\d(?:\s*(?:RON|LEI|EUR|USD|GBP|CHF|MDL|BGN|HUF|PLN))?",
    re.IGNORECASE,
)
_PERCENT_SUFFIX_RE = re.compile(r"\s*%")


# ── Helpers ──────────────────────────────────────────────────────────


def _all_text(pages: list) -> str:
    """Join all line texts in reading order."""
    return "\n".join(
        line.text for page in pages for line in page.lines
    )


def _upper(pages: list) -> str:
    return _all_text(pages).upper()


def _amount_after(pattern: str, text: str) -> float | None:
    """Extract a numeric amount that follows a label on the same line.

    A number written as a percentage (e.g. "Cota TVA:21%") is a rate,
    not an amount, and is skipped so the real amount is returned when
    present. Scanning stops at the end of the label's line so unrelated
    values on later lines are never pulled in.
    """
    for label in re.finditer(r"\b" + pattern + r"\b", text, re.IGNORECASE):
        line = text[label.end():]
        newline = line.find("\n")
        if newline != -1:
            line = line[:newline]
        for token in re.finditer(r"\d[\d.,]*\d|\d", line):
            if _PERCENT_SUFFIX_RE.match(line[token.end():]):
                continue
            value = parse_amount(token.group(0))
            if value is not None:
                return value
    return None


def _amount_after_or_next(pattern: str, text: str, window: int = 3) -> float | None:
    """Amount after a label, falling back to an amount-only line below.

    Tabular invoices often print the label and its value on separate
    lines ("Total\\n374.716,70"), sometimes with an intervening caption.
    This looks ahead a few lines and returns the first standalone money
    line, ignoring caption text in between.
    """
    value = _amount_after(pattern, text)
    if value is not None:
        return value
    lines = text.split("\n")
    for index, line in enumerate(lines):
        if not re.search(r"\b" + pattern + r"\b", line, re.IGNORECASE):
            continue
        for candidate in lines[index + 1: index + 1 + window]:
            stripped = candidate.strip()
            if not stripped:
                continue
            if _AMOUNT_ONLY_RE.fullmatch(stripped):
                amount = parse_amount(stripped)
                if amount is not None:
                    return amount
    return None


def _extract_vat_rate(text: str) -> float | None:
    """Extract the VAT rate (percent value) when the document states one."""
    for pattern in (
        r"(?:COTA\s+)?(?:TVA|VAT)[^\S\n]*[:.]?[^\S\n]*"
        r"(\d{1,3}(?:[.,]\d+)?)\s*%",
        r"(\d{1,3}(?:[.,]\d+)?)\s*%\s*(?:TVA|VAT)",
    ):
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            rate = parse_amount(match.group(1))
            if rate is not None:
                return rate
    return None


def _looks_like_company_name(line: str) -> bool:
    """True for a registered company line (e.g. "S.C. EXEMPLU S.R.L.")."""
    if not _COMPANY_SUFFIX_RE.search(line):
        return False
    remainder = _COMPANY_SUFFIX_RE.sub(" ", line)
    remainder = _LEGAL_FORM_RE.sub(" ", remainder)
    return bool(re.search(r"[A-Za-zĂÂÎȘȚăâîșț]{3,}", remainder))


def _detect_currency(text: str) -> str | None:
    match = re.search(
        r"\b(RON|LEI|EUR|USD|GBP|CHF|MDL|BGN|HUF|PLN)\b", text.upper()
    )
    return match.group(1) if match else None


def _detect_payment(text: str) -> tuple[str | None, float]:
    upper = text.upper()
    if re.search(r"\b(?:" + PATTERNS["card"] + r")\b", upper):
        return ("card", 0.8)
    if re.search(r"\b(?:" + PATTERNS["cash"] + r")\b", upper):
        return ("cash", 0.8)
    return (None, 0.0)


def _detect_document_type(text: str) -> str:
    upper = text.upper()
    if re.search(r"PROFORMA", upper):
        # A proforma is a non-fiscal document; never classified as an
        # ordinary fiscal FACTURA.
        return "FACTURA_PROFORMA"
    if re.search(r"FACTUR[AĂĂ]|INVOICE|E-FACTURA|EFACTURA", upper):
        return "FACTURA"
    if re.search(r"BON\s+FISCAL|RECEIPT|CHITANTA|CHITANŢĂ", upper):
        return "BON_FISCAL"
    return "OTHER"


# ── Line-item extraction ────────────────────────────────────────────
#
# Generic rules for invoice/receipt product rows. A candidate item line
# must contain a description plus a trailing group of contiguous
# amounts (quantity / unit price / line total columns). Only values
# explicitly supported by OCR evidence are assigned; ambiguous columns
# are left unset on the LineItem so human review decides. Totals, VAT,
# subtotal, payment, and metadata lines are never treated as products.

# Amount token: "4,50" / "1.234,56" / "1234.56" / "9" with an optional
# currency or unit word directly after it.
_AMOUNT_RE = re.compile(
    r"(?<![\w.,])(\d[\d.,]*\d|\d)\s*"
    r"(RON|LEI|EUR|USD|GBP|CHF|MDL|BGN|HUF|PLN|BUC\.?|BUCAT[ĂA]E?|KG|ML|PCS?\.?|X)?"
    r"(?![\w])",
    re.IGNORECASE,
)

_CURRENCY_UNITS = {"RON", "LEI", "EUR", "USD", "GBP", "CHF", "MDL", "BGN", "HUF", "PLN"}

# Lines that are never products: totals, VAT, payment, metadata,
# table headers, contact/footer noise.
_ITEM_EXCLUDE_RE = re.compile(
    r"\b(?:SUBTOTAL|TOTAL|TVA|VAT|SUMA\s+DE\s+PLAT[AĂ]|BAZA(?:\s+IMPOZITARE)?|"
    r"NET|GRAND\s+TOTAL|AMOUNT\s+DUE|NEEXIGIB|"
    r"REDUCERE|DISCOUNT|AVANS|PLATA|PLATIT|PLATE|SCADENT|TERMEN|PENALIT|"
    r"PAYMENT\w*|SHIPPING\w*|FEE\b|REST\b|CHANGE\b|PAID\b|TAX(?:A|E|Ă)?\b|BALANCE\s+DUE|"
    r"CARD|CARDURI|CONTACTLESS|VISA|MASTERCARD|NUMERAR|CASH|BANCNOTE|POS|"
    r"CUI|CIF|COD\s+FISCAL|FACTUR\w*|INVOICE|BON\s+FISCAL|CHITAN|SERIA|SERIE|"
    r"NR\b|NUM[AĂ]R|ISSUE|EMIS|"
    r"DENUMIR\w*|DESCRIPTION\w*|CANTITAT\w*|QUANTITY\w*|QTY|PRET\w*|PRICE\w*|"
    r"VALOAR\w*|AMOUNT\w*|UNITATE\w*|ARTICOL\w*|POZITI\w*|POZ|SKU|LINE\s+ITEM|"
    r"PAGE|PAGINA|"
    r"IBAN|BIC|SWIFT|TELEFON|TEL\b|PHONE|WWW|HTTP|EMAIL|"
    r"STR\b|BD\b|BULEVARD|JUD\b|SECTIA|ORAS|MUNICIPIUL|ADRESA|"
    r"MULTUMESC|MULTUMIM|THANK|GARANTIE|RETURN|RESTITUIRE"
    r")\b"
    r"|https?://|@",
    re.IGNORECASE,
)

# Totals-zone markers: once seen (after at least one item), later lines
# are payment/footer area, not products.
_STRONG_TOTAL_RE = re.compile(
    r"\b(?:TOTAL|SUBTOTAL|SUMA\s+DE\s+PLAT[AĂ]|GRAND\s+TOTAL|AMOUNT\s+DUE|"
    r"BAZA(?:\s+IMPOZITARE)?|TVA|VAT|NEEXIGIB)\b",
    re.IGNORECASE,
)
_PAYMENT_ZONE_RE = re.compile(
    r"\b(?:CARD|NUMERAR|CASH|PLATIT|CONTACTLESS|VISA|MASTERCARD)\b",
    re.IGNORECASE,
)

# Table-header / metadata lines also drop any pending multi-line
# description (merchant/address lines must not leak into items).
_CLEAR_PENDING_RE = _ITEM_EXCLUDE_RE

# Explicit quantity syntax: "2 x 4,50", "2x4,50", "2 x 4,50 = 9,00".
_QTY_PRICE_RE = re.compile(
    r"(?<![\w.,])(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)"
    r"(?:\s*(?:=|:)\s*(\d[\d.,]*\d|\d))?",
    re.IGNORECASE,
)

# Quantity-first syntax: "2 x Apa minerala".
_QTY_DESC_RE = re.compile(
    r"(?<![\w.,])(\d+(?:[.,]\d+)?)\s+[x×]\s+(\S.*)$"
)

_DATE_MASK_RE = re.compile(r"\d{1,2}[./-]\d{1,2}[./-]\d{2,4}")
# Attached size units ("700g", "1L") are description text, not amounts.
_ATTACHED_UNIT_RE = re.compile(r"(?<=\d)(?:KG|G|ML|L|GR|BUC\.?)\b", re.IGNORECASE)

_PERCENT_ONLY_RE = re.compile(r"^\d{1,3}\s*%$")
# A line that is only a currency token ("-RON-", "LEI") is a table
# header/cell, never a product description.
_CURRENCY_ONLY_RE = re.compile(
    r"^[-–—\s]*(?:RON|LEI|EUR|USD|GBP|CHF|MDL|BGN|HUF|PLN)[-–—\s]*$",
    re.IGNORECASE,
)
_PHONE_ONLY_RE = re.compile(r"^\+?[\d\s().-]{9,}$")
_ARTICLE_COUNT_RE = re.compile(
    r"ARTICOL|ARTICLES?\s*[:\d]|CANTITATE\s+TOTAL|"
    r"TOTAL\s+(?:BUC[AĂ]?[TȚ]?I|ITEMS?)",
    re.IGNORECASE,
)

# Locale markers used to disambiguate comma/period decimal separators in
# product amount columns.
_RO_LOCALE_RE = re.compile(
    r"\b(?:RON|LEI|TVA|CANTITAT\w*|PRET\w*|VALOAR\w*|FACTUR\w*|BAZA)\b",
    re.IGNORECASE,
)
_EN_LOCALE_RE = re.compile(
    r"\b(?:EUR|USD|GBP|CHF|VAT|QTY|QUANTITY|PRICE|AMOUNT|INVOICE|DESCRIPTION)\b",
    re.IGNORECASE,
)
_THOUSANDS_ONLY_RE = re.compile(r"^\d{1,3}(?:,\d{3})+$")

# Metadata lines: a date label together with a date value, or a
# leading COD (code) label. Product names that merely contain these
# words ("Data centru", "Consumabile cod maro") are not metadata.
_META_DATE_RE = re.compile(
    r"\b(?:DATA|DATE|DAT[AĂ]|ISSUE\s+DATE|EMIS[AĂ])\b", re.IGNORECASE
)
_META_COD_RE = re.compile(r"^\s*COD\b", re.IGNORECASE)
_DATE_TOKEN_RE = re.compile(r"\d{1,4}[./-]\d{1,2}[./-]\d{1,4}")

_GAP_OK_RE = re.compile(r"[\s.,;:()*x×/]*")
_CONTINUATION_REJECT_RE = re.compile(
    r"MULTUMESC|MULTUMIM|THANK|GARANTIE|RETURN|RESTITUIRE", re.IGNORECASE
)


def _mask_noise(text: str) -> str:
    """Mask dates and attached size units, preserving character offsets."""
    masked = _DATE_MASK_RE.sub(lambda m: " " * len(m.group(0)), text)
    masked = _ATTACHED_UNIT_RE.sub(lambda m: "_" * len(m.group(0)), masked)
    return masked


def _qty_like(value: float) -> bool:
    return 0 < value <= 10000 and abs(value - round(value, 3)) < 1e-9


def _plausible_amount(value: float) -> bool:
    return 0 <= value <= 10_000_000


def _detect_item_locale(pages: list) -> bool | None:
    """
    Infer the item-column decimal separator from document wording.

    Returns True for Romanian-style decimal commas, False for
    English-style decimal points, or None when the document gives no
    reliable signal.
    """
    text = _all_text(pages)
    ro = len(_RO_LOCALE_RE.findall(text))
    en = len(_EN_LOCALE_RE.findall(text))
    if ro > en:
        return True
    if en > ro:
        return False
    return None


def _parse_item_amount(token: str, comma_decimal: bool | None) -> float | None:
    """
    Parse a line-item amount token, resolving locale-dependent separators.

    Comma-grouped values ("1,234") are ambiguous: thousands in English
    or a three-decimal value in Romanian. When the locale cannot be
    inferred the token is refused rather than guessed.
    """
    if _THOUSANDS_ONLY_RE.match(token):
        if comma_decimal is None:
            return None
        if comma_decimal is False:
            return float(token.replace(",", ""))
    return parse_amount(token)


def _money_tolerance(amount: float) -> float:
    """Permitted rounding slack for a line amount (0.5% + half a cent)."""
    return round(abs(amount) * 0.005 + 0.005, 6)


def _looks_like_code(token: str) -> bool:
    """A run of 7+ digits is an article/barcode, not a quantity."""
    return bool(re.fullmatch(r"\d{7,}", token))


def _is_meta_line(text: str) -> bool:
    """Date/COD metadata lines, but not product names containing those words."""
    if _META_DATE_RE.search(text) and _DATE_TOKEN_RE.search(text):
        return True
    return bool(_META_COD_RE.search(text))


def _is_page_or_phone_noise(text: str) -> bool:
    """Page numbers and phone strings, but never money-like tokens."""
    if not _PHONE_ONLY_RE.match(text):
        return False
    if "," in text:
        return False
    if re.search(r"\d+\.\d{1,2}\b", text):
        return False
    return True


def _consistent(qty: float, unit: float, total: float) -> bool:
    return abs(qty * unit - total) <= _money_tolerance(qty * unit)


def _trailing_amounts(
    masked: str, original: str, comma_decimal: bool | None
) -> tuple[str, list[tuple[float, bool, bool]]]:
    """
    Collect the group of contiguous amount tokens at the end of a line.

    Returns (description, amounts) where each amount is
    (value, has_decimal_or_currency, is_negative). The description is
    the original text before the first trailing amount token. Long
    digit runs (codes/barcodes) are treated as description text and end
    the amount group.
    """
    matches = list(_AMOUNT_RE.finditer(masked))
    if not matches:
        return original.strip(), []
    suffix = [matches[-1]]
    for i in range(len(matches) - 1, 0, -1):
        if _looks_like_code(matches[i - 1].group(1)):
            break
        gap = masked[matches[i - 1].end(): matches[i].start()]
        if len(gap) > 12 or not _GAP_OK_RE.fullmatch(gap):
            break
        suffix.append(matches[i - 1])
    suffix.reverse()
    amounts: list[tuple[float, bool, bool]] = []
    for m in suffix:
        value = _parse_item_amount(m.group(1), comma_decimal)
        if value is None:
            return original.strip(), []
        unit = (m.group(2) or "").upper()
        has_marker = (
            "." in m.group(1) or "," in m.group(1) or unit in _CURRENCY_UNITS
        )
        is_negative = m.start() > 0 and original[m.start() - 1] == "-"
        amounts.append((value, has_marker, is_negative))
    description = original[: suffix[0].start()].strip(" -–—:;,(*=()")
    return description, amounts


def _classify_amounts(
    amounts: list[tuple[float, bool, bool]]
) -> tuple[float | None, float | None, float | None]:
    """
    Map trailing amounts to (quantity, unit_price, line total).

    A leading quantity-like value plus at least one more amount is
    required before any numeric field is assigned. With exactly two
    amounts only the quantity is trusted (the second column could be
    a unit price or a line total), so the unit price and total stay
    unset. With three or more amounts the line total is only assigned
    when a later column is consistent with qty × unit price, either
    directly (qty | unit | total) or including intermediate columns as
    extras such as a per-line VAT (qty | unit | tva | total).
    Otherwise the whole row is treated as ambiguous and every numeric
    field stays unset.
    """
    nums = [v for v, _, _ in amounts]
    if len(nums) < 2 or not _qty_like(nums[0]):
        return None, None, None
    if not all(_plausible_amount(v) for v in nums):
        return None, None, None
    qty = nums[0]
    unit = nums[1]
    if len(nums) == 2:
        return qty, None, None
    for j in range(2, len(nums)):
        if _consistent(qty, unit, nums[j]):
            return qty, unit, nums[j]
        extras = sum(nums[2:j])
        if extras > 0 and abs(qty * unit + extras - nums[j]) <= _money_tolerance(
            nums[j]
        ):
            return qty, unit, nums[j]
    return None, None, None


def _can_continue_description(text: str) -> bool:
    """A digit-free, non-footer line may continue a multi-line description."""
    if not text or re.search(r"\d", text):
        return False
    if text.endswith(("!", "?", ".")):
        return False
    if _CONTINUATION_REJECT_RE.search(text):
        return False
    return True


def extract_items(pages: list) -> list[LineItem]:
    """
    Extract line items from reading-order-aware OCR pages.

    Walks all pages in reading order. Digit-free text lines are held as
    a pending description and attached only to the next amount-only
    product row (supporting multi-line descriptions and multi-page
    documents). The document's first non-empty line is never buffered
    and a row carrying an inline description never absorbs pending
    text, so merchant/banner lines cannot leak into items. After a
    totals/payment marker on a page, no further items are accepted on
    that page; each new page resets the totals zone so multi-page
    invoices keep extracting.
    """
    items: list[LineItem] = []
    pending: list[str] = []
    zone_closed = False
    comma_decimal = _detect_item_locale(pages)
    seen_first_line = False

    for page in pages:
        zone_closed = False
        for line in page.lines:
            text = line.text.strip()
            if not text:
                continue
            is_first_line = not seen_first_line
            seen_first_line = True

            if (
                _PERCENT_ONLY_RE.match(text)
                or _CURRENCY_ONLY_RE.match(text)
                or _is_page_or_phone_noise(text)
                or _ARTICLE_COUNT_RE.search(text)
            ):
                continue
            if _is_meta_line(text):
                pending = []
                continue
            if _ITEM_EXCLUDE_RE.search(text):
                if _CLEAR_PENDING_RE.search(text):
                    pending = []
                if items and (
                    _STRONG_TOTAL_RE.search(text)
                    or _PAYMENT_ZONE_RE.search(text)
                ):
                    zone_closed = True
                continue
            if zone_closed:
                continue

            masked = _mask_noise(text)

            # Explicit "qty x price" syntax. Rejected when a letter
            # follows in the original text ("3 x 100g" is a size, not
            # qty × unit price).
            match = _QTY_PRICE_RE.search(masked)
            if match and re.match(
                r"[A-Za-zĂÂÎȘȚăâîșț]", text[match.end():] or ""
            ):
                match = None
            if match:
                qty = _parse_item_amount(match.group(1), comma_decimal)
                unit = _parse_item_amount(match.group(2), comma_decimal)
                total = (
                    _parse_item_amount(match.group(3), comma_decimal)
                    if match.group(3)
                    else None
                )
                rest_masked = (
                    masked[: match.start()] + " " + masked[match.end():]
                ).strip()
                rest_original = (
                    text[: match.start()] + " " + text[match.end():]
                ).strip()
                rest_desc, rest_amounts = _trailing_amounts(
                    rest_masked, rest_original, comma_decimal
                )
                if total is None and len(rest_amounts) == 1:
                    total = rest_amounts[0][0]
                if qty is not None and unit is not None and total is not None:
                    if not _consistent(qty, unit, total):
                        total = None
                full_description = (
                    rest_desc if rest_desc else " ".join(pending)
                ).strip()
                pending = []
                if full_description:
                    items.append(
                        LineItem(
                            description=full_description,
                            quantity=qty,
                            unit_price=unit,
                            total=total,
                        )
                    )
                continue

            # "qty x description" syntax.
            match = _QTY_DESC_RE.match(masked)
            if match:
                qty = _parse_item_amount(match.group(1), comma_decimal)
                if qty is not None:
                    rest_desc, rest_amounts = _trailing_amounts(
                        masked[match.start(2):],
                        text[match.start(2):],
                        comma_decimal,
                    )
                    total = (
                        rest_amounts[0][0] if len(rest_amounts) == 1 else None
                    )
                    description = rest_desc.strip(" -–—:;,(*=()")
                    full_description = (
                        description if description else " ".join(pending)
                    ).strip()
                    pending = []
                    if full_description:
                        items.append(
                            LineItem(
                                description=full_description,
                                quantity=qty,
                                unit_price=None,
                                total=total,
                            )
                        )
                    continue

            description, amounts = _trailing_amounts(
                masked, text, comma_decimal
            )

            if not amounts:
                if is_first_line:
                    continue
                if _can_continue_description(text):
                    pending.append(text)
                    if len(pending) > 4:
                        pending = pending[-4:]
                continue

            if any(is_negative for _, _, is_negative in amounts):
                continue

            if not description:
                if items and len(amounts) == 1:
                    # Bare amount line: fills a missing line total of
                    # the previous item when the amount is clearly money.
                    if (
                        amounts[0][1]
                        and items[-1].total is None
                        and _plausible_amount(amounts[0][0])
                    ):
                        items[-1].total = amounts[0][0]
                elif pending:
                    # Amount-only row ("1 350,00 350,00") continues a
                    # description held from preceding text lines.
                    qty, unit, total = _classify_amounts(amounts)
                    full_description = " ".join(pending).strip()
                    pending = []
                    if full_description:
                        items.append(
                            LineItem(
                                description=full_description,
                                quantity=qty,
                                unit_price=unit,
                                total=total,
                            )
                        )
                continue

            if len(amounts) == 1:
                # A lone trailing number alongside an inline description
                # is ambiguous (unit price vs line total) and is often a
                # non-product summary line; do not emit it as an item.
                pending = []
                continue

            qty, unit, total = _classify_amounts(amounts)
            full_description = description
            pending = []
            if full_description:
                items.append(
                    LineItem(
                        description=full_description,
                        quantity=qty,
                        unit_price=unit,
                        total=total,
                    )
                )

    return items


# ── Main extraction ─────────────────────────────────────────────────


def extract_fields(pages: list, provider: str = "paddleocr") -> dict:
    """
    Extract structured fields from reading-order-aware OCR pages.

    Returns a dict compatible with NormalizedDocument constructor.
    """
    text = _all_text(pages)
    upper = _upper(pages)

    doc_type = _detect_document_type(text)

    # CUI / fiscal ID
    cui_match = re.search(
        PATTERNS["cui"] + r"\s*[:.]?\s*(?:RO)?\s*(\d{2,10})", upper
    )
    raw_cui = cui_match.group(1) if cui_match else None
    cui_valid = valid_cui(raw_cui) if raw_cui else False

    # Date
    date_match = re.search(r"\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b", text)
    raw_date = date_match.group(1) if date_match else None
    date_valid = valid_date(raw_date) if raw_date else False

    # Document number — try the specific prefix first, then fall back to
    # FACTURA/INVOICE prefixed numbers. Horizontal-whitespace-only to avoid
    # matching across line boundaries. A real document number always
    # contains at least one digit, so label words ("Nr aviz nu") never
    # pass; an absent number is reported as unresolved instead.
    number_match = None
    for number_pattern in (
        # The label must be followed by a space or colon before the
        # token, so address fragments ("nr.51n") are not read as a
        # document number.
        r"\b(?:NR\.?|NUM[AĂ]R|NO\.?)(?:[^\S\n]+|:)"
        r"[^\S\n]*[:.]?[^\S\n]*(?:ID[^\S\n]*)?"
        r"([A-Z0-9][A-Z0-9/-]{1,19})",
        r"(?:FACTURA|INVOICE)"
        r"[^\S\n]*[:.]?[^\S\n]*(?:NR\.?|NUM[AĂ]R|NO\.?|ID)"
        r"[^\S\n]*[:.]?[^\S\n]*([A-Z0-9][A-Z0-9/-]{1,19})",
        r"(?:FACTURA|INVOICE)"
        r"[^\S\n]*[:.]?[^\S\n]*(?:ID[^\S\n]*)?"
        r"(\d[A-Z0-9/-]{1,19})",
    ):
        for candidate in re.finditer(number_pattern, upper):
            if re.search(r"\d", candidate.group(1)):
                number_match = candidate
                break
        if number_match:
            break
    series_match = re.search(
        r"(?:SERIA|SERIES)\s*[:.]?\s*([A-Z0-9-]{1,10})", upper
    )

    # Currency
    currency = _detect_currency(text)

    # Amounts. An explicit payable label is authoritative for the grand
    # total; a bare "TOTAL" is then the net/subtotal when the strong
    # total consumed the payable line.
    strong_total = _amount_after_or_next(_STRONG_TOTAL_LABEL, text)
    subtotal = _amount_after_or_next(_SUBTOTAL_LABEL, text)
    bare_total = _amount_after_or_next(_BARE_TOTAL_LABEL, text)
    if strong_total is not None:
        total = strong_total
        if subtotal is None:
            subtotal = bare_total
    else:
        total = bare_total

    vat = _amount_after(PATTERNS["vat"], text)
    if (
        vat is None
        and subtotal is not None
        and total is not None
        and total >= subtotal
    ):
        vat = round(total - subtotal, 2)

    vat_rate = _extract_vat_rate(text)
    vat_rates = [vat_rate] if vat_rate is not None else []

    # Merchant name: prefer a registered company line (legal-form suffix
    # plus a real name token) before falling back to the first
    # non-label, non-numeric line.
    lines_list = [line.text for page in pages for line in page.lines]
    merchant = None
    for line in lines_list[:15]:
        if _looks_like_company_name(line):
            merchant = line
            break
    if merchant is None:
        for line in lines_list[:8]:
            if not re.search(
                r"(FACTUR|BON\s+FISCAL|TOTAL|TVA|VAT|CUI|DATA|NR\.|SERIA|"
                r"SUBTOTAL|BAZA)",
                line,
                re.IGNORECASE,
            ) and not re.match(r"^[\d\s.,%/:;()+\-=\[\]{}]+$", line):
                merchant = line
                break

    # Payment method
    payment, pay_conf = _detect_payment(text)

    # Line items (generic product-row extraction)
    items = extract_items(pages)

    # Validation
    errors = validate_totals(subtotal, vat, total)

    # Build fields dict
    fields: dict[str, OcrField] = {}

    def add(name: str, value: object, confidence: float):
        if value is not None and value != "":
            fields[name] = OcrField(value=value, confidence=confidence)

    add("merchant_name", merchant, 0.65)
    add("merchant_cui", raw_cui, 0.85 if cui_valid else 0.3)
    add("document_date", raw_date, 0.85 if date_valid else 0.3)
    add("document_number", number_match.group(1) if number_match else None, 0.7)

    for name, value in (("subtotal", subtotal), ("vat", vat), ("total", total)):
        add(name, value, 0.85 if value is not None else 0.0)

    add("payment_method", payment, pay_conf)

    # Confidence scoring
    overall_conf = min(
        (f.confidence or 0.0 for f in fields.values()), default=0.0
    )
    low_conf = [
        name for name, f in fields.items()
        if (f.confidence or 0.0) < 0.6
    ]

    # Unresolved fields
    unresolved: list[UnresolvedField] = []
    if merchant is None:
        unresolved.append(UnresolvedField(
            field_name="merchant_name",
            reason="No merchant name found in first 8 lines",
            candidates_considered=0,
        ))
    if raw_cui is None:
        unresolved.append(UnresolvedField(
            field_name="merchant_cui",
            reason="No CUI/CIF/Fiscal Code found",
            candidates_considered=0,
        ))
    if raw_date is None:
        unresolved.append(UnresolvedField(
            field_name="document_date",
            reason="No date found",
            candidates_considered=0,
        ))
    if number_match is None:
        unresolved.append(UnresolvedField(
            field_name="document_number",
            reason="No document number containing digits found",
            candidates_considered=0,
        ))
    if total is None:
        unresolved.append(UnresolvedField(
            field_name="total",
            reason="No total amount found after TOTAL/SUMA label",
            candidates_considered=0,
        ))

    return {
        "fields": fields,
        "unresolved": unresolved,
        "low_confidence_fields": low_conf,
        "confidence": overall_conf,
        "document_type": doc_type,
        "merchant_name": merchant,
        "merchant_cui": raw_cui,
        "invoice_series": series_match.group(1) if series_match else None,
        "document_number": number_match.group(1) if number_match else None,
        "document_date": raw_date,
        "currency": currency,
        "subtotal": subtotal,
        "vat": vat,
        "vat_rates": vat_rates,
        "total": total,
        "items": items,
        "payment_method": payment,
        "validation_errors": errors,
        "review_required": bool(low_conf or unresolved or errors),
        "provider": provider,
    }
