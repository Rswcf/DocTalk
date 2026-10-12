VERDICT: SHIP-WITH-FIXES

1. P2 `frontend/src/lib/textEvidence.ts:350`. Focus-only CJK boundary still false-positives on mixed Latin+CJK/Kana starts.  
Input: page text `本AI合同有效期限。`, focus `AI合同有效期限`, no chunk region.  
Wrong output: `kind:"exact"` and mark on `AI合同有效期限`, even though it is inside the longer unspaced run `本AI合同有效期限`. Same for `前文AI契約有効期限。` + `AI契約有効期限`.  
Fix: make `standsAlone` use the PDF rule: if the matched edge is alnum/letter, reject when the adjacent outside char is also alnum/letter, without the `UNSPACED` exemption.

2. P2 `frontend/src/lib/rehypeMarkRanges.ts:103`. `cutsReference` is skipped when greedy alignment succeeds.  
Input: Markdown `Prices &amp; fees apply.`, range `{start:7,end:9,kind:"exact"}` covering only `&a`.  
Wrong output: rendered `<mark data-dt-evidence="exact">&amp;</mark>`, a full visible `&` mark for a source range that ends inside `&amp;`.  
Fix: run the reference/escape cut guard before both the alignment branch and the decode-search branch whenever `slice !== value && !span.code`.

3. P2 `frontend/src/components/TextViewer/TextViewer.tsx:641`. URL article mode can drop the exact heading mark but keep a body region mark and “Exact passage” status.  
Input: URL page text `## Market Dynamics\n\nEnterprise buyers increasingly demand team workspaces and SSO.`, focus `Market Dynamics`.  
Wrong output: `locateTextEvidence` returns exact heading range plus body region; `bodyMarks` filters out the heading range, so the rendered URL article marks the body sentence while the status says `evidence.exact`.  
Fix: render heading/title marks too, or if stripping removes the anchor/exact range, downgrade to page/no mark and do not keep the leftover body region.