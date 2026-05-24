"""Tests for the HMAC IP trust chain (Wave-1 C1).

Covers the triple-header contract (`X-Proxy-IP` / `X-Proxy-IP-Ts` /
`X-Proxy-IP-Sig` signed with `ADAPTER_SECRET`). The legacy dual-accept path
(`X-Real-Client-IP` + `X-Proxy-IP-Secret` compared against `AUTH_SECRET`) was
removed 2026-05-24 as the C1 follow-up, 24h after the HMAC rollout with zero
`proxy.signed_ip.legacy_path_used`. Several tests below now guard that legacy
claims are NO LONGER trusted: stale / partial / legacy-only requests fall
through to the connection host, never to a claimed IP.
"""

from __future__ import annotations

import hmac
import logging
import time
from dataclasses import dataclass
from typing import Any

import pytest

from app.core import rate_limit
from app.core.rate_limit import get_client_ip, verify_signed_ip
from tests.conftest import TEST_ADAPTER_SECRET, TEST_AUTH_SECRET


def _sign(ip: str, ts: int, secret: str = TEST_ADAPTER_SECRET) -> str:
    return hmac.new(
        secret.encode("utf-8"),
        f"{ip}:{ts}".encode("utf-8"),
        digestmod="sha256",
    ).hexdigest()


@dataclass
class _FakeClient:
    host: str


class _FakeRequest:
    """Minimal Request stand-in. get_client_ip only reads .headers and .client."""

    def __init__(self, headers: dict[str, str], client_host: str = "10.0.0.1"):
        # FastAPI Request headers are case-insensitive; replicate that.
        self.headers = _CaseInsensitiveHeaders(headers)
        self.client = _FakeClient(host=client_host)


class _CaseInsensitiveHeaders(dict):
    def __init__(self, mapping: dict[str, str]):
        super().__init__()
        for k, v in mapping.items():
            self[k.lower()] = v

    def get(self, key: str, default: Any = None) -> Any:  # type: ignore[override]
        return super().get(key.lower(), default)


@pytest.fixture(autouse=True)
def _ensure_secrets_loaded(monkeypatch: pytest.MonkeyPatch) -> None:
    """conftest sets env vars, but rate_limit.py snapshots bytes at import.
    Force ADAPTER_SECRET to the test value so tests are independent of import
    order. (AUTH_SECRET is no longer used for IP trust after the C1 follow-up.)
    """
    monkeypatch.setattr(
        rate_limit, "_ADAPTER_SECRET_BYTES", TEST_ADAPTER_SECRET.encode("utf-8")
    )


# 1
def test_valid_new_contract_passes() -> None:
    ts = int(time.time())
    ok, reason = verify_signed_ip(ip="1.2.3.4", ts=str(ts), sig=_sign("1.2.3.4", ts))
    assert ok is True
    assert reason is None


# 2
def test_skew_within_window_passes() -> None:
    ts = int(time.time()) - 50  # within 60s window
    ok, reason = verify_signed_ip(ip="1.2.3.4", ts=str(ts), sig=_sign("1.2.3.4", ts))
    assert ok is True
    assert reason is None


# 3
def test_skew_exceeds_window_fails() -> None:
    ts = int(time.time()) - 120  # outside 60s window
    ok, reason = verify_signed_ip(ip="1.2.3.4", ts=str(ts), sig=_sign("1.2.3.4", ts))
    assert ok is False
    assert reason == "skew_exceeded"


# 4
def test_malformed_timestamp_fails() -> None:
    ok, reason = verify_signed_ip(ip="1.2.3.4", ts="not-a-number", sig="deadbeef")
    assert ok is False
    assert reason == "malformed_ts"


# 5
def test_bad_signature_fails() -> None:
    ts = int(time.time())
    ok, reason = verify_signed_ip(ip="1.2.3.4", ts=str(ts), sig="0" * 64)
    assert ok is False
    assert reason == "bad_signature"


# 6
def test_missing_headers_returns_none() -> None:
    ok, reason = verify_signed_ip(ip=None, ts=None, sig=None)
    assert ok is False
    assert reason == "missing_headers"

    ok, reason = verify_signed_ip(ip="1.2.3.4", ts=None, sig=None)
    assert ok is False
    assert reason == "missing_headers"

    # Through the request-level path: no headers at all → falls back to host.
    req = _FakeRequest(headers={}, client_host="10.0.0.5")
    assert get_client_ip(req) == "10.0.0.5"


# 7 — C1 follow-up regression guard: the legacy contract is GONE. A well-formed
# legacy claim (the exact headers that used to be trusted) must now be ignored
# and fall through to the connection host — never trusted as the client IP.
def test_legacy_headers_no_longer_trusted() -> None:
    req = _FakeRequest(
        headers={
            "X-Real-Client-IP": "203.0.113.7",
            "X-Proxy-IP-Secret": TEST_AUTH_SECRET,  # was valid before removal
        },
        client_host="10.0.0.1",
    )
    assert get_client_ip(req) == "10.0.0.1"  # legacy ignored → connection host


# 8 — when a valid new contract arrives, it wins; stray legacy headers (if any
# misconfigured client still sends them) are simply ignored.
def test_new_contract_wins_over_stray_legacy_headers() -> None:
    ts = int(time.time())
    req = _FakeRequest(
        headers={
            "X-Proxy-IP": "198.51.100.5",
            "X-Proxy-IP-Ts": str(ts),
            "X-Proxy-IP-Sig": _sign("198.51.100.5", ts),
            # Legacy headers present but no longer consulted.
            "X-Real-Client-IP": "203.0.113.99",
            "X-Proxy-IP-Secret": TEST_AUTH_SECRET,
        },
        client_host="10.0.0.1",
    )
    assert get_client_ip(req) == "198.51.100.5"


# 9 — partial new headers (IP only, Ts/Sig missing): verification fails with
# `missing_headers`, a warning is logged, and we fall through to the connection
# host (NOT to any legacy claim, which is no longer trusted).
def test_partial_new_headers_fall_through_to_host(
    caplog: pytest.LogCaptureFixture,
) -> None:
    req = _FakeRequest(
        headers={
            "X-Proxy-IP": "198.51.100.77",  # Ts/Sig missing
            # Legacy headers present but ignored.
            "X-Real-Client-IP": "203.0.113.55",
            "X-Proxy-IP-Secret": TEST_AUTH_SECRET,
        },
        client_host="10.0.0.1",
    )
    with caplog.at_level(logging.WARNING, logger="app.core.rate_limit"):
        result = get_client_ip(req)

    assert result == "10.0.0.1"  # connection host, not the legacy or partial claim
    failed_records = [
        r for r in caplog.records if r.message == "proxy.signed_ip.verification_failed"
    ]
    assert failed_records, "expected a verification_failed warning to be logged"
    assert getattr(failed_records[0], "reason", None) == "missing_headers"


# 10 — stale new contract (signature valid but timestamp outside the ±60s
# window): reject the stale claim, log a warning, and fall through to the
# connection host. Legacy headers, even if valid, are ignored.
def test_stale_new_contract_falls_through_to_host(
    caplog: pytest.LogCaptureFixture,
) -> None:
    stale_ts = int(time.time()) - 120  # 2 min in the past — outside 60s window
    req = _FakeRequest(
        headers={
            "X-Proxy-IP": "198.51.100.88",
            "X-Proxy-IP-Ts": str(stale_ts),
            "X-Proxy-IP-Sig": _sign("198.51.100.88", stale_ts),
            # Legacy headers present but ignored.
            "X-Real-Client-IP": "203.0.113.66",
            "X-Proxy-IP-Secret": TEST_AUTH_SECRET,
        },
        client_host="10.0.0.1",
    )
    with caplog.at_level(logging.WARNING, logger="app.core.rate_limit"):
        result = get_client_ip(req)

    assert result == "10.0.0.1"  # connection host, not the stale or legacy claim
    failed_records = [
        r for r in caplog.records if r.message == "proxy.signed_ip.verification_failed"
    ]
    assert failed_records, "expected a verification_failed warning to be logged"
    assert getattr(failed_records[0], "reason", None) == "skew_exceeded"


# 11 — misconfig guard: if the backend is deployed without ADAPTER_SECRET
# set, verify_signed_ip must return (False, "no_adapter_secret") instead of
# silently passing on a zero-byte HMAC key. Caught at unit level so an
# accidental env-var omission shows up loudly in monitoring rather than
# becoming a quiet trust-everything bug.
def test_missing_adapter_secret_returns_no_adapter_secret_reason(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(rate_limit, "_ADAPTER_SECRET_BYTES", b"")
    ok, reason = verify_signed_ip(
        ip="1.2.3.4", ts=str(int(time.time())), sig="deadbeef"
    )
    assert ok is False
    assert reason == "no_adapter_secret"
