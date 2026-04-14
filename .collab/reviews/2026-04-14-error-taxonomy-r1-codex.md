REQUEST_CHANGES

## Must fix

1. Inventory is not exhaustive despite claiming exhaustive grep.
- Claim says "Exhaustive grep of HTTPException + SSE error events + Celery doc.status='error' writes" at `.collab/plans/2026-04-14-error-taxonomy-plan.md:26`.
- Missed SSE `error` codes in `backend/app/services/chat_service.py`: `SESSION_NOT_FOUND` at lines 251 and 637, `MESSAGE_NOT_FOUND` at 675 and 679, `CONTINUATION_LIMIT` at 684.
- Missed HTTPException families in scoped files:
`backend/app/api/chat.py:109,181,210,301,355,409,464` (404 paths) and `backend/app/api/chat.py:305` (second 409 processing path),
`backend/app/api/documents.py:376,378,395,397,401,432,434,492,515,518,538` (404 variants),
`backend/app/api/collections.py:175,205,221,292,313,336` (404),
`backend/app/api/sharing.py:44,105,133,145` (404),
`backend/app/api/export.py:68` (404).
- Missed user-facing routers entirely:
`backend/app/api/search.py:32,39,41`, `backend/app/api/chunks.py:28,36,41,44`, `backend/app/api/users.py:377,387,401,409`.
- Worker section is not enumerated: `backend/app/workers/parse_worker.py` writes 13 distinct `error_msg` values plus timeout path (`_set_timeout_error` at 52-67). §2.7 only states this generically.

2. Back-compat claim is not robust; current migration order introduces silent regressions.
- Plan claims substring consumers remain safe because code appears in JSON (`.collab/plans/2026-04-14-error-taxonomy-plan.md:176`) and "no behavior change" after `ApiError` swap (`:236`). Not true for existing non-code string consumers.
- Billing parser depends on raw JSON in `Error.message`: `frontend/src/app/billing/BillingPageClient.tsx:157-166`. If `ApiError.message` becomes `HTTP <status>: <code>`, this silently degrades to generic billing error.
- 429 copy branch depends on English phrase `Rate limit exceeded`: `frontend/src/lib/useChatStream.ts:110-115`. If backend stops sending that phrase (as plan proposes), authenticated rate-limit errors get misclassified as demo-limit text.

Proposed compatibility diff (keep legacy message contract until all consumers are migrated):

```diff
--- a/frontend/src/lib/api.ts
+++ b/frontend/src/lib/api.ts
@@
 export class ApiError extends Error {
   constructor(
     public status: number,
     public code: string | null,
     public detail: Record<string, unknown>,
     public raw: string,
   ) {
-    super(`HTTP ${status}: ${code ?? raw.slice(0,120)}`);
+    // Preserve old message contract for transitional substring consumers.
+    super(`HTTP ${status}: ${raw}`);
     this.name = 'ApiError';
   }
 }
```

3. Plan assumes existing SSE code handling exists, but it does not.
- Plan says in B3: "keep existing SSE `code` handling" (`.collab/plans/2026-04-14-error-taxonomy-plan.md:228`).
- Current stream error handler ignores `code` and only inspects `message`: `frontend/src/lib/useChatStream.ts:64-130`.
- This means structured SSE codes (`MODE_NOT_ALLOWED`, `INSUFFICIENT_CREDITS`, `CONTINUATION_LIMIT`) are still not reliably mapped even after backend cleanup.

Proposed diff (normalize HTTP + SSE paths by code first):

```diff
--- a/frontend/src/lib/useChatStream.ts
+++ b/frontend/src/lib/useChatStream.ts
@@
-  const getErrorMessage = useCallback((err: unknown): string => {
-    if (typeof err === 'object' && err && 'message' in err) {
-      return String((err as { message?: unknown }).message || '');
-    }
-    return '';
-  }, []);
+  const getErrorMeta = useCallback((err: unknown): { message: string; code: string | null; status: number | null } => {
+    if (typeof err === 'object' && err) {
+      const anyErr = err as Record<string, unknown>;
+      return {
+        message: String(anyErr.message || ''),
+        code: typeof anyErr.code === 'string' ? anyErr.code : null,
+        status: typeof anyErr.status === 'number' ? anyErr.status : null,
+      };
+    }
+    return { message: '', code: null, status: null };
+  }, []);
@@
-    const errorMessage = getErrorMessage(err);
+    const { message: errorMessage, code, status } = getErrorMeta(err);
 
-    if (errorMessage.includes('HTTP 402')) {
+    if (status === 402 || code === 'INSUFFICIENT_CREDITS' || code === 'MODE_NOT_ALLOWED') {
       onShowPaywall();
       return;
     }
@@
-    if (errorMessage.includes('HTTP 429')) {
+    if (status === 429 || code === 'RATE_LIMITED' || code === 'DEMO_SESSION_RATE_LIMITED' || code === 'DEMO_MESSAGE_LIMIT_REACHED') {
       addMessage({
         id: `m_${Date.now()}_limit`,
         role: 'assistant',
-        text: errorMessage.includes('Rate limit exceeded') ? t('demo.rateLimitMessage') : t('demo.limitReachedMessage'),
+        text: code === 'RATE_LIMITED' || errorMessage.includes('Rate limit exceeded')
+          ? t('demo.rateLimitMessage')
+          : t('demo.limitReachedMessage'),
         createdAt: Date.now(),
       });
       return;
     }
```

4. Scope definition is internally inconsistent and creates rollout footguns.
- Plan says export/custom-instructions are out-of-scope in §3 and §7 (`.collab/plans/2026-04-14-error-taxonomy-plan.md:109-110,269-276`) but includes `U17/U18/E1-E3` in enum and tests (`:158-173`, `:252`).
- Frontend call-sites for those surfaces are not included in B3 (`:225-230`).
- Concrete gap examples:
`frontend/src/lib/api.ts:287-294` (`exportSession`) bypasses `handle()` and throws custom string,
`frontend/src/components/CustomInstructionsModal.tsx:71-90` has no catch/UI messaging at all when `onSave` fails,
`frontend/src/components/Chat/ChatPanel.tsx:186-202` just `alert()`s raw export failure.

5. Security model needs explicit guardrails before codifying enums.
- Exposing detailed SSRF reasons (`URL_BLOCKED_HOST`, `URL_DNS_FAILED`, `URL_BLOCKED_PORT`) as user-facing copy risks turning ingest into a network-probing oracle. Source reason emitters: `backend/app/core/url_validator.py:59-99`, redirect/path failures in `backend/app/services/extractors/url_extractor.py:98-120`.
- `VALIDATION_ERROR` defaulting all unknown `ValueError` to 4xx is unsafe. Unknown exceptions from dependencies should not be labeled user fault. Preserve allowlist mapping; unknown -> 500 generic code with server-side log.
- Do not split existence vs authorization in public resources. Current 404-masking pattern in docs/sessions (`backend/app/api/documents.py:376-378`, `backend/app/api/chat.py:208-210`) is correct and must be preserved.

6. Test matrix is materially incomplete for the stated migration risk.
- Missing tests for SSE error codes that are currently emitted and currently mishandled: `SESSION_NOT_FOUND`, `MESSAGE_NOT_FOUND`, `CONTINUATION_LIMIT` (`backend/app/services/chat_service.py:251,637,675,679,684`).
- Missing regression tests for existing billing/string consumers that will be impacted by `ApiError` message contract (`frontend/src/app/billing/BillingPageClient.tsx:157-166`).
- Missing coverage for chat continue 409 path (`backend/app/api/chat.py:305-308`) and message-not-found path (`:355`).
- Missing coverage for search/chunk anonymous 429 (`backend/app/api/search.py:32`, `backend/app/api/chunks.py:28`) if taxonomy claims platform-wide consistency.
- Missing transitional compatibility test proving old `msg.includes('URL_CONTENT_TOO_LARGE')` and old 429 phrase logic still behave during phased rollout.

## Should fix

1. Normalize enum naming collisions before implementation.
- Current plan has both HTTP `MAX_CONTINUATIONS_REACHED` (`.collab/plans/2026-04-14-error-taxonomy-plan.md:166`) and SSE `CONTINUATION_LIMIT` (actual code at `backend/app/services/chat_service.py:684`). Pick one canonical code and alias the other during transition.

2. Decide and document what fields are contract vs non-contract.
- `message` is called "optional, logs only" in plan (`.collab/plans/2026-04-14-error-taxonomy-plan.md:134`) but many frontend paths currently read message text. Mark `message` as non-authoritative but keep it present for one deprecation window.

3. Worker-error strategy needs an explicit forward-compatible bridge.
- If parse-worker remains follow-up, add a temporary parser contract now (`error_msg` supports either free-text or `ERR_CODE:<CODE>` prefix) so frontend can migrate without another breaking wire change.

## Nit

1. Line references in inventory are already stale/inexact in places (for example chat 429 second branch is at `backend/app/api/chat.py:322`, not `:321` in plan).

2. `URL_INVALID_SCHEME` and existing backend code `INVALID_URL_SCHEME` are close enough to cause accidental dual-code drift. Prefer one canonical identifier.

3. §5 B3 says use mapper in `useDocumentLoader.ts` conditionally for known worker enums, but no list of known worker enums is defined in this plan.

## Positions on open questions

1. `INSUFFICIENT_CREDITS` code reuse across HTTP and SSE: **Agree with reuse.**
- Same user action and same remediation path (upgrade/top-up). Keep one code, distinguish channel with transport metadata if needed.

2. Auto-open paywall on every plan-gated 403: **Disagree with auto-open.**
- Keep current modal auto-open for 402 and `MODE_NOT_ALLOWED`; for 403 plan limits use inline CTA first. This avoids modal thrash in upload/collection/share flows.

3. Raw `str(ValueError)` leakage: **Agree with sanitization, but not blanket `VALIDATION_ERROR`.**
- Use allowlisted mappings to known enums. Unknown/uncategorized errors should become 500 generic code, not 400.

4. Worker errors now vs later: **Partial disagree with full deferral.**
- Full worker refactor can be follow-up, but this PR should add a bridge contract so frontend migration does not require a second taxonomy rewrite.

5. Billing scope: **Disagree with full scope-out if `handle()` changes globally.**
- Either keep legacy `Error.message` contract in `ApiError` for compatibility or patch billing call-sites in the same PR.

6. Back-compat risk for other consumers: **Agree risk is real; current plan is insufficient.**
- Beyond repo grep, add explicit wire-contract note and deprecation window. Preserve old-readable fields at least one release.

7. Collapse `CUSTOM_INSTRUCTIONS_REQUIRE_PRO` + `EXPORT_REQUIRES_PAID_PLAN` to `FEATURE_REQUIRES_PLAN`: **Disagree for now.**
- Keep feature-specific codes for analytics, targeted copy, and safer rollout. You can still share formatter logic by code-grouping on frontend.
