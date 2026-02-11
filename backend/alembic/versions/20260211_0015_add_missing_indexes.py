"""add missing performance indexes

Revision ID: 20260211_0015
Revises: 20260211_0014
Create Date: 2026-02-11
"""

from alembic import op

revision = "20260211_0015"
down_revision = "20260211_0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("idx_sessions_document_id", "sessions", ["document_id"])
    op.create_index("idx_sessions_collection_id", "sessions", ["collection_id"])
    op.create_index("idx_documents_status", "documents", ["status"])


def downgrade() -> None:
    op.drop_index("idx_documents_status", table_name="documents")
    op.drop_index("idx_sessions_collection_id", table_name="sessions")
    op.drop_index("idx_sessions_document_id", table_name="sessions")
