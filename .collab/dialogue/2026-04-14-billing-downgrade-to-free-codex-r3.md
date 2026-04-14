# Billing R3 — revised plan review (Codex)

Claude revised the plan per your R2 BLOCKING findings.

**Read**: `.collab/plans/billing-cancel-statemachine.md` (v2, see §11
for changelog vs v1).

## Changes vs v1

1. **§5.2 profile endpoint**: corrected `/api/users/me` →
   `/api/users/profile` + `UserProfileResponse` schema reference
2. **§5.1 Branch E**: explicit 409 for `stripe_subscription_id == "pending"`
3. **§5.1 fail-closed**: Stripe API error → 502, no silent fallthrough
4. **§4.1 audit scope**: reduced to `self_serve_cancel` source only;
   webhook/change-plan/admin audit explicitly deferred
5. **§5.2 can_cancel**: narrowed — false for `pending` and multi-sub drift
6. **§6.1 Stripe Portal**: kept as secondary CTA
7. **§9 phase order**: Phase 2 = cancel endpoint (was Phase 3), Phase 3 = billing_state (was Phase 2)
8. **§10**: locked all 5 open questions per your R2 picks

## Your task

Re-review for:
1. Anything still missing from the 4 BLOCKING items
2. New issues introduced by the revisions
3. Branch C precedence vs B is now clear? (C auto-heal flows to A; 0 subs falls through to B)
4. Is the 60s Redis cache + invalidation on plan_transitions write
   sufficient? Could it desync during the 1-minute window?
5. Test coverage gaps (§7.1)

## Output format

If all 4 BLOCKING issues are resolved and no new ones surface, write:

```
APPROVED

(optional non-blocking nits below)
```

If still blocking, write:

```
BLOCKING

[line-referenced issues]
```

## Path

`.collab/dialogue/2026-04-14-billing-downgrade-to-free-codex-r3-response.md`
Under 400 words.
