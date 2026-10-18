from sqlalchemy.orm import Session
from sqlalchemy import func, String
from datetime import datetime, date
from typing import Optional, List
from fastapi import HTTPException
from .. import models, schemas

def get_ist_today_str():
    # Return YYYY-MM-DD in UTC/local
    return datetime.utcnow().strftime("%Y-%m-%d")

def get_reconciliation_worksheet(
    db: Session,
    location_id: int,
    reconciliation_date: Optional[str] = None,
    shift_type: str = "daily"
) -> dict:
    rec_date = reconciliation_date or get_ist_today_str()
    location = db.query(models.Location).filter(models.Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="Store location not found")

    # Fetch all active products
    products = db.query(models.Product).filter(models.Product.is_active == True).order_by(models.Product.name.asc()).all()
    
    # Fetch current inventories for this location
    inventories = {
        inv.product_id: inv.quantity
        for inv in db.query(models.Inventory).filter(models.Inventory.location_id == location_id).all()
    }

    # Fetch sales today for this location
    # Sale.sale_date can be DateTime or string
    # We query sales matching this date prefix
    sales_query = db.query(
        models.SaleItem.product_id,
        func.sum(models.SaleItem.quantity).label("sold_qty")
    ).join(
        models.Sale, models.SaleItem.sale_id == models.Sale.id
    ).filter(
        models.Sale.location_id == location_id
    )
    
    # Filter by date substring
    sales_query = sales_query.filter(func.cast(models.Sale.sale_date, String).like(f"{rec_date}%"))
    sales_by_prod = {row.product_id: int(row.sold_qty or 0) for row in sales_query.group_by(models.SaleItem.product_id).all()}

    # Fetch damages today for this location
    damages_query = db.query(
        models.DamageReportItem.product_id,
        func.sum(models.DamageReportItem.quantity).label("damaged_qty")
    ).join(
        models.DamageReport, models.DamageReportItem.damage_report_id == models.DamageReport.id
    ).filter(
        models.DamageReport.location_id == location_id
    )
    damages_query = damages_query.filter(func.cast(models.DamageReport.created_at, String).like(f"{rec_date}%"))
    damages_by_prod = {row.product_id: int(row.damaged_qty or 0) for row in damages_query.group_by(models.DamageReportItem.product_id).all()}


    worksheet_items = []
    for prod in products:
        current_stock = inventories.get(prod.id, 0)
        sold = sales_by_prod.get(prod.id, 0)
        damaged = damages_by_prod.get(prod.id, 0)
        
        # Expected pieces in store right now is the current system inventory
        expected = current_stock

        worksheet_items.append({
            "product_id": prod.id,
            "product_name": prod.name,
            "index_no": prod.index_no,
            "brand": prod.brand,
            "colour": prod.colour,
            "category": prod.category,
            "sub_category": prod.sub_category,
            "case_pack": prod.case_pack or 1,
            "selling_rate": prod.selling_rate,
            "current_stock": current_stock,
            "sold_today": sold,
            "damaged_today": damaged,
            "expected_pieces": expected,
        })

    return {
        "location_id": location.id,
        "location_name": location.name,
        "reconciliation_date": rec_date,
        "shift_type": shift_type,
        "items": worksheet_items
    }

def create_shift_reconciliation(
    db: Session,
    req: schemas.ShiftReconciliationCreate,
    employee_id: int,
    user_location_id: Optional[int] = None
):
    target_location_id = req.location_id or user_location_id
    if not target_location_id:
        raise HTTPException(status_code=400, detail="Store location is required for reconciliation")

    loc = db.query(models.Location).filter(models.Location.id == target_location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Store location not found")

    total_expected = 0
    total_physical = 0
    total_variance = 0
    discrepancy_count = 0

    reconciliation_items_data = []

    for item in req.items:
        exp = int(item.expected_pieces or 0)
        phys = int(item.physical_pieces or 0)
        var = phys - exp
        if var != 0:
            discrepancy_count += 1
        
        total_expected += exp
        total_physical += phys
        total_variance += var

        reconciliation_items_data.append({
            "product_id": item.product_id,
            "opening_pieces": int(item.opening_pieces or 0),
            "received_pieces": int(item.received_pieces or 0),
            "sold_pieces": int(item.sold_pieces or 0),
            "damaged_pieces": int(item.damaged_pieces or 0),
            "expected_pieces": exp,
            "physical_pieces": phys,
            "variance": var,
            "notes": item.notes
        })

    status = "balanced" if discrepancy_count == 0 else "variance_flagged"

    rec = models.ShiftReconciliation(
        reconciliation_date=req.reconciliation_date,
        shift_type=req.shift_type or "daily",
        location_id=target_location_id,
        employee_id=employee_id,
        status=status,
        total_expected_pieces=total_expected,
        total_physical_pieces=total_physical,
        total_variance=total_variance,
        discrepancy_items_count=discrepancy_count,
        inventory_adjusted=1 if req.auto_adjust_inventory else 0,
        notes=req.notes,
        created_at=datetime.utcnow()
    )
    db.add(rec)
    db.flush()

    for item_data in reconciliation_items_data:
        item_obj = models.ReconciliationItem(
            reconciliation_id=rec.id,
            **item_data
        )
        db.add(item_obj)

        # If auto-adjust inventory is enabled and variance != 0
        if req.auto_adjust_inventory and item_data["variance"] != 0:
            inv = db.query(models.Inventory).filter(
                models.Inventory.product_id == item_data["product_id"],
                models.Inventory.location_id == target_location_id
            ).first()

            if not inv:
                inv = models.Inventory(
                    product_id=item_data["product_id"],
                    location_id=target_location_id,
                    quantity=item_data["physical_pieces"],
                    last_updated=datetime.utcnow()
                )
                db.add(inv)
                db.flush()
            else:
                inv.quantity = item_data["physical_pieces"]
                inv.last_updated = datetime.utcnow()

            # Record audit transaction
            trans = models.InventoryTransaction(
                inventory_id=inv.id,
                quantity_change=item_data["variance"],
                transaction_type="reconciliation_adjustment",
                reference_id=rec.id,
                reference_type="shift_reconciliation",
                performed_by=employee_id,
                performed_at=datetime.utcnow(),
                notes=f"Reconciliation ({req.shift_type}) sync: variance {item_data['variance']:+d} pcs (set to {item_data['physical_pieces']})"
            )
            db.add(trans)

    db.commit()
    db.refresh(rec)
    return enrich_reconciliation(db, rec)

def enrich_reconciliation(db: Session, rec: models.ShiftReconciliation):
    if not rec:
        return None
    
    loc = db.query(models.Location).filter(models.Location.id == rec.location_id).first()
    emp = db.query(models.Employee).filter(models.Employee.id == rec.employee_id).first()
    ver = db.query(models.Employee).filter(models.Employee.id == rec.verified_by).first() if rec.verified_by else None

    # Load items with product metadata
    items_enriched = []
    for item in rec.items:
        prod = item.product
        items_enriched.append({
            "id": item.id,
            "reconciliation_id": item.reconciliation_id,
            "product_id": item.product_id,
            "product_name": prod.name if prod else f"Product #{item.product_id}",
            "index_no": prod.index_no if prod else None,
            "brand": prod.brand if prod else None,
            "colour": prod.colour if prod else None,
            "category": prod.category if prod else None,
            "sub_category": prod.sub_category if prod else None,
            "case_pack": prod.case_pack if prod else 1,
            "selling_rate": prod.selling_rate if prod else None,
            "opening_pieces": item.opening_pieces,
            "received_pieces": item.received_pieces,
            "sold_pieces": item.sold_pieces,
            "damaged_pieces": item.damaged_pieces,
            "expected_pieces": item.expected_pieces,
            "physical_pieces": item.physical_pieces,
            "variance": item.variance,
            "notes": item.notes
        })

    return {
        "id": rec.id,
        "reconciliation_date": rec.reconciliation_date,
        "shift_type": rec.shift_type,
        "location_id": rec.location_id,
        "location_name": loc.name if loc else "Unknown",
        "employee_id": rec.employee_id,
        "employee_name": emp.name if emp else "Unknown",
        "status": rec.status,
        "total_expected_pieces": rec.total_expected_pieces,
        "total_physical_pieces": rec.total_physical_pieces,
        "total_variance": rec.total_variance,
        "discrepancy_items_count": rec.discrepancy_items_count,
        "inventory_adjusted": rec.inventory_adjusted,
        "notes": rec.notes,
        "verified_by": rec.verified_by,
        "verifier_name": ver.name if ver else None,
        "verified_at": rec.verified_at,
        "verification_notes": rec.verification_notes,
        "created_at": rec.created_at,
        "items": items_enriched
    }

def get_reconciliations(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    location_id: Optional[int] = None,
    employee_id: Optional[int] = None,
    shift_type: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    query = db.query(models.ShiftReconciliation)

    if location_id:
        query = query.filter(models.ShiftReconciliation.location_id == location_id)
    if employee_id:
        query = query.filter(models.ShiftReconciliation.employee_id == employee_id)
    if shift_type and shift_type != "all":
        query = query.filter(models.ShiftReconciliation.shift_type == shift_type)
    if status and status != "all":
        query = query.filter(models.ShiftReconciliation.status == status)
    if date_from:
        query = query.filter(models.ShiftReconciliation.reconciliation_date >= date_from)
    if date_to:
        query = query.filter(models.ShiftReconciliation.reconciliation_date <= date_to)

    total_records = query.count()
    records = query.order_by(models.ShiftReconciliation.created_at.desc()).offset(skip).limit(limit).all()

    return {
        "total": total_records,
        "reconciliations": [enrich_reconciliation(db, r) for r in records]
    }

def get_reconciliation_by_id(db: Session, rec_id: int):
    rec = db.query(models.ShiftReconciliation).filter(models.ShiftReconciliation.id == rec_id).first()
    if not rec:
        return None
    return enrich_reconciliation(db, rec)

def verify_reconciliation(
    db: Session,
    rec_id: int,
    verifier_id: int,
    notes: Optional[str] = None,
    status: str = "verified"
):
    rec = db.query(models.ShiftReconciliation).filter(models.ShiftReconciliation.id == rec_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Reconciliation record not found")
    
    rec.verified_by = verifier_id
    rec.verified_at = datetime.utcnow()
    rec.verification_notes = notes
    rec.status = status
    db.commit()
    db.refresh(rec)
    return enrich_reconciliation(db, rec)
