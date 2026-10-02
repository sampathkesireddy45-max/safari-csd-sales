from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float
from sqlalchemy.orm import relationship
from ..utils.database import Base
import datetime

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(String, unique=True, index=True, nullable=False)
    index_no = Column(String, index=True, nullable=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    rate_per_pc = Column(Float, nullable=True)
    selling_rate = Column(Float, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    inventory_items = relationship("Inventory", back_populates="product")
    sale_items = relationship("SaleItem", back_populates="product")
    damage_items = relationship("DamageReportItem", back_populates="product")

