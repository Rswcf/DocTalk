"""add user_id to sessions for demo session ownership

Revision ID: 20260316_0018
Revises: 20260213_0017
Create Date: 2026-03-16
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "20260316_0018"
down_revision = "20260213_0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sessions",
        sa.Column("user_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_sessions_user_id",
        "sessions",
        "users",
        ["user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_sessions_user_id", table_name="sessions")
    op.drop_constraint("fk_sessions_user_id", "sessions", type_="foreignkey")
    op.drop_column("sessions", "user_id")
