"""
AuthHorizon Deterministic Financial Safety Gate (T2)
Strict validation enforcing the non-negotiable boundary:
1. AI never calculates, outputs, or moves money.
2. Unicodedata category checking: reject any 'Nd' (numbers) or 'Sc' (currency symbols) in AI text fields.
3. Multilingual currency word rejection (en/de/da/ja).
4. Strict ISO-8601 YYYY-MM-DD future date validation.
5. Grounding check against source text for auto-approval.
"""

import re
import unicodedata
from datetime import datetime, date, timedelta
from typing import Tuple, List, Dict, Any, Optional, Set
from backend.models import AIExtractionResult, Confidence

# Per-language currency words dictionary (en/de/da/ja)
CURRENCY_WORDS: Dict[str, Set[str]] = {
    "en": {
        "dollar", "dollars", "cent", "cents", "usd", "eur", "euro", "euros",
        "pound", "pounds", "gbp", "yen", "jpy", "krone", "kroner", "dkk",
        "buck", "bucks", "cash", "refund", "charge", "payment", "price", "fee",
        "credit", "credits", "payout", "payouts"
    },
    "de": {
        "dollar", "euro", "cent", "cents", "pfennig", "pfennige", "kronen",
        "krone", "yen", "geld", "erstattung", "rückerstattung", "zahlung",
        "preis", "gebühr", "kosten", "erstatten", "erstattet", "auszahlung", "vergütung"
    },
    "da": {
        "krone", "kroner", "øre", "dollar", "euro", "cent", "betaling",
        "refusion", "gebyr", "pris", "omkostning", "refundere", "refunderet", "udbetaling"
    },
    "ja": {
        "円", "ドル", "ユーロ", "ポンド", "セント", "通貨", "金額", "返金",
        "支払い", "価格", "費用", "yen", "dollar", "euro", "請求"
    }
}

ALL_CURRENCY_WORDS = set().union(*CURRENCY_WORDS.values())

# Japanese substrings for unsegmented text matching
JAPANESE_CURRENCY_SUBSTRINGS = {"円", "ドル", "ユーロ", "ポンド", "セント", "返金", "支払い", "価格", "費用"}


def normalize_date_literal(date_str: str) -> str:
    """
    Normalizes dotted dates (e.g. German/Danish 22.11.2026 or 2026.11.22)
    to ISO YYYY-MM-DD.
    """
    if not date_str:
        return ""
    s = date_str.strip()
    
    # Match DD.MM.YYYY
    m = re.match(r'^(\d{1,2})\.(\d{1,2})\.(\d{4})$', s)
    if m:
        d, m_val, y = m.groups()
        return f"{y}-{m_val.zfill(2)}-{d.zfill(2)}"
        
    # Match YYYY.MM.DD
    m2 = re.match(r'^(\d{4})\.(\d{1,2})\.(\d{1,2})$', s)
    if m2:
        y, m_val, d = m2.groups()
        return f"{y}-{m_val.zfill(2)}-{d.zfill(2)}"
        
    return s


def validate_ship_date(date_str: str) -> str:
    """
    Enforces ^\\d{4}-\\d{2}-\\d{2}$ and checks that the date is a plausible future date
    (today or later, and within 365 days).
    """
    normalized = normalize_date_literal(date_str)
    if not re.match(r'^\d{4}-\d{2}-\d{2}$', normalized):
        raise ValueError(
            f"Financial Safety Gate Violation: new_ship_date '{date_str}' must match YYYY-MM-DD format"
        )
    
    try:
        parsed = datetime.strptime(normalized, "%Y-%m-%d").date()
    except ValueError as e:
        raise ValueError(f"Financial Safety Gate Violation: Invalid calendar date '{normalized}': {e}")
        
    today = date.today()
    if parsed < today:
        raise ValueError(f"Financial Safety Gate Violation: new_ship_date '{normalized}' is in the past (today: {today})")
        
    if parsed > today + timedelta(days=365):
        raise ValueError(f"Financial Safety Gate Violation: new_ship_date '{normalized}' exceeds 1-year future threshold")
        
    return normalized


def validate_ai_text_field(text: str, field_name: str = "text", allow_placeholders: bool = False) -> str:
    """
    Validates that an AI text field (reason or buyer message):
    1. Normalizes using NFKC.
    2. Strips allowed placeholders ({ITEM}, {DATE}, {AMOUNT}, etc.) if specified.
    3. Rejects any character with unicodedata category 'Nd' (digits) or 'Sc' (currency symbols).
    4. Rejects any currency/payment terms across en, de, da, ja.
    5. Rejects URLs.
    """
    if not text:
        return ""

    # NFKC Normalize first
    normalized = unicodedata.normalize('NFKC', text)

    # Strip placeholders if template validation
    check_text = normalized
    if allow_placeholders:
        check_text = re.sub(r'\{[A-Za-z0-9_]+\}', '', check_text)

    # Reject URLs
    if re.search(r'https?://|www\.', check_text, re.IGNORECASE):
        raise ValueError(f"Financial Safety Gate Violation: {field_name} contains forbidden URL")

    # Reject unicodedata category 'Nd' (decimal digits) and 'Sc' (currency symbols)
    for ch in check_text:
        cat = unicodedata.category(ch)
        if cat == 'Nd':
            raise ValueError(
                f"Financial Safety Gate Violation: {field_name} contains forbidden digit character '{ch}' (category Nd). Only new_ship_date may contain digits."
            )
        if cat == 'Sc':
            raise ValueError(
                f"Financial Safety Gate Violation: {field_name} contains forbidden currency symbol '{ch}' (category Sc)."
            )

    # Reject per-language currency and payment words (word boundary check)
    text_lower = check_text.lower()
    words = set(re.findall(r'\b[a-zæøåäöüß]+\b', text_lower))
    found_currency_words = words.intersection(ALL_CURRENCY_WORDS)
    if found_currency_words:
        raise ValueError(
            f"Financial Safety Gate Violation: {field_name} contains forbidden currency term: {sorted(list(found_currency_words))}"
        )

    # Japanese unsegmented substring check
    for ja_term in JAPANESE_CURRENCY_SUBSTRINGS:
        if ja_term in check_text:
            raise ValueError(
                f"Financial Safety Gate Violation: {field_name} contains forbidden Japanese currency term '{ja_term}'"
            )

    return normalized


def sanitize_and_validate_extraction(raw_extraction: Dict[str, Any]) -> AIExtractionResult:
    """
    Applies deterministic T2 safety gate to raw extraction dictionary before Pydantic parsing.
    """
    # Normalize ship date
    if "new_ship_date" in raw_extraction:
        raw_extraction["new_ship_date"] = normalize_date_literal(str(raw_extraction["new_ship_date"]))
        validate_ship_date(raw_extraction["new_ship_date"])

    # Validate reason field
    if "reason" in raw_extraction:
        validate_ai_text_field(str(raw_extraction["reason"]), field_name="reason", allow_placeholders=False)

    # Validate item_identifier field (no currency symbols or currency words)
    if "item_identifier" in raw_extraction:
        item_id = unicodedata.normalize('NFKC', str(raw_extraction["item_identifier"]))
        for ch in item_id:
            if unicodedata.category(ch) == 'Sc':
                raise ValueError(f"Financial Safety Gate Violation: item_identifier contains currency symbol '{ch}'")
        words = set(re.findall(r'\b[a-zæøåäöüß]+\b', item_id.lower()))
        if words.intersection(ALL_CURRENCY_WORDS):
            raise ValueError(f"Financial Safety Gate Violation: item_identifier contains currency term")

    return AIExtractionResult(**raw_extraction)


def match_item_in_order(
    extracted_identifier: str,
    line_items: List[Dict[str, Any]]
) -> Tuple[Optional[Dict[str, Any]], float]:
    """
    Fuzzy match extracted item identifier against known line items in order.
    Returns (matched_item, match_score).
    """
    target = extracted_identifier.lower().strip()
    best_item = None
    best_score = 0.0

    for item in line_items:
        sku = item.get("sku", "").lower()
        name = item.get("name", "").lower()
        
        # Exact SKU match
        if target == sku or sku in target or target in sku:
            return item, 1.0
            
        # Substring / token matching
        name_tokens = set(re.findall(r'\w+', name))
        target_tokens = set(re.findall(r'\w+', target))
        if name_tokens and target_tokens:
            common = name_tokens.intersection(target_tokens)
            score = len(common) / max(len(name_tokens), len(target_tokens))
            if score > best_score:
                best_score = score
                best_item = item

    if best_score >= 0.4:
        return best_item, best_score
    return None, 0.0


def evaluate_review_routing(
    extraction: AIExtractionResult,
    matched_item: Optional[Dict[str, Any]],
    raw_notice_text: Optional[str] = None
) -> Tuple[bool, str]:
    """
    Determines if extraction can be automatically approved or must route to Merchant Review Queue.
    Requires grounding:
      1. Item matched in order
      2. All confidence fields == HIGH
      3. If raw_notice_text provided: item identifier and date literal must appear in source notice.
    """
    if not matched_item:
        return True, "No matching SKU or product found in current order"

    if (
        extraction.confidence_item != Confidence.HIGH or
        extraction.confidence_date != Confidence.HIGH or
        extraction.confidence_reason != Confidence.HIGH
    ):
        return True, "Low or Medium extraction confidence detected"

    # Grounding Check: Item identifier and date literal must be grounded in raw notice
    if raw_notice_text:
        notice_norm = unicodedata.normalize('NFKC', raw_notice_text).lower()
        sku_clean = matched_item.get("sku", "").lower()
        
        # Grounding item: SKU or identifier must appear in notice
        if sku_clean not in notice_norm and extraction.item_identifier.lower() not in notice_norm:
            return True, "Item identifier is not grounded in source notice text"

        # Grounding date: the date digits (e.g. YYYY or DD.MM.YYYY or YYYY-MM-DD) must be mentioned
        date_parts = extraction.new_ship_date.split("-")
        if len(date_parts) == 3:
            year, month, day = date_parts
            dotted_date = f"{int(day)}.{int(month)}.{year}"
            dotted_date_z = f"{day}.{month}.{year}"
            iso_date = extraction.new_ship_date
            if (iso_date not in notice_norm and 
                dotted_date not in notice_norm and 
                dotted_date_z not in notice_norm and
                f"{int(day)}" not in notice_norm):
                return True, "Extraction date is not grounded in source notice text"

    return False, "Approved for automatic buyer consent presentation"
