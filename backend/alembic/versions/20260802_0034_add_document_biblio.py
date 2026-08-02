"""add document_biblio (B6, plan §8.4 point 4 / D6)

Minimal per-user bibliographic metadata for the Quote Finder APA in-text
formatter. Keyed by (document_id, user_id) in spirit: one SYSTEM row per
document (user_id IS NULL) holds the auto-detected default (filename
heuristics + PyMuPDF doc metadata); each user who edits it gets their own row
(user_id = that user), so an edit never mutates the shared/demo document's
system metadata for other users.

user_id cannot be part of a literal PRIMARY KEY here — Postgres requires
every PK column to be NOT NULL, and the system row's user_id is NULL by
design. Two partial unique indexes enforce the same invariant a composite PK
would (at most one system row per document; at most one row per
document+user) without a NOT NULL user_id or a synthetic system-user row.

Revision ID: 20260802_0034
Revises: 20260802_0033
Create Date: 2026-08-02
"""
from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20260802_0034"
down_revision = "20260802_0033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "document_biblio",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("csl_json", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("source", sa.String(16), nullable=False, server_default=sa.text("'system'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_document_biblio_document", "document_biblio", ["document_id"])
    op.create_index(
        "uq_document_biblio_system",
        "document_biblio",
        ["document_id"],
        unique=True,
        postgresql_where=sa.text("user_id IS NULL"),
    )
    op.create_index(
        "uq_document_biblio_user",
        "document_biblio",
        ["document_id", "user_id"],
        unique=True,
        postgresql_where=sa.text("user_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_document_biblio_user", table_name="document_biblio")
    op.drop_index("uq_document_biblio_system", table_name="document_biblio")
    op.drop_index("idx_document_biblio_document", table_name="document_biblio")
    op.drop_table("document_biblio")
