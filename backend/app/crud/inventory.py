from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session
from .. import models, schemas

def get_inventory(db: Session, inventory_id: int):
    return db.query(models.Inventory).filter(models.Inventory.id == inventory_id).first()

def get_inventory_by_product_and_location(db: Session, product_id: int, location_id: int):
    return db.query(models.Inventory).filter(
        models.Inventory.product_id == product_id,
        models.Inventory.location_id == location_id
    ).first()

def get_inventories(db: Session, location_id: Optional[int] = None, skip: int = 0, limit: int = 1000):
    query = db.query(models.Inventory)
    if location_id:
        query = query.filter(models.Inventory.location_id == location_id)
    return query.offset(skip).limit(limit).all()

def set_or_update_stock(db: Session, product_id: int, location_id: int, quantity: int, mode: str = "set"):
    inv = get_inventory_by_product_and_location(db, product_id=product_id, location_id=location_id)
    if inv:
        if mode == "add":
            inv.quantity = max(0, inv.quantity + quantity)
        else:
            inv.quantity = max(0, quantity)
        inv.last_updated = datetime.utcnow()
    else:
        initial_qty = max(0, quantity)
        inv = models.Inventory(
            product_id=product_id,
            location_id=location_id,
            quantity=initial_qty,
            last_updated=datetime.utcnow()
        )
        db.add(inv)
    db.commit()
    db.refresh(inv)
    return inv

def create_inventory(db: Session, inventory: schemas.InventoryCreate):
    db_inventory = models.Inventory(**inventory.dict())
    db.add(db_inventory)
    db.commit()
    db.refresh(db_inventory)
    return db_inventory

def update_inventory(db: Session, inventory_id: int, inventory: schemas.InventoryUpdate):
    db_inventory = db.query(models.Inventory).filter(models.Inventory.id == inventory_id).first()
    if db_inventory:
        update_data = inventory.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_inventory, key, value)
        db.commit()
        db.refresh(db_inventory)
    return db_inventory

def delete_inventory(db: Session, inventory_id: int):
    db_inventory = db.query(models.Inventory).filter(models.Inventory.id == inventory_id).first()
    if db_inventory:
        db.delete(db_inventory)
        db.commit()
    return db_inventory

