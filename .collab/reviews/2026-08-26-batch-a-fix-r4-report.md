# Batch A R3 findings — R4 fix report

Date: 2026-08-26  
Starting revision supplied by requester: `0781f88` (`fix/growth-batch-a`)  
Scope: accepted R3 findings F1 and F2

## Outcome

Both implementation findings are closed.

- F1 now uses the repository's durable settlement marker for structured extraction and the adjacent extraction-style workers. A committed success cannot be refunded or rewritten to failed after an acknowledgement loss.
- F2 removes the attacker-selectable URL budget. Every final URL response is capped at 10 MB for every plan, while direct uploads retain their 50/100/200 MB plan caps.
- No database migration was required.

The non-integration definition-of-done checks are green. The exact integration command was attempted, but this managed sandbox denies TCP access to the local PostgreSQL listener and access to the Docker socket. Consequently, the integration suite could collect but could not enter any test body; details are under Verification.

## F1 — durable extraction settlement

### Settlement protocol

`backend/app/services/extraction_service.py` now provides the shared synchronous extraction settlement implementation:

- `_reconcile_sync()` selects the predebit ledger row with `FOR UPDATE` and raises if it is absent.
- Reconciliation always updates `delta`, `balance_after`, and `reconciled_at`, including the equal-cost path where the user's balance needs no adjustment.
- `_refund_predebit_sync()` makes the settlement decision with one statement: `DELETE ... WHERE id = :id AND reconciled_at IS NULL RETURNING id`. A missing returned id means settlement already occurred; no balance credit follows.
- `_settle_extraction_predebit_after_failure_sync()` always creates a fresh synchronous session. If its conditional delete wins, the refund, failed job state, and optional Domain Mode trial release are committed in one transaction. If it loses, it rolls back and leaves the succeeded job untouched.
- Every success/final-commit exception in extraction, question-template generation, and document comparison routes through that resolver. Resolver errors log an `*.unresolved` settlement with the predebit left standing; there is no blind-refund fallback.

Queue-submission failure handling in the extraction, question-template, document-diff, and chat-tool entry points also uses conditional queued-to-failed claims plus the same conditional ledger delete. Losing either race returns the current job instead of overwriting a delivered result.

### Coverage

Added `backend/tests/test_extraction_billing_failure_windows_integration.py` with the requested **commit landed, acknowledgement lost** schedule. The first worker session performs the real final commit, then raises a simulated connection error. The fresh resolver sees the reconciled marker. Assertions cover:

- job remains `succeeded` with the actual 9-credit cost;
- extraction result and exactly one usage row remain present;
- ledger remains present with `delta = -9` and non-null `reconciled_at`;
- user balance is exactly the starting balance minus 9, with no minted credits;
- the delivered job's Domain Mode trial row remains claimed;
- the resolver uses a distinct fresh session.

Unit coverage also asserts `FOR UPDATE`, equal-cost marker stamping, and the single conditional `DELETE ... RETURNING` refund statement.

## F2 — flat 10 MB URL response cap

`backend/app/services/extractors/url_extractor.py` now has one URL byte ceiling: `MAX_URL_CONTENT_SIZE = 10 * 1024 * 1024`. The URL API no longer derives or passes a byte cap from the authenticated plan. PDF magic is used only to select the parser after the bounded response is read; it cannot select a larger budget.

The response reader now:

- requests bounded raw chunks through `iter_raw()`;
- counts raw stream bytes and HTTPX's downloaded-byte counter independently;
- bounds decoded gzip/deflate output with zlib's `max_length` before appending it;
- checks decoded output independently against the same 10 MB ceiling;
- advertises only `gzip, deflate` and rejects Brotli, Zstandard, and stacked encodings before reading/decoding, so those expansion paths fail closed;
- rejects incomplete, concatenated, invalid, or non-progressing compressed streams.

Tests cover the reported 30-byte-chunk/10-byte-cap overshoot, raw `Content-Length`, PDF-magic payloads, gzip and deflate over-expansion, valid in-cap compressed bodies, and fail-closed Brotli/Zstandard responses. API tests prove Free, Plus, and Pro all call the URL fetcher without a plan cap while direct-upload plan sizing remains in place.

The flat cap is stated in `.claude/rules/backend.md`, both architecture documents, homepage and multi-format structured copy/fallbacks, URL-limit error copy, and the four affected flat dotted keys in all 11 locales. The locale files were parsed and checked to ensure values remain flat.

## Verification

| Check | Result |
|---|---|
| `cd frontend && npm run build` | PASS — production build completed; 425 static pages generated |
| `cd frontend && npm run test:unit` | PASS — 12/12 |
| `cd backend && ../.venv312/bin/python -m ruff check app/ tests/` | PASS |
| `cd backend && ../.venv312/bin/python -m pytest -q` | PASS — 871 passed, 42 skipped |
| 11-locale JSON / flat dotted-key validation | PASS |
| `cd backend && SKIP_INTEGRATION= ../.venv312/bin/python -m pytest -m integration -q` | ENVIRONMENT BLOCKED — 39 setup errors, 874 deselected; every selected test failed while provisioning the scratch database because connecting to `::1:5432` raised `PermissionError: [Errno 1] Operation not permitted` |

The Docker fallback was also unavailable: the managed sandbox denies connection to the local Docker daemon socket. There were no integration assertion failures; no integration test body ran. The new acknowledgement-loss test is collected by both the full and integration selections and is ready to execute in an environment with PostgreSQL access.
