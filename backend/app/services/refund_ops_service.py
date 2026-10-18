"""Read-only refund exception queue, shared by admin API, monitor and ops CLI."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import sqlalchemy as sa

from app.models.tables import RefundOperation, User
from app.services.refund_service import ACTIVE, RUNNABLE

MANUAL = {"manual_unknown", "cash_reversed", "repair_required"}


def _queries(limit, now):
    if isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= 100:
        raise ValueError("limit must be between 1 and 100")
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        raise ValueError("now must include timezone")
    started = sa.func.coalesce(
        RefundOperation.first_submitted_at,
        RefundOperation.confirmed_at,
        RefundOperation.requested_at,
    )
    stale = sa.and_(
        RefundOperation.status.in_(RUNNABLE),
        started <= now - timedelta(minutes=30),
    )
    attention = sa.or_(RefundOperation.status.in_(MANUAL), stale)
    counts = sa.select(
        RefundOperation.status,
        sa.func.count().label("count"),
        sa.func.count().filter(attention).label("attention_count"),
    ).group_by(RefundOperation.status)
    queue = (
        sa.select(RefundOperation)
        .where(attention)
        .order_by(RefundOperation.requested_at, RefundOperation.id)
        .limit(limit)
    )
    active = sa.exists().where(
        RefundOperation.user_id == User.id,
        RefundOperation.status.in_(ACTIVE),
    )
    reservations = sa.select(
        sa.func.count().label("users"),
        sa.func.coalesce(sa.func.sum(User.refund_reserved_credits), 0).label("credits"),
        sa.func.count().filter(~active).label("orphan_users"),
    ).where(User.refund_reserved_credits > 0)
    return counts, queue, reservations, now


def _render(counts, operations, reservations, now):
    by_status = {row.status: row.count for row in counts}
    attention = sum(row.attention_count for row in counts)
    items = []
    for op in operations:
        started = op.first_submitted_at or op.confirmed_at or op.requested_at
        items.append({
            "operation_id": str(op.id),
            "status": op.status,
            "cash_status": op.cash_status,
            "review_reason": op.review_reason,
            "age_seconds": max(0, int((now - started).total_seconds())),
            "requested_at": op.requested_at.isoformat(),
            "provider_refund_recorded": bool(op.provider_refund_id),
            "adjustment_recorded": bool(op.adjustment_ledger_id),
        })
    orphan = reservations.orphan_users
    return {
        "status": "attention" if attention or orphan else "ok",
        "checked_at": now.isoformat(),
        "counts": by_status,
        "attention_count": attention,
        "queue": items,
        "queue_truncated": attention > len(items),
        "reserved_users": reservations.users,
        "reserved_credits": reservations.credits,
        "orphan_reserved_users": orphan,
        "read_only": True,
    }


async def get_refund_operations_status(db, limit=50, now=None):
    counts, queue, reservations, now = _queries(limit, now)
    return _render(
        (await db.execute(counts)).all(),
        (await db.scalars(queue)).all(),
        (await db.execute(reservations)).one(),
        now,
    )


def get_refund_operations_status_sync(db, limit=50, now=None):
    counts, queue, reservations, now = _queries(limit, now)
    return _render(
        db.execute(counts).all(),
        db.scalars(queue).all(),
        db.execute(reservations).one(),
        now,
    )
