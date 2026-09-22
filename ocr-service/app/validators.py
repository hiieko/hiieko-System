from datetime import datetime
import re


def parse_amount(value: str) -> float | None:
    cleaned = re.sub(r"[^\d,.\-]", "", value.replace(" ", ""))
    if not cleaned:
        return None
    if "," in cleaned and "." in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".") if cleaned.rfind(",") > cleaned.rfind(".") else cleaned.replace(",", "")
    elif "," in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    elif "." in cleaned and re.search(r"\.\d{3}$", cleaned):
        cleaned = cleaned.replace(".", "")
    try:
        return float(cleaned)
    except ValueError:
        return None


def valid_date(value: str | None) -> bool:
    if not value:
        return True
    for fmt in ("%d.%m.%Y", "%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d"):
        try:
            datetime.strptime(value, fmt)
            return True
        except ValueError:
            pass
    return False


def valid_cui(value: str | None) -> bool:
    if not value:
        return True
    digits = re.sub(r"^RO", "", value.upper()).replace(" ", "")
    if not digits.isdigit() or not 2 <= len(digits) <= 10:
        return False
    control = "753217532"
    if len(digits) < 2:
        return False
    body, check = digits[:-1], int(digits[-1])
    total = sum(int(n) * int(control[-len(body) + i]) for i, n in enumerate(body))
    return (total * 10 % 11 % 10) == check


def validate_totals(subtotal: float | None, vat: float | None, total: float | None) -> list[str]:
    if subtotal is None or vat is None or total is None:
        return []
    if abs(subtotal + vat - total) > 0.05:
        return ["subtotal_vat_total_mismatch"]
    if min(subtotal, vat, total) < 0:
        return ["negative_amount"]
    return []
