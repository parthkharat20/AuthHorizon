"""
AuthHorizon Task T8 Test Suite: Cloud Deployment, Auto-Seeding & Environment Switcher
Verifies that:
  1. seed_demo_data() populates 3 demonstration orders covering the entire lifecycle.
  2. Auto-seeding is idempotent (no duplicate orders created on re-run).
  3. PAYPAL_MODE environment switcher correctly controls gateway selection.
  4. /api/health endpoint reports paypal_mode, gateway, and live LLM model metadata.
"""

import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models import Base, OrderModel, OrderStatus
from backend.database import seed_demo_data
from backend.main import app, get_gateway
from backend.gateway.mock_gateway import MockPayPalGateway
from backend.gateway.paypal_gateway import PayPalGateway


@pytest.fixture
def isolated_db_session():
    """Provides a fresh in-memory SQLite database session for seeding tests."""
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def test_seed_demo_data_populates_three_orders(isolated_db_session):
    """Verify that seed_demo_data creates 3 orders in AUTHORIZED, PARTIALLY_CAPTURED, and COMPLETED states."""
    seed_demo_data(isolated_db_session)

    orders = isolated_db_session.query(OrderModel).order_by(OrderModel.id.asc()).all()
    assert len(orders) == 3

    # Order 1: Fresh Authorization
    ord1 = orders[0]
    assert ord1.status == OrderStatus.AUTHORIZED
    assert ord1.total_amount == 90.00
    assert ord1.held_amount == 90.00
    assert ord1.captured_amount == 0.00
    assert len(ord1.line_items) == 3

    # Order 2: Partially Captured
    ord2 = orders[1]
    assert ord2.status == OrderStatus.PARTIALLY_CAPTURED
    assert ord2.total_amount == 90.00
    assert ord2.captured_amount == 60.00
    assert ord2.held_amount == 30.00
    assert len(ord2.capture_audits) == 1
    assert len(ord2.delay_notices) == 1

    # Order 3: Completed with SWAP
    ord3 = orders[2]
    assert ord3.status == OrderStatus.COMPLETED
    assert ord3.total_amount == 90.00
    assert ord3.captured_amount == 88.00
    assert ord3.held_amount == 0.00
    assert len(ord3.consent_records) == 1
    assert ord3.consent_records[0].choice.value == "SWAP"
    assert len(ord3.capture_audits) == 2


def test_seed_demo_data_is_idempotent(isolated_db_session):
    """Calling seed_demo_data multiple times does not create duplicates."""
    seed_demo_data(isolated_db_session)
    first_count = isolated_db_session.query(OrderModel).count()
    assert first_count == 3

    # Second invocation should detect existing orders and cleanly no-op
    seed_demo_data(isolated_db_session)
    second_count = isolated_db_session.query(OrderModel).count()
    assert second_count == 3


def test_health_endpoint_reports_paypal_mode():
    """Verify /api/health returns paypal_mode, gateway, and live LLM model attribution."""
    client = TestClient(app)
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()

    assert data["status"] == "healthy"
    assert "paypal_mode" in data
    assert "gateway" in data
    assert "llm_model" in data
    assert "groq_model" in data
    assert "active_llm_provider" in data


def test_paypal_mode_switcher_selection(monkeypatch):
    """Verify get_gateway returns MockPayPalGateway when PAYPAL_MODE=mock."""
    monkeypatch.setenv("PAYPAL_MODE", "mock")
    gw = get_gateway()
    assert isinstance(gw, MockPayPalGateway)


def test_auth_expiry_intelligence_29_days():
    """Verify authorization sets 29-day expiration window and reports days_remaining."""
    mock_gw = MockPayPalGateway()
    app.dependency_overrides[get_gateway] = lambda: mock_gw
    try:
        client = TestClient(app)
        c_res = client.post("/api/orders/create", json={
            "items": [{"sku": "SKU-EXP-01", "name": "Sensor Unit", "amount": 90.0, "quantity": 1}],
            "currency": "USD"
        })
        assert c_res.status_code == 200
        order_id = c_res.json()["order_id"]

        auth_res = client.post(f"/api/orders/{order_id}/authorize")
        assert auth_res.status_code == 200
        auth_data = auth_res.json()
        assert "auth_expires_at" in auth_data
        assert auth_data["days_remaining"] == 29

        # Verify get_order_details returns auth_days_remaining
        det_res = client.get(f"/api/orders/{order_id}")
        assert det_res.status_code == 200
        det_data = det_res.json()
        assert det_data["auth_days_remaining"] == 29
        assert "auth_expires_at" in det_data
    finally:
        app.dependency_overrides.pop(get_gateway, None)


def test_expiring_soon_endpoint():
    """Verify /api/orders/expiring-soon lists active authorizations near expiration."""
    mock_gw = MockPayPalGateway()
    app.dependency_overrides[get_gateway] = lambda: mock_gw
    try:
        client = TestClient(app)
        res = client.get("/api/orders/expiring-soon")
        assert res.status_code == 200
        assert isinstance(res.json(), list)
    finally:
        app.dependency_overrides.pop(get_gateway, None)

