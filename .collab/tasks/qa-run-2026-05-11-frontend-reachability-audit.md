# QA Run - 2026-05-11 - Frontend Structured Workflow Reachability Audit

## Scope

Static frontend reachability audit for structured-workflow UI surfaces, especially whether `ExtractionPanel` should still receive browser QA coverage.

This audit answers:

- Is `frontend/src/components/Extraction/ExtractionPanel.tsx` mounted anywhere reachable?
- Are current structured-workflow surfaces reachable elsewhere?
- Do product/architecture docs describe the old Extract workspace as retired?

## Artifacts

| Type | Path |
|---|---|
| Harness | `.collab/scripts/qa_frontend_reachability_audit.js` |
| Evidence | `.collab/tasks/qa-frontend-reachability-audit-2026-05-11.json` |

## Result

Pass: `8/8` checks.

```json
{
  "files_scanned": 248,
  "summary": {
    "total": 8,
    "passed": 8,
    "failed": 0
  },
  "result": "pass"
}
```

## Findings

### Retired / Unmounted Surface

`frontend/src/components/Extraction/ExtractionPanel.tsx` exists but is not imported or mounted by any other frontend TS/TSX file.

Checks:

- `extraction_panel_file_exists`: pass
- `extraction_panel_has_no_external_imports`: pass
- `extraction_panel_has_no_external_jsx_mount`: pass

### Reachable Active Surfaces

Current user-facing structured workflows are reachable through:

- Chat artifact cards: `frontend/src/components/Chat/ChatArtifactCard.tsx` rendered by `MessageBubble` from `message.artifacts`.
- Collection question templates: `QuestionTemplatesPanel` mounted by `frontend/src/app/collections/[collectionId]/page.tsx`.

Checks:

- `question_templates_reachable_from_collection_page`: pass
- `reader_uses_chat_panel_not_extraction_panel`: pass
- `chat_artifact_cards_reachable_from_messages`: pass
- `question_templates_panel_file_exists`: pass

### Product Direction

Docs confirm the old Extract workspace is retired:

- `docs/ARCHITECTURE.zh.md` says the document reader no longer shows Brief/Extract main tabs and routes structured extraction, table export, templates, and comparison through chat artifact cards.
- `docs/research/feature-roadmap.md` lists Chat-Native Tool Routing as shipped with hidden Brief/Extract tabs.

Check:

- `architecture_documents_retired_extract_workspace`: pass

## QA Decision

The old `ExtractionPanel` should not be treated as a user-facing page/function for browser QA coverage unless it is reattached to a route. Current structured workflow QA should continue to target:

- chat-native artifact cards in the document reader
- Collection `Templates`
- API/worker contracts for extraction, table scan/export, and question-template runs
- live LLM quality for structured output content

## Residual Risk

The orphaned component is dead code risk: it can drift, confuse future testers, and retain outdated UI assumptions. Recommended product/engineering follow-up is to remove it or add an explicit code comment/deprecation note, but this is no longer a blocker for the `/goal` browser coverage checklist.

## Validation

Commands run:

- `node .collab/scripts/qa_frontend_reachability_audit.js --json-out=.collab/tasks/qa-frontend-reachability-audit-2026-05-11.json`
- `node --check .collab/scripts/qa_frontend_reachability_audit.js`
- `jq empty .collab/tasks/qa-frontend-reachability-audit-2026-05-11.json`
- `git diff --check`
