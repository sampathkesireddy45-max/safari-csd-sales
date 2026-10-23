from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
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
    quantity = Column(Integer, nullable=False)
    status = Column(String, default="IN_TRANSIT", nullable=False, index=True)  # IN_TRANSIT, RECEIVED, CANCELLED
    initiated_by_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    received_by_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)
    received_at = Column(DateTime, nullable=True)

    # Relationships
    from_location = relationship("Location", foreign_keys=[from_location_id], lazy="joined")
    to_location = relationship("Location", foreign_keys=[to_location_id], lazy="joined")
    product = relationship("Product", foreign_keys=[product_id], lazy="joined")
    initiated_by = relationship("Employee", foreign_keys=[initiated_by_id], lazy="joined")
    received_by = relationship("Employee", foreign_keys=[received_by_id], lazy="joined")
