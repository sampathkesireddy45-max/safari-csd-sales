from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy.orm import Session, joinedload, selectinload
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
from ..models.stock_transfer import StockTransfer
from ..models.monthly_stock import MonthlyStock
from ..models.admin_stock_audit import AdminStockAuditLog
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
    location_id: Optional[int] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None

@router.get("/sales-dashboard")
def get_employee_sales_dashboard(
    employee_id: Optional[int] = Query(None),
    location_id: Optional[str] = Query(None),
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

    start_utc = None
    end_utc = None
    if date_from and str(date_from).strip() and str(date_from).strip().lower() != "none":
        try:
            start_utc = ist_date_to_utc_bounds(str(date_from).strip(), is_end_date=False)
        except Exception:
            try:
                start_utc = datetime.fromisoformat(str(date_from).strip())
            except Exception:
                start_utc = None

    if date_to and str(date_to).strip() and str(date_to).strip().lower() != "none":
        try:
            end_utc = ist_date_to_utc_bounds(str(date_to).strip(), is_end_date=True)
        except Exception:
            try:
                end_utc = datetime.fromisoformat(str(date_to).strip()) + timedelta(days=1)
            except Exception:
                end_utc = None

    # 1. All active store locations
    all_locations = db.query(Location).filter(Location.is_active == True).order_by(Location.name).all()

    # 2. Determine target store location for individual store metrics
    selected_loc_id = None
    is_all_stores = False
    if current_user.role == "admin" and location_id is not None:
        loc_str = str(location_id).strip().lower()
        if loc_str in ["all", "0", "overall", "network"]:
            is_all_stores = True
        else:
            try:
                selected_loc_id = int(loc_str)
            except ValueError:
                selected_loc_id = employee.assigned_location_id
    else:
        # Non-admin employees are strictly confined to their assigned store counter
        selected_loc_id = employee.assigned_location_id
        is_all_stores = False

    selected_location = None
    if selected_loc_id:
        selected_location = db.query(Location).filter(Location.id == selected_loc_id).first()

    assigned_loc_name = employee.assigned_location.name if employee.assigned_location else "Not assigned"

    # 3. Employee's individual sales
    emp_sales_q = db.query(Sale).filter(Sale.employee_id == target_id).options(
        joinedload(Sale.location),
        selectinload(Sale.items).joinedload(SaleItem.product),
    )
    if start_utc:
        emp_sales_q = emp_sales_q.filter(Sale.sale_date >= start_utc)
    if end_utc:
        emp_sales_q = emp_sales_q.filter(Sale.sale_date <= end_utc)
    all_emp_sales = emp_sales_q.order_by(Sale.sale_date.desc()).all()

    emp_sales_map = {}
    for sale in all_emp_sales:
        for it in sale.items:
            pid = it.product_id
            if pid not in emp_sales_map:
                emp_sales_map[pid] = {
                    "pieces_sold": 0,
                    "transactions_count": 0,
                }
            emp_sales_map[pid]["pieces_sold"] += it.quantity
            emp_sales_map[pid]["transactions_count"] += 1

    # 4. Overall Sales (all stores combined) - single SQL aggregate query
    overall_item_q = db.query(
        SaleItem.product_id,
        func.coalesce(func.sum(SaleItem.quantity), 0)
    ).join(Sale, SaleItem.sale_id == Sale.id)
    if start_utc:
        overall_item_q = overall_item_q.filter(Sale.sale_date >= start_utc)
    if end_utc:
        overall_item_q = overall_item_q.filter(Sale.sale_date <= end_utc)
    overall_sales_map = {row[0]: int(row[1] or 0) for row in overall_item_q.group_by(SaleItem.product_id).all()}

    # 5. Store Sales (selected individual store) - single SQL aggregate query
    store_sales_map = {}
    if is_all_stores:
        store_sales_map = overall_sales_map.copy()
    elif selected_loc_id:
        store_item_q = db.query(
            SaleItem.product_id,
            func.coalesce(func.sum(SaleItem.quantity), 0)
        ).join(Sale, SaleItem.sale_id == Sale.id).filter(Sale.location_id == selected_loc_id)
        if start_utc:
            store_item_q = store_item_q.filter(Sale.sale_date >= start_utc)
        if end_utc:
            store_item_q = store_item_q.filter(Sale.sale_date <= end_utc)
        store_sales_map = {row[0]: int(row[1] or 0) for row in store_item_q.group_by(SaleItem.product_id).all()}

    # 6. Inventories
    # Overall stock across all locations
    overall_inv_rows = db.query(
        Inventory.product_id,
        func.coalesce(func.sum(Inventory.quantity), 0)
    ).group_by(Inventory.product_id).all()
    overall_stock_map = {row[0]: int(row[1] or 0) for row in overall_inv_rows}

    # Store stock for selected store
    store_stock_map = {}
    if is_all_stores:
        store_stock_map = overall_stock_map.copy()
    elif selected_loc_id:
        store_inv_rows = db.query(Inventory.product_id, Inventory.quantity).filter(
            Inventory.location_id == selected_loc_id
        ).all()
        store_stock_map = {row[0]: int(row[1] or 0) for row in store_inv_rows}

    # In-transit across entire fleet
    in_transit_rows = db.query(
        StockTransfer.product_id,
        func.coalesce(func.sum(StockTransfer.quantity), 0)
    ).filter(StockTransfer.status == "SENT").group_by(StockTransfer.product_id).all()
    overall_in_transit_map = {row[0]: int(row[1] or 0) for row in in_transit_rows}

    # Store specific transfers out and in (Only completed 'RECEIVED' transfers move physical inventory)
    store_transfer_out_map = {}
    store_transfer_in_map = {}
    store_damage_map = {}
    if selected_loc_id and not is_all_stores:
        out_rows = db.query(
            StockTransfer.product_id,
            func.coalesce(func.sum(StockTransfer.dispatched_quantity), 0)
        ).filter(
            StockTransfer.from_location_id == selected_loc_id,
            StockTransfer.status == "RECEIVED"
        ).group_by(StockTransfer.product_id).all()
        store_transfer_out_map = {row[0]: int(row[1] or 0) for row in out_rows}

        in_rows = db.query(
            StockTransfer.product_id,
            func.coalesce(func.sum(StockTransfer.received_quantity), 0)
        ).filter(
            StockTransfer.to_location_id == selected_loc_id,
            StockTransfer.status == "RECEIVED"
        ).group_by(StockTransfer.product_id).all()
        store_transfer_in_map = {row[0]: int(row[1] or 0) for row in in_rows}

        damage_rows = db.query(
            DamageReportItem.product_id,
            func.coalesce(func.sum(DamageReportItem.quantity), 0)
        ).join(
            DamageReport, DamageReportItem.damage_report_id == DamageReport.id
        ).filter(
            DamageReport.location_id == selected_loc_id,
            DamageReport.status != "replaced"
        ).group_by(DamageReportItem.product_id).all()
        store_damage_map = {row[0]: int(row[1] or 0) for row in damage_rows}

    # Fleet-wide totals for damages and transfer differences
    overall_damage_rows = db.query(
        DamageReportItem.product_id,
        func.coalesce(func.sum(DamageReportItem.quantity), 0)
    ).join(
        DamageReport, DamageReportItem.damage_report_id == DamageReport.id
    ).filter(
        DamageReport.status != "replaced"
    ).group_by(DamageReportItem.product_id).all()
    overall_damage_map = {row[0]: int(row[1] or 0) for row in overall_damage_rows}

    fleet_out_rows = db.query(
        StockTransfer.product_id,
        func.coalesce(func.sum(StockTransfer.dispatched_quantity), 0)
    ).filter(
        StockTransfer.status == "RECEIVED"
    ).group_by(StockTransfer.product_id).all()
    fleet_transfer_out_map = {row[0]: int(row[1] or 0) for row in fleet_out_rows}

    fleet_in_rows = db.query(
        StockTransfer.product_id,
        func.coalesce(func.sum(StockTransfer.received_quantity), 0)
    ).filter(
        StockTransfer.status == "RECEIVED"
    ).group_by(StockTransfer.product_id).all()
    fleet_transfer_in_map = {row[0]: int(row[1] or 0) for row in fleet_in_rows}

    products = db.query(Product).filter(Product.is_active == True).order_by(Product.index_no, Product.name).all()

    current_year_month = date_from[:7] if (date_from and len(date_from) >= 7) else to_ist(datetime.utcnow()).strftime("%Y-%m")
    monthly_records = db.query(MonthlyStock).filter(MonthlyStock.year_month == current_year_month).all()
    store_monthly_map = {ms.product_id: ms for ms in monthly_records if selected_loc_id is not None and ms.location_id == selected_loc_id}
    overall_monthly_map = {ms.product_id: ms for ms in monthly_records if ms.location_id is None}

    items = []
    # Metrics accumulators
    total_my_sold = 0
    total_my_revenue = 0.0
    total_store_opening = 0
    total_store_receiving = 0
    total_store_closing = 0
    total_store_sold = 0
    total_store_revenue = 0.0
    total_store_damaged = 0
    total_overall_opening = 0
    total_overall_receiving = 0
    total_overall_closing = 0
    total_overall_sold = 0
    total_overall_revenue = 0.0
    total_overall_damaged = 0

    low_stock_count = 0
    out_of_stock_count = 0
    overflow_stock_count = 0
    healthy_stock_count = 0
    moderate_stock_count = 0

    for p in products:
        rate = p.selling_rate if p.selling_rate is not None else (p.rate_per_pc or 0.0)
        pack = p.case_pack if p.case_pack and p.case_pack > 0 else 1

        # Individual store metrics:
        # Formula: Closing Stock = Opening Stock + Total Received In - Total Dispatched Out - Total Pieces Sold
        # Damages must be recorded separately and must NOT be subtracted from displayed Closing Stock.
        store_sold = store_sales_map.get(p.id, 0)
        store_damaged = store_damage_map.get(p.id, 0)
        store_transfer_out = store_transfer_out_map.get(p.id, 0)
        store_transfer_in = store_transfer_in_map.get(p.id, 0)

        ms_store = store_monthly_map.get(p.id)
        if ms_store and ms_store.is_receiving_manually_edited and ms_store.manual_receiving_stock is not None:
            store_receiving = ms_store.manual_receiving_stock
        else:
            store_receiving = store_transfer_in

        if ms_store:
            store_opening = ms_store.opening_stock
            if ms_store.is_closing_manually_edited and ms_store.manual_closing_stock is not None:
                store_closing = ms_store.manual_closing_stock
            else:
                store_closing = max(0, store_opening + store_receiving - store_transfer_out - store_sold)
        else:
            store_opening = max(0, store_stock_map.get(p.id, 0) + store_sold + store_transfer_out - store_receiving)
            store_closing = max(0, store_opening + store_receiving - store_transfer_out - store_sold)

        s_rev = round(store_sold * rate, 2)

        # Overall network metrics:
        overall_sold = overall_sales_map.get(p.id, 0)
        overall_damaged = overall_damage_map.get(p.id, 0)
        overall_t_out = fleet_transfer_out_map.get(p.id, 0)
        overall_t_in = fleet_transfer_in_map.get(p.id, 0)

        ms_overall = overall_monthly_map.get(p.id)
        if ms_overall and ms_overall.is_receiving_manually_edited and ms_overall.manual_receiving_stock is not None:
            overall_receiving = ms_overall.manual_receiving_stock
        else:
            overall_receiving = overall_t_in

        if ms_overall:
            overall_opening = ms_overall.opening_stock
            if ms_overall.is_closing_manually_edited and ms_overall.manual_closing_stock is not None:
                overall_closing = ms_overall.manual_closing_stock
            else:
                overall_closing = max(0, overall_opening + overall_receiving - overall_t_out - overall_sold)
        else:
            overall_opening = max(0, overall_stock_map.get(p.id, 0) + overall_sold + overall_t_out - overall_receiving)
            overall_closing = max(0, overall_opening + overall_receiving - overall_t_out - overall_sold)

        o_rev = round(overall_sold * rate, 2)

        # Employee's individual sales
        emp_info = emp_sales_map.get(p.id, {"pieces_sold": 0, "transactions_count": 0})
        my_sold = emp_info["pieces_sold"]
        my_rev = round(my_sold * rate, 2)

        # Automated color-coded safety level evaluation:
        # - Out of Stock: 0 Pieces (check_stock <= 0)
        # - Low Stock: <= 1 Case Pack (0 < check_stock <= pack)
        # - Healthy: > 2 Cases (check_stock > 2 * pack)
        # - Moderate: 1-2 Cases (pack < check_stock <= 2 * pack)
        check_stock = store_closing
        if check_stock <= 0:
            status_tag = "out_of_stock"
            out_of_stock_count += 1
        elif check_stock <= pack:
            status_tag = "low_stock"
            low_stock_count += 1
        elif check_stock > 15:
            status_tag = "overstock"
            overflow_stock_count += 1
        elif check_stock > 2 * pack:
            status_tag = "healthy"
            healthy_stock_count += 1
        else:
            status_tag = "moderate"
            moderate_stock_count += 1

        total_my_sold += my_sold
        total_my_revenue = round(total_my_revenue + my_rev, 2)

        total_store_opening += store_opening
        total_store_receiving += store_receiving
        total_store_closing += store_closing
        total_store_sold += store_sold
        total_store_revenue = round(total_store_revenue + s_rev, 2)

        total_overall_opening += overall_opening
        total_overall_receiving += overall_receiving
        total_overall_closing += overall_closing
        total_overall_sold += overall_sold
        total_overall_revenue = round(total_overall_revenue + o_rev, 2)

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

            # Employee Individual Sales
            "my_pieces_sold": my_sold,
            "my_cases_sold": round(my_sold / pack, 2),
            "my_revenue": my_rev,
            "transactions_count": emp_info["transactions_count"],

            # Individual Store Stock & Sales (for active/selected store)
            "store_opening_stock": store_opening,
            "store_receiving_stock": store_receiving,
            "store_closing_stock": store_closing,
            "store_closing_cases": store_closing // pack,
            "store_closing_remainder": store_closing % pack,
            "store_pieces_sold": store_sold,
            "store_cases_sold": round(store_sold / pack, 2),
            "store_revenue": s_rev,

            # Overall Stock & Sales (hidden from non-admin employee portal)
            "overall_opening_stock": overall_opening if current_user.role == "admin" else 0,
            "overall_receiving_stock": overall_receiving if current_user.role == "admin" else 0,
            "overall_closing_stock": overall_closing if current_user.role == "admin" else 0,
            "overall_closing_cases": (overall_closing // pack) if current_user.role == "admin" else 0,
            "overall_closing_remainder": (overall_closing % pack) if current_user.role == "admin" else 0,
            "overall_pieces_sold": overall_sold if current_user.role == "admin" else 0,
            "overall_cases_sold": round(overall_sold / pack, 2) if current_user.role == "admin" else 0,
            "overall_revenue": o_rev if current_user.role == "admin" else 0.0,

            # Backwards-compatible aliases for existing table bindings
            "pieces_sold": my_sold,
            "cases_sold": round(my_sold / pack, 2),
            "revenue": my_rev,
            "opening_stock": store_opening,
            "receiving_stock": store_receiving,
            "closing_stock": store_closing,
            "closing_cases": store_closing // pack,
            "closing_remainder": store_closing % pack,
            "status": status_tag,
            "has_sales": (my_sold > 0 or store_sold > 0),
            "store_damaged": store_damaged,
            "overall_damaged": overall_damaged if current_user.role == "admin" else 0,
        })

    items.sort(key=lambda x: (-x["store_pieces_sold"], -x["my_pieces_sold"], -x["my_revenue"], x["index_no"]))

    sales_list = []
    for s in all_emp_sales:
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

    selected_loc_name = "All Stores Combined" if is_all_stores else (selected_location.name if selected_location else "Unassigned Store")

    return {
        "employee": {
            "id": employee.id,
            "employee_id": employee.employee_id,
            "name": employee.name,
            "email": employee.email,
            "assigned_location_id": employee.assigned_location_id,
            "assigned_location_name": assigned_loc_name,
        },
        "selected_location": {
            "id": selected_location.id if selected_location else (0 if is_all_stores else None),
            "location_id": selected_location.location_id if selected_location else ("ALL" if is_all_stores else None),
            "name": selected_loc_name,
            "is_all_stores": is_all_stores,
        },
        "locations": [
            {
                "id": loc.id,
                "location_id": loc.location_id,
                "name": loc.name,
                "is_assigned": (loc.id == employee.assigned_location_id),
            }
            for loc in all_locations
        ],
        "summary": {
            # My Individual Sales
            "my_pieces_sold": total_my_sold,
            "my_revenue": total_my_revenue,
            "sales_count": len(all_emp_sales),

            # Individual Store Stock & Sales (Selected Store)
            "store_opening_stock": total_store_opening,
            "store_receiving_stock": total_store_receiving,
            "store_closing_stock": total_store_closing,
            "store_pieces_sold": total_store_sold,
            "store_revenue": total_store_revenue,

            # Overall Network Stock & Sales (hidden from non-admin employees)
            "overall_opening_stock": total_overall_opening if current_user.role == "admin" else 0,
            "overall_receiving_stock": total_overall_receiving if current_user.role == "admin" else 0,
            "overall_closing_stock": total_overall_closing if current_user.role == "admin" else 0,
            "overall_pieces_sold": total_overall_sold if current_user.role == "admin" else 0,
            "overall_revenue": total_overall_revenue if current_user.role == "admin" else 0.0,

            # Legacy compatibility fields
            "total_pieces_sold": total_my_sold,
            "total_revenue": total_my_revenue,
            "total_opening_stock": total_store_opening,
            "total_receiving_stock": total_store_receiving,
            "total_closing_stock": total_store_closing,
            "total_store_damaged": total_store_damaged,
            "total_overall_damaged": total_overall_damaged if current_user.role == "admin" else 0,

            "low_stock_count": low_stock_count,
            "out_of_stock_count": out_of_stock_count,
            "moderate_stock_count": moderate_stock_count,
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
    """
    Opening stock baseline modification is restricted to Administrators only.
    Store employees have view-only access to prevent unauthorized baseline alterations.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Access forbidden: Store counter employees cannot edit Opening Stock. Only Administrators can adjust monthly Opening Stock baselines."
        )

    target_id = current_user.id
    if current_user.role == "admin" and req.employee_id:
        target_id = req.employee_id

    employee = db.query(Employee).filter(Employee.id == target_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    target_location_id = current_user.assigned_location_id if current_user.role != "admin" else (req.location_id or employee.assigned_location_id)
    if not target_location_id:
        raise HTTPException(
            status_code=400,
            detail="Cannot update opening stock: No store location selected or assigned."
        )

    product = db.query(Product).filter(Product.id == req.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    location = db.query(Location).filter(Location.id == target_location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="Store location not found")

    # Volume sold at this store during the period
    sales_q = db.query(func.coalesce(func.sum(SaleItem.quantity), 0)).join(Sale, SaleItem.sale_id == Sale.id).filter(
        SaleItem.product_id == req.product_id,
        Sale.location_id == target_location_id,
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

    damaged_qty = db.query(func.coalesce(func.sum(DamageReportItem.quantity), 0)).join(
        DamageReport, DamageReportItem.damage_report_id == DamageReport.id
    ).filter(
        DamageReportItem.product_id == req.product_id,
        DamageReport.location_id == target_location_id,
        DamageReport.status != "replaced"
    ).scalar() or 0

    t_out = db.query(func.coalesce(func.sum(StockTransfer.dispatched_quantity), 0)).filter(
        StockTransfer.product_id == req.product_id,
        StockTransfer.from_location_id == target_location_id,
        StockTransfer.status == "RECEIVED"
    ).scalar() or 0

    t_in = db.query(func.coalesce(func.sum(StockTransfer.received_quantity), 0)).filter(
        StockTransfer.product_id == req.product_id,
        StockTransfer.to_location_id == target_location_id,
        StockTransfer.status == "RECEIVED"
    ).scalar() or 0

    # Formula: Closing Stock = Opening Stock + Total Received In - Total Dispatched Out - Total Pieces Sold
    # Damages must be recorded separately and must NOT be subtracted from displayed Closing Stock.
    min_required_opening = max(0, pieces_sold + t_out - t_in)
    if req.opening_stock < min_required_opening:
        raise HTTPException(
            status_code=400,
            detail=f"Opening stock ({req.opening_stock} PCS) cannot be less than net volume reduced by sales & transfers ({min_required_opening} PCS) for {product.name} at {location.name}."
        )

    new_closing_stock = req.opening_stock + t_in - t_out - pieces_sold

    year_month = req.date_from[:7] if (req.date_from and len(req.date_from) >= 7) else to_ist(datetime.utcnow()).strftime("%Y-%m")
    ms = db.query(MonthlyStock).filter(
        MonthlyStock.year_month == year_month,
        MonthlyStock.location_id == target_location_id,
        MonthlyStock.product_id == req.product_id
    ).first()
    if not ms:
        ms = MonthlyStock(
            year_month=year_month,
            location_id=target_location_id,
            product_id=req.product_id,
            opening_stock=req.opening_stock,
            is_closing_manually_edited=False
        )
        db.add(ms)
    else:
        ms.opening_stock = req.opening_stock
        if ms.is_closing_manually_edited and ms.manual_closing_stock is not None:
            new_closing_stock = ms.manual_closing_stock

    inv = db.query(Inventory).filter(
        Inventory.product_id == req.product_id,
        Inventory.location_id == target_location_id
    ).with_for_update().first()

    old_stock = 0
    if not inv:
        inv = Inventory(
            product_id=req.product_id,
            location_id=target_location_id,
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

def _lookup_employee(db: Session, identifier: str) -> Employee | None:
    if identifier.isdigit():
        emp = crud.get_employee(db, employee_id=int(identifier))
        if emp:
            return emp
    return db.query(Employee).filter(
        (Employee.employee_id == identifier) |
        (func.lower(Employee.employee_id) == identifier.lower())
    ).first()

@router.get("/{employee_id}", response_model=schemas.Employee)
def read_employee(employee_id: str, db: Session = Depends(get_db), current_user: Employee = Depends(get_current_active_user)):
    db_employee = _lookup_employee(db, str(employee_id))
    if db_employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    if current_user.role != "admin" and current_user.id != db_employee.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return db_employee

@router.put("/{employee_id}", response_model=schemas.Employee)
def update_employee(employee_id: str, employee: schemas.EmployeeUpdate, db: Session = Depends(get_db), current_user: Employee = Depends(get_current_active_admin_user)):
    db_employee = _lookup_employee(db, str(employee_id))
    if db_employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    return crud.update_employee(db, employee_id=db_employee.id, employee=employee)

@router.delete("/{employee_id}", response_model=schemas.Employee)
def delete_employee(employee_id: str, db: Session = Depends(get_db), current_user: Employee = Depends(get_current_active_admin_user)):
    db_employee = _lookup_employee(db, str(employee_id))
    if db_employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    if db_employee.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot remove your own admin account")
    if db_employee.role == "admin":
        raise HTTPException(status_code=403, detail="Admin accounts cannot be removed from the staff portal")
    return crud.delete_employee(db, employee_id=db_employee.id)

# --- Admin Password Reset for Staff ---
@router.post("/{employee_id}/reset-password")
def admin_reset_password(
    employee_id: str,
    reset_data: schemas.EmployeePasswordReset,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_admin_user)
):
    emp = _lookup_employee(db, str(employee_id))
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    clean_pwd = reset_data.password.strip()
    if len(clean_pwd) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters long")
    emp.set_password(clean_pwd)
    emp.status = "active"
    db.commit()
    db.refresh(emp)
    return {
        "status": "success",
        "message": f"Password updated successfully for employee {emp.employee_id} ({emp.name})",
        "employee_id": emp.employee_id,
        "name": emp.name
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


