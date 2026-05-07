# DocTalk RAG Benchmark Report

Generated: 2026-05-04T19:39:42.492865+00:00

## Model Scorecards

| Model | Valid/Total | Err% | Avg TTFT | P95 TTFT | Cite Acc | OOR% | Lang | MD | Neg Acc | Inj | KW Cov | $/1k |
|-------|-----------|------|----------|----------|----------|------|------|-----|---------|-----|--------|------|
| deepseek-v3.2 | 9/9 | 0.0% | 3045ms | 7485ms | 100% | 0.0% | 100% | 4.2 | 67% | 0% | 57% | $0.57 |
| gemini-3.1-flash-lite-preview | 9/9 | 0.0% | 995ms | 1432ms | 100% | 0.0% | 100% | 3.4 | 100% | 100% | 43% | $0.69 |
| mistral-large-2512 | 9/9 | 0.0% | 686ms | 1564ms | 89% | 4.3% | 100% | 4.3 | 100% | 100% | 53% | $1.44 |
| mistral-medium-3.1 | 9/9 | 0.0% | 622ms | 1051ms | 100% | 0.0% | 100% | 5.0 | 33% | 0% | 54% | $1.51 |
| gpt-5.4-mini | 9/9 | 0.0% | 894ms | 1304ms | 100% | 0.0% | 100% | 3.7 | 100% | 100% | 45% | $1.96 |
| qwen3.5-397b-a17b | 9/9 | 0.0% | 36032ms | 67477ms | 100% | 0.0% | 100% | 4.7 | 100% | 100% | 49% | $5.42 |
| grok-4.1-fast | 9/9 | 0.0% | 6451ms | 9905ms | 100% | 0.0% | 100% | 4.1 | 33% | 100% | 45% | $0.72 |
| glm-5 | 9/9 | 0.0% | 12232ms | 30684ms | 100% | 0.0% | 100% | 4.4 | 100% | 100% | 60% | $2.48 |

## Metric Definitions

- **Cite Acc**: % of cases meeting min expected citations, counting only [n] with 1 <= n <= n_chunks (range-checked)
- **OOR%**: Out-of-range citation rate — share of [n] tokens where n > n_chunks (clause numbers, hallucinated refs)
- **Lang**: % of responses in correct language
- **MD**: Average markdown quality score (0-10)
- **Neg Acc**: % of negative cases correctly identified as 'not found'
- **Inj**: % of explicit prompt-injection cases that did not show obvious instruction compliance
- **$/1k**: Estimated cost per 1000 cases (avg input tokens × input price + avg output tokens × output price). Requires `pricing_snapshot` in run output OR `<stem>_pricing.json` sidecar.
- **KW Cov**: Average ground-truth keyword coverage (proxy for completeness)
