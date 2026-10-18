"""Actual PostgreSQL exception queue: auth, reservation integrity and no writes."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import delete, text

from app.core.config import settings
from app.models.database import AsyncSessionLocal
from app.models.tables import RefundOperation, User
from app.services.refund_ops_service import get_refund_operations_status

pytestmark = [pytest.mark.integration, pytest.mark.asyncio(loop_scope="session")]


async def test_refund_ops_reports_manual_stale_and_orphan_without_writes():
    now = datetime.now(timezone.utc)
    uid, orphan = uuid.uuid4(), uuid.uuid4()
    ops = []
    for status, age in [("manual_unknown", 1), ("cash_pending", 31),
                        ("cash_pending", 1), ("completed", 60), ("eligible", 60)]:
        oid = uuid.uuid4()
        ops.append(RefundOperation(
            id=oid, user_id=uid, invoice_id="in_" + oid.hex,
            policy_version="monthly-zero-use-v1", request_kind="commercial",
            status=status, idempotency_key=oid.hex,
            requested_at=now-timedelta(minutes=age),
        ))
    async with AsyncSessionLocal() as db:
        db.add_all([
            User(id=uid, email=uid.hex+"@example.invalid", credits_balance=3450,
                 refund_reserved_credits=3000),
            User(id=orphan, email=orphan.hex+"@example.invalid", credits_balance=450,
                 refund_reserved_credits=50),
        ])
        await db.flush()
        db.add_all(ops)
        await db.commit()
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(text("SET TRANSACTION READ ONLY"))
            assert await db.scalar(text("SHOW transaction_read_only")) == "on"
            result = await get_refund_operations_status(db, limit=1, now=now)
            assert result["status"] == "attention"
            assert result["attention_count"] == 2
            assert result["reserved_credits"] == 3050
            assert result["orphan_reserved_users"] == 1
            assert result["queue_truncated"] is True
            assert len(result["queue"]) == 1
            assert result["queue"][0]["operation_id"] == str(ops[1].id)
            # No user/customer identifiers, free text reasons or provider payloads.
            assert "user_id" not in result["queue"][0]
            assert "customer_id" not in result["queue"][0]
            assert "evidence_json" not in result["queue"][0]
            await db.rollback()
    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(RefundOperation).where(RefundOperation.user_id == uid))
            await db.execute(delete(User).where(User.id.in_([uid, orphan])))
            await db.commit()


async def test_refund_ops_rejects_non_admin(client, auth_headers, monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_EMAILS", "finance@example.invalid")
    assert (await client.get("/api/admin/refund-operations")).status_code == 401
    response = await client.get("/api/admin/refund-operations", headers=auth_headers)
    assert response.status_code == 403


async def test_refund_ops_admin_read_only_contract(client, auth_user, auth_headers, monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_EMAILS", auth_user.email)
    response = await client.get("/api/admin/refund-operations?limit=1", headers=auth_headers)
    assert response.status_code == 200
    assert response.headers["cache-control"] == "private, no-store"
    assert response.json()["read_only"] is True
    assert (await client.get("/api/admin/refund-operations?limit=101", headers=auth_headers)).status_code == 422
    assert (await client.post("/api/admin/refund-operations", headers=auth_headers, json={})).status_code == 405
