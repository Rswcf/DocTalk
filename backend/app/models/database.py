from __future__ import annotations

import os
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings


def _get_database_url() -> str:
    # Priority: settings.DATABASE_URL -> env DATABASE_URL -> error
    url: Optional[str] = settings.DATABASE_URL or os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not configured")
    return url


# Create async engine and sessionmaker (expire_on_commit=False for FastAPI typical usage)
DATABASE_URL = _get_database_url()
engine_kwargs: dict[str, object] = {"pool_pre_ping": True}

if os.getenv("TESTING") == "1":
    engine_kwargs["poolclass"] = NullPool
else:
    engine_kwargs.update(
        pool_size=10,
        max_overflow=20,
        pool_recycle=1800,
    )

async_engine: AsyncEngine = create_async_engine(DATABASE_URL, **engine_kwargs)
AsyncSessionLocal = async_sessionmaker(async_engine, expire_on_commit=False)
