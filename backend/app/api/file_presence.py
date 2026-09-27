"""Stored-file presence checks shared by the endpoints that need a document's
bytes (the reader's signed link, reparse, layout translation).

About a hundred documents uploaded before 2026-06-19 lost their original
file in the ephemeral-disk wipe (see docs/ARCHITECTURE.md §10), while their
pages, chunks and vectors survived. Those documents stay fully usable for
chat, citations and Quote Finder; only operations that need the file itself
are refused, with a permanent 410 ``FILE_MISSING`` the frontend can explain.
"""
from __future__ import annotations

import asyncio
from typing import Literal

from fastapi import HTTPException

from app.services.storage_service import storage_service

FileVariant = Literal["original", "converted"]


def file_missing_detail(variant: FileVariant) -> dict[str, str]:
    return {
        "error": "FILE_MISSING",
        "message": "The stored file for this document no longer exists",
        "variant": variant,
    }


async def require_stored_file(
    storage_key: str,
    *,
    variant: FileVariant,
    unavailable_status: int,
    unavailable_detail: dict[str, str],
) -> None:
    """Raise 410 FILE_MISSING when the object is gone (NoSuchKey only).

    Any other storage failure raises ``unavailable_status`` instead: an
    outage must never be reported as permanent loss. No caching on purpose,
    so a restored object is served again on the next request.
    """
    try:
        exists = await asyncio.to_thread(storage_service.object_exists, storage_key)
    except Exception:
        raise HTTPException(status_code=unavailable_status, detail=unavailable_detail)
    if not exists:
        # 410 is heuristically cacheable; a cached answer would keep reporting
        # the loss after the object is restored.
        raise HTTPException(
            status_code=410,
            detail=file_missing_detail(variant),
            headers={"Cache-Control": "private, no-store"},
        )
