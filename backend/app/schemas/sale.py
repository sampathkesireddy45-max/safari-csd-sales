from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from . import sale_item

class SaleItemBase(BaseModel):
    product_id: int
    quantity: int

class SaleItemCreate(SaleItemBase):
    pass

class SaleItemInDBBase(SaleItemBase):
    id: int
    sale_id: int

    class Config:
        orm_mode = True

class SaleItem(SaleItemInDBBase):
    pass

class SaleBase(BaseModel):
    employee_id: int
    location_id: int
    sale_date: Optional[datetime] = None
    total_pieces: int = 0
    items: List[SaleItemCreate]

class SaleCreate(SaleBase):
    pass

class SaleUpdate(BaseModel):
    employee_id: Optional[int] = None
    location_id: Optional[int] = None
    sale_date: Optional[datetime] = None
    total_pieces: Optional[int] = None

class SaleInDBBase(SaleBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True

class Sale(SaleInDBBase):
    items: List[SaleItem]
