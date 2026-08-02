# Codex r4 — scoped verification of the r3 fixes (P0 demo re-tune batch)

Your r3 report (`.collab/reviews/2026-08-02-p0-demo-retune-codex-r3.md`) verdicted REVISE with three IMPORTANT breakages. The rollback DESIGN was abandoned in response, not patched. Three commits since your r3 head (`f594007`):

```
git log --oneline f594007..ffe2461
git diff f594007..ffe2461
```

- `2b85cef` — `preBumpDemoUsedRef` and all rollback logic DELETED. Optimistic +1 kept at regen/continue start. New `reanchorDemoCounter(sessionId)`: fire-and-forget GET of the session's messages → on `demo_messages_used != null`, re-anchors BOTH `demoMessagesUsed` (server truth) and `demoRestoredUserMsgCount` (live transcript user count). Called from every terminal failure path of regen/continue via two mechanisms matched to sse.ts's actual semantics: an `onErrorOverride` for callback-reported errors (sendMessage's path byte-for-byte unchanged via default arg) + try/catch at the callers for thrown fetch() rejections. Abort excluded (server necessarily charged; bump already reflects it).
  - Addresses your r3 breakage 1 (server-charged failures now converge to authoritative truth instead of being guessed), breakage 2 (no token exists to go stale), and the thrown-fetch gap (caller-level catch).
- `fc02b86` — `useChatSession`'s documentId-keyed effect now synchronously clears `sessionId`/`messages`/`sessions` at the top, so during unresolved adoption of doc B, doc A's chat can never render; on transient adoption failure the early return leaves `sessionId` null → DocumentReaderPageClient's precedence falls through to `sessionErrorCopy`. Pointer preserved, no createSession fall-through, delete-pointer behavior unchanged. Addresses your r3 breakage 3.
- `ffe2461` — hardening: reanchor's resolve re-reads the store's CURRENT sessionId and writes only if it still matches the session it was called for (late-resolve unmount race found in self-review).

Scope: verdict these three r3 items ADDRESSED / NOT ADDRESSED, probe the new re-anchor design adversarially (double-fire? interaction with a concurrent sendMessage's own accounting? the getState guard's TOCTOU window?), flag NEW breakage in these three commits only. Everything settled in r2/r3 stays settled.

Evidence (audit, don't repeat): tsc/eslint clean per commit; `npm run build` compiled at `ffe2461`.

Report: three per-item verdicts with file:line evidence, new-breakage section, overall verdict line: CONSENSUS-SHIP / REVISE / BLOCK.
