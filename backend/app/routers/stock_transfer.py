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
        "status": t.status,
        "initiated_by_id": t.initiated_by_id,
        "initiated_by_name": t.initiated_by.name if t.initiated_by else f"User #{t.initiated_by_id}",
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
    current_user: models.Employee = Depends(get_current_active_user)
):
    if payload.quantity <= 0:
        raise HTTPException(status_code=400, detail="Transfer quantity must be at least 1 piece.")
    if payload.from_location_id == payload.to_location_id:
        raise HTTPException(status_code=400, detail="Source and destination stores must be different.")

    from_loc = db.query(models.Location).filter(models.Location.id == payload.from_location_id).first()
    if not from_loc:
        raise HTTPException(status_code=404, detail="Source store location not found.")
    to_loc = db.query(models.Location).filter(models.Location.id == payload.to_location_id).first()
    if not to_loc:
        raise HTTPException(status_code=404, detail="Destination store location not found.")

    prod = db.query(models.Product).filter(models.Product.id == payload.product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found.")

    # Staff can only transfer out of their assigned store unless admin
    if current_user.role != "admin" and current_user.assigned_location_id != payload.from_location_id:
        raise HTTPException(status_code=403, detail="Staff can only initiate transfers from their own assigned store counter.")

    # Check source inventory
    source_inv = db.query(models.Inventory).filter(
        models.Inventory.product_id == payload.product_id,
        models.Inventory.location_id == payload.from_location_id
    ).first()

    available_stock = source_inv.quantity if source_inv else 0
    if available_stock < payload.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient stock at {from_loc.name}. Available: {available_stock} pcs, Requested: {payload.quantity} pcs."
        )

    # Deduct stock immediately from source store
    source_inv.quantity -= payload.quantity

    transfer_no = _generate_transfer_no()
    transfer = models.StockTransfer(
        transfer_number=transfer_no,
        from_location_id=payload.from_location_id,
        to_location_id=payload.to_location_id,
        product_id=payload.product_id,
        quantity=payload.quantity,
        status="IN_TRANSIT",
        initiated_by_id=current_user.id,
        notes=payload.notes,
        created_at=datetime.datetime.utcnow(),
    )
    db.add(transfer)

    db.flush()
    # Record inventory transaction
    txn = models.InventoryTransaction(
        inventory_id=source_inv.id,
        quantity_change=-payload.quantity,
        transaction_type="transfer_out",
        reference_id=transfer.id,
        reference_type="stock_transfer",
        performed_by=current_user.id,
        notes=f"Dispatched {payload.quantity} pcs to {to_loc.name} (Transfer #{transfer_no})"
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
    if status and status.strip():
        query = query.filter(models.StockTransfer.status == status.strip().upper())
    if location_id:
        query = query.filter(
            (models.StockTransfer.from_location_id == location_id) |
            (models.StockTransfer.to_location_id == location_id)
        )
    elif current_user.role != "admin" and current_user.assigned_location_id:
        # Non-admin sees transfers related to their store
        store_id = current_user.assigned_location_id
        query = query.filter(
            (models.StockTransfer.from_location_id == store_id) |
            (models.StockTransfer.to_location_id == store_id)
        )

    transfers = query.order_by(models.StockTransfer.created_at.desc()).limit(limit).all()
    return [_format_transfer(t) for t in transfers]

@router.post("/{transfer_id}/receive", response_model=schemas.StockTransferResponse)
def receive_stock_transfer(
    transfer_id: int,
    db: Session = Depends(get_db),
    current_user: models.Employee = Depends(get_current_active_user)
):
    transfer = db.query(models.StockTransfer).filter(models.StockTransfer.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Stock transfer record not found.")

    if transfer.status != "IN_TRANSIT":
        raise HTTPException(status_code=400, detail=f"Cannot receive transfer that is already {transfer.status}.")

    # Authorization: Destination store employee or Admin
    if current_user.role != "admin" and current_user.assigned_location_id != transfer.to_location_id:
        raise HTTPException(status_code=403, detail="Only staff assigned to the destination store or an Admin can confirm receipt.")

    # Add stock to destination store
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

    # Update transfer status
    now_utc = datetime.datetime.utcnow()
    transfer.status = "RECEIVED"
    transfer.received_by_id = current_user.id
    transfer.received_at = now_utc

    db.flush()
    # Record inventory transaction
    txn = models.InventoryTransaction(
        inventory_id=dest_inv.id,
        quantity_change=transfer.quantity,
        transaction_type="transfer_in",
        reference_id=transfer.id,
        reference_type="stock_transfer",
        performed_by=current_user.id,
        notes=f"Received {transfer.quantity} pcs from {transfer.from_location.name} (Transfer #{transfer.transfer_number})"
    )
    db.add(txn)

    db.commit()
    db.refresh(transfer)
    return _format_transfer(transfer)

@router.post("/{transfer_id}/cancel", response_model=schemas.StockTransferResponse)
def cancel_stock_transfer(
    transfer_id: int,
    db: Session = Depends(get_db),
    current_user: models.Employee = Depends(get_current_active_user)
):
    transfer = db.query(models.StockTransfer).filter(models.StockTransfer.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Stock transfer record not found.")

    if transfer.status != "IN_TRANSIT":
        raise HTTPException(status_code=400, detail=f"Cannot cancel transfer that is already {transfer.status}.")

    # Only admin or initiating employee can cancel
    if current_user.role != "admin" and current_user.id != transfer.initiated_by_id:
        raise HTTPException(status_code=403, detail="Only an Admin or the employee who initiated the transfer can cancel it.")

    # Return stock to source store
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

    transfer.status = "CANCELLED"

    db.flush()
    txn = models.InventoryTransaction(
        inventory_id=source_inv.id,
        quantity_change=transfer.quantity,
        transaction_type="transfer_cancel",
        reference_id=transfer.id,
        reference_type="stock_transfer",
        performed_by=current_user.id,
        notes=f"Transfer #{transfer.transfer_number} cancelled. {transfer.quantity} pcs returned to {transfer.from_location.name}."
    )
    db.add(txn)

    db.commit()
    db.refresh(transfer)
    return _format_transfer(transfer)
