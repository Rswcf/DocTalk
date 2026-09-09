# Verdict: BLOCK

Reviewed `a0a446f..30f7f1e`, after reading `CLAUDE.md`, `.claude/rules/frontend.md`, and design authority §9.18–§9.19. One demonstrated regression meets the requested blocking bar. The demo upload CTA and accounting-preserving reuse are otherwise sound in the paths examined. No cap, backend counting, or demo-counter redesign is requested.

## 1. BLOCK — failed initial transcript load permanently disables session switching until reload

**Location:** `frontend/src/components/SessionDropdown.tsx:144`; the parallel New Chat guard is at `frontend/src/components/SessionDropdown.tsx:87`.

**Concrete failing sequence:**

1. A signed-in user opens a document with three existing conversations, A/B/C. This applies to either their own document or a demo.
2. `useChatSession` successfully lists the conversations and selects A (`frontend/src/lib/useChatSession.ts:141`, `:144`). `setSessionId(A)` invalidates transcript ownership, leaving `messagesSessionId = null`.
3. The initial `getMessages(A)` fails transiently. The existing fallback attempts `createSession`, which fails with `SESSION_LIMIT_REACHED` (`useChatSession.ts:149`, `:155`, `:183`). Both requests have now settled, but nothing restores transcript ownership: the store remains `{sessionId: A, messagesSessionId: null, messages: [], sessions: [A,B,C]}`.
4. The network recovers. Clicking A or B in the dropdown now returns at line 144 without issuing a GET. New Chat also returns at line 87. These enabled-looking controls remain inert because the ownership mismatch is being treated as an active request even after the request failed. The reader renders the empty ChatPanel ahead of the initialization error because A remains truthy (`frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:481`).

**Before/after evidence:** A targeted reproduction using the actual transpiled `useChatSession`, store, and dropdown, with controlled API failures, passes with the base store/dropdown from `a0a446f`: clicking B issues a GET and restores B's transcript. With `30f7f1e`, the same assertion fails: **zero retry GETs instead of one**. This is lost existing recovery behavior, not merely missing error copy. A full page reload can recover; server messages were not shown to be deleted.

**Suggested fix:** Distinguish an actively pending transcript restore from an unloaded/failed transcript. Clear pending status on every completion/failure/cancellation and allow an explicit session selection to fetch again once no restore is pending. Retain the ownership requirement for empty-session reuse, and retain late-response/session/document guards. Do **not** fix this by certifying the failed load's empty array with `setMessages([])`. Add the initial-GET-failure → capped fallback → existing-session retry regression case; the current failed-switch test starts from an already loaded transcript and misses this state.

## 2. NOTE — demo/own analytics split works on reader routes, but not every place this dropdown renders

**Location:** `frontend/src/components/SessionDropdown.tsx:134`, with path enrichment at `frontend/src/lib/analytics.ts:13` and header mounting at `frontend/src/components/AppHeaderShell.tsx:38`.

**Concrete failing sequence:** Open demo A with three conversations and a nonempty current transcript, then click the header logo to `/`. That link does not reset the document store; the authenticated dashboard renders AppHeaderShell, which still renders SessionDropdown whenever `documentName` is present. Click New Chat there. The request still targets A and its demo limit correctly offers upload, but the event contains only `{path: '/', source: 'session_dropdown', reason: 'session_limit'}`. Neither the document ID nor demo-ness is emitted, so this event cannot be classified by joining its reader-path document ID to `documents.demo_slug`. The same ambiguity can occur on a collection route with retained document state.

**Scope/severity:** This path-only attribution gap already exists in the base; it is not a blocking regression. On `/d/<id>`, the existing path metadata does support the required join and the demo CTA continues to emit `limit_hit` as intended.

**Suggested fix:** Include the request's `document_id` in this event (optionally also `is_demo`), so classification does not depend on the current route. Continue using the document's authoritative demo marker for the downstream split.

## Results for the six requested attacks

1. **Demo checkout:** No reproducible session-limit → Stripe/`upgrade_click` escape found. `errorCopy.ts:74` returns a CTA without `plan` or `openPaywall`; `SessionDropdown.tsx:349` therefore renders the plain `/` link even when authenticated. The reader initialization-error mapper also passes demo context. The unchanged anonymous session-limit code remains separate. Collection session creation uses its own handler; the retained document dropdown still maps the surface of the document it requests.
2. **Surface timing:** Actual document changes reset both `isDemo` and readiness (`store/index.ts:181`); New Chat checks live readiness and document identity. The loader's cancellation check precedes its metadata writes (`useDocumentLoader.ts:93`), and readiness/demo writes have no intervening await. Same-document refresh preserves known demo-ness. The shared store also reaches the header outside the reader subtree. No demonstrated false-positive/negative billing branch from these transitions.
3. **Demo accounting:** Reuse leaves the session ID, zero user-message count, server count, restored baseline, epoch, and storage pointer unchanged. The create accounting block retains its previous sequence. A separate executed reproduction drove an assistant-only failed Continue through the actual `useChatStream`, held its re-anchor GET pending, reused the session, then resolved the GET: reuse made no accounting/pointer writes, and the late re-anchor correctly installed server usage with a zero live baseline without restoring cleared assistant text.
4. **Emptiness:** The live transcript, membership, streaming, and ownership checks prevent the ordinary initial/switch loading pane from being mistaken for a loaded empty conversation. No demonstrated user-message deletion through reuse. Finding 1 is the concrete failure of the new ownership guard's recovery behavior.
5. **Delete affordance:** With the normal three-session list, it selects a non-active row and opens that row's existing confirmation; it does not delete on the CTA click. With no non-active row it explicitly falls back to current-session confirmation, so “always non-active” is not literally true. An active stream disables the CTA and confirmation. No new demonstrated wrong-session or mid-stream deletion regression from this affordance.
6. **Limit events:** Demo and own-document shared-code failures both retain a CTA and emit `limit_hit`. Reader-path attribution works; finding 2 records the concrete limitation outside reader routes.

## Verification actually performed

- Reconstructed both commit trees and their textual diff by reading local Git objects; **no git command executed**. All changed working-tree files matched the target commit's blobs.
- Ran `npm run test:unit` in `frontend`: **37 passed, 0 failed**.
- Ran the targeted initial-restore recovery reproduction against both versions: **base passed; target failed**.
- Ran the assistant-only reuse / pending re-anchor reproduction against the target: **passed**.
- Reproduction scripts and extracted source snapshots are temporary artifacts under `/tmp/session-copy-r1/`; they do not modify application code.
- Did **not** run the production build, Ruff, backend pytest, browser golden path, or real checkout during this review. The supplied Claude gate results are not claimed as independently executed.
