# V4 Benchmark — Round 1 Brief (Claude → Codex)

> **⚠️ Historical record — superseded cost claim.** This Round 1 brief was written before the OpenRouter price snapshot was implemented. The "v4-pro is 37% cheaper than mistral-large-2512" claim below (§3.2 / §3.1 Claim C) was based on stale memory ($2.00/$6.00 per 1M for mistral-large) — actual price is $0.50/$1.50 per 1M, making v4-pro **2.5× more expensive**. See ADR §0 for the corrected cost analysis. The Claim B / Claim C discussion still stands at the qualitative level; only the dollar figures rotted.

**Date**: 2026-04-25
**Author**: Claude Opus 4.7 (1M)
**Reviewer**: Codex (gpt-5.3-codex)
**Subject**: Adversarial review of *DeepSeek V4 Flash / V4 Pro / Kimi K2.6* benchmark methodology and results
**Goal**: 双层 challenge — (1) 测试方法论是否合理 (2) 结果是否足以支撑 prod 决策

---

## 1. Background

User asked: should we replace current production models (DeepSeek V3.2 / Mistral Medium 3.1 / Mistral Large 2512) with the newly-released V4 family on OpenRouter? Kimi K2.6 was excluded mid-flight per user instruction.

I built and ran a 7-config × 48-case benchmark today (2026-04-25) and produced the following findings. Before locking these in as a prod recommendation, I want you to challenge **every** non-trivial claim. Push hard.

---

## 2. Methodology (what I did)

### 2.1 Test pipeline

- **Test cases**: `backend/scripts/benchmark_test_cases.json` — 48 curated cases across 10 types (factual / comparative / inferential / multi_hop / summarization / table_numerical / multilingual / negative / adversarial / ambiguous_partial), 3 demo docs (NVIDIA 10-K English / Attention Is All You Need / NDA template), 5 query languages (40 EN / 3 ZH / 2 ES / 2 JA / 1 AR).
- **Chunks**: reused frozen retrieval cache `chunks_2026-02-17T23-45-42.json` — same 8 chunks per case fed to **every** model. Chunks were retrieved Feb 2026 via openai/text-embedding-3-small + Qdrant. **All models see identical context**, so retrieval bias cancels out across configs.
- **Prompt**: byte-identical system prompt template lifted from production `chat_service.py` / `model_profiles.py`. DeepSeek family gets `positive_framing` rules variant; everyone else gets `default`. Same as prod.
- **Streaming**: `httpx.stream` to `openrouter.ai/api/v1/chat/completions`, `stream_options.include_usage=true`. TTFT = time from request start to first content delta. total_ms = request start → `[DONE]`.
- **Driver**: `/tmp/v4_kimi_excluded_bench.py` (out-of-tree, doesn't pollute project). Output written to `backend/scripts/benchmark_results/v4_benchmark_2026-04-25.json`.

### 2.2 Configs (7 total)

| ID | Model | T | max_tokens | reasoning |
|---|---|---|---|---|
| C1 | `deepseek/deepseek-v3.2` (prod-quick) | 0.1 | 2048 | — |
| C2 | `mistralai/mistral-medium-3.1` (prod-balanced) | 0.2 | 4096 | — |
| C3 | `mistralai/mistral-large-2512` (prod-thorough) | 0.2 | 8192 | — |
| C4 | `deepseek/deepseek-v4-flash` (no-think) | 0.1 | 2048 | — |
| C5 | `deepseek/deepseek-v4-pro` (no-think) | 0.2 | 4096 | `enabled: false` (V4-Pro defaults reasoning ON; must explicitly disable) |
| C6 | `deepseek/deepseek-v4-flash` (think:low) | 0.1 | 4096 | `effort: low, exclude: true` |
| C7 | `deepseek/deepseek-v4-pro` (think:medium) | 0.2 | 8192 | `effort: medium, exclude: true` |

### 2.3 Metrics

- **TTFT / total_ms**: wall-clock streaming
- **Citation accuracy**: `(unique [n] in response) >= expected_min_citations`
- **Language compliance**: heuristic Unicode block detection — CJK/hira+kata/Arabic/Latin character ratios > 30%
- **Markdown quality** (0–10): rule-based scoring of `**bold**`, bullets, headers, tables, code blocks
- **Negative case accuracy**: substring match against ~50 phrases like "not found", "not present", "未找到" etc.
- **Keyword coverage**: fraction of ground-truth keywords (case-insensitive substring match) found in response — proxy for completeness
- **Cost/case**: `(prompt_tokens × $/1M_in + completion_tokens × $/1M_out) / 1e6`, using OpenRouter listed prices (no caching discount)

---

## 3. Findings (what I claim)

### 3.1 Headline scorecard

| Config | TTFT | P95 | Cite | Lang | KW | MD | Neg | $/1k |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| C1 v3.2 [prod-quick] | 2843ms | 7685 | 98% | 98% | 76% | 4.5 | 100% | $0.66 |
| C2 mistral-med-3.1 [prod-balanced] | **665ms** | 1237 | 98% | 100% | **75%** | **5.9** | 88% | $1.90 |
| C3 mistral-large-2512 [prod-thorough] | **611ms** | 941 | 100% | 100% | 72% | 5.0 | 88% | $7.05 |
| C4 v4-flash [no-think] | 6002ms | 17080 | 96% | **67%** ⚠ | 51% ⚠ | 4.0 | 88% | $0.44 |
| C5 v4-pro [no-think] | 1778ms | 2827 | 98% | 100% | 71% | 4.1 | 100% | $4.43 |
| C6 v4-flash [think:low] | 6916ms | 16731 | 100% | 77% ⚠ | 57% | 3.9 | 100% | $0.47 |
| C7 v4-pro [think:medium] | 17271ms | **69407** | 100% | 100% | 68% | 3.8 | 100% | $6.71 |

n=48 per config (47 for C5 — single 429 on `adversarial_nvidia_02`).

### 3.2 Three claims I want you to challenge

**Claim A (fatal)**: V4-Flash has a Chinese-bias bug that disqualifies it as a V3.2 replacement.
- 25/40 EN questions answered in Chinese (62% fail rate, EN-only); 0% fail on non-EN questions.
- With `reasoning.effort=low`: improves to 19/40 (48%) — still unacceptable.
- KW coverage 51% vs V3.2's 76% (–25pp, well outside ±6pp 95% CI).

**Claim B (counter-intuitive)**: Reasoning HURTS RAG quality on V4-Pro for 5/10 case types.

| Case type | C5 v4-pro no-think | C7 v4-pro think:med | Δ |
|---|---:|---:|---:|
| factual | 69% | 86% | +17 ✓ |
| summarization | 89% | 100% | +11 ✓ |
| **inferential** | 85% | 69% | **–16** ✗ |
| **multi_hop** | 83% | 56% | **–27** ✗ |
| **table_numerical** | 76% | 52% | **–24** ✗ |
| **negative** | 39% | 22% | **–17** ✗ |

Claim mechanism: reasoning makes the model "overthink" retrieved chunks and synthesize incorrect answers, especially on multi-hop / negative / numerical cases where it should just trust the source text.

**Claim C (no swap recommendation)**: All three current production models are at the Pareto frontier; no V4 config dominates.
- v3.2 cheaper + faster than v4-flash for Quick (and v4-flash has the lang bug)
- mistral-medium-3.1 dominates v4-pro [no-think] on TTFT, MD quality, and cost — for Balanced
- mistral-large-2512 vs v4-pro [no-think]: v4-pro is 37% cheaper but 3× slower TTFT; ambiguous

---

## 4. Self-identified weaknesses (don't let me off the hook on these — extend further)

1. **Sample size n=48 per config** → ±4–7pp 95% CI for binary metrics. Some claimed differences (e.g., 71% vs 72% KW between configs) are within noise. **What conclusions am I drawing that the data can't support?**

2. **Keyword coverage as completeness proxy is gameable**: a model could list keywords without actually answering. Conversely, a semantically-correct paraphrase that doesn't reuse the exact keyword scores 0. Verbose models score higher *mechanically* (v4-pro [no-think] avg 165 completion tokens vs mistral-medium 448 → fewer chances to hit keywords).

3. **Language detection is heuristic**: Spanish "no se menciona" detected as `en/latin`. Could over- or under-count language fails.

4. **Negative case detection is substring-based**: depends on a fixed list of "not found" phrases. Models that decline differently slip through.

5. **Markdown quality 0–10 rule-based**: caps trivially. `**bold** + bullets + non-empty` already scores 5. Doesn't measure whether the markdown is *appropriate*.

6. **max_tokens disparity not normalized across configs** (C1=2048, C3=8192). Counter-defense: no model came within 90% of its cap (max observed 3630 on C7); cap differences likely don't bias output. Still, asymmetric.

7. **Cost analysis ignores prompt caching**: DeepSeek and Anthropic offer cached-input pricing. With prompt caching enabled in prod, V3.2 input cost drops dramatically; Mistral has no announced caching at this writing.

8. **Single-day test, no re-runs**: variance from server-side load not measured. The 1 single 429 error on V4-Pro [no-think] is the only sign of capacity issues.

9. **Reasoning effort sweep is incomplete**: I tested only `low` for V4-Flash and `medium` for V4-Pro. No `minimal` / `high` / `xhigh` variants. Can't claim "reasoning is bad for RAG in general" — only "medium reasoning is bad for V4-Pro on this test set."

10. **Test cases are 3 docs, all curated for DocTalk's demo set**: NVIDIA 10-K (English finance), attention paper (English ML), NDA (legal). Generalization to user-uploaded docs is assumed, not measured. Languages skewed 40/8 EN/non-EN.

11. **TTFT variance — V4-Pro think:medium P95 = 69s**: outlier-driven? The 4 slowest C7 cases were all multilingual or summarization on long chunks. Real prod risk or measurement artifact?

12. **Mistral TTFT sub-second is suspicious**: 12K-token system prompt should not stream first token in 600ms. Possible OpenRouter-side prompt caching. Counter-data: median 556ms, max 4197ms — no obvious cache-hit/miss bimodal distribution.

---

## 5. What I want from you (Codex)

Be ruthless. For each item below give me a concrete verdict + reasoning:

**Q1 — Methodology validity**: Are the metrics reasonable proxies for production quality? What's the most damning methodological flaw I'm not seeing?

**Q2 — Statistical significance**: Which of my claims (A / B / C and sub-bullets) survive an honest n=48 analysis? Which collapse?

**Q3 — Confounders**: Asymmetric max_tokens, asymmetric prompt_style (positive_framing vs default), asymmetric reasoning defaults, prompt caching, model versioning (`v4-flash-20260423` is 1-day-old) — which of these meaningfully bias my conclusions?

**Q4 — Decision-support adequacy**: Is the data sufficient to recommend "no swap" with confidence, or does it only support "more testing needed"? If the latter, what's the minimum additional work needed?

**Q5 — Reasoning effort claim**: Claim B is the most provocative. Do you accept the mechanism explanation ("reasoning makes the model doubt chunks")? Or is there a simpler explanation (e.g., max_tokens budget pressure, single-effort-level bias)?

**Q6 — What did I miss**: Any 2nd-order issue I haven't surfaced? Particularly anything that would change the production recommendation.

Do not accept claims at face value just because they sound reasonable. Your job is to break them.

---

## 6. References (you can read these)

- Raw results: `backend/scripts/benchmark_results/v4_benchmark_2026-04-25.json`
- Scorecard: `backend/scripts/benchmark_results/v4_benchmark_2026-04-25_scorecard.json`
- Auto report: `backend/scripts/benchmark_results/v4_benchmark_2026-04-25_report.md`
- Test cases: `backend/scripts/benchmark_test_cases.json`
- Cached chunks: `backend/scripts/benchmark_results/chunks_2026-02-17T23-45-42.json`
- Production model registry: `backend/app/core/model_profiles.py`
- Original benchmark runner (no reasoning support): `backend/scripts/run_benchmark.py`
- Out-of-tree V4 runner: `/tmp/v4_kimi_excluded_bench.py`

Reply in markdown. Cite specific file paths / case IDs / numbers from the JSON when challenging.
