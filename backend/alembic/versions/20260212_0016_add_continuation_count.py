"""add continuation_count to messages

Revision ID: 20260212_0016
Revises: 20260211_0015
Create Date: 2026-02-12
"""

from alembic import op
import sqlalchemy as sa

revision = "20260212_0016"
down_revision = "20260211_0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("messages", sa.Column("continuation_count", sa.Integer(), nullable=False, server_default=sa.text("0")))


def downgrade() -> None:
    op.drop_column("messages", "continuation_count")
