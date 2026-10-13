# Codex adversarial review, round 2 (gpt-5.5)

Range: `8442a92e..a9db3e1d` (adds `8bb804eb` and `a9db3e1d`, the r1 fixes). The prompt also gave the Linux dead-socket reproduction and the residual case of a prose en dash that pdf.js emits as its own item.

---

VERDICT: SHIP

1. No P1/P2/P3 findings.

What I verified:
- R1 #1 is fixed. `isListMarkerItem` now only drops a pdf.js item made entirely of marker glyphs, so inline prose markers like `Revenue rose – sharply`, `12–14`, and `• Text` stay real text (`frontend/src/lib/convertedEvidence.ts:54`). Both gates use the same rule: the converted index drops only bullet-only items (`frontend/src/lib/convertedEvidence.ts:66`) and the text-layer matcher spaces only bullet-only spans while passing the candidate unchanged (`frontend/src/components/PdfViewer/PageWithHighlights.tsx:106`, `:111`).
- `PdfViewer` now preserves raw page items for converted-page indexing while keeping joined page text for normal search (`frontend/src/components/PdfViewer/PdfViewer.tsx:104`, `:132`, `:365-377`).
- R1 #2 is fixed. Transfer read timeout is capped at 120s (`backend/app/services/storage_service.py:47`, `:213`), POST retry widening was not introduced, and the transfer pool keeps urllib3/minio default retry policy apart from keepalive and timeout (`backend/app/services/storage_service.py:217`; test pins at `backend/tests/test_storage_service.py:265-291`).
- The URL import UA change remains isolated: it keeps DNS pinning/SNI and sends the product/contact UA on each redirect hop (`backend/app/services/extractors/url_extractor.py:74-89`, `:230-244`; tests at `backend/tests/test_url_extractor.py:343-390`).

Residual judged acceptable: a prose en dash emitted as its own pdf.js item could be classified as a bullet, but it still needs extractor/PDF divergence plus whole-document uniqueness to create a false exact mark. I do not see a cheap symmetric string-only rule that closes that without re-breaking PowerPoint en-dash bullets; a stronger rule would need item geometry or neighbor context in both gates.

I did not run git, node, or the test suite; this review is from the supplied diffs plus direct source inspection.
