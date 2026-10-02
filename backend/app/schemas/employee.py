from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class EmployeeBase(BaseModel):
    employee_id: str
    firebase_uid: Optional[str] = None
    name: str
    email: EmailStr
    phone: Optional[str] = None
    role: Optional[str] = 'employee'  # employee or admin
    status: Optional[str] = 'active'
    assigned_location_id: Optional[int] = None
    current_latitude: Optional[float] = None
    current_longitude: Optional[float] = None
    location_updated_at: Optional[datetime] = None

class EmployeeCreate(EmployeeBase):
    password: Optional[str] = "safari123"

class EmployeeUpdate(BaseModel):
    employee_id: Optional[str] = None
    firebase_uid: Optional[str] = None
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    assigned_location_id: Optional[int] = None
    password: Optional[str] = None
    current_latitude: Optional[float] = None
    current_longitude: Optional[float] = None

class LiveLocationUpdate(BaseModel):
    latitude: float
    longitude: float

class EmployeePasswordReset(BaseModel):
    password: str

class EmployeeInDBBase(EmployeeBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True

class Employee(EmployeeInDBBase):
    pass