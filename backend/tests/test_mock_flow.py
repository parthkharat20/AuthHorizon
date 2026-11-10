"""
AuthHorizon Core Test Suite (Mock Gateway & Financial Safety Gate)
Verifies full split-capture lifecycle, reconciler discrepancy detection, and tamper-evident hash chaining.
"""

import pytest
from backend.gateway.mock_gateway import MockPayPalGateway
from backend.reconciler import PaymentReconciler
from backend.ai.validator import (
    sanitize_and_validate_extraction,
    match_item_in_order,
    evaluate_review_routing,
    FORBIDDEN_CURRENCY_PATTERNS
)
from backend.models import (
    AIExtractionResult,
    Confidence,
    compute_consent_hash
)

def test_full_mock_split_capture_lifecycle():
    """Verify $90 order -> $60 partial capture -> $30 final capture"""
    gateway = MockPayPalGateway()
    reconciler = PaymentReconciler(gateway)

    # 1. Create Order ($90.00 total)
    items = [
        {"name": "Bearings", "sku": "SKU-BEAR-01", "unit_amount": 30.0, "quantity": 1},
        {"name": "Pump", "sku": "SKU-PUMP-02", "unit_amount": 30.0, "quantity": 1},
        {"name": "Coating Kit", "sku": "SKU-COAT-03", "unit_amount": 30.0, "quantity": 1}
    ]
    order = gateway.create_order(items=items, total_amount=90.0, request_id="REQ-001")
    assert order["status"] == "CREATED"
    assert len(order["links"]) > 0

    # 2. Authorize
    auth = gateway.authorize_order(order["id"], request_id="REQ-002")
    auth_id = auth["id"]
    assert auth["remaining_amount"] == 90.0
    assert auth["captured_amount"] == 0.0

    # 3. Partial Capture ($60.00 for in-stock items)
    cap1 = gateway.capture_authorization(
        auth_id=auth_id,
        amount=60.0,
        final_capture=False,
        request_id="REQ-003",
        note="Shipped items 1 and 2"
    )
    assert cap1["status"] == "COMPLETED"
    assert cap1["amount"]["value"] == "60.00"

    # Reconciler checks live auth state
    ok, msg, live_auth = reconciler.reconcile_authorization(auth_id, "PARTIALLY_CAPTURED", 30.0)
    assert ok is True
    assert live_auth["remaining_amount"] == 30.0
    assert live_auth["captured_amount"] == 60.0

    # 4. Final Capture ($30.00 for delayed item upon fulfillment)
    cap2 = gateway.capture_authorization(
        auth_id=auth_id,
        amount=30.0,
        final_capture=True,
        request_id="REQ-004",
        note="Shipped delayed item"
    )
    assert cap2["status"] == "COMPLETED"
    assert cap2["final_capture"] is True

    ok, msg, live_auth = reconciler.reconcile_authorization(auth_id, "CAPTURED", 0.0)
    assert ok is True
    assert live_auth["remaining_amount"] == 0.0
    assert live_auth["captured_amount"] == 90.0


def test_cancel_void_lifecycle():
    """Verify $90 order -> $60 partial capture -> VOID remainder of parent auth"""
    gateway = MockPayPalGateway()
    reconciler = PaymentReconciler(gateway)

    order = gateway.create_order(items=[], total_amount=90.0, request_id="REQ-101")
    auth = gateway.authorize_order(order["id"], request_id="REQ-102")
    auth_id = auth["id"]

    # Partial capture $60
    gateway.capture_authorization(auth_id=auth_id, amount=60.0, final_capture=False, request_id="REQ-103")
    
    # Buyer selects CANCEL -> Void parent authorization
    void_res = gateway.void_authorization(auth_id)
    assert void_res["status"] == "VOIDED"

    ok, msg, live_auth = reconciler.reconcile_authorization(auth_id, "VOIDED", 0.0)
    assert ok is True
    assert live_auth["remaining_amount"] == 0.0
    assert live_auth["captured_amount"] == 60.0


def test_reconciler_catches_ghost_capture():
    """Verify that reconciler flags discrepancy if capture response returns 200 but balance didn't move"""
    gateway = MockPayPalGateway()
    gateway.simulate_ghost_capture = True
    reconciler = PaymentReconciler(gateway)

    order = gateway.create_order(items=[], total_amount=90.0, request_id="REQ-201")
    auth = gateway.authorize_order(order["id"], request_id="REQ-202")
    auth_id = auth["id"]

    # Capture call returns 200 payload
    gateway.capture_authorization(auth_id=auth_id, amount=60.0, final_capture=False, request_id="REQ-203")

    # Reconciler checks live state and fails because remaining is still 90.0 instead of 30.0
    ok, msg, live_auth = reconciler.reconcile_authorization(auth_id, "PARTIALLY_CAPTURED", 30.0)
    assert ok is False
    assert "Status mismatch" in msg


def test_financial_safety_gate_rejects_currency_symbols():
    """AI output must strictly reject any prices or currency symbols"""
    dirty_extractions = [
        {"item_identifier": "Coating $30", "new_ship_date": "2026-11-20", "reason": "Late", "language": "en", "confidence_item": "HIGH", "confidence_date": "HIGH", "confidence_reason": "HIGH"},
        {"item_identifier": "Coating", "new_ship_date": "2026-11-20", "reason": "Price is 30.00 USD", "language": "en", "confidence_item": "HIGH", "confidence_date": "HIGH", "confidence_reason": "HIGH"},
        {"item_identifier": "Coating", "new_ship_date": "2026-11-20", "reason": "Refund 25€ to user", "language": "en", "confidence_item": "HIGH", "confidence_date": "HIGH", "confidence_reason": "HIGH"},
    ]

    for item in dirty_extractions:
        with pytest.raises(ValueError) as exc:
            sanitize_and_validate_extraction(item)
        assert "Financial Safety Gate Violation" in str(exc.value) or "must not contain" in str(exc.value)


def test_item_fuzzy_matching_and_review_routing():
    """Items must match order line items; non-HIGH confidence routes to review queue"""
    order_items = [
        {"sku": "SKU-COAT-03", "name": "Ceramic Coating Kit Industrial", "unit_amount": 30.0}
    ]

    # Exact SKU match
    matched, score = match_item_in_order("SKU-COAT-03", order_items)
    assert matched is not None
    assert matched["sku"] == "SKU-COAT-03"

    # Name fuzzy match
    matched, score = match_item_in_order("Ceramic Coating", order_items)
    assert matched is not None
    assert matched["sku"] == "SKU-COAT-03"

    # High confidence -> Auto approve
    clean_ext = AIExtractionResult(
        item_identifier="Ceramic Coating",
        new_ship_date="2026-11-20",
        reason="Supply chain delay",
        language="en",
        confidence_item=Confidence.HIGH,
        confidence_date=Confidence.HIGH,
        confidence_reason=Confidence.HIGH
    )
    needs_review, msg = evaluate_review_routing(clean_ext, matched)
    assert needs_review is False

    # Low confidence -> Flag for review
    low_conf_ext = AIExtractionResult(
        item_identifier="Ceramic Coating",
        new_ship_date="Unknown",
        reason="Delay",
        language="en",
        confidence_item=Confidence.HIGH,
        confidence_date=Confidence.LOW,
        confidence_reason=Confidence.HIGH
    )
    needs_review, msg = evaluate_review_routing(low_conf_ext, matched)
    assert needs_review is True
    assert "Low or Medium" in msg


def test_tamper_evident_consent_hash():
    """Verify SHA-256 consent hash calculation"""
    text = "We will hold $30.00 until Nov 20, 2026."
    choice = "WAIT"
    ts = "2026-11-10T12:00:00Z"

    h1 = compute_consent_hash(text, choice, ts)
    h2 = compute_consent_hash(text, choice, ts)
    assert h1 == h2
    assert len(h1) == 64

    # Tampering with 1 character changes the hash
    h3 = compute_consent_hash(text + " ", choice, ts)
    assert h1 != h3

