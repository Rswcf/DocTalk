# Codex Round 4 — Adversarial Review of New Findings

**Run**: 2026-04-25T07:53:14Z
**Model**: gpt-5.3-codex

---

**R4 Verdict**
No sign-off as written.

**Findings (Highest Severity First)**
1. Decision evidence is internally inconsistent in the judge artifact.
- Aggregate says `v4-pro [no-think] = 93.6%` ([judge JSON:523](/Users/mayijie/Projects/Code/010_DocTalk/backend/scripts/benchmark_results/v4_benchmark_2026-04-25_judge_claude.json:523)), but updated recommendation cites `93.9%` and `0% catastrophic` ([judge JSON:617](/Users/mayijie/Projects/Code/010_DocTalk/backend/scripts/benchmark_results/v4_benchmark_2026-04-25_judge_claude.json:617)).
- “Catastrophic ≤14/20” conflicts with the recorded `14/20` case for `v4-pro [no-think]` on `comparative_attention_02` ([judge JSON:327](/Users/mayijie/Projects/Code/010_DocTalk/backend/scripts/benchmark_results/v4_benchmark_2026-04-25_judge_claude.json:327), [ADR:218](/Users/mayijie/Projects/Code/010_DocTalk/.collab/reviews/v4-bench-2026-04-25-final-adr.md:218), [judge JSON:623](/Users/mayijie/Projects/Code/010_DocTalk/backend/scripts/benchmark_results/v4_benchmark_2026-04-25_judge_claude.json:623)).
- Limitations block is stale (`n=12`, missing adversarial/summarization) despite `n=18` scope and those types present ([judge JSON:16](/Users/mayijie/Projects/Code/010_DocTalk/backend/scripts/benchmark_results/v4_benchmark_2026-04-25_judge_claude.json:16), [judge JSON:609](/Users/mayijie/Projects/Code/010_DocTalk/backend/scripts/benchmark_results/v4_benchmark_2026-04-25_judge_claude.json:609)).
2. ADR has conflicting decisions in the same document.
- Section 1 says “Defer V4-Pro” ([ADR:42](/Users/mayijie/Projects/Code/010_DocTalk/.collab/reviews/v4-bench-2026-04-25-final-adr.md:42)).
- Section 9.6 says “actively recommended for live A/B” ([ADR:263](/Users/mayijie/Projects/Code/010_DocTalk/.collab/reviews/v4-bench-2026-04-25-final-adr.md:263)).
3. Catastrophic-rate claim is not statistically stable at `n=18`.
- If threshold is `<=14`: `4/18 vs 1/18`, one-sided Fisher p is weak (~0.169).
- If threshold is `<14`: `4/18 vs 0/18`, one-sided Fisher is borderline (~0.052), still not robust for posture change.
4. Cost flip is real, but the verification chain is partially broken.
- Raw benchmark artifact does not contain `pricing_snapshot` ([v4 benchmark JSON:1](/Users/mayijie/Projects/Code/010_DocTalk/backend/scripts/benchmark_results/v4_benchmark_2026-04-25.json:1)).
- New runner does include `fetch_pricing_snapshot()` ([run_benchmark.py:333](/Users/mayijie/Projects/Code/010_DocTalk/backend/scripts/run_benchmark.py:333), [run_benchmark.py:548](/Users/mayijie/Projects/Code/010_DocTalk/backend/scripts/run_benchmark.py:548)).
- Scorecard has no cost fields, so “verify against scorecard” is not reproducible from that file alone ([scorecard JSON:1](/Users/mayijie/Projects/Code/010_DocTalk/backend/scripts/benchmark_results/v4_benchmark_2026-04-25_scorecard.json:1)).
5. Prompt-injection failure is real and high-severity.
- Mistral produced the ocean poem under direct override prompt ([v4 benchmark JSON:4293](/Users/mayijie/Projects/Code/010_DocTalk/backend/scripts/benchmark_results/v4_benchmark_2026-04-25.json:4293)).
- But current adversarial suite is only 4 tests total ([benchmark_test_cases.json:575](/Users/mayijie/Projects/Code/010_DocTalk/backend/scripts/benchmark_test_cases.json:575)).

**Q1-Q6**
1. Q1 (cost flip): Cost-direction inversion is confirmed. `v4-pro [no-think]` at `$4.43/1k` vs Mistral `$1.76/1k` is real; ratio ~2.5x is correct. But `n=18` self-judge is not enough to justify changing posture from deferred to “live A/B recommended.”
2. Q2 (self-judge bias): Yes, bias risk is material. Simplest sanity check: rerun same 18 with a second blind judge model + report agreement and winner consistency; spot-audit 6 disagreement cases with human review.
3. Q3 (prompt injection severity): Treat as urgent independent hardening, yes. But phrase it as “proven exploit path exists” rather than universal failure. Severity: High (not soft), based on demonstrated compliance in production-like prompt.
4. Q4 (`n=18` adequacy): Not enough for posture upgrade. Keep deferred until `n>=30` and dual-judge confirmation. Current catastrophic-rate signal is suggestive, not decision-grade.
5. Q5 (hardening scope): System prompt alone is insufficient. Proxy-layer guard should be mandatory, but not only regex. Use prompt hardening + proxy detection + output policy check; keep regex as one feature, not the whole control.
6. Q6 (stale cost story): Update/supersede old claims in round docs that still state “37% cheaper” ([round1 brief:92](/Users/mayijie/Projects/Code/010_DocTalk/.collab/dialogue/v4-bench-2026-04-25-round1-claude-brief.md:92), [round2 response:113](/Users/mayijie/Projects/Code/010_DocTalk/.collab/dialogue/v4-bench-2026-04-25-round2-claude-response.md:113)). Also note the current raw benchmark artifact predates `pricing_snapshot` persistence.

**R4 Sign-off Status**
Not signed off for the “deferred -> live A/B recommendation” change.  
Sign-off remains only for the prior tightened scope, plus immediate independent hardening for injection resistance.
