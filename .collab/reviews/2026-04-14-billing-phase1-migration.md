# Phase 1 review request — plan_transitions migration

**Diff**: `backend/alembic/versions/20260414_0021_add_plan_transitions_audit.py` (new file, ~80 LOC)

## Scope verified
- Follows repo pattern (`20260414_0021` matches `YYYYMMDD_NNNN` style)
- Chains cleanly: `down_revision = "20260317_0020"` (confirmed via `alembic heads` → `20260414_0021 (head)`)
- Additive-only (no ALTER of existing tables)
- JSONB column named `metadata_json` (not `metadata`) to avoid SQLAlchemy's reserved `metadata` attribute collision

## Deviations from plan

1. Column name `metadata_json` instead of plan's `metadata`
   - Reason: SQLAlchemy declarative `Base.metadata` is reserved
2. Added CHECK constraint `ck_plan_transitions_source` enumerating
   legal source values (`self_serve_cancel`, `stripe_webhook`,
   `plan_change`, `admin`, `portal`)
   - Reason: defensive schema — deferred audit sources will be valid
     without needing constraint modification

## Questions for Codex review
1. CHECK constraint: good idea or premature coupling? Could be dropped
   if we want looser schema while other source writes get added later.
2. `gen_random_uuid()` server default — is pgcrypto ext loaded?
   (Railway Postgres should have it by default but let's verify.)
3. Index on `(user_id, created_at DESC)` — any concerns for
   write-amp given frequency (estimate: <10 rows/user/year)?

## What's NOT in this phase
- No code yet reads from or writes to this table
- No model class (`PlanTransition`) — added in Phase 2
- No webhook / change-plan audit writes (deferred per plan §4.1)

## Approval required before Phase 2

Reply APPROVED (Phase 2 starts) or BLOCKING with line-referenced fix.
Output: `.collab/reviews/2026-04-14-billing-phase1-migration-response.md`
Under 200 words.
