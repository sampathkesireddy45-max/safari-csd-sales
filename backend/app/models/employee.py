from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from ..utils.database import Base
import datetime
import bcrypt

class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String, unique=True, index=True, nullable=False)
    firebase_uid = Column(String, unique=True, index=True, nullable=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, nullable=True)
    role = Column(String, default="employee")  # employee or admin
    status = Column(String, default="active")  # active, inactive
    assigned_location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    hashed_password = Column(String, nullable=True)
    current_latitude = Column(Float, nullable=True)
    current_longitude = Column(Float, nullable=True)
    location_updated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    assigned_location = relationship("Location", back_populates="employees")

    def set_password(self, password: str):
        salt = bcrypt.gensalt()
        self.hashed_password = bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

    def verify_password(self, password: str) -> bool:
        if not self.hashed_password:
            return False
        try:
            return bcrypt.checkpw(password.encode("utf-8"), self.hashed_password.encode("utf-8"))
        except Exception:
            return self.hashed_password == password
