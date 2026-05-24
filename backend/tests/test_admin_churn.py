from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

from app.api import admin as admin_api


def _row(**kwargs):
    return SimpleNamespace(**kwargs)


def test_admin_churn_route_is_registered() -> None:
    route = next(route for route in admin_api.router.routes if route.path == "/api/admin/churn")

    assert route.methods == {"GET"}


def test_admin_churn_builds_signal_prevalence_reason_buckets_and_excludes_owner() -> None:
    now = datetime(2026, 6, 15, 12, tzinfo=timezone.utc)
    owner_id = "c142f3af-6e6b-488d-ba57-d91aa3e57cc7"
    users = [
        _row(id="u1", email="u1@example.com", created_at=datetime(2026, 5, 1, tzinfo=timezone.utc), plan="free"),
        _row(id="u2", email="u2@example.com", created_at=datetime(2026, 5, 1, tzinfo=timezone.utc), plan="free"),
        _row(id="u3", email="u3@example.com", created_at=datetime(2026, 5, 1, tzinfo=timezone.utc), plan="plus"),
        _row(id="u4", email="u4@example.com", created_at=datetime(2026, 5, 1, tzinfo=timezone.utc), plan="pro"),
        _row(id="u5", email="u5@example.com", created_at=datetime(2026, 5, 1, tzinfo=timezone.utc), plan="free"),
        _row(id="u6", email="u6@example.com", created_at=datetime(2026, 5, 1, tzinfo=timezone.utc), plan="free"),
        _row(id=owner_id, email="owner@example.com", created_at=datetime(2026, 5, 1, tzinfo=timezone.utc), plan="pro"),
    ]
    activity_days = [
        _row(user_id="u1", activity_date=date(2026, 5, 1)),
        _row(user_id="u2", activity_date=date(2026, 5, 1)),
        _row(user_id="u2", activity_date=date(2026, 5, 2)),
        _row(user_id="u3", activity_date=date(2026, 5, 1)),
        _row(user_id="u3", activity_date=date(2026, 5, 15)),
        _row(user_id="u4", activity_date=date(2026, 5, 1)),
        _row(user_id="u4", activity_date=date(2026, 6, 10)),
        _row(user_id="u5", activity_date=date(2026, 5, 1)),
        _row(user_id="u5", activity_date=date(2026, 5, 2)),
        _row(user_id="u6", activity_date=date(2026, 5, 1)),
        _row(user_id="u6", activity_date=date(2026, 5, 3)),
        _row(user_id=owner_id, activity_date=date(2026, 5, 1)),
    ]
    signal_users = {
        "asst_zero": {"u1", owner_id},
        "rag_miss": {"u2"},
        "parse_failure": {"u5", owner_id},
        "large_doc": {"u5"},
        "export_refusal": {"u3"},
        "paywall_hit": {owner_id},
        "page_fail": {"u2"},
        "capability_refusal": set(),
    }
    last_actions = [
        _row(user_id="u1", category="asst_zero"),
        _row(user_id="u2", category="rag_miss"),
        _row(user_id="u3", category="upload"),
        _row(user_id="u4", category="normal_answer"),
        _row(user_id="u5", category="upload"),
        _row(user_id=owner_id, category="paywall"),
    ]
    feedback_rows = [
        _row(
            id="fb1",
            user_id="u2",
            type="answer_quality",
            area="chat_answer",
            severity="high",
            message="Citation was not in the document.",
            plan="free",
            created_at=datetime(2026, 5, 3, tzinfo=timezone.utc),
        ),
        _row(
            id="fb-owner",
            user_id=owner_id,
            type="bug",
            area="upload_parse",
            severity="blocking",
            message="Owner-only feedback should be excluded.",
            plan="pro",
            created_at=datetime(2026, 5, 4, tzinfo=timezone.utc),
        ),
    ]
    cancel_rows = [
        _row(
            id="pt1",
            user_id="u3",
            from_plan="plus",
            to_plan="free",
            reason="missing_export",
            feedback="Needed CSV export.",
            created_at=datetime(2026, 5, 16, tzinfo=timezone.utc),
        )
    ]

    payload = admin_api._build_churn_payload(
        now=now,
        users=users,
        activity_days=activity_days,
        signal_users=signal_users,
        last_actions=last_actions,
        feedback_rows=feedback_rows,
        cancel_rows=cancel_rows,
        inactive_days=14,
        excluded_user_ids={owner_id},
        admin_emails={"owner@example.com"},
    )

    assert payload["one_and_done"] == {"activated_users": 6, "count": 1, "pct": 0.1667}

    signals = {row["key"]: row for row in payload["churn_signals"]}
    assert signals["asst_zero"]["count"] == 1
    assert signals["asst_zero"]["pct"] == 0.2
    assert signals["rag_miss"]["count"] == 1
    assert signals["parse_failure"]["count"] == 1
    assert signals["large_doc"]["count"] == 1
    assert signals["export_refusal"]["count"] == 1
    assert signals["paywall_hit"]["count"] == 0

    buckets = {row["key"]: row for row in payload["reason_buckets"]}
    assert buckets["one_off_success"]["count"] == 1
    assert buckets["page_fail"]["count"] == 1
    assert buckets["export"]["count"] == 1
    assert buckets["parse"]["count"] == 1
    assert buckets["uncategorized"]["count"] == 1
    assert sum(row["count"] for row in buckets.values()) == payload["churned_users"]
    assert sum(row["pct"] for row in buckets.values()) == 1.0

    feedback = payload["feedback"]
    assert feedback["recent"][0]["id"] == "fb1"
    assert feedback["by_area"] == [{"key": "chat_answer", "count": 1}]
    assert feedback["by_severity"] == [{"key": "high", "count": 1}]

    assert payload["cancel_reasons"][0]["reason"] == "missing_export"
    assert "user_id" not in payload["cancel_reasons"][0]
    last_action = {row["key"]: row for row in payload["last_action"]}
    assert last_action["asst_zero"]["count"] == 1
    assert last_action["rag_miss"]["count"] == 1
    assert "paywall" not in last_action


def test_admin_churn_message_signals_are_paired_by_session_and_response() -> None:
    base = datetime(2026, 5, 1, 12, tzinfo=timezone.utc)
    message_rows = [
        _row(
            user_id="u_export_refused",
            session_id="s-export-refused",
            role="user",
            content="Export this chat to csv",
            citations=None,
            metadata_json={},
            created_at=base,
        ),
        _row(
            user_id="u_export_refused",
            session_id="s-unrelated-artifact",
            role="assistant",
            content="Here is an unrelated file.",
            citations=[],
            metadata_json={"artifact_count": 1},
            created_at=base + timedelta(minutes=1),
        ),
        _row(
            user_id="u_export_success",
            session_id="s-export-success",
            role="user",
            content="download an xlsx",
            citations=None,
            metadata_json={},
            created_at=base + timedelta(minutes=2),
        ),
        _row(
            user_id="u_export_success",
            session_id="s-export-success",
            role="assistant",
            content="Created it.",
            citations=[],
            metadata_json={"artifact_count": 1},
            created_at=base + timedelta(minutes=3),
        ),
        _row(
            user_id="u_page_not_failed",
            session_id="s-page-ok",
            role="user",
            content="What is on page 3?",
            citations=None,
            metadata_json={},
            created_at=base + timedelta(minutes=4),
        ),
        _row(
            user_id="u_page_not_failed",
            session_id="s-page-ok",
            role="assistant",
            content="Page 3 explains renewal terms.",
            citations=[{"page": 3}],
            metadata_json={},
            created_at=base + timedelta(minutes=5),
        ),
        _row(
            user_id="u_page_not_failed",
            session_id="s-page-ok",
            role="assistant",
            content="I can't find that unrelated later question.",
            citations=[],
            metadata_json={},
            created_at=base + timedelta(minutes=6),
        ),
        _row(
            user_id="u_page_failed",
            session_id="s-page-fail",
            role="user",
            content="Show page 9",
            citations=None,
            metadata_json={},
            created_at=base + timedelta(minutes=7),
        ),
        _row(
            user_id="u_page_failed",
            session_id="s-page-fail",
            role="assistant",
            content="I can't find that page in the document.",
            citations=[],
            metadata_json={},
            created_at=base + timedelta(minutes=8),
        ),
    ]

    signal_users, final_candidates = admin_api._derive_message_diagnostics(
        message_rows,
        asst_zero_session_ids=set(),
    )

    assert "u_export_refused" in signal_users["export_refusal"]
    assert "u_export_success" not in signal_users["export_refusal"]
    assert "u_page_not_failed" in signal_users["rag_miss"]
    assert "u_page_not_failed" not in signal_users["page_fail"]
    assert "u_page_failed" in signal_users["page_fail"]
    assert final_candidates["u_page_failed"][1] == "rag_miss"
