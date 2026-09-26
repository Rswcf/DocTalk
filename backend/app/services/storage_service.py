from __future__ import annotations

import datetime
import logging
from io import BytesIO
from typing import Optional
from urllib.parse import urlparse

from minio import Minio
from minio.error import S3Error

from app.core.config import settings

logger = logging.getLogger(__name__)


def _parse_minio_endpoint(endpoint: str, default_secure: bool = False) -> tuple[str, bool]:
    """Return (host:port, secure) from endpoint which may include scheme.

    A scheme wins; a bare host:port uses ``default_secure`` (MINIO_SECURE).
    """
    if endpoint.startswith("http://") or endpoint.startswith("https://"):
        parsed = urlparse(endpoint)
        secure = parsed.scheme == "https"
        host = parsed.netloc
        return host, secure
    return endpoint, default_secure


class StorageUnavailableError(RuntimeError):
    """Raised when object storage cannot complete an operation."""


class StorageService:
    """S3-compatible object storage: Cloudflare R2 in production, MinIO in
    dev and CI. Every other module reaches the bucket through this one client."""

    def __init__(self,
                 endpoint: Optional[str] = None,
                 public_endpoint: Optional[str] = None,
                 access_key: Optional[str] = None,
                 secret_key: Optional[str] = None,
                 bucket: Optional[str] = None,
                 default_ttl: Optional[int] = None,
                 region: Optional[str] = None) -> None:
        endpoint = endpoint or settings.MINIO_ENDPOINT
        public_endpoint = public_endpoint or settings.MINIO_PUBLIC_ENDPOINT
        access_key = access_key or settings.MINIO_ACCESS_KEY
        secret_key = secret_key or settings.MINIO_SECRET_KEY
        bucket = bucket or settings.MINIO_BUCKET
        default_ttl = default_ttl or settings.MINIO_PRESIGN_TTL
        # R2 wants "auto". A fixed region also stops minio-py from issuing a
        # GetBucketLocation lookup before its first request.
        region = region or settings.MINIO_REGION

        host, secure = _parse_minio_endpoint(endpoint, bool(settings.MINIO_SECURE))
        self._client = self._new_client(host, secure, access_key, secret_key, region)
        if public_endpoint:
            public_host, public_secure = _parse_minio_endpoint(public_endpoint, bool(settings.MINIO_SECURE))
            self._public_client = self._new_client(public_host, public_secure, access_key, secret_key, region)
        else:
            self._public_client = self._client
        self._bucket = bucket
        self._default_ttl = int(default_ttl)

    @staticmethod
    def _new_client(host: str, secure: bool, access_key: str, secret_key: str,
                    region: Optional[str] = None) -> Minio:
        # Short timeouts keep a storage outage from blocking the asyncio event
        # loop. The default urllib3 retry policy retries 502/503/504 responses
        # multiple times with exponential backoff, which can block for 30+ s.
        import urllib3

        pool_kwargs: dict = {
            "timeout": urllib3.Timeout(connect=5, read=10),
            "retries": urllib3.Retry(total=2, backoff_factor=0.5,
                                     status_forcelist=[500, 502, 503, 504]),
        }
        if secure:
            import certifi

            # CERT_REQUIRED with no CA bundle fails every TLS handshake. Until
            # R2, no production request went over TLS (the internal MinIO
            # endpoint is plain http; the https client only signed URLs).
            pool_kwargs.update(cert_reqs="CERT_REQUIRED", ca_certs=certifi.where())
        else:
            pool_kwargs["cert_reqs"] = "CERT_NONE"
        http_client = urllib3.PoolManager(**pool_kwargs)
        return Minio(host, access_key=access_key, secret_key=secret_key,
                     secure=secure, region=region, http_client=http_client)

    @property
    def bucket(self) -> str:
        return self._bucket

    @property
    def client(self) -> Minio:
        """The server-side client, for the few callers that need raw S3 calls."""
        return self._client

    def _storage_unavailable(self, operation: str, exc: Exception) -> StorageUnavailableError:
        logger.warning("Object storage %s failed: %s", operation, exc)
        return StorageUnavailableError(f"Object storage {operation} failed")

    def _bucket_reachable(self) -> bool:
        """True if the bucket exists and the credentials can read it.

        HeadBucket is not guaranteed under a bucket-scoped R2 token, so an
        AccessDenied there falls back to listing (one request, first page),
        which such a token can always do on its own bucket.
        """
        try:
            return bool(self._client.bucket_exists(self._bucket))
        except S3Error as exc:
            if exc.code != "AccessDenied":
                raise
        next(iter(self._client.list_objects(self._bucket)), None)
        return True

    def health_check(self) -> bool:
        """Probe object storage for /health?deep=true. Returns True if the
        bucket is reachable with these credentials; raises on error."""
        return self._bucket_reachable()

    def ensure_bucket(self) -> None:
        """Create the bucket if it does not exist (dev and CI; production's
        bucket is provisioned ahead of time).

        No bucket-encryption call: R2 encrypts every object at rest and does
        not accept SSE settings, and MinIO without KMS rejects them.
        """
        if not self._bucket_reachable():
            self._client.make_bucket(self._bucket)

    def upload_file(self, file_bytes: bytes, storage_key: str, content_type: str = "application/pdf") -> None:
        """Upload bytes under the given storage_key."""
        try:
            self._client.put_object(
                self._bucket,
                storage_key,
                BytesIO(file_bytes),
                length=len(file_bytes),
                content_type=content_type,
            )
        except Exception as exc:
            raise self._storage_unavailable("upload", exc) from exc

    def get_presigned_url(self, storage_key: str, ttl: Optional[int] = None) -> str:
        """Generate a presigned GET URL for the object."""
        expires = datetime.timedelta(seconds=int(ttl or self._default_ttl))
        url = self._public_client.presigned_get_object(self._bucket, storage_key, expires=expires)
        return url

    def download_file(self, storage_key: str) -> bytes:
        """Download an object as bytes."""
        response = self._client.get_object(self._bucket, storage_key)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()

    def object_exists(self, storage_key: str) -> bool:
        """True if the object exists; False only for NoSuchKey."""
        try:
            self._client.stat_object(self._bucket, storage_key)
        except S3Error as exc:
            if exc.code == "NoSuchKey":
                return False
            raise
        return True

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
