from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import AsyncSessionLocal


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide an async SQLAlchemy session for FastAPI dependencies."""
    async with AsyncSessionLocal() as session:  # type: AsyncSession
        yield session
