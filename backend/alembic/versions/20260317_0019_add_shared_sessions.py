"""add shared_sessions table for shareable conversation links

Revision ID: 20260317_0019
Revises: 20260316_0018
Create Date: 2026-03-17
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision = "20260317_0019"
down_revision = "20260316_0018"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "shared_sessions",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("session_id", UUID(as_uuid=True), sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("share_token", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False, unique=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("session_id", "user_id", name="uq_shared_sessions_session_user"),
    )
    op.create_index("idx_shared_sessions_token", "shared_sessions", ["share_token"])


def downgrade():
    op.drop_index("idx_shared_sessions_token")
    op.drop_table("shared_sessions")
