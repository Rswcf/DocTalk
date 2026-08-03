# Codex P1 hygiene r2 — scoped verification of the r1 fixes

Your r1 verdicted REVISE: gate bypass-free (CONSENSUS), but 1 P2 dead-end + 2 P3. Three fix commits since your r1 head (e499bc7):

```
git log --oneline e499bc7..HEAD
git diff e499bc7..HEAD
```

- `bb79453` (P2 — Pro document-cap dead-end): new `targetPlanOrNone()` scoped to DOCUMENT_LIMIT_REACHED returns undefined for plan:"pro"; the CODE_TABLE entry then emits top-tier copy (`errors.DOCUMENT_LIMIT_REACHED.bodyTopTier`, ×11) with NO cta, so a Pro user at the doc cap sees a manage-docs message, not a "Downgrade Plus" billing link. Both consumer surfaces (DocumentReaderPageClient, ChatArtifactCard) already render cta only when truthy → inherit the fix; DashboardPageClient's shared consumer too. targetPlan()'s other 3 callers left untouched (not audited for the same bug — deliberately un-expanded scope).
- `bb79453` also (P3 comment): the openPaywall invariant comment now documents DOMAIN_MODE_REQUIRES_PLUS as an intentional useChatStream-hardcoded auto-modal exception (why: chat SSE error renderer has no inline-CTA path).
- `14e4f9a` (P3 — stale persisted domain_mode): `_sync_session_domain_mode()` hoisted to run ONCE right after session load/access-check (chat_service.py:1489), before all branching; the old late call at :2056 removed. Found a THIRD early-return path too (summary fast-path ~:1543) beyond your two. Test parametrized over tool-action / quote-finder / summary asserts omitted-mode leaves the row NULL; RED confirmed pre-hoist, GREEN after.

Task: verdict the P2 + both P3 items ADDRESSED / NOT ADDRESSED; probe adversarially (does targetPlanOrNone leave any DOCUMENT_LIMIT_REACHED surface still linking pro→plus; does the hoisted sync run for EVERY successful terminal path and not double-run or run before the access check; does hoisting change gating/behavior); flag NEW breakage in these two commits only. If clean, all P1 findings closed — final batch verdict for ba8a141..HEAD (docs excluded).

Evidence (audit, don't repeat): 788 backend pass/3 skip (one earlier flaky smoke test re-ran green), ruff + build + tsc + lint clean at HEAD; 23 real-Postgres integration pass.

Report: per-item verdicts + new-breakage + overall verdict CONSENSUS-SHIP / REVISE / BLOCK.
