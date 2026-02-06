"""add demo_slug to documents

Revision ID: a0c2118c5b32
Revises: d4e5f6a7b8c9
Create Date: 2026-02-06 15:41:59.686035

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a0c2118c5b32'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('documents', sa.Column('demo_slug', sa.String(length=50), nullable=True))
    op.create_unique_constraint('uq_documents_demo_slug', 'documents', ['demo_slug'])


def downgrade() -> None:
    op.drop_constraint('uq_documents_demo_slug', 'documents', type_='unique')
    op.drop_column('documents', 'demo_slug')
