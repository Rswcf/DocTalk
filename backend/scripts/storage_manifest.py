"""Print one JSON line per object in the configured bucket (key, size,
sha256, last_modified), streaming each object through SHA-256. Run inside the
backend container before and after a storage cutover and diff the two
outputs: the migration is complete when every key matches in size and hash.
Compare sorted (key, size, sha256) projections; last_modified differs
between stores. Accept a manifest only if the run exits 0.

ETags are not compared on purpose: minio-py uploads anything over 5 MiB in
parts, so those ETags are composite and differ between stores.
"""
from __future__ import annotations

import hashlib
import json
import os
import sys

# Run as a file, sys.path[0] is backend/scripts; `app` lives one level up.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.storage_service import storage_service


def main() -> None:
    # Long timeouts: a slow object must not abort the scan halfway.
    client = storage_service.transfer_client
    bucket = storage_service.bucket
    for obj in client.list_objects(bucket, recursive=True):
        digest = hashlib.sha256()
        response = client.get_object(bucket, obj.object_name)
        try:
            for chunk in response.stream(1024 * 1024):
                digest.update(chunk)
        finally:
            response.close()
            response.release_conn()
        print(json.dumps({
            "key": obj.object_name,
            "size": obj.size,
            "sha256": digest.hexdigest(),
            "last_modified": obj.last_modified.isoformat() if obj.last_modified else None,
        }))


if __name__ == "__main__":
    main()
