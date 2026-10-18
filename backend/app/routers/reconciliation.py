import csv
import io
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from .. import schemas, crud, models
from ..utils.database import get_db
from ..utils.auth import get_current_active_user, get_current_active_admin_user

router = APIRouter(
    prefix="/reconciliation",
    tags=["reconciliation"],
    responses={404: {"description": "Not found"}},
)

@router.get("/worksheet")
def get_worksheet(
    location_id: Optional[int] = Query(None),
    reconciliation_date: Optional[str] = Query(None),
    shift_type: str = Query("daily"),
    db: Session = Depends(get_db),
    current_user: models.Employee = Depends(get_current_active_user)
):
    """
    Generate live physical reconciliation worksheet for store counter.
    Shows current recorded stock, sales today, damages today, and expected pieces.
    """
    target_location_id = location_id
    if current_user.role != "admin":
        if not current_user.assigned_location_id:
            raise HTTPException(
                status_code=400,
                detail="You have no assigned retail store location. Contact admin to assign your counter."
            )
        target_location_id = current_user.assigned_location_id
    else:
        if not target_location_id:
            # Default to first location if admin didn't pick
            first_loc = db.query(models.Location).first()
            if not first_loc:
                raise HTTPException(status_code=404, detail="No store locations found")
            target_location_id = first_loc.id

    return crud.get_reconciliation_worksheet(
        db=db,
        location_id=target_location_id,
        reconciliation_date=reconciliation_date,
        shift_type=shift_type
    )

@router.post("/submit")
def submit_reconciliation(
    req: schemas.ShiftReconciliationCreate,
    db: Session = Depends(get_db),
    current_user: models.Employee = Depends(get_current_active_user)
):
    """
    Submit daily shift opening or closing stock reconciliation.
    Computes variance per item. If auto_adjust_inventory is True, live store stock is updated
    and an audit InventoryTransaction is created.
    """
    if current_user.role != "admin":
        if not current_user.assigned_location_id:
            raise HTTPException(
                status_code=400,
                detail="You have no assigned retail store location. Contact admin to assign your counter."
            )
        # Ensure employee submits for their own location
        req.location_id = current_user.assigned_location_id
    else:
        if not req.location_id:
            raise HTTPException(status_code=400, detail="Admin must specify target store location_id")

    return crud.create_shift_reconciliation(
        db=db,
        req=req,
        employee_id=current_user.id,
        user_location_id=current_user.assigned_location_id
    )

@router.get("/history")
def list_reconciliations(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    location_id: Optional[int] = Query(None),
    employee_id: Optional[int] = Query(None),
    shift_type: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.Employee = Depends(get_current_active_user)
):
    """
    Retrieve past shift reconciliations.
    Employees see reconciliations for their counter; Admins see system-wide reconciliations with filters.
    """
    target_loc = location_id
    target_emp = employee_id

    if current_user.role != "admin":
        if current_user.assigned_location_id:
            target_loc = current_user.assigned_location_id
        else:
            target_emp = current_user.id

    return crud.get_reconciliations(
        db=db,
        skip=skip,
        limit=limit,
        location_id=target_loc,
        employee_id=target_emp,
        shift_type=shift_type,
        status=status_filter,
        date_from=date_from,
        date_to=date_to
    )

@router.get("/export/csv")
def export_reconciliations_csv(
    location_id: Optional[int] = Query(None),
    shift_type: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.Employee = Depends(get_current_active_user)
):
    """
    Export reconciliations to CSV with full audit details and variance counts.
    """
    target_loc = location_id
    if current_user.role != "admin":
        target_loc = current_user.assigned_location_id

    data = crud.get_reconciliations(
        db=db,
        skip=0,
        limit=2000,
        location_id=target_loc,
        shift_type=shift_type,
        status=status_filter,
        date_from=date_from,
        date_to=date_to
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID",
        "Date",
        "Shift",
        "Store Location",
        "Submitted By",
        "Status",
        "Expected Pcs",
        "Physical Pcs",
        "Total Variance",
        "Items with Variance",
        "Inventory Auto-Adjusted",
        "Verified By",
        "Verification Notes",
        "Submission Timestamp",
    ])

    for r in data.get("reconciliations", []):
        writer.writerow([
            r.get("id"),
            r.get("reconciliation_date"),
            r.get("shift_type", "").capitalize(),
            r.get("location_name"),
            r.get("employee_name"),
            r.get("status"),
            r.get("total_expected_pieces", 0),
            r.get("total_physical_pieces", 0),
            f"{r.get('total_variance', 0):+d}",
            r.get("discrepancy_items_count", 0),
            "Yes" if r.get("inventory_adjusted") else "No",
            r.get("verifier_name") or "Unverified",
            r.get("verification_notes") or "",
            r.get("created_at").isoformat() if r.get("created_at") else "",
        ])

    output.seek(0)
    csv_content = "\ufeff" + output.getvalue()
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=stock_reconciliations.csv"},
    )

@router.get("/{reconciliation_id}")
def get_reconciliation(
    reconciliation_id: int,
    db: Session = Depends(get_db),
    current_user: models.Employee = Depends(get_current_active_user)
):
    """
    Get full breakdown of a single reconciliation including all audited products and variance per SKU.
    """
    rec = crud.get_reconciliation_by_id(db=db, rec_id=reconciliation_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Reconciliation not found")

    if current_user.role != "admin":
        if rec["location_id"] != current_user.assigned_location_id and rec["employee_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to view this reconciliation")

    return rec

@router.post("/{reconciliation_id}/verify")
def verify_reconciliation_audit(
    reconciliation_id: int,
    req: schemas.ShiftReconciliationVerifyRequest,
    db: Session = Depends(get_db),
    current_user: models.Employee = Depends(get_current_active_admin_user)
):
    """
    Admin verification & approval endpoint for shift reconciliations.
    """
    return crud.verify_reconciliation(
        db=db,
        rec_id=reconciliation_id,
        verifier_id=current_user.id,
        notes=req.verification_notes,
        status=req.status or "verified"
    )
