# DocTalk Chat-Native Document Intelligence Execution Ledger

## Objective

Move DocTalk from multiple visible workbench entrances to a single chat-native
document intelligence system. Users ask naturally in chat; backend planning and
tool execution decide whether to answer with RAG, launch an async deliverable,
scan/export tables, guide template creation, clarify comparison inputs, or look
up citations.

## Release Sequence

| Milestone | Version | Scope | Status | Commit | Verification |
|---|---|---|---|---|---|
| M1 | 0.15.0 beta | Chat-native tool routing, artifact cards, hidden Brief/Extract tabs | Released to production and tagged | `7a1546a` / `v0.15.0-beta` | Version check, frontend build, ruff, parse tests, new feature tests, backend non-integration suite, browser UI check, Railway `/version` + `/health` passed |
| M2 | 0.16.0 beta | Azure Document Intelligence layout/table provider with PyMuPDF fallback | Released to production and tagged | `a2ba679` / `v0.16.0-beta` | Version check, ruff, parse tests, new provider/table/job tests, backend non-integration suite, frontend build, Alembic upgrade, desktop/mobile browser smoke, Railway `/version` + `/health` passed |
| M3 | 0.17.0 beta | Canonical document elements and element-aware retrieval | Release gate passed; git release pending | TBD | Version check, diff check, ruff, parse tests, new element/workflow tests, backend non-integration suite, frontend build, Alembic upgrade passed |

## Execution Rules

- Finish one milestone before starting the next.
- For each milestone: inspect affected code, implement the smallest complete
  vertical slice, add tests, update docs/version, run required gates, commit on
  `main`, push `main`, merge/push `stable`, deploy Railway if backend changed,
  verify `/health` and `/version`, then tag `v0.x.0-beta`.
- Do not stage unrelated files. If the tree is dirty from unrelated work, work
  around it instead of reverting it.
- Any code/test/build failure is a code issue to fix before release; only
  external outages such as GitHub, Railway, missing secrets, or unavailable
  production endpoints may pause the loop.

## M1 Checklist

- [x] Hide reader `Brief` / `Extract` primary tabs and keep Chat as the only
  visible workspace.
- [x] Add `ActionPlanner` with deterministic and optional LLM-backed routing.
- [x] Add `ChatToolExecutor` that reuses existing document jobs without
  bypassing access control, plan gates, quotas, or credits.
- [x] Persist assistant artifacts in `messages.metadata_json`.
- [x] Add `artifact` and `tool_status` SSE handling.
- [x] Add chat artifact cards with polling, previews, downloads, and citation
  actions.
- [x] Add unified document job status API.
- [x] Add combined document-table CSV export endpoint.
- [x] Add backend tests for planner, executor, job artifacts, and CSV export.
- [x] Run full release gate.
- [x] Commit/push `main`, merge/push `stable`, deploy, verify, tag.

## M2 Checklist

- [x] Add Azure Document Intelligence provider abstraction with lazy SDK import.
- [x] Add `document_layout_runs` add-only migration and model.
- [x] Record provider status, raw layout storage key, page/table counts, and
  fallback errors.
- [x] Store Azure table rows, cell regions, headers, merged cells, and provider
  metadata inside `document_tables.cells`.
- [x] Fall back to PyMuPDF when Azure is not configured or fails.
- [x] Keep markdown table extraction for non-PDF documents.
- [x] Surface provider/fallback warnings through chat artifact polling.
- [x] Add focused backend tests for provider mapping, fallback, layout run
  recording, continued-table merging, and CSV escaping.
- [x] Run full release gate.
- [ ] Commit/push `main`, merge/push `stable`, deploy, verify, tag.

## Notes

- M1 intentionally does not improve table extraction quality. It makes the UX
  chat-native while reusing the existing table/extraction/template/diff
  foundations.
- M2 owns provider quality. Azure AI Document Intelligence is the default target
  provider; PyMuPDF remains the safe fallback when cloud credentials are absent
  or provider calls fail.
- M3 owns retrieval quality. Chunk RAG remains for local text Q&A; tables,
  all-document extraction, and semantic diff should move to canonical elements.

## M3 Checklist

- [x] Add `document_elements` model and add-only migration.
- [x] Generate heading/paragraph elements during parse.
- [x] Generate table elements during table scan, linked to `document_tables`.
- [x] Add element-aware context selection service.
- [x] Use element-aware coverage for summaries, structured extraction, document
  diff, and table-aware retrieval fallback.
- [x] Add focused unit tests for element generation, context selection, table
  elements, extraction/diff context, and table fallback.
- [x] Run full release gate.
- [ ] Commit/push `main`, merge/push `stable`, deploy, verify, tag.
