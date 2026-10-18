import sqlite3
import pandas as pd
from pathlib import Path
from datetime import datetime

EXCEL_PATH = r"C:\Users\sampa\Downloads\INDEX.xlsx"
DB_PATH = Path(__file__).resolve().parent / "test.db"

def run_import():
    print(f"Connecting to database at {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # 1. Inspect existing columns of products
    cur.execute("PRAGMA table_info(products);")
    existing_cols = {col[1] for col in cur.fetchall()}
    print(f"Existing columns in products: {existing_cols}")

    # Add missing columns if any
    cols_to_add = [
        ("brand", "TEXT"),
        ("colour", "TEXT"),
        ("category", "TEXT"),
        ("sub_category", "TEXT"),
        ("case_pack", "INTEGER DEFAULT 1"),
        ("rate_per_pc", "REAL"),
        ("selling_rate", "REAL"),
        ("index_no", "TEXT"),
    ]
    for col_name, col_type in cols_to_add:
        if col_name not in existing_cols:
            print(f"Adding column {col_name} {col_type} to products table")
            cur.execute(f"ALTER TABLE products ADD COLUMN {col_name} {col_type};")

    conn.commit()

    # 2. Clear old dependent demo records and products
    print("Clearing old products and associated records...")
    cur.execute("DELETE FROM inventory_transactions;")
    cur.execute("DELETE FROM sale_items;")
    cur.execute("DELETE FROM sales;")
    cur.execute("DELETE FROM damage_photo_audit_logs;")
    cur.execute("DELETE FROM damage_photos;")
    cur.execute("DELETE FROM damage_report_items;")
    cur.execute("DELETE FROM damage_reports;")
    cur.execute("DELETE FROM inventory;")
    cur.execute("DELETE FROM products;")
    conn.commit()

    # 3. Read Excel file
    print(f"Reading Excel from {EXCEL_PATH}...")
    df = pd.read_excel(EXCEL_PATH)
    print(f"Found {len(df)} rows in Excel sheet.")

    # Get active locations
    cur.execute("SELECT id FROM locations;")
    location_ids = [row[0] for row in cur.fetchall()]
    print(f"Found locations: {location_ids}")

    inserted_count = 0
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

    for idx, row in df.iterrows():
        brand = str(row.get("BRAND", "")).strip() if pd.notnull(row.get("BRAND")) else "SAFARI"
        index_no = str(row.get("INDEX NO.", "")).strip()
        item = str(row.get("ITEM", "")).strip() if pd.notnull(row.get("ITEM")) else ""
        colour = str(row.get("COLOUR", "")).strip() if pd.notnull(row.get("COLOUR")) else ""
        sub_cat = str(row.get("SUB - CATEGORY", "")).strip() if pd.notnull(row.get("SUB - CATEGORY")) else ""
        cat = str(row.get("CATEGORY", "")).strip() if pd.notnull(row.get("CATEGORY")) else ""
        case_pack = int(row.get("CASE PACK", 1)) if pd.notnull(row.get("CASE PACK")) else 1
        
        selling_rate_val = row.get("SELLING RATE/PCS")
        if pd.notnull(selling_rate_val) and str(selling_rate_val).strip() != "":
            rate = float(selling_rate_val)
        else:
            rate = None

        # Clean product_id
        prefix = "SAF" if "SAFARI" in brand.upper() else "UJ"
        product_id = f"{prefix}-{index_no}" if index_no else f"PROD-{idx+1:03d}"

        # Distinct descriptive name: e.g. SENTINEL 56 4W (WINE)
        if colour:
            full_name = f"{item} ({colour})"
        else:
            full_name = item

        description = f"{brand} {cat} - {sub_cat} (Case Pack: {case_pack} pcs)"

        cur.execute(
            """
            INSERT INTO products (
                product_id, index_no, name, description, brand, colour,
                category, sub_category, case_pack, rate_per_pc, selling_rate,
                is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
            """,
            (
                product_id, index_no, full_name, description, brand, colour,
                cat, sub_cat, case_pack, rate, rate, now, now
            )
        )
        db_prod_id = cur.lastrowid
        inserted_count += 1

        # Seed 0 quantity inventory for each location so it appears immediately
        for loc_id in location_ids:
            cur.execute(
                """
                INSERT INTO inventory (product_id, location_id, quantity, last_updated)
                VALUES (?, ?, 0, ?)
                """,
                (db_prod_id, loc_id, now)
            )

    conn.commit()
    conn.close()
    print(f"Successfully inserted {inserted_count} products and initialized inventory!")

if __name__ == "__main__":
    run_import()
