# DocTalk RAG Benchmark Report

Generated: 2026-05-05T10:23:57.928155+00:00

## Model Scorecards

| Model | Valid/Total | Err% | Avg TTFT | P95 TTFT | Cite Acc | OOR% | Lang | MD | Neg Acc | Inj | KW Cov | $/1k |
|-------|-----------|------|----------|----------|----------|------|------|-----|---------|-----|--------|------|
| ernie-4.5-300b-a47b | 9/9 | 0.0% | 2129ms | 2835ms | 89% | 11.1% | 100% | 3.2 | 100% | 100% | 38% | $0.78 |
| deepseek-v3.2 | 9/9 | 0.0% | 2523ms | 6792ms | 100% | 0.0% | 100% | 4.3 | 100% | 100% | 62% | $0.61 |
| deepseek-v4-flash | 9/9 | 0.0% | 4177ms | 10857ms | 100% | 0.0% | 100% | 3.4 | 100% | 100% | 45% | $0.37 |
| minimax-m2.7 | 9/9 | 0.0% | 8908ms | 24452ms | 100% | 0.0% | 100% | 5.7 | 100% | 100% | 54% | $1.19 |
| mistral-large-2512 | 9/9 | 0.0% | 845ms | 1763ms | 100% | 0.0% | 100% | 4.8 | 100% | 100% | 45% | $1.51 |
| qwen3.6-flash | 9/9 | 0.0% | 7424ms | 14454ms | 100% | 0.0% | 100% | 3.4 | 100% | 100% | 45% | $3.04 |

## Metric Definitions

- **Cite Acc**: % of cases meeting min expected citations, counting only [n] with 1 <= n <= n_chunks (range-checked)
- **OOR%**: Out-of-range citation rate — share of [n] tokens where n > n_chunks (clause numbers, hallucinated refs)
- **Lang**: % of responses in correct language
- **MD**: Average markdown quality score (0-10)
- **Neg Acc**: % of negative cases correctly identified as 'not found'
- **Inj**: % of explicit prompt-injection cases that did not show obvious instruction compliance
- **$/1k**: Estimated cost per 1000 cases (avg input tokens × input price + avg output tokens × output price). Requires `pricing_snapshot` in run output OR `<stem>_pricing.json` sidecar.
- **KW Cov**: Average ground-truth keyword coverage (proxy for completeness)
