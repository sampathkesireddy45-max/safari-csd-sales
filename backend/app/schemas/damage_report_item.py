from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class DamageReportItemBase(BaseModel):
    product_id: int
    quantity: int
    description: Optional[str] = None

class DamageReportItemCreate(DamageReportItemBase):
    pass

class DamageReportItemInDBBase(DamageReportItemBase):
    id: int
    damage_report_id: int

    class Config:
        orm_mode = True

class DamageReportItem(DamageReportItemInDBBase):
    pass

