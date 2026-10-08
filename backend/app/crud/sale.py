from sqlalchemy.orm import Session
from fastapi import HTTPException
from .. import models, schemas
from datetime import datetime

def get_sale(db: Session, sale_id: int):
    return db.query(models.Sale).filter(models.Sale.id == sale_id).first()

def get_sales(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Sale).offset(skip).limit(limit).all()

def create_sale(db: Session, sale: schemas.SaleCreate):
    if not sale.location_id:
        raise HTTPException(status_code=400, detail="A retail location is required")

    try:
        total_pieces = sum(item.quantity for item in sale.items)
        db_sale = models.Sale(
            employee_id=sale.employee_id,
            location_id=sale.location_id,
            sale_date=sale.sale_date,
            total_pieces=total_pieces
        )
        db.add(db_sale)
        db.flush()

        for item in sale.items:
            product = db.query(models.Product).filter(
                models.Product.id == item.product_id,
                models.Product.is_active == True
            ).first()
            if not product:
                raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")

            inventory = db.query(models.Inventory).filter(
                models.Inventory.product_id == item.product_id,
                models.Inventory.location_id == sale.location_id
            ).with_for_update().first()
            if not inventory or inventory.quantity < item.quantity:
                raise HTTPException(
                    status_code=409,
                    detail=f"Insufficient stock for {product.name}"
                )

            inventory.quantity -= item.quantity
            inventory.last_updated = datetime.utcnow()
            db.add(models.InventoryTransaction(
                inventory_id=inventory.id,
                quantity_change=-item.quantity,
                transaction_type="sale",
                reference_id=db_sale.id,
                reference_type="sale",
                performed_by=sale.employee_id
            ))
            db.add(models.SaleItem(
                sale_id=db_sale.id,
                product_id=item.product_id,
                quantity=item.quantity
            ))

        db.commit()
        db.refresh(db_sale)
        return db_sale
    except Exception:
        db.rollback()
        raise

def update_sale(db: Session, sale_id: int, sale: schemas.SaleUpdate):
    db_sale = db.query(models.Sale).filter(models.Sale.id == sale_id).first()
    if db_sale:
        update_data = sale.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_sale, key, value)
        db.commit()
        db.refresh(db_sale)
    return db_sale

def delete_sale(db: Session, sale_id: int):
    db_sale = db.query(models.Sale).filter(models.Sale.id == sale_id).first()
    if db_sale:
        db.delete(db_sale)
        db.commit()
    return db_sale
