"""
SQLAlchemy ORM models.
Structured for easy migration from SQLite to PostgreSQL.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Text, DateTime
from app.database import Base


class Quote(Base):
    """Persisted RFQ quote with full input and result data."""

    __tablename__ = "quotes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # Identification
    rfq_name = Column(String(200), nullable=False, index=True)
    customer = Column(String(200), nullable=True)
    part_number = Column(String(100), nullable=True)

    # Full serialized data (JSON strings)
    input_data = Column(Text, nullable=False)   # RFQInput as JSON
    result_data = Column(Text, nullable=False)  # RFQAnalysis as JSON

    # Indexed summary columns for list/filter queries
    decision = Column(String(10), nullable=False)        # GO | NO GO
    risk_level = Column(String(10), nullable=False)      # LOW | MEDIUM | HIGH
    total_cost_per_part = Column(Float, nullable=False)
    target_price = Column(Float, nullable=False)
    margin_pct = Column(Float, nullable=False)

    created_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
