"""add domain_mode column to sessions for legal/academic mode

Revision ID: 20260317_0020
Revises: 20260317_0019
Create Date: 2026-03-17
"""

import sqlalchemy as sa

from alembic import op

revision = "20260317_0020"
down_revision = "20260317_0019"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("sessions", sa.Column("domain_mode", sa.String(20), nullable=True))
    op.create_check_constraint(
        "ck_sessions_domain_mode", "sessions", "domain_mode IN ('legal', 'academic')"
    )


def downgrade():
    op.drop_constraint("ck_sessions_domain_mode", "sessions")
    op.drop_column("sessions", "domain_mode")
