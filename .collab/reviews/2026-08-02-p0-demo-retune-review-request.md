# Adversarial Review Request — P0 batch: demo re-tune + invisible-white UI fixes

You are the adversarial reviewer for this batch. Your job is to try to BREAK it: find correctness bugs, security holes, billing/abuse vectors, contract violations, and UX promises the code doesn't keep. Do not rubber-stamp. Cite file:line for every finding, classify severity (BLOCKER / IMPORTANT / MINOR / NOTE), and end with an overall verdict: CONSENSUS-SHIP, REVISE (list must-fix), or BLOCK.

## Scope

All commits `40733b8..aaeb334` on `main` (12 commits). Inspect with:
```
git log --oneline 04a2eb89..aaeb334
git diff 04a2eb89..aaeb334
```
Plan (context + intended contracts): `.collab/plans/2026-08-02-p0-demo-retune-ui-fixes.md`
Implementation + internal review trail: `.superpowers/sdd/2026-08-02-p0-demo-retune-ui-fixes/` (wave reports; internal reviewers already ran — find something they missed).

## What the batch does

Backend (`backend/app/api/chat.py`, `events.py`, `workers/cleanup_tasks.py`, `celery_app.py`):
1. Demo message limit now keyed per (client IP, document) — `_demo_message_key` — instead of one global 5/24h counter shared across all 3 demo docs. The messages GET endpoint now also returns `demo_messages_used` for anonymous demo sessions.
2. `DEMO_MAX_SESSIONS_PER_DOC` (500) now counts a rolling 24h window (`_recent_demo_session_filter`) instead of lifetime.
3. New daily Celery task `cleanup_empty_demo_sessions` prunes anonymous demo sessions >7d old with zero messages.
4. `auth_confirm_viewed` / `auth_confirm_clicked` added to ALLOWED_EVENTS + PUBLIC_EVENTS.

Frontend:
5. Anonymous demo session REUSE: sessionStorage key `dt-demo-session:{documentId}`, written only when createSession returns `demo_messages_used != null`; on revisit the stored session is adopted via GET messages (no new POST /sessions). Counter contract: `demoMessagesUsed` = server usage NOT in the local transcript (fix round 2 corrected a double-count here).
6. `openAuthModal({ callbackUrl })` override primitive; demo-cap CTA sends converts to `/` (dashboard); override cleared on any open→close transition.
7. `[locale]/demo` page, SSR-translated via seeded LocaleProvider + `getScopedMessages(locale, DEMO_PREFIXES)`; `/demo` in LOCALIZED_PATHS; canonical page emits hreflang; cap copy corrected to "per sample document" ×11 locales.
8. Share buttons now render for anonymous users; click → `trackEvent('upgrade_click', {source:'demo_share_attempt'})` → auth modal.
9. ~40 invisible-on-white utility fixes across MessageBubble/ChatPanel/AppHeaderShell/PublicHeader/DashboardPageClient (dark-glass leftovers from de-glass commit 0b7404a), + demo progressbar aria fix.

## Attack surfaces to probe (minimum set — go beyond it)

1. **Demo key scoping**: can a client evade the per-doc cap or force the old key? Continuation endpoint (`chat_continue`) was also scoped — is any OTHER message-producing path still on a stale key or unmetered? Is the `f"{ip}:{doc_id}"` composite injectable/collidable (IPv6, proxied IPs, `get_client_ip` behavior)?
2. **Rolling window**: off-by-one, timezone, missing index making the count query slow under load, race between check and insert.
3. **Cleanup task**: can it ever delete a session with messages, an authed session, or a non-demo session? Transaction/lock behavior on Postgres; interaction with a concurrent message insert on a 7d-old empty session.
4. **sessionStorage reuse**: cross-user transcript exposure on shared machines (sessionStorage is per-tab-session — is that actually sufficient?); what happens when an authed user hits a doc with a leftover anon key; stale/pruned session handling; the `demo_messages_used` merge on the messages endpoint — information leak to non-owners?
5. **Auth-modal override**: open-redirect surface — override is embedded as `${window.location.origin}${override}`; can a crafted override ("//evil.com", "https://evil.com", "javascript:") escape same-origin? Who can set the override (only first-party code today — but is the primitive footgun-proof)? Auth.js callbackUrl validation behavior as defense-in-depth.
6. **Anon share affordance**: the signup flow does NOT preserve the anonymous transcript (accepted tradeoff, documented in code comment) — is the resulting UX a broken promise severe enough to demand session adoption now, or acceptable as a conversion hook? Challenge the acceptance if you disagree.
7. **i18n**: all 11 locales updated correctly (flat keys, native phrasing); [locale]/demo SSR-translation completeness (DEMO_PREFIXES vs actual render tree); hreflang/sitemap consistency.
8. **Class sweep**: any missed invisible-on-white site in the five files, or an over-fix that changed dark-mode appearance.
9. **Events whitelist**: abuse surface of the two new PUBLIC_EVENTS names (rate limits, row spam, PII in properties).

## Already-known/accepted items (challenge if you believe they're wrong, otherwise don't re-litigate)

- Anonymous transcript not preserved through share-driven signup (comment in ChatPanel; session adoption = follow-up).
- Two mapping-table rows intentionally render flat zinc in dark mode (typing dots, disclaimer) — plan-accepted.
- `test_demo_limits.py` A2 test is a shallow SQL-string assertion; compiled SQL was independently verified (`created_at > now() - make_interval(secs=>86400.0)`).
- `rowcount or 0` latent `-1` fragility in cleanup task — copy-consistent with pre-existing sibling task.
- Anonymous `chat_message_sent/completed` events 401 at the events endpoint — PRE-EXISTING design (not in PUBLIC_EVENTS), out of batch scope.

## Verification already performed (don't repeat, audit the claims)

- Backend: ruff clean; 543 passed/3 skipped with docker (SKIP_INTEGRATION=0), 538/8 without; no new failures.
- Frontend: tsc + eslint clean; `npm run build` clean at final HEAD; `/[locale]/demo` SSG ×10 locales.
- Live browser + Redis: per-doc counters independent; session reuse (GET messages only, zero POST /sessions on revisit, history restored); counter matches server truth after fix round 2; cap panel + CTA → auth modal; anon share → auth modal + 204 event row; `/de/demo` SSR German H1; anon `auth_confirm_viewed` → 204; dark mode no regressions.

Write your findings as a markdown report to stdout. Severity-ranked, file:line cited, verdict at the end.
