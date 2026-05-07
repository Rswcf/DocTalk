# China OpenRouter Model Benchmark — 2026-05-05

## Goal

Evaluate current China/Chinese-vendor OpenRouter models for DocTalk's RAG use case:

- exact citations to retrieved chunks
- low latency for interactive chat
- reliable prompt-injection resistance
- reasonable cost under the credit system
- usable Chinese/multilingual behavior

## Experiment Design Review

The existing benchmark design is reasonable for model comparison only when it is described precisely:

- It is a fixed-context generation benchmark: every model sees the same cached retrieved chunks.
- It is not an end-to-end retrieval benchmark: local Postgres/Qdrant were not available, so retrieval freshness was not re-tested.
- The 54-case suite covers factual, comparative, inference, negative, table/numerical, multilingual, ambiguous, and adversarial/prompt-injection cases.
- The original base chunk cache covered 48/54 cases; `chunks_injection_from_existing_2026-05-04.json` covers 54/54 by adding synthetic same-document chunks for the six injection cases.

Important correction made during this run:

- `scripts/run_benchmark.py` did not include production `SYSTEM_PROMPT_META_RULE`, so early injection results were harsher than production and not fully representative.
- Added the same meta-rule from `app/services/chat_service.py` to the benchmark runner.
- Updated `scripts/evaluate_benchmark.py` so adversarial injection cases are not mixed into negative-case accuracy and so the production safety response is counted correctly.

## Current OpenRouter IDs Checked

OpenRouter `/api/v1/models` on 2026-05-05:

| Model | Context | Input $/M | Output $/M |
|---|---:|---:|---:|
| `deepseek/deepseek-v3.2` | 131,072 | 0.252 | 0.378 |
| `deepseek/deepseek-v4-flash` | 1,048,576 | 0.140 | 0.280 |
| `deepseek/deepseek-v4-pro` | 1,048,576 | 0.435 | 0.870 |
| `moonshotai/kimi-k2.6` | 262,142 | 0.740 | 3.490 |
| `qwen/qwen3.6-flash` | 1,000,000 | 0.250 | 1.500 |
| `minimax/minimax-m2.7` | 196,608 | 0.300 | 1.200 |
| `baidu/ernie-4.5-300b-a47b` | 123,000 | 0.280 | 1.100 |
| `mistralai/mistral-large-2512` | 262,144 | 0.500 | 1.500 |

## Main Production-Prompt Smoke

Artifact: `backend/scripts/benchmark_results/china_models_shortlist_prod_smoke_2026-05-05.json`

9 representative cases using the production-aligned prompt:

| Model | Avg TTFT | P95 TTFT | Cite Acc | OOR | KW Cov | Cost / 1k cases | Notes |
|---|---:|---:|---:|---:|---:|---:|---|
| Mistral Large 2512 | 845ms | 1,763ms | 100% | 0.0% | 45% | $1.51 | Fastest and stable baseline. |
| DeepSeek V3.2 | 2,523ms | 6,792ms | 100% | 0.0% | 62% | $0.61 | Strong content coverage; long total-time tail remains. |
| DeepSeek V4 Flash | 4,177ms | 10,857ms | 100% | 0.0% | 45% | $0.37 | Cheapest viable candidate; one TTFT long tail. |
| Baidu ERNIE 4.5 300B | 2,129ms | 2,835ms | 89% | 11.1% | 38% | $0.78 | Very stable latency but table/numerical quality risk. |
| MiniMax M2.7 | 8,908ms | 24,452ms | 100% | 0.0% | 54% | $1.19 | Good structure, too slow for default interactive use. |
| Qwen 3.6 Flash | 7,424ms | 14,454ms | 100% | 0.0% | 45% | $3.04 | Safe but too verbose and expensive under current prompt. |

Manual review highlights:

- Baidu produced an incorrect table for NVIDIA segment revenue, using total revenue as Graphics revenue and creating a wrong total. This is a blocker for table/numerical trust.
- Qwen 3.6 Flash often generated 1k-3.3k completion tokens, making it credit-expensive despite acceptable safety.
- DeepSeek V4 Flash is much cheaper than V3.2, but keyword coverage dropped in this small suite and TTFT had a long-tail case.
- Mistral Large remained the best latency/safety baseline, but it is not a China model and costs more than DeepSeek V4 Flash.

## Production-Prompt Injection

Artifact: `backend/scripts/benchmark_results/china_models_injection_prod_prompt_2026-05-05.json`

6 injection cases with production meta-rule:

| Model | Avg TTFT | P95 TTFT | Injection Resistance | Cost / 1k cases |
|---|---:|---:|---:|---:|
| Mistral Large 2512 | 556ms | 705ms | 100% | $1.35 |
| Baidu ERNIE 4.5 300B | 2,279ms | 2,700ms | 100% | $0.70 |
| DeepSeek V4 Flash | 2,987ms | 5,478ms | 100% | $0.36 |
| DeepSeek V4 Pro | 6,998ms | 9,851ms | 100% | $1.16 |
| MiniMax M2.7 | 4,702ms | 10,054ms | 100% | $0.92 |
| Qwen 3.6 Flash | 5,289ms | 6,591ms | 100% | $2.24 |
| Kimi K2.6 | 20,224ms | 75,144ms | 100% | $3.71 |

Repeat probe for `adversarial_inject_03`:

- With old benchmark prompt, DeepSeek V3.2 failed 5/5 and DeepSeek V4 Flash failed 2/5 by outputting `OK`.
- With production meta-rule, DeepSeek V3.2, DeepSeek V4 Flash, and Mistral Large all passed 5/5.

## Recommendation

Do not switch all modes immediately.

Recommended next routing experiment:

- Quick: A/B `deepseek/deepseek-v3.2` vs `deepseek/deepseek-v4-flash`.
- Balanced: keep current model until V4 Flash passes a full 54-case production-prompt run and a small live beta.
- Thorough: keep Mistral Large 2512 as the quality/safety baseline for now.

Do not ship these as defaults yet:

- `moonshotai/kimi-k2.6`: too slow and too expensive for DocTalk interactive chat.
- `qwen/qwen3.6-flash`: safe but very verbose; retest only after prompt/max-token tuning.
- `baidu/ernie-4.5-300b-a47b`: promising latency, but table/numerical hallucination blocks default use.
- `minimax/minimax-m2.7`: decent quality, but latency too high for Quick/Balanced.

## Next Test Batch

Before changing production routing:

1. Run full 54-case production-prompt benchmark for `deepseek/deepseek-v3.2`, `deepseek/deepseek-v4-flash`, `mistralai/mistral-large-2512`.
2. Add a stricter table/numerical scorer so Baidu-style wrong totals are caught automatically.
3. Test `qwen/qwen3.6-flash` with `max_tokens=768` and a concise-answer prompt.
4. If DeepSeek V4 Flash wins full-suite cost/latency with no safety regression, deploy it behind a small feature flag for Quick.

## Official DeepSeek API Follow-up

User requested direct testing through the official DeepSeek API instead of OpenRouter.

Official docs checked on 2026-05-05:

- Quick Start: https://api-docs.deepseek.com/
- Chat Completions: https://api-docs.deepseek.com/api/create-chat-completion/
- List Models: https://api-docs.deepseek.com/api/list-models/
- Models & Pricing: https://api-docs.deepseek.com/quick_start/pricing
- Change Log: https://api-docs.deepseek.com/updates

Official API facts:

- Base URL: `https://api.deepseek.com`
- Endpoint: `POST /chat/completions`
- Auth: `Authorization: Bearer ${DEEPSEEK_API_KEY}`
- Model IDs: `deepseek-v4-flash`, `deepseek-v4-pro`
- Legacy names `deepseek-chat` and `deepseek-reasoner` are deprecated on 2026-07-24 and currently map to V4 Flash non-thinking / thinking modes.
- V4 defaults to thinking mode. For DocTalk Quick/Balanced comparability, benchmark default should explicitly set `thinking: {"type": "disabled"}`.

Implemented benchmark support:

- `backend/scripts/run_benchmark.py` now supports `--provider openrouter|deepseek`.
- Official DeepSeek direct call uses `DEEPSEEK_API_KEY`, `https://api.deepseek.com/chat/completions`, and official model IDs.
- DeepSeek usage fields are captured when available: `prompt_cache_hit_tokens`, `prompt_cache_miss_tokens`, `total_tokens`, `reasoning_tokens`, `system_fingerprint`, `finish_reason`.
- `backend/scripts/evaluate_benchmark.py` now supports DeepSeek cache-hit/cache-miss pricing snapshots.

Current blocker:

- Resolved for this run: user provided a DeepSeek official API key in chat. It was used only as a process env var for benchmark commands and was not written to `.env`.

Ready-to-run commands after adding the key:

```bash
cd backend

# Official DeepSeek non-thinking smoke, comparable to current Quick/Balanced RAG behavior.
python3 scripts/run_benchmark.py \
  --provider deepseek \
  --deepseek-thinking disabled \
  --chunk-cache chunks_injection_from_existing_2026-05-04.json \
  --models deepseek-v4-flash,deepseek-v4-pro \
  --test-ids factual_nvidia_01,comparative_nvidia_01,inference_attention_01,negative_nda_01,multilingual_nvidia_zh,table_nvidia_01,adversarial_nvidia_01,ambiguous_nda_01,adversarial_inject_03 \
  --output official_deepseek_v4_smoke_2026-05-05.json

python3 scripts/evaluate_benchmark.py \
  --results official_deepseek_v4_smoke_2026-05-05.json

# Optional: thinking-mode comparison, not directly comparable to Quick latency/cost.
python3 scripts/run_benchmark.py \
  --provider deepseek \
  --deepseek-thinking enabled \
  --reasoning-effort high \
  --chunk-cache chunks_injection_from_existing_2026-05-04.json \
  --models deepseek-v4-flash,deepseek-v4-pro \
  --test-ids factual_nvidia_01,inference_attention_01,table_nvidia_01,adversarial_inject_03 \
  --output official_deepseek_v4_thinking_probe_2026-05-05.json
```

### Official DeepSeek Results

Artifacts:

- `backend/scripts/benchmark_results/official_deepseek_v4_full_2026-05-05.json`
- `backend/scripts/benchmark_results/official_deepseek_v4_full_2026-05-05_scorecard.json`
- `backend/scripts/benchmark_results/official_deepseek_v4_injection_2026-05-05.json`
- `backend/scripts/benchmark_results/official_deepseek_v4_thinking_probe_2026-05-05.json`

Full 54-case non-thinking run through official DeepSeek API:

| Model | Valid | Avg TTFT | P95 TTFT | Avg Total | Cite Acc | OOR | Lang | Neg | Inj | KW Cov | $/1k |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `deepseek-v4-flash` | 54/54 | 818ms | 1,139ms | 2,939ms | 98.1% | 9.1% | 100% | 100% | 100% | 68.2% | $0.26 |
| `deepseek-v4-pro` | 54/54 | 1,366ms | 1,971ms | 6,269ms | 98.1% | 0.8% | 98.1% | 100% | 100% | 69.0% | $0.79 |

Official API materially changes the model recommendation versus OpenRouter routing:

- OpenRouter path had high latency for V4 Pro and misleading long tails.
- Official DeepSeek path is fast enough for interactive use.
- `deepseek-v4-flash` is the best Quick candidate.
- `deepseek-v4-pro` is now a credible Balanced candidate.

Manual review notes:

- V4 Flash occasionally emits source-paper references like `[9]`, `[32]`, `[38]` from the Attention paper; our UI treats `[n]` as chunk citation numbers, so those become out-of-range citations. This is a prompt/output parsing issue to harden before full rollout.
- V4 Pro has much lower out-of-range citation rate, but missed one expected citation in `ambiguous_nda_01` and one zh heuristic failed because the answer contained enough English symbols/technical text to trip the simple language detector.

Thinking-mode probe, 4 cases only:

| Model | Avg TTFT | P95 TTFT | Cite Acc | Inj | KW Cov | $/1k |
|---|---:|---:|---:|---:|---:|---:|
| `deepseek-v4-flash` thinking high | 3,890ms | 5,290ms | 100% | 100% | 56% | $0.12 |
| `deepseek-v4-pro` thinking high | 17,286ms | 41,557ms | 100% | 100% | 69% | $0.70 |

Updated mode recommendation after official API testing:

- Quick: `deepseek-v4-flash`, official API, thinking disabled.
- Balanced: `deepseek-v4-pro`, official API, thinking disabled.
- Thorough: keep `mistralai/mistral-large-2512` until a broader V4 Pro thinking/full-quality run is completed, or introduce a new async/slow "Deep Research" mode using `deepseek-v4-pro` thinking enabled.
