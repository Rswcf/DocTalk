from __future__ import annotations

import datetime
import functools
import logging
import os
import socket
from io import BytesIO
from typing import Optional
from urllib.parse import urlparse

from minio import Minio
from minio.error import S3Error

from app.core.config import settings

logger = logging.getLogger(__name__)

# TCP keepalive for every pooled storage connection (2026-10-12). A keep-alive
# connection that sat idle in the pool for 30-50 minutes was dropped silently
# on the path (no FIN, no RST: Railway's egress NAT or a load balancer forgot
# the flow). urllib3's checkout test only notices a FIN or an RST, so it handed
# out the dead socket, the request went nowhere, and the worker waited out the
# whole read timeout: 300 s on the transfer client, twice in production.
# - Probes after 60 s idle keep the path's flow state alive; a path that is
#   gone anyway fails them, the kernel marks the socket dead, and the checkout
#   test discards it.
# - TCP_USER_TIMEOUT (Linux) bounds a request written onto a socket that died
#   since the last probe: data unacknowledged for IDLE + INTERVAL * COUNT
#   aborts the connection, and urllib3 retries the request. It counts only
#   our own unacknowledged bytes, so a slow but live response is still
#   waited out for the full read timeout.
KEEPALIVE_IDLE_S = 60
KEEPALIVE_INTERVAL_S = 10
KEEPALIVE_COUNT = 3


def _candidate_socket_options(idle: int, interval: int, count: int) -> list[tuple[int, int, int]]:
    tcp = socket.IPPROTO_TCP
    # socket_options REPLACES urllib3's default list, which is TCP_NODELAY.
    options = [(tcp, socket.TCP_NODELAY, 1), (socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)]
    # Linux names the idle time TCP_KEEPIDLE; macOS (dev) names it TCP_KEEPALIVE.
    idle_option = getattr(socket, "TCP_KEEPIDLE", None)
    if idle_option is None:
        idle_option = getattr(socket, "TCP_KEEPALIVE", None)
    for option, value in (
        (idle_option, idle),
        (getattr(socket, "TCP_KEEPINTVL", None), interval),
        (getattr(socket, "TCP_KEEPCNT", None), count),
        (getattr(socket, "TCP_USER_TIMEOUT", None), (idle + interval * count) * 1000),  # milliseconds
    ):
        if option is not None:
            options.append((tcp, option, value))
    return options


@functools.lru_cache(maxsize=None)
def _accepted_socket_options(idle: int, interval: int, count: int) -> tuple[tuple[int, int, int], ...]:
    accepted = []
    probe = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        for level, option, value in _candidate_socket_options(idle, interval, count):
            try:
                probe.setsockopt(level, option, value)
            except OSError as exc:
                logger.warning("Storage socket option (%s, %s, %s) rejected: %s", level, option, value, exc)
                continue
            accepted.append((level, option, value))
    finally:
        probe.close()
    logger.info("Storage connection socket options: %s", accepted)
    return tuple(accepted)


def pool_socket_options(idle: int = KEEPALIVE_IDLE_S, interval: int = KEEPALIVE_INTERVAL_S,
                        count: int = KEEPALIVE_COUNT) -> list[tuple[int, int, int]]:
    """Socket options for the storage connection pools: the candidates this
    kernel accepts. urllib3 sets them on every new socket and a rejected one
    would fail every storage request, so each is tried on a throwaway socket
    first and left out if the kernel refuses it."""
    return list(_accepted_socket_options(idle, interval, count))


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
        self._transfer_args = dict(endpoint=host, access_key=access_key, secret_key=secret_key,
                                   secure=secure, region=region)
        self._transfer_client: Optional[Minio] = None
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
        # Retry-After is ignored: a 503 asking for an hour would otherwise hold
        # the calling thread that long.
        import urllib3

        pool_kwargs: dict = {
            "timeout": urllib3.Timeout(connect=5, read=10),
            "retries": urllib3.Retry(total=2, backoff_factor=0.5,
                                     status_forcelist=[429, 500, 502, 503, 504],
                                     respect_retry_after_header=False),
            "socket_options": pool_socket_options(),
        }
        if secure:
            import certifi

            # Explicit trust store, the same one minio-py uses by default.
            # Until R2 the only TLS client here was the presign-only public one.
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

    @property
    def transfer_client(self) -> Minio:
        """Same endpoint, credentials, TLS and region, but minio-py's own HTTP
        policy (5-minute timeouts, 5 retries) for worker-side transfers, with
        the same TCP keepalive as the request client.

        The parse worker streams whole documents; under the request client's
        10 s read timeout a slow response body would fail the download
        terminally instead of waiting it out, as it always has.
        """
        if self._transfer_client is None:
            args = dict(self._transfer_args)
            self._transfer_client = Minio(args.pop("endpoint"), http_client=self._transfer_http_client(), **args)
        return self._transfer_client

    @staticmethod
    def _transfer_http_client():
        """The pool minio-py 7.2 builds when it is given none (Minio.__init__
        in minio/api.py), plus the keepalive socket options. A test pins every
        other setting against the pool minio-py itself builds."""
        import certifi
        import urllib3

        timeout = int(datetime.timedelta(minutes=5).total_seconds())
        return urllib3.PoolManager(
            timeout=urllib3.Timeout(connect=timeout, read=timeout),
            maxsize=10,
            cert_reqs="CERT_REQUIRED",
            ca_certs=os.environ.get("SSL_CERT_FILE") or certifi.where(),
            retries=urllib3.Retry(total=5, backoff_factor=0.2, status_forcelist=[500, 502, 503, 504]),
            socket_options=pool_socket_options(),
        )

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
        """True if the object exists; False only when the bucket is reachable
        and the key is not in it. Anything else raises.

        minio-py turns every bodyless 404 on an object HEAD into a synthesized
        NoSuchKey, whatever the cause, so a missing or misconfigured bucket
        looks exactly like a missing object. Callers treat False as permanent
        loss (410 FILE_MISSING), so a miss is confirmed against the bucket
        first, and an unreachable bucket raises instead of returning False.
        """
        try:
            self._client.stat_object(self._bucket, storage_key)
        except S3Error as exc:
            if exc.code != "NoSuchKey":
                raise
        else:
            return True
        if not self._bucket_reachable():
            raise StorageUnavailableError("Object storage bucket is not reachable")
        return False

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
