# BUG-2026-05-11-TEXTVIEWER-URL-CITATION-HIGHLIGHT-OFFSET

Status: **fixed and retested locally**

## Summary

URL/TextViewer citation jumps could highlight the wrong substring when the URL article section started with a Markdown heading.

The browser clicked a citation whose source snippet was:

```text
The citation target sentence says Example Domain is reserved for illustrative examples in documents and should be easy to verify inside the text viewer.
```

The viewer navigated to the right section, but the highlighted text started after the first words and included text from the next paragraph:

```text
sentence says Example Domain is reserved for illustrative examples in documents and should be easy to verify inside the text viewer. The surrounding p
```

## Severity

P1 for citation trust on URL and other TextViewer/article-mode documents.

The user sees a citation click land in the right area, but the highlighted passage is not the exact cited snippet. That weakens the product's core source-verification promise.

## Evidence

Failing run:

- `.collab/tasks/qa-browser-text-citation-ux-2026-05-11.json`

Observed:

- Desktop and mobile both found a visible highlight.
- Desktop/mobile console errors: `0`.
- Desktop/mobile horizontal overflow: `false`.
- `highlightContainsExpected: false`.

## Root Cause

`TextViewer` computes `highlightMatch` against the full `Page.content`. In URL article mode, `WebArticleView` strips the leading Markdown heading before rendering body content, but it passed the original unadjusted match offset into `MarkdownContent`.

The rendered body therefore sliced the citation range using an offset from a longer source string.

## Fix

`frontend/src/components/TextViewer/TextViewer.tsx` now adjusts the citation match offset by the body start position after stripping the leading heading. If the adjusted offset is outside the rendered body, the highlight is ignored instead of showing the wrong substring.

## Regression Coverage

Added browser QA harnesses:

- `.collab/scripts/qa_browser_text_citation_fixture.py`
- `.collab/scripts/qa_browser_text_citation_ux.js`

Commands:

```bash
python3 .collab/scripts/qa_browser_text_citation_fixture.py create \
  --json-out .collab/tasks/qa-browser-text-citation-fixture-2026-05-11.json
node .collab/scripts/qa_browser_text_citation_ux.js \
  --fixture .collab/tasks/qa-browser-text-citation-fixture-2026-05-11.json \
  --base-url http://localhost:3000 \
  --json-out .collab/tasks/qa-browser-text-citation-ux-after-offset-fix-2026-05-11.json
python3 .collab/scripts/qa_browser_text_citation_fixture.py cleanup \
  --user-id c64d85e2-563f-4fc6-a258-893b5ecd2c27 \
  --json-out .collab/tasks/qa-browser-text-citation-fixture-cleanup-2026-05-11.json
```

Retest result:

- Desktop: pass, expected highlight visible, source URL visible, no overflow, `0` console errors.
- Mobile: pass, citation click switched to document tab, expected highlight visible, source URL visible, no overflow, `0` console errors.
