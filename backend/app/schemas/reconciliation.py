from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class ReconciliationItemCreate(BaseModel):
    product_id: int
    opening_pieces: int = 0
    received_pieces: int = 0
    sold_pieces: int = 0
    damaged_pieces: int = 0
    expected_pieces: int = 0
    physical_pieces: int = 0
    notes: Optional[str] = None

class ReconciliationItemResponse(BaseModel):
    id: int
    reconciliation_id: int
    product_id: int
    product_name: Optional[str] = None
    index_no: Optional[str] = None
    brand: Optional[str] = None
    colour: Optional[str] = None
    category: Optional[str] = None
    sub_category: Optional[str] = None
    case_pack: Optional[int] = 1
    selling_rate: Optional[float] = None
    opening_pieces: int
    received_pieces: int
    sold_pieces: int
    damaged_pieces: int
    expected_pieces: int
    physical_pieces: int
    variance: int
    notes: Optional[str] = None

    class Config:
        from_attributes = True

class ShiftReconciliationCreate(BaseModel):
    reconciliation_date: str = Field(..., description="Date YYYY-MM-DD")
    shift_type: str = Field(default="daily", description="'opening', 'closing', or 'daily'")
    location_id: Optional[int] = None
    auto_adjust_inventory: bool = True
    notes: Optional[str] = None
    items: List[ReconciliationItemCreate]

class ShiftReconciliationVerifyRequest(BaseModel):
    verification_notes: Optional[str] = None
    status: str = "verified"

class ShiftReconciliationResponse(BaseModel):
    id: int
    reconciliation_date: str
    shift_type: str
    location_id: int
    location_name: Optional[str] = None
    employee_id: int
    employee_name: Optional[str] = None
    status: str
    total_expected_pieces: int
    total_physical_pieces: int
    total_variance: int
    discrepancy_items_count: int
    inventory_adjusted: int
    notes: Optional[str] = None
    verified_by: Optional[int] = None
    verifier_name: Optional[str] = None
    verified_at: Optional[datetime] = None
    verification_notes: Optional[str] = None
    created_at: datetime
    items: Optional[List[ReconciliationItemResponse]] = None

    class Config:
        from_attributes = True

class WorksheetItem(BaseModel):
    product_id: int
    product_name: str
    index_no: Optional[str] = None
    brand: Optional[str] = None
    colour: Optional[str] = None
    category: Optional[str] = None
    sub_category: Optional[str] = None
    case_pack: int = 1
    selling_rate: Optional[float] = None
    current_stock: int = 0
    sold_today: int = 0
    damaged_today: int = 0
    expected_pieces: int = 0

class WorksheetResponse(BaseModel):
    location_id: int
    location_name: str
    reconciliation_date: str
    shift_type: str
    items: List[WorksheetItem]
