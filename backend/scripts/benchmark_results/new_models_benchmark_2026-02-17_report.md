# DocTalk RAG Benchmark Report

Generated: 2026-02-17T23:31:55.320229+00:00

## Model Scorecards

| Model | Valid/Total | Err% | Avg TTFT | P95 TTFT | Cite Acc | Lang | MD | Neg Acc | KW Cov |
|-------|-----------|------|----------|----------|----------|------|-----|---------|--------|
| minimax-m2.5 | 48/48 | 0.0% | 12869ms | 47523ms | 98% | 100% | 5.2 | 88% | 74% |
| qwen3.5-397b-a17b | 48/48 | 0.0% | 8977ms | 35263ms | 96% | 96% | 4.9 | 100% | 70% |
| glm-5 | 48/48 | 0.0% | 18393ms | 49225ms | 98% | 100% | 4.8 | 100% | 72% |

## Metric Definitions

- **Cite Acc**: % of test cases meeting minimum expected citation count
- **Lang**: % of responses in correct language
- **MD**: Average markdown quality score (0-10)
- **Neg Acc**: % of negative cases correctly identified as 'not found'
- **KW Cov**: Average ground-truth keyword coverage (proxy for completeness)
