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
from datetime import datetime, timezone
from typing import Any, Optional

from app.core.config import settings
from app.services.storage_service import storage_service

MANIFEST_MAX_BYTES = 64 * 1024
_ARTIFACT_SUFFIXES = (".dump.age", ".dump")


def _manifest_key(artifact_key: str) -> str:
    for suffix in _ARTIFACT_SUFFIXES:
        if artifact_key.endswith(suffix):
            return artifact_key[: -len(suffix)] + ".manifest.json"
    raise ValueError(artifact_key)


def _read_manifest(client, bucket: str, key: str) -> Optional[dict]:
    try:
        response = client.get_object(bucket, key, offset=0, length=MANIFEST_MAX_BYTES)
    except Exception:
        return None
    try:
        data = response.read(MANIFEST_MAX_BYTES)
    finally:
        response.close()
        response.release_conn()
    try:
        manifest = json.loads(data)
    except (ValueError, UnicodeDecodeError):
        return None
    return manifest if isinstance(manifest, dict) else None


def get_postgres_backup_status(client=None, now: Optional[datetime] = None) -> dict[str, Any]:
    """Status of the newest Postgres backup artifact.

    status is one of: ok, stale (older than PG_BACKUP_MAX_AGE_HOURS), small
    (below PG_BACKUP_MIN_BYTES), unverified (no readable manifest, the
    manifest does not describe this object, or its restore test did not
    pass), missing (no artifact at all), unreachable (the bucket could not be
    listed), disabled (monitor switched off).
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
    try:
        objects = [
            obj
            for obj in client.list_objects(bucket, prefix=settings.PG_BACKUP_PREFIX, recursive=True)
            if obj.object_name.endswith(_ARTIFACT_SUFFIXES)
        ]
    except Exception:
        return {**base, "status": "unreachable"}
    if not objects:
        return {**base, "status": "missing"}

    newest = max(objects, key=lambda obj: obj.last_modified)
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

    if age_hours > settings.PG_BACKUP_MAX_AGE_HOURS:
        result["status"] = "stale"
    elif result["bytes"] < settings.PG_BACKUP_MIN_BYTES:
        result["status"] = "small"
    elif (
        manifest is None
        or manifest.get("restore_test") != "ok"
        or manifest.get("artifact") != newest.object_name
        or manifest.get("artifact_bytes") != result["bytes"]
    ):
        result["status"] = "unverified"
    else:
        result["status"] = "ok"
    return result
