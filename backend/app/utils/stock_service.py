"""
Stock Service - Inventory Management System
Implements the formal FINAL INVENTORY MANAGEMENT FORMULAS:
1. Individual Store Stock:
   - Monthly Opening Stock = Previous Month's Final Closing Stock (Fixed per month)
   - Closing Stock = Opening Stock + Total Received In - Total Dispatched Out - Total Pieces Sold
   - Damages tracked separately, NEVER subtracted from displayed Closing Stock.
   - Admin can manually edit Closing Stock at any time without automatic overwriting.
2. Stock Transfers:
   - Completed dispatches/receipts update store closing stock.
   - Discrepancies between sent and received quantities are flagged.
3. Overall Inventory:
   - Overall Opening Stock = Sum of Opening Stock across all stores.
   - Overall Closing Stock = Sum of Closing Stock across all stores.
   - If admin adjusts overall value and it differs from sum of stores, discrepancy is flagged.
4. Month-End Stock Rollover:
   - New Month Opening Stock = Previous Month's Final Closing Stock.
   - History is permanently preserved.
5. Admin Permissions & Audit:
   - Full audit trail (previous value, updated value, admin_id, timestamp, reason).
"""

from datetime import datetime
from typing import Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func
from .. import models
from .timezone import to_ist, ist_date_to_utc_bounds

def get_current_year_month(date_str: Optional[str] = None) -> str:
    if date_str and len(date_str) >= 7:
        return date_str[:7]
    return to_ist(datetime.utcnow()).strftime("%Y-%m")

def get_previous_year_month(year_month: str) -> str:
    parts = year_month.split("-")
    year = int(parts[0])
    month = int(parts[1])
    if month == 1:
        return f"{year - 1:04d}-12"
    else:
        return f"{year:04d}-{month - 1:02d}"

def get_month_date_bounds(year_month: str) -> Tuple[datetime, datetime]:
    parts = year_month.split("-")
    year = int(parts[0])
    month = int(parts[1])
    start_date_str = f"{year:04d}-{month:02d}-01"
    if month == 12:
        end_date_str = f"{year:04d}-12-31"
    else:
        # Day before next month's 1st
        from calendar import monthrange
        _, max_days = monthrange(year, month)
        end_date_str = f"{year:04d}-{month:02d}-{max_days:02d}"
    
    start_utc = ist_date_to_utc_bounds(start_date_str, is_end_date=False)
    end_utc = ist_date_to_utc_bounds(end_date_str, is_end_date=True)
    return start_utc, end_utc

def get_or_create_monthly_stock(
    db: Session,
    year_month: str,
    location_id: int,
    product_id: int,
    initial_opening: Optional[int] = None
) -> models.MonthlyStock:
    """
    Returns the MonthlyStock record for the given location, product and month.
    If it does not exist, it rolls over from previous month's final closing stock,
    or falls back to initial_opening (or 0).
    """
    ms = db.query(models.MonthlyStock).filter(
        models.MonthlyStock.year_month == year_month,
        models.MonthlyStock.location_id == location_id,
        models.MonthlyStock.product_id == product_id,
    ).first()

    if ms:
        return ms

    # Check previous month for rollover
    prev_ym = get_previous_year_month(year_month)
    prev_ms = db.query(models.MonthlyStock).filter(
        models.MonthlyStock.year_month == prev_ym,
        models.MonthlyStock.location_id == location_id,
        models.MonthlyStock.product_id == product_id,
    ).first()

    computed_opening = 0
    if prev_ms:
        if prev_ms.is_closing_manually_edited and prev_ms.manual_closing_stock is not None:
            computed_opening = prev_ms.manual_closing_stock
        else:
            # Calculate prev month final closing
            prev_start, prev_end = get_month_date_bounds(prev_ym)
            prev_sold = db.query(func.coalesce(func.sum(models.SaleItem.quantity), 0)).join(
                models.Sale, models.SaleItem.sale_id == models.Sale.id
            ).filter(
                models.SaleItem.product_id == product_id,
                models.Sale.location_id == location_id,
                models.Sale.sale_date >= prev_start,
                models.Sale.sale_date <= prev_end,
            ).scalar() or 0

            prev_recv = db.query(func.coalesce(func.sum(models.StockTransfer.received_quantity), 0)).filter(
                models.StockTransfer.product_id == product_id,
                models.StockTransfer.to_location_id == location_id,
                models.StockTransfer.status == "RECEIVED",
                models.StockTransfer.created_at >= prev_start,
                models.StockTransfer.created_at <= prev_end,
            ).scalar() or 0

            prev_disp = db.query(func.coalesce(func.sum(models.StockTransfer.dispatched_quantity), 0)).filter(
                models.StockTransfer.product_id == product_id,
                models.StockTransfer.from_location_id == location_id,
                models.StockTransfer.status == "RECEIVED",
                models.StockTransfer.created_at >= prev_start,
                models.StockTransfer.created_at <= prev_end,
            ).scalar() or 0

            computed_opening = max(0, prev_ms.opening_stock + prev_recv - prev_disp - prev_sold)
    elif initial_opening is not None:
        computed_opening = max(0, initial_opening)

    new_ms = models.MonthlyStock(
        year_month=year_month,
        location_id=location_id,
        product_id=product_id,
        opening_stock=computed_opening,
        is_closing_manually_edited=False,
    )
    db.add(new_ms)
    try:
        db.commit()
        db.refresh(new_ms)
        return new_ms
    except Exception:
        db.rollback()
        return db.query(models.MonthlyStock).filter(
            models.MonthlyStock.year_month == year_month,
            models.MonthlyStock.location_id == location_id,
            models.MonthlyStock.product_id == product_id,
        ).first()

def log_admin_stock_audit(
    db: Session,
    admin_id: int,
    stock_type: str,
    year_month: str,
    location_id: Optional[int],
    product_id: int,
    previous_value: int,
    updated_value: int,
    reason: Optional[str] = None
) -> models.AdminStockAuditLog:
    """
    Creates an immutable audit log entry for admin stock manual adjustments.
    """
    diff = updated_value - previous_value
    audit_entry = models.AdminStockAuditLog(
        admin_id=admin_id,
        stock_type=stock_type,
        year_month=year_month,
        location_id=location_id,
        product_id=product_id,
        previous_value=previous_value,
        updated_value=updated_value,
        difference=diff,
        reason=reason or "Admin manual adjustment",
        timestamp=datetime.utcnow()
    )
    db.add(audit_entry)
    db.commit()
    return audit_entry
