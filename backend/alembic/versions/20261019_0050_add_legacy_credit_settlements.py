"""Add explicit historical settlement attestations; never backfill ledger rows."""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20261019_0050"
down_revision = "20261018_0049"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "legacy_credit_settlements",
        sa.Column(
            "ledger_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("credit_ledger.id", ondelete="NO ACTION"),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("protocol", sa.String(64), nullable=False),
        sa.Column("ledger_fingerprint", sa.String(64), nullable=False),
        sa.Column("ledger_snapshot", postgresql.JSONB(), nullable=False),
        sa.Column("evidence_json", postgresql.JSONB(), nullable=False),
        sa.Column("manifest_sha256", sa.String(64), nullable=False),
        sa.Column("reviewed_by", sa.String(255), nullable=False),
        sa.Column(
            "attested_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
    )


def downgrade():
    if (
        op.get_bind()
        .execute(sa.text("SELECT EXISTS (SELECT 1 FROM legacy_credit_settlements)"))
        .scalar()
    ):
        raise RuntimeError("Legacy settlement audit exists; downgrade is prohibited")
    op.drop_table("legacy_credit_settlements")
