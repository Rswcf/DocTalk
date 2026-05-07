# DocTalk RAG Benchmark Report

Generated: 2026-05-05T09:33:31.137126+00:00

## Model Scorecards

| Model | Valid/Total | Err% | Avg TTFT | P95 TTFT | Cite Acc | OOR% | Lang | MD | Neg Acc | Inj | KW Cov | $/1k |
|-------|-----------|------|----------|----------|----------|------|------|-----|---------|-----|--------|------|
| ernie-4.5-300b-a47b | 1/1 | 0.0% | 2502ms | 2502ms | 100% | 0.0% | 100% | 3.0 | N/A | N/A | 33% | $1.03 |
| deepseek-v3.2 | 1/1 | 0.0% | 1826ms | 1826ms | 100% | 0.0% | 100% | 3.0 | N/A | N/A | 100% | $0.76 |
| deepseek-v4-flash | 1/1 | 0.0% | 4170ms | 4170ms | 100% | 0.0% | 100% | 3.0 | N/A | N/A | 100% | $0.46 |
| deepseek-v4-pro | 1/1 | 0.0% | 6537ms | 6537ms | 100% | 0.0% | 100% | 3.0 | N/A | N/A | 100% | $1.48 |
| minimax-m2.7 | 1/1 | 0.0% | 1108ms | 1108ms | 100% | 0.0% | 100% | 3.0 | N/A | N/A | 100% | $1.20 |
| mistral-large-2512 | 1/1 | 0.0% | 887ms | 887ms | 100% | 0.0% | 100% | 3.0 | N/A | N/A | 100% | $1.88 |
| kimi-k2.5 | 1/1 | 0.0% | 14887ms | 14887ms | 100% | 0.0% | 100% | 3.0 | N/A | N/A | 100% | $1.87 |
| kimi-k2.6 | 1/1 | 0.0% | 5371ms | 5371ms | 100% | 0.0% | 100% | 3.0 | N/A | N/A | 100% | $3.06 |
| qwen3.5-plus-20260420 | 1/1 | 0.0% | 12999ms | 12999ms | 100% | 0.0% | 100% | 3.0 | N/A | N/A | 100% | $3.47 |
| qwen3.6-flash | 1/1 | 0.0% | 4238ms | 4238ms | 100% | 0.0% | 100% | 3.0 | N/A | N/A | 100% | $2.12 |
| qwen3.6-plus | 1/1 | 0.0% | 14824ms | 14824ms | 100% | 0.0% | 100% | 3.0 | N/A | N/A | 100% | $2.76 |
| step-3.5-flash | 1/1 | 0.0% | 68661ms | 68661ms | 100% | 0.0% | 100% | 3.0 | N/A | N/A | 100% | $0.39 |
| glm-5.1 | 1/1 | 0.0% | 31487ms | 31487ms | 100% | 0.0% | 100% | 3.0 | N/A | N/A | 100% | $4.18 |

## Metric Definitions

- **Cite Acc**: % of cases meeting min expected citations, counting only [n] with 1 <= n <= n_chunks (range-checked)
- **OOR%**: Out-of-range citation rate — share of [n] tokens where n > n_chunks (clause numbers, hallucinated refs)
- **Lang**: % of responses in correct language
- **MD**: Average markdown quality score (0-10)
- **Neg Acc**: % of negative cases correctly identified as 'not found'
- **Inj**: % of explicit prompt-injection cases that did not show obvious instruction compliance
- **$/1k**: Estimated cost per 1000 cases (avg input tokens × input price + avg output tokens × output price). Requires `pricing_snapshot` in run output OR `<stem>_pricing.json` sidecar.
- **KW Cov**: Average ground-truth keyword coverage (proxy for completeness)
