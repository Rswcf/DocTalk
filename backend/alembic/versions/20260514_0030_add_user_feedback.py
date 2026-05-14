"""add user feedback table

Revision ID: 20260514_0030
Revises: 20260509_0029
Create Date: 2026-05-14
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260514_0030"
down_revision = "20260509_0029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_feedback",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("area", sa.String(length=32), nullable=False),
        sa.Column("severity", sa.String(length=16), nullable=False),
        sa.Column(
            "selected_options",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("path", sa.String(length=256), nullable=True),
        sa.Column("locale", sa.String(length=16), nullable=True),
        sa.Column("plan", sa.String(length=16), nullable=True),
        sa.Column("status", sa.String(length=16), server_default=sa.text("'new'"), nullable=False),
        sa.Column("user_agent", sa.String(length=256), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_user_feedback_user_id", "user_feedback", ["user_id"])
    op.create_index("idx_user_feedback_created", "user_feedback", [sa.text("created_at DESC")])
    op.create_index(
        "idx_user_feedback_status_created",
        "user_feedback",
        ["status", sa.text("created_at DESC")],
    )
    op.create_index(
        "idx_user_feedback_type_created",
        "user_feedback",
        ["type", sa.text("created_at DESC")],
    )
    op.create_index(
        "idx_user_feedback_area_created",
        "user_feedback",
        ["area", sa.text("created_at DESC")],
    )
    op.create_index(
        "idx_user_feedback_user_created",
        "user_feedback",
        ["user_id", sa.text("created_at DESC")],
    )


def downgrade() -> None:
    op.drop_index("idx_user_feedback_user_created", table_name="user_feedback")
    op.drop_index("idx_user_feedback_area_created", table_name="user_feedback")
    op.drop_index("idx_user_feedback_type_created", table_name="user_feedback")
    op.drop_index("idx_user_feedback_status_created", table_name="user_feedback")
    op.drop_index("idx_user_feedback_created", table_name="user_feedback")
    op.drop_index("ix_user_feedback_user_id", table_name="user_feedback")
    op.drop_table("user_feedback")
