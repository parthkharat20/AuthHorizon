
"""
AuthHorizon Database Engine & Session Management
Uses SQLite with Write-Ahead Logging (WAL) for concurrency.
"""

import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from backend.models import Base
from backend.risk.models import SupplierNodeModel, SupplierSKUMapping, RiskAssessmentModel  # noqa: F401

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./authhorizon.db")

# Create engine
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
    echo=False
)

# Enable WAL mode and foreign keys for SQLite
if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    """Create all tables in SQLite and ensure all schema columns exist."""
    Base.metadata.create_all(bind=engine)
    if DATABASE_URL.startswith("sqlite"):
        with engine.connect() as conn:
            from sqlalchemy import text
            for col_def in [
                "buyer_locale VARCHAR(8) DEFAULT 'en'",
                "buyer_message TEXT"
            ]:
                try:
                    conn.execute(text(f"ALTER TABLE delay_notices ADD COLUMN {col_def}"))
                    conn.commit()
                except Exception:
                    pass
            for col_def in [
                "buyer_id VARCHAR(64) DEFAULT 'BUYER-PORTAL-VERIFIED'",
                "locale VARCHAR(8) DEFAULT 'en'",
                "prev_hash VARCHAR(64) DEFAULT '0000000000000000000000000000000000000000000000000000000000000000'",
                "canonical_payload TEXT"
            ]:
                try:
                    conn.execute(text(f"ALTER TABLE buyer_consents ADD COLUMN {col_def}"))
                    conn.commit()
                except Exception:
                    pass
            try:
                conn.execute(text("ALTER TABLE orders ADD COLUMN auth_expires_at DATETIME"))
                conn.commit()
            except Exception:
                pass

    # Auto-seed demo orders on fresh launch if DB is empty
    if os.getenv("AUTO_SEED_DEMO_DATA", "true").lower() == "true":
        with SessionLocal() as db:
            seed_demo_data(db)


def seed_demo_data(db: Session):
    """
    Seeds 3 demonstration orders covering the entire AuthHorizon lifecycle:
      1. Order #1 (AUTHORIZED): Fresh $90.00 hold ($90.00 held, $0.00 captured)
      2. Order #2 (PARTIALLY_CAPTURED): In-stock shipped ($60.00 captured, $30.00 held, German notice)
      3. Order #3 (COMPLETED): Resolved via SWAP ($88.00 captured, $0.00 held, SHA-256 consent chain)
    Idempotent: skips if orders already exist.
    """
    from backend.models import (
        OrderModel, LineItemModel, DelayNoticeModel, BuyerConsentModel,
        CaptureAuditModel, GatewayEventLogModel, OrderStatus, LineItemStatus,
        NoticeStatus, Confidence, ConsentChoice
    )
    from backend.evidence import compute_canonical_consent_payload, GENESIS_HASH
    from datetime import datetime, timezone, timedelta
    import uuid

    if db.query(OrderModel).count() > 0:
        return

    now = datetime.now(timezone.utc)

    # ── Demo Order 1: Fresh Authorization ($90.00 held) ───────────
    ord1 = OrderModel(
        paypal_order_id="81R116453E1577428-DEMO1",
        auth_id="AUTH-DEMO1-90-HELD",
        total_amount=90.00,
        captured_amount=0.00,
        held_amount=90.00,
        currency="USD",
        status=OrderStatus.AUTHORIZED,
        created_at=now - timedelta(hours=2),
        auth_created_at=now - timedelta(hours=2),
        auth_expires_at=now - timedelta(hours=2) + timedelta(days=29)
    )
    db.add(ord1)
    db.flush()

    for sku, name in [
        ("SKU-BEAR-01", "Precision Bearings (Set of 4)"),
        ("SKU-PUMP-02", "Hydraulic Pump Assembly"),
        ("SKU-COAT-03", "Ceramic Coating Kit Industrial")
    ]:
        db.add(LineItemModel(
            order_id=ord1.id,
            sku=sku,
            name=name,
            amount=30.00,
            quantity=1,
            status=LineItemStatus.IN_STOCK
        ))

    db.add(GatewayEventLogModel(
        order_id=ord1.id,
        action="AUTHORIZE",
        request_id=f"REQ-SEED-ORD1-{uuid.uuid4().hex[:8]}",
        endpoint="/v2/checkout/orders/81R116453E1577428-DEMO1/authorize",
        status_code=201,
        reconciler_status="VERIFIED",
        reconciler_message="Authorized hold for $90.00 with intent=AUTHORIZE",
        paypal_resource_id="AUTH-DEMO1-90-HELD",
        created_at=now - timedelta(hours=2)
    ))

    # ── Demo Order 2: Partially Captured ($60.00 captured, $30.00 held) ───
    ord2 = OrderModel(
        paypal_order_id="59T782341M9012345-DEMO2",
        auth_id="AUTH-DEMO2-60-PARTIAL",
        total_amount=90.00,
        captured_amount=60.00,
        held_amount=30.00,
        currency="USD",
        status=OrderStatus.PARTIALLY_CAPTURED,
        created_at=now - timedelta(hours=5),
        auth_created_at=now - timedelta(hours=5),
        auth_expires_at=now - timedelta(hours=5) + timedelta(days=29)
    )
    db.add(ord2)
    db.flush()

    db.add(LineItemModel(
        order_id=ord2.id,
        sku="SKU-BEAR-01",
        name="Precision Bearings (Set of 4)",
        amount=30.00,
        quantity=1,
        status=LineItemStatus.SHIPPED
    ))
    db.add(LineItemModel(
        order_id=ord2.id,
        sku="SKU-PUMP-02",
        name="Hydraulic Pump Assembly",
        amount=30.00,
        quantity=1,
        status=LineItemStatus.SHIPPED
    ))
    db.add(LineItemModel(
        order_id=ord2.id,
        sku="SKU-COAT-03",
        name="Ceramic Coating Kit Industrial",
        amount=30.00,
        quantity=1,
        status=LineItemStatus.DELAYED,
        is_delayed=True
    ))

    db.add(CaptureAuditModel(
        order_id=ord2.id,
        paypal_capture_id="CAP-DEMO2-60-PARTIAL",
        amount=60.00,
        currency="USD",
        final_capture=False,
        request_id=f"REQ-SEED-CAP-ORD2-{uuid.uuid4().hex[:8]}",
        capture_type="IN_STOCK_SHIPMENT",
        webhook_verified=True,
        webhook_verified_at=now - timedelta(hours=4),
        created_at=now - timedelta(hours=4)
    ))

    db.add(GatewayEventLogModel(
        order_id=ord2.id,
        action="PARTIAL_CAPTURE",
        request_id=f"REQ-SEED-CAP-ORD2-{uuid.uuid4().hex[:8]}",
        endpoint="/v2/payments/authorizations/AUTH-DEMO2-60-PARTIAL/capture",
        status_code=201,
        reconciler_status="VERIFIED",
        reconciler_message="Captured $60.00, remaining hold $30.00 verified on gateway",
        paypal_resource_id="CAP-DEMO2-60-PARTIAL",
        created_at=now - timedelta(hours=4)
    ))

    db.add(DelayNoticeModel(
        order_id=ord2.id,
        raw_text=(
            "Sehr geehrte Damen und Herren,\n"
            "aufgrund eines unvorhergesehenen Lieferengpasses bei unserem Vorlieferanten für die Platine (SKU-COAT-03) "
            "müssen wir Ihnen mitteilen, dass sich die Auslieferung verzögert.\n"
            "Wir erwarten die Charge voraussichtlich am 2026-11-28 versandbereit zu haben.\n"
            "Mit freundlichen Grüßen,\nKlaus Schmidt, Logistikleitung"
        ),
        language="de",
        extracted_sku="SKU-COAT-03",
        extracted_item_name="Ceramic Coating Kit Industrial",
        new_ship_date="2026-11-28",
        reason="Lieferverzögerung wegen Engpässen im Zolllager",
        confidence_sku=Confidence.HIGH,
        confidence_date=Confidence.HIGH,
        confidence_reason=Confidence.HIGH,
        status=NoticeStatus.APPROVED,
        buyer_locale="en",
        buyer_message=(
            "Your order has been partially shipped. However, 'Ceramic Coating Kit Industrial' is delayed and estimated to ship on 2026-11-28. "
            "A temporary pre-authorization hold of $30.00 remains on your PayPal account and will only be captured when shipped. "
            "You may choose to wait, swap to an in-stock item, or cancel."
        ),
        created_at=now - timedelta(hours=3)
    ))

    # ── Demo Order 3: Completed with SWAP ($88.00 captured, SHA-256 chain) ──
    ord3 = OrderModel(
        paypal_order_id="12W456789K1234567-DEMO3",
        auth_id="AUTH-DEMO3-COMPLETED",
        total_amount=90.00,
        captured_amount=88.00,
        held_amount=0.00,
        currency="USD",
        status=OrderStatus.COMPLETED,
        created_at=now - timedelta(hours=8),
        auth_created_at=now - timedelta(hours=8)
    )
    db.add(ord3)
    db.flush()

    db.add(LineItemModel(
        order_id=ord3.id,
        sku="SKU-BEAR-01",
        name="Precision Bearings (Set of 4)",
        amount=30.00,
        quantity=1,
        status=LineItemStatus.SHIPPED
    ))
    db.add(LineItemModel(
        order_id=ord3.id,
        sku="SKU-PUMP-02",
        name="Hydraulic Pump Assembly",
        amount=30.00,
        quantity=1,
        status=LineItemStatus.SHIPPED
    ))
    db.add(LineItemModel(
        order_id=ord3.id,
        sku="SKU-SWAP-02",
        name="Alternative Ceramic Coating Set",
        amount=28.00,
        quantity=1,
        status=LineItemStatus.SWAPPED,
        original_sku="SKU-COAT-03"
    ))

    db.add(CaptureAuditModel(
        order_id=ord3.id,
        paypal_capture_id="CAP-DEMO3-60-PARTIAL",
        amount=60.00,
        currency="USD",
        final_capture=False,
        request_id=f"REQ-SEED-CAP1-ORD3-{uuid.uuid4().hex[:8]}",
        capture_type="IN_STOCK_SHIPMENT",
        webhook_verified=True,
        webhook_verified_at=now - timedelta(hours=7),
        created_at=now - timedelta(hours=7)
    ))
    db.add(CaptureAuditModel(
        order_id=ord3.id,
        paypal_capture_id="CAP-DEMO3-28-SWAP",
        amount=28.00,
        currency="USD",
        final_capture=True,
        request_id=f"REQ-SEED-CAP2-ORD3-{uuid.uuid4().hex[:8]}",
        capture_type="SWAP",
        webhook_verified=True,
        webhook_verified_at=now - timedelta(hours=6),
        created_at=now - timedelta(hours=6)
    ))

    consent_text = "Buyer consented to swap 'Ceramic Coating Kit Industrial' for 'Alternative Ceramic Coating Set' at $28.00."
    ts_str = (now - timedelta(hours=6)).isoformat()
    canonical_payload, consent_hash = compute_canonical_consent_payload(
        order_id=ord3.id,
        buyer_id="BUYER-PORTAL-VERIFIED",
        paypal_order_id=ord3.paypal_order_id,
        authorization_id=ord3.auth_id,
        choice="SWAP",
        displayed_text=consent_text,
        locale="en",
        timestamp_utc=ts_str,
        prev_hash=GENESIS_HASH
    )

    db.add(BuyerConsentModel(
        order_id=ord3.id,
        buyer_id="BUYER-PORTAL-VERIFIED",
        choice=ConsentChoice.SWAP,
        swapped_sku="SKU-SWAP-02",
        swapped_item_name="Alternative Ceramic Coating Set",
        swapped_amount=28.00,
        displayed_text=consent_text,
        locale="en",
        prev_hash=GENESIS_HASH,
        consent_hash=consent_hash,
        canonical_payload=canonical_payload,
        timestamp=now - timedelta(hours=6)
    ))

    db.add(GatewayEventLogModel(
        order_id=ord3.id,
        action="SWAP_CAPTURE",
        request_id=f"REQ-SEED-CAP2-ORD3-{uuid.uuid4().hex[:8]}",
        endpoint="/v2/payments/authorizations/AUTH-DEMO3-COMPLETED/capture",
        status_code=201,
        reconciler_status="VERIFIED",
        reconciler_message="Captured swap item 'Alternative Ceramic Coating Set' for $28.00 with final_capture=true",
        paypal_resource_id="CAP-DEMO3-28-SWAP",
        created_at=now - timedelta(hours=6)
    ))

    # ── Seed Supplier Nodes & SKU Mappings for Risk Engine (M5) ────
    from backend.risk.models import SupplierNodeModel, SupplierSKUMapping
    from backend.risk.engine import assess_order_risk

    if db.query(SupplierNodeModel).count() == 0:
        # Supplier A: Reliable US warehouse (low risk)
        sup_a = SupplierNodeModel(
            supplier_code="SUP-US-PRIME",
            name="PrimeParts USA (Ohio Warehouse)",
            region="US",
            total_orders_fulfilled=500,
            on_time_deliveries=480,
            late_deliveries=20,
            avg_delay_days=2.0,
            port_congestion_factor=0.05,
            weather_risk_factor=0.03,
            geopolitical_risk_factor=0.01
        )
        db.add(sup_a)

        # Supplier B: EU supplier with moderate risk
        sup_b = SupplierNodeModel(
            supplier_code="SUP-EU-LOGISTICS",
            name="EuroLogistik GmbH (Hamburg)",
            region="DE",
            total_orders_fulfilled=300,
            on_time_deliveries=240,
            late_deliveries=60,
            avg_delay_days=5.5,
            port_congestion_factor=0.35,
            weather_risk_factor=0.15,
            geopolitical_risk_factor=0.10
        )
        db.add(sup_b)

        # Supplier C: Asia supplier with high risk (Ceramic Coating supplier)
        sup_c = SupplierNodeModel(
            supplier_code="SUP-ASIA-SHENZHEN",
            name="Shenzhen Components Ltd",
            region="CN",
            total_orders_fulfilled=200,
            on_time_deliveries=110,
            late_deliveries=90,
            avg_delay_days=12.0,
            port_congestion_factor=0.75,
            weather_risk_factor=0.30,
            geopolitical_risk_factor=0.65
        )
        db.add(sup_c)

        db.flush()

        # Map SKUs to suppliers
        # SKU-BEAR-01: Primary = US, Backup = EU
        db.add(SupplierSKUMapping(supplier_id=sup_a.id, sku="SKU-BEAR-01", is_primary=True, unit_cost=12.00, lead_time_days=3))
        db.add(SupplierSKUMapping(supplier_id=sup_b.id, sku="SKU-BEAR-01", is_primary=False, unit_cost=14.00, lead_time_days=7))

        # SKU-PUMP-02: Primary = EU, Backup = US
        db.add(SupplierSKUMapping(supplier_id=sup_b.id, sku="SKU-PUMP-02", is_primary=True, unit_cost=18.00, lead_time_days=5))
        db.add(SupplierSKUMapping(supplier_id=sup_a.id, sku="SKU-PUMP-02", is_primary=False, unit_cost=20.00, lead_time_days=4))

        # SKU-COAT-03: Primary = Asia (HIGH RISK), Backup = US
        db.add(SupplierSKUMapping(supplier_id=sup_c.id, sku="SKU-COAT-03", is_primary=True, unit_cost=8.00, lead_time_days=14))
        db.add(SupplierSKUMapping(supplier_id=sup_a.id, sku="SKU-COAT-03", is_primary=False, unit_cost=15.00, lead_time_days=5))

        # SKU-SWAP-02: Only from US
        db.add(SupplierSKUMapping(supplier_id=sup_a.id, sku="SKU-SWAP-02", is_primary=True, unit_cost=10.00, lead_time_days=3))
        db.flush()

    # Pre-compute risk assessments for demo orders
    for demo_ord in [ord1, ord2, ord3]:
        assess_order_risk(demo_ord.id, db)

    db.commit()

def get_db():
    """FastAPI dependency for database sessions."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
