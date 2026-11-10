"""
AuthHorizon — AI Cognitive Boundary & Validation Engine
=========================================================
Parses messy, multilingual supplier delay notices using Claude 3.5 Sonnet.

CRITICAL DESIGN RULE:
    AI **never** sees or outputs monetary values. Deterministic Python code handles
    every cent. Pydantic validators on `AIExtractionResult` enforce this at the schema
    boundary.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Optional

import anthropic

from backend.config import settings
from backend.models import AIExtractionResult, Confidence

logger = logging.getLogger("authhorizon.ai_parser")


# ── Prompt Template ──────────────────────────────────────────────────────────

SYSTEM_PROMPT = """\
You are a supply-chain operations assistant. Your ONLY job is to extract structured
information from supplier delay notices — which may be in any language.

### ABSOLUTE PROHIBITIONS
- You MUST NOT output any currency symbol ($, €, £, ¥, ₹, kr) or currency code
  (USD, EUR, GBP, etc.).
- You MUST NOT output any price, cost, amount, or numeric monetary value.
- If the notice mentions prices or amounts, IGNORE THEM COMPLETELY.

### EXTRACTION FIELDS
Return a single JSON object with exactly these keys:
  - item_identifier   : The SKU code or product name of the delayed item. Use the
                         original-language name if no SKU is present.
  - new_ship_date     : Expected new shipping date in ISO-8601 (YYYY-MM-DD) if precise,
                         or a descriptive phrase like "mid-November" or "week 48".
  - reason            : One concise English sentence explaining why the item is delayed.
  - language          : ISO 639-1 code of the notice language (e.g. "de", "da", "en").
  - confidence_item   : "HIGH", "MED", or "LOW" — your confidence in item_identifier.
  - confidence_date   : "HIGH", "MED", or "LOW" — your confidence in new_ship_date.
  - confidence_reason : "HIGH", "MED", or "LOW" — your confidence in reason.

### OUTPUT FORMAT
Return ONLY the JSON object. No markdown fences, no explanation, no preamble.
"""

USER_PROMPT_TEMPLATE = """\
Parse the following supplier delay notice and extract the structured fields.

--- BEGIN NOTICE ---
{raw_text}
--- END NOTICE ---
"""


# ── Test Fixtures (Multilingual Supplier Samples) ───────────────────────────

FIXTURE_GERMAN = (
    "Betreff: Verzögerung Ihrer Bestellung #DE-4471\n\n"
    "Sehr geehrter Kunde,\n\n"
    "leider müssen wir Ihnen mitteilen, dass die Lieferung der Platine "
    "(Artikel-Nr. PCB-2024-DE) sich aufgrund von Engpässen bei unserem "
    "Halbleiter-Zulieferer verzögert. Der neue voraussichtliche Versandtermin "
    "ist Mitte November 2026.\n\n"
    "Wir entschuldigen uns für die Unannehmlichkeiten.\n\n"
    "Mit freundlichen Grüßen,\nElektronik Müller GmbH"
)

FIXTURE_DANISH = (
    "Emne: Forsinkelse af leverance – ordre #DK-8832\n\n"
    "Kære kunde,\n\n"
    "Vi må desværre informere om, at leveringen af læder (varenummer LTH-DK-55) "
    "er forsinket grundet forstyrrelser i forsyningskæden hos vores garveri i "
    "Italien. Vi forventer at kunne afsende varen i uge 48.\n\n"
    "Vi beklager ulejligheden.\n\n"
    "Venlig hilsen,\nKøbenhavn Materialer ApS"
)

FIXTURE_ENGLISH = (
    "Subject: Shipping Delay Notification – PO #EN-2290\n\n"
    "Dear Valued Partner,\n\n"
    "We regret to inform you that the ceramic coating (SKU: CRM-COAT-99) for "
    "your order has been delayed. Our coating facility experienced an equipment "
    "malfunction that required unplanned maintenance. We now expect to ship on "
    "December 5, 2026.\n\n"
    "We sincerely apologize for any inconvenience.\n\n"
    "Best regards,\nPrecision Coatings Ltd."
)


# ── AI Parsing Function ─────────────────────────────────────────────────────

def parse_delay_notice(raw_text: str) -> AIExtractionResult:
    """
    Send a supplier delay notice to Claude and parse the structured extraction.

    On API or parse failure, returns a safe fallback with LOW confidence on
    every field so the notice is routed to the merchant review queue.
    """
    try:
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        response = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=512,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": USER_PROMPT_TEMPLATE.format(raw_text=raw_text),
                },
            ],
        )

        # Claude returns a list of content blocks; grab the first text block.
        raw_json = response.content[0].text.strip()

        # Defensive: strip markdown code fences if the model wraps its output.
        if raw_json.startswith("```"):
            raw_json = re.sub(r"^```(?:json)?\s*", "", raw_json)
            raw_json = re.sub(r"\s*```$", "", raw_json)

        parsed = json.loads(raw_json)
        return AIExtractionResult(**parsed)

    except anthropic.APIError as exc:
        logger.error("Anthropic API error: %s", exc)
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse AI JSON response: %s", exc)
    except (ValueError, KeyError) as exc:
        # Pydantic validation failure (e.g. currency symbols detected)
        logger.error("AI output failed schema validation: %s", exc)
    except Exception as exc:
        logger.error("Unexpected error in parse_delay_notice: %s", exc)

    # ── Fallback: low-confidence placeholder routed to review queue ──
    return AIExtractionResult(
        item_identifier="UNKNOWN",
        new_ship_date="UNKNOWN",
        reason="Automated extraction failed; manual review required.",
        language="en",
        confidence_item=Confidence.LOW,
        confidence_date=Confidence.LOW,
        confidence_reason=Confidence.LOW,
    )


# ── Buyer Message Drafting ───────────────────────────────────────────────────

BUYER_MSG_SYSTEM = """\
You are a friendly customer-service assistant. Draft a short, empathetic message
to a buyer explaining that one of their ordered items is delayed.

### ABSOLUTE PROHIBITIONS
- You MUST NOT include any dollar amounts, prices, or currency symbols.
- Use the placeholder {ITEM_AMOUNT} where the delayed item's price should appear.
- Use the placeholder {ORDER_TOTAL} where the full order total should appear.
- NEVER invent or calculate any monetary figure.

### TONE
Professional, empathetic, concise (3-5 sentences).
"""

BUYER_MSG_USER = """\
Draft a buyer notification with these details:
- Delayed item name: {item_name}
- Reason for delay: {reason}
- New estimated ship date: {new_ship_date}

Remember: use {{ITEM_AMOUNT}} and {{ORDER_TOTAL}} as placeholders. Do NOT write
any dollar amounts yourself.
"""


def draft_buyer_message(
    extraction: AIExtractionResult,
    item_name: str,
    item_amount: float,
    order_total: float,
) -> str:
    """
    Have AI draft a buyer-facing delay message, then **deterministically inject**
    the real dollar amounts into the template the AI produced.

    The AI never sees actual prices — it only outputs placeholders.
    """
    try:
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        response = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=300,
            system=BUYER_MSG_SYSTEM,
            messages=[
                {
                    "role": "user",
                    "content": BUYER_MSG_USER.format(
                        item_name=item_name,
                        reason=extraction.reason,
                        new_ship_date=extraction.new_ship_date,
                    ),
                },
            ],
        )
        template = response.content[0].text.strip()
    except Exception as exc:
        logger.error("Failed to draft buyer message via AI: %s", exc)
        template = (
            f"We're sorry — your order item \"{item_name}\" has been delayed. "
            f"Reason: {extraction.reason}. "
            f"New estimated ship date: {extraction.new_ship_date}. "
            f"The delayed item is valued at {{ITEM_AMOUNT}} out of your "
            f"{{ORDER_TOTAL}} order total. We apologize for the inconvenience."
        )

    # ── Deterministic injection — code, not AI, writes every dollar value ──
    message = template.replace("{ITEM_AMOUNT}", f"${item_amount:.2f}")
    message = message.replace("{ORDER_TOTAL}", f"${order_total:.2f}")
    return message


# ── Extraction Validation ────────────────────────────────────────────────────

def validate_extraction(
    extraction: AIExtractionResult,
    order_items: list[dict],
) -> tuple[bool, str]:
    """
    Validate an AI extraction against actual order items.

    Rules:
        1. The extracted `item_identifier` must fuzzy-match at least one item's
           SKU or name in the order.
        2. All three confidence levels must be HIGH for automatic approval.

    Returns:
        (True, "approved")           — ready for automated processing
        (False, "<human-readable>")  — routed to merchant review queue
    """
    # ── Confidence gate ──────────────────────────────────────────
    low_fields: list[str] = []
    if extraction.confidence_item != Confidence.HIGH:
        low_fields.append(f"item ({extraction.confidence_item.value})")
    if extraction.confidence_date != Confidence.HIGH:
        low_fields.append(f"date ({extraction.confidence_date.value})")
    if extraction.confidence_reason != Confidence.HIGH:
        low_fields.append(f"reason ({extraction.confidence_reason.value})")

    if low_fields:
        return False, f"Non-HIGH confidence on: {', '.join(low_fields)}"

    # ── Fuzzy item matching ──────────────────────────────────────
    extracted_lower = extraction.item_identifier.lower()
    for item in order_items:
        sku_lower = item.get("sku", "").lower()
        name_lower = item.get("name", "").lower()
        # Match if: extracted text contains the SKU, the SKU contains the
        # extracted text, or either party is a substring of the item name.
        if (
            extracted_lower in sku_lower
            or sku_lower in extracted_lower
            or extracted_lower in name_lower
            or name_lower in extracted_lower
            # Token overlap: at least one meaningful word matches
            or _token_overlap(extracted_lower, f"{sku_lower} {name_lower}")
        ):
            return True, "approved"

    return False, f"Item '{extraction.item_identifier}' did not match any order item"


def _token_overlap(a: str, b: str, min_len: int = 3) -> bool:
    """Check whether any token (≥ min_len chars) from *a* appears in *b*."""
    tokens_a = {t for t in re.split(r"[\s\-_/]+", a) if len(t) >= min_len}
    tokens_b = {t for t in re.split(r"[\s\-_/]+", b) if len(t) >= min_len}
    return bool(tokens_a & tokens_b)
