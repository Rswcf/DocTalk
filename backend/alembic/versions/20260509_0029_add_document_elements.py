"""Add canonical document elements."""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260509_0029"
down_revision = "20260509_0028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "document_elements",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("element_type", sa.String(length=32), nullable=False),
        sa.Column("page_start", sa.Integer(), nullable=False),
        sa.Column("page_end", sa.Integer(), nullable=False),
        sa.Column("bbox", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("reading_order", sa.Integer(), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "metadata_json",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parent_id"], ["document_elements.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_document_elements_document_id", "document_elements", ["document_id"])
    op.create_index(
        "idx_document_elements_doc_type_order",
        "document_elements",
        ["document_id", "element_type", "reading_order"],
    )
    op.create_index(
        "idx_document_elements_doc_pages",
        "document_elements",
        ["document_id", "page_start", "page_end"],
    )


def downgrade() -> None:
    op.drop_index("idx_document_elements_doc_pages", table_name="document_elements")
    op.drop_index("idx_document_elements_doc_type_order", table_name="document_elements")
    op.drop_index("ix_document_elements_document_id", table_name="document_elements")
    op.drop_table("document_elements")
