import os
import io
import uuid
from pathlib import Path
from PIL import Image
from fastapi import HTTPException, status, UploadFile

# Upload directory configuration
BASE_DIR = Path(__file__).resolve().parent.parent.parent
UPLOAD_DIR = BASE_DIR / "uploads" / "damage_photos"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Validation constants
MAX_FILE_SIZE = int(os.getenv("MAX_DAMAGE_PHOTO_SIZE", 10 * 1024 * 1024))  # 10 MB default
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_PIL_FORMATS = {"JPEG", "PNG", "WEBP"}

def validate_and_process_photo(file_bytes: bytes, original_filename: str) -> dict:
    """
    Validates uploaded photo by size, mime-type, and magic bytes.
    Compresses and strips metadata to optimize storage and security.
    Returns metadata dict.
    """
    # 1. Size check
    if len(file_bytes) > MAX_FILE_SIZE:
        max_mb = MAX_FILE_SIZE // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Photo exceeds maximum allowed size of {max_mb}MB."
        )

    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty."
        )

    # 2. File integrity and format check using Pillow
    try:
        image = Image.open(io.BytesIO(file_bytes))
        image.verify()  # Verifies file integrity
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please upload a valid JPG, PNG, or WEBP image."
        )

    # Re-open after verify() (Pillow requirement)
    try:
        image = Image.open(io.BytesIO(file_bytes))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please upload a valid JPG, PNG, or WEBP image."
        )

    format_name = image.format
    if format_name not in ALLOWED_PIL_FORMATS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please upload a valid JPG, PNG, or WEBP image."
        )

    # 3. Compression, Resizing & Metadata Stripping
    max_dim = 1920
    if image.width > max_dim or image.height > max_dim:
        image.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

    # Generate unique storage key
    ext = "jpg" if format_name == "JPEG" else format_name.lower()
    storage_key = f"{uuid.uuid4().hex}.{ext}"
    target_path = UPLOAD_DIR / storage_key

    # Save cleanly without EXIF metadata
    output_buffer = io.BytesIO()
    if format_name == "JPEG":
        if image.mode in ("RGBA", "P"):
            image = image.convert("RGB")
        image.save(output_buffer, format="JPEG", quality=85, optimize=True)
        mime_type = "image/jpeg"
    elif format_name == "PNG":
        image.save(output_buffer, format="PNG", optimize=True)
        mime_type = "image/png"
    elif format_name == "WEBP":
        image.save(output_buffer, format="WEBP", quality=85)
        mime_type = "image/webp"
    else:
        if image.mode in ("RGBA", "P"):
            image = image.convert("RGB")
        image.save(output_buffer, format="JPEG", quality=85, optimize=True)
        mime_type = "image/jpeg"

    processed_bytes = output_buffer.getvalue()
    with open(target_path, "wb") as f:
        f.write(processed_bytes)

    return {
        "storage_key": storage_key,
        "photo_url": f"/damages/photos/file/{storage_key}",
        "original_filename": original_filename or storage_key,
        "mime_type": mime_type,
        "file_size": len(processed_bytes),
    }

def get_photo_path(storage_key: str) -> Path:
    """Returns absolute file path for a stored photo, ensuring path traversal safety."""
    safe_key = os.path.basename(storage_key)
    path = UPLOAD_DIR / safe_key
    if not path.exists() or not path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo file not found on disk"
        )
    return path

def delete_photo_file(storage_key: str) -> bool:
    """Safely removes a stored photo file."""
    try:
        safe_key = os.path.basename(storage_key)
        path = UPLOAD_DIR / safe_key
        if path.exists():
            path.unlink()
            return True
    except Exception:
        pass
    return False
