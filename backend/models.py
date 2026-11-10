"""
AuthHorizon — Data Models & SQLite Schema
All SQLAlchemy ORM models and Pydantic validation schemas.
"""

import enum
import hashlib
import json
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import (
    Column, DateTime, Enum as SAEnum, Float, ForeignKey, Integer, String, Text, Boolean,
    create_engine,
)
from sqlalchemy.orm import DeclarativeBase, relationship, Session, sessionmaker


# ── SQLAlchemy Base ──────────────────────────────────────────────

class Base(DeclarativeBase):
    pass


# ── Enums ────────────────────────────────────────────────────────

class OrderStatus(str, enum.Enum):
    CREATED = "CREATED"
    APPROVED = "APPROVED"
    AUTHORIZED = "AUTHORIZED"
    PARTIALLY_CAPTURED = "PARTIALLY_CAPTURED"
    COMPLETED = "COMPLETED"
    VOIDED = "VOIDED"


class LineItemStatus(str, enum.Enum):
    IN_STOCK = "IN_STOCK"
    DELAYED = "DELAYED"
    SWAPPED = "SWAPPED"
    CANCELLED = "CANCELLED"
    SHIPPED = "SHIPPED"


class NoticeStatus(str, enum.Enum):
    PENDING_REVIEW = "PENDING_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class Confidence(str, enum.Enum):
    HIGH = "HIGH"
    MED = "MED"
    LOW = "LOW"


class ConsentChoice(str, enum.Enum):
    WAIT = "WAIT"
    SWAP = "SWAP"
    CANCEL = "CANCEL"


# ── ORM Models ───────────────────────────────────────────────────

class OrderModel(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    paypal_order_id = Column(String(64), unique=True, nullable=False, index=True)
    auth_id = Column(String(64), unique=True, nullable=True)
    total_amount = Column(Float, nullable=False)
    captured_amount = Column(Float, nullable=False, default=0.0)
    held_amount = Column(Float, nullable=False, default=0.0)
    currency = Column(String(3), nullable=False, default="USD")
    status = Column(SAEnum(OrderStatus), nullable=False, default=OrderStatus.CREATED)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))
    auth_created_at = Column(DateTime, nullable=True)  # When PayPal auth was placed

    line_items = relationship("LineItemModel", back_populates="order", cascade="all, delete-orphan")
    delay_notices = relationship("DelayNoticeModel", back_populates="order", cascade="all, delete-orphan")
    consent_records = relationship("BuyerConsentModel", back_populates="order", cascade="all, delete-orphan")
    capture_audits = relationship("CaptureAuditModel", back_populates="order", cascade="all, delete-orphan")
    gateway_logs = relationship("GatewayEventLogModel", back_populates="order", cascade="all, delete-orphan")


class LineItemModel(Base):
    __tablename__ = "line_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    sku = Column(String(64), nullable=False)
    name = Column(String(256), nullable=False)
    amount = Column(Float, nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    status = Column(SAEnum(LineItemStatus), nullable=False, default=LineItemStatus.IN_STOCK)
    is_delayed = Column(Boolean, nullable=False, default=False)
    original_sku = Column(String(64), nullable=True)  # Set if item was swapped

    order = relationship("OrderModel", back_populates="line_items")


class DelayNoticeModel(Base):
    __tablename__ = "delay_notices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    raw_text = Column(Text, nullable=False)
    language = Column(String(16), nullable=True)
    extracted_sku = Column(String(64), nullable=True)
    extracted_item_name = Column(String(256), nullable=True)
    new_ship_date = Column(String(32), nullable=True)  # ISO date or human description
    reason = Column(Text, nullable=True)
    confidence_sku = Column(SAEnum(Confidence), nullable=True)
    confidence_date = Column(SAEnum(Confidence), nullable=True)
    confidence_reason = Column(SAEnum(Confidence), nullable=True)
    status = Column(SAEnum(NoticeStatus), nullable=False, default=NoticeStatus.PENDING_REVIEW)
    buyer_locale = Column(String(8), nullable=True, default="en")
    buyer_message = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    order = relationship("OrderModel", back_populates="delay_notices")


class BuyerConsentModel(Base):
    __tablename__ = "buyer_consents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    buyer_id = Column(String(64), nullable=True, default="BUYER-PORTAL-VERIFIED")
    choice = Column(SAEnum(ConsentChoice), nullable=False)
    swapped_sku = Column(String(64), nullable=True)  # Only if choice == SWAP
    swapped_item_name = Column(String(256), nullable=True)
    swapped_amount = Column(Float, nullable=True)  # Must be <= original delayed item amount
    displayed_text = Column(Text, nullable=False)  # Exact text shown to buyer
    locale = Column(String(8), nullable=True, default="en")
    timestamp = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    prev_hash = Column(String(64), nullable=True, default="0"*64)  # Previous consent record SHA-256
    consent_hash = Column(String(64), nullable=False)  # SHA-256 of canonical JSON payload
    canonical_payload = Column(Text, nullable=True)  # Full canonical JSON payload

    order = relationship("OrderModel", back_populates="consent_records")


class CaptureAuditModel(Base):
    __tablename__ = "capture_audits"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    paypal_capture_id = Column(String(64), nullable=True, unique=True)
    amount = Column(Float, nullable=False)
    currency = Column(String(3), nullable=False, default="USD")
    final_capture = Column(Boolean, nullable=False)
    request_id = Column(String(64), nullable=False, unique=True)  # PayPal-Request-Id (idempotency)
    webhook_verified = Column(Boolean, nullable=False, default=False)
    webhook_verified_at = Column(DateTime, nullable=True)
    capture_type = Column(String(32), nullable=False)  # "IN_STOCK_SHIPMENT" | "DELAYED_RESOLUTION" | "SWAP"
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    order = relationship("OrderModel", back_populates="capture_audits")


class GatewayEventLogModel(Base):
    __tablename__ = "gateway_event_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    action = Column(String(32), nullable=False)  # "CREATE_ORDER" | "AUTHORIZE" | "PARTIAL_CAPTURE" | "FINAL_CAPTURE" | "VOID" | "RECONCILE" | "IDEMPOTENCY_REPLAY"
    request_id = Column(String(64), nullable=False)  # PayPal-Request-Id
    endpoint = Column(String(256), nullable=False)
    status_code = Column(Integer, nullable=False, default=200)
    reconciler_status = Column(String(16), nullable=False, default="VERIFIED")  # "VERIFIED" | "MISMATCH" | "ERROR"
    reconciler_message = Column(Text, nullable=True)
    paypal_resource_id = Column(String(64), nullable=True)  # auth_id or capture_id or order_id
    payload_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    order = relationship("OrderModel", back_populates="gateway_logs")


# ── Pydantic Schemas ─────────────────────────────────────────────

class LineItemSchema(BaseModel):
    sku: str
    name: str
    amount: float = Field(gt=0)
    quantity: int = Field(default=1, ge=1)
    status: LineItemStatus = LineItemStatus.IN_STOCK


class OrderCreateRequest(BaseModel):
    items: list[LineItemSchema] = Field(min_length=1)
    currency: str = "USD"


class OrderResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    paypal_order_id: str
    auth_id: Optional[str] = None
    total_amount: float
    captured_amount: float = 0.0
    held_amount: float = 0.0
    currency: str
    status: OrderStatus
    items: list[LineItemSchema]
    created_at: datetime


class DelayNoticeInput(BaseModel):
    order_id: int
    raw_text: str = Field(min_length=10, max_length=5000)
    buyer_locale: Optional[str] = "en"


class LocalizeMessageRequest(BaseModel):
    order_id: int
    buyer_locale: str = Field(default="en", description="Target buyer locale: en, ja, de, da")


class AIExtractionResult(BaseModel):
    """Strict schema for AI extraction output. No currency, prices, or digits in text fields."""
    item_identifier: str = Field(description="SKU or product name mentioned in the notice")
    new_ship_date: str = Field(description="Strict ISO date YYYY-MM-DD")
    reason: str = Field(description="Reason for delay, one sentence without digits, URLs, or currency terms")
    language: str = Field(description="ISO 639-1 code of notice language, e.g. 'en', 'de', 'da', 'ja'")
    confidence_item: Confidence
    confidence_date: Confidence
    confidence_reason: Confidence

    @field_validator("new_ship_date")
    @classmethod
    def validate_new_ship_date(cls, v: str) -> str:
        import re, unicodedata
        from datetime import datetime, date, timedelta
        s = unicodedata.normalize('NFKC', str(v).strip())
        
        # Dotted German/Danish date normalization (e.g. 22.11.2026 -> 2026-11-22)
        m = re.match(r'^(\d{1,2})\.(\d{1,2})\.(\d{4})$', s)
        if m:
            d, m_val, y = m.groups()
            s = f"{y}-{m_val.zfill(2)}-{d.zfill(2)}"
        elif re.match(r'^(\d{4})\.(\d{1,2})\.(\d{1,2})$', s):
            y, m_val, d = re.match(r'^(\d{4})\.(\d{1,2})\.(\d{1,2})$', s).groups()
            s = f"{y}-{m_val.zfill(2)}-{d.zfill(2)}"

        if not re.match(r'^\d{4}-\d{2}-\d{2}$', s):
            raise ValueError(f"Safety Gate Violation: new_ship_date '{v}' must match YYYY-MM-DD format")
        
        try:
            parsed = datetime.strptime(s, "%Y-%m-%d").date()
        except ValueError as e:
            raise ValueError(f"Safety Gate Violation: Invalid calendar date '{s}': {e}")
            
        today = date.today()
        if parsed < today:
            raise ValueError(f"Safety Gate Violation: new_ship_date '{s}' is in the past (today: {today})")
        if parsed > today + timedelta(days=365):
            raise ValueError(f"Safety Gate Violation: new_ship_date '{s}' exceeds 1-year future threshold")
            
        return s

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v: str) -> str:
        import re, unicodedata
        s = unicodedata.normalize('NFKC', str(v))
        if re.search(r'https?://|www\.', s, re.IGNORECASE):
            raise ValueError(f"Safety Gate Violation: reason must not contain URLs")
        for ch in s:
            cat = unicodedata.category(ch)
            if cat == 'Nd':
                raise ValueError(f"Safety Gate Violation: reason must not contain digits ('{ch}', category Nd). Only new_ship_date may contain digits.")
            if cat == 'Sc':
                raise ValueError(f"Safety Gate Violation: reason must not contain currency symbol '{ch}' (category Sc)")
        currency_words = {
            "dollar", "dollars", "cent", "cents", "usd", "eur", "euro", "euros",
            "pound", "pounds", "gbp", "yen", "jpy", "krone", "kroner", "dkk",
            "buck", "bucks", "cash", "refund", "charge", "payment", "price", "fee",
            "pfennig", "pfennige", "kronen", "geld", "erstattung", "rückerstattung", "zahlung", "gebühr", "kosten",
            "øre", "betaling", "refusion", "omkostning",
            "円", "ドル", "ユーロ", "ポンド", "セント", "通貨", "金額", "返金", "支払い", "価格", "費用"
        }
        words = set(re.findall(r'\b[a-zæøåäöüß]+\b', s.lower()))
        found = words.intersection(currency_words)
        if found:
            raise ValueError(f"Safety Gate Violation: reason must not contain currency terms: {sorted(list(found))}")
        for ja in {"円", "ドル", "ユーロ", "ポンド", "セント", "返金", "支払い", "価格", "費用"}:
            if ja in s:
                raise ValueError(f"Safety Gate Violation: reason must not contain Japanese currency term '{ja}'")
        return s

    @field_validator("item_identifier")
    @classmethod
    def validate_item_identifier(cls, v: str) -> str:
        import re, unicodedata
        s = unicodedata.normalize('NFKC', str(v))
        for ch in s:
            if unicodedata.category(ch) == 'Sc':
                raise ValueError(f"Safety Gate Violation: item_identifier must not contain currency symbol '{ch}'")
        currency_words = {"dollar", "dollars", "usd", "eur", "euro", "gbp", "yen", "krone", "kroner", "cash", "refund"}
        words = set(re.findall(r'\b[a-zæøåäöüß]+\b', s.lower()))
        if words.intersection(currency_words):
            raise ValueError("Safety Gate Violation: item_identifier must not contain currency terms")
        return s


class ConsentSubmitRequest(BaseModel):
    order_id: int
    choice: ConsentChoice
    swapped_sku: Optional[str] = None  # Required if choice == SWAP
    locale: Optional[str] = "en"

    @field_validator("swapped_sku")
    @classmethod
    def swap_requires_sku(cls, v, info):
        if info.data.get("choice") == ConsentChoice.SWAP and not v:
            raise ValueError("swapped_sku is required when choice is SWAP")
        return v


class WebhookVerificationRequest(BaseModel):
    auth_algo: str
    cert_url: str
    transmission_id: str
    transmission_sig: str
    transmission_time: str
    webhook_id: str
    webhook_event: dict


# ── Consent Hashing ──────────────────────────────────────────────

def compute_consent_hash(displayed_text: str, choice: str, timestamp: str) -> str:
    """SHA-256 hash binding the exact text shown to the buyer with their choice and timestamp."""
    payload = json.dumps({
        "displayed_text": displayed_text,
        "choice": choice,
        "timestamp": timestamp,
    }, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()

