Reading prompt from stdin...
2026-08-03T22:12:56.201445Z ERROR codex_core::session::session: failed to load skill /Users/mayijie/Projects/Code/010_DocTalk/.agents/skills/deploy/SKILL.md: missing YAML frontmatter delimited by ---
2026-08-03T22:12:56.201480Z ERROR codex_core::session::session: failed to load skill /Users/mayijie/Projects/Code/010_DocTalk/.agents/skills/codex-implement/SKILL.md: missing YAML frontmatter delimited by ---
OpenAI Codex v0.144.0
--------
workdir: /Users/mayijie/Projects/Code/010_DocTalk
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR]
reasoning effort: xhigh
reasoning summaries: none
session id: 019fc9af-e69e-7b50-8796-99dcfe306aac
--------
user
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

codex
I’ll audit the transaction boundaries in `7ec0b4e`, trace every `_sync_session_domain_mode` call to its terminal outcomes, and inspect the new Postgres tests against the exact failure windows. I’ll treat the supplied test/build results as evidence and focus on new breakage introduced by this commit.
exec
/bin/zsh -lc "sed -n '1,240p' .claude/rules/backend.md && git show --stat --oneline --decorate --no-renames 7ec0b4e && git show --no-ext-diff --unified=80 --no-renames 7ec0b4e -- backend/app backend/tests" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
---
paths:
  - "backend/**"
---

# Backend Conventions

## Async Safety
- **MinIO calls MUST use `asyncio.to_thread()`** in async endpoints. MinIO client is sync (urllib3). Direct calls block event loop; when MinIO is unreachable, blocks ALL requests for 30+s. Client configured with short timeouts (connect=5s, read=10s, 2 retries)
- **Celery uses sync DB** (`psycopg`), API uses async (`asyncpg`). Never mix.

## Credits & Billing
- **Two-stage debit**: ① Pre-check balance (402 if insufficient) → ② `debit_credits()` pre-debits estimated cost (returns ledger ID) → stream → `reconcile_credits()` UPDATEs same ledger entry to actual cost. Single ledger record per chat. LLM failure → DELETE entry + full refund
- **Durable settlement (v0.24.0, Codex-consensus)**: `credit_ledger.reconciled_at` is the settlement marker. `reconcile_credits()` takes `SELECT ... FOR UPDATE` and ALWAYS stamps `reconciled_at` — including the equal-cost no-op path. Every refund is a single atomic conditional `DELETE ... WHERE reconciled_at IS NULL RETURNING id`; rowcount 0 = money already settled = no refund. ALL final-commit exceptions (not just `CancelledError`) route through the marker resolver; resolver failure must NEVER fall through to a blind refund (leave predebit standing, log `*.unresolved`). Do not reintroduce read-then-act refund logic.
- Quote search billing: `reason="quote_search"`, predebit 15 (balanced estimate), reconcile to actual; verified-empty results charge actual cost. Chat-routed quote searches bill through the chat message's own ledger row (predebit forced to 15 when the strict trigger fires, regardless of selected mode) — never a second row.
- **`ChatRequest` exposes only `mode` field** (`quick`/`balanced`; legacy `thorough` is retired). `model` field removed — prevents billing bypass
- Stripe webhook: `checkout.session.completed` for subscriptions only updates plan (no credits); `invoice.payment_succeeded` grants monthly credits (idempotent by invoice.id)
- `POST /api/billing/cancel` is self-serve and records optional `cancel_reason`, `cancel_feedback`, and `refund_requested` metadata in `plan_transitions`. `refund_requested` is an internal review flag; do not issue Stripe refunds from this path unless an explicit refund workflow is added.

## Parse Worker
- `time_limit=600`, `soft_time_limit=540`, `autoretry_for=(Exception,)`, max 2 retries, 60s backoff
- Idempotent re-parse: **delete Qdrant vectors (by `document_id` filter) BEFORE deleting DB pages/chunks**. Ordering matters — a Qdrant outage must leave the existing rows intact (set error + return), else the two stores diverge / data is lost. Then re-index.
- **PDF page text is persisted forward-only (v0.24.0)**: the extract pass stores `page.get_text("text")` per page into `pages.content` (previously NULL for all PDFs). Legacy docs keep NULL until re-parsed. `get_document_text_content` uses page mode ONLY when coverage is complete and consecutive (`1..page_count`, all non-blank); otherwise chunk fallback.
- **OCR trigger = `detect_scanned` (no text layer) OR `detect_low_quality_text` (PDF text layer present but garbled — broken-font cmap, Unicode-aware quality score)**. R2b fix for docs like U13 that have garbage text and so were never detected as "scanned".
- **OCR language is content-based**: `detect_script_osd` runs `tesseract --psm 0` (OSD) on sample pages → `resolve_ocr_languages(locale, script)` returns a NARROW set (script family, ≤3, **no `eng` for non-Latin** — it injects Latin noise). Never the kitchen-sink set (causes cross-script hallucination); locale only refines within a script family. Adopt a low-quality re-OCR only if it beats the text-layer quality. Persist `parse_version`/`parse_method`/`text_quality`/`ocr_languages` on the doc.
- Backfill stale/low-quality docs with `scripts/find_low_quality_docs.py` (skips `parse_version>=current` unless `--force`).

## Verified Quote Pipeline (M2, v0.24.0 — Codex 6-round consensus; do not weaken)
- **The guarantee**: a quote card is NEVER rendered from LLM-emitted text. `verify_quote()` (M1 substrate) gates every proposal; display text is ALWAYS the raw source slice. Flagged-tier (fuzzy 90–95) results are discarded from cards, only counted.
- **Verification source** (`quote_source_service`): all pages in the chunk's range have `Page.content` → per-page verification, kind=`page_text`; else cited chunk ± neighbors, kind=`extracted_text`. Trust labels derive from kind and are honest per-kind (word-for-word claim only for `page_text`).
- **Page attribution derives from the VERIFIED slice** (plan §8.1): multi-page `extracted_text` segments are DISCARDED (`ambiguous_page_range`); `page_text` duplicates emit one card per matching page. Never attribute via majority-bbox voting.
- **Chat routing is deterministic-safe**: auto-route to the billed pipeline ONLY when the strict trigger matches AND zero negation/metalinguistic tokens appear anywhere in the message; otherwise the ordinary RAG path runs with `quote_finder_hint`/`quote_finder_topic` on the SSE `done` event (frontend chip). Guarded triggers FORCE the RAG path — never a tool action. Do not re-attempt regex intent-scope resolution; the policy is adjudicated (asymmetric loss).
- **Saved quotes re-verify server-side**: the save endpoint accepts only `chunk_id + quote_text` and re-derives tier/score/page/kind via `verify_saved_quote()`; client-supplied trust fields would forge "verified" cards. Fabrication = 422 `QUOTE_NOT_VERIFIABLE`. Saved rows snapshot trust fields at save time (survive reparses; `source_chunk_id` is ON DELETE SET NULL).
- Caps: `FREE_SAVED_QUOTES_LIMIT=30` counts ACTIVE rows per user across documents; delete frees a slot; idempotent re-saves are never capped.

## Auth
- **`FOR UPDATE` lock** on verification tokens to prevent TOCTOU
- Internal Auth Adapter API uses `X-Adapter-Secret` header

## Error Handling
- Use `HTTPException` (not `JSONResponse`) for all non-SSE endpoints
- Lifespan pattern (`@asynccontextmanager`) instead of deprecated `@app.on_event`

## Demo System
- 3 seed PDFs auto-deployed at startup from `backend/seed_data/`. Self-healing covers BOTH stores: Qdrant vector loss → full re-seed; missing MinIO objects → `_ensure_demo_files` stats each doc's `storage_key` and re-uploads from seed_data (id/key-preserving). Added after the 2026-08 MinIO-v2 migration silently lost ~106/108 stored files (chat worked, PDF pane didn't). Seed assets are immutable per slug — the stat→put TOCTOU is accepted on that invariant.
- Anonymous limits (v0.23.0): **5 msgs per (IP, document) per 24h** (matches marketing copy), session cap = 500 per doc counted over a **24h rolling window of anonymous sessions only**, 10 req/min/IP, forced DeepSeek V4 Flash. Nightly beat task prunes empty demo sessions >7d (anon AND authed).
- Free-plan authed users get a per-user session cap on demo docs (`FREE_MAX_SESSIONS_PER_DOC`, own sessions only) — closes the row-spam DoS on the anonymous cap.
- Logged-in users accessing demo docs use their credits with no message limit

## Testing
- **Integration tests NEVER touch the shared dev DB.** `tests/conftest.py` forces a scratch `doctalk_test` database (auto-provisioned + migrated) and hard-refuses non-loopback hosts unless `DOCTALK_TEST_DATABASE_URL` is explicitly set. Two dev-DB wipe incidents (2026-08-02: alembic downgrade-base; integration fixtures) led to this — do not weaken it back to setdefault/conditional form. Never run `alembic downgrade` against `doctalk`.
7ec0b4e fix(chat): Codex r2 — fold domain_mode sync into existing transactions
 backend/app/services/chat_service.py               | 100 +++++++---
 ...st_quote_billing_failure_windows_integration.py | 202 +++++++++++++++++++++
 2 files changed, 272 insertions(+), 30 deletions(-)
commit 7ec0b4e2dd00ad1153b1ad7448a881d18688176c
Author: Yijie Ma <mayijie@Mac.fritz.box>
Date:   Tue Aug 4 00:09:49 2026 +0200

    fix(chat): Codex r2 — fold domain_mode sync into existing transactions
    
    Codex r2 found the r1 fix (2d4e01a) itself introduced a P2: each branch's
    domain_mode sync did its OWN separate commit, outside that branch's
    existing transaction boundary, creating new failure windows:
    - tool-action (chat_service.py:1616): the sync committed BEFORE the tool
      executed — a subsequent tool failure left the domain_mode change
      committed anyway, silently defeating "sync only rides successful
      paths." Reproduced directly: with the old shape, a failing
      chat_tool_executor.execute() call still left domain_mode durably None
      in the database.
    - strict Quote Finder (chat_service.py:1813): the sync committed AFTER
      the real answer+billing+usage atomic commit and settled=True — a
      failure in that EXTRA commit meant the client got QUOTE_SEARCH_ERROR
      while the real answer stayed persisted and charged with no refund and
      nothing streamed back.
    
    Fix (Codex's prescribed shape): _sync_session_domain_mode is now a PURE,
    IN-MEMORY assignment with NO commit/await of its own. Every call site
    sets the attribute (dirtying the already-session-tracked ORM object)
    BEFORE that branch's OWN existing terminal commit, so it rides along
    with whatever commit already existed — never a standalone one:
    - main RAG path: assigned in place (unchanged position, right after
      building the system prompt); rides whichever commit lands next in that
      path's existing flow.
    - tool-action: _tool_action_stream now takes session_obj as a parameter;
      the assignment happens INSIDE its try block, immediately before its own
      `db.add(asst_msg); await db.commit()` — a failure there rolls back
      BOTH together via the branch's existing except/rollback handler.
    - strict Quote Finder: _run_verified_quote_search now takes domain_mode
      and session_obj; the assignment happens INSIDE the SAME atomic
      message+reconcile+usage commit this function already builds — one
      commit, no post-settlement second write. The chat_stream call site no
      longer does anything domain_mode-related after settled=True.
    
    Kept both r1 regression tests (omitted-mode clears a stale value on the
    tool/quote-finder routes) — still pass unchanged, proving the ASSIGNMENT
    still happens correctly, just via a safer mechanism.
    
    Added two REAL-Postgres failure-injection tests (mirroring this file's
    established injected-failure pattern) proving a failure exactly AFTER the
    assignment — at each branch's own terminal commit — leaves NEITHER the
    domain_mode assignment NOR the real work half-committed, and (for the
    billed Quote Finder path) leaves no unrefunded charge: tool-action fails
    its final commit via a call-counted flaky wrapper (predebit-free branch,
    no billing to verify); Quote Finder fails its atomic commit the same way,
    additionally asserting the predebit is fully refunded and the ledger
    rows are restored, exactly like this file's existing
    TestChatReconcileFailureAfterPersist precedent. Both independently
    reproduced the exact r1-shaped bug via manual mutation (reintroducing a
    standalone early commit made the tool-action test observably show
    domain_mode wrongly committed to None on a subsequent tool failure,
    confirming the fix — and these tests — are correctly targeted) before
    being reverted.
    
    Full suite 788 passed / 28 skipped (was 788/26 — 2 new integration
    tests), ruff clean, 25 real-Postgres integration tests passing (was 23).
    doctalk's dev row counts reconfirmed unchanged.
    
    Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

diff --git a/backend/app/services/chat_service.py b/backend/app/services/chat_service.py
index 704a4d5..c7fec94 100644
--- a/backend/app/services/chat_service.py
+++ b/backend/app/services/chat_service.py
@@ -876,183 +876,196 @@ async def _persist_continuation_on_cancel(
         merged_citations = list(asst_msg.citations or []) + list(new_citations or [])
         asst_msg.content = (asst_msg.content or "") + continuation_text
         asst_msg.citations = merged_citations if merged_citations else None
         asst_msg.continuation_count = (asst_msg.continuation_count or 0) + 1
         asst_msg.output_tokens = (asst_msg.output_tokens or 0) + int(output_tokens or 0)
         await persist_db.commit()
         return True
 
 
 async def _settle_predebit_on_cancel(
     *,
     user_id: uuid.UUID,
     pre_debited: int,
     predebit_ledger_id: uuid.UUID,
     has_answer: bool,
     prompt_tokens: Optional[int],
     output_tokens: Optional[int],
     model: str,
     mode: str,
 ) -> None:
     async with AsyncSessionLocal() as settle_db:
         if has_answer:
             actual_cost = credit_service.calculate_cost(
                 int(prompt_tokens or 0),
                 int(output_tokens or 0),
                 model,
                 mode=mode,
             )
             await credit_service.reconcile_credits(
                 settle_db,
                 user_id,
                 predebit_ledger_id,
                 pre_debited,
                 actual_cost,
             )
             await settle_db.commit()
         else:
             await _refund_predebit(settle_db, user_id, pre_debited, predebit_ledger_id)
 
 
 async def _settle_verified_quote_predebit_after_failure(
     *,
     user_id: uuid.UUID,
     pre_debited: int,
     predebit_ledger_id: uuid.UUID,
     use_independent_session: bool,
     db: Optional[AsyncSession] = None,
 ) -> bool:
     """FIX3-A (Codex r3 #4, NOT ADDRESSED): the SOLE settlement resolver for
     _run_verified_quote_search's failure paths — CancelledError OR an
     ordinary exception, replacing FIX2-B(c)'s Message-marker existence
     check (which could only resolve the CancelledError case, and still
     required a caller-generated id and an independent read).
 
     That marker check is superseded entirely by FIX3-A(b)/(c)'s durable
     ledger state: reconcile_credits() now ALWAYS stamps reconciled_at
     (including the equal-cost no-op path) under a row lock, and
     _refund_predebit's DELETE is now conditional on reconciled_at IS NULL —
     a single atomic statement that both checks and acts, with no race
     window regardless of whether the atomic commit has landed, is still
     landing, or never will. There is nothing left for THIS function to
     "decide" — it just calls _refund_predebit with the right session and
     surfaces whether a refund actually happened, so the caller can log/
     respond accordingly.
 
     use_independent_session=True (CancelledError): the request's own `db`
     session may not be usable mid-cancellation — settle via a fresh
     AsyncSessionLocal(), matching every other cancel-path settler in this
     file.
     use_independent_session=False (ordinary exception): reuses the
     request's own `db` (rolled back first, inside _refund_predebit) —
     matches the existing pattern for non-cancellation failures elsewhere.
     """
     if use_independent_session:
         async with AsyncSessionLocal() as settle_db:
             return await _refund_predebit(settle_db, user_id, pre_debited, predebit_ledger_id)
     assert db is not None
     return await _refund_predebit(db, user_id, pre_debited, predebit_ledger_id)
 
 
-async def _sync_session_domain_mode(
-    db: AsyncSession, session_obj: ChatSession, domain_mode: Optional[str],
-) -> None:
-    """P1 hygiene follow-up (Codex M3 P1 review, 2026-08-03): the persisted
+def _sync_session_domain_mode(session_obj: ChatSession, domain_mode: Optional[str]) -> None:
+    """P1 hygiene (Codex M3 P1 review r1+r2, 2026-08-03): the persisted
     ChatSession.domain_mode must reflect the CURRENT request's domain_mode
     (null when omitted) on EVERY successful terminal path of chat_stream,
     not just the main RAG path this logic originally lived in inline.
-    Codex found two successful early-return paths that skipped it — tool
-    actions and strict Quote Finder routing — both returning before the
-    main RAG path's system-prompt-building section ever ran. A session
-    that once had domain_mode="legal" persisted could keep that stale
-    value after a later omitted-mode message that happened to route to
-    one of those branches, making the documented "omitted clears it"
-    invariant false for those paths.
-
-    Downstream-harmless today (chat_stream always uses the per-request
-    `domain_mode` argument directly, never re-reads session_obj.domain_mode
-    to decide behavior; continuation doesn't reload it either) — this is
-    metadata correctness / honoring the invariant, not a security fix.
+
+    r1: Codex found two successful early-return paths that skipped this
+    entirely — tool actions and strict Quote Finder routing — both
+    returning before the main RAG path's system-prompt-building section
+    ever ran. A session that once had domain_mode="legal" persisted could
+    keep that stale value after a later omitted-mode message that
+    happened to route to one of those branches.
+
+    r2: the first fix (commit 2d4e01a) gave this function its OWN
+    `await db.commit()`, called separately in each branch — Codex found
+    THAT was itself a new hazard: a standalone commit outside each
+    branch's existing transaction boundary creates a new, independent
+    failure window. Worse, in the tool-action branch the extra commit ran
+    BEFORE the tool executed, so a subsequent tool failure left the
+    domain_mode change committed anyway — silently defeating the "sync
+    only rides successful paths" intent. In the strict Quote Finder
+    branch, the extra commit ran AFTER the real answer+billing+usage
+    atomic commit — if IT failed, the client got QUOTE_SEARCH_ERROR while
+    the real answer stayed persisted and charged with no way back.
+
+    Fixed by making this function a PURE, IN-MEMORY ASSIGNMENT with NO I/O
+    of its own — zero new commit points. Every call site sets the
+    attribute (dirtying the already-session-tracked ORM object) BEFORE
+    that branch's own existing terminal commit, so SQLAlchemy's next
+    flush picks it up as part of THAT single transaction: it lands
+    together with the real work on success, and a rollback on failure
+    discards it right along with everything else — never separately
+    committed, never separately lost.
     """
     if domain_mode != session_obj.domain_mode:
         session_obj.domain_mode = domain_mode
-        await db.commit()
 
 
 async def _fetch_page_chunks(
     db: AsyncSession,
     document_id: uuid.UUID,
     page_ref: int,
     *,
     limit: int = 12,
 ) -> List[Dict[str, Any]]:
     """Direct positional retrieval (B4): chunks overlapping a specific page.
 
     Semantic top-k cannot resolve "what is on page N" — the paying user asked for
     page 350 of a 492-page PDF and got "the excerpts do not contain page 350".
     Here we fetch the chunks whose page range covers the requested page.
     """
     rows = await db.execute(
         select(Chunk)
         .where(Chunk.document_id == document_id)
         .where(Chunk.page_start <= page_ref)
         .where(Chunk.page_end >= page_ref)
         .order_by(Chunk.chunk_index)
         .limit(limit)
     )
     chunks = list(rows.scalars())
     return [chunk_to_retrieval_item(ch, 1.0, include_document_id=True) for ch in chunks]
 
 
 async def _record_rag_verification_event(
     db: AsyncSession,
     *,
     user: Optional[User],
     message_id: uuid.UUID | None,
     verification: dict,
     retrieval_strategy: str,
     query_route: Any,
     retrieved_count: int,
     repair_metadata: dict[str, Any] | None = None,
 ) -> None:
     try:
         metadata_json = {
             "message_id": str(message_id) if message_id else None,
             "status": verification.get("status"),
             "score": verification.get("score"),
             "reasons": verification.get("reasons") or [],
             "claim_count": verification.get("claim_count"),
             "cited_claim_count": verification.get("cited_claim_count"),
             "uncited_claim_count": verification.get("uncited_claim_count"),
             "citation_count": verification.get("citation_count"),
             "invalid_citation_count": verification.get("invalid_citation_count"),
             "low_overlap_citation_count": verification.get("low_overlap_citation_count"),
             "numeric_mismatch_citation_count": verification.get("numeric_mismatch_citation_count"),
             "retrieved_count": retrieved_count,
             "retrieval_strategy": retrieval_strategy,
             "route": getattr(getattr(query_route, "primary_intent", None), "value", None),
         }
         if repair_metadata:
             metadata_json.update(repair_metadata)
         db.add(
             ProductEvent(
                 user_id=user.id if user else None,
                 event_name="rag_verification_completed",
                 source="chat",
                 reason=str(verification.get("status") or "unknown")[:64],
                 plan=(user.plan if user else None),
                 metadata_json=metadata_json,
             )
         )
         await db.commit()
     except Exception:
         await db.rollback()
         logger.warning("Failed to record RAG verification event", exc_info=True)
 
 
 # ---------------------------
 # RefParserFSM
 # ---------------------------
 
 @dataclass
 class _ChunkInfo:
     id: uuid.UUID
@@ -1238,656 +1251,677 @@ class RefParserFSM:
         self.chunk_map = chunk_map
         self.buffer: str = ""
         self.char_offset: int = 0
         self.state: str = "TEXT"  # TEXT | MAYBE_REF
         self.recent_claim: str = ""
 
     def feed(self, token: str) -> List[Dict[str, Any]]:
         events: List[Dict[str, Any]] = []
         for ch in token:
             if self.state == "TEXT":
                 if ch == "[":
                     self.state = "MAYBE_REF"
                     self.buffer = "["
                 else:
                     events.append(sse("token", {"text": ch}))
                     self.char_offset += 1
                     self.recent_claim = (self.recent_claim + ch)[-self._CLAIM_WINDOW:]
 
             elif self.state == "MAYBE_REF":
                 self.buffer += ch
                 if ch == "]":
                     inner = self.buffer[1:-1]
                     if inner.isdigit() and (int(inner) in self.chunk_map):
                         ref_num = int(inner)
                         chunk = self.chunk_map[ref_num]
                         events.append(sse("citation", _citation_payload(ref_num, chunk, self.char_offset, current_claim(self.recent_claim))))
                     else:
                         # 非有效引用，回退为普通文本
                         events.append(sse("token", {"text": self.buffer}))
                         self.char_offset += len(self.buffer)
                     self.buffer = ""
                     self.state = "TEXT"
                 elif len(self.buffer) > 8:
                     # 超限回退
                     events.append(sse("token", {"text": self.buffer}))
                     self.char_offset += len(self.buffer)
                     self.buffer = ""
                     self.state = "TEXT"
         return events
 
     def flush(self) -> List[Dict[str, Any]]:
         events: List[Dict[str, Any]] = []
         if self.buffer:
             events.append(sse("token", {"text": self.buffer}))
             self.buffer = ""
         return events
 
 
 # ---------------------------
 # Chat Service
 # ---------------------------
 
 
 class ChatService:
     async def _persist_user_message_and_title(
         self,
         *,
         db: AsyncSession,
         session_id: uuid.UUID,
         user_message: str,
     ) -> None:
         user_msg = Message(session_id=session_id, role="user", content=user_message)
         db.add(user_msg)
         await db.commit()
 
         session = await db.get(ChatSession, session_id)
         if session and not session.title:
             clean = user_message.replace("\n", " ").replace("\r", "").strip()
             session.title = clean[:50]
             await db.commit()
 
     async def _tool_action_stream(
         self,
         *,
         session_id: uuid.UUID,
         user_message: str,
         db: AsyncSession,
         user: Optional[User],
         locale: Optional[str],
         domain_mode: Optional[str],
+        session_obj: ChatSession,
         document_id: uuid.UUID | None,
         collection_doc_ids: list[uuid.UUID],
         action_plan: Any,
     ) -> AsyncGenerator[Dict[str, Any], None]:
         try:
             await self._persist_user_message_and_title(
                 db=db,
                 session_id=session_id,
                 user_message=user_message,
             )
             if action_plan.user_visible_status:
                 yield sse("tool_status", {"message": action_plan.user_visible_status})
             execution = await chat_tool_executor.execute(
                 action_plan,
                 user=user,
                 db=db,
                 document_id=document_id,
                 collection_doc_ids=collection_doc_ids,
                 locale=locale,
                 domain_mode=domain_mode,
             )
             assistant_text = execution.message
             artifact_payload = execution.artifact.to_payload() if execution.artifact else None
             if artifact_payload:
                 yield sse("artifact", artifact_payload)
             if assistant_text:
                 yield sse("token", {"text": assistant_text})
 
             asst_msg = Message(
                 session_id=session_id,
                 role="assistant",
                 content=assistant_text,
                 citations=(artifact_payload or {}).get("citations") if artifact_payload else None,
                 metadata_json={
                     "action_plan": {
                         "action": action_plan.action.value,
                         "confidence": action_plan.confidence,
                         "reason": action_plan.reason,
                     },
                     "artifacts": [artifact_payload] if artifact_payload else [],
                 },
             )
             db.add(asst_msg)
+            # P1 hygiene r2 (Codex, 2026-08-03): a PURE assignment, set
+            # INSIDE this try block right before the branch's own terminal
+            # commit — never a standalone commit. If the tool execution
+            # above already raised, this line never runs and nothing is
+            # dirtied; if THIS commit fails, the except block below rolls
+            # everything back together, domain_mode included — never a
+            # half-committed sync. See _sync_session_domain_mode's docstring.
+            _sync_session_domain_mode(session_obj, domain_mode)
             await db.commit()
             yield sse(
                 "done",
                 {
                     "message_id": str(asst_msg.id),
                     "citations_count": 0,
                     "verification": None,
                     "can_continue": False,
                     "continuation_count": asst_msg.continuation_count,
                     "artifact_count": 1 if artifact_payload else 0,
                 },
             )
         except Exception as exc:
             await db.rollback()
             yield _safe_sse("error", "CHAT_SETUP_ERROR", exc, session_id=str(session_id))
 
     async def _run_verified_quote_search(
         self,
         *,
         session_id: uuid.UUID,
         db: AsyncSession,
         document: Document,
         user: User,
         topic: str,
         locale: Optional[str],
+        domain_mode: Optional[str],
+        session_obj: ChatSession,
         pre_debited: int,
         predebit_ledger_id: uuid.UUID,
         progress: "_VerifiedQuoteProgress",
     ) -> "_VerifiedQuoteOutcome":
         """Strict verbatim-quote chat routing (B5, plan §8.4.3).
 
         Runs B3's verified quote_search in place of the normal LLM answer,
         persists the assistant message, and reconciles + records usage — ALL
         of it awaited here, nothing yielded. `progress` is mutated as this
         proceeds (model/tokens as soon as quote_search() returns,
         `message_id` only once the message commit succeeds) so the CALLER's
         cancellation handler can settle correctly no matter where a
         CancelledError lands — see _VerifiedQuoteProgress's docstring.
 
         Billing is the CALLER's chat predebit (pre_debited/predebit_ledger_id
         come from the SAME debit_credits() call every RAG-path message
         already goes through) — there is no separate quote-search debit, so
         this can never double-bill. An exception raised before ANY commit
         here propagates to chat_stream's existing setup exception handler
         unchanged, which fully refunds — correct, since nothing was
         delivered.
         """
         result = await quote_search_service.quote_search(
             db, document=document, user=user, topic=topic, locale=locale or "",
         )
         progress.prompt_tokens, progress.completion_tokens = result.usage
         progress.model = result.model
 
         citations: List[dict] = []
         artifact_payload: Optional[dict] = None
         if result.cards:
             for idx, card in enumerate(result.cards, start=1):
                 citations.append({
                     "ref_index": idx,
                     "chunk_id": card.chunk_id,
                     "page": card.page,
                     "page_end": card.page_end,
                     "bboxes": card.bboxes,
                     "text_snippet": card.display_text[:100],
                     "offset": 0,
                     "focus_snippet": card.display_text,
                     "confidence_score": round(card.score / 100.0, 3),
                     "context_text": card.display_text[:900],
                     "document_id": str(document.id),
                     "source_kind": card.source_kind,
                 })
             assistant_text = _quote_search_copy(_QUOTE_SEARCH_FOUND_COPY, locale, n=len(result.cards))
             # Reuse the extraction-artifact SSE mechanism exactly (MINOR-3,
             # review round 1) rather than hand-building the payload shape.
             artifact = ChatArtifact(
                 artifact_type="quote_search",
                 status="succeeded",
                 title="Verified Quotes",
                 summary=assistant_text,
                 preview={
                     "cards": [
                         {
                             "ref_index": idx,
                             "display_text": card.display_text,
                             "page": card.page,
                             "page_end": card.page_end,
                             "tier": card.tier,
                             "source_kind": card.source_kind,
                             "score": card.score,
                         }
                         for idx, card in enumerate(result.cards, start=1)
                     ],
                     "proposed": result.proposed,
                     "verified": result.verified,
                     "discarded_count": len(result.discarded),
                     "scanned_chunks": result.scanned_chunks,
                 },
                 citations=citations,
             )
             artifact_payload = artifact.to_payload()
         else:
             # Verified-empty: the honest message, never an unverified fallback answer.
             assistant_text = _quote_search_copy(_QUOTE_SEARCH_EMPTY_COPY, locale, n=result.scanned_chunks)
 
         message_id = uuid.uuid4()
         asst_msg = Message(
             id=message_id,
             session_id=session_id,
             role="assistant",
             content=assistant_text,
             citations=citations or None,
             metadata_json={
                 "action_plan": {
                     "action": ChatAction.VERIFIED_QUOTE_SEARCH.value,
                     "confidence": 1.0,
                     "reason": "strict verbatim-quote markers",
                 },
                 "artifacts": [artifact_payload] if artifact_payload else [],
             },
         )
         db.add(asst_msg)
 
         # FIX2-B(a) (Codex r2 #4, NOT ADDRESSED): message-persist + reconcile
         # + usage-record are now ONE ATOMIC commit — no intermediate commit
         # between the message add and the billing settlement. This removes
         # the "message persisted but billing never reconciled" class of
         # ordinary-exception free-ride entirely: either the whole
         # transaction lands together, or none of it does. FIX3-A (Codex r3
         # #4): reconcile_credits() below durably stamps
         # credit_ledger.reconciled_at under a row lock — the caller's
         # exception handlers resolve any failure here (CancelledError or
         # ordinary) via that marker + an atomic conditional refund, never
         # an in-memory flag or existence check.
         actual_cost = credit_service.calculate_cost(
             progress.prompt_tokens, progress.completion_tokens, progress.model, mode="balanced",
         )
         await credit_service.reconcile_credits(
             db, user.id, predebit_ledger_id, pre_debited, actual_cost,
         )
         await credit_service.record_usage(
             db,
             user_id=user.id,
             message_id=message_id,
             model=progress.model,
             prompt_tokens=progress.prompt_tokens,
             completion_tokens=progress.completion_tokens,
             cost_credits=actual_cost,
         )
+        # P1 hygiene r2 (Codex, 2026-08-03): a PURE assignment, folded
+        # INTO this same atomic commit — never a standalone one. The old
+        # (r1) fix committed this separately AFTER this block, so a
+        # failure in that extra commit meant the client got
+        # QUOTE_SEARCH_ERROR while the real answer stayed persisted and
+        # charged with no way back. See _sync_session_domain_mode's
+        # docstring.
+        _sync_session_domain_mode(session_obj, domain_mode)
         await db.commit()
         # Only trustworthy once the atomic commit's await has ACTUALLY
         # returned — the ordinary-exception handler (FIX-4) uses this to
         # know whether a real answer was delivered.
         progress.message_id = message_id
 
         return _VerifiedQuoteOutcome(
             message_id=message_id,
             assistant_text=assistant_text,
             citations=citations,
             artifact_payload=artifact_payload,
         )
 
     async def chat_stream(
         self,
         session_id: uuid.UUID,
         user_message: str,
         db: AsyncSession,
         user: Optional[User] = None,
         locale: Optional[str] = None,
         mode: Optional[str] = None,
         domain_mode: Optional[str] = None,
     ) -> AsyncGenerator[Dict[str, Any], None]:
         """Main chat streaming generator producing SSE event dicts.
 
         Steps per spec:
         1) Load session + document
         2) Save user message
         3) Load recent history (last MAX_CHAT_HISTORY_TURNS rounds)
         4) Retrieval top-5
         5) Build prompt with numbered chunks
         6) Stream Anthropic
         7) Parse with RefParserFSM and yield events; ping every 15s
         8) Save assistant message + citations
         9) Yield done
         """
 
         # 1) Load session
         row = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
         session_obj: Optional[ChatSession] = row.scalar_one_or_none()
         if not session_obj:
             yield sse("error", {"code": "SESSION_NOT_FOUND", "message": "会话不存在"})
             return
 
         document_id = session_obj.document_id
         collection_id = getattr(session_obj, "collection_id", None)
         is_collection_session = collection_id is not None and document_id is None
 
         # Load document for custom instructions (single-doc sessions)
         doc = await db.get(Document, document_id) if document_id else None
 
         # For collection sessions, load all document IDs and filenames
         collection_doc_ids: List[uuid.UUID] = []
         collection_doc_names: dict[uuid.UUID, str] = {}
         collection_doc_types: dict[uuid.UUID, str] = {}
         collection_doc_pages: dict[uuid.UUID, int] = {}
         if is_collection_session:
             cd_rows = await db.execute(
                 select(collection_documents.c.document_id).where(
                     collection_documents.c.collection_id == collection_id
                 )
             )
             collection_doc_ids = [row[0] for row in cd_rows.all()]
             if collection_doc_ids:
                 doc_rows = await db.execute(
                     select(Document.id, Document.filename, Document.file_type, Document.page_count)
                     .where(Document.id.in_(collection_doc_ids))
                 )
                 for drow in doc_rows.all():
                     collection_doc_names[drow[0]] = drow[1]
                     collection_doc_types[drow[0]] = drow[2]
                     if drow[3]:
                         collection_doc_pages[drow[0]] = drow[3]
 
         # Resolve mode → model (mode is the ONLY way to select a model)
         effective_mode = mode if mode in settings.MODE_MODELS else "balanced"
         effective_model = settings.MODE_MODELS[effective_mode]
 
         # Force demo model for anonymous users on demo documents
         if user is None and doc and doc.demo_slug:
             effective_model = settings.DEMO_LLM_MODEL
             effective_mode = "quick"
 
         # Premium mode gating: require Plus or Pro plan
         if effective_mode in settings.PREMIUM_MODES:
             user_plan = (user.plan or "free").lower() if user else "free"
             if user_plan == "free":
                 yield sse(
                     "error",
                     {
                         "code": "MODE_NOT_ALLOWED",
                         "message": "Upgrade to Plus to use this mode",
                         "required_plan": "plus",
                     },
                 )
                 return
 
         action_plan = await action_planner.plan(
             user_message,
             is_collection=is_collection_session,
             locale=locale,
         )
         if not action_plan.uses_rag_answer_path:
-            # P1 hygiene follow-up (Codex, 2026-08-03): this successful
-            # early-return path skipped the domain_mode session sync that
-            # only ran inline in the main RAG path below — see
-            # _sync_session_domain_mode's docstring.
-            await _sync_session_domain_mode(db, session_obj, domain_mode)
+            # P1 hygiene r1+r2 (Codex, 2026-08-03): this successful
+            # early-return path needs the domain_mode session sync too —
+            # the ASSIGNMENT now happens INSIDE _tool_action_stream, right
+            # before its own terminal commit (see _sync_session_domain_mode's
+            # docstring for why it's not done here as a standalone commit).
             async for ev in self._tool_action_stream(
                 session_id=session_id,
                 user_message=user_message,
                 db=db,
                 user=user,
                 locale=locale,
                 domain_mode=domain_mode,
+                session_obj=session_obj,
                 document_id=document_id,
                 collection_doc_ids=collection_doc_ids,
                 action_plan=action_plan,
             ):
                 yield ev
             return
 
         query_route = query_router.route(
             user_message,
             is_collection=is_collection_session,
             domain_mode=domain_mode,
         )
 
         # Pre-debit estimated credits BEFORE streaming (prevents TOCTOU + free rides)
         pre_debited = 0
         predebit_ledger_id = None
         strict_quote_routed = _is_strict_quote_routed(
             action_plan, user=user, document_id=document_id,
             is_collection_session=is_collection_session, doc=doc,
         )
         if user is not None:
             # FIX-3 (Codex r1 BLOCKER #3): a strict-routed message ALWAYS
             # runs the balanced-model quote engine regardless of the
             # user-selected chat mode — predebit must reflect that real
             # cost, not `effective_mode`'s (e.g. quick=5), or a low-balance
             # user could reserve too little and reconciliation would push
             # their account negative to cover the overrun.
             estimated = (
                 credit_service.get_estimated_cost("balanced")
                 if strict_quote_routed
                 else credit_service.get_estimated_cost(effective_mode)
             )
             if query_route.primary_intent == QueryIntent.DOCUMENT_SUMMARY:
                 estimated = max(estimated, estimated * 2)
             predebit_ledger_id = await credit_service.debit_credits(
                 db, user_id=user.id, cost=estimated,
                 reason="chat", ref_type="mode", ref_id="balanced" if strict_quote_routed else effective_mode,
             )
             if predebit_ledger_id:
                 pre_debited = estimated
                 await db.commit()
             else:
                 balance = await credit_service.get_user_credits(db, user.id)
                 yield sse(
                     "error",
                     {
                         "code": "INSUFFICIENT_CREDITS",
                         "message": "Insufficient credits to start chat",
                         "required": estimated,
                         "balance": balance,
                     },
                 )
                 return
 
         settled = False
         setup_error_code = "CHAT_SETUP_ERROR"
         try:
             # 2) Save user message
             await self._persist_user_message_and_title(
                 db=db,
                 session_id=session_id,
                 user_message=user_message,
             )
 
             # Strict verbatim-quote chat routing (B5, plan §8.4.3). Gated
             # here (not in the planner, which has no auth/doc context):
             # AUTHED, non-demo, single-document sessions only. Anonymous,
             # demo, and collection sessions fall through to the normal RAG
             # path below UNCHANGED — the strict intent still matched, but
             # without a real document + billing user the verified pipeline
             # can't run, so this degrades to an ordinary cited answer rather
             # than erroring. SAME predicate (`strict_quote_routed`, computed
             # above) already decided the predebit amount — never re-derive
             # this condition separately (FIX-3: that's exactly how a
             # quick-mode predebit could drift from what actually runs).
             if strict_quote_routed:
                 setup_error_code = "QUOTE_SEARCH_ERROR"
                 quote_progress = _VerifiedQuoteProgress()
                 try:
                     outcome = await self._run_verified_quote_search(
                         session_id=session_id,
                         db=db,
                         document=doc,
                         user=user,
                         topic=user_message,
                         locale=locale,
+                        domain_mode=domain_mode,
+                        session_obj=session_obj,
                         pre_debited=pre_debited,
                         predebit_ledger_id=predebit_ledger_id,
                         progress=quote_progress,
                     )
                 except asyncio.CancelledError:
                     # FIX3-A(d) (Codex r3 #4, NOT ADDRESSED): `settled` is
                     # marked BEFORE the resolver even runs — regardless of
                     # whether it succeeds — so the outer generic handler
                     # (which now also checks `not settled`, see below) can
                     # NEVER also attempt its own blind settlement. That was
                     # the exact "special resolver errors out, outer handler
                     # falls back to blind settlement" gap Codex r3 found.
                     # The resolver itself is the durable, race-free
                     # reconciled_at + conditional-delete design (FIX3-A(b)/
                     # (c)) — correct regardless of whether the atomic commit
                     # already landed, is still landing, or never will.
                     if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
                         settled = True
                         try:
                             with anyio.CancelScope(shield=True):
                                 refunded = await asyncio.wait_for(
                                     _settle_verified_quote_predebit_after_failure(
                                         user_id=user.id,
                                         pre_debited=pre_debited,
                                         predebit_ledger_id=predebit_ledger_id,
                                         use_independent_session=True,
                                     ),
                                     timeout=_CANCEL_IO_TIMEOUT_S,
                                 )
                             if not refunded:
                                 logger.info(
                                     "quote_billing.settled_no_refund user=%s ledger=%s: cancellation "
                                     "after the atomic commit had already reconciled — predebit stands.",
                                     user.id, predebit_ledger_id,
                                 )
                         except Exception:
                             # FIX3-A(d): resolver failure must NEVER fall
                             # through to ANY further settlement attempt —
                             # leave the predebit standing and surface it to
                             # ops for manual review.
                             logger.error(
                                 "quote_billing.unresolved user=%s ledger=%s pre_debited=%s "
                                 "session=%s: settlement resolver failed during cancellation — "
                                 "predebit left standing, requires manual review.",
                                 user.id, predebit_ledger_id, pre_debited, session_id, exc_info=True,
                             )
                     raise
                 except Exception as exc:
                     # FIX3-A(d) (Codex r3 #4, NOT ADDRESSED): ALL final-
                     # commit exceptions — not just CancelledError — now
                     # route through the SAME resolver as the branch above,
                     # closing the "ordinary 'server committed but COMMIT
                     # response was lost' exception leaves progress.message_id
                     # unset and reaches the generic (blind) refund path"
                     # gap Codex r3 found. `settled` is marked BEFORE the
                     # resolver runs, same reasoning as the CancelledError
                     # branch.
                     if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
                         settled = True
                         try:
                             refunded = await _settle_verified_quote_predebit_after_failure(
                                 user_id=user.id,
                                 pre_debited=pre_debited,
                                 predebit_ledger_id=predebit_ledger_id,
                                 use_independent_session=False,
                                 db=db,
                             )
                         except Exception:
                             logger.error(
                                 "quote_billing.unresolved user=%s ledger=%s pre_debited=%s "
                                 "session=%s: settlement resolver failed after an ordinary billing "
                                 "exception — predebit left standing, requires manual review.",
                                 user.id, predebit_ledger_id, pre_debited, session_id, exc_info=True,
                             )
                             yield _safe_sse("error", "QUOTE_SEARCH_ERROR", exc, session_id=str(session_id))
                             return
                         if not refunded:
                             # The atomic commit had already reconciled — a
                             # real, delivered, persisted answer — this
                             # exception struck AFTER that. Predebit stands
                             # as the charge; never a full refund for a
                             # delivered answer.
                             logger.exception(
                                 "Quote-search billing failed after the atomic commit had already "
                                 "reconciled (ledger %s) for user %s — predebit stands, no refund.",
                                 predebit_ledger_id, user.id,
                             )
                             yield _safe_sse(
                                 "error", "QUOTE_SEARCH_BILLING_INCOMPLETE", exc, session_id=str(session_id),
                             )
                             return
                         # Refunded — nothing was delivered.
                         yield _safe_sse("error", "QUOTE_SEARCH_ERROR", exc, session_id=str(session_id))
                         return
                     raise
                 # Reconcile already committed inside _run_verified_quote_search —
                 # mark settled BEFORE yielding so a cancellation during these
                 # yields can't ALSO trigger the setup handler's full refund
                 # (double-refund guard, same pattern as the main RAG path).
+                # domain_mode was already synced INSIDE that same atomic
+                # commit (P1 hygiene r2, Codex 2026-08-03) — nothing left
+                # to do here.
                 settled = True
-                # P1 hygiene follow-up (Codex, 2026-08-03): this successful
-                # early-return path also skipped the domain_mode session
-                # sync — see _sync_session_domain_mode's docstring.
-                await _sync_session_domain_mode(db, session_obj, domain_mode)
                 if outcome.artifact_payload:
                     yield sse("artifact", outcome.artifact_payload)
                 yield sse("token", {"text": outcome.assistant_text})
                 yield sse(
                     "done",
                     {
                         "message_id": str(outcome.message_id),
                         "citations_count": len(outcome.citations),
                         "verification": None,
                         "can_continue": False,
                         "continuation_count": 0,
                         "artifact_count": 1 if outcome.artifact_payload else 0,
                     },
                 )
                 return
 
             # 3) Load history (last N*2 messages before current user msg)
             max_turns = int(settings.MAX_CHAT_HISTORY_TURNS or 6)
             max_msgs = max_turns * 2
             msgs_row = await db.execute(
                 select(Message)
                 .where(Message.session_id == session_id)
                 .order_by(Message.created_at.desc())
                 .limit(max_msgs + 1)
             )
             history_msgs: List[Message] = list(msgs_row.scalars().all())
             history_msgs.reverse()  # back to chronological order
 
             # Convert to Claude message format (excluding system)
             claude_messages: List[dict] = []
             for m in history_msgs:
                 claude_messages.append({"role": m.role, "content": m.content})
 
             # 4) Route + retrieval (with error handling — e.g. Qdrant down or no vectors yet).
             # Whole-document summaries must not use ordinary semantic top-k: vague
             # summary prompts frequently retrieve tables/appendices instead of
             # representative document structure. Route them to an ordered context
             # selector until the durable hierarchical brief index lands.
             setup_error_code = "RETRIEVAL_ERROR"
             retrieval_strategy = "semantic_top_k"
             retrieval_evaluation = None
             retrieval_plan: QueryPlan | None = None
             summary_usage = MapReduceUsageCollector()
             if (
                 query_route.primary_intent == QueryIntent.DOCUMENT_SUMMARY
                 and document_id
                 and not is_collection_session
             ):
                 yield sse("tool_status", {"message": "Summarizing the document section by section…"})
                 retrieved = await document_brief_service.get_summary_context(
                     db,
                     document_id,
                     max_chunks=18,
                     usage_collector=summary_usage,
                 )
                 retrieval_strategy = "document_summary_context"
             elif (
                 query_route.primary_intent == QueryIntent.DOCUMENT_SUMMARY
                 and is_collection_session
                 and collection_doc_ids
             ):
                 retrieved = await document_brief_service.get_collection_summary_context(
                     db,
                     collection_doc_ids,
                     max_chunks=24,
                     max_docs=8,
                 )
                 retrieval_strategy = "collection_summary_context"
             elif is_collection_session and collection_doc_ids:
                 corrective = await corrective_retrieval_service.retrieve_multi(
                     user_message,
                     query_route,
                     collection_doc_ids,
                     top_k=8,
                     db=db,
                 )
                 retrieved = corrective.retrieved
                 retrieval_strategy = corrective.strategy
                 retrieval_evaluation = corrective.evaluation
                 retrieval_plan = corrective.plan
@@ -2011,164 +2045,170 @@ class ChatService:
             elif is_collection_session:
                 doc_list = ", ".join(collection_doc_names.values()) if collection_doc_names else "(no documents)"
                 system_prompt = (
                     "You are a document analysis assistant. Answer the user's question based on sources from multiple documents.\n\n"
                     + SYSTEM_PROMPT_META_RULE
                     + f"## Available Documents\n{doc_list}\n\n"
                     + "## Document Sources\n"
                     + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
                     + _retrieval_quality_contract(retrieval_evaluation, retrieval_strategy)
                     + _query_plan_contract(retrieval_plan)
                     + "\n\n## Rules\n" + rules
                     + _citation_contract()
                 )
             elif retrieval_strategy == "document_summary_context":
                 map_reduce_rule = (
                     "7. The sources may be map-reduce section summaries generated from source chunks; "
                     "use the coverage status to distinguish model-covered, fallback, and missing sections.\n"
                     if has_map_reduce_summary_context
                     else ""
                 )
                 system_prompt = (
                     "You are a document analysis assistant. The user is asking for a broad, whole-document summary.\n\n"
                     + SYSTEM_PROMPT_META_RULE
                     + "## Document Coverage Sources\n"
                     + (
                         "\n".join(numbered_chunks)
                         if numbered_chunks
                         else "(none)"
                     )
                     + "\n\n## Summary Rules\n"
                     + "1. Treat these sources as representative coverage selected across the document, not as semantic search results for a narrow question.\n"
                     + "2. Do NOT say the user's ready document is not a complete document merely because the context is selective.\n"
                     + "3. Produce a useful document-level summary with clear headings, key points, and important caveats when supported.\n"
                     + "4. If coverage is incomplete, say the answer is based on the cited representative sections instead of refusing.\n"
                     + "5. Cite every factual paragraph or bullet using the source numbers listed above.\n"
                     + "6. Your response language MUST match the language of the user's question.\n"
                     + map_reduce_rule
                     + _summary_coverage_contract(retrieved)
                     + _citation_contract()
                 )
             else:
                 system_prompt = (
                     "You are a document analysis assistant. Answer the user's question based on the following document sources.\n\n"
                     + SYSTEM_PROMPT_META_RULE
                     + "## Document Sources\n"
                     + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
                     + _retrieval_quality_contract(retrieval_evaluation, retrieval_strategy)
                     + _query_plan_contract(retrieval_plan)
                     + "\n\n## Rules\n" + rules
                     + _citation_contract()
                 )
 
             # Inject custom instructions if present (subordinate to core rules — they are
             # user preferences, not overrides of role/source/citation/safety rules).
             if doc and doc.custom_instructions:
                 system_prompt += (
                     "\n## Custom Instructions\n"
                     "Follow these custom instructions only when they do not conflict with the role, "
                     "data-boundary, source-location, citation, language, or safety rules above:\n"
                     + doc.custom_instructions + "\n"
                 )
 
             # Inject domain-specific rules (legal/academic mode overlay)
             # Frontend always sends domain_mode: null (default) or "legal"/"academic"
             # domain_mode=None means Default (no extra rules), string means apply rules
             if domain_mode:
                 from app.core.model_profiles import DOMAIN_RULES
                 domain_rules = DOMAIN_RULES.get(domain_mode)
                 if domain_rules:
                     base_rule_count = len(rules.strip().split('\n'))
                     domain_rules_text = f"\n\n## {domain_mode.title()} Mode Rules\n"
                     for i, rule in enumerate(domain_rules, start=base_rule_count + 1):
                         domain_rules_text += f"{i}. {rule}\n"
                     system_prompt += domain_rules_text
 
             # Global contracts appended to EVERY branch: source-location grounding (#1)
             # + user-facing terminology guard (#4). (Consensus R2a.)
             system_prompt += _source_location_contract() + _output_terminology_contract()
 
             # Persist domain_mode to session (null clears, string sets) —
-            # see _sync_session_domain_mode's docstring; this is the main
-            # RAG path's call site, mirrored at the tool-action and strict
-            # Quote Finder early returns above (P1 hygiene, Codex 2026-08-03).
-            await _sync_session_domain_mode(db, session_obj, domain_mode)
+            # a PURE assignment, no commit of its own (see
+            # _sync_session_domain_mode's docstring, r2). session_obj is
+            # already tracked by this `db` session (loaded at the top of
+            # chat_stream), so this dirties it in place and rides along
+            # with WHATEVER this path's next commit turns out to be (the
+            # assistant-message draft save below) — never a standalone
+            # commit, so a failure before that point discards it via
+            # rollback just like everything else, and a failure after it
+            # commits it together with the real answer, never separately.
+            _sync_session_domain_mode(session_obj, domain_mode)
 
         except asyncio.CancelledError:
             if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
                 try:
                     with anyio.CancelScope(shield=True):
                         await asyncio.wait_for(
                             _settle_predebit_on_cancel(
                                 user_id=user.id,
                                 pre_debited=pre_debited,
                                 predebit_ledger_id=predebit_ledger_id,
                                 has_answer=False,
                                 prompt_tokens=None,
                                 output_tokens=None,
                                 model=effective_model,
                                 mode=effective_mode,
                             ),
                             timeout=_CANCEL_IO_TIMEOUT_S,
                         )
                     settled = True
                 except Exception:
                     logger.exception(
                         "Failed to settle pre-debit during chat setup cancellation for user %s",
                         user.id,
                     )
             raise
         except Exception as e:
             # FIX3-A(d) (Codex r3 #4, NOT ADDRESSED): this handler now also
             # checks `not settled` — previously it was the ONE generic
             # exception handler in this function that did NOT, so an
             # ordinary exception escaping the strict quote route's own
             # (already-settled) failure handling above would reach here and
             # attempt a SECOND, blind settlement. _refund_predebit's
             # conditional delete (FIX3-A(c)) makes a second attempt safe on
             # its own, but per Codex's prescription a resolver's decision
             # must never be second-guessed by an unconditional fallback —
             # the guard belongs here structurally, not just as a side
             # effect of the delete being idempotent.
             if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
                 try:
                     await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
                     settled = True
                 except Exception:
                     logger.exception(
                         "Failed to refund pre-debited credits during chat setup failure for user %s",
                         user.id,
                     )
             yield _safe_sse("error", setup_error_code, e, session_id=str(session_id))
             return
 
         # 6) Stream from the configured OpenAI-compatible LLM provider
         try:
             client = _get_llm_client(effective_model)
         except Exception as e:
             if user is not None and pre_debited > 0 and predebit_ledger_id is not None:
                 try:
                     await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
                     settled = True
                 except Exception:
                     logger.exception(
                         "Failed to refund pre-debited credits before LLM client setup for user %s",
                         user.id,
                     )
             yield _safe_sse("error", "LLM_ERROR", e, session_id=str(session_id))
             return
 
         # Build OpenAI-format messages (system + history)
         # cache_control is Anthropic-specific — only include for Anthropic models
         profile = get_model_profile(effective_model)
         if profile.supports_cache_control:
             sys_msg: dict = {
                 "role": "system",
                 "content": [
                     {
                         "type": "text",
                         "text": system_prompt,
                         "cache_control": {"type": "ephemeral"},
                     }
                 ],
             }
         else:
diff --git a/backend/tests/test_quote_billing_failure_windows_integration.py b/backend/tests/test_quote_billing_failure_windows_integration.py
index 56a5658..530e491 100644
--- a/backend/tests/test_quote_billing_failure_windows_integration.py
+++ b/backend/tests/test_quote_billing_failure_windows_integration.py
@@ -1,118 +1,119 @@
 """Real-Postgres integration tests for FIX-4 (Codex r1 IMPORTANT #4), FIX2-B
 (Codex r2 #4, NOT ADDRESSED), and FIX3-A (Codex r3 #4, NOT ADDRESSED): both
 billing paths' post-debit failure AND ambiguous-cancellation/failure-
 during-commit windows.
 
 Mocked-db unit tests (test_quotes_api.py, test_quote_intent_routing.py)
 already cover the LOGIC; these tests prove the SAME behavior against a real
 database — real predebit rows, real reconcile failures, real refund
 queries, real CONCURRENT transactions racing for the same ledger row — per
 the reviewer's explicit request that mocks alone aren't sufficient evidence
 for billing-critical cancellation/failure paths.
 
 FIX3-A superseded FIX2-B(c)'s Message/UsageRecord-marker existence check
 (which could only resolve a SEQUENTIAL "did this land before I checked"
 question, not a genuinely concurrent race) with a durable ledger-row state
 (credit_ledger.reconciled_at, stamped under SELECT ... FOR UPDATE by every
 reconcile_credits() call) plus an atomic conditional refund (DELETE ...
 WHERE reconciled_at IS NULL). TestChat/RestDurableSettlement below prove
 three things against real Postgres: (1) sequential "landed"/"never landed"
 end-states resolve correctly (mirrors the old marker-check tests); (2) a
 resolver failure leaves the predebit exactly as it was, no partial state;
 (3) — the REQUIRED reproduction of Codex's exact deterministic-schedule
 finding ("a probe ended at balance 106 from a starting balance of 100,
 [predebit 15, actual_cost 9], with the marker present and its ledger
 deleted") — a REAL concurrent reconcile_credits() and _refund_predebit()
 racing for the same row via asyncio.gather across two independent
 connections, asserting the final balance is NEVER the wrong "reconciled
 AND refunded" value, regardless of which side wins the row lock.
 
 Requires docker (Postgres) — SKIP_INTEGRATION=1 (the default) skips this
 whole file.
 """
 from __future__ import annotations
 
 import asyncio
 import sys
 import uuid
 from pathlib import Path
+from types import SimpleNamespace
 from unittest.mock import AsyncMock
 
 import pytest
 from sqlalchemy import select
 
 BACKEND_DIR = Path(__file__).resolve().parents[1]
 if str(BACKEND_DIR) not in sys.path:
     sys.path.insert(0, str(BACKEND_DIR))
 
 pytestmark = [pytest.mark.integration, pytest.mark.asyncio(loop_scope="session")]
 
 
 async def _grant_credits(user_id: uuid.UUID, amount: int) -> None:
     from app.models.database import AsyncSessionLocal
     from app.services import credit_service
 
     async with AsyncSessionLocal() as db:
         await credit_service.credit_credits(db, user_id, amount, reason="test_grant")
         await db.commit()
 
 
 async def _create_ready_document(user_id: uuid.UUID, *, demo_slug=None) -> uuid.UUID:
     from app.models.database import AsyncSessionLocal
     from app.models.tables import Document
 
     async with AsyncSessionLocal() as db:
         doc = Document(
             filename="integration-test.pdf",
             file_size=100,
             storage_key=f"documents/{uuid.uuid4()}/integration-test.pdf",
             status="ready",
             user_id=user_id,
             demo_slug=demo_slug,
         )
         db.add(doc)
         await db.commit()
         await db.refresh(doc)
         return doc.id
 
 
 async def _ledger_rows_for_user(user_id: uuid.UUID):
     from app.models.database import AsyncSessionLocal
     from app.models.tables import CreditLedger
 
     async with AsyncSessionLocal() as db:
         result = await db.execute(select(CreditLedger).where(CreditLedger.user_id == user_id))
         return list(result.scalars().all())
 
 
 async def _current_balance(user_id: uuid.UUID) -> int:
     from app.models.database import AsyncSessionLocal
     from app.models.tables import User
 
     async with AsyncSessionLocal() as db:
         user = await db.get(User, user_id)
         return user.credits_balance
 
 
 class TestRestReconcileFailureRefund:
     async def test_reconcile_failure_deletes_ledger_row_and_restores_balance(
         self, client, auth_user, auth_headers, monkeypatch,
     ) -> None:
         import app.api.quotes as quotes_api
         from app.services.quote_search_service import QuoteSearchResult
 
         await _grant_credits(auth_user.id, 500)
         document_id = await _create_ready_document(auth_user.id)
         # auth_user's create_user() (and the grant above) may already leave
         # ledger rows / a non-zero balance — assert the DELTA this test
         # causes, not absolute values.
         balance_before = await _current_balance(auth_user.id)
         ledger_ids_before = {row.id for row in await _ledger_rows_for_user(auth_user.id)}
 
         monkeypatch.setattr(
             quotes_api.quote_search_service, "quote_search",
             AsyncMock(return_value=QuoteSearchResult(
                 cards=[], proposed=0, verified=0, discarded=[], scanned_chunks=1,
                 usage=(10, 5), model="deepseek-v4-pro",
             )),
         )
@@ -144,160 +145,361 @@ class TestChatReconcileFailureAfterPersist:
         "predebit stands" test): message-persist + reconcile + usage-record
         are now ONE ATOMIC commit, so an ORDINARY reconcile failure means
         db.commit() is NEVER REACHED — nothing lands, real Postgres included.
         This must now fully refund via the generic setup-phase handler; the
         OLD "predebit stands, answer already persisted" outcome required a
         separate, already-committed message-persist step that no longer
         exists (that separate-commit window was exactly the Codex r2 free-
         ride finding)."""
         import app.services.chat_service as chat_service_module
         from app.models.database import AsyncSessionLocal
         from app.models.tables import ChatSession, Message
         from app.services.quote_search_service import QuoteCard, QuoteSearchResult
 
         await _grant_credits(auth_user.id, 500)
         document_id = await _create_ready_document(auth_user.id)
 
         async with AsyncSessionLocal() as db:
             session = ChatSession(document_id=document_id, user_id=auth_user.id)
             db.add(session)
             await db.commit()
             await db.refresh(session)
             session_id = session.id
 
         monkeypatch.setattr(
             chat_service_module.credit_service, "reconcile_credits",
             AsyncMock(side_effect=RuntimeError("simulated reconcile failure")),
         )
         monkeypatch.setattr(chat_service_module.credit_service, "record_usage", AsyncMock())
         monkeypatch.setattr(
             chat_service_module, "_get_llm_client",
             lambda *_a, **_k: (_ for _ in ()).throw(AssertionError("normal LLM path must not run")),
         )
         card = QuoteCard(
             display_text="the exact clause text", page=1, page_end=1, bboxes=[],
             tier="exact", source_kind="page_text", chunk_id=str(uuid.uuid4()), score=100.0,
         )
         result = QuoteSearchResult(
             cards=[card], proposed=1, verified=1, discarded=[],
             scanned_chunks=2, usage=(300, 80), model="deepseek-v4-pro",
         )
         monkeypatch.setattr(chat_service_module.quote_search_service, "quote_search", AsyncMock(return_value=result))
 
         # auth_user's create_user() may already grant a starting balance and
         # leave ledger rows — assert the DELTA this test causes, not
         # absolute values.
         balance_before = await _current_balance(auth_user.id)
         ledger_ids_before = {row.id for row in await _ledger_rows_for_user(auth_user.id)}
 
         async with AsyncSessionLocal() as db:
             events = [
                 event
                 async for event in chat_service_module.chat_service.chat_stream(
                     session_id=session_id,
                     user_message="Give me a direct quote about the termination clause.",
                     db=db,
                     user=auth_user,
                     mode="balanced",
                 )
             ]
 
         assert events[-1]["event"] == "error"
         assert events[-1]["data"]["code"] == "QUOTE_SEARCH_ERROR"
 
         # The message was NEVER persisted — real Postgres, real transaction
         # rollback (db.add() alone, without a landed commit, leaves no row).
         async with AsyncSessionLocal() as verify_db:
             result = await verify_db.execute(
                 select(Message).where(Message.session_id == session_id, Message.role == "assistant")
             )
             persisted = result.scalars().all()
         assert persisted == []
 
         # Fully refunded — balance and ledger rows exactly restored.
         balance_after = await _current_balance(auth_user.id)
         assert balance_after == balance_before
 
         ledger_ids_after = {row.id for row in await _ledger_rows_for_user(auth_user.id)}
         assert ledger_ids_after == ledger_ids_before  # predebit row deleted, no new row remains
 
 
+class TestDomainModeSyncNeverHalfCommits:
+    """P1 hygiene r2 (Codex, 2026-08-03): the domain_mode session-sync
+    assignment (_sync_session_domain_mode) must ride each branch's OWN
+    existing atomic commit, never a standalone one — a failure at that
+    commit must leave NO half-committed domain_mode, and (for the billed
+    Quote Finder path) no unrefunded charge either. Mirrors this file's
+    established real-Postgres injected-failure pattern: mock a call the
+    atomic commit depends on to raise, letting the REAL rollback run on a
+    REAL connection, then verify the end state via a totally separate,
+    fresh session/connection."""
+
+    async def test_tool_action_commit_failure_leaves_domain_mode_uncommitted(
+        self, auth_user, monkeypatch,
+    ) -> None:
+        """Codex r2's exact tool-action finding: the r1 fix committed the
+        sync BEFORE the tool ran, so a subsequent tool failure left the
+        domain_mode change committed anyway. This reproduces the
+        CORRECTED shape instead — the assignment now happens right before
+        the branch's OWN final commit, inside its exception boundary — by
+        failing THAT commit and proving nothing landed, stale value
+        included."""
+        import app.services.chat_service as chat_service_module
+        from app.models.database import AsyncSessionLocal
+        from app.models.tables import ChatSession, Message
+        from app.services.action_planner import ChatAction
+
+        document_id = await _create_ready_document(auth_user.id)
+
+        async with AsyncSessionLocal() as db:
+            session = ChatSession(
+                document_id=document_id, user_id=auth_user.id,
+                domain_mode="legal", title="Existing title",  # pre-set: skips
+                # _persist_user_message_and_title's conditional 2nd commit,
+                # so exactly ONE commit (the user-message persist) happens
+                # before the tool-action branch's OWN final commit below.
+            )
+            db.add(session)
+            await db.commit()
+            await db.refresh(session)
+            session_id = session.id
+
+        tool_action_plan = SimpleNamespace(
+            action=ChatAction.EXPORT_TABLES, uses_rag_answer_path=False, confidence=0.9,
+            reason="table export markers", user_visible_status="",
+            quote_finder_hint=False, quote_finder_hint_topic=None,
+        )
+        monkeypatch.setattr(chat_service_module.action_planner, "plan", AsyncMock(return_value=tool_action_plan))
+        execution = SimpleNamespace(message="Here are the exported tables.", artifact=None)
+        monkeypatch.setattr(chat_service_module.chat_tool_executor, "execute", AsyncMock(return_value=execution))
+
+        async with AsyncSessionLocal() as db:
+            real_commit = db.commit
+            calls = {"n": 0}
+
+            async def _flaky_commit():
+                calls["n"] += 1
+                if calls["n"] == 1:
+                    return await real_commit()  # the user-message persist commit lands for real
+                raise RuntimeError("simulated tool-action final commit failure")
+
+            monkeypatch.setattr(db, "commit", _flaky_commit)
+
+            events = [
+                event
+                async for event in chat_service_module.chat_service.chat_stream(
+                    session_id=session_id,
+                    user_message="Export all tables to CSV.",
+                    db=db,
+                    user=auth_user,
+                    mode="balanced",
+                    domain_mode=None,  # omitted — should clear the stale "legal" value
+                )
+            ]
+
+        assert events[-1]["event"] == "error"
+        assert events[-1]["data"]["code"] == "CHAT_SETUP_ERROR"
+
+        # Real Postgres, real rollback (via a totally separate connection):
+        # the domain_mode assignment never landed (still the stale
+        # "legal" value), and neither did the assistant message it was
+        # bundled with in the SAME failed commit.
+        async with AsyncSessionLocal() as verify_db:
+            survivor = await verify_db.get(ChatSession, session_id)
+            assert survivor.domain_mode == "legal"  # NOT half-committed to None
+            msg_result = await verify_db.execute(
+                select(Message).where(Message.session_id == session_id, Message.role == "assistant")
+            )
+            assert msg_result.scalars().all() == []
+
+    async def test_quote_finder_commit_failure_leaves_domain_mode_uncommitted_and_fully_refunds(
+        self, auth_user, monkeypatch,
+    ) -> None:
+        """Codex r2's exact Quote Finder finding: the r1 fix committed the
+        sync AFTER the real answer+billing+usage atomic commit succeeded —
+        a failure in that EXTRA, separate commit meant the client got
+        QUOTE_SEARCH_ERROR while the real answer stayed persisted and
+        charged with no way back. This test targets that exact window: a
+        failure AFTER the domain_mode assignment has happened in memory,
+        at the point where a commit was needed to make it durable — unlike
+        TestChatReconcileFailureAfterPersist above (which fails
+        reconcile_credits BEFORE the atomic commit is ever attempted,
+        never reaching the assignment at all), this fails the atomic
+        commit ITSELF, with the assignment already dirtying the session
+        object, proving the corrected fold-in shape rolls BOTH back
+        together rather than leaving one committed and the other not."""
+        import app.services.chat_service as chat_service_module
+        from app.models.database import AsyncSessionLocal
+        from app.models.tables import ChatSession, Message
+        from app.services.quote_search_service import QuoteCard, QuoteSearchResult
+
+        await _grant_credits(auth_user.id, 500)
+        document_id = await _create_ready_document(auth_user.id)
+
+        async with AsyncSessionLocal() as db:
+            session = ChatSession(
+                document_id=document_id, user_id=auth_user.id,
+                domain_mode="legal", title="Existing title",  # pre-set: skips
+                # _persist_user_message_and_title's conditional 2nd commit,
+                # so exactly TWO commits (predebit, user-message persist)
+                # happen before _run_verified_quote_search's OWN atomic
+                # commit — the one this test fails.
+            )
+            db.add(session)
+            await db.commit()
+            await db.refresh(session)
+            session_id = session.id
+
+        monkeypatch.setattr(
+            chat_service_module, "_get_llm_client",
+            lambda *_a, **_k: (_ for _ in ()).throw(AssertionError("normal LLM path must not run")),
+        )
+        card = QuoteCard(
+            display_text="the exact clause text", page=1, page_end=1, bboxes=[],
+            tier="exact", source_kind="page_text", chunk_id=str(uuid.uuid4()), score=100.0,
+        )
+        result = QuoteSearchResult(
+            cards=[card], proposed=1, verified=1, discarded=[],
+            scanned_chunks=2, usage=(300, 80), model="deepseek-v4-pro",
+        )
+        monkeypatch.setattr(chat_service_module.quote_search_service, "quote_search", AsyncMock(return_value=result))
+
+        balance_before = await _current_balance(auth_user.id)
+        ledger_ids_before = {row.id for row in await _ledger_rows_for_user(auth_user.id)}
+
+        async with AsyncSessionLocal() as db:
+            real_commit = db.commit
+            calls = {"n": 0}
+
+            async def _flaky_commit():
+                calls["n"] += 1
+                # Fail ONLY the 3rd call (the atomic quote-finder commit).
+                # Calls 1-2 (predebit, user-message persist) land for real;
+                # call 4+ must ALSO land for real — that's the refund
+                # resolver's OWN commit (_refund_predebit reuses this same
+                # `db` session for ordinary exceptions), which must succeed
+                # normally or the refund itself would be broken by this mock.
+                if calls["n"] == 3:
+                    raise RuntimeError("simulated quote-finder atomic-commit failure")
+                return await real_commit()
+
+            monkeypatch.setattr(db, "commit", _flaky_commit)
+
+            events = [
+                event
+                async for event in chat_service_module.chat_service.chat_stream(
+                    session_id=session_id,
+                    user_message="Give me a direct quote about the termination clause.",
+                    db=db,
+                    user=auth_user,
+                    mode="balanced",
+                    domain_mode=None,  # omitted — should clear the stale "legal" value
+                )
+            ]
+
+        # 4 commits total: predebit, user-message persist, the (failed) atomic
+        # quote-finder commit, and the refund resolver's own commit — confirms
+        # the injected failure landed exactly where intended and the resolver
+        # still ran to completion afterward.
+        assert calls["n"] == 4
+        assert events[-1]["event"] == "error"
+        assert events[-1]["data"]["code"] == "QUOTE_SEARCH_ERROR"
+
+        # Real Postgres, real rollback: the domain_mode assignment and the
+        # assistant message it was bundled into the SAME atomic commit
+        # with never landed together.
+        async with AsyncSessionLocal() as verify_db:
+            survivor = await verify_db.get(ChatSession, session_id)
+            assert survivor.domain_mode == "legal"  # NOT half-committed to None
+            msg_result = await verify_db.execute(
+                select(Message).where(Message.session_id == session_id, Message.role == "assistant")
+            )
+            assert msg_result.scalars().all() == []
+
+        # Fully refunded — no unrefunded charge left behind by the failure.
+        balance_after = await _current_balance(auth_user.id)
+        assert balance_after == balance_before
+
+        ledger_ids_after = {row.id for row in await _ledger_rows_for_user(auth_user.id)}
+        assert ledger_ids_after == ledger_ids_before  # predebit row deleted, no new row remains
+
+
 class TestChatDurableSettlement:
     """FIX3-A (Codex r3 #4, NOT ADDRESSED): chat's settlement resolver,
     proven against REAL Postgres rows and REAL concurrent transactions —
     the durable credit_ledger.reconciled_at marker (stamped under a row
     lock by every reconcile_credits() call) plus the atomic conditional
     refund (_refund_predebit's DELETE ... WHERE reconciled_at IS NULL)
     supersede FIX2-B(c)'s Message-marker existence check entirely."""
 
     async def test_landed_commit_resolves_to_no_refund_exact_ledger_state(self, auth_user) -> None:
         """The atomic commit (message + reconcile + usage) actually ran to
         completion for real — the resolver must recognize it landed (via
         reconciled_at) and must NOT refund; the ledger row must remain at
         its RECONCILED delta, never restored to the raw predebit."""
         import app.services.chat_service as chat_service_module
         from app.models.database import AsyncSessionLocal
         from app.models.tables import ChatSession, Message
         from app.services import credit_service
 
         await _grant_credits(auth_user.id, 500)
         document_id = await _create_ready_document(auth_user.id)
 
         async with AsyncSessionLocal() as db:
             session = ChatSession(document_id=document_id, user_id=auth_user.id)
             db.add(session)
             await db.commit()
             await db.refresh(session)
             session_id = session.id
 
         balance_before = await _current_balance(auth_user.id)
 
         async with AsyncSessionLocal() as db:
             ledger_id = await credit_service.debit_credits(
                 db, user_id=auth_user.id, cost=15, reason="chat", ref_type="mode", ref_id="balanced",
             )
             await db.commit()
 
         # Reproduce _run_verified_quote_search's atomic block for real:
         # message + reconcile + record_usage, ONE commit that genuinely lands.
         message_id = uuid.uuid4()
         async with AsyncSessionLocal() as db:
             asst_msg = Message(
                 id=message_id, session_id=session_id, role="assistant",
                 content="the exact clause text", metadata_json={},
             )
             db.add(asst_msg)
             await credit_service.reconcile_credits(db, auth_user.id, ledger_id, 15, 9)
             await credit_service.record_usage(
                 db, user_id=auth_user.id, message_id=message_id, model="deepseek-v4-pro",
                 prompt_tokens=300, completion_tokens=80, cost_credits=9,
             )
             await db.commit()
 
         # Simulate the cancellation/failure handler running AFTER the fact
         # — exactly as if the caller's own `await db.commit()` had raised
         # despite this commit having genuinely succeeded.
         await chat_service_module._settle_verified_quote_predebit_after_failure(
             user_id=auth_user.id, pre_debited=15, predebit_ledger_id=ledger_id,
             use_independent_session=True,
         )
 
         # No refund — balance reflects the RECONCILED cost (9), not restored
         # to pre-search, and definitely not double-refunded on top of it.
         balance_after = await _current_balance(auth_user.id)
         assert balance_after == balance_before - 9
 
         ledger_rows_after = await _ledger_rows_for_user(auth_user.id)
         reconciled_row = next(r for r in ledger_rows_after if r.id == ledger_id)
         assert reconciled_row.delta == -9  # untouched — still the reconciled amount
         assert reconciled_row.reconciled_at is not None
 
     async def test_never_landed_commit_resolves_to_full_refund_exact_ledger_state(self, auth_user) -> None:
         """The atomic commit never ran at all (simulating a failure that
         struck before it) — the resolver, finding reconciled_at still NULL,
         must refund the full predebit and leave no trace of the row."""
         import app.services.chat_service as chat_service_module
         from app.models.database import AsyncSessionLocal
         from app.services import credit_service
 
         await _grant_credits(auth_user.id, 500)
         balance_before = await _current_balance(auth_user.id)

codex
The patch has the intended high-level shape. I’m narrowing into the current call graph and exception handlers now, especially SQLAlchemy’s post-rollback object state and whether any main-RAG early/late terminal path misses the next commit.
exec
/bin/zsh -lc "rg -n -C 12 \"_sync_session_domain_mode|_tool_action_stream|_run_verified_quote_search|await db\\.commit\\(|await db\\.rollback\\(|yield .*done|return"'$" backend/app/services/chat_service.py' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
791-    SELECT ... FOR UPDATE, FIX3-A(b)), this DELETE blocks until that
792-    transaction resolves, then evaluates the predicate against the
793-    POST-resolution row state — so it never refunds a row that just got
794-    reconciled, and never leaves a genuinely unreconciled row un-refunded.
795-    No read-then-act anywhere.
796-
797-    Returns True if a refund was actually issued (the row was still
798-    unreconciled), False if it was already reconciled or already removed
799-    by a prior settlement — callers use this to distinguish "nothing was
800-    delivered" from "this had already landed" without a separate read.
801-    """
802-    try:
803:        await db.rollback()
804-    except Exception:
805-        pass
806-
807-    result = await db.execute(
808-        sa.delete(CreditLedger)
809-        .where(CreditLedger.id == predebit_ledger_id)
810-        .where(CreditLedger.reconciled_at.is_(None))
811-        .returning(CreditLedger.id)
812-    )
813-    refunded = result.scalar_one_or_none() is not None
814-    if refunded:
815-        await db.execute(
816-            sa.update(User).where(User.id == user_id)
817-            .values(credits_balance=User.credits_balance + pre_debited)
818-        )
819-    else:
820-        logger.info(
821-            "quote_billing.already_settled: ledger %s not refunded (already "
822-            "reconciled or previously removed)", predebit_ledger_id,
823-        )
824:    await db.commit()
825-    return refunded
826-
827-
828-# Bound the shielded cancel-path DB I/O. The persist/settle below run inside an
829-# anyio CancelScope(shield=True) so they survive the request cancellation — but
830-# that also makes them uncancellable, so without a timeout a DB blip during a
831-# client disconnect could pin a task on asyncpg's 60s default connect timeout.
832-_CANCEL_IO_TIMEOUT_S = 5.0
833-
834-
835-async def _persist_partial_on_cancel(
836-    *,
--
913-            await _refund_predebit(settle_db, user_id, pre_debited, predebit_ledger_id)
914-
915-
916-async def _settle_verified_quote_predebit_after_failure(
917-    *,
918-    user_id: uuid.UUID,
919-    pre_debited: int,
920-    predebit_ledger_id: uuid.UUID,
921-    use_independent_session: bool,
922-    db: Optional[AsyncSession] = None,
923-) -> bool:
924-    """FIX3-A (Codex r3 #4, NOT ADDRESSED): the SOLE settlement resolver for
925:    _run_verified_quote_search's failure paths — CancelledError OR an
926-    ordinary exception, replacing FIX2-B(c)'s Message-marker existence
927-    check (which could only resolve the CancelledError case, and still
928-    required a caller-generated id and an independent read).
929-
930-    That marker check is superseded entirely by FIX3-A(b)/(c)'s durable
931-    ledger state: reconcile_credits() now ALWAYS stamps reconciled_at
932-    (including the equal-cost no-op path) under a row lock, and
933-    _refund_predebit's DELETE is now conditional on reconciled_at IS NULL —
934-    a single atomic statement that both checks and acts, with no race
935-    window regardless of whether the atomic commit has landed, is still
936-    landing, or never will. There is nothing left for THIS function to
937-    "decide" — it just calls _refund_predebit with the right session and
--
944-    file.
945-    use_independent_session=False (ordinary exception): reuses the
946-    request's own `db` (rolled back first, inside _refund_predebit) —
947-    matches the existing pattern for non-cancellation failures elsewhere.
948-    """
949-    if use_independent_session:
950-        async with AsyncSessionLocal() as settle_db:
951-            return await _refund_predebit(settle_db, user_id, pre_debited, predebit_ledger_id)
952-    assert db is not None
953-    return await _refund_predebit(db, user_id, pre_debited, predebit_ledger_id)
954-
955-
956:def _sync_session_domain_mode(session_obj: ChatSession, domain_mode: Optional[str]) -> None:
957-    """P1 hygiene (Codex M3 P1 review r1+r2, 2026-08-03): the persisted
958-    ChatSession.domain_mode must reflect the CURRENT request's domain_mode
959-    (null when omitted) on EVERY successful terminal path of chat_stream,
960-    not just the main RAG path this logic originally lived in inline.
961-
962-    r1: Codex found two successful early-return paths that skipped this
963-    entirely — tool actions and strict Quote Finder routing — both
964-    returning before the main RAG path's system-prompt-building section
965-    ever ran. A session that once had domain_mode="legal" persisted could
966-    keep that stale value after a later omitted-mode message that
967-    happened to route to one of those branches.
968-
969-    r2: the first fix (commit 2d4e01a) gave this function its OWN
970:    `await db.commit()`, called separately in each branch — Codex found
971-    THAT was itself a new hazard: a standalone commit outside each
972-    branch's existing transaction boundary creates a new, independent
973-    failure window. Worse, in the tool-action branch the extra commit ran
974-    BEFORE the tool executed, so a subsequent tool failure left the
975-    domain_mode change committed anyway — silently defeating the "sync
976-    only rides successful paths" intent. In the strict Quote Finder
977-    branch, the extra commit ran AFTER the real answer+billing+usage
978-    atomic commit — if IT failed, the client got QUOTE_SEARCH_ERROR while
979-    the real answer stayed persisted and charged with no way back.
980-
981-    Fixed by making this function a PURE, IN-MEMORY ASSIGNMENT with NO I/O
982-    of its own — zero new commit points. Every call site sets the
--
1047-        if repair_metadata:
1048-            metadata_json.update(repair_metadata)
1049-        db.add(
1050-            ProductEvent(
1051-                user_id=user.id if user else None,
1052-                event_name="rag_verification_completed",
1053-                source="chat",
1054-                reason=str(verification.get("status") or "unknown")[:64],
1055-                plan=(user.plan if user else None),
1056-                metadata_json=metadata_json,
1057-            )
1058-        )
1059:        await db.commit()
1060-    except Exception:
1061:        await db.rollback()
1062-        logger.warning("Failed to record RAG verification event", exc_info=True)
1063-
1064-
1065-# ---------------------------
1066-# RefParserFSM
1067-# ---------------------------
1068-
1069-@dataclass
1070-class _ChunkInfo:
1071-    id: uuid.UUID
1072-    page_start: int
1073-    page_end: int
--
1089-class _CitationRepairResult:
1090-    text: str
1091-    citations: List[dict]
1092-    verification: dict
1093-    metadata: dict[str, Any]
1094-    prompt_tokens: int = 0
1095-    output_tokens: int = 0
1096-    applied: bool = False
1097-
1098-
1099-@dataclass
1100-class _VerifiedQuoteOutcome:
1101:    """Result of _run_verified_quote_search (B5) — everything already
1102-    persisted/reconciled; the caller only needs to translate this into SSE
1103-    events."""
1104-    message_id: uuid.UUID
1105-    assistant_text: str
1106-    citations: List[dict]
1107-    artifact_payload: Optional[dict]
1108-
1109-
1110-@dataclass
1111-class _VerifiedQuoteProgress:
1112:    """Mutable out-param for _run_verified_quote_search (B5 cancellation-
1113-    safety fix, review round 1 SHOULD-FIX-2).
1114-
1115-    prompt_tokens/completion_tokens/model are captured right after
1116-    quote_search() returns (before any commit) so accurate billing is
1117-    available regardless of where cancellation strikes. message_id is set
1118-    ONLY after the atomic commit's await ACTUALLY returns — kept for
1119-    logging/observability, but no longer load-bearing for billing
1120-    correctness.
1121-
1122-    FIX3-A (Codex r3 #4, NOT ADDRESSED): billing correctness no longer
1123-    depends on ANY in-memory flag or existence check here — a durable
1124-    marker on the ledger row itself (credit_ledger.reconciled_at, stamped
--
1302-
1303-
1304-class ChatService:
1305-    async def _persist_user_message_and_title(
1306-        self,
1307-        *,
1308-        db: AsyncSession,
1309-        session_id: uuid.UUID,
1310-        user_message: str,
1311-    ) -> None:
1312-        user_msg = Message(session_id=session_id, role="user", content=user_message)
1313-        db.add(user_msg)
1314:        await db.commit()
1315-
1316-        session = await db.get(ChatSession, session_id)
1317-        if session and not session.title:
1318-            clean = user_message.replace("\n", " ").replace("\r", "").strip()
1319-            session.title = clean[:50]
1320:            await db.commit()
1321-
1322:    async def _tool_action_stream(
1323-        self,
1324-        *,
1325-        session_id: uuid.UUID,
1326-        user_message: str,
1327-        db: AsyncSession,
1328-        user: Optional[User],
1329-        locale: Optional[str],
1330-        domain_mode: Optional[str],
1331-        session_obj: ChatSession,
1332-        document_id: uuid.UUID | None,
1333-        collection_doc_ids: list[uuid.UUID],
1334-        action_plan: Any,
--
1369-                        "reason": action_plan.reason,
1370-                    },
1371-                    "artifacts": [artifact_payload] if artifact_payload else [],
1372-                },
1373-            )
1374-            db.add(asst_msg)
1375-            # P1 hygiene r2 (Codex, 2026-08-03): a PURE assignment, set
1376-            # INSIDE this try block right before the branch's own terminal
1377-            # commit — never a standalone commit. If the tool execution
1378-            # above already raised, this line never runs and nothing is
1379-            # dirtied; if THIS commit fails, the except block below rolls
1380-            # everything back together, domain_mode included — never a
1381:            # half-committed sync. See _sync_session_domain_mode's docstring.
1382:            _sync_session_domain_mode(session_obj, domain_mode)
1383:            await db.commit()
1384-            yield sse(
1385-                "done",
1386-                {
1387-                    "message_id": str(asst_msg.id),
1388-                    "citations_count": 0,
1389-                    "verification": None,
1390-                    "can_continue": False,
1391-                    "continuation_count": asst_msg.continuation_count,
1392-                    "artifact_count": 1 if artifact_payload else 0,
1393-                },
1394-            )
1395-        except Exception as exc:
1396:            await db.rollback()
1397-            yield _safe_sse("error", "CHAT_SETUP_ERROR", exc, session_id=str(session_id))
1398-
1399:    async def _run_verified_quote_search(
1400-        self,
1401-        *,
1402-        session_id: uuid.UUID,
1403-        db: AsyncSession,
1404-        document: Document,
1405-        user: User,
1406-        topic: str,
1407-        locale: Optional[str],
1408-        domain_mode: Optional[str],
1409-        session_obj: ChatSession,
1410-        pre_debited: int,
1411-        predebit_ledger_id: uuid.UUID,
--
1526-            user_id=user.id,
1527-            message_id=message_id,
1528-            model=progress.model,
1529-            prompt_tokens=progress.prompt_tokens,
1530-            completion_tokens=progress.completion_tokens,
1531-            cost_credits=actual_cost,
1532-        )
1533-        # P1 hygiene r2 (Codex, 2026-08-03): a PURE assignment, folded
1534-        # INTO this same atomic commit — never a standalone one. The old
1535-        # (r1) fix committed this separately AFTER this block, so a
1536-        # failure in that extra commit meant the client got
1537-        # QUOTE_SEARCH_ERROR while the real answer stayed persisted and
1538:        # charged with no way back. See _sync_session_domain_mode's
1539-        # docstring.
1540:        _sync_session_domain_mode(session_obj, domain_mode)
1541:        await db.commit()
1542-        # Only trustworthy once the atomic commit's await has ACTUALLY
1543-        # returned — the ordinary-exception handler (FIX-4) uses this to
1544-        # know whether a real answer was delivered.
1545-        progress.message_id = message_id
1546-
1547-        return _VerifiedQuoteOutcome(
1548-            message_id=message_id,
1549-            assistant_text=assistant_text,
1550-            citations=citations,
1551-            artifact_payload=artifact_payload,
1552-        )
1553-
--
1571-        5) Build prompt with numbered chunks
1572-        6) Stream Anthropic
1573-        7) Parse with RefParserFSM and yield events; ping every 15s
1574-        8) Save assistant message + citations
1575-        9) Yield done
1576-        """
1577-
1578-        # 1) Load session
1579-        row = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
1580-        session_obj: Optional[ChatSession] = row.scalar_one_or_none()
1581-        if not session_obj:
1582-            yield sse("error", {"code": "SESSION_NOT_FOUND", "message": "会话不存在"})
1583:            return
1584-
1585-        document_id = session_obj.document_id
1586-        collection_id = getattr(session_obj, "collection_id", None)
1587-        is_collection_session = collection_id is not None and document_id is None
1588-
1589-        # Load document for custom instructions (single-doc sessions)
1590-        doc = await db.get(Document, document_id) if document_id else None
1591-
1592-        # For collection sessions, load all document IDs and filenames
1593-        collection_doc_ids: List[uuid.UUID] = []
1594-        collection_doc_names: dict[uuid.UUID, str] = {}
1595-        collection_doc_types: dict[uuid.UUID, str] = {}
--
1624-        # Premium mode gating: require Plus or Pro plan
1625-        if effective_mode in settings.PREMIUM_MODES:
1626-            user_plan = (user.plan or "free").lower() if user else "free"
1627-            if user_plan == "free":
1628-                yield sse(
1629-                    "error",
1630-                    {
1631-                        "code": "MODE_NOT_ALLOWED",
1632-                        "message": "Upgrade to Plus to use this mode",
1633-                        "required_plan": "plus",
1634-                    },
1635-                )
1636:                return
1637-
1638-        action_plan = await action_planner.plan(
1639-            user_message,
1640-            is_collection=is_collection_session,
1641-            locale=locale,
1642-        )
1643-        if not action_plan.uses_rag_answer_path:
1644-            # P1 hygiene r1+r2 (Codex, 2026-08-03): this successful
1645-            # early-return path needs the domain_mode session sync too —
1646:            # the ASSIGNMENT now happens INSIDE _tool_action_stream, right
1647:            # before its own terminal commit (see _sync_session_domain_mode's
1648-            # docstring for why it's not done here as a standalone commit).
1649:            async for ev in self._tool_action_stream(
1650-                session_id=session_id,
1651-                user_message=user_message,
1652-                db=db,
1653-                user=user,
1654-                locale=locale,
1655-                domain_mode=domain_mode,
1656-                session_obj=session_obj,
1657-                document_id=document_id,
1658-                collection_doc_ids=collection_doc_ids,
1659-                action_plan=action_plan,
1660-            ):
1661-                yield ev
1662:            return
1663-
1664-        query_route = query_router.route(
1665-            user_message,
1666-            is_collection=is_collection_session,
1667-            domain_mode=domain_mode,
1668-        )
1669-
1670-        # Pre-debit estimated credits BEFORE streaming (prevents TOCTOU + free rides)
1671-        pre_debited = 0
1672-        predebit_ledger_id = None
1673-        strict_quote_routed = _is_strict_quote_routed(
1674-            action_plan, user=user, document_id=document_id,
--
1685-                credit_service.get_estimated_cost("balanced")
1686-                if strict_quote_routed
1687-                else credit_service.get_estimated_cost(effective_mode)
1688-            )
1689-            if query_route.primary_intent == QueryIntent.DOCUMENT_SUMMARY:
1690-                estimated = max(estimated, estimated * 2)
1691-            predebit_ledger_id = await credit_service.debit_credits(
1692-                db, user_id=user.id, cost=estimated,
1693-                reason="chat", ref_type="mode", ref_id="balanced" if strict_quote_routed else effective_mode,
1694-            )
1695-            if predebit_ledger_id:
1696-                pre_debited = estimated
1697:                await db.commit()
1698-            else:
1699-                balance = await credit_service.get_user_credits(db, user.id)
1700-                yield sse(
1701-                    "error",
1702-                    {
1703-                        "code": "INSUFFICIENT_CREDITS",
1704-                        "message": "Insufficient credits to start chat",
1705-                        "required": estimated,
1706-                        "balance": balance,
1707-                    },
1708-                )
1709:                return
1710-
1711-        settled = False
1712-        setup_error_code = "CHAT_SETUP_ERROR"
1713-        try:
1714-            # 2) Save user message
1715-            await self._persist_user_message_and_title(
1716-                db=db,
1717-                session_id=session_id,
1718-                user_message=user_message,
1719-            )
1720-
1721-            # Strict verbatim-quote chat routing (B5, plan §8.4.3). Gated
--
1724-            # demo, and collection sessions fall through to the normal RAG
1725-            # path below UNCHANGED — the strict intent still matched, but
1726-            # without a real document + billing user the verified pipeline
1727-            # can't run, so this degrades to an ordinary cited answer rather
1728-            # than erroring. SAME predicate (`strict_quote_routed`, computed
1729-            # above) already decided the predebit amount — never re-derive
1730-            # this condition separately (FIX-3: that's exactly how a
1731-            # quick-mode predebit could drift from what actually runs).
1732-            if strict_quote_routed:
1733-                setup_error_code = "QUOTE_SEARCH_ERROR"
1734-                quote_progress = _VerifiedQuoteProgress()
1735-                try:
1736:                    outcome = await self._run_verified_quote_search(
1737-                        session_id=session_id,
1738-                        db=db,
1739-                        document=doc,
1740-                        user=user,
1741-                        topic=user_message,
1742-                        locale=locale,
1743-                        domain_mode=domain_mode,
1744-                        session_obj=session_obj,
1745-                        pre_debited=pre_debited,
1746-                        predebit_ledger_id=predebit_ledger_id,
1747-                        progress=quote_progress,
1748-                    )
--
1808-                                predebit_ledger_id=predebit_ledger_id,
1809-                                use_independent_session=False,
1810-                                db=db,
1811-                            )
1812-                        except Exception:
1813-                            logger.error(
1814-                                "quote_billing.unresolved user=%s ledger=%s pre_debited=%s "
1815-                                "session=%s: settlement resolver failed after an ordinary billing "
1816-                                "exception — predebit left standing, requires manual review.",
1817-                                user.id, predebit_ledger_id, pre_debited, session_id, exc_info=True,
1818-                            )
1819-                            yield _safe_sse("error", "QUOTE_SEARCH_ERROR", exc, session_id=str(session_id))
1820:                            return
1821-                        if not refunded:
1822-                            # The atomic commit had already reconciled — a
1823-                            # real, delivered, persisted answer — this
1824-                            # exception struck AFTER that. Predebit stands
1825-                            # as the charge; never a full refund for a
1826-                            # delivered answer.
1827-                            logger.exception(
1828-                                "Quote-search billing failed after the atomic commit had already "
1829-                                "reconciled (ledger %s) for user %s — predebit stands, no refund.",
1830-                                predebit_ledger_id, user.id,
1831-                            )
1832-                            yield _safe_sse(
1833-                                "error", "QUOTE_SEARCH_BILLING_INCOMPLETE", exc, session_id=str(session_id),
1834-                            )
1835:                            return
1836-                        # Refunded — nothing was delivered.
1837-                        yield _safe_sse("error", "QUOTE_SEARCH_ERROR", exc, session_id=str(session_id))
1838:                        return
1839-                    raise
1840:                # Reconcile already committed inside _run_verified_quote_search —
1841-                # mark settled BEFORE yielding so a cancellation during these
1842-                # yields can't ALSO trigger the setup handler's full refund
1843-                # (double-refund guard, same pattern as the main RAG path).
1844-                # domain_mode was already synced INSIDE that same atomic
1845-                # commit (P1 hygiene r2, Codex 2026-08-03) — nothing left
1846-                # to do here.
1847-                settled = True
1848-                if outcome.artifact_payload:
1849-                    yield sse("artifact", outcome.artifact_payload)
1850-                yield sse("token", {"text": outcome.assistant_text})
1851-                yield sse(
1852-                    "done",
1853-                    {
1854-                        "message_id": str(outcome.message_id),
1855-                        "citations_count": len(outcome.citations),
1856-                        "verification": None,
1857-                        "can_continue": False,
1858-                        "continuation_count": 0,
1859-                        "artifact_count": 1 if outcome.artifact_payload else 0,
1860-                    },
1861-                )
1862:                return
1863-
1864-            # 3) Load history (last N*2 messages before current user msg)
1865-            max_turns = int(settings.MAX_CHAT_HISTORY_TURNS or 6)
1866-            max_msgs = max_turns * 2
1867-            msgs_row = await db.execute(
1868-                select(Message)
1869-                .where(Message.session_id == session_id)
1870-                .order_by(Message.created_at.desc())
1871-                .limit(max_msgs + 1)
1872-            )
1873-            history_msgs: List[Message] = list(msgs_row.scalars().all())
1874-            history_msgs.reverse()  # back to chronological order
--
2114-                    base_rule_count = len(rules.strip().split('\n'))
2115-                    domain_rules_text = f"\n\n## {domain_mode.title()} Mode Rules\n"
2116-                    for i, rule in enumerate(domain_rules, start=base_rule_count + 1):
2117-                        domain_rules_text += f"{i}. {rule}\n"
2118-                    system_prompt += domain_rules_text
2119-
2120-            # Global contracts appended to EVERY branch: source-location grounding (#1)
2121-            # + user-facing terminology guard (#4). (Consensus R2a.)
2122-            system_prompt += _source_location_contract() + _output_terminology_contract()
2123-
2124-            # Persist domain_mode to session (null clears, string sets) —
2125-            # a PURE assignment, no commit of its own (see
2126:            # _sync_session_domain_mode's docstring, r2). session_obj is
2127-            # already tracked by this `db` session (loaded at the top of
2128-            # chat_stream), so this dirties it in place and rides along
2129-            # with WHATEVER this path's next commit turns out to be (the
2130-            # assistant-message draft save below) — never a standalone
2131-            # commit, so a failure before that point discards it via
2132-            # rollback just like everything else, and a failure after it
2133-            # commits it together with the real answer, never separately.
2134:            _sync_session_domain_mode(session_obj, domain_mode)
2135-
2136-        except asyncio.CancelledError:
2137-            if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
2138-                try:
2139-                    with anyio.CancelScope(shield=True):
2140-                        await asyncio.wait_for(
2141-                            _settle_predebit_on_cancel(
2142-                                user_id=user.id,
2143-                                pre_debited=pre_debited,
2144-                                predebit_ledger_id=predebit_ledger_id,
2145-                                has_answer=False,
2146-                                prompt_tokens=None,
--
2170-            # the guard belongs here structurally, not just as a side
2171-            # effect of the delete being idempotent.
2172-            if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
2173-                try:
2174-                    await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
2175-                    settled = True
2176-                except Exception:
2177-                    logger.exception(
2178-                        "Failed to refund pre-debited credits during chat setup failure for user %s",
2179-                        user.id,
2180-                    )
2181-            yield _safe_sse("error", setup_error_code, e, session_id=str(session_id))
2182:            return
2183-
2184-        # 6) Stream from the configured OpenAI-compatible LLM provider
2185-        try:
2186-            client = _get_llm_client(effective_model)
2187-        except Exception as e:
2188-            if user is not None and pre_debited > 0 and predebit_ledger_id is not None:
2189-                try:
2190-                    await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
2191-                    settled = True
2192-                except Exception:
2193-                    logger.exception(
2194-                        "Failed to refund pre-debited credits before LLM client setup for user %s",
2195-                        user.id,
2196-                    )
2197-            yield _safe_sse("error", "LLM_ERROR", e, session_id=str(session_id))
2198:            return
2199-
2200-        # Build OpenAI-format messages (system + history)
2201-        # cache_control is Anthropic-specific — only include for Anthropic models
2202-        profile = get_model_profile(effective_model)
2203-        if profile.supports_cache_control:
2204-            sys_msg: dict = {
2205-                "role": "system",
2206-                "content": [
2207-                    {
2208-                        "type": "text",
2209-                        "text": system_prompt,
2210-                        "cache_control": {"type": "ephemeral"},
--
2322-                    and predebit_ledger_id is not None
2323-                    and not has_partial_answer
2324-                ):
2325-                    try:
2326-                        await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
2327-                        settled = True
2328-                    except Exception:
2329-                        logger.exception(
2330-                            "Failed to refund pre-debited credits after LLM error for user %s",
2331-                            user.id,
2332-                        )
2333-                yield _safe_sse("error", "LLM_ERROR", e, session_id=str(session_id))
2334:                return
2335-
2336-            # 9) Save assistant draft before verification/repair (A2)
2337-            assistant_text = "".join(assistant_text_parts)
2338-            try:
2339-                asst_msg = Message(
2340-                    session_id=session_id,
2341-                    role="assistant",
2342-                    content=assistant_text,
2343-                    citations=citations or None,
2344-                    prompt_tokens=int(prompt_tokens) if prompt_tokens is not None else None,
2345-                    output_tokens=int(output_tokens) if output_tokens is not None else None,
2346-                )
2347-                db.add(asst_msg)
2348:                await db.commit()
2349-                persisted = True
2350-            except Exception:
2351:                await db.rollback()
2352-                has_partial_answer = bool(assistant_text.strip())
2353-                if (
2354-                    user is not None
2355-                    and pre_debited > 0
2356-                    and predebit_ledger_id is not None
2357-                    and not has_partial_answer
2358-                ):
2359-                    try:
2360-                        await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
2361-                        settled = True
2362-                    except Exception:
2363-                        logger.exception(
2364-                            "Failed to refund pre-debited credits after PERSIST_FAILED for user %s",
2365-                            user.id,
2366-                        )
2367-                yield sse("error", {"code": "PERSIST_FAILED", "message": "Failed to save response"})
2368:                return
2369-
2370-            verification_report = claim_verifier_service.verify(
2371-                assistant_text,
2372-                citations,
2373-                set(chunk_map.keys()),
2374-                retrieved_count=len(chunk_map),
2375-            )
2376-            verification_payload = verification_report.to_payload()
2377-            if verification_report.status != "pass" and finish_reason != "length":
2378-                yield sse("tool_status", {"message": "Checking citation support..."})
2379-                repair = await _try_repair_rag_answer(
2380-                    client=client,
--
2437-                elapsed_seconds=focus_elapsed,
2438-            )
2439-            if focus_changed:
2440-                yield sse("citations_refined", {"citations": citations})
2441-
2442-            try:
2443-                if asst_msg is None:
2444-                    raise RuntimeError("assistant message missing before verification update")
2445-                asst_msg.content = assistant_text
2446-                asst_msg.citations = citations or None
2447-                asst_msg.prompt_tokens = int(prompt_tokens) if prompt_tokens is not None else None
2448-                asst_msg.output_tokens = int(output_tokens) if output_tokens is not None else None
2449:                await db.commit()
2450-            except Exception:
2451:                await db.rollback()
2452-                yield sse("error", {"code": "PERSIST_FAILED", "message": "Failed to save response"})
2453:                return
2454-
2455-            await _record_rag_verification_event(
2456-                db,
2457-                user=user,
2458-                message_id=getattr(asst_msg, "id", None),
2459-                verification=verification_payload,
2460-                retrieval_strategy=retrieval_strategy,
2461-                query_route=query_route,
2462-                retrieved_count=len(chunk_map),
2463-                repair_metadata=repair_metadata,
2464-            )
2465-
--
2516-                            cost_credits=summary_cost,
2517-                        )
2518-                    if focus_cost:
2519-                        await credit_service.record_usage(
2520-                            db,
2521-                            user_id=user.id,
2522-                            message_id=asst_msg.id,
2523-                            model=focus_model_used,
2524-                            prompt_tokens=focus_pt,
2525-                            completion_tokens=focus_ct,
2526-                            cost_credits=focus_cost,
2527-                        )
2528:                    await db.commit()
2529-                    settled = True
2530-                except Exception as e:
2531-                    # Non-fatal accounting error
2532-                    yield _safe_sse("warn", "ACCOUNTING_ERROR", e, session_id=str(session_id))
2533-
2534-            # 10) done
2535-            can_continue = asst_msg.continuation_count < settings.MAX_CONTINUATIONS_PER_MESSAGE
2536-            done_emitted = True
2537:            yield sse("done", {
2538-                "message_id": str(asst_msg.id),
2539-                "citations_count": len(citations),
2540-                "verification": verification_payload,
2541-                "repair": repair_metadata,
2542-                "can_continue": can_continue and finish_reason == "length",
2543-                "continuation_count": asst_msg.continuation_count,
2544-                # FIX3-B (Codex r3 #5, NOT ADDRESSED): set when the strict
2545-                # quote trigger matched this message but a negation/
2546-                # metalinguistic token was ALSO present, so verified quote
2547-                # search was deliberately NOT auto-routed/billed (see
2548-                # action_planner.deterministic_plan). Always present
2549-                # (never conditionally omitted) so the frontend has a
--
2611-        db: AsyncSession,
2612-        user: Optional[User] = None,
2613-        locale: Optional[str] = None,
2614-        mode: Optional[str] = None,
2615-    ) -> AsyncGenerator[Dict[str, Any], None]:
2616-        """Continue a truncated assistant response, appending to the existing message."""
2617-
2618-        # 1) Load session
2619-        row = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
2620-        session_obj: Optional[ChatSession] = row.scalar_one_or_none()
2621-        if not session_obj:
2622-            yield sse("error", {"code": "SESSION_NOT_FOUND", "message": "Session not found"})
2623:            return
2624-
2625-        document_id = session_obj.document_id
2626-        collection_id = getattr(session_obj, "collection_id", None)
2627-        is_collection_session = collection_id is not None and document_id is None
2628-
2629-        doc = await db.get(Document, document_id) if document_id else None
2630-
2631-        # For collection sessions, load document names
2632-        collection_doc_names: dict[uuid.UUID, str] = {}
2633-        collection_doc_types: dict[uuid.UUID, str] = {}
2634-        collection_doc_pages: dict[uuid.UUID, int] = {}
2635-        if is_collection_session:
--
2655-        else:
2656-            # Fall back to most recent assistant message in session
2657-            result = await db.execute(
2658-                select(Message)
2659-                .where(Message.session_id == session_id, Message.role == "assistant")
2660-                .order_by(Message.created_at.desc())
2661-                .limit(1)
2662-            )
2663-            asst_msg = result.scalar_one_or_none()
2664-
2665-        if not asst_msg or asst_msg.role != "assistant":
2666-            yield sse("error", {"code": "MESSAGE_NOT_FOUND", "message": "Assistant message not found"})
2667:            return
2668-
2669-        if asst_msg.session_id != session_id:
2670-            yield sse("error", {"code": "MESSAGE_NOT_FOUND", "message": "Message does not belong to this session"})
2671:            return
2672-
2673-        # 3) Check continuation limit
2674-        if asst_msg.continuation_count >= settings.MAX_CONTINUATIONS_PER_MESSAGE:
2675-            yield sse("error", {"code": "CONTINUATION_LIMIT", "message": "Maximum continuations reached"})
2676:            return
2677-
2678-        # 4) Resolve mode → model
2679-        effective_mode = mode if mode in settings.MODE_MODELS else "balanced"
2680-        effective_model = settings.MODE_MODELS[effective_mode]
2681-
2682-        if user is None and doc and doc.demo_slug:
2683-            effective_model = settings.DEMO_LLM_MODEL
2684-            effective_mode = "quick"
2685-
2686-        if effective_mode in settings.PREMIUM_MODES:
2687-            user_plan = (user.plan or "free").lower() if user else "free"
2688-            if user_plan == "free":
2689-                yield sse(
2690-                    "error",
2691-                    {
2692-                        "code": "MODE_NOT_ALLOWED",
2693-                        "message": "Upgrade to Plus to use this mode",
2694-                        "required_plan": "plus",
2695-                    },
2696-                )
2697:                return
2698-
2699-        # 5) Pre-debit credits
2700-        pre_debited = 0
2701-        predebit_ledger_id = None
2702-        if user is not None:
2703-            estimated = credit_service.get_estimated_cost(effective_mode)
2704-            predebit_ledger_id = await credit_service.debit_credits(
2705-                db, user_id=user.id, cost=estimated,
2706-                reason="chat", ref_type="mode", ref_id=effective_mode,
2707-            )
2708-            if predebit_ledger_id:
2709-                pre_debited = estimated
2710:                await db.commit()
2711-            else:
2712-                balance = await credit_service.get_user_credits(db, user.id)
2713-                yield sse("error", {
2714-                    "code": "INSUFFICIENT_CREDITS",
2715-                    "message": "Insufficient credits",
2716-                    "required": estimated,
2717-                    "balance": balance,
2718-                })
2719:                return
2720-
2721-        settled = False
2722-        try:
2723-            # 6) Reconstruct chunk_map from original citations
2724-            chunk_map: dict[int, _ChunkInfo] = {}
2725-            original_citations = asst_msg.citations or []
2726-            if original_citations:
2727-                chunk_ids_set: set[str] = set()
2728-                ref_to_chunk_id: dict[int, str] = {}
2729-                ref_to_citation: dict[int, dict] = {}
2730-                table_ids_set: set[str] = set()
2731-                for cit in original_citations:
--
2897-            raise
2898-        except Exception as e:
2899-            if user is not None and pre_debited > 0 and predebit_ledger_id is not None:
2900-                try:
2901-                    await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
2902-                    settled = True
2903-                except Exception:
2904-                    logger.exception(
2905-                        "Failed to refund pre-debited credits during continuation setup failure for user %s",
2906-                        user.id,
2907-                    )
2908-            yield _safe_sse("error", "CHAT_SETUP_ERROR", e, session_id=str(session_id))
2909:            return
2910-
2911-        # 9) Stream from LLM
2912-        try:
2913-            client = _get_llm_client(effective_model)
2914-        except Exception as e:
2915-            if user is not None and pre_debited > 0 and predebit_ledger_id is not None:
2916-                try:
2917-                    await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
2918-                    settled = True
2919-                except Exception:
2920-                    logger.exception(
2921-                        "Failed to refund pre-debited credits before continuation LLM client setup for user %s",
2922-                        user.id,
2923-                    )
2924-            yield _safe_sse("error", "LLM_ERROR", e, session_id=str(session_id))
2925:            return
2926-        profile = get_model_profile(effective_model)
2927-
2928-        if profile.supports_cache_control:
2929-            sys_msg: dict = {
2930-                "role": "system",
2931-                "content": [{"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}],
2932-            }
2933-        else:
2934-            sys_msg = {"role": "system", "content": system_prompt}
2935-        openai_messages = [sys_msg] + claude_messages
2936-
2937-        continuation_text_parts: List[str] = []
--
3020-                    and predebit_ledger_id is not None
3021-                    and not has_partial_answer
3022-                ):
3023-                    try:
3024-                        await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
3025-                        settled = True
3026-                    except Exception:
3027-                        logger.exception(
3028-                            "Failed to refund pre-debited credits after continuation LLM error for user %s",
3029-                            user.id,
3030-                        )
3031-                yield _safe_sse("error", "LLM_ERROR", e, session_id=str(session_id))
3032:                return
3033-
3034-            # 10) Persist continuation draft before verification/repair (A2)
3035-            continuation_text = "".join(continuation_text_parts)
3036-            full_assistant_text = base_assistant_text + continuation_text
3037-            merged_citations = list(asst_msg.citations or []) + new_citations
3038-            try:
3039-                asst_msg.content = full_assistant_text
3040-                asst_msg.citations = merged_citations if merged_citations else None
3041-                asst_msg.continuation_count = (asst_msg.continuation_count or 0) + 1
3042-                asst_msg.output_tokens = base_output_tokens + int(output_tokens or 0)
3043:                await db.commit()
3044-                persisted = True
3045-            except Exception:
3046:                await db.rollback()
3047-                has_partial_answer = bool(continuation_text.strip())
3048-                if (
3049-                    user is not None
3050-                    and pre_debited > 0
3051-                    and predebit_ledger_id is not None
3052-                    and not has_partial_answer
3053-                ):
3054-                    try:
3055-                        await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
3056-                        settled = True
3057-                    except Exception:
3058-                        logger.exception(
3059-                            "Failed to refund pre-debited credits after continuation PERSIST_FAILED for user %s",
3060-                            user.id,
3061-                        )
3062-                yield sse("error", {"code": "PERSIST_FAILED", "message": "Failed to save continuation"})
3063:                return
3064-
3065-            verification_report = claim_verifier_service.verify(
3066-                full_assistant_text,
3067-                merged_citations,
3068-                set(chunk_map.keys()),
3069-                retrieved_count=len(chunk_map),
3070-            )
3071-            verification_payload = verification_report.to_payload()
3072-            if verification_report.status != "pass" and finish_reason != "length":
3073-                yield sse("tool_status", {"message": "Checking citation support..."})
3074-                repair = await _try_repair_rag_answer(
3075-                    client=client,
--
3128-                chunk_map=chunk_map,
3129-                fallback_model=effective_model,
3130-                user=user,
3131-                elapsed_seconds=focus_elapsed,
3132-            )
3133-            if focus_changed:
3134-                yield sse("citations_refined", {"citations": merged_citations})
3135-
3136-            try:
3137-                asst_msg.content = full_assistant_text
3138-                asst_msg.citations = merged_citations if merged_citations else None
3139-                asst_msg.output_tokens = base_output_tokens + int(output_tokens or 0)
3140:                await db.commit()
3141-            except Exception:
3142:                await db.rollback()
3143-                yield sse("error", {"code": "PERSIST_FAILED", "message": "Failed to save continuation"})
3144:                return
3145-
3146-            await _record_rag_verification_event(
3147-                db,
3148-                user=user,
3149-                message_id=getattr(asst_msg, "id", None),
3150-                verification=verification_payload,
3151-                retrieval_strategy="continuation",
3152-                query_route=None,
3153-                retrieved_count=len(chunk_map),
3154-                repair_metadata=repair_metadata,
3155-            )
3156-
--
3179-                        cost_credits=generation_cost,
3180-                    )
3181-                    if focus_cost:
3182-                        await credit_service.record_usage(
3183-                            db,
3184-                            user_id=user.id,
3185-                            message_id=asst_msg.id,
3186-                            model=focus_model_used,
3187-                            prompt_tokens=focus_pt,
3188-                            completion_tokens=focus_ct,
3189-                            cost_credits=focus_cost,
3190-                        )
3191:                    await db.commit()
3192-                    settled = True
3193-                except Exception as e:
3194-                    yield _safe_sse("warn", "ACCOUNTING_ERROR", e, session_id=str(session_id))
3195-
3196-            # 11) done
3197-            can_continue = asst_msg.continuation_count < settings.MAX_CONTINUATIONS_PER_MESSAGE
3198-            done_emitted = True
3199:            yield sse("done", {
3200-                "message_id": str(asst_msg.id),
3201-                "citations_count": len(merged_citations) if merged_citations else 0,
3202-                "verification": verification_payload,
3203-                "repair": repair_metadata,
3204-                "can_continue": can_continue and finish_reason == "length",
3205-                "continuation_count": asst_msg.continuation_count,
3206-            })
3207-        except asyncio.CancelledError:
3208-            raise
3209-        finally:
3210-            continuation_snapshot = "".join(continuation_text_parts)
3211-            has_partial_answer = bool(continuation_snapshot.strip())

exec
/bin/zsh -lc "sed -n '1300,1565p' backend/app/services/chat_service.py
sed -n '1570,1885p' backend/app/services/chat_service.py
sed -n '1885,2220p' backend/app/services/chat_service.py
sed -n '2220,2605p' backend/app/services/chat_service.py" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
# Chat Service
# ---------------------------


class ChatService:
    async def _persist_user_message_and_title(
        self,
        *,
        db: AsyncSession,
        session_id: uuid.UUID,
        user_message: str,
    ) -> None:
        user_msg = Message(session_id=session_id, role="user", content=user_message)
        db.add(user_msg)
        await db.commit()

        session = await db.get(ChatSession, session_id)
        if session and not session.title:
            clean = user_message.replace("\n", " ").replace("\r", "").strip()
            session.title = clean[:50]
            await db.commit()

    async def _tool_action_stream(
        self,
        *,
        session_id: uuid.UUID,
        user_message: str,
        db: AsyncSession,
        user: Optional[User],
        locale: Optional[str],
        domain_mode: Optional[str],
        session_obj: ChatSession,
        document_id: uuid.UUID | None,
        collection_doc_ids: list[uuid.UUID],
        action_plan: Any,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        try:
            await self._persist_user_message_and_title(
                db=db,
                session_id=session_id,
                user_message=user_message,
            )
            if action_plan.user_visible_status:
                yield sse("tool_status", {"message": action_plan.user_visible_status})
            execution = await chat_tool_executor.execute(
                action_plan,
                user=user,
                db=db,
                document_id=document_id,
                collection_doc_ids=collection_doc_ids,
                locale=locale,
                domain_mode=domain_mode,
            )
            assistant_text = execution.message
            artifact_payload = execution.artifact.to_payload() if execution.artifact else None
            if artifact_payload:
                yield sse("artifact", artifact_payload)
            if assistant_text:
                yield sse("token", {"text": assistant_text})

            asst_msg = Message(
                session_id=session_id,
                role="assistant",
                content=assistant_text,
                citations=(artifact_payload or {}).get("citations") if artifact_payload else None,
                metadata_json={
                    "action_plan": {
                        "action": action_plan.action.value,
                        "confidence": action_plan.confidence,
                        "reason": action_plan.reason,
                    },
                    "artifacts": [artifact_payload] if artifact_payload else [],
                },
            )
            db.add(asst_msg)
            # P1 hygiene r2 (Codex, 2026-08-03): a PURE assignment, set
            # INSIDE this try block right before the branch's own terminal
            # commit — never a standalone commit. If the tool execution
            # above already raised, this line never runs and nothing is
            # dirtied; if THIS commit fails, the except block below rolls
            # everything back together, domain_mode included — never a
            # half-committed sync. See _sync_session_domain_mode's docstring.
            _sync_session_domain_mode(session_obj, domain_mode)
            await db.commit()
            yield sse(
                "done",
                {
                    "message_id": str(asst_msg.id),
                    "citations_count": 0,
                    "verification": None,
                    "can_continue": False,
                    "continuation_count": asst_msg.continuation_count,
                    "artifact_count": 1 if artifact_payload else 0,
                },
            )
        except Exception as exc:
            await db.rollback()
            yield _safe_sse("error", "CHAT_SETUP_ERROR", exc, session_id=str(session_id))

    async def _run_verified_quote_search(
        self,
        *,
        session_id: uuid.UUID,
        db: AsyncSession,
        document: Document,
        user: User,
        topic: str,
        locale: Optional[str],
        domain_mode: Optional[str],
        session_obj: ChatSession,
        pre_debited: int,
        predebit_ledger_id: uuid.UUID,
        progress: "_VerifiedQuoteProgress",
    ) -> "_VerifiedQuoteOutcome":
        """Strict verbatim-quote chat routing (B5, plan §8.4.3).

        Runs B3's verified quote_search in place of the normal LLM answer,
        persists the assistant message, and reconciles + records usage — ALL
        of it awaited here, nothing yielded. `progress` is mutated as this
        proceeds (model/tokens as soon as quote_search() returns,
        `message_id` only once the message commit succeeds) so the CALLER's
        cancellation handler can settle correctly no matter where a
        CancelledError lands — see _VerifiedQuoteProgress's docstring.

        Billing is the CALLER's chat predebit (pre_debited/predebit_ledger_id
        come from the SAME debit_credits() call every RAG-path message
        already goes through) — there is no separate quote-search debit, so
        this can never double-bill. An exception raised before ANY commit
        here propagates to chat_stream's existing setup exception handler
        unchanged, which fully refunds — correct, since nothing was
        delivered.
        """
        result = await quote_search_service.quote_search(
            db, document=document, user=user, topic=topic, locale=locale or "",
        )
        progress.prompt_tokens, progress.completion_tokens = result.usage
        progress.model = result.model

        citations: List[dict] = []
        artifact_payload: Optional[dict] = None
        if result.cards:
            for idx, card in enumerate(result.cards, start=1):
                citations.append({
                    "ref_index": idx,
                    "chunk_id": card.chunk_id,
                    "page": card.page,
                    "page_end": card.page_end,
                    "bboxes": card.bboxes,
                    "text_snippet": card.display_text[:100],
                    "offset": 0,
                    "focus_snippet": card.display_text,
                    "confidence_score": round(card.score / 100.0, 3),
                    "context_text": card.display_text[:900],
                    "document_id": str(document.id),
                    "source_kind": card.source_kind,
                })
            assistant_text = _quote_search_copy(_QUOTE_SEARCH_FOUND_COPY, locale, n=len(result.cards))
            # Reuse the extraction-artifact SSE mechanism exactly (MINOR-3,
            # review round 1) rather than hand-building the payload shape.
            artifact = ChatArtifact(
                artifact_type="quote_search",
                status="succeeded",
                title="Verified Quotes",
                summary=assistant_text,
                preview={
                    "cards": [
                        {
                            "ref_index": idx,
                            "display_text": card.display_text,
                            "page": card.page,
                            "page_end": card.page_end,
                            "tier": card.tier,
                            "source_kind": card.source_kind,
                            "score": card.score,
                        }
                        for idx, card in enumerate(result.cards, start=1)
                    ],
                    "proposed": result.proposed,
                    "verified": result.verified,
                    "discarded_count": len(result.discarded),
                    "scanned_chunks": result.scanned_chunks,
                },
                citations=citations,
            )
            artifact_payload = artifact.to_payload()
        else:
            # Verified-empty: the honest message, never an unverified fallback answer.
            assistant_text = _quote_search_copy(_QUOTE_SEARCH_EMPTY_COPY, locale, n=result.scanned_chunks)

        message_id = uuid.uuid4()
        asst_msg = Message(
            id=message_id,
            session_id=session_id,
            role="assistant",
            content=assistant_text,
            citations=citations or None,
            metadata_json={
                "action_plan": {
                    "action": ChatAction.VERIFIED_QUOTE_SEARCH.value,
                    "confidence": 1.0,
                    "reason": "strict verbatim-quote markers",
                },
                "artifacts": [artifact_payload] if artifact_payload else [],
            },
        )
        db.add(asst_msg)

        # FIX2-B(a) (Codex r2 #4, NOT ADDRESSED): message-persist + reconcile
        # + usage-record are now ONE ATOMIC commit — no intermediate commit
        # between the message add and the billing settlement. This removes
        # the "message persisted but billing never reconciled" class of
        # ordinary-exception free-ride entirely: either the whole
        # transaction lands together, or none of it does. FIX3-A (Codex r3
        # #4): reconcile_credits() below durably stamps
        # credit_ledger.reconciled_at under a row lock — the caller's
        # exception handlers resolve any failure here (CancelledError or
        # ordinary) via that marker + an atomic conditional refund, never
        # an in-memory flag or existence check.
        actual_cost = credit_service.calculate_cost(
            progress.prompt_tokens, progress.completion_tokens, progress.model, mode="balanced",
        )
        await credit_service.reconcile_credits(
            db, user.id, predebit_ledger_id, pre_debited, actual_cost,
        )
        await credit_service.record_usage(
            db,
            user_id=user.id,
            message_id=message_id,
            model=progress.model,
            prompt_tokens=progress.prompt_tokens,
            completion_tokens=progress.completion_tokens,
            cost_credits=actual_cost,
        )
        # P1 hygiene r2 (Codex, 2026-08-03): a PURE assignment, folded
        # INTO this same atomic commit — never a standalone one. The old
        # (r1) fix committed this separately AFTER this block, so a
        # failure in that extra commit meant the client got
        # QUOTE_SEARCH_ERROR while the real answer stayed persisted and
        # charged with no way back. See _sync_session_domain_mode's
        # docstring.
        _sync_session_domain_mode(session_obj, domain_mode)
        await db.commit()
        # Only trustworthy once the atomic commit's await has ACTUALLY
        # returned — the ordinary-exception handler (FIX-4) uses this to
        # know whether a real answer was delivered.
        progress.message_id = message_id

        return _VerifiedQuoteOutcome(
            message_id=message_id,
            assistant_text=assistant_text,
            citations=citations,
            artifact_payload=artifact_payload,
        )

    async def chat_stream(
        self,
        session_id: uuid.UUID,
        user_message: str,
        db: AsyncSession,
        user: Optional[User] = None,
        locale: Optional[str] = None,
        mode: Optional[str] = None,
        domain_mode: Optional[str] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Main chat streaming generator producing SSE event dicts.

        4) Retrieval top-5
        5) Build prompt with numbered chunks
        6) Stream Anthropic
        7) Parse with RefParserFSM and yield events; ping every 15s
        8) Save assistant message + citations
        9) Yield done
        """

        # 1) Load session
        row = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
        session_obj: Optional[ChatSession] = row.scalar_one_or_none()
        if not session_obj:
            yield sse("error", {"code": "SESSION_NOT_FOUND", "message": "会话不存在"})
            return

        document_id = session_obj.document_id
        collection_id = getattr(session_obj, "collection_id", None)
        is_collection_session = collection_id is not None and document_id is None

        # Load document for custom instructions (single-doc sessions)
        doc = await db.get(Document, document_id) if document_id else None

        # For collection sessions, load all document IDs and filenames
        collection_doc_ids: List[uuid.UUID] = []
        collection_doc_names: dict[uuid.UUID, str] = {}
        collection_doc_types: dict[uuid.UUID, str] = {}
        collection_doc_pages: dict[uuid.UUID, int] = {}
        if is_collection_session:
            cd_rows = await db.execute(
                select(collection_documents.c.document_id).where(
                    collection_documents.c.collection_id == collection_id
                )
            )
            collection_doc_ids = [row[0] for row in cd_rows.all()]
            if collection_doc_ids:
                doc_rows = await db.execute(
                    select(Document.id, Document.filename, Document.file_type, Document.page_count)
                    .where(Document.id.in_(collection_doc_ids))
                )
                for drow in doc_rows.all():
                    collection_doc_names[drow[0]] = drow[1]
                    collection_doc_types[drow[0]] = drow[2]
                    if drow[3]:
                        collection_doc_pages[drow[0]] = drow[3]

        # Resolve mode → model (mode is the ONLY way to select a model)
        effective_mode = mode if mode in settings.MODE_MODELS else "balanced"
        effective_model = settings.MODE_MODELS[effective_mode]

        # Force demo model for anonymous users on demo documents
        if user is None and doc and doc.demo_slug:
            effective_model = settings.DEMO_LLM_MODEL
            effective_mode = "quick"

        # Premium mode gating: require Plus or Pro plan
        if effective_mode in settings.PREMIUM_MODES:
            user_plan = (user.plan or "free").lower() if user else "free"
            if user_plan == "free":
                yield sse(
                    "error",
                    {
                        "code": "MODE_NOT_ALLOWED",
                        "message": "Upgrade to Plus to use this mode",
                        "required_plan": "plus",
                    },
                )
                return

        action_plan = await action_planner.plan(
            user_message,
            is_collection=is_collection_session,
            locale=locale,
        )
        if not action_plan.uses_rag_answer_path:
            # P1 hygiene r1+r2 (Codex, 2026-08-03): this successful
            # early-return path needs the domain_mode session sync too —
            # the ASSIGNMENT now happens INSIDE _tool_action_stream, right
            # before its own terminal commit (see _sync_session_domain_mode's
            # docstring for why it's not done here as a standalone commit).
            async for ev in self._tool_action_stream(
                session_id=session_id,
                user_message=user_message,
                db=db,
                user=user,
                locale=locale,
                domain_mode=domain_mode,
                session_obj=session_obj,
                document_id=document_id,
                collection_doc_ids=collection_doc_ids,
                action_plan=action_plan,
            ):
                yield ev
            return

        query_route = query_router.route(
            user_message,
            is_collection=is_collection_session,
            domain_mode=domain_mode,
        )

        # Pre-debit estimated credits BEFORE streaming (prevents TOCTOU + free rides)
        pre_debited = 0
        predebit_ledger_id = None
        strict_quote_routed = _is_strict_quote_routed(
            action_plan, user=user, document_id=document_id,
            is_collection_session=is_collection_session, doc=doc,
        )
        if user is not None:
            # FIX-3 (Codex r1 BLOCKER #3): a strict-routed message ALWAYS
            # runs the balanced-model quote engine regardless of the
            # user-selected chat mode — predebit must reflect that real
            # cost, not `effective_mode`'s (e.g. quick=5), or a low-balance
            # user could reserve too little and reconciliation would push
            # their account negative to cover the overrun.
            estimated = (
                credit_service.get_estimated_cost("balanced")
                if strict_quote_routed
                else credit_service.get_estimated_cost(effective_mode)
            )
            if query_route.primary_intent == QueryIntent.DOCUMENT_SUMMARY:
                estimated = max(estimated, estimated * 2)
            predebit_ledger_id = await credit_service.debit_credits(
                db, user_id=user.id, cost=estimated,
                reason="chat", ref_type="mode", ref_id="balanced" if strict_quote_routed else effective_mode,
            )
            if predebit_ledger_id:
                pre_debited = estimated
                await db.commit()
            else:
                balance = await credit_service.get_user_credits(db, user.id)
                yield sse(
                    "error",
                    {
                        "code": "INSUFFICIENT_CREDITS",
                        "message": "Insufficient credits to start chat",
                        "required": estimated,
                        "balance": balance,
                    },
                )
                return

        settled = False
        setup_error_code = "CHAT_SETUP_ERROR"
        try:
            # 2) Save user message
            await self._persist_user_message_and_title(
                db=db,
                session_id=session_id,
                user_message=user_message,
            )

            # Strict verbatim-quote chat routing (B5, plan §8.4.3). Gated
            # here (not in the planner, which has no auth/doc context):
            # AUTHED, non-demo, single-document sessions only. Anonymous,
            # demo, and collection sessions fall through to the normal RAG
            # path below UNCHANGED — the strict intent still matched, but
            # without a real document + billing user the verified pipeline
            # can't run, so this degrades to an ordinary cited answer rather
            # than erroring. SAME predicate (`strict_quote_routed`, computed
            # above) already decided the predebit amount — never re-derive
            # this condition separately (FIX-3: that's exactly how a
            # quick-mode predebit could drift from what actually runs).
            if strict_quote_routed:
                setup_error_code = "QUOTE_SEARCH_ERROR"
                quote_progress = _VerifiedQuoteProgress()
                try:
                    outcome = await self._run_verified_quote_search(
                        session_id=session_id,
                        db=db,
                        document=doc,
                        user=user,
                        topic=user_message,
                        locale=locale,
                        domain_mode=domain_mode,
                        session_obj=session_obj,
                        pre_debited=pre_debited,
                        predebit_ledger_id=predebit_ledger_id,
                        progress=quote_progress,
                    )
                except asyncio.CancelledError:
                    # FIX3-A(d) (Codex r3 #4, NOT ADDRESSED): `settled` is
                    # marked BEFORE the resolver even runs — regardless of
                    # whether it succeeds — so the outer generic handler
                    # (which now also checks `not settled`, see below) can
                    # NEVER also attempt its own blind settlement. That was
                    # the exact "special resolver errors out, outer handler
                    # falls back to blind settlement" gap Codex r3 found.
                    # The resolver itself is the durable, race-free
                    # reconciled_at + conditional-delete design (FIX3-A(b)/
                    # (c)) — correct regardless of whether the atomic commit
                    # already landed, is still landing, or never will.
                    if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
                        settled = True
                        try:
                            with anyio.CancelScope(shield=True):
                                refunded = await asyncio.wait_for(
                                    _settle_verified_quote_predebit_after_failure(
                                        user_id=user.id,
                                        pre_debited=pre_debited,
                                        predebit_ledger_id=predebit_ledger_id,
                                        use_independent_session=True,
                                    ),
                                    timeout=_CANCEL_IO_TIMEOUT_S,
                                )
                            if not refunded:
                                logger.info(
                                    "quote_billing.settled_no_refund user=%s ledger=%s: cancellation "
                                    "after the atomic commit had already reconciled — predebit stands.",
                                    user.id, predebit_ledger_id,
                                )
                        except Exception:
                            # FIX3-A(d): resolver failure must NEVER fall
                            # through to ANY further settlement attempt —
                            # leave the predebit standing and surface it to
                            # ops for manual review.
                            logger.error(
                                "quote_billing.unresolved user=%s ledger=%s pre_debited=%s "
                                "session=%s: settlement resolver failed during cancellation — "
                                "predebit left standing, requires manual review.",
                                user.id, predebit_ledger_id, pre_debited, session_id, exc_info=True,
                            )
                    raise
                except Exception as exc:
                    # FIX3-A(d) (Codex r3 #4, NOT ADDRESSED): ALL final-
                    # commit exceptions — not just CancelledError — now
                    # route through the SAME resolver as the branch above,
                    # closing the "ordinary 'server committed but COMMIT
                    # response was lost' exception leaves progress.message_id
                    # unset and reaches the generic (blind) refund path"
                    # gap Codex r3 found. `settled` is marked BEFORE the
                    # resolver runs, same reasoning as the CancelledError
                    # branch.
                    if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
                        settled = True
                        try:
                            refunded = await _settle_verified_quote_predebit_after_failure(
                                user_id=user.id,
                                pre_debited=pre_debited,
                                predebit_ledger_id=predebit_ledger_id,
                                use_independent_session=False,
                                db=db,
                            )
                        except Exception:
                            logger.error(
                                "quote_billing.unresolved user=%s ledger=%s pre_debited=%s "
                                "session=%s: settlement resolver failed after an ordinary billing "
                                "exception — predebit left standing, requires manual review.",
                                user.id, predebit_ledger_id, pre_debited, session_id, exc_info=True,
                            )
                            yield _safe_sse("error", "QUOTE_SEARCH_ERROR", exc, session_id=str(session_id))
                            return
                        if not refunded:
                            # The atomic commit had already reconciled — a
                            # real, delivered, persisted answer — this
                            # exception struck AFTER that. Predebit stands
                            # as the charge; never a full refund for a
                            # delivered answer.
                            logger.exception(
                                "Quote-search billing failed after the atomic commit had already "
                                "reconciled (ledger %s) for user %s — predebit stands, no refund.",
                                predebit_ledger_id, user.id,
                            )
                            yield _safe_sse(
                                "error", "QUOTE_SEARCH_BILLING_INCOMPLETE", exc, session_id=str(session_id),
                            )
                            return
                        # Refunded — nothing was delivered.
                        yield _safe_sse("error", "QUOTE_SEARCH_ERROR", exc, session_id=str(session_id))
                        return
                    raise
                # Reconcile already committed inside _run_verified_quote_search —
                # mark settled BEFORE yielding so a cancellation during these
                # yields can't ALSO trigger the setup handler's full refund
                # (double-refund guard, same pattern as the main RAG path).
                # domain_mode was already synced INSIDE that same atomic
                # commit (P1 hygiene r2, Codex 2026-08-03) — nothing left
                # to do here.
                settled = True
                if outcome.artifact_payload:
                    yield sse("artifact", outcome.artifact_payload)
                yield sse("token", {"text": outcome.assistant_text})
                yield sse(
                    "done",
                    {
                        "message_id": str(outcome.message_id),
                        "citations_count": len(outcome.citations),
                        "verification": None,
                        "can_continue": False,
                        "continuation_count": 0,
                        "artifact_count": 1 if outcome.artifact_payload else 0,
                    },
                )
                return

            # 3) Load history (last N*2 messages before current user msg)
            max_turns = int(settings.MAX_CHAT_HISTORY_TURNS or 6)
            max_msgs = max_turns * 2
            msgs_row = await db.execute(
                select(Message)
                .where(Message.session_id == session_id)
                .order_by(Message.created_at.desc())
                .limit(max_msgs + 1)
            )
            history_msgs: List[Message] = list(msgs_row.scalars().all())
            history_msgs.reverse()  # back to chronological order

            # Convert to Claude message format (excluding system)
            claude_messages: List[dict] = []
            for m in history_msgs:
                claude_messages.append({"role": m.role, "content": m.content})

            # 4) Route + retrieval (with error handling — e.g. Qdrant down or no vectors yet).
            # Whole-document summaries must not use ordinary semantic top-k: vague
            # summary prompts frequently retrieve tables/appendices instead of
            # representative document structure. Route them to an ordered context
            # selector until the durable hierarchical brief index lands.
            # selector until the durable hierarchical brief index lands.
            setup_error_code = "RETRIEVAL_ERROR"
            retrieval_strategy = "semantic_top_k"
            retrieval_evaluation = None
            retrieval_plan: QueryPlan | None = None
            summary_usage = MapReduceUsageCollector()
            if (
                query_route.primary_intent == QueryIntent.DOCUMENT_SUMMARY
                and document_id
                and not is_collection_session
            ):
                yield sse("tool_status", {"message": "Summarizing the document section by section…"})
                retrieved = await document_brief_service.get_summary_context(
                    db,
                    document_id,
                    max_chunks=18,
                    usage_collector=summary_usage,
                )
                retrieval_strategy = "document_summary_context"
            elif (
                query_route.primary_intent == QueryIntent.DOCUMENT_SUMMARY
                and is_collection_session
                and collection_doc_ids
            ):
                retrieved = await document_brief_service.get_collection_summary_context(
                    db,
                    collection_doc_ids,
                    max_chunks=24,
                    max_docs=8,
                )
                retrieval_strategy = "collection_summary_context"
            elif is_collection_session and collection_doc_ids:
                corrective = await corrective_retrieval_service.retrieve_multi(
                    user_message,
                    query_route,
                    collection_doc_ids,
                    top_k=8,
                    db=db,
                )
                retrieved = corrective.retrieved
                retrieval_strategy = corrective.strategy
                retrieval_evaluation = corrective.evaluation
                retrieval_plan = corrective.plan
            elif (
                document_id
                and query_route.primary_intent == QueryIntent.PAGE_LOOKUP
                and query_route.page_ref is not None
            ):
                retrieved = await _fetch_page_chunks(db, document_id, query_route.page_ref)
                retrieval_strategy = "page_lookup"
                if not retrieved:
                    # Only a PURE page lookup ("what is on page N") skips fallback: answering
                    # from semantically-similar chunks on OTHER pages gives a wrong-page answer,
                    # so the Source Locations contract makes the model say page N wasn't found.
                    # A MIXED page+topic/table query (intents has more than PAGE_LOOKUP, e.g.
                    # "table on page 8", "requirements on page 12") still needs its evidence —
                    # fall back to semantic retrieval. (Consensus R2a #1 + Codex r2a review.)
                    is_pure_page_lookup = query_route.intents == (QueryIntent.PAGE_LOOKUP,)
                    if is_pure_page_lookup:
                        retrieved = []
                        retrieval_strategy = "page_lookup_miss"
                    else:
                        corrective = await corrective_retrieval_service.retrieve_single(
                            user_message, query_route, document_id, top_k=8, db=db,
                            doc_pages=getattr(doc, "page_count", None),
                        )
                        retrieved = corrective.retrieved
                        retrieval_strategy = corrective.strategy
                        retrieval_evaluation = corrective.evaluation
                        retrieval_plan = corrective.plan
            elif document_id:
                corrective = await corrective_retrieval_service.retrieve_single(
                    user_message,
                    query_route,
                    document_id,
                    top_k=8,
                    db=db,
                    doc_pages=getattr(doc, "page_count", None),
                )
                retrieved = corrective.retrieved
                retrieval_strategy = corrective.strategy
                retrieval_evaluation = corrective.evaluation
                retrieval_plan = corrective.plan
            else:
                retrieved = []

            # 5) Build prompt (system)
            setup_error_code = "CHAT_SETUP_ERROR"
            numbered_chunks: List[str] = []
            chunk_map: dict[int, _ChunkInfo] = {}
            has_map_reduce_summary_context = any(
                item.get("retrieval_modality") == "summary"
                or item.get("map_reduce_strategy") == "map_reduce"
                for item in retrieved
            )
            for idx, item in enumerate(retrieved, start=1):
                # Heuristic truncation to ~350 tokens (roughly 1200-1400 chars)
                text = item["text"] or ""
                truncated = text[:1400]
                chunk_doc_id = item.get("document_id")
                doc_label = ""
                if is_collection_session and chunk_doc_id:
                    fname = collection_doc_names.get(chunk_doc_id, "")
                    if fname:
                        doc_label = f"(from: {fname}) "
                # File-type-aware source location (page/slide/sheet/part), gated for reliability.
                if is_collection_session and chunk_doc_id:
                    chunk_ft = collection_doc_types.get(chunk_doc_id)
                    chunk_pages = collection_doc_pages.get(chunk_doc_id)
                else:
                    chunk_ft = getattr(doc, "file_type", None)
                    chunk_pages = getattr(doc, "page_count", None)
                src = _source_locator(item, chunk_ft, chunk_pages)
                src_label = f"({src}) " if src else ""
                plan_label = _safe_plan_label(item.get("retrieval_plan_step"))
                evidence_label = f"(evidence: {plan_label}) " if plan_label else ""
                numbered_chunks.append(f"[{idx}] {doc_label}{src_label}{evidence_label}{truncated}")
                chunk_map[idx] = _ChunkInfo(
                    id=item["chunk_id"],
                    page_start=int(item["page"]),
                    page_end=int(item.get("page_end", item["page"])),
                    bboxes=item.get("bboxes") or [],
                    text=text,
                    section_title=item.get("section_title") or "",
                    document_id=chunk_doc_id if chunk_doc_id else document_id,
                    document_filename=collection_doc_names.get(chunk_doc_id, "")
                    if chunk_doc_id
                    else "",
                    score=item.get("score", 0.0),
                    table_id=str(item.get("table_id")) if item.get("table_id") else None,
                    retrieval_modality=str(item.get("retrieval_modality") or "text"),
                    summary_target_sections=tuple(item.get("map_reduce_target_sections") or ()),
                    summary_model_covered_sections=tuple(
                        item.get("map_reduce_model_covered_sections") or ()
                    ),
                    summary_fallback_sections=tuple(item.get("map_reduce_fallback_sections") or ()),
                    summary_missing_sections=tuple(item.get("map_reduce_missing_sections") or ()),
                )

            rules = get_rules_for_model(
                effective_model, is_collection=is_collection_session
            )

            if is_collection_session and retrieval_strategy == "collection_summary_context":
                doc_list = ", ".join(collection_doc_names.values()) if collection_doc_names else "(no documents)"
                system_prompt = (
                    "You are a document analysis assistant. The user is asking for a broad summary across a document collection.\n\n"
                    + SYSTEM_PROMPT_META_RULE
                    + f"## Available Documents\n{doc_list}\n\n"
                    + "## Collection Coverage Sources\n"
                    + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
                    + "\n\n## Summary Rules\n"
                    + "1. Treat these sources as representative coverage selected across the collection, not as semantic search results for a narrow question.\n"
                    + "2. Do NOT say the collection is just unrelated sections merely because the context is selective.\n"
                    + "3. Summarize shared themes, document-specific points, and important caveats when supported.\n"
                    + "4. If coverage is incomplete, say the answer is based on the cited representative sections instead of refusing.\n"
                    + "5. Cite every factual paragraph or bullet using the source numbers listed above.\n"
                    + "6. Your response language MUST match the language of the user's question.\n"
                    + _citation_contract()
                )
            elif is_collection_session:
                doc_list = ", ".join(collection_doc_names.values()) if collection_doc_names else "(no documents)"
                system_prompt = (
                    "You are a document analysis assistant. Answer the user's question based on sources from multiple documents.\n\n"
                    + SYSTEM_PROMPT_META_RULE
                    + f"## Available Documents\n{doc_list}\n\n"
                    + "## Document Sources\n"
                    + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
                    + _retrieval_quality_contract(retrieval_evaluation, retrieval_strategy)
                    + _query_plan_contract(retrieval_plan)
                    + "\n\n## Rules\n" + rules
                    + _citation_contract()
                )
            elif retrieval_strategy == "document_summary_context":
                map_reduce_rule = (
                    "7. The sources may be map-reduce section summaries generated from source chunks; "
                    "use the coverage status to distinguish model-covered, fallback, and missing sections.\n"
                    if has_map_reduce_summary_context
                    else ""
                )
                system_prompt = (
                    "You are a document analysis assistant. The user is asking for a broad, whole-document summary.\n\n"
                    + SYSTEM_PROMPT_META_RULE
                    + "## Document Coverage Sources\n"
                    + (
                        "\n".join(numbered_chunks)
                        if numbered_chunks
                        else "(none)"
                    )
                    + "\n\n## Summary Rules\n"
                    + "1. Treat these sources as representative coverage selected across the document, not as semantic search results for a narrow question.\n"
                    + "2. Do NOT say the user's ready document is not a complete document merely because the context is selective.\n"
                    + "3. Produce a useful document-level summary with clear headings, key points, and important caveats when supported.\n"
                    + "4. If coverage is incomplete, say the answer is based on the cited representative sections instead of refusing.\n"
                    + "5. Cite every factual paragraph or bullet using the source numbers listed above.\n"
                    + "6. Your response language MUST match the language of the user's question.\n"
                    + map_reduce_rule
                    + _summary_coverage_contract(retrieved)
                    + _citation_contract()
                )
            else:
                system_prompt = (
                    "You are a document analysis assistant. Answer the user's question based on the following document sources.\n\n"
                    + SYSTEM_PROMPT_META_RULE
                    + "## Document Sources\n"
                    + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
                    + _retrieval_quality_contract(retrieval_evaluation, retrieval_strategy)
                    + _query_plan_contract(retrieval_plan)
                    + "\n\n## Rules\n" + rules
                    + _citation_contract()
                )

            # Inject custom instructions if present (subordinate to core rules — they are
            # user preferences, not overrides of role/source/citation/safety rules).
            if doc and doc.custom_instructions:
                system_prompt += (
                    "\n## Custom Instructions\n"
                    "Follow these custom instructions only when they do not conflict with the role, "
                    "data-boundary, source-location, citation, language, or safety rules above:\n"
                    + doc.custom_instructions + "\n"
                )

            # Inject domain-specific rules (legal/academic mode overlay)
            # Frontend always sends domain_mode: null (default) or "legal"/"academic"
            # domain_mode=None means Default (no extra rules), string means apply rules
            if domain_mode:
                from app.core.model_profiles import DOMAIN_RULES
                domain_rules = DOMAIN_RULES.get(domain_mode)
                if domain_rules:
                    base_rule_count = len(rules.strip().split('\n'))
                    domain_rules_text = f"\n\n## {domain_mode.title()} Mode Rules\n"
                    for i, rule in enumerate(domain_rules, start=base_rule_count + 1):
                        domain_rules_text += f"{i}. {rule}\n"
                    system_prompt += domain_rules_text

            # Global contracts appended to EVERY branch: source-location grounding (#1)
            # + user-facing terminology guard (#4). (Consensus R2a.)
            system_prompt += _source_location_contract() + _output_terminology_contract()

            # Persist domain_mode to session (null clears, string sets) —
            # a PURE assignment, no commit of its own (see
            # _sync_session_domain_mode's docstring, r2). session_obj is
            # already tracked by this `db` session (loaded at the top of
            # chat_stream), so this dirties it in place and rides along
            # with WHATEVER this path's next commit turns out to be (the
            # assistant-message draft save below) — never a standalone
            # commit, so a failure before that point discards it via
            # rollback just like everything else, and a failure after it
            # commits it together with the real answer, never separately.
            _sync_session_domain_mode(session_obj, domain_mode)

        except asyncio.CancelledError:
            if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
                try:
                    with anyio.CancelScope(shield=True):
                        await asyncio.wait_for(
                            _settle_predebit_on_cancel(
                                user_id=user.id,
                                pre_debited=pre_debited,
                                predebit_ledger_id=predebit_ledger_id,
                                has_answer=False,
                                prompt_tokens=None,
                                output_tokens=None,
                                model=effective_model,
                                mode=effective_mode,
                            ),
                            timeout=_CANCEL_IO_TIMEOUT_S,
                        )
                    settled = True
                except Exception:
                    logger.exception(
                        "Failed to settle pre-debit during chat setup cancellation for user %s",
                        user.id,
                    )
            raise
        except Exception as e:
            # FIX3-A(d) (Codex r3 #4, NOT ADDRESSED): this handler now also
            # checks `not settled` — previously it was the ONE generic
            # exception handler in this function that did NOT, so an
            # ordinary exception escaping the strict quote route's own
            # (already-settled) failure handling above would reach here and
            # attempt a SECOND, blind settlement. _refund_predebit's
            # conditional delete (FIX3-A(c)) makes a second attempt safe on
            # its own, but per Codex's prescription a resolver's decision
            # must never be second-guessed by an unconditional fallback —
            # the guard belongs here structurally, not just as a side
            # effect of the delete being idempotent.
            if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
                try:
                    await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
                    settled = True
                except Exception:
                    logger.exception(
                        "Failed to refund pre-debited credits during chat setup failure for user %s",
                        user.id,
                    )
            yield _safe_sse("error", setup_error_code, e, session_id=str(session_id))
            return

        # 6) Stream from the configured OpenAI-compatible LLM provider
        try:
            client = _get_llm_client(effective_model)
        except Exception as e:
            if user is not None and pre_debited > 0 and predebit_ledger_id is not None:
                try:
                    await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
                    settled = True
                except Exception:
                    logger.exception(
                        "Failed to refund pre-debited credits before LLM client setup for user %s",
                        user.id,
                    )
            yield _safe_sse("error", "LLM_ERROR", e, session_id=str(session_id))
            return

        # Build OpenAI-format messages (system + history)
        # cache_control is Anthropic-specific — only include for Anthropic models
        profile = get_model_profile(effective_model)
        if profile.supports_cache_control:
            sys_msg: dict = {
                "role": "system",
                "content": [
                    {
                        "type": "text",
                        "text": system_prompt,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
            }
        else:
            sys_msg = {"role": "system", "content": system_prompt}
        openai_messages = [sys_msg] + claude_messages

        assistant_text_parts: List[str] = []
        citations: List[dict] = []
        fsm = RefParserFSM(chunk_map)
        fsm = RefParserFSM(chunk_map)

        last_ping = time.monotonic()
        prompt_tokens: Optional[int] = None
        output_tokens: Optional[int] = None
        llm_start = time.time()
        first_token_logged = False
        token_count = 0
        finish_reason: Optional[str] = None
        asst_msg: Optional[Message] = None
        repair_metadata: dict[str, Any] | None = None
        persisted = False
        done_emitted = False

        try:
            try:
                create_kwargs: dict[str, Any] = {
                    "model": effective_model,
                    "max_tokens": profile.max_tokens,
                    "temperature": profile.temperature,
                    "messages": openai_messages,
                    "stream": True,
                }
                if profile.supports_stream_options:
                    create_kwargs["stream_options"] = {"include_usage": True}
                _apply_provider_options(create_kwargs, effective_model)
                stream = await client.chat.completions.create(**create_kwargs)

                async for chunk in stream:
                    # Extract text delta
                    if chunk.choices and chunk.choices[0].delta.content:
                        text = chunk.choices[0].delta.content
                        token_count += 1
                        if not first_token_logged:
                            first_token_logged = True
                            latency = time.time() - llm_start
                            logger.info("LLM first_token_latency=%.2fs model=%s", latency, effective_model)
                        # 7) Feed FSM and emit events
                        for ev in fsm.feed(text):
                            if ev["event"] == "token":
                                assistant_text_parts.append(ev["data"]["text"])
                            elif ev["event"] == "citation":
                                citations.append(ev["data"])
                            yield ev

                    # Track finish_reason from choices
                    if chunk.choices and chunk.choices[0].finish_reason:
                        finish_reason = chunk.choices[0].finish_reason

                    # Extract usage if present (last chunk)
                    if hasattr(chunk, "usage") and chunk.usage:
                        prompt_tokens = getattr(chunk.usage, "prompt_tokens", None)
                        output_tokens = getattr(chunk.usage, "completion_tokens", None)

                    # Ping every 15 seconds
                    now = time.monotonic()
                    if now - last_ping >= 15.0:
                        yield sse("ping", {})
                        last_ping = now

                # Flush at stream end
                for ev in fsm.flush():
                    if ev["event"] == "token":
                        assistant_text_parts.append(ev["data"]["text"])
                    yield ev

                if not citations:
                    assistant_snapshot = "".join(assistant_text_parts)
                    fallback_citations = _fallback_citations(assistant_snapshot, chunk_map)
                    if fallback_citations:
                        logger.warning(
                            "LLM emitted no citation markers; generated %d fallback citations model=%s",
                            len(fallback_citations),
                            effective_model,
                        )
                        for citation in fallback_citations:
                            citations.append(citation)
                            yield sse("citation", citation)

                # Warn if response was truncated due to token limit
                if finish_reason == "length":
                    logger.warning(
                        "LLM response truncated (finish_reason=length) model=%s max_tokens=%d output_tokens=%s",
                        effective_model, profile.max_tokens, output_tokens,
                    )
                    yield sse("truncated", {"reason": "max_tokens"})

                total_time = time.time() - llm_start
                final_token_count = int(output_tokens) if output_tokens is not None else token_count
                logger.info(
                    "LLM total_latency=%.2fs tokens=%d model=%s",
                    total_time,
                    final_token_count,
                    effective_model,
                )

            except Exception as e:
                assistant_snapshot = "".join(assistant_text_parts)
                has_partial_answer = bool(assistant_snapshot.strip())
                if (
                    user is not None
                    and pre_debited > 0
                    and predebit_ledger_id is not None
                    and not has_partial_answer
                ):
                    try:
                        await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
                        settled = True
                    except Exception:
                        logger.exception(
                            "Failed to refund pre-debited credits after LLM error for user %s",
                            user.id,
                        )
                yield _safe_sse("error", "LLM_ERROR", e, session_id=str(session_id))
                return

            # 9) Save assistant draft before verification/repair (A2)
            assistant_text = "".join(assistant_text_parts)
            try:
                asst_msg = Message(
                    session_id=session_id,
                    role="assistant",
                    content=assistant_text,
                    citations=citations or None,
                    prompt_tokens=int(prompt_tokens) if prompt_tokens is not None else None,
                    output_tokens=int(output_tokens) if output_tokens is not None else None,
                )
                db.add(asst_msg)
                await db.commit()
                persisted = True
            except Exception:
                await db.rollback()
                has_partial_answer = bool(assistant_text.strip())
                if (
                    user is not None
                    and pre_debited > 0
                    and predebit_ledger_id is not None
                    and not has_partial_answer
                ):
                    try:
                        await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
                        settled = True
                    except Exception:
                        logger.exception(
                            "Failed to refund pre-debited credits after PERSIST_FAILED for user %s",
                            user.id,
                        )
                yield sse("error", {"code": "PERSIST_FAILED", "message": "Failed to save response"})
                return

            verification_report = claim_verifier_service.verify(
                assistant_text,
                citations,
                set(chunk_map.keys()),
                retrieved_count=len(chunk_map),
            )
            verification_payload = verification_report.to_payload()
            if verification_report.status != "pass" and finish_reason != "length":
                yield sse("tool_status", {"message": "Checking citation support..."})
                repair = await _try_repair_rag_answer(
                    client=client,
                    model=effective_model,
                    profile=profile,
                    user_message=user_message,
                    assistant_text=assistant_text,
                    citations=citations,
                    chunk_map=chunk_map,
                    numbered_chunks=numbered_chunks,
                    verification=verification_payload,
                    locale=locale,
                )
                if repair is not None:
                    repair_metadata = repair.metadata
                    if repair.prompt_tokens:
                        prompt_tokens = int(prompt_tokens or 0) + repair.prompt_tokens
                    if repair.output_tokens:
                        output_tokens = int(output_tokens or 0) + repair.output_tokens
                    if repair.applied:
                        assistant_text = repair.text
                        citations = repair.citations
                        verification_payload = repair.verification
                        verification_report = claim_verifier_service.verify(
                            assistant_text,
                            citations,
                            set(chunk_map.keys()),
                            retrieved_count=len(chunk_map),
                        )
                        verification_payload = verification_report.to_payload()
                        yield sse(
                            "answer_repaired",
                            {
                                "text": assistant_text,
                                "citations": citations,
                                "verification": verification_payload,
                            },
                        )
            if verification_report.status != "pass":
                logger.warning(
                    "RAG verification status=%s score=%.3f claims=%d citations=%d reasons=%s",
                    verification_report.status,
                    verification_report.score,
                    verification_report.claim_count,
                    verification_report.citation_count,
                    ",".join(verification_report.reasons),
                )

            focus_pt = focus_ct = 0
            focus_model_used = ""
            focus_elapsed = time.time() - llm_start
            if user is not None and citations and focus_elapsed <= _FOCUS_ELAPSED_BUDGET_S:
                yield sse("tool_status", {"message": "Refining citations..."})
            focus_changed, focus_model_used, focus_pt, focus_ct = await _refine_citation_focus(
                answer=assistant_text,
                citations=citations,
                chunk_map=chunk_map,
                fallback_model=effective_model,
                user=user,
                elapsed_seconds=focus_elapsed,
            )
            if focus_changed:
                yield sse("citations_refined", {"citations": citations})

            try:
                if asst_msg is None:
                    raise RuntimeError("assistant message missing before verification update")
                asst_msg.content = assistant_text
                asst_msg.citations = citations or None
                asst_msg.prompt_tokens = int(prompt_tokens) if prompt_tokens is not None else None
                asst_msg.output_tokens = int(output_tokens) if output_tokens is not None else None
                await db.commit()
            except Exception:
                await db.rollback()
                yield sse("error", {"code": "PERSIST_FAILED", "message": "Failed to save response"})
                return

            await _record_rag_verification_event(
                db,
                user=user,
                message_id=getattr(asst_msg, "id", None),
                verification=verification_payload,
                retrieval_strategy=retrieval_strategy,
                query_route=query_route,
                retrieved_count=len(chunk_map),
                repair_metadata=repair_metadata,
            )

            # Credits: reconcile pre-debited estimate against actual cost
            if user is not None and pre_debited > 0 and predebit_ledger_id is not None:
                pt = int(prompt_tokens or 0)
                ct = int(output_tokens or 0)
                try:
                    answer_cost = credit_service.calculate_cost(pt, ct, effective_model, mode=effective_mode)
                    summary_usage_costs: list[tuple[str, int, int, int]] = []
                    for usage_model, (summary_prompt, summary_completion) in summary_usage.totals_by_model().items():
                        summary_mode = "quick" if usage_model == settings.MODE_MODELS.get("quick") else None
                        summary_cost = credit_service.calculate_cost(
                            summary_prompt,
                            summary_completion,
                            usage_model,
                            mode=summary_mode,
                        )
                        summary_usage_costs.append(
                            (usage_model, summary_prompt, summary_completion, summary_cost)
                        )
                    # Citation-focus Flash call: part of producing this answer,
                    # reconciled + recorded like summary usage.
                    focus_cost = 0
                    if (focus_pt or focus_ct) and focus_model_used:
                        focus_cost = credit_service.calculate_cost(
                            focus_pt, focus_ct, focus_model_used, mode="quick"
                        )
                    actual_cost = (
                        answer_cost
                        + sum(item[3] for item in summary_usage_costs)
                        + focus_cost
                    )
                    await credit_service.reconcile_credits(
                        db, user.id, predebit_ledger_id, pre_debited, actual_cost,
                    )
                    await credit_service.record_usage(
                        db,
                        user_id=user.id,
                        message_id=asst_msg.id,
                        model=effective_model,
                        prompt_tokens=pt,
                        completion_tokens=ct,
                        cost_credits=answer_cost,
                    )
                    for usage_model, summary_prompt, summary_completion, summary_cost in summary_usage_costs:
                        await credit_service.record_usage(
                            db,
                            user_id=user.id,
                            message_id=asst_msg.id,
                            model=usage_model,
                            prompt_tokens=summary_prompt,
                            completion_tokens=summary_completion,
                            cost_credits=summary_cost,
                        )
                    if focus_cost:
                        await credit_service.record_usage(
                            db,
                            user_id=user.id,
                            message_id=asst_msg.id,
                            model=focus_model_used,
                            prompt_tokens=focus_pt,
                            completion_tokens=focus_ct,
                            cost_credits=focus_cost,
                        )
                    await db.commit()
                    settled = True
                except Exception as e:
                    # Non-fatal accounting error
                    yield _safe_sse("warn", "ACCOUNTING_ERROR", e, session_id=str(session_id))

            # 10) done
            can_continue = asst_msg.continuation_count < settings.MAX_CONTINUATIONS_PER_MESSAGE
            done_emitted = True
            yield sse("done", {
                "message_id": str(asst_msg.id),
                "citations_count": len(citations),
                "verification": verification_payload,
                "repair": repair_metadata,
                "can_continue": can_continue and finish_reason == "length",
                "continuation_count": asst_msg.continuation_count,
                # FIX3-B (Codex r3 #5, NOT ADDRESSED): set when the strict
                # quote trigger matched this message but a negation/
                # metalinguistic token was ALSO present, so verified quote
                # search was deliberately NOT auto-routed/billed (see
                # action_planner.deterministic_plan). Always present
                # (never conditionally omitted) so the frontend has a
                # stable field to check for offering a manual "Try Quote
                # Finder" chip — never used to auto-route or bill.
"quote_finder_hint": action_plan.quote_finder_hint,
                "quote_finder_topic": action_plan.quote_finder_hint_topic,
            })
        except asyncio.CancelledError:
            raise
        finally:
            assistant_snapshot = "".join(assistant_text_parts)
            has_partial_answer = bool(assistant_snapshot.strip())
            if not done_emitted and has_partial_answer and not persisted:
                try:
                    with anyio.CancelScope(shield=True):
                        await asyncio.wait_for(
                            _persist_partial_on_cancel(
                                session_id=session_id,
                                assistant_text=assistant_snapshot,
                                citations=citations,
                                prompt_tokens=prompt_tokens,
                                output_tokens=output_tokens,
                            ),
                            timeout=_CANCEL_IO_TIMEOUT_S,
                        )
                    persisted = True
                except Exception:
                    logger.exception(
                        "Failed to persist partial assistant response on cancel/error for session %s",
                        session_id,
                    )
            if (
                user is not None
                and pre_debited > 0
                and predebit_ledger_id is not None
                and not settled
            ):
                try:
                    with anyio.CancelScope(shield=True):
                        await asyncio.wait_for(
                            _settle_predebit_on_cancel(
                                user_id=user.id,
                                pre_debited=pre_debited,
                                predebit_ledger_id=predebit_ledger_id,
                                has_answer=has_partial_answer,
                                prompt_tokens=prompt_tokens,
                                output_tokens=output_tokens,
                                model=effective_model,
                                mode=effective_mode,
                            ),
                            timeout=_CANCEL_IO_TIMEOUT_S,
                        )
                    settled = True
                except Exception:
                    logger.exception(
                        "Failed to settle pre-debit on cancel/error for user %s",
                        user.id,
                    )

exec
/bin/zsh -lc "nl -ba backend/app/services/chat_service.py | sed -n '1710,1875p'
nl -ba backend/app/services/chat_service.py | sed -n '1875,2055p'
nl -ba backend/app/services/chat_service.py | sed -n '2055,2225p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
  1710	
  1711	        settled = False
  1712	        setup_error_code = "CHAT_SETUP_ERROR"
  1713	        try:
  1714	            # 2) Save user message
  1715	            await self._persist_user_message_and_title(
  1716	                db=db,
  1717	                session_id=session_id,
  1718	                user_message=user_message,
  1719	            )
  1720	
  1721	            # Strict verbatim-quote chat routing (B5, plan §8.4.3). Gated
  1722	            # here (not in the planner, which has no auth/doc context):
  1723	            # AUTHED, non-demo, single-document sessions only. Anonymous,
  1724	            # demo, and collection sessions fall through to the normal RAG
  1725	            # path below UNCHANGED — the strict intent still matched, but
  1726	            # without a real document + billing user the verified pipeline
  1727	            # can't run, so this degrades to an ordinary cited answer rather
  1728	            # than erroring. SAME predicate (`strict_quote_routed`, computed
  1729	            # above) already decided the predebit amount — never re-derive
  1730	            # this condition separately (FIX-3: that's exactly how a
  1731	            # quick-mode predebit could drift from what actually runs).
  1732	            if strict_quote_routed:
  1733	                setup_error_code = "QUOTE_SEARCH_ERROR"
  1734	                quote_progress = _VerifiedQuoteProgress()
  1735	                try:
  1736	                    outcome = await self._run_verified_quote_search(
  1737	                        session_id=session_id,
  1738	                        db=db,
  1739	                        document=doc,
  1740	                        user=user,
  1741	                        topic=user_message,
  1742	                        locale=locale,
  1743	                        domain_mode=domain_mode,
  1744	                        session_obj=session_obj,
  1745	                        pre_debited=pre_debited,
  1746	                        predebit_ledger_id=predebit_ledger_id,
  1747	                        progress=quote_progress,
  1748	                    )
  1749	                except asyncio.CancelledError:
  1750	                    # FIX3-A(d) (Codex r3 #4, NOT ADDRESSED): `settled` is
  1751	                    # marked BEFORE the resolver even runs — regardless of
  1752	                    # whether it succeeds — so the outer generic handler
  1753	                    # (which now also checks `not settled`, see below) can
  1754	                    # NEVER also attempt its own blind settlement. That was
  1755	                    # the exact "special resolver errors out, outer handler
  1756	                    # falls back to blind settlement" gap Codex r3 found.
  1757	                    # The resolver itself is the durable, race-free
  1758	                    # reconciled_at + conditional-delete design (FIX3-A(b)/
  1759	                    # (c)) — correct regardless of whether the atomic commit
  1760	                    # already landed, is still landing, or never will.
  1761	                    if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
  1762	                        settled = True
  1763	                        try:
  1764	                            with anyio.CancelScope(shield=True):
  1765	                                refunded = await asyncio.wait_for(
  1766	                                    _settle_verified_quote_predebit_after_failure(
  1767	                                        user_id=user.id,
  1768	                                        pre_debited=pre_debited,
  1769	                                        predebit_ledger_id=predebit_ledger_id,
  1770	                                        use_independent_session=True,
  1771	                                    ),
  1772	                                    timeout=_CANCEL_IO_TIMEOUT_S,
  1773	                                )
  1774	                            if not refunded:
  1775	                                logger.info(
  1776	                                    "quote_billing.settled_no_refund user=%s ledger=%s: cancellation "
  1777	                                    "after the atomic commit had already reconciled — predebit stands.",
  1778	                                    user.id, predebit_ledger_id,
  1779	                                )
  1780	                        except Exception:
  1781	                            # FIX3-A(d): resolver failure must NEVER fall
  1782	                            # through to ANY further settlement attempt —
  1783	                            # leave the predebit standing and surface it to
  1784	                            # ops for manual review.
  1785	                            logger.error(
  1786	                                "quote_billing.unresolved user=%s ledger=%s pre_debited=%s "
  1787	                                "session=%s: settlement resolver failed during cancellation — "
  1788	                                "predebit left standing, requires manual review.",
  1789	                                user.id, predebit_ledger_id, pre_debited, session_id, exc_info=True,
  1790	                            )
  1791	                    raise
  1792	                except Exception as exc:
  1793	                    # FIX3-A(d) (Codex r3 #4, NOT ADDRESSED): ALL final-
  1794	                    # commit exceptions — not just CancelledError — now
  1795	                    # route through the SAME resolver as the branch above,
  1796	                    # closing the "ordinary 'server committed but COMMIT
  1797	                    # response was lost' exception leaves progress.message_id
  1798	                    # unset and reaches the generic (blind) refund path"
  1799	                    # gap Codex r3 found. `settled` is marked BEFORE the
  1800	                    # resolver runs, same reasoning as the CancelledError
  1801	                    # branch.
  1802	                    if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
  1803	                        settled = True
  1804	                        try:
  1805	                            refunded = await _settle_verified_quote_predebit_after_failure(
  1806	                                user_id=user.id,
  1807	                                pre_debited=pre_debited,
  1808	                                predebit_ledger_id=predebit_ledger_id,
  1809	                                use_independent_session=False,
  1810	                                db=db,
  1811	                            )
  1812	                        except Exception:
  1813	                            logger.error(
  1814	                                "quote_billing.unresolved user=%s ledger=%s pre_debited=%s "
  1815	                                "session=%s: settlement resolver failed after an ordinary billing "
  1816	                                "exception — predebit left standing, requires manual review.",
  1817	                                user.id, predebit_ledger_id, pre_debited, session_id, exc_info=True,
  1818	                            )
  1819	                            yield _safe_sse("error", "QUOTE_SEARCH_ERROR", exc, session_id=str(session_id))
  1820	                            return
  1821	                        if not refunded:
  1822	                            # The atomic commit had already reconciled — a
  1823	                            # real, delivered, persisted answer — this
  1824	                            # exception struck AFTER that. Predebit stands
  1825	                            # as the charge; never a full refund for a
  1826	                            # delivered answer.
  1827	                            logger.exception(
  1828	                                "Quote-search billing failed after the atomic commit had already "
  1829	                                "reconciled (ledger %s) for user %s — predebit stands, no refund.",
  1830	                                predebit_ledger_id, user.id,
  1831	                            )
  1832	                            yield _safe_sse(
  1833	                                "error", "QUOTE_SEARCH_BILLING_INCOMPLETE", exc, session_id=str(session_id),
  1834	                            )
  1835	                            return
  1836	                        # Refunded — nothing was delivered.
  1837	                        yield _safe_sse("error", "QUOTE_SEARCH_ERROR", exc, session_id=str(session_id))
  1838	                        return
  1839	                    raise
  1840	                # Reconcile already committed inside _run_verified_quote_search —
  1841	                # mark settled BEFORE yielding so a cancellation during these
  1842	                # yields can't ALSO trigger the setup handler's full refund
  1843	                # (double-refund guard, same pattern as the main RAG path).
  1844	                # domain_mode was already synced INSIDE that same atomic
  1845	                # commit (P1 hygiene r2, Codex 2026-08-03) — nothing left
  1846	                # to do here.
  1847	                settled = True
  1848	                if outcome.artifact_payload:
  1849	                    yield sse("artifact", outcome.artifact_payload)
  1850	                yield sse("token", {"text": outcome.assistant_text})
  1851	                yield sse(
  1852	                    "done",
  1853	                    {
  1854	                        "message_id": str(outcome.message_id),
  1855	                        "citations_count": len(outcome.citations),
  1856	                        "verification": None,
  1857	                        "can_continue": False,
  1858	                        "continuation_count": 0,
  1859	                        "artifact_count": 1 if outcome.artifact_payload else 0,
  1860	                    },
  1861	                )
  1862	                return
  1863	
  1864	            # 3) Load history (last N*2 messages before current user msg)
  1865	            max_turns = int(settings.MAX_CHAT_HISTORY_TURNS or 6)
  1866	            max_msgs = max_turns * 2
  1867	            msgs_row = await db.execute(
  1868	                select(Message)
  1869	                .where(Message.session_id == session_id)
  1870	                .order_by(Message.created_at.desc())
  1871	                .limit(max_msgs + 1)
  1872	            )
  1873	            history_msgs: List[Message] = list(msgs_row.scalars().all())
  1874	            history_msgs.reverse()  # back to chronological order
  1875	
  1875	
  1876	            # Convert to Claude message format (excluding system)
  1877	            claude_messages: List[dict] = []
  1878	            for m in history_msgs:
  1879	                claude_messages.append({"role": m.role, "content": m.content})
  1880	
  1881	            # 4) Route + retrieval (with error handling — e.g. Qdrant down or no vectors yet).
  1882	            # Whole-document summaries must not use ordinary semantic top-k: vague
  1883	            # summary prompts frequently retrieve tables/appendices instead of
  1884	            # representative document structure. Route them to an ordered context
  1885	            # selector until the durable hierarchical brief index lands.
  1886	            setup_error_code = "RETRIEVAL_ERROR"
  1887	            retrieval_strategy = "semantic_top_k"
  1888	            retrieval_evaluation = None
  1889	            retrieval_plan: QueryPlan | None = None
  1890	            summary_usage = MapReduceUsageCollector()
  1891	            if (
  1892	                query_route.primary_intent == QueryIntent.DOCUMENT_SUMMARY
  1893	                and document_id
  1894	                and not is_collection_session
  1895	            ):
  1896	                yield sse("tool_status", {"message": "Summarizing the document section by section…"})
  1897	                retrieved = await document_brief_service.get_summary_context(
  1898	                    db,
  1899	                    document_id,
  1900	                    max_chunks=18,
  1901	                    usage_collector=summary_usage,
  1902	                )
  1903	                retrieval_strategy = "document_summary_context"
  1904	            elif (
  1905	                query_route.primary_intent == QueryIntent.DOCUMENT_SUMMARY
  1906	                and is_collection_session
  1907	                and collection_doc_ids
  1908	            ):
  1909	                retrieved = await document_brief_service.get_collection_summary_context(
  1910	                    db,
  1911	                    collection_doc_ids,
  1912	                    max_chunks=24,
  1913	                    max_docs=8,
  1914	                )
  1915	                retrieval_strategy = "collection_summary_context"
  1916	            elif is_collection_session and collection_doc_ids:
  1917	                corrective = await corrective_retrieval_service.retrieve_multi(
  1918	                    user_message,
  1919	                    query_route,
  1920	                    collection_doc_ids,
  1921	                    top_k=8,
  1922	                    db=db,
  1923	                )
  1924	                retrieved = corrective.retrieved
  1925	                retrieval_strategy = corrective.strategy
  1926	                retrieval_evaluation = corrective.evaluation
  1927	                retrieval_plan = corrective.plan
  1928	            elif (
  1929	                document_id
  1930	                and query_route.primary_intent == QueryIntent.PAGE_LOOKUP
  1931	                and query_route.page_ref is not None
  1932	            ):
  1933	                retrieved = await _fetch_page_chunks(db, document_id, query_route.page_ref)
  1934	                retrieval_strategy = "page_lookup"
  1935	                if not retrieved:
  1936	                    # Only a PURE page lookup ("what is on page N") skips fallback: answering
  1937	                    # from semantically-similar chunks on OTHER pages gives a wrong-page answer,
  1938	                    # so the Source Locations contract makes the model say page N wasn't found.
  1939	                    # A MIXED page+topic/table query (intents has more than PAGE_LOOKUP, e.g.
  1940	                    # "table on page 8", "requirements on page 12") still needs its evidence —
  1941	                    # fall back to semantic retrieval. (Consensus R2a #1 + Codex r2a review.)
  1942	                    is_pure_page_lookup = query_route.intents == (QueryIntent.PAGE_LOOKUP,)
  1943	                    if is_pure_page_lookup:
  1944	                        retrieved = []
  1945	                        retrieval_strategy = "page_lookup_miss"
  1946	                    else:
  1947	                        corrective = await corrective_retrieval_service.retrieve_single(
  1948	                            user_message, query_route, document_id, top_k=8, db=db,
  1949	                            doc_pages=getattr(doc, "page_count", None),
  1950	                        )
  1951	                        retrieved = corrective.retrieved
  1952	                        retrieval_strategy = corrective.strategy
  1953	                        retrieval_evaluation = corrective.evaluation
  1954	                        retrieval_plan = corrective.plan
  1955	            elif document_id:
  1956	                corrective = await corrective_retrieval_service.retrieve_single(
  1957	                    user_message,
  1958	                    query_route,
  1959	                    document_id,
  1960	                    top_k=8,
  1961	                    db=db,
  1962	                    doc_pages=getattr(doc, "page_count", None),
  1963	                )
  1964	                retrieved = corrective.retrieved
  1965	                retrieval_strategy = corrective.strategy
  1966	                retrieval_evaluation = corrective.evaluation
  1967	                retrieval_plan = corrective.plan
  1968	            else:
  1969	                retrieved = []
  1970	
  1971	            # 5) Build prompt (system)
  1972	            setup_error_code = "CHAT_SETUP_ERROR"
  1973	            numbered_chunks: List[str] = []
  1974	            chunk_map: dict[int, _ChunkInfo] = {}
  1975	            has_map_reduce_summary_context = any(
  1976	                item.get("retrieval_modality") == "summary"
  1977	                or item.get("map_reduce_strategy") == "map_reduce"
  1978	                for item in retrieved
  1979	            )
  1980	            for idx, item in enumerate(retrieved, start=1):
  1981	                # Heuristic truncation to ~350 tokens (roughly 1200-1400 chars)
  1982	                text = item["text"] or ""
  1983	                truncated = text[:1400]
  1984	                chunk_doc_id = item.get("document_id")
  1985	                doc_label = ""
  1986	                if is_collection_session and chunk_doc_id:
  1987	                    fname = collection_doc_names.get(chunk_doc_id, "")
  1988	                    if fname:
  1989	                        doc_label = f"(from: {fname}) "
  1990	                # File-type-aware source location (page/slide/sheet/part), gated for reliability.
  1991	                if is_collection_session and chunk_doc_id:
  1992	                    chunk_ft = collection_doc_types.get(chunk_doc_id)
  1993	                    chunk_pages = collection_doc_pages.get(chunk_doc_id)
  1994	                else:
  1995	                    chunk_ft = getattr(doc, "file_type", None)
  1996	                    chunk_pages = getattr(doc, "page_count", None)
  1997	                src = _source_locator(item, chunk_ft, chunk_pages)
  1998	                src_label = f"({src}) " if src else ""
  1999	                plan_label = _safe_plan_label(item.get("retrieval_plan_step"))
  2000	                evidence_label = f"(evidence: {plan_label}) " if plan_label else ""
  2001	                numbered_chunks.append(f"[{idx}] {doc_label}{src_label}{evidence_label}{truncated}")
  2002	                chunk_map[idx] = _ChunkInfo(
  2003	                    id=item["chunk_id"],
  2004	                    page_start=int(item["page"]),
  2005	                    page_end=int(item.get("page_end", item["page"])),
  2006	                    bboxes=item.get("bboxes") or [],
  2007	                    text=text,
  2008	                    section_title=item.get("section_title") or "",
  2009	                    document_id=chunk_doc_id if chunk_doc_id else document_id,
  2010	                    document_filename=collection_doc_names.get(chunk_doc_id, "")
  2011	                    if chunk_doc_id
  2012	                    else "",
  2013	                    score=item.get("score", 0.0),
  2014	                    table_id=str(item.get("table_id")) if item.get("table_id") else None,
  2015	                    retrieval_modality=str(item.get("retrieval_modality") or "text"),
  2016	                    summary_target_sections=tuple(item.get("map_reduce_target_sections") or ()),
  2017	                    summary_model_covered_sections=tuple(
  2018	                        item.get("map_reduce_model_covered_sections") or ()
  2019	                    ),
  2020	                    summary_fallback_sections=tuple(item.get("map_reduce_fallback_sections") or ()),
  2021	                    summary_missing_sections=tuple(item.get("map_reduce_missing_sections") or ()),
  2022	                )
  2023	
  2024	            rules = get_rules_for_model(
  2025	                effective_model, is_collection=is_collection_session
  2026	            )
  2027	
  2028	            if is_collection_session and retrieval_strategy == "collection_summary_context":
  2029	                doc_list = ", ".join(collection_doc_names.values()) if collection_doc_names else "(no documents)"
  2030	                system_prompt = (
  2031	                    "You are a document analysis assistant. The user is asking for a broad summary across a document collection.\n\n"
  2032	                    + SYSTEM_PROMPT_META_RULE
  2033	                    + f"## Available Documents\n{doc_list}\n\n"
  2034	                    + "## Collection Coverage Sources\n"
  2035	                    + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
  2036	                    + "\n\n## Summary Rules\n"
  2037	                    + "1. Treat these sources as representative coverage selected across the collection, not as semantic search results for a narrow question.\n"
  2038	                    + "2. Do NOT say the collection is just unrelated sections merely because the context is selective.\n"
  2039	                    + "3. Summarize shared themes, document-specific points, and important caveats when supported.\n"
  2040	                    + "4. If coverage is incomplete, say the answer is based on the cited representative sections instead of refusing.\n"
  2041	                    + "5. Cite every factual paragraph or bullet using the source numbers listed above.\n"
  2042	                    + "6. Your response language MUST match the language of the user's question.\n"
  2043	                    + _citation_contract()
  2044	                )
  2045	            elif is_collection_session:
  2046	                doc_list = ", ".join(collection_doc_names.values()) if collection_doc_names else "(no documents)"
  2047	                system_prompt = (
  2048	                    "You are a document analysis assistant. Answer the user's question based on sources from multiple documents.\n\n"
  2049	                    + SYSTEM_PROMPT_META_RULE
  2050	                    + f"## Available Documents\n{doc_list}\n\n"
  2051	                    + "## Document Sources\n"
  2052	                    + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
  2053	                    + _retrieval_quality_contract(retrieval_evaluation, retrieval_strategy)
  2054	                    + _query_plan_contract(retrieval_plan)
  2055	                    + "\n\n## Rules\n" + rules
  2055	                    + "\n\n## Rules\n" + rules
  2056	                    + _citation_contract()
  2057	                )
  2058	            elif retrieval_strategy == "document_summary_context":
  2059	                map_reduce_rule = (
  2060	                    "7. The sources may be map-reduce section summaries generated from source chunks; "
  2061	                    "use the coverage status to distinguish model-covered, fallback, and missing sections.\n"
  2062	                    if has_map_reduce_summary_context
  2063	                    else ""
  2064	                )
  2065	                system_prompt = (
  2066	                    "You are a document analysis assistant. The user is asking for a broad, whole-document summary.\n\n"
  2067	                    + SYSTEM_PROMPT_META_RULE
  2068	                    + "## Document Coverage Sources\n"
  2069	                    + (
  2070	                        "\n".join(numbered_chunks)
  2071	                        if numbered_chunks
  2072	                        else "(none)"
  2073	                    )
  2074	                    + "\n\n## Summary Rules\n"
  2075	                    + "1. Treat these sources as representative coverage selected across the document, not as semantic search results for a narrow question.\n"
  2076	                    + "2. Do NOT say the user's ready document is not a complete document merely because the context is selective.\n"
  2077	                    + "3. Produce a useful document-level summary with clear headings, key points, and important caveats when supported.\n"
  2078	                    + "4. If coverage is incomplete, say the answer is based on the cited representative sections instead of refusing.\n"
  2079	                    + "5. Cite every factual paragraph or bullet using the source numbers listed above.\n"
  2080	                    + "6. Your response language MUST match the language of the user's question.\n"
  2081	                    + map_reduce_rule
  2082	                    + _summary_coverage_contract(retrieved)
  2083	                    + _citation_contract()
  2084	                )
  2085	            else:
  2086	                system_prompt = (
  2087	                    "You are a document analysis assistant. Answer the user's question based on the following document sources.\n\n"
  2088	                    + SYSTEM_PROMPT_META_RULE
  2089	                    + "## Document Sources\n"
  2090	                    + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
  2091	                    + _retrieval_quality_contract(retrieval_evaluation, retrieval_strategy)
  2092	                    + _query_plan_contract(retrieval_plan)
  2093	                    + "\n\n## Rules\n" + rules
  2094	                    + _citation_contract()
  2095	                )
  2096	
  2097	            # Inject custom instructions if present (subordinate to core rules — they are
  2098	            # user preferences, not overrides of role/source/citation/safety rules).
  2099	            if doc and doc.custom_instructions:
  2100	                system_prompt += (
  2101	                    "\n## Custom Instructions\n"
  2102	                    "Follow these custom instructions only when they do not conflict with the role, "
  2103	                    "data-boundary, source-location, citation, language, or safety rules above:\n"
  2104	                    + doc.custom_instructions + "\n"
  2105	                )
  2106	
  2107	            # Inject domain-specific rules (legal/academic mode overlay)
  2108	            # Frontend always sends domain_mode: null (default) or "legal"/"academic"
  2109	            # domain_mode=None means Default (no extra rules), string means apply rules
  2110	            if domain_mode:
  2111	                from app.core.model_profiles import DOMAIN_RULES
  2112	                domain_rules = DOMAIN_RULES.get(domain_mode)
  2113	                if domain_rules:
  2114	                    base_rule_count = len(rules.strip().split('\n'))
  2115	                    domain_rules_text = f"\n\n## {domain_mode.title()} Mode Rules\n"
  2116	                    for i, rule in enumerate(domain_rules, start=base_rule_count + 1):
  2117	                        domain_rules_text += f"{i}. {rule}\n"
  2118	                    system_prompt += domain_rules_text
  2119	
  2120	            # Global contracts appended to EVERY branch: source-location grounding (#1)
  2121	            # + user-facing terminology guard (#4). (Consensus R2a.)
  2122	            system_prompt += _source_location_contract() + _output_terminology_contract()
  2123	
  2124	            # Persist domain_mode to session (null clears, string sets) —
  2125	            # a PURE assignment, no commit of its own (see
  2126	            # _sync_session_domain_mode's docstring, r2). session_obj is
  2127	            # already tracked by this `db` session (loaded at the top of
  2128	            # chat_stream), so this dirties it in place and rides along
  2129	            # with WHATEVER this path's next commit turns out to be (the
  2130	            # assistant-message draft save below) — never a standalone
  2131	            # commit, so a failure before that point discards it via
  2132	            # rollback just like everything else, and a failure after it
  2133	            # commits it together with the real answer, never separately.
  2134	            _sync_session_domain_mode(session_obj, domain_mode)
  2135	
  2136	        except asyncio.CancelledError:
  2137	            if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
  2138	                try:
  2139	                    with anyio.CancelScope(shield=True):
  2140	                        await asyncio.wait_for(
  2141	                            _settle_predebit_on_cancel(
  2142	                                user_id=user.id,
  2143	                                pre_debited=pre_debited,
  2144	                                predebit_ledger_id=predebit_ledger_id,
  2145	                                has_answer=False,
  2146	                                prompt_tokens=None,
  2147	                                output_tokens=None,
  2148	                                model=effective_model,
  2149	                                mode=effective_mode,
  2150	                            ),
  2151	                            timeout=_CANCEL_IO_TIMEOUT_S,
  2152	                        )
  2153	                    settled = True
  2154	                except Exception:
  2155	                    logger.exception(
  2156	                        "Failed to settle pre-debit during chat setup cancellation for user %s",
  2157	                        user.id,
  2158	                    )
  2159	            raise
  2160	        except Exception as e:
  2161	            # FIX3-A(d) (Codex r3 #4, NOT ADDRESSED): this handler now also
  2162	            # checks `not settled` — previously it was the ONE generic
  2163	            # exception handler in this function that did NOT, so an
  2164	            # ordinary exception escaping the strict quote route's own
  2165	            # (already-settled) failure handling above would reach here and
  2166	            # attempt a SECOND, blind settlement. _refund_predebit's
  2167	            # conditional delete (FIX3-A(c)) makes a second attempt safe on
  2168	            # its own, but per Codex's prescription a resolver's decision
  2169	            # must never be second-guessed by an unconditional fallback —
  2170	            # the guard belongs here structurally, not just as a side
  2171	            # effect of the delete being idempotent.
  2172	            if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
  2173	                try:
  2174	                    await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
  2175	                    settled = True
  2176	                except Exception:
  2177	                    logger.exception(
  2178	                        "Failed to refund pre-debited credits during chat setup failure for user %s",
  2179	                        user.id,
  2180	                    )
  2181	            yield _safe_sse("error", setup_error_code, e, session_id=str(session_id))
  2182	            return
  2183	
  2184	        # 6) Stream from the configured OpenAI-compatible LLM provider
  2185	        try:
  2186	            client = _get_llm_client(effective_model)
  2187	        except Exception as e:
  2188	            if user is not None and pre_debited > 0 and predebit_ledger_id is not None:
  2189	                try:
  2190	                    await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
  2191	                    settled = True
  2192	                except Exception:
  2193	                    logger.exception(
  2194	                        "Failed to refund pre-debited credits before LLM client setup for user %s",
  2195	                        user.id,
  2196	                    )
  2197	            yield _safe_sse("error", "LLM_ERROR", e, session_id=str(session_id))
  2198	            return
  2199	
  2200	        # Build OpenAI-format messages (system + history)
  2201	        # cache_control is Anthropic-specific — only include for Anthropic models
  2202	        profile = get_model_profile(effective_model)
  2203	        if profile.supports_cache_control:
  2204	            sys_msg: dict = {
  2205	                "role": "system",
  2206	                "content": [
  2207	                    {
  2208	                        "type": "text",
  2209	                        "text": system_prompt,
  2210	                        "cache_control": {"type": "ephemeral"},
  2211	                    }
  2212	                ],
  2213	            }
  2214	        else:
  2215	            sys_msg = {"role": "system", "content": system_prompt}
  2216	        openai_messages = [sys_msg] + claude_messages
  2217	
  2218	        assistant_text_parts: List[str] = []
  2219	        citations: List[dict] = []
  2220	        fsm = RefParserFSM(chunk_map)
  2221	
  2222	        last_ping = time.monotonic()
  2223	        prompt_tokens: Optional[int] = None
  2224	        output_tokens: Optional[int] = None
  2225	        llm_start = time.time()

exec
/bin/zsh -lc "rg -n \"domain_mode|P1 hygiene|standalone commit|failure window|CONSENSUS\" .collab docs backend/tests -g '*.md' -g '*.py' | head -n 240
git log --oneline --decorate --no-merges ba8a141..HEAD
git diff --check 7ec0b4e"'^ 7ec0b4e
git diff --name-status 7ec0b4e''^ 7ec0b4e' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
docs/superpowers/specs/2026-03-16-top4-features-design.md:390:**Database migration — add domain_mode to sessions:**
docs/superpowers/specs/2026-03-16-top4-features-design.md:393:ALTER TABLE sessions ADD COLUMN domain_mode VARCHAR(20) DEFAULT NULL
docs/superpowers/specs/2026-03-16-top4-features-design.md:394:    CHECK (domain_mode IN ('legal', 'academic'));
docs/superpowers/specs/2026-03-16-top4-features-design.md:404:    domain_mode: Optional[Literal["legal", "academic"]] = None  # NEW
docs/superpowers/specs/2026-03-16-top4-features-design.md:408:**SessionListItem schema update** — expose `domain_mode` so frontend can restore on session switch:
docs/superpowers/specs/2026-03-16-top4-features-design.md:414:    domain_mode: Optional[str] = None  # NEW
docs/superpowers/specs/2026-03-16-top4-features-design.md:420:Add `domain_mode = Column(String(20), nullable=True)` to the `ChatSession` class.
docs/superpowers/specs/2026-03-16-top4-features-design.md:451:if domain_mode and domain_mode in DOMAIN_RULES:
docs/superpowers/specs/2026-03-16-top4-features-design.md:452:    rules_text += f"\n\n## {domain_mode.title()} Mode Rules\n"
docs/superpowers/specs/2026-03-16-top4-features-design.md:453:    for i, rule in enumerate(DOMAIN_RULES[domain_mode], start=len(rules) + 1):
docs/superpowers/specs/2026-03-16-top4-features-design.md:459:When `domain_mode` is sent in ChatRequest:
docs/superpowers/specs/2026-03-16-top4-features-design.md:460:1. Update `session.domain_mode` in DB (so subsequent messages inherit it)
docs/superpowers/specs/2026-03-16-top4-features-design.md:461:2. Use the stored `domain_mode` if not provided in request (sticky per session)
docs/superpowers/specs/2026-03-16-top4-features-design.md:462:3. Known limitation: concurrent requests with different domain_mode values result in last-write-wins. Acceptable for v1 since users typically don't send concurrent messages.
docs/superpowers/specs/2026-03-16-top4-features-design.md:500:# alembic migration: add_domain_mode_to_sessions
docs/superpowers/specs/2026-03-16-top4-features-design.md:502:    op.add_column("sessions", sa.Column("domain_mode", sa.String(20), nullable=True))
docs/superpowers/specs/2026-03-16-top4-features-design.md:503:    op.create_check_constraint("ck_sessions_domain_mode", "sessions", "domain_mode IN ('legal', 'academic')")
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:16:# Codex P1 hygiene r3 — final one-commit verification
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:18:Your r2 closed all three r1 findings but flagged a new P2: the per-branch `_sync_session_domain_mode` did its OWN standalone commit, creating failure windows (tool-action sync committing before tool execution outside the exception boundary; strict Quote Finder committing after answer+billing settlement — a failure there returned QUOTE_SEARCH_ERROR with the answer persisted, charged, unrefunded, unstreamed).
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:26:`_sync_session_domain_mode` is now a **pure in-memory assignment with zero commit/await of its own**. Each branch sets the attribute before its OWN existing terminal commit, so it rides that transaction:
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:29:- **Strict Quote Finder**: `_run_verified_quote_search` now takes `domain_mode` + `session_obj`; the assignment goes INTO the same atomic message+reconcile+usage commit built during the M2 cancellation hardening — one commit, no post-settlement second write.
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:31:Both r1 regression tests kept unchanged (omitted-mode → row NULL on tool/quote paths). Two NEW real-Postgres failure-injection tests target a failure exactly AFTER the assignment at each branch's own terminal commit (call-counted flaky commit wrapper, mirroring this file's existing TestChatReconcileFailureAfterPersist precedent): both assert the domain_mode row stays at its stale prior value (never half-committed), and the Quote Finder one additionally asserts the predebit is fully refunded with ledger rows restored.
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:33:Task: verdict this P2 ADDRESSED / NOT ADDRESSED; probe adversarially — is there any remaining standalone commit or await in the sync path; does the assignment on the main RAG path actually reach a commit on every terminal outcome (or can it silently never persist); can a rollback now leave the in-memory session object dirty in a way that pollutes a later commit in the same request; do the failure-injection tests actually exercise the claimed windows. Flag NEW breakage in this one commit only. If clean, ALL P1 findings from r1+r2 are closed — issue the FINAL batch verdict for `ba8a141..HEAD` (docs commits excluded).
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:37:Report: verdict + new-breakage + overall verdict CONSENSUS-SHIP / REVISE / BLOCK.
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:40:I’ll audit the transaction boundaries in `7ec0b4e`, trace every `_sync_session_domain_mode` call to its terminal outcomes, and inspect the new Postgres tests against the exact failure windows. I’ll treat the supplied test/build results as evidence and focus on new breakage introduced by this commit.
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:95:7ec0b4e fix(chat): Codex r2 — fold domain_mode sync into existing transactions
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:103:    fix(chat): Codex r2 — fold domain_mode sync into existing transactions
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:106:    domain_mode sync did its OWN separate commit, outside that branch's
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:107:    existing transaction boundary, creating new failure windows:
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:109:      executed — a subsequent tool failure left the domain_mode change
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:112:      chat_tool_executor.execute() call still left domain_mode durably None
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:120:    Fix (Codex's prescribed shape): _sync_session_domain_mode is now a PURE,
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:132:    - strict Quote Finder: _run_verified_quote_search now takes domain_mode
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:136:      longer does anything domain_mode-related after settled=True.
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:145:    domain_mode assignment NOR the real work half-committed, and (for the
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:154:    domain_mode wrongly committed to None on a subsequent tool failure,
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:249:-async def _sync_session_domain_mode(
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:250:-    db: AsyncSession, session_obj: ChatSession, domain_mode: Optional[str],
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:252:-    """P1 hygiene follow-up (Codex M3 P1 review, 2026-08-03): the persisted
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:253:+def _sync_session_domain_mode(session_obj: ChatSession, domain_mode: Optional[str]) -> None:
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:254:+    """P1 hygiene (Codex M3 P1 review r1+r2, 2026-08-03): the persisted
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:255:     ChatSession.domain_mode must reflect the CURRENT request's domain_mode
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:261:-    that once had domain_mode="legal" persisted could keep that stale
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:267:-    `domain_mode` argument directly, never re-reads session_obj.domain_mode
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:274:+    ever ran. A session that once had domain_mode="legal" persisted could
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:280:+    THAT was itself a new hazard: a standalone commit outside each
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:282:+    failure window. Worse, in the tool-action branch the extra commit ran
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:284:+    domain_mode change committed anyway — silently defeating the "sync
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:299:     if domain_mode != session_obj.domain_mode:
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:300:         session_obj.domain_mode = domain_mode
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:462:         domain_mode: Optional[str],
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:483:                 domain_mode=domain_mode,
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:507:+            # P1 hygiene r2 (Codex, 2026-08-03): a PURE assignment, set
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:509:+            # commit — never a standalone commit. If the tool execution
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:512:+            # everything back together, domain_mode included — never a
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:513:+            # half-committed sync. See _sync_session_domain_mode's docstring.
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:514:+            _sync_session_domain_mode(session_obj, domain_mode)
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:540:+        domain_mode: Optional[str],
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:665:+        # P1 hygiene r2 (Codex, 2026-08-03): a PURE assignment, folded
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:670:+        # charged with no way back. See _sync_session_domain_mode's
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:672:+        _sync_session_domain_mode(session_obj, domain_mode)
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:694:         domain_mode: Optional[str] = None,
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:776:-            # P1 hygiene follow-up (Codex, 2026-08-03): this successful
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:777:-            # early-return path skipped the domain_mode session sync that
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:779:-            # _sync_session_domain_mode's docstring.
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:780:-            await _sync_session_domain_mode(db, session_obj, domain_mode)
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:781:+            # P1 hygiene r1+r2 (Codex, 2026-08-03): this successful
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:782:+            # early-return path needs the domain_mode session sync too —
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:784:+            # before its own terminal commit (see _sync_session_domain_mode's
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:785:+            # docstring for why it's not done here as a standalone commit).
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:792:                 domain_mode=domain_mode,
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:804:             domain_mode=domain_mode,
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:880:+                        domain_mode=domain_mode,
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:981:+                # domain_mode was already synced INSIDE that same atomic
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:982:+                # commit (P1 hygiene r2, Codex 2026-08-03) — nothing left
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:985:-                # P1 hygiene follow-up (Codex, 2026-08-03): this successful
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:986:-                # early-return path also skipped the domain_mode session
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:987:-                # sync — see _sync_session_domain_mode's docstring.
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:988:-                await _sync_session_domain_mode(db, session_obj, domain_mode)
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1133:             # Frontend always sends domain_mode: null (default) or "legal"/"academic"
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1134:             # domain_mode=None means Default (no extra rules), string means apply rules
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1135:             if domain_mode:
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1137:                 domain_rules = DOMAIN_RULES.get(domain_mode)
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1140:                     domain_rules_text = f"\n\n## {domain_mode.title()} Mode Rules\n"
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1149:             # Persist domain_mode to session (null clears, string sets) —
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1150:-            # see _sync_session_domain_mode's docstring; this is the main
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1152:-            # Quote Finder early returns above (P1 hygiene, Codex 2026-08-03).
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1153:-            await _sync_session_domain_mode(db, session_obj, domain_mode)
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1155:+            # _sync_session_domain_mode's docstring, r2). session_obj is
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1163:+            _sync_session_domain_mode(session_obj, domain_mode)
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1450:+    """P1 hygiene r2 (Codex, 2026-08-03): the domain_mode session-sync
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1451:+    assignment (_sync_session_domain_mode) must ride each branch's OWN
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1453:+    commit must leave NO half-committed domain_mode, and (for the billed
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1460:+    async def test_tool_action_commit_failure_leaves_domain_mode_uncommitted(
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1465:+        domain_mode change committed anyway. This reproduces the
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1480:+                domain_mode="legal", title="Existing title",  # pre-set: skips
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1519:+                    domain_mode=None,  # omitted — should clear the stale "legal" value
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1527:+        # the domain_mode assignment never landed (still the stale
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1532:+            assert survivor.domain_mode == "legal"  # NOT half-committed to None
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1538:+    async def test_quote_finder_commit_failure_leaves_domain_mode_uncommitted_and_fully_refunds(
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1546:+        failure AFTER the domain_mode assignment has happened in memory,
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1565:+                domain_mode="legal", title="Existing title",  # pre-set: skips
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1619:+                    domain_mode=None,  # omitted — should clear the stale "legal" value
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1631:+        # Real Postgres, real rollback: the domain_mode assignment and the
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1636:+            assert survivor.domain_mode == "legal"  # NOT half-committed to None
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1734:/bin/zsh -lc "rg -n -C 12 \"_sync_session_domain_mode|_tool_action_stream|_run_verified_quote_search|await db\\.commit\\(|await db\\.rollback\\(|yield .*done|return"'$" backend/app/services/chat_service.py' in /Users/mayijie/Projects/Code/010_DocTalk
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1821:956:def _sync_session_domain_mode(session_obj: ChatSession, domain_mode: Optional[str]) -> None:
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1822:957-    """P1 hygiene (Codex M3 P1 review r1+r2, 2026-08-03): the persisted
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1823:958-    ChatSession.domain_mode must reflect the CURRENT request's domain_mode
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1830:965-    ever ran. A session that once had domain_mode="legal" persisted could
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1836:971-    THAT was itself a new hazard: a standalone commit outside each
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1838:973-    failure window. Worse, in the tool-action branch the extra commit ran
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1840:975-    domain_mode change committed anyway — silently defeating the "sync
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1942:1330-        domain_mode: Optional[str],
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1954:1375-            # P1 hygiene r2 (Codex, 2026-08-03): a PURE assignment, set
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1956:1377-            # commit — never a standalone commit. If the tool execution
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1959:1380-            # everything back together, domain_mode included — never a
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1960:1381:            # half-committed sync. See _sync_session_domain_mode's docstring.
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1961:1382:            _sync_session_domain_mode(session_obj, domain_mode)
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1987:1408-        domain_mode: Optional[str],
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:1999:1533-        # P1 hygiene r2 (Codex, 2026-08-03): a PURE assignment, folded
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:2004:1538:        # charged with no way back. See _sync_session_domain_mode's
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:2006:1540:        _sync_session_domain_mode(session_obj, domain_mode)
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:2067:1644-            # P1 hygiene r1+r2 (Codex, 2026-08-03): this successful
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:2068:1645-            # early-return path needs the domain_mode session sync too —
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:2070:1647:            # before its own terminal commit (see _sync_session_domain_mode's
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:2071:1648-            # docstring for why it's not done here as a standalone commit).
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:2078:1655-                domain_mode=domain_mode,
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:2090:1667-            domain_mode=domain_mode,
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:2156:1743-                        domain_mode=domain_mode,
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:2199:1844-                # domain_mode was already synced INSIDE that same atomic
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:2200:1845-                # commit (P1 hygiene r2, Codex 2026-08-03) — nothing left
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:2232:2115-                    domain_rules_text = f"\n\n## {domain_mode.title()} Mode Rules\n"
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:2241:2124-            # Persist domain_mode to session (null clears, string sets) —
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:2243:2126:            # _sync_session_domain_mode's docstring, r2). session_obj is
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:2251:2134:            _sync_session_domain_mode(session_obj, domain_mode)
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:2735:        domain_mode: Optional[str],
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:2756:                domain_mode=domain_mode,
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:2780:            # P1 hygiene r2 (Codex, 2026-08-03): a PURE assignment, set
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:2782:            # commit — never a standalone commit. If the tool execution
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:2785:            # everything back together, domain_mode included — never a
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:2786:            # half-committed sync. See _sync_session_domain_mode's docstring.
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:2787:            _sync_session_domain_mode(session_obj, domain_mode)
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:2813:        domain_mode: Optional[str],
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:2938:        # P1 hygiene r2 (Codex, 2026-08-03): a PURE assignment, folded
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:2943:        # charged with no way back. See _sync_session_domain_mode's
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:2945:        _sync_session_domain_mode(session_obj, domain_mode)
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:2967:        domain_mode: Optional[str] = None,
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:3045:            # P1 hygiene r1+r2 (Codex, 2026-08-03): this successful
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:3046:            # early-return path needs the domain_mode session sync too —
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:3048:            # before its own terminal commit (see _sync_session_domain_mode's
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:3049:            # docstring for why it's not done here as a standalone commit).
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:3056:                domain_mode=domain_mode,
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:3068:            domain_mode=domain_mode,
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:3144:                        domain_mode=domain_mode,
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:3245:                # domain_mode was already synced INSIDE that same atomic
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:3246:                # commit (P1 hygiene r2, Codex 2026-08-03) — nothing left
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:3510:            # Frontend always sends domain_mode: null (default) or "legal"/"academic"
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:3511:            # domain_mode=None means Default (no extra rules), string means apply rules
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:3512:            if domain_mode:
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:3514:                domain_rules = DOMAIN_RULES.get(domain_mode)
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:3517:                    domain_rules_text = f"\n\n## {domain_mode.title()} Mode Rules\n"
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:3526:            # Persist domain_mode to session (null clears, string sets) —
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:3528:            # _sync_session_domain_mode's docstring, r2). session_obj is
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:3536:            _sync_session_domain_mode(session_obj, domain_mode)
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:4048:  1743	                        domain_mode=domain_mode,
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:4149:  1844	                # domain_mode was already synced INSIDE that same atomic
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:4150:  1845	                # commit (P1 hygiene r2, Codex 2026-08-03) — nothing left
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:4415:  2108	            # Frontend always sends domain_mode: null (default) or "legal"/"academic"
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:4416:  2109	            # domain_mode=None means Default (no extra rules), string means apply rules
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:4417:  2110	            if domain_mode:
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:4419:  2112	                domain_rules = DOMAIN_RULES.get(domain_mode)
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:4422:  2115	                    domain_rules_text = f"\n\n## {domain_mode.title()} Mode Rules\n"
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:4431:  2124	            # Persist domain_mode to session (null clears, string sets) —
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:4433:  2126	            # _sync_session_domain_mode's docstring, r2). session_obj is
.collab/reviews/2026-08-04-p1-hygiene-codex-r3.md:4441:  2134	            _sync_session_domain_mode(session_obj, domain_mode)
backend/tests/test_extractions_api.py:131:# -------------------------- domain_mode plan gate (P1 hygiene follow-up) --------------------------
backend/tests/test_extractions_api.py:133:# domain_mode tests): domain_mode ("legal"/"academic") is a Plus+ feature,
backend/tests/test_extractions_api.py:139:async def test_create_extraction_domain_mode_requires_plus_for_free_plan(client: AsyncClient) -> None:
backend/tests/test_extractions_api.py:147:        json={"template_key": "executive_summary", "domain_mode": "legal"},
backend/tests/test_extractions_api.py:155:async def test_create_extraction_domain_mode_omitted_does_not_gate_free_plan(client: AsyncClient) -> None:
backend/tests/test_extractions_api.py:156:    """Regression guard: domain_mode omitted must reach the NEXT check
backend/tests/test_extractions_api.py:157:    (the free monthly extraction limit here), never the domain_mode 403 —
backend/tests/test_extractions_api.py:158:    the gate is domain_mode-conditional, not a blanket block."""
backend/tests/test_extractions_api.py:172:    _assert_error(response, 403, "EXTRACTION_LIMIT_REACHED")  # NOT the domain_mode gate
backend/tests/test_extractions_api.py:176:async def test_create_extraction_domain_mode_allowed_for_plus_plan(
backend/tests/test_extractions_api.py:181:    with domain_mode set passes through to the NEXT check (credits here,
backend/tests/test_extractions_api.py:183:    shape) instead of the domain_mode 403."""
backend/tests/test_extractions_api.py:193:        json={"template_key": "executive_summary", "domain_mode": "legal"},
backend/tests/test_extractions_api.py:196:    _assert_error(response, 402, "INSUFFICIENT_CREDITS")  # NOT the domain_mode gate
backend/tests/test_query_router.py:123:    route = query_router.route("Does this contract contain a non-compete clause?", domain_mode="legal")
backend/tests/test_chat_strict_quote_predebit.py:154:            id=session_id, document_id=document_id, collection_id=None, title=None, domain_mode=None,
backend/tests/test_chat_setup_refunds.py:270:    session_obj = SimpleNamespace(id=session_id, document_id=document_id, collection_id=None, title=None, domain_mode=None)
backend/tests/test_chat_setup_refunds.py:432:    session_obj = SimpleNamespace(id=session_id, document_id=document_id, collection_id=None, title=None, domain_mode=None)
backend/tests/test_chat_corrective_retrieval.py:234:        domain_mode=None,
backend/tests/test_quote_billing_failure_windows_integration.py:226:    """P1 hygiene r2 (Codex, 2026-08-03): the domain_mode session-sync
backend/tests/test_quote_billing_failure_windows_integration.py:227:    assignment (_sync_session_domain_mode) must ride each branch's OWN
backend/tests/test_quote_billing_failure_windows_integration.py:229:    commit must leave NO half-committed domain_mode, and (for the billed
backend/tests/test_quote_billing_failure_windows_integration.py:236:    async def test_tool_action_commit_failure_leaves_domain_mode_uncommitted(
backend/tests/test_quote_billing_failure_windows_integration.py:241:        domain_mode change committed anyway. This reproduces the
backend/tests/test_quote_billing_failure_windows_integration.py:256:                domain_mode="legal", title="Existing title",  # pre-set: skips
backend/tests/test_quote_billing_failure_windows_integration.py:295:                    domain_mode=None,  # omitted — should clear the stale "legal" value
backend/tests/test_quote_billing_failure_windows_integration.py:303:        # the domain_mode assignment never landed (still the stale
backend/tests/test_quote_billing_failure_windows_integration.py:308:            assert survivor.domain_mode == "legal"  # NOT half-committed to None
backend/tests/test_quote_billing_failure_windows_integration.py:314:    async def test_quote_finder_commit_failure_leaves_domain_mode_uncommitted_and_fully_refunds(
backend/tests/test_quote_billing_failure_windows_integration.py:322:        failure AFTER the domain_mode assignment has happened in memory,
backend/tests/test_quote_billing_failure_windows_integration.py:341:                domain_mode="legal", title="Existing title",  # pre-set: skips
backend/tests/test_quote_billing_failure_windows_integration.py:395:                    domain_mode=None,  # omitted — should clear the stale "legal" value
backend/tests/test_quote_billing_failure_windows_integration.py:407:        # Real Postgres, real rollback: the domain_mode assignment and the
backend/tests/test_quote_billing_failure_windows_integration.py:412:            assert survivor.domain_mode == "legal"  # NOT half-committed to None
backend/tests/test_chat_tool_executor.py:64:        domain_mode=None,
backend/tests/test_chat_tool_executor.py:108:        domain_mode=None,
backend/tests/test_chat_tool_executor.py:134:        domain_mode=None,
backend/tests/test_error_taxonomy.py:723:# -------------------------- domain_mode plan gate (P1 hygiene) --------------------------
backend/tests/test_error_taxonomy.py:724:# domain_mode ("legal"/"academic") is marketed as a Plus+ feature
backend/tests/test_error_taxonomy.py:727:# ChatRequest.domain_mode -> chat.py:468's chat_service.chat_stream() call,
backend/tests/test_error_taxonomy.py:729:# {"domain_mode": "legal"} directly and get the paid prompt behavior.
backend/tests/test_error_taxonomy.py:732:async def test_chat_domain_mode_requires_plus_for_free_plan(
backend/tests/test_error_taxonomy.py:744:        json={"message": "Hello", "domain_mode": "legal"},
backend/tests/test_error_taxonomy.py:751:async def test_chat_domain_mode_requires_plus_for_anonymous(
backend/tests/test_error_taxonomy.py:762:        json={"message": "Hello", "domain_mode": "academic"},
backend/tests/test_error_taxonomy.py:769:async def test_chat_domain_mode_omitted_does_not_gate_free_plan(
backend/tests/test_error_taxonomy.py:773:    """Regression guard: the new gate must be domain_mode-conditional, not a
backend/tests/test_error_taxonomy.py:774:    blanket block on free-plan chat — a free user with NO domain_mode set
backend/tests/test_error_taxonomy.py:776:    the domain_mode 403."""
backend/tests/test_error_taxonomy.py:785:    _assert_error(response, 429, "RATE_LIMITED")  # NOT the domain_mode gate
backend/tests/test_error_taxonomy.py:789:async def test_chat_domain_mode_allowed_for_plus_plan(
backend/tests/test_error_taxonomy.py:794:    sending domain_mode reaches chat_service.chat_stream (mocked to a
backend/tests/test_error_taxonomy.py:795:    trivial stream) and gets a normal 200, not the domain_mode 403."""
backend/tests/test_error_taxonomy.py:819:        json={"message": "Hello", "domain_mode": "legal"},
backend/tests/test_chat_summary_routing.py:139:        domain_mode=None,
backend/tests/test_chat_summary_routing.py:222:        domain_mode=None,
backend/tests/test_chat_summary_routing.py:330:        domain_mode=None,
.collab/reviews/2026-05-24-phase2b-codex-review.md:1388:                domain_mode=domain_mode,
.collab/reviews/2026-05-24-phase2b-codex-review.md:1399:            domain_mode=domain_mode,
.collab/reviews/2026-05-24-phase2b-codex-review.md:1653:            # Frontend always sends domain_mode: null (default) or "legal"/"academic"
.collab/reviews/2026-05-24-phase2b-codex-review.md:1654:            # domain_mode=None means Default (no extra rules), string means apply rules
.collab/reviews/2026-05-24-phase2b-codex-review.md:1655:            if domain_mode:
.collab/reviews/2026-05-24-phase2b-codex-review.md:1657:                domain_rules = DOMAIN_RULES.get(domain_mode)
.collab/reviews/2026-05-24-phase2b-codex-review.md:1660:                    domain_rules_text = f"\n\n## {domain_mode.title()} Mode Rules\n"
5ed047b (HEAD -> main, origin/main, origin/HEAD) docs(review): P1 hygiene Codex r3 request
7ec0b4e fix(chat): Codex r2 — fold domain_mode sync into existing transactions
c1d121e docs(review): P1 hygiene Codex r2 (r1 findings closed; new txn-safety P2)
9da2bc4 docs(review): correct P1 r2 request to actual per-branch sync impl (2d4e01a)
2e5066e docs(review): P1 hygiene Codex r2 request
2d4e01a fix(chat): sync persisted domain_mode on ALL successful early returns
bb79453 fix: Pro-tier document cap dead-end + openPaywall comment accuracy (Codex P1)
337f981 docs(review): P1 hygiene Codex r1 (REVISE — Pro dead-end + 2 P3)
e499bc7 docs(review): P1 hygiene Codex request
1fab067 fix: drop stray openPaywall on DOMAIN_MODE_REQUIRES_PLUS, fix rule doc
116d963 docs(spec): Liquid Glass redesign — Counterpoint palette + Fraunces/Plex, marketing-first batching
1a2dcc8 feat: add DOMAIN_MODE_REQUIRES_PLUS upgrade path (chat + REST extraction)
28c0977 fix: surface DOCUMENT_LIMIT_REACHED upgrade CTA in layout-translation import
78f660b fix: surface DOCUMENT_LIMIT_REACHED upgrade CTA in layout-translation submit
4cd4c8a fix: surface SHARE_LIMIT_REACHED upgrade CTA in chat share errors
dc18eff docs: P1 paywall upgrade-path coverage audit
4105a87 docs(p1-hygiene): fill in the extractions.py commit hash in the report
ef7e798 fix(extractions): gate domain_mode as Plus+ (P1 hygiene, second entry point)
b6da842 fix(chat): backend-gate domain_mode as a Plus+ feature (P1 hygiene)
M	backend/app/services/chat_service.py
M	backend/tests/test_quote_billing_failure_windows_integration.py

exec
/bin/zsh -lc "git show --name-only --format='' c1d121e
sed -n '1,240p' .collab/reviews/2026-08-04-p1-hygiene-codex-r2.md 2>/dev/null || true
git show c1d121e -- '*.md' | tail -n 240" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
.collab/reviews/2026-08-03-p1-hygiene-codex-r2.md
+
+async def failed_tool_still_syncs():
+    sid, did, uid = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
+    session, doc = _base_session_and_doc(did, sid)
+    session.domain_mode = "legal"
+    session.title = "Existing"
+    db = _make_db(session, doc, execute_side_effect=[_ScalarOneResult(session)])
+    plan = SimpleNamespace(action=ChatAction.EXPORT_TABLES, uses_rag_answer_path=False,
+        confidence=.9, reason="probe", user_visible_status="", quote_finder_hint=False,
+        quote_finder_hint_topic=None)
+    with patch.object(cs.action_planner, "plan", AsyncMock(return_value=plan)), '"\\
+         patch.object(cs.chat_tool_executor, \"execute\", AsyncMock(side_effect=RuntimeError(\"tool failed\"))):
+        events = [e async for e in cs.chat_service.chat_stream(
+            sid, \"Export tables\", db, user=SimpleNamespace(id=uid, plan=\"pro\"),
+            mode=\"balanced\", domain_mode=None)]
+    return f\"terminal={events[-1]['event']}:{events[-1]['data']['code']}; domain_mode={session.domain_mode"'!r}; commits={db.commit.await_count}"
+
+async def strict_post_settlement_sync_failure():
+    sid, did, uid, ledger = uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
+    session, doc = _base_session_and_doc(did, sid)
+    session.domain_mode = "legal"
+    session.title = "Existing"
+    db = _make_db(session, doc, execute_side_effect=[_ScalarOneResult(session)])
+    db.commit = AsyncMock(side_effect=[None, None, None, RuntimeError("sync commit failed")])
+    refund = AsyncMock()
+    result = QuoteSearchResult(cards=[], proposed=0, verified=0, discarded=[],
+        scanned_chunks=3, usage=(100, 20), model="deepseek-v4-pro")
+    with patch.object(cs.action_planner, "plan", AsyncMock(return_value=_quote_action_plan())), '"\\
+         patch.object(cs.query_router, \"route\", return_value=SimpleNamespace(primary_intent=QueryIntent.LOCAL_QA)), \\
+         patch.object(cs.credit_service, \"get_estimated_cost\", return_value=15), \\
+         patch.object(cs.credit_service, \"debit_credits\", AsyncMock(return_value=ledger)), \\
+         patch.object(cs.credit_service, \"reconcile_credits\", AsyncMock()), \\
+         patch.object(cs.credit_service, \"record_usage\", AsyncMock()), \\
+         patch.object(cs.credit_service, \"calculate_cost\", return_value=6), \\
+         patch.object(cs.quote_search_service, \"quote_search\", AsyncMock(return_value=result)), \\
+         patch.object(cs, \"_refund_predebit\", refund):
+        events = [e async for e in cs.chat_service.chat_stream(
+            sid, \"Give me a direct quote about termination.\", db,
+            user=SimpleNamespace(id=uid, plan=\"pro\"), mode=\"balanced\", domain_mode=None)]
+    return f\"terminal={events[-1]['event']}:{events[-1]['data']['code']}; commits={db.commit.await_count}; refund_calls={refund.await_count}\"
+
+async def main():
+    print(\"tool_sync_commit_failure\", await tool_sync_commit_failure())
+    print(\"failed_tool_still_syncs\", await failed_tool_still_syncs())
+    print(\"strict_post_settlement_sync_failure\", await strict_post_settlement_sync_failure())
+
+asyncio.run(main())
+PY" in /Users/mayijie/Projects/Code/010_DocTalk/backend/tests
+ exited 1 in 413ms:
+Traceback (most recent call last):
+  File "<stdin>", line 6, in <module>
+  File "/Users/mayijie/Projects/Code/010_DocTalk/backend/tests/test_quote_intent_routing.py", line 32, in <module>
+    import app.services.chat_service as chat_service_module  # noqa: E402
+  File "/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py", line 19, in <module>
+    from app.models.database import AsyncSessionLocal
+  File "/Users/mayijie/Projects/Code/010_DocTalk/backend/app/models/database.py", line 21, in <module>
+    DATABASE_URL = _get_database_url()
+  File "/Users/mayijie/Projects/Code/010_DocTalk/backend/app/models/database.py", line 16, in _get_database_url
+    raise RuntimeError("DATABASE_URL is not configured")
+RuntimeError: DATABASE_URL is not configured
+
+exec
+/bin/zsh -lc "env TESTING=1 DATABASE_URL=postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/doctalk_test python3 - <<'PY'
+import asyncio
+import uuid
+from types import SimpleNamespace
+from unittest.mock import AsyncMock, patch
+
+from test_quote_intent_routing import _ScalarOneResult, _base_session_and_doc, _make_db, _quote_action_plan
+import app.services.chat_service as cs
+from app.services.action_planner import ChatAction
+from app.services.query_router import QueryIntent
+from app.services.quote_search_service import QuoteSearchResult
+
+async def tool_sync_commit_failure():
+    sid, did, uid = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
+    session, doc = _base_session_and_doc(did, sid)
+    session.domain_mode = \"legal\"
+    session.title = \"Existing\"
+    db = _make_db(session, doc, execute_side_effect=[_ScalarOneResult(session)])
+    db.commit = AsyncMock(side_effect=RuntimeError(\"sync commit failed\"))
+    plan = SimpleNamespace(action=ChatAction.EXPORT_TABLES, uses_rag_answer_path=False,
+        confidence=.9, reason=\"probe\", user_visible_status=\"\", quote_finder_hint=False,
+        quote_finder_hint_topic=None)
+    with patch.object(cs.action_planner, \"plan\", AsyncMock(return_value=plan)):
+        try:
+            _ = [e async for e in cs.chat_service.chat_stream(
+                sid, \"Export tables\", db, user=SimpleNamespace(id=uid, plan=\"pro\"),
+                mode=\"balanced\", domain_mode=None)]
+        except RuntimeError as exc:
+            return f\"uncaught={exc}; domain_mode={session.domain_mode"'!r}"
+    return "unexpectedly caught"
+
+async def failed_tool_still_syncs():
+    sid, did, uid = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
+    session, doc = _base_session_and_doc(did, sid)
+    session.domain_mode = "legal"
+    session.title = "Existing"
+    db = _make_db(session, doc, execute_side_effect=[_ScalarOneResult(session)])
+    plan = SimpleNamespace(action=ChatAction.EXPORT_TABLES, uses_rag_answer_path=False,
+        confidence=.9, reason="probe", user_visible_status="", quote_finder_hint=False,
+        quote_finder_hint_topic=None)
+    with patch.object(cs.action_planner, "plan", AsyncMock(return_value=plan)), '"\\
+         patch.object(cs.chat_tool_executor, \"execute\", AsyncMock(side_effect=RuntimeError(\"tool failed\"))):
+        events = [e async for e in cs.chat_service.chat_stream(
+            sid, \"Export tables\", db, user=SimpleNamespace(id=uid, plan=\"pro\"),
+            mode=\"balanced\", domain_mode=None)]
+    return f\"terminal={events[-1]['event']}:{events[-1]['data']['code']}; domain_mode={session.domain_mode"'!r}; commits={db.commit.await_count}"
+
+async def strict_post_settlement_sync_failure():
+    sid, did, uid, ledger = uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
+    session, doc = _base_session_and_doc(did, sid)
+    session.domain_mode = "legal"
+    session.title = "Existing"
+    db = _make_db(session, doc, execute_side_effect=[_ScalarOneResult(session)])
+    db.commit = AsyncMock(side_effect=[None, None, None, RuntimeError("sync commit failed")])
+    refund = AsyncMock()
+    result = QuoteSearchResult(cards=[], proposed=0, verified=0, discarded=[],
+        scanned_chunks=3, usage=(100, 20), model="deepseek-v4-pro")
+    with patch.object(cs.action_planner, "plan", AsyncMock(return_value=_quote_action_plan())), '"\\
+         patch.object(cs.query_router, \"route\", return_value=SimpleNamespace(primary_intent=QueryIntent.LOCAL_QA)), \\
+         patch.object(cs.credit_service, \"get_estimated_cost\", return_value=15), \\
+         patch.object(cs.credit_service, \"debit_credits\", AsyncMock(return_value=ledger)), \\
+         patch.object(cs.credit_service, \"reconcile_credits\", AsyncMock()), \\
+         patch.object(cs.credit_service, \"record_usage\", AsyncMock()), \\
+         patch.object(cs.credit_service, \"calculate_cost\", return_value=6), \\
+         patch.object(cs.quote_search_service, \"quote_search\", AsyncMock(return_value=result)), \\
+         patch.object(cs, \"_refund_predebit\", refund):
+        events = [e async for e in cs.chat_service.chat_stream(
+            sid, \"Give me a direct quote about termination.\", db,
+            user=SimpleNamespace(id=uid, plan=\"pro\"), mode=\"balanced\", domain_mode=None)]
+    return f\"terminal={events[-1]['event']}:{events[-1]['data']['code']}; commits={db.commit.await_count}; refund_calls={refund.await_count}\"
+
+async def main():
+    print(\"tool_sync_commit_failure\", await tool_sync_commit_failure())
+    print(\"failed_tool_still_syncs\", await failed_tool_still_syncs())
+    print(\"strict_post_settlement_sync_failure\", await strict_post_settlement_sync_failure())
+
+asyncio.run(main())
+PY" in /Users/mayijie/Projects/Code/010_DocTalk/backend/tests
+ succeeded in 1068ms:
+/Users/mayijie/Library/Python/3.9/lib/python/site-packages/urllib3/__init__.py:35: NotOpenSSLWarning: urllib3 v2 only supports OpenSSL 1.1.1+, currently the 'ssl' module is compiled with 'LibreSSL 2.8.3'. See: https://github.com/urllib3/urllib3/issues/3020
+  warnings.warn(
+SSE error [CHAT_SETUP_ERROR] context={'session_id': '310fe938-6dbd-4d0b-b809-90fc3c344733'}
+Traceback (most recent call last):
+  File "/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py", line 1330, in _tool_action_stream
+    execution = await chat_tool_executor.execute(
+  File "/Applications/Xcode.app/Contents/Developer/Library/Frameworks/Python3.framework/Versions/3.9/lib/python3.9/unittest/mock.py", line 2154, in _execute_mock_call
+    raise effect
+RuntimeError: tool failed
+SSE error [QUOTE_SEARCH_ERROR] context={'session_id': '02c679af-1a32-4d68-8eab-1450ff9ba4d5'}
+Traceback (most recent call last):
+  File "/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py", line 1813, in chat_stream
+    await _sync_session_domain_mode(db, session_obj, domain_mode)
+  File "/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py", line 978, in _sync_session_domain_mode
+    await db.commit()
+  File "/Applications/Xcode.app/Contents/Developer/Library/Frameworks/Python3.framework/Versions/3.9/lib/python3.9/unittest/mock.py", line 2163, in _execute_mock_call
+    raise result
+RuntimeError: sync commit failed
+tool_sync_commit_failure uncaught=sync commit failed; domain_mode=None
+failed_tool_still_syncs terminal=error:CHAT_SETUP_ERROR; domain_mode=None; commits=2
+strict_post_settlement_sync_failure terminal=error:QUOTE_SEARCH_ERROR; commits=4; refund_calls=0
+
+codex
+The focused probes confirm the success cases, but also reproduce a new failure-window regression: a tool-action sync commit failure escapes the generator uncaught; a strict Quote Finder sync commit failure happens after answer/billing settlement and returns `QUOTE_SEARCH_ERROR` with no refund or streamed answer. I’m consolidating this as a scoped new-breakage finding and checking that no frontend counterpart changes its severity.
+Scoped tracing and adversarial failure-window probes are complete; the fixes close the original findings, but the new sync placement introduces a reproducible backend error path that changes the overall verdict.
+  ✓ Read scoped rules and inspect the two fix commits/diff
+  ✓ Trace DOCUMENT_LIMIT_REACHED rendering and plan-target logic
+  ✓ Trace all successful streaming terminal paths and sync semantics
+  → Run focused verification and issue the batch verdict
+Verification is complete. The original three r1 findings are addressed, but a reproducible new P2 failure window in the domain-mode sync requires revision.
+  ✓ Read scoped rules and inspect the two fix commits/diff
+  ✓ Trace DOCUMENT_LIMIT_REACHED rendering and plan-target logic
+  ✓ Trace all successful streaming terminal paths and sync semantics
+  ✓ Run focused verification and issue the batch verdict
+codex
+# Overall verdict: REVISE
+
+The three original r1 findings are addressed, but `2d4e01a` introduces a new P2 failure window.
+
+## Per-item verdicts
+
+- **P2 Pro document-cap dead-end — ADDRESSED.** `plan:"pro"` produces top-tier body copy with no CTA in [errorCopy.ts](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/errorCopy.ts:108). All `DOCUMENT_LIMIT_REACHED` producers supply normalized lowercase plans, and all consumers render the CTA conditionally. No remaining Pro→Plus document-limit link found. All 11 locale keys are present and valid.
+
+- **P3 `openPaywall` comment — ADDRESSED.** The comment accurately documents `DOMAIN_MODE_REQUIRES_PLUS` as the `useChatStream`-hardcoded exception while leaving the shared flag unset.
+
+- **P3 stale persisted `domain_mode` — ADDRESSED for successful execution.** The complete success-path inventory is tool action, strict Quote Finder, and main RAG. Summary/overview, page lookup, collection summary, and ordinary QA all remain within main RAG; there is no fourth fast-path. The branches are mutually exclusive, so the sync cannot double-apply. Both focused regression tests pass.
+
+The production 403 gate still executes before entering the service, at [chat.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:399). No gating or prompt-behavior bypass was introduced.
+
+## New breakage
+
+**P2 — early-route synchronization is not transactionally safe.**
+
+At [chat_service.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:1616), the tool-action sync runs before tool execution and outside the branch’s exception boundary:
+
+- If the sync commit fails, the exception escapes the streaming generator without a structured SSE error.
+- If tool execution subsequently fails, the request ends with `CHAT_SETUP_ERROR` but the domain metadata was already committed. Thus the claim that synchronization does not run on rejection paths is false.
+
+At [chat_service.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:1813), strict Quote Finder synchronizes after its answer, billing reconciliation, and usage have committed and `settled=True`:
+
+- If this additional commit fails, the request returns `QUOTE_SEARCH_ERROR` before emitting artifact/token/done.
+- The answer remains persisted and charged, while the client receives neither the answer nor a refund.
+
+Both failure windows were reproduced with focused injected-failure probes. The appropriate repair is to include the domain-mode assignment in each branch’s existing successful terminal transaction, rather than performing separate pre-execution or post-settlement commits.
+
+No other new breakage was found in `bb79453` or `2d4e01a`. The original P1 gate findings remain closed and bypass-free, but `ba8a141..HEAD` is not ship-ready until this new P2 is fixed.
+tokens used
+182,692
+# Overall verdict: REVISE
+
+The three original r1 findings are addressed, but `2d4e01a` introduces a new P2 failure window.
+
+## Per-item verdicts
+
+- **P2 Pro document-cap dead-end — ADDRESSED.** `plan:"pro"` produces top-tier body copy with no CTA in [errorCopy.ts](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/errorCopy.ts:108). All `DOCUMENT_LIMIT_REACHED` producers supply normalized lowercase plans, and all consumers render the CTA conditionally. No remaining Pro→Plus document-limit link found. All 11 locale keys are present and valid.
+
+- **P3 `openPaywall` comment — ADDRESSED.** The comment accurately documents `DOMAIN_MODE_REQUIRES_PLUS` as the `useChatStream`-hardcoded exception while leaving the shared flag unset.
+
+- **P3 stale persisted `domain_mode` — ADDRESSED for successful execution.** The complete success-path inventory is tool action, strict Quote Finder, and main RAG. Summary/overview, page lookup, collection summary, and ordinary QA all remain within main RAG; there is no fourth fast-path. The branches are mutually exclusive, so the sync cannot double-apply. Both focused regression tests pass.
+
+The production 403 gate still executes before entering the service, at [chat.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:399). No gating or prompt-behavior bypass was introduced.
+
+## New breakage
+
+**P2 — early-route synchronization is not transactionally safe.**
+
+At [chat_service.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:1616), the tool-action sync runs before tool execution and outside the branch’s exception boundary:
+
+- If the sync commit fails, the exception escapes the streaming generator without a structured SSE error.
+- If tool execution subsequently fails, the request ends with `CHAT_SETUP_ERROR` but the domain metadata was already committed. Thus the claim that synchronization does not run on rejection paths is false.
+
+At [chat_service.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:1813), strict Quote Finder synchronizes after its answer, billing reconciliation, and usage have committed and `settled=True`:
+
+- If this additional commit fails, the request returns `QUOTE_SEARCH_ERROR` before emitting artifact/token/done.
+- The answer remains persisted and charged, while the client receives neither the answer nor a refund.
+
+Both failure windows were reproduced with focused injected-failure probes. The appropriate repair is to include the domain-mode assignment in each branch’s existing successful terminal transaction, rather than performing separate pre-execution or post-settlement commits.
+
+No other new breakage was found in `bb79453` or `2d4e01a`. The original P1 gate findings remain closed and bypass-free, but `ba8a141..HEAD` is not ship-ready until this new P2 is fixed.

exec
/bin/zsh -lc "nl -ba backend/app/api/chat.py | sed -n '340,520p'
rg -n \"async def get_db|get_db\\(\" backend/app -g '*.py' | head -n 80
rg -n \"def get_db|async def get_db\" backend/app -g '*.py'
nl -ba backend/app/models/database.py | sed -n '1,180p'
git diff --unified=25 7ec0b4e"'^ 7ec0b4e -- backend/app/services/chat_service.py' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   340	        select(Message).where(Message.session_id == session_id).order_by(asc(Message.created_at))
   341	    )
   342	    items = []
   343	    for m in rows.scalars():
   344	        items.append(
   345	            ChatMessageResponse(
   346	                id=m.id,
   347	                share_anchor=message_share_anchor(m.id),
   348	                role=m.role,
   349	                content=m.content,
   350	                citations=m.citations,
   351	                metadata_json=getattr(m, "metadata_json", {}) or {},
   352	                created_at=m.created_at,
   353	            )
   354	        )
   355	    # Anonymous demo sessions: surface the used count so the frontend can
   356	    # restore the counter when it reuses a stored session (see create-session).
   357	    demo_messages_used = None
   358	    if session.user_id is None and session.document and session.document.demo_slug:
   359	        client_ip = get_client_ip(request)
   360	        demo_messages_used = await demo_message_tracker.get_count(
   361	            _demo_message_key(client_ip, session.document_id)
   362	        )
   363	
   364	    return SessionMessagesResponse(messages=items, demo_messages_used=demo_messages_used)
   365	
   366	
   367	@chat_router.post("/sessions/{session_id}/chat")
   368	async def chat_stream(
   369	    session_id: uuid.UUID,
   370	    body: ChatRequest,
   371	    request: Request,
   372	    user: Optional[User] = Depends(get_current_user_optional),
   373	    db: AsyncSession = Depends(get_db_session),
   374	):
   375	    # Verify session access
   376	    session = await verify_session_access(session_id, user, db)
   377	    if not session:
   378	        raise HTTPException(status_code=404, detail=SESSION_NOT_FOUND_DETAIL)
   379	
   380	    # Block chat if document is not fully processed
   381	    if session.document and session.document.status != "ready":
   382	        raise HTTPException(
   383	            status_code=409,
   384	            detail={
   385	                "error": "DOCUMENT_PROCESSING",
   386	                "message": "Document is still being processed",
   387	                "status": session.document.status,
   388	            },
   389	        )
   390	
   391	    # P1 hygiene (top-down review, 2026-08-01): domain_mode ("legal"/
   392	    # "academic") is marketed as a Plus+ feature — the frontend disables
   393	    # the selector for free users (DomainModeSelector.tsx: canUse = plan in
   394	    # {plus,pro}) — but the backend accepted it unconditionally, so any
   395	    # free (or anonymous) user could bypass the UI gate entirely with a raw
   396	    # POST {"domain_mode": "legal"} and get the paid prompt behavior.
   397	    # Checked here, before the rate-limit/credit work below, since it's a
   398	    # cheap deterministic authorization check independent of both.
   399	    if body.domain_mode is not None:
   400	        plan = (user.plan or "free").lower() if user is not None else "free"
   401	        if plan not in {"plus", "pro"}:
   402	            raise HTTPException(
   403	                status_code=403,
   404	                detail={
   405	                    "error": "DOMAIN_MODE_REQUIRES_PLUS",
   406	                    "message": "Legal/Academic domain mode requires a Plus or Pro plan",
   407	                    "required_plan": "plus",
   408	                },
   409	            )
   410	
   411	    # Rate limit anonymous users
   412	    if user is None:
   413	        client_ip = get_client_ip(request)
   414	        if not await demo_chat_limiter.is_allowed(client_ip):
   415	            log_security_event("demo_rate_limit", ip=client_ip, session_id=session_id)
   416	            raise HTTPException(
   417	                status_code=429,
   418	                detail={
   419	                    "error": "RATE_LIMITED",
   420	                    "message": "Rate limit exceeded",
   421	                    "retry_after": 60,
   422	                },
   423	                headers={"Retry-After": "60"},
   424	            )
   425	    else:
   426	        # Rate limit authenticated users (30 req/min per user)
   427	        if not await auth_chat_limiter.is_allowed(str(user.id)):
   428	            raise HTTPException(
   429	                status_code=429,
   430	                detail={
   431	                    "error": "RATE_LIMITED",
   432	                    "message": "Rate limit exceeded",
   433	                    "retry_after": 60,
   434	                },
   435	                headers={"Retry-After": "60"},
   436	            )
   437	
   438	    # Enforce message limit for anonymous users on demo documents.
   439	    # Tracker key is scoped per (IP, document) and survives session recreation.
   440	    if user is None and session.document and session.document.demo_slug:
   441	        allowed, _count = await demo_message_tracker.check_and_increment(
   442	            _demo_message_key(client_ip, session.document_id), DEMO_MESSAGE_LIMIT
   443	        )
   444	        if not allowed:
   445	            log_security_event("demo_message_limit", ip=client_ip, document_id=session.document_id)
   446	            raise HTTPException(
   447	                status_code=429,
   448	                detail={
   449	                    "error": "DEMO_MESSAGE_LIMIT_REACHED",
   450	                    "message": "Demo message limit reached",
   451	                    "limit": DEMO_MESSAGE_LIMIT,
   452	                },
   453	            )
   454	
   455	    # If authenticated, ensure sufficient credits before opening stream
   456	    if user is not None:
   457	        from app.services.credit_service import ensure_monthly_credits
   458	        await ensure_monthly_credits(db, user)
   459	        await db.commit()
   460	        # Use mode-specific estimated cost for pre-check (actual pre-debit happens in chat_service)
   461	        effective_mode = body.mode or "balanced"
   462	        await enforce_free_mode_limits(db, user, effective_mode)
   463	        # FIX-3 (Codex r1 BLOCKER #3): strict-intent detection happens BEFORE
   464	        # this predebit decision — a strict-routed message always runs the
   465	        # balanced-model quote engine regardless of the selected chat mode,
   466	        # so this pre-check (and chat_service's own predebit, which mirrors
   467	        # this exact predicate) must reflect the balanced estimate, not
   468	        # effective_mode's (e.g. quick=5).
   469	        strict_quote_routed = _chat_strict_quote_routed(session, body.message)
   470	        estimated_cost = credit_service.get_estimated_cost(
   471	            "balanced" if strict_quote_routed else effective_mode
   472	        )
   473	        balance = await credit_service.get_user_credits(db, user.id)
   474	        if balance < estimated_cost:
   475	            raise HTTPException(
   476	                status_code=402,
   477	                detail={
   478	                    "error": "INSUFFICIENT_CREDITS",
   479	                    "message": "Insufficient credits",
   480	                    "required": estimated_cost,
   481	                    "balance": balance,
   482	                },
   483	            )
   484	
   485	    async def event_generator() -> AsyncGenerator[str, None]:
   486	        async for ev in chat_service.chat_stream(
   487	            session_id, body.message, db, user=user, locale=body.locale, mode=body.mode,
   488	            domain_mode=body.domain_mode
   489	        ):
   490	            # Format per SSE: event: <type>\ndata: {json}\n\n
   491	            line = f"event: {ev['event']}\n"
   492	            payload = json.dumps(ev.get("data", {}), ensure_ascii=False)
   493	            data_line = f"data: {payload}\n\n"
   494	            yield line + data_line
   495	
   496	    return StreamingResponse(
   497	        event_generator(),
   498	        media_type="text/event-stream",
   499	        headers={
   500	            "Cache-Control": "no-cache, no-transform",
   501	            "X-Accel-Buffering": "no",
   502	            "Connection": "keep-alive",
   503	        },
   504	    )
   505	
   506	
   507	@chat_router.post("/sessions/{session_id}/chat/continue")
   508	async def chat_continue(
   509	    session_id: uuid.UUID,
   510	    body: ContinueRequest,
   511	    request: Request,
   512	    user: Optional[User] = Depends(get_current_user_optional),
   513	    db: AsyncSession = Depends(get_db_session),
   514	):
   515	    # Verify session access
   516	    session = await verify_session_access(session_id, user, db)
   517	    if not session:
   518	        raise HTTPException(status_code=404, detail=SESSION_NOT_FOUND_DETAIL)
   519	
   520	    # Block if document is not ready
backend/app/core/deps.py:18:async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
backend/app/core/deps.py:18:async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
     1	from __future__ import annotations
     2	
     3	import os
     4	from typing import Optional
     5	
     6	from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
     7	from sqlalchemy.pool import NullPool
     8	
     9	from app.core.config import settings
    10	
    11	
    12	def _get_database_url() -> str:
    13	    # Priority: settings.DATABASE_URL -> env DATABASE_URL -> error
    14	    url: Optional[str] = settings.DATABASE_URL or os.getenv("DATABASE_URL")
    15	    if not url:
    16	        raise RuntimeError("DATABASE_URL is not configured")
    17	    return url
    18	
    19	
    20	# Create async engine and sessionmaker (expire_on_commit=False for FastAPI typical usage)
    21	DATABASE_URL = _get_database_url()
    22	engine_kwargs: dict[str, object] = {"pool_pre_ping": True}
    23	
    24	if os.getenv("TESTING") == "1":
    25	    engine_kwargs["poolclass"] = NullPool
    26	else:
    27	    engine_kwargs.update(
    28	        pool_size=10,
    29	        max_overflow=20,
    30	        pool_recycle=1800,
    31	    )
    32	
    33	async_engine: AsyncEngine = create_async_engine(DATABASE_URL, **engine_kwargs)
    34	AsyncSessionLocal = async_sessionmaker(async_engine, expire_on_commit=False)
diff --git a/backend/app/services/chat_service.py b/backend/app/services/chat_service.py
index 704a4d5..c7fec94 100644
--- a/backend/app/services/chat_service.py
+++ b/backend/app/services/chat_service.py
@@ -931,73 +931,86 @@ async def _settle_verified_quote_predebit_after_failure(
     ledger state: reconcile_credits() now ALWAYS stamps reconciled_at
     (including the equal-cost no-op path) under a row lock, and
     _refund_predebit's DELETE is now conditional on reconciled_at IS NULL —
     a single atomic statement that both checks and acts, with no race
     window regardless of whether the atomic commit has landed, is still
     landing, or never will. There is nothing left for THIS function to
     "decide" — it just calls _refund_predebit with the right session and
     surfaces whether a refund actually happened, so the caller can log/
     respond accordingly.
 
     use_independent_session=True (CancelledError): the request's own `db`
     session may not be usable mid-cancellation — settle via a fresh
     AsyncSessionLocal(), matching every other cancel-path settler in this
     file.
     use_independent_session=False (ordinary exception): reuses the
     request's own `db` (rolled back first, inside _refund_predebit) —
     matches the existing pattern for non-cancellation failures elsewhere.
     """
     if use_independent_session:
         async with AsyncSessionLocal() as settle_db:
             return await _refund_predebit(settle_db, user_id, pre_debited, predebit_ledger_id)
     assert db is not None
     return await _refund_predebit(db, user_id, pre_debited, predebit_ledger_id)
 
 
-async def _sync_session_domain_mode(
-    db: AsyncSession, session_obj: ChatSession, domain_mode: Optional[str],
-) -> None:
-    """P1 hygiene follow-up (Codex M3 P1 review, 2026-08-03): the persisted
+def _sync_session_domain_mode(session_obj: ChatSession, domain_mode: Optional[str]) -> None:
+    """P1 hygiene (Codex M3 P1 review r1+r2, 2026-08-03): the persisted
     ChatSession.domain_mode must reflect the CURRENT request's domain_mode
     (null when omitted) on EVERY successful terminal path of chat_stream,
     not just the main RAG path this logic originally lived in inline.
-    Codex found two successful early-return paths that skipped it — tool
-    actions and strict Quote Finder routing — both returning before the
-    main RAG path's system-prompt-building section ever ran. A session
-    that once had domain_mode="legal" persisted could keep that stale
-    value after a later omitted-mode message that happened to route to
-    one of those branches, making the documented "omitted clears it"
-    invariant false for those paths.
-
-    Downstream-harmless today (chat_stream always uses the per-request
-    `domain_mode` argument directly, never re-reads session_obj.domain_mode
-    to decide behavior; continuation doesn't reload it either) — this is
-    metadata correctness / honoring the invariant, not a security fix.
+
+    r1: Codex found two successful early-return paths that skipped this
+    entirely — tool actions and strict Quote Finder routing — both
+    returning before the main RAG path's system-prompt-building section
+    ever ran. A session that once had domain_mode="legal" persisted could
+    keep that stale value after a later omitted-mode message that
+    happened to route to one of those branches.
+
+    r2: the first fix (commit 2d4e01a) gave this function its OWN
+    `await db.commit()`, called separately in each branch — Codex found
+    THAT was itself a new hazard: a standalone commit outside each
+    branch's existing transaction boundary creates a new, independent
+    failure window. Worse, in the tool-action branch the extra commit ran
+    BEFORE the tool executed, so a subsequent tool failure left the
+    domain_mode change committed anyway — silently defeating the "sync
+    only rides successful paths" intent. In the strict Quote Finder
+    branch, the extra commit ran AFTER the real answer+billing+usage
+    atomic commit — if IT failed, the client got QUOTE_SEARCH_ERROR while
+    the real answer stayed persisted and charged with no way back.
+
+    Fixed by making this function a PURE, IN-MEMORY ASSIGNMENT with NO I/O
+    of its own — zero new commit points. Every call site sets the
+    attribute (dirtying the already-session-tracked ORM object) BEFORE
+    that branch's own existing terminal commit, so SQLAlchemy's next
+    flush picks it up as part of THAT single transaction: it lands
+    together with the real work on success, and a rollback on failure
+    discards it right along with everything else — never separately
+    committed, never separately lost.
     """
     if domain_mode != session_obj.domain_mode:
         session_obj.domain_mode = domain_mode
-        await db.commit()
 
 
 async def _fetch_page_chunks(
     db: AsyncSession,
     document_id: uuid.UUID,
     page_ref: int,
     *,
     limit: int = 12,
 ) -> List[Dict[str, Any]]:
     """Direct positional retrieval (B4): chunks overlapping a specific page.
 
     Semantic top-k cannot resolve "what is on page N" — the paying user asked for
     page 350 of a 492-page PDF and got "the excerpts do not contain page 350".
     Here we fetch the chunks whose page range covers the requested page.
     """
     rows = await db.execute(
         select(Chunk)
         .where(Chunk.document_id == document_id)
         .where(Chunk.page_start <= page_ref)
         .where(Chunk.page_end >= page_ref)
         .order_by(Chunk.chunk_index)
         .limit(limit)
     )
     chunks = list(rows.scalars())
     return [chunk_to_retrieval_item(ch, 1.0, include_document_id=True) for ch in chunks]
@@ -1293,118 +1306,129 @@ class ChatService:
         self,
         *,
         db: AsyncSession,
         session_id: uuid.UUID,
         user_message: str,
     ) -> None:
         user_msg = Message(session_id=session_id, role="user", content=user_message)
         db.add(user_msg)
         await db.commit()
 
         session = await db.get(ChatSession, session_id)
         if session and not session.title:
             clean = user_message.replace("\n", " ").replace("\r", "").strip()
             session.title = clean[:50]
             await db.commit()
 
     async def _tool_action_stream(
         self,
         *,
         session_id: uuid.UUID,
         user_message: str,
         db: AsyncSession,
         user: Optional[User],
         locale: Optional[str],
         domain_mode: Optional[str],
+        session_obj: ChatSession,
         document_id: uuid.UUID | None,
         collection_doc_ids: list[uuid.UUID],
         action_plan: Any,
     ) -> AsyncGenerator[Dict[str, Any], None]:
         try:
             await self._persist_user_message_and_title(
                 db=db,
                 session_id=session_id,
                 user_message=user_message,
             )
             if action_plan.user_visible_status:
                 yield sse("tool_status", {"message": action_plan.user_visible_status})
             execution = await chat_tool_executor.execute(
                 action_plan,
                 user=user,
                 db=db,
                 document_id=document_id,
                 collection_doc_ids=collection_doc_ids,
                 locale=locale,
                 domain_mode=domain_mode,
             )
             assistant_text = execution.message
             artifact_payload = execution.artifact.to_payload() if execution.artifact else None
             if artifact_payload:
                 yield sse("artifact", artifact_payload)
             if assistant_text:
                 yield sse("token", {"text": assistant_text})
 
             asst_msg = Message(
                 session_id=session_id,
                 role="assistant",
                 content=assistant_text,
                 citations=(artifact_payload or {}).get("citations") if artifact_payload else None,
                 metadata_json={
                     "action_plan": {
                         "action": action_plan.action.value,
                         "confidence": action_plan.confidence,
                         "reason": action_plan.reason,
                     },
                     "artifacts": [artifact_payload] if artifact_payload else [],
                 },
             )
             db.add(asst_msg)
+            # P1 hygiene r2 (Codex, 2026-08-03): a PURE assignment, set
+            # INSIDE this try block right before the branch's own terminal
+            # commit — never a standalone commit. If the tool execution
+            # above already raised, this line never runs and nothing is
+            # dirtied; if THIS commit fails, the except block below rolls
+            # everything back together, domain_mode included — never a
+            # half-committed sync. See _sync_session_domain_mode's docstring.
+            _sync_session_domain_mode(session_obj, domain_mode)
             await db.commit()
             yield sse(
                 "done",
                 {
                     "message_id": str(asst_msg.id),
                     "citations_count": 0,
                     "verification": None,
                     "can_continue": False,
                     "continuation_count": asst_msg.continuation_count,
                     "artifact_count": 1 if artifact_payload else 0,
                 },
             )
         except Exception as exc:
             await db.rollback()
             yield _safe_sse("error", "CHAT_SETUP_ERROR", exc, session_id=str(session_id))
 
     async def _run_verified_quote_search(
         self,
         *,
         session_id: uuid.UUID,
         db: AsyncSession,
         document: Document,
         user: User,
         topic: str,
         locale: Optional[str],
+        domain_mode: Optional[str],
+        session_obj: ChatSession,
         pre_debited: int,
         predebit_ledger_id: uuid.UUID,
         progress: "_VerifiedQuoteProgress",
     ) -> "_VerifiedQuoteOutcome":
         """Strict verbatim-quote chat routing (B5, plan §8.4.3).
 
         Runs B3's verified quote_search in place of the normal LLM answer,
         persists the assistant message, and reconciles + records usage — ALL
         of it awaited here, nothing yielded. `progress` is mutated as this
         proceeds (model/tokens as soon as quote_search() returns,
         `message_id` only once the message commit succeeds) so the CALLER's
         cancellation handler can settle correctly no matter where a
         CancelledError lands — see _VerifiedQuoteProgress's docstring.
 
         Billing is the CALLER's chat predebit (pre_debited/predebit_ledger_id
         come from the SAME debit_credits() call every RAG-path message
         already goes through) — there is no separate quote-search debit, so
         this can never double-bill. An exception raised before ANY commit
         here propagates to chat_stream's existing setup exception handler
         unchanged, which fully refunds — correct, since nothing was
         delivered.
         """
         result = await quote_search_service.quote_search(
             db, document=document, user=user, topic=topic, locale=locale or "",
         )
@@ -1484,50 +1508,58 @@ class ChatService:
         # + usage-record are now ONE ATOMIC commit — no intermediate commit
         # between the message add and the billing settlement. This removes
         # the "message persisted but billing never reconciled" class of
         # ordinary-exception free-ride entirely: either the whole
         # transaction lands together, or none of it does. FIX3-A (Codex r3
         # #4): reconcile_credits() below durably stamps
         # credit_ledger.reconciled_at under a row lock — the caller's
         # exception handlers resolve any failure here (CancelledError or
         # ordinary) via that marker + an atomic conditional refund, never
         # an in-memory flag or existence check.
         actual_cost = credit_service.calculate_cost(
             progress.prompt_tokens, progress.completion_tokens, progress.model, mode="balanced",
         )
         await credit_service.reconcile_credits(
             db, user.id, predebit_ledger_id, pre_debited, actual_cost,
         )
         await credit_service.record_usage(
             db,
             user_id=user.id,
             message_id=message_id,
             model=progress.model,
             prompt_tokens=progress.prompt_tokens,
             completion_tokens=progress.completion_tokens,
             cost_credits=actual_cost,
         )
+        # P1 hygiene r2 (Codex, 2026-08-03): a PURE assignment, folded
+        # INTO this same atomic commit — never a standalone one. The old
+        # (r1) fix committed this separately AFTER this block, so a
+        # failure in that extra commit meant the client got
+        # QUOTE_SEARCH_ERROR while the real answer stayed persisted and
+        # charged with no way back. See _sync_session_domain_mode's
+        # docstring.
+        _sync_session_domain_mode(session_obj, domain_mode)
         await db.commit()
         # Only trustworthy once the atomic commit's await has ACTUALLY
         # returned — the ordinary-exception handler (FIX-4) uses this to
         # know whether a real answer was delivered.
         progress.message_id = message_id
 
         return _VerifiedQuoteOutcome(
             message_id=message_id,
             assistant_text=assistant_text,
             citations=citations,
             artifact_payload=artifact_payload,
         )
 
     async def chat_stream(
         self,
         session_id: uuid.UUID,
         user_message: str,
         db: AsyncSession,
         user: Optional[User] = None,
         locale: Optional[str] = None,
         mode: Optional[str] = None,
         domain_mode: Optional[str] = None,
     ) -> AsyncGenerator[Dict[str, Any], None]:
         """Main chat streaming generator producing SSE event dicts.
 
@@ -1587,62 +1619,63 @@ class ChatService:
         # Force demo model for anonymous users on demo documents
         if user is None and doc and doc.demo_slug:
             effective_model = settings.DEMO_LLM_MODEL
             effective_mode = "quick"
 
         # Premium mode gating: require Plus or Pro plan
         if effective_mode in settings.PREMIUM_MODES:
             user_plan = (user.plan or "free").lower() if user else "free"
             if user_plan == "free":
                 yield sse(
                     "error",
                     {
                         "code": "MODE_NOT_ALLOWED",
                         "message": "Upgrade to Plus to use this mode",
                         "required_plan": "plus",
                     },
                 )
                 return
 
         action_plan = await action_planner.plan(
             user_message,
             is_collection=is_collection_session,
             locale=locale,
         )
         if not action_plan.uses_rag_answer_path:
-            # P1 hygiene follow-up (Codex, 2026-08-03): this successful
-            # early-return path skipped the domain_mode session sync that
-            # only ran inline in the main RAG path below — see
-            # _sync_session_domain_mode's docstring.
-            await _sync_session_domain_mode(db, session_obj, domain_mode)
+            # P1 hygiene r1+r2 (Codex, 2026-08-03): this successful
+            # early-return path needs the domain_mode session sync too —
+            # the ASSIGNMENT now happens INSIDE _tool_action_stream, right
+            # before its own terminal commit (see _sync_session_domain_mode's
+            # docstring for why it's not done here as a standalone commit).
             async for ev in self._tool_action_stream(
                 session_id=session_id,
                 user_message=user_message,
                 db=db,
                 user=user,
                 locale=locale,
                 domain_mode=domain_mode,
+                session_obj=session_obj,
                 document_id=document_id,
                 collection_doc_ids=collection_doc_ids,
                 action_plan=action_plan,
             ):
                 yield ev
             return
 
         query_route = query_router.route(
             user_message,
             is_collection=is_collection_session,
             domain_mode=domain_mode,
         )
 
         # Pre-debit estimated credits BEFORE streaming (prevents TOCTOU + free rides)
         pre_debited = 0
         predebit_ledger_id = None
         strict_quote_routed = _is_strict_quote_routed(
             action_plan, user=user, document_id=document_id,
             is_collection_session=is_collection_session, doc=doc,
         )
         if user is not None:
             # FIX-3 (Codex r1 BLOCKER #3): a strict-routed message ALWAYS
             # runs the balanced-model quote engine regardless of the
             # user-selected chat mode — predebit must reflect that real
             # cost, not `effective_mode`'s (e.g. quick=5), or a low-balance
@@ -1685,50 +1718,52 @@ class ChatService:
                 user_message=user_message,
             )
 
             # Strict verbatim-quote chat routing (B5, plan §8.4.3). Gated
             # here (not in the planner, which has no auth/doc context):
             # AUTHED, non-demo, single-document sessions only. Anonymous,
             # demo, and collection sessions fall through to the normal RAG
             # path below UNCHANGED — the strict intent still matched, but
             # without a real document + billing user the verified pipeline
             # can't run, so this degrades to an ordinary cited answer rather
             # than erroring. SAME predicate (`strict_quote_routed`, computed
             # above) already decided the predebit amount — never re-derive
             # this condition separately (FIX-3: that's exactly how a
             # quick-mode predebit could drift from what actually runs).
             if strict_quote_routed:
                 setup_error_code = "QUOTE_SEARCH_ERROR"
                 quote_progress = _VerifiedQuoteProgress()
                 try:
                     outcome = await self._run_verified_quote_search(
                         session_id=session_id,
                         db=db,
                         document=doc,
                         user=user,
                         topic=user_message,
                         locale=locale,
+                        domain_mode=domain_mode,
+                        session_obj=session_obj,
                         pre_debited=pre_debited,
                         predebit_ledger_id=predebit_ledger_id,
                         progress=quote_progress,
                     )
                 except asyncio.CancelledError:
                     # FIX3-A(d) (Codex r3 #4, NOT ADDRESSED): `settled` is
                     # marked BEFORE the resolver even runs — regardless of
                     # whether it succeeds — so the outer generic handler
                     # (which now also checks `not settled`, see below) can
                     # NEVER also attempt its own blind settlement. That was
                     # the exact "special resolver errors out, outer handler
                     # falls back to blind settlement" gap Codex r3 found.
                     # The resolver itself is the durable, race-free
                     # reconciled_at + conditional-delete design (FIX3-A(b)/
                     # (c)) — correct regardless of whether the atomic commit
                     # already landed, is still landing, or never will.
                     if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
                         settled = True
                         try:
                             with anyio.CancelScope(shield=True):
                                 refunded = await asyncio.wait_for(
                                     _settle_verified_quote_predebit_after_failure(
                                         user_id=user.id,
                                         pre_debited=pre_debited,
                                         predebit_ledger_id=predebit_ledger_id,
@@ -1784,55 +1819,54 @@ class ChatService:
                             yield _safe_sse("error", "QUOTE_SEARCH_ERROR", exc, session_id=str(session_id))
                             return
                         if not refunded:
                             # The atomic commit had already reconciled — a
                             # real, delivered, persisted answer — this
                             # exception struck AFTER that. Predebit stands
                             # as the charge; never a full refund for a
                             # delivered answer.
                             logger.exception(
                                 "Quote-search billing failed after the atomic commit had already "
                                 "reconciled (ledger %s) for user %s — predebit stands, no refund.",
                                 predebit_ledger_id, user.id,
                             )
                             yield _safe_sse(
                                 "error", "QUOTE_SEARCH_BILLING_INCOMPLETE", exc, session_id=str(session_id),
                             )
                             return
                         # Refunded — nothing was delivered.
                         yield _safe_sse("error", "QUOTE_SEARCH_ERROR", exc, session_id=str(session_id))
                         return
                     raise
                 # Reconcile already committed inside _run_verified_quote_search —
                 # mark settled BEFORE yielding so a cancellation during these
                 # yields can't ALSO trigger the setup handler's full refund
                 # (double-refund guard, same pattern as the main RAG path).
+                # domain_mode was already synced INSIDE that same atomic
+                # commit (P1 hygiene r2, Codex 2026-08-03) — nothing left
+                # to do here.
                 settled = True
-                # P1 hygiene follow-up (Codex, 2026-08-03): this successful
-                # early-return path also skipped the domain_mode session
-                # sync — see _sync_session_domain_mode's docstring.
-                await _sync_session_domain_mode(db, session_obj, domain_mode)
                 if outcome.artifact_payload:
                     yield sse("artifact", outcome.artifact_payload)
                 yield sse("token", {"text": outcome.assistant_text})
                 yield sse(
                     "done",
                     {
                         "message_id": str(outcome.message_id),
                         "citations_count": len(outcome.citations),
                         "verification": None,
                         "can_continue": False,
                         "continuation_count": 0,
                         "artifact_count": 1 if outcome.artifact_payload else 0,
                     },
                 )
                 return
 
             # 3) Load history (last N*2 messages before current user msg)
             max_turns = int(settings.MAX_CHAT_HISTORY_TURNS or 6)
             max_msgs = max_turns * 2
             msgs_row = await db.execute(
                 select(Message)
                 .where(Message.session_id == session_id)
                 .order_by(Message.created_at.desc())
                 .limit(max_msgs + 1)
             )
@@ -2066,54 +2100,60 @@ class ChatService:
                 system_prompt += (
                     "\n## Custom Instructions\n"
                     "Follow these custom instructions only when they do not conflict with the role, "
                     "data-boundary, source-location, citation, language, or safety rules above:\n"
                     + doc.custom_instructions + "\n"
                 )
 
             # Inject domain-specific rules (legal/academic mode overlay)
             # Frontend always sends domain_mode: null (default) or "legal"/"academic"
             # domain_mode=None means Default (no extra rules), string means apply rules
             if domain_mode:
                 from app.core.model_profiles import DOMAIN_RULES
                 domain_rules = DOMAIN_RULES.get(domain_mode)
                 if domain_rules:
                     base_rule_count = len(rules.strip().split('\n'))
                     domain_rules_text = f"\n\n## {domain_mode.title()} Mode Rules\n"
                     for i, rule in enumerate(domain_rules, start=base_rule_count + 1):
                         domain_rules_text += f"{i}. {rule}\n"
                     system_prompt += domain_rules_text
 
             # Global contracts appended to EVERY branch: source-location grounding (#1)
             # + user-facing terminology guard (#4). (Consensus R2a.)
             system_prompt += _source_location_contract() + _output_terminology_contract()
 
             # Persist domain_mode to session (null clears, string sets) —
-            # see _sync_session_domain_mode's docstring; this is the main
-            # RAG path's call site, mirrored at the tool-action and strict
-            # Quote Finder early returns above (P1 hygiene, Codex 2026-08-03).
-            await _sync_session_domain_mode(db, session_obj, domain_mode)
+            # a PURE assignment, no commit of its own (see
+            # _sync_session_domain_mode's docstring, r2). session_obj is
+            # already tracked by this `db` session (loaded at the top of
+            # chat_stream), so this dirties it in place and rides along
+            # with WHATEVER this path's next commit turns out to be (the
+            # assistant-message draft save below) — never a standalone
+            # commit, so a failure before that point discards it via
+            # rollback just like everything else, and a failure after it
+            # commits it together with the real answer, never separately.
+            _sync_session_domain_mode(session_obj, domain_mode)
 
         except asyncio.CancelledError:
             if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
                 try:
                     with anyio.CancelScope(shield=True):
                         await asyncio.wait_for(
                             _settle_predebit_on_cancel(
                                 user_id=user.id,
                                 pre_debited=pre_debited,
                                 predebit_ledger_id=predebit_ledger_id,
                                 has_answer=False,
                                 prompt_tokens=None,
                                 output_tokens=None,
                                 model=effective_model,
                                 mode=effective_mode,
                             ),
                             timeout=_CANCEL_IO_TIMEOUT_S,
                         )
                     settled = True
                 except Exception:
                     logger.exception(
                         "Failed to settle pre-debit during chat setup cancellation for user %s",
                         user.id,
                     )
             raise

exec
/bin/zsh -lc "nl -ba backend/app/core/deps.py | sed -n '1,80p'
rg -n \"_sync_session_domain_mode\\(\" backend --glob '*.py'
rg -n \"_tool_action_stream\\(|_run_verified_quote_search\\(\" backend --glob '*.py'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	import logging
     2	from typing import AsyncGenerator, Optional
     3	from uuid import UUID
     4	
     5	from fastapi import Depends, HTTPException, Request
     6	from jose import JWTError, jwt
     7	from jose.jwt import ExpiredSignatureError, JWTClaimsError
     8	from sqlalchemy.ext.asyncio import AsyncSession
     9	
    10	from app.core.config import settings
    11	from app.core.security_log import log_security_event
    12	from app.models.database import AsyncSessionLocal
    13	from app.models.tables import User
    14	
    15	logger = logging.getLogger(__name__)
    16	
    17	
    18	async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    19	    """Provide an async SQLAlchemy session for FastAPI dependencies."""
    20	    async with AsyncSessionLocal() as session:  # type: AsyncSession
    21	        yield session
    22	
    23	
    24	async def get_current_user_optional(
    25	    request: Request,
    26	    db: AsyncSession = Depends(get_db_session),
    27	) -> Optional[User]:
    28	    """Extract user from JWT if present. Returns None for guests."""
    29	    auth_header = request.headers.get("Authorization")
    30	    if not auth_header or not auth_header.startswith("Bearer "):
    31	        return None
    32	
    33	    token = auth_header.split(" ")[1]
    34	    try:
    35	        # Validate AUTH_SECRET is configured
    36	        if not settings.AUTH_SECRET:
    37	            logger.error("AUTH_SECRET not configured")
    38	            return None
    39	
    40	        payload = jwt.decode(
    41	            token,
    42	            settings.AUTH_SECRET,
    43	            algorithms=["HS256"],
    44	            options={
    45	                "verify_aud": False,
    46	                "verify_exp": True,  # Explicitly verify expiration
    47	                "require_exp": True,  # Require exp claim
    48	                "require_iat": True,  # Require issued-at claim
    49	                "require_sub": True,  # Require subject claim
    50	            },
    51	        )
    52	        user_id = payload.get("sub")
    53	        if not user_id:
    54	            return None
    55	        return await db.get(User, UUID(user_id))
    56	    except ExpiredSignatureError:
    57	        log_security_event("auth_failure", reason="token_expired")
    58	        return None
    59	    except JWTClaimsError as e:
    60	        log_security_event("auth_failure", reason="claims_error", detail=str(e))
    61	        return None
    62	    except JWTError as e:
    63	        log_security_event("auth_failure", reason="decode_error", detail=str(e))
    64	        return None
    65	
    66	
    67	async def require_auth(
    68	    user: Optional[User] = Depends(get_current_user_optional),
    69	) -> User:
    70	    """Require authenticated user, raise 401 if not."""
    71	    if not user:
    72	        raise HTTPException(status_code=401, detail="Authentication required")
    73	    return user
    74	
    75	
    76	async def require_admin(
    77	    user: User = Depends(require_auth),
    78	) -> User:
    79	    """Require admin user (email in ADMIN_EMAILS env var)."""
    80	    admin_emails = [e.strip() for e in settings.ADMIN_EMAILS.split(",") if e.strip()]
backend/app/services/chat_service.py:956:def _sync_session_domain_mode(session_obj: ChatSession, domain_mode: Optional[str]) -> None:
backend/app/services/chat_service.py:1382:            _sync_session_domain_mode(session_obj, domain_mode)
backend/app/services/chat_service.py:1540:        _sync_session_domain_mode(session_obj, domain_mode)
backend/app/services/chat_service.py:2134:            _sync_session_domain_mode(session_obj, domain_mode)
backend/app/services/chat_service.py:1322:    async def _tool_action_stream(
backend/app/services/chat_service.py:1399:    async def _run_verified_quote_search(
backend/app/services/chat_service.py:1649:            async for ev in self._tool_action_stream(
backend/app/services/chat_service.py:1736:                    outcome = await self._run_verified_quote_search(

codex
So far the rollback semantics are sound: `AsyncSession.rollback()` expires persistent state and clears pending history, and the refund path rolls back before its own commit. I’m checking one remaining edge explicitly: main-RAG failures/cancellation can end before the assistant-draft commit, which means the metadata intentionally remains uncommitted; I’m separating that from successful `done` outcomes and checking whether the request session is ever reused afterward.
exec
/bin/zsh -lc "rg -n \"domain_mode.*(tool|quote)|tool.*domain_mode|quote.*domain_mode|stale\" backend/tests/test_quote_intent_routing.py backend/tests -g '*.py'
rg -n \"class TestDomainMode|def test_.*domain_mode\" backend/tests/test_quote_intent_routing.py
nl -ba backend/tests/test_quote_intent_routing.py | sed -n '1,260p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
backend/tests/test_quote_intent_routing.py:757:    stale value after a later omitted-mode message that happened to route
backend/tests/test_quote_intent_routing.py:759:    = "legal" (simulating that stale prior state), send a message with NO
backend/tests/test_quote_intent_routing.py:763:    async def test_strict_quote_finder_route_clears_stale_domain_mode(
backend/tests/test_quote_intent_routing.py:772:        session_obj.domain_mode = "legal"  # stale prior value
backend/tests/test_quote_intent_routing.py:806:        assert session_obj.domain_mode is None  # the stale "legal" value was cleared
backend/tests/test_quote_intent_routing.py:809:    async def test_tool_action_route_clears_stale_domain_mode(
backend/tests/test_quote_intent_routing.py:816:        session_obj.domain_mode = "legal"  # stale prior value
backend/tests/test_quote_intent_routing.py:849:        assert session_obj.domain_mode is None  # the stale "legal" value was cleared
backend/tests/test_document_brief_generation.py:205:def test_generate_document_brief_discards_stale_chunks_after_reparse(monkeypatch) -> None:
backend/tests/test_cleanup_tasks.py:69:def test_cleanup_empty_demo_sessions_deletes_only_stale_empty_anonymous_demo_sessions() -> None:
backend/tests/test_cleanup_tasks.py:81:        stale_empty = _make_session(db, document_id=demo_doc.id, user_id=None, created_at=old)
backend/tests/test_cleanup_tasks.py:84:        stale_with_message = _make_session(db, document_id=demo_doc.id, user_id=None, created_at=old)
backend/tests/test_cleanup_tasks.py:85:        db.add(Message(session_id=stale_with_message.id, role="user", content="hi"))
backend/tests/test_cleanup_tasks.py:93:        authed_stale_empty = _make_session(db, document_id=demo_doc.id, user_id=user.id, created_at=old)
backend/tests/test_cleanup_tasks.py:96:        authed_stale_with_message = _make_session(
backend/tests/test_cleanup_tasks.py:99:        db.add(Message(session_id=authed_stale_with_message.id, role="user", content="hi"))
backend/tests/test_cleanup_tasks.py:104:            "stale_empty": stale_empty.id,
backend/tests/test_cleanup_tasks.py:105:            "stale_with_message": stale_with_message.id,
backend/tests/test_cleanup_tasks.py:107:            "authed_stale_empty": authed_stale_empty.id,
backend/tests/test_cleanup_tasks.py:108:            "authed_stale_with_message": authed_stale_with_message.id,
backend/tests/test_cleanup_tasks.py:124:        assert session_ids["stale_empty"] not in remaining_ids
backend/tests/test_cleanup_tasks.py:125:        assert session_ids["stale_with_message"] in remaining_ids
backend/tests/test_cleanup_tasks.py:127:        assert session_ids["authed_stale_empty"] not in remaining_ids
backend/tests/test_cleanup_tasks.py:128:        assert session_ids["authed_stale_with_message"] in remaining_ids
backend/tests/test_quote_intent_routing.py:757:    stale value after a later omitted-mode message that happened to route
backend/tests/test_quote_intent_routing.py:759:    = "legal" (simulating that stale prior state), send a message with NO
backend/tests/test_quote_intent_routing.py:763:    async def test_strict_quote_finder_route_clears_stale_domain_mode(
backend/tests/test_quote_intent_routing.py:772:        session_obj.domain_mode = "legal"  # stale prior value
backend/tests/test_quote_intent_routing.py:806:        assert session_obj.domain_mode is None  # the stale "legal" value was cleared
backend/tests/test_quote_intent_routing.py:809:    async def test_tool_action_route_clears_stale_domain_mode(
backend/tests/test_quote_intent_routing.py:816:        session_obj.domain_mode = "legal"  # stale prior value
backend/tests/test_quote_intent_routing.py:849:        assert session_obj.domain_mode is None  # the stale "legal" value was cleared
backend/tests/test_billing_logic.py:53:async def test_recover_pending_subscription_clears_stale_pending_without_active_sub(
backend/tests/test_billing_logic.py:110:async def test_subscription_deleted_ignores_stale_deleted_subscription() -> None:
backend/tests/test_proxy_ip_verification.py:8:claims are NO LONGER trusted: stale / partial / legacy-only requests fall
backend/tests/test_proxy_ip_verification.py:182:# 10 — stale new contract (signature valid but timestamp outside the ±60s
backend/tests/test_proxy_ip_verification.py:183:# window): reject the stale claim, log a warning, and fall through to the
backend/tests/test_proxy_ip_verification.py:185:def test_stale_new_contract_falls_through_to_host(
backend/tests/test_proxy_ip_verification.py:188:    stale_ts = int(time.time()) - 120  # 2 min in the past — outside 60s window
backend/tests/test_proxy_ip_verification.py:192:            "X-Proxy-IP-Ts": str(stale_ts),
backend/tests/test_proxy_ip_verification.py:193:            "X-Proxy-IP-Sig": _sign("198.51.100.88", stale_ts),
backend/tests/test_proxy_ip_verification.py:203:    assert result == "10.0.0.1"  # connection host, not the stale or legacy claim
backend/tests/test_document_brief_service.py:180:async def test_summary_context_falls_back_when_persisted_coverage_is_stale() -> None:
backend/tests/test_quote_billing_failure_windows_integration.py:236:    async def test_tool_action_commit_failure_leaves_domain_mode_uncommitted(
backend/tests/test_quote_billing_failure_windows_integration.py:244:        failing THAT commit and proving nothing landed, stale value
backend/tests/test_quote_billing_failure_windows_integration.py:295:                    domain_mode=None,  # omitted — should clear the stale "legal" value
backend/tests/test_quote_billing_failure_windows_integration.py:303:        # the domain_mode assignment never landed (still the stale
backend/tests/test_quote_billing_failure_windows_integration.py:314:    async def test_quote_finder_commit_failure_leaves_domain_mode_uncommitted_and_fully_refunds(
backend/tests/test_quote_billing_failure_windows_integration.py:395:                    domain_mode=None,  # omitted — should clear the stale "legal" value
backend/tests/test_document_briefs_api.py:140:async def test_get_document_brief_drops_items_with_stale_source_refs(
backend/tests/test_document_briefs_api.py:146:    stale_chunk_id = uuid.uuid4()
backend/tests/test_document_briefs_api.py:161:        outline=[{"title": "Stale", "level": 1, "summary": "Old", "source_refs": [{"chunk_id": str(stale_chunk_id)}]}],
backend/tests/test_document_briefs_api.py:162:        key_points=[{"text": "Unsupported point.", "source_refs": [{"chunk_id": str(stale_chunk_id)}]}],
backend/tests/test_document_briefs_api.py:163:        facts=[{"label": "Old", "value": "N/A", "context": "", "source_refs": [{"chunk_id": str(stale_chunk_id)}]}],
750:class TestDomainModeSyncOnEarlyReturnPaths:
763:    async def test_strict_quote_finder_route_clears_stale_domain_mode(
809:    async def test_tool_action_route_clears_stale_domain_mode(
     1	"""Tests for strict verbatim-quote chat-intent routing (B5, plan §8.4.3).
     2	
     3	Two layers:
     4	1. `action_planner.deterministic_plan` — the STRICT matcher (SEPARATE from the
     5	   broad `_CITATION_RE`) must fire only on unambiguous direct-quote requests
     6	   ("direct quote", "verbatim", "quote ... with page", 逐字引用, cita textual,
     7	   ...) and NEVER on ordinary citation-quality questions ("where is this
     8	   discussed", "what page is this on", bare "quote"/"source").
     9	2. `chat_service.chat_stream` routing — when the strict intent fires in an
    10	   AUTHED, non-demo, single-document session, the chat pipeline runs B3's
    11	   verified quote_search instead of the normal LLM answer, bills through the
    12	   SAME chat predebit/reconcile (no double-billing), and emits cards as a
    13	   chat artifact + an honest empty-result message. Anonymous, demo, and
    14	   collection sessions fall through to the untouched normal chat path even
    15	   when the strict matcher fires.
    16	"""
    17	from __future__ import annotations
    18	
    19	import asyncio
    20	import sys
    21	import uuid
    22	from pathlib import Path
    23	from types import SimpleNamespace
    24	from unittest.mock import AsyncMock
    25	
    26	import pytest
    27	
    28	BACKEND_DIR = Path(__file__).resolve().parents[1]
    29	if str(BACKEND_DIR) not in sys.path:
    30	    sys.path.insert(0, str(BACKEND_DIR))
    31	
    32	import app.services.chat_service as chat_service_module  # noqa: E402
    33	from app.models.tables import ChatSession, Document, Message  # noqa: E402
    34	from app.services.action_planner import ChatAction, deterministic_plan  # noqa: E402
    35	from app.services.query_router import QueryIntent  # noqa: E402
    36	from app.services.quote_search_service import QuoteCard, QuoteSearchResult  # noqa: E402
    37	
    38	# ---------------------------------------------------------------------------
    39	# Layer 1: strict matcher (pure, no DB/LLM)
    40	# ---------------------------------------------------------------------------
    41	
    42	class TestStrictQuoteMatcherPositives:
    43	    @pytest.mark.parametrize(
    44	        "message",
    45	        [
    46	            "Give me a direct quote about climate risk.",
    47	            "I need the exact quotation on liability.",
    48	            "Quote the clause verbatim.",
    49	            "Can you quote the definition of force majeure, with the page number?",
    50	            "What does it say word for word about termination?",
    51	            "逐字引用一下关于责任的条款",
    52	            "请给出原文引用，并注明页码",
    53	            "这段话一字不差地是怎么写的？",
    54	            "Necesito una cita textual sobre el riesgo climático.",
    55	            "Copia tal cual la cláusula de fuerza mayor.",
    56	            "¿Qué dice textualmente sobre la terminación?",
    57	        ],
    58	    )
    59	    def test_strict_patterns_route_to_verified_quote_search(self, message: str) -> None:
    60	        plan = deterministic_plan(message)
    61	        assert plan.action == ChatAction.VERIFIED_QUOTE_SEARCH
    62	        assert plan.confidence >= 0.78  # bypasses the LLM re-classification
    63	
    64	
    65	class TestStrictQuoteMatcherNegatives:
    66	    @pytest.mark.parametrize(
    67	        "message",
    68	        [
    69	            "Where is this discussed in the document?",
    70	            "What page is this on?",
    71	            "What's the source for this claim?",
    72	            "Can you cite where you got that?",
    73	            "在哪页提到了这个？",
    74	            "这个信息的出处是什么？",
    75	            "Quote me a price for this service.",  # bare "quote", not a verbatim-text request
    76	            "What is the citation format used here?",
    77	            # ES: review round 1 SHOULD-FIX-1 — the un-anchored alternation
    78	            # false-matched these ordinary interpretive questions before the
    79	            # \b word-boundary fix ("textualmente" inside "Contextualmente",
    80	            # "cita textual" inside "cita textualidad").
    81	            "Contextualmente, ¿qué significa esto?",
    82	            "Según cita textualidad del informe",
    83	            "cita esta fuente, por favor",
    84	            "¿Cuál es la fuente de esta cita?",
    85	        ],
    86	    )
    87	    def test_broad_citation_language_does_not_trigger_strict_routing(self, message: str) -> None:
    88	        plan = deterministic_plan(message)
    89	        assert plan.action != ChatAction.VERIFIED_QUOTE_SEARCH
    90	
    91	
    92	class TestStrictQuoteMatcherNegationAndMetalinguisticGuards:
    93	    """FIX-5 (Codex r1 IMPORTANT #5): the matcher detected vocabulary, not
    94	    affirmative intent — these five Codex r1 probes all incorrectly routed
    95	    to the billed Quote Finder before this fix. A negation ("don't", "should
    96	    not", "不要") or metalinguistic use ("translate the phrase X", "what does
    97	    X mean", "qué significa") near the trigger word must suppress routing."""
    98	
    99	    @pytest.mark.parametrize(
   100	        "message",
   101	        [
   102	            "Don't quote this verbatim—explain it.",
   103	            "The answer should not be a direct quote; summarize it.",
   104	            "Translate the phrase exact quotation into Spanish.",
   105	            "¿Qué significa la palabra textualmente?",
   106	            "不要原文引用，请总结。",
   107	        ],
   108	    )
   109	    def test_codex_r1_probes_do_not_route_to_quote_search(self, message: str) -> None:
   110	        plan = deterministic_plan(message)
   111	        assert plan.action != ChatAction.VERIFIED_QUOTE_SEARCH
   112	
   113	    @pytest.mark.parametrize(
   114	        "message",
   115	        [
   116	            "Give me a direct quote about the termination clause.",
   117	            "Quote the clause verbatim.",
   118	            "逐字引用一下关于责任的条款",
   119	            "Necesito una cita textual sobre el riesgo climático.",
   120	        ],
   121	    )
   122	    def test_affirmative_forms_still_route(self, message: str) -> None:
   123	        """The guards must not be so broad they suppress genuine requests —
   124	        none of these contain a negation or metalinguistic marker."""
   125	        plan = deterministic_plan(message)
   126	        assert plan.action == ChatAction.VERIFIED_QUOTE_SEARCH
   127	
   128	
   129	class TestQuoteFinderDeterministicSafeRoutingPolicy:
   130	    """FIX3-B (Codex r3 #5 + New Breakage #1, NOT ADDRESSED): FIX2-C's
   131	    distance heuristic (negation governs whichever of the trigger/paraphrase-
   132	    token is closer) still misrouted on coordinated predicates, clause
   133	    boundaries, and a negated metalinguistic action followed by an
   134	    affirmative quote request — and introduced NEW coordinated-negation
   135	    false positives of its own (r3's "New Breakage #1"). Replaced entirely
   136	    with a DETERMINISTIC-SAFE policy: route to the billed verified
   137	    quote-search pipeline ONLY when the strict trigger matches AND the
   138	    message contains ZERO negation/metalinguistic tokens ANYWHERE
   139	    (whole-message presence, never proximity, never "which target"). Any
   140	    negation/metalinguistic token present alongside a trigger match means
   141	    NO auto-route — the ordinary RAG/citation path runs instead, carrying
   142	    quote_finder_hint=True (+ the message as quote_finder_hint_topic) so
   143	    the frontend can offer a manual "Try Quote Finder" chip. Asymmetric
   144	    loss: a false positive costs money + a wrong/unverified answer; a
   145	    false negative costs one click on a chip — so even r2's genuinely
   146	    affirmative "without paraphrasing"-style probes now deliberately do
   147	    NOT auto-route; they get the chip, never silence, never a blind bill."""
   148	
   149	    @pytest.mark.parametrize(
   150	        "message",
   151	        [
   152	            "Give me a direct quote about the termination clause.",
   153	            "Quote the clause verbatim.",
   154	            "逐字引用一下关于责任的条款",
   155	            "Necesito una cita textual sobre el riesgo climático.",
   156	        ],
   157	    )
   158	    def test_affirmative_no_negation_routes_and_carries_no_hint(self, message: str) -> None:
   159	        plan = deterministic_plan(message)
   160	        assert plan.action == ChatAction.VERIFIED_QUOTE_SEARCH
   161	        assert plan.quote_finder_hint is False
   162	        assert plan.quote_finder_hint_topic is None
   163	
   164	    @pytest.mark.parametrize(
   165	        "message",
   166	        [
   167	            # r1's original 5 negatives.
   168	            "Don't quote this verbatim—explain it.",
   169	            "The answer should not be a direct quote; summarize it.",
   170	            "Translate the phrase exact quotation into Spanish.",
   171	            "¿Qué significa la palabra textualmente?",
   172	            "不要原文引用，请总结。",
   173	            # r2's 4 probes — genuinely affirmative requests that FIX2-C
   174	            # used to correctly route; FIX3-B deliberately no longer
   175	            # auto-routes them (asymmetric-loss trade-off).
   176	            "Give me a direct quote, without paraphrasing.",
   177	            "Never paraphrase; quote the clause verbatim.",
   178	            "不要总结，请逐字引用责任条款。",
   179	            "No la parafrasees; necesito una cita textual.",
   180	            # r3's 6 adversarial probes.
   181	            "Do not summarize or give me a direct quote; explain instead.",
   182	            "Do not paraphrase or quote the clause verbatim; just discuss it.",
   183	            "不要总结或逐字引用，只需解释。",
   184	            "No la resumas ni uses una cita textual; solo explícala.",
   185	            "Do not translate it; quote the clause verbatim.",
   186	            "Do not hedge; give me a direct quote without paraphrasing.",
   187	        ],
   188	    )
   189	    def test_anything_with_negation_never_routes_and_always_hints(self, message: str) -> None:
   190	        plan = deterministic_plan(message)
   191	        assert plan.action != ChatAction.VERIFIED_QUOTE_SEARCH
   192	        assert plan.quote_finder_hint is True
   193	        assert plan.quote_finder_hint_topic == message
   194	
   195	
   196	def test_verified_quote_search_uses_rag_answer_path() -> None:
   197	    """Must fall through the setup/predebit code path in chat_stream (shared
   198	    with ANSWER_WITH_RAG/CITATION_LOOKUP), not the tool-action early return —
   199	    that's how it reuses the chat message's own two-stage debit."""
   200	    plan = deterministic_plan("Give me a direct quote about climate risk.")
   201	    assert plan.uses_rag_answer_path is True
   202	
   203	
   204	class TestGuardedTriggerForcesRagPathNeverTool:
   205	    """Codex r4 residual (#5, their own prescription — the ONE item left
   206	    after #4 and the rest of #5 were fully ADDRESSED). FIX3-B computed
   207	    quote_finder_hint but attached it to WHATEVER _fallthrough_plan
   208	    resolved to — including a TOOL action. A tool action's SSE "done"
   209	    event has no quote_finder_hint/quote_finder_topic keys at all (see
   210	    chat_service.py's _tool_action_stream done payload), and several tool
   211	    actions execute without waiting on a user confirmation click. So
   212	    "Do not compare versions; quote the clause verbatim." silently ran
   213	    compare_documents with the hint — and thus the chip — never surfacing.
   214	    Fix: a guarded trigger (strict trigger + a suppressing token) now
   215	    FORCES the plain RAG/citation path, guaranteeing the hint always rides
   216	    the done event Codex's r3 prescription designated for it."""
   217	
   218	    @pytest.mark.parametrize(
   219	        "message",
   220	        [
   221	            "Do not compare versions; quote the clause verbatim.",
   222	            "Do not create a checklist; quote the clause verbatim.",
   223	            "Do not export the table; quote the clause verbatim.",
   224	        ],
   225	    )
   226	    def test_guarded_trigger_never_selects_a_tool_action(self, message: str) -> None:
   227	        plan = deterministic_plan(message)
   228	        assert plan.action in {ChatAction.ANSWER_WITH_RAG, ChatAction.CITATION_LOOKUP}
   229	        assert plan.uses_rag_answer_path is True
   230	        assert plan.quote_finder_hint is True
   231	        assert plan.quote_finder_hint_topic == message
   232	
   233	    @pytest.mark.parametrize(
   234	        "message, expected_action",
   235	        [
   236	            ("请提取所有表格并导出 CSV", ChatAction.EXPORT_TABLES),
   237	            ("找出所有公司目标价和评级，整理成表格", ChatAction.EXTRACT_DELIVERABLE),
   238	            ("Generate an executive summary", ChatAction.EXTRACT_DELIVERABLE),
   239	            ("Generate an academic evidence table with cited claims", ChatAction.EXTRACT_DELIVERABLE),
   240	        ],
   241	    )
   242	    def test_tool_action_routing_without_a_quote_trigger_is_untouched(
   243	        self, message: str, expected_action: "ChatAction",
   244	    ) -> None:
   245	        """Regression guard: forcing the RAG path must fire ONLY when
   246	        quote_finder_hint is True. None of these probes (mirrored from
   247	        test_action_planner.py) contain a strict quote trigger, so they
   248	        must keep reaching _fallthrough_plan's ordinary tool-selection
   249	        branches exactly as before this fix."""
   250	        plan = deterministic_plan(message)
   251	        assert plan.action == expected_action
   252	        assert plan.quote_finder_hint is False
   253	
   254	    def test_compare_tool_routing_without_a_quote_trigger_is_untouched(self) -> None:
   255	        plan = deterministic_plan("和上一版做对比", is_collection=True)
   256	        assert plan.action == ChatAction.COMPARE_DOCUMENTS
   257	        assert plan.requires_confirmation is True
   258	        assert plan.quote_finder_hint is False
   259	
   260	

exec
/bin/zsh -lc "nl -ba backend/tests/test_quote_intent_routing.py | sed -n '720,875p'
cd backend && TESTING=1 DATABASE_URL=postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/doctalk_test python3 -m pytest tests/test_quote_intent_routing.py::TestDomainModeSyncOnEarlyReturnPaths -q" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 1593ms:
..                                                                       [100%]
=============================== warnings summary ===============================
../../../../Library/Python/3.9/lib/python/site-packages/urllib3/__init__.py:35
  /Users/mayijie/Library/Python/3.9/lib/python/site-packages/urllib3/__init__.py:35: NotOpenSSLWarning: urllib3 v2 only supports OpenSSL 1.1.1+, currently the 'ssl' module is compiled with 'LibreSSL 2.8.3'. See: https://github.com/urllib3/urllib3/issues/3020
    warnings.warn(

<frozen importlib._bootstrap>:228
<frozen importlib._bootstrap>:228
  <frozen importlib._bootstrap>:228: DeprecationWarning: builtin type SwigPyPacked has no __module__ attribute

<frozen importlib._bootstrap>:228
<frozen importlib._bootstrap>:228
  <frozen importlib._bootstrap>:228: DeprecationWarning: builtin type SwigPyObject has no __module__ attribute

<frozen importlib._bootstrap>:228
  <frozen importlib._bootstrap>:228: DeprecationWarning: builtin type swigvarlink has no __module__ attribute

-- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
2 passed, 6 warnings in 0.92s
sys:1: DeprecationWarning: builtin type swigvarlink has no __module__ attribute

exec
/bin/zsh -lc "rg -n \"async def reconcile_credits|async def record_usage|await db\\.commit\\(|await db\\.flush\\(\" backend/app/services/credit_service.py
nl -ba backend/app/services/credit_service.py | sed -n '420,660p'
rg -n \"class TestDomainModeSyncNeverHalfCommits|pytestmark|integration\" backend/tests/test_quote_billing_failure_windows_integration.py | head -n 40
nl -ba backend/tests/test_quote_billing_failure_windows_integration.py | sed -n '1,80p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
102:    await db.flush()
140:    await db.flush()
144:async def record_usage(
167:async def reconcile_credits(
226:        await db.flush()
251:    await db.flush()
286:        await db.flush()
295:        await db.flush()
308:    await db.flush()
1:"""Real-Postgres integration tests for FIX-4 (Codex r1 IMPORTANT #4), FIX2-B
49:pytestmark = [pytest.mark.integration, pytest.mark.asyncio(loop_scope="session")]
67:            filename="integration-test.pdf",
69:            storage_key=f"documents/{uuid.uuid4()}/integration-test.pdf",
225:class TestDomainModeSyncNeverHalfCommits:
     1	"""Real-Postgres integration tests for FIX-4 (Codex r1 IMPORTANT #4), FIX2-B
     2	(Codex r2 #4, NOT ADDRESSED), and FIX3-A (Codex r3 #4, NOT ADDRESSED): both
     3	billing paths' post-debit failure AND ambiguous-cancellation/failure-
     4	during-commit windows.
     5	
     6	Mocked-db unit tests (test_quotes_api.py, test_quote_intent_routing.py)
     7	already cover the LOGIC; these tests prove the SAME behavior against a real
     8	database — real predebit rows, real reconcile failures, real refund
     9	queries, real CONCURRENT transactions racing for the same ledger row — per
    10	the reviewer's explicit request that mocks alone aren't sufficient evidence
    11	for billing-critical cancellation/failure paths.
    12	
    13	FIX3-A superseded FIX2-B(c)'s Message/UsageRecord-marker existence check
    14	(which could only resolve a SEQUENTIAL "did this land before I checked"
    15	question, not a genuinely concurrent race) with a durable ledger-row state
    16	(credit_ledger.reconciled_at, stamped under SELECT ... FOR UPDATE by every
    17	reconcile_credits() call) plus an atomic conditional refund (DELETE ...
    18	WHERE reconciled_at IS NULL). TestChat/RestDurableSettlement below prove
    19	three things against real Postgres: (1) sequential "landed"/"never landed"
    20	end-states resolve correctly (mirrors the old marker-check tests); (2) a
    21	resolver failure leaves the predebit exactly as it was, no partial state;
    22	(3) — the REQUIRED reproduction of Codex's exact deterministic-schedule
    23	finding ("a probe ended at balance 106 from a starting balance of 100,
    24	[predebit 15, actual_cost 9], with the marker present and its ledger
    25	deleted") — a REAL concurrent reconcile_credits() and _refund_predebit()
    26	racing for the same row via asyncio.gather across two independent
    27	connections, asserting the final balance is NEVER the wrong "reconciled
    28	AND refunded" value, regardless of which side wins the row lock.
    29	
    30	Requires docker (Postgres) — SKIP_INTEGRATION=1 (the default) skips this
    31	whole file.
    32	"""
    33	from __future__ import annotations
    34	
    35	import asyncio
    36	import sys
    37	import uuid
    38	from pathlib import Path
    39	from types import SimpleNamespace
    40	from unittest.mock import AsyncMock
    41	
    42	import pytest
    43	from sqlalchemy import select
    44	
    45	BACKEND_DIR = Path(__file__).resolve().parents[1]
    46	if str(BACKEND_DIR) not in sys.path:
    47	    sys.path.insert(0, str(BACKEND_DIR))
    48	
    49	pytestmark = [pytest.mark.integration, pytest.mark.asyncio(loop_scope="session")]
    50	
    51	
    52	async def _grant_credits(user_id: uuid.UUID, amount: int) -> None:
    53	    from app.models.database import AsyncSessionLocal
    54	    from app.services import credit_service
    55	
    56	    async with AsyncSessionLocal() as db:
    57	        await credit_service.credit_credits(db, user_id, amount, reason="test_grant")
    58	        await db.commit()
    59	
    60	
    61	async def _create_ready_document(user_id: uuid.UUID, *, demo_slug=None) -> uuid.UUID:
    62	    from app.models.database import AsyncSessionLocal
    63	    from app.models.tables import Document
    64	
    65	    async with AsyncSessionLocal() as db:
    66	        doc = Document(
    67	            filename="integration-test.pdf",
    68	            file_size=100,
    69	            storage_key=f"documents/{uuid.uuid4()}/integration-test.pdf",
    70	            status="ready",
    71	            user_id=user_id,
    72	            demo_slug=demo_slug,
    73	        )
    74	        db.add(doc)
    75	        await db.commit()
    76	        await db.refresh(doc)
    77	        return doc.id
    78	
    79	
    80	async def _ledger_rows_for_user(user_id: uuid.UUID):

exec
/bin/zsh -lc "nl -ba backend/app/services/credit_service.py | sed -n '120,270p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   120	        raise ValueError("Amount must be positive")
   121	
   122	    result = await db.execute(
   123	        sa.update(User)
   124	        .where(User.id == user_id)
   125	        .values(credits_balance=User.credits_balance + amount)
   126	        .returning(User.credits_balance)
   127	    )
   128	    new_balance = result.scalar_one()
   129	
   130	    ledger = CreditLedger(
   131	        user_id=user_id,
   132	        delta=amount,
   133	        balance_after=new_balance,
   134	        reason=reason,
   135	        ref_type=ref_type,
   136	        ref_id=ref_id,
   137	    )
   138	    db.add(ledger)
   139	    # Flush to ensure ledger is written in same transaction as balance update
   140	    await db.flush()
   141	    return new_balance
   142	
   143	
   144	async def record_usage(
   145	    db: AsyncSession,
   146	    user_id: UUID,
   147	    message_id: Optional[UUID],
   148	    model: str,
   149	    prompt_tokens: int,
   150	    completion_tokens: int,
   151	    cost_credits: int,
   152	) -> UsageRecord:
   153	    """Record detailed usage information."""
   154	    usage = UsageRecord(
   155	        user_id=user_id,
   156	        message_id=message_id,
   157	        model=model,
   158	        prompt_tokens=prompt_tokens,
   159	        completion_tokens=completion_tokens,
   160	        total_tokens=prompt_tokens + completion_tokens,
   161	        cost_credits=cost_credits,
   162	    )
   163	    db.add(usage)
   164	    return usage
   165	
   166	
   167	async def reconcile_credits(
   168	    db: AsyncSession,
   169	    user_id: UUID,
   170	    predebit_ledger_id: UUID,
   171	    pre_debited: int,
   172	    actual_cost: int,
   173	) -> int:
   174	    """Reconcile pre-debited credits against actual cost after streaming.
   175	
   176	    Updates the ORIGINAL ledger entry in-place so each chat produces exactly
   177	    one ledger row (reason="chat") instead of two (predebit + reconcile).
   178	
   179	    - If pre_debited == actual_cost → no-op (still returns the current balance)
   180	    - If diff != 0 → adjust user balance and update the original ledger entry
   181	
   182	    FIX2-B(b) (Codex r2 #4, NOT ADDRESSED): returns the resulting balance so
   183	    callers (quotes.py's REST endpoint in particular) never need a SEPARATE
   184	    get_user_credits() query after this returns. That extra round-trip was a
   185	    second failure point AFTER money had already correctly moved and the
   186	    work was committed — a probe showed it could 500 the client with zero
   187	    refund attempted (correctly, since nothing was actually wrong with the
   188	    charge) but also zero result delivered. Existing callers that don't use
   189	    the return value are unaffected (Python allows ignoring it).
   190	
   191	    FIX3-A(b) (Codex r3 #4, NOT ADDRESSED): ALWAYS touches the ledger row —
   192	    including the equal-cost/no-op path, which previously left it
   193	    completely untouched — locking it first via SELECT ... FOR UPDATE and
   194	    stamping reconciled_at=now() unconditionally. This is what SERIALIZES
   195	    reconciliation against a concurrent settlement resolver's conditional
   196	    refund (_refund_predebit's DELETE ... WHERE reconciled_at IS NULL,
   197	    FIX3-A(c)): whichever of the two transactions gets here first blocks
   198	    the other until it commits or rolls back, so there is no window where
   199	    a resolver can read "not yet reconciled" and a landed commit
   200	    simultaneously. A one-shot existence check (e.g. "does the Message row
   201	    exist yet") could never provide this guarantee — reconciled_at is a
   202	    durable, lockable column, not a read that can race a landing commit.
   203	    """
   204	    # Lock the ledger row FIRST, before deciding whether diff == 0 — this
   205	    # lock is what a concurrent _refund_predebit blocks on, regardless of
   206	    # which branch below actually runs.
   207	    locked = await db.execute(
   208	        sa.select(CreditLedger).where(CreditLedger.id == predebit_ledger_id).with_for_update()
   209	    )
   210	    ledger_row = locked.scalar_one_or_none()
   211	    if ledger_row is None:
   212	        raise RuntimeError(
   213	            f"Predebit ledger {predebit_ledger_id} not found during credit reconciliation"
   214	        )
   215	
   216	    diff = pre_debited - actual_cost
   217	    if diff == 0:
   218	        await db.execute(
   219	            sa.update(CreditLedger)
   220	            .where(CreditLedger.id == predebit_ledger_id)
   221	            .values(reconciled_at=sa.func.now())
   222	        )
   223	        user = await db.get(User, user_id)
   224	        if user is None:
   225	            raise RuntimeError(f"User {user_id} not found during credit reconciliation")
   226	        await db.flush()
   227	        return user.credits_balance
   228	
   229	    balance_result = await db.execute(
   230	        sa.update(User)
   231	        .where(User.id == user_id)
   232	        .values(credits_balance=User.credits_balance + diff)
   233	        .returning(User.credits_balance)
   234	    )
   235	    new_balance = balance_result.scalar_one_or_none()
   236	    if new_balance is None:
   237	        raise RuntimeError(f"User {user_id} not found during credit reconciliation")
   238	
   239	    # Update the original ledger entry to reflect actual cost — reconciled_at
   240	    # is now durably stamped in the SAME statement as the delta/balance_after
   241	    # update, never a separate step that could itself be skipped.
   242	    await db.execute(
   243	        sa.update(CreditLedger)
   244	        .where(CreditLedger.id == predebit_ledger_id)
   245	        .values(
   246	            delta=-actual_cost,
   247	            balance_after=CreditLedger.balance_after + diff,
   248	            reconciled_at=sa.func.now(),
   249	        )
   250	    )
   251	    await db.flush()
   252	    return new_balance
   253	
   254	
   255	async def ensure_monthly_credits(db: AsyncSession, user: User) -> None:
   256	    """Grant monthly credits if last grant was over 30 days ago.
   257	
   258	    Idempotency: checks CreditLedger for any recent 'monthly_allowance' within 30 days.
   259	    """
   260	    from datetime import datetime, timedelta, timezone
   261	
   262	    if (user.plan or "free").lower() != "free":
   263	        return
   264	
   265	    # Determine if grant needed based on timestamp
   266	    now = datetime.now(timezone.utc)
   267	    last = user.monthly_credits_granted_at
   268	    if last is not None and last.tzinfo is None:
   269	        # Treat naive as UTC
   270	        last = last.replace(tzinfo=timezone.utc)

exec
/bin/zsh -lc "rg -n \"session_obj\\.domain_mode|session\\.domain_mode\\s*=|domain_mode\\s*=\\s*domain_mode\" backend/app -g '*.py'
git show --format=fuller --no-patch ba8a141
git diff --stat ba8a141..HEAD -- . ':(exclude).collab/**' ':(exclude)docs/**' ':(exclude)*.md'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
backend/app/services/chat_service.py:990:    if domain_mode != session_obj.domain_mode:
backend/app/services/chat_service.py:991:        session_obj.domain_mode = domain_mode
backend/app/services/chat_service.py:1351:                domain_mode=domain_mode,
backend/app/services/chat_service.py:1655:                domain_mode=domain_mode,
backend/app/services/chat_service.py:1667:            domain_mode=domain_mode,
backend/app/services/chat_service.py:1743:                        domain_mode=domain_mode,
backend/app/services/chat_tool_executor.py:473:                domain_mode=domain_mode,
commit ba8a14143a13258247b3625fc5d3347d774ce18f
Author:     Yijie Ma <mayijie@Yijies-MacBook-Pro.local>
AuthorDate: Mon Aug 3 15:53:29 2026 +0200
Commit:     Yijie Ma <mayijie@Yijies-MacBook-Pro.local>
CommitDate: Mon Aug 3 15:53:29 2026 +0200

    chore(release): bump to 0.25.0
    
    Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
 backend/app/api/chat.py                            |  20 ++
 backend/app/api/extractions.py                     |  20 ++
 backend/app/services/chat_service.py               |  83 ++++++++-
 backend/tests/test_error_taxonomy.py               | 101 +++++++++++
 backend/tests/test_extractions_api.py              |  68 +++++++
 ...st_quote_billing_failure_windows_integration.py | 202 +++++++++++++++++++++
 backend/tests/test_quote_intent_routing.py         | 102 +++++++++++
 .../d/[documentId]/DocumentReaderPageClient.tsx    |  21 ++-
 frontend/src/components/Chat/ChatArtifactCard.tsx  |  20 +-
 frontend/src/components/Chat/ChatPanel.tsx         |   4 +-
 .../src/components/Extraction/ExtractionPanel.tsx  |   4 +-
 frontend/src/components/PaywallModal.tsx           |   9 +
 frontend/src/i18n/locales/ar.json                  |   7 +
 frontend/src/i18n/locales/de.json                  |   7 +
 frontend/src/i18n/locales/en.json                  |   7 +
 frontend/src/i18n/locales/es.json                  |   7 +
 frontend/src/i18n/locales/fr.json                  |   7 +
 frontend/src/i18n/locales/hi.json                  |   7 +
 frontend/src/i18n/locales/it.json                  |   7 +
 frontend/src/i18n/locales/ja.json                  |   7 +
 frontend/src/i18n/locales/ko.json                  |   7 +
 frontend/src/i18n/locales/pt.json                  |   7 +
 frontend/src/i18n/locales/zh.json                  |   7 +
 frontend/src/lib/billingLinks.ts                   |   5 +-
 frontend/src/lib/errorCopy.ts                      |  55 +++++-
 frontend/src/lib/useChatStream.ts                  |   1 +
 26 files changed, 767 insertions(+), 25 deletions(-)

codex
## Verdict

**P2: ADDRESSED**

- `_sync_session_domain_mode` is now synchronous and performs only an attribute assignment—no DB parameter, `await`, flush, or commit ([chat_service.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:956)).
- Tool-action sync occurs immediately before its existing assistant-message commit, inside the rollback boundary ([chat_service.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:1382)).
- Quote Finder sync is included in the message + reconciliation + usage transaction ([chat_service.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:1540)). The reconciliation helpers flush but do not commit, and no post-settlement sync remains.
- Main RAG’s assignment reaches the assistant-draft commit on every successful `done` outcome ([chat_service.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:2134), [chat_service.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:2348)). It can remain uncommitted on explicit errors or cancellation before that commit; that is consistent with the successful-terminal-path invariant and prevents failed attempts from changing session metadata.

Rollback does not leak the dirty assignment into a later commit: SQLAlchemy rollback expires persistent state and clears modification history. The Quote Finder failure test directly exercises this by using the same session for the subsequent refund commit, then confirming `domain_mode` remains `"legal"`.

The failure-injection tests target the intended commits:

- Tool action: first commit persists the user message; the second, terminal assistant/domain commit fails.
- Quote Finder: commits 1–2 persist predebit/user message, commit 3 fails after the assignment, and commit 4 successfully refunds. It verifies the stale domain value, absent assistant message, restored balance, and restored ledger set.

The two unchanged successful-route regression tests also pass in focused verification.

**New breakage in `7ec0b4e`: none found.**

## Final batch verdict

**`ba8a141..HEAD` excluding documentation commits: CONSENSUS-SHIP.**

All r1 findings and the r2 transaction-safety P2 are closed.
tokens used
111,433
## Verdict

**P2: ADDRESSED**

- `_sync_session_domain_mode` is now synchronous and performs only an attribute assignment—no DB parameter, `await`, flush, or commit ([chat_service.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:956)).
- Tool-action sync occurs immediately before its existing assistant-message commit, inside the rollback boundary ([chat_service.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:1382)).
- Quote Finder sync is included in the message + reconciliation + usage transaction ([chat_service.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:1540)). The reconciliation helpers flush but do not commit, and no post-settlement sync remains.
- Main RAG’s assignment reaches the assistant-draft commit on every successful `done` outcome ([chat_service.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:2134), [chat_service.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:2348)). It can remain uncommitted on explicit errors or cancellation before that commit; that is consistent with the successful-terminal-path invariant and prevents failed attempts from changing session metadata.

Rollback does not leak the dirty assignment into a later commit: SQLAlchemy rollback expires persistent state and clears modification history. The Quote Finder failure test directly exercises this by using the same session for the subsequent refund commit, then confirming `domain_mode` remains `"legal"`.

The failure-injection tests target the intended commits:

- Tool action: first commit persists the user message; the second, terminal assistant/domain commit fails.
- Quote Finder: commits 1–2 persist predebit/user message, commit 3 fails after the assignment, and commit 4 successfully refunds. It verifies the stale domain value, absent assistant message, restored balance, and restored ledger set.

The two unchanged successful-route regression tests also pass in focused verification.

**New breakage in `7ec0b4e`: none found.**

## Final batch verdict

**`ba8a141..HEAD` excluding documentation commits: CONSENSUS-SHIP.**

All r1 findings and the r2 transaction-safety P2 are closed.
