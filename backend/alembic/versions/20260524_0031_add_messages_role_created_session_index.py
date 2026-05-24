"""add messages role-created-session index

Revision ID: 20260524_0031
Revises: 20260514_0030
Create Date: 2026-05-24
"""
from __future__ import annotations

from alembic import op


revision = "20260524_0031"
down_revision = "20260514_0030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "idx_messages_role_created_session",
        "messages",
        ["role", "created_at", "session_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_messages_role_created_session", table_name="messages")
