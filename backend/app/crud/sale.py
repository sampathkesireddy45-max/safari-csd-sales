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

def update_sale(db: Session, sale_id: int, sale: schemas.SaleUpdate, performed_by: int = None):
    db_sale = db.query(models.Sale).filter(models.Sale.id == sale_id).with_for_update().first()
    if not db_sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    target_location_id = sale.location_id if sale.location_id is not None else db_sale.location_id
    old_location_id = db_sale.location_id

    try:
        # If items are provided for correction
        if sale.items is not None:
            if len(sale.items) == 0:
                raise HTTPException(status_code=400, detail="A sale must contain at least 1 piece/item. Delete the sale if voiding.")

            # Validate positive quantities and product existence
            new_item_counts = {}
            for item in sale.items:
                if item.quantity <= 0:
                    raise HTTPException(status_code=400, detail="Number of pieces must be greater than 0")
                prod = db.query(models.Product).filter(models.Product.id == item.product_id).first()
                if not prod:
                    raise HTTPException(status_code=404, detail=f"Product SKU #{item.product_id} not found in catalog")
                new_item_counts[item.product_id] = new_item_counts.get(item.product_id, 0) + item.quantity

            # Current old items in the sale
            old_item_counts = {}
            for old_it in db_sale.items:
                old_item_counts[old_it.product_id] = old_item_counts.get(old_it.product_id, 0) + old_it.quantity

            if old_location_id == target_location_id:
                # Same store location: rebalance inventory differences per product
                all_pids = set(new_item_counts.keys()).union(set(old_item_counts.keys()))
                for pid in all_pids:
                    old_qty = old_item_counts.get(pid, 0)
                    new_qty = new_item_counts.get(pid, 0)
                    diff = new_qty - old_qty  # positive means selling MORE, negative means selling LESS

                    if diff == 0:
                        continue

                    product = db.query(models.Product).filter(models.Product.id == pid).first()
                    prod_name = product.name if product else f"Product #{pid}"

                    inv = db.query(models.Inventory).filter(
                        models.Inventory.product_id == pid,
                        models.Inventory.location_id == target_location_id
                    ).with_for_update().first()

                    if not inv:
                        inv = models.Inventory(
                            product_id=pid,
                            location_id=target_location_id,
                            quantity=0,
                            last_updated=datetime.utcnow()
                        )
                        db.add(inv)
                        db.flush()

                    if diff > 0:
                        # Selling MORE pieces: check store stock availability
                        if inv.quantity < diff:
                            raise HTTPException(
                                status_code=400,
                                detail=f"Insufficient inventory for {prod_name}. Store has {inv.quantity} PCS available, but correction requires {diff} more PCS."
                            )
                        inv.quantity -= diff
                    else:
                        # Selling FEWER pieces: return surplus pieces back to store inventory
                        inv.quantity += abs(diff)

                    inv.last_updated = datetime.utcnow()
                    db.add(models.InventoryTransaction(
                        inventory_id=inv.id,
                        quantity_change=-diff,
                        transaction_type="sale_correction",
                        reference_id=db_sale.id,
                        reference_type="sale",
                        performed_by=performed_by or db_sale.employee_id,
                        notes=f"Admin corrected sale #{db_sale.id} pieces from {old_qty} to {new_qty}. {sale.correction_reason or ''}".strip()
                    ))
            else:
                # Location changed: return all old pieces to old store, deduct all new pieces from new store
                for pid, old_qty in old_item_counts.items():
                    inv_old = db.query(models.Inventory).filter(
                        models.Inventory.product_id == pid,
                        models.Inventory.location_id == old_location_id
                    ).with_for_update().first()
                    if not inv_old:
                        inv_old = models.Inventory(product_id=pid, location_id=old_location_id, quantity=0, last_updated=datetime.utcnow())
                        db.add(inv_old)
                        db.flush()
                    inv_old.quantity += old_qty
                    inv_old.last_updated = datetime.utcnow()
                    db.add(models.InventoryTransaction(
                        inventory_id=inv_old.id,
                        quantity_change=old_qty,
                        transaction_type="sale_correction_location_change",
                        reference_id=db_sale.id,
                        reference_type="sale",
                        performed_by=performed_by or db_sale.employee_id,
                        notes=f"Returned from store reassignment in sale #{db_sale.id}"
                    ))

                for pid, new_qty in new_item_counts.items():
                    product = db.query(models.Product).filter(models.Product.id == pid).first()
                    prod_name = product.name if product else f"Product #{pid}"
                    inv_new = db.query(models.Inventory).filter(
                        models.Inventory.product_id == pid,
                        models.Inventory.location_id == target_location_id
                    ).with_for_update().first()
                    if not inv_new:
                        inv_new = models.Inventory(product_id=pid, location_id=target_location_id, quantity=0, last_updated=datetime.utcnow())
                        db.add(inv_new)
                        db.flush()
                    if inv_new.quantity < new_qty:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Insufficient inventory for {prod_name} at new store location. Available: {inv_new.quantity} PCS, Required: {new_qty} PCS."
                        )
                    inv_new.quantity -= new_qty
                    inv_new.last_updated = datetime.utcnow()
                    db.add(models.InventoryTransaction(
                        inventory_id=inv_new.id,
                        quantity_change=-new_qty,
                        transaction_type="sale_correction_location_change",
                        reference_id=db_sale.id,
                        reference_type="sale",
                        performed_by=performed_by or db_sale.employee_id,
                        notes=f"Deducted at new store in sale #{db_sale.id}"
                    ))

            # Delete old SaleItem rows
            db.query(models.SaleItem).filter(models.SaleItem.sale_id == db_sale.id).delete()
            db.flush()

            # Insert new SaleItem rows
            total_pcs = 0
            for item in sale.items:
                db.add(models.SaleItem(
                    sale_id=db_sale.id,
                    product_id=item.product_id,
                    quantity=item.quantity
                ))
                total_pcs += item.quantity

            db_sale.total_pieces = total_pcs

        if sale.employee_id is not None:
            db_sale.employee_id = sale.employee_id
        if sale.location_id is not None:
            db_sale.location_id = sale.location_id
        if sale.sale_date is not None:
            db_sale.sale_date = sale.sale_date

        db.commit()
        db.refresh(db_sale)
        return db_sale
    except Exception:
        db.rollback()
        raise

def delete_sale(db: Session, sale_id: int, performed_by: int = None):
    db_sale = db.query(models.Sale).filter(models.Sale.id == sale_id).with_for_update().first()
    if not db_sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    try:
        # Return all sold items back to store inventory
        for it in db_sale.items:
            inv = db.query(models.Inventory).filter(
                models.Inventory.product_id == it.product_id,
                models.Inventory.location_id == db_sale.location_id
            ).with_for_update().first()
            if not inv:
                inv = models.Inventory(
                    product_id=it.product_id,
                    location_id=db_sale.location_id,
                    quantity=0,
                    last_updated=datetime.utcnow()
                )
                db.add(inv)
                db.flush()
            inv.quantity += it.quantity
            inv.last_updated = datetime.utcnow()
            db.add(models.InventoryTransaction(
                inventory_id=inv.id,
                quantity_change=it.quantity,
                transaction_type="sale_cancellation",
                reference_id=db_sale.id,
                reference_type="sale",
                performed_by=performed_by or db_sale.employee_id,
                notes=f"Admin cancelled / deleted sale receipt #{db_sale.id} ({it.quantity} PCS returned to store inventory)"
            ))

        db.delete(db_sale)
        db.commit()
        return {"message": f"Sale #{sale_id} deleted and all items returned to inventory successfully.", "id": sale_id}
    except Exception:
        db.rollback()
        raise
