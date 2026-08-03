# P1 hygiene: paywall upgrade-path coverage audit

Date: 2026-08-03
Scope: for each plan-limit error code in play, verify whether its actual
render site surfaces an upgrade path (PaywallModal or inline CTA linking to
billing), or dead-ends on inline copy with no way forward. Per-code, not
per-handler — the same code can have multiple trigger sites and multiple
consumers, and a code that's "fixed" at one site can still dead-end at
another.

Already-done codes per the task brief (INSUFFICIENT_CREDITS, MODE_NOT_ALLOWED,
PRO_MODE_LIMIT_REACHED, BALANCED_MODE_LIMIT_REACHED,
LAYOUT_TRANSLATION_LIMIT_REACHED) were not re-audited — confirmed already
routed through PaywallModal via `useChatStream.ts`'s `handleStreamError`
hardcoded list.

## Findings

### 1. DOCUMENT_LIMIT_REACHED — mixed (2 of 4 trigger sites are gaps)

Backend raises it at four sites, not one:
- `backend/app/api/documents.py:227` — direct upload
- `backend/app/api/documents.py:361` — URL ingest
- `backend/app/api/layout_translations.py` `_assert_document_capacity()`
  (defined ~163), called at lines 261/277 inside `create_layout_translation`
  when `add_to_library` is set
- `backend/app/api/layout_translations.py:459` — `import_layout_translation_document`
  ("Add to DocTalk" import of a finished translation)

| Trigger | Consumer | Status |
|---|---|---|
| documents.py:227, :361 | `frontend/src/components/dashboard/DashboardPageClient.tsx` (client pre-check ~227-240, server-error catch ~300-307) | **Fixed.** `errorCopy()` computed, `.cta` rendered as a clickable `<Link>` (lines ~459-465, ~498-504). |
| layout_translations.py add_to_library (261/277) | `frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx`, `handleLayoutTranslationSubmit` else-branch (~204-208) | **Gap.** Collapses `errorCopy()` into a plain string (`` `${copy.title}: ${copy.body}` ``) stored in `layoutTranslationError: string | null`, rendered as a plain amber banner (~297-303). `.cta` is computed and discarded. |
| layout_translations.py:459 (import) | `frontend/src/components/Chat/ChatArtifactCard.tsx`, `handleImportLayoutTranslation` (~276-306) | **Gap.** Doesn't call `errorCopy()` at all — `setLayoutImportError(err instanceof Error ? err.message : 'Document import failed')` stores the raw/technical message, rendered as plain red text (~332-333). No upgrade path. |

**Plan:** for both gaps, compute `errorCopy()` (already imported/used elsewhere
in both files) and render `.title`/`.body`/`.cta` inline, mirroring the
pattern this same DocumentReaderPageClient.tsx file already uses for
`sessionErrorCopy` (title, body, clickable cta button). Not routing through
the existing layout-translation `PaywallModal` on that surface — that modal's
`paywallCopy()` switch has no detail-interpolation path (no `limit`/`plan`
params reach it) and is scoped to `LAYOUT_TRANSLATION_LIMIT_REACHED`
specifically; conflating a generic document-count cap into it would need
new plumbing for no real benefit when `errorCopy()` already renders a fully
correct, tested CTA inline elsewhere in the same file.

### 2. FILE_TOO_LARGE — fixed, no action

`documents.py:253,423,468` → same `DashboardPageClient.tsx` catch path as
DOCUMENT_LIMIT_REACHED. Confirmed rendered with `.cta` link.

### 3. URL_CONTENT_TOO_LARGE — not a plan limit, no CTA warranted

`documents.py:386`, detail is `{message}` only (no `plan`/`limit` fields).
Traced to `backend/app/services/extractors/url_extractor.py`:
`MAX_CONTENT_SIZE = 10 * 1024 * 1024` — a fixed 10MB constant, not
plan-dependent. `errorCopy.ts`'s existing `URL_CONTENT_TOO_LARGE` entry
correctly has no `cta`. No fix — an upgrade CTA here would be false: paying
more doesn't raise this cap.

### 4. SESSION_LIMIT_REACHED — fixed at both trigger sites, no action

`backend/app/api/chat.py:244,267` inside `create_session` (free plan, 3/doc).
Two independent frontend consumers:
- `frontend/src/lib/useChatSession.ts` → `sessionError` → consumed by
  `DocumentReaderPageClient.tsx` (`sessionErrorCopy`, rendered with cta
  button, ~434-440).
- `frontend/src/components/SessionDropdown.tsx`'s own `onNewChat()` (a
  second, more-frequently-hit trigger — "New Chat" from the session
  dropdown) — independently computes `errorCopy()` into its own
  `sessionErrorCopy` state and renders `.cta` as a `<Link>` (~254-260).

Both confirmed fixed.

### 5. COLLECTION_LIMIT_REACHED — fixed, no action

`backend/app/api/collections.py:132` (`create_collection`) →
`frontend/src/components/Collections/CreateCollectionModal.tsx`,
`handleCreate()` computes `errorCopy()` into `createErrorCopy` state,
rendered with a clickable cta `<Link>` (~205-213).

### 6. COLLECTION_DOC_LIMIT_REACHED — fixed, no action

`backend/app/api/collections.py:277` (add documents) →
`frontend/src/app/collections/[collectionId]/page.tsx`, `errorCopy()` at
~187, rendered with cta at ~542-548.

### 7. SHARE_LIMIT_REACHED — gap

`backend/app/api/sharing.py:84` (`create_share`, free plan capped at 3 active
shares) → `frontend/src/components/Chat/ChatPanel.tsx`, both `handleShare()`
(~391-418) and `handleShareAnswer()` (~420-445+). Both compute
`const copy = errorCopy(e, t, tOr);` then discard `.cta`, pushing only
`copy.body` as plain text into a chat-transcript "error message" bubble
(`role: 'assistant', isError: true`).

**Plan:** `MessageBubble.tsx` confirmed (lines 258-320): `isError` messages
are NOT the `isUser` branch, so they render through the same `ReactMarkdown`
pipeline as normal assistant answers (only styling differs — red bubble).
A plain markdown link in `copy.body`/appended text will render as a real
clickable `<a>`. Append `copy.cta` as a markdown link
(`\n\n[label](href)`) to the message text when `.cta` is present — matches
this file's existing "chat bubble as feedback channel" pattern for
share-success confirmations, with the smallest possible diff.

### 8. DOMAIN_MODE_REQUIRES_PLUS — new code, two trigger sites, both gaps

Backend raises 403 with `{required_plan: "plus"}` at two independent sites
(same check, added same day per code comments):
- `backend/app/api/chat.py:405` — inside `chat_stream`, before any
  `StreamingResponse` starts (confirmed via reading lines 330-420: plain
  `async def`, so this surfaces as a normal pre-stream HTTP 403, not a
  mid-stream SSE `error` event).
- `backend/app/api/extractions.py:200` — inside `create_extraction` (REST),
  explicitly the "second entry point" per its own code comment.

| Trigger | Consumer | Status |
|---|---|---|
| chat.py:405 (chat SSE) | `frontend/src/lib/useChatStream.ts`, `handleStreamError` | **Gap.** Hardcoded paywall-trigger code list (`INSUFFICIENT_CREDITS` / `MODE_NOT_ALLOWED` / `PRO_MODE_LIMIT_REACHED` / `BALANCED_MODE_LIMIT_REACHED` / `status===402`) does not include this code — falls through to generic chat-bubble error text. |
| extractions.py:200 (REST) | `frontend/src/components/Extraction/ExtractionPanel.tsx`, `runExtraction()` catch (~212-217) | **Gap.** `paywallCode` trigger condition only checks `INSUFFICIENT_CREDITS` / `EXTRACTION_LIMIT_REACHED`; this code falls to `setError(err.message)`, a raw string with no CTA. Note: the panel reads `domainMode` from the global Zustand store (shared with chat's `DomainModeSelector`, which already disables the selector for free users) — this makes the REST path narrow in practice, but not unreachable (stale/race state), and it's a dead end today regardless. |

**Plan (4 files, chat SSE path):**
- `frontend/src/lib/errorCopy.ts` — add a `DOMAIN_MODE_REQUIRES_PLUS`
  CODE_TABLE entry using the existing `requiredPlanCta(detail, tOr, reason)`
  helper (backend sends `required_plan`), `openPaywall: true`, mirroring
  `MODE_NOT_ALLOWED`'s shape. (Covers any non-SSE/generic consumer that runs
  errors through `errorCopy()`, and keeps the table complete.)
- `frontend/src/lib/useChatStream.ts` — add
  `code === 'DOMAIN_MODE_REQUIRES_PLUS'` to `handleStreamError`'s hardcoded
  paywall-trigger list, so it calls `onShowPaywall(reason)` like the mode-cap
  family.
- `frontend/src/components/PaywallModal.tsx` — `paywallCopy()` is a separate
  switch keyed only on the reason string (no error detail reaches it), so
  routing to `onShowPaywall()` alone would fall through to the generic
  "Insufficient Credits" copy — wrong message for a plan-gate. Add an
  explicit `DOMAIN_MODE_REQUIRES_PLUS` case.
- `frontend/src/lib/billingLinks.ts` — add an explicit
  `DOMAIN_MODE_REQUIRES_PLUS` case to `deriveUpgradePlan()` → always `'plus'`
  (this gate only ever fires for free-plan users, since plus/pro already
  pass the backend check, so the existing generic fallback would resolve
  the same value — but an explicit case keeps intent legible and matches
  the `LAYOUT_TRANSLATION_LIMIT_REACHED` precedent).

**Plan (REST extraction path):** `ExtractionPanel.tsx` already has a working
inline paywall-banner pattern for `EXTRACTION_LIMIT_REACHED`/
`INSUFFICIENT_CREDITS` using `billingHref()` directly (~464-478) — add
`DOMAIN_MODE_REQUIRES_PLUS` to the trigger condition (~213) and a copy branch
in the existing render block. No new modal, no new dependency.

## Summary of genuine gaps to fix (5 surfaces, 1 commit each)

1. `ChatPanel.tsx` — render SHARE_LIMIT_REACHED's `.cta` in the error bubble.
2. `DocumentReaderPageClient.tsx` — `handleLayoutTranslationSubmit` else
   branch: render DOCUMENT_LIMIT_REACHED's `.cta` inline instead of
   collapsing to a string.
3. `ChatArtifactCard.tsx` — `handleImportLayoutTranslation`: switch from raw
   `err.message` to `errorCopy()` + inline cta.
4. `errorCopy.ts` + `useChatStream.ts` + `PaywallModal.tsx` +
   `billingLinks.ts` — full DOMAIN_MODE_REQUIRES_PLUS path for chat SSE.
5. `ExtractionPanel.tsx` — DOMAIN_MODE_REQUIRES_PLUS in the REST extraction
   paywall banner.

No changes needed: DOCUMENT_LIMIT_REACHED (upload/URL-ingest sites),
FILE_TOO_LARGE, URL_CONTENT_TOO_LARGE, SESSION_LIMIT_REACHED,
COLLECTION_LIMIT_REACHED, COLLECTION_DOC_LIMIT_REACHED — already fixed or,
for URL_CONTENT_TOO_LARGE, correctly CTA-less.

Every new/changed user-facing string needs all 11 locale files updated
(flat dotted keys) alongside the `en` source.
