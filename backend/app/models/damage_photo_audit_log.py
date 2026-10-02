from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from ..utils.database import Base
import datetime

class DamagePhotoAuditLog(Base):
    __tablename__ = "damage_photo_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    damage_report_id = Column(Integer, ForeignKey("damage_reports.id"), nullable=False)
    photo_id = Column(Integer, nullable=True)
    action = Column(String, nullable=False)  # uploaded, replaced, removed
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    user = relationship("Employee")
    damage_report = relationship("DamageReport")
