import os
import re
import urllib.parse
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lifeloop.db")
DEFAULT_SQLITE_URL = f"sqlite:///{DB_PATH}"

def mask_database_url(url_or_text: str) -> str:
    """Masks database passwords in connection strings and error messages for safe logging."""
    if not url_or_text:
        return ""
    # Regex replaces :password@ with :***@ regardless of scheme or special characters
    return re.sub(r'(://[^:]+:)([^@]+)(@)', r'\1***\3', str(url_or_text))

def get_configured_database_url() -> str:
    raw_url = os.getenv("DATABASE_URL")
    if not raw_url or not raw_url.strip():
        # Fallback to local SQLite development database
        return DEFAULT_SQLITE_URL

    url = raw_url.strip()

    # Normalize standard Postgres schemes to explicitly use the installed psycopg (v3) driver
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql://") and not url.startswith("postgresql+"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)

    return url

DATABASE_URL = get_configured_database_url()

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

try:
    engine = create_engine(
        DATABASE_URL,
        connect_args=connect_args,
        pool_pre_ping=True
    )
except Exception as e:
    safe_url = mask_database_url(DATABASE_URL)
    safe_err = mask_database_url(str(e))
    raise RuntimeError(
        f"Failed to initialize database engine for URL '{safe_url}'. "
        f"Ensure driver dependencies (e.g. psycopg[binary]) are installed and URL format is valid: {safe_err}"
    ) from None

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
