REQUEST_CHANGES

## r1 Must/Should closure check

| r1 item | Status | v2 evidence |
|---|---|---|
| Must 1: inventory exhaustive | RESOLVED | §2.1–§2.7 now includes missing 404 families, `search/chunks/users`, SSE codes, and parse-worker inventory. |
| Must 2: back-compat claim robustness | PARTIALLY RESOLVED | Billing/message contract fix is correct in §5.B1 (`ApiError.message = HTTP <status>: <raw>`). But chat 402/409/429 compatibility still has a gap (see blocker below). |
| Must 3: SSE code handling absent in frontend | PARTIALLY RESOLVED | §5.B3 adds code/status-aware handling, but pre-stream HTTP errors still arrive as `http_error` strings from `sse.ts` unless that file is updated. |
| Must 4: scope inconsistency (export/custom-instructions) | RESOLVED | Included in §0 row 4, §5.B5, §8 T5. |
| Must 5: security guardrails | RESOLVED | SSRF collapse + unknown `ValueError -> 500 SERVER_ERROR` + 404 masking called out in §5.A. |
| Must 6: test matrix gaps | RESOLVED (plan-level) | §5.D now explicitly covers SSE missing codes, chat continue 409, billing regex regression, search/chunks 429, transitional compatibility. |
| Should 1: continuation code collision | RESOLVED | §0 row 7 + §2.2 C8/C12 use canonical `CONTINUATION_LIMIT`. |
| Should 2: `message` contract clarity | RESOLVED | §5.A contract note defines `error` authoritative, `message` kept for deprecation window. |
| Should 3: worker bridge contract | RESOLVED | §2.7 + §5.B4 define `ERR_CODE:<CODE>:<fallback>` with legacy fallback behavior. |

## Still-open Must-fix (blocking)

1. `useChatStream` v2 logic needs structured HTTP metadata from `sse.ts`.
- Gap: §5.B3 routes by `status`/`code`, but current `frontend/src/lib/sse.ts` emits pre-stream HTTP failures as `{ code: "http_error", message: "HTTP <status>: <raw>" }` and drops backend `detail.error`.
- Regression risk: 402/409/429 from `/chat` and `/chat/continue` can miss paywall/processing/rate-limit branches.

Concrete diff:

```diff
--- a/frontend/src/lib/sse.ts
+++ b/frontend/src/lib/sse.ts
@@
-type ErrorPayload = { code: string; message: string };
+type ErrorPayload = { code: string; message: string; status?: number };
@@
-  if (!res.ok || !res.body) {
+  if (!res.ok || !res.body) {
     if (signal?.aborted) return;
-    const msg = await res.text().catch(() => '');
-    onError({ code: 'http_error', message: `HTTP ${res.status}: ${msg}` });
+    const raw = await res.text().catch(() => '');
+    let code = 'http_error';
+    let message = `HTTP ${res.status}: ${raw}`;
+    try {
+      const parsed = JSON.parse(raw);
+      const d = parsed?.detail ?? parsed;
+      if (d && typeof d === 'object') {
+        const detail = d as Record<string, unknown>;
+        if (typeof detail.error === 'string') code = detail.error;
+        if (typeof detail.message === 'string') message = detail.message;
+      }
+    } catch {}
+    onError({ code, message, status: res.status });
     return;
   }
```

(Apply the same change in both `chatStream` and `continueStream` non-OK branches.)

## New-v2 additions sanity

- `ApiError.message` preservation trick: sound and necessary for migration window.
- Parse-worker `ERR_CODE:<CODE>:<text>` bridge: sound direction. Add one guard in implementation to avoid accidental double-prefixing (e.g., helper that no-ops if message already starts with `ERR_CODE:`).

## Still-missing critical tests before merge

1. `frontend/src/lib/sse.ts` unit tests for non-OK chat responses verifying emitted `{ status, code }` from JSON `detail.error` and fallback `http_error` on non-JSON.
2. `useChatStream` tests proving 402/409/429 still route correctly when error originates from SSE HTTP preflight path (not only SSE `event:error`).
3. Parse-worker bridge tests for legacy message fallback and malformed prefix handling (e.g., `ERR_CODE:bad`), not only happy-path prefixed errors.

## Out-of-scope decisions

Accepted as out-of-scope for this PR: billing full taxonomy migration, full worker refactor, 10-locale translation pass, `deps.py` admin-only errors. None of these should block this PR once the SSE HTTP metadata gap above is closed.
