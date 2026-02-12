# DocTalk Financial Controlling: Break-Even & Profit Analysis

*Auditor: pricing-auditor | Date: 2026-02-10*

---

## 1. Cost Structure

### 1.1 Fixed Costs (Monthly)

| Cost Item | Amount | Notes |
|-----------|--------|-------|
| **Railway Hobby Plan** | $5.00 | Subscription fee (includes $5 resource credit) |
| **Railway Resource Usage** | $10-25 | 5 services: backend, Postgres, Redis, Qdrant, MinIO. Likely ~$15-25 overage beyond $5 credit |
| **Vercel (Frontend)** | $0 | Hobby plan (free). May need Pro ($20/mo) at scale |
| **Domain** | $1.00 | ~$12/yr amortized |
| **Total Fixed** | **$16-31** | Conservative: $20/mo, scaling: $50/mo |

**Railway resource breakdown estimate** (5 services):
- Backend (uvicorn + Celery): ~0.5 vCPU, 512MB RAM = $10 + $5 = $15/mo
- PostgreSQL: ~0.25 vCPU, 256MB RAM, 2GB disk = $5 + $2.56 + $0.30 = $7.86/mo
- Redis: ~0.1 vCPU, 128MB RAM = $2 + $1.28 = $3.28/mo
- Qdrant: ~0.25 vCPU, 256MB RAM, 1GB disk = $5 + $2.56 + $0.15 = $7.71/mo
- MinIO: ~0.1 vCPU, 128MB RAM, 5GB disk = $2 + $1.28 + $0.75 = $4.03/mo
- **Subtotal**: ~$37.88/mo, minus $5 credit = **$32.88/mo overage**
- **Total Railway**: $5 subscription + $32.88 overage = **~$38/mo**

*Note: These are estimates. Actual usage depends on traffic and can be optimized with sleep policies.*

For this analysis, I'll use **$40/mo as the fixed infrastructure cost**.

### 1.2 Variable Costs (Per Request)

From the pricing audit, using typical request (2K input + 400 output tokens):

| Mode | Model | Cost/Request | Notes |
|------|-------|-------------|-------|
| Quick | DeepSeek V3.2 | $0.000652 | Cheapest |
| Balanced | Mistral Medium 3.1 | $0.001600 | Default |
| Thorough | Mistral Large 2512 | $0.001600 | Same as Balanced (cheaper output) |
| Demo | DeepSeek V3.2 | $0.000652 | Free to user, costs provider |
| Embedding | text-embedding-3-small | $0.001/doc | One-time per document |

### 1.3 Transaction Costs (Stripe)

| Fee Type | Rate | Notes |
|----------|------|-------|
| Processing | 2.9% + $0.30 | Per transaction |
| Billing subscription | +0.5% | Additional for recurring |
| **Effective subscription rate** | **3.4% + $0.30** | Per subscription charge |

| Plan | Monthly Price | Stripe Fee | Net Revenue |
|------|-------------|-----------|-------------|
| Plus (monthly) | $9.99 | $0.64 | $9.35 |
| Plus (annual) | $95.88/yr | $3.56/yr | $92.32/yr ($7.69/mo) |
| Pro (monthly) | $19.99 | $0.98 | $19.01 |
| Pro (annual) | $191.88/yr | $6.82/yr | $185.06/yr ($15.42/mo) |

---

## 2. Unit Economics Per Subscriber

### 2.1 Revenue Per Subscriber (After Stripe)

| Plan | Monthly Net Revenue | Annual Net Revenue (per month) |
|------|--------------------|-----------------------------|
| Plus | $9.35 | $7.69 |
| Pro | $19.01 | $15.42 |

### 2.2 COGS Per Subscriber (LLM API Only)

Using realistic usage mix: 40% Quick, 40% Balanced, 20% Thorough

**Plus subscriber** (3,000 credits/mo, ~568 queries at blended ~5.3 credits/query):

| Usage Scenario | Utilization | Queries/mo | LLM COGS | Net Revenue (monthly) | **Gross Margin** |
|---------------|-------------|-----------|----------|----------------------|----------------|
| Light (25%) | 750 credits | 142 | $0.16 | $9.35 | **98.3%** |
| Medium (60%) | 1,800 credits | 340 | $0.38 | $9.35 | **95.9%** |
| Heavy (90%) | 2,700 credits | 510 | $0.57 | $9.35 | **93.9%** |
| Max (100%) | 3,000 credits | 568 | $0.63 | $9.35 | **93.3%** |

**Pro subscriber** (9,000 credits/mo, ~1,688 queries at blended ~5.3 credits/query):

| Usage Scenario | Utilization | Queries/mo | LLM COGS | Net Revenue (monthly) | **Gross Margin** |
|---------------|-------------|-----------|----------|----------------------|----------------|
| Light (25%) | 2,250 credits | 425 | $0.47 | $19.01 | **97.5%** |
| Medium (60%) | 5,400 credits | 1,019 | $1.13 | $19.01 | **94.1%** |
| Heavy (90%) | 8,100 credits | 1,528 | $1.70 | $19.01 | **91.1%** |
| Max (100%) | 9,000 credits | 1,688 | $1.87 | $19.01 | **90.2%** |

**Key takeaway**: Even at 100% credit utilization, margins are >90% on LLM COGS. The subscription model is excellent for this cost structure.

### 2.3 Free Tier Cost

| Metric | Value |
|--------|-------|
| Monthly credits | 500 |
| Typical queries (60% utilization, blended mix) | 57 |
| LLM COGS | $0.063 |
| **Cost per free user per month** | **$0.06** |

At 1,000 free users: $63/month in LLM costs. Affordable.

### 2.4 Demo User Cost

| Metric | Value |
|--------|-------|
| Messages per session | 5 max |
| Cost per session (DeepSeek V3.2) | 5 * $0.000652 = $0.00326 |
| Sessions per unique visitor (estimate) | 1-2 |
| **Cost per demo visitor** | **$0.003-0.007** |

At 1,000 demo visitors/month: $3-7/month. Negligible.

---

## 3. Break-Even Analysis

### 3.1 Monthly Break-Even (Fixed Costs Only)

Fixed costs: $40/mo (infrastructure)

| Plan | Net Revenue/Sub | Break-Even Subs |
|------|----------------|----------------|
| Plus (monthly) | $9.35 | **5 subscribers** |
| Pro (monthly) | $19.01 | **3 subscribers** |
| Blended ($14 ARPU) | $13.10 | **4 subscribers** |

**DocTalk breaks even with just 3-5 paid subscribers.** This is an extremely low bar.

### 3.2 Including LLM Variable Costs

At 50% credit utilization (medium usage), each subscriber adds ~$0.50/mo COGS.

| Metric | 10 Paid Users | 50 Paid Users | 200 Paid Users |
|--------|-------------|-------------|---------------|
| Gross Revenue | $140 | $700 | $2,800 |
| Stripe Fees | $11 | $55 | $220 |
| LLM COGS | $5 | $25 | $100 |
| Infrastructure | $40 | $40 | $60 |
| **Net Profit** | **$84** | **$580** | **$2,420** |
| **Net Margin** | **60.0%** | **82.9%** | **86.4%** |

*Assumes blended ARPU of $14/mo (mix of Plus + Pro), infrastructure scales to $60/mo at 200 users*

### 3.3 Including Free User Costs

| Scenario | Free Users | Paid Users | Free:Paid Ratio | Total Revenue | Total Costs | **Net Profit** |
|----------|-----------|-----------|----------------|--------------|------------|---------------|
| Early | 200 | 10 | 20:1 | $140/mo | $68 | **$72/mo** |
| Growing | 1,000 | 50 | 20:1 | $700/mo | $158 | **$542/mo** |
| Scaling | 5,000 | 250 | 20:1 | $3,500/mo | $608 | **$2,892/mo** |
| Mature | 20,000 | 1,000 | 20:1 | $14,000/mo | $2,160 | **$11,840/mo** |

*Costs include: Stripe fees + LLM COGS (paid users at 50% utilization + free users at 30% utilization) + infrastructure*

---

## 4. Sensitivity Analysis

### 4.1 What if Thorough Mode Usage is High?

The 3x credit multiplier means Thorough mode burns credits 3x faster, but costs the same as Balanced.

| Thorough Mode % | Blended Credits/Query | Queries per 3K Plus | LLM COGS/Plus Sub | Margin Change |
|-----------------|----------------------|--------------------|--------------------|-------------|
| 10% | 4.7 | 638 | $0.64 | Baseline |
| 30% | 6.4 | 469 | $0.47 | **Higher** (fewer queries, same cost) |
| 50% | 8.1 | 370 | $0.37 | **Higher** |
| 80% | 10.6 | 283 | $0.28 | **Highest** |

**Counterintuitive finding**: Higher Thorough mode usage actually *increases* margin because the credit multiplier reduces total query count while the actual API cost per query is the same. Thorough mode is the most profitable mode.

### 4.2 What if a Model's OpenRouter Price Increases 5x?

| Scenario | Balanced Cost/Query | Plus COGS (max util) | Plus Margin |
|----------|--------------------|--------------------|-------------|
| Current | $0.001600 | $0.63 | 93.3% |
| 5x increase | $0.008000 | $3.15 | 66.3% |
| 10x increase | $0.016000 | $6.30 | 32.6% |

Even with a 10x price increase, subscriptions remain profitable. The credit-based model provides substantial cushion.

### 4.3 Credit Pack Scenario (If Users Game the System)

If 30% of paid users shift from subscriptions to Enterprise packs:

| Metric | With Subs Only | 30% Pack Shifters |
|--------|---------------|-------------------|
| 100 users, monthly revenue | $1,400 | $980 (30% buy $50 packs instead of $14 subs) |
| LLM COGS (same usage) | $50 | $50 |
| Stripe fees | $110 | $77 + $15 (pack txns) = $92 |
| **Monthly loss** | -- | **-$330/mo (-24%)** |

This confirms the P0 finding: pack pricing needs correction to protect subscription revenue.

---

## 5. LTV & CAC Analysis

### 5.1 Lifetime Value (LTV)

| Plan | Monthly Net Revenue | Churn Rate (est.) | Avg Lifetime | **LTV** |
|------|--------------------|--------------------|-------------|---------|
| Plus (monthly) | $9.35 | 8%/mo | 12.5 mo | **$117** |
| Plus (annual) | $7.69 | 3%/mo* | 33 mo | **$254** |
| Pro (monthly) | $19.01 | 5%/mo | 20 mo | **$380** |
| Pro (annual) | $15.42 | 2%/mo* | 50 mo | **$771** |

*Annual plans have lower churn because of commitment lock-in*

**Blended LTV (assuming 60% Plus / 40% Pro, 50% monthly / 50% annual):**
- Weighted average: ~$310

### 5.2 Customer Acquisition Cost (CAC) Targets

| Channel | Estimated CAC | LTV/CAC Ratio |
|---------|-------------|---------------|
| Organic (SEO/Content) | $2-10 | 31-155x |
| Demo viral loop | $0-5 | 62-infinity |
| Social media ads | $15-40 | 8-21x |
| Google ads | $30-80 | 4-10x |
| **Target** | **<$30** | **>10x** |

For SaaS, a 3x+ LTV/CAC ratio is considered healthy. Even with aggressive paid acquisition at $80 CAC, DocTalk achieves 3.9x. The economics strongly favor growth investment.

---

## 6. Profitability Milestones

### 6.1 Monthly Profitability Path

| Milestone | Paid Users | MRR | Costs | Net Profit | Status |
|-----------|-----------|-----|-------|-----------|--------|
| Break-even | 4 | $56 | $43 | +$13 | **Immediate** |
| Ramen profitable | 20 | $280 | $62 | +$218 | ~Month 2-3 |
| Self-sustaining | 100 | $1,400 | $200 | +$1,200 | ~Month 6 |
| Meaningful | 500 | $7,000 | $600 | +$6,400 | ~Month 12 |
| Scale | 2,000 | $28,000 | $2,000 | +$26,000 | ~Month 18 |

### 6.2 Annual Revenue Targets

| Year | Target Paid Users | Target ARR | Notes |
|------|------------------|-----------|-------|
| Y1 | 100-500 | $17K-84K | Focus on product-market fit + organic growth |
| Y2 | 500-2,000 | $84K-336K | Add Team tier, invest in paid acquisition |
| Y3 | 2,000-10,000 | $336K-1.7M | Enterprise sales, international expansion |

---

## 7. P&L Model (12-Month Projection)

### Assumptions:
- Start: 500 registered users, 10 paid (2% conversion)
- Monthly registered user growth: 20%
- Conversion rate: improves from 2% to 5% over 12 months
- ARPU: $14 blended
- LLM utilization: 50% of credits
- Free user utilization: 30% of credits
- Infrastructure: $40/mo (months 1-6), $60/mo (months 7-12)

| Month | Registered | Paid Users | MRR | LLM COGS | Stripe | Infra | **Net Profit** |
|-------|-----------|-----------|-----|---------|--------|-------|---------------|
| 1 | 500 | 10 | $140 | $6 | $11 | $40 | **$83** |
| 2 | 600 | 14 | $196 | $8 | $15 | $40 | **$133** |
| 3 | 720 | 20 | $280 | $11 | $22 | $40 | **$207** |
| 4 | 864 | 29 | $406 | $17 | $32 | $40 | **$317** |
| 5 | 1,037 | 38 | $532 | $23 | $42 | $40 | **$427** |
| 6 | 1,244 | 50 | $700 | $31 | $55 | $40 | **$574** |
| 7 | 1,493 | 67 | $938 | $42 | $74 | $60 | **$762** |
| 8 | 1,792 | 88 | $1,232 | $56 | $97 | $60 | **$1,019** |
| 9 | 2,150 | 112 | $1,568 | $72 | $123 | $60 | **$1,313** |
| 10 | 2,580 | 142 | $1,988 | $92 | $157 | $60 | **$1,679** |
| 11 | 3,096 | 178 | $2,492 | $117 | $196 | $60 | **$2,119** |
| 12 | 3,716 | 223 | $3,122 | $148 | $246 | $60 | **$2,668** |

### Annual Totals (Year 1):

| Metric | Amount |
|--------|--------|
| **Total Revenue** | ~$13,594 |
| **Total LLM COGS** | ~$623 |
| **Total Stripe Fees** | ~$1,070 |
| **Total Infrastructure** | ~$600 |
| **Total Costs** | ~$2,293 |
| **Net Profit** | ~**$11,301** |
| **Net Margin** | **83.1%** |
| **Month 12 ARR** | **$37,464** |

---

## 8. Key Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|------------|-----------|
| OpenRouter price hike | Medium (5-10x increase still profitable) | Low | Multiple model fallbacks, negotiate volume discounts |
| Low conversion rate (<2%) | High (delays profitability) | Medium | Optimize demo→signup→paid funnel, A/B test pricing |
| Pack cannibalization | High (-24% revenue) | High | **Fix pack pricing immediately** |
| High Thorough mode usage | None (improves margins) | Medium | No action needed |
| Railway outage | High (service down) | Low | Consider backup provider, health monitoring |
| User churn >10%/mo | Medium (LTV decreases) | Medium | Annual plans, retention features, credit rollover |

---

## 9. Summary & Recommendations

### Financial Health: EXCELLENT

DocTalk's unit economics are outstanding:
- **93%+ gross margins** on subscriptions
- **Break-even at 4 subscribers** (extremely low)
- **$310 blended LTV** with manageable CAC
- **Year 1 net profit projection: ~$11K** at moderate growth

### Priority Actions (Ranked by Revenue Impact)

1. **Fix credit pack pricing** (P0) -- Revenue protection. Current packs undermine subscription revenue by 4.4x per-credit price advantage.

2. **Enforce feature gating** (P1) -- Conversion driver. Free users currently get all features, reducing upgrade incentive.

3. **Invest in conversion optimization** (P1) -- Each 1% conversion rate improvement = ~$168/mo at 1K users. Low-hanging fruit: 80% credit usage alert, model gate prompt, document limit CTA.

4. **Push annual plans** (P2) -- Annual subscribers have 2-3x higher LTV. Consider making annual the default toggle.

5. **Delay Team/Enterprise tiers** (P3) -- Current margins are excellent with 2 paid tiers. Team tier engineering effort is high relative to near-term revenue impact. Revisit when >100 paid users signal demand.
