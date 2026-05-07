# DocTalk RAG Benchmark Report

Generated: 2026-05-05T10:08:27.633269+00:00

## Model Scorecards

| Model | Valid/Total | Err% | Avg TTFT | P95 TTFT | Cite Acc | OOR% | Lang | MD | Neg Acc | Inj | KW Cov | $/1k |
|-------|-----------|------|----------|----------|----------|------|------|-----|---------|-----|--------|------|
| deepseek-v3.2 | 5/5 | 0.0% | 2219ms | 2395ms | 100% | 0.0% | 100% | 0.0 | N/A | 0% | 0% | N/A |
| deepseek-v4-flash | 5/5 | 0.0% | 6072ms | 15455ms | 100% | 0.0% | 100% | 0.6 | N/A | 60% | 60% | N/A |
| mistral-large-2512 | 5/5 | 0.0% | 582ms | 654ms | 100% | 0.0% | 100% | 1.0 | N/A | 100% | 50% | N/A |

## Metric Definitions

- **Cite Acc**: % of cases meeting min expected citations, counting only [n] with 1 <= n <= n_chunks (range-checked)
- **OOR%**: Out-of-range citation rate — share of [n] tokens where n > n_chunks (clause numbers, hallucinated refs)
- **Lang**: % of responses in correct language
- **MD**: Average markdown quality score (0-10)
- **Neg Acc**: % of negative cases correctly identified as 'not found'
- **Inj**: % of explicit prompt-injection cases that did not show obvious instruction compliance
- **$/1k**: Estimated cost per 1000 cases (avg input tokens × input price + avg output tokens × output price). Requires `pricing_snapshot` in run output OR `<stem>_pricing.json` sidecar.
- **KW Cov**: Average ground-truth keyword coverage (proxy for completeness)
