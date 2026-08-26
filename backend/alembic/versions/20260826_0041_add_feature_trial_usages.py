"""add durable feature trial usages

Revision ID: 20260826_0041
Revises: 20260826_0040
Create Date: 2026-08-26
"""
from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20260826_0041"
down_revision = "20260826_0040"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "feature_trial_usages",
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
        sa.Column("feature", sa.String(64), nullable=False),
        sa.Column("slot_index", sa.Integer(), nullable=False),
        sa.Column(
            "owning_session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("sessions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "owning_job_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("document_jobs.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint("slot_index >= 0", name="ck_feature_trial_usages_slot_nonnegative"),
        sa.CheckConstraint(
            "owning_session_id IS NULL OR owning_job_id IS NULL",
            name="ck_feature_trial_usages_at_most_one_owner",
        ),
        sa.UniqueConstraint(
            "user_id",
            "feature",
            "slot_index",
            name="uq_feature_trial_usages_user_feature_slot",
        ),
    )
    op.create_index(
        "uq_feature_trial_usages_session_owner",
        "feature_trial_usages",
        ["owning_session_id"],
        unique=True,
        postgresql_where=sa.text("owning_session_id IS NOT NULL"),
    )
    op.create_index(
        "uq_feature_trial_usages_job_owner",
        "feature_trial_usages",
        ["owning_job_id"],
        unique=True,
        postgresql_where=sa.text("owning_job_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_feature_trial_usages_job_owner", table_name="feature_trial_usages")
    op.drop_index("uq_feature_trial_usages_session_owner", table_name="feature_trial_usages")
    op.drop_table("feature_trial_usages")
