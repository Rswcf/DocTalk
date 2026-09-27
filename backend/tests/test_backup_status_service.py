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
    def __init__(self, data: bytes) -> None:
        self._data = data
        self.closed = False

    def read(self, amt=None):
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


def _manifest(key: str, *, size: int = BIG, restore_test: str = "ok") -> bytes:
    return json.dumps({
        "artifact": key, "artifact_bytes": size, "restore_test": restore_test,
        "alembic_version": "20260913_0046", "encrypted": True,
    }).encode()


@pytest.fixture(autouse=True)
def _enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(svc.settings, "PG_BACKUP_MONITOR_ENABLED", True)
    monkeypatch.setattr(svc.settings, "OPS_BUCKET", "doctalk-ops")
    monkeypatch.setattr(svc.settings, "PG_BACKUP_PREFIX", "postgres/")
    monkeypatch.setattr(svc.settings, "PG_BACKUP_MAX_AGE_HOURS", 30)
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


def test_backup_older_than_the_limit_is_stale() -> None:
    key = "postgres/doctalk-20260927T091500Z.dump.age"
    bucket = FakeOpsBucket(objects=[_obj(key, 30.5)], manifests={key.replace(".dump.age", ".manifest.json"): _manifest(key)})

    assert svc.get_postgres_backup_status(bucket, NOW)["status"] == "stale"


def test_undersized_artifact_is_small() -> None:
    key = "postgres/doctalk-20260928T091500Z.dump.age"
    bucket = FakeOpsBucket(
        objects=[_obj(key, 3, size=1_000)],
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
    bucket = FakeOpsBucket(objects=[_obj(key, 3)], manifests=manifests)

    assert svc.get_postgres_backup_status(bucket, NOW)["status"] == "unverified"


def test_plaintext_dump_is_recognised() -> None:
    key = "postgres/doctalk-20260928T091500Z.dump"
    bucket = FakeOpsBucket(objects=[_obj(key, 3)], manifests={"postgres/doctalk-20260928T091500Z.manifest.json": _manifest(key)})

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
        event = written[0]
        assert (event.event_name, event.source, event.reason) == ("ops.backup_stale", "beat", state)
        assert event.metadata_json == status
        assert written[1] == "commit"
        assert captured == [f"Postgres backup check: {state}"]


def test_admin_ops_health_is_an_admin_only_get() -> None:
    from app.api import admin as admin_api
    from app.core.deps import require_admin

    route = next(r for r in admin_api.router.routes if r.path == "/api/admin/ops-health")
    assert route.methods == {"GET"}
    assert any(dep.call is require_admin for dep in route.dependant.dependencies)


@pytest.mark.asyncio
async def test_admin_ops_health_returns_the_backup_status(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.api import admin as admin_api

    monkeypatch.setattr(admin_api, "get_postgres_backup_status", lambda: {"status": "ok", "latest_key": "k"})

    assert await admin_api.admin_ops_health(_admin=SimpleNamespace()) == {
        "postgres_backup": {"status": "ok", "latest_key": "k"}
    }
