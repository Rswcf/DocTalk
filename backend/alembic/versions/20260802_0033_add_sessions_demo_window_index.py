"""add partial index for anonymous demo session window

The anonymous demo session cap (`_recent_demo_session_filter` in
app/api/chat.py) now filters on `document_id`, `user_id IS NULL`, and a
rolling 24h `created_at` window on every demo session creation. A partial
index scoped to anonymous rows keeps that hot-path count cheap without
bloating the index with authenticated sessions it never scans.

Revision ID: 20260802_0033
Revises: 20260524_0032
Create Date: 2026-08-02
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260802_0033"
down_revision = "20260524_0032"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "idx_sessions_demo_window",
        "sessions",
        ["document_id", "created_at"],
        unique=False,
        postgresql_where=sa.text("user_id IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("idx_sessions_demo_window", table_name="sessions")
