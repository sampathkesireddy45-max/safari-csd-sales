from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class DamageReportItemBase(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)
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
