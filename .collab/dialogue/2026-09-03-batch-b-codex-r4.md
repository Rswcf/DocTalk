SHIP

## Findings

None.

## Adversarial checks closed without findings

- The four trial-accounting mutexes at `backend/app/services/domain_mode_access.py:79`, `:173`, `:196`, and `:228` compile to `FOR NO KEY UPDATE`. Claim/claim, claim/release, claim/refund, chat/extraction, and delete-resolver/fresh-claim races still serialize because every operation that allocates or frees slot occupancy takes one of these mutexes, and every credit or plan `UPDATE users` also takes at least `FOR NO KEY UPDATE`. The newly compatible `FOR KEY SHARE` holders only establish user FKs; owner `SET NULL` cascades can clear a session/job pointer but deliberately leave the occupied slot row in place. No sequence produced two owners for one slot, an unintended release, or a permanently unreleasable failed-extraction slot.
- The weaker mode does not open an entitlement window. All application writers of `users.plan` conflict with `FOR NO KEY UPDATE`; there is no `FOR KEY SHARE` user-row reader that makes a plan decision and depended on these four sites excluding it. The paid-plan early return in `enforce_domain_mode_access()` occurs before any of the four mutex sites, so its behavior is unchanged by this round.
- `create_collection()` at `backend/app/api/collections.py:142-190` preserves the prior filtering semantics while removing the cycle: malformed, duplicate, missing, and non-owned IDs cannot become members; a concurrent delete that wins makes only the deleted row disappear after the locking SELECT rechecks it; a rolled-back delete leaves it present. An empty parsed list correctly skips the locking query and creates an empty collection. If collection creation wins, its `FOR KEY SHARE` holds deletion until the junction commit; if deletion wins, collection creation waits before taking a user FK key-share and then omits the vanished row. `add_documents_to_collection()` at `backend/app/api/collections.py:256-329` is unchanged and retains only its adjudicated pre-existing FK race.
- The remaining explicit user-lock/write paths do not recreate a user-before-existing-document edge. `create_predebited_document_job()` flushes the document-owned job before the trial claim and credit debit; reparse locks the document before locking the user; capacity-checked imports insert a newly generated document ID; billing paths add only user-owned children. The settle-time `UsageRecord` constructors at `backend/app/services/credit_service.py:154`, `backend/app/api/quotes.py:263`, `backend/app/services/extraction_service.py:1170`, `backend/app/services/question_template_service.py:260`, and `backend/app/services/document_diff_service.py:456` set no `document_id` (the model has no such column), so none adds a document-parent key-share after updating `users`.
- Rechecking B1-B4 found no uncaught regression beyond the nine closed findings from the earlier rounds: the brief result is status- and ordinal-gated, all chat entry points share the synchronous latch and route transport failures once, reparse retains document-before-user ordering and locked-plan accounting, and the dashboard nudge still uses the intended durable eligibility/cadence rules.

## Checks executed

- `python3 -m pytest -q tests/test_domain_mode_access.py tests/test_document_slots.py tests/test_collections_api.py` — 13 passed.
- `node --test tests/batch-b.test.cjs` — 8 passed.
- PostgreSQL-dialect compilation confirmed `with_for_update(key_share=True)` renders `FOR NO KEY UPDATE` and `with_for_update(read=True, key_share=True)` renders `FOR KEY SHARE`.

Review performed from the current tree and the Batch B round reports because Git and Docker-backed integration execution are unavailable in this sandbox. I did not rerun or claim the integration suite, full backend suite, Ruff gate, frontend production build, or full frontend unit suite.
