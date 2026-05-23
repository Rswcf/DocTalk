# QA Run - 2026-05-11 - Browser Structured Workflows UX

## Scope

Authenticated browser UX coverage for the currently reachable structured-workflow surfaces:

- Chat-native structured artifact cards in the document reader: extraction, table, and question-template artifacts.
- Collection detail `Templates` workspace: saved template display, create/update, run result display, Markdown/CSV exports, and citation popup links.

Important reachability finding: `frontend/src/components/Extraction/ExtractionPanel.tsx` exists in the repo, but is not currently mounted by a reachable page. Product docs and current UI point to chat-native artifacts plus the collection `Templates` workspace as the active user-facing path. This run covers reachable UI; the orphaned panel needs a product decision: remove, reattach, or explicitly keep as retired code.

## Environment

| Item | Value |
|---|---|
| Backend | Local FastAPI on `http://127.0.0.1:8000` |
| Frontend | Local Next.js dev server on `http://127.0.0.1:3000` |
| Browser | Playwright Chromium via `frontend` dependencies |
| Viewports | Desktop `1440x900`, mobile `390x844` |
| Data | Synthetic Pro user, ready Markdown document, collection, sessions, completed extraction/table/template jobs |
| External LLM | Not used |
| Corpus | Did not mutate `test_inputs/`; synthetic DB rows only |

## Artifacts

| Type | Path |
|---|---|
| Fixture | `.collab/scripts/qa_browser_structured_workflows_fixture.py` |
| Browser harness | `.collab/scripts/qa_browser_structured_workflows_ux.js` |
| Fixture evidence | `.collab/tasks/qa-browser-structured-workflows-fixture-2026-05-11.json` |
| Passing browser evidence | `.collab/tasks/qa-browser-structured-workflows-ux-after-consent-fix-2026-05-11.json` |
| Cleanup evidence | `.collab/tasks/qa-browser-structured-workflows-fixture-cleanup-2026-05-11.json` |
| Screenshots | `.collab/tasks/screenshots/2026-05-11/structured-workflows-*.png` |
| Bug report | `.collab/tasks/bug-2026-05-11-cookie-consent-blocks-collection-templates.md` |

## Result

Pass after fix:

```json
{
  "desktop_ok": true,
  "mobile_ok": true,
  "desktop_console_errors": 0,
  "mobile_console_errors": 0,
  "desktop_document_overflow": false,
  "mobile_document_overflow": false,
  "desktop_collection_overflow": false,
  "mobile_collection_overflow": false
}
```

## Coverage

Document reader structured artifacts:

- Opened `/d/{document_id}` as a synthetic Pro user.
- Verified chat-native artifact cards for `Key Facts`, `Tables`, and `Question template`.
- Verified rendered artifact content including provider markdown and `Revenue 42`.
- Desktop used real Playwright download events for extraction Markdown/CSV, table CSV, and question-template Markdown.
- Mobile used same-origin fetch validation for download URLs because mobile emulation did not consistently fire attachment download events; content and status were still validated.
- Clicked artifact citation `p.1` and verified TextViewer highlighted `Revenue is 42 in the synthetic structured workflow fixture.`
- Verified no horizontal overflow and 0 console errors on desktop/mobile.

Collection `Templates` workspace:

- Opened `/collections/{collection_id}` and selected `Templates`.
- Verified saved `QA Revenue Checklist`, `Ask every document the same questions`, and completed result `Revenue is 42`.
- Desktop used real download events for run Markdown/CSV.
- Mobile used same-origin fetch validation for run Markdown/CSV content.
- Created `QA Browser Follow-up`, verified `2 questions`, edited it to `QA Browser Follow-up Updated`.
- Clicked result citation `p.1` and verified popup URL pointed to `/d/{document_id}?page=1&highlight={chunk_id}`.
- Verified no horizontal overflow and 0 console errors on desktop/mobile.

## Finding And Fix

Initial mobile run found the first-visit cookie consent banner intercepted the Collection `Templates` tab at `390x844`.

Fix:

- Updated `frontend/src/components/CookieConsentBanner.tsx` so collection workspace pages use a larger mobile top offset while keeping the existing workspace and dialog-open behavior.
- Existing dialog-open hiding remains in place for modal flows.

Retest:

- Desktop and mobile passed after the fix.
- No blocking console errors.
- No horizontal overflow.

## Cleanup

The fixture cleanup deleted all synthetic QA rows. Independent counts returned:

```json
{
  "users": 0,
  "documents": 0,
  "qa_browser_structured_users": 0,
  "qa_browser_structured_documents": 0
}
```

## Validation

Commands run for this slice:

- `node --check .collab/scripts/qa_browser_structured_workflows_ux.js`
- `python3 -m py_compile .collab/scripts/qa_browser_structured_workflows_fixture.py`
- `cd backend && python3 -m ruff check app/ tests/ ../.collab/scripts/qa_browser_structured_workflows_fixture.py ../.collab/scripts/qa_structured_workflows_matrix.py`
- `cd frontend && npx tsc --noEmit --pretty false`
- `cd frontend && npm run build`
- `jq empty .collab/tasks/qa-browser-structured-workflows-fixture-2026-05-11.json .collab/tasks/qa-browser-structured-workflows-ux-after-consent-fix-2026-05-11.json .collab/tasks/qa-browser-structured-workflows-fixture-cleanup-2026-05-11.json`
- `git diff --check`
- `lsof -nP -iTCP:3000 -sTCP:LISTEN` and `lsof -nP -iTCP:8000 -sTCP:LISTEN` after shutdown both returned no listeners.

## Remaining Gap

This run proves deterministic browser UX for reachable structured-workflow surfaces. It does not prove live LLM answer quality for extraction/question-template outputs, table extraction from real user prompts, or any behavior of the orphaned `ExtractionPanel` component.
