import zoneinfo
from datetime import datetime, timezone

IST = zoneinfo.ZoneInfo("Asia/Kolkata")

def get_utc_now() -> datetime:
    """Returns naive datetime representing current UTC time."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

def to_ist(dt: datetime | None) -> datetime | None:
    """Converts a database datetime (assumed UTC if naive) to naive IST wall-clock datetime."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(IST).replace(tzinfo=None)
    # Naive datetime from SQLite: treat as UTC and convert to IST
    return dt.replace(tzinfo=timezone.utc).astimezone(IST).replace(tzinfo=None)

def format_ist_date(dt: datetime | None) -> str:
    ist_dt = to_ist(dt)
    if not ist_dt:
        return ""
    return ist_dt.strftime("%Y-%m-%d")

def format_ist_time(dt: datetime | None) -> str:
    ist_dt = to_ist(dt)
    if not ist_dt:
        return ""
    return ist_dt.strftime("%I:%M:%S %p")

def format_ist_datetime(dt: datetime | None) -> str:
    ist_dt = to_ist(dt)
    if not ist_dt:
        return ""
    return ist_dt.strftime("%d %b %Y, %I:%M:%S %p")

def ist_date_to_utc_bounds(date_str: str, is_end_date: bool = False) -> datetime:
    """
    Given an ISO date string 'YYYY-MM-DD' representing an IST calendar date,
    returns the equivalent naive UTC datetime boundary.
    If is_end_date=True, returns the end-of-day boundary (23:59:59.999999 IST).
    """
    dt = datetime.fromisoformat(date_str)
    if is_end_date:
        ist_bound = dt.replace(hour=23, minute=59, second=59, microsecond=999999, tzinfo=IST)
    else:
        ist_bound = dt.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=IST)
    return ist_bound.astimezone(timezone.utc).replace(tzinfo=None)
