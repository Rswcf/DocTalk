# BUG-2026-05-11-PRODUCTION-DEMO-RAG-VERIFIER-WARNINGS

Status: **open quality observation**

## Summary

Production public demo RAG prompt matrix passed user-facing functional checks for streaming, answer content, citations, message persistence, and negative/unanswerable behavior. However, the built-in chat verifier returned warnings for two cited answers.

This is not currently a hard user-visible failure from the matrix, but it is a quality signal for RAG answer/citation grounding and verifier calibration.

## Evidence

- QA run: `.collab/tasks/qa-run-2026-05-11-production-demo-rag-prompt-matrix.md`
- Raw result: `.collab/tasks/qa-production-demo-rag-prompt-matrix-2026-05-11.json`

Warnings:

- `attention_summary_cited`
  - Verifier status: `warn`
  - Score: `0.6`
  - Reasons: `uncited_claim_units`, `low_claim_source_overlap`
  - Harness functional checks: pass
- `alphabet_specific_cited`
  - Verifier status: `warn`
  - Score: `0.0`
  - Reason: `numeric_claim_source_mismatch`
  - Harness functional checks: pass
- `court_negative_unanswerable`
  - Verifier status: `pass`
  - Score: `1.0`
  - Harness functional checks: pass

## Impact

- Severity: P3 RAG quality-monitoring issue.
- Functional impact: no hard failure in this matrix.
- Trust impact: verifier warnings mean answer/citation grounding should be triaged before relying on green functional checks as proof of factual quality.

## Suggested Triage

1. Inspect whether the verifier warnings are true positives or false positives caused by table/numeric extraction format.
2. For true positives, tune answer prompting/citation attachment so every claim unit maps to a cited chunk.
3. For false positives, improve verifier handling of table rows, reporting-period language, and compact financial statement chunks.
4. Keep this case in the live RAG regression set after triage.
