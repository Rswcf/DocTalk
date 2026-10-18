"""Add optional business identity for replay-safe billing analytics."""
from alembic import op
import sqlalchemy as sa

revision = "20261018_0047"
down_revision = "20260913_0046"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("product_events", sa.Column("deduplication_key", sa.String(320), nullable=True))
    op.create_unique_constraint("uq_product_event_deduplication_key", "product_events", ["deduplication_key"])


def downgrade() -> None:
    op.drop_constraint("uq_product_event_deduplication_key", "product_events", type_="unique")
    op.drop_column("product_events", "deduplication_key")
