"""add saved_quotes (M3-B1, plan D8 as amended by §8.5 M3 / §8.1)

User-saved verified quote cards. Rows snapshot a card's full trust state AT
SAVE TIME (verification_tier/verification_score/verifier_version/
source_kind, plus page/page_end/bboxes) — saved quotes must survive
reparses (§8.1), so the display path reads these stored columns and never
re-runs verify_quote. `source_chunk_id` is ON DELETE SET NULL, not CASCADE:
the parse worker hard-deletes and recreates a document's chunks on every
reparse, and a saved quote must outlive that.

`quote_hash` (server-derived from normalized quote_text + verified page
range — never client-supplied) backs the UNIQUE (user_id, document_id,
quote_hash) constraint that makes POST .../quotes idempotent.

Revision ID: 20260802_0036
Revises: 20260802_0035
Create Date: 2026-08-02
"""
from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20260802_0036"
down_revision = "20260802_0035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "saved_quotes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("page", sa.Integer, nullable=False),
        sa.Column("page_end", sa.Integer, nullable=False),
        sa.Column("quote_text", sa.Text, nullable=False),
        sa.Column("bboxes", postgresql.JSONB, nullable=True),
        sa.Column("verification_tier", sa.String(16), nullable=False),
        sa.Column("verification_score", sa.Float, nullable=False),
        sa.Column("verifier_version", sa.String(16), nullable=False),
        sa.Column("source_chunk_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("chunks.id", ondelete="SET NULL"), nullable=True),
        sa.Column("source_kind", sa.String(16), nullable=False),
        sa.Column("quote_hash", sa.String(64), nullable=False),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_saved_quotes_user_created", "saved_quotes", ["user_id", "created_at"])
    op.create_index("idx_saved_quotes_user_document", "saved_quotes", ["user_id", "document_id"])
    op.create_unique_constraint(
        "uq_saved_quotes_user_document_hash", "saved_quotes", ["user_id", "document_id", "quote_hash"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_saved_quotes_user_document_hash", "saved_quotes", type_="unique")
    op.drop_index("idx_saved_quotes_user_document", table_name="saved_quotes")
    op.drop_index("idx_saved_quotes_user_created", table_name="saved_quotes")
    op.drop_table("saved_quotes")
