from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models.employee import Employee
from ..models.sale import Sale
from ..models.sale_item import SaleItem
from ..models.inventory import Inventory
from ..models.inventory_transaction import InventoryTransaction
from ..models.location import Location
from ..models.product import Product
from ..models.damage_report import DamageReport
from ..models.damage_report_item import DamageReportItem
from ..utils.database import get_db
from ..utils.auth import get_current_active_user, get_current_active_admin_user
from .. import schemas, crud
from ..crud.employee import reactivate_employee
from datetime import datetime, timedelta
from ..utils.timezone import IST, ist_date_to_utc_bounds, to_ist, format_ist_date, format_ist_time, format_ist_datetime

router = APIRouter(
    prefix="/employees",
    tags=["employees"],
    responses={404: {"description": "Not found"}},
)

# --- Employee CRUD endpoints ---
@router.get("/", response_model=list[schemas.Employee])
def read_employees(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: Employee = Depends(get_current_active_user)):
    if current_user.role == "admin":
        return crud.get_employees(db, skip=skip, limit=limit)
    else:
        # Non-admin only sees themselves
        return [current_user]

@router.post("/", response_model=schemas.Employee)
def create_employee(employee: schemas.EmployeeCreate, db: Session = Depends(get_db), current_user: Employee = Depends(get_current_active_admin_user)):
    existing_by_id = db.query(Employee).filter(Employee.employee_id == employee.employee_id).first()
    existing_by_email = db.query(Employee).filter(Employee.email == employee.email).first()
    active_conflict = next(
        (record for record in (existing_by_id, existing_by_email) if record and record.status == "active"),
        None,
    )
    if active_conflict:
        raise HTTPException(status_code=400, detail="Employee with this email or ID already exists")
    if existing_by_id and existing_by_email and existing_by_id.id != existing_by_email.id:
        raise HTTPException(status_code=400, detail="The employee ID and email belong to different existing accounts")
    try:
        inactive_match = existing_by_id or existing_by_email
        if inactive_match:
            return reactivate_employee(db=db, employee=inactive_match, employee_data=employee)
        return crud.create_employee(db=db, employee=employee)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

# --- Employee Live Location Broadcast (Employee or Admin) ---
@router.post("/live-location")
def update_live_location(
    loc: schemas.LiveLocationUpdate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user)
):
    current_user.current_latitude = loc.latitude
    current_user.current_longitude = loc.longitude
    current_user.location_updated_at = datetime.utcnow()
    db.commit()
    db.refresh(current_user)
    return {
        "status": "success",
        "employee_id": current_user.employee_id,
        "latitude": current_user.current_latitude,
        "longitude": current_user.current_longitude,
        "updated_at": current_user.location_updated_at
    }

# --- Admin Live Locations Telemetry Dashboard ---
@router.get("/live-locations")
def get_all_live_locations(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_admin_user)
):
    employees = db.query(Employee).all()
    now = datetime.utcnow()
    result = []
    
    for emp in employees:
        is_online = False
        minutes_ago = None
        if emp.location_updated_at:
            delta = now - emp.location_updated_at
            minutes_ago = int(delta.total_seconds() / 60)
            is_online = delta.total_seconds() <= 1800  # Online if pinged within last 30 minutes
            
        store_info = None
        if emp.assigned_location:
            store_info = {
                "id": emp.assigned_location.id,
                "location_id": emp.assigned_location.location_id,
                "name": emp.assigned_location.name,
                "address": emp.assigned_location.address,
                "latitude": emp.assigned_location.latitude,
                "longitude": emp.assigned_location.longitude,
            }
            
        result.append({
            "id": emp.id,
            "employee_id": emp.employee_id,
            "name": emp.name,
            "email": emp.email,
            "phone": emp.phone,
            "role": emp.role,
            "status": emp.status,
            "assigned_location": store_info,
            "current_latitude": emp.current_latitude,
            "current_longitude": emp.current_longitude,
            "location_updated_at": emp.location_updated_at.isoformat() if emp.location_updated_at else None,
            "is_online": is_online,
            "minutes_ago": minutes_ago
        })
    return result

class OpeningStockUpdateRequest(BaseModel):
    product_id: int
    opening_stock: int = Field(..., ge=0)
    employee_id: Optional[int] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None

@router.get("/sales-dashboard")
def get_employee_sales_dashboard(
    employee_id: Optional[int] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user)
):
    target_id = current_user.id
    if current_user.role == "admin" and employee_id:
        target_id = employee_id

    employee = db.query(Employee).filter(Employee.id == target_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    sales_q = db.query(Sale).filter(Sale.employee_id == target_id)
    if date_from:
        try:
            start_utc = ist_date_to_utc_bounds(date_from, is_end_date=False)
            sales_q = sales_q.filter(Sale.sale_date >= start_utc)
        except Exception:
            sales_q = sales_q.filter(Sale.sale_date >= datetime.fromisoformat(date_from))
    if date_to:
        try:
            end_utc = ist_date_to_utc_bounds(date_to, is_end_date=True)
            sales_q = sales_q.filter(Sale.sale_date <= end_utc)
        except Exception:
            sales_q = sales_q.filter(Sale.sale_date <= datetime.fromisoformat(date_to) + timedelta(days=1))

    all_sales = sales_q.order_by(Sale.sale_date.desc()).all()

    product_sales_map = {}
    for sale in all_sales:
        for it in sale.items:
            pid = it.product_id
            if pid not in product_sales_map:
                product_sales_map[pid] = {
                    "pieces_sold": 0,
                    "transactions_count": 0,
                }
            product_sales_map[pid]["pieces_sold"] += it.quantity
            product_sales_map[pid]["transactions_count"] += 1

    stock_map = {}
    location_name = "Not assigned"
    if employee.assigned_location:
        location_name = employee.assigned_location.name

    if employee.assigned_location_id:
        inv_rows = db.query(Inventory.product_id, Inventory.quantity).filter(
            Inventory.location_id == employee.assigned_location_id
        ).all()
        stock_map = {row[0]: int(row[1] or 0) for row in inv_rows}

    products = db.query(Product).filter(Product.is_active == True).order_by(Product.index_no, Product.name).all()

    items = []
    total_pieces_sold = 0
    total_revenue = 0.0
    total_opening_stock = 0
    total_closing_stock = 0
    low_stock_count = 0
    out_of_stock_count = 0
    overflow_stock_count = 0
    healthy_stock_count = 0

    for p in products:
        sales_info = product_sales_map.get(p.id, {"pieces_sold": 0, "transactions_count": 0})
        pieces_sold = sales_info["pieces_sold"]
        rate = p.selling_rate if p.selling_rate is not None else (p.rate_per_pc or 0.0)
        revenue = round(pieces_sold * rate, 2)
        pack = p.case_pack if p.case_pack and p.case_pack > 0 else 1

        closing_stock = stock_map.get(p.id, 0)
        opening_stock = closing_stock + pieces_sold

        if closing_stock == 0:
            status_tag = "out_of_stock"
            out_of_stock_count += 1
        elif closing_stock < 5:
            status_tag = "low_stock"
            low_stock_count += 1
        elif closing_stock > 10:
            status_tag = "overflow"
            overflow_stock_count += 1
        else:
            status_tag = "healthy"
            healthy_stock_count += 1

        total_pieces_sold += pieces_sold
        total_revenue = round(total_revenue + revenue, 2)
        total_opening_stock += opening_stock
        total_closing_stock += closing_stock

        items.append({
            "product_id": p.id,
            "index_no": p.index_no or "N/A",
            "name": p.name,
            "brand": p.brand or "SAFARI",
            "colour": p.colour or "",
            "category": p.category or "",
            "sub_category": p.sub_category or "",
            "case_pack": pack,
            "selling_rate": rate,
            "pieces_sold": pieces_sold,
            "cases_sold": round(pieces_sold / pack, 2),
            "revenue": revenue,
            "transactions_count": sales_info["transactions_count"],
            "opening_stock": opening_stock,
            "closing_stock": closing_stock,
            "closing_cases": closing_stock // pack,
            "closing_remainder": closing_stock % pack,
            "status": status_tag,
            "has_sales": pieces_sold > 0,
        })

    items.sort(key=lambda x: (-x["pieces_sold"], -x["revenue"], x["index_no"]))

    sales_list = []
    for s in all_sales:
        cost = round(sum(
            (it.product.selling_rate if (it.product and it.product.selling_rate is not None) else (it.product.rate_per_pc or 0.0) if it.product else 0.0) * it.quantity
            for it in s.items
        ), 2)
        sales_list.append({
            "id": s.id,
            "sale_date": to_ist(s.sale_date).isoformat() if s.sale_date else None,
            "formatted_date": format_ist_date(s.sale_date),
            "formatted_time": format_ist_time(s.sale_date),
            "formatted_datetime": format_ist_datetime(s.sale_date),
            "location_name": s.location.name if s.location else "Unknown",
            "total_pieces": int(s.total_pieces or 0),
            "total_cost": cost,
            "item_count": len(s.items),
            "items": [
                {
                    "product_id": it.product_id,
                    "index_no": it.product.index_no if it.product else "N/A",
                    "product_name": it.product.name if it.product else "Product",
                    "brand": it.product.brand if it.product else "",
                    "colour": it.product.colour if it.product else "",
                    "quantity": it.quantity,
                    "unit_price": it.product.selling_rate if (it.product and it.product.selling_rate is not None) else (it.product.rate_per_pc or 0.0) if it.product else 0.0,
                    "subtotal": round((it.product.selling_rate if (it.product and it.product.selling_rate is not None) else (it.product.rate_per_pc or 0.0) if it.product else 0.0) * it.quantity, 2)
                }
                for it in s.items
            ]
        })

    return {
        "employee": {
            "id": employee.id,
            "employee_id": employee.employee_id,
            "name": employee.name,
            "email": employee.email,
            "assigned_location_id": employee.assigned_location_id,
            "assigned_location_name": location_name,
        },
        "summary": {
            "total_pieces_sold": total_pieces_sold,
            "total_revenue": total_revenue,
            "sales_count": len(all_sales),
            "total_opening_stock": total_opening_stock,
            "total_closing_stock": total_closing_stock,
            "low_stock_count": low_stock_count,
            "out_of_stock_count": out_of_stock_count,
            "overflow_stock_count": overflow_stock_count,
            "healthy_stock_count": healthy_stock_count,
            "total_catalog_items": len(products),
        },
        "items": items,
        "sales": sales_list,
    }

@router.post("/sales-dashboard/opening-stock")
def update_employee_opening_stock(
    req: OpeningStockUpdateRequest,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user)
):
    target_id = current_user.id
    if current_user.role == "admin" and req.employee_id:
        target_id = req.employee_id

    employee = db.query(Employee).filter(Employee.id == target_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    if not employee.assigned_location_id:
        raise HTTPException(
            status_code=400,
            detail="You are not currently assigned to any retail store location. Contact your administrator to assign your store."
        )

    product = db.query(Product).filter(Product.id == req.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    location = db.query(Location).filter(Location.id == employee.assigned_location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="Assigned store location not found")

    sales_q = db.query(func.coalesce(func.sum(SaleItem.quantity), 0)).join(Sale, SaleItem.sale_id == Sale.id).filter(
        SaleItem.product_id == req.product_id,
        Sale.employee_id == employee.id,
    )
    if req.date_from:
        try:
            start_utc = ist_date_to_utc_bounds(req.date_from, is_end_date=False)
            sales_q = sales_q.filter(Sale.sale_date >= start_utc)
        except Exception:
            sales_q = sales_q.filter(Sale.sale_date >= datetime.fromisoformat(req.date_from))
    if req.date_to:
        try:
            end_utc = ist_date_to_utc_bounds(req.date_to, is_end_date=True)
            sales_q = sales_q.filter(Sale.sale_date <= end_utc)
        except Exception:
            sales_q = sales_q.filter(Sale.sale_date <= datetime.fromisoformat(req.date_to) + timedelta(days=1))

    pieces_sold = sales_q.scalar() or 0

    if req.opening_stock < pieces_sold:
        raise HTTPException(
            status_code=400,
            detail=f"Opening stock ({req.opening_stock} PCS) cannot be less than the volume already sold ({pieces_sold} PCS) for {product.name}."
        )

    new_closing_stock = req.opening_stock - pieces_sold

    inv = db.query(Inventory).filter(
        Inventory.product_id == req.product_id,
        Inventory.location_id == employee.assigned_location_id
    ).with_for_update().first()

    old_stock = 0
    if not inv:
        inv = Inventory(
            product_id=req.product_id,
            location_id=employee.assigned_location_id,
            quantity=new_closing_stock,
            last_updated=datetime.utcnow()
        )
        db.add(inv)
        db.flush()
    else:
        old_stock = inv.quantity
        inv.quantity = new_closing_stock
        inv.last_updated = datetime.utcnow()

    diff = new_closing_stock - old_stock
    txn = InventoryTransaction(
        inventory_id=inv.id,
        quantity_change=diff,
        transaction_type="opening_stock_edit",
        reference_type="employee_opening_stock_adjustment",
        performed_by=current_user.id
    )
    db.add(txn)
    db.commit()

    case_pack = product.case_pack or 1
    return {
        "status": "success",
        "message": f"Successfully updated opening stock for [{product.name}] to {req.opening_stock} PCS. Live closing stock is {new_closing_stock} PCS at {location.name}.",
        "product_id": product.id,
        "product_name": product.name,
        "index_no": product.index_no,
        "opening_stock": req.opening_stock,
        "closing_stock": new_closing_stock,
        "closing_cases": new_closing_stock // case_pack,
        "closing_remainder": new_closing_stock % case_pack,
        "pieces_sold": pieces_sold,
        "location_id": location.id,
        "location_name": location.name
    }

@router.get("/{employee_id}", response_model=schemas.Employee)
def read_employee(employee_id: int, db: Session = Depends(get_db), current_user: Employee = Depends(get_current_active_user)):
    if current_user.role != "admin" and current_user.id != employee_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    db_employee = crud.get_employee(db, employee_id=employee_id)
    if db_employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    return db_employee

@router.put("/{employee_id}", response_model=schemas.Employee)
def update_employee(employee_id: int, employee: schemas.EmployeeUpdate, db: Session = Depends(get_db), current_user: Employee = Depends(get_current_active_admin_user)):
    db_employee = crud.get_employee(db, employee_id=employee_id)
    if db_employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    return crud.update_employee(db, employee_id=employee_id, employee=employee)

@router.delete("/{employee_id}", response_model=schemas.Employee)
def delete_employee(employee_id: int, db: Session = Depends(get_db), current_user: Employee = Depends(get_current_active_admin_user)):
    db_employee = crud.get_employee(db, employee_id=employee_id)
    if db_employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    if db_employee.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot remove your own admin account")
    if db_employee.role == "admin":
        raise HTTPException(status_code=403, detail="Admin accounts cannot be removed from the staff portal")
    return crud.delete_employee(db, employee_id=employee_id)

# --- Admin Password Reset for Staff ---
@router.post("/{employee_id}/reset-password")
def admin_reset_password(
    employee_id: int,
    reset_data: schemas.EmployeePasswordReset,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_admin_user)
):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    if len(reset_data.password.strip()) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")
    emp.set_password(reset_data.password.strip())
    db.commit()
    return {
        "status": "success",
        "message": f"Password updated successfully for employee {emp.employee_id} ({emp.name})"
    }

# --- Employee Dashboard Statistics ---
@router.get("/dashboard/{employee_id}")
def get_employee_dashboard_stats(employee_id: int, db: Session = Depends(get_db), current_user: Employee = Depends(get_current_active_user)):
    if current_user.role != "admin" and current_user.id != employee_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    assigned_location = "Not assigned"
    if employee.assigned_location:
        assigned_location = employee.assigned_location.name

    now_ist = datetime.now(IST)
    today_ist_str = now_ist.strftime("%Y-%m-%d")
    start_today = ist_date_to_utc_bounds(today_ist_str, is_end_date=False)
    end_today = ist_date_to_utc_bounds(today_ist_str, is_end_date=True)

    todays_sales = db.query(Sale).filter(
        Sale.employee_id == employee_id,
        Sale.sale_date >= start_today,
        Sale.sale_date <= end_today
    ).with_entities(
        func.sum(Sale.total_pieces)
    ).scalar() or 0

    today = now_ist.date()
    start_month_str = today.replace(day=1).strftime("%Y-%m-%d")
    if today.month == 12:
        end_month_day = today.replace(year=today.year + 1, month=1, day=1) - timedelta(days=1)
    else:
        end_month_day = today.replace(month=today.month + 1, day=1) - timedelta(days=1)
    start_month = ist_date_to_utc_bounds(start_month_str, is_end_date=False)
    end_month = ist_date_to_utc_bounds(end_month_day.strftime("%Y-%m-%d"), is_end_date=True)

    monthly_sales = db.query(Sale).filter(
        Sale.employee_id == employee_id,
        Sale.sale_date >= start_month,
        Sale.sale_date <= end_month
    ).with_entities(
        func.sum(Sale.total_pieces)
    ).scalar() or 0

    start_year_str = f"{today.year}-01-01"
    end_year_str = f"{today.year}-12-31"
    start_year = ist_date_to_utc_bounds(start_year_str, is_end_date=False)
    end_year = ist_date_to_utc_bounds(end_year_str, is_end_date=True)

    yearly_sales = db.query(Sale).filter(
        Sale.employee_id == employee_id,
        Sale.sale_date >= start_year,
        Sale.sale_date <= end_year
    ).with_entities(
        func.sum(Sale.total_pieces)
    ).scalar() or 0

    current_stock = []
    if employee.assigned_location_id:
        stock_items = db.query(Inventory, Product).join(
            Product, Inventory.product_id == Product.id
        ).filter(
            Inventory.location_id == employee.assigned_location_id
        ).all()
        for inventory, product in stock_items:
            pack = product.case_pack or 1
            current_stock.append({
                "id": inventory.id,
                "product_id": product.id,
                "product_name": product.name,
                "index_no": product.index_no,
                "brand": product.brand,
                "colour": product.colour,
                "category": product.category,
                "sub_category": product.sub_category,
                "case_pack": pack,
                "selling_rate": product.selling_rate,
                "rate_per_pc": product.rate_per_pc,
                "quantity": inventory.quantity,
                "cases": inventory.quantity // pack,
                "remainder_pieces": inventory.quantity % pack
            })

    # Damages reported by this employee (excluding replaced)
    damages = db.query(DamageReportItem).join(DamageReport).filter(
        DamageReport.employee_id == employee_id,
        DamageReport.status != "replaced"
    ).with_entities(
        func.sum(DamageReportItem.quantity)
    ).scalar() or 0

    return {
        "assignedLocation": assigned_location,
        "assignedLocationId": employee.assigned_location_id,
        "todaysSales": int(todays_sales),
        "monthlySales": int(monthly_sales),
        "yearlySales": int(yearly_sales),
        "currentStock": current_stock,
        "damages": int(damages),
    }


