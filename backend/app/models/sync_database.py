from __future__ import annotations

import os
from typing import Optional

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings


def _get_sync_database_url() -> str:
    """Derive a sync SQLAlchemy URL from DATABASE_URL.

    If DATABASE_URL uses the asyncpg driver (postgresql+asyncpg), convert to a
    sync driver. Prefer psycopg (SQLAlchemy 2.x) if available; otherwise fall
    back to plain 'postgresql://' which typically uses psycopg2.
    """
    url: Optional[str] = settings.DATABASE_URL or os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not configured")
    if "+asyncpg" in url:
        # Try modern psycopg first
        return url.replace("+asyncpg", "+psycopg")
    return url


SYNC_DATABASE_URL = _get_sync_database_url()

# Create sync engine / sessionmaker for Celery workers
sync_engine: Engine = create_engine(SYNC_DATABASE_URL, pool_pre_ping=True, future=True)
SyncSessionLocal = sessionmaker(bind=sync_engine, autoflush=False, autocommit=False, expire_on_commit=False, class_=Session)

