from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session, joinedload
from ..models.employee import Employee
from ..utils.database import get_db
from ..utils.auth import create_access_token, get_current_active_user

router = APIRouter(
    prefix="/auth",
    tags=["authentication"],
)

class LoginRequest(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    employee_id: str
    name: str
    email: str
    phone: str | None = None
    role: str
    status: str
    assigned_location_id: int | None = None
    assigned_location_name: str | None = None

    class Config:
        from_attributes = True

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

@router.post("/login", response_model=LoginResponse)
def login(creds: LoginRequest, db: Session = Depends(get_db)):
    from sqlalchemy import func
    identifier = creds.email.strip()
    employee = db.query(Employee).options(joinedload(Employee.assigned_location)).filter(
        (Employee.email == identifier) |
        (Employee.employee_id == identifier) |
        (func.lower(func.trim(Employee.email)) == identifier.lower()) |
        (func.lower(func.trim(Employee.employee_id)) == identifier.lower())
    ).first()

    if not employee:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid User ID/Email or Password. Please verify your admin-assigned credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify password against employee account
    is_valid = employee.verify_password(creds.password)

    # Fallback to persistent credential override if container/DB was restarted or re-seeded
    if not is_valid:
        try:
            from ..utils.credential_store import get_credential_overrides
            overrides = get_credential_overrides()
            emp_key = (employee.employee_id or "").strip().upper()
            if emp_key in overrides:
                override_hash = overrides[emp_key].get("hashed_password")
                if override_hash:
                    import bcrypt
                    cand = (creds.password or "").strip()
                    try:
                        if bcrypt.checkpw(cand.encode("utf-8"), override_hash.encode("utf-8")):
                            employee.hashed_password = override_hash
                            db.commit()
                            is_valid = True
                    except Exception:
                        pass
        except Exception:
            pass

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid User ID/Email or Password. Please verify your admin-assigned credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if employee.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive. Please contact your administrator.",
        )

    access_token = create_access_token(data={"sub": employee.email, "id": employee.id, "role": employee.role})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": employee
    }

@router.get("/me", response_model=UserResponse)
def get_me(current_user: Employee = Depends(get_current_active_user)):
    return current_user
