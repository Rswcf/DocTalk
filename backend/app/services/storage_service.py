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

logger = logging.getLogger(__name__)


def _parse_minio_endpoint(endpoint: str) -> tuple[str, bool]:
    """Return (host:port, secure) from endpoint which may include scheme."""
    if endpoint.startswith("http://") or endpoint.startswith("https://"):
        parsed = urlparse(endpoint)
        secure = parsed.scheme == "https"
        host = parsed.netloc
        return host, secure
    # default: no scheme → assume insecure (dev MinIO)
    return endpoint, False


class StorageUnavailableError(RuntimeError):
    """Raised when object storage cannot complete an operation."""


class StorageService:
    def __init__(self,
                 endpoint: Optional[str] = None,
                 public_endpoint: Optional[str] = None,
                 access_key: Optional[str] = None,
                 secret_key: Optional[str] = None,
                 bucket: Optional[str] = None,
                 default_ttl: Optional[int] = None) -> None:
        endpoint = endpoint or settings.MINIO_ENDPOINT
        public_endpoint = public_endpoint or settings.MINIO_PUBLIC_ENDPOINT
        access_key = access_key or settings.MINIO_ACCESS_KEY
        secret_key = secret_key or settings.MINIO_SECRET_KEY
        bucket = bucket or settings.MINIO_BUCKET
        default_ttl = default_ttl or settings.MINIO_PRESIGN_TTL

        host, secure = _parse_minio_endpoint(endpoint)
        self._client = self._new_client(host, secure, access_key, secret_key)
        if public_endpoint:
            public_host, public_secure = _parse_minio_endpoint(public_endpoint)
            self._public_client = self._new_client(public_host, public_secure, access_key, secret_key)
        else:
            self._public_client = self._client
        self._bucket = bucket
        self._default_ttl = int(default_ttl)

    @staticmethod
    def _new_client(host: str, secure: bool, access_key: str, secret_key: str) -> Minio:
        # Configure MinIO client with short timeouts to avoid blocking the
        # asyncio event loop when MinIO is unreachable.  The default urllib3
        # retry policy retries 502/503/504 responses multiple times with
        # exponential backoff, which can block for 30+ seconds.
        import urllib3

        http_client = urllib3.PoolManager(
            timeout=urllib3.Timeout(connect=5, read=10),
            retries=urllib3.Retry(total=2, backoff_factor=0.5,
                                  status_forcelist=[500, 502, 503, 504]),
            cert_reqs="CERT_REQUIRED" if secure else "CERT_NONE",
        )
        return Minio(host, access_key=access_key, secret_key=secret_key,
                     secure=secure, http_client=http_client)

    @property
    def bucket(self) -> str:
        return self._bucket

    def _storage_unavailable(self, operation: str, exc: Exception) -> StorageUnavailableError:
        logger.warning("MinIO %s failed: %s", operation, exc)
        return StorageUnavailableError(f"Object storage {operation} failed")

    def health_check(self) -> bool:
        """Probe MinIO liveness. Returns True if reachable; raises on error.

        Used by the /health?deep=true endpoint. bucket_exists is the lightest
        authenticated call and validates both connectivity and credentials.
        """
        return bool(self._client.bucket_exists(self._bucket))

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
        """Upload bytes to MinIO under the given storage_key.

        Attempts SSE-S3 encryption first; falls back to unencrypted upload
        if KMS is not configured on the MinIO instance.
        """
        data = BytesIO(file_bytes)
        size = len(file_bytes)
        try:
            self._client.put_object(
                self._bucket,
                storage_key,
                data,
                length=size,
                content_type=content_type,
                sse=SseS3(),
            )
        except S3Error as exc:
            if "KMS" in str(exc) or exc.code == "NotImplemented":
                # KMS not configured — upload without encryption
                data.seek(0)
                try:
                    self._client.put_object(
                        self._bucket,
                        storage_key,
                        data,
                        length=size,
                        content_type=content_type,
                    )
                except Exception as fallback_exc:
                    raise self._storage_unavailable("upload", fallback_exc) from fallback_exc
            else:
                raise self._storage_unavailable("upload", exc) from exc
        except Exception as exc:
            raise self._storage_unavailable("upload", exc) from exc

    def get_presigned_url(self, storage_key: str, ttl: Optional[int] = None) -> str:
        """Generate a presigned GET URL for the object."""
        expires = datetime.timedelta(seconds=int(ttl or self._default_ttl))
        url = self._public_client.presigned_get_object(self._bucket, storage_key, expires=expires)
        return url

    def download_file(self, storage_key: str) -> bytes:
        """Download an object from MinIO as bytes."""
        response = self._client.get_object(self._bucket, storage_key)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()

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
