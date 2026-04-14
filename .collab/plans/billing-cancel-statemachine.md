# Plan: Billing Cancel State Machine (Option D)

**Status:** ✅ Implemented 2026-04-14 (Phases 1-5 all Codex-APPROVED).
Migration `20260414_0021`, endpoint `POST /api/billing/cancel`,
`billing_state` field on `/api/users/profile`, frontend Current Plan
panel + ConfirmCancel modal. See `docs/ARCHITECTURE.md §10` for the
runtime contract.

*Author: Claude · v4 final — Codex R4 APPROVED with 2 nits folded in*
*Author: Claude · v2 revised 2026-04-14 after Codex R2 BLOCKING review*
*Pre-reads:*
- `.collab/dialogue/2026-04-14-billing-downgrade-to-free-codex-r1*`
- `.collab/dialogue/2026-04-14-billing-downgrade-to-free-codex-r2*`

## 1. Goal

Close the bug: `plan != "free"` users with no `stripe_subscription_id`
(admin-promoted) have no self-serve path back to Free. Also:
- Add a BGB §312k-compliant in-app "Cancel" CTA for paid users.
- Expose billing capability state to frontend.
- Close Codex R1 side-findings (`trialing` miss, profile error
  swallowing, credit-abuse via upgrade→consume→revert).

## 2. Non-goals

- Not implementing true refunds (14-day Widerrufsrecht) — policy only.
- Not changing credit pack (one-time) flow.
- Not changing proration for Plus↔Pro switches.
- Not implementing Stripe Connect / multi-seat.
- Not backfilling historical `plan_transitions` rows (from-now-forward).
- Not adding `/billing/reactivate` (Stripe Portal covers this).

## 3. Architectural decisions (resolved)

| Question | Decision | Rationale |
|---|---|---|
| One endpoint or many? | **One**: `POST /api/billing/cancel` | State-machine in backend |
| Proration | `cancel_at_period_end=true` default | No refund controversy |
| Credit clawback | **Never** | No support tickets (R1 §3) |
| Upgrade→consume→revert abuse | Require Stripe confirmation of "no cancellable sub" before local revert | Fail-closed (R2 §3) |
| Admin-promoted revert | Direct local `plan=free`, no Stripe call | Only path that works |
| Audit scope for this iteration | **Cancel-path only** (webhook + change-plan audit is deferred to next iteration) | Avoid overpromising (R2 §4) |
| Trialing subs | Include `trialing` alongside `active`/`past_due` in lookups | R1 §6 |
| Stripe Portal CTA | **Keep it** as secondary "Manage billing" action | R2 non-blocking |
| `pending` sentinel | Explicit 409 on cancel during pending checkout | R2 §2 |
| Branch C auto-heal | Yes, conditional: exactly-1 sub → auto-heal + proceed; 0 or >1 → 409 | R2 open Q#1 |

## 4. Data model

### 4.1 New table `plan_transitions`

```sql
CREATE TABLE plan_transitions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_plan       VARCHAR(16) NOT NULL,
    to_plan         VARCHAR(16) NOT NULL,
    source          VARCHAR(32) NOT NULL,   -- 'self_serve_cancel' this iteration
    stripe_event_id VARCHAR(128),
    effective_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata        JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_plan_transitions_user ON plan_transitions(user_id, created_at DESC);
CREATE INDEX idx_plan_transitions_source ON plan_transitions(source);
```

Scope note: only `self_serve_cancel` writes to this table in this
iteration. A follow-up issue will add writes from the webhook
(`stripe_webhook`), `change-plan` (`plan_change`), and admin path
(`admin`) — tracked separately to avoid scope creep.

### 4.2 No new user columns

Stripe is source of truth for period_end / status. Fetched live with
Redis cache (60s TTL) — see §5.2.

## 5. API contract

### 5.1 `POST /api/billing/cancel` (new)

Request body: `{}`
Response:

```json
{
  "status": "scheduled_cancel" | "immediate_revert",
  "effective_at": "2026-05-14T12:00:00Z" | null,
  "message": "..."
}
```

Branches (evaluated top-down, first match wins):

| # | Precondition | Action | Return |
|---|---|---|---|
| D | `user.plan == "free"` | No-op | 400 `"Already on Free plan"` |
| E | `user.stripe_subscription_id == "pending"` | No-op (checkout in flight) | 409 `"Checkout in progress — wait"` |
| A | `user.stripe_subscription_id` is non-empty string that starts with `sub_` (Stripe ID prefix) and is not `"pending"` | `stripe.Subscription.retrieve`. Dispatch on status: (a) `{active, trialing, past_due}` → `stripe.Subscription.modify(cancel_at_period_end=true)` · 200 `scheduled_cancel`. (b) `canceled` → sync local: `user.plan='free'`, null the sub_id, log transition · 200 `immediate_revert` (idempotent — user already cancelled via Portal). (c) any other status (e.g. `incomplete`, `unpaid`, `incomplete_expired`) → 409 `"Subscription is in state {status}; contact support"` | (varies) |
| F | `user.stripe_subscription_id` is non-empty but malformed (doesn't start with `sub_` and isn't `"pending"`) | Log as data corruption. **Fail closed** — do not fall through to local revert. | 409 `"Subscription ID malformed, contact support"` |
| C | `user.stripe_subscription_id` is null/empty BUT `stripe_customer_id` present | `stripe.Subscription.list(customer, status=all, limit=10)` filter to cancellable statuses `{active, trialing, past_due}`. If exactly 1 → auto-heal `stripe_subscription_id`, go to Branch A. If 0 → fall through to Branch B. If >1 → 409 `"Multiple subscriptions found, contact support"` + log | (varies) |
| B | `user.stripe_subscription_id` is null/empty AND (no `stripe_customer_id` OR Branch C found 0 subs) | Row-lock `SELECT ... FOR UPDATE` user. Set `user.plan='free'`, null `monthly_credits_granted_at`. Write `plan_transitions` row (source=`self_serve_cancel`, metadata `{reason: "admin_promoted_revert"}`) | 200 `immediate_revert` |

**Precondition totality**: every possible state of
`(user.plan, user.stripe_subscription_id, user.stripe_customer_id)`
maps to exactly one branch (D, E, A, F, C, or B) evaluated in the
order listed. No ambiguous routing.

**Fail-closed requirement (R2 §3)**: Branches A and C require
successful Stripe API responses. On `stripe.StripeError` /
`requests.Timeout` / network error → return 502 `"Stripe temporarily
unavailable, try again"`. **Do NOT** fall through to local revert
without Stripe confirmation. Retry is user-driven.

**Idempotency**: natural — repeated cancels on already-scheduled sub
are Stripe no-ops; repeated local revert is DB no-op.

### 5.2 Extend `UserProfileResponse` at `GET /api/users/profile`

**Corrected from R2 §1**: endpoint is `/api/users/profile`, schema
is `UserProfileResponse` in `backend/app/schemas/users.py:21-34`.

Add nested object:

```python
class BillingStateResponse(BaseModel):
    managed_by: Literal["stripe", "admin", "none"]
    can_cancel: bool
    interval: Optional[Literal["month", "year"]] = None
    period_end: Optional[str] = None                    # ISO 8601
    cancel_at_period_end: bool = False
    status: Literal["active", "trialing", "past_due", "canceled", "pending", "none"]

class UserProfileResponse(BaseModel):
    # ... existing fields unchanged ...
    billing_state: BillingStateResponse
```

Compute logic (server):

- `managed_by`:
  - `"stripe"` if `stripe_subscription_id` present and **not** `"pending"`
  - `"admin"` if `plan != "free"` AND no cancellable Stripe sub for this customer
  - `"none"` if `plan == "free"` AND no Stripe sub
- `can_cancel`:
  - **False** if `plan == "free"` (nothing to cancel)
  - **False** if `status == "pending"` (checkout in flight)
  - **False** if drift with >1 sub (Branch C ambiguous)
  - **False** if `stripe_subscription_id` is malformed (non-empty, not `"pending"`, but doesn't start with `sub_`) — would hit Branch F. Show "contact support" message instead of a 409-guaranteed button.
  - **True** otherwise (covers `managed_by in {stripe, admin}` normal case)
- `status`: from Stripe sub if present, `"pending"` if sentinel, else `"none"`
- `period_end` / `interval` / `cancel_at_period_end`: from Stripe
  sub. Cached in Redis `user:billing_state:{user_id}` with 60s TTL
  (invalidated on any plan_transitions write).
- Stripe API failure when computing: return last-known cache; if no
  cache, return a minimal billing_state with `status="none"` and log
  warning. Profile fetch must not 500 on transient Stripe outage.

### 5.3 Extend `change-plan` lookup (R1 §6)

In `backend/app/api/billing.py:311`, change recovery lookup from:

```python
subs = await asyncio.to_thread(stripe.Subscription.list, customer=..., status="active", limit=1)
```

to include `trialing`:

```python
subs = await asyncio.to_thread(stripe.Subscription.list, customer=..., status="all", limit=5)
# filter to statuses in {active, trialing}
```

## 6. Frontend changes

### 6.1 Billing page: 3-card layout + keep "Manage billing"

Replace current 2-card (Plus+Pro) with 3-card grid **plus** keep the
Stripe Portal button for payment-method / invoice self-service
(R2 non-blocking). Layout:

```
[ Free ]  [ Plus ]  [ Pro ]

[ Manage billing in Stripe → ]    (small link below, Stripe-managed users only)
```

Button label per card × currentPlan, gated by `billing_state.can_cancel`:

| currentPlan | Free button | Plus button | Pro button |
|---|---|---|---|
| `free` | "Current Plan" (disabled) | "Upgrade to Plus" | "Upgrade to Pro" |
| `plus` | "Downgrade to Free" (disabled if `can_cancel==false`) | "Current Plan" (disabled) | "Upgrade to Pro" |
| `pro` | "Downgrade to Free" (disabled if `can_cancel==false`) | "Downgrade to Plus" | "Current Plan" (disabled) |

When disabled due to `can_cancel==false` AND `status=="pending"`:
show tooltip "Checkout in progress — please wait a moment."
When disabled due to multi-sub drift: tooltip "Contact support."

### 6.2 `ConfirmCancelModal` (BGB §312k compliant)

Triggered by "Downgrade to Free". Content i18n (DE + EN primary, 9
others via `tOr` fallback):

- Title: "Abonnement kündigen / Cancel subscription"
- Body varies by `billing_state.managed_by`:
  - `"stripe"`: "Your `{plan}` subscription will end on
    `{period_end}`. Until then you keep all `{plan}` features.
    Your existing credits are kept."
  - `"admin"`: "You'll return to the Free plan immediately. Your
    existing credits are kept."
- Primary button: "Kündigen / Cancel" (destructive color)
- Secondary: "Zurück / Back"

### 6.3 Error surfacing (R1 §6)

Fix `handleManage` + future `handleCancel`: parse backend `detail`
from HTTPException instead of swallowing to generic `billing.error`.

### 6.4 i18n keys

(en + de primary, 9 others fallback)

- `billing.cancel.button`
- `billing.cancel.modal.title`
- `billing.cancel.modal.bodyStripe` (supports `{plan}`, `{period_end}` params)
- `billing.cancel.modal.bodyAdmin`
- `billing.cancel.modal.confirm`
- `billing.cancel.modal.back`
- `billing.cancel.successScheduled` (`{period_end}`)
- `billing.cancel.successImmediate`
- `billing.cancel.tooltipPending`
- `billing.cancel.tooltipContactSupport`

## 7. Tests

### 7.1 Backend pytest — `backend/tests/test_billing_cancel.py`

- [ ] Branch A: active sub → cancel_at_period_end=True, transition logged
- [ ] Branch A variant: trialing status → same behaviour
- [ ] Branch A variant: past_due status → same behaviour
- [ ] Branch B: admin-promoted, no customer → plan=free, transition logged, monthly_credits_granted_at cleared
- [ ] Branch C auto-heal: exactly 1 active sub found → heal + Branch A behaviour
- [ ] Branch C ambiguous: 2 subs found → 409
- [ ] Branch C no subs: 0 found → falls through to Branch B
- [ ] Branch D: already free → 400
- [ ] Branch E: pending sentinel → 409
- [ ] Branch F: malformed sub_id (e.g., `"foobar"`) → 409, no local revert
- [ ] Fail-closed: Stripe API 500 during retrieve → 502, no local revert
- [ ] Fail-closed: Stripe API timeout during list → 502
- [ ] Row lock: two concurrent cancels → one wins, other is no-op
- [ ] Anti-abuse: upgrade → consume → cancel → credits unchanged (not refunded, not deducted)
- [ ] `change-plan` trialing recovery: user with trialing sub but no subscription_id column → auto-recovers

Marker: `@pytest.mark.integration` (DB needed, Stripe mocked).

### 7.2 Frontend

No test framework in repo — manual QA via dev server covering:
- 3 card layout rendering for free / plus / pro currentPlan
- Modal copy in EN + DE
- Disabled state + tooltip during pending checkout

## 8. Rollout

Single PR (main → stable fast-forward), deploy order:
1. Alembic migration
2. Backend deploy (Railway)
3. Frontend deploy (Vercel)

Migration additive-only → no downtime, backend→frontend order safe
(Phase 3 endpoint active before Phase 4 UI calls it).

## 9. Phase breakdown (R2 reordered)

Each phase = **one commit**. Codex reviews before next phase starts.

### Phase 1 — DB migration
- Alembic migration `20260414_0021_add_plan_transitions.py`
- Creates `plan_transitions` table
- No code using it yet
- Review focus: schema, indexes, naming convention

### Phase 2 — Cancel endpoint (moved earlier per R2)
- `POST /api/billing/cancel` state machine
- `plan_transitions` write in cancel path only
- `change-plan` trialing lookup fix (§5.3)
- Backend tests (§7.1)
- UI doesn't call it yet
- Review focus: branch correctness, fail-closed, row lock, idempotency

### Phase 3 — `billing_state` in profile
- Extend `UserProfileResponse` (§5.2)
- Redis cache (60s TTL) + cache invalidation on plan_transitions write
- Existing UI ignores new field
- Review focus: managed_by branching, cache failure path, can_cancel

### Phase 4 — Frontend
- 3-card layout + Stripe Portal link
- ConfirmCancelModal + i18n
- Error surfacing fix (§6.3)
- Consumes Phases 2+3
- Review focus: UX copy (DE compliance), state rendering

### Phase 5 — Docs
- `docs/ARCHITECTURE.md §10` update
- Archive `.collab/plans/billing-cancel-statemachine.md` → `.collab/archive/`
- Review focus: docs accuracy, ADR completeness

## 10. Answers to R2 open questions (locked)

1. Branch C auto-heal → **Yes, conditional** (1 sub → heal; 0 → Branch B; >1 → 409)
2. Credits in `billing_state` → **No** (use existing `credits_balance`)
3. `/billing/reactivate` → **Defer** (Stripe Portal covers it)
4. Migration naming → **`20260414_0021_*`**
5. Historical admin backfill → **From-now-forward only**

## 11. Changelog

v3 → v4 (R4 APPROVED, folded in 2 optional nits):
- Branch A: explicit dispatch on Stripe sub status, covering `canceled` and `incomplete*` deterministically
- `can_cancel`: also false for malformed sub_id (Branch F guard)

v2 → v3 (after Codex R3 BLOCKING):
- Fixed Branch A precondition: Stripe IDs are `sub_*`, not UUIDs
- Added Branch F: explicit malformed-ID fail-closed (409)
- Added precondition-totality statement after branch table
- New Branch F test case in §7.1

v1 → v2 (after Codex R2 BLOCKING):
- Fixed profile endpoint path (`users/profile` not `users/me`) + schema name
- Added `pending` sentinel handling (Branch E)
- Specified fail-closed for Stripe API errors
- Reduced audit scope to cancel-path only
- Narrowed `can_cancel` to exclude pending / multi-sub drift
- Kept Stripe Portal entry point in UI
- Reordered Phase 2 (cancel) ahead of Phase 3 (billing_state)
- Locked all 5 open questions per Codex picks
