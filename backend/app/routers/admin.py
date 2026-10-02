from fastapi import APIRouter, Depends
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