"""Add answer revision snapshots and renewable chat operation leases."""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op
revision = "20260913_0045"
down_revision = "20260912_0044"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("messages", sa.Column("response_version", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_table("chat_stream_leases",
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sessions.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("token", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False))
    op.create_table("message_revisions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("message_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("messages.id", ondelete="CASCADE"), nullable=False),
        sa.Column("snapshot", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False))
    op.create_index("ix_message_revisions_message_id", "message_revisions", ["message_id"])


def downgrade() -> None:
    op.drop_table("message_revisions")
    op.drop_table("chat_stream_leases")
    op.drop_column("messages", "response_version")
