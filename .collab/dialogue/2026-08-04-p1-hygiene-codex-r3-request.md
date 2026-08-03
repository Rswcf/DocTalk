# Codex P1 hygiene r3 — final one-commit verification

Your r2 closed all three r1 findings but flagged a new P2: the per-branch `_sync_session_domain_mode` did its OWN standalone commit, creating failure windows (tool-action sync committing before tool execution outside the exception boundary; strict Quote Finder committing after answer+billing settlement — a failure there returned QUOTE_SEARCH_ERROR with the answer persisted, charged, unrefunded, unstreamed).

One commit since your r2 head:

```
git show 7ec0b4e
```

`_sync_session_domain_mode` is now a **pure in-memory assignment with zero commit/await of its own**. Each branch sets the attribute before its OWN existing terminal commit, so it rides that transaction:
- **Main RAG**: assignment stays where it was (after system-prompt construction); rides the path's existing commit.
- **Tool-action**: `_tool_action_stream` now takes `session_obj`; the assignment happens inside its try block immediately before its own `db.add(asst_msg)` + commit, so a failure rolls both back through the branch's existing except/rollback handler.
- **Strict Quote Finder**: `_run_verified_quote_search` now takes `domain_mode` + `session_obj`; the assignment goes INTO the same atomic message+reconcile+usage commit built during the M2 cancellation hardening — one commit, no post-settlement second write.

Both r1 regression tests kept unchanged (omitted-mode → row NULL on tool/quote paths). Two NEW real-Postgres failure-injection tests target a failure exactly AFTER the assignment at each branch's own terminal commit (call-counted flaky commit wrapper, mirroring this file's existing TestChatReconcileFailureAfterPersist precedent): both assert the domain_mode row stays at its stale prior value (never half-committed), and the Quote Finder one additionally asserts the predebit is fully refunded with ledger rows restored.

Task: verdict this P2 ADDRESSED / NOT ADDRESSED; probe adversarially — is there any remaining standalone commit or await in the sync path; does the assignment on the main RAG path actually reach a commit on every terminal outcome (or can it silently never persist); can a rollback now leave the in-memory session object dirty in a way that pollutes a later commit in the same request; do the failure-injection tests actually exercise the claimed windows. Flag NEW breakage in this one commit only. If clean, ALL P1 findings from r1+r2 are closed — issue the FINAL batch verdict for `ba8a141..HEAD` (docs commits excluded).

Evidence (audit, don't repeat): 788 backend pass / 3 skip (25 deselected integration), ruff clean, frontend build clean at HEAD; 25 real-Postgres integration tests passing (was 23).

Report: verdict + new-breakage + overall verdict CONSENSUS-SHIP / REVISE / BLOCK.
