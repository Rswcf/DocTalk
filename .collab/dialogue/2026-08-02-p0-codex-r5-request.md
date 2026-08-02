# Codex r5 — scoped verification of the r4 fix (P0 demo re-tune batch)

Your r4 report tail (`.collab/reviews/2026-08-02-p0-demo-retune-codex-r4.md`, "# Codex r4 — scoped verification" section) verdicted all three r3 items ADDRESSED with ONE new IMPORTANT: a stale same-session re-anchor erasing newer accounting. One commit since your r4 head (`ffe2461`):

```
git log --oneline ffe2461..51b470b
git diff ffe2461..51b470b
```

`51b470b` — `demoAccountingEpoch` (store, init 0) + `bumpDemoAccountingEpoch()`, bumped at five accounting-mutation points: useChatSession top-of-effect reset, post-adopt install, post-create install, sendMessage start (maxUserMessages != null guard), and bumpDemoUsageForRegenOrContinue. `reanchorDemoCounter` captures the epoch synchronously at call time and writes only when BOTH sessionId AND epoch still match at resolve; drops silently otherwise. reanchor deliberately does NOT bump the epoch itself (a read of truth, not an accounting event). SessionDropdown's onNewChat/onSwitchSession deliberately do NOT bump: both change sessionId within the same operation, so the existing sessionId guard fully covers them — epoch only matters for same-session ordering.

Scope: verdict the r4 item ADDRESSED / NOT ADDRESSED; probe the epoch design (missed accounting-mutation point? out-of-order failure GETs? the deliberate omissions above); flag NEW breakage in this one commit only. Everything settled in r2/r3/r4 stays settled.

Evidence (audit, don't repeat): tsc/eslint clean; `npm run build` compiled at `51b470b`.

Report: one verdict with file:line evidence, new-breakage section, overall verdict line: CONSENSUS-SHIP / REVISE / BLOCK.
