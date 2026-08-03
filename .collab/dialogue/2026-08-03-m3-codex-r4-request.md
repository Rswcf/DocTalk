# Codex M3 r4 — final one-commit verification

Your r3 left #3 (check order) and #4 (FNV collision) with precise traces. One commit since your r3 head:

```
git show 17046de
```

- #3: `handleNoteBlur` checks `inFlightRef` FIRST; while in flight the latest value is ALWAYS queued (even if equal to the soon-stale confirmed value — only the drain step, comparing after confirmed updates, can judge correctly); the no-op short-circuit fires only when idle. Your revert-to-A-during-B trace now ends with A queued, drained after B, and PATCHed — A final.
- #4: `hashText32` dropped from the key path — `quoteResultCardKey` uses the FULL displayText; plus `handleSave` captures the card identity at start and compares against a per-render ref before `setSaved(true)`/paywall, so a save begun under one identity cannot mark different data.
- Doc nit: both api.ts comments now say "bounded second SELECT via selectinload".

Task: verdict #3/#4 ADDRESSED / NOT ADDRESSED; flag NEW breakage in this one commit; if clean, ALL M3 r1-r3 findings are closed — issue the FINAL M3 batch verdict (eb140bc..HEAD, docs commits excluded).

Evidence: tsc/lint/build clean at 17046de; backend unchanged (779/26 + 23 integration standing).

Report: verdicts + new-breakage + overall verdict CONSENSUS-SHIP / REVISE / BLOCK.
