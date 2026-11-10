"""
AuthHorizon Deterministic Validation Gate
Strict validation enforcing the non-negotiable financial safety boundary.
"""

import re
from typing import Tuple, List, Dict, Any, Optional
from backend.models import AIExtractionResult, Confidence

FORBIDDEN_CURRENCY_PATTERNS = [
    r'[\$€£¥₹]',
    r'\bUSD\b',
    r'\bEUR\b',
    r'\bGBP\b',
    r'\bDKK\b',
    r'\bkr\b',
    r'\d+\.\d{2}'  # Regex pattern looking like prices (e.g. 30.00)
]

def sanitize_and_validate_extraction(raw_extraction: Dict[str, Any]) -> AIExtractionResult:
    """
    Validates extraction dictionary against AIExtractionResult Pydantic schema
    and checks for currency contamination.
    """
    # 1. Check for currency symbols or price tokens in any text field
    for field in ["item_identifier", "new_ship_date", "reason"]:
        val = str(raw_extraction.get(field, ""))
        for pattern in FORBIDDEN_CURRENCY_PATTERNS:
            if re.search(pattern, val, re.IGNORECASE):
                raise ValueError(
                    f"Financial Safety Gate Violation: AI output contains forbidden pattern '{pattern}' in field '{field}' ('{val}')"
                )

    # 2. Parse through Pydantic model (which also has internal validators)
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
    matched_item: Optional[Dict[str, Any]]
) -> Tuple[bool, str]:
    """
    Determines if extraction can be automatically approved or must route to Merchant Review Queue.
    Requires:
      1. An item matched in the order
      2. All confidence fields == HIGH
    """
    if not matched_item:
        return True, "No matching SKU or product found in current order"

    if (
        extraction.confidence_item != Confidence.HIGH or
        extraction.confidence_date != Confidence.HIGH or
        extraction.confidence_reason != Confidence.HIGH
    ):
        return True, "Low or Medium extraction confidence detected"

    return False, "Approved for automatic buyer consent presentation"

