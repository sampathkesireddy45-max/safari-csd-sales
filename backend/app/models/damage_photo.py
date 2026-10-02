from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from ..utils.database import Base
import datetime

class DamagePhoto(Base):
    __tablename__ = "damage_photos"

    id = Column(Integer, primary_key=True, index=True)
    damage_report_id = Column(Integer, ForeignKey("damage_reports.id"), nullable=False)
    photo_url = Column(String, nullable=False)  # Serving URL or endpoint
    storage_key = Column(String, nullable=True)  # Storage filename / unique identifier
    original_filename = Column(String, nullable=True)
    mime_type = Column(String, nullable=True)
    file_size = Column(Integer, nullable=True)  # File size in bytes
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    damage_report = relationship("DamageReport", back_populates="photos")
