Reading prompt from stdin...
2026-08-01T23:11:16.365494Z ERROR codex_core::session::session: failed to load skill /Users/mayijie/Projects/Code/010_DocTalk/.agents/skills/deploy/SKILL.md: missing YAML frontmatter delimited by ---
2026-08-01T23:11:16.365526Z ERROR codex_core::session::session: failed to load skill /Users/mayijie/Projects/Code/010_DocTalk/.agents/skills/codex-implement/SKILL.md: missing YAML frontmatter delimited by ---
OpenAI Codex v0.144.0
--------
workdir: /Users/mayijie/Projects/Code/010_DocTalk
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR]
reasoning effort: xhigh
reasoning summaries: none
session id: 019fbf98-9747-7c02-9e79-34d5c9bf58a5
--------
user
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

codex
I’ll review the full commit range against the written contracts, then trace each attack surface through callers, tests, schema/indexes, and related auth/rate-limit code. I’ll report only evidence-backed findings with current-HEAD file:line citations and won’t modify the workspace.
  → Read project rules, plan, internal review trail, and commit-range summary
  • Audit backend demo metering, session limits, cleanup concurrency, and public events
  • Audit frontend session reuse, auth redirect, i18n, sharing, and class changes
  • Validate suspected issues against tests/history and write severity-ranked verdict
exec
/bin/zsh -lc "pwd && sed -n '1,240p' .claude/rules/backend.md && sed -n '1,260p' .claude/rules/frontend.md && git log --oneline 04a2eb89..aaeb334 && git diff --stat 04a2eb89..aaeb334 && printf '\\nPLAN\\n' && sed -n '1,320p' .collab/plans/2026-08-02-p0-demo-retune-ui-fixes.md && printf '\\nTRAIL FILES\\n' && rg --files .superpowers/sdd/2026-08-02-p0-demo-retune-ui-fixes" in /Users/mayijie/Projects/Code/010_DocTalk
 exited 1 in 0ms:
/Users/mayijie/Projects/Code/010_DocTalk
---
paths:
  - "backend/**"
---

# Backend Conventions

## Async Safety
- **MinIO calls MUST use `asyncio.to_thread()`** in async endpoints. MinIO client is sync (urllib3). Direct calls block event loop; when MinIO is unreachable, blocks ALL requests for 30+s. Client configured with short timeouts (connect=5s, read=10s, 2 retries)
- **Celery uses sync DB** (`psycopg`), API uses async (`asyncpg`). Never mix.

## Credits & Billing
- **Two-stage debit**: ① Pre-check balance (402 if insufficient) → ② `debit_credits()` pre-debits estimated cost (returns ledger ID) → stream → `reconcile_credits()` UPDATEs same ledger entry to actual cost. Single ledger record per chat. LLM failure → DELETE entry + full refund
- **`ChatRequest` exposes only `mode` field** (`quick`/`balanced`; legacy `thorough` is retired). `model` field removed — prevents billing bypass
- Stripe webhook: `checkout.session.completed` for subscriptions only updates plan (no credits); `invoice.payment_succeeded` grants monthly credits (idempotent by invoice.id)
- `POST /api/billing/cancel` is self-serve and records optional `cancel_reason`, `cancel_feedback`, and `refund_requested` metadata in `plan_transitions`. `refund_requested` is an internal review flag; do not issue Stripe refunds from this path unless an explicit refund workflow is added.

## Parse Worker
- `time_limit=600`, `soft_time_limit=540`, `autoretry_for=(Exception,)`, max 2 retries, 60s backoff
- Idempotent re-parse: **delete Qdrant vectors (by `document_id` filter) BEFORE deleting DB pages/chunks**. Ordering matters — a Qdrant outage must leave the existing rows intact (set error + return), else the two stores diverge / data is lost. Then re-index.
- **OCR trigger = `detect_scanned` (no text layer) OR `detect_low_quality_text` (PDF text layer present but garbled — broken-font cmap, Unicode-aware quality score)**. R2b fix for docs like U13 that have garbage text and so were never detected as "scanned".
- **OCR language is content-based**: `detect_script_osd` runs `tesseract --psm 0` (OSD) on sample pages → `resolve_ocr_languages(locale, script)` returns a NARROW set (script family, ≤3, **no `eng` for non-Latin** — it injects Latin noise). Never the kitchen-sink set (causes cross-script hallucination); locale only refines within a script family. Adopt a low-quality re-OCR only if it beats the text-layer quality. Persist `parse_version`/`parse_method`/`text_quality`/`ocr_languages` on the doc.
- Backfill stale/low-quality docs with `scripts/find_low_quality_docs.py` (skips `parse_version>=current` unless `--force`).

## Auth
- **`FOR UPDATE` lock** on verification tokens to prevent TOCTOU
- Internal Auth Adapter API uses `X-Adapter-Secret` header

## Error Handling
- Use `HTTPException` (not `JSONResponse`) for all non-SSE endpoints
- Lifespan pattern (`@asynccontextmanager`) instead of deprecated `@app.on_event`

## Demo System
- 3 seed PDFs auto-deployed at startup from `backend/seed_data/`. Self-healing: detects Qdrant data loss → full re-seed
- Anonymous: 5 msgs/session, 500 sessions/doc, 10 req/min/IP, forced DeepSeek V4 Flash
- Logged-in users accessing demo docs use their credits with no message limit
---
paths:
  - "frontend/**"
---

# Frontend Conventions

## Architecture
- **All pages are `"use client"`** — client components with server wrapper for metadata
- Pages that fetch API data must render meaningful content in loading AND error states (prevents Google Soft 404)

## API Proxy
- **ALL** frontend→backend calls go through `/api/proxy/*` route, which injects JWT. Including SSE chat stream (`sse.ts`). Missing this = 401 errors
- **JWT double-layer**: Auth.js uses encrypted JWE (unreadable by backend). Proxy creates plain HS256 JWT via `jose`. Backend `deps.py` validates exp/iat/sub
- `allowDangerousEmailAccountLinking: true` enables cross-provider auto-linking by email
- **Proxy maxDuration**: `route.ts` exports `maxDuration = 60` (Vercel Hobby limit). SSE chat 60s timeout, others 30s

## UI Design System
- **Palette (app UI)**: zinc monochrome + blue accent (`#1D4ED8`/`#60A5FA`). Zero `gray-*`/`indigo-*`/`violet-*`/`purple-*` classes (except Google OAuth brand + status colors). Zero `transition-all` (use specific properties)
- **Editorial marketing layer**: the entire public marketing surface (unauthenticated `/`, `use-cases/*`, `compare/*`, `alternatives/*`, `features/*`, `tools/*`, `pricing`, `trust`, `demo`) uses a SEPARATE scoped editorial design system — `frontend/src/app/editorial.css` (every rule under `.dt-editorial`), a warm-paper palette (`--ed-paper`/`--ed-ink`/`--ed-signal` terracotta `#b0472f`/`--ed-ochre`) with Newsreader serif + IBM Plex Mono fonts, **light-only**. It does NOT use the zinc/blue app palette. **Design decision locked 2026-05-20**: the product runs on TWO surface treatments (editorial marketing terracotta+warm-paper vs functional app zinc+blue) sharing one token base (logo, body font Inter, spacing scale, micro-interactions). A blue-accent unification was tried and reverted because the warm-paper terracotta identity is load-bearing. Do not re-propose merging the accents. Marketing pages compose the shared editorial kit in `frontend/src/components/marketing/` (`MarketingShell`, `EditorialMarketingHeader`, `EdPageHero`, `EdSection`, `EdProse`, `EdFeatureList`, `EdCardGrid`, `EdStepRow`, `EdFaqList`, `EdCtaBanner`, `EdComparisonTable`, `EdInlineCell`, `EdRelatedLinks`, `EdCheckList`, `EdChoiceList`) — `MarketingShell` supplies the `.dt-editorial` root, so kit components never add it themselves. Keep editorial styles scoped under `.dt-editorial`; do not let them leak into the functional app UI, and do not apply the zinc/blue rule to editorial components. Pages still on the zinc/blue app palette: `about`, `contact`, `imprint`, `privacy`, `terms`, `blog/*`, `document-diff` (not yet editorialized).
- **i18n**: Components using `t()` MUST be inside `<LocaleProvider>`. Outside = raw key fallback. Only `en` is statically loaded; other 10 locales lazy-loaded

## PDF & Documents
- **react-pdf v9 CJK**: After upgrading react-pdf/pdfjs-dist, MUST re-copy `cmaps/`, `standard_fonts/`, `pdf.worker.min.mjs` to `public/`. Worker loaded from same-origin (not CDN) for CSP compliance
- **bbox coordinates**: Normalized [0,1], top-left origin. Three citation highlight strategies: ① PDF bbox, ② TextViewer text-snippet match, ③ converted PDF fallback to text-snippet when dummy bbox detected

## Subscriptions & Feature Gating
- Free (300/mo) + Plus (3K/mo, $9.99) + Pro (9K/mo, $19.99). Annual = 20% discount
- Visible modes are Flash and Pro. Internal IDs remain `quick` and `balanced`; retired modes such as `thorough` must migrate to Flash.
- Free includes Flash plus a capped number of Pro answers/month. Export: Plus+ (frontend gated). Custom Instructions: Pro (backend gated). Sessions: Free=3/doc (backend gated)
- Credit packs: Boost(500/$3.99), Power(2K/$9.99), Ultra(5K/$19.99)
- Cancellation UI must remain self-serve. The cancel form may collect an optional reason, optional feedback, and a refund-review checkbox, but it must not block cancellation on those fields.
aaeb334 fix(demo): review round 2 — reuse path double-counted demo message usage
7a31bfe fix(demo): review round 1 — session dropdown, SSR i18n, override lifecycle, fr copy
db7d263 fix(ui): thumbs-up active state invisible in light mode (W2 review fix round 1)
5cb74dc feat(demo): share affordance for anonymous users + upload CTA lands on dashboard
1523370 fix(ui): restore light-mode visibility for shell/dashboard chrome
ae83e1f fix(ui): restore light-mode visibility for chat controls de-glassed in 0b7404a
f627557 fix(demo): emit hreflang alternates on canonical /demo page
f5850e5 feat(demo): locale URLs for /demo + truthful per-document cap copy
0614e0e feat(auth): optional callbackUrl override for the auth modal
25f8e8e fix(demo): reuse anonymous demo session across page views via sessionStorage
db81487 fix(telemetry): whitelist pre-auth auth_confirm events
b459e4f feat(demo): nightly prune of empty anonymous demo sessions
ad7cbae fix(demo): session-per-doc cap counts a 24h rolling window, not lifetime
40733b8 fix(demo): scope demo message limit per (IP, document) as advertised
 backend/app/api/chat.py                            | 56 +++++++++++---
 backend/app/api/events.py                          |  4 +
 backend/app/workers/celery_app.py                  |  4 +
 backend/app/workers/cleanup_tasks.py               | 43 +++++++++++
 backend/tests/test_cleanup_tasks.py                | 86 ++++++++++++++++++++++
 backend/tests/test_demo_limits.py                  | 26 +++++++
 backend/tests/test_events_api.py                   | 31 ++++++++
 frontend/src/app/[locale]/demo/page.tsx            | 52 +++++++++++++
 frontend/src/app/demo/page.tsx                     |  1 +
 frontend/src/app/features/free-demo/page.tsx       |  4 +-
 frontend/src/components/AppHeaderShell.tsx         |  4 +-
 frontend/src/components/AuthModal.tsx              | 19 ++++-
 frontend/src/components/Chat/ChatPanel.tsx         | 35 +++++----
 frontend/src/components/Chat/MessageBubble.tsx     | 20 ++---
 frontend/src/components/PublicHeader.tsx           |  4 +-
 .../components/dashboard/DashboardPageClient.tsx   | 18 ++---
 frontend/src/i18n/locales/ar.json                  |  2 +-
 frontend/src/i18n/locales/de.json                  |  2 +-
 frontend/src/i18n/locales/en.json                  |  2 +-
 frontend/src/i18n/locales/es.json                  |  2 +-
 frontend/src/i18n/locales/fr.json                  |  2 +-
 frontend/src/i18n/locales/hi.json                  |  2 +-
 frontend/src/i18n/locales/it.json                  |  2 +-
 frontend/src/i18n/locales/ja.json                  |  2 +-
 frontend/src/i18n/locales/ko.json                  |  2 +-
 frontend/src/i18n/locales/pt.json                  |  2 +-
 frontend/src/i18n/locales/zh.json                  |  2 +-
 frontend/src/i18n/routing.ts                       |  1 +
 frontend/src/lib/api.ts                            |  6 +-
 frontend/src/lib/auth-modal.ts                     | 15 +++-
 frontend/src/lib/useChatSession.ts                 | 54 ++++++++++++++
 31 files changed, 441 insertions(+), 64 deletions(-)

PLAN
# P0: Demo Re-tune + Invisible-White UI Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the demo funnel's four self-inflicted walls (shared message cap, lifetime session bomb, session-create burn, dead-end CTA) and the ~40 invisible-on-white UI regressions left by the de-glassing commit `0b7404a`, plus unblock the `auth_confirm_*` telemetry.

**Architecture:** Backend changes are confined to `backend/app/api/chat.py` (key scoping + rolling window), `backend/app/api/events.py` (whitelist), and a new cleanup task in `backend/app/workers/cleanup_tasks.py`. Frontend changes: session reuse in `useChatSession`, auth-modal callback override, one new locale route (`[locale]/demo`), and a mechanical light-mode class sweep across 6 files.

**Tech Stack:** FastAPI + SQLAlchemy(async) + Redis rate-limit trackers; Next.js 14 App Router + Tailwind + zustand.

## Global Constraints

- Palette rule (CLAUDE.md): app UI = zinc monochrome + blue accent `#1D4ED8`/`#60A5FA`. **Zero `gray-*`/`indigo-*`/`violet-*`/`purple-*` classes, zero `transition-all`.**
- i18n rule: any changed/new locale key must hit **all 11 locales** (en/zh/ja/ko/es/de/fr/pt/it/ar/hi); use `tOr(key, fallback)` only for brand-new keys.
- Locale JSONs use **flat dotted keys** (`"demo.title": "..."`), never nested objects — a nested key breaks `next build`.
- Backend: use `HTTPException` (not JSONResponse) for errors; Celery uses **sync** DB (`app.models.sync_database`), API uses async. Never mix.
- **Never run `npm run build` while a dev server is running** (it corrupts `.next/`). Check `lsof -i :3000 -i :3001` first.
- Verification contract before claiming done: `cd frontend && npm run build` · `cd backend && python3 -m ruff check app/ tests/` · `cd backend && python3 -m pytest` (full suite currently 533 green).
- Commits on `main` (development branch). Every commit message ends with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Codex adversarial review is MANDATORY at the end (batch > 30 lines of logic). Codex cannot run git; commit from Claude.

## Execution waves

- **Wave 1 (parallel):** Agent-B = Tasks A1–A4 (backend). Agent-F = Tasks B1, B2, B4 (frontend funnel).
- **Wave 2 (after Wave 1):** Agent-V = Tasks C1, C2, B3 (frontend visual sweep + share affordance; touches the same files as C1/C2 and consumes B2's new `openAuthModal` signature).
- **Wave 3:** integration testing, then Codex review rounds.

File-conflict map (why the waves): `ChatPanel.tsx` is touched by C1 and B3 only (Wave 2). `chat.py` only by Agent-B. `useChatSession.ts` only by Agent-F.

---

### Task A1: Per-document demo message counting

Demo message limit today is 5 msgs / IP / 24h **shared across all 3 sample docs** (tracker key = bare `client_ip`), while shipped copy (`en.json` key `demo.freeMessages`) promises "5 free messages per document". Scope the key by document. Also surface `demo_messages_used` on the messages endpoint so the frontend can restore the counter when it reuses a stored session (consumed by Task B1).

**Files:**
- Modify: `backend/app/api/chat.py` (constants at ~:47, send path ~:340-346, create-session response ~:246-252, `get_session_messages` ~:557+)
- Test: `backend/tests/test_demo_limits.py` (new)

**Interfaces:**
- Produces: `_demo_message_key(client_ip: str, document_id) -> str` (module-level helper in `chat.py`, returns `f"{client_ip}:{document_id}"`).
- Produces: `GET /api/sessions/{id}/messages` response gains optional `demo_messages_used: int` for anonymous demo sessions (JSON merge, same pattern as create-session at `chat.py:246-252`). Task B1 reads it.

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_demo_limits.py
import uuid

import pytest

from app.api.chat import _demo_message_key
from app.core.rate_limit import InMemoryDemoMessageTracker


def test_demo_message_key_is_scoped_by_document():
    doc_a, doc_b = uuid.uuid4(), uuid.uuid4()
    assert _demo_message_key("1.2.3.4", doc_a) != _demo_message_key("1.2.3.4", doc_b)
    assert _demo_message_key("1.2.3.4", doc_a) == _demo_message_key("1.2.3.4", doc_a)
    assert _demo_message_key("1.2.3.4", doc_a) != _demo_message_key("5.6.7.8", doc_a)


def test_demo_counters_independent_per_document():
    tracker = InMemoryDemoMessageTracker()
    doc_a, doc_b = uuid.uuid4(), uuid.uuid4()
    for _ in range(5):
        tracker.increment(_demo_message_key("1.2.3.4", doc_a))
    assert tracker.get_count(_demo_message_key("1.2.3.4", doc_a)) == 5
    assert tracker.get_count(_demo_message_key("1.2.3.4", doc_b)) == 0
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && python3 -m pytest tests/test_demo_limits.py -v`
Expected: FAIL — `ImportError: cannot import name '_demo_message_key'`

- [ ] **Step 3: Implement**

In `backend/app/api/chat.py`, below `DEMO_MESSAGE_LIMIT = 5`:

```python
def _demo_message_key(client_ip: str, document_id) -> str:
    """Demo message counter key, scoped per (IP, document).

    Marketing promises "5 free messages per document" — the counter must not
    be shared across the 3 sample docs. TTL (24h) is handled by the tracker.
    """
    return f"{client_ip}:{document_id}"
```

Three call-site changes:
1. Send path (~:342): `demo_message_tracker.check_and_increment(_demo_message_key(client_ip, session.document_id), DEMO_MESSAGE_LIMIT)`
2. Create-session response (~:248): `used = await demo_message_tracker.get_count(_demo_message_key(client_ip, doc.id))` — and update the now-stale comment above it ("limit is global per IP" → "limit is per IP per document").
3. In `get_session_messages` (find the handler for `GET /sessions/{session_id}/messages`): after the session is verified, mirror the create-session pattern — if the session is anonymous (`session.user_id is None`) and its document has `demo_slug`, return `JSONResponse` merging `{"demo_messages_used": used}` into the normal response using the same helper key. Import nothing new except what's already in the module.

- [ ] **Step 4: Run tests**

Run: `cd backend && python3 -m pytest tests/test_demo_limits.py -v && python3 -m ruff check app/ tests/`
Expected: PASS, ruff clean.

- [ ] **Step 5: Full-suite regression + commit**

Run: `cd backend && python3 -m pytest -q` (expect no new failures vs baseline)

```bash
git add backend/app/api/chat.py backend/tests/test_demo_limits.py
git commit -m "fix(demo): scope demo message limit per (IP, document) as advertised

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task A2: Demo session cap becomes a 24h rolling window

`DEMO_MAX_SESSIONS_PER_DOC = 500` at `chat.py:48` is compared against a **lifetime** count (`chat.py:218-229`); nothing ever prunes sessions, so each demo doc dies permanently at 500 with copy that says "try again later". Make the guard a rolling 24-hour window (abuse guard semantics, same limit).

**Files:**
- Modify: `backend/app/api/chat.py:218-229`
- Test: `backend/tests/test_demo_limits.py` (extend)

**Interfaces:**
- Produces: `_recent_demo_session_filter(document_id)` — module-level helper returning the SQLAlchemy where-clause list, so the window is unit-testable.

- [ ] **Step 1: Write the failing test**

```python
# append to backend/tests/test_demo_limits.py
from app.api.chat import _recent_demo_session_filter


def test_demo_session_window_filters_by_24h():
    clauses = _recent_demo_session_filter(uuid.uuid4())
    sql = " ".join(str(c) for c in clauses)
    assert "created_at" in sql  # lifetime count regression guard
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && python3 -m pytest tests/test_demo_limits.py -v` — FAIL (ImportError).

- [ ] **Step 3: Implement**

In `chat.py` (near the other helper):

```python
def _recent_demo_session_filter(document_id):
    """Anonymous demo session cap counts a rolling 24h window, not lifetime.

    Lifetime counting killed each demo doc permanently at 500 sessions.
    """
    return [
        ChatSession.document_id == document_id,
        ChatSession.created_at > func.now() - dt.timedelta(hours=24),
    ]
```

(`import datetime as dt` if not present; `func` is already imported.) Replace the count query at :224-227:

```python
        session_count = await db.execute(
            select(func.count(ChatSession.id)).where(*_recent_demo_session_filter(document_id))
        )
```

- [ ] **Step 4: Run tests + ruff**

Run: `cd backend && python3 -m pytest tests/test_demo_limits.py -v && python3 -m ruff check app/ tests/` — PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/chat.py backend/tests/test_demo_limits.py
git commit -m "fix(demo): session-per-doc cap counts a 24h rolling window, not lifetime

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task A3: Nightly prune of empty anonymous demo sessions

Sessions table only ever grows; anonymous demo browsing creates rows with zero messages. Add a beat task deleting anonymous demo sessions older than 7 days that have no messages.

**Files:**
- Modify: `backend/app/workers/cleanup_tasks.py` (follow the existing `cleanup_expired_verification_tokens` pattern — sync DB)
- Modify: `backend/app/workers/celery_app.py:51-56` (beat schedule)
- Test: `backend/tests/test_cleanup_tasks.py` (extend, following its existing fixture pattern)

**Interfaces:**
- Produces: Celery task `cleanup_empty_demo_sessions()` → returns int (deleted count).

- [ ] **Step 1: Read `backend/tests/test_cleanup_tasks.py` and `cleanup_tasks.py` first** — reuse their session/fixture pattern exactly (sync SQLAlchemy session; the test file shows how the existing cleanup task is tested).

- [ ] **Step 2: Write the failing test** — in the style of the existing ones: create (a) an anonymous session on a demo document, 8 days old, 0 messages → deleted; (b) same but with 1 message → kept; (c) anonymous, demo doc, 1 day old, 0 messages → kept; (d) authed session 8 days old, 0 messages → kept. Assert return value == 1.

- [ ] **Step 3: Run to verify failure.**

- [ ] **Step 4: Implement** in `cleanup_tasks.py`:

```python
@celery_app.task(name="cleanup_empty_demo_sessions")
def cleanup_empty_demo_sessions() -> int:
    """Delete anonymous demo sessions older than 7 days with no messages."""
    with SyncSessionLocal() as db:  # match the module's existing session factory name
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        stmt = (
            sa.delete(ChatSession)
            .where(
                ChatSession.user_id.is_(None),
                ChatSession.created_at < cutoff,
                ChatSession.document_id.in_(
                    sa.select(Document.id).where(Document.demo_slug.isnot(None))
                ),
                ~sa.exists(sa.select(Message.id).where(Message.session_id == ChatSession.id)),
            )
        )
        result = db.execute(stmt)
        db.commit()
        return result.rowcount or 0
```

Adapt imports/factory names to what the module actually uses. Beat schedule addition in `celery_app.py`:

```python
    "cleanup-empty-demo-sessions-daily": {
        "task": "cleanup_empty_demo_sessions",
        "schedule": 86400,
    },
```

- [ ] **Step 5: Tests + ruff + commit**

```bash
git add backend/app/workers/cleanup_tasks.py backend/app/workers/celery_app.py backend/tests/test_cleanup_tasks.py
git commit -m "feat(demo): nightly prune of empty anonymous demo sessions

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task A4: Unblock auth_confirm telemetry

`frontend/src/app/auth/confirm/page.tsx:52,59` fires `auth_confirm_viewed` / `auth_confirm_clicked`, but `backend/app/api/events.py` rejects both with 400 — they are in neither `ALLOWED_EVENTS` nor `PUBLIC_EVENTS`. This blinds the v0.22.0 post-deploy watchlist (scanner-vs-human ratio). The page is pre-auth, so both sets need the names.

**Files:**
- Modify: `backend/app/api/events.py:15-62`
- Test: `backend/tests/test_events_api.py` (extend, follow existing test pattern)

- [ ] **Step 1: Write the failing test** — following the existing anonymous-event test in `test_events_api.py`: POST `{"event_name": "auth_confirm_viewed", "properties": {"valid": 1}}` unauthenticated → expect 204; same for `auth_confirm_clicked`.
- [ ] **Step 2: Run to verify failure** (currently 400).
- [ ] **Step 3: Implement** — add `"auth_confirm_viewed", "auth_confirm_clicked"` to BOTH `ALLOWED_EVENTS` and `PUBLIC_EVENTS`.
- [ ] **Step 4: Tests + ruff.**
- [ ] **Step 5: Commit**

```bash
git add backend/app/api/events.py backend/tests/test_events_api.py
git commit -m "fix(telemetry): whitelist pre-auth auth_confirm events

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task B1: Anonymous demo session reuse (kill the session-create burn)

Every reader load for an anonymous demo user burns one of 5 session-creates per 5 min (`listSessions` returns `[]` by design → `useChatSession` always falls through to `createSession`). Browsing the 3 demo docs plus back-navigation trips a 429 that replaces chat with "wait 300s". Fix: persist the anon demo session id in `sessionStorage` and re-adopt it on mount.

**Files:**
- Modify: `frontend/src/lib/useChatSession.ts`
- Modify: `frontend/src/lib/api.ts` (messages response type gains optional `demo_messages_used`)

**Interfaces:**
- Consumes: `demo_messages_used` on `GET /sessions/{id}/messages` (Task A1).
- Storage contract: `sessionStorage["dt-demo-session:" + documentId] = session_id`. Written ONLY when `createSession` response contains `demo_messages_used != null` (that field is only present for anonymous demo sessions — no new props needed to detect anon demo).

- [ ] **Step 1: Implement the reuse flow** in `useChatSession.ts`. New mount sequence inside the existing async IIFE, BEFORE the `listSessions` call:

```ts
      // Anonymous demo: re-adopt the session we created earlier this browser
      // session instead of burning a create per page view (5-per-5min IP cap).
      const demoKey = `dt-demo-session:${documentId}`;
      const storedDemoSession = typeof window !== 'undefined' ? sessionStorage.getItem(demoKey) : null;
      if (storedDemoSession) {
        try {
          const msgsData = await getMessages(storedDemoSession);
          if (cancelled) return;
          setSessionId(storedDemoSession);
          setSessions([]);
          setMessages(msgsData.messages);
          if (msgsData.demo_messages_used != null) {
            setDemoMessagesUsed(msgsData.demo_messages_used);
          } else {
            setDemoMessagesUsed(msgsData.messages.filter((m) => m.role === 'user').length);
          }
          return; // adopted — skip listSessions/createSession entirely
        } catch {
          sessionStorage.removeItem(demoKey); // stale/pruned session — fall through
        }
      }
```

And in the existing `createSession` success branch (where `s.demo_messages_used != null` is already checked), add:

```ts
          if (s.demo_messages_used != null && typeof window !== 'undefined') {
            sessionStorage.setItem(`dt-demo-session:${documentId}`, s.session_id);
          }
```

Guard: authenticated users never have the key written (their create responses lack `demo_messages_used`), and if a signed-in user hits a doc with a leftover key from an earlier anonymous visit, `getMessages` on an anonymous session still succeeds only for anon callers on demo docs (`verify_session_access`, `chat.py:136-140` returns the session only when `user is None`); for an authed caller it 404s → key cleared → normal flow. State that behavior in a comment.

- [ ] **Step 2: Type the new field** in `frontend/src/lib/api.ts` — find the messages response type used by `getMessages` and add `demo_messages_used?: number | null;`.

- [ ] **Step 3: Verify** — `cd frontend && npx tsc --noEmit && npx next lint --quiet` (build happens in the integration phase).

- [ ] **Step 4: Commit**


TRAIL FILES

exec
/bin/zsh -lc "printf '%s\\n' 'TRAIL FILES' && rg --files --hidden .superpowers/sdd/2026-08-02-p0-demo-retune-ui-fixes && printf '%s\\n' 'PLAN CONTINUED' && sed -n '300,760p' .collab/plans/2026-08-02-p0-demo-retune-ui-fixes.md && printf '%s\\n' 'INTERNAL REPORTS' && for f in "'$(rg --files --hidden .superpowers/sdd/2026-08-02-p0-demo-retune-ui-fixes | sort); do printf '"'\\n===== %s =====\\n' \""'$f"; sed -n '"'1,320p' \""'$f"; done' in /Users/mayijie/Projects/Code/010_DocTalk
 exited 1 in 0ms:
TRAIL FILES

exec
/bin/zsh -lc "ls -la .superpowers 2>&1; ls -la .superpowers/sdd/2026-08-02-p0-demo-retune-ui-fixes 2>&1; rg --files --hidden --no-ignore .superpowers/sdd/2026-08-02-p0-demo-retune-ui-fixes 2>&1 || true; wc -l .collab/plans/2026-08-02-p0-demo-retune-ui-fixes.md; sed -n '280,700p' .collab/plans/2026-08-02-p0-demo-retune-ui-fixes.md" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
total 0
drwxr-xr-x@  4 mayijie  staff   128 Aug  2 00:16 .
drwxr-xr-x  43 mayijie  staff  1376 Jul  4 17:58 ..
drwxr-xr-x@  4 mayijie  staff   128 May 18 23:57 brainstorm
drwxr-xr-x@  4 mayijie  staff   128 Aug  2 00:16 sdd
total 424
drwxr-xr-x@ 15 mayijie  staff    480 Aug  2 01:06 .
drwxr-xr-x@  4 mayijie  staff    128 Aug  2 00:16 ..
-rw-r--r--@  1 mayijie  staff   1196 Aug  2 00:16 global-constraints.md
-rw-r--r--@  1 mayijie  staff   3901 Aug  2 01:11 progress.md
-rw-r--r--@  1 mayijie  staff  21294 Aug  2 00:27 review-04a2eb8..db81487.diff
-rw-r--r--@  1 mayijie  staff   1834 Aug  2 00:49 review-5cb74dc..db7d263.diff
-rw-r--r--@  1 mayijie  staff   9669 Aug  2 00:52 review-db7d263..7a31bfe.diff
-rw-r--r--@  1 mayijie  staff  44989 Aug  2 00:34 review-db81487..f627557.diff
-rw-r--r--@  1 mayijie  staff  39628 Aug  2 00:41 review-f627557..5cb74dc.diff
-rw-r--r--@  1 mayijie  staff  10116 Aug  2 00:16 wave-backend-brief.md
-rw-r--r--@  1 mayijie  staff  10808 Aug  2 00:26 wave-backend-report.md
-rw-r--r--@  1 mayijie  staff   8988 Aug  2 00:16 wave-frontend-brief.md
-rw-r--r--@  1 mayijie  staff  19092 Aug  2 01:06 wave-frontend-report.md
-rw-r--r--@  1 mayijie  staff   7318 Aug  2 00:16 wave-visual-brief.md
-rw-r--r--@  1 mayijie  staff  15022 Aug  2 00:49 wave-visual-report.md
.superpowers/sdd/2026-08-02-p0-demo-retune-ui-fixes/global-constraints.md
.superpowers/sdd/2026-08-02-p0-demo-retune-ui-fixes/review-f627557..5cb74dc.diff
.superpowers/sdd/2026-08-02-p0-demo-retune-ui-fixes/progress.md
.superpowers/sdd/2026-08-02-p0-demo-retune-ui-fixes/review-db81487..f627557.diff
.superpowers/sdd/2026-08-02-p0-demo-retune-ui-fixes/wave-frontend-brief.md
.superpowers/sdd/2026-08-02-p0-demo-retune-ui-fixes/wave-frontend-report.md
.superpowers/sdd/2026-08-02-p0-demo-retune-ui-fixes/wave-backend-brief.md
.superpowers/sdd/2026-08-02-p0-demo-retune-ui-fixes/review-04a2eb8..db81487.diff
.superpowers/sdd/2026-08-02-p0-demo-retune-ui-fixes/wave-visual-brief.md
.superpowers/sdd/2026-08-02-p0-demo-retune-ui-fixes/review-5cb74dc..db7d263.diff
.superpowers/sdd/2026-08-02-p0-demo-retune-ui-fixes/review-db7d263..7a31bfe.diff
.superpowers/sdd/2026-08-02-p0-demo-retune-ui-fixes/wave-visual-report.md
.superpowers/sdd/2026-08-02-p0-demo-retune-ui-fixes/wave-backend-report.md
     570 .collab/plans/2026-08-02-p0-demo-retune-ui-fixes.md

```ts
      // Anonymous demo: re-adopt the session we created earlier this browser
      // session instead of burning a create per page view (5-per-5min IP cap).
      const demoKey = `dt-demo-session:${documentId}`;
      const storedDemoSession = typeof window !== 'undefined' ? sessionStorage.getItem(demoKey) : null;
      if (storedDemoSession) {
        try {
          const msgsData = await getMessages(storedDemoSession);
          if (cancelled) return;
          setSessionId(storedDemoSession);
          setSessions([]);
          setMessages(msgsData.messages);
          if (msgsData.demo_messages_used != null) {
            setDemoMessagesUsed(msgsData.demo_messages_used);
          } else {
            setDemoMessagesUsed(msgsData.messages.filter((m) => m.role === 'user').length);
          }
          return; // adopted — skip listSessions/createSession entirely
        } catch {
          sessionStorage.removeItem(demoKey); // stale/pruned session — fall through
        }
      }
```

And in the existing `createSession` success branch (where `s.demo_messages_used != null` is already checked), add:

```ts
          if (s.demo_messages_used != null && typeof window !== 'undefined') {
            sessionStorage.setItem(`dt-demo-session:${documentId}`, s.session_id);
          }
```

Guard: authenticated users never have the key written (their create responses lack `demo_messages_used`), and if a signed-in user hits a doc with a leftover key from an earlier anonymous visit, `getMessages` on an anonymous session still succeeds only for anon callers on demo docs (`verify_session_access`, `chat.py:136-140` returns the session only when `user is None`); for an authed caller it 404s → key cleared → normal flow. State that behavior in a comment.

- [ ] **Step 2: Type the new field** in `frontend/src/lib/api.ts` — find the messages response type used by `getMessages` and add `demo_messages_used?: number | null;`.

- [ ] **Step 3: Verify** — `cd frontend && npx tsc --noEmit && npx next lint --quiet` (build happens in the integration phase).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/useChatSession.ts frontend/src/lib/api.ts
git commit -m "fix(demo): reuse anonymous demo session across page views via sessionStorage

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task B2: Auth-modal callback override + demo-cap CTA lands on the dashboard

The demo-cap CTA says "Upload your own document" but `AuthModal` always uses the CURRENT page as `callbackUrl` (`AuthModal.tsx:82-85`), so a converting user lands back on the demo reader, which has no upload UI. Add an optional callback override to the hash-based `openAuthModal`.

**Files:**
- Modify: `frontend/src/lib/auth-modal.ts`
- Modify: `frontend/src/components/AuthModal.tsx:82-85`

**Interfaces:**
- Produces: `openAuthModal(options?: { callbackUrl?: string })` and `peekAuthCallbackOverride(): string | null`. Task B3 / Wave-2 consumes the new signature (existing zero-arg calls stay valid).

- [ ] **Step 1: Implement** in `auth-modal.ts`:

```ts
let callbackOverride: string | null = null;

export function openAuthModal(options?: { callbackUrl?: string }): void {
  if (typeof window === 'undefined') return;
  callbackOverride = options?.callbackUrl ?? null;
  if (window.location.hash === AUTH_MODAL_HASH) return;
  window.location.hash = AUTH_MODAL_HASH.slice(1);
}

/** Read (without clearing) the override set by the most recent openAuthModal call.
 *  Cleared when the modal closes so a later hash-open falls back to current-URL. */
export function peekAuthCallbackOverride(): string | null {
  return callbackOverride;
}

export function clearAuthCallbackOverride(): void {
  callbackOverride = null;
}
```

- [ ] **Step 2: Consume in `AuthModal.tsx`** — replace the `callbackUrl` IIFE:

```ts
  const callbackUrl = (() => {
    const override = peekAuthCallbackOverride();
    if (override) return `${window.location.origin}${override}`;
    const currentSearch = searchParams.toString();
    return `${window.location.origin}${pathname}${currentSearch ? `?${currentSearch}` : ''}`;
  })();
```

and call `clearAuthCallbackOverride()` in the modal's existing close handler.

- [ ] **Step 3: Point the demo-cap CTA at the dashboard.** This file (`ChatPanel.tsx:316-323`, `handleDemoAuthClick`) belongs to Wave-2's agent — leave a note in the Wave-2 task (B3 step 3 below) rather than editing `ChatPanel.tsx` here. (If executing single-threaded, make the edit now: `openAuthModal({ callbackUrl: '/' })`.)

- [ ] **Step 4: Verify + commit**

`cd frontend && npx tsc --noEmit`

```bash
git add frontend/src/lib/auth-modal.ts frontend/src/components/AuthModal.tsx
git commit -m "feat(auth): optional callbackUrl override for the auth modal

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task B4: Localize /demo + make the message-cap copy true

`/demo` is the conversion target of every localized marketing page but has no locale variants; all its UI strings already exist in all 11 locale JSONs, and `LocaleProvider` already derives locale from the URL (`LocaleProvider.tsx:43`). Also fix the two copy spots that overstate the cap.

**Files:**
- Create: `frontend/src/app/[locale]/demo/page.tsx`
- Modify: `frontend/src/i18n/routing.ts:31-65` (`LOCALIZED_PATHS` — add `'/demo'`)
- Modify: `frontend/src/i18n/locales/*.json` × 11 (`featuresDemo.whatYouGet.item1.label`)
- Modify: `frontend/src/app/features/free-demo/page.tsx:56` (hardcoded JSON-LD string)

**Interfaces:**
- Consumes: `createMarketingLocalePage` from `frontend/src/lib/marketingLocalePage.tsx` (existing factory; see `app/[locale]/trust/page.tsx` for the 10-line usage pattern).

- [ ] **Step 1: Create the locale page**

```tsx
// frontend/src/app/[locale]/demo/page.tsx
import DemoPageClient from '../../demo/DemoPageClient';
import { createMarketingLocalePage } from '../../../lib/marketingLocalePage';

const page = createMarketingLocalePage({
  Content: DemoPageClient,
  path: '/demo',
  titleKey: 'demo.title',
  descKey: 'demo.subtitle',
});

export const generateMetadata = page.generateMetadata;
export default page.Page;
```

(`DemoPageClient` takes no props; the factory's `Content` type accepts a component that ignores its `locale` prop — cast with `as` only if tsc complains, matching however other client Content components are registered. Check one existing `[locale]` page that wraps a client component first; if none exists, wrap: `Content: () => <DemoPageClient />`.)

- [ ] **Step 2: Add `'/demo'` to `LOCALIZED_PATHS`** in `routing.ts` — this single set drives hreflang, sitemap, and `MarketingLocaleLinks` (per the comment at `routing.ts:24-30`), so no other SEO wiring is needed.

- [ ] **Step 3: Copy truth fixes.**
  - `featuresDemo.whatYouGet.item1.label`: en `"5 messages per session"` → `"5 messages per sample document"`, translated natively in each of the 11 locale files (not machine-transliterated English).
  - `frontend/src/app/features/free-demo/page.tsx:56`: `'No signup required. 5 messages per session. 3 sample documents.'` → `'No signup required. 5 messages per sample document. 3 sample documents.'`
  - Verify no other stale claims: `grep -rn "per session" frontend/src/i18n/locales/en.json frontend/src/app/features/free-demo/` and fix any remaining message-cap phrasing the same way.

- [ ] **Step 4: Verify**

`cd frontend && npx tsc --noEmit` and (in the integration phase) confirm `npm run build` emits `/{de,zh,...}/demo` routes.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/\[locale\]/demo/page.tsx frontend/src/i18n/routing.ts frontend/src/i18n/locales/*.json frontend/src/app/features/free-demo/page.tsx
git commit -m "feat(demo): locale URLs for /demo + truthful per-document cap copy

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task C1: Invisible-on-white sweep — chat surfaces

Commit `0b7404a` de-glassed the CSS but left dark-glass Tailwind utilities in JSX. On the now-white surfaces they are invisible in light mode. Fix every occurrence in the chat surfaces. **Rule: keep the dark-mode appearance identical (move the old value behind `dark:`), give light mode a visible zinc equivalent. Do not touch `*-white/NN` utilities that sit on permanently-dark surfaces (e.g. inside `.dt-stitch-primary` blue buttons).**

**Files:**
- Modify: `frontend/src/components/Chat/MessageBubble.tsx`
- Modify: `frontend/src/components/Chat/ChatPanel.tsx`

Mapping table (verified against current line numbers; re-grep before editing):

| Site | Old | New |
|---|---|---|
| MessageBubble ~:285-287 typing dots ×3 | `bg-white/55` | `bg-zinc-400 dark:bg-zinc-500` |
| MessageBubble ~:313 streaming caret | `bg-white/45` | `bg-zinc-400 dark:bg-white/45` |
| MessageBubble + ChatPanel, all action buttons (share/thumbs/regenerate/copy, ~6 sites) | `hover:bg-white/10 hover:text-white` | `hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white` |
| ChatPanel ~:490 empty-state divider | `border-white/10` | `border-zinc-200 dark:border-white/10` |
| ChatPanel ~:494 "01" tile | `border-white/14 bg-white/8 text-white/72` | `border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-white/14 dark:bg-white/8 dark:text-white/72` |
| ChatPanel ~:546 scroll-to-bottom btn | `border-white/14 bg-white/10 … hover:text-white` | `border-zinc-200 bg-white … hover:text-zinc-900 dark:border-white/14 dark:bg-white/10 dark:hover:text-white` |
| ChatPanel ~:557 demo progress track | `bg-white/10` | `bg-zinc-200 dark:bg-white/10` |
| ChatPanel ~:595 "sign in for unlimited" | `hover:text-white` | `hover:text-zinc-900 dark:hover:text-white` |
| ChatPanel ~:653 composer placeholder | `placeholder:text-white/38` | `placeholder:text-zinc-400 dark:placeholder:text-white/38` |
| ChatPanel ~:691 disclaimer | `text-white/36` | `text-zinc-400 dark:text-zinc-500` |

- [ ] **Step 1: Sweep with the table.** After the listed fixes, run `grep -n "white/" frontend/src/components/Chat/MessageBubble.tsx frontend/src/components/Chat/ChatPanel.tsx` and audit every remaining hit against its actual surface (light-mode background). Fix any additional invisible ones the same way; leave dark-surface ones alone.
- [ ] **Step 2: Fix the demo progressbar a11y mismatch** (ChatPanel ~:560-567): visual width uses `demoRemaining` but `aria-valuenow={messagesUsed}`. Make ARIA describe the same quantity the bar draws: `aria-valuenow={Math.max(0, demoRemaining)}` and add `aria-valuetext={t('demo.questionsRemaining', { remaining: Math.max(0, demoRemaining), total: maxUserMessages })}`.
- [ ] **Step 3: Verify** — `cd frontend && npx tsc --noEmit`; visual check happens in the integration phase (both themes).
- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Chat/MessageBubble.tsx frontend/src/components/Chat/ChatPanel.tsx
git commit -m "fix(ui): restore light-mode visibility for chat controls de-glassed in 0b7404a

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task C2: Invisible-on-white sweep — shell, dashboard, header

Same rule as C1.

**Files:**
- Modify: `frontend/src/components/AppHeaderShell.tsx`
- Modify: `frontend/src/components/PublicHeader.tsx`
- Modify: `frontend/src/components/dashboard/DashboardPageClient.tsx`

Mapping table:

| Site | Old | New |
|---|---|---|
| AppHeaderShell :36 + PublicHeader :28 Beta badge | `border-white/18 bg-white/8` | `border-zinc-300 bg-zinc-100 dark:border-white/18 dark:bg-white/8` |
| AppHeaderShell :40 breadcrumb slash | `text-white/25` | `text-zinc-300 dark:text-white/25` |
| Dashboard :392 icon tile | `bg-white/12 text-white` | `bg-zinc-900/5 text-zinc-700 dark:bg-white/12 dark:text-white` |
| Dashboard :424, :661 icon buttons | `hover:bg-white/10 hover:text-white` | `hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white` |
| Dashboard :437-438 drag-drop border (`dt-command-bar` is solid white in light) | `isDragging ? 'border-white/40 bg-white/10' : 'border-white/18'` | `isDragging ? 'border-accent bg-accent/5 dark:border-white/40 dark:bg-white/10' : 'border-zinc-300 dark:border-white/18'` |
| Dashboard :482 URL input | `border-white/14 bg-white/8 … placeholder:text-white/38` | `border-zinc-300 bg-white … placeholder:text-zinc-400 dark:border-white/14 dark:bg-white/8 dark:placeholder:text-white/38` |
| Dashboard :511, :588 links | `hover:text-white` | `hover:text-zinc-900 dark:hover:text-white` |
| Dashboard :542 empty-state tile | `border-white/14 bg-white/8 text-white` | `border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-white/14 dark:bg-white/8 dark:text-white` |

- [ ] **Step 1: Apply the table, then sweep** — `grep -n "white/" <the three files>` and audit remaining hits (same skip-rule for genuinely dark surfaces like the solid `bg-zinc-900` buttons at :463/:502, which are correct as-is).
- [ ] **Step 2: Verify** — `npx tsc --noEmit`.
- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/AppHeaderShell.tsx frontend/src/components/PublicHeader.tsx frontend/src/components/dashboard/DashboardPageClient.tsx
git commit -m "fix(ui): restore light-mode visibility for shell/dashboard chrome

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task B3: Share affordance for anonymous demo users + CTA callback wiring

Demo users — the people most likely to have just seen something impressive — cannot share: both share buttons are hidden unless `userPlan` is truthy (`ChatPanel.tsx:534` `onShareAnswer={userPlan ? … : undefined}`, and the composer share button's `userPlan` gate). Show the buttons for anonymous users and route the click into the auth modal. **Known, accepted tradeoff (document in code comment): the anonymous transcript is NOT preserved through signup — the user returns to a fresh authed session. Session adoption is a follow-up, out of P0 scope.**

**Files:**
- Modify: `frontend/src/components/Chat/ChatPanel.tsx`

**Interfaces:**
- Consumes: `openAuthModal({ callbackUrl })` from Task B2.

- [ ] **Step 1: Anonymous share handler** in ChatPanel:

```ts
  const handleAnonShareClick = useCallback(() => {
    trackEvent('upgrade_click', { source: 'demo_share_attempt' });
    // Anonymous transcripts are not preserved through signup (no session
    // adoption yet) — this is a conversion affordance, not a working share.
    openAuthModal();
  }, []);
```

- Message-level: `onShareAnswer={userPlan ? handleShareAnswerVoid : handleAnonShareClick}`.
- Composer share button: change its `userPlan &&` gate so the button renders for anonymous users too and calls `handleAnonShareClick` when `!userPlan`.

- [ ] **Step 2: Demo-cap CTA callback** — in `handleDemoAuthClick` (~:316-323), change `openAuthModal()` → `openAuthModal({ callbackUrl: '/' })` so "Upload your own document" lands on the dashboard after sign-in.
- [ ] **Step 3: Verify** — `npx tsc --noEmit`.
- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Chat/ChatPanel.tsx
git commit -m "feat(demo): share affordance for anonymous users + upload CTA lands on dashboard

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task T: Integration verification (single agent or main session)

- [ ] `lsof -i :3000 -i :3001` — confirm no dev server, then `cd frontend && npm run build` (must pass; confirm `/{locale}/demo` routes in output).
- [ ] `cd backend && python3 -m ruff check app/ tests/ && python3 -m pytest -q` — no new failures vs the 533-green baseline.
- [ ] Docker infra up → run backend + worker → browser golden path in BOTH themes:
  1. Anonymous: open `/demo` → open a sample doc → chat twice → open a second sample doc (counter must be independent) → navigate back (session must be REUSED — no new session; check network tab for absent `POST /sessions`) → hit the cap on one doc → CTA → auth modal.
  2. Light-mode visual: typing dots visible, streaming caret visible, composer placeholder visible, disclaimer visible, Beta badge outlined, URL input bordered, hover states keep text visible.
  3. `POST /api/proxy/api/events` with `auth_confirm_viewed` anonymous → 204.
- [ ] Fix anything found; small fixes commit directly, behavioral surprises go back to the owning task.

### Task R: Codex adversarial review → consensus

- [ ] Write review brief to `.collab/reviews/2026-08-02-p0-demo-retune-review-request.md`: scope = all commits of this batch (`git log --oneline <base>..HEAD`), the plan file, and explicit attack surfaces: (1) demo key scoping — can a client force the old global key or evade the per-doc cap? (2) rolling-window count — off-by-one/timezone/index use; (3) sessionStorage reuse — cross-user leakage on shared machines, authed-user interaction, stale-session handling; (4) auth-modal override — open-redirect surface (`callbackUrl` must stay same-origin — note `${window.location.origin}` prefix); (5) anon share affordance — is the unpreserved-transcript tradeoff acceptable UX or a broken promise; (6) i18n completeness ×11; (7) the class sweep — any missed or wrongly-changed site.
- [ ] Run: `cat .collab/reviews/2026-08-02-p0-demo-retune-review-request.md | codex exec --sandbox workspace-write -C /Users/mayijie/Projects/Code/010_DocTalk` (no `-m` flag; pipe via stdin; wait for the `tokens used` settlement line — long quiet stretches are normal).
- [ ] Triage findings with technical rigor (superpowers:receiving-code-review): verify each against code before accepting; fix accepted findings TDD-style; respond in `.collab/dialogue/`; re-run Codex until consensus (no unresolved blockers).

exec
/bin/zsh -lc "for f in .superpowers/sdd/2026-08-02-p0-demo-retune-ui-fixes/{progress.md,wave-backend-report.md,wave-frontend-report.md,wave-visual-report.md}; do printf '\\n===== %s =====\\n' \""'$f"; sed -n '"'1,420p' \""'$f"; done' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:

===== .superpowers/sdd/2026-08-02-p0-demo-retune-ui-fixes/progress.md =====
# SDD ledger — plan: /Users/mayijie/Projects/Code/010_DocTalk/.collab/plans/2026-08-02-p0-demo-retune-ui-fixes.md
BASE: 04a2eb89f8b8fb2138ff5392430452cbc8053cb5 (main)
Waves: W1a=backend A1-A4, W1b=frontend B1/B2/B4, W2=visual C1/C2/B3, T=integration, R=Codex
Task A1-A4 (W1a): complete (commits 04a2eb8..db81487, review clean; approved deviations: chat_continue key scoping, A3 raw-SQL pattern)
Task A2: minor (deferred): test_demo_limits.py A2 test only asserts "created_at" in str(clause) — no live-DB boundary test (reviewer verified compiled SQL correct)
Task A3: minor (deferred): cleanup_tasks.py rowcount `or 0` fallback wouldn't catch driver -1; same latent pattern as pre-existing token cleanup task
Task B1/B2/B4 (W1b): review = Spec OK / Needs fixes. Important: (1) reuse path setSessions([]) breaks SessionDropdown; (2) [locale]/demo not SSR-translated (needs LocaleProvider seeding per app/[locale]/page.tsx precedent). Minor->loop by controller ruling: (3) auth-modal override lifecycle (W2 consumer already landed, reviewer premise lapsed); (4) fr.json "par exemple de document" phrasing. Fix round 1 dispatched to impl-frontend.
Task B4: watch item for Codex/final: whether Googlebot JS second-wave softens SSR-locale impact (reviewer ⚠️) — resolved by fixing SSR properly regardless.
Task C1/C2/B3 (W2): review = Spec FAIL / Needs fixes. Important: thumbs-up active text-white unqualified (invisible on white when active). Sweep gap: bare text-white/bg-white not covered by grep patterns. Minor: report text mischaracterized drag-drop treatment (spec'd verbatim). Informational: brief table vs prose dark-identical inconsistency (typing dots, disclaimer) — plan-level, accepted. Controller resolved reviewer ⚠️s: maxMessages==maxUserMessages (useChatStream.ts:79); anon ChatPanel = demo-only (backend access rule). Fix round 1 dispatched to impl-visual.
Task C1/C2/B3 (W2): fix round 1/5 (3 addressed, 0 open — thumbs-up active state, bare-white sweep audit, report correction; commit 5cb74dc..db7d263)
Task C1/C2/B3 (W2): complete (commits f627557..db7d263, review clean after 1 fix round)
Task B1/B2/B4 (W1b): fix round 1/5 (4 fixed per implementer — dropdown SessionItem, SSR-seeded LocaleProvider for [locale]/demo, override lifecycle effect, fr copy; commit db7d263..7a31bfe). Re-review dispatched (named risk: hand-built DEMO_PREFIXES coverage vs actual render-tree keys). Integration phase OWES: build + view-source /de/demo for German SSR strings.
Task B1/B2/B4 (W1b): complete (commits db81487..7a31bfe incl. fix round, review clean; re-reviewer ran npm run build — clean, [locale]/demo SSG x10 locales confirmed, DEMO_PREFIXES coverage independently verified)
Task T: starting — backend suite+ruff at HEAD, live-stack browser golden path both themes, /de/demo SSR string check, anon auth_confirm event 204
Task T (integration): PASS so far — anon auth_confirm_viewed 204; /de/demo SSR German H1; per-doc counters independent (browser+Redis: each doc used=1); session reuse works (history restored, GET messages only, zero POST /sessions). FOUND Important: reuse path double-counts demo usage (demoMessagesUsed + restored transcript both counted; UI 3/5 vs server 1 used). Fix round 2 dispatched to impl-frontend (fix scoped to useChatSession reuse branch; fallback branch must set 0).
Task T: complete — fix round 2 (aaeb334) live-verified (counter 4/5 == server used=1); npm run build clean at final HEAD ([locale]/demo SSG x10); cap panel/CTA/auth-modal OK; anon share -> modal + 204 event; dark mode OK; theme+redis restored; dev server stopped before build. Pre-existing observation (NOT this batch): anon chat_message_sent/completed events 401 by design — candidate for future PUBLIC_EVENTS decision.
Task R: started — brief at .collab/reviews/2026-08-02-p0-demo-retune-review-request.md, codex exec launching (scope 40733b8..aaeb334).
Task B1 counter fix (round 2, aaeb334): re-review SHIP — criteria a-d all MET, no new defects. All internal review loops now CLOSED. Awaiting Codex r1.

===== .superpowers/sdd/2026-08-02-p0-demo-retune-ui-fixes/wave-backend-report.md =====
# Wave Backend Report — Demo Re-tune (Tasks A1–A4)

Status: **DONE**

## Environment setup

The sandbox had no `.env` and Docker was not running. `backend/tests/conftest.py`
defaults `DATABASE_URL` to `postgresql+asyncpg://postgres:postgres@localhost:5432/postgres`,
which lets the **unit** suite (533 tests) run without any infra. Task A3 needs to
verify actual SQL filtering (created_at window, message-existence, demo_slug join),
which cannot be honestly verified against mocks, so I started Docker Desktop and
`docker compose up -d` (postgres/qdrant/minio/redis), ran `alembic upgrade head`
against `postgresql+asyncpg://doctalk:doctalk@localhost:5432/doctalk` (the
docker-compose credentials), and used that as the real baseline/target DB for the
integration-marked test. This mirrors how the repo's existing integration tests
(`test_auth_adapter.py`, `test_smoke.py`, `test_migrations.py`) already work —
they're marked `@pytest.mark.integration` and skip automatically
(`SKIP_INTEGRATION` defaults to skip) when Docker isn't available, so nothing
about the default no-docker CI path changed.

**Baselines:**
- No docker (`pytest -q`, default env): **533 passed, 7 skipped** — matches
  global-constraints.md's stated baseline.
- With docker + correct `DATABASE_URL` (`SKIP_INTEGRATION=0 pytest -q`):
  **537 passed, 3 skipped** — this is the true pre-change baseline including
  integration tests.

## Task A1 — Per-document demo message counting

**Files:** `backend/app/api/chat.py`, `backend/tests/test_demo_limits.py` (new)

**RED:**
```
$ python3 -m pytest tests/test_demo_limits.py -v
ERROR tests/test_demo_limits.py
!!!!!!!!!!!!!!!!!!!! Interrupted: 1 error during collection !!!!!!!!!!!!!!!!!!!!
```
(ImportError: cannot import name `_demo_message_key`, as predicted by the brief.)

**Implementation:**
- Added `_demo_message_key(client_ip, document_id) -> str` module-level helper
  (`f"{client_ip}:{document_id}"`).
- Create-session response (`create_session`) now computes `used` via the scoped
  key; updated the stale "limit is global per IP" comment.
- `chat_stream` send path now checks/increments via the scoped key.
- `get_session_messages` gained a `request: Request` parameter and, for
  anonymous sessions on demo documents, returns a `JSONResponse` merging
  `demo_messages_used` into the normal response body — same pattern as
  create-session.
- **Deviation from the brief's literal "three call-site changes":** I also
  scoped the key in `chat_continue` (the `/sessions/{id}/chat/continue`
  endpoint), which has the identical
  `demo_message_tracker.check_and_increment(client_ip, DEMO_MESSAGE_LIMIT)`
  call and an explicit comment "continuations count against it." The brief's
  interface list only names three call sites, but leaving this one on the old
  global-per-IP key would silently break the feature: continuation traffic
  would stop counting against the new per-document counter entirely (it would
  hit a different Redis/in-memory key), while still enforcing an unrelated
  global cap. This isn't scope creep — it's completing the brief's own goal
  ("the key" must be scoped everywhere it's used) — but flagging it explicitly
  since it wasn't in the enumerated list.

**GREEN:**
```
$ python3 -m pytest tests/test_demo_limits.py -v
2 passed
$ python3 -m ruff check app/ tests/
(clean)
```
(Removed an unused `import pytest` from the brief's own test snippet — ruff
F401 — since neither test in this file uses a pytest decorator.)

**Regression:** `SKIP_INTEGRATION=0 pytest -q` → 539 passed, 3 skipped (baseline
537 + 2 new). Committed `40733b8`.

## Task A2 — Demo session cap becomes a 24h rolling window

**Files:** `backend/app/api/chat.py`, `backend/tests/test_demo_limits.py`

**RED:**
```
$ python3 -m pytest tests/test_demo_limits.py -v
ERROR tests/test_demo_limits.py  (ImportError: _recent_demo_session_filter)
```

**Implementation:** exactly as specified — `_recent_demo_session_filter(document_id)`
returns `[ChatSession.document_id == document_id, ChatSession.created_at > func.now() - dt.timedelta(hours=24)]`;
added `import datetime as dt`; replaced the lifetime count query in
`create_session`'s demo-session-cap check with
`select(func.count(ChatSession.id)).where(*_recent_demo_session_filter(document_id))`.

**GREEN:**
```
$ python3 -m pytest tests/test_demo_limits.py -v
3 passed
$ python3 -m ruff check app/ tests/
(clean)
```

**Regression:** 540 passed, 3 skipped. Committed `ad7cbae`.

## Task A3 — Nightly prune of empty anonymous demo sessions

**Files:** `backend/app/workers/cleanup_tasks.py`, `backend/app/workers/celery_app.py`,
`backend/tests/test_cleanup_tasks.py`

Read `cleanup_tasks.py` and its test first, as instructed. The module does **not**
use an ORM session factory (`SyncSessionLocal`) — its existing task
(`cleanup_expired_verification_tokens`) builds a plain `sa.create_engine(sync_url)`
from `settings.DATABASE_URL` (asyncpg→psycopg driver swap) each invocation, runs
raw `sa.text(...)` SQL inside `engine.begin()`, and disposes the engine in
`finally`. The brief's code sketch (ORM `sa.delete(ChatSession)...` via
`SyncSessionLocal()`) doesn't match this module's convention, so I adapted it to
raw SQL following the exact same engine-lifecycle pattern as the existing task,
per the task brief's own instruction to adapt imports/factory names.

```python
DELETE FROM sessions
WHERE user_id IS NULL
  AND created_at < :cutoff
  AND document_id IN (SELECT id FROM documents WHERE demo_slug IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM messages WHERE messages.session_id = sessions.id)
```

**Test:** the brief's four cases (a–d) require verifying real filtering
behavior (created_at window, message-existence, demo_slug join) that a mocked
session cannot honestly assert. I wrote `test_cleanup_empty_demo_sessions_deletes_only_stale_empty_anonymous_demo_sessions`,
marked `@pytest.mark.integration`, using `SyncSessionLocal` (the app's real sync
session factory, imported fresh for the test) to insert real rows against the
local docker Postgres, call the task for real, assert the return value and
which session IDs survive, then clean up the rows it created in a `finally`
block.

**RED** (real DB, task not yet implemented):
```
$ SKIP_INTEGRATION=0 pytest tests/test_cleanup_tasks.py -v
FAILED ...AttributeError: module 'app.workers.cleanup_tasks' has no attribute 'cleanup_empty_demo_sessions'
1 failed, 1 passed
```

**Implementation:** added `cleanup_empty_demo_sessions()` task (returns `int`,
deleted count) to `cleanup_tasks.py`; added
`"cleanup-empty-demo-sessions-daily": {"task": "cleanup_empty_demo_sessions", "schedule": 86400}`
to `celery_app.py`'s `beat_schedule`.

**GREEN:**
```
$ SKIP_INTEGRATION=0 pytest tests/test_cleanup_tasks.py -v
2 passed
$ ruff check app/ tests/
(clean)
```

**Regression:**
- With docker: 541 passed, 3 skipped.
- Without docker (default env, confirming the new test degrades gracefully):
  536 passed, 8 skipped (baseline 533 + 3 new unit tests from A1/A2/A4 so far;
  the new integration test is the 8th skip).

Committed `b459e4f`.

## Task A4 — Unblock auth_confirm telemetry

**Files:** `backend/app/api/events.py`, `backend/tests/test_events_api.py`

**RED:**
```
$ pytest tests/test_events_api.py -v
FAILED [...auth_confirm_viewed] - assert 400 == 204
FAILED [...auth_confirm_clicked] - assert 400 == 204
2 failed, 4 passed
```

**Implementation:** added `"auth_confirm_viewed"` and `"auth_confirm_clicked"` to
both `ALLOWED_EVENTS` and `PUBLIC_EVENTS` in `events.py`.

**GREEN:**
```
$ pytest tests/test_events_api.py -v
6 passed
$ ruff check app/ tests/
(clean)
```

**Regression:** 543 passed, 3 skipped (with docker). Committed `db81487`.

## Final state

```
$ SKIP_INTEGRATION=0 pytest -q       # with docker up, correct DATABASE_URL
543 passed, 3 skipped

$ pytest -q                          # default env, no docker (matches CI/local dev)
536 passed, 8 skipped
```

No new failures vs either baseline in either mode. `ruff check app/ tests/` is
clean after all four tasks.

## Files changed

- `backend/app/api/chat.py` — A1 (`_demo_message_key`, 4 call sites incl. the
  `chat_continue` deviation noted above) + A2 (`_recent_demo_session_filter`)
- `backend/app/workers/cleanup_tasks.py` — A3 (`cleanup_empty_demo_sessions`)
- `backend/app/workers/celery_app.py` — A3 (beat schedule entry)
- `backend/app/api/events.py` — A4 (whitelist additions)
- `backend/tests/test_demo_limits.py` — new, A1 + A2 tests
- `backend/tests/test_cleanup_tasks.py` — extended, A3 test
- `backend/tests/test_events_api.py` — extended, A4 test

## Self-review

- **Completeness:** all four tasks implemented per brief; interfaces match
  exactly (`_demo_message_key`, `_recent_demo_session_filter`,
  `cleanup_empty_demo_sessions() -> int`, `demo_messages_used` field name/shape).
- **Quality:** each fix follows the existing module's conventions rather than
  the brief's sketch verbatim where they diverged (A3's raw-SQL engine pattern;
  A1's extra `chat_continue` fix for consistency).
- **YAGNI:** did not add anything beyond what each task needs — e.g. A3's test
  covers exactly the brief's 4 cases, no extra scenarios; didn't touch the
  non-demo-document session-cap path (still uses `settings.FREE_MAX_SESSIONS_PER_DOC`
  unchanged, out of scope).
- **Test honesty:** A3's test hits a real Postgres and asserts on actual row
  survival, not a mock that would trivially pass regardless of the SQL's
  correctness. It's marked `@pytest.mark.integration` and cleans up its own
  rows in a `finally` block so repeated runs don't accumulate data or collide
  (unique demo_slug per run via `uuid4().hex[:8]`).
- **Docker was left running** at the end of this session (`docker compose up -d`
  containers `doctalk-qdrant`, `doctalk-redis`, `doctalk-minio`, `doctalk-postgres`)
  since another wave/agent in this session may also need it. Local DB now has a
  couple of extra alembic-migrated tables applied vs whatever state it was in
  before (migrations were already 2 revisions behind head).

## Concerns for reviewers / Codex round

1. **A1 deviation** (`chat_continue` also scoped): flagged above — recommend
   confirming this matches intent, since the brief explicitly enumerated only
   3 call sites and this is a 4th.
2. **A3's DELETE is raw SQL, not ORM**, diverging from the brief's sketch. This
   was a deliberate adaptation to match the module's existing convention (the
   brief itself said to adapt), not an oversight — worth a second look given
   security-adjacent-ish (bulk delete) territory.
3. Frontend Task B1 consumes `demo_messages_used` from
   `GET /api/sessions/{id}/messages` — the field is present on both the
   create-session (201) and messages (200) responses now, same shape.

===== .superpowers/sdd/2026-08-02-p0-demo-retune-ui-fixes/wave-frontend-report.md =====
# Wave: Frontend demo funnel fixes (B1, B2, B4) — Report

Implemented exactly per `wave-frontend-brief.md`, in order, one commit per task, plus one small self-review follow-up fix. All work on `main`.

## Commits

1. `25f8e8e` — `fix(demo): reuse anonymous demo session across page views via sessionStorage` (B1)
2. `0614e0e` — `feat(auth): optional callbackUrl override for the auth modal` (B2)
3. `f5850e5` — `feat(demo): locale URLs for /demo + truthful per-document cap copy` (B4)
4. `f627557` — `fix(demo): emit hreflang alternates on canonical /demo page` (self-review follow-up, see below)

## Task B1 — Anonymous demo session reuse

- `frontend/src/lib/useChatSession.ts`: added the re-adopt-from-`sessionStorage` branch at the top of the mount IIFE, exactly as specified — reads `dt-demo-session:${documentId}`, calls `getMessages`, adopts the session and returns early on success, clears the key and falls through on any error (stale/pruned/403/404).
- Added the `sessionStorage.setItem` write in the `createSession` success branch, gated on `s.demo_messages_used != null` (only true for anonymous demo sessions per backend contract — confirmed via `chat.py`: the field is only added when `session.user_id is None and session.document.demo_slug`).
- I nested the `sessionStorage.setItem` inside the existing `if (s.demo_messages_used != null) { setDemoMessagesUsed(...) }` block rather than adding a second sibling `if` with a duplicate condition — functionally identical to the brief's snippet, just avoids repeating the guard.
- `frontend/src/lib/api.ts`: `getMessages` return type now includes `demo_messages_used?: number | null`, populated from the raw response (backend omits the key entirely for authed/non-demo sessions, so it's `undefined` in that case, which the `!= null` checks treat the same as `null`).
- **Auth-safety verified**: authenticated users' `createSession` responses never carry `demo_messages_used`, so the write path never fires for them. If an authed user inherits a stale `sessionStorage` key from an earlier anonymous visit to the same demo doc, `getMessages` 404s (backend `verify_session_access`, chat.py:157-163, only returns an anon-owned session to `user is None` callers) — the `catch` clears the key and falls through to the normal `listSessions`/`createSession` flow. No behavior change for authenticated users. Documented this in a code comment above the new block.

## Task B2 — Auth-modal callback override

- `frontend/src/lib/auth-modal.ts`: added `callbackOverride` module-level state, `openAuthModal(options?: { callbackUrl?: string })` (backward-compatible — existing zero-arg call sites all still type-check), `peekAuthCallbackOverride()`, `clearAuthCallbackOverride()` — verbatim from the brief.
- `frontend/src/components/AuthModal.tsx`: `callbackUrl` IIFE now checks the override first; `clearAuthCallbackOverride()` called in `handleClose`.
- Confirmed all 5 existing `openAuthModal()` call sites (`DocumentReaderPageClient.tsx` ×2, `ChatPanel.tsx` ×3) still compile — none needed changes.
- **Did not touch `ChatPanel.tsx`** (including the `handleDemoAuthClick` CTA at line ~316-323) — brief Step 3 explicitly assigns that edit to the next wave since ChatPanel.tsx is owned by a later agent. Confirmed this by re-reading the brief text and the task-launch message before starting.

## Task B4 — Localize /demo + truthful cap copy

- Created `frontend/src/app/[locale]/demo/page.tsx` using `createMarketingLocalePage({ Content: DemoPageClient, path: '/demo', titleKey: 'demo.title', descKey: 'demo.subtitle' })` — verbatim from the brief. **No typing fight**: `DemoPageClient` (`() => JSX.Element`, no props) is directly assignable to `Content: (props: { locale: string }) => ...` under TS's normal function-parameter-count variance rules; no `as` cast needed.
- `frontend/src/i18n/routing.ts`: added `'/demo'` to `LOCALIZED_PATHS`.
- Localized `featuresDemo.whatYouGet.item1.label` in all 11 locale files (en/zh/ja/ko/es/de/fr/pt/it/ar/hi), each translated natively — I cross-referenced each file's existing "sample document" terminology (`demo.title` / `featuresDemo.docs.doc3.title`) to keep wording consistent with the rest of that locale's `featuresDemo` section, e.g. de → "5 Nachrichten pro Beispieldokument", zh → "每篇示例文档 5 条消息", ar → "5 رسائل لكل مستند عينة" (matches `featuresDemo.docs.doc3.title`'s "مستند عينة", not `demo.title`'s different phrasing).
- Fixed `frontend/src/app/features/free-demo/page.tsx:56` (JSON-LD `Offer.description`) per the brief, **and** also fixed a second stale claim at line 75 (JSON-LD `FAQPage` answer: "You get 5 messages per session with 3 sample documents") that the brief's Step 3 grep instruction ("verify no other stale claims... fix any remaining message-cap phrasing the same way") turned up — both now read "per sample document."
- Ran the broader grep across `src/` for `"per session"`/`"messages per"` patterns; the only other hit was an unrelated Italian string (`errors.SESSION_LIMIT_REACHED.body`, the *session-count* limit feature, not the demo message cap) — left untouched, out of scope.
- Validated all 11 edited locale JSON files parse (`python3 -c "import json; json.load(...)"` per file) — all OK, flat dotted keys preserved.

### Self-review follow-up (own commit `f627557`, not in the brief's file list)

While reviewing B4 for completeness I checked how every other page in `LOCALIZED_PATHS` wires hreflang: `buildMarketingMetadata()` only emits `alternates.languages` when the caller passes `localized: true` (`frontend/src/lib/seo.ts`). I confirmed every existing base-English page for a `LOCALIZED_PATHS` entry sets this (`app/page.tsx`, `app/trust/page.tsx`, `app/pricing/page.tsx`, `app/use-cases/lawyers/page.tsx` all have it). The brief's B4 file list did not include `frontend/src/app/demo/page.tsx`, and that file was missing `localized: true` — meaning the canonical English `/demo` page would not have advertised the new locale URLs via hreflang, even though `sitemap.ts` (which reads `LOCALIZED_PATHS` directly, independent of the metadata flag) would still list them. This is a one-line, low-risk fix consistent with the established pattern, so I made it and committed it separately rather than silently folding it into `f5850e5`.

## Verification evidence

Ran after every task and again at the end, from `frontend/`:
- `npx tsc --noEmit` — clean (no output) at every checkpoint, including after the final hreflang fix.
- `npx next lint --quiet` — `✔ No ESLint warnings or errors` at every checkpoint.
- `lsof -i :3000 -i :3001` — empty before starting (no dev server running), so no `.next/` corruption risk from any accidental build.
- Did **not** run `npm run build` — per the task instructions, that's reserved for the integration phase.
- All 11 locale JSON files individually validated with `python3 -m json.tool` equivalent (`json.load`) — all parse.

## Files changed (cumulative)

- `frontend/src/lib/useChatSession.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/auth-modal.ts`
- `frontend/src/components/AuthModal.tsx`
- `frontend/src/app/[locale]/demo/page.tsx` (new)
- `frontend/src/app/demo/page.tsx` (hreflang follow-up)
- `frontend/src/i18n/routing.ts`
- `frontend/src/i18n/locales/{en,de,es,fr,it,ja,ko,zh,ar,hi,pt}.json`
- `frontend/src/app/features/free-demo/page.tsx`

## Concerns / things the integration phase should double-check

1. **`npm run build` not yet run** — tsc/lint are clean but `next build` static-param generation for `/[locale]/demo` (and its interaction with `dynamicParams = false` in `[locale]/layout.tsx`) is unverified until the integration phase runs it. I did trace the layout — `generateStaticParams` return `URL_LOCALES.map(locale => ({ locale }))` generically, no per-page registration needed, matching every other `[locale]/<route>/page.tsx` in the tree — so I expect this to be fine, but it's untested by me.
2. **B2's CTA wiring is intentionally incomplete** — `openAuthModal({ callbackUrl: '/' })` is NOT wired into `ChatPanel.tsx`'s `handleDemoAuthClick` in this wave (brief explicitly assigns that to a later wave/agent). The new `openAuthModal` signature is ready for that wave to consume; nothing further needed from this side.
3. **`f627557` (hreflang fix) was not in the brief's file list** — flagging explicitly in case the integration/review step wants to scope-check it against the original plan. I judged it safely in-scope (same file family, one line, matches an established repo-wide pattern) rather than a scope change requiring a stop.
4. Did not verify the deployed FAQ copy change reads naturally end-to-end in the rendered `/features/free-demo` page (only checked the raw string) — worth a quick visual pass in the browser-driven QA stage the global constraints mention for UI changes, though this particular change is JSON-LD (not visibly rendered), so risk is low.

---

## Fix round 1 (review findings)

Commit `7a31bfe` — `fix(demo): review round 1 — session dropdown, SSR i18n, override lifecycle, fr copy`.

### IMPORTANT-1 — Session dropdown broke on the reuse path

Root cause confirmed exactly as diagnosed: `useChatSession.ts`'s reuse branch called `setSessions([])` while adopting a real, populated session, leaving `SessionDropdown` with an empty list (`sortedSessions.length === 0` → "New Chat"-only placeholder; `onDeleteSessionById`/`onSwitchSession` have nothing to target).

Fix: the reuse branch now calls `setSessions([...])` with a single `SessionItem` built from the fetched data — `session_id` = the stored id, `title: null`, `message_count: msgsData.messages.length`. `getMessages` doesn't return session-level `created_at`/`last_activity_at` (only per-message timestamps), so I derived them from the fetched messages themselves: `created_at` from the first message's `createdAt` (falls back to `new Date().toISOString()` if there are no messages yet), `last_activity_at` from the last message's `createdAt` (falls back to `created_at`). This is the same `SessionItem` shape `addSession` builds in the `createSession` branch, just populated from `getMessages` data instead of the `createSession` response.

### IMPORTANT-2 — `/[locale]/demo` wasn't SSR-translated

Confirmed the failure mode: `createMarketingLocalePage`'s `Page()` renders `<Content locale={params.locale} />` directly with no `LocaleProvider`. `DemoPageClient` is `"use client"` and reads all its copy via `useLocale()`, which is backed by `LocaleContext` — with no provider seeded for that locale, `useLocale()` falls back to whatever the *nearest ancestor* `LocaleProvider` is providing. The app doesn't appear to nest a plain unseeded `LocaleProvider` around every route by default in a way that would auto-detect `/de/` from the URL server-side — client detection (`detectLocale()` in `LocaleProvider.tsx:38-56`) only runs in a `useEffect`, i.e. after hydration. So the SSR HTML `DemoPageClient` renders is whatever the default/nearest provider's locale is at render time (English, absent an explicit seed) — exactly the crawler-invisibility bug the locale-URL program exists to fix, and exactly what `app/[locale]/page.tsx` solves for the landing page via an explicit `<LocaleProvider initialLocale={locale} initialMessages={messages}>` wrapper.

Fix: rewrote `app/[locale]/demo/page.tsx` to keep using `createMarketingLocalePage` (still get its `generateMetadata`/`notFound`/`MarketingArticleJsonLd` boilerplate for free) but swapped the `Content` prop from `DemoPageClient` directly to a small wrapper, `DemoContent`, that:
1. Re-guards `isUrlLocale(locale)` → `notFound()` (the factory's `Page()` already does this before calling `Content`, but `Content`'s own prop type is plain `string`, so this local guard is what lets TypeScript narrow `locale` to the `Locale` union without a cast — same mechanism `app/[locale]/page.tsx` uses, just applied inside the wrapper instead of inline in `Page()`).
2. Calls `getScopedMessages(locale, DEMO_PREFIXES)` — a new, tightly-scoped prefix list (`demo.`, `footer.`, `useCasesHub.breadcrumb.`, `common.`, `public.`, `auth.`, `header.`, `landing.`, `privacy.`, `terms.`).
3. Wraps `<DemoPageClient />` in `<LocaleProvider initialLocale={locale} initialMessages={messages}>`.

**Why that prefix list, and how I verified it's complete** (I can't run `npm run build`, so I traced the render tree by hand instead): I read `DemoPageClient.tsx` in full and collected every `t()`/`tOr()` key it calls directly — all under `demo.`, plus `footer.demo` and `useCasesHub.breadcrumb.home` for the breadcrumb, plus `common.retry`/`common.loading`. `DemoPageClient` renders `MarketingShell`, which renders `EditorialMarketingHeader` → `EditorialHeaderBase` and `EditorialFooter` — I read both and confirmed `MarketingShell` is called *without* a `chrome` prop in this tree (unlike `FreeDemoContent`, which passes a server-resolved `chrome` from `getChromeStrings`), so both header and footer fall back to their own `useLocale()` calls. I grepped every literal `t('...')`/`tOr('...')` in `EditorialHeaderBase.tsx` and `EditorialFooter.tsx` directly (not just what `ChromeStrings`/`getChromeStrings` covers, since a few keys — `header.aria.*`, `landing.masthead.tagline` — are read unconditionally regardless of whether a `chrome` prop is passed) and found: `public.nav.features`, `footer.pricing`, `footer.links.trust`, `auth.signIn`, `header.aria.*` (5 keys), `landing.masthead.tagline`, `header.aria.breadcrumb`, and the full `footer.*`/`privacy.policyLink`/`terms.title` set from `EditorialFooter`. Every one of those is covered by one of `public.`, `footer.`, `auth.`, `header.`, `landing.`, `privacy.`, `terms.` — which is why the final list has all of them. This mirrors (and is close to a superset of, minus the landing page's `hero.`/`chat.` which this tree doesn't use) the existing `LANDING_PREFIXES` in `app/[locale]/page.tsx`, for the identical reason: both wrap a client component tree that falls back to unseeded `useLocale()` for header/footer chrome.

Verification performed (again, no `npm run build`): `npx tsc --noEmit` is clean with the new file — specifically confirms the `isUrlLocale` narrowing lets `initialLocale={locale}` satisfy `LocaleProvider`'s `initialLocale?: Locale` prop without a cast, and confirms `getScopedMessages`'s return type (`Record<string, string>`) matches `initialMessages`. I did not spin up a dev server or run `next build` to visually confirm `/de/demo`'s SSR HTML string-matches German text — that's the one thing the integration phase should specifically check (e.g. `curl` the built output, or `view-source:` in a browser, and grep for a known German string like "Wählen Sie ein Beispieldokument" from `demo.title`).

### MINOR-3 — Override lifecycle gap

Fix: replaced the single `clearAuthCallbackOverride()` call in `handleClose` with a `useEffect` keyed on `isOpen`, gated by a `wasOpenRef` so it only fires on a genuine open→closed transition (not on initial mount, when `isOpen` starts `false` and no override could legitimately be pending yet). This covers `handleClose` (explicit `setIsOpen(false)`) and the `hashchange`/`syncFromHash` path (`isOpen` flips to `false` when the hash changes away from `#auth` for any reason, e.g. back-gesture) with one code path instead of two, per the "keep the primitive simple" note.

### MINOR-4 — French idiom collision

`fr.json`'s `featuresDemo.whatYouGet.item1.label` changed from "5 messages par exemple de document" to "5 messages par document d'exemple".

### Verification (fix round 1)

- `cd frontend && npx tsc --noEmit` — clean, run after each of the four fixes individually and once more at the end.
- `cd frontend && npx next lint --quiet` — `✔ No ESLint warnings or errors`, run at the end.
- `python3 -c "import json; json.load(open('src/i18n/locales/fr.json'))"` — parses.
- `lsof -i :3000 -i :3001` — empty, no dev server running.
- Confirmed Wave-2 already consumes the new `openAuthModal({ callbackUrl })` signature: `grep -n callbackUrl frontend/src/components/Chat/ChatPanel.tsx` → `openAuthModal({ callbackUrl: '/' })` at line 322, matching the controller's note that MINOR-3's "currently unreachable" premise no longer held.
- Did **not** run `npm run build` (still reserved for the integration phase) — see the IMPORTANT-2 section above for what specifically still needs a real build/browser check.

---

## Fix round 2 (live-integration defect)

Commit `aaeb334` — `fix(demo): review round 2 — reuse path double-counted demo message usage`.

### DEFECT — Demo counter double-counted on the reuse path

Confirmed the root cause exactly as diagnosed against `useChatStream.ts:72-78`. That hook computes `totalUsed = demoMessagesUsed + localUserMsgCount`, where `localUserMsgCount` is derived by counting `role === 'user'` entries in the live `messages` array. The implicit contract is that `demoMessagesUsed` holds only server-known usage **not already represented** in the local transcript — true on the `createSession` path, where `setMessages([])` starts the transcript empty, so the full server count belongs in `demoMessagesUsed` with nothing to double up against.

My reuse branch broke that contract: it calls `setMessages(msgsData.messages)` (restoring the real transcript, including its user messages) *and* `setDemoMessagesUsed(msgsData.demo_messages_used)` (the server's raw count) — so a session with 1 prior question showed `demoMessagesUsed = 1` stacked on top of `localUserMsgCount = 1`, i.e. `totalUsed = 2` instead of `1`.

Fix, scoped entirely to the reuse branch in `useChatSession.ts` (did not touch `useChatStream.ts`'s shared math, per the instruction):
- Compute `restoredUserMsgCount = msgsData.messages.filter(m => m.role === 'user').length` — the count already carried by the transcript I just restored.
- When the response has `demo_messages_used`: `setDemoMessagesUsed(Math.max(0, msgsData.demo_messages_used - restoredUserMsgCount))`, so `totalUsed` (server value) is not re-added on top of the same messages.
- When the response has no `demo_messages_used` field (non-demo/authed path — dead in practice for this branch since it 404s before reaching here, but kept for symmetry with the pre-existing `!= null` check): `setDemoMessagesUsed(0)`, since `localUserMsgCount` from the restored transcript already carries the full count on its own.
- Added a comment above the block stating the contract (`demoMessagesUsed` = server-known usage not already in the local transcript) so a future edit to this branch doesn't reintroduce the double-count.

### Verification (fix round 2)

- `cd frontend && npx tsc --noEmit` — clean.
- `cd frontend && npx next lint --quiet` — `✔ No ESLint warnings or errors`.
- Did not re-run the browser/Redis repro myself (no Redis/browser access from this environment) — the team lead is re-verifying the counter live in the browser after this commit, per their instruction.

===== .superpowers/sdd/2026-08-02-p0-demo-retune-ui-fixes/wave-visual-report.md =====
# Wave Visual Report — Tasks C1, C2, B3

Executed in order: C1 → C2 → B3, one commit per task, verified with `npx tsc --noEmit` + `npx next lint --quiet` after each. No `npm run build` was run (per instructions). No second dev server was started; none was checked/needed since only tsc/lint were used.

## Commits

1. `ae83e1f` — `fix(ui): restore light-mode visibility for chat controls de-glassed in 0b7404a`
2. `1523370` — `fix(ui): restore light-mode visibility for shell/dashboard chrome`
3. `5cb74dc` — `feat(demo): share affordance for anonymous users + upload CTA lands on dashboard`

## Task C1 — Chat surfaces (MessageBubble.tsx, ChatPanel.tsx)

All mapping-table line numbers matched current source almost exactly (off by 0-1 lines). Surface confirmation before editing: `.dt-answer-card` (globals.css:540-547) = `#ffffff` light / `#18181b` dark; `.dt-empty-workbench` (:502-507) = `#ffffff`/`#18181b`; `.dt-composer` (:676-680) = `#ffffff`/`#18181b`. All target sites confirmed sitting on white-in-light surfaces.

| Site | Old | New | Decision |
|---|---|---|---|
| MessageBubble :285-287 typing dots ×3 | `bg-white/55` | `bg-zinc-400 dark:bg-zinc-500` | Fixed |
| MessageBubble :313 streaming caret | `bg-white/45` | `bg-zinc-400 dark:bg-white/45` | Fixed |
| MessageBubble :336 copy button | `hover:bg-white/10 hover:text-white` | `hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white` | Fixed |
| MessageBubble :347 thumbs-up (inactive) | `hover:bg-white/10 hover:text-white` | same pattern | Fixed |
| MessageBubble :360 thumbs-down (inactive) | `hover:bg-white/10 hover:text-white` | same pattern | Fixed |
| MessageBubble :372 share button | `hover:bg-white/10 hover:text-white` | same pattern | Fixed |
| MessageBubble :382 regenerate button | `hover:bg-white/10 hover:text-white` | same pattern | Fixed |
| ChatPanel :489 empty-state divider | `border-white/10` | `border-zinc-200 dark:border-white/10` | Fixed |
| ChatPanel :494 "01" tile | `border-white/14 bg-white/8 text-white/72` | `border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-white/14 dark:bg-white/8 dark:text-white/72` | Fixed |
| ChatPanel :546 scroll-to-bottom btn | `border-white/14 bg-white/10 … hover:text-white` | `border-zinc-200 bg-white … hover:text-zinc-900 dark:border-white/14 dark:bg-white/10 dark:hover:text-white` | Fixed |
| ChatPanel :557 demo progress track | `bg-white/10` | `bg-zinc-200 dark:bg-white/10` | Fixed |
| ChatPanel :595 "sign in for unlimited" | `hover:text-white` | `hover:text-zinc-900 dark:hover:text-white` | Fixed |
| ChatPanel :644 composer share button | `hover:bg-white/10 hover:text-white` | `hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white` | Fixed (this is the 6th of "~6 action button sites") |
| ChatPanel :653 composer placeholder | `placeholder:text-white/38` | `placeholder:text-zinc-400 dark:placeholder:text-white/38` | Fixed |
| ChatPanel :691 disclaimer | `text-white/36` | `text-zinc-400 dark:text-zinc-500` | Fixed |

Post-fix sweep (`grep -n "white/"`) on both files: every remaining hit is `dark:`-prefixed (verified by inspection, no unprefixed survivors). No additional invisible sites found beyond the table in C1.

**Step 2 — aria progressbar fix**: `role="progressbar"` at ChatPanel:558-568 had `aria-valuenow={messagesUsed}` while the visual bar width is driven by `demoRemaining` (a different, inverse quantity — remaining vs. used). Changed to `aria-valuenow={Math.max(0, demoRemaining)}` and added `aria-valuetext={t('demo.questionsRemaining', { remaining: Math.max(0, demoRemaining), total: maxUserMessages })}` — reusing the existing `demo.questionsRemaining` i18n key already used at ChatPanel:593 for the plain-text equivalent, so no new locale keys were needed (all 11 locales already covered). `aria-valuemax={maxMessages}` was left as-is: `maxMessages = maxUserMessages ?? 0` in `useChatStream.ts:79`, and this whole block is gated by `maxUserMessages != null`, so `maxMessages === maxUserMessages` here always — no mismatch to fix.

Side effect: after removing the only use of `messagesUsed` in aria-valuenow, the destructured binding at ChatPanel:162 became dead. Removed it from the `useChatStream()` destructure to avoid an unused-var lint warning (hook itself still returns/computes it for other future consumers).

## Task C2 — Shell, dashboard, header

Surface confirmation: `.dt-shell-header` (globals.css:375-380) = `#ffffff` light; `.dt-stitch-card` (:802-806) = `#ffffff` light; `.dt-command-bar` (:429-432) = `#ffffff` light. All target sites confirmed on white-in-light surfaces.

| Site | Old | New | Decision |
|---|---|---|---|
| AppHeaderShell :36 Beta badge | `border-white/18 bg-white/8` | `border-zinc-300 bg-zinc-100 dark:border-white/18 dark:bg-white/8` | Fixed |
| PublicHeader :28 Beta badge | same | same | Fixed |
| AppHeaderShell :40 breadcrumb slash | `text-white/25` | `text-zinc-300 dark:text-white/25` | Fixed |
| Dashboard :392 icon tile | `bg-white/12 text-white` | `bg-zinc-900/5 text-zinc-700 dark:bg-white/12 dark:text-white` | Fixed |
| Dashboard :424 dismiss-nudge icon button | `hover:bg-white/10 hover:text-white` | `hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white` | Fixed |
| Dashboard :661 delete-doc icon button | same pattern | same pattern | Fixed |
| Dashboard :437-438 drag-drop border (`dt-command-bar`) | `isDragging ? 'border-white/40 bg-white/10' : 'border-white/18'` | `isDragging ? 'border-accent bg-accent/5 dark:border-white/40 dark:bg-white/10' : 'border-zinc-300 dark:border-white/18'` | Fixed. Used the existing Tailwind `accent` token (`tailwind.config` maps it to `--accent` = `#1D4ED8`) for the active-drag state rather than zinc, since it's a meaningful state change, not decoration |
| Dashboard :482 URL input | `border-white/14 bg-white/8 … placeholder:text-white/38` | `border-zinc-300 bg-white … placeholder:text-zinc-400 dark:border-white/14 dark:bg-white/8 dark:placeholder:text-white/38` | Fixed |
| Dashboard :511 "try demo" link | `hover:text-white` | `hover:text-zinc-900 dark:hover:text-white` | Fixed |
| Dashboard :588 "upload your own" link | `hover:text-white` | `hover:text-zinc-900 dark:hover:text-white` | Fixed |
| Dashboard :542 empty-state tile | `border-white/14 bg-white/8 text-white` | `border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-white/14 dark:bg-white/8 dark:text-white` | Fixed |

**Additional finding during sweep (not in mapping table)**: PublicHeader.tsx:36, public nav link hover — `hover:bg-white/10 hover:text-zinc-950 dark:hover:text-white`. The `hover:bg-white/10` had no `dark:` prefix, so on the white `.dt-shell-header` surface in light mode a hover produced an essentially invisible ~10%-opacity-white wash on a white background (text stayed readable via `text-zinc-950`, but the hover *background* affordance was imperceptible). Fixed to `hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-white/10 dark:hover:text-white`.

**Skip-rule sites confirmed correct, left untouched** (per brief's explicit callout): DashboardPageClient.tsx:463 and :502 — upload/URL error CTA links using `bg-zinc-900 ... text-white ... dark:bg-zinc-50 dark:text-zinc-900`. These invert background per theme (dark button in light mode, light button in dark mode) so bare `text-white` is always correct against the always-dark `zinc-900` light-mode background — no `white/NN` opacity utility involved, and they don't even match the `grep "white/"` pattern.

Post-fix sweep on all three files: every remaining `white/` hit is `dark:`-prefixed. No further invisible sites found.

## Task B3 — Anonymous share affordance + demo-cap CTA callback

Implemented exactly per brief, in `ChatPanel.tsx`:

1. Added `handleAnonShareClick` (new `useCallback`, empty deps) right after `handleShareAnswerVoid`, firing `trackEvent('upgrade_click', { source: 'demo_share_attempt' })` then `openAuthModal()`, with the accepted-tradeoff comment about transcripts not surviving signup.
2. Message-level share: `onShareAnswer={userPlan ? handleShareAnswerVoid : handleAnonShareClick}` (was `... : undefined`). `MessageBubble`'s prop type is `(message: Message) => void`; assigning the zero-arg `handleAnonShareClick` is valid TS (fewer params is assignable) — confirmed by clean `tsc --noEmit`.
3. Composer share button: changed the render gate from `messages.length > 0 && !isStreaming && userPlan &&` to `messages.length > 0 && !isStreaming &&` (button now always renders once there's a message), and `onClick` from `handleShare` to `userPlan ? handleShare : handleAnonShareClick`. `disabled={shareLoading}` was left as-is — `shareLoading` is only ever set `true` inside `handleShare` (the authed path), so it stays `false` and non-blocking for anonymous clicks.
4. Demo-cap CTA: `handleDemoAuthClick` — `openAuthModal()` → `openAuthModal({ callbackUrl: '/' })`, so "Upload your own document" lands on the dashboard post-signin.

No new i18n keys were introduced by B3 (button copy/labels are unchanged; only click targets and a render gate changed).

`userPlan` semantics check (to confirm `!userPlan` reliably means "anonymous", not "still loading" for a logged-in user): `useUserPlanProfile.ts:34` sets `userPlan: profile?.plan || (isLoggedIn ? 'free' : undefined)` — the moment `useSession()` reports `authenticated`, `userPlan` is truthy (`'free'` as floor) even before the profile fetch resolves. So `userPlan` is `undefined` only for genuinely anonymous/unauthenticated sessions, not a loading flicker for logged-in users — the gate change is safe.

## Verification evidence

Ran after every task:
```
cd frontend && npx tsc --noEmit    → clean (no output) all 3 times
cd frontend && npx next lint --quiet → "✔ No ESLint warnings or errors" all 3 times
```
Final combined pass after all three tasks: both clean again.

Palette-rule spot check (global-constraints.md): `grep -rn "gray-\|indigo-\|violet-\|purple-\|transition-all"` across all 5 touched files → zero hits (excluding none needed, no Google-brand exception triggered either).

No `npm run build` was run per the constraint against running it while a dev server may be active (integration phase owns that verification).

## Files changed

- `frontend/src/components/Chat/MessageBubble.tsx`
- `frontend/src/components/Chat/ChatPanel.tsx`
- `frontend/src/components/AppHeaderShell.tsx`
- `frontend/src/components/PublicHeader.tsx`
- `frontend/src/components/dashboard/DashboardPageClient.tsx`

## Concerns

- None blocking. The `border-accent bg-accent/5` treatment for the active-drag dashboard drop zone (Dashboard :437-438) is not a judgment call — the brief specifies that exact string verbatim (brief line 55: `isDragging ? 'border-accent bg-accent/5 dark:border-white/40 dark:bg-white/10' : 'border-zinc-300 dark:border-white/18'`), applied as written.
- The additional PublicHeader.tsx:36 fix (nav-link hover background) was not in the mapping table; found and fixed during the mandated sweep step per the brief's own instructions ("Fix any additional invisible ones the same way").

Report path: `/Users/mayijie/Projects/Code/010_DocTalk/.superpowers/sdd/2026-08-02-p0-demo-retune-ui-fixes/wave-visual-report.md`

---

## Fix Round 1 (review findings)

Addressed three findings from the W2 review. Commit: `db7d263`.

**IMPORTANT-1 — thumbs-up active state invisible in light mode.** `MessageBubble.tsx:346` (in the same feedback-button hunk fixed in C1, ~4 lines above the already-fixed inactive-state hover pattern): the ternary's active (`feedback === 'up'`) branch was bare `'text-white'` with no `dark:` split, sitting on the white `.dt-answer-card` surface — once a user marked an answer helpful, the thumbs-up icon vanished in light mode. This was missed in the original C1 pass because the grep pattern `hover:text-white` doesn't match a bare unconditional `'text-white'` string in a ternary. Fixed following the sibling pattern (thumbs-down active branch already used `'text-red-500 dark:text-red-400'`): changed to `'text-accent dark:text-white'` — `text-accent` confirmed as an established class elsewhere in the codebase (e.g. `Footer.tsx:81,96,111,126,164`). Light mode now shows the app accent blue on an active thumbs-up; dark mode keeps the prior white appearance unchanged.

**SWEEP-GAP-2 — bare `text-white`/`bg-white` sweep.** Ran `grep -noP '(?<!dark:)(?<!:)(bg-white|text-white)(?!/)\b'` across all five touched files (a stricter form of the requested `grep -n "text-white\|bg-white"` that isolates bare/no-opacity hits even when they share a line with an already-fixed `white/NN` token). Results, all audited against the same surface-judgment rule:

| Site | Value | Surface | Decision |
|---|---|---|---|
| MessageBubble.tsx:151 | `bg-white` (code block, `<pre>`) | Paired with `dark:bg-zinc-900` — intentional light-mode white code-block background, not a de-glassing leftover | Skipped — correct as-is |
| MessageBubble.tsx:274 | `text-white` (error message bubble) | On `bg-red-500/92` — a permanently-colored surface, not theme-dependent; white text is always legible on solid red | Skipped — correct as-is |
| MessageBubble.tsx:346 | `text-white` (thumbs-up active) | On white `.dt-answer-card` | **Fixed** (IMPORTANT-1, above) |
| ChatPanel.tsx:552 | `bg-white` (scroll-to-bottom button) | Paired with `dark:bg-white/10`, part of the C1 mapping-table fix already landed (`border-zinc-200 bg-white ... dark:border-white/14 dark:bg-white/10`) | Skipped — correct as-is |
| DashboardPageClient.tsx:463 | `text-white` (upload-error CTA link) | `bg-zinc-900 ... dark:bg-zinc-50 dark:text-zinc-900` — the theme-inverting kind the review explicitly called out as known-correct | Skipped — correct as-is |
| DashboardPageClient.tsx:482 | `bg-white` (URL input) | Paired with `dark:bg-white/8`, part of the C2 mapping-table fix already landed | Skipped — correct as-is |
| DashboardPageClient.tsx:502 | `text-white` (URL-error CTA link) | Same theme-inverting pattern as :463 | Skipped — correct as-is |
| DashboardPageClient.tsx:626 | `text-white` (delete-confirm "Yes" button) | On `bg-red-600 hover:bg-red-500` — permanently-red action button, not theme-dependent | Skipped — correct as-is |

No fixes needed from this sweep beyond the one already covered by IMPORTANT-1 — every other bare `white` hit is either paired with a `dark:` counterpart (already correct) or sits on a permanently-colored (non-theme-toggling) surface.

**REPORT-FIX-3 — Concerns section corrected.** The original Concerns paragraph mischaracterized the Dashboard drag-drop `border-accent bg-accent/5` treatment as an undocumented judgment call; corrected above — the brief specifies that exact string verbatim at line 55, applied as written, not a deviation.

**Verification**: `npx tsc --noEmit` clean, `npx next lint --quiet` → "✔ No ESLint warnings or errors". No `npm run build` run (same constraint as before).

Project rules, implementation plan, and the internal review ledger/reports are now loaded. I’m moving to independent code-path auditing rather than relying on the prior reviewers’ conclusions.
  ✓ Read project rules, plan, internal review trail, and commit-range summary
  → Audit backend demo metering, session limits, cleanup concurrency, and public events
  • Audit frontend session reuse, auth redirect, i18n, sharing, and class changes
  • Validate suspected issues against tests/history and write severity-ranked verdict
exec
/bin/zsh -lc 'git diff --unified=100 04a2eb89..aaeb334 -- backend/app/api/chat.py backend/app/api/events.py backend/app/workers/cleanup_tasks.py backend/app/workers/celery_app.py backend/tests/test_demo_limits.py backend/tests/test_cleanup_tasks.py backend/tests/test_events_api.py' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
diff --git a/backend/app/api/chat.py b/backend/app/api/chat.py
index b61f6c9..0bf23e0 100644
--- a/backend/app/api/chat.py
+++ b/backend/app/api/chat.py
@@ -1,550 +1,588 @@
 from __future__ import annotations
 
+import datetime as dt
 import json
 import uuid
 from datetime import datetime, timedelta, timezone
 from typing import AsyncGenerator, Optional
 
 from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
 from fastapi.responses import JSONResponse, StreamingResponse
 from sqlalchemy import asc, desc, func, select
 from sqlalchemy.ext.asyncio import AsyncSession
 from sqlalchemy.orm import selectinload
 
 from app.core.config import settings
 from app.core.deps import get_current_user_optional, get_db_session
 from app.core.rate_limit import (
     auth_chat_limiter,
     demo_chat_limiter,
     demo_message_tracker,
     demo_session_create_limiter,
     get_client_ip,
 )
 from app.core.security_log import log_security_event
 from app.models.tables import (
     ChatSession,
     Collection,
     Document,
     Message,
     UsageRecord,
     User,
 )
 from app.schemas.chat import (
     ChatMessageResponse,
     ChatRequest,
     ContinueRequest,
     SessionCreateResponse,
     SessionListItem,
     SessionListResponse,
     SessionMessagesResponse,
     SessionResponse,
 )
 from app.services import credit_service
 from app.services.chat_service import chat_service
 from app.services.doc_service import can_access_document
 from app.services.share_anchor_service import message_share_anchor
 
 DEMO_MESSAGE_LIMIT = 5
 DEMO_MAX_SESSIONS_PER_DOC = 500
 
+
+def _demo_message_key(client_ip: str, document_id) -> str:
+    """Demo message counter key, scoped per (IP, document).
+
+    Marketing promises "5 free messages per document" — the counter must not
+    be shared across the 3 sample docs. TTL (24h) is handled by the tracker.
+    """
+    return f"{client_ip}:{document_id}"
+
+
+def _recent_demo_session_filter(document_id):
+    """Anonymous demo session cap counts a rolling 24h window, not lifetime.
+
+    Lifetime counting killed each demo doc permanently at 500 sessions.
+    """
+    return [
+        ChatSession.document_id == document_id,
+        ChatSession.created_at > func.now() - dt.timedelta(hours=24),
+    ]
+
+
 chat_router = APIRouter(prefix="/api", tags=["chat"])
 
 DOCUMENT_NOT_FOUND_DETAIL = {
     "error": "DOCUMENT_NOT_FOUND",
     "message": "Document not found",
 }
 SESSION_NOT_FOUND_DETAIL = {
     "error": "SESSION_NOT_FOUND",
     "message": "Session not found",
 }
 MESSAGE_NOT_FOUND_DETAIL = {
     "error": "MESSAGE_NOT_FOUND",
     "message": "Message not found",
 }
 
 
 def _as_utc(dt):
     if dt is None:
         return None
     if dt.tzinfo is None:
         return dt.replace(tzinfo=timezone.utc)
     return dt.astimezone(timezone.utc)
 
 
 async def enforce_free_mode_limits(db: AsyncSession, user: User, mode: Optional[str]) -> None:
     """Limit Free-plan access to higher-cost modes without adding a new table."""
     if (user.plan or "free").lower() != "free":
         return
 
     effective_mode = mode if mode in settings.MODE_MODELS else "balanced"
     # Internal "balanced" now maps to the visible Pro mode.
     if effective_mode != "balanced":
         return
 
     configured_limit = (
         settings.FREE_PRO_MONTHLY_LIMIT
         if settings.FREE_PRO_MONTHLY_LIMIT is not None
         else settings.FREE_BALANCED_MONTHLY_LIMIT
     )
     limit = int(configured_limit or 0)
     if limit <= 0:
         return
 
     window_start = _as_utc(getattr(user, "monthly_credits_granted_at", None))
     if window_start is None:
         window_start = datetime.now(timezone.utc) - timedelta(days=30)
 
     pro_model = settings.MODE_MODELS["balanced"]
     used = await db.scalar(
         select(func.count())
         .select_from(UsageRecord)
         .where(UsageRecord.user_id == user.id)
         .where(UsageRecord.model == pro_model)
         .where(UsageRecord.created_at >= window_start)
     )
     used_count = int(used or 0)
     if used_count >= limit:
         raise HTTPException(
             status_code=402,
             detail={
                 "error": "PRO_MODE_LIMIT_REACHED",
                 "message": "Free plan Pro mode limit reached",
                 "mode": "balanced",
                 "limit": limit,
                 "used": used_count,
                 "required_plan": "plus",
             },
         )
 
 
 async def verify_session_access(
     session_id: uuid.UUID,
     user: Optional[User],
     db: AsyncSession,
 ) -> Optional[ChatSession]:
     """Verify user has access to the session. Returns session if authorized, None otherwise."""
     result = await db.execute(
         select(ChatSession)
         .options(selectinload(ChatSession.document), selectinload(ChatSession.collection))
         .where(ChatSession.id == session_id)
     )
     session = result.scalar_one_or_none()
     if not session:
         return None
 
     # Demo document session ownership enforcement
     if session.document and session.document.demo_slug:
         if user is None:
             # Anonymous can only access anonymous sessions
             return session if session.user_id is None else None
         # Authenticated user can only access their own demo sessions
         return session if session.user_id == user.id else None
 
     # Non-demo document access check
     if session.document and not can_access_document(session.document, user):
         return None
 
     # If collection has an owner, verify the user matches
     if session.collection_id is not None:
         collection = session.collection or await db.get(Collection, session.collection_id)
         if not collection:
             return None
         if collection.user_id and (not user or collection.user_id != user.id):
             return None
 
     return session
 
 
 async def verify_document_access(
     document_id: uuid.UUID,
     user: Optional[User],
     db: AsyncSession,
 ) -> Optional[Document]:
     """Verify user has access to the document. Returns document if authorized, None otherwise."""
     doc = await db.get(Document, document_id)
     if not doc:
         return None
 
     return doc if can_access_document(doc, user) else None
 
 
 @chat_router.post(
     "/documents/{document_id}/sessions",
     status_code=status.HTTP_201_CREATED,
     response_model=SessionCreateResponse,
 )
 async def create_session(
     document_id: uuid.UUID,
     request: Request,
     user: Optional[User] = Depends(get_current_user_optional),
     db: AsyncSession = Depends(get_db_session),
 ):
     # Verify document access
     doc = await verify_document_access(document_id, user, db)
     if not doc:
         raise HTTPException(status_code=404, detail=DOCUMENT_NOT_FOUND_DETAIL)
 
     # Limit free-plan users to N sessions per document
     if user is not None and (user.plan or "free").lower() == "free" and not doc.demo_slug:
         session_count_result = await db.execute(
             select(func.count(ChatSession.id))
             .where(ChatSession.document_id == document_id)
         )
         if session_count_result.scalar() >= settings.FREE_MAX_SESSIONS_PER_DOC:
             raise HTTPException(
                 status_code=403,
                 detail={
                     "error": "SESSION_LIMIT_REACHED",
                     "message": "Free plan session limit reached. Upgrade for unlimited sessions.",
                     "limit": settings.FREE_MAX_SESSIONS_PER_DOC,
                     "plan": "free",
                 },
             )
 
     # Limit anonymous users on demo documents
     if user is None and doc.demo_slug:
         # M2: Per-IP rate limit on demo session creation
         client_ip = get_client_ip(request)
         if not await demo_session_create_limiter.is_allowed(client_ip):
             raise HTTPException(
                 status_code=429,
                 detail={
                     "error": "DEMO_SESSION_RATE_LIMITED",
                     "message": "Too many demo sessions created",
                     "retry_after": 300,
                 },
                 headers={"Retry-After": "300"},
             )
         session_count = await db.execute(
-            select(func.count(ChatSession.id))
-            .where(ChatSession.document_id == document_id)
+            select(func.count(ChatSession.id)).where(*_recent_demo_session_filter(document_id))
         )
         if session_count.scalar() >= DEMO_MAX_SESSIONS_PER_DOC:
             raise HTTPException(
                 status_code=429,
                 detail={
                     "error": "DEMO_SESSION_LIMIT_REACHED",
                     "message": "Demo session limit reached",
                     "limit": DEMO_MAX_SESSIONS_PER_DOC,
                 },
             )
 
     sess = ChatSession(document_id=document_id, user_id=user.id if user else None)
     db.add(sess)
     await db.commit()
     await db.refresh(sess)
 
     response = SessionResponse(
         session_id=sess.id,
         document_id=sess.document_id,
         title=sess.title,
         created_at=sess.created_at,
     )
 
     # For anonymous demo sessions, include used message count so frontend
-    # can display the correct remaining count across page refreshes and
-    # across different demo documents (limit is global per IP).
+    # can display the correct remaining count across page refreshes
+    # (limit is per IP per document).
     if user is None and doc.demo_slug:
         client_ip = get_client_ip(request)
-        used = await demo_message_tracker.get_count(client_ip)
+        used = await demo_message_tracker.get_count(_demo_message_key(client_ip, doc.id))
         return JSONResponse(
             status_code=201,
             content={**response.model_dump(mode="json"), "demo_messages_used": used},
         )
 
     return response
 
 
 @chat_router.get("/sessions/{session_id}/messages", response_model=SessionMessagesResponse)
 async def get_session_messages(
     session_id: uuid.UUID,
+    request: Request,
     user: Optional[User] = Depends(get_current_user_optional),
     db: AsyncSession = Depends(get_db_session),
 ):
     # Verify session access
     session = await verify_session_access(session_id, user, db)
     if not session:
         raise HTTPException(status_code=404, detail=SESSION_NOT_FOUND_DETAIL)
 
     rows = await db.execute(
         select(Message).where(Message.session_id == session_id).order_by(asc(Message.created_at))
     )
     items = []
     for m in rows.scalars():
         items.append(
             ChatMessageResponse(
                 id=m.id,
                 share_anchor=message_share_anchor(m.id),
                 role=m.role,
                 content=m.content,
                 citations=m.citations,
                 metadata_json=getattr(m, "metadata_json", {}) or {},
                 created_at=m.created_at,
             )
         )
-    return SessionMessagesResponse(messages=items)
+    response = SessionMessagesResponse(messages=items)
+
+    # Anonymous demo sessions: surface the used count so the frontend can
+    # restore the counter when it reuses a stored session (see create-session).
+    if session.user_id is None and session.document and session.document.demo_slug:
+        client_ip = get_client_ip(request)
+        used = await demo_message_tracker.get_count(_demo_message_key(client_ip, session.document_id))
+        return JSONResponse(
+            status_code=200,
+            content={**response.model_dump(mode="json"), "demo_messages_used": used},
+        )
+
+    return response
 
 
 @chat_router.post("/sessions/{session_id}/chat")
 async def chat_stream(
     session_id: uuid.UUID,
     body: ChatRequest,
     request: Request,
     user: Optional[User] = Depends(get_current_user_optional),
     db: AsyncSession = Depends(get_db_session),
 ):
     # Verify session access
     session = await verify_session_access(session_id, user, db)
     if not session:
         raise HTTPException(status_code=404, detail=SESSION_NOT_FOUND_DETAIL)
 
     # Block chat if document is not fully processed
     if session.document and session.document.status != "ready":
         raise HTTPException(
             status_code=409,
             detail={
                 "error": "DOCUMENT_PROCESSING",
                 "message": "Document is still being processed",
                 "status": session.document.status,
             },
         )
 
     # Rate limit anonymous users
     if user is None:
         client_ip = get_client_ip(request)
         if not await demo_chat_limiter.is_allowed(client_ip):
             log_security_event("demo_rate_limit", ip=client_ip, session_id=session_id)
             raise HTTPException(
                 status_code=429,
                 detail={
                     "error": "RATE_LIMITED",
                     "message": "Rate limit exceeded",
                     "retry_after": 60,
                 },
                 headers={"Retry-After": "60"},
             )
     else:
         # Rate limit authenticated users (30 req/min per user)
         if not await auth_chat_limiter.is_allowed(str(user.id)):
             raise HTTPException(
                 status_code=429,
                 detail={
                     "error": "RATE_LIMITED",
                     "message": "Rate limit exceeded",
                     "retry_after": 60,
                 },
                 headers={"Retry-After": "60"},
             )
 
     # Enforce message limit for anonymous users on demo documents.
-    # Tracker key is global per IP across demo docs and survives session recreation.
+    # Tracker key is scoped per (IP, document) and survives session recreation.
     if user is None and session.document and session.document.demo_slug:
-        allowed, _count = await demo_message_tracker.check_and_increment(client_ip, DEMO_MESSAGE_LIMIT)
+        allowed, _count = await demo_message_tracker.check_and_increment(
+            _demo_message_key(client_ip, session.document_id), DEMO_MESSAGE_LIMIT
+        )
         if not allowed:
             log_security_event("demo_message_limit", ip=client_ip, document_id=session.document_id)
             raise HTTPException(
                 status_code=429,
                 detail={
                     "error": "DEMO_MESSAGE_LIMIT_REACHED",
                     "message": "Demo message limit reached",
                     "limit": DEMO_MESSAGE_LIMIT,
                 },
             )
 
     # If authenticated, ensure sufficient credits before opening stream
     if user is not None:
         from app.services.credit_service import ensure_monthly_credits
         await ensure_monthly_credits(db, user)
         await db.commit()
         # Use mode-specific estimated cost for pre-check (actual pre-debit happens in chat_service)
         effective_mode = body.mode or "balanced"
         await enforce_free_mode_limits(db, user, effective_mode)
         estimated_cost = credit_service.get_estimated_cost(effective_mode)
         balance = await credit_service.get_user_credits(db, user.id)
         if balance < estimated_cost:
             raise HTTPException(
                 status_code=402,
                 detail={
                     "error": "INSUFFICIENT_CREDITS",
                     "message": "Insufficient credits",
                     "required": estimated_cost,
                     "balance": balance,
                 },
             )
 
     async def event_generator() -> AsyncGenerator[str, None]:
         async for ev in chat_service.chat_stream(
             session_id, body.message, db, user=user, locale=body.locale, mode=body.mode,
             domain_mode=body.domain_mode
         ):
             # Format per SSE: event: <type>\ndata: {json}\n\n
             line = f"event: {ev['event']}\n"
             payload = json.dumps(ev.get("data", {}), ensure_ascii=False)
             data_line = f"data: {payload}\n\n"
             yield line + data_line
 
     return StreamingResponse(
         event_generator(),
         media_type="text/event-stream",
         headers={
             "Cache-Control": "no-cache, no-transform",
             "X-Accel-Buffering": "no",
             "Connection": "keep-alive",
         },
     )
 
 
 @chat_router.post("/sessions/{session_id}/chat/continue")
 async def chat_continue(
     session_id: uuid.UUID,
     body: ContinueRequest,
     request: Request,
     user: Optional[User] = Depends(get_current_user_optional),
     db: AsyncSession = Depends(get_db_session),
 ):
     # Verify session access
     session = await verify_session_access(session_id, user, db)
     if not session:
         raise HTTPException(status_code=404, detail=SESSION_NOT_FOUND_DETAIL)
 
     # Block if document is not ready
     if session.document and session.document.status != "ready":
         raise HTTPException(
             status_code=409,
             detail={
                 "error": "DOCUMENT_PROCESSING",
                 "message": "Document is still being processed",
                 "status": session.document.status,
             },
         )
 
     # Rate limit (same as chat_stream)
     if user is None:
         client_ip = get_client_ip(request)
         if not await demo_chat_limiter.is_allowed(client_ip):
             log_security_event("demo_rate_limit", ip=client_ip, session_id=session_id)
             raise HTTPException(
                 status_code=429,
                 detail={
                     "error": "RATE_LIMITED",
                     "message": "Rate limit exceeded",
                     "retry_after": 60,
                 },
                 headers={"Retry-After": "60"},
             )
     else:
         if not await auth_chat_limiter.is_allowed(str(user.id)):
             raise HTTPException(
                 status_code=429,
                 detail={
                     "error": "RATE_LIMITED",
                     "message": "Rate limit exceeded",
                     "retry_after": 60,
                 },
                 headers={"Retry-After": "60"},
             )
 
     # Demo message limit (continuations count against it)
     if user is None and session.document and session.document.demo_slug:
         client_ip = get_client_ip(request)
-        allowed, _count = await demo_message_tracker.check_and_increment(client_ip, DEMO_MESSAGE_LIMIT)
+        allowed, _count = await demo_message_tracker.check_and_increment(
+            _demo_message_key(client_ip, session.document_id), DEMO_MESSAGE_LIMIT
+        )
         if not allowed:
             log_security_event("demo_message_limit", ip=client_ip, document_id=session.document_id)
             raise HTTPException(
                 status_code=429,
                 detail={
                     "error": "DEMO_MESSAGE_LIMIT_REACHED",
                     "message": "Demo message limit reached",
                     "limit": DEMO_MESSAGE_LIMIT,
                 },
             )
 
     # Check continuation limit
     msg_id = uuid.UUID(body.message_id) if body.message_id else None
     if msg_id:
         from sqlalchemy import select as sa_select
         msg_row = await db.execute(sa_select(Message).where(Message.id == msg_id))
         msg = msg_row.scalar_one_or_none()
     else:
         msg_row = await db.execute(
             select(Message)
             .where(Message.session_id == session_id, Message.role == "assistant")
             .order_by(Message.created_at.desc())
             .limit(1)
         )
         msg = msg_row.scalar_one_or_none()
 
     if not msg:
         raise HTTPException(status_code=404, detail=MESSAGE_NOT_FOUND_DETAIL)
 
     if msg.continuation_count >= settings.MAX_CONTINUATIONS_PER_MESSAGE:
         raise HTTPException(
             status_code=400,
             detail={
                 "error": "CONTINUATION_LIMIT",
                 "message": "Maximum continuations reached",
                 "max": settings.MAX_CONTINUATIONS_PER_MESSAGE,
             },
         )
 
     # Credit pre-check for authenticated users
     if user is not None:
         from app.services.credit_service import ensure_monthly_credits
         await ensure_monthly_credits(db, user)
         await db.commit()
         effective_mode = body.mode or "balanced"
         await enforce_free_mode_limits(db, user, effective_mode)
         estimated_cost = credit_service.get_estimated_cost(effective_mode)
         balance = await credit_service.get_user_credits(db, user.id)
         if balance < estimated_cost:
             raise HTTPException(
                 status_code=402,
                 detail={
                     "error": "INSUFFICIENT_CREDITS",
                     "message": "Insufficient credits",
                     "required": estimated_cost,
                     "balance": balance,
                 },
             )
 
     async def event_generator() -> AsyncGenerator[str, None]:
         async for ev in chat_service.continue_stream(
             session_id, msg_id, db, user=user, locale=body.locale, mode=body.mode
         ):
             line = f"event: {ev['event']}\n"
             payload = json.dumps(ev.get("data", {}), ensure_ascii=False)
             data_line = f"data: {payload}\n\n"
             yield line + data_line
 
     return StreamingResponse(
         event_generator(),
         media_type="text/event-stream",
         headers={
             "Cache-Control": "no-cache, no-transform",
             "X-Accel-Buffering": "no",
             "Connection": "keep-alive",
         },
     )
 
 
 @chat_router.get("/documents/{document_id}/sessions", response_model=SessionListResponse)
 async def list_sessions(
     document_id: uuid.UUID,
     limit: int = Query(10, ge=1, le=100),
     offset: int = Query(0, ge=0),
     user: Optional[User] = Depends(get_current_user_optional),
     db: AsyncSession = Depends(get_db_session),
 ):
     # Verify document access
     doc = await verify_document_access(document_id, user, db)
     if not doc:
         raise HTTPException(status_code=404, detail=DOCUMENT_NOT_FOUND_DETAIL)
 
     # Demo documents: enforce session ownership
     if doc.demo_slug:
         if user is None:
             # Anonymous users never see previous sessions
             return SessionListResponse(sessions=[])
         # Authenticated users only see their own demo sessions (handled in query below)
 
     last_activity = func.coalesce(
diff --git a/backend/app/api/events.py b/backend/app/api/events.py
index 3aa1c2a..6f74e93 100644
--- a/backend/app/api/events.py
+++ b/backend/app/api/events.py
@@ -1,119 +1,123 @@
 from __future__ import annotations
 
 from typing import Any
 
 from fastapi import APIRouter, Depends, HTTPException, Request, Response
 from pydantic import BaseModel, Field
 from sqlalchemy.ext.asyncio import AsyncSession
 
 from app.core.deps import get_current_user_optional, get_db_session
 from app.core.rate_limit import get_client_ip, public_event_limiter
 from app.models.tables import ProductEvent, User
 
 router = APIRouter(prefix="/api/events", tags=["events"])
 
 ALLOWED_EVENTS = {
     "billing_view",
     "upgrade_click",
     "checkout_created",
     "checkout_completed",
     "upgrade_nudge_shown",
     "limit_hit",
     "document_upload_created",
     "url_ingest_created",
     "chat_message_sent",
     "chat_message_completed",
     "citation_clicked",
     "export_clicked",
     "feedback_submitted",
     "paywall_opened",
     "share_created",
     "extraction_created",
     "extraction_completed",
     "extraction_export_clicked",
     "table_scan_created",
     "table_export_clicked",
     "question_template_created",
     "question_template_run_created",
     "question_template_export_clicked",
     "document_diff_created",
     "document_diff_export_clicked",
     "subscription_cancel_requested",
     "refund_requested",
     "landing_cta_clicked",
     "auth_modal_opened",
     "auth_provider_clicked",
     "auth_email_link_requested",
     "auth_email_link_sent",
     "auth_email_link_failed",
+    "auth_confirm_viewed",
+    "auth_confirm_clicked",
 }
 
 PUBLIC_EVENTS = {
     "landing_cta_clicked",
     "auth_modal_opened",
     "auth_provider_clicked",
     "auth_email_link_requested",
     "auth_email_link_sent",
     "auth_email_link_failed",
+    "auth_confirm_viewed",
+    "auth_confirm_clicked",
     "upgrade_click",
     "paywall_opened",
     "limit_hit",
 }
 
 
 class ProductEventRequest(BaseModel):
     event_name: str = Field(min_length=1, max_length=64)
     properties: dict[str, Any] = Field(default_factory=dict)
 
 
 def _safe_text(value: Any, max_len: int = 64) -> str | None:
     if value is None:
         return None
     text = str(value).strip()
     if not text:
         return None
     return text[:max_len]
 
 
 def _safe_properties(raw: dict[str, Any]) -> dict[str, Any]:
     safe: dict[str, Any] = {}
     for key, value in list(raw.items())[:20]:
         safe_key = _safe_text(key, 64)
         if not safe_key:
             continue
         if isinstance(value, (str, int, float, bool)) or value is None:
             safe[safe_key] = value if not isinstance(value, str) else value[:256]
         else:
             safe[safe_key] = str(value)[:256]
     return safe
 
 
 @router.post("", status_code=204)
 async def record_product_event(
     body: ProductEventRequest,
     request: Request,
     user: User | None = Depends(get_current_user_optional),
     db: AsyncSession = Depends(get_db_session),
 ):
     if body.event_name not in ALLOWED_EVENTS:
         raise HTTPException(status_code=400, detail="Unsupported event")
     if user is None:
         if body.event_name not in PUBLIC_EVENTS:
             raise HTTPException(status_code=401, detail="Authentication required")
         client_ip = get_client_ip(request)
         if not await public_event_limiter.is_allowed(client_ip):
             raise HTTPException(status_code=429, detail="Too many events")
 
     properties = _safe_properties(body.properties)
     event = ProductEvent(
         user_id=user.id if user else None,
         event_name=body.event_name,
         source=_safe_text(properties.get("source")),
         reason=_safe_text(properties.get("reason")),
         plan=_safe_text(properties.get("plan"), 16),
         billing=_safe_text(properties.get("period") or properties.get("billing"), 16),
         metadata_json=properties,
     )
     db.add(event)
     await db.commit()
     return Response(status_code=204)
diff --git a/backend/app/workers/celery_app.py b/backend/app/workers/celery_app.py
index 6aa38c3..c600998 100644
--- a/backend/app/workers/celery_app.py
+++ b/backend/app/workers/celery_app.py
@@ -1,56 +1,60 @@
 from __future__ import annotations
 
 import sentry_sdk
 from celery import Celery
 
 from app.core.config import settings
 
 # Initialize Sentry for Celery workers (no-op if DSN is not configured)
 if settings.SENTRY_DSN:
     sentry_sdk.init(
         dsn=settings.SENTRY_DSN,
         environment=settings.SENTRY_ENVIRONMENT,
         traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
         send_default_pii=False,
     )
 
 # Create Celery application
 celery_app = Celery(
     "doctalk",
     broker=settings.CELERY_BROKER_URL,
     include=[
         "app.workers.parse_worker",
         "app.workers.brief_worker",
         "app.workers.extraction_worker",
         "app.workers.table_worker",
         "app.workers.question_template_worker",
         "app.workers.document_diff_worker",
         "app.workers.layout_translation_worker",
         "app.workers.deletion_worker",
         "app.workers.cleanup_tasks",
     ],
 )
 
 # Basic configuration and task routing
 celery_app.conf.update(
     task_default_queue="default",
     task_acks_late=True,
     worker_prefetch_multiplier=1,
     # Requeue unacked tasks after 40 minutes. This must exceed the longest
     # task time_limit (layout translation is 35 minutes), otherwise Redis can
     # redeliver a still-running PDF translation during normal execution.
     broker_transport_options={"visibility_timeout": 2400},
 )
 
 # Route parsing-related tasks to a dedicated queue
 celery_app.conf.task_routes = {
     "app.workers.parse_worker.parse_document": {"queue": "parse"},
 }
 
 # Periodic tasks (requires celery beat scheduler)
 celery_app.conf.beat_schedule = {
     "cleanup-expired-tokens-daily": {
         "task": "cleanup_expired_verification_tokens",
         "schedule": 86400,  # Every 24 hours
     },
+    "cleanup-empty-demo-sessions-daily": {
+        "task": "cleanup_empty_demo_sessions",
+        "schedule": 86400,
+    },
 }
diff --git a/backend/app/workers/cleanup_tasks.py b/backend/app/workers/cleanup_tasks.py
index bfa46d7..123ecbf 100644
--- a/backend/app/workers/cleanup_tasks.py
+++ b/backend/app/workers/cleanup_tasks.py
@@ -1,43 +1,86 @@
 """Periodic cleanup tasks for expired data."""
 from __future__ import annotations
 
 import logging
 from datetime import datetime, timedelta, timezone
 
 import sqlalchemy as sa
 
 from app.core.config import settings
 from app.workers.celery_app import celery_app
 
 logger = logging.getLogger(__name__)
 
 
 @celery_app.task(name="cleanup_expired_verification_tokens")
 def cleanup_expired_verification_tokens():
     """Delete verification tokens that expired more than 48 hours ago.
 
     Uses synchronous DB connection since Celery tasks run in separate worker processes.
     """
     cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
 
     # Convert async DB URL to sync for Celery worker
     db_url = settings.DATABASE_URL
     if not db_url:
         logger.error("DATABASE_URL not configured, skipping token cleanup")
         return
     sync_url = db_url.replace("postgresql+asyncpg://", "postgresql+psycopg://")
 
     engine = sa.create_engine(sync_url)
     try:
         with engine.begin() as conn:
             result = conn.execute(
                 sa.text("DELETE FROM verification_tokens WHERE expires < :cutoff"),
                 {"cutoff": cutoff},
             )
             deleted = result.rowcount
         if deleted:
             logger.info("Cleaned up %d expired verification tokens", deleted)
         else:
             logger.debug("No expired verification tokens to clean up")
     finally:
         engine.dispose()
+
+
+@celery_app.task(name="cleanup_empty_demo_sessions")
+def cleanup_empty_demo_sessions() -> int:
+    """Delete anonymous demo sessions older than 7 days with no messages.
+
+    Anonymous demo browsing creates session rows that never get pruned;
+    the sessions table only ever grows. Uses synchronous DB connection
+    since Celery tasks run in separate worker processes.
+    """
+    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
+
+    db_url = settings.DATABASE_URL
+    if not db_url:
+        logger.error("DATABASE_URL not configured, skipping demo session cleanup")
+        return 0
+    sync_url = db_url.replace("postgresql+asyncpg://", "postgresql+psycopg://")
+
+    engine = sa.create_engine(sync_url)
+    try:
+        with engine.begin() as conn:
+            result = conn.execute(
+                sa.text(
+                    """
+                    DELETE FROM sessions
+                    WHERE user_id IS NULL
+                      AND created_at < :cutoff
+                      AND document_id IN (SELECT id FROM documents WHERE demo_slug IS NOT NULL)
+                      AND NOT EXISTS (
+                          SELECT 1 FROM messages WHERE messages.session_id = sessions.id
+                      )
+                    """
+                ),
+                {"cutoff": cutoff},
+            )
+            deleted = result.rowcount or 0
+        if deleted:
+            logger.info("Cleaned up %d empty anonymous demo sessions", deleted)
+        else:
+            logger.debug("No empty anonymous demo sessions to clean up")
+        return deleted
+    finally:
+        engine.dispose()
diff --git a/backend/tests/test_cleanup_tasks.py b/backend/tests/test_cleanup_tasks.py
index 443b574..447b2b3 100644
--- a/backend/tests/test_cleanup_tasks.py
+++ b/backend/tests/test_cleanup_tasks.py
@@ -1,39 +1,125 @@
 from __future__ import annotations
 
+import uuid
+from datetime import datetime, timedelta, timezone
 from types import SimpleNamespace
 
+import pytest
+import sqlalchemy as sa
+
+from app.models.sync_database import SyncSessionLocal
+from app.models.tables import ChatSession, Document, Message, User
 from app.workers import cleanup_tasks
 
 
 def test_cleanup_uses_psycopg_driver(monkeypatch) -> None:
     captured: dict[str, object] = {}
 
     class DummyTransaction:
         def __enter__(self):
             return SimpleNamespace(execute=lambda *_args, **_kwargs: SimpleNamespace(rowcount=0))
 
         def __exit__(self, exc_type, exc, tb):
             return False
 
     class DummyEngine:
         def begin(self):
             return DummyTransaction()
 
         def dispose(self):
             captured["disposed"] = True
 
     def fake_create_engine(url: str):
         captured["url"] = url
         return DummyEngine()
 
     monkeypatch.setattr(
         cleanup_tasks.settings,
         "DATABASE_URL",
         "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres",
     )
     monkeypatch.setattr(cleanup_tasks.sa, "create_engine", fake_create_engine)
 
     cleanup_tasks.cleanup_expired_verification_tokens()
 
     assert captured["url"] == "postgresql+psycopg://postgres:postgres@localhost:5432/postgres"
     assert captured["disposed"] is True
+
+
+def _make_document(db, *, demo_slug: str | None) -> Document:
+    doc = Document(
+        filename="demo.pdf",
+        file_size=1024,
+        storage_key=f"test/{uuid.uuid4()}.pdf",
+        demo_slug=demo_slug,
+    )
+    db.add(doc)
+    db.flush()
+    return doc
+
+
+def _make_session(db, *, document_id, user_id, created_at) -> ChatSession:
+    sess = ChatSession(document_id=document_id, user_id=user_id, created_at=created_at)
+    db.add(sess)
+    db.flush()
+    return sess
+
+
+@pytest.mark.integration
+def test_cleanup_empty_demo_sessions_deletes_only_stale_empty_anonymous_demo_sessions() -> None:
+    now = datetime.now(timezone.utc)
+    old = now - timedelta(days=8)
+    recent = now - timedelta(days=1)
+
+    with SyncSessionLocal() as db:
+        demo_doc = _make_document(db, demo_slug=f"cleanup-test-{uuid.uuid4().hex[:8]}")
+        user = User(email=f"cleanup-{uuid.uuid4().hex}@example.com")
+        db.add(user)
+        db.flush()
+
+        # (a) anonymous, demo doc, 8 days old, 0 messages -> deleted
+        stale_empty = _make_session(db, document_id=demo_doc.id, user_id=None, created_at=old)
+
+        # (b) same but with 1 message -> kept
+        stale_with_message = _make_session(db, document_id=demo_doc.id, user_id=None, created_at=old)
+        db.add(Message(session_id=stale_with_message.id, role="user", content="hi"))
+
+        # (c) anonymous, demo doc, 1 day old, 0 messages -> kept
+        recent_empty = _make_session(db, document_id=demo_doc.id, user_id=None, created_at=recent)
+
+        # (d) authed session, 8 days old, 0 messages -> kept
+        authed_empty = _make_session(db, document_id=demo_doc.id, user_id=user.id, created_at=old)
+
+        db.commit()
+
+        session_ids = {
+            "stale_empty": stale_empty.id,
+            "stale_with_message": stale_with_message.id,
+            "recent_empty": recent_empty.id,
+            "authed_empty": authed_empty.id,
+        }
+        document_id = demo_doc.id
+        user_id = user.id
+
+    try:
+        deleted = cleanup_tasks.cleanup_empty_demo_sessions()
+        assert deleted == 1
+
+        with SyncSessionLocal() as db:
+            remaining_ids = {
+                row[0]
+                for row in db.execute(
+                    sa.select(ChatSession.id).where(ChatSession.id.in_(session_ids.values()))
+                )
+            }
+        assert session_ids["stale_empty"] not in remaining_ids
+        assert session_ids["stale_with_message"] in remaining_ids
+        assert session_ids["recent_empty"] in remaining_ids
+        assert session_ids["authed_empty"] in remaining_ids
+    finally:
+        with SyncSessionLocal() as db:
+            db.execute(sa.delete(Message).where(Message.session_id.in_(session_ids.values())))
+            db.execute(sa.delete(ChatSession).where(ChatSession.id.in_(session_ids.values())))
+            db.execute(sa.delete(Document).where(Document.id == document_id))
+            db.execute(sa.delete(User).where(User.id == user_id))
+            db.commit()
diff --git a/backend/tests/test_demo_limits.py b/backend/tests/test_demo_limits.py
new file mode 100644
index 0000000..8b4d944
--- /dev/null
+++ b/backend/tests/test_demo_limits.py
@@ -0,0 +1,26 @@
+import uuid
+
+from app.api.chat import _demo_message_key, _recent_demo_session_filter
+from app.core.rate_limit import InMemoryDemoMessageTracker
+
+
+def test_demo_message_key_is_scoped_by_document():
+    doc_a, doc_b = uuid.uuid4(), uuid.uuid4()
+    assert _demo_message_key("1.2.3.4", doc_a) != _demo_message_key("1.2.3.4", doc_b)
+    assert _demo_message_key("1.2.3.4", doc_a) == _demo_message_key("1.2.3.4", doc_a)
+    assert _demo_message_key("1.2.3.4", doc_a) != _demo_message_key("5.6.7.8", doc_a)
+
+
+def test_demo_counters_independent_per_document():
+    tracker = InMemoryDemoMessageTracker()
+    doc_a, doc_b = uuid.uuid4(), uuid.uuid4()
+    for _ in range(5):
+        tracker.increment(_demo_message_key("1.2.3.4", doc_a))
+    assert tracker.get_count(_demo_message_key("1.2.3.4", doc_a)) == 5
+    assert tracker.get_count(_demo_message_key("1.2.3.4", doc_b)) == 0
+
+
+def test_demo_session_window_filters_by_24h():
+    clauses = _recent_demo_session_filter(uuid.uuid4())
+    sql = " ".join(str(c) for c in clauses)
+    assert "created_at" in sql  # lifetime count regression guard
diff --git a/backend/tests/test_events_api.py b/backend/tests/test_events_api.py
index 2073189..70b2353 100644
--- a/backend/tests/test_events_api.py
+++ b/backend/tests/test_events_api.py
@@ -1,158 +1,189 @@
 from __future__ import annotations
 
 import uuid
 from types import SimpleNamespace
 from unittest.mock import AsyncMock
 
 import pytest
 
 
 class _FakeDB:
     def __init__(self) -> None:
         self.added = []
         self.committed = False
 
     def add(self, value) -> None:
         self.added.append(value)
 
     async def commit(self) -> None:
         self.committed = True
 
 
 async def _none_user():
     return None
 
 
 @pytest.mark.asyncio
 async def test_public_auth_funnel_event_is_recorded_without_user(monkeypatch):
     from fastapi import FastAPI
     from httpx import ASGITransport, AsyncClient
 
     from app.api import events as events_api
     from app.core import deps as deps_module
 
     api_app = FastAPI()
     api_app.include_router(events_api.router)
     fake_db = _FakeDB()
 
     async def _get_db():
         yield fake_db
 
     api_app.dependency_overrides[deps_module.get_db_session] = _get_db
     api_app.dependency_overrides[deps_module.get_current_user_optional] = _none_user
     monkeypatch.setattr(events_api.public_event_limiter, "is_allowed", AsyncMock(return_value=True))
 
     async with AsyncClient(transport=ASGITransport(app=api_app), base_url="http://test") as client:
         response = await client.post(
             "/api/events",
             json={
                 "event_name": "auth_provider_clicked",
                 "properties": {
                     "source": "auth_modal",
                     "provider": "google",
                     "path": "/",
                     "ignored": {"nested": "object"},
                 },
             },
         )
 
     assert response.status_code == 204
     assert fake_db.committed is True
     assert len(fake_db.added) == 1
     event = fake_db.added[0]
     assert event.user_id is None
     assert event.event_name == "auth_provider_clicked"
     assert event.source == "auth_modal"
     assert event.metadata_json["provider"] == "google"
     assert event.metadata_json["ignored"] == "{'nested': 'object'}"
 
 
+@pytest.mark.asyncio
+@pytest.mark.parametrize("event_name", ["auth_confirm_viewed", "auth_confirm_clicked"])
+async def test_public_auth_confirm_events_are_recorded_without_user(monkeypatch, event_name):
+    from fastapi import FastAPI
+    from httpx import ASGITransport, AsyncClient
+
+    from app.api import events as events_api
+    from app.core import deps as deps_module
+
+    api_app = FastAPI()
+    api_app.include_router(events_api.router)
+    fake_db = _FakeDB()
+
+    async def _get_db():
+        yield fake_db
+
+    api_app.dependency_overrides[deps_module.get_db_session] = _get_db
+    api_app.dependency_overrides[deps_module.get_current_user_optional] = _none_user
+    monkeypatch.setattr(events_api.public_event_limiter, "is_allowed", AsyncMock(return_value=True))
+
+    async with AsyncClient(transport=ASGITransport(app=api_app), base_url="http://test") as client:
+        response = await client.post(
+            "/api/events",
+            json={"event_name": event_name, "properties": {"valid": 1}},
+        )
+
+    assert response.status_code == 204
+    assert fake_db.committed is True
+    assert fake_db.added[0].event_name == event_name
+
+
 @pytest.mark.asyncio
 async def test_public_event_rejects_private_event_without_user(monkeypatch):
     from fastapi import FastAPI
     from httpx import ASGITransport, AsyncClient
 
     from app.api import events as events_api
     from app.core import deps as deps_module
 
     api_app = FastAPI()
     api_app.include_router(events_api.router)
     fake_db = _FakeDB()
 
     async def _get_db():
         yield fake_db
 
     api_app.dependency_overrides[deps_module.get_db_session] = _get_db
     api_app.dependency_overrides[deps_module.get_current_user_optional] = _none_user
     monkeypatch.setattr(events_api.public_event_limiter, "is_allowed", AsyncMock(return_value=True))
 
     async with AsyncClient(transport=ASGITransport(app=api_app), base_url="http://test") as client:
         response = await client.post(
             "/api/events",
             json={"event_name": "checkout_completed", "properties": {"source": "test"}},
         )
 
     assert response.status_code == 401
     assert fake_db.added == []
 
 
 @pytest.mark.asyncio
 async def test_public_event_rate_limit(monkeypatch):
     from fastapi import FastAPI
     from httpx import ASGITransport, AsyncClient
 
     from app.api import events as events_api
     from app.core import deps as deps_module
 
     api_app = FastAPI()
     api_app.include_router(events_api.router)
 
     async def _get_db():
         yield _FakeDB()
 
     api_app.dependency_overrides[deps_module.get_db_session] = _get_db
     api_app.dependency_overrides[deps_module.get_current_user_optional] = _none_user
     monkeypatch.setattr(events_api.public_event_limiter, "is_allowed", AsyncMock(return_value=False))
 
     async with AsyncClient(transport=ASGITransport(app=api_app), base_url="http://test") as client:
         response = await client.post(
             "/api/events",
             json={"event_name": "auth_modal_opened", "properties": {"source": "auth_modal"}},
         )
 
     assert response.status_code == 429
 
 
 @pytest.mark.asyncio
 async def test_authenticated_user_can_record_private_event(monkeypatch):
     from fastapi import FastAPI
     from httpx import ASGITransport, AsyncClient
 
     from app.api import events as events_api
     from app.core import deps as deps_module
 
     api_app = FastAPI()
     api_app.include_router(events_api.router)
     fake_db = _FakeDB()
     user_id = uuid.uuid4()
 
     async def _get_db():
         yield fake_db
 
     async def _get_user():
         return SimpleNamespace(id=user_id)
 
     api_app.dependency_overrides[deps_module.get_db_session] = _get_db
     api_app.dependency_overrides[deps_module.get_current_user_optional] = _get_user
     monkeypatch.setattr(events_api.public_event_limiter, "is_allowed", AsyncMock(return_value=False))
 
     async with AsyncClient(transport=ASGITransport(app=api_app), base_url="http://test") as client:
         response = await client.post(
             "/api/events",
             json={"event_name": "checkout_completed", "properties": {"source": "stripe"}},
         )
 
     assert response.status_code == 204
     event = fake_db.added[0]
     assert event.user_id == user_id
     assert event.event_name == "checkout_completed"

exec
/bin/zsh -lc "nl -ba backend/app/api/chat.py | sed -n '1,720p'; printf '\\nRATE LIMIT\\n'; nl -ba backend/app/core/rate_limit.py | sed -n '1,420p'; printf '\\nDEPS IP/AUTH\\n'; rg -n \"def get_client_ip|class .*Tracker|demo_message_tracker|PUBLIC_EVENT|public_event_limiter|X-Proxy|proxy\" backend/app backend/tests | head -n 300; printf '\\nSCHEMA INDEXES\\n'; rg -n \"class ChatSession|class Message|class Document|Index\\(|created_at|session_id\" backend/app/models backend/alembic backend/migrations 2>/dev/null | head -n 500" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	from __future__ import annotations
     2	
     3	import datetime as dt
     4	import json
     5	import uuid
     6	from datetime import datetime, timedelta, timezone
     7	from typing import AsyncGenerator, Optional
     8	
     9	from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
    10	from fastapi.responses import JSONResponse, StreamingResponse
    11	from sqlalchemy import asc, desc, func, select
    12	from sqlalchemy.ext.asyncio import AsyncSession
    13	from sqlalchemy.orm import selectinload
    14	
    15	from app.core.config import settings
    16	from app.core.deps import get_current_user_optional, get_db_session
    17	from app.core.rate_limit import (
    18	    auth_chat_limiter,
    19	    demo_chat_limiter,
    20	    demo_message_tracker,
    21	    demo_session_create_limiter,
    22	    get_client_ip,
    23	)
    24	from app.core.security_log import log_security_event
    25	from app.models.tables import (
    26	    ChatSession,
    27	    Collection,
    28	    Document,
    29	    Message,
    30	    UsageRecord,
    31	    User,
    32	)
    33	from app.schemas.chat import (
    34	    ChatMessageResponse,
    35	    ChatRequest,
    36	    ContinueRequest,
    37	    SessionCreateResponse,
    38	    SessionListItem,
    39	    SessionListResponse,
    40	    SessionMessagesResponse,
    41	    SessionResponse,
    42	)
    43	from app.services import credit_service
    44	from app.services.chat_service import chat_service
    45	from app.services.doc_service import can_access_document
    46	from app.services.share_anchor_service import message_share_anchor
    47	
    48	DEMO_MESSAGE_LIMIT = 5
    49	DEMO_MAX_SESSIONS_PER_DOC = 500
    50	
    51	
    52	def _demo_message_key(client_ip: str, document_id) -> str:
    53	    """Demo message counter key, scoped per (IP, document).
    54	
    55	    Marketing promises "5 free messages per document" — the counter must not
    56	    be shared across the 3 sample docs. TTL (24h) is handled by the tracker.
    57	    """
    58	    return f"{client_ip}:{document_id}"
    59	
    60	
    61	def _recent_demo_session_filter(document_id):
    62	    """Anonymous demo session cap counts a rolling 24h window, not lifetime.
    63	
    64	    Lifetime counting killed each demo doc permanently at 500 sessions.
    65	    """
    66	    return [
    67	        ChatSession.document_id == document_id,
    68	        ChatSession.created_at > func.now() - dt.timedelta(hours=24),
    69	    ]
    70	
    71	
    72	chat_router = APIRouter(prefix="/api", tags=["chat"])
    73	
    74	DOCUMENT_NOT_FOUND_DETAIL = {
    75	    "error": "DOCUMENT_NOT_FOUND",
    76	    "message": "Document not found",
    77	}
    78	SESSION_NOT_FOUND_DETAIL = {
    79	    "error": "SESSION_NOT_FOUND",
    80	    "message": "Session not found",
    81	}
    82	MESSAGE_NOT_FOUND_DETAIL = {
    83	    "error": "MESSAGE_NOT_FOUND",
    84	    "message": "Message not found",
    85	}
    86	
    87	
    88	def _as_utc(dt):
    89	    if dt is None:
    90	        return None
    91	    if dt.tzinfo is None:
    92	        return dt.replace(tzinfo=timezone.utc)
    93	    return dt.astimezone(timezone.utc)
    94	
    95	
    96	async def enforce_free_mode_limits(db: AsyncSession, user: User, mode: Optional[str]) -> None:
    97	    """Limit Free-plan access to higher-cost modes without adding a new table."""
    98	    if (user.plan or "free").lower() != "free":
    99	        return
   100	
   101	    effective_mode = mode if mode in settings.MODE_MODELS else "balanced"
   102	    # Internal "balanced" now maps to the visible Pro mode.
   103	    if effective_mode != "balanced":
   104	        return
   105	
   106	    configured_limit = (
   107	        settings.FREE_PRO_MONTHLY_LIMIT
   108	        if settings.FREE_PRO_MONTHLY_LIMIT is not None
   109	        else settings.FREE_BALANCED_MONTHLY_LIMIT
   110	    )
   111	    limit = int(configured_limit or 0)
   112	    if limit <= 0:
   113	        return
   114	
   115	    window_start = _as_utc(getattr(user, "monthly_credits_granted_at", None))
   116	    if window_start is None:
   117	        window_start = datetime.now(timezone.utc) - timedelta(days=30)
   118	
   119	    pro_model = settings.MODE_MODELS["balanced"]
   120	    used = await db.scalar(
   121	        select(func.count())
   122	        .select_from(UsageRecord)
   123	        .where(UsageRecord.user_id == user.id)
   124	        .where(UsageRecord.model == pro_model)
   125	        .where(UsageRecord.created_at >= window_start)
   126	    )
   127	    used_count = int(used or 0)
   128	    if used_count >= limit:
   129	        raise HTTPException(
   130	            status_code=402,
   131	            detail={
   132	                "error": "PRO_MODE_LIMIT_REACHED",
   133	                "message": "Free plan Pro mode limit reached",
   134	                "mode": "balanced",
   135	                "limit": limit,
   136	                "used": used_count,
   137	                "required_plan": "plus",
   138	            },
   139	        )
   140	
   141	
   142	async def verify_session_access(
   143	    session_id: uuid.UUID,
   144	    user: Optional[User],
   145	    db: AsyncSession,
   146	) -> Optional[ChatSession]:
   147	    """Verify user has access to the session. Returns session if authorized, None otherwise."""
   148	    result = await db.execute(
   149	        select(ChatSession)
   150	        .options(selectinload(ChatSession.document), selectinload(ChatSession.collection))
   151	        .where(ChatSession.id == session_id)
   152	    )
   153	    session = result.scalar_one_or_none()
   154	    if not session:
   155	        return None
   156	
   157	    # Demo document session ownership enforcement
   158	    if session.document and session.document.demo_slug:
   159	        if user is None:
   160	            # Anonymous can only access anonymous sessions
   161	            return session if session.user_id is None else None
   162	        # Authenticated user can only access their own demo sessions
   163	        return session if session.user_id == user.id else None
   164	
   165	    # Non-demo document access check
   166	    if session.document and not can_access_document(session.document, user):
   167	        return None
   168	
   169	    # If collection has an owner, verify the user matches
   170	    if session.collection_id is not None:
   171	        collection = session.collection or await db.get(Collection, session.collection_id)
   172	        if not collection:
   173	            return None
   174	        if collection.user_id and (not user or collection.user_id != user.id):
   175	            return None
   176	
   177	    return session
   178	
   179	
   180	async def verify_document_access(
   181	    document_id: uuid.UUID,
   182	    user: Optional[User],
   183	    db: AsyncSession,
   184	) -> Optional[Document]:
   185	    """Verify user has access to the document. Returns document if authorized, None otherwise."""
   186	    doc = await db.get(Document, document_id)
   187	    if not doc:
   188	        return None
   189	
   190	    return doc if can_access_document(doc, user) else None
   191	
   192	
   193	@chat_router.post(
   194	    "/documents/{document_id}/sessions",
   195	    status_code=status.HTTP_201_CREATED,
   196	    response_model=SessionCreateResponse,
   197	)
   198	async def create_session(
   199	    document_id: uuid.UUID,
   200	    request: Request,
   201	    user: Optional[User] = Depends(get_current_user_optional),
   202	    db: AsyncSession = Depends(get_db_session),
   203	):
   204	    # Verify document access
   205	    doc = await verify_document_access(document_id, user, db)
   206	    if not doc:
   207	        raise HTTPException(status_code=404, detail=DOCUMENT_NOT_FOUND_DETAIL)
   208	
   209	    # Limit free-plan users to N sessions per document
   210	    if user is not None and (user.plan or "free").lower() == "free" and not doc.demo_slug:
   211	        session_count_result = await db.execute(
   212	            select(func.count(ChatSession.id))
   213	            .where(ChatSession.document_id == document_id)
   214	        )
   215	        if session_count_result.scalar() >= settings.FREE_MAX_SESSIONS_PER_DOC:
   216	            raise HTTPException(
   217	                status_code=403,
   218	                detail={
   219	                    "error": "SESSION_LIMIT_REACHED",
   220	                    "message": "Free plan session limit reached. Upgrade for unlimited sessions.",
   221	                    "limit": settings.FREE_MAX_SESSIONS_PER_DOC,
   222	                    "plan": "free",
   223	                },
   224	            )
   225	
   226	    # Limit anonymous users on demo documents
   227	    if user is None and doc.demo_slug:
   228	        # M2: Per-IP rate limit on demo session creation
   229	        client_ip = get_client_ip(request)
   230	        if not await demo_session_create_limiter.is_allowed(client_ip):
   231	            raise HTTPException(
   232	                status_code=429,
   233	                detail={
   234	                    "error": "DEMO_SESSION_RATE_LIMITED",
   235	                    "message": "Too many demo sessions created",
   236	                    "retry_after": 300,
   237	                },
   238	                headers={"Retry-After": "300"},
   239	            )
   240	        session_count = await db.execute(
   241	            select(func.count(ChatSession.id)).where(*_recent_demo_session_filter(document_id))
   242	        )
   243	        if session_count.scalar() >= DEMO_MAX_SESSIONS_PER_DOC:
   244	            raise HTTPException(
   245	                status_code=429,
   246	                detail={
   247	                    "error": "DEMO_SESSION_LIMIT_REACHED",
   248	                    "message": "Demo session limit reached",
   249	                    "limit": DEMO_MAX_SESSIONS_PER_DOC,
   250	                },
   251	            )
   252	
   253	    sess = ChatSession(document_id=document_id, user_id=user.id if user else None)
   254	    db.add(sess)
   255	    await db.commit()
   256	    await db.refresh(sess)
   257	
   258	    response = SessionResponse(
   259	        session_id=sess.id,
   260	        document_id=sess.document_id,
   261	        title=sess.title,
   262	        created_at=sess.created_at,
   263	    )
   264	
   265	    # For anonymous demo sessions, include used message count so frontend
   266	    # can display the correct remaining count across page refreshes
   267	    # (limit is per IP per document).
   268	    if user is None and doc.demo_slug:
   269	        client_ip = get_client_ip(request)
   270	        used = await demo_message_tracker.get_count(_demo_message_key(client_ip, doc.id))
   271	        return JSONResponse(
   272	            status_code=201,
   273	            content={**response.model_dump(mode="json"), "demo_messages_used": used},
   274	        )
   275	
   276	    return response
   277	
   278	
   279	@chat_router.get("/sessions/{session_id}/messages", response_model=SessionMessagesResponse)
   280	async def get_session_messages(
   281	    session_id: uuid.UUID,
   282	    request: Request,
   283	    user: Optional[User] = Depends(get_current_user_optional),
   284	    db: AsyncSession = Depends(get_db_session),
   285	):
   286	    # Verify session access
   287	    session = await verify_session_access(session_id, user, db)
   288	    if not session:
   289	        raise HTTPException(status_code=404, detail=SESSION_NOT_FOUND_DETAIL)
   290	
   291	    rows = await db.execute(
   292	        select(Message).where(Message.session_id == session_id).order_by(asc(Message.created_at))
   293	    )
   294	    items = []
   295	    for m in rows.scalars():
   296	        items.append(
   297	            ChatMessageResponse(
   298	                id=m.id,
   299	                share_anchor=message_share_anchor(m.id),
   300	                role=m.role,
   301	                content=m.content,
   302	                citations=m.citations,
   303	                metadata_json=getattr(m, "metadata_json", {}) or {},
   304	                created_at=m.created_at,
   305	            )
   306	        )
   307	    response = SessionMessagesResponse(messages=items)
   308	
   309	    # Anonymous demo sessions: surface the used count so the frontend can
   310	    # restore the counter when it reuses a stored session (see create-session).
   311	    if session.user_id is None and session.document and session.document.demo_slug:
   312	        client_ip = get_client_ip(request)
   313	        used = await demo_message_tracker.get_count(_demo_message_key(client_ip, session.document_id))
   314	        return JSONResponse(
   315	            status_code=200,
   316	            content={**response.model_dump(mode="json"), "demo_messages_used": used},
   317	        )
   318	
   319	    return response
   320	
   321	
   322	@chat_router.post("/sessions/{session_id}/chat")
   323	async def chat_stream(
   324	    session_id: uuid.UUID,
   325	    body: ChatRequest,
   326	    request: Request,
   327	    user: Optional[User] = Depends(get_current_user_optional),
   328	    db: AsyncSession = Depends(get_db_session),
   329	):
   330	    # Verify session access
   331	    session = await verify_session_access(session_id, user, db)
   332	    if not session:
   333	        raise HTTPException(status_code=404, detail=SESSION_NOT_FOUND_DETAIL)
   334	
   335	    # Block chat if document is not fully processed
   336	    if session.document and session.document.status != "ready":
   337	        raise HTTPException(
   338	            status_code=409,
   339	            detail={
   340	                "error": "DOCUMENT_PROCESSING",
   341	                "message": "Document is still being processed",
   342	                "status": session.document.status,
   343	            },
   344	        )
   345	
   346	    # Rate limit anonymous users
   347	    if user is None:
   348	        client_ip = get_client_ip(request)
   349	        if not await demo_chat_limiter.is_allowed(client_ip):
   350	            log_security_event("demo_rate_limit", ip=client_ip, session_id=session_id)
   351	            raise HTTPException(
   352	                status_code=429,
   353	                detail={
   354	                    "error": "RATE_LIMITED",
   355	                    "message": "Rate limit exceeded",
   356	                    "retry_after": 60,
   357	                },
   358	                headers={"Retry-After": "60"},
   359	            )
   360	    else:
   361	        # Rate limit authenticated users (30 req/min per user)
   362	        if not await auth_chat_limiter.is_allowed(str(user.id)):
   363	            raise HTTPException(
   364	                status_code=429,
   365	                detail={
   366	                    "error": "RATE_LIMITED",
   367	                    "message": "Rate limit exceeded",
   368	                    "retry_after": 60,
   369	                },
   370	                headers={"Retry-After": "60"},
   371	            )
   372	
   373	    # Enforce message limit for anonymous users on demo documents.
   374	    # Tracker key is scoped per (IP, document) and survives session recreation.
   375	    if user is None and session.document and session.document.demo_slug:
   376	        allowed, _count = await demo_message_tracker.check_and_increment(
   377	            _demo_message_key(client_ip, session.document_id), DEMO_MESSAGE_LIMIT
   378	        )
   379	        if not allowed:
   380	            log_security_event("demo_message_limit", ip=client_ip, document_id=session.document_id)
   381	            raise HTTPException(
   382	                status_code=429,
   383	                detail={
   384	                    "error": "DEMO_MESSAGE_LIMIT_REACHED",
   385	                    "message": "Demo message limit reached",
   386	                    "limit": DEMO_MESSAGE_LIMIT,
   387	                },
   388	            )
   389	
   390	    # If authenticated, ensure sufficient credits before opening stream
   391	    if user is not None:
   392	        from app.services.credit_service import ensure_monthly_credits
   393	        await ensure_monthly_credits(db, user)
   394	        await db.commit()
   395	        # Use mode-specific estimated cost for pre-check (actual pre-debit happens in chat_service)
   396	        effective_mode = body.mode or "balanced"
   397	        await enforce_free_mode_limits(db, user, effective_mode)
   398	        estimated_cost = credit_service.get_estimated_cost(effective_mode)
   399	        balance = await credit_service.get_user_credits(db, user.id)
   400	        if balance < estimated_cost:
   401	            raise HTTPException(
   402	                status_code=402,
   403	                detail={
   404	                    "error": "INSUFFICIENT_CREDITS",
   405	                    "message": "Insufficient credits",
   406	                    "required": estimated_cost,
   407	                    "balance": balance,
   408	                },
   409	            )
   410	
   411	    async def event_generator() -> AsyncGenerator[str, None]:
   412	        async for ev in chat_service.chat_stream(
   413	            session_id, body.message, db, user=user, locale=body.locale, mode=body.mode,
   414	            domain_mode=body.domain_mode
   415	        ):
   416	            # Format per SSE: event: <type>\ndata: {json}\n\n
   417	            line = f"event: {ev['event']}\n"
   418	            payload = json.dumps(ev.get("data", {}), ensure_ascii=False)
   419	            data_line = f"data: {payload}\n\n"
   420	            yield line + data_line
   421	
   422	    return StreamingResponse(
   423	        event_generator(),
   424	        media_type="text/event-stream",
   425	        headers={
   426	            "Cache-Control": "no-cache, no-transform",
   427	            "X-Accel-Buffering": "no",
   428	            "Connection": "keep-alive",
   429	        },
   430	    )
   431	
   432	
   433	@chat_router.post("/sessions/{session_id}/chat/continue")
   434	async def chat_continue(
   435	    session_id: uuid.UUID,
   436	    body: ContinueRequest,
   437	    request: Request,
   438	    user: Optional[User] = Depends(get_current_user_optional),
   439	    db: AsyncSession = Depends(get_db_session),
   440	):
   441	    # Verify session access
   442	    session = await verify_session_access(session_id, user, db)
   443	    if not session:
   444	        raise HTTPException(status_code=404, detail=SESSION_NOT_FOUND_DETAIL)
   445	
   446	    # Block if document is not ready
   447	    if session.document and session.document.status != "ready":
   448	        raise HTTPException(
   449	            status_code=409,
   450	            detail={
   451	                "error": "DOCUMENT_PROCESSING",
   452	                "message": "Document is still being processed",
   453	                "status": session.document.status,
   454	            },
   455	        )
   456	
   457	    # Rate limit (same as chat_stream)
   458	    if user is None:
   459	        client_ip = get_client_ip(request)
   460	        if not await demo_chat_limiter.is_allowed(client_ip):
   461	            log_security_event("demo_rate_limit", ip=client_ip, session_id=session_id)
   462	            raise HTTPException(
   463	                status_code=429,
   464	                detail={
   465	                    "error": "RATE_LIMITED",
   466	                    "message": "Rate limit exceeded",
   467	                    "retry_after": 60,
   468	                },
   469	                headers={"Retry-After": "60"},
   470	            )
   471	    else:
   472	        if not await auth_chat_limiter.is_allowed(str(user.id)):
   473	            raise HTTPException(
   474	                status_code=429,
   475	                detail={
   476	                    "error": "RATE_LIMITED",
   477	                    "message": "Rate limit exceeded",
   478	                    "retry_after": 60,
   479	                },
   480	                headers={"Retry-After": "60"},
   481	            )
   482	
   483	    # Demo message limit (continuations count against it)
   484	    if user is None and session.document and session.document.demo_slug:
   485	        client_ip = get_client_ip(request)
   486	        allowed, _count = await demo_message_tracker.check_and_increment(
   487	            _demo_message_key(client_ip, session.document_id), DEMO_MESSAGE_LIMIT
   488	        )
   489	        if not allowed:
   490	            log_security_event("demo_message_limit", ip=client_ip, document_id=session.document_id)
   491	            raise HTTPException(
   492	                status_code=429,
   493	                detail={
   494	                    "error": "DEMO_MESSAGE_LIMIT_REACHED",
   495	                    "message": "Demo message limit reached",
   496	                    "limit": DEMO_MESSAGE_LIMIT,
   497	                },
   498	            )
   499	
   500	    # Check continuation limit
   501	    msg_id = uuid.UUID(body.message_id) if body.message_id else None
   502	    if msg_id:
   503	        from sqlalchemy import select as sa_select
   504	        msg_row = await db.execute(sa_select(Message).where(Message.id == msg_id))
   505	        msg = msg_row.scalar_one_or_none()
   506	    else:
   507	        msg_row = await db.execute(
   508	            select(Message)
   509	            .where(Message.session_id == session_id, Message.role == "assistant")
   510	            .order_by(Message.created_at.desc())
   511	            .limit(1)
   512	        )
   513	        msg = msg_row.scalar_one_or_none()
   514	
   515	    if not msg:
   516	        raise HTTPException(status_code=404, detail=MESSAGE_NOT_FOUND_DETAIL)
   517	
   518	    if msg.continuation_count >= settings.MAX_CONTINUATIONS_PER_MESSAGE:
   519	        raise HTTPException(
   520	            status_code=400,
   521	            detail={
   522	                "error": "CONTINUATION_LIMIT",
   523	                "message": "Maximum continuations reached",
   524	                "max": settings.MAX_CONTINUATIONS_PER_MESSAGE,
   525	            },
   526	        )
   527	
   528	    # Credit pre-check for authenticated users
   529	    if user is not None:
   530	        from app.services.credit_service import ensure_monthly_credits
   531	        await ensure_monthly_credits(db, user)
   532	        await db.commit()
   533	        effective_mode = body.mode or "balanced"
   534	        await enforce_free_mode_limits(db, user, effective_mode)
   535	        estimated_cost = credit_service.get_estimated_cost(effective_mode)
   536	        balance = await credit_service.get_user_credits(db, user.id)
   537	        if balance < estimated_cost:
   538	            raise HTTPException(
   539	                status_code=402,
   540	                detail={
   541	                    "error": "INSUFFICIENT_CREDITS",
   542	                    "message": "Insufficient credits",
   543	                    "required": estimated_cost,
   544	                    "balance": balance,
   545	                },
   546	            )
   547	
   548	    async def event_generator() -> AsyncGenerator[str, None]:
   549	        async for ev in chat_service.continue_stream(
   550	            session_id, msg_id, db, user=user, locale=body.locale, mode=body.mode
   551	        ):
   552	            line = f"event: {ev['event']}\n"
   553	            payload = json.dumps(ev.get("data", {}), ensure_ascii=False)
   554	            data_line = f"data: {payload}\n\n"
   555	            yield line + data_line
   556	
   557	    return StreamingResponse(
   558	        event_generator(),
   559	        media_type="text/event-stream",
   560	        headers={
   561	            "Cache-Control": "no-cache, no-transform",
   562	            "X-Accel-Buffering": "no",
   563	            "Connection": "keep-alive",
   564	        },
   565	    )
   566	
   567	
   568	@chat_router.get("/documents/{document_id}/sessions", response_model=SessionListResponse)
   569	async def list_sessions(
   570	    document_id: uuid.UUID,
   571	    limit: int = Query(10, ge=1, le=100),
   572	    offset: int = Query(0, ge=0),
   573	    user: Optional[User] = Depends(get_current_user_optional),
   574	    db: AsyncSession = Depends(get_db_session),
   575	):
   576	    # Verify document access
   577	    doc = await verify_document_access(document_id, user, db)
   578	    if not doc:
   579	        raise HTTPException(status_code=404, detail=DOCUMENT_NOT_FOUND_DETAIL)
   580	
   581	    # Demo documents: enforce session ownership
   582	    if doc.demo_slug:
   583	        if user is None:
   584	            # Anonymous users never see previous sessions
   585	            return SessionListResponse(sessions=[])
   586	        # Authenticated users only see their own demo sessions (handled in query below)
   587	
   588	    last_activity = func.coalesce(
   589	        func.max(Message.created_at), ChatSession.created_at
   590	    ).label("last_activity_at")
   591	
   592	    stmt = (
   593	        select(
   594	            ChatSession.id,
   595	            ChatSession.title,
   596	            ChatSession.domain_mode,
   597	            ChatSession.created_at,
   598	            func.count(Message.id).label("message_count"),
   599	            last_activity,
   600	        )
   601	        .outerjoin(Message, Message.session_id == ChatSession.id)
   602	        .where(ChatSession.document_id == document_id)
   603	        .where(ChatSession.user_id == user.id if (doc.demo_slug and user) else True)
   604	        .group_by(ChatSession.id, ChatSession.title, ChatSession.domain_mode, ChatSession.created_at)
   605	        .order_by(desc(last_activity))
   606	        .limit(limit)
   607	        .offset(offset)
   608	    )
   609	    result = await db.execute(stmt)
   610	    rows = result.all()
   611	    sessions = [
   612	        SessionListItem(
   613	            session_id=row.id,
   614	            title=row.title,
   615	            message_count=row.message_count,
   616	            domain_mode=getattr(row, 'domain_mode', None),
   617	            created_at=row.created_at,
   618	            last_activity_at=row.last_activity_at,
   619	        )
   620	        for row in rows
   621	    ]
   622	    return SessionListResponse(sessions=sessions)
   623	
   624	
   625	@chat_router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
   626	async def delete_session(
   627	    session_id: uuid.UUID,
   628	    user: Optional[User] = Depends(get_current_user_optional),
   629	    db: AsyncSession = Depends(get_db_session),
   630	):
   631	    # Verify session access
   632	    session = await verify_session_access(session_id, user, db)
   633	    if not session:
   634	        raise HTTPException(status_code=404, detail=SESSION_NOT_FOUND_DETAIL)
   635	
   636	    await db.delete(session)
   637	    await db.commit()
   638	    return None  # 204

RATE LIMIT
     1	"""Redis-backed rate limiter and demo message tracker with in-memory fallback."""
     2	
     3	from __future__ import annotations
     4	
     5	import hmac
     6	import logging
     7	import time
     8	from collections import defaultdict
     9	from typing import TYPE_CHECKING
    10	
    11	import redis.asyncio as redis
    12	
    13	from app.core.config import settings
    14	from app.core.security_log import log_security_event
    15	
    16	if TYPE_CHECKING:
    17	    from fastapi import Request
    18	
    19	logger = logging.getLogger(__name__)
    20	
    21	_REDIS_RETRY_SECONDS = 30
    22	_DEMO_COUNTER_TTL_SECONDS = 24 * 60 * 60
    23	_SENTRY_ALERT_INTERVAL_SECONDS = 600  # 10 min between Sentry events per namespace
    24	
    25	# Per-namespace throttle for Sentry capture. Log every fallback, but only
    26	# forward to Sentry once every _SENTRY_ALERT_INTERVAL_SECONDS so a prolonged
    27	# outage doesn't burn through Sentry's monthly quota (4 namespaces × 30s
    28	# reconnect cadence would otherwise = ~11k events/day).
    29	_last_sentry_alert_at: dict[str, float] = {}
    30	
    31	
    32	def _alert_redis_fallback(namespace: str, exc: Exception) -> None:
    33	    """Log Redis fallback at error level and send to Sentry if configured.
    34	
    35	    Log volume: one per failed reconnect (~2/min/namespace worst case).
    36	    Sentry volume: one per namespace per _SENTRY_ALERT_INTERVAL_SECONDS.
    37	    In-memory fallback means counts reset on restart and do NOT share state
    38	    across replicas — this is a real correctness alert, not a noisy warning.
    39	    """
    40	    logger.error(
    41	        "Redis unavailable for %s; using in-memory fallback (counts will not persist): %s",
    42	        namespace, exc,
    43	    )
    44	    if not settings.SENTRY_DSN:
    45	        return
    46	    now = time.time()
    47	    last = _last_sentry_alert_at.get(namespace, 0.0)
    48	    if now - last < _SENTRY_ALERT_INTERVAL_SECONDS:
    49	        return
    50	    _last_sentry_alert_at[namespace] = now
    51	    try:
    52	        import sentry_sdk
    53	        with sentry_sdk.push_scope() as scope:
    54	            scope.set_tag("redis_namespace", namespace)
    55	            scope.set_tag("degraded", "redis_fallback")
    56	            sentry_sdk.capture_exception(exc)
    57	    except Exception:
    58	        pass
    59	
    60	
    61	class InMemoryRateLimiter:
    62	    """Token-bucket style in-memory rate limiter keyed by arbitrary string."""
    63	
    64	    def __init__(self, max_requests: int = 10, window_seconds: int = 60):
    65	        self.max_requests = max_requests
    66	        self.window_seconds = window_seconds
    67	        self._buckets: dict[str, list[float]] = defaultdict(list)
    68	
    69	    def is_allowed(self, key: str) -> bool:
    70	        now = time.time()
    71	        if len(self._buckets) > 10000:
    72	            self._buckets = defaultdict(list, {
    73	                k: [t for t in v if now - t < self.window_seconds]
    74	                for k, v in self._buckets.items()
    75	            })
    76	            self._buckets = defaultdict(list, {k: v for k, v in self._buckets.items() if v})
    77	        bucket = self._buckets[key]
    78	        self._buckets[key] = [t for t in bucket if now - t < self.window_seconds]
    79	        if len(self._buckets[key]) >= self.max_requests:
    80	            log_security_event("rate_limit_hit", key=key, max_requests=self.max_requests)
    81	            return False
    82	        self._buckets[key].append(now)
    83	        return True
    84	
    85	
    86	class InMemoryDemoMessageTracker:
    87	    """In-memory fallback tracker for demo message counts."""
    88	
    89	    def __init__(self) -> None:
    90	        self._counts: dict[str, int] = {}
    91	
    92	    def get_count(self, key: str) -> int:
    93	        return self._counts.get(key, 0)
    94	
    95	    def increment(self, key: str) -> None:
    96	        if len(self._counts) > 10_000:
    97	            self._counts.clear()
    98	        self._counts[key] = self._counts.get(key, 0) + 1
    99	
   100	
   101	class _RedisClientMixin:
   102	    def __init__(self, *, namespace: str):
   103	        self._namespace = namespace
   104	        self._redis_url = settings.CELERY_BROKER_URL
   105	        self._redis_client: redis.Redis | None = None
   106	        self._next_retry_at = 0.0
   107	
   108	    async def _get_client(self) -> redis.Redis | None:
   109	        now = time.time()
   110	        if self._redis_client is not None:
   111	            return self._redis_client
   112	        if now < self._next_retry_at:
   113	            return None
   114	        try:
   115	            self._redis_client = redis.from_url(self._redis_url, decode_responses=True)
   116	            await self._redis_client.ping()
   117	            return self._redis_client
   118	        except Exception as e:
   119	            _alert_redis_fallback(self._namespace, e)
   120	            self._next_retry_at = now + _REDIS_RETRY_SECONDS
   121	            if self._redis_client is not None:
   122	                try:
   123	                    await self._redis_client.aclose()
   124	                except Exception:
   125	                    pass
   126	            self._redis_client = None
   127	            return None
   128	
   129	    async def _reset_client(self, error: Exception) -> None:
   130	        _alert_redis_fallback(self._namespace, error)
   131	        self._next_retry_at = time.time() + _REDIS_RETRY_SECONDS
   132	        if self._redis_client is not None:
   133	            try:
   134	                await self._redis_client.aclose()
   135	            except Exception:
   136	                pass
   137	        self._redis_client = None
   138	
   139	
   140	class RedisRateLimiter(_RedisClientMixin):
   141	    """Redis-backed rate limiter using atomic INCR + EXPIRE."""
   142	
   143	    def __init__(self, *, namespace: str, max_requests: int, window_seconds: int):
   144	        super().__init__(namespace=namespace)
   145	        self.max_requests = max_requests
   146	        self.window_seconds = window_seconds
   147	        self._fallback = InMemoryRateLimiter(max_requests=max_requests, window_seconds=window_seconds)
   148	
   149	    async def is_allowed(self, key: str) -> bool:
   150	        client = await self._get_client()
   151	        if client is None:
   152	            return self._fallback.is_allowed(key)
   153	
   154	        redis_key = f"{self._namespace}:{key}"
   155	        try:
   156	            count = await client.incr(redis_key)
   157	            if count == 1:
   158	                await client.expire(redis_key, self.window_seconds)
   159	            if count > self.max_requests:
   160	                log_security_event("rate_limit_hit", key=key, max_requests=self.max_requests)
   161	                return False
   162	            return True
   163	        except Exception as e:
   164	            await self._reset_client(e)
   165	            return self._fallback.is_allowed(key)
   166	
   167	
   168	class RedisDemoTracker(_RedisClientMixin):
   169	    """Redis-backed demo message counter using INCR + EXPIRE."""
   170	
   171	    def __init__(self, *, namespace: str, ttl_seconds: int = _DEMO_COUNTER_TTL_SECONDS):
   172	        super().__init__(namespace=namespace)
   173	        self.ttl_seconds = ttl_seconds
   174	        self._fallback = InMemoryDemoMessageTracker()
   175	
   176	    async def get_count(self, key: str) -> int:
   177	        client = await self._get_client()
   178	        if client is None:
   179	            return self._fallback.get_count(key)
   180	
   181	        redis_key = f"{self._namespace}:{key}"
   182	        try:
   183	            value = await client.get(redis_key)
   184	            return int(value or 0)
   185	        except Exception as e:
   186	            await self._reset_client(e)
   187	            return self._fallback.get_count(key)
   188	
   189	    async def increment(self, key: str) -> None:
   190	        client = await self._get_client()
   191	        if client is None:
   192	            self._fallback.increment(key)
   193	            return
   194	
   195	        redis_key = f"{self._namespace}:{key}"
   196	        try:
   197	            count = await client.incr(redis_key)
   198	            if count == 1:
   199	                await client.expire(redis_key, self.ttl_seconds)
   200	        except Exception as e:
   201	            await self._reset_client(e)
   202	            self._fallback.increment(key)
   203	
   204	    async def check_and_increment(self, key: str, limit: int) -> tuple[bool, int]:
   205	        """Atomically increment counter and check against limit.
   206	
   207	        Returns (allowed, current_count). If over limit, decrements back.
   208	        """
   209	        client = await self._get_client()
   210	        if client is None:
   211	            current = self._fallback.get_count(key)
   212	            if current >= limit:
   213	                return False, current
   214	            self._fallback.increment(key)
   215	            return True, current + 1
   216	
   217	        redis_key = f"{self._namespace}:{key}"
   218	        try:
   219	            count = await client.incr(redis_key)
   220	            if count == 1:
   221	                await client.expire(redis_key, self.ttl_seconds)
   222	            if count > limit:
   223	                await client.decr(redis_key)
   224	                return False, limit
   225	            return True, int(count)
   226	        except Exception as e:
   227	            await self._reset_client(e)
   228	            current = self._fallback.get_count(key)
   229	            if current >= limit:
   230	                return False, current
   231	            self._fallback.increment(key)
   232	            return True, current + 1
   233	
   234	
   235	demo_chat_limiter = RedisRateLimiter(namespace="rate_limit:demo_chat", max_requests=10, window_seconds=60)
   236	auth_chat_limiter = RedisRateLimiter(namespace="rate_limit:auth_chat", max_requests=30, window_seconds=60)
   237	demo_message_tracker = RedisDemoTracker(namespace="rate_limit:demo_messages")
   238	demo_session_create_limiter = RedisRateLimiter(
   239	    namespace="rate_limit:demo_session_create", max_requests=5, window_seconds=300
   240	)
   241	# Public shared-view endpoint — anonymous, unauthenticated. Limit per IP to prevent
   242	# token enumeration and traffic amplification. 60/min is generous for legitimate
   243	# users refreshing but blocks brute-force UUID scanning.
   244	shared_view_limiter = RedisRateLimiter(
   245	    namespace="rate_limit:shared_view", max_requests=60, window_seconds=60
   246	)
   247	# Anonymous read endpoints for demo documents (search, chunk detail). Gated
   248	# behind can_access_document so logged-in traffic bypasses this limiter.
   249	anon_read_limiter = RedisRateLimiter(
   250	    namespace="rate_limit:anon_read", max_requests=120, window_seconds=60
   251	)
   252	public_event_limiter = RedisRateLimiter(
   253	    namespace="rate_limit:public_events", max_requests=30, window_seconds=60
   254	)
   255	
   256	
   257	# Pre-encode signing secrets once at import time. hmac.new() requires bytes,
   258	# and re-encoding per-request is wasteful. Re-read at call time would re-import
   259	# settings, which is unnecessary because the process is restarted on env change.
   260	_ADAPTER_SECRET_BYTES: bytes = (settings.ADAPTER_SECRET or "").encode("utf-8")
   261	
   262	# Max clock skew accepted on the new HMAC contract. 60s covers NTP drift between
   263	# Vercel and Railway while keeping the replay window narrow. The signature is
   264	# bound to a per-request unix timestamp so deterministic-bucket replay (the bug
   265	# Codex caught in R3) is impossible.
   266	_MAX_SIGNED_IP_SKEW_S = 60
   267	
   268	
   269	def verify_signed_ip(
   270	    *,
   271	    ip: str | None,
   272	    ts: str | None,
   273	    sig: str | None,
   274	    now: float | None = None,
   275	    max_skew_s: int = _MAX_SIGNED_IP_SKEW_S,
   276	) -> tuple[bool, str | None]:
   277	    """Verify the triple-header HMAC IP claim emitted by the frontend proxy.
   278	
   279	    Contract:
   280	      X-Proxy-IP:     <ip>
   281	      X-Proxy-IP-Ts:  <unix_seconds>
   282	      X-Proxy-IP-Sig: hex(HMAC-SHA256(ADAPTER_SECRET, "{ip}:{ts}"))
   283	
   284	    Returns (ok, reason). `reason` is a short tag suitable for log fields when
   285	    `ok` is False; on success it is None.
   286	    """
   287	    if not ip or not ts or not sig:
   288	        return False, "missing_headers"
   289	    if not _ADAPTER_SECRET_BYTES:
   290	        return False, "no_adapter_secret"
   291	    try:
   292	        ts_int = int(ts)
   293	    except (TypeError, ValueError):
   294	        return False, "malformed_ts"
   295	    current = now if now is not None else time.time()
   296	    skew = abs(current - ts_int)
   297	    if skew > max_skew_s:
   298	        return False, "skew_exceeded"
   299	    expected = hmac.new(
   300	        _ADAPTER_SECRET_BYTES,
   301	        f"{ip}:{ts_int}".encode("utf-8"),
   302	        digestmod="sha256",
   303	    ).hexdigest()
   304	    if not hmac.compare_digest(expected, sig):
   305	        return False, "bad_signature"
   306	    return True, None
   307	
   308	
   309	def get_client_ip(request: "Request") -> str:
   310	    """Extract real client IP from the trusted Vercel proxy.
   311	
   312	    Contract: triple-header HMAC.
   313	      X-Proxy-IP / X-Proxy-IP-Ts / X-Proxy-IP-Sig signed with ADAPTER_SECRET.
   314	
   315	    Falls back to request.client.host for direct access (dev/testing). Never
   316	    trust raw X-Forwarded-For. (The legacy X-Proxy-IP-Secret/AUTH_SECRET
   317	    dual-accept path was removed 2026-05-24, 24h after the HMAC rollout with
   318	    zero proxy.signed_ip.legacy_path_used — C1 follow-up.)
   319	    """
   320	    # New contract — prefer this when present.
   321	    new_ip = request.headers.get("x-proxy-ip")
   322	    new_ts = request.headers.get("x-proxy-ip-ts")
   323	    new_sig = request.headers.get("x-proxy-ip-sig")
   324	    if new_ip or new_ts or new_sig:
   325	        ok, reason = verify_signed_ip(ip=new_ip, ts=new_ts, sig=new_sig)
   326	        if ok:
   327	            return new_ip.strip()  # type: ignore[union-attr]
   328	        # Compute skew for logging (best-effort; never raise).
   329	        skew_s: float | None = None
   330	        if new_ts:
   331	            try:
   332	                skew_s = abs(time.time() - int(new_ts))
   333	            except (TypeError, ValueError):
   334	                skew_s = None
   335	        logger.warning(
   336	            "proxy.signed_ip.verification_failed",
   337	            extra={
   338	                "reason": reason,
   339	                "claimed_ip": new_ip,
   340	                "skew_s": skew_s,
   341	            },
   342	        )
   343	        # Do NOT trust the claimed IP on failure; fall back to the connection host.
   344	
   345	    return request.client.host if request.client else "unknown"

DEPS IP/AUTH
backend/tests/test_error_taxonomy.py:581:        chat_api.demo_message_tracker,
backend/tests/test_citation_focus_refine_gating.py:4:traffic, (2) is skipped near the 60s proxy budget, (3) surfaces usage tokens
backend/tests/test_events_api.py:43:    monkeypatch.setattr(events_api.public_event_limiter, "is_allowed", AsyncMock(return_value=True))
backend/tests/test_events_api.py:88:    monkeypatch.setattr(events_api.public_event_limiter, "is_allowed", AsyncMock(return_value=True))
backend/tests/test_events_api.py:118:    monkeypatch.setattr(events_api.public_event_limiter, "is_allowed", AsyncMock(return_value=True))
backend/tests/test_events_api.py:146:    monkeypatch.setattr(events_api.public_event_limiter, "is_allowed", AsyncMock(return_value=False))
backend/tests/test_events_api.py:178:    monkeypatch.setattr(events_api.public_event_limiter, "is_allowed", AsyncMock(return_value=False))
backend/app/services/chat_service.py:974:# 60s Vercel proxy budget — a highlighting nicety must never cause a 504.
backend/app/services/chat_service.py:996:    - skipped when the stream is close to the 60s proxy budget;
backend/app/services/chat_service.py:1004:            "citation focus skipped: %.1fs elapsed, near proxy budget", elapsed_seconds
backend/app/services/chat_service.py:2384:        llm_start = time.time()  # for the focus-refinement proxy-budget guard
backend/tests/test_proxy_ip_verification.py:3:Covers the triple-header contract (`X-Proxy-IP` / `X-Proxy-IP-Ts` /
backend/tests/test_proxy_ip_verification.py:4:`X-Proxy-IP-Sig` signed with `ADAPTER_SECRET`). The legacy dual-accept path
backend/tests/test_proxy_ip_verification.py:5:(`X-Real-Client-IP` + `X-Proxy-IP-Secret` compared against `AUTH_SECRET`) was
backend/tests/test_proxy_ip_verification.py:7:`proxy.signed_ip.legacy_path_used`. Several tests below now guard that legacy
backend/tests/test_proxy_ip_verification.py:131:            "X-Proxy-IP-Secret": TEST_AUTH_SECRET,  # was valid before removal
backend/tests/test_proxy_ip_verification.py:144:            "X-Proxy-IP": "198.51.100.5",
backend/tests/test_proxy_ip_verification.py:145:            "X-Proxy-IP-Ts": str(ts),
backend/tests/test_proxy_ip_verification.py:146:            "X-Proxy-IP-Sig": _sign("198.51.100.5", ts),
backend/tests/test_proxy_ip_verification.py:149:            "X-Proxy-IP-Secret": TEST_AUTH_SECRET,
backend/tests/test_proxy_ip_verification.py:164:            "X-Proxy-IP": "198.51.100.77",  # Ts/Sig missing
backend/tests/test_proxy_ip_verification.py:167:            "X-Proxy-IP-Secret": TEST_AUTH_SECRET,
backend/tests/test_proxy_ip_verification.py:176:        r for r in caplog.records if r.message == "proxy.signed_ip.verification_failed"
backend/tests/test_proxy_ip_verification.py:191:            "X-Proxy-IP": "198.51.100.88",
backend/tests/test_proxy_ip_verification.py:192:            "X-Proxy-IP-Ts": str(stale_ts),
backend/tests/test_proxy_ip_verification.py:193:            "X-Proxy-IP-Sig": _sign("198.51.100.88", stale_ts),
backend/tests/test_proxy_ip_verification.py:196:            "X-Proxy-IP-Secret": TEST_AUTH_SECRET,
backend/tests/test_proxy_ip_verification.py:205:        r for r in caplog.records if r.message == "proxy.signed_ip.verification_failed"
backend/app/api/documents.py:270:    # to pass filename/content_type to service: create an in-memory UploadFile proxy
backend/app/core/rate_limit.py:86:class InMemoryDemoMessageTracker:
backend/app/core/rate_limit.py:168:class RedisDemoTracker(_RedisClientMixin):
backend/app/core/rate_limit.py:237:demo_message_tracker = RedisDemoTracker(namespace="rate_limit:demo_messages")
backend/app/core/rate_limit.py:252:public_event_limiter = RedisRateLimiter(
backend/app/core/rate_limit.py:277:    """Verify the triple-header HMAC IP claim emitted by the frontend proxy.
backend/app/core/rate_limit.py:280:      X-Proxy-IP:     <ip>
backend/app/core/rate_limit.py:281:      X-Proxy-IP-Ts:  <unix_seconds>
backend/app/core/rate_limit.py:282:      X-Proxy-IP-Sig: hex(HMAC-SHA256(ADAPTER_SECRET, "{ip}:{ts}"))
backend/app/core/rate_limit.py:309:def get_client_ip(request: "Request") -> str:
backend/app/core/rate_limit.py:310:    """Extract real client IP from the trusted Vercel proxy.
backend/app/core/rate_limit.py:313:      X-Proxy-IP / X-Proxy-IP-Ts / X-Proxy-IP-Sig signed with ADAPTER_SECRET.
backend/app/core/rate_limit.py:316:    trust raw X-Forwarded-For. (The legacy X-Proxy-IP-Secret/AUTH_SECRET
backend/app/core/rate_limit.py:318:    zero proxy.signed_ip.legacy_path_used — C1 follow-up.)
backend/app/core/rate_limit.py:321:    new_ip = request.headers.get("x-proxy-ip")
backend/app/core/rate_limit.py:322:    new_ts = request.headers.get("x-proxy-ip-ts")
backend/app/core/rate_limit.py:323:    new_sig = request.headers.get("x-proxy-ip-sig")
backend/app/core/rate_limit.py:336:            "proxy.signed_ip.verification_failed",
backend/app/api/events.py:10:from app.core.rate_limit import get_client_ip, public_event_limiter
backend/app/api/events.py:53:PUBLIC_EVENTS = {
backend/app/api/events.py:105:        if body.event_name not in PUBLIC_EVENTS:
backend/app/api/events.py:108:        if not await public_event_limiter.is_allowed(client_ip):
backend/app/api/chat.py:20:    demo_message_tracker,
backend/app/api/chat.py:270:        used = await demo_message_tracker.get_count(_demo_message_key(client_ip, doc.id))
backend/app/api/chat.py:313:        used = await demo_message_tracker.get_count(_demo_message_key(client_ip, session.document_id))
backend/app/api/chat.py:376:        allowed, _count = await demo_message_tracker.check_and_increment(
backend/app/api/chat.py:486:        allowed, _count = await demo_message_tracker.check_and_increment(

SCHEMA INDEXES
backend/app/models/tables.py:15:class Document(Base):
backend/app/models/tables.py:42:    created_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
backend/app/models/tables.py:124:        sa.Index("idx_pages_document", "document_id"),
backend/app/models/tables.py:148:    created_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
backend/app/models/tables.py:154:        sa.Index("idx_chunks_document", "document_id"),
backend/app/models/tables.py:158:class DocumentElement(Base):
backend/app/models/tables.py:181:    created_at: Mapped[datetime] = mapped_column(
backend/app/models/tables.py:191:        sa.Index("idx_document_elements_doc_type_order", "document_id", "element_type", "reading_order"),
backend/app/models/tables.py:192:        sa.Index("idx_document_elements_doc_pages", "document_id", "page_start", "page_end"),
backend/app/models/tables.py:197:class ChatSession(Base):
backend/app/models/tables.py:219:    created_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
backend/app/models/tables.py:229:class Message(Base):
backend/app/models/tables.py:237:    session_id: Mapped[uuid.UUID] = mapped_column(
backend/app/models/tables.py:249:    created_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
backend/app/models/tables.py:254:        sa.Index("idx_messages_session", "session_id", "created_at"),
backend/app/models/tables.py:255:        sa.Index("idx_messages_role_created_session", "role", "created_at", "session_id"),
backend/app/models/tables.py:276:    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
backend/app/models/tables.py:308:        sa.Index("idx_accounts_user_id", "user_id"),
backend/app/models/tables.py:334:    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
backend/app/models/tables.py:337:        sa.Index("idx_credit_ledger_user_created", "user_id", "created_at"),
backend/app/models/tables.py:338:        sa.Index("idx_credit_ledger_ref", "ref_type", "ref_id"),
backend/app/models/tables.py:339:        sa.Index(
backend/app/models/tables.py:370:    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
backend/app/models/tables.py:373:        sa.Index("idx_usage_records_user_created", "user_id", "created_at"),
backend/app/models/tables.py:398:    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
backend/app/models/tables.py:419:    session_id: Mapped[uuid.UUID] = mapped_column(
backend/app/models/tables.py:429:    created_at: Mapped[datetime] = mapped_column(
backend/app/models/tables.py:437:        sa.UniqueConstraint("session_id", "user_id", name="uq_shared_sessions_session_user"),
backend/app/models/tables.py:438:        sa.Index("idx_shared_sessions_token", "share_token"),
backend/app/models/tables.py:461:    created_at: Mapped[datetime] = mapped_column(
backend/app/models/tables.py:486:    created_at: Mapped[datetime] = mapped_column(
backend/app/models/tables.py:493:        sa.Index("idx_product_events_created", sa.text("created_at DESC")),
backend/app/models/tables.py:494:        sa.Index("idx_product_events_name_created", "event_name", sa.text("created_at DESC")),
backend/app/models/tables.py:495:        sa.Index("idx_product_events_user_created", "user_id", sa.text("created_at DESC")),
backend/app/models/tables.py:523:    created_at: Mapped[datetime] = mapped_column(
backend/app/models/tables.py:533:        sa.Index("idx_user_feedback_created", sa.text("created_at DESC")),
backend/app/models/tables.py:534:        sa.Index("idx_user_feedback_status_created", "status", sa.text("created_at DESC")),
backend/app/models/tables.py:535:        sa.Index("idx_user_feedback_type_created", "type", sa.text("created_at DESC")),
backend/app/models/tables.py:536:        sa.Index("idx_user_feedback_area_created", "area", sa.text("created_at DESC")),
backend/app/models/tables.py:537:        sa.Index("idx_user_feedback_user_created", "user_id", sa.text("created_at DESC")),
backend/app/models/tables.py:541:class DocumentJob(Base):
backend/app/models/tables.py:563:    created_at: Mapped[datetime] = mapped_column(
backend/app/models/tables.py:579:        sa.Index("idx_document_jobs_user_created", "user_id", sa.text("created_at DESC")),
backend/app/models/tables.py:580:        sa.Index("idx_document_jobs_type_status", "job_type", "status"),
backend/app/models/tables.py:597:    created_at: Mapped[datetime] = mapped_column(
backend/app/models/tables.py:607:        sa.Index("idx_extraction_results_template", "template_key"),
backend/app/models/tables.py:623:    created_at: Mapped[datetime] = mapped_column(
backend/app/models/tables.py:633:        sa.Index("idx_question_templates_user_updated", "user_id", sa.text("updated_at DESC")),
backend/app/models/tables.py:637:class DocumentBrief(Base):
backend/app/models/tables.py:662:    created_at: Mapped[datetime] = mapped_column(
backend/app/models/tables.py:672:        sa.Index("idx_document_briefs_document", "document_id"),
backend/app/models/tables.py:676:class DocumentTable(Base):
backend/app/models/tables.py:690:    created_at: Mapped[datetime] = mapped_column(
backend/app/models/tables.py:701:        sa.Index("idx_document_tables_document_page", "document_id", "page"),
backend/app/models/tables.py:705:class DocumentLayoutRun(Base):
backend/app/models/tables.py:721:    created_at: Mapped[datetime] = mapped_column(
backend/app/models/tables.py:732:        sa.Index("idx_document_layout_runs_document_provider", "document_id", "provider", "created_at"),
backend/alembic/versions/20260317_0019_add_shared_sessions.py:23:        sa.Column("session_id", UUID(as_uuid=True), sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False),
backend/alembic/versions/20260317_0019_add_shared_sessions.py:27:        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
backend/alembic/versions/20260317_0019_add_shared_sessions.py:28:        sa.UniqueConstraint("session_id", "user_id", name="uq_shared_sessions_session_user"),
backend/alembic/versions/20260414_0021_add_plan_transitions_audit.py:57:            "created_at",
backend/alembic/versions/20260414_0021_add_plan_transitions_audit.py:66:        ["user_id", sa.text("created_at DESC")],
backend/alembic/versions/20260501_0022_add_product_events.py:46:            "created_at",
backend/alembic/versions/20260501_0022_add_product_events.py:54:    op.create_index("idx_product_events_created", "product_events", [sa.text("created_at DESC")])
backend/alembic/versions/20260501_0022_add_product_events.py:58:        ["event_name", sa.text("created_at DESC")],
backend/alembic/versions/20260501_0022_add_product_events.py:63:        ["user_id", sa.text("created_at DESC")],
backend/alembic/versions/20260524_0031_add_messages_role_created_session_index.py:22:        ["role", "created_at", "session_id"],
backend/alembic/versions/20260204_0001_initial_tables.py:39:        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
backend/alembic/versions/20260204_0001_initial_tables.py:69:        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
backend/alembic/versions/20260204_0001_initial_tables.py:79:        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
backend/alembic/versions/20260204_0001_initial_tables.py:87:        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False),
backend/alembic/versions/20260204_0001_initial_tables.py:93:        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
backend/alembic/versions/20260204_0001_initial_tables.py:95:    op.create_index("idx_messages_session", "messages", ["session_id", "created_at"], unique=False)
backend/alembic/versions/20260507_0026_add_document_briefs.py:32:        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
backend/alembic/versions/20260507_0023_add_document_jobs_extractions.py:29:        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
backend/alembic/versions/20260507_0023_add_document_jobs_extractions.py:40:    op.create_index("idx_document_jobs_user_created", "document_jobs", ["user_id", sa.text("created_at DESC")])
backend/alembic/versions/20260507_0023_add_document_jobs_extractions.py:51:        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
backend/alembic/versions/20260507_0025_add_question_templates.py:23:        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
backend/alembic/versions/20260507_0024_add_document_tables.py:25:        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
backend/alembic/versions/20260509_0029_add_document_elements.py:33:        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
backend/alembic/versions/20260514_0030_add_user_feedback.py:40:        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
backend/alembic/versions/20260514_0030_add_user_feedback.py:46:    op.create_index("idx_user_feedback_created", "user_feedback", [sa.text("created_at DESC")])
backend/alembic/versions/20260514_0030_add_user_feedback.py:50:        ["status", sa.text("created_at DESC")],
backend/alembic/versions/20260514_0030_add_user_feedback.py:55:        ["type", sa.text("created_at DESC")],
backend/alembic/versions/20260514_0030_add_user_feedback.py:60:        ["area", sa.text("created_at DESC")],
backend/alembic/versions/20260514_0030_add_user_feedback.py:65:        ["user_id", sa.text("created_at DESC")],
backend/alembic/versions/20260208_0009_add_collections.py:25:        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
backend/alembic/versions/20260205_0003_add_auth_credits_tables.py:36:        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
backend/alembic/versions/20260205_0003_add_auth_credits_tables.py:77:        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
backend/alembic/versions/20260205_0003_add_auth_credits_tables.py:79:    op.create_index("idx_credit_ledger_user_created", "credit_ledger", ["user_id", "created_at"], unique=False)
backend/alembic/versions/20260205_0003_add_auth_credits_tables.py:93:        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
backend/alembic/versions/20260205_0003_add_auth_credits_tables.py:95:    op.create_index("idx_usage_records_user_created", "usage_records", ["user_id", "created_at"], unique=False)
backend/alembic/versions/20260509_0028_add_document_layout_runs.py:27:        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
backend/alembic/versions/20260509_0028_add_document_layout_runs.py:37:        ["document_id", "provider", "created_at"],

exec
/bin/zsh -lc "nl -ba backend/app/core/rate_limit.py | sed -n '1,370p'; printf '\\nCHAT REMAINDER\\n'; nl -ba backend/app/api/chat.py | sed -n '430,760p'; printf '\\nTABLES\\n'; nl -ba backend/app/models/tables.py | sed -n '1,285p'; printf '\\nSCHEMAS\\n'; nl -ba backend/app/schemas/chat.py | sed -n '1,240p'; printf '\\nEVENTS\\n'; nl -ba backend/app/api/events.py | sed -n '1,180p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	"""Redis-backed rate limiter and demo message tracker with in-memory fallback."""
     2	
     3	from __future__ import annotations
     4	
     5	import hmac
     6	import logging
     7	import time
     8	from collections import defaultdict
     9	from typing import TYPE_CHECKING
    10	
    11	import redis.asyncio as redis
    12	
    13	from app.core.config import settings
    14	from app.core.security_log import log_security_event
    15	
    16	if TYPE_CHECKING:
    17	    from fastapi import Request
    18	
    19	logger = logging.getLogger(__name__)
    20	
    21	_REDIS_RETRY_SECONDS = 30
    22	_DEMO_COUNTER_TTL_SECONDS = 24 * 60 * 60
    23	_SENTRY_ALERT_INTERVAL_SECONDS = 600  # 10 min between Sentry events per namespace
    24	
    25	# Per-namespace throttle for Sentry capture. Log every fallback, but only
    26	# forward to Sentry once every _SENTRY_ALERT_INTERVAL_SECONDS so a prolonged
    27	# outage doesn't burn through Sentry's monthly quota (4 namespaces × 30s
    28	# reconnect cadence would otherwise = ~11k events/day).
    29	_last_sentry_alert_at: dict[str, float] = {}
    30	
    31	
    32	def _alert_redis_fallback(namespace: str, exc: Exception) -> None:
    33	    """Log Redis fallback at error level and send to Sentry if configured.
    34	
    35	    Log volume: one per failed reconnect (~2/min/namespace worst case).
    36	    Sentry volume: one per namespace per _SENTRY_ALERT_INTERVAL_SECONDS.
    37	    In-memory fallback means counts reset on restart and do NOT share state
    38	    across replicas — this is a real correctness alert, not a noisy warning.
    39	    """
    40	    logger.error(
    41	        "Redis unavailable for %s; using in-memory fallback (counts will not persist): %s",
    42	        namespace, exc,
    43	    )
    44	    if not settings.SENTRY_DSN:
    45	        return
    46	    now = time.time()
    47	    last = _last_sentry_alert_at.get(namespace, 0.0)
    48	    if now - last < _SENTRY_ALERT_INTERVAL_SECONDS:
    49	        return
    50	    _last_sentry_alert_at[namespace] = now
    51	    try:
    52	        import sentry_sdk
    53	        with sentry_sdk.push_scope() as scope:
    54	            scope.set_tag("redis_namespace", namespace)
    55	            scope.set_tag("degraded", "redis_fallback")
    56	            sentry_sdk.capture_exception(exc)
    57	    except Exception:
    58	        pass
    59	
    60	
    61	class InMemoryRateLimiter:
    62	    """Token-bucket style in-memory rate limiter keyed by arbitrary string."""
    63	
    64	    def __init__(self, max_requests: int = 10, window_seconds: int = 60):
    65	        self.max_requests = max_requests
    66	        self.window_seconds = window_seconds
    67	        self._buckets: dict[str, list[float]] = defaultdict(list)
    68	
    69	    def is_allowed(self, key: str) -> bool:
    70	        now = time.time()
    71	        if len(self._buckets) > 10000:
    72	            self._buckets = defaultdict(list, {
    73	                k: [t for t in v if now - t < self.window_seconds]
    74	                for k, v in self._buckets.items()
    75	            })
    76	            self._buckets = defaultdict(list, {k: v for k, v in self._buckets.items() if v})
    77	        bucket = self._buckets[key]
    78	        self._buckets[key] = [t for t in bucket if now - t < self.window_seconds]
    79	        if len(self._buckets[key]) >= self.max_requests:
    80	            log_security_event("rate_limit_hit", key=key, max_requests=self.max_requests)
    81	            return False
    82	        self._buckets[key].append(now)
    83	        return True
    84	
    85	
    86	class InMemoryDemoMessageTracker:
    87	    """In-memory fallback tracker for demo message counts."""
    88	
    89	    def __init__(self) -> None:
    90	        self._counts: dict[str, int] = {}
    91	
    92	    def get_count(self, key: str) -> int:
    93	        return self._counts.get(key, 0)
    94	
    95	    def increment(self, key: str) -> None:
    96	        if len(self._counts) > 10_000:
    97	            self._counts.clear()
    98	        self._counts[key] = self._counts.get(key, 0) + 1
    99	
   100	
   101	class _RedisClientMixin:
   102	    def __init__(self, *, namespace: str):
   103	        self._namespace = namespace
   104	        self._redis_url = settings.CELERY_BROKER_URL
   105	        self._redis_client: redis.Redis | None = None
   106	        self._next_retry_at = 0.0
   107	
   108	    async def _get_client(self) -> redis.Redis | None:
   109	        now = time.time()
   110	        if self._redis_client is not None:
   111	            return self._redis_client
   112	        if now < self._next_retry_at:
   113	            return None
   114	        try:
   115	            self._redis_client = redis.from_url(self._redis_url, decode_responses=True)
   116	            await self._redis_client.ping()
   117	            return self._redis_client
   118	        except Exception as e:
   119	            _alert_redis_fallback(self._namespace, e)
   120	            self._next_retry_at = now + _REDIS_RETRY_SECONDS
   121	            if self._redis_client is not None:
   122	                try:
   123	                    await self._redis_client.aclose()
   124	                except Exception:
   125	                    pass
   126	            self._redis_client = None
   127	            return None
   128	
   129	    async def _reset_client(self, error: Exception) -> None:
   130	        _alert_redis_fallback(self._namespace, error)
   131	        self._next_retry_at = time.time() + _REDIS_RETRY_SECONDS
   132	        if self._redis_client is not None:
   133	            try:
   134	                await self._redis_client.aclose()
   135	            except Exception:
   136	                pass
   137	        self._redis_client = None
   138	
   139	
   140	class RedisRateLimiter(_RedisClientMixin):
   141	    """Redis-backed rate limiter using atomic INCR + EXPIRE."""
   142	
   143	    def __init__(self, *, namespace: str, max_requests: int, window_seconds: int):
   144	        super().__init__(namespace=namespace)
   145	        self.max_requests = max_requests
   146	        self.window_seconds = window_seconds
   147	        self._fallback = InMemoryRateLimiter(max_requests=max_requests, window_seconds=window_seconds)
   148	
   149	    async def is_allowed(self, key: str) -> bool:
   150	        client = await self._get_client()
   151	        if client is None:
   152	            return self._fallback.is_allowed(key)
   153	
   154	        redis_key = f"{self._namespace}:{key}"
   155	        try:
   156	            count = await client.incr(redis_key)
   157	            if count == 1:
   158	                await client.expire(redis_key, self.window_seconds)
   159	            if count > self.max_requests:
   160	                log_security_event("rate_limit_hit", key=key, max_requests=self.max_requests)
   161	                return False
   162	            return True
   163	        except Exception as e:
   164	            await self._reset_client(e)
   165	            return self._fallback.is_allowed(key)
   166	
   167	
   168	class RedisDemoTracker(_RedisClientMixin):
   169	    """Redis-backed demo message counter using INCR + EXPIRE."""
   170	
   171	    def __init__(self, *, namespace: str, ttl_seconds: int = _DEMO_COUNTER_TTL_SECONDS):
   172	        super().__init__(namespace=namespace)
   173	        self.ttl_seconds = ttl_seconds
   174	        self._fallback = InMemoryDemoMessageTracker()
   175	
   176	    async def get_count(self, key: str) -> int:
   177	        client = await self._get_client()
   178	        if client is None:
   179	            return self._fallback.get_count(key)
   180	
   181	        redis_key = f"{self._namespace}:{key}"
   182	        try:
   183	            value = await client.get(redis_key)
   184	            return int(value or 0)
   185	        except Exception as e:
   186	            await self._reset_client(e)
   187	            return self._fallback.get_count(key)
   188	
   189	    async def increment(self, key: str) -> None:
   190	        client = await self._get_client()
   191	        if client is None:
   192	            self._fallback.increment(key)
   193	            return
   194	
   195	        redis_key = f"{self._namespace}:{key}"
   196	        try:
   197	            count = await client.incr(redis_key)
   198	            if count == 1:
   199	                await client.expire(redis_key, self.ttl_seconds)
   200	        except Exception as e:
   201	            await self._reset_client(e)
   202	            self._fallback.increment(key)
   203	
   204	    async def check_and_increment(self, key: str, limit: int) -> tuple[bool, int]:
   205	        """Atomically increment counter and check against limit.
   206	
   207	        Returns (allowed, current_count). If over limit, decrements back.
   208	        """
   209	        client = await self._get_client()
   210	        if client is None:
   211	            current = self._fallback.get_count(key)
   212	            if current >= limit:
   213	                return False, current
   214	            self._fallback.increment(key)
   215	            return True, current + 1
   216	
   217	        redis_key = f"{self._namespace}:{key}"
   218	        try:
   219	            count = await client.incr(redis_key)
   220	            if count == 1:
   221	                await client.expire(redis_key, self.ttl_seconds)
   222	            if count > limit:
   223	                await client.decr(redis_key)
   224	                return False, limit
   225	            return True, int(count)
   226	        except Exception as e:
   227	            await self._reset_client(e)
   228	            current = self._fallback.get_count(key)
   229	            if current >= limit:
   230	                return False, current
   231	            self._fallback.increment(key)
   232	            return True, current + 1
   233	
   234	
   235	demo_chat_limiter = RedisRateLimiter(namespace="rate_limit:demo_chat", max_requests=10, window_seconds=60)
   236	auth_chat_limiter = RedisRateLimiter(namespace="rate_limit:auth_chat", max_requests=30, window_seconds=60)
   237	demo_message_tracker = RedisDemoTracker(namespace="rate_limit:demo_messages")
   238	demo_session_create_limiter = RedisRateLimiter(
   239	    namespace="rate_limit:demo_session_create", max_requests=5, window_seconds=300
   240	)
   241	# Public shared-view endpoint — anonymous, unauthenticated. Limit per IP to prevent
   242	# token enumeration and traffic amplification. 60/min is generous for legitimate
   243	# users refreshing but blocks brute-force UUID scanning.
   244	shared_view_limiter = RedisRateLimiter(
   245	    namespace="rate_limit:shared_view", max_requests=60, window_seconds=60
   246	)
   247	# Anonymous read endpoints for demo documents (search, chunk detail). Gated
   248	# behind can_access_document so logged-in traffic bypasses this limiter.
   249	anon_read_limiter = RedisRateLimiter(
   250	    namespace="rate_limit:anon_read", max_requests=120, window_seconds=60
   251	)
   252	public_event_limiter = RedisRateLimiter(
   253	    namespace="rate_limit:public_events", max_requests=30, window_seconds=60
   254	)
   255	
   256	
   257	# Pre-encode signing secrets once at import time. hmac.new() requires bytes,
   258	# and re-encoding per-request is wasteful. Re-read at call time would re-import
   259	# settings, which is unnecessary because the process is restarted on env change.
   260	_ADAPTER_SECRET_BYTES: bytes = (settings.ADAPTER_SECRET or "").encode("utf-8")
   261	
   262	# Max clock skew accepted on the new HMAC contract. 60s covers NTP drift between
   263	# Vercel and Railway while keeping the replay window narrow. The signature is
   264	# bound to a per-request unix timestamp so deterministic-bucket replay (the bug
   265	# Codex caught in R3) is impossible.
   266	_MAX_SIGNED_IP_SKEW_S = 60
   267	
   268	
   269	def verify_signed_ip(
   270	    *,
   271	    ip: str | None,
   272	    ts: str | None,
   273	    sig: str | None,
   274	    now: float | None = None,
   275	    max_skew_s: int = _MAX_SIGNED_IP_SKEW_S,
   276	) -> tuple[bool, str | None]:
   277	    """Verify the triple-header HMAC IP claim emitted by the frontend proxy.
   278	
   279	    Contract:
   280	      X-Proxy-IP:     <ip>
   281	      X-Proxy-IP-Ts:  <unix_seconds>
   282	      X-Proxy-IP-Sig: hex(HMAC-SHA256(ADAPTER_SECRET, "{ip}:{ts}"))
   283	
   284	    Returns (ok, reason). `reason` is a short tag suitable for log fields when
   285	    `ok` is False; on success it is None.
   286	    """
   287	    if not ip or not ts or not sig:
   288	        return False, "missing_headers"
   289	    if not _ADAPTER_SECRET_BYTES:
   290	        return False, "no_adapter_secret"
   291	    try:
   292	        ts_int = int(ts)
   293	    except (TypeError, ValueError):
   294	        return False, "malformed_ts"
   295	    current = now if now is not None else time.time()
   296	    skew = abs(current - ts_int)
   297	    if skew > max_skew_s:
   298	        return False, "skew_exceeded"
   299	    expected = hmac.new(
   300	        _ADAPTER_SECRET_BYTES,
   301	        f"{ip}:{ts_int}".encode("utf-8"),
   302	        digestmod="sha256",
   303	    ).hexdigest()
   304	    if not hmac.compare_digest(expected, sig):
   305	        return False, "bad_signature"
   306	    return True, None
   307	
   308	
   309	def get_client_ip(request: "Request") -> str:
   310	    """Extract real client IP from the trusted Vercel proxy.
   311	
   312	    Contract: triple-header HMAC.
   313	      X-Proxy-IP / X-Proxy-IP-Ts / X-Proxy-IP-Sig signed with ADAPTER_SECRET.
   314	
   315	    Falls back to request.client.host for direct access (dev/testing). Never
   316	    trust raw X-Forwarded-For. (The legacy X-Proxy-IP-Secret/AUTH_SECRET
   317	    dual-accept path was removed 2026-05-24, 24h after the HMAC rollout with
   318	    zero proxy.signed_ip.legacy_path_used — C1 follow-up.)
   319	    """
   320	    # New contract — prefer this when present.
   321	    new_ip = request.headers.get("x-proxy-ip")
   322	    new_ts = request.headers.get("x-proxy-ip-ts")
   323	    new_sig = request.headers.get("x-proxy-ip-sig")
   324	    if new_ip or new_ts or new_sig:
   325	        ok, reason = verify_signed_ip(ip=new_ip, ts=new_ts, sig=new_sig)
   326	        if ok:
   327	            return new_ip.strip()  # type: ignore[union-attr]
   328	        # Compute skew for logging (best-effort; never raise).
   329	        skew_s: float | None = None
   330	        if new_ts:
   331	            try:
   332	                skew_s = abs(time.time() - int(new_ts))
   333	            except (TypeError, ValueError):
   334	                skew_s = None
   335	        logger.warning(
   336	            "proxy.signed_ip.verification_failed",
   337	            extra={
   338	                "reason": reason,
   339	                "claimed_ip": new_ip,
   340	                "skew_s": skew_s,
   341	            },
   342	        )
   343	        # Do NOT trust the claimed IP on failure; fall back to the connection host.
   344	
   345	    return request.client.host if request.client else "unknown"

CHAT REMAINDER
   430	    )
   431	
   432	
   433	@chat_router.post("/sessions/{session_id}/chat/continue")
   434	async def chat_continue(
   435	    session_id: uuid.UUID,
   436	    body: ContinueRequest,
   437	    request: Request,
   438	    user: Optional[User] = Depends(get_current_user_optional),
   439	    db: AsyncSession = Depends(get_db_session),
   440	):
   441	    # Verify session access
   442	    session = await verify_session_access(session_id, user, db)
   443	    if not session:
   444	        raise HTTPException(status_code=404, detail=SESSION_NOT_FOUND_DETAIL)
   445	
   446	    # Block if document is not ready
   447	    if session.document and session.document.status != "ready":
   448	        raise HTTPException(
   449	            status_code=409,
   450	            detail={
   451	                "error": "DOCUMENT_PROCESSING",
   452	                "message": "Document is still being processed",
   453	                "status": session.document.status,
   454	            },
   455	        )
   456	
   457	    # Rate limit (same as chat_stream)
   458	    if user is None:
   459	        client_ip = get_client_ip(request)
   460	        if not await demo_chat_limiter.is_allowed(client_ip):
   461	            log_security_event("demo_rate_limit", ip=client_ip, session_id=session_id)
   462	            raise HTTPException(
   463	                status_code=429,
   464	                detail={
   465	                    "error": "RATE_LIMITED",
   466	                    "message": "Rate limit exceeded",
   467	                    "retry_after": 60,
   468	                },
   469	                headers={"Retry-After": "60"},
   470	            )
   471	    else:
   472	        if not await auth_chat_limiter.is_allowed(str(user.id)):
   473	            raise HTTPException(
   474	                status_code=429,
   475	                detail={
   476	                    "error": "RATE_LIMITED",
   477	                    "message": "Rate limit exceeded",
   478	                    "retry_after": 60,
   479	                },
   480	                headers={"Retry-After": "60"},
   481	            )
   482	
   483	    # Demo message limit (continuations count against it)
   484	    if user is None and session.document and session.document.demo_slug:
   485	        client_ip = get_client_ip(request)
   486	        allowed, _count = await demo_message_tracker.check_and_increment(
   487	            _demo_message_key(client_ip, session.document_id), DEMO_MESSAGE_LIMIT
   488	        )
   489	        if not allowed:
   490	            log_security_event("demo_message_limit", ip=client_ip, document_id=session.document_id)
   491	            raise HTTPException(
   492	                status_code=429,
   493	                detail={
   494	                    "error": "DEMO_MESSAGE_LIMIT_REACHED",
   495	                    "message": "Demo message limit reached",
   496	                    "limit": DEMO_MESSAGE_LIMIT,
   497	                },
   498	            )
   499	
   500	    # Check continuation limit
   501	    msg_id = uuid.UUID(body.message_id) if body.message_id else None
   502	    if msg_id:
   503	        from sqlalchemy import select as sa_select
   504	        msg_row = await db.execute(sa_select(Message).where(Message.id == msg_id))
   505	        msg = msg_row.scalar_one_or_none()
   506	    else:
   507	        msg_row = await db.execute(
   508	            select(Message)
   509	            .where(Message.session_id == session_id, Message.role == "assistant")
   510	            .order_by(Message.created_at.desc())
   511	            .limit(1)
   512	        )
   513	        msg = msg_row.scalar_one_or_none()
   514	
   515	    if not msg:
   516	        raise HTTPException(status_code=404, detail=MESSAGE_NOT_FOUND_DETAIL)
   517	
   518	    if msg.continuation_count >= settings.MAX_CONTINUATIONS_PER_MESSAGE:
   519	        raise HTTPException(
   520	            status_code=400,
   521	            detail={
   522	                "error": "CONTINUATION_LIMIT",
   523	                "message": "Maximum continuations reached",
   524	                "max": settings.MAX_CONTINUATIONS_PER_MESSAGE,
   525	            },
   526	        )
   527	
   528	    # Credit pre-check for authenticated users
   529	    if user is not None:
   530	        from app.services.credit_service import ensure_monthly_credits
   531	        await ensure_monthly_credits(db, user)
   532	        await db.commit()
   533	        effective_mode = body.mode or "balanced"
   534	        await enforce_free_mode_limits(db, user, effective_mode)
   535	        estimated_cost = credit_service.get_estimated_cost(effective_mode)
   536	        balance = await credit_service.get_user_credits(db, user.id)
   537	        if balance < estimated_cost:
   538	            raise HTTPException(
   539	                status_code=402,
   540	                detail={
   541	                    "error": "INSUFFICIENT_CREDITS",
   542	                    "message": "Insufficient credits",
   543	                    "required": estimated_cost,
   544	                    "balance": balance,
   545	                },
   546	            )
   547	
   548	    async def event_generator() -> AsyncGenerator[str, None]:
   549	        async for ev in chat_service.continue_stream(
   550	            session_id, msg_id, db, user=user, locale=body.locale, mode=body.mode
   551	        ):
   552	            line = f"event: {ev['event']}\n"
   553	            payload = json.dumps(ev.get("data", {}), ensure_ascii=False)
   554	            data_line = f"data: {payload}\n\n"
   555	            yield line + data_line
   556	
   557	    return StreamingResponse(
   558	        event_generator(),
   559	        media_type="text/event-stream",
   560	        headers={
   561	            "Cache-Control": "no-cache, no-transform",
   562	            "X-Accel-Buffering": "no",
   563	            "Connection": "keep-alive",
   564	        },
   565	    )
   566	
   567	
   568	@chat_router.get("/documents/{document_id}/sessions", response_model=SessionListResponse)
   569	async def list_sessions(
   570	    document_id: uuid.UUID,
   571	    limit: int = Query(10, ge=1, le=100),
   572	    offset: int = Query(0, ge=0),
   573	    user: Optional[User] = Depends(get_current_user_optional),
   574	    db: AsyncSession = Depends(get_db_session),
   575	):
   576	    # Verify document access
   577	    doc = await verify_document_access(document_id, user, db)
   578	    if not doc:
   579	        raise HTTPException(status_code=404, detail=DOCUMENT_NOT_FOUND_DETAIL)
   580	
   581	    # Demo documents: enforce session ownership
   582	    if doc.demo_slug:
   583	        if user is None:
   584	            # Anonymous users never see previous sessions
   585	            return SessionListResponse(sessions=[])
   586	        # Authenticated users only see their own demo sessions (handled in query below)
   587	
   588	    last_activity = func.coalesce(
   589	        func.max(Message.created_at), ChatSession.created_at
   590	    ).label("last_activity_at")
   591	
   592	    stmt = (
   593	        select(
   594	            ChatSession.id,
   595	            ChatSession.title,
   596	            ChatSession.domain_mode,
   597	            ChatSession.created_at,
   598	            func.count(Message.id).label("message_count"),
   599	            last_activity,
   600	        )
   601	        .outerjoin(Message, Message.session_id == ChatSession.id)
   602	        .where(ChatSession.document_id == document_id)
   603	        .where(ChatSession.user_id == user.id if (doc.demo_slug and user) else True)
   604	        .group_by(ChatSession.id, ChatSession.title, ChatSession.domain_mode, ChatSession.created_at)
   605	        .order_by(desc(last_activity))
   606	        .limit(limit)
   607	        .offset(offset)
   608	    )
   609	    result = await db.execute(stmt)
   610	    rows = result.all()
   611	    sessions = [
   612	        SessionListItem(
   613	            session_id=row.id,
   614	            title=row.title,
   615	            message_count=row.message_count,
   616	            domain_mode=getattr(row, 'domain_mode', None),
   617	            created_at=row.created_at,
   618	            last_activity_at=row.last_activity_at,
   619	        )
   620	        for row in rows
   621	    ]
   622	    return SessionListResponse(sessions=sessions)
   623	
   624	
   625	@chat_router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
   626	async def delete_session(
   627	    session_id: uuid.UUID,
   628	    user: Optional[User] = Depends(get_current_user_optional),
   629	    db: AsyncSession = Depends(get_db_session),
   630	):
   631	    # Verify session access
   632	    session = await verify_session_access(session_id, user, db)
   633	    if not session:
   634	        raise HTTPException(status_code=404, detail=SESSION_NOT_FOUND_DETAIL)
   635	
   636	    await db.delete(session)
   637	    await db.commit()
   638	    return None  # 204

TABLES
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
    33	    # Parse pipeline metadata (R2b) — nullable/add-only. parse_version lets the backfill
    34	    # finder spot docs parsed before a fix; parse_method ∈ {text, ocr, converted};
    35	    # text_quality is the Unicode-aware letter/number ratio; ocr_languages is the resolved
    36	    # Tesseract set, persisted so retries/backfills re-OCR with the right languages.
    37	    parse_version: Mapped[Optional[int]] = mapped_column(sa.Integer, nullable=True)
    38	    parse_method: Mapped[Optional[str]] = mapped_column(sa.String(16), nullable=True)
    39	    text_quality: Mapped[Optional[float]] = mapped_column(sa.Float, nullable=True)
    40	    ocr_languages: Mapped[Optional[str]] = mapped_column(sa.String(64), nullable=True)
    41	
    42	    created_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
    43	    updated_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.func.now())
    44	
    45	    # Optional owner user (nullable; set null on user delete)
    46	    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
    47	        UUID(as_uuid=True),
    48	        sa.ForeignKey("users.id", ondelete="SET NULL"),
    49	        nullable=True,
    50	        index=True,
    51	    )
    52	
    53	    # Auto-generated summary and suggested questions (populated after parsing)
    54	    summary: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
    55	    suggested_questions: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    56	
    57	    # Custom AI instructions per document (user-provided, max 2000 chars)
    58	    custom_instructions: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
    59	
    60	    # File type (pdf, docx, pptx, xlsx, txt, md)
    61	    file_type: Mapped[str] = mapped_column(sa.String(20), nullable=False, server_default=sa.text("'pdf'"))
    62	
    63	    # Storage key for converted PDF (PPTX/DOCX → PDF via LibreOffice)
    64	    converted_storage_key: Mapped[Optional[str]] = mapped_column(sa.String(500), nullable=True)
    65	
    66	    # Source URL for URL-ingested documents
    67	    source_url: Mapped[Optional[str]] = mapped_column(sa.String(2000), nullable=True)
    68	
    69	    # Demo documents have a slug (e.g. "alphabet-earnings"); user docs have None
    70	    demo_slug: Mapped[Optional[str]] = mapped_column(
    71	        sa.String(50), nullable=True, unique=True
    72	    )
    73	
    74	    @property
    75	    def is_demo(self) -> bool:
    76	        return self.demo_slug is not None
    77	
    78	    pages: Mapped[List[Page]] = relationship("Page", back_populates="document", cascade="all, delete-orphan")
    79	    chunks: Mapped[List[Chunk]] = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")
    80	    elements: Mapped[List["DocumentElement"]] = relationship(
    81	        "DocumentElement",
    82	        back_populates="document",
    83	        cascade="all, delete-orphan",
    84	    )
    85	    sessions: Mapped[List[ChatSession]] = relationship(
    86	        "ChatSession", back_populates="document", cascade="all, delete-orphan",
    87	        foreign_keys="ChatSession.document_id",
    88	    )
    89	    collections: Mapped[List["Collection"]] = relationship(
    90	        "Collection",
    91	        secondary="collection_documents",
    92	        back_populates="documents",
    93	    )
    94	    brief: Mapped[Optional["DocumentBrief"]] = relationship(
    95	        "DocumentBrief",
    96	        back_populates="document",
    97	        cascade="all, delete-orphan",
    98	        uselist=False,
    99	    )
   100	
   101	
   102	# Pages table
   103	class Page(Base):
   104	    __tablename__ = "pages"
   105	
   106	    id: Mapped[uuid.UUID] = mapped_column(
   107	        UUID(as_uuid=True),
   108	        primary_key=True,
   109	        server_default=sa.text("gen_random_uuid()"),
   110	    )
   111	    document_id: Mapped[uuid.UUID] = mapped_column(
   112	        UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
   113	    )
   114	    page_number: Mapped[int] = mapped_column(sa.Integer, nullable=False)
   115	    width_pt: Mapped[Optional[float]] = mapped_column(sa.Float, nullable=True)
   116	    height_pt: Mapped[Optional[float]] = mapped_column(sa.Float, nullable=True)
   117	    rotation: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))
   118	    content: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
   119	
   120	    document: Mapped[Document] = relationship("Document", back_populates="pages")
   121	
   122	    __table_args__ = (
   123	        sa.UniqueConstraint("document_id", "page_number", name="uq_pages_document_page"),
   124	        sa.Index("idx_pages_document", "document_id"),
   125	    )
   126	
   127	
   128	# Chunks table
   129	class Chunk(Base):
   130	    __tablename__ = "chunks"
   131	
   132	    id: Mapped[uuid.UUID] = mapped_column(
   133	        UUID(as_uuid=True),
   134	        primary_key=True,
   135	        server_default=sa.text("gen_random_uuid()"),
   136	    )
   137	    document_id: Mapped[uuid.UUID] = mapped_column(
   138	        UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
   139	    )
   140	    chunk_index: Mapped[int] = mapped_column(sa.Integer, nullable=False)
   141	    text: Mapped[str] = mapped_column(sa.Text, nullable=False)
   142	    token_count: Mapped[int] = mapped_column(sa.Integer, nullable=False)
   143	    page_start: Mapped[int] = mapped_column(sa.Integer, nullable=False)
   144	    page_end: Mapped[int] = mapped_column(sa.Integer, nullable=False)
   145	    bboxes: Mapped[dict] = mapped_column(JSONB, nullable=False)
   146	    section_title: Mapped[Optional[str]] = mapped_column(sa.String(500))
   147	    vector_id: Mapped[Optional[str]] = mapped_column(sa.String(100))
   148	    created_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
   149	
   150	    document: Mapped[Document] = relationship("Document", back_populates="chunks")
   151	
   152	    __table_args__ = (
   153	        sa.UniqueConstraint("document_id", "chunk_index", name="uq_chunks_document_index"),
   154	        sa.Index("idx_chunks_document", "document_id"),
   155	    )
   156	
   157	
   158	class DocumentElement(Base):
   159	    __tablename__ = "document_elements"
   160	
   161	    id: Mapped[uuid.UUID] = mapped_column(
   162	        UUID(as_uuid=True),
   163	        primary_key=True,
   164	        server_default=sa.text("gen_random_uuid()"),
   165	    )
   166	    document_id: Mapped[uuid.UUID] = mapped_column(
   167	        UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True
   168	    )
   169	    element_type: Mapped[str] = mapped_column(sa.String(32), nullable=False)
   170	    page_start: Mapped[int] = mapped_column(sa.Integer, nullable=False)
   171	    page_end: Mapped[int] = mapped_column(sa.Integer, nullable=False)
   172	    bbox: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default=sa.text("'{}'::jsonb"))
   173	    text: Mapped[str] = mapped_column(sa.Text, nullable=False)
   174	    reading_order: Mapped[int] = mapped_column(sa.Integer, nullable=False)
   175	    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
   176	        UUID(as_uuid=True), sa.ForeignKey("document_elements.id", ondelete="SET NULL"), nullable=True
   177	    )
   178	    metadata_json: Mapped[dict] = mapped_column(
   179	        JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")
   180	    )
   181	    created_at: Mapped[datetime] = mapped_column(
   182	        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
   183	    )
   184	    updated_at: Mapped[datetime] = mapped_column(
   185	        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()"), onupdate=sa.func.now()
   186	    )
   187	
   188	    document: Mapped["Document"] = relationship("Document", back_populates="elements")
   189	
   190	    __table_args__ = (
   191	        sa.Index("idx_document_elements_doc_type_order", "document_id", "element_type", "reading_order"),
   192	        sa.Index("idx_document_elements_doc_pages", "document_id", "page_start", "page_end"),
   193	    )
   194	
   195	
   196	# Sessions table (use ChatSession to avoid conflict with SQLAlchemy Session)
   197	class ChatSession(Base):
   198	    __tablename__ = "sessions"
   199	
   200	    id: Mapped[uuid.UUID] = mapped_column(
   201	        UUID(as_uuid=True),
   202	        primary_key=True,
   203	        server_default=sa.text("gen_random_uuid()"),
   204	    )
   205	    document_id: Mapped[Optional[uuid.UUID]] = mapped_column(
   206	        UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=True
   207	    )
   208	    collection_id: Mapped[Optional[uuid.UUID]] = mapped_column(
   209	        UUID(as_uuid=True), sa.ForeignKey("collections.id", ondelete="CASCADE"), nullable=True
   210	    )
   211	    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
   212	        UUID(as_uuid=True),
   213	        sa.ForeignKey("users.id", ondelete="SET NULL"),
   214	        nullable=True,
   215	        index=True,
   216	    )
   217	    title: Mapped[Optional[str]] = mapped_column(sa.String(200), nullable=True)
   218	    domain_mode: Mapped[Optional[str]] = mapped_column(sa.String(20), nullable=True)
   219	    created_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
   220	    updated_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.func.now())
   221	
   222	    user: Mapped[Optional["User"]] = relationship("User", foreign_keys=[user_id])
   223	    document: Mapped[Optional[Document]] = relationship("Document", back_populates="sessions", foreign_keys=[document_id])
   224	    collection: Mapped[Optional["Collection"]] = relationship("Collection", back_populates="sessions")
   225	    messages: Mapped[List[Message]] = relationship("Message", back_populates="session", cascade="all, delete-orphan")
   226	
   227	
   228	# Messages table
   229	class Message(Base):
   230	    __tablename__ = "messages"
   231	
   232	    id: Mapped[uuid.UUID] = mapped_column(
   233	        UUID(as_uuid=True),
   234	        primary_key=True,
   235	        server_default=sa.text("gen_random_uuid()"),
   236	    )
   237	    session_id: Mapped[uuid.UUID] = mapped_column(
   238	        UUID(as_uuid=True), sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
   239	    )
   240	    role: Mapped[str] = mapped_column(sa.String(10), nullable=False)
   241	    content: Mapped[str] = mapped_column(sa.Text, nullable=False)
   242	    citations: Mapped[Optional[dict]] = mapped_column(JSONB)
   243	    metadata_json: Mapped[dict] = mapped_column(
   244	        JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")
   245	    )
   246	    prompt_tokens: Mapped[Optional[int]] = mapped_column(sa.Integer)
   247	    output_tokens: Mapped[Optional[int]] = mapped_column(sa.Integer)
   248	    continuation_count: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))
   249	    created_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
   250	
   251	    session: Mapped[ChatSession] = relationship("ChatSession", back_populates="messages")
   252	
   253	    __table_args__ = (
   254	        sa.Index("idx_messages_session", "session_id", "created_at"),
   255	        sa.Index("idx_messages_role_created_session", "role", "created_at", "session_id"),
   256	    )
   257	
   258	
   259	# Users table
   260	class User(Base):
   261	    __tablename__ = "users"
   262	
   263	    id: Mapped[uuid.UUID] = mapped_column(
   264	        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
   265	    )
   266	    email: Mapped[str] = mapped_column(sa.String(255), unique=True, nullable=False, index=True)
   267	    name: Mapped[Optional[str]] = mapped_column(sa.String(255))
   268	    image: Mapped[Optional[str]] = mapped_column(sa.String(500))
   269	    email_verified: Mapped[Optional[datetime]] = mapped_column(sa.DateTime(timezone=True))
   270	    credits_balance: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))
   271	    signup_bonus_granted_at: Mapped[Optional[datetime]] = mapped_column(sa.DateTime(timezone=True))
   272	    plan: Mapped[str] = mapped_column(sa.String(20), nullable=False, server_default=sa.text("'free'"))
   273	    stripe_customer_id: Mapped[Optional[str]] = mapped_column(sa.String(255))
   274	    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(sa.String(255))
   275	    monthly_credits_granted_at: Mapped[Optional[datetime]] = mapped_column(sa.DateTime(timezone=True))
   276	    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
   277	    updated_at: Mapped[datetime] = mapped_column(
   278	        sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.func.now()
   279	    )
   280	
   281	    # Relationships
   282	    accounts: Mapped[List["Account"]] = relationship("Account", back_populates="user", cascade="all, delete-orphan")
   283	
   284	
   285	class Account(Base):

SCHEMAS
     1	from __future__ import annotations
     2	
     3	import uuid
     4	from datetime import datetime
     5	from typing import List, Literal, Optional
     6	
     7	from pydantic import BaseModel, Field
     8	
     9	
    10	class ChatRequest(BaseModel):
    11	    message: str
    12	    mode: Optional[Literal["quick", "balanced", "thorough"]] = None
    13	    domain_mode: Optional[Literal["legal", "academic"]] = None
    14	    locale: Optional[str] = None  # Frontend locale code (en/zh/es/fr/de)
    15	
    16	
    17	class ContinueRequest(BaseModel):
    18	    message_id: Optional[str] = None  # If absent, use most recent assistant message
    19	    mode: Optional[Literal["quick", "balanced", "thorough"]] = None
    20	    locale: Optional[str] = None
    21	
    22	
    23	class ChatMessageResponse(BaseModel):
    24	    id: uuid.UUID
    25	    share_anchor: str
    26	    role: str
    27	    content: str
    28	    citations: Optional[List[dict]] = None
    29	    metadata_json: dict = Field(default_factory=dict)
    30	    created_at: datetime
    31	
    32	    class Config:
    33	        from_attributes = True
    34	
    35	
    36	class SessionResponse(BaseModel):
    37	    session_id: uuid.UUID
    38	    document_id: uuid.UUID
    39	    title: Optional[str] = None
    40	    created_at: datetime
    41	
    42	
    43	class SessionCreateResponse(SessionResponse):
    44	    demo_messages_used: Optional[int] = None
    45	
    46	
    47	class SessionMessagesResponse(BaseModel):
    48	    messages: List[ChatMessageResponse]
    49	
    50	
    51	class SessionListItem(BaseModel):
    52	    session_id: uuid.UUID
    53	    title: Optional[str] = None
    54	    message_count: int
    55	    domain_mode: Optional[str] = None
    56	    created_at: datetime
    57	    last_activity_at: datetime
    58	
    59	
    60	class SessionListResponse(BaseModel):
    61	    sessions: List[SessionListItem]

EVENTS
     1	from __future__ import annotations
     2	
     3	from typing import Any
     4	
     5	from fastapi import APIRouter, Depends, HTTPException, Request, Response
     6	from pydantic import BaseModel, Field
     7	from sqlalchemy.ext.asyncio import AsyncSession
     8	
     9	from app.core.deps import get_current_user_optional, get_db_session
    10	from app.core.rate_limit import get_client_ip, public_event_limiter
    11	from app.models.tables import ProductEvent, User
    12	
    13	router = APIRouter(prefix="/api/events", tags=["events"])
    14	
    15	ALLOWED_EVENTS = {
    16	    "billing_view",
    17	    "upgrade_click",
    18	    "checkout_created",
    19	    "checkout_completed",
    20	    "upgrade_nudge_shown",
    21	    "limit_hit",
    22	    "document_upload_created",
    23	    "url_ingest_created",
    24	    "chat_message_sent",
    25	    "chat_message_completed",
    26	    "citation_clicked",
    27	    "export_clicked",
    28	    "feedback_submitted",
    29	    "paywall_opened",
    30	    "share_created",
    31	    "extraction_created",
    32	    "extraction_completed",
    33	    "extraction_export_clicked",
    34	    "table_scan_created",
    35	    "table_export_clicked",
    36	    "question_template_created",
    37	    "question_template_run_created",
    38	    "question_template_export_clicked",
    39	    "document_diff_created",
    40	    "document_diff_export_clicked",
    41	    "subscription_cancel_requested",
    42	    "refund_requested",
    43	    "landing_cta_clicked",
    44	    "auth_modal_opened",
    45	    "auth_provider_clicked",
    46	    "auth_email_link_requested",
    47	    "auth_email_link_sent",
    48	    "auth_email_link_failed",
    49	    "auth_confirm_viewed",
    50	    "auth_confirm_clicked",
    51	}
    52	
    53	PUBLIC_EVENTS = {
    54	    "landing_cta_clicked",
    55	    "auth_modal_opened",
    56	    "auth_provider_clicked",
    57	    "auth_email_link_requested",
    58	    "auth_email_link_sent",
    59	    "auth_email_link_failed",
    60	    "auth_confirm_viewed",
    61	    "auth_confirm_clicked",
    62	    "upgrade_click",
    63	    "paywall_opened",
    64	    "limit_hit",
    65	}
    66	
    67	
    68	class ProductEventRequest(BaseModel):
    69	    event_name: str = Field(min_length=1, max_length=64)
    70	    properties: dict[str, Any] = Field(default_factory=dict)
    71	
    72	
    73	def _safe_text(value: Any, max_len: int = 64) -> str | None:
    74	    if value is None:
    75	        return None
    76	    text = str(value).strip()
    77	    if not text:
    78	        return None
    79	    return text[:max_len]
    80	
    81	
    82	def _safe_properties(raw: dict[str, Any]) -> dict[str, Any]:
    83	    safe: dict[str, Any] = {}
    84	    for key, value in list(raw.items())[:20]:
    85	        safe_key = _safe_text(key, 64)
    86	        if not safe_key:
    87	            continue
    88	        if isinstance(value, (str, int, float, bool)) or value is None:
    89	            safe[safe_key] = value if not isinstance(value, str) else value[:256]
    90	        else:
    91	            safe[safe_key] = str(value)[:256]
    92	    return safe
    93	
    94	
    95	@router.post("", status_code=204)
    96	async def record_product_event(
    97	    body: ProductEventRequest,
    98	    request: Request,
    99	    user: User | None = Depends(get_current_user_optional),
   100	    db: AsyncSession = Depends(get_db_session),
   101	):
   102	    if body.event_name not in ALLOWED_EVENTS:
   103	        raise HTTPException(status_code=400, detail="Unsupported event")
   104	    if user is None:
   105	        if body.event_name not in PUBLIC_EVENTS:
   106	            raise HTTPException(status_code=401, detail="Authentication required")
   107	        client_ip = get_client_ip(request)
   108	        if not await public_event_limiter.is_allowed(client_ip):
   109	            raise HTTPException(status_code=429, detail="Too many events")
   110	
   111	    properties = _safe_properties(body.properties)
   112	    event = ProductEvent(
   113	        user_id=user.id if user else None,
   114	        event_name=body.event_name,
   115	        source=_safe_text(properties.get("source")),
   116	        reason=_safe_text(properties.get("reason")),
   117	        plan=_safe_text(properties.get("plan"), 16),
   118	        billing=_safe_text(properties.get("period") or properties.get("billing"), 16),
   119	        metadata_json=properties,
   120	    )
   121	    db.add(event)
   122	    await db.commit()
   123	    return Response(status_code=204)

codex
The backend review is now centered on two non-theoretical risk classes the earlier trail did not close: database scalability/atomicity around the rolling cap, and the stale-session cleanup racing a newly resumed chat. I’m tracing both through indexes, foreign keys, and request ordering before assigning severity.
exec
/bin/zsh -lc "printf '%s\\n' 'PROXY IP PRODUCER'; rg -n \"X-Proxy-IP|x-proxy-ip|x-forwarded-for|sign.*ip|ADAPTER_SECRET\" frontend/src/app/api frontend/src/lib frontend/src | head -n 300; printf '%s\\n' 'ALL CHAT/MESSAGE ROUTES'; rg -n \"@chat_router|chat_service\\.chat_stream|Message\\(|session_id.*message|/chat|continue\" backend/app/api backend/app/services | head -n 500; printf '%s\\n' 'SESSIONS MIGRATIONS'; nl -ba backend/alembic/versions/20260204_0001_initial_tables.py | sed -n '55,105p'; rg -n \"sessions.*index|idx_.*session|create_index\\(.*sessions|CREATE INDEX.*sessions\" backend/alembic backend/app -g '*.py'; printf '%s\\n' 'FRONTEND PROXY FILES'; rg --files frontend/src/app/api | sort" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
PROXY IP PRODUCER
frontend/src/lib/auth.ts:14:const ADAPTER_SECRET = process.env.ADAPTER_SECRET;
frontend/src/lib/auth.ts:77:          if (ADAPTER_SECRET) {
frontend/src/lib/auth.ts:83:                  "X-Adapter-Secret": ADAPTER_SECRET,
frontend/src/app/api/csp-report/route.ts:44:  // the browser). Fall back to x-forwarded-for leftmost entry when absent
frontend/src/app/api/csp-report/route.ts:49:  const xff = request.headers.get("x-forwarded-for");
frontend/src/app/api/proxy/[...path]/route.ts:13:// C1: ADAPTER_SECRET is the per-deployment shared secret used to HMAC-sign
frontend/src/app/api/proxy/[...path]/route.ts:14:// the X-Proxy-IP claim sent to the backend. Distinct from AUTH_SECRET (which
frontend/src/app/api/proxy/[...path]/route.ts:16:const ADAPTER_SECRET = process.env.ADAPTER_SECRET;
frontend/src/app/api/proxy/[...path]/route.ts:81:  // On Vercel, both req.ip (Edge) and x-real-ip / x-forwarded-for (Node Serverless)
frontend/src/app/api/proxy/[...path]/route.ts:83:  // trustworthy. req.ip is commonly undefined on Node runtime; x-forwarded-for
frontend/src/app/api/proxy/[...path]/route.ts:85:  const xff = req.headers.get("x-forwarded-for");
frontend/src/app/api/proxy/[...path]/route.ts:91:  if (clientIp && ADAPTER_SECRET) {
frontend/src/app/api/proxy/[...path]/route.ts:95:    // Signing key is ADAPTER_SECRET (NOT AUTH_SECRET — the latter encrypts
frontend/src/app/api/proxy/[...path]/route.ts:98:    const sig = createHmac("sha256", ADAPTER_SECRET)
frontend/src/app/api/proxy/[...path]/route.ts:101:    headers.set("X-Proxy-IP", clientIp);
frontend/src/app/api/proxy/[...path]/route.ts:102:    headers.set("X-Proxy-IP-Ts", ts);
frontend/src/app/api/proxy/[...path]/route.ts:103:    headers.set("X-Proxy-IP-Sig", sig);
frontend/src/app/api/contact/route.ts:67:    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
frontend/src/i18n/locales/es.json:1929:  "comparePdfai.citationsDocTalk": "DocTalk proporciona resaltado de citas en tiempo real que representa un avance significativo. Cada cita en una respuesta de IA es cliqueable. Al hacer clic en ella, el visor de documentos se desplaza hasta el pasaje exacto y aplica un resaltado visual, lo que permite una verificación instantánea. Para documentos PDF, las coordenadas del cuadro delimitador permiten un resaltado con precisión de píxel. Esta característica es el diferenciador principal que hace que DocTalk sea especialmente valioso para la investigación académica, jurídica y profesional. Más información sobre",
frontend/src/i18n/locales/es.json:2078:  "useCasesStudents.challenge.p3": "Los estudiantes de grado se enfrentan a un desafío diferente pero relacionado. A menudo se les asignan capítulos de libros de texto, lecturas complementarias y artículos académicos sobre temas que aún están aprendiendo. Sin una experiencia profunda en el dominio, analizar el lenguaje académico es lento y frustrante. La preparación de exámenes añade presión, ya que exige una comprensión rápida de múltiples capítulos y artículos.",
frontend/src/i18n/locales/es.json:3453:  "useCasesTeachers.challenge.p2": "Una sola clase de 30 estudiantes que entregan ensayos de 5 páginas significa 150 páginas de lectura cuidadosa. Multiplique eso por varias clases y la carga de trabajo se vuelve insostenible. Mientras tanto, mantenerse actualizado con la investigación educativa requiere leer artículos académicos densos.",
frontend/src/i18n/locales/it.json:1929:  "comparePdfai.citationsDocTalk": "DocTalk offre un'evidenziazione delle citazioni in tempo reale che rappresenta un progresso significativo. Ogni citazione in una risposta dell'IA è cliccabile. Cliccandola si scorre il visualizzatore di documenti al passaggio esatto e si applica un'evidenziazione visiva, consentendo una verifica immediata. Per i documenti PDF, le coordinate del riquadro di delimitazione consentono un'evidenziazione precisa al pixel. Questa funzionalità è il principale elemento di differenziazione che rende DocTalk particolarmente prezioso per la ricerca accademica, legale e professionale. Scopri di più su",
frontend/src/i18n/locales/it.json:3453:  "useCasesTeachers.challenge.p2": "Una singola classe di 30 studenti che presenta temi di 5 pagine significa 150 pagine di lettura attenta. Moltiplica per più classi e il carico di lavoro diventa insostenibile. Nel frattempo, mantenersi aggiornati con la ricerca educativa richiede la lettura di densi articoli accademici.",
frontend/src/i18n/locales/en.json:2085:  "useCasesStudents.challenge.p3": "Undergraduate students face a different but related challenge. They are often assigned textbook chapters, supplementary readings, and academic articles on topics they are still learning. Without deep domain expertise, parsing academic language is slow and frustrating. Exam preparation compounds the pressure, requiring rapid comprehension across multiple chapters and papers.",
frontend/src/i18n/locales/en.json:2091:  "useCasesStudents.helps.methodologies.description": "Ask \"What research method did this study use?\" or \"Describe the experimental design.\" DocTalk identifies methodology sections and extracts detailed descriptions, including sample sizes, variables, and statistical approaches.",
frontend/src/i18n/locales/en.json:3108:  "trust.gaps.sso.note": "Individual OAuth (Google, Microsoft) and magic-link email sign-in only. Enterprise SSO is on the roadmap but not shipped.",
frontend/src/i18n/locales/pt.json:893:  "comparePdfai.citationsDocTalk": "O DocTalk oferece destaque de citações em tempo real, o que representa um avanço significativo. Toda citação em uma resposta da IA é clicável. Clicar nela rola o visualizador de documentos até o trecho exato e aplica um destaque visual, permitindo a verificação instantânea. Para documentos PDF, as coordenadas de caixa delimitadora permitem um destaque preciso ao pixel. Esse recurso é o principal diferencial que torna o DocTalk especialmente valioso para pesquisa acadêmica, jurídica e profissional. Saiba mais sobre",
frontend/src/i18n/locales/pt.json:3453:  "useCasesTeachers.challenge.p2": "Uma única turma de 30 alunos submetendo redações de 5 páginas significa 150 páginas de leitura cuidadosa. Multiplique isso por várias turmas, e a carga de trabalho se torna insustentável. Enquanto isso, manter-se atualizado com a pesquisa educacional exige a leitura de artigos acadêmicos densos.",
frontend/src/lib/auth.ts:14:const ADAPTER_SECRET = process.env.ADAPTER_SECRET;
frontend/src/lib/auth.ts:77:          if (ADAPTER_SECRET) {
frontend/src/lib/auth.ts:83:                  "X-Adapter-Secret": ADAPTER_SECRET,
frontend/src/i18n/locales/fr.json:297:  "profile.credits.reason.signup_bonus": "Bonus d'inscription",
frontend/src/i18n/locales/fr.json:522:  "hero.signUpFree": "Inscription gratuite",
frontend/src/i18n/locales/fr.json:1144:  "featuresDemo.compare.signupRequired": "Inscription requise",
frontend/src/i18n/locales/fr.json:3638:  "admin.activity.tile.signups": "Inscriptions",
frontend/src/i18n/locales/fr.json:3643:  "admin.activity.signupFunnel.title": "Entonnoir de cohorte d'inscription",
frontend/src/i18n/locales/fr.json:3644:  "admin.activity.signupFunnel.subtitle": "Cohorte d'inscription de {days} jours, utilisateurs uniques par étape.",
frontend/src/lib/authAdapter.ts:4:const ADAPTER_SECRET = process.env.ADAPTER_SECRET;
frontend/src/lib/authAdapter.ts:44:// Validate ADAPTER_SECRET at startup
frontend/src/lib/authAdapter.ts:45:if (!ADAPTER_SECRET) {
frontend/src/lib/authAdapter.ts:46:  console.error("ADAPTER_SECRET environment variable is required for auth adapter");
frontend/src/lib/authAdapter.ts:50:  if (!ADAPTER_SECRET) {
frontend/src/lib/authAdapter.ts:51:    throw new Error("ADAPTER_SECRET not configured");
frontend/src/lib/authAdapter.ts:58:      "X-Adapter-Secret": ADAPTER_SECRET,
frontend/src/lib/authAdapter.ts:4:const ADAPTER_SECRET = process.env.ADAPTER_SECRET;
frontend/src/lib/authAdapter.ts:44:// Validate ADAPTER_SECRET at startup
frontend/src/lib/authAdapter.ts:45:if (!ADAPTER_SECRET) {
frontend/src/lib/authAdapter.ts:46:  console.error("ADAPTER_SECRET environment variable is required for auth adapter");
frontend/src/lib/authAdapter.ts:50:  if (!ADAPTER_SECRET) {
frontend/src/lib/authAdapter.ts:51:    throw new Error("ADAPTER_SECRET not configured");
frontend/src/lib/authAdapter.ts:58:      "X-Adapter-Secret": ADAPTER_SECRET,
frontend/src/app/shared/[token]/page.tsx:7:// C1: ADAPTER_SECRET signs the X-Proxy-IP claim. Must match the backend's
frontend/src/app/shared/[token]/page.tsx:8:// settings.ADAPTER_SECRET. NOT AUTH_SECRET — AUTH_SECRET stays inside Auth.js.
frontend/src/app/shared/[token]/page.tsx:9:const ADAPTER_SECRET = process.env.ADAPTER_SECRET;
frontend/src/app/shared/[token]/page.tsx:26:  const xff = headersList.get('x-forwarded-for') || '';
frontend/src/app/shared/[token]/page.tsx:34:  if (clientIp && ADAPTER_SECRET) {
frontend/src/app/shared/[token]/page.tsx:36:    const sig = createHmac('sha256', ADAPTER_SECRET)
frontend/src/app/shared/[token]/page.tsx:39:    backendHeaders['X-Proxy-IP'] = clientIp;
frontend/src/app/shared/[token]/page.tsx:40:    backendHeaders['X-Proxy-IP-Ts'] = ts;
frontend/src/app/shared/[token]/page.tsx:41:    backendHeaders['X-Proxy-IP-Sig'] = sig;
frontend/src/app/api/csp-report/route.ts:44:  // the browser). Fall back to x-forwarded-for leftmost entry when absent
frontend/src/app/api/csp-report/route.ts:49:  const xff = request.headers.get("x-forwarded-for");
frontend/src/app/api/proxy/[...path]/route.ts:13:// C1: ADAPTER_SECRET is the per-deployment shared secret used to HMAC-sign
frontend/src/app/api/proxy/[...path]/route.ts:14:// the X-Proxy-IP claim sent to the backend. Distinct from AUTH_SECRET (which
frontend/src/app/api/proxy/[...path]/route.ts:16:const ADAPTER_SECRET = process.env.ADAPTER_SECRET;
frontend/src/app/api/proxy/[...path]/route.ts:81:  // On Vercel, both req.ip (Edge) and x-real-ip / x-forwarded-for (Node Serverless)
frontend/src/app/api/proxy/[...path]/route.ts:83:  // trustworthy. req.ip is commonly undefined on Node runtime; x-forwarded-for
frontend/src/app/api/proxy/[...path]/route.ts:85:  const xff = req.headers.get("x-forwarded-for");
frontend/src/app/api/proxy/[...path]/route.ts:91:  if (clientIp && ADAPTER_SECRET) {
frontend/src/app/api/proxy/[...path]/route.ts:95:    // Signing key is ADAPTER_SECRET (NOT AUTH_SECRET — the latter encrypts
frontend/src/app/api/proxy/[...path]/route.ts:98:    const sig = createHmac("sha256", ADAPTER_SECRET)
frontend/src/app/api/proxy/[...path]/route.ts:101:    headers.set("X-Proxy-IP", clientIp);
frontend/src/app/api/proxy/[...path]/route.ts:102:    headers.set("X-Proxy-IP-Ts", ts);
frontend/src/app/api/proxy/[...path]/route.ts:103:    headers.set("X-Proxy-IP-Sig", sig);
frontend/src/app/api/contact/route.ts:67:    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
ALL CHAT/MESSAGE ROUTES
backend/app/services/document_brief_service.py:200:            continue
backend/app/services/document_brief_service.py:251:            continue
backend/app/services/document_brief_service.py:259:            continue
backend/app/services/document_brief_service.py:262:            continue
backend/app/services/document_brief_service.py:293:            continue
backend/app/services/document_brief_service.py:369:                continue
backend/app/services/document_brief_service.py:372:                continue
backend/app/services/document_brief_service.py:423:                continue
backend/app/services/document_brief_service.py:426:                continue
backend/app/services/document_brief_service.py:512:                    continue
backend/app/services/document_brief_service.py:530:                continue
backend/app/services/document_brief_service.py:532:                continue
backend/app/services/document_brief_service.py:535:                continue
backend/app/services/document_brief_service.py:547:                continue
backend/app/services/document_brief_service.py:585:                continue
backend/app/services/document_brief_service.py:607:                    continue
backend/app/services/document_brief_service.py:622:                    continue
backend/app/services/document_brief_service.py:653:                    continue
backend/app/services/document_brief_service.py:669:                continue
backend/app/services/document_brief_service.py:710:                    continue
backend/app/services/document_brief_service.py:742:                    continue
backend/app/services/document_brief_service.py:860:                    continue
backend/app/services/document_brief_service.py:913:                continue
backend/app/services/document_brief_service.py:917:                continue
backend/app/services/document_brief_service.py:979:                continue
backend/app/services/document_brief_service.py:1090:                continue
backend/app/services/document_brief_service.py:1172:                continue
backend/app/services/document_brief_service.py:1197:                continue
backend/app/services/document_brief_service.py:1200:                continue
backend/app/services/document_brief_service.py:1345:            continue
backend/app/services/document_brief_service.py:1469:            continue
backend/app/services/document_brief_service.py:1508:            continue
backend/app/services/document_brief_service.py:1515:            continue
backend/app/services/document_brief_service.py:1518:            continue
backend/app/services/document_brief_service.py:1557:            continue
backend/app/services/document_brief_service.py:1791:                continue
backend/app/api/tables.py:308:            continue
backend/app/services/question_template_service.py:45:            continue
backend/app/services/question_template_service.py:82:            continue
backend/app/services/question_template_service.py:105:            continue
backend/app/services/question_template_service.py:187:                        continue
backend/app/api/search.py:29:            continue
backend/app/services/claim_verifier_service.py:130:            continue
backend/app/services/claim_verifier_service.py:132:            continue
backend/app/services/claim_verifier_service.py:134:            continue
backend/app/services/claim_verifier_service.py:204:                continue
backend/app/services/claim_verifier_service.py:208:                continue
backend/app/services/claim_verifier_service.py:211:                continue
backend/app/services/demo_seed.py:111:                            continue
backend/app/services/demo_seed.py:116:                        continue
backend/app/services/demo_seed.py:124:                        continue
backend/app/services/demo_seed.py:130:                    continue
backend/app/api/collections.py:153:                continue
backend/app/api/collections.py:254:            continue
backend/app/api/collections.py:256:            continue
backend/app/api/collections.py:260:            continue
backend/app/api/collections.py:269:            continue
backend/app/services/retrieval_service.py:87:            continue
backend/app/services/retrieval_service.py:135:            continue
backend/app/services/retrieval_service.py:171:            continue
backend/app/services/retrieval_service.py:174:            continue
backend/app/services/retrieval_service.py:259:                continue
backend/app/services/retrieval_service.py:276:                continue
backend/app/services/retrieval_service.py:286:                    continue
backend/app/services/retrieval_service.py:369:                continue
backend/app/services/retrieval_service.py:383:                continue
backend/app/api/admin.py:392:                continue
backend/app/api/admin.py:417:                continue
backend/app/api/admin.py:420:                continue
backend/app/api/admin.py:714:            continue
backend/app/api/admin.py:2184:    "continuation": "The answer continued a previous response and reused its existing citations.",
backend/app/api/chat.py:193:@chat_router.post(
backend/app/api/chat.py:279:@chat_router.get("/sessions/{session_id}/messages", response_model=SessionMessagesResponse)
backend/app/api/chat.py:322:@chat_router.post("/sessions/{session_id}/chat")
backend/app/api/chat.py:412:        async for ev in chat_service.chat_stream(
backend/app/api/chat.py:413:            session_id, body.message, db, user=user, locale=body.locale, mode=body.mode,
backend/app/api/chat.py:433:@chat_router.post("/sessions/{session_id}/chat/continue")
backend/app/api/chat.py:434:async def chat_continue(
backend/app/api/chat.py:549:        async for ev in chat_service.continue_stream(
backend/app/api/chat.py:568:@chat_router.get("/documents/{document_id}/sessions", response_model=SessionListResponse)
backend/app/api/chat.py:625:@chat_router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
backend/app/services/extractors/docx_extractor.py:83:                continue
backend/app/services/extractors/docx_extractor.py:90:                continue
backend/app/services/extractors/url_extractor.py:153:                    continue
backend/app/services/extractors/url_extractor.py:268:            continue
backend/app/services/extractors/url_extractor.py:271:            continue
backend/app/services/extractors/url_extractor.py:274:            continue
backend/app/services/extractors/url_extractor.py:329:            continue
backend/app/services/extractors/url_extractor.py:331:            continue
backend/app/api/documents.py:530:                continue
backend/app/api/documents.py:533:                continue
backend/app/api/documents.py:536:                    continue
backend/app/api/documents.py:540:                    continue
backend/app/api/documents.py:542:                    continue
backend/app/api/documents.py:565:            continue
backend/app/api/documents.py:573:                    continue
backend/app/api/documents.py:577:                    continue
backend/app/api/documents.py:582:            continue
backend/app/api/documents.py:730:            continue
backend/app/services/extractors/text_extractor.py:49:                continue
backend/app/api/events.py:87:            continue
backend/app/services/extractors/xlsx_extractor.py:29:            continue
backend/app/api/billing.py:168:    Returns False when pending was cleared and checkout can continue.
backend/app/services/table_service.py:77:            continue
backend/app/services/table_service.py:141:            continue
backend/app/services/table_service.py:174:                continue
backend/app/services/table_service.py:179:                continue
backend/app/services/table_service.py:185:                    continue
backend/app/services/table_service.py:362:def merge_continued_tables(tables: list[dict[str, Any]]) -> list[dict[str, Any]]:
backend/app/services/table_service.py:371:            continue
backend/app/services/table_service.py:452:                continue
backend/app/services/table_service.py:468:                continue
backend/app/services/table_service.py:476:                    continue
backend/app/services/table_service.py:733:    detected = merge_continued_tables(detected)
backend/app/services/summary_service.py:139:            continue
backend/app/services/summary_service.py:143:            continue
backend/app/services/summary_service.py:168:            continue
backend/app/services/summary_service.py:175:            continue
backend/app/services/summary_service.py:207:            continue
backend/app/services/summary_service.py:219:            continue
backend/app/api/sharing.py:186:                    continue
backend/app/services/text_normalizer.py:81:            continue
backend/app/services/text_normalizer.py:84:            continue
backend/app/services/text_normalizer.py:88:            continue
backend/app/services/text_normalizer.py:108:                continue
backend/app/services/text_normalizer.py:112:            continue
backend/app/services/text_normalizer.py:114:            continue
backend/app/services/export_service.py:41:            continue
backend/app/services/export_service.py:44:                continue
backend/app/services/query_router.py:157:            continue
backend/app/services/query_router.py:161:            continue
backend/app/services/document_diff_service.py:60:            continue
backend/app/services/document_diff_service.py:91:            continue
backend/app/services/document_diff_service.py:101:                continue
backend/app/services/document_diff_service.py:225:            continue
backend/app/services/document_diff_service.py:274:            continue
backend/app/services/document_diff_service.py:292:            continue
backend/app/services/document_diff_service.py:310:            continue
backend/app/services/document_diff_service.py:315:                continue
backend/app/services/parse_service.py:164:                    continue
backend/app/services/parse_service.py:167:                    continue
backend/app/services/parse_service.py:192:                    continue
backend/app/services/parse_service.py:302:                        continue
backend/app/services/parse_service.py:305:                        continue
backend/app/services/parse_service.py:363:                            continue
backend/app/services/parse_service.py:366:                            continue
backend/app/services/parse_service.py:384:                    # Skip this page but continue with the rest
backend/app/services/parse_service.py:385:                    continue
backend/app/services/parse_service.py:431:                continue
backend/app/services/parse_service.py:433:                continue
backend/app/services/parse_service.py:480:                continue
backend/app/services/parse_service.py:486:                    continue
backend/app/services/parse_service.py:646:                continue
backend/app/services/parse_service.py:782:                continue
backend/app/services/parse_service.py:785:                continue
backend/app/services/parse_service.py:835:                    continue
backend/app/services/parse_service.py:855:                continue
backend/app/services/parse_service.py:859:                continue
backend/app/services/parse_service.py:881:                continue
backend/app/services/parse_service.py:926:                continue
backend/app/services/parse_service.py:930:                    continue
backend/app/services/parse_service.py:992:                    continue
backend/app/services/rag_evaluator_service.py:111:            continue
backend/app/services/rag_evaluator_service.py:143:            continue
backend/app/services/citation_quote_service.py:68:            continue
backend/app/services/citation_quote_service.py:97:            continue
backend/app/services/citation_quote_service.py:99:            continue
backend/app/services/citation_quote_service.py:101:            continue  # tables / summaries have no clean prose sentence (H8)
backend/app/services/citation_quote_service.py:103:            continue
backend/app/services/citation_quote_service.py:147:            continue
backend/app/services/document_intelligence.py:173:            continue
backend/app/services/document_intelligence.py:197:            continue
backend/app/services/document_intelligence.py:209:                continue
backend/app/services/document_intelligence.py:244:            continue
backend/app/services/query_planner_service.py:90:            continue
backend/app/services/query_planner_service.py:102:            continue
backend/app/services/query_planner_service.py:104:            continue
backend/app/services/query_planner_service.py:124:            continue
backend/app/services/document_element_service.py:144:            continue
backend/app/services/document_element_service.py:174:            continue
backend/app/services/chat_tool_executor.py:130:                en="You have used the free structured extraction allowance. Upgrade to continue creating cited deliverables.",
backend/app/services/chat_service.py:304:            continue
backend/app/services/chat_service.py:306:            continue
backend/app/services/chat_service.py:354:            continue
backend/app/services/chat_service.py:391:            continue
backend/app/services/chat_service.py:631:            continue
backend/app/services/chat_service.py:648:            continue
backend/app/services/chat_service.py:760:        asst_msg = Message(
backend/app/services/chat_service.py:1108:        user_msg = Message(session_id=session_id, role="user", content=user_message)
backend/app/services/chat_service.py:1155:            asst_msg = Message(
backend/app/services/chat_service.py:1177:                    "can_continue": False,
backend/app/services/chat_service.py:1790:                asst_msg = Message(
backend/app/services/chat_service.py:1986:            can_continue = asst_msg.continuation_count < settings.MAX_CONTINUATIONS_PER_MESSAGE
backend/app/services/chat_service.py:1993:                "can_continue": can_continue and finish_reason == "length",
backend/app/services/chat_service.py:2048:    async def continue_stream(
backend/app/services/chat_service.py:2093:        # 2) Load assistant message to continue
backend/app/services/chat_service.py:2174:                        continue
backend/app/services/chat_service.py:2182:                            continue
backend/app/services/chat_service.py:2638:            can_continue = asst_msg.continuation_count < settings.MAX_CONTINUATIONS_PER_MESSAGE
backend/app/services/chat_service.py:2645:                "can_continue": can_continue and finish_reason == "length",
backend/app/services/corrective_retrieval_service.py:39:                continue
backend/app/services/corrective_retrieval_service.py:129:                continue
backend/app/services/extraction_service.py:203:                continue
backend/app/services/extraction_service.py:229:            continue
backend/app/services/extraction_service.py:239:                continue
backend/app/services/extraction_service.py:344:            continue
backend/app/services/extraction_service.py:408:                    continue
SESSIONS MIGRATIONS
    55	
    56	    # chunks
    57	    op.create_table(
    58	        "chunks",
    59	        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
    60	        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
    61	        sa.Column("chunk_index", sa.Integer(), nullable=False),
    62	        sa.Column("text", sa.Text(), nullable=False),
    63	        sa.Column("token_count", sa.Integer(), nullable=False),
    64	        sa.Column("page_start", sa.Integer(), nullable=False),
    65	        sa.Column("page_end", sa.Integer(), nullable=False),
    66	        sa.Column("bboxes", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    67	        sa.Column("section_title", sa.String(length=500), nullable=True),
    68	        sa.Column("vector_id", sa.String(length=100), nullable=True),
    69	        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    70	        sa.UniqueConstraint("document_id", "chunk_index", name="uq_chunks_document_index"),
    71	    )
    72	    op.create_index("idx_chunks_document", "chunks", ["document_id"], unique=False)
    73	
    74	    # sessions
    75	    op.create_table(
    76	        "sessions",
    77	        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
    78	        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
    79	        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    80	        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    81	    )
    82	
    83	    # messages
    84	    op.create_table(
    85	        "messages",
    86	        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
    87	        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False),
    88	        sa.Column("role", sa.String(length=10), nullable=False),
    89	        sa.Column("content", sa.Text(), nullable=False),
    90	        sa.Column("citations", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    91	        sa.Column("prompt_tokens", sa.Integer(), nullable=True),
    92	        sa.Column("output_tokens", sa.Integer(), nullable=True),
    93	        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    94	    )
    95	    op.create_index("idx_messages_session", "messages", ["session_id", "created_at"], unique=False)
    96	
    97	
    98	def downgrade() -> None:
    99	    # Drop in reverse order of dependencies
   100	    op.drop_index("idx_messages_session", table_name="messages")
   101	    op.drop_table("messages")
   102	
   103	    op.drop_table("sessions")
   104	
   105	    op.drop_index("idx_chunks_document", table_name="chunks")
backend/alembic/versions/20260317_0019_add_shared_sessions.py:30:    op.create_index("idx_shared_sessions_token", "shared_sessions", ["share_token"])
backend/alembic/versions/20260317_0019_add_shared_sessions.py:34:    op.drop_index("idx_shared_sessions_token")
backend/alembic/versions/20260316_0018_add_session_user_id.py:31:    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])
backend/alembic/versions/20260204_0001_initial_tables.py:95:    op.create_index("idx_messages_session", "messages", ["session_id", "created_at"], unique=False)
backend/alembic/versions/20260204_0001_initial_tables.py:100:    op.drop_index("idx_messages_session", table_name="messages")
backend/alembic/versions/20260524_0031_add_messages_role_created_session_index.py:20:        "idx_messages_role_created_session",
backend/alembic/versions/20260524_0031_add_messages_role_created_session_index.py:28:    op.drop_index("idx_messages_role_created_session", table_name="messages")
backend/alembic/versions/20260211_0015_add_missing_indexes.py:17:    op.create_index("idx_sessions_document_id", "sessions", ["document_id"])
backend/alembic/versions/20260211_0015_add_missing_indexes.py:18:    op.create_index("idx_sessions_collection_id", "sessions", ["collection_id"])
backend/alembic/versions/20260211_0015_add_missing_indexes.py:24:    op.drop_index("idx_sessions_collection_id", table_name="sessions")
backend/alembic/versions/20260211_0015_add_missing_indexes.py:25:    op.drop_index("idx_sessions_document_id", table_name="sessions")
backend/app/models/tables.py:254:        sa.Index("idx_messages_session", "session_id", "created_at"),
backend/app/models/tables.py:255:        sa.Index("idx_messages_role_created_session", "role", "created_at", "session_id"),
backend/app/models/tables.py:438:        sa.Index("idx_shared_sessions_token", "share_token"),
FRONTEND PROXY FILES
frontend/src/app/api/auth/[...nextauth]/route.ts
frontend/src/app/api/contact/route.ts
frontend/src/app/api/csp-report/route.ts
frontend/src/app/api/indexnow/route.ts
frontend/src/app/api/proxy/[...path]/route.ts
frontend/src/app/api/upload-token/route.ts

exec
/bin/zsh -lc "nl -ba frontend/src/app/api/proxy/\\[...path\\]/route.ts | sed -n '1,210p'; printf '\\nSESSION INDEX MIGRATION\\n'; nl -ba backend/alembic/versions/20260211_0015_add_missing_indexes.py | sed -n '1,80p'; printf '\\nCHAT SERVICE REQUEST INSERT/COMMIT\\n'; nl -ba backend/app/services/chat_service.py | sed -n '1060,1215p'; printf '\\nCONTINUE SERVICE INSERT/COMMIT\\n'; nl -ba backend/app/services/chat_service.py | sed -n '2040,2160p'; nl -ba backend/app/services/chat_service.py | sed -n '2580,2675p'; printf '\\nCHAT ROUTE END/LIST/DELETE\\n'; nl -ba backend/app/api/chat.py | sed -n '500,690p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	import { createHmac } from "node:crypto";
     2	import { getToken } from "next-auth/jwt";
     3	import { SignJWT } from "jose";
     4	import { NextRequest, NextResponse } from "next/server";
     5	
     6	// C2: prefer BACKEND_INTERNAL_URL (Railway private network) over the public
     7	// NEXT_PUBLIC_API_BASE so server-side proxy hops stay on the internal mesh.
     8	const BACKEND_URL =
     9	  process.env.BACKEND_INTERNAL_URL ||
    10	  process.env.NEXT_PUBLIC_API_BASE ||
    11	  "http://localhost:8000";
    12	const AUTH_SECRET = process.env.AUTH_SECRET;
    13	// C1: ADAPTER_SECRET is the per-deployment shared secret used to HMAC-sign
    14	// the X-Proxy-IP claim sent to the backend. Distinct from AUTH_SECRET (which
    15	// Auth.js v5 uses to encrypt session JWEs) — separation of concerns.
    16	const ADAPTER_SECRET = process.env.ADAPTER_SECRET;
    17	
    18	// Whitelist of safe headers to forward to backend
    19	const ALLOWED_REQUEST_HEADERS = new Set([
    20	  "content-type",
    21	  "accept",
    22	  "accept-language",
    23	  "user-agent",
    24	  "cache-control",
    25	  "if-none-match",
    26	  "if-modified-since",
    27	]);
    28	
    29	// Headers to exclude from response (security-sensitive)
    30	const EXCLUDED_RESPONSE_HEADERS = new Set([
    31	  "set-cookie",
    32	  "transfer-encoding",
    33	  "connection",
    34	  // Node fetch may transparently decode upstream responses. Forwarding stale
    35	  // encoding/length metadata can make browsers reject an otherwise 200 body.
    36	  "content-encoding",
    37	  "content-length",
    38	]);
    39	
    40	/**
    41	 * Create a backend-compatible JWT from the decoded Auth.js session token.
    42	 * Auth.js v5 encrypts session tokens (JWE), so we need to create a plain JWT
    43	 * that the backend can verify with the shared AUTH_SECRET.
    44	 */
    45	async function createBackendToken(userId: string): Promise<string> {
    46	  if (!AUTH_SECRET) {
    47	    throw new Error("AUTH_SECRET not configured");
    48	  }
    49	  const secret = new TextEncoder().encode(AUTH_SECRET);
    50	  const now = Math.floor(Date.now() / 1000);
    51	
    52	  return new SignJWT({ sub: userId })
    53	    .setProtectedHeader({ alg: "HS256" })
    54	    .setIssuedAt(now)
    55	    .setExpirationTime(now + 3600) // 1 hour
    56	    .sign(secret);
    57	}
    58	
    59	async function handler(req: NextRequest) {
    60	  // Get decoded token (not raw encrypted token)
    61	  // Must pass secret explicitly for Auth.js v5
    62	  // secureCookie must be true on HTTPS (Vercel) — otherwise getToken looks for
    63	  // "authjs.session-token" instead of "__Secure-authjs.session-token"
    64	  const secureCookie = req.nextUrl.protocol === "https:";
    65	  const token = await getToken({ req, secret: AUTH_SECRET, secureCookie });
    66	
    67	  const path = req.nextUrl.pathname.replace("/api/proxy", "");
    68	  const url = `${BACKEND_URL}${path}${req.nextUrl.search}`;
    69	
    70	  // Build headers with whitelist filtering
    71	  const headers = new Headers();
    72	  req.headers.forEach((value, key) => {
    73	    const lowerKey = key.toLowerCase();
    74	    if (ALLOWED_REQUEST_HEADERS.has(lowerKey)) {
    75	      headers.set(key, value);
    76	    }
    77	  });
    78	
    79	  // Forward the real client IP so backend rate limiting and demo message
    80	  // tracking work correctly (Railway sees Vercel's IP otherwise).
    81	  // On Vercel, both req.ip (Edge) and x-real-ip / x-forwarded-for (Node Serverless)
    82	  // are injected by Vercel itself and strip client-supplied values — they are
    83	  // trustworthy. req.ip is commonly undefined on Node runtime; x-forwarded-for
    84	  // is the authoritative source there.
    85	  const xff = req.headers.get("x-forwarded-for");
    86	  const clientIp =
    87	    req.ip ||
    88	    (xff ? xff.split(",")[0]?.trim() : undefined) ||
    89	    req.headers.get("x-real-ip") ||
    90	    undefined;
    91	  if (clientIp && ADAPTER_SECRET) {
    92	    // C1: triple-header HMAC contract. The signature binds the IP to a
    93	    // per-request unix timestamp so an attacker who scrapes one header set
    94	    // from a log cannot replay it indefinitely. Backend accepts ±60s skew.
    95	    // Signing key is ADAPTER_SECRET (NOT AUTH_SECRET — the latter encrypts
    96	    // session JWEs and must never traverse the wire as a plaintext header).
    97	    const ts = Math.floor(Date.now() / 1000).toString();
    98	    const sig = createHmac("sha256", ADAPTER_SECRET)
    99	      .update(`${clientIp}:${ts}`)
   100	      .digest("hex");
   101	    headers.set("X-Proxy-IP", clientIp);
   102	    headers.set("X-Proxy-IP-Ts", ts);
   103	    headers.set("X-Proxy-IP-Sig", sig);
   104	  }
   105	
   106	  // Add authorization if authenticated - create a backend-compatible JWT
   107	  if (token?.sub) {
   108	    try {
   109	      const backendToken = await createBackendToken(token.sub);
   110	      headers.set("Authorization", `Bearer ${backendToken}`);
   111	    } catch (error) {
   112	      console.error("Failed to create backend token:", error);
   113	    }
   114	  }
   115	
   116	  try {
   117	    // SSE chat endpoints need a longer timeout for streaming responses
   118	    const isChat = /\/sessions\/[^/]+\/chat(\/continue)?$/.test(path);
   119	    const timeout = isChat ? 60000 : 30000;
   120	
   121	    const response = await fetch(url, {
   122	      method: req.method,
   123	      headers,
   124	      body: req.method !== "GET" && req.method !== "HEAD" ? await req.arrayBuffer() : undefined,
   125	      signal: AbortSignal.timeout(timeout),
   126	    });
   127	
   128	    // Build response headers with exclusion filtering
   129	    const responseHeaders = new Headers();
   130	    response.headers.forEach((value, key) => {
   131	      const lowerKey = key.toLowerCase();
   132	      if (!EXCLUDED_RESPONSE_HEADERS.has(lowerKey)) {
   133	        responseHeaders.set(key, value);
   134	      }
   135	    });
   136	
   137	    return new NextResponse(response.body, {
   138	      status: response.status,
   139	      headers: responseHeaders,
   140	    });
   141	  } catch (error) {
   142	    console.error("Proxy request failed:", error);
   143	    if (error instanceof Error && error.name === "TimeoutError") {
   144	      return new NextResponse("Gateway Timeout", { status: 504 });
   145	    }
   146	    return new NextResponse("Bad Gateway", { status: 502 });
   147	  }
   148	}
   149	
   150	// Vercel Hobby max is 60s; needed for SSE chat streaming
   151	export const maxDuration = 60;
   152	
   153	export { handler as GET, handler as POST, handler as PUT, handler as DELETE, handler as PATCH };

SESSION INDEX MIGRATION
     1	"""add missing performance indexes
     2	
     3	Revision ID: 20260211_0015
     4	Revises: 20260211_0014
     5	Create Date: 2026-02-11
     6	"""
     7	
     8	from alembic import op
     9	
    10	revision = "20260211_0015"
    11	down_revision = "20260211_0014"
    12	branch_labels = None
    13	depends_on = None
    14	
    15	
    16	def upgrade() -> None:
    17	    op.create_index("idx_sessions_document_id", "sessions", ["document_id"])
    18	    op.create_index("idx_sessions_collection_id", "sessions", ["collection_id"])
    19	    op.create_index("idx_documents_status", "documents", ["status"])
    20	
    21	
    22	def downgrade() -> None:
    23	    op.drop_index("idx_documents_status", table_name="documents")
    24	    op.drop_index("idx_sessions_collection_id", table_name="sessions")
    25	    op.drop_index("idx_sessions_document_id", table_name="sessions")

CHAT SERVICE REQUEST INSERT/COMMIT
  1060	                else:
  1061	                    events.append(sse("token", {"text": ch}))
  1062	                    self.char_offset += 1
  1063	                    self.recent_claim = (self.recent_claim + ch)[-self._CLAIM_WINDOW:]
  1064	
  1065	            elif self.state == "MAYBE_REF":
  1066	                self.buffer += ch
  1067	                if ch == "]":
  1068	                    inner = self.buffer[1:-1]
  1069	                    if inner.isdigit() and (int(inner) in self.chunk_map):
  1070	                        ref_num = int(inner)
  1071	                        chunk = self.chunk_map[ref_num]
  1072	                        events.append(sse("citation", _citation_payload(ref_num, chunk, self.char_offset, current_claim(self.recent_claim))))
  1073	                    else:
  1074	                        # 非有效引用，回退为普通文本
  1075	                        events.append(sse("token", {"text": self.buffer}))
  1076	                        self.char_offset += len(self.buffer)
  1077	                    self.buffer = ""
  1078	                    self.state = "TEXT"
  1079	                elif len(self.buffer) > 8:
  1080	                    # 超限回退
  1081	                    events.append(sse("token", {"text": self.buffer}))
  1082	                    self.char_offset += len(self.buffer)
  1083	                    self.buffer = ""
  1084	                    self.state = "TEXT"
  1085	        return events
  1086	
  1087	    def flush(self) -> List[Dict[str, Any]]:
  1088	        events: List[Dict[str, Any]] = []
  1089	        if self.buffer:
  1090	            events.append(sse("token", {"text": self.buffer}))
  1091	            self.buffer = ""
  1092	        return events
  1093	
  1094	
  1095	# ---------------------------
  1096	# Chat Service
  1097	# ---------------------------
  1098	
  1099	
  1100	class ChatService:
  1101	    async def _persist_user_message_and_title(
  1102	        self,
  1103	        *,
  1104	        db: AsyncSession,
  1105	        session_id: uuid.UUID,
  1106	        user_message: str,
  1107	    ) -> None:
  1108	        user_msg = Message(session_id=session_id, role="user", content=user_message)
  1109	        db.add(user_msg)
  1110	        await db.commit()
  1111	
  1112	        session = await db.get(ChatSession, session_id)
  1113	        if session and not session.title:
  1114	            clean = user_message.replace("\n", " ").replace("\r", "").strip()
  1115	            session.title = clean[:50]
  1116	            await db.commit()
  1117	
  1118	    async def _tool_action_stream(
  1119	        self,
  1120	        *,
  1121	        session_id: uuid.UUID,
  1122	        user_message: str,
  1123	        db: AsyncSession,
  1124	        user: Optional[User],
  1125	        locale: Optional[str],
  1126	        domain_mode: Optional[str],
  1127	        document_id: uuid.UUID | None,
  1128	        collection_doc_ids: list[uuid.UUID],
  1129	        action_plan: Any,
  1130	    ) -> AsyncGenerator[Dict[str, Any], None]:
  1131	        try:
  1132	            await self._persist_user_message_and_title(
  1133	                db=db,
  1134	                session_id=session_id,
  1135	                user_message=user_message,
  1136	            )
  1137	            if action_plan.user_visible_status:
  1138	                yield sse("tool_status", {"message": action_plan.user_visible_status})
  1139	            execution = await chat_tool_executor.execute(
  1140	                action_plan,
  1141	                user=user,
  1142	                db=db,
  1143	                document_id=document_id,
  1144	                collection_doc_ids=collection_doc_ids,
  1145	                locale=locale,
  1146	                domain_mode=domain_mode,
  1147	            )
  1148	            assistant_text = execution.message
  1149	            artifact_payload = execution.artifact.to_payload() if execution.artifact else None
  1150	            if artifact_payload:
  1151	                yield sse("artifact", artifact_payload)
  1152	            if assistant_text:
  1153	                yield sse("token", {"text": assistant_text})
  1154	
  1155	            asst_msg = Message(
  1156	                session_id=session_id,
  1157	                role="assistant",
  1158	                content=assistant_text,
  1159	                citations=(artifact_payload or {}).get("citations") if artifact_payload else None,
  1160	                metadata_json={
  1161	                    "action_plan": {
  1162	                        "action": action_plan.action.value,
  1163	                        "confidence": action_plan.confidence,
  1164	                        "reason": action_plan.reason,
  1165	                    },
  1166	                    "artifacts": [artifact_payload] if artifact_payload else [],
  1167	                },
  1168	            )
  1169	            db.add(asst_msg)
  1170	            await db.commit()
  1171	            yield sse(
  1172	                "done",
  1173	                {
  1174	                    "message_id": str(asst_msg.id),
  1175	                    "citations_count": 0,
  1176	                    "verification": None,
  1177	                    "can_continue": False,
  1178	                    "continuation_count": asst_msg.continuation_count,
  1179	                    "artifact_count": 1 if artifact_payload else 0,
  1180	                },
  1181	            )
  1182	        except Exception as exc:
  1183	            await db.rollback()
  1184	            yield _safe_sse("error", "CHAT_SETUP_ERROR", exc, session_id=str(session_id))
  1185	
  1186	    async def chat_stream(
  1187	        self,
  1188	        session_id: uuid.UUID,
  1189	        user_message: str,
  1190	        db: AsyncSession,
  1191	        user: Optional[User] = None,
  1192	        locale: Optional[str] = None,
  1193	        mode: Optional[str] = None,
  1194	        domain_mode: Optional[str] = None,
  1195	    ) -> AsyncGenerator[Dict[str, Any], None]:
  1196	        """Main chat streaming generator producing SSE event dicts.
  1197	
  1198	        Steps per spec:
  1199	        1) Load session + document
  1200	        2) Save user message
  1201	        3) Load recent history (last MAX_CHAT_HISTORY_TURNS rounds)
  1202	        4) Retrieval top-5
  1203	        5) Build prompt with numbered chunks
  1204	        6) Stream Anthropic
  1205	        7) Parse with RefParserFSM and yield events; ping every 15s
  1206	        8) Save assistant message + citations
  1207	        9) Yield done
  1208	        """
  1209	
  1210	        # 1) Load session
  1211	        row = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
  1212	        session_obj: Optional[ChatSession] = row.scalar_one_or_none()
  1213	        if not session_obj:
  1214	            yield sse("error", {"code": "SESSION_NOT_FOUND", "message": "会话不存在"})
  1215	            return

CONTINUE SERVICE INSERT/COMMIT
  2040	                        )
  2041	                    settled = True
  2042	                except Exception:
  2043	                    logger.exception(
  2044	                        "Failed to settle pre-debit on cancel/error for user %s",
  2045	                        user.id,
  2046	                    )
  2047	
  2048	    async def continue_stream(
  2049	        self,
  2050	        session_id: uuid.UUID,
  2051	        message_id: Optional[uuid.UUID],
  2052	        db: AsyncSession,
  2053	        user: Optional[User] = None,
  2054	        locale: Optional[str] = None,
  2055	        mode: Optional[str] = None,
  2056	    ) -> AsyncGenerator[Dict[str, Any], None]:
  2057	        """Continue a truncated assistant response, appending to the existing message."""
  2058	
  2059	        # 1) Load session
  2060	        row = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
  2061	        session_obj: Optional[ChatSession] = row.scalar_one_or_none()
  2062	        if not session_obj:
  2063	            yield sse("error", {"code": "SESSION_NOT_FOUND", "message": "Session not found"})
  2064	            return
  2065	
  2066	        document_id = session_obj.document_id
  2067	        collection_id = getattr(session_obj, "collection_id", None)
  2068	        is_collection_session = collection_id is not None and document_id is None
  2069	
  2070	        doc = await db.get(Document, document_id) if document_id else None
  2071	
  2072	        # For collection sessions, load document names
  2073	        collection_doc_names: dict[uuid.UUID, str] = {}
  2074	        collection_doc_types: dict[uuid.UUID, str] = {}
  2075	        collection_doc_pages: dict[uuid.UUID, int] = {}
  2076	        if is_collection_session:
  2077	            from app.models.tables import collection_documents as cd_table
  2078	            cd_rows = await db.execute(
  2079	                select(cd_table.c.document_id).where(cd_table.c.collection_id == collection_id)
  2080	            )
  2081	            collection_doc_ids = [r[0] for r in cd_rows.all()]
  2082	            if collection_doc_ids:
  2083	                doc_rows = await db.execute(
  2084	                    select(Document.id, Document.filename, Document.file_type, Document.page_count)
  2085	                    .where(Document.id.in_(collection_doc_ids))
  2086	                )
  2087	                for drow in doc_rows.all():
  2088	                    collection_doc_names[drow[0]] = drow[1]
  2089	                    collection_doc_types[drow[0]] = drow[2]
  2090	                    if drow[3]:
  2091	                        collection_doc_pages[drow[0]] = drow[3]
  2092	
  2093	        # 2) Load assistant message to continue
  2094	        if message_id:
  2095	            asst_msg = await db.get(Message, message_id)
  2096	        else:
  2097	            # Fall back to most recent assistant message in session
  2098	            result = await db.execute(
  2099	                select(Message)
  2100	                .where(Message.session_id == session_id, Message.role == "assistant")
  2101	                .order_by(Message.created_at.desc())
  2102	                .limit(1)
  2103	            )
  2104	            asst_msg = result.scalar_one_or_none()
  2105	
  2106	        if not asst_msg or asst_msg.role != "assistant":
  2107	            yield sse("error", {"code": "MESSAGE_NOT_FOUND", "message": "Assistant message not found"})
  2108	            return
  2109	
  2110	        if asst_msg.session_id != session_id:
  2111	            yield sse("error", {"code": "MESSAGE_NOT_FOUND", "message": "Message does not belong to this session"})
  2112	            return
  2113	
  2114	        # 3) Check continuation limit
  2115	        if asst_msg.continuation_count >= settings.MAX_CONTINUATIONS_PER_MESSAGE:
  2116	            yield sse("error", {"code": "CONTINUATION_LIMIT", "message": "Maximum continuations reached"})
  2117	            return
  2118	
  2119	        # 4) Resolve mode → model
  2120	        effective_mode = mode if mode in settings.MODE_MODELS else "balanced"
  2121	        effective_model = settings.MODE_MODELS[effective_mode]
  2122	
  2123	        if user is None and doc and doc.demo_slug:
  2124	            effective_model = settings.DEMO_LLM_MODEL
  2125	            effective_mode = "quick"
  2126	
  2127	        if effective_mode in settings.PREMIUM_MODES:
  2128	            user_plan = (user.plan or "free").lower() if user else "free"
  2129	            if user_plan == "free":
  2130	                yield sse(
  2131	                    "error",
  2132	                    {
  2133	                        "code": "MODE_NOT_ALLOWED",
  2134	                        "message": "Upgrade to Plus to use this mode",
  2135	                        "required_plan": "plus",
  2136	                    },
  2137	                )
  2138	                return
  2139	
  2140	        # 5) Pre-debit credits
  2141	        pre_debited = 0
  2142	        predebit_ledger_id = None
  2143	        if user is not None:
  2144	            estimated = credit_service.get_estimated_cost(effective_mode)
  2145	            predebit_ledger_id = await credit_service.debit_credits(
  2146	                db, user_id=user.id, cost=estimated,
  2147	                reason="chat", ref_type="mode", ref_id=effective_mode,
  2148	            )
  2149	            if predebit_ledger_id:
  2150	                pre_debited = estimated
  2151	                await db.commit()
  2152	            else:
  2153	                balance = await credit_service.get_user_credits(db, user.id)
  2154	                yield sse("error", {
  2155	                    "code": "INSUFFICIENT_CREDITS",
  2156	                    "message": "Insufficient credits",
  2157	                    "required": estimated,
  2158	                    "balance": balance,
  2159	                })
  2160	                return
  2580	                asst_msg.output_tokens = base_output_tokens + int(output_tokens or 0)
  2581	                await db.commit()
  2582	            except Exception:
  2583	                await db.rollback()
  2584	                yield sse("error", {"code": "PERSIST_FAILED", "message": "Failed to save continuation"})
  2585	                return
  2586	
  2587	            await _record_rag_verification_event(
  2588	                db,
  2589	                user=user,
  2590	                message_id=getattr(asst_msg, "id", None),
  2591	                verification=verification_payload,
  2592	                retrieval_strategy="continuation",
  2593	                query_route=None,
  2594	                retrieved_count=len(chunk_map),
  2595	                repair_metadata=repair_metadata,
  2596	            )
  2597	
  2598	            # Credits: reconcile
  2599	            if user is not None and pre_debited > 0 and predebit_ledger_id is not None:
  2600	                pt = int(prompt_tokens or 0)
  2601	                ct = int(output_tokens or 0)
  2602	                try:
  2603	                    generation_cost = credit_service.calculate_cost(pt, ct, effective_model, mode=effective_mode)
  2604	                    focus_cost = 0
  2605	                    if (focus_pt or focus_ct) and focus_model_used:
  2606	                        focus_cost = credit_service.calculate_cost(
  2607	                            focus_pt, focus_ct, focus_model_used, mode="quick"
  2608	                        )
  2609	                    actual_cost = generation_cost + focus_cost
  2610	                    await credit_service.reconcile_credits(
  2611	                        db, user.id, predebit_ledger_id, pre_debited, actual_cost,
  2612	                    )
  2613	                    await credit_service.record_usage(
  2614	                        db,
  2615	                        user_id=user.id,
  2616	                        message_id=asst_msg.id,
  2617	                        model=effective_model,
  2618	                        prompt_tokens=pt,
  2619	                        completion_tokens=ct,
  2620	                        cost_credits=generation_cost,
  2621	                    )
  2622	                    if focus_cost:
  2623	                        await credit_service.record_usage(
  2624	                            db,
  2625	                            user_id=user.id,
  2626	                            message_id=asst_msg.id,
  2627	                            model=focus_model_used,
  2628	                            prompt_tokens=focus_pt,
  2629	                            completion_tokens=focus_ct,
  2630	                            cost_credits=focus_cost,
  2631	                        )
  2632	                    await db.commit()
  2633	                    settled = True
  2634	                except Exception as e:
  2635	                    yield _safe_sse("warn", "ACCOUNTING_ERROR", e, session_id=str(session_id))
  2636	
  2637	            # 11) done
  2638	            can_continue = asst_msg.continuation_count < settings.MAX_CONTINUATIONS_PER_MESSAGE
  2639	            done_emitted = True
  2640	            yield sse("done", {
  2641	                "message_id": str(asst_msg.id),
  2642	                "citations_count": len(merged_citations) if merged_citations else 0,
  2643	                "verification": verification_payload,
  2644	                "repair": repair_metadata,
  2645	                "can_continue": can_continue and finish_reason == "length",
  2646	                "continuation_count": asst_msg.continuation_count,
  2647	            })
  2648	        except asyncio.CancelledError:
  2649	            raise
  2650	        finally:
  2651	            continuation_snapshot = "".join(continuation_text_parts)
  2652	            has_partial_answer = bool(continuation_snapshot.strip())
  2653	            if not done_emitted and has_partial_answer and getattr(asst_msg, "id", None) is not None and not persisted:
  2654	                try:
  2655	                    with anyio.CancelScope(shield=True):
  2656	                        await asyncio.wait_for(
  2657	                            _persist_continuation_on_cancel(
  2658	                                message_id=asst_msg.id,
  2659	                                continuation_text=continuation_snapshot,
  2660	                                new_citations=new_citations,
  2661	                                output_tokens=output_tokens,
  2662	                            ),
  2663	                            timeout=_CANCEL_IO_TIMEOUT_S,
  2664	                        )
  2665	                    persisted = True
  2666	                except Exception:
  2667	                    logger.exception(
  2668	                        "Failed to persist continuation partial response on cancel/error for message %s",
  2669	                        getattr(asst_msg, "id", None),
  2670	                    )
  2671	            if (
  2672	                user is not None
  2673	                and pre_debited > 0
  2674	                and predebit_ledger_id is not None
  2675	                and not settled

CHAT ROUTE END/LIST/DELETE
   500	    # Check continuation limit
   501	    msg_id = uuid.UUID(body.message_id) if body.message_id else None
   502	    if msg_id:
   503	        from sqlalchemy import select as sa_select
   504	        msg_row = await db.execute(sa_select(Message).where(Message.id == msg_id))
   505	        msg = msg_row.scalar_one_or_none()
   506	    else:
   507	        msg_row = await db.execute(
   508	            select(Message)
   509	            .where(Message.session_id == session_id, Message.role == "assistant")
   510	            .order_by(Message.created_at.desc())
   511	            .limit(1)
   512	        )
   513	        msg = msg_row.scalar_one_or_none()
   514	
   515	    if not msg:
   516	        raise HTTPException(status_code=404, detail=MESSAGE_NOT_FOUND_DETAIL)
   517	
   518	    if msg.continuation_count >= settings.MAX_CONTINUATIONS_PER_MESSAGE:
   519	        raise HTTPException(
   520	            status_code=400,
   521	            detail={
   522	                "error": "CONTINUATION_LIMIT",
   523	                "message": "Maximum continuations reached",
   524	                "max": settings.MAX_CONTINUATIONS_PER_MESSAGE,
   525	            },
   526	        )
   527	
   528	    # Credit pre-check for authenticated users
   529	    if user is not None:
   530	        from app.services.credit_service import ensure_monthly_credits
   531	        await ensure_monthly_credits(db, user)
   532	        await db.commit()
   533	        effective_mode = body.mode or "balanced"
   534	        await enforce_free_mode_limits(db, user, effective_mode)
   535	        estimated_cost = credit_service.get_estimated_cost(effective_mode)
   536	        balance = await credit_service.get_user_credits(db, user.id)
   537	        if balance < estimated_cost:
   538	            raise HTTPException(
   539	                status_code=402,
   540	                detail={
   541	                    "error": "INSUFFICIENT_CREDITS",
   542	                    "message": "Insufficient credits",
   543	                    "required": estimated_cost,
   544	                    "balance": balance,
   545	                },
   546	            )
   547	
   548	    async def event_generator() -> AsyncGenerator[str, None]:
   549	        async for ev in chat_service.continue_stream(
   550	            session_id, msg_id, db, user=user, locale=body.locale, mode=body.mode
   551	        ):
   552	            line = f"event: {ev['event']}\n"
   553	            payload = json.dumps(ev.get("data", {}), ensure_ascii=False)
   554	            data_line = f"data: {payload}\n\n"
   555	            yield line + data_line
   556	
   557	    return StreamingResponse(
   558	        event_generator(),
   559	        media_type="text/event-stream",
   560	        headers={
   561	            "Cache-Control": "no-cache, no-transform",
   562	            "X-Accel-Buffering": "no",
   563	            "Connection": "keep-alive",
   564	        },
   565	    )
   566	
   567	
   568	@chat_router.get("/documents/{document_id}/sessions", response_model=SessionListResponse)
   569	async def list_sessions(
   570	    document_id: uuid.UUID,
   571	    limit: int = Query(10, ge=1, le=100),
   572	    offset: int = Query(0, ge=0),
   573	    user: Optional[User] = Depends(get_current_user_optional),
   574	    db: AsyncSession = Depends(get_db_session),
   575	):
   576	    # Verify document access
   577	    doc = await verify_document_access(document_id, user, db)
   578	    if not doc:
   579	        raise HTTPException(status_code=404, detail=DOCUMENT_NOT_FOUND_DETAIL)
   580	
   581	    # Demo documents: enforce session ownership
   582	    if doc.demo_slug:
   583	        if user is None:
   584	            # Anonymous users never see previous sessions
   585	            return SessionListResponse(sessions=[])
   586	        # Authenticated users only see their own demo sessions (handled in query below)
   587	
   588	    last_activity = func.coalesce(
   589	        func.max(Message.created_at), ChatSession.created_at
   590	    ).label("last_activity_at")
   591	
   592	    stmt = (
   593	        select(
   594	            ChatSession.id,
   595	            ChatSession.title,
   596	            ChatSession.domain_mode,
   597	            ChatSession.created_at,
   598	            func.count(Message.id).label("message_count"),
   599	            last_activity,
   600	        )
   601	        .outerjoin(Message, Message.session_id == ChatSession.id)
   602	        .where(ChatSession.document_id == document_id)
   603	        .where(ChatSession.user_id == user.id if (doc.demo_slug and user) else True)
   604	        .group_by(ChatSession.id, ChatSession.title, ChatSession.domain_mode, ChatSession.created_at)
   605	        .order_by(desc(last_activity))
   606	        .limit(limit)
   607	        .offset(offset)
   608	    )
   609	    result = await db.execute(stmt)
   610	    rows = result.all()
   611	    sessions = [
   612	        SessionListItem(
   613	            session_id=row.id,
   614	            title=row.title,
   615	            message_count=row.message_count,
   616	            domain_mode=getattr(row, 'domain_mode', None),
   617	            created_at=row.created_at,
   618	            last_activity_at=row.last_activity_at,
   619	        )
   620	        for row in rows
   621	    ]
   622	    return SessionListResponse(sessions=sessions)
   623	
   624	
   625	@chat_router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
   626	async def delete_session(
   627	    session_id: uuid.UUID,
   628	    user: Optional[User] = Depends(get_current_user_optional),
   629	    db: AsyncSession = Depends(get_db_session),
   630	):
   631	    # Verify session access
   632	    session = await verify_session_access(session_id, user, db)
   633	    if not session:
   634	        raise HTTPException(status_code=404, detail=SESSION_NOT_FOUND_DETAIL)
   635	
   636	    await db.delete(session)
   637	    await db.commit()
   638	    return None  # 204

exec
/bin/zsh -lc "nl -ba frontend/src/app/auth/confirm/page.tsx | sed -n '1,170p'; printf '\\nEVENT CALLS\\n'; rg -n \"auth_confirm_(viewed|clicked)|trackEvent\\(\" frontend/src/app/auth frontend/src/lib frontend/src/components | head -n 300; printf '\\nCHAT API CALLS\\n'; rg -n \"getMessages\\(|createSession\\(|listSessions\\(|sendChat|continueChat|/chat/continue|/sessions/.*/chat\" frontend/src backend/app -g '*.{ts,tsx,py}' | head -n 500" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	"use client";
     2	
     3	import { Suspense, useEffect, useMemo, useState } from "react";
     4	import Link from "next/link";
     5	import { useSearchParams } from "next/navigation";
     6	import { useLocale } from "../../../i18n";
     7	import DocTalkLogo from "../../../components/DocTalkLogo";
     8	import { LoadingScreen } from "../../../components/ui/LoadingScreen";
     9	import { trackEvent } from "../../../lib/analytics";
    10	
    11	/**
    12	 * Anti-prefetch interstitial for email magic links.
    13	 *
    14	 * Corporate mail security gateways (Mimecast/Proofpoint class) prefetch links
    15	 * in inbound email. The sign-in email therefore links HERE instead of the raw
    16	 * Auth.js callback URL; the one-time token is only redeemed when a human
    17	 * clicks the button below. A scanner's GET on this page has no side effects,
    18	 * so it no longer consumes the token (dead links) or creates ghost accounts.
    19	 */
    20	
    21	/** Only same-origin Auth.js callback URLs may be continued to — anything else
    22	 * would make this page an open redirect. */
    23	function validateCallback(cb: string | null, origin: string): string | null {
    24	  if (!cb) return null;
    25	  try {
    26	    const parsed = new URL(cb, origin);
    27	    if (parsed.origin !== origin) return null;
    28	    if (!parsed.pathname.startsWith("/api/auth/callback/")) return null;
    29	    return parsed.toString();
    30	  } catch {
    31	    return null;
    32	  }
    33	}
    34	
    35	function ConfirmContent() {
    36	  const searchParams = useSearchParams();
    37	  const { tOr } = useLocale();
    38	  const [origin, setOrigin] = useState<string | null>(null);
    39	  const [continuing, setContinuing] = useState(false);
    40	
    41	  useEffect(() => {
    42	    setOrigin(window.location.origin);
    43	  }, []);
    44	
    45	  const target = useMemo(
    46	    () => (origin ? validateCallback(searchParams.get("cb"), origin) : null),
    47	    [origin, searchParams],
    48	  );
    49	
    50	  useEffect(() => {
    51	    if (origin) {
    52	      trackEvent("auth_confirm_viewed", { valid: target ? 1 : 0 });
    53	    }
    54	  }, [origin, target]);
    55	
    56	  const handleContinue = () => {
    57	    if (!target || continuing) return;
    58	    setContinuing(true);
    59	    trackEvent("auth_confirm_clicked", {});
    60	    window.location.assign(target);
    61	  };
    62	
    63	  if (!origin) return <LoadingScreen />;
    64	
    65	  return (
    66	    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
    67	      <div className="w-full max-w-[440px] rounded-lg border border-zinc-200 bg-white p-7 text-center shadow-[0_1px_3px_0_rgba(0,0,0,0.05),0_1px_2px_0_rgba(0,0,0,0.03)] sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
    68	        <div className="mb-6 flex items-center justify-center gap-2">
    69	          <DocTalkLogo size={26} />
    70	          <span className="font-logo text-lg font-semibold text-zinc-900 dark:text-zinc-50">DocTalk</span>
    71	        </div>
    72	        {target ? (
    73	          <>
    74	            <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
    75	              {tOr("authConfirm.title", "Confirm your sign-in")}
    76	            </h1>
    77	            <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
    78	              {tOr(
    79	                "authConfirm.body",
    80	                "Click the button below to finish signing in to DocTalk. This extra step keeps automated email scanners from using your sign-in link.",
    81	              )}
    82	            </p>
    83	            <button
    84	              type="button"
    85	              onClick={handleContinue}
    86	              disabled={continuing}
    87	              className="w-full rounded-lg bg-blue-700 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-60 dark:focus-visible:ring-offset-zinc-900"
    88	            >
    89	              {continuing
    90	                ? tOr("authConfirm.continuing", "Signing you in…")
    91	                : tOr("authConfirm.cta", "Sign in to DocTalk")}
    92	            </button>
    93	          </>
    94	        ) : (
    95	          <>
    96	            <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
    97	              {tOr("authConfirm.invalidTitle", "This sign-in link is not valid")}
    98	            </h1>
    99	            <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
   100	              {tOr(
   101	                "authConfirm.invalidBody",
   102	                "The link may be incomplete or expired. Request a new sign-in email to continue.",
   103	              )}
   104	            </p>
   105	            <Link
   106	              href="/auth"
   107	              className="inline-block w-full rounded-lg bg-blue-700 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-800"
   108	            >
   109	              {tOr("authConfirm.requestNew", "Request a new link")}
   110	            </Link>
   111	          </>
   112	        )}
   113	      </div>
   114	    </main>
   115	  );
   116	}
   117	
   118	export default function AuthConfirmPage() {
   119	  return (
   120	    <Suspense fallback={<LoadingScreen />}>
   121	      <ConfirmContent />
   122	    </Suspense>
   123	  );
   124	}

EVENT CALLS
frontend/src/app/auth/confirm/page.tsx:52:      trackEvent("auth_confirm_viewed", { valid: target ? 1 : 0 });
frontend/src/app/auth/confirm/page.tsx:59:    trackEvent("auth_confirm_clicked", {});
frontend/src/components/AuthFormContent.tsx:61:    trackEvent("auth_provider_clicked", {
frontend/src/components/AuthFormContent.tsx:73:    trackEvent("auth_email_link_requested", {
frontend/src/components/AuthFormContent.tsx:80:        trackEvent("auth_email_link_failed", {
frontend/src/components/AuthFormContent.tsx:89:      trackEvent("auth_email_link_sent", {
frontend/src/components/AuthFormContent.tsx:96:      trackEvent("auth_email_link_failed", {
frontend/src/components/AuthFormContent.tsx:110:    trackEvent("auth_email_link_requested", {
frontend/src/components/AuthFormContent.tsx:117:        trackEvent("auth_email_link_failed", {
frontend/src/components/AuthFormContent.tsx:123:        trackEvent("auth_email_link_sent", {
frontend/src/components/AuthFormContent.tsx:131:      trackEvent("auth_email_link_failed", {
frontend/src/components/ModeSelector.tsx:23:      trackEvent('upgrade_click', { plan: 'plus', period: 'monthly', source: 'mode_selector', reason: `${modeId}_mode` });
frontend/src/components/PaywallModal.tsx:134:            onClick={() => trackEvent('upgrade_click', { plan: targetPlan, period: 'monthly', source: 'paywall_modal', reason: copy.reason })}
frontend/src/components/Extraction/ExtractionPanel.tsx:204:      trackEvent("extraction_created", {
frontend/src/components/Extraction/ExtractionPanel.tsx:227:      trackEvent("extraction_export_clicked", {
frontend/src/components/Extraction/ExtractionPanel.tsx:245:      trackEvent("table_scan_created", {
frontend/src/components/Extraction/ExtractionPanel.tsx:264:      trackEvent("table_export_clicked", {
frontend/src/components/Extraction/ExtractionPanel.tsx:286:      trackEvent("table_reconstruct_created", {
frontend/src/components/Diff/DocumentDiffPanel.tsx:254:    trackEvent("citation_clicked", {
frontend/src/components/Diff/DocumentDiffPanel.tsx:283:      trackEvent("document_diff_created", {
frontend/src/components/Diff/DocumentDiffPanel.tsx:297:        trackEvent("paywall_opened", {
frontend/src/components/Diff/DocumentDiffPanel.tsx:315:      trackEvent("document_diff_export_clicked", {
frontend/src/components/Collections/CreateCollectionModal.tsx:75:        trackEvent('limit_hit', {
frontend/src/components/Collections/CreateCollectionModal.tsx:208:                onClick={() => trackEvent('upgrade_click', { source: 'create_collection_modal', reason: 'collection_limit' })}
frontend/src/lib/useChatStream.ts:124:      trackEvent('limit_hit', { source: 'chat_stream', reason, plan: upgradePlan, period: 'monthly' });
frontend/src/lib/useChatStream.ts:125:      trackEvent('paywall_opened', { source: 'chat_stream', reason, plan: upgradePlan, period: 'monthly' });
frontend/src/lib/useChatStream.ts:147:      trackEvent('limit_hit', { source: 'chat_stream', reason: code || 'rate_or_demo_limit' });
frontend/src/lib/useChatStream.ts:203:    trackEvent('chat_message_completed', { source: 'chat_stream', mode: selectedMode });
frontend/src/lib/useChatStream.ts:280:    trackEvent('chat_message_sent', { source: 'chat_panel', mode: selectedMode });
frontend/src/lib/analytics.ts:9:export function trackEvent(eventName: string, params: EventParams = {}) {
frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx:145:    trackEvent("citation_clicked", {
frontend/src/components/AuthModal.tsx:59:    trackEvent('auth_modal_opened', { source: 'auth_modal' });
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:191:      trackEvent("question_template_created", {
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:225:      trackEvent("question_template_run_created", {
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:251:      trackEvent("question_template_export_clicked", {
frontend/src/components/PublicHeader.tsx:58:          onClick={() => trackEvent('landing_cta_clicked', { source: 'public_header', reason: 'demo' })}
frontend/src/components/PublicHeader.tsx:65:          onClick={() => trackEvent('landing_cta_clicked', { source: 'public_header', reason: 'sign_up' })}
frontend/src/components/marketing/TrackedCtaLink.tsx:31:      onClick={event ? () => trackEvent(event.name, event.params) : undefined}
frontend/src/components/SessionDropdown.tsx:79:        trackEvent('limit_hit', { source: 'session_dropdown', reason: 'session_limit' });
frontend/src/components/SessionDropdown.tsx:210:                    onClick={() => trackEvent('upgrade_click', { source: 'session_dropdown', reason: 'session_limit' })}
frontend/src/components/landing/FinalCTA.tsx:25:                onClick={() => trackEvent('landing_cta_clicked', { source: 'final_cta', reason: 'demo' })}
frontend/src/components/landing/FinalCTA.tsx:36:                onClick={() => trackEvent('landing_cta_clicked', { source: 'final_cta', reason: 'sign_up' })}
frontend/src/components/landing/HeroSection.tsx:50:                onClick={() => trackEvent('landing_cta_clicked', { source: 'hero', reason: 'demo' })}
frontend/src/components/landing/HeroSection.tsx:61:                onClick={() => trackEvent('landing_cta_clicked', { source: 'hero', reason: 'sign_up' })}
frontend/src/components/Chat/ChatPanel.tsx:316:    trackEvent('upgrade_click', {
frontend/src/components/Chat/ChatPanel.tsx:326:    trackEvent('export_clicked', { source: 'chat_plus_menu', format: 'markdown' });
frontend/src/components/Chat/ChatPanel.tsx:332:    trackEvent('export_clicked', { source: 'chat_plus_menu', format });
frontend/src/components/Chat/ChatPanel.tsx:384:      trackEvent('share_created', { source: 'chat_panel', plan: userPlan || 'unknown' });
frontend/src/components/Chat/ChatPanel.tsx:414:      trackEvent('share_created', { source: 'answer_action', plan: userPlan || 'unknown' });
frontend/src/components/Chat/ChatPanel.tsx:460:    trackEvent('upgrade_click', { source: 'demo_share_attempt' });
frontend/src/components/Chat/ChatPanel.tsx:635:                trackEvent('upgrade_click', {
frontend/src/components/Chat/DomainModeSelector.tsx:33:      trackEvent('upgrade_click', {
frontend/src/components/Chat/MessageBubble.tsx:241:      trackEvent('feedback_submitted', {
frontend/src/components/Profile/CreditsSection.tsx:72:    trackEvent("upgrade_click", { plan: "plus", period: "monthly", source: "profile_credits" });
frontend/src/components/dashboard/DashboardPageClient.tsx:180:    trackEvent('upgrade_nudge_shown', {
frontend/src/components/dashboard/DashboardPageClient.tsx:239:      trackEvent('limit_hit', { source: 'dashboard_upload_precheck', reason: 'file_size', plan: userPlan });
frontend/src/components/dashboard/DashboardPageClient.tsx:249:      trackEvent('document_upload_created', { source: 'dashboard_upload', plan: userPlan });
frontend/src/components/dashboard/DashboardPageClient.tsx:305:        trackEvent('limit_hit', { source: 'dashboard_upload', reason: copy.cta.href.includes('file_size') ? 'file_size' : 'upload_limit', plan: userPlan });
frontend/src/components/dashboard/DashboardPageClient.tsx:338:      trackEvent('url_ingest_created', { source: 'dashboard_url', plan: userPlan });
frontend/src/components/dashboard/DashboardPageClient.tsx:348:        trackEvent('limit_hit', { source: 'dashboard_url', reason: copy.cta.href.includes('file_size') ? 'file_size' : 'url_limit', plan: userPlan });
frontend/src/components/dashboard/DashboardPageClient.tsx:410:	                    onClick={() => trackEvent('upgrade_click', {
frontend/src/components/dashboard/DashboardPageClient.tsx:462:                    onClick={() => trackEvent('upgrade_click', { source: 'upload_error', reason: 'upload_limit' })}
frontend/src/components/dashboard/DashboardPageClient.tsx:501:                  onClick={() => trackEvent('upgrade_click', { source: 'url_error', reason: 'url_limit' })}

CHAT API CALLS
frontend/src/lib/useChatSession.ts:43:          const msgsData = await getMessages(storedDemoSession);
frontend/src/lib/useChatSession.ts:83:        const sessionsData = await listSessions(documentId);
frontend/src/lib/useChatSession.ts:90:          const msgsData = await getMessages(latest.session_id);
frontend/src/lib/useChatSession.ts:100:          const s = await createSession(documentId);
frontend/src/lib/sse.ts:174:  const res = await fetch(`${PROXY_BASE}/api/sessions/${sessionId}/chat`, {
frontend/src/lib/sse.ts:228:  const res = await fetch(`${PROXY_BASE}/api/sessions/${sessionId}/chat/continue`, {
frontend/src/lib/api.ts:159:export async function createSession(docId: string): Promise<{ session_id: string; document_id: string; title: string | null; created_at: string; demo_messages_used?: number }>
frontend/src/lib/api.ts:167:export async function getMessages(sessionId: string): Promise<{ messages: Message[]; demo_messages_used?: number | null }> {
frontend/src/lib/api.ts:272:export async function listSessions(docId: string): Promise<SessionListResponse> {
backend/app/api/chat.py:322:@chat_router.post("/sessions/{session_id}/chat")
backend/app/api/chat.py:433:@chat_router.post("/sessions/{session_id}/chat/continue")
frontend/src/components/SessionDropdown.tsx:62:      const s = await createSession(documentId);
frontend/src/components/SessionDropdown.tsx:89:    const msgs = await getMessages(id);
frontend/src/app/collections/[collectionId]/page.tsx:96:          const msgsData = await getMessages(latest.session_id);
frontend/src/app/collections/[collectionId]/page.tsx:130:      const msgsData = await getMessages(sid);

exec
/bin/zsh -lc "nl -ba frontend/src/lib/auth-modal.ts | sed -n '1,180p'; printf '\\nAUTH MODAL\\n'; nl -ba frontend/src/components/AuthModal.tsx | sed -n '1,210p'; printf '\\nAUTH CONFIG/CALLBACKS\\n'; rg -n \"callbacks:|redirect\\(|callbackUrl|signIn\\(\" frontend/src/lib/auth.ts frontend/src/components/AuthFormContent.tsx frontend/src/components/AuthModal.tsx frontend/src -g '*.{ts,tsx}' | head -n 400; printf '\\nURL PARSING CASES\\n'; node -e 'const o=\"https://www.doctalk.site\"; for (const x of [\"/\",\"//evil.com\",\"https://evil.com\",\"javascript:alert(1)\",\"@evil.com/path\",\"\\\\\\\\evil.com/path\",\"/%2f%2fevil.com\"]) { const s=o+x; try {const u=new URL(s); console.log(JSON.stringify({x,s,origin:u.origin,href:u.href}))} catch(e){console.log(JSON.stringify({x,s,error:e.message}))}}' " in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	export const AUTH_MODAL_HASH = '#auth';
     2	
     3	export function isAuthModalHash(hash: string): boolean {
     4	  return hash === AUTH_MODAL_HASH;
     5	}
     6	
     7	let callbackOverride: string | null = null;
     8	
     9	export function openAuthModal(options?: { callbackUrl?: string }): void {
    10	  if (typeof window === 'undefined') return;
    11	  callbackOverride = options?.callbackUrl ?? null;
    12	  if (window.location.hash === AUTH_MODAL_HASH) return;
    13	  window.location.hash = AUTH_MODAL_HASH.slice(1);
    14	}
    15	
    16	/** Read (without clearing) the override set by the most recent openAuthModal call.
    17	 *  Cleared when the modal closes so a later hash-open falls back to current-URL. */
    18	export function peekAuthCallbackOverride(): string | null {
    19	  return callbackOverride;
    20	}
    21	
    22	export function clearAuthCallbackOverride(): void {
    23	  callbackOverride = null;
    24	}
    25	
    26	export function getUrlWithoutAuthHash(url: URL): string {
    27	  return `${url.pathname}${url.search}`;
    28	}

AUTH MODAL
     1	"use client";
     2	
     3	import { useEffect, useRef, useState } from 'react';
     4	import { usePathname, useRouter, useSearchParams } from 'next/navigation';
     5	import { X } from 'lucide-react';
     6	import { useLocale } from '../i18n';
     7	import { AuthFormContent } from './AuthFormContent';
     8	import { AUTH_MODAL_HASH, clearAuthCallbackOverride, getUrlWithoutAuthHash, isAuthModalHash, peekAuthCallbackOverride } from '../lib/auth-modal';
     9	import { trackEvent } from '../lib/analytics';
    10	
    11	export function AuthModal() {
    12	  const router = useRouter();
    13	  const pathname = usePathname();
    14	  const searchParams = useSearchParams();
    15	  const { t } = useLocale();
    16	  const modalRef = useRef<HTMLDivElement>(null);
    17	  const [isOpen, setIsOpen] = useState(false);
    18	
    19	  useEffect(() => {
    20	    const syncFromHash = () => setIsOpen(isAuthModalHash(window.location.hash));
    21	    syncFromHash();
    22	    window.addEventListener('hashchange', syncFromHash);
    23	    return () => window.removeEventListener('hashchange', syncFromHash);
    24	  }, []);
    25	
    26	  useEffect(() => {
    27	    if (searchParams.get('auth') !== '1') return;
    28	    const currentSearch = new URLSearchParams(searchParams.toString());
    29	    currentSearch.delete('auth');
    30	    const nextUrl = `${pathname}${currentSearch.size ? `?${currentSearch.toString()}` : ''}${AUTH_MODAL_HASH}`;
    31	    router.replace(nextUrl, { scroll: false });
    32	    setIsOpen(true);
    33	  }, [pathname, router, searchParams]);
    34	
    35	  const handleClose = () => {
    36	    const url = new URL(window.location.href);
    37	    url.hash = '';
    38	    router.replace(getUrlWithoutAuthHash(url), { scroll: false });
    39	    setIsOpen(false);
    40	  };
    41	
    42	  // Clear the override on every open→closed transition, not just `handleClose`
    43	  // — `isOpen` can also flip to false via the `hashchange`/`syncFromHash` path
    44	  // (e.g. a mobile back-gesture navigating off `#auth`), which bypasses
    45	  // `handleClose` entirely. Without this, a stale override could reapply on a
    46	  // later hash-only reopen. `wasOpenRef` skips the initial (never-opened)
    47	  // mount so a legitimate override set just before the modal opens isn't
    48	  // wiped before `isOpen` catches up.
    49	  const wasOpenRef = useRef(false);
    50	  useEffect(() => {
    51	    if (wasOpenRef.current && !isOpen) {
    52	      clearAuthCallbackOverride();
    53	    }
    54	    wasOpenRef.current = isOpen;
    55	  }, [isOpen]);
    56	
    57	  useEffect(() => {
    58	    if (!isOpen) return;
    59	    trackEvent('auth_modal_opened', { source: 'auth_modal' });
    60	    const previouslyFocused = document.activeElement as HTMLElement;
    61	    const modal = modalRef.current;
    62	    if (!modal) return;
    63	
    64	    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    65	    const focusables = modal.querySelectorAll<HTMLElement>(focusableSelector);
    66	    const first = focusables[0];
    67	
    68	    first?.focus();
    69	
    70	    function handleKeyDown(e: KeyboardEvent) {
    71	      if (e.key !== 'Tab') return;
    72	      const currentFocusables = modal!.querySelectorAll<HTMLElement>(focusableSelector);
    73	      const currentFirst = currentFocusables[0];
    74	      const currentLast = currentFocusables[currentFocusables.length - 1];
    75	      if (e.shiftKey) {
    76	        if (document.activeElement === currentFirst) {
    77	          e.preventDefault();
    78	          currentLast?.focus();
    79	        }
    80	      } else {
    81	        if (document.activeElement === currentLast) {
    82	          e.preventDefault();
    83	          currentFirst?.focus();
    84	        }
    85	      }
    86	    }
    87	
    88	    modal.addEventListener('keydown', handleKeyDown);
    89	    return () => {
    90	      modal.removeEventListener('keydown', handleKeyDown);
    91	      previouslyFocused?.focus();
    92	    };
    93	  }, [isOpen]);
    94	
    95	  if (!isOpen) return null;
    96	
    97	  const callbackUrl = (() => {
    98	    const override = peekAuthCallbackOverride();
    99	    if (override) return `${window.location.origin}${override}`;
   100	    const currentSearch = searchParams.toString();
   101	    return `${window.location.origin}${pathname}${currentSearch ? `?${currentSearch}` : ''}`;
   102	  })();
   103	
   104	  return (
   105	    <div
   106	      ref={modalRef}
   107	      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in motion-reduce:animate-none"
   108	      onClick={handleClose}
   109	      role="dialog"
   110	      aria-modal="true"
   111	      aria-labelledby="auth-modal-title"
   112	      tabIndex={-1}
   113	      onKeyDown={(e) => e.key === 'Escape' && handleClose()}
   114	    >
   115	      <div
   116	        className="bg-white dark:bg-zinc-900 rounded-xl p-8 w-full max-w-md mx-4 shadow-xl border border-zinc-200 dark:border-zinc-800 animate-slide-up motion-reduce:animate-none"
   117	        onClick={(e) => e.stopPropagation()}
   118	      >
   119	        <div className="flex justify-between items-center mb-6">
   120	          <h2 id="auth-modal-title" className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
   121	            {t('auth.loginToContinue')}
   122	          </h2>
   123	          <button
   124	            onClick={handleClose}
   125	            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400"
   126	            aria-label={t('common.close')}
   127	          >
   128	            <X size={20} className="text-zinc-400" />
   129	          </button>
   130	        </div>
   131	
   132	        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
   133	          {t('auth.loginBenefits')}
   134	        </p>
   135	
   136	        <AuthFormContent callbackUrl={callbackUrl} surface="modal" />
   137	      </div>
   138	    </div>
   139	  );
   140	}

AUTH CONFIG/CALLBACKS
frontend/src/components/AuthModal.tsx:97:  const callbackUrl = (() => {
frontend/src/components/AuthModal.tsx:136:        <AuthFormContent callbackUrl={callbackUrl} surface="modal" />
frontend/src/components/AuthFormContent.tsx:9:  callbackUrl: string;
frontend/src/components/AuthFormContent.tsx:13:export function AuthFormContent({ callbackUrl, surface = "page" }: AuthFormContentProps) {
frontend/src/components/AuthFormContent.tsx:65:    void signIn(provider, { callbackUrl });
frontend/src/components/AuthFormContent.tsx:78:      const result = await signIn("resend", { email: email.trim(), callbackUrl, redirect: false });
frontend/src/components/AuthFormContent.tsx:115:      const result = await signIn("resend", { email: sentEmail, callbackUrl, redirect: false });
frontend/src/lib/auth.ts:54:        const callbackUrl = new URL(url);
frontend/src/lib/auth.ts:55:        const { host } = callbackUrl;
frontend/src/lib/auth.ts:62:        const confirmUrl = new URL("/auth/confirm", callbackUrl.origin);
frontend/src/lib/auth.ts:137:  callbacks: {
frontend/src/lib/auth.ts:54:        const callbackUrl = new URL(url);
frontend/src/lib/auth.ts:55:        const { host } = callbackUrl;
frontend/src/lib/auth.ts:62:        const confirmUrl = new URL("/auth/confirm", callbackUrl.origin);
frontend/src/lib/auth.ts:137:  callbacks: {
frontend/src/lib/auth-modal.ts:9:export function openAuthModal(options?: { callbackUrl?: string }): void {
frontend/src/lib/auth-modal.ts:11:  callbackOverride = options?.callbackUrl ?? null;
frontend/src/lib/billingLinks.ts:24:  return `/auth?callbackUrl=${encodeURIComponent(path)}`;
frontend/src/components/AuthFormContent.tsx:9:  callbackUrl: string;
frontend/src/components/AuthFormContent.tsx:13:export function AuthFormContent({ callbackUrl, surface = "page" }: AuthFormContentProps) {
frontend/src/components/AuthFormContent.tsx:65:    void signIn(provider, { callbackUrl });
frontend/src/components/AuthFormContent.tsx:78:      const result = await signIn("resend", { email: email.trim(), callbackUrl, redirect: false });
frontend/src/components/AuthFormContent.tsx:115:      const result = await signIn("resend", { email: sentEmail, callbackUrl, redirect: false });
frontend/src/app/auth/page.tsx:13:  const callbackUrl = searchParams.get("callbackUrl") || "/";
frontend/src/app/auth/page.tsx:16:    callbackUrl.includes("/d/") ||
frontend/src/app/auth/page.tsx:17:    callbackUrl.includes("/collections") ||
frontend/src/app/auth/page.tsx:18:    callbackUrl.includes("/document-diff");
frontend/src/app/auth/page.tsx:46:          <AuthFormContent callbackUrl={callbackUrl} />
frontend/src/app/admin/AdminPageClient.tsx:98:    if (status === "unauthenticated") router.push("/auth?callbackUrl=/admin");
frontend/src/app/profile/ProfilePageClient.tsx:42:      router.push("/auth?callbackUrl=/profile");
frontend/src/app/collections/CollectionsPageClient.tsx:35:      router.push('/auth?callbackUrl=/collections');
frontend/src/app/collections/[collectionId]/page.tsx:240:    router.push('/auth?callbackUrl=/collections');
frontend/src/components/AuthModal.tsx:97:  const callbackUrl = (() => {
frontend/src/components/AuthModal.tsx:136:        <AuthFormContent callbackUrl={callbackUrl} surface="modal" />
frontend/src/app/document-diff/page.tsx:22:      router.push("/auth?callbackUrl=/document-diff");
frontend/src/components/UserMenu.tsx:89:        onClick={() => signIn()}
frontend/src/components/Profile/AccountActionsSection.tsx:88:      await signOut({ callbackUrl: "/" });
frontend/src/components/Chat/ChatPanel.tsx:322:    openAuthModal({ callbackUrl: '/' });

URL PARSING CASES
{"x":"/","s":"https://www.doctalk.site/","origin":"https://www.doctalk.site","href":"https://www.doctalk.site/"}
{"x":"//evil.com","s":"https://www.doctalk.site//evil.com","origin":"https://www.doctalk.site","href":"https://www.doctalk.site//evil.com"}
{"x":"https://evil.com","s":"https://www.doctalk.sitehttps://evil.com","origin":"https://www.doctalk.sitehttps","href":"https://www.doctalk.sitehttps//evil.com"}
{"x":"javascript:alert(1)","s":"https://www.doctalk.sitejavascript:alert(1)","error":"Invalid URL"}
{"x":"@evil.com/path","s":"https://www.doctalk.site@evil.com/path","origin":"https://evil.com","href":"https://www.doctalk.site@evil.com/path"}
{"x":"\\\\evil.com/path","s":"https://www.doctalk.site\\\\evil.com/path","origin":"https://www.doctalk.site","href":"https://www.doctalk.site//evil.com/path"}
{"x":"/%2f%2fevil.com","s":"https://www.doctalk.site/%2f%2fevil.com","origin":"https://www.doctalk.site","href":"https://www.doctalk.site/%2f%2fevil.com"}

exec
/bin/zsh -lc "nl -ba frontend/src/lib/auth.ts | sed -n '1,230p'; printf '\\nAUTH.JS DEFAULT REDIRECT\\n'; rg -n \"async redirect|redirect\\(\\{ url, baseUrl|url\\.startsWith\\(\\\"/\\\"\\)|new URL\\(url\\)\\.origin\" frontend/node_modules/@auth frontend/node_modules/next-auth 2>/dev/null | head -n 100" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	import NextAuth from "next-auth";
     2	import type { Provider } from "next-auth/providers";
     3	import Google from "next-auth/providers/google";
     4	import MicrosoftEntraId from "next-auth/providers/microsoft-entra-id";
     5	import Resend from "next-auth/providers/resend";
     6	import { cookies } from "next/headers";
     7	import { FastAPIAdapter } from "./authAdapter";
     8	import { buildSignInEmail } from "./emailTemplate";
     9	
    10	const BACKEND_URL =
    11	  process.env.BACKEND_INTERNAL_URL ||
    12	  process.env.NEXT_PUBLIC_API_BASE ||
    13	  "http://localhost:8000";
    14	const ADAPTER_SECRET = process.env.ADAPTER_SECRET;
    15	
    16	// Validate required environment variables at build time
    17	if (!process.env.AUTH_SECRET) {
    18	  console.error("AUTH_SECRET environment variable is required");
    19	}
    20	
    21	// Build providers list dynamically — skip providers with missing env vars
    22	const providers: Provider[] = [];
    23	
    24	if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    25	  providers.push(Google({
    26	    clientId: process.env.GOOGLE_CLIENT_ID as string,
    27	    clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    28	    allowDangerousEmailAccountLinking: true,
    29	  }));
    30	} else {
    31	  console.warn("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET not set — Google provider disabled");
    32	}
    33	
    34	if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
    35	  providers.push(
    36	    MicrosoftEntraId({
    37	      clientId: process.env.MICROSOFT_CLIENT_ID,
    38	      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    39	      allowDangerousEmailAccountLinking: true,
    40	    })
    41	  );
    42	}
    43	
    44	if (process.env.RESEND_API_KEY) {
    45	  const resendApiKey = process.env.RESEND_API_KEY;
    46	  const fromAddress =
    47	    process.env.EMAIL_FROM || "DocTalk <auth@doctalk.site>";
    48	
    49	  providers.push(
    50	    Resend({
    51	      apiKey: resendApiKey,
    52	      from: fromAddress,
    53	      async sendVerificationRequest({ identifier: email, url, provider }) {
    54	        const callbackUrl = new URL(url);
    55	        const { host } = callbackUrl;
    56	
    57	        // Anti-prefetch interstitial: email a /auth/confirm wrapper instead of
    58	        // the raw one-time callback URL. Corporate mail scanners prefetch
    59	        // links — a GET on the raw URL consumes the token (dead link for the
    60	        // human) and creates a ghost account. The confirm page redeems the
    61	        // token only on an explicit user click.
    62	        const confirmUrl = new URL("/auth/confirm", callbackUrl.origin);
    63	        confirmUrl.searchParams.set("cb", url);
    64	
    65	        // Detect locale from NEXT_LOCALE cookie
    66	        let locale = "en";
    67	        try {
    68	          const cookieStore = await cookies();
    69	          locale = cookieStore.get("NEXT_LOCALE")?.value || "en";
    70	        } catch {
    71	          // cookies() may throw outside request context; default to "en"
    72	        }
    73	
    74	        // Check if user exists to differentiate sign-up vs sign-in
    75	        let isNewUser = false;
    76	        try {
    77	          if (ADAPTER_SECRET) {
    78	            const res = await fetch(
    79	              `${BACKEND_URL}/api/internal/auth/users/by-email/${encodeURIComponent(email)}`,
    80	              {
    81	                headers: {
    82	                  "Content-Type": "application/json",
    83	                  "X-Adapter-Secret": ADAPTER_SECRET,
    84	                },
    85	              }
    86	            );
    87	            isNewUser = res.status === 404;
    88	          }
    89	        } catch {
    90	          // On any error, default to sign-in flow
    91	        }
    92	
    93	        const { html, text, subject } = buildSignInEmail({
    94	          url: confirmUrl.toString(),
    95	          host,
    96	          locale,
    97	          isNewUser,
    98	        });
    99	
   100	        const res = await fetch("https://api.resend.com/emails", {
   101	          method: "POST",
   102	          headers: {
   103	            Authorization: `Bearer ${resendApiKey}`,
   104	            "Content-Type": "application/json",
   105	          },
   106	          body: JSON.stringify({
   107	            from: provider.from,
   108	            to: email,
   109	            subject,
   110	            html,
   111	            text,
   112	            headers: {
   113	              "X-Entity-Ref-ID": crypto.randomUUID(),
   114	              "Reply-To": "support@doctalk.site",
   115	            },
   116	          }),
   117	        });
   118	
   119	        if (!res.ok) {
   120	          throw new Error(`Resend error: ${await res.text()}`);
   121	        }
   122	      },
   123	    })
   124	  );
   125	} else {
   126	  console.warn("RESEND_API_KEY not set — email magic link provider disabled");
   127	}
   128	
   129	export const { handlers, signIn, signOut, auth } = NextAuth({
   130	  secret: process.env.AUTH_SECRET,
   131	  adapter: FastAPIAdapter(),
   132	  session: {
   133	    strategy: "jwt",
   134	    maxAge: 30 * 24 * 60 * 60, // 30 days
   135	  },
   136	  providers,
   137	  callbacks: {
   138	    async jwt({ token, user }) {
   139	      if (user) {
   140	        token.sub = (user as any).id;
   141	      }
   142	      return token;
   143	    },
   144	    async session({ session, token }) {
   145	      if (token.sub) {
   146	        (session as any).user = (session as any).user || {};
   147	        (session as any).user.id = token.sub as string;
   148	      }
   149	      return session;
   150	    },
   151	  },
   152	  pages: {
   153	    signIn: "/auth",
   154	    verifyRequest: "/auth/verify-request",
   155	    error: "/auth/error",
   156	  },
   157	});

AUTH.JS DEFAULT REDIRECT
frontend/node_modules/@auth/core/index.d.ts:206:         *   async redirect({ url, baseUrl }) {
frontend/node_modules/@auth/core/index.d.ts:208:         *     if (url.startsWith("/")) return `${baseUrl}${url}`
frontend/node_modules/@auth/core/index.d.ts:211:         *     if (new URL(url).origin === baseUrl) return url
frontend/node_modules/@auth/core/src/index.ts:354:     *   async redirect({ url, baseUrl }) {
frontend/node_modules/@auth/core/src/index.ts:356:     *     if (url.startsWith("/")) return `${baseUrl}${url}`
frontend/node_modules/@auth/core/src/index.ts:359:     *     if (new URL(url).origin === baseUrl) return url
frontend/node_modules/@auth/core/src/lib/init.ts:33:  redirect({ url, baseUrl }) {
frontend/node_modules/@auth/core/src/lib/init.ts:34:    if (url.startsWith("/")) return `${baseUrl}${url}`
frontend/node_modules/@auth/core/src/lib/init.ts:35:    else if (new URL(url).origin === baseUrl) return url
frontend/node_modules/@auth/core/lib/init.js:13:    redirect({ url, baseUrl }) {
frontend/node_modules/@auth/core/lib/init.js:14:        if (url.startsWith("/"))
frontend/node_modules/@auth/core/lib/init.js:16:        else if (new URL(url).origin === baseUrl)
frontend/node_modules/@auth/core/src/lib/utils/assert.ts:36:      new URL(url, url.startsWith("/") ? baseUrl : undefined).protocol
frontend/node_modules/@auth/core/lib/utils/assert.js:6:        return /^https?:/.test(new URL(url, url.startsWith("/") ? baseUrl : undefined).protocol);

exec
/bin/zsh -lc "git diff --unified=80 04a2eb89..aaeb334 -- frontend/src/app/\\[locale\\]/demo/page.tsx frontend/src/app/demo/page.tsx frontend/src/app/features/free-demo/page.tsx frontend/src/i18n/routing.ts frontend/src/i18n/locales/en.json frontend/src/i18n/locales/fr.json frontend/src/lib/api.ts frontend/src/lib/useChatSession.ts frontend/src/lib/auth-modal.ts frontend/src/components/AuthModal.tsx frontend/src/components/Chat/ChatPanel.tsx frontend/src/components/Chat/MessageBubble.tsx frontend/src/components/AppHeaderShell.tsx frontend/src/components/PublicHeader.tsx frontend/src/components/dashboard/DashboardPageClient.tsx" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
diff --git a/frontend/src/app/[locale]/demo/page.tsx b/frontend/src/app/[locale]/demo/page.tsx
new file mode 100644
index 0000000..661b721
--- /dev/null
+++ b/frontend/src/app/[locale]/demo/page.tsx
@@ -0,0 +1,52 @@
+import { notFound } from 'next/navigation';
+import DemoPageClient from '../../demo/DemoPageClient';
+import LocaleProvider from '../../../i18n/LocaleProvider';
+import { getScopedMessages } from '../../../i18n/server';
+import { isUrlLocale } from '../../../i18n/routing';
+import { createMarketingLocalePage } from '../../../lib/marketingLocalePage';
+
+// Namespaces DemoPageClient's tree reads: the page content itself (`demo.`),
+// the breadcrumb ("Home" crumb), retry/loading copy, and — since MarketingShell
+// renders the header/footer without a server `chrome` prop here — everything
+// EditorialHeaderBase/EditorialFooter fall back to via client `useLocale()`
+// (nav, auth, language switcher, aria labels, masthead tagline, legal links).
+// Mirrors `LANDING_PREFIXES` in app/[locale]/page.tsx for the same reason.
+const DEMO_PREFIXES = [
+  'demo.',
+  'footer.',
+  'useCasesHub.breadcrumb.',
+  'common.',
+  'public.',
+  'auth.',
+  'header.',
+  'landing.',
+  'privacy.',
+  'terms.',
+] as const;
+
+// DemoPageClient is a client component (fetches demo docs, has interactive
+// state), so — unlike the pure-server `Content` components other localized
+// pages use (e.g. TrustPageContent) — it needs a `LocaleProvider` seeded with
+// server-resolved messages for its SSR HTML to be translated. Without this,
+// `/de/demo` would serve English until client hydration, defeating the
+// locale-URL program's crawler-visibility goal. Same mechanism as the root
+// `/[locale]/page.tsx` (LocaleProvider + getScopedMessages).
+async function DemoContent({ locale }: { locale: string }) {
+  if (!isUrlLocale(locale)) notFound();
+  const messages = await getScopedMessages(locale, DEMO_PREFIXES);
+  return (
+    <LocaleProvider initialLocale={locale} initialMessages={messages}>
+      <DemoPageClient />
+    </LocaleProvider>
+  );
+}
+
+const page = createMarketingLocalePage({
+  Content: DemoContent,
+  path: '/demo',
+  titleKey: 'demo.title',
+  descKey: 'demo.subtitle',
+});
+
+export const generateMetadata = page.generateMetadata;
+export default page.Page;
diff --git a/frontend/src/app/demo/page.tsx b/frontend/src/app/demo/page.tsx
index 7d75ffe..a3734df 100644
--- a/frontend/src/app/demo/page.tsx
+++ b/frontend/src/app/demo/page.tsx
@@ -1,35 +1,36 @@
 import type { Metadata } from 'next';
 import DemoPageClient from './DemoPageClient';
 import { buildMarketingMetadata } from '../../lib/seo';
 
 export const metadata: Metadata = buildMarketingMetadata({
   title: { absolute: 'Try DocTalk Free — Interactive Demo' },
   description:
     'Try DocTalk without signing up. Chat with sample documents, click source citations, and experience AI document Q&A before uploading your own files.',
   path: '/demo',
+  localized: true,
   keywords: ['doctalk demo', 'try ai pdf chat', 'free document ai demo'],
   openGraph: {
     title: 'Free AI Document Chat Demo | DocTalk',
   },
 });
 
 export default function DemoPage() {
   return (
     <>
       <script
         type="application/ld+json"
         dangerouslySetInnerHTML={{
           __html: JSON.stringify({
             '@context': 'https://schema.org',
             '@type': 'BreadcrumbList',
             itemListElement: [
               { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.doctalk.site' },
               { '@type': 'ListItem', position: 2, name: 'Demo' },
             ],
           }),
         }}
       />
       <DemoPageClient />
     </>
   );
 }
diff --git a/frontend/src/app/features/free-demo/page.tsx b/frontend/src/app/features/free-demo/page.tsx
index 53a74b6..37aae96 100644
--- a/frontend/src/app/features/free-demo/page.tsx
+++ b/frontend/src/app/features/free-demo/page.tsx
@@ -1,118 +1,118 @@
 import type { Metadata } from 'next';
 import FreeDemoContent from './FreeDemoContent';
 import { buildMarketingMetadata } from '../../../lib/seo';
 
 export const metadata: Metadata = buildMarketingMetadata({
   title: 'Free AI Document Chat Demo',
   description:
     'Try AI document chat instantly with 3 sample files. No signup, no credit card, and citation highlighting included from the first question.',
   path: '/features/free-demo',
   localized: true,
   keywords: ['free ai pdf demo', 'try document ai free', 'no signup pdf chat'],
   openGraph: {
     title: 'Free AI Document Chat Demo | DocTalk',
     description:
       'Chat with AI about sample documents instantly. No account, no credit card, no signup. 3 demo documents ready to explore.',
   },
 });
 
 export default function FreeDemoPage() {
   return (
     <>
       {/* BreadcrumbList */}
       <script
         type="application/ld+json"
         dangerouslySetInnerHTML={{
           __html: JSON.stringify({
             '@context': 'https://schema.org',
             '@type': 'BreadcrumbList',
             itemListElement: [
               { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.doctalk.site' },
               { '@type': 'ListItem', position: 2, name: 'Features', item: 'https://www.doctalk.site/features' },
               { '@type': 'ListItem', position: 3, name: 'Free Demo' },
             ],
           }),
         }}
       />
 
       {/* SoftwareApplication + Offer */}
       <script
         type="application/ld+json"
         dangerouslySetInnerHTML={{
           __html: JSON.stringify({
             '@context': 'https://schema.org',
             '@type': 'SoftwareApplication',
             name: 'DocTalk',
             applicationCategory: 'ProductivityApplication',
             operatingSystem: 'Web',
             url: 'https://www.doctalk.site/demo',
             description:
               'Try DocTalk free with 3 sample documents. No signup required. Experience AI document chat with citation highlighting.',
             offers: {
               '@type': 'Offer',
               price: '0',
               priceCurrency: 'USD',
               name: 'Free Demo',
-              description: 'No signup required. 5 messages per session. 3 sample documents.',
+              description: 'No signup required. 5 messages per sample document. 3 sample documents.',
             },
           }),
         }}
       />
 
       {/* FAQPage */}
       <script
         type="application/ld+json"
         dangerouslySetInnerHTML={{
           __html: JSON.stringify({
             '@context': 'https://schema.org',
             '@type': 'FAQPage',
             mainEntity: [
               {
                 '@type': 'Question',
                 name: 'Is it really free?',
                 acceptedAnswer: {
                   '@type': 'Answer',
-                  text: 'Yes. The demo is completely free with no hidden costs. You get 5 messages per session with 3 sample documents. No credit card, no account, no email required.',
+                  text: 'Yes. The demo is completely free with no hidden costs. You get 5 messages per sample document with 3 sample documents to explore. No credit card, no account, no email required.',
                 },
               },
               {
                 '@type': 'Question',
                 name: 'Do I need an account?',
                 acceptedAnswer: {
                   '@type': 'Answer',
                   text: 'No. The demo works without any account. Just click and start chatting. If you want to upload your own documents, you can create a free account that comes with 300 credits per month.',
                 },
               },
               {
                 '@type': 'Question',
                 name: 'What happens after the demo?',
                 acceptedAnswer: {
                   '@type': 'Answer',
                   text: 'After the demo, you can create a free account to upload your own documents and get 300 credits per month. Or upgrade to Plus (3,000 credits) or Pro (9,000 credits) for more usage.',
                 },
               },
               {
                 '@type': 'Question',
                 name: 'Can I upload my own documents for free?',
                 acceptedAnswer: {
                   '@type': 'Answer',
                   text: 'Yes. Free accounts can upload up to 3 documents (50MB each) and get 300 credits per month. Sign up with Google, Microsoft, or email — no credit card required.',
                 },
               },
               {
                 '@type': 'Question',
                 name: 'How many credits do I get?',
                 acceptedAnswer: {
                   '@type': 'Answer',
                   text: 'The demo does not use credits. Free accounts get 300 credits per month. Plus plans get 3,000 credits for $9.99/month, and Pro plans get 9,000 credits for $19.99/month.',
                 },
               },
             ],
           }),
         }}
       />
 
       <FreeDemoContent locale="en" />
     </>
   );
 }
diff --git a/frontend/src/components/AppHeaderShell.tsx b/frontend/src/components/AppHeaderShell.tsx
index 96d5158..71e3d68 100644
--- a/frontend/src/components/AppHeaderShell.tsx
+++ b/frontend/src/components/AppHeaderShell.tsx
@@ -1,74 +1,74 @@
 "use client";
 
 import React from 'react';
 import { ArrowLeft, FolderOpen } from 'lucide-react';
 import { usePathname } from 'next/navigation';
 import Link from 'next/link';
 import { useDocTalkStore } from '../store';
 import DocTalkLogo from './DocTalkLogo';
 import ModeSelector from './ModeSelector';
 import ThemeSelector from './ThemeSelector';
 import LanguageSelector from './LanguageSelector';
 import UserMenu from './UserMenu';
 import { useLocale } from '../i18n';
 import SessionDropdown from './SessionDropdown';
 import { CreditsDisplay } from './CreditsDisplay';
 import FeedbackButton from './FeedbackButton';
 
 interface AppHeaderShellProps {
   isDemo?: boolean;
   isLoggedIn?: boolean;
 }
 
 export default function AppHeaderShell({ isDemo, isLoggedIn }: AppHeaderShellProps) {
   const documentName = useDocTalkStore((s) => s.documentName);
   const lastDocumentId = useDocTalkStore((s) => s.lastDocumentId);
   const lastDocumentName = useDocTalkStore((s) => s.lastDocumentName);
   const { t } = useLocale();
   const pathname = usePathname();
   const isDocumentPage = pathname?.startsWith('/d/');
 
   return (
     <header className="dt-shell-header h-14 flex items-center px-3 sm:px-6 gap-2 sm:gap-3 min-w-0 shrink-0 sticky top-0 z-30 border-b">
       <Link href="/" className="font-logo font-semibold text-lg sm:text-xl text-[var(--workbench-ink)] hover:text-zinc-950 dark:hover:text-white transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm inline-flex items-center gap-1.5 sm:gap-2">
         <DocTalkLogo size={26} />
         {t('app.title')}
-        <span className="hidden sm:inline ml-1 -mt-2 px-1.5 py-0.5 text-[10px] font-medium leading-none rounded-full border border-white/18 bg-white/8 text-[var(--workbench-muted)] tracking-wide uppercase">Beta</span>
+        <span className="hidden sm:inline ml-1 -mt-2 px-1.5 py-0.5 text-[10px] font-medium leading-none rounded-full border border-zinc-300 bg-zinc-100 dark:border-white/18 dark:bg-white/8 text-[var(--workbench-muted)] tracking-wide uppercase">Beta</span>
       </Link>
       {documentName && (
         <>
-          <span className="mx-1 sm:mx-3 text-white/25">/</span>
+          <span className="mx-1 sm:mx-3 text-zinc-300 dark:text-white/25">/</span>
           <SessionDropdown />
         </>
       )}
       {!isDocumentPage && lastDocumentId && (
         <Link
           href={`/d/${lastDocumentId}`}
           className="dt-workbench-pill ml-1 sm:ml-3 inline-flex max-w-[140px] items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors hover:border-[var(--workbench-border-strong)] sm:max-w-[240px] focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
           title={lastDocumentName || ''}
           aria-label={t('header.backToDocument')}
         >
           <ArrowLeft aria-hidden="true" size={14} className="shrink-0" />
           <span className="max-w-[120px] sm:max-w-[200px] md:max-w-[300px] truncate">{lastDocumentName}</span>
         </Link>
       )}
       {!isDocumentPage && (
         <Link
           href="/collections"
           className="dt-workbench-pill ml-1 sm:ml-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors hover:border-[var(--workbench-border-strong)] focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
         >
           <FolderOpen aria-hidden="true" size={14} className="shrink-0" />
           <span className="hidden sm:inline">{t('collections.title')}</span>
         </Link>
       )}
       <div className="ml-auto flex items-center gap-1 sm:gap-2 shrink-0">
         {!(isDemo && !isLoggedIn) && <ModeSelector />}
         <div className="hidden sm:flex"><ThemeSelector /></div>
         {!(isDemo && !isLoggedIn) && <FeedbackButton />}
         <div className="hidden sm:block"><CreditsDisplay /></div>
         <UserMenu />
         <div className="hidden sm:flex"><LanguageSelector /></div>
       </div>
     </header>
   );
 }
diff --git a/frontend/src/components/AuthModal.tsx b/frontend/src/components/AuthModal.tsx
index 876430d..76bbb08 100644
--- a/frontend/src/components/AuthModal.tsx
+++ b/frontend/src/components/AuthModal.tsx
@@ -1,123 +1,140 @@
 "use client";
 
 import { useEffect, useRef, useState } from 'react';
 import { usePathname, useRouter, useSearchParams } from 'next/navigation';
 import { X } from 'lucide-react';
 import { useLocale } from '../i18n';
 import { AuthFormContent } from './AuthFormContent';
-import { AUTH_MODAL_HASH, getUrlWithoutAuthHash, isAuthModalHash } from '../lib/auth-modal';
+import { AUTH_MODAL_HASH, clearAuthCallbackOverride, getUrlWithoutAuthHash, isAuthModalHash, peekAuthCallbackOverride } from '../lib/auth-modal';
 import { trackEvent } from '../lib/analytics';
 
 export function AuthModal() {
   const router = useRouter();
   const pathname = usePathname();
   const searchParams = useSearchParams();
   const { t } = useLocale();
   const modalRef = useRef<HTMLDivElement>(null);
   const [isOpen, setIsOpen] = useState(false);
 
   useEffect(() => {
     const syncFromHash = () => setIsOpen(isAuthModalHash(window.location.hash));
     syncFromHash();
     window.addEventListener('hashchange', syncFromHash);
     return () => window.removeEventListener('hashchange', syncFromHash);
   }, []);
 
   useEffect(() => {
     if (searchParams.get('auth') !== '1') return;
     const currentSearch = new URLSearchParams(searchParams.toString());
     currentSearch.delete('auth');
     const nextUrl = `${pathname}${currentSearch.size ? `?${currentSearch.toString()}` : ''}${AUTH_MODAL_HASH}`;
     router.replace(nextUrl, { scroll: false });
     setIsOpen(true);
   }, [pathname, router, searchParams]);
 
   const handleClose = () => {
     const url = new URL(window.location.href);
     url.hash = '';
     router.replace(getUrlWithoutAuthHash(url), { scroll: false });
     setIsOpen(false);
   };
 
+  // Clear the override on every open→closed transition, not just `handleClose`
+  // — `isOpen` can also flip to false via the `hashchange`/`syncFromHash` path
+  // (e.g. a mobile back-gesture navigating off `#auth`), which bypasses
+  // `handleClose` entirely. Without this, a stale override could reapply on a
+  // later hash-only reopen. `wasOpenRef` skips the initial (never-opened)
+  // mount so a legitimate override set just before the modal opens isn't
+  // wiped before `isOpen` catches up.
+  const wasOpenRef = useRef(false);
+  useEffect(() => {
+    if (wasOpenRef.current && !isOpen) {
+      clearAuthCallbackOverride();
+    }
+    wasOpenRef.current = isOpen;
+  }, [isOpen]);
+
   useEffect(() => {
     if (!isOpen) return;
     trackEvent('auth_modal_opened', { source: 'auth_modal' });
     const previouslyFocused = document.activeElement as HTMLElement;
     const modal = modalRef.current;
     if (!modal) return;
 
     const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
     const focusables = modal.querySelectorAll<HTMLElement>(focusableSelector);
     const first = focusables[0];
 
     first?.focus();
 
     function handleKeyDown(e: KeyboardEvent) {
       if (e.key !== 'Tab') return;
       const currentFocusables = modal!.querySelectorAll<HTMLElement>(focusableSelector);
       const currentFirst = currentFocusables[0];
       const currentLast = currentFocusables[currentFocusables.length - 1];
       if (e.shiftKey) {
         if (document.activeElement === currentFirst) {
           e.preventDefault();
           currentLast?.focus();
         }
       } else {
         if (document.activeElement === currentLast) {
           e.preventDefault();
           currentFirst?.focus();
         }
       }
     }
 
     modal.addEventListener('keydown', handleKeyDown);
     return () => {
       modal.removeEventListener('keydown', handleKeyDown);
       previouslyFocused?.focus();
     };
   }, [isOpen]);
 
   if (!isOpen) return null;
 
   const callbackUrl = (() => {
+    const override = peekAuthCallbackOverride();
+    if (override) return `${window.location.origin}${override}`;
     const currentSearch = searchParams.toString();
     return `${window.location.origin}${pathname}${currentSearch ? `?${currentSearch}` : ''}`;
   })();
 
   return (
     <div
       ref={modalRef}
       className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in motion-reduce:animate-none"
       onClick={handleClose}
       role="dialog"
       aria-modal="true"
       aria-labelledby="auth-modal-title"
       tabIndex={-1}
       onKeyDown={(e) => e.key === 'Escape' && handleClose()}
     >
       <div
         className="bg-white dark:bg-zinc-900 rounded-xl p-8 w-full max-w-md mx-4 shadow-xl border border-zinc-200 dark:border-zinc-800 animate-slide-up motion-reduce:animate-none"
         onClick={(e) => e.stopPropagation()}
       >
         <div className="flex justify-between items-center mb-6">
           <h2 id="auth-modal-title" className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
             {t('auth.loginToContinue')}
           </h2>
           <button
             onClick={handleClose}
             className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400"
             aria-label={t('common.close')}
           >
             <X size={20} className="text-zinc-400" />
           </button>
         </div>
 
         <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
           {t('auth.loginBenefits')}
         </p>
 
         <AuthFormContent callbackUrl={callbackUrl} surface="modal" />
       </div>
     </div>
   );
 }
diff --git a/frontend/src/components/Chat/ChatPanel.tsx b/frontend/src/components/Chat/ChatPanel.tsx
index 0cf1876..7021e9c 100644
--- a/frontend/src/components/Chat/ChatPanel.tsx
+++ b/frontend/src/components/Chat/ChatPanel.tsx
@@ -82,616 +82,623 @@ const ChatMessageRow = React.memo(function ChatMessageRow({
     <MessageErrorBoundary messageId={message.id}>
       <div>
         <MessageBubble
           message={displayMessage}
           onCitationClick={onCitationClick}
           onPreviewLayoutTranslation={onPreviewLayoutTranslation}
           isStreaming={isStreaming}
           onRegenerate={onRegenerate}
           isLastAssistant={isLastAssistant}
           onContinue={onContinue}
           onShareAnswer={onShareAnswer}
           isSharingAnswer={isSharingAnswer}
         />
         {uniqueCitations && uniqueCitations.length > 0 && (
           <div className="mt-2 flex flex-wrap gap-1.5 pl-0">
             {uniqueCitations.map((citation) => (
               <CitationCard
                 key={`${message.id}-${citation.refIndex}`}
                 refIndex={citation.refIndex}
                 textSnippet={citation.textSnippet}
                 page={citation.page}
                 onClick={() => onCitationClick(citation)}
               />
             ))}
           </div>
         )}
       </div>
     </MessageErrorBoundary>
   );
 });
 
 interface ChatPanelProps {
   sessionId: string;
   onCitationClick: (c: Citation) => void;
   onPreviewLayoutTranslation?: (url: string, artifact: ChatArtifact) => void;
   maxUserMessages?: number;
   // Document-specific questions generated by the backend in the user's locale.
   // No generic fallback set: when absent, the empty state stays clean.
   suggestedQuestions?: string[];
   initialQuestion?: string;
   onOpenSettings?: () => void;
   hasCustomInstructions?: boolean;
   userPlan?: string;
   autoSubmitInitialQuestion?: boolean;
   // Whether this surface supports custom instructions at all. Document reader
   // uses it (true); collection chat doesn't (scope across multiple docs is
   // undefined). Default true to preserve existing single-doc behavior.
   supportsCustomInstructions?: boolean;
 }
 
 const autoSubmittedInitialQuestions = new Set<string>();
 
 export default function ChatPanel({ sessionId, onCitationClick, onPreviewLayoutTranslation, maxUserMessages, suggestedQuestions, initialQuestion, onOpenSettings, hasCustomInstructions, userPlan, autoSubmitInitialQuestion = false, supportsCustomInstructions = true }: ChatPanelProps) {
   const messages = useDocTalkStore((s) => s.messages);
   const isStreaming = useDocTalkStore((s) => s.isStreaming);
   const selectedMode = useDocTalkStore((s) => s.selectedMode);
   const addMessage = useDocTalkStore((s) => s.addMessage);
   const { t, tOr, locale } = useLocale();
   const router = useRouter();
 
   const [input, setInput] = useState('');
   const listRef = useRef<HTMLDivElement>(null);
   const textareaRef = useRef<HTMLTextAreaElement>(null);
   const [showPaywall, setShowPaywall] = useState(false);
   const [paywallReason, setPaywallReason] = useState<string | null>(null);
 
   const [plusMenuOpen, setPlusMenuOpen] = useState(false);
   const plusMenuRef = useRef<HTMLDivElement>(null);
   const plusMenuButtonRef = useRef<HTMLButtonElement>(null);
   const initialQuestionSubmittedRef = useRef<string | null>(null);
 
   const [showScrollBtn, setShowScrollBtn] = useState(false);
 
   const {
     sendMessage,
     regenerateLastResponse,
     continueGenerating,
     stopStreaming,
     demoRemaining,
     demoLimitReached,
-    messagesUsed,
     maxMessages,
   } = useChatStream({
     sessionId,
     selectedMode,
     locale,
     t,
     tOr,
     maxUserMessages,
     currentPlan: userPlan,
     onShowPaywall: (reason) => {
       setPaywallReason(reason ?? null);
       setShowPaywall(true);
     },
     onRequireAuth: () => openAuthModal(),
   });
 
   useEffect(() => {
     const el = listRef.current;
     if (!el) return;
 
     const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
 
     if (isNearBottom) {
       el.scrollTo({ top: el.scrollHeight, behavior: isStreaming ? 'auto' : 'smooth' });
     }
 
     setShowScrollBtn(!isNearBottom);
   }, [messages, isStreaming]);
 
   useEffect(() => {
     const ta = textareaRef.current;
     if (ta) {
       ta.style.height = 'auto';
       ta.style.height = Math.min(ta.scrollHeight, Math.max(160, window.innerHeight * 0.4)) + 'px';
     }
   }, [input]);
 
   useEffect(() => {
     const hasConversationMessages = messages.some((message) => message.id !== 'summary_synthetic');
     if (!initialQuestion || hasConversationMessages || isStreaming) return;
 
     if (autoSubmitInitialQuestion) {
       const autoSubmitKey = `${sessionId}:${initialQuestion}`;
       if (
         initialQuestionSubmittedRef.current === initialQuestion
         || autoSubmittedInitialQuestions.has(autoSubmitKey)
       ) return;
       initialQuestionSubmittedRef.current = initialQuestion;
       autoSubmittedInitialQuestions.add(autoSubmitKey);
       void sendMessage(initialQuestion).then((sent) => {
         if (!sent) {
           initialQuestionSubmittedRef.current = null;
           autoSubmittedInitialQuestions.delete(autoSubmitKey);
           setInput(initialQuestion);
           textareaRef.current?.focus();
         }
       });
       return;
     }
 
     if (input) return;
     setInput(initialQuestion);
     textareaRef.current?.focus();
   }, [autoSubmitInitialQuestion, initialQuestion, input, messages, isStreaming, sendMessage, sessionId]);
 
   useEffect(() => {
     if (!plusMenuOpen) return;
     const handler = (e: MouseEvent) => {
       const target = e.target as HTMLElement;
       if (!target.closest('[data-plus-menu]')) {
         setPlusMenuOpen(false);
       }
     };
     document.addEventListener('mousedown', handler);
     return () => document.removeEventListener('mousedown', handler);
   }, [plusMenuOpen]);
 
   useEffect(() => {
     if (!plusMenuOpen) return;
     const frame = window.requestAnimationFrame(() => {
       plusMenuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
     });
     return () => window.cancelAnimationFrame(frame);
   }, [plusMenuOpen]);
 
   const handleScroll = useCallback(() => {
     const el = listRef.current;
     if (!el) return;
     const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
     setShowScrollBtn(!atBottom);
   }, []);
 
   const handlePlusMenuKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
     const menuItems = plusMenuRef.current
       ? Array.from(plusMenuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]'))
       : [];
     if (menuItems.length === 0) return;
 
     const activeIndex = menuItems.findIndex((item) => item === document.activeElement);
 
     if (e.key === 'Escape') {
       e.preventDefault();
       setPlusMenuOpen(false);
       plusMenuButtonRef.current?.focus();
       return;
     }
 
     if (e.key === 'ArrowDown') {
       e.preventDefault();
       const nextIndex = activeIndex >= 0 ? (activeIndex + 1) % menuItems.length : 0;
       menuItems[nextIndex]?.focus();
       return;
     }
 
     if (e.key === 'ArrowUp') {
       e.preventDefault();
       const prevIndex = activeIndex >= 0
         ? (activeIndex - 1 + menuItems.length) % menuItems.length
         : menuItems.length - 1;
       menuItems[prevIndex]?.focus();
       return;
     }
 
     if ((e.key === 'Enter' || e.key === ' ') && document.activeElement instanceof HTMLElement) {
       if (document.activeElement.getAttribute('role') === 'menuitem') {
         e.preventDefault();
         document.activeElement.click();
       }
     }
   }, []);
 
   const onSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     const sent = await sendMessage(input);
     if (sent) setInput('');
   };
 
   const handleSuggestedClick = (question: string) => {
     setInput(question);
     void sendMessage(question).then((sent) => {
       if (sent) setInput('');
     });
   };
 
   const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
     if (e.key === 'Enter' && !e.shiftKey) {
       e.preventDefault();
       void sendMessage(input).then((sent) => {
         if (sent) setInput('');
       });
     }
   };
 
   const handleDemoAuthClick = useCallback(() => {
     trackEvent('upgrade_click', {
       source: 'demo_limit_panel',
       reason: 'demo_message_limit',
       plan: 'plus',
       period: 'monthly',
     });
-    openAuthModal();
+    openAuthModal({ callbackUrl: '/' });
   }, []);
 
   const handleExport = useCallback(() => {
     trackEvent('export_clicked', { source: 'chat_plus_menu', format: 'markdown' });
     const docName = useDocTalkStore.getState().documentName || 'document';
     exportConversationAsMarkdown(messages, docName);
   }, [messages]);
 
   const handleExportFormat = useCallback(async (format: 'pdf' | 'docx') => {
     trackEvent('export_clicked', { source: 'chat_plus_menu', format });
     try {
       const { exportSession } = await import('../../lib/api');
       const blob = await exportSession(sessionId, format);
       const url = URL.createObjectURL(blob);
       const a = document.createElement('a');
       a.href = url;
       a.download = `conversation.${format}`;
       document.body.appendChild(a);
       a.click();
       document.body.removeChild(a);
       URL.revokeObjectURL(url);
     } catch (e) {
       console.error('Export failed:', e);
       const copy = errorCopy(e, t, tOr);
       addMessage({
         id: `m_${Date.now()}_exp`,
         role: 'assistant',
         text: copy.body,
         isError: true,
         createdAt: Date.now(),
       });
     }
   }, [addMessage, sessionId, t, tOr]);
 
   const [shareLoading, setShareLoading] = useState(false);
   const [shareAnswerLoadingId, setShareAnswerLoadingId] = useState<string | null>(null);
 
   const copyShareUrl = useCallback(async (url: string) => {
     try {
       await navigator.clipboard.writeText(url);
       return;
     } catch {
       const textarea = document.createElement('textarea');
       textarea.value = url;
       textarea.setAttribute('readonly', '');
       textarea.style.position = 'fixed';
       textarea.style.opacity = '0';
       document.body.appendChild(textarea);
       textarea.select();
       document.execCommand('copy');
       document.body.removeChild(textarea);
     }
   }, []);
 
   const handleShare = useCallback(async () => {
     if (shareLoading) return;
     setShareLoading(true);
     try {
       const { createShare } = await import('../../lib/api');
       const result = await createShare(sessionId);
       await copyShareUrl(result.url);
       trackEvent('share_created', { source: 'chat_panel', plan: userPlan || 'unknown' });
       addMessage({
         id: `m_${Date.now()}_share_ok`,
         role: 'assistant',
         text: tOr('share.copied', 'Link copied to clipboard.'),
         createdAt: Date.now(),
       });
     } catch (e) {
       console.error('Share failed:', e);
       const copy = errorCopy(e, t, tOr);
       addMessage({
         id: `m_${Date.now()}_share_err`,
         role: 'assistant',
         text: copy.body,
         isError: true,
         createdAt: Date.now(),
       });
     } finally {
       setShareLoading(false);
     }
   }, [addMessage, copyShareUrl, sessionId, shareLoading, t, tOr, userPlan]);
 
   const handleShareAnswer = useCallback(async (message: Message) => {
     if (!message.shareAnchor || shareAnswerLoadingId) return;
     setShareAnswerLoadingId(message.id);
     try {
       const { createShare } = await import('../../lib/api');
       const result = await createShare(sessionId);
       const answerUrl = withShareAnchor(result.url, message.shareAnchor);
       await copyShareUrl(answerUrl);
       trackEvent('share_created', { source: 'answer_action', plan: userPlan || 'unknown' });
       addMessage({
         id: `m_${Date.now()}_share_answer_ok`,
         role: 'assistant',
         text: tOr('share.answerCopied', 'Answer link copied to clipboard.'),
         createdAt: Date.now(),
       });
     } catch (e) {
       console.error('Answer share failed:', e);
       const copy = errorCopy(e, t, tOr);
       addMessage({
         id: `m_${Date.now()}_share_answer_err`,
         role: 'assistant',
         text: copy.body,
         isError: true,
         createdAt: Date.now(),
       });
     } finally {
       setShareAnswerLoadingId(null);
     }
   }, [addMessage, copyShareUrl, sessionId, shareAnswerLoadingId, t, tOr, userPlan]);
 
   // Stable refs for the per-message row callbacks (I21). Previously the
   // arrow functions `() => void regenerateLastResponse()` / `() => void
   // continueGenerating()` / `(msg) => void handleShareAnswer(msg)` were
   // recreated on every render of `ChatPanel`, and `ChatPanel` re-renders
   // every ~50ms during SSE streaming (because the store's messages array
   // mutates on every text flush). Even with `MessageBubble` memoized,
   // those fresh arrow identities broke shallow-prop comparison and
   // forced every historical message to re-run ReactMarkdown + Shiki at
   // streaming cadence — O(n) work per flush. With these stabilized,
   // only the actively-streaming message (the one whose `.text` ref
   // changed) re-renders. The underlying mutations are already
   // useCallback'd in `useChatStream`, so these wrappers stay stable
   // across streaming flushes.
   const handleRegenerateLast = useCallback(() => {
     void regenerateLastResponse();
   }, [regenerateLastResponse]);
   const handleContinueLast = useCallback(() => {
     void continueGenerating();
   }, [continueGenerating]);
   const handleShareAnswerVoid = useCallback((msg: Message) => {
     void handleShareAnswer(msg);
   }, [handleShareAnswer]);
 
+  const handleAnonShareClick = useCallback(() => {
+    trackEvent('upgrade_click', { source: 'demo_share_attempt' });
+    // Anonymous transcripts are not preserved through signup (no session
+    // adoption yet) — this is a conversion affordance, not a working share.
+    openAuthModal();
+  }, []);
+
   const canUseCustomInstructions = !!onOpenSettings;
   // Show the entry only on surfaces that support the feature. Among those,
   // show the Pro upgrade hook to Free + Plus (Plus was previously hidden, a
   // UX inconsistency); Pro users see the unlocked, functional entry.
   // Anonymous (userPlan=undefined) stays hidden.
   const showCustomInstructions = supportsCustomInstructions && (
     canUseCustomInstructions || userPlan === 'free' || userPlan === 'plus'
   );
   const canUseExport = messages.length > 0 && !isStreaming && (userPlan === 'plus' || userPlan === 'pro');
   const showExportInMenu = messages.length > 0 && !isStreaming;
 
   return (
     <div className="dt-chat-shell flex h-full flex-col">
       <PaywallModal
         isOpen={showPaywall}
         onClose={() => setShowPaywall(false)}
         reason={paywallReason}
         currentPlan={userPlan}
       />
       <div className="relative flex-1 min-h-0">
         <div
           ref={listRef}
           onScroll={handleScroll}
           data-tour="chat-area"
           className="dt-chat-scroll h-full overflow-y-auto overflow-x-hidden px-4 pb-10 pt-4 sm:px-6 sm:pb-12 lg:px-7"
         >
           {messages.length === 0 && suggestedQuestions && suggestedQuestions.length > 0 && (
             <div className="flex min-h-full flex-col items-center justify-center px-2 py-8">
               <div className="dt-empty-workbench rounded-[1.75rem] px-5 py-6 sm:px-7 sm:py-7">
-                <div className="mb-5 flex items-center justify-between gap-4 border-b border-white/10 pb-4">
+                <div className="mb-5 flex items-center justify-between gap-4 border-b border-zinc-200 dark:border-white/10 pb-4">
                   <div>
                     <p className="text-[11px] font-mono uppercase tracking-[0.08em] text-[var(--workbench-muted)]">DocTalk</p>
                     <p className="mt-1 text-sm font-medium text-[var(--workbench-ink)]">{t('chat.trySuggested')}</p>
                   </div>
-                  <div className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl border border-white/14 bg-white/8 text-xs font-mono font-semibold text-white/72">
+                  <div className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-white/14 dark:bg-white/8 dark:text-white/72 text-xs font-mono font-semibold">
                     01
                   </div>
                 </div>
                 <div className="grid gap-2 sm:grid-cols-2">
                   {suggestedQuestions.map((question, index) => (
                     <button
                       key={`sq-${index}`}
                       type="button"
                       onClick={() => handleSuggestedClick(question)}
                       className="dt-suggested-question min-h-12 rounded-lg px-3 py-2 text-left text-sm leading-snug focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                     >
                       {question}
                     </button>
                   ))}
                 </div>
               </div>
             </div>
           )}
           {messages.length > 0 && (
             <div className="mx-auto max-w-4xl pb-2">
               {messages.map((message, idx) => {
                 const isLastMessage = idx === messages.length - 1;
                 const showStreaming = isLastMessage && isStreaming && message.role === 'assistant';
                 const isLastAssistantMsg = message.role === 'assistant' && !isStreaming && isLastMessage;
                 // Pass `message` directly — the store keeps stable refs for
                 // non-streaming messages, so React.memo on ChatMessageRow
                 // can skip re-rendering historical rows during a stream.
                 // Callbacks are gated by message position so only the last
                 // assistant message receives non-undefined refs.
                 return (
                   <ChatMessageRow
                     key={message.id}
                     message={message}
                     isStreaming={showStreaming}
                     isLastAssistant={isLastAssistantMsg}
                     onCitationClick={onCitationClick}
                     onPreviewLayoutTranslation={onPreviewLayoutTranslation}
                     onRegenerate={isLastAssistantMsg ? handleRegenerateLast : undefined}
                     onContinue={isLastAssistantMsg && message.isTruncated ? handleContinueLast : undefined}
-                    onShareAnswer={userPlan ? handleShareAnswerVoid : undefined}
+                    onShareAnswer={userPlan ? handleShareAnswerVoid : handleAnonShareClick}
                     isSharingAnswer={shareAnswerLoadingId === message.id}
                   />
                 );
               })}
             </div>
           )}
         </div>
         {messages.length > 0 && showScrollBtn && (
           <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none z-10">
             <button
               onClick={() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })}
-              className="pointer-events-auto rounded-full border border-white/14 bg-white/10 p-2 text-[var(--workbench-muted)] shadow-md transition-shadow hover:text-white hover:shadow-lg focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
+              className="pointer-events-auto rounded-full border border-zinc-200 bg-white hover:text-zinc-900 dark:border-white/14 dark:bg-white/10 p-2 text-[var(--workbench-muted)] shadow-md transition-shadow dark:hover:text-white hover:shadow-lg focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
               aria-label={t('chat.scrollToBottom')}
             >
               <ArrowDown size={16} />
             </button>
           </div>
         )}
       </div>
 
       {maxUserMessages != null && (
         <div className="border-t border-[var(--workbench-border)]">
-          <div className="h-1 bg-white/10">
+          <div className="h-1 bg-zinc-200 dark:bg-white/10">
             <div
               role="progressbar"
-              aria-valuenow={messagesUsed}
+              aria-valuenow={Math.max(0, demoRemaining)}
               aria-valuemin={0}
               aria-valuemax={maxMessages}
               aria-label={t('chat.messagesUsed')}
+              aria-valuetext={t('demo.questionsRemaining', { remaining: Math.max(0, demoRemaining), total: maxUserMessages })}
               className={`h-full transition-[width] duration-300 ${
                 demoRemaining <= 2 ? 'bg-amber-500' : 'bg-zinc-400 dark:bg-zinc-500'
               }`}
               style={{ width: `${Math.max(0, (demoRemaining / maxUserMessages) * 100)}%` }}
             />
           </div>
           {demoLimitReached ? (
             <div className="px-4 py-3 sm:px-6" aria-live="polite">
               <div className="dt-stitch-card mx-auto flex max-w-4xl flex-col gap-3 rounded-2xl p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                 <div>
                   <p className="font-semibold">
                     {tOr('demo.limitPanel.title', 'Ready to use DocTalk on your own files?')}
                   </p>
                   <p className="mt-1 text-[var(--workbench-muted)]">
                     {tOr('demo.limitPanel.body', 'Create a free account to upload documents, keep chats, and start with free credits.')}
                   </p>
                 </div>
                 <button
                   type="button"
                   onClick={handleDemoAuthClick}
                   className="dt-stitch-primary inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-4 py-2 font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                 >
                   {tOr('demo.limitPanel.cta', 'Upload your own document')}
                 </button>
               </div>
             </div>
           ) : (
             <div className="flex items-center justify-between px-4 py-2 text-sm text-[var(--workbench-muted)]" aria-live="polite">
               <span className={demoRemaining <= 2 ? 'text-amber-600 dark:text-amber-400 font-medium' : ''}>
                 {t('demo.questionsRemaining', { remaining: Math.max(0, demoRemaining), total: maxUserMessages })}
               </span>
-              <button type="button" onClick={() => openAuthModal()} className="text-sm text-[var(--workbench-muted)] hover:text-white hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-zinc-400">
+              <button type="button" onClick={() => openAuthModal()} className="text-sm text-[var(--workbench-muted)] hover:text-zinc-900 dark:hover:text-white hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-zinc-400">
                 {t('demo.signInForUnlimited')}
               </button>
             </div>
           )}
         </div>
       )}
 
       <form onSubmit={onSubmit} className="dt-composer-shell px-4 py-3 sm:px-6">
         <div className="mx-auto max-w-4xl">
           {userPlan && (
             <div className="mb-2 flex justify-end">
               <DomainModeSelector userPlan={userPlan} />
             </div>
           )}
           <div className="dt-composer flex items-center gap-2 rounded-[1.75rem] px-3 py-2 transition-[border-color,box-shadow]">
             <PlusMenu
               isOpen={plusMenuOpen}
               setIsOpen={setPlusMenuOpen}
               menuRef={plusMenuRef}
               buttonRef={plusMenuButtonRef}
               onMenuKeyDown={handlePlusMenuKeyDown}
               showCustomInstructions={showCustomInstructions}
               showExportInMenu={showExportInMenu}
               canUseCustomInstructions={canUseCustomInstructions}
               hasCustomInstructions={hasCustomInstructions}
               canUseExport={canUseExport}
               onOpenSettings={onOpenSettings}
               onExport={handleExport}
               onExportPdf={() => handleExportFormat('pdf')}
               onExportDocx={() => handleExportFormat('docx')}
               onBillingRedirect={(intent) => {
                 setPlusMenuOpen(false);
                 trackEvent('upgrade_click', {
                   plan: intent.plan,
                   period: 'monthly',
                   source: 'chat_plus_menu',
                   reason: intent.reason,
                 });
                 router.push(billingHref({ plan: intent.plan, source: 'chat_plus_menu', reason: intent.reason }));
               }}
               t={t}
               tOr={tOr}
             />
-            {messages.length > 0 && !isStreaming && userPlan && (
+            {messages.length > 0 && !isStreaming && (
               <button
                 type="button"
-                onClick={handleShare}
+                onClick={userPlan ? handleShare : handleAnonShareClick}
                 disabled={shareLoading}
-                className="rounded-full p-1.5 text-[var(--workbench-muted)] transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:opacity-50"
+                className="rounded-full p-1.5 text-[var(--workbench-muted)] transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:opacity-50"
                 title={tOr('chat.share', 'Share conversation')}
                 aria-label={tOr('chat.share', 'Share conversation')}
               >
                 <Share2 size={16} />
               </button>
             )}
             <textarea
               ref={textareaRef}
-              className="flex-1 resize-none overflow-y-auto bg-transparent px-1 py-1 text-sm text-[var(--workbench-ink)] placeholder:text-white/38 focus:outline-none"
+              className="flex-1 resize-none overflow-y-auto bg-transparent px-1 py-1 text-sm text-[var(--workbench-ink)] placeholder:text-zinc-400 dark:placeholder:text-white/38 focus:outline-none"
               style={{ minHeight: '36px' }}
               placeholder={demoLimitReached ? t('demo.signInToContinue') : t('chat.placeholder')}
               value={input}
               onChange={(e) => setInput(e.target.value)}
               onKeyDown={onKeyDown}
               disabled={isStreaming || demoLimitReached}
               rows={1}
               aria-label={t('chat.placeholder')}
             />
             <div className="flex items-center shrink-0">
               {isStreaming ? (
                 <button
                   type="button"
                   onClick={stopStreaming}
                   className="dt-stitch-primary rounded-full p-2 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                   title={tOr('chat.stop', 'Stop')}
                   aria-label={t('chat.stop')}
                 >
                   <Square size={16} />
                 </button>
               ) : (
                 <button
                   type="submit"
                   className="dt-stitch-primary rounded-full p-2 transition-colors disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                   disabled={!input.trim() || demoLimitReached}
                   title={t('chat.send')}
                   aria-label={t('chat.send')}
                 >
                   <SendHorizontal size={18} />
                 </button>
               )}
             </div>
           </div>
         </div>
       </form>
 
       <div className="bg-transparent pb-2 text-center">
-        <p className="mx-auto max-w-4xl text-xs text-white/36">
+        <p className="mx-auto max-w-4xl text-xs text-zinc-400 dark:text-zinc-500">
           {t('chat.disclaimer')}
         </p>
       </div>
     </div>
   );
 }
diff --git a/frontend/src/components/Chat/MessageBubble.tsx b/frontend/src/components/Chat/MessageBubble.tsx
index dfa5176..19db755 100644
--- a/frontend/src/components/Chat/MessageBubble.tsx
+++ b/frontend/src/components/Chat/MessageBubble.tsx
@@ -205,214 +205,214 @@ function MessageBubble({
   onContinue,
   onShareAnswer,
   isSharingAnswer,
 }: MessageBubbleProps) {
   const isUser = message.role === 'user';
   const isError = !!message.isError;
   const isAssistant = !isUser;
   const { t } = useLocale();
 
   const [copied, setCopied] = useState(false);
   const [feedback, setFeedback] = useState<Feedback>(null);
 
   useEffect(() => {
     if (isAssistant) {
       setFeedback(getFeedback(message.id));
     }
   }, [message.id, isAssistant]);
 
   const handleCopy = useCallback(() => {
     navigator.clipboard.writeText(message.text)
       .then(() => {
         setCopied(true);
         setTimeout(() => setCopied(false), 2000);
       })
       .catch(() => {
         // iOS Safari / non-HTTPS reject clipboard.writeText. The natural
         // "didn't work" cue is the absence of the copied state — no toast
         // needed. Swallowing prevents an unhandled promise rejection.
       });
   }, [message.text]);
 
   const handleFeedback = useCallback((fb: Feedback) => {
     const newFb = feedback === fb ? null : fb;
     setFeedback(newFb);
     setFeedbackStorage(message.id, newFb);
     if (newFb) {
       trackEvent('feedback_submitted', {
         source: 'message_actions',
         rating: newFb,
         has_citations: Boolean(message.citations?.length),
       });
     }
   }, [feedback, message.citations?.length, message.id]);
 
   const markdownText = useMemo(() => {
     if (isUser || isError) return message.text;
     return insertCitationMarkers(message.text, message.citations || []);
   }, [message.text, message.citations, isUser, isError]);
 
   const markdownComponents = useMemo(() => {
     const citations = message.citations || [];
     const components: Record<string, any> = {
       pre: PreBlock,
     };
     if (citations.length > 0) {
       const tags = ['p', 'li', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'blockquote'] as const;
       for (const tag of tags) {
         components[tag] = createCitationComponent(tag, citations, onCitationClick, t);
       }
     }
     return components;
   }, [message.citations, onCitationClick, t]);
 
   return (
     <div className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'} ${isUser ? 'my-4' : 'my-6'} group`}>
       <div className={`relative ${isUser ? 'max-w-[80%]' : 'w-full'}`}>
         <div
           className={
             isError
               ? 'text-sm rounded-2xl px-4 py-3 bg-red-500/92 text-white shadow-2xl shadow-red-950/30'
               : isUser
               ? 'dt-user-bubble text-sm rounded-2xl px-4 py-3'
               : 'dt-answer-card text-[var(--workbench-ink)]'
           }
         >
           {isUser ? (
             <span className="whitespace-pre-wrap">{message.text}</span>
           ) : isStreaming && !message.text ? (
             <div className="flex items-center gap-2 text-[var(--workbench-muted)] text-sm" aria-live="polite">
               <div className="flex gap-1">
-                <span className="w-1.5 h-1.5 bg-white/55 rounded-full animate-bounce motion-reduce:animate-none [animation-delay:-0.3s]" aria-hidden="true" />
-                <span className="w-1.5 h-1.5 bg-white/55 rounded-full animate-bounce motion-reduce:animate-none [animation-delay:-0.15s]" aria-hidden="true" />
-                <span className="w-1.5 h-1.5 bg-white/55 rounded-full animate-bounce motion-reduce:animate-none" aria-hidden="true" />
+                <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce motion-reduce:animate-none [animation-delay:-0.3s]" aria-hidden="true" />
+                <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce motion-reduce:animate-none [animation-delay:-0.15s]" aria-hidden="true" />
+                <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce motion-reduce:animate-none" aria-hidden="true" />
                 <span className="hidden motion-reduce:inline" aria-hidden="true">...</span>
               </div>
               <span>{t('chat.searching')}</span>
             </div>
           ) : (
             <>
               {/* Sources strip — rendered above the prose so the
                   "grounded-in-these-documents" signal is visible before the
                   user reads the answer. During streaming with no citations
                   yet, SourcesStrip itself draws a skeleton so the block
                   doesn't flicker into existence mid-answer. */}
               {isAssistant && (
                 <SourcesStrip
                   citations={message.citations ?? []}
                   onCitationClick={onCitationClick}
                   isStreaming={isStreaming}
                 />
               )}
               <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 sm:prose-base">
                 <Suspense fallback={<span className="whitespace-pre-wrap">{markdownText}</span>}>
                   <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                     {markdownText}
                   </ReactMarkdown>
                 </Suspense>
                 {isStreaming && isAssistant && message.text && (
-                  <span aria-hidden="true" className="inline-block w-2 h-4 bg-white/45 animate-pulse motion-reduce:animate-none rounded-sm ml-0.5 align-text-bottom" />
+                  <span aria-hidden="true" className="inline-block w-2 h-4 bg-zinc-400 dark:bg-white/45 animate-pulse motion-reduce:animate-none rounded-sm ml-0.5 align-text-bottom" />
                 )}
               </div>
               {isAssistant && !message.text && message.toolStatus ? (
                 <p className="mt-3 text-sm text-[var(--workbench-muted)]">{message.toolStatus}</p>
               ) : null}
               {isAssistant && message.artifacts?.map((artifact, index) => (
                 <ChatArtifactCard
                   key={`${artifact.jobId || artifact.title}-${index}`}
                   artifact={artifact}
                   onCitationClick={onCitationClick}
                   onPreviewLayoutTranslation={onPreviewLayoutTranslation}
                 />
               ))}
             </>
           )}
         </div>
 
         {/* Copy + feedback buttons (assistant only) */}
         {isAssistant && !isError && message.text && (
           <div className={`mt-2 flex gap-1.5 transition-opacity ${isLastAssistant ? '' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`}>
             <button
               onClick={handleCopy}
-              className="rounded-full p-1.5 text-[var(--workbench-muted)] transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400"
+              className="rounded-full p-1.5 text-[var(--workbench-muted)] transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400"
               title={copied ? t('copy.copied') : t('copy.button')}
               aria-label={t('copy.button')}
             >
               {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
             </button>
             <button
               onClick={() => handleFeedback('up')}
               className={`rounded-lg p-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                 feedback === 'up'
-                  ? 'text-white'
-                  : 'text-[var(--workbench-muted)] hover:bg-white/10 hover:text-white'
+                  ? 'text-accent dark:text-white'
+                  : 'text-[var(--workbench-muted)] hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white'
               }`}
               title={t('feedback.helpful')}
               aria-label={t('feedback.helpful')}
               aria-pressed={feedback === 'up'}
             >
               <ThumbsUp size={14} fill={feedback === 'up' ? 'currentColor' : 'none'} />
             </button>
             <button
               onClick={() => handleFeedback('down')}
               className={`rounded-lg p-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                 feedback === 'down'
                   ? 'text-red-500 dark:text-red-400'
-                  : 'text-[var(--workbench-muted)] hover:bg-white/10 hover:text-white'
+                  : 'text-[var(--workbench-muted)] hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white'
               }`}
               title={t('feedback.notHelpful')}
               aria-label={t('feedback.notHelpful')}
               aria-pressed={feedback === 'down'}
             >
               <ThumbsDown size={14} fill={feedback === 'down' ? 'currentColor' : 'none'} />
             </button>
             {message.shareAnchor && onShareAnswer && !isStreaming && (
               <button
                 onClick={() => onShareAnswer(message)}
                 disabled={isSharingAnswer}
-                className="rounded-full p-1.5 text-[var(--workbench-muted)] transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50"
+                className="rounded-full p-1.5 text-[var(--workbench-muted)] transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50"
                 title={t('chat.shareAnswer')}
                 aria-label={t('chat.shareAnswer')}
               >
                 <Share2 size={14} />
               </button>
             )}
             {isLastAssistant && onRegenerate && !isStreaming && (
               <button
                 onClick={onRegenerate}
-                className="rounded-full p-1.5 text-[var(--workbench-muted)] transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400"
+                className="rounded-full p-1.5 text-[var(--workbench-muted)] transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400"
                 title={t('chat.regenerate')}
                 aria-label={t('chat.regenerate')}
               >
                 <RotateCcw size={14} />
               </button>
             )}
           </div>
         )}
 
         {/* Continue generating button */}
         {isAssistant && message.isTruncated && !isStreaming && isLastAssistant && onContinue && (
           <button
             onClick={onContinue}
             className="mt-2 flex items-center gap-1.5 rounded-lg border border-[var(--reader-evidence-border)] bg-[var(--reader-evidence-soft)] px-3 py-1.5 text-sm font-medium text-[var(--reader-evidence)] transition-colors hover:brightness-95 focus-visible:ring-2 focus-visible:ring-[var(--reader-evidence)]"
             title={t('chat.continueGenerating')}
           >
             <ChevronsDown size={14} />
             {t('chat.continueGenerating')}
           </button>
         )}
       </div>
     </div>
   );
 }
 
 /**
  * Memoized export — prevents the chat re-render storm during SSE streaming
  * (Wave-2 I21). The store flushes the streaming assistant message every
  * ~50ms via `updateLastMessage`, which creates a new object only for the
  * last message; prior messages keep the same reference. Combined with
  * `useCallback`-stabilized `onRegenerate` / `onContinue` / `onShareAnswer`
  * in `ChatPanel`, shallow-prop comparison correctly skips re-renders of
  * historical messages — keeping per-flush ReactMarkdown + Shiki work O(1)
  * in the streaming message instead of O(n) across the whole thread.
  */
 export default React.memo(MessageBubble);
diff --git a/frontend/src/components/PublicHeader.tsx b/frontend/src/components/PublicHeader.tsx
index 54e40c0..c3928f7 100644
--- a/frontend/src/components/PublicHeader.tsx
+++ b/frontend/src/components/PublicHeader.tsx
@@ -1,96 +1,96 @@
 "use client";
 
 import { useState } from 'react';
 import Link from 'next/link';
 import { Menu, X } from 'lucide-react';
 import DocTalkLogo from './DocTalkLogo';
 import LanguageSelector from './LanguageSelector';
 import FeedbackButton from './FeedbackButton';
 import { useLocale } from '../i18n';
 import { trackEvent } from '../lib/analytics';
 
 export default function PublicHeader() {
   const { t, tOr } = useLocale();
   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
   const publicNav = [
     { href: '/features', label: t('public.nav.features') },
     { href: '/use-cases', label: t('public.nav.useCases') },
     { href: '/compare', label: t('public.nav.compare') },
     { href: '/blog', label: t('public.nav.blog') },
     { href: '/pricing', label: t('footer.pricing') },
   ];
 
   return (
     <header className="dt-shell-header relative h-14 flex items-center px-4 sm:px-6 gap-3 min-w-0 shrink-0 sticky top-0 z-30 border-b">
       <Link href="/" className="font-logo font-semibold text-xl text-[var(--workbench-ink)] hover:text-zinc-950 dark:hover:text-white transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm inline-flex items-center gap-2">
         <DocTalkLogo size={26} />
         {t('app.title')}
-        <span className="ml-1 -mt-2 px-1.5 py-0.5 text-[10px] font-medium leading-none rounded-full border border-white/18 bg-white/8 text-[var(--workbench-muted)] tracking-wide uppercase">Beta</span>
+        <span className="ml-1 -mt-2 px-1.5 py-0.5 text-[10px] font-medium leading-none rounded-full border border-zinc-300 bg-zinc-100 dark:border-white/18 dark:bg-white/8 text-[var(--workbench-muted)] tracking-wide uppercase">Beta</span>
       </Link>
 
       <nav className="hidden lg:flex items-center gap-4 ml-4" aria-label="Public navigation">
         {publicNav.map((item) => (
           <Link
             key={item.href}
             href={item.href}
-            className="rounded-full px-3 py-1.5 text-sm font-medium text-[var(--workbench-muted)] transition-colors hover:bg-white/10 hover:text-zinc-950 dark:hover:text-white"
+            className="rounded-full px-3 py-1.5 text-sm font-medium text-[var(--workbench-muted)] transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-white/10 dark:hover:text-white"
           >
             {item.label}
           </Link>
         ))}
       </nav>
 
       <div className="ml-auto flex items-center gap-2 shrink-0">
         <div className="hidden sm:flex"><LanguageSelector /></div>
         <div className="hidden md:flex"><FeedbackButton /></div>
         <button
           type="button"
           onClick={() => setMobileMenuOpen((open) => !open)}
           className="dt-workbench-button inline-flex h-9 w-9 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 dark:focus-visible:ring-zinc-500 dark:focus-visible:ring-offset-zinc-900 lg:hidden"
           aria-label={mobileMenuOpen ? t('common.close') : tOr('common.menu', 'Menu')}
           aria-expanded={mobileMenuOpen}
           aria-controls="mobile-public-navigation"
         >
           {mobileMenuOpen ? <X aria-hidden="true" size={18} /> : <Menu aria-hidden="true" size={18} />}
         </button>
         <Link
           href="/demo"
           onClick={() => trackEvent('landing_cta_clicked', { source: 'public_header', reason: 'demo' })}
           className="dt-workbench-pill hidden sm:inline-flex items-center rounded-full px-3 py-1.5 text-sm transition-colors hover:border-[var(--workbench-border-strong)] hover:text-zinc-950 dark:hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400"
         >
           {t('footer.demo')}
         </Link>
         <Link
           href="/auth"
           onClick={() => trackEvent('landing_cta_clicked', { source: 'public_header', reason: 'sign_up' })}
           className="dt-stitch-primary inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
         >
           {t('hero.signUpFree')}
         </Link>
       </div>
       {mobileMenuOpen && (
         <nav
           id="mobile-public-navigation"
           className="dt-glass-panel absolute left-3 right-3 top-full mt-2 rounded-2xl p-2 shadow-xl lg:hidden"
           aria-label="Mobile navigation"
         >
           <div className="grid gap-1">
             {[...publicNav, { href: '/demo', label: t('footer.demo') }].map((item) => (
               <Link
                 key={item.href}
                 href={item.href}
                 onClick={() => setMobileMenuOpen(false)}
                 className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-200 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
               >
                 {item.label}
               </Link>
             ))}
           </div>
           <div className="mt-2 border-t border-zinc-200 px-3 py-2 dark:border-zinc-800 sm:hidden">
             <LanguageSelector />
           </div>
         </nav>
       )}
     </header>
   );
 }
diff --git a/frontend/src/components/dashboard/DashboardPageClient.tsx b/frontend/src/components/dashboard/DashboardPageClient.tsx
index fd4796d..b22ae20 100644
--- a/frontend/src/components/dashboard/DashboardPageClient.tsx
+++ b/frontend/src/components/dashboard/DashboardPageClient.tsx
@@ -312,369 +312,369 @@ export default function DashboardPageClient() {
     e.preventDefault();
     setDragging(false);
     const file = e.dataTransfer.files?.[0];
     if (file) onFiles(file);
   };
 
   const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (file) onFiles(file);
   };
 
   const onUrlSubmit = useCallback(async () => {
     const url = urlInput.trim();
     if (!url) return;
     setUrlErrorCopy(null);
     if (!url.startsWith('http://') && !url.startsWith('https://')) {
       setUrlError(t('upload.urlError'));
       setUrlErrorCopy(null);
       return;
     }
     setUrlLoading(true);
     setUrlError('');
     setUrlErrorCopy(null);
     try {
       const res = await ingestUrl(url);
       const docId = res.document_id;
       trackEvent('url_ingest_created', { source: 'dashboard_url', plan: userPlan });
       setDocument(docId);
       setUrlInput('');
       getMyDocuments().then(setServerDocs).catch(console.error);
       router.push(`/d/${docId}`);
     } catch (e: unknown) {
       const copy = errorCopy(e, t, tOr);
       setUrlError(copy.body);
       setUrlErrorCopy(copy.cta ? copy : null);
       if (copy.cta) {
         trackEvent('limit_hit', { source: 'dashboard_url', reason: copy.cta.href.includes('file_size') ? 'file_size' : 'url_limit', plan: userPlan });
       }
     } finally {
       setUrlLoading(false);
     }
   }, [urlInput, router, setDocument, t, tOr, userPlan]);
 
   const confirmDeleteDocument = useCallback(async (documentId: string) => {
     setDeletingId(documentId);
     setDeleteErrorId((prev) => (prev === documentId ? null : prev));
     try {
       await deleteDocument(documentId);
       // Only mutate UI after the backend acknowledges the delete — otherwise
       // a network or 5xx failure would silently desync UI from server state.
       if (!isLoggedIn) {
         const docs: StoredDoc[] = JSON.parse(localStorage.getItem('doctalk_docs') || '[]');
         const next = docs.filter((x) => x.document_id !== documentId);
         localStorage.setItem('doctalk_docs', JSON.stringify(next));
         setMyDocs(next.sort((a, b) => b.createdAt - a.createdAt));
       }
       setServerDocs((prev) => prev.filter((s) => s.id !== documentId));
       setConfirmDeleteId((prev) => (prev === documentId ? null : prev));
     } catch (e) {
       console.error('Failed to delete document:', e);
       // Surface the failure so users know to retry rather than think it worked.
       setDeleteErrorId(documentId);
     } finally {
       setDeletingId(null);
     }
   }, [isLoggedIn]);
 
   return (
     <div className="dt-stitch-theme flex flex-col min-h-screen">
       <Header variant="full" />
       <main id="main-content" className="flex-1 flex flex-col items-center p-6 sm:p-8 gap-10">
         <div className="max-w-4xl w-full">
           <div className="mb-4 flex justify-center">
             <PrivacyBadge />
           </div>
 
           {showUpgradeNudge && (
             <section className="dt-stitch-card mb-5 rounded-2xl p-4">
               <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                 <div className="flex gap-3">
-                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/12 text-white">
+                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900/5 text-zinc-700 dark:bg-white/12 dark:text-white">
                     <Sparkles aria-hidden="true" size={18} />
                   </div>
                   <div>
                     <h2 className="text-sm font-semibold text-[var(--workbench-ink)]">
                       {tOr('dashboard.upgradeNudge.title', 'Ready for heavier document work?')}
                     </h2>
                     <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--workbench-muted)]">
                       {tOr(
                         'dashboard.upgradeNudge.body',
                         'Plus gives you 20 documents, 50 MB uploads, all AI modes, and Markdown export before your next limit stops the workflow.'
                       )}
                     </p>
                   </div>
                 </div>
                 <div className="flex shrink-0 items-center gap-2 sm:self-start">
 	                  <Link
 	                    href={billingHref({ plan: 'plus', source: 'dashboard_upgrade_reminder', reason: 'sustained_free_usage' })}
 	                    onClick={() => trackEvent('upgrade_click', {
 	                      plan: 'plus',
 	                      period: 'monthly',
 	                      source: 'dashboard_upgrade_reminder',
 	                      reason: 'sustained_free_usage',
 	                    })}
                     className="dt-stitch-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                   >
                     {tOr('dashboard.upgradeNudge.cta', 'Upgrade')}
                     <ArrowRight aria-hidden="true" size={15} />
                   </Link>
                   <button
                     type="button"
                     onClick={dismissUpgradeNudge}
-                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--workbench-muted)] transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
+                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--workbench-muted)] transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                     aria-label={tOr('dashboard.upgradeNudge.dismiss', 'Dismiss upgrade prompt')}
                   >
                     <X aria-hidden="true" size={16} />
                   </button>
                 </div>
               </div>
             </section>
           )}
 
           <div
             className={`dt-command-bar rounded-[2rem] p-8 text-center transition-colors sm:p-12 ${
               isDragging
-                ? 'border-white/40 bg-white/10'
-                : 'border-white/18'
+                ? 'border-accent bg-accent/5 dark:border-white/40 dark:bg-white/10'
+                : 'border-zinc-300 dark:border-white/18'
             }`}
             onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
             onDragLeave={() => setDragging(false)}
             onDrop={onDrop}
           >
             <input ref={inputRef} type="file" accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/markdown,.pdf,.docx,.pptx,.xlsx,.txt,.md" className="hidden" onChange={onInputChange} aria-label="Upload document" />
             <p className="text-[var(--workbench-ink)] text-lg">{t('upload.dragDrop')}</p>
             <p className="text-[var(--workbench-muted)] text-xs mt-1">{t('upload.supportedFormats')}</p>
             <p className="text-[var(--workbench-muted)] text-sm mt-1">{t('upload.or')}</p>
             <button
               type="button"
               onClick={() => inputRef.current?.click()}
               className="dt-stitch-primary mt-4 rounded-full px-6 py-2.5 font-medium transition-[box-shadow,color,background-color] disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
               disabled={uploading}
             >
               {t('upload.chooseFile')}
             </button>
             {progressText && (
               <div aria-live="polite" className={`mt-4 text-sm ${uploading ? 'text-zinc-500' : 'text-red-600 dark:text-red-400'}`}>
                 <p>{progressText}</p>
                 {uploadErrorCopy?.cta && (
                   <Link
                     href={uploadErrorCopy.cta.href}
                     onClick={() => trackEvent('upgrade_click', { source: 'upload_error', reason: 'upload_limit' })}
                     className="mt-3 inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                   >
                     {uploadErrorCopy.cta.label}
                   </Link>
                 )}
               </div>
             )}
           </div>
 
           {/* URL Import */}
           <div className="mt-4 flex items-center gap-2 max-w-lg mx-auto">
             <div className="flex-1 relative">
               <Link2 aria-hidden="true" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
               <input
                 type="url"
                 value={urlInput}
                 onChange={(e) => { setUrlInput(e.target.value); setUrlError(''); setUrlErrorCopy(null); }}
                 onKeyDown={(e) => { if (e.key === 'Enter') onUrlSubmit(); }}
                 placeholder={t('upload.urlPlaceholder')}
-                className="w-full rounded-full border border-white/14 bg-white/8 py-2.5 pl-9 pr-3 text-sm text-[var(--workbench-ink)] placeholder:text-white/38 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
+                className="w-full rounded-full border border-zinc-300 bg-white py-2.5 pl-9 pr-3 text-sm text-[var(--workbench-ink)] placeholder:text-zinc-400 dark:border-white/14 dark:bg-white/8 dark:placeholder:text-white/38 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                 disabled={urlLoading}
                 aria-label="Document URL"
               />
             </div>
             <button
               onClick={onUrlSubmit}
               disabled={urlLoading || !urlInput.trim()}
               className="dt-stitch-primary rounded-full px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
             >
               {urlLoading ? '...' : t('upload.ingestUrl')}
             </button>
           </div>
           {urlError && (
             <div role="alert" className="mt-2 text-center text-sm text-red-600 dark:text-red-400">
               <p>{urlError}</p>
               {urlErrorCopy?.cta && (
                 <Link
                   href={urlErrorCopy.cta.href}
                   onClick={() => trackEvent('upgrade_click', { source: 'url_error', reason: 'url_limit' })}
                   className="mt-3 inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                 >
                   {urlErrorCopy.cta.label}
                 </Link>
               )}
             </div>
           )}
 
           <div className="mt-3 text-center">
-            <Link href="/demo" className="text-[var(--workbench-muted)] hover:text-white text-sm transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm">
+            <Link href="/demo" className="text-[var(--workbench-muted)] hover:text-zinc-900 dark:hover:text-white text-sm transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm">
               {t('home.cta.tryDemo')}
             </Link>
           </div>
         </div>
 
         <div className="max-w-4xl w-full">
           <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
             <h2 className="text-3xl font-semibold tracking-normal text-[var(--workbench-ink)]">{t('doc.myDocuments')}</h2>
             <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
               <Link
                 href="/document-diff"
                 className="dt-workbench-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
               >
                 <GitCompare aria-hidden="true" size={16} />
                 {tOr('diff.tab', 'Compare')}
               </Link>
               <Link
                 href="/collections"
                 className="dt-workbench-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
               >
                 <FolderOpen aria-hidden="true" size={16} />
                 {tOr('dashboard.workspacesLink', 'Workspaces')}
               </Link>
             </div>
           </div>
 
           {showWorkspaceNudge && (
             <section className="dt-stitch-card mb-4 rounded-2xl p-4">
               <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                 <div className="flex gap-3">
-                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/14 bg-white/8 text-white">
+                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-white/14 dark:bg-white/8 dark:text-white">
                     <FolderOpen aria-hidden="true" size={18} />
                   </div>
                   <div>
                     <h3 className="text-sm font-semibold text-[var(--workbench-ink)]">
                       {tOr('dashboard.workspaceNudge.title', 'Turn related documents into a workspace')}
                     </h3>
                     <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--workbench-muted)]">
                       {tOr(
                         'dashboard.workspaceNudge.body',
                         'You have ready documents. Group them to ask cross-document questions while keeping citations tied to the exact source file.'
                       )}
                     </p>
                   </div>
                 </div>
                 <Link
                   href="/collections?action=create&select=ready"
                   className="dt-stitch-primary inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                 >
                   {tOr('dashboard.workspaceNudge.cta', 'Create workspace')}
                   <ArrowRight aria-hidden="true" size={15} />
                 </Link>
               </div>
             </section>
           )}
 
           {allDocs.length === 0 ? (
             <div className="dt-stitch-card flex flex-col items-center justify-center rounded-2xl border-dashed px-6 py-16 text-center">
               <FileUp aria-hidden="true" size={52} className="text-[var(--workbench-muted)]" />
               <h3 className="mt-5 text-xl font-semibold text-[var(--workbench-ink)]">{t('dashboard.emptyTitle')}</h3>
               <p className="mt-2 max-w-md text-sm text-[var(--workbench-muted)]">{t('dashboard.emptySubtitle')}</p>
               {/* Dual CTA per Codex r1 + 30-agent onboarding research:
                   primary "Start with a sample" bypasses the upload-and-wait
                   cliff that's eating activation; secondary text link
                   preserves "I have my own doc" path. */}
               <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
                 <Link
                   href="/demo"
                   className="dt-stitch-primary group inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-[box-shadow,color,background-color] motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                 >
                   {tOr('dashboard.emptyTrySample', 'Start with a sample doc')}
                   <span aria-hidden="true" className="transition-transform motion-reduce:transform-none group-hover:translate-x-0.5">→</span>
                 </Link>
                 <button
                   type="button"
                   onClick={() => inputRef.current?.click()}
-                  className="text-sm font-semibold text-[var(--workbench-muted)] transition-colors hover:text-white motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm"
+                  className="text-sm font-semibold text-[var(--workbench-muted)] transition-colors hover:text-zinc-900 dark:hover:text-white motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm"
                 >
                   {tOr('dashboard.emptyUploadOwn', 'Or upload your own')}
                 </button>
               </div>
             </div>
           ) : (
             <div className="space-y-3">
               {allDocs.map((d) => {
                 const statusMeta = getDocStatusMeta(d.status);
                 return (
                   <div
                     key={d.document_id}
                     className="dt-stitch-card flex items-center justify-between rounded-2xl p-5 transition-transform duration-200 hover:-translate-y-0.5"
                   >
                     <Link href={`/d/${d.document_id}`} className="flex-1 min-w-0 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-lg">
                       <div className="font-medium text-[var(--workbench-ink)] flex items-center gap-2 min-w-0">
                         <span className="truncate">{d.filename ? sanitizeFilename(d.filename) : d.document_id}</span>
                         <span className="inline-flex items-center gap-1.5 text-xs text-[var(--workbench-muted)] shrink-0">
                           <span className={`w-2 h-2 rounded-full ${statusMeta.dotClass}`} />
                           <span>{statusMeta.label}</span>
                         </span>
                       </div>
                       <div className="text-xs text-[var(--workbench-muted)] mt-0.5">
                         {new Date(d.createdAt).toLocaleString()}
                       </div>
                     </Link>
                     <div className="flex items-center gap-2">
                       <Link
                         href={`/d/${d.document_id}`}
                         className="dt-stitch-primary rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                       >
                         {t('doc.open')}
                       </Link>
                       {confirmDeleteId === d.document_id ? (
                         <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-300">
                           <span>{t('dashboard.deletePrompt')}</span>
                           <button
                             className="px-2 py-1 rounded-md bg-red-600 text-white hover:bg-red-500 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500"
                             disabled={deletingId === d.document_id}
                             onClick={() => confirmDeleteDocument(d.document_id)}
                           >
                             {t('common.yes')}
                           </button>
                           <button
                             className="px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500"
                             disabled={deletingId === d.document_id}
                             onClick={() => setConfirmDeleteId(null)}
                           >
                             {t('common.no')}
                           </button>
                         </div>
                       ) : deleteErrorId === d.document_id ? (
                         <div className="flex items-center gap-1.5 text-xs">
                           <span role="alert" className="text-red-600 dark:text-red-400">
                             {tOr('dashboard.deleteError', 'Delete failed. Try again.')}
                           </span>
                           <button
                             className="px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500"
                             onClick={() => { setDeleteErrorId(null); setConfirmDeleteId(d.document_id); }}
                           >
                             {tOr('common.retry', 'Retry')}
                           </button>
                           <button
                             className="px-2 py-1 rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500"
                             onClick={() => setDeleteErrorId(null)}
                             aria-label={tOr('common.dismiss', 'Dismiss')}
                           >
                             <X aria-hidden="true" size={14} />
                           </button>
                         </div>
                       ) : (
                         <button
-                          className="rounded-full p-2 text-[var(--workbench-muted)] transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
+                          className="rounded-full p-2 text-[var(--workbench-muted)] transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                           disabled={deletingId === d.document_id}
                           onClick={() => setConfirmDeleteId(d.document_id)}
                           title={t('doc.deleteDoc')}
                           aria-label="Delete document"
                         >
                           <Trash2 aria-hidden="true" size={16} />
                         </button>
                       )}
                     </div>
                   </div>
                 );
               })}
             </div>
           )}
         </div>
       </main>
     </div>
   );
 }
diff --git a/frontend/src/i18n/locales/en.json b/frontend/src/i18n/locales/en.json
index f8449bc..749fe6d 100644
--- a/frontend/src/i18n/locales/en.json
+++ b/frontend/src/i18n/locales/en.json
@@ -1047,161 +1047,161 @@
   "featuresMultilingual.faq.title": "Frequently Asked Questions",
   "featuresMultilingual.faq.q1": "Can I ask questions in a different language than the document?",
   "featuresMultilingual.faq.a1": "Yes. DocTalk supports cross-language analysis. Upload a document in one language and ask questions in another. The AI finds relevant passages regardless of language and responds in the language you write in.",
   "featuresMultilingual.faq.q2": "Does DocTalk support Chinese, Japanese, and Korean PDFs?",
   "featuresMultilingual.faq.a2": "Yes. DocTalk includes full CJK support with proper CMap and standard font rendering. Characters display correctly regardless of PDF encoding. Citation highlighting and semantic search work natively with CJK text.",
   "featuresMultilingual.faq.q3": "Which languages does the interface support?",
   "featuresMultilingual.faq.a3": "The entire DocTalk interface is available in 11 languages: English, Chinese (Simplified), Japanese, Spanish, German, French, Korean, Portuguese, Italian, Arabic, and Hindi. Switch anytime from the language selector.",
   "featuresMultilingual.faq.q4": "Is multilingual chat available on the free plan?",
   "featuresMultilingual.faq.a4": "Yes. All 11 languages are available on every plan, including the free tier with 300 credits per month. There is no language restriction on any plan.",
   "featuresMultilingual.cta.title": "Chat with Documents in Your Language",
   "featuresMultilingual.cta.subtitle": "Try the free demo to see multilingual document chat in action. Upload documents in any language and get AI answers with source citations.",
   "featuresMultilingual.cta.button": "Try the Free Demo",
   "featuresMultilingual.cta.linkMultiFormat": "Multi-Format Support",
   "featuresMultilingual.cta.linkVsChatPDF": "DocTalk vs ChatPDF",
   "featuresMultilingual.cta.linkVsNotebookLM": "DocTalk vs NotebookLM",
   "featuresPerformance.badge": "2 Modes",
   "featuresPerformance.hero.title": "Choose Your AI Performance Mode",
   "featuresPerformance.hero.subtitle": "DocTalk now offers two DeepSeek V4 modes: Flash for fast cited answers and Pro for deeper document analysis. Switch modes anytime, even mid-conversation.",
   "featuresPerformance.hero.cta": "Try It Free",
   "featuresPerformance.modes.title": "Two Modes, Two Jobs",
   "featuresPerformance.credits": "credits",
   "featuresPerformance.bestFor": "Best for:",
   "featuresPerformance.mode.quick.name": "Flash",
   "featuresPerformance.mode.quick.speed": "Fastest",
   "featuresPerformance.mode.quick.description": "Optimized for speed and efficiency. Use Flash for factual lookups, short summaries, and rapid document scanning when you want a cited answer quickly.",
   "featuresPerformance.mode.quick.bestFor1": "Factual lookups and definitions",
   "featuresPerformance.mode.quick.bestFor2": "Quick summaries of short sections",
   "featuresPerformance.mode.quick.bestFor3": "Yes/no questions with clear answers",
   "featuresPerformance.mode.quick.bestFor4": "Rapid document scanning",
   "featuresPerformance.mode.quick.availability": "All plans (Free, Plus, Pro)",
   "featuresPerformance.mode.balanced.name": "Pro",
   "featuresPerformance.mode.balanced.speed": "Deeper",
   "featuresPerformance.mode.balanced.description": "Powered by DeepSeek V4 Pro for more careful, detailed answers. Use Pro when nuance, comparison, and citation precision matter more than raw speed.",
   "featuresPerformance.mode.balanced.bestFor1": "General Q&A about document content",
   "featuresPerformance.mode.balanced.bestFor2": "Multi-paragraph explanations",
   "featuresPerformance.mode.balanced.bestFor3": "Comparing sections or data points",
   "featuresPerformance.mode.balanced.bestFor4": "Everyday research tasks",
   "featuresPerformance.mode.balanced.availability": "All plans (20/month on Free)",
   "featuresPerformance.mode.thorough.name": "Legacy Thorough",
   "featuresPerformance.mode.thorough.speed": "Retired",
   "featuresPerformance.mode.thorough.description": "Legacy mode retained only for historical usage records.",
   "featuresPerformance.mode.thorough.bestFor1": "Historical usage records",
   "featuresPerformance.mode.thorough.bestFor2": "Retired mode",
   "featuresPerformance.mode.thorough.bestFor3": "Not available for new chats",
   "featuresPerformance.mode.thorough.bestFor4": "Use Pro instead",
   "featuresPerformance.mode.thorough.availability": "Retired",
   "featuresPerformance.whenToUse.title": "When to Use Each Mode",
   "featuresPerformance.whenToUse.quick": "is your default for straightforward questions. Need a date, definition, clause, or simple summary? Flash returns a cited answer quickly and keeps the credit cost low.",
   "featuresPerformance.whenToUse.balanced": "is for deeper work. Use it when you want a detailed explanation, a summary with context, or an answer that connects multiple sections of the document.",
   "featuresPerformance.whenToUse.thorough": "is retired for new chats. Use Pro for deeper document analysis.",
   "featuresPerformance.whenToUse.switching": "You can switch modes between questions in the same conversation. Start with Flash to get your bearings, then switch to Pro when a topic needs more careful analysis. Each question is charged independently based on the mode used.",
   "featuresPerformance.faq.title": "Frequently Asked Questions",
   "featuresPerformance.faq.q1": "What is the difference between Flash and Pro modes?",
   "featuresPerformance.faq.a1": "Flash uses DeepSeek V4 Flash for fast cited answers. Pro uses DeepSeek V4 Pro for more careful, detailed document analysis. Both modes run with thinking disabled by default for interactive speed and predictable credits.",
   "featuresPerformance.faq.q2": "Can I switch modes during a conversation?",
   "featuresPerformance.faq.a2": "Yes. The mode selector in the header lets you switch at any time. Each message is charged based on the mode used for that specific question.",
   "featuresPerformance.faq.q3": "Is Pro mode available on the free plan?",
   "featuresPerformance.faq.a3": "Yes, with a monthly cap. Free accounts can use Flash mode plus up to 20 Pro answers per month with 300 credits per month. Plus and Pro remove the Pro-mode monthly cap.",
   "featuresPerformance.faq.q4": "Which mode should I use?",
   "featuresPerformance.faq.a4": "Start with Flash for simple lookups and factual questions. Use Pro for general Q&A, explanations, comparisons, and professional work where citation precision matters more than speed.",
   "featuresPerformance.cta.title": "Try Flash and Pro",
   "featuresPerformance.cta.subtitle": "The free demo uses Flash mode. Sign up free for Flash and up to 20 Pro answers per month, or upgrade to Plus for unrestricted Pro usage.",
   "featuresPerformance.cta.demoButton": "Try the Free Demo",
   "featuresPerformance.cta.pricingButton": "View Pricing",
   "featuresPerformance.cta.linkPricing": "Pricing",
   "featuresPerformance.cta.linkCitations": "Citation Highlighting",
   "featuresPerformance.cta.linkDemo": "Free Demo",
   "featuresDemo.badge": "No Signup Required",
   "featuresDemo.hero.title": "Try DocTalk Free — No Account Required",
   "featuresDemo.hero.subtitle": "Chat with AI about sample documents instantly. No account, no credit card, no email. See citation highlighting, multi-format support, and performance modes in action with 3 demo documents ready to explore.",
   "featuresDemo.hero.cta": "Launch Free Demo",
   "featuresDemo.instant.title": "Instant Demo — No Setup",
   "featuresDemo.instant.subtitle": "Three sample documents are pre-loaded and ready to chat with. Click any document, type a question, and see how DocTalk works in seconds.",
   "featuresDemo.docs.doc1.title": "Sample PDF",
   "featuresDemo.docs.doc1.description": "A real PDF document ready for AI analysis. Ask questions and see citation highlighting with page-level navigation.",
   "featuresDemo.docs.doc2.title": "Sample Report",
   "featuresDemo.docs.doc2.description": "Explore how DocTalk handles structured content like sections, headings, and data — with cited answers throughout.",
   "featuresDemo.docs.doc3.title": "Sample Document",
   "featuresDemo.docs.doc3.description": "A third demo file to try different question styles and see how the AI extracts information across formats.",
   "featuresDemo.whatYouGet.title": "What You Get in the Demo",
-  "featuresDemo.whatYouGet.item1.label": "5 messages per session",
+  "featuresDemo.whatYouGet.item1.label": "5 messages per sample document",
   "featuresDemo.whatYouGet.item1.description": "Enough to explore a document and test citation highlighting.",
   "featuresDemo.whatYouGet.item2.label": "Citation highlighting",
   "featuresDemo.whatYouGet.item2.description": "Click any numbered citation to jump to the source text.",
   "featuresDemo.whatYouGet.item3.label": "AI-powered answers",
   "featuresDemo.whatYouGet.item3.description": "Powered by DeepSeek V4 Flash in demo mode for fast responses.",
   "featuresDemo.whatYouGet.item4.label": "Full feature preview",
   "featuresDemo.whatYouGet.item4.description": "See the document viewer, chat panel, and citation navigation.",
   "featuresDemo.compare.title": "Demo vs Free Plan vs Paid Plans",
   "featuresDemo.compare.subtitle": "The demo is a preview. Free accounts unlock your own uploads. Paid plans unlock more credits and features.",
   "featuresDemo.compare.featureCol": "Feature",
   "featuresDemo.compare.demoCol": "Demo",
   "featuresDemo.compare.freeCol": "Free",
   "featuresDemo.compare.plusCol": "Plus $9.99/mo",
   "featuresDemo.compare.proCol": "Pro $19.99/mo",
   "featuresDemo.compare.monthlyCredits": "Monthly credits",
   "featuresDemo.compare.fiveMsgs": "5 msgs",
   "featuresDemo.compare.uploadOwn": "Upload own documents",
   "featuresDemo.compare.citationHighlighting": "Citation highlighting",
   "featuresDemo.compare.quickBalanced": "Flash + limited Pro modes",
   "featuresDemo.compare.quickOnly": "Flash only",
   "featuresDemo.compare.thoroughMode": "Unrestricted Pro mode",
   "featuresDemo.compare.export": "Export",
   "featuresDemo.compare.customInstructions": "Custom Instructions",
   "featuresDemo.compare.signupRequired": "Signup required",
   "featuresDemo.steps.title": "How to Get Started",
   "featuresDemo.steps.step1.title": "Click the demo link",
   "featuresDemo.steps.step1.description": "Go to the demo page — no account, no email, nothing to fill in.",
   "featuresDemo.steps.step2.title": "Choose a document",
   "featuresDemo.steps.step2.description": "Pick one of the 3 pre-loaded sample documents to explore.",
   "featuresDemo.steps.step3.title": "Ask a question",
   "featuresDemo.steps.step3.description": "Type any question about the document in the chat panel.",
   "featuresDemo.steps.step4.title": "Click a citation",
   "featuresDemo.steps.step4.description": "Click any numbered citation to jump to the highlighted source text.",
   "featuresDemo.faq.title": "Frequently Asked Questions",
   "featuresDemo.faq.q1": "Is it really free?",
   "featuresDemo.faq.a1": "Yes. The demo is completely free. No credit card, no account, no email. Just click and start chatting with AI about the sample documents. If you want to upload your own documents, the free plan gives you 300 credits per month — also with no credit card required.",
   "featuresDemo.faq.q2": "Do I need an account?",
   "featuresDemo.faq.a2": "Not for the demo. The demo works instantly without any registration. To upload your own documents and save your chat history, you will need a free account, which you can create with Google, Microsoft, or email.",
   "featuresDemo.faq.q3": "What happens after the demo?",
   "featuresDemo.faq.a3": "Nothing happens automatically. You can use the demo as many times as you want. When you are ready to upload your own documents, create a free account (300 credits/month) or upgrade to Plus ($9.99/month, 3,000 credits) or Pro ($19.99/month, 9,000 credits).",
   "featuresDemo.faq.q4": "Can I upload my own documents for free?",
   "featuresDemo.faq.a4": "Yes. Create a free account (no credit card needed) and you can upload up to 3 documents (50MB each) with 300 credits per month. That is enough for dozens of questions using Flash mode.",
   "featuresDemo.faq.q5": "How many credits do I get?",
   "featuresDemo.faq.a5": "The demo does not use credits. Once you have an account, the free plan includes 300 credits per month. Flash is optimized for lower-cost questions, and Pro uses more credits for deeper analysis. Plus ($9.99) gives you 3,000 credits and Pro ($19.99) gives you 9,000.",
   "featuresDemo.cta.title": "Ready to Try It?",
   "featuresDemo.cta.subtitle": "No signup. No credit card. Just click and start chatting with AI about real documents.",
   "featuresDemo.cta.button": "Launch Free Demo",
   "featuresDemo.cta.linkPricing": "View Pricing",
   "featuresDemo.cta.linkCitations": "Citation Highlighting",
   "featuresDemo.cta.linkMultiFormat": "Multi-Format Support",
   "featuresHub.heroTitle": "DocTalk Features",
   "featuresHub.heroSubtitle": "Upload any document, ask questions in natural language, and get AI-powered answers with source citations you can verify. Explore the features that make DocTalk the most transparent AI document tool.",
   "featuresHub.citationsTitle": "Citation Highlighting",
   "featuresHub.citationsDesc": "Every AI answer includes numbered citations. Click any citation to jump to the exact source text, highlighted in your document.",
   "featuresHub.multiFormatTitle": "Multi-Format Support",
   "featuresHub.multiFormatDesc": "Upload PDF, DOCX, PPTX, XLSX, TXT, Markdown, or any URL. Chat with any document format using AI.",
   "featuresHub.multilingualTitle": "11 Languages",
   "featuresHub.multilingualDesc": "Chat with documents in English, Chinese, Japanese, Spanish, German, French, Korean, Portuguese, Italian, Arabic, and Hindi.",
   "featuresHub.layoutTranslationTitle": "Layout-preserving PDF translation",
   "featuresHub.layoutTranslationDesc": "Translate text-heavy PDFs into a new PDF while preserving page structure, citations, equations, and visual context. Free includes 2 trials; Plus unlocks ongoing use.",
   "featuresHub.freeDemoTitle": "Free Demo",
   "featuresHub.freeDemoDesc": "Try AI document chat instantly. No signup, no credit card. 3 sample documents ready to explore.",
   "featuresHub.performanceModesTitle": "2 performance modes",
   "featuresHub.performanceModesDesc": "Flash for fast answers, Pro for deeper document analysis. Choose the right speed and depth.",
   "featuresHub.workflowsTitle": "Pair these features with real workflows",
   "featuresHub.workflowsDesc": "DocTalk works best when you connect product capabilities to an actual job: research, legal review, finance analysis, or tool evaluation.",
   "featuresHub.linkStudents": "Students & Academics",
   "featuresHub.linkLawyers": "Legal Professionals",
   "featuresHub.linkFinance": "Financial Analysts",
   "featuresHub.linkVsChatPDF": "DocTalk vs ChatPDF",
   "featuresHub.linkComparisons": "Comparison guides",
   "featuresHub.ctaText": "See it all in action with the free demo — no account required.",
   "featuresHub.ctaButton": "Try the Free Demo",
   "featuresLayoutTranslation.eyebrow": "Plus workflow",
   "featuresLayoutTranslation.heroTitle": "Layout-preserving PDF translation",
   "featuresLayoutTranslation.heroSubtitle": "Turn text-heavy PDFs into translated PDFs while keeping page structure, equations, citations, and visual context.",
   "featuresLayoutTranslation.card1Title": "Reads scanned and complex PDFs",
   "featuresLayoutTranslation.card1Body": "The workflow runs OCR before translation, so image-heavy academic papers and reports can still be processed.",
   "featuresLayoutTranslation.card2Title": "Translates with layout context",
   "featuresLayoutTranslation.card2Body": "Body text, equations, code-like blocks, and citations are translated with layout context instead of a plain text dump.",
diff --git a/frontend/src/i18n/locales/fr.json b/frontend/src/i18n/locales/fr.json
index 60b9f23..e4a9880 100644
--- a/frontend/src/i18n/locales/fr.json
+++ b/frontend/src/i18n/locales/fr.json
@@ -1040,161 +1040,161 @@
   "featuresMultilingual.faq.title": "Questions fréquentes",
   "featuresMultilingual.faq.q1": "Puis-je poser des questions dans une langue différente de celle du document ?",
   "featuresMultilingual.faq.a1": "Oui. DocTalk supporte l'analyse inter-langues. Téléchargez un document dans une langue et posez des questions dans une autre. L'IA comprend les deux et fournit des réponses citées.",
   "featuresMultilingual.faq.q2": "DocTalk prend-il en charge les PDF chinois, japonais et coréens ?",
   "featuresMultilingual.faq.a2": "Oui. DocTalk inclut un support CJK complet avec un rendu CMap et de polices standard approprié. Les caractères s'affichent correctement dans le visualiseur de documents.",
   "featuresMultilingual.faq.q3": "Quelles langues l'interface prend-elle en charge ?",
   "featuresMultilingual.faq.a3": "L'ensemble de l'interface DocTalk est disponible en 11 langues : anglais, chinois (simplifié), japonais, espagnol, allemand, français, coréen, portugais, italien, arabe et hindi.",
   "featuresMultilingual.faq.q4": "Le chat multilingue est-il disponible sur le plan gratuit ?",
   "featuresMultilingual.faq.a4": "Oui. Les 11 langues sont disponibles sur tous les plans, y compris le niveau gratuit avec 300 crédits par mois.",
   "featuresMultilingual.cta.title": "Discutez avec des documents dans votre langue",
   "featuresMultilingual.cta.subtitle": "Essayez la démo gratuite pour voir le chat documentaire multilingue en action. Téléchargez des documents dans n'importe quelle langue et obtenez des réponses citées.",
   "featuresMultilingual.cta.button": "Essayer la démo gratuite",
   "featuresMultilingual.cta.linkMultiFormat": "Prise en charge multiformat",
   "featuresMultilingual.cta.linkVsChatPDF": "DocTalk vs ChatPDF",
   "featuresMultilingual.cta.linkVsNotebookLM": "DocTalk vs NotebookLM",
   "featuresPerformance.badge": "2 modes",
   "featuresPerformance.hero.title": "Choisissez votre mode de performance IA",
   "featuresPerformance.hero.subtitle": "DocTalk propose désormais deux modes DeepSeek V4 : Flash pour des réponses citées rapides et Pro pour une analyse approfondie des documents. Changez de mode à tout moment, même en cours de conversation.",
   "featuresPerformance.hero.cta": "Essai gratuit",
   "featuresPerformance.modes.title": "Deux modes, deux utilisations",
   "featuresPerformance.credits": "crédits",
   "featuresPerformance.bestFor": "Idéal pour :",
   "featuresPerformance.mode.quick.name": "Flash",
   "featuresPerformance.mode.quick.speed": "Le plus rapide",
   "featuresPerformance.mode.quick.description": "Optimisé pour la vitesse et l'efficacité. Utilisez Flash pour des recherches factuelles, des résumés courts et une analyse rapide de documents lorsque vous voulez une réponse citée rapidement.",
   "featuresPerformance.mode.quick.bestFor1": "Recherches factuelles et définitions",
   "featuresPerformance.mode.quick.bestFor2": "Résumés rapides de courtes sections",
   "featuresPerformance.mode.quick.bestFor3": "Questions oui/non avec des réponses claires",
   "featuresPerformance.mode.quick.bestFor4": "Analyse rapide de documents",
   "featuresPerformance.mode.quick.availability": "Tous les plans (Free, Plus, Pro)",
   "featuresPerformance.mode.balanced.name": "Pro",
   "featuresPerformance.mode.balanced.speed": "Plus approfondi",
   "featuresPerformance.mode.balanced.description": "Propulsé par DeepSeek V4 Pro pour des réponses plus soignées et détaillées. Utilisez Pro lorsque la nuance, la comparaison et la précision des citations comptent plus que la vitesse brute.",
   "featuresPerformance.mode.balanced.bestFor1": "Questions-réponses générales sur le contenu des documents",
   "featuresPerformance.mode.balanced.bestFor2": "Explications multi-paragraphes",
   "featuresPerformance.mode.balanced.bestFor3": "Comparaison de sections ou de points de données",
   "featuresPerformance.mode.balanced.bestFor4": "Tâches de recherche quotidiennes",
   "featuresPerformance.mode.balanced.availability": "Tous les plans (20/mois sur Free)",
   "featuresPerformance.mode.thorough.name": "Legacy Thorough",
   "featuresPerformance.mode.thorough.speed": "Retiré",
   "featuresPerformance.mode.thorough.description": "Mode hérité conservé uniquement pour l'historique d'utilisation.",
   "featuresPerformance.mode.thorough.bestFor1": "Historique d'utilisation",
   "featuresPerformance.mode.thorough.bestFor2": "Mode retiré",
   "featuresPerformance.mode.thorough.bestFor3": "Non disponible pour les nouvelles conversations",
   "featuresPerformance.mode.thorough.bestFor4": "Utilisez Pro à la place",
   "featuresPerformance.mode.thorough.availability": "Retiré",
   "featuresPerformance.whenToUse.title": "Quand utiliser chaque mode",
   "featuresPerformance.whenToUse.quick": "est votre mode par défaut pour les questions simples. Besoin d'une date, d'une définition, d'une clause ou d'un résumé simple ? Flash renvoie rapidement une réponse citée et maintient un faible coût en crédits.",
   "featuresPerformance.whenToUse.balanced": "est pour un travail plus approfondi. Utilisez-le lorsque vous souhaitez une explication détaillée, un résumé avec contexte ou une réponse qui relie plusieurs sections du document.",
   "featuresPerformance.whenToUse.thorough": "est retiré pour les nouvelles conversations. Utilisez Pro pour une analyse approfondie des documents.",
   "featuresPerformance.whenToUse.switching": "Vous pouvez changer de mode entre les questions dans la même conversation. Commencez par Flash pour vous orienter, puis passez à Pro lorsqu'un sujet nécessite une analyse plus approfondie. Chaque question est facturée indépendamment selon le mode utilisé.",
   "featuresPerformance.faq.title": "Questions fréquentes",
   "featuresPerformance.faq.q1": "Quelle est la différence entre les modes Flash et Pro ?",
   "featuresPerformance.faq.a1": "Flash utilise DeepSeek V4 Flash pour des réponses rapides avec citations. Pro utilise DeepSeek V4 Pro pour une analyse de documents plus minutieuse et détaillée. Les deux modes fonctionnent avec la réflexion désactivée par défaut pour une vitesse interactive et des crédits prévisibles.",
   "featuresPerformance.faq.q2": "Puis-je changer de mode en cours de conversation ?",
   "featuresPerformance.faq.a2": "Oui. Le sélecteur de mode dans l'en-tête vous permet de changer à tout moment. Chaque message est facturé en fonction du mode utilisé pour cette question spécifique.",
   "featuresPerformance.faq.q3": "Le mode Pro est-il disponible dans l'offre gratuite ?",
   "featuresPerformance.faq.a3": "Oui, avec un plafond mensuel. Les comptes gratuits peuvent utiliser le mode Flash et jusqu'à 20 réponses Pro par mois avec 300 crédits par mois. Les offres Plus et Pro suppriment le plafond mensuel du mode Pro.",
   "featuresPerformance.faq.q4": "Quel mode dois-je utiliser ?",
   "featuresPerformance.faq.a4": "Commencez par Flash pour les recherches simples et les questions factuelles. Utilisez Pro pour les questions-réponses générales, les explications, les comparaisons et le travail professionnel où la précision des citations importe plus que la vitesse.",
   "featuresPerformance.cta.title": "Essayez Flash et Pro",
   "featuresPerformance.cta.subtitle": "La démo gratuite utilise le mode Flash. Inscrivez-vous gratuitement pour le mode Flash et jusqu’à 20 réponses Pro par mois, ou passez à Plus pour une utilisation illimitée de Pro.",
   "featuresPerformance.cta.demoButton": "Essayer la démo gratuite",
   "featuresPerformance.cta.pricingButton": "Voir les tarifs",
   "featuresPerformance.cta.linkPricing": "Tarifs",
   "featuresPerformance.cta.linkCitations": "Surlignage des citations",
   "featuresPerformance.cta.linkDemo": "Démo gratuite",
   "featuresDemo.badge": "Sans inscription",
   "featuresDemo.hero.title": "Essayez DocTalk gratuitement — Aucun compte requis",
   "featuresDemo.hero.subtitle": "Discutez avec l'IA sur des exemples de documents instantanément. Pas de compte, pas de carte de crédit, pas d'email. Voyez le surlignage des citations en temps réel.",
   "featuresDemo.hero.cta": "Lancer la démo gratuite",
   "featuresDemo.instant.title": "Démo instantanée — Aucune configuration",
   "featuresDemo.instant.subtitle": "Trois exemples de documents sont pré-chargés et prêts à être utilisés. Cliquez sur un document, tapez une question et obtenez une réponse citée en quelques secondes.",
   "featuresDemo.docs.doc1.title": "Exemple de PDF",
   "featuresDemo.docs.doc1.description": "Un vrai document PDF prêt pour l'analyse IA. Posez des questions et voyez le surlignage des citations avec des références au niveau de la page.",
   "featuresDemo.docs.doc2.title": "Exemple de rapport",
   "featuresDemo.docs.doc2.description": "Explorez comment DocTalk gère le contenu structuré comme les sections, les titres et les données — avec des réponses citées.",
   "featuresDemo.docs.doc3.title": "Exemple de document",
   "featuresDemo.docs.doc3.description": "Un troisième fichier de démo pour essayer différents styles de questions et voir comment l'IA extrait l'information de différents formats.",
   "featuresDemo.whatYouGet.title": "Ce que vous obtenez dans la démo",
-  "featuresDemo.whatYouGet.item1.label": "5 messages par session",
+  "featuresDemo.whatYouGet.item1.label": "5 messages par document d'exemple",
   "featuresDemo.whatYouGet.item1.description": "Suffisant pour explorer un document et tester le surlignage des citations.",
   "featuresDemo.whatYouGet.item2.label": "Surlignage des citations",
   "featuresDemo.whatYouGet.item2.description": "Cliquez sur n'importe quelle citation numérotée pour accéder au texte source.",
   "featuresDemo.whatYouGet.item3.label": "Réponses IA",
   "featuresDemo.whatYouGet.item3.description": "Propulsé par DeepSeek V4 Flash en mode démo pour des réponses rapides.",
   "featuresDemo.whatYouGet.item4.label": "Aperçu complet des fonctionnalités",
   "featuresDemo.whatYouGet.item4.description": "Voyez le visualiseur de documents, le panneau de chat et la navigation par citations.",
   "featuresDemo.compare.title": "Démo vs Plan gratuit vs Plans payants",
   "featuresDemo.compare.subtitle": "La démo est un aperçu. Les comptes gratuits débloquent vos propres téléchargements. Les plans payants offrent plus de crédits et de fonctionnalités.",
   "featuresDemo.compare.featureCol": "Fonctionnalité",
   "featuresDemo.compare.demoCol": "Démo",
   "featuresDemo.compare.freeCol": "Gratuit",
   "featuresDemo.compare.plusCol": "Plus $9.99/mois",
   "featuresDemo.compare.proCol": "Pro $19.99/mois",
   "featuresDemo.compare.monthlyCredits": "Crédits mensuels",
   "featuresDemo.compare.fiveMsgs": "5 messages",
   "featuresDemo.compare.uploadOwn": "Télécharger ses propres documents",
   "featuresDemo.compare.citationHighlighting": "Surlignage des citations",
   "featuresDemo.compare.quickBalanced": "Flash + modes Pro limités",
   "featuresDemo.compare.quickOnly": "Flash uniquement",
   "featuresDemo.compare.thoroughMode": "Mode Pro illimité",
   "featuresDemo.compare.export": "Exporter",
   "featuresDemo.compare.customInstructions": "Instructions personnalisées",
   "featuresDemo.compare.signupRequired": "Inscription requise",
   "featuresDemo.steps.title": "Comment commencer",
   "featuresDemo.steps.step1.title": "Cliquez sur le lien de la démo",
   "featuresDemo.steps.step1.description": "Allez sur la page de démo — pas de compte, pas d'email, rien à remplir.",
   "featuresDemo.steps.step2.title": "Choisissez un document",
   "featuresDemo.steps.step2.description": "Choisissez l'un des 3 exemples de documents pré-chargés à explorer.",
   "featuresDemo.steps.step3.title": "Posez une question",
   "featuresDemo.steps.step3.description": "Tapez n'importe quelle question sur le document dans le panneau de chat.",
   "featuresDemo.steps.step4.title": "Cliquez sur une citation",
   "featuresDemo.steps.step4.description": "Cliquez sur n'importe quelle citation numérotée pour accéder au texte source surligné.",
   "featuresDemo.faq.title": "Questions fréquentes",
   "featuresDemo.faq.q1": "Est-ce vraiment gratuit ?",
   "featuresDemo.faq.a1": "Oui. La démo est entièrement gratuite. Pas de carte de crédit, pas de compte, pas d'email. Cliquez et commencez à discuter avec les exemples de documents.",
   "featuresDemo.faq.q2": "Ai-je besoin d'un compte ?",
   "featuresDemo.faq.a2": "Pas pour la démo. La démo fonctionne instantanément sans aucune inscription. Pour télécharger vos propres documents et obtenir 300 crédits mensuels, créez un compte gratuit.",
   "featuresDemo.faq.q3": "Que se passe-t-il après la démo ?",
   "featuresDemo.faq.a3": "Rien ne se passe automatiquement. Vous pouvez utiliser la démo autant de fois que vous le souhaitez. Quand vous êtes prêt, créez un compte gratuit pour télécharger vos propres documents.",
   "featuresDemo.faq.q4": "Puis-je télécharger mes propres documents gratuitement ?",
   "featuresDemo.faq.a4": "Oui. Créez un compte gratuit (sans carte bancaire) et vous pouvez télécharger jusqu’à 3 documents (50 Mo chacun) avec 300 crédits par mois. Cela suffit pour des dizaines de questions en mode Flash.",
   "featuresDemo.faq.q5": "Combien de crédits ai-je ?",
   "featuresDemo.faq.a5": "La démo n’utilise pas de crédits. Une fois que vous avez un compte, le plan gratuit inclut 300 crédits par mois. Flash est optimisé pour des questions à moindre coût, et Pro utilise plus de crédits pour une analyse approfondie. Plus (9,99 $) vous donne 3 000 crédits et Pro (19,99 $) vous donne 9 000.",
   "featuresDemo.cta.title": "Prêt à essayer ?",
   "featuresDemo.cta.subtitle": "Sans inscription. Sans carte de crédit. Cliquez et commencez à discuter avec l'IA sur de vrais documents.",
   "featuresDemo.cta.button": "Lancer la démo gratuite",
   "featuresDemo.cta.linkPricing": "Voir les tarifs",
   "featuresDemo.cta.linkCitations": "Surlignage des citations",
   "featuresDemo.cta.linkMultiFormat": "Prise en charge multiformat",
   "featuresHub.heroTitle": "Fonctionnalités de DocTalk",
   "featuresHub.heroSubtitle": "Téléchargez n'importe quel document, posez des questions en langage naturel et obtenez des réponses IA avec des citations sources que vous pouvez vérifier en un clic.",
   "featuresHub.citationsTitle": "Mise en évidence des citations",
   "featuresHub.citationsDesc": "Chaque réponse IA inclut des citations numérotées. Cliquez sur n'importe quelle citation pour accéder au texte source exact, surligné dans le document original.",
   "featuresHub.multiFormatTitle": "Prise en charge multiformat",
   "featuresHub.multiFormatDesc": "Téléchargez des PDF, DOCX, PPTX, XLSX, TXT, Markdown ou n'importe quelle URL. Discutez avec n'importe quel format de document grâce à l'IA.",
   "featuresHub.multilingualTitle": "11 langues",
   "featuresHub.multilingualDesc": "Discutez avec des documents en anglais, chinois, japonais, espagnol, allemand, français, coréen, portugais, italien, arabe et hindi.",
   "featuresHub.layoutTranslationTitle": "Traduction de PDF avec mise en page préservée",
   "featuresHub.layoutTranslationDesc": "Traduisez les PDF riches en texte en un nouveau PDF tout en conservant structure de page, citations, équations et contexte visuel. Le gratuit inclut 2 essais ; Plus débloque l’usage continu.",
   "featuresHub.freeDemoTitle": "Démo gratuite",
   "featuresHub.freeDemoDesc": "Essayez le chat documentaire IA instantanément. Sans inscription, sans carte de crédit. 3 exemples de documents prêts à explorer.",
   "featuresHub.performanceModesTitle": "2 modes de performance",
   "featuresHub.performanceModesDesc": "Flash pour des réponses rapides, Pro pour une analyse approfondie des documents. Choisissez la vitesse et la profondeur adaptées.",
   "featuresHub.workflowsTitle": "Associez ces fonctionnalités à de vrais flux de travail",
   "featuresHub.workflowsDesc": "DocTalk fonctionne mieux lorsque vous reliez les capacités du produit à un vrai travail : recherche, révision juridique, finance ou RH.",
   "featuresHub.linkStudents": "Étudiants et universitaires",
   "featuresHub.linkLawyers": "Professionnels du droit",
   "featuresHub.linkFinance": "Analystes financiers",
   "featuresHub.linkVsChatPDF": "DocTalk vs ChatPDF",
   "featuresHub.linkComparisons": "Guides de comparaison",
   "featuresHub.ctaText": "Voyez tout en action avec la démo gratuite — aucun compte requis.",
   "featuresHub.ctaButton": "Essayer la démo gratuite",
   "featuresLayoutTranslation.eyebrow": "Workflow Plus",
   "featuresLayoutTranslation.heroTitle": "Traduction de PDF avec mise en page préservée",
   "featuresLayoutTranslation.heroSubtitle": "Transformez les PDF riches en texte en PDF traduits tout en gardant structure de page, équations, citations et contexte visuel.",
   "featuresLayoutTranslation.card1Title": "Lit les PDF scannés et complexes",
   "featuresLayoutTranslation.card1Body": "Le workflow exécute l’OCR avant la traduction, afin de traiter aussi les articles et rapports riches en images.",
   "featuresLayoutTranslation.card2Title": "Traduit avec le contexte de mise en page",
   "featuresLayoutTranslation.card2Body": "Le texte, les équations, les blocs de type code et les citations sont traduits avec le contexte de mise en page, pas comme un simple export texte.",
diff --git a/frontend/src/i18n/routing.ts b/frontend/src/i18n/routing.ts
index e149cdf..f4b7765 100644
--- a/frontend/src/i18n/routing.ts
+++ b/frontend/src/i18n/routing.ts
@@ -1,112 +1,113 @@
 /**
  * Locale URL routing helpers — framework-neutral (safe in both server and
  * client components; no "use client", no server-only imports).
  *
  * International-SEO model (see .collab/plans/2026-05-24-international-seo-locale-urls-spec.md):
  *   - English is the DEFAULT and lives at the root with NO prefix (`/use-cases/lawyers`).
  *     Keeping English unprefixed means existing URLs/rankings need no 301s.
  *   - Every translated marketing locale below gets a subdirectory prefix
  *     (`/de/use-cases/lawyers`) with server-rendered translated HTML, so search
  *     engines and users see one coherent language per URL.
  */
 
 // Locales that have crawlable, server-rendered marketing URLs (en is the unprefixed default).
 export const URL_LOCALES = ['zh', 'ja', 'es', 'ko', 'de', 'fr', 'pt', 'it', 'ar', 'hi'] as const;
 export type UrlLocale = (typeof URL_LOCALES)[number];
 
 // All locales that participate in hreflang (the unprefixed default + the prefixed set).
 export const MARKETING_LOCALES = ['en', ...URL_LOCALES] as const;
 
 export function isUrlLocale(value: string | undefined | null): value is UrlLocale {
   return !!value && (URL_LOCALES as readonly string[]).includes(value);
 }
 
 /**
  * Locale-agnostic marketing paths that actually have server-rendered locale
  * variants under `app/[locale]/...`. This is the single source of truth that
  * keeps links/hreflang/sitemap honest — a path is only ever prefixed once its
  * localized page exists, so we never emit a `/de/...` link that 404s.
  * Grows as pages are localized (Phase A: lawyers only).
  */
 export const LOCALIZED_PATHS: ReadonlySet<string> = new Set<string>([
   '/',
+  '/demo',
   '/use-cases/lawyers',
   '/use-cases/finance',
   '/use-cases/students',
   '/use-cases/teachers',
   '/use-cases/consultants',
   '/use-cases/healthcare',
   '/use-cases/hr-contracts',
   '/use-cases/real-estate',
   '/use-cases/compliance',
   '/features/citations',
   '/features/free-demo',
   '/features/layout-translation',
   '/features/multi-format',
   '/features/multilingual',
   '/features/performance-modes',
   '/compare/askyourpdf',
   '/compare/chatpdf',
   '/compare/humata',
   '/compare/notebooklm',
   '/compare/pdf-ai',
   '/alternatives/askyourpdf',
   '/alternatives/chatpdf',
   '/alternatives/humata',
   '/alternatives/notebooklm',
   '/alternatives/pdf-ai',
   '/use-cases',
   '/compare',
   '/alternatives',
   '/features',
   '/tools',
   '/trust',
   '/pricing',
 ]);
 
 /** Normalize a path for matching: drop query/hash and a single trailing slash (except root). */
 function normalizePath(path: string): string {
   const clean = (path.startsWith('/') ? path : `/${path}`).split(/[?#]/)[0];
   return clean.length > 1 && clean.endsWith('/') ? clean.slice(0, -1) : clean;
 }
 
 export function isLocalizedPath(path: string): boolean {
   return LOCALIZED_PATHS.has(normalizePath(path));
 }
 
 /**
  * Prefix a locale-agnostic path for a given locale.
  * `en` (or any non-URL locale) returns the path unchanged, so English output is byte-stable.
  *   localizedHref('de', '/use-cases/lawyers') -> '/de/use-cases/lawyers'
  *   localizedHref('de', '/')                  -> '/de'
  *   localizedHref('en', '/pricing')           -> '/pricing'
  */
 export function localizedHref(locale: string, path: string): string {
   const clean = path.startsWith('/') ? path : `/${path}`;
   if (!isUrlLocale(locale)) return clean;
   if (clean === '/') return `/${locale}`;
   return `/${locale}${clean}`;
 }
 
 /**
  * Like `localizedHref`, but only prefixes paths that actually have a localized
  * page (`LOCALIZED_PATHS`). Use this for links/CTAs that may point at pages not
  * yet localized — they stay on the English URL instead of 404ing.
  */
 export function localizedHrefIfAvailable(locale: string, path: string): string {
   const clean = path.startsWith('/') ? path : `/${path}`;
   return isLocalizedPath(clean) ? localizedHref(locale, normalizePath(clean)) : clean;
 }
 
 /**
  * Split a known locale prefix off a pathname.
  *   '/de/use-cases/lawyers' -> { locale: 'de', path: '/use-cases/lawyers' }
  *   '/use-cases/lawyers'    -> { locale: 'en', path: '/use-cases/lawyers' }
  *   '/de'                   -> { locale: 'de', path: '/' }
  */
 export function splitLocaleFromPath(pathname: string): { locale: string; path: string } {
   const clean = normalizePath(pathname || '/');
   const m = clean.match(/^\/([a-z]{2})(\/.*)?$/);
   if (m && isUrlLocale(m[1])) {
     return { locale: m[1], path: m[2] && m[2].length > 0 ? m[2] : '/' };
   }
diff --git a/frontend/src/lib/api.ts b/frontend/src/lib/api.ts
index e768058..4e826be 100644
--- a/frontend/src/lib/api.ts
+++ b/frontend/src/lib/api.ts
@@ -87,185 +87,185 @@ export function mapCitationPayload(c: any): Citation {
 
 export function mapArtifactPayload(raw: any): ChatArtifact {
   const citations = Array.isArray(raw?.citations) ? raw.citations.map(mapCitationPayload) : [];
   return {
     artifactType: raw?.artifact_type ?? raw?.artifactType ?? 'artifact',
     status: raw?.status ?? 'queued',
     jobId: raw?.job_id ?? raw?.jobId ?? null,
     title: raw?.title ?? 'Artifact',
     summary: raw?.summary ?? '',
     preview: raw?.preview,
     downloadUrls: Array.isArray(raw?.download_urls) ? raw.download_urls : (Array.isArray(raw?.downloadUrls) ? raw.downloadUrls : []),
     citations,
     warning: raw?.warning ?? null,
     requiredPlan: raw?.required_plan ?? raw?.requiredPlan ?? null,
   };
 }
 
 export interface DocumentBrief {
   id: string;
   filename: string;
   status: string;
   created_at: string | null;
 }
 
 export async function getMyDocuments(signal?: AbortSignal): Promise<DocumentBrief[]> {
   const res = await fetch(`${PROXY_BASE}/api/documents`, { signal });
   if (!res.ok) {
     if (res.status === 401) return [];
     throw new Error(`Failed to fetch documents: ${res.status}`);
   }
   return res.json();
 }
 
 export async function uploadDocument(file: File): Promise<{ document_id: string; status: string; filename?: string }>
 {
   // Uploads bypass the Vercel proxy to avoid the 4.5MB serverless body limit.
   // 1. Obtain a short-lived backend JWT via the lightweight /api/upload-token endpoint
   // 2. POST the file directly to the Railway backend with that JWT
   const tokenRes = await fetch('/api/upload-token');
   if (!tokenRes.ok) await throwApiError(tokenRes);
   const { token } = await tokenRes.json();
 
   const form = new FormData();
   form.append('file', file);
   const res = await fetch(`${API_BASE}/api/documents/upload`, {
     method: 'POST',
     headers: { 'Authorization': `Bearer ${token}` },
     body: form,
   });
   return handle(res);
 }
 
 export async function getDocument(docId: string): Promise<DocumentResponse> {
   const res = await fetch(`${PROXY_BASE}/api/documents/${docId}`);
   return handle(res);
 }
 
 export async function getDocumentBrief(docId: string): Promise<DocumentHierarchicalBrief> {
   const res = await fetch(`${PROXY_BASE}/api/documents/${docId}/brief`);
   return handle(res);
 }
 
 export async function getDocumentFileUrl(docId: string): Promise<{ url: string; expires_in: number }> {
   const res = await fetch(`${PROXY_BASE}/api/documents/${docId}/file-url`);
   return handle(res);
 }
 
 export async function getConvertedFileUrl(docId: string): Promise<{ url: string; expires_in: number }> {
   const res = await fetch(`${PROXY_BASE}/api/documents/${docId}/file-url?variant=converted`);
   return handle(res);
 }
 
 export async function createSession(docId: string): Promise<{ session_id: string; document_id: string; title: string | null; created_at: string; demo_messages_used?: number }>
 {
   const res = await fetch(`${PROXY_BASE}/api/documents/${docId}/sessions`, {
     method: 'POST',
   });
   return handle(res);
 }
 
-export async function getMessages(sessionId: string): Promise<{ messages: Message[] }> {
+export async function getMessages(sessionId: string): Promise<{ messages: Message[]; demo_messages_used?: number | null }> {
   const res = await fetch(`${PROXY_BASE}/api/sessions/${sessionId}/messages`);
-  const data: { messages: Array<{ id?: string; share_anchor?: string; role: Message['role']; content: string; citations?: any[]; metadata_json?: any; created_at: string }> } = await handle(res);
+  const data: { messages: Array<{ id?: string; share_anchor?: string; role: Message['role']; content: string; citations?: any[]; metadata_json?: any; created_at: string }>; demo_messages_used?: number | null } = await handle(res);
 
   const mapped = (data.messages || []).map((m, idx) => {
     const citations: Citation[] | undefined = m.citations
       ? m.citations.map(mapCitationPayload)
       : undefined;
     const artifacts = Array.isArray(m.metadata_json?.artifacts)
       ? m.metadata_json.artifacts.map(mapArtifactPayload)
       : undefined;
 
     return {
       id: m.id ? `msg_${m.id}` : `msg_${idx}`,
       role: m.role,
       text: m.content,
       citations,
       artifacts,
       createdAt: Date.parse(m.created_at),
       backendId: m.id,
       shareAnchor: m.share_anchor,
     } as Message;
   });
 
-  return { messages: mapped };
+  return { messages: mapped, demo_messages_used: data.demo_messages_used };
 }
 
 export interface DocumentJobDetail {
   id: string;
   document_id: string | null;
   collection_id: string | null;
   job_type: string;
   status: string;
   artifact: ChatArtifact;
 }
 
 export async function getDocumentJob(jobId: string): Promise<DocumentJobDetail> {
   const res = await fetch(`${PROXY_BASE}/api/document-jobs/${jobId}`);
   const data: any = await handle(res);
   return {
     ...data,
     artifact: mapArtifactPayload(data.artifact),
   };
 }
 
 export async function createLayoutTranslation(params: {
   documentId: string;
   targetLanguage?: string;
   locale?: string;
   addToLibrary?: boolean;
 }): Promise<DocumentJobDetail> {
   const res = await fetch(`${PROXY_BASE}/api/documents/${params.documentId}/layout-translation`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       target_language: params.targetLanguage || 'zh-CN',
       locale: params.locale || null,
       add_to_library: Boolean(params.addToLibrary),
     }),
   });
   const data: any = await handle(res);
   return {
     ...data,
     artifact: mapArtifactPayload(data.artifact),
   };
 }
 
 export interface LayoutTranslationImportResponse {
   document_id: string;
   status: string;
   filename: string;
   existing: boolean;
 }
 
 export async function importLayoutTranslationDocument(jobId: string, locale?: string | null): Promise<LayoutTranslationImportResponse> {
   const res = await fetch(`${PROXY_BASE}/api/layout-translations/${jobId}/import-document`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ locale: locale || null }),
   });
   return handle(res);
 }
 
 export async function searchDocument(docId: string, query: string, topK?: number): Promise<SearchResponse> {
   const res = await fetch(`${PROXY_BASE}/api/documents/${docId}/search`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ query, top_k: topK }),
   });
   return handle(res);
 }
 
 export interface ChunkDetail {
   chunk_id: string;
   page_start: number;
   bboxes: NormalizedBBox[] | null;
   text: string;
   section_title: string | null;
 }
 
 export async function getChunkDetail(chunkId: string): Promise<ChunkDetail> {
   const res = await fetch(`${PROXY_BASE}/api/chunks/${chunkId}`);
   return handle(res);
 }
 
diff --git a/frontend/src/lib/auth-modal.ts b/frontend/src/lib/auth-modal.ts
index ec5339e..38a84a0 100644
--- a/frontend/src/lib/auth-modal.ts
+++ b/frontend/src/lib/auth-modal.ts
@@ -1,15 +1,28 @@
 export const AUTH_MODAL_HASH = '#auth';
 
 export function isAuthModalHash(hash: string): boolean {
   return hash === AUTH_MODAL_HASH;
 }
 
-export function openAuthModal(): void {
+let callbackOverride: string | null = null;
+
+export function openAuthModal(options?: { callbackUrl?: string }): void {
   if (typeof window === 'undefined') return;
+  callbackOverride = options?.callbackUrl ?? null;
   if (window.location.hash === AUTH_MODAL_HASH) return;
   window.location.hash = AUTH_MODAL_HASH.slice(1);
 }
 
+/** Read (without clearing) the override set by the most recent openAuthModal call.
+ *  Cleared when the modal closes so a later hash-open falls back to current-URL. */
+export function peekAuthCallbackOverride(): string | null {
+  return callbackOverride;
+}
+
+export function clearAuthCallbackOverride(): void {
+  callbackOverride = null;
+}
+
 export function getUrlWithoutAuthHash(url: URL): string {
   return `${url.pathname}${url.search}`;
 }
diff --git a/frontend/src/lib/useChatSession.ts b/frontend/src/lib/useChatSession.ts
index ad2c66c..b2dd769 100644
--- a/frontend/src/lib/useChatSession.ts
+++ b/frontend/src/lib/useChatSession.ts
@@ -1,83 +1,137 @@
 "use client";
 
 import { useEffect, useState } from 'react';
 import { ApiError, createSession, getMessages, listSessions } from './api';
 import { useDocTalkStore } from '../store';
 
 interface UseChatSessionResult {
   sessionError: unknown | null;
 }
 
 export function useChatSession(documentId: string | undefined): UseChatSessionResult {
   const [sessionError, setSessionError] = useState<unknown | null>(null);
 
   const documentStatus = useDocTalkStore((s) => s.documentStatus);
   const {
     setSessions,
     setSessionId,
     setMessages,
     setDemoMessagesUsed,
     addSession,
   } = useDocTalkStore();
 
   useEffect(() => {
     if (!documentId || documentStatus !== 'ready') return;
 
     setSessionError(null);
     let cancelled = false;
 
     (async () => {
       let sessionReady = false;
+
+      // Anonymous demo: re-adopt the session we created earlier this browser
+      // session instead of burning a create per page view (5-per-5min IP cap).
+      // Safe for authed users too: if a signed-in caller inherits a stale key
+      // from an earlier anonymous visit, `getMessages` 404s for them (the
+      // session is anon-owned; `verify_session_access` in chat.py:157-163
+      // only returns it to `user is None` callers), so the catch below
+      // clears the key and falls through to the normal listSessions flow.
+      const demoKey = `dt-demo-session:${documentId}`;
+      const storedDemoSession = typeof window !== 'undefined' ? sessionStorage.getItem(demoKey) : null;
+      if (storedDemoSession) {
+        try {
+          const msgsData = await getMessages(storedDemoSession);
+          if (cancelled) return;
+          setSessionId(storedDemoSession);
+          // Populate the sessions list (not []) so SessionDropdown shows the
+          // adopted session instead of an empty "New Chat"-only placeholder.
+          // getMessages doesn't return session metadata, so derive
+          // created_at/last_activity_at from the fetched messages' own
+          // timestamps (falling back to now if there are none yet).
+          const firstMsgAt = msgsData.messages[0]?.createdAt;
+          const lastMsgAt = msgsData.messages[msgsData.messages.length - 1]?.createdAt;
+          const createdAt = firstMsgAt != null ? new Date(firstMsgAt).toISOString() : new Date().toISOString();
+          const lastActivityAt = lastMsgAt != null ? new Date(lastMsgAt).toISOString() : createdAt;
+          setSessions([{
+            session_id: storedDemoSession,
+            title: null,
+            message_count: msgsData.messages.length,
+            created_at: createdAt,
+            last_activity_at: lastActivityAt,
+          }]);
+          setMessages(msgsData.messages);
+          // Contract (useChatStream.ts): totalUsed = demoMessagesUsed + local
+          // user-message count. demoMessagesUsed must hold only server-known
+          // usage NOT already represented in the restored local transcript,
+          // or the two get summed and double-count. Since we just restored
+          // the full transcript into `messages`, subtract the user messages
+          // it already carries from the server's count (clamped at 0 for
+          // safety, though in the steady state the two should match exactly).
+          const restoredUserMsgCount = msgsData.messages.filter((m) => m.role === 'user').length;
+          if (msgsData.demo_messages_used != null) {
+            setDemoMessagesUsed(Math.max(0, msgsData.demo_messages_used - restoredUserMsgCount));
+          } else {
+            setDemoMessagesUsed(0);
+          }
+          return; // adopted — skip listSessions/createSession entirely
+        } catch {
+          sessionStorage.removeItem(demoKey); // stale/pruned session — fall through
+        }
+      }
+
       try {
         const sessionsData = await listSessions(documentId);
         if (cancelled) return;
 
         setSessions(sessionsData.sessions);
         if (sessionsData.sessions.length > 0) {
           const latest = sessionsData.sessions[0];
           setSessionId(latest.session_id);
           const msgsData = await getMessages(latest.session_id);
           if (!cancelled) setMessages(msgsData.messages);
           sessionReady = true;
         }
       } catch (e) {
         console.warn('Failed to load sessions, falling back to create:', e);
       }
 
       if (!sessionReady && !cancelled) {
         try {
           const s = await createSession(documentId);
           if (cancelled) return;
 
           setSessionId(s.session_id);
           if (s.demo_messages_used != null) {
             setDemoMessagesUsed(s.demo_messages_used);
+            if (typeof window !== 'undefined') {
+              sessionStorage.setItem(`dt-demo-session:${documentId}`, s.session_id);
+            }
           }
 
           const now = s.created_at || new Date().toISOString();
           addSession({
             session_id: s.session_id,
             title: null,
             message_count: 0,
             created_at: now,
             last_activity_at: now,
           });
 
           setMessages([]);
         } catch (e) {
           const expectedRateLimit = e instanceof ApiError && (e.code === 'DEMO_SESSION_RATE_LIMITED' || e.status === 429);
           if (!expectedRateLimit) {
             console.error('Failed to create session:', e);
           }
           if (!cancelled) setSessionError(e);
         }
       }
     })();
 
     return () => {
       cancelled = true;
     };
   }, [documentId, documentStatus, setSessions, setSessionId, setMessages, setDemoMessagesUsed, addSession]);
 
   return { sessionError };
 }

exec
/bin/zsh -lc "nl -ba frontend/src/lib/useChatStream.ts | sed -n '1,340p'; printf '\\nSESSION HOOK\\n'; nl -ba frontend/src/lib/useChatSession.ts | sed -n '1,190p'; printf '\\nSTORE DEMO FIELDS\\n'; rg -n \"demoMessagesUsed|maxUserMessages|messagesUsed|setDemoMessagesUsed\" frontend/src/store frontend/src -g '*.{ts,tsx}' | head -n 300" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	"use client";
     2	
     3	import { useCallback, useMemo, useRef } from 'react';
     4	import { chatStream, continueStream } from './sse';
     5	import { useDocTalkStore } from '../store';
     6	import type { Message } from '../types';
     7	import { triggerCreditsRefresh } from '../components/CreditsDisplay';
     8	import { errorCopy } from './errorCopy';
     9	import { trackEvent } from './analytics';
    10	import { messageShareAnchorFromId } from './shareAnchors';
    11	import { deriveUpgradePlan } from './billingLinks';
    12	
    13	interface UseChatStreamOptions {
    14	  sessionId: string;
    15	  selectedMode: string;
    16	  locale: string;
    17	  t: (key: string, params?: Record<string, string | number>) => string;
    18	  tOr: (key: string, fallback: string, params?: Record<string, string | number>) => string;
    19	  maxUserMessages?: number;
    20	  /**
    21	   * Current user's billing tier ('free' | 'plus' | 'pro' | undefined for
    22	   * anonymous/demo). Used by the paywall analytics events so the funnel data
    23	   * reflects the actual upgrade *target* — e.g. a Plus user hitting the Pro
    24	   * cap should fire `plan: 'pro'`, not the hardcoded `plan: 'plus'` that was
    25	   * poisoning every paywall_opened/limit_hit event in the funnel (I27).
    26	   */
    27	  currentPlan?: string;
    28	  onShowPaywall: (reason?: string) => void;
    29	  onRequireAuth: () => void;
    30	}
    31	
    32	interface UseChatStreamResult {
    33	  sendMessage: (text: string) => Promise<boolean>;
    34	  regenerateLastResponse: () => Promise<void>;
    35	  continueGenerating: () => Promise<void>;
    36	  stopStreaming: () => void;
    37	  demoRemaining: number;
    38	  demoLimitReached: boolean;
    39	  messagesUsed: number;
    40	  maxMessages: number;
    41	}
    42	
    43	export function useChatStream({
    44	  sessionId,
    45	  selectedMode,
    46	  locale,
    47	  t,
    48	  tOr,
    49	  maxUserMessages,
    50	  currentPlan,
    51	  onShowPaywall,
    52	  onRequireAuth,
    53	}: UseChatStreamOptions): UseChatStreamResult {
    54	  const {
    55	    messages,
    56	    isStreaming,
    57	    demoMessagesUsed,
    58	    addMessage,
    59	    updateLastMessage,
    60	    addCitationToLastMessage,
    61	    addArtifactToLastMessage,
    62	    setLastMessageToolStatus,
    63	    setStreaming,
    64	    updateSessionActivity,
    65	    flushPendingText,
    66	    markLastMessageTruncated,
    67	    updateLastMessageMeta,
    68	  } = useDocTalkStore();
    69	
    70	  const abortRef = useRef<AbortController | null>(null);
    71	
    72	  const localUserMsgCount = maxUserMessages != null
    73	    ? messages.filter((m) => m.role === 'user').length
    74	    : 0;
    75	  const totalUsed = demoMessagesUsed + localUserMsgCount;
    76	  const demoRemaining = maxUserMessages != null ? maxUserMessages - totalUsed : Infinity;
    77	  const demoLimitReached = maxUserMessages != null && demoRemaining <= 0;
    78	  const messagesUsed = maxUserMessages != null ? Math.min(maxUserMessages, Math.max(0, totalUsed)) : 0;
    79	  const maxMessages = maxUserMessages ?? 0;
    80	
    81	  const getErrorMeta = useCallback(
    82	    (err: unknown): { message: string; code: string | null; status: number | null } => {
    83	      if (typeof err === 'object' && err) {
    84	        const anyErr = err as Record<string, unknown>;
    85	        return {
    86	          message: typeof anyErr.message === 'string' ? anyErr.message : '',
    87	          code: typeof anyErr.code === 'string' ? anyErr.code : null,
    88	          status: typeof anyErr.status === 'number' ? anyErr.status : null,
    89	        };
    90	      }
    91	      return { message: '', code: null, status: null };
    92	    },
    93	    [],
    94	  );
    95	
    96	  const handleStreamError = useCallback((err: unknown) => {
    97	    flushPendingText();
    98	    setStreaming(false);
    99	    abortRef.current = null;
   100	
   101	    const { message, code, status } = getErrorMeta(err);
   102	    const name = typeof err === 'object' && err && 'name' in err
   103	      ? String((err as { name?: unknown }).name || '')
   104	      : '';
   105	
   106	    if (name === 'AbortError' || message.includes('AbortError')) {
   107	      return;
   108	    }
   109	
   110	    if (
   111	      status === 402
   112	      || code === 'INSUFFICIENT_CREDITS'
   113	      || code === 'MODE_NOT_ALLOWED'
   114	      || code === 'PRO_MODE_LIMIT_REACHED'
   115	      || code === 'BALANCED_MODE_LIMIT_REACHED'
   116	    ) {
   117	      const reason = code || 'paid_limit';
   118	      // I27: previously hardcoded `plan: 'plus'`, which falsely attributed
   119	      // every paywall event in the funnel to plus-upgrade intent regardless
   120	      // of what triggered it (e.g. a Plus user hitting the Pro cap was logged
   121	      // as a Plus-upgrade event). Derive the actual upgrade target from
   122	      // (currentPlan, reason) so the upgrade-funnel analytics aren't poisoned.
   123	      const upgradePlan = deriveUpgradePlan(currentPlan, reason);
   124	      trackEvent('limit_hit', { source: 'chat_stream', reason, plan: upgradePlan, period: 'monthly' });
   125	      trackEvent('paywall_opened', { source: 'chat_stream', reason, plan: upgradePlan, period: 'monthly' });
   126	      onShowPaywall(reason);
   127	      return;
   128	    }
   129	
   130	    if (status === 409 || code === 'DOCUMENT_PROCESSING') {
   131	      addMessage({
   132	        id: `m_${Date.now()}_proc`,
   133	        role: 'assistant',
   134	        text: t('doc.processing'),
   135	        createdAt: Date.now(),
   136	      });
   137	      return;
   138	    }
   139	
   140	    if (
   141	      status === 429
   142	      || code === 'RATE_LIMITED'
   143	      || code === 'DEMO_SESSION_RATE_LIMITED'
   144	      || code === 'DEMO_MESSAGE_LIMIT_REACHED'
   145	      || code === 'DEMO_SESSION_LIMIT_REACHED'
   146	    ) {
   147	      trackEvent('limit_hit', { source: 'chat_stream', reason: code || 'rate_or_demo_limit' });
   148	      const isRateLimited = code === 'RATE_LIMITED'
   149	        || code === 'DEMO_SESSION_RATE_LIMITED'
   150	        || message.includes('Rate limit exceeded');
   151	      addMessage({
   152	        id: `m_${Date.now()}_limit`,
   153	        role: 'assistant',
   154	        text: isRateLimited ? t('demo.rateLimitMessage') : t('demo.limitReachedMessage'),
   155	        createdAt: Date.now(),
   156	      });
   157	      return;
   158	    }
   159	
   160	    const copy = errorCopy(err, t, tOr);
   161	    const state = useDocTalkStore.getState();
   162	    const currentMessages = state.messages;
   163	    const lastMessage = currentMessages[currentMessages.length - 1];
   164	    const lastAssistantIsEmpty = lastMessage?.role === 'assistant'
   165	      && !lastMessage.text
   166	      && !lastMessage.toolStatus
   167	      && (!lastMessage.citations || lastMessage.citations.length === 0)
   168	      && (!lastMessage.artifacts || lastMessage.artifacts.length === 0);
   169	
   170	    if (lastAssistantIsEmpty) {
   171	      state.setMessages([
   172	        ...currentMessages.slice(0, -1),
   173	        {
   174	          ...lastMessage,
   175	          text: copy.body,
   176	          isError: true,
   177	          isTruncated: false,
   178	        },
   179	      ]);
   180	      return;
   181	    }
   182	
   183	    addMessage({
   184	      id: `m_${Date.now()}_e`,
   185	      role: 'assistant',
   186	      text: copy.body,
   187	      isError: true,
   188	      createdAt: Date.now(),
   189	    });
   190	  }, [addMessage, flushPendingText, getErrorMeta, onShowPaywall, setStreaming, t, tOr, currentPlan]);
   191	
   192	  const handleTruncated = useCallback(() => {
   193	    flushPendingText();
   194	    markLastMessageTruncated(true);
   195	  }, [flushPendingText, markLastMessageTruncated]);
   196	
   197	  const handleStreamDone = useCallback((d: { message_id: string; can_continue?: boolean; continuation_count?: number }) => {
   198	    flushPendingText();
   199	    setStreaming(false);
   200	    abortRef.current = null;
   201	    updateSessionActivity(sessionId);
   202	    triggerCreditsRefresh();
   203	    trackEvent('chat_message_completed', { source: 'chat_stream', mode: selectedMode });
   204	    if (d.message_id) {
   205	      updateLastMessageMeta({
   206	        backendId: d.message_id,
   207	        shareAnchor: messageShareAnchorFromId(d.message_id),
   208	        ...(d.continuation_count !== undefined ? { continuationCount: d.continuation_count } : {}),
   209	      });
   210	    }
   211	  }, [flushPendingText, setStreaming, updateSessionActivity, sessionId, selectedMode, updateLastMessageMeta]);
   212	
   213	  const handleAnswerRepaired = useCallback((payload: { text: string; citations: Message['citations'] }) => {
   214	    flushPendingText();
   215	    updateLastMessageMeta({
   216	      text: payload.text,
   217	      citations: payload.citations || [],
   218	      isTruncated: false,
   219	      toolStatus: undefined,
   220	    });
   221	  }, [flushPendingText, updateLastMessageMeta]);
   222	
   223	  // Text-preserving citation update: sentence-level focus added after the
   224	  // answer (cross-lingual / paraphrase). Only the citations change.
   225	  const handleCitationsRefined = useCallback((citations: Message['citations']) => {
   226	    flushPendingText();
   227	    updateLastMessageMeta({ citations: citations || [] });
   228	  }, [flushPendingText, updateLastMessageMeta]);
   229	
   230	  const streamAssistantResponse = useCallback(async (prompt: string) => {
   231	    const controller = new AbortController();
   232	    abortRef.current = controller;
   233	
   234	    const domainMode = useDocTalkStore.getState().domainMode;
   235	    await chatStream(
   236	      sessionId,
   237	      prompt,
   238	      ({ text }) => updateLastMessage(text || ''),
   239	      (citation) => addCitationToLastMessage(citation),
   240	      handleStreamError,
   241	      handleStreamDone,
   242	      handleTruncated,
   243	      selectedMode,
   244	      locale,
   245	      controller.signal,
   246	      domainMode,
   247	      (artifact) => addArtifactToLastMessage(artifact),
   248	      ({ message }) => setLastMessageToolStatus(message),
   249	      handleAnswerRepaired,
   250	      handleCitationsRefined,
   251	    );
   252	  }, [sessionId, updateLastMessage, addCitationToLastMessage, addArtifactToLastMessage, setLastMessageToolStatus, handleStreamError, handleStreamDone, handleTruncated, handleAnswerRepaired, handleCitationsRefined, selectedMode, locale]);
   253	
   254	  const sendMessage = useCallback(async (text: string) => {
   255	    if (!text.trim() || isStreaming) return false;
   256	
   257	    if (demoLimitReached) {
   258	      onRequireAuth();
   259	      return false;
   260	    }
   261	
   262	    const userMsg: Message = {
   263	      id: `m_${Date.now()}_u`,
   264	      role: 'user',
   265	      text,
   266	      createdAt: Date.now(),
   267	    };
   268	
   269	    const asstMsg: Message = {
   270	      id: `m_${Date.now()}_a`,
   271	      role: 'assistant',
   272	      text: '',
   273	      citations: [],
   274	      createdAt: Date.now(),
   275	    };
   276	
   277	    addMessage(userMsg);
   278	    addMessage(asstMsg);
   279	    setStreaming(true);
   280	    trackEvent('chat_message_sent', { source: 'chat_panel', mode: selectedMode });
   281	
   282	    await streamAssistantResponse(text);
   283	    return true;
   284	  }, [isStreaming, demoLimitReached, onRequireAuth, addMessage, setStreaming, streamAssistantResponse, selectedMode]);
   285	
   286	  const regenerateLastResponse = useCallback(async () => {
   287	    if (isStreaming) return;
   288	
   289	    const msgs = useDocTalkStore.getState().messages;
   290	    let lastUserIdx = -1;
   291	
   292	    for (let i = msgs.length - 1; i >= 0; i--) {
   293	      if (msgs[i].role === 'user') {
   294	        lastUserIdx = i;
   295	        break;
   296	      }
   297	    }
   298	
   299	    if (lastUserIdx === -1) return;
   300	
   301	    const lastUserText = msgs[lastUserIdx].text;
   302	    const trimmed = msgs.slice(0, lastUserIdx + 1);
   303	
   304	    useDocTalkStore.getState().setMessages(trimmed);
   305	    addMessage({ id: `m_${Date.now()}_a`, role: 'assistant', text: '', citations: [], createdAt: Date.now() });
   306	    setStreaming(true);
   307	
   308	    await streamAssistantResponse(lastUserText);
   309	  }, [isStreaming, addMessage, setStreaming, streamAssistantResponse]);
   310	
   311	  const continueGenerating = useCallback(async () => {
   312	    if (isStreaming) return;
   313	
   314	    const msgs = useDocTalkStore.getState().messages;
   315	    const lastMsg = msgs[msgs.length - 1];
   316	    if (!lastMsg || lastMsg.role !== 'assistant' || !lastMsg.isTruncated) return;
   317	
   318	    // Clear truncated flag and start streaming
   319	    markLastMessageTruncated(false);
   320	    setStreaming(true);
   321	
   322	    const controller = new AbortController();
   323	    abortRef.current = controller;
   324	
   325	    await continueStream(
   326	      sessionId,
   327	      lastMsg.backendId || '',
   328	      ({ text }) => updateLastMessage(text || ''),
   329	      (citation) => addCitationToLastMessage(citation),
   330	      handleStreamError,
   331	      handleStreamDone,
   332	      handleTruncated,
   333	      selectedMode,
   334	      locale,
   335	      controller.signal,
   336	      (artifact) => addArtifactToLastMessage(artifact),
   337	      ({ message }) => setLastMessageToolStatus(message),
   338	      handleAnswerRepaired,
   339	      handleCitationsRefined,
   340	    );

SESSION HOOK
     1	"use client";
     2	
     3	import { useEffect, useState } from 'react';
     4	import { ApiError, createSession, getMessages, listSessions } from './api';
     5	import { useDocTalkStore } from '../store';
     6	
     7	interface UseChatSessionResult {
     8	  sessionError: unknown | null;
     9	}
    10	
    11	export function useChatSession(documentId: string | undefined): UseChatSessionResult {
    12	  const [sessionError, setSessionError] = useState<unknown | null>(null);
    13	
    14	  const documentStatus = useDocTalkStore((s) => s.documentStatus);
    15	  const {
    16	    setSessions,
    17	    setSessionId,
    18	    setMessages,
    19	    setDemoMessagesUsed,
    20	    addSession,
    21	  } = useDocTalkStore();
    22	
    23	  useEffect(() => {
    24	    if (!documentId || documentStatus !== 'ready') return;
    25	
    26	    setSessionError(null);
    27	    let cancelled = false;
    28	
    29	    (async () => {
    30	      let sessionReady = false;
    31	
    32	      // Anonymous demo: re-adopt the session we created earlier this browser
    33	      // session instead of burning a create per page view (5-per-5min IP cap).
    34	      // Safe for authed users too: if a signed-in caller inherits a stale key
    35	      // from an earlier anonymous visit, `getMessages` 404s for them (the
    36	      // session is anon-owned; `verify_session_access` in chat.py:157-163
    37	      // only returns it to `user is None` callers), so the catch below
    38	      // clears the key and falls through to the normal listSessions flow.
    39	      const demoKey = `dt-demo-session:${documentId}`;
    40	      const storedDemoSession = typeof window !== 'undefined' ? sessionStorage.getItem(demoKey) : null;
    41	      if (storedDemoSession) {
    42	        try {
    43	          const msgsData = await getMessages(storedDemoSession);
    44	          if (cancelled) return;
    45	          setSessionId(storedDemoSession);
    46	          // Populate the sessions list (not []) so SessionDropdown shows the
    47	          // adopted session instead of an empty "New Chat"-only placeholder.
    48	          // getMessages doesn't return session metadata, so derive
    49	          // created_at/last_activity_at from the fetched messages' own
    50	          // timestamps (falling back to now if there are none yet).
    51	          const firstMsgAt = msgsData.messages[0]?.createdAt;
    52	          const lastMsgAt = msgsData.messages[msgsData.messages.length - 1]?.createdAt;
    53	          const createdAt = firstMsgAt != null ? new Date(firstMsgAt).toISOString() : new Date().toISOString();
    54	          const lastActivityAt = lastMsgAt != null ? new Date(lastMsgAt).toISOString() : createdAt;
    55	          setSessions([{
    56	            session_id: storedDemoSession,
    57	            title: null,
    58	            message_count: msgsData.messages.length,
    59	            created_at: createdAt,
    60	            last_activity_at: lastActivityAt,
    61	          }]);
    62	          setMessages(msgsData.messages);
    63	          // Contract (useChatStream.ts): totalUsed = demoMessagesUsed + local
    64	          // user-message count. demoMessagesUsed must hold only server-known
    65	          // usage NOT already represented in the restored local transcript,
    66	          // or the two get summed and double-count. Since we just restored
    67	          // the full transcript into `messages`, subtract the user messages
    68	          // it already carries from the server's count (clamped at 0 for
    69	          // safety, though in the steady state the two should match exactly).
    70	          const restoredUserMsgCount = msgsData.messages.filter((m) => m.role === 'user').length;
    71	          if (msgsData.demo_messages_used != null) {
    72	            setDemoMessagesUsed(Math.max(0, msgsData.demo_messages_used - restoredUserMsgCount));
    73	          } else {
    74	            setDemoMessagesUsed(0);
    75	          }
    76	          return; // adopted — skip listSessions/createSession entirely
    77	        } catch {
    78	          sessionStorage.removeItem(demoKey); // stale/pruned session — fall through
    79	        }
    80	      }
    81	
    82	      try {
    83	        const sessionsData = await listSessions(documentId);
    84	        if (cancelled) return;
    85	
    86	        setSessions(sessionsData.sessions);
    87	        if (sessionsData.sessions.length > 0) {
    88	          const latest = sessionsData.sessions[0];
    89	          setSessionId(latest.session_id);
    90	          const msgsData = await getMessages(latest.session_id);
    91	          if (!cancelled) setMessages(msgsData.messages);
    92	          sessionReady = true;
    93	        }
    94	      } catch (e) {
    95	        console.warn('Failed to load sessions, falling back to create:', e);
    96	      }
    97	
    98	      if (!sessionReady && !cancelled) {
    99	        try {
   100	          const s = await createSession(documentId);
   101	          if (cancelled) return;
   102	
   103	          setSessionId(s.session_id);
   104	          if (s.demo_messages_used != null) {
   105	            setDemoMessagesUsed(s.demo_messages_used);
   106	            if (typeof window !== 'undefined') {
   107	              sessionStorage.setItem(`dt-demo-session:${documentId}`, s.session_id);
   108	            }
   109	          }
   110	
   111	          const now = s.created_at || new Date().toISOString();
   112	          addSession({
   113	            session_id: s.session_id,
   114	            title: null,
   115	            message_count: 0,
   116	            created_at: now,
   117	            last_activity_at: now,
   118	          });
   119	
   120	          setMessages([]);
   121	        } catch (e) {
   122	          const expectedRateLimit = e instanceof ApiError && (e.code === 'DEMO_SESSION_RATE_LIMITED' || e.status === 429);
   123	          if (!expectedRateLimit) {
   124	            console.error('Failed to create session:', e);
   125	          }
   126	          if (!cancelled) setSessionError(e);
   127	        }
   128	      }
   129	    })();
   130	
   131	    return () => {
   132	      cancelled = true;
   133	    };
   134	  }, [documentId, documentStatus, setSessions, setSessionId, setMessages, setDemoMessagesUsed, addSession]);
   135	
   136	  return { sessionError };
   137	}

STORE DEMO FIELDS
frontend/src/store/index.ts:52:  demoMessagesUsed: number;
frontend/src/store/index.ts:89:  setDemoMessagesUsed: (count: number) => void;
frontend/src/store/index.ts:130:  demoMessagesUsed: 0,
frontend/src/store/index.ts:280:  setDemoMessagesUsed: (count: number) => set({ demoMessagesUsed: count }),
frontend/src/store/index.ts:52:  demoMessagesUsed: number;
frontend/src/store/index.ts:89:  setDemoMessagesUsed: (count: number) => void;
frontend/src/store/index.ts:130:  demoMessagesUsed: 0,
frontend/src/store/index.ts:280:  setDemoMessagesUsed: (count: number) => set({ demoMessagesUsed: count }),
frontend/src/lib/useChatSession.ts:19:    setDemoMessagesUsed,
frontend/src/lib/useChatSession.ts:63:          // Contract (useChatStream.ts): totalUsed = demoMessagesUsed + local
frontend/src/lib/useChatSession.ts:64:          // user-message count. demoMessagesUsed must hold only server-known
frontend/src/lib/useChatSession.ts:72:            setDemoMessagesUsed(Math.max(0, msgsData.demo_messages_used - restoredUserMsgCount));
frontend/src/lib/useChatSession.ts:74:            setDemoMessagesUsed(0);
frontend/src/lib/useChatSession.ts:105:            setDemoMessagesUsed(s.demo_messages_used);
frontend/src/lib/useChatSession.ts:134:  }, [documentId, documentStatus, setSessions, setSessionId, setMessages, setDemoMessagesUsed, addSession]);
frontend/src/lib/useChatStream.ts:19:  maxUserMessages?: number;
frontend/src/lib/useChatStream.ts:39:  messagesUsed: number;
frontend/src/lib/useChatStream.ts:49:  maxUserMessages,
frontend/src/lib/useChatStream.ts:57:    demoMessagesUsed,
frontend/src/lib/useChatStream.ts:72:  const localUserMsgCount = maxUserMessages != null
frontend/src/lib/useChatStream.ts:75:  const totalUsed = demoMessagesUsed + localUserMsgCount;
frontend/src/lib/useChatStream.ts:76:  const demoRemaining = maxUserMessages != null ? maxUserMessages - totalUsed : Infinity;
frontend/src/lib/useChatStream.ts:77:  const demoLimitReached = maxUserMessages != null && demoRemaining <= 0;
frontend/src/lib/useChatStream.ts:78:  const messagesUsed = maxUserMessages != null ? Math.min(maxUserMessages, Math.max(0, totalUsed)) : 0;
frontend/src/lib/useChatStream.ts:79:  const maxMessages = maxUserMessages ?? 0;
frontend/src/lib/useChatStream.ts:357:    messagesUsed,
frontend/src/lib/useChatStream.ts:359:  }), [sendMessage, regenerateLastResponse, continueGenerating, stopStreaming, demoRemaining, demoLimitReached, messagesUsed, maxMessages]);
frontend/src/components/SessionDropdown.tsx:21:  const { addSession, setSessionId, setMessages, removeSession, reset, setDemoMessagesUsed } = useDocTalkStore();
frontend/src/components/SessionDropdown.tsx:71:      if (s.demo_messages_used != null) setDemoMessagesUsed(s.demo_messages_used);
frontend/src/components/Chat/ChatPanel.tsx:117:  maxUserMessages?: number;
frontend/src/components/Chat/ChatPanel.tsx:134:export default function ChatPanel({ sessionId, onCitationClick, onPreviewLayoutTranslation, maxUserMessages, suggestedQuestions, initialQuestion, onOpenSettings, hasCustomInstructions, userPlan, autoSubmitInitialQuestion = false, supportsCustomInstructions = true }: ChatPanelProps) {
frontend/src/components/Chat/ChatPanel.tsx:169:    maxUserMessages,
frontend/src/components/Chat/ChatPanel.tsx:561:      {maxUserMessages != null && (
frontend/src/components/Chat/ChatPanel.tsx:569:              aria-label={t('chat.messagesUsed')}
frontend/src/components/Chat/ChatPanel.tsx:570:              aria-valuetext={t('demo.questionsRemaining', { remaining: Math.max(0, demoRemaining), total: maxUserMessages })}
frontend/src/components/Chat/ChatPanel.tsx:574:              style={{ width: `${Math.max(0, (demoRemaining / maxUserMessages) * 100)}%` }}
frontend/src/components/Chat/ChatPanel.tsx:600:                {t('demo.questionsRemaining', { remaining: Math.max(0, demoRemaining), total: maxUserMessages })}
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:367:    <ChatPanel sessionId={sessionId} onCitationClick={handleCitationClick} onPreviewLayoutTranslation={handlePreviewLayoutTranslation} maxUserMessages={isDemo && !isLoggedIn ? 5 : undefined} suggestedQuestions={suggestedQuestions.length > 0 ? suggestedQuestions : undefined} initialQuestion={initialQuestion} autoSubmitInitialQuestion={isDemo} onOpenSettings={canUseCustomInstructions ? () => setShowInstructions(true) : undefined} hasCustomInstructions={!!customInstructions} userPlan={userPlan} />

exec
/bin/zsh -lc "nl -ba frontend/src/components/SessionDropdown.tsx | sed -n '1,270p'; printf '\\nDOCUMENT PAGE SESSION WIRES\\n'; nl -ba frontend/src/app/d/\\[documentId\\]/DocumentReaderPageClient.tsx | sed -n '250,410p'; printf '\\nSTORE SESSION ACTIONS\\n'; nl -ba frontend/src/store/index.ts | sed -n '240,315p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	"use client";
     2	
     3	import { useEffect, useMemo, useRef, useState } from 'react';
     4	import { ChevronDown, Plus, Trash2, Home, X } from 'lucide-react';
     5	import Link from 'next/link';
     6	import { useRouter } from 'next/navigation';
     7	import { useDocTalkStore } from '../store';
     8	import { useLocale } from '../i18n';
     9	import { createSession, getMessages, deleteSession } from '../lib/api';
    10	import { errorCopy, type ErrorCopy } from '../lib/errorCopy';
    11	import { trackEvent } from '../lib/analytics';
    12	import { useDropdownKeyboard } from '../lib/useDropdownKeyboard';
    13	
    14	export default function SessionDropdown() {
    15	  const documentName = useDocTalkStore((s) => s.documentName);
    16	  const documentId = useDocTalkStore((s) => s.documentId);
    17	  const sessionId = useDocTalkStore((s) => s.sessionId);
    18	  const sessions = useDocTalkStore((s) => s.sessions);
    19	  const isStreaming = useDocTalkStore((s) => s.isStreaming);
    20	
    21	  const { addSession, setSessionId, setMessages, removeSession, reset, setDemoMessagesUsed } = useDocTalkStore();
    22	  const { t, tOr } = useLocale();
    23	  const router = useRouter();
    24	
    25	  const [open, setOpen] = useState(false);
    26	  const [focusIndex, setFocusIndex] = useState(-1);
    27	  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    28	  const [sessionErrorCopy, setSessionErrorCopy] = useState<ErrorCopy | null>(null);
    29	  const ref = useRef<HTMLDivElement>(null);
    30	  const triggerRef = useRef<HTMLButtonElement>(null);
    31	  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
    32	
    33	  useEffect(() => {
    34	    function onDocClick(e: MouseEvent) {
    35	      if (!ref.current) return;
    36	      if (!ref.current.contains(e.target as Node)) setOpen(false);
    37	    }
    38	    document.addEventListener('mousedown', onDocClick);
    39	    return () => document.removeEventListener('mousedown', onDocClick);
    40	  }, []);
    41	
    42	  useEffect(() => {
    43	    if (open) {
    44	      setFocusIndex(0);
    45	    } else {
    46	      setConfirmDeleteId(null);
    47	    }
    48	  }, [open]);
    49	
    50	  useEffect(() => {
    51	    if (open && focusIndex >= 0 && itemRefs.current[focusIndex]) {
    52	      itemRefs.current[focusIndex]?.focus();
    53	    }
    54	  }, [open, focusIndex]);
    55	
    56	  const toggle = () => setOpen((v) => !v);
    57	
    58	  const onNewChat = async () => {
    59	    if (!documentId || isStreaming) return;
    60	    setSessionErrorCopy(null);
    61	    try {
    62	      const s = await createSession(documentId);
    63	      addSession({
    64	        session_id: s.session_id,
    65	        title: null,
    66	        message_count: 0,
    67	        created_at: s.created_at,
    68	        last_activity_at: s.created_at,
    69	      });
    70	      setSessionId(s.session_id);
    71	      if (s.demo_messages_used != null) setDemoMessagesUsed(s.demo_messages_used);
    72	      setMessages([]);
    73	      setConfirmDeleteId(null);
    74	      setOpen(false);
    75	    } catch (e) {
    76	      const copy = errorCopy(e, t, tOr);
    77	      setSessionErrorCopy(copy);
    78	      if (copy.cta) {
    79	        trackEvent('limit_hit', { source: 'session_dropdown', reason: 'session_limit' });
    80	      }
    81	    }
    82	  };
    83	
    84	  const onSwitchSession = async (id: string) => {
    85	    if (isStreaming) return;
    86	    setSessionErrorCopy(null);
    87	    setMessages([]);
    88	    setSessionId(id);
    89	    const msgs = await getMessages(id);
    90	    setMessages(msgs.messages);
    91	    setConfirmDeleteId(null);
    92	    setOpen(false);
    93	  };
    94	
    95	  const onDeleteSessionById = async (targetId: string) => {
    96	    if (isStreaming) return;
    97	    setSessionErrorCopy(null);
    98	    setConfirmDeleteId(null);
    99	    await deleteSession(targetId);
   100	    removeSession(targetId);
   101	    const remaining = useDocTalkStore.getState().sessions;
   102	    if (targetId === sessionId) {
   103	      if (remaining.length > 0) {
   104	        await onSwitchSession(remaining[0].session_id);
   105	      } else {
   106	        await onNewChat();
   107	      }
   108	    }
   109	    setOpen(false);
   110	  };
   111	
   112	  const onDeleteCurrent = () => {
   113	    if (!sessionId || isStreaming) return;
   114	    setSessionErrorCopy(null);
   115	    setConfirmDeleteId(sessionId);
   116	  };
   117	
   118	  const requestDeleteSession = (targetId: string) => {
   119	    if (isStreaming) return;
   120	    setSessionErrorCopy(null);
   121	    setConfirmDeleteId(targetId);
   122	  };
   123	
   124	  const onBackHome = () => {
   125	    router.push('/');
   126	    reset();
   127	  };
   128	
   129	  const disabledClass = isStreaming ? 'opacity-60 cursor-not-allowed' : '';
   130	
   131	  const titleText = documentName || '';
   132	  const sortedSessions = useMemo(() => sessions.slice(0, 10), [sessions]);
   133	
   134	  // Total items: 1 (New Chat) + sessions + 1 (Delete) + 1 (Back Home)
   135	  const totalItems = 1 + sortedSessions.length + 2;
   136	
   137	  const handleMenuSelect = (index: number) => {
   138	    if (index === 0) {
   139	      void onNewChat();
   140	      return;
   141	    }
   142	    if (index >= 1 && index <= sortedSessions.length) {
   143	      const selected = sortedSessions[index - 1];
   144	      if (selected) void onSwitchSession(selected.session_id);
   145	      return;
   146	    }
   147	    if (index === 1 + sortedSessions.length) {
   148	      onDeleteCurrent();
   149	      return;
   150	    }
   151	    if (index === 2 + sortedSessions.length) {
   152	      onBackHome();
   153	    }
   154	  };
   155	
   156	  const handleMenuKeyDown = useDropdownKeyboard(
   157	    totalItems,
   158	    focusIndex,
   159	    setFocusIndex,
   160	    handleMenuSelect,
   161	    () => {
   162	      setOpen(false);
   163	      triggerRef.current?.focus();
   164	    },
   165	  );
   166	
   167	  return (
   168	    <div className="relative min-w-0" ref={ref}>
   169	      <button
   170	        ref={triggerRef}
   171	        type="button"
   172	        onClick={toggle}
   173	        data-tour="session-dropdown"
   174	        className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors max-w-[72px] min-[375px]:max-w-[112px] sm:max-w-[200px] md:max-w-[300px] truncate flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm"
   175	        title={titleText}
   176	        aria-haspopup="menu"
   177	        aria-expanded={open}
   178	      >
   179	        <span className="truncate">{titleText}</span>
   180	        <ChevronDown aria-hidden="true" size={14} className="opacity-70" />
   181	      </button>
   182	      {open && (
   183	        <div className="absolute left-0 mt-1 w-72 max-w-[calc(100vw-2rem)] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg z-20 p-1" onKeyDown={handleMenuKeyDown} role="menu">
   184	          <div className="py-1">
   185	            <button
   186	              ref={(el) => { itemRefs.current[0] = el; }}
   187	              className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-200 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset ${disabledClass}`}
   188	              onClick={onNewChat}
   189	              disabled={isStreaming}
   190	              tabIndex={focusIndex === 0 ? 0 : -1}
   191	              role="menuitem"
   192	            >
   193	              <Plus aria-hidden="true" size={16} />
   194	              <span>{t('session.newChat')}</span>
   195	            </button>
   196	            {sessionErrorCopy && (
   197	              <div
   198	                role="alert"
   199	                className={`mx-1 mt-2 rounded-lg border px-3 py-2 text-xs ${
   200	                  sessionErrorCopy.severity === 'warning'
   201	                    ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100'
   202	                    : 'border-red-200 bg-red-50 text-red-950 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100'
   203	                }`}
   204	              >
   205	                <p className="font-medium">{sessionErrorCopy.title}</p>
   206	                <p className="mt-1 leading-5 opacity-90">{sessionErrorCopy.body}</p>
   207	                {sessionErrorCopy.cta && (
   208	                  <Link
   209	                    href={sessionErrorCopy.cta.href}
   210	                    onClick={() => trackEvent('upgrade_click', { source: 'session_dropdown', reason: 'session_limit' })}
   211	                    className="mt-2 inline-flex items-center justify-center rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500"
   212	                  >
   213	                    {sessionErrorCopy.cta.label}
   214	                  </Link>
   215	                )}
   216	              </div>
   217	            )}
   218	          </div>
   219	          <div className="my-1 h-px bg-zinc-200 dark:bg-zinc-700" />
   220	          <div className="px-2 py-1 text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
   221	            {t('session.recentChats')}
   222	          </div>
   223	          <div className="max-h-64 overflow-auto">
   224	            {sortedSessions.length === 0 ? (
   225	              <div className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">{t('session.noTitle')}</div>
   226	            ) : (
   227	              sortedSessions.map((s, i) => {
   228	                const isCurrent = s.session_id === sessionId;
   229	                const label = s.title?.trim() || t('session.noTitle');
   230	                const idx = 1 + i;
   231	                return (
   232	                  <div
   233	                    key={s.session_id}
   234	                    className={`group flex items-center gap-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${
   235	                      isCurrent ? 'font-medium' : ''
   236	                    }`}
   237	                  >
   238	                    <button
   239	                      ref={(el) => { itemRefs.current[idx] = el; }}
   240	                      className={`flex-1 min-w-0 text-left flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-700 dark:text-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset rounded ${disabledClass}`}
   241	                      onClick={() => onSwitchSession(s.session_id)}
   242	                      disabled={isStreaming}
   243	                      tabIndex={focusIndex === idx ? 0 : -1}
   244	                      role="menuitem"
   245	                    >
   246	                      <span className="w-4 h-4 flex items-center justify-center shrink-0">
   247	                        {isCurrent ? <span className="block w-2 h-2 rounded-full bg-zinc-600" aria-label="Current session" /> : null}
   248	                      </span>
   249	                      <span className="flex-1 truncate" title={label}>{label}</span>
   250	                      <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
   251	                        {t('session.messageCount', { count: s.message_count })}
   252	                      </span>
   253	                    </button>
   254	                    {confirmDeleteId === s.session_id && s.session_id !== sessionId ? (
   255	                      <div className="shrink-0 mr-1 flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
   256	                        <span>{t('dashboard.deletePrompt')}</span>
   257	                        <button
   258	                          className="px-1.5 py-0.5 rounded bg-red-600 text-white hover:bg-red-500 transition-colors"
   259	                          onClick={(e) => { e.stopPropagation(); onDeleteSessionById(s.session_id); }}
   260	                          disabled={isStreaming}
   261	                          tabIndex={-1}
   262	                        >
   263	                          {t('common.yes')}
   264	                        </button>
   265	                        <button
   266	                          className="px-1.5 py-0.5 rounded border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
   267	                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
   268	                          disabled={isStreaming}
   269	                          tabIndex={-1}
   270	                        >

DOCUMENT PAGE SESSION WIRES
   250	    </div>
   251	  ) : null;
   252	
   253	  const viewerContent = (
   254	    <div className="h-full flex flex-col dt-reader-pane-document">
   255	      {viewToggle}
   256	      {layoutTranslationError ? (
   257	        <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100" role="alert">
   258	          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
   259	          <span className="min-w-0 flex-1">{layoutTranslationError}</span>
   260	          <button
   261	            type="button"
   262	            onClick={() => setLayoutTranslationError(null)}
   263	            className="rounded p-0.5 text-amber-800 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-900/40"
   264	            aria-label={tOr('common.dismiss', 'Dismiss')}
   265	          >
   266	            <X size={14} aria-hidden="true" />
   267	          </button>
   268	        </div>
   269	      ) : null}
   270	      <div className="flex-1 min-h-0">
   271	        {fileType === 'pdf' ? (
   272	          pdfUrl ? (
   273	            <div className="h-full min-h-0 flex flex-col">
   274	              {translatedPreview ? (
   275	                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--reader-border)] bg-[var(--reader-panel-solid)] px-3 py-2">
   276	                  <div className="inline-flex rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-muted)] p-0.5 text-xs font-medium">
   277	                    <button
   278	                      type="button"
   279	                      onClick={() => setPdfPreviewMode('original')}
   280	                      className={`min-h-8 rounded-md px-3 transition-colors ${pdfPreviewMode === 'original' ? 'bg-[var(--reader-panel-solid)] text-[var(--reader-ink)] shadow-sm' : 'text-[var(--reader-muted)] hover:text-[var(--reader-ink)]'}`}
   281	                    >
   282	                      {tOr('layoutTranslation.originalPdf', 'Original')}
   283	                    </button>
   284	                    <button
   285	                      type="button"
   286	                      onClick={() => setPdfPreviewMode('translated')}
   287	                      className={`min-h-8 rounded-md px-3 transition-colors ${pdfPreviewMode === 'translated' ? 'bg-[var(--reader-panel-solid)] text-[var(--reader-ink)] shadow-sm' : 'text-[var(--reader-muted)] hover:text-[var(--reader-ink)]'}`}
   288	                    >
   289	                      {tOr('layoutTranslation.translatedPdf', 'Translated')}
   290	                    </button>
   291	                  </div>
   292	                  <div className="flex min-w-0 items-center gap-2 text-xs text-[var(--reader-muted)]">
   293	                    <span className="truncate">{translatedPreview.targetLanguageLabel}</span>
   294	                    {translatedPreview.downloadUrl ? (
   295	                      <a
   296	                        href={translatedPreview.downloadUrl}
   297	                        className="inline-flex min-h-8 items-center gap-1 rounded-md border border-[var(--reader-border)] px-2 font-medium text-[var(--reader-ink)] transition-colors hover:bg-[var(--reader-panel-muted)]"
   298	                      >
   299	                        <Download size={13} aria-hidden="true" />
   300	                        {tOr('layoutTranslation.downloadPdf', 'Translated PDF')}
   301	                      </a>
   302	                    ) : null}
   303	                  </div>
   304	                </div>
   305	              ) : null}
   306	              <div className="flex-1 min-h-0">
   307	                <PdfViewer
   308	                  pdfUrl={pdfPreviewMode === 'translated' && translatedPreview ? translatedPreview.url : pdfUrl}
   309	                  currentPage={currentPage}
   310	                  highlights={pdfPreviewMode === 'translated' ? [] : highlights}
   311	                  scale={scale}
   312	                  scrollNonce={scrollNonce}
   313	                  highlightSnippet={pdfPreviewMode === 'translated' ? null : highlightSnippet}
   314	                  highlightFocus={pdfPreviewMode === 'translated' ? null : highlightFocus}
   315	                  onLayoutTranslate={handleOpenLayoutTranslation}
   316	                  layoutTranslateBusy={layoutTranslationBusy}
   317	                  layoutTranslateDisabled={documentStatus !== 'ready'}
   318	                />
   319	              </div>
   320	            </div>
   321	          ) : (
   322	            <div className="h-full w-full flex items-center justify-center text-zinc-500">{t('doc.loading')}</div>
   323	          )
   324	        ) : useConvertedPdf ? (
   325	          <PdfViewer pdfUrl={convertedPdfUrl} currentPage={currentPage} highlights={highlights} scale={scale} scrollNonce={scrollNonce} highlightSnippet={highlightSnippet} highlightFocus={highlightFocus} />
   326	        ) : (
   327	          <TextViewer documentId={documentId} fileType={fileType} targetPage={currentPage} scrollNonce={scrollNonce} highlightSnippet={highlightSnippet} />
   328	        )}
   329	      </div>
   330	    </div>
   331	  );
   332	
   333	  const processingStatusText = documentStatus === 'parsing'
   334	    ? t('status.parsing')
   335	    : documentStatus === 'embedding'
   336	      ? t('status.embedding')
   337	      : documentStatus === 'ocr'
   338	        ? t('status.ocr')
   339	        : t('status.processing');
   340	
   341	  const handleCitationClick = useCallback((citation: Citation) => {
   342	    trackEvent('citation_clicked', {
   343	      source: isDemo ? 'demo_reader' : 'document_reader',
   344	      page: citation.page,
   345	      has_bboxes: Boolean(citation.bboxes?.length),
   346	    });
   347	    navigateToCitation(citation);
   348	    revealMobileDocumentPane();
   349	  }, [isDemo, navigateToCitation, revealMobileDocumentPane]);
   350	
   351	  useEffect(() => {
   352	    if (isDesktopLayout !== false || mobileTab !== 'document') return;
   353	    if (highlights.length === 0 && !highlightSnippet) return;
   354	    let secondFrame: number | null = null;
   355	    const firstFrame = requestAnimationFrame(() => {
   356	      secondFrame = requestAnimationFrame(() => {
   357	        useDocTalkStore.setState((state) => ({ scrollNonce: state.scrollNonce + 1 }));
   358	      });
   359	    });
   360	    return () => {
   361	      cancelAnimationFrame(firstFrame);
   362	      if (secondFrame !== null) cancelAnimationFrame(secondFrame);
   363	    };
   364	  }, [isDesktopLayout, mobileTab, currentPage, highlights, highlightSnippet]);
   365	
   366	  const chatContent = documentStatus === 'ready' && sessionId ? (
   367	    <ChatPanel sessionId={sessionId} onCitationClick={handleCitationClick} onPreviewLayoutTranslation={handlePreviewLayoutTranslation} maxUserMessages={isDemo && !isLoggedIn ? 5 : undefined} suggestedQuestions={suggestedQuestions.length > 0 ? suggestedQuestions : undefined} initialQuestion={initialQuestion} autoSubmitInitialQuestion={isDemo} onOpenSettings={canUseCustomInstructions ? () => setShowInstructions(true) : undefined} hasCustomInstructions={!!customInstructions} userPlan={userPlan} />
   368	  ) : sessionErrorCopy ? (
   369	    <div className="flex h-full w-full items-center justify-center px-5 py-8">
   370	      <div
   371	        className={`w-full max-w-md rounded-2xl border px-5 py-4 text-sm shadow-sm ${
   372	          sessionErrorCopy.severity === 'warning'
   373	            ? 'border-amber-300/40 bg-amber-50 text-amber-950 dark:border-amber-300/25 dark:bg-amber-300/10 dark:text-amber-100'
   374	            : sessionErrorCopy.severity === 'info'
   375	              ? 'border-blue-300/40 bg-blue-50 text-blue-950 dark:border-blue-300/25 dark:bg-blue-300/10 dark:text-blue-100'
   376	              : 'border-red-300/40 bg-red-50 text-red-950 dark:border-red-300/25 dark:bg-red-300/10 dark:text-red-100'
   377	        }`}
   378	        role="status"
   379	        aria-live="polite"
   380	      >
   381	        <p className="font-semibold">{sessionErrorCopy.title}</p>
   382	        <p className="mt-2 leading-6 opacity-90">{sessionErrorCopy.body}</p>
   383	        {sessionErrorCopy.cta && (
   384	          <button
   385	            type="button"
   386	            onClick={() => router.push(sessionErrorCopy.cta!.href)}
   387	            className="mt-4 rounded-full bg-zinc-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
   388	          >
   389	            {sessionErrorCopy.cta.label}
   390	          </button>
   391	        )}
   392	      </div>
   393	    </div>
   394	  ) : documentStatus !== 'ready' && !error ? (
   395	    <div className="h-full w-full flex flex-col items-center justify-center px-6 py-8 text-zinc-500" role="status" aria-live="polite">
   396	      <div className="w-full max-w-md space-y-3 animate-pulse motion-reduce:animate-none">
   397	        <div className="flex justify-start">
   398	          <div className="w-3/4 rounded-xl bg-zinc-200 dark:bg-zinc-800 p-3">
   399	            <div className="h-2.5 w-11/12 rounded bg-zinc-300 dark:bg-zinc-700" />
   400	          </div>
   401	        </div>
   402	        <div className="flex justify-end">
   403	          <div className="w-2/3 rounded-xl bg-zinc-200 dark:bg-zinc-800 p-3">
   404	            <div className="h-2.5 w-10/12 rounded bg-zinc-300 dark:bg-zinc-700" />
   405	          </div>
   406	        </div>
   407	        <div className="flex justify-start">
   408	          <div className="w-4/5 rounded-xl bg-zinc-200 dark:bg-zinc-800 p-3 space-y-2">
   409	            <div className="h-2.5 w-full rounded bg-zinc-300 dark:bg-zinc-700" />
   410	            <div className="h-2.5 w-9/12 rounded bg-zinc-300 dark:bg-zinc-700" />

STORE SESSION ACTIONS
   240	    set({ messages: [...msgs.slice(0, -1), { ...last, artifacts: [...next, artifact] }] });
   241	  },
   242	  setLastMessageToolStatus: (message: string) => {
   243	    const msgs = get().messages;
   244	    if (msgs.length === 0) return;
   245	    const last = msgs[msgs.length - 1];
   246	    set({ messages: [...msgs.slice(0, -1), { ...last, toolStatus: message }] });
   247	  },
   248	  setStreaming: (v: boolean) => set({ isStreaming: v }),
   249	  setSessionId: (id: string) => set({ sessionId: id }),
   250	  setSelectedMode: (id: string) => {
   251	    set({ selectedMode: id });
   252	    try {
   253	      localStorage.setItem('doctalk_mode', id);
   254	    } catch {
   255	      // localStorage unavailable in private browsing
   256	    }
   257	  },
   258	  setDomainMode: (mode: string | null) => set({ domainMode: mode }),
   259	  setSessions: (sessions: SessionItem[]) => set({ sessions }),
   260	  addSession: (session: SessionItem) => set((state) => ({
   261	    sessions: [session, ...state.sessions],
   262	  })),
   263	  removeSession: (sessionId: string) => set((state) => ({
   264	    sessions: state.sessions.filter((s) => s.session_id !== sessionId),
   265	  })),
   266	  updateSessionActivity: (sessionId: string) => set((state) => {
   267	    const now = new Date().toISOString();
   268	    const updated = state.sessions.map((s) =>
   269	      s.session_id === sessionId
   270	        ? { ...s, last_activity_at: now, message_count: s.message_count + 1 }
   271	        : s
   272	    );
   273	    // 重排：将活跃 session 移到顶部
   274	    updated.sort((a, b) => new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime());
   275	    return { sessions: updated };
   276	  }),
   277	  setDocumentSummary: (summary: string | null) => set({ documentSummary: summary }),
   278	  setSuggestedQuestions: (questions: string[]) => set({ suggestedQuestions: questions }),
   279	  setUserPlan: (plan: PlanType) => set({ userPlan: plan }),
   280	  setDemoMessagesUsed: (count: number) => set({ demoMessagesUsed: count }),
   281	  setSearchQuery: (query: string) => set({ searchQuery: query }),
   282	  setSearchMatches: (matches) => set({ searchMatches: matches }),
   283	  setCurrentMatchIndex: (index: number) => set({ currentMatchIndex: index }),
   284	  markLastMessageTruncated: (truncated: boolean) => {
   285	    const msgs = get().messages;
   286	    if (msgs.length === 0) return;
   287	    const last = msgs[msgs.length - 1];
   288	    set({ messages: [...msgs.slice(0, -1), { ...last, isTruncated: truncated }] });
   289	  },
   290	  updateLastMessageMeta: (updates) => {
   291	    const msgs = get().messages;
   292	    if (msgs.length === 0) return;
   293	    const last = msgs[msgs.length - 1];
   294	    set({ messages: [...msgs.slice(0, -1), { ...last, ...updates }] });
   295	  },
   296	  // Clears only the per-document UI state that should NOT leak across a
   297	  // document switch (search query/matches, citation highlights, grab mode,
   298	  // current page). Call this from `useDocumentLoader` when the route changes
   299	  // from `/d/A` to `/d/B`, so doc B doesn't inherit doc A's overlays.
   300	  // Leaves session/messages/mode/sessions/userPlan intact — those are owned by
   301	  // higher-level effects that load per-document or are user-global.
   302	  clearDocumentTransientState: () => set({
   303	    searchQuery: '',
   304	    searchMatches: [],
   305	    currentMatchIndex: -1,
   306	    highlights: [],
   307	    highlightSnippet: null,
   308	    highlightFocus: null,
   309	    grabMode: false,
   310	    currentPage: 1,
   311	    scrollNonce: 0,
   312	    // Per-document content — doc B must never show doc A's summary or
   313	    // suggested questions (the loader re-sets them when B is ready).
   314	    documentSummary: null,
   315	    suggestedQuestions: [],

exec
/bin/zsh -lc "nl -ba frontend/src/components/Chat/ChatPanel.tsx | sed -n '120,500p'; printf '\\nDEMO CLIENT/NAV\\n'; nl -ba frontend/src/app/demo/DemoPageClient.tsx | sed -n '1,330p'; printf '\\nDOCUMENT DEMO INITIAL QUESTION\\n'; rg -n \"initialQuestion|autoSubmitInitialQuestion|question=\" frontend/src/app/d frontend/src/app/demo frontend/src/components/Chat -g '*.{ts,tsx}'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   120	  suggestedQuestions?: string[];
   121	  initialQuestion?: string;
   122	  onOpenSettings?: () => void;
   123	  hasCustomInstructions?: boolean;
   124	  userPlan?: string;
   125	  autoSubmitInitialQuestion?: boolean;
   126	  // Whether this surface supports custom instructions at all. Document reader
   127	  // uses it (true); collection chat doesn't (scope across multiple docs is
   128	  // undefined). Default true to preserve existing single-doc behavior.
   129	  supportsCustomInstructions?: boolean;
   130	}
   131	
   132	const autoSubmittedInitialQuestions = new Set<string>();
   133	
   134	export default function ChatPanel({ sessionId, onCitationClick, onPreviewLayoutTranslation, maxUserMessages, suggestedQuestions, initialQuestion, onOpenSettings, hasCustomInstructions, userPlan, autoSubmitInitialQuestion = false, supportsCustomInstructions = true }: ChatPanelProps) {
   135	  const messages = useDocTalkStore((s) => s.messages);
   136	  const isStreaming = useDocTalkStore((s) => s.isStreaming);
   137	  const selectedMode = useDocTalkStore((s) => s.selectedMode);
   138	  const addMessage = useDocTalkStore((s) => s.addMessage);
   139	  const { t, tOr, locale } = useLocale();
   140	  const router = useRouter();
   141	
   142	  const [input, setInput] = useState('');
   143	  const listRef = useRef<HTMLDivElement>(null);
   144	  const textareaRef = useRef<HTMLTextAreaElement>(null);
   145	  const [showPaywall, setShowPaywall] = useState(false);
   146	  const [paywallReason, setPaywallReason] = useState<string | null>(null);
   147	
   148	  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
   149	  const plusMenuRef = useRef<HTMLDivElement>(null);
   150	  const plusMenuButtonRef = useRef<HTMLButtonElement>(null);
   151	  const initialQuestionSubmittedRef = useRef<string | null>(null);
   152	
   153	  const [showScrollBtn, setShowScrollBtn] = useState(false);
   154	
   155	  const {
   156	    sendMessage,
   157	    regenerateLastResponse,
   158	    continueGenerating,
   159	    stopStreaming,
   160	    demoRemaining,
   161	    demoLimitReached,
   162	    maxMessages,
   163	  } = useChatStream({
   164	    sessionId,
   165	    selectedMode,
   166	    locale,
   167	    t,
   168	    tOr,
   169	    maxUserMessages,
   170	    currentPlan: userPlan,
   171	    onShowPaywall: (reason) => {
   172	      setPaywallReason(reason ?? null);
   173	      setShowPaywall(true);
   174	    },
   175	    onRequireAuth: () => openAuthModal(),
   176	  });
   177	
   178	  useEffect(() => {
   179	    const el = listRef.current;
   180	    if (!el) return;
   181	
   182	    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
   183	
   184	    if (isNearBottom) {
   185	      el.scrollTo({ top: el.scrollHeight, behavior: isStreaming ? 'auto' : 'smooth' });
   186	    }
   187	
   188	    setShowScrollBtn(!isNearBottom);
   189	  }, [messages, isStreaming]);
   190	
   191	  useEffect(() => {
   192	    const ta = textareaRef.current;
   193	    if (ta) {
   194	      ta.style.height = 'auto';
   195	      ta.style.height = Math.min(ta.scrollHeight, Math.max(160, window.innerHeight * 0.4)) + 'px';
   196	    }
   197	  }, [input]);
   198	
   199	  useEffect(() => {
   200	    const hasConversationMessages = messages.some((message) => message.id !== 'summary_synthetic');
   201	    if (!initialQuestion || hasConversationMessages || isStreaming) return;
   202	
   203	    if (autoSubmitInitialQuestion) {
   204	      const autoSubmitKey = `${sessionId}:${initialQuestion}`;
   205	      if (
   206	        initialQuestionSubmittedRef.current === initialQuestion
   207	        || autoSubmittedInitialQuestions.has(autoSubmitKey)
   208	      ) return;
   209	      initialQuestionSubmittedRef.current = initialQuestion;
   210	      autoSubmittedInitialQuestions.add(autoSubmitKey);
   211	      void sendMessage(initialQuestion).then((sent) => {
   212	        if (!sent) {
   213	          initialQuestionSubmittedRef.current = null;
   214	          autoSubmittedInitialQuestions.delete(autoSubmitKey);
   215	          setInput(initialQuestion);
   216	          textareaRef.current?.focus();
   217	        }
   218	      });
   219	      return;
   220	    }
   221	
   222	    if (input) return;
   223	    setInput(initialQuestion);
   224	    textareaRef.current?.focus();
   225	  }, [autoSubmitInitialQuestion, initialQuestion, input, messages, isStreaming, sendMessage, sessionId]);
   226	
   227	  useEffect(() => {
   228	    if (!plusMenuOpen) return;
   229	    const handler = (e: MouseEvent) => {
   230	      const target = e.target as HTMLElement;
   231	      if (!target.closest('[data-plus-menu]')) {
   232	        setPlusMenuOpen(false);
   233	      }
   234	    };
   235	    document.addEventListener('mousedown', handler);
   236	    return () => document.removeEventListener('mousedown', handler);
   237	  }, [plusMenuOpen]);
   238	
   239	  useEffect(() => {
   240	    if (!plusMenuOpen) return;
   241	    const frame = window.requestAnimationFrame(() => {
   242	      plusMenuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
   243	    });
   244	    return () => window.cancelAnimationFrame(frame);
   245	  }, [plusMenuOpen]);
   246	
   247	  const handleScroll = useCallback(() => {
   248	    const el = listRef.current;
   249	    if (!el) return;
   250	    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
   251	    setShowScrollBtn(!atBottom);
   252	  }, []);
   253	
   254	  const handlePlusMenuKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
   255	    const menuItems = plusMenuRef.current
   256	      ? Array.from(plusMenuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]'))
   257	      : [];
   258	    if (menuItems.length === 0) return;
   259	
   260	    const activeIndex = menuItems.findIndex((item) => item === document.activeElement);
   261	
   262	    if (e.key === 'Escape') {
   263	      e.preventDefault();
   264	      setPlusMenuOpen(false);
   265	      plusMenuButtonRef.current?.focus();
   266	      return;
   267	    }
   268	
   269	    if (e.key === 'ArrowDown') {
   270	      e.preventDefault();
   271	      const nextIndex = activeIndex >= 0 ? (activeIndex + 1) % menuItems.length : 0;
   272	      menuItems[nextIndex]?.focus();
   273	      return;
   274	    }
   275	
   276	    if (e.key === 'ArrowUp') {
   277	      e.preventDefault();
   278	      const prevIndex = activeIndex >= 0
   279	        ? (activeIndex - 1 + menuItems.length) % menuItems.length
   280	        : menuItems.length - 1;
   281	      menuItems[prevIndex]?.focus();
   282	      return;
   283	    }
   284	
   285	    if ((e.key === 'Enter' || e.key === ' ') && document.activeElement instanceof HTMLElement) {
   286	      if (document.activeElement.getAttribute('role') === 'menuitem') {
   287	        e.preventDefault();
   288	        document.activeElement.click();
   289	      }
   290	    }
   291	  }, []);
   292	
   293	  const onSubmit = async (e: React.FormEvent) => {
   294	    e.preventDefault();
   295	    const sent = await sendMessage(input);
   296	    if (sent) setInput('');
   297	  };
   298	
   299	  const handleSuggestedClick = (question: string) => {
   300	    setInput(question);
   301	    void sendMessage(question).then((sent) => {
   302	      if (sent) setInput('');
   303	    });
   304	  };
   305	
   306	  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
   307	    if (e.key === 'Enter' && !e.shiftKey) {
   308	      e.preventDefault();
   309	      void sendMessage(input).then((sent) => {
   310	        if (sent) setInput('');
   311	      });
   312	    }
   313	  };
   314	
   315	  const handleDemoAuthClick = useCallback(() => {
   316	    trackEvent('upgrade_click', {
   317	      source: 'demo_limit_panel',
   318	      reason: 'demo_message_limit',
   319	      plan: 'plus',
   320	      period: 'monthly',
   321	    });
   322	    openAuthModal({ callbackUrl: '/' });
   323	  }, []);
   324	
   325	  const handleExport = useCallback(() => {
   326	    trackEvent('export_clicked', { source: 'chat_plus_menu', format: 'markdown' });
   327	    const docName = useDocTalkStore.getState().documentName || 'document';
   328	    exportConversationAsMarkdown(messages, docName);
   329	  }, [messages]);
   330	
   331	  const handleExportFormat = useCallback(async (format: 'pdf' | 'docx') => {
   332	    trackEvent('export_clicked', { source: 'chat_plus_menu', format });
   333	    try {
   334	      const { exportSession } = await import('../../lib/api');
   335	      const blob = await exportSession(sessionId, format);
   336	      const url = URL.createObjectURL(blob);
   337	      const a = document.createElement('a');
   338	      a.href = url;
   339	      a.download = `conversation.${format}`;
   340	      document.body.appendChild(a);
   341	      a.click();
   342	      document.body.removeChild(a);
   343	      URL.revokeObjectURL(url);
   344	    } catch (e) {
   345	      console.error('Export failed:', e);
   346	      const copy = errorCopy(e, t, tOr);
   347	      addMessage({
   348	        id: `m_${Date.now()}_exp`,
   349	        role: 'assistant',
   350	        text: copy.body,
   351	        isError: true,
   352	        createdAt: Date.now(),
   353	      });
   354	    }
   355	  }, [addMessage, sessionId, t, tOr]);
   356	
   357	  const [shareLoading, setShareLoading] = useState(false);
   358	  const [shareAnswerLoadingId, setShareAnswerLoadingId] = useState<string | null>(null);
   359	
   360	  const copyShareUrl = useCallback(async (url: string) => {
   361	    try {
   362	      await navigator.clipboard.writeText(url);
   363	      return;
   364	    } catch {
   365	      const textarea = document.createElement('textarea');
   366	      textarea.value = url;
   367	      textarea.setAttribute('readonly', '');
   368	      textarea.style.position = 'fixed';
   369	      textarea.style.opacity = '0';
   370	      document.body.appendChild(textarea);
   371	      textarea.select();
   372	      document.execCommand('copy');
   373	      document.body.removeChild(textarea);
   374	    }
   375	  }, []);
   376	
   377	  const handleShare = useCallback(async () => {
   378	    if (shareLoading) return;
   379	    setShareLoading(true);
   380	    try {
   381	      const { createShare } = await import('../../lib/api');
   382	      const result = await createShare(sessionId);
   383	      await copyShareUrl(result.url);
   384	      trackEvent('share_created', { source: 'chat_panel', plan: userPlan || 'unknown' });
   385	      addMessage({
   386	        id: `m_${Date.now()}_share_ok`,
   387	        role: 'assistant',
   388	        text: tOr('share.copied', 'Link copied to clipboard.'),
   389	        createdAt: Date.now(),
   390	      });
   391	    } catch (e) {
   392	      console.error('Share failed:', e);
   393	      const copy = errorCopy(e, t, tOr);
   394	      addMessage({
   395	        id: `m_${Date.now()}_share_err`,
   396	        role: 'assistant',
   397	        text: copy.body,
   398	        isError: true,
   399	        createdAt: Date.now(),
   400	      });
   401	    } finally {
   402	      setShareLoading(false);
   403	    }
   404	  }, [addMessage, copyShareUrl, sessionId, shareLoading, t, tOr, userPlan]);
   405	
   406	  const handleShareAnswer = useCallback(async (message: Message) => {
   407	    if (!message.shareAnchor || shareAnswerLoadingId) return;
   408	    setShareAnswerLoadingId(message.id);
   409	    try {
   410	      const { createShare } = await import('../../lib/api');
   411	      const result = await createShare(sessionId);
   412	      const answerUrl = withShareAnchor(result.url, message.shareAnchor);
   413	      await copyShareUrl(answerUrl);
   414	      trackEvent('share_created', { source: 'answer_action', plan: userPlan || 'unknown' });
   415	      addMessage({
   416	        id: `m_${Date.now()}_share_answer_ok`,
   417	        role: 'assistant',
   418	        text: tOr('share.answerCopied', 'Answer link copied to clipboard.'),
   419	        createdAt: Date.now(),
   420	      });
   421	    } catch (e) {
   422	      console.error('Answer share failed:', e);
   423	      const copy = errorCopy(e, t, tOr);
   424	      addMessage({
   425	        id: `m_${Date.now()}_share_answer_err`,
   426	        role: 'assistant',
   427	        text: copy.body,
   428	        isError: true,
   429	        createdAt: Date.now(),
   430	      });
   431	    } finally {
   432	      setShareAnswerLoadingId(null);
   433	    }
   434	  }, [addMessage, copyShareUrl, sessionId, shareAnswerLoadingId, t, tOr, userPlan]);
   435	
   436	  // Stable refs for the per-message row callbacks (I21). Previously the
   437	  // arrow functions `() => void regenerateLastResponse()` / `() => void
   438	  // continueGenerating()` / `(msg) => void handleShareAnswer(msg)` were
   439	  // recreated on every render of `ChatPanel`, and `ChatPanel` re-renders
   440	  // every ~50ms during SSE streaming (because the store's messages array
   441	  // mutates on every text flush). Even with `MessageBubble` memoized,
   442	  // those fresh arrow identities broke shallow-prop comparison and
   443	  // forced every historical message to re-run ReactMarkdown + Shiki at
   444	  // streaming cadence — O(n) work per flush. With these stabilized,
   445	  // only the actively-streaming message (the one whose `.text` ref
   446	  // changed) re-renders. The underlying mutations are already
   447	  // useCallback'd in `useChatStream`, so these wrappers stay stable
   448	  // across streaming flushes.
   449	  const handleRegenerateLast = useCallback(() => {
   450	    void regenerateLastResponse();
   451	  }, [regenerateLastResponse]);
   452	  const handleContinueLast = useCallback(() => {
   453	    void continueGenerating();
   454	  }, [continueGenerating]);
   455	  const handleShareAnswerVoid = useCallback((msg: Message) => {
   456	    void handleShareAnswer(msg);
   457	  }, [handleShareAnswer]);
   458	
   459	  const handleAnonShareClick = useCallback(() => {
   460	    trackEvent('upgrade_click', { source: 'demo_share_attempt' });
   461	    // Anonymous transcripts are not preserved through signup (no session
   462	    // adoption yet) — this is a conversion affordance, not a working share.
   463	    openAuthModal();
   464	  }, []);
   465	
   466	  const canUseCustomInstructions = !!onOpenSettings;
   467	  // Show the entry only on surfaces that support the feature. Among those,
   468	  // show the Pro upgrade hook to Free + Plus (Plus was previously hidden, a
   469	  // UX inconsistency); Pro users see the unlocked, functional entry.
   470	  // Anonymous (userPlan=undefined) stays hidden.
   471	  const showCustomInstructions = supportsCustomInstructions && (
   472	    canUseCustomInstructions || userPlan === 'free' || userPlan === 'plus'
   473	  );
   474	  const canUseExport = messages.length > 0 && !isStreaming && (userPlan === 'plus' || userPlan === 'pro');
   475	  const showExportInMenu = messages.length > 0 && !isStreaming;
   476	
   477	  return (
   478	    <div className="dt-chat-shell flex h-full flex-col">
   479	      <PaywallModal
   480	        isOpen={showPaywall}
   481	        onClose={() => setShowPaywall(false)}
   482	        reason={paywallReason}
   483	        currentPlan={userPlan}
   484	      />
   485	      <div className="relative flex-1 min-h-0">
   486	        <div
   487	          ref={listRef}
   488	          onScroll={handleScroll}
   489	          data-tour="chat-area"
   490	          className="dt-chat-scroll h-full overflow-y-auto overflow-x-hidden px-4 pb-10 pt-4 sm:px-6 sm:pb-12 lg:px-7"
   491	        >
   492	          {messages.length === 0 && suggestedQuestions && suggestedQuestions.length > 0 && (
   493	            <div className="flex min-h-full flex-col items-center justify-center px-2 py-8">
   494	              <div className="dt-empty-workbench rounded-[1.75rem] px-5 py-6 sm:px-7 sm:py-7">
   495	                <div className="mb-5 flex items-center justify-between gap-4 border-b border-zinc-200 dark:border-white/10 pb-4">
   496	                  <div>
   497	                    <p className="text-[11px] font-mono uppercase tracking-[0.08em] text-[var(--workbench-muted)]">DocTalk</p>
   498	                    <p className="mt-1 text-sm font-medium text-[var(--workbench-ink)]">{t('chat.trySuggested')}</p>
   499	                  </div>
   500	                  <div className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-white/14 dark:bg-white/8 dark:text-white/72 text-xs font-mono font-semibold">

DEMO CLIENT/NAV
     1	"use client";
     2	
     3	import { useEffect, useState } from 'react';
     4	import Link from 'next/link';
     5	import { ArrowRight, BookOpen, FileCheck2, FileSignature, FileText, Loader2, Quote } from 'lucide-react';
     6	import { useLocale } from '../../i18n';
     7	import { getDemoDocuments, type DemoDocument } from '../../lib/api';
     8	import { usePageTitle } from '../../lib/usePageTitle';
     9	import MarketingShell from '../../components/marketing/MarketingShell';
    10	import EdPageHero from '../../components/marketing/EdPageHero';
    11	import EdSection from '../../components/marketing/EdSection';
    12	import EdStepRow from '../../components/marketing/EdStepRow';
    13	
    14	const SAMPLE_CONFIG: Record<string, {
    15	  icon: typeof FileText;
    16	  titleKey: string;
    17	  descKey: string;
    18	  questionKey: string;
    19	  badge: string;
    20	  pages: string;
    21	}> = {
    22	  'alphabet-earnings': {
    23	    icon: FileText,
    24	    titleKey: 'demo.sample.earnings.title',
    25	    descKey: 'demo.sample.earnings.desc',
    26	    questionKey: 'demo.sample.earnings.question',
    27	    badge: 'Finance',
    28	    pages: 'Q4 report',
    29	  },
    30	  'attention-paper': {
    31	    icon: BookOpen,
    32	    titleKey: 'demo.sample.paper.title',
    33	    descKey: 'demo.sample.paper.desc',
    34	    questionKey: 'demo.sample.paper.question',
    35	    badge: 'Research',
    36	    pages: 'AI paper',
    37	  },
    38	  'court-filing': {
    39	    icon: FileSignature,
    40	    titleKey: 'demo.sample.court.title',
    41	    descKey: 'demo.sample.court.desc',
    42	    questionKey: 'demo.sample.court.question',
    43	    badge: 'Legal',
    44	    pages: 'Court filing',
    45	  },
    46	};
    47	
    48	export default function DemoPageClient() {
    49	  const { t, tOr } = useLocale();
    50	  usePageTitle(t('footer.demo'));
    51	  const [docs, setDocs] = useState<DemoDocument[]>([]);
    52	  const [loading, setLoading] = useState(true);
    53	  const [error, setError] = useState(false);
    54	
    55	  const fetchDocs = () => {
    56	    setLoading(true);
    57	    setError(false);
    58	    getDemoDocuments()
    59	      .then(setDocs)
    60	      .catch(() => setError(true))
    61	      .finally(() => setLoading(false));
    62	  };
    63	
    64	  useEffect(() => {
    65	    fetchDocs();
    66	  }, []);
    67	
    68	  const docsBySlug = new Map(docs.map((doc) => [doc.slug, doc]));
    69	
    70	  return (
    71	    <MarketingShell
    72	      breadcrumb={[
    73	        { label: t('useCasesHub.breadcrumb.home'), href: '/' },
    74	        { label: t('footer.demo') },
    75	      ]}
    76	    >
    77	      <EdPageHero
    78	        eyebrow={tOr('demo.eyebrow', 'Public demo')}
    79	        title={t('demo.title')}
    80	        lede={t('demo.subtitle')}
    81	        meta={
    82	          <div className="flex gap-4 flex-wrap">
    83	            <span className="inline-flex items-center gap-2">
    84	              <FileCheck2
    85	                aria-hidden="true"
    86	                size={14}
    87	                style={{ color: 'var(--ed-ink-3)' }}
    88	              />
    89	              <span className="ed-caption">{t('demo.freeMessages')}</span>
    90	            </span>
    91	            <span className="inline-flex items-center gap-2">
    92	              <Quote
    93	                aria-hidden="true"
    94	                size={14}
    95	                style={{ color: 'var(--ed-ink-3)' }}
    96	              />
    97	              <span className="ed-caption">
    98	                {tOr('demo.citationPromise', 'Click citations to inspect the source')}
    99	              </span>
   100	            </span>
   101	          </div>
   102	        }
   103	      />
   104	
   105	      <EdSection title={tOr('demo.flow.title', 'What you will test')}>
   106	        <EdStepRow
   107	          steps={[
   108	            { title: tOr('demo.flow.step1', 'Open a prepared document'), body: '' },
   109	            { title: tOr('demo.flow.step2', 'Ask the suggested question'), body: '' },
   110	            { title: tOr('demo.flow.step3', 'Jump from answer to source'), body: '' },
   111	          ]}
   112	        />
   113	      </EdSection>
   114	
   115	      <EdSection alt label={tOr('demo.samplesLabel', 'Sample documents')}>
   116	        {error && (
   117	          <div
   118	            style={{
   119	              border: '1px solid var(--ed-rule)',
   120	              padding: '14px 16px',
   121	              marginBottom: '24px',
   122	            }}
   123	          >
   124	            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
   125	              <span className="ed-body" style={{ color: 'var(--ed-ochre)' }}>
   126	                {tOr('demo.loadError', 'Demo documents could not be loaded.')}
   127	              </span>
   128	              <button
   129	                type="button"
   130	                onClick={fetchDocs}
   131	                className="ed-caption inline-flex items-center justify-center shrink-0"
   132	                style={{
   133	                  border: '1px solid var(--ed-rule)',
   134	                  background: 'var(--ed-paper)',
   135	                  color: 'var(--ed-ink)',
   136	                  padding: '7px 14px',
   137	                }}
   138	              >
   139	                {tOr('common.retry', 'Retry')}
   140	              </button>
   141	            </div>
   142	          </div>
   143	        )}
   144	
   145	        <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: '16px' }}>
   146	          {Object.entries(SAMPLE_CONFIG).map(([slug, config]) => {
   147	            const doc = docsBySlug.get(slug);
   148	            const Icon = config.icon;
   149	            const isReady = Boolean(doc && doc.status === 'ready');
   150	            const isPending = loading || Boolean(doc && doc.status !== 'ready');
   151	            const suggestedQuestion = t(config.questionKey);
   152	            const cardContent = (
   153	              <>
   154	                <div className="flex items-center justify-between">
   155	                  <span className="ed-caption uppercase">
   156	                    {tOr(`demo.sample.${slug}.badge`, config.badge)}
   157	                  </span>
   158	                  <span className="ed-caption">
   159	                    {tOr(`demo.sample.${slug}.pages`, config.pages)}
   160	                  </span>
   161	                </div>
   162	
   163	                <div
   164	                  className="flex items-center justify-between gap-3"
   165	                  style={{ marginTop: '18px' }}
   166	                >
   167	                  <div
   168	                    style={{
   169	                      width: '44px',
   170	                      height: '44px',
   171	                      border: '1px solid var(--ed-rule)',
   172	                      background: 'var(--ed-paper-2)',
   173	                      display: 'flex',
   174	                      alignItems: 'center',
   175	                      justifyContent: 'center',
   176	                    }}
   177	                  >
   178	                    <Icon
   179	                      aria-hidden="true"
   180	                      size={22}
   181	                      style={{ color: 'var(--ed-ink-2)' }}
   182	                    />
   183	                  </div>
   184	                  {isPending && (
   185	                    <span
   186	                      className="ed-caption inline-flex shrink-0 items-center gap-1.5"
   187	                    >
   188	                      <Loader2 aria-hidden="true" size={12} className="animate-spin" />
   189	                      {loading ? tOr('common.loading', 'Loading') : t('demo.processing')}
   190	                    </span>
   191	                  )}
   192	                </div>
   193	
   194	                <h3 className="ed-h3" style={{ marginTop: '16px' }}>
   195	                  {t(config.titleKey)}
   196	                </h3>
   197	                <p className="ed-body" style={{ marginTop: '8px' }}>
   198	                  {t(config.descKey)}
   199	                </p>
   200	
   201	                <div
   202	                  style={{
   203	                    marginTop: '18px',
   204	                    border: '1px solid var(--ed-rule)',
   205	                    background: 'var(--ed-paper)',
   206	                    padding: '12px 14px',
   207	                  }}
   208	                >
   209	                  <p className="ed-caption uppercase">
   210	                    {tOr('demo.suggestedQuestion', 'Suggested question')}
   211	                  </p>
   212	                  <p
   213	                    className="ed-body"
   214	                    style={{
   215	                      marginTop: '8px',
   216	                      fontFamily: 'var(--dt-serif)',
   217	                      fontStyle: 'italic',
   218	                    }}
   219	                  >
   220	                    &ldquo;{suggestedQuestion}&rdquo;
   221	                  </p>
   222	                </div>
   223	
   224	                <div
   225	                  className="flex items-center justify-between gap-3"
   226	                  style={{
   227	                    marginTop: 'auto',
   228	                    paddingTop: '18px',
   229	                  }}
   230	                >
   231	                  <span className="ed-caption">
   232	                    {isReady ? tOr('demo.ready', 'Ready to open') : tOr('demo.preparing', 'Preparing sample')}
   233	                  </span>
   234	                  <span
   235	                    className="inline-flex items-center gap-1.5"
   236	                    style={{
   237	                      fontFamily: 'var(--font-inter), sans-serif',
   238	                      fontSize: '14px',
   239	                      fontWeight: 500,
   240	                      color: 'var(--ed-ink)',
   241	                    }}
   242	                  >
   243	                    {tOr('demo.openSample', 'Open sample')}
   244	                    <ArrowRight aria-hidden="true" size={15} />
   245	                  </span>
   246	                </div>
   247	              </>
   248	            );
   249	
   250	            return isReady && doc ? (
   251	              <Link
   252	                key={slug}
   253	                href={`/d/${doc.document_id}?question=${encodeURIComponent(suggestedQuestion)}`}
   254	                className="ed-card flex flex-col h-full"
   255	                style={{ minHeight: '390px' }}
   256	              >
   257	                {cardContent}
   258	              </Link>
   259	            ) : (
   260	              <div
   261	                key={slug}
   262	                className="ed-card flex flex-col h-full"
   263	                style={{ minHeight: '390px', opacity: 0.7 }}
   264	              >
   265	                {cardContent}
   266	              </div>
   267	            );
   268	          })}
   269	        </div>
   270	
   271	        <p className="ed-caption" style={{ marginTop: '32px' }}>
   272	          {t('demo.hint')}
   273	        </p>
   274	      </EdSection>
   275	    </MarketingShell>
   276	  );
   277	}

DOCUMENT DEMO INITIAL QUESTION
frontend/src/components/Chat/ChatPanel.tsx:121:  initialQuestion?: string;
frontend/src/components/Chat/ChatPanel.tsx:125:  autoSubmitInitialQuestion?: boolean;
frontend/src/components/Chat/ChatPanel.tsx:134:export default function ChatPanel({ sessionId, onCitationClick, onPreviewLayoutTranslation, maxUserMessages, suggestedQuestions, initialQuestion, onOpenSettings, hasCustomInstructions, userPlan, autoSubmitInitialQuestion = false, supportsCustomInstructions = true }: ChatPanelProps) {
frontend/src/components/Chat/ChatPanel.tsx:151:  const initialQuestionSubmittedRef = useRef<string | null>(null);
frontend/src/components/Chat/ChatPanel.tsx:201:    if (!initialQuestion || hasConversationMessages || isStreaming) return;
frontend/src/components/Chat/ChatPanel.tsx:203:    if (autoSubmitInitialQuestion) {
frontend/src/components/Chat/ChatPanel.tsx:204:      const autoSubmitKey = `${sessionId}:${initialQuestion}`;
frontend/src/components/Chat/ChatPanel.tsx:206:        initialQuestionSubmittedRef.current === initialQuestion
frontend/src/components/Chat/ChatPanel.tsx:209:      initialQuestionSubmittedRef.current = initialQuestion;
frontend/src/components/Chat/ChatPanel.tsx:211:      void sendMessage(initialQuestion).then((sent) => {
frontend/src/components/Chat/ChatPanel.tsx:213:          initialQuestionSubmittedRef.current = null;
frontend/src/components/Chat/ChatPanel.tsx:215:          setInput(initialQuestion);
frontend/src/components/Chat/ChatPanel.tsx:223:    setInput(initialQuestion);
frontend/src/components/Chat/ChatPanel.tsx:225:  }, [autoSubmitInitialQuestion, initialQuestion, input, messages, isStreaming, sendMessage, sessionId]);
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:88:  const initialQuestion = searchParams.get('question') || undefined;
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:367:    <ChatPanel sessionId={sessionId} onCitationClick={handleCitationClick} onPreviewLayoutTranslation={handlePreviewLayoutTranslation} maxUserMessages={isDemo && !isLoggedIn ? 5 : undefined} suggestedQuestions={suggestedQuestions.length > 0 ? suggestedQuestions : undefined} initialQuestion={initialQuestion} autoSubmitInitialQuestion={isDemo} onOpenSettings={canUseCustomInstructions ? () => setShowInstructions(true) : undefined} hasCustomInstructions={!!customInstructions} userPlan={userPlan} />
frontend/src/app/demo/DemoPageClient.tsx:253:                href={`/d/${doc.document_id}?question=${encodeURIComponent(suggestedQuestion)}`}

exec
/bin/zsh -lc "for key in 'demo.sample.alphabet-earnings.badge' 'demo.sample.alphabet-earnings.pages' 'demo.sample.attention-paper.badge' 'demo.sample.attention-paper.pages' 'demo.sample.court-filing.badge' 'demo.sample.court-filing.pages' 'demo.eyebrow' 'demo.flow.title' 'demo.samplesLabel'; do printf '%s ' \""'$key"; rg -l -F "'"\\\""'$key'"\\\"\" frontend/src/i18n/locales/*.json | wc -l | tr -d ' '; done; printf '\\nDEMO KEYS EN\\n'; rg -n '\"demo\\.' frontend/src/i18n/locales/en.json | head -n 160; printf '\\nMARKETING SHELL TREE\\n'; nl -ba frontend/src/components/marketing/MarketingShell.tsx | sed -n '1,260p'; nl -ba frontend/src/components/marketing/EditorialMarketingHeader.tsx | sed -n '1,300p'; nl -ba frontend/src/components/marketing/EditorialFooter.tsx | sed -n '1,320p' 2>/dev/null || true; printf '\\nSEO AND SITEMAP\\n'; rg -n \"LOCALIZED_PATHS|localized|alternates|hreflang|sitemap\" frontend/src/app frontend/src/lib frontend/src/i18n -g '*.{ts,tsx}' | head -n 400" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
demo.sample.alphabet-earnings.badge 11
demo.sample.alphabet-earnings.pages 11
demo.sample.attention-paper.badge 11
demo.sample.attention-paper.pages 11
demo.sample.court-filing.badge 11
demo.sample.court-filing.pages 11
demo.eyebrow 11
demo.flow.title 11
demo.samplesLabel 11

DEMO KEYS EN
242:  "demo.notFound": "Demo document not found",
243:  "demo.viewAll": "View all demos",
244:  "demo.title": "Choose a sample document",
245:  "demo.subtitle": "Experience DocTalk with these example PDFs",
246:  "demo.hint": "Tip: Click citation numbers [1] to jump to the source and see highlights",
247:  "demo.backToHome": "Back to home",
248:  "demo.sample.earnings.title": "Alphabet Earnings Release",
249:  "demo.sample.earnings.desc": "Q4 2025 Quarterly Earnings",
250:  "demo.sample.earnings.question": "What was Alphabet's revenue this quarter?",
251:  "demo.sample.paper.title": "Attention Is All You Need",
252:  "demo.sample.paper.desc": "Foundational AI/ML research paper",
253:  "demo.sample.paper.question": "How does multi-head attention work?",
254:  "demo.sample.court.title": "US District Court Filing",
255:  "demo.sample.court.desc": "Federal civil case document",
256:  "demo.sample.court.question": "What are the key claims in this filing?",
257:  "demo.viewing": "Viewing",
258:  "demo.loginToSave": "Sign in to save",
259:  "demo.loggedIn": "Signed in",
260:  "demo.emptyState": "Ask a question about this document",
261:  "demo.remaining": "{count}/{total} messages remaining",
262:  "demo.loginForMore": "Sign in for free credits",
263:  "demo.limitReached": "Sign in to continue",
264:  "demo.questionsRemaining": "{remaining}/{total} questions remaining",
265:  "demo.signInForUnlimited": "Sign in for free credits",
266:  "demo.signInToContinue": "Sign in to continue chatting",
267:  "demo.limitReachedMessage": "You've used all 5 demo questions. Sign in to upload your own documents with free credits.",
268:  "demo.limitPanel.title": "Ready to use DocTalk on your own files?",
269:  "demo.limitPanel.body": "Create a free account to upload documents, keep chats, and start with free credits.",
270:  "demo.limitPanel.cta": "Upload your own document",
271:  "demo.processing": "Processing...",
272:  "demo.freeMessages": "5 free messages per document · Sign in to upload your own docs",
273:  "demo.rateLimitMessage": "Too many requests. Please wait a moment and try again.",
2568:  "demo.eyebrow": "Public demo",
2569:  "demo.citationPromise": "Click citations to inspect the source",
2570:  "demo.flow.title": "What you will test",
2571:  "demo.flow.badge": "Cited answers",
2572:  "demo.flow.step1": "Open a prepared document",
2573:  "demo.flow.step2": "Ask the suggested question",
2574:  "demo.flow.step3": "Jump from answer to source",
2575:  "demo.sample.alphabet-earnings.badge": "Finance",
2576:  "demo.sample.alphabet-earnings.pages": "Q4 report",
2577:  "demo.sample.attention-paper.badge": "Research",
2578:  "demo.sample.attention-paper.pages": "AI paper",
2579:  "demo.sample.court-filing.badge": "Legal",
2580:  "demo.sample.court-filing.pages": "Court filing",
2581:  "demo.pageCitations": "Page citations",
2582:  "demo.suggestedQuestion": "Suggested question",
2583:  "demo.ready": "Ready to open",
2584:  "demo.preparing": "Preparing sample",
2585:  "demo.openSample": "Open sample",
2586:  "demo.loadError": "Demo documents could not be loaded.",
3523:  "demo.samplesLabel": "Sample documents",

MARKETING SHELL TREE
     1	"use client";
     2	
     3	import EditorialMarketingHeader from "./EditorialMarketingHeader";
     4	import type { Crumb } from "./EditorialMarketingHeader";
     5	import EditorialFooter from "../landing/EditorialFooter";
     6	import type { ChromeStrings } from "../../i18n/chrome";
     7	
     8	export default function MarketingShell({
     9	  breadcrumb,
    10	  chrome,
    11	  children,
    12	}: {
    13	  breadcrumb?: Crumb[];
    14	  /**
    15	   * Server-resolved chrome strings for localized pages. When provided, the
    16	   * header/footer render translated nav/footer text in the initial HTML. When
    17	   * omitted (not-yet-migrated pages), the chrome falls back to client `useLocale()`.
    18	   */
    19	  chrome?: ChromeStrings;
    20	  children: React.ReactNode;
    21	}) {
    22	  return (
    23	    <div className="dt-editorial min-h-screen flex flex-col">
    24	      <EditorialMarketingHeader breadcrumb={breadcrumb} chrome={chrome} />
    25	      <main className="flex-1">{children}</main>
    26	      <EditorialFooter chrome={chrome} />
    27	    </div>
    28	  );
    29	}
     1	"use client";
     2	
     3	import EditorialHeaderBase from "./EditorialHeaderBase";
     4	import type { Crumb } from "./EditorialHeaderBase";
     5	import type { ChromeStrings } from "../../i18n/chrome";
     6	
     7	// Re-export Crumb so existing consumers (`MarketingShell`) keep working.
     8	export type { Crumb };
     9	
    10	interface EditorialMarketingHeaderProps {
    11	  breadcrumb?: Crumb[];
    12	  chrome?: ChromeStrings;
    13	}
    14	
    15	/**
    16	 * Inner-page variant of the editorial masthead.
    17	 * Adds the breadcrumb row below the masthead.
    18	 * All shared markup lives in EditorialHeaderBase.
    19	 */
    20	export default function EditorialMarketingHeader({
    21	  breadcrumb,
    22	  chrome,
    23	}: EditorialMarketingHeaderProps) {
    24	  return <EditorialHeaderBase breadcrumb={breadcrumb} chrome={chrome} />;
    25	}
nl: frontend/src/components/marketing/EditorialFooter.tsx: No such file or directory

SEO AND SITEMAP
frontend/src/i18n/server.ts:47: * client LocaleProvider for a localized server page (e.g. the landing) with just
frontend/src/i18n/LocaleProvider.tsx:65:   * Server-seeded locale + messages for localized server pages (e.g. the `/de`
frontend/src/i18n/LocaleProvider.tsx:85:    // Seeded providers (localized server pages) keep their server locale; only
frontend/src/i18n/routing.ts:17:// All locales that participate in hreflang (the unprefixed default + the prefixed set).
frontend/src/i18n/routing.ts:27: * keeps links/hreflang/sitemap honest — a path is only ever prefixed once its
frontend/src/i18n/routing.ts:28: * localized page exists, so we never emit a `/de/...` link that 404s.
frontend/src/i18n/routing.ts:29: * Grows as pages are localized (Phase A: lawyers only).
frontend/src/i18n/routing.ts:31:export const LOCALIZED_PATHS: ReadonlySet<string> = new Set<string>([
frontend/src/i18n/routing.ts:75:  return LOCALIZED_PATHS.has(normalizePath(path));
frontend/src/i18n/routing.ts:81: *   localizedHref('de', '/use-cases/lawyers') -> '/de/use-cases/lawyers'
frontend/src/i18n/routing.ts:82: *   localizedHref('de', '/')                  -> '/de'
frontend/src/i18n/routing.ts:83: *   localizedHref('en', '/pricing')           -> '/pricing'
frontend/src/i18n/routing.ts:85:export function localizedHref(locale: string, path: string): string {
frontend/src/i18n/routing.ts:93: * Like `localizedHref`, but only prefixes paths that actually have a localized
frontend/src/i18n/routing.ts:94: * page (`LOCALIZED_PATHS`). Use this for links/CTAs that may point at pages not
frontend/src/i18n/routing.ts:95: * yet localized — they stay on the English URL instead of 404ing.
frontend/src/i18n/routing.ts:97:export function localizedHrefIfAvailable(locale: string, path: string): string {
frontend/src/i18n/routing.ts:99:  return isLocalizedPath(clean) ? localizedHref(locale, normalizePath(clean)) : clean;
frontend/src/lib/seo.ts:2:import { URL_LOCALES, localizedHref } from '../i18n/routing';
frontend/src/lib/seo.ts:23:   * When true, emit hreflang `alternates.languages` for every marketing locale
frontend/src/lib/seo.ts:27:  localized?: boolean;
frontend/src/lib/seo.ts:30:/** hreflang map: unprefixed `en` default + each URL locale + `x-default` → en. */
frontend/src/lib/seo.ts:33:    en: absoluteUrl(localizedHref('en', path)),
frontend/src/lib/seo.ts:36:    languages[loc] = absoluteUrl(localizedHref(loc, path));
frontend/src/lib/seo.ts:38:  languages['x-default'] = absoluteUrl(localizedHref('en', path));
frontend/src/lib/seo.ts:110:  localized,
frontend/src/lib/seo.ts:114:  const canonicalPath = localized ? localizedHref(pageLocale, path) : path;
frontend/src/lib/seo.ts:120:    alternates: {
frontend/src/lib/seo.ts:122:      ...(localized ? { languages: buildLanguageAlternates(path) } : {}),
frontend/src/lib/marketingLocalePage.tsx:10: * for the localized marketing rollout: builds locale metadata (title/description
frontend/src/lib/marketingLocalePage.tsx:11: * from translation keys + hreflang via buildMarketingMetadata), validates the
frontend/src/lib/marketingLocalePage.tsx:47:      localized: true,
frontend/src/app/pricing/page.tsx:10:  localized: true,
frontend/src/app/pricing/PricingPageContent.tsx:6:import { localizedHrefIfAvailable } from '../../i18n/routing';
frontend/src/app/pricing/PricingPageContent.tsx:125:  const href = (p: string) => localizedHrefIfAvailable(locale, p);
frontend/src/app/page.tsx:11:  localized: true,
frontend/src/app/compare/page.tsx:10:  localized: true,
frontend/src/app/compare/humata/HumataContent.tsx:6:import { localizedHrefIfAvailable } from '../../../i18n/routing';
frontend/src/app/compare/humata/HumataContent.tsx:20:  const href = (p: string) => localizedHrefIfAvailable(locale, p);
frontend/src/app/compare/humata/page.tsx:10:  localized: true,
frontend/src/app/features/layout-translation/page.tsx:10:  localized: true,
frontend/src/app/layout.tsx:43:  alternates: {
frontend/src/app/sitemap.ts:3:import { LOCALIZED_PATHS, URL_LOCALES, localizedHref } from "../i18n/routing";
frontend/src/app/sitemap.ts:7:/** Reciprocal hreflang map for a localized path (unprefixed en + each URL locale + x-default). */
frontend/src/app/sitemap.ts:11:    languages[loc] = `${BASE_URL}${localizedHref(loc, path)}`;
frontend/src/app/sitemap.ts:17:export default function sitemap(): MetadataRoute.Sitemap {
frontend/src/app/sitemap.ts:82:  // International SEO: attach hreflang to the en entry of each localized path,
frontend/src/app/sitemap.ts:86:    return LOCALIZED_PATHS.has(path)
frontend/src/app/sitemap.ts:87:      ? { ...entry, alternates: { languages: languagesFor(path) } }
frontend/src/app/sitemap.ts:92:  for (const path of LOCALIZED_PATHS) {
frontend/src/app/sitemap.ts:96:        url: `${BASE_URL}${localizedHref(loc, path)}`,
frontend/src/app/sitemap.ts:100:        alternates: { languages },
frontend/src/app/compare/chatpdf/page.tsx:10:  localized: true,
frontend/src/app/compare/chatpdf/ChatpdfContent.tsx:6:import { localizedHrefIfAvailable } from '../../../i18n/routing';
frontend/src/app/compare/chatpdf/ChatpdfContent.tsx:20:  const href = (p: string) => localizedHrefIfAvailable(locale, p);
frontend/src/app/features/free-demo/page.tsx:10:  localized: true,
frontend/src/app/compare/CompareHubContent.tsx:5:import { localizedHrefIfAvailable } from '../../i18n/routing';
frontend/src/app/compare/CompareHubContent.tsx:17:  const href = (p: string) => localizedHrefIfAvailable(locale, p);
frontend/src/app/compare/notebooklm/page.tsx:10:  localized: true,
frontend/src/app/features/multilingual/page.tsx:10:  localized: true,
frontend/src/app/compare/pdf-ai/page.tsx:10:  localized: true,
frontend/src/app/features/layout-translation/LayoutTranslationPageContent.tsx:4:import { localizedHrefIfAvailable } from '../../../i18n/routing';
frontend/src/app/features/layout-translation/LayoutTranslationPageContent.tsx:30:  const href = (p: string) => localizedHrefIfAvailable(locale, p);
frontend/src/app/features/free-demo/FreeDemoContent.tsx:5:import { localizedHrefIfAvailable } from '../../../i18n/routing';
frontend/src/app/features/free-demo/FreeDemoContent.tsx:28:  const href = (p: string) => localizedHrefIfAvailable(locale, p);
frontend/src/app/[locale]/page.tsx:8:import { isUrlLocale, localizedHref } from '../../i18n/routing';
frontend/src/app/[locale]/page.tsx:29:    localized: true,
frontend/src/app/[locale]/page.tsx:46:        url: absoluteUrl(localizedHref(locale, '/')),
frontend/src/app/use-cases/page.tsx:10:  localized: true,
frontend/src/app/compare/notebooklm/NotebooklmContent.tsx:6:import { localizedHrefIfAvailable } from '../../../i18n/routing';
frontend/src/app/compare/notebooklm/NotebooklmContent.tsx:20:  const href = (p: string) => localizedHrefIfAvailable(locale, p);
frontend/src/app/compare/pdf-ai/PdfaiContent.tsx:6:import { localizedHrefIfAvailable } from '../../../i18n/routing';
frontend/src/app/compare/pdf-ai/PdfaiContent.tsx:20:  const href = (p: string) => localizedHrefIfAvailable(locale, p);
frontend/src/app/alternatives/askyourpdf/page.tsx:10:  localized: true,
frontend/src/app/trust/page.tsx:10:  localized: true,
frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsContent.tsx:6:import { localizedHrefIfAvailable } from '../../../i18n/routing';
frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsContent.tsx:22:  const href = (p: string) => localizedHrefIfAvailable(locale, p);
frontend/src/app/features/multilingual/MultilingualContent.tsx:5:import { localizedHrefIfAvailable } from '../../../i18n/routing';
frontend/src/app/features/multilingual/MultilingualContent.tsx:34:  const href = (p: string) => localizedHrefIfAvailable(locale, p);
frontend/src/app/trust/TrustPageContent.tsx:21:import { localizedHrefIfAvailable } from "../../i18n/routing";
frontend/src/app/trust/TrustPageContent.tsx:71:  const href = (p: string) => localizedHrefIfAvailable(locale, p);
frontend/src/app/features/page.tsx:10:  localized: true,
frontend/src/app/compare/askyourpdf/page.tsx:10:  localized: true,
frontend/src/app/features/FeaturesHubContent.tsx:5:import { localizedHrefIfAvailable } from '../../i18n/routing';
frontend/src/app/features/FeaturesHubContent.tsx:25:  const href = (p: string) => localizedHrefIfAvailable(locale, p);
frontend/src/app/alternatives/page.tsx:10:  localized: true,
frontend/src/app/auth/layout.tsx:6:  alternates: {
frontend/src/app/alternatives/chatpdf/page.tsx:10:  localized: true,
frontend/src/app/alternatives/pdf-ai/page.tsx:10:  localized: true,
frontend/src/app/compare/askyourpdf/AskyourpdfContent.tsx:6:import { localizedHrefIfAvailable } from '../../../i18n/routing';
frontend/src/app/compare/askyourpdf/AskyourpdfContent.tsx:20:  const href = (p: string) => localizedHrefIfAvailable(locale, p);
frontend/src/app/alternatives/chatpdf/ChatpdfAltsContent.tsx:6:import { localizedHrefIfAvailable } from '../../../i18n/routing';
frontend/src/app/alternatives/chatpdf/ChatpdfAltsContent.tsx:22:  const href = (p: string) => localizedHrefIfAvailable(locale, p);
frontend/src/app/alternatives/pdf-ai/PdfAiAltsContent.tsx:6:import { localizedHrefIfAvailable } from '../../../i18n/routing';
frontend/src/app/alternatives/pdf-ai/PdfAiAltsContent.tsx:22:  const href = (p: string) => localizedHrefIfAvailable(locale, p);
frontend/src/app/use-cases/finance/page.tsx:10:  localized: true,
frontend/src/app/features/performance-modes/PerformanceModesContent.tsx:5:import { localizedHrefIfAvailable } from '../../../i18n/routing';
frontend/src/app/features/performance-modes/PerformanceModesContent.tsx:22:  const href = (p: string) => localizedHrefIfAvailable(locale, p);
frontend/src/app/blog/[slug]/BlogPostClient.tsx:210:  const localizedCategory = getBlogCategoryLabel(t, post.category);
frontend/src/app/blog/[slug]/BlogPostClient.tsx:216:        { label: localizedCategory, href: `/blog/category/${post.category}` },
frontend/src/app/blog/[slug]/BlogPostClient.tsx:237:              {localizedCategory}
frontend/src/app/features/citations/page.tsx:10:  localized: true,
frontend/src/app/alternatives/notebooklm/NotebooklmAltsContent.tsx:6:import { localizedHrefIfAvailable } from '../../../i18n/routing';
frontend/src/app/alternatives/notebooklm/NotebooklmAltsContent.tsx:21:  const href = (p: string) => localizedHrefIfAvailable(locale, p);
frontend/src/app/alternatives/notebooklm/page.tsx:10:  localized: true,
frontend/src/app/alternatives/humata/page.tsx:10:  localized: true,
frontend/src/app/alternatives/AlternativesHubContent.tsx:5:import { localizedHrefIfAvailable } from '../../i18n/routing';
frontend/src/app/alternatives/AlternativesHubContent.tsx:17:  const href = (p: string) => localizedHrefIfAvailable(locale, p);
frontend/src/app/use-cases/finance/FinanceContent.tsx:6:import { localizedHrefIfAvailable } from '../../../i18n/routing';
frontend/src/app/use-cases/finance/FinanceContent.tsx:64:  const href = (p: string) => localizedHrefIfAvailable(locale, p);
frontend/src/app/features/performance-modes/page.tsx:10:  localized: true,
frontend/src/app/features/citations/CitationsContent.tsx:5:import { localizedHrefIfAvailable } from '../../../i18n/routing';
frontend/src/app/features/citations/CitationsContent.tsx:30:  const href = (p: string) => localizedHrefIfAvailable(locale, p);
frontend/src/app/alternatives/humata/HumataAltsContent.tsx:6:import { localizedHrefIfAvailable } from '../../../i18n/routing';
frontend/src/app/alternatives/humata/HumataAltsContent.tsx:21:  const href = (p: string) => localizedHrefIfAvailable(locale, p);
frontend/src/app/api/indexnow/route.ts:2:import sitemap from "@/app/sitemap";
frontend/src/app/api/indexnow/route.ts:27:  const entries = sitemap();
frontend/src/app/use-cases/teachers/page.tsx:10:  localized: true,
frontend/src/app/blog/category/[category]/CategoryClient.tsx:62:  const localizedLabel = getBlogCategoryLabel(t, category);
frontend/src/app/blog/category/[category]/CategoryClient.tsx:63:  const localizedDescription = t(`blog.category.description.${category}`);
frontend/src/app/blog/category/[category]/CategoryClient.tsx:65:    localizedDescription === `blog.category.description.${category}` ? description : localizedDescription;
frontend/src/app/blog/category/[category]/CategoryClient.tsx:72:        { label: localizedLabel },
frontend/src/app/blog/category/[category]/CategoryClient.tsx:77:        title={localizedLabel}
frontend/src/app/blog/category/[category]/CategoryClient.tsx:157:                    {localizedLabel}
frontend/src/app/use-cases/hr-contracts/page.tsx:10:  localized: true,
frontend/src/app/use-cases/teachers/TeachersContent.tsx:6:import { localizedHrefIfAvailable } from '../../../i18n/routing';
frontend/src/app/use-cases/teachers/TeachersContent.tsx:33:  const href = (p: string) => localizedHrefIfAvailable(locale, p);
frontend/src/app/features/multi-format/page.tsx:10:  localized: true,
frontend/src/app/use-cases/real-estate/RealEstateContent.tsx:6:import { localizedHrefIfAvailable } from '../../../i18n/routing';
frontend/src/app/use-cases/real-estate/RealEstateContent.tsx:35:  const href = (p: string) => localizedHrefIfAvailable(locale, p);
frontend/src/app/[locale]/demo/page.tsx:28:// state), so — unlike the pure-server `Content` components other localized
frontend/src/app/use-cases/hr-contracts/HrContractsContent.tsx:6:import { localizedHrefIfAvailable } from '../../../i18n/routing';
frontend/src/app/use-cases/hr-contracts/HrContractsContent.tsx:30:  const href = (p: string) => localizedHrefIfAvailable(locale, p);
frontend/src/app/use-cases/UseCasesHubContent.tsx:6:import { localizedHrefIfAvailable } from '../../i18n/routing';
frontend/src/app/use-cases/UseCasesHubContent.tsx:31:  const href = (p: string) => localizedHrefIfAvailable(locale, p);
frontend/src/app/[locale]/layout.tsx:12: * `/d/`, `/collections`, …) is intentionally NOT localized by URL.
frontend/src/app/features/multi-format/MultiFormatContent.tsx:5:import { localizedHrefIfAvailable } from '../../../i18n/routing';
frontend/src/app/features/multi-format/MultiFormatContent.tsx:33:  const href = (p: string) => localizedHrefIfAvailable(locale, p);
frontend/src/app/use-cases/lawyers/page.tsx:11:  localized: true,
frontend/src/app/use-cases/real-estate/page.tsx:10:  localized: true,
frontend/src/app/use-cases/healthcare/page.tsx:10:  localized: true,
frontend/src/app/use-cases/lawyers/LawyersContent.tsx:28:import { localizedHrefIfAvailable } from '../../../i18n/routing';
frontend/src/app/use-cases/lawyers/LawyersContent.tsx:51:  const href = (path: string) => localizedHrefIfAvailable(locale, path);
frontend/src/app/use-cases/healthcare/HealthcareContent.tsx:6:import { localizedHrefIfAvailable } from '../../../i18n/routing';
frontend/src/app/use-cases/healthcare/HealthcareContent.tsx:34:  const href = (p: string) => localizedHrefIfAvailable(locale, p);
frontend/src/app/use-cases/lawyers/LawyersJsonLd.tsx:3:import { localizedHrefIfAvailable } from '../../../i18n/routing';
frontend/src/app/use-cases/lawyers/LawyersJsonLd.tsx:13:  const url = (path: string) => absoluteUrl(localizedHrefIfAvailable(locale, path));
frontend/src/app/use-cases/consultants/ConsultantsContent.tsx:6:import { localizedHrefIfAvailable } from '../../../i18n/routing';
frontend/src/app/use-cases/consultants/ConsultantsContent.tsx:35:  const href = (p: string) => localizedHrefIfAvailable(locale, p);
frontend/src/app/use-cases/compliance/ComplianceContent.tsx:6:import { localizedHrefIfAvailable } from '../../../i18n/routing';
frontend/src/app/use-cases/compliance/ComplianceContent.tsx:36:  const href = (p: string) => localizedHrefIfAvailable(locale, p);
frontend/src/app/use-cases/consultants/page.tsx:10:  localized: true,
frontend/src/app/use-cases/compliance/page.tsx:10:  localized: true,
frontend/src/app/robots.ts:20:    sitemap: "https://www.doctalk.site/sitemap.xml",
frontend/src/app/tools/ToolsHubContent.tsx:6:import { localizedHrefIfAvailable } from '../../i18n/routing';
frontend/src/app/tools/ToolsHubContent.tsx:19:  const href = (p: string) => localizedHrefIfAvailable(locale, p);
frontend/src/app/use-cases/students/page.tsx:10:  localized: true,
frontend/src/app/[locale]/use-cases/lawyers/page.tsx:20:    localized: true,
frontend/src/app/use-cases/students/StudentsContent.tsx:6:import { localizedHrefIfAvailable } from '../../../i18n/routing';
frontend/src/app/use-cases/students/StudentsContent.tsx:33:  const href = (p: string) => localizedHrefIfAvailable(locale, p);
frontend/src/app/tools/page.tsx:10:  localized: true,
frontend/src/app/demo/page.tsx:10:  localized: true,

exec
/bin/zsh -lc "nl -ba frontend/src/i18n/LocaleProvider.tsx | sed -n '1,230p'; printf '\\nLOCALE LAYOUT\\n'; nl -ba frontend/src/app/\\[locale\\]/layout.tsx | sed -n '1,180p'; printf '\\nMARKETING PAGE FACTORY\\n'; nl -ba frontend/src/lib/marketingLocalePage.tsx | sed -n '1,180p'; printf '\\nSEO\\n'; nl -ba frontend/src/lib/seo.ts | sed -n '1,180p'; printf '\\nSITEMAP\\n'; nl -ba frontend/src/app/sitemap.ts | sed -n '1,150p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	"use client";
     2	import React, { useState, useCallback, useMemo, useEffect } from 'react';
     3	import { LocaleContext, Locale, LOCALES } from './index';
     4	import { splitLocaleFromPath } from './routing';
     5	
     6	import en from './locales/en.json';
     7	
     8	function applyParams(str: string, params?: Record<string, string | number>): string {
     9	  if (!params) return str;
    10	  let out = str;
    11	  Object.entries(params).forEach(([k, v]) => {
    12	    out = out.replace(`{${k}}`, String(v));
    13	  });
    14	  return out;
    15	}
    16	
    17	const warnedKeys = new Set<string>();
    18	function warnMissing(key: string, suffix = '') {
    19	  if (process.env.NODE_ENV !== 'development') return;
    20	  if (warnedKeys.has(key)) return;
    21	  warnedKeys.add(key);
    22	  console.warn(`[i18n] Missing translation key${suffix}:`, key);
    23	}
    24	
    25	const localeLoaders: Record<string, () => Promise<{ default: Record<string, string> }>> = {
    26	  zh: () => import('./locales/zh.json'),
    27	  es: () => import('./locales/es.json'),
    28	  ja: () => import('./locales/ja.json'),
    29	  de: () => import('./locales/de.json'),
    30	  fr: () => import('./locales/fr.json'),
    31	  ko: () => import('./locales/ko.json'),
    32	  pt: () => import('./locales/pt.json'),
    33	  it: () => import('./locales/it.json'),
    34	  ar: () => import('./locales/ar.json'),
    35	  hi: () => import('./locales/hi.json'),
    36	};
    37	
    38	function detectLocale(): Locale {
    39	  // A locale URL prefix (`/de/...`) is explicit intent — it wins over stored
    40	  // preference and browser language, and keeps <html lang>/chrome in sync with
    41	  // the server-rendered locale page.
    42	  if (typeof window !== 'undefined') {
    43	    const { locale } = splitLocaleFromPath(window.location.pathname);
    44	    if (locale !== 'en' && LOCALES.some((l) => l.code === locale)) return locale as Locale;
    45	  }
    46	
    47	  const stored = typeof window !== 'undefined' ? localStorage.getItem('doctalk_locale') : null;
    48	  if (stored && LOCALES.some((l) => l.code === stored)) return stored as Locale;
    49	
    50	  if (typeof navigator !== 'undefined') {
    51	    const nav = navigator.language;
    52	    const prefix = nav.split('-')[0] as Locale;
    53	    if (LOCALES.some((l) => l.code === prefix)) return prefix;
    54	  }
    55	  return 'en';
    56	}
    57	
    58	export default function LocaleProvider({
    59	  children,
    60	  initialLocale,
    61	  initialMessages,
    62	}: {
    63	  children: React.ReactNode;
    64	  /**
    65	   * Server-seeded locale + messages for localized server pages (e.g. the `/de`
    66	   * landing). When provided, the provider starts in that locale with those
    67	   * messages so the initial SSR HTML is translated — without client detection
    68	   * and without shipping the full locale JSON. Missing keys still fall back to
    69	   * the statically-bundled English. Omit both for the default app behavior
    70	   * (start `en`, detect client-side).
    71	   */
    72	  initialLocale?: Locale;
    73	  initialMessages?: Record<string, string>;
    74	}) {
    75	  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? 'en');
    76	  const [loadedTranslations, setLoadedTranslations] = useState<Record<string, Record<string, string>>>(
    77	    // Never let a scoped seed clobber the full bundled English (resolve() relies
    78	    // on it as the fallback); only seed a non-en locale.
    79	    initialLocale && initialLocale !== 'en' && initialMessages
    80	      ? { en, [initialLocale]: initialMessages }
    81	      : { en },
    82	  );
    83	
    84	  useEffect(() => {
    85	    // Seeded providers (localized server pages) keep their server locale; only
    86	    // the default (unseeded) provider detects from storage/navigator/URL.
    87	    if (initialLocale) return;
    88	    setLocaleState(detectLocale());
    89	  }, [initialLocale]);
    90	
    91	  const setLocale = useCallback((l: Locale) => {
    92	    setLocaleState(l);
    93	    try {
    94	      localStorage.setItem('doctalk_locale', l);
    95	    } catch {
    96	      // localStorage unavailable in private browsing
    97	    }
    98	  }, []);
    99	
   100	  useEffect(() => {
   101	    document.documentElement.lang = locale;
   102	    const localeInfo = LOCALES.find((l) => l.code === locale);
   103	    document.documentElement.dir = localeInfo?.dir === 'rtl' ? 'rtl' : 'ltr';
   104	  }, [locale]);
   105	
   106	  useEffect(() => {
   107	    if (locale === 'en' || loadedTranslations[locale] || !localeLoaders[locale]) return;
   108	
   109	    let cancelled = false;
   110	    localeLoaders[locale]()
   111	      .then((mod) => {
   112	        if (cancelled) return;
   113	        setLoadedTranslations((prev) => ({ ...prev, [locale]: mod.default }));
   114	      })
   115	      .catch((err) => {
   116	        console.error(`Failed to load locale: ${locale}`, err);
   117	      });
   118	
   119	    return () => {
   120	      cancelled = true;
   121	    };
   122	  }, [locale, loadedTranslations]);
   123	
   124	  const resolve = useCallback(
   125	    (key: string): string | undefined => {
   126	      const activeTranslations = loadedTranslations[locale] || loadedTranslations.en;
   127	      return activeTranslations?.[key] ?? loadedTranslations.en?.[key];
   128	    },
   129	    [locale, loadedTranslations]
   130	  );
   131	
   132	  const t = useCallback(
   133	    (key: string, params?: Record<string, string | number>): string => {
   134	      const translated = resolve(key);
   135	      if (translated == null) warnMissing(key);
   136	      return applyParams(translated ?? key, params);
   137	    },
   138	    [resolve]
   139	  );
   140	
   141	  const tOr = useCallback(
   142	    (key: string, fallback: string, params?: Record<string, string | number>): string => {
   143	      const translated = resolve(key);
   144	      if (translated == null) warnMissing(key, ' (using fallback)');
   145	      return applyParams(translated ?? fallback, params);
   146	    },
   147	    [resolve]
   148	  );
   149	
   150	  const value = useMemo(() => ({ locale, setLocale, t, tOr }), [locale, setLocale, t, tOr]);
   151	
   152	  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
   153	}

LOCALE LAYOUT
     1	import { notFound } from 'next/navigation';
     2	import { URL_LOCALES, isUrlLocale } from '../../i18n/routing';
     3	
     4	/**
     5	 * Locale subdirectory for the server-rendered, internationalized marketing
     6	 * surface (`/de/...`, `/zh/...`). English stays unprefixed at the root, so this
     7	 * segment only serves translated URL locales. `dynamicParams = false` means any
     8	 * non-listed segment (e.g. `/random`) 404s at build instead of being dynamically
     9	 * rendered.
    10	 *
    11	 * Only the marketing pages are mirrored here; the authenticated app (root `/`,
    12	 * `/d/`, `/collections`, …) is intentionally NOT localized by URL.
    13	 */
    14	export const dynamicParams = false;
    15	
    16	export function generateStaticParams() {
    17	  return URL_LOCALES.map((locale) => ({ locale }));
    18	}
    19	
    20	export default function LocaleLayout({
    21	  children,
    22	  params,
    23	}: {
    24	  children: React.ReactNode;
    25	  params: { locale: string };
    26	}) {
    27	  if (!isUrlLocale(params.locale)) notFound();
    28	  return <>{children}</>;
    29	}

MARKETING PAGE FACTORY
     1	import type { Metadata } from 'next';
     2	import { notFound } from 'next/navigation';
     3	import { getServerT } from '../i18n/server';
     4	import { isUrlLocale } from '../i18n/routing';
     5	import { buildMarketingMetadata } from './seo';
     6	import MarketingArticleJsonLd from '../components/marketing/MarketingArticleJsonLd';
     7	
     8	/**
     9	 * Factory for `app/[locale]/<route>/page.tsx` files. Removes per-page boilerplate
    10	 * for the localized marketing rollout: builds locale metadata (title/description
    11	 * from translation keys + hreflang via buildMarketingMetadata), validates the
    12	 * locale, and renders generic Article JSON-LD + the shared server content
    13	 * component. The `[locale]/layout.tsx` `generateStaticParams` supplies the locale
    14	 * params, so page files need only metadata + the default component.
    15	 *
    16	 * Usage:
    17	 *   const page = createMarketingLocalePage({ Content: FinanceContent,
    18	 *     path: '/use-cases/finance', titleKey: 'useCasesFinance.heroTitle',
    19	 *     descKey: 'useCasesFinance.heroDescription', keywords: [...] });
    20	 *   export const generateMetadata = page.generateMetadata;
    21	 *   export default page.Page;
    22	 */
    23	export function createMarketingLocalePage({
    24	  Content,
    25	  path,
    26	  titleKey,
    27	  descKey,
    28	  keywords,
    29	  datePublished,
    30	}: {
    31	  Content: (props: { locale: string }) => Promise<JSX.Element> | JSX.Element;
    32	  path: string;
    33	  titleKey: string;
    34	  descKey: string;
    35	  keywords?: string[];
    36	  datePublished?: string;
    37	}) {
    38	  async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
    39	    const { t } = await getServerT(params.locale);
    40	    const title = t(titleKey);
    41	    const description = t(descKey);
    42	    return buildMarketingMetadata({
    43	      title,
    44	      description,
    45	      path,
    46	      locale: params.locale,
    47	      localized: true,
    48	      keywords,
    49	      openGraph: { title: `${title} | DocTalk`, description },
    50	    });
    51	  }
    52	
    53	  async function Page({ params }: { params: { locale: string } }) {
    54	    if (!isUrlLocale(params.locale)) notFound();
    55	    return (
    56	      <>
    57	        <MarketingArticleJsonLd
    58	          locale={params.locale}
    59	          path={path}
    60	          titleKey={titleKey}
    61	          descKey={descKey}
    62	          datePublished={datePublished}
    63	        />
    64	        <Content locale={params.locale} />
    65	      </>
    66	    );
    67	  }
    68	
    69	  return { generateMetadata, Page };
    70	}

SEO
     1	import type { Metadata } from 'next';
     2	import { URL_LOCALES, localizedHref } from '../i18n/routing';
     3	
     4	export const SITE_URL = 'https://www.doctalk.site';
     5	export const DEFAULT_SHARE_ALT = 'DocTalk — AI Document Chat with Cited Answers';
     6	const DEFAULT_OG_IMAGE_PATH = '/opengraph-image';
     7	const DEFAULT_TWITTER_IMAGE_PATH = '/twitter-image';
     8	const BLOG_PLACEHOLDER_IMAGE = '/blog/images/placeholder.png';
     9	
    10	type OpenGraphInput = NonNullable<Metadata['openGraph']>;
    11	type TwitterInput = NonNullable<Metadata['twitter']>;
    12	
    13	interface MarketingMetadataOptions {
    14	  title: Metadata['title'];
    15	  description: string;
    16	  path: string;
    17	  keywords?: string[];
    18	  robots?: Metadata['robots'];
    19	  openGraph?: Partial<OpenGraphInput>;
    20	  twitter?: Partial<TwitterInput>;
    21	  locale?: string;
    22	  /**
    23	   * When true, emit hreflang `alternates.languages` for every marketing locale
    24	   * and set the canonical to this locale's URL. `path` is the locale-agnostic
    25	   * path (e.g. `/use-cases/lawyers`); `locale` is the page's locale (default `en`).
    26	   */
    27	  localized?: boolean;
    28	}
    29	
    30	/** hreflang map: unprefixed `en` default + each URL locale + `x-default` → en. */
    31	function buildLanguageAlternates(path: string): Record<string, string> {
    32	  const languages: Record<string, string> = {
    33	    en: absoluteUrl(localizedHref('en', path)),
    34	  };
    35	  for (const loc of URL_LOCALES) {
    36	    languages[loc] = absoluteUrl(localizedHref(loc, path));
    37	  }
    38	  languages['x-default'] = absoluteUrl(localizedHref('en', path));
    39	  return languages;
    40	}
    41	
    42	const OG_LOCALE_MAP: Record<string, string> = {
    43	  en: 'en_US',
    44	  zh: 'zh_CN',
    45	  es: 'es_ES',
    46	  ja: 'ja_JP',
    47	  de: 'de_DE',
    48	  fr: 'fr_FR',
    49	  ko: 'ko_KR',
    50	  pt: 'pt_BR',
    51	  it: 'it_IT',
    52	  ar: 'ar_SA',
    53	  hi: 'hi_IN',
    54	};
    55	
    56	interface ArticleJsonLdOptions {
    57	  title: string;
    58	  description: string;
    59	  path: string;
    60	  datePublished: string;
    61	  dateModified?: string;
    62	  authorName?: string;
    63	  imagePath?: string;
    64	  keywords?: string[];
    65	}
    66	
    67	export function absoluteUrl(path: string): string {
    68	  if (path.startsWith('http://') || path.startsWith('https://')) {
    69	    return path;
    70	  }
    71	
    72	  return new URL(path.startsWith('/') ? path : `/${path}`, SITE_URL).toString();
    73	}
    74	
    75	export function resolveShareImage(imagePath?: string): string {
    76	  if (!imagePath || imagePath === BLOG_PLACEHOLDER_IMAGE) {
    77	    return absoluteUrl(DEFAULT_OG_IMAGE_PATH);
    78	  }
    79	
    80	  return absoluteUrl(imagePath);
    81	}
    82	
    83	function resolveTitleText(title: Metadata['title']): string {
    84	  if (typeof title === 'string') {
    85	    return title;
    86	  }
    87	
    88	  if (title && typeof title === 'object') {
    89	    if ('absolute' in title && title.absolute) {
    90	      return title.absolute;
    91	    }
    92	
    93	    if ('default' in title && title.default) {
    94	      return title.default;
    95	    }
    96	  }
    97	
    98	  return 'DocTalk';
    99	}
   100	
   101	export function buildMarketingMetadata({
   102	  title,
   103	  description,
   104	  path,
   105	  keywords,
   106	  robots,
   107	  openGraph,
   108	  twitter,
   109	  locale,
   110	  localized,
   111	}: MarketingMetadataOptions): Metadata {
   112	  const titleText = resolveTitleText(title);
   113	  const pageLocale = locale ?? 'en';
   114	  const canonicalPath = localized ? localizedHref(pageLocale, path) : path;
   115	
   116	  return {
   117	    title,
   118	    description,
   119	    ...(keywords ? { keywords } : {}),
   120	    alternates: {
   121	      canonical: canonicalPath,
   122	      ...(localized ? { languages: buildLanguageAlternates(path) } : {}),
   123	    },
   124	    ...(robots ? { robots } : {}),
   125	    openGraph: {
   126	      title: titleText,
   127	      description,
   128	      url: absoluteUrl(canonicalPath),
   129	      siteName: 'DocTalk',
   130	      locale: OG_LOCALE_MAP[pageLocale] ?? 'en_US',
   131	      images: [
   132	        {
   133	          url: absoluteUrl(DEFAULT_OG_IMAGE_PATH),
   134	          width: 1200,
   135	          height: 630,
   136	          alt: DEFAULT_SHARE_ALT,
   137	        },
   138	      ],
   139	      ...openGraph,
   140	    },
   141	    twitter: {
   142	      card: 'summary_large_image',
   143	      title: titleText,
   144	      description,
   145	      images: [absoluteUrl(DEFAULT_TWITTER_IMAGE_PATH)],
   146	      ...twitter,
   147	    },
   148	  };
   149	}
   150	
   151	export function buildArticleJsonLd({
   152	  title,
   153	  description,
   154	  path,
   155	  datePublished,
   156	  dateModified,
   157	  authorName = 'DocTalk Team',
   158	  imagePath,
   159	  keywords,
   160	}: ArticleJsonLdOptions) {
   161	  return {
   162	    '@context': 'https://schema.org',
   163	    '@type': 'Article',
   164	    headline: title,
   165	    description,
   166	    image: resolveShareImage(imagePath),
   167	    datePublished,
   168	    dateModified: dateModified ?? datePublished,
   169	    author: {
   170	      '@type': 'Organization',
   171	      name: authorName,
   172	      url: SITE_URL,
   173	    },
   174	    publisher: {
   175	      '@type': 'Organization',
   176	      name: 'DocTalk',
   177	      url: SITE_URL,
   178	      logo: absoluteUrl('/logo-icon.png'),
   179	    },
   180	    mainEntityOfPage: {

SITEMAP
     1	import type { MetadataRoute } from "next";
     2	import { getAllPosts, KNOWN_BLOG_CATEGORIES } from "../lib/blog";
     3	import { LOCALIZED_PATHS, URL_LOCALES, localizedHref } from "../i18n/routing";
     4	
     5	const BASE_URL = "https://www.doctalk.site";
     6	
     7	/** Reciprocal hreflang map for a localized path (unprefixed en + each URL locale + x-default). */
     8	function languagesFor(path: string): Record<string, string> {
     9	  const languages: Record<string, string> = { en: `${BASE_URL}${path}` };
    10	  for (const loc of URL_LOCALES) {
    11	    languages[loc] = `${BASE_URL}${localizedHref(loc, path)}`;
    12	  }
    13	  languages["x-default"] = `${BASE_URL}${path}`;
    14	  return languages;
    15	}
    16	
    17	export default function sitemap(): MetadataRoute.Sitemap {
    18	  const generatedAt = new Date();
    19	  const posts = getAllPosts();
    20	
    21	  const staticEntries: MetadataRoute.Sitemap = [
    22	    // Static pages
    23	    { url: BASE_URL, lastModified: generatedAt, changeFrequency: "monthly", priority: 1.0 },
    24	    { url: `${BASE_URL}/demo`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.8 },
    25	    { url: `${BASE_URL}/pricing`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.8 },
    26	    { url: `${BASE_URL}/blog`, lastModified: generatedAt, changeFrequency: "weekly", priority: 0.8 },
    27	    { url: `${BASE_URL}/about`, lastModified: generatedAt, changeFrequency: "yearly", priority: 0.5 },
    28	    { url: `${BASE_URL}/contact`, lastModified: generatedAt, changeFrequency: "yearly", priority: 0.5 },
    29	    { url: `${BASE_URL}/privacy`, lastModified: generatedAt, changeFrequency: "yearly", priority: 0.3 },
    30	    { url: `${BASE_URL}/terms`, lastModified: generatedAt, changeFrequency: "yearly", priority: 0.3 },
    31	    // Feature pages
    32	    { url: `${BASE_URL}/features`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    33	    { url: `${BASE_URL}/features/citations`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.8 },
    34	    { url: `${BASE_URL}/features/multi-format`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.8 },
    35	    { url: `${BASE_URL}/features/multilingual`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    36	    { url: `${BASE_URL}/features/free-demo`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    37	    { url: `${BASE_URL}/features/performance-modes`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.6 },
    38	    // Comparison pages
    39	    { url: `${BASE_URL}/compare`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.6 },
    40	    { url: `${BASE_URL}/compare/chatpdf`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    41	    { url: `${BASE_URL}/compare/askyourpdf`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    42	    { url: `${BASE_URL}/compare/notebooklm`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    43	    { url: `${BASE_URL}/compare/humata`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    44	    { url: `${BASE_URL}/compare/pdf-ai`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    45	    // Alternative pages
    46	    { url: `${BASE_URL}/alternatives`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.6 },
    47	    { url: `${BASE_URL}/alternatives/chatpdf`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    48	    { url: `${BASE_URL}/alternatives/notebooklm`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    49	    { url: `${BASE_URL}/alternatives/humata`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    50	    { url: `${BASE_URL}/alternatives/askyourpdf`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    51	    { url: `${BASE_URL}/alternatives/pdf-ai`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    52	    // Use case pages
    53	    { url: `${BASE_URL}/use-cases`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    54	    { url: `${BASE_URL}/use-cases/students`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    55	    { url: `${BASE_URL}/use-cases/lawyers`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    56	    { url: `${BASE_URL}/use-cases/finance`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    57	    { url: `${BASE_URL}/use-cases/hr-contracts`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.6 },
    58	    { url: `${BASE_URL}/use-cases/teachers`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    59	    { url: `${BASE_URL}/use-cases/consultants`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    60	    { url: `${BASE_URL}/use-cases/real-estate`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    61	    { url: `${BASE_URL}/use-cases/healthcare`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    62	    { url: `${BASE_URL}/use-cases/compliance`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.7 },
    63	    // Tools pages
    64	    { url: `${BASE_URL}/tools`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.6 },
    65	    { url: `${BASE_URL}/tools/word-counter`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.6 },
    66	    { url: `${BASE_URL}/tools/reading-time`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.6 },
    67	    // Blog content
    68	    ...KNOWN_BLOG_CATEGORIES.map((category) => ({
    69	      url: `${BASE_URL}/blog/category/${category}`,
    70	      lastModified: generatedAt,
    71	      changeFrequency: "weekly" as const,
    72	      priority: 0.6,
    73	    })),
    74	    ...posts.map((post) => ({
    75	      url: `${BASE_URL}/blog/${post.slug}`,
    76	      lastModified: new Date(post.updated || post.date),
    77	      changeFrequency: "monthly" as const,
    78	      priority: 0.7,
    79	    })),
    80	  ];
    81	
    82	  // International SEO: attach hreflang to the en entry of each localized path,
    83	  // and append one entry per URL locale (each carrying the reciprocal map).
    84	  const withAlternates = staticEntries.map((entry) => {
    85	    const path = entry.url.replace(BASE_URL, "") || "/";
    86	    return LOCALIZED_PATHS.has(path)
    87	      ? { ...entry, alternates: { languages: languagesFor(path) } }
    88	      : entry;
    89	  });
    90	
    91	  const localeEntries: MetadataRoute.Sitemap = [];
    92	  for (const path of LOCALIZED_PATHS) {
    93	    const languages = languagesFor(path);
    94	    for (const loc of URL_LOCALES) {
    95	      localeEntries.push({
    96	        url: `${BASE_URL}${localizedHref(loc, path)}`,
    97	        lastModified: generatedAt,
    98	        changeFrequency: "monthly",
    99	        priority: 0.7,
   100	        alternates: { languages },
   101	      });
   102	    }
   103	  }
   104	
   105	  return [...withAlternates, ...localeEntries];
   106	}

exec
/bin/zsh -lc "for f in frontend/src/i18n/locales/{en,zh,ja,ko,es,de,fr,pt,it,ar,hi}.json; do printf '%s: ' \""'${f##*/}"; rg -o '"'\"featuresDemo\\.whatYouGet\\.item1\\.label\":\\s*\"["'^"]*"'"' \""'$f"; done; printf '"'\\nSTALE PER SESSION CLAIMS\\n'; rg -n -i \"5 (free )?(messages|questions).*(per session|session)|per session.*5 (messages|questions)|5 (Nachrichten|mensajes|messages|メッセージ|条消息|메시지|संदेश|رسائل).*جلسة\" frontend/src/i18n/locales frontend/src/app frontend/src/components | head -n 300; printf '\\nLOCALE KEY SET CHECK\\n'; python3 - <<'PY'
import json,glob,os
files=glob.glob('frontend/src/i18n/locales/*.json')
data={os.path.basename(f):json.load(open(f)) for f in files}
en=set(data['en.json'])
for name,d in sorted(data.items()):
    if name=='en.json': continue
    miss=sorted(k for k in en if k.startswith(('demo.','footer.','useCasesHub.breadcrumb.','common.','public.','auth.','header.','landing.','privacy.','terms.')) and k not in d)
    print(name, 'missing scoped keys', len(miss), miss[:12])
PY" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
en.json: "featuresDemo.whatYouGet.item1.label": "5 messages per sample document"
zh.json: "featuresDemo.whatYouGet.item1.label": "每篇示例文档 5 条消息"
ja.json: "featuresDemo.whatYouGet.item1.label": "サンプル文書あたり5メッセージ"
ko.json: "featuresDemo.whatYouGet.item1.label": "샘플 문서당 5개의 메시지"
es.json: "featuresDemo.whatYouGet.item1.label": "5 mensajes por documento de muestra"
de.json: "featuresDemo.whatYouGet.item1.label": "5 Nachrichten pro Beispieldokument"
fr.json: "featuresDemo.whatYouGet.item1.label": "5 messages par document d'exemple"
pt.json: "featuresDemo.whatYouGet.item1.label": "5 mensagens por documento de exemplo"
it.json: "featuresDemo.whatYouGet.item1.label": "5 messaggi per documento di esempio"
ar.json: "featuresDemo.whatYouGet.item1.label": "5 رسائل لكل مستند عينة"
hi.json: "featuresDemo.whatYouGet.item1.label": "प्रति नमूना दस्तावेज़ 5 संदेश"

STALE PER SESSION CLAIMS

LOCALE KEY SET CHECK
ar.json missing scoped keys 0 []
de.json missing scoped keys 0 []
es.json missing scoped keys 0 []
fr.json missing scoped keys 0 []
hi.json missing scoped keys 0 []
it.json missing scoped keys 0 []
ja.json missing scoped keys 0 []
ko.json missing scoped keys 0 []
pt.json missing scoped keys 0 []
zh.json missing scoped keys 0 []

exec
/bin/zsh -lc "for f in frontend/src/components/Chat/MessageBubble.tsx frontend/src/components/Chat/ChatPanel.tsx frontend/src/components/AppHeaderShell.tsx frontend/src/components/PublicHeader.tsx frontend/src/components/dashboard/DashboardPageClient.tsx; do printf '\\n===== %s =====\\n' \""'$f"; rg -n "(''^|[''^:])'"\\b(text-white|bg-white|border-white|placeholder:text-white|hover:text-white|hover:bg-white)|text-zinc-50|bg-zinc-50|text-zinc-100|bg-zinc-100\" \""'$f" || true; done; printf '"'\\nPROGRESS BLOCK\\n'; nl -ba frontend/src/components/Chat/ChatPanel.tsx | sed -n '540,715p'; printf '\\nMESSAGE ACTIONS\\n'; nl -ba frontend/src/components/Chat/MessageBubble.tsx | sed -n '130,410p'; printf '\\nPUBLIC HEADER\\n'; nl -ba frontend/src/components/PublicHeader.tsx | sed -n '1,120p'; printf '\\nDASHBOARD TARGET REGION\\n'; nl -ba frontend/src/components/dashboard/DashboardPageClient.tsx | sed -n '370,690p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:

===== frontend/src/components/Chat/MessageBubble.tsx =====
141:      <div className="flex items-center justify-between px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-700">
151:        <pre className="text-[13px] leading-relaxed text-zinc-800 dark:text-zinc-100 bg-white dark:bg-zinc-900 overflow-x-auto p-4 m-0">
274:              ? 'text-sm rounded-2xl px-4 py-3 bg-red-500/92 text-white shadow-2xl shadow-red-950/30'
285:                <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce motion-reduce:animate-none [animation-delay:-0.3s]" aria-hidden="true" />
286:                <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce motion-reduce:animate-none [animation-delay:-0.15s]" aria-hidden="true" />
287:                <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce motion-reduce:animate-none" aria-hidden="true" />
336:              className="rounded-full p-1.5 text-[var(--workbench-muted)] transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400"
347:                  : 'text-[var(--workbench-muted)] hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white'
360:                  : 'text-[var(--workbench-muted)] hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white'
372:                className="rounded-full p-1.5 text-[var(--workbench-muted)] transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50"
382:                className="rounded-full p-1.5 text-[var(--workbench-muted)] transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400"

===== frontend/src/components/Chat/ChatPanel.tsx =====
500:                  <div className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-white/14 dark:bg-white/8 dark:text-white/72 text-xs font-mono font-semibold">
552:              className="pointer-events-auto rounded-full border border-zinc-200 bg-white hover:text-zinc-900 dark:border-white/14 dark:bg-white/10 p-2 text-[var(--workbench-muted)] shadow-md transition-shadow dark:hover:text-white hover:shadow-lg focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
572:                demoRemaining <= 2 ? 'bg-amber-500' : 'bg-zinc-400 dark:bg-zinc-500'
651:                className="rounded-full p-1.5 text-[var(--workbench-muted)] transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:opacity-50"
698:        <p className="mx-auto max-w-4xl text-xs text-zinc-400 dark:text-zinc-500">

===== frontend/src/components/AppHeaderShell.tsx =====
36:        <span className="hidden sm:inline ml-1 -mt-2 px-1.5 py-0.5 text-[10px] font-medium leading-none rounded-full border border-zinc-300 bg-zinc-100 dark:border-white/18 dark:bg-white/8 text-[var(--workbench-muted)] tracking-wide uppercase">Beta</span>

===== frontend/src/components/PublicHeader.tsx =====
28:        <span className="ml-1 -mt-2 px-1.5 py-0.5 text-[10px] font-medium leading-none rounded-full border border-zinc-300 bg-zinc-100 dark:border-white/18 dark:bg-white/8 text-[var(--workbench-muted)] tracking-wide uppercase">Beta</span>
36:            className="rounded-full px-3 py-1.5 text-sm font-medium text-[var(--workbench-muted)] transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-white/10 dark:hover:text-white"
83:                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-200 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"

===== frontend/src/components/dashboard/DashboardPageClient.tsx =====
424:                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--workbench-muted)] transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
457:              <div aria-live="polite" className={`mt-4 text-sm ${uploading ? 'text-zinc-500' : 'text-red-600 dark:text-red-400'}`}>
463:                    className="mt-3 inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
482:                className="w-full rounded-full border border-zinc-300 bg-white py-2.5 pl-9 pr-3 text-sm text-[var(--workbench-ink)] placeholder:text-zinc-400 dark:border-white/14 dark:bg-white/8 dark:placeholder:text-white/38 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
502:                  className="mt-3 inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
542:                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-white/14 dark:bg-white/8 dark:text-white">
623:                        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-300">
626:                            className="px-2 py-1 rounded-md bg-red-600 text-white hover:bg-red-500 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500"
633:                            className="px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500"
646:                            className="px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500"
652:                            className="px-2 py-1 rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500"
661:                          className="rounded-full p-2 text-[var(--workbench-muted)] transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"

PROGRESS BLOCK
   540	                    onShareAnswer={userPlan ? handleShareAnswerVoid : handleAnonShareClick}
   541	                    isSharingAnswer={shareAnswerLoadingId === message.id}
   542	                  />
   543	                );
   544	              })}
   545	            </div>
   546	          )}
   547	        </div>
   548	        {messages.length > 0 && showScrollBtn && (
   549	          <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none z-10">
   550	            <button
   551	              onClick={() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })}
   552	              className="pointer-events-auto rounded-full border border-zinc-200 bg-white hover:text-zinc-900 dark:border-white/14 dark:bg-white/10 p-2 text-[var(--workbench-muted)] shadow-md transition-shadow dark:hover:text-white hover:shadow-lg focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
   553	              aria-label={t('chat.scrollToBottom')}
   554	            >
   555	              <ArrowDown size={16} />
   556	            </button>
   557	          </div>
   558	        )}
   559	      </div>
   560	
   561	      {maxUserMessages != null && (
   562	        <div className="border-t border-[var(--workbench-border)]">
   563	          <div className="h-1 bg-zinc-200 dark:bg-white/10">
   564	            <div
   565	              role="progressbar"
   566	              aria-valuenow={Math.max(0, demoRemaining)}
   567	              aria-valuemin={0}
   568	              aria-valuemax={maxMessages}
   569	              aria-label={t('chat.messagesUsed')}
   570	              aria-valuetext={t('demo.questionsRemaining', { remaining: Math.max(0, demoRemaining), total: maxUserMessages })}
   571	              className={`h-full transition-[width] duration-300 ${
   572	                demoRemaining <= 2 ? 'bg-amber-500' : 'bg-zinc-400 dark:bg-zinc-500'
   573	              }`}
   574	              style={{ width: `${Math.max(0, (demoRemaining / maxUserMessages) * 100)}%` }}
   575	            />
   576	          </div>
   577	          {demoLimitReached ? (
   578	            <div className="px-4 py-3 sm:px-6" aria-live="polite">
   579	              <div className="dt-stitch-card mx-auto flex max-w-4xl flex-col gap-3 rounded-2xl p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
   580	                <div>
   581	                  <p className="font-semibold">
   582	                    {tOr('demo.limitPanel.title', 'Ready to use DocTalk on your own files?')}
   583	                  </p>
   584	                  <p className="mt-1 text-[var(--workbench-muted)]">
   585	                    {tOr('demo.limitPanel.body', 'Create a free account to upload documents, keep chats, and start with free credits.')}
   586	                  </p>
   587	                </div>
   588	                <button
   589	                  type="button"
   590	                  onClick={handleDemoAuthClick}
   591	                  className="dt-stitch-primary inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-4 py-2 font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
   592	                >
   593	                  {tOr('demo.limitPanel.cta', 'Upload your own document')}
   594	                </button>
   595	              </div>
   596	            </div>
   597	          ) : (
   598	            <div className="flex items-center justify-between px-4 py-2 text-sm text-[var(--workbench-muted)]" aria-live="polite">
   599	              <span className={demoRemaining <= 2 ? 'text-amber-600 dark:text-amber-400 font-medium' : ''}>
   600	                {t('demo.questionsRemaining', { remaining: Math.max(0, demoRemaining), total: maxUserMessages })}
   601	              </span>
   602	              <button type="button" onClick={() => openAuthModal()} className="text-sm text-[var(--workbench-muted)] hover:text-zinc-900 dark:hover:text-white hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-zinc-400">
   603	                {t('demo.signInForUnlimited')}
   604	              </button>
   605	            </div>
   606	          )}
   607	        </div>
   608	      )}
   609	
   610	      <form onSubmit={onSubmit} className="dt-composer-shell px-4 py-3 sm:px-6">
   611	        <div className="mx-auto max-w-4xl">
   612	          {userPlan && (
   613	            <div className="mb-2 flex justify-end">
   614	              <DomainModeSelector userPlan={userPlan} />
   615	            </div>
   616	          )}
   617	          <div className="dt-composer flex items-center gap-2 rounded-[1.75rem] px-3 py-2 transition-[border-color,box-shadow]">
   618	            <PlusMenu
   619	              isOpen={plusMenuOpen}
   620	              setIsOpen={setPlusMenuOpen}
   621	              menuRef={plusMenuRef}
   622	              buttonRef={plusMenuButtonRef}
   623	              onMenuKeyDown={handlePlusMenuKeyDown}
   624	              showCustomInstructions={showCustomInstructions}
   625	              showExportInMenu={showExportInMenu}
   626	              canUseCustomInstructions={canUseCustomInstructions}
   627	              hasCustomInstructions={hasCustomInstructions}
   628	              canUseExport={canUseExport}
   629	              onOpenSettings={onOpenSettings}
   630	              onExport={handleExport}
   631	              onExportPdf={() => handleExportFormat('pdf')}
   632	              onExportDocx={() => handleExportFormat('docx')}
   633	              onBillingRedirect={(intent) => {
   634	                setPlusMenuOpen(false);
   635	                trackEvent('upgrade_click', {
   636	                  plan: intent.plan,
   637	                  period: 'monthly',
   638	                  source: 'chat_plus_menu',
   639	                  reason: intent.reason,
   640	                });
   641	                router.push(billingHref({ plan: intent.plan, source: 'chat_plus_menu', reason: intent.reason }));
   642	              }}
   643	              t={t}
   644	              tOr={tOr}
   645	            />
   646	            {messages.length > 0 && !isStreaming && (
   647	              <button
   648	                type="button"
   649	                onClick={userPlan ? handleShare : handleAnonShareClick}
   650	                disabled={shareLoading}
   651	                className="rounded-full p-1.5 text-[var(--workbench-muted)] transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:opacity-50"
   652	                title={tOr('chat.share', 'Share conversation')}
   653	                aria-label={tOr('chat.share', 'Share conversation')}
   654	              >
   655	                <Share2 size={16} />
   656	              </button>
   657	            )}
   658	            <textarea
   659	              ref={textareaRef}
   660	              className="flex-1 resize-none overflow-y-auto bg-transparent px-1 py-1 text-sm text-[var(--workbench-ink)] placeholder:text-zinc-400 dark:placeholder:text-white/38 focus:outline-none"
   661	              style={{ minHeight: '36px' }}
   662	              placeholder={demoLimitReached ? t('demo.signInToContinue') : t('chat.placeholder')}
   663	              value={input}
   664	              onChange={(e) => setInput(e.target.value)}
   665	              onKeyDown={onKeyDown}
   666	              disabled={isStreaming || demoLimitReached}
   667	              rows={1}
   668	              aria-label={t('chat.placeholder')}
   669	            />
   670	            <div className="flex items-center shrink-0">
   671	              {isStreaming ? (
   672	                <button
   673	                  type="button"
   674	                  onClick={stopStreaming}
   675	                  className="dt-stitch-primary rounded-full p-2 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
   676	                  title={tOr('chat.stop', 'Stop')}
   677	                  aria-label={t('chat.stop')}
   678	                >
   679	                  <Square size={16} />
   680	                </button>
   681	              ) : (
   682	                <button
   683	                  type="submit"
   684	                  className="dt-stitch-primary rounded-full p-2 transition-colors disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
   685	                  disabled={!input.trim() || demoLimitReached}
   686	                  title={t('chat.send')}
   687	                  aria-label={t('chat.send')}
   688	                >
   689	                  <SendHorizontal size={18} />
   690	                </button>
   691	              )}
   692	            </div>
   693	          </div>
   694	        </div>
   695	      </form>
   696	
   697	      <div className="bg-transparent pb-2 text-center">
   698	        <p className="mx-auto max-w-4xl text-xs text-zinc-400 dark:text-zinc-500">
   699	          {t('chat.disclaimer')}
   700	        </p>
   701	      </div>
   702	    </div>
   703	  );
   704	}

MESSAGE ACTIONS
   130	      })
   131	      .catch(() => {
   132	        if (!cancelled) setHtml(null);
   133	      });
   134	    return () => {
   135	      cancelled = true;
   136	    };
   137	  }, [code, language]);
   138	
   139	  return (
   140	    <div className="not-prose my-4 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700">
   141	      <div className="flex items-center justify-between px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-700">
   142	        <span className="font-mono">{language || 'text'}</span>
   143	        <CopyButton value={code} label={t('chat.copyCode')} copiedLabel={t('chat.copied')} />
   144	      </div>
   145	      {html ? (
   146	        <div
   147	          className="shiki-container text-[13px] leading-relaxed [&_pre]:!m-0 [&_pre]:!p-4 [&_pre]:overflow-x-auto"
   148	          dangerouslySetInnerHTML={{ __html: html }}
   149	        />
   150	      ) : (
   151	        <pre className="text-[13px] leading-relaxed text-zinc-800 dark:text-zinc-100 bg-white dark:bg-zinc-900 overflow-x-auto p-4 m-0">
   152	          <code>{code}</code>
   153	        </pre>
   154	      )}
   155	    </div>
   156	  );
   157	}
   158	
   159	/* ── Pre override: render fenced code blocks as CodeBlock ── */
   160	function PreBlock({ children }: any) {
   161	  const child = React.Children.toArray(children)[0];
   162	  if (React.isValidElement(child)) {
   163	    const childProps = (child as any).props || {};
   164	    const className = childProps.className || '';
   165	    const match = /language-(\w+)/.exec(className);
   166	    const lang = match ? match[1] : '';
   167	    const text = String(childProps.children ?? '').replace(/\n$/, '');
   168	    if (text) {
   169	      return <CodeBlock language={lang} code={text} />;
   170	    }
   171	  }
   172	  return <pre className="overflow-x-auto">{children}</pre>;
   173	}
   174	
   175	type Feedback = 'up' | 'down' | null;
   176	
   177	function getFeedback(messageId: string): Feedback {
   178	  try {
   179	    return localStorage.getItem(`doctalk_fb_${messageId}`) as Feedback;
   180	  } catch {
   181	    // localStorage unavailable in private browsing
   182	    return null;
   183	  }
   184	}
   185	
   186	function setFeedbackStorage(messageId: string, fb: Feedback) {
   187	  try {
   188	    if (fb) {
   189	      localStorage.setItem(`doctalk_fb_${messageId}`, fb);
   190	    } else {
   191	      localStorage.removeItem(`doctalk_fb_${messageId}`);
   192	    }
   193	  } catch {
   194	    // localStorage unavailable in private browsing
   195	  }
   196	}
   197	
   198	function MessageBubble({
   199	  message,
   200	  onCitationClick,
   201	  onPreviewLayoutTranslation,
   202	  isStreaming,
   203	  onRegenerate,
   204	  isLastAssistant,
   205	  onContinue,
   206	  onShareAnswer,
   207	  isSharingAnswer,
   208	}: MessageBubbleProps) {
   209	  const isUser = message.role === 'user';
   210	  const isError = !!message.isError;
   211	  const isAssistant = !isUser;
   212	  const { t } = useLocale();
   213	
   214	  const [copied, setCopied] = useState(false);
   215	  const [feedback, setFeedback] = useState<Feedback>(null);
   216	
   217	  useEffect(() => {
   218	    if (isAssistant) {
   219	      setFeedback(getFeedback(message.id));
   220	    }
   221	  }, [message.id, isAssistant]);
   222	
   223	  const handleCopy = useCallback(() => {
   224	    navigator.clipboard.writeText(message.text)
   225	      .then(() => {
   226	        setCopied(true);
   227	        setTimeout(() => setCopied(false), 2000);
   228	      })
   229	      .catch(() => {
   230	        // iOS Safari / non-HTTPS reject clipboard.writeText. The natural
   231	        // "didn't work" cue is the absence of the copied state — no toast
   232	        // needed. Swallowing prevents an unhandled promise rejection.
   233	      });
   234	  }, [message.text]);
   235	
   236	  const handleFeedback = useCallback((fb: Feedback) => {
   237	    const newFb = feedback === fb ? null : fb;
   238	    setFeedback(newFb);
   239	    setFeedbackStorage(message.id, newFb);
   240	    if (newFb) {
   241	      trackEvent('feedback_submitted', {
   242	        source: 'message_actions',
   243	        rating: newFb,
   244	        has_citations: Boolean(message.citations?.length),
   245	      });
   246	    }
   247	  }, [feedback, message.citations?.length, message.id]);
   248	
   249	  const markdownText = useMemo(() => {
   250	    if (isUser || isError) return message.text;
   251	    return insertCitationMarkers(message.text, message.citations || []);
   252	  }, [message.text, message.citations, isUser, isError]);
   253	
   254	  const markdownComponents = useMemo(() => {
   255	    const citations = message.citations || [];
   256	    const components: Record<string, any> = {
   257	      pre: PreBlock,
   258	    };
   259	    if (citations.length > 0) {
   260	      const tags = ['p', 'li', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'blockquote'] as const;
   261	      for (const tag of tags) {
   262	        components[tag] = createCitationComponent(tag, citations, onCitationClick, t);
   263	      }
   264	    }
   265	    return components;
   266	  }, [message.citations, onCitationClick, t]);
   267	
   268	  return (
   269	    <div className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'} ${isUser ? 'my-4' : 'my-6'} group`}>
   270	      <div className={`relative ${isUser ? 'max-w-[80%]' : 'w-full'}`}>
   271	        <div
   272	          className={
   273	            isError
   274	              ? 'text-sm rounded-2xl px-4 py-3 bg-red-500/92 text-white shadow-2xl shadow-red-950/30'
   275	              : isUser
   276	              ? 'dt-user-bubble text-sm rounded-2xl px-4 py-3'
   277	              : 'dt-answer-card text-[var(--workbench-ink)]'
   278	          }
   279	        >
   280	          {isUser ? (
   281	            <span className="whitespace-pre-wrap">{message.text}</span>
   282	          ) : isStreaming && !message.text ? (
   283	            <div className="flex items-center gap-2 text-[var(--workbench-muted)] text-sm" aria-live="polite">
   284	              <div className="flex gap-1">
   285	                <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce motion-reduce:animate-none [animation-delay:-0.3s]" aria-hidden="true" />
   286	                <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce motion-reduce:animate-none [animation-delay:-0.15s]" aria-hidden="true" />
   287	                <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce motion-reduce:animate-none" aria-hidden="true" />
   288	                <span className="hidden motion-reduce:inline" aria-hidden="true">...</span>
   289	              </div>
   290	              <span>{t('chat.searching')}</span>
   291	            </div>
   292	          ) : (
   293	            <>
   294	              {/* Sources strip — rendered above the prose so the
   295	                  "grounded-in-these-documents" signal is visible before the
   296	                  user reads the answer. During streaming with no citations
   297	                  yet, SourcesStrip itself draws a skeleton so the block
   298	                  doesn't flicker into existence mid-answer. */}
   299	              {isAssistant && (
   300	                <SourcesStrip
   301	                  citations={message.citations ?? []}
   302	                  onCitationClick={onCitationClick}
   303	                  isStreaming={isStreaming}
   304	                />
   305	              )}
   306	              <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 sm:prose-base">
   307	                <Suspense fallback={<span className="whitespace-pre-wrap">{markdownText}</span>}>
   308	                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
   309	                    {markdownText}
   310	                  </ReactMarkdown>
   311	                </Suspense>
   312	                {isStreaming && isAssistant && message.text && (
   313	                  <span aria-hidden="true" className="inline-block w-2 h-4 bg-zinc-400 dark:bg-white/45 animate-pulse motion-reduce:animate-none rounded-sm ml-0.5 align-text-bottom" />
   314	                )}
   315	              </div>
   316	              {isAssistant && !message.text && message.toolStatus ? (
   317	                <p className="mt-3 text-sm text-[var(--workbench-muted)]">{message.toolStatus}</p>
   318	              ) : null}
   319	              {isAssistant && message.artifacts?.map((artifact, index) => (
   320	                <ChatArtifactCard
   321	                  key={`${artifact.jobId || artifact.title}-${index}`}
   322	                  artifact={artifact}
   323	                  onCitationClick={onCitationClick}
   324	                  onPreviewLayoutTranslation={onPreviewLayoutTranslation}
   325	                />
   326	              ))}
   327	            </>
   328	          )}
   329	        </div>
   330	
   331	        {/* Copy + feedback buttons (assistant only) */}
   332	        {isAssistant && !isError && message.text && (
   333	          <div className={`mt-2 flex gap-1.5 transition-opacity ${isLastAssistant ? '' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`}>
   334	            <button
   335	              onClick={handleCopy}
   336	              className="rounded-full p-1.5 text-[var(--workbench-muted)] transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400"
   337	              title={copied ? t('copy.copied') : t('copy.button')}
   338	              aria-label={t('copy.button')}
   339	            >
   340	              {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
   341	            </button>
   342	            <button
   343	              onClick={() => handleFeedback('up')}
   344	              className={`rounded-lg p-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 ${
   345	                feedback === 'up'
   346	                  ? 'text-accent dark:text-white'
   347	                  : 'text-[var(--workbench-muted)] hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white'
   348	              }`}
   349	              title={t('feedback.helpful')}
   350	              aria-label={t('feedback.helpful')}
   351	              aria-pressed={feedback === 'up'}
   352	            >
   353	              <ThumbsUp size={14} fill={feedback === 'up' ? 'currentColor' : 'none'} />
   354	            </button>
   355	            <button
   356	              onClick={() => handleFeedback('down')}
   357	              className={`rounded-lg p-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 ${
   358	                feedback === 'down'
   359	                  ? 'text-red-500 dark:text-red-400'
   360	                  : 'text-[var(--workbench-muted)] hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white'
   361	              }`}
   362	              title={t('feedback.notHelpful')}
   363	              aria-label={t('feedback.notHelpful')}
   364	              aria-pressed={feedback === 'down'}
   365	            >
   366	              <ThumbsDown size={14} fill={feedback === 'down' ? 'currentColor' : 'none'} />
   367	            </button>
   368	            {message.shareAnchor && onShareAnswer && !isStreaming && (
   369	              <button
   370	                onClick={() => onShareAnswer(message)}
   371	                disabled={isSharingAnswer}
   372	                className="rounded-full p-1.5 text-[var(--workbench-muted)] transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50"
   373	                title={t('chat.shareAnswer')}
   374	                aria-label={t('chat.shareAnswer')}
   375	              >
   376	                <Share2 size={14} />
   377	              </button>
   378	            )}
   379	            {isLastAssistant && onRegenerate && !isStreaming && (
   380	              <button
   381	                onClick={onRegenerate}
   382	                className="rounded-full p-1.5 text-[var(--workbench-muted)] transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400"
   383	                title={t('chat.regenerate')}
   384	                aria-label={t('chat.regenerate')}
   385	              >
   386	                <RotateCcw size={14} />
   387	              </button>
   388	            )}
   389	          </div>
   390	        )}
   391	
   392	        {/* Continue generating button */}
   393	        {isAssistant && message.isTruncated && !isStreaming && isLastAssistant && onContinue && (
   394	          <button
   395	            onClick={onContinue}
   396	            className="mt-2 flex items-center gap-1.5 rounded-lg border border-[var(--reader-evidence-border)] bg-[var(--reader-evidence-soft)] px-3 py-1.5 text-sm font-medium text-[var(--reader-evidence)] transition-colors hover:brightness-95 focus-visible:ring-2 focus-visible:ring-[var(--reader-evidence)]"
   397	            title={t('chat.continueGenerating')}
   398	          >
   399	            <ChevronsDown size={14} />
   400	            {t('chat.continueGenerating')}
   401	          </button>
   402	        )}
   403	      </div>
   404	    </div>
   405	  );
   406	}
   407	
   408	/**
   409	 * Memoized export — prevents the chat re-render storm during SSE streaming
   410	 * (Wave-2 I21). The store flushes the streaming assistant message every

PUBLIC HEADER
     1	"use client";
     2	
     3	import { useState } from 'react';
     4	import Link from 'next/link';
     5	import { Menu, X } from 'lucide-react';
     6	import DocTalkLogo from './DocTalkLogo';
     7	import LanguageSelector from './LanguageSelector';
     8	import FeedbackButton from './FeedbackButton';
     9	import { useLocale } from '../i18n';
    10	import { trackEvent } from '../lib/analytics';
    11	
    12	export default function PublicHeader() {
    13	  const { t, tOr } = useLocale();
    14	  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    15	  const publicNav = [
    16	    { href: '/features', label: t('public.nav.features') },
    17	    { href: '/use-cases', label: t('public.nav.useCases') },
    18	    { href: '/compare', label: t('public.nav.compare') },
    19	    { href: '/blog', label: t('public.nav.blog') },
    20	    { href: '/pricing', label: t('footer.pricing') },
    21	  ];
    22	
    23	  return (
    24	    <header className="dt-shell-header relative h-14 flex items-center px-4 sm:px-6 gap-3 min-w-0 shrink-0 sticky top-0 z-30 border-b">
    25	      <Link href="/" className="font-logo font-semibold text-xl text-[var(--workbench-ink)] hover:text-zinc-950 dark:hover:text-white transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm inline-flex items-center gap-2">
    26	        <DocTalkLogo size={26} />
    27	        {t('app.title')}
    28	        <span className="ml-1 -mt-2 px-1.5 py-0.5 text-[10px] font-medium leading-none rounded-full border border-zinc-300 bg-zinc-100 dark:border-white/18 dark:bg-white/8 text-[var(--workbench-muted)] tracking-wide uppercase">Beta</span>
    29	      </Link>
    30	
    31	      <nav className="hidden lg:flex items-center gap-4 ml-4" aria-label="Public navigation">
    32	        {publicNav.map((item) => (
    33	          <Link
    34	            key={item.href}
    35	            href={item.href}
    36	            className="rounded-full px-3 py-1.5 text-sm font-medium text-[var(--workbench-muted)] transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-white/10 dark:hover:text-white"
    37	          >
    38	            {item.label}
    39	          </Link>
    40	        ))}
    41	      </nav>
    42	
    43	      <div className="ml-auto flex items-center gap-2 shrink-0">
    44	        <div className="hidden sm:flex"><LanguageSelector /></div>
    45	        <div className="hidden md:flex"><FeedbackButton /></div>
    46	        <button
    47	          type="button"
    48	          onClick={() => setMobileMenuOpen((open) => !open)}
    49	          className="dt-workbench-button inline-flex h-9 w-9 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 dark:focus-visible:ring-zinc-500 dark:focus-visible:ring-offset-zinc-900 lg:hidden"
    50	          aria-label={mobileMenuOpen ? t('common.close') : tOr('common.menu', 'Menu')}
    51	          aria-expanded={mobileMenuOpen}
    52	          aria-controls="mobile-public-navigation"
    53	        >
    54	          {mobileMenuOpen ? <X aria-hidden="true" size={18} /> : <Menu aria-hidden="true" size={18} />}
    55	        </button>
    56	        <Link
    57	          href="/demo"
    58	          onClick={() => trackEvent('landing_cta_clicked', { source: 'public_header', reason: 'demo' })}
    59	          className="dt-workbench-pill hidden sm:inline-flex items-center rounded-full px-3 py-1.5 text-sm transition-colors hover:border-[var(--workbench-border-strong)] hover:text-zinc-950 dark:hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400"
    60	        >
    61	          {t('footer.demo')}
    62	        </Link>
    63	        <Link
    64	          href="/auth"
    65	          onClick={() => trackEvent('landing_cta_clicked', { source: 'public_header', reason: 'sign_up' })}
    66	          className="dt-stitch-primary inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
    67	        >
    68	          {t('hero.signUpFree')}
    69	        </Link>
    70	      </div>
    71	      {mobileMenuOpen && (
    72	        <nav
    73	          id="mobile-public-navigation"
    74	          className="dt-glass-panel absolute left-3 right-3 top-full mt-2 rounded-2xl p-2 shadow-xl lg:hidden"
    75	          aria-label="Mobile navigation"
    76	        >
    77	          <div className="grid gap-1">
    78	            {[...publicNav, { href: '/demo', label: t('footer.demo') }].map((item) => (
    79	              <Link
    80	                key={item.href}
    81	                href={item.href}
    82	                onClick={() => setMobileMenuOpen(false)}
    83	                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-200 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
    84	              >
    85	                {item.label}
    86	              </Link>
    87	            ))}
    88	          </div>
    89	          <div className="mt-2 border-t border-zinc-200 px-3 py-2 dark:border-zinc-800 sm:hidden">
    90	            <LanguageSelector />
    91	          </div>
    92	        </nav>
    93	      )}
    94	    </header>
    95	  );
    96	}

DASHBOARD TARGET REGION
   370	    } catch (e) {
   371	      console.error('Failed to delete document:', e);
   372	      // Surface the failure so users know to retry rather than think it worked.
   373	      setDeleteErrorId(documentId);
   374	    } finally {
   375	      setDeletingId(null);
   376	    }
   377	  }, [isLoggedIn]);
   378	
   379	  return (
   380	    <div className="dt-stitch-theme flex flex-col min-h-screen">
   381	      <Header variant="full" />
   382	      <main id="main-content" className="flex-1 flex flex-col items-center p-6 sm:p-8 gap-10">
   383	        <div className="max-w-4xl w-full">
   384	          <div className="mb-4 flex justify-center">
   385	            <PrivacyBadge />
   386	          </div>
   387	
   388	          {showUpgradeNudge && (
   389	            <section className="dt-stitch-card mb-5 rounded-2xl p-4">
   390	              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
   391	                <div className="flex gap-3">
   392	                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900/5 text-zinc-700 dark:bg-white/12 dark:text-white">
   393	                    <Sparkles aria-hidden="true" size={18} />
   394	                  </div>
   395	                  <div>
   396	                    <h2 className="text-sm font-semibold text-[var(--workbench-ink)]">
   397	                      {tOr('dashboard.upgradeNudge.title', 'Ready for heavier document work?')}
   398	                    </h2>
   399	                    <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--workbench-muted)]">
   400	                      {tOr(
   401	                        'dashboard.upgradeNudge.body',
   402	                        'Plus gives you 20 documents, 50 MB uploads, all AI modes, and Markdown export before your next limit stops the workflow.'
   403	                      )}
   404	                    </p>
   405	                  </div>
   406	                </div>
   407	                <div className="flex shrink-0 items-center gap-2 sm:self-start">
   408		                  <Link
   409		                    href={billingHref({ plan: 'plus', source: 'dashboard_upgrade_reminder', reason: 'sustained_free_usage' })}
   410		                    onClick={() => trackEvent('upgrade_click', {
   411		                      plan: 'plus',
   412		                      period: 'monthly',
   413		                      source: 'dashboard_upgrade_reminder',
   414		                      reason: 'sustained_free_usage',
   415		                    })}
   416	                    className="dt-stitch-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
   417	                  >
   418	                    {tOr('dashboard.upgradeNudge.cta', 'Upgrade')}
   419	                    <ArrowRight aria-hidden="true" size={15} />
   420	                  </Link>
   421	                  <button
   422	                    type="button"
   423	                    onClick={dismissUpgradeNudge}
   424	                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--workbench-muted)] transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
   425	                    aria-label={tOr('dashboard.upgradeNudge.dismiss', 'Dismiss upgrade prompt')}
   426	                  >
   427	                    <X aria-hidden="true" size={16} />
   428	                  </button>
   429	                </div>
   430	              </div>
   431	            </section>
   432	          )}
   433	
   434	          <div
   435	            className={`dt-command-bar rounded-[2rem] p-8 text-center transition-colors sm:p-12 ${
   436	              isDragging
   437	                ? 'border-accent bg-accent/5 dark:border-white/40 dark:bg-white/10'
   438	                : 'border-zinc-300 dark:border-white/18'
   439	            }`}
   440	            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
   441	            onDragLeave={() => setDragging(false)}
   442	            onDrop={onDrop}
   443	          >
   444	            <input ref={inputRef} type="file" accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/markdown,.pdf,.docx,.pptx,.xlsx,.txt,.md" className="hidden" onChange={onInputChange} aria-label="Upload document" />
   445	            <p className="text-[var(--workbench-ink)] text-lg">{t('upload.dragDrop')}</p>
   446	            <p className="text-[var(--workbench-muted)] text-xs mt-1">{t('upload.supportedFormats')}</p>
   447	            <p className="text-[var(--workbench-muted)] text-sm mt-1">{t('upload.or')}</p>
   448	            <button
   449	              type="button"
   450	              onClick={() => inputRef.current?.click()}
   451	              className="dt-stitch-primary mt-4 rounded-full px-6 py-2.5 font-medium transition-[box-shadow,color,background-color] disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
   452	              disabled={uploading}
   453	            >
   454	              {t('upload.chooseFile')}
   455	            </button>
   456	            {progressText && (
   457	              <div aria-live="polite" className={`mt-4 text-sm ${uploading ? 'text-zinc-500' : 'text-red-600 dark:text-red-400'}`}>
   458	                <p>{progressText}</p>
   459	                {uploadErrorCopy?.cta && (
   460	                  <Link
   461	                    href={uploadErrorCopy.cta.href}
   462	                    onClick={() => trackEvent('upgrade_click', { source: 'upload_error', reason: 'upload_limit' })}
   463	                    className="mt-3 inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
   464	                  >
   465	                    {uploadErrorCopy.cta.label}
   466	                  </Link>
   467	                )}
   468	              </div>
   469	            )}
   470	          </div>
   471	
   472	          {/* URL Import */}
   473	          <div className="mt-4 flex items-center gap-2 max-w-lg mx-auto">
   474	            <div className="flex-1 relative">
   475	              <Link2 aria-hidden="true" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
   476	              <input
   477	                type="url"
   478	                value={urlInput}
   479	                onChange={(e) => { setUrlInput(e.target.value); setUrlError(''); setUrlErrorCopy(null); }}
   480	                onKeyDown={(e) => { if (e.key === 'Enter') onUrlSubmit(); }}
   481	                placeholder={t('upload.urlPlaceholder')}
   482	                className="w-full rounded-full border border-zinc-300 bg-white py-2.5 pl-9 pr-3 text-sm text-[var(--workbench-ink)] placeholder:text-zinc-400 dark:border-white/14 dark:bg-white/8 dark:placeholder:text-white/38 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
   483	                disabled={urlLoading}
   484	                aria-label="Document URL"
   485	              />
   486	            </div>
   487	            <button
   488	              onClick={onUrlSubmit}
   489	              disabled={urlLoading || !urlInput.trim()}
   490	              className="dt-stitch-primary rounded-full px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
   491	            >
   492	              {urlLoading ? '...' : t('upload.ingestUrl')}
   493	            </button>
   494	          </div>
   495	          {urlError && (
   496	            <div role="alert" className="mt-2 text-center text-sm text-red-600 dark:text-red-400">
   497	              <p>{urlError}</p>
   498	              {urlErrorCopy?.cta && (
   499	                <Link
   500	                  href={urlErrorCopy.cta.href}
   501	                  onClick={() => trackEvent('upgrade_click', { source: 'url_error', reason: 'url_limit' })}
   502	                  className="mt-3 inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
   503	                >
   504	                  {urlErrorCopy.cta.label}
   505	                </Link>
   506	              )}
   507	            </div>
   508	          )}
   509	
   510	          <div className="mt-3 text-center">
   511	            <Link href="/demo" className="text-[var(--workbench-muted)] hover:text-zinc-900 dark:hover:text-white text-sm transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm">
   512	              {t('home.cta.tryDemo')}
   513	            </Link>
   514	          </div>
   515	        </div>
   516	
   517	        <div className="max-w-4xl w-full">
   518	          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
   519	            <h2 className="text-3xl font-semibold tracking-normal text-[var(--workbench-ink)]">{t('doc.myDocuments')}</h2>
   520	            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
   521	              <Link
   522	                href="/document-diff"
   523	                className="dt-workbench-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
   524	              >
   525	                <GitCompare aria-hidden="true" size={16} />
   526	                {tOr('diff.tab', 'Compare')}
   527	              </Link>
   528	              <Link
   529	                href="/collections"
   530	                className="dt-workbench-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
   531	              >
   532	                <FolderOpen aria-hidden="true" size={16} />
   533	                {tOr('dashboard.workspacesLink', 'Workspaces')}
   534	              </Link>
   535	            </div>
   536	          </div>
   537	
   538	          {showWorkspaceNudge && (
   539	            <section className="dt-stitch-card mb-4 rounded-2xl p-4">
   540	              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
   541	                <div className="flex gap-3">
   542	                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-white/14 dark:bg-white/8 dark:text-white">
   543	                    <FolderOpen aria-hidden="true" size={18} />
   544	                  </div>
   545	                  <div>
   546	                    <h3 className="text-sm font-semibold text-[var(--workbench-ink)]">
   547	                      {tOr('dashboard.workspaceNudge.title', 'Turn related documents into a workspace')}
   548	                    </h3>
   549	                    <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--workbench-muted)]">
   550	                      {tOr(
   551	                        'dashboard.workspaceNudge.body',
   552	                        'You have ready documents. Group them to ask cross-document questions while keeping citations tied to the exact source file.'
   553	                      )}
   554	                    </p>
   555	                  </div>
   556	                </div>
   557	                <Link
   558	                  href="/collections?action=create&select=ready"
   559	                  className="dt-stitch-primary inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
   560	                >
   561	                  {tOr('dashboard.workspaceNudge.cta', 'Create workspace')}
   562	                  <ArrowRight aria-hidden="true" size={15} />
   563	                </Link>
   564	              </div>
   565	            </section>
   566	          )}
   567	
   568	          {allDocs.length === 0 ? (
   569	            <div className="dt-stitch-card flex flex-col items-center justify-center rounded-2xl border-dashed px-6 py-16 text-center">
   570	              <FileUp aria-hidden="true" size={52} className="text-[var(--workbench-muted)]" />
   571	              <h3 className="mt-5 text-xl font-semibold text-[var(--workbench-ink)]">{t('dashboard.emptyTitle')}</h3>
   572	              <p className="mt-2 max-w-md text-sm text-[var(--workbench-muted)]">{t('dashboard.emptySubtitle')}</p>
   573	              {/* Dual CTA per Codex r1 + 30-agent onboarding research:
   574	                  primary "Start with a sample" bypasses the upload-and-wait
   575	                  cliff that's eating activation; secondary text link
   576	                  preserves "I have my own doc" path. */}
   577	              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
   578	                <Link
   579	                  href="/demo"
   580	                  className="dt-stitch-primary group inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-[box-shadow,color,background-color] motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
   581	                >
   582	                  {tOr('dashboard.emptyTrySample', 'Start with a sample doc')}
   583	                  <span aria-hidden="true" className="transition-transform motion-reduce:transform-none group-hover:translate-x-0.5">→</span>
   584	                </Link>
   585	                <button
   586	                  type="button"
   587	                  onClick={() => inputRef.current?.click()}
   588	                  className="text-sm font-semibold text-[var(--workbench-muted)] transition-colors hover:text-zinc-900 dark:hover:text-white motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm"
   589	                >
   590	                  {tOr('dashboard.emptyUploadOwn', 'Or upload your own')}
   591	                </button>
   592	              </div>
   593	            </div>
   594	          ) : (
   595	            <div className="space-y-3">
   596	              {allDocs.map((d) => {
   597	                const statusMeta = getDocStatusMeta(d.status);
   598	                return (
   599	                  <div
   600	                    key={d.document_id}
   601	                    className="dt-stitch-card flex items-center justify-between rounded-2xl p-5 transition-transform duration-200 hover:-translate-y-0.5"
   602	                  >
   603	                    <Link href={`/d/${d.document_id}`} className="flex-1 min-w-0 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-lg">
   604	                      <div className="font-medium text-[var(--workbench-ink)] flex items-center gap-2 min-w-0">
   605	                        <span className="truncate">{d.filename ? sanitizeFilename(d.filename) : d.document_id}</span>
   606	                        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--workbench-muted)] shrink-0">
   607	                          <span className={`w-2 h-2 rounded-full ${statusMeta.dotClass}`} />
   608	                          <span>{statusMeta.label}</span>
   609	                        </span>
   610	                      </div>
   611	                      <div className="text-xs text-[var(--workbench-muted)] mt-0.5">
   612	                        {new Date(d.createdAt).toLocaleString()}
   613	                      </div>
   614	                    </Link>
   615	                    <div className="flex items-center gap-2">
   616	                      <Link
   617	                        href={`/d/${d.document_id}`}
   618	                        className="dt-stitch-primary rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
   619	                      >
   620	                        {t('doc.open')}
   621	                      </Link>
   622	                      {confirmDeleteId === d.document_id ? (
   623	                        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-300">
   624	                          <span>{t('dashboard.deletePrompt')}</span>
   625	                          <button
   626	                            className="px-2 py-1 rounded-md bg-red-600 text-white hover:bg-red-500 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500"
   627	                            disabled={deletingId === d.document_id}
   628	                            onClick={() => confirmDeleteDocument(d.document_id)}
   629	                          >
   630	                            {t('common.yes')}
   631	                          </button>
   632	                          <button
   633	                            className="px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500"
   634	                            disabled={deletingId === d.document_id}
   635	                            onClick={() => setConfirmDeleteId(null)}
   636	                          >
   637	                            {t('common.no')}
   638	                          </button>
   639	                        </div>
   640	                      ) : deleteErrorId === d.document_id ? (
   641	                        <div className="flex items-center gap-1.5 text-xs">
   642	                          <span role="alert" className="text-red-600 dark:text-red-400">
   643	                            {tOr('dashboard.deleteError', 'Delete failed. Try again.')}
   644	                          </span>
   645	                          <button
   646	                            className="px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500"
   647	                            onClick={() => { setDeleteErrorId(null); setConfirmDeleteId(d.document_id); }}
   648	                          >
   649	                            {tOr('common.retry', 'Retry')}
   650	                          </button>
   651	                          <button
   652	                            className="px-2 py-1 rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500"
   653	                            onClick={() => setDeleteErrorId(null)}
   654	                            aria-label={tOr('common.dismiss', 'Dismiss')}
   655	                          >
   656	                            <X aria-hidden="true" size={14} />
   657	                          </button>
   658	                        </div>
   659	                      ) : (
   660	                        <button
   661	                          className="rounded-full p-2 text-[var(--workbench-muted)] transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
   662	                          disabled={deletingId === d.document_id}
   663	                          onClick={() => setConfirmDeleteId(d.document_id)}
   664	                          title={t('doc.deleteDoc')}
   665	                          aria-label="Delete document"
   666	                        >
   667	                          <Trash2 aria-hidden="true" size={16} />
   668	                        </button>
   669	                      )}
   670	                    </div>
   671	                  </div>
   672	                );
   673	              })}
   674	            </div>
   675	          )}
   676	        </div>
   677	      </main>
   678	    </div>
   679	  );
   680	}

exec
/bin/zsh -lc "rg -n \"celery beat|beat_schedule|--beat|celery.*worker|cleanup_expired_verification_tokens|cleanup-empty\" . --hidden --glob '"'!frontend/node_modules/**'"' --glob '"'!.git/**'"' --glob '"'!*.diff'"' | head -n 500; printf '\\nDEPLOY FILES\\n'; rg --files --hidden --glob '"'!frontend/node_modules/**'"' --glob '"'!.git/**'"' | rg '(Procfile|railway|Dockerfile|docker-compose|compose|nixpacks|start|deploy)' | sort | head -n 300; printf '\\nCOMPOSE CELERY\\n'; rg -n -C 8 \"celery|beat|worker\" docker-compose.yml docker-compose.yaml backend/Dockerfile railway.toml backend/railway.toml Procfile backend/Procfile 2>/dev/null || true" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
./CLAUDE.md:25:  python3 -m celery -A app.workers.celery_app worker \
./README.ko.md:109:  -A app.workers.celery_app worker --loglevel=info -Q default,parse
./AGENTS.md:30:  python3 -m celery -A app.workers.celery_app worker \
./README.pt.md:109:  -A app.workers.celery_app worker --loglevel=info -Q default,parse
./README.de.md:109:  -A app.workers.celery_app worker --loglevel=info -Q default,parse
./README.ja.md:109:  -A app.workers.celery_app worker --loglevel=info -Q default,parse
./README.md:126:  -A app.workers.celery_app worker --loglevel=info -Q default,parse
./backend/entrypoint.sh:12:python -m celery -A app.workers.celery_app worker \
./backend/entrypoint.sh:21:# Runs periodic tasks defined in celery_app.conf.beat_schedule (e.g.,
./backend/entrypoint.sh:32:    python -m celery -A app.workers.celery_app beat \
./README.zh.md:109:  -A app.workers.celery_app worker --loglevel=info -Q default,parse
./README.fr.md:109:  -A app.workers.celery_app worker --loglevel=info -Q default,parse
./docs/ARCHITECTURE.md:488:**Expired token cleanup**: A Celery Beat periodic task (`cleanup_expired_verification_tokens`) runs daily to delete verification tokens that expired more than 48 hours ago, keeping the database clean.
./docs/ARCHITECTURE.md:1033:| **Runtime** | Serverless functions (Hobby plan) | Single container (`entrypoint.sh`): alembic → celery worker + celery beat + uvicorn (parallel; any exit → container restart by Railway) |
./docs/ARCHITECTURE.zh.md:463:**过期令牌清理**：Celery Beat 定期任务（`cleanup_expired_verification_tokens`）每日运行，删除超过 48 小时过期的验证令牌，保持数据库整洁。
./docs/ARCHITECTURE.zh.md:925:| **运行时** | Serverless 函数（Hobby 计划） | 单容器（`entrypoint.sh`）：alembic → celery worker + celery beat + uvicorn 并行运行（任一退出 → Railway 重启整个容器） |
./.collab/plans/2026-08-02-p0-demo-retune-ui-fixes.md:187:- Modify: `backend/app/workers/cleanup_tasks.py` (follow the existing `cleanup_expired_verification_tokens` pattern — sync DB)
./.collab/plans/2026-08-02-p0-demo-retune-ui-fixes.md:227:    "cleanup-empty-demo-sessions-daily": {
./README.es.md:109:  -A app.workers.celery_app worker --loglevel=info -Q default,parse
./.collab/plans/email-improvement-plan.md:324:async def cleanup_expired_verification_tokens():
./.collab/tasks/qa-run-2026-05-10-browser-ingest-ux.md:37:cd backend && OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES python3 -m celery -A app.workers.celery_app worker --loglevel=info -Q default,parse
./.collab/tasks/qa-run-2026-05-10-browser-app-workflows-ux.md:30:cd backend && OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES python3 -m celery -A app.workers.celery_app worker --loglevel=info -Q default,parse
./.collab/reviews/2026-05-24-phase2-codex-review.md:3414:backend/app/workers/celery_app.py:47:    "app.workers.parse_worker.parse_document": {"queue": "parse"},
./.collab/reviews/2026-08-02-p0-demo-retune-codex-r1.md:385:- Modify: `backend/app/workers/cleanup_tasks.py` (follow the existing `cleanup_expired_verification_tokens` pattern — sync DB)
./.collab/reviews/2026-08-02-p0-demo-retune-codex-r1.md:425:    "cleanup-empty-demo-sessions-daily": {
./.collab/reviews/2026-08-02-p0-demo-retune-codex-r1.md:990:(`cleanup_expired_verification_tokens`) builds a plain `sa.create_engine(sync_url)`
./.collab/reviews/2026-08-02-p0-demo-retune-codex-r1.md:1024:`"cleanup-empty-demo-sessions-daily": {"task": "cleanup_empty_demo_sessions", "schedule": 86400}`
./.collab/reviews/2026-08-02-p0-demo-retune-codex-r1.md:1025:to `celery_app.py`'s `beat_schedule`.
./.collab/reviews/2026-08-02-p0-demo-retune-codex-r1.md:2131:diff --git a/backend/app/workers/celery_app.py b/backend/app/workers/celery_app.py
./.collab/reviews/2026-08-02-p0-demo-retune-codex-r1.md:2185: # Periodic tasks (requires celery beat scheduler)
./.collab/reviews/2026-08-02-p0-demo-retune-codex-r1.md:2186: celery_app.conf.beat_schedule = {
./.collab/reviews/2026-08-02-p0-demo-retune-codex-r1.md:2188:         "task": "cleanup_expired_verification_tokens",
./.collab/reviews/2026-08-02-p0-demo-retune-codex-r1.md:2191:+    "cleanup-empty-demo-sessions-daily": {
./.collab/reviews/2026-08-02-p0-demo-retune-codex-r1.md:2215: @celery_app.task(name="cleanup_expired_verification_tokens")
./.collab/reviews/2026-08-02-p0-demo-retune-codex-r1.md:2216: def cleanup_expired_verification_tokens():
./.collab/reviews/2026-08-02-p0-demo-retune-codex-r1.md:2334:     cleanup_tasks.cleanup_expired_verification_tokens()
./.collab/reviews/2026-04-12-consensus-codebase-review.md:55:| P2-1 | **Celery beat 未启动** —— `celery_app.py:41-47` 定义了周期任务（卡住文档重派、过期 token 清理），但 `entrypoint.sh:21-55` 只启动 worker | `celery_app.py:41-47`; `entrypoint.sh:21-55` |
./.collab/reviews/2026-04-12-consensus-codebase-review.md:80:5. **P2-1 启动 Celery beat** — entrypoint 增加 `celery beat` 进程（或 Railway 独立服务）
./.collab/tasks/2026-05-10-goal-full-product-testing.md:378:cd backend && OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES python3 -m celery -A app.workers.celery_app worker --loglevel=info -Q default,parse
./.collab/reviews/2026-04-12-p2-1-codex-review.md:4:- `start_celery &`/`start_beat &` 在子 shell，PID 不回写父进程，trap kill 不到 worker/beat。
./backend/tests/test_cleanup_tasks.py:43:    cleanup_tasks.cleanup_expired_verification_tokens()
./.collab/archive/task-1.4-output.md:5:  - backend/app/workers/celery_app.py: Celery app reads `CELERY_BROKER_URL`, routes `app.workers.parse_worker.parse_document` to `parse` queue.
./.collab/archive/task-1.4-output.md:29:- Start Celery worker: `cd backend && celery -A app.workers.celery_app.celery_app worker -Q parse -l info`
./.collab/reviews/2026-05-24-phase2-fixbatch.md:532:backend/app/workers/cleanup_tasks.py:15:@celery_app.task(name="cleanup_expired_verification_tokens")
./.collab/reviews/2026-05-24-phase2-fixbatch.md:573:backend/app/workers/celery_app.py:50:# Periodic tasks (requires celery beat scheduler)
./.collab/reviews/2026-05-24-phase2-fixbatch.md:574:backend/app/workers/celery_app.py:51:celery_app.conf.beat_schedule = {
./.collab/reviews/2026-05-20-frontend-audit-c1-impl-codex.md:1145:   python3 -m celery -A app.workers.celery_app worker \
./.collab/reviews/2026-05-20-frontend-audit-c1-impl-codex.md:1252:   python3 -m celery -A app.workers.celery_app worker \
./.collab/reviews/2026-05-20-frontend-audit-c1-impl-codex.md:1458:   -A app.workers.celery_app worker --loglevel=info -Q default,parse
./.collab/reviews/2026-05-20-frontend-audit-c1-impl-codex.md:1790: | **Runtime** | Serverless functions (Hobby plan) | Single container (`entrypoint.sh`): alembic → celery worker + celery beat + uvicorn (parallel; any exit → container restart by Railway) |
./.collab/reviews/2026-05-20-frontend-audit-c1-impl-codex.md:2262: | **运行时** | Serverless 函数（Hobby 计划） | 单容器（`entrypoint.sh`）：alembic → celery worker + celery beat + uvicorn 并行运行（任一退出 → Railway 重启整个容器） |
./.collab/reviews/2026-05-20-frontend-audit-c1-impl-codex.md:2713:| **Runtime** | Serverless functions (Hobby plan) | Single container (`entrypoint.sh`): alembic → celery worker + celery beat + uvicorn (parallel; any exit → container restart by Railway) |
./.collab/reviews/2026-05-24-phase2-b5-impl.md:1052:backend/app/workers/cleanup_tasks.py:16:def cleanup_expired_verification_tokens():
./backend/app/workers/cleanup_tasks.py:15:@celery_app.task(name="cleanup_expired_verification_tokens")
./backend/app/workers/cleanup_tasks.py:16:def cleanup_expired_verification_tokens():
./backend/app/workers/celery_app.py:50:# Periodic tasks (requires celery beat scheduler)
./backend/app/workers/celery_app.py:51:celery_app.conf.beat_schedule = {
./backend/app/workers/celery_app.py:53:        "task": "cleanup_expired_verification_tokens",
./backend/app/workers/celery_app.py:56:    "cleanup-empty-demo-sessions-daily": {

DEPLOY FILES
.claude/skills/deploy/SKILL.md
.collab/plans/2026-05-14-admin-analytics-feedback-deploy-checklist.md
.collab/scripts/qa_post_deploy_public_regression.py
.collab/tasks/qa-run-2026-05-11-post-deploy-public-regression-orchestrator.md
.collab/tasks/qa-run-2026-05-11-post-deploy-rerun-closure.md
.collab/tasks/qa-run-2026-05-11-recovery-deploy-scope.md
.railwayignore
backend/Dockerfile
backend/railway.toml
docker-compose.yml
infra/minio/Dockerfile
infra/qdrant/Dockerfile

COMPOSE CELERY
backend/Dockerfile-53-# file is present — the build fails loudly here if entrypoint.sh is ever missing.
backend/Dockerfile-54-COPY version.json /app/version.json
backend/Dockerfile-55-COPY backend/ /app/
backend/Dockerfile-56-
backend/Dockerfile-57-EXPOSE 8000
backend/Dockerfile-58-
backend/Dockerfile-59-# Entrypoint script with process supervision:
backend/Dockerfile-60-# - Runs Alembic migrations
backend/Dockerfile:61:# - Starts Celery worker with automatic restart on crash
backend/Dockerfile-62-# - Starts uvicorn API server
backend/Dockerfile-63-# - Forwards SIGTERM to both processes for graceful shutdown
backend/Dockerfile-64-RUN chmod +x /app/entrypoint.sh && chown -R app:app /app
backend/Dockerfile-65-
backend/Dockerfile-66-USER app
backend/Dockerfile-67-
backend/Dockerfile-68-CMD ["/app/entrypoint.sh"]

exec
/bin/zsh -lc 'git rev-parse --short HEAD; git status --short; git diff --name-only aaeb334..HEAD; git diff --name-only; git log --oneline -16' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
aaeb334
?? .collab/plans/2026-08-02-p0-demo-retune-ui-fixes.md
?? .collab/reviews/2026-08-02-p0-demo-retune-codex-r1.md
?? .collab/reviews/2026-08-02-p0-demo-retune-review-request.md
aaeb334 fix(demo): review round 2 — reuse path double-counted demo message usage
7a31bfe fix(demo): review round 1 — session dropdown, SSR i18n, override lifecycle, fr copy
db7d263 fix(ui): thumbs-up active state invisible in light mode (W2 review fix round 1)
5cb74dc feat(demo): share affordance for anonymous users + upload CTA lands on dashboard
1523370 fix(ui): restore light-mode visibility for shell/dashboard chrome
ae83e1f fix(ui): restore light-mode visibility for chat controls de-glassed in 0b7404a
f627557 fix(demo): emit hreflang alternates on canonical /demo page
f5850e5 feat(demo): locale URLs for /demo + truthful per-document cap copy
0614e0e feat(auth): optional callbackUrl override for the auth modal
25f8e8e fix(demo): reuse anonymous demo session across page views via sessionStorage
db81487 fix(telemetry): whitelist pre-auth auth_confirm events
b459e4f feat(demo): nightly prune of empty anonymous demo sessions
ad7cbae fix(demo): session-per-doc cap counts a 24h rolling window, not lifetime
40733b8 fix(demo): scope demo message limit per (IP, document) as advertised
04a2eb8 chore(release): bump to 0.22.0
e3de92a fix: v0.22.0 batch — magic-link interstitial, focus billing, leak fixes (Codex consensus)

exec
/bin/zsh -lc "nl -ba frontend/src/lib/analytics.ts | sed -n '1,160p'; printf '\\nSHARING ACCESS\\n'; nl -ba backend/app/api/sharing.py | sed -n '1,280p'; printf '\\nAUTH FORM\\n'; nl -ba frontend/src/components/AuthFormContent.tsx | sed -n '1,180p'; printf '\\nDEMO ACCESS SERVICE\\n'; nl -ba backend/app/services/doc_service.py | sed -n '1,180p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	type EventParams = Record<string, string | number | boolean | null | undefined>;
     2	
     3	declare global {
     4	  interface Window {
     5	    gtag?: (command: 'event', eventName: string, params?: EventParams) => void;
     6	  }
     7	}
     8	
     9	export function trackEvent(eventName: string, params: EventParams = {}) {
    10	  if (typeof window === 'undefined') return;
    11	  try {
    12	    const safeParams: EventParams = {
    13	      path: window.location.pathname,
    14	      ...params,
    15	    };
    16	    window.gtag?.('event', eventName, safeParams);
    17	    void fetch('/api/proxy/api/events', {
    18	      method: 'POST',
    19	      headers: { 'Content-Type': 'application/json' },
    20	      body: JSON.stringify({ event_name: eventName, properties: safeParams }),
    21	      keepalive: true,
    22	    }).catch(() => undefined);
    23	  } catch {
    24	    // Analytics must never block the user flow.
    25	  }
    26	}

SHARING ACCESS
     1	"""Session sharing API — create, view, revoke shareable links."""
     2	from __future__ import annotations
     3	
     4	from datetime import datetime, timezone
     5	from uuid import UUID
     6	
     7	from fastapi import APIRouter, Depends, HTTPException, Request
     8	from pydantic import BaseModel
     9	from sqlalchemy import func, select
    10	from sqlalchemy.ext.asyncio import AsyncSession
    11	
    12	from app.api.chat import verify_session_access
    13	from app.core.config import settings
    14	from app.core.deps import get_db_session, require_auth
    15	from app.core.rate_limit import get_client_ip, shared_view_limiter
    16	from app.core.security_log import log_security_event
    17	from app.models.tables import ChatSession, Document, Message, SharedSession, User
    18	from app.services.share_anchor_service import message_share_anchor
    19	
    20	router = APIRouter(tags=["sharing"])
    21	
    22	SHARE_NOT_FOUND_DETAIL = {
    23	    "error": "SHARE_NOT_FOUND",
    24	    "message": "Share not found",
    25	}
    26	
    27	
    28	class ShareResponse(BaseModel):
    29	    share_token: str
    30	    url: str
    31	    expires_at: str | None = None
    32	
    33	
    34	class SharedSessionView(BaseModel):
    35	    session_title: str
    36	    document_name: str
    37	    created_at: str
    38	    messages: list[dict]
    39	
    40	
    41	@router.post("/api/sessions/{session_id}/share", response_model=ShareResponse)
    42	async def create_share(
    43	    session_id: UUID,
    44	    user: User = Depends(require_auth),
    45	    db: AsyncSession = Depends(get_db_session),
    46	):
    47	    # Verify session access
    48	    session = await verify_session_access(session_id, user, db)
    49	    if not session:
    50	        raise HTTPException(status_code=404, detail=SHARE_NOT_FOUND_DETAIL)
    51	
    52	    # Check existing share
    53	    existing = await db.execute(
    54	        select(SharedSession).where(
    55	            SharedSession.session_id == session_id,
    56	            SharedSession.user_id == user.id,
    57	        )
    58	    )
    59	    share = existing.scalar_one_or_none()
    60	    if share:
    61	        return ShareResponse(
    62	            share_token=str(share.share_token),
    63	            url=f"{settings.FRONTEND_URL}/shared/{share.share_token}",
    64	            expires_at=share.expires_at.isoformat() if share.expires_at else None,
    65	        )
    66	
    67	    # Free plan limit: 3 active shares
    68	    if user.plan not in ("plus", "pro"):
    69	        count_result = await db.execute(
    70	            select(func.count())
    71	            .select_from(SharedSession)
    72	            .where(
    73	                SharedSession.user_id == user.id,
    74	                (SharedSession.expires_at.is_(None))
    75	                | (SharedSession.expires_at > datetime.now(timezone.utc)),
    76	            )
    77	        )
    78	        active_count = count_result.scalar() or 0
    79	        if active_count >= 3:
    80	            plan = (user.plan or "free").lower()
    81	            raise HTTPException(
    82	                status_code=403,
    83	                detail={
    84	                    "error": "SHARE_LIMIT_REACHED",
    85	                    "message": "Free plan limited to 3 active share links. Upgrade to Plus for unlimited.",
    86	                    "limit": 3,
    87	                    "plan": plan,
    88	                },
    89	            )
    90	
    91	    # Create share
    92	    share = SharedSession(session_id=session_id, user_id=user.id)
    93	    db.add(share)
    94	    await db.commit()
    95	    await db.refresh(share)
    96	
    97	    return ShareResponse(
    98	        share_token=str(share.share_token),
    99	        url=f"{settings.FRONTEND_URL}/shared/{share.share_token}",
   100	    )
   101	
   102	
   103	@router.delete("/api/sessions/{session_id}/share", status_code=204)
   104	async def revoke_share(
   105	    session_id: UUID,
   106	    user: User = Depends(require_auth),
   107	    db: AsyncSession = Depends(get_db_session),
   108	):
   109	    result = await db.execute(
   110	        select(SharedSession).where(
   111	            SharedSession.session_id == session_id,
   112	            SharedSession.user_id == user.id,
   113	        )
   114	    )
   115	    share = result.scalar_one_or_none()
   116	    if not share:
   117	        raise HTTPException(status_code=404, detail=SHARE_NOT_FOUND_DETAIL)
   118	
   119	    await db.delete(share)
   120	    await db.commit()
   121	
   122	
   123	@router.get("/api/shared/{share_token}", response_model=SharedSessionView)
   124	async def view_shared(
   125	    share_token: UUID,
   126	    request: Request,
   127	    db: AsyncSession = Depends(get_db_session),
   128	):
   129	    # Rate limit anonymous public endpoint: 60 req/min per IP. Prevents
   130	    # share-token enumeration and traffic amplification on public URLs.
   131	    client_ip = get_client_ip(request)
   132	    if not await shared_view_limiter.is_allowed(client_ip):
   133	        log_security_event("shared_view_rate_limit", ip=client_ip)
   134	        raise HTTPException(
   135	            status_code=429,
   136	            detail={
   137	                "error": "RATE_LIMITED",
   138	                "message": "Too many requests",
   139	                "retry_after": 60,
   140	            },
   141	            headers={"Retry-After": "60"},
   142	        )
   143	
   144	    result = await db.execute(
   145	        select(SharedSession).where(SharedSession.share_token == share_token)
   146	    )
   147	    share = result.scalar_one_or_none()
   148	    if not share:
   149	        raise HTTPException(status_code=404, detail=SHARE_NOT_FOUND_DETAIL)
   150	
   151	    # Check expiry
   152	    if share.expires_at and share.expires_at < datetime.now(timezone.utc):
   153	        raise HTTPException(
   154	            status_code=410,
   155	            detail={"error": "SHARE_EXPIRED", "message": "Share link has expired"},
   156	        )
   157	
   158	    # Load session
   159	    session_result = await db.execute(
   160	        select(ChatSession).where(ChatSession.id == share.session_id)
   161	    )
   162	    session = session_result.scalar_one_or_none()
   163	    if not session:
   164	        raise HTTPException(status_code=404, detail=SHARE_NOT_FOUND_DETAIL)
   165	
   166	    # Load messages
   167	    rows = await db.execute(
   168	        select(Message)
   169	        .where(Message.session_id == share.session_id)
   170	        .order_by(Message.created_at)
   171	    )
   172	    messages = list(rows.scalars())
   173	
   174	    # Build safe response — exclude bboxes, documentId, chunkId, confidence
   175	    safe_messages = []
   176	    for msg in messages:
   177	        safe_msg: dict = {
   178	            "id": message_share_anchor(msg.id),
   179	            "role": msg.role,
   180	            "content": msg.content,
   181	        }
   182	        if msg.citations:
   183	            safe_citations = []
   184	            for c in msg.citations:
   185	                if not isinstance(c, dict):
   186	                    continue
   187	                safe_citations.append(
   188	                    {
   189	                        "text_snippet": c.get("text_snippet", ""),
   190	                        "page": c.get("page"),
   191	                        "document_filename": c.get("document_filename", ""),
   192	                    }
   193	                )
   194	            safe_msg["citations"] = safe_citations
   195	        safe_messages.append(safe_msg)
   196	
   197	    doc_name = "document"
   198	    if session.document_id:
   199	        doc_result = await db.execute(
   200	            select(Document.filename).where(Document.id == session.document_id)
   201	        )
   202	        row = doc_result.first()
   203	        if row:
   204	            doc_name = row[0] or doc_name
   205	
   206	    return SharedSessionView(
   207	        session_title=session.title or "Untitled Conversation",
   208	        document_name=doc_name,
   209	        created_at=session.created_at.isoformat(),
   210	        messages=safe_messages,
   211	    )

AUTH FORM
     1	"use client";
     2	
     3	import { useState, useEffect, useRef, useCallback } from "react";
     4	import { getProviders, signIn } from "next-auth/react";
     5	import { useLocale } from "../i18n";
     6	import { trackEvent } from "../lib/analytics";
     7	
     8	interface AuthFormContentProps {
     9	  callbackUrl: string;
    10	  surface?: "page" | "modal";
    11	}
    12	
    13	export function AuthFormContent({ callbackUrl, surface = "page" }: AuthFormContentProps) {
    14	  const { t, tOr } = useLocale();
    15	  const [email, setEmail] = useState("");
    16	  const [emailSent, setEmailSent] = useState(false);
    17	  const [sentEmail, setSentEmail] = useState("");
    18	  const [sending, setSending] = useState(false);
    19	  const [error, setError] = useState("");
    20	  const [cooldown, setCooldown] = useState(0);
    21	  const [resendCount, setResendCount] = useState(0);
    22	  const [availableProviders, setAvailableProviders] = useState<Record<string, boolean> | null>(null);
    23	  const cooldownRef = useRef<NodeJS.Timeout | null>(null);
    24	
    25	  const startCooldown = useCallback(() => {
    26	    setCooldown(60);
    27	    cooldownRef.current = setInterval(() => {
    28	      setCooldown((prev) => {
    29	        if (prev <= 1) {
    30	          if (cooldownRef.current) clearInterval(cooldownRef.current);
    31	          cooldownRef.current = null;
    32	          return 0;
    33	        }
    34	        return prev - 1;
    35	      });
    36	    }, 1000);
    37	  }, []);
    38	
    39	  useEffect(() => {
    40	    let cancelled = false;
    41	    void getProviders()
    42	      .then((providers) => {
    43	        if (cancelled) return;
    44	        setAvailableProviders(Object.fromEntries(
    45	          Object.keys(providers || {}).map((providerId) => [providerId, true])
    46	        ));
    47	      })
    48	      .catch(() => {
    49	        if (!cancelled) setAvailableProviders({});
    50	      });
    51	
    52	    return () => {
    53	      cancelled = true;
    54	      if (cooldownRef.current) clearInterval(cooldownRef.current);
    55	    };
    56	  }, []);
    57	
    58	  const authEventSource = `auth_${surface}`;
    59	
    60	  const handleProviderSignIn = (provider: "google" | "microsoft-entra-id") => {
    61	    trackEvent("auth_provider_clicked", {
    62	      source: authEventSource,
    63	      provider,
    64	    });
    65	    void signIn(provider, { callbackUrl });
    66	  };
    67	
    68	  const handleEmailSubmit = async (e: React.FormEvent) => {
    69	    e.preventDefault();
    70	    if (!email.trim() || sending) return;
    71	    setSending(true);
    72	    setError("");
    73	    trackEvent("auth_email_link_requested", {
    74	      source: authEventSource,
    75	      reason: "initial",
    76	    });
    77	    try {
    78	      const result = await signIn("resend", { email: email.trim(), callbackUrl, redirect: false });
    79	      if (result?.error) {
    80	        trackEvent("auth_email_link_failed", {
    81	          source: authEventSource,
    82	          reason: result.error,
    83	        });
    84	        setError(result.error === "Configuration"
    85	          ? t("auth.emailUnavailable")
    86	          : result.error);
    87	        return;
    88	      }
    89	      trackEvent("auth_email_link_sent", {
    90	        source: authEventSource,
    91	        reason: "initial",
    92	      });
    93	      setSentEmail(email.trim());
    94	      setEmailSent(true);
    95	    } catch (err) {
    96	      trackEvent("auth_email_link_failed", {
    97	        source: authEventSource,
    98	        reason: "unexpected",
    99	      });
   100	      setError(t("auth.unexpectedError"));
   101	    } finally {
   102	      setSending(false);
   103	    }
   104	  };
   105	
   106	  const handleResend = async () => {
   107	    if (sending || cooldown > 0 || resendCount >= 3) return;
   108	    setSending(true);
   109	    setError("");
   110	    trackEvent("auth_email_link_requested", {
   111	      source: authEventSource,
   112	      reason: "resend",
   113	    });
   114	    try {
   115	      const result = await signIn("resend", { email: sentEmail, callbackUrl, redirect: false });
   116	      if (result?.error) {
   117	        trackEvent("auth_email_link_failed", {
   118	          source: authEventSource,
   119	          reason: result.error,
   120	        });
   121	        setError(t("auth.resendFailed"));
   122	      } else {
   123	        trackEvent("auth_email_link_sent", {
   124	          source: authEventSource,
   125	          reason: "resend",
   126	        });
   127	        setResendCount((prev) => prev + 1);
   128	        startCooldown();
   129	      }
   130	    } catch (err) {
   131	      trackEvent("auth_email_link_failed", {
   132	        source: authEventSource,
   133	        reason: "unexpected",
   134	      });
   135	      setError(t("auth.unexpectedError"));
   136	    } finally {
   137	      setSending(false);
   138	    }
   139	  };
   140	
   141	  const handleUseDifferentEmail = () => {
   142	    setEmailSent(false);
   143	    setEmail("");
   144	    setSentEmail("");
   145	  };
   146	
   147	  const oauthButtonClass =
   148	    "group flex min-h-12 w-full items-center justify-center gap-3 rounded-md border border-zinc-200 bg-white px-4 py-3 font-medium text-zinc-900 transition-[border-color,background-color] hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:border-zinc-600 dark:hover:bg-zinc-700 dark:focus-visible:ring-offset-zinc-900";
   149	
   150	  const providersLoaded = availableProviders !== null;
   151	  const hasGoogle = !!availableProviders?.google;
   152	  const hasMicrosoft = !!availableProviders?.["microsoft-entra-id"];
   153	  const hasEmail = !!availableProviders?.resend;
   154	  const hasAnyOAuth = hasGoogle || hasMicrosoft;
   155	  const hasAnyProvider = hasAnyOAuth || hasEmail;
   156	
   157	  return (
   158	    <div className="space-y-3">
   159	      {providersLoaded && !hasAnyProvider && (
   160	        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
   161	          {tOr("auth.noProviders", "No sign-in methods are currently available. Please contact support.")}
   162	        </div>
   163	      )}
   164	
   165	      {hasGoogle && (
   166	        <button
   167	          onClick={() => handleProviderSignIn("google")}
   168	          className={oauthButtonClass}
   169	        >
   170	          <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24">
   171	            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
   172	            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
   173	            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
   174	            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
   175	          </svg>
   176	          <span>{t("auth.continueWithGoogle")}</span>
   177	        </button>
   178	      )}
   179	
   180	      {hasMicrosoft && (

DEMO ACCESS SERVICE
     1	from __future__ import annotations
     2	
     3	import asyncio
     4	import logging
     5	import os
     6	import re
     7	import unicodedata
     8	import uuid
     9	from typing import TYPE_CHECKING, Optional
    10	
    11	from sqlalchemy import select
    12	from sqlalchemy.ext.asyncio import AsyncSession
    13	
    14	from app.core.security_log import log_security_event
    15	from app.models.tables import Document
    16	from app.services.storage_service import storage_service
    17	
    18	logger = logging.getLogger(__name__)
    19	
    20	if TYPE_CHECKING:
    21	    from app.models.tables import User
    22	
    23	
    24	def sanitize_filename(name: str, max_length: int = 200) -> str:
    25	    """Sanitize filename to prevent path traversal and special character issues."""
    26	    name = unicodedata.normalize("NFC", name)
    27	    name = os.path.basename(name)
    28	    name = re.sub(r'[\x00-\x1f\x7f]', '', name)
    29	    name = re.sub(r'[<>:"|?*\\]', '_', name)
    30	    # Block double extensions like .pdf.exe
    31	    parts = name.rsplit('.', 1)
    32	    if len(parts) == 2:
    33	        base = parts[0].replace('.', '_')
    34	        name = f"{base}.{parts[1]}"
    35	    if len(name) > max_length:
    36	        base, ext = os.path.splitext(name)
    37	        name = base[:max_length - len(ext)] + ext
    38	    return name or "document"
    39	
    40	
    41	def can_access_document(doc: Optional[Document], user: Optional["User"]) -> bool:
    42	    """Only demo documents are public; all other documents require ownership."""
    43	    if doc is None:
    44	        return False
    45	    if doc.demo_slug is not None:
    46	        return True
    47	    return user is not None and doc.user_id == user.id
    48	
    49	
    50	class DocService:
    51	    """Document lifecycle service."""
    52	
    53	    async def create_document(
    54	        self, upload, db: AsyncSession, user_id: Optional[uuid.UUID] = None,
    55	        file_type: str = "pdf",
    56	        locale: Optional[str] = None,
    57	    ) -> uuid.UUID:
    58	        """Save uploaded document to object storage, create DB record, dispatch parse.
    59	
    60	        This method accepts an UploadFile-like object with attributes:
    61	        - filename: str
    62	        - content_type: str
    63	        - read(): async -> bytes
    64	        """
    65	        raw_filename: str = getattr(upload, "filename", "document.pdf") or "document.pdf"
    66	        filename = sanitize_filename(raw_filename)
    67	        content_type: str = getattr(upload, "content_type", "application/pdf") or "application/pdf"
    68	
    69	        data: bytes = await upload.read()
    70	
    71	        # Persist to object storage under namespaced key
    72	        doc_id = uuid.uuid4()
    73	        storage_key = f"documents/{doc_id}/{os.path.basename(filename)}"
    74	
    75	        # Use appropriate content type for storage
    76	        mime_types = {
    77	            'pdf': 'application/pdf',
    78	            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    79	            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    80	            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    81	            'txt': 'text/plain',
    82	            'md': 'text/markdown',
    83	        }
    84	        storage_content_type = mime_types.get(file_type, content_type)
    85	        await asyncio.to_thread(storage_service.upload_file, data, storage_key, storage_content_type)
    86	
    87	        # Create document row (status=parsing)
    88	        doc = Document(
    89	            id=doc_id,
    90	            filename=filename,
    91	            file_size=len(data),
    92	            storage_key=storage_key,
    93	            status="parsing",
    94	            user_id=user_id,  # Associate with user if authenticated
    95	            file_type=file_type,
    96	        )
    97	        db.add(doc)
    98	        await db.commit()
    99	
   100	        # Dispatch parse worker (ignore failures in local dev)
   101	        try:
   102	            from app.workers.parse_worker import parse_document
   103	
   104	            parse_document.delay(str(doc.id), locale=locale)
   105	        except Exception:
   106	            pass
   107	
   108	        return doc_id
   109	
   110	    async def get_document(self, document_id: uuid.UUID, db: AsyncSession) -> Optional[Document]:
   111	        res = await db.execute(select(Document).where(Document.id == document_id))
   112	        doc = res.scalar_one_or_none()
   113	        return doc
   114	
   115	    async def delete_document(self, document_id: uuid.UUID, db: AsyncSession) -> bool:
   116	        """Delete document and all related data via ORM cascade.
   117	
   118	        Pages, chunks, sessions, and messages are cascade-deleted by SQLAlchemy.
   119	        Storage and vector cleanup is best-effort.
   120	        """
   121	        from sqlalchemy.orm import selectinload
   122	
   123	        res = await db.execute(
   124	            select(Document)
   125	            .options(selectinload(Document.chunks))
   126	            .where(Document.id == document_id)
   127	        )
   128	        doc = res.scalar_one_or_none()
   129	        if not doc:
   130	            return False
   131	
   132	        original_storage_ok = True
   133	        converted_storage_ok = True
   134	        qdrant_ok = True
   135	        storage_key = doc.storage_key
   136	        converted_key = doc.converted_storage_key
   137	
   138	        # Best-effort: clean up object storage (sync call, run off event loop)
   139	        try:
   140	            await asyncio.to_thread(storage_service.delete_file, storage_key)
   141	        except Exception as e:
   142	            original_storage_ok = False
   143	            logger.error("MinIO deletion failed for doc %s: %s", document_id, e)
   144	
   145	        # Best-effort: clean up converted PDF if it exists
   146	        if converted_key:
   147	            try:
   148	                await asyncio.to_thread(storage_service.delete_file, converted_key)
   149	            except Exception as e:
   150	                converted_storage_ok = False
   151	                logger.error("MinIO deletion of converted PDF failed for doc %s: %s", document_id, e)
   152	
   153	        # Best-effort: clean up Qdrant vectors (sync call, run off event loop)
   154	        try:
   155	            from qdrant_client.models import FieldCondition, Filter, MatchValue
   156	
   157	            from app.core.config import settings as _settings
   158	            from app.services.embedding_service import embedding_service
   159	
   160	            qclient = embedding_service.get_qdrant_client()
   161	            await asyncio.to_thread(
   162	                qclient.delete,
   163	                collection_name=_settings.QDRANT_COLLECTION,
   164	                points_selector=Filter(
   165	                    must=[FieldCondition(key="document_id", match=MatchValue(value=str(document_id)))]
   166	                ),
   167	            )
   168	        except Exception as e:
   169	            qdrant_ok = False
   170	            logger.error("Qdrant deletion failed for doc %s: %s", document_id, e)
   171	
   172	        # ORM cascade deletes pages, chunks, sessions, messages
   173	        await db.delete(doc)
   174	        await db.commit()
   175	
   176	        log_security_event(
   177	            "document_deleted", document_id=document_id, user_id=doc.user_id,
   178	            storage_cleaned=original_storage_ok and converted_storage_ok,
   179	            original_storage_cleaned=original_storage_ok,
   180	            converted_storage_cleaned=converted_storage_ok,

exec
/bin/zsh -lc "nl -ba frontend/src/i18n/server.ts | sed -n '1,160p'; printf '\\nHEADER KEYS\\n'; nl -ba frontend/src/components/marketing/EditorialHeaderBase.tsx | sed -n '1,330p'; printf '\\nFOOTER KEYS\\n'; nl -ba frontend/src/components/landing/EditorialFooter.tsx | sed -n '1,340p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	/**
     2	 * Server-side translation resolver — the SEO counterpart to the client
     3	 * `LocaleProvider`. Server components call `getServerT(locale)` so the INITIAL
     4	 * server-rendered HTML for a locale URL (`/de/...`) already contains the
     5	 * translated text, making it indexable by crawlers that don't run JS.
     6	 *
     7	 * Only imported by server components. Mirrors the client API: same
     8	 * `applyParams` placeholder substitution and the same en-fallback for any
     9	 * missing key. Under SSG the locale JSON is loaded at build time, so the
    10	 * payload is static HTML and the 400KB+ JSON never ships to the client.
    11	 */
    12	import en from './locales/en.json';
    13	
    14	type Messages = Record<string, string>;
    15	
    16	// Loaders for the locales that have server-rendered URLs (URL_LOCALES).
    17	const loaders: Record<string, () => Promise<{ default: Messages }>> = {
    18	  zh: () => import('./locales/zh.json'),
    19	  ja: () => import('./locales/ja.json'),
    20	  es: () => import('./locales/es.json'),
    21	  ko: () => import('./locales/ko.json'),
    22	  de: () => import('./locales/de.json'),
    23	  fr: () => import('./locales/fr.json'),
    24	  pt: () => import('./locales/pt.json'),
    25	  it: () => import('./locales/it.json'),
    26	  ar: () => import('./locales/ar.json'),
    27	  hi: () => import('./locales/hi.json'),
    28	};
    29	
    30	function applyParams(str: string, params?: Record<string, string | number>): string {
    31	  if (!params) return str;
    32	  let out = str;
    33	  Object.entries(params).forEach(([k, v]) => {
    34	    out = out.replace(`{${k}}`, String(v));
    35	  });
    36	  return out;
    37	}
    38	
    39	export interface ServerTranslator {
    40	  locale: string;
    41	  t: (key: string, params?: Record<string, string | number>) => string;
    42	  tOr: (key: string, fallback: string, params?: Record<string, string | number>) => string;
    43	}
    44	
    45	/**
    46	 * Resolve a locale's messages limited to the given key prefixes. Used to seed a
    47	 * client LocaleProvider for a localized server page (e.g. the landing) with just
    48	 * the namespaces that page's tree uses — translated SSR without shipping the full
    49	 * 400KB locale JSON. Falls back to English for the locale's missing keys.
    50	 */
    51	export async function getScopedMessages(
    52	  locale: string,
    53	  prefixes: readonly string[],
    54	): Promise<Record<string, string>> {
    55	  const enMessages = en as Messages;
    56	  let messages: Messages = enMessages;
    57	  if (locale !== 'en' && loaders[locale]) {
    58	    try {
    59	      messages = (await loaders[locale]()).default;
    60	    } catch {
    61	      messages = enMessages;
    62	    }
    63	  }
    64	  const out: Record<string, string> = {};
    65	  for (const key of Object.keys(enMessages)) {
    66	    if (prefixes.some((p) => key.startsWith(p))) {
    67	      out[key] = messages[key] ?? enMessages[key];
    68	    }
    69	  }
    70	  return out;
    71	}
    72	
    73	export async function getServerT(locale: string): Promise<ServerTranslator> {
    74	  const enMessages = en as Messages;
    75	  let messages: Messages = enMessages;
    76	
    77	  if (locale !== 'en' && loaders[locale]) {
    78	    try {
    79	      messages = (await loaders[locale]()).default;
    80	    } catch {
    81	      messages = enMessages;
    82	    }
    83	  }
    84	
    85	  const resolve = (key: string): string | undefined => messages[key] ?? enMessages[key];
    86	
    87	  return {
    88	    locale,
    89	    t: (key, params) => applyParams(resolve(key) ?? key, params),
    90	    tOr: (key, fallback, params) => applyParams(resolve(key) ?? fallback, params),
    91	  };
    92	}

HEADER KEYS
     1	"use client";
     2	
     3	import { useState } from "react";
     4	import Link from "next/link";
     5	import { usePathname } from "next/navigation";
     6	import { Menu, X } from "lucide-react";
     7	import DocTalkLogo from "../DocTalkLogo";
     8	import EdLanguageSelector from "./EdLanguageSelector";
     9	import { useLocale } from "../../i18n";
    10	import { localizedHrefIfAvailable, splitLocaleFromPath } from "../../i18n/routing";
    11	import type { ChromeStrings } from "../../i18n/chrome";
    12	
    13	export interface Crumb {
    14	  label: string;
    15	  href?: string;
    16	}
    17	
    18	export interface EditorialHeaderBaseProps {
    19	  /** When true, render the two-line mono dateline block (landing variant). */
    20	  showDateline?: boolean;
    21	  /** Breadcrumb row rendered below the masthead (inner-page variant). */
    22	  breadcrumb?: Crumb[];
    23	  /** Server-resolved strings for localized pages; falls back to `useLocale()`. */
    24	  chrome?: ChromeStrings;
    25	}
    26	
    27	/**
    28	 * Shared editorial masthead used by both:
    29	 * - landing-page `EditorialHeader` (passes `showDateline`)
    30	 * - inner-page `EditorialMarketingHeader` (passes `breadcrumb`)
    31	 *
    32	 * Carries the sticky bar (logo + wordmark + nav links + sign-in CTA),
    33	 * the mobile hamburger button, and the mobile nav panel.
    34	 */
    35	export default function EditorialHeaderBase({
    36	  showDateline = false,
    37	  breadcrumb,
    38	  chrome,
    39	}: EditorialHeaderBaseProps) {
    40	  const { t, tOr } = useLocale();
    41	  const [mobileOpen, setMobileOpen] = useState(false);
    42	  // Derive the URL locale from the path so nav links stay in-language on
    43	  // localized pages (`/de/...`). Targets not yet localized fall back to English.
    44	  const { locale: urlLocale } = splitLocaleFromPath(usePathname() || "/");
    45	  const navHref = (path: string) => localizedHrefIfAvailable(urlLocale, path);
    46	  // Prefer server-resolved chrome strings (correct language in initial HTML on
    47	  // localized pages); otherwise the client-locale text.
    48	  const labels = {
    49	    features: chrome?.navFeatures ?? t("public.nav.features"),
    50	    pricing: chrome?.navPricing ?? t("footer.pricing"),
    51	    trust: chrome?.navTrust ?? tOr("footer.links.trust", "Security"),
    52	    signIn: chrome?.signIn ?? t("auth.signIn"),
    53	  };
    54	  const NAV_LINKS = [
    55	    { href: navHref("/features"), label: labels.features },
    56	    { href: navHref("/pricing"), label: labels.pricing },
    57	    { href: navHref("/trust"), label: labels.trust },
    58	  ];
    59	
    60	  return (
    61	    <>
    62	      <header
    63	        className="sticky top-0 z-50 h-16 flex items-center"
    64	        style={{
    65	          background: "var(--ed-paper)",
    66	          borderBottom: "1px solid var(--ed-rule)",
    67	        }}
    68	      >
    69	        <div className="ed-shell w-full">
    70	          <div className="flex items-center justify-between h-16">
    71	            {/* Left — logo + wordmark (+ optional dateline) */}
    72	            <Link
    73	              href={navHref("/")}
    74	              className="flex items-center gap-3 shrink-0"
    75	              aria-label={t('header.aria.home')}
    76	            >
    77	              <DocTalkLogo size={24} />
    78	              <span
    79	                style={{
    80	                  fontFamily: "var(--dt-serif)",
    81	                  fontSize: "19px",
    82	                  fontWeight: 500,
    83	                  color: "var(--ed-ink)",
    84	                  lineHeight: 1,
    85	                }}
    86	              >
    87	                DocTalk
    88	              </span>
    89	              {showDateline && (
    90	                <>
    91	                  {/* Thin vertical hairline separator */}
    92	                  <span
    93	                    aria-hidden="true"
    94	                    style={{
    95	                      display: "inline-block",
    96	                      width: "1px",
    97	                      height: "28px",
    98	                      background: "var(--ed-rule)",
    99	                      marginLeft: "4px",
   100	                      marginRight: "8px",
   101	                    }}
   102	                  />
   103	                  {/* Editorial dateline block — two mono lines */}
   104	                  <span
   105	                    className="hidden sm:flex"
   106	                    style={{ flexDirection: "column", gap: "2px" }}
   107	                  >
   108	                    <span
   109	                      className="ed-caption"
   110	                      style={{ letterSpacing: "0.10em" }}
   111	                    >
   112	                      STUDIO N&ordm;&thinsp;01
   113	                    </span>
   114	                    <span
   115	                      className="ed-caption"
   116	                      style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}
   117	                    >
   118	                      {t('landing.masthead.tagline')}
   119	                    </span>
   120	                  </span>
   121	                </>
   122	              )}
   123	            </Link>
   124	
   125	            {/* Right — nav links + CTA */}
   126	            <nav
   127	              className="flex items-center gap-6"
   128	              aria-label={t('header.aria.nav')}
   129	            >
   130	              {NAV_LINKS.map((item) => (
   131	                <Link
   132	                  key={item.href}
   133	                  href={item.href}
   134	                  className="hidden md:inline-block"
   135	                  style={{
   136	                    fontFamily: "var(--dt-body)",
   137	                    fontSize: "13px",
   138	                    color: "var(--ed-ink-2)",
   139	                    textDecoration: "none",
   140	                    transition: "color 150ms ease",
   141	                  }}
   142	                  onMouseEnter={(e) => {
   143	                    (e.currentTarget as HTMLAnchorElement).style.color =
   144	                      "var(--ed-signal)";
   145	                  }}
   146	                  onMouseLeave={(e) => {
   147	                    (e.currentTarget as HTMLAnchorElement).style.color =
   148	                      "var(--ed-ink-2)";
   149	                  }}
   150	                >
   151	                  {item.label}
   152	                </Link>
   153	              ))}
   154	              {/* Language selector — always visible so locale is switchable on
   155	                  every editorial page (restores the switcher the redesign dropped). */}
   156	              <EdLanguageSelector languageLabel={chrome?.language} />
   157	              {/* Mobile hamburger — sits left of the Sign-In CTA, md:hidden */}
   158	              <button
   159	                type="button"
   160	                onClick={() => setMobileOpen((open) => !open)}
   161	                className="md:hidden inline-flex items-center justify-center"
   162	                style={{
   163	                  width: "36px",
   164	                  height: "36px",
   165	                  background: "transparent",
   166	                  border: "none",
   167	                  padding: 0,
   168	                  cursor: "pointer",
   169	                }}
   170	                aria-expanded={mobileOpen}
   171	                aria-controls="ed-mobile-nav"
   172	                aria-label={mobileOpen ? t('header.aria.closeMenu') : t('header.aria.openMenu')}
   173	              >
   174	                {mobileOpen ? (
   175	                  <X aria-hidden="true" size={20} color="var(--ed-ink-2)" />
   176	                ) : (
   177	                  <Menu aria-hidden="true" size={20} color="var(--ed-ink-2)" />
   178	                )}
   179	              </button>
   180	              <Link
   181	                href="/auth"
   182	                className="ed-cta"
   183	                style={{ padding: "9px 18px", fontSize: "13px" }}
   184	              >
   185	                {labels.signIn}
   186	              </Link>
   187	            </nav>
   188	          </div>
   189	        </div>
   190	      </header>
   191	
   192	      {/* Mobile nav panel — sits below the masthead, not sticky */}
   193	      {mobileOpen && (
   194	        <nav
   195	          id="ed-mobile-nav"
   196	          role="navigation"
   197	          aria-label={t('header.aria.mobileNav')}
   198	          className="md:hidden"
   199	          style={{
   200	            background: "var(--ed-paper)",
   201	            borderBottom: "1px solid var(--ed-rule)",
   202	          }}
   203	        >
   204	          {NAV_LINKS.map((item, idx) => (
   205	            <Link
   206	              key={item.href}
   207	              href={item.href}
   208	              onClick={() => setMobileOpen(false)}
   209	              className="block"
   210	              style={{
   211	                padding: "12px 24px",
   212	                fontFamily: "var(--dt-mono)",
   213	                fontSize: "12px",
   214	                textTransform: "uppercase",
   215	                letterSpacing: "0.10em",
   216	                color: "var(--ed-ink-2)",
   217	                textDecoration: "none",
   218	                borderTop: idx === 0 ? "none" : "1px solid var(--ed-rule)",
   219	              }}
   220	            >
   221	              {item.label}
   222	            </Link>
   223	          ))}
   224	        </nav>
   225	      )}
   226	
   227	      {/* Breadcrumb row — not sticky, sits below the masthead */}
   228	      {breadcrumb && breadcrumb.length > 0 && (
   229	        <nav
   230	          aria-label={t('header.aria.breadcrumb')}
   231	          style={{ borderBottom: "1px solid var(--ed-rule)" }}
   232	        >
   233	          <div className="ed-shell">
   234	            <ol
   235	              className="flex items-center gap-2"
   236	              style={{ listStyle: "none", margin: 0, padding: "12px 0" }}
   237	            >
   238	              {breadcrumb.map((crumb, index) => {
   239	                const isLast = index === breadcrumb.length - 1;
   240	                return (
   241	                  <li key={crumb.label} className="flex items-center gap-2">
   242	                    {index > 0 && (
   243	                      <span className="ed-caption" aria-hidden="true">
   244	                        /
   245	                      </span>
   246	                    )}
   247	                    {crumb.href && !isLast ? (
   248	                      <Link href={crumb.href} className="ed-crumb">
   249	                        {crumb.label}
   250	                      </Link>
   251	                    ) : (
   252	                      <span
   253	                        className="ed-crumb"
   254	                        style={{ color: "var(--ed-ink)" }}
   255	                        aria-current="page"
   256	                      >
   257	                        {crumb.label}
   258	                      </span>
   259	                    )}
   260	                  </li>
   261	                );
   262	              })}
   263	            </ol>
   264	          </div>
   265	        </nav>
   266	      )}
   267	    </>
   268	  );
   269	}

FOOTER KEYS
     1	"use client";
     2	
     3	import Link from "next/link";
     4	import { usePathname } from "next/navigation";
     5	import DocTalkLogo from "../DocTalkLogo";
     6	import { useLocale } from "../../i18n";
     7	import { localizedHrefIfAvailable, splitLocaleFromPath } from "../../i18n/routing";
     8	import type { ChromeStrings } from "../../i18n/chrome";
     9	
    10	export default function EditorialFooter({ chrome }: { chrome?: ChromeStrings }) {
    11	  const { t, tOr } = useLocale();
    12	  // Keep footer links in-language on localized pages; targets not yet localized
    13	  // resolve to their English URL (no 404s).
    14	  const { locale: urlLocale } = splitLocaleFromPath(usePathname() || "/");
    15	  const lh = (path: string) => localizedHrefIfAvailable(urlLocale, path);
    16	  // Prefer server-resolved strings (correct language in initial HTML on
    17	  // localized pages); otherwise client-locale text.
    18	  const f = chrome?.footer;
    19	  const L = {
    20	    product: f?.product ?? t("footer.product"),
    21	    useCases: f?.useCases ?? t("footer.useCases"),
    22	    resources: f?.resources ?? t("footer.resources"),
    23	    company: f?.company ?? t("footer.company"),
    24	    demo: f?.demo ?? t("footer.demo"),
    25	    pricing: f?.pricing ?? t("footer.pricing"),
    26	    features: f?.features ?? t("footer.links.features"),
    27	    noSignupDemo: f?.noSignupDemo ?? t("footer.links.noSignupDemo"),
    28	    citationHighlighting: f?.citationHighlighting ?? t("footer.links.citationHighlighting"),
    29	    performanceModes: f?.performanceModes ?? t("footer.links.performanceModes"),
    30	    useCasesLink: f?.useCasesLink ?? t("footer.links.useCases"),
    31	    students: f?.students ?? t("footer.links.students"),
    32	    lawyers: f?.lawyers ?? t("footer.links.lawyers"),
    33	    finance: f?.finance ?? t("footer.links.finance"),
    34	    hrContracts: f?.hrContracts ?? t("footer.links.hrContracts"),
    35	    compareTools: f?.compareTools ?? t("footer.links.compareTools"),
    36	    alternatives: f?.alternatives ?? t("footer.links.alternatives"),
    37	    blog: f?.blog ?? t("footer.links.blog"),
    38	    comparisonGuides: f?.comparisonGuides ?? t("footer.links.comparisonGuides"),
    39	    multiFormatSupport: f?.multiFormatSupport ?? t("footer.links.multiFormatSupport"),
    40	    about: f?.about ?? t("footer.links.about"),
    41	    contact: f?.contact ?? t("footer.contact"),
    42	    trust: f?.trust ?? t("footer.links.trust"),
    43	    imprint: f?.imprint ?? tOr("footer.imprint", "Imprint"),
    44	    privacy: f?.privacy ?? t("privacy.policyLink"),
    45	    terms: f?.terms ?? t("terms.title"),
    46	    doNotSell: f?.doNotSell ?? t("footer.doNotSell"),
    47	    tagline: f?.tagline ?? tOr("footer.tagline", "AI document intelligence. Cite exactly."),
    48	  };
    49	
    50	  const productLinks = [
    51	    { href: lh("/demo"), label: L.demo },
    52	    { href: lh("/pricing"), label: L.pricing },
    53	    { href: lh("/features"), label: L.features },
    54	    { href: lh("/features/free-demo"), label: L.noSignupDemo },
    55	    { href: lh("/features/citations"), label: L.citationHighlighting },
    56	    { href: lh("/features/performance-modes"), label: L.performanceModes },
    57	  ];
    58	
    59	  const useCaseLinks = [
    60	    { href: lh("/use-cases"), label: L.useCasesLink },
    61	    { href: lh("/use-cases/students"), label: L.students },
    62	    { href: lh("/use-cases/lawyers"), label: L.lawyers },
    63	    { href: lh("/use-cases/finance"), label: L.finance },
    64	    { href: lh("/use-cases/hr-contracts"), label: L.hrContracts },
    65	  ];
    66	
    67	  const resourceLinks = [
    68	    { href: lh("/compare"), label: L.compareTools },
    69	    { href: lh("/alternatives"), label: L.alternatives },
    70	    { href: lh("/blog"), label: L.blog },
    71	    { href: lh("/blog/category/comparisons"), label: L.comparisonGuides },
    72	    { href: lh("/features/multi-format"), label: L.multiFormatSupport },
    73	  ];
    74	
    75	  const companyLinks = [
    76	    { href: lh("/about"), label: L.about },
    77	    { href: lh("/contact"), label: L.contact },
    78	    { href: lh("/trust"), label: L.trust },
    79	    { href: lh("/imprint"), label: L.imprint },
    80	  ];
    81	
    82	  const legalLinks = [
    83	    { href: lh("/privacy"), label: L.privacy },
    84	    { href: lh("/terms"), label: L.terms },
    85	    { href: lh("/privacy#ccpa"), label: L.doNotSell },
    86	  ];
    87	
    88	  const linkStyle: React.CSSProperties = {
    89	    fontFamily: "var(--dt-body)",
    90	    fontSize: "13px",
    91	    color: "var(--ed-ink-2)",
    92	    textDecoration: "none",
    93	    lineHeight: 1.5,
    94	    transition: "color 150ms ease",
    95	  };
    96	
    97	  function FooterLinkGroup({
    98	    heading,
    99	    links,
   100	  }: {
   101	    heading: string;
   102	    links: { href: string; label: string }[];
   103	  }) {
   104	    return (
   105	      <div>
   106	        <div className="ed-label mb-4">{heading}</div>
   107	        <ul className="space-y-3">
   108	          {links.map((item) => (
   109	            <li key={item.href}>
   110	              <Link
   111	                href={item.href}
   112	                style={linkStyle}
   113	                onMouseEnter={(e) => {
   114	                  (e.currentTarget as HTMLAnchorElement).style.color =
   115	                    "var(--ed-signal)";
   116	                }}
   117	                onMouseLeave={(e) => {
   118	                  (e.currentTarget as HTMLAnchorElement).style.color =
   119	                    "var(--ed-ink-2)";
   120	                }}
   121	              >
   122	                {item.label}
   123	              </Link>
   124	            </li>
   125	          ))}
   126	        </ul>
   127	      </div>
   128	    );
   129	  }
   130	
   131	  return (
   132	    <footer
   133	      style={{
   134	        background: "var(--ed-paper)",
   135	        borderTop: "1px solid var(--ed-rule)",
   136	      }}
   137	    >
   138	      <div className="ed-shell py-16">
   139	        {/* Top area — brand + link columns */}
   140	        <div className="grid grid-cols-1 md:grid-cols-5 gap-10 md:gap-8">
   141	          {/* Brand column */}
   142	          <div className="md:col-span-1">
   143	            <Link
   144	              href={lh("/")}
   145	              className="inline-flex items-center gap-2.5 mb-4"
   146	              style={{ textDecoration: "none" }}
   147	              aria-label={t('header.aria.home')}
   148	            >
   149	              <DocTalkLogo size={22} />
   150	              <span
   151	                style={{
   152	                  fontFamily: "var(--dt-serif)",
   153	                  fontSize: "18px",
   154	                  fontWeight: 500,
   155	                  color: "var(--ed-ink)",
   156	                  lineHeight: 1,
   157	                }}
   158	              >
   159	                DocTalk
   160	              </span>
   161	            </Link>
   162	            <p className="ed-caption" style={{ maxWidth: "180px", lineHeight: 1.6 }}>
   163	              {L.tagline}
   164	            </p>
   165	          </div>
   166	
   167	          {/* Link columns */}
   168	          <div className="md:col-span-4 grid grid-cols-2 sm:grid-cols-4 gap-8">
   169	            <FooterLinkGroup heading={L.product} links={productLinks} />
   170	            <FooterLinkGroup heading={L.useCases} links={useCaseLinks} />
   171	            <FooterLinkGroup heading={L.resources} links={resourceLinks} />
   172	            <FooterLinkGroup heading={L.company} links={companyLinks} />
   173	          </div>
   174	        </div>
   175	
   176	        {/* Bottom fine-print row */}
   177	        <hr className="ed-rule mt-10 mb-6" />
   178	        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
   179	          <span className="ed-caption">
   180	            &copy; MMXXVI DocTalk
   181	          </span>
   182	          <div className="flex items-center gap-5 flex-wrap">
   183	            {legalLinks.map((item) => (
   184	              <Link
   185	                key={item.href}
   186	                href={item.href}
   187	                className="ed-caption"
   188	                style={{
   189	                  textDecoration: "none",
   190	                  transition: "color 150ms ease",
   191	                }}
   192	                onMouseEnter={(e) => {
   193	                  (e.currentTarget as HTMLAnchorElement).style.color =
   194	                    "var(--ed-signal)";
   195	                }}
   196	                onMouseLeave={(e) => {
   197	                  (e.currentTarget as HTMLAnchorElement).style.color =
   198	                    "var(--ed-ink-3)";
   199	                }}
   200	              >
   201	                {item.label}
   202	              </Link>
   203	            ))}
   204	          </div>
   205	        </div>
   206	      </div>
   207	    </footer>
   208	  );
   209	}

exec
/bin/zsh -lc "nl -ba frontend/src/lib/usePageTitle.ts | sed -n '1,120p'; printf '\\nOTHER LOCALIZED BREADCRUMBS\\n'; rg -n \"breadcrumb=|breadcrumb:\\s*\\[|useCasesHub\\.breadcrumb\\.home\" frontend/src/app frontend/src/components -g '*.{ts,tsx}' | head -n 300" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	import { useEffect } from "react";
     2	
     3	export function usePageTitle(title?: string) {
     4	  useEffect(() => {
     5	    document.title = title ? `${title} — DocTalk` : "DocTalk";
     6	    return () => {
     7	      document.title = "DocTalk";
     8	    };
     9	  }, [title]);
    10	}

OTHER LOCALIZED BREADCRUMBS
frontend/src/app/imprint/ImprintPageClient.tsx:38:      breadcrumb={[
frontend/src/app/imprint/ImprintPageClient.tsx:39:        { label: t('useCasesHub.breadcrumb.home'), href: '/' },
frontend/src/app/pricing/PricingPageContent.tsx:186:      breadcrumb={[
frontend/src/app/pricing/PricingPageContent.tsx:187:        { label: t('useCasesHub.breadcrumb.home'), href: href('/') },
frontend/src/app/document-diff/page.tsx:28:      breadcrumb={[
frontend/src/app/alternatives/notebooklm/NotebooklmAltsContent.tsx:58:      breadcrumb={[
frontend/src/app/alternatives/humata/HumataAltsContent.tsx:57:      breadcrumb={[
frontend/src/app/about/AboutPageClient.tsx:16:      breadcrumb={[
frontend/src/app/about/AboutPageClient.tsx:17:        { label: t('useCasesHub.breadcrumb.home'), href: '/' },
frontend/src/app/about/AboutPageClient.tsx:100:        primary={{ label: t('useCasesHub.breadcrumb.home'), href: '/' }}
frontend/src/app/alternatives/AlternativesHubContent.tsx:55:      breadcrumb={[
frontend/src/app/alternatives/AlternativesHubContent.tsx:56:        { label: t('useCasesHub.breadcrumb.home'), href: href('/') },
frontend/src/app/compare/humata/HumataContent.tsx:57:      breadcrumb={[
frontend/src/app/alternatives/pdf-ai/PdfAiAltsContent.tsx:68:      breadcrumb={[
frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsContent.tsx:68:      breadcrumb={[
frontend/src/components/marketing/EditorialMarketingHeader.tsx:24:  return <EditorialHeaderBase breadcrumb={breadcrumb} chrome={chrome} />;
frontend/src/app/privacy/PrivacyPageClient.tsx:16:      breadcrumb={[
frontend/src/app/privacy/PrivacyPageClient.tsx:17:        { label: t('useCasesHub.breadcrumb.home'), href: '/' },
frontend/src/components/marketing/MarketingShell.tsx:24:      <EditorialMarketingHeader breadcrumb={breadcrumb} chrome={chrome} />
frontend/src/app/alternatives/chatpdf/ChatpdfAltsContent.tsx:68:      breadcrumb={[
frontend/src/app/use-cases/finance/FinanceContent.tsx:92:      breadcrumb={[
frontend/src/app/compare/pdf-ai/PdfaiContent.tsx:57:      breadcrumb={[
frontend/src/app/compare/chatpdf/ChatpdfContent.tsx:61:      breadcrumb={[
frontend/src/app/compare/CompareHubContent.tsx:50:      breadcrumb={[
frontend/src/app/compare/CompareHubContent.tsx:51:        { label: t('useCasesHub.breadcrumb.home'), href: href('/') },
frontend/src/app/compare/notebooklm/NotebooklmContent.tsx:61:      breadcrumb={[
frontend/src/app/compare/askyourpdf/AskyourpdfContent.tsx:57:      breadcrumb={[
frontend/src/app/trust/TrustPageContent.tsx:163:      breadcrumb={[
frontend/src/app/trust/TrustPageContent.tsx:164:        { label: t("useCasesHub.breadcrumb.home"), href: href("/") },
frontend/src/app/use-cases/hr-contracts/HrContractsContent.tsx:91:      breadcrumb={[
frontend/src/app/terms/TermsPageClient.tsx:31:      breadcrumb={[
frontend/src/app/terms/TermsPageClient.tsx:32:        { label: t('useCasesHub.breadcrumb.home'), href: '/' },
frontend/src/app/tools/word-counter/WordCounterClient.tsx:133:      breadcrumb={[
frontend/src/app/tools/ToolsHubContent.tsx:47:      breadcrumb={[
frontend/src/app/contact/ContactPageClient.tsx:73:      breadcrumb={[
frontend/src/app/use-cases/consultants/ConsultantsContent.tsx:121:      breadcrumb={[
frontend/src/app/features/free-demo/FreeDemoContent.tsx:125:      breadcrumb={[
frontend/src/app/features/free-demo/FreeDemoContent.tsx:126:        { label: t('useCasesHub.breadcrumb.home'), href: href('/') },
frontend/src/app/tools/reading-time/ReadingTimeClient.tsx:136:      breadcrumb={[
frontend/src/app/features/FeaturesHubContent.tsx:69:      breadcrumb={[
frontend/src/app/features/FeaturesHubContent.tsx:70:        { label: t('useCasesHub.breadcrumb.home'), href: href('/') },
frontend/src/app/demo/DemoPageClient.tsx:72:      breadcrumb={[
frontend/src/app/demo/DemoPageClient.tsx:73:        { label: t('useCasesHub.breadcrumb.home'), href: '/' },
frontend/src/app/use-cases/students/StudentsContent.tsx:114:      breadcrumb={[
frontend/src/app/features/citations/CitationsContent.tsx:130:      breadcrumb={[
frontend/src/app/features/citations/CitationsContent.tsx:131:        { label: t('useCasesHub.breadcrumb.home'), href: href('/') },
frontend/src/app/use-cases/compliance/ComplianceContent.tsx:137:      breadcrumb={[
frontend/src/app/features/multi-format/MultiFormatContent.tsx:134:      breadcrumb={[
frontend/src/app/features/multi-format/MultiFormatContent.tsx:135:        { label: t('useCasesHub.breadcrumb.home'), href: href('/') },
frontend/src/app/features/performance-modes/PerformanceModesContent.tsx:79:      breadcrumb={[
frontend/src/app/features/performance-modes/PerformanceModesContent.tsx:80:        { label: t('useCasesHub.breadcrumb.home'), href: href('/') },
frontend/src/app/features/multilingual/MultilingualContent.tsx:98:      breadcrumb={[
frontend/src/app/features/multilingual/MultilingualContent.tsx:99:        { label: t('useCasesHub.breadcrumb.home'), href: href('/') },
frontend/src/app/blog/BlogIndexClient.tsx:50:      breadcrumb={[
frontend/src/app/use-cases/real-estate/RealEstateContent.tsx:136:      breadcrumb={[
frontend/src/app/features/layout-translation/LayoutTranslationPageContent.tsx:35:      breadcrumb={[
frontend/src/app/features/layout-translation/LayoutTranslationPageContent.tsx:36:        { label: t('useCasesHub.breadcrumb.home'), href: href('/') },
frontend/src/app/use-cases/teachers/TeachersContent.tsx:127:      breadcrumb={[
frontend/src/app/blog/[slug]/BlogPostClient.tsx:214:      breadcrumb={[
frontend/src/app/use-cases/lawyers/LawyersContent.tsx:88:      breadcrumb={[
frontend/src/app/blog/category/[category]/CategoryClient.tsx:69:      breadcrumb={[
frontend/src/app/use-cases/UseCasesHubContent.tsx:43:      breadcrumb={[
frontend/src/app/use-cases/UseCasesHubContent.tsx:44:        { label: t('useCasesHub.breadcrumb.home'), href: href('/') },
frontend/src/app/use-cases/healthcare/HealthcareContent.tsx:113:      breadcrumb={[

exec
/bin/zsh -lc "nl -ba frontend/src/components/marketing/EdLanguageSelector.tsx | sed -n '1,280p'; rg -n \"t\\(|tOr\\(\" frontend/src/components/marketing/EdLanguageSelector.tsx frontend/src/components/DocTalkLogo.tsx | head -n 100; python3 - <<'PY'
import re
paths=['frontend/src/app/demo/DemoPageClient.tsx','frontend/src/components/marketing/EditorialHeaderBase.tsx','frontend/src/components/marketing/EdLanguageSelector.tsx','frontend/src/components/landing/EditorialFooter.tsx']
prefixes=('demo.','footer.','useCasesHub.breadcrumb.','common.','public.','auth.','header.','landing.','privacy.','terms.')
for p in paths:
 s=open(p).read()
 ks=re.findall(r\"\\bt(?:Or)?\\(\\s*['\\\"](["'^'"'\\\"]+)\",s)
 print(p)
 for k in ks:
  print(' ', 'OK' if k.startswith(prefixes) else 'MISS', k)
PY" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	"use client";
     2	
     3	import { useCallback, useEffect, useRef, useState } from "react";
     4	import { createPortal } from "react-dom";
     5	import { usePathname } from "next/navigation";
     6	import { Globe, Check } from "lucide-react";
     7	import { LOCALES, useLocale } from "../../i18n";
     8	import {
     9	  MARKETING_LOCALES,
    10	  localizedHref,
    11	  splitLocaleFromPath,
    12	  isLocalizedPath,
    13	} from "../../i18n/routing";
    14	
    15	/**
    16	 * Editorial-styled language selector for the marketing surface.
    17	 *
    18	 * Two modes, decided per page:
    19	 * - **Localized page** (the path has server-rendered locale variants): the menu
    20	 *   renders real `<a href="/de/...">` anchors for every marketing locale. This is
    21	 *   what makes the alternate-language URLs *crawlable* — search engines follow
    22	 *   the links and discover each language version.
    23	 * - **English-only page** (not yet localized): falls back to the original
    24	 *   client-side `setLocale()` toggle across all `LOCALES`, so the in-app locale
    25	 *   switch still works everywhere.
    26	 *
    27	 * The menu is rendered through a portal to `document.body` with `position:
    28	 * fixed` so it escapes the sticky header's stacking context.
    29	 */
    30	export default function EdLanguageSelector({ languageLabel }: { languageLabel?: string }) {
    31	  const { locale, setLocale, tOr } = useLocale();
    32	  const pathname = usePathname() || "/";
    33	  const { locale: urlLocale, path: agnosticPath } = splitLocaleFromPath(pathname);
    34	  const localized = isLocalizedPath(agnosticPath);
    35	  // On server-localized marketing pages, the URL is the source of truth. The
    36	  // unprefixed variants are canonical English pages, so they should not display
    37	  // a stored client preference such as ZH while their body is English. The root
    38	  // landing page is still client-localized on `/`, so it keeps using provider
    39	  // locale until the user chooses a prefixed URL.
    40	  const activeLocale = localized && agnosticPath !== '/' ? urlLocale : locale;
    41	
    42	  const [open, setOpen] = useState(false);
    43	  const [pos, setPos] = useState({ top: 0, right: 0, maxHeight: 420 });
    44	  const wrapRef = useRef<HTMLDivElement>(null);
    45	  const triggerRef = useRef<HTMLButtonElement>(null);
    46	  const menuRef = useRef<HTMLDivElement>(null);
    47	
    48	  const updatePos = useCallback(() => {
    49	    if (!triggerRef.current) return;
    50	    const r = triggerRef.current.getBoundingClientRect();
    51	    const top = r.bottom + 10;
    52	    setPos({
    53	      top,
    54	      right: Math.max(12, window.innerWidth - r.right),
    55	      maxHeight: Math.max(180, Math.min(440, window.innerHeight - top - 16)),
    56	    });
    57	  }, []);
    58	
    59	  useEffect(() => {
    60	    function onDocClick(e: MouseEvent) {
    61	      if (wrapRef.current?.contains(e.target as Node)) return;
    62	      if (menuRef.current?.contains(e.target as Node)) return;
    63	      setOpen(false);
    64	    }
    65	    function onKey(e: KeyboardEvent) {
    66	      if (e.key === "Escape") setOpen(false);
    67	    }
    68	    document.addEventListener("mousedown", onDocClick);
    69	    document.addEventListener("keydown", onKey);
    70	    return () => {
    71	      document.removeEventListener("mousedown", onDocClick);
    72	      document.removeEventListener("keydown", onKey);
    73	    };
    74	  }, []);
    75	
    76	  useEffect(() => {
    77	    if (!open) return;
    78	    updatePos();
    79	    window.addEventListener("resize", updatePos);
    80	    window.addEventListener("scroll", updatePos, true);
    81	    return () => {
    82	      window.removeEventListener("resize", updatePos);
    83	      window.removeEventListener("scroll", updatePos, true);
    84	    };
    85	  }, [open, updatePos]);
    86	
    87	  const current = LOCALES.find((l) => l.code === activeLocale);
    88	  const label = languageLabel ?? tOr("header.language", "Language");
    89	
    90	  // Always offer all locales. On a localized path, every marketing locale
    91	  // renders as a real <a> link; on non-localized paths, the selector falls back
    92	  // to the client-side app locale toggle.
    93	  const options = LOCALES;
    94	  const isServed = (code: string) =>
    95	    localized && (MARKETING_LOCALES as readonly string[]).includes(code);
    96	
    97	  const optionStyle = (selected: boolean): React.CSSProperties => ({
    98	    fontFamily: "var(--dt-body)",
    99	    fontSize: "13px",
   100	    textAlign: "left",
   101	    color: selected ? "var(--ed-signal)" : "var(--ed-ink)",
   102	    background: "transparent",
   103	    border: "none",
   104	    padding: "8px 10px",
   105	    cursor: "pointer",
   106	    textDecoration: "none",
   107	    width: "100%",
   108	  });
   109	  const onEnter = (e: React.MouseEvent<HTMLElement>) => {
   110	    e.currentTarget.style.background = "var(--ed-paper-2)";
   111	  };
   112	  const onLeave = (e: React.MouseEvent<HTMLElement>) => {
   113	    e.currentTarget.style.background = "transparent";
   114	  };
   115	
   116	  const codeBadge = (code: string) => (
   117	    <span
   118	      style={{
   119	        fontFamily: "var(--dt-mono)",
   120	        fontSize: "10.5px",
   121	        letterSpacing: "0.06em",
   122	        color: "var(--ed-ink-3)",
   123	      }}
   124	    >
   125	      {code.toUpperCase()}
   126	    </span>
   127	  );
   128	
   129	  const menu = (
   130	    <div
   131	      ref={menuRef}
   132	      className="dt-editorial"
   133	      style={{
   134	        position: "fixed",
   135	        top: pos.top,
   136	        right: pos.right,
   137	        zIndex: 10000,
   138	        minWidth: "200px",
   139	        maxHeight: pos.maxHeight,
   140	        overflowY: "auto",
   141	        background: "var(--ed-paper)",
   142	        border: "1px solid var(--ed-rule)",
   143	        boxShadow: "0 14px 36px rgba(40, 33, 24, 0.20)",
   144	      }}
   145	    >
   146	      <ul role="listbox" aria-label={label} style={{ margin: 0, padding: "6px", listStyle: "none" }}>
   147	        {options.map((l) => {
   148	          const selected = l.code === activeLocale;
   149	          const inner = (
   150	            <>
   151	              <span aria-hidden="true" style={{ width: "14px", display: "inline-flex" }}>
   152	                {selected ? <Check size={13} /> : null}
   153	              </span>
   154	              <span style={{ flex: 1 }}>{l.label}</span>
   155	              {codeBadge(l.code)}
   156	            </>
   157	          );
   158	          return (
   159	            <li key={l.code} role="none">
   160	              {isServed(l.code) ? (
   161	                <a
   162	                  role="option"
   163	                  aria-selected={selected}
   164	                  href={localizedHref(l.code, agnosticPath)}
   165	                  hrefLang={l.code}
   166	                  onClick={() => {
   167	                    setLocale(l.code);
   168	                    setOpen(false);
   169	                  }}
   170	                  className="flex items-center gap-2"
   171	                  style={optionStyle(selected)}
   172	                  onMouseEnter={onEnter}
   173	                  onMouseLeave={onLeave}
   174	                >
   175	                  {inner}
   176	                </a>
   177	              ) : (
   178	                <button
   179	                  type="button"
   180	                  role="option"
   181	                  aria-selected={selected}
   182	                  onClick={() => {
   183	                    setLocale(l.code);
   184	                    setOpen(false);
   185	                  }}
   186	                  className="flex items-center gap-2"
   187	                  style={optionStyle(selected)}
   188	                  onMouseEnter={onEnter}
   189	                  onMouseLeave={onLeave}
   190	                >
   191	                  {inner}
   192	                </button>
   193	              )}
   194	            </li>
   195	          );
   196	        })}
   197	      </ul>
   198	    </div>
   199	  );
   200	
   201	  return (
   202	    <div ref={wrapRef} style={{ position: "relative" }}>
   203	      <button
   204	        ref={triggerRef}
   205	        type="button"
   206	        onClick={() => setOpen((v) => !v)}
   207	        aria-haspopup="listbox"
   208	        aria-expanded={open}
   209	        aria-label={`${(current?.code || "en").toUpperCase()} — ${label}`}
   210	        className="inline-flex items-center gap-1.5"
   211	        style={{
   212	          fontFamily: "var(--dt-mono)",
   213	          fontSize: "12px",
   214	          letterSpacing: "0.06em",
   215	          color: open ? "var(--ed-signal)" : "var(--ed-ink-2)",
   216	          background: "transparent",
   217	          border: "none",
   218	          padding: "4px 2px",
   219	          cursor: "pointer",
   220	          transition: "color 150ms ease",
   221	        }}
   222	        onMouseEnter={(e) => {
   223	          (e.currentTarget as HTMLButtonElement).style.color = "var(--ed-signal)";
   224	        }}
   225	        onMouseLeave={(e) => {
   226	          if (!open) (e.currentTarget as HTMLButtonElement).style.color = "var(--ed-ink-2)";
   227	        }}
   228	      >
   229	        <Globe aria-hidden="true" size={15} />
   230	        <span>{(current?.code || "en").toUpperCase()}</span>
   231	      </button>
   232	      {open && typeof document !== "undefined"
   233	        ? createPortal(menu, document.body)
   234	        : null}
   235	    </div>
   236	  );
   237	}
frontend/src/components/marketing/EdLanguageSelector.tsx:50:    const r = triggerRef.current.getBoundingClientRect();
frontend/src/components/marketing/EdLanguageSelector.tsx:59:  useEffect(() => {
frontend/src/components/marketing/EdLanguageSelector.tsx:76:  useEffect(() => {
frontend/src/components/marketing/EdLanguageSelector.tsx:88:  const label = languageLabel ?? tOr("header.language", "Language");
frontend/src/app/demo/DemoPageClient.tsx
  OK footer.demo
  OK useCasesHub.breadcrumb.home
  OK footer.demo
  OK demo.eyebrow
  OK demo.title
  OK demo.subtitle
  OK demo.freeMessages
  OK demo.citationPromise
  OK demo.flow.title
  OK demo.flow.step1
  OK demo.flow.step2
  OK demo.flow.step3
  OK demo.samplesLabel
  OK demo.loadError
  OK common.retry
  OK common.loading
  OK demo.processing
  OK demo.suggestedQuestion
  OK demo.ready
  OK demo.preparing
  OK demo.openSample
  OK demo.hint
frontend/src/components/marketing/EditorialHeaderBase.tsx
  OK public.nav.features
  OK footer.pricing
  OK footer.links.trust
  OK auth.signIn
  OK header.aria.home
  OK landing.masthead.tagline
  OK header.aria.nav
  OK header.aria.closeMenu
  OK header.aria.openMenu
  OK header.aria.mobileNav
  OK header.aria.breadcrumb
frontend/src/components/marketing/EdLanguageSelector.tsx
  OK header.language
frontend/src/components/landing/EditorialFooter.tsx
  OK footer.product
  OK footer.useCases
  OK footer.resources
  OK footer.company
  OK footer.demo
  OK footer.pricing
  OK footer.links.features
  OK footer.links.noSignupDemo
  OK footer.links.citationHighlighting
  OK footer.links.performanceModes
  OK footer.links.useCases
  OK footer.links.students
  OK footer.links.lawyers
  OK footer.links.finance
  OK footer.links.hrContracts
  OK footer.links.compareTools
  OK footer.links.alternatives
  OK footer.links.blog
  OK footer.links.comparisonGuides
  OK footer.links.multiFormatSupport
  OK footer.links.about
  OK footer.contact
  OK footer.links.trust
  OK footer.imprint
  OK privacy.policyLink
  OK terms.title
  OK footer.doNotSell
  OK footer.tagline
  OK header.aria.home

codex
I found a concrete release-blocking abuse path: the new 24-hour count runs only when the caller is anonymous, but its SQL counts authenticated demo sessions too. Because authenticated demo-session creation has neither the anonymous rate limiter nor the normal free-plan session cap, one free account can create 500 empty sessions and shut each public demo document for anonymous visitors for 24 hours. I’m finishing the frontend state-machine and accessibility pass now.
Backend tracing found a trivial authenticated denial-of-demo path plus secondary atomicity/index and cleanup-race concerns. Frontend auditing is now validating session transitions and the server-counter contract beyond the initial mount happy path.
  ✓ Read project rules, plan, internal review trail, and commit-range summary
  ✓ Audit backend demo metering, session limits, cleanup concurrency, and public events
  → Audit frontend session reuse, auth redirect, i18n, sharing, and class changes
  • Validate suspected issues against tests/history and write severity-ranked verdict
Independent tracing is complete. Suspected issues were checked against the actual caller graph, Redis TTL behavior, session dropdown transitions, schema/index definitions, Auth.js redirect defense, locale key coverage, and current utility classes. I’m now consolidating only reproducible findings into the requested severity-ranked report.
  ✓ Read project rules, plan, internal review trail, and commit-range summary
  ✓ Audit backend demo metering, session limits, cleanup concurrency, and public events
  ✓ Audit frontend session reuse, auth redirect, i18n, sharing, and class changes
  ✓ Validate suspected issues against tests/history and write severity-ranked verdict
codex
# Adversarial review — `40733b8..aaeb334`

## BLOCKER

### 1. Authenticated users can exhaust the anonymous demo-session cap

The rolling-window filter counts every session for the document, not only anonymous sessions: [backend/app/api/chat.py:61](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:61). Yet authenticated demo requests bypass both the normal free-plan cap, which excludes demo documents, and the anonymous rate limiter: [backend/app/api/chat.py:209](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:209), [backend/app/api/chat.py:226](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:226).

Consequently, one free authenticated account can POST 500 empty sessions against each public demo document without spending credits, after which every anonymous create receives `DEMO_SESSION_LIMIT_REACHED` for 24 hours: [backend/app/api/chat.py:240](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:240), [backend/app/api/chat.py:253](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:253). Cleanup deliberately excludes those authenticated rows, so they also accumulate permanently: [backend/app/workers/cleanup_tasks.py:63](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/workers/cleanup_tasks.py:63).

Must fix by adding `ChatSession.user_id.is_(None)` to the rolling filter. Authenticated demo-session creation should also receive a reasonable rate/session guard to close the underlying row-spam vector.

## IMPORTANT

### 2. The restored counter is not server truth after TTL expiry, IP changes, regeneration, or continuation

The server counter belongs to the current `(IP, document)` Redis key and expires 24 hours after its first increment: [backend/app/core/rate_limit.py:217](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/core/rate_limit.py:217). The frontend instead restores the entire historical transcript, subtracts every historical user message from the current server count, then adds every transcript user message back when calculating usage: [frontend/src/lib/useChatSession.ts:62](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/useChatSession.ts:62), [frontend/src/lib/useChatStream.ts:72](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/useChatStream.ts:72).

That arithmetic only works while all restored messages belong to the current Redis window and IP. For example, after the Redis key expires, `demo_messages_used` is zero but a restored five-question transcript still makes `demoLimitReached` true, blocking a request the backend would accept. Moving between Wi-Fi/mobile/VPN causes the same divergence.

It also undercounts quota-consuming actions that do not append a user message. Regeneration reuses the existing user message, while continuation adds none: [frontend/src/lib/useChatStream.ts:286](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/useChatStream.ts:286), [frontend/src/lib/useChatStream.ts:311](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/useChatStream.ts:311). Both backend endpoints increment the quota: [backend/app/api/chat.py:375](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:375), [backend/app/api/chat.py:483](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:483). Users therefore see stale remaining usage and receive an unexpected 429 later.

The counter needs an authoritative window-aware model—ideally server count/reset metadata plus explicit tracking or refresh after every quota-consuming request—not inference from the full transcript.

### 3. The stored-session pointer is neither transition-complete nor failure-safe

Only the initial `useChatSession` create path writes `dt-demo-session:*`: [frontend/src/lib/useChatSession.ts:103](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/useChatSession.ts:103). The ordinary “New Chat” and session-switch actions neither update that pointer nor recompute the counter contract: [frontend/src/components/SessionDropdown.tsx:58](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/SessionDropdown.tsx:58), [frontend/src/components/SessionDropdown.tsx:84](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/SessionDropdown.tsx:84).

After creating or selecting another chat, reload therefore restores the old session. Deleting the stored session can likewise leave surviving anonymous sessions unreachable because anonymous `listSessions` intentionally returns an empty list: [backend/app/api/chat.py:581](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:581).

Additionally, every `getMessages` failure—including a transient network error or 502/504—deletes the only pointer: [frontend/src/lib/useChatSession.ts:77](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/useChatSession.ts:77). Storage reads and writes themselves are unguarded against `SecurityError`/storage-disabled environments: [frontend/src/lib/useChatSession.ts:40](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/useChatSession.ts:40).

Use a shared storage helper across create/switch/delete, clear only on definitive 404/ownership failure, and handle unavailable storage without aborting session initialization.

### 4. Per-tab storage is not a user boundary on shared machines

A stored session is silently fetched and its full transcript rendered on revisit: [frontend/src/lib/useChatSession.ts:39](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/useChatSession.ts:39), [frontend/src/lib/useChatSession.ts:62](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/useChatSession.ts:62). Backend authorization for anonymous demo sessions only checks that the session itself is anonymous; it does not bind it to a guest token or client: [backend/app/api/chat.py:157](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:157).

A second anonymous person using the same still-open or restored tab receives the prior person’s questions and answers automatically. `sessionStorage` isolates tabs, not people. At minimum, require explicit “resume previous demo chat” consent and provide a prominent clear/reset action; stronger isolation requires an anonymous ownership token.

### 5. Anonymous “Share” is a knowingly non-completing action

The UI exposes controls titled “Share conversation” to anonymous users: [frontend/src/components/Chat/ChatPanel.tsx:646](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/Chat/ChatPanel.tsx:646). Their handler explicitly admits that it is “not a working share” and merely opens authentication: [frontend/src/components/Chat/ChatPanel.tsx:459](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/Chat/ChatPanel.tsx:459).

After authentication, the user cannot access the anonymous session because authenticated callers may only access their own demo sessions: [backend/app/api/chat.py:162](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:162). The stored key is cleared and a fresh session is loaded/created. Thus the action named “Share” cannot share the transcript before or after completing the requested signup.

I challenge the accepted tradeoff: session adoption need not block P0, but presenting a non-functional share control as a conversion hook is a broken promise. Either preserve/adopt the transcript or use explicit copy explaining that the current chat cannot be shared.

### 6. The rolling cap remains a non-atomic, increasingly expensive abuse guard

The cap executes a count and later inserts in a separate operation with no row/advisory lock: [backend/app/api/chat.py:240](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:240), [backend/app/api/chat.py:253](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:253). Concurrent creates can all observe 499 and exceed the advertised hard cap.

The only relevant index is on `document_id`, not `(document_id, created_at)` or an anonymous partial equivalent: [backend/alembic/versions/20260211_0015_add_missing_indexes.py:17](/Users/mayijie/Projects/Code/010_DocTalk/backend/alembic/versions/20260211_0015_add_missing_indexes.py:17). Because message-bearing demo sessions and authenticated sessions are retained indefinitely, every create increasingly scans historical rows for that demo document.

Add a partial composite index such as `(document_id, created_at) WHERE user_id IS NULL`; if 500 is intended as a hard availability boundary, serialize the check-and-insert per document.

## MINOR

### 7. Cleanup can race a resumed old empty session

Cleanup identifies sessions solely by age and absence of committed messages, then deletes them without coordinating with chat access: [backend/app/workers/cleanup_tasks.py:61](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/workers/cleanup_tasks.py:61). A user can successfully re-adopt an eight-day-old empty session, then have Beat delete it after access verification but before the first user-message commit: [backend/app/api/chat.py:330](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:330), [backend/app/services/chat_service.py:1108](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:1108). The message FK cascades on parent deletion: [backend/app/models/tables.py:237](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/models/tables.py:237).

Committed messages, authenticated sessions, and non-demo sessions are correctly protected; the issue is the narrow concurrent first-message window.

### 8. The new messages-response field is absent from the backend API schema

The endpoint returns `demo_messages_used` by manually returning `JSONResponse`: [backend/app/api/chat.py:309](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:309). But its declared `SessionMessagesResponse` contains only `messages`: [backend/app/schemas/chat.py:47](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/schemas/chat.py:47).

Runtime works because `JSONResponse` bypasses response-model serialization, but OpenAPI and generated clients advertise the wrong contract. Add the optional field to `SessionMessagesResponse` and return the typed model.

### 9. The callback override primitive can construct a cross-origin URL

`openAuthModal` accepts any string: [frontend/src/lib/auth-modal.ts:9](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/auth-modal.ts:9), and `AuthModal` concatenates it directly to the origin: [frontend/src/components/AuthModal.tsx:97](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/AuthModal.tsx:97). For example, `@evil.com/path` produces `https://www.doctalk.site@evil.com/path`, whose origin is `https://evil.com`.

There is no exploit through current call sites—the only override is the literal `/`, and Auth.js currently applies its own same-origin redirect validation. Nevertheless, the exported primitive is not footgun-proof. Resolve with `new URL(override, window.location.origin)` and reject any origin mismatch.

### 10. The progress bar’s accessible name still describes the opposite quantity

The visual width, `aria-valuenow`, and `aria-valuetext` now describe questions remaining, but `aria-label` remains “Messages used”: [frontend/src/components/Chat/ChatPanel.tsx:565](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/Chat/ChatPanel.tsx:565). Screen readers receive a contradictory name/value pair. Rename the accessible label to “Questions remaining.”

### 11. The localized demo breadcrumb drops users back to English

`DemoPageClient` hardcodes the Home breadcrumb href to `/`: [frontend/src/app/demo/DemoPageClient.tsx:71](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/demo/DemoPageClient.tsx:71). On `/de/demo`, `/fr/demo`, etc., the translated Home breadcrumb therefore leaves the locale URL instead of linking to `/de`, `/fr`, and so on. Use `localizedHrefIfAvailable(locale, '/')`, matching the other localized marketing pages.

## Cleared attack surfaces

- Both message-producing endpoints use the new document-scoped key; the fixed-width UUID suffix prevents delimiter ambiguity with IPv6 textual forms.
- The 24-hour SQL boundary uses database time and has the intended strict cutoff.
- Cleanup predicates correctly protect already-committed messages, authenticated sessions, and non-demo documents outside the concurrency window.
- The two public events inherit the existing 30/minute/IP limiter and bounded property sanitizer; their actual callers send only `valid` or no properties, so this batch adds no PII exposure.
- All 11 cap-copy translations are present, the seeded SSR prefix set covers the demo/header/footer render tree, and hreflang/sitemap wiring is consistent.
- I found no remaining invisible-on-white utility in the five swept files and no unaccepted dark-mode over-fix; the remaining UI issue is the progressbar semantic mismatch above.

Must-fix before re-review: the authenticated demo-cap DoS, authoritative counter model, complete/failure-safe storage lifecycle, shared-machine transcript handling, truthful share behavior, and rolling-cap index/atomicity.

**Overall verdict: BLOCK**
tokens used
243,796
# Adversarial review — `40733b8..aaeb334`

## BLOCKER

### 1. Authenticated users can exhaust the anonymous demo-session cap

The rolling-window filter counts every session for the document, not only anonymous sessions: [backend/app/api/chat.py:61](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:61). Yet authenticated demo requests bypass both the normal free-plan cap, which excludes demo documents, and the anonymous rate limiter: [backend/app/api/chat.py:209](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:209), [backend/app/api/chat.py:226](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:226).

Consequently, one free authenticated account can POST 500 empty sessions against each public demo document without spending credits, after which every anonymous create receives `DEMO_SESSION_LIMIT_REACHED` for 24 hours: [backend/app/api/chat.py:240](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:240), [backend/app/api/chat.py:253](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:253). Cleanup deliberately excludes those authenticated rows, so they also accumulate permanently: [backend/app/workers/cleanup_tasks.py:63](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/workers/cleanup_tasks.py:63).

Must fix by adding `ChatSession.user_id.is_(None)` to the rolling filter. Authenticated demo-session creation should also receive a reasonable rate/session guard to close the underlying row-spam vector.

## IMPORTANT

### 2. The restored counter is not server truth after TTL expiry, IP changes, regeneration, or continuation

The server counter belongs to the current `(IP, document)` Redis key and expires 24 hours after its first increment: [backend/app/core/rate_limit.py:217](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/core/rate_limit.py:217). The frontend instead restores the entire historical transcript, subtracts every historical user message from the current server count, then adds every transcript user message back when calculating usage: [frontend/src/lib/useChatSession.ts:62](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/useChatSession.ts:62), [frontend/src/lib/useChatStream.ts:72](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/useChatStream.ts:72).

That arithmetic only works while all restored messages belong to the current Redis window and IP. For example, after the Redis key expires, `demo_messages_used` is zero but a restored five-question transcript still makes `demoLimitReached` true, blocking a request the backend would accept. Moving between Wi-Fi/mobile/VPN causes the same divergence.

It also undercounts quota-consuming actions that do not append a user message. Regeneration reuses the existing user message, while continuation adds none: [frontend/src/lib/useChatStream.ts:286](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/useChatStream.ts:286), [frontend/src/lib/useChatStream.ts:311](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/useChatStream.ts:311). Both backend endpoints increment the quota: [backend/app/api/chat.py:375](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:375), [backend/app/api/chat.py:483](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:483). Users therefore see stale remaining usage and receive an unexpected 429 later.

The counter needs an authoritative window-aware model—ideally server count/reset metadata plus explicit tracking or refresh after every quota-consuming request—not inference from the full transcript.

### 3. The stored-session pointer is neither transition-complete nor failure-safe

Only the initial `useChatSession` create path writes `dt-demo-session:*`: [frontend/src/lib/useChatSession.ts:103](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/useChatSession.ts:103). The ordinary “New Chat” and session-switch actions neither update that pointer nor recompute the counter contract: [frontend/src/components/SessionDropdown.tsx:58](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/SessionDropdown.tsx:58), [frontend/src/components/SessionDropdown.tsx:84](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/SessionDropdown.tsx:84).

After creating or selecting another chat, reload therefore restores the old session. Deleting the stored session can likewise leave surviving anonymous sessions unreachable because anonymous `listSessions` intentionally returns an empty list: [backend/app/api/chat.py:581](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:581).

Additionally, every `getMessages` failure—including a transient network error or 502/504—deletes the only pointer: [frontend/src/lib/useChatSession.ts:77](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/useChatSession.ts:77). Storage reads and writes themselves are unguarded against `SecurityError`/storage-disabled environments: [frontend/src/lib/useChatSession.ts:40](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/useChatSession.ts:40).

Use a shared storage helper across create/switch/delete, clear only on definitive 404/ownership failure, and handle unavailable storage without aborting session initialization.

### 4. Per-tab storage is not a user boundary on shared machines

A stored session is silently fetched and its full transcript rendered on revisit: [frontend/src/lib/useChatSession.ts:39](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/useChatSession.ts:39), [frontend/src/lib/useChatSession.ts:62](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/useChatSession.ts:62). Backend authorization for anonymous demo sessions only checks that the session itself is anonymous; it does not bind it to a guest token or client: [backend/app/api/chat.py:157](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:157).

A second anonymous person using the same still-open or restored tab receives the prior person’s questions and answers automatically. `sessionStorage` isolates tabs, not people. At minimum, require explicit “resume previous demo chat” consent and provide a prominent clear/reset action; stronger isolation requires an anonymous ownership token.

### 5. Anonymous “Share” is a knowingly non-completing action

The UI exposes controls titled “Share conversation” to anonymous users: [frontend/src/components/Chat/ChatPanel.tsx:646](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/Chat/ChatPanel.tsx:646). Their handler explicitly admits that it is “not a working share” and merely opens authentication: [frontend/src/components/Chat/ChatPanel.tsx:459](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/Chat/ChatPanel.tsx:459).

After authentication, the user cannot access the anonymous session because authenticated callers may only access their own demo sessions: [backend/app/api/chat.py:162](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:162). The stored key is cleared and a fresh session is loaded/created. Thus the action named “Share” cannot share the transcript before or after completing the requested signup.

I challenge the accepted tradeoff: session adoption need not block P0, but presenting a non-functional share control as a conversion hook is a broken promise. Either preserve/adopt the transcript or use explicit copy explaining that the current chat cannot be shared.

### 6. The rolling cap remains a non-atomic, increasingly expensive abuse guard

The cap executes a count and later inserts in a separate operation with no row/advisory lock: [backend/app/api/chat.py:240](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:240), [backend/app/api/chat.py:253](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:253). Concurrent creates can all observe 499 and exceed the advertised hard cap.

The only relevant index is on `document_id`, not `(document_id, created_at)` or an anonymous partial equivalent: [backend/alembic/versions/20260211_0015_add_missing_indexes.py:17](/Users/mayijie/Projects/Code/010_DocTalk/backend/alembic/versions/20260211_0015_add_missing_indexes.py:17). Because message-bearing demo sessions and authenticated sessions are retained indefinitely, every create increasingly scans historical rows for that demo document.

Add a partial composite index such as `(document_id, created_at) WHERE user_id IS NULL`; if 500 is intended as a hard availability boundary, serialize the check-and-insert per document.

## MINOR

### 7. Cleanup can race a resumed old empty session

Cleanup identifies sessions solely by age and absence of committed messages, then deletes them without coordinating with chat access: [backend/app/workers/cleanup_tasks.py:61](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/workers/cleanup_tasks.py:61). A user can successfully re-adopt an eight-day-old empty session, then have Beat delete it after access verification but before the first user-message commit: [backend/app/api/chat.py:330](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:330), [backend/app/services/chat_service.py:1108](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:1108). The message FK cascades on parent deletion: [backend/app/models/tables.py:237](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/models/tables.py:237).

Committed messages, authenticated sessions, and non-demo sessions are correctly protected; the issue is the narrow concurrent first-message window.

### 8. The new messages-response field is absent from the backend API schema

The endpoint returns `demo_messages_used` by manually returning `JSONResponse`: [backend/app/api/chat.py:309](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:309). But its declared `SessionMessagesResponse` contains only `messages`: [backend/app/schemas/chat.py:47](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/schemas/chat.py:47).

Runtime works because `JSONResponse` bypasses response-model serialization, but OpenAPI and generated clients advertise the wrong contract. Add the optional field to `SessionMessagesResponse` and return the typed model.

### 9. The callback override primitive can construct a cross-origin URL

`openAuthModal` accepts any string: [frontend/src/lib/auth-modal.ts:9](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/auth-modal.ts:9), and `AuthModal` concatenates it directly to the origin: [frontend/src/components/AuthModal.tsx:97](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/AuthModal.tsx:97). For example, `@evil.com/path` produces `https://www.doctalk.site@evil.com/path`, whose origin is `https://evil.com`.

There is no exploit through current call sites—the only override is the literal `/`, and Auth.js currently applies its own same-origin redirect validation. Nevertheless, the exported primitive is not footgun-proof. Resolve with `new URL(override, window.location.origin)` and reject any origin mismatch.

### 10. The progress bar’s accessible name still describes the opposite quantity

The visual width, `aria-valuenow`, and `aria-valuetext` now describe questions remaining, but `aria-label` remains “Messages used”: [frontend/src/components/Chat/ChatPanel.tsx:565](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/Chat/ChatPanel.tsx:565). Screen readers receive a contradictory name/value pair. Rename the accessible label to “Questions remaining.”

### 11. The localized demo breadcrumb drops users back to English

`DemoPageClient` hardcodes the Home breadcrumb href to `/`: [frontend/src/app/demo/DemoPageClient.tsx:71](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/demo/DemoPageClient.tsx:71). On `/de/demo`, `/fr/demo`, etc., the translated Home breadcrumb therefore leaves the locale URL instead of linking to `/de`, `/fr`, and so on. Use `localizedHrefIfAvailable(locale, '/')`, matching the other localized marketing pages.

## Cleared attack surfaces

- Both message-producing endpoints use the new document-scoped key; the fixed-width UUID suffix prevents delimiter ambiguity with IPv6 textual forms.
- The 24-hour SQL boundary uses database time and has the intended strict cutoff.
- Cleanup predicates correctly protect already-committed messages, authenticated sessions, and non-demo documents outside the concurrency window.
- The two public events inherit the existing 30/minute/IP limiter and bounded property sanitizer; their actual callers send only `valid` or no properties, so this batch adds no PII exposure.
- All 11 cap-copy translations are present, the seeded SSR prefix set covers the demo/header/footer render tree, and hreflang/sitemap wiring is consistent.
- I found no remaining invisible-on-white utility in the five swept files and no unaccepted dark-mode over-fix; the remaining UI issue is the progressbar semantic mismatch above.

Must-fix before re-review: the authenticated demo-cap DoS, authoritative counter model, complete/failure-safe storage lifecycle, shared-machine transcript handling, truthful share behavior, and rolling-cap index/atomicity.

**Overall verdict: BLOCK**
