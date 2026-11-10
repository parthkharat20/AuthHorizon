"""
AuthHorizon T3 Test Suite — Multi-LLM Provider Chain & Resilient Fallback
Verifies:
  1. Primary provider success (Gemini) returns provider_used="gemini", is_live_ai=True.
  2. Failover when primary fails: Groq takes over and returns provider_used="groq", is_live_ai=True.
  3. Failover when both fail/offline: deterministic cached mock returns provider_used="cached", is_live_ai=False.
  4. Safety gate violation cannot be bypassed by falling back to mock.
  5. Active provider preference switching (groq primary vs gemini primary).
  6. API route /api/supplier/parse-notice properly returns provider attribution metadata.
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from backend.ai.client import AIParserClient, NoticeParseResult
from backend.models import AIExtractionResult, Confidence
from backend.main import app, get_gateway
from backend.gateway.mock_gateway import MockPayPalGateway

# Ensure sandboxed test execution uses shared Mock PayPal Gateway instance
_mock_gw = MockPayPalGateway()
app.dependency_overrides[get_gateway] = lambda: _mock_gw


# ── Fixtures & Helpers ──────────────────────────────────────────

SAMPLE_NOTICE_GERMAN = (
    "Sehr geehrte Damen und Herren,\n"
    "aufgrund eines Lieferengpasses bei Platine (SKU-COAT-03) verzögert sich der Versand auf den 2026-11-22.\n"
    "Grund: Vorlieferantenverzögerung bei Rohstoffen."
)

VALID_EXTRACTION_GERMAN = AIExtractionResult(
    item_identifier="SKU-COAT-03",
    new_ship_date="2026-11-22",
    reason="Vorlieferantenverzögerung bei Rohstoffen",
    language="de",
    confidence_item=Confidence.HIGH,
    confidence_date=Confidence.HIGH,
    confidence_reason=Confidence.HIGH
)


# ── Test Cases ──────────────────────────────────────────────────

def test_gemini_success_attribution():
    """When Gemini succeeds, returns provider_used='gemini' and is_live_ai=True."""
    client = AIParserClient()
    client.gemini_key = "mock-gemini-key"
    client.groq_key = "mock-groq-key"

    with patch.object(client, "_parse_with_gemini", return_value=VALID_EXTRACTION_GERMAN) as mock_gemini:
        with patch.object(client, "_parse_with_groq") as mock_groq:
            result = client.parse_notice(SAMPLE_NOTICE_GERMAN)

            assert isinstance(result, NoticeParseResult)
            assert result.provider_used == "gemini"
            assert result.is_live_ai is True
            assert result.model_name == client.gemini_model
            assert "Gemini" in result.provider_label
            assert result.item_identifier == "SKU-COAT-03"
            assert result.new_ship_date == "2026-11-22"

            mock_gemini.assert_called_once()
            mock_groq.assert_not_called()


def test_gemini_failure_falls_back_to_groq():
    """When Gemini fails or times out, failover chain invokes Groq."""
    client = AIParserClient()
    client.gemini_key = "mock-gemini-key"
    client.groq_key = "mock-groq-key"

    with patch.object(client, "_parse_with_gemini", side_effect=RuntimeError("Gemini 503 Service Unavailable")):
        with patch.object(client, "_parse_with_groq", return_value=VALID_EXTRACTION_GERMAN) as mock_groq:
            result = client.parse_notice(SAMPLE_NOTICE_GERMAN)

            assert isinstance(result, NoticeParseResult)
            assert result.provider_used == "groq"
            assert result.is_live_ai is True
            assert result.model_name == client.groq_model
            assert "Groq" in result.provider_label
            assert result.item_identifier == "SKU-COAT-03"

            mock_groq.assert_called_once()


def test_both_live_fail_falls_back_to_cached_mock():
    """When all live providers fail or are unconfigured, chain safely uses cached deterministic mock."""
    client = AIParserClient()
    client.gemini_key = "mock-gemini-key"
    client.groq_key = "mock-groq-key"

    with patch.object(client, "_parse_with_gemini", side_effect=ConnectionError("Sandbox Network Isolation")):
        with patch.object(client, "_parse_with_groq", side_effect=TimeoutError("Groq Gateway Timeout")):
            result = client.parse_notice(SAMPLE_NOTICE_GERMAN)

            assert isinstance(result, NoticeParseResult)
            assert result.provider_used == "cached"
            assert result.is_live_ai is False
            assert result.model_name == "deterministic-mock-v1"
            assert "CACHED" in result.provider_label or "MOCK" in result.provider_label
            # Verified mock returns ceramic coating fixture
            assert "COAT" in result.item_identifier or "Ceramic" in result.item_identifier


def test_groq_primary_preference():
    """When ACTIVE_LLM_PROVIDER='groq', Groq is prioritized first."""
    client = AIParserClient()
    client.provider = "groq"
    client.gemini_key = "mock-gemini-key"
    client.groq_key = "mock-groq-key"

    with patch.object(client, "_parse_with_groq", return_value=VALID_EXTRACTION_GERMAN) as mock_groq:
        with patch.object(client, "_parse_with_gemini") as mock_gemini:
            result = client.parse_notice(SAMPLE_NOTICE_GERMAN)

            assert result.provider_used == "groq"
            assert result.is_live_ai is True
            mock_groq.assert_called_once()
            mock_gemini.assert_not_called()


def test_safety_gate_violation_never_bypassed_by_fallback():
    """
    If AI output violates the deterministic safety gate (e.g. contains currency symbols or digits in reason),
    the ValueError MUST be raised and NOT swallowed by falling back to the mock.
    """
    client = AIParserClient()
    client.gemini_key = "mock-gemini-key"
    client.groq_key = "mock-groq-key"

    safety_error = ValueError("Safety Gate Violation: reason must not contain currency symbol '$'")

    with patch.object(client, "_parse_with_gemini", side_effect=safety_error):
        with patch.object(client, "_parse_with_groq", side_effect=safety_error):
            with pytest.raises(ValueError, match="Safety Gate Violation"):
                client.parse_notice("Adversarial payload with $500 payout")


def test_api_route_includes_provider_attribution():
    """Verify /api/supplier/parse-notice exposes provider metadata."""
    test_client = TestClient(app)

    # 1. Create Order
    create_res = test_client.post("/api/orders/create", json={
        "items": [
            {"sku": "SKU-COAT-03", "name": "Ceramic Coating Kit", "amount": 30.0, "quantity": 1}
        ],
        "currency": "USD"
    })
    assert create_res.status_code == 200
    order_id = create_res.json()["order_id"]

    # 2. Parse Notice
    parse_res = test_client.post("/api/supplier/parse-notice", json={
        "order_id": order_id,
        "raw_text": SAMPLE_NOTICE_GERMAN
    })
    assert parse_res.status_code == 200
    data = parse_res.json()

    assert "provider_used" in data
    assert data["provider_used"] in ("gemini", "groq", "cached")
    assert "is_live_ai" in data
    assert isinstance(data["is_live_ai"], bool)
    assert "model_name" in data
    assert "provider_label" in data
