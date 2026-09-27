"""The independent Postgres backup check (infra/pg-backup writes, this reads)."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.services import backup_status_service as svc

NOW = datetime(2026, 9, 28, 12, 0, tzinfo=timezone.utc)
BIG = 51_520_906


class FakeResponse:
    def __init__(self, data) -> None:
        self._data = data
        self.closed = False

    def read(self, amt=None):
        if isinstance(self._data, Exception):
            raise self._data
        return self._data if amt is None else self._data[:amt]

    def close(self):
        self.closed = True

    def release_conn(self):
        pass


class FakeOpsBucket:
    def __init__(self, objects=(), manifests=None, list_error=None):
        self.objects = list(objects)
        self.manifests = manifests or {}
        self.list_error = list_error
        self.gets: list[tuple] = []

    def list_objects(self, bucket, prefix=None, recursive=False):
        assert (bucket, prefix, recursive) == ("doctalk-ops", "postgres/", True)
        if self.list_error:
            raise self.list_error
        return iter(self.objects)

    def get_object(self, bucket, key, offset=0, length=0):
        self.gets.append((bucket, key, offset, length))
        if key not in self.manifests:
            raise RuntimeError("NoSuchKey")
        return FakeResponse(self.manifests[key])


def _obj(name: str, hours_ago: float, size: int = BIG):
    return SimpleNamespace(object_name=name, last_modified=NOW - timedelta(hours=hours_ago), size=size)


_UNSET = object()


def _manifest(key: str, *, size: int = BIG, restore_test: str = "ok", encrypted=_UNSET) -> bytes:
    body = {
        "artifact": key, "artifact_bytes": size, "restore_test": restore_test,
        "alembic_version": "20260913_0046",
        "encrypted": key.endswith(".dump.age") if encrypted is _UNSET else encrypted,
    }
    if encrypted is None:
        del body["encrypted"]
    return json.dumps(body).encode()


@pytest.fixture(autouse=True)
def _enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(svc.settings, "PG_BACKUP_MONITOR_ENABLED", True)
    monkeypatch.setattr(svc.settings, "OPS_BUCKET", "doctalk-ops")
    monkeypatch.setattr(svc.settings, "PG_BACKUP_PREFIX", "postgres/")
    monkeypatch.setattr(svc.settings, "PG_BACKUP_SCHEDULE_UTC", "09:15")
    monkeypatch.setattr(svc.settings, "PG_BACKUP_GRACE_HOURS", 2.0)
    monkeypatch.setattr(svc.settings, "PG_BACKUP_MIN_BYTES", 5_000_000)


def test_disabled_monitor_touches_nothing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(svc.settings, "PG_BACKUP_MONITOR_ENABLED", False)
    bucket = FakeOpsBucket(list_error=AssertionError("must not list"))

    assert svc.get_postgres_backup_status(bucket, NOW)["status"] == "disabled"


def test_newest_verified_backup_is_ok_and_older_ones_and_probes_are_ignored() -> None:
    old, new = "postgres/doctalk-20260927T181302Z.dump.age", "postgres/doctalk-20260928T091500Z.dump.age"
    bucket = FakeOpsBucket(
        objects=[
            _obj(old, 26),
            _obj(new, 2.75),
            _obj("postgres/_locktest-20260927T181105Z", 0.5, size=1),
            _obj("postgres/doctalk-20260928T091500Z.manifest.json", 2.75, size=900),
        ],
        manifests={"postgres/doctalk-20260928T091500Z.manifest.json": _manifest(new)},
    )

    status = svc.get_postgres_backup_status(bucket, NOW)

    assert status["status"] == "ok"
    assert status["latest_key"] == new
    assert status["age_hours"] == 2.8
    assert status["bytes"] == BIG
    assert (status["restore_test"], status["alembic_version"], status["encrypted"]) == ("ok", "20260913_0046", True)
    # The manifest read is bounded.
    assert bucket.gets == [("doctalk-ops", "postgres/doctalk-20260928T091500Z.manifest.json", 0, svc.MANIFEST_MAX_BYTES)]


def _one_artifact(finished_at: datetime) -> FakeOpsBucket:
    key = "postgres/doctalk-20260927T091500Z.dump.age"
    obj = SimpleNamespace(object_name=key, last_modified=finished_at, size=BIG)
    return FakeOpsBucket(objects=[obj], manifests={key.replace(".dump.age", ".manifest.json"): _manifest(key)})


def _at(day: int, hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 9, day, hour, minute, tzinfo=timezone.utc)


@pytest.mark.parametrize(
    ("finished_at", "now", "expected"),
    [
        (_at(27, 9, 16), _at(28, 12), "stale"),   # today's 09:15 run left nothing
        (_at(27, 10, 5), _at(28, 12), "stale"),   # yesterday's late upload must not cover today
        (_at(27, 9, 16), _at(28, 10, 30), "ok"),  # today's run still within its grace period
        (_at(28, 11, 5), _at(28, 12), "ok"),      # today's run late but done
        (_at(28, 11, 20), _at(28, 12), "ok"),     # finished after its grace, still covers today
        (_at(28, 9, 16), _at(29, 8), "ok"),       # before the next scheduled run
        (_at(28, 9, 16), _at(29, 11, 20), "stale"),  # next run's grace has just passed
    ],
    ids=["missed", "late-yesterday", "in-grace", "late-today", "after-grace-today", "before-next", "after-next-grace"],
)
def test_freshness_is_coverage_of_the_latest_due_run(finished_at, now, expected) -> None:
    assert svc.get_postgres_backup_status(_one_artifact(finished_at), now)["status"] == expected


def test_naive_datetimes_are_treated_as_utc() -> None:
    naive_now = datetime(2026, 9, 28, 12, 0)
    obj = SimpleNamespace(
        object_name="postgres/doctalk-20260928T091500Z.dump.age", last_modified=datetime(2026, 9, 28, 9, 16), size=BIG
    )
    bucket = FakeOpsBucket(
        objects=[obj], manifests={"postgres/doctalk-20260928T091500Z.manifest.json": _manifest(obj.object_name)}
    )

    assert svc.due_run(naive_now) == _at(28, 9, 15)
    assert svc.get_postgres_backup_status(bucket, naive_now)["status"] == "ok"


def test_due_run_honours_schedule_and_grace() -> None:
    assert svc.due_run(_at(28, 11, 14)) == _at(27, 9, 15)
    assert svc.due_run(_at(28, 11, 15)) == _at(28, 9, 15)
    assert svc.due_run(_at(28, 3)) == _at(27, 9, 15)


def test_manifest_body_read_failure_is_unverified_and_stale_still_wins() -> None:
    key = "postgres/doctalk-20260928T091500Z.dump.age"
    manifests = {key.replace(".dump.age", ".manifest.json"): TimeoutError("read timed out")}
    fresh = FakeOpsBucket(objects=[_obj(key, 2.5)], manifests=manifests)
    old = FakeOpsBucket(objects=[_obj(key, 40)], manifests=manifests)

    assert svc.get_postgres_backup_status(fresh, NOW)["status"] == "unverified"
    assert svc.get_postgres_backup_status(old, NOW)["status"] == "stale"


def test_scan_over_budget_or_deadline_is_unreachable_not_a_partial_ok(monkeypatch: pytest.MonkeyPatch) -> None:
    key = "postgres/doctalk-20260928T091500Z.dump.age"
    objects = [_obj(key, 2.5)] + [_obj(f"postgres/x-{i}.manifest.json", 2.5, size=10) for i in range(10)]
    bucket = FakeOpsBucket(objects=objects, manifests={key.replace(".dump.age", ".manifest.json"): _manifest(key)})

    monkeypatch.setattr(svc, "LIST_MAX_ENTRIES", 5)
    assert svc.get_postgres_backup_status(bucket, NOW)["status"] == "unreachable"

    monkeypatch.setattr(svc, "LIST_MAX_ENTRIES", 5000)
    clock = iter([0.0] + [1_000.0] * 50)
    assert svc.get_postgres_backup_status(bucket, NOW, monotonic=lambda: next(clock))["status"] == "unreachable"


def test_undersized_artifact_is_small() -> None:
    key = "postgres/doctalk-20260928T091500Z.dump.age"
    bucket = FakeOpsBucket(
        objects=[_obj(key, 2.5, size=1_000)],
        manifests={key.replace(".dump.age", ".manifest.json"): _manifest(key, size=1_000)},
    )

    assert svc.get_postgres_backup_status(bucket, NOW)["status"] == "small"


@pytest.mark.parametrize(
    "manifest",
    [
        None,  # no manifest at all
        b"{not json",
        _manifest("postgres/doctalk-20260928T091500Z.dump.age", restore_test="skipped"),
        _manifest("postgres/some-other-artifact.dump.age"),
        _manifest("postgres/doctalk-20260928T091500Z.dump.age", size=BIG - 1),
    ],
    ids=["missing", "garbled", "restore-skipped", "other-artifact", "size-mismatch"],
)
def test_artifact_without_a_matching_passing_manifest_is_unverified(manifest) -> None:
    key = "postgres/doctalk-20260928T091500Z.dump.age"
    manifests = {} if manifest is None else {key.replace(".dump.age", ".manifest.json"): manifest}
    bucket = FakeOpsBucket(objects=[_obj(key, 2.5)], manifests=manifests)

    assert svc.get_postgres_backup_status(bucket, NOW)["status"] == "unverified"


@pytest.mark.parametrize(
    ("key", "encrypted"),
    [
        ("postgres/doctalk-20260928T091500Z.dump", True),
        ("postgres/doctalk-20260928T091500Z.dump.age", False),
        ("postgres/doctalk-20260928T091500Z.dump.age", None),
        ("postgres/doctalk-20260928T091500Z.dump.age", "true"),
    ],
    ids=["plaintext-claims-encrypted", "age-claims-plaintext", "flag-missing", "flag-not-boolean"],
)
def test_encryption_flag_must_match_the_file_type(key: str, encrypted) -> None:
    manifest_key = "postgres/doctalk-20260928T091500Z.manifest.json"
    bucket = FakeOpsBucket(objects=[_obj(key, 2.5)], manifests={manifest_key: _manifest(key, encrypted=encrypted)})

    assert svc.get_postgres_backup_status(bucket, NOW)["status"] == "unverified"


def test_plaintext_dump_with_a_consistent_manifest_is_ok() -> None:
    key = "postgres/doctalk-20260928T091500Z.dump"
    bucket = FakeOpsBucket(objects=[_obj(key, 2.5)], manifests={"postgres/doctalk-20260928T091500Z.manifest.json": _manifest(key)})

    assert svc.get_postgres_backup_status(bucket, NOW)["status"] == "ok"


def test_no_artifact_is_missing_and_a_listing_error_is_unreachable() -> None:
    assert svc.get_postgres_backup_status(FakeOpsBucket(objects=[]), NOW)["status"] == "missing"
    only_probe = FakeOpsBucket(objects=[_obj("postgres/_locktest-20260927T181105Z", 1, size=1)])
    assert svc.get_postgres_backup_status(only_probe, NOW)["status"] == "missing"
    down = FakeOpsBucket(list_error=RuntimeError("AccessDenied"))
    assert svc.get_postgres_backup_status(down, NOW)["status"] == "unreachable"


class _RecordingSession:
    def __init__(self, sink: list) -> None:
        self.sink = sink

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, stmt, params=None) -> None:
        self.sink.append(("execute", str(stmt)))

    def add(self, obj) -> None:
        self.sink.append(obj)

    def commit(self) -> None:
        self.sink.append("commit")


@pytest.mark.parametrize("state", ["ok", "disabled", "stale", "unverified", "missing", "unreachable", "small"])
def test_beat_task_records_an_event_only_for_problems(monkeypatch: pytest.MonkeyPatch, state: str) -> None:
    from app.workers import ops_monitor

    written: list = []
    captured: list = []
    status = {"status": state, "latest_key": "postgres/k.dump.age", "age_hours": 1.0}
    monkeypatch.setattr(ops_monitor, "get_postgres_backup_status", lambda: status)
    monkeypatch.setattr(ops_monitor, "SyncSessionLocal", lambda: _RecordingSession(written))
    monkeypatch.setattr(ops_monitor.sentry_sdk, "capture_message", lambda msg, level=None: captured.append(msg))

    assert ops_monitor.check_postgres_backup_freshness.run() == state

    if state in ("ok", "disabled"):
        assert written == [] and captured == []
    else:
        # The best-effort write is bounded before anything is inserted.
        assert written[:2] == [
            ("execute", "SET LOCAL lock_timeout = '5s'"),
            ("execute", "SET LOCAL statement_timeout = '15s'"),
        ]
        event = written[2]
        assert (event.event_name, event.source, event.reason) == ("ops.backup_stale", "beat", state)
        assert event.metadata_json == status
        assert written[3] == "commit"
        assert captured == [f"Postgres backup check: {state}"]


def test_beat_task_has_time_limits() -> None:
    from app.workers import ops_monitor

    task = ops_monitor.check_postgres_backup_freshness
    assert (task.soft_time_limit, task.time_limit) == (120, 180)


def test_admin_ops_health_is_an_admin_only_get() -> None:
    from app.api import admin as admin_api
    from app.core.deps import require_admin

    route = next(r for r in admin_api.router.routes if r.path == "/api/admin/ops-health")
    assert route.methods == {"GET"}
    assert any(dep.call is require_admin for dep in route.dependant.dependencies)


@pytest.mark.asyncio
async def test_admin_ops_health_returns_the_backup_status(monkeypatch: pytest.MonkeyPatch) -> None:
    from unittest.mock import AsyncMock

    from fastapi import Response

    from app.api import admin as admin_api

    probes: list[int] = []

    def _probe():
        probes.append(1)
        return {"status": "ok", "latest_key": "k"}

    store: dict = {}

    async def _get(key):
        return store.get(key)

    async def _set(key, value, ttl_seconds):
        store[key] = value
        assert ttl_seconds == 120

    monkeypatch.setattr(admin_api, "get_postgres_backup_status", _probe)
    monkeypatch.setattr(admin_api, "cache_get", AsyncMock(side_effect=_get))
    monkeypatch.setattr(admin_api, "cache_set", AsyncMock(side_effect=_set))

    for _ in range(2):
        response = Response()
        assert await admin_api.admin_ops_health(response=response, _admin=SimpleNamespace()) == {
            "postgres_backup": {"status": "ok", "latest_key": "k"}
        }
        assert response.headers["cache-control"] == "private, no-store"
    assert probes == [1]  # the second view is served from the short cache
