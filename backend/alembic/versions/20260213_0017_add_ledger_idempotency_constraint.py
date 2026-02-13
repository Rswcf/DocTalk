"""add ledger idempotency partial unique index

Revision ID: 20260213_0017
Revises: 20260212_0016
Create Date: 2026-02-13
"""

from alembic import op
import sqlalchemy as sa

revision = "20260213_0017"
down_revision = "20260212_0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "uq_credit_ledger_idempotency_ref",
        "credit_ledger",
        ["user_id", "ref_type", "ref_id"],
        unique=True,
        postgresql_where=sa.text(
            "ref_type IS NOT NULL AND ref_id IS NOT NULL "
            "AND ref_type IN ('plan_change', 'stripe_payment', 'stripe_invoice', 'monthly_cycle')"
        ),
    )


def downgrade() -> None:
    op.drop_index("uq_credit_ledger_idempotency_ref", table_name="credit_ledger")
