"""Read-only ops tool boundaries; no provider or database access."""

import importlib.util
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location(
    "refund_ops_cli", Path(__file__).parents[1] / "scripts/refund_ops.py"
)
ops = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ops)


@pytest.mark.parametrize(
    "mode,key", [("live", "sk_test_example"), ("test", "sk_live_example"), ("live", "")]
)
def test_reject_wrong_mode(mode, key):
    with pytest.raises(ValueError):
        ops.validate_identity(mode, "acct_example", key)


def test_explicit_account_and_admin_required(monkeypatch):
    monkeypatch.delenv("DOCTALK_REFUND_OPS_ADMIN", raising=False)
    with pytest.raises(ValueError, match="secure_admin"):
        ops.main(["--mode", "test", "--account", "acct_example"])
    with pytest.raises(ValueError, match="invalid_expected"):
        ops.validate_identity("test", "*", "sk_test_example")


def test_bounded_output_and_no_mutation_arguments():
    for args in [["--limit", "101"], ["--refund"], ["--cancel"], ["--repair"]]:
        with pytest.raises(SystemExit):
            ops.parser().parse_args(
                ["--mode", "test", "--account", "acct_example", *args]
            )


def test_account_mismatch_stops_before_database(monkeypatch):
    import sys
    from types import SimpleNamespace

    monkeypatch.setenv("DOCTALK_REFUND_OPS_ADMIN", "1")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_example")
    calls = []
    fake = SimpleNamespace(
        RequestsClient=lambda **kw: None,
        StripeClient=lambda *a, **kw: SimpleNamespace(
            v1=SimpleNamespace(
                accounts=SimpleNamespace(
                    retrieve_current=lambda: SimpleNamespace(id="acct_wrong")
                )
            )
        ),
    )
    monkeypatch.setitem(sys.modules, "stripe", fake)
    monkeypatch.setattr(ops, "queue_snapshot", lambda *a: calls.append(a))
    with pytest.raises(ValueError, match="stripe_account_mismatch"):
        ops.main(["--mode", "test", "--account", "acct_expected"])
    assert calls == []


def test_success_uses_shared_snapshot_without_secret_output(monkeypatch, capsys):
    import json
    import sys
    from types import SimpleNamespace

    monkeypatch.setenv("DOCTALK_REFUND_OPS_ADMIN", "1")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_secret")
    monkeypatch.setenv("DATABASE_URL", "postgresql://private")
    fake = SimpleNamespace(
        RequestsClient=lambda **kw: None,
        StripeClient=lambda *a, **kw: SimpleNamespace(
            v1=SimpleNamespace(
                accounts=SimpleNamespace(
                    retrieve_current=lambda: SimpleNamespace(id="acct_expected")
                )
            )
        ),
    )
    monkeypatch.setitem(sys.modules, "stripe", fake)

    async def snapshot(url, limit):
        assert url == "postgresql://private"
        assert limit == 7
        return {"status_counts": {}, "attention_queue": []}

    monkeypatch.setattr(ops, "queue_snapshot", snapshot)
    ops.main(["--mode", "test", "--account", "acct_expected", "--limit", "7"])
    raw = capsys.readouterr().out
    assert "sk_test_secret" not in raw and "postgresql" not in raw
    assert json.loads(raw)["financial_writes"] is False


def test_bootstrap_ignores_malicious_dotenv_preserves_process_env(
    tmp_path, monkeypatch
):
    import sys
    from types import ModuleType

    from pydantic_settings import BaseSettings, SettingsConfigDict
    from pydantic_settings.sources import DotEnvSettingsSource

    malicious = tmp_path / ".env"
    malicious.write_text("DATABASE_URL=postgresql://evil\nOPS_FILE_ONLY=evil\n")
    monkeypatch.setenv("DATABASE_URL", "postgresql://explicit")
    monkeypatch.delenv("OPS_FILE_ONLY", raising=False)

    class Probe(BaseSettings):
        model_config = SettingsConfigDict(env_file=str(malicious), extra="ignore")
        DATABASE_URL: str
        OPS_FILE_ONLY: str = "absent"

    original_call = DotEnvSettingsSource.__call__
    fake = ModuleType("app.services.refund_ops_service")

    # Exercise lazy module import while the bootstrap patch is active.
    def lazy(name):
        if name != "get_refund_operations_status":
            raise AttributeError(name)
        probe = Probe()
        assert probe.DATABASE_URL == "postgresql://explicit"
        assert probe.OPS_FILE_ONLY == "absent"
        return "shared_helper"

    fake.__getattr__ = lazy
    monkeypatch.setitem(sys.modules, "app.services.refund_ops_service", fake)
    assert ops.import_ops_helper() == "shared_helper"
    assert DotEnvSettingsSource.__call__ is original_call
    assert Probe().OPS_FILE_ONLY == "evil"  # Patch did not change global behavior.
