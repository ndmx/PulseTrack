import os
from typing import Optional, Tuple
from urllib.parse import urlparse, parse_qs, urlunparse
import socket
from sqlalchemy import create_engine

# Prefer Streamlit secrets in hosting; fall back to environment/.env locally
def _get_db_url() -> Tuple[Optional[str], str]:
    # Try unified URL first (e.g., postgresql://user:pass@host:port/db?sslmode=require)
    try:
        import streamlit as st  # type: ignore
        if 'DB_URL' in st.secrets:
            return st.secrets['DB_URL'], 'secrets:DB_URL'
        # Or build from parts in secrets
        if all(k in st.secrets for k in ['DB_USER', 'DB_PASS', 'DB_HOST', 'DB_NAME']):
            user = st.secrets['DB_USER']
            pwd = st.secrets.get('DB_PASS', '')
            host = st.secrets['DB_HOST']
            name = st.secrets['DB_NAME']
            port = st.secrets.get('DB_PORT', '')
            sslmode = st.secrets.get('DB_SSLMODE', 'require')
            hostport = f"{host}:{port}" if port else host
            return f"postgresql://{user}:{pwd}@{hostport}/{name}?sslmode={sslmode}", 'secrets:parts'
    except Exception:
        pass

    # Fallback to environment variables (supports unified URL or parts)
    if os.getenv('DB_URL'):
        return os.getenv('DB_URL'), 'env:DB_URL'
    user = os.getenv('DB_USER')
    pwd = os.getenv('DB_PASS', '')
    host = os.getenv('DB_HOST')
    name = os.getenv('DB_NAME')
    port = os.getenv('DB_PORT', '')
    sslmode = os.getenv('DB_SSLMODE')  # optional when local
    if user and host and name:
        hostport = f"{host}:{port}" if port else host
        suffix = f"?sslmode={sslmode}" if sslmode else ""
        return f"postgresql://{user}:{pwd}@{hostport}/{name}{suffix}", 'env:parts'
    return None, 'none'


db_url, db_source = _get_db_url()
if not db_url:
    raise RuntimeError("Database configuration not found. Set DB_URL or DB_USER/DB_PASS/DB_HOST/DB_NAME (and optionally DB_PORT, DB_SSLMODE).")

parsed = urlparse(db_url)
host = parsed.hostname or ''
port = parsed.port or 5432

# Force IPv4 by resolving hostname to IPv4 and supplying hostaddr via query param
hostaddr = None
try:
    # getaddrinfo with AF_INET ensures IPv4
    infos = socket.getaddrinfo(host, port, socket.AF_INET, socket.SOCK_STREAM)
    if infos:
        hostaddr = infos[0][4][0]
except Exception:
    hostaddr = None

if hostaddr:
    # Append hostaddr to query preserving existing params
    q = parse_qs(parsed.query)
    q['hostaddr'] = [hostaddr]
    # rebuild query string
    query_parts = []
    for k, vals in q.items():
        for v in vals:
            query_parts.append(f"{k}={v}")
    new_query = '&'.join(query_parts)
    # Rebuild URL with same user/pass/host (hostname kept for SSL cert), but added hostaddr
    parsed = parsed._replace(query=new_query)
    db_url = urlunparse(parsed)

engine = create_engine(db_url)

# Emit a masked one-line summary to logs for diagnosis without leaking secrets
try:
    parsed = urlparse(db_url)
    sslmode = parse_qs(parsed.query).get('sslmode', [''])[0]
    db_name = parsed.path.lstrip('/')
    user = parsed.username or ''
    host = parsed.hostname or ''
    port = parsed.port or ''
    hostaddr_log = parse_qs(parsed.query).get('hostaddr', [''])[0]
    print(f"DB config: source={db_source}, user={user}, host={host}, hostaddr={hostaddr_log}, port={port}, db={db_name}, sslmode={sslmode}")
except Exception:
    pass
