# Production Demo RAG Prompt Matrix - 2026-05-11

Scope: production public demo live RAG quality checks across multiple prompt families without a local LLM key or authenticated account. This extends the earlier single-prompt production demo smoke with summary, specific-fact, and negative/unanswerable prompts.

## Environment

- Backend: `https://backend-production-a62e.up.railway.app`
- Source: public demo documents from `GET /api/documents/demo`
- Harness: `.collab/scripts/qa_production_demo_rag_prompt_matrix.py`
- Mode: `quick`
- Demo anonymous message limit: 5 messages per IP / 24 hours

## Command

```bash
python3 .collab/scripts/qa_production_demo_rag_prompt_matrix.py \
  --json-out .collab/tasks/qa-production-demo-rag-prompt-matrix-2026-05-11.json \
  --max-prompts 3
```

## Result

Functional result: **pass**.

```json
{
  "total_prompts": 3,
  "executed": 3,
  "passed": 3,
  "failed": 0,
  "blocked": 0
}
```

Evidence: `.collab/tasks/qa-production-demo-rag-prompt-matrix-2026-05-11.json`

## Coverage

| Prompt | Demo doc | Assertion focus | Result |
|---|---|---|---|
| `attention_summary_cited` | `attention-paper` | cited summary answer, expected attention/multi-head terms, SSE/citations/messages persistence | Pass |
| `alphabet_specific_cited` | `alphabet-earnings` | company/reporting-period specific fact, expected Alphabet/quarter terms, SSE/citations/messages persistence | Pass |
| `court_negative_unanswerable` | `court-filing` | negative/unanswerable private-address prompt, no invented street/address terms, SSE/messages persistence | Pass |

Each executed prompt verified:

- SSE returned HTTP 200 with no error event.
- A `done` event was present.
- Answer length was at least 80 characters.
- Expected terms or expected-any phrases appeared.
- Forbidden terms were absent for the negative prompt.
- Citation events and message-persisted citations appeared when required.
- Citation payload shape was valid.
- First citation chunks were readable through `/api/chunks/{chunk_id}`.
- Anonymous demo sessions created by the run were deleted with `204`.

Quota handling:

- The quota probe reported `demo_messages_used=2` before the run.
- The harness executed only the remaining 3 messages, staying inside the 5-message anonymous demo limit.

## Verifier Warnings

Two of the three prompts passed the harness functional checks but received built-in verifier warnings in the chat `done` payload:

- `attention_summary_cited`: `status=warn`, score `0.6`, reasons `uncited_claim_units` and `low_claim_source_overlap`.
- `alphabet_specific_cited`: `status=warn`, score `0.0`, reason `numeric_claim_source_mismatch`.

The third prompt, `court_negative_unanswerable`, had verifier `status=pass`, score `1.0`, and correctly stated that the judge's private home address was not provided.

Tracking quality note: `.collab/tasks/bug-2026-05-11-production-demo-rag-verifier-warnings.md`.

## Remaining Gap

This improves production public live RAG evidence, but it is not a substitute for authenticated private upload full-corpus live RAG scoring, non-PDF live RAG, or browser citation-jump checks from these exact production answers.
