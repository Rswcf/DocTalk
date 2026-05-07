# DocTalk RAG Benchmark Report

Generated: 2026-05-05T10:51:33.444080+00:00

## Model Scorecards

| Model | Valid/Total | Err% | Avg TTFT | P95 TTFT | Cite Acc | OOR% | Lang | MD | Neg Acc | Inj | KW Cov | $/1k |
|-------|-----------|------|----------|----------|----------|------|------|-----|---------|-----|--------|------|
| deepseek-v3.2 | 9/9 | 0.0% | 4260ms | 8145ms | 100% | 0.0% | 100% | 3.8 | 100% | 100% | 51% | $0.60 |
| deepseek-v4-flash | 9/9 | 0.0% | 3545ms | 9585ms | 100% | 0.0% | 89% | 4.0 | 100% | 100% | 37% | $0.38 |
| deepseek-v4-pro | 9/9 | 0.0% | 14230ms | 41485ms | 89% | 0.0% | 100% | 3.4 | 100% | 100% | 54% | $1.40 |
| mistral-large-2512 | 9/9 | 0.0% | 620ms | 682ms | 100% | 0.0% | 100% | 4.6 | 100% | 100% | 48% | $1.50 |

## Metric Definitions

- **Cite Acc**: % of cases meeting min expected citations, counting only [n] with 1 <= n <= n_chunks (range-checked)
- **OOR%**: Out-of-range citation rate — share of [n] tokens where n > n_chunks (clause numbers, hallucinated refs)
- **Lang**: % of responses in correct language
- **MD**: Average markdown quality score (0-10)
- **Neg Acc**: % of negative cases correctly identified as 'not found'
- **Inj**: % of explicit prompt-injection cases that did not show obvious instruction compliance
- **$/1k**: Estimated cost per 1000 cases (avg input tokens × input price + avg output tokens × output price). Requires `pricing_snapshot` in run output OR `<stem>_pricing.json` sidecar.
- **KW Cov**: Average ground-truth keyword coverage (proxy for completeness)
