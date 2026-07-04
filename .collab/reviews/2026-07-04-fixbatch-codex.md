# DocTalk v0.22.0 fix batch adversarial review - Codex

Date: 2026-07-04
Scope: uncommitted working tree, targeted at the fix batch for `.collab/reviews/2026-07-04-project-audit-codex.md`.
Constraint followed: no git commands.

## Verdict

REVISE.

I do not see a release-blocking flaw in the two highest-risk fixes, auth or billing. The magic-link interstitial closes the raw-token prefetch problem without an open-redirect bypass found in this pass, and citation-focus usage is now folded into the original chat reconciliation rather than double-debited.

The batch is still not fully ship-ready because one public SEO blog page still advertises stale Free-plan limits.

## Findings

### P2 - Public Free-plan copy is still stale

Required before ship.

- `frontend/content/blog/free-ai-pdf-chat-no-signup.md:65` still says Free gets `500` credits per month.
- `frontend/content/blog/free-ai-pdf-chat-no-signup.md:67` still says max file size is `25 MB`.
- `frontend/content/blog/free-ai-pdf-chat-no-signup.md:110` still compares DocTalk as `500 credits (~50+ questions)`.

Current contract in the project guide and UI copy is Free = 300 credits/month, 3 documents, 50 MB. This is public product/SEO copy, so the 25MB -> 50MB and 500 -> 300 cleanup is incomplete even though the two previously named feature SEO pages were fixed.

## Auth Review

Magic-link wrapper looks sound for the named attack classes.

- `frontend/src/lib/auth.ts:53-64` wraps only the Resend email URL as `{origin}/auth/confirm?cb=<raw Auth.js callback>`. OAuth providers still use the normal `signIn(provider, { callbackUrl })` path, so Google/Microsoft are not disturbed.
- `frontend/src/lib/auth.ts:93-98` passes `confirmUrl.toString()` to the existing email template.
- `frontend/src/lib/emailTemplate.ts:73` renders the wrapped URL in the HTML CTA, and `frontend/src/lib/emailTemplate.ts:139` renders the same wrapped URL in plain text.
- `frontend/src/app/auth/confirm/page.tsx:23-29` parses `cb` with `new URL(cb, origin)`, checks exact same origin, then requires a normalized pathname starting with `/api/auth/callback/`.
- `frontend/src/app/auth/confirm/page.tsx:56-60` only redeems the token on button click via `window.location.assign(target)`. There is no auto-redirect on page load.
- `frontend/src/app/auth/layout.tsx:9` keeps auth pages noindex.

I tested URL parser behavior for protocol-relative URLs, backslashes, dot-segment traversal, encoded dot segments, double-encoded slashes, and confirm-self loops. The parser normalizes before the prefix check; those cases either change origin or normalize out of `/api/auth/callback/` and are rejected. A URL like `/api/auth/callback/resend?callbackUrl=https://evil.com` passes this wrapper guard, but that is the legitimate Auth.js callback endpoint; external final redirects remain governed by Auth.js' redirect policy, not this interstitial. No new wrapper open-redirect bypass found.

Residual risk: a scanner that executes JavaScript and actively clicks the button can still consume the token. This fix removes scanner GET/prefetch consumption, which was the observed failure mode. I would accept that residual risk.

## Billing Review

Citation-focus accounting is materially improved and matches the two-stage credit model.

- `backend/app/services/citation_quote_service.py:74-153` now returns `(focus_map, (prompt_tokens, completion_tokens))`; no-call and failure paths return zero usage.
- `backend/app/services/chat_service.py:979-1031` skips anonymous/demo traffic (`user is None`), skips main answers near the proxy budget, applies the 4s timeout, and returns `(changed, model, pt, ct)` without raising.
- Main answer accounting initializes focus variables before refinement at `backend/app/services/chat_service.py:1877-1888`, calculates `focus_cost` at `backend/app/services/chat_service.py:1936-1940`, adds it to `actual_cost` at `backend/app/services/chat_service.py:1941-1945`, reconciles once at `backend/app/services/chat_service.py:1946-1948`, then writes a separate focus `UsageRecord` at `backend/app/services/chat_service.py:1968-1977`.
- Continuation accounting mirrors this at `backend/app/services/chat_service.py:2559-2569` and `backend/app/services/chat_service.py:2600-2627`.
- `backend/app/services/credit_service.py:167-209` handles `actual_cost > pre_debited`: `diff = pre_debited - actual_cost` becomes negative, so the user balance is debited further and the original ledger row is updated to `delta=-actual_cost`.

No double-charge found: there is still one chat ledger row, and the focus row is usage attribution only. No under-charge found for normal provider responses: if focus usage is reported, it is charged even when no focus snippet is ultimately applied, which is correct because the provider call occurred. If the provider omits usage or the 4s timeout fires after the upstream provider already did work, the local app cannot charge exact usage; that is an accepted edge of timing out a best-effort nicety.

Notes:

- `backend/app/services/chat_service.py:2563-2569` does not pass `elapsed_seconds` for continuations, while the main path does at `backend/app/services/chat_service.py:1881-1888`. Because the timeout is now 4s, I do not consider this a billing or ship blocker, but passing continuation elapsed time would make the proxy-budget behavior consistent.
- `tool_status` can be emitted just before `_refine_citation_focus` skips due to elapsed budget (`backend/app/services/chat_service.py:1879-1888`). This is minor UI noise, not an integrity bug.

## Other Checks

- Suggested-question cross-document leak fix looks correct: `frontend/src/store/index.ts:302-315` clears `documentSummary` and `suggestedQuestions`, and `frontend/src/lib/useDocumentLoader.ts:107-112` sets them unconditionally on ready documents.
- Stale-test repairs lock the current contracts rather than just papering over failures:
  - `backend/tests/test_chat_summary_routing.py:114-116` matches the current `Document.id, filename, file_type, page_count` select shape.
  - `backend/tests/test_layout_translation_service.py:47` includes `input_scope={}`, and fake RetainPDF clients accept `target_language_label`.
  - `backend/tests/test_ocr_languages_baseline.py:1-75` now asserts the narrow OCR policy: eng-only default, no eng for non-Latin scripts, cap at 3, locale priority.
- `.claude/skills/deploy/SKILL.md:5-20` now encodes the backend-first deploy order with a Railway health check before pushing `stable`.
- `authConfirm.*` has all 7 keys in all 11 locale JSON files. Spot-checked Spanish, German, Chinese, Japanese, Arabic, and Hindi; the strings are sane.

## Verification

Ran:

```bash
cd backend && python3 -m pytest tests/test_chat_summary_routing.py tests/test_layout_translation_service.py tests/test_ocr_languages_baseline.py -q
```

Result: `24 passed, 6 warnings`.

I did not run the full frontend build or backend integration suite for this review.
