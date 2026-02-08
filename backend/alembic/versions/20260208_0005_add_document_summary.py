"""add summary and suggested_questions to documents

Revision ID: e5f6a7b8c9d0
Revises: a0c2118c5b32
Create Date: 2026-02-08 12:00:00

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = "e5f6a7b8c9d0"
down_revision = "a0c2118c5b32"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("documents", sa.Column("summary", sa.Text(), nullable=True))
    op.add_column("documents", sa.Column("suggested_questions", JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("documents", "suggested_questions")
    op.drop_column("documents", "summary")
