# Codex P1 hygiene r2 — scoped verification of the r1 fixes

Your r1 verdicted REVISE: gate bypass-free (CONSENSUS), but 1 P2 dead-end + 2 P3. Fix commits since your r1 head (e499bc7):

```
git log --oneline e499bc7..HEAD
git diff e499bc7..HEAD
```

- `bb79453` (P2 — Pro document-cap dead-end): new `targetPlanOrNone()` scoped to DOCUMENT_LIMIT_REACHED returns undefined for plan:"pro"; the CODE_TABLE entry then emits top-tier copy (`errors.DOCUMENT_LIMIT_REACHED.bodyTopTier`, ×11) with NO cta, so a Pro user at the doc cap sees a manage-docs message, not a "Downgrade Plus" billing link. Both consumer surfaces (DocumentReaderPageClient, ChatArtifactCard) already render cta only when truthy → inherit the fix; DashboardPageClient's shared consumer too. targetPlan()'s other 3 callers left untouched (not audited for the same bug — deliberately un-expanded scope).
- `bb79453` also (P3 comment): the openPaywall invariant comment now documents DOMAIN_MODE_REQUIRES_PLUS as an intentional useChatStream-hardcoded auto-modal exception (why: chat SSE error renderer has no inline-CTA path).
- `2d4e01a` (P3 — stale persisted domain_mode): extracted the sync into a shared `_sync_session_domain_mode(db, session_obj, domain_mode)` helper (updates `ChatSession.domain_mode` to the CURRENT request's value, null when omitted; uses the arg directly, never re-reads the stored value) and calls it at ALL successful terminal points — the tool-action branch (before dispatching to _tool_action_stream), the strict Quote Finder success path (after settled=True, before the artifact/token/done yields), and the main RAG path (now via the same helper, unchanged logic). Deliberately NOT applied to failure/rejection paths (SESSION_NOT_FOUND / MODE_NOT_ALLOWED / INSUFFICIENT_CREDITS). Two new tests seed session_obj.domain_mode="legal", send an omitted-mode message, assert the row ends NULL — one for tool-action, one for strict Quote Finder; each call site independently mutation-tested (disabling either reproduces the stale-metadata bug, only its own test catches it).

Task: verdict the P2 + both P3 items ADDRESSED / NOT ADDRESSED; probe adversarially — (a) does targetPlanOrNone leave any DOCUMENT_LIMIT_REACHED surface still linking pro→plus; (b) does the per-branch sync cover EVERY successful terminal path that persists a session (is there a 3rd — e.g. a summary/overview fast-path — that still skips it?), and can it double-apply or run on a rejection path; (c) does it change gating/behavior (the API-layer 403 gate runs first, so sync only runs for authorized requests). Flag NEW breakage in these two fix commits only. If clean, all P1 findings closed — final batch verdict for ba8a141..HEAD (docs excluded).

Evidence (audit, don't repeat): 788 backend pass/26 skip (one earlier flaky smoke test re-ran green), ruff + build + tsc + lint clean at HEAD; 23 real-Postgres integration pass.

Report: per-item verdicts + new-breakage + overall verdict CONSENSUS-SHIP / REVISE / BLOCK.
