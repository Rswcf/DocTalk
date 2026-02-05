import logging
from typing import AsyncGenerator, Optional
from uuid import UUID

from fastapi import Depends, HTTPException, Request
from jose import JWTError, jwt
from jose.jwt import ExpiredSignatureError, JWTClaimsError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.database import AsyncSessionLocal
from app.models.tables import User

logger = logging.getLogger(__name__)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide an async SQLAlchemy session for FastAPI dependencies."""
    async with AsyncSessionLocal() as session:  # type: AsyncSession
        yield session


async def get_current_user_optional(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> Optional[User]:
    """Extract user from JWT if present. Returns None for guests."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split(" ")[1]
    try:
        # Validate AUTH_SECRET is configured
        if not settings.AUTH_SECRET:
            logger.error("AUTH_SECRET not configured")
            return None

        payload = jwt.decode(
            token,
            settings.AUTH_SECRET,
            algorithms=["HS256"],
            options={
                "verify_aud": False,
                "verify_exp": True,  # Explicitly verify expiration
                "require_exp": True,  # Require exp claim
                "require_iat": True,  # Require issued-at claim
                "require_sub": True,  # Require subject claim
            },
        )
        user_id = payload.get("sub")
        if not user_id:
            return None
        return await db.get(User, UUID(user_id))
    except ExpiredSignatureError:
        logger.debug("JWT token expired")
        return None
    except JWTClaimsError as e:
        logger.debug("JWT claims error: %s", e)
        return None
    except JWTError as e:
        logger.debug("JWT decode error: %s", e)
        return None


async def require_auth(
    user: Optional[User] = Depends(get_current_user_optional),
) -> User:
    """Require authenticated user, raise 401 if not."""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user
