"""
Test Suite M7: Stretch Championship Integration & Compliance Verification
Verifies:
  1. PayPal Webhook signature verification and invalid signature rejection (401)
  2. PayPal Webhook processing for PAYMENT.CAPTURE.COMPLETED ledger reconciliation
  3. Dynamic Multi-Supplier rerouting endpoint success (/api/orders/{id}/reroute)
  4. Rerouting safety gate rejecting invalid/non-existent supplier codes (400)
  5. Multilingual buyer message re-localization (/api/orders/{id}/localize-message)
  6. Cryptographic Evidence Bundle generation with canonical SHA-256 and HMAC binding
  7. Tamper-evident evidence bundle JSON file download endpoint
  8. Full gateway & chain verification endpoint (/api/orders/{id}/evidence/verify)
"""

import json
import pytest
from fastapi.testclient import TestClient
from backend.main import app, get_gateway
from backend.gateway.mock_gateway import MockPayPalGateway
from backend.database import get_db, seed_demo_data
from backend.models import OrderModel, CaptureAuditModel

app.dependency_overrides[get_gateway] = lambda: MockPayPalGateway()
client = TestClient(app)


@pytest.fixture(autouse=True)
def ensure_db_seeded():
    """Ensure database has clean demo orders and supplier nodes seeded."""
    db_gen = get_db()
    db = next(db_gen)
    try:
        seed_demo_data(db)
    finally:
        db.close()


def test_webhook_rejects_invalid_signature():
    """Verify PayPal webhook endpoint rejects fraudulent or untrusted signatures with HTTP 401."""
    resp = client.post(
        "/api/webhooks/paypal",
        headers={"paypal-transmission-sig": "INVALID"},
        json={
            "event_type": "PAYMENT.CAPTURE.COMPLETED",
            "resource": {"id": "FRAUD-CAP-001"}
        }
    )
    assert resp.status_code == 401
    assert "signature verification failed" in resp.json()["detail"].lower()


def test_webhook_accepts_valid_signature_and_updates_audit():
    """Verify PayPal webhook marks capture audit records as webhook_verified."""
    db_gen = get_db()
    db = next(db_gen)
    try:
        # Create or verify an audit record
        audit = db.query(CaptureAuditModel).first()
        capture_id = audit.paypal_capture_id if audit else "MOCK-CAP-TEST-99"
        if not audit:
            audit = CaptureAuditModel(
                order_id=1,
                paypal_capture_id=capture_id,
                amount=30.0,
                final_capture=False,
                request_id="REQ-TEST-HOOK-01",
                capture_type="PARTIAL"
            )
            db.add(audit)
            db.commit()

        resp = client.post(
            "/api/webhooks/paypal",
            headers={"paypal-transmission-sig": "VALID-SANDBOX-CERT"},
            json={
                "event_type": "PAYMENT.CAPTURE.COMPLETED",
                "resource": {"id": capture_id}
            }
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "SUCCESS"
        assert data["event_type"] == "PAYMENT.CAPTURE.COMPLETED"

        # Verify database record was updated
        db.refresh(audit)
        assert audit.webhook_verified is True
        assert audit.webhook_verified_at is not None
    finally:
        db.close()


def test_supplier_reroute_success():
    """Verify line item can be autonomously rerouted to a qualified secondary supplier node."""
    resp = client.post(
        "/api/orders/1/reroute",
        params={"sku": "SKU-BEAR-01", "new_supplier_code": "SUP-EU-LOGISTICS"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("rerouted") is True
    assert data.get("sku") == "SKU-BEAR-01"
    assert data.get("to_supplier") == "SUP-EU-LOGISTICS"


def test_supplier_reroute_invalid_supplier_rejected():
    """Verify reroute rejects non-existent suppliers with HTTP 400 to prevent orphaned allocations."""
    resp = client.post(
        "/api/orders/1/reroute",
        params={"sku": "SKU-BEAR-01", "new_supplier_code": "SUP-NONEXISTENT-99"}
    )
    assert resp.status_code == 400
    assert "not found" in resp.json()["detail"].lower()


def test_localize_order_message_multilingual():
    """Verify dynamic re-localization of buyer delay notices with locale enforcement."""
    resp = client.post(
        "/api/orders/2/localize-message",
        json={"order_id": 2, "buyer_locale": "de"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["order_id"] == 2
    assert data["buyer_locale"] == "de"
    assert "buyer_message" in data
    assert len(data["buyer_message"]) > 10


def test_evidence_bundle_generation_and_canonical_hash():
    """Verify cryptographic evidence bundle includes canonical SHA-256 and HMAC verification."""
    resp = client.get("/api/orders/3/evidence")
    assert resp.status_code == 200
    bundle = resp.json()

    assert "evidence_bundle_sha256" in bundle
    assert len(bundle["evidence_bundle_sha256"]) == 64
    assert "cryptographic_verification" in bundle
    assert bundle["cryptographic_verification"]["chain_valid"] is True
    assert "total_consent_events" in bundle["cryptographic_verification"]
    assert bundle["order"]["id"] == 3
    assert bundle["order"]["paypal_order_id"] is not None


def test_evidence_bundle_json_download():
    """Verify evidence bundle can be downloaded as a verified JSON attachment for PayPal dispute representment."""
    resp = client.get("/api/orders/3/evidence/download")
    assert resp.status_code == 200
    assert "attachment" in resp.headers.get("Content-Disposition", "")
    assert "authhorizon-evidence-order-3.json" in resp.headers.get("Content-Disposition", "")

    parsed_json = json.loads(resp.text)
    assert "evidence_bundle_sha256" in parsed_json
    assert parsed_json["order"]["id"] == 3


def test_evidence_verify_endpoint_cryptographic_sync():
    """Verify /api/orders/{id}/evidence/verify evaluates both local hash chain and PayPal gateway sync."""
    resp = client.post("/api/orders/3/evidence/verify")
    assert resp.status_code == 200
    data = resp.json()
    assert data["order_id"] == 3
    assert "chain_valid" in data
    assert data["chain_valid"] is True
    assert "paypal_synced" in data
    assert "paypal_auth_status" in data
