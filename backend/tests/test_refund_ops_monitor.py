from contextlib import contextmanager
from unittest.mock import Mock

import pytest

from app.services.refund_ops_service import _queries


@pytest.mark.parametrize("limit", [0, 101, True, "1"])
def test_refund_queue_limit_must_be_bounded_integer(limit):
    with pytest.raises(ValueError):
        _queries(limit, None)


@pytest.mark.parametrize("status,count,orphan", [("ok", 0, 0), ("attention", 1, 0), ("attention", 0, 1)])
def test_monitor_alerts_only_aggregate_financial_exceptions(monkeypatch, status, count, orphan):
    from app.workers import ops_monitor as monitor
    db = Mock()

    @contextmanager
    def session():
        yield db

    monkeypatch.setattr(monitor, "SyncSessionLocal", session)
    probe = Mock(return_value={"status": status, "attention_count": count, "orphan_reserved_users": orphan})
    alert = Mock()
    monkeypatch.setattr(monitor, "get_refund_operations_status_sync", probe)
    monkeypatch.setattr(monitor.sentry_sdk, "capture_message", alert)
    assert monitor.check_refund_operations.run() == status
    assert "READ ONLY" in str(db.execute.call_args_list[0].args[0])
    assert alert.call_count == (status == "attention")
    if alert.called:
        assert alert.call_args.args == ("Refund operations require admin review",)
