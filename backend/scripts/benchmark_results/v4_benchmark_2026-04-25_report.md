# DocTalk RAG Benchmark Report

Generated: 2026-04-25T00:25:48.483780+00:00

## Model Scorecards

| Model | Valid/Total | Err% | Avg TTFT | P95 TTFT | Cite Acc | OOR% | Lang | MD | Neg Acc | KW Cov | $/1k |
|-------|-----------|------|----------|----------|----------|------|------|-----|---------|--------|------|
| deepseek-v3.2 [prod-quick] | 48/48 | 0.0% | 2843ms | 7685ms | 98% | 0.0% | 98% | 4.5 | 100% | 76% | $0.66 |
| deepseek-v4-flash [no-think] | 48/48 | 0.0% | 6002ms | 17080ms | 94% | 5.5% | 67% | 4.0 | 88% | 51% | $0.44 |
| deepseek-v4-flash [think:low] | 48/48 | 0.0% | 6916ms | 16731ms | 100% | 1.9% | 77% | 3.9 | 100% | 57% | $0.47 |
| deepseek-v4-pro [no-think] | 47/48 | 2.1% | 1778ms | 2827ms | 94% | 4.3% | 100% | 4.1 | 100% | 71% | $4.43 |
| deepseek-v4-pro [think:medium] | 48/48 | 0.0% | 17271ms | 69407ms | 100% | 1.0% | 100% | 3.8 | 100% | 68% | $6.71 |
| mistral-large-2512 [prod-thorough] | 48/48 | 0.0% | 611ms | 941ms | 98% | 10.9% | 100% | 5.0 | 88% | 72% | $1.76 |
| mistral-medium-3.1 [prod-balanced] | 48/48 | 0.0% | 665ms | 1237ms | 98% | 8.1% | 100% | 5.9 | 88% | 75% | $1.90 |

## Metric Definitions

- **Cite Acc**: % of cases meeting min expected citations, counting only [n] with 1 <= n <= n_chunks (range-checked)
- **OOR%**: Out-of-range citation rate — share of [n] tokens where n > n_chunks (clause numbers, hallucinated refs)
- **Lang**: % of responses in correct language
- **MD**: Average markdown quality score (0-10)
- **Neg Acc**: % of negative cases correctly identified as 'not found'
- **$/1k**: Estimated cost per 1000 cases (avg input tokens × input price + avg output tokens × output price). Requires `pricing_snapshot` in run output OR `<stem>_pricing.json` sidecar.
- **KW Cov**: Average ground-truth keyword coverage (proxy for completeness)
