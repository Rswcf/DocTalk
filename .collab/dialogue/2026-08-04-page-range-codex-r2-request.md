# Codex r2 — page-range reversal, final verification

Your r1 verdicted REVISE on two items and said "after the documentation correction and small bbox regression test, this is CONSENSUS-SHIP." Both are done.

```
git show 8868f97   # #1 governance/documentation amendment (mine)
git show 3703297   # #2 bbox range-leak test + class rename (backend agent)
```

**#1 (MEDIUM — governing docs still mandated the reversed policy).** Recorded the amendment in all four places you named, and corrected the misquote you caught:
- `.claude/rules/backend.md` — the attribution bullet now states the narrowed policy (one boundary → honest range; ≥2 → discard; majority-bbox voting still forbidden) plus an explicit *Amendment record* carrying the production numbers and a "do not restore blanket discarding" instruction.
- `docs/ARCHITECTURE.md` and `docs/ARCHITECTURE.zh.md` §10 — same amendment, both languages.
- `.collab/plans/2026-06-12-quote-finder-evidence-board.md` §8.1 — an inline `[AMENDED 2026-08-04]` note narrowing "reject" to spans ≥2 boundaries.
- You were right that the plan never sanctioned ranges: it says chunk-fallback "must reject or split". The false claim appeared in the code comment (`quote_search_service.py`) and in my acceptance report; both now state plainly that this is a deliberate amendment justified by the production data, not a pre-existing permission. The report carries an explicit correction paragraph.

**#2 (LOW — bbox test didn't protect against outside-range leakage).** The span-1 honest-range fixture now includes page-3 and page-99 bboxes and asserts both are excluded from the emitted card. Mutation-tested by deleting the `page_start <= bbox.page <= page_end` predicate — the leak reproduced, then restored. Also renamed `TestAmbiguousMultiPageExtractedSegmentDiscarded` → `TestMultiPageExtractedSegmentAttribution`, since the class now asserts emit-with-range (you flagged the stale name as a contradiction).

Task: verify both items are properly closed; flag NEW breakage in these two commits only; if clean, issue the final verdict for the page-range change (commits `2b745dd`, `bb4363d`, `8868f97`, `3703297`).

Evidence to audit, not repeat: backend 790 pass / 3 skip, ruff clean, frontend build clean at HEAD.

Report: verdicts + new-breakage + overall verdict CONSENSUS-SHIP / REVISE / BLOCK.
