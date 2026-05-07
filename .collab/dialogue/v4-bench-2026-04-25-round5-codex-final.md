# Codex Round 5 — Final Sign-off Decision

**Run**: 2026-04-25T08:10:48Z
**Model**: gpt-5.3-codex

---

**R5 Verdict: Reject (no sign-off yet).**

1. **Blocking: judge artifact is still internally inconsistent.**
- Aggregate correctly shows `93.6` / `94.2` / `82.8` in [v4_benchmark_2026-04-25_judge_claude.json#L521-L534](/Users/mayijie/Projects/Code/010_DocTalk/backend/scripts/benchmark_results/v4_benchmark_2026-04-25_judge_claude.json#L521).
- But `key_findings` still says `94.4% vs 93.9%` in [#L587](/Users/mayijie/Projects/Code/010_DocTalk/backend/scripts/benchmark_results/v4_benchmark_2026-04-25_judge_claude.json#L587), which contradicts aggregate values.
- Scope says coverage includes `3 summarization` and `1 adversarial` in [#L16](/Users/mayijie/Projects/Code/010_DocTalk/backend/scripts/benchmark_results/v4_benchmark_2026-04-25_judge_claude.json#L16), but `by_case_type` omits both and has wrong `n` for other types (`multi_hop n=2`, `factual n=1`) in [#L536-L573](/Users/mayijie/Projects/Code/010_DocTalk/backend/scripts/benchmark_results/v4_benchmark_2026-04-25_judge_claude.json#L536).

2. **Blocking vs R4 hardening requirement: multi-layer hardening is still incomplete.**
- L1/L2 are real: meta rule constant + prompt injection at four build sites in [chat_service.py#L33-L43](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py#L33), [#L422](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py#L422), [#L431](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py#L431), [#L833](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py#L833), [#L842](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py#L842), and rules in [model_profiles.py#L40-L42](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/core/model_profiles.py#L40), [#L56-L58](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/core/model_profiles.py#L56).
- L3 is still deferred (no request-body prompt-injection detection in proxy route) in [route.ts#L46-L128](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/api/proxy/[...path]/route.ts#L46) and acknowledged deferred in ADR [#L329](/Users/mayijie/Projects/Code/010_DocTalk/.collab/reviews/v4-bench-2026-04-25-final-adr.md#L329).

3. **Non-blocking but important: hardening verification results are not reproducible from committed artifacts.**
- 12/12 and 6/6 claims are documented only narratively in ADR [#L306-L321](/Users/mayijie/Projects/Code/010_DocTalk/.collab/reviews/v4-bench-2026-04-25-final-adr.md#L306), with no committed result JSON/log.

---

### Per-R4 item verification

1. **R4 Finding 1 (judge inconsistencies):** **Partially fixed, still failing** due the blocker above.  
2. **R4 Finding 2 (ADR §1 vs §9.6 conflict):** **Fixed** in [ADR#L42](/Users/mayijie/Projects/Code/010_DocTalk/.collab/reviews/v4-bench-2026-04-25-final-adr.md#L42) and [ADR#L259-L264](/Users/mayijie/Projects/Code/010_DocTalk/.collab/reviews/v4-bench-2026-04-25-final-adr.md#L259).  
3. **R4 Finding 3 (n=18 statistical adequacy):** **Fixed/accepted** (`p=0.169`, deferred posture) in [judge#L623](/Users/mayijie/Projects/Code/010_DocTalk/backend/scripts/benchmark_results/v4_benchmark_2026-04-25_judge_claude.json#L623), [ADR#L263](/Users/mayijie/Projects/Code/010_DocTalk/.collab/reviews/v4-bench-2026-04-25-final-adr.md#L263).  
4. **R4 Finding 4 (cost verification chain):** **Partially fixed**. `fetch_pricing_snapshot()` is implemented in [run_benchmark.py#L333-L355](/Users/mayijie/Projects/Code/010_DocTalk/backend/scripts/run_benchmark.py#L333) and wired in [#L548](/Users/mayijie/Projects/Code/010_DocTalk/backend/scripts/run_benchmark.py#L548); stale artifact caveat exists in [judge#L641](/Users/mayijie/Projects/Code/010_DocTalk/backend/scripts/benchmark_results/v4_benchmark_2026-04-25_judge_claude.json#L641). Scorecard still has no cost fields in [scorecard.json#L1-L135](/Users/mayijie/Projects/Code/010_DocTalk/backend/scripts/benchmark_results/v4_benchmark_2026-04-25_scorecard.json#L1).  
5. **R4 Finding 5 (prompt-injection hardening):** **Partially fixed** (L1/L2/L4 done; L3 deferred). Adversarial set is expanded (10 adversarial cases total) across [benchmark_test_cases.json#L575-L761](/Users/mayijie/Projects/Code/010_DocTalk/backend/scripts/benchmark_test_cases.json#L575).  
6. **R4 Finding 6 (stale 37% claims in historical docs):** **Still present** in [round1#L92](/Users/mayijie/Projects/Code/010_DocTalk/.collab/dialogue/v4-bench-2026-04-25-round1-claude-brief.md#L92) and [round2#L113](/Users/mayijie/Projects/Code/010_DocTalk/.collab/dialogue/v4-bench-2026-04-25-round2-claude-response.md#L113). Not necessarily wrong if intentionally historical, but still stale text.

---

`ruff` on touched backend files was clean, and `pytest tests/test_parse_service.py -v` passed (7/7).

To get sign-off, I need:
1. Judge JSON cleaned so `key_findings`/`by_case_type` are internally consistent with `judgments` and aggregates.
2. Multi-layer hardening plan closed (implement proxy/output-policy layer, or explicitly downgrade/accept the risk and update decision text accordingly).
3. Preferably: commit a machine-readable hardening verification artifact (not just ADR prose).
