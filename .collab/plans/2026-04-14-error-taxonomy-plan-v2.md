# Error Taxonomy & Plan-Limit UX Fix — Implementation Plan (v2)

**Author:** Claude (Opus 4.6), incorporating Codex review r1
**Date:** 2026-04-14
**Supersedes:** `2026-04-14-error-taxonomy-plan.md` (v1)
**Codex review it addresses:** `.collab/reviews/2026-04-14-error-taxonomy-r1-codex.md` (verdict `REQUEST_CHANGES`)
**Status:** Draft for Codex r2 confirmation
**Origin bug:** User uploaded 1.6 MB PDF → backend returned `403 DOCUMENT_LIMIT_REACHED` (Free-plan 3-doc cap), frontend rendered generic `"Upload failed, please check network or try again later"`. The blind catch exists across most upload / chat / collection / share / export surfaces.

---

## 0. Changes since v1 (why this is v2)

| # | Codex finding (severity) | Resolution |
|---|---|---|
| 1 | Inventory incomplete (Must) | §2 rewritten: added SSE codes `SESSION_NOT_FOUND` / `MESSAGE_NOT_FOUND` / `CONTINUATION_LIMIT`, all 404 paths, `search.py` / `chunks.py` / `users.py`, 12 distinct parse-worker `error_msg` strings. |
| 2 | Back-compat for billing parser (Must) | `ApiError.message` now preserves `HTTP <status>: <raw>` contract; BillingPageClient regex-on-message keeps working. (Codex-proposed diff adopted verbatim — see §5 B1.) |
| 3 | SSE code path doesn't actually exist in frontend (Must) | §5 B3 gains a concrete rewrite of `useChatStream.ts` that reads `.code` + `.status` off `ApiError`, matching Codex-proposed diff. |
| 4 | Scope inconsistency on export / custom-instructions (Must) | Decision: **include** these surfaces in this PR (call-sites are tiny: `api.ts:287-294`, `CustomInstructionsModal.tsx`, `ChatPanel.tsx:186-202`). §5 D test matrix + §8 tasks updated. |
| 5 | Security model — SSRF oracle, unknown `ValueError`, 404 masking (Must) | §5 A: six SSRF reason codes collapse into one `URL_FETCH_BLOCKED`. Unknown `ValueError` → 500 `SERVER_ERROR` (not 4xx `VALIDATION_ERROR`). All 404 "not found" responses keep identical copy regardless of existence vs authorization. |
| 6 | Test matrix gaps (Must) | §5 D expanded to cover SSE codes (`SESSION_NOT_FOUND` / `MESSAGE_NOT_FOUND` / `CONTINUATION_LIMIT`), chat-continue 409, billing regex regression, search/chunk 429, transitional back-compat. |
| 7 | Enum naming collision (Should) | `MAX_CONTINUATIONS_REACHED` renamed to `CONTINUATION_LIMIT` to match existing SSE emitter at `chat_service.py:684`. |
| 8 | `message` field contract (Should) | §5 A explicitly: `message` is **present and human-readable during one deprecation window** (this PR + next release), then becomes log-only. Frontend MUST prefer `code` and ignore `message` for routing. |
| 9 | Worker bridge (Should) | §5 B4 adds a bridge: parse worker writes `error_msg` in form `ERR_CODE:<CODE>:<fallback text>`. Frontend mapper extracts `<CODE>`; falls back to free text until worker migrates. No wire rewrite later. |
| 10 | Nit: `URL_INVALID_SCHEME` vs `INVALID_URL_SCHEME` drift | Canonical is `URL_FETCH_BLOCKED` (see #5); the five redundant SSRF codes are gone. |
| Q1–Q7 | Open-question positions | Adopted Codex's positions on all 7; rationale in §6. |

---

## 1. Goal

Unchanged from v1: one coherent wire-level error taxonomy, one frontend mapper, 11-locale-safe copy via `tOr()`, no behavior regressions on existing surfaces (402 paywall, 429 demo rate-limit, 409 processing toast, billing error regex).

---

## 2. Full Backend Error Inventory (complete)

### 2.1 Upload path — `backend/app/api/documents.py`

| # | Line | HTTP | current `detail` | new code | Plan? |
|---|---|---|---|---|---|
| U1 | 157 | 400 | `"UNSUPPORTED_FORMAT"` | `UNSUPPORTED_FORMAT` | no |
| U2 | 177 | 403 | `{error:DOCUMENT_LIMIT_REACHED,limit,current}` | `DOCUMENT_LIMIT_REACHED` | **yes** |
| U3 | 197 | 400 | `{error:FILE_TOO_LARGE,max_mb}` | `FILE_TOO_LARGE` | **yes** |
| U4 | 203 | 400 | `"INVALID_FILE_CONTENT"` | `INVALID_FILE_CONTENT` | no |
| U5 | 219 | 400 | `str(ValueError)` ⚠ leak | **ALLOWLIST**: map known → enum, unknown → **500** `SERVER_ERROR` | no |
| U6 | 245 | 400 | `"URL must start with…"` | `URL_INVALID` | no |
| U7 | 252 | 400 | `str(ValueError)` ⚠ | same allowlist rule as U5 | no |
| U8 | 272 | 403 | `{error:DOCUMENT_LIMIT_REACHED,…}` | `DOCUMENT_LIMIT_REACHED` | **yes** |
| U9 | 287 | 400 | one of 6 distinct SSRF reason strings ⚠ oracle risk | **COLLAPSE → `URL_FETCH_BLOCKED`**; log the specific reason server-side only | no |
| U10 | 289 | 400 | `"URL_CONTENT_TOO_LARGE"` | `URL_CONTENT_TOO_LARGE` | no |
| U11 | 291 | 400 | `"NO_TEXT_CONTENT"` | `NO_TEXT_CONTENT` | no |
| U12 | 292 | 400 | `f"Failed to fetch URL: {code}"` ⚠ | `URL_FETCH_FAILED` (strip `code`) | no |
| U13 | 295 | 400 | `"Failed to fetch URL"` | `URL_FETCH_FAILED` | no |
| U14 | 306, 339 | 400 | `{error:FILE_TOO_LARGE,max_mb}` | `FILE_TOO_LARGE` | **yes** |
| U15 | 410 | 502 | `"Storage service unavailable"` | `STORAGE_UNAVAILABLE` | no |
| U16 | 494 | 409 | `"Document is still processing"` | `DOCUMENT_PROCESSING` + `status` | no |
| U17 | 541 | 400 | `"Instructions too long (max 2000 chars)"` | `INSTRUCTIONS_TOO_LONG` + `max` | no |
| U18 | 546 | 403 | `"Custom instructions require Pro plan"` | `CUSTOM_INSTRUCTIONS_REQUIRE_PRO` | **yes** |
| U-404 | 376,378,395,397,401,432,434,492,515,518,538 | 404 | `"Document not found"` / `"No converted PDF available"` | `DOCUMENT_NOT_FOUND` (keep identical copy regardless of existence/authz — no enumeration oracle) | no |

### 2.2 Chat / session path — `backend/app/api/chat.py` + `backend/app/services/chat_service.py`

| # | Line | HTTP / SSE | current | new code | Plan? |
|---|---|---|---|---|---|
| C1 | chat.py:118 | 403 | `{message,limit}` | `SESSION_LIMIT_REACHED` + `limit, plan` | **yes** |
| C2 | chat.py:131 | 429 | `{message,retry_after}` | `DEMO_SESSION_RATE_LIMITED` + `retry_after` | no |
| C3 | chat.py:141 | 429 | `{message,limit}` | `DEMO_SESSION_LIMIT_REACHED` + `limit` | no |
| C4 | chat.py:214, 305 | 409 | `{message,status}` | `DOCUMENT_PROCESSING` + `status` | no |
| C5 | chat.py:224,232,315,322 | 429 | `{message:"Rate limit exceeded",retry_after}` | `RATE_LIMITED` + `retry_after` (**message text unchanged** — see §5 A deprecation window) | no |
| C6 | chat.py:244,334 | 429 | `{message,limit}` | `DEMO_MESSAGE_LIMIT_REACHED` + `limit` | no |
| C7 | chat.py:259,369 | 402 | `{message,required,balance}` | `INSUFFICIENT_CREDITS` + `required, balance` | no |
| C8 | chat.py:358 | 400 | `"Maximum continuations reached"` | `CONTINUATION_LIMIT` + `max` (**unified with SSE C12**) | no |
| C9 | chat.py:109,181,210,301,355,409,464 | 404 | `"Session not found"` / `"Document not found"` / `"Message not found"` | `SESSION_NOT_FOUND` / `DOCUMENT_NOT_FOUND` / `MESSAGE_NOT_FOUND` (same copy regardless of existence/authz) | no |
| C10 | chat_service.py:251,637 | SSE | `{code:SESSION_NOT_FOUND,message}` | keep `SESSION_NOT_FOUND` | no |
| C11 | chat_service.py:675,679 | SSE | `{code:MESSAGE_NOT_FOUND,message}` | keep `MESSAGE_NOT_FOUND` | no |
| C12 | chat_service.py:684 | SSE | `{code:CONTINUATION_LIMIT,message}` | keep `CONTINUATION_LIMIT` (canonical) | no |
| C13 | chat_service.py:291,698 | SSE | `{code:MODE_NOT_ALLOWED,message}` | keep `MODE_NOT_ALLOWED` + add `required_plan:"plus"` | **yes** |
| C14 | chat_service.py:311,716 | SSE | `{code:INSUFFICIENT_CREDITS,…}` | keep `INSUFFICIENT_CREDITS` (shared with HTTP C7) | no |
| C15 | chat_service.py:448,830 | SSE | `{code:CHAT_SETUP_ERROR\|RETRIEVAL_ERROR\|LLM_ERROR\|ACCOUNTING_ERROR\|PERSIST_FAILED,…}` | keep as-is (already structured) | no |

### 2.3 Collections — `backend/app/api/collections.py`

| # | Line | HTTP | current | new code | Plan? |
|---|---|---|---|---|---|
| COL1 | 124 | 403 | `f"Your plan allows up to {n} collections…"` | `COLLECTION_LIMIT_REACHED` + `limit, plan` | **yes** |
| COL2 | 264 | 403 | `f"Your plan allows up to {n} documents per collection…"` | `COLLECTION_DOC_LIMIT_REACHED` + `limit, plan` | **yes** |
| COL3 | 175,205,221,292,313,336 | 404 | `"Collection not found"` | `COLLECTION_NOT_FOUND` | no |

### 2.4 Export — `backend/app/api/export.py`

| # | Line | HTTP | current | new code | Plan? |
|---|---|---|---|---|---|
| E1 | 73 | 403 | `"PDF/DOCX export requires Plus or Pro plan"` | `EXPORT_REQUIRES_PAID_PLAN` + `format, required_plans:["plus","pro"]` | **yes** |
| E2 | 120 | 400 | `str(ValueError)` ⚠ | `EXPORT_VALIDATION_FAILED` + allowlisted `reason` | no |
| E3 | 127 | 500 | `str(ExportError)` ⚠ | `EXPORT_RENDERER_FAILED` (no raw message to client) | no |
| E4 | 68 | 404 | `"Session not found"` | `SESSION_NOT_FOUND` | no |

### 2.5 Sharing — `backend/app/api/sharing.py`

| # | Line | HTTP | current | new code | Plan? |
|---|---|---|---|---|---|
| SH1 | 74 | 403 | `"Free plan limited to 3 active share links…"` | `SHARE_LIMIT_REACHED` + `limit, plan` | **yes** |
| SH2 | 122 | 429 | `{message,retry_after}` | `RATE_LIMITED` + `retry_after` | no |
| SH3 | 137 | 410 | `"Share link has expired"` | `SHARE_EXPIRED` | no |
| SH4 | 44, 105, 133, 145 | 404 | `"Session not found"` / `"Share not found"` / `"Shared session not found"` / `"Session no longer exists"` | `SHARE_NOT_FOUND` (unified, same copy) | no |

### 2.6 Search / chunks / users — (previously omitted)

| # | File:line | HTTP | current | new code |
|---|---|---|---|---|
| S1 | search.py:32 | 429 | `{message,retry_after}` | `RATE_LIMITED` + `retry_after` |
| S2 | search.py:39,41 | 404 | `"Document not found"` | `DOCUMENT_NOT_FOUND` |
| CH1 | chunks.py:28 | 429 | `{message,retry_after}` | `RATE_LIMITED` + `retry_after` |
| CH2 | chunks.py:36,41,44 | 404 | `"Chunk not found"` | `CHUNK_NOT_FOUND` |
| US1 | users.py:377 | 500 | `"Failed to delete all user documents"` | `SERVER_ERROR` |
| US2 | users.py:387 | 502 | `"Failed to inspect active subscription"` | `STRIPE_UNAVAILABLE` |
| US3 | users.py:401 | 502 | `"Failed to cancel active subscription"` | `STRIPE_UNAVAILABLE` |
| US4 | users.py:409 | 500 | `"Failed to delete user"` | `SERVER_ERROR` |

### 2.7 Parse worker — `backend/app/workers/parse_worker.py`

12 distinct `error_msg` strings currently written as free text:

| Worker enum (new) | Current string | Line |
|---|---|---|
| `PARSE_TIMEOUT` | "Document parsing timed out after 9 minutes" | 65 (via `_set_timeout_error`) |
| `DOWNLOAD_FAILED` | "Failed to download document file" | 118 |
| `EXTRACTION_FAILED` | "Failed to extract {type} content" | 139 |
| `PDF_PARSE_FAILED` | "PDF parsing failed, file may be corrupted" | 183 |
| `OCR_DISABLED` | "This document is a scanned PDF without a text layer. OCR is disabled." | 196 |
| `OCR_FAILED` | "OCR text recognition failed" | 218 |
| `OCR_INSUFFICIENT_TEXT` | "OCR could not extract sufficient text" | 227 |
| `PERSIST_PAGES_FAILED` | "Failed to save document pages to database" | 283 |
| `CHUNKING_FAILED` | "Document chunking failed" | 296 |
| `PERSIST_CHUNKS_FAILED` | "Failed to save document chunks to database" | 330 |
| `NO_CHUNKS` | "No text content could be extracted from the document" | 352 |
| `VECTORIZE_FAILED` | "Vectorization or indexing failed" | 426 |

**Bridge contract (this PR):** worker writes `error_msg = f"ERR_CODE:{code}:{human_text}"`. Frontend mapper parses leading `ERR_CODE:<CODE>:` and uses `<CODE>` for lookup, falling back to the trailing text verbatim if no `ERR_CODE:` prefix (back-compat for rows already written). This costs ~12 lines in `parse_worker.py` and zero wire-format changes later.

### 2.8 Auth & deps (no changes this PR)

- `deps.py:72` → 401 `"Authentication required"` (unchanged — proxy auto-redirects).
- `deps.py:82` → 403 `"Admin access required"` (unchanged — admin-only surface).
- `auth.py` internal adapter endpoints — out of scope (service-to-service, not user-facing).

### 2.9 Billing (handled for back-compat only; no code migration this PR)

27+ `HTTPException` sites in `billing.py`. Current frontend parser `BillingPageClient.tsx:157-168` extracts `"detail":"..."` with regex. **We preserve this contract** via the `ApiError.message` shape in §5 B1. A follow-up PR can migrate billing to structured codes.

---

## 3. Frontend Current Behavior (unchanged from v1, confirmed by Codex)

Added call-sites surfaced by Codex:

- `frontend/src/lib/api.ts:287-294` — `exportSession()` bypasses `handle()` and throws raw `"Export failed: <text>"`.
- `frontend/src/components/Chat/ChatPanel.tsx:186-202` — `alert()`s raw export failure string.
- `frontend/src/components/CustomInstructionsModal.tsx:71-90` — no catch / no UI on save failure.

All three are fixed in §5 B5.

---

## 4. Root Cause (unchanged from v1)

Three `detail` shapes (bare string, `{error}`, `{message}`). Frontend `handle()` stringifies body into `Error.message`. No single source of truth.

---

## 5. Proposed Fix (v2 — revised after Codex review)

### A. Backend: canonicalize `detail`

Every user-facing `HTTPException` raises:

```python
raise HTTPException(status_code=<status>, detail={
    "error": "<UPPER_SNAKE_CODE>",
    "message": "<English human fallback — DEPRECATED, do not route on>",
    **<context fields>,
})
```

**Contract notes (per Codex Should-fix #2):**
- `error` is the canonical wire-level code. Frontend MUST route on `error` only.
- `message` is **human fallback**. Kept for one deprecation window (this PR + next release) to avoid breaking anything we missed. After that it becomes log-only.
- Context fields are additive per-code and documented in §2.

**Unknown `ValueError` handling (per Codex Must #5):**
- `documents.py:219,287`, `export.py:120`, and any other `except ValueError as e` that currently leaks `str(e)` gets an **allowlist**:
  - Known codes from the service layer → mapped to their taxonomy code.
  - Unknown → **500** `SERVER_ERROR` (NOT 400) with `str(e)` logged server-side, never returned.
- Rationale: labelling an unexpected internal exception as user fault (400) is wrong; an unknown exception is almost always a bug.

**SSRF reason collapse (per Codex Must #5):**
- `BLOCKED_HOST` / `BLOCKED_PORT` / `INVALID_URL_SCHEME` / `INVALID_URL_HOST` / `DNS_RESOLUTION_FAILED` / `REDIRECT_LOOP` / `TOO_MANY_REDIRECTS` all collapse to a single `URL_FETCH_BLOCKED` code on the wire. The distinction is logged server-side via `log_security_event`, never returned.
- UI copy: "This URL can't be imported." (deliberately generic).

**404 unification (per Codex Must #5):**
- Every "not found" path returns the same body regardless of existence vs authorization. `DOCUMENT_NOT_FOUND`, `SESSION_NOT_FOUND`, etc. No enumeration oracle.

### B. Frontend

#### B1. `ApiError` that preserves legacy `Error.message` (adopts Codex's compat diff verbatim)

`frontend/src/lib/api.ts`:

```ts
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string | null,
    public detail: Record<string, unknown>,
    public raw: string,
  ) {
    // IMPORTANT: preserve `HTTP <status>: <raw>` message format so legacy
    // substring consumers (e.g., BillingPageClient's detail regex at
    // BillingPageClient.tsx:157-168, useChatStream's 429 phrase match)
    // continue working during migration window. Do NOT "simplify" this.
    super(`HTTP ${status}: ${raw}`);
    this.name = 'ApiError';
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const raw = await res.text();
    let code: string | null = null;
    let detail: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(raw);
      const d = parsed?.detail ?? parsed;
      if (d && typeof d === 'object') {
        detail = d as Record<string, unknown>;
        code = typeof (d as any).error === 'string' ? (d as any).error : null;
      }
    } catch { /* non-JSON body */ }
    throw new ApiError(res.status, code, detail, raw);
  }
  return res.json();
}
```

#### B2. `errorCopy.ts` mapper

```ts
// frontend/src/lib/errorCopy.ts
export interface ErrorCopy {
  title: string;
  body: string;
  cta?: { label: string; href: string };
  severity: 'error' | 'warning' | 'info';
  // Whether the app-level handler should auto-open the paywall.
  // Per Codex position on Q2: only for 402 / MODE_NOT_ALLOWED.
  openPaywall?: boolean;
}

export function errorCopy(err: unknown, t: TFn, tOr: TOrFn): ErrorCopy {
  // 1. ApiError → switch on .code first, .status second
  // 2. SSE-style { code, message } payloads → switch on .code
  // 3. Unknown → generic network copy
  // ...
}
```

One i18n key per code: `errors.<code>.title` + `errors.<code>.body`. English added in `en.json`; 10 other locales fall back through `tOr()`.

#### B3. `useChatStream.ts` rewrite (adopts Codex's diff)

```ts
const getErrorMeta = useCallback((err: unknown) => {
  if (typeof err === 'object' && err) {
    const e = err as Record<string, unknown>;
    return {
      message: String(e.message || ''),
      code: typeof e.code === 'string' ? e.code : null,
      status: typeof e.status === 'number' ? e.status : null,
    };
  }
  return { message: '', code: null, status: null };
}, []);

// handleStreamError:
const { message, code, status } = getErrorMeta(err);

// Paywall only on 402 or MODE_NOT_ALLOWED (Codex position on Q2)
if (status === 402 || code === 'INSUFFICIENT_CREDITS' || code === 'MODE_NOT_ALLOWED') {
  onShowPaywall();
  return;
}

if (status === 409 || code === 'DOCUMENT_PROCESSING') { /* processing toast */ }

if (status === 429 || code === 'RATE_LIMITED' || code === 'DEMO_SESSION_RATE_LIMITED' || code === 'DEMO_MESSAGE_LIMIT_REACHED') {
  const text = code === 'RATE_LIMITED' || message.includes('Rate limit exceeded')
    ? t('demo.rateLimitMessage')
    : t('demo.limitReachedMessage');
  // ...
}
```

SSE-stream event handler also gets a pass: on `event: error` payloads, call `errorCopy({ code, message, ...payload }, t, tOr)` directly (no HTTP status, so mapper uses `code` only).

#### B4. Parse-worker bridge

`useDocumentLoader.ts:68`:

```ts
// info.error_msg is either "ERR_CODE:<CODE>:<human>" (new worker format)
// or free text (legacy, pre-migration rows).
const rawMsg = info.error_msg || '';
const match = rawMsg.match(/^ERR_CODE:([A-Z_]+):(.*)$/);
if (match) {
  const [, code, fallbackText] = match;
  setError(errorCopy({ code, message: fallbackText }, t, tOr).body);
} else {
  setError(rawMsg || t('upload.error'));
}
```

Worker side writes `error_msg = f"ERR_CODE:{code}:{human}"` at all 12 sites (a dict `WORKER_ERROR_MAP: dict[str, str]` near the top). No schema change.

#### B5. New call-site coverage (per Codex Must #4)

- `api.ts:287-294` `exportSession` — route through `handle()`-equivalent: read blob on success, parse JSON error on failure, throw `ApiError`.
- `ChatPanel.tsx:186-202` — replace `alert()` with `errorCopy(e, t, tOr)` + toast.
- `CustomInstructionsModal.tsx:71-90` — add catch + inline error using mapper.

#### B6. Migration order (unchanged from v1, but with tighter guard rails)

1. Backend enum migration — **additive**. All new rows emit `{error,message,...}`; old substring consumers keep working because `Error.message = "HTTP <status>: <raw-json>"` still contains the code substring.
2. Frontend `ApiError` — drop-in, no UI change.
3. Frontend `errorCopy.ts` + en.json keys — unused yet.
4. Frontend call-site swap (one PR, six files: `HomePageClient` upload + url, `useChatStream`, `useDocumentLoader`, `ChatPanel`, `CustomInstructionsModal`, `api.ts` export).
5. Delete dead substring branches (`HomePageClient.tsx:378-383`, `useChatStream.ts:95,110,114` English phrase matches).

### D. Test matrix (expanded per Codex Must #6)

**Backend — one test per emitted code** asserting `response.status_code` + `response.json()["detail"]["error"]` + required context fields:

- Upload: `DOCUMENT_LIMIT_REACHED`, `FILE_TOO_LARGE`, `UNSUPPORTED_FORMAT`, `INVALID_FILE_CONTENT`, `DOCUMENT_NOT_FOUND`, `DOCUMENT_PROCESSING`, `STORAGE_UNAVAILABLE`, `INSTRUCTIONS_TOO_LONG`, `CUSTOM_INSTRUCTIONS_REQUIRE_PRO`.
- Ingest-URL: `URL_INVALID`, `URL_FETCH_BLOCKED` (×3: blocked host, bad scheme, DNS fail — all collapse to one code), `URL_CONTENT_TOO_LARGE`, `NO_TEXT_CONTENT`, `URL_FETCH_FAILED`.
- Unknown `ValueError` contract test: inject unexpected exception into service layer → assert 500 `SERVER_ERROR`, `str(e)` not in response body.
- Chat: `SESSION_LIMIT_REACHED`, `DEMO_SESSION_RATE_LIMITED`, `DEMO_SESSION_LIMIT_REACHED`, `DOCUMENT_PROCESSING` (×2: `chat.py:214` AND `:305`), `RATE_LIMITED` (authed + demo), `DEMO_MESSAGE_LIMIT_REACHED`, `INSUFFICIENT_CREDITS` (pre-check), `CONTINUATION_LIMIT` (HTTP), `SESSION_NOT_FOUND`, `MESSAGE_NOT_FOUND`.
- Chat SSE: `SESSION_NOT_FOUND` (chat_service.py:251,637), `MESSAGE_NOT_FOUND` (:675,679), `CONTINUATION_LIMIT` (:684), `MODE_NOT_ALLOWED`, `INSUFFICIENT_CREDITS` (mid-stream).
- Collections: `COLLECTION_LIMIT_REACHED`, `COLLECTION_DOC_LIMIT_REACHED`, `COLLECTION_NOT_FOUND`.
- Export: `EXPORT_REQUIRES_PAID_PLAN`, `EXPORT_VALIDATION_FAILED`, `EXPORT_RENDERER_FAILED`, `SESSION_NOT_FOUND`.
- Sharing: `SHARE_LIMIT_REACHED`, `SHARE_EXPIRED`, `SHARE_NOT_FOUND`, `RATE_LIMITED`.
- Search / chunks: `RATE_LIMITED`, `DOCUMENT_NOT_FOUND`, `CHUNK_NOT_FOUND`.
- Users: `STRIPE_UNAVAILABLE` (×2), `SERVER_ERROR` (×2).
- 404 masking test: hit an existing-but-not-yours document → same body as missing document.

**Frontend unit (Jest)**:
- `errorCopy()` called with each of the 30+ codes → asserts title/body/openPaywall.
- `ApiError` constructed from each backend response shape → asserts `code`/`status`/`detail`/`message`.
- **Back-compat regression:** feed an `ApiError(400, "URL_CONTENT_TOO_LARGE", {...}, '{"detail":{"error":"URL_CONTENT_TOO_LARGE",...}}')` into the legacy `onUrlSubmit` substring branch → asserts `msg.includes('URL_CONTENT_TOO_LARGE')` still matches.
- **Billing regression:** feed an `ApiError(400, null, {...}, '{"detail":"Cannot switch billing interval during beta"}')` into `BillingPageClient.getBillingErrorMessage` → asserts `t('billing.intervalMismatch')` fires.
- **429 regression:** feed `ApiError(429, 'RATE_LIMITED', { message: 'Rate limit exceeded', retry_after: 60 }, ...)` into `useChatStream` → asserts demo rate-limit text, not demo-message-limit text.

**Frontend integration (Playwright, deferred to next PR if blast radius too large this round)**:
- Upload 3 docs → 4th → UI shows "You've reached the 3-document limit on Free" + Upgrade CTA.
- Free + thorough mode → paywall opens.
- PDF export on free → inline error with upgrade CTA.
- Share ×4 on free → inline error.
- Network offline → generic network copy (no false "plan limit" suggestion).

---

## 6. Positions on v1 open questions (all adopted from Codex)

1. **`INSUFFICIENT_CREDITS` HTTP+SSE reuse** — **yes**, one code.
2. **Paywall auto-open** — **only 402 + `MODE_NOT_ALLOWED`**. Every other plan-limit 403 gets inline CTA.
3. **Raw `ValueError`** — allowlist to known enums; unknown → 500 `SERVER_ERROR`, never 400.
4. **Worker errors** — bridge contract (§2.7) now, full refactor later.
5. **Billing scope** — scope out from enum migration; **preserve legacy `Error.message`** contract in `ApiError` so `BillingPageClient` regex stays green.
6. **Back-compat** — explicit wire-contract note in `ARCHITECTURE.md §10`; `message` field kept for one deprecation window.
7. **`CUSTOM_INSTRUCTIONS_REQUIRE_PRO` vs `EXPORT_REQUIRES_PAID_PLAN` collapse** — **keep separate** for analytics + targeted copy. Share *formatter* code on frontend if we want.

---

## 7. Non-Goals

- Redesigning paywall/upgrade flows.
- Changing numeric plan limits.
- Presigned/chunked/resumable uploads.
- Billing error copy sweep (back-compat preserved; migration deferred).
- Full parse-worker refactor (bridge only).
- Translating error copy into 10 non-English locales (`tOr` fallback is deliberate).

---

## 8. Tasks (execution list)

- [ ] **T1 — Backend enum migration.** Update every `HTTPException` in §2.1–2.6 to new `{error, message, ...}` shape. Add allowlist for service-layer `ValueError` in `documents.py:219,287` + `export.py:120`. Collapse SSRF reasons to `URL_FETCH_BLOCKED`. Unit tests per code.
- [ ] **T2 — Parse worker bridge.** Add `WORKER_ERROR_MAP` dict + update all 12 `doc.error_msg = "..."` writes to `ERR_CODE:<CODE>:<text>` format. Unit test one happy + one new-format error path.
- [ ] **T3 — Frontend `ApiError`.** Replace `handle()` in `api.ts`. Preserve legacy `Error.message` = `HTTP <status>: <raw>`. Unit test: legacy billing regex still matches.
- [ ] **T4 — Frontend `errorCopy.ts` + en.json keys.** ~30 keys. `tOr()` fallback for other locales.
- [ ] **T5 — Call-site swaps.**
  - `HomePageClient.tsx:342-345` (upload file)
  - `HomePageClient.tsx:376-384` (upload URL)
  - `useChatStream.ts:64-130` (SSE + HTTP)
  - `useDocumentLoader.ts:68` (parse-worker bridge consumer)
  - `api.ts:287-294` (`exportSession`)
  - `ChatPanel.tsx:186-202` (export error toast)
  - `CustomInstructionsModal.tsx:71-90` (save error)
- [ ] **T6 — Regression guards.** Billing regex test, 429 phrase test, SSRF URL probe test (codes don't leak SSRF reason).
- [ ] **T7 — Docs.** `docs/ARCHITECTURE.md §10` entry: "Error wire contract — `detail.error` is canonical; `detail.message` deprecated from 2026-04-14 + one release."
- [ ] **T8 — Manual QA via `/deploy` preview.** Exercise every Must-fix hot path from Codex §5.

---

## 8b. Addendum after Codex r2 (blocker-resolving)

Codex r2 verdict: `REQUEST_CHANGES` — one remaining blocker + two safety nets. All accepted.

### B3b. `sse.ts` — propagate structured `detail.error` on pre-stream HTTP failures

Current `frontend/src/lib/sse.ts:145-150` and `:179-184` emit `{ code: 'http_error', message: 'HTTP <status>: <raw>' }`, which strips the backend `detail.error` that §5 B3 now routes on. Adopts Codex's r2 diff verbatim:

```ts
// In chatStream AND continueStream, replace the non-OK branch with:
if (!res.ok || !res.body) {
  if (signal?.aborted) return;
  const raw = await res.text().catch(() => '');
  let code = 'http_error';
  let message = `HTTP ${res.status}: ${raw}`;
  try {
    const parsed = JSON.parse(raw);
    const d = parsed?.detail ?? parsed;
    if (d && typeof d === 'object') {
      const detail = d as Record<string, unknown>;
      if (typeof detail.error === 'string') code = detail.error;
      if (typeof detail.message === 'string') message = detail.message;
    }
  } catch {}
  onError({ code, message, status: res.status });
  return;
}
```

Also widen `ErrorPayload`:
```ts
type ErrorPayload = { code: string; message: string; status?: number };
```

### B4b. Parse-worker prefix safety

Introduce a single helper to avoid double-prefix on retries / partial writes:

```python
# backend/app/workers/parse_worker.py
def _set_doc_error(doc: Document, code: str, human: str) -> None:
    text = human if human.startswith("ERR_CODE:") else f"ERR_CODE:{code}:{human}"
    doc.status = "error"
    doc.error_msg = text
```

Every one of the 12 `doc.status = "error"; doc.error_msg = "..."` sites switches to `_set_doc_error(doc, CODE, HUMAN)`. Retries or re-runs that re-enter the same path won't stack `ERR_CODE:` prefixes.

### D2. Extra tests (Codex r2 "still-missing")

- `sse.ts` unit tests:
  - Non-OK chat response with JSON body `{"detail":{"error":"DOCUMENT_PROCESSING","status":"parsing"}}` → emits `{ status: 409, code: 'DOCUMENT_PROCESSING', message: '...' }`.
  - Non-OK chat response with non-JSON body (e.g., HTML proxy 502) → falls back to `{ code: 'http_error', status: 502 }`.
- `useChatStream`: 402 pre-stream failure originating from `sse.ts` HTTP preflight (not SSE `event:error`) → paywall opens.
- `useChatStream`: 429 pre-stream failure with `code:'RATE_LIMITED'` → demo rate-limit copy (not the demo-message-limit copy).
- Parse-worker bridge:
  - Legacy rows without `ERR_CODE:` prefix → frontend still renders the free text.
  - Malformed prefix `ERR_CODE:bad` (no second colon) → frontend falls through to free-text branch without crashing the regex.
  - Helper double-invocation test: `_set_doc_error(_set_doc_error(doc, A, human))` style retry doesn't stack `ERR_CODE:` prefix.

### Task list delta

- **T3b** (new) — `sse.ts` fix from B3b + its tests from D2.
- **T2b** (new) — `_set_doc_error` helper + double-prefix test.
- Existing T1-T8 unchanged.

---

## 9. Deliberate omissions acknowledged

- Billing enum migration — follow-up PR (noted in ARCHITECTURE.md).
- Full worker refactor — follow-up PR (bridge is forward-compatible).
- i18n translations for 10 non-English locales on new error keys — follow-up localization pass.
- Admin surface errors (`deps.py:82`) — admin-only, not user-facing.
