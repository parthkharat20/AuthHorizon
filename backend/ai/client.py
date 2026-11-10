"""
AuthHorizon Provider-Agnostic Resilient LLM Client
Multi-LLM Provider Chain: Google Gemini -> Groq Qwen -> Deterministic Offline Fallback.
Provides transparent provider attribution: provider_used, is_live_ai, model_name, provider_label.
"""

import os
import json
import requests
from typing import Dict, Any, Optional
from pydantic import BaseModel
from backend.ai.prompts import SYSTEM_PROMPT_EXTRACTION, USER_PROMPT_TEMPLATE
from backend.ai.validator import sanitize_and_validate_extraction
from backend.models import AIExtractionResult, Confidence


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
        text_lower = raw_text.lower()
        
        if "platine" in text_lower or "leiterplatte" in text_lower or "sku-coat-03" in text_lower or "ceramic" in text_lower:
            return AIExtractionResult(
                item_identifier="Ceramic Coating Kit (SKU-COAT-03)",
                new_ship_date="2026-11-20",
                reason="Supplier raw material batch shipment delay",
                language="de" if "sehr geehrte" in text_lower else "en",
                confidence_item=Confidence.HIGH,
                confidence_date=Confidence.HIGH,
                confidence_reason=Confidence.HIGH
            )
        elif "læder" in text_lower or "leather" in text_lower or "danish" in text_lower:
            return AIExtractionResult(
                item_identifier="Hydraulic Pump (SKU-PUMP-02)",
                new_ship_date="2026-11-28",
                reason="Quality inspection delay at manufacturing facility",
                language="da",
                confidence_item=Confidence.HIGH,
                confidence_date=Confidence.MED,
                confidence_reason=Confidence.HIGH
            )
        else:
            from datetime import date, timedelta
            return AIExtractionResult(
                item_identifier="Unknown Component",
                new_ship_date=(date.today() + timedelta(days=14)).isoformat(),
                reason="Unspecified supplier logistics delay",
                language="en",
                confidence_item=Confidence.LOW,
                confidence_date=Confidence.LOW,
                confidence_reason=Confidence.LOW
            )

def generate_buyer_delay_message(
    item_name: str,
    new_ship_date: str,
    reason: str,
    held_amount: float
) -> str:
    """
    Deterministic template filling: dollar amounts and dates are strictly
    injected by code AFTER AI extraction.
    """
    return (
        f"Your order has been partially shipped! However, '{item_name}' is currently delayed "
        f"due to: {reason}. The revised estimated shipping date is {new_ship_date}. "
        f"A temporary pre-authorization hold of ${held_amount:.2f} remains on your PayPal account. "
        f"You will not be charged until this item ships. You may choose to wait, swap to an in-stock item, "
        f"or cancel this item immediately to release the hold."
    )
