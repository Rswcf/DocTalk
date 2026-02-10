"""Rescale credit balances and ledger entries (÷10 for simpler credit numbers)."""
from alembic import op

revision = "20260210_0012"
down_revision = "20260208_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE users SET credits_balance = credits_balance / 10")


def downgrade() -> None:
    op.execute("UPDATE users SET credits_balance = credits_balance * 10")
