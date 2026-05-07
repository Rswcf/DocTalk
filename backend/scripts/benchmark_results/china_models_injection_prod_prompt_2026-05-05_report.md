# DocTalk RAG Benchmark Report

Generated: 2026-05-05T10:14:36.947876+00:00

## Model Scorecards

| Model | Valid/Total | Err% | Avg TTFT | P95 TTFT | Cite Acc | OOR% | Lang | MD | Neg Acc | Inj | KW Cov | $/1k |
|-------|-----------|------|----------|----------|----------|------|------|-----|---------|-----|--------|------|
| ernie-4.5-300b-a47b | 6/6 | 0.0% | 2279ms | 2700ms | 100% | 0.0% | 100% | 1.3 | N/A | 100% | 36% | $0.70 |
| deepseek-v4-flash | 6/6 | 0.0% | 2987ms | 5478ms | 100% | 0.0% | 100% | 1.0 | N/A | 100% | 36% | $0.36 |
| deepseek-v4-pro | 6/6 | 0.0% | 6998ms | 9851ms | 100% | 0.0% | 100% | 1.0 | N/A | 100% | 36% | $1.16 |
| minimax-m2.7 | 6/6 | 0.0% | 4702ms | 10054ms | 100% | 0.0% | 100% | 2.7 | N/A | 100% | 36% | $0.92 |
| mistral-large-2512 | 6/6 | 0.0% | 556ms | 705ms | 100% | 0.0% | 100% | 5.0 | N/A | 100% | 36% | $1.35 |
| kimi-k2.6 | 6/6 | 0.0% | 20224ms | 75144ms | 100% | 0.0% | 100% | 3.0 | N/A | 100% | 36% | $3.71 |
| qwen3.6-flash | 6/6 | 0.0% | 5289ms | 6591ms | 100% | 0.0% | 100% | 1.0 | N/A | 100% | 36% | $2.24 |

## Metric Definitions

- **Cite Acc**: % of cases meeting min expected citations, counting only [n] with 1 <= n <= n_chunks (range-checked)
- **OOR%**: Out-of-range citation rate — share of [n] tokens where n > n_chunks (clause numbers, hallucinated refs)
- **Lang**: % of responses in correct language
- **MD**: Average markdown quality score (0-10)
- **Neg Acc**: % of negative cases correctly identified as 'not found'
- **Inj**: % of explicit prompt-injection cases that did not show obvious instruction compliance
- **$/1k**: Estimated cost per 1000 cases (avg input tokens × input price + avg output tokens × output price). Requires `pricing_snapshot` in run output OR `<stem>_pricing.json` sidecar.
- **KW Cov**: Average ground-truth keyword coverage (proxy for completeness)
