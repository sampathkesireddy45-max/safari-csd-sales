from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class InventoryBase(BaseModel):
    product_id: int
    location_id: int
    quantity: int = Field(0, ge=0)

class InventoryCreate(InventoryBase):
    pass

class InventoryUpdate(BaseModel):
    quantity: Optional[int] = None

class InventoryInDBBase(InventoryBase):
    id: int
    last_updated: datetime

    class Config:
        orm_mode = True

class Inventory(InventoryInDBBase):
    pass

class StockUpdateRequest(BaseModel):
    product_id: int
    location_id: Optional[int] = None
    quantity: int = Field(..., ge=0)
    mode: str = Field("set", pattern="^(set|add)$")
