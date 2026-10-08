from app import models
from app.utils import database
from app.models.employee import Employee
import os

# Create tables
database.Base.metadata.create_all(bind=database.engine)

# Create initial admin if not exists
def init_admin():
    db = database.SessionLocal()
    try:
        admin = db.query(Employee).filter(Employee.role == "admin").first()
        if not admin:
            admin_user = Employee(
                employee_id="ADMIN001",
                email="admin@example.com",
                name="Admin User",
                role="admin",
                status="active",
            )
            password = os.getenv("BOOTSTRAP_ADMIN_PASSWORD")
            if not password or len(password) < 8:
                raise RuntimeError("Set BOOTSTRAP_ADMIN_PASSWORD to an 8+ character password before initializing")
            admin_user.set_password(password)
            db.add(admin_user)
            db.commit()
            print("Admin user created from BOOTSTRAP_ADMIN_PASSWORD")
        else:
            print("Admin user already exists.")
    finally:
        db.close()

if __name__ == "__main__":
    init_admin()
