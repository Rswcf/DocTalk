# DocTalk RAG Benchmark Report

Generated: 2026-05-05T09:58:20.767513+00:00

## Model Scorecards

| Model | Valid/Total | Err% | Avg TTFT | P95 TTFT | Cite Acc | OOR% | Lang | MD | Neg Acc | Inj | KW Cov | $/1k |
|-------|-----------|------|----------|----------|----------|------|------|-----|---------|-----|--------|------|
| ernie-4.5-300b-a47b | 9/9 | 0.0% | 2122ms | 2408ms | 100% | 0.0% | 100% | 3.9 | 100% | 100% | 38% | $0.79 |
| deepseek-v3.2 | 9/9 | 0.0% | 1965ms | 7885ms | 100% | 0.0% | 100% | 3.8 | 100% | 0% | 55% | $0.57 |
| deepseek-v4-flash | 9/9 | 0.0% | 2371ms | 5337ms | 100% | 0.0% | 100% | 3.4 | 100% | 0% | 47% | $0.33 |
| deepseek-v4-pro | 9/9 | 0.0% | 13907ms | 27504ms | 100% | 15.8% | 100% | 3.2 | 100% | 100% | 57% | $1.34 |
| minimax-m2.7 | 9/9 | 0.0% | 8897ms | 16140ms | 89% | 16.0% | 100% | 5.1 | 100% | 100% | 63% | $1.12 |
| mistral-large-2512 | 9/9 | 0.0% | 1134ms | 1922ms | 89% | 4.2% | 100% | 4.4 | 100% | 0% | 47% | $1.49 |
| kimi-k2.5 | 9/9 | 0.0% | 23832ms | 64725ms | 100% | 0.0% | 100% | 4.3 | 100% | 100% | 59% | $2.82 |
| kimi-k2.6 | 9/9 | 0.0% | 25578ms | 59889ms | 78% | 0.0% | 78% | 2.6 | 100% | 100% | 54% | $4.84 |
| qwen3.5-plus-20260420 | 4/9 | 55.6% | 20317ms | 27483ms | 100% | 0.0% | 100% | 3.5 | 100% | N/A | 50% | $4.46 |
| qwen3.6-flash | 9/9 | 0.0% | 6364ms | 8130ms | 100% | 0.0% | 100% | 3.4 | 100% | 100% | 45% | $2.68 |
| qwen3.6-plus | 9/9 | 0.0% | 23005ms | 35178ms | 100% | 0.0% | 100% | 3.4 | 100% | 100% | 49% | $3.36 |

## Metric Definitions

- **Cite Acc**: % of cases meeting min expected citations, counting only [n] with 1 <= n <= n_chunks (range-checked)
- **OOR%**: Out-of-range citation rate — share of [n] tokens where n > n_chunks (clause numbers, hallucinated refs)
- **Lang**: % of responses in correct language
- **MD**: Average markdown quality score (0-10)
- **Neg Acc**: % of negative cases correctly identified as 'not found'
- **Inj**: % of explicit prompt-injection cases that did not show obvious instruction compliance
- **$/1k**: Estimated cost per 1000 cases (avg input tokens × input price + avg output tokens × output price). Requires `pricing_snapshot` in run output OR `<stem>_pricing.json` sidecar.
- **KW Cov**: Average ground-truth keyword coverage (proxy for completeness)
