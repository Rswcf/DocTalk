# Codex M3 r3 — final scoped verification

Your M3 r2 left #3 and #4 incomplete plus a test-strength note and comment drift. Four commits since your r2 head:

```
git log --oneline b923caa..HEAD
git diff b923caa..HEAD
```

- 9989851 (#3): explicit single-in-flight PATCH queue per card — a blur during flight overwrites a queued ref; finally drains exactly one queued value, recursing only if it differs from confirmed. Never >1 request in flight per card → out-of-order commits structurally impossible from a client (not merely ignored). Cross-tab last-write-wins documented as the accepted v1 semantic.
- 5382a4a (#4): key = chunkId + page + pageEnd + FNV-1a 32-bit hash of the WHOLE text (`hashText32`/`quoteResultCardKey` in utils.ts) + belt-and-braces effect resetting saved/saving off identity props.
- ed6b46a (test strength + wording): identical-save concurrency test now requires BOTH concurrent calls to succeed (one created=True, one created=False, same row id; no return_exceptions tolerance) — reliable across 8 runs, mutation-tested against lock removal; selectinload "join/no second round trip" wording corrected in all three docstrings.
- e47328f: api.ts stale docstring corrected.

Task: verdict #3 and #4 ADDRESSED / NOT ADDRESSED; confirm the two cleanups; flag NEW breakage in these four commits only; if clean, all M3 r1/r2 findings are closed — issue the FINAL M3 batch verdict (range eb140bc..HEAD, excluding docs commits).

Evidence (audit, don't repeat): 779 unit pass/26 skip, 23 real-Postgres integration pass, ruff + tsc + lint + build clean at HEAD.

Report: verdicts + new-breakage + overall verdict CONSENSUS-SHIP / REVISE / BLOCK.
