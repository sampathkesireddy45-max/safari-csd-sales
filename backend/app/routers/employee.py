from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models.employee import Employee
from ..models.sale import Sale
from ..models.inventory import Inventory
from ..models.product import Product
from ..models.damage_report import DamageReport
from ..models.damage_report_item import DamageReportItem
from ..utils.database import get_db
from ..utils.auth import get_current_active_user, get_current_active_admin_user
from .. import schemas, crud
from datetime import datetime, timedelta

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
    existing = db.query(Employee).filter(
        (Employee.email == employee.email) | (Employee.employee_id == employee.employee_id)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Employee with this email or ID already exists")
    return crud.create_employee(db=db, employee=employee)

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
    if not reset_data.password or len(reset_data.password.strip()) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters long")
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

    today = datetime.now().date()
    start_today = datetime.combine(today, datetime.min.time())
    end_today = datetime.combine(today, datetime.max.time())

    todays_sales = db.query(Sale).filter(
        Sale.employee_id == employee_id,
        Sale.sale_date >= start_today,
        Sale.sale_date <= end_today
    ).with_entities(
        func.sum(Sale.total_pieces)
    ).scalar() or 0

    start_month = datetime.today().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if today.month == 12:
        end_month = datetime(today.year + 1, 1, 1) - timedelta(seconds=1)
    else:
        end_month = datetime(today.year, today.month + 1, 1) - timedelta(seconds=1)

    monthly_sales = db.query(Sale).filter(
        Sale.employee_id == employee_id,
        Sale.sale_date >= start_month,
        Sale.sale_date <= end_month
    ).with_entities(
        func.sum(Sale.total_pieces)
    ).scalar() or 0

    start_year = datetime.today().replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    end_year = datetime.today().replace(month=12, day=31, hour=23, minute=59, second=59, microsecond=999999)

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
            current_stock.append({
                "id": inventory.id,
                "product_id": product.id,
                "product_name": product.name,
                "index_no": product.index_no,
                "selling_rate": product.selling_rate,
                "rate_per_pc": product.rate_per_pc,
                "quantity": inventory.quantity
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
