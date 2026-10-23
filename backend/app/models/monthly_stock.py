from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint, Boolean, Text
from sqlalchemy.orm import relationship
from ..utils.database import Base
import datetime

class MonthlyStock(Base):
    __tablename__ = "monthly_stocks"
    __table_args__ = (
        UniqueConstraint("year_month", "location_id", "product_id", name="uq_monthly_stock"),
    )

    id = Column(Integer, primary_key=True, index=True)
    year_month = Column(String(7), nullable=False, index=True)  # Format: "YYYY-MM" (e.g. "2026-10")
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    opening_stock = Column(Integer, default=0, nullable=False)
    manual_receiving_stock = Column(Integer, nullable=True)
    is_receiving_manually_edited = Column(Boolean, default=False, nullable=False)
    receiving_edit_reason = Column(Text, nullable=True)
    manual_closing_stock = Column(Integer, nullable=True)
    is_closing_manually_edited = Column(Boolean, default=False, nullable=False)
    closing_edit_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    # Relationships
    location = relationship("Location", foreign_keys=[location_id], lazy="joined")
    product = relationship("Product", foreign_keys=[product_id], lazy="joined")
