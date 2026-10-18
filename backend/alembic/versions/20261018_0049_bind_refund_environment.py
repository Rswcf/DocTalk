"""Add explicit provider identity without inferring historical financial ownership."""
import sqlalchemy as sa

from alembic import op

revision = "20261018_0049"
down_revision = "20261018_0048"
branch_labels = None
depends_on = None


def upgrade():
    for table, prefix in [("checkout_attempts", "refund_"), ("refund_operations", "")]:
        op.add_column(table, sa.Column(prefix + "provider_mode", sa.String(16), nullable=True))
        op.add_column(table, sa.Column(prefix + "provider_account_id", sa.String(255), nullable=True))


def downgrade():
    bind = op.get_bind()
    for table, prefix in [("checkout_attempts", "refund_"), ("refund_operations", "")]:
        present = bind.execute(sa.text(
            f"SELECT EXISTS (SELECT 1 FROM {table} WHERE "
            f"{prefix}provider_mode IS NOT NULL OR {prefix}provider_account_id IS NOT NULL)"
        )).scalar()
        if present:
            raise RuntimeError("Refund provider identity is audit evidence; downgrade is unsupported")
    # Supports the established empty scratch-schema migration roundtrip only.
    # Release rollback uses flags/forward repair, never production downgrade.
    for table, prefix in [("checkout_attempts", "refund_"), ("refund_operations", "")]:
        op.drop_column(table, prefix + "provider_account_id")
        op.drop_column(table, prefix + "provider_mode")
