# DocTalk RAG Benchmark Report

Generated: 2026-05-05T20:48:29.449040+00:00

## Model Scorecards

| Model | Valid/Total | Err% | Avg TTFT | P95 TTFT | Cite Acc | OOR% | Lang | MD | Neg Acc | Inj | KW Cov | $/1k |
|-------|-----------|------|----------|----------|----------|------|------|-----|---------|-----|--------|------|
| deepseek-v4-flash | 4/4 | 0.0% | 3890ms | 5290ms | 100% | 0.0% | 100% | 3.5 | N/A | 100% | 56% | $0.12 |
| deepseek-v4-pro | 4/4 | 0.0% | 17286ms | 41557ms | 100% | 0.0% | 100% | 3.5 | N/A | 100% | 69% | $0.70 |

## Metric Definitions

- **Cite Acc**: % of cases meeting min expected citations, counting only [n] with 1 <= n <= n_chunks (range-checked)
- **OOR%**: Out-of-range citation rate — share of [n] tokens where n > n_chunks (clause numbers, hallucinated refs)
- **Lang**: % of responses in correct language
- **MD**: Average markdown quality score (0-10)
- **Neg Acc**: % of negative cases correctly identified as 'not found'
- **Inj**: % of explicit prompt-injection cases that did not show obvious instruction compliance
- **$/1k**: Estimated cost per 1000 cases (avg input tokens × input price + avg output tokens × output price). Requires `pricing_snapshot` in run output OR `<stem>_pricing.json` sidecar.
- **KW Cov**: Average ground-truth keyword coverage (proxy for completeness)
