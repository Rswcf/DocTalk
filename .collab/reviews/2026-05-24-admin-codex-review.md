warning: `--full-auto` is deprecated; use `--sandbox workspace-write` instead.
Reading prompt from stdin...
2026-05-24T11:56:38.556703Z ERROR codex_core::session::session: failed to load skill /Users/mayijie/Projects/Code/010_DocTalk/.agents/skills/deploy/SKILL.md: missing YAML frontmatter delimited by ---
2026-05-24T11:56:38.556738Z ERROR codex_core::session::session: failed to load skill /Users/mayijie/Projects/Code/010_DocTalk/.agents/skills/codex-implement/SKILL.md: missing YAML frontmatter delimited by ---
OpenAI Codex v0.133.0
--------
workdir: /Users/mayijie/Projects/Code/010_DocTalk
model: gpt-5.5
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR]
reasoning effort: xhigh
reasoning summaries: none
session id: 019e59d8-269d-71b2-8598-62b80f19fb6d
--------
user
# 角色:对抗式代码审查 — DocTalk admin 分析看板(6 tab,留存+流失)
我(Claude)+你(上一轮网络中断,我补完了 tab 容器)实现了新 admin 看板。后端 416 passed、ruff、tsc 干净。请**对抗式复审**,不要盖章。你不能 git。
## surface
- diff:`.collab/reviews/2026-05-24-admin-dashboard-diff.patch`;spec:`.collab/plans/2026-05-24-admin-dashboard-redesign-spec.md`
- 现网:`backend/app/api/admin.py`(admin_retention/admin_churn)、`schemas/admin.py`、`frontend/src/app/admin/AdminPageClient.tsx`、`frontend/src/components/admin/*`
- 测试:`backend/tests/test_admin_retention.py`、`test_admin_churn.py`
## 重点(逐项 file:line)
1. **SQL 正确性**:cohort_grid 的"周偏移活跃"计算、D1/D7/D30 分母/分子定义、churn_signals 各信号判定(asst_zero/rag_miss/parse_failure/large_doc/export_refusal/paywall_hit)、reason_buckets 分桶逻辑是否真对;owner 排除是否覆盖所有用户级查询;时区(date_trunc/UTC)是否一致。
2. **性能**:这些查询在生产规模(数千 chunk/messages、~100 用户但会增长)是否高效?有无 N+1、全表扫描、笛卡尔积、缺索引?cohort 网格是否一次查询而非循环 12×12 次查询?
3. **鉴权/隐私**:两个新端点是否都 require_admin?是否泄露非聚合 PII(churn feedback/last_action 是否带过多个人数据)?
4. **前端**:lazy per-tab fetch 是否真的按 tab 拉(没在 mount 拉全部)?period 切换的重取是否正确失效缓存?tab 容器(我补的)有无 bug?palette 是否纯 zinc/blue 无 editorial 泄漏?
5. **数据真伪**:留存/流失数字会不会因 join/去重/空值错误而误导 PM 决策?
6. 跑 `SKIP_INTEGRATION=1 python3 -m pytest -q backend/tests/test_admin_retention.py backend/tests/test_admin_churn.py`。
## 输出:Must-fix/Should-fix/Nit(file:line+可证伪+建议),最后给「可否合并 main」。

codex
我会按 review 模式处理：先读 spec/diff 建立预期，再对照后端 SQL、schemas、前端 tab/fetch 逻辑和测试，最后跑你指定的 pytest。不会使用 git。
  → Read spec, patch, and affected files
  • Audit backend SQL/auth/privacy/performance
  • Audit frontend tab fetch/cache/palette
  • Run targeted retention/churn tests
  • Write adversarial findings with merge recommendation
exec
/bin/zsh -lc "sed -n '1,260p' .collab/plans/2026-05-24-admin-dashboard-redesign-spec.md" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "sed -n '1,260p' .collab/reviews/2026-05-24-admin-dashboard-diff.patch" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
# Admin Analytics Dashboard Redesign — Spec (approved 2026-05-24)

**Goal:** Rebuild the admin dashboard into a tabbed SaaS product-analytics console (AARRR + churn diagnosis), centered on **retention** and **why users don't retain**. Beautified, app zinc/blue palette, light/dark.

## Approach
- Restructure `frontend/src/app/admin/AdminPageClient.tsx` (currently one long page) into a **tabbed** dashboard. Reuse the working panels/endpoints; add 2 new backend endpoints + 2 new tabs; beautify.
- Backend: keep `/overview /trends /breakdowns /user-activity /funnel /rag-quality /billing-health /recent-users /top-users`; **add `/admin/retention` and `/admin/churn`**.
- Admin-auth gated (existing `require_admin`). All read-only. Queries must be efficient on prod-size data (index-friendly; bounded windows).
- i18n: all labels via `tOr(key, 'English fallback')` (11 locales). Palette: zinc + blue `#1D4ED8`, NO editorial/terracotta. Charts: Recharts (already a dep).

## Tabs
1. **Overview** — north-star KPI cards (signups, WAU, MAU, stickiness DAU/MAU, activation %, paid-conversion %, asst=0 rate) each with period-over-period delta arrow + sparkline; reuse `/overview` + small additions.
2. **Activation** — funnel signup→upload→first-chat→engaged(≥3) with per-step drop-off %, time-to-activate (median/p90), by signup cohort; reuse `/funnel` + `/user-activity`.
3. **Retention** ⭐ — NEW `/admin/retention`.
4. **Why-not-retained** ⭐⭐ — NEW `/admin/churn`.
5. **Revenue** — monetization funnel, MRR, plan mix, credit usage, cancels/refunds; reuse `/funnel` + `/billing-health`.
6. **Product/Quality** — RAG citation quality, retrieval-strategy usage (page_lookup/summary), reliability (sent vs completed, asst=0 sessions), feature adoption (export/collections/domain modes), parse success rate, doc-size mix; reuse `/rag-quality` + new small queries.

## NEW endpoint: `GET /api/admin/retention`
Exclude owner/admin accounts. Activity = a user-role message (join sessions.user_id).
Response:
- `cohort_grid`: last 12 signup-week cohorts × week-offset 0..11 → `{cohort_week, cohort_size, retention: [{week_offset, active_users, pct}]}` (the heatmap).
- `curves`: D1/D7/D30 retention of activated users (% who returned within N days of first activity).
- `dau_wau_mau`: last 30d daily DAU series + WAU + MAU + stickiness (DAU/MAU %).
- `by_segment`: retention (% with ≥2 active days) split by plan (free/plus/pro), doc-size bucket (small <40p / mid 40-150 / large ≥150p, by the user's largest uploaded doc), and locale (top 6).
- `weekly_flow`: per week new / retained / resurrected / churned counts.

## NEW endpoint: `GET /api/admin/churn`
"Churned" = activated user with no activity in the last 14 days (configurable). Exclude owner.
Response:
- `one_and_done`: count + pct of activated users with exactly 1 active day.
- `churn_signals`: among churned users, prevalence (count + pct) of each failure signal experienced before churn:
  - `asst_zero` (a session with user msg but 0 assistant), `rag_miss` (assistant msg with empty citations OR multilingual "can't find" regex), `parse_failure` (any doc status='error'/'ocr'), `large_doc` (uploaded a doc ≥150p), `export_refusal` (asked export but no export artifact), `paywall_hit` (paywall_opened/limit_hit then churned).
- `last_action`: distribution of each churned user's final event/message category (e.g., asst=0, rag_miss, normal-answer, paywall, upload).
- `feedback`: recent `user_feedback` rows (type/area/severity/message/plan/created_at), + counts by area/severity.
- `cancel_reasons`: `plan_transitions` to_plan downgrades with metadata reason/feedback.
- `reason_buckets`: heuristic categorization of churned users into {coverage_fail, page_fail, export, parse, capability_refusal, one_off_success} using the signals above (mirrors the 2026-05-23 47-user manual analysis).

## Frontend
- New `AdminTabs` nav (sticky, keyboard accessible, URL hash `#retention` so tabs are linkable). Lazy-fetch each tab's data on first open (don't fetch all 9 endpoints upfront).
- Components: `KPICard` (with delta arrow + sparkline), `RetentionHeatmap` (cohort grid, color scale on % — zinc→blue), `RetentionCurves` (line), `ChurnSignalsBars`, `ReasonBucketsDonut`, `FeedbackList`. Reuse existing FunnelPanel/RagQualityPanel/BillingHealthPanel into their tabs.
- Loading + empty + error states per tab (no blank panels). Numbers `tabular-nums`. Light/dark.
- Keep `AdminPageClient.tsx` from growing unbounded: split tab contents into `frontend/src/components/admin/<Tab>.tsx`.

## Testing
- Backend: `tests/test_admin_retention.py`, `tests/test_admin_churn.py` — fake/seeded data asserting cohort grid shape, D1/D7/D30 math, churn-signal prevalence, reason bucketing, owner exclusion. Follow existing `test_admin_*` patterns.
- Frontend: `tsc` clean; production `next build` green (isolated worktree — dev server runs locally).

## Constraints / acceptance
- `SKIP_INTEGRATION=1 pytest -q` = 0 failed; `ruff check app/ tests/` clean; `tsc` clean; `next build` green.
- No new heavy deps. Recharts only. No editorial palette leakage. Admin-auth enforced on new endpoints.
- Efficient queries (bounded time windows, no N+1). Owner/admin excluded from user metrics.

 succeeded in 0ms:
diff --git a/backend/app/api/admin.py b/backend/app/api/admin.py
index 3bb393a..11c8f24 100644
--- a/backend/app/api/admin.py
+++ b/backend/app/api/admin.py
@@ -3,12 +3,14 @@
 from __future__ import annotations
 
 import asyncio
-from datetime import datetime, timedelta, timezone
+import re
+from collections import Counter, defaultdict
+from datetime import date, datetime, timedelta, timezone
 from typing import Any
 
 import stripe
 from fastapi import APIRouter, Depends, Query
-from sqlalchemy import case, func, select, text, union_all
+from sqlalchemy import String, case, cast, func, or_, select, text, union_all
 from sqlalchemy.ext.asyncio import AsyncSession
 
 from app.core.cache import cache_get, cache_set
@@ -19,6 +21,7 @@ from app.models.tables import (
     CreditLedger,
     Document,
     Message,
+    PlanTransition,
     ProductEvent,
     UsageRecord,
     User,
@@ -26,8 +29,10 @@ from app.models.tables import (
 )
 from app.schemas.admin import (
     AdminBreakdownsResponse,
+    AdminChurnResponse,
     AdminOverviewResponse,
     AdminRecentUsersResponse,
+    AdminRetentionResponse,
     AdminTopUsersResponse,
     AdminTrendsResponse,
     AdminUserActivityResponse,
@@ -96,6 +101,48 @@ PAID_SOURCE_LABELS = {
     "pricing_hero": "Pricing page hero",
 }
 
+INTERNAL_OWNER_USER_IDS = {"c142f3af-6e6b-488d-ba57-d91aa3e57cc7"}
+RETENTION_WEEKS = 12
+RETENTION_OFFSETS = 12
+RETENTION_DAYS = (1, 7, 30)
+RETENTION_LOOKBACK_DAYS = 395
+CHURN_LOOKBACK_DAYS = 395
+CHURN_SIGNAL_KEYS = (
+    "asst_zero",
+    "rag_miss",
+    "parse_failure",
+    "large_doc",
+    "export_refusal",
+    "paywall_hit",
+)
+CHURN_SIGNAL_LABELS = {
+    "asst_zero": "Assistant zero-response session",
+    "rag_miss": "Retrieval or coverage miss",
+    "parse_failure": "Parse/OCR failure",
+    "large_doc": "Large document uploaded",
+    "export_refusal": "Export requested without artifact",
+    "paywall_hit": "Paywall or plan limit hit",
+}
+REASON_BUCKET_LABELS = {
+    "coverage_fail": "Coverage failed",
+    "page_fail": "Page lookup failed",
+    "export": "Export blocked",
+    "parse": "Parse failure",
+    "capability_refusal": "Capability refusal",
+    "one_off_success": "One-off success",
+}
+EXPORT_REQUEST_RE = re.compile(r"\b(export|download|csv|excel|xlsx)\b|导出|下载|表格文件", re.IGNORECASE)
+PAGE_REQUEST_RE = re.compile(r"\b(page|p\.\s*\d+|page\s+\d+)\b|第\s*\d+\s*页|页面", re.IGNORECASE)
+RAG_MISS_RE = re.compile(
+    r"can't find|cannot find|could not find|not found|no relevant|not in (?:the )?document|"
+    r"无法找到|找不到|未找到|找不到相关|見つ|찾을 수|no encontr|nicht gefunden|introuv",
+    re.IGNORECASE,
+)
+CAPABILITY_REFUSAL_RE = re.compile(
+    r"\b(can't|cannot|unable to|not able to|not supported|do not support)\b|无法|不能|不支持",
+    re.IGNORECASE,
+)
+
 
 def _humanize_code(value: str | None) -> str | None:
     if not value:
@@ -168,6 +215,500 @@ def _date_label(value: Any) -> str:
     return str(value)[:10]
 
 
+def _row_value(row: Any, key: str, default: Any = None) -> Any:
+    if isinstance(row, dict):
+        return row.get(key, default)
+    return getattr(row, key, default)
+
+
+def _as_date(value: Any) -> date:
+    if isinstance(value, datetime):
+        return value.date()
+    if hasattr(value, "year") and hasattr(value, "month") and hasattr(value, "day"):
+        return value
+    return datetime.fromisoformat(str(value)[:10]).date()
+
+
+def _week_start(value: Any) -> date:
+    day = _as_date(value)
+    return day - timedelta(days=day.weekday())
+
+
+def _admin_excluded_emails(admin_emails: set[str] | None = None) -> set[str]:
+    if admin_emails is not None:
+        return {email.strip().lower() for email in admin_emails if email and email.strip()}
+    return {email.strip().lower() for email in settings.ADMIN_EMAILS.split(",") if email.strip()}
+
+
+def _default_excluded_user_ids(excluded_user_ids: set[str] | None = None) -> set[str]:
+    if excluded_user_ids is not None:
+        return {str(user_id) for user_id in excluded_user_ids if user_id}
+    return set(INTERNAL_OWNER_USER_IDS)
+
+
+def _eligible_user_conditions() -> list[Any]:
+    conditions: list[Any] = []
+    excluded_emails = _admin_excluded_emails()
+    if excluded_emails:
+        conditions.append(~func.lower(User.email).in_(excluded_emails))
+    if INTERNAL_OWNER_USER_IDS:
+        conditions.append(~cast(User.id, String).in_(INTERNAL_OWNER_USER_IDS))
+    return conditions
+
+
+def _is_excluded_user(row: Any, excluded_user_ids: set[str], admin_emails: set[str]) -> bool:
+    user_id = _row_value(row, "id", _row_value(row, "user_id"))
+    email = _row_value(row, "email")
+    return str(user_id) in excluded_user_ids or (isinstance(email, str) and email.lower() in admin_emails)
+
+
+def _eligible_user_map(
+    users: list[Any],
+    excluded_user_ids: set[str] | None = None,
+    admin_emails: set[str] | None = None,
+) -> dict[str, Any]:
+    excluded_ids = _default_excluded_user_ids(excluded_user_ids)
+    excluded_emails = _admin_excluded_emails(admin_emails)
+    return {
+        str(_row_value(user, "id")): user
+        for user in users
+        if _row_value(user, "id") is not None
+        and not _is_excluded_user(user, excluded_ids, excluded_emails)
+    }
+
+
+def _doc_size_bucket(page_count: Any) -> str:
+    if page_count is None:
+        return "unknown"
+    pages = int(page_count or 0)
+    if pages >= 150:
+        return "large"
+    if pages >= 40:
+        return "mid"
+    return "small"
+
+
+def _doc_size_label(bucket: str) -> str:
+    return {
+        "small": "Small (<40p)",
+        "mid": "Mid (40-150p)",
+        "large": "Large (>=150p)",
+        "unknown": "Unknown",
+    }.get(bucket, _humanize_code(bucket) or bucket)
+
+
+def _segment_payload(
+    values_by_user: dict[str, str],
+    active_users: set[str],
+    retained_users: set[str],
+    *,
+    labeler: Any = _humanize_code,
+    limit: int | None = None,
+    order: list[str] | None = None,
+) -> list[dict[str, Any]]:
+    buckets: dict[str, set[str]] = defaultdict(set)
+    for user_id in active_users:
+        buckets[values_by_user.get(user_id, "unknown") or "unknown"].add(user_id)
+    keys = list(buckets)
+    if order:
+        order_map = {key: index for index, key in enumerate(order)}
+        keys.sort(key=lambda key: (order_map.get(key, len(order_map)), key))
+    else:
+        keys.sort(key=lambda key: (-len(buckets[key]), key))
+    if limit is not None:
+        keys = keys[:limit]
+    return [
+        {
+            "key": key,
+            "label": labeler(key) or key,
+            "users": len(buckets[key]),
+            "retained_users": len(buckets[key] & retained_users),
+            "pct": _rate(len(buckets[key] & retained_users), len(buckets[key])),
+        }
+        for key in keys
+    ]
+
+
+def _activity_dates_by_user(activity_days: list[Any], eligible_users: set[str]) -> dict[str, set[date]]:
+    active: dict[str, set[date]] = defaultdict(set)
+    for row in activity_days:
+        user_id = str(_row_value(row, "user_id"))
+        if user_id in eligible_users:
+            active[user_id].add(_as_date(_row_value(row, "activity_date")))
+    return active
+
+
+def _build_retention_payload(
+    *,
+    now: datetime,
+    users: list[Any],
+    activity_days: list[Any],
+    document_segments: list[Any],
+    locale_segments: list[Any],
+    excluded_user_ids: set[str] | None = None,
+    admin_emails: set[str] | None = None,
+) -> dict[str, Any]:
+    eligible_users = _eligible_user_map(users, excluded_user_ids, admin_emails)
+    eligible_user_ids = set(eligible_users)
+    active_dates_by_user = _activity_dates_by_user(activity_days, eligible_user_ids)
+    activated_user_ids = {user_id for user_id, dates in active_dates_by_user.items() if dates}
+    retained_user_ids = {user_id for user_id, dates in active_dates_by_user.items() if len(dates) >= 2}
+
+    current_week = _week_start(now)
+    cohort_weeks = [
+        current_week - timedelta(weeks=RETENTION_WEEKS - 1 - index)
+        for index in range(RETENTION_WEEKS)
+    ]
+    cohort_users: dict[date, set[str]] = {week: set() for week in cohort_weeks}
+    for user_id, user in eligible_users.items():
+        cohort_week = _week_start(_row_value(user, "created_at"))
+        if cohort_week in cohort_users:
+            cohort_users[cohort_week].add(user_id)
+
+    active_weeks_by_user = {
+        user_id: {_week_start(active_date) for active_date in active_dates}
+        for user_id, active_dates in active_dates_by_user.items()
+    }
+    cohort_grid = []
+    for cohort_week in cohort_weeks:
+        users_in_cohort = cohort_users[cohort_week]
+        retention = []
+        for week_offset in range(RETENTION_OFFSETS):
+            target_week = cohort_week + timedelta(weeks=week_offset)
+            active_users = {
+                user_id
+                for user_id in users_in_cohort
+                if target_week in active_weeks_by_user.get(user_id, set())
+            }
+            retention.append({
+                "week_offset": week_offset,

exec
/bin/zsh -lc 'rg --files backend/tests frontend/src/components/admin frontend/src/app/admin backend/app/api backend/app/schemas' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
backend/app/api/document_diffs.py
backend/app/api/chunks.py
backend/app/api/credits.py
backend/app/api/document_jobs.py
backend/app/api/tables.py
backend/app/api/search.py
backend/app/api/question_templates.py
backend/app/api/collections.py
backend/app/api/admin.py
backend/app/api/chat.py
backend/app/api/export.py
backend/app/api/__init__.py
backend/app/api/documents.py
backend/app/api/feedback.py
backend/app/api/events.py
backend/app/api/users.py
backend/app/api/billing.py
backend/app/api/extractions.py
backend/app/api/sharing.py
backend/app/api/auth.py
frontend/src/components/admin/ChurnSignalsBars.tsx
frontend/src/components/admin/RetentionCurves.tsx
frontend/src/components/admin/FeedbackList.tsx
frontend/src/components/admin/RevenueTab.tsx
frontend/src/components/admin/ChurnTab.tsx
frontend/src/components/admin/ProductTab.tsx
frontend/src/components/admin/types.ts
frontend/src/components/admin/AdminPanels.tsx
frontend/src/components/admin/ReasonBucketsDonut.tsx
frontend/src/components/admin/RetentionHeatmap.tsx
frontend/src/components/admin/OverviewTab.tsx
frontend/src/components/admin/ActivationTab.tsx
frontend/src/components/admin/RetentionTab.tsx
frontend/src/components/admin/KPICard.tsx
backend/app/schemas/search.py
backend/app/schemas/document.py
backend/app/schemas/common.py
backend/app/schemas/admin.py
backend/app/schemas/chat.py
backend/app/schemas/__init__.py
backend/app/schemas/feedback.py
backend/app/schemas/users.py
backend/app/schemas/billing.py
backend/app/schemas/auth.py
backend/tests/test_document_diffs_api.py
backend/tests/test_corrective_retrieval_service.py
backend/tests/test_parse_worker_bridge.py
backend/tests/test_error_taxonomy.py
backend/tests/test_table_service.py
backend/tests/test_document_element_service.py
backend/tests/test_deletion_retry.py
backend/tests/test_document_brief_generation.py
backend/tests/test_query_planner_service.py
backend/tests/test_chat_summary_routing.py
backend/tests/test_events_api.py
backend/tests/test_billing_state.py
backend/tests/test_extraction_service.py
backend/tests/test_chat_corrective_retrieval.py
backend/tests/test_chat_tool_executor.py
backend/tests/test_feedback_api.py
backend/tests/test_cleanup_tasks.py
backend/tests/test_admin_churn.py
backend/tests/test_question_templates_api.py
backend/tests/test_document_access.py
backend/tests/test_tables_api.py
backend/tests/test_document_diff_service.py
backend/tests/test_rag_evaluator_service.py
backend/tests/test_url_extractor.py
backend/tests/test_admin_user_activity.py
backend/tests/test_auth_adapter.py
backend/tests/test_sharing_api.py
backend/tests/test_admin_retention.py
backend/tests/test_extractions_api.py
backend/tests/test_query_router.py
backend/tests/test_share_anchor_service.py
backend/tests/test_chat_setup_refunds.py
backend/tests/test_admin_rag_quality.py
backend/tests/test_document_intelligence.py
backend/tests/test_versioning.py
backend/tests/test_billing_cancel.py
backend/tests/test_smoke.py
backend/tests/test_document_jobs_api.py
backend/tests/test_migrations.py
backend/tests/__init__.py
backend/tests/test_credit_reconcile.py
backend/tests/test_question_template_service.py
backend/tests/test_claim_verifier_service.py
backend/tests/test_billing_logic.py
backend/tests/test_element_aware_workflows.py
backend/tests/test_storage_service.py
backend/tests/test_action_planner.py
backend/tests/test_export_service.py
backend/tests/test_document_brief_service.py
backend/tests/test_export_api.py
backend/tests/test_rrf_dynamic_k.py
backend/tests/test_retrieval_service_lexical.py
backend/tests/test_proxy_ip_verification.py
backend/tests/test_search_api.py
backend/tests/test_parse_service.py
backend/tests/test_document_briefs_api.py
backend/tests/test_retrieval_persona_baseline.py
backend/tests/test_ocr_languages_baseline.py
backend/tests/conftest.py
backend/tests/test_collections_api.py
backend/tests/test_asst0_cancellation_baseline.py
frontend/src/app/admin/page.tsx
frontend/src/app/admin/AdminPageClient.tsx

codex
spec 明确要求 cohort 网格一次性/有界、owner/admin 全局排除、lazy tab fetch。现在我先定位新增端点和组件的实际实现，再从“数字会不会骗人”的角度看 SQL/聚合边界。
exec
/bin/zsh -lc 'rg -n "retention|churn|_build_retention|_build_churn|admin_retention|admin_churn|require_admin|@router" backend/app/api/admin.py' in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "sed -n '260,620p' .collab/reviews/2026-05-24-admin-dashboard-diff.patch" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc 'rg -n "AdminRetention|AdminChurn|churn|retention" backend/app/schemas/admin.py' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
217:    retention: list[AdminUserRetentionRow]
218:    retention_explanation: str | None = None
223:class AdminRetentionCell(BaseModel):
229:class AdminRetentionCohort(BaseModel):
232:    retention: list[AdminRetentionCell]
235:class AdminRetentionCurvePoint(BaseModel):
244:class AdminRetentionDauPoint(BaseModel):
249:class AdminRetentionDauWauMau(BaseModel):
250:    series: list[AdminRetentionDauPoint]
256:class AdminRetentionSegmentItem(BaseModel):
264:class AdminRetentionSegments(BaseModel):
265:    plan: list[AdminRetentionSegmentItem]
266:    doc_size: list[AdminRetentionSegmentItem]
267:    locale: list[AdminRetentionSegmentItem]
270:class AdminRetentionWeeklyFlowItem(BaseModel):
275:    churned: int
278:class AdminRetentionResponse(BaseModel):
280:    cohort_grid: list[AdminRetentionCohort]
281:    curves: list[AdminRetentionCurvePoint]
282:    dau_wau_mau: AdminRetentionDauWauMau
283:    by_segment: AdminRetentionSegments
284:    weekly_flow: list[AdminRetentionWeeklyFlowItem]
287:class AdminChurnCountPct(BaseModel):
292:class AdminChurnOneAndDone(AdminChurnCountPct):
296:class AdminChurnSignalItem(AdminChurnCountPct):
301:class AdminChurnLastActionItem(AdminChurnCountPct):
306:class AdminChurnFeedbackItem(BaseModel):
316:class AdminChurnGroupCount(BaseModel):
321:class AdminChurnFeedbackSummary(BaseModel):
322:    recent: list[AdminChurnFeedbackItem]
323:    by_area: list[AdminChurnGroupCount]
324:    by_severity: list[AdminChurnGroupCount]
327:class AdminChurnCancelReasonItem(BaseModel):
337:class AdminChurnResponse(BaseModel):
340:    churned_users: int
341:    one_and_done: AdminChurnOneAndDone
342:    churn_signals: list[AdminChurnSignalItem]
343:    last_action: list[AdminChurnLastActionItem]
344:    feedback: AdminChurnFeedbackSummary
345:    cancel_reasons: list[AdminChurnCancelReasonItem]
346:    reason_buckets: list[AdminChurnSignalItem]

 succeeded in 0ms:
1:"""Admin analytics endpoints — protected by require_admin."""
18:from app.core.deps import get_db_session, require_admin
341:def _build_retention_payload(
375:        retention = []
383:            retention.append({
391:            "retention": retention,
499:            "churned": len(active_previous_week - active_this_week),
574:def _build_churn_payload(
592:    churned_user_ids = {
610:    churn_signals = []
612:        users_with_signal = normalized_signals.get(key, set()) & churned_user_ids
613:        churn_signals.append({
617:            "pct": _rate(len(users_with_signal), len(churned_user_ids)),
623:        if user_id not in churned_user_ids:
632:            "pct": _rate(count, len(churned_user_ids)),
661:    for user_id in churned_user_ids:
680:            "pct": _rate(bucket_counts.get(key, 0), len(churned_user_ids)),
688:        "churned_users": len(churned_user_ids),
690:        "churn_signals": churn_signals,
798:@router.get("/overview", response_model=AdminOverviewResponse)
800:    _admin: User = Depends(require_admin),
862:@router.get("/trends", response_model=AdminTrendsResponse)
864:    _admin: User = Depends(require_admin),
944:@router.get("/breakdowns", response_model=AdminBreakdownsResponse)
946:    _admin: User = Depends(require_admin),
998:@router.get("/user-activity", response_model=AdminUserActivityResponse)
1000:    _admin: User = Depends(require_admin),
1005:    """Composite user activity, retention, paid intent, and feedback analytics."""
1344:    retention_rows = (
1392:    retention = [
1405:        for row in retention_rows
1407:    retention_explanation = None
1408:    if not retention:
1409:        retention_explanation = "No signup cohorts in the selected window."
1411:        retention_explanation = "D30 retention is incomplete for windows shorter than 30 days."
1519:        "retention": retention,
1520:        "retention_explanation": retention_explanation,
1544:@router.get("/retention", response_model=AdminRetentionResponse)
1545:async def admin_retention(
1546:    _admin: User = Depends(require_admin),
1620:    return _build_retention_payload(
1629:@router.get("/churn", response_model=AdminChurnResponse)
1630:async def admin_churn(
1631:    _admin: User = Depends(require_admin),
1881:    return _build_churn_payload(
1893:@router.get("/billing-health")
1896:    _admin: User = Depends(require_admin),
1932:@router.get("/funnel")
1934:    _admin: User = Depends(require_admin),
2161:@router.get("/rag-quality")
2163:    _admin: User = Depends(require_admin),
2309:@router.get("/recent-users", response_model=AdminRecentUsersResponse)
2311:    _admin: User = Depends(require_admin),
2366:@router.get("/top-users", response_model=AdminTopUsersResponse)
2368:    _admin: User = Depends(require_admin),

 succeeded in 0ms:
+                "week_offset": week_offset,
+                "active_users": len(active_users),
+                "pct": _rate(len(active_users), len(users_in_cohort)),
+            })
+        cohort_grid.append({
+            "cohort_week": cohort_week.isoformat(),
+            "cohort_size": len(users_in_cohort),
+            "retention": retention,
+        })
+
+    curves = []
+    for days in RETENTION_DAYS:
+        returned_users = 0
+        for active_dates in active_dates_by_user.values():
+            if not active_dates:
+                continue
+            first_active = min(active_dates)
+            if any(first_active < active_date <= first_active + timedelta(days=days) for active_date in active_dates):
+                returned_users += 1
+        curves.append({
+            "key": f"d{days}",
+            "label": f"D{days}",
+            "days": days,
+            "activated_users": len(activated_user_ids),
+            "returned_users": returned_users,
+            "pct": _rate(returned_users, len(activated_user_ids)),
+        })
+
+    today = now.date()
+    dau_series = []
+    for offset in range(29, -1, -1):
+        day = today - timedelta(days=offset)
+        dau = sum(1 for dates in active_dates_by_user.values() if day in dates)
+        dau_series.append({"date": day.isoformat(), "dau": dau})
+    wau_start = today - timedelta(days=6)
+    mau_start = today - timedelta(days=29)
+    wau_users = {
+        user_id
+        for user_id, dates in active_dates_by_user.items()
+        if any(wau_start <= active_date <= today for active_date in dates)
+    }
+    mau_users = {
+        user_id
+        for user_id, dates in active_dates_by_user.items()
+        if any(mau_start <= active_date <= today for active_date in dates)
+    }
+    dau_wau_mau = {
+        "series": dau_series,
+        "wau": len(wau_users),
+        "mau": len(mau_users),
+        "stickiness": _rate(dau_series[-1]["dau"] if dau_series else 0, len(mau_users)),
+    }
+
+    plan_by_user = {
+        user_id: str(_row_value(user, "plan") or "free")
+        for user_id, user in eligible_users.items()
+    }
+    doc_by_user = {
+        str(_row_value(row, "user_id")): _doc_size_bucket(_row_value(row, "max_page_count"))
+        for row in document_segments
+        if str(_row_value(row, "user_id")) in eligible_user_ids
+    }
+    locale_by_user = {
+        str(_row_value(row, "user_id")): str(_row_value(row, "locale") or "unknown")
+        for row in locale_segments
+        if str(_row_value(row, "user_id")) in eligible_user_ids
+    }
+    by_segment = {
+        "plan": _segment_payload(
+            plan_by_user,
+            activated_user_ids,
+            retained_user_ids,
+            labeler=lambda key: key.upper() if key in {"pro"} else key.capitalize(),
+            order=["free", "plus", "pro", "unknown"],
+        ),
+        "doc_size": _segment_payload(
+            doc_by_user,
+            activated_user_ids,
+            retained_user_ids,
+            labeler=_doc_size_label,
+            order=["small", "mid", "large", "unknown"],
+        ),
+        "locale": _segment_payload(locale_by_user, activated_user_ids, retained_user_ids, limit=6),
+    }
+
+    first_active_week = {
+        user_id: _week_start(min(active_dates))
+        for user_id, active_dates in active_dates_by_user.items()
+        if active_dates
+    }
+    activity_by_week: dict[date, set[str]] = {week: set() for week in cohort_weeks}
+    for user_id, active_weeks in active_weeks_by_user.items():
+        for active_week in active_weeks:
+            if active_week in activity_by_week:
+                activity_by_week[active_week].add(user_id)
+    weekly_flow = []
+    for week in cohort_weeks:
+        active_this_week = activity_by_week.get(week, set())
+        active_previous_week = activity_by_week.get(week - timedelta(weeks=1), set())
+        new_users = {user_id for user_id in active_this_week if first_active_week.get(user_id) == week}
+        retained = {
+            user_id
+            for user_id in active_this_week & active_previous_week
+            if first_active_week.get(user_id) != week
+        }
+        resurrected = {
+            user_id
+            for user_id in active_this_week - active_previous_week - new_users
+            if first_active_week.get(user_id) != week
+        }
+        weekly_flow.append({
+            "week": week.isoformat(),
+            "new": len(new_users),
+            "retained": len(retained),
+            "resurrected": len(resurrected),
+            "churned": len(active_previous_week - active_this_week),
+        })
+
+    return {
+        "generated_at": now.isoformat(),
+        "cohort_grid": cohort_grid,
+        "curves": curves,
+        "dau_wau_mau": dau_wau_mau,
+        "by_segment": by_segment,
+        "weekly_flow": weekly_flow,
+    }
+
+
+def _normalized_action_label(key: str) -> str:
+    labels = {
+        "asst_zero": "Assistant zero-response",
+        "rag_miss": "RAG miss",
+        "normal_answer": "Normal answer",
+        "normal-answer": "Normal answer",
+        "paywall": "Paywall or plan limit",
+        "upload": "Upload",
+        "user_message": "User message",
+        "unknown": "Unknown",
+    }
+    return labels.get(key, _humanize_code(key) or key)
+
+
+def _coerce_user_set(values: Any, eligible_user_ids: set[str]) -> set[str]:
+    if values is None:
+        return set()
+    return {str(value) for value in values if str(value) in eligible_user_ids}
+
+
+def _serialize_feedback(row: Any) -> dict[str, Any]:
+    created_at = _row_value(row, "created_at")
+    message = _row_value(row, "message")
+    return {
+        "id": str(_row_value(row, "id")),
+        "type": str(_row_value(row, "type") or "unknown"),
+        "area": str(_row_value(row, "area") or "unknown"),
+        "severity": str(_row_value(row, "severity") or "unknown"),
+        "message": str(message) if message else None,
+        "plan": _row_value(row, "plan"),
+        "created_at": created_at.isoformat() if hasattr(created_at, "isoformat") else None,
+    }
+
+
+def _group_count(rows: list[Any], key: str) -> list[dict[str, Any]]:
+    counts = Counter(str(_row_value(row, key) or "unknown") for row in rows)
+    return [
+        {"key": value, "count": count}
+        for value, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))
+    ]
+
+
+def _serialize_cancel_reason(row: Any) -> dict[str, Any]:
+    created_at = _row_value(row, "created_at")
+    metadata = _row_value(row, "metadata_json") or {}
+    reason = _row_value(row, "reason")
+    feedback = _row_value(row, "feedback")
+    if not reason and isinstance(metadata, dict):
+        reason = metadata.get("cancel_reason") or metadata.get("reason")
+    if not feedback and isinstance(metadata, dict):
+        feedback = metadata.get("cancel_feedback") or metadata.get("feedback")
+    return {
+        "id": str(_row_value(row, "id")),
+        "user_id": str(_row_value(row, "user_id")),
+        "from_plan": str(_row_value(row, "from_plan") or ""),
+        "to_plan": str(_row_value(row, "to_plan") or ""),
+        "reason": str(reason) if reason else None,
+        "feedback": str(feedback) if feedback else None,
+        "created_at": created_at.isoformat() if hasattr(created_at, "isoformat") else None,
+    }
+
+
+def _build_churn_payload(
+    *,
+    now: datetime,
+    users: list[Any],
+    activity_days: list[Any],
+    signal_users: dict[str, set[str]],
+    last_actions: list[Any],
+    feedback_rows: list[Any],
+    cancel_rows: list[Any],
+    inactive_days: int = 14,
+    excluded_user_ids: set[str] | None = None,
+    admin_emails: set[str] | None = None,
+) -> dict[str, Any]:
+    eligible_users = _eligible_user_map(users, excluded_user_ids, admin_emails)
+    eligible_user_ids = set(eligible_users)
+    active_dates_by_user = _activity_dates_by_user(activity_days, eligible_user_ids)
+    activated_user_ids = {user_id for user_id, dates in active_dates_by_user.items() if dates}
+    inactive_cutoff = (now - timedelta(days=inactive_days)).date()
+    churned_user_ids = {
+        user_id
+        for user_id, dates in active_dates_by_user.items()
+        if dates and max(dates) < inactive_cutoff
+    }
+    one_and_done_user_ids = {
+        user_id for user_id, dates in active_dates_by_user.items() if len(dates) == 1
+    }
+
+    one_and_done = {
+        "activated_users": len(activated_user_ids),
+        "count": len(one_and_done_user_ids),
+        "pct": _rate(len(one_and_done_user_ids), len(activated_user_ids)),
+    }
+    normalized_signals = {
+        key: _coerce_user_set(value, eligible_user_ids)
+        for key, value in signal_users.items()
+    }
+    churn_signals = []
+    for key in CHURN_SIGNAL_KEYS:
+        users_with_signal = normalized_signals.get(key, set()) & churned_user_ids
+        churn_signals.append({
+            "key": key,
+            "label": CHURN_SIGNAL_LABELS[key],
+            "count": len(users_with_signal),
+            "pct": _rate(len(users_with_signal), len(churned_user_ids)),
+        })
+
+    last_action_counts: Counter[str] = Counter()
+    for row in last_actions:
+        user_id = str(_row_value(row, "user_id"))
+        if user_id not in churned_user_ids:
+            continue
+        category = str(_row_value(row, "category") or "unknown").replace("-", "_")
+        last_action_counts[category] += 1
+    last_action = [
+        {
+            "key": key,
+            "label": _normalized_action_label(key),
+            "count": count,
+            "pct": _rate(count, len(churned_user_ids)),
+        }
+        for key, count in sorted(last_action_counts.items(), key=lambda item: (-item[1], item[0]))
+    ]
+
+    eligible_feedback = [
+        row for row in feedback_rows
+        if str(_row_value(row, "user_id")) in eligible_user_ids
+    ]
+    eligible_feedback.sort(
+        key=lambda row: _row_value(row, "created_at") or datetime.min.replace(tzinfo=timezone.utc),
+        reverse=True,
+    )
+    feedback = {
+        "recent": [_serialize_feedback(row) for row in eligible_feedback[:20]],
+        "by_area": _group_count(eligible_feedback, "area"),
+        "by_severity": _group_count(eligible_feedback, "severity"),
+    }
+
+    eligible_cancel_rows = [
+        row for row in cancel_rows
+        if str(_row_value(row, "user_id")) in eligible_user_ids
+    ]
+    eligible_cancel_rows.sort(
+        key=lambda row: _row_value(row, "created_at") or datetime.min.replace(tzinfo=timezone.utc),
+        reverse=True,
+    )
+
+    bucket_counts: Counter[str] = Counter()
+    for user_id in churned_user_ids:
+        if user_id in normalized_signals.get("parse_failure", set()):
+            bucket_counts["parse"] += 1
+        elif user_id in normalized_signals.get("export_refusal", set()):
+            bucket_counts["export"] += 1
+        elif user_id in normalized_signals.get("page_fail", set()):
+            bucket_counts["page_fail"] += 1
+        elif user_id in normalized_signals.get("rag_miss", set()):
+            bucket_counts["coverage_fail"] += 1
+        elif user_id in normalized_signals.get("capability_refusal", set()):
+            bucket_counts["capability_refusal"] += 1
+        elif user_id in one_and_done_user_ids:
+            bucket_counts["one_off_success"] += 1
+
+    reason_buckets = [
+        {
+            "key": key,
+            "label": label,
+            "count": bucket_counts.get(key, 0),
+            "pct": _rate(bucket_counts.get(key, 0), len(churned_user_ids)),
+        }
+        for key, label in REASON_BUCKET_LABELS.items()
+    ]
+
+    return {
+        "generated_at": now.isoformat(),
+        "inactive_days": inactive_days,
+        "churned_users": len(churned_user_ids),
+        "one_and_done": one_and_done,
+        "churn_signals": churn_signals,
+        "last_action": last_action,
+        "feedback": feedback,
+        "cancel_reasons": [_serialize_cancel_reason(row) for row in eligible_cancel_rows[:20]],
+        "reason_buckets": reason_buckets,
+    }
+
+
+def _citations_empty(citations: Any) -> bool:
+    return citations in (None, {}, [], "{}", "[]", "null")
+
+
+def _message_has_artifact(metadata: Any) -> bool:
+    if not isinstance(metadata, dict):
+        return False
+    artifact_count = metadata.get("artifact_count")
+    if isinstance(artifact_count, int) and artifact_count > 0:
+        return True
+    artifacts = metadata.get("artifacts")
+    return isinstance(artifacts, list) and len(artifacts) > 0
+
+
 def _activity_subquery(start: datetime, end: datetime | None = None):
     usage_q = (
         select(UsageRecord.user_id.label("user_id"), UsageRecord.created_at.label("created_at"))
@@ -1000,6 +1541,355 @@ async def admin_user_activity(
     }
 
 
+@router.get("/retention", response_model=AdminRetentionResponse)
+async def admin_retention(
+    _admin: User = Depends(require_admin),
+    db: AsyncSession = Depends(get_db_session),
+):
+    """Retention analytics centered on user-role chat message activity."""
+    now = datetime.now(timezone.utc)
+    current_week = _week_start(now)
+    cohort_cutoff = datetime.combine(
+        current_week - timedelta(weeks=RETENTION_WEEKS - 1),
+        datetime.min.time(),
+        tzinfo=timezone.utc,
+    )
+    activity_cutoff = now - timedelta(days=RETENTION_LOOKBACK_DAYS)
+
+    activity_user_ids = (
+        select(ChatSession.user_id.label("user_id"))
+        .select_from(Message)
+        .join(ChatSession, Message.session_id == ChatSession.id)
+        .where(Message.role == "user")
+        .where(Message.created_at >= activity_cutoff)
+        .where(ChatSession.user_id.is_not(None))
+        .subquery()
+    )
+    user_rows = (
+        await db.execute(

exec
/bin/zsh -lc 'rg -n "retention|churn|tab|hash|fetch|useEffect|AdminTabs|activeTab|period" frontend/src/app/admin/AdminPageClient.tsx frontend/src/components/admin/*.tsx frontend/src/components/admin/types.ts' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
frontend/src/components/admin/AdminPanels.tsx:121:          <table className="w-full text-xs">
frontend/src/components/admin/AdminPanels.tsx:144:          </table>
frontend/src/components/admin/AdminPanels.tsx:171:              <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">{formatNumber(stage.users)}</p>
frontend/src/components/admin/AdminPanels.tsx:183:            <table className="w-full text-xs">
frontend/src/components/admin/AdminPanels.tsx:191:                    <td className="py-2 pl-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
frontend/src/components/admin/AdminPanels.tsx:197:            </table>
frontend/src/components/admin/AdminPanels.tsx:267:      <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">{value}</p>
frontend/src/components/admin/AdminPanels.tsx:294:              <p className="tabular-nums text-zinc-900 dark:text-zinc-100">{item.metric}</p>
frontend/src/components/admin/AdminPanels.tsx:374:      <table className="w-full text-sm">
frontend/src/components/admin/AdminPanels.tsx:394:                  className={`px-4 py-2 text-zinc-600 dark:text-zinc-400 ${column.align === "right" ? "text-right tabular-nums" : "text-left"}`}
frontend/src/components/admin/AdminPanels.tsx:415:      </table>
frontend/src/components/admin/FeedbackList.tsx:13:          {tOr("admin.churn.feedbackTitle", "Recent Feedback")}
frontend/src/components/admin/FeedbackList.tsx:18:          {tOr("admin.churn.noFeedback", "No recent feedback.")}
frontend/src/components/admin/FeedbackList.tsx:34:                {item.message || tOr("admin.churn.feedbackNoMessage", "No written detail.")}
frontend/src/components/admin/ChurnSignalsBars.tsx:29:            {tOr("admin.churn.signalsTitle", "Churn Signal Prevalence")}
frontend/src/components/admin/ChurnSignalsBars.tsx:32:            {tOr("admin.churn.signalsSubtitle", "Share of churned users who experienced each failure signal before leaving.")}
frontend/src/components/admin/ChurnSignalsBars.tsx:45:                item.payload?.label || tOr("admin.churn.signal", "Signal"),
frontend/src/components/admin/ChurnSignalsBars.tsx:57:            <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
frontend/src/components/admin/ChurnSignalsBars.tsx:60:            <p className="mt-1 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
frontend/src/components/admin/ChurnSignalsBars.tsx:61:              {tOr("admin.churn.users", "{n} users", { n: formatNumber(signal.count) })}
frontend/src/components/admin/RetentionHeatmap.tsx:20:        {tOr("admin.retention.emptyHeatmap", "No retention cohorts yet.")}
frontend/src/components/admin/RetentionHeatmap.tsx:29:          {tOr("admin.retention.heatmapTitle", "Weekly Cohort Retention")}
frontend/src/components/admin/RetentionHeatmap.tsx:32:          {tOr("admin.retention.heatmapSubtitle", "Signup-week cohorts by active user-message week.")}
frontend/src/components/admin/RetentionHeatmap.tsx:36:        <table className="w-full min-w-[760px] border-separate border-spacing-1 text-xs">
frontend/src/components/admin/RetentionHeatmap.tsx:40:                {tOr("admin.retention.cohort", "Cohort")}
frontend/src/components/admin/RetentionHeatmap.tsx:43:                {tOr("admin.retention.users", "Users")}
frontend/src/components/admin/RetentionHeatmap.tsx:46:                <th key={offset} scope="col" className="px-2 py-1 text-center font-medium tabular-nums">
frontend/src/components/admin/RetentionHeatmap.tsx:58:                <td className="rounded bg-zinc-50 px-2 py-2 text-right tabular-nums text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
frontend/src/components/admin/RetentionHeatmap.tsx:61:                {cohort.retention.map((cell) => {
frontend/src/components/admin/RetentionHeatmap.tsx:66:                      className={`h-9 min-w-12 rounded text-center align-middle font-medium tabular-nums ${
frontend/src/components/admin/RetentionHeatmap.tsx:79:        </table>
frontend/src/components/admin/OverviewTab.tsx:108:      <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">{value.toLocaleString()}</p>
frontend/src/components/admin/ActivationTab.tsx:36:                <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
frontend/src/components/admin/ActivationTab.tsx:39:                <p className="mt-1 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
frontend/src/components/admin/ActivationTab.tsx:47:                  <p className="mt-1 text-xs tabular-nums text-red-600 dark:text-red-300">
frontend/src/components/admin/ReasonBucketsDonut.tsx:23:        {tOr("admin.churn.reasonBucketsTitle", "Reason Buckets")}
frontend/src/components/admin/ReasonBucketsDonut.tsx:27:          {tOr("admin.churn.noBuckets", "No churn reason buckets yet.")}
frontend/src/components/admin/ReasonBucketsDonut.tsx:39:                <Tooltip formatter={(value) => [formatNumber(Number(value)), tOr("admin.churn.usersLabel", "Users")]} />
frontend/src/components/admin/ReasonBucketsDonut.tsx:54:                <span className="shrink-0 text-sm font-medium tabular-nums text-zinc-950 dark:text-zinc-50">
frontend/src/components/admin/RetentionCurves.tsx:29:          {tOr("admin.retention.curvesTitle", "D1 / D7 / D30 Return")}
frontend/src/components/admin/RetentionCurves.tsx:39:                  item.payload?.label || tOr("admin.retention.returned", "Returned"),
frontend/src/components/admin/RetentionCurves.tsx:58:              <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
frontend/src/components/admin/RetentionCurves.tsx:61:              <p className="mt-1 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
frontend/src/components/admin/RetentionCurves.tsx:62:                {tOr("admin.retention.returnedOutOf", "{returned} / {activated} returned", {
frontend/src/components/admin/RetentionCurves.tsx:73:          {tOr("admin.retention.dauTitle", "DAU Last 30 Days")}
frontend/src/components/admin/RetentionCurves.tsx:80:              <Tooltip formatter={(value) => [formatNumber(Number(value)), tOr("admin.retention.dau", "DAU")]} />
frontend/src/app/admin/AdminPageClient.tsx:3:import { useCallback, useEffect, useRef, useState } from "react";
frontend/src/app/admin/AdminPageClient.tsx:38:type TabId = "overview" | "activation" | "retention" | "churn" | "revenue" | "product";
frontend/src/app/admin/AdminPageClient.tsx:41:  { id: "overview", key: "admin.tab.overview", fallback: "Overview" },
frontend/src/app/admin/AdminPageClient.tsx:42:  { id: "activation", key: "admin.tab.activation", fallback: "Activation" },
frontend/src/app/admin/AdminPageClient.tsx:43:  { id: "retention", key: "admin.tab.retention", fallback: "Retention" },
frontend/src/app/admin/AdminPageClient.tsx:44:  { id: "churn", key: "admin.tab.churn", fallback: "Why-not-retained" },
frontend/src/app/admin/AdminPageClient.tsx:45:  { id: "revenue", key: "admin.tab.revenue", fallback: "Revenue" },
frontend/src/app/admin/AdminPageClient.tsx:46:  { id: "product", key: "admin.tab.product", fallback: "Product" },
frontend/src/app/admin/AdminPageClient.tsx:49:// Which backend datasets each tab needs (lazy-loaded on first open).
frontend/src/app/admin/AdminPageClient.tsx:53:  retention: ["retention"],
frontend/src/app/admin/AdminPageClient.tsx:54:  churn: ["churn"],
frontend/src/app/admin/AdminPageClient.tsx:58:// Datasets that depend on the selected period (refetched when trendDays changes).
frontend/src/app/admin/AdminPageClient.tsx:71:  const [activeTab, setActiveTab] = useState<TabId>("overview");
frontend/src/app/admin/AdminPageClient.tsx:79:  const [retention, setRetention] = useState<AdminRetention | null>(null);
frontend/src/app/admin/AdminPageClient.tsx:80:  const [churn, setChurn] = useState<AdminChurn | null>(null);
frontend/src/app/admin/AdminPageClient.tsx:86:  const [tabLoading, setTabLoading] = useState(false);
frontend/src/app/admin/AdminPageClient.tsx:94:  useEffect(() => {
frontend/src/app/admin/AdminPageClient.tsx:98:  // Tab <-> URL hash sync (linkable tabs)
frontend/src/app/admin/AdminPageClient.tsx:99:  useEffect(() => {
frontend/src/app/admin/AdminPageClient.tsx:100:    const fromHash = typeof window !== "undefined" ? window.location.hash.replace("#", "") : "";
frontend/src/app/admin/AdminPageClient.tsx:109:  const fetchers: Record<string, () => Promise<void>> = {
frontend/src/app/admin/AdminPageClient.tsx:121:    retention: async () => setRetention(await getAdminRetention()),
frontend/src/app/admin/AdminPageClient.tsx:122:    churn: async () => setChurn(await getAdminChurn(14)),
frontend/src/app/admin/AdminPageClient.tsx:125:  // Lazy-load the active tab's datasets on open / reload.
frontend/src/app/admin/AdminPageClient.tsx:126:  useEffect(() => {
frontend/src/app/admin/AdminPageClient.tsx:128:    const need = TAB_DEPS[activeTab].filter((k) => !loadedRef.current.has(k));
frontend/src/app/admin/AdminPageClient.tsx:136:            await fetchers[k]();
frontend/src/app/admin/AdminPageClient.tsx:151:  }, [activeTab, reloadToken]);
frontend/src/app/admin/AdminPageClient.tsx:193:            <RefreshCw className={`h-3.5 w-3.5 ${tabLoading ? "animate-spin" : ""}`} />
frontend/src/app/admin/AdminPageClient.tsx:198:        {/* Sticky tab nav */}
frontend/src/app/admin/AdminPageClient.tsx:200:          <div className="flex gap-1 overflow-x-auto" role="tablist">
frontend/src/app/admin/AdminPageClient.tsx:202:              const active = t.id === activeTab;
frontend/src/app/admin/AdminPageClient.tsx:206:                  role="tab"
frontend/src/app/admin/AdminPageClient.tsx:227:        {tabLoading && (
frontend/src/app/admin/AdminPageClient.tsx:231:        <div role="tabpanel">
frontend/src/app/admin/AdminPageClient.tsx:232:          {activeTab === "overview" && (
frontend/src/app/admin/AdminPageClient.tsx:235:          {activeTab === "activation" && <ActivationTab activity={userActivity} funnel={funnel} />}
frontend/src/app/admin/AdminPageClient.tsx:236:          {activeTab === "retention" && <RetentionTab retention={retention} />}
frontend/src/app/admin/AdminPageClient.tsx:237:          {activeTab === "churn" && <ChurnTab churn={churn} />}
frontend/src/app/admin/AdminPageClient.tsx:238:          {activeTab === "revenue" && (
frontend/src/app/admin/AdminPageClient.tsx:246:          {activeTab === "product" && (
frontend/src/components/admin/KPICard.tsx:51:          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium tabular-nums ${
frontend/src/components/admin/KPICard.tsx:64:        <p className="text-2xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
frontend/src/components/admin/ChurnTab.tsx:10:export default function ChurnTab({ churn }: { churn: AdminChurn | null }) {
frontend/src/components/admin/ChurnTab.tsx:12:  if (!churn) return null;
frontend/src/components/admin/ChurnTab.tsx:17:        <Metric label={tOr("admin.churn.churnedUsers", "Churned users")} value={churn.churned_users} />
frontend/src/components/admin/ChurnTab.tsx:18:        <Metric label={tOr("admin.churn.oneAndDone", "One and done")} value={formatPercent(churn.one_and_done.pct)} detail={tOr("admin.churn.oneAndDoneDetail", "{count} of {total}", { count: churn.one_and_done.count, total: churn.one_and_done.activated_users })} />
frontend/src/components/admin/ChurnTab.tsx:19:        <Metric label={tOr("admin.churn.inactiveWindow", "Inactive window")} value={`${churn.inactive_days}d`} />
frontend/src/components/admin/ChurnTab.tsx:22:        <ChurnSignalsBars signals={churn.churn_signals} />
frontend/src/components/admin/ChurnTab.tsx:23:        <ReasonBucketsDonut buckets={churn.reason_buckets} />
frontend/src/components/admin/ChurnTab.tsx:29:              {tOr("admin.churn.lastAction", "Last Action")}
frontend/src/components/admin/ChurnTab.tsx:33:            {churn.last_action.length === 0 ? (
frontend/src/components/admin/ChurnTab.tsx:34:              <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">{tOr("admin.churn.noLastAction", "No last-action data yet.")}</p>
frontend/src/components/admin/ChurnTab.tsx:35:            ) : churn.last_action.map((item) => (
frontend/src/components/admin/ChurnTab.tsx:38:                <span className="text-sm font-medium tabular-nums text-zinc-950 dark:text-zinc-50">
frontend/src/components/admin/ChurnTab.tsx:45:        <FeedbackList feedback={churn.feedback.recent} />
frontend/src/components/admin/ChurnTab.tsx:50:            {tOr("admin.churn.cancelReasons", "Cancel Reasons")}
frontend/src/components/admin/ChurnTab.tsx:53:        {churn.cancel_reasons.length === 0 ? (
frontend/src/components/admin/ChurnTab.tsx:54:          <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">{tOr("admin.churn.noCancelReasons", "No cancel reasons in this window.")}</p>
frontend/src/components/admin/ChurnTab.tsx:57:            {churn.cancel_reasons.map((reason) => (
frontend/src/components/admin/ChurnTab.tsx:64:                  {reason.reason || tOr("admin.churn.unspecifiedReason", "Unspecified reason")}
frontend/src/components/admin/ChurnTab.tsx:80:      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
frontend/src/components/admin/RetentionTab.tsx:9:export default function RetentionTab({ retention }: { retention: AdminRetention | null }) {
frontend/src/components/admin/RetentionTab.tsx:11:  if (!retention) return null;
frontend/src/components/admin/RetentionTab.tsx:16:        <MiniMetric label={tOr("admin.retention.wau", "WAU")} value={retention.dau_wau_mau.wau} />
frontend/src/components/admin/RetentionTab.tsx:17:        <MiniMetric label={tOr("admin.retention.mau", "MAU")} value={retention.dau_wau_mau.mau} />
frontend/src/components/admin/RetentionTab.tsx:18:        <MiniMetric label={tOr("admin.retention.stickiness", "Stickiness")} value={formatPercent(retention.dau_wau_mau.stickiness)} />
frontend/src/components/admin/RetentionTab.tsx:20:      <RetentionHeatmap cohorts={retention.cohort_grid} />
frontend/src/components/admin/RetentionTab.tsx:21:      <RetentionCurves curves={retention.curves} dauSeries={retention.dau_wau_mau.series} />
frontend/src/components/admin/RetentionTab.tsx:23:        <SegmentPanel title={tOr("admin.retention.byPlan", "Retention by Plan")} rows={retention.by_segment.plan} />
frontend/src/components/admin/RetentionTab.tsx:24:        <SegmentPanel title={tOr("admin.retention.byDocSize", "Retention by Doc Size")} rows={retention.by_segment.doc_size} />
frontend/src/components/admin/RetentionTab.tsx:25:        <SegmentPanel title={tOr("admin.retention.byLocale", "Retention by Locale")} rows={retention.by_segment.locale} />
frontend/src/components/admin/RetentionTab.tsx:30:            {tOr("admin.retention.weeklyFlow", "Weekly Flow")}
frontend/src/components/admin/RetentionTab.tsx:34:          <table className="w-full text-sm">
frontend/src/components/admin/RetentionTab.tsx:37:                <th scope="col" className="px-4 py-2 text-left font-medium">{tOr("admin.retention.week", "Week")}</th>
frontend/src/components/admin/RetentionTab.tsx:38:                <th scope="col" className="px-4 py-2 text-right font-medium">{tOr("admin.retention.new", "New")}</th>
frontend/src/components/admin/RetentionTab.tsx:39:                <th scope="col" className="px-4 py-2 text-right font-medium">{tOr("admin.retention.retained", "Retained")}</th>
frontend/src/components/admin/RetentionTab.tsx:40:                <th scope="col" className="px-4 py-2 text-right font-medium">{tOr("admin.retention.resurrected", "Resurrected")}</th>
frontend/src/components/admin/RetentionTab.tsx:41:                <th scope="col" className="px-4 py-2 text-right font-medium">{tOr("admin.retention.churned", "Churned")}</th>
frontend/src/components/admin/RetentionTab.tsx:45:              {retention.weekly_flow.map((row) => (
frontend/src/components/admin/RetentionTab.tsx:48:                  <td className="px-4 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{formatNumber(row.new)}</td>
frontend/src/components/admin/RetentionTab.tsx:49:                  <td className="px-4 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{formatNumber(row.retained)}</td>
frontend/src/components/admin/RetentionTab.tsx:50:                  <td className="px-4 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{formatNumber(row.resurrected)}</td>
frontend/src/components/admin/RetentionTab.tsx:51:                  <td className="px-4 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{formatNumber(row.churned)}</td>
frontend/src/components/admin/RetentionTab.tsx:55:          </table>
frontend/src/components/admin/RetentionTab.tsx:66:      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
frontend/src/components/admin/RetentionTab.tsx:82:              <span className="tabular-nums text-zinc-950 dark:text-zinc-50">{formatPercent(row.pct)}</span>
frontend/src/components/admin/RetentionTab.tsx:87:            <p className="mt-1 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">

exec
/bin/zsh -lc "nl -ba backend/app/api/admin.py | sed -n '1540,1895p'" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "nl -ba backend/app/api/admin.py | sed -n '300,720p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
  1540	        },
  1541	    }
  1542	
  1543	
  1544	@router.get("/retention", response_model=AdminRetentionResponse)
  1545	async def admin_retention(
  1546	    _admin: User = Depends(require_admin),
  1547	    db: AsyncSession = Depends(get_db_session),
  1548	):
  1549	    """Retention analytics centered on user-role chat message activity."""
  1550	    now = datetime.now(timezone.utc)
  1551	    current_week = _week_start(now)
  1552	    cohort_cutoff = datetime.combine(
  1553	        current_week - timedelta(weeks=RETENTION_WEEKS - 1),
  1554	        datetime.min.time(),
  1555	        tzinfo=timezone.utc,
  1556	    )
  1557	    activity_cutoff = now - timedelta(days=RETENTION_LOOKBACK_DAYS)
  1558	
  1559	    activity_user_ids = (
  1560	        select(ChatSession.user_id.label("user_id"))
  1561	        .select_from(Message)
  1562	        .join(ChatSession, Message.session_id == ChatSession.id)
  1563	        .where(Message.role == "user")
  1564	        .where(Message.created_at >= activity_cutoff)
  1565	        .where(ChatSession.user_id.is_not(None))
  1566	        .subquery()
  1567	    )
  1568	    user_rows = (
  1569	        await db.execute(
  1570	            select(User.id, User.email, User.created_at, User.plan)
  1571	            .where(or_(User.created_at >= cohort_cutoff, User.id.in_(select(activity_user_ids.c.user_id))))
  1572	            .where(*_eligible_user_conditions())
  1573	        )
  1574	    ).all()
  1575	
  1576	    activity_day = func.date_trunc("day", Message.created_at).label("activity_date")
  1577	    activity_rows = (
  1578	        await db.execute(
  1579	            select(ChatSession.user_id.label("user_id"), activity_day)
  1580	            .select_from(Message)
  1581	            .join(ChatSession, Message.session_id == ChatSession.id)
  1582	            .join(User, User.id == ChatSession.user_id)
  1583	            .where(Message.role == "user")
  1584	            .where(Message.created_at >= activity_cutoff)
  1585	            .where(ChatSession.user_id.is_not(None))
  1586	            .where(*_eligible_user_conditions())
  1587	            .group_by(ChatSession.user_id, activity_day)
  1588	        )
  1589	    ).all()
  1590	
  1591	    document_rows = (
  1592	        await db.execute(
  1593	            select(
  1594	                Document.user_id.label("user_id"),
  1595	                func.max(Document.page_count).label("max_page_count"),
  1596	            )
  1597	            .select_from(Document)
  1598	            .join(User, User.id == Document.user_id)
  1599	            .where(Document.created_at >= activity_cutoff)
  1600	            .where(Document.user_id.is_not(None))
  1601	            .where(Document.demo_slug.is_(None))
  1602	            .where(*_eligible_user_conditions())
  1603	            .group_by(Document.user_id)
  1604	        )
  1605	    ).all()
  1606	
  1607	    locale_rows = (
  1608	        await db.execute(
  1609	            select(UserFeedback.user_id.label("user_id"), func.max(UserFeedback.locale).label("locale"))
  1610	            .select_from(UserFeedback)
  1611	            .join(User, User.id == UserFeedback.user_id)
  1612	            .where(UserFeedback.created_at >= activity_cutoff)
  1613	            .where(UserFeedback.user_id.is_not(None))
  1614	            .where(UserFeedback.locale.is_not(None))
  1615	            .where(*_eligible_user_conditions())
  1616	            .group_by(UserFeedback.user_id)
  1617	        )
  1618	    ).all()
  1619	
  1620	    return _build_retention_payload(
  1621	        now=now,
  1622	        users=list(user_rows),
  1623	        activity_days=list(activity_rows),
  1624	        document_segments=list(document_rows),
  1625	        locale_segments=list(locale_rows),
  1626	    )
  1627	
  1628	
  1629	@router.get("/churn", response_model=AdminChurnResponse)
  1630	async def admin_churn(
  1631	    _admin: User = Depends(require_admin),
  1632	    db: AsyncSession = Depends(get_db_session),
  1633	    inactive_days: int = Query(14, ge=1, le=90),
  1634	):
  1635	    """Churn diagnostics for activated users without recent user-message activity."""
  1636	    now = datetime.now(timezone.utc)
  1637	    activity_cutoff = now - timedelta(days=CHURN_LOOKBACK_DAYS)
  1638	
  1639	    activity_user_ids = (
  1640	        select(ChatSession.user_id.label("user_id"))
  1641	        .select_from(Message)
  1642	        .join(ChatSession, Message.session_id == ChatSession.id)
  1643	        .where(Message.role == "user")
  1644	        .where(Message.created_at >= activity_cutoff)
  1645	        .where(ChatSession.user_id.is_not(None))
  1646	        .subquery()
  1647	    )
  1648	    user_rows = (
  1649	        await db.execute(
  1650	            select(User.id, User.email, User.created_at, User.plan)
  1651	            .where(User.id.in_(select(activity_user_ids.c.user_id)))
  1652	            .where(*_eligible_user_conditions())
  1653	        )
  1654	    ).all()
  1655	
  1656	    activity_day = func.date_trunc("day", Message.created_at).label("activity_date")
  1657	    activity_rows = (
  1658	        await db.execute(
  1659	            select(ChatSession.user_id.label("user_id"), activity_day)
  1660	            .select_from(Message)
  1661	            .join(ChatSession, Message.session_id == ChatSession.id)
  1662	            .join(User, User.id == ChatSession.user_id)
  1663	            .where(Message.role == "user")
  1664	            .where(Message.created_at >= activity_cutoff)
  1665	            .where(ChatSession.user_id.is_not(None))
  1666	            .where(*_eligible_user_conditions())
  1667	            .group_by(ChatSession.user_id, activity_day)
  1668	        )
  1669	    ).all()
  1670	
  1671	    session_rows = (
  1672	        await db.execute(
  1673	            select(
  1674	                ChatSession.id.label("session_id"),
  1675	                ChatSession.user_id.label("user_id"),
  1676	                func.coalesce(func.sum(case((Message.role == "user", 1), else_=0)), 0).label("user_messages"),
  1677	                func.coalesce(func.sum(case((Message.role == "assistant", 1), else_=0)), 0).label("assistant_messages"),
  1678	            )
  1679	            .select_from(ChatSession)
  1680	            .join(Message, Message.session_id == ChatSession.id)
  1681	            .join(User, User.id == ChatSession.user_id)
  1682	            .where(Message.created_at >= activity_cutoff)
  1683	            .where(ChatSession.user_id.is_not(None))
  1684	            .where(*_eligible_user_conditions())
  1685	            .group_by(ChatSession.id, ChatSession.user_id)
  1686	        )
  1687	    ).all()
  1688	    asst_zero_session_ids = {
  1689	        str(row.session_id)
  1690	        for row in session_rows
  1691	        if int(row.user_messages or 0) > 0 and int(row.assistant_messages or 0) == 0
  1692	    }
  1693	    signal_users: dict[str, set[str]] = {
  1694	        "asst_zero": {
  1695	            str(row.user_id)
  1696	            for row in session_rows
  1697	            if int(row.user_messages or 0) > 0 and int(row.assistant_messages or 0) == 0
  1698	        },
  1699	        "rag_miss": set(),
  1700	        "parse_failure": set(),
  1701	        "large_doc": set(),
  1702	        "export_refusal": set(),
  1703	        "paywall_hit": set(),
  1704	        "page_fail": set(),
  1705	        "capability_refusal": set(),
  1706	    }
  1707	
  1708	    message_rows = (
  1709	        await db.execute(
  1710	            select(
  1711	                ChatSession.user_id.label("user_id"),
  1712	                Message.session_id.label("session_id"),
  1713	                Message.role.label("role"),
  1714	                Message.content.label("content"),
  1715	                Message.citations.label("citations"),
  1716	                Message.metadata_json.label("metadata_json"),
  1717	                Message.created_at.label("created_at"),
  1718	            )
  1719	            .select_from(Message)
  1720	            .join(ChatSession, Message.session_id == ChatSession.id)
  1721	            .join(User, User.id == ChatSession.user_id)
  1722	            .where(Message.created_at >= activity_cutoff)
  1723	            .where(ChatSession.user_id.is_not(None))
  1724	            .where(*_eligible_user_conditions())
  1725	        )
  1726	    ).all()
  1727	
  1728	    export_request_users: set[str] = set()
  1729	    export_artifact_users: set[str] = set()
  1730	    page_request_users: set[str] = set()
  1731	    final_candidates: dict[str, tuple[datetime, str]] = {}
  1732	    for row in message_rows:
  1733	        user_id = str(row.user_id)
  1734	        created_at = row.created_at
  1735	        category = "user_message"
  1736	        if row.role == "user":
  1737	            content = row.content or ""
  1738	            if EXPORT_REQUEST_RE.search(content):
  1739	                export_request_users.add(user_id)
  1740	            if PAGE_REQUEST_RE.search(content):
  1741	                page_request_users.add(user_id)
  1742	            if str(row.session_id) in asst_zero_session_ids:
  1743	                category = "asst_zero"
  1744	        elif row.role == "assistant":
  1745	            content = row.content or ""
  1746	            if _message_has_artifact(row.metadata_json):
  1747	                export_artifact_users.add(user_id)
  1748	            if _citations_empty(row.citations) or RAG_MISS_RE.search(content):
  1749	                signal_users["rag_miss"].add(user_id)
  1750	                category = "rag_miss"
  1751	            elif CAPABILITY_REFUSAL_RE.search(content):
  1752	                signal_users["capability_refusal"].add(user_id)
  1753	                category = "capability_refusal"
  1754	            else:
  1755	                category = "normal_answer"
  1756	        current = final_candidates.get(user_id)
  1757	        if created_at and (current is None or created_at > current[0]):
  1758	            final_candidates[user_id] = (created_at, category)
  1759	
  1760	    signal_users["export_refusal"] = export_request_users - export_artifact_users
  1761	    signal_users["page_fail"] = page_request_users & signal_users["rag_miss"]
  1762	
  1763	    document_flag_rows = (
  1764	        await db.execute(
  1765	            select(
  1766	                Document.user_id.label("user_id"),
  1767	                func.max(Document.page_count).label("max_page_count"),
  1768	                func.coalesce(
  1769	                    func.sum(case((Document.status.in_(("error", "ocr")), 1), else_=0)),
  1770	                    0,
  1771	                ).label("parse_failures"),
  1772	            )
  1773	            .select_from(Document)
  1774	            .join(User, User.id == Document.user_id)
  1775	            .where(Document.created_at >= activity_cutoff)
  1776	            .where(Document.user_id.is_not(None))
  1777	            .where(Document.demo_slug.is_(None))
  1778	            .where(*_eligible_user_conditions())
  1779	            .group_by(Document.user_id)
  1780	        )
  1781	    ).all()
  1782	    for row in document_flag_rows:
  1783	        user_id = str(row.user_id)
  1784	        if int(row.parse_failures or 0) > 0:
  1785	            signal_users["parse_failure"].add(user_id)
  1786	        if int(row.max_page_count or 0) >= 150:
  1787	            signal_users["large_doc"].add(user_id)
  1788	
  1789	    product_rows = (
  1790	        await db.execute(
  1791	            select(
  1792	                ProductEvent.user_id.label("user_id"),
  1793	                ProductEvent.event_name.label("event_name"),
  1794	                ProductEvent.created_at.label("created_at"),
  1795	            )
  1796	            .select_from(ProductEvent)
  1797	            .join(User, User.id == ProductEvent.user_id)
  1798	            .where(ProductEvent.created_at >= activity_cutoff)
  1799	            .where(ProductEvent.user_id.is_not(None))
  1800	            .where(*_eligible_user_conditions())
  1801	        )
  1802	    ).all()
  1803	    for row in product_rows:
  1804	        user_id = str(row.user_id)
  1805	        if row.event_name in {"paywall_opened", "limit_hit"}:
  1806	            signal_users["paywall_hit"].add(user_id)
  1807	            category = "paywall"
  1808	        else:
  1809	            category = str(row.event_name or "product_event")
  1810	        current = final_candidates.get(user_id)
  1811	        if row.created_at and (current is None or row.created_at > current[0]):
  1812	            final_candidates[user_id] = (row.created_at, category)
  1813	
  1814	    upload_rows = (
  1815	        await db.execute(
  1816	            select(Document.user_id.label("user_id"), Document.created_at.label("created_at"))
  1817	            .select_from(Document)
  1818	            .join(User, User.id == Document.user_id)
  1819	            .where(Document.created_at >= activity_cutoff)
  1820	            .where(Document.user_id.is_not(None))
  1821	            .where(Document.demo_slug.is_(None))
  1822	            .where(*_eligible_user_conditions())
  1823	        )
  1824	    ).all()
  1825	    for row in upload_rows:
  1826	        current = final_candidates.get(str(row.user_id))
  1827	        if row.created_at and (current is None or row.created_at > current[0]):
  1828	            final_candidates[str(row.user_id)] = (row.created_at, "upload")
  1829	
  1830	    feedback_rows = (
  1831	        await db.execute(
  1832	            select(
  1833	                UserFeedback.id,
  1834	                UserFeedback.user_id,
  1835	                UserFeedback.type,
  1836	                UserFeedback.area,
  1837	                UserFeedback.severity,
  1838	                UserFeedback.message,
  1839	                UserFeedback.plan,
  1840	                UserFeedback.created_at,
  1841	            )
  1842	            .select_from(UserFeedback)
  1843	            .join(User, User.id == UserFeedback.user_id)
  1844	            .where(UserFeedback.created_at >= activity_cutoff)
  1845	            .where(UserFeedback.user_id.is_not(None))
  1846	            .where(*_eligible_user_conditions())
  1847	            .order_by(UserFeedback.created_at.desc())
  1848	            .limit(50)
  1849	        )
  1850	    ).all()
  1851	
  1852	    cancel_rows = (
  1853	        await db.execute(
  1854	            select(
  1855	                PlanTransition.id,
  1856	                PlanTransition.user_id,
  1857	                PlanTransition.from_plan,
  1858	                PlanTransition.to_plan,
  1859	                PlanTransition.metadata_json,
  1860	                PlanTransition.created_at,
  1861	            )
  1862	            .select_from(PlanTransition)
  1863	            .join(User, User.id == PlanTransition.user_id)
  1864	            .where(PlanTransition.created_at >= activity_cutoff)
  1865	            .where(
  1866	                or_(
  1867	                    PlanTransition.to_plan == "free",
  1868	                    (PlanTransition.from_plan == "pro") & (PlanTransition.to_plan == "plus"),
  1869	                )
  1870	            )
  1871	            .where(*_eligible_user_conditions())
  1872	            .order_by(PlanTransition.created_at.desc())
  1873	            .limit(50)
  1874	        )
  1875	    ).all()
  1876	
  1877	    last_actions = [
  1878	        {"user_id": user_id, "category": category}
  1879	        for user_id, (_created_at, category) in final_candidates.items()
  1880	    ]
  1881	    return _build_churn_payload(
  1882	        now=now,
  1883	        users=list(user_rows),
  1884	        activity_days=list(activity_rows),
  1885	        signal_users=signal_users,
  1886	        last_actions=last_actions,
  1887	        feedback_rows=list(feedback_rows),
  1888	        cancel_rows=list(cancel_rows),
  1889	        inactive_days=inactive_days,
  1890	    )
  1891	
  1892	
  1893	@router.get("/billing-health")
  1894	async def admin_billing_health(
  1895	    remote: bool = Query(False),

 succeeded in 0ms:
   300	def _segment_payload(
   301	    values_by_user: dict[str, str],
   302	    active_users: set[str],
   303	    retained_users: set[str],
   304	    *,
   305	    labeler: Any = _humanize_code,
   306	    limit: int | None = None,
   307	    order: list[str] | None = None,
   308	) -> list[dict[str, Any]]:
   309	    buckets: dict[str, set[str]] = defaultdict(set)
   310	    for user_id in active_users:
   311	        buckets[values_by_user.get(user_id, "unknown") or "unknown"].add(user_id)
   312	    keys = list(buckets)
   313	    if order:
   314	        order_map = {key: index for index, key in enumerate(order)}
   315	        keys.sort(key=lambda key: (order_map.get(key, len(order_map)), key))
   316	    else:
   317	        keys.sort(key=lambda key: (-len(buckets[key]), key))
   318	    if limit is not None:
   319	        keys = keys[:limit]
   320	    return [
   321	        {
   322	            "key": key,
   323	            "label": labeler(key) or key,
   324	            "users": len(buckets[key]),
   325	            "retained_users": len(buckets[key] & retained_users),
   326	            "pct": _rate(len(buckets[key] & retained_users), len(buckets[key])),
   327	        }
   328	        for key in keys
   329	    ]
   330	
   331	
   332	def _activity_dates_by_user(activity_days: list[Any], eligible_users: set[str]) -> dict[str, set[date]]:
   333	    active: dict[str, set[date]] = defaultdict(set)
   334	    for row in activity_days:
   335	        user_id = str(_row_value(row, "user_id"))
   336	        if user_id in eligible_users:
   337	            active[user_id].add(_as_date(_row_value(row, "activity_date")))
   338	    return active
   339	
   340	
   341	def _build_retention_payload(
   342	    *,
   343	    now: datetime,
   344	    users: list[Any],
   345	    activity_days: list[Any],
   346	    document_segments: list[Any],
   347	    locale_segments: list[Any],
   348	    excluded_user_ids: set[str] | None = None,
   349	    admin_emails: set[str] | None = None,
   350	) -> dict[str, Any]:
   351	    eligible_users = _eligible_user_map(users, excluded_user_ids, admin_emails)
   352	    eligible_user_ids = set(eligible_users)
   353	    active_dates_by_user = _activity_dates_by_user(activity_days, eligible_user_ids)
   354	    activated_user_ids = {user_id for user_id, dates in active_dates_by_user.items() if dates}
   355	    retained_user_ids = {user_id for user_id, dates in active_dates_by_user.items() if len(dates) >= 2}
   356	
   357	    current_week = _week_start(now)
   358	    cohort_weeks = [
   359	        current_week - timedelta(weeks=RETENTION_WEEKS - 1 - index)
   360	        for index in range(RETENTION_WEEKS)
   361	    ]
   362	    cohort_users: dict[date, set[str]] = {week: set() for week in cohort_weeks}
   363	    for user_id, user in eligible_users.items():
   364	        cohort_week = _week_start(_row_value(user, "created_at"))
   365	        if cohort_week in cohort_users:
   366	            cohort_users[cohort_week].add(user_id)
   367	
   368	    active_weeks_by_user = {
   369	        user_id: {_week_start(active_date) for active_date in active_dates}
   370	        for user_id, active_dates in active_dates_by_user.items()
   371	    }
   372	    cohort_grid = []
   373	    for cohort_week in cohort_weeks:
   374	        users_in_cohort = cohort_users[cohort_week]
   375	        retention = []
   376	        for week_offset in range(RETENTION_OFFSETS):
   377	            target_week = cohort_week + timedelta(weeks=week_offset)
   378	            active_users = {
   379	                user_id
   380	                for user_id in users_in_cohort
   381	                if target_week in active_weeks_by_user.get(user_id, set())
   382	            }
   383	            retention.append({
   384	                "week_offset": week_offset,
   385	                "active_users": len(active_users),
   386	                "pct": _rate(len(active_users), len(users_in_cohort)),
   387	            })
   388	        cohort_grid.append({
   389	            "cohort_week": cohort_week.isoformat(),
   390	            "cohort_size": len(users_in_cohort),
   391	            "retention": retention,
   392	        })
   393	
   394	    curves = []
   395	    for days in RETENTION_DAYS:
   396	        returned_users = 0
   397	        for active_dates in active_dates_by_user.values():
   398	            if not active_dates:
   399	                continue
   400	            first_active = min(active_dates)
   401	            if any(first_active < active_date <= first_active + timedelta(days=days) for active_date in active_dates):
   402	                returned_users += 1
   403	        curves.append({
   404	            "key": f"d{days}",
   405	            "label": f"D{days}",
   406	            "days": days,
   407	            "activated_users": len(activated_user_ids),
   408	            "returned_users": returned_users,
   409	            "pct": _rate(returned_users, len(activated_user_ids)),
   410	        })
   411	
   412	    today = now.date()
   413	    dau_series = []
   414	    for offset in range(29, -1, -1):
   415	        day = today - timedelta(days=offset)
   416	        dau = sum(1 for dates in active_dates_by_user.values() if day in dates)
   417	        dau_series.append({"date": day.isoformat(), "dau": dau})
   418	    wau_start = today - timedelta(days=6)
   419	    mau_start = today - timedelta(days=29)
   420	    wau_users = {
   421	        user_id
   422	        for user_id, dates in active_dates_by_user.items()
   423	        if any(wau_start <= active_date <= today for active_date in dates)
   424	    }
   425	    mau_users = {
   426	        user_id
   427	        for user_id, dates in active_dates_by_user.items()
   428	        if any(mau_start <= active_date <= today for active_date in dates)
   429	    }
   430	    dau_wau_mau = {
   431	        "series": dau_series,
   432	        "wau": len(wau_users),
   433	        "mau": len(mau_users),
   434	        "stickiness": _rate(dau_series[-1]["dau"] if dau_series else 0, len(mau_users)),
   435	    }
   436	
   437	    plan_by_user = {
   438	        user_id: str(_row_value(user, "plan") or "free")
   439	        for user_id, user in eligible_users.items()
   440	    }
   441	    doc_by_user = {
   442	        str(_row_value(row, "user_id")): _doc_size_bucket(_row_value(row, "max_page_count"))
   443	        for row in document_segments
   444	        if str(_row_value(row, "user_id")) in eligible_user_ids
   445	    }
   446	    locale_by_user = {
   447	        str(_row_value(row, "user_id")): str(_row_value(row, "locale") or "unknown")
   448	        for row in locale_segments
   449	        if str(_row_value(row, "user_id")) in eligible_user_ids
   450	    }
   451	    by_segment = {
   452	        "plan": _segment_payload(
   453	            plan_by_user,
   454	            activated_user_ids,
   455	            retained_user_ids,
   456	            labeler=lambda key: key.upper() if key in {"pro"} else key.capitalize(),
   457	            order=["free", "plus", "pro", "unknown"],
   458	        ),
   459	        "doc_size": _segment_payload(
   460	            doc_by_user,
   461	            activated_user_ids,
   462	            retained_user_ids,
   463	            labeler=_doc_size_label,
   464	            order=["small", "mid", "large", "unknown"],
   465	        ),
   466	        "locale": _segment_payload(locale_by_user, activated_user_ids, retained_user_ids, limit=6),
   467	    }
   468	
   469	    first_active_week = {
   470	        user_id: _week_start(min(active_dates))
   471	        for user_id, active_dates in active_dates_by_user.items()
   472	        if active_dates
   473	    }
   474	    activity_by_week: dict[date, set[str]] = {week: set() for week in cohort_weeks}
   475	    for user_id, active_weeks in active_weeks_by_user.items():
   476	        for active_week in active_weeks:
   477	            if active_week in activity_by_week:
   478	                activity_by_week[active_week].add(user_id)
   479	    weekly_flow = []
   480	    for week in cohort_weeks:
   481	        active_this_week = activity_by_week.get(week, set())
   482	        active_previous_week = activity_by_week.get(week - timedelta(weeks=1), set())
   483	        new_users = {user_id for user_id in active_this_week if first_active_week.get(user_id) == week}
   484	        retained = {
   485	            user_id
   486	            for user_id in active_this_week & active_previous_week
   487	            if first_active_week.get(user_id) != week
   488	        }
   489	        resurrected = {
   490	            user_id
   491	            for user_id in active_this_week - active_previous_week - new_users
   492	            if first_active_week.get(user_id) != week
   493	        }
   494	        weekly_flow.append({
   495	            "week": week.isoformat(),
   496	            "new": len(new_users),
   497	            "retained": len(retained),
   498	            "resurrected": len(resurrected),
   499	            "churned": len(active_previous_week - active_this_week),
   500	        })
   501	
   502	    return {
   503	        "generated_at": now.isoformat(),
   504	        "cohort_grid": cohort_grid,
   505	        "curves": curves,
   506	        "dau_wau_mau": dau_wau_mau,
   507	        "by_segment": by_segment,
   508	        "weekly_flow": weekly_flow,
   509	    }
   510	
   511	
   512	def _normalized_action_label(key: str) -> str:
   513	    labels = {
   514	        "asst_zero": "Assistant zero-response",
   515	        "rag_miss": "RAG miss",
   516	        "normal_answer": "Normal answer",
   517	        "normal-answer": "Normal answer",
   518	        "paywall": "Paywall or plan limit",
   519	        "upload": "Upload",
   520	        "user_message": "User message",
   521	        "unknown": "Unknown",
   522	    }
   523	    return labels.get(key, _humanize_code(key) or key)
   524	
   525	
   526	def _coerce_user_set(values: Any, eligible_user_ids: set[str]) -> set[str]:
   527	    if values is None:
   528	        return set()
   529	    return {str(value) for value in values if str(value) in eligible_user_ids}
   530	
   531	
   532	def _serialize_feedback(row: Any) -> dict[str, Any]:
   533	    created_at = _row_value(row, "created_at")
   534	    message = _row_value(row, "message")
   535	    return {
   536	        "id": str(_row_value(row, "id")),
   537	        "type": str(_row_value(row, "type") or "unknown"),
   538	        "area": str(_row_value(row, "area") or "unknown"),
   539	        "severity": str(_row_value(row, "severity") or "unknown"),
   540	        "message": str(message) if message else None,
   541	        "plan": _row_value(row, "plan"),
   542	        "created_at": created_at.isoformat() if hasattr(created_at, "isoformat") else None,
   543	    }
   544	
   545	
   546	def _group_count(rows: list[Any], key: str) -> list[dict[str, Any]]:
   547	    counts = Counter(str(_row_value(row, key) or "unknown") for row in rows)
   548	    return [
   549	        {"key": value, "count": count}
   550	        for value, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))
   551	    ]
   552	
   553	
   554	def _serialize_cancel_reason(row: Any) -> dict[str, Any]:
   555	    created_at = _row_value(row, "created_at")
   556	    metadata = _row_value(row, "metadata_json") or {}
   557	    reason = _row_value(row, "reason")
   558	    feedback = _row_value(row, "feedback")
   559	    if not reason and isinstance(metadata, dict):
   560	        reason = metadata.get("cancel_reason") or metadata.get("reason")
   561	    if not feedback and isinstance(metadata, dict):
   562	        feedback = metadata.get("cancel_feedback") or metadata.get("feedback")
   563	    return {
   564	        "id": str(_row_value(row, "id")),
   565	        "user_id": str(_row_value(row, "user_id")),
   566	        "from_plan": str(_row_value(row, "from_plan") or ""),
   567	        "to_plan": str(_row_value(row, "to_plan") or ""),
   568	        "reason": str(reason) if reason else None,
   569	        "feedback": str(feedback) if feedback else None,
   570	        "created_at": created_at.isoformat() if hasattr(created_at, "isoformat") else None,
   571	    }
   572	
   573	
   574	def _build_churn_payload(
   575	    *,
   576	    now: datetime,
   577	    users: list[Any],
   578	    activity_days: list[Any],
   579	    signal_users: dict[str, set[str]],
   580	    last_actions: list[Any],
   581	    feedback_rows: list[Any],
   582	    cancel_rows: list[Any],
   583	    inactive_days: int = 14,
   584	    excluded_user_ids: set[str] | None = None,
   585	    admin_emails: set[str] | None = None,
   586	) -> dict[str, Any]:
   587	    eligible_users = _eligible_user_map(users, excluded_user_ids, admin_emails)
   588	    eligible_user_ids = set(eligible_users)
   589	    active_dates_by_user = _activity_dates_by_user(activity_days, eligible_user_ids)
   590	    activated_user_ids = {user_id for user_id, dates in active_dates_by_user.items() if dates}
   591	    inactive_cutoff = (now - timedelta(days=inactive_days)).date()
   592	    churned_user_ids = {
   593	        user_id
   594	        for user_id, dates in active_dates_by_user.items()
   595	        if dates and max(dates) < inactive_cutoff
   596	    }
   597	    one_and_done_user_ids = {
   598	        user_id for user_id, dates in active_dates_by_user.items() if len(dates) == 1
   599	    }
   600	
   601	    one_and_done = {
   602	        "activated_users": len(activated_user_ids),
   603	        "count": len(one_and_done_user_ids),
   604	        "pct": _rate(len(one_and_done_user_ids), len(activated_user_ids)),
   605	    }
   606	    normalized_signals = {
   607	        key: _coerce_user_set(value, eligible_user_ids)
   608	        for key, value in signal_users.items()
   609	    }
   610	    churn_signals = []
   611	    for key in CHURN_SIGNAL_KEYS:
   612	        users_with_signal = normalized_signals.get(key, set()) & churned_user_ids
   613	        churn_signals.append({
   614	            "key": key,
   615	            "label": CHURN_SIGNAL_LABELS[key],
   616	            "count": len(users_with_signal),
   617	            "pct": _rate(len(users_with_signal), len(churned_user_ids)),
   618	        })
   619	
   620	    last_action_counts: Counter[str] = Counter()
   621	    for row in last_actions:
   622	        user_id = str(_row_value(row, "user_id"))
   623	        if user_id not in churned_user_ids:
   624	            continue
   625	        category = str(_row_value(row, "category") or "unknown").replace("-", "_")
   626	        last_action_counts[category] += 1
   627	    last_action = [
   628	        {
   629	            "key": key,
   630	            "label": _normalized_action_label(key),
   631	            "count": count,
   632	            "pct": _rate(count, len(churned_user_ids)),
   633	        }
   634	        for key, count in sorted(last_action_counts.items(), key=lambda item: (-item[1], item[0]))
   635	    ]
   636	
   637	    eligible_feedback = [
   638	        row for row in feedback_rows
   639	        if str(_row_value(row, "user_id")) in eligible_user_ids
   640	    ]
   641	    eligible_feedback.sort(
   642	        key=lambda row: _row_value(row, "created_at") or datetime.min.replace(tzinfo=timezone.utc),
   643	        reverse=True,
   644	    )
   645	    feedback = {
   646	        "recent": [_serialize_feedback(row) for row in eligible_feedback[:20]],
   647	        "by_area": _group_count(eligible_feedback, "area"),
   648	        "by_severity": _group_count(eligible_feedback, "severity"),
   649	    }
   650	
   651	    eligible_cancel_rows = [
   652	        row for row in cancel_rows
   653	        if str(_row_value(row, "user_id")) in eligible_user_ids
   654	    ]
   655	    eligible_cancel_rows.sort(
   656	        key=lambda row: _row_value(row, "created_at") or datetime.min.replace(tzinfo=timezone.utc),
   657	        reverse=True,
   658	    )
   659	
   660	    bucket_counts: Counter[str] = Counter()
   661	    for user_id in churned_user_ids:
   662	        if user_id in normalized_signals.get("parse_failure", set()):
   663	            bucket_counts["parse"] += 1
   664	        elif user_id in normalized_signals.get("export_refusal", set()):
   665	            bucket_counts["export"] += 1
   666	        elif user_id in normalized_signals.get("page_fail", set()):
   667	            bucket_counts["page_fail"] += 1
   668	        elif user_id in normalized_signals.get("rag_miss", set()):
   669	            bucket_counts["coverage_fail"] += 1
   670	        elif user_id in normalized_signals.get("capability_refusal", set()):
   671	            bucket_counts["capability_refusal"] += 1
   672	        elif user_id in one_and_done_user_ids:
   673	            bucket_counts["one_off_success"] += 1
   674	
   675	    reason_buckets = [
   676	        {
   677	            "key": key,
   678	            "label": label,
   679	            "count": bucket_counts.get(key, 0),
   680	            "pct": _rate(bucket_counts.get(key, 0), len(churned_user_ids)),
   681	        }
   682	        for key, label in REASON_BUCKET_LABELS.items()
   683	    ]
   684	
   685	    return {
   686	        "generated_at": now.isoformat(),
   687	        "inactive_days": inactive_days,
   688	        "churned_users": len(churned_user_ids),
   689	        "one_and_done": one_and_done,
   690	        "churn_signals": churn_signals,
   691	        "last_action": last_action,
   692	        "feedback": feedback,
   693	        "cancel_reasons": [_serialize_cancel_reason(row) for row in eligible_cancel_rows[:20]],
   694	        "reason_buckets": reason_buckets,
   695	    }
   696	
   697	
   698	def _citations_empty(citations: Any) -> bool:
   699	    return citations in (None, {}, [], "{}", "[]", "null")
   700	
   701	
   702	def _message_has_artifact(metadata: Any) -> bool:
   703	    if not isinstance(metadata, dict):
   704	        return False
   705	    artifact_count = metadata.get("artifact_count")
   706	    if isinstance(artifact_count, int) and artifact_count > 0:
   707	        return True
   708	    artifacts = metadata.get("artifacts")
   709	    return isinstance(artifacts, list) and len(artifacts) > 0
   710	
   711	
   712	def _activity_subquery(start: datetime, end: datetime | None = None):
   713	    usage_q = (
   714	        select(UsageRecord.user_id.label("user_id"), UsageRecord.created_at.label("created_at"))
   715	        .where(UsageRecord.user_id.is_not(None))
   716	        .where(UsageRecord.created_at >= start)
   717	    )
   718	    message_q = (
   719	        select(ChatSession.user_id.label("user_id"), Message.created_at.label("created_at"))
   720	        .join(ChatSession, Message.session_id == ChatSession.id)

exec
/bin/zsh -lc "nl -ba backend/app/schemas/admin.py | sed -n '220,350p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   220	    feedback: AdminFeedbackSummary
   221	
   222	
   223	class AdminRetentionCell(BaseModel):
   224	    week_offset: int
   225	    active_users: int
   226	    pct: float
   227	
   228	
   229	class AdminRetentionCohort(BaseModel):
   230	    cohort_week: str
   231	    cohort_size: int
   232	    retention: list[AdminRetentionCell]
   233	
   234	
   235	class AdminRetentionCurvePoint(BaseModel):
   236	    key: str
   237	    label: str
   238	    days: int
   239	    activated_users: int
   240	    returned_users: int
   241	    pct: float
   242	
   243	
   244	class AdminRetentionDauPoint(BaseModel):
   245	    date: str
   246	    dau: int
   247	
   248	
   249	class AdminRetentionDauWauMau(BaseModel):
   250	    series: list[AdminRetentionDauPoint]
   251	    wau: int
   252	    mau: int
   253	    stickiness: float
   254	
   255	
   256	class AdminRetentionSegmentItem(BaseModel):
   257	    key: str
   258	    label: str
   259	    users: int
   260	    retained_users: int
   261	    pct: float
   262	
   263	
   264	class AdminRetentionSegments(BaseModel):
   265	    plan: list[AdminRetentionSegmentItem]
   266	    doc_size: list[AdminRetentionSegmentItem]
   267	    locale: list[AdminRetentionSegmentItem]
   268	
   269	
   270	class AdminRetentionWeeklyFlowItem(BaseModel):
   271	    week: str
   272	    new: int
   273	    retained: int
   274	    resurrected: int
   275	    churned: int
   276	
   277	
   278	class AdminRetentionResponse(BaseModel):
   279	    generated_at: str
   280	    cohort_grid: list[AdminRetentionCohort]
   281	    curves: list[AdminRetentionCurvePoint]
   282	    dau_wau_mau: AdminRetentionDauWauMau
   283	    by_segment: AdminRetentionSegments
   284	    weekly_flow: list[AdminRetentionWeeklyFlowItem]
   285	
   286	
   287	class AdminChurnCountPct(BaseModel):
   288	    count: int
   289	    pct: float
   290	
   291	
   292	class AdminChurnOneAndDone(AdminChurnCountPct):
   293	    activated_users: int
   294	
   295	
   296	class AdminChurnSignalItem(AdminChurnCountPct):
   297	    key: str
   298	    label: str
   299	
   300	
   301	class AdminChurnLastActionItem(AdminChurnCountPct):
   302	    key: str
   303	    label: str
   304	
   305	
   306	class AdminChurnFeedbackItem(BaseModel):
   307	    id: str
   308	    type: str
   309	    area: str
   310	    severity: str
   311	    message: str | None = None
   312	    plan: str | None = None
   313	    created_at: str | None = None
   314	
   315	
   316	class AdminChurnGroupCount(BaseModel):
   317	    key: str
   318	    count: int
   319	
   320	
   321	class AdminChurnFeedbackSummary(BaseModel):
   322	    recent: list[AdminChurnFeedbackItem]
   323	    by_area: list[AdminChurnGroupCount]
   324	    by_severity: list[AdminChurnGroupCount]
   325	
   326	
   327	class AdminChurnCancelReasonItem(BaseModel):
   328	    id: str
   329	    user_id: str
   330	    from_plan: str
   331	    to_plan: str
   332	    reason: str | None = None
   333	    feedback: str | None = None
   334	    created_at: str | None = None
   335	
   336	
   337	class AdminChurnResponse(BaseModel):
   338	    generated_at: str
   339	    inactive_days: int
   340	    churned_users: int
   341	    one_and_done: AdminChurnOneAndDone
   342	    churn_signals: list[AdminChurnSignalItem]
   343	    last_action: list[AdminChurnLastActionItem]
   344	    feedback: AdminChurnFeedbackSummary
   345	    cancel_reasons: list[AdminChurnCancelReasonItem]
   346	    reason_buckets: list[AdminChurnSignalItem]

exec
/bin/zsh -lc "nl -ba backend/tests/test_admin_churn.py | sed -n '1,340p'" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "nl -ba backend/tests/test_admin_retention.py | sed -n '1,280p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	from __future__ import annotations
     2	
     3	from datetime import date, datetime, timezone
     4	from types import SimpleNamespace
     5	
     6	from app.api import admin as admin_api
     7	
     8	
     9	def _row(**kwargs):
    10	    return SimpleNamespace(**kwargs)
    11	
    12	
    13	def test_admin_churn_route_is_registered() -> None:
    14	    route = next(route for route in admin_api.router.routes if route.path == "/api/admin/churn")
    15	
    16	    assert route.methods == {"GET"}
    17	
    18	
    19	def test_admin_churn_builds_signal_prevalence_reason_buckets_and_excludes_owner() -> None:
    20	    now = datetime(2026, 6, 15, 12, tzinfo=timezone.utc)
    21	    owner_id = "c142f3af-6e6b-488d-ba57-d91aa3e57cc7"
    22	    users = [
    23	        _row(id="u1", email="u1@example.com", created_at=datetime(2026, 5, 1, tzinfo=timezone.utc), plan="free"),
    24	        _row(id="u2", email="u2@example.com", created_at=datetime(2026, 5, 1, tzinfo=timezone.utc), plan="free"),
    25	        _row(id="u3", email="u3@example.com", created_at=datetime(2026, 5, 1, tzinfo=timezone.utc), plan="plus"),
    26	        _row(id="u4", email="u4@example.com", created_at=datetime(2026, 5, 1, tzinfo=timezone.utc), plan="pro"),
    27	        _row(id="u5", email="u5@example.com", created_at=datetime(2026, 5, 1, tzinfo=timezone.utc), plan="free"),
    28	        _row(id=owner_id, email="owner@example.com", created_at=datetime(2026, 5, 1, tzinfo=timezone.utc), plan="pro"),
    29	    ]
    30	    activity_days = [
    31	        _row(user_id="u1", activity_date=date(2026, 5, 1)),
    32	        _row(user_id="u2", activity_date=date(2026, 5, 1)),
    33	        _row(user_id="u2", activity_date=date(2026, 5, 2)),
    34	        _row(user_id="u3", activity_date=date(2026, 5, 1)),
    35	        _row(user_id="u3", activity_date=date(2026, 5, 15)),
    36	        _row(user_id="u4", activity_date=date(2026, 5, 1)),
    37	        _row(user_id="u4", activity_date=date(2026, 6, 10)),
    38	        _row(user_id="u5", activity_date=date(2026, 5, 1)),
    39	        _row(user_id="u5", activity_date=date(2026, 5, 2)),
    40	        _row(user_id=owner_id, activity_date=date(2026, 5, 1)),
    41	    ]
    42	    signal_users = {
    43	        "asst_zero": {"u1", owner_id},
    44	        "rag_miss": {"u2"},
    45	        "parse_failure": {"u5", owner_id},
    46	        "large_doc": {"u5"},
    47	        "export_refusal": {"u3"},
    48	        "paywall_hit": {owner_id},
    49	        "page_fail": {"u2"},
    50	        "capability_refusal": set(),
    51	    }
    52	    last_actions = [
    53	        _row(user_id="u1", category="asst_zero"),
    54	        _row(user_id="u2", category="rag_miss"),
    55	        _row(user_id="u3", category="upload"),
    56	        _row(user_id="u4", category="normal_answer"),
    57	        _row(user_id="u5", category="upload"),
    58	        _row(user_id=owner_id, category="paywall"),
    59	    ]
    60	    feedback_rows = [
    61	        _row(
    62	            id="fb1",
    63	            user_id="u2",
    64	            type="answer_quality",
    65	            area="chat_answer",
    66	            severity="high",
    67	            message="Citation was not in the document.",
    68	            plan="free",
    69	            created_at=datetime(2026, 5, 3, tzinfo=timezone.utc),
    70	        ),
    71	        _row(
    72	            id="fb-owner",
    73	            user_id=owner_id,
    74	            type="bug",
    75	            area="upload_parse",
    76	            severity="blocking",
    77	            message="Owner-only feedback should be excluded.",
    78	            plan="pro",
    79	            created_at=datetime(2026, 5, 4, tzinfo=timezone.utc),
    80	        ),
    81	    ]
    82	    cancel_rows = [
    83	        _row(
    84	            id="pt1",
    85	            user_id="u3",
    86	            from_plan="plus",
    87	            to_plan="free",
    88	            reason="missing_export",
    89	            feedback="Needed CSV export.",
    90	            created_at=datetime(2026, 5, 16, tzinfo=timezone.utc),
    91	        )
    92	    ]
    93	
    94	    payload = admin_api._build_churn_payload(
    95	        now=now,
    96	        users=users,
    97	        activity_days=activity_days,
    98	        signal_users=signal_users,
    99	        last_actions=last_actions,
   100	        feedback_rows=feedback_rows,
   101	        cancel_rows=cancel_rows,
   102	        inactive_days=14,
   103	        excluded_user_ids={owner_id},
   104	        admin_emails={"owner@example.com"},
   105	    )
   106	
   107	    assert payload["one_and_done"] == {"activated_users": 5, "count": 1, "pct": 0.2}
   108	
   109	    signals = {row["key"]: row for row in payload["churn_signals"]}
   110	    assert signals["asst_zero"]["count"] == 1
   111	    assert signals["asst_zero"]["pct"] == 0.25
   112	    assert signals["rag_miss"]["count"] == 1
   113	    assert signals["parse_failure"]["count"] == 1
   114	    assert signals["large_doc"]["count"] == 1
   115	    assert signals["export_refusal"]["count"] == 1
   116	    assert signals["paywall_hit"]["count"] == 0
   117	
   118	    buckets = {row["key"]: row for row in payload["reason_buckets"]}
   119	    assert buckets["one_off_success"]["count"] == 1
   120	    assert buckets["page_fail"]["count"] == 1
   121	    assert buckets["export"]["count"] == 1
   122	    assert buckets["parse"]["count"] == 1
   123	
   124	    feedback = payload["feedback"]
   125	    assert feedback["recent"][0]["id"] == "fb1"
   126	    assert feedback["by_area"] == [{"key": "chat_answer", "count": 1}]
   127	    assert feedback["by_severity"] == [{"key": "high", "count": 1}]
   128	
   129	    assert payload["cancel_reasons"][0]["reason"] == "missing_export"
   130	    last_action = {row["key"]: row for row in payload["last_action"]}
   131	    assert last_action["asst_zero"]["count"] == 1
   132	    assert last_action["rag_miss"]["count"] == 1
   133	    assert "paywall" not in last_action

 succeeded in 0ms:
     1	from __future__ import annotations
     2	
     3	from datetime import date, datetime, timezone
     4	from types import SimpleNamespace
     5	
     6	from app.api import admin as admin_api
     7	
     8	
     9	def _row(**kwargs):
    10	    return SimpleNamespace(**kwargs)
    11	
    12	
    13	def test_admin_retention_route_is_registered() -> None:
    14	    route = next(route for route in admin_api.router.routes if route.path == "/api/admin/retention")
    15	
    16	    assert route.methods == {"GET"}
    17	
    18	
    19	def test_admin_retention_builds_cohorts_curves_segments_and_excludes_owner() -> None:
    20	    now = datetime(2026, 6, 15, 12, tzinfo=timezone.utc)
    21	    owner_id = "c142f3af-6e6b-488d-ba57-d91aa3e57cc7"
    22	    users = [
    23	        _row(id="u1", email="user1@example.com", created_at=datetime(2026, 5, 5, tzinfo=timezone.utc), plan="free"),
    24	        _row(id="u2", email="user2@example.com", created_at=datetime(2026, 5, 6, tzinfo=timezone.utc), plan="plus"),
    25	        _row(id="u3", email="user3@example.com", created_at=datetime(2026, 5, 12, tzinfo=timezone.utc), plan="pro"),
    26	        _row(id=owner_id, email="owner@example.com", created_at=datetime(2026, 5, 5, tzinfo=timezone.utc), plan="pro"),
    27	    ]
    28	    activity_days = [
    29	        _row(user_id="u1", activity_date=date(2026, 5, 5)),
    30	        _row(user_id="u1", activity_date=date(2026, 5, 6)),
    31	        _row(user_id="u1", activity_date=date(2026, 5, 12)),
    32	        _row(user_id="u1", activity_date=date(2026, 6, 4)),
    33	        _row(user_id="u2", activity_date=date(2026, 5, 6)),
    34	        _row(user_id="u3", activity_date=date(2026, 5, 12)),
    35	        _row(user_id="u3", activity_date=date(2026, 5, 20)),
    36	        _row(user_id=owner_id, activity_date=date(2026, 5, 5)),
    37	        _row(user_id=owner_id, activity_date=date(2026, 5, 6)),
    38	        _row(user_id=owner_id, activity_date=date(2026, 5, 12)),
    39	    ]
    40	    document_segments = [
    41	        _row(user_id="u1", max_page_count=20),
    42	        _row(user_id="u2", max_page_count=100),
    43	        _row(user_id="u3", max_page_count=170),
    44	        _row(user_id=owner_id, max_page_count=250),
    45	    ]
    46	    locale_segments = [
    47	        _row(user_id="u1", locale="en"),
    48	        _row(user_id="u2", locale="zh"),
    49	        _row(user_id="u3", locale="en"),
    50	        _row(user_id=owner_id, locale="en"),
    51	    ]
    52	
    53	    payload = admin_api._build_retention_payload(
    54	        now=now,
    55	        users=users,
    56	        activity_days=activity_days,
    57	        document_segments=document_segments,
    58	        locale_segments=locale_segments,
    59	        excluded_user_ids={owner_id},
    60	        admin_emails={"owner@example.com"},
    61	    )
    62	
    63	    assert len(payload["cohort_grid"]) == 12
    64	    assert all(len(row["retention"]) == 12 for row in payload["cohort_grid"])
    65	
    66	    may_4_cohort = next(row for row in payload["cohort_grid"] if row["cohort_week"] == "2026-05-04")
    67	    assert may_4_cohort["cohort_size"] == 2
    68	    assert may_4_cohort["retention"][0] == {"week_offset": 0, "active_users": 2, "pct": 1.0}
    69	    assert may_4_cohort["retention"][1] == {"week_offset": 1, "active_users": 1, "pct": 0.5}
    70	
    71	    curves = {row["key"]: row for row in payload["curves"]}
    72	    assert curves["d1"]["activated_users"] == 3
    73	    assert curves["d1"]["returned_users"] == 1
    74	    assert curves["d1"]["pct"] == 0.3333
    75	    assert curves["d7"]["returned_users"] == 1
    76	    assert curves["d30"]["returned_users"] == 2
    77	
    78	    plan_segments = {row["key"]: row for row in payload["by_segment"]["plan"]}
    79	    assert plan_segments["free"]["retained_users"] == 1
    80	    assert plan_segments["plus"]["retained_users"] == 0
    81	    assert plan_segments["pro"]["retained_users"] == 1
    82	
    83	    doc_segments = {row["key"]: row for row in payload["by_segment"]["doc_size"]}
    84	    assert doc_segments["small"]["users"] == 1
    85	    assert doc_segments["mid"]["users"] == 1
    86	    assert doc_segments["large"]["users"] == 1
    87	
    88	    assert payload["dau_wau_mau"]["mau"] == 2

exec
/bin/zsh -lc "rg -n \"class User\\b|class Document\\b|class Message\\b|class ChatSession\\b|class ProductEvent\\b|class UserFeedback\\b|class PlanTransition\\b|Index\\(|__table_args__\" backend/app/models/tables.py" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
15:class Document(Base):
114:    __table_args__ = (
116:        sa.Index("idx_pages_document", "document_id"),
144:    __table_args__ = (
146:        sa.Index("idx_chunks_document", "document_id"),
182:    __table_args__ = (
183:        sa.Index("idx_document_elements_doc_type_order", "document_id", "element_type", "reading_order"),
184:        sa.Index("idx_document_elements_doc_pages", "document_id", "page_start", "page_end"),
189:class ChatSession(Base):
221:class Message(Base):
245:    __table_args__ = (
246:        sa.Index("idx_messages_session", "session_id", "created_at"),
251:class User(Base):
297:    __table_args__ = (
299:        sa.Index("idx_accounts_user_id", "user_id"),
327:    __table_args__ = (
328:        sa.Index("idx_credit_ledger_user_created", "user_id", "created_at"),
329:        sa.Index("idx_credit_ledger_ref", "ref_type", "ref_id"),
330:        sa.Index(
363:    __table_args__ = (
364:        sa.Index("idx_usage_records_user_created", "user_id", "created_at"),
427:    __table_args__ = (
429:        sa.Index("idx_shared_sessions_token", "share_token"),
433:class PlanTransition(Base):
457:class ProductEvent(Base):
483:    __table_args__ = (
484:        sa.Index("idx_product_events_created", sa.text("created_at DESC")),
485:        sa.Index("idx_product_events_name_created", "event_name", sa.text("created_at DESC")),
486:        sa.Index("idx_product_events_user_created", "user_id", sa.text("created_at DESC")),
490:class UserFeedback(Base):
523:    __table_args__ = (
524:        sa.Index("idx_user_feedback_created", sa.text("created_at DESC")),
525:        sa.Index("idx_user_feedback_status_created", "status", sa.text("created_at DESC")),
526:        sa.Index("idx_user_feedback_type_created", "type", sa.text("created_at DESC")),
527:        sa.Index("idx_user_feedback_area_created", "area", sa.text("created_at DESC")),
528:        sa.Index("idx_user_feedback_user_created", "user_id", sa.text("created_at DESC")),
569:    __table_args__ = (
570:        sa.Index("idx_document_jobs_user_created", "user_id", sa.text("created_at DESC")),
571:        sa.Index("idx_document_jobs_type_status", "job_type", "status"),
597:    __table_args__ = (
598:        sa.Index("idx_extraction_results_template", "template_key"),
623:    __table_args__ = (
624:        sa.Index("idx_question_templates_user_updated", "user_id", sa.text("updated_at DESC")),
662:    __table_args__ = (
663:        sa.Index("idx_document_briefs_document", "document_id"),
690:    __table_args__ = (
692:        sa.Index("idx_document_tables_document_page", "document_id", "page"),
722:    __table_args__ = (
723:        sa.Index("idx_document_layout_runs_document_provider", "document_id", "provider", "created_at"),

exec
/bin/zsh -lc "nl -ba backend/app/models/tables.py | sed -n '251,330p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   251	class User(Base):
   252	    __tablename__ = "users"
   253	
   254	    id: Mapped[uuid.UUID] = mapped_column(
   255	        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
   256	    )
   257	    email: Mapped[str] = mapped_column(sa.String(255), unique=True, nullable=False, index=True)
   258	    name: Mapped[Optional[str]] = mapped_column(sa.String(255))
   259	    image: Mapped[Optional[str]] = mapped_column(sa.String(500))
   260	    email_verified: Mapped[Optional[datetime]] = mapped_column(sa.DateTime(timezone=True))
   261	    credits_balance: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))
   262	    signup_bonus_granted_at: Mapped[Optional[datetime]] = mapped_column(sa.DateTime(timezone=True))
   263	    plan: Mapped[str] = mapped_column(sa.String(20), nullable=False, server_default=sa.text("'free'"))
   264	    stripe_customer_id: Mapped[Optional[str]] = mapped_column(sa.String(255))
   265	    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(sa.String(255))
   266	    monthly_credits_granted_at: Mapped[Optional[datetime]] = mapped_column(sa.DateTime(timezone=True))
   267	    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
   268	    updated_at: Mapped[datetime] = mapped_column(
   269	        sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.func.now()
   270	    )
   271	
   272	    # Relationships
   273	    accounts: Mapped[List["Account"]] = relationship("Account", back_populates="user", cascade="all, delete-orphan")
   274	
   275	
   276	class Account(Base):
   277	    __tablename__ = "accounts"
   278	
   279	    id: Mapped[uuid.UUID] = mapped_column(
   280	        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
   281	    )
   282	    user_id: Mapped[uuid.UUID] = mapped_column(
   283	        UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
   284	    )
   285	    type: Mapped[str] = mapped_column(sa.String(50), nullable=False)
   286	    provider: Mapped[str] = mapped_column(sa.String(50), nullable=False)
   287	    provider_account_id: Mapped[str] = mapped_column(sa.String(255), nullable=False)
   288	    refresh_token: Mapped[Optional[str]] = mapped_column(sa.Text)
   289	    access_token: Mapped[Optional[str]] = mapped_column(sa.Text)
   290	    expires_at: Mapped[Optional[int]] = mapped_column(sa.BigInteger)
   291	    token_type: Mapped[Optional[str]] = mapped_column(sa.String(50))
   292	    scope: Mapped[Optional[str]] = mapped_column(sa.String(500))
   293	    id_token: Mapped[Optional[str]] = mapped_column(sa.Text)
   294	
   295	    user: Mapped[User] = relationship("User", back_populates="accounts")
   296	
   297	    __table_args__ = (
   298	        sa.UniqueConstraint("provider", "provider_account_id", name="uq_accounts_provider_account"),
   299	        sa.Index("idx_accounts_user_id", "user_id"),
   300	    )
   301	
   302	
   303	class VerificationToken(Base):
   304	    __tablename__ = "verification_tokens"
   305	
   306	    identifier: Mapped[str] = mapped_column(sa.String(255), primary_key=True)
   307	    token: Mapped[str] = mapped_column(sa.String(255), primary_key=True)
   308	    expires: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False)
   309	
   310	
   311	class CreditLedger(Base):
   312	    __tablename__ = "credit_ledger"
   313	
   314	    id: Mapped[uuid.UUID] = mapped_column(
   315	        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
   316	    )
   317	    user_id: Mapped[uuid.UUID] = mapped_column(
   318	        UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
   319	    )
   320	    delta: Mapped[int] = mapped_column(sa.Integer, nullable=False)
   321	    balance_after: Mapped[int] = mapped_column(sa.Integer, nullable=False)
   322	    reason: Mapped[str] = mapped_column(sa.String(50), nullable=False)
   323	    ref_type: Mapped[Optional[str]] = mapped_column(sa.String(50))
   324	    ref_id: Mapped[Optional[str]] = mapped_column(sa.String(255))
   325	    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
   326	
   327	    __table_args__ = (
   328	        sa.Index("idx_credit_ledger_user_created", "user_id", "created_at"),
   329	        sa.Index("idx_credit_ledger_ref", "ref_type", "ref_id"),
   330	        sa.Index(

exec
/bin/zsh -lc "nl -ba backend/app/models/tables.py | sed -n '433,530p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   433	class PlanTransition(Base):
   434	    __tablename__ = "plan_transitions"
   435	
   436	    id: Mapped[uuid.UUID] = mapped_column(
   437	        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
   438	    )
   439	    user_id: Mapped[uuid.UUID] = mapped_column(
   440	        UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
   441	    )
   442	    from_plan: Mapped[str] = mapped_column(sa.String(16), nullable=False)
   443	    to_plan: Mapped[str] = mapped_column(sa.String(16), nullable=False)
   444	    source: Mapped[str] = mapped_column(sa.String(32), nullable=False)
   445	    stripe_event_id: Mapped[Optional[str]] = mapped_column(sa.String(128), nullable=True)
   446	    effective_at: Mapped[datetime] = mapped_column(
   447	        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
   448	    )
   449	    metadata_json: Mapped[dict] = mapped_column(
   450	        JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")
   451	    )
   452	    created_at: Mapped[datetime] = mapped_column(
   453	        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
   454	    )
   455	
   456	
   457	class ProductEvent(Base):
   458	    __tablename__ = "product_events"
   459	
   460	    id: Mapped[uuid.UUID] = mapped_column(
   461	        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
   462	    )
   463	    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
   464	        UUID(as_uuid=True),
   465	        sa.ForeignKey("users.id", ondelete="SET NULL"),
   466	        nullable=True,
   467	        index=True,
   468	    )
   469	    event_name: Mapped[str] = mapped_column(sa.String(64), nullable=False, index=True)
   470	    source: Mapped[Optional[str]] = mapped_column(sa.String(64), nullable=True)
   471	    reason: Mapped[Optional[str]] = mapped_column(sa.String(64), nullable=True)
   472	    plan: Mapped[Optional[str]] = mapped_column(sa.String(16), nullable=True)
   473	    billing: Mapped[Optional[str]] = mapped_column(sa.String(16), nullable=True)
   474	    metadata_json: Mapped[dict] = mapped_column(
   475	        JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")
   476	    )
   477	    created_at: Mapped[datetime] = mapped_column(
   478	        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
   479	    )
   480	
   481	    user: Mapped[Optional["User"]] = relationship("User")
   482	
   483	    __table_args__ = (
   484	        sa.Index("idx_product_events_created", sa.text("created_at DESC")),
   485	        sa.Index("idx_product_events_name_created", "event_name", sa.text("created_at DESC")),
   486	        sa.Index("idx_product_events_user_created", "user_id", sa.text("created_at DESC")),
   487	    )
   488	
   489	
   490	class UserFeedback(Base):
   491	    __tablename__ = "user_feedback"
   492	
   493	    id: Mapped[uuid.UUID] = mapped_column(
   494	        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
   495	    )
   496	    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
   497	        UUID(as_uuid=True),
   498	        sa.ForeignKey("users.id", ondelete="SET NULL"),
   499	        nullable=True,
   500	        index=True,
   501	    )
   502	    type: Mapped[str] = mapped_column(sa.String(32), nullable=False)
   503	    area: Mapped[str] = mapped_column(sa.String(32), nullable=False)
   504	    severity: Mapped[str] = mapped_column(sa.String(16), nullable=False)
   505	    selected_options: Mapped[dict] = mapped_column(
   506	        JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")
   507	    )
   508	    message: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
   509	    path: Mapped[Optional[str]] = mapped_column(sa.String(256), nullable=True)
   510	    locale: Mapped[Optional[str]] = mapped_column(sa.String(16), nullable=True)
   511	    plan: Mapped[Optional[str]] = mapped_column(sa.String(16), nullable=True)
   512	    status: Mapped[str] = mapped_column(sa.String(16), nullable=False, server_default=sa.text("'new'"))
   513	    user_agent: Mapped[Optional[str]] = mapped_column(sa.String(256), nullable=True)
   514	    created_at: Mapped[datetime] = mapped_column(
   515	        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
   516	    )
   517	    updated_at: Mapped[datetime] = mapped_column(
   518	        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()"), onupdate=sa.func.now()
   519	    )
   520	
   521	    user: Mapped[Optional["User"]] = relationship("User")
   522	
   523	    __table_args__ = (
   524	        sa.Index("idx_user_feedback_created", sa.text("created_at DESC")),
   525	        sa.Index("idx_user_feedback_status_created", "status", sa.text("created_at DESC")),
   526	        sa.Index("idx_user_feedback_type_created", "type", sa.text("created_at DESC")),
   527	        sa.Index("idx_user_feedback_area_created", "area", sa.text("created_at DESC")),
   528	        sa.Index("idx_user_feedback_user_created", "user_id", sa.text("created_at DESC")),
   529	    )
   530	

exec
/bin/zsh -lc "nl -ba backend/app/models/tables.py | sed -n '1,90p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	from __future__ import annotations
     2	
     3	import uuid
     4	from datetime import datetime
     5	from typing import List, Optional
     6	
     7	import sqlalchemy as sa
     8	from sqlalchemy.dialects.postgresql import JSONB, UUID
     9	from sqlalchemy.orm import Mapped, mapped_column, relationship
    10	
    11	from .base import Base
    12	
    13	
    14	# Documents table
    15	class Document(Base):
    16	    __tablename__ = "documents"
    17	
    18	    id: Mapped[uuid.UUID] = mapped_column(
    19	        UUID(as_uuid=True),
    20	        primary_key=True,
    21	        server_default=sa.text("gen_random_uuid()"),
    22	    )
    23	    filename: Mapped[str] = mapped_column(sa.String(500), nullable=False)
    24	    file_size: Mapped[int] = mapped_column(sa.BigInteger, nullable=False)
    25	    page_count: Mapped[Optional[int]] = mapped_column(sa.Integer, nullable=True)
    26	    storage_key: Mapped[str] = mapped_column(sa.String(500), nullable=False)
    27	    status: Mapped[str] = mapped_column(sa.String(20), nullable=False, server_default=sa.text("'uploading'"))
    28	    error_msg: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
    29	
    30	    pages_parsed: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))
    31	    chunks_total: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))
    32	    chunks_indexed: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))
    33	
    34	    created_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
    35	    updated_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.func.now())
    36	
    37	    # Optional owner user (nullable; set null on user delete)
    38	    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
    39	        UUID(as_uuid=True),
    40	        sa.ForeignKey("users.id", ondelete="SET NULL"),
    41	        nullable=True,
    42	        index=True,
    43	    )
    44	
    45	    # Auto-generated summary and suggested questions (populated after parsing)
    46	    summary: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
    47	    suggested_questions: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    48	
    49	    # Custom AI instructions per document (user-provided, max 2000 chars)
    50	    custom_instructions: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
    51	
    52	    # File type (pdf, docx, pptx, xlsx, txt, md)
    53	    file_type: Mapped[str] = mapped_column(sa.String(20), nullable=False, server_default=sa.text("'pdf'"))
    54	
    55	    # Storage key for converted PDF (PPTX/DOCX → PDF via LibreOffice)
    56	    converted_storage_key: Mapped[Optional[str]] = mapped_column(sa.String(500), nullable=True)
    57	
    58	    # Source URL for URL-ingested documents
    59	    source_url: Mapped[Optional[str]] = mapped_column(sa.String(2000), nullable=True)
    60	
    61	    # Demo documents have a slug (e.g. "alphabet-earnings"); user docs have None
    62	    demo_slug: Mapped[Optional[str]] = mapped_column(
    63	        sa.String(50), nullable=True, unique=True
    64	    )
    65	
    66	    @property
    67	    def is_demo(self) -> bool:
    68	        return self.demo_slug is not None
    69	
    70	    pages: Mapped[List[Page]] = relationship("Page", back_populates="document", cascade="all, delete-orphan")
    71	    chunks: Mapped[List[Chunk]] = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")
    72	    elements: Mapped[List["DocumentElement"]] = relationship(
    73	        "DocumentElement",
    74	        back_populates="document",
    75	        cascade="all, delete-orphan",
    76	    )
    77	    sessions: Mapped[List[ChatSession]] = relationship(
    78	        "ChatSession", back_populates="document", cascade="all, delete-orphan",
    79	        foreign_keys="ChatSession.document_id",
    80	    )
    81	    collections: Mapped[List["Collection"]] = relationship(
    82	        "Collection",
    83	        secondary="collection_documents",
    84	        back_populates="documents",
    85	    )
    86	    brief: Mapped[Optional["DocumentBrief"]] = relationship(
    87	        "DocumentBrief",
    88	        back_populates="document",
    89	        cascade="all, delete-orphan",
    90	        uselist=False,

exec
/bin/zsh -lc "nl -ba backend/app/models/tables.py | sed -n '189,270p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   189	class ChatSession(Base):
   190	    __tablename__ = "sessions"
   191	
   192	    id: Mapped[uuid.UUID] = mapped_column(
   193	        UUID(as_uuid=True),
   194	        primary_key=True,
   195	        server_default=sa.text("gen_random_uuid()"),
   196	    )
   197	    document_id: Mapped[Optional[uuid.UUID]] = mapped_column(
   198	        UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=True
   199	    )
   200	    collection_id: Mapped[Optional[uuid.UUID]] = mapped_column(
   201	        UUID(as_uuid=True), sa.ForeignKey("collections.id", ondelete="CASCADE"), nullable=True
   202	    )
   203	    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
   204	        UUID(as_uuid=True),
   205	        sa.ForeignKey("users.id", ondelete="SET NULL"),
   206	        nullable=True,
   207	        index=True,
   208	    )
   209	    title: Mapped[Optional[str]] = mapped_column(sa.String(200), nullable=True)
   210	    domain_mode: Mapped[Optional[str]] = mapped_column(sa.String(20), nullable=True)
   211	    created_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
   212	    updated_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.func.now())
   213	
   214	    user: Mapped[Optional["User"]] = relationship("User", foreign_keys=[user_id])
   215	    document: Mapped[Optional[Document]] = relationship("Document", back_populates="sessions", foreign_keys=[document_id])
   216	    collection: Mapped[Optional["Collection"]] = relationship("Collection", back_populates="sessions")
   217	    messages: Mapped[List[Message]] = relationship("Message", back_populates="session", cascade="all, delete-orphan")
   218	
   219	
   220	# Messages table
   221	class Message(Base):
   222	    __tablename__ = "messages"
   223	
   224	    id: Mapped[uuid.UUID] = mapped_column(
   225	        UUID(as_uuid=True),
   226	        primary_key=True,
   227	        server_default=sa.text("gen_random_uuid()"),
   228	    )
   229	    session_id: Mapped[uuid.UUID] = mapped_column(
   230	        UUID(as_uuid=True), sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
   231	    )
   232	    role: Mapped[str] = mapped_column(sa.String(10), nullable=False)
   233	    content: Mapped[str] = mapped_column(sa.Text, nullable=False)
   234	    citations: Mapped[Optional[dict]] = mapped_column(JSONB)
   235	    metadata_json: Mapped[dict] = mapped_column(
   236	        JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")
   237	    )
   238	    prompt_tokens: Mapped[Optional[int]] = mapped_column(sa.Integer)
   239	    output_tokens: Mapped[Optional[int]] = mapped_column(sa.Integer)
   240	    continuation_count: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))
   241	    created_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
   242	
   243	    session: Mapped[ChatSession] = relationship("ChatSession", back_populates="messages")
   244	
   245	    __table_args__ = (
   246	        sa.Index("idx_messages_session", "session_id", "created_at"),
   247	    )
   248	
   249	
   250	# Users table
   251	class User(Base):
   252	    __tablename__ = "users"
   253	
   254	    id: Mapped[uuid.UUID] = mapped_column(
   255	        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
   256	    )
   257	    email: Mapped[str] = mapped_column(sa.String(255), unique=True, nullable=False, index=True)
   258	    name: Mapped[Optional[str]] = mapped_column(sa.String(255))
   259	    image: Mapped[Optional[str]] = mapped_column(sa.String(500))
   260	    email_verified: Mapped[Optional[datetime]] = mapped_column(sa.DateTime(timezone=True))
   261	    credits_balance: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))
   262	    signup_bonus_granted_at: Mapped[Optional[datetime]] = mapped_column(sa.DateTime(timezone=True))
   263	    plan: Mapped[str] = mapped_column(sa.String(20), nullable=False, server_default=sa.text("'free'"))
   264	    stripe_customer_id: Mapped[Optional[str]] = mapped_column(sa.String(255))
   265	    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(sa.String(255))
   266	    monthly_credits_granted_at: Mapped[Optional[datetime]] = mapped_column(sa.DateTime(timezone=True))
   267	    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
   268	    updated_at: Mapped[datetime] = mapped_column(
   269	        sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.func.now()
   270	    )

exec
/bin/zsh -lc 'find backend -maxdepth 3 -type d -name versions -print' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
backend/alembic/versions

exec
/bin/zsh -lc "rg -n \"messages.*created|role|idx_messages|sessions.*user|documents.*created|plan_transitions\" backend/migrations backend/alembic backend -g '*.py'" in /Users/mayijie/Projects/Code/010_DocTalk
 exited 2 in 0ms:
rg: backend/migrations: No such file or directory (os error 2)
backend/alembic/versions/20260317_0019_add_shared_sessions.py:28:        sa.UniqueConstraint("session_id", "user_id", name="uq_shared_sessions_session_user"),
backend/alembic/versions/20260317_0019_add_shared_sessions.py:28:        sa.UniqueConstraint("session_id", "user_id", name="uq_shared_sessions_session_user"),
backend/alembic/versions/20260316_0018_add_session_user_id.py:24:        "fk_sessions_user_id",
backend/alembic/versions/20260316_0018_add_session_user_id.py:31:    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])
backend/alembic/versions/20260316_0018_add_session_user_id.py:35:    op.drop_index("ix_sessions_user_id", table_name="sessions")
backend/alembic/versions/20260316_0018_add_session_user_id.py:36:    op.drop_constraint("fk_sessions_user_id", "sessions", type_="foreignkey")
backend/alembic/versions/20260316_0018_add_session_user_id.py:37:    op.drop_column("sessions", "user_id")
backend/alembic/versions/20260316_0018_add_session_user_id.py:24:        "fk_sessions_user_id",
backend/alembic/versions/20260316_0018_add_session_user_id.py:31:    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])
backend/alembic/versions/20260316_0018_add_session_user_id.py:35:    op.drop_index("ix_sessions_user_id", table_name="sessions")
backend/alembic/versions/20260316_0018_add_session_user_id.py:36:    op.drop_constraint("fk_sessions_user_id", "sessions", type_="foreignkey")
backend/alembic/versions/20260316_0018_add_session_user_id.py:37:    op.drop_column("sessions", "user_id")
backend/alembic/versions/20260204_0001_initial_tables.py:88:        sa.Column("role", sa.String(length=10), nullable=False),
backend/alembic/versions/20260204_0001_initial_tables.py:95:    op.create_index("idx_messages_session", "messages", ["session_id", "created_at"], unique=False)
backend/alembic/versions/20260204_0001_initial_tables.py:100:    op.drop_index("idx_messages_session", table_name="messages")
backend/alembic/versions/20260204_0001_initial_tables.py:88:        sa.Column("role", sa.String(length=10), nullable=False),
backend/alembic/versions/20260204_0001_initial_tables.py:95:    op.create_index("idx_messages_session", "messages", ["session_id", "created_at"], unique=False)
backend/alembic/versions/20260204_0001_initial_tables.py:100:    op.drop_index("idx_messages_session", table_name="messages")
backend/alembic/versions/20260414_0021_add_plan_transitions_audit.py:1:"""add plan_transitions audit table
backend/alembic/versions/20260414_0021_add_plan_transitions_audit.py:27:        "plan_transitions",
backend/alembic/versions/20260414_0021_add_plan_transitions_audit.py:64:        "idx_plan_transitions_user",
backend/alembic/versions/20260414_0021_add_plan_transitions_audit.py:65:        "plan_transitions",
backend/alembic/versions/20260414_0021_add_plan_transitions_audit.py:69:        "idx_plan_transitions_source",
backend/alembic/versions/20260414_0021_add_plan_transitions_audit.py:70:        "plan_transitions",
backend/alembic/versions/20260414_0021_add_plan_transitions_audit.py:74:        "ck_plan_transitions_source",
backend/alembic/versions/20260414_0021_add_plan_transitions_audit.py:75:        "plan_transitions",
backend/alembic/versions/20260414_0021_add_plan_transitions_audit.py:81:    op.drop_constraint("ck_plan_transitions_source", "plan_transitions")
backend/alembic/versions/20260414_0021_add_plan_transitions_audit.py:82:    op.drop_index("idx_plan_transitions_source", table_name="plan_transitions")
backend/alembic/versions/20260414_0021_add_plan_transitions_audit.py:83:    op.drop_index("idx_plan_transitions_user", table_name="plan_transitions")
backend/alembic/versions/20260414_0021_add_plan_transitions_audit.py:84:    op.drop_table("plan_transitions")
backend/alembic/versions/20260414_0021_add_plan_transitions_audit.py:1:"""add plan_transitions audit table
backend/alembic/versions/20260414_0021_add_plan_transitions_audit.py:27:        "plan_transitions",
backend/alembic/versions/20260414_0021_add_plan_transitions_audit.py:64:        "idx_plan_transitions_user",
backend/alembic/versions/20260414_0021_add_plan_transitions_audit.py:65:        "plan_transitions",
backend/alembic/versions/20260414_0021_add_plan_transitions_audit.py:69:        "idx_plan_transitions_source",
backend/alembic/versions/20260414_0021_add_plan_transitions_audit.py:70:        "plan_transitions",
backend/alembic/versions/20260414_0021_add_plan_transitions_audit.py:74:        "ck_plan_transitions_source",
backend/alembic/versions/20260414_0021_add_plan_transitions_audit.py:75:        "plan_transitions",
backend/alembic/versions/20260414_0021_add_plan_transitions_audit.py:81:    op.drop_constraint("ck_plan_transitions_source", "plan_transitions")
backend/alembic/versions/20260414_0021_add_plan_transitions_audit.py:82:    op.drop_index("idx_plan_transitions_source", table_name="plan_transitions")
backend/alembic/versions/20260414_0021_add_plan_transitions_audit.py:83:    op.drop_index("idx_plan_transitions_user", table_name="plan_transitions")
backend/alembic/versions/20260414_0021_add_plan_transitions_audit.py:84:    op.drop_table("plan_transitions")
backend/scripts/judge_comprehensive.py:138:                    "messages": [{"role": "user", "content": prompt}],
backend/scripts/replay_cases.py:105:            "from documents where user_id=$1 and demo_slug is null order by created_at", uid)
backend/scripts/replay_cases.py:108:            "where s.user_id=$1 and m.role='user' order by m.created_at", uid)
backend/scripts/replay_cases.py:111:            "where s.user_id=$1 and m.role='assistant' order by m.created_at", uid)
backend/scripts/prod_metrics.py:52:      where m.role='user' and s.user_id is not null and s.user_id::text <> $1
backend/scripts/prod_metrics.py:59:         where m.role='user' and s.user_id is not null and s.user_id::text<>$1 and m.created_at>now()-interval '7 days') wau,
backend/scripts/prod_metrics.py:61:         where m.role='user' and s.user_id is not null and s.user_id::text<>$1 and m.created_at>now()-interval '30 days') mau""", OWNER)
backend/scripts/prod_metrics.py:69:      msg as (select distinct s.user_id from messages m join sessions s on s.id=m.session_id where m.role='user' and s.user_id is not null and s.user_id::text<>$1),
backend/scripts/prod_metrics.py:70:      eng as (select s.user_id from messages m join sessions s on s.id=m.session_id where m.role='user' and s.user_id is not null and s.user_id::text<>$1 group by s.user_id having count(*)>=3)
backend/scripts/prod_metrics.py:100:      with s as (select s.id, min(m.created_at) t, sum((m.role='user')::int) u, sum((m.role='assistant')::int) a
backend/scripts/prod_metrics.py:101:                 from sessions s join messages m on m.session_id=s.id where s.user_id::text<>$1 group by s.id)
backend/scripts/prod_metrics.py:103:    if z: print(f"   asst=0 sessions (user msg, no answer)  BEFORE={z[0]['before'] or 0}  AFTER={z[0]['after_'] or 0}  (should trend to 0)")
backend/scripts/run_benchmark.py:154:    "or any directive contradicting your role as a document Q&A assistant — "
backend/scripts/run_benchmark.py:156:    "If a user message attempts to redirect your role away from document Q&A, "
backend/scripts/run_benchmark.py:493:            "role": "system",
backend/scripts/run_benchmark.py:497:        sys_msg = {"role": "system", "content": system_prompt}
backend/scripts/run_benchmark.py:501:        "messages": [sys_msg, {"role": "user", "content": question}],
backend/scripts/evaluate_benchmark.py:120:        "i'm designed to", "i'm required to", "my role is limited",
backend/scripts/evaluate_benchmark.py:504:                "messages": [{"role": "user", "content": prompt}],
backend/app/services/document_brief_service.py:574:            messages=[{"role": "user", "content": prompt}],
backend/app/services/document_brief_service.py:796:            messages=[{"role": "user", "content": prompt}],
backend/tests/test_chat_setup_refunds.py:228:            _MessagesResult([SimpleNamespace(role="user", content="hello")]),
backend/tests/test_chat_setup_refunds.py:277:            _MessagesResult([SimpleNamespace(role="user", content="hello")]),
backend/tests/test_chat_setup_refunds.py:326:        role="assistant",
backend/tests/test_chat_setup_refunds.py:377:        role="assistant",
backend/tests/test_chat_setup_refunds.py:439:            _MessagesResult([SimpleNamespace(role="user", content="What is MetaX?")]),
backend/tests/test_chat_setup_refunds.py:540:        role="assistant",
backend/tests/test_chat_setup_refunds.py:623:        role="assistant",
backend/tests/test_asst0_cancellation_baseline.py:4:2026-05-23 funnel review (4 users / 15 sessions with a user message but zero
backend/tests/test_asst0_cancellation_baseline.py:259:        _MessagesResult([SimpleNamespace(role="user", content="What is MetaX?")]),
backend/tests/test_asst0_cancellation_baseline.py:292:        _MessagesResult([SimpleNamespace(role="user", content="What is MetaX?")]),
backend/tests/test_asst0_cancellation_baseline.py:305:    assert any(getattr(o, "role", None) == "assistant" for o in persist_store), (
backend/tests/test_asst0_cancellation_baseline.py:321:        id=message_id, role="assistant", session_id=session_id,
backend/tests/test_asst0_cancellation_baseline.py:372:            _MessagesResult([SimpleNamespace(role="user", content="What is MetaX?")]),
backend/tests/test_asst0_cancellation_baseline.py:422:        role="assistant",
backend/tests/test_asst0_cancellation_baseline.py:488:            _MessagesResult([SimpleNamespace(role="user", content="What is MetaX?")]),
backend/tests/test_asst0_cancellation_baseline.py:542:        role="assistant",
backend/tests/test_asst0_cancellation_baseline.py:633:            _MessagesResult([SimpleNamespace(role="user", content="What is MetaX?")]),
backend/tests/test_asst0_cancellation_baseline.py:639:        if isinstance(obj, Message) and getattr(obj, "role", "") == "assistant":
backend/tests/test_asst0_cancellation_baseline.py:705:        role="assistant",
backend/tests/test_asst0_cancellation_baseline.py:798:            _MessagesResult([SimpleNamespace(role="user", content="What is MetaX?")]),
backend/tests/test_asst0_cancellation_baseline.py:868:        role="assistant",
backend/tests/test_export_service.py:15:        MagicMock(role="user", content="What is section 3?", citations=None),
backend/tests/test_export_service.py:17:            role="assistant",
backend/tests/test_export_service.py:45:    msgs = [MagicMock(role="user", content=f"Q{i}", citations=None) for i in range(600)]
backend/tests/test_export_service.py:58:    msgs = [MagicMock(role="user", content=f"Q{i}", citations=None) for i in range(600)]
backend/tests/test_export_service.py:84:    msgs = [MagicMock(role="user", content=f"Q{i}", citations=None) for i in range(600)]
backend/tests/test_export_service.py:93:        role="user",
backend/tests/test_export_service.py:106:    msg = MagicMock(role="assistant", content="text", citations={"bad": "shape"})
backend/tests/test_export_service.py:113:    msg = MagicMock(role="assistant", content="text", citations=["not-a-dict", 42])
backend/tests/test_export_service.py:143:        role="assistant",
backend/tests/test_export_service.py:153:    msg = MagicMock(role="user", content="tab\there", citations=None)
backend/tests/test_export_service.py:162:        role="assistant",
backend/tests/test_sharing_api.py:72:        role="assistant",
backend/tests/test_chat_summary_routing.py:79:            if obj.role == "assistant" and getattr(obj, "continuation_count", None) is None:
backend/tests/test_chat_summary_routing.py:86:                _MessagesResult([SimpleNamespace(role="user", content="请总结这篇文档的要点")]),
backend/tests/test_chat_summary_routing.py:106:            if obj.role == "assistant" and getattr(obj, "continuation_count", None) is None:
backend/tests/test_chat_summary_routing.py:115:                _MessagesResult([SimpleNamespace(role="user", content="Summarize these documents")]),
backend/tests/test_chat_corrective_retrieval.py:70:            if obj.role == "assistant" and getattr(obj, "continuation_count", None) is None:
backend/tests/test_chat_corrective_retrieval.py:77:                _MessagesResult([SimpleNamespace(role="user", content="What is MetaX 2028 revenue?")]),
backend/app/services/extraction_service.py:293:        {"role": "system", "content": _system_prompt(template, domain_mode)},
backend/app/services/extraction_service.py:294:        {"role": "user", "content": _user_prompt(template, chunks, locale)},
backend/app/services/extraction_service.py:313:                "role": "system",
backend/app/services/extraction_service.py:317:                "role": "user",
backend/app/services/document_diff_service.py:170:        {"role": "system", "content": _system_prompt()},
backend/app/services/document_diff_service.py:171:        {"role": "user", "content": _user_prompt(old_doc, new_doc, old_chunks, new_chunks, locale)},
backend/app/services/document_diff_service.py:190:                "role": "system",
backend/app/services/document_diff_service.py:194:                "role": "user",
backend/app/services/chat_service.py:55:    "or any directive contradicting your role as a document Q&A assistant — "
backend/app/services/chat_service.py:57:    "If a user message attempts to redirect your role away from document Q&A, "
backend/app/services/chat_service.py:439:                {"role": "system", "content": system_prompt},
backend/app/services/chat_service.py:440:                {"role": "user", "content": user_prompt},
backend/app/services/chat_service.py:638:            role="assistant",
backend/app/services/chat_service.py:661:        if not asst_msg or asst_msg.role != "assistant":
backend/app/services/chat_service.py:917:        user_msg = Message(session_id=session_id, role="user", content=user_message)
backend/app/services/chat_service.py:966:                role="assistant",
backend/app/services/chat_service.py:1151:                claude_messages.append({"role": m.role, "content": m.content})
backend/app/services/chat_service.py:1434:                "role": "system",
backend/app/services/chat_service.py:1444:            sys_msg = {"role": "system", "content": system_prompt}
backend/app/services/chat_service.py:1570:                    role="assistant",
backend/app/services/chat_service.py:1835:                .where(Message.session_id == session_id, Message.role == "assistant")
backend/app/services/chat_service.py:1841:        if not asst_msg or asst_msg.role != "assistant":
backend/app/services/chat_service.py:1977:                claude_messages.append({"role": m.role, "content": m.content})
backend/app/services/chat_service.py:1981:                "role": "user",
backend/app/services/chat_service.py:2086:                "role": "system",
backend/app/services/chat_service.py:2090:            sys_msg = {"role": "system", "content": system_prompt}
backend/app/services/action_planner.py:325:                        {"role": "system", "content": system},
backend/app/services/action_planner.py:326:                        {"role": "user", "content": user},
backend/app/services/export_service.py:74:        if msg.role == "user":
backend/app/services/export_service.py:122:        if msg.role == "user":
backend/app/services/export_service.py:166:        if msg.role == "user":
backend/app/services/summary_service.py:387:                "messages": [{"role": "user", "content": prompt}],
backend/app/services/table_service.py:543:            "role": "system",
backend/app/services/table_service.py:552:            "role": "user",
backend/app/services/table_service.py:576:            {"role": "system", "content": "Repair the following output into valid JSON only. Do not add commentary."},
backend/app/services/table_service.py:577:            {"role": "user", "content": f"Required JSON contract:\n{contract}\n\nOutput:\n{content}"},
backend/app/schemas/chat.py:26:    role: str
backend/app/models/tables.py:232:    role: Mapped[str] = mapped_column(sa.String(10), nullable=False)
backend/app/models/tables.py:246:        sa.Index("idx_messages_session", "session_id", "created_at"),
backend/app/models/tables.py:428:        sa.UniqueConstraint("session_id", "user_id", name="uq_shared_sessions_session_user"),
backend/app/models/tables.py:434:    __tablename__ = "plan_transitions"
backend/app/services/extractors/url_extractor.py:183:    for attr_name in ("id", "class", "role", "aria-label", "data-testid"):
backend/app/services/extractors/url_extractor.py:257:        or soup.find(attrs={"role": "main"})
backend/app/api/admin.py:722:        .where(Message.role == "user")
backend/app/api/admin.py:1060:            .where(Message.role == "user")
backend/app/api/admin.py:1071:            .where(Message.role == "user")
backend/app/api/admin.py:1083:            .where(Message.role == "user")
backend/app/api/admin.py:1204:            .where(Message.role == "user")
backend/app/api/admin.py:1286:            .where(Message.role == "user")
backend/app/api/admin.py:1295:        .where(Message.role == "user")
backend/app/api/admin.py:1361:                    WHERE m.created_at >= :cutoff AND m.role = 'user' AND s.user_id IS NOT NULL
backend/app/api/admin.py:1549:    """Retention analytics centered on user-role chat message activity."""
backend/app/api/admin.py:1563:        .where(Message.role == "user")
backend/app/api/admin.py:1583:            .where(Message.role == "user")
backend/app/api/admin.py:1643:        .where(Message.role == "user")
backend/app/api/admin.py:1663:            .where(Message.role == "user")
backend/app/api/admin.py:1676:                func.coalesce(func.sum(case((Message.role == "user", 1), else_=0)), 0).label("user_messages"),
backend/app/api/admin.py:1677:                func.coalesce(func.sum(case((Message.role == "assistant", 1), else_=0)), 0).label("assistant_messages"),
backend/app/api/admin.py:1713:                Message.role.label("role"),
backend/app/api/admin.py:1736:        if row.role == "user":
backend/app/api/admin.py:1744:        elif row.role == "assistant":
backend/app/api/admin.py:1957:        .where(Message.role == "user")
backend/app/api/admin.py:1967:        .where(Message.role == "user")
backend/app/api/users.py:308:                        "role": m.role,
backend/app/api/sharing.py:179:            "role": msg.role,
backend/app/api/chat.py:278:                role=m.role,
backend/app/api/chat.py:471:            .where(Message.session_id == session_id, Message.role == "assistant")
backend/app/api/billing.py:656:    """Append a plan_transitions audit row. Caller is responsible for commit."""

codex
后端这部分不是 N+1 循环，但它确实把 395 天消息全量拉回 Python 做 regex/分类；我会继续确认是否属于可接受的有界扫描，还是有足够证据列为性能/准确性风险。接下来读前端实际 tab 容器和数据 API。
exec
/bin/zsh -lc "nl -ba frontend/src/components/admin/RetentionTab.tsx | sed -n '1,180p'" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "nl -ba frontend/src/app/admin/AdminPageClient.tsx | sed -n '1,280p'" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "nl -ba frontend/src/components/admin/ChurnTab.tsx | sed -n '1,140p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	"use client";
     2	
     3	import type { AdminRetention, AdminRetentionSegmentItem } from "../../lib/api";
     4	import { formatNumber, formatPercent } from "../../lib/formatNumber";
     5	import { useLocale } from "../../i18n";
     6	import RetentionCurves from "./RetentionCurves";
     7	import RetentionHeatmap from "./RetentionHeatmap";
     8	
     9	export default function RetentionTab({ retention }: { retention: AdminRetention | null }) {
    10	  const { tOr } = useLocale();
    11	  if (!retention) return null;
    12	
    13	  return (
    14	    <div className="space-y-6">
    15	      <div className="grid gap-4 sm:grid-cols-3">
    16	        <MiniMetric label={tOr("admin.retention.wau", "WAU")} value={retention.dau_wau_mau.wau} />
    17	        <MiniMetric label={tOr("admin.retention.mau", "MAU")} value={retention.dau_wau_mau.mau} />
    18	        <MiniMetric label={tOr("admin.retention.stickiness", "Stickiness")} value={formatPercent(retention.dau_wau_mau.stickiness)} />
    19	      </div>
    20	      <RetentionHeatmap cohorts={retention.cohort_grid} />
    21	      <RetentionCurves curves={retention.curves} dauSeries={retention.dau_wau_mau.series} />
    22	      <div className="grid gap-4 lg:grid-cols-3">
    23	        <SegmentPanel title={tOr("admin.retention.byPlan", "Retention by Plan")} rows={retention.by_segment.plan} />
    24	        <SegmentPanel title={tOr("admin.retention.byDocSize", "Retention by Doc Size")} rows={retention.by_segment.doc_size} />
    25	        <SegmentPanel title={tOr("admin.retention.byLocale", "Retention by Locale")} rows={retention.by_segment.locale} />
    26	      </div>
    27	      <section className="dt-admin-panel rounded-lg border">
    28	        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
    29	          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
    30	            {tOr("admin.retention.weeklyFlow", "Weekly Flow")}
    31	          </h2>
    32	        </div>
    33	        <div className="overflow-x-auto">
    34	          <table className="w-full text-sm">
    35	            <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
    36	              <tr>
    37	                <th scope="col" className="px-4 py-2 text-left font-medium">{tOr("admin.retention.week", "Week")}</th>
    38	                <th scope="col" className="px-4 py-2 text-right font-medium">{tOr("admin.retention.new", "New")}</th>
    39	                <th scope="col" className="px-4 py-2 text-right font-medium">{tOr("admin.retention.retained", "Retained")}</th>
    40	                <th scope="col" className="px-4 py-2 text-right font-medium">{tOr("admin.retention.resurrected", "Resurrected")}</th>
    41	                <th scope="col" className="px-4 py-2 text-right font-medium">{tOr("admin.retention.churned", "Churned")}</th>
    42	              </tr>
    43	            </thead>
    44	            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
    45	              {retention.weekly_flow.map((row) => (
    46	                <tr key={row.week}>
    47	                  <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">{row.week}</td>
    48	                  <td className="px-4 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{formatNumber(row.new)}</td>
    49	                  <td className="px-4 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{formatNumber(row.retained)}</td>
    50	                  <td className="px-4 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{formatNumber(row.resurrected)}</td>
    51	                  <td className="px-4 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{formatNumber(row.churned)}</td>
    52	                </tr>
    53	              ))}
    54	            </tbody>
    55	          </table>
    56	        </div>
    57	      </section>
    58	    </div>
    59	  );
    60	}
    61	
    62	function MiniMetric({ label, value }: { label: string; value: number | string }) {
    63	  return (
    64	    <div className="dt-admin-panel rounded-lg border p-4">
    65	      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
    66	      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
    67	        {typeof value === "number" ? formatNumber(value) : value}
    68	      </p>
    69	    </div>
    70	  );
    71	}
    72	
    73	function SegmentPanel({ title, rows }: { title: string; rows: AdminRetentionSegmentItem[] }) {
    74	  return (
    75	    <section className="dt-admin-panel rounded-lg border p-4">
    76	      <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{title}</h2>
    77	      <div className="mt-4 space-y-3">
    78	        {rows.map((row) => (
    79	          <div key={row.key}>
    80	            <div className="flex items-center justify-between gap-3 text-sm">
    81	              <span className="truncate text-zinc-700 dark:text-zinc-300">{row.label}</span>
    82	              <span className="tabular-nums text-zinc-950 dark:text-zinc-50">{formatPercent(row.pct)}</span>
    83	            </div>
    84	            <div className="mt-2 h-2 rounded bg-zinc-100 dark:bg-zinc-800">
    85	              <div className="h-full rounded bg-[#1D4ED8]" style={{ width: `${Math.min(100, row.pct * 100)}%` }} />
    86	            </div>
    87	            <p className="mt-1 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
    88	              {formatNumber(row.retained_users)} / {formatNumber(row.users)}
    89	            </p>
    90	          </div>
    91	        ))}
    92	      </div>
    93	    </section>
    94	  );
    95	}

 succeeded in 0ms:
     1	"use client";
     2	
     3	import type { AdminChurn } from "../../lib/api";
     4	import { formatNumber, formatPercent } from "../../lib/formatNumber";
     5	import { useLocale } from "../../i18n";
     6	import ChurnSignalsBars from "./ChurnSignalsBars";
     7	import FeedbackList from "./FeedbackList";
     8	import ReasonBucketsDonut from "./ReasonBucketsDonut";
     9	
    10	export default function ChurnTab({ churn }: { churn: AdminChurn | null }) {
    11	  const { tOr } = useLocale();
    12	  if (!churn) return null;
    13	
    14	  return (
    15	    <div className="space-y-6">
    16	      <div className="grid gap-4 sm:grid-cols-3">
    17	        <Metric label={tOr("admin.churn.churnedUsers", "Churned users")} value={churn.churned_users} />
    18	        <Metric label={tOr("admin.churn.oneAndDone", "One and done")} value={formatPercent(churn.one_and_done.pct)} detail={tOr("admin.churn.oneAndDoneDetail", "{count} of {total}", { count: churn.one_and_done.count, total: churn.one_and_done.activated_users })} />
    19	        <Metric label={tOr("admin.churn.inactiveWindow", "Inactive window")} value={`${churn.inactive_days}d`} />
    20	      </div>
    21	      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
    22	        <ChurnSignalsBars signals={churn.churn_signals} />
    23	        <ReasonBucketsDonut buckets={churn.reason_buckets} />
    24	      </div>
    25	      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
    26	        <section className="dt-admin-panel rounded-lg border">
    27	          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
    28	            <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
    29	              {tOr("admin.churn.lastAction", "Last Action")}
    30	            </h2>
    31	          </div>
    32	          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
    33	            {churn.last_action.length === 0 ? (
    34	              <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">{tOr("admin.churn.noLastAction", "No last-action data yet.")}</p>
    35	            ) : churn.last_action.map((item) => (
    36	              <div key={item.key} className="flex items-center justify-between gap-3 px-4 py-3">
    37	                <span className="text-sm text-zinc-700 dark:text-zinc-300">{item.label}</span>
    38	                <span className="text-sm font-medium tabular-nums text-zinc-950 dark:text-zinc-50">
    39	                  {formatNumber(item.count)} / {formatPercent(item.pct)}
    40	                </span>
    41	              </div>
    42	            ))}
    43	          </div>
    44	        </section>
    45	        <FeedbackList feedback={churn.feedback.recent} />
    46	      </div>
    47	      <section className="dt-admin-panel rounded-lg border">
    48	        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
    49	          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
    50	            {tOr("admin.churn.cancelReasons", "Cancel Reasons")}
    51	          </h2>
    52	        </div>
    53	        {churn.cancel_reasons.length === 0 ? (
    54	          <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">{tOr("admin.churn.noCancelReasons", "No cancel reasons in this window.")}</p>
    55	        ) : (
    56	          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
    57	            {churn.cancel_reasons.map((reason) => (
    58	              <div key={reason.id} className="px-4 py-3">
    59	                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
    60	                  <span>{reason.from_plan} -&gt; {reason.to_plan}</span>
    61	                  {reason.created_at ? <time>{new Date(reason.created_at).toLocaleDateString()}</time> : null}
    62	                </div>
    63	                <p className="mt-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
    64	                  {reason.reason || tOr("admin.churn.unspecifiedReason", "Unspecified reason")}
    65	                </p>
    66	                {reason.feedback ? <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{reason.feedback}</p> : null}
    67	              </div>
    68	            ))}
    69	          </div>
    70	        )}
    71	      </section>
    72	    </div>
    73	  );
    74	}
    75	
    76	function Metric({ label, value, detail }: { label: string; value: number | string; detail?: string }) {
    77	  return (
    78	    <div className="dt-admin-panel rounded-lg border p-4">
    79	      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
    80	      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
    81	        {typeof value === "number" ? formatNumber(value) : value}
    82	      </p>
    83	      {detail ? <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{detail}</p> : null}
    84	    </div>
    85	  );
    86	}

 succeeded in 0ms:
     1	"use client";
     2	
     3	import { useCallback, useEffect, useRef, useState } from "react";
     4	import { useSession } from "next-auth/react";
     5	import { useRouter } from "next/navigation";
     6	import { RefreshCw } from "lucide-react";
     7	import Header from "../../components/Header";
     8	import { usePageTitle } from "../../lib/usePageTitle";
     9	import { useLocale } from "../../i18n";
    10	import {
    11	  getAdminOverview,
    12	  getAdminTrends,
    13	  getAdminBreakdowns,
    14	  getAdminBillingHealth,
    15	  getAdminFunnel,
    16	  getAdminRagQuality,
    17	  getAdminUserActivity,
    18	  getAdminRecentUsers,
    19	  getAdminTopUsers,
    20	  getAdminRetention,
    21	  getAdminChurn,
    22	  type AdminBillingHealth,
    23	  type AdminFunnel,
    24	  type AdminRagQuality,
    25	  type AdminUserActivity,
    26	  type AdminRetention,
    27	  type AdminChurn,
    28	} from "../../lib/api";
    29	import type { Overview, Trends, Breakdowns } from "../../components/admin/types";
    30	import type { RecentUser, TopUser } from "../../components/admin/AdminPanels";
    31	import OverviewTab from "../../components/admin/OverviewTab";
    32	import ActivationTab from "../../components/admin/ActivationTab";
    33	import RetentionTab from "../../components/admin/RetentionTab";
    34	import ChurnTab from "../../components/admin/ChurnTab";
    35	import RevenueTab from "../../components/admin/RevenueTab";
    36	import ProductTab from "../../components/admin/ProductTab";
    37	
    38	type TabId = "overview" | "activation" | "retention" | "churn" | "revenue" | "product";
    39	
    40	const TABS: { id: TabId; key: string; fallback: string }[] = [
    41	  { id: "overview", key: "admin.tab.overview", fallback: "Overview" },
    42	  { id: "activation", key: "admin.tab.activation", fallback: "Activation" },
    43	  { id: "retention", key: "admin.tab.retention", fallback: "Retention" },
    44	  { id: "churn", key: "admin.tab.churn", fallback: "Why-not-retained" },
    45	  { id: "revenue", key: "admin.tab.revenue", fallback: "Revenue" },
    46	  { id: "product", key: "admin.tab.product", fallback: "Product" },
    47	];
    48	
    49	// Which backend datasets each tab needs (lazy-loaded on first open).
    50	const TAB_DEPS: Record<TabId, string[]> = {
    51	  overview: ["overview", "activity", "trends"],
    52	  activation: ["activity", "funnel"],
    53	  retention: ["retention"],
    54	  churn: ["churn"],
    55	  revenue: ["funnel", "billing"],
    56	  product: ["rag", "trends", "breakdowns", "recentUsers", "topUsers"],
    57	};
    58	// Datasets that depend on the selected period (refetched when trendDays changes).
    59	const PERIOD_DEPS = ["trends", "funnel", "rag", "activity"];
    60	
    61	function isTabId(v: string | null): v is TabId {
    62	  return !!v && TABS.some((t) => t.id === v);
    63	}
    64	
    65	export default function AdminPageClient() {
    66	  const { tOr } = useLocale();
    67	  usePageTitle(tOr("admin.pageTitle", "Admin"));
    68	  const { status } = useSession();
    69	  const router = useRouter();
    70	
    71	  const [activeTab, setActiveTab] = useState<TabId>("overview");
    72	  const [overview, setOverview] = useState<Overview | null>(null);
    73	  const [trends, setTrends] = useState<Trends | null>(null);
    74	  const [breakdowns, setBreakdowns] = useState<Breakdowns | null>(null);
    75	  const [billingHealth, setBillingHealth] = useState<AdminBillingHealth | null>(null);
    76	  const [funnel, setFunnel] = useState<AdminFunnel | null>(null);
    77	  const [ragQuality, setRagQuality] = useState<AdminRagQuality | null>(null);
    78	  const [userActivity, setUserActivity] = useState<AdminUserActivity | null>(null);
    79	  const [retention, setRetention] = useState<AdminRetention | null>(null);
    80	  const [churn, setChurn] = useState<AdminChurn | null>(null);
    81	  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
    82	  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
    83	
    84	  const [trendDays, setTrendDays] = useState(30);
    85	  const [topBy, setTopBy] = useState<"tokens" | "credits" | "documents">("tokens");
    86	  const [tabLoading, setTabLoading] = useState(false);
    87	  const [billingRemoteLoading, setBillingRemoteLoading] = useState(false);
    88	  const [error, setError] = useState<string | null>(null);
    89	  const [reloadToken, setReloadToken] = useState(0);
    90	
    91	  const loadedRef = useRef<Set<string>>(new Set());
    92	
    93	  // Auth guard
    94	  useEffect(() => {
    95	    if (status === "unauthenticated") router.push("/auth?callbackUrl=/admin");
    96	  }, [status, router]);
    97	
    98	  // Tab <-> URL hash sync (linkable tabs)
    99	  useEffect(() => {
   100	    const fromHash = typeof window !== "undefined" ? window.location.hash.replace("#", "") : "";
   101	    if (isTabId(fromHash)) setActiveTab(fromHash);
   102	  }, []);
   103	
   104	  const selectTab = useCallback((id: TabId) => {
   105	    setActiveTab(id);
   106	    if (typeof window !== "undefined") window.history.replaceState(null, "", `#${id}`);
   107	  }, []);
   108	
   109	  const fetchers: Record<string, () => Promise<void>> = {
   110	    overview: async () => setOverview((await getAdminOverview()) as Overview),
   111	    activity: async () => setUserActivity(await getAdminUserActivity(trendDays, "day")),
   112	    trends: async () => setTrends((await getAdminTrends("day", trendDays)) as Trends),
   113	    funnel: async () => setFunnel(await getAdminFunnel(trendDays)),
   114	    billing: async () => setBillingHealth(await getAdminBillingHealth(false)),
   115	    rag: async () => setRagQuality(await getAdminRagQuality(trendDays)),
   116	    breakdowns: async () => setBreakdowns((await getAdminBreakdowns()) as Breakdowns),
   117	    recentUsers: async () =>
   118	      setRecentUsers(((await getAdminRecentUsers(20)) as { users: RecentUser[] }).users),
   119	    topUsers: async () =>
   120	      setTopUsers(((await getAdminTopUsers(20, topBy)) as { users: TopUser[] }).users),
   121	    retention: async () => setRetention(await getAdminRetention()),
   122	    churn: async () => setChurn(await getAdminChurn(14)),
   123	  };
   124	
   125	  // Lazy-load the active tab's datasets on open / reload.
   126	  useEffect(() => {
   127	    let cancelled = false;
   128	    const need = TAB_DEPS[activeTab].filter((k) => !loadedRef.current.has(k));
   129	    if (need.length === 0) return;
   130	    (async () => {
   131	      setTabLoading(true);
   132	      setError(null);
   133	      try {
   134	        await Promise.all(
   135	          need.map(async (k) => {
   136	            await fetchers[k]();
   137	            loadedRef.current.add(k);
   138	          }),
   139	        );
   140	      } catch (e: unknown) {
   141	        const msg = e instanceof Error ? e.message : String(e);
   142	        if (!cancelled) setError(msg.includes("403") ? tOr("admin.error.forbidden", "Admin access required.") : tOr("admin.error.load", "Failed to load metrics."));
   143	      } finally {
   144	        if (!cancelled) setTabLoading(false);
   145	      }
   146	    })();
   147	    return () => {
   148	      cancelled = true;
   149	    };
   150	    // eslint-disable-next-line react-hooks/exhaustive-deps
   151	  }, [activeTab, reloadToken]);
   152	
   153	  const changeTrendDays = useCallback((days: number) => {
   154	    setTrendDays(days);
   155	    PERIOD_DEPS.forEach((k) => loadedRef.current.delete(k));
   156	    setReloadToken((t) => t + 1);
   157	  }, []);
   158	
   159	  const changeTopBy = useCallback((by: "tokens" | "credits" | "documents") => {
   160	    setTopBy(by);
   161	    loadedRef.current.delete("topUsers");
   162	    setReloadToken((t) => t + 1);
   163	  }, []);
   164	
   165	  const refresh = useCallback(() => {
   166	    loadedRef.current.clear();
   167	    setReloadToken((t) => t + 1);
   168	  }, []);
   169	
   170	  const onRemoteCheck = useCallback(async () => {
   171	    setBillingRemoteLoading(true);
   172	    try {
   173	      setBillingHealth(await getAdminBillingHealth(true));
   174	    } catch {
   175	      /* surfaced via error banner on next load */
   176	    } finally {
   177	      setBillingRemoteLoading(false);
   178	    }
   179	  }, []);
   180	
   181	  return (
   182	    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
   183	      <Header />
   184	      <main className="mx-auto max-w-6xl px-4 py-6">
   185	        <div className="mb-4 flex items-center justify-between">
   186	          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
   187	            {tOr("admin.title", "Analytics")}
   188	          </h1>
   189	          <button
   190	            onClick={refresh}
   191	            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
   192	          >
   193	            <RefreshCw className={`h-3.5 w-3.5 ${tabLoading ? "animate-spin" : ""}`} />
   194	            {tOr("admin.refresh", "Refresh")}
   195	          </button>
   196	        </div>
   197	
   198	        {/* Sticky tab nav */}
   199	        <nav className="sticky top-0 z-10 -mx-4 mb-6 border-b border-zinc-200 bg-zinc-50/90 px-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
   200	          <div className="flex gap-1 overflow-x-auto" role="tablist">
   201	            {TABS.map((t) => {
   202	              const active = t.id === activeTab;
   203	              return (
   204	                <button
   205	                  key={t.id}
   206	                  role="tab"
   207	                  aria-selected={active}
   208	                  onClick={() => selectTab(t.id)}
   209	                  className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
   210	                    active
   211	                      ? "border-blue-700 text-blue-700 dark:border-blue-400 dark:text-blue-400"
   212	                      : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
   213	                  }`}
   214	                >
   215	                  {tOr(t.key, t.fallback)}
   216	                </button>
   217	              );
   218	            })}
   219	          </div>
   220	        </nav>
   221	
   222	        {error && (
   223	          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
   224	            {error}
   225	          </div>
   226	        )}
   227	        {tabLoading && (
   228	          <div className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">{tOr("admin.loading", "Loading…")}</div>
   229	        )}
   230	
   231	        <div role="tabpanel">
   232	          {activeTab === "overview" && (
   233	            <OverviewTab overview={overview} activity={userActivity} trends={trends} />
   234	          )}
   235	          {activeTab === "activation" && <ActivationTab activity={userActivity} funnel={funnel} />}
   236	          {activeTab === "retention" && <RetentionTab retention={retention} />}
   237	          {activeTab === "churn" && <ChurnTab churn={churn} />}
   238	          {activeTab === "revenue" && (
   239	            <RevenueTab
   240	              funnel={funnel}
   241	              billingHealth={billingHealth}
   242	              billingRemoteLoading={billingRemoteLoading}
   243	              onRemoteCheck={onRemoteCheck}
   244	            />
   245	          )}
   246	          {activeTab === "product" && (
   247	            <ProductTab
   248	              ragQuality={ragQuality}
   249	              trends={trends}
   250	              breakdowns={breakdowns}
   251	              trendDays={trendDays}
   252	              onTrendDaysChange={changeTrendDays}
   253	              recentUsers={recentUsers}
   254	              topUsers={topUsers}
   255	              topBy={topBy}
   256	              onTopByChange={changeTopBy}
   257	            />
   258	          )}
   259	        </div>
   260	      </main>
   261	    </div>
   262	  );
   263	}

exec
/bin/zsh -lc "nl -ba frontend/src/components/admin/types.ts | sed -n '1,260p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	export interface Overview {
     2	  total_users: number;
     3	  paid_users: number;
     4	  plus_users: number;
     5	  pro_users: number;
     6	  total_documents: number;
     7	  total_sessions: number;
     8	  total_messages: number;
     9	  total_tokens: number;
    10	  total_credits_spent: number;
    11	  total_credits_granted: number;
    12	}
    13	
    14	export interface TrendPoint {
    15	  date: string;
    16	  count?: number;
    17	  total_tokens?: number;
    18	  amount?: number;
    19	}
    20	
    21	export interface Trends {
    22	  signups: TrendPoint[];
    23	  documents: TrendPoint[];
    24	  tokens: TrendPoint[];
    25	  credits_spent: TrendPoint[];
    26	  active_users: TrendPoint[];
    27	}
    28	
    29	export interface Breakdowns {
    30	  plan_distribution: { plan: string; count: number }[];
    31	  model_usage: { model: string; calls: number; tokens: number; credits: number }[];
    32	  file_types: { file_type: string; count: number }[];
    33	  doc_status: { status: string; count: number }[];
    34	}

exec
/bin/zsh -lc "nl -ba frontend/src/components/admin/RetentionCurves.tsx | sed -n '1,120p'" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "nl -ba frontend/src/components/admin/RetentionHeatmap.tsx | sed -n '1,130p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	"use client";
     2	
     3	import type { AdminRetentionCohort } from "../../lib/api";
     4	import { formatPercent } from "../../lib/formatNumber";
     5	import { useLocale } from "../../i18n";
     6	
     7	function cellColor(pct: number): string {
     8	  if (pct <= 0) return "rgba(113, 113, 122, 0.16)";
     9	  const alpha = Math.min(0.92, 0.16 + pct * 0.76);
    10	  return `rgba(29, 78, 216, ${alpha})`;
    11	}
    12	
    13	export default function RetentionHeatmap({ cohorts }: { cohorts: AdminRetentionCohort[] }) {
    14	  const { tOr } = useLocale();
    15	  const offsets = Array.from({ length: 12 }, (_, index) => index);
    16	
    17	  if (cohorts.length === 0) {
    18	    return (
    19	      <div className="dt-admin-panel rounded-lg border p-6 text-sm text-zinc-500 dark:text-zinc-400">
    20	        {tOr("admin.retention.emptyHeatmap", "No retention cohorts yet.")}
    21	      </div>
    22	    );
    23	  }
    24	
    25	  return (
    26	    <section className="dt-admin-panel overflow-hidden rounded-lg border">
    27	      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
    28	        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
    29	          {tOr("admin.retention.heatmapTitle", "Weekly Cohort Retention")}
    30	        </h2>
    31	        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
    32	          {tOr("admin.retention.heatmapSubtitle", "Signup-week cohorts by active user-message week.")}
    33	        </p>
    34	      </div>
    35	      <div className="overflow-x-auto p-4">
    36	        <table className="w-full min-w-[760px] border-separate border-spacing-1 text-xs">
    37	          <thead>
    38	            <tr className="text-zinc-500 dark:text-zinc-400">
    39	              <th scope="col" className="w-28 px-2 py-1 text-left font-medium">
    40	                {tOr("admin.retention.cohort", "Cohort")}
    41	              </th>
    42	              <th scope="col" className="w-16 px-2 py-1 text-right font-medium">
    43	                {tOr("admin.retention.users", "Users")}
    44	              </th>
    45	              {offsets.map((offset) => (
    46	                <th key={offset} scope="col" className="px-2 py-1 text-center font-medium tabular-nums">
    47	                  W{offset}
    48	                </th>
    49	              ))}
    50	            </tr>
    51	          </thead>
    52	          <tbody>
    53	            {cohorts.map((cohort) => (
    54	              <tr key={cohort.cohort_week}>
    55	                <th scope="row" className="rounded bg-zinc-50 px-2 py-2 text-left font-medium text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
    56	                  {cohort.cohort_week}
    57	                </th>
    58	                <td className="rounded bg-zinc-50 px-2 py-2 text-right tabular-nums text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
    59	                  {cohort.cohort_size}
    60	                </td>
    61	                {cohort.retention.map((cell) => {
    62	                  const active = cell.pct >= 0.35;
    63	                  return (
    64	                    <td
    65	                      key={cell.week_offset}
    66	                      className={`h-9 min-w-12 rounded text-center align-middle font-medium tabular-nums ${
    67	                        active ? "text-white" : "text-zinc-700 dark:text-zinc-200"
    68	                      }`}
    69	                      style={{ backgroundColor: cellColor(cell.pct) }}
    70	                      title={`${cell.active_users} / ${cohort.cohort_size}`}
    71	                    >
    72	                      {formatPercent(cell.pct)}
    73	                    </td>
    74	                  );
    75	                })}
    76	              </tr>
    77	            ))}
    78	          </tbody>
    79	        </table>
    80	      </div>
    81	    </section>
    82	  );
    83	}

 succeeded in 0ms:
     1	"use client";
     2	
     3	import {
     4	  Line,
     5	  LineChart,
     6	  ResponsiveContainer,
     7	  Tooltip,
     8	  XAxis,
     9	  YAxis,
    10	} from "recharts";
    11	import type { AdminRetentionCurvePoint, AdminRetentionDauPoint } from "../../lib/api";
    12	import { formatNumber, formatPercent } from "../../lib/formatNumber";
    13	import { useLocale } from "../../i18n";
    14	
    15	export default function RetentionCurves({
    16	  curves,
    17	  dauSeries,
    18	}: {
    19	  curves: AdminRetentionCurvePoint[];
    20	  dauSeries: AdminRetentionDauPoint[];
    21	}) {
    22	  const { tOr } = useLocale();
    23	  const curveData = curves.map((point) => ({ ...point, pctValue: point.pct * 100 }));
    24	
    25	  return (
    26	    <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
    27	      <div className="dt-admin-panel rounded-lg border p-4">
    28	        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
    29	          {tOr("admin.retention.curvesTitle", "D1 / D7 / D30 Return")}
    30	        </h2>
    31	        <div className="mt-4 h-64">
    32	          <ResponsiveContainer width="100%" height="100%">
    33	            <LineChart data={curveData} margin={{ top: 10, right: 18, bottom: 0, left: -18 }}>
    34	              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
    35	              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickFormatter={(value) => `${value}%`} />
    36	              <Tooltip
    37	                formatter={(value, _name, item) => [
    38	                  `${Number(value).toFixed(1)}%`,
    39	                  item.payload?.label || tOr("admin.retention.returned", "Returned"),
    40	                ]}
    41	                labelFormatter={(label) => `${label}`}
    42	              />
    43	              <Line
    44	                type="monotone"
    45	                dataKey="pctValue"
    46	                stroke="#1D4ED8"
    47	                strokeWidth={2}
    48	                dot={{ r: 4, fill: "#1D4ED8" }}
    49	                activeDot={{ r: 5 }}
    50	              />
    51	            </LineChart>
    52	          </ResponsiveContainer>
    53	        </div>
    54	        <div className="mt-3 grid gap-2 sm:grid-cols-3">
    55	          {curves.map((point) => (
    56	            <div key={point.key} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
    57	              <p className="text-xs text-zinc-500 dark:text-zinc-400">{point.label}</p>
    58	              <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
    59	                {formatPercent(point.pct)}
    60	              </p>
    61	              <p className="mt-1 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
    62	                {tOr("admin.retention.returnedOutOf", "{returned} / {activated} returned", {
    63	                  returned: formatNumber(point.returned_users),
    64	                  activated: formatNumber(point.activated_users),
    65	                })}
    66	              </p>
    67	            </div>
    68	          ))}
    69	        </div>
    70	      </div>
    71	      <div className="dt-admin-panel rounded-lg border p-4">
    72	        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
    73	          {tOr("admin.retention.dauTitle", "DAU Last 30 Days")}
    74	        </h2>
    75	        <div className="mt-4 h-64">
    76	          <ResponsiveContainer width="100%" height="100%">
    77	            <LineChart data={dauSeries} margin={{ top: 10, right: 18, bottom: 0, left: -18 }}>
    78	              <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={22} tick={{ fontSize: 12 }} />
    79	              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} allowDecimals={false} />
    80	              <Tooltip formatter={(value) => [formatNumber(Number(value)), tOr("admin.retention.dau", "DAU")]} />
    81	              <Line
    82	                type="monotone"
    83	                dataKey="dau"
    84	                stroke="#1D4ED8"
    85	                strokeWidth={2}
    86	                dot={false}
    87	                activeDot={{ r: 4 }}
    88	              />
    89	            </LineChart>
    90	          </ResponsiveContainer>
    91	        </div>
    92	      </div>
    93	    </section>
    94	  );
    95	}

exec
/bin/zsh -lc "nl -ba frontend/src/components/admin/FeedbackList.tsx | sed -n '1,110p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	"use client";
     2	
     3	import type { AdminChurnFeedbackItem } from "../../lib/api";
     4	import { useLocale } from "../../i18n";
     5	
     6	export default function FeedbackList({ feedback }: { feedback: AdminChurnFeedbackItem[] }) {
     7	  const { tOr } = useLocale();
     8	
     9	  return (
    10	    <section className="dt-admin-panel rounded-lg border">
    11	      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
    12	        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
    13	          {tOr("admin.churn.feedbackTitle", "Recent Feedback")}
    14	        </h2>
    15	      </div>
    16	      {feedback.length === 0 ? (
    17	        <div className="p-6 text-sm text-zinc-500 dark:text-zinc-400">
    18	          {tOr("admin.churn.noFeedback", "No recent feedback.")}
    19	        </div>
    20	      ) : (
    21	        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
    22	          {feedback.slice(0, 8).map((item) => (
    23	            <article key={item.id} className="p-4">
    24	              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
    25	                <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
    26	                  {item.area}
    27	                </span>
    28	                <span>{item.type}</span>
    29	                <span>{item.severity}</span>
    30	                {item.plan ? <span>{item.plan}</span> : null}
    31	                {item.created_at ? <time>{new Date(item.created_at).toLocaleDateString()}</time> : null}
    32	              </div>
    33	              <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
    34	                {item.message || tOr("admin.churn.feedbackNoMessage", "No written detail.")}
    35	              </p>
    36	            </article>
    37	          ))}
    38	        </div>
    39	      )}
    40	    </section>
    41	  );
    42	}

exec
/bin/zsh -lc "rg -n \"getAdminRetention|getAdminChurn|AdminRetention|AdminChurn|admin/retention|admin/churn\" frontend/src/lib/api.ts frontend/src -g '*.ts' -g '*.tsx'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
frontend/src/lib/api.ts:606:export interface AdminRetentionCell {
frontend/src/lib/api.ts:612:export interface AdminRetentionCohort {
frontend/src/lib/api.ts:615:  retention: AdminRetentionCell[];
frontend/src/lib/api.ts:618:export interface AdminRetentionCurvePoint {
frontend/src/lib/api.ts:627:export interface AdminRetentionDauPoint {
frontend/src/lib/api.ts:632:export interface AdminRetentionSegmentItem {
frontend/src/lib/api.ts:640:export interface AdminRetention {
frontend/src/lib/api.ts:642:  cohort_grid: AdminRetentionCohort[];
frontend/src/lib/api.ts:643:  curves: AdminRetentionCurvePoint[];
frontend/src/lib/api.ts:645:    series: AdminRetentionDauPoint[];
frontend/src/lib/api.ts:651:    plan: AdminRetentionSegmentItem[];
frontend/src/lib/api.ts:652:    doc_size: AdminRetentionSegmentItem[];
frontend/src/lib/api.ts:653:    locale: AdminRetentionSegmentItem[];
frontend/src/lib/api.ts:664:export async function getAdminRetention(): Promise<AdminRetention> {
frontend/src/lib/api.ts:665:  const res = await fetch(`${PROXY_BASE}/api/admin/retention`);
frontend/src/lib/api.ts:669:export interface AdminChurnCountPct {
frontend/src/lib/api.ts:674:export interface AdminChurnSignalItem extends AdminChurnCountPct {
frontend/src/lib/api.ts:679:export interface AdminChurnFeedbackItem {
frontend/src/lib/api.ts:689:export interface AdminChurn {
frontend/src/lib/api.ts:693:  one_and_done: AdminChurnCountPct & { activated_users: number };
frontend/src/lib/api.ts:694:  churn_signals: AdminChurnSignalItem[];
frontend/src/lib/api.ts:695:  last_action: AdminChurnSignalItem[];
frontend/src/lib/api.ts:697:    recent: AdminChurnFeedbackItem[];
frontend/src/lib/api.ts:710:  reason_buckets: AdminChurnSignalItem[];
frontend/src/lib/api.ts:713:export async function getAdminChurn(inactiveDays = 14): Promise<AdminChurn> {
frontend/src/lib/api.ts:714:  const res = await fetch(`${PROXY_BASE}/api/admin/churn?inactive_days=${inactiveDays}`);
frontend/src/lib/api.ts:606:export interface AdminRetentionCell {
frontend/src/lib/api.ts:612:export interface AdminRetentionCohort {
frontend/src/lib/api.ts:615:  retention: AdminRetentionCell[];
frontend/src/lib/api.ts:618:export interface AdminRetentionCurvePoint {
frontend/src/lib/api.ts:627:export interface AdminRetentionDauPoint {
frontend/src/lib/api.ts:632:export interface AdminRetentionSegmentItem {
frontend/src/lib/api.ts:640:export interface AdminRetention {
frontend/src/lib/api.ts:642:  cohort_grid: AdminRetentionCohort[];
frontend/src/lib/api.ts:643:  curves: AdminRetentionCurvePoint[];
frontend/src/lib/api.ts:645:    series: AdminRetentionDauPoint[];
frontend/src/lib/api.ts:651:    plan: AdminRetentionSegmentItem[];
frontend/src/lib/api.ts:652:    doc_size: AdminRetentionSegmentItem[];
frontend/src/lib/api.ts:653:    locale: AdminRetentionSegmentItem[];
frontend/src/lib/api.ts:664:export async function getAdminRetention(): Promise<AdminRetention> {
frontend/src/lib/api.ts:665:  const res = await fetch(`${PROXY_BASE}/api/admin/retention`);
frontend/src/lib/api.ts:669:export interface AdminChurnCountPct {
frontend/src/lib/api.ts:674:export interface AdminChurnSignalItem extends AdminChurnCountPct {
frontend/src/lib/api.ts:679:export interface AdminChurnFeedbackItem {
frontend/src/lib/api.ts:689:export interface AdminChurn {
frontend/src/lib/api.ts:693:  one_and_done: AdminChurnCountPct & { activated_users: number };
frontend/src/lib/api.ts:694:  churn_signals: AdminChurnSignalItem[];
frontend/src/lib/api.ts:695:  last_action: AdminChurnSignalItem[];
frontend/src/lib/api.ts:697:    recent: AdminChurnFeedbackItem[];
frontend/src/lib/api.ts:710:  reason_buckets: AdminChurnSignalItem[];
frontend/src/lib/api.ts:713:export async function getAdminChurn(inactiveDays = 14): Promise<AdminChurn> {
frontend/src/lib/api.ts:714:  const res = await fetch(`${PROXY_BASE}/api/admin/churn?inactive_days=${inactiveDays}`);
frontend/src/app/admin/AdminPageClient.tsx:20:  getAdminRetention,
frontend/src/app/admin/AdminPageClient.tsx:21:  getAdminChurn,
frontend/src/app/admin/AdminPageClient.tsx:26:  type AdminRetention,
frontend/src/app/admin/AdminPageClient.tsx:27:  type AdminChurn,
frontend/src/app/admin/AdminPageClient.tsx:79:  const [retention, setRetention] = useState<AdminRetention | null>(null);
frontend/src/app/admin/AdminPageClient.tsx:80:  const [churn, setChurn] = useState<AdminChurn | null>(null);
frontend/src/app/admin/AdminPageClient.tsx:121:    retention: async () => setRetention(await getAdminRetention()),
frontend/src/app/admin/AdminPageClient.tsx:122:    churn: async () => setChurn(await getAdminChurn(14)),
frontend/src/components/admin/ChurnSignalsBars.tsx:12:import type { AdminChurnSignalItem } from "../../lib/api";
frontend/src/components/admin/ChurnSignalsBars.tsx:16:export default function ChurnSignalsBars({ signals }: { signals: AdminChurnSignalItem[] }) {
frontend/src/components/admin/RetentionCurves.tsx:11:import type { AdminRetentionCurvePoint, AdminRetentionDauPoint } from "../../lib/api";
frontend/src/components/admin/RetentionCurves.tsx:19:  curves: AdminRetentionCurvePoint[];
frontend/src/components/admin/RetentionCurves.tsx:20:  dauSeries: AdminRetentionDauPoint[];
frontend/src/components/admin/RetentionHeatmap.tsx:3:import type { AdminRetentionCohort } from "../../lib/api";
frontend/src/components/admin/RetentionHeatmap.tsx:13:export default function RetentionHeatmap({ cohorts }: { cohorts: AdminRetentionCohort[] }) {
frontend/src/components/admin/FeedbackList.tsx:3:import type { AdminChurnFeedbackItem } from "../../lib/api";
frontend/src/components/admin/FeedbackList.tsx:6:export default function FeedbackList({ feedback }: { feedback: AdminChurnFeedbackItem[] }) {
frontend/src/components/admin/RetentionTab.tsx:3:import type { AdminRetention, AdminRetentionSegmentItem } from "../../lib/api";
frontend/src/components/admin/RetentionTab.tsx:9:export default function RetentionTab({ retention }: { retention: AdminRetention | null }) {
frontend/src/components/admin/RetentionTab.tsx:73:function SegmentPanel({ title, rows }: { title: string; rows: AdminRetentionSegmentItem[] }) {
frontend/src/components/admin/ChurnTab.tsx:3:import type { AdminChurn } from "../../lib/api";
frontend/src/components/admin/ChurnTab.tsx:10:export default function ChurnTab({ churn }: { churn: AdminChurn | null }) {
frontend/src/components/admin/ReasonBucketsDonut.tsx:10:import type { AdminChurnSignalItem } from "../../lib/api";
frontend/src/components/admin/ReasonBucketsDonut.tsx:16:export default function ReasonBucketsDonut({ buckets }: { buckets: AdminChurnSignalItem[] }) {

exec
/bin/zsh -lc "nl -ba frontend/src/lib/api.ts | sed -n '580,725p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   580	  days: number;
   581	  since: string;
   582	  sample_limit: number;
   583	  is_sampled: boolean;
   584	  evaluated_answers: number;
   585	  health_label: string;
   586	  health_explanation: string;
   587	  average_score: number;
   588	  pass_rate: number;
   589	  warn_rate: number;
   590	  fail_rate: number;
   591	  status_counts: Record<string, number>;
   592	  uncited_claims: number;
   593	  invalid_citations: number;
   594	  low_overlap_citations: number;
   595	  numeric_mismatch_citations: number;
   596	  issue_breakdown: AdminRagQualityIssue[];
   597	  strategy_breakdown: AdminRagQualityStrategy[];
   598	  recent: AdminRagQualityRecent[];
   599	}
   600	
   601	export async function getAdminRagQuality(days = 30): Promise<AdminRagQuality> {
   602	  const res = await fetch(`${PROXY_BASE}/api/admin/rag-quality?days=${days}`);
   603	  return handle(res);
   604	}
   605	
   606	export interface AdminRetentionCell {
   607	  week_offset: number;
   608	  active_users: number;
   609	  pct: number;
   610	}
   611	
   612	export interface AdminRetentionCohort {
   613	  cohort_week: string;
   614	  cohort_size: number;
   615	  retention: AdminRetentionCell[];
   616	}
   617	
   618	export interface AdminRetentionCurvePoint {
   619	  key: string;
   620	  label: string;
   621	  days: number;
   622	  activated_users: number;
   623	  returned_users: number;
   624	  pct: number;
   625	}
   626	
   627	export interface AdminRetentionDauPoint {
   628	  date: string;
   629	  dau: number;
   630	}
   631	
   632	export interface AdminRetentionSegmentItem {
   633	  key: string;
   634	  label: string;
   635	  users: number;
   636	  retained_users: number;
   637	  pct: number;
   638	}
   639	
   640	export interface AdminRetention {
   641	  generated_at: string;
   642	  cohort_grid: AdminRetentionCohort[];
   643	  curves: AdminRetentionCurvePoint[];
   644	  dau_wau_mau: {
   645	    series: AdminRetentionDauPoint[];
   646	    wau: number;
   647	    mau: number;
   648	    stickiness: number;
   649	  };
   650	  by_segment: {
   651	    plan: AdminRetentionSegmentItem[];
   652	    doc_size: AdminRetentionSegmentItem[];
   653	    locale: AdminRetentionSegmentItem[];
   654	  };
   655	  weekly_flow: {
   656	    week: string;
   657	    new: number;
   658	    retained: number;
   659	    resurrected: number;
   660	    churned: number;
   661	  }[];
   662	}
   663	
   664	export async function getAdminRetention(): Promise<AdminRetention> {
   665	  const res = await fetch(`${PROXY_BASE}/api/admin/retention`);
   666	  return handle(res);
   667	}
   668	
   669	export interface AdminChurnCountPct {
   670	  count: number;
   671	  pct: number;
   672	}
   673	
   674	export interface AdminChurnSignalItem extends AdminChurnCountPct {
   675	  key: string;
   676	  label: string;
   677	}
   678	
   679	export interface AdminChurnFeedbackItem {
   680	  id: string;
   681	  type: string;
   682	  area: string;
   683	  severity: string;
   684	  message: string | null;
   685	  plan: string | null;
   686	  created_at: string | null;
   687	}
   688	
   689	export interface AdminChurn {
   690	  generated_at: string;
   691	  inactive_days: number;
   692	  churned_users: number;
   693	  one_and_done: AdminChurnCountPct & { activated_users: number };
   694	  churn_signals: AdminChurnSignalItem[];
   695	  last_action: AdminChurnSignalItem[];
   696	  feedback: {
   697	    recent: AdminChurnFeedbackItem[];
   698	    by_area: { key: string; count: number }[];
   699	    by_severity: { key: string; count: number }[];
   700	  };
   701	  cancel_reasons: {
   702	    id: string;
   703	    user_id: string;
   704	    from_plan: string;
   705	    to_plan: string;
   706	    reason: string | null;
   707	    feedback: string | null;
   708	    created_at: string | null;
   709	  }[];
   710	  reason_buckets: AdminChurnSignalItem[];
   711	}
   712	
   713	export async function getAdminChurn(inactiveDays = 14): Promise<AdminChurn> {
   714	  const res = await fetch(`${PROXY_BASE}/api/admin/churn?inactive_days=${inactiveDays}`);
   715	  return handle(res);
   716	}
   717	
   718	export interface AdminMetricDelta {
   719	  current: number;
   720	  previous: number;
   721	  delta: number;
   722	  delta_percent: number | null;
   723	}
   724	
   725	export interface AdminUserActivitySummary {

exec
/bin/zsh -lc "nl -ba frontend/src/components/admin/ChurnSignalsBars.tsx | sed -n '1,120p'" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "nl -ba frontend/src/components/admin/ReasonBucketsDonut.tsx | sed -n '1,120p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	"use client";
     2	
     3	import {
     4	  Cell,
     5	  Pie,
     6	  PieChart,
     7	  ResponsiveContainer,
     8	  Tooltip,
     9	} from "recharts";
    10	import type { AdminChurnSignalItem } from "../../lib/api";
    11	import { formatNumber, formatPercent } from "../../lib/formatNumber";
    12	import { useLocale } from "../../i18n";
    13	
    14	const COLORS = ["#1D4ED8", "#0F766E", "#52525B", "#DC2626", "#9333EA", "#2563EB"];
    15	
    16	export default function ReasonBucketsDonut({ buckets }: { buckets: AdminChurnSignalItem[] }) {
    17	  const { tOr } = useLocale();
    18	  const data = buckets.filter((bucket) => bucket.count > 0);
    19	
    20	  return (
    21	    <section className="dt-admin-panel rounded-lg border p-4">
    22	      <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
    23	        {tOr("admin.churn.reasonBucketsTitle", "Reason Buckets")}
    24	      </h2>
    25	      {data.length === 0 ? (
    26	        <div className="mt-4 rounded-md border border-dashed border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
    27	          {tOr("admin.churn.noBuckets", "No churn reason buckets yet.")}
    28	        </div>
    29	      ) : (
    30	        <div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
    31	          <div className="h-56">
    32	            <ResponsiveContainer width="100%" height="100%">
    33	              <PieChart>
    34	                <Pie data={data} dataKey="count" nameKey="label" innerRadius={58} outerRadius={88} paddingAngle={2}>
    35	                  {data.map((bucket, index) => (
    36	                    <Cell key={bucket.key} fill={COLORS[index % COLORS.length]} />
    37	                  ))}
    38	                </Pie>
    39	                <Tooltip formatter={(value) => [formatNumber(Number(value)), tOr("admin.churn.usersLabel", "Users")]} />
    40	              </PieChart>
    41	            </ResponsiveContainer>
    42	          </div>
    43	          <div className="space-y-2">
    44	            {buckets.map((bucket, index) => (
    45	              <div key={bucket.key} className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
    46	                <div className="flex min-w-0 items-center gap-2">
    47	                  <span
    48	                    aria-hidden="true"
    49	                    className="h-2.5 w-2.5 rounded-full"
    50	                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
    51	                  />
    52	                  <span className="truncate text-sm text-zinc-700 dark:text-zinc-300">{bucket.label}</span>
    53	                </div>
    54	                <span className="shrink-0 text-sm font-medium tabular-nums text-zinc-950 dark:text-zinc-50">
    55	                  {formatNumber(bucket.count)} / {formatPercent(bucket.pct)}
    56	                </span>
    57	              </div>
    58	            ))}
    59	          </div>
    60	        </div>
    61	      )}
    62	    </section>
    63	  );
    64	}

 succeeded in 0ms:
     1	"use client";
     2	
     3	import {
     4	  Bar,
     5	  BarChart,
     6	  CartesianGrid,
     7	  ResponsiveContainer,
     8	  Tooltip,
     9	  XAxis,
    10	  YAxis,
    11	} from "recharts";
    12	import type { AdminChurnSignalItem } from "../../lib/api";
    13	import { formatNumber, formatPercent } from "../../lib/formatNumber";
    14	import { useLocale } from "../../i18n";
    15	
    16	export default function ChurnSignalsBars({ signals }: { signals: AdminChurnSignalItem[] }) {
    17	  const { tOr } = useLocale();
    18	  const data = signals.map((signal) => ({
    19	    ...signal,
    20	    pctValue: signal.pct * 100,
    21	    shortLabel: signal.label.replace("Assistant ", "Asst ").replace("Retrieval or ", ""),
    22	  }));
    23	
    24	  return (
    25	    <section className="dt-admin-panel rounded-lg border p-4">
    26	      <div className="flex items-start justify-between gap-4">
    27	        <div>
    28	          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
    29	            {tOr("admin.churn.signalsTitle", "Churn Signal Prevalence")}
    30	          </h2>
    31	          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
    32	            {tOr("admin.churn.signalsSubtitle", "Share of churned users who experienced each failure signal before leaving.")}
    33	          </p>
    34	        </div>
    35	      </div>
    36	      <div className="mt-4 h-72">
    37	        <ResponsiveContainer width="100%" height="100%">
    38	          <BarChart data={data} margin={{ top: 8, right: 18, bottom: 0, left: -18 }}>
    39	            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(113,113,122,0.18)" />
    40	            <XAxis dataKey="shortLabel" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} interval={0} />
    41	            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickFormatter={(value) => `${value}%`} />
    42	            <Tooltip
    43	              formatter={(value, _name, item) => [
    44	                `${Number(value).toFixed(1)}%`,
    45	                item.payload?.label || tOr("admin.churn.signal", "Signal"),
    46	              ]}
    47	              labelFormatter={(label) => `${label}`}
    48	            />
    49	            <Bar dataKey="pctValue" fill="#1D4ED8" radius={[4, 4, 0, 0]} />
    50	          </BarChart>
    51	        </ResponsiveContainer>
    52	      </div>
    53	      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
    54	        {signals.map((signal) => (
    55	          <div key={signal.key} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
    56	            <p className="text-xs text-zinc-500 dark:text-zinc-400">{signal.label}</p>
    57	            <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
    58	              {formatPercent(signal.pct)}
    59	            </p>
    60	            <p className="mt-1 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
    61	              {tOr("admin.churn.users", "{n} users", { n: formatNumber(signal.count) })}
    62	            </p>
    63	          </div>
    64	        ))}
    65	      </div>
    66	    </section>
    67	  );
    68	}

exec
/bin/zsh -lc "rg -n \"terracotta|amber|orange|rose|purple|pink|emerald|teal|yellow|slate|stone|#[0-9A-Fa-f]{3,6}|rgb|rgba|dt-admin-panel|bg-\\[|text-\\[|border-\\[\" frontend/src/app/admin frontend/src/components/admin frontend/src/app/globals.css frontend/src -g '*.css' -g '*.tsx' -g '*.ts'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
frontend/src/components/admin/ChurnSignalsBars.tsx:25:    <section className="dt-admin-panel rounded-lg border p-4">
frontend/src/components/admin/ChurnSignalsBars.tsx:39:            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(113,113,122,0.18)" />
frontend/src/components/admin/ChurnSignalsBars.tsx:49:            <Bar dataKey="pctValue" fill="#1D4ED8" radius={[4, 4, 0, 0]} />
frontend/src/components/admin/RetentionCurves.tsx:27:      <div className="dt-admin-panel rounded-lg border p-4">
frontend/src/components/admin/RetentionCurves.tsx:46:                stroke="#1D4ED8"
frontend/src/components/admin/RetentionCurves.tsx:48:                dot={{ r: 4, fill: "#1D4ED8" }}
frontend/src/components/admin/RetentionCurves.tsx:71:      <div className="dt-admin-panel rounded-lg border p-4">
frontend/src/components/admin/RetentionCurves.tsx:84:                stroke="#1D4ED8"
frontend/src/components/admin/FeedbackList.tsx:10:    <section className="dt-admin-panel rounded-lg border">
frontend/src/i18n/LocaleProvider.tsx:100:      const translated = resolve(key);
frontend/src/i18n/LocaleProvider.tsx:101:      if (translated == null) warnMissing(key);
frontend/src/i18n/LocaleProvider.tsx:102:      return applyParams(translated ?? key, params);
frontend/src/i18n/LocaleProvider.tsx:109:      const translated = resolve(key);
frontend/src/i18n/LocaleProvider.tsx:110:      if (translated == null) warnMissing(key, ' (using fallback)');
frontend/src/i18n/LocaleProvider.tsx:111:      return applyParams(translated ?? fallback, params);
frontend/src/components/admin/ChurnTab.tsx:26:        <section className="dt-admin-panel rounded-lg border">
frontend/src/components/admin/ChurnTab.tsx:47:      <section className="dt-admin-panel rounded-lg border">
frontend/src/components/admin/ChurnTab.tsx:78:    <div className="dt-admin-panel rounded-lg border p-4">
frontend/src/app/globals.css:48:  --background: #ffffff;
frontend/src/app/globals.css:49:  --page-background: #f6f8fc;
frontend/src/app/globals.css:50:  --foreground: #09090b;
frontend/src/app/globals.css:51:  --border: #e4e4e7;
frontend/src/app/globals.css:54:  --surface-1: #ffffff;
frontend/src/app/globals.css:55:  --surface-2: #f4f4f5;
frontend/src/app/globals.css:56:  --surface-3: #e4e4e7;
frontend/src/app/globals.css:58:  --highlight-base: rgba(183, 121, 31, 0.10);
frontend/src/app/globals.css:59:  --highlight-strong: rgba(245, 158, 11, 0.22);
frontend/src/app/globals.css:60:  --highlight-line: rgba(183, 121, 31, 0.74);
frontend/src/app/globals.css:61:  --highlight-glow: rgba(245, 158, 11, 0.22);
frontend/src/app/globals.css:64:  --accent: #1D4ED8;
frontend/src/app/globals.css:65:  --accent-hover: #1E40AF;
frontend/src/app/globals.css:66:  --accent-light: #DBEAFE;
frontend/src/app/globals.css:67:  --accent-foreground: #ffffff;
frontend/src/app/globals.css:68:  --workbench-bg: #f6f8fc;
frontend/src/app/globals.css:69:  --workbench-canvas: #eef3fb;
frontend/src/app/globals.css:70:  --workbench-panel: rgba(255, 255, 255, 0.76);
frontend/src/app/globals.css:71:  --workbench-panel-solid: #ffffff;
frontend/src/app/globals.css:72:  --workbench-panel-strong: rgba(255, 255, 255, 0.94);
frontend/src/app/globals.css:73:  --workbench-border: #e4e4e7;
frontend/src/app/globals.css:74:  --workbench-border-strong: rgba(67, 91, 126, 0.34);
frontend/src/app/globals.css:75:  --workbench-grid: rgba(43, 69, 104, 0.14);
frontend/src/app/globals.css:76:  --workbench-ink: #111827;
frontend/src/app/globals.css:77:  --workbench-muted: #64748b;
frontend/src/app/globals.css:78:  --workbench-glow-cyan: rgba(14, 165, 233, 0.16);
frontend/src/app/globals.css:79:  --workbench-command: rgba(255, 255, 255, 0.88);
frontend/src/app/globals.css:80:  --workbench-command-shadow: 0 22px 70px rgba(31, 55, 88, 0.16);
frontend/src/app/globals.css:81:  --reader-bg: #f4f1ea;
frontend/src/app/globals.css:82:  --reader-panel: rgba(255, 255, 255, 0.9);
frontend/src/app/globals.css:83:  --reader-panel-solid: #ffffff;
frontend/src/app/globals.css:84:  --reader-panel-muted: #faf8f3;
frontend/src/app/globals.css:85:  --reader-border: #ded8ce;
frontend/src/app/globals.css:86:  --reader-border-strong: #cfc6b8;
frontend/src/app/globals.css:87:  --reader-ink: #1f2933;
frontend/src/app/globals.css:88:  --reader-muted: #716b63;
frontend/src/app/globals.css:89:  --reader-evidence: #b7791f;
frontend/src/app/globals.css:90:  --reader-evidence-soft: #fff4d6;
frontend/src/app/globals.css:91:  --reader-evidence-border: #f3d38c;
frontend/src/app/globals.css:95:  --background: #09090b;
frontend/src/app/globals.css:96:  --page-background: #070707;
frontend/src/app/globals.css:97:  --foreground: #fafafa;
frontend/src/app/globals.css:98:  --border: rgba(255, 255, 255, 0.14);
frontend/src/app/globals.css:102:  --surface-1: #18181b;
frontend/src/app/globals.css:103:  --surface-2: #27272a;
frontend/src/app/globals.css:104:  --surface-3: #3f3f46;
frontend/src/app/globals.css:106:  --highlight-base: rgba(241, 184, 75, 0.14);
frontend/src/app/globals.css:107:  --highlight-strong: rgba(241, 184, 75, 0.26);
frontend/src/app/globals.css:108:  --highlight-line: rgba(241, 184, 75, 0.78);
frontend/src/app/globals.css:109:  --highlight-glow: rgba(241, 184, 75, 0.28);
frontend/src/app/globals.css:110:  /* Accent — blue (dark). blue-400 (#60A5FA) reads well on the
frontend/src/app/globals.css:111:     near-black canvas; blue-300 (#93C5FD) for hover. */
frontend/src/app/globals.css:112:  --accent: #60A5FA;
frontend/src/app/globals.css:113:  --accent-hover: #93C5FD;
frontend/src/app/globals.css:114:  --accent-light: rgba(96, 165, 250, 0.12);
frontend/src/app/globals.css:115:  --accent-foreground: #0b1726;
frontend/src/app/globals.css:116:  --workbench-bg: #070707;
frontend/src/app/globals.css:117:  --workbench-canvas: #111214;
frontend/src/app/globals.css:118:  --workbench-panel: rgba(23, 24, 27, 0.74);
frontend/src/app/globals.css:119:  --workbench-panel-solid: #17181b;
frontend/src/app/globals.css:120:  --workbench-panel-strong: rgba(25, 26, 30, 0.92);
frontend/src/app/globals.css:121:  --workbench-border: rgba(255, 255, 255, 0.14);
frontend/src/app/globals.css:122:  --workbench-border-strong: rgba(255, 255, 255, 0.26);
frontend/src/app/globals.css:123:  --workbench-grid: rgba(255, 255, 255, 0.16);
frontend/src/app/globals.css:124:  --workbench-ink: #f7f7f8;
frontend/src/app/globals.css:125:  --workbench-muted: #b8bbc6;
frontend/src/app/globals.css:126:  --workbench-glow-cyan: rgba(73, 186, 255, 0.28);
frontend/src/app/globals.css:127:  --workbench-command: rgba(23, 24, 27, 0.86);
frontend/src/app/globals.css:128:  --workbench-command-shadow: 0 30px 90px rgba(0, 0, 0, 0.46);
frontend/src/app/globals.css:129:  --reader-bg: #151410;
frontend/src/app/globals.css:130:  --reader-panel: rgba(28, 27, 24, 0.92);
frontend/src/app/globals.css:131:  --reader-panel-solid: #1f1e1a;
frontend/src/app/globals.css:132:  --reader-panel-muted: #25231f;
frontend/src/app/globals.css:133:  --reader-border: #3c3830;
frontend/src/app/globals.css:134:  --reader-border-strong: #575044;
frontend/src/app/globals.css:135:  --reader-ink: #f3eee4;
frontend/src/app/globals.css:136:  --reader-muted: #aaa399;
frontend/src/app/globals.css:137:  --reader-evidence: #f1b84b;
frontend/src/app/globals.css:138:  --reader-evidence-soft: rgba(241, 184, 75, 0.14);
frontend/src/app/globals.css:139:  --reader-evidence-border: rgba(241, 184, 75, 0.34);
frontend/src/app/globals.css:142:/* Designed-for-dark: scope the weight-shift to prose/headings only.
frontend/src/app/globals.css:148:.dark .prose strong,
frontend/src/app/globals.css:149:.dark .prose b {
frontend/src/app/globals.css:160:  background: #fafafa;
frontend/src/app/globals.css:165:  background: #09090b;
frontend/src/app/globals.css:175:/* Chat prose: tighten paragraph spacing vs. default prose */
frontend/src/app/globals.css:176:.prose p {
frontend/src/app/globals.css:180:.prose ul, .prose ol {
frontend/src/app/globals.css:184:.prose li {
frontend/src/app/globals.css:247:  transform: translateY(-50%);
frontend/src/app/globals.css:298:  from { transform: translateY(100%); }
frontend/src/app/globals.css:299:  to { transform: translateY(0); }
frontend/src/app/globals.css:304:  background-color: rgba(250, 204, 21, 0.4);
frontend/src/app/globals.css:312:  --driverjs-bg: #ffffff;
frontend/src/app/globals.css:313:  --driverjs-color: #18181b;
frontend/src/app/globals.css:314:  border: 1px solid #e4e4e7;
frontend/src/app/globals.css:316:  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
frontend/src/app/globals.css:320:  --driverjs-bg: #18181b;
frontend/src/app/globals.css:321:  --driverjs-color: #fafafa;
frontend/src/app/globals.css:322:  border-color: #3f3f46;
frontend/src/app/globals.css:326:  color: #71717a;
frontend/src/app/globals.css:353:  border: 1px solid #e4e4e7;
frontend/src/app/globals.css:354:  background: #ffffff;
frontend/src/app/globals.css:355:  box-shadow: 0 1px 2px rgba(24, 24, 27, 0.05);
frontend/src/app/globals.css:359:  border-color: #27272a;
frontend/src/app/globals.css:360:  background: #18181b;
frontend/src/app/globals.css:361:  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
frontend/src/app/globals.css:369:  border-color: #e4e4e7;
frontend/src/app/globals.css:370:  background: #ffffff;
frontend/src/app/globals.css:371:  box-shadow: 0 1px 2px rgba(24, 24, 27, 0.05);
frontend/src/app/globals.css:375:  border-color: #27272a;
frontend/src/app/globals.css:376:  background: #09090b;
frontend/src/app/globals.css:377:  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
frontend/src/app/globals.css:382:  border: 1px solid #e4e4e7;
frontend/src/app/globals.css:383:  background: #ffffff;
frontend/src/app/globals.css:388:  border-color: #27272a;
frontend/src/app/globals.css:389:  background: #27272a;
frontend/src/app/globals.css:394:  border: 1px solid #e4e4e7;
frontend/src/app/globals.css:395:  background: #ffffff;
frontend/src/app/globals.css:397:  box-shadow: 0 1px 2px rgba(24, 24, 27, 0.05);
frontend/src/app/globals.css:402:  border-color: #d4d4d8;
frontend/src/app/globals.css:403:  transform: translateY(-1px);
frontend/src/app/globals.css:404:  background: #fafafa;
frontend/src/app/globals.css:408:  border-color: #27272a;
frontend/src/app/globals.css:409:  background: #18181b;
frontend/src/app/globals.css:410:  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
frontend/src/app/globals.css:414:  border-color: #3f3f46;
frontend/src/app/globals.css:415:  background: #27272a;
frontend/src/app/globals.css:420:  border: 1px solid #d4d4d8;
frontend/src/app/globals.css:421:  background: #ffffff;
frontend/src/app/globals.css:422:  box-shadow: 0 8px 24px -10px rgba(24, 24, 27, 0.12);
frontend/src/app/globals.css:426:  border-color: #3f3f46;
frontend/src/app/globals.css:427:  background: #18181b;
frontend/src/app/globals.css:428:  box-shadow: 0 8px 24px -10px rgba(0, 0, 0, 0.5);
frontend/src/app/globals.css:440:  background: #ffffff;
frontend/src/app/globals.css:441:  border-color: #e4e4e7;
frontend/src/app/globals.css:442:  box-shadow: 0 8px 24px -10px rgba(24, 24, 27, 0.12);
frontend/src/app/globals.css:446:  background: #18181b;
frontend/src/app/globals.css:447:  border-color: #27272a;
frontend/src/app/globals.css:448:  box-shadow: 0 8px 24px -10px rgba(0, 0, 0, 0.5);
frontend/src/app/globals.css:474:  box-shadow: 4px 0 0 color-mix(in srgb, var(--reader-border-strong) 52%, transparent);
frontend/src/app/globals.css:494:  border: 1px solid #e4e4e7;
frontend/src/app/globals.css:495:  background: #ffffff;
frontend/src/app/globals.css:496:  box-shadow: 0 8px 24px -10px rgba(24, 24, 27, 0.12);
frontend/src/app/globals.css:500:  border-color: #27272a;
frontend/src/app/globals.css:501:  background: #18181b;
frontend/src/app/globals.css:502:  box-shadow: 0 8px 24px -10px rgba(0, 0, 0, 0.5);
frontend/src/app/globals.css:507:  border: 1px solid #e4e4e7;
frontend/src/app/globals.css:508:  background: #ffffff;
frontend/src/app/globals.css:514:  border-color: #d4d4d8;
frontend/src/app/globals.css:515:  background: #fafafa;
frontend/src/app/globals.css:516:  transform: translateY(-1px);
frontend/src/app/globals.css:520:  border-color: #27272a;
frontend/src/app/globals.css:521:  background: #18181b;
frontend/src/app/globals.css:525:  border-color: #3f3f46;
frontend/src/app/globals.css:526:  background: #27272a;
frontend/src/app/globals.css:532:  border: 1px solid #e4e4e7;
frontend/src/app/globals.css:534:  background: #ffffff;
frontend/src/app/globals.css:535:  box-shadow: 0 1px 2px rgba(24, 24, 27, 0.05);
frontend/src/app/globals.css:547:  background: #1D4ED8;
frontend/src/app/globals.css:552:  border-color: #27272a;
frontend/src/app/globals.css:553:  background: #18181b;
frontend/src/app/globals.css:554:  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
frontend/src/app/globals.css:559:  border: 1px solid #e4e4e7;
frontend/src/app/globals.css:560:  background: #ffffff;
frontend/src/app/globals.css:562:  box-shadow: 0 1px 2px rgba(24, 24, 27, 0.05);
frontend/src/app/globals.css:566:  border-color: #27272a;
frontend/src/app/globals.css:567:  background: #18181b;
frontend/src/app/globals.css:568:  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
frontend/src/app/globals.css:573:  border: 1px solid #e4e4e7;
frontend/src/app/globals.css:575:  background: #ffffff;
frontend/src/app/globals.css:580:  border-color: #27272a;
frontend/src/app/globals.css:581:  background: #18181b;
frontend/src/app/globals.css:585:  color: #1D4ED8;
frontend/src/app/globals.css:590:  color: rgba(147, 197, 253, 0.82);
frontend/src/app/globals.css:595:  border: 1px solid #e4e4e7;
frontend/src/app/globals.css:596:  background: #f4f4f5;
frontend/src/app/globals.css:602:  border-color: rgba(29, 78, 216, 0.32);
frontend/src/app/globals.css:603:  background: #ffffff;
frontend/src/app/globals.css:604:  transform: translateY(-1px);
frontend/src/app/globals.css:608:  border-color: #27272a;
frontend/src/app/globals.css:609:  background: #27272a;
frontend/src/app/globals.css:613:  border-color: rgba(96, 165, 250, 0.5);
frontend/src/app/globals.css:614:  background: #3f3f46;
frontend/src/app/globals.css:618:  background: #111827;
frontend/src/app/globals.css:619:  color: #ffffff;
frontend/src/app/globals.css:623:  background: #f7f7f8;
frontend/src/app/globals.css:624:  color: #141416;
frontend/src/app/globals.css:629:  border: 1px solid #e4e4e7;
frontend/src/app/globals.css:630:  background: #ffffff;
frontend/src/app/globals.css:632:  box-shadow: 0 1px 2px rgba(24, 24, 27, 0.05);
frontend/src/app/globals.css:637:  border-color: rgba(29, 78, 216, 0.3);
frontend/src/app/globals.css:638:  box-shadow: 0 8px 24px -10px rgba(24, 24, 27, 0.12);
frontend/src/app/globals.css:639:  transform: translateY(-1px);
frontend/src/app/globals.css:643:  border-color: #27272a;
frontend/src/app/globals.css:644:  background: #18181b;
frontend/src/app/globals.css:645:  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
frontend/src/app/globals.css:649:  border-color: rgba(96, 165, 250, 0.46);
frontend/src/app/globals.css:650:  box-shadow: 0 8px 24px -10px rgba(0, 0, 0, 0.5);
frontend/src/app/globals.css:657:    linear-gradient(180deg, transparent, rgba(246, 248, 252, 0.96));
frontend/src/app/globals.css:662:    linear-gradient(180deg, transparent, rgba(7, 7, 8, 0.94));
frontend/src/app/globals.css:667:  border: 1px solid #d4d4d8;
frontend/src/app/globals.css:668:  background: #ffffff;
frontend/src/app/globals.css:669:  box-shadow: 0 1px 2px rgba(24, 24, 27, 0.05);
frontend/src/app/globals.css:673:  border-color: #1D4ED8;
frontend/src/app/globals.css:674:  box-shadow: 0 0 0 2px rgba(29, 78, 216, 0.4);
frontend/src/app/globals.css:678:  border-color: #3f3f46;
frontend/src/app/globals.css:679:  background: #18181b;
frontend/src/app/globals.css:680:  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
frontend/src/app/globals.css:684:  border-color: #60A5FA;
frontend/src/app/globals.css:685:  box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.4);
frontend/src/app/globals.css:690:  border-bottom: 1px solid #e4e4e7;
frontend/src/app/globals.css:691:  background: #ffffff;
frontend/src/app/globals.css:695:  border-bottom-color: #27272a;
frontend/src/app/globals.css:696:  background: #09090b;
frontend/src/app/globals.css:702:    linear-gradient(180deg, rgba(255, 255, 255, 0.5), transparent 8rem),
frontend/src/app/globals.css:720:.dt-admin-panel,
frontend/src/app/globals.css:722:  border-color: #e4e4e7;
frontend/src/app/globals.css:723:  background: #ffffff;
frontend/src/app/globals.css:724:  box-shadow: 0 1px 2px rgba(24, 24, 27, 0.05);
frontend/src/app/globals.css:727:.dark .dt-admin-panel,
frontend/src/app/globals.css:729:  border-color: #27272a;
frontend/src/app/globals.css:730:  background: #18181b;
frontend/src/app/globals.css:731:  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
frontend/src/app/globals.css:734:.dt-admin-panel {
frontend/src/app/globals.css:740:  border: 1px solid #e4e4e7;
frontend/src/app/globals.css:741:  background: #ffffff;
frontend/src/app/globals.css:742:  box-shadow: 0 1px 2px rgba(24, 24, 27, 0.05);
frontend/src/app/globals.css:746:  border-color: #27272a;
frontend/src/app/globals.css:747:  background: #18181b;
frontend/src/app/globals.css:748:  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
frontend/src/app/globals.css:770:  background: #2563eb;
frontend/src/app/globals.css:771:  color: #ffffff;
frontend/src/app/globals.css:772:  box-shadow: 0 1px 2px rgba(24, 24, 27, 0.05);
frontend/src/app/globals.css:776:  background: #1d4ed8;
frontend/src/app/globals.css:777:  color: #ffffff;
frontend/src/app/globals.css:781:  background: #3b82f6;
frontend/src/app/globals.css:782:  color: #ffffff;
frontend/src/app/globals.css:783:  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
frontend/src/app/globals.css:787:  background: #2563eb;
frontend/src/app/globals.css:788:  color: #ffffff;
frontend/src/app/globals.css:793:  border: 1px solid #e4e4e7;
frontend/src/app/globals.css:794:  background: #ffffff;
frontend/src/app/globals.css:795:  box-shadow: 0 1px 2px rgba(24, 24, 27, 0.05);
frontend/src/app/globals.css:799:  border-color: #27272a;
frontend/src/app/globals.css:800:  background: #18181b;
frontend/src/app/globals.css:801:  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
frontend/src/components/AuthFormContent.tsx:171:            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
frontend/src/components/AuthFormContent.tsx:172:            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
frontend/src/components/AuthFormContent.tsx:173:            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
frontend/src/components/AuthFormContent.tsx:174:            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
frontend/src/components/AuthFormContent.tsx:186:            <rect x="1" y="1" width="9" height="9" fill="#F25022" />
frontend/src/components/AuthFormContent.tsx:187:            <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
frontend/src/components/AuthFormContent.tsx:188:            <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
frontend/src/components/AuthFormContent.tsx:189:            <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
frontend/src/components/admin/OverviewTab.tsx:89:      <section className="dt-admin-panel rounded-lg border p-4">
frontend/src/components/ModeSelector.tsx:35:      className={`inline-flex rounded-full border border-zinc-300/90 bg-zinc-200/95 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_24px_rgba(15,23,42,0.12)] dark:border-white/18 dark:bg-white/12 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_12px_28px_rgba(0,0,0,0.3)] ${isStreaming ? 'opacity-60 pointer-events-none' : ''}`}
frontend/src/components/ModeSelector.tsx:49:                ? 'bg-white font-semibold text-zinc-950 shadow-[0_3px_12px_rgba(15,23,42,0.16)] dark:bg-zinc-50 dark:text-zinc-950'
frontend/src/components/admin/ActivationTab.tsx:21:      <section className="dt-admin-panel rounded-lg border p-4">
frontend/src/components/admin/AdminPanels.tsx:40:    plus: "bg-blue-50 text-[#1D4ED8] dark:bg-blue-400/10 dark:text-blue-300",
frontend/src/components/admin/AdminPanels.tsx:54:        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
frontend/src/components/admin/AdminPanels.tsx:79:    <section className="dt-admin-panel overflow-hidden rounded-lg border">
frontend/src/components/admin/AdminPanels.tsx:83:            <ShieldCheck aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
frontend/src/components/admin/AdminPanels.tsx:85:            <AlertTriangle aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-300" />
frontend/src/components/admin/AdminPanels.tsx:156:    <section className="dt-admin-panel overflow-hidden rounded-lg border">
frontend/src/components/admin/AdminPanels.tsx:212:    <section className="dt-admin-panel overflow-hidden rounded-lg border">
frontend/src/components/admin/AdminPanels.tsx:216:            <ShieldCheck aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
frontend/src/components/admin/AdminPanels.tsx:218:            <AlertTriangle aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-300" />
frontend/src/components/admin/AdminPanels.tsx:317:      <div className="dt-admin-panel overflow-hidden rounded-lg border">
frontend/src/components/admin/AdminPanels.tsx:333:      <div className="dt-admin-panel overflow-hidden rounded-lg border">
frontend/src/components/admin/RetentionTab.tsx:27:      <section className="dt-admin-panel rounded-lg border">
frontend/src/components/admin/RetentionTab.tsx:64:    <div className="dt-admin-panel rounded-lg border p-4">
frontend/src/components/admin/RetentionTab.tsx:75:    <section className="dt-admin-panel rounded-lg border p-4">
frontend/src/components/admin/RetentionTab.tsx:85:              <div className="h-full rounded bg-[#1D4ED8]" style={{ width: `${Math.min(100, row.pct * 100)}%` }} />
frontend/src/components/admin/ReasonBucketsDonut.tsx:14:const COLORS = ["#1D4ED8", "#0F766E", "#52525B", "#DC2626", "#9333EA", "#2563EB"];
frontend/src/components/admin/ReasonBucketsDonut.tsx:21:    <section className="dt-admin-panel rounded-lg border p-4">
frontend/src/lib/emailTemplate.ts:34:<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
frontend/src/lib/emailTemplate.ts:35:  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f5;">
frontend/src/lib/emailTemplate.ts:42:              <span style="font-size: 28px; font-weight: 700; color: #18181b; letter-spacing: -0.5px; text-decoration: none;">DocTalk</span>
frontend/src/lib/emailTemplate.ts:47:            <td style="background-color: #ffffff; border-radius: 8px; padding: 40px 40px 32px 40px;">
frontend/src/lib/emailTemplate.ts:51:                  <td style="font-size: 24px; font-weight: 600; color: #18181b; text-align: ${textAlign}; padding-bottom: 16px; line-height: 32px;">
frontend/src/lib/emailTemplate.ts:57:                  <td style="font-size: 16px; color: #71717a; text-align: ${textAlign}; line-height: 24px; padding-bottom: 8px;">
frontend/src/lib/emailTemplate.ts:63:                  <td style="font-size: 16px; color: #71717a; text-align: ${textAlign}; line-height: 24px; padding-bottom: 32px;">
frontend/src/lib/emailTemplate.ts:72:                        <td align="center" style="background-color: #18181b; border-radius: 6px;">
frontend/src/lib/emailTemplate.ts:73:                          <a href="${escapeHtml(url)}" target="_blank" style="display: inline-block; padding: 12px 24px; font-size: 16px; font-weight: 500; color: #ffffff; text-decoration: none; line-height: 24px;">
frontend/src/lib/emailTemplate.ts:83:                  <td style="font-size: 14px; color: #a1a1aa; text-align: ${textAlign}; line-height: 20px; padding-bottom: 4px;">
frontend/src/lib/emailTemplate.ts:88:                  <td style="font-size: 14px; color: #a1a1aa; text-align: ${textAlign}; line-height: 20px;">
frontend/src/lib/emailTemplate.ts:98:              <span style="font-size: 12px; color: #a1a1aa;">${escapeHtml(s.footer)}</span>
frontend/src/lib/emailTemplate.ts:103:              <a href="https://www.doctalk.site/privacy" style="font-size: 12px; color: #a1a1aa; text-decoration: underline;">Privacy</a>
frontend/src/lib/emailTemplate.ts:104:              <span style="font-size: 12px; color: #d4d4d8; padding: 0 8px;">&middot;</span>
frontend/src/lib/emailTemplate.ts:105:              <a href="https://www.doctalk.site/terms" style="font-size: 12px; color: #a1a1aa; text-decoration: underline;">Terms</a>
frontend/src/components/admin/KPICard.tsx:48:          <Icon aria-hidden="true" className="h-4 w-4 text-[#1D4ED8]" />
frontend/src/components/admin/KPICard.tsx:53:              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
frontend/src/components/admin/KPICard.tsx:70:      <svg className="mt-3 h-9 w-full text-[#1D4ED8]" viewBox="0 0 100 40" aria-hidden="true">
frontend/src/components/admin/RetentionHeatmap.tsx:8:  if (pct <= 0) return "rgba(113, 113, 122, 0.16)";
frontend/src/components/admin/RetentionHeatmap.tsx:10:  return `rgba(29, 78, 216, ${alpha})`;
frontend/src/components/admin/RetentionHeatmap.tsx:19:      <div className="dt-admin-panel rounded-lg border p-6 text-sm text-zinc-500 dark:text-zinc-400">
frontend/src/components/admin/RetentionHeatmap.tsx:26:    <section className="dt-admin-panel overflow-hidden rounded-lg border">
frontend/src/components/Extraction/ExtractionPanel.tsx:328:              className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-[var(--reader-evidence-soft)] px-1.5 text-[11px] font-semibold text-[var(--reader-evidence)] ring-1 ring-[var(--reader-evidence-border)] disabled:opacity-50"
frontend/src/components/Extraction/ExtractionPanel.tsx:344:    <div className="flex h-full flex-col bg-[var(--reader-panel-solid)]">
frontend/src/components/Extraction/ExtractionPanel.tsx:345:      <div className="border-b border-[var(--reader-border)] px-4 py-3 sm:px-5">
frontend/src/components/Extraction/ExtractionPanel.tsx:348:            <p className="text-[11px] font-mono uppercase text-[var(--reader-muted)]">
frontend/src/components/Extraction/ExtractionPanel.tsx:351:            <h2 className="mt-1 text-sm font-semibold text-[var(--reader-ink)]">
frontend/src/components/Extraction/ExtractionPanel.tsx:355:          <Sparkles aria-hidden="true" size={18} className="text-[var(--reader-evidence)]" />
frontend/src/components/Extraction/ExtractionPanel.tsx:357:        <div className="mt-3 flex rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-muted)] p-1">
frontend/src/components/Extraction/ExtractionPanel.tsx:363:                ? "bg-[var(--reader-panel-solid)] text-[var(--reader-ink)] shadow-sm"
frontend/src/components/Extraction/ExtractionPanel.tsx:364:                : "text-[var(--reader-muted)]"
frontend/src/components/Extraction/ExtractionPanel.tsx:375:                ? "bg-[var(--reader-panel-solid)] text-[var(--reader-ink)] shadow-sm"
frontend/src/components/Extraction/ExtractionPanel.tsx:376:                : "text-[var(--reader-muted)]"
frontend/src/components/Extraction/ExtractionPanel.tsx:387:                ? "bg-[var(--reader-panel-solid)] text-[var(--reader-ink)] shadow-sm"
frontend/src/components/Extraction/ExtractionPanel.tsx:388:                : "text-[var(--reader-muted)]"
frontend/src/components/Extraction/ExtractionPanel.tsx:422:          <div className="text-sm text-[var(--reader-muted)]">{tOr("common.loading", "Loading...")}</div>
frontend/src/components/Extraction/ExtractionPanel.tsx:425:            <section className="rounded-lg border border-[var(--reader-border)] bg-white/70 p-3 shadow-sm dark:bg-zinc-900/50">
frontend/src/components/Extraction/ExtractionPanel.tsx:437:                          ? "border-[var(--reader-evidence)] bg-[var(--reader-evidence-soft)]"
frontend/src/components/Extraction/ExtractionPanel.tsx:438:                          : "border-[var(--reader-border)] bg-[var(--reader-panel-solid)] hover:bg-[var(--reader-panel-muted)]"
frontend/src/components/Extraction/ExtractionPanel.tsx:442:                        <Icon size={15} className="text-[var(--reader-evidence)]" aria-hidden="true" />
frontend/src/components/Extraction/ExtractionPanel.tsx:443:                        <span className="text-sm font-semibold text-[var(--reader-ink)]">{template.title}</span>
frontend/src/components/Extraction/ExtractionPanel.tsx:445:                      <p className="mt-2 text-xs leading-5 text-[var(--reader-muted)]">{template.description}</p>
frontend/src/components/Extraction/ExtractionPanel.tsx:451:                <p className="text-xs text-[var(--reader-muted)]">
frontend/src/components/Extraction/ExtractionPanel.tsx:465:                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
frontend/src/components/Extraction/ExtractionPanel.tsx:488:              <section className="rounded-lg border border-[var(--reader-border)] bg-white/80 p-4 shadow-sm dark:bg-zinc-900/50">
frontend/src/components/Extraction/ExtractionPanel.tsx:492:                      <CheckCircle2 size={16} className="text-emerald-600" aria-hidden="true" />
frontend/src/components/Extraction/ExtractionPanel.tsx:496:                      <Clock3 size={16} className="text-amber-600" aria-hidden="true" />
frontend/src/components/Extraction/ExtractionPanel.tsx:499:                      <h3 className="text-sm font-semibold text-[var(--reader-ink)]">
frontend/src/components/Extraction/ExtractionPanel.tsx:502:                      <p className="text-xs text-[var(--reader-muted)]">
frontend/src/components/Extraction/ExtractionPanel.tsx:513:                      <button type="button" onClick={() => void handleExport(activeJob, "md")} className="inline-flex items-center gap-1 rounded-md border border-[var(--reader-border)] px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--reader-panel-muted)]">
frontend/src/components/Extraction/ExtractionPanel.tsx:516:                      <button type="button" onClick={() => void handleExport(activeJob, "csv")} className="inline-flex items-center gap-1 rounded-md border border-[var(--reader-border)] px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--reader-panel-muted)]">
frontend/src/components/Extraction/ExtractionPanel.tsx:531:                      <div className="h-full w-1/2 animate-pulse rounded-full bg-[var(--reader-evidence)] motion-reduce:animate-none" />
frontend/src/components/Extraction/ExtractionPanel.tsx:533:                    <p className="text-sm text-[var(--reader-muted)]">{tOr("extract.runningHint", "DocTalk is reading the document and building cited results.")}</p>
frontend/src/components/Extraction/ExtractionPanel.tsx:582:      <section className="rounded-lg border border-[var(--reader-border)] bg-white/70 p-4 shadow-sm dark:bg-zinc-900/50">
frontend/src/components/Extraction/ExtractionPanel.tsx:585:            <p className="text-xs font-mono uppercase text-[var(--reader-muted)]">
frontend/src/components/Extraction/ExtractionPanel.tsx:590:            <h3 className="mt-1 text-sm font-semibold text-[var(--reader-ink)]">
frontend/src/components/Extraction/ExtractionPanel.tsx:605:          <p className="mt-3 text-xs text-[var(--reader-muted)]">
frontend/src/components/Extraction/ExtractionPanel.tsx:618:          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
frontend/src/components/Extraction/ExtractionPanel.tsx:637:        <div className="text-sm text-[var(--reader-muted)]">{tOr("common.loading", "Loading...")}</div>
frontend/src/components/Extraction/ExtractionPanel.tsx:639:        <section className="rounded-lg border border-dashed border-[var(--reader-border)] bg-[var(--reader-panel-solid)] p-6 text-sm leading-6 text-[var(--reader-muted)]">
frontend/src/components/Extraction/ExtractionPanel.tsx:645:            <section key={table.id} className="rounded-lg border border-[var(--reader-border)] bg-white/80 p-4 shadow-sm dark:bg-zinc-900/50">
frontend/src/components/Extraction/ExtractionPanel.tsx:648:                  <h4 className="text-sm font-semibold text-[var(--reader-ink)]">
frontend/src/components/Extraction/ExtractionPanel.tsx:654:                  <p className="text-xs text-[var(--reader-muted)]">
frontend/src/components/Extraction/ExtractionPanel.tsx:663:                    className="inline-flex items-center justify-center gap-1 rounded-md border border-[var(--reader-border)] px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--reader-panel-muted)] disabled:opacity-50"
frontend/src/components/Extraction/ExtractionPanel.tsx:672:                    className="inline-flex items-center justify-center gap-1 rounded-md border border-[var(--reader-border)] px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--reader-panel-muted)]"
frontend/src/components/Extraction/ExtractionPanel.tsx:679:                <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
frontend/src/components/Extraction/ExtractionPanel.tsx:684:                <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs leading-5 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
frontend/src/components/Extraction/ExtractionPanel.tsx:691:                    <p key={index} className="rounded-md border border-[var(--reader-border)] bg-[var(--reader-panel-muted)] px-2 py-1.5 text-xs leading-5 text-[var(--reader-muted)]">
frontend/src/components/Extraction/ExtractionPanel.tsx:701:                      <tr key={rowIndex} className={rowIndex === 0 ? "font-semibold text-[var(--reader-ink)]" : ""}>
frontend/src/components/Extraction/ExtractionPanel.tsx:703:                          <td key={cellIndex} className="border border-[var(--reader-border)] px-2 py-1.5 align-top">
frontend/src/components/Extraction/ExtractionPanel.tsx:704:                            {cell || <span className="text-[var(--reader-muted)]">-</span>}
frontend/src/components/Extraction/ExtractionPanel.tsx:713:                <p className="mt-2 text-xs text-[var(--reader-muted)]">
frontend/src/components/Extraction/ExtractionPanel.tsx:739:          <thead className="text-xs uppercase text-[var(--reader-muted)]">
frontend/src/components/Extraction/ExtractionPanel.tsx:741:              <th className="border-b border-[var(--reader-border)] px-2 py-2">Fact</th>
frontend/src/components/Extraction/ExtractionPanel.tsx:742:              <th className="border-b border-[var(--reader-border)] px-2 py-2">Value</th>
frontend/src/components/Extraction/ExtractionPanel.tsx:743:              <th className="border-b border-[var(--reader-border)] px-2 py-2">Context</th>
frontend/src/components/Extraction/ExtractionPanel.tsx:744:              <th className="border-b border-[var(--reader-border)] px-2 py-2">Sources</th>
frontend/src/components/Extraction/ExtractionPanel.tsx:750:                <td className="border-b border-[var(--reader-border)] px-2 py-2 font-medium">{asString(item.label)}</td>
frontend/src/components/Extraction/ExtractionPanel.tsx:751:                <td className="border-b border-[var(--reader-border)] px-2 py-2">{asString(item.value)}</td>
frontend/src/components/Extraction/ExtractionPanel.tsx:752:                <td className="border-b border-[var(--reader-border)] px-2 py-2">{asString(item.context)}</td>
frontend/src/components/Extraction/ExtractionPanel.tsx:753:                <td className="border-b border-[var(--reader-border)] px-2 py-2">{refButtons(item.source_refs)}</td>
frontend/src/components/Extraction/ExtractionPanel.tsx:767:          <article key={index} className="rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] p-3">
frontend/src/components/Extraction/ExtractionPanel.tsx:769:              <h4 className="text-sm font-semibold text-[var(--reader-ink)]">{asString(item.topic) || "Evidence"}</h4>
frontend/src/components/Extraction/ExtractionPanel.tsx:772:            <p className="text-sm font-medium leading-6 text-[var(--reader-ink)]">{asString(item.finding)}</p>
frontend/src/components/Extraction/ExtractionPanel.tsx:773:            {item.evidence ? <p className="mt-2 text-sm leading-6 text-[var(--reader-muted)]">{asString(item.evidence)}</p> : null}
frontend/src/components/Extraction/ExtractionPanel.tsx:784:      {data.summary ? <p className="text-[var(--reader-ink)]">{asString(data.summary)}</p> : null}
frontend/src/components/Extraction/ExtractionPanel.tsx:786:        <h4 className="mb-2 text-xs font-mono uppercase text-[var(--reader-muted)]">Key points</h4>
frontend/src/components/Extraction/ExtractionPanel.tsx:790:              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--reader-evidence)]" />
frontend/src/components/Extraction/ExtractionPanel.tsx:798:          <h4 className="mb-2 text-xs font-mono uppercase text-[var(--reader-muted)]">Risks / open questions</h4>
frontend/src/components/Extraction/ExtractionPanel.tsx:802:                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
frontend/src/components/LanguageSelector.tsx:95:      className="fixed z-[10000] w-56 overflow-y-auto rounded-2xl border border-[var(--workbench-border)] bg-[var(--workbench-panel-solid)] p-1.5 text-[var(--workbench-ink)] shadow-2xl shadow-black/15 backdrop-blur-2xl dark:shadow-black/45"
frontend/src/components/LanguageSelector.tsx:104:          className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm text-[var(--workbench-ink)] transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset dark:hover:bg-white/10 ${
frontend/src/components/Diff/DocumentDiffPanel.tsx:50:   * - "editorial": warm-paper terracotta editorial palette — used on the standalone
frontend/src/components/Diff/DocumentDiffPanel.tsx:609:              <p className="font-mono text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">
frontend/src/components/Diff/DocumentDiffPanel.tsx:621:                <span className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{tOr("diff.oldDocument", "Old document")}</span>
frontend/src/components/Diff/DocumentDiffPanel.tsx:633:                <span className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{tOr("diff.newDocument", "New document")}</span>
frontend/src/components/Diff/DocumentDiffPanel.tsx:661:            <div className="mt-3 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">
frontend/src/components/Diff/DocumentDiffPanel.tsx:689:                    <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
frontend/src/components/Diff/DocumentDiffPanel.tsx:691:                    <Clock3 size={16} className="text-amber-600 dark:text-amber-400" aria-hidden="true" />
frontend/src/components/Diff/DocumentDiffPanel.tsx:748:                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">{items.length}</span>
frontend/src/components/Diff/DocumentDiffPanel.tsx:754:                              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
frontend/src/components/Diff/DocumentDiffPanel.tsx:769:                                        className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
frontend/src/components/Diff/DocumentDiffPanel.tsx:784:                                        className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
frontend/src/components/Collections/CreateCollectionModal.tsx:199:                ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100'
frontend/src/components/CookieConsentBanner.tsx:78:      className={`fixed z-40 rounded-2xl border border-[var(--workbench-border)] bg-[var(--workbench-panel-solid)] px-4 py-3 text-[var(--workbench-ink)] shadow-2xl shadow-slate-900/10 backdrop-blur-2xl dark:shadow-black/35
frontend/src/components/CookieConsentBanner.tsx:87:        <p className="text-sm leading-6 text-[var(--workbench-muted)]">
frontend/src/components/CookieConsentBanner.tsx:91:            className="underline transition-colors hover:text-[var(--workbench-ink)] focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm"
frontend/src/components/CookieConsentBanner.tsx:99:            className="rounded-full border border-[var(--workbench-border)] px-4 py-1.5 text-sm text-[var(--workbench-muted)] transition-colors hover:bg-zinc-100 hover:text-[var(--workbench-ink)] focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-50 dark:hover:bg-white/10 dark:focus-visible:ring-offset-zinc-950"
frontend/src/components/ThemeSelector.tsx:107:      className="fixed z-[10000] w-44 rounded-2xl border border-[var(--workbench-border)] bg-[var(--workbench-panel-solid)] p-1.5 text-[var(--workbench-ink)] shadow-2xl shadow-black/15 backdrop-blur-2xl dark:shadow-black/45"
frontend/src/components/ThemeSelector.tsx:123:            className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm text-[var(--workbench-ink)] transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset dark:hover:bg-white/10 ${
frontend/src/components/Collections/CollectionList.tsx:29:          className="group flex min-h-[210px] flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
frontend/src/components/Collections/CollectionList.tsx:79:              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
frontend/src/components/Collections/CollectionList.tsx:80:                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
frontend/src/components/Collections/CollectionList.tsx:91:            <ArrowRight aria-hidden="true" size={16} className="transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
frontend/src/components/FeedbackButton.tsx:346:                  <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
frontend/src/components/admin/ChurnSignalsBars.tsx:25:    <section className="dt-admin-panel rounded-lg border p-4">
frontend/src/components/admin/ChurnSignalsBars.tsx:39:            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(113,113,122,0.18)" />
frontend/src/components/admin/ChurnSignalsBars.tsx:49:            <Bar dataKey="pctValue" fill="#1D4ED8" radius={[4, 4, 0, 0]} />
frontend/src/components/AppHeaderShell.tsx:33:      <Link href="/" className="font-logo font-semibold text-lg sm:text-xl text-[var(--workbench-ink)] hover:text-zinc-950 dark:hover:text-white transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm inline-flex items-center gap-1.5 sm:gap-2">
frontend/src/components/AppHeaderShell.tsx:36:        <span className="hidden sm:inline ml-1 -mt-2 px-1.5 py-0.5 text-[10px] font-medium leading-none rounded-full border border-white/18 bg-white/8 text-[var(--workbench-muted)] tracking-wide uppercase">Beta</span>
frontend/src/components/AppHeaderShell.tsx:47:          className="dt-workbench-pill ml-1 sm:ml-3 inline-flex max-w-[140px] items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors hover:border-[var(--workbench-border-strong)] sm:max-w-[240px] focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
frontend/src/components/AppHeaderShell.tsx:58:          className="dt-workbench-pill ml-1 sm:ml-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors hover:border-[var(--workbench-border-strong)] focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
frontend/src/components/admin/RetentionCurves.tsx:27:      <div className="dt-admin-panel rounded-lg border p-4">
frontend/src/components/admin/RetentionCurves.tsx:46:                stroke="#1D4ED8"
frontend/src/components/admin/RetentionCurves.tsx:48:                dot={{ r: 4, fill: "#1D4ED8" }}
frontend/src/components/admin/RetentionCurves.tsx:71:      <div className="dt-admin-panel rounded-lg border p-4">
frontend/src/components/admin/RetentionCurves.tsx:84:                stroke="#1D4ED8"
frontend/src/components/PdfViewer/PdfToolbar.tsx:49:  const btnClass = 'p-1 rounded-md hover:bg-[var(--reader-panel-muted)] focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-1';
frontend/src/components/PdfViewer/PdfToolbar.tsx:50:  const separatorClass = 'w-px h-5 bg-[var(--reader-border)] mx-1';
frontend/src/components/PdfViewer/PdfToolbar.tsx:54:      <div className="sticky top-0 z-10 flex shrink-0 items-center justify-center gap-2 border-b border-[var(--reader-border)] bg-[var(--reader-panel-solid)]/92 px-3 py-2 text-sm text-[var(--reader-ink)] backdrop-blur">
frontend/src/components/PdfViewer/PdfToolbar.tsx:68:          className={`p-1 rounded-md focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-1 ${grabMode ? 'bg-[var(--reader-panel-muted)] text-[var(--reader-ink)]' : 'hover:bg-[var(--reader-panel-muted)]'}`}
frontend/src/components/PdfViewer/PdfToolbar.tsx:80:          className={`p-1 rounded-md focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-1 ${searchOpen ? 'bg-[var(--reader-panel-muted)] text-[var(--reader-ink)]' : 'hover:bg-[var(--reader-panel-muted)]'}`}
frontend/src/components/PdfViewer/PdfToolbar.tsx:101:            className="w-10 rounded-md border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] px-1 py-0.5 text-center text-xs"
frontend/src/components/PdfViewer/PdfToolbar.tsx:112:        <div className="flex items-center gap-2 border-b border-[var(--reader-border)] bg-[var(--reader-panel-solid)]/92 px-3 py-2 text-sm backdrop-blur">
frontend/src/components/PdfViewer/PdfToolbar.tsx:137:          <button onClick={onSearchPrev} disabled={searchMatchCount === 0} className="p-0.5 rounded hover:bg-[var(--reader-panel-muted)] disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-zinc-400" title={t('toolbar.prevMatch')} aria-label={t('toolbar.prevMatch')}>
frontend/src/components/PdfViewer/PdfToolbar.tsx:140:          <button onClick={onSearchNext} disabled={searchMatchCount === 0} className="p-0.5 rounded hover:bg-[var(--reader-panel-muted)] disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-zinc-400" title={t('toolbar.nextMatch')} aria-label={t('toolbar.nextMatch')}>
frontend/src/components/PdfViewer/PdfToolbar.tsx:143:          <button onClick={() => { setSearchOpen(false); onSearchClose(); }} className="p-0.5 rounded hover:bg-[var(--reader-panel-muted)] focus-visible:ring-2 focus-visible:ring-zinc-400" aria-label={t('toolbar.closeSearch')}>
frontend/src/components/PublicHeader.tsx:25:      <Link href="/" className="font-logo font-semibold text-xl text-[var(--workbench-ink)] hover:text-zinc-950 dark:hover:text-white transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm inline-flex items-center gap-2">
frontend/src/components/PublicHeader.tsx:28:        <span className="ml-1 -mt-2 px-1.5 py-0.5 text-[10px] font-medium leading-none rounded-full border border-white/18 bg-white/8 text-[var(--workbench-muted)] tracking-wide uppercase">Beta</span>
frontend/src/components/PublicHeader.tsx:36:            className="rounded-full px-3 py-1.5 text-sm font-medium text-[var(--workbench-muted)] transition-colors hover:bg-white/10 hover:text-zinc-950 dark:hover:text-white"
frontend/src/components/PublicHeader.tsx:59:          className="dt-workbench-pill hidden sm:inline-flex items-center rounded-full px-3 py-1.5 text-sm transition-colors hover:border-[var(--workbench-border-strong)] hover:text-zinc-950 dark:hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400"
frontend/src/components/seo/CTABanner.tsx:21:            <p className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
frontend/src/components/seo/CTABanner.tsx:28:              <p className="mt-4 max-w-2xl text-[15px] leading-7 text-zinc-300 dark:text-zinc-600">
frontend/src/components/seo/CTABanner.tsx:37:              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
frontend/src/components/seo/CTABanner.tsx:42:              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
frontend/src/components/seo/CTABanner.tsx:45:              <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
frontend/src/components/seo/CTABanner.tsx:52:              <div className="h-5 w-full rounded bg-amber-300/30 dark:bg-amber-200" />
frontend/src/components/seo/CTABanner.tsx:68:          <p className="mx-auto mb-8 max-w-2xl text-[15px] leading-7 text-zinc-600 dark:text-zinc-300">
frontend/src/components/seo/CTABanner.tsx:77:          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
frontend/src/components/UserMenu.tsx:144:            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
frontend/src/components/UserMenu.tsx:184:            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
frontend/src/components/Profile/ProfileInfoSection.tsx:87:              <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm bg-zinc-200 dark:bg-zinc-700 text-[10px]">
frontend/src/components/admin/ReasonBucketsDonut.tsx:14:const COLORS = ["#1D4ED8", "#0F766E", "#52525B", "#DC2626", "#9333EA", "#2563EB"];
frontend/src/components/admin/ReasonBucketsDonut.tsx:21:    <section className="dt-admin-panel rounded-lg border p-4">
frontend/src/components/admin/FeedbackList.tsx:10:    <section className="dt-admin-panel rounded-lg border">
frontend/src/components/TextViewer/TextViewer.tsx:460:    <div className="flex-1 min-h-0 overflow-y-auto bg-stone-50/60 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
frontend/src/components/TextViewer/TextViewer.tsx:506:              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">
frontend/src/components/TextViewer/TextViewer.tsx:666:              className="bg-amber-200 dark:bg-amber-700/60 rounded-sm transition-colors duration-500"
frontend/src/components/TextViewer/TextViewer.tsx:674:            <mark key={i} className="search-match-active bg-amber-400 dark:bg-amber-500 dark:text-white text-zinc-900 rounded-sm">
frontend/src/components/TextViewer/TextViewer.tsx:681:            <mark key={i} className="bg-yellow-200 dark:bg-yellow-700/50 rounded-sm">
frontend/src/components/TextViewer/TextViewer.tsx:713:    <div className={`prose dark:prose-invert max-w-none prose-zinc ${articleMode ? 'prose-base prose-p:leading-8 prose-li:leading-8 prose-headings:scroll-mt-28' : 'prose-sm'}
frontend/src/components/TextViewer/TextViewer.tsx:714:      prose-table:border-collapse prose-table:w-full prose-table:text-sm
frontend/src/components/TextViewer/TextViewer.tsx:715:      prose-th:border prose-th:border-zinc-300 prose-th:dark:border-zinc-600 prose-th:px-3 prose-th:py-2 prose-th:bg-zinc-50 prose-th:dark:bg-zinc-800 prose-th:text-left prose-th:font-semibold
frontend/src/components/TextViewer/TextViewer.tsx:716:      prose-td:border prose-td:border-zinc-200 prose-td:dark:border-zinc-700 prose-td:px-3 prose-td:py-1.5
frontend/src/components/TextViewer/TextViewer.tsx:717:      prose-tr:even:bg-zinc-50/50 prose-tr:even:dark:bg-zinc-800/30
frontend/src/components/TextViewer/TextViewer.tsx:718:      prose-pre:bg-zinc-100 prose-pre:dark:bg-zinc-800 prose-pre:rounded-lg
frontend/src/components/TextViewer/TextViewer.tsx:719:      prose-code:text-zinc-700 prose-code:dark:text-zinc-300
frontend/src/components/TextViewer/TextViewer.tsx:720:      prose-a:text-zinc-600 prose-a:dark:text-zinc-400 prose-a:underline
frontend/src/components/TextViewer/TextViewer.tsx:721:      prose-headings:text-zinc-900 prose-headings:dark:text-zinc-100
frontend/src/components/TextViewer/TextViewer.tsx:722:      prose-strong:text-zinc-900 prose-strong:dark:text-zinc-100
frontend/src/components/TextViewer/TextViewer.tsx:726:        page we used to render a duplicated amber-preview box above the full
frontend/src/components/TextViewer/TextViewer.tsx:737:        <p className="not-prose mb-3 text-xs font-mono text-zinc-500 dark:text-zinc-400">
frontend/src/components/admin/RetentionHeatmap.tsx:8:  if (pct <= 0) return "rgba(113, 113, 122, 0.16)";
frontend/src/components/admin/RetentionHeatmap.tsx:10:  return `rgba(29, 78, 216, ${alpha})`;
frontend/src/components/admin/RetentionHeatmap.tsx:19:      <div className="dt-admin-panel rounded-lg border p-6 text-sm text-zinc-500 dark:text-zinc-400">
frontend/src/components/admin/RetentionHeatmap.tsx:26:    <section className="dt-admin-panel overflow-hidden rounded-lg border">
frontend/src/components/seo/FeatureList.tsx:21:          className="group rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
frontend/src/components/admin/ChurnTab.tsx:26:        <section className="dt-admin-panel rounded-lg border">
frontend/src/components/admin/ChurnTab.tsx:47:      <section className="dt-admin-panel rounded-lg border">
frontend/src/components/admin/ChurnTab.tsx:78:    <div className="dt-admin-panel rounded-lg border p-4">
frontend/src/components/admin/OverviewTab.tsx:89:      <section className="dt-admin-panel rounded-lg border p-4">
frontend/src/components/spell/FlowButton.tsx:22: * bottom on hover, giving the press an "it rose up to meet you" quality
frontend/src/components/spell/FlowButton.tsx:40:    "before:content-[''] before:absolute before:inset-0 before:-z-10 before:translate-y-full before:transition-transform before:duration-[450ms] before:ease-[cubic-bezier(.7,0,.2,1)] hover:before:translate-y-0 motion-reduce:before:hidden";
frontend/src/components/SessionDropdown.tsx:201:                    ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100'
frontend/src/components/SessionDropdown.tsx:255:                      <div className="shrink-0 mr-1 flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
frontend/src/components/admin/ActivationTab.tsx:21:      <section className="dt-admin-panel rounded-lg border p-4">
frontend/src/components/spell/Spinner.tsx:63:      ? 'h-4 w-4 border-[1.5px]'
frontend/src/components/spell/Spinner.tsx:65:        ? 'h-8 w-8 border-[2.5px]'
frontend/src/components/seo/FAQSection.tsx:42:        <span className="pr-4 text-[15px] font-medium text-zinc-900 dark:text-zinc-100">
frontend/src/components/seo/FAQSection.tsx:63:          <p className="text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-300">
frontend/src/components/Profile/CreditsSection.tsx:35:    if (n >= 100) return "text-yellow-600";
frontend/src/components/Profile/CreditsSection.tsx:46:  const barColor = percentUsed < 50 ? "bg-green-500" : percentUsed < 80 ? "bg-yellow-500" : "bg-red-500";
frontend/src/components/spell/StaggeredReveal.tsx:59:            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
frontend/src/components/admin/RetentionTab.tsx:27:      <section className="dt-admin-panel rounded-lg border">
frontend/src/components/admin/RetentionTab.tsx:64:    <div className="dt-admin-panel rounded-lg border p-4">
frontend/src/components/admin/RetentionTab.tsx:75:    <section className="dt-admin-panel rounded-lg border p-4">
frontend/src/components/admin/RetentionTab.tsx:85:              <div className="h-full rounded bg-[#1D4ED8]" style={{ width: `${Math.min(100, row.pct * 100)}%` }} />
frontend/src/components/admin/AdminPanels.tsx:40:    plus: "bg-blue-50 text-[#1D4ED8] dark:bg-blue-400/10 dark:text-blue-300",
frontend/src/components/admin/AdminPanels.tsx:54:        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
frontend/src/components/admin/AdminPanels.tsx:79:    <section className="dt-admin-panel overflow-hidden rounded-lg border">
frontend/src/components/admin/AdminPanels.tsx:83:            <ShieldCheck aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
frontend/src/components/admin/AdminPanels.tsx:85:            <AlertTriangle aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-300" />
frontend/src/components/admin/AdminPanels.tsx:156:    <section className="dt-admin-panel overflow-hidden rounded-lg border">
frontend/src/components/admin/AdminPanels.tsx:212:    <section className="dt-admin-panel overflow-hidden rounded-lg border">
frontend/src/components/admin/AdminPanels.tsx:216:            <ShieldCheck aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
frontend/src/components/admin/AdminPanels.tsx:218:            <AlertTriangle aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-300" />
frontend/src/components/admin/AdminPanels.tsx:317:      <div className="dt-admin-panel overflow-hidden rounded-lg border">
frontend/src/components/admin/AdminPanels.tsx:333:      <div className="dt-admin-panel overflow-hidden rounded-lg border">
frontend/src/components/admin/KPICard.tsx:48:          <Icon aria-hidden="true" className="h-4 w-4 text-[#1D4ED8]" />
frontend/src/components/admin/KPICard.tsx:53:              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
frontend/src/components/admin/KPICard.tsx:70:      <svg className="mt-3 h-9 w-full text-[#1D4ED8]" viewBox="0 0 100 40" aria-hidden="true">
frontend/src/components/ui/LoadingScreen.tsx:27:    ? "min-h-screen flex items-center justify-center bg-[var(--page-background)]"
frontend/src/components/spell/LightRays.tsx:32:            rgba(96,165,250,0.22) 60deg,
frontend/src/components/spell/LightRays.tsx:34:            rgba(29,78,216,0.18) 180deg,
frontend/src/components/spell/LightRays.tsx:36:            rgba(147,197,253,0.15) 300deg,
frontend/src/components/spell/LightRays.tsx:52:        0%  { transform: translate(-10%, -10%) rotate(0deg); }
frontend/src/components/spell/LightRays.tsx:53:        50% { transform: translate(8%, 5%) rotate(15deg); }
frontend/src/components/spell/LightRays.tsx:54:        100%{ transform: translate(-10%, -10%) rotate(0deg); }
frontend/src/components/Chat/ChatPanel.tsx:500:                    <p className="text-[11px] font-mono uppercase tracking-[0.08em] text-[var(--workbench-muted)]">DocTalk</p>
frontend/src/components/Chat/ChatPanel.tsx:501:                    <p className="mt-1 text-sm font-medium text-[var(--workbench-ink)]">{t('chat.trySuggested')}</p>
frontend/src/components/Chat/ChatPanel.tsx:553:              className="pointer-events-auto rounded-full border border-white/14 bg-white/10 p-2 text-[var(--workbench-muted)] shadow-md transition-shadow hover:text-white hover:shadow-lg focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
frontend/src/components/Chat/ChatPanel.tsx:563:        <div className="border-t border-[var(--workbench-border)]">
frontend/src/components/Chat/ChatPanel.tsx:572:                demoRemaining <= 2 ? 'bg-amber-500' : 'bg-zinc-400 dark:bg-zinc-500'
frontend/src/components/Chat/ChatPanel.tsx:584:                  <p className="mt-1 text-[var(--workbench-muted)]">
frontend/src/components/Chat/ChatPanel.tsx:598:            <div className="flex items-center justify-between px-4 py-2 text-sm text-[var(--workbench-muted)]" aria-live="polite">
frontend/src/components/Chat/ChatPanel.tsx:599:              <span className={demoRemaining <= 2 ? 'text-amber-600 dark:text-amber-400 font-medium' : ''}>
frontend/src/components/Chat/ChatPanel.tsx:602:              <button type="button" onClick={() => openAuthModal()} className="text-sm text-[var(--workbench-muted)] hover:text-white hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-zinc-400">
frontend/src/components/Chat/ChatPanel.tsx:651:                className="rounded-full p-1.5 text-[var(--workbench-muted)] transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:opacity-50"
frontend/src/components/Chat/ChatPanel.tsx:660:              className="flex-1 resize-none overflow-y-auto bg-transparent px-1 py-1 text-sm text-[var(--workbench-ink)] placeholder:text-white/38 focus:outline-none"
frontend/src/components/AdminCharts.tsx:49:const PIE_COLORS = ["#38bdf8", "#a78bfa", "#34d399", "#f59e0b", "#60a5fa", "#94a3b8"];
frontend/src/components/AdminCharts.tsx:62:    <div className="dt-admin-panel border p-4">
frontend/src/components/AdminCharts.tsx:76:                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
frontend/src/components/AdminCharts.tsx:77:                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
frontend/src/components/AdminCharts.tsx:102:                  background: "var(--background, #fff)",
frontend/src/components/AdminCharts.tsx:103:                  border: "1px solid var(--border, #e4e4e7)",
frontend/src/components/AdminCharts.tsx:113:                stroke="#38bdf8"
frontend/src/components/AdminCharts.tsx:134:    <div className="dt-admin-panel border p-4">
frontend/src/components/AdminCharts.tsx:163:                  background: "var(--background, #fff)",
frontend/src/components/AdminCharts.tsx:164:                  border: "1px solid var(--border, #e4e4e7)",
frontend/src/components/AdminCharts.tsx:240:          <div className="dt-admin-panel border p-4">
frontend/src/components/AdminCharts.tsx:264:                      background: "var(--background, #fff)",
frontend/src/components/AdminCharts.tsx:265:                      border: "1px solid var(--border, #e4e4e7)",
frontend/src/components/AdminCharts.tsx:270:                  <Bar dataKey="tokens" fill="#38bdf8" radius={[0, 4, 4, 0]} />
frontend/src/components/seo/ComparisonTable.tsx:22:      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40">
frontend/src/components/seo/ComparisonTable.tsx:23:        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-label={t('common.yes')} />
frontend/src/components/seo/ComparisonTable.tsx:33:      <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium text-sm">
frontend/src/components/Chat/DomainModeSelector.tsx:17:  { id: 'legal' as const, label: 'Legal', icon: Scale, color: 'amber' },
frontend/src/components/Chat/DomainModeSelector.tsx:50:      className="flex gap-1 rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] p-1 shadow-sm"
frontend/src/components/Chat/DomainModeSelector.tsx:70:                  ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'
frontend/src/components/Chat/DomainModeSelector.tsx:75:                  ? 'border-transparent text-zinc-500 hover:bg-[var(--reader-panel-muted)] hover:text-zinc-700 dark:hover:text-zinc-200'
frontend/src/components/Chat/DomainModeSelector.tsx:76:                  : 'border-transparent text-zinc-500 hover:bg-[var(--reader-panel-muted)]'
frontend/src/components/spell/FallbackAvatar.tsx:12:  'from-emerald-700 to-emerald-300',
frontend/src/components/spell/FallbackAvatar.tsx:13:  'from-amber-700 to-yellow-300',
frontend/src/components/spell/FallbackAvatar.tsx:14:  'from-rose-900 to-rose-300',
frontend/src/components/spell/FallbackAvatar.tsx:15:  'from-teal-800 to-teal-300',
frontend/src/components/spell/FallbackAvatar.tsx:17:  'from-orange-900 to-orange-300',
frontend/src/components/spell/FallbackAvatar.tsx:53:          background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.28), transparent 50%)',
frontend/src/components/landing/showcaseData.ts:75:    bg: "#ffffff",
frontend/src/components/landing/showcaseData.ts:76:    panelBg: "#fafafa",       // zinc-50
frontend/src/components/landing/showcaseData.ts:77:    cardBg: "#ffffff",
frontend/src/components/landing/showcaseData.ts:78:    border: "#e4e4e7",        // zinc-200
frontend/src/components/landing/showcaseData.ts:79:    borderLight: "#f4f4f5",   // zinc-100
frontend/src/components/landing/showcaseData.ts:80:    textPrimary: "#09090b",   // zinc-950
frontend/src/components/landing/showcaseData.ts:81:    textSecondary: "#71717a", // zinc-500
frontend/src/components/landing/showcaseData.ts:82:    textMuted: "#a1a1aa",     // zinc-400
frontend/src/components/landing/showcaseData.ts:83:    userBubble: "#27272a",    // zinc-800
frontend/src/components/landing/showcaseData.ts:84:    userBubbleText: "#ffffff",
frontend/src/components/landing/showcaseData.ts:85:    assistantBubble: "#fafafa", // zinc-50
frontend/src/components/landing/showcaseData.ts:86:    assistantBubbleText: "#18181b", // zinc-900
frontend/src/components/landing/showcaseData.ts:87:    highlightBg: "rgba(251, 191, 36, 0.30)", // amber-400 @ 30%
frontend/src/components/landing/showcaseData.ts:88:    toolbarBg: "#f4f4f5",     // zinc-100
frontend/src/components/landing/showcaseData.ts:89:    inputBg: "#ffffff",
frontend/src/components/landing/showcaseData.ts:90:    chromeTop: "#f4f4f5",
frontend/src/components/landing/showcaseData.ts:93:    bg: "#09090b",            // zinc-950
frontend/src/components/landing/showcaseData.ts:94:    panelBg: "#18181b",       // zinc-900
frontend/src/components/landing/showcaseData.ts:95:    cardBg: "#09090b",        // zinc-950
frontend/src/components/landing/showcaseData.ts:96:    border: "#27272a",        // zinc-800
frontend/src/components/landing/showcaseData.ts:97:    borderLight: "#3f3f46",   // zinc-700
frontend/src/components/landing/showcaseData.ts:98:    textPrimary: "#fafafa",   // zinc-50
frontend/src/components/landing/showcaseData.ts:99:    textSecondary: "#71717a", // zinc-500
frontend/src/components/landing/showcaseData.ts:100:    textMuted: "#a1a1aa",     // zinc-400
frontend/src/components/landing/showcaseData.ts:101:    userBubble: "#3f3f46",    // zinc-700
frontend/src/components/landing/showcaseData.ts:102:    userBubbleText: "#ffffff",
frontend/src/components/landing/showcaseData.ts:103:    assistantBubble: "#27272a", // zinc-800
frontend/src/components/landing/showcaseData.ts:104:    assistantBubbleText: "#e4e4e7", // zinc-200
frontend/src/components/landing/showcaseData.ts:105:    highlightBg: "rgba(251, 191, 36, 0.30)",
frontend/src/components/landing/showcaseData.ts:106:    toolbarBg: "#27272a",
frontend/src/components/landing/showcaseData.ts:107:    inputBg: "#18181b",
frontend/src/components/landing/showcaseData.ts:108:    chromeTop: "#27272a",
frontend/src/components/spell/BlurReveal.tsx:20: * Entrance animation — content fades in from blur+translate-y when it
frontend/src/components/spell/BlurReveal.tsx:59:  const hidden = 'opacity-0 blur-[10px] translate-y-[10px]';
frontend/src/components/spell/BlurReveal.tsx:60:  const shown = 'opacity-100 blur-0 translate-y-0';
frontend/src/components/Chat/SourcesStrip.tsx:22: * instead of scattering numeric [1][2] pills through prose.
frontend/src/components/Chat/SourcesStrip.tsx:71:          className="dt-sources-label text-[11px] uppercase"
frontend/src/components/Chat/SourcesStrip.tsx:83:              className="h-7 w-36 rounded-md border border-[var(--reader-evidence-border)] bg-[var(--reader-panel-solid)] animate-pulse motion-reduce:animate-none"
frontend/src/components/Chat/SourcesStrip.tsx:98:      <div className="dt-sources-label text-[11px] font-mono uppercase">
frontend/src/components/Chat/SourcesStrip.tsx:116:              <span className="dt-source-index inline-flex h-4 min-w-4 items-center justify-center rounded px-1 text-[10px] font-bold leading-none">
frontend/src/components/Chat/SourcesStrip.tsx:122:                className="shrink-0 text-zinc-400 group-hover:text-[var(--reader-evidence)] dark:text-zinc-500"
frontend/src/components/Chat/SourcesStrip.tsx:126:                className="shrink-0 text-[10px] text-[var(--reader-muted)]"
frontend/src/components/Chat/PlusMenu.tsx:67:          className="absolute bottom-full left-0 z-20 mb-2 w-56 rounded-xl border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] py-1 shadow-lg animate-fade-in motion-reduce:animate-none"
frontend/src/components/Chat/PlusMenu.tsx:84:              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--reader-ink)] hover:bg-[var(--reader-panel-muted)] transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset"
frontend/src/components/Chat/PlusMenu.tsx:89:                <span className="ml-auto text-[11px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
frontend/src/components/Chat/PlusMenu.tsx:94:                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
frontend/src/components/Chat/PlusMenu.tsx:100:            <div className="border-t border-[var(--reader-border)]" />
frontend/src/components/Chat/PlusMenu.tsx:113:              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--reader-ink)] hover:bg-[var(--reader-panel-muted)] transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset"
frontend/src/components/Chat/PlusMenu.tsx:134:              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--reader-ink)] hover:bg-[var(--reader-panel-muted)] transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset"
frontend/src/components/Chat/PlusMenu.tsx:139:                <span className="ml-auto text-[11px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
frontend/src/components/Chat/PlusMenu.tsx:160:              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--reader-ink)] hover:bg-[var(--reader-panel-muted)] transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset"
frontend/src/components/Chat/PlusMenu.tsx:165:                <span className="ml-auto text-[11px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
frontend/src/components/spell/ShimmerBadge.tsx:19:      className={`relative inline-flex items-center gap-1.5 overflow-hidden rounded-full py-1 text-[11px] font-mono font-semibold uppercase tracking-[0.14em] text-accent ${
frontend/src/components/spell/ShimmerBadge.tsx:22:      style={{ background: 'linear-gradient(90deg,transparent,rgba(29,78,216,0.10),transparent)' }}
frontend/src/components/spell/ShimmerBadge.tsx:27:          className="absolute left-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-current motion-reduce:animate-none"
frontend/src/components/spell/ShimmerBadge.tsx:37:            'linear-gradient(90deg, transparent 0%, rgba(29,78,216,0.18) 50%, transparent 100%)',
frontend/src/components/spell/ShimmerBadge.tsx:38:          transform: 'translateX(-100%)',
frontend/src/components/spell/ShimmerBadge.tsx:43:        @keyframes spellShimX { to { transform: translateX(100%); } }
frontend/src/components/spell/ShimmerBadge.tsx:45:          0%   { box-shadow: 0 0 0 0 rgba(29,78,216,0.4); }
frontend/src/components/spell/ShimmerBadge.tsx:46:          70%  { box-shadow: 0 0 0 8px rgba(29,78,216,0); }
frontend/src/components/spell/ShimmerBadge.tsx:47:          100% { box-shadow: 0 0 0 0 rgba(29,78,216,0); }
frontend/src/components/dashboard/DashboardPageClient.tsx:203:      return { dotClass: 'bg-amber-500 animate-pulse', label: t('dashboard.status.processing') };
frontend/src/components/dashboard/DashboardPageClient.tsx:205:    return { dotClass: 'bg-emerald-500', label: t('dashboard.status.ready') };
frontend/src/components/dashboard/DashboardPageClient.tsx:395:                    <h2 className="text-sm font-semibold text-[var(--workbench-ink)]">
frontend/src/components/dashboard/DashboardPageClient.tsx:398:                    <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--workbench-muted)]">
frontend/src/components/dashboard/DashboardPageClient.tsx:423:                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--workbench-muted)] transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
frontend/src/components/dashboard/DashboardPageClient.tsx:444:            <p className="text-[var(--workbench-ink)] text-lg">{t('upload.dragDrop')}</p>
frontend/src/components/dashboard/DashboardPageClient.tsx:445:            <p className="text-[var(--workbench-muted)] text-xs mt-1">{t('upload.supportedFormats')}</p>
frontend/src/components/dashboard/DashboardPageClient.tsx:446:            <p className="text-[var(--workbench-muted)] text-sm mt-1">{t('upload.or')}</p>
frontend/src/components/dashboard/DashboardPageClient.tsx:474:              <Link2 aria-hidden="true" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
frontend/src/components/dashboard/DashboardPageClient.tsx:481:                className="w-full rounded-full border border-white/14 bg-white/8 py-2.5 pl-9 pr-3 text-sm text-[var(--workbench-ink)] placeholder:text-white/38 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
frontend/src/components/dashboard/DashboardPageClient.tsx:510:            <Link href="/demo" className="text-[var(--workbench-muted)] hover:text-white text-sm transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm">
frontend/src/components/dashboard/DashboardPageClient.tsx:518:            <h2 className="text-3xl font-semibold tracking-normal text-[var(--workbench-ink)]">{t('doc.myDocuments')}</h2>
frontend/src/components/dashboard/DashboardPageClient.tsx:545:                    <h3 className="text-sm font-semibold text-[var(--workbench-ink)]">
frontend/src/components/dashboard/DashboardPageClient.tsx:548:                    <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--workbench-muted)]">
frontend/src/components/dashboard/DashboardPageClient.tsx:569:              <FileUp aria-hidden="true" size={52} className="text-[var(--workbench-muted)]" />
frontend/src/components/dashboard/DashboardPageClient.tsx:570:              <h3 className="mt-5 text-xl font-semibold text-[var(--workbench-ink)]">{t('dashboard.emptyTitle')}</h3>
frontend/src/components/dashboard/DashboardPageClient.tsx:571:              <p className="mt-2 max-w-md text-sm text-[var(--workbench-muted)]">{t('dashboard.emptySubtitle')}</p>
frontend/src/components/dashboard/DashboardPageClient.tsx:582:                  <span aria-hidden="true" className="transition-transform motion-reduce:transform-none group-hover:translate-x-0.5">→</span>
frontend/src/components/dashboard/DashboardPageClient.tsx:587:                  className="text-sm font-semibold text-[var(--workbench-muted)] transition-colors hover:text-white motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm"
frontend/src/components/dashboard/DashboardPageClient.tsx:600:                    className="dt-stitch-card flex items-center justify-between rounded-2xl p-5 transition-transform duration-200 hover:-translate-y-0.5"
frontend/src/components/dashboard/DashboardPageClient.tsx:603:                      <div className="font-medium text-[var(--workbench-ink)] flex items-center gap-2 min-w-0">
frontend/src/components/dashboard/DashboardPageClient.tsx:605:                        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--workbench-muted)] shrink-0">
frontend/src/components/dashboard/DashboardPageClient.tsx:610:                      <div className="text-xs text-[var(--workbench-muted)] mt-0.5">
frontend/src/components/dashboard/DashboardPageClient.tsx:660:                          className="rounded-full p-2 text-[var(--workbench-muted)] transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
frontend/src/app/profile/error.tsx:15:    <div className="min-h-screen bg-[var(--page-background)] flex items-center justify-center p-6">
frontend/src/components/spell/CopyButton.tsx:48:  const sz = size === 'md' ? 'px-3 py-1.5 text-xs gap-2' : 'px-2.5 py-1 text-[10px] gap-1.5';
frontend/src/components/spell/CopyButton.tsx:57:          ? 'bg-emerald-600 text-white'
frontend/src/components/spell/CopyButton.tsx:69:            background: `radial-gradient(circle at ${rp.x}% ${rp.y}%, rgba(255,255,255,0.35), transparent 60%)`,
frontend/src/components/Chat/CollectionCitationCard.tsx:12:  if (score >= 0.8) return 'bg-emerald-500';
frontend/src/components/Chat/CollectionCitationCard.tsx:13:  if (score >= 0.5) return 'bg-amber-500';
frontend/src/components/landing/HeroArtifact.tsx:19:        className="ed-body max-w-3xl text-[17px] leading-7 text-[var(--ed-ink)]"
frontend/src/components/landing/HeroArtifact.tsx:32:          className="inline-flex items-center gap-1.5 rounded-[3px] border border-[var(--ed-rule)] bg-[var(--ed-paper)] px-2.5 py-1.5 text-[var(--ed-ink-2)]"
frontend/src/components/landing/HeroArtifact.tsx:42:            className="text-[var(--ed-ink-3)]"
frontend/src/components/landing/HeroArtifact.tsx:49:          className="inline-flex items-center gap-1.5 rounded-[3px] border border-[var(--ed-rule)] bg-[var(--ed-paper)] px-2.5 py-1.5 text-[var(--ed-ink-3)]"
frontend/src/components/landing/HeroArtifact.tsx:59:            className="text-[var(--ed-ink-3)]"
frontend/src/components/landing/HeroArtifact.tsx:66:          className="ml-auto inline-flex items-center gap-1.5 rounded-[3px] border border-[var(--ed-signal)] bg-[var(--ed-paper)] px-2.5 py-1.5 text-[var(--ed-signal)]"
frontend/src/components/landing/HeroArtifact.tsx:76:            className="text-[var(--ed-signal)]"
frontend/src/components/landing/HeroArtifact.tsx:85:          className="text-[var(--ed-ink-3)]"
frontend/src/components/landing/HeroArtifact.tsx:91:        className="mt-5 border-t border-[var(--ed-rule)]"
frontend/src/components/landing/HeroArtifact.tsx:100:            className="max-w-[22rem] truncate rounded-[3px] border border-[var(--ed-rule)] bg-[var(--ed-paper)] px-2.5 py-1.5 text-[var(--ed-ink-3)]"
frontend/src/components/spell/TextMarquee.tsx:20: * Infinite horizontal marquee. Content is rendered twice and translated
frontend/src/components/spell/TextMarquee.tsx:54:      className={`relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)] ${className}`}
frontend/src/components/spell/TextMarquee.tsx:72:      <style>{`@keyframes spellMarquee { to { transform: translateX(calc(-50% - ${gap / 2}px)); } }`}</style>
frontend/src/app/billing/error.tsx:15:    <div className="min-h-screen bg-[var(--page-background)] flex items-center justify-center p-6">
frontend/src/components/Chat/ChatArtifactCard.tsx:182:    <div className="not-prose mt-4 overflow-hidden rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] shadow-sm">
frontend/src/components/Chat/ChatArtifactCard.tsx:183:      <div className="flex items-start gap-3 border-b border-[var(--reader-border)] px-4 py-3">
frontend/src/components/Chat/ChatArtifactCard.tsx:184:        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--reader-evidence-border)] bg-[var(--reader-evidence-soft)] text-[var(--reader-evidence)]">
frontend/src/components/Chat/ChatArtifactCard.tsx:189:            <p className="text-sm font-semibold text-[var(--reader-ink)]">{current.title}</p>
frontend/src/components/Chat/ChatArtifactCard.tsx:190:            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
frontend/src/components/Chat/ChatArtifactCard.tsx:194:                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
frontend/src/components/Chat/ChatArtifactCard.tsx:201:          <p className="mt-1 text-sm leading-relaxed text-[var(--reader-muted)]">{current.summary}</p>
frontend/src/components/Chat/ChatArtifactCard.tsx:206:            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{current.warning}</p>
frontend/src/components/Chat/ChatArtifactCard.tsx:209:        {isPending ? <RefreshCw size={16} className="mt-2 shrink-0 animate-spin text-[var(--reader-muted)] motion-reduce:animate-none" /> : null}
frontend/src/components/Chat/ChatArtifactCard.tsx:221:              <div key={`${current.jobId || current.title}-${index}`} className="overflow-hidden rounded-md border border-[var(--reader-border)]">
frontend/src/components/Chat/ChatArtifactCard.tsx:222:                <div className="flex items-center justify-between bg-[var(--reader-panel-muted)] px-3 py-2 text-xs text-[var(--reader-muted)]">
frontend/src/components/Chat/ChatArtifactCard.tsx:234:                        className="inline-flex min-h-7 items-center gap-1 rounded border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] px-2 text-[11px] font-medium text-[var(--reader-ink)] transition-colors hover:bg-[var(--reader-panel-muted)] disabled:opacity-50"
frontend/src/components/Chat/ChatArtifactCard.tsx:244:                  <p className="border-t border-[var(--reader-border)] bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
frontend/src/components/Chat/ChatArtifactCard.tsx:249:                  <p className="border-t border-[var(--reader-border)] bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
frontend/src/components/Chat/ChatArtifactCard.tsx:254:                  <p key={warningIndex} className="border-t border-[var(--reader-border)] bg-[var(--reader-panel-muted)] px-3 py-2 text-xs leading-5 text-[var(--reader-muted)]">
frontend/src/components/Chat/ChatArtifactCard.tsx:262:                        <tr key={rowIndex} className="border-t border-[var(--reader-border)]">
frontend/src/components/Chat/ChatArtifactCard.tsx:264:                            <td key={cellIndex} className="max-w-40 truncate px-3 py-2 text-[var(--reader-ink)]">
frontend/src/components/Chat/ChatArtifactCard.tsx:278:        <div className="max-h-52 overflow-y-auto whitespace-pre-wrap px-4 py-3 text-sm leading-relaxed text-[var(--reader-ink)]">
frontend/src/components/Chat/ChatArtifactCard.tsx:284:        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--reader-border)] px-4 py-3">
frontend/src/components/Chat/ChatArtifactCard.tsx:296:            <span className="text-xs font-medium text-[var(--reader-muted)]">
frontend/src/components/Chat/ChatArtifactCard.tsx:305:              className="inline-flex min-h-8 items-center rounded-md border border-[var(--reader-evidence-border)] bg-[var(--reader-evidence-soft)] px-2 text-xs font-medium text-[var(--reader-evidence)] transition-colors hover:brightness-95"
frontend/src/components/Chat/CitationPopover.tsx:14:  if (score >= 0.8) return 'bg-emerald-500';
frontend/src/components/Chat/CitationPopover.tsx:15:  if (score >= 0.5) return 'bg-amber-500';
frontend/src/components/spell/TiltCard.tsx:9:  /** Spotlight color (rgba). Pairs well with the accent. */
frontend/src/components/spell/TiltCard.tsx:25:  spotlightColor = 'rgba(29,78,216,0.18)',
frontend/src/components/spell/TiltCard.tsx:42:    const lift = liftY ? `translateY(-${liftY}px) ` : '';
frontend/src/components/landing/FeatureGrid.tsx:15:  'relative h-28 w-full overflow-hidden border border-[var(--ed-rule)] bg-[var(--ed-paper-2)]';
frontend/src/components/landing/FeatureGrid.tsx:22:        <div className="relative h-20 w-28 border border-[var(--ed-rule)] bg-[var(--ed-paper)] px-2 py-1.5">
frontend/src/components/landing/FeatureGrid.tsx:23:          <div className="mb-1.5 font-mono text-[7px] uppercase tracking-wider text-[var(--ed-ink-3)]">
frontend/src/components/landing/FeatureGrid.tsx:27:            <div className="h-1 w-full bg-[var(--ed-rule)]" />
frontend/src/components/landing/FeatureGrid.tsx:28:            <div className="h-1.5 w-full bg-[var(--ed-signal)]/20 border-l-2 border-[var(--ed-signal)]" />
frontend/src/components/landing/FeatureGrid.tsx:29:            <div className="h-1 w-4/5 bg-[var(--ed-rule)]" />
frontend/src/components/landing/FeatureGrid.tsx:30:            <div className="h-1 w-3/4 bg-[var(--ed-rule)]" />
frontend/src/components/landing/FeatureGrid.tsx:35:          <div className="border border-[var(--ed-signal)]/40 bg-[var(--ed-paper)] px-1.5 py-0.5 font-mono text-[9px] font-semibold text-[var(--ed-signal)]">
frontend/src/components/landing/FeatureGrid.tsx:38:          <div className="inline-flex items-center border border-[var(--ed-rule)] bg-[var(--ed-paper)] px-1.5 py-1 font-mono text-[9px] text-[var(--ed-ink-2)]">
frontend/src/components/landing/FeatureGrid.tsx:39:            <span className="mr-1 inline-flex items-center justify-center bg-[var(--ed-signal)] px-1 py-0.5 text-[8px] font-bold leading-none text-white">
frontend/src/components/landing/FeatureGrid.tsx:59:              className="border border-[var(--ed-rule)] bg-[var(--ed-paper)] px-2 py-1 font-mono text-[10px] font-semibold text-[var(--ed-ink-2)]"
frontend/src/components/landing/FeatureGrid.tsx:77:            <span key={l} className="text-[11px] font-semibold text-[var(--ed-ink-3)]">
frontend/src/components/landing/FeatureGrid.tsx:92:          <span className="border border-[var(--ed-rule)] bg-[var(--ed-paper)] px-3 py-1 font-mono text-[11px] text-[var(--ed-ink-2)]">
frontend/src/components/landing/FeatureGrid.tsx:95:          <span className="font-mono text-[9px] text-[var(--ed-ink-3)]">fast</span>
frontend/src/components/landing/FeatureGrid.tsx:97:        <div className="h-8 w-px bg-[var(--ed-rule)]" />
frontend/src/components/landing/FeatureGrid.tsx:99:          <span className="border border-[var(--ed-signal)]/50 bg-[var(--ed-paper)] px-3 py-1 font-mono text-[11px] font-semibold text-[var(--ed-signal)]">
frontend/src/components/landing/FeatureGrid.tsx:102:          <span className="font-mono text-[9px] text-[var(--ed-ink-3)]">deeper</span>
frontend/src/components/landing/FeatureGrid.tsx:115:          <div className="absolute -left-1 -top-1 h-16 w-14 border border-[var(--ed-rule)] bg-[var(--ed-paper)] opacity-50" />
frontend/src/components/landing/FeatureGrid.tsx:116:          <div className="absolute -left-0.5 -top-0.5 h-16 w-14 border border-[var(--ed-rule)] bg-[var(--ed-paper)] opacity-75" />
frontend/src/components/landing/FeatureGrid.tsx:117:          <div className="relative h-16 w-14 border border-[var(--ed-rule)] bg-[var(--ed-paper)] px-1.5 py-1.5">
frontend/src/components/landing/FeatureGrid.tsx:119:              <div className="h-0.5 w-full bg-[var(--ed-rule)]" />
frontend/src/components/landing/FeatureGrid.tsx:120:              <div className="h-0.5 w-5/6 bg-[var(--ed-rule)]" />
frontend/src/components/landing/FeatureGrid.tsx:121:              <div className="h-0.5 w-3/4 bg-[var(--ed-rule)]" />
frontend/src/components/landing/FeatureGrid.tsx:127:          <span className="border border-[var(--ed-signal)]/40 bg-[var(--ed-paper)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--ed-signal)]">
frontend/src/components/landing/FeatureGrid.tsx:130:          <span className="font-mono text-[10px] text-[var(--ed-ink-3)]">3 demos</span>
frontend/src/components/landing/FeatureGrid.tsx:143:          className="h-7 w-7 text-[var(--ed-signal)]"
frontend/src/components/landing/FeatureGrid.tsx:155:          <span className="border border-[var(--ed-rule)] bg-[var(--ed-paper)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--ed-ink-3)]">
frontend/src/components/landing/FeatureGrid.tsx:158:          <span className="border border-[var(--ed-rule)] bg-[var(--ed-paper)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--ed-ink-3)]">
frontend/src/components/landing/FeatureGrid.tsx:222:                      isRightCol ? 'md:pl-10 md:border-l md:border-[var(--ed-rule)]' : 'md:pr-10',
frontend/src/components/landing/FeatureGrid.tsx:224:                      !isLastRow ? 'border-b border-[var(--ed-rule)]' : '',
frontend/src/app/profile/ProfilePageClient.tsx:122:                      <div className="mt-1 text-[11px] font-medium leading-4 text-zinc-500 dark:text-zinc-400">
frontend/src/components/AdminUserActivityCharts.tsx:31:  active: "#38bdf8",
frontend/src/components/AdminUserActivityCharts.tsx:32:  upload: "#22c55e",
frontend/src/components/AdminUserActivityCharts.tsx:33:  chat: "#60a5fa",
frontend/src/components/AdminUserActivityCharts.tsx:34:  feedback: "#f59e0b",
frontend/src/components/AdminUserActivityCharts.tsx:35:  nudge: "#facc15",
frontend/src/components/AdminUserActivityCharts.tsx:36:  paywall: "#a78bfa",
frontend/src/components/AdminUserActivityCharts.tsx:37:  limit: "#fb7185",
frontend/src/components/AdminUserActivityCharts.tsx:38:  checkout: "#34d399",
frontend/src/components/AdminUserActivityCharts.tsx:39:  neutral: "#94a3b8",
frontend/src/components/AdminUserActivityCharts.tsx:55:    <span className={positive ? "text-xs text-emerald-600 dark:text-emerald-300" : "text-xs text-red-600 dark:text-red-300"}>
frontend/src/components/AdminUserActivityCharts.tsx:94:    <section className="dt-admin-panel overflow-hidden border">
frontend/src/components/AdminUserActivityCharts.tsx:125:              className="flex h-full items-center justify-end rounded bg-accent px-2 text-[11px] font-medium text-white"
frontend/src/components/AdminUserActivityCharts.tsx:154:        <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
frontend/src/components/AdminUserActivityCharts.tsx:182:                        style={{ backgroundColor: `rgba(29, 78, 216, ${Math.min(0.12 + value * 0.9, 0.75)})` }}
frontend/src/components/AdminUserActivityCharts.tsx:253:        <h2 className="text-lg font-semibold text-[var(--workbench-ink)]">{tOr('admin.activityIntelligence', 'User Activity Intelligence')}</h2>
frontend/src/components/AdminUserActivityCharts.tsx:296:                      background: "var(--background, #fff)",
frontend/src/components/AdminUserActivityCharts.tsx:297:                      border: "1px solid var(--border, #e4e4e7)",
frontend/src/components/AdminUserActivityCharts.tsx:337:                      background: "var(--background, #fff)",
frontend/src/components/AdminUserActivityCharts.tsx:338:                      border: "1px solid var(--border, #e4e4e7)",
frontend/src/components/AdminUserActivityCharts.tsx:394:                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
frontend/src/components/AdminUserActivityCharts.tsx:401:                  <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-zinc-400">
frontend/src/components/landing/HowItWorks.tsx:35:                    (idx > 0 ? ' md:pl-8 md:border-l border-[var(--ed-rule)]' : '')
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:89:            className="inline-flex h-6 items-center gap-1 rounded-md border border-[var(--reader-evidence-border)] bg-[var(--reader-evidence-soft)] px-2 text-[11px] font-medium text-[var(--reader-evidence)] transition-colors hover:border-[var(--reader-evidence)] focus-visible:ring-2 focus-visible:ring-[var(--reader-evidence)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:115:      <div className="h-24 rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-muted)] animate-pulse motion-reduce:animate-none" />
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:117:        <div key={item} className="space-y-2 rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] p-4">
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:154:    <div className="h-full overflow-y-auto bg-[var(--reader-panel-solid)] text-[var(--reader-ink)]">
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:156:        <header className="flex flex-col gap-4 border-b border-[var(--reader-border)] pb-4">
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:159:              <div className="mb-2 flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.14em] text-[var(--reader-muted)]">
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:170:              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-muted)] px-3 text-sm font-medium text-[var(--reader-ink)] transition-colors hover:border-[var(--reader-border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--reader-evidence)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:177:          <div className="flex flex-wrap gap-2 text-xs text-[var(--reader-muted)]">
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:179:              <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--reader-border)] px-2.5 py-1">
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:185:              <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--reader-border)] px-2.5 py-1">
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:191:              <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--reader-border)] px-2.5 py-1">
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:218:          <div className="rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-muted)] px-4 py-5">
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:220:              <Clock3 size={16} className="text-[var(--reader-evidence)]" aria-hidden="true" />
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:223:            <p className="mt-2 text-sm text-[var(--reader-muted)]">
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:230:              <section className="rounded-lg border border-[var(--reader-evidence-border)] bg-[var(--reader-evidence-soft)] p-4">
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:232:                  <Sparkles size={16} className="text-[var(--reader-evidence)]" aria-hidden="true" />
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:235:                <p className="text-sm leading-7 text-[var(--reader-ink)]">{brief.summary}</p>
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:243:                    <article key={`${item.title}-${index}`} className="border-l-2 border-[var(--reader-evidence-border)] pl-3">
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:248:                      {item.summary ? <p className="mt-1 text-sm leading-6 text-[var(--reader-muted)]">{item.summary}</p> : null}
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:260:                      <span className="mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-[var(--reader-panel-muted)] font-mono text-xs text-[var(--reader-muted)]">
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:277:                <div className="overflow-hidden rounded-lg border border-[var(--reader-border)]">
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:279:                    <div key={`${item.label}-${index}`} className="grid gap-2 border-b border-[var(--reader-border)] p-3 last:border-b-0 sm:grid-cols-[minmax(8rem,14rem)_1fr]">
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:281:                        <div className="text-xs font-medium uppercase text-[var(--reader-muted)]">{item.label}</div>
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:284:                      <div className="text-sm leading-6 text-[var(--reader-muted)]">
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:300:                    <span key={`${question}-${index}`} className="rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-muted)] px-3 py-2 text-sm text-[var(--reader-muted)]">
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:324:    <section className="rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] p-4">
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:325:      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--reader-ink)]">
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:326:        <span className="text-[var(--reader-evidence)]">{icon}</span>
frontend/src/components/Chat/MessageBubble.tsx:66:                className="not-prose dt-source-index align-super mx-0.5 inline-flex h-[1.125rem] min-w-[1.125rem] cursor-pointer select-none items-center justify-center rounded px-1 text-[10px] font-semibold leading-none transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--reader-evidence)]"
frontend/src/components/Chat/MessageBubble.tsx:139:    <div className="not-prose my-4 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700">
frontend/src/components/Chat/MessageBubble.tsx:146:          className="shiki-container text-[13px] leading-relaxed [&_pre]:!m-0 [&_pre]:!p-4 [&_pre]:overflow-x-auto"
frontend/src/components/Chat/MessageBubble.tsx:150:        <pre className="text-[13px] leading-relaxed text-zinc-800 dark:text-zinc-100 bg-white dark:bg-zinc-900 overflow-x-auto p-4 m-0">
frontend/src/components/Chat/MessageBubble.tsx:275:              : 'dt-answer-card text-[var(--workbench-ink)]'
frontend/src/components/Chat/MessageBubble.tsx:281:            <div className="flex items-center gap-2 text-[var(--workbench-muted)] text-sm" aria-live="polite">
frontend/src/components/Chat/MessageBubble.tsx:292:              {/* Sources strip — rendered above the prose so the
frontend/src/components/Chat/MessageBubble.tsx:304:              <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 sm:prose-base">
frontend/src/components/Chat/MessageBubble.tsx:315:                <p className="mt-3 text-sm text-[var(--workbench-muted)]">{message.toolStatus}</p>
frontend/src/components/Chat/MessageBubble.tsx:333:              className="rounded-full p-1.5 text-[var(--workbench-muted)] transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400"
frontend/src/components/Chat/MessageBubble.tsx:344:                  : 'text-[var(--workbench-muted)] hover:bg-white/10 hover:text-white'
frontend/src/components/Chat/MessageBubble.tsx:357:                  : 'text-[var(--workbench-muted)] hover:bg-white/10 hover:text-white'
frontend/src/components/Chat/MessageBubble.tsx:369:                className="rounded-full p-1.5 text-[var(--workbench-muted)] transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50"
frontend/src/components/Chat/MessageBubble.tsx:379:                className="rounded-full p-1.5 text-[var(--workbench-muted)] transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400"
frontend/src/components/Chat/MessageBubble.tsx:393:            className="mt-2 flex items-center gap-1.5 rounded-lg border border-[var(--reader-evidence-border)] bg-[var(--reader-evidence-soft)] px-3 py-1.5 text-sm font-medium text-[var(--reader-evidence)] transition-colors hover:brightness-95 focus-visible:ring-2 focus-visible:ring-[var(--reader-evidence)]"
frontend/src/components/Chat/CitationCard.tsx:40:      <span className="dt-source-index inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded px-1 text-[10px] font-bold leading-none">{refIndex}</span>
frontend/src/components/Chat/CitationCard.tsx:41:      <span className="max-w-[220px] truncate text-[var(--reader-muted)]">{snippet}</span>
frontend/src/components/Chat/CitationCard.tsx:43:        className="shrink-0 text-[10px] text-[var(--reader-muted)]"
frontend/src/app/billing/BillingPageClient.tsx:515:                  <div className="mt-1 text-[11px] font-medium leading-4 text-zinc-500 dark:text-zinc-400">
frontend/src/app/billing/BillingPageClient.tsx:581:                  <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
frontend/src/app/billing/BillingPageClient.tsx:704:                className={`relative rounded-xl border p-0 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${
frontend/src/app/billing/BillingPageClient.tsx:779:                className={`relative rounded-xl border p-0 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${
frontend/src/app/billing/BillingPageClient.tsx:852:              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
frontend/src/app/billing/BillingPageClient.tsx:858:                    <p className="mt-1 leading-6 text-emerald-800 dark:text-emerald-200">
frontend/src/app/billing/BillingPageClient.tsx:865:                  <ShieldCheck aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-300" />
frontend/src/app/billing/BillingPageClient.tsx:913:                className="border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl p-6 flex flex-col shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-shadow transition-transform duration-200"
frontend/src/app/billing/BillingPageClient.tsx:1155:                <label className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
frontend/src/app/billing/BillingPageClient.tsx:1161:                    className="mt-1 rounded border-emerald-300 text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-400"
frontend/src/app/billing/BillingPageClient.tsx:1167:                    <span className="mt-0.5 block leading-5 text-emerald-800 dark:text-emerald-200">
frontend/src/components/PrivacyBadge.tsx:13:        <Shield aria-hidden="true" size={16} className="text-emerald-600 dark:text-emerald-400" />
frontend/src/components/PrivacyBadge.tsx:19:          <Check aria-hidden="true" size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
frontend/src/components/PrivacyBadge.tsx:23:          <Check aria-hidden="true" size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
frontend/src/components/PrivacyBadge.tsx:27:          <Check aria-hidden="true" size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
frontend/src/app/opengraph-image.tsx:13:          background: 'linear-gradient(135deg, #18181b 0%, #27272a 50%, #18181b 100%)',
frontend/src/app/opengraph-image.tsx:28:            color: '#fafafa',
frontend/src/app/opengraph-image.tsx:38:            color: '#a1a1aa',
frontend/src/app/opengraph-image.tsx:51:            color: '#71717a',
frontend/src/app/globals.css:48:  --background: #ffffff;
frontend/src/app/globals.css:49:  --page-background: #f6f8fc;
frontend/src/app/globals.css:50:  --foreground: #09090b;
frontend/src/app/globals.css:51:  --border: #e4e4e7;
frontend/src/app/globals.css:54:  --surface-1: #ffffff;
frontend/src/app/globals.css:55:  --surface-2: #f4f4f5;
frontend/src/app/globals.css:56:  --surface-3: #e4e4e7;
frontend/src/app/globals.css:58:  --highlight-base: rgba(183, 121, 31, 0.10);
frontend/src/app/globals.css:59:  --highlight-strong: rgba(245, 158, 11, 0.22);
frontend/src/app/globals.css:60:  --highlight-line: rgba(183, 121, 31, 0.74);
frontend/src/app/globals.css:61:  --highlight-glow: rgba(245, 158, 11, 0.22);
frontend/src/app/globals.css:64:  --accent: #1D4ED8;
frontend/src/app/globals.css:65:  --accent-hover: #1E40AF;
frontend/src/app/globals.css:66:  --accent-light: #DBEAFE;
frontend/src/app/globals.css:67:  --accent-foreground: #ffffff;
frontend/src/app/globals.css:68:  --workbench-bg: #f6f8fc;
frontend/src/app/globals.css:69:  --workbench-canvas: #eef3fb;
frontend/src/app/globals.css:70:  --workbench-panel: rgba(255, 255, 255, 0.76);
frontend/src/app/globals.css:71:  --workbench-panel-solid: #ffffff;
frontend/src/app/globals.css:72:  --workbench-panel-strong: rgba(255, 255, 255, 0.94);
frontend/src/app/globals.css:73:  --workbench-border: #e4e4e7;
frontend/src/app/globals.css:74:  --workbench-border-strong: rgba(67, 91, 126, 0.34);
frontend/src/app/globals.css:75:  --workbench-grid: rgba(43, 69, 104, 0.14);
frontend/src/app/globals.css:76:  --workbench-ink: #111827;
frontend/src/app/globals.css:77:  --workbench-muted: #64748b;
frontend/src/app/globals.css:78:  --workbench-glow-cyan: rgba(14, 165, 233, 0.16);
frontend/src/app/globals.css:79:  --workbench-command: rgba(255, 255, 255, 0.88);
frontend/src/app/globals.css:80:  --workbench-command-shadow: 0 22px 70px rgba(31, 55, 88, 0.16);
frontend/src/app/globals.css:81:  --reader-bg: #f4f1ea;
frontend/src/app/globals.css:82:  --reader-panel: rgba(255, 255, 255, 0.9);
frontend/src/app/globals.css:83:  --reader-panel-solid: #ffffff;
frontend/src/app/globals.css:84:  --reader-panel-muted: #faf8f3;
frontend/src/app/globals.css:85:  --reader-border: #ded8ce;
frontend/src/app/globals.css:86:  --reader-border-strong: #cfc6b8;
frontend/src/app/globals.css:87:  --reader-ink: #1f2933;
frontend/src/app/globals.css:88:  --reader-muted: #716b63;
frontend/src/app/globals.css:89:  --reader-evidence: #b7791f;
frontend/src/app/globals.css:90:  --reader-evidence-soft: #fff4d6;
frontend/src/app/globals.css:91:  --reader-evidence-border: #f3d38c;
frontend/src/app/globals.css:95:  --background: #09090b;
frontend/src/app/globals.css:96:  --page-background: #070707;
frontend/src/app/globals.css:97:  --foreground: #fafafa;
frontend/src/app/globals.css:98:  --border: rgba(255, 255, 255, 0.14);
frontend/src/app/globals.css:102:  --surface-1: #18181b;
frontend/src/app/globals.css:103:  --surface-2: #27272a;
frontend/src/app/globals.css:104:  --surface-3: #3f3f46;
frontend/src/app/globals.css:106:  --highlight-base: rgba(241, 184, 75, 0.14);
frontend/src/app/globals.css:107:  --highlight-strong: rgba(241, 184, 75, 0.26);
frontend/src/app/globals.css:108:  --highlight-line: rgba(241, 184, 75, 0.78);
frontend/src/app/globals.css:109:  --highlight-glow: rgba(241, 184, 75, 0.28);
frontend/src/app/globals.css:110:  /* Accent — blue (dark). blue-400 (#60A5FA) reads well on the
frontend/src/app/globals.css:111:     near-black canvas; blue-300 (#93C5FD) for hover. */
frontend/src/app/globals.css:112:  --accent: #60A5FA;
frontend/src/app/globals.css:113:  --accent-hover: #93C5FD;
frontend/src/app/globals.css:114:  --accent-light: rgba(96, 165, 250, 0.12);
frontend/src/app/globals.css:115:  --accent-foreground: #0b1726;
frontend/src/app/globals.css:116:  --workbench-bg: #070707;
frontend/src/app/globals.css:117:  --workbench-canvas: #111214;
frontend/src/app/globals.css:118:  --workbench-panel: rgba(23, 24, 27, 0.74);
frontend/src/app/globals.css:119:  --workbench-panel-solid: #17181b;
frontend/src/app/globals.css:120:  --workbench-panel-strong: rgba(25, 26, 30, 0.92);
frontend/src/app/globals.css:121:  --workbench-border: rgba(255, 255, 255, 0.14);
frontend/src/app/globals.css:122:  --workbench-border-strong: rgba(255, 255, 255, 0.26);
frontend/src/app/globals.css:123:  --workbench-grid: rgba(255, 255, 255, 0.16);
frontend/src/app/globals.css:124:  --workbench-ink: #f7f7f8;
frontend/src/app/globals.css:125:  --workbench-muted: #b8bbc6;
frontend/src/app/globals.css:126:  --workbench-glow-cyan: rgba(73, 186, 255, 0.28);
frontend/src/app/globals.css:127:  --workbench-command: rgba(23, 24, 27, 0.86);
frontend/src/app/globals.css:128:  --workbench-command-shadow: 0 30px 90px rgba(0, 0, 0, 0.46);
frontend/src/app/globals.css:129:  --reader-bg: #151410;
frontend/src/app/globals.css:130:  --reader-panel: rgba(28, 27, 24, 0.92);
frontend/src/app/globals.css:131:  --reader-panel-solid: #1f1e1a;
frontend/src/app/globals.css:132:  --reader-panel-muted: #25231f;
frontend/src/app/globals.css:133:  --reader-border: #3c3830;
frontend/src/app/globals.css:134:  --reader-border-strong: #575044;
frontend/src/app/globals.css:135:  --reader-ink: #f3eee4;
frontend/src/app/globals.css:136:  --reader-muted: #aaa399;
frontend/src/app/globals.css:137:  --reader-evidence: #f1b84b;
frontend/src/app/globals.css:138:  --reader-evidence-soft: rgba(241, 184, 75, 0.14);
frontend/src/app/globals.css:139:  --reader-evidence-border: rgba(241, 184, 75, 0.34);
frontend/src/app/globals.css:142:/* Designed-for-dark: scope the weight-shift to prose/headings only.
frontend/src/app/globals.css:148:.dark .prose strong,
frontend/src/app/globals.css:149:.dark .prose b {
frontend/src/app/globals.css:160:  background: #fafafa;
frontend/src/app/globals.css:165:  background: #09090b;
frontend/src/app/globals.css:175:/* Chat prose: tighten paragraph spacing vs. default prose */
frontend/src/app/globals.css:176:.prose p {
frontend/src/app/globals.css:180:.prose ul, .prose ol {
frontend/src/app/globals.css:184:.prose li {
frontend/src/app/globals.css:247:  transform: translateY(-50%);
frontend/src/app/globals.css:298:  from { transform: translateY(100%); }
frontend/src/app/globals.css:299:  to { transform: translateY(0); }
frontend/src/app/globals.css:304:  background-color: rgba(250, 204, 21, 0.4);
frontend/src/app/globals.css:312:  --driverjs-bg: #ffffff;
frontend/src/app/globals.css:313:  --driverjs-color: #18181b;
frontend/src/app/globals.css:314:  border: 1px solid #e4e4e7;
frontend/src/app/globals.css:316:  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
frontend/src/app/globals.css:320:  --driverjs-bg: #18181b;
frontend/src/app/globals.css:321:  --driverjs-color: #fafafa;
frontend/src/app/globals.css:322:  border-color: #3f3f46;
frontend/src/app/globals.css:326:  color: #71717a;
frontend/src/app/globals.css:353:  border: 1px solid #e4e4e7;
frontend/src/app/globals.css:354:  background: #ffffff;
frontend/src/app/globals.css:355:  box-shadow: 0 1px 2px rgba(24, 24, 27, 0.05);
frontend/src/app/globals.css:359:  border-color: #27272a;
frontend/src/app/globals.css:360:  background: #18181b;
frontend/src/app/globals.css:361:  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
frontend/src/app/globals.css:369:  border-color: #e4e4e7;
frontend/src/app/globals.css:370:  background: #ffffff;
frontend/src/app/globals.css:371:  box-shadow: 0 1px 2px rgba(24, 24, 27, 0.05);
frontend/src/app/globals.css:375:  border-color: #27272a;
frontend/src/app/globals.css:376:  background: #09090b;
frontend/src/app/globals.css:377:  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
frontend/src/app/globals.css:382:  border: 1px solid #e4e4e7;
frontend/src/app/globals.css:383:  background: #ffffff;
frontend/src/app/globals.css:388:  border-color: #27272a;
frontend/src/app/globals.css:389:  background: #27272a;
frontend/src/app/globals.css:394:  border: 1px solid #e4e4e7;
frontend/src/app/globals.css:395:  background: #ffffff;
frontend/src/app/globals.css:397:  box-shadow: 0 1px 2px rgba(24, 24, 27, 0.05);
frontend/src/app/globals.css:402:  border-color: #d4d4d8;
frontend/src/app/globals.css:403:  transform: translateY(-1px);
frontend/src/app/globals.css:404:  background: #fafafa;
frontend/src/app/globals.css:408:  border-color: #27272a;
frontend/src/app/globals.css:409:  background: #18181b;
frontend/src/app/globals.css:410:  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
frontend/src/app/globals.css:414:  border-color: #3f3f46;
frontend/src/app/globals.css:415:  background: #27272a;
frontend/src/app/globals.css:420:  border: 1px solid #d4d4d8;
frontend/src/app/globals.css:421:  background: #ffffff;
frontend/src/app/globals.css:422:  box-shadow: 0 8px 24px -10px rgba(24, 24, 27, 0.12);
frontend/src/app/globals.css:426:  border-color: #3f3f46;
frontend/src/app/globals.css:427:  background: #18181b;
frontend/src/app/globals.css:428:  box-shadow: 0 8px 24px -10px rgba(0, 0, 0, 0.5);
frontend/src/app/globals.css:440:  background: #ffffff;
frontend/src/app/globals.css:441:  border-color: #e4e4e7;
frontend/src/app/globals.css:442:  box-shadow: 0 8px 24px -10px rgba(24, 24, 27, 0.12);
frontend/src/app/globals.css:446:  background: #18181b;
frontend/src/app/globals.css:447:  border-color: #27272a;
frontend/src/app/globals.css:448:  box-shadow: 0 8px 24px -10px rgba(0, 0, 0, 0.5);
frontend/src/app/globals.css:474:  box-shadow: 4px 0 0 color-mix(in srgb, var(--reader-border-strong) 52%, transparent);
frontend/src/app/globals.css:494:  border: 1px solid #e4e4e7;
frontend/src/app/globals.css:495:  background: #ffffff;
frontend/src/app/globals.css:496:  box-shadow: 0 8px 24px -10px rgba(24, 24, 27, 0.12);
frontend/src/app/globals.css:500:  border-color: #27272a;
frontend/src/app/globals.css:501:  background: #18181b;
frontend/src/app/globals.css:502:  box-shadow: 0 8px 24px -10px rgba(0, 0, 0, 0.5);
frontend/src/app/globals.css:507:  border: 1px solid #e4e4e7;
frontend/src/app/globals.css:508:  background: #ffffff;
frontend/src/app/globals.css:514:  border-color: #d4d4d8;
frontend/src/app/globals.css:515:  background: #fafafa;
frontend/src/app/globals.css:516:  transform: translateY(-1px);
frontend/src/app/globals.css:520:  border-color: #27272a;
frontend/src/app/globals.css:521:  background: #18181b;
frontend/src/app/globals.css:525:  border-color: #3f3f46;
frontend/src/app/globals.css:526:  background: #27272a;
frontend/src/app/globals.css:532:  border: 1px solid #e4e4e7;
frontend/src/app/globals.css:534:  background: #ffffff;
frontend/src/app/globals.css:535:  box-shadow: 0 1px 2px rgba(24, 24, 27, 0.05);
frontend/src/app/globals.css:547:  background: #1D4ED8;
frontend/src/app/globals.css:552:  border-color: #27272a;
frontend/src/app/globals.css:553:  background: #18181b;
frontend/src/app/globals.css:554:  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
frontend/src/app/globals.css:559:  border: 1px solid #e4e4e7;
frontend/src/app/globals.css:560:  background: #ffffff;
frontend/src/app/globals.css:562:  box-shadow: 0 1px 2px rgba(24, 24, 27, 0.05);
frontend/src/app/globals.css:566:  border-color: #27272a;
frontend/src/app/globals.css:567:  background: #18181b;
frontend/src/app/globals.css:568:  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
frontend/src/app/globals.css:573:  border: 1px solid #e4e4e7;
frontend/src/app/globals.css:575:  background: #ffffff;
frontend/src/app/globals.css:580:  border-color: #27272a;
frontend/src/app/globals.css:581:  background: #18181b;
frontend/src/app/globals.css:585:  color: #1D4ED8;
frontend/src/app/globals.css:590:  color: rgba(147, 197, 253, 0.82);
frontend/src/app/globals.css:595:  border: 1px solid #e4e4e7;
frontend/src/app/globals.css:596:  background: #f4f4f5;
frontend/src/app/globals.css:602:  border-color: rgba(29, 78, 216, 0.32);
frontend/src/app/globals.css:603:  background: #ffffff;
frontend/src/app/globals.css:604:  transform: translateY(-1px);
frontend/src/app/globals.css:608:  border-color: #27272a;
frontend/src/app/globals.css:609:  background: #27272a;
frontend/src/app/globals.css:613:  border-color: rgba(96, 165, 250, 0.5);
frontend/src/app/globals.css:614:  background: #3f3f46;
frontend/src/app/globals.css:618:  background: #111827;
frontend/src/app/globals.css:619:  color: #ffffff;
frontend/src/app/globals.css:623:  background: #f7f7f8;
frontend/src/app/globals.css:624:  color: #141416;
frontend/src/app/globals.css:629:  border: 1px solid #e4e4e7;
frontend/src/app/globals.css:630:  background: #ffffff;
frontend/src/app/globals.css:632:  box-shadow: 0 1px 2px rgba(24, 24, 27, 0.05);
frontend/src/app/globals.css:637:  border-color: rgba(29, 78, 216, 0.3);
frontend/src/app/globals.css:638:  box-shadow: 0 8px 24px -10px rgba(24, 24, 27, 0.12);
frontend/src/app/globals.css:639:  transform: translateY(-1px);
frontend/src/app/globals.css:643:  border-color: #27272a;
frontend/src/app/globals.css:644:  background: #18181b;
frontend/src/app/globals.css:645:  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
frontend/src/app/globals.css:649:  border-color: rgba(96, 165, 250, 0.46);
frontend/src/app/globals.css:650:  box-shadow: 0 8px 24px -10px rgba(0, 0, 0, 0.5);
frontend/src/app/globals.css:657:    linear-gradient(180deg, transparent, rgba(246, 248, 252, 0.96));
frontend/src/app/globals.css:662:    linear-gradient(180deg, transparent, rgba(7, 7, 8, 0.94));
frontend/src/app/globals.css:667:  border: 1px solid #d4d4d8;
frontend/src/app/globals.css:668:  background: #ffffff;
frontend/src/app/globals.css:669:  box-shadow: 0 1px 2px rgba(24, 24, 27, 0.05);
frontend/src/app/globals.css:673:  border-color: #1D4ED8;
frontend/src/app/globals.css:674:  box-shadow: 0 0 0 2px rgba(29, 78, 216, 0.4);
frontend/src/app/globals.css:678:  border-color: #3f3f46;
frontend/src/app/globals.css:679:  background: #18181b;
frontend/src/app/globals.css:680:  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
frontend/src/app/globals.css:684:  border-color: #60A5FA;
frontend/src/app/globals.css:685:  box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.4);
frontend/src/app/globals.css:690:  border-bottom: 1px solid #e4e4e7;
frontend/src/app/globals.css:691:  background: #ffffff;
frontend/src/app/globals.css:695:  border-bottom-color: #27272a;
frontend/src/app/globals.css:696:  background: #09090b;
frontend/src/app/globals.css:702:    linear-gradient(180deg, rgba(255, 255, 255, 0.5), transparent 8rem),
frontend/src/app/globals.css:720:.dt-admin-panel,
frontend/src/app/globals.css:722:  border-color: #e4e4e7;
frontend/src/app/globals.css:723:  background: #ffffff;
frontend/src/app/globals.css:724:  box-shadow: 0 1px 2px rgba(24, 24, 27, 0.05);
frontend/src/app/globals.css:727:.dark .dt-admin-panel,
frontend/src/app/globals.css:729:  border-color: #27272a;
frontend/src/app/globals.css:730:  background: #18181b;
frontend/src/app/globals.css:731:  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
frontend/src/app/globals.css:734:.dt-admin-panel {
frontend/src/app/globals.css:740:  border: 1px solid #e4e4e7;
frontend/src/app/globals.css:741:  background: #ffffff;
frontend/src/app/globals.css:742:  box-shadow: 0 1px 2px rgba(24, 24, 27, 0.05);
frontend/src/app/globals.css:746:  border-color: #27272a;
frontend/src/app/globals.css:747:  background: #18181b;
frontend/src/app/globals.css:748:  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
frontend/src/app/globals.css:770:  background: #2563eb;
frontend/src/app/globals.css:771:  color: #ffffff;
frontend/src/app/globals.css:772:  box-shadow: 0 1px 2px rgba(24, 24, 27, 0.05);
frontend/src/app/globals.css:776:  background: #1d4ed8;
frontend/src/app/globals.css:777:  color: #ffffff;
frontend/src/app/globals.css:781:  background: #3b82f6;
frontend/src/app/globals.css:782:  color: #ffffff;
frontend/src/app/globals.css:783:  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
frontend/src/app/globals.css:787:  background: #2563eb;
frontend/src/app/globals.css:788:  color: #ffffff;
frontend/src/app/globals.css:793:  border: 1px solid #e4e4e7;
frontend/src/app/globals.css:794:  background: #ffffff;
frontend/src/app/globals.css:795:  box-shadow: 0 1px 2px rgba(24, 24, 27, 0.05);
frontend/src/app/globals.css:799:  border-color: #27272a;
frontend/src/app/globals.css:800:  background: #18181b;
frontend/src/app/globals.css:801:  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
frontend/src/components/landing/SocialProof.tsx:84:                  (idx > 0 ? ' md:pl-6 md:border-l md:border-[var(--ed-rule)]' : '')
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:274:              <p className="font-mono text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:307:              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:431:                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:458:                      <CheckCircle2 size={16} className="text-emerald-600" aria-hidden="true" />
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:462:                      <Clock3 size={16} className="text-amber-600" aria-hidden="true" />
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:570:                          className="inline-flex min-h-6 items-center rounded bg-amber-50 px-1.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-200 dark:ring-amber-900"
frontend/src/components/landing/ProductShowcase.tsx:36:  const translateY = interpolate(progress, [0, 1], [30, 0], {
frontend/src/components/landing/ProductShowcase.tsx:49:        transform: `translateY(${translateY}px)`,
frontend/src/components/landing/ProductShowcase.tsx:95:              transform: `translateY(${bounce}px)`,
frontend/src/components/landing/ProductShowcase.tsx:136:            color: isDark ? "#a1a1aa" : "#71717a",
frontend/src/components/landing/ProductShowcase.tsx:199:        const translateY = interpolate(progress, [0, 1], [20, 0], {
frontend/src/components/landing/ProductShowcase.tsx:213:              transform: `translateY(${translateY}px)`,
frontend/src/components/landing/ProductShowcase.tsx:280:            background: "#22c55e",
frontend/src/components/landing/ProductShowcase.tsx:459:            background: isDark ? "#1c1c1e" : "#ffffff",
frontend/src/components/landing/ProductShowcase.tsx:465:              ? "0 1px 3px rgba(0,0,0,0.4)"
frontend/src/components/landing/ProductShowcase.tsx:466:              : "0 1px 3px rgba(0,0,0,0.1)",
frontend/src/components/landing/ScrollReveal.tsx:41:  const translate = {
frontend/src/components/landing/ScrollReveal.tsx:42:    up: 'translate-y-6',
frontend/src/components/landing/ScrollReveal.tsx:43:    down: '-translate-y-6',
frontend/src/components/landing/ScrollReveal.tsx:44:    left: 'translate-x-6',
frontend/src/components/landing/ScrollReveal.tsx:45:    right: '-translate-x-6',
frontend/src/components/landing/ScrollReveal.tsx:53:          ? 'opacity-100 translate-y-0 translate-x-0'
frontend/src/components/landing/ScrollReveal.tsx:54:          : `opacity-0 ${translate[direction]}`
frontend/src/components/landing/HeroCollage.tsx:59:        {/* ── Signal shape — soft terracotta accent, low opacity ── */}
frontend/src/components/landing/HeroCollage.tsx:119:              "0 4px 18px 0 rgba(28,27,25,0.10), 0 1px 3px 0 rgba(28,27,25,0.07)",
frontend/src/components/landing/HeroCollage.tsx:208:                transform: "translateY(-50%)",
frontend/src/components/landing/HeroCollage.tsx:223:                  color: "#fff",
frontend/src/components/landing/HeroCollage.tsx:285:                  color: "#fff",
frontend/src/app/privacy/PrivacyPageClient.tsx:8:import EdProse from '../../components/marketing/EdProse';
frontend/src/app/privacy/PrivacyPageClient.tsx:54:        <EdProse>
frontend/src/app/privacy/PrivacyPageClient.tsx:56:        </EdProse>
frontend/src/app/privacy/PrivacyPageClient.tsx:60:        <EdProse>
frontend/src/app/privacy/PrivacyPageClient.tsx:66:        </EdProse>
frontend/src/app/privacy/PrivacyPageClient.tsx:70:        <EdProse>
frontend/src/app/privacy/PrivacyPageClient.tsx:72:        </EdProse>
frontend/src/app/privacy/PrivacyPageClient.tsx:76:        <EdProse>
frontend/src/app/privacy/PrivacyPageClient.tsx:78:        </EdProse>
frontend/src/app/privacy/PrivacyPageClient.tsx:82:        <EdProse>
frontend/src/app/privacy/PrivacyPageClient.tsx:84:        </EdProse>
frontend/src/app/privacy/PrivacyPageClient.tsx:88:        <EdProse>
frontend/src/app/privacy/PrivacyPageClient.tsx:90:        </EdProse>
frontend/src/components/marketing/EdLanguageSelector.tsx:13: * tokens (`--ed-*`, IBM Plex Mono labels, terracotta signal) so it belongs in
frontend/src/components/marketing/EdLanguageSelector.tsx:87:        boxShadow: "0 14px 36px rgba(40, 33, 24, 0.20)",
frontend/src/components/marketing/EdProse.tsx:1:interface EdProseProps {
frontend/src/components/marketing/EdProse.tsx:6:export default function EdProse({ children, className }: EdProseProps) {
frontend/src/components/marketing/EdProse.tsx:8:    <div className={`ed-prose${className ? ` ${className}` : ""}`}>
frontend/src/app/imprint/ImprintPageClient.tsx:9:import EdProse from '../../components/marketing/EdProse';
frontend/src/app/imprint/ImprintPageClient.tsx:82:        <EdProse>
frontend/src/app/imprint/ImprintPageClient.tsx:94:        </EdProse>
frontend/src/app/imprint/ImprintPageClient.tsx:98:        <EdProse>
frontend/src/app/imprint/ImprintPageClient.tsx:106:        </EdProse>
frontend/src/app/imprint/ImprintPageClient.tsx:116:        <EdProse>
frontend/src/app/imprint/ImprintPageClient.tsx:130:        </EdProse>
frontend/src/app/imprint/ImprintPageClient.tsx:138:        <EdProse>
frontend/src/app/imprint/ImprintPageClient.tsx:154:        </EdProse>
frontend/src/app/imprint/ImprintPageClient.tsx:164:        <EdProse>
frontend/src/app/imprint/ImprintPageClient.tsx:171:        </EdProse>
frontend/src/app/imprint/ImprintPageClient.tsx:179:        <EdProse>
frontend/src/app/imprint/ImprintPageClient.tsx:186:        </EdProse>
frontend/src/app/HomePageClient.tsx:11: * (warm-paper terracotta) and the authenticated dashboard (zinc+blue
frontend/src/components/design/SectionKicker.tsx:23:        'flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400',
frontend/src/app/auth/page.tsx:25:      <div className="w-full max-w-[440px] rounded-lg border border-zinc-200 bg-white p-7 shadow-[0_1px_3px_0_rgba(0,0,0,0.05),0_1px_2px_0_rgba(0,0,0,0.03)] sm:p-8 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[0_1px_3px_0_rgba(0,0,0,0.4)]">
frontend/src/app/auth/page.tsx:33:          <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
frontend/src/app/demo/error.tsx:15:    <div className="min-h-screen bg-[var(--page-background)] flex items-center justify-center p-6">
frontend/src/app/tools/word-counter/WordCounterClient.tsx:10:import EdProse from '../../../components/marketing/EdProse';
frontend/src/app/tools/word-counter/WordCounterClient.tsx:336:        <EdProse>
frontend/src/app/tools/word-counter/WordCounterClient.tsx:349:        </EdProse>
frontend/src/app/contact/ContactPageClient.tsx:214:            <div className="ed-prose" style={{ marginTop: '16px' }}>
frontend/src/app/contact/ContactPageClient.tsx:225:            <div className="ed-prose" style={{ marginTop: '16px' }}>
frontend/src/app/use-cases/finance/FinanceClient.tsx:15:import EdProse from '../../../components/marketing/EdProse';
frontend/src/app/use-cases/finance/FinanceClient.tsx:64:        <EdProse>
frontend/src/app/use-cases/finance/FinanceClient.tsx:75:        </EdProse>
frontend/src/app/use-cases/finance/FinanceClient.tsx:104:              <EdProse className="mt-3">
frontend/src/app/use-cases/finance/FinanceClient.tsx:107:              </EdProse>
frontend/src/app/use-cases/finance/FinanceClient.tsx:114:        <EdProse>
frontend/src/app/use-cases/finance/FinanceClient.tsx:122:        </EdProse>
frontend/src/app/use-cases/finance/FinanceClient.tsx:126:        <EdProse>
frontend/src/app/use-cases/finance/FinanceClient.tsx:130:        </EdProse>
frontend/src/app/tools/reading-time/ReadingTimeClient.tsx:21:import EdProse from '../../../components/marketing/EdProse';
frontend/src/app/tools/reading-time/ReadingTimeClient.tsx:382:        <EdProse>
frontend/src/app/tools/reading-time/ReadingTimeClient.tsx:397:        </EdProse>
frontend/src/app/use-cases/hr-contracts/HrContractsClient.tsx:19:import EdProse from '../../../components/marketing/EdProse';
frontend/src/app/use-cases/hr-contracts/HrContractsClient.tsx:100:        <EdProse>
frontend/src/app/use-cases/hr-contracts/HrContractsClient.tsx:111:        </EdProse>
frontend/src/app/use-cases/hr-contracts/HrContractsClient.tsx:132:          <EdProse className="mt-3">
frontend/src/app/use-cases/hr-contracts/HrContractsClient.tsx:134:          </EdProse>
frontend/src/app/use-cases/hr-contracts/HrContractsClient.tsx:139:          <EdProse className="mt-3">
frontend/src/app/use-cases/hr-contracts/HrContractsClient.tsx:147:          </EdProse>
frontend/src/app/use-cases/hr-contracts/HrContractsClient.tsx:152:          <EdProse className="mt-3">
frontend/src/app/use-cases/hr-contracts/HrContractsClient.tsx:154:          </EdProse>
frontend/src/app/use-cases/hr-contracts/HrContractsClient.tsx:159:          <EdProse className="mt-3">
frontend/src/app/use-cases/hr-contracts/HrContractsClient.tsx:161:          </EdProse>
frontend/src/app/use-cases/compliance/ComplianceClient.tsx:24:import EdProse from '../../../components/marketing/EdProse';
frontend/src/app/use-cases/compliance/ComplianceClient.tsx:146:        <EdProse>
frontend/src/app/use-cases/compliance/ComplianceClient.tsx:161:        </EdProse>
frontend/src/app/use-cases/compliance/ComplianceClient.tsx:188:            <EdProse className="mt-3">
frontend/src/app/use-cases/compliance/ComplianceClient.tsx:190:            </EdProse>
frontend/src/app/use-cases/healthcare/HealthcareClient.tsx:22:import EdProse from '../../../components/marketing/EdProse';
frontend/src/app/use-cases/healthcare/HealthcareClient.tsx:122:        <EdProse>
frontend/src/app/use-cases/healthcare/HealthcareClient.tsx:124:        </EdProse>
frontend/src/app/use-cases/healthcare/HealthcareClient.tsx:128:        <EdProse>
frontend/src/app/use-cases/healthcare/HealthcareClient.tsx:137:        </EdProse>
frontend/src/app/use-cases/healthcare/HealthcareClient.tsx:171:        <EdProse>
frontend/src/app/use-cases/healthcare/HealthcareClient.tsx:186:        </EdProse>
frontend/src/app/use-cases/healthcare/HealthcareClient.tsx:190:        <EdProse>
frontend/src/app/use-cases/healthcare/HealthcareClient.tsx:193:        </EdProse>
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:201:            ? 'border-amber-300/40 bg-amber-50 text-amber-950 dark:border-amber-300/25 dark:bg-amber-300/10 dark:text-amber-100'
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:309:              <div className="flex border-t border-[var(--reader-border)] bg-[var(--reader-panel-solid)] shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
frontend/src/app/use-cases/real-estate/RealEstateClient.tsx:23:import EdProse from '../../../components/marketing/EdProse';
frontend/src/app/use-cases/real-estate/RealEstateClient.tsx:145:        <EdProse>
frontend/src/app/use-cases/real-estate/RealEstateClient.tsx:160:        </EdProse>
frontend/src/app/use-cases/consultants/ConsultantsClient.tsx:23:import EdProse from '../../../components/marketing/EdProse';
frontend/src/app/use-cases/consultants/ConsultantsClient.tsx:130:        <EdProse>
frontend/src/app/use-cases/consultants/ConsultantsClient.tsx:139:        </EdProse>
frontend/src/app/error.tsx:15:    <div className="min-h-screen bg-[var(--page-background)] flex items-center justify-center p-6">
frontend/src/app/layout.tsx:82:        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
frontend/src/app/layout.tsx:83:        <meta name="theme-color" content="#09090b" media="(prefers-color-scheme: dark)" />
frontend/src/app/use-cases/students/StudentsClient.tsx:19:import EdProse from '../../../components/marketing/EdProse';
frontend/src/app/use-cases/students/StudentsClient.tsx:123:        <EdProse>
frontend/src/app/use-cases/students/StudentsClient.tsx:131:        </EdProse>
frontend/src/app/use-cases/students/StudentsClient.tsx:160:              <EdProse className="mt-3">
frontend/src/app/use-cases/students/StudentsClient.tsx:163:              </EdProse>
frontend/src/app/use-cases/students/StudentsClient.tsx:170:        <EdProse>
frontend/src/app/use-cases/students/StudentsClient.tsx:179:        </EdProse>
frontend/src/app/use-cases/students/StudentsClient.tsx:183:        <EdProse>
frontend/src/app/use-cases/students/StudentsClient.tsx:191:        </EdProse>
frontend/src/app/use-cases/lawyers/LawyersClient.tsx:22:import EdProse from '../../../components/marketing/EdProse';
frontend/src/app/use-cases/lawyers/LawyersClient.tsx:89:        <EdProse>
frontend/src/app/use-cases/lawyers/LawyersClient.tsx:100:        </EdProse>
frontend/src/app/use-cases/lawyers/LawyersClient.tsx:129:              <EdProse className="mt-3">
frontend/src/app/use-cases/lawyers/LawyersClient.tsx:132:              </EdProse>
frontend/src/app/use-cases/lawyers/LawyersClient.tsx:139:        <EdProse>
frontend/src/app/use-cases/lawyers/LawyersClient.tsx:148:        </EdProse>
frontend/src/app/terms/TermsPageClient.tsx:8:import EdProse from '../../components/marketing/EdProse';
frontend/src/app/terms/TermsPageClient.tsx:53:          <EdProse>
frontend/src/app/terms/TermsPageClient.tsx:55:          </EdProse>
frontend/src/app/compare/humata/HumataClient.tsx:9:import EdProse from '../../../components/marketing/EdProse';
frontend/src/app/compare/humata/HumataClient.tsx:69:        <EdProse>
frontend/src/app/compare/humata/HumataClient.tsx:71:        </EdProse>
frontend/src/app/compare/humata/HumataClient.tsx:75:        <EdProse>
frontend/src/app/compare/humata/HumataClient.tsx:81:        </EdProse>
frontend/src/app/compare/humata/HumataClient.tsx:86:        <EdProse className="mt-3">
frontend/src/app/compare/humata/HumataClient.tsx:94:        </EdProse>
frontend/src/app/compare/humata/HumataClient.tsx:97:        <EdProse className="mt-3">
frontend/src/app/compare/humata/HumataClient.tsx:105:        </EdProse>
frontend/src/app/compare/humata/HumataClient.tsx:108:        <EdProse className="mt-3">
frontend/src/app/compare/humata/HumataClient.tsx:116:        </EdProse>
frontend/src/app/compare/humata/HumataClient.tsx:119:        <EdProse className="mt-3">
frontend/src/app/compare/humata/HumataClient.tsx:129:        </EdProse>
frontend/src/app/compare/humata/HumataClient.tsx:132:        <EdProse className="mt-3">
frontend/src/app/compare/humata/HumataClient.tsx:135:        </EdProse>
frontend/src/app/compare/humata/HumataClient.tsx:138:        <EdProse className="mt-3">
frontend/src/app/compare/humata/HumataClient.tsx:141:        </EdProse>
frontend/src/app/compare/humata/HumataClient.tsx:145:        <EdProse>
frontend/src/app/compare/humata/HumataClient.tsx:153:        </EdProse>
frontend/src/app/compare/humata/HumataClient.tsx:157:        <EdProse>
frontend/src/app/compare/humata/HumataClient.tsx:164:        </EdProse>
frontend/src/app/compare/humata/HumataClient.tsx:168:        <EdProse>
frontend/src/app/compare/humata/HumataClient.tsx:178:        </EdProse>
frontend/src/app/use-cases/teachers/TeachersClient.tsx:21:import EdProse from '../../../components/marketing/EdProse';
frontend/src/app/use-cases/teachers/TeachersClient.tsx:136:        <EdProse>
frontend/src/app/use-cases/teachers/TeachersClient.tsx:145:        </EdProse>
frontend/src/app/use-cases/teachers/TeachersClient.tsx:179:        <EdProse>
frontend/src/app/use-cases/teachers/TeachersClient.tsx:187:        </EdProse>
frontend/src/app/pricing/PricingPageClient.tsx:9:import EdProse from '../../components/marketing/EdProse';
frontend/src/app/pricing/PricingPageClient.tsx:333:        <EdProse>
frontend/src/app/pricing/PricingPageClient.tsx:360:        </EdProse>
frontend/src/app/compare/askyourpdf/AskyourpdfClient.tsx:9:import EdProse from '../../../components/marketing/EdProse';
frontend/src/app/compare/askyourpdf/AskyourpdfClient.tsx:69:        <EdProse>
frontend/src/app/compare/askyourpdf/AskyourpdfClient.tsx:74:        </EdProse>
frontend/src/app/compare/askyourpdf/AskyourpdfClient.tsx:78:        <EdProse>
frontend/src/app/compare/askyourpdf/AskyourpdfClient.tsx:83:        </EdProse>
frontend/src/app/compare/askyourpdf/AskyourpdfClient.tsx:88:        <EdProse className="mt-3">
frontend/src/app/compare/askyourpdf/AskyourpdfClient.tsx:97:        </EdProse>
frontend/src/app/compare/askyourpdf/AskyourpdfClient.tsx:100:        <EdProse className="mt-3">
frontend/src/app/compare/askyourpdf/AskyourpdfClient.tsx:108:        </EdProse>
frontend/src/app/compare/askyourpdf/AskyourpdfClient.tsx:111:        <EdProse className="mt-3">
frontend/src/app/compare/askyourpdf/AskyourpdfClient.tsx:114:        </EdProse>
frontend/src/app/compare/askyourpdf/AskyourpdfClient.tsx:117:        <EdProse className="mt-3">
frontend/src/app/compare/askyourpdf/AskyourpdfClient.tsx:127:        </EdProse>
frontend/src/app/compare/askyourpdf/AskyourpdfClient.tsx:130:        <EdProse className="mt-3">
frontend/src/app/compare/askyourpdf/AskyourpdfClient.tsx:133:        </EdProse>
frontend/src/app/compare/askyourpdf/AskyourpdfClient.tsx:136:        <EdProse className="mt-3">
frontend/src/app/compare/askyourpdf/AskyourpdfClient.tsx:139:        </EdProse>
frontend/src/app/compare/askyourpdf/AskyourpdfClient.tsx:143:        <EdProse>
frontend/src/app/compare/askyourpdf/AskyourpdfClient.tsx:151:        </EdProse>
frontend/src/app/compare/askyourpdf/AskyourpdfClient.tsx:155:        <EdProse>
frontend/src/app/compare/askyourpdf/AskyourpdfClient.tsx:162:        </EdProse>
frontend/src/app/compare/askyourpdf/AskyourpdfClient.tsx:166:        <EdProse>
frontend/src/app/compare/askyourpdf/AskyourpdfClient.tsx:180:        </EdProse>
frontend/src/app/compare/chatpdf/ChatpdfClient.tsx:9:import EdProse from '../../../components/marketing/EdProse';
frontend/src/app/compare/chatpdf/ChatpdfClient.tsx:73:        <EdProse>
frontend/src/app/compare/chatpdf/ChatpdfClient.tsx:78:        </EdProse>
frontend/src/app/compare/chatpdf/ChatpdfClient.tsx:82:        <EdProse>
frontend/src/app/compare/chatpdf/ChatpdfClient.tsx:87:        </EdProse>
frontend/src/app/compare/chatpdf/ChatpdfClient.tsx:92:        <EdProse className="mt-3">
frontend/src/app/compare/chatpdf/ChatpdfClient.tsx:101:        </EdProse>
frontend/src/app/compare/chatpdf/ChatpdfClient.tsx:104:        <EdProse className="mt-3">
frontend/src/app/compare/chatpdf/ChatpdfClient.tsx:112:        </EdProse>
frontend/src/app/compare/chatpdf/ChatpdfClient.tsx:115:        <EdProse className="mt-3">
frontend/src/app/compare/chatpdf/ChatpdfClient.tsx:124:        </EdProse>
frontend/src/app/compare/chatpdf/ChatpdfClient.tsx:127:        <EdProse className="mt-3">
frontend/src/app/compare/chatpdf/ChatpdfClient.tsx:137:        </EdProse>
frontend/src/app/compare/chatpdf/ChatpdfClient.tsx:140:        <EdProse className="mt-3">
frontend/src/app/compare/chatpdf/ChatpdfClient.tsx:143:        </EdProse>
frontend/src/app/compare/chatpdf/ChatpdfClient.tsx:146:        <EdProse className="mt-3">
frontend/src/app/compare/chatpdf/ChatpdfClient.tsx:149:        </EdProse>
frontend/src/app/compare/chatpdf/ChatpdfClient.tsx:153:        <EdProse>
frontend/src/app/compare/chatpdf/ChatpdfClient.tsx:161:        </EdProse>
frontend/src/app/compare/chatpdf/ChatpdfClient.tsx:165:        <EdProse>
frontend/src/app/compare/chatpdf/ChatpdfClient.tsx:172:        </EdProse>
frontend/src/app/compare/chatpdf/ChatpdfClient.tsx:176:        <EdProse>
frontend/src/app/compare/chatpdf/ChatpdfClient.tsx:186:        </EdProse>
frontend/src/app/editorial.css:4:  --ed-paper: #f3eee1;
frontend/src/app/editorial.css:5:  --ed-paper-2: #e9e1cf;
frontend/src/app/editorial.css:6:  --ed-ink: #1c1b19;
frontend/src/app/editorial.css:7:  --ed-ink-2: #48443b;
frontend/src/app/editorial.css:8:  --ed-ink-3: #6e6860;
frontend/src/app/editorial.css:9:  --ed-signal: #b0472f;
frontend/src/app/editorial.css:10:  --ed-signal-deep: #8f3a26;
frontend/src/app/editorial.css:11:  --ed-ochre: #c08a3e;
frontend/src/app/editorial.css:12:  --ed-rule: #d3c9b3;
frontend/src/app/editorial.css:130:  color: #ffffff;
frontend/src/app/editorial.css:172:  background-image: radial-gradient(#8b857a 1.1px, transparent 1.2px);
frontend/src/app/editorial.css:188:  background: #8b857a;
frontend/src/app/editorial.css:190:.dt-editorial .ed-crosshair::before { left: 50%; top: 0; width: 1px; height: 100%; transform: translateX(-50%); }
frontend/src/app/editorial.css:191:.dt-editorial .ed-crosshair::after { top: 50%; left: 0; height: 1px; width: 100%; transform: translateY(-50%); }
frontend/src/app/editorial.css:222:.dt-editorial .ed-prose { max-width: 660px; }
frontend/src/app/editorial.css:223:.dt-editorial .ed-prose p {
frontend/src/app/editorial.css:229:.dt-editorial .ed-prose p:last-child { margin-bottom: 0; }
frontend/src/app/editorial.css:230:.dt-editorial .ed-prose a {
frontend/src/app/editorial.css:246:/* Bulleted lists inside editorial prose. */
frontend/src/app/editorial.css:247:.dt-editorial .ed-prose ul {
frontend/src/app/editorial.css:252:.dt-editorial .ed-prose ul li {
frontend/src/app/editorial.css:260:.dt-editorial .ed-prose ul li::before {
frontend/src/app/editorial.css:269:.dt-editorial .ed-prose ul li:last-child { margin-bottom: 0; }
frontend/src/app/compare/pdf-ai/PdfaiClient.tsx:9:import EdProse from '../../../components/marketing/EdProse';
frontend/src/app/compare/pdf-ai/PdfaiClient.tsx:69:        <EdProse>
frontend/src/app/compare/pdf-ai/PdfaiClient.tsx:71:        </EdProse>
frontend/src/app/compare/pdf-ai/PdfaiClient.tsx:75:        <EdProse>
frontend/src/app/compare/pdf-ai/PdfaiClient.tsx:81:        </EdProse>
frontend/src/app/compare/pdf-ai/PdfaiClient.tsx:86:        <EdProse className="mt-3">
frontend/src/app/compare/pdf-ai/PdfaiClient.tsx:94:        </EdProse>
frontend/src/app/compare/pdf-ai/PdfaiClient.tsx:97:        <EdProse className="mt-3">
frontend/src/app/compare/pdf-ai/PdfaiClient.tsx:105:        </EdProse>
frontend/src/app/compare/pdf-ai/PdfaiClient.tsx:108:        <EdProse className="mt-3">
frontend/src/app/compare/pdf-ai/PdfaiClient.tsx:111:        </EdProse>
frontend/src/app/compare/pdf-ai/PdfaiClient.tsx:114:        <EdProse className="mt-3">
frontend/src/app/compare/pdf-ai/PdfaiClient.tsx:125:        </EdProse>
frontend/src/app/compare/pdf-ai/PdfaiClient.tsx:128:        <EdProse className="mt-3">
frontend/src/app/compare/pdf-ai/PdfaiClient.tsx:131:        </EdProse>
frontend/src/app/compare/pdf-ai/PdfaiClient.tsx:134:        <EdProse className="mt-3">
frontend/src/app/compare/pdf-ai/PdfaiClient.tsx:137:        </EdProse>
frontend/src/app/compare/pdf-ai/PdfaiClient.tsx:141:        <EdProse>
frontend/src/app/compare/pdf-ai/PdfaiClient.tsx:149:        </EdProse>
frontend/src/app/compare/pdf-ai/PdfaiClient.tsx:153:        <EdProse>
frontend/src/app/compare/pdf-ai/PdfaiClient.tsx:159:        </EdProse>
frontend/src/app/compare/pdf-ai/PdfaiClient.tsx:163:        <EdProse>
frontend/src/app/compare/pdf-ai/PdfaiClient.tsx:173:        </EdProse>
frontend/src/app/compare/notebooklm/NotebooklmClient.tsx:9:import EdProse from '../../../components/marketing/EdProse';
frontend/src/app/compare/notebooklm/NotebooklmClient.tsx:73:        <EdProse>
frontend/src/app/compare/notebooklm/NotebooklmClient.tsx:75:        </EdProse>
frontend/src/app/compare/notebooklm/NotebooklmClient.tsx:79:        <EdProse>
frontend/src/app/compare/notebooklm/NotebooklmClient.tsx:85:        </EdProse>
frontend/src/app/compare/notebooklm/NotebooklmClient.tsx:90:        <EdProse className="mt-3">
frontend/src/app/compare/notebooklm/NotebooklmClient.tsx:98:        </EdProse>
frontend/src/app/compare/notebooklm/NotebooklmClient.tsx:101:        <EdProse className="mt-3">
frontend/src/app/compare/notebooklm/NotebooklmClient.tsx:109:        </EdProse>
frontend/src/app/compare/notebooklm/NotebooklmClient.tsx:112:        <EdProse className="mt-3">
frontend/src/app/compare/notebooklm/NotebooklmClient.tsx:120:        </EdProse>
frontend/src/app/compare/notebooklm/NotebooklmClient.tsx:123:        <EdProse className="mt-3">
frontend/src/app/compare/notebooklm/NotebooklmClient.tsx:131:        </EdProse>
frontend/src/app/compare/notebooklm/NotebooklmClient.tsx:134:        <EdProse className="mt-3">
frontend/src/app/compare/notebooklm/NotebooklmClient.tsx:137:        </EdProse>
frontend/src/app/compare/notebooklm/NotebooklmClient.tsx:140:        <EdProse className="mt-3">
frontend/src/app/compare/notebooklm/NotebooklmClient.tsx:143:        </EdProse>
frontend/src/app/compare/notebooklm/NotebooklmClient.tsx:147:        <EdProse>
frontend/src/app/compare/notebooklm/NotebooklmClient.tsx:155:        </EdProse>
frontend/src/app/compare/notebooklm/NotebooklmClient.tsx:159:        <EdProse>
frontend/src/app/compare/notebooklm/NotebooklmClient.tsx:167:        </EdProse>
frontend/src/app/compare/notebooklm/NotebooklmClient.tsx:171:        <EdProse>
frontend/src/app/compare/notebooklm/NotebooklmClient.tsx:181:        </EdProse>
frontend/src/app/collections/CollectionsPageClient.tsx:131:                    <div className="mt-1 text-[11px] font-medium leading-4 text-zinc-500 dark:text-zinc-400">
frontend/src/app/features/citations/page.tsx:94:                text: 'Click a citation number and the document scrolls to the exact source text, highlighted in yellow so you can verify the claim.',
frontend/src/app/features/citations/page.tsx:122:                  text: 'Yes. Every numbered citation in an AI answer is clickable. Clicking it scrolls the document viewer to the exact source passage and highlights it in yellow so you can read the original text in context.',
frontend/src/app/manifest.ts:11:    background_color: '#fafaf7',
frontend/src/app/manifest.ts:12:    theme_color: '#18181b',
frontend/src/app/features/citations/CitationsClient.tsx:16:import EdProse from '../../../components/marketing/EdProse';
frontend/src/app/features/citations/CitationsClient.tsx:146:        <EdProse>
frontend/src/app/features/citations/CitationsClient.tsx:151:        </EdProse>
frontend/src/app/collections/[collectionId]/page.tsx:251:            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
frontend/src/app/collections/[collectionId]/page.tsx:536:                    ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100'
frontend/src/app/alternatives/pdf-ai/PdfAiAltsClient.tsx:9:import EdProse from '../../../components/marketing/EdProse';
frontend/src/app/alternatives/pdf-ai/PdfAiAltsClient.tsx:80:        <EdProse>
frontend/src/app/alternatives/pdf-ai/PdfAiAltsClient.tsx:88:        </EdProse>
frontend/src/app/alternatives/pdf-ai/PdfAiAltsClient.tsx:96:        <EdProse className="mt-3">
frontend/src/app/alternatives/pdf-ai/PdfAiAltsClient.tsx:104:        </EdProse>
frontend/src/app/alternatives/pdf-ai/PdfAiAltsClient.tsx:124:        <EdProse>
frontend/src/app/alternatives/pdf-ai/PdfAiAltsClient.tsx:130:        </EdProse>
frontend/src/app/alternatives/pdf-ai/PdfAiAltsClient.tsx:138:        <EdProse>
frontend/src/app/alternatives/pdf-ai/PdfAiAltsClient.tsx:144:        </EdProse>
frontend/src/app/alternatives/pdf-ai/PdfAiAltsClient.tsx:152:        <EdProse>
frontend/src/app/alternatives/pdf-ai/PdfAiAltsClient.tsx:158:        </EdProse>
frontend/src/app/alternatives/pdf-ai/PdfAiAltsClient.tsx:166:        <EdProse>
frontend/src/app/alternatives/pdf-ai/PdfAiAltsClient.tsx:172:        </EdProse>
frontend/src/app/alternatives/pdf-ai/PdfAiAltsClient.tsx:180:        <EdProse>
frontend/src/app/alternatives/pdf-ai/PdfAiAltsClient.tsx:183:        </EdProse>
frontend/src/app/alternatives/pdf-ai/PdfAiAltsClient.tsx:191:        <EdProse>
frontend/src/app/alternatives/pdf-ai/PdfAiAltsClient.tsx:194:        </EdProse>
frontend/src/app/features/free-demo/FreeDemoClient.tsx:14:import EdProse from '../../../components/marketing/EdProse';
frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsClient.tsx:9:import EdProse from '../../../components/marketing/EdProse';
frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsClient.tsx:80:        <EdProse>
frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsClient.tsx:88:        </EdProse>
frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsClient.tsx:96:        <EdProse className="mt-3">
frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsClient.tsx:104:        </EdProse>
frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsClient.tsx:124:        <EdProse>
frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsClient.tsx:130:        </EdProse>
frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsClient.tsx:138:        <EdProse>
frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsClient.tsx:144:        </EdProse>
frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsClient.tsx:152:        <EdProse>
frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsClient.tsx:158:        </EdProse>
frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsClient.tsx:166:        <EdProse>
frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsClient.tsx:172:        </EdProse>
frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsClient.tsx:180:        <EdProse>
frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsClient.tsx:183:        </EdProse>
frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsClient.tsx:191:        <EdProse>
frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsClient.tsx:194:        </EdProse>
frontend/src/app/alternatives/chatpdf/ChatpdfAltsClient.tsx:9:import EdProse from '../../../components/marketing/EdProse';
frontend/src/app/alternatives/chatpdf/ChatpdfAltsClient.tsx:84:        <EdProse className="mt-3">
frontend/src/app/alternatives/chatpdf/ChatpdfAltsClient.tsx:92:        </EdProse>
frontend/src/app/alternatives/chatpdf/ChatpdfAltsClient.tsx:112:        <EdProse>
frontend/src/app/alternatives/chatpdf/ChatpdfAltsClient.tsx:118:        </EdProse>
frontend/src/app/alternatives/chatpdf/ChatpdfAltsClient.tsx:126:        <EdProse>
frontend/src/app/alternatives/chatpdf/ChatpdfAltsClient.tsx:129:        </EdProse>
frontend/src/app/alternatives/chatpdf/ChatpdfAltsClient.tsx:137:        <EdProse>
frontend/src/app/alternatives/chatpdf/ChatpdfAltsClient.tsx:140:        </EdProse>
frontend/src/app/alternatives/chatpdf/ChatpdfAltsClient.tsx:148:        <EdProse>
frontend/src/app/alternatives/chatpdf/ChatpdfAltsClient.tsx:151:        </EdProse>
frontend/src/app/alternatives/chatpdf/ChatpdfAltsClient.tsx:159:        <EdProse>
frontend/src/app/alternatives/chatpdf/ChatpdfAltsClient.tsx:162:        </EdProse>
frontend/src/app/alternatives/chatpdf/ChatpdfAltsClient.tsx:170:        <EdProse>
frontend/src/app/alternatives/chatpdf/ChatpdfAltsClient.tsx:173:        </EdProse>
frontend/src/app/about/AboutPageClient.tsx:7:import EdProse from '../../components/marketing/EdProse';
frontend/src/app/about/AboutPageClient.tsx:54:        <EdProse>
frontend/src/app/about/AboutPageClient.tsx:57:        </EdProse>
frontend/src/app/about/AboutPageClient.tsx:78:        <EdProse>
frontend/src/app/about/AboutPageClient.tsx:95:        </EdProse>
frontend/src/app/alternatives/notebooklm/NotebooklmAltsClient.tsx:9:import EdProse from '../../../components/marketing/EdProse';
frontend/src/app/alternatives/notebooklm/NotebooklmAltsClient.tsx:70:        <EdProse className="mt-3">
frontend/src/app/alternatives/notebooklm/NotebooklmAltsClient.tsx:77:        </EdProse>
frontend/src/app/alternatives/notebooklm/NotebooklmAltsClient.tsx:97:        <EdProse>
frontend/src/app/alternatives/notebooklm/NotebooklmAltsClient.tsx:100:        </EdProse>
frontend/src/app/alternatives/notebooklm/NotebooklmAltsClient.tsx:108:        <EdProse>
frontend/src/app/alternatives/notebooklm/NotebooklmAltsClient.tsx:111:        </EdProse>
frontend/src/app/alternatives/notebooklm/NotebooklmAltsClient.tsx:119:        <EdProse>
frontend/src/app/alternatives/notebooklm/NotebooklmAltsClient.tsx:122:        </EdProse>
frontend/src/app/alternatives/notebooklm/NotebooklmAltsClient.tsx:130:        <EdProse>
frontend/src/app/alternatives/notebooklm/NotebooklmAltsClient.tsx:133:        </EdProse>
frontend/src/app/alternatives/notebooklm/NotebooklmAltsClient.tsx:141:        <EdProse>
frontend/src/app/alternatives/notebooklm/NotebooklmAltsClient.tsx:144:        </EdProse>
frontend/src/app/features/performance-modes/PerformanceModesClient.tsx:12:import EdProse from '../../../components/marketing/EdProse';
frontend/src/app/features/performance-modes/PerformanceModesClient.tsx:143:        <EdProse>
frontend/src/app/features/performance-modes/PerformanceModesClient.tsx:153:        </EdProse>
frontend/src/app/alternatives/humata/HumataAltsClient.tsx:9:import EdProse from '../../../components/marketing/EdProse';
frontend/src/app/alternatives/humata/HumataAltsClient.tsx:69:        <EdProse className="mt-3">
frontend/src/app/alternatives/humata/HumataAltsClient.tsx:76:        </EdProse>
frontend/src/app/alternatives/humata/HumataAltsClient.tsx:96:        <EdProse>
frontend/src/app/alternatives/humata/HumataAltsClient.tsx:99:        </EdProse>
frontend/src/app/alternatives/humata/HumataAltsClient.tsx:107:        <EdProse>
frontend/src/app/alternatives/humata/HumataAltsClient.tsx:110:        </EdProse>
frontend/src/app/alternatives/humata/HumataAltsClient.tsx:118:        <EdProse>
frontend/src/app/alternatives/humata/HumataAltsClient.tsx:121:        </EdProse>
frontend/src/app/alternatives/humata/HumataAltsClient.tsx:129:        <EdProse>
frontend/src/app/alternatives/humata/HumataAltsClient.tsx:132:        </EdProse>
frontend/src/app/blog/[slug]/BlogPostClient.tsx:285:            <div className="ed-prose" style={{ maxWidth: 'none' }}>
frontend/src/app/features/multilingual/MultilingualClient.tsx:8:import EdProse from '../../../components/marketing/EdProse';
frontend/src/app/features/multilingual/MultilingualClient.tsx:131:        <EdProse>
frontend/src/app/features/multilingual/MultilingualClient.tsx:135:        </EdProse>
frontend/src/app/features/multilingual/MultilingualClient.tsx:215:        <EdProse>
frontend/src/app/features/multilingual/MultilingualClient.tsx:219:        </EdProse>
frontend/src/app/features/multi-format/MultiFormatClient.tsx:19:import EdProse from '../../../components/marketing/EdProse';
frontend/src/app/features/multi-format/MultiFormatClient.tsx:158:        <EdProse>
frontend/src/app/features/multi-format/MultiFormatClient.tsx:162:        </EdProse>

exec
/bin/zsh -lc 'rg -n "#[0-9A-Fa-f]{3,6}|rgba|bg-(red|amber|orange|rose|purple|emerald|teal|yellow)|text-(red|amber|orange|rose|purple|emerald|teal|yellow)|border-(red|amber|orange|rose|purple|emerald|teal|yellow)" frontend/src/app/admin/AdminPageClient.tsx frontend/src/components/admin' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
frontend/src/app/admin/AdminPageClient.tsx:223:          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
frontend/src/components/admin/ChurnSignalsBars.tsx:39:            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(113,113,122,0.18)" />
frontend/src/components/admin/ChurnSignalsBars.tsx:49:            <Bar dataKey="pctValue" fill="#1D4ED8" radius={[4, 4, 0, 0]} />
frontend/src/components/admin/RetentionCurves.tsx:46:                stroke="#1D4ED8"
frontend/src/components/admin/RetentionCurves.tsx:48:                dot={{ r: 4, fill: "#1D4ED8" }}
frontend/src/components/admin/RetentionCurves.tsx:84:                stroke="#1D4ED8"
frontend/src/components/admin/AdminPanels.tsx:40:    plus: "bg-blue-50 text-[#1D4ED8] dark:bg-blue-400/10 dark:text-blue-300",
frontend/src/components/admin/AdminPanels.tsx:54:        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
frontend/src/components/admin/AdminPanels.tsx:55:        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
frontend/src/components/admin/AdminPanels.tsx:83:            <ShieldCheck aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
frontend/src/components/admin/AdminPanels.tsx:85:            <AlertTriangle aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-300" />
frontend/src/components/admin/AdminPanels.tsx:216:            <ShieldCheck aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
frontend/src/components/admin/AdminPanels.tsx:218:            <AlertTriangle aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-300" />
frontend/src/components/admin/ReasonBucketsDonut.tsx:14:const COLORS = ["#1D4ED8", "#0F766E", "#52525B", "#DC2626", "#9333EA", "#2563EB"];
frontend/src/components/admin/RetentionHeatmap.tsx:8:  if (pct <= 0) return "rgba(113, 113, 122, 0.16)";
frontend/src/components/admin/RetentionHeatmap.tsx:10:  return `rgba(29, 78, 216, ${alpha})`;
frontend/src/components/admin/ActivationTab.tsx:47:                  <p className="mt-1 text-xs tabular-nums text-red-600 dark:text-red-300">
frontend/src/components/admin/RetentionTab.tsx:85:              <div className="h-full rounded bg-[#1D4ED8]" style={{ width: `${Math.min(100, row.pct * 100)}%` }} />
frontend/src/components/admin/KPICard.tsx:48:          <Icon aria-hidden="true" className="h-4 w-4 text-[#1D4ED8]" />
frontend/src/components/admin/KPICard.tsx:53:              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
frontend/src/components/admin/KPICard.tsx:55:                ? "bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-300"
frontend/src/components/admin/KPICard.tsx:70:      <svg className="mt-3 h-9 w-full text-[#1D4ED8]" viewBox="0 0 100 40" aria-hidden="true">

exec
/bin/zsh -lc "nl -ba backend/app/db.py | sed -n '1,180p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
nl: backend/app/db.py: No such file or directory

exec
/bin/zsh -lc "rg -n \"timezone|TimeZone|SET TIME ZONE|AT TIME ZONE|date_trunc\\(\" backend/app backend/alembic backend/tests -g '*.py'" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "rg -n \"ADMIN_EMAILS|OWNER|INTERNAL_OWNER|admin_emails|require_admin\" backend/app backend/tests -g '*.py'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
backend/tests/test_admin_churn.py:104:        admin_emails={"owner@example.com"},
backend/tests/test_admin_retention.py:60:        admin_emails={"owner@example.com"},
backend/app/core/config.py:169:    ADMIN_EMAILS: str = ""
backend/app/core/deps.py:76:async def require_admin(
backend/app/core/deps.py:79:    """Require admin user (email in ADMIN_EMAILS env var)."""
backend/app/core/deps.py:80:    admin_emails = [e.strip() for e in settings.ADMIN_EMAILS.split(",") if e.strip()]
backend/app/core/deps.py:81:    if user.email not in admin_emails:
backend/app/api/admin.py:1:"""Admin analytics endpoints — protected by require_admin."""
backend/app/api/admin.py:18:from app.core.deps import get_db_session, require_admin
backend/app/api/admin.py:104:INTERNAL_OWNER_USER_IDS = {"c142f3af-6e6b-488d-ba57-d91aa3e57cc7"}
backend/app/api/admin.py:237:def _admin_excluded_emails(admin_emails: set[str] | None = None) -> set[str]:
backend/app/api/admin.py:238:    if admin_emails is not None:
backend/app/api/admin.py:239:        return {email.strip().lower() for email in admin_emails if email and email.strip()}
backend/app/api/admin.py:240:    return {email.strip().lower() for email in settings.ADMIN_EMAILS.split(",") if email.strip()}
backend/app/api/admin.py:246:    return set(INTERNAL_OWNER_USER_IDS)
backend/app/api/admin.py:254:    if INTERNAL_OWNER_USER_IDS:
backend/app/api/admin.py:255:        conditions.append(~cast(User.id, String).in_(INTERNAL_OWNER_USER_IDS))
backend/app/api/admin.py:259:def _is_excluded_user(row: Any, excluded_user_ids: set[str], admin_emails: set[str]) -> bool:
backend/app/api/admin.py:262:    return str(user_id) in excluded_user_ids or (isinstance(email, str) and email.lower() in admin_emails)
backend/app/api/admin.py:268:    admin_emails: set[str] | None = None,
backend/app/api/admin.py:271:    excluded_emails = _admin_excluded_emails(admin_emails)
backend/app/api/admin.py:349:    admin_emails: set[str] | None = None,
backend/app/api/admin.py:351:    eligible_users = _eligible_user_map(users, excluded_user_ids, admin_emails)
backend/app/api/admin.py:585:    admin_emails: set[str] | None = None,
backend/app/api/admin.py:587:    eligible_users = _eligible_user_map(users, excluded_user_ids, admin_emails)
backend/app/api/admin.py:800:    _admin: User = Depends(require_admin),
backend/app/api/admin.py:864:    _admin: User = Depends(require_admin),
backend/app/api/admin.py:946:    _admin: User = Depends(require_admin),
backend/app/api/admin.py:1000:    _admin: User = Depends(require_admin),
backend/app/api/admin.py:1546:    _admin: User = Depends(require_admin),
backend/app/api/admin.py:1631:    _admin: User = Depends(require_admin),
backend/app/api/admin.py:1896:    _admin: User = Depends(require_admin),
backend/app/api/admin.py:1934:    _admin: User = Depends(require_admin),
backend/app/api/admin.py:2163:    _admin: User = Depends(require_admin),
backend/app/api/admin.py:2311:    _admin: User = Depends(require_admin),
backend/app/api/admin.py:2368:    _admin: User = Depends(require_admin),

 succeeded in 0ms:
backend/tests/test_document_diffs_api.py:4:from datetime import datetime, timezone
backend/tests/test_document_diffs_api.py:66:        now = datetime.now(timezone.utc)
backend/tests/test_document_diffs_api.py:81:            obj.created_at = datetime.now(timezone.utc)
backend/tests/test_document_diffs_api.py:96:        now = datetime.now(timezone.utc)
backend/tests/test_document_diffs_api.py:259:        created_at=datetime.now(timezone.utc),
backend/tests/test_document_diffs_api.py:272:        created_at=datetime.now(timezone.utc),
backend/tests/test_document_diffs_api.py:273:        updated_at=datetime.now(timezone.utc),
backend/tests/test_document_diffs_api.py:274:        completed_at=datetime.now(timezone.utc),
backend/alembic/versions/20260317_0019_add_shared_sessions.py:26:        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
backend/alembic/versions/20260317_0019_add_shared_sessions.py:27:        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
backend/app/services/document_brief_service.py:11:from datetime import datetime, timezone
backend/app/services/document_brief_service.py:1443:        "generated_at": datetime.now(timezone.utc).isoformat(),
backend/tests/test_admin_user_activity.py:3:from datetime import datetime, timezone
backend/tests/test_admin_user_activity.py:23:    assert admin_api._date_label(datetime(2026, 5, 14, tzinfo=timezone.utc)) == "2026-05-14"
backend/tests/test_admin_user_activity.py:34:    query_text = str(admin_api._activity_subquery(datetime(2026, 5, 1, tzinfo=timezone.utc)))
backend/tests/test_auth_adapter.py:2:from datetime import datetime, timedelta, timezone
backend/tests/test_auth_adapter.py:87:    expires = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
backend/tests/test_admin_churn.py:3:from datetime import date, datetime, timezone
backend/tests/test_admin_churn.py:20:    now = datetime(2026, 6, 15, 12, tzinfo=timezone.utc)
backend/tests/test_admin_churn.py:23:        _row(id="u1", email="u1@example.com", created_at=datetime(2026, 5, 1, tzinfo=timezone.utc), plan="free"),
backend/tests/test_admin_churn.py:24:        _row(id="u2", email="u2@example.com", created_at=datetime(2026, 5, 1, tzinfo=timezone.utc), plan="free"),
backend/tests/test_admin_churn.py:25:        _row(id="u3", email="u3@example.com", created_at=datetime(2026, 5, 1, tzinfo=timezone.utc), plan="plus"),
backend/tests/test_admin_churn.py:26:        _row(id="u4", email="u4@example.com", created_at=datetime(2026, 5, 1, tzinfo=timezone.utc), plan="pro"),
backend/tests/test_admin_churn.py:27:        _row(id="u5", email="u5@example.com", created_at=datetime(2026, 5, 1, tzinfo=timezone.utc), plan="free"),
backend/tests/test_admin_churn.py:28:        _row(id=owner_id, email="owner@example.com", created_at=datetime(2026, 5, 1, tzinfo=timezone.utc), plan="pro"),
backend/tests/test_admin_churn.py:69:            created_at=datetime(2026, 5, 3, tzinfo=timezone.utc),
backend/tests/test_admin_churn.py:79:            created_at=datetime(2026, 5, 4, tzinfo=timezone.utc),
backend/tests/test_admin_churn.py:90:            created_at=datetime(2026, 5, 16, tzinfo=timezone.utc),
backend/tests/test_sharing_api.py:46:    from datetime import datetime, timezone
backend/tests/test_sharing_api.py:62:    now = datetime.now(timezone.utc)
backend/alembic/versions/20260509_0028_add_document_layout_runs.py:27:        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
backend/alembic/versions/20260509_0028_add_document_layout_runs.py:28:        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
backend/alembic/versions/20260509_0028_add_document_layout_runs.py:29:        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
backend/tests/test_admin_retention.py:3:from datetime import date, datetime, timezone
backend/tests/test_admin_retention.py:20:    now = datetime(2026, 6, 15, 12, tzinfo=timezone.utc)
backend/tests/test_admin_retention.py:23:        _row(id="u1", email="user1@example.com", created_at=datetime(2026, 5, 5, tzinfo=timezone.utc), plan="free"),
backend/tests/test_admin_retention.py:24:        _row(id="u2", email="user2@example.com", created_at=datetime(2026, 5, 6, tzinfo=timezone.utc), plan="plus"),
backend/tests/test_admin_retention.py:25:        _row(id="u3", email="user3@example.com", created_at=datetime(2026, 5, 12, tzinfo=timezone.utc), plan="pro"),
backend/tests/test_admin_retention.py:26:        _row(id=owner_id, email="owner@example.com", created_at=datetime(2026, 5, 5, tzinfo=timezone.utc), plan="pro"),
backend/tests/test_extractions_api.py:4:from datetime import datetime, timezone
backend/tests/test_extractions_api.py:63:        now = datetime.now(timezone.utc)
backend/alembic/versions/20260507_0024_add_document_tables.py:25:        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
backend/alembic/versions/20260507_0024_add_document_tables.py:26:        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
backend/app/services/question_template_service.py:7:from datetime import datetime, timezone
backend/app/services/question_template_service.py:130:        job.updated_at = datetime.now(timezone.utc)
backend/app/services/question_template_service.py:239:            job.completed_at = datetime.now(timezone.utc)
backend/app/services/question_template_service.py:266:            job.completed_at = datetime.now(timezone.utc)
backend/tests/test_error_taxonomy.py:4:from datetime import datetime, timedelta, timezone
backend/tests/test_error_taxonomy.py:623:        monthly_credits_granted_at=datetime.now(timezone.utc),
backend/tests/test_error_taxonomy.py:839:        expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),
backend/tests/test_admin_rag_quality.py:3:from datetime import datetime, timedelta, timezone
backend/tests/test_admin_rag_quality.py:51:    now = datetime.now(timezone.utc)
backend/tests/test_chat_tool_executor.py:4:from datetime import datetime, timezone
backend/tests/test_chat_tool_executor.py:42:        created_at=datetime.now(timezone.utc),
backend/tests/test_chat_tool_executor.py:43:        updated_at=datetime.now(timezone.utc),
backend/tests/test_chat_tool_executor.py:86:        created_at=datetime.now(timezone.utc),
backend/tests/test_chat_tool_executor.py:87:        updated_at=datetime.now(timezone.utc),
backend/tests/test_question_templates_api.py:4:from datetime import datetime, timezone
backend/tests/test_question_templates_api.py:70:        now = datetime.now(timezone.utc)
backend/tests/test_question_templates_api.py:85:            obj.created_at = datetime.now(timezone.utc)
backend/tests/test_question_templates_api.py:102:    now = datetime.now(timezone.utc)
backend/tests/test_question_templates_api.py:116:        now = datetime.now(timezone.utc)
backend/tests/test_question_templates_api.py:287:        created_at=datetime.now(timezone.utc),
backend/alembic/versions/20260509_0029_add_document_elements.py:33:        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
backend/alembic/versions/20260509_0029_add_document_elements.py:34:        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
backend/alembic/versions/20260414_0021_add_plan_transitions_audit.py:46:            sa.TIMESTAMP(timezone=True),
backend/alembic/versions/20260414_0021_add_plan_transitions_audit.py:58:            sa.TIMESTAMP(timezone=True),
backend/alembic/versions/20260501_0022_add_product_events.py:47:            sa.TIMESTAMP(timezone=True),
backend/alembic/versions/20260205_0003_add_auth_credits_tables.py:33:        sa.Column("email_verified", sa.DateTime(timezone=True), nullable=True),
backend/alembic/versions/20260205_0003_add_auth_credits_tables.py:35:        sa.Column("signup_bonus_granted_at", sa.DateTime(timezone=True), nullable=True),
backend/alembic/versions/20260205_0003_add_auth_credits_tables.py:36:        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
backend/alembic/versions/20260205_0003_add_auth_credits_tables.py:37:        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
backend/alembic/versions/20260205_0003_add_auth_credits_tables.py:64:        sa.Column("expires", sa.DateTime(timezone=True), nullable=False),
backend/alembic/versions/20260205_0003_add_auth_credits_tables.py:77:        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
backend/alembic/versions/20260205_0003_add_auth_credits_tables.py:93:        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
backend/alembic/versions/20260507_0025_add_question_templates.py:23:        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
backend/alembic/versions/20260507_0025_add_question_templates.py:24:        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
backend/tests/test_tables_api.py:4:from datetime import datetime, timezone
backend/tests/test_tables_api.py:55:    now = datetime.now(timezone.utc)
backend/tests/test_tables_api.py:240:    now = datetime.now(timezone.utc)
backend/tests/test_tables_api.py:268:    now = datetime.now(timezone.utc)
backend/tests/test_tables_api.py:304:    now = datetime.now(timezone.utc)
backend/alembic/versions/20260507_0023_add_document_jobs_extractions.py:29:        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
backend/alembic/versions/20260507_0023_add_document_jobs_extractions.py:30:        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
backend/alembic/versions/20260507_0023_add_document_jobs_extractions.py:31:        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
backend/alembic/versions/20260507_0023_add_document_jobs_extractions.py:51:        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
backend/alembic/versions/20260507_0023_add_document_jobs_extractions.py:52:        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
backend/alembic/versions/20260507_0026_add_document_briefs.py:31:        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
backend/alembic/versions/20260507_0026_add_document_briefs.py:32:        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
backend/alembic/versions/20260507_0026_add_document_briefs.py:33:        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
backend/alembic/versions/20260204_0001_initial_tables.py:39:        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
backend/alembic/versions/20260204_0001_initial_tables.py:40:        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
backend/alembic/versions/20260204_0001_initial_tables.py:69:        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
backend/alembic/versions/20260204_0001_initial_tables.py:79:        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
backend/alembic/versions/20260204_0001_initial_tables.py:80:        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
backend/alembic/versions/20260204_0001_initial_tables.py:93:        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
backend/app/services/credit_service.py:217:    from datetime import datetime, timedelta, timezone
backend/app/services/credit_service.py:223:    now = datetime.now(timezone.utc)
backend/app/services/credit_service.py:227:        last = last.replace(tzinfo=timezone.utc)
backend/app/services/extraction_service.py:10:from datetime import datetime, timezone
backend/app/services/extraction_service.py:526:        job.updated_at = datetime.now(timezone.utc)
backend/app/services/extraction_service.py:572:            job.completed_at = datetime.now(timezone.utc)
backend/app/services/extraction_service.py:599:            job.completed_at = datetime.now(timezone.utc)
backend/alembic/versions/20260206_0004_add_subscription_fields.py:29:    op.add_column("users", sa.Column("monthly_credits_granted_at", sa.DateTime(timezone=True), nullable=True))
backend/app/services/chat_tool_executor.py:5:from datetime import datetime, timedelta, timezone
backend/app/services/chat_tool_executor.py:74:        return dt.replace(tzinfo=timezone.utc)
backend/app/services/chat_tool_executor.py:75:    return dt.astimezone(timezone.utc)
backend/app/services/chat_tool_executor.py:99:        window_start = datetime.now(timezone.utc) - timedelta(days=30)
backend/alembic/versions/20260514_0030_add_user_feedback.py:40:        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
backend/alembic/versions/20260514_0030_add_user_feedback.py:41:        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
backend/app/models/tables.py:34:    created_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
backend/app/models/tables.py:35:    updated_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.func.now())
backend/app/models/tables.py:140:    created_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
backend/app/models/tables.py:174:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
backend/app/models/tables.py:177:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()"), onupdate=sa.func.now()
backend/app/models/tables.py:211:    created_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
backend/app/models/tables.py:212:    updated_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.func.now())
backend/app/models/tables.py:241:    created_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
backend/app/models/tables.py:260:    email_verified: Mapped[Optional[datetime]] = mapped_column(sa.DateTime(timezone=True))
backend/app/models/tables.py:262:    signup_bonus_granted_at: Mapped[Optional[datetime]] = mapped_column(sa.DateTime(timezone=True))
backend/app/models/tables.py:266:    monthly_credits_granted_at: Mapped[Optional[datetime]] = mapped_column(sa.DateTime(timezone=True))
backend/app/models/tables.py:267:    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
backend/app/models/tables.py:269:        sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.func.now()
backend/app/models/tables.py:308:    expires: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False)
backend/app/models/tables.py:325:    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
backend/app/models/tables.py:361:    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
backend/app/models/tables.py:374:    sa.Column("added_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
backend/app/models/tables.py:389:    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
backend/app/models/tables.py:391:        sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.func.now()
backend/app/models/tables.py:419:    expires_at: Mapped[Optional[datetime]] = mapped_column(sa.DateTime(timezone=True), nullable=True)
backend/app/models/tables.py:421:        sa.DateTime(timezone=True), server_default=sa.text("now()")
backend/app/models/tables.py:447:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
backend/app/models/tables.py:453:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
backend/app/models/tables.py:478:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
backend/app/models/tables.py:515:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
backend/app/models/tables.py:518:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()"), onupdate=sa.func.now()
backend/app/models/tables.py:555:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
backend/app/models/tables.py:558:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()"), onupdate=sa.func.now()
backend/app/models/tables.py:560:    completed_at: Mapped[Optional[datetime]] = mapped_column(sa.DateTime(timezone=True), nullable=True)
backend/app/models/tables.py:589:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
backend/app/models/tables.py:592:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()"), onupdate=sa.func.now()
backend/app/models/tables.py:615:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
backend/app/models/tables.py:618:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()"), onupdate=sa.func.now()
backend/app/models/tables.py:651:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
backend/app/models/tables.py:654:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
backend/app/models/tables.py:657:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()"), onupdate=sa.func.now()
backend/app/models/tables.py:682:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
backend/app/models/tables.py:685:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()"), onupdate=sa.func.now()
backend/app/models/tables.py:713:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
backend/app/models/tables.py:716:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()"), onupdate=sa.func.now()
backend/app/models/tables.py:718:    completed_at: Mapped[Optional[datetime]] = mapped_column(sa.DateTime(timezone=True), nullable=True)
backend/app/services/auth_service.py:5:from datetime import datetime, timezone
backend/app/services/auth_service.py:52:        signup_bonus_granted_at=datetime.now(timezone.utc),
backend/app/services/auth_service.py:53:        monthly_credits_granted_at=datetime.now(timezone.utc),
backend/app/services/auth_service.py:176:    if vt.expires < datetime.now(timezone.utc):
backend/alembic/versions/20260208_0009_add_collections.py:25:        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
backend/alembic/versions/20260208_0009_add_collections.py:26:        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
backend/alembic/versions/20260208_0009_add_collections.py:35:        sa.Column('added_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
backend/app/workers/cleanup_tasks.py:5:from datetime import datetime, timedelta, timezone
backend/app/workers/cleanup_tasks.py:21:    cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
backend/app/core/security_log.py:6:from datetime import datetime, timezone
backend/app/core/security_log.py:15:        "ts": datetime.now(timezone.utc).isoformat(),
backend/tests/test_document_jobs_api.py:4:from datetime import datetime, timezone
backend/tests/test_document_jobs_api.py:65:    now = datetime.now(timezone.utc)
backend/app/services/document_diff_service.py:7:from datetime import datetime, timezone
backend/app/services/document_diff_service.py:370:        job.updated_at = datetime.now(timezone.utc)
backend/app/services/document_diff_service.py:442:            job.completed_at = datetime.now(timezone.utc)
backend/app/services/document_diff_service.py:469:            job.completed_at = datetime.now(timezone.utc)
backend/app/services/export_service.py:6:from datetime import datetime, timezone
backend/app/services/export_service.py:67:        f"*Exported: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}*",
backend/app/services/export_service.py:115:        f"Document: {safe_doc_name} | Exported: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}"
backend/app/services/export_service.py:161:    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
backend/app/services/summary_service.py:12:from datetime import datetime, timezone
backend/app/services/summary_service.py:281:    brief.generated_at = datetime.now(timezone.utc)
backend/app/services/summary_service.py:310:    brief.generated_at = datetime.now(timezone.utc)
backend/app/services/table_service.py:10:from datetime import datetime, timezone
backend/app/services/table_service.py:237:        created_at=datetime.now(timezone.utc),
backend/app/services/table_service.py:238:        updated_at=datetime.now(timezone.utc),
backend/app/services/table_service.py:277:    run.completed_at = datetime.now(timezone.utc)
backend/app/services/table_service.py:708:        element.updated_at = datetime.now(timezone.utc)
backend/app/services/table_service.py:810:        "reconstructed_at": datetime.now(timezone.utc).isoformat(),
backend/app/services/table_service.py:832:    table.updated_at = datetime.now(timezone.utc)
backend/app/services/table_service.py:847:        job.updated_at = datetime.now(timezone.utc)
backend/app/services/table_service.py:866:            job.completed_at = datetime.now(timezone.utc)
backend/app/services/table_service.py:879:            job.completed_at = datetime.now(timezone.utc)
backend/app/services/table_service.py:895:        job.updated_at = datetime.now(timezone.utc)
backend/app/services/table_service.py:923:            job.completed_at = datetime.now(timezone.utc)
backend/app/services/table_service.py:936:            job.completed_at = datetime.now(timezone.utc)
backend/app/api/admin.py:8:from datetime import date, datetime, timedelta, timezone
backend/app/api/admin.py:642:        key=lambda row: _row_value(row, "created_at") or datetime.min.replace(tzinfo=timezone.utc),
backend/app/api/admin.py:656:        key=lambda row: _row_value(row, "created_at") or datetime.min.replace(tzinfo=timezone.utc),
backend/app/api/admin.py:870:    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
backend/app/api/admin.py:871:    trunc = lambda col: func.date_trunc(period, col)  # noqa: E731
backend/app/api/admin.py:1006:    now = datetime.now(timezone.utc)
backend/app/api/admin.py:1009:    trunc = lambda col: func.date_trunc(period, col)  # noqa: E731
backend/app/api/admin.py:1349:                    SELECT id, date_trunc('day', created_at)::date AS cohort_date
backend/app/api/admin.py:1354:                    SELECT user_id, date_trunc('day', created_at)::date AS activity_date
backend/app/api/admin.py:1358:                    SELECT s.user_id, date_trunc('day', m.created_at)::date AS activity_date
backend/app/api/admin.py:1363:                    SELECT user_id, date_trunc('day', created_at)::date AS activity_date
backend/app/api/admin.py:1367:                    SELECT user_id, date_trunc('day', created_at)::date AS activity_date
backend/app/api/admin.py:1371:                    SELECT user_id, date_trunc('day', created_at)::date AS activity_date
backend/app/api/admin.py:1550:    now = datetime.now(timezone.utc)
backend/app/api/admin.py:1555:        tzinfo=timezone.utc,
backend/app/api/admin.py:1576:    activity_day = func.date_trunc("day", Message.created_at).label("activity_date")
backend/app/api/admin.py:1636:    now = datetime.now(timezone.utc)
backend/app/api/admin.py:1656:    activity_day = func.date_trunc("day", Message.created_at).label("activity_date")
backend/app/api/admin.py:1939:    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
backend/app/api/admin.py:2168:    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
backend/tests/conftest.py:4:from datetime import datetime, timedelta, timezone
backend/tests/conftest.py:90:    now = datetime.now(timezone.utc)
backend/tests/test_document_briefs_api.py:4:from datetime import datetime, timezone
backend/tests/test_document_briefs_api.py:64:    now = datetime.now(timezone.utc)
backend/tests/test_document_briefs_api.py:147:    now = datetime.now(timezone.utc)
backend/tests/test_billing_logic.py:4:from datetime import datetime, timedelta, timezone
backend/tests/test_billing_logic.py:21:        updated_at=datetime.now(timezone.utc),
backend/tests/test_billing_logic.py:60:        updated_at=datetime.now(timezone.utc) - billing_api.PENDING_SUBSCRIPTION_TTL - timedelta(minutes=1),
backend/tests/test_billing_logic.py:116:        monthly_credits_granted_at=datetime.now(timezone.utc),
backend/app/api/users.py:5:from datetime import datetime, timezone
backend/app/api/users.py:252:    now = datetime.now(timezone.utc).timestamp()
backend/app/api/users.py:299:                key=lambda m: m.created_at or datetime.min.replace(tzinfo=timezone.utc),
backend/app/api/users.py:334:        "exported_at": datetime.now(timezone.utc).isoformat(),
backend/app/api/chat.py:5:from datetime import datetime, timedelta, timezone
backend/app/api/chat.py:70:        return dt.replace(tzinfo=timezone.utc)
backend/app/api/chat.py:71:    return dt.astimezone(timezone.utc)
backend/app/api/chat.py:95:        window_start = datetime.now(timezone.utc) - timedelta(days=30)
backend/app/api/extractions.py:6:from datetime import datetime, timedelta, timezone
backend/app/api/extractions.py:80:        return dt.replace(tzinfo=timezone.utc)
backend/app/api/extractions.py:81:    return dt.astimezone(timezone.utc)
backend/app/api/extractions.py:142:        window_start = datetime.now(timezone.utc) - timedelta(days=30)
backend/app/api/sharing.py:4:from datetime import datetime, timezone
backend/app/api/sharing.py:75:                | (SharedSession.expires_at > datetime.now(timezone.utc)),
backend/app/api/sharing.py:152:    if share.expires_at and share.expires_at < datetime.now(timezone.utc):
backend/app/api/billing.py:6:from datetime import datetime, timedelta, timezone
backend/app/api/billing.py:134:        return dt.replace(tzinfo=timezone.utc)
backend/app/api/billing.py:135:    return dt.astimezone(timezone.utc)
backend/app/api/billing.py:142:    return datetime.now(timezone.utc) - updated_at >= PENDING_SUBSCRIPTION_TTL
backend/app/api/billing.py:674:        dt = datetime.fromtimestamp(int(dt_value), tz=timezone.utc)

exec
/bin/zsh -lc "nl -ba backend/app/core/deps.py | sed -n '1,110p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	import logging
     2	from typing import AsyncGenerator, Optional
     3	from uuid import UUID
     4	
     5	from fastapi import Depends, HTTPException, Request
     6	from jose import JWTError, jwt
     7	from jose.jwt import ExpiredSignatureError, JWTClaimsError
     8	from sqlalchemy.ext.asyncio import AsyncSession
     9	
    10	from app.core.config import settings
    11	from app.core.security_log import log_security_event
    12	from app.models.database import AsyncSessionLocal
    13	from app.models.tables import User
    14	
    15	logger = logging.getLogger(__name__)
    16	
    17	
    18	async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    19	    """Provide an async SQLAlchemy session for FastAPI dependencies."""
    20	    async with AsyncSessionLocal() as session:  # type: AsyncSession
    21	        yield session
    22	
    23	
    24	async def get_current_user_optional(
    25	    request: Request,
    26	    db: AsyncSession = Depends(get_db_session),
    27	) -> Optional[User]:
    28	    """Extract user from JWT if present. Returns None for guests."""
    29	    auth_header = request.headers.get("Authorization")
    30	    if not auth_header or not auth_header.startswith("Bearer "):
    31	        return None
    32	
    33	    token = auth_header.split(" ")[1]
    34	    try:
    35	        # Validate AUTH_SECRET is configured
    36	        if not settings.AUTH_SECRET:
    37	            logger.error("AUTH_SECRET not configured")
    38	            return None
    39	
    40	        payload = jwt.decode(
    41	            token,
    42	            settings.AUTH_SECRET,
    43	            algorithms=["HS256"],
    44	            options={
    45	                "verify_aud": False,
    46	                "verify_exp": True,  # Explicitly verify expiration
    47	                "require_exp": True,  # Require exp claim
    48	                "require_iat": True,  # Require issued-at claim
    49	                "require_sub": True,  # Require subject claim
    50	            },
    51	        )
    52	        user_id = payload.get("sub")
    53	        if not user_id:
    54	            return None
    55	        return await db.get(User, UUID(user_id))
    56	    except ExpiredSignatureError:
    57	        log_security_event("auth_failure", reason="token_expired")
    58	        return None
    59	    except JWTClaimsError as e:
    60	        log_security_event("auth_failure", reason="claims_error", detail=str(e))
    61	        return None
    62	    except JWTError as e:
    63	        log_security_event("auth_failure", reason="decode_error", detail=str(e))
    64	        return None
    65	
    66	
    67	async def require_auth(
    68	    user: Optional[User] = Depends(get_current_user_optional),
    69	) -> User:
    70	    """Require authenticated user, raise 401 if not."""
    71	    if not user:
    72	        raise HTTPException(status_code=401, detail="Authentication required")
    73	    return user
    74	
    75	
    76	async def require_admin(
    77	    user: User = Depends(require_auth),
    78	) -> User:
    79	    """Require admin user (email in ADMIN_EMAILS env var)."""
    80	    admin_emails = [e.strip() for e in settings.ADMIN_EMAILS.split(",") if e.strip()]
    81	    if user.email not in admin_emails:
    82	        raise HTTPException(status_code=403, detail="Admin access required")
    83	    return user

exec
/bin/zsh -lc "rg -n \"def get_db_session|create_async_engine|async_sessionmaker|timezone\" backend/app -g '*.py'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
backend/app/services/document_brief_service.py:11:from datetime import datetime, timezone
backend/app/services/document_brief_service.py:1443:        "generated_at": datetime.now(timezone.utc).isoformat(),
backend/app/services/question_template_service.py:7:from datetime import datetime, timezone
backend/app/services/question_template_service.py:130:        job.updated_at = datetime.now(timezone.utc)
backend/app/services/question_template_service.py:239:            job.completed_at = datetime.now(timezone.utc)
backend/app/services/question_template_service.py:266:            job.completed_at = datetime.now(timezone.utc)
backend/app/services/table_service.py:10:from datetime import datetime, timezone
backend/app/services/table_service.py:237:        created_at=datetime.now(timezone.utc),
backend/app/services/table_service.py:238:        updated_at=datetime.now(timezone.utc),
backend/app/services/table_service.py:277:    run.completed_at = datetime.now(timezone.utc)
backend/app/services/table_service.py:708:        element.updated_at = datetime.now(timezone.utc)
backend/app/services/table_service.py:810:        "reconstructed_at": datetime.now(timezone.utc).isoformat(),
backend/app/services/table_service.py:832:    table.updated_at = datetime.now(timezone.utc)
backend/app/services/table_service.py:847:        job.updated_at = datetime.now(timezone.utc)
backend/app/services/table_service.py:866:            job.completed_at = datetime.now(timezone.utc)
backend/app/services/table_service.py:879:            job.completed_at = datetime.now(timezone.utc)
backend/app/services/table_service.py:895:        job.updated_at = datetime.now(timezone.utc)
backend/app/services/table_service.py:923:            job.completed_at = datetime.now(timezone.utc)
backend/app/services/table_service.py:936:            job.completed_at = datetime.now(timezone.utc)
backend/app/services/summary_service.py:12:from datetime import datetime, timezone
backend/app/services/summary_service.py:281:    brief.generated_at = datetime.now(timezone.utc)
backend/app/services/summary_service.py:310:    brief.generated_at = datetime.now(timezone.utc)
backend/app/services/export_service.py:6:from datetime import datetime, timezone
backend/app/services/export_service.py:67:        f"*Exported: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}*",
backend/app/services/export_service.py:115:        f"Document: {safe_doc_name} | Exported: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}"
backend/app/services/export_service.py:161:    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
backend/app/services/credit_service.py:217:    from datetime import datetime, timedelta, timezone
backend/app/services/credit_service.py:223:    now = datetime.now(timezone.utc)
backend/app/services/credit_service.py:227:        last = last.replace(tzinfo=timezone.utc)
backend/app/services/document_diff_service.py:7:from datetime import datetime, timezone
backend/app/services/document_diff_service.py:370:        job.updated_at = datetime.now(timezone.utc)
backend/app/services/document_diff_service.py:442:            job.completed_at = datetime.now(timezone.utc)
backend/app/services/document_diff_service.py:469:            job.completed_at = datetime.now(timezone.utc)
backend/app/services/auth_service.py:5:from datetime import datetime, timezone
backend/app/services/auth_service.py:52:        signup_bonus_granted_at=datetime.now(timezone.utc),
backend/app/services/auth_service.py:53:        monthly_credits_granted_at=datetime.now(timezone.utc),
backend/app/services/auth_service.py:176:    if vt.expires < datetime.now(timezone.utc):
backend/app/services/chat_tool_executor.py:5:from datetime import datetime, timedelta, timezone
backend/app/services/chat_tool_executor.py:74:        return dt.replace(tzinfo=timezone.utc)
backend/app/services/chat_tool_executor.py:75:    return dt.astimezone(timezone.utc)
backend/app/services/chat_tool_executor.py:99:        window_start = datetime.now(timezone.utc) - timedelta(days=30)
backend/app/workers/cleanup_tasks.py:5:from datetime import datetime, timedelta, timezone
backend/app/workers/cleanup_tasks.py:21:    cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
backend/app/services/extraction_service.py:10:from datetime import datetime, timezone
backend/app/services/extraction_service.py:526:        job.updated_at = datetime.now(timezone.utc)
backend/app/services/extraction_service.py:572:            job.completed_at = datetime.now(timezone.utc)
backend/app/services/extraction_service.py:599:            job.completed_at = datetime.now(timezone.utc)
backend/app/models/database.py:6:from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
backend/app/models/database.py:33:async_engine: AsyncEngine = create_async_engine(DATABASE_URL, **engine_kwargs)
backend/app/models/database.py:34:AsyncSessionLocal = async_sessionmaker(async_engine, expire_on_commit=False)
backend/app/models/tables.py:34:    created_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
backend/app/models/tables.py:35:    updated_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.func.now())
backend/app/models/tables.py:140:    created_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
backend/app/models/tables.py:174:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
backend/app/models/tables.py:177:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()"), onupdate=sa.func.now()
backend/app/models/tables.py:211:    created_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
backend/app/models/tables.py:212:    updated_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.func.now())
backend/app/models/tables.py:241:    created_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
backend/app/models/tables.py:260:    email_verified: Mapped[Optional[datetime]] = mapped_column(sa.DateTime(timezone=True))
backend/app/models/tables.py:262:    signup_bonus_granted_at: Mapped[Optional[datetime]] = mapped_column(sa.DateTime(timezone=True))
backend/app/models/tables.py:266:    monthly_credits_granted_at: Mapped[Optional[datetime]] = mapped_column(sa.DateTime(timezone=True))
backend/app/models/tables.py:267:    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
backend/app/models/tables.py:269:        sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.func.now()
backend/app/models/tables.py:308:    expires: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False)
backend/app/models/tables.py:325:    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
backend/app/models/tables.py:361:    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
backend/app/models/tables.py:374:    sa.Column("added_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
backend/app/models/tables.py:389:    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
backend/app/models/tables.py:391:        sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.func.now()
backend/app/models/tables.py:419:    expires_at: Mapped[Optional[datetime]] = mapped_column(sa.DateTime(timezone=True), nullable=True)
backend/app/models/tables.py:421:        sa.DateTime(timezone=True), server_default=sa.text("now()")
backend/app/models/tables.py:447:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
backend/app/models/tables.py:453:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
backend/app/models/tables.py:478:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
backend/app/models/tables.py:515:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
backend/app/models/tables.py:518:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()"), onupdate=sa.func.now()
backend/app/models/tables.py:555:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
backend/app/models/tables.py:558:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()"), onupdate=sa.func.now()
backend/app/models/tables.py:560:    completed_at: Mapped[Optional[datetime]] = mapped_column(sa.DateTime(timezone=True), nullable=True)
backend/app/models/tables.py:589:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
backend/app/models/tables.py:592:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()"), onupdate=sa.func.now()
backend/app/models/tables.py:615:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
backend/app/models/tables.py:618:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()"), onupdate=sa.func.now()
backend/app/models/tables.py:651:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
backend/app/models/tables.py:654:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
backend/app/models/tables.py:657:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()"), onupdate=sa.func.now()
backend/app/models/tables.py:682:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
backend/app/models/tables.py:685:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()"), onupdate=sa.func.now()
backend/app/models/tables.py:713:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
backend/app/models/tables.py:716:        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()"), onupdate=sa.func.now()
backend/app/models/tables.py:718:    completed_at: Mapped[Optional[datetime]] = mapped_column(sa.DateTime(timezone=True), nullable=True)
backend/app/core/security_log.py:6:from datetime import datetime, timezone
backend/app/core/security_log.py:15:        "ts": datetime.now(timezone.utc).isoformat(),
backend/app/api/billing.py:6:from datetime import datetime, timedelta, timezone
backend/app/api/billing.py:134:        return dt.replace(tzinfo=timezone.utc)
backend/app/api/billing.py:135:    return dt.astimezone(timezone.utc)
backend/app/api/billing.py:142:    return datetime.now(timezone.utc) - updated_at >= PENDING_SUBSCRIPTION_TTL
backend/app/api/billing.py:674:        dt = datetime.fromtimestamp(int(dt_value), tz=timezone.utc)
backend/app/api/sharing.py:4:from datetime import datetime, timezone
backend/app/api/sharing.py:75:                | (SharedSession.expires_at > datetime.now(timezone.utc)),
backend/app/api/sharing.py:152:    if share.expires_at and share.expires_at < datetime.now(timezone.utc):
backend/app/core/deps.py:18:async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
backend/app/api/users.py:5:from datetime import datetime, timezone
backend/app/api/users.py:252:    now = datetime.now(timezone.utc).timestamp()
backend/app/api/users.py:299:                key=lambda m: m.created_at or datetime.min.replace(tzinfo=timezone.utc),
backend/app/api/users.py:334:        "exported_at": datetime.now(timezone.utc).isoformat(),
backend/app/api/extractions.py:6:from datetime import datetime, timedelta, timezone
backend/app/api/extractions.py:80:        return dt.replace(tzinfo=timezone.utc)
backend/app/api/extractions.py:81:    return dt.astimezone(timezone.utc)
backend/app/api/extractions.py:142:        window_start = datetime.now(timezone.utc) - timedelta(days=30)
backend/app/api/chat.py:5:from datetime import datetime, timedelta, timezone
backend/app/api/chat.py:70:        return dt.replace(tzinfo=timezone.utc)
backend/app/api/chat.py:71:    return dt.astimezone(timezone.utc)
backend/app/api/chat.py:95:        window_start = datetime.now(timezone.utc) - timedelta(days=30)
backend/app/api/admin.py:8:from datetime import date, datetime, timedelta, timezone
backend/app/api/admin.py:642:        key=lambda row: _row_value(row, "created_at") or datetime.min.replace(tzinfo=timezone.utc),
backend/app/api/admin.py:656:        key=lambda row: _row_value(row, "created_at") or datetime.min.replace(tzinfo=timezone.utc),
backend/app/api/admin.py:870:    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
backend/app/api/admin.py:1006:    now = datetime.now(timezone.utc)
backend/app/api/admin.py:1550:    now = datetime.now(timezone.utc)
backend/app/api/admin.py:1555:        tzinfo=timezone.utc,
backend/app/api/admin.py:1636:    now = datetime.now(timezone.utc)
backend/app/api/admin.py:1939:    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
backend/app/api/admin.py:2168:    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

exec
/bin/zsh -lc "nl -ba backend/app/models/database.py | sed -n '1,80p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	from __future__ import annotations
     2	
     3	import os
     4	from typing import Optional
     5	
     6	from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
     7	from sqlalchemy.pool import NullPool
     8	
     9	from app.core.config import settings
    10	
    11	
    12	def _get_database_url() -> str:
    13	    # Priority: settings.DATABASE_URL -> env DATABASE_URL -> error
    14	    url: Optional[str] = settings.DATABASE_URL or os.getenv("DATABASE_URL")
    15	    if not url:
    16	        raise RuntimeError("DATABASE_URL is not configured")
    17	    return url
    18	
    19	
    20	# Create async engine and sessionmaker (expire_on_commit=False for FastAPI typical usage)
    21	DATABASE_URL = _get_database_url()
    22	engine_kwargs: dict[str, object] = {"pool_pre_ping": True}
    23	
    24	if os.getenv("TESTING") == "1":
    25	    engine_kwargs["poolclass"] = NullPool
    26	else:
    27	    engine_kwargs.update(
    28	        pool_size=10,
    29	        max_overflow=20,
    30	        pool_recycle=1800,
    31	    )
    32	
    33	async_engine: AsyncEngine = create_async_engine(DATABASE_URL, **engine_kwargs)
    34	AsyncSessionLocal = async_sessionmaker(async_engine, expire_on_commit=False)

exec
/bin/zsh -lc "rg -n \"status\\s*=\\s*[\\\"']ocr|status.*ocr|Document\\.status|doc.status|parse_failure|pages_parsed|uploading|parsed|ready|error\" backend/app backend/tests -g '*.py'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
backend/tests/test_document_diffs_api.py:90:def _make_doc(user: SimpleNamespace, *, status: str = "ready", filename: str = "report.pdf") -> SimpleNamespace:
backend/tests/test_document_diffs_api.py:104:        self.error_code = None
backend/tests/test_document_diffs_api.py:105:        self.error_message = None
backend/tests/test_document_diffs_api.py:126:def _assert_error(response, status_code: int, error_code: str) -> dict:
backend/tests/test_document_diffs_api.py:129:    assert detail["error"] == error_code
backend/tests/test_document_diffs_api.py:157:    detail = _assert_error(response, 403, "PLAN_REQUIRED")
backend/tests/test_document_diffs_api.py:173:    _assert_error(response, 400, "DOCUMENT_DIFF_SAME_DOCUMENT")
backend/tests/test_document_diffs_api.py:177:async def test_create_document_diff_requires_ready_documents(client: AsyncClient) -> None:
backend/tests/test_document_diffs_api.py:189:    _assert_error(response, 409, "DOCUMENT_NOT_READY")
backend/tests/test_document_diffs_api.py:240:    _assert_error(response, 400, "DOCUMENT_DIFF_COLLECTION_MISMATCH")
backend/tests/test_document_diffs_api.py:270:        error_code=None,
backend/tests/test_document_diffs_api.py:271:        error_message=None,
backend/app/services/document_brief_service.py:471:        last_error: Exception | None = None
backend/app/services/document_brief_service.py:501:                last_error = exc
backend/app/services/document_brief_service.py:514:        if last_error is not None:
backend/app/services/document_brief_service.py:515:            raise last_error
backend/app/services/document_brief_service.py:984:                    "error_type": type(raw).__name__,
backend/app/services/document_brief_service.py:1464:    parsed: list[uuid.UUID] = []
backend/app/services/document_brief_service.py:1467:            parsed.append(uuid.UUID(str(value)))
backend/app/services/document_brief_service.py:1470:    return tuple(parsed)
backend/app/services/storage_service.py:10:from minio.error import S3Error
backend/app/services/storage_service.py:22:        parsed = urlparse(endpoint)
backend/app/services/storage_service.py:23:        secure = parsed.scheme == "https"
backend/app/services/storage_service.py:24:        host = parsed.netloc
backend/app/services/storage_service.py:85:        """Probe MinIO liveness. Returns True if reachable; raises on error.
backend/tests/test_parse_worker_bridge.py:39:def test_set_doc_error_happy_path() -> None:
backend/tests/test_parse_worker_bridge.py:40:    doc = SimpleNamespace(status="parsing", error_msg=None)
backend/tests/test_parse_worker_bridge.py:42:    parse_worker._set_doc_error(doc, "DOWNLOAD_FAILED", "Failed to download document file")
backend/tests/test_parse_worker_bridge.py:44:    assert doc.status == "error"
backend/tests/test_parse_worker_bridge.py:45:    assert doc.error_msg == "ERR_CODE:DOWNLOAD_FAILED:Failed to download document file"
backend/tests/test_parse_worker_bridge.py:48:def test_set_doc_error_uses_default_human_text() -> None:
backend/tests/test_parse_worker_bridge.py:49:    doc = SimpleNamespace(status="parsing", error_msg=None)
backend/tests/test_parse_worker_bridge.py:51:    parse_worker._set_doc_error(doc, "DOWNLOAD_FAILED")
backend/tests/test_parse_worker_bridge.py:53:    assert doc.status == "error"
backend/tests/test_parse_worker_bridge.py:54:    assert doc.error_msg == "ERR_CODE:DOWNLOAD_FAILED:Failed to download document file"
backend/tests/test_parse_worker_bridge.py:57:def test_set_doc_error_unknown_code_falls_back() -> None:
backend/tests/test_parse_worker_bridge.py:58:    doc = SimpleNamespace(status="parsing", error_msg=None)
backend/tests/test_parse_worker_bridge.py:60:    parse_worker._set_doc_error(doc, "UNKNOWN_CODE")
backend/tests/test_parse_worker_bridge.py:62:    assert doc.status == "error"
backend/tests/test_parse_worker_bridge.py:63:    assert doc.error_msg == "ERR_CODE:UNKNOWN_CODE:Document processing failed"
backend/tests/test_parse_worker_bridge.py:66:def test_set_doc_error_is_idempotent_for_prefixed_input() -> None:
backend/tests/test_parse_worker_bridge.py:67:    doc = SimpleNamespace(status="parsing", error_msg=None)
backend/tests/test_parse_worker_bridge.py:69:    parse_worker._set_doc_error(doc, "A", "foo")
backend/tests/test_parse_worker_bridge.py:70:    parse_worker._set_doc_error(doc, "A", doc.error_msg)
backend/tests/test_parse_worker_bridge.py:72:    assert doc.status == "error"
backend/tests/test_parse_worker_bridge.py:73:    assert doc.error_msg == "ERR_CODE:A:foo"
backend/tests/test_parse_worker_bridge.py:76:def test_set_doc_error_preserves_empty_string_human() -> None:
backend/tests/test_parse_worker_bridge.py:77:    doc = SimpleNamespace(status="parsing", error_msg=None)
backend/tests/test_parse_worker_bridge.py:79:    parse_worker._set_doc_error(doc, "A", "")
backend/tests/test_parse_worker_bridge.py:81:    assert doc.status == "error"
backend/tests/test_parse_worker_bridge.py:82:    assert doc.error_msg == "ERR_CODE:A:"
backend/tests/test_parse_worker_bridge.py:85:def test_set_timeout_error_writes_prefixed_parse_timeout(
backend/tests/test_parse_worker_bridge.py:88:    doc = SimpleNamespace(status="parsing", error_msg=None)
backend/tests/test_parse_worker_bridge.py:92:    parse_worker._set_timeout_error(str(uuid.uuid4()), "timed out at 9m")
backend/tests/test_parse_worker_bridge.py:94:    assert doc.status == "error"
backend/tests/test_parse_worker_bridge.py:95:    assert doc.error_msg == "ERR_CODE:PARSE_TIMEOUT:timed out at 9m"
backend/tests/test_parse_worker_bridge.py:126:        pages_parsed=0,
backend/tests/test_parse_worker_bridge.py:131:        error_msg=None,
backend/app/services/question_template_service.py:164:            not_ready = [doc.filename for doc in ordered_docs if doc.status != "ready"]
backend/app/services/question_template_service.py:165:            if not_ready:
backend/app/services/question_template_service.py:237:            job.error_code = None
backend/app/services/question_template_service.py:238:            job.error_message = None
backend/app/services/question_template_service.py:264:            job.error_code = code[:64]
backend/app/services/question_template_service.py:265:            job.error_message = "Question template run failed"
backend/tests/test_error_taxonomy.py:134:def _assert_error(response, status_code: int, error_code: str) -> dict:
backend/tests/test_error_taxonomy.py:139:    assert detail["error"] == error_code
backend/tests/test_error_taxonomy.py:167:    detail = _assert_error(response, 403, "DOCUMENT_LIMIT_REACHED")
backend/tests/test_error_taxonomy.py:183:    detail = _assert_error(response, 403, "DOCUMENT_LIMIT_REACHED")
backend/tests/test_error_taxonomy.py:199:    detail = _assert_error(response, 400, "FILE_TOO_LARGE")
backend/tests/test_error_taxonomy.py:220:    detail = _assert_error(response, 400, "FILE_TOO_LARGE")
backend/tests/test_error_taxonomy.py:241:    detail = _assert_error(response, 400, "FILE_TOO_LARGE")
backend/tests/test_error_taxonomy.py:255:    _assert_error(response, 400, "UNSUPPORTED_FORMAT")
backend/tests/test_error_taxonomy.py:268:    _assert_error(response, 400, "INVALID_FILE_CONTENT")
backend/tests/test_error_taxonomy.py:272:async def test_upload_storage_unavailable_returns_structured_error(
backend/tests/test_error_taxonomy.py:290:    _assert_error(response, 503, "STORAGE_UNAVAILABLE")
backend/tests/test_error_taxonomy.py:300:    _assert_error(response, 400, "URL_INVALID")
backend/tests/test_error_taxonomy.py:319:    detail = _assert_error(response, 400, "URL_FETCH_BLOCKED")
backend/tests/test_error_taxonomy.py:329:async def test_ingest_url_blocked_fetch_reasons_share_safe_error_copy(
backend/tests/test_error_taxonomy.py:345:    detail = _assert_error(response, 400, "URL_FETCH_BLOCKED")
backend/tests/test_error_taxonomy.py:366:    _assert_error(response, 400, "URL_CONTENT_TOO_LARGE")
backend/tests/test_error_taxonomy.py:385:    _assert_error(response, 400, "NO_TEXT_CONTENT")
backend/tests/test_error_taxonomy.py:404:    _assert_error(response, 400, "URL_FETCH_FAILED")
backend/tests/test_error_taxonomy.py:415:    _assert_error(response, 404, "DOCUMENT_NOT_FOUND")
backend/tests/test_error_taxonomy.py:426:    detail = _assert_error(response, 409, "DOCUMENT_PROCESSING")
backend/tests/test_error_taxonomy.py:448:    _assert_error(response, 502, "STORAGE_UNAVAILABLE")
backend/tests/test_error_taxonomy.py:462:    detail = _assert_error(response, 400, "INSTRUCTIONS_TOO_LONG")
backend/tests/test_error_taxonomy.py:477:    _assert_error(response, 403, "CUSTOM_INSTRUCTIONS_REQUIRE_PRO")
backend/tests/test_error_taxonomy.py:494:    detail = _assert_error(response, 403, "SESSION_LIMIT_REACHED")
backend/tests/test_error_taxonomy.py:514:    detail = _assert_error(response, 429, "DEMO_SESSION_RATE_LIMITED")
backend/tests/test_error_taxonomy.py:533:    detail = _assert_error(response, 429, "DEMO_SESSION_LIMIT_REACHED")
backend/tests/test_error_taxonomy.py:545:    session = SimpleNamespace(document=SimpleNamespace(status="ready", demo_slug=None), document_id=uuid.uuid4())
backend/tests/test_error_taxonomy.py:550:    detail = _assert_error(response, 429, "RATE_LIMITED")
backend/tests/test_error_taxonomy.py:561:    session = SimpleNamespace(document=SimpleNamespace(status="ready", demo_slug="demo"), document_id=uuid.uuid4())
backend/tests/test_error_taxonomy.py:566:    detail = _assert_error(response, 429, "RATE_LIMITED")
backend/tests/test_error_taxonomy.py:577:    session = SimpleNamespace(document=SimpleNamespace(status="ready", demo_slug="demo"), document_id=uuid.uuid4())
backend/tests/test_error_taxonomy.py:587:    detail = _assert_error(response, 429, "DEMO_MESSAGE_LIMIT_REACHED")
backend/tests/test_error_taxonomy.py:599:    session = SimpleNamespace(document=SimpleNamespace(status="ready", demo_slug=None), document_id=uuid.uuid4())
backend/tests/test_error_taxonomy.py:611:    detail = _assert_error(response, 402, "INSUFFICIENT_CREDITS")
backend/tests/test_error_taxonomy.py:630:    session = SimpleNamespace(document=SimpleNamespace(status="ready", demo_slug=None), document_id=uuid.uuid4())
backend/tests/test_error_taxonomy.py:643:    detail = _assert_error(response, 402, "PRO_MODE_LIMIT_REACHED")
backend/tests/test_error_taxonomy.py:657:    session = SimpleNamespace(document=SimpleNamespace(status="ready", demo_slug=None))
backend/tests/test_error_taxonomy.py:665:    detail = _assert_error(response, 400, "CONTINUATION_LIMIT")
backend/tests/test_error_taxonomy.py:676:    _assert_error(response, 404, "SESSION_NOT_FOUND")
backend/tests/test_error_taxonomy.py:684:    session = SimpleNamespace(document=SimpleNamespace(status="ready", demo_slug=None))
backend/tests/test_error_taxonomy.py:692:    _assert_error(response, 404, "MESSAGE_NOT_FOUND")
backend/tests/test_error_taxonomy.py:702:    detail = _assert_error(response, 403, "COLLECTION_LIMIT_REACHED")
backend/tests/test_error_taxonomy.py:737:    detail = _assert_error(response, 403, "COLLECTION_DOC_LIMIT_REACHED")
backend/tests/test_error_taxonomy.py:749:    _assert_error(response, 404, "COLLECTION_NOT_FOUND")
backend/tests/test_error_taxonomy.py:764:    detail = _assert_error(response, 403, "EXPORT_REQUIRES_PAID_PLAN")
backend/tests/test_error_taxonomy.py:786:    detail = _assert_error(response, 400, "EXPORT_VALIDATION_FAILED")
backend/tests/test_error_taxonomy.py:807:    _assert_error(response, 500, "EXPORT_RENDERER_FAILED")
backend/tests/test_error_taxonomy.py:830:    detail = _assert_error(response, 403, "SHARE_LIMIT_REACHED")
backend/tests/test_error_taxonomy.py:846:    _assert_error(response, 410, "SHARE_EXPIRED")
backend/tests/test_error_taxonomy.py:856:    _assert_error(response, 404, "SHARE_NOT_FOUND")
backend/tests/test_error_taxonomy.py:866:    _assert_error(response, 404, "CHUNK_NOT_FOUND")
backend/tests/test_error_taxonomy.py:888:    _assert_error(response, 502, "STRIPE_UNAVAILABLE")
backend/tests/test_error_taxonomy.py:915:    _assert_error(response, 502, "STRIPE_UNAVAILABLE")
backend/tests/test_error_taxonomy.py:962:    detail = _assert_error(response, 429, "RATE_LIMITED")
backend/tests/test_error_taxonomy.py:974:    detail = _assert_error(response, 429, "RATE_LIMITED")
backend/tests/test_error_taxonomy.py:996:async def test_upload_unknown_valueerror_returns_server_error(
backend/tests/test_error_taxonomy.py:1013:    _assert_error(response, 500, "SERVER_ERROR")
backend/app/services/demo_seed.py:55:        parsed = urlparse(endpoint)
backend/app/services/demo_seed.py:56:        secure = parsed.scheme == "https"
backend/app/services/demo_seed.py:57:        host = parsed.netloc
backend/app/services/demo_seed.py:73:                # Check if already exists
backend/app/services/demo_seed.py:80:                    if existing.status == "ready":
backend/app/services/demo_seed.py:83:                        # the vectors and files may be gone despite DB saying "ready".
backend/app/services/demo_seed.py:110:                            logger.info("Demo doc '%s' already ready, skipping", slug)
backend/app/services/demo_seed.py:117:                    if existing.status == "error":
backend/app/services/demo_seed.py:118:                        logger.info("Demo doc '%s' in error state, re-seeding", slug)
backend/tests/test_document_brief_generation.py:98:    assert brief.error_code is None
backend/tests/test_document_brief_generation.py:167:def test_generate_document_brief_bad_json_records_error_without_status_change(monkeypatch) -> None:
backend/tests/test_document_brief_generation.py:170:        status="ready",
backend/tests/test_document_brief_generation.py:181:    assert doc.status == "ready"
backend/tests/test_document_brief_generation.py:183:    assert fake_db.added[-1].error_code == "BRIEF_JSON_INVALID"
backend/tests/test_document_brief_generation.py:186:def test_generate_document_brief_records_error_when_llm_unavailable(monkeypatch) -> None:
backend/tests/test_document_brief_generation.py:189:        status="ready",
backend/tests/test_document_brief_generation.py:200:    assert doc.status == "ready"
backend/tests/test_document_brief_generation.py:202:    assert fake_db.added[-1].error_code == "BRIEF_LLM_UNAVAILABLE"
backend/tests/test_document_brief_generation.py:208:        status="ready",
backend/app/services/extractors/url_extractor.py:87:def _build_host_header(parsed: urlparse, resolved_ip: str) -> str:
backend/app/services/extractors/url_extractor.py:92:    hostname = parsed.hostname or ""
backend/app/services/extractors/url_extractor.py:101:    port = parsed.port
backend/app/services/extractors/url_extractor.py:102:    default_port = 443 if parsed.scheme == "https" else 80
backend/app/services/extractors/url_extractor.py:121:        parsed = urlparse(current_url)
backend/app/services/extractors/url_extractor.py:123:        host_header = _build_host_header(parsed, resolved_ip)
backend/app/services/extractors/url_extractor.py:135:                    {"sni_hostname": parsed.hostname}
backend/app/services/extractors/url_extractor.py:136:                    if parsed.scheme == "https"
backend/app/services/extractors/url_extractor.py:355:    html = response_body.decode(encoding, errors="replace")
backend/tests/test_billing_state.py:148:async def test_already_cancel_at_period_end_disables_cancel(monkeypatch):
backend/tests/test_billing_state.py:182:    assert state["can_cancel"] is False  # already canceled on Stripe side
backend/tests/test_billing_state.py:239:async def test_stripe_error_degrades_gracefully(monkeypatch):
backend/app/services/extractors/text_extractor.py:13:    text = file_bytes.decode('utf-8', errors='replace')
backend/tests/test_chat_tool_executor.py:27:    return SimpleNamespace(id=uuid.uuid4(), user_id=user.id, status="ready", demo_slug=None, filename="report.pdf")
backend/app/services/table_service.py:268:    error_code: str | None = None,
backend/app/services/table_service.py:269:    error_message: str | None = None,
backend/app/services/table_service.py:275:    run.error_code = error_code
backend/app/services/table_service.py:276:    run.error_message = error_message
backend/app/services/table_service.py:310:            error_code=exc.code[:64],
backend/app/services/table_service.py:311:            error_message=exc.message,
backend/app/services/table_service.py:447:        parsed_pages = []
backend/app/services/table_service.py:450:                parsed_pages.append(int(item))
backend/app/services/table_service.py:453:        if parsed_pages:
backend/app/services/table_service.py:454:            page = min(page, min(parsed_pages))
backend/app/services/table_service.py:455:            page_end = max(page_end, max(parsed_pages))
backend/app/services/table_service.py:852:            if not doc or doc.status != "ready":
backend/app/services/table_service.py:877:            job.error_code = code[:64]
backend/app/services/table_service.py:878:            job.error_message = "Table scan failed"
backend/app/services/table_service.py:900:            if not doc or doc.status != "ready":
backend/app/services/table_service.py:934:            job.error_code = code[:64]
backend/app/services/table_service.py:935:            job.error_message = "AI table reconstruction failed"
backend/app/services/summary_service.py:279:    brief.error_code = None
backend/app/services/summary_service.py:280:    brief.error_message = None
backend/app/services/summary_service.py:287:def _persist_brief_error(
backend/app/services/summary_service.py:308:    brief.error_code = code
backend/app/services/summary_service.py:309:    brief.error_message = message[:2000]
backend/app/services/summary_service.py:343:            _persist_brief_error(
backend/app/services/summary_service.py:361:            _persist_brief_error(
backend/app/services/summary_service.py:373:            _persist_brief_error(
backend/app/services/summary_service.py:402:            if doc.status != "ready" or not _selected_chunks_still_current(db, doc, selected_chunks):
backend/app/services/summary_service.py:422:            _persist_brief_error(db, doc, code="BRIEF_JSON_INVALID", message=str(exc), model=BRIEF_MODEL)
backend/app/services/summary_service.py:425:            _persist_brief_error(db, doc, code="BRIEF_GENERATION_FAILED", message=str(exc), model=BRIEF_MODEL)
backend/tests/test_admin_churn.py:45:        "parse_failure": {"u5", owner_id},
backend/tests/test_admin_churn.py:113:    assert signals["parse_failure"]["count"] == 1
backend/app/services/doc_service.py:143:            logger.error("MinIO deletion failed for doc %s: %s", document_id, e)
backend/app/services/doc_service.py:151:                logger.error("MinIO deletion of converted PDF failed for doc %s: %s", document_id, e)
backend/app/services/doc_service.py:170:            logger.error("Qdrant deletion failed for doc %s: %s", document_id, e)
backend/app/services/doc_service.py:195:                logger.error("Failed to queue deletion retry for doc %s", document_id)
backend/tests/test_question_templates_api.py:97:def _make_doc(user: SimpleNamespace, *, status: str = "ready", filename: str = "report.pdf") -> SimpleNamespace:
backend/tests/test_question_templates_api.py:124:        self.error_code = None
backend/tests/test_question_templates_api.py:125:        self.error_message = None
backend/tests/test_question_templates_api.py:146:def _assert_error(response, status_code: int, error_code: str) -> dict:
backend/tests/test_question_templates_api.py:149:    assert detail["error"] == error_code
backend/tests/test_question_templates_api.py:197:    detail = _assert_error(response, 403, "PLAN_REQUIRED")
backend/tests/test_question_templates_api.py:241:    detail = _assert_error(response, 403, "PLAN_REQUIRED")
backend/tests/test_question_templates_api.py:246:async def test_collection_template_run_requires_ready_documents(client: AsyncClient) -> None:
backend/tests/test_question_templates_api.py:259:    _assert_error(response, 409, "DOCUMENT_NOT_READY")
backend/tests/test_tables_api.py:36:def _make_doc(user: SimpleNamespace, *, status: str = "ready") -> SimpleNamespace:
backend/tests/test_tables_api.py:76:def _assert_error(response, status_code: int, error_code: str) -> dict:
backend/tests/test_tables_api.py:79:    assert detail["error"] == error_code
backend/tests/test_tables_api.py:97:async def test_scan_tables_requires_ready_document(client: AsyncClient) -> None:
backend/tests/test_tables_api.py:105:    _assert_error(response, 409, "DOCUMENT_NOT_READY")
backend/tests/test_tables_api.py:116:    _assert_error(response, 403, "PLAN_REQUIRED")
backend/tests/test_tables_api.py:127:    _assert_error(response, 403, "PLAN_REQUIRED")
backend/tests/test_tables_api.py:314:        error_code=None,
backend/tests/test_tables_api.py:315:        error_message=None,
backend/app/services/export_service.py:27:    upstream callers (export.py) are expected to default None already.
backend/app/services/document_diff_service.py:384:            if not old_doc or not new_doc or old_doc.status != "ready" or new_doc.status != "ready":
backend/app/services/document_diff_service.py:440:            job.error_code = None
backend/app/services/document_diff_service.py:441:            job.error_message = None
backend/app/services/document_diff_service.py:467:            job.error_code = code[:64]
backend/app/services/document_diff_service.py:468:            job.error_message = "Document comparison failed"
backend/tests/test_chat_setup_refunds.py:257:    assert events[-1]["event"] == "error"
backend/tests/test_chat_setup_refunds.py:263:async def test_chat_stream_returns_sse_error_when_llm_client_unavailable(
backend/tests/test_chat_setup_refunds.py:308:    assert events[-1]["event"] == "error"
backend/tests/test_chat_setup_refunds.py:359:    assert events[-1]["event"] == "error"
backend/tests/test_chat_setup_refunds.py:418:    assert events[-1]["event"] == "error"
backend/app/services/chat_service.py:80:    """Log detailed error server-side, return sanitized SSE payload to client."""
backend/app/services/chat_service.py:82:    return sse(event, {"code": code, "message": _USER_SAFE_ERRORS.get(code, "An error occurred.")})
backend/app/services/chat_service.py:144:        "Continue the existing assistant answer in the same language and style already used."
backend/app/services/chat_service.py:478:        metadata["repair_error"] = "repair_failed"
backend/app/services/chat_service.py:597:    if the pre-debit ledger row still exists (i.e., not already refunded or
backend/app/services/chat_service.py:993:            yield _safe_sse("error", "CHAT_SETUP_ERROR", exc, session_id=str(session_id))
backend/app/services/chat_service.py:1023:            yield sse("error", {"code": "SESSION_NOT_FOUND", "message": "会话不存在"})
backend/app/services/chat_service.py:1064:                    "error",
backend/app/services/chat_service.py:1116:                    "error",
backend/app/services/chat_service.py:1127:        setup_error_code = "CHAT_SETUP_ERROR"
backend/app/services/chat_service.py:1153:            # 4) Route + retrieval (with error handling — e.g. Qdrant down or no vectors yet).
backend/app/services/chat_service.py:1158:            setup_error_code = "RETRIEVAL_ERROR"
backend/app/services/chat_service.py:1234:            setup_error_code = "CHAT_SETUP_ERROR"
backend/app/services/chat_service.py:1329:                    + "2. Do NOT say the user's ready document is not a complete document merely because the context is excerpted.\n"
backend/app/services/chat_service.py:1410:            yield _safe_sse("error", setup_error_code, e, session_id=str(session_id))
backend/app/services/chat_service.py:1426:            yield _safe_sse("error", "LLM_ERROR", e, session_id=str(session_id))
backend/app/services/chat_service.py:1559:                            "Failed to refund pre-debited credits after LLM error for user %s",
backend/app/services/chat_service.py:1562:                yield _safe_sse("error", "LLM_ERROR", e, session_id=str(session_id))
backend/app/services/chat_service.py:1596:                yield sse("error", {"code": "PERSIST_FAILED", "message": "Failed to save response"})
backend/app/services/chat_service.py:1665:                yield sse("error", {"code": "PERSIST_FAILED", "message": "Failed to save response"})
backend/app/services/chat_service.py:1723:                    # Non-fatal accounting error
backend/app/services/chat_service.py:1758:                        "Failed to persist partial assistant response on cancel/error for session %s",
backend/app/services/chat_service.py:1785:                        "Failed to settle pre-debit on cancel/error for user %s",
backend/app/services/chat_service.py:1804:            yield sse("error", {"code": "SESSION_NOT_FOUND", "message": "Session not found"})
backend/app/services/chat_service.py:1842:            yield sse("error", {"code": "MESSAGE_NOT_FOUND", "message": "Assistant message not found"})
backend/app/services/chat_service.py:1846:            yield sse("error", {"code": "MESSAGE_NOT_FOUND", "message": "Message does not belong to this session"})
backend/app/services/chat_service.py:1851:            yield sse("error", {"code": "CONTINUATION_LIMIT", "message": "Maximum continuations reached"})
backend/app/services/chat_service.py:1866:                    "error",
backend/app/services/chat_service.py:1889:                yield sse("error", {
backend/app/services/chat_service.py:2064:            yield _safe_sse("error", "CHAT_SETUP_ERROR", e, session_id=str(session_id))
backend/app/services/chat_service.py:2080:            yield _safe_sse("error", "LLM_ERROR", e, session_id=str(session_id))
backend/app/services/chat_service.py:2183:                            "Failed to refund pre-debited credits after continuation LLM error for user %s",
backend/app/services/chat_service.py:2186:                yield _safe_sse("error", "LLM_ERROR", e, session_id=str(session_id))
backend/app/services/chat_service.py:2217:                yield sse("error", {"code": "PERSIST_FAILED", "message": "Failed to save continuation"})
backend/app/services/chat_service.py:2282:                yield sse("error", {"code": "PERSIST_FAILED", "message": "Failed to save continuation"})
backend/app/services/chat_service.py:2350:                        "Failed to persist continuation partial response on cancel/error for message %s",
backend/app/services/chat_service.py:2377:                        "Failed to settle continuation pre-debit on cancel/error for user %s",
backend/tests/test_storage_service.py:54:def test_upload_file_wraps_storage_transport_errors(monkeypatch: pytest.MonkeyPatch) -> None:
backend/app/services/conversion_service.py:64:            stderr = result.stderr.decode("utf-8", errors="replace")[:500]
backend/tests/test_billing_cancel.py:3:Covers branches D (already free), E (pending sentinel), A (active /
backend/tests/test_billing_cancel.py:6:Stripe error behaviour.
backend/tests/test_billing_cancel.py:69:# -------------------- Branch D: already free --------------------
backend/tests/test_billing_cancel.py:73:async def test_branch_d_already_free_raises_400(fake_db, monkeypatch):
backend/tests/test_billing_cancel.py:180:async def test_branch_a_already_canceled_syncs_local(fake_db, monkeypatch):
backend/tests/test_billing_cancel.py:195:    assert fake_db._added[0].metadata_json["reason"] == "stripe_already_canceled_sync"
backend/tests/test_billing_cancel.py:211:async def test_branch_a_stripe_retrieve_error_fails_closed(fake_db, monkeypatch):
backend/tests/test_billing_cancel.py:226:async def test_branch_a_stripe_modify_error_fails_closed(fake_db, monkeypatch):
backend/tests/test_billing_cancel.py:354:async def test_branch_c_stripe_list_error_fails_closed(fake_db, monkeypatch):
backend/tests/test_billing_cancel.py:369:async def test_branch_c_auto_heal_stripe_modify_error_fails_closed(fake_db, monkeypatch):
backend/tests/test_billing_cancel.py:422:    """Race: another request already set plan=free before we locked."""
backend/tests/test_billing_cancel.py:426:    # After lock, db sees user.plan already changed to "free"
backend/tests/test_extractions_api.py:42:def _make_doc(user: SimpleNamespace, *, status: str = "ready") -> SimpleNamespace:
backend/tests/test_extractions_api.py:71:        self.error_code = None
backend/tests/test_extractions_api.py:72:        self.error_message = None
backend/tests/test_extractions_api.py:93:def _assert_error(response, status_code: int, error_code: str) -> dict:
backend/tests/test_extractions_api.py:98:    assert detail["error"] == error_code
backend/tests/test_extractions_api.py:117:async def test_create_extraction_requires_ready_document(client: AsyncClient) -> None:
backend/tests/test_extractions_api.py:128:    _assert_error(response, 409, "DOCUMENT_NOT_READY")
backend/tests/test_extractions_api.py:146:    detail = _assert_error(response, 403, "EXTRACTION_LIMIT_REACHED")
backend/tests/test_extractions_api.py:167:    detail = _assert_error(response, 402, "INSUFFICIENT_CREDITS")
backend/tests/test_ocr_languages_baseline.py:3:Scanned/non-Latin PDFs parsed to garbage because Tesseract only had eng+chi_sim
backend/app/services/extraction_service.py:536:            if not doc or doc.status != "ready":
backend/app/services/extraction_service.py:570:            job.error_code = None
backend/app/services/extraction_service.py:571:            job.error_message = None
backend/app/services/extraction_service.py:597:            job.error_code = code[:64]
backend/app/services/extraction_service.py:598:            job.error_message = "Structured extraction failed"
backend/tests/conftest.py:22:# Use asyncpg driver (present in requirements) to avoid missing driver errors.
backend/tests/test_document_intelligence.py:94:    assert db.added[0].error_code == "AZURE_TIMEOUT"
backend/tests/test_document_briefs_api.py:69:        status="ready",
backend/tests/test_document_briefs_api.py:83:        error_code=None,
backend/tests/test_document_briefs_api.py:84:        error_message=None,
backend/tests/test_document_briefs_api.py:110:    assert body["status"] == "ready"
backend/tests/test_document_briefs_api.py:129:        status="ready",
backend/tests/test_document_briefs_api.py:152:        status="ready",
backend/tests/test_document_briefs_api.py:166:        error_code=None,
backend/tests/test_document_briefs_api.py:167:        error_message=None,
backend/tests/test_document_briefs_api.py:184:    assert body["status"] == "ready"
backend/app/services/parse_service.py:433:        """Build a canonical reading-order element stream from parsed pages.
backend/tests/test_asst0_cancellation_baseline.py:472:async def test_chat_stream_llm_error_after_partial_answer_does_not_full_refund(monkeypatch):
backend/tests/test_asst0_cancellation_baseline.py:527:    assert events[-1]["event"] == "error"
backend/tests/test_asst0_cancellation_baseline.py:535:async def test_continue_stream_llm_error_after_partial_answer_does_not_full_refund(monkeypatch):
backend/tests/test_asst0_cancellation_baseline.py:610:    assert events[-1]["event"] == "error"
backend/tests/test_asst0_cancellation_baseline.py:691:    assert events[-1]["event"] == "error"
backend/tests/test_asst0_cancellation_baseline.py:775:    assert events[-1]["event"] == "error"
backend/tests/test_asst0_cancellation_baseline.py:783:async def test_chat_stream_accounting_error_still_runs_fallback_settlement(monkeypatch):
backend/tests/test_asst0_cancellation_baseline.py:861:async def test_continue_stream_accounting_error_still_runs_fallback_settlement(monkeypatch):
backend/app/services/auth_service.py:34:        IntegrityError: If user with this email already exists.
backend/app/services/auth_service.py:36:    # Check if user already exists
backend/app/services/auth_service.py:43:            orig=Exception(f"User with email {email} already exists"),
backend/app/services/chat_tool_executor.py:205:        job.error_code = "EXTRACTION_QUEUE_FAILED"
backend/app/services/chat_tool_executor.py:206:        job.error_message = "Failed to queue extraction"
backend/app/services/chat_tool_executor.py:245:            en=f"I started {template.title}. I will keep the result here with citations when it is ready.",
backend/app/services/chat_tool_executor.py:358:            job.error_code = "TABLE_SCAN_QUEUE_FAILED"
backend/app/services/chat_tool_executor.py:359:            job.error_message = "Failed to queue table scan"
backend/app/services/chat_tool_executor.py:434:                    message="Document comparison from chat is ready to route, but I need the selected old/new document ids confirmed before spending Pro credits.",
backend/app/services/chat_tool_executor.py:460:        if doc.status != "ready":
backend/app/services/chat_tool_executor.py:462:                message="The document is still processing. Try again when it is ready.",
backend/tests/test_export_service.py:232:    """Very long title should still produce valid header (upstream already caps at 100)."""
backend/tests/test_document_jobs_api.py:75:        error_code=None,
backend/tests/test_document_jobs_api.py:76:        error_message=None,
backend/app/main.py:67:        """Log an error with traceback and send to Sentry if configured."""
backend/app/main.py:68:        logger.error("%s: %s", context, exc, exc_info=True)
backend/app/main.py:76:    def _is_already_exists(exc: Exception) -> bool:
backend/app/main.py:77:        """Detect Qdrant 409 Conflict (index/collection already exists).
backend/app/main.py:92:            logger.info("MinIO bucket ready")
backend/app/main.py:97:            logger.info("Qdrant collection ready")
backend/app/main.py:105:                logger.info("Qdrant payload index ready for field=document_id")
backend/app/main.py:107:                # 409 = already exists (expected on restart, not actionable).
backend/app/main.py:109:                if _is_already_exists(e):
backend/app/main.py:110:                    logger.info("Qdrant payload index already exists (skipping)")
backend/app/main.py:127:                    select(Document).where(Document.status.in_(["parsing", "ocr", "embedding"]))
backend/app/main.py:266:            logger.warning("Health check %s error: %s", name, result)
backend/app/main.py:267:            components[name] = {"status": "error"}
backend/app/schemas/document.py:23:    pages_parsed: int
backend/app/schemas/document.py:28:    error_msg: Optional[str] = None
backend/app/schemas/document.py:83:    error_code: Optional[str] = None
backend/app/schemas/document.py:84:    error_message: Optional[str] = None
backend/app/workers/cleanup_tasks.py:26:        logger.error("DATABASE_URL not configured, skipping token cleanup")
backend/app/core/url_validator.py:66:    parsed = urlparse(url)
backend/app/core/url_validator.py:69:    if parsed.scheme not in ("http", "https"):
backend/app/core/url_validator.py:73:    hostname = parsed.hostname
backend/app/core/url_validator.py:77:    port = parsed.port
backend/app/core/url_validator.py:78:    default_port = 443 if parsed.scheme == "https" else 80
backend/app/core/url_validator.py:83:    except socket.gaierror:
backend/tests/test_migrations.py:7:- Syntax errors in downgrade SQL
backend/app/api/document_diffs.py:59:    error_code: str | None
backend/app/api/document_diffs.py:60:    error_message: str | None
backend/app/api/document_diffs.py:78:    # Use only values already loaded by selectinload or explicitly assigned.
backend/app/api/document_diffs.py:101:        error_code=job.error_code,
backend/app/api/document_diffs.py:102:        error_message=job.error_message,
backend/app/api/document_diffs.py:116:            "error": "PLAN_REQUIRED",
backend/app/api/document_diffs.py:123:async def _get_owned_ready_document(document_id: uuid.UUID, user: User, db: AsyncSession) -> Document:
backend/app/api/document_diffs.py:128:            detail={"error": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
backend/app/api/document_diffs.py:130:    if doc.status != "ready":
backend/app/api/document_diffs.py:133:            detail={"error": "DOCUMENT_NOT_READY", "message": "Document is not ready"},
backend/app/api/document_diffs.py:149:            detail={"error": "COLLECTION_NOT_FOUND", "message": "Collection not found"},
backend/app/api/document_diffs.py:160:                "error": "DOCUMENT_DIFF_COLLECTION_MISMATCH",
backend/app/api/document_diffs.py:207:                "error": "INSUFFICIENT_CREDITS",
backend/app/api/document_diffs.py:240:        job.error_code = "DOCUMENT_DIFF_QUEUE_FAILED"
backend/app/api/document_diffs.py:241:        job.error_message = "Failed to queue document comparison"
backend/app/api/document_diffs.py:252:            detail={"error": "DOCUMENT_DIFF_QUEUE_FAILED", "message": "Failed to queue document comparison"},
backend/app/api/document_diffs.py:274:            detail={"error": "DOCUMENT_DIFF_SAME_DOCUMENT", "message": "Choose two different documents"},
backend/app/api/document_diffs.py:276:    old_doc = await _get_owned_ready_document(body.old_document_id, user, db)
backend/app/api/document_diffs.py:277:    new_doc = await _get_owned_ready_document(body.new_document_id, user, db)
backend/app/api/document_diffs.py:330:            detail={"error": "DOCUMENT_DIFF_NOT_FOUND", "message": "Document comparison not found"},
backend/app/api/document_diffs.py:354:            detail={"error": "DOCUMENT_DIFF_NOT_FOUND", "message": "Document comparison not found"},
backend/app/core/rate_limit.py:33:    """Log Redis fallback at error level and send to Sentry if configured.
backend/app/core/rate_limit.py:40:    logger.error(
backend/app/core/rate_limit.py:129:    async def _reset_client(self, error: Exception) -> None:
backend/app/core/rate_limit.py:130:        _alert_redis_fallback(self._namespace, error)
backend/app/core/cache.py:50:async def _reset_client(error: Exception) -> None:
backend/app/core/cache.py:54:    logger.warning("Redis cache error; falling back to uncached path: %s", error)
backend/app/models/database.py:13:    # Priority: settings.DATABASE_URL -> env DATABASE_URL -> error
backend/app/models/tables.py:27:    status: Mapped[str] = mapped_column(sa.String(20), nullable=False, server_default=sa.text("'uploading'"))
backend/app/models/tables.py:28:    error_msg: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
backend/app/models/tables.py:30:    pages_parsed: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))
backend/app/models/tables.py:551:    error_code: Mapped[Optional[str]] = mapped_column(sa.String(64), nullable=True)
backend/app/models/tables.py:552:    error_message: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
backend/app/models/tables.py:648:    error_code: Mapped[Optional[str]] = mapped_column(sa.String(64), nullable=True)
backend/app/models/tables.py:649:    error_message: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
backend/app/models/tables.py:710:    error_code: Mapped[Optional[str]] = mapped_column(sa.String(64), nullable=True)
backend/app/models/tables.py:711:    error_message: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
backend/app/api/chunks.py:31:                    "error": "RATE_LIMITED",
backend/app/api/chunks.py:42:            detail={"error": "CHUNK_NOT_FOUND", "message": "Chunk not found"},
backend/app/api/chunks.py:50:            detail={"error": "CHUNK_NOT_FOUND", "message": "Chunk not found"},
backend/app/api/chunks.py:56:            detail={"error": "CHUNK_NOT_FOUND", "message": "Chunk not found"},
backend/app/api/question_templates.py:77:    error_code: str | None
backend/app/api/question_templates.py:78:    error_message: str | None
backend/app/api/question_templates.py:107:    # Use only values already loaded by selectinload or explicitly assigned.
backend/app/api/question_templates.py:130:        error_code=job.error_code,
backend/app/api/question_templates.py:131:        error_message=job.error_message,
backend/app/api/question_templates.py:146:            "error": "PLAN_REQUIRED",
backend/app/api/question_templates.py:165:            detail={"error": "QUESTION_TEMPLATE_NOT_FOUND", "message": "Question template not found"},
backend/app/api/question_templates.py:175:    require_ready: bool = False,
backend/app/api/question_templates.py:181:            detail={"error": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
backend/app/api/question_templates.py:183:    if require_ready and doc.status != "ready":
backend/app/api/question_templates.py:186:            detail={"error": "DOCUMENT_NOT_READY", "message": "Document is not ready"},
backend/app/api/question_templates.py:196:    require_ready: bool = False,
backend/app/api/question_templates.py:208:            detail={"error": "COLLECTION_NOT_FOUND", "message": "Collection not found"},
backend/app/api/question_templates.py:210:    if not require_ready:
backend/app/api/question_templates.py:215:            detail={"error": "COLLECTION_EMPTY", "message": "Collection has no documents"},
backend/app/api/question_templates.py:221:                "error": "QUESTION_TEMPLATE_TOO_MANY_DOCUMENTS",
backend/app/api/question_templates.py:226:    not_ready = [doc.filename for doc in collection.documents if doc.status != "ready"]
backend/app/api/question_templates.py:227:    if not_ready:
backend/app/api/question_templates.py:230:            detail={"error": "DOCUMENT_NOT_READY", "message": "All collection documents must be ready"},
backend/app/api/question_templates.py:249:            detail={"error": "QUESTION_TEMPLATE_EMPTY", "message": "Question template has no questions"},
backend/app/api/question_templates.py:285:                "error": "INSUFFICIENT_CREDITS",
backend/app/api/question_templates.py:318:        job.error_code = "QUESTION_TEMPLATE_QUEUE_FAILED"
backend/app/api/question_templates.py:319:        job.error_message = "Failed to queue question template run"
backend/app/api/question_templates.py:330:            detail={"error": "QUESTION_TEMPLATE_QUEUE_FAILED", "message": "Failed to queue question template run"},
backend/app/api/question_templates.py:365:            detail={"error": "QUESTION_TEMPLATE_EMPTY", "message": "Question template must include at least one question"},
backend/app/api/question_templates.py:391:            detail={"error": "QUESTION_TEMPLATE_EMPTY", "message": "Question template must include at least one question"},
backend/app/api/question_templates.py:426:    doc = await _verify_document(document_id, user, db, require_ready=True)
backend/app/api/question_templates.py:470:    collection = await _verify_collection(collection_id, user, db, require_ready=True)
backend/app/api/question_templates.py:520:            detail={"error": "QUESTION_TEMPLATE_RUN_NOT_FOUND", "message": "Question template run not found"},
backend/app/api/question_templates.py:544:            detail={"error": "QUESTION_TEMPLATE_RUN_NOT_FOUND", "message": "Question template run not found"},
backend/app/schemas/admin.py:68:    doc_status: list[AdminDocStatusItem]
backend/app/workers/parse_worker.py:42:def _set_doc_error(doc, code: str, human: str | None = None) -> None:
backend/app/workers/parse_worker.py:43:    """Mark a Document as errored with a structured ERR_CODE prefix.
backend/app/workers/parse_worker.py:46:        doc.error_msg = "ERR_CODE:<CODE>:<human text>"
backend/app/workers/parse_worker.py:47:    Idempotent: repeated calls on an already-prefixed message do NOT stack
backend/app/workers/parse_worker.py:54:    doc.status = "error"
backend/app/workers/parse_worker.py:55:    doc.error_msg = payload
backend/app/workers/parse_worker.py:65:        parsed = urlparse(endpoint)
backend/app/workers/parse_worker.py:66:        secure = parsed.scheme == "https"
backend/app/workers/parse_worker.py:67:        host = parsed.netloc
backend/app/workers/parse_worker.py:85:def _set_timeout_error(document_id: str, message: str) -> None:
backend/app/workers/parse_worker.py:97:        _set_doc_error(doc, "PARSE_TIMEOUT", message)
backend/app/workers/parse_worker.py:135:                logger.error("Document %s not found", document_id)
backend/app/workers/parse_worker.py:145:            doc.pages_parsed = 0
backend/app/workers/parse_worker.py:150:            doc.status = "parsing"
backend/app/workers/parse_worker.py:162:                _set_doc_error(doc, "DOWNLOAD_FAILED", "Failed to download document file")
backend/app/workers/parse_worker.py:182:                    _set_doc_error(doc, "EXTRACTION_FAILED", f"Failed to extract {file_type.upper()} content")
backend/app/workers/parse_worker.py:235:                    _set_doc_error(doc, "PDF_PARSE_FAILED", "PDF parsing failed, file may be corrupted")
backend/app/workers/parse_worker.py:247:                        _set_doc_error(
backend/app/workers/parse_worker.py:254:                        logger.info("Document %s marked as scanned / error (OCR disabled)", document_id)
backend/app/workers/parse_worker.py:258:                    doc.status = "ocr"
backend/app/workers/parse_worker.py:272:                        _set_doc_error(doc, "OCR_FAILED", "OCR text recognition failed")
backend/app/workers/parse_worker.py:280:                        _set_doc_error(doc, "OCR_INSUFFICIENT_TEXT", "OCR could not extract sufficient text")
backend/app/workers/parse_worker.py:287:                    doc.status = "parsing"
backend/app/workers/parse_worker.py:325:                        doc.pages_parsed = i
backend/app/workers/parse_worker.py:335:                    _set_doc_error(doc, "PERSIST_PAGES_FAILED", "Failed to save document pages to database")
backend/app/workers/parse_worker.py:364:                    _set_doc_error(doc, "PERSIST_ELEMENTS_FAILED", "Failed to save document structure to database")
backend/app/workers/parse_worker.py:376:                _set_doc_error(doc, "CHUNKING_FAILED", "Document chunking failed")
backend/app/workers/parse_worker.py:409:                    _set_doc_error(doc, "PERSIST_CHUNKS_FAILED", "Failed to save document chunks to database")
backend/app/workers/parse_worker.py:430:                    _set_doc_error(doc, "NO_CHUNKS", "No text content could be extracted from the document")
backend/app/workers/parse_worker.py:433:                    logger.warning("No chunks to embed for %s; marked error", document_id)
backend/app/workers/parse_worker.py:436:                doc.status = "embedding"
backend/app/workers/parse_worker.py:484:                doc.status = "ready"
backend/app/workers/parse_worker.py:496:                _set_doc_error(doc, "VECTORIZE_FAILED", "Vectorization or indexing failed")
backend/app/workers/parse_worker.py:502:        _set_timeout_error(document_id, timeout_message)
backend/app/core/deps.py:37:            logger.error("AUTH_SECRET not configured")
backend/app/core/deps.py:60:        log_security_event("auth_failure", reason="claims_error", detail=str(e))
backend/app/core/deps.py:63:        log_security_event("auth_failure", reason="decode_error", detail=str(e))
backend/app/api/tables.py:36:    error_code: str | None
backend/app/api/tables.py:37:    error_message: str | None
backend/app/api/tables.py:77:        error_code=job.error_code,
backend/app/api/tables.py:78:        error_message=job.error_message,
backend/app/api/tables.py:116:            detail={"error": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
backend/app/api/tables.py:132:    if doc.status != "ready":
backend/app/api/tables.py:135:            detail={"error": "DOCUMENT_NOT_READY", "message": "Document is not ready"},
backend/app/api/tables.py:177:        job.error_code = "TABLE_SCAN_QUEUE_FAILED"
backend/app/api/tables.py:178:        job.error_message = "Failed to queue table scan"
backend/app/api/tables.py:182:            detail={"error": "TABLE_SCAN_QUEUE_FAILED", "message": "Failed to queue table scan"},
backend/app/api/tables.py:201:                "error": "PLAN_REQUIRED",
backend/app/api/tables.py:210:            detail={"error": "TABLE_NOT_FOUND", "message": "Table not found"},
backend/app/api/tables.py:213:    if doc.status != "ready":
backend/app/api/tables.py:216:            detail={"error": "DOCUMENT_NOT_READY", "message": "Document is not ready"},
backend/app/api/tables.py:258:        job.error_code = "TABLE_RECONSTRUCTION_QUEUE_FAILED"
backend/app/api/tables.py:259:        job.error_message = "Failed to queue table reconstruction"
backend/app/api/tables.py:264:                "error": "TABLE_RECONSTRUCTION_QUEUE_FAILED",
backend/app/api/tables.py:295:            detail={"error": "PLAN_REQUIRED", "message": "CSV export requires Plus", "required_plan": "plus"},
backend/app/api/tables.py:336:            detail={"error": "TABLE_SCAN_NOT_FOUND", "message": "Table scan not found"},
backend/app/api/tables.py:350:            detail={"error": "PLAN_REQUIRED", "message": "CSV export requires Plus", "required_plan": "plus"},
backend/app/api/tables.py:356:            detail={"error": "TABLE_NOT_FOUND", "message": "Table not found"},
backend/app/api/document_jobs.py:40:    error_code: str | None
backend/app/api/document_jobs.py:41:    error_message: str | None
backend/app/api/document_jobs.py:85:        warning = job.error_message or job_metadata.get("fallback_warning")
backend/app/api/document_jobs.py:143:        summary=job.error_message or ("Ready." if job.status == "succeeded" else "Working..."),
backend/app/api/document_jobs.py:147:        warning=job.error_message,
backend/app/api/document_jobs.py:167:            detail={"error": "DOCUMENT_JOB_NOT_FOUND", "message": "Document job not found"},
backend/app/api/document_jobs.py:177:        error_code=job.error_code,
backend/app/api/document_jobs.py:178:        error_message=job.error_message,
backend/app/api/billing.py:195:            "A subscription checkout is already in progress. Please try again in a few minutes.",
backend/app/api/billing.py:273:                "You already have an active subscription. Use /change-plan to switch plans.",
backend/app/api/billing.py:284:            "You already have an active subscription. Use /change-plan to switch plans.",
backend/app/api/billing.py:355:        logger.error("Failed to create subscription checkout: %s", e)
backend/app/api/billing.py:382:        logger.error("Failed to create billing portal session: %s", e)
backend/app/api/billing.py:416:        raise HTTPException(400, "You are already on this plan")
backend/app/api/billing.py:426:        logger.error("Stripe retrieve subscription failed: %s", e)
backend/app/api/billing.py:455:        logger.error("Stripe modify subscription failed: %s", e)
backend/app/api/billing.py:514:    write (see cancel_subscription). On Stripe error the last cached
backend/app/api/billing.py:730:    # Branch D: already on Free — nothing to cancel.
backend/app/api/billing.py:732:        raise HTTPException(400, "Already on the Free plan")
backend/app/api/billing.py:746:            logger.error("Stripe retrieve failed during cancel for user %s: %s", user.id, e)
backend/app/api/billing.py:758:                logger.error("Stripe modify (cancel) failed for user %s: %s", user.id, e)
backend/app/api/billing.py:786:        # Already cancelled on Stripe side — sync local state (idempotent).
backend/app/api/billing.py:807:                    "reason": "stripe_already_canceled_sync",
backend/app/api/billing.py:813:            logger.info("Synced local state for user %s — Stripe sub already canceled", user.id)
backend/app/api/billing.py:817:                "message": "Subscription was already canceled on Stripe; local state synced.",
backend/app/api/billing.py:846:            logger.error("Stripe list failed for cancel Branch C user %s: %s", user.id, e)
backend/app/api/billing.py:881:                logger.error("Stripe modify failed after auto-heal user %s: %s", user.id, e)
backend/app/api/billing.py:923:        raise HTTPException(400, "Already on the Free plan")
backend/app/api/billing.py:958:            logger.error("Missing client_reference_id in subscription session")
backend/app/api/billing.py:962:        logger.error("Invalid client_reference_id: %s", e)
backend/app/api/billing.py:1009:            logger.error("Could not retrieve subscription to detect plan: %s", e)
backend/app/api/billing.py:1062:            logger.error("Missing client_reference_id in checkout session")
backend/app/api/billing.py:1066:        logger.error("Invalid client_reference_id: %s", e)
backend/app/api/billing.py:1074:            logger.error("Missing credits in session metadata")
backend/app/api/billing.py:1078:            logger.error("Invalid credits amount: %d", credits)
backend/app/api/billing.py:1081:        logger.error("Cannot parse credits from metadata: %s", e)
backend/app/api/billing.py:1137:            logger.error("Failed to grant credits: %s", e)
backend/app/api/billing.py:1139:            raise HTTPException(500, "Database error")
backend/app/api/billing.py:1221:            logger.error("Failed to grant monthly credits on invoice: %s", e)
backend/app/api/billing.py:1222:            raise HTTPException(500, "Database error")
backend/app/api/billing.py:1278:    was_already_free = user.plan == "free"
backend/app/api/billing.py:1281:    if not was_already_free:
backend/app/api/billing.py:1414:    # Validate webhook signature - separate error handling for different failures
backend/app/api/billing.py:1420:        logger.error("Webhook payload parsing error: %s", e)
backend/app/api/billing.py:1423:        logger.error("Webhook signature verification failed: %s", e)
backend/app/api/billing.py:1441:            logger.error("Invalid event structure: missing data.object")
backend/app/api/documents.py:58:    "error": "DOCUMENT_NOT_FOUND",
backend/app/api/documents.py:62:    "error": "SERVER_ERROR",
backend/app/api/documents.py:63:    "message": "Internal error",
backend/app/api/documents.py:66:    "error": "STORAGE_UNAVAILABLE",
backend/app/api/documents.py:80:        "error": "UNSUPPORTED_FORMAT",
backend/app/api/documents.py:84:        "error": "INVALID_FILE_CONTENT",
backend/app/api/documents.py:127:        .where(Document.status != "deleting")
backend/app/api/documents.py:203:            detail={"error": "UNSUPPORTED_FORMAT", "message": "Unsupported file format"},
backend/app/api/documents.py:214:        .where(Document.status != "deleting")
backend/app/api/documents.py:227:                "error": "DOCUMENT_LIMIT_REACHED",
backend/app/api/documents.py:253:                    "error": "FILE_TOO_LARGE",
backend/app/api/documents.py:266:            detail={"error": "INVALID_FILE_CONTENT", "message": "Invalid file content"},
backend/app/api/documents.py:269:    # FastAPI resets file after read? We already have bytes; reconstruct UploadFile-like
backend/app/api/documents.py:322:            detail={"error": "URL_INVALID", "message": "URL must start with http:// or https://"},
backend/app/api/documents.py:335:                detail={"error": "URL_FETCH_BLOCKED", "message": "This URL can't be imported"},
backend/app/api/documents.py:348:        .where(Document.status != "deleting")
backend/app/api/documents.py:361:                "error": "DOCUMENT_LIMIT_REACHED",
backend/app/api/documents.py:380:                detail={"error": "URL_FETCH_BLOCKED", "message": "This URL can't be imported"},
backend/app/api/documents.py:386:                    "error": "URL_CONTENT_TOO_LARGE",
backend/app/api/documents.py:393:                detail={"error": "NO_TEXT_CONTENT", "message": "No text content found at URL"},
backend/app/api/documents.py:399:                detail={"error": "URL_FETCH_FAILED", "message": "Failed to fetch URL"},
backend/app/api/documents.py:404:        logger.error("URL fetch failed for %s: %s", url, e)
backend/app/api/documents.py:408:            detail={"error": "URL_FETCH_FAILED", "message": "Failed to fetch URL"},
backend/app/api/documents.py:423:                    "error": "FILE_TOO_LARGE",
backend/app/api/documents.py:468:                    "error": "FILE_TOO_LARGE",
backend/app/api/documents.py:614:                status="ready",
backend/app/api/documents.py:621:            status="pending" if doc.status != "ready" else "empty",
backend/app/api/documents.py:622:            coverage={"status": doc.status},
backend/app/api/documents.py:638:    status_value = "failed" if brief.error_code else "ready"
backend/app/api/documents.py:649:        error_code=brief.error_code,
backend/app/api/documents.py:650:        error_message=brief.error_message,
backend/app/api/documents.py:683:                "error": "STORAGE_UNAVAILABLE",
backend/app/api/documents.py:712:    # Try Page.content first (available for newly parsed non-PDF documents)
backend/app/api/documents.py:748:        # Fallback: reconstruct from chunks (for legacy documents parsed before this change)
backend/app/api/documents.py:802:    if doc.status not in ("ready", "error"):
backend/app/api/documents.py:806:                "error": "DOCUMENT_PROCESSING",
backend/app/api/documents.py:808:                "status": doc.status,
backend/app/api/documents.py:811:    doc.status = "parsing"
backend/app/api/documents.py:860:                    "error": "INSTRUCTIONS_TOO_LONG",
backend/app/api/documents.py:872:                        "error": "CUSTOM_INSTRUCTIONS_REQUIRE_PRO",
backend/app/api/chat.py:53:    "error": "DOCUMENT_NOT_FOUND",
backend/app/api/chat.py:57:    "error": "SESSION_NOT_FOUND",
backend/app/api/chat.py:61:    "error": "MESSAGE_NOT_FOUND",
backend/app/api/chat.py:110:                "error": "PRO_MODE_LIMIT_REACHED",
backend/app/api/chat.py:197:                    "error": "SESSION_LIMIT_REACHED",
backend/app/api/chat.py:212:                    "error": "DEMO_SESSION_RATE_LIMITED",
backend/app/api/chat.py:226:                    "error": "DEMO_SESSION_LIMIT_REACHED",
backend/app/api/chat.py:302:    if session.document and session.document.status != "ready":
backend/app/api/chat.py:306:                "error": "DOCUMENT_PROCESSING",
backend/app/api/chat.py:320:                    "error": "RATE_LIMITED",
backend/app/api/chat.py:332:                    "error": "RATE_LIMITED",
backend/app/api/chat.py:348:                    "error": "DEMO_MESSAGE_LIMIT_REACHED",
backend/app/api/chat.py:368:                    "error": "INSUFFICIENT_CREDITS",
backend/app/api/chat.py:410:    # Block if document is not ready
backend/app/api/chat.py:411:    if session.document and session.document.status != "ready":
backend/app/api/chat.py:415:                "error": "DOCUMENT_PROCESSING",
backend/app/api/chat.py:429:                    "error": "RATE_LIMITED",
backend/app/api/chat.py:440:                    "error": "RATE_LIMITED",
backend/app/api/chat.py:456:                    "error": "DEMO_MESSAGE_LIMIT_REACHED",
backend/app/api/chat.py:484:                "error": "CONTINUATION_LIMIT",
backend/app/api/chat.py:503:                    "error": "INSUFFICIENT_CREDITS",
backend/app/api/users.py:257:            content=json.dumps({"error": "EXPORT_RATE_LIMITED", "retry_after": remaining}),
backend/app/api/users.py:373:                error=str(e),
backend/app/api/users.py:379:            detail={"error": "SERVER_ERROR", "message": "Failed to delete all user documents"},
backend/app/api/users.py:389:            log_security_event("stripe_lookup_failed", user_id=user.id, error=str(e))
backend/app/api/users.py:393:                    "error": "STRIPE_UNAVAILABLE",
backend/app/api/users.py:408:                error=str(e),
backend/app/api/users.py:413:                    "error": "STRIPE_UNAVAILABLE",
backend/app/api/users.py:423:        # If deletion fails, return error
backend/app/api/users.py:426:            detail={"error": "SERVER_ERROR", "message": "Failed to delete user"},
backend/app/api/collections.py:26:    "error": "COLLECTION_NOT_FOUND",
backend/app/api/collections.py:132:                "error": "COLLECTION_LIMIT_REACHED",
backend/app/api/collections.py:277:                "error": "COLLECTION_DOC_LIMIT_REACHED",
backend/app/api/sharing.py:23:    "error": "SHARE_NOT_FOUND",
backend/app/api/sharing.py:84:                    "error": "SHARE_LIMIT_REACHED",
backend/app/api/sharing.py:137:                "error": "RATE_LIMITED",
backend/app/api/sharing.py:155:            detail={"error": "SHARE_EXPIRED", "message": "Share link has expired"},
backend/app/api/export.py:41:    - Non-ASCII (Chinese) title → latin-1 encode error on the raw header.
backend/app/api/export.py:74:            detail={"error": "SESSION_NOT_FOUND", "message": "Session not found"},
backend/app/api/export.py:83:                    "error": "EXPORT_REQUIRES_PAID_PLAN",
backend/app/api/export.py:141:                        "error": "EXPORT_VALIDATION_FAILED",
backend/app/api/export.py:149:            detail={"error": "SERVER_ERROR", "message": "Internal error"},
backend/app/api/export.py:153:        logger.error(
backend/app/api/export.py:160:                "error": "EXPORT_RENDERER_FAILED",
backend/app/workers/deletion_worker.py:39:            logger.error("Retry: MinIO cleanup failed for original file of doc %s: %s", document_id, e)
backend/app/workers/deletion_worker.py:48:            logger.error(
backend/app/workers/deletion_worker.py:71:            logger.error("Retry: Qdrant cleanup failed for doc %s: %s", document_id, e)
backend/app/api/search.py:53:                    "error": "RATE_LIMITED",
backend/app/api/search.py:63:            detail={"error": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
backend/app/api/search.py:68:            detail={"error": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
backend/app/api/extractions.py:68:    error_code: str | None
backend/app/api/extractions.py:69:    error_message: str | None
backend/app/api/extractions.py:95:    # Use only values already loaded by selectinload or explicitly assigned.
backend/app/api/extractions.py:118:        error_code=job.error_code,
backend/app/api/extractions.py:119:        error_message=job.error_message,
backend/app/api/extractions.py:132:            detail={"error": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
backend/app/api/extractions.py:155:                "error": "EXTRACTION_LIMIT_REACHED",
backend/app/api/extractions.py:181:    if doc.status != "ready":
backend/app/api/extractions.py:184:            detail={"error": "DOCUMENT_NOT_READY", "message": "Document is not ready"},
backend/app/api/extractions.py:191:            detail={"error": "UNSUPPORTED_EXTRACTION_TEMPLATE", "message": "Unsupported extraction template"},
backend/app/api/extractions.py:224:                "error": "INSUFFICIENT_CREDITS",
backend/app/api/extractions.py:254:        job.error_code = "EXTRACTION_QUEUE_FAILED"
backend/app/api/extractions.py:255:        job.error_message = "Failed to queue extraction"
backend/app/api/extractions.py:266:            detail={"error": "EXTRACTION_QUEUE_FAILED", "message": "Failed to queue extraction"},
backend/app/api/extractions.py:308:            detail={"error": "EXTRACTION_NOT_FOUND", "message": "Extraction not found"},
backend/app/api/extractions.py:332:            detail={"error": "EXTRACTION_NOT_FOUND", "message": "Extraction not found"},
backend/app/api/admin.py:113:    "parse_failure",
backend/app/api/admin.py:121:    "parse_failure": "Parse/OCR failure",
backend/app/api/admin.py:662:        if user_id in normalized_signals.get("parse_failure", set()):
backend/app/api/admin.py:778:        "error": None,
backend/app/api/admin.py:794:        payload["error"] = str(e)[:200]
backend/app/api/admin.py:984:        select(Document.status.label("status"), func.count(Document.id).label("count"))
backend/app/api/admin.py:985:        .group_by(Document.status)
backend/app/api/admin.py:988:    doc_status = [{"status": r.status, "count": r.count} for r in (await db.execute(status_q)).all()]
backend/app/api/admin.py:994:        "doc_status": doc_status,
backend/app/api/admin.py:1700:        "parse_failure": set(),
backend/app/api/admin.py:1769:                    func.sum(case((Document.status.in_(("error", "ocr")), 1), else_=0)),
backend/app/api/admin.py:1771:                ).label("parse_failures"),
backend/app/api/admin.py:1784:        if int(row.parse_failures or 0) > 0:
backend/app/api/admin.py:1785:            signal_users["parse_failure"].add(user_id)

exec
/bin/zsh -lc "rg -n \"artifact_count|artifacts|metadata_json.*artifact|artifact\" backend/app frontend/src -g '*.py' -g '*.ts' -g '*.tsx'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
frontend/src/store/index.ts:72:  addArtifactToLastMessage: (artifact: ChatArtifact) => void;
frontend/src/store/index.ts:225:  addArtifactToLastMessage: (artifact: ChatArtifact) => {
frontend/src/store/index.ts:229:    const existing = last.artifacts || [];
frontend/src/store/index.ts:230:    const next = artifact.jobId
frontend/src/store/index.ts:231:      ? existing.filter((item) => item.jobId !== artifact.jobId)
frontend/src/store/index.ts:233:    set({ messages: [...msgs.slice(0, -1), { ...last, artifacts: [...next, artifact] }] });
frontend/src/types/index.ts:34:  artifactType: 'table_scan' | 'table_export' | 'extraction' | 'template_run' | 'document_diff' | string;
frontend/src/types/index.ts:51:  artifacts?: ChatArtifact[];
backend/app/services/chat_service.py:958:            artifact_payload = execution.artifact.to_payload() if execution.artifact else None
backend/app/services/chat_service.py:959:            if artifact_payload:
backend/app/services/chat_service.py:960:                yield sse("artifact", artifact_payload)
backend/app/services/chat_service.py:968:                citations=(artifact_payload or {}).get("citations") if artifact_payload else None,
backend/app/services/chat_service.py:975:                    "artifacts": [artifact_payload] if artifact_payload else [],
backend/app/services/chat_service.py:988:                    "artifact_count": 1 if artifact_payload else 0,
backend/app/services/action_planner.py:39:    artifact_format: str | None = None
backend/app/services/action_planner.py:142:            artifact_format="csv",
backend/app/services/action_planner.py:166:            artifact_format="md",
backend/app/services/action_planner.py:194:            artifact_format="md",
backend/app/services/action_planner.py:209:            artifact_format="md",
backend/app/services/action_planner.py:305:            "artifact_format, template_key, user_visible_status. "
backend/app/services/action_planner.py:348:                artifact_format=str(raw.get("artifact_format")) if raw.get("artifact_format") else None,
backend/app/services/chat_tool_executor.py:34:    artifact_type: str
backend/app/services/chat_tool_executor.py:47:            "artifact_type": self.artifact_type,
backend/app/services/chat_tool_executor.py:66:    artifact: ChatArtifact | None = None
backend/app/services/chat_tool_executor.py:133:            artifact=ChatArtifact(
backend/app/services/chat_tool_executor.py:134:                artifact_type="extraction",
backend/app/services/chat_tool_executor.py:173:            artifact=ChatArtifact(
backend/app/services/chat_tool_executor.py:174:                artifact_type="extraction",
backend/app/services/chat_tool_executor.py:221:            artifact=ChatArtifact(
backend/app/services/chat_tool_executor.py:222:                artifact_type="extraction",
backend/app/services/chat_tool_executor.py:231:    artifact = ChatArtifact(
backend/app/services/chat_tool_executor.py:232:        artifact_type="extraction",
backend/app/services/chat_tool_executor.py:248:        artifact=artifact,
backend/app/services/chat_tool_executor.py:288:        artifact_type = "table_export" if export_requested else "table_scan"
backend/app/services/chat_tool_executor.py:307:            artifact=ChatArtifact(
backend/app/services/chat_tool_executor.py:308:                artifact_type=artifact_type,
backend/app/services/chat_tool_executor.py:367:                artifact=ChatArtifact(
backend/app/services/chat_tool_executor.py:368:                    artifact_type="table_export" if export_requested else "table_scan",
backend/app/services/chat_tool_executor.py:386:    artifact = ChatArtifact(
backend/app/services/chat_tool_executor.py:387:        artifact_type="table_export" if export_requested else "table_scan",
backend/app/services/chat_tool_executor.py:402:        artifact=artifact,
backend/app/services/chat_tool_executor.py:421:                artifact=None,
backend/app/services/chat_tool_executor.py:428:                artifact=None,
backend/app/services/chat_tool_executor.py:435:                    artifact=None,
backend/app/services/chat_tool_executor.py:441:                    artifact=None,
backend/app/services/chat_tool_executor.py:446:                artifact=None,
backend/app/services/chat_tool_executor.py:452:                artifact=None,
backend/app/services/chat_tool_executor.py:458:                artifact=None,
backend/app/services/chat_tool_executor.py:463:                artifact=None,
backend/app/services/chat_tool_executor.py:486:            artifact=None,
backend/app/api/document_jobs.py:1:"""Unified document job status API for chat-native artifacts."""
backend/app/api/document_jobs.py:20:    artifact_type: str
backend/app/api/document_jobs.py:46:    artifact: DocumentJobArtifactResponse
backend/app/api/document_jobs.py:70:async def _artifact_for_job(job: DocumentJob, db: AsyncSession, user: User) -> DocumentJobArtifactResponse:
backend/app/api/document_jobs.py:101:            artifact_type="table_export" if export_requested else "table_scan",
backend/app/api/document_jobs.py:118:        artifact_type = "document_diff"
backend/app/api/document_jobs.py:125:        artifact_type = "template_run"
backend/app/api/document_jobs.py:132:        artifact_type = "extraction"
backend/app/api/document_jobs.py:139:        artifact_type=artifact_type,
backend/app/api/document_jobs.py:183:        artifact=await _artifact_for_job(job, db, user),
backend/app/api/admin.py:123:    "export_refusal": "Export requested without artifact",
backend/app/api/admin.py:702:def _message_has_artifact(metadata: Any) -> bool:
backend/app/api/admin.py:705:    artifact_count = metadata.get("artifact_count")
backend/app/api/admin.py:706:    if isinstance(artifact_count, int) and artifact_count > 0:
backend/app/api/admin.py:708:    artifacts = metadata.get("artifacts")
backend/app/api/admin.py:709:    return isinstance(artifacts, list) and len(artifacts) > 0
backend/app/api/admin.py:1729:    export_artifact_users: set[str] = set()
backend/app/api/admin.py:1746:            if _message_has_artifact(row.metadata_json):
backend/app/api/admin.py:1747:                export_artifact_users.add(user_id)
backend/app/api/admin.py:1760:    signal_users["export_refusal"] = export_request_users - export_artifact_users
backend/app/api/documents.py:700:    to avoid overlap/duplication artifacts from the chunking pipeline.
frontend/src/lib/sse.ts:33:  onArtifact?: (artifact: ChatArtifact) => void,
frontend/src/lib/sse.ts:101:            case 'artifact':
frontend/src/lib/sse.ts:159:  onArtifact?: (artifact: ChatArtifact) => void,
frontend/src/lib/sse.ts:212:  onArtifact?: (artifact: ChatArtifact) => void,
frontend/src/lib/api.ts:90:    artifactType: raw?.artifact_type ?? raw?.artifactType ?? 'artifact',
frontend/src/lib/api.ts:174:    const artifacts = Array.isArray(m.metadata_json?.artifacts)
frontend/src/lib/api.ts:175:      ? m.metadata_json.artifacts.map(mapArtifactPayload)
frontend/src/lib/api.ts:183:      artifacts,
frontend/src/lib/api.ts:199:  artifact: ChatArtifact;
frontend/src/lib/api.ts:207:    artifact: mapArtifactPayload(data.artifact),
frontend/src/lib/useChatStream.ts:168:      && (!lastMessage.artifacts || lastMessage.artifacts.length === 0);
frontend/src/lib/useChatStream.ts:240:      (artifact) => addArtifactToLastMessage(artifact),
frontend/src/lib/useChatStream.ts:328:      (artifact) => addArtifactToLastMessage(artifact),
frontend/src/components/Chat/ChatArtifactCard.tsx:10:  artifact: ChatArtifact;
frontend/src/components/Chat/ChatArtifactCard.tsx:34:function documentIdFromArtifact(artifact: ChatArtifact, previewRows: Array<Record<string, unknown>>): string | null {
frontend/src/components/Chat/ChatArtifactCard.tsx:38:  for (const citation of artifact.citations || []) {
frontend/src/components/Chat/ChatArtifactCard.tsx:41:  for (const item of artifact.downloadUrls || []) {
frontend/src/components/Chat/ChatArtifactCard.tsx:70:export default function ChatArtifactCard({ artifact, onCitationClick }: ChatArtifactCardProps) {
frontend/src/components/Chat/ChatArtifactCard.tsx:72:  const [current, setCurrent] = useState(artifact);
frontend/src/components/Chat/ChatArtifactCard.tsx:81:    setCurrent(artifact);
frontend/src/components/Chat/ChatArtifactCard.tsx:82:  }, [artifact]);
frontend/src/components/Chat/ChatArtifactCard.tsx:90:          if (!cancelled) setCurrent(job.artifact);
frontend/src/components/Chat/ChatArtifactCard.tsx:104:  const Icon = current.artifactType.includes('table') ? Table2 : FileText;
frontend/src/components/Chat/ChatArtifactCard.tsx:105:  const artifactDocumentId = useMemo(() => documentIdFromArtifact(current, previewRows), [current, previewRows]);
frontend/src/components/Chat/ChatArtifactCard.tsx:117:            if (artifactDocumentId) {
frontend/src/components/Chat/ChatArtifactCard.tsx:119:                const tables = await listDocumentTables(artifactDocumentId);
frontend/src/components/Chat/ChatArtifactCard.tsx:161:  }, [artifactDocumentId, tableJob, tableJobPending, tOr]);
frontend/src/components/Chat/ChatArtifactCard.tsx:297:              {tOr('chat.artifact.planRequired', 'Export requires Plus')}
frontend/src/components/Chat/MessageBubble.tsx:317:              {isAssistant && message.artifacts?.map((artifact, index) => (
frontend/src/components/Chat/MessageBubble.tsx:319:                  key={`${artifact.jobId || artifact.title}-${index}`}
frontend/src/components/Chat/MessageBubble.tsx:320:                  artifact={artifact}

exec
/bin/zsh -lc "rg -n \"paywall_opened|limit_hit|paywall|ProductEvent\\(|event_name=|trackProductEvent|product_event|record.*event\" backend frontend/src -g '*.py' -g '*.ts' -g '*.tsx'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
backend/alembic/versions/20260501_0022_add_product_events.py:1:"""add product_events table
backend/alembic/versions/20260501_0022_add_product_events.py:21:        "product_events",
backend/alembic/versions/20260501_0022_add_product_events.py:52:    op.create_index("ix_product_events_user_id", "product_events", ["user_id"])
backend/alembic/versions/20260501_0022_add_product_events.py:53:    op.create_index("ix_product_events_event_name", "product_events", ["event_name"])
backend/alembic/versions/20260501_0022_add_product_events.py:54:    op.create_index("idx_product_events_created", "product_events", [sa.text("created_at DESC")])
backend/alembic/versions/20260501_0022_add_product_events.py:56:        "idx_product_events_name_created",
backend/alembic/versions/20260501_0022_add_product_events.py:57:        "product_events",
backend/alembic/versions/20260501_0022_add_product_events.py:61:        "idx_product_events_user_created",
backend/alembic/versions/20260501_0022_add_product_events.py:62:        "product_events",
backend/alembic/versions/20260501_0022_add_product_events.py:68:    op.drop_index("idx_product_events_user_created", table_name="product_events")
backend/alembic/versions/20260501_0022_add_product_events.py:69:    op.drop_index("idx_product_events_name_created", table_name="product_events")
backend/alembic/versions/20260501_0022_add_product_events.py:70:    op.drop_index("idx_product_events_created", table_name="product_events")
backend/alembic/versions/20260501_0022_add_product_events.py:71:    op.drop_index("ix_product_events_event_name", table_name="product_events")
backend/alembic/versions/20260501_0022_add_product_events.py:72:    op.drop_index("ix_product_events_user_id", table_name="product_events")
backend/alembic/versions/20260501_0022_add_product_events.py:73:    op.drop_table("product_events")
frontend/src/lib/api.ts:750:  paywall_opened: number;
frontend/src/lib/api.ts:751:  limit_hit: number;
frontend/src/lib/useChatStream.ts:22:   * anonymous/demo). Used by the paywall analytics events so the funnel data
frontend/src/lib/useChatStream.ts:25:   * poisoning every paywall_opened/limit_hit event in the funnel (I27).
frontend/src/lib/useChatStream.ts:119:      // every paywall event in the funnel to plus-upgrade intent regardless
frontend/src/lib/useChatStream.ts:124:      trackEvent('limit_hit', { source: 'chat_stream', reason, plan: upgradePlan, period: 'monthly' });
frontend/src/lib/useChatStream.ts:125:      trackEvent('paywall_opened', { source: 'chat_stream', reason, plan: upgradePlan, period: 'monthly' });
frontend/src/lib/useChatStream.ts:147:      trackEvent('limit_hit', { source: 'chat_stream', reason: code || 'rate_or_demo_limit' });
frontend/src/lib/billingLinks.ts:29: * given the user's current billing tier and the paywall reason code. Mirrors
frontend/src/lib/billingLinks.ts:38: * Shared by `useChatStream.ts` (analytics + paywall trigger) and
frontend/src/lib/errorCopy.ts:13:   * Whether the consumer should auto-open the paywall modal.
frontend/src/lib/errorCopy.ts:14:   * Only true for 402 credit/mode paywalls and SSE MODE_NOT_ALLOWED
backend/scripts/prod_metrics.py:79:    for ev in ('paywall_opened','upgrade_click','checkout_created','checkout_completed'):
backend/scripts/prod_metrics.py:84:          from product_events where event_name=$1""", ev, dt.date.fromisoformat(DEPLOY))
backend/scripts/prod_metrics.py:91:        sum((event_name='chat_message_sent' and created_at<$1)::int) sent_b,
backend/scripts/prod_metrics.py:92:        sum((event_name='chat_message_completed' and created_at<$1)::int) comp_b,
backend/scripts/prod_metrics.py:93:        sum((event_name='chat_message_sent' and created_at>=$1)::int) sent_a,
backend/scripts/prod_metrics.py:94:        sum((event_name='chat_message_completed' and created_at>=$1)::int) comp_a
backend/scripts/prod_metrics.py:95:      from product_events where event_name in ('chat_message_sent','chat_message_completed')""", dt.date.fromisoformat(DEPLOY))
backend/scripts/prod_metrics.py:112:      from product_events where event_name='rag_verification_completed' and created_at>now()-interval '14 days'
backend/app/services/chat_service.py:729:async def _record_rag_verification_event(
backend/app/services/chat_service.py:760:            ProductEvent(
backend/app/services/chat_service.py:762:                event_name="rag_verification_completed",
backend/app/services/chat_service.py:772:        logger.warning("Failed to record RAG verification event", exc_info=True)
backend/app/services/chat_service.py:1668:            await _record_rag_verification_event(
backend/app/services/chat_service.py:2285:            await _record_rag_verification_event(
backend/app/services/chat_tool_executor.py:187:        ProductEvent(
backend/app/services/chat_tool_executor.py:189:            event_name="extraction_created",
backend/app/services/chat_tool_executor.py:341:            ProductEvent(
backend/app/services/chat_tool_executor.py:343:                event_name="table_scan_created",
frontend/src/components/Extraction/ExtractionPanel.tsx:108:  const [paywallCode, setPaywallCode] = useState<string | null>(null);
frontend/src/components/Extraction/ExtractionPanel.tsx:414:            paywallCode={tablePaywallCode}
frontend/src/components/Extraction/ExtractionPanel.tsx:464:              {paywallCode && (
frontend/src/components/Extraction/ExtractionPanel.tsx:467:                    {paywallCode === "EXTRACTION_LIMIT_REACHED"
frontend/src/components/Extraction/ExtractionPanel.tsx:472:                    href={billingHref({ plan: "plus", source: "extraction_panel", reason: paywallCode.toLowerCase() })}
frontend/src/components/Extraction/ExtractionPanel.tsx:554:  paywallCode,
frontend/src/components/Extraction/ExtractionPanel.tsx:566:  paywallCode: string | null;
frontend/src/components/Extraction/ExtractionPanel.tsx:617:        {paywallCode && (
frontend/src/components/Extraction/ExtractionPanel.tsx:621:              href={billingHref({ plan: "plus", source: "tables_panel", reason: paywallCode.toLowerCase() })}
frontend/src/components/SessionDropdown.tsx:79:        trackEvent('limit_hit', { source: 'session_dropdown', reason: 'session_limit' });
backend/tests/test_chat_setup_refunds.py:521:async def test_continue_stream_records_rag_verification_event(
backend/tests/test_events_api.py:127:async def test_authenticated_user_can_record_private_event(monkeypatch):
frontend/src/components/Collections/CreateCollectionModal.tsx:75:        trackEvent('limit_hit', {
backend/tests/test_admin_user_activity.py:39:    assert "product_events" in query_text
backend/tests/test_admin_churn.py:48:        "paywall_hit": {owner_id},
backend/tests/test_admin_churn.py:58:        _row(user_id=owner_id, category="paywall"),
backend/tests/test_admin_churn.py:116:    assert signals["paywall_hit"]["count"] == 0
backend/tests/test_admin_churn.py:133:    assert "paywall" not in last_action
frontend/src/components/AdminUserActivityCharts.tsx:36:  paywall: "#a78bfa",
frontend/src/components/AdminUserActivityCharts.tsx:344:                  <Bar dataKey="paywall_opened" name={tOr('admin.activity.bar.paywallShown', 'Blocking paywall shown')} stackId="paid" fill={CHART_COLORS.paywall} radius={[0, 0, 0, 0]} />
frontend/src/components/AdminUserActivityCharts.tsx:345:                  <Bar dataKey="limit_hit" name={tOr('admin.activity.bar.limitHit', 'User hit a plan limit')} stackId="paid" fill={CHART_COLORS.limit} radius={[0, 0, 0, 0]} />
frontend/src/components/AdminUserActivityCharts.tsx:365:          subtitle={tOr('admin.activity.conversionBlockers.subtitle', 'Blocking paywalls, plan limits, and refund signals ranked by event count. Non-blocking upgrade reminders are excluded.')}
frontend/src/components/PaywallModal.tsx:17:   * upgrade page when the paywall fires. A Plus user hitting the Pro-mode cap
frontend/src/components/PaywallModal.tsx:24:function paywallCopy(reason: string | null | undefined, t: (key: string) => string, tOr: (key: string, fallback: string) => string) {
frontend/src/components/PaywallModal.tsx:27:      title: tOr('paywall.proMode.title', 'Keep using Pro analysis'),
frontend/src/components/PaywallModal.tsx:28:      body: tOr('paywall.proMode.body', 'Free includes a limited number of Pro answers. Plus unlocks unrestricted Pro mode for deeper cited analysis.'),
frontend/src/components/PaywallModal.tsx:29:      primaryLabel: tOr('paywall.proMode.cta', 'Upgrade for Pro mode'),
frontend/src/components/PaywallModal.tsx:45:  const copy = paywallCopy(reason, t, tOr);
frontend/src/components/PaywallModal.tsx:100:        aria-labelledby="paywall-title"
frontend/src/components/PaywallModal.tsx:103:        <h2 id="paywall-title" className="text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
frontend/src/components/PaywallModal.tsx:111:            tOr('paywall.benefit.credits', 'More monthly credits for active document work'),
frontend/src/components/PaywallModal.tsx:112:            tOr('paywall.benefit.modes', 'Flash and Pro modes without the free-plan cap'),
frontend/src/components/PaywallModal.tsx:113:            tOr('paywall.benefit.exports', 'PDF and DOCX exports for cited deliverables'),
frontend/src/components/PaywallModal.tsx:123:            href={billingHref({ plan: targetPlan, source: 'paywall_modal', reason: copy.reason })}
frontend/src/components/PaywallModal.tsx:124:            onClick={() => trackEvent('upgrade_click', { plan: targetPlan, period: 'monthly', source: 'paywall_modal', reason: copy.reason })}
backend/app/api/document_diffs.py:219:        ProductEvent(
backend/app/api/document_diffs.py:221:            event_name="document_diff_created",
frontend/src/components/Chat/ChatPanel.tsx:141:  const [paywallReason, setPaywallReason] = useState<string | null>(null);
frontend/src/components/Chat/ChatPanel.tsx:485:        reason={paywallReason}
frontend/src/components/dashboard/DashboardPageClient.tsx:238:      trackEvent('limit_hit', { source: 'dashboard_upload_precheck', reason: 'file_size', plan: userPlan });
frontend/src/components/dashboard/DashboardPageClient.tsx:304:        trackEvent('limit_hit', { source: 'dashboard_upload', reason: copy.cta.href.includes('file_size') ? 'file_size' : 'upload_limit', plan: userPlan });
frontend/src/components/dashboard/DashboardPageClient.tsx:347:        trackEvent('limit_hit', { source: 'dashboard_url', reason: copy.cta.href.includes('file_size') ? 'file_size' : 'url_limit', plan: userPlan });
backend/app/api/documents.py:223:        log_security_event("plan_limit_hit", user_id=user.id, plan=plan, limit_type="documents", limit=max_docs, current=user_doc_count)
backend/app/api/documents.py:357:        log_security_event("plan_limit_hit", user_id=user.id, plan=plan, limit_type="documents", limit=max_docs, current=user_doc_count)
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:117:  const [paywall, setPaywall] = useState<{ code: string; requiredPlan: string } | null>(null);
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:266:  const upgradePlan = paywall?.requiredPlan === "pro" ? "pro" : "plus";
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:430:              {paywall && (
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:433:                    {paywall.code === "INSUFFICIENT_CREDITS"
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:438:                    href={billingHref({ plan: upgradePlan, source: "question_templates", reason: paywall.code.toLowerCase() })}
frontend/src/components/Diff/DocumentDiffPanel.tsx:173:  const [paywall, setPaywall] = useState<{ code: string; requiredPlan: string } | null>(null);
frontend/src/components/Diff/DocumentDiffPanel.tsx:297:        trackEvent("paywall_opened", {
frontend/src/components/Diff/DocumentDiffPanel.tsx:403:          {paywall && (
frontend/src/components/Diff/DocumentDiffPanel.tsx:415:                {paywall.code === "INSUFFICIENT_CREDITS"
frontend/src/components/Diff/DocumentDiffPanel.tsx:416:                  ? tOr("diff.paywallCredits", "You need more credits to compare these documents.")
frontend/src/components/Diff/DocumentDiffPanel.tsx:417:                  : tOr("diff.paywallPlan", "Document Diff is a Pro workflow.")}
frontend/src/components/Diff/DocumentDiffPanel.tsx:660:          {paywall && (
frontend/src/components/Diff/DocumentDiffPanel.tsx:663:                {paywall.code === "INSUFFICIENT_CREDITS"
frontend/src/components/Diff/DocumentDiffPanel.tsx:664:                  ? tOr("diff.paywallCredits", "You need more credits to compare these documents.")
frontend/src/components/Diff/DocumentDiffPanel.tsx:665:                  : tOr("diff.paywallPlan", "Document Diff is a Pro workflow.")}
backend/app/models/tables.py:457:class ProductEvent(Base):
backend/app/models/tables.py:458:    __tablename__ = "product_events"
backend/app/models/tables.py:484:        sa.Index("idx_product_events_created", sa.text("created_at DESC")),
backend/app/models/tables.py:485:        sa.Index("idx_product_events_name_created", "event_name", sa.text("created_at DESC")),
backend/app/models/tables.py:486:        sa.Index("idx_product_events_user_created", "user_id", sa.text("created_at DESC")),
backend/app/api/feedback.py:61:        ProductEvent(
backend/app/api/feedback.py:63:            event_name="structured_feedback_submitted",
backend/app/api/tables.py:159:        ProductEvent(
backend/app/api/tables.py:161:            event_name="table_scan_created",
backend/app/api/tables.py:240:        ProductEvent(
backend/app/api/tables.py:242:            event_name="table_reconstruct_created",
backend/app/api/billing.py:45:async def _record_product_event(
backend/app/api/billing.py:58:            ProductEvent(
backend/app/api/billing.py:60:                event_name=event_name,
backend/app/api/billing.py:71:        logger.warning("Failed to record product event %s for user %s: %s", event_name, user_id, e)
backend/app/api/billing.py:240:    await _record_product_event(
backend/app/api/billing.py:243:        event_name="checkout_created",
backend/app/api/billing.py:340:        await _record_product_event(
backend/app/api/billing.py:343:            event_name="checkout_created",
backend/app/api/billing.py:1037:    await _record_product_event(
backend/app/api/billing.py:1040:        event_name="checkout_completed",
backend/app/api/billing.py:1122:            await _record_product_event(
backend/app/api/billing.py:1125:                event_name="checkout_completed",
backend/app/api/extractions.py:236:        ProductEvent(
backend/app/api/extractions.py:238:            event_name="extraction_created",
backend/app/api/events.py:21:    "limit_hit",
backend/app/api/events.py:29:    "paywall_opened",
backend/app/api/events.py:59:    "paywall_opened",
backend/app/api/events.py:60:    "limit_hit",
backend/app/api/events.py:92:async def record_product_event(
backend/app/api/events.py:108:    event = ProductEvent(
backend/app/api/events.py:110:        event_name=body.event_name,
backend/app/api/question_templates.py:297:        ProductEvent(
backend/app/api/question_templates.py:299:            event_name="question_template_run_created",
backend/app/api/admin.py:45:    "paywall_opened",
backend/app/api/admin.py:46:    "limit_hit",
backend/app/api/admin.py:58:    "paywall_opened": "Paywall shown",
backend/app/api/admin.py:59:    "limit_hit": "User hit a plan limit",
backend/app/api/admin.py:90:    "paywall_modal": "Paywall modal",
backend/app/api/admin.py:116:    "paywall_hit",
backend/app/api/admin.py:124:    "paywall_hit": "Paywall or plan limit hit",
backend/app/api/admin.py:171:    elif event_name == "paywall_opened":
backend/app/api/admin.py:173:    elif event_name == "limit_hit":
backend/app/api/admin.py:518:        "paywall": "Paywall or plan limit",
backend/app/api/admin.py:1126:                "paywall_opened": 0,
backend/app/api/admin.py:1127:                "limit_hit": 0,
backend/app/api/admin.py:1325:        ("limit_hit", "Hit paid limit", cohort_event_counts.get("limit_hit", 0)),
backend/app/api/admin.py:1326:        ("paywall_opened", "Saw blocking paywall", cohort_event_counts.get("paywall_opened", 0)),
backend/app/api/admin.py:1368:                    FROM product_events
backend/app/api/admin.py:1448:        item for item in paid_intent_reasons if item["event_name"] in {"limit_hit", "paywall_opened", "refund_requested"}
backend/app/api/admin.py:1703:        "paywall_hit": set(),
backend/app/api/admin.py:1805:        if row.event_name in {"paywall_opened", "limit_hit"}:
backend/app/api/admin.py:1806:            signal_users["paywall_hit"].add(user_id)
backend/app/api/admin.py:1807:            category = "paywall"
backend/app/api/admin.py:1809:            category = str(row.event_name or "product_event")
backend/app/api/admin.py:2024:        {"key": "limit_hit", "label": "Hit paid limit", "users": event_counts.get("limit_hit", {}).get("users", 0)},
backend/app/api/admin.py:2025:        {"key": "paywall_opened", "label": "Saw blocking paywall", "users": event_counts.get("paywall_opened", {}).get("users", 0)},
backend/app/schemas/admin.py:132:    paywall_opened: int = 0
backend/app/schemas/admin.py:133:    limit_hit: int = 0
backend/app/core/rate_limit.py:80:            log_security_event("rate_limit_hit", key=key, max_requests=self.max_requests)
backend/app/core/rate_limit.py:160:                log_security_event("rate_limit_hit", key=key, max_requests=self.max_requests)
frontend/src/components/admin/AdminPanels.tsx:162:          {tOr("admin.funnel.subtitle", "Last {days} days, signup cohort conversion by unique users. Upgrade reminders are separated from blocking paywalls.", { days: funnel.days })}
frontend/src/app/collections/[collectionId]/page.tsx:190:        trackEvent('limit_hit', {

codex
我已经有几个候选问题：未成熟 cohort/D30 被显示成 0，reason buckets 不是完整分类，以及消息查询缺少按时间/role 的索引。先跑指定测试确认现有测试状态，再收敛成可证伪 finding。
  ✓ Read spec, patch, and affected files
  → Audit backend SQL/auth/privacy/performance
  • Audit frontend tab fetch/cache/palette
  • Run targeted retention/churn tests
  • Write adversarial findings with merge recommendation
exec
/bin/zsh -lc 'SKIP_INTEGRATION=1 python3 -m pytest -q backend/tests/test_admin_retention.py backend/tests/test_admin_churn.py' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 781ms:
....                                                                     [100%]
=============================== warnings summary ===============================
backend/app/api/admin.py:866
  /Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/admin.py:866: DeprecationWarning: `regex` has been deprecated, please use `pattern` instead
    period: str = Query("day", regex="^(day|week|month)$"),

backend/app/api/admin.py:1002
  /Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/admin.py:1002: DeprecationWarning: `regex` has been deprecated, please use `pattern` instead
    period: str = Query("day", regex="^(day|week|month)$"),

backend/app/api/admin.py:2372
  /Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/admin.py:2372: DeprecationWarning: `regex` has been deprecated, please use `pattern` instead
    by: str = Query("tokens", regex="^(tokens|credits|documents)$"),

-- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
4 passed, 3 warnings in 0.33s

exec
/bin/zsh -lc "nl -ba frontend/src/components/admin/RevenueTab.tsx | sed -n '1,220p'" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "nl -ba frontend/src/components/admin/ProductTab.tsx | sed -n '1,260p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	"use client";
     2	
     3	import type { AdminBillingHealth, AdminFunnel } from "../../lib/api";
     4	import { useLocale } from "../../i18n";
     5	import { BillingHealthPanel, FunnelPanel } from "./AdminPanels";
     6	
     7	export default function RevenueTab({
     8	  funnel,
     9	  billingHealth,
    10	  billingRemoteLoading,
    11	  onRemoteCheck,
    12	}: {
    13	  funnel: AdminFunnel | null;
    14	  billingHealth: AdminBillingHealth | null;
    15	  billingRemoteLoading: boolean;
    16	  onRemoteCheck: () => void;
    17	}) {
    18	  const { tOr } = useLocale();
    19	
    20	  return (
    21	    <div className="space-y-6">
    22	      <FunnelPanel funnel={funnel} title={tOr("admin.revenue.funnelTitle", "Revenue Funnel")} />
    23	      <BillingHealthPanel
    24	        health={billingHealth}
    25	        loadingRemote={billingRemoteLoading}
    26	        onRemoteCheck={onRemoteCheck}
    27	      />
    28	    </div>
    29	  );
    30	}

 succeeded in 0ms:
     1	"use client";
     2	
     3	import dynamic from "next/dynamic";
     4	import type { AdminRagQuality } from "../../lib/api";
     5	import { RagQualityPanel, UserTablesPanel, type RecentUser, type TopUser } from "./AdminPanels";
     6	import type { Breakdowns, Trends } from "./types";
     7	
     8	const AdminCharts = dynamic<{
     9	  trends: Trends;
    10	  breakdowns: Breakdowns;
    11	  trendDays: number;
    12	  onTrendDaysChange: (days: number) => void;
    13	}>(() => import("../AdminCharts"), { ssr: false });
    14	
    15	export default function ProductTab({
    16	  ragQuality,
    17	  trends,
    18	  breakdowns,
    19	  trendDays,
    20	  onTrendDaysChange,
    21	  recentUsers,
    22	  topUsers,
    23	  topBy,
    24	  onTopByChange,
    25	}: {
    26	  ragQuality: AdminRagQuality | null;
    27	  trends: Trends | null;
    28	  breakdowns: Breakdowns | null;
    29	  trendDays: number;
    30	  onTrendDaysChange: (days: number) => void;
    31	  recentUsers: RecentUser[];
    32	  topUsers: TopUser[];
    33	  topBy: "tokens" | "credits" | "documents";
    34	  onTopByChange: (value: "tokens" | "credits" | "documents") => void;
    35	}) {
    36	  return (
    37	    <div className="space-y-6">
    38	      <RagQualityPanel quality={ragQuality} />
    39	      {trends && breakdowns ? (
    40	        <AdminCharts
    41	          trends={trends}
    42	          breakdowns={breakdowns}
    43	          trendDays={trendDays}
    44	          onTrendDaysChange={onTrendDaysChange}
    45	        />
    46	      ) : null}
    47	      <UserTablesPanel
    48	        recentUsers={recentUsers}
    49	        topUsers={topUsers}
    50	        topBy={topBy}
    51	        onTopByChange={onTopByChange}
    52	      />
    53	    </div>
    54	  );
    55	}

exec
/bin/zsh -lc "nl -ba frontend/src/components/admin/ActivationTab.tsx | sed -n '1,180p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	"use client";
     2	
     3	import type { AdminFunnel, AdminUserActivity } from "../../lib/api";
     4	import { formatNumber, formatPercent } from "../../lib/formatNumber";
     5	import { useLocale } from "../../i18n";
     6	import { FunnelPanel } from "./AdminPanels";
     7	
     8	export default function ActivationTab({
     9	  activity,
    10	  funnel,
    11	}: {
    12	  activity: AdminUserActivity | null;
    13	  funnel: AdminFunnel | null;
    14	}) {
    15	  const { tOr } = useLocale();
    16	  const stages = (activity?.funnel || []).slice(0, 5);
    17	  const signupUsers = stages[0]?.users || 0;
    18	
    19	  return (
    20	    <div className="space-y-6">
    21	      <section className="dt-admin-panel rounded-lg border p-4">
    22	        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
    23	          {tOr("admin.activation.title", "Activation Funnel")}
    24	        </h2>
    25	        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
    26	          {tOr("admin.activation.subtitle", "Signup to upload, first chat, and engaged usage.")}
    27	        </p>
    28	        <div className="mt-4 grid gap-3 lg:grid-cols-5">
    29	          {stages.map((stage, index) => {
    30	            const dropoff = index > 0 && stages[index - 1]?.users
    31	              ? 1 - stage.users / stages[index - 1].users
    32	              : null;
    33	            return (
    34	              <div key={stage.key} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
    35	                <p className="text-xs text-zinc-500 dark:text-zinc-400">{stage.label}</p>
    36	                <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
    37	                  {formatNumber(stage.users)}
    38	                </p>
    39	                <p className="mt-1 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
    40	                  {index === 0
    41	                    ? tOr("admin.activation.start", "Start")
    42	                    : tOr("admin.activation.ofSignups", "{rate} of signups", {
    43	                        rate: formatPercent(signupUsers > 0 ? stage.users / signupUsers : 0),
    44	                      })}
    45	                </p>
    46	                {dropoff != null ? (
    47	                  <p className="mt-1 text-xs tabular-nums text-red-600 dark:text-red-300">
    48	                    {tOr("admin.activation.dropoff", "{rate} drop-off", { rate: formatPercent(dropoff) })}
    49	                  </p>
    50	                ) : null}
    51	              </div>
    52	            );
    53	          })}
    54	        </div>
    55	      </section>
    56	      <FunnelPanel funnel={funnel} title={tOr("admin.activation.extendedFunnel", "Extended Signup Funnel")} />
    57	    </div>
    58	  );
    59	}

exec
/bin/zsh -lc "nl -ba frontend/src/components/admin/OverviewTab.tsx | sed -n '1,170p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	"use client";
     2	
     3	import {
     4	  Activity,
     5	  AlertCircle,
     6	  BadgeDollarSign,
     7	  CalendarPlus,
     8	  Gauge,
     9	  RadioTower,
    10	} from "lucide-react";
    11	import type { AdminUserActivity } from "../../lib/api";
    12	import { formatPercent } from "../../lib/formatNumber";
    13	import { useLocale } from "../../i18n";
    14	import KPICard from "./KPICard";
    15	import type { Overview, Trends } from "./types";
    16	
    17	function seriesValues(points: { count?: number; total_tokens?: number; amount?: number }[] | undefined): number[] {
    18	  return (points || []).map((point) => point.count ?? point.total_tokens ?? point.amount ?? 0);
    19	}
    20	
    21	export default function OverviewTab({
    22	  overview,
    23	  activity,
    24	  trends,
    25	}: {
    26	  overview: Overview | null;
    27	  activity: AdminUserActivity | null;
    28	  trends: Trends | null;
    29	}) {
    30	  const { tOr } = useLocale();
    31	  if (!overview || !activity) return null;
    32	
    33	  const summary = activity.summary;
    34	  const activationRate = summary.signups > 0 ? summary.activated_users / summary.signups : 0;
    35	  const stickiness = summary.mau > 0 ? summary.dau / summary.mau : 0;
    36	
    37	  return (
    38	    <div className="space-y-6">
    39	      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    40	        <KPICard
    41	          icon={CalendarPlus}
    42	          label={tOr("admin.kpi.signups", "Signups")}
    43	          value={summary.signups}
    44	          deltaPercent={summary.deltas.signups?.delta_percent}
    45	          sparkline={seriesValues(trends?.signups)}
    46	        />
    47	        <KPICard
    48	          icon={RadioTower}
    49	          label={tOr("admin.kpi.wau", "WAU")}
    50	          value={summary.wau}
    51	          deltaPercent={summary.deltas.active_users?.delta_percent}
    52	          sparkline={seriesValues(trends?.active_users)}
    53	        />
    54	        <KPICard
    55	          icon={Activity}
    56	          label={tOr("admin.kpi.mau", "MAU")}
    57	          value={summary.mau}
    58	          sparkline={seriesValues(trends?.active_users)}
    59	        />
    60	        <KPICard
    61	          icon={Gauge}
    62	          label={tOr("admin.kpi.stickiness", "Stickiness DAU/MAU")}
    63	          value={formatPercent(stickiness)}
    64	          deltaPercent={null}
    65	          sparkline={activity.series.map((point) => point.active_users)}
    66	        />
    67	        <KPICard
    68	          icon={BadgeDollarSign}
    69	          label={tOr("admin.kpi.activationRate", "Activation")}
    70	          value={formatPercent(activationRate)}
    71	          deltaPercent={summary.deltas.chat_users?.delta_percent}
    72	          sparkline={activity.series.map((point) => point.chat_users)}
    73	        />
    74	        <KPICard
    75	          icon={BadgeDollarSign}
    76	          label={tOr("admin.kpi.paidConversion", "Paid conversion")}
    77	          value={formatPercent(summary.free_to_paid_rate)}
    78	          deltaPercent={summary.deltas.checkout_completed?.delta_percent}
    79	          sparkline={activity.series.map((point) => point.checkout_completed)}
    80	        />
    81	        <KPICard
    82	          icon={AlertCircle}
    83	          label={tOr("admin.kpi.asstZeroRate", "Asst=0 rate")}
    84	          value="0.0%"
    85	          deltaPercent={0}
    86	          sparkline={activity.series.map(() => 0)}
    87	        />
    88	      </div>
    89	      <section className="dt-admin-panel rounded-lg border p-4">
    90	        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
    91	          {tOr("admin.overview.accountBase", "Account Base")}
    92	        </h2>
    93	        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    94	          <MiniMetric label={tOr("admin.kpi.totalUsers", "Total Users")} value={overview.total_users} />
    95	          <MiniMetric label={tOr("admin.kpi.paidUsers", "Paid Users")} value={overview.paid_users} />
    96	          <MiniMetric label={tOr("admin.kpi.documents", "Documents")} value={overview.total_documents} />
    97	          <MiniMetric label={tOr("admin.kpi.messages", "Messages")} value={overview.total_messages} />
    98	        </div>
    99	      </section>
   100	    </div>
   101	  );
   102	}
   103	
   104	function MiniMetric({ label, value }: { label: string; value: number }) {
   105	  return (
   106	    <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
   107	      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
   108	      <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">{value.toLocaleString()}</p>
   109	    </div>
   110	  );
   111	}

exec
/bin/zsh -lc "sed -n '1,40p' backend/app/api/admin.py" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
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


exec
/bin/zsh -lc 'rg -n "APIRouter" backend/app/api/admin.py' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
12:from fastapi import APIRouter, Depends, Query
41:router = APIRouter(prefix="/api/admin", tags=["admin"])

exec
/bin/zsh -lc 'rg -n "def _rate" backend/app/api/admin.py' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
198:def _rate(numerator: int | float, denominator: int | float) -> float:

exec
/bin/zsh -lc "nl -ba backend/app/api/admin.py | sed -n '188,210p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   188	        "reason": row.reason,
   189	        "source": row.source,
   190	        "plan": row.plan,
   191	        "label": _paid_signal_label(event_name),
   192	        "description": _paid_signal_description(event_name, row.reason, row.source, row.plan),
   193	        "events": int(row.events or 0),
   194	        "users": int(row.users or 0),
   195	    }
   196	
   197	
   198	def _rate(numerator: int | float, denominator: int | float) -> float:
   199	    return round(float(numerator) / float(denominator), 4) if denominator else 0.0
   200	
   201	
   202	def _delta_payload(current: int | float, previous: int | float) -> dict[str, int | float | None]:
   203	    delta = current - previous
   204	    return {
   205	        "current": current,
   206	        "previous": previous,
   207	        "delta": delta,
   208	        "delta_percent": round((delta / previous) * 100, 1) if previous else None,
   209	    }
   210	

  ✓ Read spec, patch, and affected files
  ✓ Audit backend SQL/auth/privacy/performance
  → Audit frontend tab fetch/cache/palette
  ✓ Run targeted retention/churn tests
  • Write adversarial findings with merge recommendation
exec
/bin/zsh -lc "nl -ba backend/alembic/versions/20260414_0021_add_plan_transitions_audit.py | sed -n '55,75p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
    55	        ),
    56	        sa.Column(
    57	            "created_at",
    58	            sa.TIMESTAMP(timezone=True),
    59	            nullable=False,
    60	            server_default=sa.text("now()"),
    61	        ),
    62	    )
    63	    op.create_index(
    64	        "idx_plan_transitions_user",
    65	        "plan_transitions",
    66	        ["user_id", sa.text("created_at DESC")],
    67	    )
    68	    op.create_index(
    69	        "idx_plan_transitions_source",
    70	        "plan_transitions",
    71	        ["source"],
    72	    )
    73	    op.create_check_constraint(
    74	        "ck_plan_transitions_source",
    75	        "plan_transitions",

codex
前端确认：正常进 `/admin` 不会 mount 拉全量，但 `#retention/#churn` 深链会先触发 overview 的 lazy effect，再切到 hash tab 拉目标数据。这个和“per-tab lazy”规格有冲突，会列为前端 finding。
  ✓ Read spec, patch, and affected files
  ✓ Audit backend SQL/auth/privacy/performance
  ✓ Audit frontend tab fetch/cache/palette
  ✓ Run targeted retention/churn tests
  → Write adversarial findings with merge recommendation
codex
**Must-Fix**

1. [backend/app/api/admin.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/admin.py:376) and [backend/app/api/admin.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/admin.py:394): retention reports immature periods as real data. Current-week cohorts get future W1-W11 cells as `0%`, and D1/D7/D30 denominators include users who have not had 1/7/30 days to return. 可证伪: a user first active today enters D30 denominator and cannot possibly return, depressing D30. 建议: add maturity checks per cell/curve, return `null` or `is_complete=false`, and only include users with `first_active <= today - N` in Dn denominators.

2. [backend/app/api/admin.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/admin.py:660): `reason_buckets` is not a full categorization of churned users. A churned user with two normal active days and no signals increments `churned_users` but no bucket, so bucket percentages can sum to less than 100 while the UI presents a donut of “reason buckets.” 建议: add an explicit `uncategorized/unknown` bucket or change denominator/labeling to “classified churned users.”

**Should-Fix**

1. [frontend/src/app/admin/AdminPageClient.tsx](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/admin/AdminPageClient.tsx:71), [line 99](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/admin/AdminPageClient.tsx:99), [line 126](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/admin/AdminPageClient.tsx:126): `#retention` / `#churn` deep links first render `overview`, so the lazy effect starts overview/activity/trends before the hash effect switches tabs. 可证伪: open `/admin#retention` and watch network. 建议: initialize `activeTab` from `window.location.hash` in the `useState` initializer or gate fetching until hash sync completes.

2. [backend/app/api/admin.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/admin.py:1728): `export_refusal` and `page_fail` are user-level, order-insensitive signals. Any export request is cancelled by any artifact ever; any page request plus any unrelated RAG miss becomes `page_fail`. 建议: derive these per session/request, pairing user request with the following assistant response/artifact.

3. [backend/app/models/tables.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/models/tables.py:245) vs [backend/app/api/admin.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/admin.py:1563): new endpoints filter `messages` by `created_at`/`role`, but the only message index is `(session_id, created_at)`. This is bounded but still a table scan as messages grow. 建议: add an index such as `(role, created_at, session_id)` or a partial index for user-role activity.

4. [backend/app/api/admin.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/admin.py:1576) and [line 1656](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/admin.py:1656): `date_trunc("day", timestamptz)` uses the DB session timezone, while Python cutoffs use UTC. Engine setup does not force timezone. 建议: truncate `created_at AT TIME ZONE 'UTC'` or set the DB session timezone explicitly.

5. [backend/app/schemas/admin.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/schemas/admin.py:327) and [backend/app/api/admin.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/admin.py:563): `cancel_reasons` exposes `user_id`, which the spec did not ask for and is avoidable non-aggregate user data. 建议: remove it from schema/serializer unless the UI actually needs drill-down.

**Nit**

1. [frontend/src/components/admin/ReasonBucketsDonut.tsx](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/admin/ReasonBucketsDonut.tsx:14): palette is not pure zinc/blue (`#0F766E`, `#DC2626`, `#9333EA`). 建议: use blue intensity plus zinc variants.

2. Current tests pass but only exercise helper payload builders and route registration; they do not cover immature retention cells, Dn denominator maturity, SQL timezone behavior, or bucket sum/classification.

**Verified**

`SKIP_INTEGRATION=1 python3 -m pytest -q backend/tests/test_admin_retention.py backend/tests/test_admin_churn.py` passed: `4 passed`, with 3 existing `Query(regex=...)` deprecation warnings.

鉴权看起来正确：两个新端点都有 `Depends(require_admin)`. Owner/admin exclusion also appears applied to the user-level SQL paths I checked.

**可否合并 main:** 不建议合并。Retention maturity and non-exhaustive churn buckets can directly mislead PM decisions.
tokens used
218,302
**Must-Fix**

1. [backend/app/api/admin.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/admin.py:376) and [backend/app/api/admin.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/admin.py:394): retention reports immature periods as real data. Current-week cohorts get future W1-W11 cells as `0%`, and D1/D7/D30 denominators include users who have not had 1/7/30 days to return. 可证伪: a user first active today enters D30 denominator and cannot possibly return, depressing D30. 建议: add maturity checks per cell/curve, return `null` or `is_complete=false`, and only include users with `first_active <= today - N` in Dn denominators.

2. [backend/app/api/admin.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/admin.py:660): `reason_buckets` is not a full categorization of churned users. A churned user with two normal active days and no signals increments `churned_users` but no bucket, so bucket percentages can sum to less than 100 while the UI presents a donut of “reason buckets.” 建议: add an explicit `uncategorized/unknown` bucket or change denominator/labeling to “classified churned users.”

**Should-Fix**

1. [frontend/src/app/admin/AdminPageClient.tsx](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/admin/AdminPageClient.tsx:71), [line 99](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/admin/AdminPageClient.tsx:99), [line 126](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/admin/AdminPageClient.tsx:126): `#retention` / `#churn` deep links first render `overview`, so the lazy effect starts overview/activity/trends before the hash effect switches tabs. 可证伪: open `/admin#retention` and watch network. 建议: initialize `activeTab` from `window.location.hash` in the `useState` initializer or gate fetching until hash sync completes.

2. [backend/app/api/admin.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/admin.py:1728): `export_refusal` and `page_fail` are user-level, order-insensitive signals. Any export request is cancelled by any artifact ever; any page request plus any unrelated RAG miss becomes `page_fail`. 建议: derive these per session/request, pairing user request with the following assistant response/artifact.

3. [backend/app/models/tables.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/models/tables.py:245) vs [backend/app/api/admin.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/admin.py:1563): new endpoints filter `messages` by `created_at`/`role`, but the only message index is `(session_id, created_at)`. This is bounded but still a table scan as messages grow. 建议: add an index such as `(role, created_at, session_id)` or a partial index for user-role activity.

4. [backend/app/api/admin.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/admin.py:1576) and [line 1656](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/admin.py:1656): `date_trunc("day", timestamptz)` uses the DB session timezone, while Python cutoffs use UTC. Engine setup does not force timezone. 建议: truncate `created_at AT TIME ZONE 'UTC'` or set the DB session timezone explicitly.

5. [backend/app/schemas/admin.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/schemas/admin.py:327) and [backend/app/api/admin.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/admin.py:563): `cancel_reasons` exposes `user_id`, which the spec did not ask for and is avoidable non-aggregate user data. 建议: remove it from schema/serializer unless the UI actually needs drill-down.

**Nit**

1. [frontend/src/components/admin/ReasonBucketsDonut.tsx](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/admin/ReasonBucketsDonut.tsx:14): palette is not pure zinc/blue (`#0F766E`, `#DC2626`, `#9333EA`). 建议: use blue intensity plus zinc variants.

2. Current tests pass but only exercise helper payload builders and route registration; they do not cover immature retention cells, Dn denominator maturity, SQL timezone behavior, or bucket sum/classification.

**Verified**

`SKIP_INTEGRATION=1 python3 -m pytest -q backend/tests/test_admin_retention.py backend/tests/test_admin_churn.py` passed: `4 passed`, with 3 existing `Query(regex=...)` deprecation warnings.

鉴权看起来正确：两个新端点都有 `Depends(require_admin)`. Owner/admin exclusion also appears applied to the user-level SQL paths I checked.

**可否合并 main:** 不建议合并。Retention maturity and non-exhaustive churn buckets can directly mislead PM decisions.
