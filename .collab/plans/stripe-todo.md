# Stripe Configuration TODO

*Created: 2026-02-11 | Status: Pending batch execution*

All Stripe Dashboard operations collected here for batch execution. Complete these in order.

---

## 1. Create New Credit Pack Prices (One-Time Products)

Go to **Stripe Dashboard → Products → + Add product**

### 1.1 Boost Pack
- **Name**: Boost Pack
- **Description**: 500 credits top-up
- **Pricing model**: One-time
- **Price**: $3.99 USD
- Copy the `price_xxx` ID → set as `STRIPE_PRICE_BOOST` env var

### 1.2 Power Pack
- **Name**: Power Pack
- **Description**: 2,000 credits top-up
- **Pricing model**: One-time
- **Price**: $9.99 USD
- Copy the `price_xxx` ID → set as `STRIPE_PRICE_POWER` env var

### 1.3 Ultra Pack
- **Name**: Ultra Pack
- **Description**: 5,000 credits top-up
- **Pricing model**: One-time
- **Price**: $19.99 USD
- Copy the `price_xxx` ID → set as `STRIPE_PRICE_ULTRA` env var

### 1.4 Archive Old Pack Products
- Archive (do NOT delete) the old Starter ($5), Pro ($15), Enterprise ($50) products
- Archiving preserves payment history but hides from new checkouts
- **Stripe Dashboard → Products → [old product] → Archive**

---

## 2. Verify Subscription Prices (If Not Already Created)

These may already exist. If not, create them:

### 2.1 Plus Plan
- **Product Name**: Plus Plan
- **Monthly Price**: $9.99/month (recurring) → `STRIPE_PRICE_PLUS_MONTHLY`
- **Annual Price**: $95.88/year ($7.99/month) → `STRIPE_PRICE_PLUS_ANNUAL`

### 2.2 Pro Plan
- **Product Name**: Pro Plan
- **Monthly Price**: $19.99/month (recurring) → `STRIPE_PRICE_PRO_MONTHLY`
- **Annual Price**: $191.88/year ($15.99/month) → `STRIPE_PRICE_PRO_ANNUAL`

---

## 3. Set Environment Variables on Railway

After creating all Stripe prices, update Railway env vars:

```bash
# Credit packs (new)
STRIPE_PRICE_BOOST=price_xxx
STRIPE_PRICE_POWER=price_xxx
STRIPE_PRICE_ULTRA=price_xxx

# Subscriptions (verify these are set)
STRIPE_PRICE_PLUS_MONTHLY=price_xxx
STRIPE_PRICE_PLUS_ANNUAL=price_xxx
STRIPE_PRICE_PRO_MONTHLY=price_xxx
STRIPE_PRICE_PRO_ANNUAL=price_xxx
```

---

## 4. Webhook Verification

Ensure your Stripe webhook endpoint (`POST /api/billing/webhook`) is configured to receive:
- `checkout.session.completed` — handles both one-time pack purchases and subscription creation
- `invoice.payment_succeeded` — handles subscription renewal credit grants
- `customer.subscription.deleted` — handles plan downgrade to free

**Webhook URL**: `https://backend-production-a62e.up.railway.app/api/billing/webhook`

Verify `STRIPE_WEBHOOK_SECRET` env var matches the webhook signing secret in Stripe Dashboard.

---

## 5. Post-Deploy Verification Checklist

After setting env vars and redeploying:

- [ ] Visit `/billing` page — verify 3 new pack names (Boost/Power/Ultra) and prices ($3.99/$9.99/$19.99) render correctly
- [ ] Test Boost pack checkout (Stripe test mode) — verify 500 credits added to account
- [ ] Test Power pack checkout — verify 2,000 credits added
- [ ] Test Ultra pack checkout — verify 5,000 credits added
- [ ] Verify subscription checkout still works (Plus/Pro monthly and annual)
- [ ] Verify webhook fires correctly on successful payment
- [ ] Check Stripe Dashboard for successful test payments

---

## Best Practices Followed

1. **Archive, don't delete** old products — preserves audit trail and existing customer payment history
2. **One product per pack** in Stripe — cleaner than multi-price products for one-time purchases
3. **Use price IDs, not product IDs** — price IDs are what Checkout Sessions consume
4. **Test mode first** — create all prices in test mode, verify, then replicate in live mode
5. **Idempotent webhook handling** — backend already uses `payment_intent` ID for deduplication
6. **Environment-specific keys** — never share Stripe keys between test/production environments
