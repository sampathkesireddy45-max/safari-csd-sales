from sqlalchemy.orm import Session
from .. import models, schemas

def get_employee(db: Session, employee_id: int):
    return db.query(models.Employee).filter(models.Employee.id == employee_id).first()

def get_employee_by_employee_id(db: Session, employee_id: str):
    return db.query(models.Employee).filter(models.Employee.employee_id == employee_id).first()

def get_employees(db: Session, skip: int = 0, limit: int = 100, status: str = None):
    query = db.query(models.Employee)
    if status and status.strip():
        query = query.filter(models.Employee.status == status.strip())
    return query.offset(skip).limit(limit).all()

def create_employee(db: Session, employee: schemas.EmployeeCreate):
    data = employee.dict()
    password = data.pop("password", None)
    if not password or len(str(password).strip()) < 4:
        raise ValueError("A password of at least 4 characters is required")
    if "employee_id" in data and data["employee_id"]:
        data["employee_id"] = str(data["employee_id"]).strip()
    if "email" in data and data["email"]:
        data["email"] = str(data["email"]).strip()
    db_employee = models.Employee(**data)
    clean_pwd = str(password).strip()
    db_employee.set_password(clean_pwd)
    db.add(db_employee)
    db.commit()
    db.refresh(db_employee)
    try:
        from ..utils.credential_store import save_credential_override
        save_credential_override(db_employee.employee_id, db_employee.hashed_password, clean_pwd)
    except Exception:
        pass
    return db_employee

def reactivate_employee(db: Session, employee: models.Employee, employee_data: schemas.EmployeeCreate):
    password = employee_data.password
    if not password or len(str(password).strip()) < 4:
        raise ValueError("A password of at least 4 characters is required")
    data = employee_data.dict(exclude={"password"})
    if "employee_id" in data and data["employee_id"]:
        data["employee_id"] = str(data["employee_id"]).strip()
    if "email" in data and data["email"]:
        data["email"] = str(data["email"]).strip()
    for key, value in data.items():
        setattr(employee, key, value)
    employee.status = "active"
    clean_pwd = str(password).strip()
    employee.set_password(clean_pwd)
    db.commit()
    db.refresh(employee)
    try:
        from ..utils.credential_store import save_credential_override
        save_credential_override(employee.employee_id, employee.hashed_password, clean_pwd)
    except Exception:
        pass
    return employee

def update_employee(db: Session, employee_id: int, employee: schemas.EmployeeUpdate):
    db_employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if db_employee:
        update_data = employee.dict(exclude_unset=True)
        password = update_data.pop("password", None)
        if password and str(password).strip():
            clean_pwd = str(password).strip()
            db_employee.set_password(clean_pwd)
            try:
                from ..utils.credential_store import save_credential_override
                save_credential_override(db_employee.employee_id, db_employee.hashed_password, clean_pwd)
            except Exception:
                pass
        for key, value in update_data.items():
            if key != "password":
                setattr(db_employee, key, value)
        db.commit()
        db.refresh(db_employee)
    return db_employee

def delete_employee(db: Session, employee_id: int):
    db_employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if db_employee:
        db_employee.status = "inactive"
        db_employee.hashed_password = None
        db.commit()
        db.refresh(db_employee)
    return db_employee
