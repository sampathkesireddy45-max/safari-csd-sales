from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from .. import schemas, crud, models
from ..utils.database import get_db
from ..utils.auth import get_current_active_user, get_current_active_admin_user

router = APIRouter(
    prefix="/products",
    tags=["products"],
    responses={404: {"description": "Not found"}},
)

@router.post("/", response_model=schemas.Product)
def create_product(product: schemas.ProductCreate, db: Session = Depends(get_db), current_user: models.Employee = Depends(get_current_active_admin_user)):
    return crud.create_product(db=db, product=product)

@router.get("/", response_model=list[schemas.Product])
def read_products(
    skip: int = 0,
    limit: int = 500,
    q: str = None,
    db: Session = Depends(get_db),
    current_user: models.Employee = Depends(get_current_active_user)
):
    products = crud.get_products(db, skip=skip, limit=limit, q=q)
    return products

@router.get("/{product_id}", response_model=schemas.Product)
def read_product(product_id: int, db: Session = Depends(get_db), current_user: models.Employee = Depends(get_current_active_user)):
    db_product = crud.get_product(db, product_id=product_id)
    if db_product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return db_product

@router.put("/{product_id}", response_model=schemas.Product)
def update_product(product_id: int, product: schemas.ProductUpdate, db: Session = Depends(get_db), current_user: models.Employee = Depends(get_current_active_admin_user)):
    db_product = crud.update_product(db, product_id=product_id, product=product)
    if db_product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return db_product

@router.delete("/{product_id}", response_model=schemas.Product)
def delete_product(product_id: int, db: Session = Depends(get_db), current_user: models.Employee = Depends(get_current_active_admin_user)):
    db_product = crud.delete_product(db, product_id=product_id)
    if db_product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return db_product
