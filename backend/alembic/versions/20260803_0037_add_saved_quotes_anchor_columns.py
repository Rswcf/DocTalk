"""add saved_quotes verification-anchor columns (M3 review addition, plan §8.1)

§8.1's literal verification-anchor fields were cut from the original
saved_quotes table (20260802_0036). Adding them now while the table is
empty in production, add-only: `source_text_hash` (hash of the
verification corpus the quote was verified against — page text for
page_text-kind cards, chunk text for extracted_text-kind cards),
`quote_start`/`quote_end` (raw character offsets of the verified slice
within that corpus, i.e. QuoteVerification.raw_start/raw_end).

Purpose: future revalidation after reparses — comparing a freshly-fetched
corpus's hash against the stored one tells a later revalidation pass
whether the underlying text changed since save time. v1 still never
re-verifies on read (M3-B3); this is schema/plumbing only.

Revision ID: 20260803_0037
Revises: 20260802_0036
Create Date: 2026-08-03
"""
from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260803_0037"
down_revision = "20260802_0036"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("saved_quotes", sa.Column("source_text_hash", sa.Text, nullable=True))
    op.add_column("saved_quotes", sa.Column("quote_start", sa.Integer, nullable=True))
    op.add_column("saved_quotes", sa.Column("quote_end", sa.Integer, nullable=True))


def downgrade() -> None:
    op.drop_column("saved_quotes", "quote_end")
    op.drop_column("saved_quotes", "quote_start")
    op.drop_column("saved_quotes", "source_text_hash")
