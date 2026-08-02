# Claude triage of Codex r1 (P0 demo re-tune batch) — 2026-08-02

Verdict received: BLOCK (1 blocker, 5 important, 5 minor). Each finding was verified against code before ruling. Fix commits follow; parked items carry rulings for r2.

## ACCEPTED — will fix

**#1 BLOCKER (authed demo-cap DoS)** — VERIFIED. `_recent_demo_session_filter` counts all sessions; authed demo creates bypass both guards (free-plan cap has `not doc.demo_slug`, anon limiter has `user is None`). Note: the vector PRE-DATES this batch (old lifetime count had the same bypass, with permanent instead of 24h damage), but it must close now. Fix: (a) anon cap counts only `user_id IS NULL` rows; (b) free-plan users get a per-user session cap on demo docs (`FREE_MAX_SESSIONS_PER_DOC`, counting only their own sessions — the existing free-cap query counts everyone's rows and would instantly lock demo docs otherwise); (c) cleanup task extended to ALSO prune empty authed demo sessions >7d (closes row accumulation).

**#2 IMPORTANT (counter vs server truth)** — VERIFIED; the fix-round-2 subtraction model breaks on Redis TTL expiry (restored transcript keeps counting → UI hard-locks a user the backend would allow — harms the exact loop this batch fixes). Fix: baseline model — store `demoRestoredUserMsgCount` at restore; `useChatStream` counts only user messages beyond the baseline; `demoMessagesUsed` reverts to the raw server count. TTL-expiry, IP-change cases then converge to server truth at every restore. Regen/continue: client now also bumps the counter on demo regenerate/continue (backend increments quota on both).

**#3 IMPORTANT (pointer lifecycle)** — VERIFIED. Fix: shared try/catch storage helper; pointer written on every anon-demo session create/switch; cleared only on 404/403 (transient errors keep it); storage-disabled environments degrade to the old create path.

**#5 IMPORTANT (share copy honesty)** — ACCEPTED as framed: adoption stays out of P0, but the control must not claim "Share conversation" for anonymous users. Fix: anon share buttons get explicit copy "Sign in to share this conversation" (new key, all 11 locales).

**#6 IMPORTANT, index half** — ACCEPTED: partial index `(document_id, created_at) WHERE user_id IS NULL` via alembic.

**#8 MINOR (schema)** — ACCEPTED: `demo_messages_used` added to `SessionMessagesResponse`, endpoint returns the typed model.

**#9 MINOR (override URL)** — ACCEPTED: resolve via `new URL(override, origin)` + reject origin mismatch.

**#10 MINOR (aria-label)** — ACCEPTED: label renamed to "questions remaining" semantics (new key ×11).

**#11 MINOR (locale breadcrumb)** — ACCEPTED: breadcrumb uses the localized-href helper like other marketing pages.

## PARKED — with rulings (challenge in r2 if the reasoning is wrong)

**#4 shared-machine transcript restore** — Ruling: accept-with-ruling. sessionStorage is per-tab AND cleared on tab close; cross-person restore requires a second person reusing a still-open tab. Content sensitivity is bounded: demo sessions exist only on the 3 public sample documents, capped at 5 user messages. The #3 fixes make an active session visible and replaceable (dropdown + New Chat). An explicit resume-consent prompt would tax the majority case (same person returning) to guard a low-sensitivity edge case. Revisit when demo supports user-uploaded content.

**#6 atomicity half** — Ruling: real but accepted. The 500 cap is an abuse guard, not a billed quota; concurrent-create overshoot is bounded by simultaneous in-flight requests and self-corrects next window. Per-document serialization would add locking to the demo hot path for no user-visible benefit.

**#7 cleanup race on resumed 8d-old empty session** — Ruling: real, narrow (window = between access check and first message commit, once per day at beat time, only for sessions empty for 7+ days). Failure mode is one failed request followed by clean session recreation. Not worth cross-process coordination at this scale.

## Cleared surfaces (r1) — carried forward
Key scoping (incl. continuation), 24h SQL boundary, cleanup predicates (outside #7's window), public-event limits/sanitizer, 11-locale copy + SSR prefix coverage + hreflang/sitemap, class sweep completeness.
