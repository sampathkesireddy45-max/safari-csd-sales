import csv
import io
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query, Response
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional, List

from .. import schemas, crud, models
from ..models.employee import Employee
from ..models.damage_report import DamageReport
from ..models.damage_photo import DamagePhoto
from ..models.damage_photo_audit_log import DamagePhotoAuditLog
from ..utils.database import get_db
from ..utils.auth import get_current_active_user, get_current_active_admin_user
from ..utils.photo_storage import validate_and_process_photo, get_photo_path, delete_photo_file

router = APIRouter(
    prefix="/damages",
    tags=["damages"],
    responses={404: {"description": "Not found"}},
)

# --- 1. Photo Upload (Dedicated endpoint for progress bar & preview) ---
@router.post("/upload-photo")
async def upload_damage_photo(
    file: UploadFile = File(...),
    current_user: Employee = Depends(get_current_active_user)
):
    """
    Validates uploaded damage photograph:
    - Verifies file integrity, mime-type, and magic bytes via Pillow
    - Rejects invalid formats (only JPG, PNG, WEBP allowed)
    - Compresses and strips unnecessary EXIF metadata
    - Returns storage metadata
    """
    contents = await file.read()
    metadata = validate_and_process_photo(contents, original_filename=file.filename)
    return {
        "message": "Photo uploaded and processed successfully",
        **metadata
    }

# --- 2. Create Damage Report ---
@router.post("/", response_model=schemas.DamageReport)
def create_damage_report(
    damage_report: schemas.DamageReportCreate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user)
):
    # Enforce mandatory damage photo for employees
    if current_user.role != "admin":
        if not damage_report.photos or len(damage_report.photos) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Damage photograph is strictly mandatory. Employees cannot submit damage reports without uploading a photo."
            )

    # Enforce current user as reporter
    damage_report.employee_id = current_user.id
    if not damage_report.location_id and current_user.assigned_location_id:
        damage_report.location_id = current_user.assigned_location_id
    elif not damage_report.location_id:
        # Default to first active location if unassigned
        loc = db.query(models.Location).filter(models.Location.is_active == True).first()
        damage_report.location_id = loc.id if loc else 1

    return crud.create_damage_report(db=db, damage_report=damage_report, current_user_id=current_user.id)

# --- 3. Read Damage Reports with Filters ---
@router.get("/", response_model=list[schemas.DamageReport])
def read_damage_reports(
    skip: int = 0,
    limit: int = 100,
    employee_id: Optional[int] = Query(None),
    location_id: Optional[int] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    has_photo: Optional[str] = Query("all"),  # "all", "with_photo", "without_photo"
    status: Optional[str] = Query("active"),  # "active" (excludes replaced), "replaced", "all"
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user)
):
    target_emp_id = employee_id
    if current_user.role != "admin":
        # Employees strictly restricted to their own damage reports
        target_emp_id = current_user.id

    return crud.get_damage_reports(
        db,
        skip=skip,
        limit=limit,
        employee_id=target_emp_id,
        location_id=location_id,
        date_from=date_from,
        date_to=date_to,
        has_photo=has_photo,
        status=status
    )

# --- 4. Secure Photo Serving (Strict Authorization Check) ---
@router.get("/photos/file/{storage_key}")
def serve_damage_photo_file(
    storage_key: str,
    download: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user)
):
    """
    Secure photo viewer/download endpoint:
    - Admin can view authorized photos
    - Employee can ONLY view photos attached to their own damage records
    - Other employees receive 403 Forbidden
    """
    photo_record = db.query(DamagePhoto).filter(DamagePhoto.storage_key == storage_key).first()
    if not photo_record:
        # Check by id fallback
        if storage_key.isdigit():
            photo_record = db.query(DamagePhoto).filter(DamagePhoto.id == int(storage_key)).first()

    if not photo_record:
        raise HTTPException(status_code=404, detail="Photo record not found")

    report = photo_record.damage_report
    if not report:
        raise HTTPException(status_code=404, detail="Associated damage report not found")

    # Strict privacy check
    if current_user.role != "admin" and report.employee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access this damage photo"
        )

    file_path = get_photo_path(photo_record.storage_key or storage_key)
    filename = photo_record.original_filename or f"damage_photo_{photo_record.id}.jpg"

    return FileResponse(
        path=str(file_path),
        media_type=photo_record.mime_type or "image/jpeg",
        filename=filename if download else None,
        content_disposition_type="attachment" if download else "inline"
    )

@router.get("/photos/{photo_id}/metadata")
def get_photo_metadata(
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user)
):
    photo = db.query(DamagePhoto).filter(DamagePhoto.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    report = photo.damage_report
    if current_user.role != "admin" and report.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    return {
        "id": photo.id,
        "damage_report_id": photo.damage_report_id,
        "original_filename": photo.original_filename,
        "mime_type": photo.mime_type,
        "file_size": photo.file_size,
        "uploaded_at": photo.uploaded_at,
        "photo_url": photo.photo_url,
        "employee_name": report.employee.name if report.employee else "Unknown",
        "location_name": report.location.name if report.location else "Unknown",
        "report_date": report.report_date
    }

# --- 5. Remove Photo from Damage Report (With Audit Log) ---
@router.delete("/{damage_report_id}/photos/{photo_id}")
def remove_damage_photo(
    damage_report_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user)
):
    report = crud.get_damage_report(db, damage_report_id=damage_report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Damage report not found")

    if current_user.role != "admin" and report.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this damage report")

    photo = db.query(DamagePhoto).filter(
        DamagePhoto.id == photo_id,
        DamagePhoto.damage_report_id == damage_report_id
    ).first()

    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found on this report")

    # Record audit log
    audit = DamagePhotoAuditLog(
        user_id=current_user.id,
        damage_report_id=damage_report_id,
        photo_id=photo_id,
        action="removed"
    )
    db.add(audit)

    # Delete physical file
    if photo.storage_key:
        delete_photo_file(photo.storage_key)

    db.delete(photo)
    db.commit()
    return {"message": "Photo removed successfully and logged to audit trail"}

# --- 6. Damage Photo Audit Logs (Admin Only) ---
@router.get("/audit-logs")
def get_damage_photo_audit_logs(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_admin_user)
):
    logs = db.query(DamagePhotoAuditLog).order_by(DamagePhotoAuditLog.timestamp.desc()).offset(skip).limit(limit).all()
    results = []
    for l in logs:
        results.append({
            "id": l.id,
            "user_id": l.user_id,
            "user_name": l.user.name if l.user else f"User #{l.user_id}",
            "damage_report_id": l.damage_report_id,
            "photo_id": l.photo_id,
            "action": l.action,
            "timestamp": l.timestamp
        })
    return results

# --- 7. Export Damage Reports (Safe reference, no huge blobs) ---
@router.get("/export/csv")
def export_damages_csv(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_admin_user)
):
    reports = crud.get_damage_reports(db, skip=0, limit=1000)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Damage ID",
        "Date",
        "Employee",
        "Employee Code",
        "Location",
        "Products & Quantities",
        "Total Quantity PCS",
        "Reason / Description",
        "Photo Available",
        "Photo References"
    ])

    for r in reports:
        total_qty = sum(item.quantity for item in r.items)
        reasons = "; ".join(filter(None, [item.description for item in r.items]))
        products_summary = "; ".join([f"{item.product_name} ({item.quantity} PCS)" for item in r.items])
        has_photo = "Yes" if r.photos and len(r.photos) > 0 else "No"
        photo_refs = ", ".join([p.photo_url for p in r.photos]) if r.photos else "No photo attached"

        writer.writerow([
            r.id,
            r.report_date.strftime("%Y-%m-%d %H:%M") if r.report_date else "",
            r.employee_name,
            r.employee_code,
            r.location_name,
            products_summary,
            total_qty,
            reasons,
            has_photo,
            photo_refs
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=damage_reports_{datetime.now().strftime('%Y%m%d_%H%M')}.csv"}
    )

# --- 8. Single Damage Report & Update/Delete ---
@router.get("/{damage_report_id}", response_model=schemas.DamageReport)
def read_damage_report(damage_report_id: int, db: Session = Depends(get_db), current_user: Employee = Depends(get_current_active_user)):
    db_damage_report = crud.get_damage_report(db, damage_report_id=damage_report_id)
    if db_damage_report is None:
        raise HTTPException(status_code=404, detail="Damage report not found")
    if current_user.role != "admin" and db_damage_report.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return db_damage_report

@router.put("/{damage_report_id}", response_model=schemas.DamageReport)
def update_damage_report(damage_report_id: int, damage_report: schemas.DamageReportUpdate, db: Session = Depends(get_db), current_user: Employee = Depends(get_current_active_user)):
    db_damage_report = crud.get_damage_report(db, damage_report_id=damage_report_id)
    if db_damage_report is None:
        raise HTTPException(status_code=404, detail="Damage report not found")
    if current_user.role != "admin" and db_damage_report.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return crud.update_damage_report(db, damage_report_id=damage_report_id, damage_report=damage_report)

@router.delete("/{damage_report_id}", response_model=schemas.DamageReport)
def delete_damage_report(damage_report_id: int, db: Session = Depends(get_db), current_user: Employee = Depends(get_current_active_user)):
    db_damage_report = crud.get_damage_report(db, damage_report_id=damage_report_id)
    if db_damage_report is None:
        raise HTTPException(status_code=404, detail="Damage report not found")
    if current_user.role != "admin" and db_damage_report.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return crud.delete_damage_report(db, damage_report_id=damage_report_id)

@router.post("/{damage_report_id}/replace")
@router.put("/{damage_report_id}/replace")
def mark_damage_report_replaced(
    damage_report_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user)
):
    """
    Marks a damage report as 'replaced' and records an audit log.
    Replaced items are removed from active damages.
    """
    report = crud.damage_report.get_damage_report(db, damage_report_id=damage_report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Damage report not found")
    if current_user.role != "admin" and report.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this damage report")

    updated = crud.damage_report.mark_damage_report_as_replaced(
        db, damage_report_id=damage_report_id, user_id=current_user.id
    )
    return {
        "status": "success",
        "message": f"Damage claim #{damage_report_id} has been marked as replaced and removed from active damages.",
        "damage_report": updated
    }

