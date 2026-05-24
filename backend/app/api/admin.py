"""Admin analytics endpoints — protected by require_admin."""

from __future__ import annotations

import asyncio
import re
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any

import stripe
from fastapi import APIRouter, Depends, Query
from sqlalchemy import String, case, cast, func, or_, select, text, union_all
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cache_get, cache_set
from app.core.config import settings
from app.core.deps import get_db_session, require_admin
from app.models.tables import (
    ChatSession,
    CreditLedger,
    Document,
    Message,
    PlanTransition,
    ProductEvent,
    UsageRecord,
    User,
    UserFeedback,
)
from app.schemas.admin import (
    AdminBreakdownsResponse,
    AdminChurnResponse,
    AdminOverviewResponse,
    AdminRecentUsersResponse,
    AdminRetentionResponse,
    AdminTopUsersResponse,
    AdminTrendsResponse,
    AdminUserActivityResponse,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])

PAID_INTENT_EVENTS = [
    "upgrade_nudge_shown",
    "paywall_opened",
    "limit_hit",
    "billing_view",
    "upgrade_click",
    "checkout_created",
    "checkout_completed",
    "subscription_cancel_requested",
    "refund_requested",
]


PAID_SIGNAL_LABELS = {
    "upgrade_nudge_shown": "Upgrade reminder shown",
    "paywall_opened": "Paywall shown",
    "limit_hit": "User hit a plan limit",
    "billing_view": "Billing page viewed",
    "upgrade_click": "Upgrade clicked",
    "checkout_created": "Checkout started",
    "checkout_completed": "Checkout completed",
    "subscription_cancel_requested": "Cancellation requested",
    "refund_requested": "Refund review requested",
}

PAID_REASON_LABELS = {
    "sustained_free_usage": "User has repeated free usage",
    "activated_free_user": "Early free-user reminder",
    "file_size": "Uploaded file was too large",
    "upload_limit": "Document upload limit reached",
    "url_limit": "URL import limit reached",
    "collection_limit": "Collection limit reached",
    "collection_doc_limit": "Collection document limit reached",
    "session_limit": "Chat session limit reached",
    "insufficient_credits": "Not enough credits",
    "mode_not_allowed": "Selected mode requires upgrade",
    "balanced_mode": "Pro analysis mode selected",
    "quick_mode": "Flash mode selected",
}

PAID_SOURCE_LABELS = {
    "dashboard_upgrade_reminder": "Dashboard upgrade reminder",
    "dashboard_activation_nudge": "Dashboard upgrade reminder",
    "dashboard_upload": "Dashboard upload",
    "dashboard_upload_precheck": "Dashboard upload pre-check",
    "dashboard_url": "Dashboard URL import",
    "chat_stream": "Chat response",
    "paywall_modal": "Paywall modal",
    "mode_selector": "Mode selector",
    "session_dropdown": "Chat session menu",
    "create_collection_modal": "Create collection modal",
    "collection_add_documents_modal": "Add documents to collection",
    "document_diff": "Document comparison",
    "question_templates": "Question templates",
    "extraction_panel": "Structured extraction",
    "tables_panel": "Table tools",
    "profile_credits": "Profile credits panel",
    "pricing": "Pricing page",
    "pricing_hero": "Pricing page hero",
}

INTERNAL_OWNER_USER_IDS = {"c142f3af-6e6b-488d-ba57-d91aa3e57cc7"}
RETENTION_WEEKS = 12
RETENTION_OFFSETS = 12
RETENTION_DAYS = (1, 7, 30)
RETENTION_LOOKBACK_DAYS = 395
CHURN_LOOKBACK_DAYS = 395
CHURN_SIGNAL_KEYS = (
    "asst_zero",
    "rag_miss",
    "parse_failure",
    "large_doc",
    "export_refusal",
    "paywall_hit",
)
CHURN_SIGNAL_LABELS = {
    "asst_zero": "Assistant zero-response session",
    "rag_miss": "Retrieval or coverage miss",
    "parse_failure": "Parse/OCR failure",
    "large_doc": "Large document uploaded",
    "export_refusal": "Export requested without artifact",
    "paywall_hit": "Paywall or plan limit hit",
}
REASON_BUCKET_LABELS = {
    "coverage_fail": "Coverage failed",
    "page_fail": "Page lookup failed",
    "export": "Export blocked",
    "parse": "Parse failure",
    "capability_refusal": "Capability refusal",
    "one_off_success": "One-off success",
}
EXPORT_REQUEST_RE = re.compile(r"\b(export|download|csv|excel|xlsx)\b|导出|下载|表格文件", re.IGNORECASE)
PAGE_REQUEST_RE = re.compile(r"\b(page|p\.\s*\d+|page\s+\d+)\b|第\s*\d+\s*页|页面", re.IGNORECASE)
RAG_MISS_RE = re.compile(
    r"can't find|cannot find|could not find|not found|no relevant|not in (?:the )?document|"
    r"无法找到|找不到|未找到|找不到相关|見つ|찾을 수|no encontr|nicht gefunden|introuv",
    re.IGNORECASE,
)
CAPABILITY_REFUSAL_RE = re.compile(
    r"\b(can't|cannot|unable to|not able to|not supported|do not support)\b|无法|不能|不支持",
    re.IGNORECASE,
)


def _humanize_code(value: str | None) -> str | None:
    if not value:
        return None
    text_value = str(value).replace("_", " ").replace("-", " ").strip()
    if not text_value:
        return None
    return text_value[:1].upper() + text_value[1:]


def _paid_signal_label(event_name: str | None) -> str:
    return PAID_SIGNAL_LABELS.get(str(event_name or ""), _humanize_code(event_name) or "Paid signal")


def _paid_signal_description(
    event_name: str | None,
    reason: str | None,
    source: str | None,
    plan: str | None,
) -> str:
    source_label = PAID_SOURCE_LABELS.get(str(source or ""), _humanize_code(source))
    reason_label = PAID_REASON_LABELS.get(str(reason or "").lower(), _humanize_code(reason))
    pieces: list[str] = []
    if event_name == "upgrade_nudge_shown":
        pieces.append("Non-blocking upgrade reminder.")
    elif event_name == "paywall_opened":
        pieces.append("A blocking upgrade prompt was shown.")
    elif event_name == "limit_hit":
        pieces.append("The user tried something their current plan does not allow.")
    if reason_label:
        pieces.append(f"Reason: {reason_label}.")
    if source_label:
        pieces.append(f"Surface: {source_label}.")
    if plan:
        pieces.append(f"Target plan: {str(plan).upper()}.")
    return " ".join(pieces) or _paid_signal_label(event_name)


def _paid_intent_payload(row: Any) -> dict[str, Any]:
    event_name = str(row.event_name or "")
    return {
        "event_name": event_name,
        "reason": row.reason,
        "source": row.source,
        "plan": row.plan,
        "label": _paid_signal_label(event_name),
        "description": _paid_signal_description(event_name, row.reason, row.source, row.plan),
        "events": int(row.events or 0),
        "users": int(row.users or 0),
    }


def _rate(numerator: int | float, denominator: int | float) -> float:
    return round(float(numerator) / float(denominator), 4) if denominator else 0.0


def _delta_payload(current: int | float, previous: int | float) -> dict[str, int | float | None]:
    delta = current - previous
    return {
        "current": current,
        "previous": previous,
        "delta": delta,
        "delta_percent": round((delta / previous) * 100, 1) if previous else None,
    }


def _date_label(value: Any) -> str:
    if hasattr(value, "date"):
        return str(value.date())
    return str(value)[:10]


def _row_value(row: Any, key: str, default: Any = None) -> Any:
    if isinstance(row, dict):
        return row.get(key, default)
    return getattr(row, key, default)


def _as_date(value: Any) -> date:
    if isinstance(value, datetime):
        return value.date()
    if hasattr(value, "year") and hasattr(value, "month") and hasattr(value, "day"):
        return value
    return datetime.fromisoformat(str(value)[:10]).date()


def _week_start(value: Any) -> date:
    day = _as_date(value)
    return day - timedelta(days=day.weekday())


def _admin_excluded_emails(admin_emails: set[str] | None = None) -> set[str]:
    if admin_emails is not None:
        return {email.strip().lower() for email in admin_emails if email and email.strip()}
    return {email.strip().lower() for email in settings.ADMIN_EMAILS.split(",") if email.strip()}


def _default_excluded_user_ids(excluded_user_ids: set[str] | None = None) -> set[str]:
    if excluded_user_ids is not None:
        return {str(user_id) for user_id in excluded_user_ids if user_id}
    return set(INTERNAL_OWNER_USER_IDS)


def _eligible_user_conditions() -> list[Any]:
    conditions: list[Any] = []
    excluded_emails = _admin_excluded_emails()
    if excluded_emails:
        conditions.append(~func.lower(User.email).in_(excluded_emails))
    if INTERNAL_OWNER_USER_IDS:
        conditions.append(~cast(User.id, String).in_(INTERNAL_OWNER_USER_IDS))
    return conditions


def _is_excluded_user(row: Any, excluded_user_ids: set[str], admin_emails: set[str]) -> bool:
    user_id = _row_value(row, "id", _row_value(row, "user_id"))
    email = _row_value(row, "email")
    return str(user_id) in excluded_user_ids or (isinstance(email, str) and email.lower() in admin_emails)


def _eligible_user_map(
    users: list[Any],
    excluded_user_ids: set[str] | None = None,
    admin_emails: set[str] | None = None,
) -> dict[str, Any]:
    excluded_ids = _default_excluded_user_ids(excluded_user_ids)
    excluded_emails = _admin_excluded_emails(admin_emails)
    return {
        str(_row_value(user, "id")): user
        for user in users
        if _row_value(user, "id") is not None
        and not _is_excluded_user(user, excluded_ids, excluded_emails)
    }


def _doc_size_bucket(page_count: Any) -> str:
    if page_count is None:
        return "unknown"
    pages = int(page_count or 0)
    if pages >= 150:
        return "large"
    if pages >= 40:
        return "mid"
    return "small"


def _doc_size_label(bucket: str) -> str:
    return {
        "small": "Small (<40p)",
        "mid": "Mid (40-150p)",
        "large": "Large (>=150p)",
        "unknown": "Unknown",
    }.get(bucket, _humanize_code(bucket) or bucket)


def _segment_payload(
    values_by_user: dict[str, str],
    active_users: set[str],
    retained_users: set[str],
    *,
    labeler: Any = _humanize_code,
    limit: int | None = None,
    order: list[str] | None = None,
) -> list[dict[str, Any]]:
    buckets: dict[str, set[str]] = defaultdict(set)
    for user_id in active_users:
        buckets[values_by_user.get(user_id, "unknown") or "unknown"].add(user_id)
    keys = list(buckets)
    if order:
        order_map = {key: index for index, key in enumerate(order)}
        keys.sort(key=lambda key: (order_map.get(key, len(order_map)), key))
    else:
        keys.sort(key=lambda key: (-len(buckets[key]), key))
    if limit is not None:
        keys = keys[:limit]
    return [
        {
            "key": key,
            "label": labeler(key) or key,
            "users": len(buckets[key]),
            "retained_users": len(buckets[key] & retained_users),
            "pct": _rate(len(buckets[key] & retained_users), len(buckets[key])),
        }
        for key in keys
    ]


def _activity_dates_by_user(activity_days: list[Any], eligible_users: set[str]) -> dict[str, set[date]]:
    active: dict[str, set[date]] = defaultdict(set)
    for row in activity_days:
        user_id = str(_row_value(row, "user_id"))
        if user_id in eligible_users:
            active[user_id].add(_as_date(_row_value(row, "activity_date")))
    return active


def _build_retention_payload(
    *,
    now: datetime,
    users: list[Any],
    activity_days: list[Any],
    document_segments: list[Any],
    locale_segments: list[Any],
    excluded_user_ids: set[str] | None = None,
    admin_emails: set[str] | None = None,
) -> dict[str, Any]:
    eligible_users = _eligible_user_map(users, excluded_user_ids, admin_emails)
    eligible_user_ids = set(eligible_users)
    active_dates_by_user = _activity_dates_by_user(activity_days, eligible_user_ids)
    activated_user_ids = {user_id for user_id, dates in active_dates_by_user.items() if dates}
    retained_user_ids = {user_id for user_id, dates in active_dates_by_user.items() if len(dates) >= 2}

    current_week = _week_start(now)
    cohort_weeks = [
        current_week - timedelta(weeks=RETENTION_WEEKS - 1 - index)
        for index in range(RETENTION_WEEKS)
    ]
    cohort_users: dict[date, set[str]] = {week: set() for week in cohort_weeks}
    for user_id, user in eligible_users.items():
        cohort_week = _week_start(_row_value(user, "created_at"))
        if cohort_week in cohort_users:
            cohort_users[cohort_week].add(user_id)

    active_weeks_by_user = {
        user_id: {_week_start(active_date) for active_date in active_dates}
        for user_id, active_dates in active_dates_by_user.items()
    }
    cohort_grid = []
    for cohort_week in cohort_weeks:
        users_in_cohort = cohort_users[cohort_week]
        retention = []
        for week_offset in range(RETENTION_OFFSETS):
            target_week = cohort_week + timedelta(weeks=week_offset)
            active_users = {
                user_id
                for user_id in users_in_cohort
                if target_week in active_weeks_by_user.get(user_id, set())
            }
            retention.append({
                "week_offset": week_offset,
                "active_users": len(active_users),
                "pct": _rate(len(active_users), len(users_in_cohort)),
            })
        cohort_grid.append({
            "cohort_week": cohort_week.isoformat(),
            "cohort_size": len(users_in_cohort),
            "retention": retention,
        })

    curves = []
    for days in RETENTION_DAYS:
        returned_users = 0
        for active_dates in active_dates_by_user.values():
            if not active_dates:
                continue
            first_active = min(active_dates)
            if any(first_active < active_date <= first_active + timedelta(days=days) for active_date in active_dates):
                returned_users += 1
        curves.append({
            "key": f"d{days}",
            "label": f"D{days}",
            "days": days,
            "activated_users": len(activated_user_ids),
            "returned_users": returned_users,
            "pct": _rate(returned_users, len(activated_user_ids)),
        })

    today = now.date()
    dau_series = []
    for offset in range(29, -1, -1):
        day = today - timedelta(days=offset)
        dau = sum(1 for dates in active_dates_by_user.values() if day in dates)
        dau_series.append({"date": day.isoformat(), "dau": dau})
    wau_start = today - timedelta(days=6)
    mau_start = today - timedelta(days=29)
    wau_users = {
        user_id
        for user_id, dates in active_dates_by_user.items()
        if any(wau_start <= active_date <= today for active_date in dates)
    }
    mau_users = {
        user_id
        for user_id, dates in active_dates_by_user.items()
        if any(mau_start <= active_date <= today for active_date in dates)
    }
    dau_wau_mau = {
        "series": dau_series,
        "wau": len(wau_users),
        "mau": len(mau_users),
        "stickiness": _rate(dau_series[-1]["dau"] if dau_series else 0, len(mau_users)),
    }

    plan_by_user = {
        user_id: str(_row_value(user, "plan") or "free")
        for user_id, user in eligible_users.items()
    }
    doc_by_user = {
        str(_row_value(row, "user_id")): _doc_size_bucket(_row_value(row, "max_page_count"))
        for row in document_segments
        if str(_row_value(row, "user_id")) in eligible_user_ids
    }
    locale_by_user = {
        str(_row_value(row, "user_id")): str(_row_value(row, "locale") or "unknown")
        for row in locale_segments
        if str(_row_value(row, "user_id")) in eligible_user_ids
    }
    by_segment = {
        "plan": _segment_payload(
            plan_by_user,
            activated_user_ids,
            retained_user_ids,
            labeler=lambda key: key.upper() if key in {"pro"} else key.capitalize(),
            order=["free", "plus", "pro", "unknown"],
        ),
        "doc_size": _segment_payload(
            doc_by_user,
            activated_user_ids,
            retained_user_ids,
            labeler=_doc_size_label,
            order=["small", "mid", "large", "unknown"],
        ),
        "locale": _segment_payload(locale_by_user, activated_user_ids, retained_user_ids, limit=6),
    }

    first_active_week = {
        user_id: _week_start(min(active_dates))
        for user_id, active_dates in active_dates_by_user.items()
        if active_dates
    }
    activity_by_week: dict[date, set[str]] = {week: set() for week in cohort_weeks}
    for user_id, active_weeks in active_weeks_by_user.items():
        for active_week in active_weeks:
            if active_week in activity_by_week:
                activity_by_week[active_week].add(user_id)
    weekly_flow = []
    for week in cohort_weeks:
        active_this_week = activity_by_week.get(week, set())
        active_previous_week = activity_by_week.get(week - timedelta(weeks=1), set())
        new_users = {user_id for user_id in active_this_week if first_active_week.get(user_id) == week}
        retained = {
            user_id
            for user_id in active_this_week & active_previous_week
            if first_active_week.get(user_id) != week
        }
        resurrected = {
            user_id
            for user_id in active_this_week - active_previous_week - new_users
            if first_active_week.get(user_id) != week
        }
        weekly_flow.append({
            "week": week.isoformat(),
            "new": len(new_users),
            "retained": len(retained),
            "resurrected": len(resurrected),
            "churned": len(active_previous_week - active_this_week),
        })

    return {
        "generated_at": now.isoformat(),
        "cohort_grid": cohort_grid,
        "curves": curves,
        "dau_wau_mau": dau_wau_mau,
        "by_segment": by_segment,
        "weekly_flow": weekly_flow,
    }


def _normalized_action_label(key: str) -> str:
    labels = {
        "asst_zero": "Assistant zero-response",
        "rag_miss": "RAG miss",
        "normal_answer": "Normal answer",
        "normal-answer": "Normal answer",
        "paywall": "Paywall or plan limit",
        "upload": "Upload",
        "user_message": "User message",
        "unknown": "Unknown",
    }
    return labels.get(key, _humanize_code(key) or key)


def _coerce_user_set(values: Any, eligible_user_ids: set[str]) -> set[str]:
    if values is None:
        return set()
    return {str(value) for value in values if str(value) in eligible_user_ids}


def _serialize_feedback(row: Any) -> dict[str, Any]:
    created_at = _row_value(row, "created_at")
    message = _row_value(row, "message")
    return {
        "id": str(_row_value(row, "id")),
        "type": str(_row_value(row, "type") or "unknown"),
        "area": str(_row_value(row, "area") or "unknown"),
        "severity": str(_row_value(row, "severity") or "unknown"),
        "message": str(message) if message else None,
        "plan": _row_value(row, "plan"),
        "created_at": created_at.isoformat() if hasattr(created_at, "isoformat") else None,
    }


def _group_count(rows: list[Any], key: str) -> list[dict[str, Any]]:
    counts = Counter(str(_row_value(row, key) or "unknown") for row in rows)
    return [
        {"key": value, "count": count}
        for value, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    ]


def _serialize_cancel_reason(row: Any) -> dict[str, Any]:
    created_at = _row_value(row, "created_at")
    metadata = _row_value(row, "metadata_json") or {}
    reason = _row_value(row, "reason")
    feedback = _row_value(row, "feedback")
    if not reason and isinstance(metadata, dict):
        reason = metadata.get("cancel_reason") or metadata.get("reason")
    if not feedback and isinstance(metadata, dict):
        feedback = metadata.get("cancel_feedback") or metadata.get("feedback")
    return {
        "id": str(_row_value(row, "id")),
        "user_id": str(_row_value(row, "user_id")),
        "from_plan": str(_row_value(row, "from_plan") or ""),
        "to_plan": str(_row_value(row, "to_plan") or ""),
        "reason": str(reason) if reason else None,
        "feedback": str(feedback) if feedback else None,
        "created_at": created_at.isoformat() if hasattr(created_at, "isoformat") else None,
    }


def _build_churn_payload(
    *,
    now: datetime,
    users: list[Any],
    activity_days: list[Any],
    signal_users: dict[str, set[str]],
    last_actions: list[Any],
    feedback_rows: list[Any],
    cancel_rows: list[Any],
    inactive_days: int = 14,
    excluded_user_ids: set[str] | None = None,
    admin_emails: set[str] | None = None,
) -> dict[str, Any]:
    eligible_users = _eligible_user_map(users, excluded_user_ids, admin_emails)
    eligible_user_ids = set(eligible_users)
    active_dates_by_user = _activity_dates_by_user(activity_days, eligible_user_ids)
    activated_user_ids = {user_id for user_id, dates in active_dates_by_user.items() if dates}
    inactive_cutoff = (now - timedelta(days=inactive_days)).date()
    churned_user_ids = {
        user_id
        for user_id, dates in active_dates_by_user.items()
        if dates and max(dates) < inactive_cutoff
    }
    one_and_done_user_ids = {
        user_id for user_id, dates in active_dates_by_user.items() if len(dates) == 1
    }

    one_and_done = {
        "activated_users": len(activated_user_ids),
        "count": len(one_and_done_user_ids),
        "pct": _rate(len(one_and_done_user_ids), len(activated_user_ids)),
    }
    normalized_signals = {
        key: _coerce_user_set(value, eligible_user_ids)
        for key, value in signal_users.items()
    }
    churn_signals = []
    for key in CHURN_SIGNAL_KEYS:
        users_with_signal = normalized_signals.get(key, set()) & churned_user_ids
        churn_signals.append({
            "key": key,
            "label": CHURN_SIGNAL_LABELS[key],
            "count": len(users_with_signal),
            "pct": _rate(len(users_with_signal), len(churned_user_ids)),
        })

    last_action_counts: Counter[str] = Counter()
    for row in last_actions:
        user_id = str(_row_value(row, "user_id"))
        if user_id not in churned_user_ids:
            continue
        category = str(_row_value(row, "category") or "unknown").replace("-", "_")
        last_action_counts[category] += 1
    last_action = [
        {
            "key": key,
            "label": _normalized_action_label(key),
            "count": count,
            "pct": _rate(count, len(churned_user_ids)),
        }
        for key, count in sorted(last_action_counts.items(), key=lambda item: (-item[1], item[0]))
    ]

    eligible_feedback = [
        row for row in feedback_rows
        if str(_row_value(row, "user_id")) in eligible_user_ids
    ]
    eligible_feedback.sort(
        key=lambda row: _row_value(row, "created_at") or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )
    feedback = {
        "recent": [_serialize_feedback(row) for row in eligible_feedback[:20]],
        "by_area": _group_count(eligible_feedback, "area"),
        "by_severity": _group_count(eligible_feedback, "severity"),
    }

    eligible_cancel_rows = [
        row for row in cancel_rows
        if str(_row_value(row, "user_id")) in eligible_user_ids
    ]
    eligible_cancel_rows.sort(
        key=lambda row: _row_value(row, "created_at") or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )

    bucket_counts: Counter[str] = Counter()
    for user_id in churned_user_ids:
        if user_id in normalized_signals.get("parse_failure", set()):
            bucket_counts["parse"] += 1
        elif user_id in normalized_signals.get("export_refusal", set()):
            bucket_counts["export"] += 1
        elif user_id in normalized_signals.get("page_fail", set()):
            bucket_counts["page_fail"] += 1
        elif user_id in normalized_signals.get("rag_miss", set()):
            bucket_counts["coverage_fail"] += 1
        elif user_id in normalized_signals.get("capability_refusal", set()):
            bucket_counts["capability_refusal"] += 1
        elif user_id in one_and_done_user_ids:
            bucket_counts["one_off_success"] += 1

    reason_buckets = [
        {
            "key": key,
            "label": label,
            "count": bucket_counts.get(key, 0),
            "pct": _rate(bucket_counts.get(key, 0), len(churned_user_ids)),
        }
        for key, label in REASON_BUCKET_LABELS.items()
    ]

    return {
        "generated_at": now.isoformat(),
        "inactive_days": inactive_days,
        "churned_users": len(churned_user_ids),
        "one_and_done": one_and_done,
        "churn_signals": churn_signals,
        "last_action": last_action,
        "feedback": feedback,
        "cancel_reasons": [_serialize_cancel_reason(row) for row in eligible_cancel_rows[:20]],
        "reason_buckets": reason_buckets,
    }


def _citations_empty(citations: Any) -> bool:
    return citations in (None, {}, [], "{}", "[]", "null")


def _message_has_artifact(metadata: Any) -> bool:
    if not isinstance(metadata, dict):
        return False
    artifact_count = metadata.get("artifact_count")
    if isinstance(artifact_count, int) and artifact_count > 0:
        return True
    artifacts = metadata.get("artifacts")
    return isinstance(artifacts, list) and len(artifacts) > 0


def _activity_subquery(start: datetime, end: datetime | None = None):
    usage_q = (
        select(UsageRecord.user_id.label("user_id"), UsageRecord.created_at.label("created_at"))
        .where(UsageRecord.user_id.is_not(None))
        .where(UsageRecord.created_at >= start)
    )
    message_q = (
        select(ChatSession.user_id.label("user_id"), Message.created_at.label("created_at"))
        .join(ChatSession, Message.session_id == ChatSession.id)
        .where(ChatSession.user_id.is_not(None))
        .where(Message.role == "user")
        .where(Message.created_at >= start)
    )
    document_q = (
        select(Document.user_id.label("user_id"), Document.created_at.label("created_at"))
        .where(Document.user_id.is_not(None))
        .where(Document.demo_slug.is_(None))
        .where(Document.created_at >= start)
    )
    event_q = (
        select(ProductEvent.user_id.label("user_id"), ProductEvent.created_at.label("created_at"))
        .where(ProductEvent.user_id.is_not(None))
        .where(ProductEvent.created_at >= start)
    )
    feedback_q = (
        select(UserFeedback.user_id.label("user_id"), UserFeedback.created_at.label("created_at"))
        .where(UserFeedback.user_id.is_not(None))
        .where(UserFeedback.created_at >= start)
    )
    if end is not None:
        usage_q = usage_q.where(UsageRecord.created_at < end)
        message_q = message_q.where(Message.created_at < end)
        document_q = document_q.where(Document.created_at < end)
        event_q = event_q.where(ProductEvent.created_at < end)
        feedback_q = feedback_q.where(UserFeedback.created_at < end)
    return union_all(usage_q, message_q, document_q, event_q, feedback_q).subquery()


def _stripe_secret_mode() -> str:
    key = settings.STRIPE_SECRET_KEY or ""
    if not key:
        return "missing"
    if key.startswith("sk_live_"):
        return "live"
    if key.startswith("sk_test_"):
        return "test"
    return "unknown"


def _price_hint(price_id: str) -> str | None:
    if not price_id:
        return None
    if len(price_id) <= 14:
        return price_id[:6] + "..."
    return f"{price_id[:8]}...{price_id[-6:]}"


async def _stripe_price_status(label: str, price_id: str, remote: bool) -> dict:
    payload = {
        "label": label,
        "configured": bool(price_id),
        "id_hint": _price_hint(price_id),
        "livemode": None,
        "active": None,
        "currency": None,
        "interval": None,
        "error": None,
    }
    if not remote or not price_id or not settings.STRIPE_SECRET_KEY:
        return payload

    try:
        stripe.api_key = settings.STRIPE_SECRET_KEY
        price = await asyncio.to_thread(stripe.Price.retrieve, price_id)
        recurring = price.get("recurring") or {}
        payload.update({
            "livemode": bool(price.get("livemode")),
            "active": bool(price.get("active")),
            "currency": price.get("currency"),
            "interval": recurring.get("interval"),
        })
    except stripe.StripeError as e:
        payload["error"] = str(e)[:200]
    return payload


@router.get("/overview", response_model=AdminOverviewResponse)
async def admin_overview(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
):
    """Top-level KPI snapshot."""
    cache_key = "admin:overview"
    cached = await cache_get(cache_key)
    if isinstance(cached, dict):
        return cached

    user_stats = (
        await db.execute(
            select(
                func.count(User.id).label("total_users"),
                func.coalesce(func.sum(case((User.plan != "free", 1), else_=0)), 0).label("paid_users"),
                func.coalesce(func.sum(case((User.plan == "plus", 1), else_=0)), 0).label("plus_users"),
                func.coalesce(func.sum(case((User.plan == "pro", 1), else_=0)), 0).label("pro_users"),
            )
        )
    ).one()

    content_stats = (
        await db.execute(
            select(
                func.coalesce(select(func.count(Document.id)).scalar_subquery(), 0).label("total_documents"),
                func.coalesce(select(func.count(ChatSession.id)).scalar_subquery(), 0).label("total_sessions"),
                func.coalesce(select(func.count(Message.id)).scalar_subquery(), 0).label("total_messages"),
            )
        )
    ).one()

    financial_stats = (
        await db.execute(
            select(
                func.coalesce(select(func.sum(UsageRecord.total_tokens)).scalar_subquery(), 0).label("total_tokens"),
                func.coalesce(
                    select(func.sum(case((CreditLedger.delta < 0, -CreditLedger.delta), else_=0))).scalar_subquery(),
                    0,
                ).label("total_credits_spent"),
                func.coalesce(
                    select(func.sum(case((CreditLedger.delta > 0, CreditLedger.delta), else_=0))).scalar_subquery(),
                    0,
                ).label("total_credits_granted"),
            )
        )
    ).one()

    payload = {
        "total_users": int(user_stats.total_users or 0),
        "paid_users": int(user_stats.paid_users or 0),
        "plus_users": int(user_stats.plus_users or 0),
        "pro_users": int(user_stats.pro_users or 0),
        "total_documents": int(content_stats.total_documents or 0),
        "total_sessions": int(content_stats.total_sessions or 0),
        "total_messages": int(content_stats.total_messages or 0),
        "total_tokens": int(financial_stats.total_tokens or 0),
        "total_credits_spent": int(financial_stats.total_credits_spent or 0),
        "total_credits_granted": int(financial_stats.total_credits_granted or 0),
    }
    await cache_set(cache_key, payload, ttl_seconds=60)
    return payload


@router.get("/trends", response_model=AdminTrendsResponse)
async def admin_trends(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
    period: str = Query("day", regex="^(day|week|month)$"),
    days: int = Query(30, ge=1, le=365),
):
    """Time series trends for key metrics."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    trunc = lambda col: func.date_trunc(period, col)  # noqa: E731

    # Signups
    signups_q = (
        select(
            trunc(User.created_at).label("date"),
            func.count(User.id).label("count"),
        )
        .where(User.created_at >= cutoff)
        .group_by("date")
        .order_by("date")
    )
    signups = [{"date": str(r.date.date()), "count": r.count} for r in (await db.execute(signups_q)).all()]

    # Documents
    docs_q = (
        select(
            trunc(Document.created_at).label("date"),
            func.count(Document.id).label("count"),
        )
        .where(Document.created_at >= cutoff)
        .group_by("date")
        .order_by("date")
    )
    documents = [{"date": str(r.date.date()), "count": r.count} for r in (await db.execute(docs_q)).all()]

    # Tokens
    tokens_q = (
        select(
            trunc(UsageRecord.created_at).label("date"),
            func.coalesce(func.sum(UsageRecord.total_tokens), 0).label("total_tokens"),
        )
        .where(UsageRecord.created_at >= cutoff)
        .group_by("date")
        .order_by("date")
    )
    tokens = [{"date": str(r.date.date()), "total_tokens": int(r.total_tokens)} for r in (await db.execute(tokens_q)).all()]

    # Credits spent (negative delta = spending)
    credits_q = (
        select(
            trunc(CreditLedger.created_at).label("date"),
            func.coalesce(func.sum(
                case((CreditLedger.delta < 0, func.abs(CreditLedger.delta)), else_=0)
            ), 0).label("amount"),
        )
        .where(CreditLedger.created_at >= cutoff)
        .group_by("date")
        .order_by("date")
    )
    credits_spent = [{"date": str(r.date.date()), "amount": int(r.amount)} for r in (await db.execute(credits_q)).all()]

    # Active users (distinct user_ids in usage_records)
    active_q = (
        select(
            trunc(UsageRecord.created_at).label("date"),
            func.count(func.distinct(UsageRecord.user_id)).label("count"),
        )
        .where(UsageRecord.created_at >= cutoff)
        .group_by("date")
        .order_by("date")
    )
    active_users = [{"date": str(r.date.date()), "count": r.count} for r in (await db.execute(active_q)).all()]

    return {
        "signups": signups,
        "documents": documents,
        "tokens": tokens,
        "credits_spent": credits_spent,
        "active_users": active_users,
    }


@router.get("/breakdowns", response_model=AdminBreakdownsResponse)
async def admin_breakdowns(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
):
    """Category distributions."""
    # Plan distribution
    plan_q = (
        select(User.plan.label("plan"), func.count(User.id).label("count"))
        .group_by(User.plan)
        .order_by(func.count(User.id).desc())
    )
    plan_distribution = [{"plan": r.plan, "count": r.count} for r in (await db.execute(plan_q)).all()]

    # Model usage
    model_q = (
        select(
            UsageRecord.model.label("model"),
            func.count(UsageRecord.id).label("calls"),
            func.coalesce(func.sum(UsageRecord.total_tokens), 0).label("tokens"),
            func.coalesce(func.sum(UsageRecord.cost_credits), 0).label("credits"),
        )
        .group_by(UsageRecord.model)
        .order_by(func.sum(UsageRecord.total_tokens).desc())
    )
    model_usage = [
        {"model": r.model, "calls": r.calls, "tokens": int(r.tokens), "credits": int(r.credits)}
        for r in (await db.execute(model_q)).all()
    ]

    # File types
    file_type_q = (
        select(Document.file_type.label("file_type"), func.count(Document.id).label("count"))
        .group_by(Document.file_type)
        .order_by(func.count(Document.id).desc())
    )
    file_types = [{"file_type": r.file_type, "count": r.count} for r in (await db.execute(file_type_q)).all()]

    # Doc status
    status_q = (
        select(Document.status.label("status"), func.count(Document.id).label("count"))
        .group_by(Document.status)
        .order_by(func.count(Document.id).desc())
    )
    doc_status = [{"status": r.status, "count": r.count} for r in (await db.execute(status_q)).all()]

    return {
        "plan_distribution": plan_distribution,
        "model_usage": model_usage,
        "file_types": file_types,
        "doc_status": doc_status,
    }


@router.get("/user-activity", response_model=AdminUserActivityResponse)
async def admin_user_activity(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
    period: str = Query("day", regex="^(day|week|month)$"),
    days: int = Query(30, ge=1, le=365),
):
    """Composite user activity, retention, paid intent, and feedback analytics."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=days)
    previous_cutoff = cutoff - timedelta(days=days)
    trunc = lambda col: func.date_trunc(period, col)  # noqa: E731

    async def composite_users(start: datetime, end: datetime | None = None) -> int:
        activity_sq = _activity_subquery(start, end)
        value = await db.scalar(
            select(func.count(func.distinct(activity_sq.c.user_id))).select_from(activity_sq)
        )
        return int(value or 0)

    dau = await composite_users(now - timedelta(days=1))
    wau = await composite_users(now - timedelta(days=7))
    mau = await composite_users(now - timedelta(days=30))
    active_users = await composite_users(cutoff)
    previous_active_users = await composite_users(previous_cutoff, cutoff)

    signups = int(await db.scalar(select(func.count(User.id)).where(User.created_at >= cutoff)) or 0)
    previous_signups = int(
        await db.scalar(
            select(func.count(User.id))
            .where(User.created_at >= previous_cutoff)
            .where(User.created_at < cutoff)
        )
        or 0
    )
    total_users = int(await db.scalar(select(func.count(User.id))) or 0)
    paid_users = int(await db.scalar(select(func.count(User.id)).where(User.plan != "free")) or 0)

    upload_users = int(
        await db.scalar(
            select(func.count(func.distinct(Document.user_id)))
            .where(Document.created_at >= cutoff)
            .where(Document.demo_slug.is_(None))
            .where(Document.user_id.is_not(None))
        )
        or 0
    )
    previous_upload_users = int(
        await db.scalar(
            select(func.count(func.distinct(Document.user_id)))
            .where(Document.created_at >= previous_cutoff)
            .where(Document.created_at < cutoff)
            .where(Document.demo_slug.is_(None))
            .where(Document.user_id.is_not(None))
        )
        or 0
    )
    chat_users = int(
        await db.scalar(
            select(func.count(func.distinct(ChatSession.user_id)))
            .join(Message, Message.session_id == ChatSession.id)
            .where(Message.created_at >= cutoff)
            .where(Message.role == "user")
            .where(ChatSession.user_id.is_not(None))
        )
        or 0
    )
    previous_chat_users = int(
        await db.scalar(
            select(func.count(func.distinct(ChatSession.user_id)))
            .join(Message, Message.session_id == ChatSession.id)
            .where(Message.created_at >= previous_cutoff)
            .where(Message.created_at < cutoff)
            .where(Message.role == "user")
            .where(ChatSession.user_id.is_not(None))
        )
        or 0
    )
    activated_users = int(
        await db.scalar(
            select(func.count(func.distinct(Document.user_id)))
            .join(ChatSession, ChatSession.user_id == Document.user_id)
            .join(Message, Message.session_id == ChatSession.id)
            .where(Document.created_at >= cutoff)
            .where(Document.demo_slug.is_(None))
            .where(Message.role == "user")
            .where(Message.created_at >= cutoff)
            .where(Document.user_id.is_not(None))
        )
        or 0
    )

    checkout_completed_users = int(
        await db.scalar(
            select(func.count(func.distinct(ProductEvent.user_id)))
            .where(ProductEvent.created_at >= cutoff)
            .where(ProductEvent.event_name == "checkout_completed")
            .where(ProductEvent.user_id.is_not(None))
        )
        or 0
    )
    previous_checkout_completed_users = int(
        await db.scalar(
            select(func.count(func.distinct(ProductEvent.user_id)))
            .where(ProductEvent.created_at >= previous_cutoff)
            .where(ProductEvent.created_at < cutoff)
            .where(ProductEvent.event_name == "checkout_completed")
            .where(ProductEvent.user_id.is_not(None))
        )
        or 0
    )

    series_map: dict[str, dict[str, int | str]] = {}

    def point_for(value: Any) -> dict[str, int | str]:
        label = _date_label(value)
        if label not in series_map:
            series_map[label] = {
                "date": label,
                "signups": 0,
                "active_users": 0,
                "ai_active_users": 0,
                "uploads": 0,
                "upload_users": 0,
                "chat_users": 0,
                "messages": 0,
                "credits_spent": 0,
                "upgrade_nudge_shown": 0,
                "paywall_opened": 0,
                "limit_hit": 0,
                "billing_view": 0,
                "upgrade_click": 0,
                "checkout_created": 0,
                "checkout_completed": 0,
                "feedback_submissions": 0,
            }
        return series_map[label]

    signup_rows = (
        await db.execute(
            select(trunc(User.created_at).label("date"), func.count(User.id).label("count"))
            .where(User.created_at >= cutoff)
            .group_by("date")
            .order_by("date")
        )
    ).all()
    for row in signup_rows:
        point_for(row.date)["signups"] = int(row.count or 0)

    activity_sq = _activity_subquery(cutoff)
    active_rows = (
        await db.execute(
            select(
                trunc(activity_sq.c.created_at).label("date"),
                func.count(func.distinct(activity_sq.c.user_id)).label("count"),
            )
            .select_from(activity_sq)
            .group_by("date")
            .order_by("date")
        )
    ).all()
    for row in active_rows:
        point_for(row.date)["active_users"] = int(row.count or 0)

    ai_active_rows = (
        await db.execute(
            select(
                trunc(UsageRecord.created_at).label("date"),
                func.count(func.distinct(UsageRecord.user_id)).label("count"),
            )
            .where(UsageRecord.created_at >= cutoff)
            .group_by("date")
            .order_by("date")
        )
    ).all()
    for row in ai_active_rows:
        point_for(row.date)["ai_active_users"] = int(row.count or 0)

    upload_rows = (
        await db.execute(
            select(
                trunc(Document.created_at).label("date"),
                func.count(Document.id).label("uploads"),
                func.count(func.distinct(Document.user_id)).label("users"),
            )
            .where(Document.created_at >= cutoff)
            .where(Document.demo_slug.is_(None))
            .where(Document.user_id.is_not(None))
            .group_by("date")
            .order_by("date")
        )
    ).all()
    for row in upload_rows:
        point = point_for(row.date)
        point["uploads"] = int(row.uploads or 0)
        point["upload_users"] = int(row.users or 0)

    chat_rows = (
        await db.execute(
            select(
                trunc(Message.created_at).label("date"),
                func.count(Message.id).label("messages"),
                func.count(func.distinct(ChatSession.user_id)).label("users"),
            )
            .join(ChatSession, Message.session_id == ChatSession.id)
            .where(Message.created_at >= cutoff)
            .where(Message.role == "user")
            .where(ChatSession.user_id.is_not(None))
            .group_by("date")
            .order_by("date")
        )
    ).all()
    for row in chat_rows:
        point = point_for(row.date)
        point["messages"] = int(row.messages or 0)
        point["chat_users"] = int(row.users or 0)

    credit_rows = (
        await db.execute(
            select(
                trunc(CreditLedger.created_at).label("date"),
                func.coalesce(
                    func.sum(case((CreditLedger.delta < 0, func.abs(CreditLedger.delta)), else_=0)),
                    0,
                ).label("amount"),
            )
            .where(CreditLedger.created_at >= cutoff)
            .group_by("date")
            .order_by("date")
        )
    ).all()
    for row in credit_rows:
        point_for(row.date)["credits_spent"] = int(row.amount or 0)

    event_rows = (
        await db.execute(
            select(
                trunc(ProductEvent.created_at).label("date"),
                ProductEvent.event_name.label("event_name"),
                func.count(ProductEvent.id).label("count"),
            )
            .where(ProductEvent.created_at >= cutoff)
            .where(ProductEvent.event_name.in_(PAID_INTENT_EVENTS))
            .group_by("date", ProductEvent.event_name)
            .order_by("date")
        )
    ).all()
    for row in event_rows:
        if row.event_name in point_for(row.date):
            point_for(row.date)[row.event_name] = int(row.count or 0)

    feedback_series_rows = (
        await db.execute(
            select(
                trunc(UserFeedback.created_at).label("date"),
                func.count(UserFeedback.id).label("count"),
            )
            .where(UserFeedback.created_at >= cutoff)
            .group_by("date")
            .order_by("date")
        )
    ).all()
    for row in feedback_series_rows:
        point_for(row.date)["feedback_submissions"] = int(row.count or 0)

    cohort_user_ids = select(User.id).where(User.created_at >= cutoff).subquery()
    cohort_upload_users = int(
        await db.scalar(
            select(func.count(func.distinct(Document.user_id)))
            .where(Document.created_at >= cutoff)
            .where(Document.demo_slug.is_(None))
            .where(Document.user_id.in_(select(cohort_user_ids.c.id)))
        )
        or 0
    )
    session_users = int(
        await db.scalar(
            select(func.count(func.distinct(ChatSession.user_id)))
            .where(ChatSession.created_at >= cutoff)
            .where(ChatSession.user_id.in_(select(cohort_user_ids.c.id)))
        )
        or 0
    )
    first_chat_users = int(
        await db.scalar(
            select(func.count(func.distinct(ChatSession.user_id)))
            .join(Message, Message.session_id == ChatSession.id)
            .where(Message.created_at >= cutoff)
            .where(Message.role == "user")
            .where(ChatSession.user_id.in_(select(cohort_user_ids.c.id)))
        )
        or 0
    )
    power_user_sq = (
        select(ChatSession.user_id.label("user_id"), func.count(Message.id).label("message_count"))
        .join(Message, Message.session_id == ChatSession.id)
        .where(Message.created_at >= cutoff)
        .where(Message.role == "user")
        .where(ChatSession.user_id.in_(select(cohort_user_ids.c.id)))
        .group_by(ChatSession.user_id)
        .subquery()
    )
    five_message_users = int(
        await db.scalar(select(func.count()).select_from(power_user_sq).where(power_user_sq.c.message_count >= 5))
        or 0
    )
    cohort_event_rows = (
        await db.execute(
            select(
                ProductEvent.event_name,
                func.count(func.distinct(ProductEvent.user_id)).label("users"),
            )
            .where(ProductEvent.created_at >= cutoff)
            .where(ProductEvent.user_id.in_(select(cohort_user_ids.c.id)))
            .where(ProductEvent.event_name.in_(PAID_INTENT_EVENTS))
            .group_by(ProductEvent.event_name)
        )
    ).all()
    cohort_event_counts = {row.event_name: int(row.users or 0) for row in cohort_event_rows}

    raw_stages = [
        ("signup", "Signups", signups),
        ("first_upload", "Uploaded document", cohort_upload_users),
        ("first_session", "Created chat session", session_users),
        ("first_chat", "Sent chat message", first_chat_users),
        ("five_chats", "5+ chat messages", five_message_users),
        ("upgrade_nudge_shown", "Saw upgrade reminder", cohort_event_counts.get("upgrade_nudge_shown", 0)),
        ("limit_hit", "Hit paid limit", cohort_event_counts.get("limit_hit", 0)),
        ("paywall_opened", "Saw blocking paywall", cohort_event_counts.get("paywall_opened", 0)),
        ("billing_view", "Viewed billing", cohort_event_counts.get("billing_view", 0)),
        ("upgrade_click", "Clicked upgrade", cohort_event_counts.get("upgrade_click", 0)),
        ("checkout_created", "Checkout created", cohort_event_counts.get("checkout_created", 0)),
        ("checkout_completed", "Checkout completed", cohort_event_counts.get("checkout_completed", 0)),
    ]
    funnel = []
    previous_stage_users: int | None = None
    for key, label, users in raw_stages:
        funnel.append({
            "key": key,
            "label": label,
            "users": users,
            "rate_from_signup": _rate(users, signups) if key != "signup" else None,
            "rate_from_previous": _rate(users, previous_stage_users) if previous_stage_users else None,
        })
        previous_stage_users = users

    retention_rows = (
        await db.execute(
            text(
                """
                WITH cohort AS (
                    SELECT id, date_trunc('day', created_at)::date AS cohort_date
                    FROM users
                    WHERE created_at >= :cutoff
                ),
                activity AS (
                    SELECT user_id, date_trunc('day', created_at)::date AS activity_date
                    FROM usage_records
                    WHERE created_at >= :cutoff AND user_id IS NOT NULL
                    UNION ALL
                    SELECT s.user_id, date_trunc('day', m.created_at)::date AS activity_date
                    FROM messages m
                    JOIN sessions s ON s.id = m.session_id
                    WHERE m.created_at >= :cutoff AND m.role = 'user' AND s.user_id IS NOT NULL
                    UNION ALL
                    SELECT user_id, date_trunc('day', created_at)::date AS activity_date
                    FROM documents
                    WHERE created_at >= :cutoff AND demo_slug IS NULL AND user_id IS NOT NULL
                    UNION ALL
                    SELECT user_id, date_trunc('day', created_at)::date AS activity_date
                    FROM product_events
                    WHERE created_at >= :cutoff AND user_id IS NOT NULL
                    UNION ALL
                    SELECT user_id, date_trunc('day', created_at)::date AS activity_date
                    FROM user_feedback
                    WHERE created_at >= :cutoff AND user_id IS NOT NULL
                )
                SELECT
                    c.cohort_date::text AS cohort_date,
                    count(DISTINCT c.id)::int AS cohort_size,
                    count(DISTINCT c.id) FILTER (WHERE a.activity_date = c.cohort_date)::int AS d0,
                    count(DISTINCT c.id) FILTER (WHERE a.activity_date = c.cohort_date + 1)::int AS d1,
                    count(DISTINCT c.id) FILTER (WHERE a.activity_date = c.cohort_date + 7)::int AS d7,
                    count(DISTINCT c.id) FILTER (WHERE a.activity_date = c.cohort_date + 30)::int AS d30
                FROM cohort c
                LEFT JOIN activity a ON a.user_id = c.id
                GROUP BY c.cohort_date
                ORDER BY c.cohort_date DESC
                LIMIT 30
                """
            ),
            {"cutoff": cutoff},
        )
    ).all()
    retention = [
        {
            "cohort_date": row.cohort_date,
            "cohort_size": int(row.cohort_size or 0),
            "d0": int(row.d0 or 0),
            "d1": int(row.d1 or 0),
            "d7": int(row.d7 or 0),
            "d30": int(row.d30 or 0),
            "d0_rate": _rate(row.d0 or 0, row.cohort_size or 0),
            "d1_rate": _rate(row.d1 or 0, row.cohort_size or 0),
            "d7_rate": _rate(row.d7 or 0, row.cohort_size or 0),
            "d30_rate": _rate(row.d30 or 0, row.cohort_size or 0),
        }
        for row in retention_rows
    ]
    retention_explanation = None
    if not retention:
        retention_explanation = "No signup cohorts in the selected window."
    elif days < 30:
        retention_explanation = "D30 retention is incomplete for windows shorter than 30 days."

    plan_rows = (
        await db.execute(
            select(User.plan.label("key"), func.count(User.id).label("count"))
            .group_by(User.plan)
            .order_by(func.count(User.id).desc())
        )
    ).all()
    file_type_rows = (
        await db.execute(
            select(Document.file_type.label("key"), func.count(Document.id).label("count"))
            .where(Document.created_at >= cutoff)
            .where(Document.demo_slug.is_(None))
            .group_by(Document.file_type)
            .order_by(func.count(Document.id).desc())
        )
    ).all()
    paid_reason_rows = (
        await db.execute(
            select(
                ProductEvent.event_name,
                ProductEvent.reason,
                ProductEvent.source,
                ProductEvent.plan,
                func.count(ProductEvent.id).label("events"),
                func.count(func.distinct(ProductEvent.user_id)).label("users"),
            )
            .where(ProductEvent.created_at >= cutoff)
            .where(ProductEvent.event_name.in_(PAID_INTENT_EVENTS))
            .group_by(ProductEvent.event_name, ProductEvent.reason, ProductEvent.source, ProductEvent.plan)
            .order_by(func.count(ProductEvent.id).desc())
            .limit(50)
        )
    ).all()
    paid_intent_reasons = [_paid_intent_payload(row) for row in paid_reason_rows]
    conversion_blockers = [
        item for item in paid_intent_reasons if item["event_name"] in {"limit_hit", "paywall_opened", "refund_requested"}
    ][:20]

    async def feedback_group(column) -> list[dict[str, int | str]]:
        rows = (
            await db.execute(
                select(column.label("key"), func.count(UserFeedback.id).label("count"))
                .where(UserFeedback.created_at >= cutoff)
                .group_by(column)
                .order_by(func.count(UserFeedback.id).desc())
            )
        ).all()
        return [{"key": row.key or "unknown", "count": int(row.count or 0), "users": None} for row in rows]

    feedback_total = int(
        await db.scalar(select(func.count(UserFeedback.id)).where(UserFeedback.created_at >= cutoff)) or 0
    )
    feedback_recent_rows = (
        await db.execute(
            select(UserFeedback)
            .where(UserFeedback.created_at >= cutoff)
            .order_by(UserFeedback.created_at.desc())
            .limit(20)
        )
    ).scalars().all()
    feedback_recent = []
    for item in feedback_recent_rows:
        message = item.message or ""
        feedback_recent.append({
            "id": str(item.id),
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "type": item.type,
            "area": item.area,
            "severity": item.severity,
            "status": item.status,
            "path": item.path,
            "locale": item.locale,
            "plan": item.plan,
            "has_message": bool(message),
            "message_preview": message[:180] if message else None,
        })

    return {
        "days": days,
        "period": period,
        "since": cutoff.isoformat(),
        "generated_at": now.isoformat(),
        "summary": {
            "dau": dau,
            "wau": wau,
            "mau": mau,
            "signups": signups,
            "activated_users": activated_users,
            "upload_users": upload_users,
            "chat_users": chat_users,
            "paid_users": paid_users,
            "total_users": total_users,
            "free_to_paid_rate": _rate(paid_users, total_users),
            "deltas": {
                "signups": _delta_payload(signups, previous_signups),
                "active_users": _delta_payload(active_users, previous_active_users),
                "upload_users": _delta_payload(upload_users, previous_upload_users),
                "chat_users": _delta_payload(chat_users, previous_chat_users),
                "checkout_completed": _delta_payload(
                    checkout_completed_users,
                    previous_checkout_completed_users,
                ),
            },
        },
        "series": [series_map[key] for key in sorted(series_map)],
        "funnel": funnel,
        "retention": retention,
        "retention_explanation": retention_explanation,
        "segments": {
            "plan_distribution": [
                {"key": row.key or "unknown", "count": int(row.count or 0), "users": None}
                for row in plan_rows
            ],
            "file_types": [
                {"key": row.key or "unknown", "count": int(row.count or 0), "users": None}
                for row in file_type_rows
            ],
            "paid_intent_reasons": paid_intent_reasons,
            "conversion_blockers": conversion_blockers,
        },
        "feedback": {
            "total": feedback_total,
            "by_type": await feedback_group(UserFeedback.type),
            "by_area": await feedback_group(UserFeedback.area),
            "by_severity": await feedback_group(UserFeedback.severity),
            "by_status": await feedback_group(UserFeedback.status),
            "recent": feedback_recent,
        },
    }


@router.get("/retention", response_model=AdminRetentionResponse)
async def admin_retention(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
):
    """Retention analytics centered on user-role chat message activity."""
    now = datetime.now(timezone.utc)
    current_week = _week_start(now)
    cohort_cutoff = datetime.combine(
        current_week - timedelta(weeks=RETENTION_WEEKS - 1),
        datetime.min.time(),
        tzinfo=timezone.utc,
    )
    activity_cutoff = now - timedelta(days=RETENTION_LOOKBACK_DAYS)

    activity_user_ids = (
        select(ChatSession.user_id.label("user_id"))
        .select_from(Message)
        .join(ChatSession, Message.session_id == ChatSession.id)
        .where(Message.role == "user")
        .where(Message.created_at >= activity_cutoff)
        .where(ChatSession.user_id.is_not(None))
        .subquery()
    )
    user_rows = (
        await db.execute(
            select(User.id, User.email, User.created_at, User.plan)
            .where(or_(User.created_at >= cohort_cutoff, User.id.in_(select(activity_user_ids.c.user_id))))
            .where(*_eligible_user_conditions())
        )
    ).all()

    activity_day = func.date_trunc("day", Message.created_at).label("activity_date")
    activity_rows = (
        await db.execute(
            select(ChatSession.user_id.label("user_id"), activity_day)
            .select_from(Message)
            .join(ChatSession, Message.session_id == ChatSession.id)
            .join(User, User.id == ChatSession.user_id)
            .where(Message.role == "user")
            .where(Message.created_at >= activity_cutoff)
            .where(ChatSession.user_id.is_not(None))
            .where(*_eligible_user_conditions())
            .group_by(ChatSession.user_id, activity_day)
        )
    ).all()

    document_rows = (
        await db.execute(
            select(
                Document.user_id.label("user_id"),
                func.max(Document.page_count).label("max_page_count"),
            )
            .select_from(Document)
            .join(User, User.id == Document.user_id)
            .where(Document.created_at >= activity_cutoff)
            .where(Document.user_id.is_not(None))
            .where(Document.demo_slug.is_(None))
            .where(*_eligible_user_conditions())
            .group_by(Document.user_id)
        )
    ).all()

    locale_rows = (
        await db.execute(
            select(UserFeedback.user_id.label("user_id"), func.max(UserFeedback.locale).label("locale"))
            .select_from(UserFeedback)
            .join(User, User.id == UserFeedback.user_id)
            .where(UserFeedback.created_at >= activity_cutoff)
            .where(UserFeedback.user_id.is_not(None))
            .where(UserFeedback.locale.is_not(None))
            .where(*_eligible_user_conditions())
            .group_by(UserFeedback.user_id)
        )
    ).all()

    return _build_retention_payload(
        now=now,
        users=list(user_rows),
        activity_days=list(activity_rows),
        document_segments=list(document_rows),
        locale_segments=list(locale_rows),
    )


@router.get("/churn", response_model=AdminChurnResponse)
async def admin_churn(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
    inactive_days: int = Query(14, ge=1, le=90),
):
    """Churn diagnostics for activated users without recent user-message activity."""
    now = datetime.now(timezone.utc)
    activity_cutoff = now - timedelta(days=CHURN_LOOKBACK_DAYS)

    activity_user_ids = (
        select(ChatSession.user_id.label("user_id"))
        .select_from(Message)
        .join(ChatSession, Message.session_id == ChatSession.id)
        .where(Message.role == "user")
        .where(Message.created_at >= activity_cutoff)
        .where(ChatSession.user_id.is_not(None))
        .subquery()
    )
    user_rows = (
        await db.execute(
            select(User.id, User.email, User.created_at, User.plan)
            .where(User.id.in_(select(activity_user_ids.c.user_id)))
            .where(*_eligible_user_conditions())
        )
    ).all()

    activity_day = func.date_trunc("day", Message.created_at).label("activity_date")
    activity_rows = (
        await db.execute(
            select(ChatSession.user_id.label("user_id"), activity_day)
            .select_from(Message)
            .join(ChatSession, Message.session_id == ChatSession.id)
            .join(User, User.id == ChatSession.user_id)
            .where(Message.role == "user")
            .where(Message.created_at >= activity_cutoff)
            .where(ChatSession.user_id.is_not(None))
            .where(*_eligible_user_conditions())
            .group_by(ChatSession.user_id, activity_day)
        )
    ).all()

    session_rows = (
        await db.execute(
            select(
                ChatSession.id.label("session_id"),
                ChatSession.user_id.label("user_id"),
                func.coalesce(func.sum(case((Message.role == "user", 1), else_=0)), 0).label("user_messages"),
                func.coalesce(func.sum(case((Message.role == "assistant", 1), else_=0)), 0).label("assistant_messages"),
            )
            .select_from(ChatSession)
            .join(Message, Message.session_id == ChatSession.id)
            .join(User, User.id == ChatSession.user_id)
            .where(Message.created_at >= activity_cutoff)
            .where(ChatSession.user_id.is_not(None))
            .where(*_eligible_user_conditions())
            .group_by(ChatSession.id, ChatSession.user_id)
        )
    ).all()
    asst_zero_session_ids = {
        str(row.session_id)
        for row in session_rows
        if int(row.user_messages or 0) > 0 and int(row.assistant_messages or 0) == 0
    }
    signal_users: dict[str, set[str]] = {
        "asst_zero": {
            str(row.user_id)
            for row in session_rows
            if int(row.user_messages or 0) > 0 and int(row.assistant_messages or 0) == 0
        },
        "rag_miss": set(),
        "parse_failure": set(),
        "large_doc": set(),
        "export_refusal": set(),
        "paywall_hit": set(),
        "page_fail": set(),
        "capability_refusal": set(),
    }

    message_rows = (
        await db.execute(
            select(
                ChatSession.user_id.label("user_id"),
                Message.session_id.label("session_id"),
                Message.role.label("role"),
                Message.content.label("content"),
                Message.citations.label("citations"),
                Message.metadata_json.label("metadata_json"),
                Message.created_at.label("created_at"),
            )
            .select_from(Message)
            .join(ChatSession, Message.session_id == ChatSession.id)
            .join(User, User.id == ChatSession.user_id)
            .where(Message.created_at >= activity_cutoff)
            .where(ChatSession.user_id.is_not(None))
            .where(*_eligible_user_conditions())
        )
    ).all()

    export_request_users: set[str] = set()
    export_artifact_users: set[str] = set()
    page_request_users: set[str] = set()
    final_candidates: dict[str, tuple[datetime, str]] = {}
    for row in message_rows:
        user_id = str(row.user_id)
        created_at = row.created_at
        category = "user_message"
        if row.role == "user":
            content = row.content or ""
            if EXPORT_REQUEST_RE.search(content):
                export_request_users.add(user_id)
            if PAGE_REQUEST_RE.search(content):
                page_request_users.add(user_id)
            if str(row.session_id) in asst_zero_session_ids:
                category = "asst_zero"
        elif row.role == "assistant":
            content = row.content or ""
            if _message_has_artifact(row.metadata_json):
                export_artifact_users.add(user_id)
            if _citations_empty(row.citations) or RAG_MISS_RE.search(content):
                signal_users["rag_miss"].add(user_id)
                category = "rag_miss"
            elif CAPABILITY_REFUSAL_RE.search(content):
                signal_users["capability_refusal"].add(user_id)
                category = "capability_refusal"
            else:
                category = "normal_answer"
        current = final_candidates.get(user_id)
        if created_at and (current is None or created_at > current[0]):
            final_candidates[user_id] = (created_at, category)

    signal_users["export_refusal"] = export_request_users - export_artifact_users
    signal_users["page_fail"] = page_request_users & signal_users["rag_miss"]

    document_flag_rows = (
        await db.execute(
            select(
                Document.user_id.label("user_id"),
                func.max(Document.page_count).label("max_page_count"),
                func.coalesce(
                    func.sum(case((Document.status.in_(("error", "ocr")), 1), else_=0)),
                    0,
                ).label("parse_failures"),
            )
            .select_from(Document)
            .join(User, User.id == Document.user_id)
            .where(Document.created_at >= activity_cutoff)
            .where(Document.user_id.is_not(None))
            .where(Document.demo_slug.is_(None))
            .where(*_eligible_user_conditions())
            .group_by(Document.user_id)
        )
    ).all()
    for row in document_flag_rows:
        user_id = str(row.user_id)
        if int(row.parse_failures or 0) > 0:
            signal_users["parse_failure"].add(user_id)
        if int(row.max_page_count or 0) >= 150:
            signal_users["large_doc"].add(user_id)

    product_rows = (
        await db.execute(
            select(
                ProductEvent.user_id.label("user_id"),
                ProductEvent.event_name.label("event_name"),
                ProductEvent.created_at.label("created_at"),
            )
            .select_from(ProductEvent)
            .join(User, User.id == ProductEvent.user_id)
            .where(ProductEvent.created_at >= activity_cutoff)
            .where(ProductEvent.user_id.is_not(None))
            .where(*_eligible_user_conditions())
        )
    ).all()
    for row in product_rows:
        user_id = str(row.user_id)
        if row.event_name in {"paywall_opened", "limit_hit"}:
            signal_users["paywall_hit"].add(user_id)
            category = "paywall"
        else:
            category = str(row.event_name or "product_event")
        current = final_candidates.get(user_id)
        if row.created_at and (current is None or row.created_at > current[0]):
            final_candidates[user_id] = (row.created_at, category)

    upload_rows = (
        await db.execute(
            select(Document.user_id.label("user_id"), Document.created_at.label("created_at"))
            .select_from(Document)
            .join(User, User.id == Document.user_id)
            .where(Document.created_at >= activity_cutoff)
            .where(Document.user_id.is_not(None))
            .where(Document.demo_slug.is_(None))
            .where(*_eligible_user_conditions())
        )
    ).all()
    for row in upload_rows:
        current = final_candidates.get(str(row.user_id))
        if row.created_at and (current is None or row.created_at > current[0]):
            final_candidates[str(row.user_id)] = (row.created_at, "upload")

    feedback_rows = (
        await db.execute(
            select(
                UserFeedback.id,
                UserFeedback.user_id,
                UserFeedback.type,
                UserFeedback.area,
                UserFeedback.severity,
                UserFeedback.message,
                UserFeedback.plan,
                UserFeedback.created_at,
            )
            .select_from(UserFeedback)
            .join(User, User.id == UserFeedback.user_id)
            .where(UserFeedback.created_at >= activity_cutoff)
            .where(UserFeedback.user_id.is_not(None))
            .where(*_eligible_user_conditions())
            .order_by(UserFeedback.created_at.desc())
            .limit(50)
        )
    ).all()

    cancel_rows = (
        await db.execute(
            select(
                PlanTransition.id,
                PlanTransition.user_id,
                PlanTransition.from_plan,
                PlanTransition.to_plan,
                PlanTransition.metadata_json,
                PlanTransition.created_at,
            )
            .select_from(PlanTransition)
            .join(User, User.id == PlanTransition.user_id)
            .where(PlanTransition.created_at >= activity_cutoff)
            .where(
                or_(
                    PlanTransition.to_plan == "free",
                    (PlanTransition.from_plan == "pro") & (PlanTransition.to_plan == "plus"),
                )
            )
            .where(*_eligible_user_conditions())
            .order_by(PlanTransition.created_at.desc())
            .limit(50)
        )
    ).all()

    last_actions = [
        {"user_id": user_id, "category": category}
        for user_id, (_created_at, category) in final_candidates.items()
    ]
    return _build_churn_payload(
        now=now,
        users=list(user_rows),
        activity_days=list(activity_rows),
        signal_users=signal_users,
        last_actions=last_actions,
        feedback_rows=list(feedback_rows),
        cancel_rows=list(cancel_rows),
        inactive_days=inactive_days,
    )


@router.get("/billing-health")
async def admin_billing_health(
    remote: bool = Query(False),
    _admin: User = Depends(require_admin),
):
    """Non-secret billing configuration health check."""
    prices = {
        "plus_monthly": settings.STRIPE_PRICE_PLUS_MONTHLY,
        "plus_annual": settings.STRIPE_PRICE_PLUS_ANNUAL,
        "pro_monthly": settings.STRIPE_PRICE_PRO_MONTHLY,
        "pro_annual": settings.STRIPE_PRICE_PRO_ANNUAL,
        "boost_pack": settings.STRIPE_PRICE_BOOST,
        "power_pack": settings.STRIPE_PRICE_POWER,
        "ultra_pack": settings.STRIPE_PRICE_ULTRA,
    }
    price_statuses = [
        await _stripe_price_status(label, price_id, remote)
        for label, price_id in prices.items()
    ]
    subscription_prices = price_statuses[:4]
    remote_modes = [p["livemode"] for p in price_statuses if p["livemode"] is not None]
    secret_mode = _stripe_secret_mode()
    has_mode_mismatch = (
        secret_mode in {"live", "test"}
        and any(mode is not None and mode != (secret_mode == "live") for mode in remote_modes)
    )

    return {
        "stripe_secret_configured": bool(settings.STRIPE_SECRET_KEY),
        "stripe_secret_mode": secret_mode,
        "stripe_webhook_configured": bool(settings.STRIPE_WEBHOOK_SECRET),
        "frontend_url_configured": bool(settings.FRONTEND_URL),
        "all_subscription_prices_configured": all(p["configured"] for p in subscription_prices),
        "remote_checked": remote,
        "has_mode_mismatch": has_mode_mismatch,
        "prices": price_statuses,
    }


@router.get("/funnel")
async def admin_funnel(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
    days: int = Query(30, ge=1, le=365),
):
    """Activation and monetization funnel snapshot for the signup cohort."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    cohort_user_ids = select(User.id).where(User.created_at >= cutoff).subquery()

    signups = await db.scalar(select(func.count()).select_from(cohort_user_ids))
    upload_users = await db.scalar(
        select(func.count(func.distinct(Document.user_id)))
        .where(Document.created_at >= cutoff)
        .where(Document.user_id.in_(select(cohort_user_ids.c.id)))
    )
    session_users = await db.scalar(
        select(func.count(func.distinct(ChatSession.user_id)))
        .where(ChatSession.created_at >= cutoff)
        .where(ChatSession.user_id.in_(select(cohort_user_ids.c.id)))
    )
    chat_users = await db.scalar(
        select(func.count(func.distinct(ChatSession.user_id)))
        .join(Message, Message.session_id == ChatSession.id)
        .where(Message.created_at >= cutoff)
        .where(Message.role == "user")
        .where(ChatSession.user_id.in_(select(cohort_user_ids.c.id)))
    )
    power_user_sq = (
        select(
            ChatSession.user_id.label("user_id"),
            func.count(Message.id).label("message_count"),
        )
        .join(Message, Message.session_id == ChatSession.id)
        .where(Message.created_at >= cutoff)
        .where(Message.role == "user")
        .where(ChatSession.user_id.in_(select(cohort_user_ids.c.id)))
        .group_by(ChatSession.user_id)
        .subquery()
    )
    five_message_users = await db.scalar(
        select(func.count())
        .select_from(power_user_sq)
        .where(power_user_sq.c.message_count >= 5)
    )

    event_rows = (
        await db.execute(
            select(
                ProductEvent.event_name,
                func.count(ProductEvent.id).label("events"),
                func.count(func.distinct(ProductEvent.user_id)).label("users"),
            )
            .where(ProductEvent.created_at >= cutoff)
            .where(ProductEvent.user_id.in_(select(cohort_user_ids.c.id)))
            .group_by(ProductEvent.event_name)
        )
    ).all()
    event_counts = {
        r.event_name: {"events": int(r.events), "users": int(r.users)}
        for r in event_rows
    }

    reason_rows = (
        await db.execute(
            select(
                ProductEvent.event_name,
                ProductEvent.reason,
                ProductEvent.source,
                ProductEvent.plan,
                func.count(ProductEvent.id).label("events"),
                func.count(func.distinct(ProductEvent.user_id)).label("users"),
            )
            .where(ProductEvent.created_at >= cutoff)
            .where(ProductEvent.user_id.in_(select(cohort_user_ids.c.id)))
            .where(
                ProductEvent.event_name.in_(PAID_INTENT_EVENTS)
            )
            .group_by(ProductEvent.event_name, ProductEvent.reason, ProductEvent.source, ProductEvent.plan)
            .order_by(func.count(ProductEvent.id).desc())
            .limit(50)
        )
    ).all()
    event_tracking_started_at = await db.scalar(select(func.min(ProductEvent.created_at)))

    stages = [
        {"key": "signup", "label": "Signups", "users": int(signups or 0)},
        {"key": "first_upload", "label": "Uploaded document", "users": int(upload_users or 0)},
        {"key": "first_session", "label": "Created chat session", "users": int(session_users or 0)},
        {"key": "first_chat", "label": "Sent chat message", "users": int(chat_users or 0)},
        {"key": "five_chats", "label": "5+ chat messages", "users": int(five_message_users or 0)},
        {"key": "upgrade_nudge_shown", "label": "Saw upgrade reminder", "users": event_counts.get("upgrade_nudge_shown", {}).get("users", 0)},
        {"key": "limit_hit", "label": "Hit paid limit", "users": event_counts.get("limit_hit", {}).get("users", 0)},
        {"key": "paywall_opened", "label": "Saw blocking paywall", "users": event_counts.get("paywall_opened", {}).get("users", 0)},
        {"key": "billing_view", "label": "Viewed billing", "users": event_counts.get("billing_view", {}).get("users", 0)},
        {"key": "upgrade_click", "label": "Clicked upgrade", "users": event_counts.get("upgrade_click", {}).get("users", 0)},
        {"key": "checkout_created", "label": "Checkout created", "users": event_counts.get("checkout_created", {}).get("users", 0)},
        {"key": "checkout_completed", "label": "Checkout completed", "users": event_counts.get("checkout_completed", {}).get("users", 0)},
        {"key": "subscription_cancel_requested", "label": "Canceled paid plan", "users": event_counts.get("subscription_cancel_requested", {}).get("users", 0)},
        {"key": "refund_requested", "label": "Requested refund", "users": event_counts.get("refund_requested", {}).get("users", 0)},
    ]

    return {
        "days": days,
        "since": cutoff.isoformat(),
        "cohort": "signups",
        "event_tracking_started_at": event_tracking_started_at.isoformat() if event_tracking_started_at else None,
        "stages": stages,
        "event_counts": event_counts,
        "reasons": [_paid_intent_payload(r) for r in reason_rows],
    }


def _metadata_number(metadata: dict[str, Any], key: str) -> float:
    value = metadata.get(key)
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value))
    except (TypeError, ValueError):
        return 0.0


RAG_ISSUE_DEFINITIONS = [
    {
        "key": "uncited_claims",
        "metadata_key": "uncited_claim_count",
        "label": "Answer includes statements without citations",
        "description": "The answer made factual claims that were not tied to any source marker.",
    },
    {
        "key": "weak_source_match",
        "metadata_key": "low_overlap_citation_count",
        "label": "Citations do not closely match the answer",
        "description": "A citation exists, but the cited passage does not share enough evidence with the claim.",
    },
    {
        "key": "number_mismatch",
        "metadata_key": "numeric_mismatch_citation_count",
        "label": "Numbers, dates, or percentages may not match the source",
        "description": "The answer cited evidence, but a numeric value in the answer was not found in that source.",
    },
    {
        "key": "broken_citation",
        "metadata_key": "invalid_citation_count",
        "label": "Citation points to a missing source",
        "description": "The answer referenced a source number that was not available in the retrieved evidence.",
    },
]

RAG_STATUS_LABELS = {
    "pass": "Grounded",
    "warn": "Needs review",
    "fail": "Citation failed",
    "unknown": "Not classified",
}

RAG_ROUTE_LABELS = {
    "document_summary": "Whole-document summary",
    "section_summary": "Section summary",
    "summary": "Summary question",
    "comparison": "Comparison question",
    "table_query": "Table or metrics question",
    "citation_lookup": "Source lookup",
    "existence_check": "Existence check",
    "exhaustive_scan": "Broad scan question",
    "local_qa": "Question about one document",
    "multi_doc_qa": "Question across documents",
    "unknown": "Unknown question type",
}

RAG_STRATEGY_LABELS = {
    "semantic_top_k": "Direct passage search",
    "semantic_top_k+lexical_correction": "Fallback keyword search after weak match",
    "semantic_top_k+table": "Passage and table search",
    "document_summary_context": "Whole-document summary context",
    "collection_summary_context": "Multi-document summary context",
    "continuation": "Continued long answer",
    "unknown": "Unknown retrieval path",
}

RAG_STRATEGY_DESCRIPTIONS = {
    "semantic_top_k": "The system used the most similar passages from vector search.",
    "semantic_top_k+lexical_correction": "Semantic search looked weak, so the system added keyword-based retrieval.",
    "semantic_top_k+table": "The system combined text passages with structured table evidence.",
    "document_summary_context": "The system selected representative sections for a broad document summary.",
    "collection_summary_context": "The system selected representative sections across multiple documents.",
    "continuation": "The answer continued a previous response and reused its existing citations.",
}


def _rag_status_label(status: str | None) -> str:
    return RAG_STATUS_LABELS.get(str(status or "unknown").lower(), "Not classified")


def _rag_route_label(route: str | None) -> str:
    return RAG_ROUTE_LABELS.get(str(route or "unknown"), _humanize_code(route) or "Unknown question type")


def _rag_strategy_label(strategy: str | None) -> str:
    return RAG_STRATEGY_LABELS.get(str(strategy or "unknown"), _humanize_code(strategy) or "Unknown retrieval path")


def _rag_strategy_description(strategy: str | None) -> str:
    return RAG_STRATEGY_DESCRIPTIONS.get(str(strategy or ""), "The retrieval path is not classified yet.")


def _rag_main_issue(metadata: dict[str, Any]) -> dict[str, str] | None:
    ranked = sorted(
        (
            (int(_metadata_number(metadata, issue["metadata_key"])), issue)
            for issue in RAG_ISSUE_DEFINITIONS
        ),
        key=lambda item: item[0],
        reverse=True,
    )
    count, issue = ranked[0]
    if count <= 0:
        return None
    return {
        "key": str(issue["key"]),
        "label": str(issue["label"]),
        "description": str(issue["description"]),
    }


RAG_QUALITY_SAMPLE_LIMIT = 1000


@router.get("/rag-quality")
async def admin_rag_quality(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
    days: int = Query(30, ge=1, le=365),
):
    """RAG answer verification quality snapshot."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (
        await db.execute(
            select(ProductEvent)
            .where(ProductEvent.event_name == "rag_verification_completed")
            .where(ProductEvent.created_at >= cutoff)
            .order_by(ProductEvent.created_at.desc())
            .limit(RAG_QUALITY_SAMPLE_LIMIT)
        )
    ).scalars().all()

    status_counts = {"pass": 0, "warn": 0, "fail": 0, "unknown": 0}
    score_total = 0.0
    uncited_claims = 0
    invalid_citations = 0
    low_overlap_citations = 0
    numeric_mismatch_citations = 0
    issue_breakdown = {
        str(issue["key"]): {
            "key": str(issue["key"]),
            "label": str(issue["label"]),
            "description": str(issue["description"]),
            "count": 0,
            "affected_answers": 0,
        }
        for issue in RAG_ISSUE_DEFINITIONS
    }
    strategy_breakdown: dict[str, dict[str, Any]] = {}
    for event in rows:
        metadata = event.metadata_json or {}
        status = str(metadata.get("status") or event.reason or "unknown").lower()
        if status not in status_counts:
            status = "unknown"
        status_counts[status] += 1
        score = _metadata_number(metadata, "score")
        score_total += score
        uncited_claims += int(_metadata_number(metadata, "uncited_claim_count"))
        invalid_citations += int(_metadata_number(metadata, "invalid_citation_count"))
        low_overlap_citations += int(_metadata_number(metadata, "low_overlap_citation_count"))
        numeric_mismatch_citations += int(_metadata_number(metadata, "numeric_mismatch_citation_count"))

        for issue in RAG_ISSUE_DEFINITIONS:
            issue_count = int(_metadata_number(metadata, str(issue["metadata_key"])))
            issue_item = issue_breakdown[str(issue["key"])]
            issue_item["count"] = int(issue_item["count"]) + issue_count
            if issue_count > 0:
                issue_item["affected_answers"] = int(issue_item["affected_answers"]) + 1

        strategy = str(metadata.get("retrieval_strategy") or "unknown")
        strategy_item = strategy_breakdown.setdefault(
            strategy,
            {
                "key": strategy,
                "label": _rag_strategy_label(strategy),
                "description": _rag_strategy_description(strategy),
                "answers": 0,
                "needs_review": 0,
                "score_total": 0.0,
            },
        )
        strategy_item["answers"] = int(strategy_item["answers"]) + 1
        strategy_item["score_total"] = float(strategy_item["score_total"]) + score
        if status in {"warn", "fail"}:
            strategy_item["needs_review"] = int(strategy_item["needs_review"]) + 1

    total = len(rows)
    health_label = "No answers evaluated yet"
    health_explanation = "RAG answer quality tracking has not recorded answers in this window."
    if total:
        if status_counts["fail"] > 0 or status_counts["warn"] / total >= 0.25:
            health_label = "Needs attention"
            health_explanation = "Many answers had citation or source-support issues. Review the issue breakdown before optimizing conversion."
        elif status_counts["warn"] > 0:
            health_label = "Mostly grounded, some answers need review"
            health_explanation = "Most answers passed, but some had weak citations or unsupported statements."
        else:
            health_label = "Grounded"
            health_explanation = "Recent answers passed citation verification."

    strategy_rows = []
    for item in strategy_breakdown.values():
        answers = int(item["answers"])
        strategy_rows.append({
            "key": item["key"],
            "label": item["label"],
            "description": item["description"],
            "answers": answers,
            "needs_review": int(item["needs_review"]),
            "needs_review_rate": _rate(int(item["needs_review"]), answers),
            "average_score": round(float(item["score_total"]) / answers, 3) if answers else 0.0,
        })
    strategy_rows.sort(key=lambda item: item["answers"], reverse=True)

    issue_rows = sorted(
        issue_breakdown.values(),
        key=lambda item: (int(item["count"]), int(item["affected_answers"])),
        reverse=True,
    )

    return {
        "days": days,
        "since": cutoff.isoformat(),
        "sample_limit": RAG_QUALITY_SAMPLE_LIMIT,
        "is_sampled": total >= RAG_QUALITY_SAMPLE_LIMIT,
        "evaluated_answers": total,
        "health_label": health_label,
        "health_explanation": health_explanation,
        "average_score": round(score_total / total, 3) if total else 0.0,
        "pass_rate": round(status_counts["pass"] / total, 3) if total else 0.0,
        "warn_rate": round(status_counts["warn"] / total, 3) if total else 0.0,
        "fail_rate": round(status_counts["fail"] / total, 3) if total else 0.0,
        "status_counts": status_counts,
        "uncited_claims": uncited_claims,
        "invalid_citations": invalid_citations,
        "low_overlap_citations": low_overlap_citations,
        "numeric_mismatch_citations": numeric_mismatch_citations,
        "issue_breakdown": issue_rows,
        "strategy_breakdown": strategy_rows,
        "recent": [
            {
                "created_at": event.created_at.isoformat() if event.created_at else None,
                "status": str((event.metadata_json or {}).get("status") or event.reason or "unknown"),
                "status_label": _rag_status_label(str((event.metadata_json or {}).get("status") or event.reason or "unknown")),
                "score": _metadata_number(event.metadata_json or {}, "score"),
                "route": (event.metadata_json or {}).get("route"),
                "route_label": _rag_route_label((event.metadata_json or {}).get("route")),
                "strategy": (event.metadata_json or {}).get("retrieval_strategy"),
                "strategy_label": _rag_strategy_label((event.metadata_json or {}).get("retrieval_strategy")),
                "main_issue": _rag_main_issue(event.metadata_json or {}),
                "claim_count": int(_metadata_number(event.metadata_json or {}, "claim_count")),
                "citation_count": int(_metadata_number(event.metadata_json or {}, "citation_count")),
                "uncited_claim_count": int(_metadata_number(event.metadata_json or {}, "uncited_claim_count")),
                "numeric_mismatch_citation_count": int(
                    _metadata_number(event.metadata_json or {}, "numeric_mismatch_citation_count")
                ),
            }
            for event in rows[:20]
        ],
    }


@router.get("/recent-users", response_model=AdminRecentUsersResponse)
async def admin_recent_users(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Latest signups with activity stats."""
    # Subqueries for per-user counts
    doc_count_sq = (
        select(func.count(Document.id))
        .where(Document.user_id == User.id)
        .correlate(User)
        .scalar_subquery()
    )
    msg_count_sq = (
        select(func.count(Message.id))
        .join(ChatSession, Message.session_id == ChatSession.id)
        .join(Document, ChatSession.document_id == Document.id)
        .where(Document.user_id == User.id)
        .correlate(User)
        .scalar_subquery()
    )

    q = (
        select(
            User.id,
            User.email,
            User.name,
            User.plan,
            User.credits_balance,
            User.created_at,
            doc_count_sq.label("doc_count"),
            msg_count_sq.label("message_count"),
        )
        .order_by(User.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = (await db.execute(q)).all()
    return {
        "users": [
            {
                "id": str(r.id),
                "email": r.email,
                "name": r.name,
                "plan": r.plan,
                "credits_balance": r.credits_balance,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "doc_count": r.doc_count or 0,
                "message_count": r.message_count or 0,
            }
            for r in rows
        ]
    }


@router.get("/top-users", response_model=AdminTopUsersResponse)
async def admin_top_users(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    by: str = Query("tokens", regex="^(tokens|credits|documents)$"),
):
    """Power users ranked by tokens, credits, or document count."""
    if by == "documents":
        doc_count_sq = (
            select(func.count(Document.id))
            .where(Document.user_id == User.id)
            .correlate(User)
            .scalar_subquery()
        )
        q = (
            select(
                User.id, User.email, User.name, User.plan,
                func.coalesce(
                    select(func.sum(UsageRecord.total_tokens))
                    .where(UsageRecord.user_id == User.id)
                    .correlate(User)
                    .scalar_subquery(), 0
                ).label("total_tokens"),
                func.coalesce(
                    select(func.sum(UsageRecord.cost_credits))
                    .where(UsageRecord.user_id == User.id)
                    .correlate(User)
                    .scalar_subquery(), 0
                ).label("total_credits"),
                doc_count_sq.label("doc_count"),
            )
            .order_by(doc_count_sq.desc())
            .limit(limit)
            .offset(offset)
        )
    else:
        order_col = UsageRecord.total_tokens if by == "tokens" else UsageRecord.cost_credits
        q = (
            select(
                User.id, User.email, User.name, User.plan,
                func.coalesce(func.sum(UsageRecord.total_tokens), 0).label("total_tokens"),
                func.coalesce(func.sum(UsageRecord.cost_credits), 0).label("total_credits"),
                func.coalesce(
                    select(func.count(Document.id))
                    .where(Document.user_id == User.id)
                    .correlate(User)
                    .scalar_subquery(), 0
                ).label("doc_count"),
            )
            .outerjoin(UsageRecord, UsageRecord.user_id == User.id)
            .group_by(User.id, User.email, User.name, User.plan)
            .order_by(func.coalesce(func.sum(order_col), 0).desc())
            .limit(limit)
            .offset(offset)
        )

    rows = (await db.execute(q)).all()
    return {
        "users": [
            {
                "id": str(r.id),
                "email": r.email,
                "name": r.name,
                "plan": r.plan,
                "total_tokens": int(r.total_tokens),
                "total_credits": int(r.total_credits),
                "doc_count": int(r.doc_count),
            }
            for r in rows
        ]
    }
