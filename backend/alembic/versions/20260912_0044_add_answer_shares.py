"""Add immutable, answer-scoped public links without changing existing shares."""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20260912_0044"
down_revision = "20260826_0043"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "answer_shares",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "message_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("messages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "share_token",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            unique=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("snapshot_digest", sa.String(64), nullable=False),
        sa.Column("snapshot", postgresql.JSONB(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "user_id",
            "message_id",
            "snapshot_digest",
            name="uq_answer_shares_user_message_snapshot",
        ),
    )
    op.create_index("idx_answer_shares_message", "answer_shares", ["message_id"])
    op.create_index(
        "idx_answer_shares_user_session", "answer_shares", ["user_id", "session_id"]
    )


def downgrade() -> None:
    op.drop_index("idx_answer_shares_message", table_name="answer_shares")
    op.drop_index("idx_answer_shares_user_session", table_name="answer_shares")
    op.drop_table("answer_shares")
