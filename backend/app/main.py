import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from .routers import auth, location, employee, product, inventory, sale, damage_report, admin

app = FastAPI(title="Safari Sales & Stock Management System")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(location.router)
app.include_router(employee.router)
app.include_router(product.router)
app.include_router(inventory.router)
app.include_router(sale.router)
app.include_router(damage_report.router)
app.include_router(admin.router)

from .utils.database import Base, engine, SessionLocal
from .models.employee import Employee

@app.on_event("startup")
def on_startup():
    try:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        try:
            admin = db.query(Employee).filter(Employee.role == "admin").first()
            if not admin:
                admin_user = Employee(
                    employee_id="admin",
                    email="admin@example.com",
                    name="Admin User",
                    role="admin",
                    status="active",
                )
                admin_user.set_password("canteen@123")
                db.add(admin_user)
                db.commit()
        finally:
            db.close()
    except Exception as e:
        print(f"Startup DB init notice: {e}")

@app.get("/api/health")
async def health_check():
    return {
        "system": "Safari Sales & Stock Management System",
        "status": "online",
        "version": "2.0.0"
    }

# Unified SPA Frontend Serving
FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

if FRONTEND_DIST.exists() and (FRONTEND_DIST / "index.html").exists():
    if (FRONTEND_DIST / "assets").exists():
        app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

    @app.get("/")
    async def serve_index():
        return FileResponse(FRONTEND_DIST / "index.html")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        target = FRONTEND_DIST / full_path
        if target.is_file():
            return FileResponse(target)
        return FileResponse(FRONTEND_DIST / "index.html")
else:
    @app.get("/")
    async def root():
        return {
            "system": "Safari Sales & Stock Management System",
            "status": "online",
            "version": "2.0.0"
        }

