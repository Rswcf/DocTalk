# BUG-2026-05-11-ACADEMIC-SUMMARY-MISROUTES-TO-EVIDENCE-TABLE

Status: **fixed and retested locally**

## Summary

Live RAG over `test_inputs/ssrn-3247865.pdf` misrouted an ordinary academic-paper summary question into the structured extraction tool path.

Prompt:

```text
What is the central argument or subject of this academic paper? Answer concisely and cite the source.
```

Instead of a cited answer, chat emitted `tool_status` and `artifact` events and returned:

```text
I started Legal / Academic Evidence Table. I will keep the result here with citations when it is ready.
```

No citation events were emitted.

## Severity

P1 for document-chat trust.

Long academic PDFs are a must-cover use case. A normal question containing the phrase "academic paper" should stay on the RAG answer path unless the user explicitly asks for an evidence table, extraction, checklist, or other deliverable.

## Evidence

Failing run:

- `.collab/tasks/qa-live-rag-corpus-sample-ssrn-long-academic-2026-05-11.json` before fix

Observed failure shape:

- Events: `tool_status`, `artifact`, `token`, `done`
- Answer chars: `103`
- Citations: `0`
- Harness quality score: `0.4`
- Assistant metadata action: `extract_deliverable` / `evidence_table`

## Root Cause

`backend/app/services/action_planner.py` treated the generic word `academic` as an Evidence Table marker. The deterministic planner routed any matching evidence/legal/academic term to `EXTRACT_DELIVERABLE` without requiring a deliverable intent such as `generate`, `extract`, `list`, or `table`.

## Fix

The Evidence Table branch now requires both:

- an evidence/legal/academic marker, and
- an explicit deliverable intent.

This keeps ordinary academic/legal questions on the RAG answer path while preserving explicit requests such as "Generate an academic evidence table with cited claims."

## Regression Coverage

Added tests in `backend/tests/test_action_planner.py`:

- `test_planner_keeps_plain_academic_paper_question_on_rag_path`
- `test_planner_routes_explicit_evidence_table_deliverable`

Commands:

```bash
cd backend && python3 -m pytest tests/test_action_planner.py -v
python3 .collab/scripts/qa_live_rag_corpus_sample.py \
  --api-base http://127.0.0.1:8000 \
  --case ssrn-long-academic \
  --json-out .collab/tasks/qa-live-rag-corpus-sample-ssrn-retake-after-planner-fix-2026-05-11.json
python3 .collab/scripts/qa_live_rag_corpus_sample.py \
  --api-base http://127.0.0.1:8000 \
  --json-out .collab/tasks/qa-live-rag-corpus-sample-after-harness-fix-2026-05-11.json
```

Results:

- Action planner tests: `9 passed`
- SSRN retake after planner fix: pass, answer chars `326`, citations `2`
- Full 5-case private corpus retest after planner and harness fixes: pass, `5/5`

## QA Harness Note

The first full retest after the planner fix returned a valid SSRN answer with citations and verifier score `1.0`, but failed the harness because the expected term was the brittle word `paper`. The harness was corrected to expect the document's actual subject term, `trading`.
