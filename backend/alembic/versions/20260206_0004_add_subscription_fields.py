"""add subscription fields to users

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-02-06 00:40:00

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add subscription-related columns to users
    op.add_column(
        "users",
        sa.Column("plan", sa.String(length=20), nullable=False, server_default=sa.text("'free'")),
    )
    op.add_column("users", sa.Column("stripe_customer_id", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("stripe_subscription_id", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("monthly_credits_granted_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    # Drop subscription-related columns from users
    op.drop_column("users", "monthly_credits_granted_at")
    op.drop_column("users", "stripe_subscription_id")
    op.drop_column("users", "stripe_customer_id")
    op.drop_column("users", "plan")

