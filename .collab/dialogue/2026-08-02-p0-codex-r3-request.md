# Codex r3 — scoped verification of the two r2 must-fix items (P0 demo re-tune batch)

Your r2 report (`.collab/reviews/2026-08-02-p0-demo-retune-codex-r2.md`) verdicted REVISE with exactly two must-fix items. Two commits landed since your r2 head (`98df9e3`):

```
git log --oneline 98df9e3..f594007
git diff 98df9e3..f594007
```

- `65046a5` MUST-FIX-A (your #2): demo counter fields REMOVED from `clearDocumentTransientState` (reverting that part of 6149931); reset now happens synchronously at the top of `useChatSession`'s documentId-keyed effect — which only reruns on a real document transition and always re-establishes server truth afterward (adopt or create). Regen/continue bump now rolls back on non-abort failure (ref-captured pre-bump value restored in the error path; abort excluded because the backend is necessarily mid-response by then).
- `f594007` MUST-FIX-B (your #3): transient (non-404/403) stored-session adoption failure now sets `sessionError` and STOPS — no fall-through to `createSession`, pointer preserved, reload retries; `SessionDropdown.onDeleteSessionById` clears the pointer immediately on confirmed delete of the stored session, before any replacement GET.

This round is SCOPED: verify these two items ADDRESSED / NOT ADDRESSED against the diff, probe them adversarially (e.g. does the useChatSession-top reset cover every path the old clearDocumentTransientState reset covered; can the rollback double-fire or under-fire; does the stop-on-transient path leave any state inconsistent — messages blanked but error shown, etc.), and flag NEW breakage in these two commits only. Everything else reached consensus in r2 (7 findings ADDRESSED, 3 parked rulings accepted) — do not re-open settled items.

Evidence since r2 (audit, don't repeat): tsc/eslint clean; `npm run build` compiled at `f594007`; live browser at final HEAD — TTL-state restore shows 5/5, then a same-document language switch (EN→中文) keeps the counter at 5/5 (your r2 repro previously dropped it), UI fully re-rendered in Chinese.

Report: two per-item verdicts with file:line evidence, a new-breakage section, and an overall verdict line: CONSENSUS-SHIP / REVISE / BLOCK.
