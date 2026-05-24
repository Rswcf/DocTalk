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
