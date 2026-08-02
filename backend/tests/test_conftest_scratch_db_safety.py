"""Tests for FIX2-E (Codex M2 r2 "new breakage" #2): conftest.py's scratch
test-database provisioning must refuse to run against a non-loopback host
(the exact scenario that would let an exported Railway/production
DATABASE_URL cause integration tests to provision and destructively
migrate a database on a REMOTE cluster).

Imports the helper directly from tests.conftest — `tests/` is a real
package (has __init__.py), so `from tests import conftest` works cleanly
without re-triggering pytest's special conftest-plugin loading.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from tests import conftest as conftest_module  # noqa: E402


class TestAssertSafeToProvision:
    @pytest.mark.parametrize(
        "url",
        [
            "postgresql+asyncpg://doctalk:doctalk@localhost:5432/doctalk_test",
            "postgresql+asyncpg://doctalk:doctalk@127.0.0.1:5432/doctalk_test",
            "postgresql+asyncpg://doctalk:doctalk@[::1]:5432/doctalk_test",
        ],
    )
    def test_loopback_hosts_are_allowed(self, url: str, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("DOCTALK_TEST_DATABASE_URL", raising=False)
        conftest_module._assert_safe_to_provision(url)  # must not raise

    @pytest.mark.parametrize(
        "url",
        [
            # Exactly the scenario that caused the shared-dev-DB incident:
            # an exported Railway/production-looking DATABASE_URL.
            "postgresql+asyncpg://doctalk:doctalk@containers-us-west-1.railway.app:5432/railway",
            "postgresql+asyncpg://doctalk:doctalk@my-prod-db.example.com:5432/doctalk_test",
            "postgresql+asyncpg://doctalk:doctalk@10.0.0.5:5432/doctalk_test",
        ],
    )
    def test_non_loopback_hosts_are_refused(self, url: str, monkeypatch: pytest.MonkeyPatch) -> None:
        """Codex r2 "new breakage" #2's required test: an exported
        remote-looking URL must make the suite refuse to provision, never
        silently create/migrate a database on that remote host."""
        monkeypatch.delenv("DOCTALK_TEST_DATABASE_URL", raising=False)
        with pytest.raises(RuntimeError, match="non-loopback host"):
            conftest_module._assert_safe_to_provision(url)

    def test_explicit_override_bypasses_the_check_even_for_a_remote_host(
        self, monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """DOCTALK_TEST_DATABASE_URL is the deliberate operator opt-in — a
        SEPARATE env var from DATABASE_URL, so it can never be set "by
        accident" the way DATABASE_URL itself was in the original incident."""
        monkeypatch.setenv("DOCTALK_TEST_DATABASE_URL", "postgresql+asyncpg://x:y@some-remote-host:5432/db")
        conftest_module._assert_safe_to_provision(
            "postgresql+asyncpg://doctalk:doctalk@containers-us-west-1.railway.app:5432/railway"
        )  # must not raise — operator explicitly opted in


class TestDeriveScratchTestDatabaseUrl:
    def test_forces_the_scratch_db_name_keeping_host_and_credentials(self) -> None:
        derived = conftest_module._derive_scratch_test_database_url(
            "postgresql+asyncpg://doctalk:doctalk@localhost:5432/doctalk"
        )
        assert derived == "postgresql+asyncpg://doctalk:doctalk@localhost:5432/doctalk_test"

    def test_forces_the_scratch_db_name_even_for_a_remote_host(self) -> None:
        """The derivation itself does NOT filter hosts — that's
        _assert_safe_to_provision's job, called separately at provision
        time. This test documents why the separate safety check exists:
        derivation alone would happily point doctalk_test at a remote host."""
        derived = conftest_module._derive_scratch_test_database_url(
            "postgresql+asyncpg://doctalk:doctalk@containers-us-west-1.railway.app:5432/railway"
        )
        assert derived == "postgresql+asyncpg://doctalk:doctalk@containers-us-west-1.railway.app:5432/doctalk_test"
