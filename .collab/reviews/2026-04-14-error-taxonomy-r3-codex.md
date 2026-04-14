APPROVE

## Closure check

- r2 blocker — `sse.ts` pre-stream HTTP metadata propagation (`detail.error`/`status`): **APPROVE** (covered in §8b B3b, includes both `chatStream` and `continueStream`, plus `ErrorPayload.status`)
- r2 safety net — parse-worker helper to avoid double `ERR_CODE:` prefix: **APPROVE** (covered in §8b B4b via `_set_doc_error`)
- r2 safety net — additional regression tests (SSE HTTP path + `useChatStream` preflight + parse-worker legacy/malformed): **APPROVE** (covered in §8b D2)

## Ready to implement — follow-up-only notes

- Keep `_set_doc_error` idempotent in implementation and test it directly (single call vs repeated call on already-prefixed text).
- In `sse.ts` tests, assert both `code` and `status` are preserved from JSON `detail` on non-OK responses.
