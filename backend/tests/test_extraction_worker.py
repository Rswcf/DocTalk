from __future__ import annotations

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
