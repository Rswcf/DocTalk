"""History must preserve ownership, pagination and access after a downgrade."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.api import layout_translations
from app.core.deps import get_db_session, require_auth
from app.models.database import AsyncSessionLocal
from app.models.tables import Document, DocumentJob, User

pytestmark = [pytest.mark.integration, pytest.mark.asyncio(loop_scope="session")]


@pytest_asyncio.fixture(loop_scope="session")
async def history_case():
    async with AsyncSessionLocal() as db:
        owner = User(email=f"history-{uuid.uuid4().hex}@example.com", plan="free")
        stranger = User(email=f"history-{uuid.uuid4().hex}@example.com", plan="pro")
        db.add_all([owner, stranger])
        await db.flush()
        docs = [Document(user_id=owner.id, filename=f"history-{n}.pdf", storage_key=f"qa-history-{uuid.uuid4()}", file_size=1, file_type="pdf", status="ready") for n in range(2)]
        db.add_all(docs)
        await db.flush()
        now = datetime.now(timezone.utc)
        jobs = [DocumentJob(user_id=owner.id, document_id=docs[0].id, job_type="layout_translation", status=status, created_at=now, metadata_json={"target_language": "zh-CN", "artifacts": {"pdf": {"storage_key": "test-only"}}}) for status in ['queued', 'running', 'succeeded', 'failed', 'cancelled']]
        db.add_all(jobs + [
            DocumentJob(user_id=owner.id, document_id=docs[0].id, job_type="extraction", status="failed"),
            DocumentJob(user_id=owner.id, document_id=docs[1].id, job_type="layout_translation", status="failed"),
            DocumentJob(user_id=stranger.id, document_id=docs[0].id, job_type="layout_translation", status="failed"),
        ])
        await db.commit()
        doc_id, user_ids = docs[0].id, [owner.id, stranger.id]
        expected = sorted([str(job.id) for job in jobs], reverse=True)
    app = FastAPI()
    app.include_router(layout_translations.router)
    async def session():
        async with AsyncSessionLocal() as db:
            yield db
    app.dependency_overrides[get_db_session] = session
    app.dependency_overrides[require_auth] = lambda: owner
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            yield client, app, doc_id, expected, stranger
    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(User).where(User.id.in_(user_ids)))
            await db.commit()


async def test_owned_history_pages_all_statuses_after_downgrade(history_case):
    client, _, doc_id, expected, _ = history_case
    collected = []
    statuses = set()
    for offset in (0, 2, 4):
        response = await client.get(f"/api/documents/{doc_id}/layout-translations", params={"limit": 2, "offset": offset})
        assert response.status_code == 200
        assert response.headers['cache-control'] == 'private, no-store'
        data = response.json()
        assert data['total'] == 5
        collected.extend(item['id'] for item in data['items'])
        statuses.update(item['status'] for item in data['items'])
    assert collected == expected
    assert statuses == {'queued', 'running', 'succeeded', 'failed', 'cancelled'}


async def test_history_rejects_cross_owner_and_invalid_pagination(history_case):
    client, app, doc_id, _, stranger = history_case
    for params in ({'limit': 0}, {'limit': 51}, {'offset': -1}):
        assert (await client.get(f"/api/documents/{doc_id}/layout-translations", params=params)).status_code == 422
    app.dependency_overrides[require_auth] = lambda: stranger
    assert (await client.get(f"/api/documents/{doc_id}/layout-translations")).status_code == 404
    app.dependency_overrides.pop(require_auth)
    assert (await client.get(f"/api/documents/{doc_id}/layout-translations")).status_code == 401
