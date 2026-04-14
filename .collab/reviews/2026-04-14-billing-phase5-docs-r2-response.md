APPROVED

R2 resolves the blocker. §10 now explicitly states that Stripe failures in Branch A/C return 502 with no local Free-plan revert and no audit-row write, while the sole exception is Branch C auto-heal persisting `stripe_subscription_id` before `Subscription.modify`.

That exception is clearly scoped as Stripe-confirmed drift repair and does not weaken fail-closed semantics for billing transitions or cancellation audit guarantees.

No remaining documentation inconsistency is blocking for this item.
