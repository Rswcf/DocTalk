from __future__ import annotations

from datetime import date, datetime, timezone
from types import SimpleNamespace

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
    assert may_4_cohort["retention"][0] == {"week_offset": 0, "active_users": 2, "pct": 1.0}
    assert may_4_cohort["retention"][1] == {"week_offset": 1, "active_users": 1, "pct": 0.5}

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
