# Session-limit copy — bounded r3 review

Reviewed `fix/session-limit-copy-only` at `e07d2d4` against `a0a446f`. Scope: exact item-4 removal and the five requested attacks on items 1–3. The accepted base session-switch clobber window is excluded.

## Five acceptance results

1. **PASS — `useChatSession.ts` is byte-identical to base.** SHA-256: `9bab8ecc7f2ba018814e04f5d27f1a9bd82a729b414eba88ae01ecc8913b6031`.
2. **PASS — zero occurrences of all eight forbidden symbols under `frontend/src`.** Also zero under `frontend/tests`: `messagesSessionId`, `transcriptRestoreInFlight`, `beginTranscriptRestore`, `endTranscriptRestore`, `ownerSessionId`, `switchRequestRef`, `switchRestoreRef`, `creatingSessionRef`.
3. **PASS — `onSwitchSession` and `onDeleteSessionById` equal base.** Compared the complete TypeScript AST-extracted declarations, including comments and whitespace, byte-for-byte.
4. **PASS — store retains only the intended metadata additions.** `isDemo` defaults/resets to false; changing document ID resets it and readiness, while setting the same ID preserves both. The store diff contains no lifecycle fields. Both declarations and implementations of `setMessages(msgs)` and `setSessionId(id)` equal base (`frontend/src/store/index.ts:110`, `:113`, `:218`, `:293`).
5. **PASS — no item-4 mechanism remains in `onNewChat`.** The added admission checks are live document identity/readiness and the existing streaming condition read from live state. Success and failure each drop responses for a different document ID. Beyond these, additions are the retained contextual copy and analytics. No reuse oracle, pending flag, serialization, or restore dependency remains (`frontend/src/components/SessionDropdown.tsx:76`).

## Verdict

**SHIP under the requested baseline-relative severity bar.** The strip is exact. No new money loss, paid-feature leak, or qualifying behavioral regression was demonstrated. The unconditional claim that *every* demo-surface limit is now checkout-free is stronger than the implementation: the nonblocking edge below remains. It already offered checkout at `a0a446f`, so it is not a newly introduced billing path.

## Findings

### NOTE — a returning document's pending metadata can misclassify an older cap response

**Location:** `frontend/src/components/SessionDropdown.tsx:111–112`; reset at `frontend/src/store/index.ts:177`; checkout rendering at `frontend/src/components/SessionDropdown.tsx:314`.

**Failing sequence:**

1. On ready demo document A, click New chat; hold its create response.
2. Navigate to B, then back to A while the reader/dropdown component instance survives the parameter changes. Let the document-change effects run. A's metadata has not returned: its store ID is A, status is `idle`, and `isDemo` is false.
3. Reject the old A create request with `SESSION_LIMIT_REACHED`. Its ID check passes. The catch uses the current false metadata instead of the validated request snapshot's true value.
4. The dropdown renders the own-document copy with a Plus plan. Its Upgrade button can invoke billing. The earlier clear-on-document-change effect does not clear an error installed afterward; successful demo metadata later clears it through the `isDemo` effect.

The controlled transpiled-component probe reproduced the own copy and one billing invocation. This is a cap-copy timing edge, not the excluded GET/transcript switch clobber. Base also maps this demo cap to the own-document Upgrade CTA, so this is a remaining coverage gap, **not BLOCK** under this review's rule. If addressed separately, using the already captured `live.isDemo` for this response's copy would align it with the event without restoring lifecycle machinery.

## Requested attack results

1. **Demo CTA structure:** The correctly classified demo mapping has `href: '/'`, no `plan`, and no paywall flag (`frontend/src/lib/errorCopy.ts:74`). The dropdown requires authenticated status **and** `cta.plan` to render checkout; its upload anchor has no billing handler. The reader CTA only navigates to the mapped href (`frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:498`). Thus that CTA cannot invoke Stripe or `upgrade_click`. The note above qualifies the broader claim about all transition states.
2. **Metadata/readiness:** Fresh clicks after `setDocument(newId)` are blocked until ready. Loader success writes status and demo metadata synchronously with no intervening await, after checking cancellation (`frontend/src/lib/useDocumentLoader.ts:93`). Same-document refresh preserves known metadata. There is no single-request latch: the independent three-second poll can recover while an earlier request remains unresolved; an executed hook probe confirmed this. However, “the loader always settles to a status” is not literally guaranteed: the metadata catch sets an error, not document status (`:78`), and permanently unresolved requests cannot guarantee readiness. The guard depends on successful metadata acquisition; it does not strand readiness after a later successful poll. The response-time classification exception is documented above.
3. **`limit_hit` attribution:** No mismatched document/demo pair demonstrated. Both event fields come from the validated request identity/snapshot (`frontend/src/components/SessionDropdown.tsx:115`); a different current ID drops the event. Even the returning-A probe emits `{ document_id: A, is_demo: true }`, correctly classifying the request despite its incorrect displayed copy. Analytics preserves the explicit fields outside reader routes.
4. **Dependencies/orphans:** No removed-symbol reference remains in source or tests. `isDemo` is written by the loader and read by both dropdown and reader via the loader return value. Delete focus/keyboard helpers and the secondary action are consumed. Retained tests exercise copy, CTA selection, confirmed deletion, metadata, locales, and attribution; none assert removed lifecycle machinery. Build/type/lint checks passed.
5. **Demo counter contract:** Zero added or removed accounting/pointer lines in the source diff. All base create/switch/reset accounting blocks remain in place; `useChatSession.ts` is identical. No counter mutation was moved. No backend counting or cap review was performed.

## Verification

- `npm run build`: passed, including compilation, lint/type checks, and 425 generated pages.
- `npm run test:unit`: **30 passed, 0 failed**; the eight retained session-limit tests also passed independently.
- Five temporary probes passed: metadata admission/recovery; different-document late success and failure drops; the returning-demo cap reproduction; independent loader-poll recovery while an earlier request hangs. These execute transpiled application modules with mocked hooks/API calls, not a real browser. The cap reproduction confirms the observed defect rather than asserting desired behavior.
- Exactness checks: `/tmp/session-copy-r3-check.cjs`; probes: `/tmp/session-copy-r3-probes.cjs`.
- No application source changed. No real-browser upload → chat → citation run, backend gates, deployment, or real Stripe transaction was performed for this bounded review.
