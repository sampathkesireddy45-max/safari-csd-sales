from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class StockTransferCreate(BaseModel):
    from_location_id: int
    to_location_id: int
    product_id: int
    quantity: int
    auto_dispatch: Optional[bool] = False  # If True, mark as IN_TRANSIT immediately; if False, PENDING_DISPATCH for store staff
    notes: Optional[str] = None

class StockTransferResponse(BaseModel):
    id: int
    transfer_number: str
    from_location_id: int
    from_location_name: Optional[str] = None
    to_location_id: int
    to_location_name: Optional[str] = None
    product_id: int
    product_name: Optional[str] = None
    product_index: Optional[str] = None
    quantity: int
    case_pack: Optional[int] = 1
    cases: Optional[int] = 0
    remainder_pieces: Optional[int] = 0
    cases_display: Optional[str] = None
    status: str
    initiated_by_id: int
    initiated_by_name: Optional[str] = None
    sent_by_id: Optional[int] = None
    sent_by_name: Optional[str] = None
    sent_at: Optional[datetime] = None
    received_by_id: Optional[int] = None
    received_by_name: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    received_at: Optional[datetime] = None

    class Config:
        orm_mode = True
        from_attributes = True
