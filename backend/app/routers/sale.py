from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from .. import schemas, crud
from ..models.employee import Employee
from ..models.sale import Sale
from ..utils.database import get_db
from ..utils.auth import get_current_active_user, get_current_active_admin_user

router = APIRouter(
    prefix="/sales",
    tags=["sales"],
    responses={404: {"description": "Not found"}},
)

@router.post("/", response_model=schemas.Sale)
def create_sale(sale: schemas.SaleCreate, db: Session = Depends(get_db), current_user: Employee = Depends(get_current_active_user)):
    if current_user.role != "admin" or not sale.employee_id:
        sale.employee_id = current_user.id
    if current_user.assigned_location_id and current_user.role != "admin":
        sale.location_id = current_user.assigned_location_id
    elif not sale.location_id:
        sale.location_id = current_user.assigned_location_id
    return crud.create_sale(db=db, sale=sale)

@router.get("/", response_model=list[schemas.Sale])
def read_sales(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: Employee = Depends(get_current_active_user)):
    if current_user.role == "admin":
        # Admin can see all sales
        return crud.get_sales(db, skip=skip, limit=limit)
    else:
        # Employee can only see their own sales
        return db.query(Sale).filter(Sale.employee_id == current_user.id).offset(skip).limit(limit).all()

@router.get("/{sale_id}", response_model=schemas.Sale)
def read_sale(sale_id: int, db: Session = Depends(get_db), current_user: Employee = Depends(get_current_active_user)):
    db_sale = crud.get_sale(db, sale_id=sale_id)
    if db_sale is None:
        raise HTTPException(status_code=404, detail="Sale not found")
    # Check if the user is authorized to view this sale
    if current_user.role != "admin" and db_sale.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return db_sale

@router.put("/{sale_id}")
def update_sale(sale_id: int, sale: schemas.SaleUpdate, db: Session = Depends(get_db), current_user: Employee = Depends(get_current_active_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can modify / correct sales")
    db_sale = crud.get_sale(db, sale_id=sale_id)
    if db_sale is None:
        raise HTTPException(status_code=404, detail="Sale not found")
    updated = crud.update_sale(db, sale_id=sale_id, sale=sale, performed_by=current_user.id)
    return {
        "message": f"Sale #{sale_id} updated and store inventory rebalanced successfully",
        "id": updated.id,
        "total_pieces": updated.total_pieces,
        "employee_id": updated.employee_id,
        "location_id": updated.location_id,
    }

@router.delete("/{sale_id}")
def delete_sale(sale_id: int, db: Session = Depends(get_db), current_user: Employee = Depends(get_current_active_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can delete / void sales")
    db_sale = crud.get_sale(db, sale_id=sale_id)
    if db_sale is None:
        raise HTTPException(status_code=404, detail="Sale not found")
    return crud.delete_sale(db, sale_id=sale_id, performed_by=current_user.id)
