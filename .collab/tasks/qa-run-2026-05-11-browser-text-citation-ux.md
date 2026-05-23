# QA Run - Browser URL/TextViewer Citation UX - 2026-05-11

Scope: cover the remaining non-PDF citation-jump UX gap with a deterministic URL/TextViewer fixture. This run does not use an LLM key; it isolates frontend citation navigation/highlighting for URL-style text documents.

## Environment

| Item | Value |
|---|---|
| Backend | `http://127.0.0.1:8000`, temporary uvicorn process |
| Frontend | `http://localhost:3000`, temporary Next.js dev server |
| Fixture | Synthetic authenticated `file_type=url` document with pages, chunks, session, assistant citation |
| Harnesses | `.collab/scripts/qa_browser_text_citation_fixture.py`, `.collab/scripts/qa_browser_text_citation_ux.js` |

## Results

| Flow | Result | Evidence |
|---|---|---|
| Initial URL/TextViewer citation click | Fail | `.collab/tasks/qa-browser-text-citation-ux-2026-05-11.json` |
| Retest after TextViewer offset fix | Pass | `.collab/tasks/qa-browser-text-citation-ux-after-offset-fix-2026-05-11.json` |
| Fixture cleanup | Pass | `.collab/tasks/qa-browser-text-citation-fixture-cleanup-2026-05-11.json` |

## Failure Found

The first run proved that citation clicks reached the URL article section but highlighted the wrong text range. The highlighted text skipped the beginning of the source snippet and included text from the next paragraph.

Bug report:

- `.collab/tasks/bug-2026-05-11-textviewer-url-citation-highlight-offset.md`

Fix:

- `frontend/src/components/TextViewer/TextViewer.tsx` adjusts citation offsets after URL article headings are stripped for rendering.

## Retest Evidence

After the fix:

- Desktop:
  - citations: `1`
  - highlights: `1`
  - `highlightContainsExpected: true`
  - original URL link visible
  - no horizontal overflow
  - console errors: `0`
- Mobile:
  - citations: `1`
  - highlights: `1`
  - `highlightContainsExpected: true`
  - citation click selected the document tab
  - original URL link visible
  - no horizontal overflow
  - console errors: `0`

Screenshots:

- `.collab/tasks/screenshots/2026-05-11/text-citation-desktop.png`
- `.collab/tasks/screenshots/2026-05-11/text-citation-mobile.png`

## Cleanup

Created QA user/document were deleted:

- `.collab/tasks/qa-browser-text-citation-fixture-cleanup-2026-05-11.json`

Cleanup returned `users=0`, `documents=0`.

## Remaining Gap

This covers URL/TextViewer citation UX with a deterministic synthetic cited assistant answer. A fully live URL/TextViewer LLM citation-jump run still requires a configured LLM key and should be executed when the key is available through the normal environment.
