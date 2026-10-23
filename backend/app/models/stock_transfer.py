from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from ..utils.database import Base
import datetime

class StockTransfer(Base):
    __tablename__ = "stock_transfers"

    id = Column(Integer, primary_key=True, index=True)
    transfer_number = Column(String, unique=True, index=True, nullable=False)
    from_location_id = Column(Integer, ForeignKey("locations.id"), nullable=False, index=True)
    to_location_id = Column(Integer, ForeignKey("locations.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    quantity = Column(Integer, nullable=False)  # Dispatched quantity
    dispatched_quantity = Column(Integer, nullable=False, default=0)
    received_quantity = Column(Integer, nullable=True)
    has_mismatch = Column(Boolean, default=False, nullable=False)
    mismatch_quantity = Column(Integer, default=0, nullable=False)
    mismatch_notes = Column(Text, nullable=True)
    status = Column(String, default="SENT", nullable=False, index=True)  # SENT, RECEIVED, CANCELLED
    initiated_by_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    sent_by_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    sent_at = Column(DateTime, nullable=True)
    received_by_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    received_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)

    # Relationships
    from_location = relationship("Location", foreign_keys=[from_location_id], lazy="joined")
    to_location = relationship("Location", foreign_keys=[to_location_id], lazy="joined")
    product = relationship("Product", foreign_keys=[product_id], lazy="joined")
    initiated_by = relationship("Employee", foreign_keys=[initiated_by_id], lazy="joined")
    sent_by = relationship("Employee", foreign_keys=[sent_by_id], lazy="joined")
    received_by = relationship("Employee", foreign_keys=[received_by_id], lazy="joined")
