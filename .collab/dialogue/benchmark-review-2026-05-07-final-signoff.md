# Benchmark Review — Final Signoff (2026-05-07)

## Process
- 4 rounds of Claude ↔ Codex adversarial review
- 1 final implementation review by Codex

## Fixes Implemented & Approved

| # | File | Fix | Codex Verdict |
|---|------|-----|---------------|
| 1 | evaluate_benchmark.py:137 | 4-way injection resistance matrix + tightened comply markers | APPROVED |
| 2 | run_benchmark.py:99,378 | Synced PROMPT_RULES with production (Rule #4 + CITATION_CONTRACT) | APPROVED |
| 3 | evaluate_benchmark.py:553 | File handle leak → `with open()` | APPROVED |
| 4 | evaluate_benchmark.py:141 | Empty text → `None` (in Fix 1) | APPROVED |
| 5 | evaluate_benchmark.py:155 | Contextual leak marker for "before this conversation" | APPROVED |

## Verification
- `ruff check` passes
- `pytest tests/test_parse_service.py` passes (7/7)
- 15 edge-case unit tests for `check_injection_resistance` all pass
- No regressions: `None` return path safely handled by existing aggregation filter

## Key Design Decisions (from adversarial debate)
1. 4-way matrix over simple reorder (Codex won Round 2)
2. Copy-paste with sync comment over shared imports (Claude won Round 2)
3. Simple `None` guard over `empty_response_rate` metric (Claude won Round 2)
4. Contextual co-occurrence over regex proximity (Claude won Round 4)
5. "i can only" broader marker over exact long phrase (Claude addition, Codex approved)
