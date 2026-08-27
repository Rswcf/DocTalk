"""expand durable leases to every predebited document job

Revision ID: 20260826_0043
Revises: 20260826_0042
Create Date: 2026-08-26
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260826_0043"
down_revision = "20260826_0042"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Recover active predebits created by every producer in the prior release.
    # Keep the column nullable because terminal jobs deliberately clear their
    # active lease; the default protects all newly queued ORM/raw inserts.
    op.execute(
        """
        UPDATE document_jobs AS job
        SET worker_lease_expires_at =
            CASE
                WHEN job.status = 'running'
                    THEN COALESCE(job.updated_at, job.created_at, now())
                ELSE COALESCE(job.created_at, job.updated_at, now())
            END + interval '45 minutes'
        WHERE job.status IN ('queued', 'running')
          AND job.worker_lease_expires_at IS NULL
          AND EXISTS (
              SELECT 1
              FROM credit_ledger AS ledger
              WHERE ledger.ref_type = 'document_job'
                AND ledger.ref_id = job.id::text
                AND ledger.reconciled_at IS NULL
          )
        """
    )
    op.alter_column(
        "document_jobs",
        "worker_lease_expires_at",
        existing_type=sa.TIMESTAMP(timezone=True),
        nullable=True,
        server_default=sa.text("now() + interval '45 minutes'"),
    )
    # Add-only beta migration: retain 0042's extraction-specific index and add
    # the wider active-job index alongside it.
    op.create_index(
        "idx_document_jobs_predebit_lease",
        "document_jobs",
        ["worker_lease_expires_at"],
        postgresql_where=sa.text("status IN ('queued', 'running')"),
    )


def downgrade() -> None:
    op.drop_index("idx_document_jobs_predebit_lease", table_name="document_jobs")
    op.alter_column(
        "document_jobs",
        "worker_lease_expires_at",
        existing_type=sa.TIMESTAMP(timezone=True),
        nullable=True,
        server_default=None,
    )
