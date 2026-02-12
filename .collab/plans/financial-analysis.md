# DocTalk Financial Controlling Analysis

*Analyst: financial-analyst | Date: 2026-02-10*

---

## 0. Data Sources & Key Assumptions

All numbers derived from:
- **Pricing audit report** (`.collab/plans/pricing-audit-report.md`)
- **Live code**: `config.py`, `credit_service.py`, `billing.py`
- **OpenRouter pricing** as of 2026-02-10

### Baseline Request Profile

| Parameter | Value | Source |
|-----------|-------|--------|
| Avg. prompt tokens | 2,000 | Audit estimate (system ~800 + 8 chunks ~1,000 + history ~200) |
| Avg. completion tokens | 400 | Audit estimate (typical AI answer) |
| Requests/active-user/month (Light) | 30 | ~1/day |
| Requests/active-user/month (Medium) | 100 | ~3-4/day |
| Requests/active-user/month (Heavy) | 250 | ~8/day |
| Mode distribution (default) | 40% Quick / 40% Balanced / 20% Thorough | Realistic mix |
| Mode distribution (heavy Thorough) | 20% Quick / 30% Balanced / 50% Thorough | Sensitivity case |
| Active rate (Free users) | 30% | Industry benchmark for freemium |
| Active rate (Paid users) | 70% | Higher engagement post-conversion |
| Annual billing uptake | 40% | Industry SaaS benchmark |

---

## 1. Unit Economics Per Request

### 1.1 OpenRouter Cost Per Request (COGS)

Using 2,000 input + 400 output tokens:

| Mode | Model | Input Cost | Output Cost | **Total COGS/req** |
|------|-------|-----------|-------------|-------------------|
| Quick | DeepSeek V3.2 | $0.000500 | $0.000152 | **$0.000652** |
| Balanced | Mistral Medium 3.1 | $0.000800 | $0.000800 | **$0.001600** |
| Thorough | Mistral Large 2512 | $0.001000 | $0.000600 | **$0.001600** |

### 1.2 Credits Charged Per Request

| Mode | Credits/req | Notes |
|------|------------|-------|
| Quick | 2 | base_cost=4 x 0.5 multiplier |
| Balanced | 8 | base_cost=8 x 1.0 multiplier |
| Thorough | 24 | base_cost=8 x 3.0 multiplier |

### 1.3 Blended COGS Per Request (Default Mode Mix)

Weighted average at 40/40/20 mix:

```
Blended COGS = 0.40 * $0.000652 + 0.40 * $0.001600 + 0.20 * $0.001600
             = $0.000261 + $0.000640 + $0.000320
             = $0.001221/request
```

Blended credits per request:

```
Blended credits = 0.40 * 2 + 0.40 * 8 + 0.20 * 24
                = 0.8 + 3.2 + 4.8
                = 8.8 credits/request
```

### 1.4 Blended COGS Per Request (Heavy Thorough Mix)

Weighted average at 20/30/50 mix:

```
Blended COGS = 0.20 * $0.000652 + 0.30 * $0.001600 + 0.50 * $0.001600
             = $0.000130 + $0.000480 + $0.000800
             = $0.001410/request
```

Blended credits per request:

```
Blended credits = 0.20 * 2 + 0.30 * 8 + 0.50 * 24
                = 0.4 + 2.4 + 12.0
                = 14.8 credits/request
```

---

## 2. Unit Economics Per Plan Tier

### 2.1 Revenue Per Credit

| Plan | Monthly Price | Annual (per mo) | Credits/mo | Rev/credit (monthly) | Rev/credit (annual) |
|------|-------------|-----------------|-----------|---------------------|---------------------|
| Free | $0.00 | -- | 500 | $0.000 | -- |
| Plus | $9.99 | $7.99 | 3,000 | $0.00333 | $0.00266 |
| Pro | $19.99 | $15.99 | 9,000 | $0.00222 | $0.00178 |

### 2.2 COGS Per Credit (by Mode)

| Mode | Credits/req | COGS/req | **COGS/credit** |
|------|------------|---------|----------------|
| Quick | 2 | $0.000652 | $0.000326 |
| Balanced | 8 | $0.001600 | $0.000200 |
| Thorough | 24 | $0.001600 | $0.000067 |

**Blended COGS/credit (40/40/20 mix):**

```
Blended COGS/credit = $0.001221 / 8.8 = $0.000139/credit
```

### 2.3 Gross Margin Per Plan (Full Credit Utilization, Default Mix)

Assumes 100% of credits consumed at 40/40/20 mode mix:

| Plan | Revenue | COGS (500 or 3K or 9K credits * $0.000139) | Stripe Fee (2.9%+$0.30) | **Gross Profit** | **Gross Margin** |
|------|---------|-------------|-----------|------------|-------------|
| Free (monthly) | $0.00 | $0.069 | $0.00 | -$0.07 | N/A |
| Plus (monthly) | $9.99 | $0.417 | $0.59 | **$8.98** | **89.9%** |
| Plus (annual) | $7.99 | $0.417 | $0.53 | **$7.04** | **88.2%** |
| Pro (monthly) | $19.99 | $1.251 | $0.88 | **$17.86** | **89.3%** |
| Pro (annual) | $15.99 | $1.251 | $0.76 | **$13.98** | **87.4%** |

### 2.4 Gross Margin Per Plan (Full Utilization, Heavy Thorough 20/30/50)

Blended COGS/credit at heavy Thorough: $0.001410 / 14.8 = $0.0000953/credit

| Plan | Revenue | COGS | Stripe Fee | **Gross Profit** | **Gross Margin** |
|------|---------|------|-----------|------------|-------------|
| Free (monthly) | $0.00 | $0.048 | $0.00 | -$0.05 | N/A |
| Plus (monthly) | $9.99 | $0.286 | $0.59 | **$9.11** | **91.2%** |
| Pro (monthly) | $19.99 | $0.858 | $0.88 | **$18.25** | **91.3%** |

**Key finding**: Higher Thorough usage actually **improves** margins because the 3x credit multiplier charges 24 credits for a $0.001600 request, while Balanced charges 8 credits for the same $0.001600 cost. The Thorough multiplier is the most powerful margin mechanism in the system.

### 2.5 Contribution Margin (After Embedding & Demo Costs)

Per-document embedding cost: ~$0.001 (negligible, one-time per upload).
Demo cost per anonymous user: ~5 queries * $0.000652 = $0.0033 (negligible).

These do not materially affect unit economics. Embedding and demo costs together total < $5/month even at 1,000 MAU.

---

## 3. Fixed Cost Structure

### 3.1 Current Monthly Fixed Costs

| Item | Monthly Cost | Annual Cost | Notes |
|------|------------|------------|-------|
| Railway (Backend) | $5-20 | $60-240 | Hobby/Starter tier; includes Postgres, Redis, Qdrant, MinIO, backend |
| Railway (scale-up estimate at 1K users) | $20-40 | $240-480 | 2 GB RAM, higher DB queries |
| Railway (10K users) | $60-150 | $720-1,800 | Multiple replicas, larger DB |
| Vercel (Frontend) | $0 | $0 | Hobby plan (currently sufficient) |
| Vercel Pro (if needed at scale) | $20 | $240 | For higher function timeout/bandwidth |
| Domain (doctalk.site) | $1 | $12 | Amortized |
| OpenRouter (embedding, demo, free tier) | $2-10 | $24-120 | Variable; scales with user count |
| **Total (current)** | **~$10-30** | **$120-360** | Pre-revenue/early stage |
| **Total (1K users)** | **~$25-60** | **$300-720** | -- |
| **Total (10K users)** | **~$85-200** | **$1,020-2,400** | -- |

### 3.2 Stripe Processing Costs (Variable)

Per-transaction: 2.9% + $0.30

| Revenue/mo | Stripe Fee | Effective % |
|-----------|-----------|-------------|
| $100 (~10 paid users) | ~$6 | 6.0% |
| $500 (~40 paid users) | ~$27 | 5.4% |
| $2,000 (~150 paid users) | ~$88 | 4.4% |
| $10,000 (~750 paid users) | ~$320 | 3.2% |

The $0.30 per-transaction fixed fee is significant at low revenue but becomes negligible at scale.

---

## 4. Break-Even Analysis

### 4.1 Break-Even by Plan Tier

**Question: How many paying subscribers are needed to cover fixed costs?**

Using contribution profit per subscriber (full utilization, default mode mix):

| Plan | Monthly Contribution (after COGS + Stripe) | Subscribers needed for $30/mo fixed cost | Subscribers needed for $60/mo fixed cost |
|------|---------------------------------------------|----------------------------------------|----------------------------------------|
| Plus (monthly) | $8.98 | 4 | 7 |
| Plus (annual) | $7.04 | 5 | 9 |
| Pro (monthly) | $17.86 | 2 | 4 |
| Pro (annual) | $13.98 | 3 | 5 |

**Break-even is extremely low** -- just 4-9 paid subscribers cover current infrastructure costs.

### 4.2 Break-Even Including Free Tier Drag

Free users consume $0.07/month in LLM costs. At 500 users (80% free = 400 free * 30% active = 120 active free):

```
Free tier drag = 120 active free * $0.07/mo = $8.40/mo
```

This is negligible and well-covered by even a handful of paid subscribers.

### 4.3 Break-Even at Scale (with scaled-up infrastructure)

At 1,000 total users with $60/mo fixed costs:

| Conversion Rate | Paid Users | MRR (blended $14 ARPU) | COGS + Stripe | Fixed | **Monthly P&L** |
|-----------------|-----------|------------------------|--------------|-------|-----------------|
| 3% | 30 | $420 | ~$45 | $60 | **+$315** |
| 5% | 50 | $700 | ~$70 | $60 | **+$570** |
| 8% | 80 | $1,120 | ~$110 | $60 | **+$950** |

At 10,000 total users with $150/mo fixed costs:

| Conversion Rate | Paid Users | MRR | COGS + Stripe | Fixed | **Monthly P&L** |
|-----------------|-----------|-----|--------------|-------|-----------------|
| 3% | 300 | $4,200 | ~$430 | $150 | **+$3,620** |
| 5% | 500 | $7,000 | ~$700 | $150 | **+$6,150** |
| 8% | 800 | $11,200 | ~$1,100 | $150 | **+$9,950** |

---

## 5. Scenario Analysis

### 5.1 User Mix Assumptions (3 Scenarios)

| Metric | Pessimistic | Base | Optimistic |
|--------|------------|------|-----------|
| Total users (Month 12) | 1,000 | 3,000 | 8,000 |
| Conversion rate | 3% | 5% | 8% |
| Paid users | 30 | 150 | 640 |
| Plan split (Plus:Pro) | 70:30 | 60:40 | 50:50 |
| Annual billing uptake | 30% | 40% | 50% |
| Monthly churn (paid) | 8% | 5% | 3% |
| Credit utilization (of monthly allotment) | 80% | 60% | 50% |
| Mode mix | 40/40/20 | 40/40/20 | 30/30/40 |

### 5.2 Monthly Revenue (Month 12)

**Pessimistic (30 paid users, 70/30 Plus:Pro split):**

| Segment | Count | Pricing | Revenue/mo |
|---------|-------|---------|-----------|
| Plus monthly | 15 | $9.99 | $149.85 |
| Plus annual | 6 | $7.99 | $47.94 |
| Pro monthly | 6 | $19.99 | $119.94 |
| Pro annual | 3 | $15.99 | $47.97 |
| **Total MRR** | **30** | | **$365.70** |

**Base (150 paid users, 60/40 Plus:Pro split):**

| Segment | Count | Pricing | Revenue/mo |
|---------|-------|---------|-----------|
| Plus monthly | 54 | $9.99 | $539.46 |
| Plus annual | 36 | $7.99 | $287.64 |
| Pro monthly | 36 | $19.99 | $719.64 |
| Pro annual | 24 | $15.99 | $383.76 |
| **Total MRR** | **150** | | **$1,930.50** |

**Optimistic (640 paid users, 50/50 Plus:Pro split):**

| Segment | Count | Pricing | Revenue/mo |
|---------|-------|---------|-----------|
| Plus monthly | 160 | $9.99 | $1,598.40 |
| Plus annual | 160 | $7.99 | $1,278.40 |
| Pro monthly | 160 | $19.99 | $3,198.40 |
| Pro annual | 160 | $15.99 | $2,558.40 |
| **Total MRR** | **640** | | **$8,633.60** |

### 5.3 Blended ARPU

| Scenario | MRR | Paid Users | **Blended ARPU** |
|----------|-----|-----------|------------------|
| Pessimistic | $365.70 | 30 | **$12.19** |
| Base | $1,930.50 | 150 | **$12.87** |
| Optimistic | $8,633.60 | 640 | **$13.49** |

### 5.4 Monthly P&L (Month 12)

**Pessimistic:**

| Line Item | Amount |
|-----------|--------|
| Subscription MRR | $365.70 |
| Credit pack revenue (est. 5% of sub) | $18.29 |
| **Total Revenue** | **$383.99** |
| (-) LLM COGS (30 users * blended) | -$12.30 |
| (-) Free tier LLM (300 active free * $0.07) | -$21.00 |
| (-) Demo LLM (est.) | -$3.00 |
| (-) Embedding (est.) | -$1.00 |
| (-) Stripe fees | -$20.12 |
| (-) Railway infra | -$20.00 |
| (-) Domain (amortized) | -$1.00 |
| **Net Income** | **+$305.57** |
| **Net Margin** | **79.6%** |

**Base:**

| Line Item | Amount |
|-----------|--------|
| Subscription MRR | $1,930.50 |
| Credit pack revenue (est. 5% of sub) | $96.53 |
| **Total Revenue** | **$2,027.03** |
| (-) LLM COGS (150 users * blended) | -$60.00 |
| (-) Free tier LLM (900 active free * $0.07) | -$63.00 |
| (-) Demo LLM (est.) | -$5.00 |
| (-) Embedding (est.) | -$3.00 |
| (-) Stripe fees | -$80.38 |
| (-) Railway infra | -$35.00 |
| (-) Vercel (if Pro) | -$20.00 |
| (-) Domain (amortized) | -$1.00 |
| **Net Income** | **+$1,759.65** |
| **Net Margin** | **86.8%** |

**Optimistic:**

| Line Item | Amount |
|-----------|--------|
| Subscription MRR | $8,633.60 |
| Credit pack revenue (est. 5% of sub) | $431.68 |
| **Total Revenue** | **$9,065.28** |
| (-) LLM COGS (640 users * blended) | -$220.00 |
| (-) Free tier LLM (2,240 active free * $0.07) | -$156.80 |
| (-) Demo LLM (est.) | -$15.00 |
| (-) Embedding (est.) | -$10.00 |
| (-) Stripe fees | -$293.19 |
| (-) Railway infra | -$80.00 |
| (-) Vercel Pro | -$20.00 |
| (-) Domain (amortized) | -$1.00 |
| **Net Income** | **+$8,269.29** |
| **Net Margin** | **91.2%** |

---

## 6. Sensitivity Analysis: What If 50% Use Thorough?

The Thorough 3x multiplier means users burn credits 3x faster but actual COGS/request is the same as Balanced. Higher Thorough usage:
1. Increases credits consumed per request (users hit credit cap sooner)
2. Does NOT increase COGS proportionally
3. Creates stronger upgrade pressure (credits deplete faster)

### 6.1 Impact on Credit Consumption Speed

| Mode Mix | Avg. Credits/req | Queries to burn 3K (Plus) | Queries to burn 9K (Pro) |
|----------|-----------------|--------------------------|--------------------------|
| 40/40/20 (default) | 8.8 | 341 | 1,023 |
| 20/30/50 (heavy Thorough) | 14.8 | 203 | 608 |
| 0/0/100 (all Thorough) | 24.0 | 125 | 375 |

At heavy Thorough (50%), Plus users get ~203 queries/month (still ~7/day), and Pro users get ~608 (still ~20/day). This is still generous for most use cases.

### 6.2 Impact on COGS

| Mode Mix | Blended COGS/req | COGS to serve 3K credits (Plus) | COGS to serve 9K credits (Pro) |
|----------|-----------------|-------------------------------|-------------------------------|
| 40/40/20 | $0.001221 | $0.42 | $1.25 |
| 20/30/50 | $0.001410 | $0.29 | $0.86 |
| 0/0/100 | $0.001600 | $0.20 | $0.60 |

**Counter-intuitive result**: Higher Thorough usage actually **decreases** COGS per plan because users consume fewer total requests (credits run out faster). COGS is proportional to requests, not credits.

### 6.3 Margin Impact

| Plan | Mode Mix | Revenue | COGS | Stripe | **Margin** |
|------|----------|---------|------|--------|-----------|
| Plus (monthly) | 40/40/20 | $9.99 | $0.42 | $0.59 | **$8.98 (89.9%)** |
| Plus (monthly) | 20/30/50 | $9.99 | $0.29 | $0.59 | **$9.11 (91.2%)** |
| Plus (monthly) | 0/0/100 | $9.99 | $0.20 | $0.59 | **$9.20 (92.1%)** |
| Pro (monthly) | 40/40/20 | $19.99 | $1.25 | $0.88 | **$17.86 (89.3%)** |
| Pro (monthly) | 20/30/50 | $19.99 | $0.86 | $0.88 | **$18.25 (91.3%)** |
| Pro (monthly) | 0/0/100 | $19.99 | $0.60 | $0.88 | **$18.51 (92.6%)** |

**Conclusion**: Thorough mode usage is a NET POSITIVE for margins. The 3x multiplier is the most effective margin lever in the pricing system. Encouraging Thorough usage (by making the quality difference noticeable) is actually good for the business.

---

## 7. Lifetime Value (LTV) Analysis

### 7.1 Monthly Churn Assumptions

| Plan | Monthly Churn | Avg. Lifetime (1/churn) | Annual Churn Equivalent |
|------|-------------|------------------------|------------------------|
| Free | N/A | N/A | N/A |
| Plus (monthly) | 7% | 14.3 months | 58% |
| Plus (annual) | 2.5%/mo (effective) | 40 months | 26% |
| Pro (monthly) | 5% | 20 months | 46% |
| Pro (annual) | 2%/mo (effective) | 50 months | 22% |

Annual subscribers have lower effective churn because the upfront commitment filters for more engaged users, and the annual lock-in prevents impulsive cancellation.

### 7.2 LTV Per Tier

LTV = ARPU * Avg. Lifetime * Gross Margin %

| Tier | Monthly ARPU | Avg. Lifetime (mo) | Gross Margin | **LTV** |
|------|-------------|-------------------|-------------|---------|
| Plus (monthly) | $9.99 | 14.3 | 89.9% | **$128.47** |
| Plus (annual) | $7.99 | 40 | 88.2% | **$281.87** |
| Pro (monthly) | $19.99 | 20 | 89.3% | **$357.02** |
| Pro (annual) | $15.99 | 50 | 87.4% | **$698.76** |

### 7.3 Blended LTV

Using base scenario plan/billing mix (60/40 Plus:Pro, 40% annual):

```
Blended LTV = 0.60 * [0.60 * $128.47 + 0.40 * $281.87]
            + 0.40 * [0.60 * $357.02 + 0.40 * $698.76]
            = 0.60 * [$77.08 + $112.75]
            + 0.40 * [$214.21 + $279.50]
            = 0.60 * $189.83 + 0.40 * $493.71
            = $113.90 + $197.48
            = $311.38
```

**Blended LTV: ~$311**

### 7.4 LTV/CAC Targets

| CAC | LTV/CAC Ratio | Assessment |
|-----|-------------|-----------|
| $5 (organic/SEO) | 62:1 | Excellent |
| $15 (content marketing) | 21:1 | Excellent |
| $30 (paid social) | 10:1 | Good |
| $50 (Google Ads) | 6:1 | Acceptable |
| $100 (enterprise outbound) | 3:1 | Minimum viable |

Industry benchmark: LTV/CAC > 3:1 is healthy. DocTalk can sustain up to ~$100 CAC before the ratio becomes concerning. This gives significant headroom for paid acquisition.

### 7.5 CAC Payback Period

| Tier | Monthly Contribution | CAC=$30 Payback | CAC=$50 Payback |
|------|---------------------|----------------|----------------|
| Plus (monthly) | $8.98 | 3.3 months | 5.6 months |
| Pro (monthly) | $17.86 | 1.7 months | 2.8 months |
| Blended | $12.53 | 2.4 months | 4.0 months |

Payback under 6 months is excellent for SaaS.

---

## 8. Credit Pack Revenue Impact Analysis

### 8.1 Current Pack Economics (Cannibalizing Subscriptions)

| Pack | Credits | Price | $/1K Credits | Gross Margin (after COGS) |
|------|---------|-------|-------------|--------------------------|
| Starter | 5,000 | $5.00 | $1.00 | $5.00 - $0.70 - $0.45 = **$3.85 (77%)** |
| Pro | 20,000 | $15.00 | $0.75 | $15.00 - $2.78 - $0.74 = **$11.48 (77%)** |
| Enterprise | 100,000 | $50.00 | $0.50 | $50.00 - $13.90 - $1.75 = **$34.35 (69%)** |

COGS calculation: credits / 8.8 avg credits per request * $0.001221 avg COGS per request.

### 8.2 Cannibalization Risk

A rational Plus subscriber paying $9.99/mo for 3,000 credits ($3.33/1K credits) could instead:
- Buy 1 Starter pack: 5,000 credits for $5.00 ($1.00/1K credits) -- **3.3x cheaper per credit**
- Buy 1 Enterprise pack: 100,000 credits for $50.00 ($0.50/1K credits) -- **6.7x cheaper per credit**

At 100 queries/month (moderate usage), a Plus user consumes ~880 credits. A single Starter pack ($5) provides 5,000 credits = ~5.7 months of usage. The subscription costs $57 for the same period.

**Revenue impact model**: If 20% of potential Plus subscribers buy packs instead:

| Scenario | Lost sub revenue/year | Pack revenue gained | **Net impact** |
|----------|---------------------|-------------------|----|
| 10 users switch from Plus monthly to Starter packs | -$1,199 | +$120 (2 packs/user/yr) | **-$1,079/yr** |
| 10 users switch from Pro monthly to Enterprise packs | -$2,399 | +$50 (1 pack/user/yr) | **-$2,349/yr** |

### 8.3 Recommended Pack Repricing

Packs should be priced as emergency top-ups, MORE expensive per-credit than subscriptions:

| Pack | Credits | New Price | New $/1K Credits | vs Plus Monthly ($3.33/1K) |
|------|---------|-----------|-----------------|---------------------------|
| Boost | 500 | $3.99 | $7.98 | 2.4x more expensive |
| Power | 2,000 | $9.99 | $5.00 | 1.5x more expensive |
| Ultra | 5,000 | $19.99 | $4.00 | 1.2x more expensive |

This ensures:
1. Subscriptions are always the best per-credit value
2. Packs serve as impulse/emergency purchases
3. Pack margins are higher (incentive for DocTalk to offer them)
4. Volume discount within packs still exists (Boost > Power > Ultra per credit)
5. Even Ultra ($4.00/1K) is more expensive than Pro annual ($1.78/1K), preserving upgrade incentive

---

## 9. Monthly Burn Rate at Scale

### 9.1 Expense Breakdown by Scale

| Cost Category | 100 users | 1,000 users | 10,000 users |
|---------------|----------|------------|-------------|
| Railway (backend infra) | $10 | $30 | $120 |
| Vercel (frontend) | $0 | $0-20 | $20 |
| OpenRouter LLM (paid users) | $2 | $20 | $200 |
| OpenRouter LLM (free users) | $2 | $20 | $140 |
| OpenRouter LLM (demo) | $1 | $5 | $15 |
| OpenRouter Embedding | $0.10 | $1 | $10 |
| Stripe fees | $2 | $30 | $300 |
| Domain | $1 | $1 | $1 |
| **Total Expenses** | **~$18** | **~$127** | **~$806** |
| | | | |
| Paid users (at 5% conversion) | 5 | 50 | 500 |
| **Subscription Revenue** | ~$65 | ~$644 | **~$6,435** |
| **Net Income** | **+$47** | **+$517** | **+$5,629** |
| **Net Margin** | **72%** | **80%** | **87%** |

### 9.2 Key Observations

1. **DocTalk is profitable from Day 1** with even a handful of paid subscribers. The extremely low infrastructure costs (Railway ~$10-30/mo) and minimal per-request LLM costs make break-even trivially achievable.

2. **Margins improve with scale** because fixed costs (Railway, Vercel, domain) are amortized across more users, while variable costs (LLM COGS) remain tiny per-user.

3. **Free tier is essentially free to operate**: At $0.07/active-free-user/month, even 1,000 active free users cost only $70/month -- easily covered by a handful of paid subscribers.

4. **Stripe fees are the largest variable cost**, not LLM COGS. At scale, Stripe takes 3.2% while LLM COGS is ~2-3% of revenue.

---

## 10. Risk Factors & Sensitivity

### 10.1 OpenRouter Price Changes

If OpenRouter raises prices 2x:

| Current COGS | 2x COGS | Impact on Plus Margin | Impact on Pro Margin |
|-------------|---------|---------------------|---------------------|
| $0.42/mo | $0.84/mo | 89.9% -> 85.7% | 89.3% -> 83.1% |

Even a 2x price increase only drops margins by ~5 points. The business is highly resilient to API price increases because LLM COGS is such a small fraction of revenue.

### 10.2 Churn Sensitivity

| Monthly Churn | Avg. Lifetime | Blended LTV | Impact |
|-------------|-------------|------------|--------|
| 3% | 33 months | ~$540 | +74% LTV |
| 5% (base) | 20 months | ~$311 | Baseline |
| 8% | 12.5 months | ~$195 | -37% LTV |
| 12% | 8.3 months | ~$130 | -58% LTV |

Churn is the dominant factor in LTV. Reducing churn from 5% to 3% increases LTV by 74%, while increasing it to 8% cuts LTV by 37%.

### 10.3 Token Usage Variance

If average request uses 3,000 input + 600 output (50% above baseline):

| Mode | New COGS/req | Increase |
|------|-------------|---------|
| Quick | $0.000978 | +50% |
| Balanced | $0.002400 | +50% |
| Thorough | $0.002400 | +50% |

New blended COGS/credit: $0.000208 (vs baseline $0.000139). Impact on Plus margin: 89.9% -> 87.3%. Still healthy.

### 10.4 Competition Drives Price Down

If forced to cut subscription prices by 30%:

| Plan | New Price | New Margin (default mix) |
|------|----------|------------------------|
| Plus | $6.99 | 85.0% |
| Pro | $13.99 | 84.3% |

Still viable. The cost structure supports aggressive pricing competition.

---

## 11. Summary of Key Findings

### Strengths

1. **Exceptionally high gross margins (87-92%)** across all scenarios. LLM COGS is negligible relative to subscription revenue.
2. **Break-even at 4-9 paid subscribers**. The business is self-sustaining with minimal traction.
3. **Thorough mode 3x multiplier is the best margin mechanism** -- charges 3x credits for the same COGS, and higher Thorough adoption actually improves margins.
4. **Free tier drag is negligible** ($0.07/user/month). Can afford to be generous with free credits.
5. **LTV of $311+ blended** supports CAC up to $100 with healthy 3:1+ ratio.
6. **Margins improve with scale** -- fixed costs are tiny and Stripe is the largest variable cost.
7. **Resilient to 2x API price increases** -- margins only drop ~5 points.

### Risks

1. **Credit pack cannibalization** (P0) -- packs are 3-7x cheaper per credit than subscriptions. Must reprice.
2. **Churn sensitivity** -- moving from 5% to 8% monthly churn cuts LTV by 37%.
3. **Feature gating gaps** -- 4 features (OCR, export, custom prompts, sessions) claimed as paid but not enforced. Undermines upgrade incentive.
4. **No team/enterprise tier** -- missing high-ARPU segment entirely. A $30/seat/mo tier with 10 seats = $300 MRR per account.

### Recommendations (Priority Order)

| # | Action | Revenue Impact | Effort |
|---|--------|---------------|--------|
| 1 | **Reprice credit packs** (Boost $3.99/500cr, Power $9.99/2K, Ultra $19.99/5K) | Prevents ~$1-2K/yr revenue leakage per 10 pack-switchers | S -- config change |
| 2 | **Enforce feature gating** (OCR, export, custom prompts) | Increases conversion rate by creating clearer upgrade triggers | M -- backend guards |
| 3 | **Reduce churn** (cancel flow with pause/downgrade, usage emails) | +74% LTV at 3% churn vs 5% | M -- new UX flows |
| 4 | **Ship Team tier** ($29.99/seat) | Could be 15-25% of revenue within 6 months | L -- new infra |
| 5 | **Promote Thorough mode** (make quality gap visible) | Higher Thorough usage = higher margins + faster credit depletion = more upgrades | S -- UX tweaks |
| 6 | **Implement overage billing** (auto-charge when credits run out) | Captures 5-10% incremental revenue | M -- Stripe + backend |

---

## Appendix A: Financial Model Assumptions Summary

| Parameter | Value | Source |
|-----------|-------|--------|
| OpenRouter DeepSeek V3.2 pricing | $0.25/$0.38 per M tokens | OpenRouter live |
| OpenRouter Mistral Medium 3.1 pricing | $0.40/$2.00 per M tokens | OpenRouter live |
| OpenRouter Mistral Large 2512 pricing | $0.50/$1.50 per M tokens | OpenRouter live |
| Avg. prompt tokens per request | 2,000 | Audit estimate |
| Avg. completion tokens per request | 400 | Audit estimate |
| Default mode mix | 40% Quick / 40% Balanced / 20% Thorough | Estimated |
| Stripe fee | 2.9% + $0.30/txn | Stripe standard |
| Railway hosting (current) | $10-20/mo | Railway Hobby/Starter |
| Free user active rate | 30% | Industry benchmark |
| Paid user active rate | 70% | Industry benchmark |
| Monthly churn (Plus) | 7% | SaaS mid-range |
| Monthly churn (Pro) | 5% | SaaS mid-range |
| Annual billing uptake | 40% | SaaS benchmark |
| Conversion rate | 3-8% | Freemium AI tool range |

## Appendix B: Revenue Waterfall (Base Scenario, 12-Month)

```
Month 1:  Users   600 | Paid  30 | MRR   $387  | Net  $330
Month 2:  Users   720 | Paid  36 | MRR   $464  | Net  $400
Month 3:  Users   864 | Paid  43 | MRR   $554  | Net  $485
Month 4:  Users 1,037 | Paid  52 | MRR   $670  | Net  $590
Month 5:  Users 1,244 | Paid  62 | MRR   $799  | Net  $705
Month 6:  Users 1,493 | Paid  75 | MRR   $967  | Net  $855
Month 7:  Users 1,792 | Paid  90 | MRR $1,160  | Net $1,025
Month 8:  Users 2,150 | Paid 108 | MRR $1,392  | Net $1,230
Month 9:  Users 2,580 | Paid 129 | MRR $1,663  | Net $1,470
Month 10: Users 3,096 | Paid 155 | MRR $1,998  | Net $1,765
Month 11: Users 3,715 | Paid 186 | MRR $2,398  | Net $2,120
Month 12: Users 4,458 | Paid 223 | MRR $2,874  | Net $2,540

Year 1 Cumulative Revenue:  ~$15,326
Year 1 Cumulative Net:      ~$13,515
Year 1 ARR (Month 12 * 12): ~$34,488
```

Assumptions: 20% monthly user growth, 5% conversion, 60/40 Plus:Pro split, 40% annual billing, ~$12.87 blended ARPU.
