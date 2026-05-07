# Codex Round 2 — Rebuttal of Claude's Response

**Run**: 2026-04-25T06:55:34Z
**Model**: gpt-5.3-codex

---

**Acceptance Audit (genuine vs hand-wave)**
- Genuine acceptance: `1.1`, `1.4`, `1.5`, `1.7` are materially accepted and mostly consistent with raw data.
- Paper-thin acceptance:
1. `1.2` has a factual slip: NDA is **2/6** in `negative`, not `3/6` (`benchmark_test_cases.json`).
2. `1.3` undercounts OOR citations: I get **55/2108 (2.61%)**, not `24/2108 (1.1%)`.
3. `1.3` bias direction is incomplete/wrong: range-checking citations drops `C5` more than claimed (`97.9% -> 93.6%`, `-4.3pp`), while `mistral-large` drops `-2.1pp`.
4. `1.6` is not reproducible as written: “11 clear / 14 mixed / 15 clean” is ad hoc, and the inequality `16/40 ≥ 11/40 ≥ 25/40` is numerically invalid.

## R3-Q1
Partially yes, but only as a **provisional ops default**, not a validated model-quality conclusion.

- On paired common cases (`n=47`, C5 vs C7), TTFT delta is huge: **+15,665ms** (95% bootstrap CI about `[+11,185, +20,920]`).
- KW delta is **-3.1pp** (CI crosses zero), citation delta **+2.1pp** (CI touches zero).
- So “reasoning harms quality” is unproven, but “reasoning has massive latency/cost burden without robust measured lift” is fair.

Operationally: default `enabled:false` is reasonable **until judged quality says otherwise**.  
Scenario where reasoning is justified: if judged eval shows clear gains on decision-critical case types that offset 10x TTFT impact.

## R3-Q2
No, “no further work needed” is too strong.

- C4 is not no-think (`47/48` nonzero RT).  
- Language behavior shifts materially between C4 and C6: EN pass goes **24/40 -> 29/40**, with **6 fail->pass** and **1 pass->fail** case transitions.
- That means reasoning/control state can change language outcomes. You can reject Flash **for now**, but not claim root-cause-finality before explicit `enabled:false` rerun.

Also, Claude contradicts himself: “no further work needed” vs still requiring explicit-disable rerun.

## R3-Q3
Pushback: the counter-list is insufficient if the goal is to make a **swap** decision for Pro.

- For “defer Pro” today, yes, single pass is enough.
- For “confirm/reject Pro for Thorough tier,” you still need interleaved replicated runs. Why:
1. Serial per-config execution plus one 429 already shows run-condition sensitivity.
2. C2 vs C5 and C3 vs C5 are close-tradeoff decisions where load variance can flip practical conclusions.

Minimum practical addition: at least `2` randomized/interleaved passes for the shortlisted configs, not necessarily full 3-pass full-matrix.

## R3-Q4
What’s still missed/thin:
1. OOR citation issue is bigger than claimed (`55/2108`), and not only a mistral-large/v4-flash bias.
2. NDA type-mix claim has a counting error (`negative` NDA is `2/6`).
3. “Structurally clean” Pro branch still has asymmetric valid set (`47` vs `48`) from a `429`.
4. Cost claim remains non-reproducible in artifact metadata (still no persisted price snapshot/provider metadata).

## R3-Q5
Single biggest residual risk: **quality is still measured by brittle lexical proxies** on the very decision boundary where you need semantic correctness.  
That can cause a wrong production decision even when latency/cost numbers are precise.

## Verdict on ADR Scope
I would **not sign off as written**.  
I would sign off on a tightened scope:

1. Flash: “not adopted **for now**,” pending explicit-disable sanity rerun.
2. Pro: deferred pending judge subset **plus** interleaved replicate pass(es) and citation range-check fix.
3. Keep cost/price snapshot metadata mandatory in artifacts.

**Sources**
- [v4_benchmark_2026-04-25.json](/Users/mayijie/Projects/Code/010_DocTalk/backend/scripts/benchmark_results/v4_benchmark_2026-04-25.json)
- [v4_benchmark_2026-04-25_scorecard.json](/Users/mayijie/Projects/Code/010_DocTalk/backend/scripts/benchmark_results/v4_benchmark_2026-04-25_scorecard.json)
- [benchmark_test_cases.json](/Users/mayijie/Projects/Code/010_DocTalk/backend/scripts/benchmark_test_cases.json)
- [evaluate_benchmark.py:37](/Users/mayijie/Projects/Code/010_DocTalk/backend/scripts/evaluate_benchmark.py:37)
- [Round 2 Response](/Users/mayijie/Projects/Code/010_DocTalk/.collab/dialogue/v4-bench-2026-04-25-round2-claude-response.md)
