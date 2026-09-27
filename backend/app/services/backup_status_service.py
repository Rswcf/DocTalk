"""Independent check that the nightly Postgres backup exists and is sound.

The `pg-backup` Railway cron service (infra/pg-backup) writes
`<prefix>doctalk-<UTC>.dump.age` plus a `.manifest.json` into the ops bucket
and reports to its own dead-man's switch. This module looks at the result from
the outside, so a job that "succeeded" but wrote nothing usable, or stopped
running altogether, is still caught. Read-only; sync (callers in async code
wrap it in asyncio.to_thread).
"""
from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from typing import Any, Optional

from app.core.config import settings
from app.services.storage_service import storage_service

MANIFEST_MAX_BYTES = 64 * 1024
# The prefix holds ~35 daily artifacts (lifecycle expiry) plus manifests; a
# scan that needs more than this, or longer, is itself a problem.
LIST_MAX_ENTRIES = 5000
LIST_DEADLINE_SECONDS = 60
_ARTIFACT_SUFFIXES = (".dump.age", ".dump")


def _manifest_key(artifact_key: str) -> str:
    for suffix in _ARTIFACT_SUFFIXES:
        if artifact_key.endswith(suffix):
            return artifact_key[: -len(suffix)] + ".manifest.json"
    raise ValueError(artifact_key)


def _read_manifest(client, bucket: str, key: str) -> Optional[dict]:
    """The parsed manifest, or None when it is missing, unreadable or not
    JSON. Never raises: a failed body read must not skip the alert path."""
    try:
        response = client.get_object(bucket, key, offset=0, length=MANIFEST_MAX_BYTES)
    except Exception:
        return None
    try:
        data = response.read(MANIFEST_MAX_BYTES)
    except Exception:
        return None
    finally:
        try:
            response.close()
            response.release_conn()
        except Exception:
            pass
    try:
        manifest = json.loads(data)
    except (ValueError, UnicodeDecodeError):
        return None
    return manifest if isinstance(manifest, dict) else None


def _newest_artifact(client, bucket: str) -> tuple[str, Any]:
    """('ok', newest object or None) or ('unreachable', None). Tracks the
    newest object while scanning, within an entry budget and a deadline; an
    incomplete scan never yields a partial maximum."""
    deadline = time.monotonic() + LIST_DEADLINE_SECONDS
    newest = None
    try:
        for seen, obj in enumerate(
            client.list_objects(bucket, prefix=settings.PG_BACKUP_PREFIX, recursive=True), start=1
        ):
            if seen > LIST_MAX_ENTRIES or time.monotonic() > deadline:
                return "unreachable", None
            if not obj.object_name.endswith(_ARTIFACT_SUFFIXES):
                continue
            if newest is None or obj.last_modified > newest.last_modified:
                newest = obj
    except Exception:
        return "unreachable", None
    return "ok", newest


def get_postgres_backup_status(client=None, now: Optional[datetime] = None) -> dict[str, Any]:
    """Status of the newest Postgres backup artifact.

    status is one of: ok, stale (older than PG_BACKUP_MAX_AGE_HOURS), small
    (below PG_BACKUP_MIN_BYTES), unverified (no readable manifest, or the
    manifest does not describe this object, its restore test did not pass,
    or its encryption flag contradicts the file type), missing (no artifact
    at all), unreachable (the bucket could not be listed in full), disabled
    (monitor switched off). Precedence: stale > small > unverified.
    """
    base: dict[str, Any] = {
        "status": "disabled",
        "max_age_hours": settings.PG_BACKUP_MAX_AGE_HOURS,
        "latest_key": None,
        "created_at": None,
        "age_hours": None,
        "bytes": None,
        "restore_test": None,
        "alembic_version": None,
        "encrypted": None,
    }
    if not settings.PG_BACKUP_MONITOR_ENABLED:
        return base

    client = client or storage_service.client
    bucket = settings.OPS_BUCKET
    now = now or datetime.now(timezone.utc)
    scan, newest = _newest_artifact(client, bucket)
    if scan != "ok":
        return {**base, "status": "unreachable"}
    if newest is None:
        return {**base, "status": "missing"}

    age_hours = (now - newest.last_modified).total_seconds() / 3600
    result = {
        **base,
        "latest_key": newest.object_name,
        "created_at": newest.last_modified.isoformat(),
        "age_hours": round(age_hours, 1),
        "bytes": int(newest.size or 0),
    }

    manifest = _read_manifest(client, bucket, _manifest_key(newest.object_name))
    if manifest is not None:
        result["restore_test"] = manifest.get("restore_test")
        result["alembic_version"] = manifest.get("alembic_version")
        result["encrypted"] = manifest.get("encrypted")

    expect_encrypted = newest.object_name.endswith(".dump.age")
    if age_hours > settings.PG_BACKUP_MAX_AGE_HOURS:
        result["status"] = "stale"
    elif result["bytes"] < settings.PG_BACKUP_MIN_BYTES:
        result["status"] = "small"
    elif (
        manifest is None
        or manifest.get("restore_test") != "ok"
        or manifest.get("artifact") != newest.object_name
        or manifest.get("artifact_bytes") != result["bytes"]
        or manifest.get("encrypted") is not expect_encrypted
    ):
        result["status"] = "unverified"
    else:
        result["status"] = "ok"
    return result
