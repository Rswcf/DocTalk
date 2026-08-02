# Codex r2 — verify fixes + adjudicate parked rulings (P0 demo re-tune batch)

Round 1 (your report: `.collab/reviews/2026-08-02-p0-demo-retune-codex-r1.md`, final section) returned BLOCK: findings #1-#11. Claude's triage: `.collab/dialogue/2026-08-02-p0-codex-r1-triage.md`. Nine fix commits have landed since your review head (`aaeb334`):

```
git log --oneline aaeb334..98df9e3
git diff aaeb334..98df9e3
```

f816335 FIX-1 (a) anon-only rolling filter (b) per-user free-plan cap on demo docs (c) cleanup extended to authed empty demo sessions
38b8a36 FIX-6-index: partial index (document_id, created_at) WHERE user_id IS NULL (alembic, upgrade+downgrade verified)
0f1cdd8 FIX-8: typed SessionMessagesResponse with demo_messages_used
6149931 FIX-2: baseline counter model (demoRestoredUserMsgCount; raw server count; regen/continue bump)
3dbbf5b FIX-3: demoSessionStorage helper; pointer written on create/switch; cleared only on 404/403; storage-disabled safe
3296cc4 FIX-5: anon share controls titled "Sign in to share this conversation" ×11 locales
5d5bec9 FIX-9: override resolved via new URL(origin) + origin equality check
804da49 FIX-10: aria-label = questions-remaining key ×11
98df9e3 FIX-11: breadcrumb uses localized href

## Your task in r2

1. **Verify each accepted finding (#1, #2, #3, #5, #6-index, #8, #9, #10, #11) ADDRESSED / NOT ADDRESSED** against the fix diff. Probe the fixes adversarially — e.g. for FIX-1: can a free user still spam via any other path; does the per-user demo cap use the right count scope; for FIX-2: check the exact arithmetic in useChatStream + store reset paths (document switch, dropdown session switch); for FIX-3: pointer lifecycle on delete of the stored session; for FIX-9: URL-parse edge cases ("//evil.com", "\\evil.com", "%2F%2Fevil.com").
2. **Rule on the three PARKED items** (#4 shared-machine restore, #6-atomicity, #7 cleanup race) — the rulings with reasoning are in the triage doc. Accept the ruling or state concretely why it fails.
3. **Flag NEW breakage introduced by the fix commits only.**

## Verification evidence since r1 (audit, don't repeat)

- Backend: ruff clean; 547 passed/3 skipped with docker (SKIP_INTEGRATION=0), 542/8 without; alembic upgrade→downgrade→upgrade round-trip verified.
- Frontend: tsc/eslint clean; `npm run build` compiled successfully at final HEAD.
- Live browser + Redis at final HEAD: same-window reuse shows 4/5 with server used=1; **TTL-expiry simulation (Redis key deleted, transcript of 1 restored) shows 5/5** — the r1 #2 failure case now converges to server truth; anon composer share button reads "Sign in to share this conversation"; typing indicator visible mid-stream in light mode.
- Note: the demo documents in the local dev DB were re-seeded (self-heal) after an alembic downgrade wiped dev data during testing — process note only, no code impact.

Write a markdown report: per-finding verdicts, parked-ruling adjudications, new-breakage section, and an overall verdict line: CONSENSUS-SHIP / REVISE (must-fix list) / BLOCK.
