"""
Module 1 Tests: Predictive Supply Disruption Risk Engine
Tests that ALL risk scoring is deterministic and AI-free.
"""

import pytest
from backend.risk.engine import (
    compute_fulfillment_reliability,
    compute_geographic_risk,
    compute_composite_disruption_probability,
    classify_risk_tier,
    estimate_delay_days,
    generate_recommendation,
    TIER_LOW, TIER_MEDIUM, TIER_HIGH
)
from backend.risk.models import SupplierNodeModel
from backend.main import app, get_gateway
from backend.gateway.mock_gateway import MockPayPalGateway

# Ensure mock gateway override persists for API tests
app.dependency_overrides[get_gateway] = lambda: MockPayPalGateway()


def _make_supplier(**overrides):
    """Create a mock SupplierNodeModel for testing."""
    defaults = {
        "supplier_code": "SUP-TEST",
        "name": "Test Supplier",
        "region": "US",
        "total_orders_fulfilled": 100,
        "on_time_deliveries": 90,
        "late_deliveries": 10,
        "avg_delay_days": 3.0,
        "port_congestion_factor": 0.1,
        "weather_risk_factor": 0.05,
        "geopolitical_risk_factor": 0.05,
        "is_active": True,
    }
    defaults.update(overrides)
    return SupplierNodeModel(**defaults)


def test_fulfillment_reliability_perfect_supplier():
    """100% on-time → 0.0 disruption risk."""
    s = _make_supplier(total_orders_fulfilled=100, on_time_deliveries=100)
    assert compute_fulfillment_reliability(s) == 0.0


def test_fulfillment_reliability_poor_supplier():
    """50% on-time → 0.5 disruption risk."""
    s = _make_supplier(total_orders_fulfilled=100, on_time_deliveries=50)
    assert compute_fulfillment_reliability(s) == 0.5


def test_fulfillment_reliability_zero_division_safety():
    """Zero orders → no crash."""
    s = _make_supplier(total_orders_fulfilled=0, on_time_deliveries=0)
    result = compute_fulfillment_reliability(s)
    assert 0.0 <= result <= 1.0


def test_geographic_risk_low():
    """Low port/weather/geo factors → low geographic risk."""
    s = _make_supplier(port_congestion_factor=0.1, weather_risk_factor=0.05, geopolitical_risk_factor=0.05)
    result = compute_geographic_risk(s)
    assert 0.0 <= result <= 0.15


def test_geographic_risk_high():
    """High port congestion → elevated geographic risk."""
    s = _make_supplier(port_congestion_factor=0.9, weather_risk_factor=0.5, geopolitical_risk_factor=0.7)
    result = compute_geographic_risk(s)
    assert result > 0.5


def test_composite_score_bounded():
    """Composite score always between 0.0 and 1.0."""
    for fr in [0.0, 0.3, 0.5, 0.8, 1.0]:
        for gr in [0.0, 0.3, 0.5, 0.8, 1.0]:
            c = compute_composite_disruption_probability(fr, gr)
            assert 0.0 <= c <= 1.0, f"Out of bounds: fr={fr}, gr={gr}, composite={c}"


def test_risk_tier_classification():
    """Verify deterministic tier thresholds."""
    assert classify_risk_tier(0.0) == "LOW"
    assert classify_risk_tier(0.29) == "LOW"
    assert classify_risk_tier(0.30) == "MEDIUM"
    assert classify_risk_tier(0.49) == "MEDIUM"
    assert classify_risk_tier(0.50) == "HIGH"
    assert classify_risk_tier(0.69) == "HIGH"
    assert classify_risk_tier(0.70) == "CRITICAL"
    assert classify_risk_tier(1.0) == "CRITICAL"


def test_delay_estimation_low_risk():
    """Low risk → 0 estimated delay days."""
    s = _make_supplier(avg_delay_days=3.0)
    assert estimate_delay_days(s, 0.1) == 0


def test_delay_estimation_high_risk():
    """High risk → positive delay estimate."""
    s = _make_supplier(avg_delay_days=5.0)
    result = estimate_delay_days(s, 0.8)
    assert result > 0
    assert result <= 30


def test_recommendation_contains_supplier_name():
    """Recommendations mention the supplier by name."""
    s = _make_supplier(name="Acme Corp")
    rec = generate_recommendation("HIGH", s, "SKU-001", None, None)
    assert "Acme Corp" in rec


def test_recommendation_critical_with_alternative():
    """CRITICAL tier with alternative suggests reroute."""
    s = _make_supplier(name="Risky Supplier")
    alt = _make_supplier(supplier_code="SUP-BACKUP", name="Reliable Backup", region="EU")
    rec = generate_recommendation("CRITICAL", s, "SKU-001", alt, None)
    assert "Reliable Backup" in rec
    assert "reroute" in rec.lower() or "Reroute" in rec


def test_api_risk_assessment_endpoint(setup_test_db):
    """Test the /api/orders/{id}/risk-assessment endpoint."""
    from fastapi.testclient import TestClient
    
    client = TestClient(app)
    # Create and authorize an order
    create_res = client.post("/api/orders/create", json={
        "items": [
            {"sku": "SKU-BEAR-01", "name": "Bearings", "amount": 30.0, "quantity": 1},
        ],
        "currency": "USD"
    })
    order_id = create_res.json()["order_id"]
    client.post(f"/api/orders/{order_id}/authorize")
    
    # Run risk assessment
    risk_res = client.post(f"/api/orders/{order_id}/risk-assessment")
    assert risk_res.status_code == 200
    data = risk_res.json()
    assert "assessments" in data
    assert data["order_id"] == order_id
    
    # Verify get endpoint
    get_risk_res = client.get(f"/api/orders/{order_id}/risk-assessment")
    assert get_risk_res.status_code == 200
    assert isinstance(get_risk_res.json(), list)


def test_api_supplier_dashboard_endpoint(setup_test_db):
    """Test the /api/risk/suppliers endpoint."""
    from fastapi.testclient import TestClient
    
    client = TestClient(app)
    res = client.get("/api/risk/suppliers")
    assert res.status_code == 200
    assert isinstance(res.json(), list)
