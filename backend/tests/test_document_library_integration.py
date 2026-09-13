"""Filename search must cover the whole owned library with stable, bounded pages."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.api.documents import documents_router
from app.core.deps import get_current_user_optional, get_db_session
from app.models.database import AsyncSessionLocal
from app.models.tables import Document, User

pytestmark = [pytest.mark.integration, pytest.mark.asyncio(loop_scope="session")]


@pytest_asyncio.fixture(loop_scope="session")
async def library_case():
    async with AsyncSessionLocal() as db:
        owner = User(email=f"library-{uuid.uuid4().hex}@example.com", plan="pro")
        stranger = User(email=f"library-{uuid.uuid4().hex}@example.com", plan="pro")
        db.add_all([owner, stranger])
        await db.flush()
        now = datetime.now(timezone.utc)
        docs = [Document(user_id=owner.id, filename=f"Report-{n:02}.pdf", storage_key=f"library-{uuid.uuid4()}", file_size=1024 + n, file_type="pdf", page_count=n + 1, status="ready", created_at=now) for n in range(55)]
        special = Document(user_id=owner.id, filename="真实_100%\\report.pdf", storage_key=f"library-{uuid.uuid4()}", file_size=2048, file_type="pdf", page_count=6, status="ready", created_at=now)
        db.add_all(docs + [special,
            Document(user_id=stranger.id, filename="Report-secret.pdf", storage_key=f"library-{uuid.uuid4()}", file_size=1, file_type="pdf", status="ready"),
            Document(user_id=owner.id, filename="Report-deleting.pdf", storage_key=f"library-{uuid.uuid4()}", file_size=1, file_type="pdf", status="deleting"),
        ])
        await db.commit()
        owner_ids = [owner.id, stranger.id]
        expected = sorted([str(d.id) for d in docs + [special]], reverse=True)
    app = FastAPI()
    app.include_router(documents_router)
    async def session():
        async with AsyncSessionLocal() as db:
            yield db
    app.dependency_overrides[get_db_session] = session
    app.dependency_overrides[get_current_user_optional] = lambda: owner
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            yield client, app, expected, str(special.id)
    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(User).where(User.id.in_(owner_ids)))
            await db.commit()


async def test_library_pages_are_stable_and_do_not_stop_at_fifty(library_case):
    client, _, expected, _ = library_case
    seen = []
    for offset in (0, 20, 40):
        rows = (await client.get('/api/documents', params={'limit': 20, 'offset': offset})).json()
        seen.extend(row['id'] for row in rows)
        assert all(row['file_type'] == 'pdf' and row['page_count'] > 0 for row in rows)
    assert seen == expected
    oldest = (await client.get('/api/documents', params={'sort': 'oldest', 'limit': 100})).json()
    assert [r['id'] for r in oldest] == list(reversed(expected))


async def test_library_search_is_literal_owned_and_ordered(library_case):
    client, _, _, special_id = library_case
    for query in ('真实', '_100%', '%', '\\report'):
        rows = (await client.get('/api/documents', params={'q': query})).json()
        assert [r['id'] for r in rows] == [special_id]
    rows = (await client.get('/api/documents', params={'q': '  REPORT-  ', 'sort': 'name', 'limit': 100})).json()
    assert [r['filename'] for r in rows] == [f'Report-{n:02}.pdf' for n in range(55)]
    assert (await client.get('/api/documents', params={'q': 'no-such-document'})).json() == []


async def test_library_query_validation_and_anonymous_isolation(library_case):
    client, app, _, _ = library_case
    for params in ({'q': 'x' * 201}, {'sort': 'sql'}, {'limit': 101}, {'offset': -1}):
        assert (await client.get('/api/documents', params=params)).status_code == 422
    app.dependency_overrides[get_current_user_optional] = lambda: None
    assert (await client.get('/api/documents', params={'q': 'report', 'limit': 100})).json() == []
