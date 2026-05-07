# Codex Round 1 — Adversarial Review of V4 Benchmark

**Run**: 2026-04-25T06:42:20Z
**Model**: gpt-5.3-codex
**Brief read from**: .collab/dialogue/v4-bench-2026-04-25-round1-claude-brief.md

---

**Critical Findings (Most Damaging First)**
1. `C4` is likely not a true “no-think” arm. In raw results, `deepseek-v4-flash [no-think]` has non-zero `reasoning_tokens` on all 48 cases (avg `294.2`, p50 `224`), while `deepseek-v4-pro [no-think]` is all zero. That makes the label and any “no-think vs think” interpretation for Flash unreliable.
2. Citation accuracy is structurally weak. `citations` are regex-extracted from response text, not validated grounding. So `[9]` from clause numbers can inflate citation counts. Out-of-range citation examples exist (`comparative_nda_01`, `inference_nda_01`, etc.), but still pass min-citation checks.
3. Claim B is driven by a brittle proxy (`keyword_coverage`) that contradicts obvious correctness on several cases (`negative_nvidia_02`, `multihop_nvidia_01`, `inference_nvidia_02`).

## Q1 — Methodology Validity
**Verdict: partial.**
- Strong: latency (`ttft_ms`, `total_ms`), error-rate, same chunk cache across configs.
- Weak: citation accuracy, language compliance, negative detection, keyword coverage as “quality.”
- Most damning flaw you didn’t emphasize enough: **you’re making model-quality claims from unvalidated lexical heuristics** (especially Claim B).

## Q2 — Statistical Significance (A/B/C)
**Claim A (V4-Flash disqualified): mostly survives.**
- EN language compliance by evaluator heuristic:
  - `C1`: `40/40`
  - `C4`: `24/40`
  - `C6`: `29/40`
- Pairwise EN drop vs `C1` is strong:
  - `C4-C1`: `-40pp`, bootstrap 95% CI `[-55pp, -25pp]`
  - `C6-C1`: `-27.5pp`, CI `[-42.5pp, -15pp]`
- KW drop vs `C1` is also strong:
  - `C4-C1`: `-25.2pp`, CI `[-35.8pp, -15.1pp]`
- Nuance: your `25/40` Chinese number is plausible under a different rule (`CJK > 0.3`), but not under your published evaluator rule (`latin > 0.3`), which gives `16/40` fails. Reproducibility issue.

**Claim B (reasoning hurts 5/10 types): does not survive as stated.**
- From your own type table, it is **4 down / 1 flat / 5 up** (not 5 down).
- Per-type sample sizes are tiny (`n=3` or `n=6`), CIs are huge.
- Paired C7-C5 keyword deltas by type mostly include zero:
  - inferential: `-15.3pp`, CI `[-37.5pp, 0]`
  - multi_hop: `-27.8pp`, CI `[-50pp, 0]`
  - table_numerical: `-23.8pp`, CI `[-100pp, +28.6pp]`
  - negative: `-16.7pp`, CI `[-27.8pp, -5.6pp]` (only one clearly negative, but metric artifact risk is highest here)

**Claim C (no V4 config dominates): partially survives.**
- `C4` as Quick replacement: rejection is well-supported (language + TTFT + quality proxy).
- `C2` vs `C5` for Balanced: TTFT strongly favors `C2` (about `+1.11s` for `C5`), but total latency is not clearly different (CI crosses 0). Cost comparison is not reproducible from saved artifacts.
- `C3` vs `C5`: still ambiguous (your conclusion here is fair).

## Q3 — Confounders
**Material confounders:**
- `C4` “no-think” likely not no-think (non-zero reasoning tokens).
- Model IDs are aliases (not pinned version strings) in saved output; reruns may drift.
- Run order is fixed (config-serial), single pass, no randomized interleaving.

**Moderate confounders:**
- Prompt style asymmetry (`positive_framing` vs `default`) can bias cross-family comparisons, though A is less affected (C1/C4/C6 all positive_framing).
- Cost numbers are not persisted with a price snapshot/caching mode in benchmark artifacts.

**Likely minor confounders:**
- `max_tokens` asymmetry appears low impact here; no arm approaches cap binding.

## Q4 — Decision-Support Adequacy
**Verdict: enough for “don’t swap to V4-Flash now”; not enough for full “no swap” across all tiers.**

Minimum additional work to make a production-grade call:
1. Re-run with explicit reasoning controls for Flash (`enabled:false`, `low`, `medium`) and verify `reasoning_tokens`.
2. Replace/augment lexical quality metrics with judged correctness on a stratified subset (at least 20–30 cases covering negative/multi-hop/table/inferential).
3. Retry transient failures (429) with bounded retry policy so per-arm case sets match.
4. Run at least 3 replicated passes with randomized model order/interleaving to separate model effects from time/load effects.
5. Persist a cost snapshot in output (prices + caching assumption + timestamp).

## Q5 — Reasoning-Effect Mechanism (Claim B)
**I reject the proposed mechanism as proven.**
- Supported: reasoning massively increases latency (`C7` TTFT +15.7s vs `C5`; TTFT correlates with reasoning tokens ~`0.992`).
- Not proven: “reasoning causes worse RAG factual quality.”
- Simpler explanation: keyword metric penalizes wording choices and brevity patterns.
  - `negative_nvidia_02`: both answers are clearly correct refusals; keyword score diverges due phrase mismatch.
  - `multihop_nvidia_01`: `%` vs keyword `"percent"` changes score.
  - `inference_nvidia_02`: `"R&D"` vs `"research/development"` changes score.

## Q6 — What Was Missed
- “Same 8 chunks per case” is not true in raw data: 12 NDA-linked cases have `n_chunks=2`.
- Citation metric can count non-citation bracket numbers; this can inflate apparent grounding.
- `n=48` uncertainty is larger than stated for mid-range proportions (your `±4–7pp` is optimistic outside near-0/1 metrics).
- The “Mistral sub-second with 12k-token prompt” concern is based on wrong scale here; prompt tokens in raw usage are around ~2.2k–2.5k, not 12k.

**Key Sources**
- [v4_benchmark_2026-04-25.json](/Users/mayijie/Projects/Code/010_DocTalk/backend/scripts/benchmark_results/v4_benchmark_2026-04-25.json)
- [v4_benchmark_2026-04-25_scorecard.json](/Users/mayijie/Projects/Code/010_DocTalk/backend/scripts/benchmark_results/v4_benchmark_2026-04-25_scorecard.json)
- [benchmark_test_cases.json](/Users/mayijie/Projects/Code/010_DocTalk/backend/scripts/benchmark_test_cases.json)
- [evaluate_benchmark.py:37](/Users/mayijie/Projects/Code/010_DocTalk/backend/scripts/evaluate_benchmark.py:37)
- [evaluate_benchmark.py:88](/Users/mayijie/Projects/Code/010_DocTalk/backend/scripts/evaluate_benchmark.py:88)
- [evaluate_benchmark.py:137](/Users/mayijie/Projects/Code/010_DocTalk/backend/scripts/evaluate_benchmark.py:137)
- [run_benchmark.py:328](/Users/mayijie/Projects/Code/010_DocTalk/backend/scripts/run_benchmark.py:328)
- [run_benchmark.py:418](/Users/mayijie/Projects/Code/010_DocTalk/backend/scripts/run_benchmark.py:418)
- [/tmp/v4_kimi_excluded_bench.py](/tmp/v4_kimi_excluded_bench.py)
