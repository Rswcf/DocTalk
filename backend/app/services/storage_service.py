from __future__ import annotations

import datetime
import logging
from io import BytesIO
from typing import Optional
from urllib.parse import urlparse

from minio import Minio
from minio.error import S3Error
from minio.sse import SseS3
from minio.sseconfig import Rule, SSEConfig

from app.core.config import settings


def _parse_minio_endpoint(endpoint: str) -> tuple[str, bool]:
    """Return (host:port, secure) from endpoint which may include scheme."""
    if endpoint.startswith("http://") or endpoint.startswith("https://"):
        parsed = urlparse(endpoint)
        secure = parsed.scheme == "https"
        host = parsed.netloc
        return host, secure
    # default: no scheme → assume insecure (dev MinIO)
    return endpoint, False


class StorageService:
    def __init__(self,
                 endpoint: Optional[str] = None,
                 access_key: Optional[str] = None,
                 secret_key: Optional[str] = None,
                 bucket: Optional[str] = None,
                 default_ttl: Optional[int] = None) -> None:
        endpoint = endpoint or settings.MINIO_ENDPOINT
        access_key = access_key or settings.MINIO_ACCESS_KEY
        secret_key = secret_key or settings.MINIO_SECRET_KEY
        bucket = bucket or settings.MINIO_BUCKET
        default_ttl = default_ttl or settings.MINIO_PRESIGN_TTL

        host, secure = _parse_minio_endpoint(endpoint)
        self._client = Minio(host, access_key=access_key, secret_key=secret_key, secure=secure)
        self._bucket = bucket
        self._default_ttl = int(default_ttl)

    @property
    def bucket(self) -> str:
        return self._bucket

    def ensure_bucket(self) -> None:
        """Create bucket if it does not exist. Sets default SSE-S3 encryption."""
        found = self._client.bucket_exists(self._bucket)
        if not found:
            self._client.make_bucket(self._bucket)
        # Enable default server-side encryption (AES-256)
        try:
            self._client.set_bucket_encryption(
                self._bucket, SSEConfig(Rule.new_sse_s3_rule())
            )
        except Exception:
            logging.getLogger(__name__).warning(
                "Could not set bucket encryption policy — MinIO version may not support it"
            )

    def upload_file(self, file_bytes: bytes, storage_key: str, content_type: str = "application/pdf") -> None:
        """Upload bytes to MinIO under the given storage_key."""
        data = BytesIO(file_bytes)
        size = len(file_bytes)
        self._client.put_object(
            self._bucket,
            storage_key,
            data,
            length=size,
            content_type=content_type,
            sse=SseS3(),
        )

    def get_presigned_url(self, storage_key: str, ttl: Optional[int] = None) -> str:
        """Generate a presigned GET URL for the object."""
        expires = datetime.timedelta(seconds=int(ttl or self._default_ttl))
        url = self._client.presigned_get_object(self._bucket, storage_key, expires=expires)
        return url

    def delete_file(self, storage_key: str) -> None:
        """Delete an object. No-op if not found."""
        try:
            self._client.remove_object(self._bucket, storage_key)
        except S3Error as exc:
            # If the object does not exist, ignore
            if getattr(exc, "code", None) != "NoSuchKey":
                raise


# Singleton instance for app-wide use
storage_service = StorageService()

