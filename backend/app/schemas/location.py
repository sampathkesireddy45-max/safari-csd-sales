from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class LocationBase(BaseModel):
    location_id: str
    name: str
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_active: Optional[bool] = True

class LocationCreate(LocationBase):
    pass

class LocationUpdate(BaseModel):
    location_id: Optional[str] = None
    name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_active: Optional[bool] = None

class LocationInDBBase(LocationBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

class Location(LocationInDBBase):
    pass

class ResolveRealLocationRequest(BaseModel):
    name: str
    address: Optional[str] = None
    latitude: float
    longitude: float
