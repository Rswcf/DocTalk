# QA Run - Live RAG Non-PDF Plan - 2026-05-11

Scope: add a reusable live RAG matrix for non-PDF documents so DOCX, PPTX, XLSX, TXT, and Markdown can be tested through upload, parse, chat, citations, messages API persistence, and cleanup when the backend has normal LLM configuration.

## Environment

| Item | Value |
|---|---|
| Backend | Not contacted in plan-only mode |
| Frontend | Not required |
| Fixture source | `.collab/scripts/qa_multiformat_extraction_matrix.py` |
| Harness | `.collab/scripts/qa_live_rag_nonpdf_matrix.py` |
| Evidence | `.collab/tasks/qa-live-rag-nonpdf-plan-2026-05-11.json` |

No LLM provider key was used, echoed, or written for this plan-only run.

## Commands

```bash
python3 -m py_compile .collab/scripts/qa_live_rag_nonpdf_matrix.py

python3 .collab/scripts/qa_live_rag_nonpdf_matrix.py \
  --plan-only \
  --json-out .collab/tasks/qa-live-rag-nonpdf-plan-2026-05-11.json
```

## Result

Plan-only status:

- `5` generated non-PDF fixture cases.
- `24` prompt executions.
- `19` prompts require citations.
- `5` negative/unanswerable prompts verify the answer layer does not invent unsupported private-address facts.
- File types covered: `docx`, `pptx`, `xlsx`, `txt`, `md`.

Fixture cases:

| Case | File Type | Filename | Prompts |
|---|---|---|---:|
| `docx-docx-paragraphs-table-cjk` | DOCX | `qa-risk-memo.docx` | 5 |
| `pptx-pptx-slide-table-notes` | PPTX | `qa-launch-readiness.pptx` | 5 |
| `xlsx-xlsx-multisheet-markdown-tables` | XLSX | `qa-revenue.xlsx` | 5 |
| `txt-txt-utf8-long-en-cjk` | TXT | `qa-notes.txt` | 4 |
| `md-md-headings-and-table` | Markdown | `qa-plan.md` | 5 |

Prompt families:

| Prompt | Count | Purpose |
|---|---:|---|
| `summary_cited` | 5 | Grounded non-PDF summary with citations |
| `specific_terms_cited` | 5 | Ask about known fixture-specific terms with citations |
| `table_or_structure_cited` | 4 | Validate table/slide/spreadsheet/Markdown structure grounding |
| `negative_unanswerable` | 5 | Refuse unsupported private-address facts |
| `cross_language_zh` | 5 | Chinese answer over non-PDF documents with citations |

## Execution Command When Backend Is Configured

```bash
python3 .collab/scripts/qa_live_rag_nonpdf_matrix.py \
  --json-out .collab/tasks/qa-live-rag-nonpdf-2026-05-11.json
```

The harness promotes its synthetic QA user to Pro locally so all five small generated documents can be uploaded by the same user. It classifies provider `LLM_ERROR` as `blocked`; use `--allow-blocked` only when recording an environment-blocked run.

## Current Status

This closes the missing harness/planning piece for non-PDF live RAG coverage. It does not prove non-PDF live answer quality yet. Completion still requires running the matrix against a backend with normal LLM secret configuration and triaging any failed or blocked prompts.
