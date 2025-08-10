import os
from typing import Optional
from sqlalchemy import create_engine

# Prefer Streamlit secrets in hosting; fall back to environment/.env locally
def _get_db_url() -> Optional[str]:
    # Try unified URL first (e.g., postgresql://user:pass@host:port/db?sslmode=require)
    try:
        import streamlit as st  # type: ignore
        if 'DB_URL' in st.secrets:
            return st.secrets['DB_URL']
        # Or build from parts in secrets
        if all(k in st.secrets for k in ['DB_USER', 'DB_PASS', 'DB_HOST', 'DB_NAME']):
            user = st.secrets['DB_USER']
            pwd = st.secrets.get('DB_PASS', '')
            host = st.secrets['DB_HOST']
            name = st.secrets['DB_NAME']
            port = st.secrets.get('DB_PORT', '')
            sslmode = st.secrets.get('DB_SSLMODE', 'require')
            hostport = f"{host}:{port}" if port else host
            return f"postgresql://{user}:{pwd}@{hostport}/{name}?sslmode={sslmode}"
    except Exception:
        pass

    # Fallback to environment variables (supports unified URL or parts)
    if os.getenv('DB_URL'):
        return os.getenv('DB_URL')
    user = os.getenv('DB_USER')
    pwd = os.getenv('DB_PASS', '')
    host = os.getenv('DB_HOST')
    name = os.getenv('DB_NAME')
    port = os.getenv('DB_PORT', '')
    sslmode = os.getenv('DB_SSLMODE')  # optional when local
    if user and host and name:
        hostport = f"{host}:{port}" if port else host
        suffix = f"?sslmode={sslmode}" if sslmode else ""
        return f"postgresql://{user}:{pwd}@{hostport}/{name}{suffix}"
    return None


db_url = _get_db_url()
if not db_url:
    raise RuntimeError("Database configuration not found. Set DB_URL or DB_USER/DB_PASS/DB_HOST/DB_NAME (and optionally DB_PORT, DB_SSLMODE).")

engine = create_engine(db_url)
