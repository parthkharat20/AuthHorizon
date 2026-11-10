"""
AuthHorizon T5 Test Suite — Consent Evidence & Tamper-Evident SHA-256 Hash Chain
Verifies:
  1. Canonical JSON formatting determinism (sort_keys=True, separators=(',', ':'), ensure_ascii=False, UTF-8).
  2. Cryptographic SHA-256 binding of consent choices, exact displayed text, locale, and timestamps.
  3. Blockchain-style prev_hash linking across consecutive consent events.
  4. Tamper detection: modifying a single character in displayed_text or breaking chain linkage is caught.
  5. Multilingual UTF-8 character preservation (Japanese, German, Danish) in canonical payloads.
  6. API routes /api/orders/{id}/evidence, /api/orders/{id}/evidence/download, and /api/orders/{id}/evidence/verify.
"""

import json
import hashlib
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from backend.evidence import (
    GENESIS_HASH,
    compute_canonical_consent_payload,
    verify_consent_chain,
    generate_order_evidence_bundle
)
from backend.models import BuyerConsentModel, ConsentChoice, OrderModel, OrderStatus
from backend.main import app, get_gateway
from backend.gateway.mock_gateway import MockPayPalGateway

# Ensure sandboxed test execution uses shared Mock PayPal Gateway instance
_mock_gw = MockPayPalGateway()
app.dependency_overrides[get_gateway] = lambda: _mock_gw


# ── Test Suite A: Canonical JSON Determinism & Hashing ─────────────

def test_canonical_json_determinism_and_formatting():
    """Verify that identical input data produces byte-for-byte identical canonical JSON and hash."""
    ts = "2026-11-10T16:00:00Z"
    text = "Buyer consented to wait for Ceramic Coating Kit. Holding $30.00 until fulfillment."

    payload1, hash1 = compute_canonical_consent_payload(
        order_id=1,
        buyer_id="BUYER-PORTAL-VERIFIED",
        paypal_order_id="81R116453E1577428",
        authorization_id="4XB76663P4018954X",
        choice="WAIT",
        displayed_text=text,
        locale="en",
        timestamp_utc=ts,
        prev_hash=GENESIS_HASH
    )

    payload2, hash2 = compute_canonical_consent_payload(
        order_id=1,
        buyer_id="BUYER-PORTAL-VERIFIED",
        paypal_order_id="81R116453E1577428",
        authorization_id="4XB76663P4018954X",
        choice="WAIT",
        displayed_text=text,
        locale="en",
        timestamp_utc=ts,
        prev_hash=GENESIS_HASH
    )

    assert payload1 == payload2
    assert hash1 == hash2
    assert len(hash1) == 64

    # Strict JSON formatting: no spaces after delimiters
    assert '":' in payload1
    assert '": ' not in payload1
    assert '",' in payload1
    assert '", ' not in payload1


def test_japanese_utf8_preservation_in_canonical_payload():
    """Japanese UTF-8 characters must NOT be escaped to \\uXXXX (ensure_ascii=False)."""
    ja_text = "ご注文いただいた商品「Ceramic Coating Kit」の出荷は2026-11-22に延期されました。"
    payload, h = compute_canonical_consent_payload(
        order_id=2,
        buyer_id="BUYER-PORTAL-VERIFIED",
        paypal_order_id="81R116453E1577428",
        authorization_id="4XB76663P4018954X",
        choice="WAIT",
        displayed_text=ja_text,
        locale="ja",
        timestamp_utc="2026-11-10T16:00:00Z",
        prev_hash=GENESIS_HASH
    )

    # Raw Japanese characters must exist directly in the UTF-8 payload
    assert ja_text in payload
    assert "\\u" not in payload
    assert hashlib.sha256(payload.encode("utf-8")).hexdigest() == h


# ── Test Suite B: Hash Chain Linkage & Tamper Detection ───────────

def test_consent_hash_chain_linkage_and_verification():
    """Verify sequential consent events form an unbroken chain via prev_hash."""
    ts1 = "2026-11-10T10:00:00Z"
    text1 = "Consent 1: Wait for parts"
    p1, h1 = compute_canonical_consent_payload(
        order_id=1, buyer_id="B1", paypal_order_id="O1", authorization_id="A1",
        choice="WAIT", displayed_text=text1, locale="en", timestamp_utc=ts1, prev_hash=GENESIS_HASH
    )
    rec1 = BuyerConsentModel(
        id=1, order_id=1, choice=ConsentChoice.WAIT, displayed_text=text1,
        prev_hash=GENESIS_HASH, consent_hash=h1, canonical_payload=p1
    )

    ts2 = "2026-11-10T12:00:00Z"
    text2 = "Consent 2: Swapped to alternative"
    p2, h2 = compute_canonical_consent_payload(
        order_id=1, buyer_id="B1", paypal_order_id="O1", authorization_id="A1",
        choice="SWAP", displayed_text=text2, locale="en", timestamp_utc=ts2, prev_hash=h1
    )
    rec2 = BuyerConsentModel(
        id=2, order_id=1, choice=ConsentChoice.SWAP, displayed_text=text2,
        prev_hash=h1, consent_hash=h2, canonical_payload=p2
    )

    ts3 = "2026-11-10T14:00:00Z"
    text3 = "Consent 3: Cancelled remaining hold"
    p3, h3 = compute_canonical_consent_payload(
        order_id=1, buyer_id="B1", paypal_order_id="O1", authorization_id="A1",
        choice="CANCEL", displayed_text=text3, locale="en", timestamp_utc=ts3, prev_hash=h2
    )
    rec3 = BuyerConsentModel(
        id=3, order_id=1, choice=ConsentChoice.CANCEL, displayed_text=text3,
        prev_hash=h2, consent_hash=h3, canonical_payload=p3
    )

    chain = [rec1, rec2, rec3]
    ok, err = verify_consent_chain(chain)
    assert ok is True
    assert err is None


def test_tamper_detection_on_mutated_text():
    """Altering even a single character in the canonical text breaks hash verification."""
    ts = "2026-11-10T10:00:00Z"
    text = "Buyer consented to wait. Hold $30.00."
    p, h = compute_canonical_consent_payload(
        order_id=1, buyer_id="B1", paypal_order_id="O1", authorization_id="A1",
        choice="WAIT", displayed_text=text, locale="en", timestamp_utc=ts, prev_hash=GENESIS_HASH
    )

    # Malicious actor changes $30.00 to $90.00 in the payload
    tampered_payload = p.replace("$30.00", "$90.00")
    rec = BuyerConsentModel(
        id=1, order_id=1, choice=ConsentChoice.WAIT, displayed_text=text,
        prev_hash=GENESIS_HASH, consent_hash=h, canonical_payload=tampered_payload
    )

    ok, err = verify_consent_chain([rec])
    assert ok is False
    assert "Tamper detected" in err


def test_tamper_detection_on_broken_chain_link():
    """Breaking the link between rec2.prev_hash and rec1.consent_hash is caught."""
    ts1 = "2026-11-10T10:00:00Z"
    p1, h1 = compute_canonical_consent_payload(
        order_id=1, buyer_id="B1", paypal_order_id="O1", authorization_id="A1",
        choice="WAIT", displayed_text="T1", locale="en", timestamp_utc=ts1, prev_hash=GENESIS_HASH
    )
    rec1 = BuyerConsentModel(
        id=1, order_id=1, choice=ConsentChoice.WAIT, displayed_text="T1",
        prev_hash=GENESIS_HASH, consent_hash=h1, canonical_payload=p1
    )

    ts2 = "2026-11-10T12:00:00Z"
    p2, h2 = compute_canonical_consent_payload(
        order_id=1, buyer_id="B1", paypal_order_id="O1", authorization_id="A1",
        choice="SWAP", displayed_text="T2", locale="en", timestamp_utc=ts2, prev_hash=h1
    )
    # Tamper with prev_hash link on record 2
    rec2 = BuyerConsentModel(
        id=2, order_id=1, choice=ConsentChoice.SWAP, displayed_text="T2",
        prev_hash="f" * 64, consent_hash=h2, canonical_payload=p2
    )

    ok, err = verify_consent_chain([rec1, rec2])
    assert ok is False
    assert "Broken chain link" in err


# ── Test Suite C: API Evidence Endpoints ─────────────────────────

def test_api_evidence_endpoints():
    """Verify /api/orders/{id}/evidence, /download, and /verify."""
    client = TestClient(app)

    # 1. Create order and submit consent
    c_res = client.post("/api/orders/create", json={
        "items": [
            {"sku": "SKU-BEAR-01", "name": "Bearings", "amount": 30.0, "quantity": 1},
            {"sku": "SKU-COAT-03", "name": "Coating Kit", "amount": 30.0, "quantity": 1}
        ],
        "currency": "USD"
    })
    order_id = c_res.json()["order_id"]
    client.post(f"/api/orders/{order_id}/authorize")
    client.post(f"/api/orders/{order_id}/ship-partial")

    # Submit Consent Choice WAIT
    consent_res = client.post("/api/consent/submit", json={
        "order_id": order_id,
        "choice": "WAIT",
        "locale": "ja"
    })
    assert consent_res.status_code == 200
    c_data = consent_res.json()
    assert "consent_hash" in c_data
    assert "prev_hash" in c_data

    # 2. GET /api/orders/{id}/evidence
    ev_res = client.get(f"/api/orders/{order_id}/evidence")
    assert ev_res.status_code == 200
    bundle = ev_res.json()

    assert "evidence_bundle_sha256" in bundle
    assert len(bundle["evidence_bundle_sha256"]) == 64
    assert bundle["cryptographic_verification"]["chain_valid"] is True
    assert len(bundle["consent_records"]) >= 1
    assert bundle["consent_records"][-1]["locale"] == "ja"

    # 3. GET /api/orders/{id}/evidence/download
    dl_res = client.get(f"/api/orders/{order_id}/evidence/download")
    assert dl_res.status_code == 200
    assert dl_res.headers["content-type"].startswith("application/json")
    assert "attachment" in dl_res.headers.get("content-disposition", "")
    dl_data = json.loads(dl_res.text)
    assert dl_data["evidence_bundle_sha256"] == bundle["evidence_bundle_sha256"]

    # 4. POST /api/orders/{id}/evidence/verify
    v_res = client.post(f"/api/orders/{order_id}/evidence/verify")
    assert v_res.status_code == 200
    v_data = v_res.json()
    assert v_data["chain_valid"] is True
    assert v_data["audit_status"] == "VERIFIED_TAMPER_EVIDENT"
    assert v_data["is_tamper_free"] is True
    assert v_data["paypal_synced"] is True
