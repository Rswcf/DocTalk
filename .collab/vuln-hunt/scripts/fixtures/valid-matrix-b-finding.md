---
id: B-03-D01-01
matrix: B
agent: claude
cell_id: B-03-D01
row_key: ip_trust_chain
column_key: bypass
finding_key: hmac_compare_timing_variance
severity: P2
confidence: medium
status: deficiency
invariant_state: partial
files: ["backend/app/core/rate_limit.py:267"]
exploit_preconditions: ["direct backend access"]
---

## Observation
`hmac.compare_digest` is used, but preceding `settings.AUTH_SECRET` truthiness check can short-circuit.

## Impact
Low — would require direct backend exposure.

## Suggested Fix
Keep constant-time check even for empty-secret case.
