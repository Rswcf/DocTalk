# Codex adversarial review — citation → verified-quote bridge, slice 1

You are reviewing DocTalk (AI document Q&A with verified citations). Worktree:
/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/frontend-design-review-c26fcb, branch
`feat/citation-save-bridge`. Review commit `c8831e4` (`git show c8831e4`) against `main`. Your sandbox cannot run
git writes; read-only git is fine. Write findings to
`.collab/reviews/2026-09-22-citation-bridge/codex-r1.md`.

## What it is
Plan: `.collab/plans/2026-09-22-next-strategy.md` §2.1 and §6 (owner-ratified 2026-09-22). The cohort that ever
retained verifies by clicking citations, and a click never produces the phrasing that triggers Quote Finder. So
the reader's evidence bar (shown after a citation click) gets a "Save quote" action. It saves the citation's
supporting sentence (`citation.focusSnippet`) as a saved quote. The server re-verifies it (`POST
/api/documents/{id}/quotes`, `verify_saved_quote`; 422 `QUOTE_NOT_VERIFIABLE`, 403 `SAVED_QUOTES_LIMIT_REACHED`).
When there is nothing to save or the server cannot verify it, Quote Finder opens prefilled with the cited claim
and never submits (searches are billed). Frontend only; not shipped before 2026-09-28.

Files:
- `frontend/src/lib/citationSave.ts` — decisions and cited-claim extraction.
- `frontend/src/components/Quotes/CitationSaveControls.tsx` — the button and the notice.
- `frontend/src/components/PdfViewer/PdfViewer.tsx` — `evidenceActions` / `evidenceNotice` slots.
- `frontend/src/components/Quotes/QuoteFinderPanel.tsx` — an `openSource` prop.
- `frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx` — state, handler, wiring.
- Tests: `frontend/tests/citation-save.test.cjs`, `frontend/tests/citation-save-ui.test.cjs`.

## Invariants to attack (project rules: `CLAUDE.md`, `.claude/rules/frontend.md`, `.claude/rules/backend.md`)
1. **The verified-quote guarantee.** Nothing rendered as a saved or verified quote may come from the client
   string or the LLM; only the server row (`quoteText`, `tier`, `sourceKind`). Trust copy is per kind: a
   word-for-word claim only for `page_text`.
2. **No billed action without the user.** The fallback must never submit a quote search. Check the panel's
   open/retarget effect, its generation guard, and whether a prefill plus `openSource` retarget can trigger a
   search or leave it wedged in loading.
3. **Caps.** The button must never be disabled from a cached count; idempotent re-saves must always succeed; the
   403 path mirrors `QuoteCardList.tsx` (`paywall_opened`, `PaywallModal`).
4. **Stale results.** A save that resolves after the reader moved to another citation must not write state
   (`citationTarget !== target`). Look for races: a double click, a citation change mid-save, a locale change, the
   translated-preview mode, the converted-PDF viewer, and the reset effect keyed on `citationTarget`.
5. **Anonymous and demo.** Anonymous → sign-in, no request. Signed-in users on demo documents: the backend allows
   saving (`can_access_document`). Confirm, and confirm nothing leaks or mis-bills.
6. **Cited-claim extraction.** Offsets are Python codepoints (`insertCitationMarkers`); legacy citations use
   textual `[n]`. Try markdown tables, code spans, links like `[text](url)`, abbreviations ("e.g.", "U.S."),
   decimals, CJK, RTL/Arabic, a marker at offset 0 or at the end, several markers in one sentence, and a sentence
   longer than 300 characters (`QuoteSearchRequest.topic` max_length=300 and the input's maxLength=300 — UTF-16
   vs codepoints). A wrong topic is recoverable (the user edits it), but it must never throw or exceed the cap.
7. **Palette and accessibility.** zinc/blue app palette, nothing below 12px, no `transition-all`, dark variants.
   The notice uses `role="status"` and errors use `role="alert"`. Touch targets must be ≥ 36px (the bar's
   `min-h-9`).

## Known and deliberate (not findings unless they are wrong)
- `quote_saved` is emitted server-side with `source="quote_finder"`. Slice 2 adds an optional `source` on
  `SaveQuoteRequest`, so bridge saves are distinguishable.
- Strings use `tOr` with English fallbacks. The ten locales land in slice 2.
- The popover action (`CitationPopover.tsx`) is slice 2.
- The TextViewer (non-PDF documents) has no evidence bar, so it has no bridge yet.
- Acceptance criterion 7 (the local golden path, signed in) was not run. Claude cannot sign in, and the local
  backend has no demo documents seeded.

## Output
For each finding give severity (BLOCKER / HIGH / MEDIUM / LOW / NIT), `file:line`, a concrete failing scenario
(inputs → wrong outcome), and a minimal fix. End with a verdict: SHIP / SHIP-WITH-FIXES / BLOCK. Be adversarial;
do not restate the design back.
