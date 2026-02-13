# Stripe Configuration TODO

*Created: 2026-02-11 | Completed: 2026-02-13*

All Stripe Dashboard operations have been completed.

---

## 1. Credit Pack Prices (One-Time Products) — DONE

| Pack | Product ID | Price ID | Amount |
|---|---|---|---|
| Boost | `prod_TyHvH9DZFC772F` | `price_1T0LLC7L0c9GeI9Io70xogPw` | $3.99 |
| Power | `prod_TyHx5BpQ7PpHNu` | `price_1T0LNK7L0c9GeI9IjHmvVLLC` | $9.99 |
| Ultra | `prod_TyHylWTgROQpzT` | `price_1T0LOG7L0c9GeI9IeZs8xv5F` | $19.99 |

Old Starter/Pro/Enterprise packs: N/A (never created in Stripe).

---

## 2. Subscription Prices — DONE

| Plan | Product ID | Monthly Price ID | Annual Price ID |
|---|---|---|---|
| Plus ($9.99/mo) | `prod_TwwyaTfDJvWt4j` | `price_1Sz34S7L0c9GeI9IJkC9CnAR` | `price_1T0M8W7L0c9GeI9IRBLVTOau` ($95.88/yr) |
| Pro ($19.99/mo) | `prod_Twwl4cr3LfjOaO` | `price_1Sz2rX7L0c9GeI9IOryemL34` | `price_1T0M9W7L0c9GeI9IRMTIyZTM` ($191.88/yr) |

---

## 3. Environment Variables — DONE

All 9 variables set on both local `.env` and Railway (2026-02-13):

- `STRIPE_SECRET_KEY` (test mode)
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_BOOST`, `STRIPE_PRICE_POWER`, `STRIPE_PRICE_ULTRA`
- `STRIPE_PRICE_PLUS_MONTHLY`, `STRIPE_PRICE_PLUS_ANNUAL`
- `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_ANNUAL`

---

## 4. Webhook — DONE

- Endpoint: `https://backend-production-a62e.up.railway.app/api/billing/webhook`
- Events: `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.deleted`

---

## 5. Post-Deploy Verification Checklist

- [ ] Visit `/billing` page — verify 3 pack names and prices render correctly
- [ ] Test Boost pack checkout (Stripe test mode) — verify 500 credits added
- [ ] Test Power pack checkout — verify 2,000 credits added
- [ ] Test Ultra pack checkout — verify 5,000 credits added
- [ ] Verify subscription checkout still works (Plus/Pro monthly and annual)
- [ ] Verify webhook fires correctly on successful payment

---

## Notes

- Currently using **test mode** keys (`sk_test_`). Before go-live, switch to live keys and recreate webhook + prices in live mode.
- All backend code already supports these price IDs via `config.py` env var mapping.
