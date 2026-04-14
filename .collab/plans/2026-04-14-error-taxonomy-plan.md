# Error Taxonomy & Plan-Limit UX Fix — Implementation Plan

**Author:** Claude (Opus 4.6)
**Date:** 2026-04-14
**Status:** Draft for Codex adversarial review
**Origin bug:** User uploaded 1.6 MB PDF → backend returned `403 DOCUMENT_LIMIT_REACHED` (hit Free-plan 3-doc cap), frontend rendered generic `"Upload failed, please check network or try again later"`. The frontend treats every `uploadDocument()` rejection as a network error regardless of status code or `detail.error` — the same blind catch exists for several other plan-gate / validation error codes.

---

## 1. Goal

One coherent error taxonomy that:

1. Covers **every** plan-dependent limit + validation + billing + auth error the backend can emit on user-facing paths.
2. Is **stable on the wire** (single `detail.error` code the frontend can switch on, not free-form English prose).
3. Has a **single frontend mapper** (`errorCodeToMessage(err) → { title, body, cta? }`) so each call-site stops rolling its own `instanceof Error` string-matching.
4. Leaves UX copy translatable in all 11 locales via `tOr()` fallbacks.
5. Does not regress existing behavior (402 paywall trigger, 429 demo-limit messaging, 409 processing toast, etc.).

Out of scope: redesigning the paywall/upgrade flow, reworking Stripe error UX, changing any limit *values*, chunked/presigned uploads.

---

## 2. Full Backend Error Inventory

Exhaustive grep of `HTTPException` + SSE `error` events + Celery `doc.status = "error"` writes. Rows marked ⚠️ are either currently unstructured (string detail) or mis-handled by the frontend.

### 2.1 Upload path (`backend/app/api/documents.py`)

| # | Line | HTTP | `detail` (actual) | Trigger | Plan-gated? |
|---|---|---|---|---|---|
| U1 | 157 | 400 | `"UNSUPPORTED_FORMAT"` | MIME not in ALLOWED_FILE_TYPES | No |
| U2 | 177 | 403 | `{"error":"DOCUMENT_LIMIT_REACHED","limit":N,"current":N}` | ≥ plan doc cap (Free=3 / Plus=20 / Pro=999) | **Yes** |
| U3 | 197 | 400 | `{"error":"FILE_TOO_LARGE","max_mb":N}` | upload body > plan cap (25/50/100 MB) | **Yes** |
| U4 | 203 | 400 | `"INVALID_FILE_CONTENT"` | magic-byte / ZIP-bomb check failed | No |
| U5 | 219 | 400 | raw `str(ValueError)` from `doc_service.create_document` ⚠️ | service-layer validation | No |
| U6 | 245 | 400 | `"URL must start with http:// or https://"` ⚠️ | /ingest-url scheme check | No |
| U7 | 252 | 400 | raw `str(ValueError)` ⚠️ | /ingest-url pre-fetch validation | No |
| U8 | 272 | 403 | `{"error":"DOCUMENT_LIMIT_REACHED",...}` | /ingest-url doc cap | **Yes** |
| U9 | 287 | 400 | `"BLOCKED_HOST" \| "BLOCKED_PORT" \| "INVALID_URL_SCHEME" \| "INVALID_URL_HOST" \| "DNS_RESOLUTION_FAILED" \| "REDIRECT_LOOP" \| "TOO_MANY_REDIRECTS"` ⚠️ (bare string) | SSRF / fetch rejection | No |
| U10 | 289 | 400 | `"URL_CONTENT_TOO_LARGE"` | /ingest-url body > 10 MB | No |
| U11 | 291 | 400 | `"NO_TEXT_CONTENT"` | /ingest-url produced zero text | No |
| U12 | 292 | 400 | `f"Failed to fetch URL: {code}"` ⚠️ | other /ingest-url ValueError | No |
| U13 | 295 | 400 | `"Failed to fetch URL"` ⚠️ | /ingest-url generic Exception | No |
| U14 | 306, 339 | 400 | `{"error":"FILE_TOO_LARGE","max_mb":N}` | /ingest-url post-fetch size | **Yes** |
| U15 | 410 | 502 | `"Storage service unavailable"` ⚠️ | MinIO presign failed | No |
| U16 | 494 | 409 | `"Document is still processing"` ⚠️ | file-url requested before parse done | No |
| U17 | 541 | 400 | `"Instructions too long (max 2000 chars)"` ⚠️ | custom_instructions length | No |
| U18 | 546 | 403 | `"Custom instructions require Pro plan"` ⚠️ | custom_instructions without Pro | **Yes** |

### 2.2 Chat / session path (`backend/app/api/chat.py` + `services/chat_service.py`)

| # | Line | HTTP / SSE | `detail` / `code` | Trigger | Plan-gated? |
|---|---|---|---|---|---|
| C1 | chat.py:118 | 403 | `{"message":"Free plan session limit reached…","limit":N}` ⚠️ no machine code | >FREE_MAX_SESSIONS_PER_DOC (3) | **Yes** |
| C2 | chat.py:131 | 429 | `{"message":"Too many demo sessions created","retry_after":300}` ⚠️ | demo-session IP limiter | No |
| C3 | chat.py:141 | 429 | `{"message":"Demo session limit reached","limit":500}` ⚠️ | per-doc demo session cap | No |
| C4 | chat.py:214 | 409 | `{"message":"Document is still being processed","status":...}` ⚠️ | doc.status ≠ ready | No |
| C5 | chat.py:224, 232, 315, 321 | 429 | `{"message":"Rate limit exceeded","retry_after":60}` | 10/min demo OR 30/min authed | No |
| C6 | chat.py:244, 334 | 429 | `{"message":"Demo message limit reached","limit":5}` | DEMO_MESSAGE_LIMIT | No |
| C7 | chat.py:259, 369 | 402 | `{"message":"Insufficient credits","required":N,"balance":N}` ⚠️ no code | pre-check balance < estimated | No |
| C8 | chat.py:358 | 400 | `"Maximum continuations reached"` ⚠️ | ≥ MAX_CONTINUATIONS_PER_MESSAGE (3) | No |
| C9 | chat_service.py:291, 698 | SSE `error` | `{"code":"MODE_NOT_ALLOWED","message":...}` | `mode=thorough` on Free plan | **Yes** |
| C10 | chat_service.py:311, 716 | SSE `error` | `{"code":"INSUFFICIENT_CREDITS","message":...,"required":N,"balance":N}` | atomic debit failed mid-stream | No |
| C11 | chat_service.py:448, 830 | SSE `error` | `{"code":"CHAT_SETUP_ERROR"\|"RETRIEVAL_ERROR"\|"LLM_ERROR"\|"ACCOUNTING_ERROR"\|"PERSIST_FAILED","message":...}` | already structured (good) | No |

### 2.3 Collections (`backend/app/api/collections.py`)

| # | Line | HTTP | `detail` | Trigger | Plan-gated? |
|---|---|---|---|---|---|
| COL1 | 124 | 403 | `f"Your plan allows up to {max} collections. Upgrade for more."` ⚠️ string | > FREE=1 / PLUS=5 / PRO=999 | **Yes** |
| COL2 | 264 | 403 | `f"Your plan allows up to {max} documents per collection. Upgrade for more."` ⚠️ string | > FREE=3 / PLUS=10 / PRO=999 per coll. | **Yes** |

### 2.4 Export (`backend/app/api/export.py`)

| # | Line | HTTP | `detail` | Trigger | Plan-gated? |
|---|---|---|---|---|---|
| E1 | 73 | 403 | `"PDF/DOCX export requires Plus or Pro plan"` ⚠️ string | free plan + pdf/docx | **Yes** |
| E2 | 120 | 400 | `str(e)` ⚠️ | render validation | No |
| E3 | 127 | 500 | `str(e)` ⚠️ | renderer crash | No |

### 2.5 Sharing (`backend/app/api/sharing.py`)

| # | Line | HTTP | `detail` | Trigger | Plan-gated? |
|---|---|---|---|---|---|
| SH1 | 74 | 403 | `"Free plan limited to 3 active share links. Upgrade to Plus for unlimited."` ⚠️ string | >3 active, Free plan | **Yes** |
| SH2 | 122 | 429 | `{"message":"Too many requests","retry_after":60}` | public-share IP limiter | No |
| SH3 | 137 | 410 | `"Share link has expired"` | expires_at < now | No |

### 2.6 Auth / admin / billing

- `deps.py:72` → 401 `"Authentication required"` (already handled implicitly by proxy/login redirect).
- `deps.py:82` → 403 `"Admin access required"` (out of scope — admin UI only).
- `billing.py` (27+ HTTPException call sites) — all surface in `BillingPageClient.tsx`; already structured enough for that surface, but several detail strings (e.g. `"You are already on this plan"`, `"Stripe temporarily unavailable…"`) are raw English prose. Scope note: billing surface is out of scope for this fix (user is on plan-limit/upload UX); we will only *not regress* it. A full billing-error sweep is a follow-up.

### 2.7 Parse worker (`backend/app/workers/parse_worker.py`)

Asynchronous — result surfaces as `Document.status="error"` + `Document.error_msg` string. Frontend polls `GET /api/documents/{id}` and reads `info.error_msg` in `useDocumentLoader.ts:68`. Currently the worker writes free-form English. Recommend we standardize the enum set but keep backward compat (see §5 B3).

---

## 3. Frontend Current Behavior (the bug surface)

| Surface | File | What it does | Problem |
|---|---|---|---|
| Upload (File) | `HomePageClient.tsx:342-345` | `catch { setProgressText(t('upload.networkError')) }` | ⚠️ **Eats every 4xx/5xx.** DOCUMENT_LIMIT_REACHED, FILE_TOO_LARGE, UNSUPPORTED_FORMAT, INVALID_FILE_CONTENT all render as "check network". This is the primary user-visible regression that started this work. |
| Upload (URL) | `HomePageClient.tsx:376-384` | Substring match on `URL_CONTENT_TOO_LARGE` / `NO_TEXT_CONTENT` | Half-done: misses DOCUMENT_LIMIT_REACHED, FILE_TOO_LARGE (post-fetch), BLOCKED_HOST, DNS_RESOLUTION_FAILED, etc. All fall to generic `upload.urlError`. |
| Chat stream | `useChatStream.ts:95-118` | Matches `HTTP 402` / `HTTP 409` / `HTTP 429` | Works, but parses English prose. Missing: MODE_NOT_ALLOWED (SSE event path — currently no UI distinction from generic error), insufficient-credits during stream (C10) vs pre-check (C7) — both need the same paywall trigger but currently only 402 does. |
| Custom instructions | doc settings surface | Not audited in this pass; surfaces `"Custom instructions require Pro plan"` as raw text | Out of scope this round — flag in follow-up. |
| Export | `components/Export/*` | Not audited | Likely raw `HTTP 403: PDF/DOCX export requires…` shown. Flag follow-up. |
| Doc processing | `useDocumentLoader.ts:68` | `setError(info.error_msg \|\| t('upload.error'))` | Raw worker English string. |

Additionally `api.ts:9` throws `new Error(\`HTTP ${res.status}: ${text}\`)` — `text` is already JSON-stringified detail. The frontend has to **parse JSON out of an Error.message**, which is fragile.

---

## 4. Root Cause (why the bug exists)

1. Backend uses **three different shapes** for `detail`: bare English strings, `{error: CODE, ...}` objects, and `{message: STR, ...}` objects. Nothing enforces consistency.
2. Frontend `handle()` in `api.ts:7-13` discards the HTTP status and stringifies the body into an `Error.message`. Callers have to substring-match JSON fragments. Every call-site reinvents this poorly.
3. There's no single source of truth for "which HTTP/code → which user-facing copy in 11 locales."

---

## 5. Proposed Fix (what to build)

### A. Backend: canonicalize `detail` into a single shape

For every user-facing `HTTPException` listed in §2, migrate to:

```python
raise HTTPException(status_code=<status>, detail={
    "error": "<UPPER_SNAKE_CODE>",
    "message": "<server-side English fallback>",   # optional, logs only
    **<code-specific context fields>
})
```

**Code enum** (final list — every row in §2 maps to one):

| Code | HTTP | Context fields | From §2 rows |
|---|---|---|---|
| `UNSUPPORTED_FORMAT` | 400 | `allowed:[str]` | U1 |
| `DOCUMENT_LIMIT_REACHED` | 403 | `limit:int, current:int, plan:str` | U2, U8 |
| `FILE_TOO_LARGE` | 400 | `max_mb:int, plan:str` | U3, U14 |
| `INVALID_FILE_CONTENT` | 400 | — | U4 |
| `URL_INVALID_SCHEME` | 400 | — | U6 |
| `URL_BLOCKED_HOST` | 400 | — | U9 subset |
| `URL_BLOCKED_PORT` | 400 | — | U9 subset |
| `URL_DNS_FAILED` | 400 | — | U9 subset |
| `URL_REDIRECT_LOOP` | 400 | — | U9 subset |
| `URL_TOO_MANY_REDIRECTS` | 400 | — | U9 subset |
| `URL_FETCH_FAILED` | 400 | — | U12, U13 |
| `URL_CONTENT_TOO_LARGE` | 400 | — | U10 |
| `NO_TEXT_CONTENT` | 400 | — | U11 |
| `STORAGE_UNAVAILABLE` | 502 | — | U15 |
| `DOCUMENT_PROCESSING` | 409 | `status:str` | U16, C4 |
| `INSTRUCTIONS_TOO_LONG` | 400 | `max:int` | U17 |
| `CUSTOM_INSTRUCTIONS_REQUIRE_PRO` | 403 | — | U18 |
| `SESSION_LIMIT_REACHED` | 403 | `limit:int, plan:str` | C1 |
| `DEMO_SESSION_RATE_LIMITED` | 429 | `retry_after:int` | C2 |
| `DEMO_SESSION_LIMIT_REACHED` | 429 | `limit:int` | C3 |
| `RATE_LIMITED` | 429 | `retry_after:int` | C5 |
| `DEMO_MESSAGE_LIMIT_REACHED` | 429 | `limit:int` | C6 |
| `INSUFFICIENT_CREDITS` | 402 | `required:int, balance:int` | C7 + matches existing SSE C10 |
| `MAX_CONTINUATIONS_REACHED` | 400 | `max:int` | C8 |
| `MODE_NOT_ALLOWED` | — (SSE only) | `mode:str, required_plan:str` | C9 |
| `COLLECTION_LIMIT_REACHED` | 403 | `limit:int, plan:str` | COL1 |
| `COLLECTION_DOC_LIMIT_REACHED` | 403 | `limit:int, plan:str` | COL2 |
| `EXPORT_REQUIRES_PAID_PLAN` | 403 | `format:str, required_plans:[str]` | E1 |
| `EXPORT_VALIDATION_FAILED` | 400 | `reason:str` | E2 |
| `EXPORT_RENDERER_FAILED` | 500 | — | E3 |
| `SHARE_LIMIT_REACHED` | 403 | `limit:int, plan:str` | SH1 |
| `SHARE_EXPIRED` | 410 | — | SH3 |

**Back-compat:** the frontend already hard-matches string `"URL_CONTENT_TOO_LARGE"` / `"NO_TEXT_CONTENT"`. Since the new detail is `{"error":"URL_CONTENT_TOO_LARGE",…}`, a substring search on the stringified body still matches — no breakage during rollout. Same for existing SSE `code` consumers.

### B. Frontend: one mapper, one caller pattern

**B1.** Replace `api.ts:7-13` `handle<T>()` to throw a typed `ApiError`:

```ts
export class ApiError extends Error {
  constructor(public status: number, public code: string | null, public detail: Record<string, unknown>, public raw: string) {
    super(`HTTP ${status}: ${code ?? raw.slice(0,120)}`);
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
      // FastAPI wraps HTTPException.detail under `detail`
      const d = parsed?.detail ?? parsed;
      if (d && typeof d === 'object') {
        detail = d as Record<string, unknown>;
        code = typeof d.error === 'string' ? d.error : null;
      }
    } catch { /* non-JSON body — code stays null */ }
    throw new ApiError(res.status, code, detail, raw);
  }
  return res.json();
}
```

**B2.** Create `frontend/src/lib/errorCopy.ts`:

```ts
export interface ErrorCopy {
  title: string;
  body: string;
  cta?: { label: string; href: string };   // e.g., upgrade
  severity: 'error' | 'warning' | 'info';
}

export function errorCopy(err: unknown, t: TFn, tOr: TOrFn): ErrorCopy { … }
```

The mapper switches on `ApiError.code` first, falls back to `ApiError.status`, finally to a generic network copy. Each known code has an i18n key `errors.<code>.title/body` with English fallback via `tOr`.

**B3.** Call-sites change:
- `HomePageClient.tsx:342-345` — replace blind `upload.networkError` with `errorCopy(e, t, tOr)`; show `.title` in `setProgressText` (and optionally `.cta` as a button in a follow-up).
- `HomePageClient.tsx:376-384` — drop the bespoke substring matching, reuse mapper.
- `useChatStream.ts:88-130` — reuse mapper for non-SSE HTTP failures; keep existing SSE `code` handling (already structured).
- `useDocumentLoader.ts:68` — if `info.error_msg` matches a known worker-error enum (future §5 B3 follow-up), run through mapper; else keep current fallback.

**B4.** i18n: add `errors.<code>.title/body` keys to `en.json` only; other 10 locales get them via `tOr()` fallback (per CLAUDE.md convention). No locked-in translations this round.

### C. Minimal-risk migration order (do not break prod)

1. Backend codes — **additive** change. All new rows return `{error, ...}` detail. Existing substring-match callers still work because the code string still appears in the stringified body.
2. Frontend `ApiError` — replace `handle()`. Every existing `catch (e: any)` still works since `ApiError extends Error`. No behavior change without B3.
3. Frontend mapper + B3 call-site swap in **one** PR with UX tests for the four hot paths (upload-file / upload-url / chat / doc-load).
4. Remove the now-dead substring matching in `HomePageClient.tsx:378-383` and `useChatStream.ts:95,110,114`.

### D. Test matrix

Per code, write one backend test asserting `response.status_code + response.json()["detail"]["error"]`, and one frontend unit test that feeds an `ApiError` into `errorCopy()` and asserts the rendered title.

Hot-path integration:
- Upload → `POST /api/documents/upload` with `mock user.plan="free"` and 3 existing docs → expect `403 + detail.error="DOCUMENT_LIMIT_REACHED"` and UI shows "You've reached the 3-document limit on Free. Delete a document or upgrade." with an Upgrade CTA.
- Upload → 30 MB PDF on free → `FILE_TOO_LARGE`, message includes "25 MB" from `detail.max_mb`.
- Ingest-url → `http://127.0.0.1:80` → `URL_BLOCKED_HOST` (don't leak the exact reason phrase).
- Ingest-url → HTML with only images → `NO_TEXT_CONTENT`.
- Chat → free plan, thorough mode → SSE `MODE_NOT_ALLOWED`, UI prompts upgrade.
- Chat → balance=0 → 402 → paywall triggers as today (behavior unchanged).
- Collection create → 2nd on free → `COLLECTION_LIMIT_REACHED`.
- Export pdf on free → `EXPORT_REQUIRES_PAID_PLAN`.
- Share ×4 on free → `SHARE_LIMIT_REACHED`.

---

## 6. Open Questions for Codex

1. **Enum naming.** `INSUFFICIENT_CREDITS` already exists in SSE. Should HTTP 402 emit the **same** code, or keep HTTP and SSE channels separate for future divergence? (Proposal: same code — one switch in the mapper.)
2. **Per-code vs per-status CTA.** Paywall CTA is currently triggered on `HTTP 402` in `useChatStream.ts:95`. Should every `403 + <PLAN_LIMIT>` code also auto-open paywall, or only add an "Upgrade" button inside the inline error? (Proposal: inline CTA only; auto-opening paywall on every plan-limit 403 is too aggressive and interrupts the current user flow.)
3. **`str(ValueError)` leak risk.** Lines U5, U7, E2, E3 currently return the raw exception string to the client. That can leak internals (e.g., SQL column names from a bad insert). Should we gate those behind a generic `SERVER_ERROR`/`VALIDATION_ERROR` code and only log details server-side? (Proposal: yes — any 4xx from a service-layer ValueError must be mapped to a known enum or to `VALIDATION_ERROR` with no raw message passed to the client.)
4. **Worker errors (U parse path).** `Document.error_msg` is raw English written by Celery. Do we change that *now* (adds scope) or note it as a follow-up and keep `useDocumentLoader.ts:68` falling through to `t('upload.error')` when `error_msg` isn't a known code? (Proposal: follow-up PR — out of scope for this one to keep blast radius small.)
5. **Billing.** Large number of HTTPException sites in `billing.py`. Full rewrite now, or scope this PR to non-billing surfaces and handle billing in a separate review? (Proposal: scope out — billing has its own dedicated UI surface and different stakeholder; a targeted billing-error PR later.)
6. **Back-compat guard.** The substring-match fallbacks in current frontend (e.g., `msg.includes('URL_CONTENT_TOO_LARGE')`) continue to work with the new detail shape. But what's the risk that some *other* consumer (mobile app, CLI, Sentry dashboard filters) depends on the current English prose? (Proposal: grep the repo for consumers — none found; document the wire change in `ARCHITECTURE.md §10`.)
7. **Should `CUSTOM_INSTRUCTIONS_REQUIRE_PRO` and `EXPORT_REQUIRES_PAID_PLAN` collapse into one generic `FEATURE_REQUIRES_PLAN` with a `feature:str, required_plan:str` field?** (Proposal: yes — one code, cleaner mapper, and the frontend already knows how to format "Feature X requires Plan Y".)

---

## 7. Non-Goals / Deliberate Omissions

- Changing any numeric limit.
- Presigned/chunked/resumable uploads.
- Paywall redesign.
- Billing error copy sweep.
- Parse-worker error code enum (follow-up).
- Translating error copy into 10 non-English locales (`tOr` fallback is deliberate this round).

---

## 8. Tasks (post-consensus)

_Filled after Codex consensus; placeholder so the plan is executable as-is._

- [ ] T1: Backend — migrate every `HTTPException` in §2 to `{error, ...}` shape. Unit tests per code.
- [ ] T2: Frontend — add `ApiError` + replace `handle()` in `api.ts`. No UI changes yet.
- [ ] T3: Frontend — `errorCopy.ts` mapper + en.json error keys.
- [ ] T4: Frontend — swap call-sites: `HomePageClient` (file + url), `useChatStream`, `useDocumentLoader`.
- [ ] T5: Integration tests for the hot-path matrix in §5 D.
- [ ] T6: `ARCHITECTURE.md §10` entry documenting the wire contract.
- [ ] T7: Manual QA (`/deploy` preview) — trigger each hot-path and verify copy.
