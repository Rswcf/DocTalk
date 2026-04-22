---
id: A-19-C10-01
matrix: A
agent: claude
cell_id: A-19-C10
row_key: nextauth_handlers
column_key: browser_flow_integrity
finding_key: allow_dangerous_email_account_linking_exposed_to_takeover
severity: P1
confidence: medium
status: risk
files:
  - "frontend/src/lib/auth.ts:26"
exploit_preconditions:
  - "attacker signs up via provider X with victim's email (if provider does not verify email)"
  - "victim later signs in via provider Y with the same email"
---

## Observation
`allowDangerousEmailAccountLinking: true` (referenced in `frontend/src/lib/auth.ts` per CLAUDE.md memory + Codex r1 confirmation) auto-links OAuth accounts by email address without explicit user consent. This is a well-known Auth.js footgun: if provider X does not verify email ownership before issuing OAuth tokens (e.g., a low-trust provider, or a self-hosted provider), an attacker who signs up with the victim's email on provider X can hijack the victim's account the first time the victim signs in.

DocTalk uses Google (verified emails), Microsoft (verified emails), and Resend email magic links (verified per-click). The current provider set is safe because all three verify email. But: adding a fourth provider in the future without re-evaluating this flag = account takeover vulnerability.

## Impact
Not currently exploitable with today's three providers (Google/Microsoft/magic-link). The risk is forward-looking:
- If a future provider is added (Apple, GitHub, Twitter, Discord, etc.) without email-verification, attacker pre-registers and waits for the victim to link the new provider.
- The "dangerous" qualifier in the flag name is there for a reason.

## Suggested Fix
1. **Short-term**: add a comment in `auth.ts` documenting why the flag is currently safe (all three providers verify email) and requiring code-review approval for any new provider.

2. **Medium-term**: replace blanket `allowDangerousEmailAccountLinking: true` with per-provider check:

```ts
// Opt in per provider after confirming email verification semantics.
Google({
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  allowDangerousEmailAccountLinking: true,  // Google always verifies email
}),
Microsoft({
  ...
  allowDangerousEmailAccountLinking: true,  // Microsoft verifies via AAD
}),
```

3. **Long-term**: support explicit account-linking UI where the user must click "link" while signed into both accounts, rather than silent auto-link.
