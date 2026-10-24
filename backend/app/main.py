import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from .routers import auth, location, employee, product, inventory, sale, damage_report, admin, stock_transfer

app = FastAPI(title="Safari Sales & Stock Management System")

# Response compression for ultra-fast payload delivery
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Configure CORS
configured_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://localhost:8000,http://127.0.0.1:5173,http://127.0.0.1:8000"
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=configured_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$",
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router)
app.include_router(location.router)
app.include_router(employee.router)
app.include_router(product.router)
app.include_router(inventory.router)
app.include_router(sale.router)
app.include_router(damage_report.router)
app.include_router(admin.router)
app.include_router(stock_transfer.router)

from . import models
from .utils.database import Base, engine, SessionLocal
from .models.employee import Employee
from sqlalchemy import text

@app.on_event("startup")
def on_startup():
    try:
        Base.metadata.create_all(bind=engine)
        
        # Schema migration: verify and add newly introduced columns to existing tables
        from sqlalchemy import inspect
        inspector = inspect(engine)
        table_names = inspector.get_table_names()
        
        with engine.connect() as conn:
            # 1. monthly_stocks schema migration
            if "monthly_stocks" in table_names:
                ms_cols = {c["name"] for c in inspector.get_columns("monthly_stocks")}
                ms_additions = [
                    ("manual_receiving_stock", "INTEGER"),
                    ("is_receiving_manually_edited", "BOOLEAN DEFAULT FALSE"),
                    ("receiving_edit_reason", "TEXT"),
                    ("manual_closing_stock", "INTEGER"),
                    ("is_closing_manually_edited", "BOOLEAN DEFAULT FALSE"),
                    ("closing_edit_reason", "TEXT"),
                ]
                for col_name, col_type in ms_additions:
                    if col_name not in ms_cols:
                        try:
                            conn.execute(text(f"ALTER TABLE monthly_stocks ADD COLUMN {col_name} {col_type}"))
                            conn.commit()
                        except Exception:
                            conn.rollback()

            # 2. stock_transfers schema migration
            if "stock_transfers" in table_names:
                st_cols = {c["name"] for c in inspector.get_columns("stock_transfers")}
                st_additions = [
                    ("dispatched_quantity", "INTEGER DEFAULT 0"),
                    ("received_quantity", "INTEGER"),
                    ("has_mismatch", "BOOLEAN DEFAULT FALSE"),
                    ("mismatch_quantity", "INTEGER DEFAULT 0"),
                    ("mismatch_notes", "TEXT"),
                    ("sent_by_id", "INTEGER"),
                    ("sent_at", "TIMESTAMP"),
                    ("received_by_id", "INTEGER"),
                    ("received_at", "TIMESTAMP"),
                    ("notes", "TEXT"),
                ]
                for col_name, col_type in st_additions:
                    if col_name not in st_cols:
                        try:
                            conn.execute(text(f"ALTER TABLE stock_transfers ADD COLUMN {col_name} {col_type}"))
                            conn.commit()
                        except Exception:
                            conn.rollback()

            # High-performance database indexing verification
            indexes = [
                "CREATE INDEX IF NOT EXISTS ix_inventory_product_location ON inventory (product_id, location_id)",
                "CREATE INDEX IF NOT EXISTS ix_inventory_product_id ON inventory (product_id)",
                "CREATE INDEX IF NOT EXISTS ix_inventory_location_id ON inventory (location_id)",
                "CREATE INDEX IF NOT EXISTS ix_sales_sale_date ON sales (sale_date)",
                "CREATE INDEX IF NOT EXISTS ix_sales_employee_id ON sales (employee_id)",
                "CREATE INDEX IF NOT EXISTS ix_sales_location_id ON sales (location_id)",
                "CREATE INDEX IF NOT EXISTS ix_sale_items_sale_id ON sale_items (sale_id)",
                "CREATE INDEX IF NOT EXISTS ix_sale_items_product_id ON sale_items (product_id)",
                "CREATE INDEX IF NOT EXISTS ix_damage_reports_report_date ON damage_reports (report_date)",
                "CREATE INDEX IF NOT EXISTS ix_damage_reports_employee_id ON damage_reports (employee_id)",
                "CREATE INDEX IF NOT EXISTS ix_damage_reports_location_id ON damage_reports (location_id)",
                "CREATE INDEX IF NOT EXISTS ix_damage_reports_status ON damage_reports (status)",
                "CREATE INDEX IF NOT EXISTS ix_damage_report_items_report_id ON damage_report_items (damage_report_id)",
                "CREATE INDEX IF NOT EXISTS ix_damage_report_items_product_id ON damage_report_items (product_id)",
                "CREATE INDEX IF NOT EXISTS ix_damage_photos_report_id ON damage_photos (damage_report_id)",
            ]
            for idx_stmt in indexes:
                try:
                    conn.execute(text(idx_stmt))
                except Exception:
                    pass
            conn.commit()

        db = SessionLocal()
        try:
            admin = db.query(Employee).filter(Employee.role == "admin").first()
            if not admin:
                bootstrap_password = os.getenv("BOOTSTRAP_ADMIN_PASSWORD")
                if os.getenv("APP_ENV", "development") == "production" and not bootstrap_password:
                    raise RuntimeError("BOOTSTRAP_ADMIN_PASSWORD is required in production")
                admin_user = Employee(
                    employee_id="admin",
                    email="admin@example.com",
                    name="Admin User",
                    role="admin",
                    status="active",
                )
                admin_user.set_password(bootstrap_password or "canteen@123")
                db.add(admin_user)
                db.commit()

            # Automatically seed 8 canteen stores, employees, and 100 SKUs on Render/cloud
            from .utils.seed_data import seed_database_if_empty
            seed_database_if_empty(db)

            # Apply persistent credential overrides (ensures changed passwords survive container restarts)
            from .utils.credential_store import apply_credential_overrides_to_db
            apply_credential_overrides_to_db(db)
        finally:
            db.close()
    except RuntimeError:
        raise
    except Exception as e:
        print(f"Startup DB init notice: {e}")

@app.api_route("/api/health", methods=["GET", "HEAD"])
def health_check():
    database_status = "ok"
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:
        database_status = "unavailable"
    return {
        "system": "Safari Sales & Stock Management System",
        "status": "online" if database_status == "ok" else "degraded",
        "database": database_status,
        "version": "2.0.0"
    }

# Unified SPA Frontend Serving
FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

if FRONTEND_DIST.exists() and (FRONTEND_DIST / "index.html").exists():
    if (FRONTEND_DIST / "assets").exists():
        app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

    # PWA Service Worker (Explicit headers required by modern browsers)
    @app.api_route("/sw.js", methods=["GET", "HEAD"])
    async def serve_sw():
        sw_path = FRONTEND_DIST / "sw.js"
        if sw_path.exists():
            return FileResponse(
                sw_path,
                media_type="application/javascript",
                headers={
                    "Service-Worker-Allowed": "/",
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                }
            )
        return FileResponse(FRONTEND_DIST / "index.html")

    # Web App Manifest
    @app.api_route("/manifest.json", methods=["GET", "HEAD"])
    async def serve_manifest():
        m_path = FRONTEND_DIST / "manifest.json"
        if m_path.exists():
            return FileResponse(
                m_path,
                media_type="application/manifest+json",
                headers={"Cache-Control": "no-cache"}
            )
        return FileResponse(FRONTEND_DIST / "index.html")

    @app.api_route("/", methods=["GET", "HEAD"])
    async def serve_index():
        return FileResponse(FRONTEND_DIST / "index.html")

    @app.api_route("/{full_path:path}", methods=["GET", "HEAD"])
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
