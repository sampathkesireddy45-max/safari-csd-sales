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
from ..utils.timezone import (
    to_ist,
    format_ist_date,
    format_ist_time,
    format_ist_datetime,
    ist_date_to_utc_bounds,
)
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
        try:
            start_utc = ist_date_to_utc_bounds(date_from, is_end_date=False)
            query = query.filter(models.Sale.sale_date >= start_utc)
        except Exception:
            query = query.filter(models.Sale.sale_date >= datetime.fromisoformat(date_from))
    if date_to:
        try:
            end_utc = ist_date_to_utc_bounds(date_to, is_end_date=True)
            query = query.filter(models.Sale.sale_date <= end_utc)
        except Exception:
            query = query.filter(models.Sale.sale_date < datetime.fromisoformat(date_to) + timedelta(days=1))
    return query

def _build_index_wise_sales(all_sales, db: Session, employee_id: int = None):
    """
    Computes aggregated index-wise performance for products, combining opening stock,
    pieces sold, closing stock, equivalent cases, revenue, and date sold.
    """
    product_sales_map = {}
    for sale in all_sales:
        sale_date_str = format_ist_date(sale.sale_date)
        for item in sale.items:
            pid = item.product_id
            if pid not in product_sales_map:
                product_sales_map[pid] = {
                    "pieces_sold": 0,
                    "transactions_count": 0,
                    "sale_dates": set(),
                }
            product_sales_map[pid]["pieces_sold"] += item.quantity
            product_sales_map[pid]["transactions_count"] += 1
            if sale_date_str:
                product_sales_map[pid]["sale_dates"].add(sale_date_str)

    # Current stock from live inventory
    stock_map = {}
    if employee_id:
        emp = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
        if emp and emp.assigned_location_id:
            inv_rows = db.query(models.Inventory.product_id, models.Inventory.quantity).filter(models.Inventory.location_id == emp.assigned_location_id).all()
            stock_map = {row[0]: int(row[1] or 0) for row in inv_rows}
    else:
        inv_rows = db.query(models.Inventory.product_id, func.coalesce(func.sum(models.Inventory.quantity), 0)).group_by(models.Inventory.product_id).all()
        stock_map = {row[0]: int(row[1] or 0) for row in inv_rows}

    products = db.query(models.Product).filter(models.Product.is_active == True).order_by(models.Product.index_no, models.Product.name).all()
    
    index_wise = []
    total_catalog_pieces = 0
    total_catalog_revenue = 0.0
    total_opening_stock = 0
    total_closing_stock = 0

    for p in products:
        sales_info = product_sales_map.get(p.id, {"pieces_sold": 0, "transactions_count": 0, "sale_dates": set()})
        pieces_sold = sales_info["pieces_sold"]
        sorted_dates = sorted(list(sales_info["sale_dates"]), reverse=True)
        date_sold_str = ", ".join(sorted_dates) if sorted_dates else ""
        
        selling_rate = p.selling_rate if p.selling_rate is not None else (p.rate_per_pc or 0.0)
        case_pack = p.case_pack if p.case_pack and p.case_pack > 0 else 1
        case_rate = round(selling_rate * case_pack, 2)
        revenue = round(pieces_sold * selling_rate, 2)
        cases_sold = round(pieces_sold / case_pack, 2)

        closing_stock = stock_map.get(p.id, 0)
        opening_stock = closing_stock + pieces_sold
        
        total_catalog_pieces += pieces_sold
        total_catalog_revenue = round(total_catalog_revenue + revenue, 2)
        total_opening_stock += opening_stock
        total_closing_stock += closing_stock

        index_wise.append({
            "product_id": p.id,
            "index_no": p.index_no or "N/A",
            "name": p.name,
            "brand": p.brand or "SAFARI",
            "colour": p.colour or "",
            "category": p.category or "",
            "sub_category": p.sub_category or "",
            "case_pack": case_pack,
            "selling_rate": selling_rate,
            "case_rate": case_rate,
            "opening_stock": opening_stock,
            "closing_stock": closing_stock,
            "total_pieces_sold": pieces_sold,
            "total_cases_sold": cases_sold,
            "total_revenue": revenue,
            "transactions_count": sales_info["transactions_count"],
            "date_sold": date_sold_str,
            "has_sales": pieces_sold > 0,
        })

    # Sort: products with sales first (descending pieces, then revenue), then by index_no
    index_wise.sort(key=lambda x: (-x["total_pieces_sold"], -x["total_revenue"], x["index_no"]))

    return index_wise, {
        "total_indexes": len(products),
        "active_indexes_sold": sum(1 for item in index_wise if item["has_sales"]),
        "total_pieces": total_catalog_pieces,
        "total_revenue": total_catalog_revenue,
        "total_opening_stock": total_opening_stock,
        "total_closing_stock": total_closing_stock,
    }

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

    index_wise_sales, index_summary = _build_index_wise_sales(all_sales, db, employee_id=employee_id)

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
        try:
            start_utc = ist_date_to_utc_bounds(date_from, is_end_date=False)
            employee_totals = employee_totals.filter(models.Sale.sale_date >= start_utc)
        except Exception:
            employee_totals = employee_totals.filter(models.Sale.sale_date >= datetime.fromisoformat(date_from))
    if date_to:
        try:
            end_utc = ist_date_to_utc_bounds(date_to, is_end_date=True)
            employee_totals = employee_totals.filter(models.Sale.sale_date <= end_utc)
        except Exception:
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
        "index_wise_sales": index_wise_sales,
        "index_summary": index_summary,
        "sales": [
            {
                "id": sale.id,
                "sale_date": to_ist(sale.sale_date).isoformat() if sale.sale_date else None,
                "formatted_date": format_ist_date(sale.sale_date),
                "formatted_time": format_ist_time(sale.sale_date),
                "formatted_datetime": format_ist_datetime(sale.sale_date),
                "employee_id": sale.employee_id,
                "employee_name": sale.employee.name if sale.employee else "Unknown",
                "employee_code": sale.employee.employee_id if sale.employee else "",
                "location_id": sale.location_id,
                "location_name": sale.location.name if sale.location else "Unknown",
                "total_pieces": int(sale.total_pieces or 0),
                "total_cost": _sale_cost(sale),
                "item_count": len(sale.items),
                "items": [
                    {
                        "id": it.id,
                        "product_id": it.product_id,
                        "index_no": it.product.index_no if it.product else "N/A",
                        "product_name": it.product.name if it.product else "Product",
                        "brand": it.product.brand if it.product else "",
                        "colour": it.product.colour if it.product else "",
                        "quantity": it.quantity,
                        "case_pack": it.product.case_pack if it.product else 1,
                        "unit_price": it.product.selling_rate if (it.product and it.product.selling_rate is not None) else (it.product.rate_per_pc or 0.0) if it.product else 0.0,
                    }
                    for it in sale.items
                ]
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
    writer.writerow([
        "Sale ID",
        "Sale Date (IST)",
        "Sale Time (IST)",
        "Employee ID",
        "Employee",
        "Location",
        "Index & Items Breakdown",
        "Total Pieces",
        "Total Cost (INR)",
        "Line Items"
    ])
    for sale in sales:
        sale_date = format_ist_date(sale.sale_date)
        sale_time = format_ist_time(sale.sale_date)
        items_breakdown = "; ".join(
            f"{it.product.index_no or ''} {it.product.name if it.product else 'Product'} ({it.quantity} pcs @ ₹{it.product.selling_rate if it.product and it.product.selling_rate is not None else 0})"
            for it in sale.items
        )
        writer.writerow([
            sale.id,
            sale_date,
            sale_time,
            sale.employee.employee_id if sale.employee else "",
            sale.employee.name if sale.employee else "Unknown",
            sale.location.name if sale.location else "Unknown",
            items_breakdown,
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
        headers={"Content-Disposition": f"attachment; filename=sales_transactions_{scope}.csv"},
    )

@router.get("/sales/export/index-wise/csv")
def export_admin_sales_index_wise_csv(
    employee_id: int = Query(None),
    date_from: str = Query(None),
    date_to: str = Query(None),
    db: Session = Depends(get_db),
):
    sales = _sales_query(db, employee_id, date_from, date_to).order_by(models.Sale.sale_date.desc()).all()
    index_wise_sales, _ = _build_index_wise_sales(sales, db, employee_id=employee_id)
    
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow([
        "Index No.",
        "Product / Model Name",
        "Brand",
        "Colour",
        "Category",
        "Sub Category",
        "Case Pack (Pcs)",
        "Opening Stock (Pcs)",
        "Volume Sold (Pcs)",
        "Closing Stock (Pcs)",
        "Selling Rate / Pc (INR)",
        "Case Rate (INR)",
        "Total Cases Sold",
        "Total Revenue (INR)",
        "Date Sold",
    ])
    for it in index_wise_sales:
        writer.writerow([
            it["index_no"],
            it["name"],
            it["brand"],
            it["colour"],
            it["category"],
            it["sub_category"],
            it["case_pack"],
            it.get("opening_stock", 0),
            it["total_pieces_sold"],
            it.get("closing_stock", 0),
            f"{it['selling_rate']:.2f}",
            f"{it['case_rate']:.2f}",
            f"{it['total_cases_sold']:.2f}",
            f"{it['total_revenue']:.2f}",
            it.get("date_sold", ""),
        ])
    output.seek(0)
    csv_content = "\ufeff" + output.getvalue()
    scope = f"employee_{employee_id}" if employee_id else "overall"
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=index_wise_sales_{scope}.csv"},
    )

@router.get("/sales/export/xlsx")
def export_admin_sales_xlsx(
    employee_id: int = Query(None),
    date_from: str = Query(None),
    date_to: str = Query(None),
    db: Session = Depends(get_db),
):
    sales = _sales_query(db, employee_id, date_from, date_to).order_by(models.Sale.sale_date.desc()).all()
    index_wise_sales, _ = _build_index_wise_sales(sales, db, employee_id=employee_id)

    workbook = Workbook()

    # ---------------- SHEET 1: Index-Wise Sales Summary ----------------
    ws_index = workbook.active
    ws_index.title = "Sales Dashboard"
    ws_index.append([
        "Index No.",
        "Product / Model Name",
        "Brand",
        "Colour",
        "Category",
        "Sub Category",
        "Case Pack (Pcs)",
        "Opening Stock (Pcs)",
        "Volume Sold (Pcs)",
        "Closing Stock (Pcs)",
        "Selling Rate / Pc (INR)",
        "Case Rate (INR)",
        "Total Cases Sold",
        "Total Revenue (INR)",
        "Date Sold",
    ])

    for it in index_wise_sales:
        ws_index.append([
            it["index_no"],
            it["name"],
            it["brand"],
            it["colour"],
            it["category"],
            it["sub_category"],
            it["case_pack"],
            it.get("opening_stock", 0),
            it["total_pieces_sold"],
            it.get("closing_stock", 0),
            it["selling_rate"],
            it["case_rate"],
            it["total_cases_sold"],
            it["total_revenue"],
            it.get("date_sold", ""),
        ])

    total_idx_row = len(index_wise_sales) + 2
    ws_index.append([
        "TOTAL",
        "ALL INDEXES SUMMARY",
        "", "", "", "", "",
        f"=SUM(H2:H{total_idx_row-1})",
        f"=SUM(I2:I{total_idx_row-1})",
        f"=SUM(J2:J{total_idx_row-1})",
        "", "",
        f"=SUM(M2:M{total_idx_row-1})",
        f"=SUM(N2:N{total_idx_row-1})",
        "",
    ])

    for cell in ws_index[1]:
        cell.font = cell.font.copy(bold=True)
    for cell in ws_index[total_idx_row]:
        cell.font = cell.font.copy(bold=True)

    ws_index.freeze_panes = "A2"
    ws_index.auto_filter.ref = f"A1:O{total_idx_row-1}"

    # Number formats
    for row in ws_index.iter_rows(min_row=2, max_row=total_idx_row, min_col=8, max_col=10):
        row[0].number_format = '#,##0'
        row[1].number_format = '#,##0'
        row[2].number_format = '#,##0'
    for row in ws_index.iter_rows(min_row=2, max_row=total_idx_row, min_col=11, max_col=12):
        row[0].number_format = '#,##0.00'
        row[1].number_format = '#,##0.00'
    for row in ws_index.iter_rows(min_row=2, max_row=total_idx_row, min_col=13, max_col=14):
        row[0].number_format = '#,##0.00'
        row[1].number_format = '#,##0.00'

    column_widths = {
        "A": 14, "B": 32, "C": 14, "D": 14, "E": 12, "F": 16,
        "G": 16, "H": 20, "I": 20, "J": 20, "K": 22, "L": 18,
        "M": 18, "N": 22, "O": 26
    }
    for col, width in column_widths.items():
        ws_index.column_dimensions[col].width = width

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

    ist_today = to_ist(datetime.utcnow()).date()
    start_today = ist_date_to_utc_bounds(str(ist_today), is_end_date=False)
    end_today = ist_date_to_utc_bounds(str(ist_today), is_end_date=True)

    pieces_sold_today = db.query(models.Sale).filter(
        models.Sale.sale_date >= start_today,
        models.Sale.sale_date <= end_today
    ).with_entities(
        func.sum(models.Sale.total_pieces)
    ).scalar() or 0

    # Current month bounds in IST
    start_month_ist = datetime(ist_today.year, ist_today.month, 1)
    if ist_today.month == 12:
        end_month_ist = datetime(ist_today.year + 1, 1, 1) - timedelta(seconds=1)
    else:
        end_month_ist = datetime(ist_today.year, ist_today.month + 1, 1) - timedelta(seconds=1)
    start_month = ist_date_to_utc_bounds(start_month_ist.strftime("%Y-%m-%d"), is_end_date=False)
    end_month = ist_date_to_utc_bounds(end_month_ist.strftime("%Y-%m-%d"), is_end_date=True)

    pieces_sold_this_month = db.query(models.Sale).filter(
        models.Sale.sale_date >= start_month,
        models.Sale.sale_date <= end_month
    ).with_entities(
        func.sum(models.Sale.total_pieces)
    ).scalar() or 0

    # Current year bounds in IST
    start_year = ist_date_to_utc_bounds(f"{ist_today.year}-01-01", is_end_date=False)
    end_year = ist_date_to_utc_bounds(f"{ist_today.year}-12-31", is_end_date=True)

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
            "report_date": format_ist_datetime(r.report_date),
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
        target_date = ist_today - timedelta(days=i)
        day_start = ist_date_to_utc_bounds(str(target_date), is_end_date=False)
        day_end = ist_date_to_utc_bounds(str(target_date), is_end_date=True)

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