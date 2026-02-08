"""add custom_instructions to documents

Revision ID: 20260208_0006
Revises: 20260208_0005_add_document_summary
Create Date: 2026-02-08
"""
from alembic import op
import sqlalchemy as sa

revision = '20260208_0006'
down_revision = '20260208_0005_add_document_summary'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column('documents', sa.Column('custom_instructions', sa.Text(), nullable=True))

def downgrade() -> None:
    op.drop_column('documents', 'custom_instructions')
