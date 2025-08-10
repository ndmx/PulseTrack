from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy import text
from db.connect import engine


def ensure_audit_table() -> None:
    with engine.begin() as conn:
        conn.execute(text(
            """
            CREATE TABLE IF NOT EXISTS audit_log (
                id SERIAL PRIMARY KEY,
                ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                event_type VARCHAR(64) NOT NULL,
                subject VARCHAR(255),
                details TEXT
            )
            """
        ))


def log_event(event_type: str, subject: Optional[str] = None, details: Optional[str] = None) -> None:
    try:
        with engine.begin() as conn:
            conn.execute(
                text("INSERT INTO audit_log(event_type, subject, details) VALUES (:t, :s, :d)"),
                {"t": event_type, "s": subject, "d": details},
            )
    except Exception:
        # Swallow errors to avoid breaking caller on logging failure
        pass


