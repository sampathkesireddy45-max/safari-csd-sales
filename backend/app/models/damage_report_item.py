from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from ..utils.database import Base
import datetime

class DamageReportItem(Base):
    __tablename__ = "damage_report_items"

    id = Column(Integer, primary_key=True, index=True)
    damage_report_id = Column(Integer, ForeignKey("damage_reports.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    description = Column(String, nullable=True)

    # Relationships
    damage_report = relationship("DamageReport", back_populates="items")
    product = relationship("Product", back_populates="damage_items")
