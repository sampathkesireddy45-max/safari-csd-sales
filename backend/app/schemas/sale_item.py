from pydantic import BaseModel
from typing import Optional
from datetime import datetime

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

