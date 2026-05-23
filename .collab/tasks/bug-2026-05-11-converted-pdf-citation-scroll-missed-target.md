# BUG-2026-05-11-CONVERTED-PDF-CITATION-SCROLL-MISSED-TARGET

Status: fixed locally and retested.

## Summary

Converted DOCX/PPTX slide-view citation clicks generated PDF text-layer highlights, but the PDF viewer did not scroll the highlight into view. Users saw page 1 while the cited page 2 highlight remained below the viewport.

## Severity

P1 for converted DOCX/PPTX citation trust. The cited passage existed, but the click did not take the user to the visible source in slide view.

## Evidence

Initial converted browser UX run:

- `.collab/tasks/qa-browser-converted-citation-ux-2026-05-11.json`

After tightening viewport assertions, the run showed:

- DOCX/PPTX desktop and mobile created PDF highlights.
- Highlight boxes were outside the viewport after citation click.
- Text-view fallback highlighted the same snippet correctly.
- Mobile did switch to the document tab.

Screenshots before the fix showed the slide viewer still positioned on page 1 after a page 2 citation click.

## Root Cause

`PdfViewer` tried to scroll after `currentPage` / `scrollNonce` changed, but returned immediately when the target page ref or visible container was not ready. It did not retry that case. The fallback path also used `target.scrollIntoView()`, which was unreliable for this nested PDF scroll container.

## Fix

- `frontend/src/components/PdfViewer/PdfViewer.tsx` now retries when the target page ref is not mounted or the PDF container is still hidden.
- The no-anchor fallback now directly scrolls the PDF container to the target page offset with `container.scrollTo(...)`.

## Retest

Retest passed:

- `.collab/tasks/qa-browser-converted-citation-ux-after-container-scroll-fix-2026-05-11.json`

DOCX and PPTX desktop/mobile checks passed:

- citation count > 0
- slide/text toggle visible after citation click
- PDF text-layer highlight entered the viewport
- text-view fallback highlighted the exact snippet
- mobile switched to the document tab
- no horizontal page overflow
- blocking console errors: `0`

The harness records benign React-PDF `TextLayer task cancelled` messages separately because they can occur when switching away from PDF rendering after the slide-view assertion has completed.
