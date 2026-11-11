"""
Module 2 Tests: Multi-Supplier Authorization Router
Tests logical routing plan generation and supplier rerouting.
"""

import pytest
from backend.gateway.router import build_routing_plan, CaptureNode
from backend.main import app, get_gateway
from backend.gateway.mock_gateway import MockPayPalGateway

# Ensure mock gateway override persists for API tests
app.dependency_overrides[get_gateway] = lambda: MockPayPalGateway()


def test_routing_plan_endpoint(setup_test_db):
    """Test the routing plan API endpoint."""
    from fastapi.testclient import TestClient
    
    client = TestClient(app)
    # Create and authorize an order
    create_res = client.post("/api/orders/create", json={
        "items": [
            {"sku": "SKU-BEAR-01", "name": "Bearings", "amount": 30.0, "quantity": 1},
            {"sku": "SKU-PUMP-02", "name": "Pump", "amount": 30.0, "quantity": 1},
        ],
        "currency": "USD"
    })
    order_id = create_res.json()["order_id"]
    client.post(f"/api/orders/{order_id}/authorize")
    
    # Get routing plan
    plan_res = client.get(f"/api/orders/{order_id}/routing-plan")
    assert plan_res.status_code == 200
    data = plan_res.json()
    assert data["order_id"] == order_id
    assert data["total_amount"] == 60.0
    assert "routing_nodes" in data


def test_capture_node_initialization():
    """Test CaptureNode data structure."""
    node = CaptureNode(
        supplier_code="SUP-001",
        supplier_name="Test Supplier",
        items=[{"sku": "SKU-1", "name": "Test", "amount": 30.0}],
        total=30.0
    )
    assert node.supplier_code == "SUP-001"
    assert node.total == 30.0
    assert node.captured == False
    assert node.capture_id is None


def test_reroute_endpoint(setup_test_db):
    """Test the reroute API endpoint."""
    from fastapi.testclient import TestClient
    from backend.database import SessionLocal
    from backend.risk.models import SupplierNodeModel, SupplierSKUMapping
    
    # Seed a backup supplier
    with SessionLocal() as db:
        backup = db.query(SupplierNodeModel).filter(
            SupplierNodeModel.supplier_code == "SUP-BACKUP-TEST"
        ).first()
        if not backup:
            backup = SupplierNodeModel(
                supplier_code="SUP-BACKUP-TEST",
                name="Backup Test Supplier",
                region="EU",
                total_orders_fulfilled=200,
                on_time_deliveries=195,
                late_deliveries=5,
                avg_delay_days=1.0,
                port_congestion_factor=0.05,
                weather_risk_factor=0.02,
                geopolitical_risk_factor=0.01
            )
            db.add(backup)
            db.flush()
        
        # Ensure mapping exists
        mapping = db.query(SupplierSKUMapping).filter(
            SupplierSKUMapping.supplier_id == backup.id,
            SupplierSKUMapping.sku == "SKU-BEAR-01"
        ).first()
        if not mapping:
            db.add(SupplierSKUMapping(
                supplier_id=backup.id,
                sku="SKU-BEAR-01",
                is_primary=False
            ))
        db.commit()
    
    client = TestClient(app)
    create_res = client.post("/api/orders/create", json={
        "items": [
            {"sku": "SKU-BEAR-01", "name": "Bearings", "amount": 30.0, "quantity": 1},
        ],
        "currency": "USD"
    })
    order_id = create_res.json()["order_id"]
    client.post(f"/api/orders/{order_id}/authorize")
    
    # Reroute
    reroute_res = client.post(
        f"/api/orders/{order_id}/reroute",
        params={"sku": "SKU-BEAR-01", "new_supplier_code": "SUP-BACKUP-TEST"}
    )
    assert reroute_res.status_code == 200
    assert reroute_res.json()["rerouted"] == True

