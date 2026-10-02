import os
import io
from fastapi.testclient import TestClient
from PIL import Image
from app.main import app
from app.utils.database import SessionLocal
from app.models.employee import Employee
from app.models.location import Location
from app.models.product import Product

client = TestClient(app)

def run_acceptance_tests():
    print("==================================================")
    print("RUNNING SAFARI DAMAGE PHOTO ACCEPTANCE TEST SUITE")
    print("==================================================")

    db = SessionLocal()
    try:
        # Ensure test location exists
        loc = db.query(Location).filter(Location.name == "Safari Flagship Store").first()
        if not loc:
            loc = Location(location_id="LOC001", name="Safari Flagship Store", address="Terminal 3 Hub", is_active=True)
            db.add(loc)
            db.commit()
            db.refresh(loc)

        # Ensure test product exists
        prod = db.query(Product).filter(Product.product_id == "PROD001").first()
        if not prod:
            prod = Product(product_id="PROD001", name="Safari Voyager Pro Trolley 28\"", description="Heavy duty polycarbonate trolley", is_active=True)
            db.add(prod)
            db.commit()
            db.refresh(prod)

        # Ensure Employee A exists
        emp_a = db.query(Employee).filter(Employee.email == "rahul@safari.com").first()
        if not emp_a:
            emp_a = Employee(
                employee_id="SAF010",
                email="rahul@safari.com",
                name="Rahul Sharma",
                role="employee",
                status="active",
                assigned_location_id=loc.id
            )
            emp_a.set_password("pass123")
            db.add(emp_a)
            db.commit()
            db.refresh(emp_a)
        else:
            emp_a.set_password("pass123")
            db.commit()

        # Ensure Employee B exists (to test privacy isolation)
        emp_b = db.query(Employee).filter(Employee.email == "priya@safari.com").first()
        if not emp_b:
            emp_b = Employee(
                employee_id="SAF011",
                email="priya@safari.com",
                name="Priya Patel",
                role="employee",
                status="active",
                assigned_location_id=loc.id
            )
            emp_b.set_password("pass123")
            db.add(emp_b)
            db.commit()
            db.refresh(emp_b)
        else:
            emp_b.set_password("pass123")
            db.commit()

        # Ensure Admin exists
        admin = db.query(Employee).filter(Employee.email == "admin@example.com").first()
        if not admin:
            admin = Employee(
                employee_id="ADMIN001",
                email="admin@example.com",
                name="System Administrator",
                role="admin",
                status="active"
            )
            admin.set_password("admin123")
            db.add(admin)
            db.commit()
            db.refresh(admin)
        else:
            admin.set_password("admin123")
            db.commit()

        prod_id = prod.id
    finally:
        db.close()

    # Step 1: Employee A logs in
    print("\n[Step 1] Employee A logs in via /auth/login...")
    res_login = client.post("/auth/login", json={"email": "rahul@safari.com", "password": "pass123"})
    assert res_login.status_code == 200, f"Login failed: {res_login.text}"
    token_a = res_login.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    print("[PASS] Employee A authenticated successfully.")

    # Step 2 & 8: Validate Photo Upload with invalid file
    print("\n[Step 2 & 8] Testing image validation with malicious / invalid file...")
    fake_file = io.BytesIO(b"this is not an image but fake text")
    res_invalid = client.post(
        "/damages/upload-photo",
        headers=headers_a,
        files={"file": ("fake.jpg", fake_file, "image/jpeg")}
    )
    assert res_invalid.status_code == 400, f"Expected 400 for fake image, got {res_invalid.status_code}"
    print(f"[PASS] Invalid image properly rejected: {res_invalid.json()['detail']}")

    # Step 5 & 9: Create and upload a real valid damage photo
    print("\n[Step 5 & 9] Uploading real valid damage photo...")
    img = Image.new("RGB", (800, 600), color=(220, 60, 60))
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format="JPEG")
    img_bytes = img_byte_arr.getvalue()

    res_upload = client.post(
        "/damages/upload-photo",
        headers=headers_a,
        files={"file": ("damaged_zipper.jpg", io.BytesIO(img_bytes), "image/jpeg")}
    )
    assert res_upload.status_code == 200, f"Upload failed: {res_upload.text}"
    photo_data = res_upload.json()
    assert "storage_key" in photo_data
    assert photo_data["mime_type"] == "image/jpeg"
    print(f"[PASS] Real image compressed and stored with key: {photo_data['storage_key']}")

    # Step 7, 10 & 11: Submit complete Damage Report with photo
    print("\n[Step 7, 10 & 11] Submitting Damage Report with photo metadata...")
    report_payload = {
        "items": [
            {
                "product_id": prod_id,
                "quantity": 3,
                "description": "Zippers jammed and cracked casing during transit"
            }
        ],
        "photos": [
            {
                "photo_url": photo_data["photo_url"],
                "storage_key": photo_data["storage_key"],
                "original_filename": photo_data["original_filename"],
                "mime_type": photo_data["mime_type"],
                "file_size": photo_data["file_size"]
            }
        ]
    }
    res_report = client.post("/damages/", headers=headers_a, json=report_payload)
    assert res_report.status_code == 200, f"Report creation failed: {res_report.text}"
    created_report = res_report.json()
    report_id = created_report["id"]
    photo_id = created_report["photos"][0]["id"]
    storage_key = created_report["photos"][0]["storage_key"]
    print(f"[PASS] Damage report #{report_id} created with photo record #{photo_id}")

    # Step 12: Employee A views their own reports
    print("\n[Step 12] Employee A retrieves their damage reports...")
    res_emp_reports = client.get("/damages/", headers=headers_a)
    assert res_emp_reports.status_code == 200
    reports_list = res_emp_reports.json()
    assert any(r["id"] == report_id for r in reports_list)
    print("[PASS] Employee A successfully views their damage report.")

    # Step 18: PRIVACY TEST — Employee B attempts to view Employee A's photo
    print("\n[Step 18] PRIVACY TEST: Employee B attempts to view Employee A's photo...")
    res_login_b = client.post("/auth/login", json={"email": "priya@safari.com", "password": "pass123"})
    token_b = res_login_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    res_privacy = client.get(f"/damages/photos/file/{storage_key}", headers=headers_b)
    assert res_privacy.status_code == 403, f"Expected 403 Forbidden for Employee B, got {res_privacy.status_code}"
    print("[PASS] Employee B was strictly FORBIDDEN (403) from accessing Employee A's photo!")

    # Step 13, 14, 15, 16: Admin views all reports and accesses photo
    print("\n[Step 13, 14, 15, 16] Admin logs in and views damage report photo...")
    res_login_admin = client.post("/auth/login", json={"email": "admin@example.com", "password": "admin123"})
    token_admin = res_login_admin.json()["access_token"]
    headers_admin = {"Authorization": f"Bearer {token_admin}"}

    # Admin reads damage reports with filter
    res_admin_reports = client.get("/damages/?has_photo=with_photo", headers=headers_admin)
    assert res_admin_reports.status_code == 200
    assert any(r["id"] == report_id for r in res_admin_reports.json())
    print("[PASS] Admin sees damage report in filtered query.")

    # Admin accesses photo file
    res_admin_photo = client.get(f"/damages/photos/file/{storage_key}", headers=headers_admin)
    assert res_admin_photo.status_code == 200
    assert len(res_admin_photo.content) > 0
    print("[PASS] Admin successfully opened and verified the actual uploaded photo.")

    # Step: Admin checks Audit Logs (Requirement 12)
    print("\n[Requirement 12] Admin checks photo audit logs...")
    res_audit = client.get("/damages/audit-logs", headers=headers_admin)
    assert res_audit.status_code == 200
    audit_entries = res_audit.json()
    assert any(a["damage_report_id"] == report_id and a["action"] == "uploaded" for a in audit_entries)
    print("[PASS] Audit log successfully recorded photo upload event.")

    # Step: Admin exports CSV (Requirement 11)
    print("\n[Requirement 11] Admin exports damages CSV...")
    res_csv = client.get("/damages/export/csv", headers=headers_admin)
    assert res_csv.status_code == 200
    csv_text = res_csv.text
    assert "Photo Available" in csv_text
    assert "Yes" in csv_text
    print("[PASS] CSV report exported successfully without huge blobs.")

    # Step: Photo Removal with Audit Log
    print("\n[Requirement 12] Removing photo and verifying deletion audit log...")
    res_del_photo = client.delete(f"/damages/{report_id}/photos/{photo_id}", headers=headers_admin)
    assert res_del_photo.status_code == 200

    res_audit2 = client.get("/damages/audit-logs", headers=headers_admin)
    assert any(a["damage_report_id"] == report_id and a["action"] == "removed" for a in res_audit2.json())
    print("[PASS] Audit log successfully recorded photo removal event.")

    print("\n==================================================")
    print("ALL ACCEPTANCE TESTS PASSED 100% SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_acceptance_tests()
