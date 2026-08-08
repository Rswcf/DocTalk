"""add documents.parse_requested_locale (Codex r3, parse recovery)

Recovery re-dispatches (the stale-processing watchdog and startup recovery)
carry no `locale` argument, so a recovered scanned document would OCR with
the default language set instead of the one the user's original dispatch
requested — silently persisting lower-quality text as ready. Dispatchers now
write this column atomically with every transition to status='parsing'
(NULL = platform defaults, including an intentional reset) BEFORE publishing;
the worker only reads it and ignores the message's locale argument.

Add-only, nullable — backward-compatible during beta.

Revision ID: 20260808_0039
Revises: 20260803_0038
Create Date: 2026-08-08
"""
from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260808_0039"
down_revision = "20260803_0038"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "documents",
        sa.Column("parse_requested_locale", sa.String(16), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("documents", "parse_requested_locale")
