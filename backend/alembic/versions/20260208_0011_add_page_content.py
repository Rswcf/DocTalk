"""Add content column to pages table

Revision ID: 20260208_0011
Revises: 20260208_0010
Create Date: 2026-02-08
"""
from alembic import op
import sqlalchemy as sa

revision = '20260208_0011'
down_revision = '20260208_0010'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('pages', sa.Column('content', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('pages', 'content')
