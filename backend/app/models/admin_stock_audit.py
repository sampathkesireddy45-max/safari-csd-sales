from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from ..utils.database import Base
import datetime

class AdminStockAuditLog(Base):
    __tablename__ = "admin_stock_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    stock_type = Column(String(30), nullable=False, index=True)  # STORE_OPENING, STORE_CLOSING, OVERALL_OPENING, OVERALL_CLOSING
    year_month = Column(String(7), nullable=False, index=True)  # "YYYY-MM"
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    previous_value = Column(Integer, nullable=False)
    updated_value = Column(Integer, nullable=False)
    difference = Column(Integer, nullable=False)
    reason = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)

    # Relationships
    admin = relationship("Employee", foreign_keys=[admin_id], lazy="joined")
    location = relationship("Location", foreign_keys=[location_id], lazy="joined")
    product = relationship("Product", foreign_keys=[product_id], lazy="joined")
