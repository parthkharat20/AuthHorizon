"""
AuthHorizon Predictive Supply Disruption Risk Engine
ALL scoring is 100% deterministic Python. AI NEVER computes risk scores.
"""

from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from backend.risk.models import SupplierNodeModel, SupplierSKUMapping, RiskAssessmentModel
from backend.models import OrderModel, LineItemModel
from datetime import datetime, timezone


# ── Deterministic Scoring Weights ──────────────────────────────
# These are hardcoded constants, NOT learned or AI-derived.
WEIGHT_FULFILLMENT = 0.50   # Historical on-time delivery rate
WEIGHT_PORT_CONGESTION = 0.20
WEIGHT_WEATHER = 0.15
WEIGHT_GEOPOLITICAL = 0.15

# Risk tier thresholds
TIER_LOW = 0.30
TIER_MEDIUM = 0.50
TIER_HIGH = 0.70  # Above this → CRITICAL


def compute_fulfillment_reliability(supplier: SupplierNodeModel) -> float:
    """
    Compute reliability score from historical fulfillment data.
    Returns float 0.0 (perfectly reliable) to 1.0 (always late).
    Inverted: high on-time rate = LOW disruption probability.
    """
    total = max(supplier.total_orders_fulfilled, 1)  # prevent division by zero
    on_time_rate = supplier.on_time_deliveries / total
    return round(1.0 - on_time_rate, 4)  # Invert: 90% on-time → 0.10 disruption


def compute_geographic_risk(supplier: SupplierNodeModel) -> float:
    """
    Weighted sum of geographic risk factors.
    All factors are 0.0-1.0, pre-populated in supplier telemetry.
    """
    denom = WEIGHT_PORT_CONGESTION + WEIGHT_WEATHER + WEIGHT_GEOPOLITICAL
    geo_score = (
        supplier.port_congestion_factor * (WEIGHT_PORT_CONGESTION / denom) +
        supplier.weather_risk_factor * (WEIGHT_WEATHER / denom) +
        supplier.geopolitical_risk_factor * (WEIGHT_GEOPOLITICAL / denom)
    )
    return round(min(1.0, max(0.0, geo_score)), 4)


def compute_composite_disruption_probability(
    fulfillment_risk: float,
    geographic_risk: float
) -> float:
    """
    Final deterministic composite score combining all risk dimensions.
    Returns 0.0 (no risk) to 1.0 (certain disruption).
    """
    composite = (
        fulfillment_risk * WEIGHT_FULFILLMENT +
        geographic_risk * (1.0 - WEIGHT_FULFILLMENT)
    )
    return round(min(1.0, max(0.0, composite)), 4)


def classify_risk_tier(probability: float) -> str:
    """Deterministic threshold-based tier classification."""
    if probability < TIER_LOW:
        return "LOW"
    elif probability < TIER_MEDIUM:
        return "MEDIUM"
    elif probability < TIER_HIGH:
        return "HIGH"
    return "CRITICAL"


def estimate_delay_days(supplier: SupplierNodeModel, probability: float) -> int:
    """
    Estimate delay days based on supplier historical average and risk probability.
    Pure arithmetic — no AI involvement.
    """
    if probability < TIER_LOW:
        return 0
    base_delay = max(1, int(supplier.avg_delay_days))
    multiplier = 1.0 + (probability - TIER_LOW) * 2.0
    return min(30, int(round(base_delay * multiplier, 0)))


def generate_recommendation(
    risk_tier: str,
    supplier: SupplierNodeModel,
    sku: str,
    alternative: Optional[SupplierNodeModel],
    db: Optional[Session] = None
) -> str:
    """
    Generate deterministic mitigation recommendation based on risk tier.
    NOT AI-generated — pure rule-based template strings.
    """
    if risk_tier == "LOW":
        return f"No action required. {supplier.name} shows reliable fulfillment for {sku}."
    elif risk_tier == "MEDIUM":
        return f"Monitor {supplier.name} ({supplier.region}). Port congestion factor: {supplier.port_congestion_factor:.0%}. Consider pre-alerting buyer."
    elif risk_tier == "HIGH":
        if alternative:
            return (
                f"HIGH RISK: {supplier.name} shows {supplier.late_deliveries}/{supplier.total_orders_fulfilled} late deliveries. "
                f"Recommend pre-emptive reroute to backup supplier '{alternative.name}' ({alternative.region}) for {sku}."
            )
        return (
            f"HIGH RISK: {supplier.name} shows elevated disruption probability. "
            f"No backup supplier mapped for {sku}. Recommend proactive buyer consent collection."
        )
    else:  # CRITICAL
        if alternative:
            return (
                f"CRITICAL: {supplier.name} disruption probability exceeds {TIER_HIGH:.0%}. "
                f"Auto-reroute recommended to '{alternative.name}' ({alternative.region}). "
                f"Initiate pre-emptive split-capture of in-stock components before FTC 435 clock friction."
            )
        return (
            f"CRITICAL: {supplier.name} disruption near-certain. No backup available for {sku}. "
            f"Immediately initiate buyer delay-option notice and consent collection."
        )


def find_alternative_supplier(
    sku: str,
    current_supplier_id: int,
    db: Session
) -> Optional[SupplierNodeModel]:
    """Find the best backup supplier for a given SKU (lowest disruption probability)."""
    mappings = db.query(SupplierSKUMapping).filter(
        SupplierSKUMapping.sku == sku,
        SupplierSKUMapping.supplier_id != current_supplier_id
    ).all()
    
    best = None
    best_score = 1.0
    for m in mappings:
        supplier = m.supplier_node
        if not supplier or not supplier.is_active:
            continue
        fr = compute_fulfillment_reliability(supplier)
        gr = compute_geographic_risk(supplier)
        score = compute_composite_disruption_probability(fr, gr)
        if score < best_score:
            best_score = score
            best = supplier
    return best


def assess_order_risk(order_id: int, db: Session) -> List[Dict]:
    """
    Run full risk assessment on all line items of an order.
    Returns list of risk assessment dicts and persists to DB.
    """
    order = db.query(OrderModel).filter(OrderModel.id == order_id).first()
    if not order:
        return []
    
    results = []
    for item in order.line_items:
        # Find primary supplier for this SKU
        mapping = db.query(SupplierSKUMapping).filter(
            SupplierSKUMapping.sku == item.sku,
            SupplierSKUMapping.is_primary == True
        ).first()
        
        if not mapping or not mapping.supplier_node:
            # No supplier mapped — assign default unknown risk
            results.append({
                "sku": item.sku,
                "item_name": item.name,
                "supplier": "UNMAPPED",
                "supplier_code": "UNMAPPED",
                "supplier_region": "UNKNOWN",
                "fulfillment_reliability": 0.0,
                "geographic_risk": 0.0,
                "disruption_probability": 0.0,
                "risk_tier": "LOW",
                "estimated_delay_days": 0,
                "recommendation": f"No supplier mapped for {item.sku}. Unable to assess risk.",
                "alternative_supplier": None,
                "alternative_supplier_code": None
            })
            continue
        
        supplier = mapping.supplier_node
        
        # Compute deterministic risk scores
        fr = compute_fulfillment_reliability(supplier)
        gr = compute_geographic_risk(supplier)
        composite = compute_composite_disruption_probability(fr, gr)
        tier = classify_risk_tier(composite)
        delay_est = estimate_delay_days(supplier, composite)
        
        # Find alternative supplier
        alt = find_alternative_supplier(item.sku, supplier.id, db)
        recommendation = generate_recommendation(tier, supplier, item.sku, alt, db)
        
        # Persist assessment
        assessment = RiskAssessmentModel(
            order_id=order.id,
            line_item_id=item.id,
            supplier_id=supplier.id,
            sku=item.sku,
            fulfillment_reliability=fr,
            geographic_risk=gr,
            composite_disruption_probability=composite,
            risk_tier=tier,
            estimated_delay_days=delay_est,
            recommendation=recommendation,
            alternative_supplier_id=alt.id if alt else None
        )
        db.add(assessment)
        
        results.append({
            "sku": item.sku,
            "item_name": item.name,
            "supplier": supplier.name,
            "supplier_code": supplier.supplier_code,
            "supplier_region": supplier.region,
            "fulfillment_reliability": fr,
            "geographic_risk": gr,
            "disruption_probability": composite,
            "risk_tier": tier,
            "estimated_delay_days": delay_est,
            "recommendation": recommendation,
            "alternative_supplier": alt.name if alt else None,
            "alternative_supplier_code": alt.supplier_code if alt else None
        })
    
    db.commit()
    return results


def get_supplier_health_dashboard(db: Session) -> List[Dict]:
    """
    Returns all supplier nodes with their current risk profiles.
    Used by the AG Grid Supplier Health tab.
    """
    suppliers = db.query(SupplierNodeModel).filter(
        SupplierNodeModel.is_active == True
    ).all()
    
    dashboard = []
    for s in suppliers:
        fr = compute_fulfillment_reliability(s)
        gr = compute_geographic_risk(s)
        composite = compute_composite_disruption_probability(fr, gr)
        tier = classify_risk_tier(composite)
        
        sku_count = len(s.sku_mappings) if s.sku_mappings else 0
        
        dashboard.append({
            "id": s.id,
            "supplier_code": s.supplier_code,
            "name": s.name,
            "region": s.region,
            "total_orders": s.total_orders_fulfilled,
            "on_time_rate": round(s.on_time_deliveries / max(s.total_orders_fulfilled, 1), 4),
            "late_deliveries": s.late_deliveries,
            "avg_delay_days": s.avg_delay_days,
            "port_congestion": s.port_congestion_factor,
            "weather_risk": s.weather_risk_factor,
            "geopolitical_risk": s.geopolitical_risk_factor,
            "fulfillment_reliability_score": fr,
            "geographic_risk_score": gr,
            "composite_disruption_probability": composite,
            "risk_tier": tier,
            "sku_count": sku_count,
            "last_updated": s.last_updated.isoformat() if s.last_updated else None
        })
    
    return dashboard
