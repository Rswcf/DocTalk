# Activation-collapse diagnosis (M0) — 2026-06-12

**Symptom (from prod metrics):** post-05-24, 16/19 new signups never uploaded a document (historical upload rate 56%); 116 magic-link requests → ~19 signups in 19 days; WAU=0.

**Verdict: the collapse is ~70% metric artifact + ~30% real auth bug. Acquisition is worse than believed; activation of real users is healthy.**

## Evidence (read-only prod queries, 2026-06-12)

1. **13 of the 19 "users" are ghost accounts created by email security scanners.**
   - All 13: magic-link provider, **zero product events** (not even `auth_modal_opened`), corporate email domains: valvesoftware.com, adt.com, 7eleven.com.my, 7-11.com, securitydelta.nl, serverius.net, aceindustries.com, markem-imaje.com, europapark.de, b1bank.com, burkesmechanical.com, buntingmagnetics.com.
   - Mechanism: corporate gateways (Mimecast/Proofpoint class) prefetch links in inbound mail → GET on the Auth.js callback URL → Auth.js email provider **creates the user on verification** → ghost row, no human ever loaded the app.
2. **The same prefetch kills real signups.** A one-time token consumed by the scanner means the human's later click lands on a dead link → Auth.js masks it as `?error=Configuration` (known masking behavior, see 2026-02-11 lesson). 9 × `auth_email_link_failed {"reason": "Configuration"}` since 05-24 fit exactly. Note these corporate domains ARE the professional segment trying to sign up with work email.
3. **Confirmed in code:** `frontend/src/lib/auth.ts:53` `sendVerificationRequest` passes the RAW callback `url` into `buildSignInEmail` — no confirmation interstitial; one GET consumes the token.
4. Secondary: 2026-06-06 had req=3 sent=0 failed=3 (Resend send failure day, transient).

## Recomputed real funnel (post-05-24)
- Real (Google OAuth) signups: **6** in 19 days ≈ 0.3/day.
- Of those: 4–5 uploaded/chatted → **real activation ≈ 75–80%, healthy.**
- Conclusion: the binding constraint is acquisition (even more than diagnosed on 05-23), not activation UX.

## Fixes
1. **M0.2 (code, security-adjacent → needs Codex review before merge): magic-link confirmation interstitial.**
   - `sendVerificationRequest` emails a wrapper URL (`/auth/confirm?cb=<encoded callback>`); that page requires a human gesture (button click → client-side navigation/POST to the real callback). Standard Auth.js anti-prefetch pattern. Kills both the ghost accounts and the dead-link failures.
   - Keep `auth_email_link_*` events; add `auth_confirm_viewed` / `auth_confirm_clicked` to measure scanner-vs-human ratio.
2. **Metrics hygiene:** admin/retention queries and `prod_metrics.py` should exclude ghost users (email-provider + zero product_events + zero documents) or the funnel will keep lying.
3. NOT a fix: deleting ghost rows — keep data, filter in queries.
