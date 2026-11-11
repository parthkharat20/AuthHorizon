"""
AuthHorizon Multi-Supplier Authorization Router
Logical routing layer for split-capture across multiple supplier fulfillment nodes.

IMPORTANT: PayPal authorization remains SINGLE. This router tracks the internal
supplier-to-item mapping and adjusts capture plans accordingly.
All financial calculations are deterministic Python.
"""

from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from backend.models import OrderModel, LineItemModel, LineItemStatus, CaptureAuditModel
from backend.risk.models import SupplierNodeModel, SupplierSKUMapping, RiskAssessmentModel
from datetime import datetime, timezone
import uuid


class CaptureNode:
    """Represents one logical capture segment in the routing plan."""
    def __init__(self, supplier_code: str, supplier_name: str, items: List[Dict], total: float, region: str = "US"):
        self.supplier_code = supplier_code
        self.supplier_name = supplier_name
        self.region = region
        self.items = items  # [{"sku": ..., "name": ..., "amount": ..., "line_item_id": ...}]
        self.total = round(total, 2)
        self.captured = False
        self.capture_id: Optional[str] = None


def build_routing_plan(order_id: int, db: Session) -> Dict:
    """
    Build a capture routing plan for an order, grouping items by their
    primary supplier node. Returns a structured plan showing which
    supplier handles which items and what amount to capture per node.
    
    ALL amounts are deterministic — summed from line_item.amount values.
    """
    order = db.query(OrderModel).filter(OrderModel.id == order_id).first()
    if not order:
        return {"error": "Order not found"}
    
    nodes: Dict[str, CaptureNode] = {}
    unrouted_items = []
    
    for item in order.line_items:
        # Skip already shipped/cancelled items
        if item.status in (LineItemStatus.SHIPPED, LineItemStatus.CANCELLED):
            continue
        
        # Find primary supplier
        mapping = db.query(SupplierSKUMapping).filter(
            SupplierSKUMapping.sku == item.sku,
            SupplierSKUMapping.is_primary == True
        ).first()
        
        if mapping and mapping.supplier_node:
            supplier = mapping.supplier_node
            code = supplier.supplier_code
            
            if code not in nodes:
                nodes[code] = CaptureNode(
                    supplier_code=code,
                    supplier_name=supplier.name,
                    items=[],
                    total=0.0,
                    region=supplier.region or "US"
                )
            
            nodes[code].items.append({
                "sku": item.sku,
                "name": item.name,
                "amount": item.amount,
                "line_item_id": item.id,
                "status": item.status.value
            })
            nodes[code].total = round(nodes[code].total + item.amount, 2)
        else:
            unrouted_items.append({
                "sku": item.sku,
                "name": item.name,
                "amount": item.amount,
                "line_item_id": item.id,
                "reason": "No primary supplier mapping found"
            })
    
    # Check for already-captured amounts
    existing_captures = db.query(CaptureAuditModel).filter(
        CaptureAuditModel.order_id == order_id
    ).all()
    total_already_captured = round(sum(c.amount for c in existing_captures), 2)
    
    plan = {
        "order_id": order_id,
        "paypal_order_id": order.paypal_order_id,
        "auth_id": order.auth_id,
        "total_amount": order.total_amount,
        "already_captured": total_already_captured,
        "remaining_capturable": round(order.total_amount - total_already_captured, 2),
        "routing_nodes": [
            {
                "supplier_code": node.supplier_code,
                "supplier_name": node.supplier_name,
                "region": getattr(node, "region", "US"),
                "items": node.items,
                "items_list": ", ".join(i.get("sku", "") for i in node.items),
                "segment_total": node.total,
                "item_count": len(node.items)
            }
            for node in nodes.values()
        ],
        "unrouted_items": unrouted_items,
        "node_count": len(nodes),
        "generated_at": datetime.now(timezone.utc).isoformat()
    }
    
    return plan


def reroute_item_to_supplier(
    order_id: int,
    sku: str,
    new_supplier_code: str,
    db: Session
) -> Dict:
    """
    Logically reroute a line item from its current primary supplier to a new one.
    Updates the SupplierSKUMapping to change the primary supplier.
    Does NOT touch PayPal — this is an internal routing decision.
    
    Returns the updated routing plan.
    """
    order = db.query(OrderModel).filter(OrderModel.id == order_id).first()
    if not order:
        return {"error": "Order not found"}
    
    # Find the item
    item = None
    for li in order.line_items:
        if li.sku == sku:
            item = li
            break
    if not item:
        return {"error": f"SKU {sku} not found in order {order_id}"}
    
    # Find the new supplier
    new_supplier = db.query(SupplierNodeModel).filter(
        SupplierNodeModel.supplier_code == new_supplier_code
    ).first()
    if not new_supplier:
        return {"error": f"Supplier {new_supplier_code} not found"}
    
    # Update mappings: demote current primary, promote new
    current_primary = db.query(SupplierSKUMapping).filter(
        SupplierSKUMapping.sku == sku,
        SupplierSKUMapping.is_primary == True
    ).first()
    if current_primary:
        current_primary.is_primary = False
    
    # Check if new supplier already has a mapping for this SKU
    existing_mapping = db.query(SupplierSKUMapping).filter(
        SupplierSKUMapping.sku == sku,
        SupplierSKUMapping.supplier_id == new_supplier.id
    ).first()
    
    if existing_mapping:
        existing_mapping.is_primary = True
    else:
        db.add(SupplierSKUMapping(
            supplier_id=new_supplier.id,
            sku=sku,
            is_primary=True
        ))
    
    db.commit()
    
    # Return updated plan
    return {
        "rerouted": True,
        "sku": sku,
        "from_supplier": current_primary.supplier_node.supplier_code if current_primary and current_primary.supplier_node else "NONE",
        "to_supplier": new_supplier_code,
        "to_supplier_name": new_supplier.name,
        "updated_plan": build_routing_plan(order_id, db)
    }

