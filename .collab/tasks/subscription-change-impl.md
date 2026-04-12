Implemented all requested changes for the subscription-change system.

**Backend**
- Added `ChangePlanResponse` in `backend/app/schemas/billing.py:24`.
- Added plan helpers in `backend/app/api/billing.py:70` and `backend/app/api/billing.py:73`.
- Guarded `/subscribe` to block already-subscribed users in `backend/app/api/billing.py:129`.
- Added `POST /change-plan` in `backend/app/api/billing.py:171` with:
  - Stripe config check
  - active subscription checks
  - same-plan and free-plan guards
  - Stripe retrieve/modify with StripeError -> 502
  - beta interval block (`Cannot switch billing interval during beta`)
  - upgrade/downgrade handling via `PLAN_HIERARCHY`
  - upgrade credit supplement via `credit_credits(... reason="plan_upgrade_supplement", ref_type="plan_change", ref_id="old_to_new")`
  - commit + cache invalidate
- Added webhook handlers:
  - `customer.subscription.updated` in `backend/app/api/billing.py:470`
  - `invoice.payment_failed` (logging only) in `backend/app/api/billing.py:505`
- Registered both handlers in webhook map at `backend/app/api/billing.py:539`.

**Frontend**
- Exported `PLAN_HIERARCHY` in `frontend/src/lib/models.ts:19`.
- Added API client + result type for plan changes in `frontend/src/lib/api.ts:173`.
- Reworked billing page flow in `frontend/src/app/billing/page.tsx`:
  - Added `confirmDowngrade` state (`:38`)
  - Kept `handleSubscribe` for free users only (`:95`)
  - Added `handlePlanAction` upgrade/downgrade split (`:115`)
  - Added `confirmDowngradeAction` (`:154`)
  - Updated Plus/Pro CTA logic per plan state (`:285`, `:346`)
  - Added downgrade confirmation modal with zinc styling (`:440`)
  - `handleUpgrade` now routes to `handlePlanAction` (`:182`)
- Updated PricingTable CTA downgrade labeling using hierarchy in `frontend/src/components/PricingTable.tsx:68`.

**i18n**
- Added all required keys to all 11 locale files:
  - `frontend/src/i18n/locales/en.json`
  - `frontend/src/i18n/locales/zh.json`
  - `frontend/src/i18n/locales/es.json`
  - `frontend/src/i18n/locales/ja.json`
  - `frontend/src/i18n/locales/de.json`
  - `frontend/src/i18n/locales/fr.json`
  - `frontend/src/i18n/locales/ko.json`
  - `frontend/src/i18n/locales/pt.json`
  - `frontend/src/i18n/locales/it.json`
  - `frontend/src/i18n/locales/ar.json`
  - `frontend/src/i18n/locales/hi.json`

**Validation run**
- `python3 -m py_compile backend/app/api/billing.py backend/app/schemas/billing.py` (with writable pycache prefix): passed.
- `cd frontend && npm run -s build`: passed (existing unrelated lint warnings remain in other files).