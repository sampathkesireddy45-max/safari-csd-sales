from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class DamagePhotoBase(BaseModel):
    photo_url: str
    storage_key: Optional[str] = None
    original_filename: Optional[str] = None
    mime_type: Optional[str] = None
    file_size: Optional[int] = None

class DamagePhotoCreate(DamagePhotoBase):
    pass

class DamagePhotoInDBBase(DamagePhotoBase):
    id: int
    damage_report_id: int
    uploaded_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True

class DamagePhoto(DamagePhotoInDBBase):
    pass
