BLOCK

## Findings

1. **[BLOCK] Reparse locks the current user row but applies the stale pre-lock plan, so a downgrade race can create more live documents than the new plan allows.**
   - **Location:** `backend/app/api/documents.py:889`, `backend/app/api/documents.py:902-910`
   - **Failing sequence:** A Plus user has four errored documents and no live documents. Four reparse requests authenticate while `user.plan == "plus"`, but pause before line 889. A concurrent plan transition commits `plan = "free"`. The four requests then serialize correctly on the Free user's row, but line 889 selects only `User.id`, and line 905 continues to use the already-loaded `user.plan == "plus"`. Each request therefore evaluates capacity against the Plus ceiling and claims its errored row. The Free account ends with four live/parsing documents, above `FREE_MAX_DOCUMENTS == 3`. The same stale read can reject a just-upgraded user under the old lower ceiling. This is a paid-feature leak and defeats the stated `SELECT users.plan ... FOR UPDATE` authority.
   - **Suggested fix:** Select and retain the locked plan (`locked_plan = await db.scalar(select(User.plan)...with_for_update())`) and pass `locked_plan` to `document_capacity_error_detail`. Add a concurrency regression in which the dependency's `user.plan` disagrees with the locked database value; the locked value must win. The unlocked upload/URL/layout pre-checks should likewise refresh the scalar plan before issuing an early 403 so a concurrently completed upgrade is not rejected from an identity-map-stale value.

2. **[BLOCK] The Retry action is attached to non-chat operation errors and can spend credits on an unrelated regeneration.**
   - **Location:** `frontend/src/components/Chat/ChatPanel.tsx:600-615` (with non-chat error producers at `frontend/src/components/Chat/ChatPanel.tsx:358-365`, `:388-397`, `:435-444`, and `:465-474`)
   - **Failing sequence:** A user has an existing question/answer, clicks Share, and the share request fails. `handleShare` appends an assistant `isError` message. Because `isLastAssistantMsg` checks only role, position, and streaming state, line 614 supplies `handleRegenerateLast` to that share-error bubble. The new button says Retry, but clicking it trims back to the last user prompt and starts a new billed LLM request; it neither retries Share nor preserves the existing answer. Export and checkout failures take the same path. This can charge credits for work the label did not describe.
   - **Suggested fix:** Give chat-response failures an explicit UI-only discriminator (for example `retryAction: "regenerate"`) and pass `onRegenerate` only for that discriminator. Set it only in the stream-error rendering path, including the partial-answer branch. Do not infer retry provenance from the generic `isError` styling flag or from message IDs, and do not alter demo accounting.

3. **[BLOCK] The new Retry button is not single-flight; two activations from one render can launch and bill two regenerations.**
   - **Location:** `frontend/src/components/Chat/MessageBubble.tsx:353-356`, `frontend/src/components/Chat/ChatPanel.tsx:493-495`, `frontend/src/lib/useChatStream.ts:403-424`
   - **Failing sequence:** On an eligible failed answer, invoke the button twice before React commits the `isStreaming` render (a fast double click or two programmatic click events). Both calls use the same `regenerateLastResponse` closure, whose line-404 guard still sees the captured `isStreaming == false`. The first call synchronously trims the transcript, increments demo usage, and sets streaming; the second call nevertheless repeats those mutations and opens a second chat request. An anonymous user loses two accepted demo questions, and an authenticated user can receive two credit debits for one intended retry; the two streams also share the last-message target and abort ref.
   - **Suggested fix:** Add a synchronous single-flight latch in `ChatPanel` (a ref set before calling and cleared in `finally`), or make the guard read `useDocTalkStore.getState().isStreaming` at invocation time before any transcript/accounting mutation. Keep the button disabled/absent while latched. Add a test that invokes the same rendered callback twice and asserts one regenerate call and one accounting mutation.

4. **[NOTE] An in-flight polling refresh can write document A's brief after the hook has switched to document B.**
   - **Location:** `frontend/src/lib/useDocumentBrief.ts:25-30`, `frontend/src/lib/useDocumentBrief.ts:62-70`
   - **Failing sequence:** Document A is in the `empty` polling window and a timer-started `refresh()` is slow. The user navigates to document B; the document-ID effect clears the brief and cancels only its own initial request. The old polling promise has no cancellation/generation guard, so when A's response resolves it still executes `setBrief(data)`. If B's request fails or resolves later, A's summary/questions can survive or flash in B's empty pane.
   - **Suggested fix:** Guard every refresh response with a document generation/request token (or an AbortController), not only the initial effect request. Invalidate the token on every `documentId` change and on disablement.

5. **[NOTE] `status: "failed"` does not actually suppress brief content.**
   - **Location:** `frontend/src/components/Chat/ChatPanel.tsx:520-526`, `frontend/src/components/Chat/ChatPanel.tsx:558-577`
   - **Failing sequence:** Celery uses late acknowledgements, so a successfully generated brief can be redelivered. If the duplicate run later fails, `_persist_brief_error` reuses the existing row and sets `error_code` without clearing its summary/key-points/questions. The brief endpoint consequently returns `status: "failed"` together with the retained payload. `ChatPanel` never checks `documentBrief.status`, so it renders that payload even though the settled B1 contract says failed briefs render nothing extra.
   - **Suggested fix:** Derive a usable brief only when `documentBrief?.status === "ready"`, and source the B1 summary, key points, and brief-question fallback from that gated value. Preserve the pre-existing `suggestedQuestions` behavior separately.

## Checks without findings

- With a stable plan value, the user-row lock serializes all three async ingest forms, the automatic layout-translation import, and error-to-live reparses; no upload/failure/retry/delete sequence exceeded the live ceiling or made retained document rows unbounded. Rule C's `errored_count=0` also leaves a failed-row-ceiling user able to retry whenever a live slot is free.
- Race-rejected objects use a fresh UUID-derived key, and the async reject path rolls back before best-effort deletion, so it cannot delete another document's successful object.
- The conditional reparse UPDATE, 409 `DOCUMENT_PROCESSING` behavior, commit-before-dispatch order, and parse worker terminal-state gate remain intact.
- `useChatStream.ts`, `demoSessionStorage.ts`, and `store/index.ts` have no diff, and no demo-counter mutation was added or moved elsewhere in the batch. Finding 3 is a new caller re-entry problem, not an accounting redesign.
- The 15 terminal parse codes match the frontend taxonomy, and `DOWNLOAD_FAILED` is the only class for which the new document-error controls suppress Retry.

Review performed from `git diff 6c5d1fa..c7bf834` and surrounding source; no test or build gate was rerun for this review.
