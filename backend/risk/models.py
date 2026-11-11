"""
AuthHorizon Predictive Supply Disruption Risk Engine — Data Models
Supplier telemetry nodes and risk assessment records.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from backend.models import Base


class SupplierNodeModel(Base):
    """
    Represents a supplier/warehouse fulfillment node in the supply chain graph.
    Each node has historical telemetry that feeds the deterministic risk scorer.
    """
    __tablename__ = "supplier_nodes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    supplier_code = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(256), nullable=False)
    region = Column(String(64), nullable=False, default="US")  # ISO country or region code
    
    # Historical fulfillment telemetry (deterministic — NOT AI-computed)
    total_orders_fulfilled = Column(Integer, nullable=False, default=100)
    on_time_deliveries = Column(Integer, nullable=False, default=90)
    late_deliveries = Column(Integer, nullable=False, default=10)
    avg_delay_days = Column(Float, nullable=False, default=3.0)
    
    # Geographic & environmental risk factors (0.0 to 1.0)
    port_congestion_factor = Column(Float, nullable=False, default=0.1)
    weather_risk_factor = Column(Float, nullable=False, default=0.05)
    geopolitical_risk_factor = Column(Float, nullable=False, default=0.05)
    
    # Operational
    is_active = Column(Boolean, nullable=False, default=True)
    last_updated = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    sku_mappings = relationship("SupplierSKUMapping", back_populates="supplier_node", cascade="all, delete-orphan")
    risk_assessments = relationship("RiskAssessmentModel", back_populates="supplier_node", cascade="all, delete-orphan", foreign_keys="RiskAssessmentModel.supplier_id")


class SupplierSKUMapping(Base):
    """Maps which SKUs each supplier can fulfill."""
    __tablename__ = "supplier_sku_mappings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    supplier_id = Column(Integer, ForeignKey("supplier_nodes.id"), nullable=False)
    sku = Column(String(64), nullable=False, index=True)
    is_primary = Column(Boolean, nullable=False, default=True)  # Primary vs backup supplier
    unit_cost = Column(Float, nullable=True)  # Supplier's cost for this SKU
    lead_time_days = Column(Integer, nullable=False, default=5)

    supplier_node = relationship("SupplierNodeModel", back_populates="sku_mappings")


class RiskAssessmentModel(Base):
    """
    Stores computed risk assessment results per supplier per order line item.
    ALL scores are deterministic Python — NEVER AI-computed.
    """
    __tablename__ = "risk_assessments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    line_item_id = Column(Integer, ForeignKey("line_items.id"), nullable=False)
    supplier_id = Column(Integer, ForeignKey("supplier_nodes.id"), nullable=False)
    sku = Column(String(64), nullable=False)
    
    # Deterministic risk scores (0.0 to 1.0)
    fulfillment_reliability = Column(Float, nullable=False)  # on_time / total
    geographic_risk = Column(Float, nullable=False)  # weighted sum of port/weather/geo factors
    composite_disruption_probability = Column(Float, nullable=False)  # final weighted score
    
    # Risk tier (deterministic threshold-based)
    risk_tier = Column(String(16), nullable=False)  # "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
    estimated_delay_days = Column(Integer, nullable=False, default=0)
    
    # Mitigation recommendation (deterministic rule-based, NOT AI-generated)
    recommendation = Column(Text, nullable=True)
    alternative_supplier_id = Column(Integer, ForeignKey("supplier_nodes.id"), nullable=True)
    
    assessed_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    
    supplier_node = relationship("SupplierNodeModel", back_populates="risk_assessments",
                                  foreign_keys=[supplier_id])
