# Table Extraction Runtime Gap Closure

Date: 2026-05-11

## Objective

Close the previously documented runtime/integration gaps for the table extraction refactor:

- Run a real financial PDF + live LLM table reconstruction test.
- Run a real browser click test for `AI rebuild`.
- Run the Docker integration suite.

## Evidence checklist

| Requirement | Evidence |
|---|---|
| Plan the remaining runtime checks | This report plus the generated QA scripts and artifacts listed below. |
| Execute real financial PDF + live LLM reconstruction | `.collab/tasks/qa-live-table-reconstruction-financial-pdf-2026-05-11.json` |
| Use a real financial PDF source | `test_inputs/BERN_250901.pdf`, page 3 |
| Verify live LLM output quality | Live run produced `status=passed`, `rows=13`, `cols=13`, expected terms `AMEC`, `NAURA`, `2026E`, `2027E` present. |
| Execute real browser click on `AI rebuild` | `.collab/tasks/qa-browser-table-ai-rebuild-ux-2026-05-11-pass.json` |
| Verify browser POST/poll/update path | Browser report has `result=pass`, `post_seen=true`, `poll_count=1`, `summary_visible=true`, `after_ai_warning=true`, `warning_visible=true`, and no console errors. |
| Clean up browser fixture data | `.collab/tasks/qa-browser-table-ai-rebuild-cleanup-2026-05-11.json` |
| Run Docker integration suite without skipping | Temporary Postgres database was created and used with `SKIP_INTEGRATION=0`; result: `4 passed`, `338 deselected`, `0 skipped`. |
| Avoid destructive migration test on shared dev DB | Integration suite ran against a temporary DB recorded in `.collab/tasks/qa-docker-integration-db-2026-05-11.txt`, then dropped via shell trap. |
| Verify new QA scripts are syntactically valid | `python3 -m py_compile .collab/scripts/qa_live_table_reconstruction.py` and `node --check .collab/scripts/qa_browser_table_ai_rebuild_ux.js` passed. |
| Verify frontend production build after chat artifact changes | `cd frontend && npm run build` passed. |

## Fixes discovered during gap closure

The browser test revealed that the screenshot-visible path is the chat `table_export` artifact card, not only the side `ExtractionPanel`.

Additional frontend changes were made:

- Added `AI rebuild` to `frontend/src/components/Chat/ChatArtifactCard.tsx`.
- Reused the same `reconstructDocumentTable`, `getTableScanJob`, and `listDocumentTables` API helpers.
- Added post-click state transitions, table job polling, preview refresh, AI rebuilt warnings, and fallback preview update.
- Fixed a state-race bug where `setTableJob(succeeded)` triggered effect cleanup before table preview refresh completed.

## Runtime notes

- The in-app Browser tool was not exposed in this turn, so the browser test used the repository's Playwright setup as a fallback.
- The browser test used a real Next page, real Auth.js session cookie, real fixture data, and real click interaction. It mocked only the reconstruct job HTTP responses so the browser path could be tested deterministically; the live LLM service path is covered separately by the financial PDF test.
