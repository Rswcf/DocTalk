"""Copy objects that exist in the source store but not in the target, then
verify every copied object by size and SHA-256. Run inside the backend
container during the R2 cutover (see .collab/plans/2026-09-26-r2-migration.md).

Source: LEGACY_MINIO_* if set (after the flip), else MINIO_* (before it).
Target: R2_ENDPOINT (default: DocTalk's R2 account endpoint), region "auto",
R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY, bucket R2_BUCKET or MINIO_BUCKET.
Prints counts and keys only; never credentials or URLs. Exits non-zero if any
copy fails verification. Existing target objects are never overwritten.
"""
from __future__ import annotations

import hashlib
import io
import os
import sys

from minio import Minio
from minio.error import S3Error

DEFAULT_R2_ENDPOINT = "https://0a78c0c34d3e08a9297247ce98d44ad1.r2.cloudflarestorage.com"


def _client(endpoint: str, access_key: str, secret_key: str, secure_default: bool, region: str | None) -> Minio:
    if "://" in endpoint:
        secure = endpoint.startswith("https://")
        endpoint = endpoint.split("://", 1)[1]
    else:
        secure = secure_default
    return Minio(endpoint.rstrip("/"), access_key=access_key, secret_key=secret_key, secure=secure, region=region)


def _flag(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in {"1", "true", "yes", "on"}


def _read(client: Minio, bucket: str, key: str) -> bytes:
    response = client.get_object(bucket, key)
    try:
        return response.read()
    finally:
        response.close()
        response.release_conn()


def main() -> int:
    env = os.environ
    prefix = "LEGACY_MINIO_" if env.get("LEGACY_MINIO_ENDPOINT") else "MINIO_"
    source = _client(env[f"{prefix}ENDPOINT"], env[f"{prefix}ACCESS_KEY"], env[f"{prefix}SECRET_KEY"],
                     _flag(f"{prefix}SECURE"), env.get(f"{prefix}REGION") or None)
    source_bucket = env.get(f"{prefix}BUCKET") or env["MINIO_BUCKET"]
    target = _client(env.get("R2_ENDPOINT", DEFAULT_R2_ENDPOINT), env["R2_ACCESS_KEY_ID"], env["R2_SECRET_ACCESS_KEY"],
                     True, env.get("R2_REGION", "auto"))
    target_bucket = env.get("R2_BUCKET") or env["MINIO_BUCKET"]
    print(f"source: {prefix}* bucket {source_bucket} -> target bucket {target_bucket}")

    source_objects = {o.object_name: o for o in source.list_objects(source_bucket, recursive=True)}
    target_keys = {o.object_name for o in target.list_objects(target_bucket, recursive=True)}
    missing = sorted(k for k in source_objects if k not in target_keys)
    print(f"source objects: {len(source_objects)}  target objects: {len(target_keys)}  to copy: {len(missing)}")

    failures = 0
    for key in missing:
        try:
            stat = source.stat_object(source_bucket, key)
            data = _read(source, source_bucket, key)
            expected = hashlib.sha256(data).hexdigest()
            target.put_object(target_bucket, key, io.BytesIO(data), length=len(data),
                              content_type=stat.content_type or "application/octet-stream")
            copied = _read(target, target_bucket, key)
            ok = len(copied) == len(data) and hashlib.sha256(copied).hexdigest() == expected
        except S3Error as exc:
            ok = False
            print(f"FAIL {key}: S3Error {exc.code}")
        except Exception as exc:  # noqa: BLE001 - class only; messages can carry request details
            ok = False
            print(f"FAIL {key}: {type(exc).__name__}")
        else:
            print(f"{'COPIED' if ok else 'MISMATCH'} {key} ({len(data)} bytes)")
        failures += 0 if ok else 1

    extra = sorted(k for k in target_keys if k not in source_objects)
    print(f"target-only objects (left untouched): {len(extra)}")
    print("DELTA OK" if not failures else f"DELTA FAILED: {failures}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
