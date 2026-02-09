"""URL validation to prevent SSRF attacks.

Resolves hostnames and blocks private/internal IP ranges before fetching.
"""
from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse

from app.core.security_log import log_security_event

# Internal service ports (Postgres, Redis, Qdrant, MinIO)
_BLOCKED_PORTS = {5432, 6379, 6333, 6334, 9000, 9001}

# Private/reserved IP networks
_BLOCKED_NETWORKS = [
    # IPv4
    ipaddress.IPv4Network("10.0.0.0/8"),
    ipaddress.IPv4Network("172.16.0.0/12"),
    ipaddress.IPv4Network("192.168.0.0/16"),
    ipaddress.IPv4Network("127.0.0.0/8"),
    ipaddress.IPv4Network("169.254.0.0/16"),  # link-local / cloud metadata
    ipaddress.IPv4Network("0.0.0.0/8"),
    # IPv6
    ipaddress.IPv6Network("::1/128"),
    ipaddress.IPv6Network("fc00::/7"),  # unique local
    ipaddress.IPv6Network("fe80::/10"),  # link-local
]


def _is_blocked_ip(ip_str: str) -> bool:
    """Check whether an IP address falls within a blocked range."""
    try:
        addr = ipaddress.ip_address(ip_str)
    except ValueError:
        return True  # unparseable = blocked
    for net in _BLOCKED_NETWORKS:
        if addr in net:
            return True
    return False


def validate_url(url: str) -> str:
    """Validate a URL for safe fetching. Returns the normalized URL.

    Raises ValueError with a descriptive code on failure:
      - INVALID_URL_SCHEME: not http/https
      - INVALID_URL_HOST: missing or empty hostname
      - BLOCKED_HOST: hostname resolves to a private/reserved IP
      - BLOCKED_PORT: port targets an internal service
      - DNS_RESOLUTION_FAILED: hostname could not be resolved
    """
    parsed = urlparse(url)

    # Scheme check
    if parsed.scheme not in ("http", "https"):
        log_security_event("ssrf_block", url=url, reason="INVALID_URL_SCHEME")
        raise ValueError("INVALID_URL_SCHEME")

    hostname = parsed.hostname
    if not hostname:
        raise ValueError("INVALID_URL_HOST")

    port = parsed.port

    # Resolve hostname to IPs and check each against blocked ranges
    try:
        addrinfos = socket.getaddrinfo(hostname, port or 443, proto=socket.IPPROTO_TCP)
    except socket.gaierror:
        raise ValueError("DNS_RESOLUTION_FAILED")

    if not addrinfos:
        raise ValueError("DNS_RESOLUTION_FAILED")

    for _family, _type, _proto, _canonname, sockaddr in addrinfos:
        ip_str = sockaddr[0]
        if _is_blocked_ip(ip_str):
            log_security_event("ssrf_block", url=url, reason="BLOCKED_HOST", resolved_ip=ip_str)
            raise ValueError("BLOCKED_HOST")

    # Port check (after host check so private IPs are caught first)
    if port and port in _BLOCKED_PORTS:
        log_security_event("ssrf_block", url=url, reason="BLOCKED_PORT", port=port)
        raise ValueError("BLOCKED_PORT")

    return url
