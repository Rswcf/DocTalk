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
