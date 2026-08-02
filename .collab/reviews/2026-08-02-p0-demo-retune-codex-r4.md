Reading prompt from stdin...
2026-08-02T00:45:08.195895Z ERROR codex_core::session::session: failed to load skill /Users/mayijie/Projects/Code/010_DocTalk/.agents/skills/deploy/SKILL.md: missing YAML frontmatter delimited by ---
2026-08-02T00:45:08.195931Z ERROR codex_core::session::session: failed to load skill /Users/mayijie/Projects/Code/010_DocTalk/.agents/skills/codex-implement/SKILL.md: missing YAML frontmatter delimited by ---
OpenAI Codex v0.144.0
--------
workdir: /Users/mayijie/Projects/Code/010_DocTalk
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR]
reasoning effort: xhigh
reasoning summaries: none
session id: 019fbfee-869e-71e1-bb5a-0f60997009c8
--------
user
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

codex
I’ll scope this strictly to `f594007..ffe2461`: read the frontend rules and r3 findings, trace the modified state/SSE paths, then record an r4 report with the three requested verdicts and any newly introduced breakage.
  → Read review context, scoped rules, and the three-commit diff
  • Trace each r3 item and adversarial re-anchor/accounting races
  • Write the r4 report and verify its evidence
exec
/bin/zsh -lc "git status --short && git log --oneline f594007..ffe2461 && sed -n '1,260p' .claude/rules/frontend.md && sed -n '1,280p' .collab/reviews/2026-08-02-p0-demo-retune-codex-r3.md && git diff --stat f594007..ffe2461 && git diff --find-renames f594007..ffe2461" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
?? .collab/dialogue/2026-08-02-p0-codex-r1-triage.md
?? .collab/dialogue/2026-08-02-p0-codex-r2-request.md
?? .collab/dialogue/2026-08-02-p0-codex-r3-request.md
?? .collab/dialogue/2026-08-02-p0-codex-r4-request.md
?? .collab/plans/2026-08-02-p0-demo-retune-ui-fixes.md
?? .collab/reviews/2026-08-02-p0-demo-retune-codex-r1.md
?? .collab/reviews/2026-08-02-p0-demo-retune-codex-r2.md
?? .collab/reviews/2026-08-02-p0-demo-retune-codex-r3.md
?? .collab/reviews/2026-08-02-p0-demo-retune-codex-r4.md
?? .collab/reviews/2026-08-02-p0-demo-retune-review-request.md
ffe2461 fix(demo): guard reanchorDemoCounter against a late-resolving unmount race
fc02b86 fix(demo): COMMIT-2 — adoption state dominates rendering, not just the counter (Codex r3)
2b85cef fix(demo): COMMIT-1 — replace regen/continue rollback with authoritative re-anchor (Codex r3)
---
paths:
  - "frontend/**"
---

# Frontend Conventions

## Architecture
- **All pages are `"use client"`** — client components with server wrapper for metadata
- Pages that fetch API data must render meaningful content in loading AND error states (prevents Google Soft 404)

## API Proxy
- **ALL** frontend→backend calls go through `/api/proxy/*` route, which injects JWT. Including SSE chat stream (`sse.ts`). Missing this = 401 errors
- **JWT double-layer**: Auth.js uses encrypted JWE (unreadable by backend). Proxy creates plain HS256 JWT via `jose`. Backend `deps.py` validates exp/iat/sub
- `allowDangerousEmailAccountLinking: true` enables cross-provider auto-linking by email
- **Proxy maxDuration**: `route.ts` exports `maxDuration = 60` (Vercel Hobby limit). SSE chat 60s timeout, others 30s

## UI Design System
- **Palette (app UI)**: zinc monochrome + blue accent (`#1D4ED8`/`#60A5FA`). Zero `gray-*`/`indigo-*`/`violet-*`/`purple-*` classes (except Google OAuth brand + status colors). Zero `transition-all` (use specific properties)
- **Editorial marketing layer**: the entire public marketing surface (unauthenticated `/`, `use-cases/*`, `compare/*`, `alternatives/*`, `features/*`, `tools/*`, `pricing`, `trust`, `demo`) uses a SEPARATE scoped editorial design system — `frontend/src/app/editorial.css` (every rule under `.dt-editorial`), a warm-paper palette (`--ed-paper`/`--ed-ink`/`--ed-signal` terracotta `#b0472f`/`--ed-ochre`) with Newsreader serif + IBM Plex Mono fonts, **light-only**. It does NOT use the zinc/blue app palette. **Design decision locked 2026-05-20**: the product runs on TWO surface treatments (editorial marketing terracotta+warm-paper vs functional app zinc+blue) sharing one token base (logo, body font Inter, spacing scale, micro-interactions). A blue-accent unification was tried and reverted because the warm-paper terracotta identity is load-bearing. Do not re-propose merging the accents. Marketing pages compose the shared editorial kit in `frontend/src/components/marketing/` (`MarketingShell`, `EditorialMarketingHeader`, `EdPageHero`, `EdSection`, `EdProse`, `EdFeatureList`, `EdCardGrid`, `EdStepRow`, `EdFaqList`, `EdCtaBanner`, `EdComparisonTable`, `EdInlineCell`, `EdRelatedLinks`, `EdCheckList`, `EdChoiceList`) — `MarketingShell` supplies the `.dt-editorial` root, so kit components never add it themselves. Keep editorial styles scoped under `.dt-editorial`; do not let them leak into the functional app UI, and do not apply the zinc/blue rule to editorial components. Pages still on the zinc/blue app palette: `about`, `contact`, `imprint`, `privacy`, `terms`, `blog/*`, `document-diff` (not yet editorialized).
- **i18n**: Components using `t()` MUST be inside `<LocaleProvider>`. Outside = raw key fallback. Only `en` is statically loaded; other 10 locales lazy-loaded

## PDF & Documents
- **react-pdf v9 CJK**: After upgrading react-pdf/pdfjs-dist, MUST re-copy `cmaps/`, `standard_fonts/`, `pdf.worker.min.mjs` to `public/`. Worker loaded from same-origin (not CDN) for CSP compliance
- **bbox coordinates**: Normalized [0,1], top-left origin. Three citation highlight strategies: ① PDF bbox, ② TextViewer text-snippet match, ③ converted PDF fallback to text-snippet when dummy bbox detected

## Subscriptions & Feature Gating
- Free (300/mo) + Plus (3K/mo, $9.99) + Pro (9K/mo, $19.99). Annual = 20% discount
- Visible modes are Flash and Pro. Internal IDs remain `quick` and `balanced`; retired modes such as `thorough` must migrate to Flash.
- Free includes Flash plus a capped number of Pro answers/month. Export: Plus+ (frontend gated). Custom Instructions: Pro (backend gated). Sessions: Free=3/doc (backend gated)
- Credit packs: Boost(500/$3.99), Power(2K/$9.99), Ultra(5K/$19.99)
- Cancellation UI must remain self-serve. The cancel form may collect an optional reason, optional feedback, and a refund-review checkbox, but it must not block cancellation on those fields.
# Codex r3 — scoped verification of the two r2 must-fix items

Review range: `98df9e3..f594007`

Scope is limited to r2 must-fix #2 and #3 plus regressions introduced by
`65046a5` and `f594007`. The seven settled findings and three accepted parked
rulings were not reopened. I audited the supplied typecheck/lint/build/browser
evidence rather than repeating it.

## MUST-FIX-A / r2 #2 — NOT ADDRESSED

The document-reset half is addressed. `clearDocumentTransientState` no longer
touches either demo-counter field (`frontend/src/store/index.ts:317-337`), so
the locale-sensitive `useDocumentLoader` effect cannot zero them on a language
change. `useChatSession` resets both fields before its async adoption/load path
and every successful anonymous adopt/create path then installs a fresh server
baseline (`frontend/src/lib/useChatSession.ts:25-39,52-88,128-151`). This
covers a ready document transition; while a destination is not ready, chat is
not rendered, and the same effect runs when its status reaches `ready`
(`frontend/src/lib/useChatSession.ts:25-26,165`). The supplied EN→中文 5/5
browser result is consistent with this control flow.

The regenerate/continue error convergence is still incomplete and introduces
two undercount paths:

1. The rollback exists only inside `handleStreamError`
   (`frontend/src/lib/useChatStream.ts:114-138`). A rejection from `fetch()`
   itself bypasses that callback: both SSE helpers await `fetch` outside any
   `try/catch` (`frontend/src/lib/sse.ts:157-205,212-258`), and their callers
   likewise await them without catching
   (`frontend/src/lib/useChatStream.ts:267-289,341-398`). A network failure
   therefore still leaves the optimistic bump installed, which is one of the
   concrete r2 repro classes.
2. Rolling back *every* non-abort callback error is not safe because it does
   not establish whether quota was consumed. In particular, the continuation
   endpoint increments the demo tracker before validating that the message
   exists or is still continuable (`backend/app/api/chat.py:508-550`). A 404
   `MESSAGE_NOT_FOUND` or 400 `CONTINUATION_LIMIT` is therefore charged by the
   backend, but `handleStreamError` restores the pre-bump client value. Errors
   emitted after the normal chat endpoint's tracker increment have the same
   ambiguity (`backend/app/api/chat.py:398-445`). This violates r2's requirement
   to roll back only failures known not to consume quota or otherwise refresh
   the authoritative count.

The ref is single-consumer under normal completion/error, so the same terminal
callback cannot double-restore it. Abort is not cleanly consumed, however:
`_processSSEStream` returns without `onError`/`onDone` when the signal is
aborted (`frontend/src/lib/sse.ts:136-153`), while `stopStreaming` neither
clears `preBumpDemoUsedRef` nor otherwise commits it
(`frontend/src/lib/useChatStream.ts:400-405`). A later ordinary `sendMessage`
does not overwrite that ref; if that later request fails, the shared
`handleStreamError` can restore the stale pre-abort value and undo usage from
the earlier, deliberately retained regenerate/continue charge.

Required revision: route thrown SSE/fetch failures through one terminal cleanup
path; consume the pending rollback token on abort without restoring it; and
either refresh `demo_messages_used` after an ambiguous non-abort failure or
restrict rollback to errors whose server ordering proves that the tracker did
not increment.

## MUST-FIX-B / r2 #3 — NOT ADDRESSED

The two requested lifecycle operations are present in isolation:

- A non-404/403 stored-session adoption failure sets `sessionError` and returns
  before `listSessions`/`createSession`, while preserving the pointer
  (`frontend/src/lib/useChatSession.ts:89-108`). Reload therefore retries the
  same stored ID.
- After a successful delete, a pointer naming the deleted session is cleared
  before either replacement GET/create begins
  (`frontend/src/components/SessionDropdown.tsx:119-140`). A successful
  replacement subsequently writes its own pointer through the existing switch
  or new-chat path (`frontend/src/components/SessionDropdown.tsx:59-114`).

The stopped adoption path is not state-safe on an in-app document transition.
Per-document clearing intentionally retains `sessionId`, `sessions`, and
`messages` (`frontend/src/store/index.ts:317-337`), and the new transient catch
does not clear them before returning. Thus, when document A already has a
truthy session and adoption of stored document-B session fails transiently,
the global store still identifies A's session/transcript. The reader tests
`documentStatus === 'ready' && sessionId` *before* `sessionErrorCopy`, so it
renders `ChatPanel` for that stale A session and hides the retryable error
(`frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:366-393`). The
user can therefore remain on document B with document A's active chat/session,
rather than seeing the promised stop-and-retry error. Initial/full reload is
safer only because the store begins without a session ID.

Required revision: make a session-loading/adoption error dominate chat
rendering and prevent an old document's session/messages from remaining active
while the new document's adoption is unresolved. Preserve the stored B pointer
and retain the no-create behavior.

## New breakage introduced by these commits

1. **IMPORTANT — broad rollback can undercount a server-charged failure.**
   Introduced by `65046a5`: continuation validation and downstream stream
   failures can occur after the backend tracker increment, but every non-abort
   callback error restores the client pre-bump value.
2. **IMPORTANT — an abort leaves a live rollback token that can affect a later
   unrelated send.** Introduced by `65046a5`: the SSE abort path invokes no
   terminal callback and `stopStreaming` does not clear the new ref.
3. **IMPORTANT — transient adoption stop can expose the prior document's chat
   instead of its error.** Introduced by `f594007`: the new early return leaves
   the old truthy `sessionId` in place, and existing render precedence selects
   `ChatPanel` over `sessionErrorCopy`.

The thrown-network-failure drift is incomplete remediation of r2 #2, not a
separate new regression. The delete-pointer change itself introduces no new
breakage in the reviewed diff. `git diff --check 98df9e3..f594007` passes.

**Overall verdict: REVISE.**
 frontend/src/lib/useChatSession.ts |  16 ++++
 frontend/src/lib/useChatStream.ts  | 172 ++++++++++++++++++++++++-------------
 frontend/src/store/index.ts        |   4 +-
 3 files changed, 132 insertions(+), 60 deletions(-)
diff --git a/frontend/src/lib/useChatSession.ts b/frontend/src/lib/useChatSession.ts
index 340cb7a..2d5de66 100644
--- a/frontend/src/lib/useChatSession.ts
+++ b/frontend/src/lib/useChatSession.ts
@@ -37,6 +37,22 @@ export function useChatSession(documentId: string | undefined): UseChatSessionRe
     // same run, so the momentary reset here is safe.
     setDemoMessagesUsed(0);
     setDemoRestoredUserMsgCount(0);
+    // Clear the PREVIOUS document's session/messages/sessions synchronously
+    // too (Codex r3 breakage 3), not just the counter. Without this, a
+    // transient adoption failure for document B left document A's still-
+    // truthy sessionId/messages sitting in the store; DocumentReaderPageClient
+    // renders `documentStatus === 'ready' && sessionId ? <ChatPanel/> :
+    // sessionErrorCopy ? <error/> : ...` — checking sessionId BEFORE the
+    // error — so it kept showing A's stale chat instead of B's retryable
+    // error. This also closes a pre-existing (unrelated) stale-chat flash on
+    // any in-app document transition, since A's session/messages previously
+    // lingered in the store until B's adopt/create resolved. The brief
+    // sessionId===null window this creates renders a benign "initializing
+    // chat" placeholder (DocumentReaderPageClient's final else branch), not
+    // a blank/broken state.
+    setSessionId(null);
+    setMessages([]);
+    setSessions([]);
     let cancelled = false;
 
     (async () => {
diff --git a/frontend/src/lib/useChatStream.ts b/frontend/src/lib/useChatStream.ts
index 648a790..f17348c 100644
--- a/frontend/src/lib/useChatStream.ts
+++ b/frontend/src/lib/useChatStream.ts
@@ -2,6 +2,7 @@
 
 import { useCallback, useMemo, useRef } from 'react';
 import { chatStream, continueStream } from './sse';
+import { getMessages } from './api';
 import { useDocTalkStore } from '../store';
 import type { Message } from '../types';
 import { triggerCreditsRefresh } from '../components/CreditsDisplay';
@@ -69,11 +70,6 @@ export function useChatStream({
   } = useDocTalkStore();
 
   const abortRef = useRef<AbortController | null>(null);
-  // Pending rollback value for an optimistic regenerate/continue quota bump
-  // (see bumpDemoUsageForRegenOrContinue below) — null when no bump is
-  // awaiting resolution. Set right before the bump, consumed (cleared) by
-  // whichever of handleStreamDone/handleStreamError fires next.
-  const preBumpDemoUsedRef = useRef<number | null>(null);
 
   // Contract: totalUsed = demoMessagesUsed (server-known count as of the last
   // restore/create) + messages sent locally since then. demoRestoredUserMsgCount
@@ -111,33 +107,62 @@ export function useChatStream({
     [],
   );
 
+  // Shared by handleStreamError and the regenerate/continue catch blocks
+  // below — both need to recognize a user-initiated abort the same way.
+  const isAbortLikeError = useCallback((err: unknown): boolean => {
+    const name = typeof err === 'object' && err && 'name' in err
+      ? String((err as { name?: unknown }).name || '')
+      : '';
+    const message = typeof err === 'object' && err && 'message' in err
+      ? String((err as { message?: unknown }).message || '')
+      : '';
+    return name === 'AbortError' || message.includes('AbortError');
+  }, []);
+
+  // Fire-and-forget re-sync to server truth after a regenerate/continue
+  // failure — replaces the r2 ref-based rollback (Codex r3: a rollback token
+  // could go stale across an aborted call and then incorrectly undo a later,
+  // unrelated send's usage). GETs the current session's messages and, if the
+  // response carries demo_messages_used (anon demo only), re-anchors BOTH
+  // fields to "right now": the raw server count, and a baseline equal to the
+  // LIVE transcript's current user-message count (not the fetched
+  // transcript's) — so useChatStream's formula converges immediately without
+  // needing a full page reload, regardless of whether the failed request
+  // actually consumed server quota or not. Errors are swallowed: this is a
+  // best-effort correction, not something that should surface to the user.
+  const reanchorDemoCounter = useCallback((forSessionId: string) => {
+    if (maxUserMessages == null) return;
+    getMessages(forSessionId)
+      .then((msgsData) => {
+        if (msgsData.demo_messages_used == null) return;
+        const state = useDocTalkStore.getState();
+        // The GET can resolve after the user has already navigated away —
+        // e.g. useChatSession's effect ran its synchronous reset for a NEW
+        // document/session while this was in flight. Re-read the CURRENT
+        // sessionId from the store (not a closure) and only write if it
+        // still matches the session this reanchor was called for; otherwise
+        // the fetched-for-A truth would clobber whatever B's own
+        // adopt/create already established. Drop it silently — B's own
+        // adoption path is the authoritative source for B's counter.
+        if (state.sessionId !== forSessionId) return;
+        state.setDemoMessagesUsed(msgsData.demo_messages_used);
+        state.setDemoRestoredUserMsgCount(
+          state.messages.filter((m) => m.role === 'user').length,
+        );
+      })
+      .catch(() => {
+        // best-effort — a later restore/regenerate/continue will try again
+      });
+  }, [maxUserMessages]);
+
   const handleStreamError = useCallback((err: unknown) => {
     flushPendingText();
     setStreaming(false);
     abortRef.current = null;
 
     const { message, code, status } = getErrorMeta(err);
-    const name = typeof err === 'object' && err && 'name' in err
-      ? String((err as { name?: unknown }).name || '')
-      : '';
-    const isAbort = name === 'AbortError' || message.includes('AbortError');
-
-    // Roll back a pending optimistic regenerate/continue quota bump (see
-    // bumpDemoUsageForRegenOrContinue) on any non-abort failure. We can't
-    // know for certain whether the backend's quota check ran before or
-    // after whatever rejected this request, so this is a heuristic, not a
-    // guarantee — any residual drift self-corrects on the next session
-    // restore, which always re-syncs to the server's raw count. On an
-    // explicit user abort we leave the bump in place: streaming can only be
-    // aborted once the backend has already started responding, at which
-    // point it plausibly already charged.
-    const pendingDemoBumpRestore = preBumpDemoUsedRef.current;
-    preBumpDemoUsedRef.current = null;
-    if (!isAbort && pendingDemoBumpRestore != null) {
-      useDocTalkStore.getState().setDemoMessagesUsed(pendingDemoBumpRestore);
-    }
 
-    if (isAbort) {
+    if (isAbortLikeError(err)) {
       return;
     }
 
@@ -221,7 +246,7 @@ export function useChatStream({
       isError: true,
       createdAt: Date.now(),
     });
-  }, [addMessage, flushPendingText, getErrorMeta, onShowPaywall, setStreaming, t, tOr, currentPlan]);
+  }, [addMessage, flushPendingText, getErrorMeta, isAbortLikeError, onShowPaywall, setStreaming, t, tOr, currentPlan]);
 
   const handleTruncated = useCallback(() => {
     flushPendingText();
@@ -232,9 +257,6 @@ export function useChatStream({
     flushPendingText();
     setStreaming(false);
     abortRef.current = null;
-    // Stream completed successfully — any pending regenerate/continue quota
-    // bump stands (no rollback needed).
-    preBumpDemoUsedRef.current = null;
     updateSessionActivity(sessionId);
     triggerCreditsRefresh();
     trackEvent('chat_message_completed', { source: 'chat_stream', mode: selectedMode });
@@ -264,7 +286,10 @@ export function useChatStream({
     updateLastMessageMeta({ citations: citations || [] });
   }, [flushPendingText, updateLastMessageMeta]);
 
-  const streamAssistantResponse = useCallback(async (prompt: string) => {
+  // `onErrorOverride` lets a caller observe an error before it reaches the
+  // shared `handleStreamError` (used by regenerateLastResponse to trigger a
+  // demo-counter re-anchor without changing sendMessage's behavior at all).
+  const streamAssistantResponse = useCallback(async (prompt: string, onErrorOverride?: (err: unknown) => void) => {
     const controller = new AbortController();
     abortRef.current = controller;
 
@@ -274,7 +299,7 @@ export function useChatStream({
       prompt,
       ({ text }) => updateLastMessage(text || ''),
       (citation) => addCitationToLastMessage(citation),
-      handleStreamError,
+      onErrorOverride ?? handleStreamError,
       handleStreamDone,
       handleTruncated,
       selectedMode,
@@ -324,17 +349,20 @@ export function useChatStream({
   // an existing turn), but the backend increments demo quota on both — so
   // without this the UI would undercount relative to the server. Bumps
   // demoMessagesUsed directly (not the baseline, which only moves at
-  // restore/create) and optimistically, before the stream starts — same
-  // timing as `sendMessage`'s optimistic user-message add. Unlike
-  // sendMessage's bump (which is inherent to the persisted transcript and
-  // was already accepted as unconditional), this one records the pre-bump
-  // value so handleStreamError can roll it back on failure — see there for
-  // why. No-op outside demo (maxUserMessages == null), so authenticated/
-  // non-demo sessions are untouched.
+  // restore/create) and optimistically, before the stream starts — correct
+  // whenever the server actually charges, which is the dominant case,
+  // including an abort (streaming can only be aborted once the backend has
+  // already started responding, so it plausibly already charged). No
+  // rollback here on failure — see reanchorDemoCounter above: instead of
+  // guessing whether a given failure means the server charged or not (r3:
+  // that guess is unsafe — e.g. the continuation endpoint charges quota
+  // BEFORE validating the message is still continuable, so a 404/400 there
+  // is still a real charge), a failed regenerate/continue re-syncs to
+  // server truth directly. No-op outside demo (maxUserMessages == null), so
+  // authenticated/non-demo sessions are untouched.
   const bumpDemoUsageForRegenOrContinue = useCallback(() => {
     if (maxUserMessages == null) return;
     const state = useDocTalkStore.getState();
-    preBumpDemoUsedRef.current = state.demoMessagesUsed;
     state.setDemoMessagesUsed(state.demoMessagesUsed + 1);
   }, [maxUserMessages]);
 
@@ -361,8 +389,23 @@ export function useChatStream({
     bumpDemoUsageForRegenOrContinue();
     setStreaming(true);
 
-    await streamAssistantResponse(lastUserText);
-  }, [isStreaming, addMessage, setStreaming, streamAssistantResponse, bumpDemoUsageForRegenOrContinue]);
+    try {
+      // Covers errors reported via the SSE error event/mid-stream failures
+      // (which resolve normally, so a try/catch alone wouldn't see them) —
+      // re-anchor before delegating to the shared error handler.
+      await streamAssistantResponse(lastUserText, (err) => {
+        reanchorDemoCounter(sessionId);
+        handleStreamError(err);
+      });
+    } catch (e) {
+      // Covers a thrown fetch() rejection (network failure before/instead
+      // of any SSE response) — the one case the onError override above
+      // can't see, since it never fires. Re-throws unchanged (nothing here
+      // catches it today either) — this only adds the re-anchor.
+      if (!isAbortLikeError(e)) reanchorDemoCounter(sessionId);
+      throw e;
+    }
+  }, [isStreaming, addMessage, setStreaming, streamAssistantResponse, bumpDemoUsageForRegenOrContinue, reanchorDemoCounter, sessionId, handleStreamError, isAbortLikeError]);
 
   const continueGenerating = useCallback(async () => {
     if (isStreaming) return;
@@ -379,23 +422,36 @@ export function useChatStream({
     const controller = new AbortController();
     abortRef.current = controller;
 
-    await continueStream(
-      sessionId,
-      lastMsg.backendId || '',
-      ({ text }) => updateLastMessage(text || ''),
-      (citation) => addCitationToLastMessage(citation),
-      handleStreamError,
-      handleStreamDone,
-      handleTruncated,
-      selectedMode,
-      locale,
-      controller.signal,
-      (artifact) => addArtifactToLastMessage(artifact),
-      ({ message }) => setLastMessageToolStatus(message),
-      handleAnswerRepaired,
-      handleCitationsRefined,
-    );
-  }, [isStreaming, sessionId, markLastMessageTruncated, setStreaming, updateLastMessage, addCitationToLastMessage, addArtifactToLastMessage, setLastMessageToolStatus, handleStreamError, handleStreamDone, handleTruncated, handleAnswerRepaired, handleCitationsRefined, selectedMode, locale, bumpDemoUsageForRegenOrContinue]);
+    try {
+      await continueStream(
+        sessionId,
+        lastMsg.backendId || '',
+        ({ text }) => updateLastMessage(text || ''),
+        (citation) => addCitationToLastMessage(citation),
+        // Re-anchor before delegating — covers SSE error-event/mid-stream
+        // failures, which resolve normally (see the try/catch below for the
+        // thrown-fetch-rejection case a callback can't see).
+        (err) => {
+          reanchorDemoCounter(sessionId);
+          handleStreamError(err);
+        },
+        handleStreamDone,
+        handleTruncated,
+        selectedMode,
+        locale,
+        controller.signal,
+        (artifact) => addArtifactToLastMessage(artifact),
+        ({ message }) => setLastMessageToolStatus(message),
+        handleAnswerRepaired,
+        handleCitationsRefined,
+      );
+    } catch (e) {
+      // Thrown fetch() rejection — re-throws unchanged (nothing here catches
+      // it today either), this only adds the re-anchor.
+      if (!isAbortLikeError(e)) reanchorDemoCounter(sessionId);
+      throw e;
+    }
+  }, [isStreaming, sessionId, markLastMessageTruncated, setStreaming, updateLastMessage, addCitationToLastMessage, addArtifactToLastMessage, setLastMessageToolStatus, handleStreamError, handleStreamDone, handleTruncated, handleAnswerRepaired, handleCitationsRefined, selectedMode, locale, bumpDemoUsageForRegenOrContinue, reanchorDemoCounter, isAbortLikeError]);
 
   const stopStreaming = useCallback(() => {
     abortRef.current?.abort();
diff --git a/frontend/src/store/index.ts b/frontend/src/store/index.ts
index 7bcc0e7..f7f380b 100644
--- a/frontend/src/store/index.ts
+++ b/frontend/src/store/index.ts
@@ -93,7 +93,7 @@ export interface DocTalkStore {
   addArtifactToLastMessage: (artifact: ChatArtifact) => void;
   setLastMessageToolStatus: (message: string) => void;
   setStreaming: (v: boolean) => void;
-  setSessionId: (id: string) => void;
+  setSessionId: (id: string | null) => void;
   setSelectedMode: (id: string) => void;
   setDomainMode: (mode: string | null) => void;
   setMessages: (msgs: Message[]) => void;
@@ -266,7 +266,7 @@ export const useDocTalkStore = create<DocTalkStore>((set, get) => ({
     set({ messages: [...msgs.slice(0, -1), { ...last, toolStatus: message }] });
   },
   setStreaming: (v: boolean) => set({ isStreaming: v }),
-  setSessionId: (id: string) => set({ sessionId: id }),
+  setSessionId: (id: string | null) => set({ sessionId: id }),
   setSelectedMode: (id: string) => {
     set({ selectedMode: id });
     try {

codex
The three structural changes are present. I’m now testing the re-anchor as an asynchronous state transition, especially whether an older GET can overwrite accounting established by a later send or later re-anchor; the session-ID guard only addresses cross-session writes.
exec
/bin/zsh -lc "sed -n '1,260p' .collab/reviews/2026-08-02-p0-demo-retune-codex-r4.md 2>/dev/null || true
nl -ba frontend/src/lib/useChatStream.ts | sed -n '1,520p'
nl -ba frontend/src/lib/sse.ts | sed -n '1,310p'
nl -ba frontend/src/lib/api.ts | sed -n '1,260p'
nl -ba frontend/src/lib/useChatSession.ts | sed -n '1,240p'
nl -ba frontend/src/store/index.ts | sed -n '1,390p'
nl -ba frontend/src/app/d/'[documentId]'/DocumentReaderPageClient.tsx | sed -n '330,420p'
rg -n \"demo_messages_used|demoMessagesUsed|demoRestoredUserMsgCount|getMessages\\(\" backend frontend/src -g '"'!**/*.map'"'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
Reading prompt from stdin...
2026-08-02T00:45:08.195895Z ERROR codex_core::session::session: failed to load skill /Users/mayijie/Projects/Code/010_DocTalk/.agents/skills/deploy/SKILL.md: missing YAML frontmatter delimited by ---
2026-08-02T00:45:08.195931Z ERROR codex_core::session::session: failed to load skill /Users/mayijie/Projects/Code/010_DocTalk/.agents/skills/codex-implement/SKILL.md: missing YAML frontmatter delimited by ---
OpenAI Codex v0.144.0
--------
workdir: /Users/mayijie/Projects/Code/010_DocTalk
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR]
reasoning effort: xhigh
reasoning summaries: none
session id: 019fbfee-869e-71e1-bb5a-0f60997009c8
--------
user
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

codex
I’ll scope this strictly to `f594007..ffe2461`: read the frontend rules and r3 findings, trace the modified state/SSE paths, then record an r4 report with the three requested verdicts and any newly introduced breakage.
  → Read review context, scoped rules, and the three-commit diff
  • Trace each r3 item and adversarial re-anchor/accounting races
  • Write the r4 report and verify its evidence
exec
/bin/zsh -lc "git status --short && git log --oneline f594007..ffe2461 && sed -n '1,260p' .claude/rules/frontend.md && sed -n '1,280p' .collab/reviews/2026-08-02-p0-demo-retune-codex-r3.md && git diff --stat f594007..ffe2461 && git diff --find-renames f594007..ffe2461" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
?? .collab/dialogue/2026-08-02-p0-codex-r1-triage.md
?? .collab/dialogue/2026-08-02-p0-codex-r2-request.md
?? .collab/dialogue/2026-08-02-p0-codex-r3-request.md
?? .collab/dialogue/2026-08-02-p0-codex-r4-request.md
?? .collab/plans/2026-08-02-p0-demo-retune-ui-fixes.md
?? .collab/reviews/2026-08-02-p0-demo-retune-codex-r1.md
?? .collab/reviews/2026-08-02-p0-demo-retune-codex-r2.md
?? .collab/reviews/2026-08-02-p0-demo-retune-codex-r3.md
?? .collab/reviews/2026-08-02-p0-demo-retune-codex-r4.md
?? .collab/reviews/2026-08-02-p0-demo-retune-review-request.md
ffe2461 fix(demo): guard reanchorDemoCounter against a late-resolving unmount race
fc02b86 fix(demo): COMMIT-2 — adoption state dominates rendering, not just the counter (Codex r3)
2b85cef fix(demo): COMMIT-1 — replace regen/continue rollback with authoritative re-anchor (Codex r3)
---
paths:
  - "frontend/**"
---

# Frontend Conventions

## Architecture
- **All pages are `"use client"`** — client components with server wrapper for metadata
- Pages that fetch API data must render meaningful content in loading AND error states (prevents Google Soft 404)

## API Proxy
- **ALL** frontend→backend calls go through `/api/proxy/*` route, which injects JWT. Including SSE chat stream (`sse.ts`). Missing this = 401 errors
- **JWT double-layer**: Auth.js uses encrypted JWE (unreadable by backend). Proxy creates plain HS256 JWT via `jose`. Backend `deps.py` validates exp/iat/sub
- `allowDangerousEmailAccountLinking: true` enables cross-provider auto-linking by email
- **Proxy maxDuration**: `route.ts` exports `maxDuration = 60` (Vercel Hobby limit). SSE chat 60s timeout, others 30s

## UI Design System
- **Palette (app UI)**: zinc monochrome + blue accent (`#1D4ED8`/`#60A5FA`). Zero `gray-*`/`indigo-*`/`violet-*`/`purple-*` classes (except Google OAuth brand + status colors). Zero `transition-all` (use specific properties)
- **Editorial marketing layer**: the entire public marketing surface (unauthenticated `/`, `use-cases/*`, `compare/*`, `alternatives/*`, `features/*`, `tools/*`, `pricing`, `trust`, `demo`) uses a SEPARATE scoped editorial design system — `frontend/src/app/editorial.css` (every rule under `.dt-editorial`), a warm-paper palette (`--ed-paper`/`--ed-ink`/`--ed-signal` terracotta `#b0472f`/`--ed-ochre`) with Newsreader serif + IBM Plex Mono fonts, **light-only**. It does NOT use the zinc/blue app palette. **Design decision locked 2026-05-20**: the product runs on TWO surface treatments (editorial marketing terracotta+warm-paper vs functional app zinc+blue) sharing one token base (logo, body font Inter, spacing scale, micro-interactions). A blue-accent unification was tried and reverted because the warm-paper terracotta identity is load-bearing. Do not re-propose merging the accents. Marketing pages compose the shared editorial kit in `frontend/src/components/marketing/` (`MarketingShell`, `EditorialMarketingHeader`, `EdPageHero`, `EdSection`, `EdProse`, `EdFeatureList`, `EdCardGrid`, `EdStepRow`, `EdFaqList`, `EdCtaBanner`, `EdComparisonTable`, `EdInlineCell`, `EdRelatedLinks`, `EdCheckList`, `EdChoiceList`) — `MarketingShell` supplies the `.dt-editorial` root, so kit components never add it themselves. Keep editorial styles scoped under `.dt-editorial`; do not let them leak into the functional app UI, and do not apply the zinc/blue rule to editorial components. Pages still on the zinc/blue app palette: `about`, `contact`, `imprint`, `privacy`, `terms`, `blog/*`, `document-diff` (not yet editorialized).
- **i18n**: Components using `t()` MUST be inside `<LocaleProvider>`. Outside = raw key fallback. Only `en` is statically loaded; other 10 locales lazy-loaded

## PDF & Documents
- **react-pdf v9 CJK**: After upgrading react-pdf/pdfjs-dist, MUST re-copy `cmaps/`, `standard_fonts/`, `pdf.worker.min.mjs` to `public/`. Worker loaded from same-origin (not CDN) for CSP compliance
- **bbox coordinates**: Normalized [0,1], top-left origin. Three citation highlight strategies: ① PDF bbox, ② TextViewer text-snippet match, ③ converted PDF fallback to text-snippet when dummy bbox detected

## Subscriptions & Feature Gating
- Free (300/mo) + Plus (3K/mo, $9.99) + Pro (9K/mo, $19.99). Annual = 20% discount
- Visible modes are Flash and Pro. Internal IDs remain `quick` and `balanced`; retired modes such as `thorough` must migrate to Flash.
- Free includes Flash plus a capped number of Pro answers/month. Export: Plus+ (frontend gated). Custom Instructions: Pro (backend gated). Sessions: Free=3/doc (backend gated)
- Credit packs: Boost(500/$3.99), Power(2K/$9.99), Ultra(5K/$19.99)
- Cancellation UI must remain self-serve. The cancel form may collect an optional reason, optional feedback, and a refund-review checkbox, but it must not block cancellation on those fields.
# Codex r3 — scoped verification of the two r2 must-fix items

Review range: `98df9e3..f594007`

Scope is limited to r2 must-fix #2 and #3 plus regressions introduced by
`65046a5` and `f594007`. The seven settled findings and three accepted parked
rulings were not reopened. I audited the supplied typecheck/lint/build/browser
evidence rather than repeating it.

## MUST-FIX-A / r2 #2 — NOT ADDRESSED

The document-reset half is addressed. `clearDocumentTransientState` no longer
touches either demo-counter field (`frontend/src/store/index.ts:317-337`), so
the locale-sensitive `useDocumentLoader` effect cannot zero them on a language
change. `useChatSession` resets both fields before its async adoption/load path
and every successful anonymous adopt/create path then installs a fresh server
baseline (`frontend/src/lib/useChatSession.ts:25-39,52-88,128-151`). This
covers a ready document transition; while a destination is not ready, chat is
not rendered, and the same effect runs when its status reaches `ready`
(`frontend/src/lib/useChatSession.ts:25-26,165`). The supplied EN→中文 5/5
browser result is consistent with this control flow.

The regenerate/continue error convergence is still incomplete and introduces
two undercount paths:

1. The rollback exists only inside `handleStreamError`
   (`frontend/src/lib/useChatStream.ts:114-138`). A rejection from `fetch()`
   itself bypasses that callback: both SSE helpers await `fetch` outside any
   `try/catch` (`frontend/src/lib/sse.ts:157-205,212-258`), and their callers
   likewise await them without catching
   (`frontend/src/lib/useChatStream.ts:267-289,341-398`). A network failure
   therefore still leaves the optimistic bump installed, which is one of the
   concrete r2 repro classes.
2. Rolling back *every* non-abort callback error is not safe because it does
   not establish whether quota was consumed. In particular, the continuation
   endpoint increments the demo tracker before validating that the message
   exists or is still continuable (`backend/app/api/chat.py:508-550`). A 404
   `MESSAGE_NOT_FOUND` or 400 `CONTINUATION_LIMIT` is therefore charged by the
   backend, but `handleStreamError` restores the pre-bump client value. Errors
   emitted after the normal chat endpoint's tracker increment have the same
   ambiguity (`backend/app/api/chat.py:398-445`). This violates r2's requirement
   to roll back only failures known not to consume quota or otherwise refresh
   the authoritative count.

The ref is single-consumer under normal completion/error, so the same terminal
callback cannot double-restore it. Abort is not cleanly consumed, however:
`_processSSEStream` returns without `onError`/`onDone` when the signal is
aborted (`frontend/src/lib/sse.ts:136-153`), while `stopStreaming` neither
clears `preBumpDemoUsedRef` nor otherwise commits it
(`frontend/src/lib/useChatStream.ts:400-405`). A later ordinary `sendMessage`
does not overwrite that ref; if that later request fails, the shared
`handleStreamError` can restore the stale pre-abort value and undo usage from
the earlier, deliberately retained regenerate/continue charge.

Required revision: route thrown SSE/fetch failures through one terminal cleanup
path; consume the pending rollback token on abort without restoring it; and
either refresh `demo_messages_used` after an ambiguous non-abort failure or
restrict rollback to errors whose server ordering proves that the tracker did
not increment.

## MUST-FIX-B / r2 #3 — NOT ADDRESSED

The two requested lifecycle operations are present in isolation:

- A non-404/403 stored-session adoption failure sets `sessionError` and returns
  before `listSessions`/`createSession`, while preserving the pointer
  (`frontend/src/lib/useChatSession.ts:89-108`). Reload therefore retries the
  same stored ID.
- After a successful delete, a pointer naming the deleted session is cleared
  before either replacement GET/create begins
  (`frontend/src/components/SessionDropdown.tsx:119-140`). A successful
  replacement subsequently writes its own pointer through the existing switch
  or new-chat path (`frontend/src/components/SessionDropdown.tsx:59-114`).

The stopped adoption path is not state-safe on an in-app document transition.
Per-document clearing intentionally retains `sessionId`, `sessions`, and
`messages` (`frontend/src/store/index.ts:317-337`), and the new transient catch
does not clear them before returning. Thus, when document A already has a
truthy session and adoption of stored document-B session fails transiently,
the global store still identifies A's session/transcript. The reader tests
`documentStatus === 'ready' && sessionId` *before* `sessionErrorCopy`, so it
renders `ChatPanel` for that stale A session and hides the retryable error
(`frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:366-393`). The
user can therefore remain on document B with document A's active chat/session,
rather than seeing the promised stop-and-retry error. Initial/full reload is
safer only because the store begins without a session ID.

Required revision: make a session-loading/adoption error dominate chat
rendering and prevent an old document's session/messages from remaining active
while the new document's adoption is unresolved. Preserve the stored B pointer
and retain the no-create behavior.

## New breakage introduced by these commits

1. **IMPORTANT — broad rollback can undercount a server-charged failure.**
   Introduced by `65046a5`: continuation validation and downstream stream
   failures can occur after the backend tracker increment, but every non-abort
   callback error restores the client pre-bump value.
2. **IMPORTANT — an abort leaves a live rollback token that can affect a later
   unrelated send.** Introduced by `65046a5`: the SSE abort path invokes no
   terminal callback and `stopStreaming` does not clear the new ref.
3. **IMPORTANT — transient adoption stop can expose the prior document's chat
   instead of its error.** Introduced by `f594007`: the new early return leaves
   the old truthy `sessionId` in place, and existing render precedence selects
   `ChatPanel` over `sessionErrorCopy`.

The thrown-network-failure drift is incomplete remediation of r2 #2, not a
separate new regression. The delete-pointer change itself introduces no new
breakage in the reviewed diff. `git diff --check 98df9e3..f594007` passes.

**Overall verdict: REVISE.**
 frontend/src/lib/useChatSession.ts |  16 ++++
 frontend/src/lib/useChatStream.ts  | 172 ++++++++++++++++++++++++-------------
 frontend/src/store/index.ts        |   4 +-
 3 files changed, 132 insertions(+), 60 deletions(-)
diff --git a/frontend/src/lib/useChatSession.ts b/frontend/src/lib/useChatSession.ts
index 340cb7a..2d5de66 100644
--- a/frontend/src/lib/useChatSession.ts
+++ b/frontend/src/lib/useChatSession.ts
@@ -37,6 +37,22 @@ export function useChatSession(documentId: string | undefined): UseChatSessionRe
     // same run, so the momentary reset here is safe.
     setDemoMessagesUsed(0);
     setDemoRestoredUserMsgCount(0);
+    // Clear the PREVIOUS document's session/messages/sessions synchronously
+    // too (Codex r3 breakage 3), not just the counter. Without this, a
+    // transient adoption failure for document B left document A's still-
+    // truthy sessionId/messages sitting in the store; DocumentReaderPageClient
+    // renders `documentStatus === 'ready' && sessionId ? <ChatPanel/> :
+    // sessionErrorCopy ? <error/> : ...` — checking sessionId BEFORE the
+    // error — so it kept showing A's stale chat instead of B's retryable
+    // error. This also closes a pre-existing (unrelated) stale-chat flash on
+    // any in-app document transition, since A's session/messages previously
+    // lingered in the store until B's adopt/create resolved. The brief
+    // sessionId===null window this creates renders a benign "initializing
+    // chat" placeholder (DocumentReaderPageClient's final else branch), not
+    // a blank/broken state.
+    setSessionId(null);
+    setMessages([]);
+    setSessions([]);
     let cancelled = false;
 
     (async () => {
diff --git a/frontend/src/lib/useChatStream.ts b/frontend/src/lib/useChatStream.ts
index 648a790..f17348c 100644
--- a/frontend/src/lib/useChatStream.ts
+++ b/frontend/src/lib/useChatStream.ts
@@ -2,6 +2,7 @@
 
 import { useCallback, useMemo, useRef } from 'react';
 import { chatStream, continueStream } from './sse';
+import { getMessages } from './api';
 import { useDocTalkStore } from '../store';
 import type { Message } from '../types';
 import { triggerCreditsRefresh } from '../components/CreditsDisplay';
@@ -69,11 +70,6 @@ export function useChatStream({
   } = useDocTalkStore();
 
   const abortRef = useRef<AbortController | null>(null);
-  // Pending rollback value for an optimistic regenerate/continue quota bump
-  // (see bumpDemoUsageForRegenOrContinue below) — null when no bump is
-  // awaiting resolution. Set right before the bump, consumed (cleared) by
-  // whichever of handleStreamDone/handleStreamError fires next.
-  const preBumpDemoUsedRef = useRef<number | null>(null);
 
   // Contract: totalUsed = demoMessagesUsed (server-known count as of the last
   // restore/create) + messages sent locally since then. demoRestoredUserMsgCount
@@ -111,33 +107,62 @@ export function useChatStream({
     [],
   );
 
+  // Shared by handleStreamError and the regenerate/continue catch blocks
+  // below — both need to recognize a user-initiated abort the same way.
     1	"use client";
     2	
     3	import { useCallback, useMemo, useRef } from 'react';
     4	import { chatStream, continueStream } from './sse';
     5	import { getMessages } from './api';
     6	import { useDocTalkStore } from '../store';
     7	import type { Message } from '../types';
     8	import { triggerCreditsRefresh } from '../components/CreditsDisplay';
     9	import { errorCopy } from './errorCopy';
    10	import { trackEvent } from './analytics';
    11	import { messageShareAnchorFromId } from './shareAnchors';
    12	import { deriveUpgradePlan } from './billingLinks';
    13	
    14	interface UseChatStreamOptions {
    15	  sessionId: string;
    16	  selectedMode: string;
    17	  locale: string;
    18	  t: (key: string, params?: Record<string, string | number>) => string;
    19	  tOr: (key: string, fallback: string, params?: Record<string, string | number>) => string;
    20	  maxUserMessages?: number;
    21	  /**
    22	   * Current user's billing tier ('free' | 'plus' | 'pro' | undefined for
    23	   * anonymous/demo). Used by the paywall analytics events so the funnel data
    24	   * reflects the actual upgrade *target* — e.g. a Plus user hitting the Pro
    25	   * cap should fire `plan: 'pro'`, not the hardcoded `plan: 'plus'` that was
    26	   * poisoning every paywall_opened/limit_hit event in the funnel (I27).
    27	   */
    28	  currentPlan?: string;
    29	  onShowPaywall: (reason?: string) => void;
    30	  onRequireAuth: () => void;
    31	}
    32	
    33	interface UseChatStreamResult {
    34	  sendMessage: (text: string) => Promise<boolean>;
    35	  regenerateLastResponse: () => Promise<void>;
    36	  continueGenerating: () => Promise<void>;
    37	  stopStreaming: () => void;
    38	  demoRemaining: number;
    39	  demoLimitReached: boolean;
    40	  messagesUsed: number;
    41	  maxMessages: number;
    42	}
    43	
    44	export function useChatStream({
    45	  sessionId,
    46	  selectedMode,
    47	  locale,
    48	  t,
    49	  tOr,
    50	  maxUserMessages,
    51	  currentPlan,
    52	  onShowPaywall,
    53	  onRequireAuth,
    54	}: UseChatStreamOptions): UseChatStreamResult {
    55	  const {
    56	    messages,
    57	    isStreaming,
    58	    demoMessagesUsed,
    59	    demoRestoredUserMsgCount,
    60	    addMessage,
    61	    updateLastMessage,
    62	    addCitationToLastMessage,
    63	    addArtifactToLastMessage,
    64	    setLastMessageToolStatus,
    65	    setStreaming,
    66	    updateSessionActivity,
    67	    flushPendingText,
    68	    markLastMessageTruncated,
    69	    updateLastMessageMeta,
    70	  } = useDocTalkStore();
    71	
    72	  const abortRef = useRef<AbortController | null>(null);
    73	
    74	  // Contract: totalUsed = demoMessagesUsed (server-known count as of the last
    75	  // restore/create) + messages sent locally since then. demoRestoredUserMsgCount
    76	  // is the baseline set at that restore/create point — how many of the
    77	  // transcript's user messages were already reflected in demoMessagesUsed —
    78	  // so only messages appended AFTER it count as "new". This converges to
    79	  // server truth on every restore, including Redis TTL expiry / IP changes
    80	  // (server reports 0 even though the transcript has old messages), instead
    81	  // of a fixed subtraction that could outlive the server's own window and
    82	  // hard-lock a user the backend would actually allow.
    83	  const userMsgsInTranscript = maxUserMessages != null
    84	    ? messages.filter((m) => m.role === 'user').length
    85	    : 0;
    86	  const localUserMsgCount = maxUserMessages != null
    87	    ? Math.max(0, userMsgsInTranscript - demoRestoredUserMsgCount)
    88	    : 0;
    89	  const totalUsed = demoMessagesUsed + localUserMsgCount;
    90	  const demoRemaining = maxUserMessages != null ? maxUserMessages - totalUsed : Infinity;
    91	  const demoLimitReached = maxUserMessages != null && demoRemaining <= 0;
    92	  const messagesUsed = maxUserMessages != null ? Math.min(maxUserMessages, Math.max(0, totalUsed)) : 0;
    93	  const maxMessages = maxUserMessages ?? 0;
    94	
    95	  const getErrorMeta = useCallback(
    96	    (err: unknown): { message: string; code: string | null; status: number | null } => {
    97	      if (typeof err === 'object' && err) {
    98	        const anyErr = err as Record<string, unknown>;
    99	        return {
   100	          message: typeof anyErr.message === 'string' ? anyErr.message : '',
   101	          code: typeof anyErr.code === 'string' ? anyErr.code : null,
   102	          status: typeof anyErr.status === 'number' ? anyErr.status : null,
   103	        };
   104	      }
   105	      return { message: '', code: null, status: null };
   106	    },
   107	    [],
   108	  );
   109	
   110	  // Shared by handleStreamError and the regenerate/continue catch blocks
   111	  // below — both need to recognize a user-initiated abort the same way.
   112	  const isAbortLikeError = useCallback((err: unknown): boolean => {
   113	    const name = typeof err === 'object' && err && 'name' in err
   114	      ? String((err as { name?: unknown }).name || '')
   115	      : '';
   116	    const message = typeof err === 'object' && err && 'message' in err
   117	      ? String((err as { message?: unknown }).message || '')
   118	      : '';
   119	    return name === 'AbortError' || message.includes('AbortError');
   120	  }, []);
   121	
   122	  // Fire-and-forget re-sync to server truth after a regenerate/continue
   123	  // failure — replaces the r2 ref-based rollback (Codex r3: a rollback token
   124	  // could go stale across an aborted call and then incorrectly undo a later,
   125	  // unrelated send's usage). GETs the current session's messages and, if the
   126	  // response carries demo_messages_used (anon demo only), re-anchors BOTH
   127	  // fields to "right now": the raw server count, and a baseline equal to the
   128	  // LIVE transcript's current user-message count (not the fetched
   129	  // transcript's) — so useChatStream's formula converges immediately without
   130	  // needing a full page reload, regardless of whether the failed request
   131	  // actually consumed server quota or not. Errors are swallowed: this is a
   132	  // best-effort correction, not something that should surface to the user.
   133	  const reanchorDemoCounter = useCallback((forSessionId: string) => {
   134	    if (maxUserMessages == null) return;
   135	    getMessages(forSessionId)
   136	      .then((msgsData) => {
   137	        if (msgsData.demo_messages_used == null) return;
   138	        const state = useDocTalkStore.getState();
   139	        // The GET can resolve after the user has already navigated away —
   140	        // e.g. useChatSession's effect ran its synchronous reset for a NEW
   141	        // document/session while this was in flight. Re-read the CURRENT
   142	        // sessionId from the store (not a closure) and only write if it
   143	        // still matches the session this reanchor was called for; otherwise
   144	        // the fetched-for-A truth would clobber whatever B's own
   145	        // adopt/create already established. Drop it silently — B's own
   146	        // adoption path is the authoritative source for B's counter.
   147	        if (state.sessionId !== forSessionId) return;
   148	        state.setDemoMessagesUsed(msgsData.demo_messages_used);
   149	        state.setDemoRestoredUserMsgCount(
   150	          state.messages.filter((m) => m.role === 'user').length,
   151	        );
   152	      })
   153	      .catch(() => {
   154	        // best-effort — a later restore/regenerate/continue will try again
   155	      });
   156	  }, [maxUserMessages]);
   157	
   158	  const handleStreamError = useCallback((err: unknown) => {
   159	    flushPendingText();
   160	    setStreaming(false);
   161	    abortRef.current = null;
   162	
   163	    const { message, code, status } = getErrorMeta(err);
   164	
   165	    if (isAbortLikeError(err)) {
   166	      return;
   167	    }
   168	
   169	    if (
   170	      status === 402
   171	      || code === 'INSUFFICIENT_CREDITS'
   172	      || code === 'MODE_NOT_ALLOWED'
   173	      || code === 'PRO_MODE_LIMIT_REACHED'
   174	      || code === 'BALANCED_MODE_LIMIT_REACHED'
   175	    ) {
   176	      const reason = code || 'paid_limit';
   177	      // I27: previously hardcoded `plan: 'plus'`, which falsely attributed
   178	      // every paywall event in the funnel to plus-upgrade intent regardless
   179	      // of what triggered it (e.g. a Plus user hitting the Pro cap was logged
   180	      // as a Plus-upgrade event). Derive the actual upgrade target from
   181	      // (currentPlan, reason) so the upgrade-funnel analytics aren't poisoned.
   182	      const upgradePlan = deriveUpgradePlan(currentPlan, reason);
   183	      trackEvent('limit_hit', { source: 'chat_stream', reason, plan: upgradePlan, period: 'monthly' });
   184	      trackEvent('paywall_opened', { source: 'chat_stream', reason, plan: upgradePlan, period: 'monthly' });
   185	      onShowPaywall(reason);
   186	      return;
   187	    }
   188	
   189	    if (status === 409 || code === 'DOCUMENT_PROCESSING') {
   190	      addMessage({
   191	        id: `m_${Date.now()}_proc`,
   192	        role: 'assistant',
   193	        text: t('doc.processing'),
   194	        createdAt: Date.now(),
   195	      });
   196	      return;
   197	    }
   198	
   199	    if (
   200	      status === 429
   201	      || code === 'RATE_LIMITED'
   202	      || code === 'DEMO_SESSION_RATE_LIMITED'
   203	      || code === 'DEMO_MESSAGE_LIMIT_REACHED'
   204	      || code === 'DEMO_SESSION_LIMIT_REACHED'
   205	    ) {
   206	      trackEvent('limit_hit', { source: 'chat_stream', reason: code || 'rate_or_demo_limit' });
   207	      const isRateLimited = code === 'RATE_LIMITED'
   208	        || code === 'DEMO_SESSION_RATE_LIMITED'
   209	        || message.includes('Rate limit exceeded');
   210	      addMessage({
   211	        id: `m_${Date.now()}_limit`,
   212	        role: 'assistant',
   213	        text: isRateLimited ? t('demo.rateLimitMessage') : t('demo.limitReachedMessage'),
   214	        createdAt: Date.now(),
   215	      });
   216	      return;
   217	    }
   218	
   219	    const copy = errorCopy(err, t, tOr);
   220	    const state = useDocTalkStore.getState();
   221	    const currentMessages = state.messages;
   222	    const lastMessage = currentMessages[currentMessages.length - 1];
   223	    const lastAssistantIsEmpty = lastMessage?.role === 'assistant'
   224	      && !lastMessage.text
   225	      && !lastMessage.toolStatus
   226	      && (!lastMessage.citations || lastMessage.citations.length === 0)
   227	      && (!lastMessage.artifacts || lastMessage.artifacts.length === 0);
   228	
   229	    if (lastAssistantIsEmpty) {
   230	      state.setMessages([
   231	        ...currentMessages.slice(0, -1),
   232	        {
   233	          ...lastMessage,
   234	          text: copy.body,
   235	          isError: true,
   236	          isTruncated: false,
   237	        },
   238	      ]);
   239	      return;
   240	    }
   241	
   242	    addMessage({
   243	      id: `m_${Date.now()}_e`,
   244	      role: 'assistant',
   245	      text: copy.body,
   246	      isError: true,
   247	      createdAt: Date.now(),
   248	    });
   249	  }, [addMessage, flushPendingText, getErrorMeta, isAbortLikeError, onShowPaywall, setStreaming, t, tOr, currentPlan]);
   250	
   251	  const handleTruncated = useCallback(() => {
   252	    flushPendingText();
   253	    markLastMessageTruncated(true);
   254	  }, [flushPendingText, markLastMessageTruncated]);
   255	
   256	  const handleStreamDone = useCallback((d: { message_id: string; can_continue?: boolean; continuation_count?: number }) => {
   257	    flushPendingText();
   258	    setStreaming(false);
   259	    abortRef.current = null;
   260	    updateSessionActivity(sessionId);
   261	    triggerCreditsRefresh();
   262	    trackEvent('chat_message_completed', { source: 'chat_stream', mode: selectedMode });
   263	    if (d.message_id) {
   264	      updateLastMessageMeta({
   265	        backendId: d.message_id,
   266	        shareAnchor: messageShareAnchorFromId(d.message_id),
   267	        ...(d.continuation_count !== undefined ? { continuationCount: d.continuation_count } : {}),
   268	      });
   269	    }
   270	  }, [flushPendingText, setStreaming, updateSessionActivity, sessionId, selectedMode, updateLastMessageMeta]);
   271	
   272	  const handleAnswerRepaired = useCallback((payload: { text: string; citations: Message['citations'] }) => {
   273	    flushPendingText();
   274	    updateLastMessageMeta({
   275	      text: payload.text,
   276	      citations: payload.citations || [],
   277	      isTruncated: false,
   278	      toolStatus: undefined,
   279	    });
   280	  }, [flushPendingText, updateLastMessageMeta]);
   281	
   282	  // Text-preserving citation update: sentence-level focus added after the
   283	  // answer (cross-lingual / paraphrase). Only the citations change.
   284	  const handleCitationsRefined = useCallback((citations: Message['citations']) => {
   285	    flushPendingText();
   286	    updateLastMessageMeta({ citations: citations || [] });
   287	  }, [flushPendingText, updateLastMessageMeta]);
   288	
   289	  // `onErrorOverride` lets a caller observe an error before it reaches the
   290	  // shared `handleStreamError` (used by regenerateLastResponse to trigger a
   291	  // demo-counter re-anchor without changing sendMessage's behavior at all).
   292	  const streamAssistantResponse = useCallback(async (prompt: string, onErrorOverride?: (err: unknown) => void) => {
   293	    const controller = new AbortController();
   294	    abortRef.current = controller;
   295	
   296	    const domainMode = useDocTalkStore.getState().domainMode;
   297	    await chatStream(
   298	      sessionId,
   299	      prompt,
   300	      ({ text }) => updateLastMessage(text || ''),
   301	      (citation) => addCitationToLastMessage(citation),
   302	      onErrorOverride ?? handleStreamError,
   303	      handleStreamDone,
   304	      handleTruncated,
   305	      selectedMode,
   306	      locale,
   307	      controller.signal,
   308	      domainMode,
   309	      (artifact) => addArtifactToLastMessage(artifact),
   310	      ({ message }) => setLastMessageToolStatus(message),
   311	      handleAnswerRepaired,
   312	      handleCitationsRefined,
   313	    );
   314	  }, [sessionId, updateLastMessage, addCitationToLastMessage, addArtifactToLastMessage, setLastMessageToolStatus, handleStreamError, handleStreamDone, handleTruncated, handleAnswerRepaired, handleCitationsRefined, selectedMode, locale]);
   315	
   316	  const sendMessage = useCallback(async (text: string) => {
   317	    if (!text.trim() || isStreaming) return false;
   318	
   319	    if (demoLimitReached) {
   320	      onRequireAuth();
   321	      return false;
   322	    }
   323	
   324	    const userMsg: Message = {
   325	      id: `m_${Date.now()}_u`,
   326	      role: 'user',
   327	      text,
   328	      createdAt: Date.now(),
   329	    };
   330	
   331	    const asstMsg: Message = {
   332	      id: `m_${Date.now()}_a`,
   333	      role: 'assistant',
   334	      text: '',
   335	      citations: [],
   336	      createdAt: Date.now(),
   337	    };
   338	
   339	    addMessage(userMsg);
   340	    addMessage(asstMsg);
   341	    setStreaming(true);
   342	    trackEvent('chat_message_sent', { source: 'chat_panel', mode: selectedMode });
   343	
   344	    await streamAssistantResponse(text);
   345	    return true;
   346	  }, [isStreaming, demoLimitReached, onRequireAuth, addMessage, setStreaming, streamAssistantResponse, selectedMode]);
   347	
   348	  // Regenerate/continue add no new user message locally (they resend/extend
   349	  // an existing turn), but the backend increments demo quota on both — so
   350	  // without this the UI would undercount relative to the server. Bumps
   351	  // demoMessagesUsed directly (not the baseline, which only moves at
   352	  // restore/create) and optimistically, before the stream starts — correct
   353	  // whenever the server actually charges, which is the dominant case,
   354	  // including an abort (streaming can only be aborted once the backend has
   355	  // already started responding, so it plausibly already charged). No
   356	  // rollback here on failure — see reanchorDemoCounter above: instead of
   357	  // guessing whether a given failure means the server charged or not (r3:
   358	  // that guess is unsafe — e.g. the continuation endpoint charges quota
   359	  // BEFORE validating the message is still continuable, so a 404/400 there
   360	  // is still a real charge), a failed regenerate/continue re-syncs to
   361	  // server truth directly. No-op outside demo (maxUserMessages == null), so
   362	  // authenticated/non-demo sessions are untouched.
   363	  const bumpDemoUsageForRegenOrContinue = useCallback(() => {
   364	    if (maxUserMessages == null) return;
   365	    const state = useDocTalkStore.getState();
   366	    state.setDemoMessagesUsed(state.demoMessagesUsed + 1);
   367	  }, [maxUserMessages]);
   368	
   369	  const regenerateLastResponse = useCallback(async () => {
   370	    if (isStreaming) return;
   371	
   372	    const msgs = useDocTalkStore.getState().messages;
   373	    let lastUserIdx = -1;
   374	
   375	    for (let i = msgs.length - 1; i >= 0; i--) {
   376	      if (msgs[i].role === 'user') {
   377	        lastUserIdx = i;
   378	        break;
   379	      }
   380	    }
   381	
   382	    if (lastUserIdx === -1) return;
   383	
   384	    const lastUserText = msgs[lastUserIdx].text;
   385	    const trimmed = msgs.slice(0, lastUserIdx + 1);
   386	
   387	    useDocTalkStore.getState().setMessages(trimmed);
   388	    addMessage({ id: `m_${Date.now()}_a`, role: 'assistant', text: '', citations: [], createdAt: Date.now() });
   389	    bumpDemoUsageForRegenOrContinue();
   390	    setStreaming(true);
   391	
   392	    try {
   393	      // Covers errors reported via the SSE error event/mid-stream failures
   394	      // (which resolve normally, so a try/catch alone wouldn't see them) —
   395	      // re-anchor before delegating to the shared error handler.
   396	      await streamAssistantResponse(lastUserText, (err) => {
   397	        reanchorDemoCounter(sessionId);
   398	        handleStreamError(err);
   399	      });
   400	    } catch (e) {
   401	      // Covers a thrown fetch() rejection (network failure before/instead
   402	      // of any SSE response) — the one case the onError override above
   403	      // can't see, since it never fires. Re-throws unchanged (nothing here
   404	      // catches it today either) — this only adds the re-anchor.
   405	      if (!isAbortLikeError(e)) reanchorDemoCounter(sessionId);
   406	      throw e;
   407	    }
   408	  }, [isStreaming, addMessage, setStreaming, streamAssistantResponse, bumpDemoUsageForRegenOrContinue, reanchorDemoCounter, sessionId, handleStreamError, isAbortLikeError]);
   409	
   410	  const continueGenerating = useCallback(async () => {
   411	    if (isStreaming) return;
   412	
   413	    const msgs = useDocTalkStore.getState().messages;
   414	    const lastMsg = msgs[msgs.length - 1];
   415	    if (!lastMsg || lastMsg.role !== 'assistant' || !lastMsg.isTruncated) return;
   416	
   417	    // Clear truncated flag and start streaming
   418	    markLastMessageTruncated(false);
   419	    bumpDemoUsageForRegenOrContinue();
   420	    setStreaming(true);
   421	
   422	    const controller = new AbortController();
   423	    abortRef.current = controller;
   424	
   425	    try {
   426	      await continueStream(
   427	        sessionId,
   428	        lastMsg.backendId || '',
   429	        ({ text }) => updateLastMessage(text || ''),
   430	        (citation) => addCitationToLastMessage(citation),
   431	        // Re-anchor before delegating — covers SSE error-event/mid-stream
   432	        // failures, which resolve normally (see the try/catch below for the
   433	        // thrown-fetch-rejection case a callback can't see).
   434	        (err) => {
   435	          reanchorDemoCounter(sessionId);
   436	          handleStreamError(err);
   437	        },
   438	        handleStreamDone,
   439	        handleTruncated,
   440	        selectedMode,
   441	        locale,
   442	        controller.signal,
   443	        (artifact) => addArtifactToLastMessage(artifact),
   444	        ({ message }) => setLastMessageToolStatus(message),
   445	        handleAnswerRepaired,
   446	        handleCitationsRefined,
   447	      );
   448	    } catch (e) {
   449	      // Thrown fetch() rejection — re-throws unchanged (nothing here catches
   450	      // it today either), this only adds the re-anchor.
   451	      if (!isAbortLikeError(e)) reanchorDemoCounter(sessionId);
   452	      throw e;
   453	    }
   454	  }, [isStreaming, sessionId, markLastMessageTruncated, setStreaming, updateLastMessage, addCitationToLastMessage, addArtifactToLastMessage, setLastMessageToolStatus, handleStreamError, handleStreamDone, handleTruncated, handleAnswerRepaired, handleCitationsRefined, selectedMode, locale, bumpDemoUsageForRegenOrContinue, reanchorDemoCounter, isAbortLikeError]);
   455	
   456	  const stopStreaming = useCallback(() => {
   457	    abortRef.current?.abort();
   458	    abortRef.current = null;
   459	    flushPendingText();
   460	    setStreaming(false);
   461	  }, [flushPendingText, setStreaming]);
   462	
   463	  return useMemo(() => ({
   464	    sendMessage,
   465	    regenerateLastResponse,
   466	    continueGenerating,
   467	    stopStreaming,
   468	    demoRemaining,
   469	    demoLimitReached,
   470	    messagesUsed,
   471	    maxMessages,
   472	  }), [sendMessage, regenerateLastResponse, continueGenerating, stopStreaming, demoRemaining, demoLimitReached, messagesUsed, maxMessages]);
   473	}
     1	import type { ChatArtifact, Citation } from '../types';
     2	import { mapArtifactPayload, mapCitationPayload, PROXY_BASE } from './api';
     3	
     4	type TokenPayload = { text: string };
     5	type CitationPayload = {
     6	  ref_index: number;
     7	  chunk_id: string;
     8	  page: number;
     9	  page_end?: number;
    10	  bboxes: { x: number; y: number; w: number; h: number; page?: number }[];
    11	  text_snippet: string;
    12	  focus_snippet?: string;
    13	  offset: number;
    14	};
    15	type CitationEventPayload = CitationPayload & {
    16	  document_id?: string;
    17	  document_filename?: string;
    18	  confidence_score?: number;
    19	  context_text?: string;
    20	  retrieval_modality?: string;
    21	};
    22	type ErrorPayload = { code: string; message: string; status?: number };
    23	type DonePayload = { message_id: string; can_continue?: boolean; continuation_count?: number };
    24	type ToolStatusPayload = { message: string };
    25	type AnswerRepairedPayload = { text: string; citations: Citation[]; verification?: unknown };
    26	
    27	async function _processSSEStream(
    28	  reader: ReadableStreamDefaultReader<Uint8Array>,
    29	  onToken: (p: TokenPayload) => void,
    30	  onCitation: (c: Citation) => void,
    31	  onError: (e: ErrorPayload) => void,
    32	  onDone: (d: DonePayload) => void,
    33	  onTruncated?: () => void,
    34	  onArtifact?: (artifact: ChatArtifact) => void,
    35	  onToolStatus?: (status: ToolStatusPayload) => void,
    36	  onAnswerRepaired?: (payload: AnswerRepairedPayload) => void,
    37	  onCitationsRefined?: (citations: Citation[]) => void,
    38	  signal?: AbortSignal,
    39	) {
    40	  const decoder = new TextDecoder('utf-8');
    41	  let buffer = '';
    42	  let receivedDone = false;
    43	  let receivedTerminalError = false;
    44	
    45	  try {
    46	    while (true) {
    47	      const { done, value } = await reader.read();
    48	      if (done) break;
    49	      buffer += decoder.decode(value, { stream: true });
    50	
    51	      let boundary: number;
    52	      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
    53	        const rawEvent = buffer.slice(0, boundary);
    54	        buffer = buffer.slice(boundary + 2);
    55	
    56	        const lines = rawEvent.split('\n');
    57	        let eventName = 'message';
    58	        let dataStr = '';
    59	        for (const line of lines) {
    60	          if (line.startsWith('event:')) {
    61	            eventName = line.replace('event:', '').trim();
    62	          } else if (line.startsWith('data:')) {
    63	            dataStr += line.replace('data:', '').trim();
    64	          }
    65	        }
    66	
    67	        if (!dataStr) continue;
    68	        try {
    69	          const data = JSON.parse(dataStr) as Record<string, unknown>;
    70	          switch (eventName) {
    71	            case 'token':
    72	              onToken({ text: typeof data.text === 'string' ? data.text : '' });
    73	              break;
    74	            case 'citation': {
    75	              const p = data as CitationEventPayload;
    76	              const c: Citation = {
    77	                refIndex: p.ref_index,
    78	                chunkId: p.chunk_id,
    79	                page: p.page,
    80	                pageEnd: typeof p.page_end === 'number' ? p.page_end : undefined,
    81	                bboxes: p.bboxes || [],
    82	                textSnippet: p.text_snippet || '',
    83	                focusSnippet: typeof p.focus_snippet === 'string' ? p.focus_snippet : undefined,
    84	                offset: p.offset ?? 0,
    85	                documentId: typeof p.document_id === 'string' ? p.document_id : undefined,
    86	                documentFilename: typeof p.document_filename === 'string' ? p.document_filename : undefined,
    87	                confidenceScore: typeof p.confidence_score === 'number' ? p.confidence_score : undefined,
    88	                contextText: typeof p.context_text === 'string' ? p.context_text : undefined,
    89	                retrievalModality: typeof p.retrieval_modality === 'string' ? p.retrieval_modality : undefined,
    90	              };
    91	              onCitation(c);
    92	              break; }
    93	            case 'error':
    94	              receivedTerminalError = true;
    95	              onError({
    96	                code: typeof data.code === 'string' ? data.code : 'unknown',
    97	                message: typeof data.message === 'string' ? data.message : 'Unknown error',
    98	              });
    99	              await reader.cancel().catch(() => {});
   100	              return;
   101	            case 'truncated':
   102	              onTruncated?.();
   103	              break;
   104	            case 'artifact':
   105	              onArtifact?.(mapArtifactPayload(data));
   106	              break;
   107	            case 'tool_status':
   108	              onToolStatus?.({ message: typeof data.message === 'string' ? data.message : '' });
   109	              break;
   110	            case 'answer_repaired':
   111	              onAnswerRepaired?.({
   112	                text: typeof data.text === 'string' ? data.text : '',
   113	                citations: Array.isArray(data.citations) ? data.citations.map(mapCitationPayload) : [],
   114	                verification: data.verification,
   115	              });
   116	              break;
   117	            case 'citations_refined':
   118	              // Text-preserving citation update (sentence-level focus added
   119	              // post-generation for cross-lingual / paraphrase answers).
   120	              onCitationsRefined?.(
   121	                Array.isArray(data.citations) ? data.citations.map(mapCitationPayload) : [],
   122	              );
   123	              break;
   124	            case 'done':
   125	              receivedDone = true;
   126	              onDone({
   127	                message_id: typeof data.message_id === 'string' ? data.message_id : '',
   128	                can_continue: data.can_continue === true,
   129	                continuation_count: typeof data.continuation_count === 'number' ? data.continuation_count : undefined,
   130	              });
   131	              break;
   132	            default:
   133	              // ignore pings and unknown events
   134	              break;
   135	          }
   136	        } catch (e) {
   137	          if (signal?.aborted) return;
   138	          receivedTerminalError = true;
   139	          onError({ code: 'parse_error', message: String(e) });
   140	          await reader.cancel().catch(() => {});
   141	          return;
   142	        }
   143	      }
   144	    }
   145	  } catch (e) {
   146	    if (signal?.aborted) return;
   147	    receivedTerminalError = true;
   148	    onError({ code: 'stream_error', message: String(e) });
   149	  }
   150	
   151	  if (!receivedDone && !receivedTerminalError && !signal?.aborted) {
   152	    onTruncated?.();
   153	    onDone({ message_id: '' });
   154	  }
   155	}
   156	
   157	export async function chatStream(
   158	  sessionId: string,
   159	  message: string,
   160	  onToken: (p: TokenPayload) => void,
   161	  onCitation: (c: Citation) => void,
   162	  onError: (e: ErrorPayload) => void,
   163	  onDone: (d: DonePayload) => void,
   164	  onTruncated?: () => void,
   165	  mode?: string,
   166	  locale?: string,
   167	  signal?: AbortSignal,
   168	  domainMode?: string | null,
   169	  onArtifact?: (artifact: ChatArtifact) => void,
   170	  onToolStatus?: (status: ToolStatusPayload) => void,
   171	  onAnswerRepaired?: (payload: AnswerRepairedPayload) => void,
   172	  onCitationsRefined?: (citations: Citation[]) => void,
   173	) {
   174	  const res = await fetch(`${PROXY_BASE}/api/sessions/${sessionId}/chat`, {
   175	    method: 'POST',
   176	    headers: { 'Content-Type': 'application/json' },
   177	    body: JSON.stringify({
   178	      message,
   179	      ...(mode ? { mode } : {}),
   180	      ...(locale ? { locale } : {}),
   181	      domain_mode: domainMode ?? null,
   182	    }),
   183	    signal,
   184	  });
   185	
   186	  if (!res.ok || !res.body) {
   187	    if (signal?.aborted) return;
   188	    const raw = await res.text().catch(() => '');
   189	    let code = 'http_error';
   190	    let message = `HTTP ${res.status}: ${raw}`;
   191	    try {
   192	      const parsed = JSON.parse(raw);
   193	      const d = parsed && typeof parsed === 'object' && 'detail' in parsed
   194	        ? (parsed as Record<string, unknown>).detail
   195	        : parsed;
   196	      if (d && typeof d === 'object') {
   197	        const detail = d as Record<string, unknown>;
   198	        if (typeof detail.error === 'string') code = detail.error;
   199	        if (typeof detail.message === 'string') message = detail.message;
   200	      }
   201	    } catch {
   202	      // leave http_error + raw message as fallback
   203	    }
   204	    onError({ code, message, status: res.status });
   205	    return;
   206	  }
   207	
   208	  const reader = res.body.getReader();
   209	  await _processSSEStream(reader, onToken, onCitation, onError, onDone, onTruncated, onArtifact, onToolStatus, onAnswerRepaired, onCitationsRefined, signal);
   210	}
   211	
   212	export async function continueStream(
   213	  sessionId: string,
   214	  messageId: string,
   215	  onToken: (p: TokenPayload) => void,
   216	  onCitation: (c: Citation) => void,
   217	  onError: (e: ErrorPayload) => void,
   218	  onDone: (d: DonePayload) => void,
   219	  onTruncated?: () => void,
   220	  mode?: string,
   221	  locale?: string,
   222	  signal?: AbortSignal,
   223	  onArtifact?: (artifact: ChatArtifact) => void,
   224	  onToolStatus?: (status: ToolStatusPayload) => void,
   225	  onAnswerRepaired?: (payload: AnswerRepairedPayload) => void,
   226	  onCitationsRefined?: (citations: Citation[]) => void,
   227	) {
   228	  const res = await fetch(`${PROXY_BASE}/api/sessions/${sessionId}/chat/continue`, {
   229	    method: 'POST',
   230	    headers: { 'Content-Type': 'application/json' },
   231	    body: JSON.stringify({
   232	      message_id: messageId || undefined,
   233	      ...(mode ? { mode } : {}),
   234	      ...(locale ? { locale } : {}),
   235	    }),
   236	    signal,
   237	  });
   238	
   239	  if (!res.ok || !res.body) {
   240	    if (signal?.aborted) return;
   241	    const raw = await res.text().catch(() => '');
   242	    let code = 'http_error';
   243	    let message = `HTTP ${res.status}: ${raw}`;
   244	    try {
   245	      const parsed = JSON.parse(raw);
   246	      const d = parsed && typeof parsed === 'object' && 'detail' in parsed
   247	        ? (parsed as Record<string, unknown>).detail
   248	        : parsed;
   249	      if (d && typeof d === 'object') {
   250	        const detail = d as Record<string, unknown>;
   251	        if (typeof detail.error === 'string') code = detail.error;
   252	        if (typeof detail.message === 'string') message = detail.message;
   253	      }
   254	    } catch {
   255	      // leave http_error + raw message as fallback
   256	    }
   257	    onError({ code, message, status: res.status });
   258	    return;
   259	  }
   260	
   261	  const reader = res.body.getReader();
   262	  await _processSSEStream(reader, onToken, onCitation, onError, onDone, onTruncated, onArtifact, onToolStatus, onAnswerRepaired, onCitationsRefined, signal);
   263	}
     1	import type { DocumentResponse, Message, SearchResponse, Citation, SessionListResponse, CollectionBrief, CollectionDetail, NormalizedBBox, ExtractionJob, ExtractionTemplate, DocumentTable, QuestionTemplate, DocumentHierarchicalBrief, ChatArtifact } from '../types';
     2	import type { UserProfile, CreditHistoryResponse, UsageBreakdown } from '../types';
     3	
     4	export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';
     5	export const PROXY_BASE = '/api/proxy';
     6	
     7	/**
     8	 * Structured error thrown by `handle()` for any non-2xx response.
     9	 *
    10	 * Wire contract (docs/ARCHITECTURE.md §10, coming in Phase 6):
    11	 * - `status`: HTTP status code (e.g. 403).
    12	 * - `code`: the canonical `detail.error` string from the backend, or null
    13	 *   if the body wasn't a JSON object with a string `error` field.
    14	 * - `detail`: the parsed `detail` object (or parsed body itself if the
    15	 *   backend didn't wrap it), or `{}` when parsing failed.
    16	 * - `raw`: the raw response body, verbatim.
    17	 *
    18	 * `message` MUST stay in the exact `HTTP <status>: <raw>` shape because
    19	 * legacy substring consumers still depend on it during the deprecation
    20	 * window (BillingPageClient regex at BillingPageClient.tsx:157-168,
    21	 * useChatStream HTTP/phrase matches at useChatStream.ts:95-114). Do not
    22	 * "simplify" the message format until Phase 5 ships.
    23	 */
    24	export class ApiError extends Error {
    25	  constructor(
    26	    public readonly status: number,
    27	    public readonly code: string | null,
    28	    public readonly detail: Record<string, unknown>,
    29	    public readonly raw: string,
    30	  ) {
    31	    super(`HTTP ${status}: ${raw}`);
    32	    this.name = 'ApiError';
    33	  }
    34	}
    35	
    36	/**
    37	 * Read the response body and throw a structured `ApiError`. Shared by
    38	 * `handle()`, `exportSession()`, and other helpers that don't fit the
    39	 * `res.json()` shape. Always throws — return type is `never`.
    40	 */
    41	async function throwApiError(res: Response): Promise<never> {
    42	  const raw = await res.text();
    43	  let code: string | null = null;
    44	  let detail: Record<string, unknown> = {};
    45	  try {
    46	    const parsed = JSON.parse(raw);
    47	    // FastAPI HTTPException bodies are `{ detail: {...} }` or `{ detail: "..." }`.
    48	    // Earlier taxonomy rows used the whole body as the detail object.
    49	    const d = (parsed && typeof parsed === 'object' && 'detail' in parsed)
    50	      ? (parsed as Record<string, unknown>).detail
    51	      : parsed;
    52	    if (d && typeof d === 'object') {
    53	      detail = d as Record<string, unknown>;
    54	      const errField = (d as Record<string, unknown>).error;
    55	      if (typeof errField === 'string') code = errField;
    56	    }
    57	  } catch {
    58	    // non-JSON body (proxy HTML 502, network error upstream) → code stays null
    59	  }
    60	  throw new ApiError(res.status, code, detail, raw);
    61	}
    62	
    63	async function handle<T>(res: Response): Promise<T> {
    64	  if (!res.ok) {
    65	    await throwApiError(res);
    66	  }
    67	  return res.json();
    68	}
    69	
    70	export function mapCitationPayload(c: any): Citation {
    71	  return {
    72	    refIndex: c.ref_index ?? c.refIndex,
    73	    chunkId: c.chunk_id ?? c.chunkId,
    74	    page: c.page,
    75	    pageEnd: typeof c.page_end === 'number' ? c.page_end : (typeof c.pageEnd === 'number' ? c.pageEnd : undefined),
    76	    bboxes: c.bboxes || [],
    77	    textSnippet: c.text_snippet ?? c.textSnippet ?? '',
    78	    focusSnippet: typeof c.focus_snippet === 'string' ? c.focus_snippet : (typeof c.focusSnippet === 'string' ? c.focusSnippet : undefined),
    79	    offset: c.offset ?? 0,
    80	    documentId: typeof c.document_id === 'string' ? c.document_id : (typeof c.documentId === 'string' ? c.documentId : undefined),
    81	    documentFilename: typeof c.document_filename === 'string' ? c.document_filename : (typeof c.documentFilename === 'string' ? c.documentFilename : undefined),
    82	    confidenceScore: typeof c.confidence_score === 'number' ? c.confidence_score : (typeof c.confidenceScore === 'number' ? c.confidenceScore : undefined),
    83	    contextText: typeof c.context_text === 'string' ? c.context_text : (typeof c.contextText === 'string' ? c.contextText : undefined),
    84	    retrievalModality: typeof c.retrieval_modality === 'string' ? c.retrieval_modality : (typeof c.retrievalModality === 'string' ? c.retrievalModality : undefined),
    85	  };
    86	}
    87	
    88	export function mapArtifactPayload(raw: any): ChatArtifact {
    89	  const citations = Array.isArray(raw?.citations) ? raw.citations.map(mapCitationPayload) : [];
    90	  return {
    91	    artifactType: raw?.artifact_type ?? raw?.artifactType ?? 'artifact',
    92	    status: raw?.status ?? 'queued',
    93	    jobId: raw?.job_id ?? raw?.jobId ?? null,
    94	    title: raw?.title ?? 'Artifact',
    95	    summary: raw?.summary ?? '',
    96	    preview: raw?.preview,
    97	    downloadUrls: Array.isArray(raw?.download_urls) ? raw.download_urls : (Array.isArray(raw?.downloadUrls) ? raw.downloadUrls : []),
    98	    citations,
    99	    warning: raw?.warning ?? null,
   100	    requiredPlan: raw?.required_plan ?? raw?.requiredPlan ?? null,
   101	  };
   102	}
   103	
   104	export interface DocumentBrief {
   105	  id: string;
   106	  filename: string;
   107	  status: string;
   108	  created_at: string | null;
   109	}
   110	
   111	export async function getMyDocuments(signal?: AbortSignal): Promise<DocumentBrief[]> {
   112	  const res = await fetch(`${PROXY_BASE}/api/documents`, { signal });
   113	  if (!res.ok) {
   114	    if (res.status === 401) return [];
   115	    throw new Error(`Failed to fetch documents: ${res.status}`);
   116	  }
   117	  return res.json();
   118	}
   119	
   120	export async function uploadDocument(file: File): Promise<{ document_id: string; status: string; filename?: string }>
   121	{
   122	  // Uploads bypass the Vercel proxy to avoid the 4.5MB serverless body limit.
   123	  // 1. Obtain a short-lived backend JWT via the lightweight /api/upload-token endpoint
   124	  // 2. POST the file directly to the Railway backend with that JWT
   125	  const tokenRes = await fetch('/api/upload-token');
   126	  if (!tokenRes.ok) await throwApiError(tokenRes);
   127	  const { token } = await tokenRes.json();
   128	
   129	  const form = new FormData();
   130	  form.append('file', file);
   131	  const res = await fetch(`${API_BASE}/api/documents/upload`, {
   132	    method: 'POST',
   133	    headers: { 'Authorization': `Bearer ${token}` },
   134	    body: form,
   135	  });
   136	  return handle(res);
   137	}
   138	
   139	export async function getDocument(docId: string): Promise<DocumentResponse> {
   140	  const res = await fetch(`${PROXY_BASE}/api/documents/${docId}`);
   141	  return handle(res);
   142	}
   143	
   144	export async function getDocumentBrief(docId: string): Promise<DocumentHierarchicalBrief> {
   145	  const res = await fetch(`${PROXY_BASE}/api/documents/${docId}/brief`);
   146	  return handle(res);
   147	}
   148	
   149	export async function getDocumentFileUrl(docId: string): Promise<{ url: string; expires_in: number }> {
   150	  const res = await fetch(`${PROXY_BASE}/api/documents/${docId}/file-url`);
   151	  return handle(res);
   152	}
   153	
   154	export async function getConvertedFileUrl(docId: string): Promise<{ url: string; expires_in: number }> {
   155	  const res = await fetch(`${PROXY_BASE}/api/documents/${docId}/file-url?variant=converted`);
   156	  return handle(res);
   157	}
   158	
   159	export async function createSession(docId: string): Promise<{ session_id: string; document_id: string; title: string | null; created_at: string; demo_messages_used?: number }>
   160	{
   161	  const res = await fetch(`${PROXY_BASE}/api/documents/${docId}/sessions`, {
   162	    method: 'POST',
   163	  });
   164	  return handle(res);
   165	}
   166	
   167	export async function getMessages(sessionId: string): Promise<{ messages: Message[]; demo_messages_used?: number | null }> {
   168	  const res = await fetch(`${PROXY_BASE}/api/sessions/${sessionId}/messages`);
   169	  const data: { messages: Array<{ id?: string; share_anchor?: string; role: Message['role']; content: string; citations?: any[]; metadata_json?: any; created_at: string }>; demo_messages_used?: number | null } = await handle(res);
   170	
   171	  const mapped = (data.messages || []).map((m, idx) => {
   172	    const citations: Citation[] | undefined = m.citations
   173	      ? m.citations.map(mapCitationPayload)
   174	      : undefined;
   175	    const artifacts = Array.isArray(m.metadata_json?.artifacts)
   176	      ? m.metadata_json.artifacts.map(mapArtifactPayload)
   177	      : undefined;
   178	
   179	    return {
   180	      id: m.id ? `msg_${m.id}` : `msg_${idx}`,
   181	      role: m.role,
   182	      text: m.content,
   183	      citations,
   184	      artifacts,
   185	      createdAt: Date.parse(m.created_at),
   186	      backendId: m.id,
   187	      shareAnchor: m.share_anchor,
   188	    } as Message;
   189	  });
   190	
   191	  return { messages: mapped, demo_messages_used: data.demo_messages_used };
   192	}
   193	
   194	export interface DocumentJobDetail {
   195	  id: string;
   196	  document_id: string | null;
   197	  collection_id: string | null;
   198	  job_type: string;
   199	  status: string;
   200	  artifact: ChatArtifact;
   201	}
   202	
   203	export async function getDocumentJob(jobId: string): Promise<DocumentJobDetail> {
   204	  const res = await fetch(`${PROXY_BASE}/api/document-jobs/${jobId}`);
   205	  const data: any = await handle(res);
   206	  return {
   207	    ...data,
   208	    artifact: mapArtifactPayload(data.artifact),
   209	  };
   210	}
   211	
   212	export async function createLayoutTranslation(params: {
   213	  documentId: string;
   214	  targetLanguage?: string;
   215	  locale?: string;
   216	  addToLibrary?: boolean;
   217	}): Promise<DocumentJobDetail> {
   218	  const res = await fetch(`${PROXY_BASE}/api/documents/${params.documentId}/layout-translation`, {
   219	    method: 'POST',
   220	    headers: { 'Content-Type': 'application/json' },
   221	    body: JSON.stringify({
   222	      target_language: params.targetLanguage || 'zh-CN',
   223	      locale: params.locale || null,
   224	      add_to_library: Boolean(params.addToLibrary),
   225	    }),
   226	  });
   227	  const data: any = await handle(res);
   228	  return {
   229	    ...data,
   230	    artifact: mapArtifactPayload(data.artifact),
   231	  };
   232	}
   233	
   234	export interface LayoutTranslationImportResponse {
   235	  document_id: string;
   236	  status: string;
   237	  filename: string;
   238	  existing: boolean;
   239	}
   240	
   241	export async function importLayoutTranslationDocument(jobId: string, locale?: string | null): Promise<LayoutTranslationImportResponse> {
   242	  const res = await fetch(`${PROXY_BASE}/api/layout-translations/${jobId}/import-document`, {
   243	    method: 'POST',
   244	    headers: { 'Content-Type': 'application/json' },
   245	    body: JSON.stringify({ locale: locale || null }),
   246	  });
   247	  return handle(res);
   248	}
   249	
   250	export async function searchDocument(docId: string, query: string, topK?: number): Promise<SearchResponse> {
   251	  const res = await fetch(`${PROXY_BASE}/api/documents/${docId}/search`, {
   252	    method: 'POST',
   253	    headers: { 'Content-Type': 'application/json' },
   254	    body: JSON.stringify({ query, top_k: topK }),
   255	  });
   256	  return handle(res);
   257	}
   258	
   259	export interface ChunkDetail {
   260	  chunk_id: string;
     1	"use client";
     2	
     3	import { useEffect, useState } from 'react';
     4	import { ApiError, createSession, getMessages, listSessions } from './api';
     5	import { useDocTalkStore } from '../store';
     6	import { clearDemoSession, readDemoSession, writeDemoSession } from './demoSessionStorage';
     7	
     8	interface UseChatSessionResult {
     9	  sessionError: unknown | null;
    10	}
    11	
    12	export function useChatSession(documentId: string | undefined): UseChatSessionResult {
    13	  const [sessionError, setSessionError] = useState<unknown | null>(null);
    14	
    15	  const documentStatus = useDocTalkStore((s) => s.documentStatus);
    16	  const {
    17	    setSessions,
    18	    setSessionId,
    19	    setMessages,
    20	    setDemoMessagesUsed,
    21	    setDemoRestoredUserMsgCount,
    22	    addSession,
    23	  } = useDocTalkStore();
    24	
    25	  useEffect(() => {
    26	    if (!documentId || documentStatus !== 'ready') return;
    27	
    28	    setSessionError(null);
    29	    // Reset the demo counter baseline synchronously here — NOT in
    30	    // clearDocumentTransientState (Codex r2 #2 finding: that function is
    31	    // ALSO invoked by useDocumentLoader's effect, whose deps include the
    32	    // locale-sensitive `t`/`tOr`, so a same-document language change would
    33	    // zero the counter while the transcript stayed, reintroducing the
    34	    // TTL-hard-lock bug). This effect's own deps (below) exclude locale —
    35	    // it only reruns on a real documentId transition — and always
    36	    // re-establishes server truth right after via adopt-or-create in the
    37	    // same run, so the momentary reset here is safe.
    38	    setDemoMessagesUsed(0);
    39	    setDemoRestoredUserMsgCount(0);
    40	    // Clear the PREVIOUS document's session/messages/sessions synchronously
    41	    // too (Codex r3 breakage 3), not just the counter. Without this, a
    42	    // transient adoption failure for document B left document A's still-
    43	    // truthy sessionId/messages sitting in the store; DocumentReaderPageClient
    44	    // renders `documentStatus === 'ready' && sessionId ? <ChatPanel/> :
    45	    // sessionErrorCopy ? <error/> : ...` — checking sessionId BEFORE the
    46	    // error — so it kept showing A's stale chat instead of B's retryable
    47	    // error. This also closes a pre-existing (unrelated) stale-chat flash on
    48	    // any in-app document transition, since A's session/messages previously
    49	    // lingered in the store until B's adopt/create resolved. The brief
    50	    // sessionId===null window this creates renders a benign "initializing
    51	    // chat" placeholder (DocumentReaderPageClient's final else branch), not
    52	    // a blank/broken state.
    53	    setSessionId(null);
    54	    setMessages([]);
    55	    setSessions([]);
    56	    let cancelled = false;
    57	
    58	    (async () => {
    59	      let sessionReady = false;
    60	
    61	      // Anonymous demo: re-adopt the session we created earlier this browser
    62	      // session instead of burning a create per page view (5-per-5min IP cap).
    63	      // Safe for authed users too: if a signed-in caller inherits a stale key
    64	      // from an earlier anonymous visit, `getMessages` 404s for them (the
    65	      // session is anon-owned; `verify_session_access` in chat.py:157-163
    66	      // only returns it to `user is None` callers), so the catch below
    67	      // clears the key and falls through to the normal listSessions flow.
    68	      const storedDemoSession = readDemoSession(documentId);
    69	      if (storedDemoSession) {
    70	        try {
    71	          const msgsData = await getMessages(storedDemoSession);
    72	          if (cancelled) return;
    73	          setSessionId(storedDemoSession);
    74	          // Populate the sessions list (not []) so SessionDropdown shows the
    75	          // adopted session instead of an empty "New Chat"-only placeholder.
    76	          // getMessages doesn't return session metadata, so derive
    77	          // created_at/last_activity_at from the fetched messages' own
    78	          // timestamps (falling back to now if there are none yet).
    79	          const firstMsgAt = msgsData.messages[0]?.createdAt;
    80	          const lastMsgAt = msgsData.messages[msgsData.messages.length - 1]?.createdAt;
    81	          const createdAt = firstMsgAt != null ? new Date(firstMsgAt).toISOString() : new Date().toISOString();
    82	          const lastActivityAt = lastMsgAt != null ? new Date(lastMsgAt).toISOString() : createdAt;
    83	          setSessions([{
    84	            session_id: storedDemoSession,
    85	            title: null,
    86	            message_count: msgsData.messages.length,
    87	            created_at: createdAt,
    88	            last_activity_at: lastActivityAt,
    89	          }]);
    90	          setMessages(msgsData.messages);
    91	          // Baseline model (useChatStream.ts): totalUsed = demoMessagesUsed
    92	          // (server-known usage AS OF THIS RESTORE) + messages sent locally
    93	          // since then. demoRestoredUserMsgCount records how many of the
    94	          // transcript's user messages are already covered by
    95	          // demoMessagesUsed, so useChatStream only counts NEW ones on top.
    96	          // demoMessagesUsed is the raw server value — NOT subtracted — so a
    97	          // restore always converges to server truth, including when the
    98	          // 24h Redis window has expired or the IP changed (server reports
    99	          // 0 even though the transcript has old messages): that previously
   100	          // made the UI hard-lock a user the backend would actually allow.
   101	          const restoredUserMsgCount = msgsData.messages.filter((m) => m.role === 'user').length;
   102	          setDemoRestoredUserMsgCount(restoredUserMsgCount);
   103	          setDemoMessagesUsed(msgsData.demo_messages_used ?? 0);
   104	          return; // adopted — skip listSessions/createSession entirely
   105	        } catch (e) {
   106	          const status = e instanceof ApiError ? e.status : null;
   107	          if (status === 404 || status === 403) {
   108	            // Confirmed gone or inaccessible (pruned by nightly cleanup, or
   109	            // an authed caller inheriting an anon-owned key) — clear the
   110	            // pointer and fall through to the normal listSessions/
   111	            // createSession flow below.
   112	            clearDemoSession(documentId);
   113	          } else {
   114	            // Transient failure (network blip, 5xx) — the pointer is still
   115	            // valid and the session most likely still exists. Falling
   116	            // through to createSession here would silently orphan it:
   117	            // listSessions always returns [] for anon demo, so createSession
   118	            // would succeed and overwrite the still-good pointer (Codex r2
   119	            // #3 repro). Surface a retryable error and stop instead — the
   120	            // reader already renders an error state for sessionError, and a
   121	            // reload re-runs this same effect from the top.
   122	            if (!cancelled) setSessionError(e);
   123	            return;
   124	          }
   125	        }
   126	      }
   127	
   128	      try {
   129	        const sessionsData = await listSessions(documentId);
   130	        if (cancelled) return;
   131	
   132	        setSessions(sessionsData.sessions);
   133	        if (sessionsData.sessions.length > 0) {
   134	          const latest = sessionsData.sessions[0];
   135	          setSessionId(latest.session_id);
   136	          const msgsData = await getMessages(latest.session_id);
   137	          if (!cancelled) setMessages(msgsData.messages);
   138	          sessionReady = true;
   139	        }
   140	      } catch (e) {
   141	        console.warn('Failed to load sessions, falling back to create:', e);
   142	      }
   143	
   144	      if (!sessionReady && !cancelled) {
   145	        try {
   146	          const s = await createSession(documentId);
   147	          if (cancelled) return;
   148	
   149	          setSessionId(s.session_id);
   150	          if (s.demo_messages_used != null) {
   151	            // Fresh session, empty transcript — nothing restored yet, so the
   152	            // baseline is 0 and every subsequent local user message counts.
   153	            setDemoRestoredUserMsgCount(0);
   154	            setDemoMessagesUsed(s.demo_messages_used);
   155	            writeDemoSession(documentId, s.session_id);
   156	          }
   157	
   158	          const now = s.created_at || new Date().toISOString();
   159	          addSession({
   160	            session_id: s.session_id,
   161	            title: null,
   162	            message_count: 0,
   163	            created_at: now,
   164	            last_activity_at: now,
   165	          });
   166	
   167	          setMessages([]);
   168	        } catch (e) {
   169	          const expectedRateLimit = e instanceof ApiError && (e.code === 'DEMO_SESSION_RATE_LIMITED' || e.status === 429);
   170	          if (!expectedRateLimit) {
   171	            console.error('Failed to create session:', e);
   172	          }
   173	          if (!cancelled) setSessionError(e);
   174	        }
   175	      }
   176	    })();
   177	
   178	    return () => {
   179	      cancelled = true;
   180	    };
   181	  }, [documentId, documentStatus, setSessions, setSessionId, setMessages, setDemoMessagesUsed, setDemoRestoredUserMsgCount, addSession]);
   182	
   183	  return { sessionError };
   184	}
     1	"use client";
     2	
     3	import { create } from 'zustand';
     4	import { DEFAULT_MODE, isKnownMode } from '../lib/models';
     5	import type { PlanType } from '../lib/models';
     6	import type { ChatArtifact, Citation, Message, NormalizedBBox, SessionItem } from '../types';
     7	
     8	type DocStatus = 'idle' | 'uploading' | 'parsing' | 'ocr' | 'embedding' | 'ready' | 'error';
     9	
    10	export interface DocTalkStore {
    11	  // Document
    12	  documentId: string | null;
    13	  documentName: string | null;
    14	  documentStatus: DocStatus;
    15	  totalPages: number;
    16	  parseProgress: { pagesParsed: number; chunksIndexed: number };
    17	
    18	  // Last viewed document (persisted to localStorage)
    19	  lastDocumentId: string | null;
    20	  lastDocumentName: string | null;
    21	
    22	  // PDF
    23	  currentPage: number;
    24	  scale: number;
    25	  grabMode: boolean;
    26	  highlights: NormalizedBBox[];
    27	  pdfUrl: string | null;
    28	  scrollNonce: number;
    29	
    30	  // Chat
    31	  sessionId: string | null;
    32	  messages: Message[];
    33	  isStreaming: boolean;
    34	  selectedMode: string;
    35	  domainMode: string | null;
    36	  sessions: SessionItem[];
    37	
    38	  // Document summary (auto-generated)
    39	  documentSummary: string | null;
    40	  suggestedQuestions: string[];
    41	
    42	  // User plan
    43	  userPlan: PlanType;
    44	
    45	  // Text highlight (for non-PDF documents)
    46	  highlightSnippet: string | null;
    47	  // Verbatim supporting sentence for precise (sentence-level) PDF highlighting;
    48	  // null when the citation has no confident focus → fall back to chunk bboxes.
    49	  highlightFocus: string | null;
    50	
    51	  // Demo message tracking (cross-session, cross-document). Contract:
    52	  // totalUsed = demoMessagesUsed (server-known usage as of the last
    53	  // restore/create) + messages sent locally since then. demoRestoredUserMsgCount
    54	  // is the baseline: how many of the CURRENT transcript's user messages were
    55	  // already reflected in demoMessagesUsed at that restore/create point, so
    56	  // useChatStream can subtract it back out of the live transcript's count
    57	  // instead of double-counting. See useChatStream.ts / useChatSession.ts.
    58	  //
    59	  // Both fields are reset ONLY inside useChatSession's documentId-keyed
    60	  // effect (never in clearDocumentTransientState below) — that effect fires
    61	  // exclusively on a real document-ID transition and always re-establishes
    62	  // server truth right after via adopt-or-create in the same run. Resetting
    63	  // them from clearDocumentTransientState was tried (6149931) and reverted
    64	  // (Codex r2 #2): that function is also invoked by useDocumentLoader's
    65	  // effect, whose deps include the locale-sensitive `t`/`tOr`, so a
    66	  // same-document LANGUAGE change zeroed both fields while the transcript
    67	  // stayed — reintroducing the exact TTL-hard-lock bug this model exists to
    68	  // prevent, since nothing re-synced them afterward.
    69	  demoMessagesUsed: number;
    70	  demoRestoredUserMsgCount: number;
    71	
    72	  // PDF Search
    73	  searchQuery: string;
    74	  searchMatches: Array<{ page: number; index: number }>;
    75	  currentMatchIndex: number;
    76	  _pendingText: string;
    77	  _flushTimer: ReturnType<typeof setTimeout> | null;
    78	
    79	  // Actions
    80	  setDocument: (id: string) => void;
    81	  setDocumentName: (name: string) => void;
    82	  setDocumentStatus: (status: DocStatus) => void;
    83	  setLastDocument: (id: string, name: string) => void;
    84	  setPdfUrl: (url: string | null) => void;
    85	  setPage: (page: number) => void;
    86	  setScale: (scale: number) => void;
    87	  setGrabMode: (v: boolean) => void;
    88	  setHighlights: (highlights: NormalizedBBox[]) => void;
    89	  navigateToCitation: (citation: Citation) => void;
    90	  addMessage: (msg: Message) => void;
    91	  updateLastMessage: (text: string) => void;
    92	  addCitationToLastMessage: (citation: Citation) => void;
    93	  addArtifactToLastMessage: (artifact: ChatArtifact) => void;
    94	  setLastMessageToolStatus: (message: string) => void;
    95	  setStreaming: (v: boolean) => void;
    96	  setSessionId: (id: string | null) => void;
    97	  setSelectedMode: (id: string) => void;
    98	  setDomainMode: (mode: string | null) => void;
    99	  setMessages: (msgs: Message[]) => void;
   100	  setSessions: (sessions: SessionItem[]) => void;
   101	  addSession: (session: SessionItem) => void;
   102	  removeSession: (sessionId: string) => void;
   103	  updateSessionActivity: (sessionId: string) => void;
   104	  setDocumentSummary: (summary: string | null) => void;
   105	  setSuggestedQuestions: (questions: string[]) => void;
   106	  setUserPlan: (plan: PlanType) => void;
   107	  setDemoMessagesUsed: (count: number) => void;
   108	  setDemoRestoredUserMsgCount: (count: number) => void;
   109	  setSearchQuery: (query: string) => void;
   110	  setSearchMatches: (matches: Array<{ page: number; index: number }>) => void;
   111	  setCurrentMatchIndex: (index: number) => void;
   112	  markLastMessageTruncated: (truncated: boolean) => void;
   113	  updateLastMessageMeta: (updates: Partial<Message>) => void;
   114	  flushPendingText: () => void;
   115	  clearDocumentTransientState: () => void;
   116	  reset: () => void;
   117	}
   118	
   119	const initialState = {
   120	  documentId: null as string | null,
   121	  documentName: null as string | null,
   122	  documentStatus: 'idle' as DocStatus,
   123	  totalPages: 0,
   124	  parseProgress: { pagesParsed: 0, chunksIndexed: 0 },
   125	  lastDocumentId: (typeof window !== 'undefined' ? localStorage.getItem('doctalk_last_doc_id') : null) as string | null,
   126	  lastDocumentName: (typeof window !== 'undefined' ? localStorage.getItem('doctalk_last_doc_name') : null) as string | null,
   127	  currentPage: 1,
   128	  scale: 1,
   129	  grabMode: false,
   130	  highlights: [] as NormalizedBBox[],
   131	  pdfUrl: null as string | null,
   132	  sessionId: null as string | null,
   133	  messages: [] as Message[],
   134	  isStreaming: false,
   135	  scrollNonce: 0,
   136	  selectedMode: (() => {
   137	    const stored = typeof window !== 'undefined' ? localStorage.getItem('doctalk_mode') : null;
   138	    // Migration: old model IDs or retired modes (for example "thorough") reset to Flash.
   139	    if (!isKnownMode(stored) || stored.includes('/')) return DEFAULT_MODE;
   140	    return stored;
   141	  })(),
   142	  domainMode: null as string | null,
   143	  sessions: [] as SessionItem[],
   144	  documentSummary: null as string | null,
   145	  suggestedQuestions: [] as string[],
   146	  userPlan: 'free' as PlanType,
   147	  highlightSnippet: null as string | null,
   148	  highlightFocus: null as string | null,
   149	  demoMessagesUsed: 0,
   150	  demoRestoredUserMsgCount: 0,
   151	  searchQuery: '',
   152	  searchMatches: [] as Array<{ page: number; index: number }>,
   153	  currentMatchIndex: -1,
   154	  _pendingText: '',
   155	  _flushTimer: null as ReturnType<typeof setTimeout> | null,
   156	};
   157	
   158	export const useDocTalkStore = create<DocTalkStore>((set, get) => ({
   159	  ...initialState,
   160	
   161	  setDocument: (id: string) => set({ documentId: id }),
   162	  setDocumentName: (name: string) => set({ documentName: name }),
   163	  setDocumentStatus: (status: DocStatus) => set({ documentStatus: status }),
   164	  setLastDocument: (id: string, name: string) => {
   165	    set({ lastDocumentId: id, lastDocumentName: name });
   166	    try {
   167	      localStorage.setItem('doctalk_last_doc_id', id);
   168	      localStorage.setItem('doctalk_last_doc_name', name);
   169	    } catch {
   170	      // localStorage unavailable in private browsing
   171	    }
   172	  },
   173	  setPdfUrl: (url: string | null) => set({ pdfUrl: url }),
   174	  setPage: (page: number) => set({ currentPage: Math.max(1, page) }),
   175	  setScale: (scale: number) => set({ scale: Math.max(0.25, scale) }),
   176	  setGrabMode: (v: boolean) => set({ grabMode: v }),
   177	  setHighlights: (highlights: NormalizedBBox[]) => set({ highlights }),
   178	  navigateToCitation: (citation: Citation) => {
   179	    const bboxes = (citation.bboxes || []).map((bb: NormalizedBBox) => ({
   180	      ...bb,
   181	      page: bb.page ?? citation.page,
   182	    }));
   183	    set((state) => ({
   184	      currentPage: citation.page,
   185	      highlights: bboxes,
   186	      // Chunk snippet stays the reliable fallback (converted-PDF/TextViewer
   187	      // paths depend on it). The focus sentence is layered ON TOP as emphasis.
   188	      highlightSnippet: citation.textSnippet || null,
   189	      highlightFocus: citation.focusSnippet || null,
   190	      scrollNonce: state.scrollNonce + 1,
   191	    }));
   192	  },
   193	  addMessage: (msg: Message) => set({ messages: [...get().messages, msg] }),
   194	  setMessages: (msgs: Message[]) => set({ messages: msgs }),
   195	  updateLastMessage: (text: string) => {
   196	    if (!text) return;
   197	    const state = get();
   198	    set({ _pendingText: (state._pendingText || '') + text });
   199	
   200	    if (!state._flushTimer) {
   201	      const timer = setTimeout(() => {
   202	        const s = get();
   203	        const msgs = s.messages;
   204	
   205	        if (msgs.length === 0) {
   206	          set({ _pendingText: '', _flushTimer: null });
   207	          return;
   208	        }
   209	
   210	        const last = msgs[msgs.length - 1];
   211	        const updated = { ...last, text: (last.text || '') + s._pendingText };
   212	        set({
   213	          messages: [...msgs.slice(0, -1), updated],
   214	          _pendingText: '',
   215	          _flushTimer: null,
   216	        });
   217	      }, 50);
   218	
   219	      set({ _flushTimer: timer });
   220	    }
   221	  },
   222	  flushPendingText: () => {
   223	    const state = get();
   224	    if (state._flushTimer) clearTimeout(state._flushTimer);
   225	    if (!state._pendingText) {
   226	      set({ _flushTimer: null });
   227	      return;
   228	    }
   229	
   230	    const msgs = state.messages;
   231	    if (msgs.length === 0) {
   232	      set({ _pendingText: '', _flushTimer: null });
   233	      return;
   234	    }
   235	
   236	    const last = msgs[msgs.length - 1];
   237	    const updated = { ...last, text: (last.text || '') + state._pendingText };
   238	    set({
   239	      messages: [...msgs.slice(0, -1), updated],
   240	      _pendingText: '',
   241	      _flushTimer: null,
   242	    });
   243	  },
   244	  addCitationToLastMessage: (citation: Citation) => {
   245	    const msgs = get().messages;
   246	    if (msgs.length === 0) return;
   247	    const last = msgs[msgs.length - 1];
   248	    const citations = [...(last.citations || []), citation];
   249	    const updated = { ...last, citations } as Message;
   250	    set({ messages: [...msgs.slice(0, -1), updated] });
   251	  },
   252	  addArtifactToLastMessage: (artifact: ChatArtifact) => {
   253	    const msgs = get().messages;
   254	    if (msgs.length === 0) return;
   255	    const last = msgs[msgs.length - 1];
   256	    const existing = last.artifacts || [];
   257	    const next = artifact.jobId
   258	      ? existing.filter((item) => item.jobId !== artifact.jobId)
   259	      : existing;
   260	    set({ messages: [...msgs.slice(0, -1), { ...last, artifacts: [...next, artifact] }] });
   261	  },
   262	  setLastMessageToolStatus: (message: string) => {
   263	    const msgs = get().messages;
   264	    if (msgs.length === 0) return;
   265	    const last = msgs[msgs.length - 1];
   266	    set({ messages: [...msgs.slice(0, -1), { ...last, toolStatus: message }] });
   267	  },
   268	  setStreaming: (v: boolean) => set({ isStreaming: v }),
   269	  setSessionId: (id: string | null) => set({ sessionId: id }),
   270	  setSelectedMode: (id: string) => {
   271	    set({ selectedMode: id });
   272	    try {
   273	      localStorage.setItem('doctalk_mode', id);
   274	    } catch {
   275	      // localStorage unavailable in private browsing
   276	    }
   277	  },
   278	  setDomainMode: (mode: string | null) => set({ domainMode: mode }),
   279	  setSessions: (sessions: SessionItem[]) => set({ sessions }),
   280	  addSession: (session: SessionItem) => set((state) => ({
   281	    sessions: [session, ...state.sessions],
   282	  })),
   283	  removeSession: (sessionId: string) => set((state) => ({
   284	    sessions: state.sessions.filter((s) => s.session_id !== sessionId),
   285	  })),
   286	  updateSessionActivity: (sessionId: string) => set((state) => {
   287	    const now = new Date().toISOString();
   288	    const updated = state.sessions.map((s) =>
   289	      s.session_id === sessionId
   290	        ? { ...s, last_activity_at: now, message_count: s.message_count + 1 }
   291	        : s
   292	    );
   293	    // 重排：将活跃 session 移到顶部
   294	    updated.sort((a, b) => new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime());
   295	    return { sessions: updated };
   296	  }),
   297	  setDocumentSummary: (summary: string | null) => set({ documentSummary: summary }),
   298	  setSuggestedQuestions: (questions: string[]) => set({ suggestedQuestions: questions }),
   299	  setUserPlan: (plan: PlanType) => set({ userPlan: plan }),
   300	  setDemoMessagesUsed: (count: number) => set({ demoMessagesUsed: count }),
   301	  setDemoRestoredUserMsgCount: (count: number) => set({ demoRestoredUserMsgCount: count }),
   302	  setSearchQuery: (query: string) => set({ searchQuery: query }),
   303	  setSearchMatches: (matches) => set({ searchMatches: matches }),
   304	  setCurrentMatchIndex: (index: number) => set({ currentMatchIndex: index }),
   305	  markLastMessageTruncated: (truncated: boolean) => {
   306	    const msgs = get().messages;
   307	    if (msgs.length === 0) return;
   308	    const last = msgs[msgs.length - 1];
   309	    set({ messages: [...msgs.slice(0, -1), { ...last, isTruncated: truncated }] });
   310	  },
   311	  updateLastMessageMeta: (updates) => {
   312	    const msgs = get().messages;
   313	    if (msgs.length === 0) return;
   314	    const last = msgs[msgs.length - 1];
   315	    set({ messages: [...msgs.slice(0, -1), { ...last, ...updates }] });
   316	  },
   317	  // Clears only the per-document UI state that should NOT leak across a
   318	  // document switch (search query/matches, citation highlights, grab mode,
   319	  // current page). Call this from `useDocumentLoader` when the route changes
   320	  // from `/d/A` to `/d/B`, so doc B doesn't inherit doc A's overlays.
   321	  // Leaves session/messages/mode/sessions/userPlan intact — those are owned by
   322	  // higher-level effects that load per-document or are user-global.
   323	  clearDocumentTransientState: () => set({
   324	    searchQuery: '',
   325	    searchMatches: [],
   326	    currentMatchIndex: -1,
   327	    highlights: [],
   328	    highlightSnippet: null,
   329	    highlightFocus: null,
   330	    grabMode: false,
   331	    currentPage: 1,
   332	    scrollNonce: 0,
   333	    // Per-document content — doc B must never show doc A's summary or
   334	    // suggested questions (the loader re-sets them when B is ready).
   335	    documentSummary: null,
   336	    suggestedQuestions: [],
   337	  }),
   338	  reset: () => {
   339	    const timer = get()._flushTimer;
   340	    if (timer) clearTimeout(timer);
   341	    set((state) => ({ ...initialState, selectedMode: state.selectedMode, lastDocumentId: state.lastDocumentId, lastDocumentName: state.lastDocumentName }));
   342	  },
   343	}));
   330	    </div>
   331	  );
   332	
   333	  const processingStatusText = documentStatus === 'parsing'
   334	    ? t('status.parsing')
   335	    : documentStatus === 'embedding'
   336	      ? t('status.embedding')
   337	      : documentStatus === 'ocr'
   338	        ? t('status.ocr')
   339	        : t('status.processing');
   340	
   341	  const handleCitationClick = useCallback((citation: Citation) => {
   342	    trackEvent('citation_clicked', {
   343	      source: isDemo ? 'demo_reader' : 'document_reader',
   344	      page: citation.page,
   345	      has_bboxes: Boolean(citation.bboxes?.length),
   346	    });
   347	    navigateToCitation(citation);
   348	    revealMobileDocumentPane();
   349	  }, [isDemo, navigateToCitation, revealMobileDocumentPane]);
   350	
   351	  useEffect(() => {
   352	    if (isDesktopLayout !== false || mobileTab !== 'document') return;
   353	    if (highlights.length === 0 && !highlightSnippet) return;
   354	    let secondFrame: number | null = null;
   355	    const firstFrame = requestAnimationFrame(() => {
   356	      secondFrame = requestAnimationFrame(() => {
   357	        useDocTalkStore.setState((state) => ({ scrollNonce: state.scrollNonce + 1 }));
   358	      });
   359	    });
   360	    return () => {
   361	      cancelAnimationFrame(firstFrame);
   362	      if (secondFrame !== null) cancelAnimationFrame(secondFrame);
   363	    };
   364	  }, [isDesktopLayout, mobileTab, currentPage, highlights, highlightSnippet]);
   365	
   366	  const chatContent = documentStatus === 'ready' && sessionId ? (
   367	    <ChatPanel sessionId={sessionId} onCitationClick={handleCitationClick} onPreviewLayoutTranslation={handlePreviewLayoutTranslation} maxUserMessages={isDemo && !isLoggedIn ? 5 : undefined} suggestedQuestions={suggestedQuestions.length > 0 ? suggestedQuestions : undefined} initialQuestion={initialQuestion} autoSubmitInitialQuestion={isDemo} onOpenSettings={canUseCustomInstructions ? () => setShowInstructions(true) : undefined} hasCustomInstructions={!!customInstructions} userPlan={userPlan} />
   368	  ) : sessionErrorCopy ? (
   369	    <div className="flex h-full w-full items-center justify-center px-5 py-8">
   370	      <div
   371	        className={`w-full max-w-md rounded-2xl border px-5 py-4 text-sm shadow-sm ${
   372	          sessionErrorCopy.severity === 'warning'
   373	            ? 'border-amber-300/40 bg-amber-50 text-amber-950 dark:border-amber-300/25 dark:bg-amber-300/10 dark:text-amber-100'
   374	            : sessionErrorCopy.severity === 'info'
   375	              ? 'border-blue-300/40 bg-blue-50 text-blue-950 dark:border-blue-300/25 dark:bg-blue-300/10 dark:text-blue-100'
   376	              : 'border-red-300/40 bg-red-50 text-red-950 dark:border-red-300/25 dark:bg-red-300/10 dark:text-red-100'
   377	        }`}
   378	        role="status"
   379	        aria-live="polite"
   380	      >
   381	        <p className="font-semibold">{sessionErrorCopy.title}</p>
   382	        <p className="mt-2 leading-6 opacity-90">{sessionErrorCopy.body}</p>
   383	        {sessionErrorCopy.cta && (
   384	          <button
   385	            type="button"
   386	            onClick={() => router.push(sessionErrorCopy.cta!.href)}
   387	            className="mt-4 rounded-full bg-zinc-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
   388	          >
   389	            {sessionErrorCopy.cta.label}
   390	          </button>
   391	        )}
   392	      </div>
   393	    </div>
   394	  ) : documentStatus !== 'ready' && !error ? (
   395	    <div className="h-full w-full flex flex-col items-center justify-center px-6 py-8 text-zinc-500" role="status" aria-live="polite">
   396	      <div className="w-full max-w-md space-y-3 animate-pulse motion-reduce:animate-none">
   397	        <div className="flex justify-start">
   398	          <div className="w-3/4 rounded-xl bg-zinc-200 dark:bg-zinc-800 p-3">
   399	            <div className="h-2.5 w-11/12 rounded bg-zinc-300 dark:bg-zinc-700" />
   400	          </div>
   401	        </div>
   402	        <div className="flex justify-end">
   403	          <div className="w-2/3 rounded-xl bg-zinc-200 dark:bg-zinc-800 p-3">
   404	            <div className="h-2.5 w-10/12 rounded bg-zinc-300 dark:bg-zinc-700" />
   405	          </div>
   406	        </div>
   407	        <div className="flex justify-start">
   408	          <div className="w-4/5 rounded-xl bg-zinc-200 dark:bg-zinc-800 p-3 space-y-2">
   409	            <div className="h-2.5 w-full rounded bg-zinc-300 dark:bg-zinc-700" />
   410	            <div className="h-2.5 w-9/12 rounded bg-zinc-300 dark:bg-zinc-700" />
   411	          </div>
   412	        </div>
   413	      </div>
   414	      <p className="mt-5 text-sm">{t('doc.processing')}</p>
   415	      <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{processingStatusText}</p>
   416	    </div>
   417	  ) : (
   418	    <div className="h-full w-full flex items-center justify-center text-zinc-500">{t('doc.initChat')}</div>
   419	  );
   420	
frontend/src/store/index.ts:52:  // totalUsed = demoMessagesUsed (server-known usage as of the last
frontend/src/store/index.ts:53:  // restore/create) + messages sent locally since then. demoRestoredUserMsgCount
frontend/src/store/index.ts:55:  // already reflected in demoMessagesUsed at that restore/create point, so
frontend/src/store/index.ts:69:  demoMessagesUsed: number;
frontend/src/store/index.ts:70:  demoRestoredUserMsgCount: number;
frontend/src/store/index.ts:149:  demoMessagesUsed: 0,
frontend/src/store/index.ts:150:  demoRestoredUserMsgCount: 0,
frontend/src/store/index.ts:300:  setDemoMessagesUsed: (count: number) => set({ demoMessagesUsed: count }),
frontend/src/store/index.ts:301:  setDemoRestoredUserMsgCount: (count: number) => set({ demoRestoredUserMsgCount: count }),
frontend/src/lib/useChatSession.ts:71:          const msgsData = await getMessages(storedDemoSession);
frontend/src/lib/useChatSession.ts:91:          // Baseline model (useChatStream.ts): totalUsed = demoMessagesUsed
frontend/src/lib/useChatSession.ts:93:          // since then. demoRestoredUserMsgCount records how many of the
frontend/src/lib/useChatSession.ts:95:          // demoMessagesUsed, so useChatStream only counts NEW ones on top.
frontend/src/lib/useChatSession.ts:96:          // demoMessagesUsed is the raw server value — NOT subtracted — so a
frontend/src/lib/useChatSession.ts:103:          setDemoMessagesUsed(msgsData.demo_messages_used ?? 0);
frontend/src/lib/useChatSession.ts:136:          const msgsData = await getMessages(latest.session_id);
frontend/src/lib/useChatSession.ts:150:          if (s.demo_messages_used != null) {
frontend/src/lib/useChatSession.ts:154:            setDemoMessagesUsed(s.demo_messages_used);
frontend/src/lib/api.ts:159:export async function createSession(docId: string): Promise<{ session_id: string; document_id: string; title: string | null; created_at: string; demo_messages_used?: number }>
frontend/src/lib/api.ts:167:export async function getMessages(sessionId: string): Promise<{ messages: Message[]; demo_messages_used?: number | null }> {
frontend/src/lib/api.ts:169:  const data: { messages: Array<{ id?: string; share_anchor?: string; role: Message['role']; content: string; citations?: any[]; metadata_json?: any; created_at: string }>; demo_messages_used?: number | null } = await handle(res);
frontend/src/lib/api.ts:191:  return { messages: mapped, demo_messages_used: data.demo_messages_used };
frontend/src/lib/useChatStream.ts:58:    demoMessagesUsed,
frontend/src/lib/useChatStream.ts:59:    demoRestoredUserMsgCount,
frontend/src/lib/useChatStream.ts:74:  // Contract: totalUsed = demoMessagesUsed (server-known count as of the last
frontend/src/lib/useChatStream.ts:75:  // restore/create) + messages sent locally since then. demoRestoredUserMsgCount
frontend/src/lib/useChatStream.ts:77:  // transcript's user messages were already reflected in demoMessagesUsed —
frontend/src/lib/useChatStream.ts:87:    ? Math.max(0, userMsgsInTranscript - demoRestoredUserMsgCount)
frontend/src/lib/useChatStream.ts:89:  const totalUsed = demoMessagesUsed + localUserMsgCount;
frontend/src/lib/useChatStream.ts:126:  // response carries demo_messages_used (anon demo only), re-anchors BOTH
frontend/src/lib/useChatStream.ts:135:    getMessages(forSessionId)
frontend/src/lib/useChatStream.ts:137:        if (msgsData.demo_messages_used == null) return;
frontend/src/lib/useChatStream.ts:148:        state.setDemoMessagesUsed(msgsData.demo_messages_used);
frontend/src/lib/useChatStream.ts:351:  // demoMessagesUsed directly (not the baseline, which only moves at
frontend/src/lib/useChatStream.ts:366:    state.setDemoMessagesUsed(state.demoMessagesUsed + 1);
frontend/src/lib/demoSessionStorage.ts:12: *   `demo_messages_used != null`)
backend/tests/test_error_taxonomy.py:532:    `SessionMessagesResponse` (declared `demo_messages_used` field) rather
backend/tests/test_error_taxonomy.py:546:    assert "demo_messages_used" in body
backend/tests/test_error_taxonomy.py:547:    assert body["demo_messages_used"] is None
backend/tests/test_error_taxonomy.py:568:    assert body["demo_messages_used"] == 3
frontend/src/components/SessionDropdown.tsx:72:      if (s.demo_messages_used != null) {
frontend/src/components/SessionDropdown.tsx:76:        setDemoMessagesUsed(s.demo_messages_used);
frontend/src/components/SessionDropdown.tsx:99:    const msgs = await getMessages(id);
frontend/src/components/SessionDropdown.tsx:105:    // — demo_messages_used is absent for authed/non-demo sessions).
frontend/src/components/SessionDropdown.tsx:106:    if (msgs.demo_messages_used != null) {
frontend/src/components/SessionDropdown.tsx:109:      setDemoMessagesUsed(msgs.demo_messages_used);
frontend/src/app/collections/[collectionId]/page.tsx:96:          const msgsData = await getMessages(latest.session_id);
frontend/src/app/collections/[collectionId]/page.tsx:130:      const msgsData = await getMessages(sid);
backend/app/schemas/chat.py:44:    demo_messages_used: Optional[int] = None
backend/app/schemas/chat.py:49:    demo_messages_used: Optional[int] = None
backend/app/api/chat.py:301:            content={**response.model_dump(mode="json"), "demo_messages_used": used},
backend/app/api/chat.py:337:    demo_messages_used = None
backend/app/api/chat.py:340:        demo_messages_used = await demo_message_tracker.get_count(
backend/app/api/chat.py:344:    return SessionMessagesResponse(messages=items, demo_messages_used=demo_messages_used)

exec
/bin/zsh -lc "nl -ba frontend/src/lib/useChatStream.ts | sed -n '45,190p'
nl -ba frontend/src/lib/useChatStream.ts | sed -n '245,475p'
nl -ba frontend/src/lib/sse.ts | sed -n '1,275p'
nl -ba frontend/src/lib/api.ts | sed -n '150,200p'
nl -ba backend/app/api/chat.py | sed -n '260,365p'
nl -ba backend/app/api/chat.py | sed -n '375,575p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
    45	  sessionId,
    46	  selectedMode,
    47	  locale,
    48	  t,
    49	  tOr,
    50	  maxUserMessages,
    51	  currentPlan,
    52	  onShowPaywall,
    53	  onRequireAuth,
    54	}: UseChatStreamOptions): UseChatStreamResult {
    55	  const {
    56	    messages,
    57	    isStreaming,
    58	    demoMessagesUsed,
    59	    demoRestoredUserMsgCount,
    60	    addMessage,
    61	    updateLastMessage,
    62	    addCitationToLastMessage,
    63	    addArtifactToLastMessage,
    64	    setLastMessageToolStatus,
    65	    setStreaming,
    66	    updateSessionActivity,
    67	    flushPendingText,
    68	    markLastMessageTruncated,
    69	    updateLastMessageMeta,
    70	  } = useDocTalkStore();
    71	
    72	  const abortRef = useRef<AbortController | null>(null);
    73	
    74	  // Contract: totalUsed = demoMessagesUsed (server-known count as of the last
    75	  // restore/create) + messages sent locally since then. demoRestoredUserMsgCount
    76	  // is the baseline set at that restore/create point — how many of the
    77	  // transcript's user messages were already reflected in demoMessagesUsed —
    78	  // so only messages appended AFTER it count as "new". This converges to
    79	  // server truth on every restore, including Redis TTL expiry / IP changes
    80	  // (server reports 0 even though the transcript has old messages), instead
    81	  // of a fixed subtraction that could outlive the server's own window and
    82	  // hard-lock a user the backend would actually allow.
    83	  const userMsgsInTranscript = maxUserMessages != null
    84	    ? messages.filter((m) => m.role === 'user').length
    85	    : 0;
    86	  const localUserMsgCount = maxUserMessages != null
    87	    ? Math.max(0, userMsgsInTranscript - demoRestoredUserMsgCount)
    88	    : 0;
    89	  const totalUsed = demoMessagesUsed + localUserMsgCount;
    90	  const demoRemaining = maxUserMessages != null ? maxUserMessages - totalUsed : Infinity;
    91	  const demoLimitReached = maxUserMessages != null && demoRemaining <= 0;
    92	  const messagesUsed = maxUserMessages != null ? Math.min(maxUserMessages, Math.max(0, totalUsed)) : 0;
    93	  const maxMessages = maxUserMessages ?? 0;
    94	
    95	  const getErrorMeta = useCallback(
    96	    (err: unknown): { message: string; code: string | null; status: number | null } => {
    97	      if (typeof err === 'object' && err) {
    98	        const anyErr = err as Record<string, unknown>;
    99	        return {
   100	          message: typeof anyErr.message === 'string' ? anyErr.message : '',
   101	          code: typeof anyErr.code === 'string' ? anyErr.code : null,
   102	          status: typeof anyErr.status === 'number' ? anyErr.status : null,
   103	        };
   104	      }
   105	      return { message: '', code: null, status: null };
   106	    },
   107	    [],
   108	  );
   109	
   110	  // Shared by handleStreamError and the regenerate/continue catch blocks
   111	  // below — both need to recognize a user-initiated abort the same way.
   112	  const isAbortLikeError = useCallback((err: unknown): boolean => {
   113	    const name = typeof err === 'object' && err && 'name' in err
   114	      ? String((err as { name?: unknown }).name || '')
   115	      : '';
   116	    const message = typeof err === 'object' && err && 'message' in err
   117	      ? String((err as { message?: unknown }).message || '')
   118	      : '';
   119	    return name === 'AbortError' || message.includes('AbortError');
   120	  }, []);
   121	
   122	  // Fire-and-forget re-sync to server truth after a regenerate/continue
   123	  // failure — replaces the r2 ref-based rollback (Codex r3: a rollback token
   124	  // could go stale across an aborted call and then incorrectly undo a later,
   125	  // unrelated send's usage). GETs the current session's messages and, if the
   126	  // response carries demo_messages_used (anon demo only), re-anchors BOTH
   127	  // fields to "right now": the raw server count, and a baseline equal to the
   128	  // LIVE transcript's current user-message count (not the fetched
   129	  // transcript's) — so useChatStream's formula converges immediately without
   130	  // needing a full page reload, regardless of whether the failed request
   131	  // actually consumed server quota or not. Errors are swallowed: this is a
   132	  // best-effort correction, not something that should surface to the user.
   133	  const reanchorDemoCounter = useCallback((forSessionId: string) => {
   134	    if (maxUserMessages == null) return;
   135	    getMessages(forSessionId)
   136	      .then((msgsData) => {
   137	        if (msgsData.demo_messages_used == null) return;
   138	        const state = useDocTalkStore.getState();
   139	        // The GET can resolve after the user has already navigated away —
   140	        // e.g. useChatSession's effect ran its synchronous reset for a NEW
   141	        // document/session while this was in flight. Re-read the CURRENT
   142	        // sessionId from the store (not a closure) and only write if it
   143	        // still matches the session this reanchor was called for; otherwise
   144	        // the fetched-for-A truth would clobber whatever B's own
   145	        // adopt/create already established. Drop it silently — B's own
   146	        // adoption path is the authoritative source for B's counter.
   147	        if (state.sessionId !== forSessionId) return;
   148	        state.setDemoMessagesUsed(msgsData.demo_messages_used);
   149	        state.setDemoRestoredUserMsgCount(
   150	          state.messages.filter((m) => m.role === 'user').length,
   151	        );
   152	      })
   153	      .catch(() => {
   154	        // best-effort — a later restore/regenerate/continue will try again
   155	      });
   156	  }, [maxUserMessages]);
   157	
   158	  const handleStreamError = useCallback((err: unknown) => {
   159	    flushPendingText();
   160	    setStreaming(false);
   161	    abortRef.current = null;
   162	
   163	    const { message, code, status } = getErrorMeta(err);
   164	
   165	    if (isAbortLikeError(err)) {
   166	      return;
   167	    }
   168	
   169	    if (
   170	      status === 402
   171	      || code === 'INSUFFICIENT_CREDITS'
   172	      || code === 'MODE_NOT_ALLOWED'
   173	      || code === 'PRO_MODE_LIMIT_REACHED'
   174	      || code === 'BALANCED_MODE_LIMIT_REACHED'
   175	    ) {
   176	      const reason = code || 'paid_limit';
   177	      // I27: previously hardcoded `plan: 'plus'`, which falsely attributed
   178	      // every paywall event in the funnel to plus-upgrade intent regardless
   179	      // of what triggered it (e.g. a Plus user hitting the Pro cap was logged
   180	      // as a Plus-upgrade event). Derive the actual upgrade target from
   181	      // (currentPlan, reason) so the upgrade-funnel analytics aren't poisoned.
   182	      const upgradePlan = deriveUpgradePlan(currentPlan, reason);
   183	      trackEvent('limit_hit', { source: 'chat_stream', reason, plan: upgradePlan, period: 'monthly' });
   184	      trackEvent('paywall_opened', { source: 'chat_stream', reason, plan: upgradePlan, period: 'monthly' });
   185	      onShowPaywall(reason);
   186	      return;
   187	    }
   188	
   189	    if (status === 409 || code === 'DOCUMENT_PROCESSING') {
   190	      addMessage({
   245	      text: copy.body,
   246	      isError: true,
   247	      createdAt: Date.now(),
   248	    });
   249	  }, [addMessage, flushPendingText, getErrorMeta, isAbortLikeError, onShowPaywall, setStreaming, t, tOr, currentPlan]);
   250	
   251	  const handleTruncated = useCallback(() => {
   252	    flushPendingText();
   253	    markLastMessageTruncated(true);
   254	  }, [flushPendingText, markLastMessageTruncated]);
   255	
   256	  const handleStreamDone = useCallback((d: { message_id: string; can_continue?: boolean; continuation_count?: number }) => {
   257	    flushPendingText();
   258	    setStreaming(false);
   259	    abortRef.current = null;
   260	    updateSessionActivity(sessionId);
   261	    triggerCreditsRefresh();
   262	    trackEvent('chat_message_completed', { source: 'chat_stream', mode: selectedMode });
   263	    if (d.message_id) {
   264	      updateLastMessageMeta({
   265	        backendId: d.message_id,
   266	        shareAnchor: messageShareAnchorFromId(d.message_id),
   267	        ...(d.continuation_count !== undefined ? { continuationCount: d.continuation_count } : {}),
   268	      });
   269	    }
   270	  }, [flushPendingText, setStreaming, updateSessionActivity, sessionId, selectedMode, updateLastMessageMeta]);
   271	
   272	  const handleAnswerRepaired = useCallback((payload: { text: string; citations: Message['citations'] }) => {
   273	    flushPendingText();
   274	    updateLastMessageMeta({
   275	      text: payload.text,
   276	      citations: payload.citations || [],
   277	      isTruncated: false,
   278	      toolStatus: undefined,
   279	    });
   280	  }, [flushPendingText, updateLastMessageMeta]);
   281	
   282	  // Text-preserving citation update: sentence-level focus added after the
   283	  // answer (cross-lingual / paraphrase). Only the citations change.
   284	  const handleCitationsRefined = useCallback((citations: Message['citations']) => {
   285	    flushPendingText();
   286	    updateLastMessageMeta({ citations: citations || [] });
   287	  }, [flushPendingText, updateLastMessageMeta]);
   288	
   289	  // `onErrorOverride` lets a caller observe an error before it reaches the
   290	  // shared `handleStreamError` (used by regenerateLastResponse to trigger a
   291	  // demo-counter re-anchor without changing sendMessage's behavior at all).
   292	  const streamAssistantResponse = useCallback(async (prompt: string, onErrorOverride?: (err: unknown) => void) => {
   293	    const controller = new AbortController();
   294	    abortRef.current = controller;
   295	
   296	    const domainMode = useDocTalkStore.getState().domainMode;
   297	    await chatStream(
   298	      sessionId,
   299	      prompt,
   300	      ({ text }) => updateLastMessage(text || ''),
   301	      (citation) => addCitationToLastMessage(citation),
   302	      onErrorOverride ?? handleStreamError,
   303	      handleStreamDone,
   304	      handleTruncated,
   305	      selectedMode,
   306	      locale,
   307	      controller.signal,
   308	      domainMode,
   309	      (artifact) => addArtifactToLastMessage(artifact),
   310	      ({ message }) => setLastMessageToolStatus(message),
   311	      handleAnswerRepaired,
   312	      handleCitationsRefined,
   313	    );
   314	  }, [sessionId, updateLastMessage, addCitationToLastMessage, addArtifactToLastMessage, setLastMessageToolStatus, handleStreamError, handleStreamDone, handleTruncated, handleAnswerRepaired, handleCitationsRefined, selectedMode, locale]);
   315	
   316	  const sendMessage = useCallback(async (text: string) => {
   317	    if (!text.trim() || isStreaming) return false;
   318	
   319	    if (demoLimitReached) {
   320	      onRequireAuth();
   321	      return false;
   322	    }
   323	
   324	    const userMsg: Message = {
   325	      id: `m_${Date.now()}_u`,
   326	      role: 'user',
   327	      text,
   328	      createdAt: Date.now(),
   329	    };
   330	
   331	    const asstMsg: Message = {
   332	      id: `m_${Date.now()}_a`,
   333	      role: 'assistant',
   334	      text: '',
   335	      citations: [],
   336	      createdAt: Date.now(),
   337	    };
   338	
   339	    addMessage(userMsg);
   340	    addMessage(asstMsg);
   341	    setStreaming(true);
   342	    trackEvent('chat_message_sent', { source: 'chat_panel', mode: selectedMode });
   343	
   344	    await streamAssistantResponse(text);
   345	    return true;
   346	  }, [isStreaming, demoLimitReached, onRequireAuth, addMessage, setStreaming, streamAssistantResponse, selectedMode]);
   347	
   348	  // Regenerate/continue add no new user message locally (they resend/extend
   349	  // an existing turn), but the backend increments demo quota on both — so
   350	  // without this the UI would undercount relative to the server. Bumps
   351	  // demoMessagesUsed directly (not the baseline, which only moves at
   352	  // restore/create) and optimistically, before the stream starts — correct
   353	  // whenever the server actually charges, which is the dominant case,
   354	  // including an abort (streaming can only be aborted once the backend has
   355	  // already started responding, so it plausibly already charged). No
   356	  // rollback here on failure — see reanchorDemoCounter above: instead of
   357	  // guessing whether a given failure means the server charged or not (r3:
   358	  // that guess is unsafe — e.g. the continuation endpoint charges quota
   359	  // BEFORE validating the message is still continuable, so a 404/400 there
   360	  // is still a real charge), a failed regenerate/continue re-syncs to
   361	  // server truth directly. No-op outside demo (maxUserMessages == null), so
   362	  // authenticated/non-demo sessions are untouched.
   363	  const bumpDemoUsageForRegenOrContinue = useCallback(() => {
   364	    if (maxUserMessages == null) return;
   365	    const state = useDocTalkStore.getState();
   366	    state.setDemoMessagesUsed(state.demoMessagesUsed + 1);
   367	  }, [maxUserMessages]);
   368	
   369	  const regenerateLastResponse = useCallback(async () => {
   370	    if (isStreaming) return;
   371	
   372	    const msgs = useDocTalkStore.getState().messages;
   373	    let lastUserIdx = -1;
   374	
   375	    for (let i = msgs.length - 1; i >= 0; i--) {
   376	      if (msgs[i].role === 'user') {
   377	        lastUserIdx = i;
   378	        break;
   379	      }
   380	    }
   381	
   382	    if (lastUserIdx === -1) return;
   383	
   384	    const lastUserText = msgs[lastUserIdx].text;
   385	    const trimmed = msgs.slice(0, lastUserIdx + 1);
   386	
   387	    useDocTalkStore.getState().setMessages(trimmed);
   388	    addMessage({ id: `m_${Date.now()}_a`, role: 'assistant', text: '', citations: [], createdAt: Date.now() });
   389	    bumpDemoUsageForRegenOrContinue();
   390	    setStreaming(true);
   391	
   392	    try {
   393	      // Covers errors reported via the SSE error event/mid-stream failures
   394	      // (which resolve normally, so a try/catch alone wouldn't see them) —
   395	      // re-anchor before delegating to the shared error handler.
   396	      await streamAssistantResponse(lastUserText, (err) => {
   397	        reanchorDemoCounter(sessionId);
   398	        handleStreamError(err);
   399	      });
   400	    } catch (e) {
   401	      // Covers a thrown fetch() rejection (network failure before/instead
   402	      // of any SSE response) — the one case the onError override above
   403	      // can't see, since it never fires. Re-throws unchanged (nothing here
   404	      // catches it today either) — this only adds the re-anchor.
   405	      if (!isAbortLikeError(e)) reanchorDemoCounter(sessionId);
   406	      throw e;
   407	    }
   408	  }, [isStreaming, addMessage, setStreaming, streamAssistantResponse, bumpDemoUsageForRegenOrContinue, reanchorDemoCounter, sessionId, handleStreamError, isAbortLikeError]);
   409	
   410	  const continueGenerating = useCallback(async () => {
   411	    if (isStreaming) return;
   412	
   413	    const msgs = useDocTalkStore.getState().messages;
   414	    const lastMsg = msgs[msgs.length - 1];
   415	    if (!lastMsg || lastMsg.role !== 'assistant' || !lastMsg.isTruncated) return;
   416	
   417	    // Clear truncated flag and start streaming
   418	    markLastMessageTruncated(false);
   419	    bumpDemoUsageForRegenOrContinue();
   420	    setStreaming(true);
   421	
   422	    const controller = new AbortController();
   423	    abortRef.current = controller;
   424	
   425	    try {
   426	      await continueStream(
   427	        sessionId,
   428	        lastMsg.backendId || '',
   429	        ({ text }) => updateLastMessage(text || ''),
   430	        (citation) => addCitationToLastMessage(citation),
   431	        // Re-anchor before delegating — covers SSE error-event/mid-stream
   432	        // failures, which resolve normally (see the try/catch below for the
   433	        // thrown-fetch-rejection case a callback can't see).
   434	        (err) => {
   435	          reanchorDemoCounter(sessionId);
   436	          handleStreamError(err);
   437	        },
   438	        handleStreamDone,
   439	        handleTruncated,
   440	        selectedMode,
   441	        locale,
   442	        controller.signal,
   443	        (artifact) => addArtifactToLastMessage(artifact),
   444	        ({ message }) => setLastMessageToolStatus(message),
   445	        handleAnswerRepaired,
   446	        handleCitationsRefined,
   447	      );
   448	    } catch (e) {
   449	      // Thrown fetch() rejection — re-throws unchanged (nothing here catches
   450	      // it today either), this only adds the re-anchor.
   451	      if (!isAbortLikeError(e)) reanchorDemoCounter(sessionId);
   452	      throw e;
   453	    }
   454	  }, [isStreaming, sessionId, markLastMessageTruncated, setStreaming, updateLastMessage, addCitationToLastMessage, addArtifactToLastMessage, setLastMessageToolStatus, handleStreamError, handleStreamDone, handleTruncated, handleAnswerRepaired, handleCitationsRefined, selectedMode, locale, bumpDemoUsageForRegenOrContinue, reanchorDemoCounter, isAbortLikeError]);
   455	
   456	  const stopStreaming = useCallback(() => {
   457	    abortRef.current?.abort();
   458	    abortRef.current = null;
   459	    flushPendingText();
   460	    setStreaming(false);
   461	  }, [flushPendingText, setStreaming]);
   462	
   463	  return useMemo(() => ({
   464	    sendMessage,
   465	    regenerateLastResponse,
   466	    continueGenerating,
   467	    stopStreaming,
   468	    demoRemaining,
   469	    demoLimitReached,
   470	    messagesUsed,
   471	    maxMessages,
   472	  }), [sendMessage, regenerateLastResponse, continueGenerating, stopStreaming, demoRemaining, demoLimitReached, messagesUsed, maxMessages]);
   473	}
     1	import type { ChatArtifact, Citation } from '../types';
     2	import { mapArtifactPayload, mapCitationPayload, PROXY_BASE } from './api';
     3	
     4	type TokenPayload = { text: string };
     5	type CitationPayload = {
     6	  ref_index: number;
     7	  chunk_id: string;
     8	  page: number;
     9	  page_end?: number;
    10	  bboxes: { x: number; y: number; w: number; h: number; page?: number }[];
    11	  text_snippet: string;
    12	  focus_snippet?: string;
    13	  offset: number;
    14	};
    15	type CitationEventPayload = CitationPayload & {
    16	  document_id?: string;
    17	  document_filename?: string;
    18	  confidence_score?: number;
    19	  context_text?: string;
    20	  retrieval_modality?: string;
    21	};
    22	type ErrorPayload = { code: string; message: string; status?: number };
    23	type DonePayload = { message_id: string; can_continue?: boolean; continuation_count?: number };
    24	type ToolStatusPayload = { message: string };
    25	type AnswerRepairedPayload = { text: string; citations: Citation[]; verification?: unknown };
    26	
    27	async function _processSSEStream(
    28	  reader: ReadableStreamDefaultReader<Uint8Array>,
    29	  onToken: (p: TokenPayload) => void,
    30	  onCitation: (c: Citation) => void,
    31	  onError: (e: ErrorPayload) => void,
    32	  onDone: (d: DonePayload) => void,
    33	  onTruncated?: () => void,
    34	  onArtifact?: (artifact: ChatArtifact) => void,
    35	  onToolStatus?: (status: ToolStatusPayload) => void,
    36	  onAnswerRepaired?: (payload: AnswerRepairedPayload) => void,
    37	  onCitationsRefined?: (citations: Citation[]) => void,
    38	  signal?: AbortSignal,
    39	) {
    40	  const decoder = new TextDecoder('utf-8');
    41	  let buffer = '';
    42	  let receivedDone = false;
    43	  let receivedTerminalError = false;
    44	
    45	  try {
    46	    while (true) {
    47	      const { done, value } = await reader.read();
    48	      if (done) break;
    49	      buffer += decoder.decode(value, { stream: true });
    50	
    51	      let boundary: number;
    52	      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
    53	        const rawEvent = buffer.slice(0, boundary);
    54	        buffer = buffer.slice(boundary + 2);
    55	
    56	        const lines = rawEvent.split('\n');
    57	        let eventName = 'message';
    58	        let dataStr = '';
    59	        for (const line of lines) {
    60	          if (line.startsWith('event:')) {
    61	            eventName = line.replace('event:', '').trim();
    62	          } else if (line.startsWith('data:')) {
    63	            dataStr += line.replace('data:', '').trim();
    64	          }
    65	        }
    66	
    67	        if (!dataStr) continue;
    68	        try {
    69	          const data = JSON.parse(dataStr) as Record<string, unknown>;
    70	          switch (eventName) {
    71	            case 'token':
    72	              onToken({ text: typeof data.text === 'string' ? data.text : '' });
    73	              break;
    74	            case 'citation': {
    75	              const p = data as CitationEventPayload;
    76	              const c: Citation = {
    77	                refIndex: p.ref_index,
    78	                chunkId: p.chunk_id,
    79	                page: p.page,
    80	                pageEnd: typeof p.page_end === 'number' ? p.page_end : undefined,
    81	                bboxes: p.bboxes || [],
    82	                textSnippet: p.text_snippet || '',
    83	                focusSnippet: typeof p.focus_snippet === 'string' ? p.focus_snippet : undefined,
    84	                offset: p.offset ?? 0,
    85	                documentId: typeof p.document_id === 'string' ? p.document_id : undefined,
    86	                documentFilename: typeof p.document_filename === 'string' ? p.document_filename : undefined,
    87	                confidenceScore: typeof p.confidence_score === 'number' ? p.confidence_score : undefined,
    88	                contextText: typeof p.context_text === 'string' ? p.context_text : undefined,
    89	                retrievalModality: typeof p.retrieval_modality === 'string' ? p.retrieval_modality : undefined,
    90	              };
    91	              onCitation(c);
    92	              break; }
    93	            case 'error':
    94	              receivedTerminalError = true;
    95	              onError({
    96	                code: typeof data.code === 'string' ? data.code : 'unknown',
    97	                message: typeof data.message === 'string' ? data.message : 'Unknown error',
    98	              });
    99	              await reader.cancel().catch(() => {});
   100	              return;
   101	            case 'truncated':
   102	              onTruncated?.();
   103	              break;
   104	            case 'artifact':
   105	              onArtifact?.(mapArtifactPayload(data));
   106	              break;
   107	            case 'tool_status':
   108	              onToolStatus?.({ message: typeof data.message === 'string' ? data.message : '' });
   109	              break;
   110	            case 'answer_repaired':
   111	              onAnswerRepaired?.({
   112	                text: typeof data.text === 'string' ? data.text : '',
   113	                citations: Array.isArray(data.citations) ? data.citations.map(mapCitationPayload) : [],
   114	                verification: data.verification,
   115	              });
   116	              break;
   117	            case 'citations_refined':
   118	              // Text-preserving citation update (sentence-level focus added
   119	              // post-generation for cross-lingual / paraphrase answers).
   120	              onCitationsRefined?.(
   121	                Array.isArray(data.citations) ? data.citations.map(mapCitationPayload) : [],
   122	              );
   123	              break;
   124	            case 'done':
   125	              receivedDone = true;
   126	              onDone({
   127	                message_id: typeof data.message_id === 'string' ? data.message_id : '',
   128	                can_continue: data.can_continue === true,
   129	                continuation_count: typeof data.continuation_count === 'number' ? data.continuation_count : undefined,
   130	              });
   131	              break;
   132	            default:
   133	              // ignore pings and unknown events
   134	              break;
   135	          }
   136	        } catch (e) {
   137	          if (signal?.aborted) return;
   138	          receivedTerminalError = true;
   139	          onError({ code: 'parse_error', message: String(e) });
   140	          await reader.cancel().catch(() => {});
   141	          return;
   142	        }
   143	      }
   144	    }
   145	  } catch (e) {
   146	    if (signal?.aborted) return;
   147	    receivedTerminalError = true;
   148	    onError({ code: 'stream_error', message: String(e) });
   149	  }
   150	
   151	  if (!receivedDone && !receivedTerminalError && !signal?.aborted) {
   152	    onTruncated?.();
   153	    onDone({ message_id: '' });
   154	  }
   155	}
   156	
   157	export async function chatStream(
   158	  sessionId: string,
   159	  message: string,
   160	  onToken: (p: TokenPayload) => void,
   161	  onCitation: (c: Citation) => void,
   162	  onError: (e: ErrorPayload) => void,
   163	  onDone: (d: DonePayload) => void,
   164	  onTruncated?: () => void,
   165	  mode?: string,
   166	  locale?: string,
   167	  signal?: AbortSignal,
   168	  domainMode?: string | null,
   169	  onArtifact?: (artifact: ChatArtifact) => void,
   170	  onToolStatus?: (status: ToolStatusPayload) => void,
   171	  onAnswerRepaired?: (payload: AnswerRepairedPayload) => void,
   172	  onCitationsRefined?: (citations: Citation[]) => void,
   173	) {
   174	  const res = await fetch(`${PROXY_BASE}/api/sessions/${sessionId}/chat`, {
   175	    method: 'POST',
   176	    headers: { 'Content-Type': 'application/json' },
   177	    body: JSON.stringify({
   178	      message,
   179	      ...(mode ? { mode } : {}),
   180	      ...(locale ? { locale } : {}),
   181	      domain_mode: domainMode ?? null,
   182	    }),
   183	    signal,
   184	  });
   185	
   186	  if (!res.ok || !res.body) {
   187	    if (signal?.aborted) return;
   188	    const raw = await res.text().catch(() => '');
   189	    let code = 'http_error';
   190	    let message = `HTTP ${res.status}: ${raw}`;
   191	    try {
   192	      const parsed = JSON.parse(raw);
   193	      const d = parsed && typeof parsed === 'object' && 'detail' in parsed
   194	        ? (parsed as Record<string, unknown>).detail
   195	        : parsed;
   196	      if (d && typeof d === 'object') {
   197	        const detail = d as Record<string, unknown>;
   198	        if (typeof detail.error === 'string') code = detail.error;
   199	        if (typeof detail.message === 'string') message = detail.message;
   200	      }
   201	    } catch {
   202	      // leave http_error + raw message as fallback
   203	    }
   204	    onError({ code, message, status: res.status });
   205	    return;
   206	  }
   207	
   208	  const reader = res.body.getReader();
   209	  await _processSSEStream(reader, onToken, onCitation, onError, onDone, onTruncated, onArtifact, onToolStatus, onAnswerRepaired, onCitationsRefined, signal);
   210	}
   211	
   212	export async function continueStream(
   213	  sessionId: string,
   214	  messageId: string,
   215	  onToken: (p: TokenPayload) => void,
   216	  onCitation: (c: Citation) => void,
   217	  onError: (e: ErrorPayload) => void,
   218	  onDone: (d: DonePayload) => void,
   219	  onTruncated?: () => void,
   220	  mode?: string,
   221	  locale?: string,
   222	  signal?: AbortSignal,
   223	  onArtifact?: (artifact: ChatArtifact) => void,
   224	  onToolStatus?: (status: ToolStatusPayload) => void,
   225	  onAnswerRepaired?: (payload: AnswerRepairedPayload) => void,
   226	  onCitationsRefined?: (citations: Citation[]) => void,
   227	) {
   228	  const res = await fetch(`${PROXY_BASE}/api/sessions/${sessionId}/chat/continue`, {
   229	    method: 'POST',
   230	    headers: { 'Content-Type': 'application/json' },
   231	    body: JSON.stringify({
   232	      message_id: messageId || undefined,
   233	      ...(mode ? { mode } : {}),
   234	      ...(locale ? { locale } : {}),
   235	    }),
   236	    signal,
   237	  });
   238	
   239	  if (!res.ok || !res.body) {
   240	    if (signal?.aborted) return;
   241	    const raw = await res.text().catch(() => '');
   242	    let code = 'http_error';
   243	    let message = `HTTP ${res.status}: ${raw}`;
   244	    try {
   245	      const parsed = JSON.parse(raw);
   246	      const d = parsed && typeof parsed === 'object' && 'detail' in parsed
   247	        ? (parsed as Record<string, unknown>).detail
   248	        : parsed;
   249	      if (d && typeof d === 'object') {
   250	        const detail = d as Record<string, unknown>;
   251	        if (typeof detail.error === 'string') code = detail.error;
   252	        if (typeof detail.message === 'string') message = detail.message;
   253	      }
   254	    } catch {
   255	      // leave http_error + raw message as fallback
   256	    }
   257	    onError({ code, message, status: res.status });
   258	    return;
   259	  }
   260	
   261	  const reader = res.body.getReader();
   262	  await _processSSEStream(reader, onToken, onCitation, onError, onDone, onTruncated, onArtifact, onToolStatus, onAnswerRepaired, onCitationsRefined, signal);
   263	}
   150	  const res = await fetch(`${PROXY_BASE}/api/documents/${docId}/file-url`);
   151	  return handle(res);
   152	}
   153	
   154	export async function getConvertedFileUrl(docId: string): Promise<{ url: string; expires_in: number }> {
   155	  const res = await fetch(`${PROXY_BASE}/api/documents/${docId}/file-url?variant=converted`);
   156	  return handle(res);
   157	}
   158	
   159	export async function createSession(docId: string): Promise<{ session_id: string; document_id: string; title: string | null; created_at: string; demo_messages_used?: number }>
   160	{
   161	  const res = await fetch(`${PROXY_BASE}/api/documents/${docId}/sessions`, {
   162	    method: 'POST',
   163	  });
   164	  return handle(res);
   165	}
   166	
   167	export async function getMessages(sessionId: string): Promise<{ messages: Message[]; demo_messages_used?: number | null }> {
   168	  const res = await fetch(`${PROXY_BASE}/api/sessions/${sessionId}/messages`);
   169	  const data: { messages: Array<{ id?: string; share_anchor?: string; role: Message['role']; content: string; citations?: any[]; metadata_json?: any; created_at: string }>; demo_messages_used?: number | null } = await handle(res);
   170	
   171	  const mapped = (data.messages || []).map((m, idx) => {
   172	    const citations: Citation[] | undefined = m.citations
   173	      ? m.citations.map(mapCitationPayload)
   174	      : undefined;
   175	    const artifacts = Array.isArray(m.metadata_json?.artifacts)
   176	      ? m.metadata_json.artifacts.map(mapArtifactPayload)
   177	      : undefined;
   178	
   179	    return {
   180	      id: m.id ? `msg_${m.id}` : `msg_${idx}`,
   181	      role: m.role,
   182	      text: m.content,
   183	      citations,
   184	      artifacts,
   185	      createdAt: Date.parse(m.created_at),
   186	      backendId: m.id,
   187	      shareAnchor: m.share_anchor,
   188	    } as Message;
   189	  });
   190	
   191	  return { messages: mapped, demo_messages_used: data.demo_messages_used };
   192	}
   193	
   194	export interface DocumentJobDetail {
   195	  id: string;
   196	  document_id: string | null;
   197	  collection_id: string | null;
   198	  job_type: string;
   199	  status: string;
   200	  artifact: ChatArtifact;
   260	                status_code=429,
   261	                detail={
   262	                    "error": "DEMO_SESSION_RATE_LIMITED",
   263	                    "message": "Too many demo sessions created",
   264	                    "retry_after": 300,
   265	                },
   266	                headers={"Retry-After": "300"},
   267	            )
   268	        session_count = await db.execute(
   269	            select(func.count(ChatSession.id)).where(*_recent_demo_session_filter(document_id))
   270	        )
   271	        if session_count.scalar() >= DEMO_MAX_SESSIONS_PER_DOC:
   272	            raise HTTPException(
   273	                status_code=429,
   274	                detail={
   275	                    "error": "DEMO_SESSION_LIMIT_REACHED",
   276	                    "message": "Demo session limit reached",
   277	                    "limit": DEMO_MAX_SESSIONS_PER_DOC,
   278	                },
   279	            )
   280	
   281	    sess = ChatSession(document_id=document_id, user_id=user.id if user else None)
   282	    db.add(sess)
   283	    await db.commit()
   284	    await db.refresh(sess)
   285	
   286	    response = SessionResponse(
   287	        session_id=sess.id,
   288	        document_id=sess.document_id,
   289	        title=sess.title,
   290	        created_at=sess.created_at,
   291	    )
   292	
   293	    # For anonymous demo sessions, include used message count so frontend
   294	    # can display the correct remaining count across page refreshes
   295	    # (limit is per IP per document).
   296	    if user is None and doc.demo_slug:
   297	        client_ip = get_client_ip(request)
   298	        used = await demo_message_tracker.get_count(_demo_message_key(client_ip, doc.id))
   299	        return JSONResponse(
   300	            status_code=201,
   301	            content={**response.model_dump(mode="json"), "demo_messages_used": used},
   302	        )
   303	
   304	    return response
   305	
   306	
   307	@chat_router.get("/sessions/{session_id}/messages", response_model=SessionMessagesResponse)
   308	async def get_session_messages(
   309	    session_id: uuid.UUID,
   310	    request: Request,
   311	    user: Optional[User] = Depends(get_current_user_optional),
   312	    db: AsyncSession = Depends(get_db_session),
   313	):
   314	    # Verify session access
   315	    session = await verify_session_access(session_id, user, db)
   316	    if not session:
   317	        raise HTTPException(status_code=404, detail=SESSION_NOT_FOUND_DETAIL)
   318	
   319	    rows = await db.execute(
   320	        select(Message).where(Message.session_id == session_id).order_by(asc(Message.created_at))
   321	    )
   322	    items = []
   323	    for m in rows.scalars():
   324	        items.append(
   325	            ChatMessageResponse(
   326	                id=m.id,
   327	                share_anchor=message_share_anchor(m.id),
   328	                role=m.role,
   329	                content=m.content,
   330	                citations=m.citations,
   331	                metadata_json=getattr(m, "metadata_json", {}) or {},
   332	                created_at=m.created_at,
   333	            )
   334	        )
   335	    # Anonymous demo sessions: surface the used count so the frontend can
   336	    # restore the counter when it reuses a stored session (see create-session).
   337	    demo_messages_used = None
   338	    if session.user_id is None and session.document and session.document.demo_slug:
   339	        client_ip = get_client_ip(request)
   340	        demo_messages_used = await demo_message_tracker.get_count(
   341	            _demo_message_key(client_ip, session.document_id)
   342	        )
   343	
   344	    return SessionMessagesResponse(messages=items, demo_messages_used=demo_messages_used)
   345	
   346	
   347	@chat_router.post("/sessions/{session_id}/chat")
   348	async def chat_stream(
   349	    session_id: uuid.UUID,
   350	    body: ChatRequest,
   351	    request: Request,
   352	    user: Optional[User] = Depends(get_current_user_optional),
   353	    db: AsyncSession = Depends(get_db_session),
   354	):
   355	    # Verify session access
   356	    session = await verify_session_access(session_id, user, db)
   357	    if not session:
   358	        raise HTTPException(status_code=404, detail=SESSION_NOT_FOUND_DETAIL)
   359	
   360	    # Block chat if document is not fully processed
   361	    if session.document and session.document.status != "ready":
   362	        raise HTTPException(
   363	            status_code=409,
   364	            detail={
   365	                "error": "DOCUMENT_PROCESSING",
   375	            log_security_event("demo_rate_limit", ip=client_ip, session_id=session_id)
   376	            raise HTTPException(
   377	                status_code=429,
   378	                detail={
   379	                    "error": "RATE_LIMITED",
   380	                    "message": "Rate limit exceeded",
   381	                    "retry_after": 60,
   382	                },
   383	                headers={"Retry-After": "60"},
   384	            )
   385	    else:
   386	        # Rate limit authenticated users (30 req/min per user)
   387	        if not await auth_chat_limiter.is_allowed(str(user.id)):
   388	            raise HTTPException(
   389	                status_code=429,
   390	                detail={
   391	                    "error": "RATE_LIMITED",
   392	                    "message": "Rate limit exceeded",
   393	                    "retry_after": 60,
   394	                },
   395	                headers={"Retry-After": "60"},
   396	            )
   397	
   398	    # Enforce message limit for anonymous users on demo documents.
   399	    # Tracker key is scoped per (IP, document) and survives session recreation.
   400	    if user is None and session.document and session.document.demo_slug:
   401	        allowed, _count = await demo_message_tracker.check_and_increment(
   402	            _demo_message_key(client_ip, session.document_id), DEMO_MESSAGE_LIMIT
   403	        )
   404	        if not allowed:
   405	            log_security_event("demo_message_limit", ip=client_ip, document_id=session.document_id)
   406	            raise HTTPException(
   407	                status_code=429,
   408	                detail={
   409	                    "error": "DEMO_MESSAGE_LIMIT_REACHED",
   410	                    "message": "Demo message limit reached",
   411	                    "limit": DEMO_MESSAGE_LIMIT,
   412	                },
   413	            )
   414	
   415	    # If authenticated, ensure sufficient credits before opening stream
   416	    if user is not None:
   417	        from app.services.credit_service import ensure_monthly_credits
   418	        await ensure_monthly_credits(db, user)
   419	        await db.commit()
   420	        # Use mode-specific estimated cost for pre-check (actual pre-debit happens in chat_service)
   421	        effective_mode = body.mode or "balanced"
   422	        await enforce_free_mode_limits(db, user, effective_mode)
   423	        estimated_cost = credit_service.get_estimated_cost(effective_mode)
   424	        balance = await credit_service.get_user_credits(db, user.id)
   425	        if balance < estimated_cost:
   426	            raise HTTPException(
   427	                status_code=402,
   428	                detail={
   429	                    "error": "INSUFFICIENT_CREDITS",
   430	                    "message": "Insufficient credits",
   431	                    "required": estimated_cost,
   432	                    "balance": balance,
   433	                },
   434	            )
   435	
   436	    async def event_generator() -> AsyncGenerator[str, None]:
   437	        async for ev in chat_service.chat_stream(
   438	            session_id, body.message, db, user=user, locale=body.locale, mode=body.mode,
   439	            domain_mode=body.domain_mode
   440	        ):
   441	            # Format per SSE: event: <type>\ndata: {json}\n\n
   442	            line = f"event: {ev['event']}\n"
   443	            payload = json.dumps(ev.get("data", {}), ensure_ascii=False)
   444	            data_line = f"data: {payload}\n\n"
   445	            yield line + data_line
   446	
   447	    return StreamingResponse(
   448	        event_generator(),
   449	        media_type="text/event-stream",
   450	        headers={
   451	            "Cache-Control": "no-cache, no-transform",
   452	            "X-Accel-Buffering": "no",
   453	            "Connection": "keep-alive",
   454	        },
   455	    )
   456	
   457	
   458	@chat_router.post("/sessions/{session_id}/chat/continue")
   459	async def chat_continue(
   460	    session_id: uuid.UUID,
   461	    body: ContinueRequest,
   462	    request: Request,
   463	    user: Optional[User] = Depends(get_current_user_optional),
   464	    db: AsyncSession = Depends(get_db_session),
   465	):
   466	    # Verify session access
   467	    session = await verify_session_access(session_id, user, db)
   468	    if not session:
   469	        raise HTTPException(status_code=404, detail=SESSION_NOT_FOUND_DETAIL)
   470	
   471	    # Block if document is not ready
   472	    if session.document and session.document.status != "ready":
   473	        raise HTTPException(
   474	            status_code=409,
   475	            detail={
   476	                "error": "DOCUMENT_PROCESSING",
   477	                "message": "Document is still being processed",
   478	                "status": session.document.status,
   479	            },
   480	        )
   481	
   482	    # Rate limit (same as chat_stream)
   483	    if user is None:
   484	        client_ip = get_client_ip(request)
   485	        if not await demo_chat_limiter.is_allowed(client_ip):
   486	            log_security_event("demo_rate_limit", ip=client_ip, session_id=session_id)
   487	            raise HTTPException(
   488	                status_code=429,
   489	                detail={
   490	                    "error": "RATE_LIMITED",
   491	                    "message": "Rate limit exceeded",
   492	                    "retry_after": 60,
   493	                },
   494	                headers={"Retry-After": "60"},
   495	            )
   496	    else:
   497	        if not await auth_chat_limiter.is_allowed(str(user.id)):
   498	            raise HTTPException(
   499	                status_code=429,
   500	                detail={
   501	                    "error": "RATE_LIMITED",
   502	                    "message": "Rate limit exceeded",
   503	                    "retry_after": 60,
   504	                },
   505	                headers={"Retry-After": "60"},
   506	            )
   507	
   508	    # Demo message limit (continuations count against it)
   509	    if user is None and session.document and session.document.demo_slug:
   510	        client_ip = get_client_ip(request)
   511	        allowed, _count = await demo_message_tracker.check_and_increment(
   512	            _demo_message_key(client_ip, session.document_id), DEMO_MESSAGE_LIMIT
   513	        )
   514	        if not allowed:
   515	            log_security_event("demo_message_limit", ip=client_ip, document_id=session.document_id)
   516	            raise HTTPException(
   517	                status_code=429,
   518	                detail={
   519	                    "error": "DEMO_MESSAGE_LIMIT_REACHED",
   520	                    "message": "Demo message limit reached",
   521	                    "limit": DEMO_MESSAGE_LIMIT,
   522	                },
   523	            )
   524	
   525	    # Check continuation limit
   526	    msg_id = uuid.UUID(body.message_id) if body.message_id else None
   527	    if msg_id:
   528	        from sqlalchemy import select as sa_select
   529	        msg_row = await db.execute(sa_select(Message).where(Message.id == msg_id))
   530	        msg = msg_row.scalar_one_or_none()
   531	    else:
   532	        msg_row = await db.execute(
   533	            select(Message)
   534	            .where(Message.session_id == session_id, Message.role == "assistant")
   535	            .order_by(Message.created_at.desc())
   536	            .limit(1)
   537	        )
   538	        msg = msg_row.scalar_one_or_none()
   539	
   540	    if not msg:
   541	        raise HTTPException(status_code=404, detail=MESSAGE_NOT_FOUND_DETAIL)
   542	
   543	    if msg.continuation_count >= settings.MAX_CONTINUATIONS_PER_MESSAGE:
   544	        raise HTTPException(
   545	            status_code=400,
   546	            detail={
   547	                "error": "CONTINUATION_LIMIT",
   548	                "message": "Maximum continuations reached",
   549	                "max": settings.MAX_CONTINUATIONS_PER_MESSAGE,
   550	            },
   551	        )
   552	
   553	    # Credit pre-check for authenticated users
   554	    if user is not None:
   555	        from app.services.credit_service import ensure_monthly_credits
   556	        await ensure_monthly_credits(db, user)
   557	        await db.commit()
   558	        effective_mode = body.mode or "balanced"
   559	        await enforce_free_mode_limits(db, user, effective_mode)
   560	        estimated_cost = credit_service.get_estimated_cost(effective_mode)
   561	        balance = await credit_service.get_user_credits(db, user.id)
   562	        if balance < estimated_cost:
   563	            raise HTTPException(
   564	                status_code=402,
   565	                detail={
   566	                    "error": "INSUFFICIENT_CREDITS",
   567	                    "message": "Insufficient credits",
   568	                    "required": estimated_cost,
   569	                    "balance": balance,
   570	                },
   571	            )
   572	
   573	    async def event_generator() -> AsyncGenerator[str, None]:
   574	        async for ev in chat_service.continue_stream(
   575	            session_id, msg_id, db, user=user, locale=body.locale, mode=body.mode

exec
/bin/zsh -lc "nl -ba frontend/src/lib/sse.ts | sed -n '45,215p'
nl -ba frontend/src/lib/sse.ts | sed -n '212,275p'
nl -ba frontend/src/lib/useChatSession.ts | sed -n '1,200p'
nl -ba frontend/src/components/ChatPanel.tsx | sed -n '1,280p'
rg -n \"regenerateLastResponse|continueGenerating|sendMessage\\(\" frontend/src/components frontend/src/app frontend/src/lib -g '*.tsx' -g '*.ts'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
    45	  try {
    46	    while (true) {
    47	      const { done, value } = await reader.read();
    48	      if (done) break;
    49	      buffer += decoder.decode(value, { stream: true });
    50	
    51	      let boundary: number;
    52	      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
    53	        const rawEvent = buffer.slice(0, boundary);
    54	        buffer = buffer.slice(boundary + 2);
    55	
    56	        const lines = rawEvent.split('\n');
    57	        let eventName = 'message';
    58	        let dataStr = '';
    59	        for (const line of lines) {
    60	          if (line.startsWith('event:')) {
    61	            eventName = line.replace('event:', '').trim();
    62	          } else if (line.startsWith('data:')) {
    63	            dataStr += line.replace('data:', '').trim();
    64	          }
    65	        }
    66	
    67	        if (!dataStr) continue;
    68	        try {
    69	          const data = JSON.parse(dataStr) as Record<string, unknown>;
    70	          switch (eventName) {
    71	            case 'token':
    72	              onToken({ text: typeof data.text === 'string' ? data.text : '' });
    73	              break;
    74	            case 'citation': {
    75	              const p = data as CitationEventPayload;
    76	              const c: Citation = {
    77	                refIndex: p.ref_index,
    78	                chunkId: p.chunk_id,
    79	                page: p.page,
    80	                pageEnd: typeof p.page_end === 'number' ? p.page_end : undefined,
    81	                bboxes: p.bboxes || [],
    82	                textSnippet: p.text_snippet || '',
    83	                focusSnippet: typeof p.focus_snippet === 'string' ? p.focus_snippet : undefined,
    84	                offset: p.offset ?? 0,
    85	                documentId: typeof p.document_id === 'string' ? p.document_id : undefined,
    86	                documentFilename: typeof p.document_filename === 'string' ? p.document_filename : undefined,
    87	                confidenceScore: typeof p.confidence_score === 'number' ? p.confidence_score : undefined,
    88	                contextText: typeof p.context_text === 'string' ? p.context_text : undefined,
    89	                retrievalModality: typeof p.retrieval_modality === 'string' ? p.retrieval_modality : undefined,
    90	              };
    91	              onCitation(c);
    92	              break; }
    93	            case 'error':
    94	              receivedTerminalError = true;
    95	              onError({
    96	                code: typeof data.code === 'string' ? data.code : 'unknown',
    97	                message: typeof data.message === 'string' ? data.message : 'Unknown error',
    98	              });
    99	              await reader.cancel().catch(() => {});
   100	              return;
   101	            case 'truncated':
   102	              onTruncated?.();
   103	              break;
   104	            case 'artifact':
   105	              onArtifact?.(mapArtifactPayload(data));
   106	              break;
   107	            case 'tool_status':
   108	              onToolStatus?.({ message: typeof data.message === 'string' ? data.message : '' });
   109	              break;
   110	            case 'answer_repaired':
   111	              onAnswerRepaired?.({
   112	                text: typeof data.text === 'string' ? data.text : '',
   113	                citations: Array.isArray(data.citations) ? data.citations.map(mapCitationPayload) : [],
   114	                verification: data.verification,
   115	              });
   116	              break;
   117	            case 'citations_refined':
   118	              // Text-preserving citation update (sentence-level focus added
   119	              // post-generation for cross-lingual / paraphrase answers).
   120	              onCitationsRefined?.(
   121	                Array.isArray(data.citations) ? data.citations.map(mapCitationPayload) : [],
   122	              );
   123	              break;
   124	            case 'done':
   125	              receivedDone = true;
   126	              onDone({
   127	                message_id: typeof data.message_id === 'string' ? data.message_id : '',
   128	                can_continue: data.can_continue === true,
   129	                continuation_count: typeof data.continuation_count === 'number' ? data.continuation_count : undefined,
   130	              });
   131	              break;
   132	            default:
   133	              // ignore pings and unknown events
   134	              break;
   135	          }
   136	        } catch (e) {
   137	          if (signal?.aborted) return;
   138	          receivedTerminalError = true;
   139	          onError({ code: 'parse_error', message: String(e) });
   140	          await reader.cancel().catch(() => {});
   141	          return;
   142	        }
   143	      }
   144	    }
   145	  } catch (e) {
   146	    if (signal?.aborted) return;
   147	    receivedTerminalError = true;
   148	    onError({ code: 'stream_error', message: String(e) });
   149	  }
   150	
   151	  if (!receivedDone && !receivedTerminalError && !signal?.aborted) {
   152	    onTruncated?.();
   153	    onDone({ message_id: '' });
   154	  }
   155	}
   156	
   157	export async function chatStream(
   158	  sessionId: string,
   159	  message: string,
   160	  onToken: (p: TokenPayload) => void,
   161	  onCitation: (c: Citation) => void,
   162	  onError: (e: ErrorPayload) => void,
   163	  onDone: (d: DonePayload) => void,
   164	  onTruncated?: () => void,
   165	  mode?: string,
   166	  locale?: string,
   167	  signal?: AbortSignal,
   168	  domainMode?: string | null,
   169	  onArtifact?: (artifact: ChatArtifact) => void,
   170	  onToolStatus?: (status: ToolStatusPayload) => void,
   171	  onAnswerRepaired?: (payload: AnswerRepairedPayload) => void,
   172	  onCitationsRefined?: (citations: Citation[]) => void,
   173	) {
   174	  const res = await fetch(`${PROXY_BASE}/api/sessions/${sessionId}/chat`, {
   175	    method: 'POST',
   176	    headers: { 'Content-Type': 'application/json' },
   177	    body: JSON.stringify({
   178	      message,
   179	      ...(mode ? { mode } : {}),
   180	      ...(locale ? { locale } : {}),
   181	      domain_mode: domainMode ?? null,
   182	    }),
   183	    signal,
   184	  });
   185	
   186	  if (!res.ok || !res.body) {
   187	    if (signal?.aborted) return;
   188	    const raw = await res.text().catch(() => '');
   189	    let code = 'http_error';
   190	    let message = `HTTP ${res.status}: ${raw}`;
   191	    try {
   192	      const parsed = JSON.parse(raw);
   193	      const d = parsed && typeof parsed === 'object' && 'detail' in parsed
   194	        ? (parsed as Record<string, unknown>).detail
   195	        : parsed;
   196	      if (d && typeof d === 'object') {
   197	        const detail = d as Record<string, unknown>;
   198	        if (typeof detail.error === 'string') code = detail.error;
   199	        if (typeof detail.message === 'string') message = detail.message;
   200	      }
   201	    } catch {
   202	      // leave http_error + raw message as fallback
   203	    }
   204	    onError({ code, message, status: res.status });
   205	    return;
   206	  }
   207	
   208	  const reader = res.body.getReader();
   209	  await _processSSEStream(reader, onToken, onCitation, onError, onDone, onTruncated, onArtifact, onToolStatus, onAnswerRepaired, onCitationsRefined, signal);
   210	}
   211	
   212	export async function continueStream(
   213	  sessionId: string,
   214	  messageId: string,
   215	  onToken: (p: TokenPayload) => void,
   212	export async function continueStream(
   213	  sessionId: string,
   214	  messageId: string,
   215	  onToken: (p: TokenPayload) => void,
   216	  onCitation: (c: Citation) => void,
   217	  onError: (e: ErrorPayload) => void,
   218	  onDone: (d: DonePayload) => void,
   219	  onTruncated?: () => void,
   220	  mode?: string,
   221	  locale?: string,
   222	  signal?: AbortSignal,
   223	  onArtifact?: (artifact: ChatArtifact) => void,
   224	  onToolStatus?: (status: ToolStatusPayload) => void,
   225	  onAnswerRepaired?: (payload: AnswerRepairedPayload) => void,
   226	  onCitationsRefined?: (citations: Citation[]) => void,
   227	) {
   228	  const res = await fetch(`${PROXY_BASE}/api/sessions/${sessionId}/chat/continue`, {
   229	    method: 'POST',
   230	    headers: { 'Content-Type': 'application/json' },
   231	    body: JSON.stringify({
   232	      message_id: messageId || undefined,
   233	      ...(mode ? { mode } : {}),
   234	      ...(locale ? { locale } : {}),
   235	    }),
   236	    signal,
   237	  });
   238	
   239	  if (!res.ok || !res.body) {
   240	    if (signal?.aborted) return;
   241	    const raw = await res.text().catch(() => '');
   242	    let code = 'http_error';
   243	    let message = `HTTP ${res.status}: ${raw}`;
   244	    try {
   245	      const parsed = JSON.parse(raw);
   246	      const d = parsed && typeof parsed === 'object' && 'detail' in parsed
   247	        ? (parsed as Record<string, unknown>).detail
   248	        : parsed;
   249	      if (d && typeof d === 'object') {
   250	        const detail = d as Record<string, unknown>;
   251	        if (typeof detail.error === 'string') code = detail.error;
   252	        if (typeof detail.message === 'string') message = detail.message;
   253	      }
   254	    } catch {
   255	      // leave http_error + raw message as fallback
   256	    }
   257	    onError({ code, message, status: res.status });
   258	    return;
   259	  }
   260	
   261	  const reader = res.body.getReader();
   262	  await _processSSEStream(reader, onToken, onCitation, onError, onDone, onTruncated, onArtifact, onToolStatus, onAnswerRepaired, onCitationsRefined, signal);
   263	}
     1	"use client";
     2	
     3	import { useEffect, useState } from 'react';
     4	import { ApiError, createSession, getMessages, listSessions } from './api';
     5	import { useDocTalkStore } from '../store';
     6	import { clearDemoSession, readDemoSession, writeDemoSession } from './demoSessionStorage';
     7	
     8	interface UseChatSessionResult {
     9	  sessionError: unknown | null;
    10	}
    11	
    12	export function useChatSession(documentId: string | undefined): UseChatSessionResult {
    13	  const [sessionError, setSessionError] = useState<unknown | null>(null);
    14	
    15	  const documentStatus = useDocTalkStore((s) => s.documentStatus);
    16	  const {
    17	    setSessions,
    18	    setSessionId,
    19	    setMessages,
    20	    setDemoMessagesUsed,
    21	    setDemoRestoredUserMsgCount,
    22	    addSession,
    23	  } = useDocTalkStore();
    24	
    25	  useEffect(() => {
    26	    if (!documentId || documentStatus !== 'ready') return;
    27	
    28	    setSessionError(null);
    29	    // Reset the demo counter baseline synchronously here — NOT in
    30	    // clearDocumentTransientState (Codex r2 #2 finding: that function is
    31	    // ALSO invoked by useDocumentLoader's effect, whose deps include the
    32	    // locale-sensitive `t`/`tOr`, so a same-document language change would
    33	    // zero the counter while the transcript stayed, reintroducing the
    34	    // TTL-hard-lock bug). This effect's own deps (below) exclude locale —
    35	    // it only reruns on a real documentId transition — and always
    36	    // re-establishes server truth right after via adopt-or-create in the
    37	    // same run, so the momentary reset here is safe.
    38	    setDemoMessagesUsed(0);
    39	    setDemoRestoredUserMsgCount(0);
    40	    // Clear the PREVIOUS document's session/messages/sessions synchronously
    41	    // too (Codex r3 breakage 3), not just the counter. Without this, a
    42	    // transient adoption failure for document B left document A's still-
    43	    // truthy sessionId/messages sitting in the store; DocumentReaderPageClient
    44	    // renders `documentStatus === 'ready' && sessionId ? <ChatPanel/> :
    45	    // sessionErrorCopy ? <error/> : ...` — checking sessionId BEFORE the
    46	    // error — so it kept showing A's stale chat instead of B's retryable
    47	    // error. This also closes a pre-existing (unrelated) stale-chat flash on
    48	    // any in-app document transition, since A's session/messages previously
    49	    // lingered in the store until B's adopt/create resolved. The brief
    50	    // sessionId===null window this creates renders a benign "initializing
    51	    // chat" placeholder (DocumentReaderPageClient's final else branch), not
    52	    // a blank/broken state.
    53	    setSessionId(null);
    54	    setMessages([]);
    55	    setSessions([]);
    56	    let cancelled = false;
    57	
    58	    (async () => {
    59	      let sessionReady = false;
    60	
    61	      // Anonymous demo: re-adopt the session we created earlier this browser
    62	      // session instead of burning a create per page view (5-per-5min IP cap).
    63	      // Safe for authed users too: if a signed-in caller inherits a stale key
    64	      // from an earlier anonymous visit, `getMessages` 404s for them (the
    65	      // session is anon-owned; `verify_session_access` in chat.py:157-163
    66	      // only returns it to `user is None` callers), so the catch below
    67	      // clears the key and falls through to the normal listSessions flow.
    68	      const storedDemoSession = readDemoSession(documentId);
    69	      if (storedDemoSession) {
    70	        try {
    71	          const msgsData = await getMessages(storedDemoSession);
    72	          if (cancelled) return;
    73	          setSessionId(storedDemoSession);
    74	          // Populate the sessions list (not []) so SessionDropdown shows the
    75	          // adopted session instead of an empty "New Chat"-only placeholder.
    76	          // getMessages doesn't return session metadata, so derive
    77	          // created_at/last_activity_at from the fetched messages' own
    78	          // timestamps (falling back to now if there are none yet).
    79	          const firstMsgAt = msgsData.messages[0]?.createdAt;
    80	          const lastMsgAt = msgsData.messages[msgsData.messages.length - 1]?.createdAt;
    81	          const createdAt = firstMsgAt != null ? new Date(firstMsgAt).toISOString() : new Date().toISOString();
    82	          const lastActivityAt = lastMsgAt != null ? new Date(lastMsgAt).toISOString() : createdAt;
    83	          setSessions([{
    84	            session_id: storedDemoSession,
    85	            title: null,
    86	            message_count: msgsData.messages.length,
    87	            created_at: createdAt,
    88	            last_activity_at: lastActivityAt,
    89	          }]);
    90	          setMessages(msgsData.messages);
    91	          // Baseline model (useChatStream.ts): totalUsed = demoMessagesUsed
    92	          // (server-known usage AS OF THIS RESTORE) + messages sent locally
    93	          // since then. demoRestoredUserMsgCount records how many of the
    94	          // transcript's user messages are already covered by
    95	          // demoMessagesUsed, so useChatStream only counts NEW ones on top.
    96	          // demoMessagesUsed is the raw server value — NOT subtracted — so a
    97	          // restore always converges to server truth, including when the
    98	          // 24h Redis window has expired or the IP changed (server reports
    99	          // 0 even though the transcript has old messages): that previously
   100	          // made the UI hard-lock a user the backend would actually allow.
   101	          const restoredUserMsgCount = msgsData.messages.filter((m) => m.role === 'user').length;
   102	          setDemoRestoredUserMsgCount(restoredUserMsgCount);
   103	          setDemoMessagesUsed(msgsData.demo_messages_used ?? 0);
   104	          return; // adopted — skip listSessions/createSession entirely
   105	        } catch (e) {
   106	          const status = e instanceof ApiError ? e.status : null;
   107	          if (status === 404 || status === 403) {
   108	            // Confirmed gone or inaccessible (pruned by nightly cleanup, or
   109	            // an authed caller inheriting an anon-owned key) — clear the
   110	            // pointer and fall through to the normal listSessions/
   111	            // createSession flow below.
   112	            clearDemoSession(documentId);
   113	          } else {
   114	            // Transient failure (network blip, 5xx) — the pointer is still
   115	            // valid and the session most likely still exists. Falling
   116	            // through to createSession here would silently orphan it:
   117	            // listSessions always returns [] for anon demo, so createSession
   118	            // would succeed and overwrite the still-good pointer (Codex r2
   119	            // #3 repro). Surface a retryable error and stop instead — the
   120	            // reader already renders an error state for sessionError, and a
   121	            // reload re-runs this same effect from the top.
   122	            if (!cancelled) setSessionError(e);
   123	            return;
   124	          }
   125	        }
   126	      }
   127	
   128	      try {
   129	        const sessionsData = await listSessions(documentId);
   130	        if (cancelled) return;
   131	
   132	        setSessions(sessionsData.sessions);
   133	        if (sessionsData.sessions.length > 0) {
   134	          const latest = sessionsData.sessions[0];
   135	          setSessionId(latest.session_id);
   136	          const msgsData = await getMessages(latest.session_id);
   137	          if (!cancelled) setMessages(msgsData.messages);
   138	          sessionReady = true;
   139	        }
   140	      } catch (e) {
   141	        console.warn('Failed to load sessions, falling back to create:', e);
   142	      }
   143	
   144	      if (!sessionReady && !cancelled) {
   145	        try {
   146	          const s = await createSession(documentId);
   147	          if (cancelled) return;
   148	
   149	          setSessionId(s.session_id);
   150	          if (s.demo_messages_used != null) {
   151	            // Fresh session, empty transcript — nothing restored yet, so the
   152	            // baseline is 0 and every subsequent local user message counts.
   153	            setDemoRestoredUserMsgCount(0);
   154	            setDemoMessagesUsed(s.demo_messages_used);
   155	            writeDemoSession(documentId, s.session_id);
   156	          }
   157	
   158	          const now = s.created_at || new Date().toISOString();
   159	          addSession({
   160	            session_id: s.session_id,
   161	            title: null,
   162	            message_count: 0,
   163	            created_at: now,
   164	            last_activity_at: now,
   165	          });
   166	
   167	          setMessages([]);
   168	        } catch (e) {
   169	          const expectedRateLimit = e instanceof ApiError && (e.code === 'DEMO_SESSION_RATE_LIMITED' || e.status === 429);
   170	          if (!expectedRateLimit) {
   171	            console.error('Failed to create session:', e);
   172	          }
   173	          if (!cancelled) setSessionError(e);
   174	        }
   175	      }
   176	    })();
   177	
   178	    return () => {
   179	      cancelled = true;
   180	    };
   181	  }, [documentId, documentStatus, setSessions, setSessionId, setMessages, setDemoMessagesUsed, setDemoRestoredUserMsgCount, addSession]);
   182	
   183	  return { sessionError };
   184	}
nl: frontend/src/components/ChatPanel.tsx: No such file or directory
frontend/src/lib/useChatStream.ts:35:  regenerateLastResponse: () => Promise<void>;
frontend/src/lib/useChatStream.ts:36:  continueGenerating: () => Promise<void>;
frontend/src/lib/useChatStream.ts:290:  // shared `handleStreamError` (used by regenerateLastResponse to trigger a
frontend/src/lib/useChatStream.ts:369:  const regenerateLastResponse = useCallback(async () => {
frontend/src/lib/useChatStream.ts:410:  const continueGenerating = useCallback(async () => {
frontend/src/lib/useChatStream.ts:465:    regenerateLastResponse,
frontend/src/lib/useChatStream.ts:466:    continueGenerating,
frontend/src/lib/useChatStream.ts:472:  }), [sendMessage, regenerateLastResponse, continueGenerating, stopStreaming, demoRemaining, demoLimitReached, messagesUsed, maxMessages]);
frontend/src/components/Chat/ChatPanel.tsx:164:    regenerateLastResponse,
frontend/src/components/Chat/ChatPanel.tsx:165:    continueGenerating,
frontend/src/components/Chat/ChatPanel.tsx:218:      void sendMessage(initialQuestion).then((sent) => {
frontend/src/components/Chat/ChatPanel.tsx:302:    const sent = await sendMessage(input);
frontend/src/components/Chat/ChatPanel.tsx:308:    void sendMessage(question).then((sent) => {
frontend/src/components/Chat/ChatPanel.tsx:316:      void sendMessage(input).then((sent) => {
frontend/src/components/Chat/ChatPanel.tsx:444:  // arrow functions `() => void regenerateLastResponse()` / `() => void
frontend/src/components/Chat/ChatPanel.tsx:445:  // continueGenerating()` / `(msg) => void handleShareAnswer(msg)` were
frontend/src/components/Chat/ChatPanel.tsx:457:    void regenerateLastResponse();
frontend/src/components/Chat/ChatPanel.tsx:458:  }, [regenerateLastResponse]);
frontend/src/components/Chat/ChatPanel.tsx:460:    void continueGenerating();
frontend/src/components/Chat/ChatPanel.tsx:461:  }, [continueGenerating]);
frontend/src/components/Chat/MessageBubble.tsx:401:            title={t('chat.continueGenerating')}
frontend/src/components/Chat/MessageBubble.tsx:404:            {t('chat.continueGenerating')}

exec
/bin/zsh -lc "git show --stat --oneline 2b85cef && git show --stat --oneline fc02b86 && git show --stat --oneline ffe2461 && git diff --check f594007..ffe2461
rg -n \"useChatStream|reanchorDemoCounter|demoMessagesUsed|useChatSession\" frontend -g '*test*' -g '*spec*' || true
nl -ba frontend/src/components/Chat/ChatPanel.tsx | sed -n '140,235p'
nl -ba frontend/src/components/Chat/ChatPanel.tsx | sed -n '285,330p'
nl -ba frontend/src/components/Chat/ChatPanel.tsx | sed -n '430,470p'
stat -f '%Sm %z %N' .collab/reviews/2026-08-02-p0-demo-retune-codex-r4.md 2>/dev/null || true
ps -ax -o pid=,command= | rg 'codex exec|p0-demo-retune-codex-r4' || true" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
2b85cef fix(demo): COMMIT-1 — replace regen/continue rollback with authoritative re-anchor (Codex r3)
 frontend/src/lib/useChatStream.ts | 163 ++++++++++++++++++++++++--------------
 1 file changed, 105 insertions(+), 58 deletions(-)
fc02b86 fix(demo): COMMIT-2 — adoption state dominates rendering, not just the counter (Codex r3)
 frontend/src/lib/useChatSession.ts | 16 ++++++++++++++++
 frontend/src/store/index.ts        |  4 ++--
 2 files changed, 18 insertions(+), 2 deletions(-)
ffe2461 fix(demo): guard reanchorDemoCounter against a late-resolving unmount race
 frontend/src/lib/useChatStream.ts | 9 +++++++++
 1 file changed, 9 insertions(+)
   140	
   141	export default function ChatPanel({ sessionId, onCitationClick, onPreviewLayoutTranslation, maxUserMessages, suggestedQuestions, initialQuestion, onOpenSettings, hasCustomInstructions, userPlan, autoSubmitInitialQuestion = false, supportsCustomInstructions = true }: ChatPanelProps) {
   142	  const messages = useDocTalkStore((s) => s.messages);
   143	  const isStreaming = useDocTalkStore((s) => s.isStreaming);
   144	  const selectedMode = useDocTalkStore((s) => s.selectedMode);
   145	  const addMessage = useDocTalkStore((s) => s.addMessage);
   146	  const { t, tOr, locale } = useLocale();
   147	  const router = useRouter();
   148	
   149	  const [input, setInput] = useState('');
   150	  const listRef = useRef<HTMLDivElement>(null);
   151	  const textareaRef = useRef<HTMLTextAreaElement>(null);
   152	  const [showPaywall, setShowPaywall] = useState(false);
   153	  const [paywallReason, setPaywallReason] = useState<string | null>(null);
   154	
   155	  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
   156	  const plusMenuRef = useRef<HTMLDivElement>(null);
   157	  const plusMenuButtonRef = useRef<HTMLButtonElement>(null);
   158	  const initialQuestionSubmittedRef = useRef<string | null>(null);
   159	
   160	  const [showScrollBtn, setShowScrollBtn] = useState(false);
   161	
   162	  const {
   163	    sendMessage,
   164	    regenerateLastResponse,
   165	    continueGenerating,
   166	    stopStreaming,
   167	    demoRemaining,
   168	    demoLimitReached,
   169	    maxMessages,
   170	  } = useChatStream({
   171	    sessionId,
   172	    selectedMode,
   173	    locale,
   174	    t,
   175	    tOr,
   176	    maxUserMessages,
   177	    currentPlan: userPlan,
   178	    onShowPaywall: (reason) => {
   179	      setPaywallReason(reason ?? null);
   180	      setShowPaywall(true);
   181	    },
   182	    onRequireAuth: () => openAuthModal(),
   183	  });
   184	
   185	  useEffect(() => {
   186	    const el = listRef.current;
   187	    if (!el) return;
   188	
   189	    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
   190	
   191	    if (isNearBottom) {
   192	      el.scrollTo({ top: el.scrollHeight, behavior: isStreaming ? 'auto' : 'smooth' });
   193	    }
   194	
   195	    setShowScrollBtn(!isNearBottom);
   196	  }, [messages, isStreaming]);
   197	
   198	  useEffect(() => {
   199	    const ta = textareaRef.current;
   200	    if (ta) {
   201	      ta.style.height = 'auto';
   202	      ta.style.height = Math.min(ta.scrollHeight, Math.max(160, window.innerHeight * 0.4)) + 'px';
   203	    }
   204	  }, [input]);
   205	
   206	  useEffect(() => {
   207	    const hasConversationMessages = messages.some((message) => message.id !== 'summary_synthetic');
   208	    if (!initialQuestion || hasConversationMessages || isStreaming) return;
   209	
   210	    if (autoSubmitInitialQuestion) {
   211	      const autoSubmitKey = `${sessionId}:${initialQuestion}`;
   212	      if (
   213	        initialQuestionSubmittedRef.current === initialQuestion
   214	        || autoSubmittedInitialQuestions.has(autoSubmitKey)
   215	      ) return;
   216	      initialQuestionSubmittedRef.current = initialQuestion;
   217	      autoSubmittedInitialQuestions.add(autoSubmitKey);
   218	      void sendMessage(initialQuestion).then((sent) => {
   219	        if (!sent) {
   220	          initialQuestionSubmittedRef.current = null;
   221	          autoSubmittedInitialQuestions.delete(autoSubmitKey);
   222	          setInput(initialQuestion);
   223	          textareaRef.current?.focus();
   224	        }
   225	      });
   226	      return;
   227	    }
   228	
   229	    if (input) return;
   230	    setInput(initialQuestion);
   231	    textareaRef.current?.focus();
   232	  }, [autoSubmitInitialQuestion, initialQuestion, input, messages, isStreaming, sendMessage, sessionId]);
   233	
   234	  useEffect(() => {
   235	    if (!plusMenuOpen) return;
   285	      const prevIndex = activeIndex >= 0
   286	        ? (activeIndex - 1 + menuItems.length) % menuItems.length
   287	        : menuItems.length - 1;
   288	      menuItems[prevIndex]?.focus();
   289	      return;
   290	    }
   291	
   292	    if ((e.key === 'Enter' || e.key === ' ') && document.activeElement instanceof HTMLElement) {
   293	      if (document.activeElement.getAttribute('role') === 'menuitem') {
   294	        e.preventDefault();
   295	        document.activeElement.click();
   296	      }
   297	    }
   298	  }, []);
   299	
   300	  const onSubmit = async (e: React.FormEvent) => {
   301	    e.preventDefault();
   302	    const sent = await sendMessage(input);
   303	    if (sent) setInput('');
   304	  };
   305	
   306	  const handleSuggestedClick = (question: string) => {
   307	    setInput(question);
   308	    void sendMessage(question).then((sent) => {
   309	      if (sent) setInput('');
   310	    });
   311	  };
   312	
   313	  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
   314	    if (e.key === 'Enter' && !e.shiftKey) {
   315	      e.preventDefault();
   316	      void sendMessage(input).then((sent) => {
   317	        if (sent) setInput('');
   318	      });
   319	    }
   320	  };
   321	
   322	  const handleDemoAuthClick = useCallback(() => {
   323	    trackEvent('upgrade_click', {
   324	      source: 'demo_limit_panel',
   325	      reason: 'demo_message_limit',
   326	      plan: 'plus',
   327	      period: 'monthly',
   328	    });
   329	    openAuthModal({ callbackUrl: '/' });
   330	  }, []);
   430	      const copy = errorCopy(e, t, tOr);
   431	      addMessage({
   432	        id: `m_${Date.now()}_share_answer_err`,
   433	        role: 'assistant',
   434	        text: copy.body,
   435	        isError: true,
   436	        createdAt: Date.now(),
   437	      });
   438	    } finally {
   439	      setShareAnswerLoadingId(null);
   440	    }
   441	  }, [addMessage, copyShareUrl, sessionId, shareAnswerLoadingId, t, tOr, userPlan]);
   442	
   443	  // Stable refs for the per-message row callbacks (I21). Previously the
   444	  // arrow functions `() => void regenerateLastResponse()` / `() => void
   445	  // continueGenerating()` / `(msg) => void handleShareAnswer(msg)` were
   446	  // recreated on every render of `ChatPanel`, and `ChatPanel` re-renders
   447	  // every ~50ms during SSE streaming (because the store's messages array
   448	  // mutates on every text flush). Even with `MessageBubble` memoized,
   449	  // those fresh arrow identities broke shallow-prop comparison and
   450	  // forced every historical message to re-run ReactMarkdown + Shiki at
   451	  // streaming cadence — O(n) work per flush. With these stabilized,
   452	  // only the actively-streaming message (the one whose `.text` ref
   453	  // changed) re-renders. The underlying mutations are already
   454	  // useCallback'd in `useChatStream`, so these wrappers stay stable
   455	  // across streaming flushes.
   456	  const handleRegenerateLast = useCallback(() => {
   457	    void regenerateLastResponse();
   458	  }, [regenerateLastResponse]);
   459	  const handleContinueLast = useCallback(() => {
   460	    void continueGenerating();
   461	  }, [continueGenerating]);
   462	  const handleShareAnswerVoid = useCallback((msg: Message) => {
   463	    void handleShareAnswer(msg);
   464	  }, [handleShareAnswer]);
   465	
   466	  const handleAnonShareClick = useCallback(() => {
   467	    trackEvent('upgrade_click', { source: 'demo_share_attempt' });
   468	    // Anonymous transcripts are not preserved through signup (no session
   469	    // adoption yet) — this is a conversion affordance, not a working share.
   470	    openAuthModal();
Aug  2 02:46:35 2026 201438 .collab/reviews/2026-08-02-p0-demo-retune-codex-r4.md
zsh:7: operation not permitted: ps

exec
/bin/zsh -lc "rg -n \"useDocTalkStore\\.subscribe|subscribe\\(.*useDocTalkStore|setSessionId\\(\" frontend/src -g '*.ts' -g '*.tsx'
nl -ba frontend/src/store/index.ts | sed -n '40,80p'
nl -ba frontend/src/store/index.ts | sed -n '286,307p'
git diff --word-diff=plain f594007..ffe2461 -- frontend/src/lib/useChatStream.ts | sed -n '1,280p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
frontend/src/lib/useChatSession.ts:53:    setSessionId(null);
frontend/src/lib/useChatSession.ts:73:          setSessionId(storedDemoSession);
frontend/src/lib/useChatSession.ts:135:          setSessionId(latest.session_id);
frontend/src/lib/useChatSession.ts:149:          setSessionId(s.session_id);
frontend/src/app/collections/[collectionId]/page.tsx:95:          setSessionId(latest.session_id);
frontend/src/app/collections/[collectionId]/page.tsx:107:          setSessionId(s.session_id);
frontend/src/app/collections/[collectionId]/page.tsx:127:    setSessionId(sid);
frontend/src/app/collections/[collectionId]/page.tsx:140:      setSessionId(s.session_id);
frontend/src/components/SessionDropdown.tsx:71:      setSessionId(s.session_id);
frontend/src/components/SessionDropdown.tsx:98:    setSessionId(id);
    40	  suggestedQuestions: string[];
    41	
    42	  // User plan
    43	  userPlan: PlanType;
    44	
    45	  // Text highlight (for non-PDF documents)
    46	  highlightSnippet: string | null;
    47	  // Verbatim supporting sentence for precise (sentence-level) PDF highlighting;
    48	  // null when the citation has no confident focus → fall back to chunk bboxes.
    49	  highlightFocus: string | null;
    50	
    51	  // Demo message tracking (cross-session, cross-document). Contract:
    52	  // totalUsed = demoMessagesUsed (server-known usage as of the last
    53	  // restore/create) + messages sent locally since then. demoRestoredUserMsgCount
    54	  // is the baseline: how many of the CURRENT transcript's user messages were
    55	  // already reflected in demoMessagesUsed at that restore/create point, so
    56	  // useChatStream can subtract it back out of the live transcript's count
    57	  // instead of double-counting. See useChatStream.ts / useChatSession.ts.
    58	  //
    59	  // Both fields are reset ONLY inside useChatSession's documentId-keyed
    60	  // effect (never in clearDocumentTransientState below) — that effect fires
    61	  // exclusively on a real document-ID transition and always re-establishes
    62	  // server truth right after via adopt-or-create in the same run. Resetting
    63	  // them from clearDocumentTransientState was tried (6149931) and reverted
    64	  // (Codex r2 #2): that function is also invoked by useDocumentLoader's
    65	  // effect, whose deps include the locale-sensitive `t`/`tOr`, so a
    66	  // same-document LANGUAGE change zeroed both fields while the transcript
    67	  // stayed — reintroducing the exact TTL-hard-lock bug this model exists to
    68	  // prevent, since nothing re-synced them afterward.
    69	  demoMessagesUsed: number;
    70	  demoRestoredUserMsgCount: number;
    71	
    72	  // PDF Search
    73	  searchQuery: string;
    74	  searchMatches: Array<{ page: number; index: number }>;
    75	  currentMatchIndex: number;
    76	  _pendingText: string;
    77	  _flushTimer: ReturnType<typeof setTimeout> | null;
    78	
    79	  // Actions
    80	  setDocument: (id: string) => void;
   286	  updateSessionActivity: (sessionId: string) => set((state) => {
   287	    const now = new Date().toISOString();
   288	    const updated = state.sessions.map((s) =>
   289	      s.session_id === sessionId
   290	        ? { ...s, last_activity_at: now, message_count: s.message_count + 1 }
   291	        : s
   292	    );
   293	    // 重排：将活跃 session 移到顶部
   294	    updated.sort((a, b) => new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime());
   295	    return { sessions: updated };
   296	  }),
   297	  setDocumentSummary: (summary: string | null) => set({ documentSummary: summary }),
   298	  setSuggestedQuestions: (questions: string[]) => set({ suggestedQuestions: questions }),
   299	  setUserPlan: (plan: PlanType) => set({ userPlan: plan }),
   300	  setDemoMessagesUsed: (count: number) => set({ demoMessagesUsed: count }),
   301	  setDemoRestoredUserMsgCount: (count: number) => set({ demoRestoredUserMsgCount: count }),
   302	  setSearchQuery: (query: string) => set({ searchQuery: query }),
   303	  setSearchMatches: (matches) => set({ searchMatches: matches }),
   304	  setCurrentMatchIndex: (index: number) => set({ currentMatchIndex: index }),
   305	  markLastMessageTruncated: (truncated: boolean) => {
   306	    const msgs = get().messages;
   307	    if (msgs.length === 0) return;
diff --git a/frontend/src/lib/useChatStream.ts b/frontend/src/lib/useChatStream.ts
index 648a790..f17348c 100644
--- a/frontend/src/lib/useChatStream.ts
+++ b/frontend/src/lib/useChatStream.ts
@@ -2,6 +2,7 @@

import { useCallback, useMemo, useRef } from 'react';
import { chatStream, continueStream } from './sse';
{+import { getMessages } from './api';+}
import { useDocTalkStore } from '../store';
import type { Message } from '../types';
import { triggerCreditsRefresh } from '../components/CreditsDisplay';
@@ -69,11 +70,6 @@ export function useChatStream({
  } = useDocTalkStore();

  const abortRef = useRef<AbortController | null>(null);
[-  // Pending rollback value for an optimistic regenerate/continue quota bump-]
[-  // (see bumpDemoUsageForRegenOrContinue below) — null when no bump is-]
[-  // awaiting resolution. Set right before the bump, consumed (cleared) by-]
[-  // whichever of handleStreamDone/handleStreamError fires next.-]
[-  const preBumpDemoUsedRef = useRef<number | null>(null);-]

  // Contract: totalUsed = demoMessagesUsed (server-known count as of the last
  // restore/create) + messages sent locally since then. demoRestoredUserMsgCount
@@ -111,33 +107,62 @@ export function useChatStream({
    [],
  );

  {+// Shared by handleStreamError and the regenerate/continue catch blocks+}
{+  // below — both need to recognize a user-initiated abort the same way.+}
{+  const isAbortLikeError = useCallback((err: unknown): boolean => {+}
{+    const name = typeof err === 'object' && err && 'name' in err+}
{+      ? String((err as { name?: unknown }).name || '')+}
{+      : '';+}
{+    const message = typeof err === 'object' && err && 'message' in err+}
{+      ? String((err as { message?: unknown }).message || '')+}
{+      : '';+}
{+    return name === 'AbortError' || message.includes('AbortError');+}
{+  }, []);+}

{+  // Fire-and-forget re-sync to server truth after a regenerate/continue+}
{+  // failure — replaces the r2 ref-based rollback (Codex r3: a rollback token+}
{+  // could go stale across an aborted call and then incorrectly undo a later,+}
{+  // unrelated send's usage). GETs the current session's messages and, if the+}
{+  // response carries demo_messages_used (anon demo only), re-anchors BOTH+}
{+  // fields to "right now": the raw server count, and a baseline equal to the+}
{+  // LIVE transcript's current user-message count (not the fetched+}
{+  // transcript's) — so useChatStream's formula converges immediately without+}
{+  // needing a full page reload, regardless of whether the failed request+}
{+  // actually consumed server quota or not. Errors are swallowed: this is a+}
{+  // best-effort correction, not something that should surface to the user.+}
{+  const reanchorDemoCounter = useCallback((forSessionId: string) => {+}
{+    if (maxUserMessages == null) return;+}
{+    getMessages(forSessionId)+}
{+      .then((msgsData) => {+}
{+        if (msgsData.demo_messages_used == null) return;+}
{+        const state = useDocTalkStore.getState();+}
{+        // The GET can resolve after the user has already navigated away —+}
{+        // e.g. useChatSession's effect ran its synchronous reset for a NEW+}
{+        // document/session while this was in flight. Re-read the CURRENT+}
{+        // sessionId from the store (not a closure) and only write if it+}
{+        // still matches the session this reanchor was called for; otherwise+}
{+        // the fetched-for-A truth would clobber whatever B's own+}
{+        // adopt/create already established. Drop it silently — B's own+}
{+        // adoption path is the authoritative source for B's counter.+}
{+        if (state.sessionId !== forSessionId) return;+}
{+        state.setDemoMessagesUsed(msgsData.demo_messages_used);+}
{+        state.setDemoRestoredUserMsgCount(+}
{+          state.messages.filter((m) => m.role === 'user').length,+}
{+        );+}
{+      })+}
{+      .catch(() => {+}
{+        // best-effort — a later restore/regenerate/continue will try again+}
{+      });+}
{+  }, [maxUserMessages]);+}

  const handleStreamError = useCallback((err: unknown) => {
    flushPendingText();
    setStreaming(false);
    abortRef.current = null;

    const { message, code, status } = getErrorMeta(err);
[-    const name = typeof err === 'object' && err && 'name' in err-]
[-      ? String((err as { name?: unknown }).name || '')-]
[-      : '';-]
[-    const isAbort = name === 'AbortError' || message.includes('AbortError');-]

[-    // Roll back a pending optimistic regenerate/continue quota bump (see-]
[-    // bumpDemoUsageForRegenOrContinue) on any non-abort failure. We can't-]
[-    // know for certain whether the backend's quota check ran before or-]
[-    // after whatever rejected this request, so this is a heuristic, not a-]
[-    // guarantee — any residual drift self-corrects on the next session-]
[-    // restore, which always re-syncs to the server's raw count. On an-]
[-    // explicit user abort we leave the bump in place: streaming can only be-]
[-    // aborted once the backend has already started responding, at which-]
[-    // point it plausibly already charged.-]
[-    const pendingDemoBumpRestore = preBumpDemoUsedRef.current;-]
[-    preBumpDemoUsedRef.current = null;-]
[-    if (!isAbort && pendingDemoBumpRestore != null) {-]
[-      useDocTalkStore.getState().setDemoMessagesUsed(pendingDemoBumpRestore);-]
[-    }-]

    if [-(isAbort)-]{+(isAbortLikeError(err))+} {
      return;
    }

@@ -221,7 +246,7 @@ export function useChatStream({
      isError: true,
      createdAt: Date.now(),
    });
  }, [addMessage, flushPendingText, getErrorMeta, {+isAbortLikeError,+} onShowPaywall, setStreaming, t, tOr, currentPlan]);

  const handleTruncated = useCallback(() => {
    flushPendingText();
@@ -232,9 +257,6 @@ export function useChatStream({
    flushPendingText();
    setStreaming(false);
    abortRef.current = null;
[-    // Stream completed successfully — any pending regenerate/continue quota-]
[-    // bump stands (no rollback needed).-]
[-    preBumpDemoUsedRef.current = null;-]
    updateSessionActivity(sessionId);
    triggerCreditsRefresh();
    trackEvent('chat_message_completed', { source: 'chat_stream', mode: selectedMode });
@@ -264,7 +286,10 @@ export function useChatStream({
    updateLastMessageMeta({ citations: citations || [] });
  }, [flushPendingText, updateLastMessageMeta]);

  {+// `onErrorOverride` lets a caller observe an error before it reaches the+}
{+  // shared `handleStreamError` (used by regenerateLastResponse to trigger a+}
{+  // demo-counter re-anchor without changing sendMessage's behavior at all).+}
  const streamAssistantResponse = useCallback(async (prompt: [-string)-]{+string, onErrorOverride?: (err: unknown) => void)+} => {
    const controller = new AbortController();
    abortRef.current = controller;

@@ -274,7 +299,7 @@ export function useChatStream({
      prompt,
      ({ text }) => updateLastMessage(text || ''),
      (citation) => addCitationToLastMessage(citation),
      {+onErrorOverride ??+} handleStreamError,
      handleStreamDone,
      handleTruncated,
      selectedMode,
@@ -324,17 +349,20 @@ export function useChatStream({
  // an existing turn), but the backend increments demo quota on both — so
  // without this the UI would undercount relative to the server. Bumps
  // demoMessagesUsed directly (not the baseline, which only moves at
  // restore/create) and optimistically, before the stream starts — [-same-]{+correct+}
  // [-timing as `sendMessage`'s optimistic user-message add. Unlike-]
[-  // sendMessage's bump (which-]{+whenever the server actually charges, which+} is[-inherent to-] the [-persisted transcript and-]{+dominant case,+}
  // [-was already accepted as unconditional), this one records-]{+including an abort (streaming can only be aborted once+} the [-pre-bump-]{+backend has+}
  // [-value-]{+already started responding,+} so[-handleStreamError can roll-] it [-back-]{+plausibly already charged). No+}
{+  // rollback here+} on failure — see {+reanchorDemoCounter above: instead of+}
{+  // guessing whether a given failure means the server charged or not (r3:+}
{+  // that guess is unsafe — e.g. the continuation endpoint charges quota+}
{+  // BEFORE validating the message is still continuable, so a 404/400+} there[-for-]
  // [-why.-]{+is still a real charge), a failed regenerate/continue re-syncs to+}
{+  // server truth directly.+} No-op outside demo (maxUserMessages == null), so[-authenticated/-]
  // [-non-demo-]{+authenticated/non-demo+} sessions are untouched.
  const bumpDemoUsageForRegenOrContinue = useCallback(() => {
    if (maxUserMessages == null) return;
    const state = useDocTalkStore.getState();
[-    preBumpDemoUsedRef.current = state.demoMessagesUsed;-]
    state.setDemoMessagesUsed(state.demoMessagesUsed + 1);
  }, [maxUserMessages]);

@@ -361,8 +389,23 @@ export function useChatStream({
    bumpDemoUsageForRegenOrContinue();
    setStreaming(true);

    {+try {+}
{+      // Covers errors reported via the SSE error event/mid-stream failures+}
{+      // (which resolve normally, so a try/catch alone wouldn't see them) —+}
{+      // re-anchor before delegating to the shared error handler.+}
      await [-streamAssistantResponse(lastUserText);-]{+streamAssistantResponse(lastUserText, (err) => {+}
{+        reanchorDemoCounter(sessionId);+}
{+        handleStreamError(err);+}
{+      });+}
{+    } catch (e) {+}
{+      // Covers a thrown fetch() rejection (network failure before/instead+}
{+      // of any SSE response) — the one case the onError override above+}
{+      // can't see, since it never fires. Re-throws unchanged (nothing here+}
{+      // catches it today either) — this only adds the re-anchor.+}
{+      if (!isAbortLikeError(e)) reanchorDemoCounter(sessionId);+}
{+      throw e;+}
{+    }+}
  }, [isStreaming, addMessage, setStreaming, streamAssistantResponse, [-bumpDemoUsageForRegenOrContinue]);-]{+bumpDemoUsageForRegenOrContinue, reanchorDemoCounter, sessionId, handleStreamError, isAbortLikeError]);+}

  const continueGenerating = useCallback(async () => {
    if (isStreaming) return;
@@ -379,23 +422,36 @@ export function useChatStream({
    const controller = new AbortController();
    abortRef.current = controller;

    {+try {+}
      await continueStream(
        sessionId,
        lastMsg.backendId || '',
        ({ text }) => updateLastMessage(text || ''),
        (citation) => addCitationToLastMessage(citation),
        [-handleStreamError,-]{+// Re-anchor before delegating — covers SSE error-event/mid-stream+}
{+        // failures, which resolve normally (see the try/catch below for the+}
{+        // thrown-fetch-rejection case a callback can't see).+}
{+        (err) => {+}
{+          reanchorDemoCounter(sessionId);+}
{+          handleStreamError(err);+}
{+        },+}
        handleStreamDone,
        handleTruncated,
        selectedMode,
        locale,
        controller.signal,
        (artifact) => addArtifactToLastMessage(artifact),
        ({ message }) => setLastMessageToolStatus(message),
        handleAnswerRepaired,
        handleCitationsRefined,
      );
    {+} catch (e) {+}
{+      // Thrown fetch() rejection — re-throws unchanged (nothing here catches+}
{+      // it today either), this only adds the re-anchor.+}
{+      if (!isAbortLikeError(e)) reanchorDemoCounter(sessionId);+}
{+      throw e;+}
{+    }+}
  }, [isStreaming, sessionId, markLastMessageTruncated, setStreaming, updateLastMessage, addCitationToLastMessage, addArtifactToLastMessage, setLastMessageToolStatus, handleStreamError, handleStreamDone, handleTruncated, handleAnswerRepaired, handleCitationsRefined, selectedMode, locale, [-bumpDemoUsageForRegenOrContinue]);-]{+bumpDemoUsageForRegenOrContinue, reanchorDemoCounter, isAbortLikeError]);+}

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();

exec
/bin/zsh -lc "nl -ba frontend/src/store/index.ts | sed -n '1,115p'
nl -ba frontend/src/app/collections/'[collectionId]'/page.tsx | sed -n '70,155p'
nl -ba frontend/src/components/SessionDropdown.tsx | sed -n '45,150p'
rg -n \"sessionId:\" frontend/src/store/index.ts frontend/src/types -g '*.ts'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	"use client";
     2	
     3	import { create } from 'zustand';
     4	import { DEFAULT_MODE, isKnownMode } from '../lib/models';
     5	import type { PlanType } from '../lib/models';
     6	import type { ChatArtifact, Citation, Message, NormalizedBBox, SessionItem } from '../types';
     7	
     8	type DocStatus = 'idle' | 'uploading' | 'parsing' | 'ocr' | 'embedding' | 'ready' | 'error';
     9	
    10	export interface DocTalkStore {
    11	  // Document
    12	  documentId: string | null;
    13	  documentName: string | null;
    14	  documentStatus: DocStatus;
    15	  totalPages: number;
    16	  parseProgress: { pagesParsed: number; chunksIndexed: number };
    17	
    18	  // Last viewed document (persisted to localStorage)
    19	  lastDocumentId: string | null;
    20	  lastDocumentName: string | null;
    21	
    22	  // PDF
    23	  currentPage: number;
    24	  scale: number;
    25	  grabMode: boolean;
    26	  highlights: NormalizedBBox[];
    27	  pdfUrl: string | null;
    28	  scrollNonce: number;
    29	
    30	  // Chat
    31	  sessionId: string | null;
    32	  messages: Message[];
    33	  isStreaming: boolean;
    34	  selectedMode: string;
    35	  domainMode: string | null;
    36	  sessions: SessionItem[];
    37	
    38	  // Document summary (auto-generated)
    39	  documentSummary: string | null;
    40	  suggestedQuestions: string[];
    41	
    42	  // User plan
    43	  userPlan: PlanType;
    44	
    45	  // Text highlight (for non-PDF documents)
    46	  highlightSnippet: string | null;
    47	  // Verbatim supporting sentence for precise (sentence-level) PDF highlighting;
    48	  // null when the citation has no confident focus → fall back to chunk bboxes.
    49	  highlightFocus: string | null;
    50	
    51	  // Demo message tracking (cross-session, cross-document). Contract:
    52	  // totalUsed = demoMessagesUsed (server-known usage as of the last
    53	  // restore/create) + messages sent locally since then. demoRestoredUserMsgCount
    54	  // is the baseline: how many of the CURRENT transcript's user messages were
    55	  // already reflected in demoMessagesUsed at that restore/create point, so
    56	  // useChatStream can subtract it back out of the live transcript's count
    57	  // instead of double-counting. See useChatStream.ts / useChatSession.ts.
    58	  //
    59	  // Both fields are reset ONLY inside useChatSession's documentId-keyed
    60	  // effect (never in clearDocumentTransientState below) — that effect fires
    61	  // exclusively on a real document-ID transition and always re-establishes
    62	  // server truth right after via adopt-or-create in the same run. Resetting
    63	  // them from clearDocumentTransientState was tried (6149931) and reverted
    64	  // (Codex r2 #2): that function is also invoked by useDocumentLoader's
    65	  // effect, whose deps include the locale-sensitive `t`/`tOr`, so a
    66	  // same-document LANGUAGE change zeroed both fields while the transcript
    67	  // stayed — reintroducing the exact TTL-hard-lock bug this model exists to
    68	  // prevent, since nothing re-synced them afterward.
    69	  demoMessagesUsed: number;
    70	  demoRestoredUserMsgCount: number;
    71	
    72	  // PDF Search
    73	  searchQuery: string;
    74	  searchMatches: Array<{ page: number; index: number }>;
    75	  currentMatchIndex: number;
    76	  _pendingText: string;
    77	  _flushTimer: ReturnType<typeof setTimeout> | null;
    78	
    79	  // Actions
    80	  setDocument: (id: string) => void;
    81	  setDocumentName: (name: string) => void;
    82	  setDocumentStatus: (status: DocStatus) => void;
    83	  setLastDocument: (id: string, name: string) => void;
    84	  setPdfUrl: (url: string | null) => void;
    85	  setPage: (page: number) => void;
    86	  setScale: (scale: number) => void;
    87	  setGrabMode: (v: boolean) => void;
    88	  setHighlights: (highlights: NormalizedBBox[]) => void;
    89	  navigateToCitation: (citation: Citation) => void;
    90	  addMessage: (msg: Message) => void;
    91	  updateLastMessage: (text: string) => void;
    92	  addCitationToLastMessage: (citation: Citation) => void;
    93	  addArtifactToLastMessage: (artifact: ChatArtifact) => void;
    94	  setLastMessageToolStatus: (message: string) => void;
    95	  setStreaming: (v: boolean) => void;
    96	  setSessionId: (id: string | null) => void;
    97	  setSelectedMode: (id: string) => void;
    98	  setDomainMode: (mode: string | null) => void;
    99	  setMessages: (msgs: Message[]) => void;
   100	  setSessions: (sessions: SessionItem[]) => void;
   101	  addSession: (session: SessionItem) => void;
   102	  removeSession: (sessionId: string) => void;
   103	  updateSessionActivity: (sessionId: string) => void;
   104	  setDocumentSummary: (summary: string | null) => void;
   105	  setSuggestedQuestions: (questions: string[]) => void;
   106	  setUserPlan: (plan: PlanType) => void;
   107	  setDemoMessagesUsed: (count: number) => void;
   108	  setDemoRestoredUserMsgCount: (count: number) => void;
   109	  setSearchQuery: (query: string) => void;
   110	  setSearchMatches: (matches: Array<{ page: number; index: number }>) => void;
   111	  setCurrentMatchIndex: (index: number) => void;
   112	  markLastMessageTruncated: (truncated: boolean) => void;
   113	  updateLastMessageMeta: (updates: Partial<Message>) => void;
   114	  flushPendingText: () => void;
   115	  clearDocumentTransientState: () => void;
    70	        const coll = await getCollection(collectionId);
    71	        if (!cancelled) setCollection(coll);
    72	      } catch {
    73	        if (!cancelled) router.push('/collections');
    74	      } finally {
    75	        if (!cancelled) setLoading(false);
    76	      }
    77	    })();
    78	
    79	    return () => { cancelled = true; };
    80	  }, [collectionId, status, router]);
    81	
    82	  // Setup session for collection
    83	  useEffect(() => {
    84	    if (!collectionId || !collection) return;
    85	    let cancelled = false;
    86	
    87	    (async () => {
    88	      let sessionReady = false;
    89	      try {
    90	        const sessionsData = await listCollectionSessions(collectionId);
    91	        if (cancelled) return;
    92	        setSessions(sessionsData.sessions);
    93	        if (sessionsData.sessions.length > 0) {
    94	          const latest = sessionsData.sessions[0];
    95	          setSessionId(latest.session_id);
    96	          const msgsData = await getMessages(latest.session_id);
    97	          if (!cancelled) setMessages(msgsData.messages);
    98	          sessionReady = true;
    99	        }
   100	      } catch (e) {
   101	        console.error('Failed to load collection sessions:', e);
   102	      }
   103	      if (!sessionReady && !cancelled) {
   104	        try {
   105	          const s = await createCollectionSession(collectionId);
   106	          if (cancelled) return;
   107	          setSessionId(s.session_id);
   108	          const now = s.created_at || new Date().toISOString();
   109	          addSession({
   110	            session_id: s.session_id,
   111	            title: null,
   112	            message_count: 0,
   113	            created_at: now,
   114	            last_activity_at: now,
   115	          });
   116	          setMessages([]);
   117	        } catch (e) {
   118	          console.error('Failed to create collection session:', e);
   119	        }
   120	      }
   121	    })();
   122	
   123	    return () => { cancelled = true; };
   124	  }, [collectionId, collection, setSessions, setSessionId, setMessages, addSession]);
   125	
   126	  const handleSelectSession = useCallback(async (sid: string) => {
   127	    setSessionId(sid);
   128	    setShowMobileSidebar(null);
   129	    try {
   130	      const msgsData = await getMessages(sid);
   131	      setMessages(msgsData.messages);
   132	    } catch (e) {
   133	      console.error('Failed to load session messages:', e);
   134	    }
   135	  }, [setSessionId, setMessages]);
   136	
   137	  const handleNewSession = useCallback(async () => {
   138	    try {
   139	      const s = await createCollectionSession(collectionId);
   140	      setSessionId(s.session_id);
   141	      const now = s.created_at || new Date().toISOString();
   142	      addSession({
   143	        session_id: s.session_id,
   144	        title: null,
   145	        message_count: 0,
   146	        created_at: now,
   147	        last_activity_at: now,
   148	      });
   149	      setMessages([]);
   150	      setShowMobileSidebar(null);
   151	    } catch (e) {
   152	      console.error('Failed to create new session:', e);
   153	    }
   154	  }, [collectionId, setSessionId, addSession, setMessages]);
   155	
    45	      setFocusIndex(0);
    46	    } else {
    47	      setConfirmDeleteId(null);
    48	    }
    49	  }, [open]);
    50	
    51	  useEffect(() => {
    52	    if (open && focusIndex >= 0 && itemRefs.current[focusIndex]) {
    53	      itemRefs.current[focusIndex]?.focus();
    54	    }
    55	  }, [open, focusIndex]);
    56	
    57	  const toggle = () => setOpen((v) => !v);
    58	
    59	  const onNewChat = async () => {
    60	    if (!documentId || isStreaming) return;
    61	    setSessionErrorCopy(null);
    62	    try {
    63	      const s = await createSession(documentId);
    64	      addSession({
    65	        session_id: s.session_id,
    66	        title: null,
    67	        message_count: 0,
    68	        created_at: s.created_at,
    69	        last_activity_at: s.created_at,
    70	      });
    71	      setSessionId(s.session_id);
    72	      if (s.demo_messages_used != null) {
    73	        // Fresh session, empty transcript — same contract as useChatSession's
    74	        // createSession path: baseline 0, every message sent from here counts.
    75	        setDemoRestoredUserMsgCount(0);
    76	        setDemoMessagesUsed(s.demo_messages_used);
    77	        // "New Chat" for an anon demo user starts a NEW session — the stored
    78	        // pointer must move to it, or the next page view re-adopts the old
    79	        // (now-abandoned) session instead of this one.
    80	        writeDemoSession(documentId, s.session_id);
    81	      }
    82	      setMessages([]);
    83	      setConfirmDeleteId(null);
    84	      setOpen(false);
    85	    } catch (e) {
    86	      const copy = errorCopy(e, t, tOr);
    87	      setSessionErrorCopy(copy);
    88	      if (copy.cta) {
    89	        trackEvent('limit_hit', { source: 'session_dropdown', reason: 'session_limit' });
    90	      }
    91	    }
    92	  };
    93	
    94	  const onSwitchSession = async (id: string) => {
    95	    if (isStreaming) return;
    96	    setSessionErrorCopy(null);
    97	    setMessages([]);
    98	    setSessionId(id);
    99	    const msgs = await getMessages(id);
   100	    setMessages(msgs.messages);
   101	    // Same restore contract as useChatSession's reuse branch: switching to a
   102	    // session with a real transcript must reset the baseline to what THIS
   103	    // transcript carries, or the demo counter stays misaligned against the
   104	    // newly-loaded messages (only relevant when `id` is an anon demo session
   105	    // — demo_messages_used is absent for authed/non-demo sessions).
   106	    if (msgs.demo_messages_used != null) {
   107	      const restoredUserMsgCount = msgs.messages.filter((m) => m.role === 'user').length;
   108	      setDemoRestoredUserMsgCount(restoredUserMsgCount);
   109	      setDemoMessagesUsed(msgs.demo_messages_used);
   110	      // Switching to a different anon-demo session moves the "active"
   111	      // session — move the pointer too, so the next page view re-adopts
   112	      // the one the user actually switched to, not the one they left.
   113	      if (documentId) writeDemoSession(documentId, id);
   114	    }
   115	    setConfirmDeleteId(null);
   116	    setOpen(false);
   117	  };
   118	
   119	  const onDeleteSessionById = async (targetId: string) => {
   120	    if (isStreaming) return;
   121	    setSessionErrorCopy(null);
   122	    setConfirmDeleteId(null);
   123	    await deleteSession(targetId);
   124	    removeSession(targetId);
   125	    // Clear the stored anon-demo pointer IMMEDIATELY on confirmed delete, if
   126	    // it named this session — before any replacement GET below. Otherwise a
   127	    // transient failure in onSwitchSession/onNewChat would leave the
   128	    // pointer naming a session that no longer exists (Codex r2 #3): the
   129	    // next page load would 404 on adopt, which is a safe fallback, but only
   130	    // clearing it here proactively avoids that extra failed round-trip. A
   131	    // successful switch/create afterward writes the new pointer over this.
   132	    if (documentId && readDemoSession(documentId) === targetId) {
   133	      clearDemoSession(documentId);
   134	    }
   135	    const remaining = useDocTalkStore.getState().sessions;
   136	    if (targetId === sessionId) {
   137	      if (remaining.length > 0) {
   138	        await onSwitchSession(remaining[0].session_id);
   139	      } else {
   140	        await onNewChat();
   141	      }
   142	    }
   143	    setOpen(false);
   144	  };
   145	
   146	  const onDeleteCurrent = () => {
   147	    if (!sessionId || isStreaming) return;
   148	    setSessionErrorCopy(null);
   149	    setConfirmDeleteId(sessionId);
   150	  };
frontend/src/store/index.ts:31:  sessionId: string | null;
frontend/src/store/index.ts:102:  removeSession: (sessionId: string) => void;
frontend/src/store/index.ts:103:  updateSessionActivity: (sessionId: string) => void;
frontend/src/store/index.ts:132:  sessionId: null as string | null,
frontend/src/store/index.ts:269:  setSessionId: (id: string | null) => set({ sessionId: id }),
frontend/src/store/index.ts:283:  removeSession: (sessionId: string) => set((state) => ({
frontend/src/store/index.ts:286:  updateSessionActivity: (sessionId: string) => set((state) => {

codex
The r3 failures themselves are fixed, and one same-session race remains in the replacement design: a re-anchor launched for failure N can resolve after a new send/retry and overwrite that newer accounting. The session guard correctly blocks cross-session writes, but it has no same-session generation or accounting-version check.
Scoped tracing is complete. The original three r3 breakages are addressed; the report will record one newly introduced same-session stale-reanchor race and a REVISE verdict.
  ✓ Read review context, scoped rules, and the three-commit diff
  ✓ Trace each r3 item and adversarial re-anchor/accounting races
  → Write the r4 report and verify its evidence
  ✓ Read review context, scoped rules, and the three-commit diff
  ✓ Trace each r3 item and adversarial re-anchor/accounting races
  ✓ Write the r4 report and verify its evidence
codex
# Codex r4 — scoped verification

Review range: `f594007..ffe2461`

## 1. Server-charged failures — ADDRESSED

The unsafe rollback is gone. Regenerate/continue failures now request the authoritative `demo_messages_used` value and reset both counter fields ([useChatStream.ts](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/useChatStream.ts:133), lines 133–155). The backend GET obtains the same per-IP/document counter used by chat charging ([chat.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:307), lines 307–344).

Callback-reported failures trigger re-anchoring at lines 392–399 and 425–447; thrown fetch rejections trigger it at lines 400–406 and 448–452. This matches [sse.ts](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/sse.ts:93): callback error paths return normally, while rejection of the outer `fetch()` escapes to the caller.

Thus a charged continuation 404/400 no longer gets guessed back to its pre-bump value.

## 2. Abort-stale rollback token — ADDRESSED

`preBumpDemoUsedRef` and every restore/consume operation have been removed. The only retained optimistic state change is the direct `demoMessagesUsed + 1` at [useChatStream.ts](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/useChatStream.ts:363), while abort merely cancels the active controller and ends streaming at lines 456–461.

Consequently, no state token survives an abort that a later ordinary send can consume. `sendMessage` still uses the default `handleStreamError` path rather than the regeneration override (lines 292–314 and 316–346).

## 3. Transient adoption exposing the previous chat — ADDRESSED

The document/session effect clears `sessionId`, `messages`, and `sessions` before starting any awaited adoption work ([useChatSession.ts](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/useChatSession.ts:25), lines 25–56). A transient stored-session failure then sets `sessionError` and returns without creating another session, while only 403/404 clears the stored pointer (lines 68–125).

Because `sessionId` remains null, the reader bypasses its `ChatPanel` branch and renders `sessionErrorCopy` ([DocumentReaderPageClient.tsx](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:366), lines 366–393).

## New breakage introduced by these commits

1. **IMPORTANT — a stale same-session re-anchor can erase newer request accounting.**

   `reanchorDemoCounter` is fire-and-forget, and `handleStreamError` immediately clears `isStreaming`. This permits a new send/regenerate/continue while the GET remains unresolved. The session-ID guard accepts the old response because the new operation uses the same session.

   Concrete send race:

   - Failed regenerate launches a GET whose counter snapshot is `2`.
   - The user sends another message before that GET resolves. The live transcript now contains the new user message, so the transcript-delta formula temporarily counts usage as `3`.
   - The old GET resolves and writes `demoMessagesUsed = 2`, then sets `demoRestoredUserMsgCount` to the **current** transcript count, including the new message ([useChatStream.ts](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/useChatStream.ts:138), lines 138–151).
   - The new message’s local delta disappears even if the backend has charged it. Successful completion performs no subsequent re-anchor, so the undercount persists.

   A later optimistic regenerate/continue bump can likewise be overwritten, and multiple failure-triggered GETs can resolve out of order. The guard prevents cross-session corruption but supplies no same-session request generation or accounting revision.

   Required revision: serialize re-anchoring against the next operation, or introduce same-session accounting/version ordering that cannot discard intervening sends or newer authoritative results.

A single terminal failure does not double-fire: callback paths return without throwing, and fetch rejection reaches only the caller catch. The `getState()` session check itself has no asynchronous TOCTOU window because the check and both setters run in one JavaScript turn; the defect is stale same-session request ordering, not an interleaving between those statements.

`git diff --check f594007..ffe2461` passes.

**Overall verdict: REVISE.**
tokens used
89,413
# Codex r4 — scoped verification

Review range: `f594007..ffe2461`

## 1. Server-charged failures — ADDRESSED

The unsafe rollback is gone. Regenerate/continue failures now request the authoritative `demo_messages_used` value and reset both counter fields ([useChatStream.ts](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/useChatStream.ts:133), lines 133–155). The backend GET obtains the same per-IP/document counter used by chat charging ([chat.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:307), lines 307–344).

Callback-reported failures trigger re-anchoring at lines 392–399 and 425–447; thrown fetch rejections trigger it at lines 400–406 and 448–452. This matches [sse.ts](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/sse.ts:93): callback error paths return normally, while rejection of the outer `fetch()` escapes to the caller.

Thus a charged continuation 404/400 no longer gets guessed back to its pre-bump value.

## 2. Abort-stale rollback token — ADDRESSED

`preBumpDemoUsedRef` and every restore/consume operation have been removed. The only retained optimistic state change is the direct `demoMessagesUsed + 1` at [useChatStream.ts](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/useChatStream.ts:363), while abort merely cancels the active controller and ends streaming at lines 456–461.

Consequently, no state token survives an abort that a later ordinary send can consume. `sendMessage` still uses the default `handleStreamError` path rather than the regeneration override (lines 292–314 and 316–346).

## 3. Transient adoption exposing the previous chat — ADDRESSED

The document/session effect clears `sessionId`, `messages`, and `sessions` before starting any awaited adoption work ([useChatSession.ts](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/useChatSession.ts:25), lines 25–56). A transient stored-session failure then sets `sessionError` and returns without creating another session, while only 403/404 clears the stored pointer (lines 68–125).

Because `sessionId` remains null, the reader bypasses its `ChatPanel` branch and renders `sessionErrorCopy` ([DocumentReaderPageClient.tsx](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:366), lines 366–393).

## New breakage introduced by these commits

1. **IMPORTANT — a stale same-session re-anchor can erase newer request accounting.**

   `reanchorDemoCounter` is fire-and-forget, and `handleStreamError` immediately clears `isStreaming`. This permits a new send/regenerate/continue while the GET remains unresolved. The session-ID guard accepts the old response because the new operation uses the same session.

   Concrete send race:

   - Failed regenerate launches a GET whose counter snapshot is `2`.
   - The user sends another message before that GET resolves. The live transcript now contains the new user message, so the transcript-delta formula temporarily counts usage as `3`.
   - The old GET resolves and writes `demoMessagesUsed = 2`, then sets `demoRestoredUserMsgCount` to the **current** transcript count, including the new message ([useChatStream.ts](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/useChatStream.ts:138), lines 138–151).
   - The new message’s local delta disappears even if the backend has charged it. Successful completion performs no subsequent re-anchor, so the undercount persists.

   A later optimistic regenerate/continue bump can likewise be overwritten, and multiple failure-triggered GETs can resolve out of order. The guard prevents cross-session corruption but supplies no same-session request generation or accounting revision.

   Required revision: serialize re-anchoring against the next operation, or introduce same-session accounting/version ordering that cannot discard intervening sends or newer authoritative results.

A single terminal failure does not double-fire: callback paths return without throwing, and fetch rejection reaches only the caller catch. The `getState()` session check itself has no asynchronous TOCTOU window because the check and both setters run in one JavaScript turn; the defect is stale same-session request ordering, not an interleaving between those statements.

`git diff --check f594007..ffe2461` passes.

**Overall verdict: REVISE.**
