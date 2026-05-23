# QA Run - Multi-Format Extraction Matrix - 2026-05-11

Scope: verify DocTalk's non-PDF document extraction path for generated DOCX, PPTX, XLSX, TXT, and Markdown fixtures without mutating `test_inputs/`.

## Environment

| Item | Value |
|---|---|
| Backend runtime | Local Python imports, no server required |
| Fixtures | Generated in memory by the harness |
| Harness | `.collab/scripts/qa_multiformat_extraction_matrix.py` |
| Evidence | `.collab/tasks/qa-multiformat-extraction-matrix-2026-05-11.json` |

## Result

Pass.

The matrix covers:

- format-specific extraction via `app.services.extractors.base.extract_document`
- chunking compatibility via `ParseService.chunk_document`
- Markdown table preservation via `parse_markdown_tables`
- upload content validation for valid and invalid OOXML/text inputs

## Cases

| Case | Format | Pages | Chunks | Tables | Key assertions |
|---|---:|---:|---:|---:|---|
| `docx_paragraphs_table_cjk` | DOCX | 2 | 3 | 1 | heading detection, paragraph extraction, table markdown, CJK text |
| `pptx_slide_table_notes` | PPTX | 1 | 3 | 1 | slide title, text box, table markdown, speaker notes |
| `xlsx_multisheet_markdown_tables` | XLSX | 2 | 2 | 2 | each sheet as page, sheet titles, table markdown, CJK sheet |
| `txt_utf8_long_en_cjk` | TXT | 1 | 10 | 0 | UTF-8 English/CJK text and chunking |
| `md_headings_and_table` | MD | 2 | 3 | 1 | heading section titles, table markdown, CJK section |

Invalid/edge validation cases also passed:

- invalid DOCX magic bytes rejected
- DOCX-shaped ZIP without `[Content_Types].xml` rejected
- invalid PPTX magic bytes rejected
- TXT and MD without magic bytes accepted as expected

## Validation

Post-run checks passed:

- `python3 -m py_compile .collab/scripts/qa_multiformat_extraction_matrix.py`
- `jq empty .collab/tasks/qa-multiformat-extraction-matrix-2026-05-11.json`
- `cd backend && python3 -m ruff check app/ tests/ ../.collab/scripts/qa_multiformat_extraction_matrix.py`
- `git diff --check`

## Remaining Gap

This verifies the non-PDF extractor/chunking/upload-validation layer. It does not replace a full API `upload -> parse ready -> chat -> citation jump` test for non-PDF documents because local parse readiness still depends on the embedding/Qdrant worker path and provider secrets. That end-to-end browser/API path remains open.
