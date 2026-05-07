# DocTalk RAG Benchmark Report

Generated: 2026-05-05T10:05:38.747989+00:00

## Model Scorecards

| Model | Valid/Total | Err% | Avg TTFT | P95 TTFT | Cite Acc | OOR% | Lang | MD | Neg Acc | Inj | KW Cov | $/1k |
|-------|-----------|------|----------|----------|----------|------|------|-----|---------|-----|--------|------|
| ernie-4.5-300b-a47b | 6/6 | 0.0% | 2397ms | 2756ms | 100% | 0.0% | 100% | 1.3 | N/A | 100% | 72% | $0.68 |
| deepseek-v4-flash | 6/6 | 0.0% | 2968ms | 5801ms | 100% | 0.0% | 100% | 1.3 | N/A | 100% | 78% | $0.35 |
| deepseek-v4-pro | 6/6 | 0.0% | 7857ms | 13703ms | 100% | 0.0% | 100% | 1.0 | N/A | 83% | 47% | $1.19 |
| minimax-m2.7 | 6/6 | 0.0% | 8189ms | 18451ms | 100% | 50.0% | 100% | 3.0 | N/A | 83% | 47% | $1.08 |
| mistral-large-2512 | 6/6 | 0.0% | 612ms | 719ms | 100% | 0.0% | 100% | 3.5 | N/A | 83% | 58% | $1.52 |
| kimi-k2.6 | 6/6 | 0.0% | 18090ms | 48843ms | 100% | 0.0% | 100% | 2.3 | N/A | 100% | 50% | $4.82 |
| qwen3.6-flash | 6/6 | 0.0% | 6740ms | 14343ms | 100% | 0.0% | 100% | 1.3 | N/A | 100% | 47% | $2.64 |

## Metric Definitions

- **Cite Acc**: % of cases meeting min expected citations, counting only [n] with 1 <= n <= n_chunks (range-checked)
- **OOR%**: Out-of-range citation rate — share of [n] tokens where n > n_chunks (clause numbers, hallucinated refs)
- **Lang**: % of responses in correct language
- **MD**: Average markdown quality score (0-10)
- **Neg Acc**: % of negative cases correctly identified as 'not found'
- **Inj**: % of explicit prompt-injection cases that did not show obvious instruction compliance
- **$/1k**: Estimated cost per 1000 cases (avg input tokens × input price + avg output tokens × output price). Requires `pricing_snapshot` in run output OR `<stem>_pricing.json` sidecar.
- **KW Cov**: Average ground-truth keyword coverage (proxy for completeness)
