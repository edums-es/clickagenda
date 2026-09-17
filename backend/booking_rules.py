"""Validation shared by public bookings and the professional's agenda."""
import re
from urllib.parse import quote

BRAZIL_DDDS = set("11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99".split())


def brazil_mobile(value: str) -> str:
    """Return country code + mobile. This checks syntax, not phone ownership."""
    if re.search(r"[^0-9+().\s-]", value):
        raise ValueError("Informe seu WhatsApp com DDD, usando apenas números")
    digits = re.sub(r"\D", "", value)
    if len(digits) == 13 and digits.startswith("55"):
        digits = digits[2:]
    if len(digits) != 11 or digits[:2] not in BRAZIL_DDDS or digits[2] != "9":
        raise ValueError("Informe um celular brasileiro válido com DDD e 9 dígitos")
    subscriber = digits[3:]
    if len(set(subscriber)) == 1 or subscriber in {"12345678", "87654321", "01234567"}:
        raise ValueError("Esse número parece fictício. Informe seu WhatsApp real")
    return "55" + digits


def whatsapp_url(phone: str, message: str) -> str | None:
    try:
        target = brazil_mobile(phone)
    except ValueError:
        return None
    return f"https://wa.me/{target}?text={quote(message, safe='')}"
