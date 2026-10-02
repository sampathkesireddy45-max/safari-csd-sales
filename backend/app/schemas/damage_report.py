from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from .damage_photo import DamagePhoto, DamagePhotoCreate

class DamageReportItemBase(BaseModel):
    product_id: int
    quantity: int
    description: Optional[str] = None

class DamageReportItemCreate(DamageReportItemBase):
    pass

class DamageReportItemInDBBase(DamageReportItemBase):
    id: int
    damage_report_id: int
    product_name: Optional[str] = None

    class Config:
        orm_mode = True
        from_attributes = True

class DamageReportItem(DamageReportItemInDBBase):
    pass

class DamageReportBase(BaseModel):
    employee_id: Optional[int] = None
    location_id: Optional[int] = None
    report_date: Optional[datetime] = None
    status: Optional[str] = "pending"

class DamageReportCreate(DamageReportBase):
    items: List[DamageReportItemCreate]
    photos: Optional[List[DamagePhotoCreate]] = []

class DamageReportUpdate(BaseModel):
    employee_id: Optional[int] = None
    location_id: Optional[int] = None
    report_date: Optional[datetime] = None
    status: Optional[str] = None

class DamageReportInDBBase(DamageReportBase):
    id: int
    created_at: datetime
    employee_name: Optional[str] = None
    employee_code: Optional[str] = None
    location_name: Optional[str] = None

    class Config:
        orm_mode = True
        from_attributes = True

class DamageReport(DamageReportInDBBase):
    items: List[DamageReportItem] = []
    photos: List[DamagePhoto] = []
