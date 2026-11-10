"""
AuthHorizon FastAPI Route Integration Tests
Verifies the complete HTTP flow against the mock gateway.
"""

import pytest
from fastapi.testclient import TestClient
from backend.main import app, get_gateway
from backend.gateway.mock_gateway import MockPayPalGateway

# Override gateway dependency with clean mock for API tests
mock_gateway = MockPayPalGateway()
app.dependency_overrides[get_gateway] = lambda: mock_gateway

client = TestClient(app)

def test_api_full_lifecycle():
    # 1. Healthcheck
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"

    # 2. Fixtures
    res = client.get("/api/fixtures")
    assert res.status_code == 200
    assert "german" in res.json()

    # 3. Create Order
    create_payload = {
        "items": [
            {"sku": "SKU-BEAR-01", "name": "Bearings", "amount": 30.0, "quantity": 1},
            {"sku": "SKU-PUMP-02", "name": "Pump", "amount": 30.0, "quantity": 1},
            {"sku": "SKU-COAT-03", "name": "Coating Kit", "amount": 30.0, "quantity": 1}
        ],
        "currency": "USD"
    }
    res = client.post("/api/orders/create", json=create_payload)
    assert res.status_code == 200
    order_data = res.json()
    order_id = order_data["order_id"]
    assert order_data["total_amount"] == 90.0

    # 4. Authorize Order
    res = client.post(f"/api/orders/{order_id}/authorize")
    assert res.status_code == 200
    auth_data = res.json()
    assert auth_data["status"] == "AUTHORIZED"
    assert auth_data["held_amount"] == 90.0

    # 5. Ship Partial ($60 in-stock)
    res = client.post(f"/api/orders/{order_id}/ship-partial")
    assert res.status_code == 200
    ship_data = res.json()
    assert ship_data["status"] == "PARTIALLY_CAPTURED"
    assert ship_data["captured_amount"] == 60.0
    assert ship_data["held_amount"] == 30.0
    assert ship_data["reconciler_verified"] is True

    # 6. Parse Supplier Notice (German email for SKU-COAT-03)
    german_fixture = (
        "Sehr geehrte Damen und Herren,\n"
        "Lieferengpass bei Platine (SKU-COAT-03). Neuer Termin: 2026-11-20. Grund: Materialmangel."
    )
    res = client.post("/api/supplier/parse-notice", json={"order_id": order_id, "raw_text": german_fixture})
    assert res.status_code == 200
    notice_data = res.json()
    assert notice_data["matched_sku"] == "SKU-COAT-03"

    # 7. Submit Buyer Consent (Option: WAIT)
    res = client.post("/api/consent/submit", json={"order_id": order_id, "choice": "WAIT"})
    assert res.status_code == 200
    consent_data = res.json()
    assert consent_data["choice"] == "WAIT"
    assert len(consent_data["consent_hash"]) == 64

    # 8. Fulfill Delayed Item ($30)
    res = client.post(f"/api/orders/{order_id}/fulfill-delayed")
    assert res.status_code == 200
    fulfill_data = res.json()
    assert fulfill_data["status"] == "COMPLETED"
    assert fulfill_data["captured_amount"] == 90.0
    assert fulfill_data["held_amount"] == 0.0

    # 9. Verify Order Details
    res = client.get(f"/api/orders/{order_id}")
    assert res.status_code == 200
    details = res.json()
    assert len(details["items"]) == 3
    assert len(details["audits"]) == 2
    assert len(details["consents"]) == 1

