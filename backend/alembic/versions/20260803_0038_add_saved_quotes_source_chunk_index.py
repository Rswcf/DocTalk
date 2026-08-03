"""add partial index on saved_quotes.source_chunk_id (FIX-5, Codex M3 r1 MED)

The parse worker's bulk chunk delete (parse_worker.py:184,
`sa_delete(Chunk).where(Chunk.document_id == doc.id)`) triggers a
referential-action lookup against every FK referencing chunks.id for each
deleted row — including saved_quotes.source_chunk_id (ON DELETE SET NULL,
added in 20260802_0036). Without an index on that column, Postgres must
sequentially scan saved_quotes to find rows to null out on every reparse,
which gets materially worse as the table grows.

Partial (WHERE source_chunk_id IS NOT NULL): most saved_quotes rows will
eventually have a NULL source_chunk_id once their originating document has
been reparsed at least once (§8.1: saved quotes survive reparses by
losing only this link) — indexing NULLs would waste space/maintenance
for no query benefit, since this index only ever needs to answer "which
rows reference chunk X."

Add-only, scratch round-trip only.

Revision ID: 20260803_0038
Revises: 20260803_0037
Create Date: 2026-08-03
"""
from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260803_0038"
down_revision = "20260803_0037"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "idx_saved_quotes_source_chunk_id",
        "saved_quotes",
        ["source_chunk_id"],
        postgresql_where=sa.text("source_chunk_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("idx_saved_quotes_source_chunk_id", table_name="saved_quotes")
