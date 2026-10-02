from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from .. import schemas, crud, models
from ..utils.database import get_db
from ..utils.auth import get_current_active_user, get_current_active_admin_user

router = APIRouter(
    prefix="/inventory",
    tags=["inventory"],
    responses={404: {"description": "Not found"}},
)

@router.post("/update-stock")
def update_stock(
    req: schemas.StockUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.Employee = Depends(get_current_active_user)
):
    """
    Dynamic Stock Entry: Allows employees and admins to enter or update the number of pieces in stock.
    - Employees can enter/update stock for their assigned retail location.
    - Admins can enter/update stock for any retail location.
    """
    if req.quantity < 0:
        raise HTTPException(status_code=400, detail="Stock piece count cannot be negative")

    target_location_id = req.location_id

    if current_user.role != "admin":
        if not current_user.assigned_location_id:
            raise HTTPException(
                status_code=400,
                detail="You have no assigned retail store location. Contact admin to assign your location."
            )
        target_location_id = current_user.assigned_location_id
    else:
        if not target_location_id:
            raise HTTPException(
                status_code=400,
                detail="Admin must specify a target retail location_id"
            )

    # Verify product exists
    product = crud.get_product(db, product_id=req.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found in catalog")

    # Verify location exists
    location = crud.get_location(db, location_id=target_location_id)
    if not location:
        raise HTTPException(status_code=404, detail="Store location not found")

    # Perform dynamic stock update
    inv = crud.inventory.set_or_update_stock(
        db=db,
        product_id=req.product_id,
        location_id=target_location_id,
        quantity=req.quantity,
        mode=req.mode or "set"
    )

    action_label = "Adjusted" if req.mode == "set" else "Added incoming"
    return {
        "status": "success",
        "message": f"{action_label} stock for [{product.name}] to {inv.quantity} PCS at [{location.name}]",
        "inventory": {
            "id": inv.id,
            "product_id": product.id,
            "product_name": product.name,
            "index_no": product.index_no,
            "selling_rate": product.selling_rate,
            "rate_per_pc": product.rate_per_pc,
            "location_id": location.id,
            "location_name": location.name,
            "quantity": inv.quantity,
            "last_updated": inv.last_updated.isoformat() if inv.last_updated else None
        }
    }

@router.post("/reset-to-zero")
def reset_inventory_to_zero(
    location_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.Employee = Depends(get_current_active_admin_user)
):
    """
    Clears hardcoded/static default stock so inventory counts only reflect actual physical pieces entered by staff.
    """
    query = db.query(models.Inventory)
    if location_id:
        query = query.filter(models.Inventory.location_id == location_id)
    
    updated_count = query.update({models.Inventory.quantity: 0})
    db.commit()
    return {
        "status": "success",
        "message": f"Reset {updated_count} inventory records to 0 PCS. Staff/Admins can now enter real counts.",
        "affected_records": updated_count
    }

@router.get("/")
def read_inventories(
    location_id: Optional[int] = Query(None),
    skip: int = 0,
    limit: int = 1000,
    db: Session = Depends(get_db),
    current_user: models.Employee = Depends(get_current_active_user)
):
    # If employee, optionally constrain or default to their location if desired
    items = db.query(models.Inventory, models.Product, models.Location).join(
        models.Product, models.Inventory.product_id == models.Product.id
    ).join(
        models.Location, models.Inventory.location_id == models.Location.id
    )

    if location_id:
        items = items.filter(models.Inventory.location_id == location_id)
    elif current_user.role != "admin" and current_user.assigned_location_id:
        items = items.filter(models.Inventory.location_id == current_user.assigned_location_id)

    results = []
    for inv, prod, loc in items.offset(skip).limit(limit).all():
        results.append({
            "id": inv.id,
            "product_id": prod.id,
            "product_name": prod.name,
            "index_no": prod.index_no,
            "rate_per_pc": prod.rate_per_pc,
            "selling_rate": prod.selling_rate,
            "location_id": loc.id,
            "location_name": loc.name,
            "quantity": inv.quantity,
            "last_updated": inv.last_updated.isoformat() if inv.last_updated else None
        })
    return results

@router.get("/{inventory_id}", response_model=schemas.Inventory)
def read_inventory(inventory_id: int, db: Session = Depends(get_db), current_user: models.Employee = Depends(get_current_active_user)):
    db_inventory = crud.get_inventory(db, inventory_id=inventory_id)
    if db_inventory is None:
        raise HTTPException(status_code=404, detail="Inventory not found")
    return db_inventory

@router.put("/{inventory_id}", response_model=schemas.Inventory)
def update_inventory(inventory_id: int, inventory: schemas.InventoryUpdate, db: Session = Depends(get_db), current_user: models.Employee = Depends(get_current_active_admin_user)):
    db_inventory = crud.update_inventory(db, inventory_id=inventory_id, inventory=inventory)
    if db_inventory is None:
        raise HTTPException(status_code=404, detail="Inventory not found")
    return db_inventory

@router.delete("/{inventory_id}", response_model=schemas.Inventory)
def delete_inventory(inventory_id: int, db: Session = Depends(get_db), current_user: models.Employee = Depends(get_current_active_admin_user)):
    db_inventory = crud.delete_inventory(db, inventory_id=inventory_id)
    if db_inventory is None:
        raise HTTPException(status_code=404, detail="Inventory not found")
    return db_inventory
