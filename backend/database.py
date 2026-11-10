
"""
AuthHorizon Database Engine & Session Management
Uses SQLite with Write-Ahead Logging (WAL) for concurrency.
"""

import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from backend.models import Base

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

def get_db():
    """FastAPI dependency for database sessions."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
