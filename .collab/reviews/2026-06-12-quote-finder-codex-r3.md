# Quote Finder + Evidence Board - Codex Ratification R3

Date: 2026-06-12  
Reviewer: Codex  
Plan reviewed: `.collab/plans/2026-06-12-quote-finder-evidence-board.md` §8  
Prior reviews: `.collab/reviews/2026-06-12-quote-finder-codex-r1.md`, `.collab/reviews/2026-06-12-quote-finder-codex-r2.md`

## Verdict

**CONSENSUS.** Ship §8 as the design-of-record.

I found no material r1/r2 required change that was dropped, weakened, or misrepresented in §8. The section correctly overrides the earlier optimistic text and turns the design into a gated first-paid loop: substrate first, then verified discovery/save/jump/copy, with bibliography/export/SEO work deferred.

## Faithfulness Check

- **D1/D2 verifier substrate:** faithfully carried. §8.1 includes parser mutation fixes, hard-hyphen handling, forward-only PDF page text persistence, saved-quote anchors/hashes, page derivation from the verified slice, stronger dedupe, fuzzy guards, and honest old-doc/new-doc trust labels.
- **D3 highlight:** faithfully carried. §8.2 no longer claims span-precise reuse; it labels v1 highlights approximate, stores source/span data for later precision, and requires PDF text-layer snippet fallback even when coarse bboxes exist.
- **D4 retrieval:** faithfully carried. §8.3 adds deterministic normalized phrase/term candidate expansion plus quote-search telemetry, with `pg_trgm` as the first fast-follow if replay exposes recall misses.
- **D5/D6/D7 scope cuts:** faithfully carried. §8.5 removes full citeproc/Crossref/OpenLibrary/export/SEO from the first paid loop and keeps only best-effort APA in-text copy from minimal editable metadata.
- **D8 data model and operational guards:** faithfully carried for v1. §8.4 user-scopes biblio edits; §8.5 adds saved-quote source anchors, offsets, hashes, verifier metadata, nullable bboxes, indexes, access control via `can_access_document`, idempotent saves, i18n, and production replay before Plus gating.
- **Funnel fixes:** faithfully carried. §8.5 keeps them decoupled in M0, including the explicit 25 MB to 50 MB config change.
- **Risk register:** faithfully carried. §8.6 adds the risks called out in r2.

No §8 line needs correction.

## Synthesis Decisions

1. **Pricing synthesis is sound.** A dedicated `reason="quote_search"` keeps accounting separate from chat; `UsageRecord.message_id=None` preserves job-style attribution; predebiting the balanced-mode estimate and reconciling to actual token use preserves the chat-style fairness r2 required. Refunding only system failures while charging verified-empty searches is correct because the paid resource is the model/search attempt, not the number of accepted cards.

2. **Free saved-quote cap is sound.** `FREE_SAVED_QUOTES_LIMIT=30` counted over active saved quotes per user across documents matches r1's thesis-user concern better than 20, avoids the nonexistent "board count" meter, and keeps deletion as a natural way to free slots. Unlimited-by-default Plus/Pro constants are the right beta posture.

## Final Call

**CONSENSUS.** The plan can be treated as ratified design-of-record, with §8 overriding conflicting earlier D1-D8/§5 text.
