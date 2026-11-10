"""
AuthHorizon Cross-Border Buyer Localization Engine (T4)
Supports buyer localization across en, ja, de, da.
Enforces the Non-Negotiable Financial Safety Gate:
  1. AI drafts template with exact placeholders: {ITEM}, {DATE}, {AMOUNT} (each exactly once).
  2. Template text outside placeholders contains ZERO digits (category Nd), ZERO currency symbols (category Sc),
     and ZERO forbidden currency terms.
  3. Deterministic Python code injects runtime dollar amounts and dates.
"""

import re
import unicodedata
from typing import Dict, Any, Optional
from backend.ai.validator import validate_ai_text_field

SUPPORTED_LOCALES = ["en", "ja", "de", "da"]

STANDARD_BUYER_TEMPLATES: Dict[str, str] = {
    "en": (
        "Your order has been partially shipped. However, '{ITEM}' is delayed and estimated to ship on {DATE}. "
        "A temporary pre-authorization hold of {AMOUNT} remains on your PayPal account and will only be captured when shipped. "
        "You may choose to wait, swap to an in-stock item, or cancel."
    ),
    "ja": (
        "ご注文いただいた商品の一部は発送されました。ただし、「{ITEM}」の出荷は{DATE}に延期されました。"
        "PayPalアカウントには一時的な仮売上枠として{AMOUNT}が保持されており、発送されるまで請求されません。"
        "待機、代替品への変更、またはキャンセルを選択いただけます。"
    ),
    "de": (
        "Ihre Bestellung wurde teilweise versandt. Allerdings verzögert sich '{ITEM}' bis voraussichtlich {DATE}. "
        "Eine temporäre Autorisierung in Höhe von {AMOUNT} bleibt auf Ihrem PayPal-Konto reserviert und wird erst bei Versand eingezogen. "
        "Sie können warten, umtauschen oder stornieren."
    ),
    "da": (
        "Din ordre er delvist afsendt. Dog er '{ITEM}' forsinket med forventet afsendelse {DATE}. "
        "En midlertidig reservation på {AMOUNT} forbliver på din PayPal-konto og hæves først ved afsendelse. "
        "Du kan vælge at vente, bytte til en anden vare eller annullere."
    )
}

REQUIRED_PLACEHOLDERS = ["{ITEM}", "{DATE}", "{AMOUNT}"]


def validate_buyer_message_template(template: str, locale: str = "en") -> str:
    """
    Validates a buyer notification message template:
    1. Normalizes with NFKC.
    2. Must contain {ITEM}, {DATE}, and {AMOUNT} exactly once each.
    3. Must not contain any unauthorized placeholders.
    4. Text outside placeholders must have NO digits (category Nd), NO currency symbols (category Sc),
       and NO forbidden currency words.
    """
    if not template or not isinstance(template, str):
        raise ValueError("Buyer message template must be a non-empty string")

    normalized = unicodedata.normalize("NFKC", template.strip())

    # Check exact single occurrence of required placeholders
    for ph in REQUIRED_PLACEHOLDERS:
        count = normalized.count(ph)
        if count != 1:
            raise ValueError(
                f"Financial Safety Gate Violation: template must contain placeholder '{ph}' exactly once (found {count})"
            )

    # Check for unauthorized placeholders
    all_placeholders = re.findall(r'\{[A-Za-z0-9_]+\}', normalized)
    unauthorized = set(all_placeholders) - set(REQUIRED_PLACEHOLDERS)
    if unauthorized:
        raise ValueError(
            f"Financial Safety Gate Violation: template contains unauthorized placeholders: {sorted(list(unauthorized))}"
        )

    # Validate remaining text with strict financial safety gate
    validate_ai_text_field(normalized, field_name=f"buyer_template_{locale}", allow_placeholders=True)

    return normalized


def fill_buyer_message_template(
    template: str,
    item_name: str,
    new_ship_date: str,
    held_amount: float,
    currency: str = "USD"
) -> str:
    """
    Deterministic code injection: replaces placeholders with validated runtime values.
    Amounts and dates are inserted exclusively by Python code, never by LLM.
    """
    # Enforce template safety before filling
    validate_buyer_message_template(template)

    # Format amount strictly by code
    formatted_amount = f"${held_amount:.2f}" if currency == "USD" else f"{held_amount:.2f} {currency}"

    # Safe deterministic placeholder replacement
    filled = template.replace("{ITEM}", str(item_name))
    filled = filled.replace("{DATE}", str(new_ship_date))
    filled = filled.replace("{AMOUNT}", formatted_amount)
    return filled


def generate_buyer_delay_message(
    item_name: str,
    new_ship_date: str,
    reason: str,
    held_amount: float,
    locale: str = "en",
    custom_template: Optional[str] = None
) -> str:
    """
    Generates a localized buyer delay message in the requested locale (en, ja, de, da).
    If custom_template is supplied and valid, it is filled; otherwise, the standard vetted template is used.
    """
    norm_locale = locale.lower().strip() if locale else "en"
    if norm_locale not in SUPPORTED_LOCALES:
        norm_locale = "en"

    template_to_use = None
    if custom_template:
        try:
            template_to_use = validate_buyer_message_template(custom_template, locale=norm_locale)
        except Exception:
            template_to_use = None

    if not template_to_use:
        template_to_use = STANDARD_BUYER_TEMPLATES[norm_locale]

    return fill_buyer_message_template(
        template=template_to_use,
        item_name=item_name,
        new_ship_date=new_ship_date,
        held_amount=held_amount
    )
