# Cost to serve, and what the free allowance really is (Claude, 2026-09-22)

The inputs are the owner-run export (`export_qa.py`, 2026-09-22 12:48Z) and DeepSeek's pricing page. Only
aggregates appear here, no user text.

## The export at a glance

| Measure | Value |
|---|---|
| Non-owner users | 175 |
| … with at least one conversation | 67 |
| Sessions with messages | 93 (81 on own documents, 12 on demo documents) |
| User messages / assistant messages | 311 / 283 |
| Own documents | 120 (106 PDF, 10 DOCX); **15 in `error` status (12.5%)** |
| Pages of own documents | p50 **51**, p90 **289**, max 696 |
| Anonymous demo sessions | 182, with 236 user messages |
| Message dates | 2026-03-19 to 2026-09-04 |

- **Answers are missing for 28 messages.** 311 user messages got 283 assistant replies. This is consistent with
  the known lost-answer class (asst=0; memory `asst0-and-remediation-consensus-2026-05-24`), to be split by date
  in the analysis.
- **Most users stopped early.** User messages per active user:

  | Messages | 1 | 2 | 3 | 4–10 | 11+ |
  |---|---|---|---|---|---|
  | Users | 20 | 13 | 10 | 15 | 9 |

- **Events:** `citation_clicked` 163, `paywall_opened` 73, `upgrade_click` 37, `limit_hit` 32,
  `checkout_created` 2, `checkout_completed` 1.

## What the free allowance really is

This corrects `../2026-09-22-pricing-research/00-brief.md` §2 and 02 §1, which said "month one ≈ 800 credits".

- **The monthly grant almost never happens.** Signup writes `monthly_credits_granted_at = now`
  (`auth_service.py`, the `User(...)` constructor). So the first monthly 300 arrives only with a chat at least 30
  days after signup. Across all 175 users the ledger shows **`monthly_allowance` = 600 credits in total: two
  grants, ever.** In practice Free is a **one-time 500-credit pool**, not a monthly plan.
- **A Flash answer costs about 11 credits, not 5.** From `usage_records`:

  | Model | Calls | Credits | Credits per call |
  |---|---|---|---|
  | deepseek-v4-flash | 285 | 3,195 | 11.2 |
  | deepseek-v4-pro | 8 | 203 | 25 |
  | deepseek/deepseek-v3.2 (legacy) | 181 | 716 | 4.0 |
  | mistral-medium-3.1 (legacy) | 24 | 500 | 21 |

  The 5-credit figure is the pre-debit estimate; reconciliation charges the actual cost. So **500 credits ≈ 45
  Flash answers**, and a month of 300 ≈ 27, not 60. Any "readable unit" copy has to use these numbers.
- **How much of the allowance is used:** users have spent **4,787 credits on chat in total**, against 129,500
  granted as signup bonuses. That is about 71 credits per active user, **about 14% of the 500 each received**.
  The distribution is `free_quota_at_churn.py` §6's job.

## Cost per answer (LLM only)

DeepSeek prices, per 1M tokens, from https://api-docs.deepseek.com/quick_start/pricing (accessed 2026-09-22).
Off-peak is half of peak.

| Model | Input, cache miss (peak) | Input, cache hit (peak) | Output (peak) |
|---|---|---|---|
| deepseek-flash (V4 Flash) | $0.30 | $0.006 | $1.20 |
| deepseek-v4-pro | $1.32 | $0.044 | $3.96 |

Average tokens per call, from the export:

| Model | Prompt tokens | Completion tokens |
|---|---|---|
| V4 Flash | 8,164 | 1,041 |
| V4 Pro | 10,297 | 799 |

Cost per answer at peak with no cache hits, an upper bound:
- **Flash:** 8,164 × $0.30/M + 1,041 × $1.20/M ≈ **$0.0037**.
- **Pro:** 10,297 × $1.32/M + 799 × $3.96/M ≈ **$0.017**.

What users pay per credit:

| Source | Price per credit |
|---|---|
| Plus ($9.99 / 3,000) | $0.00333 |
| Pro ($19.99 / 9,000) | $0.00222 |
| Boost pack ($3.99 / 500) | $0.00798 |

At about 11 credits, a Flash answer earns ≈ **$0.037** on Plus against ≈ $0.0037 of LLM cost (~90% margin). A
Pro answer at about 25 credits earns ≈ $0.083 against ≈ $0.017 (~80%).

**Not included:** embeddings (OpenRouter), OCR/parse workers, the RetainPDF sidecar, Railway and Vercel
infrastructure. All of them are per-document or fixed, not per-answer.

**Total LLM spend on every non-owner user, ever: a few dollars.** For example, 285 Flash calls ≈ $1.05.

## What this means for capability upgrades

LLM price is not what limits answer quality. Take a large-document answer that sends 4× the context: 32k prompt
tokens on Flash is ≈ $0.011, still under a third of what the same answer earns on Plus.

What limits it is engineering: retrieval on large documents, OCR, tables, whole-document tasks. A more expensive
model for hard questions is affordable too, as long as credits reconcile to actual cost, which they already do.
