"""Add source_url to documents

Revision ID: 20260208_0010
Revises: 20260208_0009
Create Date: 2026-02-08
"""
from alembic import op
import sqlalchemy as sa

revision = '20260208_0010'
down_revision = '20260208_0009'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('documents', sa.Column('source_url', sa.String(2000), nullable=True))


def downgrade() -> None:
    op.drop_column('documents', 'source_url')
