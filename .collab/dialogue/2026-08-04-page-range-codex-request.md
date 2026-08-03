# Codex review — deliberate reversal of your M2 r2 page-attribution policy

This asks you to review a change that **partially reverses a decision you prescribed** in the M2 r2 round, on the basis of production evidence gathered afterwards. Scope: two commits.

```
git show 2b745dd   # backend: honest range instead of discard
git show bb4363d   # frontend: render pp. X–Y + APA range
```

## What you decided in M2 r2, and why we're revisiting

In M2 r2 you found that multi-page `extracted_text` segments derived their page from majority-bbox voting, and proved it wrong (probe: bboxes 1×p1 + 2×p2 with the quote physically on p1 → majority picks p2). You offered "discard/flag, or build a real offset→page map", and I chose **discard**. That shipped.

## The production evidence that changed the trade-off

The M3 acceptance gate (`.collab/reviews/2026-08-04-m3-acceptance-gate.md`) replayed the real retained-academic corpus inside production. Results with the discard policy: **10 proposed, 1 verified across 10 real user queries.** Four `exact 100.0` verbatim matches were discarded as `ambiguous_page_range`. Production-wide: **8443/14919 (56%) of PDF chunks span page boundaries, 7551 of those (89%) span exactly one**, and `pages.content` exists for only 11 of 108 documents (B1 is forward-only; the backfill is permanently blocked for ~103 docs by a MinIO storage loss). So the discard path is the *normal* path in production, not an edge case.

## The change

`_attribute_match` gains a third branch: when an `extracted_text` segment spans **exactly one** page boundary (`page_end - page_start == 1`), emit the card with the honest range (`page = page_start`, `page_end = page_end`) and attach bboxes belonging to **either** page in the range. Spans ≥2 pages still discard as `ambiguous_page_range`. `page_text` is untouched (never ambiguous). Frontend renders "pp. X–Y" and the APA copy locator now emits "pp. X–Y" for ranges (it previously truncated to the start page).

Crucially this does **not** resurrect majority-bbox voting — we do not guess a page inside the range; we report the range. Your r2 probe's failure mode (picking the wrong single page) is impossible here.

Re-run of the same gate with this change: **1 verified → 8 verified**, including the four recovered `exact 100.0` quotes.

## What to attack
1. Is "honest 2-page range" actually honest — can the emitted range ever NOT contain the quote? Trace `_attribute_match`'s segment→page bookkeeping.
2. The span≥2 boundary: is 1 the right cut, and is the comparison off-by-one anywhere (a chunk with `page_start == page_end` must still take the single-page branch)?
3. bbox attachment for a range — can a bbox from outside the reported range leak in? Does the jump target (`page_start`) stay correct?
4. Did the deliberate test reversal (the M2 test that asserted discarding) get updated honestly, or does the new test merely assert the new behavior without preserving the span≥2 guarantee?
5. Frontend: any surface that still shows a single page for a ranged card (search card, saved card, /profile board, chat artifact, APA copy, jump)? Locale strings pluralized correctly for ranges?
6. Anything this reopens in the verified-quote guarantee — display text, tier semantics, dedup keys (does the dedup signature still distinguish two different quotes that share a page range?).

Evidence to audit, not repeat: backend 790 pass / 3 skip, ruff clean; frontend tsc + lint + build clean.

Report: severity-ranked findings with file:line, overall verdict CONSENSUS-SHIP / REVISE / BLOCK.
