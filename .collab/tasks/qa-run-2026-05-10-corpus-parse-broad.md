# QA Run - 2026-05-10 - Broad Corpus Parse

Scope: execute broad `test_inputs/` corpus upload/parse coverage using a temporary Pro QA user. This run focuses on ingestion completeness, structured parse failures, page/chunk counts, text-content availability, and parse timing. It does not exercise LLM chat quality.

## Environment

| Item | Result |
|---|---|
| Backend | Existing local `http://127.0.0.1:8000` healthy |
| Docker infra | Postgres, Redis, Qdrant, MinIO running |
| Celery | Existing `default,parse` worker processes running |
| Account | Temporary Pro QA user |
| Corpus tier | Broad |

## Artifacts

| Artifact | Purpose |
|---|---|
| `.collab/scripts/qa_corpus_parse_matrix.py` | Reusable broad/full corpus parse matrix. |
| `.collab/tasks/qa-corpus-parse-broad-2026-05-10.json` | Machine-readable broad corpus execution result. |

## Command Run

```bash
python3 .collab/scripts/qa_corpus_parse_matrix.py \
  --api-base http://127.0.0.1:8000 \
  --tier broad \
  --timeout 900 \
  --poll-interval 5 \
  --json-out .collab/tasks/qa-corpus-parse-broad-2026-05-10.json
```

## Results

Overall: **Pass with one typed parse error**.

| Metric | Value |
|---|---:|
| Files attempted | 18 |
| Ready | 17 |
| Typed errors | 1 |
| Untyped failures / timeouts | 0 |
| Total observed ready seconds | 158.455 |
| Slowest ready file | 35.296s |

Per-file outcome:

| File | Outcome | Pages | Chunks | Ready Seconds / Error |
|---|---|---:|---:|---|
| `semiconductor.pdf` | ready | 2 | 12 | 5.064s |
| `0206 The Flow Show.pdf` | ready | 14 | 42 | 5.086s |
| `1.Top of Mind_ Europe’s shifting security landscape.pdf` | ready | 31 | 105 | 5.646s |
| `2.China Musings_ Global marketing feedback_ China is back.pdf` | ready | 20 | 33 | 5.065s |
| `4.Alibaba Group (BABA)_ Addressing key debates on Alibaba Cloud capex targets and outlook; Buy.pdf` | ready | 32 | 38 | 5.127s |
| `Global Technology_ Semiconductors - Memory_ Global Memory S_D update and BOM cost analysis_ Expect further tightness across D....pdf` | ready | 28 | 33 | 5.101s |
| `Forecasting the Economic Effects of AI (03-2026).pdf` | ready | 224 | 164 | 10.183s |
| `ssrn-3247865.pdf` | ready | 361 | 581 | 15.109s |
| `Citrini Research _ Substack.pdf` | ready | 44 | 60 | 5.342s |
| `Frontier_AI_Strategic_Outlook.pdf` | ready | 15 | 19 | 15.291s |
| `THE 2028 GLOBAL INTELLIGENCE CRISIS.PDF` | typed error | 1 | 0 | `ERR_CODE:OCR_INSUFFICIENT_TEXT` |
| `GS 资金流.PDF` | ready | 1 | 16 | 20.298s |
| `Goldman's Commodity Desk Lays Out The Oil Price Scenarios From Iran War.PDF` | ready | 1 | 24 | 35.296s |
| `Claude Code 源码架构深度分析.pdf` | ready | 6 | 9 | 5.098s |
| `盘中解读.pdf` | ready | 12 | 13 | 5.113s |
| `【GMF Research】为什么难以回到稀缺准备金框架 兼论Kevin Warsh.pdf` | ready | 49 | 29 | 5.164s |
| `关于四川大学王竹卿一系列违法违规行为.pdf` | ready | 90 | 68 | 5.418s |
| `Frisst KI SaaS? Machtverschiebung von „Software-Tool“ zu „Aufgaben-Ausführung“.pdf` | ready | 12 | 26 | 5.054s |

Cleanup:
- QA user and owned docs were deleted automatically.
- Verification query returned `qa_corpus_users=0`, `qa_corpus_docs=0`.

Warnings observed:
- `urllib3` LibreSSL warning from local Python.
- Qdrant client/server minor version mismatch warning: client `1.16.1`, server `1.14.1`.

## Coverage Added

This run covers:
- 18-file broad subset from `test_inputs/`.
- CJK filenames and CJK content.
- Uppercase `.PDF` extensions.
- Encrypted/permission-edge PDFs.
- Large Plus-tier files over the Free limit.
- Long PDFs: 224 and 361 pages.
- Image/scanned-like 1-page PDFs that trigger OCR fallback.
- German filename/content.
- Text-content availability for ready PDFs.

## Finding

`THE 2028 GLOBAL INTELLIGENCE CRISIS.PDF` did not parse to ready, but failed with a structured typed error:

`ERR_CODE:OCR_INSUFFICIENT_TEXT:OCR could not extract sufficient text`

This is acceptable as a typed failure for a broad parse run, but the browser UX for this error still needs verification.

## Not Covered

- Full 50-PDF corpus soak remains incomplete.
- Browser upload/error UI was not exercised in this slice.
- RAG answer quality, citations, and chat latency were not exercised because local `DEEPSEEK_API_KEY` is absent.
