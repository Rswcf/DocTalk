from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.dialects import postgresql

from app.workers import extraction_worker


class _EmptyScalars:
    def all(self):
        return []


class _EmptySession:
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def scalars(self, _statement):
        return _EmptyScalars()


def test_stale_extraction_watchdog_with_no_candidates_dispatches_nothing(
    monkeypatch,
) -> None:
    monkeypatch.setattr(extraction_worker, "SyncSessionLocal", _EmptySession)
    dispatched: list[tuple] = []
    monkeypatch.setattr(
        extraction_worker.run_extraction_job,
        "delay",
        lambda *args: dispatched.append(args),
    )

    assert extraction_worker.requeue_stale_running_extractions.run() == 0
    assert dispatched == []


def test_worker_forwards_watchdog_claim_token(monkeypatch) -> None:
    calls: list[tuple[str, str | None]] = []
    monkeypatch.setattr(
        extraction_worker,
        "run_extraction_job_sync",
        lambda job_id, expected_claim_token=None: calls.append(
            (job_id, expected_claim_token)
        ),
    )

    extraction_worker.run_extraction_job.run("job-id", "claim-token")

    assert calls == [("job-id", "claim-token")]


def test_watchdog_predicate_is_ledger_driven_and_null_lease_safe() -> None:
    statement = extraction_worker._stale_predebited_job_ids_statement(
        datetime.now(timezone.utc)
    )
    sql = str(
        statement.compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )

    assert "credit_ledger" in sql
    assert "credit_ledger.reconciled_at IS NULL" in sql
    assert "document_jobs.job_type" not in sql
    assert "document_jobs.worker_lease_expires_at IS NULL" in sql
    assert "document_jobs.created_at <=" in sql
    assert "document_jobs.updated_at <=" in sql
    assert "document_jobs.worker_lease_expires_at IS NOT NULL" not in sql


def test_orphan_watchdog_predicate_starts_from_unreconciled_ledgers() -> None:
    statement = extraction_worker._orphaned_predebit_ledger_ids_statement()
    sql = str(
        statement.compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )

    assert "FROM credit_ledger" in sql
    assert "credit_ledger.ref_type = 'document_job'" in sql
    assert "credit_ledger.reconciled_at IS NULL" in sql
    assert "NOT (EXISTS (SELECT document_jobs.id" in sql


def test_terminal_watchdog_refunds_only_undelivered_failure_states() -> None:
    statement = extraction_worker._terminal_undelivered_predebit_job_ids_statement()
    sql = str(
        statement.compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )

    assert "document_jobs.status IN ('failed', 'cancelled', 'canceled')" in sql
    assert "credit_ledger.reconciled_at IS NULL" in sql
    assert "NOT (EXISTS (SELECT extraction_results.id" in sql
    assert "succeeded" not in sql


def test_every_recovery_policy_has_a_registered_worker_dispatcher() -> None:
    from app.services.predebited_job_service import RECOVERY_POLICIES
    from app.workers.celery_app import celery_app

    assert set(extraction_worker.RECOVERY_DISPATCHERS) == set(RECOVERY_POLICIES)
    includes = set(celery_app.conf.include)
    assert {
        "app.workers.extraction_worker",
        "app.workers.question_template_worker",
        "app.workers.document_diff_worker",
    } <= includes
