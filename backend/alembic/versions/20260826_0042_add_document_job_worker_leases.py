"""add durable document-job worker leases

Revision ID: 20260826_0042
Revises: 20260826_0041
Create Date: 2026-08-26
"""
from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20260826_0042"
down_revision = "20260826_0041"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "document_jobs",
        sa.Column("worker_claim_token", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "document_jobs",
        sa.Column(
            "worker_claim_attempts",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )
    op.add_column(
        "document_jobs",
        sa.Column("worker_lease_expires_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )

    # Preserve and recover jobs created by the previous release. A running
    # extraction has already consumed its initial claim; queued work has not.
    # Both receive the same 45-minute bound used by the new worker/watchdog.
    op.execute(
        """
        UPDATE document_jobs
        SET worker_claim_token = CASE
                WHEN status = 'running' THEN gen_random_uuid()
                ELSE NULL
            END,
            worker_claim_attempts = CASE
                WHEN status = 'running' THEN 1
                ELSE 0
            END,
            worker_lease_expires_at = updated_at + interval '45 minutes'
        WHERE job_type = 'extraction'
          AND status IN ('queued', 'running')
        """
    )
    op.create_index(
        "idx_document_jobs_extraction_lease",
        "document_jobs",
        ["worker_lease_expires_at"],
        postgresql_where=sa.text(
            "job_type = 'extraction' AND status IN ('queued', 'running')"
        ),
    )


def downgrade() -> None:
    op.drop_index("idx_document_jobs_extraction_lease", table_name="document_jobs")
    op.drop_column("document_jobs", "worker_lease_expires_at")
    op.drop_column("document_jobs", "worker_claim_attempts")
    op.drop_column("document_jobs", "worker_claim_token")
