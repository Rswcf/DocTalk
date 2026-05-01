"""add product_events table

Revision ID: 20260501_0022
Revises: 20260414_0021
Create Date: 2026-05-01
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20260501_0022"
down_revision = "20260414_0021"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "product_events",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("event_name", sa.String(64), nullable=False),
        sa.Column("source", sa.String(64), nullable=True),
        sa.Column("reason", sa.String(64), nullable=True),
        sa.Column("plan", sa.String(16), nullable=True),
        sa.Column("billing", sa.String(16), nullable=True),
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
    op.create_index("ix_product_events_user_id", "product_events", ["user_id"])
    op.create_index("ix_product_events_event_name", "product_events", ["event_name"])
    op.create_index("idx_product_events_created", "product_events", [sa.text("created_at DESC")])
    op.create_index(
        "idx_product_events_name_created",
        "product_events",
        ["event_name", sa.text("created_at DESC")],
    )
    op.create_index(
        "idx_product_events_user_created",
        "product_events",
        ["user_id", sa.text("created_at DESC")],
    )


def downgrade():
    op.drop_index("idx_product_events_user_created", table_name="product_events")
    op.drop_index("idx_product_events_name_created", table_name="product_events")
    op.drop_index("idx_product_events_created", table_name="product_events")
    op.drop_index("ix_product_events_event_name", table_name="product_events")
    op.drop_index("ix_product_events_user_id", table_name="product_events")
    op.drop_table("product_events")
