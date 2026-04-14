**REQUEST_CHANGES** — two acceptance checks are still incomplete.

1. `frontend/src/lib/api.ts:93` still throws plain `Error` on an `errorCopy()` path.
Path: `uploadDocument()` failure on `/api/upload-token` bubbles to `HomePageClient` catch (`errorCopy(e, ...)`), so `status/code/detail` are still lost.

```diff
diff --git a/frontend/src/lib/api.ts b/frontend/src/lib/api.ts
@@
-  if (!tokenRes.ok) {
-    throw new Error(`Failed to get upload token: ${tokenRes.status}`);
-  }
+  if (!tokenRes.ok) await throwApiError(tokenRes);
```

2. `backend/tests/test_error_taxonomy.py:867` is not byte-for-byte; it compares parsed JSON objects.
Current assertion is semantic (`.json() == .json()`), not body-exact as requested.

```diff
diff --git a/backend/tests/test_error_taxonomy.py b/backend/tests/test_error_taxonomy.py
@@
-    assert resp_missing.json() == resp_found.json(), "404 body diverges → enumeration oracle"
+    assert resp_missing.text == resp_found.text, "404 body diverges → enumeration oracle"
```

Checks that do pass:
- `handle()` happy path still returns `res.json()` when `res.ok` is true.
- `getBillingErrorMessage` now handles structured `detail.message` (including beta interval text), arbitrary `detail.message`, legacy `{"detail":"..."}` regex fallback, and null/undefined fallback.
- `test_chat_service_mode_not_allowed_sse_emits_required_plan` asserts both `code` and `required_plan`.
- `test_search_rate_limited` and `test_chunks_rate_limited` assert both `RATE_LIMITED` and `Retry-After`.
