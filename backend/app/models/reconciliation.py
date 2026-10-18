from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Date, Text
from sqlalchemy.orm import relationship
from ..utils.database import Base
import datetime

class ShiftReconciliation(Base):
    __tablename__ = "shift_reconciliations"

    id = Column(Integer, primary_key=True, index=True)
    reconciliation_date = Column(String, nullable=False, index=True)  # YYYY-MM-DD (IST)
    shift_type = Column(String, default="daily", nullable=False)     # "daily", "opening", "closing"
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    status = Column(String, default="submitted", nullable=False)       # "balanced", "variance_flagged", "verified"
    
    total_expected_pieces = Column(Integer, default=0, nullable=False)
    total_physical_pieces = Column(Integer, default=0, nullable=False)
    total_variance = Column(Integer, default=0, nullable=False)        # physical - expected
    discrepancy_items_count = Column(Integer, default=0, nullable=False)
    
    inventory_adjusted = Column(Integer, default=1, nullable=False)    # 1 if inventory was auto-synced
    notes = Column(Text, nullable=True)
    verified_by = Column(Integer, ForeignKey("employees.id"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    verification_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    # Relationships
    location = relationship("Location")
    employee = relationship("Employee", foreign_keys=[employee_id])
    verifier = relationship("Employee", foreign_keys=[verified_by])
    items = relationship("ReconciliationItem", back_populates="reconciliation", cascade="all, delete-orphan")

class ReconciliationItem(Base):
    __tablename__ = "reconciliation_items"

    id = Column(Integer, primary_key=True, index=True)
    reconciliation_id = Column(Integer, ForeignKey("shift_reconciliations.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    
    opening_pieces = Column(Integer, default=0, nullable=False)
    received_pieces = Column(Integer, default=0, nullable=False)
    sold_pieces = Column(Integer, default=0, nullable=False)
    damaged_pieces = Column(Integer, default=0, nullable=False)
    expected_pieces = Column(Integer, default=0, nullable=False)
    physical_pieces = Column(Integer, default=0, nullable=False)
    variance = Column(Integer, default=0, nullable=False)              # physical_pieces - expected_pieces
    notes = Column(String, nullable=True)

    # Relationships
    reconciliation = relationship("ShiftReconciliation", back_populates="items")
    product = relationship("Product")
