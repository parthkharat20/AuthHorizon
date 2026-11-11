"""
Module 4 Tests: HMAC-SHA256 Audit Trail & Red-Team Chaos Simulator
"""

import pytest
import hmac
import hashlib
from backend.main import app, get_gateway
from backend.gateway.mock_gateway import MockPayPalGateway

# Ensure mock gateway override persists for API tests
app.dependency_overrides[get_gateway] = lambda: MockPayPalGateway()


def test_hmac_consent_hash_deterministic():
    """HMAC-SHA256 produces consistent hashes for the same input."""
    from backend.evidence import compute_hmac_consent_hash
    payload = '{"choice":"SWAP","order_id":1}'
    h1 = compute_hmac_consent_hash(payload)
    h2 = compute_hmac_consent_hash(payload)
    assert h1 == h2
    assert len(h1) == 64  # SHA-256 hex digest length


def test_hmac_differs_from_plain_sha256():
    """HMAC-SHA256 produces different hashes than plain SHA-256."""
    from backend.evidence import compute_hmac_consent_hash
    payload = '{"choice":"SWAP","order_id":1}'
    hmac_hash = compute_hmac_consent_hash(payload)
    plain_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    assert hmac_hash != plain_hash


def test_hmac_verify_valid():
    """Valid HMAC verification passes."""
    from backend.evidence import compute_hmac_consent_hash, verify_hmac_consent_hash
    payload = '{"test":"data"}'
    h = compute_hmac_consent_hash(payload)
    assert verify_hmac_consent_hash(payload, h) == True


def test_hmac_verify_tampered():
    """Tampered payload fails HMAC verification."""
    from backend.evidence import compute_hmac_consent_hash, verify_hmac_consent_hash
    payload = '{"test":"data"}'
    h = compute_hmac_consent_hash(payload)
    assert verify_hmac_consent_hash('{"test":"TAMPERED"}', h) == False


def test_hmac_canonical_consent_backward_compatible():
    """compute_canonical_consent_payload with use_hmac=False still uses plain SHA-256."""
    from backend.evidence import compute_canonical_consent_payload, GENESIS_HASH
    _, hash_plain = compute_canonical_consent_payload(
        order_id=1, buyer_id="TEST", paypal_order_id="PP-1",
        authorization_id="AUTH-1", choice="WAIT",
        displayed_text="Test text", locale="en",
        timestamp_utc="2026-01-01T00:00:00", prev_hash=GENESIS_HASH,
        use_hmac=False
    )
    _, hash_hmac = compute_canonical_consent_payload(
        order_id=1, buyer_id="TEST", paypal_order_id="PP-1",
        authorization_id="AUTH-1", choice="WAIT",
        displayed_text="Test text", locale="en",
        timestamp_utc="2026-01-01T00:00:00", prev_hash=GENESIS_HASH,
        use_hmac=True
    )
    assert hash_plain != hash_hmac  # Different algorithms
    assert len(hash_plain) == 64
    assert len(hash_hmac) == 64


def test_chaos_tamper_simulation_endpoint(setup_test_db):
    """Test the chaos tamper simulation endpoint."""
    from fastapi.testclient import TestClient
    
    client = TestClient(app)
    # Create order, authorize, ship, submit consent
    create_res = client.post("/api/orders/create", json={
        "items": [
            {"sku": "SKU-BEAR-01", "name": "Bearings", "amount": 30.0, "quantity": 1},
            {"sku": "SKU-PUMP-02", "name": "Pump", "amount": 30.0, "quantity": 1},
        ],
        "currency": "USD"
    })
    order_id = create_res.json()["order_id"]
    client.post(f"/api/orders/{order_id}/authorize")
    client.post(f"/api/orders/{order_id}/ship-partial")
    
    # Submit consent to create a consent record
    client.post("/api/consent/submit", json={
        "order_id": order_id,
        "choice": "WAIT",
        "locale": "en"
    })
    
    # Run chaos simulation
    chaos_res = client.post(f"/api/chaos/simulate-tamper/{order_id}")
    assert chaos_res.status_code == 200
    data = chaos_res.json()
    assert data["tamper_detected"] == True
    assert "TAMPER DETECTED" in data["verdict"]
    assert data["simulation"] == "CONSENT_TAMPER"


def test_chaos_chain_break_endpoint(setup_test_db):
    """Test the chaos chain break simulation endpoint."""
    from fastapi.testclient import TestClient
    
    client = TestClient(app)
    # Create order with 2 consent records
    create_res = client.post("/api/orders/create", json={
        "items": [
            {"sku": "SKU-BEAR-01", "name": "Bearings", "amount": 30.0, "quantity": 1},
        ],
        "currency": "USD"
    })
    order_id = create_res.json()["order_id"]
    client.post(f"/api/orders/{order_id}/authorize")
    
    # Submit two consents
    client.post("/api/consent/submit", json={
        "order_id": order_id,
        "choice": "WAIT",
        "locale": "en"
    })
    client.post("/api/consent/submit", json={
        "order_id": order_id,
        "choice": "WAIT",
        "locale": "en"
    })
    
    # Run chain break simulation
    break_res = client.post(f"/api/chaos/simulate-chain-break/{order_id}")
    assert break_res.status_code == 200
    data = break_res.json()
    assert data["chain_break_detected"] == True
    assert "CHAIN BREAK DETECTED" in data["verdict"]

