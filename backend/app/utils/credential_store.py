"""
Safari CSD Credential Override & Persistence Service
Ensures employee password changes configured by administrators persist
even across container restarts, ephemeral disk recycling, or database re-seeding.
"""

import json
from pathlib import Path
from sqlalchemy.orm import Session
from ..models.employee import Employee

BASE_DIR = Path(__file__).resolve().parent.parent.parent
CREDENTIALS_FILE = BASE_DIR / "credential_overrides.json"

def save_credential_override(employee_id_str: str, hashed_password: str, plain_password_hint: str = None):
    """
    Saves or updates a credential override record to disk.
    """
    try:
        data = {}
        if CREDENTIALS_FILE.exists():
            try:
                with open(CREDENTIALS_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception:
                data = {}
        
        data[str(employee_id_str).strip().upper()] = {
            "hashed_password": hashed_password,
            "plain_hint": plain_password_hint or ""
        }
        
        with open(CREDENTIALS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"Notice: Could not write credential override: {e}")

def get_credential_overrides() -> dict:
    """
    Reads credential overrides from disk.
    """
    if not CREDENTIALS_FILE.exists():
        return {}
    try:
        with open(CREDENTIALS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def apply_credential_overrides_to_db(db: Session):
    """
    Restores any persistent credential overrides to the database on startup.
    Ensures that employee passwords survive cloud restarts and DB rebuilds.
    """
    overrides = get_credential_overrides()
    if not overrides:
        return

    from sqlalchemy import func
    applied_count = 0
    try:
        for emp_identifier, cred_data in overrides.items():
            hashed_pwd = cred_data.get("hashed_password")
            if not hashed_pwd:
                continue

            emp = db.query(Employee).filter(
                (func.upper(func.trim(Employee.employee_id)) == emp_identifier.upper()) |
                (func.upper(func.trim(Employee.email)) == emp_identifier.upper())
            ).first()

            if emp and emp.hashed_password != hashed_pwd:
                emp.hashed_password = hashed_pwd
                emp.status = "active"
                applied_count += 1
        
        if applied_count > 0:
            db.commit()
            print(f"==> Applied {applied_count} persistent employee credential override(s) to DB.")
    except Exception as e:
        print(f"Notice: Failed to apply credential overrides: {e}")
        db.rollback()
