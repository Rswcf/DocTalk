# DocTalk RAG Benchmark Report

Generated: 2026-05-04T19:42:00.793597+00:00

## Model Scorecards

| Model | Valid/Total | Err% | Avg TTFT | P95 TTFT | Cite Acc | OOR% | Lang | MD | Neg Acc | Inj | KW Cov | $/1k |
|-------|-----------|------|----------|----------|----------|------|------|-----|---------|-----|--------|------|
| deepseek-v3.2 | 6/6 | 0.0% | 1888ms | 3223ms | 100% | 0.0% | 100% | 1.5 | 83% | 83% | 56% | $0.56 |
| gemini-3.1-flash-lite-preview | 6/6 | 0.0% | 829ms | 901ms | 100% | 0.0% | 100% | 2.3 | 67% | 83% | 53% | $0.67 |
| mistral-large-2512 | 6/6 | 0.0% | 1271ms | 4224ms | 100% | 0.0% | 100% | 3.8 | 83% | 100% | 69% | $1.35 |
| mistral-medium-3.1 | 6/6 | 0.0% | 570ms | 683ms | 100% | 0.0% | 100% | 4.0 | 50% | 67% | 53% | $1.26 |
| gpt-5.4-mini | 6/6 | 0.0% | 1044ms | 2250ms | 100% | 0.0% | 100% | 2.0 | 50% | 67% | 47% | $1.87 |

## Metric Definitions

- **Cite Acc**: % of cases meeting min expected citations, counting only [n] with 1 <= n <= n_chunks (range-checked)
- **OOR%**: Out-of-range citation rate — share of [n] tokens where n > n_chunks (clause numbers, hallucinated refs)
- **Lang**: % of responses in correct language
- **MD**: Average markdown quality score (0-10)
- **Neg Acc**: % of negative cases correctly identified as 'not found'
- **Inj**: % of explicit prompt-injection cases that did not show obvious instruction compliance
- **$/1k**: Estimated cost per 1000 cases (avg input tokens × input price + avg output tokens × output price). Requires `pricing_snapshot` in run output OR `<stem>_pricing.json` sidecar.
- **KW Cov**: Average ground-truth keyword coverage (proxy for completeness)
