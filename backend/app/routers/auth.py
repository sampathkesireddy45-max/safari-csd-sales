from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
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
    employee = db.query(Employee).filter(
        (func.lower(Employee.email) == identifier.lower()) |
        (func.lower(Employee.employee_id) == identifier.lower())
    ).first()

    if not employee or not employee.verify_password(creds.password):
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
