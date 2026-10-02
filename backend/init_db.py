from app import models
from app.utils import database
from app.models.employee import Employee

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
            admin_user.set_password("admin123")  # You should change this password
            db.add(admin_user)
            db.commit()
            print("Admin user created: admin@example.com / admin123")
        else:
            print("Admin user already exists.")
    finally:
        db.close()

if __name__ == "__main__":
    init_admin()

