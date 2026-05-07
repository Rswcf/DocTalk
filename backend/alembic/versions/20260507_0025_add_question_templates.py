"""Add question templates."""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260507_0025"
down_revision = "20260507_0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "question_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("questions", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_question_templates_user_id", "question_templates", ["user_id"])
    op.create_index("idx_question_templates_user_updated", "question_templates", ["user_id", sa.text("updated_at DESC")])


def downgrade() -> None:
    op.drop_index("idx_question_templates_user_updated", table_name="question_templates")
    op.drop_index("ix_question_templates_user_id", table_name="question_templates")
    op.drop_table("question_templates")
