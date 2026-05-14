from __future__ import annotations

from datetime import datetime, timezone

from app.api import admin as admin_api


def test_admin_user_activity_route_is_registered() -> None:
    assert any(route.path == "/api/admin/user-activity" for route in admin_api.router.routes)
    assert "upgrade_nudge_shown" in admin_api.PAID_INTENT_EVENTS


def test_admin_activity_helpers_format_rates_and_deltas() -> None:
    assert admin_api._rate(3, 10) == 0.3
    assert admin_api._rate(1, 0) == 0.0
    assert admin_api._delta_payload(15, 10) == {
        "current": 15,
        "previous": 10,
        "delta": 5,
        "delta_percent": 50.0,
    }
    assert admin_api._delta_payload(15, 0)["delta_percent"] is None
    assert admin_api._date_label(datetime(2026, 5, 14, tzinfo=timezone.utc)) == "2026-05-14"
    assert admin_api._paid_signal_label("upgrade_nudge_shown") == "Upgrade reminder shown"
    assert "Non-blocking upgrade reminder" in admin_api._paid_signal_description(
        "upgrade_nudge_shown",
        "sustained_free_usage",
        "dashboard_upgrade_reminder",
        "plus",
    )


def test_activity_subquery_includes_feedback_as_activity_signal() -> None:
    query_text = str(admin_api._activity_subquery(datetime(2026, 5, 1, tzinfo=timezone.utc)))

    assert "usage_records" in query_text
    assert "messages" in query_text
    assert "documents" in query_text
    assert "product_events" in query_text
    assert "user_feedback" in query_text
