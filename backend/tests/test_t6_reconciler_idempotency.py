"""
AuthHorizon T6 Test Suite — Reconciler & Idempotency Visibility
Verifies:
  1. Duplicate capture with identical PayPal-Request-Id returns cached capture object without duplicate balance deduction.
  2. Local database ledger detects replay and refuses to create duplicate financial movement records.
  3. GET /api/orders/{id}/gateway-logs returns recorded gateway events (CREATE_ORDER, AUTHORIZE, PARTIAL_CAPTURE) with request IDs.
  4. POST /api/orders/{id}/test-idempotency performs live idempotency replay check and logs IDEMPOTENCY_REPLAY event.
  5. PaymentReconciler catches simulated balance mismatch, ghost captures, and status divergences.
"""

import uuid
import pytest
from fastapi.testclient import TestClient

from backend.main import app, get_gateway
from backend.gateway.mock_gateway import MockPayPalGateway
from backend.reconciler import PaymentReconciler
from backend.database import SessionLocal
from backend.models import OrderModel, CaptureAuditModel, GatewayEventLogModel

# Persistent mock gateway instance for sandboxed test execution
_mock_gw = MockPayPalGateway()
app.dependency_overrides[get_gateway] = lambda: _mock_gw


def test_mock_gateway_idempotency_cache_replay():
    """
    Test 1: Re-submitting capture_authorization with identical request_id returns
    the cached capture object without deducting remaining hold a second time.
    """
    gw = MockPayPalGateway()
    items = [
        {"name": "Bearings", "sku": "SKU-BEAR-01", "unit_amount": 30.0, "quantity": 1},
        {"name": "Pump", "sku": "SKU-PUMP-02", "unit_amount": 30.0, "quantity": 1},
        {"name": "Coating Kit", "sku": "SKU-COAT-03", "unit_amount": 30.0, "quantity": 1}
    ]
    order = gw.create_order(items=items, total_amount=90.0, request_id="test-req-ord-1")
    auth = gw.authorize_order(order["id"], "test-req-auth-1")
    auth_id = auth["id"]
    initial_remaining = auth["remaining_amount"]
    assert initial_remaining == 90.0

    # First capture of $60.00
    req_id = f"test-req-cap-{uuid.uuid4().hex[:8]}"
    cap1 = gw.capture_authorization(
        auth_id=auth_id,
        amount=60.0,
        final_capture=False,
        request_id=req_id,
        note="First capture"
    )
    assert cap1["amount"]["value"] == "60.00"
    assert auth["remaining_amount"] == 30.0
    assert auth["captured_amount"] == 60.0

    # Second duplicate capture with identical request_id (double-click simulation)
    cap2 = gw.capture_authorization(
        auth_id=auth_id,
        amount=60.0,
        final_capture=False,
        request_id=req_id,
        note="Duplicate click replay"
    )

    # Must return exact same capture ID and must NOT deduct hold balance again
    assert cap2["id"] == cap1["id"]
    assert auth["remaining_amount"] == 30.0
    assert auth["captured_amount"] == 60.0


def test_reconciler_catches_ghost_capture_and_mismatch():
    """
    Test 2: PaymentReconciler catches ghost capture where gateway returns 200/COMPLETED
    but internal authorization remaining balance did not decrement.
    """
    gw = MockPayPalGateway()
    gw.simulate_ghost_capture = True  # Enable ghost capture simulation

    items = [
        {"name": "Bearings", "sku": "SKU-BEAR-01", "unit_amount": 30.0, "quantity": 1},
        {"name": "Pump", "sku": "SKU-PUMP-02", "unit_amount": 30.0, "quantity": 1},
        {"name": "Coating Kit", "sku": "SKU-COAT-03", "unit_amount": 30.0, "quantity": 1}
    ]
    order = gw.create_order(items=items, total_amount=90.0, request_id="ghost-ord-req")
    auth = gw.authorize_order(order["id"], "ghost-auth-req")
    auth_id = auth["id"]

    cap = gw.capture_authorization(
        auth_id=auth_id,
        amount=60.0,
        final_capture=False,
        request_id="ghost-cap-req"
    )

    reconciler = PaymentReconciler(gw)
    # Authorization status should have been PARTIALLY_CAPTURED with remaining 30.0,
    # but ghost capture left status as CREATED and remaining as 90.0
    ok, msg, _ = reconciler.reconcile_authorization(
        auth_id=auth_id,
        expected_status="PARTIALLY_CAPTURED",
        expected_remaining=30.0
    )

    assert ok is False
    assert "Status mismatch" in msg

    # Reconcile capture amount mismatch
    ok_cap, cap_msg, _ = reconciler.reconcile_capture(
        capture_id=cap["id"],
        expected_amount=999.00  # Intentionally wrong expected amount
    )
    assert ok_cap is False
    assert "Captured amount mismatch" in cap_msg


def test_api_gateway_logs_recorded_and_retrieved():
    """
    Test 3: Verify that full lifecycle writes audit events to GatewayEventLogModel
    and GET /api/orders/{id}/gateway-logs returns them.
    """
    client = TestClient(app)

    # 1. Create order
    create_resp = client.post("/api/orders/create", json={
        "items": [
            {"sku": "SKU-T6-A", "name": "Test Item A", "amount": 60.0, "quantity": 1},
            {"sku": "SKU-T6-B", "name": "Test Item B", "amount": 30.0, "quantity": 1}
        ],
        "currency": "USD"
    })
    assert create_resp.status_code == 200
    order_id = create_resp.json()["order_id"]

    # 2. Authorize
    auth_resp = client.post(f"/api/orders/{order_id}/authorize")
    assert auth_resp.status_code == 200

    # 3. Ship Partial
    ship_resp = client.post(f"/api/orders/{order_id}/ship-partial")
    assert ship_resp.status_code == 200

    # 4. Fetch gateway logs
    logs_resp = client.get(f"/api/orders/{order_id}/gateway-logs")
    assert logs_resp.status_code == 200
    logs = logs_resp.json()

    assert len(logs) >= 3
    actions = [l["action"] for l in logs]
    assert "CREATE_ORDER" in actions
    assert "AUTHORIZE" in actions
    assert "PARTIAL_CAPTURE" in actions

    for log in logs:
        assert log["request_id"] is not None
        assert len(log["request_id"]) > 0
        assert log["status_code"] in (200, 201)
        assert log["reconciler_status"] == "VERIFIED"


def test_api_test_idempotency_replay_endpoint():
    """
    Test 4: POST /api/orders/{order_id}/test-idempotency triggers an idempotency replay,
    verifying capture IDs match, zero duplicate financial movements are made, and
    an IDEMPOTENCY_REPLAY gateway log entry is added.
    """
    client = TestClient(app)

    # Create & Authorize & Partial Ship
    create_resp = client.post("/api/orders/create", json={
        "items": [
            {"sku": "SKU-IDEMP-1", "name": "Idempotent Component 1", "amount": 60.0, "quantity": 1},
            {"sku": "SKU-IDEMP-2", "name": "Idempotent Component 2", "amount": 30.0, "quantity": 1}
        ],
        "currency": "USD"
    })
    order_id = create_resp.json()["order_id"]
    client.post(f"/api/orders/{order_id}/authorize")
    client.post(f"/api/orders/{order_id}/ship-partial")

    # Order details before replay
    order_before = client.get(f"/api/orders/{order_id}").json()
    assert len(order_before["audits"]) == 1
    original_capture_id = order_before["audits"][0]["paypal_capture_id"]
    captured_before = order_before["captured_amount"]

    # Call test-idempotency
    idemp_resp = client.post(f"/api/orders/{order_id}/test-idempotency")
    assert idemp_resp.status_code == 200
    idemp_data = idemp_resp.json()

    assert idemp_data["idempotent_replay"] is True
    assert idemp_data["capture_ids_match"] is True
    assert idemp_data["original_capture_id"] == original_capture_id
    assert idemp_data["replayed_capture_id"] == original_capture_id
    assert idemp_data["duplicate_prevented"] is True
    assert idemp_data["total_ledger_movements"] == 1
    assert idemp_data["status"] == "VERIFIED_IDEMPOTENT"

    # Verify order state remains unchanged (no extra balance captured)
    order_after = client.get(f"/api/orders/{order_id}").json()
    assert order_after["captured_amount"] == captured_before
    assert len(order_after["audits"]) == 1

    # Verify IDEMPOTENCY_REPLAY is recorded in gateway logs
    logs_resp = client.get(f"/api/orders/{order_id}/gateway-logs")
    log_actions = [l["action"] for l in logs_resp.json()]
    assert "IDEMPOTENCY_REPLAY" in log_actions


def test_idempotency_endpoint_rejects_order_with_no_captures():
    """
    Test 5: POST /api/orders/{order_id}/test-idempotency on an order with no captures
    returns 400 Bad Request.
    """
    client = TestClient(app)
    create_resp = client.post("/api/orders/create", json={
        "items": [
            {"sku": "SKU-NOCAP", "name": "No Capture Item", "amount": 50.0, "quantity": 1}
        ],
        "currency": "USD"
    })
    order_id = create_resp.json()["order_id"]
    client.post(f"/api/orders/{order_id}/authorize")

    idemp_resp = client.post(f"/api/orders/{order_id}/test-idempotency")
    assert idemp_resp.status_code == 400
    assert "no executed captures" in idemp_resp.json()["detail"]
