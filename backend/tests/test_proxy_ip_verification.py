"""Tests for the HMAC IP trust chain (Wave-1 C1).

Covers the new triple-header contract (`X-Proxy-IP` / `X-Proxy-IP-Ts` /
`X-Proxy-IP-Sig` signed with `ADAPTER_SECRET`), the dual-accept legacy branch
(`X-Real-Client-IP` + `X-Proxy-IP-Secret` compared against `AUTH_SECRET`), and
two regression guards for bugs Codex caught in R4 (wrong fallback header) and
R5 (wrong legacy secret) during the consensus loop.
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
    Force them to the test values so tests are independent of import order.
    """
    monkeypatch.setattr(
        rate_limit, "_ADAPTER_SECRET_BYTES", TEST_ADAPTER_SECRET.encode("utf-8")
    )
    monkeypatch.setattr(
        rate_limit, "_AUTH_SECRET_BYTES", TEST_AUTH_SECRET.encode("utf-8")
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


# 7
def test_legacy_secret_with_auth_secret_passes() -> None:
    """Legacy contract: X-Proxy-IP-Secret compared against AUTH_SECRET."""
    req = _FakeRequest(
        headers={
            "X-Real-Client-IP": "203.0.113.7",
            "X-Proxy-IP-Secret": TEST_AUTH_SECRET,
        },
        client_host="10.0.0.1",
    )
    assert get_client_ip(req) == "203.0.113.7"


# 8 — regression guard for the Codex R5 catch
def test_legacy_secret_with_adapter_secret_fails() -> None:
    """If we mistakenly compared the legacy secret against ADAPTER_SECRET, the
    rollout would 429-collapse all in-flight legacy requests. Guard against
    re-introducing that bug. AUTH_SECRET is the legitimate legacy key.
    """
    assert TEST_ADAPTER_SECRET != TEST_AUTH_SECRET  # sanity
    req = _FakeRequest(
        headers={
            "X-Real-Client-IP": "203.0.113.7",
            "X-Proxy-IP-Secret": TEST_ADAPTER_SECRET,  # WRONG secret for legacy
        },
        client_host="10.0.0.1",
    )
    # Should reject the legacy claim and fall through to client.host.
    assert get_client_ip(req) == "10.0.0.1"


# 9 — regression guard for the Codex R4 catch
def test_legacy_returns_x_real_client_ip_not_client_host() -> None:
    """The production legacy contract is `X-Real-Client-IP`, not `X-Real-IP`.
    If we'd read the wrong header, all traffic would collapse to Vercel egress
    IPs and mass-429 legitimate users during the rollout window. Guard.
    """
    req = _FakeRequest(
        headers={
            # The OLD/WRONG header name — must NOT be trusted.
            "X-Real-IP": "8.8.8.8",
            # The correct legacy header.
            "X-Real-Client-IP": "203.0.113.42",
            "X-Proxy-IP-Secret": TEST_AUTH_SECRET,
        },
        client_host="10.0.0.1",
    )
    assert get_client_ip(req) == "203.0.113.42"


# 10 — bonus: when both contracts arrive, the new path wins.
def test_both_old_and_new_headers_new_path_preferred() -> None:
    ts = int(time.time())
    req = _FakeRequest(
        headers={
            # New contract — should win.
            "X-Proxy-IP": "198.51.100.5",
            "X-Proxy-IP-Ts": str(ts),
            "X-Proxy-IP-Sig": _sign("198.51.100.5", ts),
            # Legacy contract — present but should be ignored when new is valid.
            "X-Real-Client-IP": "203.0.113.99",
            "X-Proxy-IP-Secret": TEST_AUTH_SECRET,
        },
        client_host="10.0.0.1",
    )
    assert get_client_ip(req) == "198.51.100.5"


# 11 — transition-window guard: misconfigured proxy emits only X-Proxy-IP
# (e.g. an outdated edge worker that knows the IP header but not the
# Ts/Sig pair). New-contract verification must fail with `missing_headers`,
# we must log a warning so the misconfig is observable, and we must still
# fall through to the legacy path which has valid credentials.
def test_partial_new_headers_falls_through_to_legacy(
    caplog: pytest.LogCaptureFixture,
) -> None:
    req = _FakeRequest(
        headers={
            # Only the IP header from the new contract — Ts/Sig missing.
            "X-Proxy-IP": "198.51.100.77",
            # Valid legacy fallback.
            "X-Real-Client-IP": "203.0.113.55",
            "X-Proxy-IP-Secret": TEST_AUTH_SECRET,
        },
        client_host="10.0.0.1",
    )
    with caplog.at_level(logging.WARNING, logger="app.core.rate_limit"):
        result = get_client_ip(req)

    assert result == "203.0.113.55"  # legacy IP, NOT the partial-new claim
    failed_records = [
        r for r in caplog.records if r.message == "proxy.signed_ip.verification_failed"
    ]
    assert failed_records, "expected a verification_failed warning to be logged"
    # `extra=` attaches kwargs as attributes on the LogRecord.
    assert getattr(failed_records[0], "reason", None) == "missing_headers"


# 12 — transition-window guard: rollout clock-skew scenario. New-contract
# headers are present but timestamped outside the ±60s window (NTP drift
# between Vercel and Railway, or a delayed proxy retry). Legacy headers
# remain valid. We must reject the stale new claim, log a warning, and
# return the legacy IP — not request.client.host (which would be the
# Vercel egress and mass-429 legitimate users).
def test_new_contract_invalid_legacy_valid_falls_through(
    caplog: pytest.LogCaptureFixture,
) -> None:
    stale_ts = int(time.time()) - 120  # 2 min in the past — outside 60s window
    req = _FakeRequest(
        headers={
            # New contract — signature is valid for stale_ts, but skew check fails.
            "X-Proxy-IP": "198.51.100.88",
            "X-Proxy-IP-Ts": str(stale_ts),
            "X-Proxy-IP-Sig": _sign("198.51.100.88", stale_ts),
            # Valid legacy fallback.
            "X-Real-Client-IP": "203.0.113.66",
            "X-Proxy-IP-Secret": TEST_AUTH_SECRET,
        },
        client_host="10.0.0.1",
    )
    with caplog.at_level(logging.WARNING, logger="app.core.rate_limit"):
        result = get_client_ip(req)

    assert result == "203.0.113.66"  # legacy IP, not the stale new claim or egress host
    failed_records = [
        r for r in caplog.records if r.message == "proxy.signed_ip.verification_failed"
    ]
    assert failed_records, "expected a verification_failed warning to be logged"
    assert getattr(failed_records[0], "reason", None) == "skew_exceeded"


# 13 — misconfig guard: if the backend is deployed without ADAPTER_SECRET
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
