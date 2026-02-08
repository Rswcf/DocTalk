from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_db_session, require_auth
from app.models.tables import (
    ChatSession,
    Collection,
    Document,
    Message,
    User,
    collection_documents,
)

collections_router = APIRouter(prefix="/api/collections", tags=["collections"])


# --- Schemas ---

class CreateCollectionRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    document_ids: Optional[list[str]] = None


class AddDocumentsRequest(BaseModel):
    document_ids: list[str]


class CollectionBrief(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    document_count: int
    created_at: str

    class Config:
        from_attributes = True


class CollectionDocumentBrief(BaseModel):
    id: str
    filename: str
    status: str
    file_type: Optional[str] = "pdf"


class CollectionDetail(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    documents: list[CollectionDocumentBrief]
    created_at: str
    updated_at: str


# --- Endpoints ---

@collections_router.get("")
async def list_collections(
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    """List user collections with document counts."""
    stmt = (
        select(
            Collection.id,
            Collection.name,
            Collection.description,
            Collection.created_at,
            func.count(collection_documents.c.document_id).label("document_count"),
        )
        .outerjoin(collection_documents, collection_documents.c.collection_id == Collection.id)
        .where(Collection.user_id == user.id)
        .group_by(Collection.id)
        .order_by(Collection.updated_at.desc())
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [
        CollectionBrief(
            id=str(row.id),
            name=row.name,
            description=row.description,
            document_count=row.document_count,
            created_at=row.created_at.isoformat(),
        )
        for row in rows
    ]


@collections_router.post("", status_code=status.HTTP_201_CREATED)
async def create_collection(
    body: CreateCollectionRequest,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    """Create a new collection with optional initial document_ids."""
    coll = Collection(
        name=body.name,
        description=body.description,
        user_id=user.id,
    )
    db.add(coll)
    await db.flush()

    # Add initial documents if provided
    if body.document_ids:
        for did_str in body.document_ids:
            try:
                did = uuid.UUID(did_str)
            except ValueError:
                continue
            doc = await db.get(Document, did)
            if doc and doc.user_id == user.id:
                await db.execute(
                    collection_documents.insert().values(
                        collection_id=coll.id, document_id=did
                    )
                )

    await db.commit()
    await db.refresh(coll)
    return {
        "id": str(coll.id),
        "name": coll.name,
        "created_at": coll.created_at.isoformat(),
    }


@collections_router.get("/{collection_id}")
async def get_collection(
    collection_id: uuid.UUID,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    """Get collection detail with documents list."""
    result = await db.execute(
        select(Collection)
        .options(selectinload(Collection.documents))
        .where(Collection.id == collection_id, Collection.user_id == user.id)
    )
    coll = result.scalar_one_or_none()
    if not coll:
        raise HTTPException(status_code=404)

    docs = [
        CollectionDocumentBrief(
            id=str(d.id),
            filename=d.filename,
            status=d.status,
            file_type=getattr(d, "file_type", "pdf"),
        )
        for d in coll.documents
    ]
    return CollectionDetail(
        id=str(coll.id),
        name=coll.name,
        description=coll.description,
        documents=docs,
        created_at=coll.created_at.isoformat(),
        updated_at=coll.updated_at.isoformat(),
    )


@collections_router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_collection(
    collection_id: uuid.UUID,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    """Delete collection (cascade sessions, keep documents)."""
    coll = await db.get(Collection, collection_id)
    if not coll or coll.user_id != user.id:
        raise HTTPException(status_code=404)
    await db.delete(coll)
    await db.commit()
    return None


@collections_router.post("/{collection_id}/documents", status_code=status.HTTP_201_CREATED)
async def add_documents_to_collection(
    collection_id: uuid.UUID,
    body: AddDocumentsRequest,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    """Add documents to a collection."""
    coll = await db.get(Collection, collection_id)
    if not coll or coll.user_id != user.id:
        raise HTTPException(status_code=404)

    added = 0
    for did_str in body.document_ids:
        try:
            did = uuid.UUID(did_str)
        except ValueError:
            continue
        doc = await db.get(Document, did)
        if not doc or doc.user_id != user.id:
            continue
        # Check if already in collection
        existing = await db.execute(
            select(collection_documents)
            .where(
                collection_documents.c.collection_id == collection_id,
                collection_documents.c.document_id == did,
            )
        )
        if existing.first():
            continue
        await db.execute(
            collection_documents.insert().values(
                collection_id=collection_id, document_id=did
            )
        )
        added += 1

    await db.commit()
    return {"added": added}


@collections_router.delete("/{collection_id}/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_document_from_collection(
    collection_id: uuid.UUID,
    document_id: uuid.UUID,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    """Remove a document from a collection."""
    coll = await db.get(Collection, collection_id)
    if not coll or coll.user_id != user.id:
        raise HTTPException(status_code=404)

    await db.execute(
        collection_documents.delete().where(
            collection_documents.c.collection_id == collection_id,
            collection_documents.c.document_id == document_id,
        )
    )
    await db.commit()
    return None


@collections_router.post("/{collection_id}/sessions", status_code=status.HTTP_201_CREATED)
async def create_collection_session(
    collection_id: uuid.UUID,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    """Create a chat session for a collection (cross-document Q&A)."""
    coll = await db.get(Collection, collection_id)
    if not coll or coll.user_id != user.id:
        raise HTTPException(status_code=404)

    sess = ChatSession(collection_id=collection_id)
    db.add(sess)
    await db.commit()
    await db.refresh(sess)
    return {
        "session_id": str(sess.id),
        "collection_id": str(collection_id),
        "title": sess.title,
        "created_at": sess.created_at.isoformat(),
    }


@collections_router.get("/{collection_id}/sessions")
async def list_collection_sessions(
    collection_id: uuid.UUID,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session),
):
    """List sessions for a collection."""
    coll = await db.get(Collection, collection_id)
    if not coll or coll.user_id != user.id:
        raise HTTPException(status_code=404)

    from sqlalchemy import desc

    last_activity = func.coalesce(
        func.max(Message.created_at), ChatSession.created_at
    ).label("last_activity_at")

    stmt = (
        select(
            ChatSession.id,
            ChatSession.title,
            ChatSession.created_at,
            func.count(Message.id).label("message_count"),
            last_activity,
        )
        .outerjoin(Message, Message.session_id == ChatSession.id)
        .where(ChatSession.collection_id == collection_id)
        .group_by(ChatSession.id, ChatSession.title, ChatSession.created_at)
        .order_by(desc(last_activity))
        .limit(10)
    )
    result = await db.execute(stmt)
    rows = result.all()
    return {
        "sessions": [
            {
                "session_id": str(row.id),
                "title": row.title,
                "message_count": row.message_count,
                "created_at": row.created_at.isoformat(),
                "last_activity_at": row.last_activity_at.isoformat() if row.last_activity_at else row.created_at.isoformat(),
            }
            for row in rows
        ]
    }
