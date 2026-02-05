from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.deps import require_auth
from app.models.tables import User


router = APIRouter(prefix="/api/users", tags=["users"])


class UserMeResponse(BaseModel):
    id: str
    email: str
    name: Optional[str]
    image: Optional[str]
    credits_balance: int

    class Config:
        from_attributes = True


@router.get("/me", response_model=UserMeResponse)
async def get_me(user: User = Depends(require_auth)):
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "image": user.image,
        "credits_balance": user.credits_balance,
    }

