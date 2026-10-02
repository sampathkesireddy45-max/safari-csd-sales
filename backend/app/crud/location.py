from sqlalchemy.orm import Session
from .. import models, schemas

def get_location(db: Session, location_id: int):
    return db.query(models.Location).filter(models.Location.id == location_id).first()

def get_location_by_location_id(db: Session, location_id: str):
    return db.query(models.Location).filter(models.Location.location_id == location_id).first()

def get_locations(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Location).offset(skip).limit(limit).all()

def create_location(db: Session, location: schemas.LocationCreate):
    db_location = models.Location(**location.dict())
    db.add(db_location)
    db.commit()
    db.refresh(db_location)
    return db_location

def update_location(db: Session, location_id: int, location: schemas.LocationUpdate):
    db_location = db.query(models.Location).filter(models.Location.id == location_id).first()
    if db_location:
        update_data = location.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_location, key, value)
        db.commit()
        db.refresh(db_location)
    return db_location

def delete_location(db: Session, location_id: int):
    db_location = db.query(models.Location).filter(models.Location.id == location_id).first()
    if db_location:
        db.delete(db_location)
        db.commit()
    return db_location
