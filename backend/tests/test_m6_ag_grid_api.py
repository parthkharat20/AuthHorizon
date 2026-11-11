"""
Test Suite M6: AG Grid Command Center API Contract Verification
Verifies that all API endpoints supporting the 6 AG Grid Community v33 instances
return fully enriched, deterministic, typed data models.
"""

import pytest
from fastapi.testclient import TestClient
from backend.main import app, get_gateway
from backend.gateway.mock_gateway import MockPayPalGateway
from backend.database import get_db, seed_demo_data

# Ensure mock gateway override for test suite isolation
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


def test_risk_assessment_get_endpoint_enriched():
    """Verify GET /api/orders/{id}/risk-assessment returns enriched fields for RiskAssessmentsGrid."""
    # Order #1 has pre-seeded risk assessments
    response = client.get("/api/orders/1/risk-assessment")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1

    first = data[0]
    # Check all fields required by RiskAssessmentsGrid.tsx
    assert "sku" in first
    assert "item_name" in first
    assert "supplier" in first
    assert "supplier_code" in first
    assert "supplier_region" in first
    assert "fulfillment_reliability" in first
    assert "geographic_risk" in first
    assert "disruption_probability" in first
    assert "risk_tier" in first
    assert "estimated_delay_days" in first
    assert "recommendation" in first

    # Numerical validity
    assert 0.0 <= first["disruption_probability"] <= 1.0
    assert first["risk_tier"] in ("LOW", "MEDIUM", "HIGH", "CRITICAL")
    assert isinstance(first["estimated_delay_days"], int)


def test_routing_plan_endpoint_enriched():
    """Verify GET /api/orders/{id}/routing-plan returns enriched node metadata for RoutingPlanGrid."""
    response = client.get("/api/orders/1/routing-plan")
    assert response.status_code == 200
    plan = response.json()

    assert "order_id" in plan
    assert plan["order_id"] == 1
    assert "routing_nodes" in plan
    nodes = plan["routing_nodes"]
    assert len(nodes) >= 1

    for node in nodes:
        assert "supplier_code" in node
        assert "supplier_name" in node
        assert "region" in node
        assert "segment_total" in node
        assert "item_count" in node
        assert "items_list" in node
        assert isinstance(node["segment_total"], (int, float))
        assert node["segment_total"] > 0
        assert node["item_count"] >= 1


def test_routing_plan_hold_partitioning_deterministic():
    """Verify that logical capture node totals partition the authorized hold without leakage."""
    response = client.get("/api/orders/1/routing-plan")
    assert response.status_code == 200
    plan = response.json()

    node_sum = round(sum(n["segment_total"] for n in plan["routing_nodes"]), 2)
    # Order #1 total is $90.00
    assert node_sum == plan["total_amount"]
    assert node_sum == 90.00


def test_supplier_dashboard_telemetry_complete():
    """Verify GET /api/risk/suppliers returns complete telemetry for SupplierRiskGrid."""
    response = client.get("/api/risk/suppliers")
    assert response.status_code == 200
    suppliers = response.json()
    assert len(suppliers) >= 3

    codes = [s["supplier_code"] for s in suppliers]
    assert "SUP-US-PRIME" in codes
    assert "SUP-EU-LOGISTICS" in codes
    assert "SUP-ASIA-SHENZHEN" in codes

    for s in suppliers:
        assert "on_time_rate" in s
        assert "composite_disruption_probability" in s
        assert "port_congestion" in s
        assert "risk_tier" in s
        assert "sku_count" in s
        assert 0.0 <= s["on_time_rate"] <= 1.0
        assert 0.0 <= s["composite_disruption_probability"] <= 1.0
        assert 0.0 <= s["port_congestion"] <= 1.0
