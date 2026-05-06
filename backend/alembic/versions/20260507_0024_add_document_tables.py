"""Add document tables."""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260507_0024"
down_revision = "20260507_0023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "document_tables",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("page", sa.Integer(), nullable=False),
        sa.Column("table_index", sa.Integer(), nullable=False),
        sa.Column("cells", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("confidence", sa.Float(), server_default=sa.text("0"), nullable=False),
        sa.Column("method", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("document_id", "page", "table_index", name="uq_document_tables_position"),
    )
    op.create_index("ix_document_tables_document_id", "document_tables", ["document_id"])
    op.create_index("idx_document_tables_document_page", "document_tables", ["document_id", "page"])


def downgrade() -> None:
    op.drop_index("idx_document_tables_document_page", table_name="document_tables")
    op.drop_index("ix_document_tables_document_id", table_name="document_tables")
    op.drop_table("document_tables")
