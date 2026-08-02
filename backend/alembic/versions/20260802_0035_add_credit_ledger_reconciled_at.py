"""add credit_ledger.reconciled_at (FIX3-A, Codex M2 r3 #4)

Durable settlement marker for the two-stage credit debit: reconcile_credits
now ALWAYS stamps this column (under a row lock), including the
equal-cost/no-op path which previously left the ledger row untouched. The
conditional refund path (DELETE ... WHERE reconciled_at IS NULL) uses this
as the sole, race-free source of truth for "has this predebit already been
settled" — replacing a one-shot existence check (e.g. "does the assistant
Message row exist yet") that could not distinguish "never committed" from
"COMMIT still in flight" under concurrent cancellation/failure handling.

Add-only, nullable — no backfill needed (existing rows are already fully
settled in the sense that matters: nothing will ever try to conditionally
refund a historical ledger row again).

Revision ID: 20260802_0035
Revises: 20260802_0034
Create Date: 2026-08-02
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260802_0035"
down_revision = "20260802_0034"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "credit_ledger", sa.Column("reconciled_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("credit_ledger", "reconciled_at")
