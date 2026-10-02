from sqlalchemy.orm import Session
from .. import models, schemas
import datetime

def enrich_damage_report(report: models.DamageReport):
    if not report:
        return None
    # Attach dynamic display names
    if hasattr(report, "employee") and report.employee:
        report.employee_name = report.employee.name
        report.employee_code = report.employee.employee_id
    else:
        report.employee_name = "Unknown"
        report.employee_code = "N/A"

    if hasattr(report, "location") and report.location:
        report.location_name = report.location.name
    else:
        report.location_name = "Unassigned"

    if hasattr(report, "items"):
        for item in report.items:
            if hasattr(item, "product") and item.product:
                item.product_name = item.product.name
            else:
                item.product_name = f"Product #{item.product_id}"
    return report

def get_damage_report(db: Session, damage_report_id: int):
    report = db.query(models.DamageReport).filter(models.DamageReport.id == damage_report_id).first()
    return enrich_damage_report(report)

def get_damage_reports(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    employee_id: int = None,
    location_id: int = None,
    date_from: str = None,
    date_to: str = None,
    has_photo: str = None,  # "all", "with_photo", "without_photo"
    status: str = "active"  # "active" (excludes replaced), "replaced", "all"
):
    query = db.query(models.DamageReport)

    if status == "active":
        query = query.filter(models.DamageReport.status != "replaced")
    elif status == "replaced":
        query = query.filter(models.DamageReport.status == "replaced")

    if employee_id:
        query = query.filter(models.DamageReport.employee_id == employee_id)
    if location_id:
        query = query.filter(models.DamageReport.location_id == location_id)

    if date_from:
        try:
            d_from = datetime.datetime.fromisoformat(date_from)
            query = query.filter(models.DamageReport.report_date >= d_from)
        except Exception:
            pass

    if date_to:
        try:
            d_to = datetime.datetime.fromisoformat(date_to)
            query = query.filter(models.DamageReport.report_date <= d_to)
        except Exception:
            pass

    if has_photo == "with_photo":
        query = query.filter(models.DamageReport.photos.any())
    elif has_photo == "without_photo":
        query = query.filter(~models.DamageReport.photos.any())

    reports = query.order_by(models.DamageReport.report_date.desc()).offset(skip).limit(limit).all()
    return [enrich_damage_report(r) for r in reports]

def mark_damage_report_as_replaced(db: Session, damage_report_id: int, user_id: int = None):
    report = db.query(models.DamageReport).filter(models.DamageReport.id == damage_report_id).first()
    if not report:
        return None
    report.status = "replaced"

    # Audit log
    audit = models.DamagePhotoAuditLog(
        user_id=user_id or 1,
        damage_report_id=damage_report_id,
        action="replaced"
    )
    db.add(audit)
    db.commit()
    db.refresh(report)
    return enrich_damage_report(report)

def create_damage_report(db: Session, damage_report: schemas.DamageReportCreate, current_user_id: int = None):
    db_damage_report = models.DamageReport(
        employee_id=damage_report.employee_id,
        location_id=damage_report.location_id,
        report_date=damage_report.report_date or datetime.datetime.utcnow(),
        status=damage_report.status or "pending"
    )
    db.add(db_damage_report)
    db.commit()
    db.refresh(db_damage_report)

    # Create damage report items
    for item in (damage_report.items or []):
        db_damage_report_item = models.DamageReportItem(
            damage_report_id=db_damage_report.id,
            product_id=item.product_id,
            quantity=item.quantity,
            description=item.description
        )
        db.add(db_damage_report_item)

    # Create damage photos
    for photo in (damage_report.photos or []):
        db_damage_photo = models.DamagePhoto(
            damage_report_id=db_damage_report.id,
            photo_url=photo.photo_url,
            storage_key=photo.storage_key,
            original_filename=photo.original_filename,
            mime_type=photo.mime_type,
            file_size=photo.file_size,
        )
        db.add(db_damage_photo)
        db.flush()

        # Audit log for uploaded photo
        audit = models.DamagePhotoAuditLog(
            user_id=current_user_id or damage_report.employee_id,
            damage_report_id=db_damage_report.id,
            photo_id=db_damage_photo.id,
            action="uploaded"
        )
        db.add(audit)

    db.commit()
    db.refresh(db_damage_report)
    return enrich_damage_report(db_damage_report)

def update_damage_report(db: Session, damage_report_id: int, damage_report: schemas.DamageReportUpdate):
    db_damage_report = db.query(models.DamageReport).filter(models.DamageReport.id == damage_report_id).first()
    if db_damage_report:
        update_data = damage_report.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_damage_report, key, value)
        db.commit()
        db.refresh(db_damage_report)
    return enrich_damage_report(db_damage_report)

def delete_damage_report(db: Session, damage_report_id: int):
    db_damage_report = db.query(models.DamageReport).filter(models.DamageReport.id == damage_report_id).first()
    if db_damage_report:
        db.delete(db_damage_report)
        db.commit()
    return db_damage_report
