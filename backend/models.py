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
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    order = relationship("OrderModel", back_populates="delay_notices")


class BuyerConsentModel(Base):
    __tablename__ = "buyer_consents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    choice = Column(SAEnum(ConsentChoice), nullable=False)
    swapped_sku = Column(String(64), nullable=True)  # Only if choice == SWAP
    swapped_item_name = Column(String(256), nullable=True)
    swapped_amount = Column(Float, nullable=True)  # Must be <= original delayed item amount
    displayed_text = Column(Text, nullable=False)  # Exact text shown to buyer
    timestamp = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    consent_hash = Column(String(64), nullable=False)  # SHA-256 of displayed_text + choice + timestamp

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


class AIExtractionResult(BaseModel):
    """Strict schema for AI extraction output. No currency or amount fields allowed."""
    item_identifier: str = Field(description="SKU or product name mentioned in the notice")
    new_ship_date: str = Field(description="ISO date YYYY-MM-DD or descriptive like 'mid-November'")
    reason: str = Field(description="Reason for delay, one sentence")
    language: str = Field(description="ISO 639-1 code of the notice language, e.g. 'en', 'de', 'da'")
    confidence_item: Confidence
    confidence_date: Confidence
    confidence_reason: Confidence

    @field_validator("item_identifier", "new_ship_date", "reason")
    @classmethod
    def reject_currency_symbols(cls, v: str) -> str:
        forbidden = {"$", "€", "£", "¥", "₹", "kr", "USD", "EUR", "GBP"}
        for symbol in forbidden:
            if symbol in v:
                raise ValueError(f"AI output must not contain currency symbols or codes. Found '{symbol}' in '{v}'")
        # Also reject any digit sequence that looks like a price (e.g. "30.00")
        import re
        if re.search(r'\d+\.\d{2}', v):
            raise ValueError(f"AI output must not contain price-like values. Found in '{v}'")
        return v


class ConsentSubmitRequest(BaseModel):
    order_id: int
    choice: ConsentChoice
    swapped_sku: Optional[str] = None  # Required if choice == SWAP

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


# ── Database Setup ───────────────────────────────────────────────

def create_db(db_url: str = "sqlite:///./authhorizon.db"):
    engine = create_engine(db_url, echo=False)
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)

