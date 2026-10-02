from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from ..models.employee import Employee
from ..utils.database import get_db
import os
from datetime import datetime, timedelta
from jose import jwt, JWTError
from typing import Optional

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "safari-secret-key-2026-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

security = HTTPBearer(auto_error=False)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    token_param: Optional[str] = Query(None, alias="token"),
    db: Session = Depends(get_db)
) -> Employee:
    raw_token = None
    if credentials:
        raw_token = credentials.credentials
    elif token_param:
        raw_token = token_param

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    email = None
    # Try decoding as JWT
    try:
        payload = jwt.decode(raw_token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub") or payload.get("email")
    except JWTError:
        # Fallback for plain email token in development
        if "@" in raw_token:
            email = raw_token

    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    employee = db.query(Employee).filter(Employee.email == email).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Employee account not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return employee

def get_current_active_user(current_user: Employee = Depends(get_current_user)) -> Employee:
    if current_user.status != "active":
        raise HTTPException(status_code=400, detail="Account is inactive")
    return current_user

def get_current_active_admin_user(current_user: Employee = Depends(get_current_active_user)) -> Employee:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin permissions required")
    return current_user
