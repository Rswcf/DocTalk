VERDICT: SHIP-WITH-FIXES

1. P2 `frontend/src/lib/textEvidence.ts:518`. The a94 fallback binds the focus to `chunkText.includes(quote)`, not to the cited occurrence.  
Input: page 1 text `Market Dynamics is a glossary phrase outside the selected chunk. The committee reviewed the annual budget in March. The chair asked for a revised forecast by June.`; chunk text `Market Dynamics The committee reviewed... The chair asked...`; focus `Market Dynamics`.  
Wrong output: `kind:"exact"` marks the glossary phrase outside the chunk, while the region marks later chunk text.  
Fix: require the focus occurrence to map to a located chunk occurrence, or require the quote to be unique in canonical chunk text and in page order with the located region. Otherwise keep `region`/`page`.

2. P2 `frontend/src/components/TextViewer/TextViewer.tsx:338`. Pending jumps are not scoped to `documentId` and are not cleared when the arming effect exits.  
Input: click a DOCX citation in document A while Markdown bodies are still mounting, then switch to document B before `bodiesReady`. `clearDocumentTransientState()` resets store state, but the same `TextViewer` instance can keep `pendingJump.current`.  
Wrong output: when B’s bodies mount, line 369 can scroll B to A’s pending page/anchor.  
Fix: clear `pendingJump`, `pendingAnchor`, and `mountedAnchor` on `documentId` change and when the arm effect returns early; include `documentId`/citation token in `pendingJump` and verify it before scrolling.

3. P3 `frontend/src/lib/textEvidence.ts:147`. A real one-line page can be treated as an explainable gap.  
Input: page 1 `Alpha sentence closes page one with enough unique words.`; page 2 `Short body`; page 3 `Gamma sentence starts page three with enough unique words.`; chunk is those three in order.  
Wrong output: `region` marks pages 1 and 3, drops page 2’s real body text, and still reports a region.  
Fix: do not let `explainsGap()` consume an entire intervening page that was not independently located; fall back to page/partial region instead.