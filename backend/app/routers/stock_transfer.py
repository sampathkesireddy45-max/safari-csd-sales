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
    qty = t.dispatched_quantity if (t.dispatched_quantity and t.dispatched_quantity > 0) else t.quantity
    cases = qty // pack
    remainder = qty % pack
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
        "quantity": qty,
        "dispatched_quantity": qty,
        "received_quantity": t.received_quantity,
        "has_mismatch": bool(t.has_mismatch),
        "mismatch_quantity": t.mismatch_quantity or 0,
        "mismatch_notes": t.mismatch_notes,
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
    Transfer is created in 'SENT' state.
    Stock deduction from source store and addition to destination store occur
    atomically upon destination store confirmation, guaranteeing overall fleet stock
    conservation and preventing double-counting.
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

    transfer_no = _generate_transfer_no()
    now_utc = datetime.datetime.utcnow()

    transfer = models.StockTransfer(
        transfer_number=transfer_no,
        from_location_id=payload.from_location_id,
        to_location_id=payload.to_location_id,
        product_id=payload.product_id,
        quantity=payload.quantity,
        dispatched_quantity=payload.quantity,
        received_quantity=None,
        has_mismatch=False,
        mismatch_quantity=0,
        mismatch_notes=None,
        status="SENT",
        initiated_by_id=current_admin.id,
        sent_by_id=current_admin.id,
        sent_at=now_utc,
        notes=payload.notes,
        created_at=now_utc,
    )
    db.add(transfer)
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
    payload: Optional[schemas.StockTransferReceiveRequest] = None,
    db: Session = Depends(get_db),
    current_user: models.Employee = Depends(get_current_active_user)
):
    """
    Destination store employee (or Admin) confirms receipt of transfer.
    Stock Transfer Rule Compliance:
    - Atomically reduces sending store inventory by dispatched_quantity.
    - Atomically increases receiving store inventory by confirmed received_quantity.
    - Records Dispatched Out and Received In separately.
    - Flags any quantity mismatch between dispatched and received.
    - Guarantees zero phantom drift in overall fleet inventory.
    """
    transfer = db.query(models.StockTransfer).filter(models.StockTransfer.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Stock transfer record not found.")

    if transfer.status != "SENT":
        raise HTTPException(status_code=400, detail=f"Cannot receive transfer with status {transfer.status}. Transfer must be in SENT state.")

    # Authorization: Destination store employee OR Admin
    if current_user.role != "admin" and current_user.assigned_location_id != transfer.to_location_id:
        raise HTTPException(status_code=403, detail="Only staff assigned to the receiving store or an Admin can confirm receipt.")

    dispatched_qty = transfer.dispatched_quantity if (transfer.dispatched_quantity and transfer.dispatched_quantity > 0) else transfer.quantity
    received_qty = payload.received_quantity if (payload and payload.received_quantity is not None) else dispatched_qty

    if received_qty < 0:
        raise HTTPException(status_code=400, detail="Received quantity cannot be negative.")

    # 1. Reduce source store inventory immediately
    source_inv = db.query(models.Inventory).filter(
        models.Inventory.product_id == transfer.product_id,
        models.Inventory.location_id == transfer.from_location_id
    ).first()

    if not source_inv or source_inv.quantity < dispatched_qty:
        available = source_inv.quantity if source_inv else 0
        raise HTTPException(
            status_code=400,
            detail=f"Source store {transfer.from_location.name if transfer.from_location else ''} currently has only {available} pcs in stock. Cannot complete transfer of {dispatched_qty} pcs."
        )

    source_inv.quantity -= dispatched_qty

    # 2. Increase destination store inventory immediately
    dest_inv = db.query(models.Inventory).filter(
        models.Inventory.product_id == transfer.product_id,
        models.Inventory.location_id == transfer.to_location_id
    ).first()

    if not dest_inv:
        dest_inv = models.Inventory(
            product_id=transfer.product_id,
            location_id=transfer.to_location_id,
            quantity=received_qty
        )
        db.add(dest_inv)
    else:
        dest_inv.quantity += received_qty

    now_utc = datetime.datetime.utcnow()
    transfer.status = "RECEIVED"
    transfer.received_quantity = received_qty
    transfer.received_by_id = current_user.id
    transfer.received_at = now_utc

    # 3. Check and flag mismatch
    if received_qty != dispatched_qty:
        transfer.has_mismatch = True
        transfer.mismatch_quantity = dispatched_qty - received_qty
        diff = dispatched_qty - received_qty
        diff_str = f"-{diff}" if diff > 0 else f"+{abs(diff)}"
        m_note = f"Discrepancy: Dispatched {dispatched_qty} pcs, Received {received_qty} pcs ({diff_str} pcs)."
        if payload and payload.notes:
            m_note += f" Reason: {payload.notes}"
        transfer.mismatch_notes = m_note
    else:
        transfer.has_mismatch = False
        transfer.mismatch_quantity = 0
        if payload and payload.notes:
            transfer.mismatch_notes = payload.notes

    db.flush()

    # 4. Record Dispatched Out transaction separately
    txn_out = models.InventoryTransaction(
        inventory_id=source_inv.id,
        quantity_change=-dispatched_qty,
        transaction_type="transfer_dispatched_out",
        reference_id=transfer.id,
        reference_type="stock_transfer",
        performed_by=current_user.id,
        notes=f"Dispatched Out {dispatched_qty} pcs to {transfer.to_location.name} (Transfer #{transfer.transfer_number})"
    )
    db.add(txn_out)

    # 5. Record Received In transaction separately
    txn_in = models.InventoryTransaction(
        inventory_id=dest_inv.id,
        quantity_change=received_qty,
        transaction_type="transfer_received_in",
        reference_id=transfer.id,
        reference_type="stock_transfer",
        performed_by=current_user.id,
        notes=f"Received In {received_qty} pcs from {transfer.from_location.name} (Transfer #{transfer.transfer_number})"
    )
    db.add(txn_in)

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
    Only an Admin can cancel a pending SENT stock transfer.
    Since stock is deducted only upon destination receipt, cancelling a SENT transfer
    simply closes the transfer request without altering physical stock.
    """
    transfer = db.query(models.StockTransfer).filter(models.StockTransfer.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Stock transfer record not found.")

    if transfer.status in ["RECEIVED", "CANCELLED"]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel transfer that is already {transfer.status}.")

    transfer.status = "CANCELLED"
    db.commit()
    db.refresh(transfer)
    return _format_transfer(transfer)
