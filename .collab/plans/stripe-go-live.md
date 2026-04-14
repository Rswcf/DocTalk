# Stripe Go-Live Runbook

*Drafted: 2026-04-14 · Owner: Yijie Ma*

This is the step-by-step procedure to switch DocTalk's Stripe integration
from test mode (`sk_test_*`) to live mode (`sk_live_*`). **Do not execute
any step until the preconditions at the top are all satisfied.**

---

## 0. Preconditions — all must be ✅ before starting

| # | Gate | How to verify | Notes |
|---|---|---|---|
| P1 | Stripe content-platform review passed | Einstellungen → Kontostatus shows no pending "Beschreiben Sie, was Sie verkaufen" task | Submitted 2026-04-14 |
| P2 | Identity (KYC) verified | Einstellungen → Kontodetails shows "Verifiziert" | Upload passport / DE ID |
| P3 | Bank account (IBAN) added + verified | Einstellungen → Bankkonten und Währungen | ✅ Added |
| P4 | Gewerbeanmeldung completed | Gewerbeschein PDF in hand | service.berlin.de, €15–26 |
| P5 | Steuernummer issued by Finanzamt | Steuernummer letter received | 2–6 weeks after Gewerbeanmeldung |
| P6 | USt-IdNr. issued (if Regelbesteuerung) | On same letter or separate | Required for Stripe Tax + OSS |
| P7 | Virtual business address secured | Public address usable in Impressum | Clevvermail / Emindo / Coworking |
| P8 | `/imprint` page shows real address | `doctalk.site/imprint` rendered with real data | Replace 3 placeholders, commit, deploy |
| P9 | Email receiving works | Send test to support@doctalk.site → lands in iCloud | ✅ ImprovMX verified 2026-04-14 |

If ANY of P1–P8 is ❌, STOP. Do not proceed.

---

## 1. Stripe Dashboard — Live Mode setup

Flip the top-right toggle to **Live Mode**. Everything below happens in
the live view. Live mode has its own separate universe of objects —
nothing from test mode carries over.

### 1.1 Fill tax details

- Einstellungen → Steuerdetails → enter Steuernummer
- Einstellungen → Unternehmensdaten → enter USt-IdNr.

### 1.2 Re-create Products + Prices (7 price IDs)

Use identical configuration to test mode (see
`.collab/plans/stripe-todo.md` for test-mode IDs as reference).

**Subscriptions**:

| Plan | Interval | Amount | Currency | Billing period |
|---|---|---|---|---|
| DocTalk Plus | Monthly | 9.99 | USD | 1 month |
| DocTalk Plus | Annual | 95.88 | USD | 1 year |
| DocTalk Pro | Monthly | 19.99 | USD | 1 month |
| DocTalk Pro | Annual | 191.88 | USD | 1 year |

**Credit packs** (one-time):

| Pack | Amount | Credits |
|---|---|---|
| Boost | 3.99 USD | 500 |
| Power | 9.99 USD | 2,000 |
| Ultra | 19.99 USD | 5,000 |

After each creation, write down the `price_*` ID and `prod_*` ID.

### 1.3 Create live webhook endpoint

Developers → Webhooks → Add endpoint

- URL: `https://backend-production-a62e.up.railway.app/api/billing/webhook`
- Events (exact same 3 as test mode):
  - `checkout.session.completed`
  - `invoice.payment_succeeded`
  - `customer.subscription.deleted`
- After creation, reveal and copy the **Signing secret** (`whsec_*`)

### 1.4 Enable Stripe Tax (recommended)

Einstellungen → Steuern → Aktivieren.

- Register for OSS (One-Stop Shop) with Finanzamt if not yet done
- Enable automatic tax collection on the 7 prices above (tick the
  "Stripe Tax" checkbox per product)

### 1.5 Activate payment methods

Einstellungen → Zahlungsmethoden (if not already activated in test):

- [x] Card (default)
- [x] SEPA Debit
- [x] Klarna
- [x] Link
- [x] Apple Pay
- [x] Google Pay

### 1.6 Customer emails (live)

Einstellungen → Kunden-E-Mails → toggle on:

- [x] Successful payments
- [x] Refunds

### 1.7 Branding

Einstellungen → Branding:

- Logo: upload PNG ≥ 128×128 (use same as doctalk.site favicon/OG)
- Icon: same
- Primary colour: `#4f46e5` (matches DocTalk accent)
- Secondary: zinc-900

---

## 2. Code / Infrastructure changes

### 2.1 Collect new values

You should now have 9 new values in a scratchpad:

```
STRIPE_SECRET_KEY        = sk_live_*
STRIPE_WEBHOOK_SECRET    = whsec_*  (live webhook from 1.3)
STRIPE_PRICE_BOOST       = price_*
STRIPE_PRICE_POWER       = price_*
STRIPE_PRICE_ULTRA       = price_*
STRIPE_PRICE_PLUS_MONTHLY = price_*
STRIPE_PRICE_PLUS_ANNUAL  = price_*
STRIPE_PRICE_PRO_MONTHLY  = price_*
STRIPE_PRICE_PRO_ANNUAL   = price_*
```

### 2.2 Update Railway env vars

Option A — via CLI (from stable branch):

```bash
# Verify we're on stable (go-live must come from the stable branch)
git checkout stable
git pull origin stable

# Set each env var (Railway CLI will prompt for value — paste from scratchpad)
railway variables --set STRIPE_SECRET_KEY=sk_live_XXX
railway variables --set STRIPE_WEBHOOK_SECRET=whsec_XXX
railway variables --set STRIPE_PRICE_BOOST=price_XXX
# ... repeat for all 9
```

Option B — via Railway dashboard: project → backend service → Variables.

### 2.3 Deploy Railway

```bash
# Still on stable branch
railway up --detach
```

Watch deploy logs for "Started" and no ImportError / KeyError.

### 2.4 Frontend publishable key (if separated)

Check if `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is used in Vercel env. If so:

- Vercel dashboard → doctalk project → Settings → Environment Variables
- Update value from `pk_test_*` to `pk_live_*`
- Trigger redeploy: push a dummy commit to `stable` OR use Vercel
  dashboard "Redeploy"

(If the frontend reads the publishable key from the backend or doesn't
use Stripe.js Elements directly, skip this step.)

---

## 3. Smoke tests — REAL MONEY

Do these with YOUR OWN card, small amounts, refund immediately.

### 3.1 One-time credit pack (Boost, $3.99)

1. Sign in to www.doctalk.site as a real user
2. /billing → buy Boost pack
3. Pay with real card (€3.99 will actually leave your account)
4. Verify:
   - [ ] Railway log shows webhook `checkout.session.completed` received
   - [ ] User's credit balance +500 in DB
   - [ ] Stripe dashboard shows the payment under Zahlungen
   - [ ] Receipt email arrives in buyer's inbox
5. Stripe dashboard → refund the payment
6. Verify refund webhook fires (if implemented)

### 3.2 Subscription (Plus monthly, $9.99)

1. /billing → subscribe Plus monthly
2. Pay with real card
3. Verify:
   - [ ] Webhook `checkout.session.completed` received
   - [ ] User plan upgraded to "plus" in DB
   - [ ] Credit balance set to 3,000 (monthly allotment)
   - [ ] Invoice created and emailed
4. Cancel subscription via Customer Portal
5. Verify:
   - [ ] User plan reverts to "free" at period end (not immediately)
   - [ ] No further charges

### 3.3 Edge cases (optional but recommended)

- Failed payment: use Stripe test card `4000 0000 0000 0341` in test
  mode only — this is only for test mode, live card that will actually
  decline requires a real expired/blocked card
- Renewal: wait a full month OR manually advance the subscription in
  Stripe dashboard (Actions → Advance to next period) to verify
  `invoice.payment_succeeded` fires and grants fresh credits

---

## 4. Monitoring (first 72h)

- Railway logs: grep for `billing.webhook` errors
- Stripe Dashboard → Developers → Webhooks → Events: success rate ≥ 99%
- User reports via support@doctalk.site
- Refund rate: should be near 0% for first users

If webhook delivery failure rate > 1%, roll back (see §5).

---

## 5. Rollback plan

If go-live breaks:

1. Railway variables: revert all 9 env vars to the test-mode values
   (keep a backup of the test values in a local scratchpad BEFORE
   starting §2)
2. `railway up --detach` with stable branch at current HEAD
3. Stripe dashboard: toggle view back to Test Mode (the live mode
   objects remain but unused until fixed)
4. Communicate: email affected customers from support@doctalk.site
   explaining the delay, refund any failed charges manually

The test-mode Products / Webhook / env remain intact throughout — they
are a parallel universe, safe to fall back to.

---

## 6. Post-live follow-ups

- [ ] First OSS quarterly VAT return (if using Stripe Tax)
- [ ] First monthly Finanzamt Umsatzsteuer-Voranmeldung
- [ ] First EÜR (annual profit & loss) at year-end
- [ ] Watch Radar (fraud) rules in Stripe dashboard, tune if needed
- [ ] Archive test-mode Products in Stripe (keep data, stop new use)

---

## Appendix — what "switching to live mode" actually means

In Stripe's UI there is no single "activate" button. Live mode is
activated implicitly the moment **all** of the following are true:

1. All account-level KYC fields are filled and verified (§0)
2. Any pending review tasks in Kontostatus are cleared
3. Bank account is verified (IBAN micro-deposit or instant verify)

Once Stripe's backend marks your account as live-capable, the `sk_live_*`
key starts accepting charges. Before that point, even with the key
pasted into Railway, every `charges.create` call will return
`account_invalid`. This is why P1–P3 in §0 are hard gates.

The dashboard's top-right "Live Mode / Test Mode" toggle is a **view**
switch only — it does not activate anything. Do not confuse them.
