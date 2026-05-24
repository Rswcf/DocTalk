from __future__ import annotations

from datetime import date, datetime, timezone
from types import SimpleNamespace

from sqlalchemy.dialects import postgresql

from app.api import admin as admin_api


def _row(**kwargs):
    return SimpleNamespace(**kwargs)


def test_admin_retention_route_is_registered() -> None:
    route = next(route for route in admin_api.router.routes if route.path == "/api/admin/retention")

    assert route.methods == {"GET"}


def test_admin_retention_builds_cohorts_curves_segments_and_excludes_owner() -> None:
    now = datetime(2026, 6, 15, 12, tzinfo=timezone.utc)
    owner_id = "c142f3af-6e6b-488d-ba57-d91aa3e57cc7"
    users = [
        _row(id="u1", email="user1@example.com", created_at=datetime(2026, 5, 5, tzinfo=timezone.utc), plan="free"),
        _row(id="u2", email="user2@example.com", created_at=datetime(2026, 5, 6, tzinfo=timezone.utc), plan="plus"),
        _row(id="u3", email="user3@example.com", created_at=datetime(2026, 5, 12, tzinfo=timezone.utc), plan="pro"),
        _row(id=owner_id, email="owner@example.com", created_at=datetime(2026, 5, 5, tzinfo=timezone.utc), plan="pro"),
    ]
    activity_days = [
        _row(user_id="u1", activity_date=date(2026, 5, 5)),
        _row(user_id="u1", activity_date=date(2026, 5, 6)),
        _row(user_id="u1", activity_date=date(2026, 5, 12)),
        _row(user_id="u1", activity_date=date(2026, 6, 4)),
        _row(user_id="u2", activity_date=date(2026, 5, 6)),
        _row(user_id="u3", activity_date=date(2026, 5, 12)),
        _row(user_id="u3", activity_date=date(2026, 5, 20)),
        _row(user_id=owner_id, activity_date=date(2026, 5, 5)),
        _row(user_id=owner_id, activity_date=date(2026, 5, 6)),
        _row(user_id=owner_id, activity_date=date(2026, 5, 12)),
    ]
    document_segments = [
        _row(user_id="u1", max_page_count=20),
        _row(user_id="u2", max_page_count=100),
        _row(user_id="u3", max_page_count=170),
        _row(user_id=owner_id, max_page_count=250),
    ]
    locale_segments = [
        _row(user_id="u1", locale="en"),
        _row(user_id="u2", locale="zh"),
        _row(user_id="u3", locale="en"),
        _row(user_id=owner_id, locale="en"),
    ]

    payload = admin_api._build_retention_payload(
        now=now,
        users=users,
        activity_days=activity_days,
        document_segments=document_segments,
        locale_segments=locale_segments,
        excluded_user_ids={owner_id},
        admin_emails={"owner@example.com"},
    )

    assert len(payload["cohort_grid"]) == 12
    assert all(len(row["retention"]) == 12 for row in payload["cohort_grid"])

    may_4_cohort = next(row for row in payload["cohort_grid"] if row["cohort_week"] == "2026-05-04")
    assert may_4_cohort["cohort_size"] == 2
    assert may_4_cohort["retention"][0] == {
        "week_offset": 0,
        "active_users": 2,
        "pct": 1.0,
        "is_complete": True,
    }
    assert may_4_cohort["retention"][1] == {
        "week_offset": 1,
        "active_users": 1,
        "pct": 0.5,
        "is_complete": True,
    }

    current_cohort = next(row for row in payload["cohort_grid"] if row["cohort_week"] == "2026-06-15")
    assert current_cohort["retention"][0] == {
        "week_offset": 0,
        "active_users": None,
        "pct": None,
        "is_complete": False,
    }
    assert current_cohort["retention"][1] == {
        "week_offset": 1,
        "active_users": None,
        "pct": None,
        "is_complete": False,
    }

    curves = {row["key"]: row for row in payload["curves"]}
    assert curves["d1"]["activated_users"] == 3
    assert curves["d1"]["returned_users"] == 1
    assert curves["d1"]["pct"] == 0.3333
    assert curves["d7"]["returned_users"] == 1
    assert curves["d30"]["returned_users"] == 2

    plan_segments = {row["key"]: row for row in payload["by_segment"]["plan"]}
    assert plan_segments["free"]["retained_users"] == 1
    assert plan_segments["plus"]["retained_users"] == 0
    assert plan_segments["pro"]["retained_users"] == 1

    doc_segments = {row["key"]: row for row in payload["by_segment"]["doc_size"]}
    assert doc_segments["small"]["users"] == 1
    assert doc_segments["mid"]["users"] == 1
    assert doc_segments["large"]["users"] == 1

    assert payload["dau_wau_mau"]["mau"] == 2


def test_admin_retention_curves_only_count_matured_users_in_denominator() -> None:
    now = datetime(2026, 6, 15, 12, tzinfo=timezone.utc)
    users = [
        _row(id="u_old", email="old@example.com", created_at=datetime(2026, 5, 1, tzinfo=timezone.utc), plan="free"),
        _row(id="u_recent", email="recent@example.com", created_at=datetime(2026, 6, 10, tzinfo=timezone.utc), plan="free"),
        _row(id="u_today", email="today@example.com", created_at=datetime(2026, 6, 15, tzinfo=timezone.utc), plan="free"),
    ]
    activity_days = [
        _row(user_id="u_old", activity_date=date(2026, 5, 1)),
        _row(user_id="u_old", activity_date=date(2026, 5, 2)),
        _row(user_id="u_old", activity_date=date(2026, 5, 8)),
        _row(user_id="u_old", activity_date=date(2026, 5, 31)),
        _row(user_id="u_recent", activity_date=date(2026, 6, 10)),
        _row(user_id="u_recent", activity_date=date(2026, 6, 11)),
        _row(user_id="u_today", activity_date=date(2026, 6, 15)),
    ]

    payload = admin_api._build_retention_payload(
        now=now,
        users=users,
        activity_days=activity_days,
        document_segments=[],
        locale_segments=[],
        excluded_user_ids=set(),
        admin_emails=set(),
    )

    curves = {row["key"]: row for row in payload["curves"]}
    assert curves["d1"]["activated_users"] == 2
    assert curves["d1"]["returned_users"] == 2
    assert curves["d1"]["pct"] == 1.0
    assert curves["d7"]["activated_users"] == 1
    assert curves["d7"]["returned_users"] == 1
    assert curves["d7"]["pct"] == 1.0
    assert curves["d30"]["activated_users"] == 1
    assert curves["d30"]["returned_users"] == 1
    assert curves["d30"]["pct"] == 1.0


def test_admin_activity_day_expression_truncates_in_utc() -> None:
    expression = admin_api._utc_day_trunc(admin_api.Message.created_at)

    compiled = str(
        expression.compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )

    assert "date_trunc('day', messages.created_at AT TIME ZONE 'UTC')" in compiled
