# Precise-citations — review response (2026-06-13)

**Reviewer:** Codex (`.collab/reviews/2026-06-13-precise-citations-codex.md`, BLOCK, 3 findings)
**Author response:** Opus 4.8. All 3 reproduced before fixing; all accepted + fixed TDD.

## Finding 1 (BLOCK) — wrong-sentence focus on numeric/date contradiction — FIXED
Reproduced: `focus_sentence("...published in 2023. ...2024 revenue...", "...published in 2024")` → focused the **2023** sentence; `"Revenue rose to 12 percent"` → focused the **8 percent** sentence. Misleading.
Fix (`citation_focus_service.py`): (a) **numeric/date consistency gate** — if the claim contains numeric tokens (`\d+`: years/percents/currency/page), the focused sentence must contain ALL of them, else `None`; (b) **stopword + short-token filtering** in `_features` (content words only) so a sentence can't dominate on shared function words. Tests: `TestNumericSafety` (3), `TestStopwords` (1).

## Finding 2 (BLOCK) — `recent_claim` leaked prior sentence into next citation — FIXED
Reproduced: `"Revenue rose to 8 percent[1]. Margin fell sharply[1]."` → both `[1]`s focused "Revenue rose to 8 percent…". The plan said reset on sentence end; impl was a plain 200-char window.
Fix: new `current_claim(buffer)` returns the **last sentence segment** of the rolling buffer (handles `[n]` before OR after the period, and adjacent `[1][2]` for the same claim, without fragile reset-flag state); FSM passes `current_claim(self.recent_claim)`. Tests: `TestCurrentClaim` (2) + wiring `test_second_citation_does_not_reuse_first_sentence`.

## Finding 3 (BLOCK) — frontend dimmed/suppressed the reliable fallback before confirming the focus matched — FIXED
Was: `highlightFocus` made authoritative (bbox marking suppressed, overlay dimmed to 0.35, store overwrote textSnippet) → if the focus sentence didn't match the PDF text layer, only a faint box remained; allDummy lost its snippet fallback.
Fix: focus is now **purely additive emphasis** — `store.highlightSnippet` reverted to `textSnippet` (fallback preserved, kept separate from `focusSnippet`); `PageWithHighlights` no longer suppresses `isHighlighted` or dims the overlay; the focus sentence gets a **stronger** `pdf-highlight-focus` mark (solid `--highlight-strong` fill vs the chunk's gradient underline) layered on the unchanged chunk highlight. If the focus can't be matched, the full chunk highlight is exactly today's behavior. allDummy path unchanged.

## Codex notes addressed
- focus_snippet persistence on reload: confirmed OK by Codex (chat.py returns raw citations; api.ts maps both cases).
- Table modality: now also excluded? — left as-is for now (focus only fires when a sentence clearly dominates + numeric gate; tables rarely produce a dominant prose sentence so they degrade to whole-chunk). Noted as a follow-up if needed.
- Korean Hangul: `_CJK_RE` is Han-only → Hangul returns None → safe whole-chunk fallback (acceptable; Hangul focus is a future enhancement).

## Verify
511 backend passed / 0 new failures (6 pre-existing unrelated); ruff clean; tsc + eslint clean; `npm run build` OK. Re-review (round 2) launched.
