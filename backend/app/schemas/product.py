from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ProductBase(BaseModel):
    product_id: str
    index_no: Optional[str] = None
    name: str
    description: Optional[str] = None
    rate_per_pc: Optional[float] = None
    selling_rate: Optional[float] = None
    is_active: Optional[bool] = True

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    product_id: Optional[str] = None
    index_no: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    rate_per_pc: Optional[float] = None
    selling_rate: Optional[float] = None
    is_active: Optional[bool] = None

class ProductInDBBase(ProductBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

class Product(ProductInDBBase):
    pass
