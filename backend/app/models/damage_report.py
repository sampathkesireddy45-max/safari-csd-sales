from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from ..utils.database import Base
import datetime

class DamageReport(Base):
    __tablename__ = "damage_reports"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False, index=True)
    report_date = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    status = Column(String, default="pending", index=True)  # pending, approved, rejected, resolved
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    employee = relationship("Employee", lazy="joined")
    location = relationship("Location", lazy="joined")
    items = relationship("DamageReportItem", back_populates="damage_report", cascade="all, delete-orphan", lazy="selectin")
    photos = relationship("DamagePhoto", back_populates="damage_report", cascade="all, delete-orphan", lazy="selectin")
