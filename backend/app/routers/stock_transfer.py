import datetime
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from .. import models, schemas
from ..utils.database import get_db
from ..utils.auth import get_current_active_user, get_current_active_admin_user

router = APIRouter(
    prefix="/transfers",
    tags=["stock-transfers"],
)

def _generate_transfer_no() -> str:
    today_str = datetime.datetime.utcnow().strftime("%Y%m%d")
    short_uuid = uuid.uuid4().hex[:6].upper()
    return f"TR-{today_str}-{short_uuid}"

def _format_transfer(t: models.StockTransfer) -> dict:
    pack = t.product.case_pack if (t.product and t.product.case_pack and t.product.case_pack > 0) else 1
    cases = t.quantity // pack
    remainder = t.quantity % pack
    if cases > 0 and remainder > 0:
        cases_display = f"{cases} Cases, {remainder} Pcs"
    elif cases > 0:
        cases_display = f"{cases} Cases"
    else:
        cases_display = f"{remainder} Pcs"

    return {
        "id": t.id,
        "transfer_number": t.transfer_number,
        "from_location_id": t.from_location_id,
        "from_location_name": t.from_location.name if t.from_location else f"Store #{t.from_location_id}",
        "to_location_id": t.to_location_id,
        "to_location_name": t.to_location.name if t.to_location else f"Store #{t.to_location_id}",
        "product_id": t.product_id,
        "product_name": t.product.name if t.product else f"Product #{t.product_id}",
        "product_index": t.product.index_no if t.product else None,
        "quantity": t.quantity,
        "case_pack": pack,
        "cases": cases,
        "remainder_pieces": remainder,
        "cases_display": cases_display,
        "status": t.status,  # "SENT", "RECEIVED", "CANCELLED"
        "initiated_by_id": t.initiated_by_id,
        "initiated_by_name": t.initiated_by.name if t.initiated_by else f"Admin #{t.initiated_by_id}",
        "sent_by_id": t.sent_by_id,
        "sent_by_name": t.sent_by.name if t.sent_by else None,
        "sent_at": t.sent_at,
        "received_by_id": t.received_by_id,
        "received_by_name": t.received_by.name if t.received_by else None,
        "notes": t.notes,
        "created_at": t.created_at,
        "received_at": t.received_at,
    }

@router.post("/", response_model=schemas.StockTransferResponse)
def create_stock_transfer(
    payload: schemas.StockTransferCreate,
    db: Session = Depends(get_db),
    current_admin: models.Employee = Depends(get_current_active_admin_user)
):
    """
    STRICTLY ADMIN ONLY:
    Only Administrator orders stock transfers between store locations.
    When created, pieces are automatically marked as SENT and deducted from sending store.
    """
    if payload.quantity <= 0:
        raise HTTPException(status_code=400, detail="Transfer quantity must be at least 1 piece.")
    if payload.from_location_id == payload.to_location_id:
        raise HTTPException(status_code=400, detail="Sending and receiving store counters cannot be the same.")

    from_loc = db.query(models.Location).filter(models.Location.id == payload.from_location_id).first()
    if not from_loc:
        raise HTTPException(status_code=404, detail="Sending store location not found.")
    to_loc = db.query(models.Location).filter(models.Location.id == payload.to_location_id).first()
    if not to_loc:
        raise HTTPException(status_code=404, detail="Receiving store location not found.")

    prod = db.query(models.Product).filter(models.Product.id == payload.product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found.")

    # Check available stock at sending store
    source_inv = db.query(models.Inventory).filter(
        models.Inventory.product_id == payload.product_id,
        models.Inventory.location_id == payload.from_location_id
    ).first()

    available_stock = source_inv.quantity if source_inv else 0
    if available_stock < payload.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient stock at {from_loc.name}. Available: {available_stock} pcs, Requested to transfer: {payload.quantity} pcs."
        )

    # Immediately deduct pieces from sending store (Marked as SENT)
    source_inv.quantity -= payload.quantity

    transfer_no = _generate_transfer_no()
    now_utc = datetime.datetime.utcnow()

    transfer = models.StockTransfer(
        transfer_number=transfer_no,
        from_location_id=payload.from_location_id,
        to_location_id=payload.to_location_id,
        product_id=payload.product_id,
        quantity=payload.quantity,
        status="SENT",
        initiated_by_id=current_admin.id,
        sent_by_id=current_admin.id,
        sent_at=now_utc,
        notes=payload.notes,
        created_at=now_utc,
    )
    db.add(transfer)
    db.flush()

    txn = models.InventoryTransaction(
        inventory_id=source_inv.id,
        quantity_change=-payload.quantity,
        transaction_type="transfer_sent",
        reference_id=transfer.id,
        reference_type="stock_transfer",
        performed_by=current_admin.id,
        notes=f"Sent {payload.quantity} pcs to {to_loc.name} (Transfer #{transfer_no})"
    )
    db.add(txn)

    db.commit()
    db.refresh(transfer)
    return _format_transfer(transfer)

@router.get("/", response_model=List[schemas.StockTransferResponse])
def list_stock_transfers(
    location_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: models.Employee = Depends(get_current_active_user)
):
    query = db.query(models.StockTransfer)
    if status and status.strip() and status.strip().upper() != "ALL":
        query = query.filter(models.StockTransfer.status == status.strip().upper())

    if current_user.role != "admin":
        # Staff only see transfers where their assigned counter is sender or receiver
        store_id = current_user.assigned_location_id
        if not store_id:
            return []
        query = query.filter(
            (models.StockTransfer.from_location_id == store_id) |
            (models.StockTransfer.to_location_id == store_id)
        )
    elif location_id:
        query = query.filter(
            (models.StockTransfer.from_location_id == location_id) |
            (models.StockTransfer.to_location_id == location_id)
        )

    transfers = query.order_by(models.StockTransfer.created_at.desc()).limit(limit).all()
    return [_format_transfer(t) for t in transfers]

@router.post("/{transfer_id}/receive", response_model=schemas.StockTransferResponse)
def confirm_received_stock_transfer(
    transfer_id: int,
    db: Session = Depends(get_db),
    current_user: models.Employee = Depends(get_current_active_user)
):
    """
    Respective receiving store employee (or Admin) clicks 'Confirm Received'.
    Adds stock to destination store counter and marks status as RECEIVED.
    """
    transfer = db.query(models.StockTransfer).filter(models.StockTransfer.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Stock transfer record not found.")

    if transfer.status != "SENT":
        raise HTTPException(status_code=400, detail=f"Cannot receive transfer with status {transfer.status}. Transfer must be Sent.")

    # Authorization: Destination store employee OR Admin
    if current_user.role != "admin" and current_user.assigned_location_id != transfer.to_location_id:
        raise HTTPException(status_code=403, detail="Only staff assigned to the receiving store or an Admin can confirm receipt.")

    dest_inv = db.query(models.Inventory).filter(
        models.Inventory.product_id == transfer.product_id,
        models.Inventory.location_id == transfer.to_location_id
    ).first()

    if not dest_inv:
        dest_inv = models.Inventory(
            product_id=transfer.product_id,
            location_id=transfer.to_location_id,
            quantity=transfer.quantity
        )
        db.add(dest_inv)
    else:
        dest_inv.quantity += transfer.quantity

    now_utc = datetime.datetime.utcnow()
    transfer.status = "RECEIVED"
    transfer.received_by_id = current_user.id
    transfer.received_at = now_utc

    db.flush()

    txn = models.InventoryTransaction(
        inventory_id=dest_inv.id,
        quantity_change=transfer.quantity,
        transaction_type="transfer_received",
        reference_id=transfer.id,
        reference_type="stock_transfer",
        performed_by=current_user.id,
        notes=f"Counter received {transfer.quantity} pcs from {transfer.from_location.name} (Transfer #{transfer.transfer_number})"
    )
    db.add(txn)

    db.commit()
    db.refresh(transfer)
    return _format_transfer(transfer)

@router.post("/{transfer_id}/cancel", response_model=schemas.StockTransferResponse)
def cancel_stock_transfer(
    transfer_id: int,
    db: Session = Depends(get_db),
    current_admin: models.Employee = Depends(get_current_active_admin_user)
):
    """
    STRICTLY ADMIN ONLY:
    Only an Admin can cancel an active stock transfer.
    Pieces are returned to sending counter.
    """
    transfer = db.query(models.StockTransfer).filter(models.StockTransfer.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Stock transfer record not found.")

    if transfer.status in ["RECEIVED", "CANCELLED"]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel transfer that is already {transfer.status}.")

    source_inv = db.query(models.Inventory).filter(
        models.Inventory.product_id == transfer.product_id,
        models.Inventory.location_id == transfer.from_location_id
    ).first()

    if not source_inv:
        source_inv = models.Inventory(
            product_id=transfer.product_id,
            location_id=transfer.from_location_id,
            quantity=transfer.quantity
        )
        db.add(source_inv)
    else:
        source_inv.quantity += transfer.quantity

    db.flush()

    txn = models.InventoryTransaction(
        inventory_id=source_inv.id,
        quantity_change=transfer.quantity,
        transaction_type="transfer_cancel",
        reference_id=transfer.id,
        reference_type="stock_transfer",
        performed_by=current_admin.id,
        notes=f"Admin cancelled Transfer #{transfer.transfer_number}. {transfer.quantity} pcs returned to {transfer.from_location.name}."
    )
    db.add(txn)

    transfer.status = "CANCELLED"
    db.commit()
    db.refresh(transfer)
    return _format_transfer(transfer)
