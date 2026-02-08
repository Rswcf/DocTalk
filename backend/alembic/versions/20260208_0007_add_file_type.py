"""add file_type to documents and make page dimensions nullable

Revision ID: 20260208_0007
Revises: 20260208_0006
Create Date: 2026-02-08
"""
from alembic import op
import sqlalchemy as sa

revision = '20260208_0007'
down_revision = '20260208_0006'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column('documents', sa.Column('file_type', sa.String(20), server_default='pdf', nullable=False))
    op.alter_column('pages', 'width_pt', nullable=True)
    op.alter_column('pages', 'height_pt', nullable=True)

def downgrade() -> None:
    op.alter_column('pages', 'height_pt', nullable=False)
    op.alter_column('pages', 'width_pt', nullable=False)
    op.drop_column('documents', 'file_type')
