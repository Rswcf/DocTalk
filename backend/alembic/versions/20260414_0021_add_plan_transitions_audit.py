"""add plan_transitions audit table

Tracks every plan change source-tagged so billing state is traceable
across webhook / portal / self-serve cancel / admin mutations.
Schema only in this migration; first writer (self_serve_cancel) lands
in the next commit. Webhook / change-plan / admin audit writes are
deferred to a follow-up.

Revision ID: 20260414_0021
Revises: 20260317_0020
Create Date: 2026-04-14
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20260414_0021"
down_revision = "20260317_0020"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "plan_transitions",
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
        sa.Column("from_plan", sa.String(16), nullable=False),
        sa.Column("to_plan", sa.String(16), nullable=False),
        sa.Column("source", sa.String(32), nullable=False),
        sa.Column("stripe_event_id", sa.String(128), nullable=True),
        sa.Column(
            "effective_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "metadata_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "idx_plan_transitions_user",
        "plan_transitions",
        ["user_id", sa.text("created_at DESC")],
    )
    op.create_index(
        "idx_plan_transitions_source",
        "plan_transitions",
        ["source"],
    )
    op.create_check_constraint(
        "ck_plan_transitions_source",
        "plan_transitions",
        "source IN ('self_serve_cancel', 'stripe_webhook', 'plan_change', 'admin', 'portal')",
    )


def downgrade():
    op.drop_constraint("ck_plan_transitions_source", "plan_transitions")
    op.drop_index("idx_plan_transitions_source", table_name="plan_transitions")
    op.drop_index("idx_plan_transitions_user", table_name="plan_transitions")
    op.drop_table("plan_transitions")
