# BUG-2026-05-11-URL-IMAGE-ONLY-TITLE-IMPORTED

Status: **fixed and retested locally**

## Summary

Image-only URL pages with a `<title>` but no readable article text were imported as a one-page document containing only the title. The backend therefore treated a no-content page as a valid URL document instead of returning `NO_TEXT_CONTENT`.

## Severity

P2 for URL import trust and user clarity.

Image-only, script-only, or otherwise unreadable pages are common user inputs. Importing a title-only document makes the reader look successful while giving chat/retrieval no useful evidence.

## Evidence

Failing run:

- `.collab/tasks/qa-url-edge-matrix-2026-05-11.json`

Observed:

- Case: `image_only_no_text`
- Expected: `NO_TEXT_CONTENT`
- Actual: success with title `Image Only Landing`
- Unexpected pages: `1`
- Unexpected PDF bytes: `0`

The same edge matrix also confirmed these URL paths before the fix:

- CJK/table HTML extraction
- one-hop safe redirect
- PDF URL detection
- redirect loop rejection
- too-many-redirects rejection
- huge content-length rejection
- redirect-to-private-host rejection

## Root Cause

`_extract_article_blocks()` inserted the page title as a fallback heading when no other text blocks were found. `fetch_and_extract_url()` then checked only whether pages existed, so a title-only fallback became a valid document.

## Fix

`backend/app/services/extractors/url_extractor.py` now checks extracted blocks for meaningful content before page splitting:

- title-only fallback headings are ignored for this test
- non-title paragraphs, list items, table cells, or other content blocks still count
- image-only/title-only pages now raise `ValueError("NO_TEXT_CONTENT")`

## Regression Coverage

Added unit coverage in `backend/tests/test_url_extractor.py`:

- `test_fetch_and_extract_url_rejects_image_only_title_page`

Added deterministic QA harness:

- `.collab/scripts/qa_url_edge_matrix.py`

Retest evidence:

- `.collab/tasks/qa-url-edge-matrix-after-no-text-fix-2026-05-11.json`

Results:

- URL edge matrix: `8/8` pass
- `tests/test_parse_service.py tests/test_url_extractor.py tests/test_error_taxonomy.py`: `69 passed`
- backend ruff: pass
- JSON/diff checks: pass
