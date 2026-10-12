VERDICT: SHIP-WITH-FIXES

1. `frontend/src/lib/textEvidence.ts:267-285` P1. Uniqueness is checked only inside `citation.page..pageEnd` unless `contextText` has a range.  
Input: page 1 and page 2 both contain `This exact warning appears in both sections of the policy.`; `chunkText` and `focusSnippet` are that same sentence; citation `{page:2,pageEnd:2}`.  
Wrong output: `kind:"exact"` and a mark on page 2, despite the same canonical sentence existing on page 1.  
Fix: separate search scope from mark scope. Run `findAll`/ambiguity checks over all `pages` or at least the chunk’s real page range from chunk metadata; only filter output marks to `citation.page..pageEnd`.

2. `frontend/src/lib/textEvidence.ts:164-178`, `194-197` P1. The page-start split drops any short prefix as a “title”.  
Input page text: `Acme Corp reported revenue growth after the merger and announced a new audit plan for Europe.`  
Chunk text: `The court rejected Acme Corp reported revenue growth after the merger and announced a new audit plan for Europe.`  
Citation `{page:1,pageEnd:1}`.  
Wrong output: `kind:"region"` marking the page sentence, although the cited passage starts with real content not present on the page.  
Fix: only drop a prefix when it matches trusted title metadata, such as `page.section_title` or the known synthetic title block. If the dropped head cannot be verified as a title, return `page`.

3. `frontend/src/lib/rehypeMarkRanges.ts:28-43`, `74-99` P1. Long HTML entities can expand a narrow range to the whole rendered text node.  
Input page/chunk text: `Before &CounterClockwiseContourIntegral; after.`; focus range is only `&CounterClockwiseContourIntegral;`; citation `{page:1,pageEnd:1}`.  
Wrong output by code path: `align()` exceeds `MAX_SKIP`, `searchCanonical()` searches the raw entity text against rendered `∳`, fails, then line 96 returns the whole node as an `exact` mark: `Before ∳ after.`  
Fix: never mark the whole node on alignment failure. Decode the source slice before canonical search, or drop the range.

4. `frontend/src/lib/textEvidence.ts:39-42`, `86-97`, `307-309` P2. Dense-script boundary exemption allows short focus-only CJK matches inside longer unrelated runs.  
Input page text: `本合同有效期限届满后自动续约，除非双方提前书面终止。`; `chunkText:null`; focus `合同有效期限`; citation `{page:1,pageEnd:1}`.  
Wrong output: `kind:"exact"` marking chars 1-7 inside the longer sentence.  
Fix: for CJK/Thai focus-only matches without a located chunk region, require a full sentence/line boundary or a much higher minimum length; otherwise fall back to `page`.

