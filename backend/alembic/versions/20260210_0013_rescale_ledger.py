"""Rescale credit_ledger delta and balance_after to match ÷10 balance rescale."""
from alembic import op

revision = "20260210_0013"
down_revision = "20260210_0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE credit_ledger SET delta = delta / 10, balance_after = balance_after / 10")


def downgrade() -> None:
    op.execute("UPDATE credit_ledger SET delta = delta * 10, balance_after = balance_after * 10")
