"""add collections tables and sessions.collection_id

Revision ID: 20260208_0009
Revises: 20260208_0008
Create Date: 2026-02-08
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '20260208_0009'
down_revision = '20260208_0007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Collections table
    op.create_table(
        'collections',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('idx_collections_user', 'collections', ['user_id'])

    # Junction table (many-to-many)
    op.create_table(
        'collection_documents',
        sa.Column('collection_id', UUID(as_uuid=True), sa.ForeignKey('collections.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('document_id', UUID(as_uuid=True), sa.ForeignKey('documents.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('added_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    # Sessions can now belong to collection instead of document
    op.add_column('sessions', sa.Column('collection_id', UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        'fk_sessions_collection_id',
        'sessions', 'collections',
        ['collection_id'], ['id'],
        ondelete='CASCADE',
    )
    op.alter_column('sessions', 'document_id', nullable=True)


def downgrade() -> None:
    op.alter_column('sessions', 'document_id', nullable=False)
    op.drop_constraint('fk_sessions_collection_id', 'sessions', type_='foreignkey')
    op.drop_column('sessions', 'collection_id')
    op.drop_table('collection_documents')
    op.drop_index('idx_collections_user', 'collections')
    op.drop_table('collections')
