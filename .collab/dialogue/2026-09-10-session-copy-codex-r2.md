# Verdict: BLOCK

Reviewed `30f7f1e..7a93ac5` for the repair and `a0a446f..7a93ac5` for the whole batch on `fix/session-limit-copy`. Both round-1 findings are closed. One separately demonstrated regression meets the requested bar of breaking previously working behavior. No money loss or paid-feature leak was demonstrated.

## 1. BLOCK — deleting the active session during restore skips its replacement and leaves a deleted session active

**Location:** `frontend/src/components/SessionDropdown.tsx:147`, reached from the post-delete replacement at `frontend/src/components/SessionDropdown.tsx:216`. Deletion itself remains enabled at `frontend/src/components/SessionDropdown.tsx:198`. The last-row replacement encounters the equivalent guard at `frontend/src/components/SessionDropdown.tsx:89`.

**Failing sequence:**

1. Open a document with conversations A/B/C. The initial hook lists them, selects A, and waits for `getMessages(A)`. The document is ready, streaming is false, and `transcriptRestoreInFlight` is set.
2. Open the dropdown and confirm deletion of the current conversation A. Both controls remain enabled during restore. DELETE succeeds and `removeSession(A)` removes its row, but does not change `sessionId`.
3. The deletion handler calls `onSwitchSession(B)` to select a surviving conversation. The new pending-restore guard returns immediately. No GET for B is issued and no replacement is queued. The menu closes.
4. A's GET, served before DELETE but delayed in transit, now returns successfully. `useChatSession.ts:150` accepts it: the document still matches and `sessionId` is still A. A's transcript is installed and tagged as owned by A, and the token clears.
5. Final state: the session list contains B/C, but the active session and displayed transcript still belong to deleted A. Subsequent chat targets the deleted session instead of the surviving conversation. Manually reopening the dropdown and selecting B after restore settles recovers; this is not a permanent pending-flag brick.

**Before/after evidence:** Executed the same controlled sequence against the actual transpiled store, hook, and dropdown from both revisions, with mocked API responses and hook lifecycle. A's delayed GET resolves after DELETE, then B's replacement GET resolves if requested:

| Revision | GET requests | Final active session | Final transcript | Replacement assertion |
| --- | --- | --- | --- | --- |
| `a0a446f` | A, B | B | B's user message | PASS |
| `7a93ac5` | A only | deleted A | A's user message | FAIL |

This finding concerns the whole batch: the old ownership guard in round 1 also prevented this replacement; replacing it with the pending token does not close this interaction. It is distinct from the now-fixed failed-restore retry blocker.

**Suggested fix:** Serialize confirmed deletion with transcript restore as well. A minimal option is to disable deletion while restore is pending and enforce that condition using live state inside the delete handler, including confirmations opened before the restore began. Alternatively, explicitly cancel/invalidate the restore and guarantee a surviving-session selection or real replacement creation after DELETE. Do not simply bypass the switch guard while leaving the old restore live. Add the initial-restore → confirmed active deletion → delayed successful GET regression case, plus the single-row replacement case, to the chosen behavior's tests.

## Results for the six requested attacks

1. **Flag lifetime:** No stranded-token failure demonstrated. Initialization acquires the token immediately before invoking an async function; exceptions inside that function become promise rejections, so they do not skip attachment of `.finally()`. The preceding reset setters run before acquisition. The actual setters and storage helper introduce no identified synchronous throw that strands an acquired token. Success/failure release in `finally`; cleanup sets cancellation before releasing. The StrictMode setup → cleanup → setup pattern and remount use distinct tokens. An additional executed probe started the newer restore *before* running the older cleanup: both that cleanup and its late completion left the newer token intact. A genuinely unresolved request stays pending until settlement or cancellation; cleanup releases even that case.
2. **Early release:** The switch's `finally` precedes installation, but the document/session/request checks and installation follow synchronously, without another await. A user click cannot interleave there. Initial cleanup marks its closure cancelled, and dropdown cleanup invalidates its request number before release. Executed document-transition and late-response probes preserved the new transcript and token. Finding 1 is a different coordination failure: deletion proceeds while its required replacement is blocked.
3. **Ownership:** The failed-switch rollback now passes the previous `messagesSessionId` explicitly, preserving `null` and foreign owners instead of certifying an unloaded array. Additional foreign-owner rollback testing passed. Initial/switch successful document restores and fresh creation install after selecting/checking the intended session. Reuse reads live membership, owner equality, and user messages; no demonstrated reuse path discarded a loaded user-bearing transcript. Other existing `setMessages` callers in streaming and collection code were inspected; no separate batch-induced user-message-loss finding was established. Finding 1 can certify a *deleted* session's transcript, which the identity-only guard does not distinguish from a live one.
4. **Unknown ownership:** It falls through to one create attempt, preserving pre-batch behavior. An executed 20-click burst with unknown ownership and a cap error admitted one request; settlement did not trigger an automatic retry. A subsequent explicit click admitted one further request. Errors retain the transcript/owner and show the cap copy. There is no new client bypass of the unchanged server cap; backend counting was not re-reviewed.
5. **Round-1 conclusions:** Demo `SESSION_LIMIT_REACHED` copy has an upload link without `plan` or `openPaywall`; the authenticated dropdown requires `cta.plan` to render checkout, and the reader error CTA navigates to the mapped href. The executed demo-wall test made no billing call. The whole-batch diff adds, moves, or removes no demo-counter/accounting-epoch/pointer mutation; reuse performs none, and the existing create/restore accounting blocks remain. Unit tests verified reuse accounting invariance and live-user-message rejection. The round-1 failed initial GET → capped fallback → explicit retry test now passes.
6. **`limit_hit` attribution:** No mixed-document event demonstrated. The dropdown's `documentId` actually comes from its store selector, not a separate component prop. The handler compares it to the live snapshot before requesting, and `is_demo` is taken from that same validated snapshot. A different document at rejection suppresses the event. `setDocument` resets demo-ness/readiness on identity changes; the loader writes readiness and demo metadata synchronously, with no await between them, and cancelled metadata responses do not write. Executed probes covered a stale callback after document change, a change before rejection, and both demo/own events outside reader routes. Same-document refresh preserves known demo metadata. The round-1 path-only attribution gap is closed.

## Verification actually performed

- Read both requested Git diffs, the round-1 review, `CLAUDE.md`, and `.claude/rules/frontend.md`; inspected all application `setMessages` call sites and relevant lifecycle/CTA consumers.
- Ran `npm run test:unit` in `frontend`: **47 passed, 0 failed**.
- Ran six additional controlled lifecycle/ownership/click/metadata tests: **6 passed, 0 failed**.
- Ran the active-delete-during-restore reproduction against both revisions: **base passed; HEAD failed** the surviving-session assertion. These are transpiled-source tests with mocked React hooks/API calls, not real-browser tests.
- Temporary reproduction sources and extracted base modules are under `/tmp/session-copy-r2/`. No application source was modified.
- Ran `git diff --check a0a446f..HEAD`: reported six trailing-whitespace lines in the two existing implementation-report build logs; not a behavioral finding.
- Did **not** run the production build, browser upload → chat → citation golden path, backend gates, or real Stripe checkout. Claude's supplied gate results are not claimed as independently executed.
