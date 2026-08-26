"""add durable subscription checkout attempts

Revision ID: 20260826_0040
Revises: 20260808_0039
Create Date: 2026-08-26
"""
from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20260826_0040"
down_revision = "20260808_0039"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "checkout_attempts",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("idempotency_key", sa.String(255), nullable=False),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("plan", sa.String(16), nullable=False),
        sa.Column("billing_period", sa.String(16), nullable=False),
        sa.Column("source", sa.String(64), nullable=True),
        sa.Column("reason", sa.String(64), nullable=True),
        sa.Column(
            "started_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("stripe_session_id", sa.String(255), nullable=True),
        sa.Column("checkout_url", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default=sa.text("'creating'"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("idempotency_key", name="uq_checkout_attempts_idempotency_key"),
        sa.UniqueConstraint("stripe_session_id", name="uq_checkout_attempts_stripe_session_id"),
    )
    op.create_index(
        "idx_checkout_attempts_user_started",
        "checkout_attempts",
        ["user_id", sa.text("started_at DESC")],
    )
    op.create_index(
        "uq_checkout_attempts_user_active",
        "checkout_attempts",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("status IN ('creating', 'open')"),
    )


def downgrade() -> None:
    op.drop_index("uq_checkout_attempts_user_active", table_name="checkout_attempts")
    op.drop_index("idx_checkout_attempts_user_started", table_name="checkout_attempts")
    op.drop_table("checkout_attempts")
