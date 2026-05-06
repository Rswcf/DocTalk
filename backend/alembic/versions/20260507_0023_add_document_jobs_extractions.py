"""Add document jobs and extraction results."""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260507_0023"
down_revision = "20260501_0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "document_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("collection_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("job_type", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=24), server_default=sa.text("'queued'"), nullable=False),
        sa.Column("input_scope", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("cost_credits", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("error_code", sa.String(length=64), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["collection_id"], ["collections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_document_jobs_user_id", "document_jobs", ["user_id"])
    op.create_index("ix_document_jobs_document_id", "document_jobs", ["document_id"])
    op.create_index("ix_document_jobs_collection_id", "document_jobs", ["collection_id"])
    op.create_index("idx_document_jobs_user_created", "document_jobs", ["user_id", sa.text("created_at DESC")])
    op.create_index("idx_document_jobs_type_status", "document_jobs", ["job_type", "status"])

    op.create_table(
        "extraction_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("template_key", sa.String(length=64), nullable=False),
        sa.Column("structured_json", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("rendered_markdown", sa.Text(), server_default=sa.text("''"), nullable=False),
        sa.Column("citations", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["job_id"], ["document_jobs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("job_id"),
    )
    op.create_index("idx_extraction_results_template", "extraction_results", ["template_key"])


def downgrade() -> None:
    op.drop_index("idx_extraction_results_template", table_name="extraction_results")
    op.drop_table("extraction_results")
    op.drop_index("idx_document_jobs_type_status", table_name="document_jobs")
    op.drop_index("idx_document_jobs_user_created", table_name="document_jobs")
    op.drop_index("ix_document_jobs_collection_id", table_name="document_jobs")
    op.drop_index("ix_document_jobs_document_id", table_name="document_jobs")
    op.drop_index("ix_document_jobs_user_id", table_name="document_jobs")
    op.drop_table("document_jobs")
