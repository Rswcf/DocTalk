"""Concurrent provider replay against isolated PostgreSQL."""
import asyncio
import uuid
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import delete, select

from app.api import billing
from app.models.database import AsyncSessionLocal
from app.models.tables import ProductEvent

pytestmark = [pytest.mark.integration, pytest.mark.asyncio(loop_scope="session")]


async def test_concurrent_replay_distinct_sessions_and_retry():
    prefix = f"analytics-test:{uuid.uuid4().hex}:"

    async def record(key):
        async with AsyncSessionLocal() as db:
            await billing._record_product_event(
                db, user_id=None, event_name="checkout_completed", source="test",
                metadata={"checkout_session_id": key}, deduplication_key=prefix + key,
            )

    try:
        await asyncio.gather(record("cs_one"), record("cs_one"))
        await record("cs_one")
        await record("cs_two")
        broken = AsyncMock()
        broken.execute.side_effect = RuntimeError("transient analytics failure")
        await billing._record_product_event(
            broken, user_id=None, event_name="checkout_completed", source="test",
            deduplication_key=prefix + "cs_retry",
        )
        broken.rollback.assert_awaited_once()
        await record("cs_retry")
        async with AsyncSessionLocal() as db:
            rows = (await db.scalars(select(ProductEvent).where(
                ProductEvent.deduplication_key.startswith(prefix)))).all()
            assert len(rows) == 3
            assert {row.metadata_json["checkout_session_id"] for row in rows} == {
                "cs_one", "cs_two", "cs_retry"}
    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(ProductEvent).where(
                ProductEvent.deduplication_key.startswith(prefix)))
            await db.commit()


async def test_unkeyed_legacy_events_remain_independent():
    source = f"legacy-{uuid.uuid4().hex}"
    try:
        async with AsyncSessionLocal() as db:
            for _ in range(2):
                await billing._record_product_event(
                    db, user_id=None, event_name="checkout_completed", source=source,
                )
            rows = (await db.scalars(select(ProductEvent).where(
                ProductEvent.source == source))).all()
            assert len(rows) == 2
            assert all(row.deduplication_key is None for row in rows)
    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(ProductEvent).where(ProductEvent.source == source))
            await db.commit()
