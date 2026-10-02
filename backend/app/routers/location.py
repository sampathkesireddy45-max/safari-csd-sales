from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from .. import schemas, crud, models
from ..utils.database import get_db
from ..utils.auth import get_current_active_user, get_current_active_admin_user

router = APIRouter(
    prefix="/locations",
    tags=["locations"],
    responses={404: {"description": "Not found"}},
)

import urllib.request
import urllib.parse
import json
import random

def search_real_world_locations(query: str):
    clean_query = query.strip()
    if not clean_query or len(clean_query) < 2:
        return []
    
    results = []
    # 1. Try Photon (fast, typo-tolerant)
    try:
        url = f"https://photon.komoot.io/api/?q={urllib.parse.quote(clean_query)}&limit=7"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        res = urllib.request.urlopen(req, timeout=4)
        data = json.loads(res.read().decode())
        for f in data.get("features", []):
            coords = f.get("geometry", {}).get("coordinates", [])
            props = f.get("properties", {})
            if len(coords) >= 2:
                name = props.get("name") or clean_query
                parts = [props.get("street"), props.get("locality"), props.get("district"), props.get("city"), props.get("state"), props.get("country")]
                addr = ", ".join([str(p) for p in parts if p])
                results.append({
                    "name": name,
                    "address": addr or name,
                    "latitude": round(float(coords[1]), 6),
                    "longitude": round(float(coords[0]), 6),
                    "city": props.get("city") or props.get("locality") or props.get("state") or "",
                    "country": props.get("country") or ""
                })
    except Exception:
        pass

    # 2. Fallback to Nominatim if photon had 0 results
    if not results:
        try:
            url = f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(clean_query)}&format=json&limit=5&addressdetails=1"
            req = urllib.request.Request(url, headers={"User-Agent": "SafariSalesPlatform/2.0"})
            res = urllib.request.urlopen(req, timeout=4)
            data = json.loads(res.read().decode())
            for item in data:
                results.append({
                    "name": item.get("name") or item.get("display_name", "").split(",")[0],
                    "address": item.get("display_name"),
                    "latitude": round(float(item.get("lat")), 6),
                    "longitude": round(float(item.get("lon")), 6),
                    "city": item.get("address", {}).get("city") or item.get("address", {}).get("town") or "",
                    "country": item.get("address", {}).get("country", "")
                })
        except Exception:
            pass

    return results

@router.post("/", response_model=schemas.Location)
def create_location(location: schemas.LocationCreate, db: Session = Depends(get_db), current_user: models.Employee = Depends(get_current_active_admin_user)):
    return crud.create_location(db=db, location=location)

@router.get("/search-real")
def search_real_locations(q: str, current_user: models.Employee = Depends(get_current_active_user)):
    """
    Search real geographic locations via OpenStreetMap geocoding.
    Ensures that only real-world verified places and coordinates can be entered.
    """
    if not q or len(q.strip()) < 2:
        return []
    return search_real_world_locations(q)

@router.post("/resolve-real", response_model=schemas.Location)
def resolve_or_create_real_location(
    req: schemas.ResolveRealLocationRequest,
    db: Session = Depends(get_db),
    current_user: models.Employee = Depends(get_current_active_admin_user)
):
    """
    Validates a real-world location. If it already exists in the database, returns it.
    Otherwise, automatically registers the verified real place as an active store node with real GPS.
    """
    from sqlalchemy import func
    # Match existing store by exact name or very close GPS proximity (< 250m)
    existing = db.query(models.Location).filter(
        func.lower(models.Location.name) == req.name.strip().lower()
    ).first()
    
    if not existing:
        existing = db.query(models.Location).filter(
            func.abs(models.Location.latitude - req.latitude) < 0.0025,
            func.abs(models.Location.longitude - req.longitude) < 0.0025
        ).first()

    if existing:
        return existing

    # Create new real store location
    rand_code = f"LOC{random.randint(100, 999)}"
    new_loc = models.Location(
        location_id=rand_code,
        name=req.name.strip(),
        address=req.address.strip() if req.address else req.name.strip(),
        latitude=req.latitude,
        longitude=req.longitude,
        is_active=True
    )
    db.add(new_loc)
    db.commit()
    db.refresh(new_loc)
    return new_loc

@router.get("/", response_model=list[schemas.Location])
def read_locations(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.Employee = Depends(get_current_active_user)):
    locations = crud.get_locations(db, skip=skip, limit=limit)
    return locations

@router.get("/{location_id}", response_model=schemas.Location)
def read_location(location_id: int, db: Session = Depends(get_db), current_user: models.Employee = Depends(get_current_active_user)):
    db_location = crud.get_location(db, location_id=location_id)
    if db_location is None:
        raise HTTPException(status_code=404, detail="Location not found")
    return db_location

@router.put("/{location_id}", response_model=schemas.Location)
def update_location(location_id: int, location: schemas.LocationUpdate, db: Session = Depends(get_db), current_user: models.Employee = Depends(get_current_active_admin_user)):
    db_location = crud.update_location(db, location_id=location_id, location=location)
    if db_location is None:
        raise HTTPException(status_code=404, detail="Location not found")
    return db_location

@router.delete("/{location_id}", response_model=schemas.Location)
def delete_location(location_id: int, db: Session = Depends(get_db), current_user: models.Employee = Depends(get_current_active_admin_user)):
    db_location = crud.delete_location(db, location_id=location_id)
    if db_location is None:
        raise HTTPException(status_code=404, detail="Location not found")
    return db_location
