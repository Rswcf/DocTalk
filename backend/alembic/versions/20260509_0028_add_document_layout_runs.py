"""Add document layout runs."""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260509_0028"
down_revision = "20260509_0027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "document_layout_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default=sa.text("'queued'")),
        sa.Column("raw_storage_key", sa.Text(), nullable=True),
        sa.Column("pages_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("tables_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("error_code", sa.String(length=64), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_document_layout_runs_document_id", "document_layout_runs", ["document_id"])
    op.create_index(
        "idx_document_layout_runs_document_provider",
        "document_layout_runs",
        ["document_id", "provider", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("idx_document_layout_runs_document_provider", table_name="document_layout_runs")
    op.drop_index("ix_document_layout_runs_document_id", table_name="document_layout_runs")
    op.drop_table("document_layout_runs")
