from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from ..utils.database import Base
import datetime

class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    sale_date = Column(DateTime, default=datetime.datetime.utcnow)
    total_pieces = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    employee = relationship("Employee")
    location = relationship("Location")
    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")
