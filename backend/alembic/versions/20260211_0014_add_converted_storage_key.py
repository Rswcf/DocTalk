"""Add converted_storage_key column to documents for PPTX/DOCX→PDF conversion."""
import sqlalchemy as sa
from alembic import op

revision = "20260211_0014"
down_revision = "20260210_0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("documents", sa.Column("converted_storage_key", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("documents", "converted_storage_key")
