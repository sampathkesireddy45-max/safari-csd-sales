from sqlalchemy.orm import Session
from .. import models, schemas

def get_sale(db: Session, sale_id: int):
    return db.query(models.Sale).filter(models.Sale.id == sale_id).first()

def get_sales(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Sale).offset(skip).limit(limit).all()

def create_sale(db: Session, sale: schemas.SaleCreate):
    # Calculate total pieces
    total_pieces = sum(item.quantity for item in sale.items)
    db_sale = models.Sale(
        employee_id=sale.employee_id,
        location_id=sale.location_id,
        sale_date=sale.sale_date,
        total_pieces=total_pieces
    )
    db.add(db_sale)
    db.commit()
    db.refresh(db_sale)
    # Create sale items
    for item in sale.items:
        db_sale_item = models.SaleItem(
            sale_id=db_sale.id,
            product_id=item.product_id,
            quantity=item.quantity
        )
        db.add(db_sale_item)
    db.commit()
    db.refresh(db_sale)
    return db_sale

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
