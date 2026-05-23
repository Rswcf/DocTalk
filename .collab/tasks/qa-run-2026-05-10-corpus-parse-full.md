# QA Run - 2026-05-10 - Full Corpus Parse

Scope: execute the full supported `test_inputs/` PDF corpus upload/parse soak using a temporary Pro QA user. This validates ingestion durability across the complete current PDF corpus, including large files, CJK filenames, uppercase extensions, long filenames, one-page OCR-heavy PDFs, and long academic/research PDFs. It does not exercise LLM chat quality.

## Environment

| Item | Result |
|---|---|
| Backend | Existing local `http://127.0.0.1:8000` healthy |
| Docker infra | Postgres, Redis, Qdrant, MinIO running |
| Celery | Existing `default,parse` worker processes running |
| Account | Temporary Pro QA user |
| Corpus tier | Full supported PDF corpus |

## Artifacts

| Artifact | Purpose |
|---|---|
| `.collab/scripts/qa_corpus_parse_matrix.py` | Reusable broad/full corpus parse matrix. |
| `.collab/tasks/qa-corpus-parse-full-2026-05-10.json` | Machine-readable full corpus execution result. |

## Command Run

```bash
python3 .collab/scripts/qa_corpus_parse_matrix.py \
  --tier full \
  --timeout 900 \
  --poll-interval 5 \
  --json-out .collab/tasks/qa-corpus-parse-full-2026-05-10.json
```

## Results

Overall: **Pass with one typed parse error**.

| Metric | Value |
|---|---:|
| Files attempted | 50 |
| Ready | 49 |
| Typed errors | 1 |
| Untyped failures / timeouts | 0 |
| Total corpus size | 206.575 MB |
| Expected pages | 1430 |
| Ready pages parsed | 1429 |
| Ready chunks indexed | 2639 |
| Total observed ready seconds | 322.552 |
| Median ready seconds | 5.103 |
| P75 ready seconds | 5.163 |
| P90 ready seconds | 5.657 |
| P95 ready seconds | 15.294 |
| Slowest ready file | 35.317s |

Slowest ready files:

| File | Ready Seconds | Pages | Size MB |
|---|---:|---:|---:|
| `Goldman's Commodity Desk Lays Out The Oil Price Scenarios From Iran War.PDF` | 35.317 | 1 | 8.857 |
| `GS 资金流.PDF` | 20.312 | 1 | 12.273 |
| `Frontier_AI_Strategic_Outlook.pdf` | 15.294 | 15 | 16.627 |
| `ssrn-3247865.pdf` | 15.163 | 361 | 1.599 |
| `Forecasting the Economic Effects of AI (03-2026).pdf` | 10.206 | 224 | 8.542 |
| `AI for nuclear energy Powering an intelligent, resilient future - Microsoft Industry Blogs.pdf` | 5.657 | 1 | 4.391 |
| `1.Top of Mind_ Europe’s shifting security landscape.pdf` | 5.649 | 31 | 3.999 |
| `关于四川大学王竹卿一系列违法违规行为.pdf` | 5.416 | 90 | 32.731 |
| `Citrini Research _ Substack.pdf` | 5.392 | 44 | 30.136 |
| `Global Technology_ Semiconductors - Memory_ Global Memory S_D update and BOM cost analysis_ Expect further tightness across D....pdf` | 5.218 | 28 | 1.043 |

Typed parse error:

| File | Outcome | Error |
|---|---|---|
| `THE 2028 GLOBAL INTELLIGENCE CRISIS.PDF` | typed error | `ERR_CODE:OCR_INSUFFICIENT_TEXT:OCR could not extract sufficient text` |

Cleanup:
- QA user and owned docs were deleted automatically.
- Verification query returned `qa_corpus_users=0`, `qa_corpus_documents=0`.

Warnings observed:
- `urllib3` LibreSSL warning from local Python.
- Qdrant client/server minor version mismatch warning: client `1.16.1`, server `1.14.1`.

## Coverage Added

This run covers:
- All 50 supported PDF files currently inventoried from `test_inputs/`.
- Full corpus storage, parse worker, OCR fallback, embedding/indexing, status polling, and cleanup path.
- CJK, English, German, mixed-language, long filename, punctuation-heavy filename, uppercase `.PDF`, large PDF, one-page image-like PDF, and long-document parsing cases.

## Finding

The only non-ready file was the same OCR-insufficient sample observed in the broad run:

`THE 2028 GLOBAL INTELLIGENCE CRISIS.PDF`

The backend returned a structured typed parse error instead of timing out or silently failing. Browser UX for this error still needs verification.

## Not Covered

- Browser upload/error UI was not exercised in this slice.
- RAG answer quality, citations, chat latency, and citation jump were not exercised because local `DEEPSEEK_API_KEY` is absent.
- Non-PDF format conversion coverage cannot be inferred from this corpus because the current `test_inputs/` inventory is PDF-heavy with one HTML file.
