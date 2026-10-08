import csv
import io
from openpyxl import Workbook
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from .. import models, crud
from ..utils.database import get_db
from ..utils.auth import get_current_active_admin_user
from datetime import datetime, timedelta

router = APIRouter(
    prefix="/admin/dashboard",
    tags=["admin-dashboard"],
    responses={404: {"description": "Not found"}},
    dependencies=[Depends(get_current_active_admin_user)],
)

def _sale_cost(sale):
    return round(sum(
        (item.product.selling_rate if item.product and item.product.selling_rate is not None
         else item.product.rate_per_pc if item.product and item.product.rate_per_pc is not None else 0) * item.quantity
        for item in sale.items
    ), 2)

def _sales_query(db: Session, employee_id: int = None, date_from: str = None, date_to: str = None):
    query = db.query(models.Sale).join(models.Employee).join(models.Location)
    if employee_id:
        query = query.filter(models.Sale.employee_id == employee_id)
    if date_from:
        query = query.filter(models.Sale.sale_date >= datetime.fromisoformat(date_from))
    if date_to:
        query = query.filter(models.Sale.sale_date < datetime.fromisoformat(date_to) + timedelta(days=1))
    return query

@router.get("/sales")
def get_admin_sales_summary(
    employee_id: int = Query(None),
    date_from: str = Query(None),
    date_to: str = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    query = _sales_query(db, employee_id, date_from, date_to)
    sales = query.order_by(models.Sale.sale_date.desc()).limit(limit).all()
    all_sales = query.all()
    employee_totals = db.query(
        models.Employee.id,
        models.Employee.employee_id,
        models.Employee.name,
        func.count(models.Sale.id).label("sale_count"),
        func.coalesce(func.sum(models.Sale.total_pieces), 0).label("total_pieces"),
    ).outerjoin(models.Sale, models.Sale.employee_id == models.Employee.id)
    if employee_id:
        employee_totals = employee_totals.filter(models.Employee.id == employee_id)
    if date_from:
        employee_totals = employee_totals.filter(models.Sale.sale_date >= datetime.fromisoformat(date_from))
    if date_to:
        employee_totals = employee_totals.filter(models.Sale.sale_date < datetime.fromisoformat(date_to) + timedelta(days=1))
    employee_totals = employee_totals.group_by(models.Employee.id).order_by(func.sum(models.Sale.total_pieces).desc()).all()
    total_pieces = query.with_entities(func.coalesce(func.sum(models.Sale.total_pieces), 0)).scalar() or 0
    sales_cost = round(sum(_sale_cost(sale) for sale in all_sales), 2)
    employee_costs = {}
    for sale in all_sales:
        employee_costs[sale.employee_id] = round(employee_costs.get(sale.employee_id, 0) + _sale_cost(sale), 2)
    return {
        "overall": {"sale_count": query.count(), "total_pieces": int(total_pieces), "total_cost": sales_cost},
        "employees": [
            {"id": row.id, "employee_id": row.employee_id, "name": row.name, "sale_count": row.sale_count, "total_pieces": int(row.total_pieces or 0), "total_cost": employee_costs.get(row.id, 0)}
            for row in employee_totals if row.sale_count
        ],
        "sales": [
            {
                "id": sale.id,
                "sale_date": sale.sale_date,
                "employee_id": sale.employee_id,
                "employee_name": sale.employee.name if sale.employee else "Unknown",
                "location_name": sale.location.name if sale.location else "Unknown",
                "total_pieces": int(sale.total_pieces or 0),
                "total_cost": _sale_cost(sale),
                "item_count": len(sale.items),
            }
            for sale in sales
        ],
    }

@router.get("/sales/export")
def export_admin_sales(
    employee_id: int = Query(None),
    date_from: str = Query(None),
    date_to: str = Query(None),
    db: Session = Depends(get_db),
):
    sales = _sales_query(db, employee_id, date_from, date_to).order_by(models.Sale.sale_date.desc()).all()
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(["Sale ID", "Sale Date", "Sale Time", "Employee ID", "Employee", "Location", "Total Pieces", "Total Cost (INR)", "Line Items"])
    for sale in sales:
        sale_date = sale.sale_date.strftime("%Y-%m-%d") if sale.sale_date else ""
        sale_time = sale.sale_date.strftime("%H:%M:%S") if sale.sale_date else ""
        writer.writerow([
            sale.id,
            sale_date,
            sale_time,
            sale.employee.employee_id if sale.employee else "",
            sale.employee.name if sale.employee else "Unknown",
            sale.location.name if sale.location else "Unknown",
            sale.total_pieces or 0,
            f"{_sale_cost(sale):.2f}",
            len(sale.items),
        ])
    output.seek(0)
    csv_content = "\ufeff" + output.getvalue()
    scope = f"employee_{employee_id}" if employee_id else "overall"
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=sales_{scope}.csv"},
    )

@router.get("/sales/export/xlsx")
def export_admin_sales_xlsx(
    employee_id: int = Query(None),
    date_from: str = Query(None),
    date_to: str = Query(None),
    db: Session = Depends(get_db),
):
    sales = _sales_query(db, employee_id, date_from, date_to).order_by(models.Sale.sale_date.desc()).all()
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = "Sales"
    worksheet.append(["Sale ID", "Sale Date", "Sale Time", "Employee ID", "Employee", "Location", "Total Pieces", "Total Cost (INR)", "Line Items"])
    for sale in sales:
        worksheet.append([
            sale.id,
            sale.sale_date.date() if sale.sale_date else None,
            sale.sale_date.time().replace(microsecond=0) if sale.sale_date else None,
            sale.employee.employee_id if sale.employee else "",
            sale.employee.name if sale.employee else "Unknown",
            sale.location.name if sale.location else "Unknown",
            sale.total_pieces or 0,
            _sale_cost(sale),
            len(sale.items),
        ])
    for cell in worksheet[1]:
        cell.font = cell.font.copy(bold=True)
    worksheet.freeze_panes = "A2"
    worksheet.auto_filter.ref = worksheet.dimensions
    worksheet.column_dimensions["A"].width = 12
    worksheet.column_dimensions["B"].width = 14
    worksheet.column_dimensions["C"].width = 12
    worksheet.column_dimensions["D"].width = 14
    worksheet.column_dimensions["E"].width = 22
    worksheet.column_dimensions["F"].width = 18
    worksheet.column_dimensions["G"].width = 14
    worksheet.column_dimensions["H"].width = 18
    worksheet.column_dimensions["I"].width = 12
    for row in worksheet.iter_rows(min_row=2, min_col=2, max_col=3):
        row[0].number_format = "yyyy-mm-dd"
        row[1].number_format = "hh:mm:ss"
    for row in worksheet.iter_rows(min_row=2, min_col=8, max_col=8):
        row[0].number_format = '#,##0.00'
    output = io.BytesIO()
    workbook.save(output)
    output.seek(0)
    scope = f"employee_{employee_id}" if employee_id else "overall"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=sales_{scope}.xlsx"},
    )

@router.get("/stats")
def get_admin_dashboard_stats(db: Session = Depends(get_db)):
    # Total active employees
    total_employees = db.query(models.Employee).filter(models.Employee.status == "active").count()
    # Total active locations
    total_locations = db.query(models.Location).filter(models.Location.is_active == True).count()
    # Total active products
    total_products = db.query(models.Product).filter(models.Product.is_active == True).count()
    # Total stock across all locations
    total_stock_result = db.query(models.Inventory).with_entities(
        func.sum(models.Inventory.quantity)
    ).scalar()
    total_stock = total_stock_result if total_stock_result is not None else 0

    today = datetime.now().date()
    start_today = datetime.combine(today, datetime.min.time())
    end_today = datetime.combine(today, datetime.max.time())

    pieces_sold_today = db.query(models.Sale).filter(
        models.Sale.sale_date >= start_today,
        models.Sale.sale_date <= end_today
    ).with_entities(
        func.sum(models.Sale.total_pieces)
    ).scalar() or 0

    start_month = datetime.today().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if today.month == 12:
        end_month = datetime(today.year + 1, 1, 1) - timedelta(seconds=1)
    else:
        end_month = datetime(today.year, today.month + 1, 1) - timedelta(seconds=1)

    pieces_sold_this_month = db.query(models.Sale).filter(
        models.Sale.sale_date >= start_month,
        models.Sale.sale_date <= end_month
    ).with_entities(
        func.sum(models.Sale.total_pieces)
    ).scalar() or 0

    start_year = datetime.today().replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    end_year = datetime.today().replace(month=12, day=31, hour=23, minute=59, second=59, microsecond=999999)

    pieces_sold_this_year = db.query(models.Sale).filter(
        models.Sale.sale_date >= start_year,
        models.Sale.sale_date <= end_year
    ).with_entities(
        func.sum(models.Sale.total_pieces)
    ).scalar() or 0

    total_damaged = db.query(models.DamageReportItem).join(
        models.DamageReport, models.DamageReportItem.damage_report_id == models.DamageReport.id
    ).filter(
        models.DamageReport.status != "replaced"
    ).with_entities(
        func.sum(models.DamageReportItem.quantity)
    ).scalar() or 0

    # Recent 5 damage reports (active, not replaced)
    recent_damages_raw = db.query(models.DamageReport).filter(
        models.DamageReport.status != "replaced"
    ).order_by(models.DamageReport.report_date.desc()).limit(5).all()
    recent_damages = [crud.damage_report.enrich_damage_report(r) for r in recent_damages_raw]

    formatted_damages = []
    for r in recent_damages:
        formatted_damages.append({
            "id": r.id,
            "employee_name": r.employee_name,
            "location_name": r.location_name,
            "report_date": r.report_date,
            "total_quantity": sum(i.quantity for i in r.items),
            "reasons": "; ".join(filter(None, [i.description for i in r.items])),
            "photos_count": len(r.photos),
            "photos": [
                {
                    "id": p.id,
                    "photo_url": p.photo_url,
                    "storage_key": p.storage_key,
                    "mime_type": p.mime_type,
                    "file_size": p.file_size
                }
                for p in r.photos
            ]
        })

    # Real Database 7-Day Trend Analytics
    daily_trends = []
    for i in range(6, -1, -1):
        target_date = today - timedelta(days=i)
        day_start = datetime.combine(target_date, datetime.min.time())
        day_end = datetime.combine(target_date, datetime.max.time())

        day_sales = db.query(models.Sale).filter(
            models.Sale.sale_date >= day_start,
            models.Sale.sale_date <= day_end
        ).with_entities(func.sum(models.Sale.total_pieces)).scalar() or 0

        day_damages = db.query(models.DamageReportItem).join(
            models.DamageReport, models.DamageReportItem.damage_report_id == models.DamageReport.id
        ).filter(
            models.DamageReport.report_date >= day_start,
            models.DamageReport.report_date <= day_end,
            models.DamageReport.status != "replaced"
        ).with_entities(func.sum(models.DamageReportItem.quantity)).scalar() or 0

        daily_trends.append({
            "date": target_date.strftime("%a %d"),
            "fullDate": target_date.strftime("%Y-%m-%d"),
            "sales": int(day_sales),
            "damages": int(day_damages),
        })

    return {
        "totalEmployees": total_employees,
        "totalLocations": total_locations,
        "totalProducts": total_products,
        "totalStock": total_stock,
        "piecesSoldToday": int(pieces_sold_today),
        "piecesSoldThisMonth": int(pieces_sold_this_month),
        "piecesSoldThisYear": int(pieces_sold_this_year),
        "totalDamaged": int(total_damaged),
        "recentDamages": formatted_damages,
        "dailyTrends": daily_trends,
    }