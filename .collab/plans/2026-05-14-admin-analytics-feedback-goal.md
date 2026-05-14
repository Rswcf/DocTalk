# Admin Analytics, Growth Diagnosis, and Feedback Goal

Work in `/Users/mayijie/Projects/Code/010_DocTalk`.

Read first:
- `AGENTS.md`
- `CLAUDE.md`
- `.claude/rules/backend.md`
- `.claude/rules/frontend.md`

Follow the existing Next.js 14, FastAPI, SQLAlchemy, Alembic, ProductEvent, and Recharts patterns. Do the work directly when possible. If production DB, admin account, Stripe, Vercel, Railway, or Resend access is required, complete code and local verification first, then stop and state exactly what the user must provide. Do not invent production user data.

## Product Context

DocTalk is an AI document Q&A app. Users upload PDF, DOCX, PPTX, XLSX, TXT, MD, or URL content. The backend parses documents, chunks and embeds content into Qdrant, retrieves relevant chunks during chat, and DeepSeek V4 generates cited answers. Users click citations to jump back to the source passage.

Existing admin already includes KPI cards, trends, breakdowns, monetization funnel, RAG quality, recent users, and top users. The gaps are real-time visibility, richer active-user definitions, retention, conversion blockers, and structured feedback.

Public production pages also appear to have trust/conversion drift: the frontend publicly shows old version/copy such as `v0.2.0`, `500 credits`, and `3 modes/Thorough`, while backend `/version` reports `0.17.1` and current product rules are `300 credits` plus Flash/Pro. Verify and fix public copy drift where found.

## Goals

1. Build dynamic admin user analytics visualization so the admin can understand real-time user changes, active trends, conversion blockers, paid intent, and feedback trends.
2. Analyze why traffic and willingness to pay are weak, using code, public site inspection, and accessible data. Separate verified facts from assumptions. If production data is unavailable, provide exact SQL/API needed and stop for access.
3. Add a structured feedback mechanism where users can submit semi-prefilled feedback with optional text.

## Existing Files

- Backend admin: `backend/app/api/admin.py`
- Admin schemas: `backend/app/schemas/admin.py`
- Frontend admin: `frontend/src/app/admin/AdminPageClient.tsx`
- Charts: `frontend/src/components/AdminCharts.tsx`
- Events API: `backend/app/api/events.py`
- Frontend analytics: `frontend/src/lib/analytics.ts`
- `ProductEvent` already has `event_name`, `source`, `reason`, `plan`, `billing`, and `metadata_json`.

## Admin Analytics Backend

Add or extend an admin endpoint, for example:

`GET /api/admin/user-activity?days=30&period=day`

It must use `require_admin`.

Return:

- `summary`: DAU, WAU, MAU, signups, activated users, upload users, chat users, paid users, free-to-paid rate, period-over-period deltas.
- `series`: daily signups, composite active users, AI-active users, uploads, chat users, messages, credits spent, paywall events, upgrade clicks, checkout events, feedback submissions.
- `funnel`: signup -> upload -> session -> first chat -> 5+ messages -> paywall/limit -> billing view -> upgrade click -> checkout created -> checkout completed.
- `retention`: D0/D1/D7/D30 retention by signup cohort. If insufficient data, return an empty array plus an explanation.
- `segments`: plan distribution, file type, paid-intent event source/reason, and conversion blockers.

Active-user definitions:

- Composite active user: logged-in distinct user with any usage record, user message, document upload, or product event.
- AI-active user: logged-in distinct user with usage records.

Do not rely only on `usage_records`.

Consider performance. Add only additive migrations/indexes if needed. During beta, no drops or renames.

## Admin Analytics Frontend

Add:

- Auto refresh control: 15s, 30s, 60s, off. Default 30s. Show last refreshed time.
- KPI cards with deltas: DAU, WAU, MAU, activation, conversion.
- Active-user trend chart.
- Funnel drop-off chart.
- Retention heatmap.
- Paid-intent reason table.
- Feedback trend/category panel.

Default admin visualizations should avoid PII. Existing recent/top user tables may remain.

## Feedback Mechanism

Add `user_feedback` table with an Alembic migration. Suggested fields:

- `id`
- `user_id` nullable
- `type`
- `area`
- `severity`
- `selected_options` JSONB
- `message` nullable text
- `path`
- `locale`
- `plan`
- `status` default `new`
- `user_agent` trimmed
- `created_at`
- `updated_at`

Add `POST /api/feedback`:

- Pydantic validation.
- Length limits.
- Rate limit.
- Writes `user_feedback`.
- Also writes `ProductEvent` for admin aggregation.
- Do not store document text or chat transcript.

Frontend:

- Add `FeedbackButton` and `FeedbackModal`.
- Place it in logged-in app/document/chat surfaces where visible but not intrusive.
- Anonymous demo can either submit with stricter rate limit or show login CTA.
- Success state should be brief.
- Text feedback must be optional.

Prefilled choices:

- `type`: `feature_request`, `bug`, `answer_quality`, `citation_problem`, `billing_pricing`, `usability`, `other`
- `area`: `upload_parse`, `chat_answer`, `citation_jump`, `collections`, `export`, `billing`, `account`, `performance`, `mobile`, `localization`
- `severity`: `low`, `medium`, `high`, `blocking`

Admin:

- Add feedback summary/recent panel.
- Aggregate by type, area, severity, and status.
- Show recent feedback in a privacy-conscious way.

## Growth and Payment Analysis

Create:

`.collab/plans/YYYY-MM-DD-admin-analytics-feedback-growth-analysis.md`

It must distinguish:

- Verified facts.
- Data-backed conclusions.
- Assumptions requiring production validation.
- SQL/API needed if production data is unavailable.

Initial hypotheses to verify:

1. Public version/pricing/mode copy drift reduces trust and paid intent.
2. Public pages still mention outdated 500 credits, 3 modes, or Thorough in places.
3. Credit value may still be abstract; inspect upgrade_click to checkout drop-off.
4. No structured feedback means the team cannot see why users fail to pay or churn.
5. If UTM/referrer/source attribution is missing, admin should show `traffic attribution unavailable` and document required follow-up fields.

If production data is accessible, query real DAU/WAU/MAU, 30-day signup cohort, paid funnel, cancellation reasons, and feedback reasons. If not accessible, provide the SQL/API and stop for credentials.

## Public Copy Drift

Fix verified public copy drift:

- 300 credits, not stale 500 monthly credits.
- Flash/Pro, not stale 3 modes or Thorough.
- Current release/version display should match the source of truth.

i18n changes must cover all 11 locales or use `tOr` fallback when shipping ahead of translation.

## Verification

Run:

- `cd backend && python3 -m ruff check app/ tests/`
- targeted backend tests for admin analytics and feedback API
- `cd frontend && npm run build`

For UI:

- Start local dev server.
- Open `/admin`.
- Open a document/chat page and test feedback modal.
- Check mobile viewport for overlap.

Final response must list changed files, verification results, and any external blocker.
