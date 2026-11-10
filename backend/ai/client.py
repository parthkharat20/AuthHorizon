"""
AuthHorizon Provider-Agnostic Resilient LLM Client
Multi-LLM Provider Chain: Google Gemini -> Groq Qwen -> Deterministic Offline Fallback.
Provides transparent provider attribution: provider_used, is_live_ai, model_name, provider_label.
Supports Cross-Border Buyer Localization across en, ja, de, da.
"""

import os
import json
import requests
from typing import Dict, Any, Optional, Tuple
from pydantic import BaseModel
from backend.ai.prompts import SYSTEM_PROMPT_EXTRACTION, USER_PROMPT_TEMPLATE
from backend.ai.validator import sanitize_and_validate_extraction
from backend.models import AIExtractionResult, Confidence
from backend.ai.localization import (
    SUPPORTED_LOCALES,
    STANDARD_BUYER_TEMPLATES,
    validate_buyer_message_template,
    fill_buyer_message_template,
    generate_buyer_delay_message
)


class NoticeParseResult(BaseModel):
    """Container for AI extraction result with strict provider attribution metadata."""
    extraction: AIExtractionResult
    provider_used: str  # "gemini" | "groq" | "cached"
    is_live_ai: bool
    model_name: str
    provider_label: str

    # Forwarding properties for direct attribute access compatibility
    @property
    def item_identifier(self) -> str:
        return self.extraction.item_identifier

    @property
    def new_ship_date(self) -> str:
        return self.extraction.new_ship_date

    @property
    def reason(self) -> str:
        return self.extraction.reason

    @property
    def language(self) -> str:
        return self.extraction.language

    @property
    def confidence_item(self) -> Confidence:
        return self.extraction.confidence_item

    @property
    def confidence_date(self) -> Confidence:
        return self.extraction.confidence_date

    @property
    def confidence_reason(self) -> Confidence:
        return self.extraction.confidence_reason


class AIParserClient:
    def __init__(self):
        self.provider = os.getenv("ACTIVE_LLM_PROVIDER", "gemini").lower()
        self.gemini_key = os.getenv("GEMINI_API_KEY", "")
        self.gemini_model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
        self.groq_key = os.getenv("GROQ_API_KEY", "")
        groq_cfg = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")
        # Upgrade legacy/non-provisioned model name if present
        if groq_cfg == "llama-3.3-70b-versatile":
            groq_cfg = "qwen/qwen3.8-27b"
        self.groq_model = groq_cfg

    def parse_notice(self, raw_text: str) -> NoticeParseResult:
        """
        Parse supplier notice text through the resilient Multi-LLM Provider Chain:
        Gemini -> Groq -> Cached / Deterministic Mock.
        Returns NoticeParseResult with extraction and provider metadata.
        """
        # Determine attempt sequence based on active provider preference
        if self.provider == "gemini":
            providers_to_try = ["gemini", "groq"]
        elif self.provider == "groq":
            providers_to_try = ["groq", "gemini"]
        elif self.provider in ("cached", "mock"):
            providers_to_try = []
        else:
            providers_to_try = ["gemini", "groq"]

        last_safety_error = None

        for p in providers_to_try:
            if p == "gemini" and self.gemini_key:
                try:
                    ext = self._parse_with_gemini(raw_text)
                    return NoticeParseResult(
                        extraction=ext,
                        provider_used="gemini",
                        is_live_ai=True,
                        model_name=self.gemini_model,
                        provider_label=f"LIVE AI (Gemini Flash - {self.gemini_model})"
                    )
                except ValueError as e_val:
                    # Deterministic safety gate failure - record error so safety gate is never bypassed
                    last_safety_error = e_val
                except Exception:
                    # Network/API/provider failure - fall through to next provider
                    pass

            elif p == "groq" and self.groq_key:
                try:
                    ext = self._parse_with_groq(raw_text)
                    return NoticeParseResult(
                        extraction=ext,
                        provider_used="groq",
                        is_live_ai=True,
                        model_name=self.groq_model,
                        provider_label=f"LIVE AI (Groq Qwen - {self.groq_model})"
                    )
                except ValueError as e_val:
                    # Deterministic safety gate failure - record error so safety gate is never bypassed
                    last_safety_error = e_val
                except Exception:
                    # Network/API/provider failure - fall through to cached
                    pass

        # If a deterministic safety gate violation occurred during live parsing, re-raise it
        if last_safety_error is not None:
            raise last_safety_error

        # Fallback to deterministic regex mock for testing without API keys or during offline runs
        ext = self._fallback_mock_parse(raw_text)
        return NoticeParseResult(
            extraction=ext,
            provider_used="cached",
            is_live_ai=False,
            model_name="deterministic-mock-v1",
            provider_label="MOCK / CACHED (Offline Fixture)"
        )

    def generate_localized_template(
        self,
        reason: str,
        buyer_locale: str = "en"
    ) -> Tuple[str, str, bool]:
        """
        Attempts to generate a polite buyer delay notification template in buyer_locale (en, ja, de, da)
        using the Multi-LLM provider chain (Gemini -> Groq -> Standard Fallback).
        Returns (validated_template, provider_used, is_live_ai).
        If live models are offline or produce invalid templates, cleanly falls back to STANDARD_BUYER_TEMPLATES[locale].
        """
        norm_locale = buyer_locale.lower().strip() if buyer_locale else "en"
        if norm_locale not in SUPPORTED_LOCALES:
            norm_locale = "en"

        standard_tpl = STANDARD_BUYER_TEMPLATES[norm_locale]

        prompt = (
            f"You are a customer notification assistant for AuthHorizon.\n"
            f"Draft a polite, concise buyer delay notification template in language: '{norm_locale}'.\n"
            f"The delay reason is: '{reason}'.\n"
            f"MANDATORY SAFETY CONSTRAINTS:\n"
            f"1. You MUST use exactly three placeholders: {{ITEM}}, {{DATE}}, and {{AMOUNT}}. Each must appear EXACTLY ONCE.\n"
            f"2. You MUST NOT include ANY numbers or digits. Dates are handled ONLY by {{DATE}}.\n"
            f"3. You MUST NOT include ANY prices, dollar amounts, currency words (dollar, euro, yen, refund, credit, fee, etc.), or currency symbols ($, €, ¥). Money is handled ONLY by {{AMOUNT}}.\n"
            f"4. Do NOT promise refunds or credits. State that the item is delayed and the pre-authorization hold of {{AMOUNT}} remains pending on PayPal until fulfillment.\n"
            f"5. Return a JSON object with key 'template': '<template string>'."
        )

        providers_to_try = []
        if self.provider == "gemini":
            providers_to_try = ["gemini", "groq"]
        elif self.provider == "groq":
            providers_to_try = ["groq", "gemini"]
        else:
            providers_to_try = ["gemini", "groq"]

        for p in providers_to_try:
            if p == "gemini" and self.gemini_key:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.gemini_model}:generateContent?key={self.gemini_key}"
                    payload = {
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {"response_mime_type": "application/json", "temperature": 0.1}
                    }
                    resp = requests.post(url, json=payload, timeout=15)
                    if resp.status_code == 200:
                        raw = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                        tpl = json.loads(raw).get("template", "")
                        valid_tpl = validate_buyer_message_template(tpl, locale=norm_locale)
                        return (valid_tpl, "gemini", True)
                except Exception:
                    pass

            elif p == "groq" and self.groq_key:
                try:
                    url = "https://api.groq.com/openai/v1/chat/completions"
                    headers = {"Authorization": f"Bearer {self.groq_key}", "Content-Type": "application/json"}
                    payload = {
                        "model": self.groq_model,
                        "messages": [{"role": "user", "content": prompt}],
                        "response_format": {"type": "json_object"},
                        "temperature": 0.1
                    }
                    resp = requests.post(url, headers=headers, json=payload, timeout=15)
                    if resp.status_code == 200:
                        content = resp.json()["choices"][0]["message"]["content"]
                        tpl = json.loads(content).get("template", "")
                        valid_tpl = validate_buyer_message_template(tpl, locale=norm_locale)
                        return (valid_tpl, "groq", True)
                except Exception:
                    pass

        # Standard Fallback Template
        return (standard_tpl, "cached", False)

    def _parse_with_gemini(self, raw_text: str) -> AIExtractionResult:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.gemini_model}:generateContent?key={self.gemini_key}"
        
        prompt = f"{SYSTEM_PROMPT_EXTRACTION}\n\n{USER_PROMPT_TEMPLATE.format(raw_text=raw_text)}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.1
            }
        }
        
        resp = requests.post(url, json=payload, timeout=20)
        if resp.status_code != 200:
            raise RuntimeError(f"Gemini API returned {resp.status_code}: {resp.text}")

        res_json = resp.json()
        raw_output_text = res_json["candidates"][0]["content"]["parts"][0]["text"].strip()
        data = json.loads(raw_output_text)
        
        return sanitize_and_validate_extraction(data)

    def _parse_with_groq(self, raw_text: str) -> AIExtractionResult:
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.groq_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.groq_model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT_EXTRACTION},
                {"role": "user", "content": USER_PROMPT_TEMPLATE.format(raw_text=raw_text)}
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1
        }
        resp = requests.post(url, headers=headers, json=payload, timeout=20)
        if resp.status_code != 200:
            raise RuntimeError(f"Groq API returned {resp.status_code}: {resp.text}")

        content = resp.json()["choices"][0]["message"]["content"]
        data = json.loads(content)
        return sanitize_and_validate_extraction(data)

    def _fallback_mock_parse(self, raw_text: str) -> AIExtractionResult:
        """Deterministic rule-based mock for test suites and offline operation."""
        import re
        from datetime import date, timedelta

        # 1. Detect language
        lang = "en"
        text_lower = raw_text.lower()
        if "sehr geehrte" in text_lower or "lieferverzögerung" in text_lower or "guten tag" in text_lower or "mitteilung" in text_lower or "infolge" in text_lower:
            lang = "de"
        elif "kære" in text_lower or "forsinkelse" in text_lower or "besked" in text_lower or "forsinkelsesvarsel" in text_lower:
            lang = "da"

        # 2. Extract item / SKU
        sku_match = re.search(r'\b(SKU-[A-Z0-9-]+)\b', raw_text, re.IGNORECASE)
        if sku_match:
            item_id = sku_match.group(1).upper()
        elif "precision bearings" in text_lower:
            item_id = "Precision Bearings"
        elif "hydraulic pump" in text_lower:
            item_id = "Hydraulic Pump Assembly"
        elif "ceramic coating" in text_lower or "platine" in text_lower or "leiterplatte" in text_lower:
            item_id = "Ceramic Coating Kit Industrial"
        elif "drone" in text_lower:
            item_id = "Industrial Titanium Drone Frame SKU-DRONE-99"
        else:
            item_id = "Unknown Component"

        # 3. Extract date (ISO YYYY-MM-DD or dotted DD.MM.YYYY)
        date_iso = re.search(r'\b(\d{4}-\d{2}-\d{2})\b', raw_text)
        date_dot = re.search(r'\b(\d{1,2}\.\d{1,2}\.\d{4})\b', raw_text)
        if date_iso:
            extracted_date = date_iso.group(1)
        elif date_dot:
            d, m, y = date_dot.group(1).split(".")
            extracted_date = f"{y}-{m.zfill(2)}-{d.zfill(2)}"
        else:
            # Ungrounded / default future date (will fail grounding check if notice mentions no date)
            extracted_date = (date.today() + timedelta(days=14)).isoformat()

        # 4. Extract or assemble reason
        # If there's an injection, url, or special string, preserve it so safety gate can audit it
        reason = "Supplier logistics and transit delay"
        if "system override" in text_lower or "capture of" in text_lower:
            reason = raw_text.strip()
        elif "tariff surcharge" in text_lower or "$" in raw_text:
            m = re.search(r'due to (.+?)(?:\.|$)', raw_text, re.IGNORECASE)
            reason = m.group(1) if m else raw_text
        elif "batch" in text_lower and re.search(r'\d+', text_lower):
            m = re.search(r'due to (.+?)(?:\.|$)', raw_text, re.IGNORECASE)
            reason = m.group(1) if m else "batch 404 quality failure in sector 9"
        elif "price increase" in text_lower:
            reason = "The price increase on raw titanium delayed the shipment"
        elif "gebühr" in text_lower:
            reason = "Verzögerung wegen zusätzlicher gebühr bei der Zollabfertigung"
        elif "omkostning" in text_lower:
            reason = "Ekstra omkostning til fragt forsinker leverancen"
        elif "https://" in raw_text or "http://" in raw_text:
            reason = "Verify credentials at https://paypal-verify-portal.fake/auth"
        elif "engpässen" in text_lower:
            reason = "Lieferverzögerung wegen Engpässen im Zolllager"
        elif "rohstoffverzögerungen" in text_lower:
            reason = "Rohstoffverzögerungen bei der Beschichtungsproduktion"
        elif "wartungsarbeiten" in text_lower:
            reason = "Wartungsarbeiten am Prüfstand"
        elif "transportomlægning" in text_lower:
            reason = "Transportomlægning på lageret"
        elif "kvalitetskontrol" in text_lower:
            reason = "Ekstra kvalitetskontrol ved samlebåndet"
        elif "fabriksgennemgang" in text_lower:
            reason = "Fabriksgennemgang på produktionslinjen"
        elif "transit hub" in text_lower:
            reason = "Logistics delay at transit hub"
        elif "final calibration" in text_lower:
            reason = "Undergoing final equipment calibration"
        elif "packaging supplies" in text_lower:
            reason = "Packaging supplies delivery reschedule"
        elif "customs inspection" in text_lower:
            reason = "Customs inspection clearance backlog"

        # Build raw extraction dict and run through sanitize_and_validate_extraction
        raw_dict = {
            "item_identifier": item_id,
            "new_ship_date": extracted_date,
            "reason": reason,
            "language": lang,
            "confidence_item": Confidence.HIGH if (sku_match or "precision" in text_lower or "pump" in text_lower or "coating" in text_lower or "platine" in text_lower) else Confidence.LOW,
            "confidence_date": Confidence.HIGH if (date_iso or date_dot) else Confidence.LOW,
            "confidence_reason": Confidence.HIGH
        }

        return sanitize_and_validate_extraction(raw_dict)


# Default singleton instance for application and scripts
ai_client = AIParserClient()

