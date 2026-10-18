"""Durable refund recovery: pending operations survive task/broker loss."""

import asyncio
from datetime import timedelta

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models.tables import RefundOperation
from app.services.refund_service import (
    RUNNABLE,
    configured_identity,
    now_utc,
    process_operation,
)
from app.workers.celery_app import celery_app


async def recover(url):
    identity = configured_identity()
    if identity is None:
        return 0
    engine = create_async_engine(url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with factory() as db:
            ids = (
                await db.scalars(
                    sa.select(RefundOperation.id)
                    .where(
                        RefundOperation.provider_mode == identity[0],
                        RefundOperation.provider_account_id == identity[1],
                        sa.or_(
                            RefundOperation.status.in_(RUNNABLE),
                            sa.and_(
                                RefundOperation.status == "completed",
                                sa.or_(
                                    RefundOperation.first_submitted_at
                                    >= now_utc() - timedelta(days=30),
                                    RefundOperation.next_retry_at
                                    <= RefundOperation.requested_at,
                                ),
                            ),
                        ),
                        sa.or_(
                            RefundOperation.next_retry_at.is_(None),
                            RefundOperation.next_retry_at <= now_utc(),
                        ),
                        sa.or_(
                            RefundOperation.lease_until.is_(None),
                            RefundOperation.lease_until <= now_utc(),
                        ),
                    )
                    .order_by(
                        sa.case((RefundOperation.status == "completed", 1), else_=0),
                        RefundOperation.next_retry_at.asc().nullsfirst(),
                        RefundOperation.requested_at.asc(),
                    )
                    .limit(100)
                )
            ).all()
        for oid in ids:
            await process_operation(factory, oid)
        return len(ids)
    finally:
        await engine.dispose()


@celery_app.task(name="recover_refund_operations")
def recover_refund_operations():
    if configured_identity() is None:
        return 0
    return asyncio.run(recover(settings.DATABASE_URL))
