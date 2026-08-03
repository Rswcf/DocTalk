Reading prompt from stdin...
2026-08-03T21:48:36.807713Z ERROR codex_core::session::session: failed to load skill /Users/mayijie/Projects/Code/010_DocTalk/.agents/skills/deploy/SKILL.md: missing YAML frontmatter delimited by ---
2026-08-03T21:48:36.807740Z ERROR codex_core::session::session: failed to load skill /Users/mayijie/Projects/Code/010_DocTalk/.agents/skills/codex-implement/SKILL.md: missing YAML frontmatter delimited by ---
OpenAI Codex v0.144.0
--------
workdir: /Users/mayijie/Projects/Code/010_DocTalk
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR]
reasoning effort: xhigh
reasoning summaries: none
session id: 019fc999-a200-7882-828e-bf64f904ce2d
--------
user
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

codex
I’ll inspect only `e499bc7..HEAD`, read the scoped frontend/backend rules, trace every `DOCUMENT_LIMIT_REACHED` consumer and every successful `send_message_stream` terminal branch, then run focused tests or static checks where they sharpen the verdict.
  → Read scoped rules and inspect the two fix commits/diff
  • Trace DOCUMENT_LIMIT_REACHED rendering and plan-target logic
  • Trace all successful streaming terminal paths and sync semantics
  • Run focused verification and issue the batch verdict
exec
/bin/zsh -lc "sed -n '1,240p' .claude/rules/frontend.md" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "sed -n '1,280p' .claude/rules/backend.md" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
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
- **Editorial marketing layer**: the entire public marketing surface (unauthenticated `/`, `use-cases/*`, `compare/*`, `alternatives/*`, `features/*`, `tools/*`, `pricing`, `trust`, `demo`) uses a SEPARATE scoped editorial design system — `frontend/src/app/editorial.css` (every rule under `.dt-editorial`), a warm-paper palette (`--ed-paper`/`--ed-ink`/`--ed-signal` terracotta `#b0472f`/`--ed-ochre`) with Newsreader serif + IBM Plex Mono fonts, **light-only**. It does NOT use the zinc/blue app palette. **Design decision locked 2026-05-20**: the product runs on TWO surface treatments (editorial marketing terracotta+warm-paper vs functional app zinc+blue) sharing one token base (logo, body font Inter, spacing scale, micro-interactions). A blue-accent unification was tried and reverted because the warm-paper terracotta identity is load-bearing. Do not re-propose merging the accents. Marketing pages compose the shared editorial kit in `frontend/src/components/marketing/` (`MarketingShell`, `EditorialMarketingHeader`, `EdPageHero`, `EdSection`, `EdProse`, `EdFeatureList`, `EdCardGrid`, `EdStepRow`, `EdFaqList`, `EdCtaBanner`, `EdComparisonTable`, `EdInlineCell`, `EdRelatedLinks`, `EdCheckList`, `EdChoiceList`) — `MarketingShell` supplies the `.dt-editorial` root, so kit components never add it themselves. Keep editorial styles scoped under `.dt-editorial`; do not let them leak into the functional app UI, and do not apply the zinc/blue rule to editorial components. Pages still on the zinc/blue app palette: `about`, `contact`, `imprint`, `privacy`, `terms`, `blog/*` (document-diff was editorialized in 2026-05; `DocumentDiffPanel` takes `surface="app"|"editorial"` and is the one sanctioned dual-surface component).
- **De-glass leftovers are a bug class**: commit `0b7404a` flattened the CSS but left dark-glass Tailwind utilities in JSX; ~40 invisible-on-white sites were fixed in v0.23.0. When touching app-surface JSX, any `*-white/NN` or bare `text-white`/`hover:text-white` on a light surface needs a light-mode variant (`dark:` keeps the old value). Theme-inverting solids (`bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900`) are correct as-is.
- **i18n**: Components using `t()` MUST be inside `<LocaleProvider>`. Outside = raw key fallback. Only `en` is statically loaded; other 10 locales lazy-loaded. Localized server pages seed `<LocaleProvider initialLocale initialMessages>` (see `app/[locale]/page.tsx` + `getScopedMessages`) so SSR HTML is translated — a `[locale]` page without seeding ships English first paint (the exact failure the locale-URL program exists to fix).

## Demo Counter & Session Reuse (v0.23.0 — Codex 6-round consensus; do not re-break)
- Contract: `totalUsed = demoMessagesUsed (server count at last restore/create) + (transcript user msgs − demoRestoredUserMsgCount baseline)`. Counters reset ONLY in `useChatSession`'s documentId-keyed effect (NOT `clearDocumentTransientState` — its effect reruns on locale change and wiped the baseline).
- Anonymous demo sessions are reused via `sessionStorage["dt-demo-session:"+docId]` (helper `demoSessionStorage.ts`); pointer cleared only on 404/403; transient adoption failure sets `sessionError` and STOPS (no create fall-through).
- Failed regenerate/continue re-anchors to server truth (`GET messages` → `demo_messages_used`) guarded by sessionId AND `demoAccountingEpoch` (monotonic across `reset()`; bumped at every accounting mutation incl. A→A session switch). Late resolves are dropped, never written.

## Quote Finder UI (M2/M3)
- `QuoteFinderPanel` (reader toolbar entry; anon sees a sign-in CTA instead) + chat `quote_search` artifact + "Try Quote Finder" chip (renders when the SSE `done` event carries `quote_finder_hint`/`quote_finder_topic`; opens the panel with topic prefilled, NEVER auto-submits — searches are billed).
- Trust copy is per-kind and uses the WEAKEST kind present: word-for-word claim only for `page_text` results; `extracted_text` cards carry the amber hyphenation caveat. Do not reintroduce an unconditional verbatim claim.
- Panel resets topic/result/error/loading on every open/retarget with a generation guard (late responses from a prior open are dropped).
- Save button state must not be disabled from a cached count — the cap only blocks genuinely new saves (idempotent re-saves always succeed).

## PDF & Documents
- **react-pdf v9 CJK**: After upgrading react-pdf/pdfjs-dist, MUST re-copy `cmaps/`, `standard_fonts/`, `pdf.worker.min.mjs` to `public/`. Worker loaded from same-origin (not CDN) for CSP compliance
- **bbox coordinates**: Normalized [0,1], top-left origin. Three citation highlight strategies: ① PDF bbox, ② TextViewer text-snippet match, ③ converted PDF fallback to text-snippet when dummy bbox detected. Quote cards reuse the citation jump with chunk-level bboxes and an explicit "highlight location is approximate" label (plan §8.2).

## Subscriptions & Feature Gating
- Free (300/mo) + Plus (3K/mo, $9.99) + Pro (9K/mo, $19.99). Annual = 20% discount
- Visible modes are Flash and Pro. Internal IDs remain `quick` and `balanced`; retired modes such as `thorough` must migrate to Flash.
- Free includes Flash plus a capped number of Pro answers/month. Export: Plus+ (frontend gated). Custom Instructions: Pro (backend gated). Sessions: Free=3/doc (backend gated). Saved quotes: Free=30 active across documents (backend gated; delete frees a slot). Quote searches cost credits like a Pro (balanced) chat message. Domain Mode (legal/academic chat overlay): Plus+ (backend gated at two entry points — `chat.py`'s `chat_stream` and `extractions.py`'s `create_extraction` — both 403 `DOMAIN_MODE_REQUIRES_PLUS`).
- Credit packs: Boost(500/$3.99), Power(2K/$9.99), Ultra(5K/$19.99)
- Cancellation UI must remain self-serve. The cancel form may collect an optional reason, optional feedback, and a refund-review checkbox, but it must not block cancellation on those fields.

 succeeded in 0ms:
---
paths:
  - "backend/**"
---

# Backend Conventions

## Async Safety
- **MinIO calls MUST use `asyncio.to_thread()`** in async endpoints. MinIO client is sync (urllib3). Direct calls block event loop; when MinIO is unreachable, blocks ALL requests for 30+s. Client configured with short timeouts (connect=5s, read=10s, 2 retries)
- **Celery uses sync DB** (`psycopg`), API uses async (`asyncpg`). Never mix.

## Credits & Billing
- **Two-stage debit**: ① Pre-check balance (402 if insufficient) → ② `debit_credits()` pre-debits estimated cost (returns ledger ID) → stream → `reconcile_credits()` UPDATEs same ledger entry to actual cost. Single ledger record per chat. LLM failure → DELETE entry + full refund
- **Durable settlement (v0.24.0, Codex-consensus)**: `credit_ledger.reconciled_at` is the settlement marker. `reconcile_credits()` takes `SELECT ... FOR UPDATE` and ALWAYS stamps `reconciled_at` — including the equal-cost no-op path. Every refund is a single atomic conditional `DELETE ... WHERE reconciled_at IS NULL RETURNING id`; rowcount 0 = money already settled = no refund. ALL final-commit exceptions (not just `CancelledError`) route through the marker resolver; resolver failure must NEVER fall through to a blind refund (leave predebit standing, log `*.unresolved`). Do not reintroduce read-then-act refund logic.
- Quote search billing: `reason="quote_search"`, predebit 15 (balanced estimate), reconcile to actual; verified-empty results charge actual cost. Chat-routed quote searches bill through the chat message's own ledger row (predebit forced to 15 when the strict trigger fires, regardless of selected mode) — never a second row.
- **`ChatRequest` exposes only `mode` field** (`quick`/`balanced`; legacy `thorough` is retired). `model` field removed — prevents billing bypass
- Stripe webhook: `checkout.session.completed` for subscriptions only updates plan (no credits); `invoice.payment_succeeded` grants monthly credits (idempotent by invoice.id)
- `POST /api/billing/cancel` is self-serve and records optional `cancel_reason`, `cancel_feedback`, and `refund_requested` metadata in `plan_transitions`. `refund_requested` is an internal review flag; do not issue Stripe refunds from this path unless an explicit refund workflow is added.

## Parse Worker
- `time_limit=600`, `soft_time_limit=540`, `autoretry_for=(Exception,)`, max 2 retries, 60s backoff
- Idempotent re-parse: **delete Qdrant vectors (by `document_id` filter) BEFORE deleting DB pages/chunks**. Ordering matters — a Qdrant outage must leave the existing rows intact (set error + return), else the two stores diverge / data is lost. Then re-index.
- **PDF page text is persisted forward-only (v0.24.0)**: the extract pass stores `page.get_text("text")` per page into `pages.content` (previously NULL for all PDFs). Legacy docs keep NULL until re-parsed. `get_document_text_content` uses page mode ONLY when coverage is complete and consecutive (`1..page_count`, all non-blank); otherwise chunk fallback.
- **OCR trigger = `detect_scanned` (no text layer) OR `detect_low_quality_text` (PDF text layer present but garbled — broken-font cmap, Unicode-aware quality score)**. R2b fix for docs like U13 that have garbage text and so were never detected as "scanned".
- **OCR language is content-based**: `detect_script_osd` runs `tesseract --psm 0` (OSD) on sample pages → `resolve_ocr_languages(locale, script)` returns a NARROW set (script family, ≤3, **no `eng` for non-Latin** — it injects Latin noise). Never the kitchen-sink set (causes cross-script hallucination); locale only refines within a script family. Adopt a low-quality re-OCR only if it beats the text-layer quality. Persist `parse_version`/`parse_method`/`text_quality`/`ocr_languages` on the doc.
- Backfill stale/low-quality docs with `scripts/find_low_quality_docs.py` (skips `parse_version>=current` unless `--force`).

## Verified Quote Pipeline (M2, v0.24.0 — Codex 6-round consensus; do not weaken)
- **The guarantee**: a quote card is NEVER rendered from LLM-emitted text. `verify_quote()` (M1 substrate) gates every proposal; display text is ALWAYS the raw source slice. Flagged-tier (fuzzy 90–95) results are discarded from cards, only counted.
- **Verification source** (`quote_source_service`): all pages in the chunk's range have `Page.content` → per-page verification, kind=`page_text`; else cited chunk ± neighbors, kind=`extracted_text`. Trust labels derive from kind and are honest per-kind (word-for-word claim only for `page_text`).
- **Page attribution derives from the VERIFIED slice** (plan §8.1): multi-page `extracted_text` segments are DISCARDED (`ambiguous_page_range`); `page_text` duplicates emit one card per matching page. Never attribute via majority-bbox voting.
- **Chat routing is deterministic-safe**: auto-route to the billed pipeline ONLY when the strict trigger matches AND zero negation/metalinguistic tokens appear anywhere in the message; otherwise the ordinary RAG path runs with `quote_finder_hint`/`quote_finder_topic` on the SSE `done` event (frontend chip). Guarded triggers FORCE the RAG path — never a tool action. Do not re-attempt regex intent-scope resolution; the policy is adjudicated (asymmetric loss).
- **Saved quotes re-verify server-side**: the save endpoint accepts only `chunk_id + quote_text` and re-derives tier/score/page/kind via `verify_saved_quote()`; client-supplied trust fields would forge "verified" cards. Fabrication = 422 `QUOTE_NOT_VERIFIABLE`. Saved rows snapshot trust fields at save time (survive reparses; `source_chunk_id` is ON DELETE SET NULL).
- Caps: `FREE_SAVED_QUOTES_LIMIT=30` counts ACTIVE rows per user across documents; delete frees a slot; idempotent re-saves are never capped.

## Auth
- **`FOR UPDATE` lock** on verification tokens to prevent TOCTOU
- Internal Auth Adapter API uses `X-Adapter-Secret` header

## Error Handling
- Use `HTTPException` (not `JSONResponse`) for all non-SSE endpoints
- Lifespan pattern (`@asynccontextmanager`) instead of deprecated `@app.on_event`

## Demo System
- 3 seed PDFs auto-deployed at startup from `backend/seed_data/`. Self-healing covers BOTH stores: Qdrant vector loss → full re-seed; missing MinIO objects → `_ensure_demo_files` stats each doc's `storage_key` and re-uploads from seed_data (id/key-preserving). Added after the 2026-08 MinIO-v2 migration silently lost ~106/108 stored files (chat worked, PDF pane didn't). Seed assets are immutable per slug — the stat→put TOCTOU is accepted on that invariant.
- Anonymous limits (v0.23.0): **5 msgs per (IP, document) per 24h** (matches marketing copy), session cap = 500 per doc counted over a **24h rolling window of anonymous sessions only**, 10 req/min/IP, forced DeepSeek V4 Flash. Nightly beat task prunes empty demo sessions >7d (anon AND authed).
- Free-plan authed users get a per-user session cap on demo docs (`FREE_MAX_SESSIONS_PER_DOC`, own sessions only) — closes the row-spam DoS on the anonymous cap.
- Logged-in users accessing demo docs use their credits with no message limit

## Testing
- **Integration tests NEVER touch the shared dev DB.** `tests/conftest.py` forces a scratch `doctalk_test` database (auto-provisioned + migrated) and hard-refuses non-loopback hosts unless `DOCTALK_TEST_DATABASE_URL` is explicitly set. Two dev-DB wipe incidents (2026-08-02: alembic downgrade-base; integration fixtures) led to this — do not weaken it back to setdefault/conditional form. Never run `alembic downgrade` against `doctalk`.

exec
/bin/zsh -lc 'git log --oneline e499bc7..HEAD && git diff --stat e499bc7..HEAD && git diff --name-only e499bc7..HEAD' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
9da2bc4 docs(review): correct P1 r2 request to actual per-branch sync impl (2d4e01a)
2e5066e docs(review): P1 hygiene Codex r2 request
2d4e01a fix(chat): sync persisted domain_mode on ALL successful early returns
bb79453 fix: Pro-tier document cap dead-end + openPaywall comment accuracy (Codex P1)
337f981 docs(review): P1 hygiene Codex r1 (REVISE — Pro dead-end + 2 P3)
 .../2026-08-03-p1-hygiene-codex-r2-request.md      |    18 +
 .collab/reviews/2026-08-03-p1-hygiene-codex-r1.md  | 11959 +++++++++++++++++++
 backend/app/services/chat_service.py               |    43 +-
 backend/tests/test_quote_intent_routing.py         |   102 +
 frontend/src/i18n/locales/ar.json                  |     1 +
 frontend/src/i18n/locales/de.json                  |     1 +
 frontend/src/i18n/locales/en.json                  |     1 +
 frontend/src/i18n/locales/es.json                  |     1 +
 frontend/src/i18n/locales/fr.json                  |     1 +
 frontend/src/i18n/locales/hi.json                  |     1 +
 frontend/src/i18n/locales/it.json                  |     1 +
 frontend/src/i18n/locales/ja.json                  |     1 +
 frontend/src/i18n/locales/ko.json                  |     1 +
 frontend/src/i18n/locales/pt.json                  |     1 +
 frontend/src/i18n/locales/zh.json                  |     1 +
 frontend/src/lib/errorCopy.ts                      |    49 +-
 16 files changed, 12170 insertions(+), 12 deletions(-)
.collab/dialogue/2026-08-03-p1-hygiene-codex-r2-request.md
.collab/reviews/2026-08-03-p1-hygiene-codex-r1.md
backend/app/services/chat_service.py
backend/tests/test_quote_intent_routing.py
frontend/src/i18n/locales/ar.json
frontend/src/i18n/locales/de.json
frontend/src/i18n/locales/en.json
frontend/src/i18n/locales/es.json
frontend/src/i18n/locales/fr.json
frontend/src/i18n/locales/hi.json
frontend/src/i18n/locales/it.json
frontend/src/i18n/locales/ja.json
frontend/src/i18n/locales/ko.json
frontend/src/i18n/locales/pt.json
frontend/src/i18n/locales/zh.json
frontend/src/lib/errorCopy.ts

codex
The changed production surface is narrow: `errorCopy.ts` plus locale strings on the frontend, and `chat_service.py` plus two regression tests on the backend. I’m now tracing callers and control flow beyond the diff so a nearby fast-path cannot hide outside the edited hunks.
exec
/bin/zsh -lc "rg -n \"_sync_session_domain_mode|domain_mode|_tool_action_stream|strict_quote|overview|summar|return|yield\" backend/app/services/chat_service.py backend/app/api backend/app --glob '*.py'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
backend/app/services/chat_service.py:75:    return {"event": event, "data": data}
backend/app/services/chat_service.py:88:    """Log detailed error server-side, return sanitized SSE payload to client."""
backend/app/services/chat_service.py:90:    return sse(event, {"code": code, "message": _USER_SAFE_ERRORS.get(code, "An error occurred.")})
backend/app/services/chat_service.py:112:    return (locale or "").strip().lower().replace("_", "-").split("-")[0]
backend/app/services/chat_service.py:152:    return template.format(**fmt)
backend/app/services/chat_service.py:155:def _is_strict_quote_routed(
backend/app/services/chat_service.py:169:    return (
backend/app/services/chat_service.py:182:        return _LOCALE_LANGUAGE_LABELS[normalized]
backend/app/services/chat_service.py:186:        return "Japanese"
backend/app/services/chat_service.py:188:        return "Korean"
backend/app/services/chat_service.py:190:        return "Chinese"
backend/app/services/chat_service.py:192:        return "Arabic"
backend/app/services/chat_service.py:194:        return "Hindi"
backend/app/services/chat_service.py:195:    return None
backend/app/services/chat_service.py:201:    return (
backend/app/services/chat_service.py:213:    return (
backend/app/services/chat_service.py:218:        "Do not translate, restart, summarize, or switch to English.\n"
backend/app/services/chat_service.py:233:    return _openai_client
backend/app/services/chat_service.py:237:    return model in settings.DEEPSEEK_OFFICIAL_MODELS
backend/app/services/chat_service.py:249:    return _deepseek_client
backend/app/services/chat_service.py:254:        return _get_deepseek_client()
backend/app/services/chat_service.py:255:    return _get_openai_client()
backend/app/services/chat_service.py:270:    return all(isinstance(bb.get(k), (int, float)) for k in ("x", "y", "w", "h"))
backend/app/services/chat_service.py:276:    is_summary = chunk.retrieval_modality == "summary"
backend/app/services/chat_service.py:277:    all_bbs = [] if is_summary else [
backend/app/services/chat_service.py:317:    if not is_summary and claim_text and chunk.text:
backend/app/services/chat_service.py:334:    if is_summary:
backend/app/services/chat_service.py:336:        citation_data["summary_target_sections"] = list(chunk.summary_target_sections)
backend/app/services/chat_service.py:337:        citation_data["summary_model_covered_sections"] = list(chunk.summary_model_covered_sections)
backend/app/services/chat_service.py:338:        citation_data["summary_fallback_sections"] = list(chunk.summary_fallback_sections)
backend/app/services/chat_service.py:339:        citation_data["summary_missing_sections"] = list(chunk.summary_missing_sections)
backend/app/services/chat_service.py:344:    return citation_data
backend/app/services/chat_service.py:358:    return features
backend/app/services/chat_service.py:373:            return anchors
backend/app/services/chat_service.py:376:        return anchors
backend/app/services/chat_service.py:379:    return [(len(text), stripped)] if stripped else []
backend/app/services/chat_service.py:392:    a cited-answer product from returning an uncited response when retrieval
backend/app/services/chat_service.py:396:        return []
backend/app/services/chat_service.py:422:    return fallback
backend/app/services/chat_service.py:441:    return clean_text, citations
backend/app/services/chat_service.py:456:    return total
backend/app/services/chat_service.py:465:        return True
backend/app/services/chat_service.py:467:        return True
backend/app/services/chat_service.py:468:    return repaired_issues == initial_issues and repaired_score >= initial_score + 0.15
backend/app/services/chat_service.py:485:        return None
backend/app/services/chat_service.py:557:        return _CitationRepairResult(
backend/app/services/chat_service.py:569:        return _CitationRepairResult(
backend/app/services/chat_service.py:581:    return (
backend/app/services/chat_service.py:603:        return ""
backend/app/services/chat_service.py:605:        return ""
backend/app/services/chat_service.py:616:        return f"{word} {ps}" if pe == ps else f"{word}s {ps}–{pe}"
backend/app/services/chat_service.py:620:        return rng("page")
backend/app/services/chat_service.py:622:        return rng("slide")
backend/app/services/chat_service.py:624:        return f"sheet {ps}"
backend/app/services/chat_service.py:625:    return rng("document part")
backend/app/services/chat_service.py:636:    if str(item.get("retrieval_modality") or "text") == "summary":
backend/app/services/chat_service.py:649:            parts.append(f"source range: {rng} (summary coverage)")
backend/app/services/chat_service.py:656:    return "; ".join(parts)
backend/app/services/chat_service.py:660:    return (
backend/app/services/chat_service.py:667:        "- \"summary coverage\" ranges are approximate; never use them for exact quotations — quote only "
backend/app/services/chat_service.py:675:    return (
backend/app/services/chat_service.py:699:        return "(none)"
backend/app/services/chat_service.py:702:    return ", ".join(shown) + suffix
backend/app/services/chat_service.py:705:def _summary_coverage_contract(retrieved: list[dict[str, Any]]) -> str:
backend/app/services/chat_service.py:711:        if item.get("retrieval_modality") != "summary":
backend/app/services/chat_service.py:720:        return ""
backend/app/services/chat_service.py:721:    return (
backend/app/services/chat_service.py:734:        return ""
backend/app/services/chat_service.py:741:    return (
backend/app/services/chat_service.py:752:        return ""
backend/app/services/chat_service.py:760:    return (
backend/app/services/chat_service.py:772:        return ""
backend/app/services/chat_service.py:773:    return re.sub(r"[^a-z0-9_\-]+", "-", label)[:40]
backend/app/services/chat_service.py:811:        .returning(CreditLedger.id)
backend/app/services/chat_service.py:825:    return refunded
backend/app/services/chat_service.py:845:        return None
backend/app/services/chat_service.py:858:        return asst_msg.id
backend/app/services/chat_service.py:869:        return False
backend/app/services/chat_service.py:874:            return False
backend/app/services/chat_service.py:882:        return True
backend/app/services/chat_service.py:951:            return await _refund_predebit(settle_db, user_id, pre_debited, predebit_ledger_id)
backend/app/services/chat_service.py:953:    return await _refund_predebit(db, user_id, pre_debited, predebit_ledger_id)
backend/app/services/chat_service.py:956:async def _sync_session_domain_mode(
backend/app/services/chat_service.py:957:    db: AsyncSession, session_obj: ChatSession, domain_mode: Optional[str],
backend/app/services/chat_service.py:960:    ChatSession.domain_mode must reflect the CURRENT request's domain_mode
backend/app/services/chat_service.py:963:    Codex found two successful early-return paths that skipped it — tool
backend/app/services/chat_service.py:964:    actions and strict Quote Finder routing — both returning before the
backend/app/services/chat_service.py:966:    that once had domain_mode="legal" persisted could keep that stale
backend/app/services/chat_service.py:972:    `domain_mode` argument directly, never re-reads session_obj.domain_mode
backend/app/services/chat_service.py:976:    if domain_mode != session_obj.domain_mode:
backend/app/services/chat_service.py:977:        session_obj.domain_mode = domain_mode
backend/app/services/chat_service.py:1003:    return [chunk_to_retrieval_item(ch, 1.0, include_document_id=True) for ch in chunks]
backend/app/services/chat_service.py:1069:    summary_target_sections: tuple[str, ...] = ()
backend/app/services/chat_service.py:1070:    summary_model_covered_sections: tuple[str, ...] = ()
backend/app/services/chat_service.py:1071:    summary_fallback_sections: tuple[str, ...] = ()
backend/app/services/chat_service.py:1072:    summary_missing_sections: tuple[str, ...] = ()
backend/app/services/chat_service.py:1103:    quote_search() returns (before any commit) so accurate billing is
backend/app/services/chat_service.py:1105:    ONLY after the atomic commit's await ACTUALLY returns — kept for
backend/app/services/chat_service.py:1129:    if citation.get("retrieval_modality") == "summary":
backend/app/services/chat_service.py:1130:        return _ChunkInfo(
backend/app/services/chat_service.py:1136:            section_title="Map-reduce section summary",
backend/app/services/chat_service.py:1140:            retrieval_modality="summary",
backend/app/services/chat_service.py:1141:            summary_target_sections=tuple(citation.get("summary_target_sections") or ()),
backend/app/services/chat_service.py:1142:            summary_model_covered_sections=tuple(citation.get("summary_model_covered_sections") or ()),
backend/app/services/chat_service.py:1143:            summary_fallback_sections=tuple(citation.get("summary_fallback_sections") or ()),
backend/app/services/chat_service.py:1144:            summary_missing_sections=tuple(citation.get("summary_missing_sections") or ()),
backend/app/services/chat_service.py:1149:    return _ChunkInfo(
backend/app/services/chat_service.py:1185:    caller reconciles this call's cost like summary usage. Gated + non-raising:
backend/app/services/chat_service.py:1192:        return _skip
backend/app/services/chat_service.py:1197:        return _skip
backend/app/services/chat_service.py:1216:        return (changed, focus_model, focus_pt, focus_ct)
backend/app/services/chat_service.py:1219:        return _skip
backend/app/services/chat_service.py:1222:        return _skip
backend/app/services/chat_service.py:1276:        return events
backend/app/services/chat_service.py:1283:        return events
backend/app/services/chat_service.py:1309:    async def _tool_action_stream(
backend/app/services/chat_service.py:1317:        domain_mode: Optional[str],
backend/app/services/chat_service.py:1329:                yield sse("tool_status", {"message": action_plan.user_visible_status})
backend/app/services/chat_service.py:1337:                domain_mode=domain_mode,
backend/app/services/chat_service.py:1342:                yield sse("artifact", artifact_payload)
backend/app/services/chat_service.py:1344:                yield sse("token", {"text": assistant_text})
backend/app/services/chat_service.py:1362:            yield sse(
backend/app/services/chat_service.py:1375:            yield _safe_sse("error", "CHAT_SETUP_ERROR", exc, session_id=str(session_id))
backend/app/services/chat_service.py:1394:        of it awaited here, nothing yielded. `progress` is mutated as this
backend/app/services/chat_service.py:1395:        proceeds (model/tokens as soon as quote_search() returns,
backend/app/services/chat_service.py:1439:                summary=assistant_text,
backend/app/services/chat_service.py:1511:        # returned — the ordinary-exception handler (FIX-4) uses this to
backend/app/services/chat_service.py:1515:        return _VerifiedQuoteOutcome(
backend/app/services/chat_service.py:1530:        domain_mode: Optional[str] = None,
backend/app/services/chat_service.py:1541:        7) Parse with RefParserFSM and yield events; ping every 15s
backend/app/services/chat_service.py:1550:            yield sse("error", {"code": "SESSION_NOT_FOUND", "message": "会话不存在"})
backend/app/services/chat_service.py:1551:            return
backend/app/services/chat_service.py:1596:                yield sse(
backend/app/services/chat_service.py:1604:                return
backend/app/services/chat_service.py:1613:            # early-return path skipped the domain_mode session sync that
backend/app/services/chat_service.py:1615:            # _sync_session_domain_mode's docstring.
backend/app/services/chat_service.py:1616:            await _sync_session_domain_mode(db, session_obj, domain_mode)
backend/app/services/chat_service.py:1617:            async for ev in self._tool_action_stream(
backend/app/services/chat_service.py:1623:                domain_mode=domain_mode,
backend/app/services/chat_service.py:1628:                yield ev
backend/app/services/chat_service.py:1629:            return
backend/app/services/chat_service.py:1634:            domain_mode=domain_mode,
backend/app/services/chat_service.py:1640:        strict_quote_routed = _is_strict_quote_routed(
backend/app/services/chat_service.py:1653:                if strict_quote_routed
backend/app/services/chat_service.py:1660:                reason="chat", ref_type="mode", ref_id="balanced" if strict_quote_routed else effective_mode,
backend/app/services/chat_service.py:1667:                yield sse(
backend/app/services/chat_service.py:1676:                return
backend/app/services/chat_service.py:1695:            # than erroring. SAME predicate (`strict_quote_routed`, computed
backend/app/services/chat_service.py:1699:            if strict_quote_routed:
backend/app/services/chat_service.py:1784:                            yield _safe_sse("error", "QUOTE_SEARCH_ERROR", exc, session_id=str(session_id))
backend/app/services/chat_service.py:1785:                            return
backend/app/services/chat_service.py:1797:                            yield _safe_sse(
backend/app/services/chat_service.py:1800:                            return
backend/app/services/chat_service.py:1802:                        yield _safe_sse("error", "QUOTE_SEARCH_ERROR", exc, session_id=str(session_id))
backend/app/services/chat_service.py:1803:                        return
backend/app/services/chat_service.py:1806:                # mark settled BEFORE yielding so a cancellation during these
backend/app/services/chat_service.py:1807:                # yields can't ALSO trigger the setup handler's full refund
backend/app/services/chat_service.py:1811:                # early-return path also skipped the domain_mode session
backend/app/services/chat_service.py:1812:                # sync — see _sync_session_domain_mode's docstring.
backend/app/services/chat_service.py:1813:                await _sync_session_domain_mode(db, session_obj, domain_mode)
backend/app/services/chat_service.py:1815:                    yield sse("artifact", outcome.artifact_payload)
backend/app/services/chat_service.py:1816:                yield sse("token", {"text": outcome.assistant_text})
backend/app/services/chat_service.py:1817:                yield sse(
backend/app/services/chat_service.py:1828:                return
backend/app/services/chat_service.py:1848:            # Whole-document summaries must not use ordinary semantic top-k: vague
backend/app/services/chat_service.py:1849:            # summary prompts frequently retrieve tables/appendices instead of
backend/app/services/chat_service.py:1856:            summary_usage = MapReduceUsageCollector()
backend/app/services/chat_service.py:1862:                yield sse("tool_status", {"message": "Summarizing the document section by section…"})
backend/app/services/chat_service.py:1863:                retrieved = await document_brief_service.get_summary_context(
backend/app/services/chat_service.py:1867:                    usage_collector=summary_usage,
backend/app/services/chat_service.py:1869:                retrieval_strategy = "document_summary_context"
backend/app/services/chat_service.py:1875:                retrieved = await document_brief_service.get_collection_summary_context(
backend/app/services/chat_service.py:1881:                retrieval_strategy = "collection_summary_context"
backend/app/services/chat_service.py:1941:            has_map_reduce_summary_context = any(
backend/app/services/chat_service.py:1942:                item.get("retrieval_modality") == "summary"
backend/app/services/chat_service.py:1982:                    summary_target_sections=tuple(item.get("map_reduce_target_sections") or ()),
backend/app/services/chat_service.py:1983:                    summary_model_covered_sections=tuple(
backend/app/services/chat_service.py:1986:                    summary_fallback_sections=tuple(item.get("map_reduce_fallback_sections") or ()),
backend/app/services/chat_service.py:1987:                    summary_missing_sections=tuple(item.get("map_reduce_missing_sections") or ()),
backend/app/services/chat_service.py:1994:            if is_collection_session and retrieval_strategy == "collection_summary_context":
backend/app/services/chat_service.py:1997:                    "You are a document analysis assistant. The user is asking for a broad summary across a document collection.\n\n"
backend/app/services/chat_service.py:2024:            elif retrieval_strategy == "document_summary_context":
backend/app/services/chat_service.py:2026:                    "7. The sources may be map-reduce section summaries generated from source chunks; "
backend/app/services/chat_service.py:2028:                    if has_map_reduce_summary_context
backend/app/services/chat_service.py:2032:                    "You are a document analysis assistant. The user is asking for a broad, whole-document summary.\n\n"
backend/app/services/chat_service.py:2043:                    + "3. Produce a useful document-level summary with clear headings, key points, and important caveats when supported.\n"
backend/app/services/chat_service.py:2048:                    + _summary_coverage_contract(retrieved)
backend/app/services/chat_service.py:2074:            # Frontend always sends domain_mode: null (default) or "legal"/"academic"
backend/app/services/chat_service.py:2075:            # domain_mode=None means Default (no extra rules), string means apply rules
backend/app/services/chat_service.py:2076:            if domain_mode:
backend/app/services/chat_service.py:2078:                domain_rules = DOMAIN_RULES.get(domain_mode)
backend/app/services/chat_service.py:2081:                    domain_rules_text = f"\n\n## {domain_mode.title()} Mode Rules\n"
backend/app/services/chat_service.py:2090:            # Persist domain_mode to session (null clears, string sets) —
backend/app/services/chat_service.py:2091:            # see _sync_session_domain_mode's docstring; this is the main
backend/app/services/chat_service.py:2093:            # Quote Finder early returns above (P1 hygiene, Codex 2026-08-03).
backend/app/services/chat_service.py:2094:            await _sync_session_domain_mode(db, session_obj, domain_mode)
backend/app/services/chat_service.py:2141:            yield _safe_sse("error", setup_error_code, e, session_id=str(session_id))
backend/app/services/chat_service.py:2142:            return
backend/app/services/chat_service.py:2157:            yield _safe_sse("error", "LLM_ERROR", e, session_id=str(session_id))
backend/app/services/chat_service.py:2158:            return
backend/app/services/chat_service.py:2223:                            yield ev
backend/app/services/chat_service.py:2237:                        yield sse("ping", {})
backend/app/services/chat_service.py:2244:                    yield ev
backend/app/services/chat_service.py:2257:                            yield sse("citation", citation)
backend/app/services/chat_service.py:2265:                    yield sse("truncated", {"reason": "max_tokens"})
backend/app/services/chat_service.py:2293:                yield _safe_sse("error", "LLM_ERROR", e, session_id=str(session_id))
backend/app/services/chat_service.py:2294:                return
backend/app/services/chat_service.py:2327:                yield sse("error", {"code": "PERSIST_FAILED", "message": "Failed to save response"})
backend/app/services/chat_service.py:2328:                return
backend/app/services/chat_service.py:2338:                yield sse("tool_status", {"message": "Checking citation support..."})
backend/app/services/chat_service.py:2368:                        yield sse(
backend/app/services/chat_service.py:2390:                yield sse("tool_status", {"message": "Refining citations..."})
backend/app/services/chat_service.py:2400:                yield sse("citations_refined", {"citations": citations})
backend/app/services/chat_service.py:2412:                yield sse("error", {"code": "PERSIST_FAILED", "message": "Failed to save response"})
backend/app/services/chat_service.py:2413:                return
backend/app/services/chat_service.py:2432:                    summary_usage_costs: list[tuple[str, int, int, int]] = []
backend/app/services/chat_service.py:2433:                    for usage_model, (summary_prompt, summary_completion) in summary_usage.totals_by_model().items():
backend/app/services/chat_service.py:2434:                        summary_mode = "quick" if usage_model == settings.MODE_MODELS.get("quick") else None
backend/app/services/chat_service.py:2435:                        summary_cost = credit_service.calculate_cost(
backend/app/services/chat_service.py:2436:                            summary_prompt,
backend/app/services/chat_service.py:2437:                            summary_completion,
backend/app/services/chat_service.py:2439:                            mode=summary_mode,
backend/app/services/chat_service.py:2441:                        summary_usage_costs.append(
backend/app/services/chat_service.py:2442:                            (usage_model, summary_prompt, summary_completion, summary_cost)
backend/app/services/chat_service.py:2445:                    # reconciled + recorded like summary usage.
backend/app/services/chat_service.py:2453:                        + sum(item[3] for item in summary_usage_costs)
backend/app/services/chat_service.py:2468:                    for usage_model, summary_prompt, summary_completion, summary_cost in summary_usage_costs:
backend/app/services/chat_service.py:2474:                            prompt_tokens=summary_prompt,
backend/app/services/chat_service.py:2475:                            completion_tokens=summary_completion,
backend/app/services/chat_service.py:2476:                            cost_credits=summary_cost,
backend/app/services/chat_service.py:2492:                    yield _safe_sse("warn", "ACCOUNTING_ERROR", e, session_id=str(session_id))
backend/app/services/chat_service.py:2497:            yield sse("done", {
backend/app/services/chat_service.py:2582:            yield sse("error", {"code": "SESSION_NOT_FOUND", "message": "Session not found"})
backend/app/services/chat_service.py:2583:            return
backend/app/services/chat_service.py:2626:            yield sse("error", {"code": "MESSAGE_NOT_FOUND", "message": "Assistant message not found"})
backend/app/services/chat_service.py:2627:            return
backend/app/services/chat_service.py:2630:            yield sse("error", {"code": "MESSAGE_NOT_FOUND", "message": "Message does not belong to this session"})
backend/app/services/chat_service.py:2631:            return
backend/app/services/chat_service.py:2635:            yield sse("error", {"code": "CONTINUATION_LIMIT", "message": "Maximum continuations reached"})
backend/app/services/chat_service.py:2636:            return
backend/app/services/chat_service.py:2649:                yield sse(
backend/app/services/chat_service.py:2657:                return
backend/app/services/chat_service.py:2673:                yield sse("error", {
backend/app/services/chat_service.py:2679:                return
backend/app/services/chat_service.py:2868:            yield _safe_sse("error", "CHAT_SETUP_ERROR", e, session_id=str(session_id))
backend/app/services/chat_service.py:2869:            return
backend/app/services/chat_service.py:2884:            yield _safe_sse("error", "LLM_ERROR", e, session_id=str(session_id))
backend/app/services/chat_service.py:2885:            return
backend/app/services/chat_service.py:2935:                            yield ev
backend/app/services/chat_service.py:2946:                        yield sse("ping", {})
backend/app/services/chat_service.py:2952:                    yield ev
backend/app/services/chat_service.py:2969:                            yield sse("citation", citation)
backend/app/services/chat_service.py:2972:                    yield sse("truncated", {"reason": "max_tokens"})
backend/app/services/chat_service.py:2991:                yield _safe_sse("error", "LLM_ERROR", e, session_id=str(session_id))
backend/app/services/chat_service.py:2992:                return
backend/app/services/chat_service.py:3022:                yield sse("error", {"code": "PERSIST_FAILED", "message": "Failed to save continuation"})
backend/app/services/chat_service.py:3023:                return
backend/app/services/chat_service.py:3033:                yield sse("tool_status", {"message": "Checking citation support..."})
backend/app/services/chat_service.py:3062:                        yield sse(
backend/app/services/chat_service.py:3084:                yield sse("tool_status", {"message": "Refining citations..."})
backend/app/services/chat_service.py:3094:                yield sse("citations_refined", {"citations": merged_citations})
backend/app/services/chat_service.py:3103:                yield sse("error", {"code": "PERSIST_FAILED", "message": "Failed to save continuation"})
backend/app/services/chat_service.py:3104:                return
backend/app/services/chat_service.py:3154:                    yield _safe_sse("warn", "ACCOUNTING_ERROR", e, session_id=str(session_id))
backend/app/services/chat_service.py:3159:            yield sse("done", {
backend/app/api/document_diffs.py:73:    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quote(clean, safe='')}"
backend/app/api/document_diffs.py:79:    return job.__dict__.get("extraction_result")
backend/app/api/document_diffs.py:93:    return DocumentDiffRunResponse(
backend/app/api/document_diffs.py:112:        return
backend/app/api/document_diffs.py:135:    return doc
backend/app/api/document_diffs.py:151:    return collection
backend/app/api/document_diffs.py:255:    return job
backend/app/api/document_diffs.py:289:    return _run_response(job)
backend/app/api/document_diffs.py:310:    return [_run_response(job) for job in rows.scalars()]
backend/app/api/document_diffs.py:332:    return _run_response(job)
backend/app/api/document_diffs.py:359:        return StreamingResponse(
backend/app/api/document_diffs.py:364:    return StreamingResponse(
backend/app/api/chunks.py:59:    return {
backend/app/api/credits.py:45:    return {
backend/app/api/credits.py:86:    return {
backend/app/services/document_brief_service.py:33:MAP_REDUCE_SUMMARY_CACHE_KEY = "map_reduce_summary_context"
backend/app/services/document_brief_service.py:34:MAP_REDUCE_PROMPT_VERSION = "summary_map_reduce_v2"
backend/app/services/document_brief_service.py:48:    summary: str
backend/app/services/document_brief_service.py:72:    summary: str
backend/app/services/document_brief_service.py:104:            return
backend/app/services/document_brief_service.py:122:        return totals
backend/app/services/document_brief_service.py:139:    return len((getattr(chunk, "text", "") or "").strip())
backend/app/services/document_brief_service.py:143:    return str(getattr(chunk, "section_title", "") or "").strip()[:200]
backend/app/services/document_brief_service.py:152:        return False
backend/app/services/document_brief_service.py:154:        return True
backend/app/services/document_brief_service.py:156:        return True
backend/app/services/document_brief_service.py:158:        return True
backend/app/services/document_brief_service.py:159:    return bool(re.fullmatch(r"[\d\s\.,;:()\[\]{}#\-_/]+", normalized))
backend/app/services/document_brief_service.py:164:    return bool(raw_title) and _is_noisy_section_title(raw_title)
backend/app/services/document_brief_service.py:181:    return data
backend/app/services/document_brief_service.py:187:        return section[:200]
backend/app/services/document_brief_service.py:190:        return f"Page {page}"
backend/app/services/document_brief_service.py:191:    return "Untitled"
backend/app/services/document_brief_service.py:203:    return tuple(result)
backend/app/services/document_brief_service.py:208:    return tuple(section for section in target_sections if section and section not in covered)
backend/app/services/document_brief_service.py:220:        return min_groups
backend/app/services/document_brief_service.py:222:    return max(min_groups, min(max_groups, groups))
backend/app/services/document_brief_service.py:225:def _dynamic_summary_chunk_budget(
backend/app/services/document_brief_service.py:236:    return min(max_total_chunks_cap, max(1, budget))
backend/app/services/document_brief_service.py:271:    return segments
backend/app/services/document_brief_service.py:280:        return []
backend/app/services/document_brief_service.py:306:    return result
backend/app/services/document_brief_service.py:346:        return self._map_model
backend/app/services/document_brief_service.py:350:        return self._reduce_model
backend/app/services/document_brief_service.py:354:        return MAP_REDUCE_PROMPT_VERSION
backend/app/services/document_brief_service.py:397:            return group
backend/app/services/document_brief_service.py:410:        return SectionMapGroup(
backend/app/services/document_brief_service.py:435:        summary = f"Group {group.group_index} covers {len(covered_sections)} sections."
backend/app/services/document_brief_service.py:436:        return MapStepResult(
backend/app/services/document_brief_service.py:438:            summary=summary,
backend/app/services/document_brief_service.py:456:        return "\n\n".join(parts)
backend/app/services/document_brief_service.py:499:                return _json_from_text(content)
backend/app/services/document_brief_service.py:538:        return selected
backend/app/services/document_brief_service.py:549:                return chunk
backend/app/services/document_brief_service.py:550:        return group.chunks[0] if group.chunks else None
backend/app/services/document_brief_service.py:559:            "You are the map step in a document map-reduce summary pipeline.\n"
backend/app/services/document_brief_service.py:562:            '{"group_summary": string, "sections": ['
backend/app/services/document_brief_service.py:563:            '{"title": string, "summary": string, "source_refs": [number]}'
backend/app/services/document_brief_service.py:568:            "- Keep each section summary concise and factual.\n\n"
backend/app/services/document_brief_service.py:598:            section_summary = str(raw_item.get("summary") or "").strip()
backend/app/services/document_brief_service.py:599:            model_returned_summary = bool(section_summary)
backend/app/services/document_brief_service.py:600:            if not section_summary:
backend/app/services/document_brief_service.py:602:                section_summary = ((getattr(section_chunk, "text", "") or "").strip()[:500])
backend/app/services/document_brief_service.py:603:                if section_summary:
backend/app/services/document_brief_service.py:615:                    if model_returned_summary:
backend/app/services/document_brief_service.py:625:            lines.append(f"- {title}: {section_summary}")
backend/app/services/document_brief_service.py:627:        group_summary = str(data.get("group_summary") or "").strip()
backend/app/services/document_brief_service.py:628:        summary = "\n".join(
backend/app/services/document_brief_service.py:629:            part for part in (f"Group summary: {group_summary}" if group_summary else "", *lines) if part
backend/app/services/document_brief_service.py:631:        return MapStepResult(
backend/app/services/document_brief_service.py:633:            summary=summary[:MAP_REDUCE_MAX_CONTEXT_ITEM_CHARS],
backend/app/services/document_brief_service.py:657:                    return ordered
backend/app/services/document_brief_service.py:658:        return ordered[:max_total_chunks]
backend/app/services/document_brief_service.py:664:        overview: str = "",
backend/app/services/document_brief_service.py:671:            if position == 0 and overview.strip():
backend/app/services/document_brief_service.py:672:                prefix = f"Full-document reduce summary:\n{overview.strip()}\n\n"
backend/app/services/document_brief_service.py:686:                f"{prefix}Section group {item.group_index + 1} map summary "
backend/app/services/document_brief_service.py:687:                f"coverage:\n- " + "\n- ".join(coverage_lines) + f"\n{item.summary}"
backend/app/services/document_brief_service.py:702:        return tuple(items)
backend/app/services/document_brief_service.py:713:        return tuple(covered)
backend/app/services/document_brief_service.py:716:        return self._mapped_sections(mapped, "covered_sections")
backend/app/services/document_brief_service.py:720:        return target or self._mapped_covered_sections(mapped)
backend/app/services/document_brief_service.py:723:        return self._mapped_sections(mapped, "model_covered_sections")
backend/app/services/document_brief_service.py:726:        return self._mapped_sections(mapped, "fallback_sections")
backend/app/services/document_brief_service.py:729:        return self._mapped_sections(mapped, "missing_sections")
backend/app/services/document_brief_service.py:746:                    return tuple(selected)
backend/app/services/document_brief_service.py:747:        return tuple(selected)
backend/app/services/document_brief_service.py:775:                "summary": item.summary,
backend/app/services/document_brief_service.py:780:            "You are the reduce step in a document map-reduce summary pipeline.\n"
backend/app/services/document_brief_service.py:781:            "Merge the map summaries into a compact, structured full-document brief.\n"
backend/app/services/document_brief_service.py:783:            '{"summary": string, "covered_sections": [string]}\n\n'
backend/app/services/document_brief_service.py:786:            "- Sections in fallback_sections were filled by deterministic source-text fallback; summarize them conservatively.\n"
backend/app/services/document_brief_service.py:789:            "- Use only the map summaries.\n\n"
backend/app/services/document_brief_service.py:792:            f"Map summaries:\n{json.dumps(mapped_payload, ensure_ascii=False)}"
backend/app/services/document_brief_service.py:802:        overview = str(data.get("summary") or "").strip()
backend/app/services/document_brief_service.py:803:        if not overview:
backend/app/services/document_brief_service.py:804:            overview = "\n".join(item.summary for item in sorted(mapped, key=lambda value: value.group_index))
backend/app/services/document_brief_service.py:805:        return MapReduceSummaryResult(
backend/app/services/document_brief_service.py:806:            summary=overview[:6000],
backend/app/services/document_brief_service.py:807:            context_items=self._context_items_from_mapped(mapped, overview=overview),
backend/app/services/document_brief_service.py:832:                return await self._llm_map_step(group, usage_collector=usage_collector)
backend/app/services/document_brief_service.py:835:            return await step(group)
backend/app/services/document_brief_service.py:853:            summary_lines: list[str] = []
backend/app/services/document_brief_service.py:865:                summary_lines.append(f"- {section}: {text}")
backend/app/services/document_brief_service.py:866:            if summary_lines:
backend/app/services/document_brief_service.py:867:                result_summary = (
backend/app/services/document_brief_service.py:868:                    result.summary.rstrip()
backend/app/services/document_brief_service.py:870:                    + "\n".join(summary_lines)
backend/app/services/document_brief_service.py:874:                    summary=result_summary[:MAP_REDUCE_MAX_CONTEXT_ITEM_CHARS],
backend/app/services/document_brief_service.py:887:        return MapStepResult(
backend/app/services/document_brief_service.py:889:            summary=result.summary,
backend/app/services/document_brief_service.py:923:        summary = (
backend/app/services/document_brief_service.py:924:            f"Deterministic fallback map summary ({reason}).\n"
backend/app/services/document_brief_service.py:927:        return MapStepResult(
backend/app/services/document_brief_service.py:929:            summary=summary[:MAP_REDUCE_MAX_CONTEXT_ITEM_CHARS],
backend/app/services/document_brief_service.py:962:            return_when=asyncio.ALL_COMPLETED,
backend/app/services/document_brief_service.py:968:            await asyncio.gather(*pending, return_exceptions=True)
backend/app/services/document_brief_service.py:970:        raw_results = await asyncio.gather(*tasks, return_exceptions=True)
backend/app/services/document_brief_service.py:994:        return mapped
backend/app/services/document_brief_service.py:1004:            return [], [], []
backend/app/services/document_brief_service.py:1008:            return ordered_chunks, [], []
backend/app/services/document_brief_service.py:1028:        return ordered_chunks, segments, prepared_groups
backend/app/services/document_brief_service.py:1030:    async def _select_chunks_for_summary(
backend/app/services/document_brief_service.py:1042:            return []
backend/app/services/document_brief_service.py:1044:            return list(ordered_chunks[:max_chunks])
backend/app/services/document_brief_service.py:1046:            return list(ordered_chunks[:max_chunks])
backend/app/services/document_brief_service.py:1048:        max_total_chunks = _dynamic_summary_chunk_budget(
backend/app/services/document_brief_service.py:1094:        return selected
backend/app/services/document_brief_service.py:1096:    async def select_chunks_for_summary(
backend/app/services/document_brief_service.py:1102:        return await self._select_chunks_for_summary(
backend/app/services/document_brief_service.py:1108:    def _fallback_summary_result(self, selected: Sequence[Any]) -> MapReduceSummaryResult:
backend/app/services/document_brief_service.py:1124:        return MapReduceSummaryResult(
backend/app/services/document_brief_service.py:1125:            summary="Fallback representative chunk selection.",
backend/app/services/document_brief_service.py:1136:    def _normalize_summary_result(
backend/app/services/document_brief_service.py:1150:            summary = reduced.summary
backend/app/services/document_brief_service.py:1159:            summary = "\n".join(item.summary for item in sorted(mapped, key=lambda value: value.group_index))
backend/app/services/document_brief_service.py:1216:            context_items = list(self._context_items_from_mapped(mapped, overview=summary))
backend/app/services/document_brief_service.py:1222:        return MapReduceSummaryResult(
backend/app/services/document_brief_service.py:1223:            summary=summary[:6000],
backend/app/services/document_brief_service.py:1234:    async def build_summary_context(
backend/app/services/document_brief_service.py:1246:            return MapReduceSummaryResult(
backend/app/services/document_brief_service.py:1247:                summary="",
backend/app/services/document_brief_service.py:1258:            selected = await self._select_chunks_for_summary(
backend/app/services/document_brief_service.py:1263:            return self._fallback_summary_result(selected)
backend/app/services/document_brief_service.py:1265:        max_total_chunks = _dynamic_summary_chunk_budget(
backend/app/services/document_brief_service.py:1300:        return self._normalize_summary_result(
backend/app/services/document_brief_service.py:1315:    This deliberately does not use query similarity. Whole-document summaries
backend/app/services/document_brief_service.py:1318:    prompts like "summarize this document".
backend/app/services/document_brief_service.py:1325:        return list(chunks[:max_chunks])
backend/app/services/document_brief_service.py:1327:        return list(usable)
backend/app/services/document_brief_service.py:1332:    # near the front, but cap it to avoid front-loaded summaries.
backend/app/services/document_brief_service.py:1376:    return [usable[idx] for idx in sorted(selected_indices)[:max_chunks]]
backend/app/services/document_brief_service.py:1380:    return {
backend/app/services/document_brief_service.py:1406:    return hasher.hexdigest()
backend/app/services/document_brief_service.py:1410:    return {
backend/app/services/document_brief_service.py:1433:    return {
backend/app/services/document_brief_service.py:1445:            "summary": result.summary,
backend/app/services/document_brief_service.py:1463:        return ()
backend/app/services/document_brief_service.py:1470:    return tuple(parsed)
backend/app/services/document_brief_service.py:1474:    return _ordered_unique(values if isinstance(values, list) else [])
backend/app/services/document_brief_service.py:1486:        return None
backend/app/services/document_brief_service.py:1488:        return None
backend/app/services/document_brief_service.py:1490:        return None
backend/app/services/document_brief_service.py:1492:        return None
backend/app/services/document_brief_service.py:1494:        return None
backend/app/services/document_brief_service.py:1496:        return None
backend/app/services/document_brief_service.py:1498:        return None
backend/app/services/document_brief_service.py:1501:        return None
backend/app/services/document_brief_service.py:1504:        return None
backend/app/services/document_brief_service.py:1533:        return None
backend/app/services/document_brief_service.py:1534:    return MapReduceSummaryResult(
backend/app/services/document_brief_service.py:1535:        summary=str(raw_result.get("summary") or "")[:6000],
backend/app/services/document_brief_service.py:1572:            "section_title": "Map-reduce section summary",
backend/app/services/document_brief_service.py:1574:            "retrieval_modality": "summary",
backend/app/services/document_brief_service.py:1586:    return items
backend/app/services/document_brief_service.py:1608:            # Collection summary allocates a narrow per-document budget.
backend/app/services/document_brief_service.py:1609:            return False
backend/app/services/document_brief_service.py:1613:            return False
backend/app/services/document_brief_service.py:1615:            return False
backend/app/services/document_brief_service.py:1617:            return True
backend/app/services/document_brief_service.py:1619:            return True
backend/app/services/document_brief_service.py:1621:        return scale_units >= max(max_chunks * 2, self._map_reduce_min_chunks)
backend/app/services/document_brief_service.py:1623:    async def get_summary_context(
backend/app/services/document_brief_service.py:1633:        persisted = await self._get_persisted_summary_context(
backend/app/services/document_brief_service.py:1641:            return persisted
backend/app/services/document_brief_service.py:1647:            return_prefetched_chunks=True,
backend/app/services/document_brief_service.py:1693:                    return cached_items
backend/app/services/document_brief_service.py:1695:            map_reduce_result = await self._section_map_reduce.build_summary_context(
backend/app/services/document_brief_service.py:1723:                    return map_reduce_items
backend/app/services/document_brief_service.py:1733:                return [
backend/app/services/document_brief_service.py:1742:            return persisted
backend/app/services/document_brief_service.py:1745:            return [
backend/app/services/document_brief_service.py:1752:        return [
backend/app/services/document_brief_service.py:1766:            return {}
backend/app/services/document_brief_service.py:1768:        return dict(coverage) if isinstance(coverage, dict) else {}
backend/app/services/document_brief_service.py:1770:    async def _get_persisted_summary_context(
backend/app/services/document_brief_service.py:1781:            return []
backend/app/services/document_brief_service.py:1784:            return []
backend/app/services/document_brief_service.py:1793:            return []
backend/app/services/document_brief_service.py:1807:        return [
backend/app/services/document_brief_service.py:1821:            return
backend/app/services/document_brief_service.py:1848:                "Failed to persist map-reduce summary context cache for document %s",
backend/app/services/document_brief_service.py:1853:    async def get_collection_summary_context(
backend/app/services/document_brief_service.py:1863:            return []
backend/app/services/document_brief_service.py:1869:                await self.get_summary_context(
backend/app/services/document_brief_service.py:1878:        return contexts[:max_chunks]
backend/app/services/document_brief_service.py:1882:        return doc.filename if doc else "document"
backend/app/api/document_jobs.py:28:    summary: str
backend/app/api/document_jobs.py:54:    return job.__dict__.get("extraction_result")
backend/app/api/document_jobs.py:71:    return payload
backend/app/api/document_jobs.py:122:            summary = f"Layout-preserved PDF translation to {target} is ready."
backend/app/api/document_jobs.py:124:            summary = error_message or "Layout-preserving translation failed."
backend/app/api/document_jobs.py:126:            summary = f"Translating this PDF to {target} while preserving layout."
backend/app/api/document_jobs.py:127:        return DocumentJobArtifactResponse(
backend/app/api/document_jobs.py:132:            summary=summary,
backend/app/api/document_jobs.py:162:        summary = f"{len(tables)} table(s) detected."
backend/app/api/document_jobs.py:164:            summary = f"{summary} Provider: {provider}."
backend/app/api/document_jobs.py:166:            summary = "Scanning document tables."
backend/app/api/document_jobs.py:167:        return DocumentJobArtifactResponse(
backend/app/api/document_jobs.py:172:            summary=summary,
backend/app/api/document_jobs.py:205:    return DocumentJobArtifactResponse(
backend/app/api/document_jobs.py:210:        summary=job.error_message or ("Ready." if job.status == "succeeded" else "Working..."),
backend/app/api/document_jobs.py:236:    return DocumentJobDetailResponse(
backend/app/services/storage_service.py:25:        return host, secure
backend/app/services/storage_service.py:27:    return endpoint, False
backend/app/services/storage_service.py:73:        return Minio(host, access_key=access_key, secret_key=secret_key,
backend/app/services/storage_service.py:78:        return self._bucket
backend/app/services/storage_service.py:82:        return StorageUnavailableError(f"Object storage {operation} failed")
backend/app/services/storage_service.py:90:        return bool(self._client.bucket_exists(self._bucket))
backend/app/services/storage_service.py:147:        return url
backend/app/services/storage_service.py:153:            return response.read()
backend/app/api/layout_translations.py:69:    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quote(clean, safe='')}"
backend/app/api/layout_translations.py:74:        return value.isoformat()
backend/app/api/layout_translations.py:75:    return datetime.now(timezone.utc).isoformat()
backend/app/api/layout_translations.py:80:    return DocumentJobDetailResponse(
backend/app/api/layout_translations.py:123:    return doc
backend/app/api/layout_translations.py:140:            return job
backend/app/api/layout_translations.py:141:    return None
backend/app/api/layout_translations.py:152:    return int(used or 0)
backend/app/api/layout_translations.py:156:    return {
backend/app/api/layout_translations.py:272:        return await _job_response(existing, db, user)
backend/app/api/layout_translations.py:378:    return await _job_response(job, db, user)
backend/app/api/layout_translations.py:388:    return sanitize_filename(f"{stem}.pdf")
backend/app/api/layout_translations.py:395:        return None
backend/app/api/layout_translations.py:399:        return None
backend/app/api/layout_translations.py:402:        return None
backend/app/api/layout_translations.py:403:    return ImportLayoutTranslationResponse(
backend/app/api/layout_translations.py:442:        return existing
backend/app/api/layout_translations.py:477:            return self._data
backend/app/api/layout_translations.py:510:    return ImportLayoutTranslationResponse(
backend/app/api/layout_translations.py:549:    return StreamingResponse(
backend/app/services/question_template_service.py:51:    return normalized
backend/app/services/question_template_service.py:55:    return max(QUESTION_TEMPLATE_PREDEBIT_PER_CELL, question_count * document_count * QUESTION_TEMPLATE_PREDEBIT_PER_CELL)
backend/app/services/question_template_service.py:59:    return ExtractionTemplate(
backend/app/services/question_template_service.py:69:    return {
backend/app/services/question_template_service.py:95:    return "\n".join(lines).strip() + "\n"
backend/app/services/question_template_service.py:112:    return buf.getvalue()
backend/app/services/question_template_service.py:125:            return
backend/app/services/question_template_service.py:127:            return
backend/app/services/question_template_service.py:256:                return
backend/app/api/quotes.py:95:    return doc
backend/app/api/quotes.py:116:        .returning(CreditLedger.id)
backend/app/api/quotes.py:130:    return refunded
backend/app/api/quotes.py:164:            return await _refund_predebit(settle_db, user_id, pre_debited, ledger_id)
backend/app/api/quotes.py:166:    return await _refund_predebit(db, user_id, pre_debited, ledger_id)
backend/app/api/quotes.py:192:    # credit_service calls of its own. It returns .usage/.model precisely so
backend/app/api/quotes.py:360:    return QuoteSearchResponse(
backend/app/api/quotes.py:408:    return BiblioResponse(csl_json=row.csl_json, source=row.source)
backend/app/api/quotes.py:427:    return BiblioResponse(csl_json=row.csl_json, source=row.source)
backend/app/api/quotes.py:491:    return SavedQuoteResponse(
backend/app/api/quotes.py:509:    return SavedQuoteBoardResponse(
backend/app/api/quotes.py:619:        # "Idempotent save returns the existing row (200 not 409)" — the
backend/app/api/quotes.py:626:    return _saved_quote_response(row)
backend/app/api/quotes.py:635:    """M3-B3 (plan §8.1/§8.5): returns each row's STORED trust snapshot
backend/app/api/quotes.py:648:    return SavedQuoteListResponse(quotes=[_saved_quote_response(r) for r in rows])
backend/app/api/quotes.py:664:    return SavedQuoteBoardListResponse(quotes=[_saved_quote_board_response(r) for r in rows])
backend/app/api/quotes.py:685:    return _saved_quote_response(row)
backend/app/services/claim_verifier_service.py:86:        return {
backend/app/services/claim_verifier_service.py:111:    return features
backend/app/services/claim_verifier_service.py:116:    return {
backend/app/services/claim_verifier_service.py:139:        return units
backend/app/services/claim_verifier_service.py:143:        return [ClaimUnit(text=stripped, start=0, end=len(text))]
backend/app/services/claim_verifier_service.py:144:    return []
backend/app/services/claim_verifier_service.py:149:        return None
backend/app/services/claim_verifier_service.py:152:            return unit
backend/app/services/claim_verifier_service.py:153:    return min(units, key=lambda unit: min(abs(offset - unit.start), abs(offset - unit.end)))
backend/app/services/claim_verifier_service.py:162:    return " ".join(str(part or "") for part in parts)
backend/app/services/claim_verifier_service.py:167:        return int(value)  # type: ignore[arg-type]
backend/app/services/claim_verifier_service.py:169:        return default
backend/app/services/claim_verifier_service.py:248:        return ClaimVerificationReport(
backend/app/api/tables.py:65:    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quote(clean, safe='')}"
backend/app/api/tables.py:69:    return DocumentJobResponse(
backend/app/api/tables.py:95:    return DocumentTableResponse(
backend/app/api/tables.py:118:    return doc
backend/app/api/tables.py:146:        return _job_response(existing)
backend/app/api/tables.py:184:    return _job_response(job)
backend/app/api/tables.py:227:        return _job_response(existing)
backend/app/api/tables.py:268:    return _job_response(job)
backend/app/api/tables.py:283:    return [_table_response(table) for table in rows.scalars()]
backend/app/api/tables.py:314:    return StreamingResponse(
backend/app/api/tables.py:338:    return _job_response(job)
backend/app/api/tables.py:362:    return StreamingResponse(
backend/app/api/search.py:34:    return merged
backend/app/api/search.py:79:    return SearchResponse(results=[SearchResultItem(**r) for r in results])
backend/app/services/text_normalizer.py:68:    signals "drop entirely". Otherwise a 1+ char string is returned.
backend/app/services/text_normalizer.py:71:        return ""
backend/app/services/text_normalizer.py:73:        return None
backend/app/services/text_normalizer.py:90:    return "".join(out)
backend/app/services/text_normalizer.py:94:    """Normalize ``text`` and return ``(norm_text, norm_to_raw)``.
backend/app/services/text_normalizer.py:120:    return "".join(out_chars), out_map
backend/app/services/text_normalizer.py:135:        return False
backend/app/services/text_normalizer.py:138:    return start_ok and end_ok
backend/app/services/text_normalizer.py:147:        return (0, 0)
backend/app/services/text_normalizer.py:150:    return (raw_start, min(raw_end, raw_len))
backend/app/api/question_templates.py:91:    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quote(clean, safe='')}"
backend/app/api/question_templates.py:95:    return QuestionTemplatePayload(
backend/app/api/question_templates.py:108:    return job.__dict__.get("extraction_result")
backend/app/api/question_templates.py:122:    return QuestionTemplateRunResponse(
backend/app/api/question_templates.py:142:        return
backend/app/api/question_templates.py:155:        return None
backend/app/api/question_templates.py:157:    return text or None
backend/app/api/question_templates.py:167:    return template
backend/app/api/question_templates.py:188:    return doc
backend/app/api/question_templates.py:211:        return collection
backend/app/api/question_templates.py:232:    return collection
backend/app/api/question_templates.py:333:    return job
backend/app/api/question_templates.py:352:    return [_template_response(template) for template in rows.scalars()]
backend/app/api/question_templates.py:376:    return _template_response(template)
backend/app/api/question_templates.py:399:    return _template_response(template)
backend/app/api/question_templates.py:411:    return Response(status_code=status.HTTP_204_NO_CONTENT)
backend/app/api/question_templates.py:436:    return _run_response(job)
backend/app/api/question_templates.py:455:    return [_run_response(job) for job in rows.scalars()]
backend/app/api/question_templates.py:481:    return _run_response(job)
backend/app/api/question_templates.py:500:    return [_run_response(job) for job in rows.scalars()]
backend/app/api/question_templates.py:522:    return _run_response(job)
backend/app/api/question_templates.py:549:        return StreamingResponse(
backend/app/api/question_templates.py:554:    return StreamingResponse(
backend/app/services/doc_service.py:38:    return name or "document"
backend/app/services/doc_service.py:44:        return False
backend/app/services/doc_service.py:46:        return True
backend/app/services/doc_service.py:47:    return user is not None and doc.user_id == user.id
backend/app/services/doc_service.py:108:        return doc_id
backend/app/services/doc_service.py:113:        return doc
backend/app/services/doc_service.py:130:            return False
backend/app/services/doc_service.py:197:        return True
backend/app/services/saved_quotes_service.py:44:    return int(getter())
backend/app/services/saved_quotes_service.py:59:    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
backend/app/services/saved_quotes_service.py:69:    return int(result.scalar() or 0)
backend/app/services/saved_quotes_service.py:81:    return result.scalar_one_or_none()
backend/app/services/saved_quotes_service.py:126:    CRITICAL: every return path below explicitly commits (the lock is
backend/app/services/saved_quotes_service.py:156:        return SaveQuoteOutcome(row=existing, created=False, limit_reached=False, active_count=0)
backend/app/services/saved_quotes_service.py:162:        return SaveQuoteOutcome(row=None, created=False, limit_reached=True, active_count=active_count)
backend/app/services/saved_quotes_service.py:197:        return SaveQuoteOutcome(row=winner, created=False, limit_reached=False, active_count=active_count)
backend/app/services/saved_quotes_service.py:198:    return SaveQuoteOutcome(row=row, created=True, limit_reached=False, active_count=active_count + 1)
backend/app/services/saved_quotes_service.py:210:    return list(result.scalars().all())
backend/app/services/saved_quotes_service.py:231:    return list(result.scalars().all())
backend/app/services/saved_quotes_service.py:246:    return result.scalar_one_or_none()
backend/app/services/saved_quotes_service.py:272:    return row
backend/app/api/collections.py:98:    return [
backend/app/api/collections.py:164:    return {
backend/app/api/collections.py:196:    return CollectionDetail(
backend/app/api/collections.py:218:    return None
backend/app/api/collections.py:294:    return {"added": added}
backend/app/api/collections.py:316:    return None
backend/app/api/collections.py:334:    return {
backend/app/api/collections.py:363:            ChatSession.domain_mode,
backend/app/api/collections.py:370:        .group_by(ChatSession.id, ChatSession.title, ChatSession.domain_mode, ChatSession.created_at)
backend/app/api/collections.py:376:    return {
backend/app/api/collections.py:382:                "domain_mode": row.domain_mode,
backend/app/services/parse_service.py:55:    return codes or ["eng"]
backend/app/services/parse_service.py:89:        # No script (OSD failed) and no usable locale. Do NOT return the full installed set —
backend/app/services/parse_service.py:92:        # yields low-quality output that the worker's adopt-only-if-better guard rejects
backend/app/services/parse_service.py:94:        return "eng" if "eng" in installed else (installed[0] if installed else "eng")
backend/app/services/parse_service.py:95:    return "+".join(chosen[:3])
backend/app/services/parse_service.py:106:    ('Arabic', 'Han', 'Latin', ...) or None when no page yields a confident detection.
backend/app/services/parse_service.py:112:        return None
backend/app/services/parse_service.py:147:        return votes.most_common(1)[0][0] if votes else None
backend/app/services/parse_service.py:170:    return good / total if total else 1.0
backend/app/services/parse_service.py:180:    return chars / n if n else 0.0
backend/app/services/parse_service.py:197:    return bad / total if total else 0.0
backend/app/services/parse_service.py:209:        return False, q  # only PDFs have broken-font layers and are OCR-able via fitz
backend/app/services/parse_service.py:211:        return False, q  # clearly good (good docs ≥0.94 — wide margin)
backend/app/services/parse_service.py:213:        return True, q   # clear garbage incl. no-space U+FFFD/PUA runs (CJK-safe: good CJK ≥0.9)
backend/app/services/parse_service.py:215:    return (_bad_char_ratio(pages) > 0.30 or _avg_token_len(pages) < 4.0), q
backend/app/services/parse_service.py:333:            return pages
backend/app/services/parse_service.py:403:            return pages
backend/app/services/parse_service.py:413:            return True
backend/app/services/parse_service.py:419:        return (low_text_pages / max(1, len(pages))) > 0.70
backend/app/services/parse_service.py:454:        return cleaned
backend/app/services/parse_service.py:481:            return []
backend/app/services/parse_service.py:509:            return chunks
backend/app/services/parse_service.py:625:        return filtered
backend/app/services/parse_service.py:631:        higher-level document model used by summary, extraction, diff, and
backend/app/services/parse_service.py:651:            return []
backend/app/services/parse_service.py:696:        return elements
backend/app/services/parse_service.py:707:            return sorted(blocks, key=lambda cb: (cb.bbox[1], cb.bbox[0]))
backend/app/services/parse_service.py:721:            return sorted(blocks, key=lambda cb: (cb.bbox[1], cb.bbox[0]))
backend/app/services/parse_service.py:730:            return sorted(blocks, key=lambda cb: (cb.bbox[1], cb.bbox[0]))
backend/app/services/parse_service.py:736:            return sorted(blocks, key=lambda cb: (cb.bbox[1], cb.bbox[0]))
backend/app/services/parse_service.py:742:                return (
backend/app/services/parse_service.py:746:            return sorted(band, key=lambda cb: (cb.bbox[1], cb.bbox[0]))
backend/app/services/parse_service.py:763:        return result
backend/app/services/parse_service.py:768:            return False
backend/app/services/parse_service.py:770:            return False
backend/app/services/parse_service.py:772:            return False
backend/app/services/parse_service.py:774:            return True
backend/app/services/parse_service.py:779:                return True
backend/app/services/parse_service.py:780:        return False
backend/app/services/parse_service.py:787:        return (
backend/app/services/parse_service.py:812:        return text
backend/app/services/parse_service.py:815:        return ChunkInfo(
backend/app/services/parse_service.py:859:        return text, avg_size
backend/app/services/parse_service.py:910:        return result
backend/app/services/parse_service.py:921:        return t.strip()
backend/app/services/parse_service.py:936:            return []
backend/app/services/parse_service.py:952:        return sentences
backend/app/services/parse_service.py:957:            return 0
backend/app/services/parse_service.py:961:            return max(1, len(text) // 2)
backend/app/services/parse_service.py:962:        return max(1, len(text.split()))
backend/app/services/parse_service.py:980:            return 0.0 if v < 0.0 else (1.0 if v > 1.0 else v)
backend/app/services/parse_service.py:982:        return {
backend/app/services/parse_service.py:994:            return set(), set()
backend/app/services/parse_service.py:1022:        return header_texts, footer_texts
backend/app/api/admin.py:150:        return None
backend/app/api/admin.py:153:        return None
backend/app/api/admin.py:154:    return text_value[:1].upper() + text_value[1:]
backend/app/api/admin.py:158:    return PAID_SIGNAL_LABELS.get(str(event_name or ""), _humanize_code(event_name) or "Paid signal")
backend/app/api/admin.py:182:    return " ".join(pieces) or _paid_signal_label(event_name)
backend/app/api/admin.py:187:    return {
backend/app/api/admin.py:200:    return round(float(numerator) / float(denominator), 4) if denominator else 0.0
backend/app/api/admin.py:205:    return {
backend/app/api/admin.py:215:        return str(value.date())
backend/app/api/admin.py:216:    return str(value)[:10]
backend/app/api/admin.py:221:        return row.get(key, default)
backend/app/api/admin.py:222:    return getattr(row, key, default)
backend/app/api/admin.py:227:        return value.date()
backend/app/api/admin.py:229:        return value
backend/app/api/admin.py:230:    return datetime.fromisoformat(str(value)[:10]).date()
backend/app/api/admin.py:235:    return day - timedelta(days=day.weekday())
backend/app/api/admin.py:239:    return func.date_trunc("day", column.op("AT TIME ZONE")("UTC"))
backend/app/api/admin.py:244:        return {email.strip().lower() for email in admin_emails if email and email.strip()}
backend/app/api/admin.py:245:    return {email.strip().lower() for email in settings.ADMIN_EMAILS.split(",") if email.strip()}
backend/app/api/admin.py:250:        return {str(user_id) for user_id in excluded_user_ids if user_id}
backend/app/api/admin.py:251:    return set(INTERNAL_OWNER_USER_IDS)
backend/app/api/admin.py:261:    return conditions
backend/app/api/admin.py:267:    return str(user_id) in excluded_user_ids or (isinstance(email, str) and email.lower() in admin_emails)
backend/app/api/admin.py:277:    return {
backend/app/api/admin.py:287:        return "unknown"
backend/app/api/admin.py:290:        return "large"
backend/app/api/admin.py:292:        return "mid"
backend/app/api/admin.py:293:    return "small"
backend/app/api/admin.py:297:    return {
backend/app/api/admin.py:325:    return [
backend/app/api/admin.py:343:    return active
backend/app/api/admin.py:412:        returned_users = 0
backend/app/api/admin.py:423:                returned_users += 1
backend/app/api/admin.py:429:            "returned_users": returned_users,
backend/app/api/admin.py:430:            "pct": _rate(returned_users, len(matured_active_dates)),
backend/app/api/admin.py:522:    return {
backend/app/api/admin.py:543:    return labels.get(key, _humanize_code(key) or key)
backend/app/api/admin.py:548:        return set()
backend/app/api/admin.py:549:    return {str(value) for value in values if str(value) in eligible_user_ids}
backend/app/api/admin.py:555:    return {
backend/app/api/admin.py:568:    return [
backend/app/api/admin.py:583:    return {
backend/app/api/admin.py:595:    return _citations_empty(_row_value(row, "citations")) or bool(RAG_MISS_RE.search(content))
backend/app/api/admin.py:617:        return (str(_row_value(row, "session_id") or ""), created_at)
backend/app/api/admin.py:661:    return signal_users, final_candidates
backend/app/api/admin.py:777:    return {
backend/app/api/admin.py:791:    return citations in (None, {}, [], "{}", "[]", "null")
backend/app/api/admin.py:796:        return False
backend/app/api/admin.py:799:        return True
backend/app/api/admin.py:801:    return isinstance(artifacts, list) and len(artifacts) > 0
backend/app/api/admin.py:839:    return union_all(usage_q, message_q, document_q, event_q, feedback_q).subquery()
backend/app/api/admin.py:845:        return "missing"
backend/app/api/admin.py:847:        return "live"
backend/app/api/admin.py:849:        return "test"
backend/app/api/admin.py:850:    return "unknown"
backend/app/api/admin.py:855:        return None
backend/app/api/admin.py:857:        return price_id[:6] + "..."
backend/app/api/admin.py:858:    return f"{price_id[:8]}...{price_id[-6:]}"
backend/app/api/admin.py:873:        return payload
backend/app/api/admin.py:887:    return payload
backend/app/api/admin.py:890:@router.get("/overview", response_model=AdminOverviewResponse)
backend/app/api/admin.py:891:async def admin_overview(
backend/app/api/admin.py:896:    cache_key = "admin:overview"
backend/app/api/admin.py:899:        return cached
backend/app/api/admin.py:951:    return payload
backend/app/api/admin.py:1027:    return {
backend/app/api/admin.py:1082:    return {
backend/app/api/admin.py:1108:        return int(value or 0)
backend/app/api/admin.py:1226:        return series_map[label]
backend/app/api/admin.py:1552:        return [{"key": row.key or "unknown", "count": int(row.count or 0), "users": None} for row in rows]
backend/app/api/admin.py:1582:    return {
backend/app/api/admin.py:1587:        "summary": {
backend/app/api/admin.py:1712:    return _build_retention_payload(
backend/app/api/admin.py:1946:    return _build_churn_payload(
backend/app/api/admin.py:1985:    return {
backend/app/api/admin.py:2099:    return {
backend/app/api/admin.py:2113:        return float(value)
backend/app/api/admin.py:2115:        return float(str(value))
backend/app/api/admin.py:2117:        return 0.0
backend/app/api/admin.py:2155:    "document_summary": "Whole-document summary",
backend/app/api/admin.py:2156:    "section_summary": "Section summary",
backend/app/api/admin.py:2157:    "summary": "Summary question",
backend/app/api/admin.py:2172:    "document_summary_context": "Whole-document summary context",
backend/app/api/admin.py:2173:    "collection_summary_context": "Multi-document summary context",
backend/app/api/admin.py:2182:    "document_summary_context": "The system selected representative sections for a broad document summary.",
backend/app/api/admin.py:2183:    "collection_summary_context": "The system selected representative sections across multiple documents.",
backend/app/api/admin.py:2189:    return RAG_STATUS_LABELS.get(str(status or "unknown").lower(), "Not classified")
backend/app/api/admin.py:2193:    return RAG_ROUTE_LABELS.get(str(route or "unknown"), _humanize_code(route) or "Unknown question type")
backend/app/api/admin.py:2197:    return RAG_STRATEGY_LABELS.get(str(strategy or "unknown"), _humanize_code(strategy) or "Unknown retrieval path")
backend/app/api/admin.py:2201:    return RAG_STRATEGY_DESCRIPTIONS.get(str(strategy or ""), "The retrieval path is not classified yet.")
backend/app/api/admin.py:2215:        return None
backend/app/api/admin.py:2216:    return {
backend/app/api/admin.py:2332:    return {
backend/app/api/admin.py:2414:    return {
backend/app/api/admin.py:2490:    return {
backend/app/services/credit_service.py:43:    return MODE_ESTIMATED_COST.get(mode, MODE_ESTIMATED_COST["balanced"])
backend/app/services/credit_service.py:54:    return max(1, int(base_cost * multiplier))
backend/app/services/credit_service.py:60:    return user.credits_balance if user else 0
backend/app/services/credit_service.py:84:        .returning(User.credits_balance)
backend/app/services/credit_service.py:89:        return None
backend/app/services/credit_service.py:103:    return ledger.id
backend/app/services/credit_service.py:126:        .returning(User.credits_balance)
backend/app/services/credit_service.py:141:    return new_balance
backend/app/services/credit_service.py:164:    return usage
backend/app/services/credit_service.py:179:    - If pre_debited == actual_cost → no-op (still returns the current balance)
backend/app/services/credit_service.py:182:    FIX2-B(b) (Codex r2 #4, NOT ADDRESSED): returns the resulting balance so
backend/app/services/credit_service.py:184:    get_user_credits() query after this returns. That extra round-trip was a
backend/app/services/credit_service.py:189:    the return value are unaffected (Python allows ignoring it).
backend/app/services/credit_service.py:227:        return user.credits_balance
backend/app/services/credit_service.py:233:        .returning(User.credits_balance)
backend/app/services/credit_service.py:252:    return new_balance
backend/app/services/credit_service.py:263:        return
backend/app/services/credit_service.py:273:        return
backend/app/services/credit_service.py:287:        return
backend/app/services/credit_service.py:296:        return
backend/app/services/query_router.py:10:    DOCUMENT_SUMMARY = "document_summary"
backend/app/services/query_router.py:11:    SECTION_SUMMARY = "section_summary"
backend/app/services/query_router.py:68:    r"\bsummar(y|ize|ise|ise)\b",
backend/app/services/query_router.py:71:    r"\bexecutive\s+summary\b",
backend/app/services/query_router.py:72:    r"\boverview\b",
backend/app/services/query_router.py:163:            return page
backend/app/services/query_router.py:164:    return None
backend/app/services/query_router.py:193:        return token
backend/app/services/query_router.py:194:    return " "
backend/app/services/query_router.py:211:    return not re.findall(r"[0-9A-Za-zÀ-￿]+", residue)
backend/app/services/query_router.py:215:    return any(re.search(pattern, text, flags=re.IGNORECASE) for pattern in patterns)
backend/app/services/query_router.py:219:    return "collection" if is_collection else "single_doc"
backend/app/services/query_router.py:228:        domain_mode: str | None = None,
backend/app/services/query_router.py:232:            return QueryRoute(
backend/app/services/query_router.py:248:        has_summary = _matches_any(normalized, _SUMMARY_MARKERS)
backend/app/services/query_router.py:258:        has_page_lookup = page_ref is not None and not has_summary and not has_exhaustive
backend/app/services/query_router.py:266:            return QueryRoute(
backend/app/services/query_router.py:277:        if has_summary and has_whole_doc and not has_section:
backend/app/services/query_router.py:281:            reason = "whole-document summary markers"
backend/app/services/query_router.py:282:        elif has_summary and not has_section and not has_table and not has_compare:
backend/app/services/query_router.py:286:            reason = "generic summary marker in document chat"
backend/app/services/query_router.py:287:        elif has_summary and has_section:
backend/app/services/query_router.py:291:            reason = "section summary markers"
backend/app/services/query_router.py:299:        if has_compare or (is_collection and has_summary):
backend/app/services/query_router.py:344:        elif QueryIntent.TABLE_QUERY in intents and not has_summary:
backend/app/services/query_router.py:347:        if domain_mode in {"legal", "academic"} and QueryIntent.EXISTENCE_CHECK in intents:
backend/app/services/query_router.py:352:        return QueryRoute(
backend/app/services/action_planner.py:20:    SUMMARIZE_DOCUMENT = "summarize_document"
backend/app/services/action_planner.py:55:        return self.action in {
backend/app/services/action_planner.py:69:_SUMMARY_RE = re.compile(r"\b(summarize|summary|brief|overview|tldr|executive summary)\b|总结|摘要|概括|要点", re.IGNORECASE)
backend/app/services/action_planner.py:125:# runs, and the returned ActionPlan carries quote_finder_hint=True (+ the
backend/app/services/action_planner.py:153:    return bool(_STRICT_QUOTE_RE.search(text)) or bool(_STRICT_QUOTE_WITH_PAGE_RE.search(text))
backend/app/services/action_planner.py:161:    return bool(_NEGATION_RE.search(text)) or bool(_METALINGUISTIC_RE.search(text))
backend/app/services/action_planner.py:165:    return chinese if _CJK_RE.search(query or "") else english
backend/app/services/action_planner.py:171:        return ActionPlan(
backend/app/services/action_planner.py:191:        return ActionPlan(
backend/app/services/action_planner.py:205:        # at all (see chat_service.py's _tool_action_stream done payload),
backend/app/services/action_planner.py:213:        return ActionPlan(
backend/app/services/action_planner.py:223:    return _fallthrough_plan(text, is_collection=is_collection)
backend/app/services/action_planner.py:230:    each individual return statement below."""
backend/app/services/action_planner.py:233:    has_summary = bool(_SUMMARY_RE.search(text))
backend/app/services/action_planner.py:252:        return ActionPlan(
backend/app/services/action_planner.py:267:        return ActionPlan(
backend/app/services/action_planner.py:282:        return ActionPlan(
backend/app/services/action_planner.py:296:        return ActionPlan(
backend/app/services/action_planner.py:305:        return ActionPlan(
backend/app/services/action_planner.py:320:        return ActionPlan(
backend/app/services/action_planner.py:333:        return ActionPlan(
backend/app/services/action_planner.py:347:    if has_summary and re.search(r"\bexecutive\s+summary|deliverable|briefing\b|交付|简报", text, re.IGNORECASE):
backend/app/services/action_planner.py:348:        return ActionPlan(
backend/app/services/action_planner.py:352:            template_key="executive_summary",
backend/app/services/action_planner.py:356:                "I am creating a cited executive summary deliverable.",
backend/app/services/action_planner.py:357:                "我会生成一份带引用的 executive summary。",
backend/app/services/action_planner.py:359:            reason="executive summary deliverable markers",
backend/app/services/action_planner.py:363:        return ActionPlan(
backend/app/services/action_planner.py:371:    if has_summary:
backend/app/services/action_planner.py:372:        return ActionPlan(
backend/app/services/action_planner.py:377:            reason="summary markers",
backend/app/services/action_planner.py:380:    return ActionPlan(
backend/app/services/action_planner.py:391:        return ChatAction(str(value))
backend/app/services/action_planner.py:393:        return None
backend/app/services/action_planner.py:410:    return data
backend/app/services/action_planner.py:416:            return AsyncOpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)
backend/app/services/action_planner.py:418:            return AsyncOpenAI(api_key=settings.OPENROUTER_API_KEY, base_url=settings.OPENROUTER_BASE_URL)
backend/app/services/action_planner.py:419:        return None
backend/app/services/action_planner.py:434:            return deterministic
backend/app/services/action_planner.py:436:            return deterministic
backend/app/services/action_planner.py:439:            return deterministic
backend/app/services/action_planner.py:443:            return deterministic
backend/app/services/action_planner.py:450:            "Allowed actions: answer_with_rag, summarize_document, extract_deliverable, "
backend/app/services/action_planner.py:455:            "For ordinary questions, summaries, and source/page lookups, use the RAG actions."
backend/app/services/action_planner.py:479:                return deterministic
backend/app/services/action_planner.py:482:                return deterministic
backend/app/services/action_planner.py:485:            return ActionPlan(
backend/app/services/action_planner.py:499:            return deterministic
backend/app/services/corrective_retrieval_service.py:45:    return merged[: int(top_k or 8)]
backend/app/services/corrective_retrieval_service.py:68:    return "+".join(parts) if parts else "semantic_top_k"
backend/app/services/corrective_retrieval_service.py:78:    return annotated
backend/app/services/corrective_retrieval_service.py:89:    return annotated
backend/app/services/corrective_retrieval_service.py:114:    return min(k, ceil)
backend/app/services/corrective_retrieval_service.py:134:        return str(it.get("table_id") or it.get("chunk_id") or "")
backend/app/services/corrective_retrieval_service.py:137:    return ranked[: int(top_k or 8)]
backend/app/services/corrective_retrieval_service.py:147:    return _dynamic_k(
backend/app/services/corrective_retrieval_service.py:162:            return []
backend/app/services/corrective_retrieval_service.py:184:        return planned
backend/app/services/corrective_retrieval_service.py:196:            return [], [], []
backend/app/services/corrective_retrieval_service.py:234:        return planned, balanced_required, balanced_extra
backend/app/services/corrective_retrieval_service.py:263:            return CorrectiveRetrievalResult(
backend/app/services/corrective_retrieval_service.py:306:        return CorrectiveRetrievalResult(retrieved=merged, evaluation=final_eval, strategy=strategy, plan=plan)
backend/app/services/corrective_retrieval_service.py:330:            return CorrectiveRetrievalResult(
backend/app/services/corrective_retrieval_service.py:369:        return CorrectiveRetrievalResult(retrieved=merged, evaluation=final_eval, strategy=strategy, plan=plan)
backend/app/services/retrieval_service.py:46:    return (
backend/app/services/retrieval_service.py:55:        return 0.0
backend/app/services/retrieval_service.py:58:    return min(0.99, 0.48 + (matches / max(len(terms), 1)) * 0.45)
backend/app/services/retrieval_service.py:73:    return payload
backend/app/services/retrieval_service.py:77:    return len((text or "").strip()) >= int(min_text_len)
backend/app/services/retrieval_service.py:83:        return []
backend/app/services/retrieval_service.py:91:    return normalized
backend/app/services/retrieval_service.py:96:        return ""
backend/app/services/retrieval_service.py:102:    return "\n".join(lines)
backend/app/services/retrieval_service.py:107:    return (
backend/app/services/retrieval_service.py:116:        return rows
backend/app/services/retrieval_service.py:120:        return rows[:_TABLE_ROW_LIMIT]
backend/app/services/retrieval_service.py:127:        return rows[:_TABLE_ROW_LIMIT]
backend/app/services/retrieval_service.py:128:    return [header, *matches[: _TABLE_ROW_LIMIT - 1]]
backend/app/services/retrieval_service.py:138:            return chunk
backend/app/services/retrieval_service.py:139:    return same_document_chunks[0] if same_document_chunks else None
backend/app/services/retrieval_service.py:144:        return 0.0
backend/app/services/retrieval_service.py:147:        return 0.64 if generic_table_query else 0.0
backend/app/services/retrieval_service.py:151:        return 0.64 if generic_table_query and only_generic_terms else 0.0
backend/app/services/retrieval_service.py:152:    return min(0.98, 0.58 + (matched / max(len(terms), 1)) * 0.38)
backend/app/services/retrieval_service.py:198:    return payloads
backend/app/services/retrieval_service.py:204:    return (
backend/app/services/retrieval_service.py:213:    return sa.or_(
backend/app/services/retrieval_service.py:230:    return terms, conditions, score_expr
backend/app/services/retrieval_service.py:234:    """Vector search over chunks using Qdrant, returning DB-backed details."""
backend/app/services/retrieval_service.py:252:        # 3) Load chunk details by returned ids
backend/app/services/retrieval_service.py:264:            return []
backend/app/services/retrieval_service.py:289:        return results[: int(top_k or 5)]
backend/app/services/retrieval_service.py:303:            return []
backend/app/services/retrieval_service.py:334:        return [
backend/app/services/retrieval_service.py:347:            return []
backend/app/services/retrieval_service.py:374:            return []
backend/app/services/retrieval_service.py:386:        return results[: int(top_k or 8)]
backend/app/services/retrieval_service.py:399:            return []
backend/app/services/retrieval_service.py:402:            return []
backend/app/services/retrieval_service.py:421:        return [
backend/app/services/retrieval_service.py:439:            return []
backend/app/services/retrieval_service.py:459:        return _table_payloads_from_tables(query, tables, chunks, top_k=top_k)
backend/app/services/retrieval_service.py:466:            return []
backend/app/services/retrieval_service.py:474:            return []
backend/app/services/retrieval_service.py:502:        return _table_payloads_from_tables(
backend/app/api/chat.py:59:    return f"{client_ip}:{document_id}"
backend/app/api/chat.py:71:    return [
backend/app/api/chat.py:96:        return None
backend/app/api/chat.py:98:        return dt.replace(tzinfo=timezone.utc)
backend/app/api/chat.py:99:    return dt.astimezone(timezone.utc)
backend/app/api/chat.py:102:def _chat_strict_quote_routed(session: ChatSession, message: str) -> bool:
backend/app/api/chat.py:105:    predicate as chat_service._is_strict_quote_routed (auth is guaranteed
backend/app/api/chat.py:113:    return (
backend/app/api/chat.py:124:        return
backend/app/api/chat.py:129:        return
backend/app/api/chat.py:138:        return
backend/app/api/chat.py:180:        return None
backend/app/api/chat.py:186:            return session if session.user_id is None else None
backend/app/api/chat.py:188:        return session if session.user_id == user.id else None
backend/app/api/chat.py:192:        return None
backend/app/api/chat.py:198:            return None
backend/app/api/chat.py:200:            return None
backend/app/api/chat.py:202:    return session
backend/app/api/chat.py:213:        return None
backend/app/api/chat.py:215:    return doc if can_access_document(doc, user) else None
backend/app/api/chat.py:319:        return JSONResponse(
backend/app/api/chat.py:324:    return response
backend/app/api/chat.py:364:    return SessionMessagesResponse(messages=items, demo_messages_used=demo_messages_used)
backend/app/api/chat.py:391:    # P1 hygiene (top-down review, 2026-08-01): domain_mode ("legal"/
backend/app/api/chat.py:396:    # POST {"domain_mode": "legal"} and get the paid prompt behavior.
backend/app/api/chat.py:399:    if body.domain_mode is not None:
backend/app/api/chat.py:469:        strict_quote_routed = _chat_strict_quote_routed(session, body.message)
backend/app/api/chat.py:471:            "balanced" if strict_quote_routed else effective_mode
backend/app/api/chat.py:488:            domain_mode=body.domain_mode
backend/app/api/chat.py:494:            yield line + data_line
backend/app/api/chat.py:496:    return StreamingResponse(
backend/app/api/chat.py:629:            yield line + data_line
backend/app/api/chat.py:631:    return StreamingResponse(
backend/app/api/chat.py:659:            return SessionListResponse(sessions=[])
backend/app/api/chat.py:670:            ChatSession.domain_mode,
backend/app/api/chat.py:678:        .group_by(ChatSession.id, ChatSession.title, ChatSession.domain_mode, ChatSession.created_at)
backend/app/api/chat.py:690:            domain_mode=getattr(row, 'domain_mode', None),
backend/app/api/chat.py:696:    return SessionListResponse(sessions=sessions)
backend/app/api/chat.py:712:    return None  # 204
backend/app/services/quote_verification_service.py:5:stored source text (the cited chunk's text, ± retrieved neighbours) and returns
backend/app/services/quote_verification_service.py:67:        return self.status in _VERIFIED_STATUSES
backend/app/services/quote_verification_service.py:78:        return True
backend/app/services/quote_verification_service.py:80:        return True
backend/app/services/quote_verification_service.py:81:    return False
backend/app/services/quote_verification_service.py:97:        return QuoteVerification("dropped", None, None, None, 0.0, "empty")
backend/app/services/quote_verification_service.py:102:        return QuoteVerification(
backend/app/services/quote_verification_service.py:117:                return QuoteVerification(
backend/app/services/quote_verification_service.py:126:        return _DROPPED
backend/app/services/quote_verification_service.py:130:        return _DROPPED
backend/app/services/quote_verification_service.py:135:        return _DROPPED
backend/app/services/quote_verification_service.py:150:        return QuoteVerification("aligned", display, rs, re, float(align.score))
backend/app/services/quote_verification_service.py:157:    return QuoteVerification("flagged", display, rs, re, float(align.score), reason)
backend/app/services/extractors/pptx_extractor.py:17:        return ''
backend/app/services/extractors/pptx_extractor.py:27:    return '\n'.join(lines)
backend/app/services/extractors/pptx_extractor.py:82:    return pages
backend/app/api/users.py:52:        return user.stripe_subscription_id
backend/app/api/users.py:54:        return None
backend/app/api/users.py:64:            return sub.get("id")
backend/app/api/users.py:65:    return None
backend/app/api/users.py:70:    return {
backend/app/api/users.py:145:                # Account model has no created_at column; return None for compatibility
backend/app/api/users.py:174:    return {
backend/app/api/users.py:224:    return {
backend/app/api/users.py:257:        return Response(
backend/app/api/users.py:373:    return Response(
backend/app/api/users.py:451:        # If deletion fails, return error
backend/app/api/users.py:459:    return {"deleted": True}
backend/app/api/sharing.py:61:        return ShareResponse(
backend/app/api/sharing.py:97:    return ShareResponse(
backend/app/api/sharing.py:206:    return SharedSessionView(
backend/app/services/query_planner_service.py:24:        return len(self.steps) > 1 or self.needs_balanced_coverage
backend/app/services/query_planner_service.py:81:    return " ".join((query or "").strip().split())
backend/app/services/query_planner_service.py:93:    return deduped
backend/app/services/query_planner_service.py:106:    return _dedupe_preserve_order(entities)[:4]
backend/app/services/query_planner_service.py:114:    return metrics[:3]
backend/app/services/query_planner_service.py:120:        return []
backend/app/services/query_planner_service.py:126:    return _dedupe_preserve_order(cleaned)[:3]
backend/app/services/query_planner_service.py:132:        return
backend/app/services/query_planner_service.py:134:        return
backend/app/services/query_planner_service.py:136:        return
backend/app/services/query_planner_service.py:144:            return QueryPlan(steps=(), needs_balanced_coverage=False, reason="empty")
backend/app/services/query_planner_service.py:161:            return QueryPlan(
backend/app/services/query_planner_service.py:215:        return QueryPlan(
backend/app/api/billing.py:83:    return mapping.get(key, "")
backend/app/api/billing.py:91:        return "plus"
backend/app/api/billing.py:93:        return "pro"
backend/app/api/billing.py:94:    return None
backend/app/api/billing.py:100:        return int(settings.PLAN_PRO_MONTHLY_CREDITS or 0)
backend/app/api/billing.py:102:        return int(settings.PLAN_PLUS_MONTHLY_CREDITS or 0)
backend/app/api/billing.py:103:    return int(settings.PLAN_FREE_MONTHLY_CREDITS or 0)
backend/app/api/billing.py:124:        return "monthly"
backend/app/api/billing.py:126:        return "annual"
backend/app/api/billing.py:127:    return None
backend/app/api/billing.py:132:        return None
backend/app/api/billing.py:134:        return dt.replace(tzinfo=timezone.utc)
backend/app/api/billing.py:135:    return dt.astimezone(timezone.utc)
backend/app/api/billing.py:141:        return True
backend/app/api/billing.py:142:    return datetime.now(timezone.utc) - updated_at >= PENDING_SUBSCRIPTION_TTL
backend/app/api/billing.py:152:    return list(getattr(subs, "data", []) or [])
backend/app/api/billing.py:157:        return None
backend/app/api/billing.py:160:            return sub
backend/app/api/billing.py:161:    return None
backend/app/api/billing.py:190:        return True
backend/app/api/billing.py:201:    return False
backend/app/api/billing.py:206:    return {
backend/app/api/billing.py:248:    return {"checkout_url": session.url}
backend/app/api/billing.py:365:    return {"checkout_url": session.url}
backend/app/api/billing.py:379:            return_url=f"{settings.FRONTEND_URL}/billing",
backend/app/api/billing.py:384:    return {"portal_url": portal.url}
backend/app/api/billing.py:487:    return {
backend/app/api/billing.py:515:    value is returned; if no cache, a degraded `status="none"` response
backend/app/api/billing.py:524:        return {
backend/app/api/billing.py:534:        return {
backend/app/api/billing.py:545:        return {
backend/app/api/billing.py:557:        return cached
backend/app/api/billing.py:615:        return state
backend/app/api/billing.py:618:    return state
backend/app/api/billing.py:636:    return {
backend/app/api/billing.py:672:        return None
backend/app/api/billing.py:678:        return None
backend/app/api/billing.py:679:    return dt.isoformat() if dt else None
backend/app/api/billing.py:690:        return direct
backend/app/api/billing.py:693:        return None
backend/app/api/billing.py:694:    return items[0].get("current_period_end")
backend/app/api/billing.py:699:        return {
backend/app/api/billing.py:705:    return {
backend/app/api/billing.py:779:            return {
backend/app/api/billing.py:814:            return {
backend/app/api/billing.py:902:            return {
backend/app/api/billing.py:943:    return {
backend/app/api/billing.py:959:            return {"received": True}
backend/app/api/billing.py:963:        return {"received": True}
backend/app/api/billing.py:968:        return {"received": True}
backend/app/api/billing.py:994:        return {"received": True}
backend/app/api/billing.py:1051:    return {"received": True}
backend/app/api/billing.py:1063:            return {"received": True}
backend/app/api/billing.py:1067:        return {"received": True}
backend/app/api/billing.py:1075:            return {"received": True}
backend/app/api/billing.py:1079:            return {"received": True}
backend/app/api/billing.py:1082:        return {"received": True}
backend/app/api/billing.py:1088:        return {"received": True}
backend/app/api/billing.py:1094:        return {"received": True}
backend/app/api/billing.py:1140:    return {"received": True}
backend/app/api/billing.py:1149:        return await _handle_checkout_session_subscription_completed(session, db)
backend/app/api/billing.py:1151:        return await _handle_checkout_session_payment_completed(session, db)
backend/app/api/billing.py:1152:    return {"received": True}
backend/app/api/billing.py:1162:        return {"received": True}
backend/app/api/billing.py:1167:        return {"received": True}
backend/app/api/billing.py:1227:    return {"received": True}
backend/app/api/billing.py:1236:        return {"received": True}
backend/app/api/billing.py:1240:        return {"received": True}
backend/app/api/billing.py:1254:        return {"received": True}
backend/app/api/billing.py:1273:        return {"received": True}
backend/app/api/billing.py:1276:        return {"received": True}
backend/app/api/billing.py:1285:    return {"received": True}
backend/app/api/billing.py:1295:            return {"received": True}
backend/app/api/billing.py:1298:        return {"received": True}
backend/app/api/billing.py:1302:        return {"received": True}
backend/app/api/billing.py:1309:        return {"received": True}
backend/app/api/billing.py:1315:    return {"received": True}
backend/app/api/billing.py:1325:        return {"received": True}
backend/app/api/billing.py:1328:        return {"received": True}
backend/app/api/billing.py:1331:        return {"received": True}
backend/app/api/billing.py:1334:        return {"received": True}
backend/app/api/billing.py:1336:        return {"received": True}
backend/app/api/billing.py:1340:        return {"received": True}
backend/app/api/billing.py:1389:    return {"received": True}
backend/app/api/billing.py:1403:    return {"received": True}
backend/app/api/billing.py:1436:        return {"received": True}
backend/app/api/billing.py:1442:        return {"received": True}
backend/app/api/billing.py:1445:        return await handler(obj, db, event)
backend/app/api/billing.py:1446:    return await handler(obj, db)
backend/app/services/quote_search_service.py:75:    "do not paraphrase, translate, summarize, merge sources, or fix typos. "
backend/app/services/quote_search_service.py:79:    'verbatim supports the topic, return {"quotes": []}. Output nothing but '
backend/app/services/quote_search_service.py:126:# chat_service.py/document_brief_service.py/table_service.py/summary_service.py),
backend/app/services/quote_search_service.py:131:    return model in settings.DEEPSEEK_OFFICIAL_MODELS
backend/app/services/quote_search_service.py:138:        return AsyncOpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)
backend/app/services/quote_search_service.py:141:    return AsyncOpenAI(api_key=settings.OPENROUTER_API_KEY, base_url=settings.OPENROUTER_BASE_URL)
backend/app/services/quote_search_service.py:162:    return data
backend/app/services/quote_search_service.py:171:    return list(result.scalars().all())
backend/app/services/quote_search_service.py:178:    return list(result.scalars().all())
backend/app/services/quote_search_service.py:202:        return []
backend/app/services/quote_search_service.py:205:        return []
backend/app/services/quote_search_service.py:210:            return False
backend/app/services/quote_search_service.py:211:        return norm_topic in norm_text or any(t in norm_text for t in terms)
backend/app/services/quote_search_service.py:230:    return hits
backend/app/services/quote_search_service.py:235:        return {}
backend/app/services/quote_search_service.py:237:    return {c.id: c for c in result.scalars().all()}
backend/app/services/quote_search_service.py:275:    return ordered[:MAX_CANDIDATE_CHUNKS], len(all_chunks)
backend/app/services/quote_search_service.py:286:    return len(pages)
backend/app/services/quote_search_service.py:297:    return list(result.scalars().all())
backend/app/services/quote_search_service.py:309:    return "\n\n".join(parts)
backend/app/services/quote_search_service.py:368:    return quotes, prompt_tokens, completion_tokens
backend/app/services/quote_search_service.py:374:    return isinstance(bb, dict) and all(isinstance(bb.get(k), (int, float)) for k in ("x", "y", "w", "h"))
backend/app/services/quote_search_service.py:385:        return fallback_page, []
backend/app/services/quote_search_service.py:393:    return best_page, page_bboxes
backend/app/services/quote_search_service.py:407:    return matched_segment.chunk_id is not None and matched_segment.page_start != matched_segment.page_end
backend/app/services/quote_search_service.py:439:        return page, page_end, bboxes, str(chunk.id)
backend/app/services/quote_search_service.py:445:    return page, matched_segment.page_end, bboxes, str(matched_segment.chunk_id)
backend/app/services/quote_search_service.py:467:        return f"{verification.raw_start}-{verification.raw_end}"
backend/app/services/quote_search_service.py:468:    return ""
backend/app/services/quote_search_service.py:512:    return matches, best_failure
backend/app/services/quote_search_service.py:526:        return QuoteSearchResult(
backend/app/services/quote_search_service.py:595:    return QuoteSearchResult(
backend/app/services/quote_search_service.py:643:        return None
backend/app/services/quote_search_service.py:660:        return None
backend/app/services/quote_search_service.py:669:    return QuoteCard(
backend/app/services/quote_search_service.py:681:        # returns them); source_text_hash lets a future revalidation pass
backend/app/api/export.py:34:    return re.sub(r"[^\w\s\-.]", "", name)[:100] or "export"
backend/app/api/export.py:59:    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{utf8_quoted}"
backend/app/api/export.py:108:            return StreamingResponse(
backend/app/api/export.py:115:            return StreamingResponse(
backend/app/api/export.py:122:            return StreamingResponse(
backend/app/services/export_service.py:30:        return ""
backend/app/services/export_service.py:31:    return _XML_INVALID_RE.sub("", str(s))
backend/app/services/export_service.py:49:    return sorted(citations, key=lambda c: c.get("ref_index", 0))
backend/app/services/export_service.py:57:    return f"Page {page}, {source}\"{snippet}...\""
backend/app/services/export_service.py:91:    return "\n".join(lines)
backend/app/services/export_service.py:145:        return buf
backend/app/services/export_service.py:203:        return buf
backend/app/api/extractions.py:49:    domain_mode: Literal["legal", "academic"] | None = None
backend/app/api/extractions.py:78:        return None
backend/app/api/extractions.py:80:        return dt.replace(tzinfo=timezone.utc)
backend/app/api/extractions.py:81:    return dt.astimezone(timezone.utc)
backend/app/api/extractions.py:90:    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quote(clean, safe='')}"
backend/app/api/extractions.py:96:    return job.__dict__.get("extraction_result")
backend/app/api/extractions.py:110:    return ExtractionJobResponse(
backend/app/api/extractions.py:134:    return doc
backend/app/api/extractions.py:139:        return
backend/app/api/extractions.py:166:    return list_templates()
backend/app/api/extractions.py:187:    # P1 hygiene follow-up (2026-08-03): domain_mode ("legal"/"academic")
backend/app/api/extractions.py:194:    if body.domain_mode is not None:
backend/app/api/extractions.py:224:            "domain_mode": body.domain_mode,
backend/app/api/extractions.py:289:    return _job_response(job)
backend/app/api/extractions.py:308:    return [_job_response(job) for job in rows.scalars()]
backend/app/api/extractions.py:330:    return _job_response(job)
backend/app/api/extractions.py:357:        return StreamingResponse(
backend/app/api/extractions.py:363:    return StreamingResponse(
backend/app/api/feedback.py:22:        return None
backend/app/api/feedback.py:24:    return text[:max_len] if text else None
backend/app/api/feedback.py:80:    return FeedbackResponse(id=str(feedback.id))
backend/app/services/share_anchor_service.py:15:    return f"msg-{value[:16]}"
backend/app/services/chat_service.py:75:    return {"event": event, "data": data}
backend/app/services/chat_service.py:88:    """Log detailed error server-side, return sanitized SSE payload to client."""
backend/app/services/chat_service.py:90:    return sse(event, {"code": code, "message": _USER_SAFE_ERRORS.get(code, "An error occurred.")})
backend/app/services/chat_service.py:112:    return (locale or "").strip().lower().replace("_", "-").split("-")[0]
backend/app/services/chat_service.py:152:    return template.format(**fmt)
backend/app/services/chat_service.py:155:def _is_strict_quote_routed(
backend/app/services/chat_service.py:169:    return (
backend/app/services/chat_service.py:182:        return _LOCALE_LANGUAGE_LABELS[normalized]
backend/app/services/chat_service.py:186:        return "Japanese"
backend/app/services/chat_service.py:188:        return "Korean"
backend/app/services/chat_service.py:190:        return "Chinese"
backend/app/services/chat_service.py:192:        return "Arabic"
backend/app/services/chat_service.py:194:        return "Hindi"
backend/app/services/chat_service.py:195:    return None
backend/app/services/chat_service.py:201:    return (
backend/app/services/chat_service.py:213:    return (
backend/app/services/chat_service.py:218:        "Do not translate, restart, summarize, or switch to English.\n"
backend/app/services/chat_service.py:233:    return _openai_client
backend/app/services/chat_service.py:237:    return model in settings.DEEPSEEK_OFFICIAL_MODELS
backend/app/services/chat_service.py:249:    return _deepseek_client
backend/app/services/chat_service.py:254:        return _get_deepseek_client()
backend/app/services/chat_service.py:255:    return _get_openai_client()
backend/app/services/chat_service.py:270:    return all(isinstance(bb.get(k), (int, float)) for k in ("x", "y", "w", "h"))
backend/app/services/chat_service.py:276:    is_summary = chunk.retrieval_modality == "summary"
backend/app/services/chat_service.py:277:    all_bbs = [] if is_summary else [
backend/app/services/chat_service.py:317:    if not is_summary and claim_text and chunk.text:
backend/app/services/chat_service.py:334:    if is_summary:
backend/app/services/chat_service.py:336:        citation_data["summary_target_sections"] = list(chunk.summary_target_sections)
backend/app/services/chat_service.py:337:        citation_data["summary_model_covered_sections"] = list(chunk.summary_model_covered_sections)
backend/app/services/chat_service.py:338:        citation_data["summary_fallback_sections"] = list(chunk.summary_fallback_sections)
backend/app/services/chat_service.py:339:        citation_data["summary_missing_sections"] = list(chunk.summary_missing_sections)
backend/app/services/chat_service.py:344:    return citation_data
backend/app/services/chat_service.py:358:    return features
backend/app/services/chat_service.py:373:            return anchors
backend/app/services/chat_service.py:376:        return anchors
backend/app/services/chat_service.py:379:    return [(len(text), stripped)] if stripped else []
backend/app/services/chat_service.py:392:    a cited-answer product from returning an uncited response when retrieval
backend/app/services/chat_service.py:396:        return []
backend/app/services/chat_service.py:422:    return fallback
backend/app/services/chat_service.py:441:    return clean_text, citations
backend/app/services/chat_service.py:456:    return total
backend/app/services/chat_service.py:465:        return True
backend/app/services/chat_service.py:467:        return True
backend/app/services/chat_service.py:468:    return repaired_issues == initial_issues and repaired_score >= initial_score + 0.15
backend/app/services/chat_service.py:485:        return None
backend/app/services/chat_service.py:557:        return _CitationRepairResult(
backend/app/services/chat_service.py:569:        return _CitationRepairResult(
backend/app/services/chat_service.py:581:    return (
backend/app/services/chat_service.py:603:        return ""
backend/app/services/chat_service.py:605:        return ""
backend/app/services/chat_service.py:616:        return f"{word} {ps}" if pe == ps else f"{word}s {ps}–{pe}"
backend/app/services/chat_service.py:620:        return rng("page")
backend/app/services/chat_service.py:622:        return rng("slide")
backend/app/services/chat_service.py:624:        return f"sheet {ps}"
backend/app/services/chat_service.py:625:    return rng("document part")
backend/app/services/chat_service.py:636:    if str(item.get("retrieval_modality") or "text") == "summary":
backend/app/services/chat_service.py:649:            parts.append(f"source range: {rng} (summary coverage)")
backend/app/services/chat_service.py:656:    return "; ".join(parts)
backend/app/services/chat_service.py:660:    return (
backend/app/services/chat_service.py:667:        "- \"summary coverage\" ranges are approximate; never use them for exact quotations — quote only "
backend/app/services/chat_service.py:675:    return (
backend/app/services/chat_service.py:699:        return "(none)"
backend/app/services/chat_service.py:702:    return ", ".join(shown) + suffix
backend/app/services/chat_service.py:705:def _summary_coverage_contract(retrieved: list[dict[str, Any]]) -> str:
backend/app/services/chat_service.py:711:        if item.get("retrieval_modality") != "summary":
backend/app/services/chat_service.py:720:        return ""
backend/app/services/chat_service.py:721:    return (
backend/app/services/chat_service.py:734:        return ""
backend/app/services/chat_service.py:741:    return (
backend/app/services/chat_service.py:752:        return ""
backend/app/services/chat_service.py:760:    return (
backend/app/services/chat_service.py:772:        return ""
backend/app/services/chat_service.py:773:    return re.sub(r"[^a-z0-9_\-]+", "-", label)[:40]
backend/app/services/chat_service.py:811:        .returning(CreditLedger.id)
backend/app/services/chat_service.py:825:    return refunded
backend/app/services/chat_service.py:845:        return None
backend/app/services/chat_service.py:858:        return asst_msg.id
backend/app/services/chat_service.py:869:        return False
backend/app/services/chat_service.py:874:            return False
backend/app/services/chat_service.py:882:        return True
backend/app/services/chat_service.py:951:            return await _refund_predebit(settle_db, user_id, pre_debited, predebit_ledger_id)
backend/app/services/chat_service.py:953:    return await _refund_predebit(db, user_id, pre_debited, predebit_ledger_id)
backend/app/services/chat_service.py:956:async def _sync_session_domain_mode(
backend/app/services/chat_service.py:957:    db: AsyncSession, session_obj: ChatSession, domain_mode: Optional[str],
backend/app/services/chat_service.py:960:    ChatSession.domain_mode must reflect the CURRENT request's domain_mode
backend/app/services/chat_service.py:963:    Codex found two successful early-return paths that skipped it — tool
backend/app/services/chat_service.py:964:    actions and strict Quote Finder routing — both returning before the
backend/app/services/chat_service.py:966:    that once had domain_mode="legal" persisted could keep that stale
backend/app/services/chat_service.py:972:    `domain_mode` argument directly, never re-reads session_obj.domain_mode
backend/app/services/chat_service.py:976:    if domain_mode != session_obj.domain_mode:
backend/app/services/chat_service.py:977:        session_obj.domain_mode = domain_mode
backend/app/services/chat_service.py:1003:    return [chunk_to_retrieval_item(ch, 1.0, include_document_id=True) for ch in chunks]
backend/app/services/chat_service.py:1069:    summary_target_sections: tuple[str, ...] = ()
backend/app/services/chat_service.py:1070:    summary_model_covered_sections: tuple[str, ...] = ()
backend/app/services/chat_service.py:1071:    summary_fallback_sections: tuple[str, ...] = ()
backend/app/services/chat_service.py:1072:    summary_missing_sections: tuple[str, ...] = ()
backend/app/services/chat_service.py:1103:    quote_search() returns (before any commit) so accurate billing is
backend/app/services/chat_service.py:1105:    ONLY after the atomic commit's await ACTUALLY returns — kept for
backend/app/services/chat_service.py:1129:    if citation.get("retrieval_modality") == "summary":
backend/app/services/chat_service.py:1130:        return _ChunkInfo(
backend/app/services/chat_service.py:1136:            section_title="Map-reduce section summary",
backend/app/services/chat_service.py:1140:            retrieval_modality="summary",
backend/app/services/chat_service.py:1141:            summary_target_sections=tuple(citation.get("summary_target_sections") or ()),
backend/app/services/chat_service.py:1142:            summary_model_covered_sections=tuple(citation.get("summary_model_covered_sections") or ()),
backend/app/services/chat_service.py:1143:            summary_fallback_sections=tuple(citation.get("summary_fallback_sections") or ()),
backend/app/services/chat_service.py:1144:            summary_missing_sections=tuple(citation.get("summary_missing_sections") or ()),
backend/app/services/chat_service.py:1149:    return _ChunkInfo(
backend/app/services/chat_service.py:1185:    caller reconciles this call's cost like summary usage. Gated + non-raising:
backend/app/services/chat_service.py:1192:        return _skip
backend/app/services/chat_service.py:1197:        return _skip
backend/app/services/chat_service.py:1216:        return (changed, focus_model, focus_pt, focus_ct)
backend/app/services/chat_service.py:1219:        return _skip
backend/app/services/chat_service.py:1222:        return _skip
backend/app/services/chat_service.py:1276:        return events
backend/app/services/chat_service.py:1283:        return events
backend/app/services/chat_service.py:1309:    async def _tool_action_stream(
backend/app/services/chat_service.py:1317:        domain_mode: Optional[str],
backend/app/services/chat_service.py:1329:                yield sse("tool_status", {"message": action_plan.user_visible_status})
backend/app/services/chat_service.py:1337:                domain_mode=domain_mode,
backend/app/services/chat_service.py:1342:                yield sse("artifact", artifact_payload)
backend/app/services/chat_service.py:1344:                yield sse("token", {"text": assistant_text})
backend/app/services/chat_service.py:1362:            yield sse(
backend/app/services/chat_service.py:1375:            yield _safe_sse("error", "CHAT_SETUP_ERROR", exc, session_id=str(session_id))
backend/app/services/chat_service.py:1394:        of it awaited here, nothing yielded. `progress` is mutated as this
backend/app/services/chat_service.py:1395:        proceeds (model/tokens as soon as quote_search() returns,
backend/app/services/chat_service.py:1439:                summary=assistant_text,
backend/app/services/chat_service.py:1511:        # returned — the ordinary-exception handler (FIX-4) uses this to
backend/app/services/chat_service.py:1515:        return _VerifiedQuoteOutcome(
backend/app/services/chat_service.py:1530:        domain_mode: Optional[str] = None,
backend/app/services/chat_service.py:1541:        7) Parse with RefParserFSM and yield events; ping every 15s
backend/app/services/chat_service.py:1550:            yield sse("error", {"code": "SESSION_NOT_FOUND", "message": "会话不存在"})
backend/app/services/chat_service.py:1551:            return
backend/app/services/chat_service.py:1596:                yield sse(
backend/app/services/chat_service.py:1604:                return
backend/app/services/chat_service.py:1613:            # early-return path skipped the domain_mode session sync that
backend/app/services/chat_service.py:1615:            # _sync_session_domain_mode's docstring.
backend/app/services/chat_service.py:1616:            await _sync_session_domain_mode(db, session_obj, domain_mode)
backend/app/services/chat_service.py:1617:            async for ev in self._tool_action_stream(
backend/app/services/chat_service.py:1623:                domain_mode=domain_mode,
backend/app/services/chat_service.py:1628:                yield ev
backend/app/services/chat_service.py:1629:            return
backend/app/services/chat_service.py:1634:            domain_mode=domain_mode,
backend/app/services/chat_service.py:1640:        strict_quote_routed = _is_strict_quote_routed(
backend/app/services/chat_service.py:1653:                if strict_quote_routed
backend/app/services/chat_service.py:1660:                reason="chat", ref_type="mode", ref_id="balanced" if strict_quote_routed else effective_mode,
backend/app/services/chat_service.py:1667:                yield sse(
backend/app/services/chat_service.py:1676:                return
backend/app/services/chat_service.py:1695:            # than erroring. SAME predicate (`strict_quote_routed`, computed
backend/app/services/chat_service.py:1699:            if strict_quote_routed:
backend/app/services/chat_service.py:1784:                            yield _safe_sse("error", "QUOTE_SEARCH_ERROR", exc, session_id=str(session_id))
backend/app/services/chat_service.py:1785:                            return
backend/app/services/chat_service.py:1797:                            yield _safe_sse(
backend/app/services/chat_service.py:1800:                            return
backend/app/services/chat_service.py:1802:                        yield _safe_sse("error", "QUOTE_SEARCH_ERROR", exc, session_id=str(session_id))
backend/app/services/chat_service.py:1803:                        return
backend/app/services/chat_service.py:1806:                # mark settled BEFORE yielding so a cancellation during these
backend/app/services/chat_service.py:1807:                # yields can't ALSO trigger the setup handler's full refund
backend/app/services/chat_service.py:1811:                # early-return path also skipped the domain_mode session
backend/app/services/chat_service.py:1812:                # sync — see _sync_session_domain_mode's docstring.
backend/app/services/chat_service.py:1813:                await _sync_session_domain_mode(db, session_obj, domain_mode)
backend/app/services/chat_service.py:1815:                    yield sse("artifact", outcome.artifact_payload)
backend/app/services/chat_service.py:1816:                yield sse("token", {"text": outcome.assistant_text})
backend/app/services/chat_service.py:1817:                yield sse(
backend/app/services/chat_service.py:1828:                return
backend/app/services/chat_service.py:1848:            # Whole-document summaries must not use ordinary semantic top-k: vague
backend/app/services/chat_service.py:1849:            # summary prompts frequently retrieve tables/appendices instead of
backend/app/services/chat_service.py:1856:            summary_usage = MapReduceUsageCollector()
backend/app/services/chat_service.py:1862:                yield sse("tool_status", {"message": "Summarizing the document section by section…"})
backend/app/services/chat_service.py:1863:                retrieved = await document_brief_service.get_summary_context(
backend/app/services/chat_service.py:1867:                    usage_collector=summary_usage,
backend/app/services/chat_service.py:1869:                retrieval_strategy = "document_summary_context"
backend/app/services/chat_service.py:1875:                retrieved = await document_brief_service.get_collection_summary_context(
backend/app/services/chat_service.py:1881:                retrieval_strategy = "collection_summary_context"
backend/app/services/chat_service.py:1941:            has_map_reduce_summary_context = any(
backend/app/services/chat_service.py:1942:                item.get("retrieval_modality") == "summary"
backend/app/services/chat_service.py:1982:                    summary_target_sections=tuple(item.get("map_reduce_target_sections") or ()),
backend/app/services/chat_service.py:1983:                    summary_model_covered_sections=tuple(
backend/app/services/chat_service.py:1986:                    summary_fallback_sections=tuple(item.get("map_reduce_fallback_sections") or ()),
backend/app/services/chat_service.py:1987:                    summary_missing_sections=tuple(item.get("map_reduce_missing_sections") or ()),
backend/app/services/chat_service.py:1994:            if is_collection_session and retrieval_strategy == "collection_summary_context":
backend/app/services/chat_service.py:1997:                    "You are a document analysis assistant. The user is asking for a broad summary across a document collection.\n\n"
backend/app/services/chat_service.py:2024:            elif retrieval_strategy == "document_summary_context":
backend/app/services/chat_service.py:2026:                    "7. The sources may be map-reduce section summaries generated from source chunks; "
backend/app/services/chat_service.py:2028:                    if has_map_reduce_summary_context
backend/app/services/chat_service.py:2032:                    "You are a document analysis assistant. The user is asking for a broad, whole-document summary.\n\n"
backend/app/services/chat_service.py:2043:                    + "3. Produce a useful document-level summary with clear headings, key points, and important caveats when supported.\n"
backend/app/services/chat_service.py:2048:                    + _summary_coverage_contract(retrieved)
backend/app/services/chat_service.py:2074:            # Frontend always sends domain_mode: null (default) or "legal"/"academic"
backend/app/services/chat_service.py:2075:            # domain_mode=None means Default (no extra rules), string means apply rules
backend/app/services/chat_service.py:2076:            if domain_mode:
backend/app/services/chat_service.py:2078:                domain_rules = DOMAIN_RULES.get(domain_mode)
backend/app/services/chat_service.py:2081:                    domain_rules_text = f"\n\n## {domain_mode.title()} Mode Rules\n"
backend/app/services/chat_service.py:2090:            # Persist domain_mode to session (null clears, string sets) —
backend/app/services/chat_service.py:2091:            # see _sync_session_domain_mode's docstring; this is the main
backend/app/services/chat_service.py:2093:            # Quote Finder early returns above (P1 hygiene, Codex 2026-08-03).
backend/app/services/chat_service.py:2094:            await _sync_session_domain_mode(db, session_obj, domain_mode)
backend/app/services/chat_service.py:2141:            yield _safe_sse("error", setup_error_code, e, session_id=str(session_id))
backend/app/services/chat_service.py:2142:            return
backend/app/services/chat_service.py:2157:            yield _safe_sse("error", "LLM_ERROR", e, session_id=str(session_id))
backend/app/services/chat_service.py:2158:            return
backend/app/services/chat_service.py:2223:                            yield ev
backend/app/services/chat_service.py:2237:                        yield sse("ping", {})
backend/app/services/chat_service.py:2244:                    yield ev
backend/app/services/chat_service.py:2257:                            yield sse("citation", citation)
backend/app/services/chat_service.py:2265:                    yield sse("truncated", {"reason": "max_tokens"})
backend/app/services/chat_service.py:2293:                yield _safe_sse("error", "LLM_ERROR", e, session_id=str(session_id))
backend/app/services/chat_service.py:2294:                return
backend/app/services/chat_service.py:2327:                yield sse("error", {"code": "PERSIST_FAILED", "message": "Failed to save response"})
backend/app/services/chat_service.py:2328:                return
backend/app/services/chat_service.py:2338:                yield sse("tool_status", {"message": "Checking citation support..."})
backend/app/services/chat_service.py:2368:                        yield sse(
backend/app/services/chat_service.py:2390:                yield sse("tool_status", {"message": "Refining citations..."})
backend/app/services/chat_service.py:2400:                yield sse("citations_refined", {"citations": citations})
backend/app/services/chat_service.py:2412:                yield sse("error", {"code": "PERSIST_FAILED", "message": "Failed to save response"})
backend/app/services/chat_service.py:2413:                return
backend/app/services/chat_service.py:2432:                    summary_usage_costs: list[tuple[str, int, int, int]] = []
backend/app/services/chat_service.py:2433:                    for usage_model, (summary_prompt, summary_completion) in summary_usage.totals_by_model().items():
backend/app/services/chat_service.py:2434:                        summary_mode = "quick" if usage_model == settings.MODE_MODELS.get("quick") else None
backend/app/services/chat_service.py:2435:                        summary_cost = credit_service.calculate_cost(
backend/app/services/chat_service.py:2436:                            summary_prompt,
backend/app/services/chat_service.py:2437:                            summary_completion,
backend/app/services/chat_service.py:2439:                            mode=summary_mode,
backend/app/services/chat_service.py:2441:                        summary_usage_costs.append(
backend/app/services/chat_service.py:2442:                            (usage_model, summary_prompt, summary_completion, summary_cost)
backend/app/services/chat_service.py:2445:                    # reconciled + recorded like summary usage.
backend/app/services/chat_service.py:2453:                        + sum(item[3] for item in summary_usage_costs)
backend/app/services/chat_service.py:2468:                    for usage_model, summary_prompt, summary_completion, summary_cost in summary_usage_costs:
backend/app/services/chat_service.py:2474:                            prompt_tokens=summary_prompt,
backend/app/services/chat_service.py:2475:                            completion_tokens=summary_completion,
backend/app/services/chat_service.py:2476:                            cost_credits=summary_cost,
backend/app/services/chat_service.py:2492:                    yield _safe_sse("warn", "ACCOUNTING_ERROR", e, session_id=str(session_id))
backend/app/services/chat_service.py:2497:            yield sse("done", {
backend/app/services/chat_service.py:2582:            yield sse("error", {"code": "SESSION_NOT_FOUND", "message": "Session not found"})
backend/app/services/chat_service.py:2583:            return
backend/app/services/chat_service.py:2626:            yield sse("error", {"code": "MESSAGE_NOT_FOUND", "message": "Assistant message not found"})
backend/app/services/chat_service.py:2627:            return
backend/app/services/chat_service.py:2630:            yield sse("error", {"code": "MESSAGE_NOT_FOUND", "message": "Message does not belong to this session"})
backend/app/services/chat_service.py:2631:            return
backend/app/services/chat_service.py:2635:            yield sse("error", {"code": "CONTINUATION_LIMIT", "message": "Maximum continuations reached"})
backend/app/services/chat_service.py:2636:            return
backend/app/services/chat_service.py:2649:                yield sse(
backend/app/services/chat_service.py:2657:                return
backend/app/services/chat_service.py:2673:                yield sse("error", {
backend/app/services/chat_service.py:2679:                return
backend/app/services/chat_service.py:2868:            yield _safe_sse("error", "CHAT_SETUP_ERROR", e, session_id=str(session_id))
backend/app/services/chat_service.py:2869:            return
backend/app/services/chat_service.py:2884:            yield _safe_sse("error", "LLM_ERROR", e, session_id=str(session_id))
backend/app/services/chat_service.py:2885:            return
backend/app/services/chat_service.py:2935:                            yield ev
backend/app/services/chat_service.py:2946:                        yield sse("ping", {})
backend/app/services/chat_service.py:2952:                    yield ev
backend/app/services/chat_service.py:2969:                            yield sse("citation", citation)
backend/app/services/chat_service.py:2972:                    yield sse("truncated", {"reason": "max_tokens"})
backend/app/services/chat_service.py:2991:                yield _safe_sse("error", "LLM_ERROR", e, session_id=str(session_id))
backend/app/services/chat_service.py:2992:                return
backend/app/services/chat_service.py:3022:                yield sse("error", {"code": "PERSIST_FAILED", "message": "Failed to save continuation"})
backend/app/services/chat_service.py:3023:                return
backend/app/services/chat_service.py:3033:                yield sse("tool_status", {"message": "Checking citation support..."})
backend/app/services/chat_service.py:3062:                        yield sse(
backend/app/services/chat_service.py:3084:                yield sse("tool_status", {"message": "Refining citations..."})
backend/app/services/chat_service.py:3094:                yield sse("citations_refined", {"citations": merged_citations})
backend/app/services/chat_service.py:3103:                yield sse("error", {"code": "PERSIST_FAILED", "message": "Failed to save continuation"})
backend/app/services/chat_service.py:3104:                return
backend/app/services/chat_service.py:3154:                    yield _safe_sse("warn", "ACCOUNTING_ERROR", e, session_id=str(session_id))
backend/app/services/chat_service.py:3159:            yield sse("done", {
backend/app/api/documents.py:94:        return False
backend/app/api/documents.py:100:                    return False
backend/app/api/documents.py:103:                    return False
backend/app/api/documents.py:105:            return False
backend/app/api/documents.py:106:    return True
backend/app/api/documents.py:118:        return []
backend/app/api/documents.py:133:    return [
backend/app/api/documents.py:152:        return cached
backend/app/api/documents.py:174:    return payload
backend/app/api/documents.py:276:            return data
backend/app/api/documents.py:296:    return JSONResponse(
backend/app/api/documents.py:430:        # URL returned a PDF — process through normal PDF pipeline
backend/app/api/documents.py:454:        return JSONResponse(
backend/app/api/documents.py:459:        # URL returned HTML: store a structured Markdown snapshot and process
backend/app/api/documents.py:500:        return JSONResponse(
backend/app/api/documents.py:521:    return resp
backend/app/api/documents.py:545:    return chunk_ids
backend/app/api/documents.py:551:    return {
backend/app/api/documents.py:585:    return hydrated
backend/app/api/documents.py:612:        if doc.summary or doc.suggested_questions:
backend/app/api/documents.py:613:            return DocumentHierarchicalBriefResponse(
backend/app/api/documents.py:616:                summary=doc.summary,
backend/app/api/documents.py:618:                coverage={"status": "legacy_summary"},
backend/app/api/documents.py:620:        return DocumentHierarchicalBriefResponse(
backend/app/api/documents.py:639:    return DocumentHierarchicalBriefResponse(
backend/app/api/documents.py:643:        summary=brief.summary,
backend/app/api/documents.py:688:    return DocumentFileUrlResponse(url=url, expires_in=int(settings.MINIO_PRESIGN_TTL))
backend/app/api/documents.py:747:    # drops page 2. Require COMPLETE, CONSECUTIVE coverage — the returned
backend/app/api/documents.py:800:    return {
backend/app/api/documents.py:847:    return {"status": "reparsing"}
backend/app/api/documents.py:867:    return JSONResponse(status_code=202, content={"status": "deleted"})
backend/app/api/documents.py:910:    return {"status": "updated"}
backend/app/services/document_element_service.py:18:    return len((getattr(element, "text", "") or "").strip())
backend/app/services/document_element_service.py:32:    return sorted(usable, key=lambda el: int(getattr(el, "reading_order", 0) or 0))
backend/app/services/document_element_service.py:44:    summaries/extractions/diffs get stable context while the legacy chunk
backend/app/services/document_element_service.py:49:        return []
backend/app/services/document_element_service.py:51:        return usable
backend/app/services/document_element_service.py:85:    return [usable[idx] for idx in sorted(selected_indices)[:max_elements]]
backend/app/services/document_element_service.py:89:    return (
backend/app/services/document_element_service.py:105:    return max(0.55, base - rank * 0.01)
backend/app/services/document_element_service.py:115:        return []
backend/app/services/document_element_service.py:123:        return []
backend/app/services/document_element_service.py:156:        return selected[:max_chunks]
backend/app/services/document_element_service.py:161:        return selected
backend/app/services/document_element_service.py:179:    return selected[:max_chunks]
backend/app/services/document_element_service.py:194:    return item
backend/app/services/document_element_service.py:202:    return_prefetched_chunks: bool = False,
backend/app/services/document_element_service.py:211:        if return_prefetched_chunks:
backend/app/services/document_element_service.py:212:            return [], []
backend/app/services/document_element_service.py:213:        return []
backend/app/services/document_element_service.py:222:    if return_prefetched_chunks:
backend/app/services/document_element_service.py:223:        return selected, chunks
backend/app/services/document_element_service.py:224:    return selected
backend/app/services/document_element_service.py:232:    return_prefetched_chunks: bool = False,
backend/app/services/document_element_service.py:241:        if return_prefetched_chunks:
backend/app/services/document_element_service.py:242:            return [], []
backend/app/services/document_element_service.py:243:        return []
backend/app/services/document_element_service.py:252:    if return_prefetched_chunks:
backend/app/services/document_element_service.py:253:        return selected, chunks
backend/app/services/document_element_service.py:254:    return selected
backend/app/services/auth_service.py:21:    return hashlib.sha256(token.encode()).hexdigest()
backend/app/services/auth_service.py:74:    return user
backend/app/services/auth_service.py:78:    return await db.get(User, user_id)
backend/app/services/auth_service.py:83:    return result.scalar_one_or_none()
backend/app/services/auth_service.py:93:    return result.scalar_one_or_none()
backend/app/services/auth_service.py:102:    return user
backend/app/services/auth_service.py:130:    return account
backend/app/services/auth_service.py:150:    return vt
backend/app/services/auth_service.py:173:        return None
backend/app/services/auth_service.py:179:        return None
backend/app/services/auth_service.py:184:    return vt
backend/app/workers/cleanup_tasks.py:27:        return
backend/app/workers/cleanup_tasks.py:63:        return 0
backend/app/workers/cleanup_tasks.py:87:        return deleted
backend/app/models/tables.py:53:    # Auto-generated summary and suggested questions (populated after parsing)
backend/app/models/tables.py:54:    summary: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
backend/app/models/tables.py:76:        return self.demo_slug is not None
backend/app/models/tables.py:218:    domain_mode: Mapped[Optional[str]] = mapped_column(sa.String(20), nullable=True)
backend/app/models/tables.py:656:    summary: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
backend/app/services/extraction_service.py:54:    "executive_summary": ExtractionTemplate(
backend/app/services/extraction_service.py:55:        key="executive_summary",
backend/app/services/extraction_service.py:61:            "executive summary key points",
backend/app/services/extraction_service.py:64:            '{"title": string, "summary": string, '
backend/app/services/extraction_service.py:101:    return [
backend/app/services/extraction_service.py:109:        return TEMPLATES[template_key]
backend/app/services/extraction_service.py:115:    return model in settings.DEEPSEEK_OFFICIAL_MODELS
backend/app/services/extraction_service.py:122:        return OpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)
backend/app/services/extraction_service.py:125:    return OpenAI(api_key=settings.OPENROUTER_API_KEY, base_url=settings.OPENROUTER_BASE_URL)
backend/app/services/extraction_service.py:147:    return data
backend/app/services/extraction_service.py:151:    return all(isinstance(bb.get(k), (int, float)) for k in ("x", "y", "w", "h"))
backend/app/services/extraction_service.py:173:    return {
backend/app/services/extraction_service.py:207:            return []
backend/app/services/extraction_service.py:211:        return [(ch, scores.get(ch.id, 0.0)) for ch in chunks if len((ch.text or "").strip()) >= 80][:top_k]
backend/app/services/extraction_service.py:214:        return []
backend/app/services/extraction_service.py:233:            return selected
backend/app/services/extraction_service.py:243:                return selected
backend/app/services/extraction_service.py:246:        return selected[:max_chunks]
backend/app/services/extraction_service.py:254:    return [(chunk, 0.0) for chunk in rows.scalars()]
backend/app/services/extraction_service.py:265:    return "\n\n".join(parts)
backend/app/services/extraction_service.py:268:def _system_prompt(template: ExtractionTemplate, domain_mode: str | None) -> str:
backend/app/services/extraction_service.py:269:    domain = f"\nDomain mode: {domain_mode}." if domain_mode else ""
backend/app/services/extraction_service.py:270:    return (
backend/app/services/extraction_service.py:281:    return (
backend/app/services/extraction_service.py:290:def _call_llm(template: ExtractionTemplate, chunks: Sequence[tuple[Chunk, float]], locale: str | None, domain_mode: str | None) -> tuple[dict[str, Any], int, int]:
backend/app/services/extraction_service.py:293:        {"role": "system", "content": _system_prompt(template, domain_mode)},
backend/app/services/extraction_service.py:309:        return _json_from_text(content), prompt_tokens, completion_tokens
backend/app/services/extraction_service.py:333:        return _json_from_text(repaired_content), prompt_tokens, completion_tokens
backend/app/services/extraction_service.py:338:        return [1] if max_ref >= 1 else []
backend/app/services/extraction_service.py:347:    return refs or ([1] if max_ref >= 1 else [])
backend/app/services/extraction_service.py:352:    return text[:4000]
backend/app/services/extraction_service.py:356:    if template_key == "executive_summary":
backend/app/services/extraction_service.py:359:        return {
backend/app/services/extraction_service.py:361:            "summary": _str(raw.get("summary")),
backend/app/services/extraction_service.py:373:        return {
backend/app/services/extraction_service.py:386:        return {
backend/app/services/extraction_service.py:406:                    yield int(ref)
backend/app/services/extraction_service.py:410:            yield from _walk_refs(child)
backend/app/services/extraction_service.py:413:            yield from _walk_refs(child)
backend/app/services/extraction_service.py:417:    return " ".join(f"[{ref}]" for ref in refs)
backend/app/services/extraction_service.py:422:    if template.key == "executive_summary":
backend/app/services/extraction_service.py:424:        summary = data.get("summary") or ""
backend/app/services/extraction_service.py:425:        lines = [f"# {title}", "", summary, "", "## Key Points"]
backend/app/services/extraction_service.py:453:    return "\n".join(lines).strip() + "\n"
backend/app/services/extraction_service.py:457:    return str(value or "").replace("|", "\\|").replace("\n", " ").strip()
backend/app/services/extraction_service.py:463:    if template_key == "executive_summary":
backend/app/services/extraction_service.py:465:        if data.get("summary"):
backend/app/services/extraction_service.py:466:            writer.writerow(["summary", data.get("summary"), ""])
backend/app/services/extraction_service.py:479:    return buf.getvalue()
backend/app/services/extraction_service.py:521:            return
backend/app/services/extraction_service.py:523:            return
backend/app/services/extraction_service.py:541:            domain_mode = (job.input_scope or {}).get("domain_mode")
backend/app/services/extraction_service.py:546:            raw, prompt_tokens, completion_tokens = _call_llm(template, chunks, locale, domain_mode)
backend/app/services/extraction_service.py:589:                return
backend/app/services/rag_evaluator_service.py:56:    "summarize",
backend/app/services/rag_evaluator_service.py:57:    "summary",
backend/app/services/rag_evaluator_service.py:116:    return tuple(out)
backend/app/services/rag_evaluator_service.py:123:    bigrams over generic instruction words such as "summarize" or "document".
backend/app/services/rag_evaluator_service.py:128:        return QueryEvidenceTerms(lexical_terms=(), exact_terms=())
backend/app/services/rag_evaluator_service.py:154:    return QueryEvidenceTerms(lexical_terms=lexical_terms, exact_terms=exact_terms)
backend/app/services/rag_evaluator_service.py:158:    return " ".join(
backend/app/services/rag_evaluator_service.py:170:        return ()
backend/app/services/rag_evaluator_service.py:172:    return tuple(term for term in terms if term.lower() in haystack)
backend/app/services/rag_evaluator_service.py:198:    return " ".join(part for part in (base, coverage_note, correction_note) if part).strip()
backend/app/services/rag_evaluator_service.py:242:        return RetrievalEvaluation(
backend/app/api/auth.py:48:    return user
backend/app/api/auth.py:57:    return await auth_service.get_user_by_id(db, user_id)
backend/app/api/auth.py:66:    return await auth_service.get_user_by_email(db, email)
backend/app/api/auth.py:76:    return await auth_service.get_user_by_account(db, provider, provider_account_id)
backend/app/api/auth.py:89:    return await auth_service.update_user(db, user, **data.model_dump(exclude_unset=True))
backend/app/api/auth.py:111:    return await auth_service.link_account(
backend/app/api/auth.py:143:    return {"identifier": data.identifier, "token": data.token, "expires": data.expires}
backend/app/api/auth.py:154:        return None
backend/app/api/auth.py:155:    return {"identifier": vt.identifier, "token": data.token, "expires": vt.expires}
backend/app/services/chat_tool_executor.py:37:    summary: str
backend/app/services/chat_tool_executor.py:51:            "summary": self.summary,
backend/app/services/chat_tool_executor.py:60:        return payload
backend/app/services/chat_tool_executor.py:72:        return None
backend/app/services/chat_tool_executor.py:74:        return dt.replace(tzinfo=timezone.utc)
backend/app/services/chat_tool_executor.py:75:    return dt.astimezone(timezone.utc)
backend/app/services/chat_tool_executor.py:79:    return any("\u3400" <= ch <= "\u9fff" for ch in text or "")
backend/app/services/chat_tool_executor.py:84:    return zh if _is_zh(status) else en
backend/app/services/chat_tool_executor.py:90:        return None
backend/app/services/chat_tool_executor.py:91:    return doc
backend/app/services/chat_tool_executor.py:96:        return True
backend/app/services/chat_tool_executor.py:108:    return int(used or 0) < FREE_MONTHLY_EXTRACTION_LIMIT
backend/app/services/chat_tool_executor.py:118:    domain_mode: str | None,
backend/app/services/chat_tool_executor.py:120:    template_key = plan.template_key or "executive_summary"
backend/app/services/chat_tool_executor.py:124:        template = get_template("executive_summary")
backend/app/services/chat_tool_executor.py:127:        return ToolExecution(
backend/app/services/chat_tool_executor.py:137:                summary="Structured extraction limit reached.",
backend/app/services/chat_tool_executor.py:150:            "domain_mode": domain_mode,
backend/app/services/chat_tool_executor.py:167:        return ToolExecution(
backend/app/services/chat_tool_executor.py:177:                summary="Insufficient credits.",
backend/app/services/chat_tool_executor.py:215:        return ToolExecution(
backend/app/services/chat_tool_executor.py:226:                summary="Failed to queue extraction.",
backend/app/services/chat_tool_executor.py:236:        summary=plan.user_visible_status or template.description,
backend/app/services/chat_tool_executor.py:242:    return ToolExecution(
backend/app/services/chat_tool_executor.py:266:    return preview
backend/app/services/chat_tool_executor.py:275:    return list(rows.scalars())
backend/app/services/chat_tool_executor.py:301:        return ToolExecution(
backend/app/services/chat_tool_executor.py:311:                summary=f"{len(tables)} table(s) detected.",
backend/app/services/chat_tool_executor.py:361:            return ToolExecution(
backend/app/services/chat_tool_executor.py:372:                    summary="Failed to queue table scan.",
backend/app/services/chat_tool_executor.py:391:        summary=plan.user_visible_status or "Scanning document tables.",
backend/app/services/chat_tool_executor.py:396:    return ToolExecution(
backend/app/services/chat_tool_executor.py:416:        domain_mode: str | None,
backend/app/services/chat_tool_executor.py:419:            return ToolExecution(
backend/app/services/chat_tool_executor.py:425:            return ToolExecution(
backend/app/services/chat_tool_executor.py:433:                return ToolExecution(
backend/app/services/chat_tool_executor.py:439:                return ToolExecution(
backend/app/services/chat_tool_executor.py:443:            return ToolExecution(
backend/app/services/chat_tool_executor.py:450:            return ToolExecution(
backend/app/services/chat_tool_executor.py:456:            return ToolExecution(
backend/app/services/chat_tool_executor.py:461:            return ToolExecution(
backend/app/services/chat_tool_executor.py:467:            return await _queue_extraction(
backend/app/services/chat_tool_executor.py:473:                domain_mode=domain_mode,
backend/app/services/chat_tool_executor.py:476:            return await _queue_table_scan(
backend/app/services/chat_tool_executor.py:484:        return ToolExecution(
backend/app/services/extractors/base.py:22:        return extract_docx(file_bytes)
backend/app/services/extractors/base.py:25:        return extract_pptx(file_bytes)
backend/app/services/extractors/base.py:28:        return extract_xlsx(file_bytes)
backend/app/services/extractors/base.py:31:        return extract_text(file_bytes, file_type)
backend/app/services/extractors/base.py:34:        return extract_text(file_bytes, 'md')
backend/app/api/export.py:34:    return re.sub(r"[^\w\s\-.]", "", name)[:100] or "export"
backend/app/api/export.py:59:    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{utf8_quoted}"
backend/app/api/export.py:108:            return StreamingResponse(
backend/app/api/export.py:115:            return StreamingResponse(
backend/app/api/export.py:122:            return StreamingResponse(
backend/app/services/document_diff_service.py:48:    "executive summary important details dates amounts names policy requirements",
backend/app/services/document_diff_service.py:54:        return []
backend/app/services/document_diff_service.py:63:    return refs
backend/app/services/document_diff_service.py:68:    return text[:4000]
backend/app/services/document_diff_service.py:72:    return str(value or "").replace("|", "\\|").replace("\n", " ").strip()
backend/app/services/document_diff_service.py:77:    return " ".join(labels)
backend/app/services/document_diff_service.py:95:            return selected
backend/app/services/document_diff_service.py:105:                return selected
backend/app/services/document_diff_service.py:108:        return selected[:max_chunks]
backend/app/services/document_diff_service.py:116:    return [(chunk, 0.0) for chunk in rows.scalars()]
backend/app/services/document_diff_service.py:127:    return "\n\n".join(parts)
backend/app/services/document_diff_service.py:131:    return (
backend/app/services/document_diff_service.py:137:        '{"summary": string, "changes": [{"kind": "added"|"removed"|"modified", '
backend/app/services/document_diff_service.py:150:    return (
backend/app/services/document_diff_service.py:186:        return _json_from_text(content), prompt_tokens, completion_tokens
backend/app/services/document_diff_service.py:210:        return _json_from_text(repaired_content), prompt_tokens, completion_tokens
backend/app/services/document_diff_service.py:250:    return {
backend/app/services/document_diff_service.py:253:        "summary": _str(raw.get("summary"), "No material differences were found in the retrieved excerpts."),
backend/app/services/document_diff_service.py:269:        str(data.get("summary") or "").strip(),
backend/app/services/document_diff_service.py:282:    return "\n".join(lines).strip() + "\n"
backend/app/services/document_diff_service.py:302:    return buf.getvalue()
backend/app/services/document_diff_service.py:313:                yield int(ref)
backend/app/services/document_diff_service.py:323:    return citation
backend/app/services/document_diff_service.py:365:            return
backend/app/services/document_diff_service.py:367:            return
backend/app/services/document_diff_service.py:459:                return
backend/app/api/documents.py:94:        return False
backend/app/api/documents.py:100:                    return False
backend/app/api/documents.py:103:                    return False
backend/app/api/documents.py:105:            return False
backend/app/api/documents.py:106:    return True
backend/app/api/documents.py:118:        return []
backend/app/api/documents.py:133:    return [
backend/app/api/documents.py:152:        return cached
backend/app/api/documents.py:174:    return payload
backend/app/api/documents.py:276:            return data
backend/app/api/documents.py:296:    return JSONResponse(
backend/app/api/documents.py:430:        # URL returned a PDF — process through normal PDF pipeline
backend/app/api/documents.py:454:        return JSONResponse(
backend/app/api/documents.py:459:        # URL returned HTML: store a structured Markdown snapshot and process
backend/app/api/documents.py:500:        return JSONResponse(
backend/app/api/documents.py:521:    return resp
backend/app/api/documents.py:545:    return chunk_ids
backend/app/api/documents.py:551:    return {
backend/app/api/documents.py:585:    return hydrated
backend/app/api/documents.py:612:        if doc.summary or doc.suggested_questions:
backend/app/api/documents.py:613:            return DocumentHierarchicalBriefResponse(
backend/app/api/documents.py:616:                summary=doc.summary,
backend/app/api/documents.py:618:                coverage={"status": "legacy_summary"},
backend/app/api/documents.py:620:        return DocumentHierarchicalBriefResponse(
backend/app/api/documents.py:639:    return DocumentHierarchicalBriefResponse(
backend/app/api/documents.py:643:        summary=brief.summary,
backend/app/api/documents.py:688:    return DocumentFileUrlResponse(url=url, expires_in=int(settings.MINIO_PRESIGN_TTL))
backend/app/api/documents.py:747:    # drops page 2. Require COMPLETE, CONSECUTIVE coverage — the returned
backend/app/api/documents.py:800:    return {
backend/app/api/documents.py:847:    return {"status": "reparsing"}
backend/app/api/documents.py:867:    return JSONResponse(status_code=202, content={"status": "deleted"})
backend/app/api/documents.py:910:    return {"status": "updated"}
backend/app/services/extractors/docx_extractor.py:17:        return ''
backend/app/services/extractors/docx_extractor.py:32:    return '\n'.join(lines)
backend/app/services/extractors/docx_extractor.py:117:    return pages
backend/app/api/feedback.py:22:        return None
backend/app/api/feedback.py:24:    return text[:max_len] if text else None
backend/app/api/feedback.py:80:    return FeedbackResponse(id=str(feedback.id))
backend/app/api/events.py:79:        return None
backend/app/api/events.py:82:        return None
backend/app/api/events.py:83:    return text[:max_len]
backend/app/api/events.py:96:    return safe
backend/app/api/events.py:127:    return Response(status_code=204)
backend/app/models/database.py:17:    return url
backend/app/services/layout_translation_service.py:119:        return None
backend/app/services/layout_translation_service.py:129:        return STRUCTURE_LAYOUT_TRANSLATION_FAILURE_MESSAGE
backend/app/services/layout_translation_service.py:130:    return raw
backend/app/services/layout_translation_service.py:138:        return public
backend/app/services/layout_translation_service.py:140:        return TIMEOUT_LAYOUT_TRANSLATION_FAILURE_MESSAGE
backend/app/services/layout_translation_service.py:142:        return GENERIC_LAYOUT_TRANSLATION_FAILURE_MESSAGE
backend/app/services/layout_translation_service.py:143:    return GENERIC_LAYOUT_TRANSLATION_FAILURE_MESSAGE
backend/app/services/layout_translation_service.py:151:    return normalized
backend/app/services/layout_translation_service.py:156:    return SUPPORTED_LAYOUT_TRANSLATION_TARGETS[target]
backend/app/services/layout_translation_service.py:160:    return (plan or "free").lower() in {"plus", "pro"}
backend/app/services/layout_translation_service.py:164:    return max(0, int(settings.FREE_LAYOUT_TRANSLATIONS_LIMIT or 0))
backend/app/services/layout_translation_service.py:170:        return max(0, int(settings.PRO_LAYOUT_TRANSLATION_MAX_PAGES or 0))
backend/app/services/layout_translation_service.py:172:        return max(0, int(settings.PLUS_LAYOUT_TRANSLATION_MAX_PAGES or 0))
backend/app/services/layout_translation_service.py:173:    return max(0, int(settings.FREE_LAYOUT_TRANSLATION_MAX_PAGES or 0))
backend/app/services/layout_translation_service.py:179:        return "plus"
backend/app/services/layout_translation_service.py:181:        return "pro"
backend/app/services/layout_translation_service.py:182:    return None
backend/app/services/layout_translation_service.py:186:    return max(0, int(settings.LAYOUT_TRANSLATION_MAX_FILE_SIZE_MB or 0))
backend/app/services/layout_translation_service.py:191:    return limit_mb * 1024 * 1024 if limit_mb > 0 else 0
backend/app/services/layout_translation_service.py:221:    return settings.RETAINPDF_TRANSLATION_API_KEY or settings.DEEPSEEK_API_KEY
backend/app/services/layout_translation_service.py:225:    return settings.RETAINPDF_DATALAB_TOKEN or settings.DATALAB_API_KEY
backend/app/services/layout_translation_service.py:231:        return engine
backend/app/services/layout_translation_service.py:232:    return "retainpdf"
backend/app/services/layout_translation_service.py:259:    return LayoutTranslationConfigStatus(
backend/app/services/layout_translation_service.py:287:        return f"{self.base_url}{path if path.startswith('/') else f'/{path}'}"
backend/app/services/layout_translation_service.py:294:            raise RetainPdfError(f"RetainPDF returned non-JSON response ({response.status_code})") from exc
backend/app/services/layout_translation_service.py:302:            return data if isinstance(data, dict) else {}
backend/app/services/layout_translation_service.py:303:        return payload if isinstance(payload, dict) else {}
backend/app/services/layout_translation_service.py:316:        return upload_id
backend/app/services/layout_translation_service.py:409:        return job_id
backend/app/services/layout_translation_service.py:414:        return self._data(response)
backend/app/services/layout_translation_service.py:421:        return response.content
backend/app/services/layout_translation_service.py:425:    return datetime.now(timezone.utc)
backend/app/services/layout_translation_service.py:429:    return dict(job.metadata_json or {})
backend/app/services/layout_translation_service.py:446:    return f"layout-translations/{job_id}/{sanitize_filename(filename)}"
backend/app/services/layout_translation_service.py:452:    return RetainPdfArtifact(
backend/app/services/layout_translation_service.py:462:    return value if isinstance(value, dict) else {}
backend/app/services/layout_translation_service.py:467:    return ready is not False
backend/app/services/layout_translation_service.py:485:        return None
backend/app/services/layout_translation_service.py:486:    return _upload_artifact(job, content=content, filename=filename, content_type=content_type)
backend/app/services/layout_translation_service.py:491:    return sanitize_filename(f"{stem}-{target_language}-translated.pdf")
backend/app/services/layout_translation_service.py:503:        return
backend/app/services/layout_translation_service.py:585:            return latest
backend/app/services/layout_translation_service.py:595:            return int(len(pdf))
backend/app/services/layout_translation_service.py:598:        return None
backend/app/services/layout_translation_service.py:716:            return
backend/app/services/layout_translation_service.py:719:            return
backend/app/services/layout_translation_service.py:725:            return
backend/app/api/users.py:52:        return user.stripe_subscription_id
backend/app/api/users.py:54:        return None
backend/app/api/users.py:64:            return sub.get("id")
backend/app/api/users.py:65:    return None
backend/app/api/users.py:70:    return {
backend/app/api/users.py:145:                # Account model has no created_at column; return None for compatibility
backend/app/api/users.py:174:    return {
backend/app/api/users.py:224:    return {
backend/app/api/users.py:257:        return Response(
backend/app/api/users.py:373:    return Response(
backend/app/api/users.py:451:        # If deletion fails, return error
backend/app/api/users.py:459:    return {"deleted": True}
backend/app/services/extractors/url_extractor.py:84:    return b"".join(chunks)
backend/app/services/extractors/url_extractor.py:104:        return f"{hostname}:{port}"
backend/app/services/extractors/url_extractor.py:105:    return hostname
backend/app/services/extractors/url_extractor.py:111:    Uses DNS-pinned connections: validate_and_resolve_url returns a resolved IP
backend/app/services/extractors/url_extractor.py:159:                return current_url, content_type, encoding, body
backend/app/services/extractors/url_extractor.py:166:    return re.sub(r"\n{3,}", "\n\n", text).strip()
backend/app/services/extractors/url_extractor.py:177:            return _clean_text(str(tag["content"]))
backend/app/services/extractors/url_extractor.py:178:    return ""
backend/app/services/extractors/url_extractor.py:191:        return True
backend/app/services/extractors/url_extractor.py:192:    return bool(attrs and BOILERPLATE_RE.search(" ".join(attrs)))
backend/app/services/extractors/url_extractor.py:198:            return False
backend/app/services/extractors/url_extractor.py:200:            return False
backend/app/services/extractors/url_extractor.py:202:            return True
backend/app/services/extractors/url_extractor.py:203:    return False
backend/app/services/extractors/url_extractor.py:208:        return True
backend/app/services/extractors/url_extractor.py:213:        return True
backend/app/services/extractors/url_extractor.py:216:        return True
backend/app/services/extractors/url_extractor.py:219:        return True
backend/app/services/extractors/url_extractor.py:221:    return False
backend/app/services/extractors/url_extractor.py:227:        return ""
backend/app/services/extractors/url_extractor.py:231:        return f"{'#' * level} {text}"
backend/app/services/extractors/url_extractor.py:233:        return f"- {text}"
backend/app/services/extractors/url_extractor.py:235:        return "\n".join(f"> {line}" for line in text.splitlines() if line.strip())
backend/app/services/extractors/url_extractor.py:237:        return f"```\n{text}\n```"
backend/app/services/extractors/url_extractor.py:238:    return text
backend/app/services/extractors/url_extractor.py:244:    return text[:500]
backend/app/services/extractors/url_extractor.py:281:    return blocks
backend/app/services/extractors/url_extractor.py:294:            return
backend/app/services/extractors/url_extractor.py:321:    return pages
backend/app/services/extractors/url_extractor.py:332:        return True
backend/app/services/extractors/url_extractor.py:333:    return False
backend/app/services/extractors/url_extractor.py:341:        - If the URL points to a PDF, returns (filename, [], pdf_bytes)
backend/app/services/extractors/url_extractor.py:342:        - Otherwise returns (title, extracted_pages, None)
backend/app/services/extractors/url_extractor.py:346:    # If URL returns a PDF, signal caller to use PDF pipeline
backend/app/services/extractors/url_extractor.py:352:        return filename, [], response_body
backend/app/services/extractors/url_extractor.py:381:    return title, pages, None
backend/app/api/billing.py:83:    return mapping.get(key, "")
backend/app/api/billing.py:91:        return "plus"
backend/app/api/billing.py:93:        return "pro"
backend/app/api/billing.py:94:    return None
backend/app/api/billing.py:100:        return int(settings.PLAN_PRO_MONTHLY_CREDITS or 0)
backend/app/api/billing.py:102:        return int(settings.PLAN_PLUS_MONTHLY_CREDITS or 0)
backend/app/api/billing.py:103:    return int(settings.PLAN_FREE_MONTHLY_CREDITS or 0)
backend/app/api/billing.py:124:        return "monthly"
backend/app/api/billing.py:126:        return "annual"
backend/app/api/billing.py:127:    return None
backend/app/api/billing.py:132:        return None
backend/app/api/billing.py:134:        return dt.replace(tzinfo=timezone.utc)
backend/app/api/billing.py:135:    return dt.astimezone(timezone.utc)
backend/app/api/billing.py:141:        return True
backend/app/api/billing.py:142:    return datetime.now(timezone.utc) - updated_at >= PENDING_SUBSCRIPTION_TTL
backend/app/api/billing.py:152:    return list(getattr(subs, "data", []) or [])
backend/app/api/billing.py:157:        return None
backend/app/api/billing.py:160:            return sub
backend/app/api/billing.py:161:    return None
backend/app/api/billing.py:190:        return True
backend/app/api/billing.py:201:    return False
backend/app/api/billing.py:206:    return {
backend/app/api/billing.py:248:    return {"checkout_url": session.url}
backend/app/api/billing.py:365:    return {"checkout_url": session.url}
backend/app/api/billing.py:379:            return_url=f"{settings.FRONTEND_URL}/billing",
backend/app/api/billing.py:384:    return {"portal_url": portal.url}
backend/app/api/billing.py:487:    return {
backend/app/api/billing.py:515:    value is returned; if no cache, a degraded `status="none"` response
backend/app/api/billing.py:524:        return {
backend/app/api/billing.py:534:        return {
backend/app/api/billing.py:545:        return {
backend/app/api/billing.py:557:        return cached
backend/app/api/billing.py:615:        return state
backend/app/api/billing.py:618:    return state
backend/app/api/billing.py:636:    return {
backend/app/api/billing.py:672:        return None
backend/app/api/billing.py:678:        return None
backend/app/api/billing.py:679:    return dt.isoformat() if dt else None
backend/app/api/billing.py:690:        return direct
backend/app/api/billing.py:693:        return None
backend/app/api/billing.py:694:    return items[0].get("current_period_end")
backend/app/api/billing.py:699:        return {
backend/app/api/billing.py:705:    return {
backend/app/api/billing.py:779:            return {
backend/app/api/billing.py:814:            return {
backend/app/api/billing.py:902:            return {
backend/app/api/billing.py:943:    return {
backend/app/api/billing.py:959:            return {"received": True}
backend/app/api/billing.py:963:        return {"received": True}
backend/app/api/billing.py:968:        return {"received": True}
backend/app/api/billing.py:994:        return {"received": True}
backend/app/api/billing.py:1051:    return {"received": True}
backend/app/api/billing.py:1063:            return {"received": True}
backend/app/api/billing.py:1067:        return {"received": True}
backend/app/api/billing.py:1075:            return {"received": True}
backend/app/api/billing.py:1079:            return {"received": True}
backend/app/api/billing.py:1082:        return {"received": True}
backend/app/api/billing.py:1088:        return {"received": True}
backend/app/api/billing.py:1094:        return {"received": True}
backend/app/api/billing.py:1140:    return {"received": True}
backend/app/api/billing.py:1149:        return await _handle_checkout_session_subscription_completed(session, db)
backend/app/api/billing.py:1151:        return await _handle_checkout_session_payment_completed(session, db)
backend/app/api/billing.py:1152:    return {"received": True}
backend/app/api/billing.py:1162:        return {"received": True}
backend/app/api/billing.py:1167:        return {"received": True}
backend/app/api/billing.py:1227:    return {"received": True}
backend/app/api/billing.py:1236:        return {"received": True}
backend/app/api/billing.py:1240:        return {"received": True}
backend/app/api/billing.py:1254:        return {"received": True}
backend/app/api/billing.py:1273:        return {"received": True}
backend/app/api/billing.py:1276:        return {"received": True}
backend/app/api/billing.py:1285:    return {"received": True}
backend/app/api/billing.py:1295:            return {"received": True}
backend/app/api/billing.py:1298:        return {"received": True}
backend/app/api/billing.py:1302:        return {"received": True}
backend/app/api/billing.py:1309:        return {"received": True}
backend/app/api/billing.py:1315:    return {"received": True}
backend/app/api/billing.py:1325:        return {"received": True}
backend/app/api/billing.py:1328:        return {"received": True}
backend/app/api/billing.py:1331:        return {"received": True}
backend/app/api/billing.py:1334:        return {"received": True}
backend/app/api/billing.py:1336:        return {"received": True}
backend/app/api/billing.py:1340:        return {"received": True}
backend/app/api/billing.py:1389:    return {"received": True}
backend/app/api/billing.py:1403:    return {"received": True}
backend/app/api/billing.py:1436:        return {"received": True}
backend/app/api/billing.py:1442:        return {"received": True}
backend/app/api/billing.py:1445:        return await handler(obj, db, event)
backend/app/api/billing.py:1446:    return await handler(obj, db)
backend/app/services/citation_focus_service.py:8:Conservative by design: return ``None`` (caller keeps the whole-chunk
backend/app/services/citation_focus_service.py:49:    return feats
backend/app/services/citation_focus_service.py:53:    return set(_NUMERIC_RE.findall(text))
backend/app/services/citation_focus_service.py:57:    return [s for s in (seg.strip() for seg in _SENT_SPLIT_RE.split(text)) if s]
backend/app/services/citation_focus_service.py:66:    return segs[-1] if segs else ""
backend/app/services/citation_focus_service.py:80:        return None
backend/app/services/citation_focus_service.py:83:        return None
backend/app/services/citation_focus_service.py:86:        return None
backend/app/services/citation_focus_service.py:96:        return None
backend/app/services/citation_focus_service.py:98:        return None  # ambiguous — don't guess
backend/app/services/citation_focus_service.py:105:        return None
backend/app/services/citation_focus_service.py:110:        return None
backend/app/services/citation_focus_service.py:111:    return best
backend/app/api/extractions.py:49:    domain_mode: Literal["legal", "academic"] | None = None
backend/app/api/extractions.py:78:        return None
backend/app/api/extractions.py:80:        return dt.replace(tzinfo=timezone.utc)
backend/app/api/extractions.py:81:    return dt.astimezone(timezone.utc)
backend/app/api/extractions.py:90:    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quote(clean, safe='')}"
backend/app/api/extractions.py:96:    return job.__dict__.get("extraction_result")
backend/app/api/extractions.py:110:    return ExtractionJobResponse(
backend/app/api/extractions.py:134:    return doc
backend/app/api/extractions.py:139:        return
backend/app/api/extractions.py:166:    return list_templates()
backend/app/api/extractions.py:187:    # P1 hygiene follow-up (2026-08-03): domain_mode ("legal"/"academic")
backend/app/api/extractions.py:194:    if body.domain_mode is not None:
backend/app/api/extractions.py:224:            "domain_mode": body.domain_mode,
backend/app/api/extractions.py:289:    return _job_response(job)
backend/app/api/extractions.py:308:    return [_job_response(job) for job in rows.scalars()]
backend/app/api/extractions.py:330:    return _job_response(job)
backend/app/api/extractions.py:357:        return StreamingResponse(
backend/app/api/extractions.py:363:    return StreamingResponse(
backend/app/services/conversion_service.py:63:        if result.returncode != 0:
backend/app/services/conversion_service.py:66:                f"LibreOffice conversion failed (exit {result.returncode}): {stderr}"
backend/app/services/conversion_service.py:75:            return f.read()
backend/app/api/sharing.py:61:        return ShareResponse(
backend/app/api/sharing.py:97:    return ShareResponse(
backend/app/api/sharing.py:206:    return SharedSessionView(
backend/app/api/document_diffs.py:73:    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quote(clean, safe='')}"
backend/app/api/document_diffs.py:79:    return job.__dict__.get("extraction_result")
backend/app/api/document_diffs.py:93:    return DocumentDiffRunResponse(
backend/app/api/document_diffs.py:112:        return
backend/app/api/document_diffs.py:135:    return doc
backend/app/api/document_diffs.py:151:    return collection
backend/app/api/document_diffs.py:255:    return job
backend/app/api/document_diffs.py:289:    return _run_response(job)
backend/app/api/document_diffs.py:310:    return [_run_response(job) for job in rows.scalars()]
backend/app/api/document_diffs.py:332:    return _run_response(job)
backend/app/api/document_diffs.py:359:        return StreamingResponse(
backend/app/api/document_diffs.py:364:    return StreamingResponse(
backend/app/api/auth.py:48:    return user
backend/app/api/auth.py:57:    return await auth_service.get_user_by_id(db, user_id)
backend/app/api/auth.py:66:    return await auth_service.get_user_by_email(db, email)
backend/app/api/auth.py:76:    return await auth_service.get_user_by_account(db, provider, provider_account_id)
backend/app/api/auth.py:89:    return await auth_service.update_user(db, user, **data.model_dump(exclude_unset=True))
backend/app/api/auth.py:111:    return await auth_service.link_account(
backend/app/api/auth.py:143:    return {"identifier": data.identifier, "token": data.token, "expires": data.expires}
backend/app/api/auth.py:154:        return None
backend/app/api/auth.py:155:    return {"identifier": vt.identifier, "token": data.token, "expires": vt.expires}
backend/app/services/extractors/text_extractor.py:16:        return [ExtractedPage(page_number=1, text='(empty file)')]
backend/app/services/extractors/text_extractor.py:62:    return pages
backend/app/api/chunks.py:59:    return {
backend/app/api/credits.py:45:    return {
backend/app/api/credits.py:86:    return {
backend/app/api/document_jobs.py:28:    summary: str
backend/app/api/document_jobs.py:54:    return job.__dict__.get("extraction_result")
backend/app/api/document_jobs.py:71:    return payload
backend/app/api/document_jobs.py:122:            summary = f"Layout-preserved PDF translation to {target} is ready."
backend/app/api/document_jobs.py:124:            summary = error_message or "Layout-preserving translation failed."
backend/app/api/document_jobs.py:126:            summary = f"Translating this PDF to {target} while preserving layout."
backend/app/api/document_jobs.py:127:        return DocumentJobArtifactResponse(
backend/app/api/document_jobs.py:132:            summary=summary,
backend/app/api/document_jobs.py:162:        summary = f"{len(tables)} table(s) detected."
backend/app/api/document_jobs.py:164:            summary = f"{summary} Provider: {provider}."
backend/app/api/document_jobs.py:166:            summary = "Scanning document tables."
backend/app/api/document_jobs.py:167:        return DocumentJobArtifactResponse(
backend/app/api/document_jobs.py:172:            summary=summary,
backend/app/api/document_jobs.py:205:    return DocumentJobArtifactResponse(
backend/app/api/document_jobs.py:210:        summary=job.error_message or ("Ready." if job.status == "succeeded" else "Working..."),
backend/app/api/document_jobs.py:236:    return DocumentJobDetailResponse(
backend/app/models/sync_database.py:25:        return url.replace("+asyncpg", "+psycopg")
backend/app/models/sync_database.py:26:    return url
backend/app/services/extractors/xlsx_extractor.py:60:    return pages
backend/app/api/layout_translations.py:69:    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quote(clean, safe='')}"
backend/app/api/layout_translations.py:74:        return value.isoformat()
backend/app/api/layout_translations.py:75:    return datetime.now(timezone.utc).isoformat()
backend/app/api/layout_translations.py:80:    return DocumentJobDetailResponse(
backend/app/api/layout_translations.py:123:    return doc
backend/app/api/layout_translations.py:140:            return job
backend/app/api/layout_translations.py:141:    return None
backend/app/api/layout_translations.py:152:    return int(used or 0)
backend/app/api/layout_translations.py:156:    return {
backend/app/api/layout_translations.py:272:        return await _job_response(existing, db, user)
backend/app/api/layout_translations.py:378:    return await _job_response(job, db, user)
backend/app/api/layout_translations.py:388:    return sanitize_filename(f"{stem}.pdf")
backend/app/api/layout_translations.py:395:        return None
backend/app/api/layout_translations.py:399:        return None
backend/app/api/layout_translations.py:402:        return None
backend/app/api/layout_translations.py:403:    return ImportLayoutTranslationResponse(
backend/app/api/layout_translations.py:442:        return existing
backend/app/api/layout_translations.py:477:            return self._data
backend/app/api/layout_translations.py:510:    return ImportLayoutTranslationResponse(
backend/app/api/layout_translations.py:549:    return StreamingResponse(
backend/app/api/quotes.py:95:    return doc
backend/app/api/quotes.py:116:        .returning(CreditLedger.id)
backend/app/api/quotes.py:130:    return refunded
backend/app/api/quotes.py:164:            return await _refund_predebit(settle_db, user_id, pre_debited, ledger_id)
backend/app/api/quotes.py:166:    return await _refund_predebit(db, user_id, pre_debited, ledger_id)
backend/app/api/quotes.py:192:    # credit_service calls of its own. It returns .usage/.model precisely so
backend/app/api/quotes.py:360:    return QuoteSearchResponse(
backend/app/api/quotes.py:408:    return BiblioResponse(csl_json=row.csl_json, source=row.source)
backend/app/api/quotes.py:427:    return BiblioResponse(csl_json=row.csl_json, source=row.source)
backend/app/api/quotes.py:491:    return SavedQuoteResponse(
backend/app/api/quotes.py:509:    return SavedQuoteBoardResponse(
backend/app/api/quotes.py:619:        # "Idempotent save returns the existing row (200 not 409)" — the
backend/app/api/quotes.py:626:    return _saved_quote_response(row)
backend/app/api/quotes.py:635:    """M3-B3 (plan §8.1/§8.5): returns each row's STORED trust snapshot
backend/app/api/quotes.py:648:    return SavedQuoteListResponse(quotes=[_saved_quote_response(r) for r in rows])
backend/app/api/quotes.py:664:    return SavedQuoteBoardListResponse(quotes=[_saved_quote_board_response(r) for r in rows])
backend/app/api/quotes.py:685:    return _saved_quote_response(row)
backend/app/api/tables.py:65:    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quote(clean, safe='')}"
backend/app/api/tables.py:69:    return DocumentJobResponse(
backend/app/api/tables.py:95:    return DocumentTableResponse(
backend/app/api/tables.py:118:    return doc
backend/app/api/tables.py:146:        return _job_response(existing)
backend/app/api/tables.py:184:    return _job_response(job)
backend/app/api/tables.py:227:        return _job_response(existing)
backend/app/api/tables.py:268:    return _job_response(job)
backend/app/api/tables.py:283:    return [_table_response(table) for table in rows.scalars()]
backend/app/api/tables.py:314:    return StreamingResponse(
backend/app/api/tables.py:338:    return _job_response(job)
backend/app/api/tables.py:362:    return StreamingResponse(
backend/app/api/search.py:34:    return merged
backend/app/api/search.py:79:    return SearchResponse(results=[SearchResultItem(**r) for r in results])
backend/app/schemas/document.py:29:    summary: Optional[str] = None
backend/app/schemas/document.py:57:    summary: str = ""
backend/app/schemas/document.py:77:    summary: Optional[str] = None
backend/app/core/url_validator.py:41:        return True  # unparseable = blocked
backend/app/core/url_validator.py:49:            return True
backend/app/core/url_validator.py:50:    return False
backend/app/core/url_validator.py:100:    return url, addrinfos[0][4][0]
backend/app/core/url_validator.py:110:    return validated_url
backend/app/api/question_templates.py:91:    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quote(clean, safe='')}"
backend/app/api/question_templates.py:95:    return QuestionTemplatePayload(
backend/app/api/question_templates.py:108:    return job.__dict__.get("extraction_result")
backend/app/api/question_templates.py:122:    return QuestionTemplateRunResponse(
backend/app/api/question_templates.py:142:        return
backend/app/api/question_templates.py:155:        return None
backend/app/api/question_templates.py:157:    return text or None
backend/app/api/question_templates.py:167:    return template
backend/app/api/question_templates.py:188:    return doc
backend/app/api/question_templates.py:211:        return collection
backend/app/api/question_templates.py:232:    return collection
backend/app/api/question_templates.py:333:    return job
backend/app/api/question_templates.py:352:    return [_template_response(template) for template in rows.scalars()]
backend/app/api/question_templates.py:376:    return _template_response(template)
backend/app/api/question_templates.py:399:    return _template_response(template)
backend/app/api/question_templates.py:411:    return Response(status_code=status.HTTP_204_NO_CONTENT)
backend/app/api/question_templates.py:436:    return _run_response(job)
backend/app/api/question_templates.py:455:    return [_run_response(job) for job in rows.scalars()]
backend/app/api/question_templates.py:481:    return _run_response(job)
backend/app/api/question_templates.py:500:    return [_run_response(job) for job in rows.scalars()]
backend/app/api/question_templates.py:522:    return _run_response(job)
backend/app/api/question_templates.py:549:        return StreamingResponse(
backend/app/api/question_templates.py:554:    return StreamingResponse(
backend/app/api/collections.py:98:    return [
backend/app/api/collections.py:164:    return {
backend/app/api/collections.py:196:    return CollectionDetail(
backend/app/api/collections.py:218:    return None
backend/app/api/collections.py:294:    return {"added": added}
backend/app/api/collections.py:316:    return None
backend/app/api/collections.py:334:    return {
backend/app/api/collections.py:363:            ChatSession.domain_mode,
backend/app/api/collections.py:370:        .group_by(ChatSession.id, ChatSession.title, ChatSession.domain_mode, ChatSession.created_at)
backend/app/api/collections.py:376:    return {
backend/app/api/collections.py:382:                "domain_mode": row.domain_mode,
backend/app/schemas/admin.py:214:    summary: AdminUserActivitySummary
backend/app/schemas/admin.py:241:    returned_users: int
backend/app/api/admin.py:150:        return None
backend/app/api/admin.py:153:        return None
backend/app/api/admin.py:154:    return text_value[:1].upper() + text_value[1:]
backend/app/api/admin.py:158:    return PAID_SIGNAL_LABELS.get(str(event_name or ""), _humanize_code(event_name) or "Paid signal")
backend/app/api/admin.py:182:    return " ".join(pieces) or _paid_signal_label(event_name)
backend/app/api/admin.py:187:    return {
backend/app/api/admin.py:200:    return round(float(numerator) / float(denominator), 4) if denominator else 0.0
backend/app/api/admin.py:205:    return {
backend/app/api/admin.py:215:        return str(value.date())
backend/app/api/admin.py:216:    return str(value)[:10]
backend/app/api/admin.py:221:        return row.get(key, default)
backend/app/api/admin.py:222:    return getattr(row, key, default)
backend/app/api/admin.py:227:        return value.date()
backend/app/api/admin.py:229:        return value
backend/app/api/admin.py:230:    return datetime.fromisoformat(str(value)[:10]).date()
backend/app/api/admin.py:235:    return day - timedelta(days=day.weekday())
backend/app/api/admin.py:239:    return func.date_trunc("day", column.op("AT TIME ZONE")("UTC"))
backend/app/api/admin.py:244:        return {email.strip().lower() for email in admin_emails if email and email.strip()}
backend/app/api/admin.py:245:    return {email.strip().lower() for email in settings.ADMIN_EMAILS.split(",") if email.strip()}
backend/app/api/admin.py:250:        return {str(user_id) for user_id in excluded_user_ids if user_id}
backend/app/api/admin.py:251:    return set(INTERNAL_OWNER_USER_IDS)
backend/app/api/admin.py:261:    return conditions
backend/app/api/admin.py:267:    return str(user_id) in excluded_user_ids or (isinstance(email, str) and email.lower() in admin_emails)
backend/app/api/admin.py:277:    return {
backend/app/api/admin.py:287:        return "unknown"
backend/app/api/admin.py:290:        return "large"
backend/app/api/admin.py:292:        return "mid"
backend/app/api/admin.py:293:    return "small"
backend/app/api/admin.py:297:    return {
backend/app/api/admin.py:325:    return [
backend/app/api/admin.py:343:    return active
backend/app/api/admin.py:412:        returned_users = 0
backend/app/api/admin.py:423:                returned_users += 1
backend/app/api/admin.py:429:            "returned_users": returned_users,
backend/app/api/admin.py:430:            "pct": _rate(returned_users, len(matured_active_dates)),
backend/app/api/admin.py:522:    return {
backend/app/api/admin.py:543:    return labels.get(key, _humanize_code(key) or key)
backend/app/api/admin.py:548:        return set()
backend/app/api/admin.py:549:    return {str(value) for value in values if str(value) in eligible_user_ids}
backend/app/api/admin.py:555:    return {
backend/app/api/admin.py:568:    return [
backend/app/api/admin.py:583:    return {
backend/app/api/admin.py:595:    return _citations_empty(_row_value(row, "citations")) or bool(RAG_MISS_RE.search(content))
backend/app/api/admin.py:617:        return (str(_row_value(row, "session_id") or ""), created_at)
backend/app/api/admin.py:661:    return signal_users, final_candidates
backend/app/api/admin.py:777:    return {
backend/app/api/admin.py:791:    return citations in (None, {}, [], "{}", "[]", "null")
backend/app/api/admin.py:796:        return False
backend/app/api/admin.py:799:        return True
backend/app/api/admin.py:801:    return isinstance(artifacts, list) and len(artifacts) > 0
backend/app/api/admin.py:839:    return union_all(usage_q, message_q, document_q, event_q, feedback_q).subquery()
backend/app/api/admin.py:845:        return "missing"
backend/app/api/admin.py:847:        return "live"
backend/app/api/admin.py:849:        return "test"
backend/app/api/admin.py:850:    return "unknown"
backend/app/api/admin.py:855:        return None
backend/app/api/admin.py:857:        return price_id[:6] + "..."
backend/app/api/admin.py:858:    return f"{price_id[:8]}...{price_id[-6:]}"
backend/app/api/admin.py:873:        return payload
backend/app/api/admin.py:887:    return payload
backend/app/api/admin.py:890:@router.get("/overview", response_model=AdminOverviewResponse)
backend/app/api/admin.py:891:async def admin_overview(
backend/app/api/admin.py:896:    cache_key = "admin:overview"
backend/app/api/admin.py:899:        return cached
backend/app/api/admin.py:951:    return payload
backend/app/api/admin.py:1027:    return {
backend/app/api/admin.py:1082:    return {
backend/app/api/admin.py:1108:        return int(value or 0)
backend/app/api/admin.py:1226:        return series_map[label]
backend/app/api/admin.py:1552:        return [{"key": row.key or "unknown", "count": int(row.count or 0), "users": None} for row in rows]
backend/app/api/admin.py:1582:    return {
backend/app/api/admin.py:1587:        "summary": {
backend/app/api/admin.py:1712:    return _build_retention_payload(
backend/app/api/admin.py:1946:    return _build_churn_payload(
backend/app/api/admin.py:1985:    return {
backend/app/api/admin.py:2099:    return {
backend/app/api/admin.py:2113:        return float(value)
backend/app/api/admin.py:2115:        return float(str(value))
backend/app/api/admin.py:2117:        return 0.0
backend/app/api/admin.py:2155:    "document_summary": "Whole-document summary",
backend/app/api/admin.py:2156:    "section_summary": "Section summary",
backend/app/api/admin.py:2157:    "summary": "Summary question",
backend/app/api/admin.py:2172:    "document_summary_context": "Whole-document summary context",
backend/app/api/admin.py:2173:    "collection_summary_context": "Multi-document summary context",
backend/app/api/admin.py:2182:    "document_summary_context": "The system selected representative sections for a broad document summary.",
backend/app/api/admin.py:2183:    "collection_summary_context": "The system selected representative sections across multiple documents.",
backend/app/api/admin.py:2189:    return RAG_STATUS_LABELS.get(str(status or "unknown").lower(), "Not classified")
backend/app/api/admin.py:2193:    return RAG_ROUTE_LABELS.get(str(route or "unknown"), _humanize_code(route) or "Unknown question type")
backend/app/api/admin.py:2197:    return RAG_STRATEGY_LABELS.get(str(strategy or "unknown"), _humanize_code(strategy) or "Unknown retrieval path")
backend/app/api/admin.py:2201:    return RAG_STRATEGY_DESCRIPTIONS.get(str(strategy or ""), "The retrieval path is not classified yet.")
backend/app/api/admin.py:2215:        return None
backend/app/api/admin.py:2216:    return {
backend/app/api/admin.py:2332:    return {
backend/app/api/admin.py:2414:    return {
backend/app/api/admin.py:2490:    return {
backend/app/services/table_service.py:83:        return []
backend/app/services/table_service.py:85:    return [row + [""] * (width - len(row)) for row in rows]
backend/app/services/table_service.py:92:    return buf.getvalue()
backend/app/services/table_service.py:96:    return model in settings.DEEPSEEK_OFFICIAL_MODELS
backend/app/services/table_service.py:103:        return OpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)
backend/app/services/table_service.py:106:    return OpenAI(api_key=settings.OPENROUTER_API_KEY, base_url=settings.OPENROUTER_BASE_URL)
backend/app/services/table_service.py:129:    return data
backend/app/services/table_service.py:153:    return tables
backend/app/services/table_service.py:158:        return False
backend/app/services/table_service.py:160:    return len(separator_cells) >= 2 and all(re.fullmatch(r":?-{3,}:?", cell.strip() or "") for cell in separator_cells)
backend/app/services/table_service.py:165:    return [cell.strip() for cell in clean.split("|")]
backend/app/services/table_service.py:206:        return results
backend/app/services/table_service.py:226:    return results
backend/app/services/table_service.py:242:    return run
backend/app/services/table_service.py:247:        return None
backend/app/services/table_service.py:255:        return storage_key
backend/app/services/table_service.py:258:        return None
backend/app/services/table_service.py:285:        return detected, TableScanOutcome(count=len(detected), provider="pymupdf")
backend/app/services/table_service.py:299:        return result.tables, TableScanOutcome(
backend/app/services/table_service.py:318:        return detected, TableScanOutcome(
backend/app/services/table_service.py:329:        return set()
backend/app/services/table_service.py:330:    return {cell.strip().lower() for cell in rows[0] if cell and cell.strip()}
backend/app/services/table_service.py:337:        return 0.0
backend/app/services/table_service.py:338:    return len(left_header & right_header) / max(len(left_header), len(right_header))
backend/app/services/table_service.py:345:        return region["bbox"]
backend/app/services/table_service.py:346:    return None
backend/app/services/table_service.py:353:        return False
backend/app/services/table_service.py:358:        return False
backend/app/services/table_service.py:359:    return previous_bottom >= 8.0 and current_top <= 2.0
backend/app/services/table_service.py:364:        return tables
backend/app/services/table_service.py:392:    return merged
backend/app/services/table_service.py:408:    return payload
backend/app/services/table_service.py:417:        return text, False
backend/app/services/table_service.py:418:    return text[:max_chars].rstrip() + "\n...", True
backend/app/services/table_service.py:424:        return clean
backend/app/services/table_service.py:425:    return clean[:max_chars].rstrip() + "\n..."
backend/app/services/table_service.py:430:        return "(no parser draft rows)"
backend/app/services/table_service.py:434:    return _clip_text("\n".join(lines), max_chars)
backend/app/services/table_service.py:456:    return page, max(page, page_end)
backend/app/services/table_service.py:461:        return ""
backend/app/services/table_service.py:481:        return _clip_text("\n\n".join(parts), MAX_TABLE_CONTEXT_CHARS // 2)
backend/app/services/table_service.py:517:    return _clip_text("\n\n".join(parts), MAX_TABLE_CONTEXT_CHARS)
backend/app/services/table_service.py:521:    return json.dumps(
backend/app/services/table_service.py:573:        return _json_from_text(content), prompt_tokens, completion_tokens, model
backend/app/services/table_service.py:591:        return _json_from_text(repaired_content), prompt_tokens, completion_tokens, model
backend/app/services/table_service.py:599:    return max(0.0, min(1.0, number))
backend/app/services/table_service.py:604:        return []
backend/app/services/table_service.py:610:    return warnings
backend/app/services/table_service.py:617:    return re.sub(r"[^0-9A-Za-z.\-]", "", token or "").lower()
backend/app/services/table_service.py:630:    return tokens
backend/app/services/table_service.py:639:    return missing
backend/app/services/table_service.py:663:    return TableReconstructionOutcome(
backend/app/services/table_service.py:676:        return {}
backend/app/services/table_service.py:677:    return {
backend/app/services/table_service.py:710:        return
backend/app/services/table_service.py:782:    return TableScanOutcome(
backend/app/services/table_service.py:793:    return scan_document_tables_with_outcome(db, document).count
backend/app/services/table_service.py:835:    return outcome
backend/app/services/table_service.py:845:            return
backend/app/services/table_service.py:874:                return
backend/app/services/table_service.py:893:            return
backend/app/services/table_service.py:931:                return
backend/app/core/rate_limit.py:45:        return
backend/app/core/rate_limit.py:49:        return
backend/app/core/rate_limit.py:81:            return False
backend/app/core/rate_limit.py:83:        return True
backend/app/core/rate_limit.py:93:        return self._counts.get(key, 0)
backend/app/core/rate_limit.py:111:            return self._redis_client
backend/app/core/rate_limit.py:113:            return None
backend/app/core/rate_limit.py:117:            return self._redis_client
backend/app/core/rate_limit.py:127:            return None
backend/app/core/rate_limit.py:152:            return self._fallback.is_allowed(key)
backend/app/core/rate_limit.py:161:                return False
backend/app/core/rate_limit.py:162:            return True
backend/app/core/rate_limit.py:165:            return self._fallback.is_allowed(key)
backend/app/core/rate_limit.py:179:            return self._fallback.get_count(key)
backend/app/core/rate_limit.py:184:            return int(value or 0)
backend/app/core/rate_limit.py:187:            return self._fallback.get_count(key)
backend/app/core/rate_limit.py:193:            return
backend/app/core/rate_limit.py:213:                return False, current
backend/app/core/rate_limit.py:215:            return True, current + 1
backend/app/core/rate_limit.py:224:                return False, limit
backend/app/core/rate_limit.py:225:            return True, int(count)
backend/app/core/rate_limit.py:230:                return False, current
backend/app/core/rate_limit.py:232:            return True, current + 1
backend/app/core/rate_limit.py:288:        return False, "missing_headers"
backend/app/core/rate_limit.py:290:        return False, "no_adapter_secret"
backend/app/core/rate_limit.py:294:        return False, "malformed_ts"
backend/app/core/rate_limit.py:298:        return False, "skew_exceeded"
backend/app/core/rate_limit.py:305:        return False, "bad_signature"
backend/app/core/rate_limit.py:306:    return True, None
backend/app/core/rate_limit.py:327:            return new_ip.strip()  # type: ignore[union-attr]
backend/app/core/rate_limit.py:345:    return request.client.host if request.client else "unknown"
backend/app/services/document_intelligence.py:44:            return obj[name]
backend/app/services/document_intelligence.py:46:            return getattr(obj, name)
backend/app/services/document_intelligence.py:47:    return default
backend/app/services/document_intelligence.py:52:        return value
backend/app/services/document_intelligence.py:54:        return {str(key): json_safe(item) for key, item in value.items()}
backend/app/services/document_intelligence.py:56:        return [json_safe(item) for item in value]
backend/app/services/document_intelligence.py:59:            return json_safe(value.as_dict())
backend/app/services/document_intelligence.py:64:            return json_safe(value.to_dict())
backend/app/services/document_intelligence.py:67:    return str(value)
backend/app/services/document_intelligence.py:73:        return int(value)
backend/app/services/document_intelligence.py:75:        return default
backend/app/services/document_intelligence.py:81:        return float(value)
backend/app/services/document_intelligence.py:83:        return None
backend/app/services/document_intelligence.py:89:        return []
backend/app/services/document_intelligence.py:90:    return list(regions)
backend/app/services/document_intelligence.py:96:            return float(point["x"]), float(point["y"])
backend/app/services/document_intelligence.py:97:        return None
backend/app/services/document_intelligence.py:99:        return float(point.x), float(point.y)
backend/app/services/document_intelligence.py:100:    return None
backend/app/services/document_intelligence.py:105:        return []
backend/app/services/document_intelligence.py:108:        return list(zip(values[0::2], values[1::2]))
backend/app/services/document_intelligence.py:114:    return points
backend/app/services/document_intelligence.py:135:    return payload if payload.get("page") or payload.get("bbox") else None
backend/app/services/document_intelligence.py:142:            return payload
backend/app/services/document_intelligence.py:143:    return None
backend/app/services/document_intelligence.py:149:        return int(region["page"])
backend/app/services/document_intelligence.py:153:            return int(cell_region["page"])
backend/app/services/document_intelligence.py:154:    return 1
backend/app/services/document_intelligence.py:163:        return 0.9
backend/app/services/document_intelligence.py:164:    return max(0.0, min(1.0, sum(confidences) / len(confidences)))
backend/app/services/document_intelligence.py:179:        return []
backend/app/services/document_intelligence.py:181:    return [row + [""] * (width - len(row)) for row in rows]
backend/app/services/document_intelligence.py:272:    return extracted
backend/app/services/document_intelligence.py:318:        return LayoutAnalysisResult(
backend/app/services/document_intelligence.py:329:        return AzureDocumentIntelligenceProvider()
backend/app/services/document_intelligence.py:331:        return None
backend/app/services/document_intelligence.py:333:    return None
backend/app/api/chat.py:59:    return f"{client_ip}:{document_id}"
backend/app/api/chat.py:71:    return [
backend/app/api/chat.py:96:        return None
backend/app/api/chat.py:98:        return dt.replace(tzinfo=timezone.utc)
backend/app/api/chat.py:99:    return dt.astimezone(timezone.utc)
backend/app/api/chat.py:102:def _chat_strict_quote_routed(session: ChatSession, message: str) -> bool:
backend/app/api/chat.py:105:    predicate as chat_service._is_strict_quote_routed (auth is guaranteed
backend/app/api/chat.py:113:    return (
backend/app/api/chat.py:124:        return
backend/app/api/chat.py:129:        return
backend/app/api/chat.py:138:        return
backend/app/api/chat.py:180:        return None
backend/app/api/chat.py:186:            return session if session.user_id is None else None
backend/app/api/chat.py:188:        return session if session.user_id == user.id else None
backend/app/api/chat.py:192:        return None
backend/app/api/chat.py:198:            return None
backend/app/api/chat.py:200:            return None
backend/app/api/chat.py:202:    return session
backend/app/api/chat.py:213:        return None
backend/app/api/chat.py:215:    return doc if can_access_document(doc, user) else None
backend/app/api/chat.py:319:        return JSONResponse(
backend/app/api/chat.py:324:    return response
backend/app/api/chat.py:364:    return SessionMessagesResponse(messages=items, demo_messages_used=demo_messages_used)
backend/app/api/chat.py:391:    # P1 hygiene (top-down review, 2026-08-01): domain_mode ("legal"/
backend/app/api/chat.py:396:    # POST {"domain_mode": "legal"} and get the paid prompt behavior.
backend/app/api/chat.py:399:    if body.domain_mode is not None:
backend/app/api/chat.py:469:        strict_quote_routed = _chat_strict_quote_routed(session, body.message)
backend/app/api/chat.py:471:            "balanced" if strict_quote_routed else effective_mode
backend/app/api/chat.py:488:            domain_mode=body.domain_mode
backend/app/api/chat.py:494:            yield line + data_line
backend/app/api/chat.py:496:    return StreamingResponse(
backend/app/api/chat.py:629:            yield line + data_line
backend/app/api/chat.py:631:    return StreamingResponse(
backend/app/api/chat.py:659:            return SessionListResponse(sessions=[])
backend/app/api/chat.py:670:            ChatSession.domain_mode,
backend/app/api/chat.py:678:        .group_by(ChatSession.id, ChatSession.title, ChatSession.domain_mode, ChatSession.created_at)
backend/app/api/chat.py:690:            domain_mode=getattr(row, 'domain_mode', None),
backend/app/api/chat.py:696:    return SessionListResponse(sessions=sessions)
backend/app/api/chat.py:712:    return None  # 204
backend/app/services/summary_service.py:39:  "summary": "One concise paragraph explaining what the document is and why it matters.",
backend/app/services/summary_service.py:41:    {{"title": "Section or theme", "level": 1, "summary": "What this section/theme covers.", "source_refs": [1]}}
backend/app/services/summary_service.py:55:- summary: 1 paragraph.
backend/app/services/summary_service.py:69:    return model in settings.DEEPSEEK_OFFICIAL_MODELS
backend/app/services/summary_service.py:75:            return None
backend/app/services/summary_service.py:76:        return OpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)
backend/app/services/summary_service.py:78:        return None
backend/app/services/summary_service.py:79:    return OpenAI(api_key=settings.OPENROUTER_API_KEY, base_url=settings.OPENROUTER_BASE_URL)
backend/app/services/summary_service.py:101:    return data
backend/app/services/summary_service.py:106:    return text[:limit]
backend/app/services/summary_service.py:110:    return {
backend/app/services/summary_service.py:122:                return _ref_number(value.get(key))
backend/app/services/summary_service.py:123:        return None
backend/app/services/summary_service.py:125:        return int(value)
backend/app/services/summary_service.py:127:        return None
backend/app/services/summary_service.py:132:        return []
backend/app/services/summary_service.py:147:        return refs[:4]
backend/app/services/summary_service.py:148:    return []
backend/app/services/summary_service.py:160:    return ranges
backend/app/services/summary_service.py:180:                "summary": _str(item.get("summary"), limit=800),
backend/app/services/summary_service.py:184:    return normalized
backend/app/services/summary_service.py:229:    return {
backend/app/services/summary_service.py:230:        "summary": _str(raw.get("summary"), limit=2400),
backend/app/services/summary_service.py:254:    return "\n\n".join(parts)
backend/app/services/summary_service.py:258:    return db.execute(
backend/app/services/summary_service.py:273:    brief.summary = payload.get("summary") or None
backend/app/services/summary_service.py:283:    doc.summary = brief.summary
backend/app/services/summary_service.py:322:        return False
backend/app/services/summary_service.py:329:    return current_ids == set(selected_ids)
backend/app/services/summary_service.py:338:            return
backend/app/services/summary_service.py:350:            return
backend/app/services/summary_service.py:368:            return
backend/app/services/summary_service.py:380:            return
backend/app/services/summary_service.py:404:                return
backend/app/services/summary_service.py:428:def generate_summary_sync(document_id: str) -> None:
backend/app/core/cache.py:28:        return _redis_client
backend/app/core/cache.py:32:        return None
backend/app/core/cache.py:37:        return _redis_client
backend/app/core/cache.py:47:        return None
backend/app/core/cache.py:67:        return None
backend/app/core/cache.py:72:            return None
backend/app/core/cache.py:73:        return json.loads(raw)
backend/app/core/cache.py:76:        return None
backend/app/core/cache.py:82:        return
backend/app/core/cache.py:94:        return
backend/app/core/cache.py:105:        return 0
backend/app/core/cache.py:111:        return deleted
backend/app/core/cache.py:114:        return 0
backend/app/workers/brief_worker.py:6:from app.services.summary_service import generate_document_brief_sync
backend/app/core/model_profiles.py:194:    return MODEL_PROFILES.get(model_id, _DEFAULT_PROFILE)
backend/app/core/model_profiles.py:209:    return rules
backend/app/workers/parse_worker.py:78:    return Minio(host, access_key=access_key, secret_key=secret_key, secure=secure)
backend/app/workers/parse_worker.py:89:    return data
backend/app/workers/parse_worker.py:97:        return
backend/app/workers/parse_worker.py:103:            return
backend/app/workers/parse_worker.py:143:                return
backend/app/workers/parse_worker.py:147:            # Pages/Chunks intact (we only set an error + return) instead of committing the
backend/app/workers/parse_worker.py:176:                return
backend/app/workers/parse_worker.py:190:            doc.summary = None
backend/app/workers/parse_worker.py:207:                return
backend/app/workers/parse_worker.py:231:                    return
backend/app/workers/parse_worker.py:284:                    return
backend/app/workers/parse_worker.py:311:                        return
backend/app/workers/parse_worker.py:356:                            return
backend/app/workers/parse_worker.py:367:                            return
backend/app/workers/parse_worker.py:443:                return
backend/app/workers/parse_worker.py:472:                return
backend/app/workers/parse_worker.py:484:                return
backend/app/workers/parse_worker.py:517:                return
backend/app/workers/parse_worker.py:539:                    return
backend/app/workers/parse_worker.py:604:                # Best-effort: generate persisted brief + legacy summary fields in a separate task.
backend/app/workers/parse_worker.py:614:                return
backend/app/services/embedding_service.py:43:        return self._client
backend/app/services/embedding_service.py:49:        returning HTTP 200 with empty data).
backend/app/services/embedding_service.py:52:            return []
backend/app/services/embedding_service.py:61:                return vectors
backend/app/services/embedding_service.py:78:        return QdrantClient(
backend/app/services/embedding_service.py:112:            return
backend/app/main.py:86:            return status == 409
backend/app/main.py:89:        return "409" in msg
backend/app/main.py:133:                    return
backend/app/main.py:160:    yield
backend/app/main.py:210:    return get_release_payload()
backend/app/main.py:217:        return {"status": "ok", "release": release}
backend/app/main.py:266:        return_exceptions=True,
backend/app/main.py:274:    return {"status": overall, "release": release, "components": components}
backend/app/services/biblio_service.py:42:        return None
backend/app/services/biblio_service.py:45:        return {"family": parts[0], "given": ""}
backend/app/services/biblio_service.py:46:    return {"family": parts[-1], "given": " ".join(parts[:-1])}
backend/app/services/biblio_service.py:51:    "Author: Title.ext" style filenames yield an author + title guess; a bare
backend/app/services/biblio_service.py:53:    as the title when nothing else parses — always returns SOMETHING so the
backend/app/services/biblio_service.py:57:        return {"title": filename or "Untitled document"}
backend/app/services/biblio_service.py:86:    return csl
backend/app/services/biblio_service.py:102:                return csl
backend/app/services/biblio_service.py:138:    return csl
backend/app/services/biblio_service.py:147:    return result.scalar_one_or_none()
backend/app/services/biblio_service.py:158:    return result.scalar_one_or_none()
backend/app/services/biblio_service.py:171:    rolling back and re-fetching: the loser's job here is only to return
backend/app/services/biblio_service.py:177:        return existing
backend/app/services/biblio_service.py:190:        return winner
backend/app/services/biblio_service.py:191:    return row
backend/app/services/biblio_service.py:200:        return user_row
backend/app/services/biblio_service.py:201:    return await get_or_seed_system_biblio(db, document)
backend/app/services/biblio_service.py:226:        return existing
backend/app/services/biblio_service.py:240:        return winner
backend/app/services/biblio_service.py:241:    return row
backend/app/services/biblio_service.py:272:    return f"({who}, {year_str}{page_str})"
backend/app/core/deps.py:21:        yield session
backend/app/core/deps.py:31:        return None
backend/app/core/deps.py:38:            return None
backend/app/core/deps.py:54:            return None
backend/app/core/deps.py:55:        return await db.get(User, UUID(user_id))
backend/app/core/deps.py:58:        return None
backend/app/core/deps.py:61:        return None
backend/app/core/deps.py:64:        return None
backend/app/core/deps.py:73:    return user
backend/app/core/deps.py:83:    return user
backend/app/services/demo_seed.py:62:    return Minio(host, access_key=access_key, secret_key=secret_key, secure=secure)
backend/app/services/demo_seed.py:141:    return restored
backend/app/services/citation_quote_service.py:5:Chinese about an English document) or heavy paraphrase, it returns None and the
backend/app/services/citation_quote_service.py:38:    "paraphrase, summarize, or fix typos), that best supports how that source "
backend/app/services/citation_quote_service.py:47:# (tables, map-reduce summaries) — never sent to extraction (plan H8).
backend/app/services/citation_quote_service.py:48:_NON_FOCUSABLE_MODALITIES = {"table", "summary"}
backend/app/services/citation_quote_service.py:52:    return _FENCE_RE.sub("", raw.strip()).strip()
backend/app/services/citation_quote_service.py:60:        return {}
backend/app/services/citation_quote_service.py:62:        return {}
backend/app/services/citation_quote_service.py:71:    return out
backend/app/services/citation_quote_service.py:88:    reconcile this call's cost into the answer's actual cost (summary_usage
backend/app/services/citation_quote_service.py:101:            continue  # tables / summaries have no clean prose sentence (H8)
backend/app/services/citation_quote_service.py:107:        return {}, (0, 0)
backend/app/services/citation_quote_service.py:132:        return {}, (0, 0)
backend/app/services/citation_quote_service.py:152:    return out, usage
backend/app/services/citation_quote_service.py:159:        return False
backend/app/services/citation_quote_service.py:166:    return changed
backend/app/api/events.py:79:        return None
backend/app/api/events.py:82:        return None
backend/app/api/events.py:83:    return text[:max_len]
backend/app/api/events.py:96:    return safe
backend/app/api/events.py:127:    return Response(status_code=204)
backend/app/services/quote_source_service.py:41:    return isinstance(bb, dict) and all(isinstance(bb.get(k), (int, float)) for k in ("x", "y", "w", "h"))
backend/app/services/quote_source_service.py:71:    return (chunk.page_start, getattr(chunk, "chunk_index", 0) or 0)
backend/app/services/quote_source_service.py:106:        return QuoteSource(
backend/app/services/quote_source_service.py:130:    return QuoteSource(
backend/app/core/version.py:19:    return [
backend/app/core/version.py:35:            return {"version": version, "stage": stage}
backend/app/core/version.py:40:    return _load_version_payload()["version"]
backend/app/core/version.py:44:    return _load_version_payload()["stage"]
backend/app/core/version.py:51:            return value[:12]
backend/app/core/version.py:52:    return None
backend/app/core/version.py:61:    return payload
backend/app/schemas/chat.py:13:    domain_mode: Optional[Literal["legal", "academic"]] = None
backend/app/schemas/chat.py:56:    domain_mode: Optional[str] = None

exec
/bin/zsh -lc "rg -n \"DOCUMENT_LIMIT_REACHED|targetPlanOrNone|targetPlan\\(|getErrorCopy\\(|ErrorCopy|bodyTopTier|openPaywall\" frontend/src --glob '"'!**/*.map'"'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
frontend/src/i18n/locales/ar.json:2616:  "errors.DOCUMENT_LIMIT_REACHED.title": "تم الوصول إلى حد المستندات",
frontend/src/i18n/locales/ar.json:2617:  "errors.DOCUMENT_LIMIT_REACHED.body": "لقد وصلت إلى حد المستندات في خطتك ({limit}). احذف مستندًا قديمًا أو قم بالترقية للحصول على المزيد.",
frontend/src/i18n/locales/ar.json:2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "لقد وصلت إلى حد المستندات في خطتك ({limit}). احذف مستندًا لتحرير مساحة.",
frontend/src/i18n/locales/fr.json:2616:  "errors.DOCUMENT_LIMIT_REACHED.title": "Limite de documents atteinte",
frontend/src/i18n/locales/fr.json:2617:  "errors.DOCUMENT_LIMIT_REACHED.body": "Vous avez atteint la limite de documents de votre forfait ({limit}). Supprimez un ancien document ou passez à un forfait supérieur.",
frontend/src/i18n/locales/fr.json:2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "Vous avez atteint la limite de documents de votre forfait ({limit}). Supprimez un document pour libérer de l'espace.",
frontend/src/i18n/locales/de.json:2616:  "errors.DOCUMENT_LIMIT_REACHED.title": "Dokumentenlimit erreicht",
frontend/src/i18n/locales/de.json:2617:  "errors.DOCUMENT_LIMIT_REACHED.body": "Sie haben das Dokumentenlimit Ihres Tarifs erreicht ({limit}). Löschen Sie ein altes Dokument oder führen Sie ein Upgrade durch.",
frontend/src/i18n/locales/de.json:2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "Sie haben das Dokumentenlimit Ihres Tarifs erreicht ({limit}). Löschen Sie ein Dokument, um Platz freizugeben.",
frontend/src/i18n/locales/ko.json:2616:  "errors.DOCUMENT_LIMIT_REACHED.title": "문서 한도 도달",
frontend/src/i18n/locales/ko.json:2617:  "errors.DOCUMENT_LIMIT_REACHED.body": "요금제의 문서 한도({limit})에 도달했습니다. 이전 문서를 삭제하거나 업그레이드하세요.",
frontend/src/i18n/locales/ko.json:2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "요금제의 문서 한도({limit})에 도달했습니다. 문서를 삭제해 공간을 확보하세요.",
frontend/src/i18n/locales/es.json:2616:  "errors.DOCUMENT_LIMIT_REACHED.title": "Límite de documentos alcanzado",
frontend/src/i18n/locales/es.json:2617:  "errors.DOCUMENT_LIMIT_REACHED.body": "Has alcanzado el límite de documentos de tu plan ({limit}). Elimina un documento antiguo o mejora tu plan para obtener más.",
frontend/src/i18n/locales/es.json:2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "Has alcanzado el límite de documentos de tu plan ({limit}). Elimina un documento para liberar espacio.",
frontend/src/i18n/locales/zh.json:2655:  "errors.DOCUMENT_LIMIT_REACHED.title": "文档数量已达上限",
frontend/src/i18n/locales/zh.json:2656:  "errors.DOCUMENT_LIMIT_REACHED.body": "您已达到套餐的文档数量上限（{limit}）。删除旧文档或升级以获取更多。",
frontend/src/i18n/locales/zh.json:2657:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "您已达到套餐的文档数量上限（{limit}）。删除一个文档以释放空间。",
frontend/src/i18n/locales/it.json:2616:  "errors.DOCUMENT_LIMIT_REACHED.title": "Limite documenti raggiunto",
frontend/src/i18n/locales/it.json:2617:  "errors.DOCUMENT_LIMIT_REACHED.body": "Hai raggiunto il limite di documenti del tuo piano ({limit}). Elimina un vecchio documento o aggiorna il piano per averne di più.",
frontend/src/i18n/locales/it.json:2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "Hai raggiunto il limite di documenti del tuo piano ({limit}). Elimina un documento per liberare spazio.",
frontend/src/i18n/locales/en.json:2299:  "errors.DOCUMENT_LIMIT_REACHED.title": "Document limit reached",
frontend/src/i18n/locales/en.json:2300:  "errors.DOCUMENT_LIMIT_REACHED.body": "You've reached your plan's document limit ({limit}). Delete an old document or upgrade for more.",
frontend/src/i18n/locales/en.json:2301:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "You've reached your plan's document limit ({limit}). Delete a document to free up space.",
frontend/src/i18n/locales/pt.json:2616:  "errors.DOCUMENT_LIMIT_REACHED.title": "Limite de documentos atingido",
frontend/src/i18n/locales/pt.json:2617:  "errors.DOCUMENT_LIMIT_REACHED.body": "Você atingiu o limite de documentos do seu plano ({limit}). Exclua um documento antigo ou faça upgrade para mais.",
frontend/src/i18n/locales/pt.json:2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "Você atingiu o limite de documentos do seu plano ({limit}). Exclua um documento para liberar espaço.",
frontend/src/i18n/locales/hi.json:2616:  "errors.DOCUMENT_LIMIT_REACHED.title": "दस्तावेज़ सीमा समाप्त",
frontend/src/i18n/locales/hi.json:2617:  "errors.DOCUMENT_LIMIT_REACHED.body": "आप अपनी योजना की दस्तावेज़ सीमा ({limit}) तक पहुंच गए हैं। अधिक के लिए कोई पुराना दस्तावेज़ हटाएं या अपग्रेड करें।",
frontend/src/i18n/locales/hi.json:2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "आप अपनी योजना की दस्तावेज़ सीमा ({limit}) तक पहुंच गए हैं। जगह खाली करने के लिए एक दस्तावेज़ हटाएं।",
frontend/src/i18n/locales/ja.json:2616:  "errors.DOCUMENT_LIMIT_REACHED.title": "ドキュメント数の上限に達しました",
frontend/src/i18n/locales/ja.json:2617:  "errors.DOCUMENT_LIMIT_REACHED.body": "プランのドキュメント上限（{limit}）に達しました。古いドキュメントを削除するか、アップグレードしてください。",
frontend/src/i18n/locales/ja.json:2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "プランのドキュメント上限（{limit}）に達しました。ドキュメントを削除して空き容量を確保してください。",
frontend/src/lib/useChatSession.ts:53:    // sessionErrorCopy ? <error/> : ...` — checking sessionId BEFORE the
frontend/src/lib/errorCopy.ts:4:export interface ErrorCopy {
frontend/src/lib/errorCopy.ts:29:  openPaywall?: boolean;
frontend/src/lib/errorCopy.ts:65:export function errorCopy(err: ErrorInput, t: TFn, tOr: TOrFn): ErrorCopy {
frontend/src/lib/errorCopy.ts:93:type Handler = (detail: Record<string, unknown>, tOr: TOrFn) => ErrorCopy;
frontend/src/lib/errorCopy.ts:95:function targetPlan(detail: Record<string, unknown>, fallback: BillingPlanIntent = 'plus'): BillingPlanIntent {
frontend/src/lib/errorCopy.ts:100: * Like targetPlan(), but for document-cap codes where a Pro user (already
frontend/src/lib/errorCopy.ts:105: * user at a downgrade (Codex P1 FIX-1: targetPlan()'s ternary only special-cased
frontend/src/lib/errorCopy.ts:108:function targetPlanOrNone(detail: Record<string, unknown>): BillingPlanIntent | undefined {
frontend/src/lib/errorCopy.ts:110:  return targetPlan(detail);
frontend/src/lib/errorCopy.ts:130:  DOCUMENT_LIMIT_REACHED: (d, tOr) => {
frontend/src/lib/errorCopy.ts:131:    const plan = targetPlanOrNone(d);
frontend/src/lib/errorCopy.ts:133:      title: tOr('errors.DOCUMENT_LIMIT_REACHED.title', 'Document limit reached'),
frontend/src/lib/errorCopy.ts:135:        ? tOr('errors.DOCUMENT_LIMIT_REACHED.body', 'You\'ve reached your plan\'s document limit ({limit}). Delete an old document or upgrade for more.', {
frontend/src/lib/errorCopy.ts:138:        : tOr('errors.DOCUMENT_LIMIT_REACHED.bodyTopTier', 'You\'ve reached your plan\'s document limit ({limit}). Delete a document to free up space.', {
frontend/src/lib/errorCopy.ts:150:    cta: upgradeCta(tOr, 'file_size', targetPlan(d)),
frontend/src/lib/errorCopy.ts:273:    openPaywall: true,
frontend/src/lib/errorCopy.ts:284:    openPaywall: true,
frontend/src/lib/errorCopy.ts:295:    openPaywall: true,
frontend/src/lib/errorCopy.ts:309:    openPaywall: true,
frontend/src/lib/errorCopy.ts:324:    cta: upgradeCta(tOr, 'collection_limit', targetPlan(d)),
frontend/src/lib/errorCopy.ts:332:    cta: upgradeCta(tOr, 'collection_doc_limit', targetPlan(d)),
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:22:import { errorCopy, type ErrorCopy } from '../../../lib/errorCopy';
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:60:  const [layoutTranslationError, setLayoutTranslationError] = useState<ErrorCopy | null>(null);
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:84:  const sessionErrorCopy = sessionError ? errorCopy(sessionError, t, tOr) : null;
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:430:  ) : sessionErrorCopy ? (
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:434:          sessionErrorCopy.severity === 'warning'
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:436:            : sessionErrorCopy.severity === 'info'
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:443:        <p className="font-semibold">{sessionErrorCopy.title}</p>
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:444:        <p className="mt-2 leading-6 opacity-90">{sessionErrorCopy.body}</p>
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:445:        {sessionErrorCopy.cta && (
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:448:            onClick={() => router.push(sessionErrorCopy.cta!.href)}
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:451:            {sessionErrorCopy.cta.label}
frontend/src/components/Chat/ChatArtifactCard.tsx:10:import { errorCopy, type ErrorCopy } from '../../lib/errorCopy';
frontend/src/components/Chat/ChatArtifactCard.tsx:109:  const [layoutImportError, setLayoutImportError] = useState<ErrorCopy | null>(null);
frontend/src/components/Collections/CreateCollectionModal.tsx:9:import { errorCopy, type ErrorCopy } from '../../lib/errorCopy';
frontend/src/components/Collections/CreateCollectionModal.tsx:24:  const [createErrorCopy, setCreateErrorCopy] = useState<ErrorCopy | null>(null);
frontend/src/components/Collections/CreateCollectionModal.tsx:37:      setCreateErrorCopy(null);
frontend/src/components/Collections/CreateCollectionModal.tsx:66:    setCreateErrorCopy(null);
frontend/src/components/Collections/CreateCollectionModal.tsx:73:      setCreateErrorCopy(copy);
frontend/src/components/Collections/CreateCollectionModal.tsx:194:        {createErrorCopy && (
frontend/src/components/Collections/CreateCollectionModal.tsx:198:              createErrorCopy.severity === 'warning'
frontend/src/components/Collections/CreateCollectionModal.tsx:203:            <p className="font-medium">{createErrorCopy.title}</p>
frontend/src/components/Collections/CreateCollectionModal.tsx:204:            <p className="mt-1 leading-5 opacity-90">{createErrorCopy.body}</p>
frontend/src/components/Collections/CreateCollectionModal.tsx:205:            {createErrorCopy.cta && (
frontend/src/components/Collections/CreateCollectionModal.tsx:207:                href={createErrorCopy.cta.href}
frontend/src/components/Collections/CreateCollectionModal.tsx:211:                {createErrorCopy.cta.label}
frontend/src/app/collections/[collectionId]/page.tsx:26:import { errorCopy, type ErrorCopy } from '../../../lib/errorCopy';
frontend/src/app/collections/[collectionId]/page.tsx:51:  const [addDocsErrorCopy, setAddDocsErrorCopy] = useState<ErrorCopy | null>(null);
frontend/src/app/collections/[collectionId]/page.tsx:52:  // Distinct from addDocsErrorCopy (which surfaces add-document failures inside
frontend/src/app/collections/[collectionId]/page.tsx:161:    setAddDocsErrorCopy(null);
frontend/src/app/collections/[collectionId]/page.tsx:180:    setAddDocsErrorCopy(null);
frontend/src/app/collections/[collectionId]/page.tsx:188:      setAddDocsErrorCopy(copy);
frontend/src/app/collections/[collectionId]/page.tsx:202:    setAddDocsErrorCopy(null);
frontend/src/app/collections/[collectionId]/page.tsx:531:            {addDocsErrorCopy && (
frontend/src/app/collections/[collectionId]/page.tsx:535:                  addDocsErrorCopy.severity === 'warning'
frontend/src/app/collections/[collectionId]/page.tsx:540:                <p className="font-medium">{addDocsErrorCopy.title}</p>
frontend/src/app/collections/[collectionId]/page.tsx:541:                <p className="mt-1 leading-5 opacity-90">{addDocsErrorCopy.body}</p>
frontend/src/app/collections/[collectionId]/page.tsx:542:                {addDocsErrorCopy.cta && (
frontend/src/app/collections/[collectionId]/page.tsx:544:                    href={addDocsErrorCopy.cta.href}
frontend/src/app/collections/[collectionId]/page.tsx:548:                    {addDocsErrorCopy.cta.label}
frontend/src/components/SessionDropdown.tsx:10:import { errorCopy, type ErrorCopy } from '../lib/errorCopy';
frontend/src/components/SessionDropdown.tsx:29:  const [sessionErrorCopy, setSessionErrorCopy] = useState<ErrorCopy | null>(null);
frontend/src/components/SessionDropdown.tsx:61:    setSessionErrorCopy(null);
frontend/src/components/SessionDropdown.tsx:93:      setSessionErrorCopy(copy);
frontend/src/components/SessionDropdown.tsx:102:    setSessionErrorCopy(null);
frontend/src/components/SessionDropdown.tsx:134:    setSessionErrorCopy(null);
frontend/src/components/SessionDropdown.tsx:161:    setSessionErrorCopy(null);
frontend/src/components/SessionDropdown.tsx:167:    setSessionErrorCopy(null);
frontend/src/components/SessionDropdown.tsx:243:            {sessionErrorCopy && (
frontend/src/components/SessionDropdown.tsx:247:                  sessionErrorCopy.severity === 'warning'
frontend/src/components/SessionDropdown.tsx:252:                <p className="font-medium">{sessionErrorCopy.title}</p>
frontend/src/components/SessionDropdown.tsx:253:                <p className="mt-1 leading-5 opacity-90">{sessionErrorCopy.body}</p>
frontend/src/components/SessionDropdown.tsx:254:                {sessionErrorCopy.cta && (
frontend/src/components/SessionDropdown.tsx:256:                    href={sessionErrorCopy.cta.href}
frontend/src/components/SessionDropdown.tsx:260:                    {sessionErrorCopy.cta.label}
frontend/src/components/dashboard/DashboardPageClient.tsx:19:import { errorCopy, type ErrorCopy } from '../../lib/errorCopy';
frontend/src/components/dashboard/DashboardPageClient.tsx:66:  const [uploadErrorCopy, setUploadErrorCopy] = useState<ErrorCopy | null>(null);
frontend/src/components/dashboard/DashboardPageClient.tsx:77:  const [urlErrorCopy, setUrlErrorCopy] = useState<ErrorCopy | null>(null);
frontend/src/components/dashboard/DashboardPageClient.tsx:211:    setUploadErrorCopy(null);
frontend/src/components/dashboard/DashboardPageClient.tsx:224:      setUploadErrorCopy(null);
frontend/src/components/dashboard/DashboardPageClient.tsx:230:      setUploadErrorCopy({
frontend/src/components/dashboard/DashboardPageClient.tsx:244:    setUploadErrorCopy(null);
frontend/src/components/dashboard/DashboardPageClient.tsx:303:      setUploadErrorCopy(copy.cta ? copy : null);
frontend/src/components/dashboard/DashboardPageClient.tsx:326:    setUrlErrorCopy(null);
frontend/src/components/dashboard/DashboardPageClient.tsx:329:      setUrlErrorCopy(null);
frontend/src/components/dashboard/DashboardPageClient.tsx:334:    setUrlErrorCopy(null);
frontend/src/components/dashboard/DashboardPageClient.tsx:346:      setUrlErrorCopy(copy.cta ? copy : null);
frontend/src/components/dashboard/DashboardPageClient.tsx:459:                {uploadErrorCopy?.cta && (
frontend/src/components/dashboard/DashboardPageClient.tsx:461:                    href={uploadErrorCopy.cta.href}
frontend/src/components/dashboard/DashboardPageClient.tsx:465:                    {uploadErrorCopy.cta.label}
frontend/src/components/dashboard/DashboardPageClient.tsx:479:                onChange={(e) => { setUrlInput(e.target.value); setUrlError(''); setUrlErrorCopy(null); }}
frontend/src/components/dashboard/DashboardPageClient.tsx:498:              {urlErrorCopy?.cta && (
frontend/src/components/dashboard/DashboardPageClient.tsx:500:                  href={urlErrorCopy.cta.href}
frontend/src/components/dashboard/DashboardPageClient.tsx:504:                  {urlErrorCopy.cta.label}

exec
/bin/zsh -lc 'git diff --no-ext-diff --unified=80 e499bc7..HEAD -- frontend/src/lib/errorCopy.ts frontend/src/i18n/locales backend/app/services/chat_service.py backend/tests/test_quote_intent_routing.py' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
diff --git a/backend/app/services/chat_service.py b/backend/app/services/chat_service.py
index 3a1830b..704a4d5 100644
--- a/backend/app/services/chat_service.py
+++ b/backend/app/services/chat_service.py
@@ -876,160 +876,185 @@ async def _persist_continuation_on_cancel(
         merged_citations = list(asst_msg.citations or []) + list(new_citations or [])
         asst_msg.content = (asst_msg.content or "") + continuation_text
         asst_msg.citations = merged_citations if merged_citations else None
         asst_msg.continuation_count = (asst_msg.continuation_count or 0) + 1
         asst_msg.output_tokens = (asst_msg.output_tokens or 0) + int(output_tokens or 0)
         await persist_db.commit()
         return True
 
 
 async def _settle_predebit_on_cancel(
     *,
     user_id: uuid.UUID,
     pre_debited: int,
     predebit_ledger_id: uuid.UUID,
     has_answer: bool,
     prompt_tokens: Optional[int],
     output_tokens: Optional[int],
     model: str,
     mode: str,
 ) -> None:
     async with AsyncSessionLocal() as settle_db:
         if has_answer:
             actual_cost = credit_service.calculate_cost(
                 int(prompt_tokens or 0),
                 int(output_tokens or 0),
                 model,
                 mode=mode,
             )
             await credit_service.reconcile_credits(
                 settle_db,
                 user_id,
                 predebit_ledger_id,
                 pre_debited,
                 actual_cost,
             )
             await settle_db.commit()
         else:
             await _refund_predebit(settle_db, user_id, pre_debited, predebit_ledger_id)
 
 
 async def _settle_verified_quote_predebit_after_failure(
     *,
     user_id: uuid.UUID,
     pre_debited: int,
     predebit_ledger_id: uuid.UUID,
     use_independent_session: bool,
     db: Optional[AsyncSession] = None,
 ) -> bool:
     """FIX3-A (Codex r3 #4, NOT ADDRESSED): the SOLE settlement resolver for
     _run_verified_quote_search's failure paths — CancelledError OR an
     ordinary exception, replacing FIX2-B(c)'s Message-marker existence
     check (which could only resolve the CancelledError case, and still
     required a caller-generated id and an independent read).
 
     That marker check is superseded entirely by FIX3-A(b)/(c)'s durable
     ledger state: reconcile_credits() now ALWAYS stamps reconciled_at
     (including the equal-cost no-op path) under a row lock, and
     _refund_predebit's DELETE is now conditional on reconciled_at IS NULL —
     a single atomic statement that both checks and acts, with no race
     window regardless of whether the atomic commit has landed, is still
     landing, or never will. There is nothing left for THIS function to
     "decide" — it just calls _refund_predebit with the right session and
     surfaces whether a refund actually happened, so the caller can log/
     respond accordingly.
 
     use_independent_session=True (CancelledError): the request's own `db`
     session may not be usable mid-cancellation — settle via a fresh
     AsyncSessionLocal(), matching every other cancel-path settler in this
     file.
     use_independent_session=False (ordinary exception): reuses the
     request's own `db` (rolled back first, inside _refund_predebit) —
     matches the existing pattern for non-cancellation failures elsewhere.
     """
     if use_independent_session:
         async with AsyncSessionLocal() as settle_db:
             return await _refund_predebit(settle_db, user_id, pre_debited, predebit_ledger_id)
     assert db is not None
     return await _refund_predebit(db, user_id, pre_debited, predebit_ledger_id)
 
 
+async def _sync_session_domain_mode(
+    db: AsyncSession, session_obj: ChatSession, domain_mode: Optional[str],
+) -> None:
+    """P1 hygiene follow-up (Codex M3 P1 review, 2026-08-03): the persisted
+    ChatSession.domain_mode must reflect the CURRENT request's domain_mode
+    (null when omitted) on EVERY successful terminal path of chat_stream,
+    not just the main RAG path this logic originally lived in inline.
+    Codex found two successful early-return paths that skipped it — tool
+    actions and strict Quote Finder routing — both returning before the
+    main RAG path's system-prompt-building section ever ran. A session
+    that once had domain_mode="legal" persisted could keep that stale
+    value after a later omitted-mode message that happened to route to
+    one of those branches, making the documented "omitted clears it"
+    invariant false for those paths.
+
+    Downstream-harmless today (chat_stream always uses the per-request
+    `domain_mode` argument directly, never re-reads session_obj.domain_mode
+    to decide behavior; continuation doesn't reload it either) — this is
+    metadata correctness / honoring the invariant, not a security fix.
+    """
+    if domain_mode != session_obj.domain_mode:
+        session_obj.domain_mode = domain_mode
+        await db.commit()
+
+
 async def _fetch_page_chunks(
     db: AsyncSession,
     document_id: uuid.UUID,
     page_ref: int,
     *,
     limit: int = 12,
 ) -> List[Dict[str, Any]]:
     """Direct positional retrieval (B4): chunks overlapping a specific page.
 
     Semantic top-k cannot resolve "what is on page N" — the paying user asked for
     page 350 of a 492-page PDF and got "the excerpts do not contain page 350".
     Here we fetch the chunks whose page range covers the requested page.
     """
     rows = await db.execute(
         select(Chunk)
         .where(Chunk.document_id == document_id)
         .where(Chunk.page_start <= page_ref)
         .where(Chunk.page_end >= page_ref)
         .order_by(Chunk.chunk_index)
         .limit(limit)
     )
     chunks = list(rows.scalars())
     return [chunk_to_retrieval_item(ch, 1.0, include_document_id=True) for ch in chunks]
 
 
 async def _record_rag_verification_event(
     db: AsyncSession,
     *,
     user: Optional[User],
     message_id: uuid.UUID | None,
     verification: dict,
     retrieval_strategy: str,
     query_route: Any,
     retrieved_count: int,
     repair_metadata: dict[str, Any] | None = None,
 ) -> None:
     try:
         metadata_json = {
             "message_id": str(message_id) if message_id else None,
             "status": verification.get("status"),
             "score": verification.get("score"),
             "reasons": verification.get("reasons") or [],
             "claim_count": verification.get("claim_count"),
             "cited_claim_count": verification.get("cited_claim_count"),
             "uncited_claim_count": verification.get("uncited_claim_count"),
             "citation_count": verification.get("citation_count"),
             "invalid_citation_count": verification.get("invalid_citation_count"),
             "low_overlap_citation_count": verification.get("low_overlap_citation_count"),
             "numeric_mismatch_citation_count": verification.get("numeric_mismatch_citation_count"),
             "retrieved_count": retrieved_count,
             "retrieval_strategy": retrieval_strategy,
             "route": getattr(getattr(query_route, "primary_intent", None), "value", None),
         }
         if repair_metadata:
             metadata_json.update(repair_metadata)
         db.add(
             ProductEvent(
                 user_id=user.id if user else None,
                 event_name="rag_verification_completed",
                 source="chat",
                 reason=str(verification.get("status") or "unknown")[:64],
                 plan=(user.plan if user else None),
                 metadata_json=metadata_json,
             )
         )
         await db.commit()
     except Exception:
         await db.rollback()
         logger.warning("Failed to record RAG verification event", exc_info=True)
 
 
 # ---------------------------
 # RefParserFSM
 # ---------------------------
 
 @dataclass
 class _ChunkInfo:
     id: uuid.UUID
     page_start: int
     page_end: int
@@ -1507,160 +1532,165 @@ class ChatService:
         """Main chat streaming generator producing SSE event dicts.
 
         Steps per spec:
         1) Load session + document
         2) Save user message
         3) Load recent history (last MAX_CHAT_HISTORY_TURNS rounds)
         4) Retrieval top-5
         5) Build prompt with numbered chunks
         6) Stream Anthropic
         7) Parse with RefParserFSM and yield events; ping every 15s
         8) Save assistant message + citations
         9) Yield done
         """
 
         # 1) Load session
         row = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
         session_obj: Optional[ChatSession] = row.scalar_one_or_none()
         if not session_obj:
             yield sse("error", {"code": "SESSION_NOT_FOUND", "message": "会话不存在"})
             return
 
         document_id = session_obj.document_id
         collection_id = getattr(session_obj, "collection_id", None)
         is_collection_session = collection_id is not None and document_id is None
 
         # Load document for custom instructions (single-doc sessions)
         doc = await db.get(Document, document_id) if document_id else None
 
         # For collection sessions, load all document IDs and filenames
         collection_doc_ids: List[uuid.UUID] = []
         collection_doc_names: dict[uuid.UUID, str] = {}
         collection_doc_types: dict[uuid.UUID, str] = {}
         collection_doc_pages: dict[uuid.UUID, int] = {}
         if is_collection_session:
             cd_rows = await db.execute(
                 select(collection_documents.c.document_id).where(
                     collection_documents.c.collection_id == collection_id
                 )
             )
             collection_doc_ids = [row[0] for row in cd_rows.all()]
             if collection_doc_ids:
                 doc_rows = await db.execute(
                     select(Document.id, Document.filename, Document.file_type, Document.page_count)
                     .where(Document.id.in_(collection_doc_ids))
                 )
                 for drow in doc_rows.all():
                     collection_doc_names[drow[0]] = drow[1]
                     collection_doc_types[drow[0]] = drow[2]
                     if drow[3]:
                         collection_doc_pages[drow[0]] = drow[3]
 
         # Resolve mode → model (mode is the ONLY way to select a model)
         effective_mode = mode if mode in settings.MODE_MODELS else "balanced"
         effective_model = settings.MODE_MODELS[effective_mode]
 
         # Force demo model for anonymous users on demo documents
         if user is None and doc and doc.demo_slug:
             effective_model = settings.DEMO_LLM_MODEL
             effective_mode = "quick"
 
         # Premium mode gating: require Plus or Pro plan
         if effective_mode in settings.PREMIUM_MODES:
             user_plan = (user.plan or "free").lower() if user else "free"
             if user_plan == "free":
                 yield sse(
                     "error",
                     {
                         "code": "MODE_NOT_ALLOWED",
                         "message": "Upgrade to Plus to use this mode",
                         "required_plan": "plus",
                     },
                 )
                 return
 
         action_plan = await action_planner.plan(
             user_message,
             is_collection=is_collection_session,
             locale=locale,
         )
         if not action_plan.uses_rag_answer_path:
+            # P1 hygiene follow-up (Codex, 2026-08-03): this successful
+            # early-return path skipped the domain_mode session sync that
+            # only ran inline in the main RAG path below — see
+            # _sync_session_domain_mode's docstring.
+            await _sync_session_domain_mode(db, session_obj, domain_mode)
             async for ev in self._tool_action_stream(
                 session_id=session_id,
                 user_message=user_message,
                 db=db,
                 user=user,
                 locale=locale,
                 domain_mode=domain_mode,
                 document_id=document_id,
                 collection_doc_ids=collection_doc_ids,
                 action_plan=action_plan,
             ):
                 yield ev
             return
 
         query_route = query_router.route(
             user_message,
             is_collection=is_collection_session,
             domain_mode=domain_mode,
         )
 
         # Pre-debit estimated credits BEFORE streaming (prevents TOCTOU + free rides)
         pre_debited = 0
         predebit_ledger_id = None
         strict_quote_routed = _is_strict_quote_routed(
             action_plan, user=user, document_id=document_id,
             is_collection_session=is_collection_session, doc=doc,
         )
         if user is not None:
             # FIX-3 (Codex r1 BLOCKER #3): a strict-routed message ALWAYS
             # runs the balanced-model quote engine regardless of the
             # user-selected chat mode — predebit must reflect that real
             # cost, not `effective_mode`'s (e.g. quick=5), or a low-balance
             # user could reserve too little and reconciliation would push
             # their account negative to cover the overrun.
             estimated = (
                 credit_service.get_estimated_cost("balanced")
                 if strict_quote_routed
                 else credit_service.get_estimated_cost(effective_mode)
             )
             if query_route.primary_intent == QueryIntent.DOCUMENT_SUMMARY:
                 estimated = max(estimated, estimated * 2)
             predebit_ledger_id = await credit_service.debit_credits(
                 db, user_id=user.id, cost=estimated,
                 reason="chat", ref_type="mode", ref_id="balanced" if strict_quote_routed else effective_mode,
             )
             if predebit_ledger_id:
                 pre_debited = estimated
                 await db.commit()
             else:
                 balance = await credit_service.get_user_credits(db, user.id)
                 yield sse(
                     "error",
                     {
                         "code": "INSUFFICIENT_CREDITS",
                         "message": "Insufficient credits to start chat",
                         "required": estimated,
                         "balance": balance,
                     },
                 )
                 return
 
         settled = False
         setup_error_code = "CHAT_SETUP_ERROR"
         try:
             # 2) Save user message
             await self._persist_user_message_and_title(
                 db=db,
                 session_id=session_id,
                 user_message=user_message,
             )
 
             # Strict verbatim-quote chat routing (B5, plan §8.4.3). Gated
             # here (not in the planner, which has no auth/doc context):
             # AUTHED, non-demo, single-document sessions only. Anonymous,
             # demo, and collection sessions fall through to the normal RAG
             # path below UNCHANGED — the strict intent still matched, but
             # without a real document + billing user the verified pipeline
             # can't run, so this degrades to an ordinary cited answer rather
             # than erroring. SAME predicate (`strict_quote_routed`, computed
             # above) already decided the predebit amount — never re-derive
@@ -1700,160 +1730,164 @@ class ChatService:
                                 refunded = await asyncio.wait_for(
                                     _settle_verified_quote_predebit_after_failure(
                                         user_id=user.id,
                                         pre_debited=pre_debited,
                                         predebit_ledger_id=predebit_ledger_id,
                                         use_independent_session=True,
                                     ),
                                     timeout=_CANCEL_IO_TIMEOUT_S,
                                 )
                             if not refunded:
                                 logger.info(
                                     "quote_billing.settled_no_refund user=%s ledger=%s: cancellation "
                                     "after the atomic commit had already reconciled — predebit stands.",
                                     user.id, predebit_ledger_id,
                                 )
                         except Exception:
                             # FIX3-A(d): resolver failure must NEVER fall
                             # through to ANY further settlement attempt —
                             # leave the predebit standing and surface it to
                             # ops for manual review.
                             logger.error(
                                 "quote_billing.unresolved user=%s ledger=%s pre_debited=%s "
                                 "session=%s: settlement resolver failed during cancellation — "
                                 "predebit left standing, requires manual review.",
                                 user.id, predebit_ledger_id, pre_debited, session_id, exc_info=True,
                             )
                     raise
                 except Exception as exc:
                     # FIX3-A(d) (Codex r3 #4, NOT ADDRESSED): ALL final-
                     # commit exceptions — not just CancelledError — now
                     # route through the SAME resolver as the branch above,
                     # closing the "ordinary 'server committed but COMMIT
                     # response was lost' exception leaves progress.message_id
                     # unset and reaches the generic (blind) refund path"
                     # gap Codex r3 found. `settled` is marked BEFORE the
                     # resolver runs, same reasoning as the CancelledError
                     # branch.
                     if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
                         settled = True
                         try:
                             refunded = await _settle_verified_quote_predebit_after_failure(
                                 user_id=user.id,
                                 pre_debited=pre_debited,
                                 predebit_ledger_id=predebit_ledger_id,
                                 use_independent_session=False,
                                 db=db,
                             )
                         except Exception:
                             logger.error(
                                 "quote_billing.unresolved user=%s ledger=%s pre_debited=%s "
                                 "session=%s: settlement resolver failed after an ordinary billing "
                                 "exception — predebit left standing, requires manual review.",
                                 user.id, predebit_ledger_id, pre_debited, session_id, exc_info=True,
                             )
                             yield _safe_sse("error", "QUOTE_SEARCH_ERROR", exc, session_id=str(session_id))
                             return
                         if not refunded:
                             # The atomic commit had already reconciled — a
                             # real, delivered, persisted answer — this
                             # exception struck AFTER that. Predebit stands
                             # as the charge; never a full refund for a
                             # delivered answer.
                             logger.exception(
                                 "Quote-search billing failed after the atomic commit had already "
                                 "reconciled (ledger %s) for user %s — predebit stands, no refund.",
                                 predebit_ledger_id, user.id,
                             )
                             yield _safe_sse(
                                 "error", "QUOTE_SEARCH_BILLING_INCOMPLETE", exc, session_id=str(session_id),
                             )
                             return
                         # Refunded — nothing was delivered.
                         yield _safe_sse("error", "QUOTE_SEARCH_ERROR", exc, session_id=str(session_id))
                         return
                     raise
                 # Reconcile already committed inside _run_verified_quote_search —
                 # mark settled BEFORE yielding so a cancellation during these
                 # yields can't ALSO trigger the setup handler's full refund
                 # (double-refund guard, same pattern as the main RAG path).
                 settled = True
+                # P1 hygiene follow-up (Codex, 2026-08-03): this successful
+                # early-return path also skipped the domain_mode session
+                # sync — see _sync_session_domain_mode's docstring.
+                await _sync_session_domain_mode(db, session_obj, domain_mode)
                 if outcome.artifact_payload:
                     yield sse("artifact", outcome.artifact_payload)
                 yield sse("token", {"text": outcome.assistant_text})
                 yield sse(
                     "done",
                     {
                         "message_id": str(outcome.message_id),
                         "citations_count": len(outcome.citations),
                         "verification": None,
                         "can_continue": False,
                         "continuation_count": 0,
                         "artifact_count": 1 if outcome.artifact_payload else 0,
                     },
                 )
                 return
 
             # 3) Load history (last N*2 messages before current user msg)
             max_turns = int(settings.MAX_CHAT_HISTORY_TURNS or 6)
             max_msgs = max_turns * 2
             msgs_row = await db.execute(
                 select(Message)
                 .where(Message.session_id == session_id)
                 .order_by(Message.created_at.desc())
                 .limit(max_msgs + 1)
             )
             history_msgs: List[Message] = list(msgs_row.scalars().all())
             history_msgs.reverse()  # back to chronological order
 
             # Convert to Claude message format (excluding system)
             claude_messages: List[dict] = []
             for m in history_msgs:
                 claude_messages.append({"role": m.role, "content": m.content})
 
             # 4) Route + retrieval (with error handling — e.g. Qdrant down or no vectors yet).
             # Whole-document summaries must not use ordinary semantic top-k: vague
             # summary prompts frequently retrieve tables/appendices instead of
             # representative document structure. Route them to an ordered context
             # selector until the durable hierarchical brief index lands.
             setup_error_code = "RETRIEVAL_ERROR"
             retrieval_strategy = "semantic_top_k"
             retrieval_evaluation = None
             retrieval_plan: QueryPlan | None = None
             summary_usage = MapReduceUsageCollector()
             if (
                 query_route.primary_intent == QueryIntent.DOCUMENT_SUMMARY
                 and document_id
                 and not is_collection_session
             ):
                 yield sse("tool_status", {"message": "Summarizing the document section by section…"})
                 retrieved = await document_brief_service.get_summary_context(
                     db,
                     document_id,
                     max_chunks=18,
                     usage_collector=summary_usage,
                 )
                 retrieval_strategy = "document_summary_context"
             elif (
                 query_route.primary_intent == QueryIntent.DOCUMENT_SUMMARY
                 and is_collection_session
                 and collection_doc_ids
             ):
                 retrieved = await document_brief_service.get_collection_summary_context(
                     db,
                     collection_doc_ids,
                     max_chunks=24,
                     max_docs=8,
                 )
                 retrieval_strategy = "collection_summary_context"
             elif is_collection_session and collection_doc_ids:
                 corrective = await corrective_retrieval_service.retrieve_multi(
                     user_message,
                     query_route,
                     collection_doc_ids,
                     top_k=8,
                     db=db,
                 )
                 retrieved = corrective.retrieved
                 retrieval_strategy = corrective.strategy
                 retrieval_evaluation = corrective.evaluation
                 retrieval_plan = corrective.plan
@@ -1976,164 +2010,165 @@ class ChatService:
                 )
             elif is_collection_session:
                 doc_list = ", ".join(collection_doc_names.values()) if collection_doc_names else "(no documents)"
                 system_prompt = (
                     "You are a document analysis assistant. Answer the user's question based on sources from multiple documents.\n\n"
                     + SYSTEM_PROMPT_META_RULE
                     + f"## Available Documents\n{doc_list}\n\n"
                     + "## Document Sources\n"
                     + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
                     + _retrieval_quality_contract(retrieval_evaluation, retrieval_strategy)
                     + _query_plan_contract(retrieval_plan)
                     + "\n\n## Rules\n" + rules
                     + _citation_contract()
                 )
             elif retrieval_strategy == "document_summary_context":
                 map_reduce_rule = (
                     "7. The sources may be map-reduce section summaries generated from source chunks; "
                     "use the coverage status to distinguish model-covered, fallback, and missing sections.\n"
                     if has_map_reduce_summary_context
                     else ""
                 )
                 system_prompt = (
                     "You are a document analysis assistant. The user is asking for a broad, whole-document summary.\n\n"
                     + SYSTEM_PROMPT_META_RULE
                     + "## Document Coverage Sources\n"
                     + (
                         "\n".join(numbered_chunks)
                         if numbered_chunks
                         else "(none)"
                     )
                     + "\n\n## Summary Rules\n"
                     + "1. Treat these sources as representative coverage selected across the document, not as semantic search results for a narrow question.\n"
                     + "2. Do NOT say the user's ready document is not a complete document merely because the context is selective.\n"
                     + "3. Produce a useful document-level summary with clear headings, key points, and important caveats when supported.\n"
                     + "4. If coverage is incomplete, say the answer is based on the cited representative sections instead of refusing.\n"
                     + "5. Cite every factual paragraph or bullet using the source numbers listed above.\n"
                     + "6. Your response language MUST match the language of the user's question.\n"
                     + map_reduce_rule
                     + _summary_coverage_contract(retrieved)
                     + _citation_contract()
                 )
             else:
                 system_prompt = (
                     "You are a document analysis assistant. Answer the user's question based on the following document sources.\n\n"
                     + SYSTEM_PROMPT_META_RULE
                     + "## Document Sources\n"
                     + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
                     + _retrieval_quality_contract(retrieval_evaluation, retrieval_strategy)
                     + _query_plan_contract(retrieval_plan)
                     + "\n\n## Rules\n" + rules
                     + _citation_contract()
                 )
 
             # Inject custom instructions if present (subordinate to core rules — they are
             # user preferences, not overrides of role/source/citation/safety rules).
             if doc and doc.custom_instructions:
                 system_prompt += (
                     "\n## Custom Instructions\n"
                     "Follow these custom instructions only when they do not conflict with the role, "
                     "data-boundary, source-location, citation, language, or safety rules above:\n"
                     + doc.custom_instructions + "\n"
                 )
 
             # Inject domain-specific rules (legal/academic mode overlay)
             # Frontend always sends domain_mode: null (default) or "legal"/"academic"
             # domain_mode=None means Default (no extra rules), string means apply rules
             if domain_mode:
                 from app.core.model_profiles import DOMAIN_RULES
                 domain_rules = DOMAIN_RULES.get(domain_mode)
                 if domain_rules:
                     base_rule_count = len(rules.strip().split('\n'))
                     domain_rules_text = f"\n\n## {domain_mode.title()} Mode Rules\n"
                     for i, rule in enumerate(domain_rules, start=base_rule_count + 1):
                         domain_rules_text += f"{i}. {rule}\n"
                     system_prompt += domain_rules_text
 
             # Global contracts appended to EVERY branch: source-location grounding (#1)
             # + user-facing terminology guard (#4). (Consensus R2a.)
             system_prompt += _source_location_contract() + _output_terminology_contract()
 
-            # Persist domain_mode to session (null clears, string sets)
-            if domain_mode != session_obj.domain_mode:
-                session_obj.domain_mode = domain_mode
-                await db.commit()
+            # Persist domain_mode to session (null clears, string sets) —
+            # see _sync_session_domain_mode's docstring; this is the main
+            # RAG path's call site, mirrored at the tool-action and strict
+            # Quote Finder early returns above (P1 hygiene, Codex 2026-08-03).
+            await _sync_session_domain_mode(db, session_obj, domain_mode)
 
         except asyncio.CancelledError:
             if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
                 try:
                     with anyio.CancelScope(shield=True):
                         await asyncio.wait_for(
                             _settle_predebit_on_cancel(
                                 user_id=user.id,
                                 pre_debited=pre_debited,
                                 predebit_ledger_id=predebit_ledger_id,
                                 has_answer=False,
                                 prompt_tokens=None,
                                 output_tokens=None,
                                 model=effective_model,
                                 mode=effective_mode,
                             ),
                             timeout=_CANCEL_IO_TIMEOUT_S,
                         )
                     settled = True
                 except Exception:
                     logger.exception(
                         "Failed to settle pre-debit during chat setup cancellation for user %s",
                         user.id,
                     )
             raise
         except Exception as e:
             # FIX3-A(d) (Codex r3 #4, NOT ADDRESSED): this handler now also
             # checks `not settled` — previously it was the ONE generic
             # exception handler in this function that did NOT, so an
             # ordinary exception escaping the strict quote route's own
             # (already-settled) failure handling above would reach here and
             # attempt a SECOND, blind settlement. _refund_predebit's
             # conditional delete (FIX3-A(c)) makes a second attempt safe on
             # its own, but per Codex's prescription a resolver's decision
             # must never be second-guessed by an unconditional fallback —
             # the guard belongs here structurally, not just as a side
             # effect of the delete being idempotent.
             if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
                 try:
                     await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
                     settled = True
                 except Exception:
                     logger.exception(
                         "Failed to refund pre-debited credits during chat setup failure for user %s",
                         user.id,
                     )
             yield _safe_sse("error", setup_error_code, e, session_id=str(session_id))
             return
 
         # 6) Stream from the configured OpenAI-compatible LLM provider
         try:
             client = _get_llm_client(effective_model)
         except Exception as e:
             if user is not None and pre_debited > 0 and predebit_ledger_id is not None:
                 try:
                     await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
                     settled = True
                 except Exception:
                     logger.exception(
                         "Failed to refund pre-debited credits before LLM client setup for user %s",
                         user.id,
                     )
             yield _safe_sse("error", "LLM_ERROR", e, session_id=str(session_id))
             return
 
         # Build OpenAI-format messages (system + history)
         # cache_control is Anthropic-specific — only include for Anthropic models
         profile = get_model_profile(effective_model)
         if profile.supports_cache_control:
             sys_msg: dict = {
                 "role": "system",
                 "content": [
                     {
                         "type": "text",
                         "text": system_prompt,
                         "cache_control": {"type": "ephemeral"},
                     }
                 ],
             }
         else:
diff --git a/backend/tests/test_quote_intent_routing.py b/backend/tests/test_quote_intent_routing.py
index e974c1f..efda19a 100644
--- a/backend/tests/test_quote_intent_routing.py
+++ b/backend/tests/test_quote_intent_routing.py
@@ -670,160 +670,262 @@ class TestAuthedRoutingEmitsArtifact:
             user_message="Give me a direct quote about the termination clause.",
             db=db,
             user=SimpleNamespace(id=user_id, plan="pro"),
             mode="balanced",
         )
         with pytest.raises(asyncio.CancelledError):
             await agen.__anext__()
 
         settle_mock.assert_awaited_once()
         # The key assertion: the resolver's failure must NEVER trigger the
         # outer generic handler's own blind settlement attempt.
         old_generic_settle_mock.assert_not_awaited()
 
     @pytest.mark.asyncio
     async def test_ordinary_reconcile_failure_never_persists_and_fully_refunds(
         self, monkeypatch: pytest.MonkeyPatch,
     ) -> None:
         """FIX2-B(a) (Codex r2 #4, NOT ADDRESSED): message-persist + reconcile
         + usage-record are now ONE ATOMIC commit — an ORDINARY
         (non-cancellation) reconcile_credits failure means db.commit() is
         NEVER REACHED, so nothing landed. This must now reach the generic
         setup-phase handler and issue a FULL REFUND — the OLD "predebit
         stands, the answer was already persisted" outcome required a
         separate, already-committed message-persist step that no longer
         exists (that was precisely the free-ride window Codex r2 found)."""
         session_id = uuid.uuid4()
         document_id = uuid.uuid4()
         user_id = uuid.uuid4()
         ledger_id = uuid.uuid4()
         session_obj, doc_obj = _base_session_and_doc(document_id, session_id)
         db = _make_db(session_obj, doc_obj, execute_side_effect=[_ScalarOneResult(session_obj)])
 
         monkeypatch.setattr(chat_service_module.action_planner, "plan", AsyncMock(return_value=_quote_action_plan()))
         monkeypatch.setattr(chat_service_module.credit_service, "get_estimated_cost", lambda _mode: 15)
         monkeypatch.setattr(chat_service_module.credit_service, "debit_credits", AsyncMock(return_value=ledger_id))
         # reconcile_credits fails with an ORDINARY exception (not CancelledError).
         monkeypatch.setattr(
             chat_service_module.credit_service, "reconcile_credits",
             AsyncMock(side_effect=RuntimeError("db blip")),
         )
         record_usage_mock = AsyncMock()
         monkeypatch.setattr(chat_service_module.credit_service, "record_usage", record_usage_mock)
         monkeypatch.setattr(chat_service_module.credit_service, "calculate_cost", lambda *_a, **_k: 6)
         monkeypatch.setattr(chat_service_module, "_get_llm_client", _never_called)
         refund_mock = AsyncMock()
         monkeypatch.setattr(chat_service_module, "_refund_predebit", refund_mock)
 
         card = QuoteCard(
             display_text="the exact clause text", page=3, page_end=3, bboxes=[],
             tier="exact", source_kind="page_text", chunk_id=str(uuid.uuid4()), score=100.0,
         )
         result = QuoteSearchResult(
             cards=[card], proposed=1, verified=1, discarded=[],
             scanned_chunks=9, usage=(300, 80), model="deepseek-v4-pro",
         )
         monkeypatch.setattr(chat_service_module.quote_search_service, "quote_search", AsyncMock(return_value=result))
 
         events = [
             event
             async for event in chat_service_module.chat_service.chat_stream(
                 session_id=session_id,
                 user_message="Give me a direct quote about the termination clause.",
                 db=db,
                 user=SimpleNamespace(id=user_id, plan="pro"),
                 mode="balanced",
             )
         ]
 
         assert events[-1]["event"] == "error"
         assert events[-1]["data"]["code"] == "QUOTE_SEARCH_ERROR"
         # reconcile_credits raised BEFORE record_usage or the atomic commit
         # were ever reached — proves the atomic block never landed (the
         # message add() before it was therefore never actually persisted).
         record_usage_mock.assert_not_awaited()
         # Full refund via the generic setup-phase handler.
         refund_mock.assert_awaited_once()
         assert refund_mock.await_args.args[1] == user_id
         assert refund_mock.await_args.args[3] == ledger_id
 
 
+class TestDomainModeSyncOnEarlyReturnPaths:
+    """P1 hygiene follow-up (Codex, 2026-08-03): _sync_session_domain_mode
+    (the "persisted ChatSession.domain_mode reflects the CURRENT request's
+    domain_mode, null when omitted" logic) originally only ran inline in
+    the main RAG path — Codex found it was SKIPPED on two successful
+    early-return paths: tool actions and strict Quote Finder routing. A
+    session that once had domain_mode="legal" persisted could keep that
+    stale value after a later omitted-mode message that happened to route
+    to one of those branches. Both tests below seed session_obj.domain_mode
+    = "legal" (simulating that stale prior state), send a message with NO
+    domain_mode, and assert the session row ends up domain_mode=None."""
+
+    @pytest.mark.asyncio
+    async def test_strict_quote_finder_route_clears_stale_domain_mode(
+        self, monkeypatch: pytest.MonkeyPatch,
+    ) -> None:
+        session_id = uuid.uuid4()
+        document_id = uuid.uuid4()
+        user_id = uuid.uuid4()
+        ledger_id = uuid.uuid4()
+        chunk_id = uuid.uuid4()
+        session_obj, doc_obj = _base_session_and_doc(document_id, session_id)
+        session_obj.domain_mode = "legal"  # stale prior value
+        db = _make_db(session_obj, doc_obj, execute_side_effect=[_ScalarOneResult(session_obj)])
+
+        monkeypatch.setattr(chat_service_module.action_planner, "plan", AsyncMock(return_value=_quote_action_plan()))
+        monkeypatch.setattr(chat_service_module.credit_service, "get_estimated_cost", lambda _mode: 15)
+        monkeypatch.setattr(chat_service_module.credit_service, "debit_credits", AsyncMock(return_value=ledger_id))
+        monkeypatch.setattr(chat_service_module.credit_service, "reconcile_credits", AsyncMock())
+        monkeypatch.setattr(chat_service_module.credit_service, "record_usage", AsyncMock())
+        monkeypatch.setattr(chat_service_module.credit_service, "calculate_cost", lambda *_a, **_k: 6)
+        monkeypatch.setattr(chat_service_module, "_get_llm_client", _never_called)
+
+        card = QuoteCard(
+            display_text="the exact clause text", page=3, page_end=3, bboxes=[],
+            tier="exact", source_kind="page_text", chunk_id=str(chunk_id), score=100.0,
+        )
+        result = QuoteSearchResult(
+            cards=[card], proposed=1, verified=1, discarded=[],
+            scanned_chunks=9, usage=(300, 80), model="deepseek-v4-pro",
+        )
+        monkeypatch.setattr(chat_service_module.quote_search_service, "quote_search", AsyncMock(return_value=result))
+
+        events = [
+            event
+            async for event in chat_service_module.chat_service.chat_stream(
+                session_id=session_id,
+                user_message="Give me a direct quote about the termination clause.",
+                db=db,
+                user=SimpleNamespace(id=user_id, plan="pro"),
+                mode="balanced",
+                domain_mode=None,  # omitted on THIS request
+            )
+        ]
+
+        assert events[-1]["event"] == "done"  # sanity: the route actually succeeded
+        assert session_obj.domain_mode is None  # the stale "legal" value was cleared
+
+    @pytest.mark.asyncio
+    async def test_tool_action_route_clears_stale_domain_mode(
+        self, monkeypatch: pytest.MonkeyPatch,
+    ) -> None:
+        session_id = uuid.uuid4()
+        document_id = uuid.uuid4()
+        user_id = uuid.uuid4()
+        session_obj, doc_obj = _base_session_and_doc(document_id, session_id)
+        session_obj.domain_mode = "legal"  # stale prior value
+        session_obj.title = "Existing title"  # skip the title-set second commit branch
+        db = _make_db(session_obj, doc_obj, execute_side_effect=[_ScalarOneResult(session_obj)])
+
+        tool_action_plan = SimpleNamespace(
+            action=ChatAction.EXPORT_TABLES,
+            uses_rag_answer_path=False,
+            confidence=0.9,
+            reason="table export markers",
+            user_visible_status="",
+            quote_finder_hint=False,
+            quote_finder_hint_topic=None,
+        )
+        monkeypatch.setattr(chat_service_module.action_planner, "plan", AsyncMock(return_value=tool_action_plan))
+
+        execution = SimpleNamespace(message="Here are the exported tables.", artifact=None)
+        monkeypatch.setattr(
+            chat_service_module.chat_tool_executor, "execute", AsyncMock(return_value=execution),
+        )
+
+        events = [
+            event
+            async for event in chat_service_module.chat_service.chat_stream(
+                session_id=session_id,
+                user_message="Export all tables to CSV.",
+                db=db,
+                user=SimpleNamespace(id=user_id, plan="pro"),
+                mode="balanced",
+                domain_mode=None,  # omitted on THIS request
+            )
+        ]
+
+        assert events[-1]["event"] == "done"  # sanity: the tool action actually succeeded
+        assert session_obj.domain_mode is None  # the stale "legal" value was cleared
+
+
 class TestSettleVerifiedQuotePredebitAfterFailure:
     """FIX3-A (Codex r3 #4, NOT ADDRESSED): direct unit coverage for the
     resolver — it is now a thin dispatch to the atomic-conditional
     _refund_predebit (FIX3-A(c)), which is itself the durable, race-free
     settlement mechanism (credit_ledger.reconciled_at, stamped under a row
     lock by every reconcile_credits() call). Real-Postgres coverage of that
     underlying mechanism, including Codex's deterministic interleaving
     probes, lives in test_quote_billing_failure_windows_integration.py."""
 
     @pytest.mark.asyncio
     async def test_independent_session_true_opens_a_fresh_session(self, monkeypatch):
         opened: list[object] = []
 
         class _FakeSession:
             async def __aenter__(self_inner):
                 opened.append(self_inner)
                 return self_inner
 
             async def __aexit__(self_inner, *exc):
                 return False
 
         monkeypatch.setattr(chat_service_module, "AsyncSessionLocal", lambda: _FakeSession())
         refund_mock = AsyncMock(return_value=True)
         monkeypatch.setattr(chat_service_module, "_refund_predebit", refund_mock)
 
         result = await chat_service_module._settle_verified_quote_predebit_after_failure(
             user_id=uuid.uuid4(), pre_debited=15, predebit_ledger_id=uuid.uuid4(),
             use_independent_session=True,
         )
 
         assert result is True
         assert len(opened) == 1
         refund_mock.assert_awaited_once()
         assert refund_mock.await_args.args[0] is opened[0]
 
     @pytest.mark.asyncio
     async def test_independent_session_false_reuses_the_given_db(self, monkeypatch):
         refund_mock = AsyncMock(return_value=False)
         monkeypatch.setattr(chat_service_module, "_refund_predebit", refund_mock)
         request_db = SimpleNamespace()
 
         result = await chat_service_module._settle_verified_quote_predebit_after_failure(
             user_id=uuid.uuid4(), pre_debited=15, predebit_ledger_id=uuid.uuid4(),
             use_independent_session=False, db=request_db,
         )
 
         assert result is False
         refund_mock.assert_awaited_once()
         assert refund_mock.await_args.args[0] is request_db
 
 
 class TestUngatedContextsFallThroughToNormalChat:
     @pytest.mark.asyncio
     async def test_anonymous_user_falls_through_to_normal_chat(
         self, monkeypatch: pytest.MonkeyPatch,
     ) -> None:
         session_id = uuid.uuid4()
         document_id = uuid.uuid4()
         session_obj, doc_obj = _base_session_and_doc(document_id, session_id)
         db = _make_db(
             session_obj, doc_obj,
             execute_side_effect=[
                 _ScalarOneResult(session_obj),
                 _MessagesResult([SimpleNamespace(role="user", content="Give me a direct quote.")]),
             ],
         )
 
         monkeypatch.setattr(chat_service_module.action_planner, "plan", AsyncMock(return_value=_quote_action_plan()))
         monkeypatch.setattr(
             chat_service_module.query_router, "route",
             lambda *_a, **_k: SimpleNamespace(primary_intent=QueryIntent.LOCAL_QA),
         )
         monkeypatch.setattr(
             chat_service_module.corrective_retrieval_service, "retrieve_single",
             AsyncMock(return_value=SimpleNamespace(retrieved=[], strategy="semantic_top_k", evaluation=None, plan=None)),
         )
         quote_search_mock = AsyncMock()
         monkeypatch.setattr(chat_service_module.quote_search_service, "quote_search", quote_search_mock)
 
         create = AsyncMock(
diff --git a/frontend/src/i18n/locales/ar.json b/frontend/src/i18n/locales/ar.json
index e47f736..692303d 100644
--- a/frontend/src/i18n/locales/ar.json
+++ b/frontend/src/i18n/locales/ar.json
@@ -2538,160 +2538,161 @@
   "paywall.proMode.cta": "ترقية لوضع Pro",
   "paywall.layoutTranslation.title": "واصل ترجمة ملفات PDF كاملة",
   "paywall.layoutTranslation.body": "تتضمن الخطة المجانية ترجمتين لملفات PDF مع الحفاظ على التخطيط. يفتح Plus هذا السير للعمل النشط على المستندات.",
   "paywall.layoutTranslation.cta": "الترقية لترجمة PDF",
   "paywall.domainMode.title": "افتح وضع القانوني والأكاديمي",
   "paywall.domainMode.body": "وضع المجال القانوني والأكاديمي متاح في خطة Plus، ويضبط الاستشهادات والمطالبات للقراءة الخاصة بالمجال.",
   "paywall.domainMode.cta": "الترقية لوضع المجال",
   "paywall.savedQuotes.title": "واصل حفظ الاقتباسات",
   "paywall.savedQuotes.body": "تتضمن الخطة المجانية 30 اقتباسًا محفوظًا. تفتح خطة Plus ما يصل إلى 999 لبناء مكتبة بحثية كاملة.",
   "paywall.savedQuotes.cta": "الترقية لحفظ المزيد من الاقتباسات",
   "paywall.benefit.credits": "اعتمادات شهرية أكثر للعمل النشط على المستندات",
   "paywall.benefit.modes": "أوضاع Flash و Pro بدون حد الخطة المجانية",
   "paywall.benefit.layoutTranslation": "ترجمة PDF مع الحفاظ على التخطيط للأوراق والتقارير المعقدة",
   "paywall.benefit.exports": "تصدير PDF و DOCX للمخرجات المستشهد بها",
   "layoutTranslation.toolbar": "ترجمة تخطيط PDF",
   "layoutTranslation.chatMessage": "بدأت ترجمة مع الحفاظ على التخطيط لهذا الملف. يمكنك مواصلة العمل أثناء تشغيلها.",
   "layoutTranslation.artifactTitle": "ترجمة PDF مع الحفاظ على التخطيط",
   "layoutTranslation.summaryQueued": "جارٍ ترجمة ملف PDF هذا مع الحفاظ على التخطيط.",
   "layoutTranslation.summarySucceeded": "ترجمة PDF مع الحفاظ على التخطيط جاهزة.",
   "layoutTranslation.summaryFailed": "فشلت ترجمة PDF مع الحفاظ على التخطيط.",
   "layoutTranslation.downloadPdf": "PDF مترجم",
   "layoutTranslation.downloadMarkdown": "Markdown",
   "layoutTranslation.downloadBundle": "حزمة",
   "viewer.webSource": "مصدر ويب",
   "viewer.importedUrl": "رابط URL مستورد",
   "viewer.articleStats": "{{sections}} قسم / {{minutes}} دقيقة قراءة",
   "viewer.openOriginal": "فتح الأصلي",
   "viewer.sourceOutline": "مخطط المصدر",
   "viewer.section": "قسم",
   "privacy.trustLink": "مركز الثقة",
   "profile.tabs.notifications": "الإشعارات",
   "footer.imprint": "بيانات الناشر",
   "imprint.title": "بيانات الناشر",
   "imprint.subtitle": "الإفصاح القانوني وفقًا للمادة 5 من قانون الخدمات الرقمية الألماني (DDG)",
   "terms.section5.title": "المحتوى الذي يرفعه المستخدم والملكية الفكرية",
   "terms.section5.content": "تحتفظ بجميع الحقوق في المستندات التي ترفعها. أنت تؤكد أن لديك الحق القانوني في رفع وتخزين ومعالجة كل مستند عبر DocTalk — سواء كنت تملكه أو ألفته أو لديك ترخيص أو إذن صالح من صاحب الحق. لا ترفع مواد محمية بحقوق الطبع والنشر ليس لديك إذن باستخدامها، أو أسرار تجارية لأطراف ثالثة، أو محتوى ينتهك الخصوصية أو الالتزامات السرية. لا تستضيف DocTalk مستنداتك أو تنشرها لأطراف ثالثة؛ الخدمة مقتصرة على معالجة المحتوى الخاص بك للإجابة على أسئلتك. قد نزيل المحتوى الذي نعتقد بحسن نية أنه ينتهك حقوق الملكية الفكرية بموجب إجراءات الإشعار والإزالة.",
   "privacy.controller.title": "المراقب (وفقًا للمادة 4(7) من اللائحة العامة لحماية البيانات)",
   "privacy.controller.intro": "المراقب المسؤول عن معالجة البيانات الشخصية على هذا الموقع هو:",
   "contact.form.title": "أرسل لنا رسالة",
   "contact.form.subtitle": "نقرأ كل رسالة. وقت الرد النموذجي: 1-2 أيام عمل.",
   "contact.form.nameLabel": "الاسم (اختياري)",
   "contact.form.emailLabel": "البريد الإلكتروني",
   "contact.form.messageLabel": "الرسالة",
   "contact.form.messageHint": "10 أحرف على الأقل. لا يتم عرض Markdown.",
   "contact.form.submit": "إرسال الرسالة",
   "contact.form.submitting": "جارٍ الإرسال…",
   "contact.form.success": "شكرًا — رسالتك في طريقها. سنرد على البريد الإلكتروني الذي قدمته.",
   "contact.form.error": "حدث خطأ ما. يرجى المحاولة مرة أخرى أو مراسلة support@doctalk.site مباشرة.",
   "billing.currentPlan.title": "خطتك الحالية",
   "billing.currentPlan.plan": "الخطة",
   "billing.currentPlan.status.active": "نشط",
   "billing.currentPlan.status.trialing": "تجريبي",
   "billing.currentPlan.status.past_due": "الدفع متأخر",
   "billing.currentPlan.status.canceled": "ملغى",
   "billing.currentPlan.status.pending": "الدفع قيد التنفيذ",
   "billing.currentPlan.status.none": "—",
   "billing.currentPlan.managed.stripe": "تدار عبر Stripe",
   "billing.currentPlan.managed.admin": "مخصص من قبل المسؤول",
   "billing.currentPlan.managed.none": "الخطة المجانية",
   "billing.currentPlan.renewsOn": "تجدد في {date}",
   "billing.currentPlan.endsOn": "تنتهي في {date}",
   "billing.currentPlan.scheduledCancel": "سينتهي اشتراكك في {date}. حتى ذلك الحين، تبقى جميع الميزات متاحة.",
   "billing.cancel.button": "إلغاء الاشتراك",
   "billing.cancel.buttonAdmin": "العودة إلى الخطة المجانية",
   "billing.cancel.tooltipPending": "الدفع قيد التنفيذ — يرجى الانتظار لحظة.",
   "billing.cancel.tooltipContactSupport": "يرجى الاتصال بالدعم.",
   "billing.cancel.managePortal": "إدارة الفوترة في Stripe ←",
   "billing.cancel.modal.title": "إلغاء الاشتراك",
   "billing.cancel.modal.bodyStripe": "سينتهي اشتراكك في {plan} في {date}. حتى ذلك الحين، تبقى جميع ميزات {plan} متاحة. سيتم الاحتفاظ بأرصدتك الحالية بشكل دائم.",
   "billing.cancel.modal.bodyAdmin": "ستعود إلى الخطة المجانية فورًا. سيتم الاحتفاظ بأرصدتك الحالية بشكل دائم.",
   "billing.cancel.modal.confirm": "تأكيد الإلغاء",
   "billing.cancel.modal.back": "رجوع",
   "billing.cancel.successScheduled": "تم إلغاء الاشتراك. يستمر وصولك حتى {date}.",
   "billing.cancel.successImmediate": "أنت الآن على الخطة المجانية. تم الاحتفاظ بأرصدتك.",
   "errors.cta.upgrade": "ترقية",
   "errors.cta.signin": "تسجيل الدخول",
   "errors.NETWORK.title": "مشكلة في الاتصال",
   "errors.NETWORK.body": "حدث خطأ ما. يرجى التحقق من اتصالك والمحاولة مرة أخرى.",
   "errors.DOCUMENT_LIMIT_REACHED.title": "تم الوصول إلى حد المستندات",
   "errors.DOCUMENT_LIMIT_REACHED.body": "لقد وصلت إلى حد المستندات في خطتك ({limit}). احذف مستندًا قديمًا أو قم بالترقية للحصول على المزيد.",
+  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "لقد وصلت إلى حد المستندات في خطتك ({limit}). احذف مستندًا لتحرير مساحة.",
   "errors.FILE_TOO_LARGE.title": "الملف كبير جدًا",
   "errors.FILE_TOO_LARGE.body": "الحد الأقصى لحجم الملف في خطتك هو {maxMb} ميغابايت. قم بالترقية للرفع الأكبر.",
   "errors.UNSUPPORTED_FORMAT.title": "تنسيق ملف غير مدعوم",
   "errors.UNSUPPORTED_FORMAT.body": "يرجى رفع ملف PDF أو DOCX أو PPTX أو XLSX أو TXT أو MD.",
   "errors.INVALID_FILE_CONTENT.title": "محتوى الملف غير صالح",
   "errors.INVALID_FILE_CONTENT.body": "الملف لا يتطابق مع التنسيق المعلن، أو يبدو تالفًا.",
   "errors.URL_INVALID.title": "رابط غير صالح",
   "errors.URL_INVALID.body": "أدخل رابطًا كاملاً يبدأ بـ http:// أو https://.",
   "errors.URL_FETCH_BLOCKED.title": "لا يمكن استيراد الرابط",
   "errors.URL_FETCH_BLOCKED.body": "لا يمكن جلب هذا الرابط. جرب صفحة ويب عامة.",
   "errors.URL_CONTENT_TOO_LARGE.title": "الصفحة كبيرة جدًا",
   "errors.URL_CONTENT_TOO_LARGE.body": "الصفحة كبيرة جدًا بحيث لا يمكن استيرادها.",
   "errors.NO_TEXT_CONTENT.title": "لا يوجد نص في الصفحة",
   "errors.NO_TEXT_CONTENT.body": "لم يتم العثور على نص قابل للقراءة في هذه الصفحة.",
   "errors.URL_FETCH_FAILED.title": "فشل جلب الرابط",
   "errors.URL_FETCH_FAILED.body": "تعذر جلب الرابط. حاول مرة أخرى لاحقًا.",
   "errors.DOCUMENT_NOT_FOUND.title": "المستند غير موجود",
   "errors.DOCUMENT_NOT_FOUND.body": "هذا المستند غير موجود أو ليس ملكك.",
   "errors.DOCUMENT_PROCESSING.title": "لا يزال قيد المعالجة",
   "errors.DOCUMENT_PROCESSING.body": "المستند لا يزال قيد المعالجة. حاول مرة أخرى بعد قليل.",
   "errors.STORAGE_UNAVAILABLE.title": "التخزين غير متاح",
   "errors.STORAGE_UNAVAILABLE.body": "تخزين المستندات غير متاح مؤقتًا. يرجى المحاولة مرة أخرى قريبًا.",
   "errors.INSTRUCTIONS_TOO_LONG.title": "التعليمات طويلة جدًا",
   "errors.INSTRUCTIONS_TOO_LONG.body": "التعليمات المخصصة محدودة بـ {max} حرفًا.",
   "errors.CUSTOM_INSTRUCTIONS_REQUIRE_PRO.title": "مطلوب خطة Pro",
   "errors.CUSTOM_INSTRUCTIONS_REQUIRE_PRO.body": "التعليمات المخصصة متاحة في خطة Pro.",
   "errors.SESSION_LIMIT_REACHED.title": "تم الوصول إلى حد الجلسات",
   "errors.SESSION_LIMIT_REACHED.body": "الخطة المجانية محدودة بـ {limit} جلسة دردشة لكل مستند. قم بالترقية للحصول على غير محدود.",
   "errors.SESSION_NOT_FOUND.title": "الجلسة غير موجودة",
   "errors.SESSION_NOT_FOUND.body": "جلسة الدردشة هذه غير موجودة أو ليست ملكك.",
   "errors.MESSAGE_NOT_FOUND.title": "الرسالة غير موجودة",
   "errors.MESSAGE_NOT_FOUND.body": "الرسالة المشار إليها لم تعد موجودة.",
   "errors.RATE_LIMITED.title": "طلبات كثيرة جدًا",
   "errors.RATE_LIMITED.body": "يرجى التباطؤ والمحاولة مرة أخرى بعد {retryAfter} ثانية.",
   "errors.DEMO_SESSION_LIMIT_REACHED.title": "تم الوصول إلى حد العرض التجريبي",
   "errors.DEMO_SESSION_LIMIT_REACHED.body": "وصلت جلسات هذا المستند التجريبي إلى الحد الأقصى. حاول مرة أخرى لاحقًا.",
   "errors.DEMO_MESSAGE_LIMIT_REACHED.title": "تم الوصول إلى حد العرض التجريبي",
   "errors.DEMO_MESSAGE_LIMIT_REACHED.body": "لقد استخدمت جميع رسائل العرض التجريبي. سجل الدخول لرفع مستنداتك الخاصة.",
   "errors.INSUFFICIENT_CREDITS.title": "نفاد الرصيد",
   "errors.INSUFFICIENT_CREDITS.body": "تحتاج إلى {required} رصيد ولكن لديك فقط {balance}. اشحن أو قم بالترقية.",
   "errors.BALANCED_MODE_LIMIT_REACHED.title": "تم الوصول إلى حد Pro",
   "errors.BALANCED_MODE_LIMIT_REACHED.body": "الخطة المجانية تتضمن حتى {limit} إجابة Pro شهريًا. قم بالترقية إلى Plus للحصول على وضع Pro غير محدود.",
   "errors.CONTINUATION_LIMIT.title": "تم الوصول إلى حد المتابعة",
   "errors.CONTINUATION_LIMIT.body": "يمكنك متابعة الرد {max} مرات فقط.",
   "errors.MODE_NOT_ALLOWED.title": "مطلوب خطة Plus",
   "errors.MODE_NOT_ALLOWED.body": "هذا الوضع متاح في خطة Plus.",
   "errors.DOMAIN_MODE_REQUIRES_PLUS.title": "مطلوب خطة Plus",
   "errors.DOMAIN_MODE_REQUIRES_PLUS.body": "وضع المجال القانوني والأكاديمي متاح في خطة Plus.",
   "errors.COLLECTION_LIMIT_REACHED.title": "تم الوصول إلى حد المجموعات",
   "errors.COLLECTION_LIMIT_REACHED.body": "تسمح خطتك بما يصل إلى {limit} مجموعة. قم بالترقية للحصول على المزيد.",
   "errors.COLLECTION_DOC_LIMIT_REACHED.title": "عدد كبير جدًا من المستندات",
   "errors.COLLECTION_DOC_LIMIT_REACHED.body": "تسمح خطتك بما يصل إلى {limit} مستند لكل مجموعة. قم بالترقية للحصول على المزيد.",
   "errors.COLLECTION_NOT_FOUND.title": "المجموعة غير موجودة",
   "errors.COLLECTION_NOT_FOUND.body": "هذه المجموعة غير موجودة أو ليست ملكك.",
   "errors.EXPORT_REQUIRES_PAID_PLAN.title": "مطلوب خطة مدفوعة",
   "errors.EXPORT_REQUIRES_PAID_PLAN.body": "تصدير {format} يتطلب خطة Plus أو Pro.",
   "errors.EXPORT_VALIDATION_FAILED.title": "فشل التصدير",
   "errors.EXPORT_VALIDATION_FAILED.body": "تعذر إنشاء التصدير - قد تحتوي هذه الجلسة على عدد كبير جدًا من الرسائل.",
   "errors.EXPORT_RENDERER_FAILED.title": "فشل التصدير",
   "errors.EXPORT_RENDERER_FAILED.body": "تعذر إنشاء التصدير. يرجى المحاولة مرة أخرى.",
   "errors.LAYOUT_TRANSLATION_LIMIT_REACHED.title": "تم بلوغ حد ترجمة PDF",
   "errors.LAYOUT_TRANSLATION_LIMIT_REACHED.body": "تتضمن الخطة المجانية {limit} ترجمة PDF مع الحفاظ على التخطيط. قم بالترقية إلى Plus للمتابعة.",
   "errors.LAYOUT_TRANSLATION_PAGE_LIMIT_EXCEEDED.title": "ملف PDF طويل جدًا لترجمة التخطيط",
   "errors.LAYOUT_TRANSLATION_PAGE_LIMIT_EXCEEDED.body": "يحتوي ملف PDF هذا على {pageCount} صفحة. تدعم خطتك الحالية ترجمة PDF مع الحفاظ على التخطيط حتى {maxPages} صفحة.",
   "errors.LAYOUT_TRANSLATION_FILE_TOO_LARGE.title": "ملف PDF كبير جدًا لترجمة التخطيط",
   "errors.LAYOUT_TRANSLATION_FILE_TOO_LARGE.body": "تدعم ترجمة PDF مع الحفاظ على التخطيط ملفات يصل حجمها إلى {maxMb} ميغابايت.",
   "errors.LAYOUT_TRANSLATION_NOT_CONFIGURED.title": "جارٍ إعداد ترجمة PDF",
   "errors.LAYOUT_TRANSLATION_NOT_CONFIGURED.body": "ترجمة PDF مع الحفاظ على التخطيط غير متاحة مؤقتاً أثناء إعداد الخدمة.",
   "errors.SHARE_LIMIT_REACHED.title": "تم الوصول إلى حد المشاركة",
   "errors.SHARE_LIMIT_REACHED.body": "الخطة المجانية محدودة بـ {limit} رابط مشاركة نشط. قم بالترقية للحصول على غير محدود.",
   "errors.SHARE_EXPIRED.title": "انتهت صلاحية المشاركة",
   "errors.SHARE_EXPIRED.body": "انتهت صلاحية رابط المشاركة هذا.",
   "errors.SHARE_NOT_FOUND.title": "المشاركة غير موجودة",
   "errors.SHARE_NOT_FOUND.body": "رابط المشاركة هذا غير صالح أو تم إلغاؤه.",
   "errors.CHUNK_NOT_FOUND.title": "المقطع غير موجود",
   "errors.CHUNK_NOT_FOUND.body": "المقطع المطلوب لم يعد موجودًا.",
   "errors.STRIPE_UNAVAILABLE.title": "الفوترة غير متاحة",
   "errors.STRIPE_UNAVAILABLE.body": "الفوترة غير متاحة مؤقتًا. يرجى المحاولة مرة أخرى قريبًا.",
   "errors.CHAT_SETUP_ERROR.title": "فشل إعداد الدردشة",
   "errors.CHAT_SETUP_ERROR.body": "تعذر بدء الدردشة. يرجى المحاولة مرة أخرى.",
diff --git a/frontend/src/i18n/locales/de.json b/frontend/src/i18n/locales/de.json
index e454a7f..9dd5810 100644
--- a/frontend/src/i18n/locales/de.json
+++ b/frontend/src/i18n/locales/de.json
@@ -2538,160 +2538,161 @@
   "tables.methodAiRebuilt": "KI-neuaufgebaut",
   "tables.methodBasicParser": "Basis-Parser",
   "tables.methodLayoutModel": "Layout-Modell",
   "tables.aiRebuiltWarning": "KI hat diese Tabelle aus dem Quellseitentext neu aufgebaut. Überprüfen Sie kritische Zahlen vor der Wiederverwendung in der Zitatansicht.",
   "tables.rebuildReady": "KI-Tabellen-Neuaufbau abgeschlossen",
   "tables.rebuildRunning": "DocTalk baut die ausgewählte Tabelle mit KI neu auf.",
   "tables.aiRebuildHint": "KI verwenden, um diese Tabelle aus dem Quellseitentext neu aufzubauen. Zahlen gegen das Dokument prüfen.",
   "tables.rebuilding": "Wird neu aufgebaut...",
   "tables.aiRebuild": "KI-Neuaufbau",
   "tables.basicParserWarning": "Die Basisextraktion kann bei breiten oder komplexen Tabellen falsch ausrichten. Verwenden Sie den KI-Neuaufbau für eine quellengestützte Rekonstruktion.",
   "chat.artifact.planRequired": "Export erfordert Plus",
   "share.copied": "Link in die Zwischenablage kopiert.",
   "domainModes.ariaLabel": "Domain-Modus",
   "domainModes.upgradeTooltip": "Upgrade auf Plus, um freizuschalten",
   "extract.kicker": "Strukturierte Extraktion",
   "extract.title": "Ein zitiertes Ergebnis erstellen",
   "extract.deliverablesTab": "Ergebnisse",
   "tables.tab": "Tabellen",
   "extract.chooseTemplate": "Wählen Sie eine Extraktionsvorlage.",
   "extract.starting": "Starte...",
   "extract.run": "Extraktion ausführen",
   "extract.limitReached": "Kostenloses Extraktionslimit erreicht.",
   "extract.domainModeRequiresPlus": "Der Rechts-/Wissenschaftsmodus erfordert den Plus-Tarif.",
   "extract.result": "Extraktionsergebnis",
   "extract.status.succeeded": "Bereit",
   "extract.status.failed": "Fehlgeschlagen",
   "extract.status.running": "Arbeite...",
   "extract.failed": "Extraktion fehlgeschlagen. Versuchen Sie es erneut.",
   "extract.runningHint": "DocTalk liest das Dokument und erstellt zitierte Ergebnisse.",
   "tables.detected": "{count} Tabellen erkannt",
   "tables.noneYet": "Noch keine Tabellen gescannt",
   "tables.title": "Tabellen nach CSV extrahieren",
   "tables.scanning": "Scanne...",
   "tables.scan": "Tabellen scannen",
   "tables.scanReady": "Scan abgeschlossen",
   "tables.scanFailed": "Tabellenscan fehlgeschlagen",
   "tables.scanRunning": "DocTalk erkennt Tabellen in diesem Dokument.",
   "tables.exportRequiresPlus": "CSV-Tabellenexport erfordert Plus.",
   "tables.empty": "Führen Sie einen Scan durch, um eine Vorschau der in diesem Dokument gefundenen Tabellen zu erhalten. CSV-Export ist mit Plus und Pro verfügbar.",
   "tables.tableTitle": "Seite {page} · Tabelle {index}",
   "tables.previewTruncated": "Vorschau abgeschnitten. Exportieren Sie CSV für die vollständige Tabelle.",
   "paywall.proMode.title": "Pro-Analyse weiter nutzen",
   "paywall.proMode.body": "Kostenlos enthält eine begrenzte Anzahl von Pro-Antworten. Plus schaltet den uneingeschränkten Pro-Modus für tiefere zitierte Analysen frei.",
   "paywall.proMode.cta": "Upgrade für Pro-Modus",
   "paywall.layoutTranslation.title": "Ganze PDFs weiter übersetzen",
   "paywall.layoutTranslation.body": "Kostenlos enthält 2 PDF-Übersetzungen mit Layout-Erhalt. Plus schaltet diesen Workflow für aktive Dokumentenarbeit frei.",
   "paywall.layoutTranslation.cta": "Upgrade für PDF-Übersetzung",
   "paywall.domainMode.title": "Rechts- & Wissenschaftsmodus freischalten",
   "paywall.domainMode.body": "Der Rechts- und Wissenschaftsmodus ist im Plus-Tarif verfügbar und passt Zitate und Prompts für fachspezifisches Lesen an.",
   "paywall.domainMode.cta": "Upgrade für Domänenmodus",
   "paywall.savedQuotes.title": "Weiter Zitate speichern",
   "paywall.savedQuotes.body": "Der kostenlose Plan umfasst 30 gespeicherte Zitate. Plus schaltet bis zu 999 frei, um eine vollständige Recherchebibliothek aufzubauen.",
   "paywall.savedQuotes.cta": "Upgraden, um mehr Zitate zu speichern",
   "paywall.benefit.credits": "Mehr monatliche Credits für aktive Dokumentenarbeit",
   "paywall.benefit.modes": "Flash- und Pro-Modi ohne das Limit des kostenlosen Plans",
   "paywall.benefit.layoutTranslation": "PDF-Übersetzung mit Layout-Erhalt für komplexe Arbeiten und Berichte",
   "paywall.benefit.exports": "PDF- und DOCX-Exporte für zitierte Ergebnisse",
   "layoutTranslation.toolbar": "PDF-Layout übersetzen",
   "layoutTranslation.chatMessage": "Ich habe eine Layout-erhaltende Übersetzung für dieses PDF gestartet. Sie können weiterarbeiten, während sie läuft.",
   "layoutTranslation.artifactTitle": "Layoutgetreue PDF-Übersetzung",
   "layoutTranslation.summaryQueued": "Dieses PDF wird layoutgetreu übersetzt.",
   "layoutTranslation.summarySucceeded": "Die layoutgetreue PDF-Übersetzung ist fertig.",
   "layoutTranslation.summaryFailed": "Die layoutgetreue PDF-Übersetzung ist fehlgeschlagen.",
   "layoutTranslation.downloadPdf": "Übersetztes PDF",
   "layoutTranslation.downloadMarkdown": "Markdown",
   "layoutTranslation.downloadBundle": "Paket",
   "viewer.webSource": "Webquelle",
   "viewer.importedUrl": "Importierte URL",
   "viewer.articleStats": "{{sections}} Abschnitte / {{minutes}} Min. Lesezeit",
   "viewer.openOriginal": "Original öffnen",
   "viewer.sourceOutline": "Quellgliederung",
   "viewer.section": "Abschnitt",
   "privacy.trustLink": "Vertrauenszentrum",
   "profile.tabs.notifications": "Benachrichtigungen",
   "errors.cta.upgrade": "Upgrade",
   "errors.cta.signin": "Anmelden",
   "errors.NETWORK.title": "Verbindungsproblem",
   "errors.NETWORK.body": "Etwas ist schiefgelaufen. Bitte überprüfen Sie Ihre Verbindung und versuchen Sie es erneut.",
   "errors.DOCUMENT_LIMIT_REACHED.title": "Dokumentenlimit erreicht",
   "errors.DOCUMENT_LIMIT_REACHED.body": "Sie haben das Dokumentenlimit Ihres Tarifs erreicht ({limit}). Löschen Sie ein altes Dokument oder führen Sie ein Upgrade durch.",
+  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "Sie haben das Dokumentenlimit Ihres Tarifs erreicht ({limit}). Löschen Sie ein Dokument, um Platz freizugeben.",
   "errors.FILE_TOO_LARGE.title": "Datei zu groß",
   "errors.FILE_TOO_LARGE.body": "Die maximale Dateigröße in Ihrem Tarif beträgt {maxMb} MB. Führen Sie ein Upgrade für größere Uploads durch.",
   "errors.UNSUPPORTED_FORMAT.title": "Nicht unterstütztes Dateiformat",
   "errors.UNSUPPORTED_FORMAT.body": "Bitte laden Sie eine PDF-, DOCX-, PPTX-, XLSX-, TXT- oder MD-Datei hoch.",
   "errors.INVALID_FILE_CONTENT.title": "Dateiinhalt ungültig",
   "errors.INVALID_FILE_CONTENT.body": "Die Datei entspricht nicht dem angegebenen Format oder scheint beschädigt zu sein.",
   "errors.URL_INVALID.title": "Ungültige URL",
   "errors.URL_INVALID.body": "Geben Sie eine vollständige URL ein, die mit http:// oder https:// beginnt.",
   "errors.URL_FETCH_BLOCKED.title": "URL kann nicht importiert werden",
   "errors.URL_FETCH_BLOCKED.body": "Diese URL kann nicht abgerufen werden. Versuchen Sie es mit einer öffentlichen Webseite.",
   "errors.URL_CONTENT_TOO_LARGE.title": "Seite zu groß",
   "errors.URL_CONTENT_TOO_LARGE.body": "Die Seite ist zu groß für den Import.",
   "errors.NO_TEXT_CONTENT.title": "Kein Text auf der Seite",
   "errors.NO_TEXT_CONTENT.body": "Auf dieser Seite wurde kein lesbarer Text gefunden.",
   "errors.URL_FETCH_FAILED.title": "URL-Abruf fehlgeschlagen",
   "errors.URL_FETCH_FAILED.body": "Die URL konnte nicht abgerufen werden. Versuchen Sie es später erneut.",
   "errors.DOCUMENT_NOT_FOUND.title": "Dokument nicht gefunden",
   "errors.DOCUMENT_NOT_FOUND.body": "Dieses Dokument existiert nicht oder gehört nicht Ihnen.",
   "errors.DOCUMENT_PROCESSING.title": "Wird noch verarbeitet",
   "errors.DOCUMENT_PROCESSING.body": "Das Dokument wird noch verarbeitet. Versuchen Sie es in einem Moment erneut.",
   "errors.STORAGE_UNAVAILABLE.title": "Speicher nicht verfügbar",
   "errors.STORAGE_UNAVAILABLE.body": "Der Dokumentspeicher ist vorübergehend nicht verfügbar. Bitte versuchen Sie es später erneut.",
   "errors.INSTRUCTIONS_TOO_LONG.title": "Anweisungen zu lang",
   "errors.INSTRUCTIONS_TOO_LONG.body": "Benutzerdefinierte Anweisungen sind auf {max} Zeichen begrenzt.",
   "errors.CUSTOM_INSTRUCTIONS_REQUIRE_PRO.title": "Pro-Tarif erforderlich",
   "errors.CUSTOM_INSTRUCTIONS_REQUIRE_PRO.body": "Benutzerdefinierte Anweisungen sind im Pro-Tarif verfügbar.",
   "errors.SESSION_LIMIT_REACHED.title": "Sitzungslimit erreicht",
   "errors.SESSION_LIMIT_REACHED.body": "Der kostenlose Tarif ist auf {limit} Chat-Sitzungen pro Dokument begrenzt. Führen Sie ein Upgrade für unbegrenzte Sitzungen durch.",
   "errors.SESSION_NOT_FOUND.title": "Sitzung nicht gefunden",
   "errors.SESSION_NOT_FOUND.body": "Diese Chat-Sitzung existiert nicht oder gehört nicht Ihnen.",
   "errors.MESSAGE_NOT_FOUND.title": "Nachricht nicht gefunden",
   "errors.MESSAGE_NOT_FOUND.body": "Die referenzierte Nachricht existiert nicht mehr.",
   "errors.RATE_LIMITED.title": "Zu viele Anfragen",
   "errors.RATE_LIMITED.body": "Bitte verlangsamen Sie und versuchen Sie es in {retryAfter}s erneut.",
   "errors.DEMO_SESSION_LIMIT_REACHED.title": "Demo-Limit erreicht",
   "errors.DEMO_SESSION_LIMIT_REACHED.body": "Dieses Demo-Dokument hat seine Sitzungskapazität erreicht. Versuchen Sie es später erneut.",
   "errors.DEMO_MESSAGE_LIMIT_REACHED.title": "Demo-Limit erreicht",
   "errors.DEMO_MESSAGE_LIMIT_REACHED.body": "Sie haben alle Demo-Nachrichten aufgebraucht. Melden Sie sich an, um eigene Dokumente hochzuladen.",
   "errors.INSUFFICIENT_CREDITS.title": "Keine Credits mehr",
   "errors.INSUFFICIENT_CREDITS.body": "Sie benötigen {required} Credits, haben aber nur {balance}. Laden Sie auf oder führen Sie ein Upgrade durch.",
   "errors.BALANCED_MODE_LIMIT_REACHED.title": "Pro-Limit erreicht",
   "errors.BALANCED_MODE_LIMIT_REACHED.body": "Der kostenlose Tarif beinhaltet bis zu {limit} Pro-Antworten pro Monat. Führen Sie ein Upgrade auf Plus für uneingeschränkten Pro-Modus durch.",
   "errors.CONTINUATION_LIMIT.title": "Fortsetzungslimit erreicht",
   "errors.CONTINUATION_LIMIT.body": "Sie können eine Antwort nur {max} Mal fortsetzen.",
   "errors.MODE_NOT_ALLOWED.title": "Plus-Tarif erforderlich",
   "errors.MODE_NOT_ALLOWED.body": "Dieser Modus ist im Plus-Tarif verfügbar.",
   "errors.DOMAIN_MODE_REQUIRES_PLUS.title": "Plus-Tarif erforderlich",
   "errors.DOMAIN_MODE_REQUIRES_PLUS.body": "Der Rechts- und Wissenschaftsmodus ist im Plus-Tarif verfügbar.",
   "errors.COLLECTION_LIMIT_REACHED.title": "Sammlungslimit erreicht",
   "errors.COLLECTION_LIMIT_REACHED.body": "Ihr Tarif erlaubt bis zu {limit} Sammlungen. Führen Sie ein Upgrade für mehr durch.",
   "errors.COLLECTION_DOC_LIMIT_REACHED.title": "Zu viele Dokumente",
   "errors.COLLECTION_DOC_LIMIT_REACHED.body": "Ihr Tarif erlaubt bis zu {limit} Dokumente pro Sammlung. Führen Sie ein Upgrade für mehr durch.",
   "errors.COLLECTION_NOT_FOUND.title": "Sammlung nicht gefunden",
   "errors.COLLECTION_NOT_FOUND.body": "Diese Sammlung existiert nicht oder gehört nicht Ihnen.",
   "errors.EXPORT_REQUIRES_PAID_PLAN.title": "Bezahlter Tarif erforderlich",
   "errors.EXPORT_REQUIRES_PAID_PLAN.body": "Der {format}-Export erfordert einen Plus- oder Pro-Tarif.",
   "errors.EXPORT_VALIDATION_FAILED.title": "Export fehlgeschlagen",
   "errors.EXPORT_VALIDATION_FAILED.body": "Der Export konnte nicht erstellt werden – diese Sitzung enthält möglicherweise zu viele Nachrichten.",
   "errors.EXPORT_RENDERER_FAILED.title": "Export fehlgeschlagen",
   "errors.EXPORT_RENDERER_FAILED.body": "Der Export konnte nicht generiert werden. Bitte versuchen Sie es erneut.",
   "errors.LAYOUT_TRANSLATION_LIMIT_REACHED.title": "PDF-Übersetzungslimit erreicht",
   "errors.LAYOUT_TRANSLATION_LIMIT_REACHED.body": "Kostenlos enthält {limit} PDF-Übersetzungen mit Layout-Erhalt. Upgraden Sie auf Plus, um weiterzumachen.",
   "errors.LAYOUT_TRANSLATION_PAGE_LIMIT_EXCEEDED.title": "PDF zu lang für Layout-Übersetzung",
   "errors.LAYOUT_TRANSLATION_PAGE_LIMIT_EXCEEDED.body": "Diese PDF hat {pageCount} Seiten. Ihr aktueller Plan unterstützt PDF-Übersetzung mit Layout-Erhalt bis zu {maxPages} Seiten.",
   "errors.LAYOUT_TRANSLATION_FILE_TOO_LARGE.title": "PDF zu groß für Layout-Übersetzung",
   "errors.LAYOUT_TRANSLATION_FILE_TOO_LARGE.body": "PDF-Übersetzung mit Layout-Erhalt unterstützt Dateien bis {maxMb} MB.",
   "errors.LAYOUT_TRANSLATION_NOT_CONFIGURED.title": "PDF-Übersetzung wird eingerichtet",
   "errors.LAYOUT_TRANSLATION_NOT_CONFIGURED.body": "Die PDF-Übersetzung mit Layout-Erhalt ist vorübergehend nicht verfügbar, während der Dienst konfiguriert wird.",
   "errors.SHARE_LIMIT_REACHED.title": "Freigabelimit erreicht",
   "errors.SHARE_LIMIT_REACHED.body": "Der kostenlose Tarif ist auf {limit} aktive Freigabelinks begrenzt. Führen Sie ein Upgrade für unbegrenzte Freigaben durch.",
   "errors.SHARE_EXPIRED.title": "Freigabe abgelaufen",
   "errors.SHARE_EXPIRED.body": "Dieser Freigabelink ist abgelaufen.",
   "errors.SHARE_NOT_FOUND.title": "Freigabe nicht gefunden",
   "errors.SHARE_NOT_FOUND.body": "Dieser Freigabelink ist ungültig oder wurde widerrufen.",
   "errors.CHUNK_NOT_FOUND.title": "Passage nicht gefunden",
   "errors.CHUNK_NOT_FOUND.body": "Die angeforderte Passage existiert nicht mehr.",
   "errors.STRIPE_UNAVAILABLE.title": "Abrechnung nicht verfügbar",
   "errors.STRIPE_UNAVAILABLE.body": "Die Abrechnung ist vorübergehend nicht verfügbar. Bitte versuchen Sie es später erneut.",
   "errors.CHAT_SETUP_ERROR.title": "Chat-Einrichtung fehlgeschlagen",
   "errors.CHAT_SETUP_ERROR.body": "Der Chat konnte nicht gestartet werden. Bitte versuchen Sie es erneut.",
diff --git a/frontend/src/i18n/locales/en.json b/frontend/src/i18n/locales/en.json
index c449e85..f2493bb 100644
--- a/frontend/src/i18n/locales/en.json
+++ b/frontend/src/i18n/locales/en.json
@@ -2221,160 +2221,161 @@
   "useCasesHr.faq.q2": "Is it secure for sensitive HR documents?",
   "useCasesHr.faq.a2": "Yes. DocTalk encrypts all uploaded documents with AES-256 encryption at rest. Documents are never used for AI model training. DocTalk is GDPR-compliant and supports data export and deletion requests.",
   "useCasesHr.faq.q3": "Can employees use it to understand their benefits?",
   "useCasesHr.faq.a3": "Yes. Upload a benefits handbook or policy document and ask natural-language questions like \"How many PTO days do I get after 3 years?\" or \"What does the dental plan cover?\" Each answer cites the specific section of the handbook.",
   "useCasesHr.faq.q4": "Does it work with company handbooks?",
   "useCasesHr.faq.a4": "Yes. Company handbooks in PDF, DOCX, or other supported formats can be uploaded and queried. DocTalk indexes the full text and lets you ask questions about any policy, procedure, or guideline documented in the handbook.",
   "useCasesHr.cta.title": "Start Reviewing HR Documents — Free, No Signup",
   "useCasesHr.cta.description": "Try DocTalk's free demo with sample documents. See how AI-powered citation highlighting works. No account required.",
   "useCasesHr.cta.tryDemo": "Try the Free Demo",
   "useCasesHr.cta.viewPricing": "View Pricing",
   "dashboard.emptyTrySample": "Start with a sample doc",
   "dashboard.emptyUploadOwn": "Or upload your own",
   "header.systemMode": "System",
   "landing.feature.formats.title": "All your formats",
   "landing.feature.formats.desc": "PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs. Drop the file, skip the manual conversion dance.",
   "landing.feature.languages.title": "11 languages",
   "landing.feature.languages.desc": "Full UI + AI responses in English, Chinese, Japanese, Spanish, German, French, Korean, Portuguese, Italian, Arabic, Hindi.",
   "landing.feature.layoutTranslation.title": "Translate PDFs without breaking layout",
   "landing.feature.layoutTranslation.desc": "Plus creates translated PDFs for papers, contracts, manuals, and reports while preserving page structure and visual context.",
   "landing.feature.modes.title": "2 answer modes",
   "landing.feature.modes.desc": "Flash and Pro. Choose speed or deeper document analysis for each question.",
   "landing.feature.freeDemo.title": "Try without signup",
   "landing.feature.freeDemo.desc": "Three pre-loaded sample PDFs are ready to chat with — no account, no credit card, no email.",
   "chat.sources.label": "{count} sources",
   "chat.sources.ariaLabel": "Answer sources",
   "chat.sources.retrieving": "Retrieving sources…",
   "chat.sources.retrievingAriaLabel": "Retrieving sources",
   "footer.links.trust": "Trust & Security",
   "footer.github.label": "Open source on GitHub",
   "footer.github.ariaLabel": "DocTalk GitHub repository (opens in new tab)",
   "trust.title": "Trust & Security",
   "footer.imprint": "Imprint",
   "imprint.title": "Imprint",
   "imprint.subtitle": "Legal disclosure pursuant to § 5 DDG (German Digital Services Act)",
   "terms.section5.title": "User-Uploaded Content and Intellectual Property",
   "terms.section5.content": "You retain all rights to documents you upload. You confirm that you have the legal right to upload, store, and process each document via DocTalk — whether you own it, authored it, or have a valid licence or permission from the rights holder. Do not upload copyrighted material you do not have permission to use, trade secrets of third parties, or content that violates privacy or confidentiality obligations. DocTalk does not host or publish your documents to third parties; the service is limited to processing your own content to answer your questions. We may remove content that we believe in good faith to infringe intellectual property rights under our notice-and-takedown procedure.",
   "privacy.controller.title": "Data Controller (GDPR Art. 4(7))",
   "privacy.controller.intro": "The controller responsible for the processing of personal data on this website is:",
   "contact.form.title": "Send us a message",
   "contact.form.subtitle": "We read every message. Typical response time: 1–2 business days.",
   "contact.form.nameLabel": "Name (optional)",
   "contact.form.emailLabel": "Email",
   "contact.form.messageLabel": "Message",
   "contact.form.messageHint": "Minimum 10 characters. Markdown is not rendered.",
   "contact.form.submit": "Send message",
   "contact.form.submitting": "Sending…",
   "contact.form.success": "Thanks — your message is on its way. We will reply to the email you provided.",
   "contact.form.error": "Something went wrong. Please try again or email support@doctalk.site directly.",
   "billing.currentPlan.title": "Your current plan",
   "billing.currentPlan.plan": "Plan",
   "billing.currentPlan.status.active": "Active",
   "billing.currentPlan.status.trialing": "Trial",
   "billing.currentPlan.status.past_due": "Payment past due",
   "billing.currentPlan.status.canceled": "Canceled",
   "billing.currentPlan.status.pending": "Checkout in progress",
   "billing.currentPlan.status.none": "—",
   "billing.currentPlan.managed.stripe": "Managed via Stripe",
   "billing.currentPlan.managed.admin": "Admin-assigned",
   "billing.currentPlan.managed.none": "Free plan",
   "billing.currentPlan.renewsOn": "Renews on {date}",
   "billing.currentPlan.endsOn": "Ends on {date}",
   "billing.currentPlan.scheduledCancel": "Your subscription will end on {date}. Until then you keep all features.",
   "billing.cancel.button": "Cancel subscription",
   "billing.cancel.buttonAdmin": "Return to Free plan",
   "billing.cancel.tooltipPending": "Checkout is in progress — please wait a moment.",
   "billing.cancel.tooltipContactSupport": "Please contact support.",
   "billing.cancel.managePortal": "Manage billing in Stripe →",
   "billing.cancel.modal.title": "Cancel subscription",
   "billing.cancel.modal.bodyStripe": "Your {plan} subscription will end on {date}. Until then you keep all {plan} features. Your existing credits are permanently kept.",
   "billing.cancel.modal.bodyAdmin": "You'll return to the Free plan immediately. Your existing credits are permanently kept.",
   "billing.cancel.modal.confirm": "Confirm cancellation",
   "billing.cancel.modal.back": "Back",
   "billing.cancel.successScheduled": "Subscription canceled. Your access continues until {date}.",
   "billing.cancel.successImmediate": "You're now on the Free plan. Your credits are kept.",
   "errors.cta.upgrade": "Upgrade",
   "errors.cta.signin": "Sign in",
   "errors.NETWORK.title": "Connection issue",
   "errors.NETWORK.body": "Something went wrong. Please check your connection and try again.",
   "errors.DOCUMENT_LIMIT_REACHED.title": "Document limit reached",
   "errors.DOCUMENT_LIMIT_REACHED.body": "You've reached your plan's document limit ({limit}). Delete an old document or upgrade for more.",
+  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "You've reached your plan's document limit ({limit}). Delete a document to free up space.",
   "errors.FILE_TOO_LARGE.title": "File too large",
   "errors.FILE_TOO_LARGE.body": "Maximum file size on your plan is {maxMb} MB. Upgrade for larger uploads.",
   "errors.UNSUPPORTED_FORMAT.title": "Unsupported file format",
   "errors.UNSUPPORTED_FORMAT.body": "Please upload a PDF, DOCX, PPTX, XLSX, TXT, or MD file.",
   "errors.INVALID_FILE_CONTENT.title": "File content invalid",
   "errors.INVALID_FILE_CONTENT.body": "The file doesn't match its declared format, or appears corrupted.",
   "errors.URL_INVALID.title": "Invalid URL",
   "errors.URL_INVALID.body": "Enter a full URL starting with http:// or https://.",
   "errors.URL_FETCH_BLOCKED.title": "URL can't be imported",
   "errors.URL_FETCH_BLOCKED.body": "This URL can't be fetched. Try a public web page.",
   "errors.URL_CONTENT_TOO_LARGE.title": "Page too large",
   "errors.URL_CONTENT_TOO_LARGE.body": "The page is too large to import.",
   "errors.NO_TEXT_CONTENT.title": "No text on page",
   "errors.NO_TEXT_CONTENT.body": "No readable text was found on this page.",
   "errors.URL_FETCH_FAILED.title": "URL fetch failed",
   "errors.URL_FETCH_FAILED.body": "Couldn't fetch the URL. Try again later.",
   "errors.DOCUMENT_NOT_FOUND.title": "Document not found",
   "errors.DOCUMENT_NOT_FOUND.body": "This document doesn't exist or isn't yours.",
   "errors.DOCUMENT_PROCESSING.title": "Still processing",
   "errors.DOCUMENT_PROCESSING.body": "The document is still being processed. Try again in a moment.",
   "errors.STORAGE_UNAVAILABLE.title": "Storage unavailable",
   "errors.STORAGE_UNAVAILABLE.body": "Document storage is temporarily unavailable. Please try again shortly.",
   "errors.INSTRUCTIONS_TOO_LONG.title": "Instructions too long",
   "errors.INSTRUCTIONS_TOO_LONG.body": "Custom instructions are limited to {max} characters.",
   "errors.CUSTOM_INSTRUCTIONS_REQUIRE_PRO.title": "Pro plan required",
   "errors.CUSTOM_INSTRUCTIONS_REQUIRE_PRO.body": "Custom instructions are available on the Pro plan.",
   "errors.SESSION_LIMIT_REACHED.title": "Session limit reached",
   "errors.SESSION_LIMIT_REACHED.body": "Free plan is limited to {limit} chat sessions per document. Upgrade for unlimited.",
   "errors.SESSION_NOT_FOUND.title": "Session not found",
   "errors.SESSION_NOT_FOUND.body": "This chat session doesn't exist or isn't yours.",
   "errors.MESSAGE_NOT_FOUND.title": "Message not found",
   "errors.MESSAGE_NOT_FOUND.body": "The referenced message no longer exists.",
   "errors.RATE_LIMITED.title": "Too many requests",
   "errors.RATE_LIMITED.body": "Please slow down and try again in {retryAfter}s.",
   "errors.DEMO_SESSION_RATE_LIMITED.title": "Too many demo sessions",
   "errors.DEMO_SESSION_RATE_LIMITED.body": "Please wait {retryAfter}s before creating another demo session.",
   "errors.DEMO_SESSION_LIMIT_REACHED.title": "Demo limit reached",
   "errors.DEMO_SESSION_LIMIT_REACHED.body": "This demo document has reached its session capacity. Try again later.",
   "errors.DEMO_MESSAGE_LIMIT_REACHED.title": "Demo limit reached",
   "errors.DEMO_MESSAGE_LIMIT_REACHED.body": "You've used all demo messages. Sign in to upload your own documents.",
   "errors.INSUFFICIENT_CREDITS.title": "Out of credits",
   "errors.INSUFFICIENT_CREDITS.body": "You need {required} credits but only have {balance}. Top up or upgrade.",
   "errors.BALANCED_MODE_LIMIT_REACHED.title": "Pro limit reached",
   "errors.BALANCED_MODE_LIMIT_REACHED.body": "Free includes up to {limit} Pro answers per month. Upgrade to Plus for unrestricted Pro mode.",
   "errors.CONTINUATION_LIMIT.title": "Continue limit reached",
   "errors.CONTINUATION_LIMIT.body": "You can only continue a response {max} times.",
   "errors.MODE_NOT_ALLOWED.title": "Plus plan required",
   "errors.MODE_NOT_ALLOWED.body": "This mode is available on the Plus plan.",
   "errors.DOMAIN_MODE_REQUIRES_PLUS.title": "Plus plan required",
   "errors.DOMAIN_MODE_REQUIRES_PLUS.body": "Legal and Academic domain mode is available on the Plus plan.",
   "errors.COLLECTION_LIMIT_REACHED.title": "Collection limit reached",
   "errors.COLLECTION_LIMIT_REACHED.body": "Your plan allows up to {limit} collections. Upgrade for more.",
   "errors.COLLECTION_DOC_LIMIT_REACHED.title": "Too many documents",
   "errors.COLLECTION_DOC_LIMIT_REACHED.body": "Your plan allows up to {limit} documents per collection. Upgrade for more.",
   "errors.COLLECTION_NOT_FOUND.title": "Collection not found",
   "errors.COLLECTION_NOT_FOUND.body": "This collection doesn't exist or isn't yours.",
   "errors.EXPORT_REQUIRES_PAID_PLAN.title": "Paid plan required",
   "errors.EXPORT_REQUIRES_PAID_PLAN.body": "{format} export requires a Plus or Pro plan.",
   "errors.EXPORT_VALIDATION_FAILED.title": "Export failed",
   "errors.EXPORT_VALIDATION_FAILED.body": "Couldn't build the export — this session may have too many messages.",
   "errors.EXPORT_RENDERER_FAILED.title": "Export failed",
   "errors.EXPORT_RENDERER_FAILED.body": "The export couldn't be generated. Please try again.",
   "errors.LAYOUT_TRANSLATION_LIMIT_REACHED.title": "PDF translation limit reached",
   "errors.LAYOUT_TRANSLATION_LIMIT_REACHED.body": "Free includes {limit} layout-preserving PDF translations. Upgrade to Plus to keep using it.",
   "errors.LAYOUT_TRANSLATION_PAGE_LIMIT_EXCEEDED.title": "PDF too long for layout translation",
   "errors.LAYOUT_TRANSLATION_PAGE_LIMIT_EXCEEDED.body": "This PDF has {pageCount} pages. Your current plan supports layout-preserving PDF translation up to {maxPages} pages.",
   "errors.LAYOUT_TRANSLATION_FILE_TOO_LARGE.title": "PDF too large for layout translation",
   "errors.LAYOUT_TRANSLATION_FILE_TOO_LARGE.body": "Layout-preserving PDF translation supports files up to {maxMb} MB.",
   "errors.LAYOUT_TRANSLATION_NOT_CONFIGURED.title": "PDF translation is being set up",
   "errors.LAYOUT_TRANSLATION_NOT_CONFIGURED.body": "Layout-preserving PDF translation is temporarily unavailable while the service is being configured.",
   "errors.SHARE_LIMIT_REACHED.title": "Share limit reached",
   "errors.SHARE_LIMIT_REACHED.body": "Free plan is limited to {limit} active share links. Upgrade for unlimited.",
   "errors.SHARE_EXPIRED.title": "Share expired",
   "errors.SHARE_EXPIRED.body": "This share link has expired.",
   "errors.SHARE_NOT_FOUND.title": "Share not found",
   "errors.SHARE_NOT_FOUND.body": "This share link is invalid or has been revoked.",
   "errors.CHUNK_NOT_FOUND.title": "Passage not found",
   "errors.CHUNK_NOT_FOUND.body": "The requested passage no longer exists.",
   "errors.STRIPE_UNAVAILABLE.title": "Billing unavailable",
   "errors.STRIPE_UNAVAILABLE.body": "Billing is temporarily unavailable. Please try again shortly.",
diff --git a/frontend/src/i18n/locales/es.json b/frontend/src/i18n/locales/es.json
index bb669ac..1c7a0ad 100644
--- a/frontend/src/i18n/locales/es.json
+++ b/frontend/src/i18n/locales/es.json
@@ -2538,160 +2538,161 @@
   "paywall.proMode.cta": "Actualizar para modo Pro",
   "paywall.layoutTranslation.title": "Sigue traduciendo PDF completos",
   "paywall.layoutTranslation.body": "Gratis incluye 2 traducciones de PDF conservando el diseño. Plus desbloquea este flujo para trabajo activo con documentos.",
   "paywall.layoutTranslation.cta": "Actualizar para traducción de PDF",
   "paywall.domainMode.title": "Desbloquea el modo Legal y Académico",
   "paywall.domainMode.body": "El modo de dominio Legal y Académico está disponible en el plan Plus, ajustando citas y prompts para una lectura específica del dominio.",
   "paywall.domainMode.cta": "Actualizar para el modo de dominio",
   "paywall.savedQuotes.title": "Sigue guardando citas",
   "paywall.savedQuotes.body": "El plan gratuito incluye 30 citas guardadas. Plus desbloquea hasta 999 para crear una biblioteca de investigación completa.",
   "paywall.savedQuotes.cta": "Actualiza para guardar más citas",
   "paywall.benefit.credits": "Más créditos mensuales para trabajo activo con documentos",
   "paywall.benefit.modes": "Modos Flash y Pro sin el límite del plan gratuito",
   "paywall.benefit.layoutTranslation": "Traducción de PDF conservando el diseño para artículos e informes complejos",
   "paywall.benefit.exports": "Exportaciones a PDF y DOCX para entregables con citas",
   "layoutTranslation.toolbar": "Traducir diseño del PDF",
   "layoutTranslation.chatMessage": "He iniciado una traducción conservando el diseño para este PDF. Puedes seguir trabajando mientras se ejecuta.",
   "layoutTranslation.artifactTitle": "Traducción PDF con conservación del diseño",
   "layoutTranslation.summaryQueued": "Traduciendo este PDF mientras se conserva el diseño.",
   "layoutTranslation.summarySucceeded": "La traducción PDF con diseño conservado está lista.",
   "layoutTranslation.summaryFailed": "La traducción PDF con conservación del diseño falló.",
   "layoutTranslation.downloadPdf": "PDF traducido",
   "layoutTranslation.downloadMarkdown": "Markdown",
   "layoutTranslation.downloadBundle": "Paquete",
   "viewer.webSource": "Fuente web",
   "viewer.importedUrl": "URL importada",
   "viewer.articleStats": "{{sections}} secciones / {{minutes}} min de lectura",
   "viewer.openOriginal": "Abrir original",
   "viewer.sourceOutline": "Esquema de la fuente",
   "viewer.section": "Sección",
   "privacy.trustLink": "Centro de confianza",
   "profile.tabs.notifications": "Notificaciones",
   "footer.imprint": "Aviso legal",
   "imprint.title": "Aviso legal",
   "imprint.subtitle": "Divulgación legal según § 5 DDG (Ley alemana de servicios digitales)",
   "terms.section5.title": "Contenido subido por el usuario y propiedad intelectual",
   "terms.section5.content": "Conservas todos los derechos sobre los documentos que subes. Confirmas que tienes el derecho legal de subir, almacenar y procesar cada documento a través de DocTalk, ya sea que lo poseas, lo hayas creado o tengas una licencia o permiso válido del titular de los derechos. No subas material protegido por derechos de autor sin permiso, secretos comerciales de terceros o contenido que viole la privacidad u obligaciones de confidencialidad. DocTalk no aloja ni publica tus documentos a terceros; el servicio se limita a procesar tu propio contenido para responder tus preguntas. Podemos eliminar contenido que creamos de buena fe que infrinja derechos de propiedad intelectual según nuestro procedimiento de notificación y retirada.",
   "privacy.controller.title": "Responsable del tratamiento (RGPD Art. 4(7))",
   "privacy.controller.intro": "El responsable del tratamiento de datos personales en este sitio web es:",
   "contact.form.title": "Envíanos un mensaje",
   "contact.form.subtitle": "Leemos todos los mensajes. Tiempo de respuesta típico: 1–2 días hábiles.",
   "contact.form.nameLabel": "Nombre (opcional)",
   "contact.form.emailLabel": "Correo electrónico",
   "contact.form.messageLabel": "Mensaje",
   "contact.form.messageHint": "Mínimo 10 caracteres. Markdown no se renderiza.",
   "contact.form.submit": "Enviar mensaje",
   "contact.form.submitting": "Enviando…",
   "contact.form.success": "Gracias, tu mensaje está en camino. Responderemos al correo que proporcionaste.",
   "contact.form.error": "Algo salió mal. Inténtalo de nuevo o escribe directamente a support@doctalk.site.",
   "billing.currentPlan.title": "Tu plan actual",
   "billing.currentPlan.plan": "Plan",
   "billing.currentPlan.status.active": "Activo",
   "billing.currentPlan.status.trialing": "Prueba",
   "billing.currentPlan.status.past_due": "Pago vencido",
   "billing.currentPlan.status.canceled": "Cancelado",
   "billing.currentPlan.status.pending": "Compra en proceso",
   "billing.currentPlan.status.none": "—",
   "billing.currentPlan.managed.stripe": "Gestionado vía Stripe",
   "billing.currentPlan.managed.admin": "Asignado por administrador",
   "billing.currentPlan.managed.none": "Plan gratuito",
   "billing.currentPlan.renewsOn": "Renueva el {date}",
   "billing.currentPlan.endsOn": "Finaliza el {date}",
   "billing.currentPlan.scheduledCancel": "Tu suscripción finalizará el {date}. Hasta entonces conservas todas las funciones.",
   "billing.cancel.button": "Cancelar suscripción",
   "billing.cancel.buttonAdmin": "Volver al plan gratuito",
   "billing.cancel.tooltipPending": "La compra está en proceso, espera un momento.",
   "billing.cancel.tooltipContactSupport": "Por favor, contacta al soporte.",
   "billing.cancel.managePortal": "Gestionar facturación en Stripe →",
   "billing.cancel.modal.title": "Cancelar suscripción",
   "billing.cancel.modal.bodyStripe": "Tu suscripción {plan} finalizará el {date}. Hasta entonces conservas todas las funciones de {plan}. Tus créditos existentes se conservan permanentemente.",
   "billing.cancel.modal.bodyAdmin": "Volverás al plan gratuito de inmediato. Tus créditos existentes se conservan permanentemente.",
   "billing.cancel.modal.confirm": "Confirmar cancelación",
   "billing.cancel.modal.back": "Atrás",
   "billing.cancel.successScheduled": "Suscripción cancelada. Tu acceso continúa hasta el {date}.",
   "billing.cancel.successImmediate": "Ahora estás en el plan gratuito. Tus créditos se conservan.",
   "errors.cta.upgrade": "Mejorar",
   "errors.cta.signin": "Iniciar sesión",
   "errors.NETWORK.title": "Problema de conexión",
   "errors.NETWORK.body": "Algo salió mal. Verifica tu conexión e inténtalo de nuevo.",
   "errors.DOCUMENT_LIMIT_REACHED.title": "Límite de documentos alcanzado",
   "errors.DOCUMENT_LIMIT_REACHED.body": "Has alcanzado el límite de documentos de tu plan ({limit}). Elimina un documento antiguo o mejora tu plan para obtener más.",
+  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "Has alcanzado el límite de documentos de tu plan ({limit}). Elimina un documento para liberar espacio.",
   "errors.FILE_TOO_LARGE.title": "Archivo demasiado grande",
   "errors.FILE_TOO_LARGE.body": "El tamaño máximo de archivo en tu plan es {maxMb} MB. Mejora tu plan para subir archivos más grandes.",
   "errors.UNSUPPORTED_FORMAT.title": "Formato de archivo no compatible",
   "errors.UNSUPPORTED_FORMAT.body": "Por favor, sube un archivo PDF, DOCX, PPTX, XLSX, TXT o MD.",
   "errors.INVALID_FILE_CONTENT.title": "Contenido de archivo no válido",
   "errors.INVALID_FILE_CONTENT.body": "El archivo no coincide con su formato declarado o parece estar corrupto.",
   "errors.URL_INVALID.title": "URL no válida",
   "errors.URL_INVALID.body": "Ingresa una URL completa que comience con http:// o https://.",
   "errors.URL_FETCH_BLOCKED.title": "No se puede importar la URL",
   "errors.URL_FETCH_BLOCKED.body": "No se puede obtener esta URL. Prueba con una página web pública.",
   "errors.URL_CONTENT_TOO_LARGE.title": "Página demasiado grande",
   "errors.URL_CONTENT_TOO_LARGE.body": "La página es demasiado grande para importarla.",
   "errors.NO_TEXT_CONTENT.title": "Sin texto en la página",
   "errors.NO_TEXT_CONTENT.body": "No se encontró texto legible en esta página.",
   "errors.URL_FETCH_FAILED.title": "Error al obtener la URL",
   "errors.URL_FETCH_FAILED.body": "No se pudo obtener la URL. Inténtalo de nuevo más tarde.",
   "errors.DOCUMENT_NOT_FOUND.title": "Documento no encontrado",
   "errors.DOCUMENT_NOT_FOUND.body": "Este documento no existe o no es tuyo.",
   "errors.DOCUMENT_PROCESSING.title": "Aún procesando",
   "errors.DOCUMENT_PROCESSING.body": "El documento aún se está procesando. Inténtalo de nuevo en un momento.",
   "errors.STORAGE_UNAVAILABLE.title": "Almacenamiento no disponible",
   "errors.STORAGE_UNAVAILABLE.body": "El almacenamiento de documentos no está disponible temporalmente. Inténtalo de nuevo en breve.",
   "errors.INSTRUCTIONS_TOO_LONG.title": "Instrucciones demasiado largas",
   "errors.INSTRUCTIONS_TOO_LONG.body": "Las instrucciones personalizadas están limitadas a {max} caracteres.",
   "errors.CUSTOM_INSTRUCTIONS_REQUIRE_PRO.title": "Plan Pro requerido",
   "errors.CUSTOM_INSTRUCTIONS_REQUIRE_PRO.body": "Las instrucciones personalizadas están disponibles en el plan Pro.",
   "errors.SESSION_LIMIT_REACHED.title": "Límite de sesiones alcanzado",
   "errors.SESSION_LIMIT_REACHED.body": "El plan gratuito tiene un límite de {limit} sesiones de chat por documento. Mejora tu plan para sesiones ilimitadas.",
   "errors.SESSION_NOT_FOUND.title": "Sesión no encontrada",
   "errors.SESSION_NOT_FOUND.body": "Esta sesión de chat no existe o no es tuya.",
   "errors.MESSAGE_NOT_FOUND.title": "Mensaje no encontrado",
   "errors.MESSAGE_NOT_FOUND.body": "El mensaje referenciado ya no existe.",
   "errors.RATE_LIMITED.title": "Demasiadas solicitudes",
   "errors.RATE_LIMITED.body": "Reduce la velocidad e inténtalo de nuevo en {retryAfter}s.",
   "errors.DEMO_SESSION_LIMIT_REACHED.title": "Límite de demostración alcanzado",
   "errors.DEMO_SESSION_LIMIT_REACHED.body": "Este documento de demostración ha alcanzado su capacidad de sesiones. Inténtalo de nuevo más tarde.",
   "errors.DEMO_MESSAGE_LIMIT_REACHED.title": "Límite de demostración alcanzado",
   "errors.DEMO_MESSAGE_LIMIT_REACHED.body": "Has usado todos los mensajes de demostración. Inicia sesión para subir tus propios documentos.",
   "errors.INSUFFICIENT_CREDITS.title": "Sin créditos",
   "errors.INSUFFICIENT_CREDITS.body": "Necesitas {required} créditos pero solo tienes {balance}. Recarga o mejora tu plan.",
   "errors.BALANCED_MODE_LIMIT_REACHED.title": "Límite Pro alcanzado",
   "errors.BALANCED_MODE_LIMIT_REACHED.body": "El plan gratuito incluye hasta {limit} respuestas Pro por mes. Mejora a Plus para modo Pro sin restricciones.",
   "errors.CONTINUATION_LIMIT.title": "Límite de continuación alcanzado",
   "errors.CONTINUATION_LIMIT.body": "Solo puedes continuar una respuesta {max} veces.",
   "errors.MODE_NOT_ALLOWED.title": "Plan Plus requerido",
   "errors.MODE_NOT_ALLOWED.body": "Este modo está disponible en el plan Plus.",
   "errors.DOMAIN_MODE_REQUIRES_PLUS.title": "Plan Plus requerido",
   "errors.DOMAIN_MODE_REQUIRES_PLUS.body": "El modo de dominio Legal y Académico está disponible en el plan Plus.",
   "errors.COLLECTION_LIMIT_REACHED.title": "Límite de colecciones alcanzado",
   "errors.COLLECTION_LIMIT_REACHED.body": "Tu plan permite hasta {limit} colecciones. Mejora tu plan para más.",
   "errors.COLLECTION_DOC_LIMIT_REACHED.title": "Demasiados documentos",
   "errors.COLLECTION_DOC_LIMIT_REACHED.body": "Tu plan permite hasta {limit} documentos por colección. Mejora tu plan para más.",
   "errors.COLLECTION_NOT_FOUND.title": "Colección no encontrada",
   "errors.COLLECTION_NOT_FOUND.body": "Esta colección no existe o no es tuya.",
   "errors.EXPORT_REQUIRES_PAID_PLAN.title": "Plan de pago requerido",
   "errors.EXPORT_REQUIRES_PAID_PLAN.body": "La exportación en {format} requiere un plan Plus o Pro.",
   "errors.EXPORT_VALIDATION_FAILED.title": "Error de exportación",
   "errors.EXPORT_VALIDATION_FAILED.body": "No se pudo generar la exportación: esta sesión puede tener demasiados mensajes.",
   "errors.EXPORT_RENDERER_FAILED.title": "Error de exportación",
   "errors.EXPORT_RENDERER_FAILED.body": "No se pudo generar la exportación. Inténtalo de nuevo.",
   "errors.LAYOUT_TRANSLATION_LIMIT_REACHED.title": "Límite de traducción de PDF alcanzado",
   "errors.LAYOUT_TRANSLATION_LIMIT_REACHED.body": "Gratis incluye {limit} traducciones de PDF conservando el diseño. Actualiza a Plus para seguir usándolo.",
   "errors.LAYOUT_TRANSLATION_PAGE_LIMIT_EXCEEDED.title": "El PDF es demasiado largo para la traducción con diseño",
   "errors.LAYOUT_TRANSLATION_PAGE_LIMIT_EXCEEDED.body": "Este PDF tiene {pageCount} páginas. Tu plan actual permite traducción de PDF conservando el diseño hasta {maxPages} páginas.",
   "errors.LAYOUT_TRANSLATION_FILE_TOO_LARGE.title": "El PDF es demasiado grande para la traducción con diseño",
   "errors.LAYOUT_TRANSLATION_FILE_TOO_LARGE.body": "La traducción de PDF conservando el diseño admite archivos de hasta {maxMb} MB.",
   "errors.LAYOUT_TRANSLATION_NOT_CONFIGURED.title": "La traducción de PDF se está configurando",
   "errors.LAYOUT_TRANSLATION_NOT_CONFIGURED.body": "La traducción de PDF conservando el diseño no está disponible temporalmente mientras configuramos el servicio.",
   "errors.SHARE_LIMIT_REACHED.title": "Límite de uso compartido alcanzado",
   "errors.SHARE_LIMIT_REACHED.body": "El plan gratuito tiene un límite de {limit} enlaces de uso compartido activos. Mejora tu plan para enlaces ilimitados.",
   "errors.SHARE_EXPIRED.title": "Enlace caducado",
   "errors.SHARE_EXPIRED.body": "Este enlace de uso compartido ha caducado.",
   "errors.SHARE_NOT_FOUND.title": "Enlace no encontrado",
   "errors.SHARE_NOT_FOUND.body": "Este enlace de uso compartido no es válido o ha sido revocado.",
   "errors.CHUNK_NOT_FOUND.title": "Pasaje no encontrado",
   "errors.CHUNK_NOT_FOUND.body": "El pasaje solicitado ya no existe.",
   "errors.STRIPE_UNAVAILABLE.title": "Facturación no disponible",
   "errors.STRIPE_UNAVAILABLE.body": "La facturación no está disponible temporalmente. Inténtalo de nuevo en breve.",
   "errors.CHAT_SETUP_ERROR.title": "Error al iniciar el chat",
   "errors.CHAT_SETUP_ERROR.body": "No se pudo iniciar el chat. Inténtalo de nuevo.",
diff --git a/frontend/src/i18n/locales/fr.json b/frontend/src/i18n/locales/fr.json
index 85cb081..17bfc81 100644
--- a/frontend/src/i18n/locales/fr.json
+++ b/frontend/src/i18n/locales/fr.json
@@ -2538,160 +2538,161 @@
   "paywall.proMode.cta": "Passer à Plus pour le mode Pro",
   "paywall.layoutTranslation.title": "Continuer à traduire des PDF complets",
   "paywall.layoutTranslation.body": "Le gratuit inclut 2 traductions de PDF avec mise en page préservée. Plus débloque ce workflow pour le travail documentaire actif.",
   "paywall.layoutTranslation.cta": "Passer à Plus pour la traduction PDF",
   "paywall.domainMode.title": "Débloquer le mode Juridique et Académique",
   "paywall.domainMode.body": "Le mode de domaine Juridique et Académique est disponible avec le forfait Plus, ajustant les citations et les prompts pour une lecture spécifique au domaine.",
   "paywall.domainMode.cta": "Passer à Plus pour le mode de domaine",
   "paywall.savedQuotes.title": "Continuez à enregistrer des citations",
   "paywall.savedQuotes.body": "Le plan gratuit inclut 30 citations enregistrées. Plus en débloque jusqu'à 999 pour constituer une bibliothèque de recherche complète.",
   "paywall.savedQuotes.cta": "Passer à un forfait supérieur pour enregistrer plus de citations",
   "paywall.benefit.credits": "Plus de crédits mensuels pour un travail actif sur les documents",
   "paywall.benefit.modes": "Modes Flash et Pro sans limite du plan gratuit",
   "paywall.benefit.layoutTranslation": "Traduction de PDF avec mise en page préservée pour articles et rapports complexes",
   "paywall.benefit.exports": "Export PDF et DOCX pour les livrables cités",
   "layoutTranslation.toolbar": "Traduire la mise en page PDF",
   "layoutTranslation.chatMessage": "J’ai lancé une traduction avec mise en page préservée pour ce PDF. Vous pouvez continuer à travailler pendant son exécution.",
   "layoutTranslation.artifactTitle": "Traduction PDF avec mise en page conservée",
   "layoutTranslation.summaryQueued": "Traduction de ce PDF en conservant la mise en page.",
   "layoutTranslation.summarySucceeded": "La traduction PDF avec mise en page conservée est prête.",
   "layoutTranslation.summaryFailed": "La traduction PDF avec mise en page conservée a échoué.",
   "layoutTranslation.downloadPdf": "PDF traduit",
   "layoutTranslation.downloadMarkdown": "Markdown",
   "layoutTranslation.downloadBundle": "Archive",
   "viewer.webSource": "Source web",
   "viewer.importedUrl": "URL importée",
   "viewer.articleStats": "{{sections}} sections / {{minutes}} min de lecture",
   "viewer.openOriginal": "Ouvrir l'original",
   "viewer.sourceOutline": "Plan de la source",
   "viewer.section": "Section",
   "privacy.trustLink": "Centre de confiance",
   "profile.tabs.notifications": "Notifications",
   "footer.imprint": "Mentions légales",
   "imprint.title": "Mentions légales",
   "imprint.subtitle": "Informations légales conformément au § 5 DDG (loi allemande sur les services numériques)",
   "terms.section5.title": "Contenu téléchargé par l'utilisateur et propriété intellectuelle",
   "terms.section5.content": "Vous conservez tous les droits sur les documents que vous téléchargez. Vous confirmez que vous avez le droit légal de télécharger, stocker et traiter chaque document via DocTalk — que vous en soyez propriétaire, que vous l'ayez créé, ou que vous disposiez d'une licence valide ou d'une autorisation du titulaire des droits. Ne téléchargez pas de contenu protégé par le droit d'auteur sans autorisation, de secrets commerciaux de tiers, ou de contenu violant la vie privée ou des obligations de confidentialité. DocTalk n'héberge ni ne publie vos documents auprès de tiers ; le service se limite à traiter votre propre contenu pour répondre à vos questions. Nous pouvons supprimer tout contenu que nous estimons de bonne foi porter atteinte aux droits de propriété intellectuelle conformément à notre procédure de notification et de retrait.",
   "privacy.controller.title": "Responsable du traitement (RGPD Art. 4(7))",
   "privacy.controller.intro": "Le responsable du traitement des données personnelles sur ce site est :",
   "contact.form.title": "Envoyez-nous un message",
   "contact.form.subtitle": "Nous lisons chaque message. Délai de réponse typique : 1 à 2 jours ouvrés.",
   "contact.form.nameLabel": "Nom (facultatif)",
   "contact.form.emailLabel": "E-mail",
   "contact.form.messageLabel": "Message",
   "contact.form.messageHint": "Minimum 10 caractères. Le Markdown n'est pas interprété.",
   "contact.form.submit": "Envoyer le message",
   "contact.form.submitting": "Envoi en cours…",
   "contact.form.success": "Merci — votre message est en route. Nous répondrons à l'e-mail que vous avez fourni.",
   "contact.form.error": "Une erreur s'est produite. Veuillez réessayer ou contacter directement support@doctalk.site.",
   "billing.currentPlan.title": "Votre forfait actuel",
   "billing.currentPlan.plan": "Forfait",
   "billing.currentPlan.status.active": "Actif",
   "billing.currentPlan.status.trialing": "Essai",
   "billing.currentPlan.status.past_due": "Paiement en retard",
   "billing.currentPlan.status.canceled": "Annulé",
   "billing.currentPlan.status.pending": "Paiement en cours",
   "billing.currentPlan.status.none": "—",
   "billing.currentPlan.managed.stripe": "Géré via Stripe",
   "billing.currentPlan.managed.admin": "Attribué par l'admin",
   "billing.currentPlan.managed.none": "Forfait gratuit",
   "billing.currentPlan.renewsOn": "Renouvellement le {date}",
   "billing.currentPlan.endsOn": "Se termine le {date}",
   "billing.currentPlan.scheduledCancel": "Votre abonnement se terminera le {date}. D'ici là, vous conservez toutes les fonctionnalités.",
   "billing.cancel.button": "Annuler l'abonnement",
   "billing.cancel.buttonAdmin": "Revenir au forfait gratuit",
   "billing.cancel.tooltipPending": "Le paiement est en cours — veuillez patienter un instant.",
   "billing.cancel.tooltipContactSupport": "Veuillez contacter le support.",
   "billing.cancel.managePortal": "Gérer la facturation dans Stripe →",
   "billing.cancel.modal.title": "Annuler l'abonnement",
   "billing.cancel.modal.bodyStripe": "Votre abonnement {plan} se terminera le {date}. D'ici là, vous conservez toutes les fonctionnalités {plan}. Vos crédits existants sont conservés définitivement.",
   "billing.cancel.modal.bodyAdmin": "Vous reviendrez immédiatement au forfait gratuit. Vos crédits existants sont conservés définitivement.",
   "billing.cancel.modal.confirm": "Confirmer l'annulation",
   "billing.cancel.modal.back": "Retour",
   "billing.cancel.successScheduled": "Abonnement annulé. Votre accès continue jusqu'au {date}.",
   "billing.cancel.successImmediate": "Vous êtes maintenant sur le forfait gratuit. Vos crédits sont conservés.",
   "errors.cta.upgrade": "Passer à la version supérieure",
   "errors.cta.signin": "Se connecter",
   "errors.NETWORK.title": "Problème de connexion",
   "errors.NETWORK.body": "Une erreur s'est produite. Vérifiez votre connexion et réessayez.",
   "errors.DOCUMENT_LIMIT_REACHED.title": "Limite de documents atteinte",
   "errors.DOCUMENT_LIMIT_REACHED.body": "Vous avez atteint la limite de documents de votre forfait ({limit}). Supprimez un ancien document ou passez à un forfait supérieur.",
+  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "Vous avez atteint la limite de documents de votre forfait ({limit}). Supprimez un document pour libérer de l'espace.",
   "errors.FILE_TOO_LARGE.title": "Fichier trop volumineux",
   "errors.FILE_TOO_LARGE.body": "La taille maximale de fichier pour votre forfait est de {maxMb} Mo. Passez à un forfait supérieur pour des téléchargements plus volumineux.",
   "errors.UNSUPPORTED_FORMAT.title": "Format de fichier non pris en charge",
   "errors.UNSUPPORTED_FORMAT.body": "Veuillez télécharger un fichier PDF, DOCX, PPTX, XLSX, TXT ou MD.",
   "errors.INVALID_FILE_CONTENT.title": "Contenu du fichier invalide",
   "errors.INVALID_FILE_CONTENT.body": "Le fichier ne correspond pas au format déclaré ou semble corrompu.",
   "errors.URL_INVALID.title": "URL invalide",
   "errors.URL_INVALID.body": "Saisissez une URL complète commençant par http:// ou https://.",
   "errors.URL_FETCH_BLOCKED.title": "URL impossible à importer",
   "errors.URL_FETCH_BLOCKED.body": "Cette URL ne peut pas être récupérée. Essayez une page web publique.",
   "errors.URL_CONTENT_TOO_LARGE.title": "Page trop volumineuse",
   "errors.URL_CONTENT_TOO_LARGE.body": "La page est trop volumineuse pour être importée.",
   "errors.NO_TEXT_CONTENT.title": "Aucun texte sur la page",
   "errors.NO_TEXT_CONTENT.body": "Aucun texte lisible n'a été trouvé sur cette page.",
   "errors.URL_FETCH_FAILED.title": "Échec de la récupération de l'URL",
   "errors.URL_FETCH_FAILED.body": "Impossible de récupérer l'URL. Réessayez plus tard.",
   "errors.DOCUMENT_NOT_FOUND.title": "Document introuvable",
   "errors.DOCUMENT_NOT_FOUND.body": "Ce document n'existe pas ou ne vous appartient pas.",
   "errors.DOCUMENT_PROCESSING.title": "En cours de traitement",
   "errors.DOCUMENT_PROCESSING.body": "Le document est encore en cours de traitement. Réessayez dans un instant.",
   "errors.STORAGE_UNAVAILABLE.title": "Stockage indisponible",
   "errors.STORAGE_UNAVAILABLE.body": "Le stockage des documents est temporairement indisponible. Veuillez réessayer sous peu.",
   "errors.INSTRUCTIONS_TOO_LONG.title": "Instructions trop longues",
   "errors.INSTRUCTIONS_TOO_LONG.body": "Les instructions personnalisées sont limitées à {max} caractères.",
   "errors.CUSTOM_INSTRUCTIONS_REQUIRE_PRO.title": "Forfait Pro requis",
   "errors.CUSTOM_INSTRUCTIONS_REQUIRE_PRO.body": "Les instructions personnalisées sont disponibles avec le forfait Pro.",
   "errors.SESSION_LIMIT_REACHED.title": "Limite de sessions atteinte",
   "errors.SESSION_LIMIT_REACHED.body": "Le forfait gratuit est limité à {limit} sessions de chat par document. Passez à un forfait supérieur pour un accès illimité.",
   "errors.SESSION_NOT_FOUND.title": "Session introuvable",
   "errors.SESSION_NOT_FOUND.body": "Cette session de chat n'existe pas ou ne vous appartient pas.",
   "errors.MESSAGE_NOT_FOUND.title": "Message introuvable",
   "errors.MESSAGE_NOT_FOUND.body": "Le message référencé n'existe plus.",
   "errors.RATE_LIMITED.title": "Trop de requêtes",
   "errors.RATE_LIMITED.body": "Veuillez ralentir et réessayer dans {retryAfter}s.",
   "errors.DEMO_SESSION_LIMIT_REACHED.title": "Limite de démo atteinte",
   "errors.DEMO_SESSION_LIMIT_REACHED.body": "Ce document de démonstration a atteint sa capacité de sessions. Réessayez plus tard.",
   "errors.DEMO_MESSAGE_LIMIT_REACHED.title": "Limite de démo atteinte",
   "errors.DEMO_MESSAGE_LIMIT_REACHED.body": "Vous avez utilisé tous les messages de démonstration. Connectez-vous pour télécharger vos propres documents.",
   "errors.INSUFFICIENT_CREDITS.title": "Crédits insuffisants",
   "errors.INSUFFICIENT_CREDITS.body": "Vous avez besoin de {required} crédits mais vous n'en avez que {balance}. Rechargez ou passez à un forfait supérieur.",
   "errors.BALANCED_MODE_LIMIT_REACHED.title": "Limite Pro atteinte",
   "errors.BALANCED_MODE_LIMIT_REACHED.body": "Le forfait gratuit inclut jusqu'à {limit} réponses Pro par mois. Passez à Plus pour un mode Pro illimité.",
   "errors.CONTINUATION_LIMIT.title": "Limite de continuation atteinte",
   "errors.CONTINUATION_LIMIT.body": "Vous ne pouvez continuer une réponse que {max} fois.",
   "errors.MODE_NOT_ALLOWED.title": "Forfait Plus requis",
   "errors.MODE_NOT_ALLOWED.body": "Ce mode est disponible avec le forfait Plus.",
   "errors.DOMAIN_MODE_REQUIRES_PLUS.title": "Forfait Plus requis",
   "errors.DOMAIN_MODE_REQUIRES_PLUS.body": "Le mode de domaine Juridique et Académique est disponible avec le forfait Plus.",
   "errors.COLLECTION_LIMIT_REACHED.title": "Limite de collections atteinte",
   "errors.COLLECTION_LIMIT_REACHED.body": "Votre forfait autorise jusqu'à {limit} collections. Passez à un forfait supérieur.",
   "errors.COLLECTION_DOC_LIMIT_REACHED.title": "Trop de documents",
   "errors.COLLECTION_DOC_LIMIT_REACHED.body": "Votre forfait autorise jusqu'à {limit} documents par collection. Passez à un forfait supérieur.",
   "errors.COLLECTION_NOT_FOUND.title": "Collection introuvable",
   "errors.COLLECTION_NOT_FOUND.body": "Cette collection n'existe pas ou ne vous appartient pas.",
   "errors.EXPORT_REQUIRES_PAID_PLAN.title": "Forfait payant requis",
   "errors.EXPORT_REQUIRES_PAID_PLAN.body": "L'export {format} nécessite un forfait Plus ou Pro.",
   "errors.EXPORT_VALIDATION_FAILED.title": "Échec de l'export",
   "errors.EXPORT_VALIDATION_FAILED.body": "Impossible de générer l'export — cette session contient peut-être trop de messages.",
   "errors.EXPORT_RENDERER_FAILED.title": "Échec de l'export",
   "errors.EXPORT_RENDERER_FAILED.body": "L'export n'a pas pu être généré. Veuillez réessayer.",
   "errors.LAYOUT_TRANSLATION_LIMIT_REACHED.title": "Limite de traduction PDF atteinte",
   "errors.LAYOUT_TRANSLATION_LIMIT_REACHED.body": "Le gratuit inclut {limit} traductions de PDF avec mise en page préservée. Passez à Plus pour continuer.",
   "errors.LAYOUT_TRANSLATION_PAGE_LIMIT_EXCEEDED.title": "PDF trop long pour la traduction avec mise en page",
   "errors.LAYOUT_TRANSLATION_PAGE_LIMIT_EXCEEDED.body": "Ce PDF contient {pageCount} pages. Votre offre actuelle prend en charge la traduction de PDF avec mise en page préservée jusqu’à {maxPages} pages.",
   "errors.LAYOUT_TRANSLATION_FILE_TOO_LARGE.title": "PDF trop volumineux pour la traduction avec mise en page",
   "errors.LAYOUT_TRANSLATION_FILE_TOO_LARGE.body": "La traduction de PDF avec mise en page préservée prend en charge les fichiers jusqu’à {maxMb} Mo.",
   "errors.LAYOUT_TRANSLATION_NOT_CONFIGURED.title": "La traduction PDF est en cours de configuration",
   "errors.LAYOUT_TRANSLATION_NOT_CONFIGURED.body": "La traduction de PDF avec mise en page préservée est temporairement indisponible pendant la configuration du service.",
   "errors.SHARE_LIMIT_REACHED.title": "Limite de partage atteinte",
   "errors.SHARE_LIMIT_REACHED.body": "Le forfait gratuit est limité à {limit} liens de partage actifs. Passez à un forfait supérieur pour un accès illimité.",
   "errors.SHARE_EXPIRED.title": "Partage expiré",
   "errors.SHARE_EXPIRED.body": "Ce lien de partage a expiré.",
   "errors.SHARE_NOT_FOUND.title": "Partage introuvable",
   "errors.SHARE_NOT_FOUND.body": "Ce lien de partage est invalide ou a été révoqué.",
   "errors.CHUNK_NOT_FOUND.title": "Passage introuvable",
   "errors.CHUNK_NOT_FOUND.body": "Le passage demandé n'existe plus.",
   "errors.STRIPE_UNAVAILABLE.title": "Facturation indisponible",
   "errors.STRIPE_UNAVAILABLE.body": "La facturation est temporairement indisponible. Veuillez réessayer sous peu.",
   "errors.CHAT_SETUP_ERROR.title": "Échec de la configuration du chat",
   "errors.CHAT_SETUP_ERROR.body": "Impossible de démarrer le chat. Veuillez réessayer.",
diff --git a/frontend/src/i18n/locales/hi.json b/frontend/src/i18n/locales/hi.json
index fc9e957..9a25a55 100644
--- a/frontend/src/i18n/locales/hi.json
+++ b/frontend/src/i18n/locales/hi.json
@@ -2538,160 +2538,161 @@
   "paywall.proMode.cta": "Pro मोड के लिए अपग्रेड करें",
   "paywall.layoutTranslation.title": "पूरे PDF का अनुवाद जारी रखें",
   "paywall.layoutTranslation.body": "मुफ्त प्लान में 2 लेआउट सुरक्षित PDF अनुवाद शामिल हैं। Plus सक्रिय दस्तावेज़ काम के लिए यह workflow खोलता है।",
   "paywall.layoutTranslation.cta": "PDF अनुवाद के लिए अपग्रेड करें",
   "paywall.domainMode.title": "कानूनी और शैक्षणिक मोड अनलॉक करें",
   "paywall.domainMode.body": "कानूनी और शैक्षणिक डोमेन मोड Plus योजना पर उपलब्ध है, जो डोमेन-विशिष्ट पठन के लिए उद्धरण और प्रॉम्प्ट को समायोजित करता है।",
   "paywall.domainMode.cta": "डोमेन मोड के लिए अपग्रेड करें",
   "paywall.savedQuotes.title": "उद्धरण सहेजना जारी रखें",
   "paywall.savedQuotes.body": "निःशुल्क प्लान में 30 सहेजे गए उद्धरण शामिल हैं। Plus पूर्ण शोध लाइब्रेरी बनाने के लिए 999 तक अनलॉक करता है।",
   "paywall.savedQuotes.cta": "अधिक उद्धरण सहेजने के लिए अपग्रेड करें",
   "paywall.benefit.credits": "सक्रिय दस्तावेज़ कार्य के लिए अधिक मासिक क्रेडिट",
   "paywall.benefit.modes": "मुफ़्त योजना की सीमा के बिना Flash और Pro मोड",
   "paywall.benefit.layoutTranslation": "जटिल पेपर और रिपोर्ट के लिए लेआउट सुरक्षित PDF अनुवाद",
   "paywall.benefit.exports": "उद्धृत प्रस्तुत करने योग्य के लिए PDF और DOCX निर्यात",
   "layoutTranslation.toolbar": "PDF लेआउट अनुवाद करें",
   "layoutTranslation.chatMessage": "मैंने इस PDF के लिए लेआउट सुरक्षित अनुवाद शुरू कर दिया है। इसके चलते समय आप काम जारी रख सकते हैं।",
   "layoutTranslation.artifactTitle": "लेआउट सुरक्षित रखते हुए PDF अनुवाद",
   "layoutTranslation.summaryQueued": "इस PDF का लेआउट सुरक्षित रखते हुए अनुवाद किया जा रहा है।",
   "layoutTranslation.summarySucceeded": "लेआउट-संरक्षित PDF अनुवाद तैयार है।",
   "layoutTranslation.summaryFailed": "लेआउट-संरक्षित PDF अनुवाद विफल हुआ।",
   "layoutTranslation.downloadPdf": "अनूदित PDF",
   "layoutTranslation.downloadMarkdown": "Markdown",
   "layoutTranslation.downloadBundle": "बंडल",
   "viewer.webSource": "वेब स्रोत",
   "viewer.importedUrl": "आयातित URL",
   "viewer.articleStats": "{{sections}} अनुभाग / {{minutes}} मिनट पढ़ें",
   "viewer.openOriginal": "मूल खोलें",
   "viewer.sourceOutline": "स्रोत रूपरेखा",
   "viewer.section": "अनुभाग",
   "privacy.trustLink": "ट्रस्ट सेंटर",
   "profile.tabs.notifications": "सूचनाएं",
   "footer.imprint": "छाप",
   "imprint.title": "छाप",
   "imprint.subtitle": "§ 5 DDG (जर्मन डिजिटल सेवा अधिनियम) के अनुसार कानूनी प्रकटीकरण",
   "terms.section5.title": "उपयोगकर्ता द्वारा अपलोड की गई सामग्री और बौद्धिक संपदा",
   "terms.section5.content": "आप अपने द्वारा अपलोड किए गए दस्तावेज़ों के सभी अधिकार बनाए रखते हैं। आप पुष्टि करते हैं कि आपके पास DocTalk के माध्यम से प्रत्येक दस्तावेज़ को अपलोड करने, संग्रहीत करने और संसाधित करने का कानूनी अधिकार है - चाहे आप इसके मालिक हों, इसके लेखक हों, या आपके पास अधिकार धारक से वैध लाइसेंस या अनुमति हो। ऐसी कॉपीराइट सामग्री अपलोड न करें जिसका उपयोग करने की आपको अनुमति नहीं है, तीसरे पक्ष के व्यापार रहस्य, या ऐसी सामग्री जो गोपनीयता या गोपनीयता दायित्वों का उल्लंघन करती है। DocTalk आपके दस्तावेज़ों को तीसरे पक्ष को होस्ट या प्रकाशित नहीं करता है; सेवा आपके प्रश्नों का उत्तर देने के लिए आपकी अपनी सामग्री को संसाधित करने तक सीमित है। हम उस सामग्री को हटा सकते हैं जिसके बारे में हमें अच्छे विश्वास में विश्वास है कि यह हमारी सूचना-और-हटाने की प्रक्रिया के तहत बौद्धिक संपदा अधिकारों का उल्लंघन करती है।",
   "privacy.controller.title": "डेटा नियंत्रक (GDPR कला. 4(7))",
   "privacy.controller.intro": "इस वेबसाइट पर व्यक्तिगत डेटा के प्रसंस्करण के लिए जिम्मेदार नियंत्रक है:",
   "contact.form.title": "हमें एक संदेश भेजें",
   "contact.form.subtitle": "हम हर संदेश पढ़ते हैं। सामान्य प्रतिक्रिया समय: 1-2 कार्य दिवस।",
   "contact.form.nameLabel": "नाम (वैकल्पिक)",
   "contact.form.emailLabel": "ईमेल",
   "contact.form.messageLabel": "संदेश",
   "contact.form.messageHint": "न्यूनतम 10 अक्षर। मार्कडाउन प्रस्तुत नहीं किया जाता है।",
   "contact.form.submit": "संदेश भेजें",
   "contact.form.submitting": "भेज रहा है…",
   "contact.form.success": "धन्यवाद - आपका संदेश भेज दिया गया है। हम आपके द्वारा प्रदान किए गए ईमेल पर उत्तर देंगे।",
   "contact.form.error": "कुछ गलत हो गया। कृपया पुनः प्रयास करें या सीधे support@doctalk.site पर ईमेल करें।",
   "billing.currentPlan.title": "आपकी वर्तमान योजना",
   "billing.currentPlan.plan": "योजना",
   "billing.currentPlan.status.active": "सक्रिय",
   "billing.currentPlan.status.trialing": "परीक्षण",
   "billing.currentPlan.status.past_due": "भुगतान बकाया",
   "billing.currentPlan.status.canceled": "रद्द",
   "billing.currentPlan.status.pending": "चेकआउट प्रगति पर",
   "billing.currentPlan.status.none": "—",
   "billing.currentPlan.managed.stripe": "Stripe के माध्यम से प्रबंधित",
   "billing.currentPlan.managed.admin": "व्यवस्थापक द्वारा निर्दिष्ट",
   "billing.currentPlan.managed.none": "मुफ्त योजना",
   "billing.currentPlan.renewsOn": "{date} को नवीनीकृत होता है",
   "billing.currentPlan.endsOn": "{date} को समाप्त होता है",
   "billing.currentPlan.scheduledCancel": "आपकी सदस्यता {date} को समाप्त हो जाएगी। तब तक आप सभी सुविधाओं का उपयोग कर सकते हैं।",
   "billing.cancel.button": "सदस्यता रद्द करें",
   "billing.cancel.buttonAdmin": "मुफ्त योजना पर वापस जाएं",
   "billing.cancel.tooltipPending": "चेकआउट प्रगति पर है - कृपया एक क्षण प्रतीक्षा करें।",
   "billing.cancel.tooltipContactSupport": "कृपया सहायता से संपर्क करें।",
   "billing.cancel.managePortal": "Stripe में बिलिंग प्रबंधित करें →",
   "billing.cancel.modal.title": "सदस्यता रद्द करें",
   "billing.cancel.modal.bodyStripe": "आपकी {plan} सदस्यता {date} को समाप्त हो जाएगी। तब तक आप सभी {plan} सुविधाओं का उपयोग कर सकते हैं। आपके मौजूदा क्रेडिट स्थायी रूप से रखे जाते हैं।",
   "billing.cancel.modal.bodyAdmin": "आप तुरंत मुफ्त योजना पर वापस आ जाएंगे। आपके मौजूदा क्रेडिट स्थायी रूप से रखे जाते हैं।",
   "billing.cancel.modal.confirm": "रद्दीकरण की पुष्टि करें",
   "billing.cancel.modal.back": "वापस",
   "billing.cancel.successScheduled": "सदस्यता रद्द कर दी गई। आपकी पहुंच {date} तक जारी रहेगी।",
   "billing.cancel.successImmediate": "अब आप मुफ्त योजना पर हैं। आपके क्रेडिट रखे गए हैं।",
   "errors.cta.upgrade": "अपग्रेड करें",
   "errors.cta.signin": "साइन इन करें",
   "errors.NETWORK.title": "कनेक्शन समस्या",
   "errors.NETWORK.body": "कुछ गलत हो गया। कृपया अपना कनेक्शन जांचें और पुनः प्रयास करें।",
   "errors.DOCUMENT_LIMIT_REACHED.title": "दस्तावेज़ सीमा समाप्त",
   "errors.DOCUMENT_LIMIT_REACHED.body": "आप अपनी योजना की दस्तावेज़ सीमा ({limit}) तक पहुंच गए हैं। अधिक के लिए कोई पुराना दस्तावेज़ हटाएं या अपग्रेड करें।",
+  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "आप अपनी योजना की दस्तावेज़ सीमा ({limit}) तक पहुंच गए हैं। जगह खाली करने के लिए एक दस्तावेज़ हटाएं।",
   "errors.FILE_TOO_LARGE.title": "फ़ाइल बहुत बड़ी है",
   "errors.FILE_TOO_LARGE.body": "आपकी योजना पर अधिकतम फ़ाइल आकार {maxMb} MB है। बड़े अपलोड के लिए अपग्रेड करें।",
   "errors.UNSUPPORTED_FORMAT.title": "असमर्थित फ़ाइल प्रारूप",
   "errors.UNSUPPORTED_FORMAT.body": "कृपया PDF, DOCX, PPTX, XLSX, TXT, या MD फ़ाइल अपलोड करें।",
   "errors.INVALID_FILE_CONTENT.title": "फ़ाइल सामग्री अमान्य",
   "errors.INVALID_FILE_CONTENT.body": "फ़ाइल अपने घोषित प्रारूप से मेल नहीं खाती, या दूषित प्रतीत होती है।",
   "errors.URL_INVALID.title": "अमान्य URL",
   "errors.URL_INVALID.body": "http:// या https:// से शुरू होने वाला पूरा URL दर्ज करें।",
   "errors.URL_FETCH_BLOCKED.title": "URL आयात नहीं किया जा सकता",
   "errors.URL_FETCH_BLOCKED.body": "यह URL प्राप्त नहीं किया जा सकता। कोई सार्वजनिक वेब पेज आज़माएं।",
   "errors.URL_CONTENT_TOO_LARGE.title": "पेज बहुत बड़ा है",
   "errors.URL_CONTENT_TOO_LARGE.body": "पेज आयात करने के लिए बहुत बड़ा है।",
   "errors.NO_TEXT_CONTENT.title": "पेज पर कोई टेक्स्ट नहीं",
   "errors.NO_TEXT_CONTENT.body": "इस पेज पर कोई पढ़ने योग्य टेक्स्ट नहीं मिला।",
   "errors.URL_FETCH_FAILED.title": "URL प्राप्त करने में विफल",
   "errors.URL_FETCH_FAILED.body": "URL प्राप्त नहीं किया जा सका। बाद में पुनः प्रयास करें।",
   "errors.DOCUMENT_NOT_FOUND.title": "दस्तावेज़ नहीं मिला",
   "errors.DOCUMENT_NOT_FOUND.body": "यह दस्तावेज़ मौजूद नहीं है या आपका नहीं है।",
   "errors.DOCUMENT_PROCESSING.title": "अभी भी प्रसंस्करण हो रहा है",
   "errors.DOCUMENT_PROCESSING.body": "दस्तावेज़ अभी भी संसाधित हो रहा है। कुछ देर में पुनः प्रयास करें।",
   "errors.STORAGE_UNAVAILABLE.title": "भंडारण अनुपलब्ध",
   "errors.STORAGE_UNAVAILABLE.body": "दस्तावेज़ भंडारण अस्थायी रूप से अनुपलब्ध है। कृपया थोड़ी देर में पुनः प्रयास करें।",
   "errors.INSTRUCTIONS_TOO_LONG.title": "निर्देश बहुत लंबे हैं",
   "errors.INSTRUCTIONS_TOO_LONG.body": "कस्टम निर्देश {max} वर्णों तक सीमित हैं।",
   "errors.CUSTOM_INSTRUCTIONS_REQUIRE_PRO.title": "Pro योजना आवश्यक",
   "errors.CUSTOM_INSTRUCTIONS_REQUIRE_PRO.body": "कस्टम निर्देश Pro योजना पर उपलब्ध हैं।",
   "errors.SESSION_LIMIT_REACHED.title": "सत्र सीमा समाप्त",
   "errors.SESSION_LIMIT_REACHED.body": "मुफ्त योजना प्रति दस्तावेज़ {limit} चैट सत्रों तक सीमित है। असीमित के लिए अपग्रेड करें।",
   "errors.SESSION_NOT_FOUND.title": "सत्र नहीं मिला",
   "errors.SESSION_NOT_FOUND.body": "यह चैट सत्र मौजूद नहीं है या आपका नहीं है।",
   "errors.MESSAGE_NOT_FOUND.title": "संदेश नहीं मिला",
   "errors.MESSAGE_NOT_FOUND.body": "संदर्भित संदेश अब मौजूद नहीं है।",
   "errors.RATE_LIMITED.title": "बहुत अधिक अनुरोध",
   "errors.RATE_LIMITED.body": "कृपया धीमा करें और {retryAfter} सेकंड में पुनः प्रयास करें।",
   "errors.DEMO_SESSION_LIMIT_REACHED.title": "डेमो सीमा समाप्त",
   "errors.DEMO_SESSION_LIMIT_REACHED.body": "यह डेमो दस्तावेज़ अपनी सत्र क्षमता तक पहुंच गया है। बाद में पुनः प्रयास करें।",
   "errors.DEMO_MESSAGE_LIMIT_REACHED.title": "डेमो सीमा समाप्त",
   "errors.DEMO_MESSAGE_LIMIT_REACHED.body": "आपने सभी डेमो संदेशों का उपयोग कर लिया है। अपने स्वयं के दस्तावेज़ अपलोड करने के लिए साइन इन करें।",
   "errors.INSUFFICIENT_CREDITS.title": "क्रेडिट समाप्त",
   "errors.INSUFFICIENT_CREDITS.body": "आपको {required} क्रेडिट चाहिए लेकिन आपके पास केवल {balance} है। टॉप अप करें या अपग्रेड करें।",
   "errors.BALANCED_MODE_LIMIT_REACHED.title": "Pro सीमा समाप्त",
   "errors.BALANCED_MODE_LIMIT_REACHED.body": "मुफ्त में प्रति माह {limit} Pro उत्तर शामिल हैं। असीमित Pro मोड के लिए Plus में अपग्रेड करें।",
   "errors.CONTINUATION_LIMIT.title": "जारी रखने की सीमा समाप्त",
   "errors.CONTINUATION_LIMIT.body": "आप किसी प्रतिक्रिया को केवल {max} बार जारी रख सकते हैं।",
   "errors.MODE_NOT_ALLOWED.title": "Plus योजना आवश्यक",
   "errors.MODE_NOT_ALLOWED.body": "यह मोड Plus योजना पर उपलब्ध है।",
   "errors.DOMAIN_MODE_REQUIRES_PLUS.title": "Plus योजना आवश्यक",
   "errors.DOMAIN_MODE_REQUIRES_PLUS.body": "कानूनी और शैक्षणिक डोमेन मोड Plus योजना पर उपलब्ध है।",
   "errors.COLLECTION_LIMIT_REACHED.title": "संग्रह सीमा समाप्त",
   "errors.COLLECTION_LIMIT_REACHED.body": "आपकी योजना {limit} संग्रहों की अनुमति देती है। अधिक के लिए अपग्रेड करें।",
   "errors.COLLECTION_DOC_LIMIT_REACHED.title": "बहुत अधिक दस्तावेज़",
   "errors.COLLECTION_DOC_LIMIT_REACHED.body": "आपकी योजना प्रति संग्रह {limit} दस्तावेज़ों की अनुमति देती है। अधिक के लिए अपग्रेड करें।",
   "errors.COLLECTION_NOT_FOUND.title": "संग्रह नहीं मिला",
   "errors.COLLECTION_NOT_FOUND.body": "यह संग्रह मौजूद नहीं है या आपका नहीं है।",
   "errors.EXPORT_REQUIRES_PAID_PLAN.title": "भुगतान योजना आवश्यक",
   "errors.EXPORT_REQUIRES_PAID_PLAN.body": "{format} निर्यात के लिए Plus या Pro योजना आवश्यक है।",
   "errors.EXPORT_VALIDATION_FAILED.title": "निर्यात विफल",
   "errors.EXPORT_VALIDATION_FAILED.body": "निर्यात नहीं बनाया जा सका - इस सत्र में बहुत अधिक संदेश हो सकते हैं।",
   "errors.EXPORT_RENDERER_FAILED.title": "निर्यात विफल",
   "errors.EXPORT_RENDERER_FAILED.body": "निर्यात उत्पन्न नहीं किया जा सका। कृपया पुनः प्रयास करें।",
   "errors.LAYOUT_TRANSLATION_LIMIT_REACHED.title": "PDF अनुवाद सीमा पूरी हो गई",
   "errors.LAYOUT_TRANSLATION_LIMIT_REACHED.body": "मुफ्त प्लान में {limit} लेआउट सुरक्षित PDF अनुवाद शामिल हैं। जारी रखने के लिए Plus में अपग्रेड करें।",
   "errors.LAYOUT_TRANSLATION_PAGE_LIMIT_EXCEEDED.title": "PDF लेआउट अनुवाद के लिए बहुत लंबा है",
   "errors.LAYOUT_TRANSLATION_PAGE_LIMIT_EXCEEDED.body": "इस PDF में {pageCount} पृष्ठ हैं। आपकी मौजूदा योजना लेआउट-सुरक्षित PDF अनुवाद को {maxPages} पृष्ठों तक समर्थन देती है।",
   "errors.LAYOUT_TRANSLATION_FILE_TOO_LARGE.title": "PDF लेआउट अनुवाद के लिए बहुत बड़ा है",
   "errors.LAYOUT_TRANSLATION_FILE_TOO_LARGE.body": "लेआउट-सुरक्षित PDF अनुवाद {maxMb} MB तक की फ़ाइलों का समर्थन करता है।",
   "errors.LAYOUT_TRANSLATION_NOT_CONFIGURED.title": "PDF अनुवाद सेट अप हो रहा है",
   "errors.LAYOUT_TRANSLATION_NOT_CONFIGURED.body": "सेवा कॉन्फ़िगर होने तक लेआउट सुरक्षित PDF अनुवाद अस्थायी रूप से उपलब्ध नहीं है।",
   "errors.SHARE_LIMIT_REACHED.title": "साझा सीमा समाप्त",
   "errors.SHARE_LIMIT_REACHED.body": "मुफ्त योजना {limit} सक्रिय साझा लिंक तक सीमित है। असीमित के लिए अपग्रेड करें।",
   "errors.SHARE_EXPIRED.title": "साझा लिंक समाप्त",
   "errors.SHARE_EXPIRED.body": "यह साझा लिंक समाप्त हो गया है।",
   "errors.SHARE_NOT_FOUND.title": "साझा लिंक नहीं मिला",
   "errors.SHARE_NOT_FOUND.body": "यह साझा लिंक अमान्य है या रद्द कर दिया गया है।",
   "errors.CHUNK_NOT_FOUND.title": "अंश नहीं मिला",
   "errors.CHUNK_NOT_FOUND.body": "अनुरोधित अंश अब मौजूद नहीं है।",
   "errors.STRIPE_UNAVAILABLE.title": "बिलिंग अनुपलब्ध",
   "errors.STRIPE_UNAVAILABLE.body": "बिलिंग अस्थायी रूप से अनुपलब्ध है। कृपया थोड़ी देर में पुनः प्रयास करें।",
   "errors.CHAT_SETUP_ERROR.title": "चैट सेटअप विफल",
   "errors.CHAT_SETUP_ERROR.body": "चैट शुरू नहीं किया जा सका। कृपया पुनः प्रयास करें।",
diff --git a/frontend/src/i18n/locales/it.json b/frontend/src/i18n/locales/it.json
index acb6fac..1c3fcfb 100644
--- a/frontend/src/i18n/locales/it.json
+++ b/frontend/src/i18n/locales/it.json
@@ -2538,160 +2538,161 @@
   "paywall.proMode.cta": "Aggiorna per la modalità Pro",
   "paywall.layoutTranslation.title": "Continua a tradurre PDF completi",
   "paywall.layoutTranslation.body": "Il piano gratuito include 2 traduzioni PDF con layout preservato. Plus sblocca questo workflow per il lavoro attivo sui documenti.",
   "paywall.layoutTranslation.cta": "Passa a Plus per la traduzione PDF",
   "paywall.domainMode.title": "Sblocca la modalità Legale e Accademico",
   "paywall.domainMode.body": "La modalità dominio Legale e Accademico è disponibile nel piano Plus, adattando citazioni e prompt per una lettura specifica del dominio.",
   "paywall.domainMode.cta": "Passa a Plus per la modalità dominio",
   "paywall.savedQuotes.title": "Continua a salvare citazioni",
   "paywall.savedQuotes.body": "Il piano gratuito include 30 citazioni salvate. Plus sblocca fino a 999 per creare una libreria di ricerca completa.",
   "paywall.savedQuotes.cta": "Esegui l'upgrade per salvare più citazioni",
   "paywall.benefit.credits": "Più crediti mensili per lavoro attivo sui documenti",
   "paywall.benefit.modes": "Modalità Flash e Pro senza il limite del piano gratuito",
   "paywall.benefit.layoutTranslation": "Traduzione PDF con layout preservato per paper e report complessi",
   "paywall.benefit.exports": "Esportazioni PDF e DOCX per deliverable citati",
   "layoutTranslation.toolbar": "Traduci layout PDF",
   "layoutTranslation.chatMessage": "Ho avviato una traduzione con layout preservato per questo PDF. Puoi continuare a lavorare mentre viene eseguita.",
   "layoutTranslation.artifactTitle": "Traduzione PDF con layout preservato",
   "layoutTranslation.summaryQueued": "Traduzione di questo PDF mantenendo il layout.",
   "layoutTranslation.summarySucceeded": "La traduzione PDF con layout preservato è pronta.",
   "layoutTranslation.summaryFailed": "La traduzione PDF con layout preservato non è riuscita.",
   "layoutTranslation.downloadPdf": "PDF tradotto",
   "layoutTranslation.downloadMarkdown": "Markdown",
   "layoutTranslation.downloadBundle": "Pacchetto",
   "viewer.webSource": "Fonte web",
   "viewer.importedUrl": "URL importato",
   "viewer.articleStats": "{{sections}} sezioni / {{minutes}} min di lettura",
   "viewer.openOriginal": "Apri originale",
   "viewer.sourceOutline": "Struttura fonte",
   "viewer.section": "Sezione",
   "privacy.trustLink": "Centro fiducia",
   "profile.tabs.notifications": "Notifiche",
   "footer.imprint": "Impressum",
   "imprint.title": "Impressum",
   "imprint.subtitle": "Informativa legale ai sensi del § 5 DDG (Legge tedesca sui servizi digitali)",
   "terms.section5.title": "Contenuti caricati dall'utente e proprietà intellettuale",
   "terms.section5.content": "Mantieni tutti i diritti sui documenti che carichi. Confermi di avere il diritto legale di caricare, archiviare ed elaborare ciascun documento tramite DocTalk — sia che tu ne sia il proprietario, l'autore, o che tu abbia una licenza valida o il permesso del titolare dei diritti. Non caricare materiale protetto da copyright senza autorizzazione, segreti commerciali di terzi o contenuti che violano la privacy o obblighi di riservatezza. DocTalk non ospita né pubblica i tuoi documenti a terzi; il servizio si limita a elaborare i tuoi contenuti per rispondere alle tue domande. Possiamo rimuovere contenuti che riteniamo in buona fede violino i diritti di proprietà intellettuale secondo la nostra procedura di notice-and-takedown.",
   "privacy.controller.title": "Titolare del trattamento (GDPR Art. 4(7))",
   "privacy.controller.intro": "Il titolare del trattamento dei dati personali su questo sito web è:",
   "contact.form.title": "Inviaci un messaggio",
   "contact.form.subtitle": "Leggiamo ogni messaggio. Tempo di risposta tipico: 1-2 giorni lavorativi.",
   "contact.form.nameLabel": "Nome (opzionale)",
   "contact.form.emailLabel": "Email",
   "contact.form.messageLabel": "Messaggio",
   "contact.form.messageHint": "Minimo 10 caratteri. Il Markdown non viene renderizzato.",
   "contact.form.submit": "Invia messaggio",
   "contact.form.submitting": "Invio in corso…",
   "contact.form.success": "Grazie — il tuo messaggio è stato inviato. Risponderemo all'email che hai fornito.",
   "contact.form.error": "Qualcosa è andato storto. Riprova o contatta direttamente support@doctalk.site.",
   "billing.currentPlan.title": "Il tuo piano attuale",
   "billing.currentPlan.plan": "Piano",
   "billing.currentPlan.status.active": "Attivo",
   "billing.currentPlan.status.trialing": "Prova",
   "billing.currentPlan.status.past_due": "Pagamento scaduto",
   "billing.currentPlan.status.canceled": "Annullato",
   "billing.currentPlan.status.pending": "Checkout in corso",
   "billing.currentPlan.status.none": "—",
   "billing.currentPlan.managed.stripe": "Gestito tramite Stripe",
   "billing.currentPlan.managed.admin": "Assegnato dall'amministratore",
   "billing.currentPlan.managed.none": "Piano gratuito",
   "billing.currentPlan.renewsOn": "Rinnova il {date}",
   "billing.currentPlan.endsOn": "Termina il {date}",
   "billing.currentPlan.scheduledCancel": "Il tuo abbonamento terminerà il {date}. Fino ad allora mantieni tutte le funzionalità.",
   "billing.cancel.button": "Annulla abbonamento",
   "billing.cancel.buttonAdmin": "Torna al piano gratuito",
   "billing.cancel.tooltipPending": "Checkout in corso — attendi un momento.",
   "billing.cancel.tooltipContactSupport": "Contatta l'assistenza.",
   "billing.cancel.managePortal": "Gestisci fatturazione in Stripe →",
   "billing.cancel.modal.title": "Annulla abbonamento",
   "billing.cancel.modal.bodyStripe": "Il tuo abbonamento {plan} terminerà il {date}. Fino ad allora mantieni tutte le funzionalità {plan}. I tuoi crediti esistenti vengono conservati permanentemente.",
   "billing.cancel.modal.bodyAdmin": "Tornerai immediatamente al piano gratuito. I tuoi crediti esistenti vengono conservati permanentemente.",
   "billing.cancel.modal.confirm": "Conferma annullamento",
   "billing.cancel.modal.back": "Indietro",
   "billing.cancel.successScheduled": "Abbonamento annullato. Il tuo accesso continua fino al {date}.",
   "billing.cancel.successImmediate": "Ora sei sul piano gratuito. I tuoi crediti sono conservati.",
   "errors.cta.upgrade": "Aggiorna",
   "errors.cta.signin": "Accedi",
   "errors.NETWORK.title": "Problema di connessione",
   "errors.NETWORK.body": "Qualcosa è andato storto. Controlla la connessione e riprova.",
   "errors.DOCUMENT_LIMIT_REACHED.title": "Limite documenti raggiunto",
   "errors.DOCUMENT_LIMIT_REACHED.body": "Hai raggiunto il limite di documenti del tuo piano ({limit}). Elimina un vecchio documento o aggiorna il piano per averne di più.",
+  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "Hai raggiunto il limite di documenti del tuo piano ({limit}). Elimina un documento per liberare spazio.",
   "errors.FILE_TOO_LARGE.title": "File troppo grande",
   "errors.FILE_TOO_LARGE.body": "La dimensione massima del file sul tuo piano è {maxMb} MB. Aggiorna per caricamenti più grandi.",
   "errors.UNSUPPORTED_FORMAT.title": "Formato file non supportato",
   "errors.UNSUPPORTED_FORMAT.body": "Carica un file PDF, DOCX, PPTX, XLSX, TXT o MD.",
   "errors.INVALID_FILE_CONTENT.title": "Contenuto file non valido",
   "errors.INVALID_FILE_CONTENT.body": "Il file non corrisponde al formato dichiarato o sembra corrotto.",
   "errors.URL_INVALID.title": "URL non valido",
   "errors.URL_INVALID.body": "Inserisci un URL completo che inizi con http:// o https://.",
   "errors.URL_FETCH_BLOCKED.title": "URL non importabile",
   "errors.URL_FETCH_BLOCKED.body": "Impossibile recuperare questo URL. Prova con una pagina web pubblica.",
   "errors.URL_CONTENT_TOO_LARGE.title": "Pagina troppo grande",
   "errors.URL_CONTENT_TOO_LARGE.body": "La pagina è troppo grande per essere importata.",
   "errors.NO_TEXT_CONTENT.title": "Nessun testo nella pagina",
   "errors.NO_TEXT_CONTENT.body": "Nessun testo leggibile trovato in questa pagina.",
   "errors.URL_FETCH_FAILED.title": "Recupero URL fallito",
   "errors.URL_FETCH_FAILED.body": "Impossibile recuperare l'URL. Riprova più tardi.",
   "errors.DOCUMENT_NOT_FOUND.title": "Documento non trovato",
   "errors.DOCUMENT_NOT_FOUND.body": "Questo documento non esiste o non è tuo.",
   "errors.DOCUMENT_PROCESSING.title": "Elaborazione in corso",
   "errors.DOCUMENT_PROCESSING.body": "Il documento è ancora in elaborazione. Riprova tra un momento.",
   "errors.STORAGE_UNAVAILABLE.title": "Archiviazione non disponibile",
   "errors.STORAGE_UNAVAILABLE.body": "L'archiviazione dei documenti è temporaneamente non disponibile. Riprova tra poco.",
   "errors.INSTRUCTIONS_TOO_LONG.title": "Istruzioni troppo lunghe",
   "errors.INSTRUCTIONS_TOO_LONG.body": "Le istruzioni personalizzate sono limitate a {max} caratteri.",
   "errors.CUSTOM_INSTRUCTIONS_REQUIRE_PRO.title": "Piano Pro richiesto",
   "errors.CUSTOM_INSTRUCTIONS_REQUIRE_PRO.body": "Le istruzioni personalizzate sono disponibili nel piano Pro.",
   "errors.SESSION_LIMIT_REACHED.title": "Limite sessioni raggiunto",
   "errors.SESSION_LIMIT_REACHED.body": "Il piano gratuito è limitato a {limit} sessioni chat per documento. Aggiorna per sessioni illimitate.",
   "errors.SESSION_NOT_FOUND.title": "Sessione non trovata",
   "errors.SESSION_NOT_FOUND.body": "Questa sessione chat non esiste o non è tua.",
   "errors.MESSAGE_NOT_FOUND.title": "Messaggio non trovato",
   "errors.MESSAGE_NOT_FOUND.body": "Il messaggio referenziato non esiste più.",
   "errors.RATE_LIMITED.title": "Troppe richieste",
   "errors.RATE_LIMITED.body": "Rallenta e riprova tra {retryAfter}s.",
   "errors.DEMO_SESSION_LIMIT_REACHED.title": "Limite demo raggiunto",
   "errors.DEMO_SESSION_LIMIT_REACHED.body": "Questo documento demo ha raggiunto la capacità di sessioni. Riprova più tardi.",
   "errors.DEMO_MESSAGE_LIMIT_REACHED.title": "Limite demo raggiunto",
   "errors.DEMO_MESSAGE_LIMIT_REACHED.body": "Hai utilizzato tutti i messaggi demo. Accedi per caricare i tuoi documenti.",
   "errors.INSUFFICIENT_CREDITS.title": "Crediti esauriti",
   "errors.INSUFFICIENT_CREDITS.body": "Servono {required} crediti ma ne hai solo {balance}. Ricarica o aggiorna il piano.",
   "errors.BALANCED_MODE_LIMIT_REACHED.title": "Limite Pro raggiunto",
   "errors.BALANCED_MODE_LIMIT_REACHED.body": "Il piano gratuito include fino a {limit} risposte Pro al mese. Passa a Plus per la modalità Pro illimitata.",
   "errors.CONTINUATION_LIMIT.title": "Limite continuazione raggiunto",
   "errors.CONTINUATION_LIMIT.body": "Puoi continuare una risposta solo {max} volte.",
   "errors.MODE_NOT_ALLOWED.title": "Piano Plus richiesto",
   "errors.MODE_NOT_ALLOWED.body": "Questa modalità è disponibile nel piano Plus.",
   "errors.DOMAIN_MODE_REQUIRES_PLUS.title": "Piano Plus richiesto",
   "errors.DOMAIN_MODE_REQUIRES_PLUS.body": "La modalità dominio Legale e Accademico è disponibile nel piano Plus.",
   "errors.COLLECTION_LIMIT_REACHED.title": "Limite raccolte raggiunto",
   "errors.COLLECTION_LIMIT_REACHED.body": "Il tuo piano consente fino a {limit} raccolte. Aggiorna per averne di più.",
   "errors.COLLECTION_DOC_LIMIT_REACHED.title": "Troppi documenti",
   "errors.COLLECTION_DOC_LIMIT_REACHED.body": "Il tuo piano consente fino a {limit} documenti per raccolta. Aggiorna per averne di più.",
   "errors.COLLECTION_NOT_FOUND.title": "Raccolta non trovata",
   "errors.COLLECTION_NOT_FOUND.body": "Questa raccolta non esiste o non è tua.",
   "errors.EXPORT_REQUIRES_PAID_PLAN.title": "Piano a pagamento richiesto",
   "errors.EXPORT_REQUIRES_PAID_PLAN.body": "L'esportazione in {format} richiede un piano Plus o Pro.",
   "errors.EXPORT_VALIDATION_FAILED.title": "Esportazione fallita",
   "errors.EXPORT_VALIDATION_FAILED.body": "Impossibile creare l'esportazione: questa sessione potrebbe avere troppi messaggi.",
   "errors.EXPORT_RENDERER_FAILED.title": "Esportazione fallita",
   "errors.EXPORT_RENDERER_FAILED.body": "L'esportazione non può essere generata. Riprova.",
   "errors.LAYOUT_TRANSLATION_LIMIT_REACHED.title": "Limite di traduzione PDF raggiunto",
   "errors.LAYOUT_TRANSLATION_LIMIT_REACHED.body": "Il piano gratuito include {limit} traduzioni PDF con layout preservato. Passa a Plus per continuare a usarle.",
   "errors.LAYOUT_TRANSLATION_PAGE_LIMIT_EXCEEDED.title": "PDF troppo lungo per la traduzione con layout",
   "errors.LAYOUT_TRANSLATION_PAGE_LIMIT_EXCEEDED.body": "Questo PDF ha {pageCount} pagine. Il tuo piano attuale supporta la traduzione PDF con layout preservato fino a {maxPages} pagine.",
   "errors.LAYOUT_TRANSLATION_FILE_TOO_LARGE.title": "PDF troppo grande per la traduzione con layout",
   "errors.LAYOUT_TRANSLATION_FILE_TOO_LARGE.body": "La traduzione PDF con layout preservato supporta file fino a {maxMb} MB.",
   "errors.LAYOUT_TRANSLATION_NOT_CONFIGURED.title": "La traduzione PDF è in configurazione",
   "errors.LAYOUT_TRANSLATION_NOT_CONFIGURED.body": "La traduzione PDF con layout preservato è temporaneamente non disponibile mentre il servizio viene configurato.",
   "errors.SHARE_LIMIT_REACHED.title": "Limite condivisioni raggiunto",
   "errors.SHARE_LIMIT_REACHED.body": "Il piano gratuito è limitato a {limit} link di condivisione attivi. Aggiorna per link illimitati.",
   "errors.SHARE_EXPIRED.title": "Condivisione scaduta",
   "errors.SHARE_EXPIRED.body": "Questo link di condivisione è scaduto.",
   "errors.SHARE_NOT_FOUND.title": "Condivisione non trovata",
   "errors.SHARE_NOT_FOUND.body": "Questo link di condivisione non è valido o è stato revocato.",
   "errors.CHUNK_NOT_FOUND.title": "Passaggio non trovato",
   "errors.CHUNK_NOT_FOUND.body": "Il passaggio richiesto non esiste più.",
   "errors.STRIPE_UNAVAILABLE.title": "Fatturazione non disponibile",
   "errors.STRIPE_UNAVAILABLE.body": "La fatturazione è temporaneamente non disponibile. Riprova tra poco.",
   "errors.CHAT_SETUP_ERROR.title": "Avvio chat fallito",
   "errors.CHAT_SETUP_ERROR.body": "Impossibile avviare la chat. Riprova.",
diff --git a/frontend/src/i18n/locales/ja.json b/frontend/src/i18n/locales/ja.json
index 7d2f530..fd50bf9 100644
--- a/frontend/src/i18n/locales/ja.json
+++ b/frontend/src/i18n/locales/ja.json
@@ -2538,160 +2538,161 @@
   "paywall.proMode.cta": "Proモードにアップグレード",
   "paywall.layoutTranslation.title": "PDF全体の翻訳を続ける",
   "paywall.layoutTranslation.body": "無料プランにはレイアウト保持PDF翻訳が2回含まれます。Plusでこのワークフローを継続的な文書作業に使えます。",
   "paywall.layoutTranslation.cta": "PDF翻訳にアップグレード",
   "paywall.domainMode.title": "法律＆学術モードを解放",
   "paywall.domainMode.body": "法律・学術ドメインモードはPlusプランで利用でき、分野に特化した読解のために引用とプロンプトを調整します。",
   "paywall.domainMode.cta": "ドメインモードにアップグレード",
   "paywall.savedQuotes.title": "引用の保存を続ける",
   "paywall.savedQuotes.body": "無料プランでは30件の引用を保存できます。Plusプランでは最大999件まで保存でき、本格的な研究ライブラリを構築できます。",
   "paywall.savedQuotes.cta": "アップグレードしてさらに引用を保存",
   "paywall.benefit.credits": "アクティブなドキュメント作業のための月間クレジット増加",
   "paywall.benefit.modes": "無料プランの制限なしでFlashおよびProモード",
   "paywall.benefit.layoutTranslation": "複雑な論文やレポート向けのレイアウト保持PDF翻訳",
   "paywall.benefit.exports": "引用付き成果物のPDFおよびDOCXエクスポート",
   "layoutTranslation.toolbar": "PDFレイアウトを翻訳",
   "layoutTranslation.chatMessage": "このPDFのレイアウト保持翻訳を開始しました。実行中も作業を続けられます。",
   "layoutTranslation.artifactTitle": "レイアウト保持PDF翻訳",
   "layoutTranslation.summaryQueued": "レイアウトを保持しながらこのPDFを翻訳しています。",
   "layoutTranslation.summarySucceeded": "レイアウト保持PDF翻訳が完了しました。",
   "layoutTranslation.summaryFailed": "レイアウト保持PDF翻訳に失敗しました。",
   "layoutTranslation.downloadPdf": "翻訳済みPDF",
   "layoutTranslation.downloadMarkdown": "Markdown",
   "layoutTranslation.downloadBundle": "一括ファイル",
   "viewer.webSource": "Webソース",
   "viewer.importedUrl": "インポートされたURL",
   "viewer.articleStats": "{{sections}}セクション / {{minutes}}分で読了",
   "viewer.openOriginal": "オリジナルを開く",
   "viewer.sourceOutline": "ソースアウトライン",
   "viewer.section": "セクション",
   "privacy.trustLink": "トラストセンター",
   "profile.tabs.notifications": "通知",
   "footer.imprint": "インプリント",
   "imprint.title": "インプリント",
   "imprint.subtitle": "§ 5 DDG（ドイツデジタルサービス法）に基づく法的開示",
   "terms.section5.title": "ユーザーがアップロードしたコンテンツと知的財産",
   "terms.section5.content": "アップロードしたドキュメントに対するすべての権利はお客様に帰属します。お客様は、各ドキュメントをDocTalkを介してアップロード、保存、処理する法的権利を有していることを確認します。ドキュメントを所有している、作成した、または権利者から有効なライセンスや許可を得ている場合が該当します。許可なく著作権で保護された素材、第三者の営業秘密、プライバシーや守秘義務に違反するコンテンツをアップロードしないでください。DocTalkはお客様のドキュメントを第三者に公開したり公開したりしません。サービスはお客様の質問に回答するためにお客様自身のコンテンツを処理することに限定されています。当社は、通知および削除手続きに基づき、誠意を持って知的財産権を侵害していると判断したコンテンツを削除することがあります。",
   "privacy.controller.title": "データ管理者（GDPR第4条(7)）",
   "privacy.controller.intro": "このウェブサイトにおける個人データの処理の責任者は次のとおりです。",
   "contact.form.title": "メッセージを送信",
   "contact.form.subtitle": "すべてのメッセージを拝読しています。通常の返信時間：1～2営業日。",
   "contact.form.nameLabel": "名前（任意）",
   "contact.form.emailLabel": "メールアドレス",
   "contact.form.messageLabel": "メッセージ",
   "contact.form.messageHint": "最低10文字。Markdownはレンダリングされません。",
   "contact.form.submit": "送信",
   "contact.form.submitting": "送信中…",
   "contact.form.success": "ありがとうございます。メッセージを受け付けました。ご提供いただいたメールアドレスに返信します。",
   "contact.form.error": "エラーが発生しました。もう一度お試しいただくか、直接 support@doctalk.site までメールをお送りください。",
   "billing.currentPlan.title": "現在のプラン",
   "billing.currentPlan.plan": "プラン",
   "billing.currentPlan.status.active": "アクティブ",
   "billing.currentPlan.status.trialing": "トライアル",
   "billing.currentPlan.status.past_due": "支払い期限切れ",
   "billing.currentPlan.status.canceled": "キャンセル済み",
   "billing.currentPlan.status.pending": "チェックアウト中",
   "billing.currentPlan.status.none": "—",
   "billing.currentPlan.managed.stripe": "Stripeで管理",
   "billing.currentPlan.managed.admin": "管理者割り当て",
   "billing.currentPlan.managed.none": "無料プラン",
   "billing.currentPlan.renewsOn": "{date}に更新",
   "billing.currentPlan.endsOn": "{date}に終了",
   "billing.currentPlan.scheduledCancel": "サブスクリプションは{date}に終了します。それまですべての機能をご利用いただけます。",
   "billing.cancel.button": "サブスクリプションをキャンセル",
   "billing.cancel.buttonAdmin": "無料プランに戻す",
   "billing.cancel.tooltipPending": "チェックアウト処理中です。しばらくお待ちください。",
   "billing.cancel.tooltipContactSupport": "サポートにお問い合わせください。",
   "billing.cancel.managePortal": "Stripeで請求管理 →",
   "billing.cancel.modal.title": "サブスクリプションをキャンセル",
   "billing.cancel.modal.bodyStripe": "{plan}サブスクリプションは{date}に終了します。それまですべての{plan}機能をご利用いただけます。既存のクレジットは永続的に保持されます。",
   "billing.cancel.modal.bodyAdmin": "すぐに無料プランに戻ります。既存のクレジットは永続的に保持されます。",
   "billing.cancel.modal.confirm": "キャンセルを確認",
   "billing.cancel.modal.back": "戻る",
   "billing.cancel.successScheduled": "サブスクリプションをキャンセルしました。{date}までアクセス可能です。",
   "billing.cancel.successImmediate": "無料プランに変更しました。クレジットは保持されます。",
   "errors.cta.upgrade": "アップグレード",
   "errors.cta.signin": "サインイン",
   "errors.NETWORK.title": "接続の問題",
   "errors.NETWORK.body": "エラーが発生しました。接続を確認して再試行してください。",
   "errors.DOCUMENT_LIMIT_REACHED.title": "ドキュメント数の上限に達しました",
   "errors.DOCUMENT_LIMIT_REACHED.body": "プランのドキュメント上限（{limit}）に達しました。古いドキュメントを削除するか、アップグレードしてください。",
+  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "プランのドキュメント上限（{limit}）に達しました。ドキュメントを削除して空き容量を確保してください。",
   "errors.FILE_TOO_LARGE.title": "ファイルが大きすぎます",
   "errors.FILE_TOO_LARGE.body": "プランの最大ファイルサイズは{maxMb}MBです。より大きなファイルをアップロードするにはアップグレードしてください。",
   "errors.UNSUPPORTED_FORMAT.title": "サポートされていないファイル形式",
   "errors.UNSUPPORTED_FORMAT.body": "PDF、DOCX、PPTX、XLSX、TXT、またはMDファイルをアップロードしてください。",
   "errors.INVALID_FILE_CONTENT.title": "ファイルの内容が無効です",
   "errors.INVALID_FILE_CONTENT.body": "ファイルが宣言された形式と一致しないか、破損している可能性があります。",
   "errors.URL_INVALID.title": "無効なURL",
   "errors.URL_INVALID.body": "http:// または https:// で始まる完全なURLを入力してください。",
   "errors.URL_FETCH_BLOCKED.title": "URLをインポートできません",
   "errors.URL_FETCH_BLOCKED.body": "このURLを取得できません。公開Webページを試してください。",
   "errors.URL_CONTENT_TOO_LARGE.title": "ページが大きすぎます",
   "errors.URL_CONTENT_TOO_LARGE.body": "ページが大きすぎてインポートできません。",
   "errors.NO_TEXT_CONTENT.title": "ページにテキストがありません",
   "errors.NO_TEXT_CONTENT.body": "このページに読み取り可能なテキストが見つかりませんでした。",
   "errors.URL_FETCH_FAILED.title": "URLの取得に失敗しました",
   "errors.URL_FETCH_FAILED.body": "URLを取得できませんでした。後でもう一度お試しください。",
   "errors.DOCUMENT_NOT_FOUND.title": "ドキュメントが見つかりません",
   "errors.DOCUMENT_NOT_FOUND.body": "このドキュメントは存在しないか、あなたのものではありません。",
   "errors.DOCUMENT_PROCESSING.title": "処理中",
   "errors.DOCUMENT_PROCESSING.body": "ドキュメントはまだ処理中です。しばらくしてからもう一度お試しください。",
   "errors.STORAGE_UNAVAILABLE.title": "ストレージが利用できません",
   "errors.STORAGE_UNAVAILABLE.body": "ドキュメントストレージが一時的に利用できません。しばらくしてからもう一度お試しください。",
   "errors.INSTRUCTIONS_TOO_LONG.title": "指示が長すぎます",
   "errors.INSTRUCTIONS_TOO_LONG.body": "カスタム指示は{max}文字以内です。",
   "errors.CUSTOM_INSTRUCTIONS_REQUIRE_PRO.title": "Proプランが必要です",
   "errors.CUSTOM_INSTRUCTIONS_REQUIRE_PRO.body": "カスタム指示はProプランで利用できます。",
   "errors.SESSION_LIMIT_REACHED.title": "セッション数の上限に達しました",
   "errors.SESSION_LIMIT_REACHED.body": "無料プランはドキュメントあたり{limit}のチャットセッションに制限されています。無制限にするにはアップグレードしてください。",
   "errors.SESSION_NOT_FOUND.title": "セッションが見つかりません",
   "errors.SESSION_NOT_FOUND.body": "このチャットセッションは存在しないか、あなたのものではありません。",
   "errors.MESSAGE_NOT_FOUND.title": "メッセージが見つかりません",
   "errors.MESSAGE_NOT_FOUND.body": "参照されたメッセージはもう存在しません。",
   "errors.RATE_LIMITED.title": "リクエストが多すぎます",
   "errors.RATE_LIMITED.body": "速度を落として、{retryAfter}秒後にもう一度お試しください。",
   "errors.DEMO_SESSION_LIMIT_REACHED.title": "デモの上限に達しました",
   "errors.DEMO_SESSION_LIMIT_REACHED.body": "このデモドキュメントのセッション上限に達しました。後でもう一度お試しください。",
   "errors.DEMO_MESSAGE_LIMIT_REACHED.title": "デモの上限に達しました",
   "errors.DEMO_MESSAGE_LIMIT_REACHED.body": "デモメッセージをすべて使用しました。サインインして自分のドキュメントをアップロードしてください。",
   "errors.INSUFFICIENT_CREDITS.title": "クレジット不足",
   "errors.INSUFFICIENT_CREDITS.body": "{required}クレジットが必要ですが、残高は{balance}です。チャージするかアップグレードしてください。",
   "errors.BALANCED_MODE_LIMIT_REACHED.title": "Proの上限に達しました",
   "errors.BALANCED_MODE_LIMIT_REACHED.body": "無料プランでは月{limit}件までのPro回答が含まれます。Proモードを無制限で利用するにはPlusにアップグレードしてください。",
   "errors.CONTINUATION_LIMIT.title": "続行の上限に達しました",
   "errors.CONTINUATION_LIMIT.body": "応答の続行は{max}回までです。",
   "errors.MODE_NOT_ALLOWED.title": "Plusプランが必要です",
   "errors.MODE_NOT_ALLOWED.body": "このモードはPlusプランで利用できます。",
   "errors.DOMAIN_MODE_REQUIRES_PLUS.title": "Plusプランが必要です",
   "errors.DOMAIN_MODE_REQUIRES_PLUS.body": "法律・学術ドメインモードはPlusプランで利用できます。",
   "errors.COLLECTION_LIMIT_REACHED.title": "コレクション数の上限に達しました",
   "errors.COLLECTION_LIMIT_REACHED.body": "プランでは最大{limit}のコレクションが許可されています。アップグレードしてください。",
   "errors.COLLECTION_DOC_LIMIT_REACHED.title": "ドキュメントが多すぎます",
   "errors.COLLECTION_DOC_LIMIT_REACHED.body": "プランではコレクションあたり最大{limit}のドキュメントが許可されています。アップグレードしてください。",
   "errors.COLLECTION_NOT_FOUND.title": "コレクションが見つかりません",
   "errors.COLLECTION_NOT_FOUND.body": "このコレクションは存在しないか、あなたのものではありません。",
   "errors.EXPORT_REQUIRES_PAID_PLAN.title": "有料プランが必要です",
   "errors.EXPORT_REQUIRES_PAID_PLAN.body": "{format}エクスポートにはPlusまたはProプランが必要です。",
   "errors.EXPORT_VALIDATION_FAILED.title": "エクスポートに失敗しました",
   "errors.EXPORT_VALIDATION_FAILED.body": "エクスポートを作成できませんでした。このセッションにはメッセージが多すぎる可能性があります。",
   "errors.EXPORT_RENDERER_FAILED.title": "エクスポートに失敗しました",
   "errors.EXPORT_RENDERER_FAILED.body": "エクスポートを生成できませんでした。もう一度お試しください。",
   "errors.LAYOUT_TRANSLATION_LIMIT_REACHED.title": "PDF翻訳の上限に達しました",
   "errors.LAYOUT_TRANSLATION_LIMIT_REACHED.body": "無料プランにはレイアウト保持PDF翻訳が{limit}回含まれます。続けるにはPlusにアップグレードしてください。",
   "errors.LAYOUT_TRANSLATION_PAGE_LIMIT_EXCEEDED.title": "PDFがレイアウト翻訳のページ上限を超えています",
   "errors.LAYOUT_TRANSLATION_PAGE_LIMIT_EXCEEDED.body": "このPDFは{pageCount}ページあります。現在のプランでは、レイアウトを保持したPDF翻訳は最大{maxPages}ページまで対応しています。",
   "errors.LAYOUT_TRANSLATION_FILE_TOO_LARGE.title": "PDFが大きすぎてレイアウト翻訳できません",
   "errors.LAYOUT_TRANSLATION_FILE_TOO_LARGE.body": "レイアウトを保持したPDF翻訳は最大{maxMb} MBのファイルまで対応しています。",
   "errors.LAYOUT_TRANSLATION_NOT_CONFIGURED.title": "PDF翻訳を設定中です",
   "errors.LAYOUT_TRANSLATION_NOT_CONFIGURED.body": "サービス設定中のため、レイアウト保持PDF翻訳は一時的に利用できません。",
   "errors.SHARE_LIMIT_REACHED.title": "共有リンクの上限に達しました",
   "errors.SHARE_LIMIT_REACHED.body": "無料プランは{limit}のアクティブな共有リンクに制限されています。無制限にするにはアップグレードしてください。",
   "errors.SHARE_EXPIRED.title": "共有の有効期限切れ",
   "errors.SHARE_EXPIRED.body": "この共有リンクは期限切れです。",
   "errors.SHARE_NOT_FOUND.title": "共有が見つかりません",
   "errors.SHARE_NOT_FOUND.body": "この共有リンクは無効か、取り消されています。",
   "errors.CHUNK_NOT_FOUND.title": "パッセージが見つかりません",
   "errors.CHUNK_NOT_FOUND.body": "要求されたパッセージはもう存在しません。",
   "errors.STRIPE_UNAVAILABLE.title": "請求が利用できません",
   "errors.STRIPE_UNAVAILABLE.body": "請求が一時的に利用できません。しばらくしてからもう一度お試しください。",
   "errors.CHAT_SETUP_ERROR.title": "チャットのセットアップに失敗しました",
   "errors.CHAT_SETUP_ERROR.body": "チャットを開始できませんでした。もう一度お試しください。",
diff --git a/frontend/src/i18n/locales/ko.json b/frontend/src/i18n/locales/ko.json
index 11d2002..d19637b 100644
--- a/frontend/src/i18n/locales/ko.json
+++ b/frontend/src/i18n/locales/ko.json
@@ -2538,160 +2538,161 @@
   "paywall.proMode.cta": "Pro 모드로 업그레이드",
   "paywall.layoutTranslation.title": "전체 PDF 번역을 계속하세요",
   "paywall.layoutTranslation.body": "무료에는 레이아웃 보존 PDF 번역 2회가 포함됩니다. Plus는 활성 문서 작업을 위해 이 워크플로를 해제합니다.",
   "paywall.layoutTranslation.cta": "PDF 번역으로 업그레이드",
   "paywall.domainMode.title": "법률 및 학술 모드 잠금 해제",
   "paywall.domainMode.body": "법률 및 학술 도메인 모드는 Plus 요금제에서 사용할 수 있으며, 분야별 읽기에 맞춰 인용과 프롬프트를 조정합니다.",
   "paywall.domainMode.cta": "도메인 모드로 업그레이드",
   "paywall.savedQuotes.title": "계속 인용문 저장하기",
   "paywall.savedQuotes.body": "무료 플랜은 인용문 30개를 저장할 수 있습니다. Plus 플랜은 최대 999개까지 저장할 수 있어 완전한 리서치 라이브러리를 구축할 수 있습니다.",
   "paywall.savedQuotes.cta": "업그레이드하여 더 많은 인용문 저장",
   "paywall.benefit.credits": "활성 문서 작업을 위한 더 많은 월간 크레딧",
   "paywall.benefit.modes": "무료 플랜 제한 없는 Flash 및 Pro 모드",
   "paywall.benefit.layoutTranslation": "복잡한 논문과 보고서를 위한 레이아웃 보존 PDF 번역",
   "paywall.benefit.exports": "인용된 결과물을 위한 PDF 및 DOCX 내보내기",
   "layoutTranslation.toolbar": "PDF 레이아웃 번역",
   "layoutTranslation.chatMessage": "이 PDF의 레이아웃 보존 번역을 시작했습니다. 실행되는 동안 계속 작업할 수 있습니다.",
   "layoutTranslation.artifactTitle": "레이아웃 보존 PDF 번역",
   "layoutTranslation.summaryQueued": "레이아웃을 유지한 채 이 PDF를 번역하는 중입니다.",
   "layoutTranslation.summarySucceeded": "레이아웃 보존 PDF 번역이 준비되었습니다.",
   "layoutTranslation.summaryFailed": "레이아웃 보존 PDF 번역에 실패했습니다.",
   "layoutTranslation.downloadPdf": "번역된 PDF",
   "layoutTranslation.downloadMarkdown": "Markdown",
   "layoutTranslation.downloadBundle": "번들",
   "viewer.webSource": "웹 출처",
   "viewer.importedUrl": "가져온 URL",
   "viewer.articleStats": "{{sections}}개 섹션 / {{minutes}}분 읽기",
   "viewer.openOriginal": "원본 열기",
   "viewer.sourceOutline": "출처 개요",
   "viewer.section": "섹션",
   "privacy.trustLink": "트러스트 센터",
   "profile.tabs.notifications": "알림",
   "footer.imprint": "법적 고지",
   "imprint.title": "법적 고지",
   "imprint.subtitle": "§ 5 DDG(독일 디지털 서비스법)에 따른 법적 공개",
   "terms.section5.title": "사용자 업로드 콘텐츠 및 지식 재산권",
   "terms.section5.content": "귀하는 업로드한 문서에 대한 모든 권리를 보유합니다. 귀하는 DocTalk를 통해 각 문서를 업로드, 저장 및 처리할 법적 권리가 있음을 확인합니다. 즉, 해당 문서를 소유하거나, 직접 작성했거나, 권리 보유자로부터 유효한 라이선스 또는 허가를 받은 경우에 해당합니다. 사용 권한이 없는 저작물, 제3자의 영업 비밀, 개인정보 또는 기밀 유지 의무를 위반하는 콘텐츠는 업로드하지 마십시오. DocTalk는 귀하의 문서를 제3자에게 호스팅하거나 게시하지 않으며, 서비스는 귀하의 질문에 답변하기 위해 귀하의 콘텐츠를 처리하는 것으로 제한됩니다. 당사는 고지 및 삭제 절차에 따라 지식 재산권을 침해한다고 선의로 판단하는 콘텐츠를 제거할 수 있습니다.",
   "privacy.controller.title": "데이터 컨트롤러(GDPR 제4조(7))",
   "privacy.controller.intro": "이 웹사이트에서 개인 데이터 처리를 담당하는 컨트롤러는 다음과 같습니다:",
   "contact.form.title": "메시지 보내기",
   "contact.form.subtitle": "모든 메시지를 읽습니다. 일반 응답 시간: 1~2 영업일.",
   "contact.form.nameLabel": "이름(선택사항)",
   "contact.form.emailLabel": "이메일",
   "contact.form.messageLabel": "메시지",
   "contact.form.messageHint": "최소 10자. 마크다운은 렌더링되지 않습니다.",
   "contact.form.submit": "메시지 보내기",
   "contact.form.submitting": "보내는 중…",
   "contact.form.success": "감사합니다. 메시지가 전송되었습니다. 제공하신 이메일로 답변드리겠습니다.",
   "contact.form.error": "문제가 발생했습니다. 다시 시도하거나 support@doctalk.site로 직접 이메일을 보내주세요.",
   "billing.currentPlan.title": "현재 요금제",
   "billing.currentPlan.plan": "요금제",
   "billing.currentPlan.status.active": "활성",
   "billing.currentPlan.status.trialing": "체험 중",
   "billing.currentPlan.status.past_due": "결제 연체",
   "billing.currentPlan.status.canceled": "취소됨",
   "billing.currentPlan.status.pending": "결제 진행 중",
   "billing.currentPlan.status.none": "—",
   "billing.currentPlan.managed.stripe": "Stripe를 통해 관리",
   "billing.currentPlan.managed.admin": "관리자 할당",
   "billing.currentPlan.managed.none": "무료 요금제",
   "billing.currentPlan.renewsOn": "{date}에 갱신",
   "billing.currentPlan.endsOn": "{date}에 종료",
   "billing.currentPlan.scheduledCancel": "구독이 {date}에 종료됩니다. 그때까지 모든 기능을 계속 사용할 수 있습니다.",
   "billing.cancel.button": "구독 취소",
   "billing.cancel.buttonAdmin": "무료 요금제로 전환",
   "billing.cancel.tooltipPending": "결제가 진행 중입니다. 잠시 기다려주세요.",
   "billing.cancel.tooltipContactSupport": "고객 지원에 문의해주세요.",
   "billing.cancel.managePortal": "Stripe에서 결제 관리 →",
   "billing.cancel.modal.title": "구독 취소",
   "billing.cancel.modal.bodyStripe": "{plan} 구독이 {date}에 종료됩니다. 그때까지 모든 {plan} 기능을 계속 사용할 수 있습니다. 기존 크레딧은 영구히 유지됩니다.",
   "billing.cancel.modal.bodyAdmin": "즉시 무료 요금제로 전환됩니다. 기존 크레딧은 영구히 유지됩니다.",
   "billing.cancel.modal.confirm": "취소 확인",
   "billing.cancel.modal.back": "뒤로",
   "billing.cancel.successScheduled": "구독이 취소되었습니다. {date}까지 액세스가 유지됩니다.",
   "billing.cancel.successImmediate": "무료 요금제로 전환되었습니다. 크레딧은 유지됩니다.",
   "errors.cta.upgrade": "업그레이드",
   "errors.cta.signin": "로그인",
   "errors.NETWORK.title": "연결 문제",
   "errors.NETWORK.body": "문제가 발생했습니다. 연결을 확인하고 다시 시도해주세요.",
   "errors.DOCUMENT_LIMIT_REACHED.title": "문서 한도 도달",
   "errors.DOCUMENT_LIMIT_REACHED.body": "요금제의 문서 한도({limit})에 도달했습니다. 이전 문서를 삭제하거나 업그레이드하세요.",
+  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "요금제의 문서 한도({limit})에 도달했습니다. 문서를 삭제해 공간을 확보하세요.",
   "errors.FILE_TOO_LARGE.title": "파일이 너무 큼",
   "errors.FILE_TOO_LARGE.body": "요금제의 최대 파일 크기는 {maxMb} MB입니다. 더 큰 파일을 업로드하려면 업그레이드하세요.",
   "errors.UNSUPPORTED_FORMAT.title": "지원되지 않는 파일 형식",
   "errors.UNSUPPORTED_FORMAT.body": "PDF, DOCX, PPTX, XLSX, TXT 또는 MD 파일을 업로드해주세요.",
   "errors.INVALID_FILE_CONTENT.title": "파일 내용이 유효하지 않음",
   "errors.INVALID_FILE_CONTENT.body": "파일이 선언된 형식과 일치하지 않거나 손상된 것 같습니다.",
   "errors.URL_INVALID.title": "잘못된 URL",
   "errors.URL_INVALID.body": "http:// 또는 https://로 시작하는 전체 URL을 입력하세요.",
   "errors.URL_FETCH_BLOCKED.title": "URL을 가져올 수 없음",
   "errors.URL_FETCH_BLOCKED.body": "이 URL을 가져올 수 없습니다. 공개 웹 페이지를 시도해보세요.",
   "errors.URL_CONTENT_TOO_LARGE.title": "페이지가 너무 큼",
   "errors.URL_CONTENT_TOO_LARGE.body": "페이지가 너무 커서 가져올 수 없습니다.",
   "errors.NO_TEXT_CONTENT.title": "페이지에 텍스트 없음",
   "errors.NO_TEXT_CONTENT.body": "이 페이지에서 읽을 수 있는 텍스트를 찾을 수 없습니다.",
   "errors.URL_FETCH_FAILED.title": "URL 가져오기 실패",
   "errors.URL_FETCH_FAILED.body": "URL을 가져올 수 없습니다. 나중에 다시 시도하세요.",
   "errors.DOCUMENT_NOT_FOUND.title": "문서를 찾을 수 없음",
   "errors.DOCUMENT_NOT_FOUND.body": "이 문서가 존재하지 않거나 귀하의 문서가 아닙니다.",
   "errors.DOCUMENT_PROCESSING.title": "처리 중",
   "errors.DOCUMENT_PROCESSING.body": "문서가 아직 처리 중입니다. 잠시 후 다시 시도하세요.",
   "errors.STORAGE_UNAVAILABLE.title": "저장소를 사용할 수 없음",
   "errors.STORAGE_UNAVAILABLE.body": "문서 저장소를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.",
   "errors.INSTRUCTIONS_TOO_LONG.title": "지침이 너무 김",
   "errors.INSTRUCTIONS_TOO_LONG.body": "사용자 지정 지침은 최대 {max}자까지 가능합니다.",
   "errors.CUSTOM_INSTRUCTIONS_REQUIRE_PRO.title": "Pro 요금제 필요",
   "errors.CUSTOM_INSTRUCTIONS_REQUIRE_PRO.body": "사용자 지정 지침은 Pro 요금제에서 사용할 수 있습니다.",
   "errors.SESSION_LIMIT_REACHED.title": "세션 한도 도달",
   "errors.SESSION_LIMIT_REACHED.body": "무료 요금제는 문서당 {limit}개의 채팅 세션으로 제한됩니다. 무제한 사용을 위해 업그레이드하세요.",
   "errors.SESSION_NOT_FOUND.title": "세션을 찾을 수 없음",
   "errors.SESSION_NOT_FOUND.body": "이 채팅 세션이 존재하지 않거나 귀하의 세션이 아닙니다.",
   "errors.MESSAGE_NOT_FOUND.title": "메시지를 찾을 수 없음",
   "errors.MESSAGE_NOT_FOUND.body": "참조된 메시지가 더 이상 존재하지 않습니다.",
   "errors.RATE_LIMITED.title": "요청이 너무 많음",
   "errors.RATE_LIMITED.body": "잠시 기다린 후 {retryAfter}초 후에 다시 시도해주세요.",
   "errors.DEMO_SESSION_LIMIT_REACHED.title": "데모 한도 도달",
   "errors.DEMO_SESSION_LIMIT_REACHED.body": "이 데모 문서의 세션 용량이 초과되었습니다. 나중에 다시 시도하세요.",
   "errors.DEMO_MESSAGE_LIMIT_REACHED.title": "데모 한도 도달",
   "errors.DEMO_MESSAGE_LIMIT_REACHED.body": "모든 데모 메시지를 사용했습니다. 로그인하여 자신의 문서를 업로드하세요.",
   "errors.INSUFFICIENT_CREDITS.title": "크레딧 부족",
   "errors.INSUFFICIENT_CREDITS.body": "{required} 크레딧이 필요하지만 {balance}만 있습니다. 충전하거나 업그레이드하세요.",
   "errors.BALANCED_MODE_LIMIT_REACHED.title": "Pro 한도 도달",
   "errors.BALANCED_MODE_LIMIT_REACHED.body": "무료 요금제는 월 최대 {limit}개의 Pro 답변을 포함합니다. Plus로 업그레이드하여 Pro 모드를 무제한으로 사용하세요.",
   "errors.CONTINUATION_LIMIT.title": "계속하기 한도 도달",
   "errors.CONTINUATION_LIMIT.body": "응답을 최대 {max}번만 계속할 수 있습니다.",
   "errors.MODE_NOT_ALLOWED.title": "Plus 요금제 필요",
   "errors.MODE_NOT_ALLOWED.body": "이 모드는 Plus 요금제에서 사용할 수 있습니다.",
   "errors.DOMAIN_MODE_REQUIRES_PLUS.title": "Plus 요금제 필요",
   "errors.DOMAIN_MODE_REQUIRES_PLUS.body": "법률 및 학술 도메인 모드는 Plus 요금제에서 사용할 수 있습니다.",
   "errors.COLLECTION_LIMIT_REACHED.title": "컬렉션 한도 도달",
   "errors.COLLECTION_LIMIT_REACHED.body": "요금제에서 최대 {limit}개의 컬렉션을 허용합니다. 더 많은 컬렉션을 위해 업그레이드하세요.",
   "errors.COLLECTION_DOC_LIMIT_REACHED.title": "문서가 너무 많음",
   "errors.COLLECTION_DOC_LIMIT_REACHED.body": "요금제에서 컬렉션당 최대 {limit}개의 문서를 허용합니다. 더 많은 문서를 위해 업그레이드하세요.",
   "errors.COLLECTION_NOT_FOUND.title": "컬렉션을 찾을 수 없음",
   "errors.COLLECTION_NOT_FOUND.body": "이 컬렉션이 존재하지 않거나 귀하의 컬렉션이 아닙니다.",
   "errors.EXPORT_REQUIRES_PAID_PLAN.title": "유료 요금제 필요",
   "errors.EXPORT_REQUIRES_PAID_PLAN.body": "{format} 내보내기는 Plus 또는 Pro 요금제가 필요합니다.",
   "errors.EXPORT_VALIDATION_FAILED.title": "내보내기 실패",
   "errors.EXPORT_VALIDATION_FAILED.body": "내보내기를 생성할 수 없습니다. 이 세션에 메시지가 너무 많을 수 있습니다.",
   "errors.EXPORT_RENDERER_FAILED.title": "내보내기 실패",
   "errors.EXPORT_RENDERER_FAILED.body": "내보내기를 생성할 수 없습니다. 다시 시도해주세요.",
   "errors.LAYOUT_TRANSLATION_LIMIT_REACHED.title": "PDF 번역 한도에 도달했습니다",
   "errors.LAYOUT_TRANSLATION_LIMIT_REACHED.body": "무료에는 레이아웃 보존 PDF 번역 {limit}회가 포함됩니다. 계속 사용하려면 Plus로 업그레이드하세요.",
   "errors.LAYOUT_TRANSLATION_PAGE_LIMIT_EXCEEDED.title": "PDF가 레이아웃 번역 페이지 한도를 초과했습니다",
   "errors.LAYOUT_TRANSLATION_PAGE_LIMIT_EXCEEDED.body": "이 PDF는 {pageCount}페이지입니다. 현재 요금제는 레이아웃 보존 PDF 번역을 최대 {maxPages}페이지까지 지원합니다.",
   "errors.LAYOUT_TRANSLATION_FILE_TOO_LARGE.title": "PDF가 너무 커서 레이아웃 번역을 할 수 없습니다",
   "errors.LAYOUT_TRANSLATION_FILE_TOO_LARGE.body": "레이아웃 보존 PDF 번역은 최대 {maxMb} MB 파일까지 지원합니다.",
   "errors.LAYOUT_TRANSLATION_NOT_CONFIGURED.title": "PDF 번역을 설정 중입니다",
   "errors.LAYOUT_TRANSLATION_NOT_CONFIGURED.body": "서비스를 설정하는 동안 레이아웃 보존 PDF 번역을 일시적으로 사용할 수 없습니다.",
   "errors.SHARE_LIMIT_REACHED.title": "공유 한도 도달",
   "errors.SHARE_LIMIT_REACHED.body": "무료 요금제는 최대 {limit}개의 활성 공유 링크로 제한됩니다. 무제한 사용을 위해 업그레이드하세요.",
   "errors.SHARE_EXPIRED.title": "공유 만료됨",
   "errors.SHARE_EXPIRED.body": "이 공유 링크가 만료되었습니다.",
   "errors.SHARE_NOT_FOUND.title": "공유를 찾을 수 없음",
   "errors.SHARE_NOT_FOUND.body": "이 공유 링크가 유효하지 않거나 취소되었습니다.",
   "errors.CHUNK_NOT_FOUND.title": "구절을 찾을 수 없음",
   "errors.CHUNK_NOT_FOUND.body": "요청한 구절이 더 이상 존재하지 않습니다.",
   "errors.STRIPE_UNAVAILABLE.title": "결제를 사용할 수 없음",
   "errors.STRIPE_UNAVAILABLE.body": "결제 시스템을 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.",
   "errors.CHAT_SETUP_ERROR.title": "채팅 설정 실패",
   "errors.CHAT_SETUP_ERROR.body": "채팅을 시작할 수 없습니다. 다시 시도해주세요.",
diff --git a/frontend/src/i18n/locales/pt.json b/frontend/src/i18n/locales/pt.json
index dfa3564..fb72960 100644
--- a/frontend/src/i18n/locales/pt.json
+++ b/frontend/src/i18n/locales/pt.json
@@ -2538,160 +2538,161 @@
   "paywall.proMode.cta": "Faça upgrade para o modo Pro",
   "paywall.layoutTranslation.title": "Continue traduzindo PDFs completos",
   "paywall.layoutTranslation.body": "O gratuito inclui 2 traduções de PDF preservando o layout. O Plus libera esse fluxo para trabalho ativo com documentos.",
   "paywall.layoutTranslation.cta": "Atualizar para tradução de PDF",
   "paywall.domainMode.title": "Desbloqueie o modo Jurídico e Acadêmico",
   "paywall.domainMode.body": "O modo de domínio Jurídico e Acadêmico está disponível no plano Plus, ajustando citações e prompts para leitura específica do domínio.",
   "paywall.domainMode.cta": "Atualizar para o modo de domínio",
   "paywall.savedQuotes.title": "Continue salvando citações",
   "paywall.savedQuotes.body": "O plano gratuito inclui 30 citações salvas. O Plus libera até 999 para montar uma biblioteca de pesquisa completa.",
   "paywall.savedQuotes.cta": "Faça upgrade para salvar mais citações",
   "paywall.benefit.credits": "Mais créditos mensais para trabalho ativo com documentos",
   "paywall.benefit.modes": "Modos Flash e Pro sem o limite do plano gratuito",
   "paywall.benefit.layoutTranslation": "Tradução de PDF preservando o layout para artigos e relatórios complexos",
   "paywall.benefit.exports": "Exportações em PDF e DOCX para entregáveis citados",
   "layoutTranslation.toolbar": "Traduzir layout do PDF",
   "layoutTranslation.chatMessage": "Iniciei uma tradução preservando o layout para este PDF. Você pode continuar trabalhando enquanto ela roda.",
   "layoutTranslation.artifactTitle": "Tradução de PDF com layout preservado",
   "layoutTranslation.summaryQueued": "Traduzindo este PDF enquanto preserva o layout.",
   "layoutTranslation.summarySucceeded": "A tradução de PDF com layout preservado está pronta.",
   "layoutTranslation.summaryFailed": "A tradução de PDF com layout preservado falhou.",
   "layoutTranslation.downloadPdf": "PDF traduzido",
   "layoutTranslation.downloadMarkdown": "Markdown",
   "layoutTranslation.downloadBundle": "Pacote",
   "viewer.webSource": "Fonte web",
   "viewer.importedUrl": "URL importada",
   "viewer.articleStats": "{{sections}} seções / {{minutes}} min de leitura",
   "viewer.openOriginal": "Abrir original",
   "viewer.sourceOutline": "Estrutura da fonte",
   "viewer.section": "Seção",
   "privacy.trustLink": "Central de Confiança",
   "profile.tabs.notifications": "Notificações",
   "footer.imprint": "Impresso",
   "imprint.title": "Impresso",
   "imprint.subtitle": "Divulgação legal conforme § 5 DDG (Lei Alemã de Serviços Digitais)",
   "terms.section5.title": "Conteúdo Enviado pelo Usuário e Propriedade Intelectual",
   "terms.section5.content": "Você mantém todos os direitos sobre os documentos que enviar. Você confirma que tem o direito legal de enviar, armazenar e processar cada documento via DocTalk — seja por ser o proprietário, autor, ou por ter uma licença ou permissão válida do titular dos direitos. Não envie material protegido por direitos autorais sem permissão, segredos comerciais de terceiros ou conteúdo que viole obrigações de privacidade ou confidencialidade. DocTalk não hospeda ou publica seus documentos para terceiros; o serviço se limita a processar seu próprio conteúdo para responder suas perguntas. Podemos remover conteúdo que acreditamos de boa fé infringir direitos de propriedade intelectual conforme nosso procedimento de notificação e remoção.",
   "privacy.controller.title": "Controlador de Dados (GDPR Art. 4(7))",
   "privacy.controller.intro": "O controlador responsável pelo processamento de dados pessoais neste site é:",
   "contact.form.title": "Envie-nos uma mensagem",
   "contact.form.subtitle": "Lemos todas as mensagens. Tempo de resposta típico: 1–2 dias úteis.",
   "contact.form.nameLabel": "Nome (opcional)",
   "contact.form.emailLabel": "E-mail",
   "contact.form.messageLabel": "Mensagem",
   "contact.form.messageHint": "Mínimo de 10 caracteres. Markdown não é renderizado.",
   "contact.form.submit": "Enviar mensagem",
   "contact.form.submitting": "Enviando…",
   "contact.form.success": "Obrigado — sua mensagem está a caminho. Responderemos ao email fornecido.",
   "contact.form.error": "Algo deu errado. Tente novamente ou envie um email diretamente para support@doctalk.site.",
   "billing.currentPlan.title": "Seu plano atual",
   "billing.currentPlan.plan": "Plano",
   "billing.currentPlan.status.active": "Ativo",
   "billing.currentPlan.status.trialing": "Teste",
   "billing.currentPlan.status.past_due": "Pagamento atrasado",
   "billing.currentPlan.status.canceled": "Cancelado",
   "billing.currentPlan.status.pending": "Checkout em andamento",
   "billing.currentPlan.status.none": "—",
   "billing.currentPlan.managed.stripe": "Gerenciado via Stripe",
   "billing.currentPlan.managed.admin": "Atribuído por admin",
   "billing.currentPlan.managed.none": "Plano gratuito",
   "billing.currentPlan.renewsOn": "Renova em {date}",
   "billing.currentPlan.endsOn": "Termina em {date}",
   "billing.currentPlan.scheduledCancel": "Sua assinatura terminará em {date}. Até lá, você mantém todos os recursos.",
   "billing.cancel.button": "Cancelar assinatura",
   "billing.cancel.buttonAdmin": "Voltar ao plano gratuito",
   "billing.cancel.tooltipPending": "Checkout em andamento — aguarde um momento.",
   "billing.cancel.tooltipContactSupport": "Entre em contato com o suporte.",
   "billing.cancel.managePortal": "Gerenciar cobrança no Stripe →",
   "billing.cancel.modal.title": "Cancelar assinatura",
   "billing.cancel.modal.bodyStripe": "Sua assinatura {plan} terminará em {date}. Até lá, você mantém todos os recursos {plan}. Seus créditos existentes são mantidos permanentemente.",
   "billing.cancel.modal.bodyAdmin": "Você retornará ao plano gratuito imediatamente. Seus créditos existentes são mantidos permanentemente.",
   "billing.cancel.modal.confirm": "Confirmar cancelamento",
   "billing.cancel.modal.back": "Voltar",
   "billing.cancel.successScheduled": "Assinatura cancelada. Seu acesso continua até {date}.",
   "billing.cancel.successImmediate": "Você está agora no plano gratuito. Seus créditos foram mantidos.",
   "errors.cta.upgrade": "Fazer upgrade",
   "errors.cta.signin": "Entrar",
   "errors.NETWORK.title": "Problema de conexão",
   "errors.NETWORK.body": "Algo deu errado. Verifique sua conexão e tente novamente.",
   "errors.DOCUMENT_LIMIT_REACHED.title": "Limite de documentos atingido",
   "errors.DOCUMENT_LIMIT_REACHED.body": "Você atingiu o limite de documentos do seu plano ({limit}). Exclua um documento antigo ou faça upgrade para mais.",
+  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "Você atingiu o limite de documentos do seu plano ({limit}). Exclua um documento para liberar espaço.",
   "errors.FILE_TOO_LARGE.title": "Arquivo muito grande",
   "errors.FILE_TOO_LARGE.body": "O tamanho máximo de arquivo no seu plano é {maxMb} MB. Faça upgrade para uploads maiores.",
   "errors.UNSUPPORTED_FORMAT.title": "Formato de arquivo não suportado",
   "errors.UNSUPPORTED_FORMAT.body": "Envie um arquivo PDF, DOCX, PPTX, XLSX, TXT ou MD.",
   "errors.INVALID_FILE_CONTENT.title": "Conteúdo do arquivo inválido",
   "errors.INVALID_FILE_CONTENT.body": "O arquivo não corresponde ao formato declarado ou parece corrompido.",
   "errors.URL_INVALID.title": "URL inválida",
   "errors.URL_INVALID.body": "Insira uma URL completa começando com http:// ou https://.",
   "errors.URL_FETCH_BLOCKED.title": "URL não pode ser importada",
   "errors.URL_FETCH_BLOCKED.body": "Esta URL não pode ser acessada. Tente uma página web pública.",
   "errors.URL_CONTENT_TOO_LARGE.title": "Página muito grande",
   "errors.URL_CONTENT_TOO_LARGE.body": "A página é muito grande para importar.",
   "errors.NO_TEXT_CONTENT.title": "Nenhum texto na página",
   "errors.NO_TEXT_CONTENT.body": "Nenhum texto legível foi encontrado nesta página.",
   "errors.URL_FETCH_FAILED.title": "Falha ao buscar URL",
   "errors.URL_FETCH_FAILED.body": "Não foi possível buscar a URL. Tente novamente mais tarde.",
   "errors.DOCUMENT_NOT_FOUND.title": "Documento não encontrado",
   "errors.DOCUMENT_NOT_FOUND.body": "Este documento não existe ou não é seu.",
   "errors.DOCUMENT_PROCESSING.title": "Ainda processando",
   "errors.DOCUMENT_PROCESSING.body": "O documento ainda está sendo processado. Tente novamente em um momento.",
   "errors.STORAGE_UNAVAILABLE.title": "Armazenamento indisponível",
   "errors.STORAGE_UNAVAILABLE.body": "O armazenamento de documentos está temporariamente indisponível. Tente novamente em breve.",
   "errors.INSTRUCTIONS_TOO_LONG.title": "Instruções muito longas",
   "errors.INSTRUCTIONS_TOO_LONG.body": "As instruções personalizadas são limitadas a {max} caracteres.",
   "errors.CUSTOM_INSTRUCTIONS_REQUIRE_PRO.title": "Plano Pro necessário",
   "errors.CUSTOM_INSTRUCTIONS_REQUIRE_PRO.body": "Instruções personalizadas estão disponíveis no plano Pro.",
   "errors.SESSION_LIMIT_REACHED.title": "Limite de sessões atingido",
   "errors.SESSION_LIMIT_REACHED.body": "O plano gratuito é limitado a {limit} sessões de chat por documento. Faça upgrade para ilimitado.",
   "errors.SESSION_NOT_FOUND.title": "Sessão não encontrada",
   "errors.SESSION_NOT_FOUND.body": "Esta sessão de chat não existe ou não é sua.",
   "errors.MESSAGE_NOT_FOUND.title": "Mensagem não encontrada",
   "errors.MESSAGE_NOT_FOUND.body": "A mensagem referenciada não existe mais.",
   "errors.RATE_LIMITED.title": "Muitas requisições",
   "errors.RATE_LIMITED.body": "Reduza a velocidade e tente novamente em {retryAfter}s.",
   "errors.DEMO_SESSION_LIMIT_REACHED.title": "Limite de demonstração atingido",
   "errors.DEMO_SESSION_LIMIT_REACHED.body": "Este documento de demonstração atingiu sua capacidade de sessões. Tente novamente mais tarde.",
   "errors.DEMO_MESSAGE_LIMIT_REACHED.title": "Limite de demonstração atingido",
   "errors.DEMO_MESSAGE_LIMIT_REACHED.body": "Você usou todas as mensagens de demonstração. Entre para enviar seus próprios documentos.",
   "errors.INSUFFICIENT_CREDITS.title": "Créditos insuficientes",
   "errors.INSUFFICIENT_CREDITS.body": "Você precisa de {required} créditos, mas tem apenas {balance}. Recarregue ou faça upgrade.",
   "errors.BALANCED_MODE_LIMIT_REACHED.title": "Limite Pro atingido",
   "errors.BALANCED_MODE_LIMIT_REACHED.body": "O plano gratuito inclui até {limit} respostas Pro por mês. Faça upgrade para Plus para modo Pro ilimitado.",
   "errors.CONTINUATION_LIMIT.title": "Limite de continuação atingido",
   "errors.CONTINUATION_LIMIT.body": "Você só pode continuar uma resposta {max} vezes.",
   "errors.MODE_NOT_ALLOWED.title": "Plano Plus necessário",
   "errors.MODE_NOT_ALLOWED.body": "Este modo está disponível no plano Plus.",
   "errors.DOMAIN_MODE_REQUIRES_PLUS.title": "Plano Plus necessário",
   "errors.DOMAIN_MODE_REQUIRES_PLUS.body": "O modo de domínio Jurídico e Acadêmico está disponível no plano Plus.",
   "errors.COLLECTION_LIMIT_REACHED.title": "Limite de coleções atingido",
   "errors.COLLECTION_LIMIT_REACHED.body": "Seu plano permite até {limit} coleções. Faça upgrade para mais.",
   "errors.COLLECTION_DOC_LIMIT_REACHED.title": "Muitos documentos",
   "errors.COLLECTION_DOC_LIMIT_REACHED.body": "Seu plano permite até {limit} documentos por coleção. Faça upgrade para mais.",
   "errors.COLLECTION_NOT_FOUND.title": "Coleção não encontrada",
   "errors.COLLECTION_NOT_FOUND.body": "Esta coleção não existe ou não é sua.",
   "errors.EXPORT_REQUIRES_PAID_PLAN.title": "Plano pago necessário",
   "errors.EXPORT_REQUIRES_PAID_PLAN.body": "A exportação em {format} requer um plano Plus ou Pro.",
   "errors.EXPORT_VALIDATION_FAILED.title": "Falha na exportação",
   "errors.EXPORT_VALIDATION_FAILED.body": "Não foi possível gerar a exportação — esta sessão pode ter muitas mensagens.",
   "errors.EXPORT_RENDERER_FAILED.title": "Falha na exportação",
   "errors.EXPORT_RENDERER_FAILED.body": "A exportação não pôde ser gerada. Tente novamente.",
   "errors.LAYOUT_TRANSLATION_LIMIT_REACHED.title": "Limite de tradução de PDF atingido",
   "errors.LAYOUT_TRANSLATION_LIMIT_REACHED.body": "O gratuito inclui {limit} traduções de PDF preservando o layout. Atualize para Plus para continuar usando.",
   "errors.LAYOUT_TRANSLATION_PAGE_LIMIT_EXCEEDED.title": "PDF longo demais para tradução com layout",
   "errors.LAYOUT_TRANSLATION_PAGE_LIMIT_EXCEEDED.body": "Este PDF tem {pageCount} páginas. Seu plano atual permite tradução de PDF preservando o layout até {maxPages} páginas.",
   "errors.LAYOUT_TRANSLATION_FILE_TOO_LARGE.title": "PDF grande demais para tradução com layout",
   "errors.LAYOUT_TRANSLATION_FILE_TOO_LARGE.body": "A tradução de PDF preservando o layout aceita arquivos de até {maxMb} MB.",
   "errors.LAYOUT_TRANSLATION_NOT_CONFIGURED.title": "A tradução de PDF está sendo configurada",
   "errors.LAYOUT_TRANSLATION_NOT_CONFIGURED.body": "A tradução de PDF preservando o layout está temporariamente indisponível enquanto o serviço é configurado.",
   "errors.SHARE_LIMIT_REACHED.title": "Limite de compartilhamento atingido",
   "errors.SHARE_LIMIT_REACHED.body": "O plano gratuito é limitado a {limit} links de compartilhamento ativos. Faça upgrade para ilimitado.",
   "errors.SHARE_EXPIRED.title": "Compartilhamento expirado",
   "errors.SHARE_EXPIRED.body": "Este link de compartilhamento expirou.",
   "errors.SHARE_NOT_FOUND.title": "Compartilhamento não encontrado",
   "errors.SHARE_NOT_FOUND.body": "Este link de compartilhamento é inválido ou foi revogado.",
   "errors.CHUNK_NOT_FOUND.title": "Trecho não encontrado",
   "errors.CHUNK_NOT_FOUND.body": "O trecho solicitado não existe mais.",
   "errors.STRIPE_UNAVAILABLE.title": "Faturamento indisponível",
   "errors.STRIPE_UNAVAILABLE.body": "O faturamento está temporariamente indisponível. Tente novamente em breve.",
   "errors.CHAT_SETUP_ERROR.title": "Falha na configuração do chat",
   "errors.CHAT_SETUP_ERROR.body": "Não foi possível iniciar o chat. Tente novamente.",
diff --git a/frontend/src/i18n/locales/zh.json b/frontend/src/i18n/locales/zh.json
index 584d027..8a30d36 100644
--- a/frontend/src/i18n/locales/zh.json
+++ b/frontend/src/i18n/locales/zh.json
@@ -2577,160 +2577,161 @@
   "paywall.proMode.title": "继续使用 Pro 分析",
   "paywall.proMode.body": "免费版包含有限数量的 Pro 答案。Plus 解锁无限制的 Pro 模式，用于更深入的引用分析。",
   "paywall.proMode.cta": "升级以使用 Pro 模式",
   "paywall.layoutTranslation.title": "继续翻译完整 PDF",
   "paywall.layoutTranslation.body": "免费版包含 2 次保留排版 PDF 翻译。Plus 解锁该工作流，适合高频文档处理。",
   "paywall.layoutTranslation.cta": "升级以使用 PDF 翻译",
   "paywall.domainMode.title": "解锁法律与学术模式",
   "paywall.domainMode.body": "法律和学术领域模式在Plus套餐中可用，为特定领域的阅读优化引用和提示词。",
   "paywall.domainMode.cta": "升级以使用领域模式",
   "paywall.savedQuotes.title": "继续保存引用",
   "paywall.savedQuotes.body": "免费版可保存 30 条引用。Plus 版可解锁最多 999 条，方便构建完整的研究资料库。",
   "paywall.savedQuotes.cta": "升级以保存更多引用",
   "paywall.benefit.credits": "更多月度积分用于活跃文档工作",
   "paywall.benefit.modes": "Flash 和 Pro 模式无免费计划上限",
   "paywall.benefit.layoutTranslation": "复杂论文和报告的保留排版 PDF 翻译",
   "paywall.benefit.exports": "带引用的交付物的 PDF 和 DOCX 导出",
   "layoutTranslation.toolbar": "翻译 PDF 排版",
   "layoutTranslation.chatMessage": "我已开始为这份 PDF 创建保留排版的译文。任务运行时你可以继续使用 DocTalk。",
   "layoutTranslation.artifactTitle": "保留排版的 PDF 翻译",
   "layoutTranslation.summaryQueued": "正在保留排版翻译这份 PDF。",
   "layoutTranslation.summarySucceeded": "保留排版的译文 PDF 已完成。",
   "layoutTranslation.summaryFailed": "保留排版 PDF 翻译失败。",
   "layoutTranslation.downloadPdf": "译文 PDF",
   "layoutTranslation.downloadMarkdown": "Markdown",
   "layoutTranslation.downloadBundle": "打包文件",
   "viewer.webSource": "网页来源",
   "viewer.importedUrl": "导入的 URL",
   "viewer.articleStats": "{{sections}} 节 / {{minutes}} 分钟阅读",
   "viewer.openOriginal": "打开原文",
   "viewer.sourceOutline": "来源大纲",
   "viewer.section": "节",
   "footer.imprint": "法律声明",
   "imprint.title": "法律声明",
   "imprint.subtitle": "根据《德国数字服务法》第5条的法律披露",
   "terms.section5.title": "用户上传内容与知识产权",
   "terms.section5.content": "您保留对所上传文档的所有权利。您确认拥有通过DocTalk上传、存储和处理每份文档的合法权利——无论是您拥有、创作，还是拥有有效许可或权利持有人的授权。请勿上传未经许可的受版权保护材料、第三方商业秘密或违反隐私保密义务的内容。DocTalk不会向第三方托管或发布您的文档；服务仅限于处理您自己的内容以回答您的问题。我们可能会根据通知-删除程序善意地移除我们认为侵犯知识产权的内容。",
   "privacy.controller.title": "数据控制方（GDPR第4条第7款）",
   "privacy.controller.intro": "负责本网站个人数据处理的控制方为：",
   "contact.form.title": "给我们留言",
   "contact.form.subtitle": "我们阅读每一条消息。典型回复时间：1-2个工作日。",
   "contact.form.nameLabel": "姓名（可选）",
   "contact.form.emailLabel": "邮箱",
   "contact.form.messageLabel": "消息",
   "contact.form.messageHint": "至少10个字符。不支持Markdown。",
   "contact.form.submit": "发送消息",
   "contact.form.submitting": "发送中…",
   "contact.form.success": "感谢——您的消息已发出。我们将回复您提供的邮箱。",
   "contact.form.error": "出了点问题。请重试或直接发送邮件至 support@doctalk.site。",
   "billing.currentPlan.title": "当前套餐",
   "billing.currentPlan.plan": "套餐",
   "billing.currentPlan.status.active": "活跃",
   "billing.currentPlan.status.trialing": "试用",
   "billing.currentPlan.status.past_due": "付款逾期",
   "billing.currentPlan.status.canceled": "已取消",
   "billing.currentPlan.status.pending": "结账中",
   "billing.currentPlan.status.none": "—",
   "billing.currentPlan.managed.stripe": "通过Stripe管理",
   "billing.currentPlan.managed.admin": "管理员分配",
   "billing.currentPlan.managed.none": "免费套餐",
   "billing.currentPlan.renewsOn": "续费日期：{date}",
   "billing.currentPlan.endsOn": "结束日期：{date}",
   "billing.currentPlan.scheduledCancel": "您的订阅将于{date}结束。在此之前您保留所有功能。",
   "billing.cancel.button": "取消订阅",
   "billing.cancel.buttonAdmin": "返回免费套餐",
   "billing.cancel.tooltipPending": "结账正在进行中——请稍候。",
   "billing.cancel.tooltipContactSupport": "请联系支持。",
   "billing.cancel.managePortal": "在Stripe中管理账单 →",
   "billing.cancel.modal.title": "取消订阅",
   "billing.cancel.modal.bodyStripe": "您的{plan}订阅将于{date}结束。在此之前您保留所有{plan}功能。您现有的积分将永久保留。",
   "billing.cancel.modal.bodyAdmin": "您将立即返回免费套餐。您现有的积分将永久保留。",
   "billing.cancel.modal.confirm": "确认取消",
   "billing.cancel.modal.back": "返回",
   "billing.cancel.successScheduled": "订阅已取消。您的访问权限持续至{date}。",
   "billing.cancel.successImmediate": "您现在使用免费套餐。您的积分已保留。",
   "errors.cta.upgrade": "升级",
   "errors.cta.signin": "登录",
   "errors.NETWORK.title": "连接问题",
   "errors.NETWORK.body": "出了点问题。请检查您的连接后重试。",
   "errors.DOCUMENT_LIMIT_REACHED.title": "文档数量已达上限",
   "errors.DOCUMENT_LIMIT_REACHED.body": "您已达到套餐的文档数量上限（{limit}）。删除旧文档或升级以获取更多。",
+  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "您已达到套餐的文档数量上限（{limit}）。删除一个文档以释放空间。",
   "errors.FILE_TOO_LARGE.title": "文件过大",
   "errors.FILE_TOO_LARGE.body": "您套餐的最大文件大小为{maxMb} MB。升级以上传更大文件。",
   "errors.UNSUPPORTED_FORMAT.title": "不支持的文件格式",
   "errors.UNSUPPORTED_FORMAT.body": "请上传PDF、DOCX、PPTX、XLSX、TXT或MD文件。",
   "errors.INVALID_FILE_CONTENT.title": "文件内容无效",
   "errors.INVALID_FILE_CONTENT.body": "文件与其声明的格式不匹配，或已损坏。",
   "errors.URL_INVALID.title": "无效的URL",
   "errors.URL_INVALID.body": "请输入以http://或https://开头的完整URL。",
   "errors.URL_FETCH_BLOCKED.title": "无法导入该URL",
   "errors.URL_FETCH_BLOCKED.body": "无法获取此URL。请尝试一个公开网页。",
   "errors.URL_CONTENT_TOO_LARGE.title": "页面过大",
   "errors.URL_CONTENT_TOO_LARGE.body": "该页面过大，无法导入。",
   "errors.NO_TEXT_CONTENT.title": "页面无文本",
   "errors.NO_TEXT_CONTENT.body": "此页面未找到可读文本。",
   "errors.URL_FETCH_FAILED.title": "URL获取失败",
   "errors.URL_FETCH_FAILED.body": "无法获取该URL。请稍后重试。",
   "errors.DOCUMENT_NOT_FOUND.title": "文档未找到",
   "errors.DOCUMENT_NOT_FOUND.body": "该文档不存在或不属于您。",
   "errors.DOCUMENT_PROCESSING.title": "处理中",
   "errors.DOCUMENT_PROCESSING.body": "文档仍在处理中。请稍后重试。",
   "errors.STORAGE_UNAVAILABLE.title": "存储不可用",
   "errors.STORAGE_UNAVAILABLE.body": "文档存储暂时不可用。请稍后重试。",
   "errors.INSTRUCTIONS_TOO_LONG.title": "指令过长",
   "errors.INSTRUCTIONS_TOO_LONG.body": "自定义指令限制为{max}个字符。",
   "errors.CUSTOM_INSTRUCTIONS_REQUIRE_PRO.title": "需要Pro套餐",
   "errors.CUSTOM_INSTRUCTIONS_REQUIRE_PRO.body": "自定义指令仅在Pro套餐中可用。",
   "errors.SESSION_LIMIT_REACHED.title": "会话数量已达上限",
   "errors.SESSION_LIMIT_REACHED.body": "免费套餐每个文档限制{limit}个聊天会话。升级以获取无限会话。",
   "errors.SESSION_NOT_FOUND.title": "会话未找到",
   "errors.SESSION_NOT_FOUND.body": "该聊天会话不存在或不属于您。",
   "errors.MESSAGE_NOT_FOUND.title": "消息未找到",
   "errors.MESSAGE_NOT_FOUND.body": "引用的消息已不存在。",
   "errors.RATE_LIMITED.title": "请求过多",
   "errors.RATE_LIMITED.body": "请减速，{retryAfter}秒后重试。",
   "errors.DEMO_SESSION_LIMIT_REACHED.title": "演示限制已达",
   "errors.DEMO_SESSION_LIMIT_REACHED.body": "此演示文档已达到会话容量。请稍后重试。",
   "errors.DEMO_MESSAGE_LIMIT_REACHED.title": "演示限制已达",
   "errors.DEMO_MESSAGE_LIMIT_REACHED.body": "您已用完所有演示消息。登录以上传您自己的文档。",
   "errors.INSUFFICIENT_CREDITS.title": "积分不足",
   "errors.INSUFFICIENT_CREDITS.body": "需要{required}积分，但您只有{balance}。请充值或升级。",
   "errors.BALANCED_MODE_LIMIT_REACHED.title": "Pro限制已达",
   "errors.BALANCED_MODE_LIMIT_REACHED.body": "免费套餐每月最多{limit}次Pro回答。升级到Plus以无限制使用Pro模式。",
   "errors.CONTINUATION_LIMIT.title": "继续次数已达上限",
   "errors.CONTINUATION_LIMIT.body": "您最多只能继续回复{max}次。",
   "errors.MODE_NOT_ALLOWED.title": "需要Plus套餐",
   "errors.MODE_NOT_ALLOWED.body": "此模式仅在Plus套餐中可用。",
   "errors.DOMAIN_MODE_REQUIRES_PLUS.title": "需要Plus套餐",
   "errors.DOMAIN_MODE_REQUIRES_PLUS.body": "法律和学术领域模式仅在Plus套餐中可用。",
   "errors.COLLECTION_LIMIT_REACHED.title": "收藏夹数量已达上限",
   "errors.COLLECTION_LIMIT_REACHED.body": "您的套餐最多允许{limit}个收藏夹。升级以获取更多。",
   "errors.COLLECTION_DOC_LIMIT_REACHED.title": "文档过多",
   "errors.COLLECTION_DOC_LIMIT_REACHED.body": "您的套餐每个收藏夹最多允许{limit}个文档。升级以获取更多。",
   "errors.COLLECTION_NOT_FOUND.title": "收藏夹未找到",
   "errors.COLLECTION_NOT_FOUND.body": "该收藏夹不存在或不属于您。",
   "errors.EXPORT_REQUIRES_PAID_PLAN.title": "需要付费套餐",
   "errors.EXPORT_REQUIRES_PAID_PLAN.body": "{format}导出需要Plus或Pro套餐。",
   "errors.EXPORT_VALIDATION_FAILED.title": "导出失败",
   "errors.EXPORT_VALIDATION_FAILED.body": "无法构建导出——此会话可能消息过多。",
   "errors.EXPORT_RENDERER_FAILED.title": "导出失败",
   "errors.EXPORT_RENDERER_FAILED.body": "无法生成导出。请重试。",
   "errors.LAYOUT_TRANSLATION_LIMIT_REACHED.title": "PDF 翻译次数已达上限",
   "errors.LAYOUT_TRANSLATION_LIMIT_REACHED.body": "免费版包含 {limit} 次保留排版 PDF 翻译。升级到 Plus 后可继续使用。",
   "errors.LAYOUT_TRANSLATION_PAGE_LIMIT_EXCEEDED.title": "PDF 页数超过翻译上限",
   "errors.LAYOUT_TRANSLATION_PAGE_LIMIT_EXCEEDED.body": "这份 PDF 有 {pageCount} 页。当前计划最多支持 {maxPages} 页的保留排版 PDF 翻译。",
   "errors.LAYOUT_TRANSLATION_FILE_TOO_LARGE.title": "PDF 文件过大，无法保留排版翻译",
   "errors.LAYOUT_TRANSLATION_FILE_TOO_LARGE.body": "保留排版 PDF 翻译最多支持 {maxMb} MB 的文件。",
   "errors.LAYOUT_TRANSLATION_NOT_CONFIGURED.title": "PDF 翻译服务正在配置中",
   "errors.LAYOUT_TRANSLATION_NOT_CONFIGURED.body": "保留排版 PDF 翻译暂时不可用，我们正在完成服务配置。",
   "errors.SHARE_LIMIT_REACHED.title": "分享链接数量已达上限",
   "errors.SHARE_LIMIT_REACHED.body": "免费套餐最多{limit}个活跃分享链接。升级以获取无限。",
   "errors.SHARE_EXPIRED.title": "分享已过期",
   "errors.SHARE_EXPIRED.body": "此分享链接已过期。",
   "errors.SHARE_NOT_FOUND.title": "分享未找到",
   "errors.SHARE_NOT_FOUND.body": "此分享链接无效或已被撤销。",
   "errors.CHUNK_NOT_FOUND.title": "段落未找到",
   "errors.CHUNK_NOT_FOUND.body": "请求的段落已不存在。",
   "errors.STRIPE_UNAVAILABLE.title": "账单不可用",
   "errors.STRIPE_UNAVAILABLE.body": "账单功能暂时不可用。请稍后重试。",
   "errors.CHAT_SETUP_ERROR.title": "聊天启动失败",
   "errors.CHAT_SETUP_ERROR.body": "无法启动聊天。请重试。",
diff --git a/frontend/src/lib/errorCopy.ts b/frontend/src/lib/errorCopy.ts
index 9c970cd..ffa77d8 100644
--- a/frontend/src/lib/errorCopy.ts
+++ b/frontend/src/lib/errorCopy.ts
@@ -1,191 +1,224 @@
 import type { ApiError } from './api';
 import { billingHref, type BillingPlanIntent } from './billingLinks';
 
 export interface ErrorCopy {
   /** Short, one-line summary — suitable for toast title / inline heading. */
   title: string;
   /** Optional longer body with remediation detail + interpolated context. */
   body: string;
   /** Optional CTA button (e.g., upgrade or delete-docs link). */
   cta?: { label: string; href: string };
   severity: 'error' | 'warning' | 'info';
   /**
    * Whether the consumer should auto-open the paywall modal.
    * Only true for 402 credit/mode paywalls and SSE MODE_NOT_ALLOWED
    * (Codex r1 Q2: all other plan-limit 403s use inline CTA, never auto-modal).
+   *
+   * Exception: DOMAIN_MODE_REQUIRES_PLUS (403) auto-opens the modal on the
+   * chat SSE path too, but NOT via this flag — this CODE_TABLE entry
+   * deliberately leaves it unset (P1 Codex review: a stray `true` here was
+   * a latent trap for any future generic errorCopy() consumer that trusts
+   * this doc comment, since every other plan-limit 403 renders inline).
+   * useChatStream.ts's handleStreamError hardcodes the code into its own
+   * paywall-trigger list instead, because the chat SSE error renderer only
+   * ever shows `copy.body` as chat-bubble text — it has no inline-CTA
+   * rendering path the way the REST surfaces (dashboard, collections,
+   * sharing, extraction panel) do, so a 403 here needs the modal or the
+   * user gets no way forward at all.
    */
   openPaywall?: boolean;
 }
 
 type TFn = (key: string, params?: Record<string, string | number>) => string;
 type TOrFn = (key: string, fallback: string, params?: Record<string, string | number>) => string;
 
 /**
  * Minimal shape the mapper needs. Callers pass either an `ApiError`
  * (from api.ts), an SSE `{ code, message, status? }` frame (from sse.ts
  * error event), or any thrown value (falls through to generic copy).
  */
 interface ErrLike {
   code?: unknown;
   status?: unknown;
   detail?: unknown;
   message?: unknown;
 }
 
 type ErrorInput = ApiError | ErrLike | unknown;
 
 function extract(err: ErrorInput): { code: string | null; status: number | null; detail: Record<string, unknown> } {
   if (err && typeof err === 'object') {
     const e = err as ErrLike;
     const rawDetail = e.detail;
     const detail = (rawDetail && typeof rawDetail === 'object')
       ? (rawDetail as Record<string, unknown>)
       : {};
     return {
       code: typeof e.code === 'string' ? e.code : null,
       status: typeof e.status === 'number' ? e.status : null,
       detail,
     };
   }
   return { code: null, status: null, detail: {} };
 }
 
 export function errorCopy(err: ErrorInput, t: TFn, tOr: TOrFn): ErrorCopy {
   // Kept for signature symmetry with existing i18n call-sites.
   void t;
 
   const { code, status, detail } = extract(err);
 
   // Dispatch by canonical code first; fall through by status; finally generic network.
   if (code) {
     const handler = CODE_TABLE[code];
     if (handler) return handler(detail, tOr);
   }
 
   if (status != null) {
     const statusHandler = STATUS_TABLE[status];
     if (statusHandler) return statusHandler(detail, tOr);
   }
 
   return {
     title: tOr('errors.NETWORK.title', 'Connection issue'),
     body: tOr('errors.NETWORK.body', 'Something went wrong. Please check your connection and try again.'),
     severity: 'error',
   };
 }
 
 // ────────────────────────────────────────────────────────────────────
 // Code handlers — one per wire code. Keep these pure + declarative.
 // ────────────────────────────────────────────────────────────────────
 
 type Handler = (detail: Record<string, unknown>, tOr: TOrFn) => ErrorCopy;
 
 function targetPlan(detail: Record<string, unknown>, fallback: BillingPlanIntent = 'plus'): BillingPlanIntent {
   return detail.plan === 'plus' ? 'pro' : fallback;
 }
 
+/**
+ * Like targetPlan(), but for document-cap codes where a Pro user (already
+ * on the top tier) can legitimately hit the limit — e.g. layout_translations.py's
+ * _assert_document_capacity emits `plan: "pro"` — and there is nowhere higher
+ * to send them. Returns undefined in that case so the caller can fall back to
+ * manage/delete copy instead of a bogus "upgrade" CTA that would point a Pro
+ * user at a downgrade (Codex P1 FIX-1: targetPlan()'s ternary only special-cased
+ * "plus", so "pro" silently fell through to the 'plus' fallback).
+ */
+function targetPlanOrNone(detail: Record<string, unknown>): BillingPlanIntent | undefined {
+  if (detail.plan === 'pro') return undefined;
+  return targetPlan(detail);
+}
+
 function upgradeCta(tOr: TOrFn, reason: string, plan: BillingPlanIntent = 'plus') {
   return {
     label: tOr('errors.cta.upgrade', 'Upgrade'),
     href: billingHref({ plan, source: 'limit', reason }),
   };
 }
 
 function requiredPlanCta(detail: Record<string, unknown>, tOr: TOrFn, reason: string) {
   const requiredPlan = detail.required_plan;
   if (requiredPlan === 'plus' || requiredPlan === 'pro') {
     return upgradeCta(tOr, reason, requiredPlan);
   }
   return undefined;
 }
 
 const CODE_TABLE: Record<string, Handler> = {
   // ─── Upload ───
-  DOCUMENT_LIMIT_REACHED: (d, tOr) => ({
-    title: tOr('errors.DOCUMENT_LIMIT_REACHED.title', 'Document limit reached'),
-    body: tOr('errors.DOCUMENT_LIMIT_REACHED.body', 'You\'ve reached your plan\'s document limit ({limit}). Delete an old document or upgrade for more.', {
-      limit: String(d.limit ?? ''),
-    }),
-    cta: upgradeCta(tOr, 'document_limit', targetPlan(d)),
-    severity: 'warning',
-  }),
+  DOCUMENT_LIMIT_REACHED: (d, tOr) => {
+    const plan = targetPlanOrNone(d);
+    return {
+      title: tOr('errors.DOCUMENT_LIMIT_REACHED.title', 'Document limit reached'),
+      body: plan
+        ? tOr('errors.DOCUMENT_LIMIT_REACHED.body', 'You\'ve reached your plan\'s document limit ({limit}). Delete an old document or upgrade for more.', {
+            limit: String(d.limit ?? ''),
+          })
+        : tOr('errors.DOCUMENT_LIMIT_REACHED.bodyTopTier', 'You\'ve reached your plan\'s document limit ({limit}). Delete a document to free up space.', {
+            limit: String(d.limit ?? ''),
+          }),
+      cta: plan ? upgradeCta(tOr, 'document_limit', plan) : undefined,
+      severity: 'warning',
+    };
+  },
   FILE_TOO_LARGE: (d, tOr) => ({
     title: tOr('errors.FILE_TOO_LARGE.title', 'File too large'),
     body: tOr('errors.FILE_TOO_LARGE.body', 'Maximum file size on your plan is {maxMb} MB. Upgrade for larger uploads.', {
       maxMb: String(d.max_mb ?? ''),
     }),
     cta: upgradeCta(tOr, 'file_size', targetPlan(d)),
     severity: 'warning',
   }),
   UNSUPPORTED_FORMAT: (_d, tOr) => ({
     title: tOr('errors.UNSUPPORTED_FORMAT.title', 'Unsupported file format'),
     body: tOr('errors.UNSUPPORTED_FORMAT.body', 'Please upload a PDF, DOCX, PPTX, XLSX, TXT, or MD file.'),
     severity: 'error',
   }),
   INVALID_FILE_CONTENT: (_d, tOr) => ({
     title: tOr('errors.INVALID_FILE_CONTENT.title', 'File content invalid'),
     body: tOr('errors.INVALID_FILE_CONTENT.body', 'The file doesn\'t match its declared format, or appears corrupted.'),
     severity: 'error',
   }),
 
   // ─── URL ingest ───
   URL_INVALID: (_d, tOr) => ({
     title: tOr('errors.URL_INVALID.title', 'Invalid URL'),
     body: tOr('errors.URL_INVALID.body', 'Enter a full URL starting with http:// or https://.'),
     severity: 'error',
   }),
   URL_FETCH_BLOCKED: (_d, tOr) => ({
     title: tOr('errors.URL_FETCH_BLOCKED.title', 'URL can\'t be imported'),
     body: tOr('errors.URL_FETCH_BLOCKED.body', 'This URL can\'t be fetched. Try a public web page.'),
     severity: 'error',
   }),
   URL_CONTENT_TOO_LARGE: (_d, tOr) => ({
     title: tOr('errors.URL_CONTENT_TOO_LARGE.title', 'Page too large'),
     body: tOr('errors.URL_CONTENT_TOO_LARGE.body', 'The page is too large to import.'),
     severity: 'error',
   }),
   NO_TEXT_CONTENT: (_d, tOr) => ({
     title: tOr('errors.NO_TEXT_CONTENT.title', 'No text on page'),
     body: tOr('errors.NO_TEXT_CONTENT.body', 'No readable text was found on this page.'),
     severity: 'error',
   }),
   URL_FETCH_FAILED: (_d, tOr) => ({
     title: tOr('errors.URL_FETCH_FAILED.title', 'URL fetch failed'),
     body: tOr('errors.URL_FETCH_FAILED.body', 'Couldn\'t fetch the URL. Try again later.'),
     severity: 'error',
   }),
 
   // ─── Document state ───
   DOCUMENT_NOT_FOUND: (_d, tOr) => ({
     title: tOr('errors.DOCUMENT_NOT_FOUND.title', 'Document not found'),
     body: tOr('errors.DOCUMENT_NOT_FOUND.body', 'This document doesn\'t exist or isn\'t yours.'),
     severity: 'error',
   }),
   DOCUMENT_PROCESSING: (_d, tOr) => ({
     title: tOr('errors.DOCUMENT_PROCESSING.title', 'Still processing'),
     body: tOr('errors.DOCUMENT_PROCESSING.body', 'The document is still being processed. Try again in a moment.'),
     severity: 'info',
   }),
   STORAGE_UNAVAILABLE: (_d, tOr) => ({
     title: tOr('errors.STORAGE_UNAVAILABLE.title', 'Storage unavailable'),
     body: tOr('errors.STORAGE_UNAVAILABLE.body', 'Document storage is temporarily unavailable. Please try again shortly.'),
     severity: 'error',
   }),
   INSTRUCTIONS_TOO_LONG: (d, tOr) => ({
     title: tOr('errors.INSTRUCTIONS_TOO_LONG.title', 'Instructions too long'),
     body: tOr('errors.INSTRUCTIONS_TOO_LONG.body', 'Custom instructions are limited to {max} characters.', {
       max: String(d.max ?? 2000),
     }),
     severity: 'warning',
   }),
   CUSTOM_INSTRUCTIONS_REQUIRE_PRO: (_d, tOr) => ({
     title: tOr('errors.CUSTOM_INSTRUCTIONS_REQUIRE_PRO.title', 'Pro plan required'),
     body: tOr('errors.CUSTOM_INSTRUCTIONS_REQUIRE_PRO.body', 'Custom instructions are available on the Pro plan.'),
     cta: upgradeCta(tOr, 'custom_instructions', 'pro'),
     severity: 'warning',
   }),
 
   // ─── Sessions / chat ───
   SESSION_LIMIT_REACHED: (d, tOr) => ({
     title: tOr('errors.SESSION_LIMIT_REACHED.title', 'Session limit reached'),
     body: tOr('errors.SESSION_LIMIT_REACHED.body', 'Free plan is limited to {limit} chat sessions per document. Upgrade for unlimited.', {

exec
/bin/zsh -lc 'git status --short && git rev-parse HEAD && git show --stat --oneline bb79453 && git show --stat --oneline 2d4e01a' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
?? .collab/reviews/2026-08-03-p1-hygiene-codex-r2.md
9da2bc4fd78a1c16b53c8522f386908ae90b26fa
bb79453 fix: Pro-tier document cap dead-end + openPaywall comment accuracy (Codex P1)
 frontend/src/i18n/locales/ar.json |  1 +
 frontend/src/i18n/locales/de.json |  1 +
 frontend/src/i18n/locales/en.json |  1 +
 frontend/src/i18n/locales/es.json |  1 +
 frontend/src/i18n/locales/fr.json |  1 +
 frontend/src/i18n/locales/hi.json |  1 +
 frontend/src/i18n/locales/it.json |  1 +
 frontend/src/i18n/locales/ja.json |  1 +
 frontend/src/i18n/locales/ko.json |  1 +
 frontend/src/i18n/locales/pt.json |  1 +
 frontend/src/i18n/locales/zh.json |  1 +
 frontend/src/lib/errorCopy.ts     | 49 ++++++++++++++++++++++++++++++++-------
 12 files changed, 52 insertions(+), 8 deletions(-)
2d4e01a fix(chat): sync persisted domain_mode on ALL successful early returns
 backend/app/services/chat_service.py       |  43 ++++++++++--
 backend/tests/test_quote_intent_routing.py | 102 +++++++++++++++++++++++++++++
 2 files changed, 141 insertions(+), 4 deletions(-)

exec
/bin/zsh -lc "sed -n '1,320p' frontend/src/lib/errorCopy.ts" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
import type { ApiError } from './api';
import { billingHref, type BillingPlanIntent } from './billingLinks';

export interface ErrorCopy {
  /** Short, one-line summary — suitable for toast title / inline heading. */
  title: string;
  /** Optional longer body with remediation detail + interpolated context. */
  body: string;
  /** Optional CTA button (e.g., upgrade or delete-docs link). */
  cta?: { label: string; href: string };
  severity: 'error' | 'warning' | 'info';
  /**
   * Whether the consumer should auto-open the paywall modal.
   * Only true for 402 credit/mode paywalls and SSE MODE_NOT_ALLOWED
   * (Codex r1 Q2: all other plan-limit 403s use inline CTA, never auto-modal).
   *
   * Exception: DOMAIN_MODE_REQUIRES_PLUS (403) auto-opens the modal on the
   * chat SSE path too, but NOT via this flag — this CODE_TABLE entry
   * deliberately leaves it unset (P1 Codex review: a stray `true` here was
   * a latent trap for any future generic errorCopy() consumer that trusts
   * this doc comment, since every other plan-limit 403 renders inline).
   * useChatStream.ts's handleStreamError hardcodes the code into its own
   * paywall-trigger list instead, because the chat SSE error renderer only
   * ever shows `copy.body` as chat-bubble text — it has no inline-CTA
   * rendering path the way the REST surfaces (dashboard, collections,
   * sharing, extraction panel) do, so a 403 here needs the modal or the
   * user gets no way forward at all.
   */
  openPaywall?: boolean;
}

type TFn = (key: string, params?: Record<string, string | number>) => string;
type TOrFn = (key: string, fallback: string, params?: Record<string, string | number>) => string;

/**
 * Minimal shape the mapper needs. Callers pass either an `ApiError`
 * (from api.ts), an SSE `{ code, message, status? }` frame (from sse.ts
 * error event), or any thrown value (falls through to generic copy).
 */
interface ErrLike {
  code?: unknown;
  status?: unknown;
  detail?: unknown;
  message?: unknown;
}

type ErrorInput = ApiError | ErrLike | unknown;

function extract(err: ErrorInput): { code: string | null; status: number | null; detail: Record<string, unknown> } {
  if (err && typeof err === 'object') {
    const e = err as ErrLike;
    const rawDetail = e.detail;
    const detail = (rawDetail && typeof rawDetail === 'object')
      ? (rawDetail as Record<string, unknown>)
      : {};
    return {
      code: typeof e.code === 'string' ? e.code : null,
      status: typeof e.status === 'number' ? e.status : null,
      detail,
    };
  }
  return { code: null, status: null, detail: {} };
}

export function errorCopy(err: ErrorInput, t: TFn, tOr: TOrFn): ErrorCopy {
  // Kept for signature symmetry with existing i18n call-sites.
  void t;

  const { code, status, detail } = extract(err);

  // Dispatch by canonical code first; fall through by status; finally generic network.
  if (code) {
    const handler = CODE_TABLE[code];
    if (handler) return handler(detail, tOr);
  }

  if (status != null) {
    const statusHandler = STATUS_TABLE[status];
    if (statusHandler) return statusHandler(detail, tOr);
  }

  return {
    title: tOr('errors.NETWORK.title', 'Connection issue'),
    body: tOr('errors.NETWORK.body', 'Something went wrong. Please check your connection and try again.'),
    severity: 'error',
  };
}

// ────────────────────────────────────────────────────────────────────
// Code handlers — one per wire code. Keep these pure + declarative.
// ────────────────────────────────────────────────────────────────────

type Handler = (detail: Record<string, unknown>, tOr: TOrFn) => ErrorCopy;

function targetPlan(detail: Record<string, unknown>, fallback: BillingPlanIntent = 'plus'): BillingPlanIntent {
  return detail.plan === 'plus' ? 'pro' : fallback;
}

/**
 * Like targetPlan(), but for document-cap codes where a Pro user (already
 * on the top tier) can legitimately hit the limit — e.g. layout_translations.py's
 * _assert_document_capacity emits `plan: "pro"` — and there is nowhere higher
 * to send them. Returns undefined in that case so the caller can fall back to
 * manage/delete copy instead of a bogus "upgrade" CTA that would point a Pro
 * user at a downgrade (Codex P1 FIX-1: targetPlan()'s ternary only special-cased
 * "plus", so "pro" silently fell through to the 'plus' fallback).
 */
function targetPlanOrNone(detail: Record<string, unknown>): BillingPlanIntent | undefined {
  if (detail.plan === 'pro') return undefined;
  return targetPlan(detail);
}

function upgradeCta(tOr: TOrFn, reason: string, plan: BillingPlanIntent = 'plus') {
  return {
    label: tOr('errors.cta.upgrade', 'Upgrade'),
    href: billingHref({ plan, source: 'limit', reason }),
  };
}

function requiredPlanCta(detail: Record<string, unknown>, tOr: TOrFn, reason: string) {
  const requiredPlan = detail.required_plan;
  if (requiredPlan === 'plus' || requiredPlan === 'pro') {
    return upgradeCta(tOr, reason, requiredPlan);
  }
  return undefined;
}

const CODE_TABLE: Record<string, Handler> = {
  // ─── Upload ───
  DOCUMENT_LIMIT_REACHED: (d, tOr) => {
    const plan = targetPlanOrNone(d);
    return {
      title: tOr('errors.DOCUMENT_LIMIT_REACHED.title', 'Document limit reached'),
      body: plan
        ? tOr('errors.DOCUMENT_LIMIT_REACHED.body', 'You\'ve reached your plan\'s document limit ({limit}). Delete an old document or upgrade for more.', {
            limit: String(d.limit ?? ''),
          })
        : tOr('errors.DOCUMENT_LIMIT_REACHED.bodyTopTier', 'You\'ve reached your plan\'s document limit ({limit}). Delete a document to free up space.', {
            limit: String(d.limit ?? ''),
          }),
      cta: plan ? upgradeCta(tOr, 'document_limit', plan) : undefined,
      severity: 'warning',
    };
  },
  FILE_TOO_LARGE: (d, tOr) => ({
    title: tOr('errors.FILE_TOO_LARGE.title', 'File too large'),
    body: tOr('errors.FILE_TOO_LARGE.body', 'Maximum file size on your plan is {maxMb} MB. Upgrade for larger uploads.', {
      maxMb: String(d.max_mb ?? ''),
    }),
    cta: upgradeCta(tOr, 'file_size', targetPlan(d)),
    severity: 'warning',
  }),
  UNSUPPORTED_FORMAT: (_d, tOr) => ({
    title: tOr('errors.UNSUPPORTED_FORMAT.title', 'Unsupported file format'),
    body: tOr('errors.UNSUPPORTED_FORMAT.body', 'Please upload a PDF, DOCX, PPTX, XLSX, TXT, or MD file.'),
    severity: 'error',
  }),
  INVALID_FILE_CONTENT: (_d, tOr) => ({
    title: tOr('errors.INVALID_FILE_CONTENT.title', 'File content invalid'),
    body: tOr('errors.INVALID_FILE_CONTENT.body', 'The file doesn\'t match its declared format, or appears corrupted.'),
    severity: 'error',
  }),

  // ─── URL ingest ───
  URL_INVALID: (_d, tOr) => ({
    title: tOr('errors.URL_INVALID.title', 'Invalid URL'),
    body: tOr('errors.URL_INVALID.body', 'Enter a full URL starting with http:// or https://.'),
    severity: 'error',
  }),
  URL_FETCH_BLOCKED: (_d, tOr) => ({
    title: tOr('errors.URL_FETCH_BLOCKED.title', 'URL can\'t be imported'),
    body: tOr('errors.URL_FETCH_BLOCKED.body', 'This URL can\'t be fetched. Try a public web page.'),
    severity: 'error',
  }),
  URL_CONTENT_TOO_LARGE: (_d, tOr) => ({
    title: tOr('errors.URL_CONTENT_TOO_LARGE.title', 'Page too large'),
    body: tOr('errors.URL_CONTENT_TOO_LARGE.body', 'The page is too large to import.'),
    severity: 'error',
  }),
  NO_TEXT_CONTENT: (_d, tOr) => ({
    title: tOr('errors.NO_TEXT_CONTENT.title', 'No text on page'),
    body: tOr('errors.NO_TEXT_CONTENT.body', 'No readable text was found on this page.'),
    severity: 'error',
  }),
  URL_FETCH_FAILED: (_d, tOr) => ({
    title: tOr('errors.URL_FETCH_FAILED.title', 'URL fetch failed'),
    body: tOr('errors.URL_FETCH_FAILED.body', 'Couldn\'t fetch the URL. Try again later.'),
    severity: 'error',
  }),

  // ─── Document state ───
  DOCUMENT_NOT_FOUND: (_d, tOr) => ({
    title: tOr('errors.DOCUMENT_NOT_FOUND.title', 'Document not found'),
    body: tOr('errors.DOCUMENT_NOT_FOUND.body', 'This document doesn\'t exist or isn\'t yours.'),
    severity: 'error',
  }),
  DOCUMENT_PROCESSING: (_d, tOr) => ({
    title: tOr('errors.DOCUMENT_PROCESSING.title', 'Still processing'),
    body: tOr('errors.DOCUMENT_PROCESSING.body', 'The document is still being processed. Try again in a moment.'),
    severity: 'info',
  }),
  STORAGE_UNAVAILABLE: (_d, tOr) => ({
    title: tOr('errors.STORAGE_UNAVAILABLE.title', 'Storage unavailable'),
    body: tOr('errors.STORAGE_UNAVAILABLE.body', 'Document storage is temporarily unavailable. Please try again shortly.'),
    severity: 'error',
  }),
  INSTRUCTIONS_TOO_LONG: (d, tOr) => ({
    title: tOr('errors.INSTRUCTIONS_TOO_LONG.title', 'Instructions too long'),
    body: tOr('errors.INSTRUCTIONS_TOO_LONG.body', 'Custom instructions are limited to {max} characters.', {
      max: String(d.max ?? 2000),
    }),
    severity: 'warning',
  }),
  CUSTOM_INSTRUCTIONS_REQUIRE_PRO: (_d, tOr) => ({
    title: tOr('errors.CUSTOM_INSTRUCTIONS_REQUIRE_PRO.title', 'Pro plan required'),
    body: tOr('errors.CUSTOM_INSTRUCTIONS_REQUIRE_PRO.body', 'Custom instructions are available on the Pro plan.'),
    cta: upgradeCta(tOr, 'custom_instructions', 'pro'),
    severity: 'warning',
  }),

  // ─── Sessions / chat ───
  SESSION_LIMIT_REACHED: (d, tOr) => ({
    title: tOr('errors.SESSION_LIMIT_REACHED.title', 'Session limit reached'),
    body: tOr('errors.SESSION_LIMIT_REACHED.body', 'Free plan is limited to {limit} chat sessions per document. Upgrade for unlimited.', {
      limit: String(d.limit ?? ''),
    }),
    cta: upgradeCta(tOr, 'session_limit', 'plus'),
    severity: 'warning',
  }),
  SESSION_NOT_FOUND: (_d, tOr) => ({
    title: tOr('errors.SESSION_NOT_FOUND.title', 'Session not found'),
    body: tOr('errors.SESSION_NOT_FOUND.body', 'This chat session doesn\'t exist or isn\'t yours.'),
    severity: 'error',
  }),
  MESSAGE_NOT_FOUND: (_d, tOr) => ({
    title: tOr('errors.MESSAGE_NOT_FOUND.title', 'Message not found'),
    body: tOr('errors.MESSAGE_NOT_FOUND.body', 'The referenced message no longer exists.'),
    severity: 'error',
  }),
  RATE_LIMITED: (d, tOr) => ({
    title: tOr('errors.RATE_LIMITED.title', 'Too many requests'),
    body: tOr('errors.RATE_LIMITED.body', 'Please slow down and try again in {retryAfter}s.', {
      retryAfter: String(d.retry_after ?? 60),
    }),
    severity: 'warning',
  }),
  DEMO_SESSION_RATE_LIMITED: (d, tOr) => ({
    title: tOr('errors.DEMO_SESSION_RATE_LIMITED.title', 'Too many demo sessions'),
    body: tOr('errors.DEMO_SESSION_RATE_LIMITED.body', 'Please wait {retryAfter}s before creating another demo session.', {
      retryAfter: String(d.retry_after ?? 300),
    }),
    severity: 'warning',
  }),
  DEMO_SESSION_LIMIT_REACHED: (_d, tOr) => ({
    title: tOr('errors.DEMO_SESSION_LIMIT_REACHED.title', 'Demo limit reached'),
    body: tOr('errors.DEMO_SESSION_LIMIT_REACHED.body', 'This demo document has reached its session capacity. Try again later.'),
    severity: 'warning',
  }),
  DEMO_MESSAGE_LIMIT_REACHED: (_d, tOr) => ({
    title: tOr('errors.DEMO_MESSAGE_LIMIT_REACHED.title', 'Demo limit reached'),
    body: tOr('errors.DEMO_MESSAGE_LIMIT_REACHED.body', 'You\'ve used all demo messages. Sign in to upload your own documents.'),
    cta: { label: tOr('errors.cta.signin', 'Sign in'), href: '/auth' },
    severity: 'info',
  }),
  INSUFFICIENT_CREDITS: (d, tOr) => ({
    title: tOr('errors.INSUFFICIENT_CREDITS.title', 'Out of credits'),
    body: tOr('errors.INSUFFICIENT_CREDITS.body', 'You need {required} credits but only have {balance}. Top up or upgrade.', {
      required: String(d.required ?? ''),
      balance: String(d.balance ?? ''),
    }),
    cta: upgradeCta(tOr, 'credits', 'plus'),
    severity: 'warning',
    openPaywall: true,
  }),
  BALANCED_MODE_LIMIT_REACHED: (d, tOr) => ({
    title: tOr('errors.BALANCED_MODE_LIMIT_REACHED.title', 'Pro limit reached'),
    body: tOr(
      'errors.BALANCED_MODE_LIMIT_REACHED.body',
      'Free includes up to {limit} Pro answers per month. Upgrade to Plus for unrestricted Pro mode.',
      { limit: String(d.limit ?? 20) },
    ),
    cta: upgradeCta(tOr, 'pro_mode_limit', 'plus'),
    severity: 'warning',
    openPaywall: true,
  }),
  PRO_MODE_LIMIT_REACHED: (d, tOr) => ({
    title: tOr('errors.PRO_MODE_LIMIT_REACHED.title', 'Pro limit reached'),
    body: tOr(
      'errors.PRO_MODE_LIMIT_REACHED.body',
      'Free includes up to {limit} Pro answers per month. Upgrade to Plus for unrestricted Pro mode.',
      { limit: String(d.limit ?? 20) },
    ),
    cta: upgradeCta(tOr, 'pro_mode_limit', 'plus'),
    severity: 'warning',
    openPaywall: true,
  }),
  CONTINUATION_LIMIT: (d, tOr) => ({
    title: tOr('errors.CONTINUATION_LIMIT.title', 'Continue limit reached'),
    body: tOr('errors.CONTINUATION_LIMIT.body', 'You can only continue a response {max} times.', {
      max: String(d.max ?? 3),
    }),
    severity: 'info',
  }),
  MODE_NOT_ALLOWED: (_d, tOr) => ({
    title: tOr('errors.MODE_NOT_ALLOWED.title', 'Plus plan required'),
    body: tOr('errors.MODE_NOT_ALLOWED.body', 'This mode is available on the Plus plan.'),
    cta: upgradeCta(tOr, 'mode_upgrade', 'plus'),
    severity: 'warning',
    openPaywall: true,
  }),
  DOMAIN_MODE_REQUIRES_PLUS: (d, tOr) => ({
    title: tOr('errors.DOMAIN_MODE_REQUIRES_PLUS.title', 'Plus plan required'),
    body: tOr('errors.DOMAIN_MODE_REQUIRES_PLUS.body', 'Legal and Academic domain mode is available on the Plus plan.'),
    cta: requiredPlanCta(d, tOr, 'domain_mode'),
    severity: 'warning',
  }),

  // ─── Collections ───
  COLLECTION_LIMIT_REACHED: (d, tOr) => ({
    title: tOr('errors.COLLECTION_LIMIT_REACHED.title', 'Collection limit reached'),

exec
/bin/zsh -lc "rg -n -C 4 \"DOCUMENT_LIMIT_REACHED|targetPlanOrNone|targetPlan\\(|getErrorCopy\\(|bodyTopTier|openPaywall\" frontend/src --glob '*.{ts,tsx}'" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc 'git diff --no-ext-diff --unified=30 e499bc7..HEAD -- frontend/src/lib/errorCopy.ts frontend/src/i18n/locales/en.json' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
diff --git a/frontend/src/i18n/locales/en.json b/frontend/src/i18n/locales/en.json
index c449e85..f2493bb 100644
--- a/frontend/src/i18n/locales/en.json
+++ b/frontend/src/i18n/locales/en.json
@@ -2271,60 +2271,61 @@
   "billing.currentPlan.status.active": "Active",
   "billing.currentPlan.status.trialing": "Trial",
   "billing.currentPlan.status.past_due": "Payment past due",
   "billing.currentPlan.status.canceled": "Canceled",
   "billing.currentPlan.status.pending": "Checkout in progress",
   "billing.currentPlan.status.none": "—",
   "billing.currentPlan.managed.stripe": "Managed via Stripe",
   "billing.currentPlan.managed.admin": "Admin-assigned",
   "billing.currentPlan.managed.none": "Free plan",
   "billing.currentPlan.renewsOn": "Renews on {date}",
   "billing.currentPlan.endsOn": "Ends on {date}",
   "billing.currentPlan.scheduledCancel": "Your subscription will end on {date}. Until then you keep all features.",
   "billing.cancel.button": "Cancel subscription",
   "billing.cancel.buttonAdmin": "Return to Free plan",
   "billing.cancel.tooltipPending": "Checkout is in progress — please wait a moment.",
   "billing.cancel.tooltipContactSupport": "Please contact support.",
   "billing.cancel.managePortal": "Manage billing in Stripe →",
   "billing.cancel.modal.title": "Cancel subscription",
   "billing.cancel.modal.bodyStripe": "Your {plan} subscription will end on {date}. Until then you keep all {plan} features. Your existing credits are permanently kept.",
   "billing.cancel.modal.bodyAdmin": "You'll return to the Free plan immediately. Your existing credits are permanently kept.",
   "billing.cancel.modal.confirm": "Confirm cancellation",
   "billing.cancel.modal.back": "Back",
   "billing.cancel.successScheduled": "Subscription canceled. Your access continues until {date}.",
   "billing.cancel.successImmediate": "You're now on the Free plan. Your credits are kept.",
   "errors.cta.upgrade": "Upgrade",
   "errors.cta.signin": "Sign in",
   "errors.NETWORK.title": "Connection issue",
   "errors.NETWORK.body": "Something went wrong. Please check your connection and try again.",
   "errors.DOCUMENT_LIMIT_REACHED.title": "Document limit reached",
   "errors.DOCUMENT_LIMIT_REACHED.body": "You've reached your plan's document limit ({limit}). Delete an old document or upgrade for more.",
+  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "You've reached your plan's document limit ({limit}). Delete a document to free up space.",
   "errors.FILE_TOO_LARGE.title": "File too large",
   "errors.FILE_TOO_LARGE.body": "Maximum file size on your plan is {maxMb} MB. Upgrade for larger uploads.",
   "errors.UNSUPPORTED_FORMAT.title": "Unsupported file format",
   "errors.UNSUPPORTED_FORMAT.body": "Please upload a PDF, DOCX, PPTX, XLSX, TXT, or MD file.",
   "errors.INVALID_FILE_CONTENT.title": "File content invalid",
   "errors.INVALID_FILE_CONTENT.body": "The file doesn't match its declared format, or appears corrupted.",
   "errors.URL_INVALID.title": "Invalid URL",
   "errors.URL_INVALID.body": "Enter a full URL starting with http:// or https://.",
   "errors.URL_FETCH_BLOCKED.title": "URL can't be imported",
   "errors.URL_FETCH_BLOCKED.body": "This URL can't be fetched. Try a public web page.",
   "errors.URL_CONTENT_TOO_LARGE.title": "Page too large",
   "errors.URL_CONTENT_TOO_LARGE.body": "The page is too large to import.",
   "errors.NO_TEXT_CONTENT.title": "No text on page",
   "errors.NO_TEXT_CONTENT.body": "No readable text was found on this page.",
   "errors.URL_FETCH_FAILED.title": "URL fetch failed",
   "errors.URL_FETCH_FAILED.body": "Couldn't fetch the URL. Try again later.",
   "errors.DOCUMENT_NOT_FOUND.title": "Document not found",
   "errors.DOCUMENT_NOT_FOUND.body": "This document doesn't exist or isn't yours.",
   "errors.DOCUMENT_PROCESSING.title": "Still processing",
   "errors.DOCUMENT_PROCESSING.body": "The document is still being processed. Try again in a moment.",
   "errors.STORAGE_UNAVAILABLE.title": "Storage unavailable",
   "errors.STORAGE_UNAVAILABLE.body": "Document storage is temporarily unavailable. Please try again shortly.",
   "errors.INSTRUCTIONS_TOO_LONG.title": "Instructions too long",
   "errors.INSTRUCTIONS_TOO_LONG.body": "Custom instructions are limited to {max} characters.",
   "errors.CUSTOM_INSTRUCTIONS_REQUIRE_PRO.title": "Pro plan required",
   "errors.CUSTOM_INSTRUCTIONS_REQUIRE_PRO.body": "Custom instructions are available on the Pro plan.",
   "errors.SESSION_LIMIT_REACHED.title": "Session limit reached",
   "errors.SESSION_LIMIT_REACHED.body": "Free plan is limited to {limit} chat sessions per document. Upgrade for unlimited.",
   "errors.SESSION_NOT_FOUND.title": "Session not found",
   "errors.SESSION_NOT_FOUND.body": "This chat session doesn't exist or isn't yours.",
diff --git a/frontend/src/lib/errorCopy.ts b/frontend/src/lib/errorCopy.ts
index 9c970cd..ffa77d8 100644
--- a/frontend/src/lib/errorCopy.ts
+++ b/frontend/src/lib/errorCopy.ts
@@ -1,45 +1,57 @@
 import type { ApiError } from './api';
 import { billingHref, type BillingPlanIntent } from './billingLinks';
 
 export interface ErrorCopy {
   /** Short, one-line summary — suitable for toast title / inline heading. */
   title: string;
   /** Optional longer body with remediation detail + interpolated context. */
   body: string;
   /** Optional CTA button (e.g., upgrade or delete-docs link). */
   cta?: { label: string; href: string };
   severity: 'error' | 'warning' | 'info';
   /**
    * Whether the consumer should auto-open the paywall modal.
    * Only true for 402 credit/mode paywalls and SSE MODE_NOT_ALLOWED
    * (Codex r1 Q2: all other plan-limit 403s use inline CTA, never auto-modal).
+   *
+   * Exception: DOMAIN_MODE_REQUIRES_PLUS (403) auto-opens the modal on the
+   * chat SSE path too, but NOT via this flag — this CODE_TABLE entry
+   * deliberately leaves it unset (P1 Codex review: a stray `true` here was
+   * a latent trap for any future generic errorCopy() consumer that trusts
+   * this doc comment, since every other plan-limit 403 renders inline).
+   * useChatStream.ts's handleStreamError hardcodes the code into its own
+   * paywall-trigger list instead, because the chat SSE error renderer only
+   * ever shows `copy.body` as chat-bubble text — it has no inline-CTA
+   * rendering path the way the REST surfaces (dashboard, collections,
+   * sharing, extraction panel) do, so a 403 here needs the modal or the
+   * user gets no way forward at all.
    */
   openPaywall?: boolean;
 }
 
 type TFn = (key: string, params?: Record<string, string | number>) => string;
 type TOrFn = (key: string, fallback: string, params?: Record<string, string | number>) => string;
 
 /**
  * Minimal shape the mapper needs. Callers pass either an `ApiError`
  * (from api.ts), an SSE `{ code, message, status? }` frame (from sse.ts
  * error event), or any thrown value (falls through to generic copy).
  */
 interface ErrLike {
   code?: unknown;
   status?: unknown;
   detail?: unknown;
   message?: unknown;
 }
 
 type ErrorInput = ApiError | ErrLike | unknown;
 
 function extract(err: ErrorInput): { code: string | null; status: number | null; detail: Record<string, unknown> } {
   if (err && typeof err === 'object') {
     const e = err as ErrLike;
     const rawDetail = e.detail;
     const detail = (rawDetail && typeof rawDetail === 'object')
       ? (rawDetail as Record<string, unknown>)
       : {};
     return {
       code: typeof e.code === 'string' ? e.code : null,
@@ -57,85 +69,106 @@ export function errorCopy(err: ErrorInput, t: TFn, tOr: TOrFn): ErrorCopy {
   const { code, status, detail } = extract(err);
 
   // Dispatch by canonical code first; fall through by status; finally generic network.
   if (code) {
     const handler = CODE_TABLE[code];
     if (handler) return handler(detail, tOr);
   }
 
   if (status != null) {
     const statusHandler = STATUS_TABLE[status];
     if (statusHandler) return statusHandler(detail, tOr);
   }
 
   return {
     title: tOr('errors.NETWORK.title', 'Connection issue'),
     body: tOr('errors.NETWORK.body', 'Something went wrong. Please check your connection and try again.'),
     severity: 'error',
   };
 }
 
 // ────────────────────────────────────────────────────────────────────
 // Code handlers — one per wire code. Keep these pure + declarative.
 // ────────────────────────────────────────────────────────────────────
 
 type Handler = (detail: Record<string, unknown>, tOr: TOrFn) => ErrorCopy;
 
 function targetPlan(detail: Record<string, unknown>, fallback: BillingPlanIntent = 'plus'): BillingPlanIntent {
   return detail.plan === 'plus' ? 'pro' : fallback;
 }
 
+/**
+ * Like targetPlan(), but for document-cap codes where a Pro user (already
+ * on the top tier) can legitimately hit the limit — e.g. layout_translations.py's
+ * _assert_document_capacity emits `plan: "pro"` — and there is nowhere higher
+ * to send them. Returns undefined in that case so the caller can fall back to
+ * manage/delete copy instead of a bogus "upgrade" CTA that would point a Pro
+ * user at a downgrade (Codex P1 FIX-1: targetPlan()'s ternary only special-cased
+ * "plus", so "pro" silently fell through to the 'plus' fallback).
+ */
+function targetPlanOrNone(detail: Record<string, unknown>): BillingPlanIntent | undefined {
+  if (detail.plan === 'pro') return undefined;
+  return targetPlan(detail);
+}
+
 function upgradeCta(tOr: TOrFn, reason: string, plan: BillingPlanIntent = 'plus') {
   return {
     label: tOr('errors.cta.upgrade', 'Upgrade'),
     href: billingHref({ plan, source: 'limit', reason }),
   };
 }
 
 function requiredPlanCta(detail: Record<string, unknown>, tOr: TOrFn, reason: string) {
   const requiredPlan = detail.required_plan;
   if (requiredPlan === 'plus' || requiredPlan === 'pro') {
     return upgradeCta(tOr, reason, requiredPlan);
   }
   return undefined;
 }
 
 const CODE_TABLE: Record<string, Handler> = {
   // ─── Upload ───
-  DOCUMENT_LIMIT_REACHED: (d, tOr) => ({
-    title: tOr('errors.DOCUMENT_LIMIT_REACHED.title', 'Document limit reached'),
-    body: tOr('errors.DOCUMENT_LIMIT_REACHED.body', 'You\'ve reached your plan\'s document limit ({limit}). Delete an old document or upgrade for more.', {
-      limit: String(d.limit ?? ''),
-    }),
-    cta: upgradeCta(tOr, 'document_limit', targetPlan(d)),
-    severity: 'warning',
-  }),
+  DOCUMENT_LIMIT_REACHED: (d, tOr) => {
+    const plan = targetPlanOrNone(d);
+    return {
+      title: tOr('errors.DOCUMENT_LIMIT_REACHED.title', 'Document limit reached'),
+      body: plan
+        ? tOr('errors.DOCUMENT_LIMIT_REACHED.body', 'You\'ve reached your plan\'s document limit ({limit}). Delete an old document or upgrade for more.', {
+            limit: String(d.limit ?? ''),
+          })
+        : tOr('errors.DOCUMENT_LIMIT_REACHED.bodyTopTier', 'You\'ve reached your plan\'s document limit ({limit}). Delete a document to free up space.', {
+            limit: String(d.limit ?? ''),
+          }),
+      cta: plan ? upgradeCta(tOr, 'document_limit', plan) : undefined,
+      severity: 'warning',
+    };
+  },
   FILE_TOO_LARGE: (d, tOr) => ({
     title: tOr('errors.FILE_TOO_LARGE.title', 'File too large'),
     body: tOr('errors.FILE_TOO_LARGE.body', 'Maximum file size on your plan is {maxMb} MB. Upgrade for larger uploads.', {
       maxMb: String(d.max_mb ?? ''),
     }),
     cta: upgradeCta(tOr, 'file_size', targetPlan(d)),
     severity: 'warning',
   }),
   UNSUPPORTED_FORMAT: (_d, tOr) => ({
     title: tOr('errors.UNSUPPORTED_FORMAT.title', 'Unsupported file format'),
     body: tOr('errors.UNSUPPORTED_FORMAT.body', 'Please upload a PDF, DOCX, PPTX, XLSX, TXT, or MD file.'),
     severity: 'error',
   }),
   INVALID_FILE_CONTENT: (_d, tOr) => ({
     title: tOr('errors.INVALID_FILE_CONTENT.title', 'File content invalid'),
     body: tOr('errors.INVALID_FILE_CONTENT.body', 'The file doesn\'t match its declared format, or appears corrupted.'),
     severity: 'error',
   }),
 
   // ─── URL ingest ───
   URL_INVALID: (_d, tOr) => ({
     title: tOr('errors.URL_INVALID.title', 'Invalid URL'),
     body: tOr('errors.URL_INVALID.body', 'Enter a full URL starting with http:// or https://.'),
     severity: 'error',
   }),
   URL_FETCH_BLOCKED: (_d, tOr) => ({
     title: tOr('errors.URL_FETCH_BLOCKED.title', 'URL can\'t be imported'),
     body: tOr('errors.URL_FETCH_BLOCKED.body', 'This URL can\'t be fetched. Try a public web page.'),
     severity: 'error',
   }),

 succeeded in 0ms:
frontend/src/lib/errorCopy.ts-25-   * rendering path the way the REST surfaces (dashboard, collections,
frontend/src/lib/errorCopy.ts-26-   * sharing, extraction panel) do, so a 403 here needs the modal or the
frontend/src/lib/errorCopy.ts-27-   * user gets no way forward at all.
frontend/src/lib/errorCopy.ts-28-   */
frontend/src/lib/errorCopy.ts:29:  openPaywall?: boolean;
frontend/src/lib/errorCopy.ts-30-}
frontend/src/lib/errorCopy.ts-31-
frontend/src/lib/errorCopy.ts-32-type TFn = (key: string, params?: Record<string, string | number>) => string;
frontend/src/lib/errorCopy.ts-33-type TOrFn = (key: string, fallback: string, params?: Record<string, string | number>) => string;
--
frontend/src/lib/errorCopy.ts-91-// ────────────────────────────────────────────────────────────────────
frontend/src/lib/errorCopy.ts-92-
frontend/src/lib/errorCopy.ts-93-type Handler = (detail: Record<string, unknown>, tOr: TOrFn) => ErrorCopy;
frontend/src/lib/errorCopy.ts-94-
frontend/src/lib/errorCopy.ts:95:function targetPlan(detail: Record<string, unknown>, fallback: BillingPlanIntent = 'plus'): BillingPlanIntent {
frontend/src/lib/errorCopy.ts-96-  return detail.plan === 'plus' ? 'pro' : fallback;
frontend/src/lib/errorCopy.ts-97-}
frontend/src/lib/errorCopy.ts-98-
frontend/src/lib/errorCopy.ts-99-/**
frontend/src/lib/errorCopy.ts:100: * Like targetPlan(), but for document-cap codes where a Pro user (already
frontend/src/lib/errorCopy.ts-101- * on the top tier) can legitimately hit the limit — e.g. layout_translations.py's
frontend/src/lib/errorCopy.ts-102- * _assert_document_capacity emits `plan: "pro"` — and there is nowhere higher
frontend/src/lib/errorCopy.ts-103- * to send them. Returns undefined in that case so the caller can fall back to
frontend/src/lib/errorCopy.ts-104- * manage/delete copy instead of a bogus "upgrade" CTA that would point a Pro
frontend/src/lib/errorCopy.ts:105: * user at a downgrade (Codex P1 FIX-1: targetPlan()'s ternary only special-cased
frontend/src/lib/errorCopy.ts-106- * "plus", so "pro" silently fell through to the 'plus' fallback).
frontend/src/lib/errorCopy.ts-107- */
frontend/src/lib/errorCopy.ts:108:function targetPlanOrNone(detail: Record<string, unknown>): BillingPlanIntent | undefined {
frontend/src/lib/errorCopy.ts-109-  if (detail.plan === 'pro') return undefined;
frontend/src/lib/errorCopy.ts:110:  return targetPlan(detail);
frontend/src/lib/errorCopy.ts-111-}
frontend/src/lib/errorCopy.ts-112-
frontend/src/lib/errorCopy.ts-113-function upgradeCta(tOr: TOrFn, reason: string, plan: BillingPlanIntent = 'plus') {
frontend/src/lib/errorCopy.ts-114-  return {
--
frontend/src/lib/errorCopy.ts-126-}
frontend/src/lib/errorCopy.ts-127-
frontend/src/lib/errorCopy.ts-128-const CODE_TABLE: Record<string, Handler> = {
frontend/src/lib/errorCopy.ts-129-  // ─── Upload ───
frontend/src/lib/errorCopy.ts:130:  DOCUMENT_LIMIT_REACHED: (d, tOr) => {
frontend/src/lib/errorCopy.ts:131:    const plan = targetPlanOrNone(d);
frontend/src/lib/errorCopy.ts-132-    return {
frontend/src/lib/errorCopy.ts:133:      title: tOr('errors.DOCUMENT_LIMIT_REACHED.title', 'Document limit reached'),
frontend/src/lib/errorCopy.ts-134-      body: plan
frontend/src/lib/errorCopy.ts:135:        ? tOr('errors.DOCUMENT_LIMIT_REACHED.body', 'You\'ve reached your plan\'s document limit ({limit}). Delete an old document or upgrade for more.', {
frontend/src/lib/errorCopy.ts-136-            limit: String(d.limit ?? ''),
frontend/src/lib/errorCopy.ts-137-          })
frontend/src/lib/errorCopy.ts:138:        : tOr('errors.DOCUMENT_LIMIT_REACHED.bodyTopTier', 'You\'ve reached your plan\'s document limit ({limit}). Delete a document to free up space.', {
frontend/src/lib/errorCopy.ts-139-            limit: String(d.limit ?? ''),
frontend/src/lib/errorCopy.ts-140-          }),
frontend/src/lib/errorCopy.ts-141-      cta: plan ? upgradeCta(tOr, 'document_limit', plan) : undefined,
frontend/src/lib/errorCopy.ts-142-      severity: 'warning',
--
frontend/src/lib/errorCopy.ts-146-    title: tOr('errors.FILE_TOO_LARGE.title', 'File too large'),
frontend/src/lib/errorCopy.ts-147-    body: tOr('errors.FILE_TOO_LARGE.body', 'Maximum file size on your plan is {maxMb} MB. Upgrade for larger uploads.', {
frontend/src/lib/errorCopy.ts-148-      maxMb: String(d.max_mb ?? ''),
frontend/src/lib/errorCopy.ts-149-    }),
frontend/src/lib/errorCopy.ts:150:    cta: upgradeCta(tOr, 'file_size', targetPlan(d)),
frontend/src/lib/errorCopy.ts-151-    severity: 'warning',
frontend/src/lib/errorCopy.ts-152-  }),
frontend/src/lib/errorCopy.ts-153-  UNSUPPORTED_FORMAT: (_d, tOr) => ({
frontend/src/lib/errorCopy.ts-154-    title: tOr('errors.UNSUPPORTED_FORMAT.title', 'Unsupported file format'),
--
frontend/src/lib/errorCopy.ts-269-      balance: String(d.balance ?? ''),
frontend/src/lib/errorCopy.ts-270-    }),
frontend/src/lib/errorCopy.ts-271-    cta: upgradeCta(tOr, 'credits', 'plus'),
frontend/src/lib/errorCopy.ts-272-    severity: 'warning',
frontend/src/lib/errorCopy.ts:273:    openPaywall: true,
frontend/src/lib/errorCopy.ts-274-  }),
frontend/src/lib/errorCopy.ts-275-  BALANCED_MODE_LIMIT_REACHED: (d, tOr) => ({
frontend/src/lib/errorCopy.ts-276-    title: tOr('errors.BALANCED_MODE_LIMIT_REACHED.title', 'Pro limit reached'),
frontend/src/lib/errorCopy.ts-277-    body: tOr(
--
frontend/src/lib/errorCopy.ts-280-      { limit: String(d.limit ?? 20) },
frontend/src/lib/errorCopy.ts-281-    ),
frontend/src/lib/errorCopy.ts-282-    cta: upgradeCta(tOr, 'pro_mode_limit', 'plus'),
frontend/src/lib/errorCopy.ts-283-    severity: 'warning',
frontend/src/lib/errorCopy.ts:284:    openPaywall: true,
frontend/src/lib/errorCopy.ts-285-  }),
frontend/src/lib/errorCopy.ts-286-  PRO_MODE_LIMIT_REACHED: (d, tOr) => ({
frontend/src/lib/errorCopy.ts-287-    title: tOr('errors.PRO_MODE_LIMIT_REACHED.title', 'Pro limit reached'),
frontend/src/lib/errorCopy.ts-288-    body: tOr(
--
frontend/src/lib/errorCopy.ts-291-      { limit: String(d.limit ?? 20) },
frontend/src/lib/errorCopy.ts-292-    ),
frontend/src/lib/errorCopy.ts-293-    cta: upgradeCta(tOr, 'pro_mode_limit', 'plus'),
frontend/src/lib/errorCopy.ts-294-    severity: 'warning',
frontend/src/lib/errorCopy.ts:295:    openPaywall: true,
frontend/src/lib/errorCopy.ts-296-  }),
frontend/src/lib/errorCopy.ts-297-  CONTINUATION_LIMIT: (d, tOr) => ({
frontend/src/lib/errorCopy.ts-298-    title: tOr('errors.CONTINUATION_LIMIT.title', 'Continue limit reached'),
frontend/src/lib/errorCopy.ts-299-    body: tOr('errors.CONTINUATION_LIMIT.body', 'You can only continue a response {max} times.', {
--
frontend/src/lib/errorCopy.ts-305-    title: tOr('errors.MODE_NOT_ALLOWED.title', 'Plus plan required'),
frontend/src/lib/errorCopy.ts-306-    body: tOr('errors.MODE_NOT_ALLOWED.body', 'This mode is available on the Plus plan.'),
frontend/src/lib/errorCopy.ts-307-    cta: upgradeCta(tOr, 'mode_upgrade', 'plus'),
frontend/src/lib/errorCopy.ts-308-    severity: 'warning',
frontend/src/lib/errorCopy.ts:309:    openPaywall: true,
frontend/src/lib/errorCopy.ts-310-  }),
frontend/src/lib/errorCopy.ts-311-  DOMAIN_MODE_REQUIRES_PLUS: (d, tOr) => ({
frontend/src/lib/errorCopy.ts-312-    title: tOr('errors.DOMAIN_MODE_REQUIRES_PLUS.title', 'Plus plan required'),
frontend/src/lib/errorCopy.ts-313-    body: tOr('errors.DOMAIN_MODE_REQUIRES_PLUS.body', 'Legal and Academic domain mode is available on the Plus plan.'),
--
frontend/src/lib/errorCopy.ts-320-    title: tOr('errors.COLLECTION_LIMIT_REACHED.title', 'Collection limit reached'),
frontend/src/lib/errorCopy.ts-321-    body: tOr('errors.COLLECTION_LIMIT_REACHED.body', 'Your plan allows up to {limit} collections. Upgrade for more.', {
frontend/src/lib/errorCopy.ts-322-      limit: String(d.limit ?? ''),
frontend/src/lib/errorCopy.ts-323-    }),
frontend/src/lib/errorCopy.ts:324:    cta: upgradeCta(tOr, 'collection_limit', targetPlan(d)),
frontend/src/lib/errorCopy.ts-325-    severity: 'warning',
frontend/src/lib/errorCopy.ts-326-  }),
frontend/src/lib/errorCopy.ts-327-  COLLECTION_DOC_LIMIT_REACHED: (d, tOr) => ({
frontend/src/lib/errorCopy.ts-328-    title: tOr('errors.COLLECTION_DOC_LIMIT_REACHED.title', 'Too many documents'),
frontend/src/lib/errorCopy.ts-329-    body: tOr('errors.COLLECTION_DOC_LIMIT_REACHED.body', 'Your plan allows up to {limit} documents per collection. Upgrade for more.', {
frontend/src/lib/errorCopy.ts-330-      limit: String(d.limit ?? ''),
frontend/src/lib/errorCopy.ts-331-    }),
frontend/src/lib/errorCopy.ts:332:    cta: upgradeCta(tOr, 'collection_doc_limit', targetPlan(d)),
frontend/src/lib/errorCopy.ts-333-    severity: 'warning',
frontend/src/lib/errorCopy.ts-334-  }),
frontend/src/lib/errorCopy.ts-335-  COLLECTION_NOT_FOUND: (_d, tOr) => ({
frontend/src/lib/errorCopy.ts-336-    title: tOr('errors.COLLECTION_NOT_FOUND.title', 'Collection not found'),

exec
/bin/zsh -lc "for f in frontend/src/i18n/locales/{en,zh,ja,ko,es,de,fr,pt,it,ar,hi}.json; do rg -n 'DOCUMENT_LIMIT_REACHED.bodyTopTier' \""'$f"; done' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
2301:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "You've reached your plan's document limit ({limit}). Delete a document to free up space.",
2657:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "您已达到套餐的文档数量上限（{limit}）。删除一个文档以释放空间。",
2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "プランのドキュメント上限（{limit}）に達しました。ドキュメントを削除して空き容量を確保してください。",
2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "요금제의 문서 한도({limit})에 도달했습니다. 문서를 삭제해 공간을 확보하세요.",
2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "Has alcanzado el límite de documentos de tu plan ({limit}). Elimina un documento para liberar espacio.",
2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "Sie haben das Dokumentenlimit Ihres Tarifs erreicht ({limit}). Löschen Sie ein Dokument, um Platz freizugeben.",
2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "Vous avez atteint la limite de documents de votre forfait ({limit}). Supprimez un document pour libérer de l'espace.",
2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "Você atingiu o limite de documentos do seu plano ({limit}). Exclua um documento para liberar espaço.",
2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "Hai raggiunto il limite di documenti del tuo piano ({limit}). Elimina un documento per liberare spazio.",
2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "لقد وصلت إلى حد المستندات في خطتك ({limit}). احذف مستندًا لتحرير مساحة.",
2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "आप अपनी योजना की दस्तावेज़ सीमा ({limit}) तक पहुंच गए हैं। जगह खाली करने के लिए एक दस्तावेज़ हटाएं।",

exec
/bin/zsh -lc "rg -n -C 5 \"function billingHref|export function billingHref|type BillingPlanIntent\" frontend/src/lib/billingLinks.ts frontend/src --glob 'billingLinks.ts'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
frontend/src/lib/billingLinks.ts:1:export type BillingPlanIntent = 'plus' | 'pro';
frontend/src/lib/billingLinks.ts-2-export type BillingPeriodIntent = 'monthly' | 'annual';
frontend/src/lib/billingLinks.ts-3-
frontend/src/lib/billingLinks.ts-4-interface BillingHrefOptions {
frontend/src/lib/billingLinks.ts-5-  plan?: BillingPlanIntent;
frontend/src/lib/billingLinks.ts-6-  period?: BillingPeriodIntent;
frontend/src/lib/billingLinks.ts-7-  source?: string;
frontend/src/lib/billingLinks.ts-8-  reason?: string;
frontend/src/lib/billingLinks.ts-9-}
frontend/src/lib/billingLinks.ts-10-
frontend/src/lib/billingLinks.ts:11:export function billingHref({
frontend/src/lib/billingLinks.ts-12-  plan = 'plus',
frontend/src/lib/billingLinks.ts-13-  period = 'monthly',
frontend/src/lib/billingLinks.ts-14-  source,
frontend/src/lib/billingLinks.ts-15-  reason,
frontend/src/lib/billingLinks.ts-16-}: BillingHrefOptions = {}): string {
--
frontend/src/lib/billingLinks.ts:1:export type BillingPlanIntent = 'plus' | 'pro';
frontend/src/lib/billingLinks.ts-2-export type BillingPeriodIntent = 'monthly' | 'annual';
frontend/src/lib/billingLinks.ts-3-
frontend/src/lib/billingLinks.ts-4-interface BillingHrefOptions {
frontend/src/lib/billingLinks.ts-5-  plan?: BillingPlanIntent;
frontend/src/lib/billingLinks.ts-6-  period?: BillingPeriodIntent;
frontend/src/lib/billingLinks.ts-7-  source?: string;
frontend/src/lib/billingLinks.ts-8-  reason?: string;
frontend/src/lib/billingLinks.ts-9-}
frontend/src/lib/billingLinks.ts-10-
frontend/src/lib/billingLinks.ts:11:export function billingHref({
frontend/src/lib/billingLinks.ts-12-  plan = 'plus',
frontend/src/lib/billingLinks.ts-13-  period = 'monthly',
frontend/src/lib/billingLinks.ts-14-  source,
frontend/src/lib/billingLinks.ts-15-  reason,
frontend/src/lib/billingLinks.ts-16-}: BillingHrefOptions = {}): string {

exec
/bin/zsh -lc "rg -n -C 5 \"errorCopy\\(\" frontend/src --glob '*.{ts,tsx}'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
frontend/src/lib/useDocumentLoader.ts-66-      let info: DocumentResponse;
frontend/src/lib/useDocumentLoader.ts-67-      try {
frontend/src/lib/useDocumentLoader.ts-68-        info = await getDocument(documentId);
frontend/src/lib/useDocumentLoader.ts-69-      } catch (e: unknown) {
frontend/src/lib/useDocumentLoader.ts-70-        if (cancelled) return;
frontend/src/lib/useDocumentLoader.ts:71:        const copy = errorCopy(e, t, tOr);
frontend/src/lib/useDocumentLoader.ts-72-        if (e instanceof ApiError && e.status === 404) {
frontend/src/lib/useDocumentLoader.ts-73-          setError(t('doc.notFound'));
frontend/src/lib/useDocumentLoader.ts-74-        } else {
frontend/src/lib/useDocumentLoader.ts-75-          console.error('Failed to load document metadata:', e);
frontend/src/lib/useDocumentLoader.ts-76-          setError(copy.body || t('doc.loadError'));
--
frontend/src/lib/useDocumentLoader.ts-93-        }
frontend/src/lib/useDocumentLoader.ts-94-
frontend/src/lib/useDocumentLoader.ts-95-        if (info.status === 'error') {
frontend/src/lib/useDocumentLoader.ts-96-          const { code, fallback } = parseWorkerErrorMsg(info.error_msg);
frontend/src/lib/useDocumentLoader.ts-97-          if (code) {
frontend/src/lib/useDocumentLoader.ts:98:            const copy = errorCopy({ code, detail: {} }, t, tOr);
frontend/src/lib/useDocumentLoader.ts-99-            setError(copy.body);
frontend/src/lib/useDocumentLoader.ts-100-          } else {
frontend/src/lib/useDocumentLoader.ts-101-            setError(fallback || t('upload.error'));
frontend/src/lib/useDocumentLoader.ts-102-          }
frontend/src/lib/useDocumentLoader.ts-103-          if (intervalId) clearInterval(intervalId);
--
frontend/src/lib/useDocumentLoader.ts-117-              const file = await getDocumentFileUrl(documentId);
frontend/src/lib/useDocumentLoader.ts-118-              if (cancelled) return;
frontend/src/lib/useDocumentLoader.ts-119-              setPdfUrl(file.url);
frontend/src/lib/useDocumentLoader.ts-120-            } catch (e: unknown) {
frontend/src/lib/useDocumentLoader.ts-121-              if (cancelled) return;
frontend/src/lib/useDocumentLoader.ts:122:              const copy = errorCopy(e, t, tOr);
frontend/src/lib/useDocumentLoader.ts-123-              console.error('Failed to load PDF:', e);
frontend/src/lib/useDocumentLoader.ts-124-              setError(copy.body || t('doc.loadError'));
frontend/src/lib/useDocumentLoader.ts-125-              if (!shouldRetryLoaderError(e) && intervalId) clearInterval(intervalId);
frontend/src/lib/useDocumentLoader.ts-126-              return;
frontend/src/lib/useDocumentLoader.ts-127-            }
--
frontend/src/lib/useDocumentLoader.ts-133-              const file = await getConvertedFileUrl(documentId);
frontend/src/lib/useDocumentLoader.ts-134-              if (cancelled) return;
frontend/src/lib/useDocumentLoader.ts-135-              setConvertedPdfUrl(file.url);
frontend/src/lib/useDocumentLoader.ts-136-            } catch (e: unknown) {
frontend/src/lib/useDocumentLoader.ts-137-              if (cancelled) return;
frontend/src/lib/useDocumentLoader.ts:138:              const copy = errorCopy(e, t, tOr);
frontend/src/lib/useDocumentLoader.ts-139-              console.error('Failed to load converted PDF:', e);
frontend/src/lib/useDocumentLoader.ts-140-              setError(copy.body || t('doc.loadError'));
frontend/src/lib/useDocumentLoader.ts-141-              if (!shouldRetryLoaderError(e) && intervalId) clearInterval(intervalId);
frontend/src/lib/useDocumentLoader.ts-142-              return;
frontend/src/lib/useDocumentLoader.ts-143-            }
--
frontend/src/lib/useChatStream.ts-230-        createdAt: Date.now(),
frontend/src/lib/useChatStream.ts-231-      });
frontend/src/lib/useChatStream.ts-232-      return;
frontend/src/lib/useChatStream.ts-233-    }
frontend/src/lib/useChatStream.ts-234-
frontend/src/lib/useChatStream.ts:235:    const copy = errorCopy(err, t, tOr);
frontend/src/lib/useChatStream.ts-236-    const state = useDocTalkStore.getState();
frontend/src/lib/useChatStream.ts-237-    const currentMessages = state.messages;
frontend/src/lib/useChatStream.ts-238-    const lastMessage = currentMessages[currentMessages.length - 1];
frontend/src/lib/useChatStream.ts-239-    const lastAssistantIsEmpty = lastMessage?.role === 'assistant'
frontend/src/lib/useChatStream.ts-240-      && !lastMessage.text
--
frontend/src/lib/errorCopy.ts-15-   * (Codex r1 Q2: all other plan-limit 403s use inline CTA, never auto-modal).
frontend/src/lib/errorCopy.ts-16-   *
frontend/src/lib/errorCopy.ts-17-   * Exception: DOMAIN_MODE_REQUIRES_PLUS (403) auto-opens the modal on the
frontend/src/lib/errorCopy.ts-18-   * chat SSE path too, but NOT via this flag — this CODE_TABLE entry
frontend/src/lib/errorCopy.ts-19-   * deliberately leaves it unset (P1 Codex review: a stray `true` here was
frontend/src/lib/errorCopy.ts:20:   * a latent trap for any future generic errorCopy() consumer that trusts
frontend/src/lib/errorCopy.ts-21-   * this doc comment, since every other plan-limit 403 renders inline).
frontend/src/lib/errorCopy.ts-22-   * useChatStream.ts's handleStreamError hardcodes the code into its own
frontend/src/lib/errorCopy.ts-23-   * paywall-trigger list instead, because the chat SSE error renderer only
frontend/src/lib/errorCopy.ts-24-   * ever shows `copy.body` as chat-bubble text — it has no inline-CTA
frontend/src/lib/errorCopy.ts-25-   * rendering path the way the REST surfaces (dashboard, collections,
--
frontend/src/lib/errorCopy.ts-60-    };
frontend/src/lib/errorCopy.ts-61-  }
frontend/src/lib/errorCopy.ts-62-  return { code: null, status: null, detail: {} };
frontend/src/lib/errorCopy.ts-63-}
frontend/src/lib/errorCopy.ts-64-
frontend/src/lib/errorCopy.ts:65:export function errorCopy(err: ErrorInput, t: TFn, tOr: TOrFn): ErrorCopy {
frontend/src/lib/errorCopy.ts-66-  // Kept for signature symmetry with existing i18n call-sites.
frontend/src/lib/errorCopy.ts-67-  void t;
frontend/src/lib/errorCopy.ts-68-
frontend/src/lib/errorCopy.ts-69-  const { code, status, detail } = extract(err);
frontend/src/lib/errorCopy.ts-70-
--
frontend/src/components/CustomInstructionsModal.tsx-77-    try {
frontend/src/components/CustomInstructionsModal.tsx-78-      await onSave(text.trim() || null);
frontend/src/components/CustomInstructionsModal.tsx-79-      setSaved(true);
frontend/src/components/CustomInstructionsModal.tsx-80-      setTimeout(() => setSaved(false), 2000);
frontend/src/components/CustomInstructionsModal.tsx-81-    } catch (e) {
frontend/src/components/CustomInstructionsModal.tsx:82:      const copy = errorCopy(e, t, tOr);
frontend/src/components/CustomInstructionsModal.tsx-83-      setError(copy.body);
frontend/src/components/CustomInstructionsModal.tsx-84-    } finally {
frontend/src/components/CustomInstructionsModal.tsx-85-      setSaving(false);
frontend/src/components/CustomInstructionsModal.tsx-86-    }
frontend/src/components/CustomInstructionsModal.tsx-87-  };
--
frontend/src/components/CustomInstructionsModal.tsx-93-      await onSave(null);
frontend/src/components/CustomInstructionsModal.tsx-94-      setText('');
frontend/src/components/CustomInstructionsModal.tsx-95-      setSaved(true);
frontend/src/components/CustomInstructionsModal.tsx-96-      setTimeout(() => setSaved(false), 2000);
frontend/src/components/CustomInstructionsModal.tsx-97-    } catch (e) {
frontend/src/components/CustomInstructionsModal.tsx:98:      const copy = errorCopy(e, t, tOr);
frontend/src/components/CustomInstructionsModal.tsx-99-      setError(copy.body);
frontend/src/components/CustomInstructionsModal.tsx-100-    } finally {
frontend/src/components/CustomInstructionsModal.tsx-101-      setSaving(false);
frontend/src/components/CustomInstructionsModal.tsx-102-    }
frontend/src/components/CustomInstructionsModal.tsx-103-  };
--
frontend/src/components/SessionDropdown.tsx-87-      }
frontend/src/components/SessionDropdown.tsx-88-      setMessages([]);
frontend/src/components/SessionDropdown.tsx-89-      setConfirmDeleteId(null);
frontend/src/components/SessionDropdown.tsx-90-      setOpen(false);
frontend/src/components/SessionDropdown.tsx-91-    } catch (e) {
frontend/src/components/SessionDropdown.tsx:92:      const copy = errorCopy(e, t, tOr);
frontend/src/components/SessionDropdown.tsx-93-      setSessionErrorCopy(copy);
frontend/src/components/SessionDropdown.tsx-94-      if (copy.cta) {
frontend/src/components/SessionDropdown.tsx-95-        trackEvent('limit_hit', { source: 'session_dropdown', reason: 'session_limit' });
frontend/src/components/SessionDropdown.tsx-96-      }
frontend/src/components/SessionDropdown.tsx-97-    }
--
frontend/src/components/Quotes/QuoteFinderPanel.tsx-146-          setSavedQuotes(quotes);
frontend/src/components/Quotes/QuoteFinderPanel.tsx-147-        }
frontend/src/components/Quotes/QuoteFinderPanel.tsx-148-      })
frontend/src/components/Quotes/QuoteFinderPanel.tsx-149-      .catch((err) => {
frontend/src/components/Quotes/QuoteFinderPanel.tsx-150-        if (cancelled) return;
frontend/src/components/Quotes/QuoteFinderPanel.tsx:151:        const copy = errorCopy(err, t, tOr);
frontend/src/components/Quotes/QuoteFinderPanel.tsx-152-        setSavedErrorMsg(copy.body || copy.title);
frontend/src/components/Quotes/QuoteFinderPanel.tsx-153-      })
frontend/src/components/Quotes/QuoteFinderPanel.tsx-154-      .finally(() => {
frontend/src/components/Quotes/QuoteFinderPanel.tsx-155-        if (!cancelled) setSavedLoading(false);
frontend/src/components/Quotes/QuoteFinderPanel.tsx-156-      });
--
frontend/src/components/Quotes/QuoteFinderPanel.tsx-209-        });
frontend/src/components/Quotes/QuoteFinderPanel.tsx-210-      } else if (err instanceof ApiError && err.status === 401) {
frontend/src/components/Quotes/QuoteFinderPanel.tsx-211-        onClose();
frontend/src/components/Quotes/QuoteFinderPanel.tsx-212-        openAuthModal();
frontend/src/components/Quotes/QuoteFinderPanel.tsx-213-      } else {
frontend/src/components/Quotes/QuoteFinderPanel.tsx:214:        const copy = errorCopy(err, t, tOr);
frontend/src/components/Quotes/QuoteFinderPanel.tsx-215-        setErrorMsg(copy.body || copy.title);
frontend/src/components/Quotes/QuoteFinderPanel.tsx-216-      }
frontend/src/components/Quotes/QuoteFinderPanel.tsx-217-    } finally {
frontend/src/components/Quotes/QuoteFinderPanel.tsx-218-      if (openGenerationRef.current === generation) {
frontend/src/components/Quotes/QuoteFinderPanel.tsx-219-        setLoading(false);
--
frontend/src/components/Collections/CreateCollectionModal.tsx-67-    try {
frontend/src/components/Collections/CreateCollectionModal.tsx-68-      const result = await createCollection(name.trim(), description.trim() || undefined, Array.from(selectedDocs));
frontend/src/components/Collections/CreateCollectionModal.tsx-69-      onCreated(result.id);
frontend/src/components/Collections/CreateCollectionModal.tsx-70-      onClose();
frontend/src/components/Collections/CreateCollectionModal.tsx-71-    } catch (e) {
frontend/src/components/Collections/CreateCollectionModal.tsx:72:      const copy = errorCopy(e, t, tOr);
frontend/src/components/Collections/CreateCollectionModal.tsx-73-      setCreateErrorCopy(copy);
frontend/src/components/Collections/CreateCollectionModal.tsx-74-      if (copy.cta) {
frontend/src/components/Collections/CreateCollectionModal.tsx-75-        trackEvent('limit_hit', {
frontend/src/components/Collections/CreateCollectionModal.tsx-76-          source: 'create_collection_modal',
frontend/src/components/Collections/CreateCollectionModal.tsx-77-          reason: copy.cta.href.includes('collection_doc_limit') ? 'collection_doc_limit' : 'collection_limit',
--
frontend/src/components/Chat/ChatPanel.tsx-355-      a.click();
frontend/src/components/Chat/ChatPanel.tsx-356-      document.body.removeChild(a);
frontend/src/components/Chat/ChatPanel.tsx-357-      URL.revokeObjectURL(url);
frontend/src/components/Chat/ChatPanel.tsx-358-    } catch (e) {
frontend/src/components/Chat/ChatPanel.tsx-359-      console.error('Export failed:', e);
frontend/src/components/Chat/ChatPanel.tsx:360:      const copy = errorCopy(e, t, tOr);
frontend/src/components/Chat/ChatPanel.tsx-361-      addMessage({
frontend/src/components/Chat/ChatPanel.tsx-362-        id: `m_${Date.now()}_exp`,
frontend/src/components/Chat/ChatPanel.tsx-363-        role: 'assistant',
frontend/src/components/Chat/ChatPanel.tsx-364-        text: copy.body,
frontend/src/components/Chat/ChatPanel.tsx-365-        isError: true,
--
frontend/src/components/Chat/ChatPanel.tsx-402-        text: tOr('share.copied', 'Link copied to clipboard.'),
frontend/src/components/Chat/ChatPanel.tsx-403-        createdAt: Date.now(),
frontend/src/components/Chat/ChatPanel.tsx-404-      });
frontend/src/components/Chat/ChatPanel.tsx-405-    } catch (e) {
frontend/src/components/Chat/ChatPanel.tsx-406-      console.error('Share failed:', e);
frontend/src/components/Chat/ChatPanel.tsx:407:      const copy = errorCopy(e, t, tOr);
frontend/src/components/Chat/ChatPanel.tsx-408-      addMessage({
frontend/src/components/Chat/ChatPanel.tsx-409-        id: `m_${Date.now()}_share_err`,
frontend/src/components/Chat/ChatPanel.tsx-410-        role: 'assistant',
frontend/src/components/Chat/ChatPanel.tsx-411-        text: copy.cta ? `${copy.body}\n\n[${copy.cta.label}](${copy.cta.href})` : copy.body,
frontend/src/components/Chat/ChatPanel.tsx-412-        isError: true,
--
frontend/src/components/Chat/ChatPanel.tsx-432-        text: tOr('share.answerCopied', 'Answer link copied to clipboard.'),
frontend/src/components/Chat/ChatPanel.tsx-433-        createdAt: Date.now(),
frontend/src/components/Chat/ChatPanel.tsx-434-      });
frontend/src/components/Chat/ChatPanel.tsx-435-    } catch (e) {
frontend/src/components/Chat/ChatPanel.tsx-436-      console.error('Answer share failed:', e);
frontend/src/components/Chat/ChatPanel.tsx:437:      const copy = errorCopy(e, t, tOr);
frontend/src/components/Chat/ChatPanel.tsx-438-      addMessage({
frontend/src/components/Chat/ChatPanel.tsx-439-        id: `m_${Date.now()}_share_answer_err`,
frontend/src/components/Chat/ChatPanel.tsx-440-        role: 'assistant',
frontend/src/components/Chat/ChatPanel.tsx-441-        text: copy.cta ? `${copy.body}\n\n[${copy.cta.label}](${copy.cta.href})` : copy.body,
frontend/src/components/Chat/ChatPanel.tsx-442-        isError: true,
--
frontend/src/components/Chat/ChatArtifactCard.tsx-292-          imported_document_status: result.status,
frontend/src/components/Chat/ChatArtifactCard.tsx-293-          import_error: null,
frontend/src/components/Chat/ChatArtifactCard.tsx-294-        },
frontend/src/components/Chat/ChatArtifactCard.tsx-295-      }));
frontend/src/components/Chat/ChatArtifactCard.tsx-296-    } catch (err) {
frontend/src/components/Chat/ChatArtifactCard.tsx:297:      setLayoutImportError(errorCopy(err, t, tOr));
frontend/src/components/Chat/ChatArtifactCard.tsx-298-    } finally {
frontend/src/components/Chat/ChatArtifactCard.tsx-299-      setLayoutImporting(false);
frontend/src/components/Chat/ChatArtifactCard.tsx-300-    }
frontend/src/components/Chat/ChatArtifactCard.tsx-301-  };
frontend/src/components/Chat/ChatArtifactCard.tsx-302-
--
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-79-    customInstructions,
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-80-    setCustomInstructions,
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-81-  } = useDocumentLoader(documentId);
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-82-  const { sessionError } = useChatSession(documentId);
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-83-  const { isLoggedIn, userPlan, canUseCustomInstructions } = useUserPlanProfile();
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:84:  const sessionErrorCopy = sessionError ? errorCopy(sessionError, t, tOr) : null;
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-85-  const error = loaderError;
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-86-
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-87-  usePageTitle(documentName || undefined);
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-88-
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-89-  // Handle ?page=N&highlight=chunkId from "View in original" links
--
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-200-          reason: err.code,
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-201-          plan: 'plus',
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-202-          period: 'monthly',
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-203-        });
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-204-      } else {
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:205:        setLayoutTranslationError(errorCopy(err, t, tOr));
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-206-        setLayoutTranslationDrawerOpen(false);
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-207-      }
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-208-    } finally {
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-209-      setLayoutTranslationBusy(false);
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-210-    }
--
frontend/src/app/collections/[collectionId]/page.tsx-182-      await addDocumentsToCollection(collectionId, [docId]);
frontend/src/app/collections/[collectionId]/page.tsx-183-      const coll = await getCollection(collectionId);
frontend/src/app/collections/[collectionId]/page.tsx-184-      setCollection(coll);
frontend/src/app/collections/[collectionId]/page.tsx-185-      setShowAddDocs(false);
frontend/src/app/collections/[collectionId]/page.tsx-186-    } catch (e) {
frontend/src/app/collections/[collectionId]/page.tsx:187:      const copy = errorCopy(e, t, tOr);
frontend/src/app/collections/[collectionId]/page.tsx-188-      setAddDocsErrorCopy(copy);
frontend/src/app/collections/[collectionId]/page.tsx-189-      if (copy.cta) {
frontend/src/app/collections/[collectionId]/page.tsx-190-        trackEvent('limit_hit', {
frontend/src/app/collections/[collectionId]/page.tsx-191-          source: 'collection_add_documents_modal',
frontend/src/app/collections/[collectionId]/page.tsx-192-          reason: copy.cta.href.includes('collection_doc_limit') ? 'collection_doc_limit' : 'collection_limit',
--
frontend/src/components/dashboard/DashboardPageClient.tsx-296-          setProgressText(t('upload.error'));
frontend/src/components/dashboard/DashboardPageClient.tsx-297-          setUploading(false);
frontend/src/components/dashboard/DashboardPageClient.tsx-298-        }
frontend/src/components/dashboard/DashboardPageClient.tsx-299-      }, 2000);
frontend/src/components/dashboard/DashboardPageClient.tsx-300-    } catch (e: unknown) {
frontend/src/components/dashboard/DashboardPageClient.tsx:301:      const copy = errorCopy(e, t, tOr);
frontend/src/components/dashboard/DashboardPageClient.tsx-302-      setProgressText(copy.body);
frontend/src/components/dashboard/DashboardPageClient.tsx-303-      setUploadErrorCopy(copy.cta ? copy : null);
frontend/src/components/dashboard/DashboardPageClient.tsx-304-      if (copy.cta) {
frontend/src/components/dashboard/DashboardPageClient.tsx-305-        trackEvent('limit_hit', { source: 'dashboard_upload', reason: copy.cta.href.includes('file_size') ? 'file_size' : 'upload_limit', plan: userPlan });
frontend/src/components/dashboard/DashboardPageClient.tsx-306-      }
--
frontend/src/components/dashboard/DashboardPageClient.tsx-339-      setDocument(docId);
frontend/src/components/dashboard/DashboardPageClient.tsx-340-      setUrlInput('');
frontend/src/components/dashboard/DashboardPageClient.tsx-341-      getMyDocuments().then(setServerDocs).catch(console.error);
frontend/src/components/dashboard/DashboardPageClient.tsx-342-      router.push(`/d/${docId}`);
frontend/src/components/dashboard/DashboardPageClient.tsx-343-    } catch (e: unknown) {
frontend/src/components/dashboard/DashboardPageClient.tsx:344:      const copy = errorCopy(e, t, tOr);
frontend/src/components/dashboard/DashboardPageClient.tsx-345-      setUrlError(copy.body);
frontend/src/components/dashboard/DashboardPageClient.tsx-346-      setUrlErrorCopy(copy.cta ? copy : null);
frontend/src/components/dashboard/DashboardPageClient.tsx-347-      if (copy.cta) {
frontend/src/components/dashboard/DashboardPageClient.tsx-348-        trackEvent('limit_hit', { source: 'dashboard_url', reason: copy.cta.href.includes('file_size') ? 'file_size' : 'url_limit', plan: userPlan });
frontend/src/components/dashboard/DashboardPageClient.tsx-349-      }

exec
/bin/zsh -lc "rg -n -C 8 \"copy\\.cta|errorCopy.*cta|error\\.cta|href=\\{.*cta|cta\\.href\" frontend/src --glob '*.{ts,tsx}'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
frontend/src/components/Collections/CreateCollectionModal.tsx-66-    setCreateErrorCopy(null);
frontend/src/components/Collections/CreateCollectionModal.tsx-67-    try {
frontend/src/components/Collections/CreateCollectionModal.tsx-68-      const result = await createCollection(name.trim(), description.trim() || undefined, Array.from(selectedDocs));
frontend/src/components/Collections/CreateCollectionModal.tsx-69-      onCreated(result.id);
frontend/src/components/Collections/CreateCollectionModal.tsx-70-      onClose();
frontend/src/components/Collections/CreateCollectionModal.tsx-71-    } catch (e) {
frontend/src/components/Collections/CreateCollectionModal.tsx-72-      const copy = errorCopy(e, t, tOr);
frontend/src/components/Collections/CreateCollectionModal.tsx-73-      setCreateErrorCopy(copy);
frontend/src/components/Collections/CreateCollectionModal.tsx:74:      if (copy.cta) {
frontend/src/components/Collections/CreateCollectionModal.tsx-75-        trackEvent('limit_hit', {
frontend/src/components/Collections/CreateCollectionModal.tsx-76-          source: 'create_collection_modal',
frontend/src/components/Collections/CreateCollectionModal.tsx:77:          reason: copy.cta.href.includes('collection_doc_limit') ? 'collection_doc_limit' : 'collection_limit',
frontend/src/components/Collections/CreateCollectionModal.tsx-78-        });
frontend/src/components/Collections/CreateCollectionModal.tsx-79-      }
frontend/src/components/Collections/CreateCollectionModal.tsx-80-    } finally {
frontend/src/components/Collections/CreateCollectionModal.tsx-81-      setCreating(false);
frontend/src/components/Collections/CreateCollectionModal.tsx-82-    }
frontend/src/components/Collections/CreateCollectionModal.tsx-83-  };
frontend/src/components/Collections/CreateCollectionModal.tsx-84-
frontend/src/components/Collections/CreateCollectionModal.tsx-85-  return (
--
frontend/src/components/Collections/CreateCollectionModal.tsx-199-                ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100'
frontend/src/components/Collections/CreateCollectionModal.tsx-200-                : 'border-red-200 bg-red-50 text-red-950 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100'
frontend/src/components/Collections/CreateCollectionModal.tsx-201-            }`}
frontend/src/components/Collections/CreateCollectionModal.tsx-202-          >
frontend/src/components/Collections/CreateCollectionModal.tsx-203-            <p className="font-medium">{createErrorCopy.title}</p>
frontend/src/components/Collections/CreateCollectionModal.tsx-204-            <p className="mt-1 leading-5 opacity-90">{createErrorCopy.body}</p>
frontend/src/components/Collections/CreateCollectionModal.tsx-205-            {createErrorCopy.cta && (
frontend/src/components/Collections/CreateCollectionModal.tsx-206-              <Link
frontend/src/components/Collections/CreateCollectionModal.tsx:207:                href={createErrorCopy.cta.href}
frontend/src/components/Collections/CreateCollectionModal.tsx-208-                onClick={() => trackEvent('upgrade_click', { source: 'create_collection_modal', reason: 'collection_limit' })}
frontend/src/components/Collections/CreateCollectionModal.tsx-209-                className="mt-2 inline-flex items-center justify-center rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500"
frontend/src/components/Collections/CreateCollectionModal.tsx-210-              >
frontend/src/components/Collections/CreateCollectionModal.tsx-211-                {createErrorCopy.cta.label}
frontend/src/components/Collections/CreateCollectionModal.tsx-212-              </Link>
frontend/src/components/Collections/CreateCollectionModal.tsx-213-            )}
frontend/src/components/Collections/CreateCollectionModal.tsx-214-          </div>
frontend/src/components/Collections/CreateCollectionModal.tsx-215-        )}
--
frontend/src/app/pricing/PricingPageContent.tsx-257-              >
frontend/src/app/pricing/PricingPageContent.tsx-258-                <span className="ed-num">{t(plan.priceKey)}</span>
frontend/src/app/pricing/PricingPageContent.tsx-259-                <span className="ed-caption">{t(plan.cadenceKey)}</span>
frontend/src/app/pricing/PricingPageContent.tsx-260-              </div>
frontend/src/app/pricing/PricingPageContent.tsx-261-              <div style={{ flex: 1, marginTop: '18px' }}>
frontend/src/app/pricing/PricingPageContent.tsx-262-                <EdCheckList items={plan.featureKeys.map((k) => t(k))} />
frontend/src/app/pricing/PricingPageContent.tsx-263-              </div>
frontend/src/app/pricing/PricingPageContent.tsx-264-              <TrackedCtaLink
frontend/src/app/pricing/PricingPageContent.tsx:265:                href={plan.ctaHref}
frontend/src/app/pricing/PricingPageContent.tsx-266-                event={plan.intentPlan ? { name: 'upgrade_click', params: { plan: plan.intentPlan, period: 'monthly', source: 'pricing' } } : undefined}
frontend/src/app/pricing/PricingPageContent.tsx-267-                className="ed-cta"
frontend/src/app/pricing/PricingPageContent.tsx-268-                style={{ display: 'flex', width: '100%', justifyContent: 'center', marginTop: '24px' }}
frontend/src/app/pricing/PricingPageContent.tsx-269-              >
frontend/src/app/pricing/PricingPageContent.tsx-270-                {t(plan.ctaKey)}
frontend/src/app/pricing/PricingPageContent.tsx-271-              </TrackedCtaLink>
frontend/src/app/pricing/PricingPageContent.tsx-272-            </div>
frontend/src/app/pricing/PricingPageContent.tsx-273-          ))}
--
frontend/src/app/collections/[collectionId]/page.tsx-181-    try {
frontend/src/app/collections/[collectionId]/page.tsx-182-      await addDocumentsToCollection(collectionId, [docId]);
frontend/src/app/collections/[collectionId]/page.tsx-183-      const coll = await getCollection(collectionId);
frontend/src/app/collections/[collectionId]/page.tsx-184-      setCollection(coll);
frontend/src/app/collections/[collectionId]/page.tsx-185-      setShowAddDocs(false);
frontend/src/app/collections/[collectionId]/page.tsx-186-    } catch (e) {
frontend/src/app/collections/[collectionId]/page.tsx-187-      const copy = errorCopy(e, t, tOr);
frontend/src/app/collections/[collectionId]/page.tsx-188-      setAddDocsErrorCopy(copy);
frontend/src/app/collections/[collectionId]/page.tsx:189:      if (copy.cta) {
frontend/src/app/collections/[collectionId]/page.tsx-190-        trackEvent('limit_hit', {
frontend/src/app/collections/[collectionId]/page.tsx-191-          source: 'collection_add_documents_modal',
frontend/src/app/collections/[collectionId]/page.tsx:192:          reason: copy.cta.href.includes('collection_doc_limit') ? 'collection_doc_limit' : 'collection_limit',
frontend/src/app/collections/[collectionId]/page.tsx-193-        });
frontend/src/app/collections/[collectionId]/page.tsx-194-      }
frontend/src/app/collections/[collectionId]/page.tsx-195-    } finally {
frontend/src/app/collections/[collectionId]/page.tsx-196-      setAddingDocId(null);
frontend/src/app/collections/[collectionId]/page.tsx-197-    }
frontend/src/app/collections/[collectionId]/page.tsx-198-  };
frontend/src/app/collections/[collectionId]/page.tsx-199-
frontend/src/app/collections/[collectionId]/page.tsx-200-  const closeAddDocsModal = () => {
--
frontend/src/app/collections/[collectionId]/page.tsx-536-                    ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100'
frontend/src/app/collections/[collectionId]/page.tsx-537-                    : 'border-red-200 bg-red-50 text-red-950 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100'
frontend/src/app/collections/[collectionId]/page.tsx-538-                }`}
frontend/src/app/collections/[collectionId]/page.tsx-539-              >
frontend/src/app/collections/[collectionId]/page.tsx-540-                <p className="font-medium">{addDocsErrorCopy.title}</p>
frontend/src/app/collections/[collectionId]/page.tsx-541-                <p className="mt-1 leading-5 opacity-90">{addDocsErrorCopy.body}</p>
frontend/src/app/collections/[collectionId]/page.tsx-542-                {addDocsErrorCopy.cta && (
frontend/src/app/collections/[collectionId]/page.tsx-543-                  <Link
frontend/src/app/collections/[collectionId]/page.tsx:544:                    href={addDocsErrorCopy.cta.href}
frontend/src/app/collections/[collectionId]/page.tsx-545-                    onClick={() => trackEvent('upgrade_click', { source: 'collection_add_documents_modal', reason: 'collection_doc_limit' })}
frontend/src/app/collections/[collectionId]/page.tsx-546-                    className="mt-2 inline-flex items-center justify-center rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500"
frontend/src/app/collections/[collectionId]/page.tsx-547-                  >
frontend/src/app/collections/[collectionId]/page.tsx-548-                    {addDocsErrorCopy.cta.label}
frontend/src/app/collections/[collectionId]/page.tsx-549-                  </Link>
frontend/src/app/collections/[collectionId]/page.tsx-550-                )}
frontend/src/app/collections/[collectionId]/page.tsx-551-              </div>
frontend/src/app/collections/[collectionId]/page.tsx-552-            )}
--
frontend/src/components/SessionDropdown.tsx-86-        writeDemoSession(documentId, s.session_id);
frontend/src/components/SessionDropdown.tsx-87-      }
frontend/src/components/SessionDropdown.tsx-88-      setMessages([]);
frontend/src/components/SessionDropdown.tsx-89-      setConfirmDeleteId(null);
frontend/src/components/SessionDropdown.tsx-90-      setOpen(false);
frontend/src/components/SessionDropdown.tsx-91-    } catch (e) {
frontend/src/components/SessionDropdown.tsx-92-      const copy = errorCopy(e, t, tOr);
frontend/src/components/SessionDropdown.tsx-93-      setSessionErrorCopy(copy);
frontend/src/components/SessionDropdown.tsx:94:      if (copy.cta) {
frontend/src/components/SessionDropdown.tsx-95-        trackEvent('limit_hit', { source: 'session_dropdown', reason: 'session_limit' });
frontend/src/components/SessionDropdown.tsx-96-      }
frontend/src/components/SessionDropdown.tsx-97-    }
frontend/src/components/SessionDropdown.tsx-98-  };
frontend/src/components/SessionDropdown.tsx-99-
frontend/src/components/SessionDropdown.tsx-100-  const onSwitchSession = async (id: string) => {
frontend/src/components/SessionDropdown.tsx-101-    if (isStreaming) return;
frontend/src/components/SessionDropdown.tsx-102-    setSessionErrorCopy(null);
--
frontend/src/components/SessionDropdown.tsx-248-                    ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100'
frontend/src/components/SessionDropdown.tsx-249-                    : 'border-red-200 bg-red-50 text-red-950 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100'
frontend/src/components/SessionDropdown.tsx-250-                }`}
frontend/src/components/SessionDropdown.tsx-251-              >
frontend/src/components/SessionDropdown.tsx-252-                <p className="font-medium">{sessionErrorCopy.title}</p>
frontend/src/components/SessionDropdown.tsx-253-                <p className="mt-1 leading-5 opacity-90">{sessionErrorCopy.body}</p>
frontend/src/components/SessionDropdown.tsx-254-                {sessionErrorCopy.cta && (
frontend/src/components/SessionDropdown.tsx-255-                  <Link
frontend/src/components/SessionDropdown.tsx:256:                    href={sessionErrorCopy.cta.href}
frontend/src/components/SessionDropdown.tsx-257-                    onClick={() => trackEvent('upgrade_click', { source: 'session_dropdown', reason: 'session_limit' })}
frontend/src/components/SessionDropdown.tsx-258-                    className="mt-2 inline-flex items-center justify-center rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500"
frontend/src/components/SessionDropdown.tsx-259-                  >
frontend/src/components/SessionDropdown.tsx-260-                    {sessionErrorCopy.cta.label}
frontend/src/components/SessionDropdown.tsx-261-                  </Link>
frontend/src/components/SessionDropdown.tsx-262-                )}
frontend/src/components/SessionDropdown.tsx-263-              </div>
frontend/src/components/SessionDropdown.tsx-264-            )}
--
frontend/src/components/dashboard/DashboardPageClient.tsx-295-          clearPollTimer();
frontend/src/components/dashboard/DashboardPageClient.tsx-296-          setProgressText(t('upload.error'));
frontend/src/components/dashboard/DashboardPageClient.tsx-297-          setUploading(false);
frontend/src/components/dashboard/DashboardPageClient.tsx-298-        }
frontend/src/components/dashboard/DashboardPageClient.tsx-299-      }, 2000);
frontend/src/components/dashboard/DashboardPageClient.tsx-300-    } catch (e: unknown) {
frontend/src/components/dashboard/DashboardPageClient.tsx-301-      const copy = errorCopy(e, t, tOr);
frontend/src/components/dashboard/DashboardPageClient.tsx-302-      setProgressText(copy.body);
frontend/src/components/dashboard/DashboardPageClient.tsx:303:      setUploadErrorCopy(copy.cta ? copy : null);
frontend/src/components/dashboard/DashboardPageClient.tsx:304:      if (copy.cta) {
frontend/src/components/dashboard/DashboardPageClient.tsx:305:        trackEvent('limit_hit', { source: 'dashboard_upload', reason: copy.cta.href.includes('file_size') ? 'file_size' : 'upload_limit', plan: userPlan });
frontend/src/components/dashboard/DashboardPageClient.tsx-306-      }
frontend/src/components/dashboard/DashboardPageClient.tsx-307-      setUploading(false);
frontend/src/components/dashboard/DashboardPageClient.tsx-308-    }
frontend/src/components/dashboard/DashboardPageClient.tsx-309-  }, [isLoggedIn, maxUploadBytes, maxUploadMb, router, setDocument, setDocumentStatus, t, tOr, uploadUpgradePlan, userPlan]);
frontend/src/components/dashboard/DashboardPageClient.tsx-310-
frontend/src/components/dashboard/DashboardPageClient.tsx-311-  const onDrop = (e: React.DragEvent) => {
frontend/src/components/dashboard/DashboardPageClient.tsx-312-    e.preventDefault();
frontend/src/components/dashboard/DashboardPageClient.tsx-313-    setDragging(false);
--
frontend/src/components/dashboard/DashboardPageClient.tsx-338-      trackEvent('url_ingest_created', { source: 'dashboard_url', plan: userPlan });
frontend/src/components/dashboard/DashboardPageClient.tsx-339-      setDocument(docId);
frontend/src/components/dashboard/DashboardPageClient.tsx-340-      setUrlInput('');
frontend/src/components/dashboard/DashboardPageClient.tsx-341-      getMyDocuments().then(setServerDocs).catch(console.error);
frontend/src/components/dashboard/DashboardPageClient.tsx-342-      router.push(`/d/${docId}`);
frontend/src/components/dashboard/DashboardPageClient.tsx-343-    } catch (e: unknown) {
frontend/src/components/dashboard/DashboardPageClient.tsx-344-      const copy = errorCopy(e, t, tOr);
frontend/src/components/dashboard/DashboardPageClient.tsx-345-      setUrlError(copy.body);
frontend/src/components/dashboard/DashboardPageClient.tsx:346:      setUrlErrorCopy(copy.cta ? copy : null);
frontend/src/components/dashboard/DashboardPageClient.tsx:347:      if (copy.cta) {
frontend/src/components/dashboard/DashboardPageClient.tsx:348:        trackEvent('limit_hit', { source: 'dashboard_url', reason: copy.cta.href.includes('file_size') ? 'file_size' : 'url_limit', plan: userPlan });
frontend/src/components/dashboard/DashboardPageClient.tsx-349-      }
frontend/src/components/dashboard/DashboardPageClient.tsx-350-    } finally {
frontend/src/components/dashboard/DashboardPageClient.tsx-351-      setUrlLoading(false);
frontend/src/components/dashboard/DashboardPageClient.tsx-352-    }
frontend/src/components/dashboard/DashboardPageClient.tsx-353-  }, [urlInput, router, setDocument, t, tOr, userPlan]);
frontend/src/components/dashboard/DashboardPageClient.tsx-354-
frontend/src/components/dashboard/DashboardPageClient.tsx-355-  const confirmDeleteDocument = useCallback(async (documentId: string) => {
frontend/src/components/dashboard/DashboardPageClient.tsx-356-    setDeletingId(documentId);
--
frontend/src/components/dashboard/DashboardPageClient.tsx-453-            >
frontend/src/components/dashboard/DashboardPageClient.tsx-454-              {t('upload.chooseFile')}
frontend/src/components/dashboard/DashboardPageClient.tsx-455-            </button>
frontend/src/components/dashboard/DashboardPageClient.tsx-456-            {progressText && (
frontend/src/components/dashboard/DashboardPageClient.tsx-457-              <div aria-live="polite" className={`mt-4 text-sm ${uploading ? 'text-zinc-500' : 'text-red-600 dark:text-red-400'}`}>
frontend/src/components/dashboard/DashboardPageClient.tsx-458-                <p>{progressText}</p>
frontend/src/components/dashboard/DashboardPageClient.tsx-459-                {uploadErrorCopy?.cta && (
frontend/src/components/dashboard/DashboardPageClient.tsx-460-                  <Link
frontend/src/components/dashboard/DashboardPageClient.tsx:461:                    href={uploadErrorCopy.cta.href}
frontend/src/components/dashboard/DashboardPageClient.tsx-462-                    onClick={() => trackEvent('upgrade_click', { source: 'upload_error', reason: 'upload_limit' })}
frontend/src/components/dashboard/DashboardPageClient.tsx-463-                    className="mt-3 inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
frontend/src/components/dashboard/DashboardPageClient.tsx-464-                  >
frontend/src/components/dashboard/DashboardPageClient.tsx-465-                    {uploadErrorCopy.cta.label}
frontend/src/components/dashboard/DashboardPageClient.tsx-466-                  </Link>
frontend/src/components/dashboard/DashboardPageClient.tsx-467-                )}
frontend/src/components/dashboard/DashboardPageClient.tsx-468-              </div>
frontend/src/components/dashboard/DashboardPageClient.tsx-469-            )}
--
frontend/src/components/dashboard/DashboardPageClient.tsx-492-              {urlLoading ? '...' : t('upload.ingestUrl')}
frontend/src/components/dashboard/DashboardPageClient.tsx-493-            </button>
frontend/src/components/dashboard/DashboardPageClient.tsx-494-          </div>
frontend/src/components/dashboard/DashboardPageClient.tsx-495-          {urlError && (
frontend/src/components/dashboard/DashboardPageClient.tsx-496-            <div role="alert" className="mt-2 text-center text-sm text-red-600 dark:text-red-400">
frontend/src/components/dashboard/DashboardPageClient.tsx-497-              <p>{urlError}</p>
frontend/src/components/dashboard/DashboardPageClient.tsx-498-              {urlErrorCopy?.cta && (
frontend/src/components/dashboard/DashboardPageClient.tsx-499-                <Link
frontend/src/components/dashboard/DashboardPageClient.tsx:500:                  href={urlErrorCopy.cta.href}
frontend/src/components/dashboard/DashboardPageClient.tsx-501-                  onClick={() => trackEvent('upgrade_click', { source: 'url_error', reason: 'url_limit' })}
frontend/src/components/dashboard/DashboardPageClient.tsx-502-                  className="mt-3 inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
frontend/src/components/dashboard/DashboardPageClient.tsx-503-                >
frontend/src/components/dashboard/DashboardPageClient.tsx-504-                  {urlErrorCopy.cta.label}
frontend/src/components/dashboard/DashboardPageClient.tsx-505-                </Link>
frontend/src/components/dashboard/DashboardPageClient.tsx-506-              )}
frontend/src/components/dashboard/DashboardPageClient.tsx-507-            </div>
frontend/src/components/dashboard/DashboardPageClient.tsx-508-          )}
--
frontend/src/components/marketing/EdCtaBanner.tsx-50-              marginTop: "26px",
frontend/src/components/marketing/EdCtaBanner.tsx-51-              display: "flex",
frontend/src/components/marketing/EdCtaBanner.tsx-52-              gap: "16px",
frontend/src/components/marketing/EdCtaBanner.tsx-53-              flexWrap: "wrap",
frontend/src/components/marketing/EdCtaBanner.tsx-54-              justifyContent: "center",
frontend/src/components/marketing/EdCtaBanner.tsx-55-              alignItems: "center",
frontend/src/components/marketing/EdCtaBanner.tsx-56-            }}
frontend/src/components/marketing/EdCtaBanner.tsx-57-          >
frontend/src/components/marketing/EdCtaBanner.tsx:58:            <Link href={primary.href} className="ed-cta">
frontend/src/components/marketing/EdCtaBanner.tsx-59-              {primary.label}
frontend/src/components/marketing/EdCtaBanner.tsx-60-            </Link>
frontend/src/components/marketing/EdCtaBanner.tsx-61-
frontend/src/components/marketing/EdCtaBanner.tsx-62-            {secondary && (
frontend/src/components/marketing/EdCtaBanner.tsx-63-              <Link href={secondary.href} className="ed-link">
frontend/src/components/marketing/EdCtaBanner.tsx-64-                {secondary.label} <span aria-hidden="true">→</span>
frontend/src/components/marketing/EdCtaBanner.tsx-65-              </Link>
frontend/src/components/marketing/EdCtaBanner.tsx-66-            )}
--
frontend/src/components/marketing/EdPageHero.tsx-60-          )}
frontend/src/components/marketing/EdPageHero.tsx-61-          {meta && <div style={{ marginTop: "16px" }}>{meta}</div>}
frontend/src/components/marketing/EdPageHero.tsx-62-          {hasCta && (
frontend/src/components/marketing/EdPageHero.tsx-63-            <div
frontend/src/components/marketing/EdPageHero.tsx-64-              className="flex items-center flex-wrap"
frontend/src/components/marketing/EdPageHero.tsx-65-              style={{ marginTop: "28px", gap: "16px" }}
frontend/src/components/marketing/EdPageHero.tsx-66-            >
frontend/src/components/marketing/EdPageHero.tsx-67-              {primaryCta && (
frontend/src/components/marketing/EdPageHero.tsx:68:                <Link href={primaryCta.href} className="ed-cta">
frontend/src/components/marketing/EdPageHero.tsx-69-                  {primaryCta.label}
frontend/src/components/marketing/EdPageHero.tsx-70-                </Link>
frontend/src/components/marketing/EdPageHero.tsx-71-              )}
frontend/src/components/marketing/EdPageHero.tsx-72-              {secondaryCta && (
frontend/src/components/marketing/EdPageHero.tsx-73-                <Link href={secondaryCta.href} className="ed-link">
frontend/src/components/marketing/EdPageHero.tsx-74-                  {secondaryCta.label} <span aria-hidden="true">→</span>
frontend/src/components/marketing/EdPageHero.tsx-75-                </Link>
frontend/src/components/marketing/EdPageHero.tsx-76-              )}
--
frontend/src/components/Chat/ChatPanel.tsx-403-        createdAt: Date.now(),
frontend/src/components/Chat/ChatPanel.tsx-404-      });
frontend/src/components/Chat/ChatPanel.tsx-405-    } catch (e) {
frontend/src/components/Chat/ChatPanel.tsx-406-      console.error('Share failed:', e);
frontend/src/components/Chat/ChatPanel.tsx-407-      const copy = errorCopy(e, t, tOr);
frontend/src/components/Chat/ChatPanel.tsx-408-      addMessage({
frontend/src/components/Chat/ChatPanel.tsx-409-        id: `m_${Date.now()}_share_err`,
frontend/src/components/Chat/ChatPanel.tsx-410-        role: 'assistant',
frontend/src/components/Chat/ChatPanel.tsx:411:        text: copy.cta ? `${copy.body}\n\n[${copy.cta.label}](${copy.cta.href})` : copy.body,
frontend/src/components/Chat/ChatPanel.tsx-412-        isError: true,
frontend/src/components/Chat/ChatPanel.tsx-413-        createdAt: Date.now(),
frontend/src/components/Chat/ChatPanel.tsx-414-      });
frontend/src/components/Chat/ChatPanel.tsx-415-    } finally {
frontend/src/components/Chat/ChatPanel.tsx-416-      setShareLoading(false);
frontend/src/components/Chat/ChatPanel.tsx-417-    }
frontend/src/components/Chat/ChatPanel.tsx-418-  }, [addMessage, copyShareUrl, sessionId, shareLoading, t, tOr, userPlan]);
frontend/src/components/Chat/ChatPanel.tsx-419-
--
frontend/src/components/Chat/ChatPanel.tsx-433-        createdAt: Date.now(),
frontend/src/components/Chat/ChatPanel.tsx-434-      });
frontend/src/components/Chat/ChatPanel.tsx-435-    } catch (e) {
frontend/src/components/Chat/ChatPanel.tsx-436-      console.error('Answer share failed:', e);
frontend/src/components/Chat/ChatPanel.tsx-437-      const copy = errorCopy(e, t, tOr);
frontend/src/components/Chat/ChatPanel.tsx-438-      addMessage({
frontend/src/components/Chat/ChatPanel.tsx-439-        id: `m_${Date.now()}_share_answer_err`,
frontend/src/components/Chat/ChatPanel.tsx-440-        role: 'assistant',
frontend/src/components/Chat/ChatPanel.tsx:441:        text: copy.cta ? `${copy.body}\n\n[${copy.cta.label}](${copy.cta.href})` : copy.body,
frontend/src/components/Chat/ChatPanel.tsx-442-        isError: true,
frontend/src/components/Chat/ChatPanel.tsx-443-        createdAt: Date.now(),
frontend/src/components/Chat/ChatPanel.tsx-444-      });
frontend/src/components/Chat/ChatPanel.tsx-445-    } finally {
frontend/src/components/Chat/ChatPanel.tsx-446-      setShareAnswerLoadingId(null);
frontend/src/components/Chat/ChatPanel.tsx-447-    }
frontend/src/components/Chat/ChatPanel.tsx-448-  }, [addMessage, copyShareUrl, sessionId, shareAnswerLoadingId, t, tOr, userPlan]);
frontend/src/components/Chat/ChatPanel.tsx-449-
--
frontend/src/components/Chat/ChatArtifactCard.tsx-331-          {tableRebuildError ? (
frontend/src/components/Chat/ChatArtifactCard.tsx-332-            <p className="mt-2 text-xs text-red-700 dark:text-red-300">{tableRebuildError}</p>
frontend/src/components/Chat/ChatArtifactCard.tsx-333-          ) : null}
frontend/src/components/Chat/ChatArtifactCard.tsx-334-          {layoutImportError ? (
frontend/src/components/Chat/ChatArtifactCard.tsx-335-            <p className="mt-2 text-xs text-red-700 dark:text-red-300">
frontend/src/components/Chat/ChatArtifactCard.tsx-336-              {layoutImportError.title}: {layoutImportError.body}
frontend/src/components/Chat/ChatArtifactCard.tsx-337-              {layoutImportError.cta && (
frontend/src/components/Chat/ChatArtifactCard.tsx-338-                <Link
frontend/src/components/Chat/ChatArtifactCard.tsx:339:                  href={layoutImportError.cta.href}
frontend/src/components/Chat/ChatArtifactCard.tsx-340-                  className="ml-1 font-medium underline decoration-red-400 underline-offset-2 hover:text-red-800 dark:hover:text-red-100"
frontend/src/components/Chat/ChatArtifactCard.tsx-341-                >
frontend/src/components/Chat/ChatArtifactCard.tsx-342-                  {layoutImportError.cta.label}
frontend/src/components/Chat/ChatArtifactCard.tsx-343-                </Link>
frontend/src/components/Chat/ChatArtifactCard.tsx-344-              )}
frontend/src/components/Chat/ChatArtifactCard.tsx-345-            </p>
frontend/src/components/Chat/ChatArtifactCard.tsx-346-          ) : null}
frontend/src/components/Chat/ChatArtifactCard.tsx-347-          {isLayoutTranslation && typeof layoutPreview.import_error === 'string' && layoutPreview.import_error ? (
--
frontend/src/app/trust/TrustPageContent.tsx-166-      ]}
frontend/src/app/trust/TrustPageContent.tsx-167-    >
frontend/src/app/trust/TrustPageContent.tsx-168-      <EdPageHero
frontend/src/app/trust/TrustPageContent.tsx-169-        eyebrow={t("trust.hero.eyebrow")}
frontend/src/app/trust/TrustPageContent.tsx-170-        title={t("trust.hero.title")}
frontend/src/app/trust/TrustPageContent.tsx-171-        lede={t("trust.hero.lede")}
frontend/src/app/trust/TrustPageContent.tsx-172-        meta={
frontend/src/app/trust/TrustPageContent.tsx-173-          <div className="flex gap-4 flex-wrap items-center">
frontend/src/app/trust/TrustPageContent.tsx:174:            <Link href={href("/privacy")} className="ed-cta">
frontend/src/app/trust/TrustPageContent.tsx-175-              {t("trust.hero.privacyCta")}
frontend/src/app/trust/TrustPageContent.tsx-176-            </Link>
frontend/src/app/trust/TrustPageContent.tsx-177-            <Link href={href("/contact")} className="ed-link">
frontend/src/app/trust/TrustPageContent.tsx-178-              {t("trust.hero.reportCta")} <span aria-hidden="true">→</span>
frontend/src/app/trust/TrustPageContent.tsx-179-            </Link>
frontend/src/app/trust/TrustPageContent.tsx-180-          </div>
frontend/src/app/trust/TrustPageContent.tsx-181-        }
frontend/src/app/trust/TrustPageContent.tsx-182-      />

exec
/bin/zsh -lc "rg -n -C 5 \"DOCUMENT_LIMIT_REACHED\" . --glob '"'!frontend/.next/**'"' --glob '"'!**/node_modules/**'"' --glob '"'!**/.collab/**'"' --glob '"'!**/*.md'"'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
./frontend/src/i18n/locales/ar.json-2611-  "billing.cancel.successImmediate": "أنت الآن على الخطة المجانية. تم الاحتفاظ بأرصدتك.",
./frontend/src/i18n/locales/ar.json-2612-  "errors.cta.upgrade": "ترقية",
./frontend/src/i18n/locales/ar.json-2613-  "errors.cta.signin": "تسجيل الدخول",
./frontend/src/i18n/locales/ar.json-2614-  "errors.NETWORK.title": "مشكلة في الاتصال",
./frontend/src/i18n/locales/ar.json-2615-  "errors.NETWORK.body": "حدث خطأ ما. يرجى التحقق من اتصالك والمحاولة مرة أخرى.",
./frontend/src/i18n/locales/ar.json:2616:  "errors.DOCUMENT_LIMIT_REACHED.title": "تم الوصول إلى حد المستندات",
./frontend/src/i18n/locales/ar.json:2617:  "errors.DOCUMENT_LIMIT_REACHED.body": "لقد وصلت إلى حد المستندات في خطتك ({limit}). احذف مستندًا قديمًا أو قم بالترقية للحصول على المزيد.",
./frontend/src/i18n/locales/ar.json:2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "لقد وصلت إلى حد المستندات في خطتك ({limit}). احذف مستندًا لتحرير مساحة.",
./frontend/src/i18n/locales/ar.json-2619-  "errors.FILE_TOO_LARGE.title": "الملف كبير جدًا",
./frontend/src/i18n/locales/ar.json-2620-  "errors.FILE_TOO_LARGE.body": "الحد الأقصى لحجم الملف في خطتك هو {maxMb} ميغابايت. قم بالترقية للرفع الأكبر.",
./frontend/src/i18n/locales/ar.json-2621-  "errors.UNSUPPORTED_FORMAT.title": "تنسيق ملف غير مدعوم",
./frontend/src/i18n/locales/ar.json-2622-  "errors.UNSUPPORTED_FORMAT.body": "يرجى رفع ملف PDF أو DOCX أو PPTX أو XLSX أو TXT أو MD.",
./frontend/src/i18n/locales/ar.json-2623-  "errors.INVALID_FILE_CONTENT.title": "محتوى الملف غير صالح",
--
./backend/tests/test_error_taxonomy.py-162-
./backend/tests/test_error_taxonomy.py-163-    response = await client.post(
./backend/tests/test_error_taxonomy.py-164-        "/api/documents/upload",
./backend/tests/test_error_taxonomy.py-165-        files={"file": ("report.pdf", b"%PDF-1.4\nhello", "application/pdf")},
./backend/tests/test_error_taxonomy.py-166-    )
./backend/tests/test_error_taxonomy.py:167:    detail = _assert_error(response, 403, "DOCUMENT_LIMIT_REACHED")
./backend/tests/test_error_taxonomy.py-168-    assert isinstance(detail["limit"], int)
./backend/tests/test_error_taxonomy.py-169-    assert isinstance(detail["current"], int)
./backend/tests/test_error_taxonomy.py-170-
./backend/tests/test_error_taxonomy.py-171-
./backend/tests/test_error_taxonomy.py-172-@pytest.mark.asyncio
--
./backend/tests/test_error_taxonomy.py-178-    db = _make_db(scalar=AsyncMock(return_value=settings.FREE_MAX_DOCUMENTS))
./backend/tests/test_error_taxonomy.py-179-    _override_dependencies(db, auth_user=user)
./backend/tests/test_error_taxonomy.py-180-    monkeypatch.setattr(url_validator, "validate_url", lambda url: url)
./backend/tests/test_error_taxonomy.py-181-
./backend/tests/test_error_taxonomy.py-182-    response = await client.post("/api/documents/ingest-url", json={"url": "https://example.com"})
./backend/tests/test_error_taxonomy.py:183:    detail = _assert_error(response, 403, "DOCUMENT_LIMIT_REACHED")
./backend/tests/test_error_taxonomy.py-184-    assert isinstance(detail["limit"], int)
./backend/tests/test_error_taxonomy.py-185-    assert isinstance(detail["current"], int)
./backend/tests/test_error_taxonomy.py-186-
./backend/tests/test_error_taxonomy.py-187-
./backend/tests/test_error_taxonomy.py-188-@pytest.mark.asyncio
--
./frontend/src/i18n/locales/es.json-2611-  "billing.cancel.successImmediate": "Ahora estás en el plan gratuito. Tus créditos se conservan.",
./frontend/src/i18n/locales/es.json-2612-  "errors.cta.upgrade": "Mejorar",
./frontend/src/i18n/locales/es.json-2613-  "errors.cta.signin": "Iniciar sesión",
./frontend/src/i18n/locales/es.json-2614-  "errors.NETWORK.title": "Problema de conexión",
./frontend/src/i18n/locales/es.json-2615-  "errors.NETWORK.body": "Algo salió mal. Verifica tu conexión e inténtalo de nuevo.",
./frontend/src/i18n/locales/es.json:2616:  "errors.DOCUMENT_LIMIT_REACHED.title": "Límite de documentos alcanzado",
./frontend/src/i18n/locales/es.json:2617:  "errors.DOCUMENT_LIMIT_REACHED.body": "Has alcanzado el límite de documentos de tu plan ({limit}). Elimina un documento antiguo o mejora tu plan para obtener más.",
./frontend/src/i18n/locales/es.json:2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "Has alcanzado el límite de documentos de tu plan ({limit}). Elimina un documento para liberar espacio.",
./frontend/src/i18n/locales/es.json-2619-  "errors.FILE_TOO_LARGE.title": "Archivo demasiado grande",
./frontend/src/i18n/locales/es.json-2620-  "errors.FILE_TOO_LARGE.body": "El tamaño máximo de archivo en tu plan es {maxMb} MB. Mejora tu plan para subir archivos más grandes.",
./frontend/src/i18n/locales/es.json-2621-  "errors.UNSUPPORTED_FORMAT.title": "Formato de archivo no compatible",
./frontend/src/i18n/locales/es.json-2622-  "errors.UNSUPPORTED_FORMAT.body": "Por favor, sube un archivo PDF, DOCX, PPTX, XLSX, TXT o MD.",
./frontend/src/i18n/locales/es.json-2623-  "errors.INVALID_FILE_CONTENT.title": "Contenido de archivo no válido",
--
./frontend/src/i18n/locales/ko.json-2611-  "billing.cancel.successImmediate": "무료 요금제로 전환되었습니다. 크레딧은 유지됩니다.",
./frontend/src/i18n/locales/ko.json-2612-  "errors.cta.upgrade": "업그레이드",
./frontend/src/i18n/locales/ko.json-2613-  "errors.cta.signin": "로그인",
./frontend/src/i18n/locales/ko.json-2614-  "errors.NETWORK.title": "연결 문제",
./frontend/src/i18n/locales/ko.json-2615-  "errors.NETWORK.body": "문제가 발생했습니다. 연결을 확인하고 다시 시도해주세요.",
./frontend/src/i18n/locales/ko.json:2616:  "errors.DOCUMENT_LIMIT_REACHED.title": "문서 한도 도달",
./frontend/src/i18n/locales/ko.json:2617:  "errors.DOCUMENT_LIMIT_REACHED.body": "요금제의 문서 한도({limit})에 도달했습니다. 이전 문서를 삭제하거나 업그레이드하세요.",
./frontend/src/i18n/locales/ko.json:2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "요금제의 문서 한도({limit})에 도달했습니다. 문서를 삭제해 공간을 확보하세요.",
./frontend/src/i18n/locales/ko.json-2619-  "errors.FILE_TOO_LARGE.title": "파일이 너무 큼",
./frontend/src/i18n/locales/ko.json-2620-  "errors.FILE_TOO_LARGE.body": "요금제의 최대 파일 크기는 {maxMb} MB입니다. 더 큰 파일을 업로드하려면 업그레이드하세요.",
./frontend/src/i18n/locales/ko.json-2621-  "errors.UNSUPPORTED_FORMAT.title": "지원되지 않는 파일 형식",
./frontend/src/i18n/locales/ko.json-2622-  "errors.UNSUPPORTED_FORMAT.body": "PDF, DOCX, PPTX, XLSX, TXT 또는 MD 파일을 업로드해주세요.",
./frontend/src/i18n/locales/ko.json-2623-  "errors.INVALID_FILE_CONTENT.title": "파일 내용이 유효하지 않음",
--
./frontend/src/i18n/locales/hi.json-2611-  "billing.cancel.successImmediate": "अब आप मुफ्त योजना पर हैं। आपके क्रेडिट रखे गए हैं।",
./frontend/src/i18n/locales/hi.json-2612-  "errors.cta.upgrade": "अपग्रेड करें",
./frontend/src/i18n/locales/hi.json-2613-  "errors.cta.signin": "साइन इन करें",
./frontend/src/i18n/locales/hi.json-2614-  "errors.NETWORK.title": "कनेक्शन समस्या",
./frontend/src/i18n/locales/hi.json-2615-  "errors.NETWORK.body": "कुछ गलत हो गया। कृपया अपना कनेक्शन जांचें और पुनः प्रयास करें।",
./frontend/src/i18n/locales/hi.json:2616:  "errors.DOCUMENT_LIMIT_REACHED.title": "दस्तावेज़ सीमा समाप्त",
./frontend/src/i18n/locales/hi.json:2617:  "errors.DOCUMENT_LIMIT_REACHED.body": "आप अपनी योजना की दस्तावेज़ सीमा ({limit}) तक पहुंच गए हैं। अधिक के लिए कोई पुराना दस्तावेज़ हटाएं या अपग्रेड करें।",
./frontend/src/i18n/locales/hi.json:2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "आप अपनी योजना की दस्तावेज़ सीमा ({limit}) तक पहुंच गए हैं। जगह खाली करने के लिए एक दस्तावेज़ हटाएं।",
./frontend/src/i18n/locales/hi.json-2619-  "errors.FILE_TOO_LARGE.title": "फ़ाइल बहुत बड़ी है",
./frontend/src/i18n/locales/hi.json-2620-  "errors.FILE_TOO_LARGE.body": "आपकी योजना पर अधिकतम फ़ाइल आकार {maxMb} MB है। बड़े अपलोड के लिए अपग्रेड करें।",
./frontend/src/i18n/locales/hi.json-2621-  "errors.UNSUPPORTED_FORMAT.title": "असमर्थित फ़ाइल प्रारूप",
./frontend/src/i18n/locales/hi.json-2622-  "errors.UNSUPPORTED_FORMAT.body": "कृपया PDF, DOCX, PPTX, XLSX, TXT, या MD फ़ाइल अपलोड करें।",
./frontend/src/i18n/locales/hi.json-2623-  "errors.INVALID_FILE_CONTENT.title": "फ़ाइल सामग्री अमान्य",
--
./frontend/src/i18n/locales/fr.json-2611-  "billing.cancel.successImmediate": "Vous êtes maintenant sur le forfait gratuit. Vos crédits sont conservés.",
./frontend/src/i18n/locales/fr.json-2612-  "errors.cta.upgrade": "Passer à la version supérieure",
./frontend/src/i18n/locales/fr.json-2613-  "errors.cta.signin": "Se connecter",
./frontend/src/i18n/locales/fr.json-2614-  "errors.NETWORK.title": "Problème de connexion",
./frontend/src/i18n/locales/fr.json-2615-  "errors.NETWORK.body": "Une erreur s'est produite. Vérifiez votre connexion et réessayez.",
./frontend/src/i18n/locales/fr.json:2616:  "errors.DOCUMENT_LIMIT_REACHED.title": "Limite de documents atteinte",
./frontend/src/i18n/locales/fr.json:2617:  "errors.DOCUMENT_LIMIT_REACHED.body": "Vous avez atteint la limite de documents de votre forfait ({limit}). Supprimez un ancien document ou passez à un forfait supérieur.",
./frontend/src/i18n/locales/fr.json:2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "Vous avez atteint la limite de documents de votre forfait ({limit}). Supprimez un document pour libérer de l'espace.",
./frontend/src/i18n/locales/fr.json-2619-  "errors.FILE_TOO_LARGE.title": "Fichier trop volumineux",
./frontend/src/i18n/locales/fr.json-2620-  "errors.FILE_TOO_LARGE.body": "La taille maximale de fichier pour votre forfait est de {maxMb} Mo. Passez à un forfait supérieur pour des téléchargements plus volumineux.",
./frontend/src/i18n/locales/fr.json-2621-  "errors.UNSUPPORTED_FORMAT.title": "Format de fichier non pris en charge",
./frontend/src/i18n/locales/fr.json-2622-  "errors.UNSUPPORTED_FORMAT.body": "Veuillez télécharger un fichier PDF, DOCX, PPTX, XLSX, TXT ou MD.",
./frontend/src/i18n/locales/fr.json-2623-  "errors.INVALID_FILE_CONTENT.title": "Contenu du fichier invalide",
--
./frontend/src/i18n/locales/it.json-2611-  "billing.cancel.successImmediate": "Ora sei sul piano gratuito. I tuoi crediti sono conservati.",
./frontend/src/i18n/locales/it.json-2612-  "errors.cta.upgrade": "Aggiorna",
./frontend/src/i18n/locales/it.json-2613-  "errors.cta.signin": "Accedi",
./frontend/src/i18n/locales/it.json-2614-  "errors.NETWORK.title": "Problema di connessione",
./frontend/src/i18n/locales/it.json-2615-  "errors.NETWORK.body": "Qualcosa è andato storto. Controlla la connessione e riprova.",
./frontend/src/i18n/locales/it.json:2616:  "errors.DOCUMENT_LIMIT_REACHED.title": "Limite documenti raggiunto",
./frontend/src/i18n/locales/it.json:2617:  "errors.DOCUMENT_LIMIT_REACHED.body": "Hai raggiunto il limite di documenti del tuo piano ({limit}). Elimina un vecchio documento o aggiorna il piano per averne di più.",
./frontend/src/i18n/locales/it.json:2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "Hai raggiunto il limite di documenti del tuo piano ({limit}). Elimina un documento per liberare spazio.",
./frontend/src/i18n/locales/it.json-2619-  "errors.FILE_TOO_LARGE.title": "File troppo grande",
./frontend/src/i18n/locales/it.json-2620-  "errors.FILE_TOO_LARGE.body": "La dimensione massima del file sul tuo piano è {maxMb} MB. Aggiorna per caricamenti più grandi.",
./frontend/src/i18n/locales/it.json-2621-  "errors.UNSUPPORTED_FORMAT.title": "Formato file non supportato",
./frontend/src/i18n/locales/it.json-2622-  "errors.UNSUPPORTED_FORMAT.body": "Carica un file PDF, DOCX, PPTX, XLSX, TXT o MD.",
./frontend/src/i18n/locales/it.json-2623-  "errors.INVALID_FILE_CONTENT.title": "Contenuto file non valido",
--
./frontend/src/i18n/locales/en.json-2294-  "billing.cancel.successImmediate": "You're now on the Free plan. Your credits are kept.",
./frontend/src/i18n/locales/en.json-2295-  "errors.cta.upgrade": "Upgrade",
./frontend/src/i18n/locales/en.json-2296-  "errors.cta.signin": "Sign in",
./frontend/src/i18n/locales/en.json-2297-  "errors.NETWORK.title": "Connection issue",
./frontend/src/i18n/locales/en.json-2298-  "errors.NETWORK.body": "Something went wrong. Please check your connection and try again.",
./frontend/src/i18n/locales/en.json:2299:  "errors.DOCUMENT_LIMIT_REACHED.title": "Document limit reached",
./frontend/src/i18n/locales/en.json:2300:  "errors.DOCUMENT_LIMIT_REACHED.body": "You've reached your plan's document limit ({limit}). Delete an old document or upgrade for more.",
./frontend/src/i18n/locales/en.json:2301:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "You've reached your plan's document limit ({limit}). Delete a document to free up space.",
./frontend/src/i18n/locales/en.json-2302-  "errors.FILE_TOO_LARGE.title": "File too large",
./frontend/src/i18n/locales/en.json-2303-  "errors.FILE_TOO_LARGE.body": "Maximum file size on your plan is {maxMb} MB. Upgrade for larger uploads.",
./frontend/src/i18n/locales/en.json-2304-  "errors.UNSUPPORTED_FORMAT.title": "Unsupported file format",
./frontend/src/i18n/locales/en.json-2305-  "errors.UNSUPPORTED_FORMAT.body": "Please upload a PDF, DOCX, PPTX, XLSX, TXT, or MD file.",
./frontend/src/i18n/locales/en.json-2306-  "errors.INVALID_FILE_CONTENT.title": "File content invalid",
--
./frontend/src/i18n/locales/pt.json-2611-  "billing.cancel.successImmediate": "Você está agora no plano gratuito. Seus créditos foram mantidos.",
./frontend/src/i18n/locales/pt.json-2612-  "errors.cta.upgrade": "Fazer upgrade",
./frontend/src/i18n/locales/pt.json-2613-  "errors.cta.signin": "Entrar",
./frontend/src/i18n/locales/pt.json-2614-  "errors.NETWORK.title": "Problema de conexão",
./frontend/src/i18n/locales/pt.json-2615-  "errors.NETWORK.body": "Algo deu errado. Verifique sua conexão e tente novamente.",
./frontend/src/i18n/locales/pt.json:2616:  "errors.DOCUMENT_LIMIT_REACHED.title": "Limite de documentos atingido",
./frontend/src/i18n/locales/pt.json:2617:  "errors.DOCUMENT_LIMIT_REACHED.body": "Você atingiu o limite de documentos do seu plano ({limit}). Exclua um documento antigo ou faça upgrade para mais.",
./frontend/src/i18n/locales/pt.json:2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "Você atingiu o limite de documentos do seu plano ({limit}). Exclua um documento para liberar espaço.",
./frontend/src/i18n/locales/pt.json-2619-  "errors.FILE_TOO_LARGE.title": "Arquivo muito grande",
./frontend/src/i18n/locales/pt.json-2620-  "errors.FILE_TOO_LARGE.body": "O tamanho máximo de arquivo no seu plano é {maxMb} MB. Faça upgrade para uploads maiores.",
./frontend/src/i18n/locales/pt.json-2621-  "errors.UNSUPPORTED_FORMAT.title": "Formato de arquivo não suportado",
./frontend/src/i18n/locales/pt.json-2622-  "errors.UNSUPPORTED_FORMAT.body": "Envie um arquivo PDF, DOCX, PPTX, XLSX, TXT ou MD.",
./frontend/src/i18n/locales/pt.json-2623-  "errors.INVALID_FILE_CONTENT.title": "Conteúdo do arquivo inválido",
--
./frontend/src/i18n/locales/de.json-2611-  "profile.tabs.notifications": "Benachrichtigungen",
./frontend/src/i18n/locales/de.json-2612-  "errors.cta.upgrade": "Upgrade",
./frontend/src/i18n/locales/de.json-2613-  "errors.cta.signin": "Anmelden",
./frontend/src/i18n/locales/de.json-2614-  "errors.NETWORK.title": "Verbindungsproblem",
./frontend/src/i18n/locales/de.json-2615-  "errors.NETWORK.body": "Etwas ist schiefgelaufen. Bitte überprüfen Sie Ihre Verbindung und versuchen Sie es erneut.",
./frontend/src/i18n/locales/de.json:2616:  "errors.DOCUMENT_LIMIT_REACHED.title": "Dokumentenlimit erreicht",
./frontend/src/i18n/locales/de.json:2617:  "errors.DOCUMENT_LIMIT_REACHED.body": "Sie haben das Dokumentenlimit Ihres Tarifs erreicht ({limit}). Löschen Sie ein altes Dokument oder führen Sie ein Upgrade durch.",
./frontend/src/i18n/locales/de.json:2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "Sie haben das Dokumentenlimit Ihres Tarifs erreicht ({limit}). Löschen Sie ein Dokument, um Platz freizugeben.",
./frontend/src/i18n/locales/de.json-2619-  "errors.FILE_TOO_LARGE.title": "Datei zu groß",
./frontend/src/i18n/locales/de.json-2620-  "errors.FILE_TOO_LARGE.body": "Die maximale Dateigröße in Ihrem Tarif beträgt {maxMb} MB. Führen Sie ein Upgrade für größere Uploads durch.",
./frontend/src/i18n/locales/de.json-2621-  "errors.UNSUPPORTED_FORMAT.title": "Nicht unterstütztes Dateiformat",
./frontend/src/i18n/locales/de.json-2622-  "errors.UNSUPPORTED_FORMAT.body": "Bitte laden Sie eine PDF-, DOCX-, PPTX-, XLSX-, TXT- oder MD-Datei hoch.",
./frontend/src/i18n/locales/de.json-2623-  "errors.INVALID_FILE_CONTENT.title": "Dateiinhalt ungültig",
--
./frontend/src/i18n/locales/ja.json-2611-  "billing.cancel.successImmediate": "無料プランに変更しました。クレジットは保持されます。",
./frontend/src/i18n/locales/ja.json-2612-  "errors.cta.upgrade": "アップグレード",
./frontend/src/i18n/locales/ja.json-2613-  "errors.cta.signin": "サインイン",
./frontend/src/i18n/locales/ja.json-2614-  "errors.NETWORK.title": "接続の問題",
./frontend/src/i18n/locales/ja.json-2615-  "errors.NETWORK.body": "エラーが発生しました。接続を確認して再試行してください。",
./frontend/src/i18n/locales/ja.json:2616:  "errors.DOCUMENT_LIMIT_REACHED.title": "ドキュメント数の上限に達しました",
./frontend/src/i18n/locales/ja.json:2617:  "errors.DOCUMENT_LIMIT_REACHED.body": "プランのドキュメント上限（{limit}）に達しました。古いドキュメントを削除するか、アップグレードしてください。",
./frontend/src/i18n/locales/ja.json:2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "プランのドキュメント上限（{limit}）に達しました。ドキュメントを削除して空き容量を確保してください。",
./frontend/src/i18n/locales/ja.json-2619-  "errors.FILE_TOO_LARGE.title": "ファイルが大きすぎます",
./frontend/src/i18n/locales/ja.json-2620-  "errors.FILE_TOO_LARGE.body": "プランの最大ファイルサイズは{maxMb}MBです。より大きなファイルをアップロードするにはアップグレードしてください。",
./frontend/src/i18n/locales/ja.json-2621-  "errors.UNSUPPORTED_FORMAT.title": "サポートされていないファイル形式",
./frontend/src/i18n/locales/ja.json-2622-  "errors.UNSUPPORTED_FORMAT.body": "PDF、DOCX、PPTX、XLSX、TXT、またはMDファイルをアップロードしてください。",
./frontend/src/i18n/locales/ja.json-2623-  "errors.INVALID_FILE_CONTENT.title": "ファイルの内容が無効です",
--
./frontend/src/i18n/locales/zh.json-2650-  "billing.cancel.successImmediate": "您现在使用免费套餐。您的积分已保留。",
./frontend/src/i18n/locales/zh.json-2651-  "errors.cta.upgrade": "升级",
./frontend/src/i18n/locales/zh.json-2652-  "errors.cta.signin": "登录",
./frontend/src/i18n/locales/zh.json-2653-  "errors.NETWORK.title": "连接问题",
./frontend/src/i18n/locales/zh.json-2654-  "errors.NETWORK.body": "出了点问题。请检查您的连接后重试。",
./frontend/src/i18n/locales/zh.json:2655:  "errors.DOCUMENT_LIMIT_REACHED.title": "文档数量已达上限",
./frontend/src/i18n/locales/zh.json:2656:  "errors.DOCUMENT_LIMIT_REACHED.body": "您已达到套餐的文档数量上限（{limit}）。删除旧文档或升级以获取更多。",
./frontend/src/i18n/locales/zh.json:2657:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "您已达到套餐的文档数量上限（{limit}）。删除一个文档以释放空间。",
./frontend/src/i18n/locales/zh.json-2658-  "errors.FILE_TOO_LARGE.title": "文件过大",
./frontend/src/i18n/locales/zh.json-2659-  "errors.FILE_TOO_LARGE.body": "您套餐的最大文件大小为{maxMb} MB。升级以上传更大文件。",
./frontend/src/i18n/locales/zh.json-2660-  "errors.UNSUPPORTED_FORMAT.title": "不支持的文件格式",
./frontend/src/i18n/locales/zh.json-2661-  "errors.UNSUPPORTED_FORMAT.body": "请上传PDF、DOCX、PPTX、XLSX、TXT或MD文件。",
./frontend/src/i18n/locales/zh.json-2662-  "errors.INVALID_FILE_CONTENT.title": "文件内容无效",
--
./frontend/src/lib/errorCopy.ts-125-  return undefined;
./frontend/src/lib/errorCopy.ts-126-}
./frontend/src/lib/errorCopy.ts-127-
./frontend/src/lib/errorCopy.ts-128-const CODE_TABLE: Record<string, Handler> = {
./frontend/src/lib/errorCopy.ts-129-  // ─── Upload ───
./frontend/src/lib/errorCopy.ts:130:  DOCUMENT_LIMIT_REACHED: (d, tOr) => {
./frontend/src/lib/errorCopy.ts-131-    const plan = targetPlanOrNone(d);
./frontend/src/lib/errorCopy.ts-132-    return {
./frontend/src/lib/errorCopy.ts:133:      title: tOr('errors.DOCUMENT_LIMIT_REACHED.title', 'Document limit reached'),
./frontend/src/lib/errorCopy.ts-134-      body: plan
./frontend/src/lib/errorCopy.ts:135:        ? tOr('errors.DOCUMENT_LIMIT_REACHED.body', 'You\'ve reached your plan\'s document limit ({limit}). Delete an old document or upgrade for more.', {
./frontend/src/lib/errorCopy.ts-136-            limit: String(d.limit ?? ''),
./frontend/src/lib/errorCopy.ts-137-          })
./frontend/src/lib/errorCopy.ts:138:        : tOr('errors.DOCUMENT_LIMIT_REACHED.bodyTopTier', 'You\'ve reached your plan\'s document limit ({limit}). Delete a document to free up space.', {
./frontend/src/lib/errorCopy.ts-139-            limit: String(d.limit ?? ''),
./frontend/src/lib/errorCopy.ts-140-          }),
./frontend/src/lib/errorCopy.ts-141-      cta: plan ? upgradeCta(tOr, 'document_limit', plan) : undefined,
./frontend/src/lib/errorCopy.ts-142-      severity: 'warning',
./frontend/src/lib/errorCopy.ts-143-    };
--
./backend/tests/test_layout_translations_api.py-189-        json={"target_language": "zh-CN", "add_to_library": True},
./backend/tests/test_layout_translations_api.py-190-    )
./backend/tests/test_layout_translations_api.py-191-
./backend/tests/test_layout_translations_api.py-192-    assert response.status_code == 403
./backend/tests/test_layout_translations_api.py-193-    detail = response.json()["detail"]
./backend/tests/test_layout_translations_api.py:194:    assert detail["error"] == "DOCUMENT_LIMIT_REACHED"
./backend/tests/test_layout_translations_api.py-195-    assert detail["limit"] == 20
./backend/tests/test_layout_translations_api.py-196-    db.add.assert_not_called()
./backend/tests/test_layout_translations_api.py-197-
./backend/tests/test_layout_translations_api.py-198-
./backend/tests/test_layout_translations_api.py-199-@pytest.mark.asyncio
--
./backend/tests/test_layout_translations_api.py-224-        json={"target_language": "zh-CN", "add_to_library": True},
./backend/tests/test_layout_translations_api.py-225-    )
./backend/tests/test_layout_translations_api.py-226-
./backend/tests/test_layout_translations_api.py-227-    assert response.status_code == 403
./backend/tests/test_layout_translations_api.py-228-    detail = response.json()["detail"]
./backend/tests/test_layout_translations_api.py:229:    assert detail["error"] == "DOCUMENT_LIMIT_REACHED"
./backend/tests/test_layout_translations_api.py-230-    assert existing.metadata_json == {}
./backend/tests/test_layout_translations_api.py-231-
./backend/tests/test_layout_translations_api.py-232-
./backend/tests/test_layout_translations_api.py-233-@pytest.mark.asyncio
./backend/tests/test_layout_translations_api.py-234-async def test_layout_translation_rejects_large_files_before_trial_is_consumed(client: AsyncClient) -> None:
--
./backend/app/api/documents.py-222-    if user_doc_count >= max_docs:
./backend/app/api/documents.py-223-        log_security_event("plan_limit_hit", user_id=user.id, plan=plan, limit_type="documents", limit=max_docs, current=user_doc_count)
./backend/app/api/documents.py-224-        raise HTTPException(
./backend/app/api/documents.py-225-            status_code=403,
./backend/app/api/documents.py-226-            detail={
./backend/app/api/documents.py:227:                "error": "DOCUMENT_LIMIT_REACHED",
./backend/app/api/documents.py-228-                "message": "Document limit reached for current plan",
./backend/app/api/documents.py-229-                "limit": max_docs,
./backend/app/api/documents.py-230-                "current": user_doc_count,
./backend/app/api/documents.py-231-                "plan": plan,
./backend/app/api/documents.py-232-            },
--
./backend/app/api/documents.py-356-    if user_doc_count >= max_docs:
./backend/app/api/documents.py-357-        log_security_event("plan_limit_hit", user_id=user.id, plan=plan, limit_type="documents", limit=max_docs, current=user_doc_count)
./backend/app/api/documents.py-358-        raise HTTPException(
./backend/app/api/documents.py-359-            status_code=403,
./backend/app/api/documents.py-360-            detail={
./backend/app/api/documents.py:361:                "error": "DOCUMENT_LIMIT_REACHED",
./backend/app/api/documents.py-362-                "message": "Document limit reached for current plan",
./backend/app/api/documents.py-363-                "limit": max_docs,
./backend/app/api/documents.py-364-                "current": user_doc_count,
./backend/app/api/documents.py-365-                "plan": plan,
./backend/app/api/documents.py-366-            },
--
./backend/app/api/layout_translations.py-171-    max_docs = _max_documents_for_plan(plan)
./backend/app/api/layout_translations.py-172-    if int(current or 0) >= max_docs:
./backend/app/api/layout_translations.py-173-        raise HTTPException(
./backend/app/api/layout_translations.py-174-            status_code=403,
./backend/app/api/layout_translations.py-175-            detail={
./backend/app/api/layout_translations.py:176:                "error": "DOCUMENT_LIMIT_REACHED",
./backend/app/api/layout_translations.py-177-                "message": "Document limit reached for current plan",
./backend/app/api/layout_translations.py-178-                "limit": max_docs,
./backend/app/api/layout_translations.py-179-                "current": int(current or 0),
./backend/app/api/layout_translations.py-180-                "plan": plan,
./backend/app/api/layout_translations.py-181-            },

exec
/bin/zsh -lc "sed -n '1,220p' frontend/src/lib/api.ts && sed -n '1,100p' frontend/src/lib/billingLinks.ts" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
import type { DocumentResponse, Message, SearchResponse, Citation, SessionListResponse, CollectionBrief, CollectionDetail, NormalizedBBox, ExtractionJob, ExtractionTemplate, DocumentTable, QuestionTemplate, DocumentHierarchicalBrief, ChatArtifact } from '../types';
import type { UserProfile, CreditHistoryResponse, UsageBreakdown } from '../types';

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';
export const PROXY_BASE = '/api/proxy';

/**
 * Structured error thrown by `handle()` for any non-2xx response.
 *
 * Wire contract (docs/ARCHITECTURE.md §10, coming in Phase 6):
 * - `status`: HTTP status code (e.g. 403).
 * - `code`: the canonical `detail.error` string from the backend, or null
 *   if the body wasn't a JSON object with a string `error` field.
 * - `detail`: the parsed `detail` object (or parsed body itself if the
 *   backend didn't wrap it), or `{}` when parsing failed.
 * - `raw`: the raw response body, verbatim.
 *
 * `message` MUST stay in the exact `HTTP <status>: <raw>` shape because
 * legacy substring consumers still depend on it during the deprecation
 * window (BillingPageClient regex at BillingPageClient.tsx:157-168,
 * useChatStream HTTP/phrase matches at useChatStream.ts:95-114). Do not
 * "simplify" the message format until Phase 5 ships.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | null,
    public readonly detail: Record<string, unknown>,
    public readonly raw: string,
  ) {
    super(`HTTP ${status}: ${raw}`);
    this.name = 'ApiError';
  }
}

/**
 * Read the response body and throw a structured `ApiError`. Shared by
 * `handle()`, `exportSession()`, and other helpers that don't fit the
 * `res.json()` shape. Always throws — return type is `never`.
 */
async function throwApiError(res: Response): Promise<never> {
  const raw = await res.text();
  let code: string | null = null;
  let detail: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(raw);
    // FastAPI HTTPException bodies are `{ detail: {...} }` or `{ detail: "..." }`.
    // Earlier taxonomy rows used the whole body as the detail object.
    const d = (parsed && typeof parsed === 'object' && 'detail' in parsed)
      ? (parsed as Record<string, unknown>).detail
      : parsed;
    if (d && typeof d === 'object') {
      detail = d as Record<string, unknown>;
      const errField = (d as Record<string, unknown>).error;
      if (typeof errField === 'string') code = errField;
    }
  } catch {
    // non-JSON body (proxy HTML 502, network error upstream) → code stays null
  }
  throw new ApiError(res.status, code, detail, raw);
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    await throwApiError(res);
  }
  return res.json();
}

export function mapCitationPayload(c: any): Citation {
  return {
    refIndex: c.ref_index ?? c.refIndex,
    chunkId: c.chunk_id ?? c.chunkId,
    page: c.page,
    pageEnd: typeof c.page_end === 'number' ? c.page_end : (typeof c.pageEnd === 'number' ? c.pageEnd : undefined),
    bboxes: c.bboxes || [],
    textSnippet: c.text_snippet ?? c.textSnippet ?? '',
    focusSnippet: typeof c.focus_snippet === 'string' ? c.focus_snippet : (typeof c.focusSnippet === 'string' ? c.focusSnippet : undefined),
    offset: c.offset ?? 0,
    documentId: typeof c.document_id === 'string' ? c.document_id : (typeof c.documentId === 'string' ? c.documentId : undefined),
    documentFilename: typeof c.document_filename === 'string' ? c.document_filename : (typeof c.documentFilename === 'string' ? c.documentFilename : undefined),
    confidenceScore: typeof c.confidence_score === 'number' ? c.confidence_score : (typeof c.confidenceScore === 'number' ? c.confidenceScore : undefined),
    contextText: typeof c.context_text === 'string' ? c.context_text : (typeof c.contextText === 'string' ? c.contextText : undefined),
    retrievalModality: typeof c.retrieval_modality === 'string' ? c.retrieval_modality : (typeof c.retrievalModality === 'string' ? c.retrievalModality : undefined),
  };
}

export function mapArtifactPayload(raw: any): ChatArtifact {
  const citations = Array.isArray(raw?.citations) ? raw.citations.map(mapCitationPayload) : [];
  return {
    artifactType: raw?.artifact_type ?? raw?.artifactType ?? 'artifact',
    status: raw?.status ?? 'queued',
    jobId: raw?.job_id ?? raw?.jobId ?? null,
    title: raw?.title ?? 'Artifact',
    summary: raw?.summary ?? '',
    preview: raw?.preview,
    downloadUrls: Array.isArray(raw?.download_urls) ? raw.download_urls : (Array.isArray(raw?.downloadUrls) ? raw.downloadUrls : []),
    citations,
    warning: raw?.warning ?? null,
    requiredPlan: raw?.required_plan ?? raw?.requiredPlan ?? null,
  };
}

export interface DocumentBrief {
  id: string;
  filename: string;
  status: string;
  created_at: string | null;
}

export async function getMyDocuments(signal?: AbortSignal): Promise<DocumentBrief[]> {
  const res = await fetch(`${PROXY_BASE}/api/documents`, { signal });
  if (!res.ok) {
    if (res.status === 401) return [];
    throw new Error(`Failed to fetch documents: ${res.status}`);
  }
  return res.json();
}

export async function uploadDocument(file: File): Promise<{ document_id: string; status: string; filename?: string }>
{
  // Uploads bypass the Vercel proxy to avoid the 4.5MB serverless body limit.
  // 1. Obtain a short-lived backend JWT via the lightweight /api/upload-token endpoint
  // 2. POST the file directly to the Railway backend with that JWT
  const tokenRes = await fetch('/api/upload-token');
  if (!tokenRes.ok) await throwApiError(tokenRes);
  const { token } = await tokenRes.json();

  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/api/documents/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: form,
  });
  return handle(res);
}

export async function getDocument(docId: string): Promise<DocumentResponse> {
  const res = await fetch(`${PROXY_BASE}/api/documents/${docId}`);
  return handle(res);
}

export async function getDocumentBrief(docId: string): Promise<DocumentHierarchicalBrief> {
  const res = await fetch(`${PROXY_BASE}/api/documents/${docId}/brief`);
  return handle(res);
}

export async function getDocumentFileUrl(docId: string): Promise<{ url: string; expires_in: number }> {
  const res = await fetch(`${PROXY_BASE}/api/documents/${docId}/file-url`);
  return handle(res);
}

export async function getConvertedFileUrl(docId: string): Promise<{ url: string; expires_in: number }> {
  const res = await fetch(`${PROXY_BASE}/api/documents/${docId}/file-url?variant=converted`);
  return handle(res);
}

export async function createSession(docId: string): Promise<{ session_id: string; document_id: string; title: string | null; created_at: string; demo_messages_used?: number }>
{
  const res = await fetch(`${PROXY_BASE}/api/documents/${docId}/sessions`, {
    method: 'POST',
  });
  return handle(res);
}

export async function getMessages(sessionId: string): Promise<{ messages: Message[]; demo_messages_used?: number | null }> {
  const res = await fetch(`${PROXY_BASE}/api/sessions/${sessionId}/messages`);
  const data: { messages: Array<{ id?: string; share_anchor?: string; role: Message['role']; content: string; citations?: any[]; metadata_json?: any; created_at: string }>; demo_messages_used?: number | null } = await handle(res);

  const mapped = (data.messages || []).map((m, idx) => {
    const citations: Citation[] | undefined = m.citations
      ? m.citations.map(mapCitationPayload)
      : undefined;
    const artifacts = Array.isArray(m.metadata_json?.artifacts)
      ? m.metadata_json.artifacts.map(mapArtifactPayload)
      : undefined;

    return {
      id: m.id ? `msg_${m.id}` : `msg_${idx}`,
      role: m.role,
      text: m.content,
      citations,
      artifacts,
      createdAt: Date.parse(m.created_at),
      backendId: m.id,
      shareAnchor: m.share_anchor,
    } as Message;
  });

  return { messages: mapped, demo_messages_used: data.demo_messages_used };
}

export interface DocumentJobDetail {
  id: string;
  document_id: string | null;
  collection_id: string | null;
  job_type: string;
  status: string;
  artifact: ChatArtifact;
}

export async function getDocumentJob(jobId: string): Promise<DocumentJobDetail> {
  const res = await fetch(`${PROXY_BASE}/api/document-jobs/${jobId}`);
  const data: any = await handle(res);
  return {
    ...data,
    artifact: mapArtifactPayload(data.artifact),
  };
}

export async function createLayoutTranslation(params: {
  documentId: string;
  targetLanguage?: string;
  locale?: string;
  addToLibrary?: boolean;
}): Promise<DocumentJobDetail> {
  const res = await fetch(`${PROXY_BASE}/api/documents/${params.documentId}/layout-translation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
export type BillingPlanIntent = 'plus' | 'pro';
export type BillingPeriodIntent = 'monthly' | 'annual';

interface BillingHrefOptions {
  plan?: BillingPlanIntent;
  period?: BillingPeriodIntent;
  source?: string;
  reason?: string;
}

export function billingHref({
  plan = 'plus',
  period = 'monthly',
  source,
  reason,
}: BillingHrefOptions = {}): string {
  const params = new URLSearchParams({ plan, period });
  if (source) params.set('source', source);
  if (reason) params.set('reason', reason);
  return `/billing?${params.toString()}`;
}

export function authHrefFor(path: string): string {
  return `/auth?callbackUrl=${encodeURIComponent(path)}`;
}

/**
 * Derive the upgrade-target plan to report to the user (and in analytics),
 * given the user's current billing tier and the paywall reason code. Mirrors
 * the disambiguation implicit in PaywallModal's copy:
 *   - Pro-cap reasons (PRO_MODE_LIMIT_REACHED / BALANCED_MODE_LIMIT_REACHED /
 *     MODE_NOT_ALLOWED): Free user upgrades to Plus (Plus = unrestricted Pro),
 *     Plus user upgrades to Pro.
 *   - INSUFFICIENT_CREDITS / generic 402: Free → Plus, Plus → Pro,
 *     Pro → 'pro' (already on top plan; the funnel still rolls up under the
 *     existing plan rather than getting falsely attributed to a Plus upgrade).
 *   - LAYOUT_TRANSLATION_LIMIT_REACHED / DOMAIN_MODE_REQUIRES_PLUS: always
 *     'plus' — both gates are plan checks that already pass for Plus/Pro, so
 *     they only ever fire for a free-plan user.
 *
 * Shared by `useChatStream.ts` (analytics + paywall trigger) and
 * `PaywallModal.tsx` (CTA href + click analytics) so the route the user is
 * sent to matches the funnel event they generated. Keep them in sync.
 */
export function deriveUpgradePlan(
  currentPlan: string | undefined,
  reason: string | null | undefined,
): BillingPlanIntent {
  if (reason === 'LAYOUT_TRANSLATION_LIMIT_REACHED' || reason === 'DOMAIN_MODE_REQUIRES_PLUS') {
    return 'plus';
  }
  const isProCap = reason === 'PRO_MODE_LIMIT_REACHED'
    || reason === 'BALANCED_MODE_LIMIT_REACHED'
    || reason === 'MODE_NOT_ALLOWED';
  if (isProCap) {
    return currentPlan === 'plus' ? 'pro' : 'plus';
  }
  // Credit-exhaustion path.
  if (currentPlan === 'plus' || currentPlan === 'pro') {
    return 'pro';
  }
  return 'plus';
}

exec
/bin/zsh -lc "rg -n -C 8 \"_assert_document_capacity|DOCUMENT_LIMIT_REACHED\" backend/app --glob '*.py'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
backend/app/api/layout_translations.py-155-def _max_documents_for_plan(plan: str) -> int:
backend/app/api/layout_translations.py-156-    return {
backend/app/api/layout_translations.py-157-        "free": settings.FREE_MAX_DOCUMENTS,
backend/app/api/layout_translations.py-158-        "plus": settings.PLUS_MAX_DOCUMENTS,
backend/app/api/layout_translations.py-159-        "pro": settings.PRO_MAX_DOCUMENTS,
backend/app/api/layout_translations.py-160-    }.get(plan, settings.FREE_MAX_DOCUMENTS)
backend/app/api/layout_translations.py-161-
backend/app/api/layout_translations.py-162-
backend/app/api/layout_translations.py:163:async def _assert_document_capacity(user: User, db: AsyncSession) -> None:
backend/app/api/layout_translations.py-164-    plan = (user.plan or "free").lower()
backend/app/api/layout_translations.py-165-    current = await db.scalar(
backend/app/api/layout_translations.py-166-        select(func.count())
backend/app/api/layout_translations.py-167-        .select_from(Document)
backend/app/api/layout_translations.py-168-        .where(Document.user_id == user.id)
backend/app/api/layout_translations.py-169-        .where(Document.status != "deleting")
backend/app/api/layout_translations.py-170-    )
backend/app/api/layout_translations.py-171-    max_docs = _max_documents_for_plan(plan)
backend/app/api/layout_translations.py-172-    if int(current or 0) >= max_docs:
backend/app/api/layout_translations.py-173-        raise HTTPException(
backend/app/api/layout_translations.py-174-            status_code=403,
backend/app/api/layout_translations.py-175-            detail={
backend/app/api/layout_translations.py:176:                "error": "DOCUMENT_LIMIT_REACHED",
backend/app/api/layout_translations.py-177-                "message": "Document limit reached for current plan",
backend/app/api/layout_translations.py-178-                "limit": max_docs,
backend/app/api/layout_translations.py-179-                "current": int(current or 0),
backend/app/api/layout_translations.py-180-                "plan": plan,
backend/app/api/layout_translations.py-181-            },
backend/app/api/layout_translations.py-182-        )
backend/app/api/layout_translations.py-183-
backend/app/api/layout_translations.py-184-
--
backend/app/api/layout_translations.py-253-    existing = await _find_active_layout_translation(
backend/app/api/layout_translations.py-254-        document_id=doc.id,
backend/app/api/layout_translations.py-255-        user_id=user.id,
backend/app/api/layout_translations.py-256-        target_language=target_language,
backend/app/api/layout_translations.py-257-        db=db,
backend/app/api/layout_translations.py-258-    )
backend/app/api/layout_translations.py-259-    if existing:
backend/app/api/layout_translations.py-260-        if body.add_to_library:
backend/app/api/layout_translations.py:261:            await _assert_document_capacity(user, db)
backend/app/api/layout_translations.py-262-            existing.input_scope = {
backend/app/api/layout_translations.py-263-                **(existing.input_scope or {}),
backend/app/api/layout_translations.py-264-                "add_to_library": True,
backend/app/api/layout_translations.py-265-            }
backend/app/api/layout_translations.py-266-            existing.metadata_json = {
backend/app/api/layout_translations.py-267-                **(existing.metadata_json or {}),
backend/app/api/layout_translations.py-268-                "add_to_library_requested": True,
backend/app/api/layout_translations.py-269-            }
backend/app/api/layout_translations.py-270-            await db.commit()
backend/app/api/layout_translations.py-271-            await db.refresh(existing)
backend/app/api/layout_translations.py-272-        return await _job_response(existing, db, user)
backend/app/api/layout_translations.py-273-
backend/app/api/layout_translations.py-274-    plan = (user.plan or "free").lower()
backend/app/api/layout_translations.py-275-    _raise_layout_translation_limit_error(doc, plan)
backend/app/api/layout_translations.py-276-    if body.add_to_library:
backend/app/api/layout_translations.py:277:        await _assert_document_capacity(user, db)
backend/app/api/layout_translations.py-278-
backend/app/api/layout_translations.py-279-    config_status = layout_translation_config_status()
backend/app/api/layout_translations.py-280-    if not config_status.ready:
backend/app/api/layout_translations.py-281-        raise HTTPException(
backend/app/api/layout_translations.py-282-            status_code=503,
backend/app/api/layout_translations.py-283-            detail={
backend/app/api/layout_translations.py-284-                "error": "LAYOUT_TRANSLATION_NOT_CONFIGURED",
backend/app/api/layout_translations.py-285-                "message": "Layout-preserving translation is temporarily unavailable.",
--
backend/app/api/layout_translations.py-451-        )
backend/app/api/layout_translations.py-452-    storage_key = item.get("storage_key")
backend/app/api/layout_translations.py-453-    if not isinstance(storage_key, str) or not storage_key:
backend/app/api/layout_translations.py-454-        raise HTTPException(
backend/app/api/layout_translations.py-455-            status_code=404,
backend/app/api/layout_translations.py-456-            detail={"error": "LAYOUT_TRANSLATION_ARTIFACT_NOT_FOUND", "message": "Translated PDF not found"},
backend/app/api/layout_translations.py-457-        )
backend/app/api/layout_translations.py-458-
backend/app/api/layout_translations.py:459:    await _assert_document_capacity(user, db)
backend/app/api/layout_translations.py-460-    content = await asyncio.to_thread(storage_service.download_file, storage_key)
backend/app/api/layout_translations.py-461-    if not content.startswith(b"%PDF"):
backend/app/api/layout_translations.py-462-        raise HTTPException(
backend/app/api/layout_translations.py-463-            status_code=502,
backend/app/api/layout_translations.py-464-            detail={"error": "LAYOUT_TRANSLATION_INVALID_ARTIFACT", "message": "Translated PDF is invalid"},
backend/app/api/layout_translations.py-465-        )
backend/app/api/layout_translations.py-466-
backend/app/api/layout_translations.py-467-    filename = _translated_import_filename(job, item)
--
backend/app/api/documents.py-219-        "plus": settings.PLUS_MAX_DOCUMENTS,
backend/app/api/documents.py-220-        "pro": settings.PRO_MAX_DOCUMENTS,
backend/app/api/documents.py-221-    }.get(plan, settings.FREE_MAX_DOCUMENTS)
backend/app/api/documents.py-222-    if user_doc_count >= max_docs:
backend/app/api/documents.py-223-        log_security_event("plan_limit_hit", user_id=user.id, plan=plan, limit_type="documents", limit=max_docs, current=user_doc_count)
backend/app/api/documents.py-224-        raise HTTPException(
backend/app/api/documents.py-225-            status_code=403,
backend/app/api/documents.py-226-            detail={
backend/app/api/documents.py:227:                "error": "DOCUMENT_LIMIT_REACHED",
backend/app/api/documents.py-228-                "message": "Document limit reached for current plan",
backend/app/api/documents.py-229-                "limit": max_docs,
backend/app/api/documents.py-230-                "current": user_doc_count,
backend/app/api/documents.py-231-                "plan": plan,
backend/app/api/documents.py-232-            },
backend/app/api/documents.py-233-        )
backend/app/api/documents.py-234-
backend/app/api/documents.py-235-    # Validate size by streaming bytes with early abort to prevent memory DoS
--
backend/app/api/documents.py-353-        "plus": settings.PLUS_MAX_DOCUMENTS,
backend/app/api/documents.py-354-        "pro": settings.PRO_MAX_DOCUMENTS,
backend/app/api/documents.py-355-    }.get(plan, settings.FREE_MAX_DOCUMENTS)
backend/app/api/documents.py-356-    if user_doc_count >= max_docs:
backend/app/api/documents.py-357-        log_security_event("plan_limit_hit", user_id=user.id, plan=plan, limit_type="documents", limit=max_docs, current=user_doc_count)
backend/app/api/documents.py-358-        raise HTTPException(
backend/app/api/documents.py-359-            status_code=403,
backend/app/api/documents.py-360-            detail={
backend/app/api/documents.py:361:                "error": "DOCUMENT_LIMIT_REACHED",
backend/app/api/documents.py-362-                "message": "Document limit reached for current plan",
backend/app/api/documents.py-363-                "limit": max_docs,
backend/app/api/documents.py-364-                "current": user_doc_count,
backend/app/api/documents.py-365-                "plan": plan,
backend/app/api/documents.py-366-            },
backend/app/api/documents.py-367-        )
backend/app/api/documents.py-368-
backend/app/api/documents.py-369-    try:

exec
/bin/zsh -lc "rg -n -C 12 \"errorCopy\\(|layout.*Error|cta\" frontend/src/components/DocumentReaderPageClient.tsx frontend/src/components/Chat/ChatArtifactCard.tsx frontend/src/components/dashboard/DashboardPageClient.tsx" in /Users/mayijie/Projects/Code/010_DocTalk
 exited 2 in 0ms:
rg: frontend/src/components/DocumentReaderPageClient.tsx: No such file or directory (os error 2)
frontend/src/components/Chat/ChatArtifactCard.tsx-97-  if (method === 'pymupdf') return tOr('tables.methodBasicParser', 'Basic parser');
frontend/src/components/Chat/ChatArtifactCard.tsx-98-  if (method === 'azure') return tOr('tables.methodLayoutModel', 'Layout model');
frontend/src/components/Chat/ChatArtifactCard.tsx-99-  return typeof method === 'string' && method ? method : '';
frontend/src/components/Chat/ChatArtifactCard.tsx-100-}
frontend/src/components/Chat/ChatArtifactCard.tsx-101-
frontend/src/components/Chat/ChatArtifactCard.tsx-102-export default function ChatArtifactCard({ artifact, onCitationClick, onPreviewLayoutTranslation }: ChatArtifactCardProps) {
frontend/src/components/Chat/ChatArtifactCard.tsx-103-  const { t, tOr, locale } = useLocale();
frontend/src/components/Chat/ChatArtifactCard.tsx-104-  const [current, setCurrent] = useState(artifact);
frontend/src/components/Chat/ChatArtifactCard.tsx-105-  const [tableJob, setTableJob] = useState<{ id: string; status: string; tableId: string } | null>(null);
frontend/src/components/Chat/ChatArtifactCard.tsx-106-  const [rebuildingTableId, setRebuildingTableId] = useState<string | null>(null);
frontend/src/components/Chat/ChatArtifactCard.tsx-107-  const [tableRebuildError, setTableRebuildError] = useState<string | null>(null);
frontend/src/components/Chat/ChatArtifactCard.tsx-108-  const [layoutImporting, setLayoutImporting] = useState(false);
frontend/src/components/Chat/ChatArtifactCard.tsx:109:  const [layoutImportError, setLayoutImportError] = useState<ErrorCopy | null>(null);
frontend/src/components/Chat/ChatArtifactCard.tsx-110-  const autoImportAttemptedRef = useRef(false);
frontend/src/components/Chat/ChatArtifactCard.tsx-111-  const isPending = current.status === 'queued' || current.status === 'running';
frontend/src/components/Chat/ChatArtifactCard.tsx-112-  const isFailed = current.status === 'failed';
frontend/src/components/Chat/ChatArtifactCard.tsx-113-  const isDone = current.status === 'succeeded';
frontend/src/components/Chat/ChatArtifactCard.tsx-114-  const isLayoutTranslation = current.artifactType === 'layout_translation';
frontend/src/components/Chat/ChatArtifactCard.tsx-115-  const isQuoteSearch = current.artifactType === 'quote_search';
frontend/src/components/Chat/ChatArtifactCard.tsx-116-  const documentId = useDocTalkStore((s) => s.documentId);
frontend/src/components/Chat/ChatArtifactCard.tsx-117-  const userPlan = useDocTalkStore((s) => s.userPlan);
frontend/src/components/Chat/ChatArtifactCard.tsx-118-
frontend/src/components/Chat/ChatArtifactCard.tsx-119-  useEffect(() => {
frontend/src/components/Chat/ChatArtifactCard.tsx-120-    setCurrent(artifact);
frontend/src/components/Chat/ChatArtifactCard.tsx-121-  }, [artifact]);
--
frontend/src/components/Chat/ChatArtifactCard.tsx-285-      const result = await importLayoutTranslationDocument(current.jobId, locale);
frontend/src/components/Chat/ChatArtifactCard.tsx-286-      setCurrent((prev) => ({
frontend/src/components/Chat/ChatArtifactCard.tsx-287-        ...prev,
frontend/src/components/Chat/ChatArtifactCard.tsx-288-        preview: {
frontend/src/components/Chat/ChatArtifactCard.tsx-289-          ...(prev.preview && typeof prev.preview === 'object' ? prev.preview as Record<string, unknown> : {}),
frontend/src/components/Chat/ChatArtifactCard.tsx-290-          imported_document_id: result.document_id,
frontend/src/components/Chat/ChatArtifactCard.tsx-291-          imported_document_filename: result.filename,
frontend/src/components/Chat/ChatArtifactCard.tsx-292-          imported_document_status: result.status,
frontend/src/components/Chat/ChatArtifactCard.tsx-293-          import_error: null,
frontend/src/components/Chat/ChatArtifactCard.tsx-294-        },
frontend/src/components/Chat/ChatArtifactCard.tsx-295-      }));
frontend/src/components/Chat/ChatArtifactCard.tsx-296-    } catch (err) {
frontend/src/components/Chat/ChatArtifactCard.tsx:297:      setLayoutImportError(errorCopy(err, t, tOr));
frontend/src/components/Chat/ChatArtifactCard.tsx-298-    } finally {
frontend/src/components/Chat/ChatArtifactCard.tsx-299-      setLayoutImporting(false);
frontend/src/components/Chat/ChatArtifactCard.tsx-300-    }
frontend/src/components/Chat/ChatArtifactCard.tsx-301-  };
frontend/src/components/Chat/ChatArtifactCard.tsx-302-
frontend/src/components/Chat/ChatArtifactCard.tsx-303-  useEffect(() => {
frontend/src/components/Chat/ChatArtifactCard.tsx-304-    if (!isLayoutTranslation || !isDone || !importRequested || importedDocumentId || autoImportAttemptedRef.current) return;
frontend/src/components/Chat/ChatArtifactCard.tsx-305-    autoImportAttemptedRef.current = true;
frontend/src/components/Chat/ChatArtifactCard.tsx-306-    void handleImportLayoutTranslation();
frontend/src/components/Chat/ChatArtifactCard.tsx-307-    // eslint-disable-next-line react-hooks/exhaustive-deps
frontend/src/components/Chat/ChatArtifactCard.tsx-308-  }, [importRequested, importedDocumentId, isDone, isLayoutTranslation]);
frontend/src/components/Chat/ChatArtifactCard.tsx-309-
--
frontend/src/components/Chat/ChatArtifactCard.tsx-322-                : isDone
frontend/src/components/Chat/ChatArtifactCard.tsx-323-                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
frontend/src/components/Chat/ChatArtifactCard.tsx-324-                  : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
frontend/src/components/Chat/ChatArtifactCard.tsx-325-            }`}>
frontend/src/components/Chat/ChatArtifactCard.tsx-326-              {isFailed ? <AlertTriangle size={12} /> : isDone ? <CheckCircle2 size={12} /> : <Clock3 size={12} />}
frontend/src/components/Chat/ChatArtifactCard.tsx-327-              {current.status}
frontend/src/components/Chat/ChatArtifactCard.tsx-328-            </span>
frontend/src/components/Chat/ChatArtifactCard.tsx-329-          </div>
frontend/src/components/Chat/ChatArtifactCard.tsx-330-          <p className="mt-1 text-sm leading-relaxed text-[var(--reader-muted)]">{displaySummary}</p>
frontend/src/components/Chat/ChatArtifactCard.tsx-331-          {tableRebuildError ? (
frontend/src/components/Chat/ChatArtifactCard.tsx-332-            <p className="mt-2 text-xs text-red-700 dark:text-red-300">{tableRebuildError}</p>
frontend/src/components/Chat/ChatArtifactCard.tsx-333-          ) : null}
frontend/src/components/Chat/ChatArtifactCard.tsx:334:          {layoutImportError ? (
frontend/src/components/Chat/ChatArtifactCard.tsx-335-            <p className="mt-2 text-xs text-red-700 dark:text-red-300">
frontend/src/components/Chat/ChatArtifactCard.tsx:336:              {layoutImportError.title}: {layoutImportError.body}
frontend/src/components/Chat/ChatArtifactCard.tsx:337:              {layoutImportError.cta && (
frontend/src/components/Chat/ChatArtifactCard.tsx-338-                <Link
frontend/src/components/Chat/ChatArtifactCard.tsx:339:                  href={layoutImportError.cta.href}
frontend/src/components/Chat/ChatArtifactCard.tsx-340-                  className="ml-1 font-medium underline decoration-red-400 underline-offset-2 hover:text-red-800 dark:hover:text-red-100"
frontend/src/components/Chat/ChatArtifactCard.tsx-341-                >
frontend/src/components/Chat/ChatArtifactCard.tsx:342:                  {layoutImportError.cta.label}
frontend/src/components/Chat/ChatArtifactCard.tsx-343-                </Link>
frontend/src/components/Chat/ChatArtifactCard.tsx-344-              )}
frontend/src/components/Chat/ChatArtifactCard.tsx-345-            </p>
frontend/src/components/Chat/ChatArtifactCard.tsx-346-          ) : null}
frontend/src/components/Chat/ChatArtifactCard.tsx-347-          {isLayoutTranslation && typeof layoutPreview.import_error === 'string' && layoutPreview.import_error ? (
frontend/src/components/Chat/ChatArtifactCard.tsx-348-            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{layoutPreview.import_error}</p>
frontend/src/components/Chat/ChatArtifactCard.tsx-349-          ) : null}
frontend/src/components/Chat/ChatArtifactCard.tsx-350-          {current.warning ? (
frontend/src/components/Chat/ChatArtifactCard.tsx-351-            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{current.warning}</p>
frontend/src/components/Chat/ChatArtifactCard.tsx-352-          ) : null}
frontend/src/components/Chat/ChatArtifactCard.tsx-353-        </div>
frontend/src/components/Chat/ChatArtifactCard.tsx-354-        {isPending ? <RefreshCw size={16} className="mt-2 shrink-0 animate-spin text-[var(--reader-muted)] motion-reduce:animate-none" /> : null}
--
frontend/src/components/dashboard/DashboardPageClient.tsx-25-import { useUserProfile } from '../../lib/useUserProfile';
frontend/src/components/dashboard/DashboardPageClient.tsx-26-
frontend/src/components/dashboard/DashboardPageClient.tsx-27-type StoredDoc = { document_id: string; filename?: string; createdAt: number; status?: string };
frontend/src/components/dashboard/DashboardPageClient.tsx-28-type PlanTier = 'free' | 'plus' | 'pro';
frontend/src/components/dashboard/DashboardPageClient.tsx-29-
frontend/src/components/dashboard/DashboardPageClient.tsx-30-// Must mirror backend FREE/PLUS/PRO_MAX_FILE_SIZE_MB (app/core/config.py).
frontend/src/components/dashboard/DashboardPageClient.tsx-31-const MAX_UPLOAD_MB_BY_PLAN: Record<PlanTier, number> = {
frontend/src/components/dashboard/DashboardPageClient.tsx-32-  free: 50,
frontend/src/components/dashboard/DashboardPageClient.tsx-33-  plus: 50,
frontend/src/components/dashboard/DashboardPageClient.tsx-34-  pro: 100,
frontend/src/components/dashboard/DashboardPageClient.tsx-35-};
frontend/src/components/dashboard/DashboardPageClient.tsx-36-
frontend/src/components/dashboard/DashboardPageClient.tsx:37:const DASHBOARD_NUDGE_DISMISS_KEY = 'doctalk_dashboard_upgrade_nudge_dismissed_at';
frontend/src/components/dashboard/DashboardPageClient.tsx:38:const DASHBOARD_NUDGE_LAST_SHOWN_KEY = 'doctalk_dashboard_upgrade_nudge_last_shown_at';
frontend/src/components/dashboard/DashboardPageClient.tsx:39:const DASHBOARD_NUDGE_IMPRESSIONS_KEY = 'doctalk_dashboard_upgrade_nudge_impressions';
frontend/src/components/dashboard/DashboardPageClient.tsx-40-const DASHBOARD_NUDGE_DISMISS_MS = 14 * 24 * 60 * 60 * 1000;
frontend/src/components/dashboard/DashboardPageClient.tsx-41-const DASHBOARD_NUDGE_SHOW_MS = 7 * 24 * 60 * 60 * 1000;
frontend/src/components/dashboard/DashboardPageClient.tsx-42-const DASHBOARD_NUDGE_MAX_IMPRESSIONS = 3;
frontend/src/components/dashboard/DashboardPageClient.tsx-43-
frontend/src/components/dashboard/DashboardPageClient.tsx-44-/**
frontend/src/components/dashboard/DashboardPageClient.tsx-45- * The authenticated dashboard surface — upload zone, URL ingest, document
frontend/src/components/dashboard/DashboardPageClient.tsx-46- * list, upgrade nudges, workspace nudge. Uses the functional app palette
frontend/src/components/dashboard/DashboardPageClient.tsx-47- * (`dt-stitch-theme`, zinc+blue) — see `.claude/rules/frontend.md`.
frontend/src/components/dashboard/DashboardPageClient.tsx-48- *
frontend/src/components/dashboard/DashboardPageClient.tsx-49- * Extracted from `HomePageClient.tsx` (Wave-2 Q27). The Wave-1 fixes
frontend/src/components/dashboard/DashboardPageClient.tsx-50- * preserved here:
frontend/src/components/dashboard/DashboardPageClient.tsx-51- *   - C3: silent-delete is now try/catch with explicit error UI per row,
--
frontend/src/components/dashboard/DashboardPageClient.tsx-73-  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
frontend/src/components/dashboard/DashboardPageClient.tsx-74-  const [urlInput, setUrlInput] = useState('');
frontend/src/components/dashboard/DashboardPageClient.tsx-75-  const [urlLoading, setUrlLoading] = useState(false);
frontend/src/components/dashboard/DashboardPageClient.tsx-76-  const [urlError, setUrlError] = useState('');
frontend/src/components/dashboard/DashboardPageClient.tsx-77-  const [urlErrorCopy, setUrlErrorCopy] = useState<ErrorCopy | null>(null);
frontend/src/components/dashboard/DashboardPageClient.tsx-78-  const [upgradeNudgeDismissed, setUpgradeNudgeDismissed] = useState(true);
frontend/src/components/dashboard/DashboardPageClient.tsx-79-  const upgradeNudgeTrackedRef = useRef(false);
frontend/src/components/dashboard/DashboardPageClient.tsx-80-  const isLoggedIn = status === 'authenticated';
frontend/src/components/dashboard/DashboardPageClient.tsx-81-  const { profile } = useUserProfile();
frontend/src/components/dashboard/DashboardPageClient.tsx-82-
frontend/src/components/dashboard/DashboardPageClient.tsx-83-  useEffect(() => {
frontend/src/components/dashboard/DashboardPageClient.tsx-84-    if (status !== 'unauthenticated') return;
frontend/src/components/dashboard/DashboardPageClient.tsx:85:    const docs = JSON.parse(localStorage.getItem('doctalk_docs') || '[]') as StoredDoc[];
frontend/src/components/dashboard/DashboardPageClient.tsx-86-    setMyDocs(docs.sort((a, b) => b.createdAt - a.createdAt));
frontend/src/components/dashboard/DashboardPageClient.tsx-87-  }, [status]);
frontend/src/components/dashboard/DashboardPageClient.tsx-88-
frontend/src/components/dashboard/DashboardPageClient.tsx-89-  useEffect(() => {
frontend/src/components/dashboard/DashboardPageClient.tsx-90-    if (!isLoggedIn) return;
frontend/src/components/dashboard/DashboardPageClient.tsx-91-    const controller = new AbortController();
frontend/src/components/dashboard/DashboardPageClient.tsx-92-    getMyDocuments(controller.signal).then(setServerDocs).catch((err) => {
frontend/src/components/dashboard/DashboardPageClient.tsx-93-      if (err.name !== 'AbortError') console.error(err);
frontend/src/components/dashboard/DashboardPageClient.tsx-94-    });
frontend/src/components/dashboard/DashboardPageClient.tsx-95-    return () => controller.abort();
frontend/src/components/dashboard/DashboardPageClient.tsx-96-  }, [isLoggedIn]);
frontend/src/components/dashboard/DashboardPageClient.tsx-97-
--
frontend/src/components/dashboard/DashboardPageClient.tsx-221-    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
frontend/src/components/dashboard/DashboardPageClient.tsx-222-    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(ext)) {
frontend/src/components/dashboard/DashboardPageClient.tsx-223-      setProgressText(t('upload.unsupportedFormat'));
frontend/src/components/dashboard/DashboardPageClient.tsx-224-      setUploadErrorCopy(null);
frontend/src/components/dashboard/DashboardPageClient.tsx-225-      return;
frontend/src/components/dashboard/DashboardPageClient.tsx-226-    }
frontend/src/components/dashboard/DashboardPageClient.tsx-227-    if (file.size > maxUploadBytes) {
frontend/src/components/dashboard/DashboardPageClient.tsx-228-      const body = t('dashboard.fileSizeLimit', { size: maxUploadMb });
frontend/src/components/dashboard/DashboardPageClient.tsx-229-      setProgressText(body);
frontend/src/components/dashboard/DashboardPageClient.tsx-230-      setUploadErrorCopy({
frontend/src/components/dashboard/DashboardPageClient.tsx-231-        title: tOr('errors.FILE_TOO_LARGE.title', 'File too large'),
frontend/src/components/dashboard/DashboardPageClient.tsx-232-        body,
frontend/src/components/dashboard/DashboardPageClient.tsx:233:        cta: {
frontend/src/components/dashboard/DashboardPageClient.tsx:234:          label: tOr('errors.cta.upgrade', 'Upgrade'),
frontend/src/components/dashboard/DashboardPageClient.tsx-235-          href: billingHref({ plan: uploadUpgradePlan, source: 'limit', reason: 'file_size' }),
frontend/src/components/dashboard/DashboardPageClient.tsx-236-        },
frontend/src/components/dashboard/DashboardPageClient.tsx-237-        severity: 'warning',
frontend/src/components/dashboard/DashboardPageClient.tsx-238-      });
frontend/src/components/dashboard/DashboardPageClient.tsx-239-      trackEvent('limit_hit', { source: 'dashboard_upload_precheck', reason: 'file_size', plan: userPlan });
frontend/src/components/dashboard/DashboardPageClient.tsx-240-      return;
frontend/src/components/dashboard/DashboardPageClient.tsx-241-    }
frontend/src/components/dashboard/DashboardPageClient.tsx-242-    setUploading(true);
frontend/src/components/dashboard/DashboardPageClient.tsx-243-    setProgressText(t('upload.uploading'));
frontend/src/components/dashboard/DashboardPageClient.tsx-244-    setUploadErrorCopy(null);
frontend/src/components/dashboard/DashboardPageClient.tsx-245-    setDocumentStatus('uploading');
frontend/src/components/dashboard/DashboardPageClient.tsx-246-    try {
frontend/src/components/dashboard/DashboardPageClient.tsx-247-      const res = await uploadDocument(file);
frontend/src/components/dashboard/DashboardPageClient.tsx-248-      const docId = res.document_id;
frontend/src/components/dashboard/DashboardPageClient.tsx-249-      trackEvent('document_upload_created', { source: 'dashboard_upload', plan: userPlan });
frontend/src/components/dashboard/DashboardPageClient.tsx-250-      setDocument(docId);
frontend/src/components/dashboard/DashboardPageClient.tsx-251-      if (!isLoggedIn) {
frontend/src/components/dashboard/DashboardPageClient.tsx:252:        const docs: StoredDoc[] = JSON.parse(localStorage.getItem('doctalk_docs') || '[]');
frontend/src/components/dashboard/DashboardPageClient.tsx-253-        const entry: StoredDoc = { document_id: docId, filename: res.filename, status: res.status, createdAt: Date.now() };
frontend/src/components/dashboard/DashboardPageClient.tsx:254:        localStorage.setItem('doctalk_docs', JSON.stringify([entry, ...docs.filter((d) => d.document_id !== docId)]));
frontend/src/components/dashboard/DashboardPageClient.tsx-255-        setMyDocs([entry, ...docs.filter((d) => d.document_id !== docId)].sort((a, b) => b.createdAt - a.createdAt));
frontend/src/components/dashboard/DashboardPageClient.tsx-256-      }
frontend/src/components/dashboard/DashboardPageClient.tsx-257-      getMyDocuments().then(setServerDocs).catch(console.error);
frontend/src/components/dashboard/DashboardPageClient.tsx-258-
frontend/src/components/dashboard/DashboardPageClient.tsx-259-      setProgressText(t('upload.parsing'));
frontend/src/components/dashboard/DashboardPageClient.tsx-260-      // Hold the polling timer in a ref so unmount-mid-parse can clear it
frontend/src/components/dashboard/DashboardPageClient.tsx-261-      // (see useEffect cleanup at the top of the component). The local
frontend/src/components/dashboard/DashboardPageClient.tsx-262-      // `const timer` form leaked when the user navigated away mid-upload.
frontend/src/components/dashboard/DashboardPageClient.tsx-263-      if (pollTimerRef.current) {
frontend/src/components/dashboard/DashboardPageClient.tsx-264-        clearInterval(pollTimerRef.current);
frontend/src/components/dashboard/DashboardPageClient.tsx-265-      }
frontend/src/components/dashboard/DashboardPageClient.tsx-266-      const clearPollTimer = () => {
--
frontend/src/components/dashboard/DashboardPageClient.tsx-289-          if (info.status === 'error') {
frontend/src/components/dashboard/DashboardPageClient.tsx-290-            clearPollTimer();
frontend/src/components/dashboard/DashboardPageClient.tsx-291-            setProgressText(t('upload.error'));
frontend/src/components/dashboard/DashboardPageClient.tsx-292-            setUploading(false);
frontend/src/components/dashboard/DashboardPageClient.tsx-293-          }
frontend/src/components/dashboard/DashboardPageClient.tsx-294-        } catch (e) {
frontend/src/components/dashboard/DashboardPageClient.tsx-295-          clearPollTimer();
frontend/src/components/dashboard/DashboardPageClient.tsx-296-          setProgressText(t('upload.error'));
frontend/src/components/dashboard/DashboardPageClient.tsx-297-          setUploading(false);
frontend/src/components/dashboard/DashboardPageClient.tsx-298-        }
frontend/src/components/dashboard/DashboardPageClient.tsx-299-      }, 2000);
frontend/src/components/dashboard/DashboardPageClient.tsx-300-    } catch (e: unknown) {
frontend/src/components/dashboard/DashboardPageClient.tsx:301:      const copy = errorCopy(e, t, tOr);
frontend/src/components/dashboard/DashboardPageClient.tsx-302-      setProgressText(copy.body);
frontend/src/components/dashboard/DashboardPageClient.tsx:303:      setUploadErrorCopy(copy.cta ? copy : null);
frontend/src/components/dashboard/DashboardPageClient.tsx:304:      if (copy.cta) {
frontend/src/components/dashboard/DashboardPageClient.tsx:305:        trackEvent('limit_hit', { source: 'dashboard_upload', reason: copy.cta.href.includes('file_size') ? 'file_size' : 'upload_limit', plan: userPlan });
frontend/src/components/dashboard/DashboardPageClient.tsx-306-      }
frontend/src/components/dashboard/DashboardPageClient.tsx-307-      setUploading(false);
frontend/src/components/dashboard/DashboardPageClient.tsx-308-    }
frontend/src/components/dashboard/DashboardPageClient.tsx-309-  }, [isLoggedIn, maxUploadBytes, maxUploadMb, router, setDocument, setDocumentStatus, t, tOr, uploadUpgradePlan, userPlan]);
frontend/src/components/dashboard/DashboardPageClient.tsx-310-
frontend/src/components/dashboard/DashboardPageClient.tsx-311-  const onDrop = (e: React.DragEvent) => {
frontend/src/components/dashboard/DashboardPageClient.tsx-312-    e.preventDefault();
frontend/src/components/dashboard/DashboardPageClient.tsx-313-    setDragging(false);
frontend/src/components/dashboard/DashboardPageClient.tsx-314-    const file = e.dataTransfer.files?.[0];
frontend/src/components/dashboard/DashboardPageClient.tsx-315-    if (file) onFiles(file);
frontend/src/components/dashboard/DashboardPageClient.tsx-316-  };
frontend/src/components/dashboard/DashboardPageClient.tsx-317-
--
frontend/src/components/dashboard/DashboardPageClient.tsx-332-    setUrlLoading(true);
frontend/src/components/dashboard/DashboardPageClient.tsx-333-    setUrlError('');
frontend/src/components/dashboard/DashboardPageClient.tsx-334-    setUrlErrorCopy(null);
frontend/src/components/dashboard/DashboardPageClient.tsx-335-    try {
frontend/src/components/dashboard/DashboardPageClient.tsx-336-      const res = await ingestUrl(url);
frontend/src/components/dashboard/DashboardPageClient.tsx-337-      const docId = res.document_id;
frontend/src/components/dashboard/DashboardPageClient.tsx-338-      trackEvent('url_ingest_created', { source: 'dashboard_url', plan: userPlan });
frontend/src/components/dashboard/DashboardPageClient.tsx-339-      setDocument(docId);
frontend/src/components/dashboard/DashboardPageClient.tsx-340-      setUrlInput('');
frontend/src/components/dashboard/DashboardPageClient.tsx-341-      getMyDocuments().then(setServerDocs).catch(console.error);
frontend/src/components/dashboard/DashboardPageClient.tsx-342-      router.push(`/d/${docId}`);
frontend/src/components/dashboard/DashboardPageClient.tsx-343-    } catch (e: unknown) {
frontend/src/components/dashboard/DashboardPageClient.tsx:344:      const copy = errorCopy(e, t, tOr);
frontend/src/components/dashboard/DashboardPageClient.tsx-345-      setUrlError(copy.body);
frontend/src/components/dashboard/DashboardPageClient.tsx:346:      setUrlErrorCopy(copy.cta ? copy : null);
frontend/src/components/dashboard/DashboardPageClient.tsx:347:      if (copy.cta) {
frontend/src/components/dashboard/DashboardPageClient.tsx:348:        trackEvent('limit_hit', { source: 'dashboard_url', reason: copy.cta.href.includes('file_size') ? 'file_size' : 'url_limit', plan: userPlan });
frontend/src/components/dashboard/DashboardPageClient.tsx-349-      }
frontend/src/components/dashboard/DashboardPageClient.tsx-350-    } finally {
frontend/src/components/dashboard/DashboardPageClient.tsx-351-      setUrlLoading(false);
frontend/src/components/dashboard/DashboardPageClient.tsx-352-    }
frontend/src/components/dashboard/DashboardPageClient.tsx-353-  }, [urlInput, router, setDocument, t, tOr, userPlan]);
frontend/src/components/dashboard/DashboardPageClient.tsx-354-
frontend/src/components/dashboard/DashboardPageClient.tsx-355-  const confirmDeleteDocument = useCallback(async (documentId: string) => {
frontend/src/components/dashboard/DashboardPageClient.tsx-356-    setDeletingId(documentId);
frontend/src/components/dashboard/DashboardPageClient.tsx-357-    setDeleteErrorId((prev) => (prev === documentId ? null : prev));
frontend/src/components/dashboard/DashboardPageClient.tsx-358-    try {
frontend/src/components/dashboard/DashboardPageClient.tsx-359-      await deleteDocument(documentId);
frontend/src/components/dashboard/DashboardPageClient.tsx-360-      // Only mutate UI after the backend acknowledges the delete — otherwise
frontend/src/components/dashboard/DashboardPageClient.tsx-361-      // a network or 5xx failure would silently desync UI from server state.
frontend/src/components/dashboard/DashboardPageClient.tsx-362-      if (!isLoggedIn) {
frontend/src/components/dashboard/DashboardPageClient.tsx:363:        const docs: StoredDoc[] = JSON.parse(localStorage.getItem('doctalk_docs') || '[]');
frontend/src/components/dashboard/DashboardPageClient.tsx-364-        const next = docs.filter((x) => x.document_id !== documentId);
frontend/src/components/dashboard/DashboardPageClient.tsx:365:        localStorage.setItem('doctalk_docs', JSON.stringify(next));
frontend/src/components/dashboard/DashboardPageClient.tsx-366-        setMyDocs(next.sort((a, b) => b.createdAt - a.createdAt));
frontend/src/components/dashboard/DashboardPageClient.tsx-367-      }
frontend/src/components/dashboard/DashboardPageClient.tsx-368-      setServerDocs((prev) => prev.filter((s) => s.id !== documentId));
frontend/src/components/dashboard/DashboardPageClient.tsx-369-      setConfirmDeleteId((prev) => (prev === documentId ? null : prev));
frontend/src/components/dashboard/DashboardPageClient.tsx-370-    } catch (e) {
frontend/src/components/dashboard/DashboardPageClient.tsx-371-      console.error('Failed to delete document:', e);
frontend/src/components/dashboard/DashboardPageClient.tsx-372-      // Surface the failure so users know to retry rather than think it worked.
frontend/src/components/dashboard/DashboardPageClient.tsx-373-      setDeleteErrorId(documentId);
frontend/src/components/dashboard/DashboardPageClient.tsx-374-    } finally {
frontend/src/components/dashboard/DashboardPageClient.tsx-375-      setDeletingId(null);
frontend/src/components/dashboard/DashboardPageClient.tsx-376-    }
frontend/src/components/dashboard/DashboardPageClient.tsx-377-  }, [isLoggedIn]);
--
frontend/src/components/dashboard/DashboardPageClient.tsx-406-                </div>
frontend/src/components/dashboard/DashboardPageClient.tsx-407-                <div className="flex shrink-0 items-center gap-2 sm:self-start">
frontend/src/components/dashboard/DashboardPageClient.tsx-408-	                  <Link
frontend/src/components/dashboard/DashboardPageClient.tsx-409-	                    href={billingHref({ plan: 'plus', source: 'dashboard_upgrade_reminder', reason: 'sustained_free_usage' })}
frontend/src/components/dashboard/DashboardPageClient.tsx-410-	                    onClick={() => trackEvent('upgrade_click', {
frontend/src/components/dashboard/DashboardPageClient.tsx-411-	                      plan: 'plus',
frontend/src/components/dashboard/DashboardPageClient.tsx-412-	                      period: 'monthly',
frontend/src/components/dashboard/DashboardPageClient.tsx-413-	                      source: 'dashboard_upgrade_reminder',
frontend/src/components/dashboard/DashboardPageClient.tsx-414-	                      reason: 'sustained_free_usage',
frontend/src/components/dashboard/DashboardPageClient.tsx-415-	                    })}
frontend/src/components/dashboard/DashboardPageClient.tsx-416-                    className="dt-stitch-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
frontend/src/components/dashboard/DashboardPageClient.tsx-417-                  >
frontend/src/components/dashboard/DashboardPageClient.tsx:418:                    {tOr('dashboard.upgradeNudge.cta', 'Upgrade')}
frontend/src/components/dashboard/DashboardPageClient.tsx-419-                    <ArrowRight aria-hidden="true" size={15} />
frontend/src/components/dashboard/DashboardPageClient.tsx-420-                  </Link>
frontend/src/components/dashboard/DashboardPageClient.tsx-421-                  <button
frontend/src/components/dashboard/DashboardPageClient.tsx-422-                    type="button"
frontend/src/components/dashboard/DashboardPageClient.tsx-423-                    onClick={dismissUpgradeNudge}
frontend/src/components/dashboard/DashboardPageClient.tsx-424-                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--workbench-muted)] transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
frontend/src/components/dashboard/DashboardPageClient.tsx-425-                    aria-label={tOr('dashboard.upgradeNudge.dismiss', 'Dismiss upgrade prompt')}
frontend/src/components/dashboard/DashboardPageClient.tsx-426-                  >
frontend/src/components/dashboard/DashboardPageClient.tsx-427-                    <X aria-hidden="true" size={16} />
frontend/src/components/dashboard/DashboardPageClient.tsx-428-                  </button>
frontend/src/components/dashboard/DashboardPageClient.tsx-429-                </div>
frontend/src/components/dashboard/DashboardPageClient.tsx-430-              </div>
--
frontend/src/components/dashboard/DashboardPageClient.tsx-447-            <p className="text-[var(--workbench-muted)] text-sm mt-1">{t('upload.or')}</p>
frontend/src/components/dashboard/DashboardPageClient.tsx-448-            <button
frontend/src/components/dashboard/DashboardPageClient.tsx-449-              type="button"
frontend/src/components/dashboard/DashboardPageClient.tsx-450-              onClick={() => inputRef.current?.click()}
frontend/src/components/dashboard/DashboardPageClient.tsx-451-              className="dt-stitch-primary mt-4 rounded-full px-6 py-2.5 font-medium transition-[box-shadow,color,background-color] disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
frontend/src/components/dashboard/DashboardPageClient.tsx-452-              disabled={uploading}
frontend/src/components/dashboard/DashboardPageClient.tsx-453-            >
frontend/src/components/dashboard/DashboardPageClient.tsx-454-              {t('upload.chooseFile')}
frontend/src/components/dashboard/DashboardPageClient.tsx-455-            </button>
frontend/src/components/dashboard/DashboardPageClient.tsx-456-            {progressText && (
frontend/src/components/dashboard/DashboardPageClient.tsx-457-              <div aria-live="polite" className={`mt-4 text-sm ${uploading ? 'text-zinc-500' : 'text-red-600 dark:text-red-400'}`}>
frontend/src/components/dashboard/DashboardPageClient.tsx-458-                <p>{progressText}</p>
frontend/src/components/dashboard/DashboardPageClient.tsx:459:                {uploadErrorCopy?.cta && (
frontend/src/components/dashboard/DashboardPageClient.tsx-460-                  <Link
frontend/src/components/dashboard/DashboardPageClient.tsx:461:                    href={uploadErrorCopy.cta.href}
frontend/src/components/dashboard/DashboardPageClient.tsx-462-                    onClick={() => trackEvent('upgrade_click', { source: 'upload_error', reason: 'upload_limit' })}
frontend/src/components/dashboard/DashboardPageClient.tsx-463-                    className="mt-3 inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
frontend/src/components/dashboard/DashboardPageClient.tsx-464-                  >
frontend/src/components/dashboard/DashboardPageClient.tsx:465:                    {uploadErrorCopy.cta.label}
frontend/src/components/dashboard/DashboardPageClient.tsx-466-                  </Link>
frontend/src/components/dashboard/DashboardPageClient.tsx-467-                )}
frontend/src/components/dashboard/DashboardPageClient.tsx-468-              </div>
frontend/src/components/dashboard/DashboardPageClient.tsx-469-            )}
frontend/src/components/dashboard/DashboardPageClient.tsx-470-          </div>
frontend/src/components/dashboard/DashboardPageClient.tsx-471-
frontend/src/components/dashboard/DashboardPageClient.tsx-472-          {/* URL Import */}
frontend/src/components/dashboard/DashboardPageClient.tsx-473-          <div className="mt-4 flex items-center gap-2 max-w-lg mx-auto">
frontend/src/components/dashboard/DashboardPageClient.tsx-474-            <div className="flex-1 relative">
frontend/src/components/dashboard/DashboardPageClient.tsx-475-              <Link2 aria-hidden="true" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
frontend/src/components/dashboard/DashboardPageClient.tsx-476-              <input
frontend/src/components/dashboard/DashboardPageClient.tsx-477-                type="url"
--
frontend/src/components/dashboard/DashboardPageClient.tsx-486-            </div>
frontend/src/components/dashboard/DashboardPageClient.tsx-487-            <button
frontend/src/components/dashboard/DashboardPageClient.tsx-488-              onClick={onUrlSubmit}
frontend/src/components/dashboard/DashboardPageClient.tsx-489-              disabled={urlLoading || !urlInput.trim()}
frontend/src/components/dashboard/DashboardPageClient.tsx-490-              className="dt-stitch-primary rounded-full px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
frontend/src/components/dashboard/DashboardPageClient.tsx-491-            >
frontend/src/components/dashboard/DashboardPageClient.tsx-492-              {urlLoading ? '...' : t('upload.ingestUrl')}
frontend/src/components/dashboard/DashboardPageClient.tsx-493-            </button>
frontend/src/components/dashboard/DashboardPageClient.tsx-494-          </div>
frontend/src/components/dashboard/DashboardPageClient.tsx-495-          {urlError && (
frontend/src/components/dashboard/DashboardPageClient.tsx-496-            <div role="alert" className="mt-2 text-center text-sm text-red-600 dark:text-red-400">
frontend/src/components/dashboard/DashboardPageClient.tsx-497-              <p>{urlError}</p>
frontend/src/components/dashboard/DashboardPageClient.tsx:498:              {urlErrorCopy?.cta && (
frontend/src/components/dashboard/DashboardPageClient.tsx-499-                <Link
frontend/src/components/dashboard/DashboardPageClient.tsx:500:                  href={urlErrorCopy.cta.href}
frontend/src/components/dashboard/DashboardPageClient.tsx-501-                  onClick={() => trackEvent('upgrade_click', { source: 'url_error', reason: 'url_limit' })}
frontend/src/components/dashboard/DashboardPageClient.tsx-502-                  className="mt-3 inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
frontend/src/components/dashboard/DashboardPageClient.tsx-503-                >
frontend/src/components/dashboard/DashboardPageClient.tsx:504:                  {urlErrorCopy.cta.label}
frontend/src/components/dashboard/DashboardPageClient.tsx-505-                </Link>
frontend/src/components/dashboard/DashboardPageClient.tsx-506-              )}
frontend/src/components/dashboard/DashboardPageClient.tsx-507-            </div>
frontend/src/components/dashboard/DashboardPageClient.tsx-508-          )}
frontend/src/components/dashboard/DashboardPageClient.tsx-509-
frontend/src/components/dashboard/DashboardPageClient.tsx-510-          <div className="mt-3 text-center">
frontend/src/components/dashboard/DashboardPageClient.tsx-511-            <Link href="/demo" className="text-[var(--workbench-muted)] hover:text-zinc-900 dark:hover:text-white text-sm transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm">
frontend/src/components/dashboard/DashboardPageClient.tsx:512:              {t('home.cta.tryDemo')}
frontend/src/components/dashboard/DashboardPageClient.tsx-513-            </Link>
frontend/src/components/dashboard/DashboardPageClient.tsx-514-          </div>
frontend/src/components/dashboard/DashboardPageClient.tsx-515-        </div>
frontend/src/components/dashboard/DashboardPageClient.tsx-516-
frontend/src/components/dashboard/DashboardPageClient.tsx-517-        <div className="max-w-4xl w-full">
frontend/src/components/dashboard/DashboardPageClient.tsx-518-          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
frontend/src/components/dashboard/DashboardPageClient.tsx-519-            <h2 className="text-3xl font-semibold tracking-normal text-[var(--workbench-ink)]">{t('doc.myDocuments')}</h2>
frontend/src/components/dashboard/DashboardPageClient.tsx-520-            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
frontend/src/components/dashboard/DashboardPageClient.tsx-521-              <Link
frontend/src/components/dashboard/DashboardPageClient.tsx-522-                href="/document-diff"
frontend/src/components/dashboard/DashboardPageClient.tsx-523-                className="dt-workbench-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
frontend/src/components/dashboard/DashboardPageClient.tsx-524-              >
--
frontend/src/components/dashboard/DashboardPageClient.tsx-549-                    <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--workbench-muted)]">
frontend/src/components/dashboard/DashboardPageClient.tsx-550-                      {tOr(
frontend/src/components/dashboard/DashboardPageClient.tsx-551-                        'dashboard.workspaceNudge.body',
frontend/src/components/dashboard/DashboardPageClient.tsx-552-                        'You have ready documents. Group them to ask cross-document questions while keeping citations tied to the exact source file.'
frontend/src/components/dashboard/DashboardPageClient.tsx-553-                      )}
frontend/src/components/dashboard/DashboardPageClient.tsx-554-                    </p>
frontend/src/components/dashboard/DashboardPageClient.tsx-555-                  </div>
frontend/src/components/dashboard/DashboardPageClient.tsx-556-                </div>
frontend/src/components/dashboard/DashboardPageClient.tsx-557-                <Link
frontend/src/components/dashboard/DashboardPageClient.tsx-558-                  href="/collections?action=create&select=ready"
frontend/src/components/dashboard/DashboardPageClient.tsx-559-                  className="dt-stitch-primary inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
frontend/src/components/dashboard/DashboardPageClient.tsx-560-                >
frontend/src/components/dashboard/DashboardPageClient.tsx:561:                  {tOr('dashboard.workspaceNudge.cta', 'Create workspace')}
frontend/src/components/dashboard/DashboardPageClient.tsx-562-                  <ArrowRight aria-hidden="true" size={15} />
frontend/src/components/dashboard/DashboardPageClient.tsx-563-                </Link>
frontend/src/components/dashboard/DashboardPageClient.tsx-564-              </div>
frontend/src/components/dashboard/DashboardPageClient.tsx-565-            </section>
frontend/src/components/dashboard/DashboardPageClient.tsx-566-          )}
frontend/src/components/dashboard/DashboardPageClient.tsx-567-
frontend/src/components/dashboard/DashboardPageClient.tsx-568-          {allDocs.length === 0 ? (
frontend/src/components/dashboard/DashboardPageClient.tsx-569-            <div className="dt-stitch-card flex flex-col items-center justify-center rounded-2xl border-dashed px-6 py-16 text-center">
frontend/src/components/dashboard/DashboardPageClient.tsx-570-              <FileUp aria-hidden="true" size={52} className="text-[var(--workbench-muted)]" />
frontend/src/components/dashboard/DashboardPageClient.tsx-571-              <h3 className="mt-5 text-xl font-semibold text-[var(--workbench-ink)]">{t('dashboard.emptyTitle')}</h3>
frontend/src/components/dashboard/DashboardPageClient.tsx-572-              <p className="mt-2 max-w-md text-sm text-[var(--workbench-muted)]">{t('dashboard.emptySubtitle')}</p>
frontend/src/components/dashboard/DashboardPageClient.tsx-573-              {/* Dual CTA per Codex r1 + 30-agent onboarding research:

exec
/bin/zsh -lc "rg -l \"errorCopy\\(\" frontend/src --glob '*.{ts,tsx}' | sort" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
frontend/src/app/collections/[collectionId]/page.tsx
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx
frontend/src/components/Chat/ChatArtifactCard.tsx
frontend/src/components/Chat/ChatPanel.tsx
frontend/src/components/Collections/CreateCollectionModal.tsx
frontend/src/components/CustomInstructionsModal.tsx
frontend/src/components/Quotes/QuoteFinderPanel.tsx
frontend/src/components/SessionDropdown.tsx
frontend/src/components/dashboard/DashboardPageClient.tsx
frontend/src/lib/errorCopy.ts
frontend/src/lib/useChatStream.ts
frontend/src/lib/useDocumentLoader.ts

exec
/bin/zsh -lc 'rg -n "''^    async def |''^async def _sync_session_domain_mode|''^class ChatService" backend/app/services/chat_service.py | sed -n '"'1,220p'" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "nl -ba backend/app/services/chat_service.py | sed -n '2221,2700p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
956:async def _sync_session_domain_mode(
1291:class ChatService:
1292:    async def _persist_user_message_and_title(
1309:    async def _tool_action_stream(
1377:    async def _run_verified_quote_search(
1522:    async def chat_stream(
2567:    async def continue_stream(

 succeeded in 0ms:
  2221	                            elif ev["event"] == "citation":
  2222	                                citations.append(ev["data"])
  2223	                            yield ev
  2224	
  2225	                    # Track finish_reason from choices
  2226	                    if chunk.choices and chunk.choices[0].finish_reason:
  2227	                        finish_reason = chunk.choices[0].finish_reason
  2228	
  2229	                    # Extract usage if present (last chunk)
  2230	                    if hasattr(chunk, "usage") and chunk.usage:
  2231	                        prompt_tokens = getattr(chunk.usage, "prompt_tokens", None)
  2232	                        output_tokens = getattr(chunk.usage, "completion_tokens", None)
  2233	
  2234	                    # Ping every 15 seconds
  2235	                    now = time.monotonic()
  2236	                    if now - last_ping >= 15.0:
  2237	                        yield sse("ping", {})
  2238	                        last_ping = now
  2239	
  2240	                # Flush at stream end
  2241	                for ev in fsm.flush():
  2242	                    if ev["event"] == "token":
  2243	                        assistant_text_parts.append(ev["data"]["text"])
  2244	                    yield ev
  2245	
  2246	                if not citations:
  2247	                    assistant_snapshot = "".join(assistant_text_parts)
  2248	                    fallback_citations = _fallback_citations(assistant_snapshot, chunk_map)
  2249	                    if fallback_citations:
  2250	                        logger.warning(
  2251	                            "LLM emitted no citation markers; generated %d fallback citations model=%s",
  2252	                            len(fallback_citations),
  2253	                            effective_model,
  2254	                        )
  2255	                        for citation in fallback_citations:
  2256	                            citations.append(citation)
  2257	                            yield sse("citation", citation)
  2258	
  2259	                # Warn if response was truncated due to token limit
  2260	                if finish_reason == "length":
  2261	                    logger.warning(
  2262	                        "LLM response truncated (finish_reason=length) model=%s max_tokens=%d output_tokens=%s",
  2263	                        effective_model, profile.max_tokens, output_tokens,
  2264	                    )
  2265	                    yield sse("truncated", {"reason": "max_tokens"})
  2266	
  2267	                total_time = time.time() - llm_start
  2268	                final_token_count = int(output_tokens) if output_tokens is not None else token_count
  2269	                logger.info(
  2270	                    "LLM total_latency=%.2fs tokens=%d model=%s",
  2271	                    total_time,
  2272	                    final_token_count,
  2273	                    effective_model,
  2274	                )
  2275	
  2276	            except Exception as e:
  2277	                assistant_snapshot = "".join(assistant_text_parts)
  2278	                has_partial_answer = bool(assistant_snapshot.strip())
  2279	                if (
  2280	                    user is not None
  2281	                    and pre_debited > 0
  2282	                    and predebit_ledger_id is not None
  2283	                    and not has_partial_answer
  2284	                ):
  2285	                    try:
  2286	                        await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
  2287	                        settled = True
  2288	                    except Exception:
  2289	                        logger.exception(
  2290	                            "Failed to refund pre-debited credits after LLM error for user %s",
  2291	                            user.id,
  2292	                        )
  2293	                yield _safe_sse("error", "LLM_ERROR", e, session_id=str(session_id))
  2294	                return
  2295	
  2296	            # 9) Save assistant draft before verification/repair (A2)
  2297	            assistant_text = "".join(assistant_text_parts)
  2298	            try:
  2299	                asst_msg = Message(
  2300	                    session_id=session_id,
  2301	                    role="assistant",
  2302	                    content=assistant_text,
  2303	                    citations=citations or None,
  2304	                    prompt_tokens=int(prompt_tokens) if prompt_tokens is not None else None,
  2305	                    output_tokens=int(output_tokens) if output_tokens is not None else None,
  2306	                )
  2307	                db.add(asst_msg)
  2308	                await db.commit()
  2309	                persisted = True
  2310	            except Exception:
  2311	                await db.rollback()
  2312	                has_partial_answer = bool(assistant_text.strip())
  2313	                if (
  2314	                    user is not None
  2315	                    and pre_debited > 0
  2316	                    and predebit_ledger_id is not None
  2317	                    and not has_partial_answer
  2318	                ):
  2319	                    try:
  2320	                        await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
  2321	                        settled = True
  2322	                    except Exception:
  2323	                        logger.exception(
  2324	                            "Failed to refund pre-debited credits after PERSIST_FAILED for user %s",
  2325	                            user.id,
  2326	                        )
  2327	                yield sse("error", {"code": "PERSIST_FAILED", "message": "Failed to save response"})
  2328	                return
  2329	
  2330	            verification_report = claim_verifier_service.verify(
  2331	                assistant_text,
  2332	                citations,
  2333	                set(chunk_map.keys()),
  2334	                retrieved_count=len(chunk_map),
  2335	            )
  2336	            verification_payload = verification_report.to_payload()
  2337	            if verification_report.status != "pass" and finish_reason != "length":
  2338	                yield sse("tool_status", {"message": "Checking citation support..."})
  2339	                repair = await _try_repair_rag_answer(
  2340	                    client=client,
  2341	                    model=effective_model,
  2342	                    profile=profile,
  2343	                    user_message=user_message,
  2344	                    assistant_text=assistant_text,
  2345	                    citations=citations,
  2346	                    chunk_map=chunk_map,
  2347	                    numbered_chunks=numbered_chunks,
  2348	                    verification=verification_payload,
  2349	                    locale=locale,
  2350	                )
  2351	                if repair is not None:
  2352	                    repair_metadata = repair.metadata
  2353	                    if repair.prompt_tokens:
  2354	                        prompt_tokens = int(prompt_tokens or 0) + repair.prompt_tokens
  2355	                    if repair.output_tokens:
  2356	                        output_tokens = int(output_tokens or 0) + repair.output_tokens
  2357	                    if repair.applied:
  2358	                        assistant_text = repair.text
  2359	                        citations = repair.citations
  2360	                        verification_payload = repair.verification
  2361	                        verification_report = claim_verifier_service.verify(
  2362	                            assistant_text,
  2363	                            citations,
  2364	                            set(chunk_map.keys()),
  2365	                            retrieved_count=len(chunk_map),
  2366	                        )
  2367	                        verification_payload = verification_report.to_payload()
  2368	                        yield sse(
  2369	                            "answer_repaired",
  2370	                            {
  2371	                                "text": assistant_text,
  2372	                                "citations": citations,
  2373	                                "verification": verification_payload,
  2374	                            },
  2375	                        )
  2376	            if verification_report.status != "pass":
  2377	                logger.warning(
  2378	                    "RAG verification status=%s score=%.3f claims=%d citations=%d reasons=%s",
  2379	                    verification_report.status,
  2380	                    verification_report.score,
  2381	                    verification_report.claim_count,
  2382	                    verification_report.citation_count,
  2383	                    ",".join(verification_report.reasons),
  2384	                )
  2385	
  2386	            focus_pt = focus_ct = 0
  2387	            focus_model_used = ""
  2388	            focus_elapsed = time.time() - llm_start
  2389	            if user is not None and citations and focus_elapsed <= _FOCUS_ELAPSED_BUDGET_S:
  2390	                yield sse("tool_status", {"message": "Refining citations..."})
  2391	            focus_changed, focus_model_used, focus_pt, focus_ct = await _refine_citation_focus(
  2392	                answer=assistant_text,
  2393	                citations=citations,
  2394	                chunk_map=chunk_map,
  2395	                fallback_model=effective_model,
  2396	                user=user,
  2397	                elapsed_seconds=focus_elapsed,
  2398	            )
  2399	            if focus_changed:
  2400	                yield sse("citations_refined", {"citations": citations})
  2401	
  2402	            try:
  2403	                if asst_msg is None:
  2404	                    raise RuntimeError("assistant message missing before verification update")
  2405	                asst_msg.content = assistant_text
  2406	                asst_msg.citations = citations or None
  2407	                asst_msg.prompt_tokens = int(prompt_tokens) if prompt_tokens is not None else None
  2408	                asst_msg.output_tokens = int(output_tokens) if output_tokens is not None else None
  2409	                await db.commit()
  2410	            except Exception:
  2411	                await db.rollback()
  2412	                yield sse("error", {"code": "PERSIST_FAILED", "message": "Failed to save response"})
  2413	                return
  2414	
  2415	            await _record_rag_verification_event(
  2416	                db,
  2417	                user=user,
  2418	                message_id=getattr(asst_msg, "id", None),
  2419	                verification=verification_payload,
  2420	                retrieval_strategy=retrieval_strategy,
  2421	                query_route=query_route,
  2422	                retrieved_count=len(chunk_map),
  2423	                repair_metadata=repair_metadata,
  2424	            )
  2425	
  2426	            # Credits: reconcile pre-debited estimate against actual cost
  2427	            if user is not None and pre_debited > 0 and predebit_ledger_id is not None:
  2428	                pt = int(prompt_tokens or 0)
  2429	                ct = int(output_tokens or 0)
  2430	                try:
  2431	                    answer_cost = credit_service.calculate_cost(pt, ct, effective_model, mode=effective_mode)
  2432	                    summary_usage_costs: list[tuple[str, int, int, int]] = []
  2433	                    for usage_model, (summary_prompt, summary_completion) in summary_usage.totals_by_model().items():
  2434	                        summary_mode = "quick" if usage_model == settings.MODE_MODELS.get("quick") else None
  2435	                        summary_cost = credit_service.calculate_cost(
  2436	                            summary_prompt,
  2437	                            summary_completion,
  2438	                            usage_model,
  2439	                            mode=summary_mode,
  2440	                        )
  2441	                        summary_usage_costs.append(
  2442	                            (usage_model, summary_prompt, summary_completion, summary_cost)
  2443	                        )
  2444	                    # Citation-focus Flash call: part of producing this answer,
  2445	                    # reconciled + recorded like summary usage.
  2446	                    focus_cost = 0
  2447	                    if (focus_pt or focus_ct) and focus_model_used:
  2448	                        focus_cost = credit_service.calculate_cost(
  2449	                            focus_pt, focus_ct, focus_model_used, mode="quick"
  2450	                        )
  2451	                    actual_cost = (
  2452	                        answer_cost
  2453	                        + sum(item[3] for item in summary_usage_costs)
  2454	                        + focus_cost
  2455	                    )
  2456	                    await credit_service.reconcile_credits(
  2457	                        db, user.id, predebit_ledger_id, pre_debited, actual_cost,
  2458	                    )
  2459	                    await credit_service.record_usage(
  2460	                        db,
  2461	                        user_id=user.id,
  2462	                        message_id=asst_msg.id,
  2463	                        model=effective_model,
  2464	                        prompt_tokens=pt,
  2465	                        completion_tokens=ct,
  2466	                        cost_credits=answer_cost,
  2467	                    )
  2468	                    for usage_model, summary_prompt, summary_completion, summary_cost in summary_usage_costs:
  2469	                        await credit_service.record_usage(
  2470	                            db,
  2471	                            user_id=user.id,
  2472	                            message_id=asst_msg.id,
  2473	                            model=usage_model,
  2474	                            prompt_tokens=summary_prompt,
  2475	                            completion_tokens=summary_completion,
  2476	                            cost_credits=summary_cost,
  2477	                        )
  2478	                    if focus_cost:
  2479	                        await credit_service.record_usage(
  2480	                            db,
  2481	                            user_id=user.id,
  2482	                            message_id=asst_msg.id,
  2483	                            model=focus_model_used,
  2484	                            prompt_tokens=focus_pt,
  2485	                            completion_tokens=focus_ct,
  2486	                            cost_credits=focus_cost,
  2487	                        )
  2488	                    await db.commit()
  2489	                    settled = True
  2490	                except Exception as e:
  2491	                    # Non-fatal accounting error
  2492	                    yield _safe_sse("warn", "ACCOUNTING_ERROR", e, session_id=str(session_id))
  2493	
  2494	            # 10) done
  2495	            can_continue = asst_msg.continuation_count < settings.MAX_CONTINUATIONS_PER_MESSAGE
  2496	            done_emitted = True
  2497	            yield sse("done", {
  2498	                "message_id": str(asst_msg.id),
  2499	                "citations_count": len(citations),
  2500	                "verification": verification_payload,
  2501	                "repair": repair_metadata,
  2502	                "can_continue": can_continue and finish_reason == "length",
  2503	                "continuation_count": asst_msg.continuation_count,
  2504	                # FIX3-B (Codex r3 #5, NOT ADDRESSED): set when the strict
  2505	                # quote trigger matched this message but a negation/
  2506	                # metalinguistic token was ALSO present, so verified quote
  2507	                # search was deliberately NOT auto-routed/billed (see
  2508	                # action_planner.deterministic_plan). Always present
  2509	                # (never conditionally omitted) so the frontend has a
  2510	                # stable field to check for offering a manual "Try Quote
  2511	                # Finder" chip — never used to auto-route or bill.
  2512	"quote_finder_hint": action_plan.quote_finder_hint,
  2513	                "quote_finder_topic": action_plan.quote_finder_hint_topic,
  2514	            })
  2515	        except asyncio.CancelledError:
  2516	            raise
  2517	        finally:
  2518	            assistant_snapshot = "".join(assistant_text_parts)
  2519	            has_partial_answer = bool(assistant_snapshot.strip())
  2520	            if not done_emitted and has_partial_answer and not persisted:
  2521	                try:
  2522	                    with anyio.CancelScope(shield=True):
  2523	                        await asyncio.wait_for(
  2524	                            _persist_partial_on_cancel(
  2525	                                session_id=session_id,
  2526	                                assistant_text=assistant_snapshot,
  2527	                                citations=citations,
  2528	                                prompt_tokens=prompt_tokens,
  2529	                                output_tokens=output_tokens,
  2530	                            ),
  2531	                            timeout=_CANCEL_IO_TIMEOUT_S,
  2532	                        )
  2533	                    persisted = True
  2534	                except Exception:
  2535	                    logger.exception(
  2536	                        "Failed to persist partial assistant response on cancel/error for session %s",
  2537	                        session_id,
  2538	                    )
  2539	            if (
  2540	                user is not None
  2541	                and pre_debited > 0
  2542	                and predebit_ledger_id is not None
  2543	                and not settled
  2544	            ):
  2545	                try:
  2546	                    with anyio.CancelScope(shield=True):
  2547	                        await asyncio.wait_for(
  2548	                            _settle_predebit_on_cancel(
  2549	                                user_id=user.id,
  2550	                                pre_debited=pre_debited,
  2551	                                predebit_ledger_id=predebit_ledger_id,
  2552	                                has_answer=has_partial_answer,
  2553	                                prompt_tokens=prompt_tokens,
  2554	                                output_tokens=output_tokens,
  2555	                                model=effective_model,
  2556	                                mode=effective_mode,
  2557	                            ),
  2558	                            timeout=_CANCEL_IO_TIMEOUT_S,
  2559	                        )
  2560	                    settled = True
  2561	                except Exception:
  2562	                    logger.exception(
  2563	                        "Failed to settle pre-debit on cancel/error for user %s",
  2564	                        user.id,
  2565	                    )
  2566	
  2567	    async def continue_stream(
  2568	        self,
  2569	        session_id: uuid.UUID,
  2570	        message_id: Optional[uuid.UUID],
  2571	        db: AsyncSession,
  2572	        user: Optional[User] = None,
  2573	        locale: Optional[str] = None,
  2574	        mode: Optional[str] = None,
  2575	    ) -> AsyncGenerator[Dict[str, Any], None]:
  2576	        """Continue a truncated assistant response, appending to the existing message."""
  2577	
  2578	        # 1) Load session
  2579	        row = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
  2580	        session_obj: Optional[ChatSession] = row.scalar_one_or_none()
  2581	        if not session_obj:
  2582	            yield sse("error", {"code": "SESSION_NOT_FOUND", "message": "Session not found"})
  2583	            return
  2584	
  2585	        document_id = session_obj.document_id
  2586	        collection_id = getattr(session_obj, "collection_id", None)
  2587	        is_collection_session = collection_id is not None and document_id is None
  2588	
  2589	        doc = await db.get(Document, document_id) if document_id else None
  2590	
  2591	        # For collection sessions, load document names
  2592	        collection_doc_names: dict[uuid.UUID, str] = {}
  2593	        collection_doc_types: dict[uuid.UUID, str] = {}
  2594	        collection_doc_pages: dict[uuid.UUID, int] = {}
  2595	        if is_collection_session:
  2596	            from app.models.tables import collection_documents as cd_table
  2597	            cd_rows = await db.execute(
  2598	                select(cd_table.c.document_id).where(cd_table.c.collection_id == collection_id)
  2599	            )
  2600	            collection_doc_ids = [r[0] for r in cd_rows.all()]
  2601	            if collection_doc_ids:
  2602	                doc_rows = await db.execute(
  2603	                    select(Document.id, Document.filename, Document.file_type, Document.page_count)
  2604	                    .where(Document.id.in_(collection_doc_ids))
  2605	                )
  2606	                for drow in doc_rows.all():
  2607	                    collection_doc_names[drow[0]] = drow[1]
  2608	                    collection_doc_types[drow[0]] = drow[2]
  2609	                    if drow[3]:
  2610	                        collection_doc_pages[drow[0]] = drow[3]
  2611	
  2612	        # 2) Load assistant message to continue
  2613	        if message_id:
  2614	            asst_msg = await db.get(Message, message_id)
  2615	        else:
  2616	            # Fall back to most recent assistant message in session
  2617	            result = await db.execute(
  2618	                select(Message)
  2619	                .where(Message.session_id == session_id, Message.role == "assistant")
  2620	                .order_by(Message.created_at.desc())
  2621	                .limit(1)
  2622	            )
  2623	            asst_msg = result.scalar_one_or_none()
  2624	
  2625	        if not asst_msg or asst_msg.role != "assistant":
  2626	            yield sse("error", {"code": "MESSAGE_NOT_FOUND", "message": "Assistant message not found"})
  2627	            return
  2628	
  2629	        if asst_msg.session_id != session_id:
  2630	            yield sse("error", {"code": "MESSAGE_NOT_FOUND", "message": "Message does not belong to this session"})
  2631	            return
  2632	
  2633	        # 3) Check continuation limit
  2634	        if asst_msg.continuation_count >= settings.MAX_CONTINUATIONS_PER_MESSAGE:
  2635	            yield sse("error", {"code": "CONTINUATION_LIMIT", "message": "Maximum continuations reached"})
  2636	            return
  2637	
  2638	        # 4) Resolve mode → model
  2639	        effective_mode = mode if mode in settings.MODE_MODELS else "balanced"
  2640	        effective_model = settings.MODE_MODELS[effective_mode]
  2641	
  2642	        if user is None and doc and doc.demo_slug:
  2643	            effective_model = settings.DEMO_LLM_MODEL
  2644	            effective_mode = "quick"
  2645	
  2646	        if effective_mode in settings.PREMIUM_MODES:
  2647	            user_plan = (user.plan or "free").lower() if user else "free"
  2648	            if user_plan == "free":
  2649	                yield sse(
  2650	                    "error",
  2651	                    {
  2652	                        "code": "MODE_NOT_ALLOWED",
  2653	                        "message": "Upgrade to Plus to use this mode",
  2654	                        "required_plan": "plus",
  2655	                    },
  2656	                )
  2657	                return
  2658	
  2659	        # 5) Pre-debit credits
  2660	        pre_debited = 0
  2661	        predebit_ledger_id = None
  2662	        if user is not None:
  2663	            estimated = credit_service.get_estimated_cost(effective_mode)
  2664	            predebit_ledger_id = await credit_service.debit_credits(
  2665	                db, user_id=user.id, cost=estimated,
  2666	                reason="chat", ref_type="mode", ref_id=effective_mode,
  2667	            )
  2668	            if predebit_ledger_id:
  2669	                pre_debited = estimated
  2670	                await db.commit()
  2671	            else:
  2672	                balance = await credit_service.get_user_credits(db, user.id)
  2673	                yield sse("error", {
  2674	                    "code": "INSUFFICIENT_CREDITS",
  2675	                    "message": "Insufficient credits",
  2676	                    "required": estimated,
  2677	                    "balance": balance,
  2678	                })
  2679	                return
  2680	
  2681	        settled = False
  2682	        try:
  2683	            # 6) Reconstruct chunk_map from original citations
  2684	            chunk_map: dict[int, _ChunkInfo] = {}
  2685	            original_citations = asst_msg.citations or []
  2686	            if original_citations:
  2687	                chunk_ids_set: set[str] = set()
  2688	                ref_to_chunk_id: dict[int, str] = {}
  2689	                ref_to_citation: dict[int, dict] = {}
  2690	                table_ids_set: set[str] = set()
  2691	                for cit in original_citations:
  2692	                    if not isinstance(cit, dict):
  2693	                        continue
  2694	                    cid = cit.get("chunk_id")
  2695	                    ref = cit.get("ref_index")
  2696	                    if cid and ref is not None:
  2697	                        try:
  2698	                            normalized_ref = int(ref)
  2699	                            normalized_cid = str(uuid.UUID(str(cid)))
  2700	                        except Exception:

exec
/bin/zsh -lc "nl -ba backend/app/services/chat_service.py | sed -n '1480,1840p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
  1480	        )
  1481	        db.add(asst_msg)
  1482	
  1483	        # FIX2-B(a) (Codex r2 #4, NOT ADDRESSED): message-persist + reconcile
  1484	        # + usage-record are now ONE ATOMIC commit — no intermediate commit
  1485	        # between the message add and the billing settlement. This removes
  1486	        # the "message persisted but billing never reconciled" class of
  1487	        # ordinary-exception free-ride entirely: either the whole
  1488	        # transaction lands together, or none of it does. FIX3-A (Codex r3
  1489	        # #4): reconcile_credits() below durably stamps
  1490	        # credit_ledger.reconciled_at under a row lock — the caller's
  1491	        # exception handlers resolve any failure here (CancelledError or
  1492	        # ordinary) via that marker + an atomic conditional refund, never
  1493	        # an in-memory flag or existence check.
  1494	        actual_cost = credit_service.calculate_cost(
  1495	            progress.prompt_tokens, progress.completion_tokens, progress.model, mode="balanced",
  1496	        )
  1497	        await credit_service.reconcile_credits(
  1498	            db, user.id, predebit_ledger_id, pre_debited, actual_cost,
  1499	        )
  1500	        await credit_service.record_usage(
  1501	            db,
  1502	            user_id=user.id,
  1503	            message_id=message_id,
  1504	            model=progress.model,
  1505	            prompt_tokens=progress.prompt_tokens,
  1506	            completion_tokens=progress.completion_tokens,
  1507	            cost_credits=actual_cost,
  1508	        )
  1509	        await db.commit()
  1510	        # Only trustworthy once the atomic commit's await has ACTUALLY
  1511	        # returned — the ordinary-exception handler (FIX-4) uses this to
  1512	        # know whether a real answer was delivered.
  1513	        progress.message_id = message_id
  1514	
  1515	        return _VerifiedQuoteOutcome(
  1516	            message_id=message_id,
  1517	            assistant_text=assistant_text,
  1518	            citations=citations,
  1519	            artifact_payload=artifact_payload,
  1520	        )
  1521	
  1522	    async def chat_stream(
  1523	        self,
  1524	        session_id: uuid.UUID,
  1525	        user_message: str,
  1526	        db: AsyncSession,
  1527	        user: Optional[User] = None,
  1528	        locale: Optional[str] = None,
  1529	        mode: Optional[str] = None,
  1530	        domain_mode: Optional[str] = None,
  1531	    ) -> AsyncGenerator[Dict[str, Any], None]:
  1532	        """Main chat streaming generator producing SSE event dicts.
  1533	
  1534	        Steps per spec:
  1535	        1) Load session + document
  1536	        2) Save user message
  1537	        3) Load recent history (last MAX_CHAT_HISTORY_TURNS rounds)
  1538	        4) Retrieval top-5
  1539	        5) Build prompt with numbered chunks
  1540	        6) Stream Anthropic
  1541	        7) Parse with RefParserFSM and yield events; ping every 15s
  1542	        8) Save assistant message + citations
  1543	        9) Yield done
  1544	        """
  1545	
  1546	        # 1) Load session
  1547	        row = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
  1548	        session_obj: Optional[ChatSession] = row.scalar_one_or_none()
  1549	        if not session_obj:
  1550	            yield sse("error", {"code": "SESSION_NOT_FOUND", "message": "会话不存在"})
  1551	            return
  1552	
  1553	        document_id = session_obj.document_id
  1554	        collection_id = getattr(session_obj, "collection_id", None)
  1555	        is_collection_session = collection_id is not None and document_id is None
  1556	
  1557	        # Load document for custom instructions (single-doc sessions)
  1558	        doc = await db.get(Document, document_id) if document_id else None
  1559	
  1560	        # For collection sessions, load all document IDs and filenames
  1561	        collection_doc_ids: List[uuid.UUID] = []
  1562	        collection_doc_names: dict[uuid.UUID, str] = {}
  1563	        collection_doc_types: dict[uuid.UUID, str] = {}
  1564	        collection_doc_pages: dict[uuid.UUID, int] = {}
  1565	        if is_collection_session:
  1566	            cd_rows = await db.execute(
  1567	                select(collection_documents.c.document_id).where(
  1568	                    collection_documents.c.collection_id == collection_id
  1569	                )
  1570	            )
  1571	            collection_doc_ids = [row[0] for row in cd_rows.all()]
  1572	            if collection_doc_ids:
  1573	                doc_rows = await db.execute(
  1574	                    select(Document.id, Document.filename, Document.file_type, Document.page_count)
  1575	                    .where(Document.id.in_(collection_doc_ids))
  1576	                )
  1577	                for drow in doc_rows.all():
  1578	                    collection_doc_names[drow[0]] = drow[1]
  1579	                    collection_doc_types[drow[0]] = drow[2]
  1580	                    if drow[3]:
  1581	                        collection_doc_pages[drow[0]] = drow[3]
  1582	
  1583	        # Resolve mode → model (mode is the ONLY way to select a model)
  1584	        effective_mode = mode if mode in settings.MODE_MODELS else "balanced"
  1585	        effective_model = settings.MODE_MODELS[effective_mode]
  1586	
  1587	        # Force demo model for anonymous users on demo documents
  1588	        if user is None and doc and doc.demo_slug:
  1589	            effective_model = settings.DEMO_LLM_MODEL
  1590	            effective_mode = "quick"
  1591	
  1592	        # Premium mode gating: require Plus or Pro plan
  1593	        if effective_mode in settings.PREMIUM_MODES:
  1594	            user_plan = (user.plan or "free").lower() if user else "free"
  1595	            if user_plan == "free":
  1596	                yield sse(
  1597	                    "error",
  1598	                    {
  1599	                        "code": "MODE_NOT_ALLOWED",
  1600	                        "message": "Upgrade to Plus to use this mode",
  1601	                        "required_plan": "plus",
  1602	                    },
  1603	                )
  1604	                return
  1605	
  1606	        action_plan = await action_planner.plan(
  1607	            user_message,
  1608	            is_collection=is_collection_session,
  1609	            locale=locale,
  1610	        )
  1611	        if not action_plan.uses_rag_answer_path:
  1612	            # P1 hygiene follow-up (Codex, 2026-08-03): this successful
  1613	            # early-return path skipped the domain_mode session sync that
  1614	            # only ran inline in the main RAG path below — see
  1615	            # _sync_session_domain_mode's docstring.
  1616	            await _sync_session_domain_mode(db, session_obj, domain_mode)
  1617	            async for ev in self._tool_action_stream(
  1618	                session_id=session_id,
  1619	                user_message=user_message,
  1620	                db=db,
  1621	                user=user,
  1622	                locale=locale,
  1623	                domain_mode=domain_mode,
  1624	                document_id=document_id,
  1625	                collection_doc_ids=collection_doc_ids,
  1626	                action_plan=action_plan,
  1627	            ):
  1628	                yield ev
  1629	            return
  1630	
  1631	        query_route = query_router.route(
  1632	            user_message,
  1633	            is_collection=is_collection_session,
  1634	            domain_mode=domain_mode,
  1635	        )
  1636	
  1637	        # Pre-debit estimated credits BEFORE streaming (prevents TOCTOU + free rides)
  1638	        pre_debited = 0
  1639	        predebit_ledger_id = None
  1640	        strict_quote_routed = _is_strict_quote_routed(
  1641	            action_plan, user=user, document_id=document_id,
  1642	            is_collection_session=is_collection_session, doc=doc,
  1643	        )
  1644	        if user is not None:
  1645	            # FIX-3 (Codex r1 BLOCKER #3): a strict-routed message ALWAYS
  1646	            # runs the balanced-model quote engine regardless of the
  1647	            # user-selected chat mode — predebit must reflect that real
  1648	            # cost, not `effective_mode`'s (e.g. quick=5), or a low-balance
  1649	            # user could reserve too little and reconciliation would push
  1650	            # their account negative to cover the overrun.
  1651	            estimated = (
  1652	                credit_service.get_estimated_cost("balanced")
  1653	                if strict_quote_routed
  1654	                else credit_service.get_estimated_cost(effective_mode)
  1655	            )
  1656	            if query_route.primary_intent == QueryIntent.DOCUMENT_SUMMARY:
  1657	                estimated = max(estimated, estimated * 2)
  1658	            predebit_ledger_id = await credit_service.debit_credits(
  1659	                db, user_id=user.id, cost=estimated,
  1660	                reason="chat", ref_type="mode", ref_id="balanced" if strict_quote_routed else effective_mode,
  1661	            )
  1662	            if predebit_ledger_id:
  1663	                pre_debited = estimated
  1664	                await db.commit()
  1665	            else:
  1666	                balance = await credit_service.get_user_credits(db, user.id)
  1667	                yield sse(
  1668	                    "error",
  1669	                    {
  1670	                        "code": "INSUFFICIENT_CREDITS",
  1671	                        "message": "Insufficient credits to start chat",
  1672	                        "required": estimated,
  1673	                        "balance": balance,
  1674	                    },
  1675	                )
  1676	                return
  1677	
  1678	        settled = False
  1679	        setup_error_code = "CHAT_SETUP_ERROR"
  1680	        try:
  1681	            # 2) Save user message
  1682	            await self._persist_user_message_and_title(
  1683	                db=db,
  1684	                session_id=session_id,
  1685	                user_message=user_message,
  1686	            )
  1687	
  1688	            # Strict verbatim-quote chat routing (B5, plan §8.4.3). Gated
  1689	            # here (not in the planner, which has no auth/doc context):
  1690	            # AUTHED, non-demo, single-document sessions only. Anonymous,
  1691	            # demo, and collection sessions fall through to the normal RAG
  1692	            # path below UNCHANGED — the strict intent still matched, but
  1693	            # without a real document + billing user the verified pipeline
  1694	            # can't run, so this degrades to an ordinary cited answer rather
  1695	            # than erroring. SAME predicate (`strict_quote_routed`, computed
  1696	            # above) already decided the predebit amount — never re-derive
  1697	            # this condition separately (FIX-3: that's exactly how a
  1698	            # quick-mode predebit could drift from what actually runs).
  1699	            if strict_quote_routed:
  1700	                setup_error_code = "QUOTE_SEARCH_ERROR"
  1701	                quote_progress = _VerifiedQuoteProgress()
  1702	                try:
  1703	                    outcome = await self._run_verified_quote_search(
  1704	                        session_id=session_id,
  1705	                        db=db,
  1706	                        document=doc,
  1707	                        user=user,
  1708	                        topic=user_message,
  1709	                        locale=locale,
  1710	                        pre_debited=pre_debited,
  1711	                        predebit_ledger_id=predebit_ledger_id,
  1712	                        progress=quote_progress,
  1713	                    )
  1714	                except asyncio.CancelledError:
  1715	                    # FIX3-A(d) (Codex r3 #4, NOT ADDRESSED): `settled` is
  1716	                    # marked BEFORE the resolver even runs — regardless of
  1717	                    # whether it succeeds — so the outer generic handler
  1718	                    # (which now also checks `not settled`, see below) can
  1719	                    # NEVER also attempt its own blind settlement. That was
  1720	                    # the exact "special resolver errors out, outer handler
  1721	                    # falls back to blind settlement" gap Codex r3 found.
  1722	                    # The resolver itself is the durable, race-free
  1723	                    # reconciled_at + conditional-delete design (FIX3-A(b)/
  1724	                    # (c)) — correct regardless of whether the atomic commit
  1725	                    # already landed, is still landing, or never will.
  1726	                    if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
  1727	                        settled = True
  1728	                        try:
  1729	                            with anyio.CancelScope(shield=True):
  1730	                                refunded = await asyncio.wait_for(
  1731	                                    _settle_verified_quote_predebit_after_failure(
  1732	                                        user_id=user.id,
  1733	                                        pre_debited=pre_debited,
  1734	                                        predebit_ledger_id=predebit_ledger_id,
  1735	                                        use_independent_session=True,
  1736	                                    ),
  1737	                                    timeout=_CANCEL_IO_TIMEOUT_S,
  1738	                                )
  1739	                            if not refunded:
  1740	                                logger.info(
  1741	                                    "quote_billing.settled_no_refund user=%s ledger=%s: cancellation "
  1742	                                    "after the atomic commit had already reconciled — predebit stands.",
  1743	                                    user.id, predebit_ledger_id,
  1744	                                )
  1745	                        except Exception:
  1746	                            # FIX3-A(d): resolver failure must NEVER fall
  1747	                            # through to ANY further settlement attempt —
  1748	                            # leave the predebit standing and surface it to
  1749	                            # ops for manual review.
  1750	                            logger.error(
  1751	                                "quote_billing.unresolved user=%s ledger=%s pre_debited=%s "
  1752	                                "session=%s: settlement resolver failed during cancellation — "
  1753	                                "predebit left standing, requires manual review.",
  1754	                                user.id, predebit_ledger_id, pre_debited, session_id, exc_info=True,
  1755	                            )
  1756	                    raise
  1757	                except Exception as exc:
  1758	                    # FIX3-A(d) (Codex r3 #4, NOT ADDRESSED): ALL final-
  1759	                    # commit exceptions — not just CancelledError — now
  1760	                    # route through the SAME resolver as the branch above,
  1761	                    # closing the "ordinary 'server committed but COMMIT
  1762	                    # response was lost' exception leaves progress.message_id
  1763	                    # unset and reaches the generic (blind) refund path"
  1764	                    # gap Codex r3 found. `settled` is marked BEFORE the
  1765	                    # resolver runs, same reasoning as the CancelledError
  1766	                    # branch.
  1767	                    if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
  1768	                        settled = True
  1769	                        try:
  1770	                            refunded = await _settle_verified_quote_predebit_after_failure(
  1771	                                user_id=user.id,
  1772	                                pre_debited=pre_debited,
  1773	                                predebit_ledger_id=predebit_ledger_id,
  1774	                                use_independent_session=False,
  1775	                                db=db,
  1776	                            )
  1777	                        except Exception:
  1778	                            logger.error(
  1779	                                "quote_billing.unresolved user=%s ledger=%s pre_debited=%s "
  1780	                                "session=%s: settlement resolver failed after an ordinary billing "
  1781	                                "exception — predebit left standing, requires manual review.",
  1782	                                user.id, predebit_ledger_id, pre_debited, session_id, exc_info=True,
  1783	                            )
  1784	                            yield _safe_sse("error", "QUOTE_SEARCH_ERROR", exc, session_id=str(session_id))
  1785	                            return
  1786	                        if not refunded:
  1787	                            # The atomic commit had already reconciled — a
  1788	                            # real, delivered, persisted answer — this
  1789	                            # exception struck AFTER that. Predebit stands
  1790	                            # as the charge; never a full refund for a
  1791	                            # delivered answer.
  1792	                            logger.exception(
  1793	                                "Quote-search billing failed after the atomic commit had already "
  1794	                                "reconciled (ledger %s) for user %s — predebit stands, no refund.",
  1795	                                predebit_ledger_id, user.id,
  1796	                            )
  1797	                            yield _safe_sse(
  1798	                                "error", "QUOTE_SEARCH_BILLING_INCOMPLETE", exc, session_id=str(session_id),
  1799	                            )
  1800	                            return
  1801	                        # Refunded — nothing was delivered.
  1802	                        yield _safe_sse("error", "QUOTE_SEARCH_ERROR", exc, session_id=str(session_id))
  1803	                        return
  1804	                    raise
  1805	                # Reconcile already committed inside _run_verified_quote_search —
  1806	                # mark settled BEFORE yielding so a cancellation during these
  1807	                # yields can't ALSO trigger the setup handler's full refund
  1808	                # (double-refund guard, same pattern as the main RAG path).
  1809	                settled = True
  1810	                # P1 hygiene follow-up (Codex, 2026-08-03): this successful
  1811	                # early-return path also skipped the domain_mode session
  1812	                # sync — see _sync_session_domain_mode's docstring.
  1813	                await _sync_session_domain_mode(db, session_obj, domain_mode)
  1814	                if outcome.artifact_payload:
  1815	                    yield sse("artifact", outcome.artifact_payload)
  1816	                yield sse("token", {"text": outcome.assistant_text})
  1817	                yield sse(
  1818	                    "done",
  1819	                    {
  1820	                        "message_id": str(outcome.message_id),
  1821	                        "citations_count": len(outcome.citations),
  1822	                        "verification": None,
  1823	                        "can_continue": False,
  1824	                        "continuation_count": 0,
  1825	                        "artifact_count": 1 if outcome.artifact_payload else 0,
  1826	                    },
  1827	                )
  1828	                return
  1829	
  1830	            # 3) Load history (last N*2 messages before current user msg)
  1831	            max_turns = int(settings.MAX_CHAT_HISTORY_TURNS or 6)
  1832	            max_msgs = max_turns * 2
  1833	            msgs_row = await db.execute(
  1834	                select(Message)
  1835	                .where(Message.session_id == session_id)
  1836	                .order_by(Message.created_at.desc())
  1837	                .limit(max_msgs + 1)
  1838	            )
  1839	            history_msgs: List[Message] = list(msgs_row.scalars().all())
  1840	            history_msgs.reverse()  # back to chronological order

exec
/bin/zsh -lc "nl -ba backend/app/services/chat_service.py | sed -n '1841,2220p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
  1841	
  1842	            # Convert to Claude message format (excluding system)
  1843	            claude_messages: List[dict] = []
  1844	            for m in history_msgs:
  1845	                claude_messages.append({"role": m.role, "content": m.content})
  1846	
  1847	            # 4) Route + retrieval (with error handling — e.g. Qdrant down or no vectors yet).
  1848	            # Whole-document summaries must not use ordinary semantic top-k: vague
  1849	            # summary prompts frequently retrieve tables/appendices instead of
  1850	            # representative document structure. Route them to an ordered context
  1851	            # selector until the durable hierarchical brief index lands.
  1852	            setup_error_code = "RETRIEVAL_ERROR"
  1853	            retrieval_strategy = "semantic_top_k"
  1854	            retrieval_evaluation = None
  1855	            retrieval_plan: QueryPlan | None = None
  1856	            summary_usage = MapReduceUsageCollector()
  1857	            if (
  1858	                query_route.primary_intent == QueryIntent.DOCUMENT_SUMMARY
  1859	                and document_id
  1860	                and not is_collection_session
  1861	            ):
  1862	                yield sse("tool_status", {"message": "Summarizing the document section by section…"})
  1863	                retrieved = await document_brief_service.get_summary_context(
  1864	                    db,
  1865	                    document_id,
  1866	                    max_chunks=18,
  1867	                    usage_collector=summary_usage,
  1868	                )
  1869	                retrieval_strategy = "document_summary_context"
  1870	            elif (
  1871	                query_route.primary_intent == QueryIntent.DOCUMENT_SUMMARY
  1872	                and is_collection_session
  1873	                and collection_doc_ids
  1874	            ):
  1875	                retrieved = await document_brief_service.get_collection_summary_context(
  1876	                    db,
  1877	                    collection_doc_ids,
  1878	                    max_chunks=24,
  1879	                    max_docs=8,
  1880	                )
  1881	                retrieval_strategy = "collection_summary_context"
  1882	            elif is_collection_session and collection_doc_ids:
  1883	                corrective = await corrective_retrieval_service.retrieve_multi(
  1884	                    user_message,
  1885	                    query_route,
  1886	                    collection_doc_ids,
  1887	                    top_k=8,
  1888	                    db=db,
  1889	                )
  1890	                retrieved = corrective.retrieved
  1891	                retrieval_strategy = corrective.strategy
  1892	                retrieval_evaluation = corrective.evaluation
  1893	                retrieval_plan = corrective.plan
  1894	            elif (
  1895	                document_id
  1896	                and query_route.primary_intent == QueryIntent.PAGE_LOOKUP
  1897	                and query_route.page_ref is not None
  1898	            ):
  1899	                retrieved = await _fetch_page_chunks(db, document_id, query_route.page_ref)
  1900	                retrieval_strategy = "page_lookup"
  1901	                if not retrieved:
  1902	                    # Only a PURE page lookup ("what is on page N") skips fallback: answering
  1903	                    # from semantically-similar chunks on OTHER pages gives a wrong-page answer,
  1904	                    # so the Source Locations contract makes the model say page N wasn't found.
  1905	                    # A MIXED page+topic/table query (intents has more than PAGE_LOOKUP, e.g.
  1906	                    # "table on page 8", "requirements on page 12") still needs its evidence —
  1907	                    # fall back to semantic retrieval. (Consensus R2a #1 + Codex r2a review.)
  1908	                    is_pure_page_lookup = query_route.intents == (QueryIntent.PAGE_LOOKUP,)
  1909	                    if is_pure_page_lookup:
  1910	                        retrieved = []
  1911	                        retrieval_strategy = "page_lookup_miss"
  1912	                    else:
  1913	                        corrective = await corrective_retrieval_service.retrieve_single(
  1914	                            user_message, query_route, document_id, top_k=8, db=db,
  1915	                            doc_pages=getattr(doc, "page_count", None),
  1916	                        )
  1917	                        retrieved = corrective.retrieved
  1918	                        retrieval_strategy = corrective.strategy
  1919	                        retrieval_evaluation = corrective.evaluation
  1920	                        retrieval_plan = corrective.plan
  1921	            elif document_id:
  1922	                corrective = await corrective_retrieval_service.retrieve_single(
  1923	                    user_message,
  1924	                    query_route,
  1925	                    document_id,
  1926	                    top_k=8,
  1927	                    db=db,
  1928	                    doc_pages=getattr(doc, "page_count", None),
  1929	                )
  1930	                retrieved = corrective.retrieved
  1931	                retrieval_strategy = corrective.strategy
  1932	                retrieval_evaluation = corrective.evaluation
  1933	                retrieval_plan = corrective.plan
  1934	            else:
  1935	                retrieved = []
  1936	
  1937	            # 5) Build prompt (system)
  1938	            setup_error_code = "CHAT_SETUP_ERROR"
  1939	            numbered_chunks: List[str] = []
  1940	            chunk_map: dict[int, _ChunkInfo] = {}
  1941	            has_map_reduce_summary_context = any(
  1942	                item.get("retrieval_modality") == "summary"
  1943	                or item.get("map_reduce_strategy") == "map_reduce"
  1944	                for item in retrieved
  1945	            )
  1946	            for idx, item in enumerate(retrieved, start=1):
  1947	                # Heuristic truncation to ~350 tokens (roughly 1200-1400 chars)
  1948	                text = item["text"] or ""
  1949	                truncated = text[:1400]
  1950	                chunk_doc_id = item.get("document_id")
  1951	                doc_label = ""
  1952	                if is_collection_session and chunk_doc_id:
  1953	                    fname = collection_doc_names.get(chunk_doc_id, "")
  1954	                    if fname:
  1955	                        doc_label = f"(from: {fname}) "
  1956	                # File-type-aware source location (page/slide/sheet/part), gated for reliability.
  1957	                if is_collection_session and chunk_doc_id:
  1958	                    chunk_ft = collection_doc_types.get(chunk_doc_id)
  1959	                    chunk_pages = collection_doc_pages.get(chunk_doc_id)
  1960	                else:
  1961	                    chunk_ft = getattr(doc, "file_type", None)
  1962	                    chunk_pages = getattr(doc, "page_count", None)
  1963	                src = _source_locator(item, chunk_ft, chunk_pages)
  1964	                src_label = f"({src}) " if src else ""
  1965	                plan_label = _safe_plan_label(item.get("retrieval_plan_step"))
  1966	                evidence_label = f"(evidence: {plan_label}) " if plan_label else ""
  1967	                numbered_chunks.append(f"[{idx}] {doc_label}{src_label}{evidence_label}{truncated}")
  1968	                chunk_map[idx] = _ChunkInfo(
  1969	                    id=item["chunk_id"],
  1970	                    page_start=int(item["page"]),
  1971	                    page_end=int(item.get("page_end", item["page"])),
  1972	                    bboxes=item.get("bboxes") or [],
  1973	                    text=text,
  1974	                    section_title=item.get("section_title") or "",
  1975	                    document_id=chunk_doc_id if chunk_doc_id else document_id,
  1976	                    document_filename=collection_doc_names.get(chunk_doc_id, "")
  1977	                    if chunk_doc_id
  1978	                    else "",
  1979	                    score=item.get("score", 0.0),
  1980	                    table_id=str(item.get("table_id")) if item.get("table_id") else None,
  1981	                    retrieval_modality=str(item.get("retrieval_modality") or "text"),
  1982	                    summary_target_sections=tuple(item.get("map_reduce_target_sections") or ()),
  1983	                    summary_model_covered_sections=tuple(
  1984	                        item.get("map_reduce_model_covered_sections") or ()
  1985	                    ),
  1986	                    summary_fallback_sections=tuple(item.get("map_reduce_fallback_sections") or ()),
  1987	                    summary_missing_sections=tuple(item.get("map_reduce_missing_sections") or ()),
  1988	                )
  1989	
  1990	            rules = get_rules_for_model(
  1991	                effective_model, is_collection=is_collection_session
  1992	            )
  1993	
  1994	            if is_collection_session and retrieval_strategy == "collection_summary_context":
  1995	                doc_list = ", ".join(collection_doc_names.values()) if collection_doc_names else "(no documents)"
  1996	                system_prompt = (
  1997	                    "You are a document analysis assistant. The user is asking for a broad summary across a document collection.\n\n"
  1998	                    + SYSTEM_PROMPT_META_RULE
  1999	                    + f"## Available Documents\n{doc_list}\n\n"
  2000	                    + "## Collection Coverage Sources\n"
  2001	                    + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
  2002	                    + "\n\n## Summary Rules\n"
  2003	                    + "1. Treat these sources as representative coverage selected across the collection, not as semantic search results for a narrow question.\n"
  2004	                    + "2. Do NOT say the collection is just unrelated sections merely because the context is selective.\n"
  2005	                    + "3. Summarize shared themes, document-specific points, and important caveats when supported.\n"
  2006	                    + "4. If coverage is incomplete, say the answer is based on the cited representative sections instead of refusing.\n"
  2007	                    + "5. Cite every factual paragraph or bullet using the source numbers listed above.\n"
  2008	                    + "6. Your response language MUST match the language of the user's question.\n"
  2009	                    + _citation_contract()
  2010	                )
  2011	            elif is_collection_session:
  2012	                doc_list = ", ".join(collection_doc_names.values()) if collection_doc_names else "(no documents)"
  2013	                system_prompt = (
  2014	                    "You are a document analysis assistant. Answer the user's question based on sources from multiple documents.\n\n"
  2015	                    + SYSTEM_PROMPT_META_RULE
  2016	                    + f"## Available Documents\n{doc_list}\n\n"
  2017	                    + "## Document Sources\n"
  2018	                    + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
  2019	                    + _retrieval_quality_contract(retrieval_evaluation, retrieval_strategy)
  2020	                    + _query_plan_contract(retrieval_plan)
  2021	                    + "\n\n## Rules\n" + rules
  2022	                    + _citation_contract()
  2023	                )
  2024	            elif retrieval_strategy == "document_summary_context":
  2025	                map_reduce_rule = (
  2026	                    "7. The sources may be map-reduce section summaries generated from source chunks; "
  2027	                    "use the coverage status to distinguish model-covered, fallback, and missing sections.\n"
  2028	                    if has_map_reduce_summary_context
  2029	                    else ""
  2030	                )
  2031	                system_prompt = (
  2032	                    "You are a document analysis assistant. The user is asking for a broad, whole-document summary.\n\n"
  2033	                    + SYSTEM_PROMPT_META_RULE
  2034	                    + "## Document Coverage Sources\n"
  2035	                    + (
  2036	                        "\n".join(numbered_chunks)
  2037	                        if numbered_chunks
  2038	                        else "(none)"
  2039	                    )
  2040	                    + "\n\n## Summary Rules\n"
  2041	                    + "1. Treat these sources as representative coverage selected across the document, not as semantic search results for a narrow question.\n"
  2042	                    + "2. Do NOT say the user's ready document is not a complete document merely because the context is selective.\n"
  2043	                    + "3. Produce a useful document-level summary with clear headings, key points, and important caveats when supported.\n"
  2044	                    + "4. If coverage is incomplete, say the answer is based on the cited representative sections instead of refusing.\n"
  2045	                    + "5. Cite every factual paragraph or bullet using the source numbers listed above.\n"
  2046	                    + "6. Your response language MUST match the language of the user's question.\n"
  2047	                    + map_reduce_rule
  2048	                    + _summary_coverage_contract(retrieved)
  2049	                    + _citation_contract()
  2050	                )
  2051	            else:
  2052	                system_prompt = (
  2053	                    "You are a document analysis assistant. Answer the user's question based on the following document sources.\n\n"
  2054	                    + SYSTEM_PROMPT_META_RULE
  2055	                    + "## Document Sources\n"
  2056	                    + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
  2057	                    + _retrieval_quality_contract(retrieval_evaluation, retrieval_strategy)
  2058	                    + _query_plan_contract(retrieval_plan)
  2059	                    + "\n\n## Rules\n" + rules
  2060	                    + _citation_contract()
  2061	                )
  2062	
  2063	            # Inject custom instructions if present (subordinate to core rules — they are
  2064	            # user preferences, not overrides of role/source/citation/safety rules).
  2065	            if doc and doc.custom_instructions:
  2066	                system_prompt += (
  2067	                    "\n## Custom Instructions\n"
  2068	                    "Follow these custom instructions only when they do not conflict with the role, "
  2069	                    "data-boundary, source-location, citation, language, or safety rules above:\n"
  2070	                    + doc.custom_instructions + "\n"
  2071	                )
  2072	
  2073	            # Inject domain-specific rules (legal/academic mode overlay)
  2074	            # Frontend always sends domain_mode: null (default) or "legal"/"academic"
  2075	            # domain_mode=None means Default (no extra rules), string means apply rules
  2076	            if domain_mode:
  2077	                from app.core.model_profiles import DOMAIN_RULES
  2078	                domain_rules = DOMAIN_RULES.get(domain_mode)
  2079	                if domain_rules:
  2080	                    base_rule_count = len(rules.strip().split('\n'))
  2081	                    domain_rules_text = f"\n\n## {domain_mode.title()} Mode Rules\n"
  2082	                    for i, rule in enumerate(domain_rules, start=base_rule_count + 1):
  2083	                        domain_rules_text += f"{i}. {rule}\n"
  2084	                    system_prompt += domain_rules_text
  2085	
  2086	            # Global contracts appended to EVERY branch: source-location grounding (#1)
  2087	            # + user-facing terminology guard (#4). (Consensus R2a.)
  2088	            system_prompt += _source_location_contract() + _output_terminology_contract()
  2089	
  2090	            # Persist domain_mode to session (null clears, string sets) —
  2091	            # see _sync_session_domain_mode's docstring; this is the main
  2092	            # RAG path's call site, mirrored at the tool-action and strict
  2093	            # Quote Finder early returns above (P1 hygiene, Codex 2026-08-03).
  2094	            await _sync_session_domain_mode(db, session_obj, domain_mode)
  2095	
  2096	        except asyncio.CancelledError:
  2097	            if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
  2098	                try:
  2099	                    with anyio.CancelScope(shield=True):
  2100	                        await asyncio.wait_for(
  2101	                            _settle_predebit_on_cancel(
  2102	                                user_id=user.id,
  2103	                                pre_debited=pre_debited,
  2104	                                predebit_ledger_id=predebit_ledger_id,
  2105	                                has_answer=False,
  2106	                                prompt_tokens=None,
  2107	                                output_tokens=None,
  2108	                                model=effective_model,
  2109	                                mode=effective_mode,
  2110	                            ),
  2111	                            timeout=_CANCEL_IO_TIMEOUT_S,
  2112	                        )
  2113	                    settled = True
  2114	                except Exception:
  2115	                    logger.exception(
  2116	                        "Failed to settle pre-debit during chat setup cancellation for user %s",
  2117	                        user.id,
  2118	                    )
  2119	            raise
  2120	        except Exception as e:
  2121	            # FIX3-A(d) (Codex r3 #4, NOT ADDRESSED): this handler now also
  2122	            # checks `not settled` — previously it was the ONE generic
  2123	            # exception handler in this function that did NOT, so an
  2124	            # ordinary exception escaping the strict quote route's own
  2125	            # (already-settled) failure handling above would reach here and
  2126	            # attempt a SECOND, blind settlement. _refund_predebit's
  2127	            # conditional delete (FIX3-A(c)) makes a second attempt safe on
  2128	            # its own, but per Codex's prescription a resolver's decision
  2129	            # must never be second-guessed by an unconditional fallback —
  2130	            # the guard belongs here structurally, not just as a side
  2131	            # effect of the delete being idempotent.
  2132	            if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
  2133	                try:
  2134	                    await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
  2135	                    settled = True
  2136	                except Exception:
  2137	                    logger.exception(
  2138	                        "Failed to refund pre-debited credits during chat setup failure for user %s",
  2139	                        user.id,
  2140	                    )
  2141	            yield _safe_sse("error", setup_error_code, e, session_id=str(session_id))
  2142	            return
  2143	
  2144	        # 6) Stream from the configured OpenAI-compatible LLM provider
  2145	        try:
  2146	            client = _get_llm_client(effective_model)
  2147	        except Exception as e:
  2148	            if user is not None and pre_debited > 0 and predebit_ledger_id is not None:
  2149	                try:
  2150	                    await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
  2151	                    settled = True
  2152	                except Exception:
  2153	                    logger.exception(
  2154	                        "Failed to refund pre-debited credits before LLM client setup for user %s",
  2155	                        user.id,
  2156	                    )
  2157	            yield _safe_sse("error", "LLM_ERROR", e, session_id=str(session_id))
  2158	            return
  2159	
  2160	        # Build OpenAI-format messages (system + history)
  2161	        # cache_control is Anthropic-specific — only include for Anthropic models
  2162	        profile = get_model_profile(effective_model)
  2163	        if profile.supports_cache_control:
  2164	            sys_msg: dict = {
  2165	                "role": "system",
  2166	                "content": [
  2167	                    {
  2168	                        "type": "text",
  2169	                        "text": system_prompt,
  2170	                        "cache_control": {"type": "ephemeral"},
  2171	                    }
  2172	                ],
  2173	            }
  2174	        else:
  2175	            sys_msg = {"role": "system", "content": system_prompt}
  2176	        openai_messages = [sys_msg] + claude_messages
  2177	
  2178	        assistant_text_parts: List[str] = []
  2179	        citations: List[dict] = []
  2180	        fsm = RefParserFSM(chunk_map)
  2181	
  2182	        last_ping = time.monotonic()
  2183	        prompt_tokens: Optional[int] = None
  2184	        output_tokens: Optional[int] = None
  2185	        llm_start = time.time()
  2186	        first_token_logged = False
  2187	        token_count = 0
  2188	        finish_reason: Optional[str] = None
  2189	        asst_msg: Optional[Message] = None
  2190	        repair_metadata: dict[str, Any] | None = None
  2191	        persisted = False
  2192	        done_emitted = False
  2193	
  2194	        try:
  2195	            try:
  2196	                create_kwargs: dict[str, Any] = {
  2197	                    "model": effective_model,
  2198	                    "max_tokens": profile.max_tokens,
  2199	                    "temperature": profile.temperature,
  2200	                    "messages": openai_messages,
  2201	                    "stream": True,
  2202	                }
  2203	                if profile.supports_stream_options:
  2204	                    create_kwargs["stream_options"] = {"include_usage": True}
  2205	                _apply_provider_options(create_kwargs, effective_model)
  2206	                stream = await client.chat.completions.create(**create_kwargs)
  2207	
  2208	                async for chunk in stream:
  2209	                    # Extract text delta
  2210	                    if chunk.choices and chunk.choices[0].delta.content:
  2211	                        text = chunk.choices[0].delta.content
  2212	                        token_count += 1
  2213	                        if not first_token_logged:
  2214	                            first_token_logged = True
  2215	                            latency = time.time() - llm_start
  2216	                            logger.info("LLM first_token_latency=%.2fs model=%s", latency, effective_model)
  2217	                        # 7) Feed FSM and emit events
  2218	                        for ev in fsm.feed(text):
  2219	                            if ev["event"] == "token":
  2220	                                assistant_text_parts.append(ev["data"]["text"])

exec
/bin/zsh -lc "nl -ba backend/app/services/chat_service.py | sed -n '1946,2115p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
  1946	            for idx, item in enumerate(retrieved, start=1):
  1947	                # Heuristic truncation to ~350 tokens (roughly 1200-1400 chars)
  1948	                text = item["text"] or ""
  1949	                truncated = text[:1400]
  1950	                chunk_doc_id = item.get("document_id")
  1951	                doc_label = ""
  1952	                if is_collection_session and chunk_doc_id:
  1953	                    fname = collection_doc_names.get(chunk_doc_id, "")
  1954	                    if fname:
  1955	                        doc_label = f"(from: {fname}) "
  1956	                # File-type-aware source location (page/slide/sheet/part), gated for reliability.
  1957	                if is_collection_session and chunk_doc_id:
  1958	                    chunk_ft = collection_doc_types.get(chunk_doc_id)
  1959	                    chunk_pages = collection_doc_pages.get(chunk_doc_id)
  1960	                else:
  1961	                    chunk_ft = getattr(doc, "file_type", None)
  1962	                    chunk_pages = getattr(doc, "page_count", None)
  1963	                src = _source_locator(item, chunk_ft, chunk_pages)
  1964	                src_label = f"({src}) " if src else ""
  1965	                plan_label = _safe_plan_label(item.get("retrieval_plan_step"))
  1966	                evidence_label = f"(evidence: {plan_label}) " if plan_label else ""
  1967	                numbered_chunks.append(f"[{idx}] {doc_label}{src_label}{evidence_label}{truncated}")
  1968	                chunk_map[idx] = _ChunkInfo(
  1969	                    id=item["chunk_id"],
  1970	                    page_start=int(item["page"]),
  1971	                    page_end=int(item.get("page_end", item["page"])),
  1972	                    bboxes=item.get("bboxes") or [],
  1973	                    text=text,
  1974	                    section_title=item.get("section_title") or "",
  1975	                    document_id=chunk_doc_id if chunk_doc_id else document_id,
  1976	                    document_filename=collection_doc_names.get(chunk_doc_id, "")
  1977	                    if chunk_doc_id
  1978	                    else "",
  1979	                    score=item.get("score", 0.0),
  1980	                    table_id=str(item.get("table_id")) if item.get("table_id") else None,
  1981	                    retrieval_modality=str(item.get("retrieval_modality") or "text"),
  1982	                    summary_target_sections=tuple(item.get("map_reduce_target_sections") or ()),
  1983	                    summary_model_covered_sections=tuple(
  1984	                        item.get("map_reduce_model_covered_sections") or ()
  1985	                    ),
  1986	                    summary_fallback_sections=tuple(item.get("map_reduce_fallback_sections") or ()),
  1987	                    summary_missing_sections=tuple(item.get("map_reduce_missing_sections") or ()),
  1988	                )
  1989	
  1990	            rules = get_rules_for_model(
  1991	                effective_model, is_collection=is_collection_session
  1992	            )
  1993	
  1994	            if is_collection_session and retrieval_strategy == "collection_summary_context":
  1995	                doc_list = ", ".join(collection_doc_names.values()) if collection_doc_names else "(no documents)"
  1996	                system_prompt = (
  1997	                    "You are a document analysis assistant. The user is asking for a broad summary across a document collection.\n\n"
  1998	                    + SYSTEM_PROMPT_META_RULE
  1999	                    + f"## Available Documents\n{doc_list}\n\n"
  2000	                    + "## Collection Coverage Sources\n"
  2001	                    + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
  2002	                    + "\n\n## Summary Rules\n"
  2003	                    + "1. Treat these sources as representative coverage selected across the collection, not as semantic search results for a narrow question.\n"
  2004	                    + "2. Do NOT say the collection is just unrelated sections merely because the context is selective.\n"
  2005	                    + "3. Summarize shared themes, document-specific points, and important caveats when supported.\n"
  2006	                    + "4. If coverage is incomplete, say the answer is based on the cited representative sections instead of refusing.\n"
  2007	                    + "5. Cite every factual paragraph or bullet using the source numbers listed above.\n"
  2008	                    + "6. Your response language MUST match the language of the user's question.\n"
  2009	                    + _citation_contract()
  2010	                )
  2011	            elif is_collection_session:
  2012	                doc_list = ", ".join(collection_doc_names.values()) if collection_doc_names else "(no documents)"
  2013	                system_prompt = (
  2014	                    "You are a document analysis assistant. Answer the user's question based on sources from multiple documents.\n\n"
  2015	                    + SYSTEM_PROMPT_META_RULE
  2016	                    + f"## Available Documents\n{doc_list}\n\n"
  2017	                    + "## Document Sources\n"
  2018	                    + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
  2019	                    + _retrieval_quality_contract(retrieval_evaluation, retrieval_strategy)
  2020	                    + _query_plan_contract(retrieval_plan)
  2021	                    + "\n\n## Rules\n" + rules
  2022	                    + _citation_contract()
  2023	                )
  2024	            elif retrieval_strategy == "document_summary_context":
  2025	                map_reduce_rule = (
  2026	                    "7. The sources may be map-reduce section summaries generated from source chunks; "
  2027	                    "use the coverage status to distinguish model-covered, fallback, and missing sections.\n"
  2028	                    if has_map_reduce_summary_context
  2029	                    else ""
  2030	                )
  2031	                system_prompt = (
  2032	                    "You are a document analysis assistant. The user is asking for a broad, whole-document summary.\n\n"
  2033	                    + SYSTEM_PROMPT_META_RULE
  2034	                    + "## Document Coverage Sources\n"
  2035	                    + (
  2036	                        "\n".join(numbered_chunks)
  2037	                        if numbered_chunks
  2038	                        else "(none)"
  2039	                    )
  2040	                    + "\n\n## Summary Rules\n"
  2041	                    + "1. Treat these sources as representative coverage selected across the document, not as semantic search results for a narrow question.\n"
  2042	                    + "2. Do NOT say the user's ready document is not a complete document merely because the context is selective.\n"
  2043	                    + "3. Produce a useful document-level summary with clear headings, key points, and important caveats when supported.\n"
  2044	                    + "4. If coverage is incomplete, say the answer is based on the cited representative sections instead of refusing.\n"
  2045	                    + "5. Cite every factual paragraph or bullet using the source numbers listed above.\n"
  2046	                    + "6. Your response language MUST match the language of the user's question.\n"
  2047	                    + map_reduce_rule
  2048	                    + _summary_coverage_contract(retrieved)
  2049	                    + _citation_contract()
  2050	                )
  2051	            else:
  2052	                system_prompt = (
  2053	                    "You are a document analysis assistant. Answer the user's question based on the following document sources.\n\n"
  2054	                    + SYSTEM_PROMPT_META_RULE
  2055	                    + "## Document Sources\n"
  2056	                    + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
  2057	                    + _retrieval_quality_contract(retrieval_evaluation, retrieval_strategy)
  2058	                    + _query_plan_contract(retrieval_plan)
  2059	                    + "\n\n## Rules\n" + rules
  2060	                    + _citation_contract()
  2061	                )
  2062	
  2063	            # Inject custom instructions if present (subordinate to core rules — they are
  2064	            # user preferences, not overrides of role/source/citation/safety rules).
  2065	            if doc and doc.custom_instructions:
  2066	                system_prompt += (
  2067	                    "\n## Custom Instructions\n"
  2068	                    "Follow these custom instructions only when they do not conflict with the role, "
  2069	                    "data-boundary, source-location, citation, language, or safety rules above:\n"
  2070	                    + doc.custom_instructions + "\n"
  2071	                )
  2072	
  2073	            # Inject domain-specific rules (legal/academic mode overlay)
  2074	            # Frontend always sends domain_mode: null (default) or "legal"/"academic"
  2075	            # domain_mode=None means Default (no extra rules), string means apply rules
  2076	            if domain_mode:
  2077	                from app.core.model_profiles import DOMAIN_RULES
  2078	                domain_rules = DOMAIN_RULES.get(domain_mode)
  2079	                if domain_rules:
  2080	                    base_rule_count = len(rules.strip().split('\n'))
  2081	                    domain_rules_text = f"\n\n## {domain_mode.title()} Mode Rules\n"
  2082	                    for i, rule in enumerate(domain_rules, start=base_rule_count + 1):
  2083	                        domain_rules_text += f"{i}. {rule}\n"
  2084	                    system_prompt += domain_rules_text
  2085	
  2086	            # Global contracts appended to EVERY branch: source-location grounding (#1)
  2087	            # + user-facing terminology guard (#4). (Consensus R2a.)
  2088	            system_prompt += _source_location_contract() + _output_terminology_contract()
  2089	
  2090	            # Persist domain_mode to session (null clears, string sets) —
  2091	            # see _sync_session_domain_mode's docstring; this is the main
  2092	            # RAG path's call site, mirrored at the tool-action and strict
  2093	            # Quote Finder early returns above (P1 hygiene, Codex 2026-08-03).
  2094	            await _sync_session_domain_mode(db, session_obj, domain_mode)
  2095	
  2096	        except asyncio.CancelledError:
  2097	            if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
  2098	                try:
  2099	                    with anyio.CancelScope(shield=True):
  2100	                        await asyncio.wait_for(
  2101	                            _settle_predebit_on_cancel(
  2102	                                user_id=user.id,
  2103	                                pre_debited=pre_debited,
  2104	                                predebit_ledger_id=predebit_ledger_id,
  2105	                                has_answer=False,
  2106	                                prompt_tokens=None,
  2107	                                output_tokens=None,
  2108	                                model=effective_model,
  2109	                                mode=effective_mode,
  2110	                            ),
  2111	                            timeout=_CANCEL_IO_TIMEOUT_S,
  2112	                        )
  2113	                    settled = True
  2114	                except Exception:
  2115	                    logger.exception(

exec
/bin/zsh -lc "nl -ba backend/app/services/chat_service.py | sed -n '2291,2566p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
  2291	                            user.id,
  2292	                        )
  2293	                yield _safe_sse("error", "LLM_ERROR", e, session_id=str(session_id))
  2294	                return
  2295	
  2296	            # 9) Save assistant draft before verification/repair (A2)
  2297	            assistant_text = "".join(assistant_text_parts)
  2298	            try:
  2299	                asst_msg = Message(
  2300	                    session_id=session_id,
  2301	                    role="assistant",
  2302	                    content=assistant_text,
  2303	                    citations=citations or None,
  2304	                    prompt_tokens=int(prompt_tokens) if prompt_tokens is not None else None,
  2305	                    output_tokens=int(output_tokens) if output_tokens is not None else None,
  2306	                )
  2307	                db.add(asst_msg)
  2308	                await db.commit()
  2309	                persisted = True
  2310	            except Exception:
  2311	                await db.rollback()
  2312	                has_partial_answer = bool(assistant_text.strip())
  2313	                if (
  2314	                    user is not None
  2315	                    and pre_debited > 0
  2316	                    and predebit_ledger_id is not None
  2317	                    and not has_partial_answer
  2318	                ):
  2319	                    try:
  2320	                        await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
  2321	                        settled = True
  2322	                    except Exception:
  2323	                        logger.exception(
  2324	                            "Failed to refund pre-debited credits after PERSIST_FAILED for user %s",
  2325	                            user.id,
  2326	                        )
  2327	                yield sse("error", {"code": "PERSIST_FAILED", "message": "Failed to save response"})
  2328	                return
  2329	
  2330	            verification_report = claim_verifier_service.verify(
  2331	                assistant_text,
  2332	                citations,
  2333	                set(chunk_map.keys()),
  2334	                retrieved_count=len(chunk_map),
  2335	            )
  2336	            verification_payload = verification_report.to_payload()
  2337	            if verification_report.status != "pass" and finish_reason != "length":
  2338	                yield sse("tool_status", {"message": "Checking citation support..."})
  2339	                repair = await _try_repair_rag_answer(
  2340	                    client=client,
  2341	                    model=effective_model,
  2342	                    profile=profile,
  2343	                    user_message=user_message,
  2344	                    assistant_text=assistant_text,
  2345	                    citations=citations,
  2346	                    chunk_map=chunk_map,
  2347	                    numbered_chunks=numbered_chunks,
  2348	                    verification=verification_payload,
  2349	                    locale=locale,
  2350	                )
  2351	                if repair is not None:
  2352	                    repair_metadata = repair.metadata
  2353	                    if repair.prompt_tokens:
  2354	                        prompt_tokens = int(prompt_tokens or 0) + repair.prompt_tokens
  2355	                    if repair.output_tokens:
  2356	                        output_tokens = int(output_tokens or 0) + repair.output_tokens
  2357	                    if repair.applied:
  2358	                        assistant_text = repair.text
  2359	                        citations = repair.citations
  2360	                        verification_payload = repair.verification
  2361	                        verification_report = claim_verifier_service.verify(
  2362	                            assistant_text,
  2363	                            citations,
  2364	                            set(chunk_map.keys()),
  2365	                            retrieved_count=len(chunk_map),
  2366	                        )
  2367	                        verification_payload = verification_report.to_payload()
  2368	                        yield sse(
  2369	                            "answer_repaired",
  2370	                            {
  2371	                                "text": assistant_text,
  2372	                                "citations": citations,
  2373	                                "verification": verification_payload,
  2374	                            },
  2375	                        )
  2376	            if verification_report.status != "pass":
  2377	                logger.warning(
  2378	                    "RAG verification status=%s score=%.3f claims=%d citations=%d reasons=%s",
  2379	                    verification_report.status,
  2380	                    verification_report.score,
  2381	                    verification_report.claim_count,
  2382	                    verification_report.citation_count,
  2383	                    ",".join(verification_report.reasons),
  2384	                )
  2385	
  2386	            focus_pt = focus_ct = 0
  2387	            focus_model_used = ""
  2388	            focus_elapsed = time.time() - llm_start
  2389	            if user is not None and citations and focus_elapsed <= _FOCUS_ELAPSED_BUDGET_S:
  2390	                yield sse("tool_status", {"message": "Refining citations..."})
  2391	            focus_changed, focus_model_used, focus_pt, focus_ct = await _refine_citation_focus(
  2392	                answer=assistant_text,
  2393	                citations=citations,
  2394	                chunk_map=chunk_map,
  2395	                fallback_model=effective_model,
  2396	                user=user,
  2397	                elapsed_seconds=focus_elapsed,
  2398	            )
  2399	            if focus_changed:
  2400	                yield sse("citations_refined", {"citations": citations})
  2401	
  2402	            try:
  2403	                if asst_msg is None:
  2404	                    raise RuntimeError("assistant message missing before verification update")
  2405	                asst_msg.content = assistant_text
  2406	                asst_msg.citations = citations or None
  2407	                asst_msg.prompt_tokens = int(prompt_tokens) if prompt_tokens is not None else None
  2408	                asst_msg.output_tokens = int(output_tokens) if output_tokens is not None else None
  2409	                await db.commit()
  2410	            except Exception:
  2411	                await db.rollback()
  2412	                yield sse("error", {"code": "PERSIST_FAILED", "message": "Failed to save response"})
  2413	                return
  2414	
  2415	            await _record_rag_verification_event(
  2416	                db,
  2417	                user=user,
  2418	                message_id=getattr(asst_msg, "id", None),
  2419	                verification=verification_payload,
  2420	                retrieval_strategy=retrieval_strategy,
  2421	                query_route=query_route,
  2422	                retrieved_count=len(chunk_map),
  2423	                repair_metadata=repair_metadata,
  2424	            )
  2425	
  2426	            # Credits: reconcile pre-debited estimate against actual cost
  2427	            if user is not None and pre_debited > 0 and predebit_ledger_id is not None:
  2428	                pt = int(prompt_tokens or 0)
  2429	                ct = int(output_tokens or 0)
  2430	                try:
  2431	                    answer_cost = credit_service.calculate_cost(pt, ct, effective_model, mode=effective_mode)
  2432	                    summary_usage_costs: list[tuple[str, int, int, int]] = []
  2433	                    for usage_model, (summary_prompt, summary_completion) in summary_usage.totals_by_model().items():
  2434	                        summary_mode = "quick" if usage_model == settings.MODE_MODELS.get("quick") else None
  2435	                        summary_cost = credit_service.calculate_cost(
  2436	                            summary_prompt,
  2437	                            summary_completion,
  2438	                            usage_model,
  2439	                            mode=summary_mode,
  2440	                        )
  2441	                        summary_usage_costs.append(
  2442	                            (usage_model, summary_prompt, summary_completion, summary_cost)
  2443	                        )
  2444	                    # Citation-focus Flash call: part of producing this answer,
  2445	                    # reconciled + recorded like summary usage.
  2446	                    focus_cost = 0
  2447	                    if (focus_pt or focus_ct) and focus_model_used:
  2448	                        focus_cost = credit_service.calculate_cost(
  2449	                            focus_pt, focus_ct, focus_model_used, mode="quick"
  2450	                        )
  2451	                    actual_cost = (
  2452	                        answer_cost
  2453	                        + sum(item[3] for item in summary_usage_costs)
  2454	                        + focus_cost
  2455	                    )
  2456	                    await credit_service.reconcile_credits(
  2457	                        db, user.id, predebit_ledger_id, pre_debited, actual_cost,
  2458	                    )
  2459	                    await credit_service.record_usage(
  2460	                        db,
  2461	                        user_id=user.id,
  2462	                        message_id=asst_msg.id,
  2463	                        model=effective_model,
  2464	                        prompt_tokens=pt,
  2465	                        completion_tokens=ct,
  2466	                        cost_credits=answer_cost,
  2467	                    )
  2468	                    for usage_model, summary_prompt, summary_completion, summary_cost in summary_usage_costs:
  2469	                        await credit_service.record_usage(
  2470	                            db,
  2471	                            user_id=user.id,
  2472	                            message_id=asst_msg.id,
  2473	                            model=usage_model,
  2474	                            prompt_tokens=summary_prompt,
  2475	                            completion_tokens=summary_completion,
  2476	                            cost_credits=summary_cost,
  2477	                        )
  2478	                    if focus_cost:
  2479	                        await credit_service.record_usage(
  2480	                            db,
  2481	                            user_id=user.id,
  2482	                            message_id=asst_msg.id,
  2483	                            model=focus_model_used,
  2484	                            prompt_tokens=focus_pt,
  2485	                            completion_tokens=focus_ct,
  2486	                            cost_credits=focus_cost,
  2487	                        )
  2488	                    await db.commit()
  2489	                    settled = True
  2490	                except Exception as e:
  2491	                    # Non-fatal accounting error
  2492	                    yield _safe_sse("warn", "ACCOUNTING_ERROR", e, session_id=str(session_id))
  2493	
  2494	            # 10) done
  2495	            can_continue = asst_msg.continuation_count < settings.MAX_CONTINUATIONS_PER_MESSAGE
  2496	            done_emitted = True
  2497	            yield sse("done", {
  2498	                "message_id": str(asst_msg.id),
  2499	                "citations_count": len(citations),
  2500	                "verification": verification_payload,
  2501	                "repair": repair_metadata,
  2502	                "can_continue": can_continue and finish_reason == "length",
  2503	                "continuation_count": asst_msg.continuation_count,
  2504	                # FIX3-B (Codex r3 #5, NOT ADDRESSED): set when the strict
  2505	                # quote trigger matched this message but a negation/
  2506	                # metalinguistic token was ALSO present, so verified quote
  2507	                # search was deliberately NOT auto-routed/billed (see
  2508	                # action_planner.deterministic_plan). Always present
  2509	                # (never conditionally omitted) so the frontend has a
  2510	                # stable field to check for offering a manual "Try Quote
  2511	                # Finder" chip — never used to auto-route or bill.
  2512	"quote_finder_hint": action_plan.quote_finder_hint,
  2513	                "quote_finder_topic": action_plan.quote_finder_hint_topic,
  2514	            })
  2515	        except asyncio.CancelledError:
  2516	            raise
  2517	        finally:
  2518	            assistant_snapshot = "".join(assistant_text_parts)
  2519	            has_partial_answer = bool(assistant_snapshot.strip())
  2520	            if not done_emitted and has_partial_answer and not persisted:
  2521	                try:
  2522	                    with anyio.CancelScope(shield=True):
  2523	                        await asyncio.wait_for(
  2524	                            _persist_partial_on_cancel(
  2525	                                session_id=session_id,
  2526	                                assistant_text=assistant_snapshot,
  2527	                                citations=citations,
  2528	                                prompt_tokens=prompt_tokens,
  2529	                                output_tokens=output_tokens,
  2530	                            ),
  2531	                            timeout=_CANCEL_IO_TIMEOUT_S,
  2532	                        )
  2533	                    persisted = True
  2534	                except Exception:
  2535	                    logger.exception(
  2536	                        "Failed to persist partial assistant response on cancel/error for session %s",
  2537	                        session_id,
  2538	                    )
  2539	            if (
  2540	                user is not None
  2541	                and pre_debited > 0
  2542	                and predebit_ledger_id is not None
  2543	                and not settled
  2544	            ):
  2545	                try:
  2546	                    with anyio.CancelScope(shield=True):
  2547	                        await asyncio.wait_for(
  2548	                            _settle_predebit_on_cancel(
  2549	                                user_id=user.id,
  2550	                                pre_debited=pre_debited,
  2551	                                predebit_ledger_id=predebit_ledger_id,
  2552	                                has_answer=has_partial_answer,
  2553	                                prompt_tokens=prompt_tokens,
  2554	                                output_tokens=output_tokens,
  2555	                                model=effective_model,
  2556	                                mode=effective_mode,
  2557	                            ),
  2558	                            timeout=_CANCEL_IO_TIMEOUT_S,
  2559	                        )
  2560	                    settled = True
  2561	                except Exception:
  2562	                    logger.exception(
  2563	                        "Failed to settle pre-debit on cancel/error for user %s",
  2564	                        user.id,
  2565	                    )
  2566	

exec
/bin/zsh -lc "nl -ba backend/app/services/chat_service.py | sed -n '2116,2290p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
  2116	                        "Failed to settle pre-debit during chat setup cancellation for user %s",
  2117	                        user.id,
  2118	                    )
  2119	            raise
  2120	        except Exception as e:
  2121	            # FIX3-A(d) (Codex r3 #4, NOT ADDRESSED): this handler now also
  2122	            # checks `not settled` — previously it was the ONE generic
  2123	            # exception handler in this function that did NOT, so an
  2124	            # ordinary exception escaping the strict quote route's own
  2125	            # (already-settled) failure handling above would reach here and
  2126	            # attempt a SECOND, blind settlement. _refund_predebit's
  2127	            # conditional delete (FIX3-A(c)) makes a second attempt safe on
  2128	            # its own, but per Codex's prescription a resolver's decision
  2129	            # must never be second-guessed by an unconditional fallback —
  2130	            # the guard belongs here structurally, not just as a side
  2131	            # effect of the delete being idempotent.
  2132	            if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
  2133	                try:
  2134	                    await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
  2135	                    settled = True
  2136	                except Exception:
  2137	                    logger.exception(
  2138	                        "Failed to refund pre-debited credits during chat setup failure for user %s",
  2139	                        user.id,
  2140	                    )
  2141	            yield _safe_sse("error", setup_error_code, e, session_id=str(session_id))
  2142	            return
  2143	
  2144	        # 6) Stream from the configured OpenAI-compatible LLM provider
  2145	        try:
  2146	            client = _get_llm_client(effective_model)
  2147	        except Exception as e:
  2148	            if user is not None and pre_debited > 0 and predebit_ledger_id is not None:
  2149	                try:
  2150	                    await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
  2151	                    settled = True
  2152	                except Exception:
  2153	                    logger.exception(
  2154	                        "Failed to refund pre-debited credits before LLM client setup for user %s",
  2155	                        user.id,
  2156	                    )
  2157	            yield _safe_sse("error", "LLM_ERROR", e, session_id=str(session_id))
  2158	            return
  2159	
  2160	        # Build OpenAI-format messages (system + history)
  2161	        # cache_control is Anthropic-specific — only include for Anthropic models
  2162	        profile = get_model_profile(effective_model)
  2163	        if profile.supports_cache_control:
  2164	            sys_msg: dict = {
  2165	                "role": "system",
  2166	                "content": [
  2167	                    {
  2168	                        "type": "text",
  2169	                        "text": system_prompt,
  2170	                        "cache_control": {"type": "ephemeral"},
  2171	                    }
  2172	                ],
  2173	            }
  2174	        else:
  2175	            sys_msg = {"role": "system", "content": system_prompt}
  2176	        openai_messages = [sys_msg] + claude_messages
  2177	
  2178	        assistant_text_parts: List[str] = []
  2179	        citations: List[dict] = []
  2180	        fsm = RefParserFSM(chunk_map)
  2181	
  2182	        last_ping = time.monotonic()
  2183	        prompt_tokens: Optional[int] = None
  2184	        output_tokens: Optional[int] = None
  2185	        llm_start = time.time()
  2186	        first_token_logged = False
  2187	        token_count = 0
  2188	        finish_reason: Optional[str] = None
  2189	        asst_msg: Optional[Message] = None
  2190	        repair_metadata: dict[str, Any] | None = None
  2191	        persisted = False
  2192	        done_emitted = False
  2193	
  2194	        try:
  2195	            try:
  2196	                create_kwargs: dict[str, Any] = {
  2197	                    "model": effective_model,
  2198	                    "max_tokens": profile.max_tokens,
  2199	                    "temperature": profile.temperature,
  2200	                    "messages": openai_messages,
  2201	                    "stream": True,
  2202	                }
  2203	                if profile.supports_stream_options:
  2204	                    create_kwargs["stream_options"] = {"include_usage": True}
  2205	                _apply_provider_options(create_kwargs, effective_model)
  2206	                stream = await client.chat.completions.create(**create_kwargs)
  2207	
  2208	                async for chunk in stream:
  2209	                    # Extract text delta
  2210	                    if chunk.choices and chunk.choices[0].delta.content:
  2211	                        text = chunk.choices[0].delta.content
  2212	                        token_count += 1
  2213	                        if not first_token_logged:
  2214	                            first_token_logged = True
  2215	                            latency = time.time() - llm_start
  2216	                            logger.info("LLM first_token_latency=%.2fs model=%s", latency, effective_model)
  2217	                        # 7) Feed FSM and emit events
  2218	                        for ev in fsm.feed(text):
  2219	                            if ev["event"] == "token":
  2220	                                assistant_text_parts.append(ev["data"]["text"])
  2221	                            elif ev["event"] == "citation":
  2222	                                citations.append(ev["data"])
  2223	                            yield ev
  2224	
  2225	                    # Track finish_reason from choices
  2226	                    if chunk.choices and chunk.choices[0].finish_reason:
  2227	                        finish_reason = chunk.choices[0].finish_reason
  2228	
  2229	                    # Extract usage if present (last chunk)
  2230	                    if hasattr(chunk, "usage") and chunk.usage:
  2231	                        prompt_tokens = getattr(chunk.usage, "prompt_tokens", None)
  2232	                        output_tokens = getattr(chunk.usage, "completion_tokens", None)
  2233	
  2234	                    # Ping every 15 seconds
  2235	                    now = time.monotonic()
  2236	                    if now - last_ping >= 15.0:
  2237	                        yield sse("ping", {})
  2238	                        last_ping = now
  2239	
  2240	                # Flush at stream end
  2241	                for ev in fsm.flush():
  2242	                    if ev["event"] == "token":
  2243	                        assistant_text_parts.append(ev["data"]["text"])
  2244	                    yield ev
  2245	
  2246	                if not citations:
  2247	                    assistant_snapshot = "".join(assistant_text_parts)
  2248	                    fallback_citations = _fallback_citations(assistant_snapshot, chunk_map)
  2249	                    if fallback_citations:
  2250	                        logger.warning(
  2251	                            "LLM emitted no citation markers; generated %d fallback citations model=%s",
  2252	                            len(fallback_citations),
  2253	                            effective_model,
  2254	                        )
  2255	                        for citation in fallback_citations:
  2256	                            citations.append(citation)
  2257	                            yield sse("citation", citation)
  2258	
  2259	                # Warn if response was truncated due to token limit
  2260	                if finish_reason == "length":
  2261	                    logger.warning(
  2262	                        "LLM response truncated (finish_reason=length) model=%s max_tokens=%d output_tokens=%s",
  2263	                        effective_model, profile.max_tokens, output_tokens,
  2264	                    )
  2265	                    yield sse("truncated", {"reason": "max_tokens"})
  2266	
  2267	                total_time = time.time() - llm_start
  2268	                final_token_count = int(output_tokens) if output_tokens is not None else token_count
  2269	                logger.info(
  2270	                    "LLM total_latency=%.2fs tokens=%d model=%s",
  2271	                    total_time,
  2272	                    final_token_count,
  2273	                    effective_model,
  2274	                )
  2275	
  2276	            except Exception as e:
  2277	                assistant_snapshot = "".join(assistant_text_parts)
  2278	                has_partial_answer = bool(assistant_snapshot.strip())
  2279	                if (
  2280	                    user is not None
  2281	                    and pre_debited > 0
  2282	                    and predebit_ledger_id is not None
  2283	                    and not has_partial_answer
  2284	                ):
  2285	                    try:
  2286	                        await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
  2287	                        settled = True
  2288	                    except Exception:
  2289	                        logger.exception(
  2290	                            "Failed to refund pre-debited credits after LLM error for user %s",

exec
/bin/zsh -lc "nl -ba backend/app/services/chat_service.py | sed -n '1780,1945p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
  1780	                                "session=%s: settlement resolver failed after an ordinary billing "
  1781	                                "exception — predebit left standing, requires manual review.",
  1782	                                user.id, predebit_ledger_id, pre_debited, session_id, exc_info=True,
  1783	                            )
  1784	                            yield _safe_sse("error", "QUOTE_SEARCH_ERROR", exc, session_id=str(session_id))
  1785	                            return
  1786	                        if not refunded:
  1787	                            # The atomic commit had already reconciled — a
  1788	                            # real, delivered, persisted answer — this
  1789	                            # exception struck AFTER that. Predebit stands
  1790	                            # as the charge; never a full refund for a
  1791	                            # delivered answer.
  1792	                            logger.exception(
  1793	                                "Quote-search billing failed after the atomic commit had already "
  1794	                                "reconciled (ledger %s) for user %s — predebit stands, no refund.",
  1795	                                predebit_ledger_id, user.id,
  1796	                            )
  1797	                            yield _safe_sse(
  1798	                                "error", "QUOTE_SEARCH_BILLING_INCOMPLETE", exc, session_id=str(session_id),
  1799	                            )
  1800	                            return
  1801	                        # Refunded — nothing was delivered.
  1802	                        yield _safe_sse("error", "QUOTE_SEARCH_ERROR", exc, session_id=str(session_id))
  1803	                        return
  1804	                    raise
  1805	                # Reconcile already committed inside _run_verified_quote_search —
  1806	                # mark settled BEFORE yielding so a cancellation during these
  1807	                # yields can't ALSO trigger the setup handler's full refund
  1808	                # (double-refund guard, same pattern as the main RAG path).
  1809	                settled = True
  1810	                # P1 hygiene follow-up (Codex, 2026-08-03): this successful
  1811	                # early-return path also skipped the domain_mode session
  1812	                # sync — see _sync_session_domain_mode's docstring.
  1813	                await _sync_session_domain_mode(db, session_obj, domain_mode)
  1814	                if outcome.artifact_payload:
  1815	                    yield sse("artifact", outcome.artifact_payload)
  1816	                yield sse("token", {"text": outcome.assistant_text})
  1817	                yield sse(
  1818	                    "done",
  1819	                    {
  1820	                        "message_id": str(outcome.message_id),
  1821	                        "citations_count": len(outcome.citations),
  1822	                        "verification": None,
  1823	                        "can_continue": False,
  1824	                        "continuation_count": 0,
  1825	                        "artifact_count": 1 if outcome.artifact_payload else 0,
  1826	                    },
  1827	                )
  1828	                return
  1829	
  1830	            # 3) Load history (last N*2 messages before current user msg)
  1831	            max_turns = int(settings.MAX_CHAT_HISTORY_TURNS or 6)
  1832	            max_msgs = max_turns * 2
  1833	            msgs_row = await db.execute(
  1834	                select(Message)
  1835	                .where(Message.session_id == session_id)
  1836	                .order_by(Message.created_at.desc())
  1837	                .limit(max_msgs + 1)
  1838	            )
  1839	            history_msgs: List[Message] = list(msgs_row.scalars().all())
  1840	            history_msgs.reverse()  # back to chronological order
  1841	
  1842	            # Convert to Claude message format (excluding system)
  1843	            claude_messages: List[dict] = []
  1844	            for m in history_msgs:
  1845	                claude_messages.append({"role": m.role, "content": m.content})
  1846	
  1847	            # 4) Route + retrieval (with error handling — e.g. Qdrant down or no vectors yet).
  1848	            # Whole-document summaries must not use ordinary semantic top-k: vague
  1849	            # summary prompts frequently retrieve tables/appendices instead of
  1850	            # representative document structure. Route them to an ordered context
  1851	            # selector until the durable hierarchical brief index lands.
  1852	            setup_error_code = "RETRIEVAL_ERROR"
  1853	            retrieval_strategy = "semantic_top_k"
  1854	            retrieval_evaluation = None
  1855	            retrieval_plan: QueryPlan | None = None
  1856	            summary_usage = MapReduceUsageCollector()
  1857	            if (
  1858	                query_route.primary_intent == QueryIntent.DOCUMENT_SUMMARY
  1859	                and document_id
  1860	                and not is_collection_session
  1861	            ):
  1862	                yield sse("tool_status", {"message": "Summarizing the document section by section…"})
  1863	                retrieved = await document_brief_service.get_summary_context(
  1864	                    db,
  1865	                    document_id,
  1866	                    max_chunks=18,
  1867	                    usage_collector=summary_usage,
  1868	                )
  1869	                retrieval_strategy = "document_summary_context"
  1870	            elif (
  1871	                query_route.primary_intent == QueryIntent.DOCUMENT_SUMMARY
  1872	                and is_collection_session
  1873	                and collection_doc_ids
  1874	            ):
  1875	                retrieved = await document_brief_service.get_collection_summary_context(
  1876	                    db,
  1877	                    collection_doc_ids,
  1878	                    max_chunks=24,
  1879	                    max_docs=8,
  1880	                )
  1881	                retrieval_strategy = "collection_summary_context"
  1882	            elif is_collection_session and collection_doc_ids:
  1883	                corrective = await corrective_retrieval_service.retrieve_multi(
  1884	                    user_message,
  1885	                    query_route,
  1886	                    collection_doc_ids,
  1887	                    top_k=8,
  1888	                    db=db,
  1889	                )
  1890	                retrieved = corrective.retrieved
  1891	                retrieval_strategy = corrective.strategy
  1892	                retrieval_evaluation = corrective.evaluation
  1893	                retrieval_plan = corrective.plan
  1894	            elif (
  1895	                document_id
  1896	                and query_route.primary_intent == QueryIntent.PAGE_LOOKUP
  1897	                and query_route.page_ref is not None
  1898	            ):
  1899	                retrieved = await _fetch_page_chunks(db, document_id, query_route.page_ref)
  1900	                retrieval_strategy = "page_lookup"
  1901	                if not retrieved:
  1902	                    # Only a PURE page lookup ("what is on page N") skips fallback: answering
  1903	                    # from semantically-similar chunks on OTHER pages gives a wrong-page answer,
  1904	                    # so the Source Locations contract makes the model say page N wasn't found.
  1905	                    # A MIXED page+topic/table query (intents has more than PAGE_LOOKUP, e.g.
  1906	                    # "table on page 8", "requirements on page 12") still needs its evidence —
  1907	                    # fall back to semantic retrieval. (Consensus R2a #1 + Codex r2a review.)
  1908	                    is_pure_page_lookup = query_route.intents == (QueryIntent.PAGE_LOOKUP,)
  1909	                    if is_pure_page_lookup:
  1910	                        retrieved = []
  1911	                        retrieval_strategy = "page_lookup_miss"
  1912	                    else:
  1913	                        corrective = await corrective_retrieval_service.retrieve_single(
  1914	                            user_message, query_route, document_id, top_k=8, db=db,
  1915	                            doc_pages=getattr(doc, "page_count", None),
  1916	                        )
  1917	                        retrieved = corrective.retrieved
  1918	                        retrieval_strategy = corrective.strategy
  1919	                        retrieval_evaluation = corrective.evaluation
  1920	                        retrieval_plan = corrective.plan
  1921	            elif document_id:
  1922	                corrective = await corrective_retrieval_service.retrieve_single(
  1923	                    user_message,
  1924	                    query_route,
  1925	                    document_id,
  1926	                    top_k=8,
  1927	                    db=db,
  1928	                    doc_pages=getattr(doc, "page_count", None),
  1929	                )
  1930	                retrieved = corrective.retrieved
  1931	                retrieval_strategy = corrective.strategy
  1932	                retrieval_evaluation = corrective.evaluation
  1933	                retrieval_plan = corrective.plan
  1934	            else:
  1935	                retrieved = []
  1936	
  1937	            # 5) Build prompt (system)
  1938	            setup_error_code = "CHAT_SETUP_ERROR"
  1939	            numbered_chunks: List[str] = []
  1940	            chunk_map: dict[int, _ChunkInfo] = {}
  1941	            has_map_reduce_summary_context = any(
  1942	                item.get("retrieval_modality") == "summary"
  1943	                or item.get("map_reduce_strategy") == "map_reduce"
  1944	                for item in retrieved
  1945	            )

exec
/bin/zsh -lc "nl -ba backend/app/services/chat_service.py | sed -n '2070,2205p'" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "nl -ba backend/app/services/chat_service.py | sed -n '1300,1521p'" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "nl -ba backend/app/api/chat.py | sed -n '360,510p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   360	        demo_messages_used = await demo_message_tracker.get_count(
   361	            _demo_message_key(client_ip, session.document_id)
   362	        )
   363	
   364	    return SessionMessagesResponse(messages=items, demo_messages_used=demo_messages_used)
   365	
   366	
   367	@chat_router.post("/sessions/{session_id}/chat")
   368	async def chat_stream(
   369	    session_id: uuid.UUID,
   370	    body: ChatRequest,
   371	    request: Request,
   372	    user: Optional[User] = Depends(get_current_user_optional),
   373	    db: AsyncSession = Depends(get_db_session),
   374	):
   375	    # Verify session access
   376	    session = await verify_session_access(session_id, user, db)
   377	    if not session:
   378	        raise HTTPException(status_code=404, detail=SESSION_NOT_FOUND_DETAIL)
   379	
   380	    # Block chat if document is not fully processed
   381	    if session.document and session.document.status != "ready":
   382	        raise HTTPException(
   383	            status_code=409,
   384	            detail={
   385	                "error": "DOCUMENT_PROCESSING",
   386	                "message": "Document is still being processed",
   387	                "status": session.document.status,
   388	            },
   389	        )
   390	
   391	    # P1 hygiene (top-down review, 2026-08-01): domain_mode ("legal"/
   392	    # "academic") is marketed as a Plus+ feature — the frontend disables
   393	    # the selector for free users (DomainModeSelector.tsx: canUse = plan in
   394	    # {plus,pro}) — but the backend accepted it unconditionally, so any
   395	    # free (or anonymous) user could bypass the UI gate entirely with a raw
   396	    # POST {"domain_mode": "legal"} and get the paid prompt behavior.
   397	    # Checked here, before the rate-limit/credit work below, since it's a
   398	    # cheap deterministic authorization check independent of both.
   399	    if body.domain_mode is not None:
   400	        plan = (user.plan or "free").lower() if user is not None else "free"
   401	        if plan not in {"plus", "pro"}:
   402	            raise HTTPException(
   403	                status_code=403,
   404	                detail={
   405	                    "error": "DOMAIN_MODE_REQUIRES_PLUS",
   406	                    "message": "Legal/Academic domain mode requires a Plus or Pro plan",
   407	                    "required_plan": "plus",
   408	                },
   409	            )
   410	
   411	    # Rate limit anonymous users
   412	    if user is None:
   413	        client_ip = get_client_ip(request)
   414	        if not await demo_chat_limiter.is_allowed(client_ip):
   415	            log_security_event("demo_rate_limit", ip=client_ip, session_id=session_id)
   416	            raise HTTPException(
   417	                status_code=429,
   418	                detail={
   419	                    "error": "RATE_LIMITED",
   420	                    "message": "Rate limit exceeded",
   421	                    "retry_after": 60,
   422	                },
   423	                headers={"Retry-After": "60"},
   424	            )
   425	    else:
   426	        # Rate limit authenticated users (30 req/min per user)
   427	        if not await auth_chat_limiter.is_allowed(str(user.id)):
   428	            raise HTTPException(
   429	                status_code=429,
   430	                detail={
   431	                    "error": "RATE_LIMITED",
   432	                    "message": "Rate limit exceeded",
   433	                    "retry_after": 60,
   434	                },
   435	                headers={"Retry-After": "60"},
   436	            )
   437	
   438	    # Enforce message limit for anonymous users on demo documents.
   439	    # Tracker key is scoped per (IP, document) and survives session recreation.
   440	    if user is None and session.document and session.document.demo_slug:
   441	        allowed, _count = await demo_message_tracker.check_and_increment(
   442	            _demo_message_key(client_ip, session.document_id), DEMO_MESSAGE_LIMIT
   443	        )
   444	        if not allowed:
   445	            log_security_event("demo_message_limit", ip=client_ip, document_id=session.document_id)
   446	            raise HTTPException(
   447	                status_code=429,
   448	                detail={
   449	                    "error": "DEMO_MESSAGE_LIMIT_REACHED",
   450	                    "message": "Demo message limit reached",
   451	                    "limit": DEMO_MESSAGE_LIMIT,
   452	                },
   453	            )
   454	
   455	    # If authenticated, ensure sufficient credits before opening stream
   456	    if user is not None:
   457	        from app.services.credit_service import ensure_monthly_credits
   458	        await ensure_monthly_credits(db, user)
   459	        await db.commit()
   460	        # Use mode-specific estimated cost for pre-check (actual pre-debit happens in chat_service)
   461	        effective_mode = body.mode or "balanced"
   462	        await enforce_free_mode_limits(db, user, effective_mode)
   463	        # FIX-3 (Codex r1 BLOCKER #3): strict-intent detection happens BEFORE
   464	        # this predebit decision — a strict-routed message always runs the
   465	        # balanced-model quote engine regardless of the selected chat mode,
   466	        # so this pre-check (and chat_service's own predebit, which mirrors
   467	        # this exact predicate) must reflect the balanced estimate, not
   468	        # effective_mode's (e.g. quick=5).
   469	        strict_quote_routed = _chat_strict_quote_routed(session, body.message)
   470	        estimated_cost = credit_service.get_estimated_cost(
   471	            "balanced" if strict_quote_routed else effective_mode
   472	        )
   473	        balance = await credit_service.get_user_credits(db, user.id)
   474	        if balance < estimated_cost:
   475	            raise HTTPException(
   476	                status_code=402,
   477	                detail={
   478	                    "error": "INSUFFICIENT_CREDITS",
   479	                    "message": "Insufficient credits",
   480	                    "required": estimated_cost,
   481	                    "balance": balance,
   482	                },
   483	            )
   484	
   485	    async def event_generator() -> AsyncGenerator[str, None]:
   486	        async for ev in chat_service.chat_stream(
   487	            session_id, body.message, db, user=user, locale=body.locale, mode=body.mode,
   488	            domain_mode=body.domain_mode
   489	        ):
   490	            # Format per SSE: event: <type>\ndata: {json}\n\n
   491	            line = f"event: {ev['event']}\n"
   492	            payload = json.dumps(ev.get("data", {}), ensure_ascii=False)
   493	            data_line = f"data: {payload}\n\n"
   494	            yield line + data_line
   495	
   496	    return StreamingResponse(
   497	        event_generator(),
   498	        media_type="text/event-stream",
   499	        headers={
   500	            "Cache-Control": "no-cache, no-transform",
   501	            "X-Accel-Buffering": "no",
   502	            "Connection": "keep-alive",
   503	        },
   504	    )
   505	
   506	
   507	@chat_router.post("/sessions/{session_id}/chat/continue")
   508	async def chat_continue(
   509	    session_id: uuid.UUID,
   510	    body: ContinueRequest,

 succeeded in 0ms:
  2070	                    + doc.custom_instructions + "\n"
  2071	                )
  2072	
  2073	            # Inject domain-specific rules (legal/academic mode overlay)
  2074	            # Frontend always sends domain_mode: null (default) or "legal"/"academic"
  2075	            # domain_mode=None means Default (no extra rules), string means apply rules
  2076	            if domain_mode:
  2077	                from app.core.model_profiles import DOMAIN_RULES
  2078	                domain_rules = DOMAIN_RULES.get(domain_mode)
  2079	                if domain_rules:
  2080	                    base_rule_count = len(rules.strip().split('\n'))
  2081	                    domain_rules_text = f"\n\n## {domain_mode.title()} Mode Rules\n"
  2082	                    for i, rule in enumerate(domain_rules, start=base_rule_count + 1):
  2083	                        domain_rules_text += f"{i}. {rule}\n"
  2084	                    system_prompt += domain_rules_text
  2085	
  2086	            # Global contracts appended to EVERY branch: source-location grounding (#1)
  2087	            # + user-facing terminology guard (#4). (Consensus R2a.)
  2088	            system_prompt += _source_location_contract() + _output_terminology_contract()
  2089	
  2090	            # Persist domain_mode to session (null clears, string sets) —
  2091	            # see _sync_session_domain_mode's docstring; this is the main
  2092	            # RAG path's call site, mirrored at the tool-action and strict
  2093	            # Quote Finder early returns above (P1 hygiene, Codex 2026-08-03).
  2094	            await _sync_session_domain_mode(db, session_obj, domain_mode)
  2095	
  2096	        except asyncio.CancelledError:
  2097	            if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
  2098	                try:
  2099	                    with anyio.CancelScope(shield=True):
  2100	                        await asyncio.wait_for(
  2101	                            _settle_predebit_on_cancel(
  2102	                                user_id=user.id,
  2103	                                pre_debited=pre_debited,
  2104	                                predebit_ledger_id=predebit_ledger_id,
  2105	                                has_answer=False,
  2106	                                prompt_tokens=None,
  2107	                                output_tokens=None,
  2108	                                model=effective_model,
  2109	                                mode=effective_mode,
  2110	                            ),
  2111	                            timeout=_CANCEL_IO_TIMEOUT_S,
  2112	                        )
  2113	                    settled = True
  2114	                except Exception:
  2115	                    logger.exception(
  2116	                        "Failed to settle pre-debit during chat setup cancellation for user %s",
  2117	                        user.id,
  2118	                    )
  2119	            raise
  2120	        except Exception as e:
  2121	            # FIX3-A(d) (Codex r3 #4, NOT ADDRESSED): this handler now also
  2122	            # checks `not settled` — previously it was the ONE generic
  2123	            # exception handler in this function that did NOT, so an
  2124	            # ordinary exception escaping the strict quote route's own
  2125	            # (already-settled) failure handling above would reach here and
  2126	            # attempt a SECOND, blind settlement. _refund_predebit's
  2127	            # conditional delete (FIX3-A(c)) makes a second attempt safe on
  2128	            # its own, but per Codex's prescription a resolver's decision
  2129	            # must never be second-guessed by an unconditional fallback —
  2130	            # the guard belongs here structurally, not just as a side
  2131	            # effect of the delete being idempotent.
  2132	            if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
  2133	                try:
  2134	                    await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
  2135	                    settled = True
  2136	                except Exception:
  2137	                    logger.exception(
  2138	                        "Failed to refund pre-debited credits during chat setup failure for user %s",
  2139	                        user.id,
  2140	                    )
  2141	            yield _safe_sse("error", setup_error_code, e, session_id=str(session_id))
  2142	            return
  2143	
  2144	        # 6) Stream from the configured OpenAI-compatible LLM provider
  2145	        try:
  2146	            client = _get_llm_client(effective_model)
  2147	        except Exception as e:
  2148	            if user is not None and pre_debited > 0 and predebit_ledger_id is not None:
  2149	                try:
  2150	                    await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
  2151	                    settled = True
  2152	                except Exception:
  2153	                    logger.exception(
  2154	                        "Failed to refund pre-debited credits before LLM client setup for user %s",
  2155	                        user.id,
  2156	                    )
  2157	            yield _safe_sse("error", "LLM_ERROR", e, session_id=str(session_id))
  2158	            return
  2159	
  2160	        # Build OpenAI-format messages (system + history)
  2161	        # cache_control is Anthropic-specific — only include for Anthropic models
  2162	        profile = get_model_profile(effective_model)
  2163	        if profile.supports_cache_control:
  2164	            sys_msg: dict = {
  2165	                "role": "system",
  2166	                "content": [
  2167	                    {
  2168	                        "type": "text",
  2169	                        "text": system_prompt,
  2170	                        "cache_control": {"type": "ephemeral"},
  2171	                    }
  2172	                ],
  2173	            }
  2174	        else:
  2175	            sys_msg = {"role": "system", "content": system_prompt}
  2176	        openai_messages = [sys_msg] + claude_messages
  2177	
  2178	        assistant_text_parts: List[str] = []
  2179	        citations: List[dict] = []
  2180	        fsm = RefParserFSM(chunk_map)
  2181	
  2182	        last_ping = time.monotonic()
  2183	        prompt_tokens: Optional[int] = None
  2184	        output_tokens: Optional[int] = None
  2185	        llm_start = time.time()
  2186	        first_token_logged = False
  2187	        token_count = 0
  2188	        finish_reason: Optional[str] = None
  2189	        asst_msg: Optional[Message] = None
  2190	        repair_metadata: dict[str, Any] | None = None
  2191	        persisted = False
  2192	        done_emitted = False
  2193	
  2194	        try:
  2195	            try:
  2196	                create_kwargs: dict[str, Any] = {
  2197	                    "model": effective_model,
  2198	                    "max_tokens": profile.max_tokens,
  2199	                    "temperature": profile.temperature,
  2200	                    "messages": openai_messages,
  2201	                    "stream": True,
  2202	                }
  2203	                if profile.supports_stream_options:
  2204	                    create_kwargs["stream_options"] = {"include_usage": True}
  2205	                _apply_provider_options(create_kwargs, effective_model)

 succeeded in 0ms:
  1300	        db.add(user_msg)
  1301	        await db.commit()
  1302	
  1303	        session = await db.get(ChatSession, session_id)
  1304	        if session and not session.title:
  1305	            clean = user_message.replace("\n", " ").replace("\r", "").strip()
  1306	            session.title = clean[:50]
  1307	            await db.commit()
  1308	
  1309	    async def _tool_action_stream(
  1310	        self,
  1311	        *,
  1312	        session_id: uuid.UUID,
  1313	        user_message: str,
  1314	        db: AsyncSession,
  1315	        user: Optional[User],
  1316	        locale: Optional[str],
  1317	        domain_mode: Optional[str],
  1318	        document_id: uuid.UUID | None,
  1319	        collection_doc_ids: list[uuid.UUID],
  1320	        action_plan: Any,
  1321	    ) -> AsyncGenerator[Dict[str, Any], None]:
  1322	        try:
  1323	            await self._persist_user_message_and_title(
  1324	                db=db,
  1325	                session_id=session_id,
  1326	                user_message=user_message,
  1327	            )
  1328	            if action_plan.user_visible_status:
  1329	                yield sse("tool_status", {"message": action_plan.user_visible_status})
  1330	            execution = await chat_tool_executor.execute(
  1331	                action_plan,
  1332	                user=user,
  1333	                db=db,
  1334	                document_id=document_id,
  1335	                collection_doc_ids=collection_doc_ids,
  1336	                locale=locale,
  1337	                domain_mode=domain_mode,
  1338	            )
  1339	            assistant_text = execution.message
  1340	            artifact_payload = execution.artifact.to_payload() if execution.artifact else None
  1341	            if artifact_payload:
  1342	                yield sse("artifact", artifact_payload)
  1343	            if assistant_text:
  1344	                yield sse("token", {"text": assistant_text})
  1345	
  1346	            asst_msg = Message(
  1347	                session_id=session_id,
  1348	                role="assistant",
  1349	                content=assistant_text,
  1350	                citations=(artifact_payload or {}).get("citations") if artifact_payload else None,
  1351	                metadata_json={
  1352	                    "action_plan": {
  1353	                        "action": action_plan.action.value,
  1354	                        "confidence": action_plan.confidence,
  1355	                        "reason": action_plan.reason,
  1356	                    },
  1357	                    "artifacts": [artifact_payload] if artifact_payload else [],
  1358	                },
  1359	            )
  1360	            db.add(asst_msg)
  1361	            await db.commit()
  1362	            yield sse(
  1363	                "done",
  1364	                {
  1365	                    "message_id": str(asst_msg.id),
  1366	                    "citations_count": 0,
  1367	                    "verification": None,
  1368	                    "can_continue": False,
  1369	                    "continuation_count": asst_msg.continuation_count,
  1370	                    "artifact_count": 1 if artifact_payload else 0,
  1371	                },
  1372	            )
  1373	        except Exception as exc:
  1374	            await db.rollback()
  1375	            yield _safe_sse("error", "CHAT_SETUP_ERROR", exc, session_id=str(session_id))
  1376	
  1377	    async def _run_verified_quote_search(
  1378	        self,
  1379	        *,
  1380	        session_id: uuid.UUID,
  1381	        db: AsyncSession,
  1382	        document: Document,
  1383	        user: User,
  1384	        topic: str,
  1385	        locale: Optional[str],
  1386	        pre_debited: int,
  1387	        predebit_ledger_id: uuid.UUID,
  1388	        progress: "_VerifiedQuoteProgress",
  1389	    ) -> "_VerifiedQuoteOutcome":
  1390	        """Strict verbatim-quote chat routing (B5, plan §8.4.3).
  1391	
  1392	        Runs B3's verified quote_search in place of the normal LLM answer,
  1393	        persists the assistant message, and reconciles + records usage — ALL
  1394	        of it awaited here, nothing yielded. `progress` is mutated as this
  1395	        proceeds (model/tokens as soon as quote_search() returns,
  1396	        `message_id` only once the message commit succeeds) so the CALLER's
  1397	        cancellation handler can settle correctly no matter where a
  1398	        CancelledError lands — see _VerifiedQuoteProgress's docstring.
  1399	
  1400	        Billing is the CALLER's chat predebit (pre_debited/predebit_ledger_id
  1401	        come from the SAME debit_credits() call every RAG-path message
  1402	        already goes through) — there is no separate quote-search debit, so
  1403	        this can never double-bill. An exception raised before ANY commit
  1404	        here propagates to chat_stream's existing setup exception handler
  1405	        unchanged, which fully refunds — correct, since nothing was
  1406	        delivered.
  1407	        """
  1408	        result = await quote_search_service.quote_search(
  1409	            db, document=document, user=user, topic=topic, locale=locale or "",
  1410	        )
  1411	        progress.prompt_tokens, progress.completion_tokens = result.usage
  1412	        progress.model = result.model
  1413	
  1414	        citations: List[dict] = []
  1415	        artifact_payload: Optional[dict] = None
  1416	        if result.cards:
  1417	            for idx, card in enumerate(result.cards, start=1):
  1418	                citations.append({
  1419	                    "ref_index": idx,
  1420	                    "chunk_id": card.chunk_id,
  1421	                    "page": card.page,
  1422	                    "page_end": card.page_end,
  1423	                    "bboxes": card.bboxes,
  1424	                    "text_snippet": card.display_text[:100],
  1425	                    "offset": 0,
  1426	                    "focus_snippet": card.display_text,
  1427	                    "confidence_score": round(card.score / 100.0, 3),
  1428	                    "context_text": card.display_text[:900],
  1429	                    "document_id": str(document.id),
  1430	                    "source_kind": card.source_kind,
  1431	                })
  1432	            assistant_text = _quote_search_copy(_QUOTE_SEARCH_FOUND_COPY, locale, n=len(result.cards))
  1433	            # Reuse the extraction-artifact SSE mechanism exactly (MINOR-3,
  1434	            # review round 1) rather than hand-building the payload shape.
  1435	            artifact = ChatArtifact(
  1436	                artifact_type="quote_search",
  1437	                status="succeeded",
  1438	                title="Verified Quotes",
  1439	                summary=assistant_text,
  1440	                preview={
  1441	                    "cards": [
  1442	                        {
  1443	                            "ref_index": idx,
  1444	                            "display_text": card.display_text,
  1445	                            "page": card.page,
  1446	                            "page_end": card.page_end,
  1447	                            "tier": card.tier,
  1448	                            "source_kind": card.source_kind,
  1449	                            "score": card.score,
  1450	                        }
  1451	                        for idx, card in enumerate(result.cards, start=1)
  1452	                    ],
  1453	                    "proposed": result.proposed,
  1454	                    "verified": result.verified,
  1455	                    "discarded_count": len(result.discarded),
  1456	                    "scanned_chunks": result.scanned_chunks,
  1457	                },
  1458	                citations=citations,
  1459	            )
  1460	            artifact_payload = artifact.to_payload()
  1461	        else:
  1462	            # Verified-empty: the honest message, never an unverified fallback answer.
  1463	            assistant_text = _quote_search_copy(_QUOTE_SEARCH_EMPTY_COPY, locale, n=result.scanned_chunks)
  1464	
  1465	        message_id = uuid.uuid4()
  1466	        asst_msg = Message(
  1467	            id=message_id,
  1468	            session_id=session_id,
  1469	            role="assistant",
  1470	            content=assistant_text,
  1471	            citations=citations or None,
  1472	            metadata_json={
  1473	                "action_plan": {
  1474	                    "action": ChatAction.VERIFIED_QUOTE_SEARCH.value,
  1475	                    "confidence": 1.0,
  1476	                    "reason": "strict verbatim-quote markers",
  1477	                },
  1478	                "artifacts": [artifact_payload] if artifact_payload else [],
  1479	            },
  1480	        )
  1481	        db.add(asst_msg)
  1482	
  1483	        # FIX2-B(a) (Codex r2 #4, NOT ADDRESSED): message-persist + reconcile
  1484	        # + usage-record are now ONE ATOMIC commit — no intermediate commit
  1485	        # between the message add and the billing settlement. This removes
  1486	        # the "message persisted but billing never reconciled" class of
  1487	        # ordinary-exception free-ride entirely: either the whole
  1488	        # transaction lands together, or none of it does. FIX3-A (Codex r3
  1489	        # #4): reconcile_credits() below durably stamps
  1490	        # credit_ledger.reconciled_at under a row lock — the caller's
  1491	        # exception handlers resolve any failure here (CancelledError or
  1492	        # ordinary) via that marker + an atomic conditional refund, never
  1493	        # an in-memory flag or existence check.
  1494	        actual_cost = credit_service.calculate_cost(
  1495	            progress.prompt_tokens, progress.completion_tokens, progress.model, mode="balanced",
  1496	        )
  1497	        await credit_service.reconcile_credits(
  1498	            db, user.id, predebit_ledger_id, pre_debited, actual_cost,
  1499	        )
  1500	        await credit_service.record_usage(
  1501	            db,
  1502	            user_id=user.id,
  1503	            message_id=message_id,
  1504	            model=progress.model,
  1505	            prompt_tokens=progress.prompt_tokens,
  1506	            completion_tokens=progress.completion_tokens,
  1507	            cost_credits=actual_cost,
  1508	        )
  1509	        await db.commit()
  1510	        # Only trustworthy once the atomic commit's await has ACTUALLY
  1511	        # returned — the ordinary-exception handler (FIX-4) uses this to
  1512	        # know whether a real answer was delivered.
  1513	        progress.message_id = message_id
  1514	
  1515	        return _VerifiedQuoteOutcome(
  1516	            message_id=message_id,
  1517	            assistant_text=assistant_text,
  1518	            citations=citations,
  1519	            artifact_payload=artifact_payload,
  1520	        )
  1521	

exec
/bin/zsh -lc 'git diff --no-ext-diff --unified=20 e499bc7..HEAD -- backend/app/services/chat_service.py backend/tests/test_quote_intent_routing.py' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
diff --git a/backend/app/services/chat_service.py b/backend/app/services/chat_service.py
index 3a1830b..704a4d5 100644
--- a/backend/app/services/chat_service.py
+++ b/backend/app/services/chat_service.py
@@ -936,40 +936,65 @@ async def _settle_verified_quote_predebit_after_failure(
     landing, or never will. There is nothing left for THIS function to
     "decide" — it just calls _refund_predebit with the right session and
     surfaces whether a refund actually happened, so the caller can log/
     respond accordingly.
 
     use_independent_session=True (CancelledError): the request's own `db`
     session may not be usable mid-cancellation — settle via a fresh
     AsyncSessionLocal(), matching every other cancel-path settler in this
     file.
     use_independent_session=False (ordinary exception): reuses the
     request's own `db` (rolled back first, inside _refund_predebit) —
     matches the existing pattern for non-cancellation failures elsewhere.
     """
     if use_independent_session:
         async with AsyncSessionLocal() as settle_db:
             return await _refund_predebit(settle_db, user_id, pre_debited, predebit_ledger_id)
     assert db is not None
     return await _refund_predebit(db, user_id, pre_debited, predebit_ledger_id)
 
 
+async def _sync_session_domain_mode(
+    db: AsyncSession, session_obj: ChatSession, domain_mode: Optional[str],
+) -> None:
+    """P1 hygiene follow-up (Codex M3 P1 review, 2026-08-03): the persisted
+    ChatSession.domain_mode must reflect the CURRENT request's domain_mode
+    (null when omitted) on EVERY successful terminal path of chat_stream,
+    not just the main RAG path this logic originally lived in inline.
+    Codex found two successful early-return paths that skipped it — tool
+    actions and strict Quote Finder routing — both returning before the
+    main RAG path's system-prompt-building section ever ran. A session
+    that once had domain_mode="legal" persisted could keep that stale
+    value after a later omitted-mode message that happened to route to
+    one of those branches, making the documented "omitted clears it"
+    invariant false for those paths.
+
+    Downstream-harmless today (chat_stream always uses the per-request
+    `domain_mode` argument directly, never re-reads session_obj.domain_mode
+    to decide behavior; continuation doesn't reload it either) — this is
+    metadata correctness / honoring the invariant, not a security fix.
+    """
+    if domain_mode != session_obj.domain_mode:
+        session_obj.domain_mode = domain_mode
+        await db.commit()
+
+
 async def _fetch_page_chunks(
     db: AsyncSession,
     document_id: uuid.UUID,
     page_ref: int,
     *,
     limit: int = 12,
 ) -> List[Dict[str, Any]]:
     """Direct positional retrieval (B4): chunks overlapping a specific page.
 
     Semantic top-k cannot resolve "what is on page N" — the paying user asked for
     page 350 of a 492-page PDF and got "the excerpts do not contain page 350".
     Here we fetch the chunks whose page range covers the requested page.
     """
     rows = await db.execute(
         select(Chunk)
         .where(Chunk.document_id == document_id)
         .where(Chunk.page_start <= page_ref)
         .where(Chunk.page_end >= page_ref)
         .order_by(Chunk.chunk_index)
         .limit(limit)
@@ -1567,40 +1592,45 @@ class ChatService:
         # Premium mode gating: require Plus or Pro plan
         if effective_mode in settings.PREMIUM_MODES:
             user_plan = (user.plan or "free").lower() if user else "free"
             if user_plan == "free":
                 yield sse(
                     "error",
                     {
                         "code": "MODE_NOT_ALLOWED",
                         "message": "Upgrade to Plus to use this mode",
                         "required_plan": "plus",
                     },
                 )
                 return
 
         action_plan = await action_planner.plan(
             user_message,
             is_collection=is_collection_session,
             locale=locale,
         )
         if not action_plan.uses_rag_answer_path:
+            # P1 hygiene follow-up (Codex, 2026-08-03): this successful
+            # early-return path skipped the domain_mode session sync that
+            # only ran inline in the main RAG path below — see
+            # _sync_session_domain_mode's docstring.
+            await _sync_session_domain_mode(db, session_obj, domain_mode)
             async for ev in self._tool_action_stream(
                 session_id=session_id,
                 user_message=user_message,
                 db=db,
                 user=user,
                 locale=locale,
                 domain_mode=domain_mode,
                 document_id=document_id,
                 collection_doc_ids=collection_doc_ids,
                 action_plan=action_plan,
             ):
                 yield ev
             return
 
         query_route = query_router.route(
             user_message,
             is_collection=is_collection_session,
             domain_mode=domain_mode,
         )
 
@@ -1760,40 +1790,44 @@ class ChatService:
                             # as the charge; never a full refund for a
                             # delivered answer.
                             logger.exception(
                                 "Quote-search billing failed after the atomic commit had already "
                                 "reconciled (ledger %s) for user %s — predebit stands, no refund.",
                                 predebit_ledger_id, user.id,
                             )
                             yield _safe_sse(
                                 "error", "QUOTE_SEARCH_BILLING_INCOMPLETE", exc, session_id=str(session_id),
                             )
                             return
                         # Refunded — nothing was delivered.
                         yield _safe_sse("error", "QUOTE_SEARCH_ERROR", exc, session_id=str(session_id))
                         return
                     raise
                 # Reconcile already committed inside _run_verified_quote_search —
                 # mark settled BEFORE yielding so a cancellation during these
                 # yields can't ALSO trigger the setup handler's full refund
                 # (double-refund guard, same pattern as the main RAG path).
                 settled = True
+                # P1 hygiene follow-up (Codex, 2026-08-03): this successful
+                # early-return path also skipped the domain_mode session
+                # sync — see _sync_session_domain_mode's docstring.
+                await _sync_session_domain_mode(db, session_obj, domain_mode)
                 if outcome.artifact_payload:
                     yield sse("artifact", outcome.artifact_payload)
                 yield sse("token", {"text": outcome.assistant_text})
                 yield sse(
                     "done",
                     {
                         "message_id": str(outcome.message_id),
                         "citations_count": len(outcome.citations),
                         "verification": None,
                         "can_continue": False,
                         "continuation_count": 0,
                         "artifact_count": 1 if outcome.artifact_payload else 0,
                     },
                 )
                 return
 
             # 3) Load history (last N*2 messages before current user msg)
             max_turns = int(settings.MAX_CHAT_HISTORY_TURNS or 6)
             max_msgs = max_turns * 2
             msgs_row = await db.execute(
@@ -2036,44 +2070,45 @@ class ChatService:
                     + doc.custom_instructions + "\n"
                 )
 
             # Inject domain-specific rules (legal/academic mode overlay)
             # Frontend always sends domain_mode: null (default) or "legal"/"academic"
             # domain_mode=None means Default (no extra rules), string means apply rules
             if domain_mode:
                 from app.core.model_profiles import DOMAIN_RULES
                 domain_rules = DOMAIN_RULES.get(domain_mode)
                 if domain_rules:
                     base_rule_count = len(rules.strip().split('\n'))
                     domain_rules_text = f"\n\n## {domain_mode.title()} Mode Rules\n"
                     for i, rule in enumerate(domain_rules, start=base_rule_count + 1):
                         domain_rules_text += f"{i}. {rule}\n"
                     system_prompt += domain_rules_text
 
             # Global contracts appended to EVERY branch: source-location grounding (#1)
             # + user-facing terminology guard (#4). (Consensus R2a.)
             system_prompt += _source_location_contract() + _output_terminology_contract()
 
-            # Persist domain_mode to session (null clears, string sets)
-            if domain_mode != session_obj.domain_mode:
-                session_obj.domain_mode = domain_mode
-                await db.commit()
+            # Persist domain_mode to session (null clears, string sets) —
+            # see _sync_session_domain_mode's docstring; this is the main
+            # RAG path's call site, mirrored at the tool-action and strict
+            # Quote Finder early returns above (P1 hygiene, Codex 2026-08-03).
+            await _sync_session_domain_mode(db, session_obj, domain_mode)
 
         except asyncio.CancelledError:
             if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
                 try:
                     with anyio.CancelScope(shield=True):
                         await asyncio.wait_for(
                             _settle_predebit_on_cancel(
                                 user_id=user.id,
                                 pre_debited=pre_debited,
                                 predebit_ledger_id=predebit_ledger_id,
                                 has_answer=False,
                                 prompt_tokens=None,
                                 output_tokens=None,
                                 model=effective_model,
                                 mode=effective_mode,
                             ),
                             timeout=_CANCEL_IO_TIMEOUT_S,
                         )
                     settled = True
                 except Exception:
diff --git a/backend/tests/test_quote_intent_routing.py b/backend/tests/test_quote_intent_routing.py
index e974c1f..efda19a 100644
--- a/backend/tests/test_quote_intent_routing.py
+++ b/backend/tests/test_quote_intent_routing.py
@@ -730,40 +730,142 @@ class TestAuthedRoutingEmitsArtifact:
                 session_id=session_id,
                 user_message="Give me a direct quote about the termination clause.",
                 db=db,
                 user=SimpleNamespace(id=user_id, plan="pro"),
                 mode="balanced",
             )
         ]
 
         assert events[-1]["event"] == "error"
         assert events[-1]["data"]["code"] == "QUOTE_SEARCH_ERROR"
         # reconcile_credits raised BEFORE record_usage or the atomic commit
         # were ever reached — proves the atomic block never landed (the
         # message add() before it was therefore never actually persisted).
         record_usage_mock.assert_not_awaited()
         # Full refund via the generic setup-phase handler.
         refund_mock.assert_awaited_once()
         assert refund_mock.await_args.args[1] == user_id
         assert refund_mock.await_args.args[3] == ledger_id
 
 
+class TestDomainModeSyncOnEarlyReturnPaths:
+    """P1 hygiene follow-up (Codex, 2026-08-03): _sync_session_domain_mode
+    (the "persisted ChatSession.domain_mode reflects the CURRENT request's
+    domain_mode, null when omitted" logic) originally only ran inline in
+    the main RAG path — Codex found it was SKIPPED on two successful
+    early-return paths: tool actions and strict Quote Finder routing. A
+    session that once had domain_mode="legal" persisted could keep that
+    stale value after a later omitted-mode message that happened to route
+    to one of those branches. Both tests below seed session_obj.domain_mode
+    = "legal" (simulating that stale prior state), send a message with NO
+    domain_mode, and assert the session row ends up domain_mode=None."""
+
+    @pytest.mark.asyncio
+    async def test_strict_quote_finder_route_clears_stale_domain_mode(
+        self, monkeypatch: pytest.MonkeyPatch,
+    ) -> None:
+        session_id = uuid.uuid4()
+        document_id = uuid.uuid4()
+        user_id = uuid.uuid4()
+        ledger_id = uuid.uuid4()
+        chunk_id = uuid.uuid4()
+        session_obj, doc_obj = _base_session_and_doc(document_id, session_id)
+        session_obj.domain_mode = "legal"  # stale prior value
+        db = _make_db(session_obj, doc_obj, execute_side_effect=[_ScalarOneResult(session_obj)])
+
+        monkeypatch.setattr(chat_service_module.action_planner, "plan", AsyncMock(return_value=_quote_action_plan()))
+        monkeypatch.setattr(chat_service_module.credit_service, "get_estimated_cost", lambda _mode: 15)
+        monkeypatch.setattr(chat_service_module.credit_service, "debit_credits", AsyncMock(return_value=ledger_id))
+        monkeypatch.setattr(chat_service_module.credit_service, "reconcile_credits", AsyncMock())
+        monkeypatch.setattr(chat_service_module.credit_service, "record_usage", AsyncMock())
+        monkeypatch.setattr(chat_service_module.credit_service, "calculate_cost", lambda *_a, **_k: 6)
+        monkeypatch.setattr(chat_service_module, "_get_llm_client", _never_called)
+
+        card = QuoteCard(
+            display_text="the exact clause text", page=3, page_end=3, bboxes=[],
+            tier="exact", source_kind="page_text", chunk_id=str(chunk_id), score=100.0,
+        )
+        result = QuoteSearchResult(
+            cards=[card], proposed=1, verified=1, discarded=[],
+            scanned_chunks=9, usage=(300, 80), model="deepseek-v4-pro",
+        )
+        monkeypatch.setattr(chat_service_module.quote_search_service, "quote_search", AsyncMock(return_value=result))
+
+        events = [
+            event
+            async for event in chat_service_module.chat_service.chat_stream(
+                session_id=session_id,
+                user_message="Give me a direct quote about the termination clause.",
+                db=db,
+                user=SimpleNamespace(id=user_id, plan="pro"),
+                mode="balanced",
+                domain_mode=None,  # omitted on THIS request
+            )
+        ]
+
+        assert events[-1]["event"] == "done"  # sanity: the route actually succeeded
+        assert session_obj.domain_mode is None  # the stale "legal" value was cleared
+
+    @pytest.mark.asyncio
+    async def test_tool_action_route_clears_stale_domain_mode(
+        self, monkeypatch: pytest.MonkeyPatch,
+    ) -> None:
+        session_id = uuid.uuid4()
+        document_id = uuid.uuid4()
+        user_id = uuid.uuid4()
+        session_obj, doc_obj = _base_session_and_doc(document_id, session_id)
+        session_obj.domain_mode = "legal"  # stale prior value
+        session_obj.title = "Existing title"  # skip the title-set second commit branch
+        db = _make_db(session_obj, doc_obj, execute_side_effect=[_ScalarOneResult(session_obj)])
+
+        tool_action_plan = SimpleNamespace(
+            action=ChatAction.EXPORT_TABLES,
+            uses_rag_answer_path=False,
+            confidence=0.9,
+            reason="table export markers",
+            user_visible_status="",
+            quote_finder_hint=False,
+            quote_finder_hint_topic=None,
+        )
+        monkeypatch.setattr(chat_service_module.action_planner, "plan", AsyncMock(return_value=tool_action_plan))
+
+        execution = SimpleNamespace(message="Here are the exported tables.", artifact=None)
+        monkeypatch.setattr(
+            chat_service_module.chat_tool_executor, "execute", AsyncMock(return_value=execution),
+        )
+
+        events = [
+            event
+            async for event in chat_service_module.chat_service.chat_stream(
+                session_id=session_id,
+                user_message="Export all tables to CSV.",
+                db=db,
+                user=SimpleNamespace(id=user_id, plan="pro"),
+                mode="balanced",
+                domain_mode=None,  # omitted on THIS request
+            )
+        ]
+
+        assert events[-1]["event"] == "done"  # sanity: the tool action actually succeeded
+        assert session_obj.domain_mode is None  # the stale "legal" value was cleared
+
+
 class TestSettleVerifiedQuotePredebitAfterFailure:
     """FIX3-A (Codex r3 #4, NOT ADDRESSED): direct unit coverage for the
     resolver — it is now a thin dispatch to the atomic-conditional
     _refund_predebit (FIX3-A(c)), which is itself the durable, race-free
     settlement mechanism (credit_ledger.reconciled_at, stamped under a row
     lock by every reconcile_credits() call). Real-Postgres coverage of that
     underlying mechanism, including Codex's deterministic interleaving
     probes, lives in test_quote_billing_failure_windows_integration.py."""
 
     @pytest.mark.asyncio
     async def test_independent_session_true_opens_a_fresh_session(self, monkeypatch):
         opened: list[object] = []
 
         class _FakeSession:
             async def __aenter__(self_inner):
                 opened.append(self_inner)
                 return self_inner
 
             async def __aexit__(self_inner, *exc):
                 return False

codex
The branch inventory is now clear: tool-action, strict Quote Finder, and the ordinary RAG family (which includes document/collection summaries and page lookup). There is no separate summary/overview return. I did find one placement hazard worth probing: the tool-action sync occurs before execution, and outside the service’s main exception boundary; the strict-route sync occurs only after its billed answer has already committed. I’m testing those failure windows before assigning severity.
exec
/bin/zsh -lc 'rg -n "''^'"\\s*return"'$|''^'"\\s*return\\b|yield sse\\(\\\"done\\\"|_sync_session_domain_mode\" backend/app/services/chat_service.py | awk '"'$1+0 >= 1522 && $1+0 < 2567 {print}'"'" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "nl -ba backend/app/api/chat.py | sed -n '385,485p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
1551:            return
1604:                return
1615:            # _sync_session_domain_mode's docstring.
1616:            await _sync_session_domain_mode(db, session_obj, domain_mode)
1629:            return
1676:                return
1785:                            return
1800:                            return
1803:                        return
1812:                # sync — see _sync_session_domain_mode's docstring.
1813:                await _sync_session_domain_mode(db, session_obj, domain_mode)
1828:                return
2091:            # see _sync_session_domain_mode's docstring; this is the main
2094:            await _sync_session_domain_mode(db, session_obj, domain_mode)
2142:            return
2158:            return
2294:                return
2328:                return
2413:                return
2497:            yield sse("done", {

 succeeded in 0ms:
   385	                "error": "DOCUMENT_PROCESSING",
   386	                "message": "Document is still being processed",
   387	                "status": session.document.status,
   388	            },
   389	        )
   390	
   391	    # P1 hygiene (top-down review, 2026-08-01): domain_mode ("legal"/
   392	    # "academic") is marketed as a Plus+ feature — the frontend disables
   393	    # the selector for free users (DomainModeSelector.tsx: canUse = plan in
   394	    # {plus,pro}) — but the backend accepted it unconditionally, so any
   395	    # free (or anonymous) user could bypass the UI gate entirely with a raw
   396	    # POST {"domain_mode": "legal"} and get the paid prompt behavior.
   397	    # Checked here, before the rate-limit/credit work below, since it's a
   398	    # cheap deterministic authorization check independent of both.
   399	    if body.domain_mode is not None:
   400	        plan = (user.plan or "free").lower() if user is not None else "free"
   401	        if plan not in {"plus", "pro"}:
   402	            raise HTTPException(
   403	                status_code=403,
   404	                detail={
   405	                    "error": "DOMAIN_MODE_REQUIRES_PLUS",
   406	                    "message": "Legal/Academic domain mode requires a Plus or Pro plan",
   407	                    "required_plan": "plus",
   408	                },
   409	            )
   410	
   411	    # Rate limit anonymous users
   412	    if user is None:
   413	        client_ip = get_client_ip(request)
   414	        if not await demo_chat_limiter.is_allowed(client_ip):
   415	            log_security_event("demo_rate_limit", ip=client_ip, session_id=session_id)
   416	            raise HTTPException(
   417	                status_code=429,
   418	                detail={
   419	                    "error": "RATE_LIMITED",
   420	                    "message": "Rate limit exceeded",
   421	                    "retry_after": 60,
   422	                },
   423	                headers={"Retry-After": "60"},
   424	            )
   425	    else:
   426	        # Rate limit authenticated users (30 req/min per user)
   427	        if not await auth_chat_limiter.is_allowed(str(user.id)):
   428	            raise HTTPException(
   429	                status_code=429,
   430	                detail={
   431	                    "error": "RATE_LIMITED",
   432	                    "message": "Rate limit exceeded",
   433	                    "retry_after": 60,
   434	                },
   435	                headers={"Retry-After": "60"},
   436	            )
   437	
   438	    # Enforce message limit for anonymous users on demo documents.
   439	    # Tracker key is scoped per (IP, document) and survives session recreation.
   440	    if user is None and session.document and session.document.demo_slug:
   441	        allowed, _count = await demo_message_tracker.check_and_increment(
   442	            _demo_message_key(client_ip, session.document_id), DEMO_MESSAGE_LIMIT
   443	        )
   444	        if not allowed:
   445	            log_security_event("demo_message_limit", ip=client_ip, document_id=session.document_id)
   446	            raise HTTPException(
   447	                status_code=429,
   448	                detail={
   449	                    "error": "DEMO_MESSAGE_LIMIT_REACHED",
   450	                    "message": "Demo message limit reached",
   451	                    "limit": DEMO_MESSAGE_LIMIT,
   452	                },
   453	            )
   454	
   455	    # If authenticated, ensure sufficient credits before opening stream
   456	    if user is not None:
   457	        from app.services.credit_service import ensure_monthly_credits
   458	        await ensure_monthly_credits(db, user)
   459	        await db.commit()
   460	        # Use mode-specific estimated cost for pre-check (actual pre-debit happens in chat_service)
   461	        effective_mode = body.mode or "balanced"
   462	        await enforce_free_mode_limits(db, user, effective_mode)
   463	        # FIX-3 (Codex r1 BLOCKER #3): strict-intent detection happens BEFORE
   464	        # this predebit decision — a strict-routed message always runs the
   465	        # balanced-model quote engine regardless of the selected chat mode,
   466	        # so this pre-check (and chat_service's own predebit, which mirrors
   467	        # this exact predicate) must reflect the balanced estimate, not
   468	        # effective_mode's (e.g. quick=5).
   469	        strict_quote_routed = _chat_strict_quote_routed(session, body.message)
   470	        estimated_cost = credit_service.get_estimated_cost(
   471	            "balanced" if strict_quote_routed else effective_mode
   472	        )
   473	        balance = await credit_service.get_user_credits(db, user.id)
   474	        if balance < estimated_cost:
   475	            raise HTTPException(
   476	                status_code=402,
   477	                detail={
   478	                    "error": "INSUFFICIENT_CREDITS",
   479	                    "message": "Insufficient credits",
   480	                    "required": estimated_cost,
   481	                    "balance": balance,
   482	                },
   483	            )
   484	
   485	    async def event_generator() -> AsyncGenerator[str, None]:

exec
/bin/zsh -lc 'rg -n -C 4 "handleStreamError|DOMAIN_MODE_REQUIRES_PLUS|openPaywall" frontend/src/lib/useChatStream.ts frontend/src/lib/errorCopy.ts' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
frontend/src/lib/useChatStream.ts-106-    },
frontend/src/lib/useChatStream.ts-107-    [],
frontend/src/lib/useChatStream.ts-108-  );
frontend/src/lib/useChatStream.ts-109-
frontend/src/lib/useChatStream.ts:110:  // Shared by handleStreamError and the regenerate/continue catch blocks
frontend/src/lib/useChatStream.ts-111-  // below — both need to recognize a user-initiated abort the same way.
frontend/src/lib/useChatStream.ts-112-  const isAbortLikeError = useCallback((err: unknown): boolean => {
frontend/src/lib/useChatStream.ts-113-    const name = typeof err === 'object' && err && 'name' in err
frontend/src/lib/useChatStream.ts-114-      ? String((err as { name?: unknown }).name || '')
--
frontend/src/lib/useChatStream.ts-169-        // best-effort — a later restore/regenerate/continue will try again
frontend/src/lib/useChatStream.ts-170-      });
frontend/src/lib/useChatStream.ts-171-  }, [maxUserMessages]);
frontend/src/lib/useChatStream.ts-172-
frontend/src/lib/useChatStream.ts:173:  const handleStreamError = useCallback((err: unknown) => {
frontend/src/lib/useChatStream.ts-174-    flushPendingText();
frontend/src/lib/useChatStream.ts-175-    setStreaming(false);
frontend/src/lib/useChatStream.ts-176-    abortRef.current = null;
frontend/src/lib/useChatStream.ts-177-
--
frontend/src/lib/useChatStream.ts-186-      || code === 'INSUFFICIENT_CREDITS'
frontend/src/lib/useChatStream.ts-187-      || code === 'MODE_NOT_ALLOWED'
frontend/src/lib/useChatStream.ts-188-      || code === 'PRO_MODE_LIMIT_REACHED'
frontend/src/lib/useChatStream.ts-189-      || code === 'BALANCED_MODE_LIMIT_REACHED'
frontend/src/lib/useChatStream.ts:190:      || code === 'DOMAIN_MODE_REQUIRES_PLUS'
frontend/src/lib/useChatStream.ts-191-    ) {
frontend/src/lib/useChatStream.ts-192-      const reason = code || 'paid_limit';
frontend/src/lib/useChatStream.ts-193-      // I27: previously hardcoded `plan: 'plus'`, which falsely attributed
frontend/src/lib/useChatStream.ts-194-      // every paywall event in the funnel to plus-upgrade intent regardless
--
frontend/src/lib/useChatStream.ts-310-    updateLastMessageMeta({ citations: citations || [] });
frontend/src/lib/useChatStream.ts-311-  }, [flushPendingText, updateLastMessageMeta]);
frontend/src/lib/useChatStream.ts-312-
frontend/src/lib/useChatStream.ts-313-  // `onErrorOverride` lets a caller observe an error before it reaches the
frontend/src/lib/useChatStream.ts:314:  // shared `handleStreamError` (used by regenerateLastResponse to trigger a
frontend/src/lib/useChatStream.ts-315-  // demo-counter re-anchor without changing sendMessage's behavior at all).
frontend/src/lib/useChatStream.ts-316-  const streamAssistantResponse = useCallback(async (prompt: string, onErrorOverride?: (err: unknown) => void) => {
frontend/src/lib/useChatStream.ts-317-    const controller = new AbortController();
frontend/src/lib/useChatStream.ts-318-    abortRef.current = controller;
--
frontend/src/lib/useChatStream.ts-322-      sessionId,
frontend/src/lib/useChatStream.ts-323-      prompt,
frontend/src/lib/useChatStream.ts-324-      ({ text }) => updateLastMessage(text || ''),
frontend/src/lib/useChatStream.ts-325-      (citation) => addCitationToLastMessage(citation),
frontend/src/lib/useChatStream.ts:326:      onErrorOverride ?? handleStreamError,
frontend/src/lib/useChatStream.ts-327-      handleStreamDone,
frontend/src/lib/useChatStream.ts-328-      handleTruncated,
frontend/src/lib/useChatStream.ts-329-      selectedMode,
frontend/src/lib/useChatStream.ts-330-      locale,
--
frontend/src/lib/useChatStream.ts-334-      ({ message }) => setLastMessageToolStatus(message),
frontend/src/lib/useChatStream.ts-335-      handleAnswerRepaired,
frontend/src/lib/useChatStream.ts-336-      handleCitationsRefined,
frontend/src/lib/useChatStream.ts-337-    );
frontend/src/lib/useChatStream.ts:338:  }, [sessionId, updateLastMessage, addCitationToLastMessage, addArtifactToLastMessage, setLastMessageToolStatus, handleStreamError, handleStreamDone, handleTruncated, handleAnswerRepaired, handleCitationsRefined, selectedMode, locale]);
frontend/src/lib/useChatStream.ts-339-
frontend/src/lib/useChatStream.ts-340-  const sendMessage = useCallback(async (text: string) => {
frontend/src/lib/useChatStream.ts-341-    if (!text.trim() || isStreaming) return false;
frontend/src/lib/useChatStream.ts-342-
--
frontend/src/lib/useChatStream.ts-428-      // (which resolve normally, so a try/catch alone wouldn't see them) —
frontend/src/lib/useChatStream.ts-429-      // re-anchor before delegating to the shared error handler.
frontend/src/lib/useChatStream.ts-430-      await streamAssistantResponse(lastUserText, (err) => {
frontend/src/lib/useChatStream.ts-431-        reanchorDemoCounter(sessionId);
frontend/src/lib/useChatStream.ts:432:        handleStreamError(err);
frontend/src/lib/useChatStream.ts-433-      });
frontend/src/lib/useChatStream.ts-434-    } catch (e) {
frontend/src/lib/useChatStream.ts-435-      // Covers a thrown fetch() rejection (network failure before/instead
frontend/src/lib/useChatStream.ts-436-      // of any SSE response) — the one case the onError override above
--
frontend/src/lib/useChatStream.ts-438-      // catches it today either) — this only adds the re-anchor.
frontend/src/lib/useChatStream.ts-439-      if (!isAbortLikeError(e)) reanchorDemoCounter(sessionId);
frontend/src/lib/useChatStream.ts-440-      throw e;
frontend/src/lib/useChatStream.ts-441-    }
frontend/src/lib/useChatStream.ts:442:  }, [isStreaming, addMessage, setStreaming, streamAssistantResponse, bumpDemoUsageForRegenOrContinue, reanchorDemoCounter, sessionId, handleStreamError, isAbortLikeError]);
frontend/src/lib/useChatStream.ts-443-
frontend/src/lib/useChatStream.ts-444-  const continueGenerating = useCallback(async () => {
frontend/src/lib/useChatStream.ts-445-    if (isStreaming) return;
frontend/src/lib/useChatStream.ts-446-
--
frontend/src/lib/useChatStream.ts-466-        // failures, which resolve normally (see the try/catch below for the
frontend/src/lib/useChatStream.ts-467-        // thrown-fetch-rejection case a callback can't see).
frontend/src/lib/useChatStream.ts-468-        (err) => {
frontend/src/lib/useChatStream.ts-469-          reanchorDemoCounter(sessionId);
frontend/src/lib/useChatStream.ts:470:          handleStreamError(err);
frontend/src/lib/useChatStream.ts-471-        },
frontend/src/lib/useChatStream.ts-472-        handleStreamDone,
frontend/src/lib/useChatStream.ts-473-        handleTruncated,
frontend/src/lib/useChatStream.ts-474-        selectedMode,
--
frontend/src/lib/useChatStream.ts-484-      // it today either), this only adds the re-anchor.
frontend/src/lib/useChatStream.ts-485-      if (!isAbortLikeError(e)) reanchorDemoCounter(sessionId);
frontend/src/lib/useChatStream.ts-486-      throw e;
frontend/src/lib/useChatStream.ts-487-    }
frontend/src/lib/useChatStream.ts:488:  }, [isStreaming, sessionId, markLastMessageTruncated, setStreaming, updateLastMessage, addCitationToLastMessage, addArtifactToLastMessage, setLastMessageToolStatus, handleStreamError, handleStreamDone, handleTruncated, handleAnswerRepaired, handleCitationsRefined, selectedMode, locale, bumpDemoUsageForRegenOrContinue, reanchorDemoCounter, isAbortLikeError]);
frontend/src/lib/useChatStream.ts-489-
frontend/src/lib/useChatStream.ts-490-  const stopStreaming = useCallback(() => {
frontend/src/lib/useChatStream.ts-491-    abortRef.current?.abort();
frontend/src/lib/useChatStream.ts-492-    abortRef.current = null;
--
frontend/src/lib/errorCopy.ts-13-   * Whether the consumer should auto-open the paywall modal.
frontend/src/lib/errorCopy.ts-14-   * Only true for 402 credit/mode paywalls and SSE MODE_NOT_ALLOWED
frontend/src/lib/errorCopy.ts-15-   * (Codex r1 Q2: all other plan-limit 403s use inline CTA, never auto-modal).
frontend/src/lib/errorCopy.ts-16-   *
frontend/src/lib/errorCopy.ts:17:   * Exception: DOMAIN_MODE_REQUIRES_PLUS (403) auto-opens the modal on the
frontend/src/lib/errorCopy.ts-18-   * chat SSE path too, but NOT via this flag — this CODE_TABLE entry
frontend/src/lib/errorCopy.ts-19-   * deliberately leaves it unset (P1 Codex review: a stray `true` here was
frontend/src/lib/errorCopy.ts-20-   * a latent trap for any future generic errorCopy() consumer that trusts
frontend/src/lib/errorCopy.ts-21-   * this doc comment, since every other plan-limit 403 renders inline).
frontend/src/lib/errorCopy.ts:22:   * useChatStream.ts's handleStreamError hardcodes the code into its own
frontend/src/lib/errorCopy.ts-23-   * paywall-trigger list instead, because the chat SSE error renderer only
frontend/src/lib/errorCopy.ts-24-   * ever shows `copy.body` as chat-bubble text — it has no inline-CTA
frontend/src/lib/errorCopy.ts-25-   * rendering path the way the REST surfaces (dashboard, collections,
frontend/src/lib/errorCopy.ts-26-   * sharing, extraction panel) do, so a 403 here needs the modal or the
frontend/src/lib/errorCopy.ts-27-   * user gets no way forward at all.
frontend/src/lib/errorCopy.ts-28-   */
frontend/src/lib/errorCopy.ts:29:  openPaywall?: boolean;
frontend/src/lib/errorCopy.ts-30-}
frontend/src/lib/errorCopy.ts-31-
frontend/src/lib/errorCopy.ts-32-type TFn = (key: string, params?: Record<string, string | number>) => string;
frontend/src/lib/errorCopy.ts-33-type TOrFn = (key: string, fallback: string, params?: Record<string, string | number>) => string;
--
frontend/src/lib/errorCopy.ts-269-      balance: String(d.balance ?? ''),
frontend/src/lib/errorCopy.ts-270-    }),
frontend/src/lib/errorCopy.ts-271-    cta: upgradeCta(tOr, 'credits', 'plus'),
frontend/src/lib/errorCopy.ts-272-    severity: 'warning',
frontend/src/lib/errorCopy.ts:273:    openPaywall: true,
frontend/src/lib/errorCopy.ts-274-  }),
frontend/src/lib/errorCopy.ts-275-  BALANCED_MODE_LIMIT_REACHED: (d, tOr) => ({
frontend/src/lib/errorCopy.ts-276-    title: tOr('errors.BALANCED_MODE_LIMIT_REACHED.title', 'Pro limit reached'),
frontend/src/lib/errorCopy.ts-277-    body: tOr(
--
frontend/src/lib/errorCopy.ts-280-      { limit: String(d.limit ?? 20) },
frontend/src/lib/errorCopy.ts-281-    ),
frontend/src/lib/errorCopy.ts-282-    cta: upgradeCta(tOr, 'pro_mode_limit', 'plus'),
frontend/src/lib/errorCopy.ts-283-    severity: 'warning',
frontend/src/lib/errorCopy.ts:284:    openPaywall: true,
frontend/src/lib/errorCopy.ts-285-  }),
frontend/src/lib/errorCopy.ts-286-  PRO_MODE_LIMIT_REACHED: (d, tOr) => ({
frontend/src/lib/errorCopy.ts-287-    title: tOr('errors.PRO_MODE_LIMIT_REACHED.title', 'Pro limit reached'),
frontend/src/lib/errorCopy.ts-288-    body: tOr(
--
frontend/src/lib/errorCopy.ts-291-      { limit: String(d.limit ?? 20) },
frontend/src/lib/errorCopy.ts-292-    ),
frontend/src/lib/errorCopy.ts-293-    cta: upgradeCta(tOr, 'pro_mode_limit', 'plus'),
frontend/src/lib/errorCopy.ts-294-    severity: 'warning',
frontend/src/lib/errorCopy.ts:295:    openPaywall: true,
frontend/src/lib/errorCopy.ts-296-  }),
frontend/src/lib/errorCopy.ts-297-  CONTINUATION_LIMIT: (d, tOr) => ({
frontend/src/lib/errorCopy.ts-298-    title: tOr('errors.CONTINUATION_LIMIT.title', 'Continue limit reached'),
frontend/src/lib/errorCopy.ts-299-    body: tOr('errors.CONTINUATION_LIMIT.body', 'You can only continue a response {max} times.', {
--
frontend/src/lib/errorCopy.ts-305-    title: tOr('errors.MODE_NOT_ALLOWED.title', 'Plus plan required'),
frontend/src/lib/errorCopy.ts-306-    body: tOr('errors.MODE_NOT_ALLOWED.body', 'This mode is available on the Plus plan.'),
frontend/src/lib/errorCopy.ts-307-    cta: upgradeCta(tOr, 'mode_upgrade', 'plus'),
frontend/src/lib/errorCopy.ts-308-    severity: 'warning',
frontend/src/lib/errorCopy.ts:309:    openPaywall: true,
frontend/src/lib/errorCopy.ts-310-  }),
frontend/src/lib/errorCopy.ts:311:  DOMAIN_MODE_REQUIRES_PLUS: (d, tOr) => ({
frontend/src/lib/errorCopy.ts:312:    title: tOr('errors.DOMAIN_MODE_REQUIRES_PLUS.title', 'Plus plan required'),
frontend/src/lib/errorCopy.ts:313:    body: tOr('errors.DOMAIN_MODE_REQUIRES_PLUS.body', 'Legal and Academic domain mode is available on the Plus plan.'),
frontend/src/lib/errorCopy.ts-314-    cta: requiredPlanCta(d, tOr, 'domain_mode'),
frontend/src/lib/errorCopy.ts-315-    severity: 'warning',
frontend/src/lib/errorCopy.ts-316-  }),
frontend/src/lib/errorCopy.ts-317-

exec
/bin/zsh -lc "nl -ba frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx | sed -n '250,430p'; nl -ba frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx | sed -n '900,1080p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
zsh:1: no matches found: frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx
zsh:1: no matches found: frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx

exec
/bin/zsh -lc "rg -n -C 8 \"createLayoutTranslation|importLayoutTranslationDocument|addToLibrary\" frontend/src/lib/api.ts 'frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx' frontend/src/components/Chat/ChatArtifactCard.tsx" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-3-import React, { useCallback, useEffect, useRef, useState } from 'react';
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-4-import { useParams, useRouter, useSearchParams } from 'next/navigation';
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-5-import { PdfViewer } from '../../../components/PdfViewer';
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-6-import TextViewer from '../../../components/TextViewer/TextViewer';
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-7-import { ChatPanel } from '../../../components/Chat';
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-8-import Header from '../../../components/Header';
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-9-import CustomInstructionsModal from '../../../components/CustomInstructionsModal';
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-10-import LayoutTranslationDrawer from '../../../components/LayoutTranslation/LayoutTranslationDrawer';
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:11:import { ApiError, createLayoutTranslation, getChunkDetail, updateDocumentInstructions } from '../../../lib/api';
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-12-import { PaywallModal } from '../../../components/PaywallModal';
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-13-import { useDocTalkStore } from '../../../store';
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-14-import { Panel, Group, Separator } from 'react-resizable-panels';
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-15-import { useLocale } from '../../../i18n';
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-16-import { usePageTitle } from '../../../lib/usePageTitle';
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-17-import { AlertTriangle, Download, FileText, LogIn, MessageSquare, Presentation, Quote, X } from 'lucide-react';
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-18-import QuoteFinderPanel from '../../../components/Quotes/QuoteFinderPanel';
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-19-import { useDocumentLoader } from '../../../lib/useDocumentLoader';
--
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-149-    if (!isLoggedIn) {
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-150-      openAuthModal();
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-151-      return;
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-152-    }
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-153-    setLayoutTranslationError(null);
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-154-    setLayoutTranslationDrawerOpen(true);
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-155-  }, [isLoggedIn]);
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-156-
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:157:  const handleLayoutTranslationSubmit = useCallback(async ({ targetLanguage, addToLibrary }: { targetLanguage: string; addToLibrary: boolean }) => {
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-158-    if (layoutTranslationBusy) return;
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-159-    if (!isLoggedIn) {
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-160-      openAuthModal();
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-161-      return;
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-162-    }
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-163-    setLayoutTranslationBusy(true);
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-164-    setLayoutTranslationError(null);
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-165-    try {
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:166:      const job = await createLayoutTranslation({
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-167-        documentId,
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-168-        targetLanguage,
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-169-        locale,
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:170:        addToLibrary,
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-171-      });
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-172-      if (!layoutTranslationJobIdsRef.current.has(job.id)) {
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-173-        layoutTranslationJobIdsRef.current.add(job.id);
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-174-        addMessage({
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-175-          id: `layout_translation_${job.id}`,
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-176-          role: 'assistant',
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-177-          text: tOr(
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-178-            'layoutTranslation.chatMessage',
--
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-182-          artifacts: [job.artifact],
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-183-          createdAt: Date.now(),
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-184-        });
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-185-      }
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-186-      trackEvent('layout_translation_created', {
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-187-        source: 'document_toolbar',
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-188-        plan: userPlan || 'unknown',
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-189-        target_language: targetLanguage,
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:190:        add_to_library: addToLibrary,
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-191-      });
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-192-      setLayoutTranslationDrawerOpen(false);
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-193-      setMobileTab('chat');
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-194-    } catch (err) {
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-195-      if (err instanceof ApiError && err.code === 'LAYOUT_TRANSLATION_LIMIT_REACHED') {
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-196-        setLayoutPaywallReason(err.code);
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-197-        setLayoutPaywallOpen(true);
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx-198-        trackEvent('limit_hit', {
--
frontend/src/components/Chat/ChatArtifactCard.tsx-1-"use client";
frontend/src/components/Chat/ChatArtifactCard.tsx-2-
frontend/src/components/Chat/ChatArtifactCard.tsx-3-import { useEffect, useMemo, useRef, useState } from 'react';
frontend/src/components/Chat/ChatArtifactCard.tsx-4-import Link from 'next/link';
frontend/src/components/Chat/ChatArtifactCard.tsx-5-import { AlertTriangle, CheckCircle2, Clock3, Download, ExternalLink, Eye, FilePlus2, FileText, Languages, Loader2, Quote, RefreshCw, Sparkles, Table2 } from 'lucide-react';
frontend/src/components/Chat/ChatArtifactCard.tsx-6-import type { ChatArtifact, Citation, DocumentTable, QuoteCardsArtifactPreview } from '../../types';
frontend/src/components/Chat/ChatArtifactCard.tsx:7:import { getDocumentJob, getTableScanJob, importLayoutTranslationDocument, listDocumentTables, reconstructDocumentTable } from '../../lib/api';
frontend/src/components/Chat/ChatArtifactCard.tsx-8-import type { QuoteCard } from '../../lib/api';
frontend/src/components/Chat/ChatArtifactCard.tsx-9-import { absoluteProxiedArtifactUrl, proxiedArtifactUrl } from '../../lib/layoutTranslation';
frontend/src/components/Chat/ChatArtifactCard.tsx-10-import { errorCopy, type ErrorCopy } from '../../lib/errorCopy';
frontend/src/components/Chat/ChatArtifactCard.tsx-11-import { useLocale } from '../../i18n';
frontend/src/components/Chat/ChatArtifactCard.tsx-12-import { useDocTalkStore } from '../../store';
frontend/src/components/Chat/ChatArtifactCard.tsx-13-import QuoteCardList from '../Quotes/QuoteCardList';
frontend/src/components/Chat/ChatArtifactCard.tsx-14-import { citationFromQuoteCard } from '../Quotes/utils';
frontend/src/components/Chat/ChatArtifactCard.tsx-15-
--
frontend/src/components/Chat/ChatArtifactCard.tsx-277-    onPreviewLayoutTranslation?.(absoluteProxiedArtifactUrl(pdfDownload.url), current);
frontend/src/components/Chat/ChatArtifactCard.tsx-278-  };
frontend/src/components/Chat/ChatArtifactCard.tsx-279-
frontend/src/components/Chat/ChatArtifactCard.tsx-280-  const handleImportLayoutTranslation = async () => {
frontend/src/components/Chat/ChatArtifactCard.tsx-281-    if (!current.jobId || layoutImporting || importedDocumentId) return;
frontend/src/components/Chat/ChatArtifactCard.tsx-282-    setLayoutImporting(true);
frontend/src/components/Chat/ChatArtifactCard.tsx-283-    setLayoutImportError(null);
frontend/src/components/Chat/ChatArtifactCard.tsx-284-    try {
frontend/src/components/Chat/ChatArtifactCard.tsx:285:      const result = await importLayoutTranslationDocument(current.jobId, locale);
frontend/src/components/Chat/ChatArtifactCard.tsx-286-      setCurrent((prev) => ({
frontend/src/components/Chat/ChatArtifactCard.tsx-287-        ...prev,
frontend/src/components/Chat/ChatArtifactCard.tsx-288-        preview: {
frontend/src/components/Chat/ChatArtifactCard.tsx-289-          ...(prev.preview && typeof prev.preview === 'object' ? prev.preview as Record<string, unknown> : {}),
frontend/src/components/Chat/ChatArtifactCard.tsx-290-          imported_document_id: result.document_id,
frontend/src/components/Chat/ChatArtifactCard.tsx-291-          imported_document_filename: result.filename,
frontend/src/components/Chat/ChatArtifactCard.tsx-292-          imported_document_status: result.status,
frontend/src/components/Chat/ChatArtifactCard.tsx-293-          import_error: null,
--
frontend/src/lib/api.ts-204-  const res = await fetch(`${PROXY_BASE}/api/document-jobs/${jobId}`);
frontend/src/lib/api.ts-205-  const data: any = await handle(res);
frontend/src/lib/api.ts-206-  return {
frontend/src/lib/api.ts-207-    ...data,
frontend/src/lib/api.ts-208-    artifact: mapArtifactPayload(data.artifact),
frontend/src/lib/api.ts-209-  };
frontend/src/lib/api.ts-210-}
frontend/src/lib/api.ts-211-
frontend/src/lib/api.ts:212:export async function createLayoutTranslation(params: {
frontend/src/lib/api.ts-213-  documentId: string;
frontend/src/lib/api.ts-214-  targetLanguage?: string;
frontend/src/lib/api.ts-215-  locale?: string;
frontend/src/lib/api.ts:216:  addToLibrary?: boolean;
frontend/src/lib/api.ts-217-}): Promise<DocumentJobDetail> {
frontend/src/lib/api.ts-218-  const res = await fetch(`${PROXY_BASE}/api/documents/${params.documentId}/layout-translation`, {
frontend/src/lib/api.ts-219-    method: 'POST',
frontend/src/lib/api.ts-220-    headers: { 'Content-Type': 'application/json' },
frontend/src/lib/api.ts-221-    body: JSON.stringify({
frontend/src/lib/api.ts-222-      target_language: params.targetLanguage || 'zh-CN',
frontend/src/lib/api.ts-223-      locale: params.locale || null,
frontend/src/lib/api.ts:224:      add_to_library: Boolean(params.addToLibrary),
frontend/src/lib/api.ts-225-    }),
frontend/src/lib/api.ts-226-  });
frontend/src/lib/api.ts-227-  const data: any = await handle(res);
frontend/src/lib/api.ts-228-  return {
frontend/src/lib/api.ts-229-    ...data,
frontend/src/lib/api.ts-230-    artifact: mapArtifactPayload(data.artifact),
frontend/src/lib/api.ts-231-  };
frontend/src/lib/api.ts-232-}
frontend/src/lib/api.ts-233-
frontend/src/lib/api.ts-234-export interface LayoutTranslationImportResponse {
frontend/src/lib/api.ts-235-  document_id: string;
frontend/src/lib/api.ts-236-  status: string;
frontend/src/lib/api.ts-237-  filename: string;
frontend/src/lib/api.ts-238-  existing: boolean;
frontend/src/lib/api.ts-239-}
frontend/src/lib/api.ts-240-
frontend/src/lib/api.ts:241:export async function importLayoutTranslationDocument(jobId: string, locale?: string | null): Promise<LayoutTranslationImportResponse> {
frontend/src/lib/api.ts-242-  const res = await fetch(`${PROXY_BASE}/api/layout-translations/${jobId}/import-document`, {
frontend/src/lib/api.ts-243-    method: 'POST',
frontend/src/lib/api.ts-244-    headers: { 'Content-Type': 'application/json' },
frontend/src/lib/api.ts-245-    body: JSON.stringify({ locale: locale || null }),
frontend/src/lib/api.ts-246-  });
frontend/src/lib/api.ts-247-  return handle(res);
frontend/src/lib/api.ts-248-}
frontend/src/lib/api.ts-249-

exec
/bin/zsh -lc "rg -n -C 12 \"errorCopy\\(|layout.*Error|cta\" 'frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
48-  const [mobileTab, setMobileTab] = useState<'chat' | 'document'>('chat');
49-  const isDesktopLayout = useDesktopReaderLayout();
50-  const { t, tOr, locale } = useLocale();
51-  const { pdfUrl, currentPage, highlights, highlightSnippet, highlightFocus, scale, scrollNonce, sessionId, navigateToCitation, totalPages } = useDocTalkStore();
52-  const addMessage = useDocTalkStore((s) => s.addMessage);
53-
54-  const documentName = useDocTalkStore((s) => s.documentName);
55-  const suggestedQuestions = useDocTalkStore((s) => s.suggestedQuestions);
56-  const documentStatus = useDocTalkStore((s) => s.documentStatus);
57-  const [showInstructions, setShowInstructions] = useState(false);
58-  const [layoutTranslationBusy, setLayoutTranslationBusy] = useState(false);
59-  const [layoutTranslationDrawerOpen, setLayoutTranslationDrawerOpen] = useState(false);
60:  const [layoutTranslationError, setLayoutTranslationError] = useState<ErrorCopy | null>(null);
61-  const [layoutPaywallOpen, setLayoutPaywallOpen] = useState(false);
62-  const [layoutPaywallReason, setLayoutPaywallReason] = useState<string | null>(null);
63-  const [quoteFinderOpen, setQuoteFinderOpen] = useState(false);
64-  const [quoteFinderPrefillTopic, setQuoteFinderPrefillTopic] = useState<string | undefined>(undefined);
65-  const [translatedPreview, setTranslatedPreview] = useState<{
66-    url: string;
67-    downloadUrl: string | null;
68-    targetLanguageLabel: string;
69-    jobId: string | null;
70-  } | null>(null);
71-  const [pdfPreviewMode, setPdfPreviewMode] = useState<'original' | 'translated'>('original');
72-  const layoutTranslationJobIdsRef = useRef<Set<string>>(new Set());
73-  const {
74-    error: loaderError,
75-    isDemo,
76-    fileType,
77-    hasConvertedPdf,
78-    convertedPdfUrl,
79-    customInstructions,
80-    setCustomInstructions,
81-  } = useDocumentLoader(documentId);
82-  const { sessionError } = useChatSession(documentId);
83-  const { isLoggedIn, userPlan, canUseCustomInstructions } = useUserPlanProfile();
84:  const sessionErrorCopy = sessionError ? errorCopy(sessionError, t, tOr) : null;
85-  const error = loaderError;
86-
87-  usePageTitle(documentName || undefined);
88-
89-  // Handle ?page=N&highlight=chunkId from "View in original" links
90-  const searchParams = useSearchParams();
91-  const initialQuestion = searchParams.get('question') || undefined;
92-  const revealMobileDocumentPane = useCallback(() => {
93-    if (typeof window !== 'undefined' && window.innerWidth < 640) {
94-      setMobileTab('document');
95-    }
96-  }, []);
--
193-      setMobileTab('chat');
194-    } catch (err) {
195-      if (err instanceof ApiError && err.code === 'LAYOUT_TRANSLATION_LIMIT_REACHED') {
196-        setLayoutPaywallReason(err.code);
197-        setLayoutPaywallOpen(true);
198-        trackEvent('limit_hit', {
199-          source: 'layout_translation_toolbar',
200-          reason: err.code,
201-          plan: 'plus',
202-          period: 'monthly',
203-        });
204-      } else {
205:        setLayoutTranslationError(errorCopy(err, t, tOr));
206-        setLayoutTranslationDrawerOpen(false);
207-      }
208-    } finally {
209-      setLayoutTranslationBusy(false);
210-    }
211-  }, [addMessage, documentId, isLoggedIn, layoutTranslationBusy, locale, t, tOr, userPlan]);
212-
213-  const handlePreviewLayoutTranslation = useCallback((url: string, artifact: ChatArtifact) => {
214-    const preview = artifact.preview && typeof artifact.preview === 'object'
215-      ? artifact.preview as Record<string, unknown>
216-      : {};
217-    const pdfDownload = artifact.downloadUrls?.find((item) => item.format === 'pdf');
--
284-  );
285-
286-  const readerToolbar = (
287-    <div className="dt-view-toggle flex items-center justify-between gap-2 px-2 py-1">
288-      {viewToggle || <span />}
289-      {quoteFinderEntry}
290-    </div>
291-  );
292-
293-  const viewerContent = (
294-    <div className="h-full flex flex-col dt-reader-pane-document">
295-      {readerToolbar}
296:      {layoutTranslationError ? (
297-        <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100" role="alert">
298-          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
299-          <span className="min-w-0 flex-1">
300:            <span className="font-medium">{layoutTranslationError.title}: </span>
301:            {layoutTranslationError.body}
302:            {layoutTranslationError.cta && (
303-              <button
304-                type="button"
305:                onClick={() => router.push(layoutTranslationError.cta!.href)}
306-                className="ml-2 font-medium underline decoration-amber-500 underline-offset-2 hover:text-amber-700 dark:hover:text-amber-50"
307-              >
308:                {layoutTranslationError.cta.label}
309-              </button>
310-            )}
311-          </span>
312-          <button
313-            type="button"
314-            onClick={() => setLayoutTranslationError(null)}
315-            className="rounded p-0.5 text-amber-800 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-900/40"
316-            aria-label={tOr('common.dismiss', 'Dismiss')}
317-          >
318-            <X size={14} aria-hidden="true" />
319-          </button>
320-        </div>
--
433-        className={`w-full max-w-md rounded-2xl border px-5 py-4 text-sm shadow-sm ${
434-          sessionErrorCopy.severity === 'warning'
435-            ? 'border-amber-300/40 bg-amber-50 text-amber-950 dark:border-amber-300/25 dark:bg-amber-300/10 dark:text-amber-100'
436-            : sessionErrorCopy.severity === 'info'
437-              ? 'border-blue-300/40 bg-blue-50 text-blue-950 dark:border-blue-300/25 dark:bg-blue-300/10 dark:text-blue-100'
438-              : 'border-red-300/40 bg-red-50 text-red-950 dark:border-red-300/25 dark:bg-red-300/10 dark:text-red-100'
439-        }`}
440-        role="status"
441-        aria-live="polite"
442-      >
443-        <p className="font-semibold">{sessionErrorCopy.title}</p>
444-        <p className="mt-2 leading-6 opacity-90">{sessionErrorCopy.body}</p>
445:        {sessionErrorCopy.cta && (
446-          <button
447-            type="button"
448:            onClick={() => router.push(sessionErrorCopy.cta!.href)}
449-            className="mt-4 rounded-full bg-zinc-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
450-          >
451:            {sessionErrorCopy.cta.label}
452-          </button>
453-        )}
454-      </div>
455-    </div>
456-  ) : documentStatus !== 'ready' && !error ? (
457-    <div className="h-full w-full flex flex-col items-center justify-center px-6 py-8 text-zinc-500" role="status" aria-live="polite">
458-      <div className="w-full max-w-md space-y-3 animate-pulse motion-reduce:animate-none">
459-        <div className="flex justify-start">
460-          <div className="w-3/4 rounded-xl bg-zinc-200 dark:bg-zinc-800 p-3">
461-            <div className="h-2.5 w-11/12 rounded bg-zinc-300 dark:bg-zinc-700" />
462-          </div>
463-        </div>

exec
/bin/zsh -lc "sed -n '170,220p' frontend/src/lib/useChatStream.ts; sed -n '330,390p' frontend/src/lib/useChatStream.ts" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
      });
  }, [maxUserMessages]);

  const handleStreamError = useCallback((err: unknown) => {
    flushPendingText();
    setStreaming(false);
    abortRef.current = null;

    const { message, code, status } = getErrorMeta(err);

    if (isAbortLikeError(err)) {
      return;
    }

    if (
      status === 402
      || code === 'INSUFFICIENT_CREDITS'
      || code === 'MODE_NOT_ALLOWED'
      || code === 'PRO_MODE_LIMIT_REACHED'
      || code === 'BALANCED_MODE_LIMIT_REACHED'
      || code === 'DOMAIN_MODE_REQUIRES_PLUS'
    ) {
      const reason = code || 'paid_limit';
      // I27: previously hardcoded `plan: 'plus'`, which falsely attributed
      // every paywall event in the funnel to plus-upgrade intent regardless
      // of what triggered it (e.g. a Plus user hitting the Pro cap was logged
      // as a Plus-upgrade event). Derive the actual upgrade target from
      // (currentPlan, reason) so the upgrade-funnel analytics aren't poisoned.
      const upgradePlan = deriveUpgradePlan(currentPlan, reason);
      trackEvent('limit_hit', { source: 'chat_stream', reason, plan: upgradePlan, period: 'monthly' });
      trackEvent('paywall_opened', { source: 'chat_stream', reason, plan: upgradePlan, period: 'monthly' });
      onShowPaywall(reason);
      return;
    }

    if (status === 409 || code === 'DOCUMENT_PROCESSING') {
      addMessage({
        id: `m_${Date.now()}_proc`,
        role: 'assistant',
        text: t('doc.processing'),
        createdAt: Date.now(),
      });
      return;
    }

    if (
      status === 429
      || code === 'RATE_LIMITED'
      || code === 'DEMO_SESSION_RATE_LIMITED'
      || code === 'DEMO_MESSAGE_LIMIT_REACHED'
      || code === 'DEMO_SESSION_LIMIT_REACHED'
      locale,
      controller.signal,
      domainMode,
      (artifact) => addArtifactToLastMessage(artifact),
      ({ message }) => setLastMessageToolStatus(message),
      handleAnswerRepaired,
      handleCitationsRefined,
    );
  }, [sessionId, updateLastMessage, addCitationToLastMessage, addArtifactToLastMessage, setLastMessageToolStatus, handleStreamError, handleStreamDone, handleTruncated, handleAnswerRepaired, handleCitationsRefined, selectedMode, locale]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return false;

    if (demoLimitReached) {
      onRequireAuth();
      return false;
    }

    const userMsg: Message = {
      id: `m_${Date.now()}_u`,
      role: 'user',
      text,
      createdAt: Date.now(),
    };

    const asstMsg: Message = {
      id: `m_${Date.now()}_a`,
      role: 'assistant',
      text: '',
      citations: [],
      createdAt: Date.now(),
    };

    addMessage(userMsg);
    addMessage(asstMsg);
    // A new user message on this session is itself an accounting-relevant
    // event (it changes what localUserMsgCount will count) — bump so any
    // in-flight reanchorDemoCounter GET for this same session (e.g. from an
    // earlier failed regenerate/continue) recognizes its snapshot is now
    // stale and drops instead of overwriting this message's delta (Codex
    // r4). No-op for authenticated/non-demo sessions.
    if (maxUserMessages != null) useDocTalkStore.getState().bumpDemoAccountingEpoch();
    setStreaming(true);
    trackEvent('chat_message_sent', { source: 'chat_panel', mode: selectedMode });

    await streamAssistantResponse(text);
    return true;
  }, [isStreaming, demoLimitReached, onRequireAuth, addMessage, setStreaming, streamAssistantResponse, selectedMode, maxUserMessages]);

  // Regenerate/continue add no new user message locally (they resend/extend
  // an existing turn), but the backend increments demo quota on both — so
  // without this the UI would undercount relative to the server. Bumps
  // demoMessagesUsed directly (not the baseline, which only moves at
  // restore/create) and optimistically, before the stream starts — correct
  // whenever the server actually charges, which is the dominant case,
  // including an abort (streaming can only be aborted once the backend has
  // already started responding, so it plausibly already charged). No
  // rollback here on failure — see reanchorDemoCounter above: instead of
  // guessing whether a given failure means the server charged or not (r3:
  // that guess is unsafe — e.g. the continuation endpoint charges quota
  // BEFORE validating the message is still continuable, so a 404/400 there

exec
/bin/zsh -lc "rg -n \"DOCUMENT_LIMIT_REACHED|errorCopy\" frontend --glob '*test*' --glob '*spec*' --glob '*.{ts,tsx}'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
frontend/src/lib/errorCopy.ts:20:   * a latent trap for any future generic errorCopy() consumer that trusts
frontend/src/lib/errorCopy.ts:65:export function errorCopy(err: ErrorInput, t: TFn, tOr: TOrFn): ErrorCopy {
frontend/src/lib/errorCopy.ts:130:  DOCUMENT_LIMIT_REACHED: (d, tOr) => {
frontend/src/lib/errorCopy.ts:133:      title: tOr('errors.DOCUMENT_LIMIT_REACHED.title', 'Document limit reached'),
frontend/src/lib/errorCopy.ts:135:        ? tOr('errors.DOCUMENT_LIMIT_REACHED.body', 'You\'ve reached your plan\'s document limit ({limit}). Delete an old document or upgrade for more.', {
frontend/src/lib/errorCopy.ts:138:        : tOr('errors.DOCUMENT_LIMIT_REACHED.bodyTopTier', 'You\'ve reached your plan\'s document limit ({limit}). Delete a document to free up space.', {
frontend/src/lib/useChatStream.ts:9:import { errorCopy } from './errorCopy';
frontend/src/lib/useChatStream.ts:235:    const copy = errorCopy(err, t, tOr);
frontend/src/lib/useDocumentLoader.ts:5:import { errorCopy, parseWorkerErrorMsg } from './errorCopy';
frontend/src/lib/useDocumentLoader.ts:71:        const copy = errorCopy(e, t, tOr);
frontend/src/lib/useDocumentLoader.ts:98:            const copy = errorCopy({ code, detail: {} }, t, tOr);
frontend/src/lib/useDocumentLoader.ts:122:              const copy = errorCopy(e, t, tOr);
frontend/src/lib/useDocumentLoader.ts:138:              const copy = errorCopy(e, t, tOr);
frontend/src/components/CustomInstructionsModal.tsx:6:import { errorCopy } from '../lib/errorCopy';
frontend/src/components/CustomInstructionsModal.tsx:82:      const copy = errorCopy(e, t, tOr);
frontend/src/components/CustomInstructionsModal.tsx:98:      const copy = errorCopy(e, t, tOr);
frontend/src/components/Collections/CreateCollectionModal.tsx:9:import { errorCopy, type ErrorCopy } from '../../lib/errorCopy';
frontend/src/components/Collections/CreateCollectionModal.tsx:72:      const copy = errorCopy(e, t, tOr);
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:22:import { errorCopy, type ErrorCopy } from '../../../lib/errorCopy';
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:84:  const sessionErrorCopy = sessionError ? errorCopy(sessionError, t, tOr) : null;
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:205:        setLayoutTranslationError(errorCopy(err, t, tOr));
frontend/src/components/Chat/ChatPanel.tsx:19:import { errorCopy } from '../../lib/errorCopy';
frontend/src/components/Chat/ChatPanel.tsx:360:      const copy = errorCopy(e, t, tOr);
frontend/src/components/Chat/ChatPanel.tsx:407:      const copy = errorCopy(e, t, tOr);
frontend/src/components/Chat/ChatPanel.tsx:437:      const copy = errorCopy(e, t, tOr);
frontend/src/components/Chat/ChatArtifactCard.tsx:10:import { errorCopy, type ErrorCopy } from '../../lib/errorCopy';
frontend/src/components/Chat/ChatArtifactCard.tsx:297:      setLayoutImportError(errorCopy(err, t, tOr));
frontend/src/app/collections/[collectionId]/page.tsx:26:import { errorCopy, type ErrorCopy } from '../../../lib/errorCopy';
frontend/src/app/collections/[collectionId]/page.tsx:187:      const copy = errorCopy(e, t, tOr);
frontend/src/components/SessionDropdown.tsx:10:import { errorCopy, type ErrorCopy } from '../lib/errorCopy';
frontend/src/components/SessionDropdown.tsx:92:      const copy = errorCopy(e, t, tOr);
frontend/src/components/Quotes/QuoteFinderPanel.tsx:12:import { errorCopy } from '../../lib/errorCopy';
frontend/src/components/Quotes/QuoteFinderPanel.tsx:151:        const copy = errorCopy(err, t, tOr);
frontend/src/components/Quotes/QuoteFinderPanel.tsx:214:        const copy = errorCopy(err, t, tOr);
frontend/src/components/dashboard/DashboardPageClient.tsx:19:import { errorCopy, type ErrorCopy } from '../../lib/errorCopy';
frontend/src/components/dashboard/DashboardPageClient.tsx:301:      const copy = errorCopy(e, t, tOr);
frontend/src/components/dashboard/DashboardPageClient.tsx:344:      const copy = errorCopy(e, t, tOr);

exec
/bin/zsh -lc "rg -n -C 4 \"AsyncSessionLocal|expire_on_commit\" backend/app/core backend/app --glob '*.py'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
backend/app/core/deps.py-8-from sqlalchemy.ext.asyncio import AsyncSession
backend/app/core/deps.py-9-
backend/app/core/deps.py-10-from app.core.config import settings
backend/app/core/deps.py-11-from app.core.security_log import log_security_event
backend/app/core/deps.py:12:from app.models.database import AsyncSessionLocal
backend/app/core/deps.py-13-from app.models.tables import User
backend/app/core/deps.py-14-
backend/app/core/deps.py-15-logger = logging.getLogger(__name__)
backend/app/core/deps.py-16-
backend/app/core/deps.py-17-
backend/app/core/deps.py-18-async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
backend/app/core/deps.py-19-    """Provide an async SQLAlchemy session for FastAPI dependencies."""
backend/app/core/deps.py:20:    async with AsyncSessionLocal() as session:  # type: AsyncSession
backend/app/core/deps.py-21-        yield session
backend/app/core/deps.py-22-
backend/app/core/deps.py-23-
backend/app/core/deps.py-24-async def get_current_user_optional(
--
backend/app/services/chat_service.py-15-from sqlalchemy.ext.asyncio import AsyncSession
backend/app/services/chat_service.py-16-
backend/app/services/chat_service.py-17-from app.core.config import settings
backend/app/services/chat_service.py-18-from app.core.model_profiles import get_model_profile, get_rules_for_model
backend/app/services/chat_service.py:19:from app.models.database import AsyncSessionLocal
backend/app/services/chat_service.py-20-from app.models.tables import (
backend/app/services/chat_service.py-21-    ChatSession,
backend/app/services/chat_service.py-22-    Chunk,
backend/app/services/chat_service.py-23-    CreditLedger,
--
backend/app/services/chat_service.py-843-    text = assistant_text.strip()
backend/app/services/chat_service.py-844-    if not text:
backend/app/services/chat_service.py-845-        return None
backend/app/services/chat_service.py-846-
backend/app/services/chat_service.py:847:    async with AsyncSessionLocal() as persist_db:
backend/app/services/chat_service.py-848-        asst_msg = Message(
backend/app/services/chat_service.py-849-            session_id=session_id,
backend/app/services/chat_service.py-850-            role="assistant",
backend/app/services/chat_service.py-851-            content=text,
--
backend/app/services/chat_service.py-867-) -> bool:
backend/app/services/chat_service.py-868-    if not continuation_text.strip():
backend/app/services/chat_service.py-869-        return False
backend/app/services/chat_service.py-870-
backend/app/services/chat_service.py:871:    async with AsyncSessionLocal() as persist_db:
backend/app/services/chat_service.py-872-        asst_msg = await persist_db.get(Message, message_id)
backend/app/services/chat_service.py-873-        if not asst_msg or asst_msg.role != "assistant":
backend/app/services/chat_service.py-874-            return False
backend/app/services/chat_service.py-875-
--
backend/app/services/chat_service.py-892-    output_tokens: Optional[int],
backend/app/services/chat_service.py-893-    model: str,
backend/app/services/chat_service.py-894-    mode: str,
backend/app/services/chat_service.py-895-) -> None:
backend/app/services/chat_service.py:896:    async with AsyncSessionLocal() as settle_db:
backend/app/services/chat_service.py-897-        if has_answer:
backend/app/services/chat_service.py-898-            actual_cost = credit_service.calculate_cost(
backend/app/services/chat_service.py-899-                int(prompt_tokens or 0),
backend/app/services/chat_service.py-900-                int(output_tokens or 0),
--
backend/app/services/chat_service.py-939-    respond accordingly.
backend/app/services/chat_service.py-940-
backend/app/services/chat_service.py-941-    use_independent_session=True (CancelledError): the request's own `db`
backend/app/services/chat_service.py-942-    session may not be usable mid-cancellation — settle via a fresh
backend/app/services/chat_service.py:943:    AsyncSessionLocal(), matching every other cancel-path settler in this
backend/app/services/chat_service.py-944-    file.
backend/app/services/chat_service.py-945-    use_independent_session=False (ordinary exception): reuses the
backend/app/services/chat_service.py-946-    request's own `db` (rolled back first, inside _refund_predebit) —
backend/app/services/chat_service.py-947-    matches the existing pattern for non-cancellation failures elsewhere.
backend/app/services/chat_service.py-948-    """
backend/app/services/chat_service.py-949-    if use_independent_session:
backend/app/services/chat_service.py:950:        async with AsyncSessionLocal() as settle_db:
backend/app/services/chat_service.py-951-            return await _refund_predebit(settle_db, user_id, pre_debited, predebit_ledger_id)
backend/app/services/chat_service.py-952-    assert db is not None
backend/app/services/chat_service.py-953-    return await _refund_predebit(db, user_id, pre_debited, predebit_ledger_id)
backend/app/services/chat_service.py-954-
--
backend/app/services/saved_quotes_service.py-21-from sqlalchemy.ext.asyncio import AsyncSession
backend/app/services/saved_quotes_service.py-22-from sqlalchemy.orm import selectinload
backend/app/services/saved_quotes_service.py-23-
backend/app/services/saved_quotes_service.py-24-from app.core.config import settings
backend/app/services/saved_quotes_service.py:25:from app.models.database import AsyncSessionLocal
backend/app/services/saved_quotes_service.py-26-from app.models.tables import Document, SavedQuote, User
backend/app/services/saved_quotes_service.py-27-from app.services.quote_search_service import QuoteCard
backend/app/services/saved_quotes_service.py-28-from app.services.quote_verification_service import QUOTE_VERIFIER_VERSION
backend/app/services/saved_quotes_service.py-29-from app.services.text_normalizer import normalize
--
backend/app/services/saved_quotes_service.py-126-    CRITICAL: every return path below explicitly commits (the lock is
backend/app/services/saved_quotes_service.py-127-    released when ITS transaction ends, so leaving one open would hold the
backend/app/services/saved_quotes_service.py-128-    lock — and block every other concurrent save for this user — for the
backend/app/services/saved_quotes_service.py-129-    rest of the request). Deliberately commits rather than rolls back even
backend/app/services/saved_quotes_service.py:130:    on a no-write decision (idempotent hit, cap reached): `expire_on_commit
backend/app/services/saved_quotes_service.py-131-    =False` (app/models/database.py) means a commit does NOT expire
backend/app/services/saved_quotes_service.py-132-    `document` or any row already loaded in this session, so the caller's
backend/app/services/saved_quotes_service.py-133-    later SYNCHRONOUS reads (response serialization) stay safe — a
backend/app/services/saved_quotes_service.py-134-    rollback here would expire those objects and reintroduce the exact
backend/app/services/saved_quotes_service.py-135-    MissingGreenlet class already fixed for the PATCH endpoint.
backend/app/services/saved_quotes_service.py-136-
backend/app/services/saved_quotes_service.py-137-    SELECT-then-INSERT + IntegrityError-retry (same race biblio_service's
backend/app/services/saved_quotes_service.py-138-    FIX-9 precedent handles, for a genuinely simultaneous identical save)
backend/app/services/saved_quotes_service.py:139:    retries on a FRESH AsyncSessionLocal() session, not the just-rolled-
backend/app/services/saved_quotes_service.py-140-    back `db` — see the prior real-concurrency finding in this function's
backend/app/services/saved_quotes_service.py-141-    git history for why (NullPool-specific async/greenlet interaction
backend/app/services/saved_quotes_service.py-142-    under true concurrent load; a production QueuePool-backed engine does
backend/app/services/saved_quotes_service.py-143-    not exhibit it).
--
backend/app/services/saved_quotes_service.py-187-    try:
backend/app/services/saved_quotes_service.py-188-        await db.commit()
backend/app/services/saved_quotes_service.py-189-    except IntegrityError:
backend/app/services/saved_quotes_service.py-190-        await db.rollback()
backend/app/services/saved_quotes_service.py:191:        async with AsyncSessionLocal() as retry_db:
backend/app/services/saved_quotes_service.py-192-            winner = await get_existing_saved_quote(
backend/app/services/saved_quotes_service.py-193-                retry_db, user_id=user.id, document_id=document.id, quote_hash=quote_hash
backend/app/services/saved_quotes_service.py-194-            )
backend/app/services/saved_quotes_service.py-195-        if winner is None:
--
backend/app/main.py-33-from .api.tables import router as tables_router
backend/app/main.py-34-from .api.users import router as users_router
backend/app/main.py-35-from .core.config import settings
backend/app/main.py-36-from .core.version import get_product_version, get_release_payload
backend/app/main.py:37:from .models.database import AsyncSessionLocal
backend/app/main.py-38-from .schemas.common import HealthDeepResponse, HealthResponse, ReleaseInfo
backend/app/main.py-39-from .services.embedding_service import embedding_service
backend/app/main.py-40-from .services.storage_service import storage_service
backend/app/main.py-41-
--
backend/app/main.py-229-        "minio": {"status": "ok"},
backend/app/main.py-230-    }
backend/app/main.py-231-
backend/app/main.py-232-    async def _check_db() -> None:
backend/app/main.py:233:        async with AsyncSessionLocal() as db:
backend/app/main.py-234-            await db.execute(text("SELECT 1"))
backend/app/main.py-235-
backend/app/main.py-236-    async def _check_redis() -> None:
backend/app/main.py-237-        import redis.asyncio as redis
--
backend/app/core/deps.py-8-from sqlalchemy.ext.asyncio import AsyncSession
backend/app/core/deps.py-9-
backend/app/core/deps.py-10-from app.core.config import settings
backend/app/core/deps.py-11-from app.core.security_log import log_security_event
backend/app/core/deps.py:12:from app.models.database import AsyncSessionLocal
backend/app/core/deps.py-13-from app.models.tables import User
backend/app/core/deps.py-14-
backend/app/core/deps.py-15-logger = logging.getLogger(__name__)
backend/app/core/deps.py-16-
backend/app/core/deps.py-17-
backend/app/core/deps.py-18-async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
backend/app/core/deps.py-19-    """Provide an async SQLAlchemy session for FastAPI dependencies."""
backend/app/core/deps.py:20:    async with AsyncSessionLocal() as session:  # type: AsyncSession
backend/app/core/deps.py-21-        yield session
backend/app/core/deps.py-22-
backend/app/core/deps.py-23-
backend/app/core/deps.py-24-async def get_current_user_optional(
--
backend/app/models/database.py-16-        raise RuntimeError("DATABASE_URL is not configured")
backend/app/models/database.py-17-    return url
backend/app/models/database.py-18-
backend/app/models/database.py-19-
backend/app/models/database.py:20:# Create async engine and sessionmaker (expire_on_commit=False for FastAPI typical usage)
backend/app/models/database.py-21-DATABASE_URL = _get_database_url()
backend/app/models/database.py-22-engine_kwargs: dict[str, object] = {"pool_pre_ping": True}
backend/app/models/database.py-23-
backend/app/models/database.py-24-if os.getenv("TESTING") == "1":
--
backend/app/models/database.py-30-        pool_recycle=1800,
backend/app/models/database.py-31-    )
backend/app/models/database.py-32-
backend/app/models/database.py-33-async_engine: AsyncEngine = create_async_engine(DATABASE_URL, **engine_kwargs)
backend/app/models/database.py:34:AsyncSessionLocal = async_sessionmaker(async_engine, expire_on_commit=False)
--
backend/app/models/sync_database.py-29-SYNC_DATABASE_URL = _get_sync_database_url()
backend/app/models/sync_database.py-30-
backend/app/models/sync_database.py-31-# Create sync engine / sessionmaker for Celery workers
backend/app/models/sync_database.py-32-sync_engine: Engine = create_engine(SYNC_DATABASE_URL, pool_pre_ping=True, future=True)
backend/app/models/sync_database.py:33:SyncSessionLocal = sessionmaker(bind=sync_engine, autoflush=False, autocommit=False, expire_on_commit=False, class_=Session)
backend/app/models/sync_database.py-34-
--
backend/app/api/quotes.py-14-from sqlalchemy.ext.asyncio import AsyncSession
backend/app/api/quotes.py-15-
backend/app/api/quotes.py-16-from app.core.deps import get_db_session, require_auth
backend/app/api/quotes.py-17-from app.core.rate_limit import auth_chat_limiter
backend/app/api/quotes.py:18:from app.models.database import AsyncSessionLocal
backend/app/api/quotes.py-19-from app.models.tables import (
backend/app/api/quotes.py-20-    CreditLedger,
backend/app/api/quotes.py-21-    Document,
backend/app/api/quotes.py-22-    ProductEvent,
--
backend/app/api/quotes.py-153-    whether a refund actually happened.
backend/app/api/quotes.py-154-
backend/app/api/quotes.py-155-    use_independent_session=True (CancelledError): the request's own `db`
backend/app/api/quotes.py-156-    session may not be usable mid-cancellation — settle via a fresh
backend/app/api/quotes.py:157:    AsyncSessionLocal(), shielded from the cancellation being handled.
backend/app/api/quotes.py-158-    use_independent_session=False (ordinary exception): reuses the
backend/app/api/quotes.py-159-    request's own `db` (rolled back first by the caller) — matches the
backend/app/api/quotes.py-160-    existing pattern for non-cancellation failures.
backend/app/api/quotes.py-161-    """
backend/app/api/quotes.py-162-    if use_independent_session:
backend/app/api/quotes.py:163:        async with AsyncSessionLocal() as settle_db:
backend/app/api/quotes.py-164-            return await _refund_predebit(settle_db, user_id, pre_debited, ledger_id)
backend/app/api/quotes.py-165-    assert db is not None
backend/app/api/quotes.py-166-    return await _refund_predebit(db, user_id, pre_debited, ledger_id)
backend/app/api/quotes.py-167-

exec
/bin/zsh -lc 'git diff --check e499bc7..HEAD -- backend/app/services/chat_service.py backend/tests/test_quote_intent_routing.py frontend/src/lib/errorCopy.ts frontend/src/i18n/locales' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
exec
/bin/zsh -lc "cd frontend && node -e 'const fs=require(\"fs\"); const files=[\"en\",\"zh\",\"ja\",\"ko\",\"es\",\"de\",\"fr\",\"pt\",\"it\",\"ar\",\"hi\"].map(x=>"'`src/i18n/locales/${x}.json`); for(const f of files){const j=JSON.parse(fs.readFileSync(f,"utf8")); if(typeof j["errors.DOCUMENT_LIMIT_REACHED.bodyTopTier"]!=="string"||!j["errors.DOCUMENT_LIMIT_REACHED.bodyTopTier"].includes("{limit}")) throw Error(f)} console.log(`validated ${files.length} locale keys`)'"'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
validated 11 locale keys

exec
/bin/zsh -lc 'cd backend && python3 -m pytest tests/test_quote_intent_routing.py::TestDomainModeSyncOnEarlyReturnPaths -q' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 1452ms:
..                                                                       [100%]
=============================== warnings summary ===============================
../../../../Library/Python/3.9/lib/python/site-packages/urllib3/__init__.py:35
  /Users/mayijie/Library/Python/3.9/lib/python/site-packages/urllib3/__init__.py:35: NotOpenSSLWarning: urllib3 v2 only supports OpenSSL 1.1.1+, currently the 'ssl' module is compiled with 'LibreSSL 2.8.3'. See: https://github.com/urllib3/urllib3/issues/3020
    warnings.warn(

<frozen importlib._bootstrap>:228
<frozen importlib._bootstrap>:228
  <frozen importlib._bootstrap>:228: DeprecationWarning: builtin type SwigPyPacked has no __module__ attribute

<frozen importlib._bootstrap>:228
<frozen importlib._bootstrap>:228
  <frozen importlib._bootstrap>:228: DeprecationWarning: builtin type SwigPyObject has no __module__ attribute

<frozen importlib._bootstrap>:228
  <frozen importlib._bootstrap>:228: DeprecationWarning: builtin type swigvarlink has no __module__ attribute

-- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
2 passed, 6 warnings in 0.88s
sys:1: DeprecationWarning: builtin type swigvarlink has no __module__ attribute

exec
/bin/zsh -lc "sed -n '1,180p' backend/tests/test_quote_intent_routing.py" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
"""Tests for strict verbatim-quote chat-intent routing (B5, plan §8.4.3).

Two layers:
1. `action_planner.deterministic_plan` — the STRICT matcher (SEPARATE from the
   broad `_CITATION_RE`) must fire only on unambiguous direct-quote requests
   ("direct quote", "verbatim", "quote ... with page", 逐字引用, cita textual,
   ...) and NEVER on ordinary citation-quality questions ("where is this
   discussed", "what page is this on", bare "quote"/"source").
2. `chat_service.chat_stream` routing — when the strict intent fires in an
   AUTHED, non-demo, single-document session, the chat pipeline runs B3's
   verified quote_search instead of the normal LLM answer, bills through the
   SAME chat predebit/reconcile (no double-billing), and emits cards as a
   chat artifact + an honest empty-result message. Anonymous, demo, and
   collection sessions fall through to the untouched normal chat path even
   when the strict matcher fires.
"""
from __future__ import annotations

import asyncio
import sys
import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import app.services.chat_service as chat_service_module  # noqa: E402
from app.models.tables import ChatSession, Document, Message  # noqa: E402
from app.services.action_planner import ChatAction, deterministic_plan  # noqa: E402
from app.services.query_router import QueryIntent  # noqa: E402
from app.services.quote_search_service import QuoteCard, QuoteSearchResult  # noqa: E402

# ---------------------------------------------------------------------------
# Layer 1: strict matcher (pure, no DB/LLM)
# ---------------------------------------------------------------------------

class TestStrictQuoteMatcherPositives:
    @pytest.mark.parametrize(
        "message",
        [
            "Give me a direct quote about climate risk.",
            "I need the exact quotation on liability.",
            "Quote the clause verbatim.",
            "Can you quote the definition of force majeure, with the page number?",
            "What does it say word for word about termination?",
            "逐字引用一下关于责任的条款",
            "请给出原文引用，并注明页码",
            "这段话一字不差地是怎么写的？",
            "Necesito una cita textual sobre el riesgo climático.",
            "Copia tal cual la cláusula de fuerza mayor.",
            "¿Qué dice textualmente sobre la terminación?",
        ],
    )
    def test_strict_patterns_route_to_verified_quote_search(self, message: str) -> None:
        plan = deterministic_plan(message)
        assert plan.action == ChatAction.VERIFIED_QUOTE_SEARCH
        assert plan.confidence >= 0.78  # bypasses the LLM re-classification


class TestStrictQuoteMatcherNegatives:
    @pytest.mark.parametrize(
        "message",
        [
            "Where is this discussed in the document?",
            "What page is this on?",
            "What's the source for this claim?",
            "Can you cite where you got that?",
            "在哪页提到了这个？",
            "这个信息的出处是什么？",
            "Quote me a price for this service.",  # bare "quote", not a verbatim-text request
            "What is the citation format used here?",
            # ES: review round 1 SHOULD-FIX-1 — the un-anchored alternation
            # false-matched these ordinary interpretive questions before the
            # \b word-boundary fix ("textualmente" inside "Contextualmente",
            # "cita textual" inside "cita textualidad").
            "Contextualmente, ¿qué significa esto?",
            "Según cita textualidad del informe",
            "cita esta fuente, por favor",
            "¿Cuál es la fuente de esta cita?",
        ],
    )
    def test_broad_citation_language_does_not_trigger_strict_routing(self, message: str) -> None:
        plan = deterministic_plan(message)
        assert plan.action != ChatAction.VERIFIED_QUOTE_SEARCH


class TestStrictQuoteMatcherNegationAndMetalinguisticGuards:
    """FIX-5 (Codex r1 IMPORTANT #5): the matcher detected vocabulary, not
    affirmative intent — these five Codex r1 probes all incorrectly routed
    to the billed Quote Finder before this fix. A negation ("don't", "should
    not", "不要") or metalinguistic use ("translate the phrase X", "what does
    X mean", "qué significa") near the trigger word must suppress routing."""

    @pytest.mark.parametrize(
        "message",
        [
            "Don't quote this verbatim—explain it.",
            "The answer should not be a direct quote; summarize it.",
            "Translate the phrase exact quotation into Spanish.",
            "¿Qué significa la palabra textualmente?",
            "不要原文引用，请总结。",
        ],
    )
    def test_codex_r1_probes_do_not_route_to_quote_search(self, message: str) -> None:
        plan = deterministic_plan(message)
        assert plan.action != ChatAction.VERIFIED_QUOTE_SEARCH

    @pytest.mark.parametrize(
        "message",
        [
            "Give me a direct quote about the termination clause.",
            "Quote the clause verbatim.",
            "逐字引用一下关于责任的条款",
            "Necesito una cita textual sobre el riesgo climático.",
        ],
    )
    def test_affirmative_forms_still_route(self, message: str) -> None:
        """The guards must not be so broad they suppress genuine requests —
        none of these contain a negation or metalinguistic marker."""
        plan = deterministic_plan(message)
        assert plan.action == ChatAction.VERIFIED_QUOTE_SEARCH


class TestQuoteFinderDeterministicSafeRoutingPolicy:
    """FIX3-B (Codex r3 #5 + New Breakage #1, NOT ADDRESSED): FIX2-C's
    distance heuristic (negation governs whichever of the trigger/paraphrase-
    token is closer) still misrouted on coordinated predicates, clause
    boundaries, and a negated metalinguistic action followed by an
    affirmative quote request — and introduced NEW coordinated-negation
    false positives of its own (r3's "New Breakage #1"). Replaced entirely
    with a DETERMINISTIC-SAFE policy: route to the billed verified
    quote-search pipeline ONLY when the strict trigger matches AND the
    message contains ZERO negation/metalinguistic tokens ANYWHERE
    (whole-message presence, never proximity, never "which target"). Any
    negation/metalinguistic token present alongside a trigger match means
    NO auto-route — the ordinary RAG/citation path runs instead, carrying
    quote_finder_hint=True (+ the message as quote_finder_hint_topic) so
    the frontend can offer a manual "Try Quote Finder" chip. Asymmetric
    loss: a false positive costs money + a wrong/unverified answer; a
    false negative costs one click on a chip — so even r2's genuinely
    affirmative "without paraphrasing"-style probes now deliberately do
    NOT auto-route; they get the chip, never silence, never a blind bill."""

    @pytest.mark.parametrize(
        "message",
        [
            "Give me a direct quote about the termination clause.",
            "Quote the clause verbatim.",
            "逐字引用一下关于责任的条款",
            "Necesito una cita textual sobre el riesgo climático.",
        ],
    )
    def test_affirmative_no_negation_routes_and_carries_no_hint(self, message: str) -> None:
        plan = deterministic_plan(message)
        assert plan.action == ChatAction.VERIFIED_QUOTE_SEARCH
        assert plan.quote_finder_hint is False
        assert plan.quote_finder_hint_topic is None

    @pytest.mark.parametrize(
        "message",
        [
            # r1's original 5 negatives.
            "Don't quote this verbatim—explain it.",
            "The answer should not be a direct quote; summarize it.",
            "Translate the phrase exact quotation into Spanish.",
            "¿Qué significa la palabra textualmente?",
            "不要原文引用，请总结。",
            # r2's 4 probes — genuinely affirmative requests that FIX2-C
            # used to correctly route; FIX3-B deliberately no longer
            # auto-routes them (asymmetric-loss trade-off).
            "Give me a direct quote, without paraphrasing.",
            "Never paraphrase; quote the clause verbatim.",
            "不要总结，请逐字引用责任条款。",
            "No la parafrasees; necesito una cita textual.",
            # r3's 6 adversarial probes.

exec
/bin/zsh -lc "git show e499bc7:backend/app/services/chat_service.py | nl -ba | sed -n '2035,2105p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
  2035	                    "data-boundary, source-location, citation, language, or safety rules above:\n"
  2036	                    + doc.custom_instructions + "\n"
  2037	                )
  2038	
  2039	            # Inject domain-specific rules (legal/academic mode overlay)
  2040	            # Frontend always sends domain_mode: null (default) or "legal"/"academic"
  2041	            # domain_mode=None means Default (no extra rules), string means apply rules
  2042	            if domain_mode:
  2043	                from app.core.model_profiles import DOMAIN_RULES
  2044	                domain_rules = DOMAIN_RULES.get(domain_mode)
  2045	                if domain_rules:
  2046	                    base_rule_count = len(rules.strip().split('\n'))
  2047	                    domain_rules_text = f"\n\n## {domain_mode.title()} Mode Rules\n"
  2048	                    for i, rule in enumerate(domain_rules, start=base_rule_count + 1):
  2049	                        domain_rules_text += f"{i}. {rule}\n"
  2050	                    system_prompt += domain_rules_text
  2051	
  2052	            # Global contracts appended to EVERY branch: source-location grounding (#1)
  2053	            # + user-facing terminology guard (#4). (Consensus R2a.)
  2054	            system_prompt += _source_location_contract() + _output_terminology_contract()
  2055	
  2056	            # Persist domain_mode to session (null clears, string sets)
  2057	            if domain_mode != session_obj.domain_mode:
  2058	                session_obj.domain_mode = domain_mode
  2059	                await db.commit()
  2060	
  2061	        except asyncio.CancelledError:
  2062	            if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
  2063	                try:
  2064	                    with anyio.CancelScope(shield=True):
  2065	                        await asyncio.wait_for(
  2066	                            _settle_predebit_on_cancel(
  2067	                                user_id=user.id,
  2068	                                pre_debited=pre_debited,
  2069	                                predebit_ledger_id=predebit_ledger_id,
  2070	                                has_answer=False,
  2071	                                prompt_tokens=None,
  2072	                                output_tokens=None,
  2073	                                model=effective_model,
  2074	                                mode=effective_mode,
  2075	                            ),
  2076	                            timeout=_CANCEL_IO_TIMEOUT_S,
  2077	                        )
  2078	                    settled = True
  2079	                except Exception:
  2080	                    logger.exception(
  2081	                        "Failed to settle pre-debit during chat setup cancellation for user %s",
  2082	                        user.id,
  2083	                    )
  2084	            raise
  2085	        except Exception as e:
  2086	            # FIX3-A(d) (Codex r3 #4, NOT ADDRESSED): this handler now also
  2087	            # checks `not settled` — previously it was the ONE generic
  2088	            # exception handler in this function that did NOT, so an
  2089	            # ordinary exception escaping the strict quote route's own
  2090	            # (already-settled) failure handling above would reach here and
  2091	            # attempt a SECOND, blind settlement. _refund_predebit's
  2092	            # conditional delete (FIX3-A(c)) makes a second attempt safe on
  2093	            # its own, but per Codex's prescription a resolver's decision
  2094	            # must never be second-guessed by an unconditional fallback —
  2095	            # the guard belongs here structurally, not just as a side
  2096	            # effect of the delete being idempotent.
  2097	            if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
  2098	                try:
  2099	                    await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
  2100	                    settled = True
  2101	                except Exception:
  2102	                    logger.exception(
  2103	                        "Failed to refund pre-debited credits during chat setup failure for user %s",
  2104	                        user.id,
  2105	                    )

exec
/bin/zsh -lc "git show e499bc7:backend/app/services/chat_service.py | nl -ba | sed -n '1560,1635p'; git show e499bc7:backend/app/services/chat_service.py | nl -ba | sed -n '1780,1820p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
  1560	        effective_model = settings.MODE_MODELS[effective_mode]
  1561	
  1562	        # Force demo model for anonymous users on demo documents
  1563	        if user is None and doc and doc.demo_slug:
  1564	            effective_model = settings.DEMO_LLM_MODEL
  1565	            effective_mode = "quick"
  1566	
  1567	        # Premium mode gating: require Plus or Pro plan
  1568	        if effective_mode in settings.PREMIUM_MODES:
  1569	            user_plan = (user.plan or "free").lower() if user else "free"
  1570	            if user_plan == "free":
  1571	                yield sse(
  1572	                    "error",
  1573	                    {
  1574	                        "code": "MODE_NOT_ALLOWED",
  1575	                        "message": "Upgrade to Plus to use this mode",
  1576	                        "required_plan": "plus",
  1577	                    },
  1578	                )
  1579	                return
  1580	
  1581	        action_plan = await action_planner.plan(
  1582	            user_message,
  1583	            is_collection=is_collection_session,
  1584	            locale=locale,
  1585	        )
  1586	        if not action_plan.uses_rag_answer_path:
  1587	            async for ev in self._tool_action_stream(
  1588	                session_id=session_id,
  1589	                user_message=user_message,
  1590	                db=db,
  1591	                user=user,
  1592	                locale=locale,
  1593	                domain_mode=domain_mode,
  1594	                document_id=document_id,
  1595	                collection_doc_ids=collection_doc_ids,
  1596	                action_plan=action_plan,
  1597	            ):
  1598	                yield ev
  1599	            return
  1600	
  1601	        query_route = query_router.route(
  1602	            user_message,
  1603	            is_collection=is_collection_session,
  1604	            domain_mode=domain_mode,
  1605	        )
  1606	
  1607	        # Pre-debit estimated credits BEFORE streaming (prevents TOCTOU + free rides)
  1608	        pre_debited = 0
  1609	        predebit_ledger_id = None
  1610	        strict_quote_routed = _is_strict_quote_routed(
  1611	            action_plan, user=user, document_id=document_id,
  1612	            is_collection_session=is_collection_session, doc=doc,
  1613	        )
  1614	        if user is not None:
  1615	            # FIX-3 (Codex r1 BLOCKER #3): a strict-routed message ALWAYS
  1616	            # runs the balanced-model quote engine regardless of the
  1617	            # user-selected chat mode — predebit must reflect that real
  1618	            # cost, not `effective_mode`'s (e.g. quick=5), or a low-balance
  1619	            # user could reserve too little and reconciliation would push
  1620	            # their account negative to cover the overrun.
  1621	            estimated = (
  1622	                credit_service.get_estimated_cost("balanced")
  1623	                if strict_quote_routed
  1624	                else credit_service.get_estimated_cost(effective_mode)
  1625	            )
  1626	            if query_route.primary_intent == QueryIntent.DOCUMENT_SUMMARY:
  1627	                estimated = max(estimated, estimated * 2)
  1628	            predebit_ledger_id = await credit_service.debit_credits(
  1629	                db, user_id=user.id, cost=estimated,
  1630	                reason="chat", ref_type="mode", ref_id="balanced" if strict_quote_routed else effective_mode,
  1631	            )
  1632	            if predebit_ledger_id:
  1633	                pre_debited = estimated
  1634	                await db.commit()
  1635	            else:
  1780	                if outcome.artifact_payload:
  1781	                    yield sse("artifact", outcome.artifact_payload)
  1782	                yield sse("token", {"text": outcome.assistant_text})
  1783	                yield sse(
  1784	                    "done",
  1785	                    {
  1786	                        "message_id": str(outcome.message_id),
  1787	                        "citations_count": len(outcome.citations),
  1788	                        "verification": None,
  1789	                        "can_continue": False,
  1790	                        "continuation_count": 0,
  1791	                        "artifact_count": 1 if outcome.artifact_payload else 0,
  1792	                    },
  1793	                )
  1794	                return
  1795	
  1796	            # 3) Load history (last N*2 messages before current user msg)
  1797	            max_turns = int(settings.MAX_CHAT_HISTORY_TURNS or 6)
  1798	            max_msgs = max_turns * 2
  1799	            msgs_row = await db.execute(
  1800	                select(Message)
  1801	                .where(Message.session_id == session_id)
  1802	                .order_by(Message.created_at.desc())
  1803	                .limit(max_msgs + 1)
  1804	            )
  1805	            history_msgs: List[Message] = list(msgs_row.scalars().all())
  1806	            history_msgs.reverse()  # back to chronological order
  1807	
  1808	            # Convert to Claude message format (excluding system)
  1809	            claude_messages: List[dict] = []
  1810	            for m in history_msgs:
  1811	                claude_messages.append({"role": m.role, "content": m.content})
  1812	
  1813	            # 4) Route + retrieval (with error handling — e.g. Qdrant down or no vectors yet).
  1814	            # Whole-document summaries must not use ordinary semantic top-k: vague
  1815	            # summary prompts frequently retrieve tables/appendices instead of
  1816	            # representative document structure. Route them to an ordered context
  1817	            # selector until the durable hierarchical brief index lands.
  1818	            setup_error_code = "RETRIEVAL_ERROR"
  1819	            retrieval_strategy = "semantic_top_k"
  1820	            retrieval_evaluation = None

exec
/bin/zsh -lc "git diff --numstat e499bc7..HEAD -- ':"'!.collab/**'"' ':"'!**/*.md'"' && git log --oneline --no-decorate ba8a141..HEAD -- ':"'!.collab/**'"' ':"'!**/*.md'"' | sed -n '1,120p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
39	4	backend/app/services/chat_service.py
102	0	backend/tests/test_quote_intent_routing.py
1	0	frontend/src/i18n/locales/ar.json
1	0	frontend/src/i18n/locales/de.json
1	0	frontend/src/i18n/locales/en.json
1	0	frontend/src/i18n/locales/es.json
1	0	frontend/src/i18n/locales/fr.json
1	0	frontend/src/i18n/locales/hi.json
1	0	frontend/src/i18n/locales/it.json
1	0	frontend/src/i18n/locales/ja.json
1	0	frontend/src/i18n/locales/ko.json
1	0	frontend/src/i18n/locales/pt.json
1	0	frontend/src/i18n/locales/zh.json
41	8	frontend/src/lib/errorCopy.ts
2d4e01a fix(chat): sync persisted domain_mode on ALL successful early returns
bb79453 fix: Pro-tier document cap dead-end + openPaywall comment accuracy (Codex P1)
1fab067 fix: drop stray openPaywall on DOMAIN_MODE_REQUIRES_PLUS, fix rule doc
1a2dcc8 feat: add DOMAIN_MODE_REQUIRES_PLUS upgrade path (chat + REST extraction)
28c0977 fix: surface DOCUMENT_LIMIT_REACHED upgrade CTA in layout-translation import
78f660b fix: surface DOCUMENT_LIMIT_REACHED upgrade CTA in layout-translation submit
4cd4c8a fix: surface SHARE_LIMIT_REACHED upgrade CTA in chat share errors
ef7e798 fix(extractions): gate domain_mode as Plus+ (P1 hygiene, second entry point)
b6da842 fix(chat): backend-gate domain_mode as a Plus+ feature (P1 hygiene)

exec
/bin/zsh -lc 'rg -n "def _make_db|def _base_session_and_doc|class _ScalarOneResult|def _quote_action_plan" backend/tests/test_quote_intent_routing.py' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
266:class _ScalarOneResult:
306:def _make_db(session_obj, doc_obj, *, execute_side_effect=None):
334:def _quote_action_plan():
346:def _base_session_and_doc(document_id, session_id, *, demo_slug=None):

exec
/bin/zsh -lc "sed -n '275,380p' backend/tests/test_quote_intent_routing.py" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
    def __init__(self, messages):
        self._messages = messages

    def scalars(self):
        return SimpleNamespace(all=lambda: self._messages)


class _FakeChoice:
    def __init__(self, content=None, finish_reason=None):
        self.delta = SimpleNamespace(content=content)
        self.finish_reason = finish_reason


class _FakeChunk:
    def __init__(self, content=None, *, finish_reason=None, usage=None):
        self.choices = [_FakeChoice(content=content, finish_reason=finish_reason)]
        self.usage = usage


class _FakeStream:
    def __init__(self, chunks):
        self._chunks = chunks

    def __aiter__(self):
        return self._iterate()

    async def _iterate(self):
        for chunk in self._chunks:
            yield chunk


def _make_db(session_obj, doc_obj, *, execute_side_effect=None):
    async def fake_get(model, _id):
        if model is Document:
            return doc_obj
        if model is ChatSession:
            return session_obj
        return None

    added: list[object] = []

    def add(obj):
        if isinstance(obj, Message):
            if getattr(obj, "id", None) is None:
                obj.id = uuid.uuid4()
            if getattr(obj, "continuation_count", None) is None:
                obj.continuation_count = 0
        added.append(obj)

    return SimpleNamespace(
        execute=AsyncMock(side_effect=execute_side_effect or []),
        get=AsyncMock(side_effect=fake_get),
        add=add,
        added=added,
        commit=AsyncMock(),
        rollback=AsyncMock(),
    )


def _quote_action_plan():
    return SimpleNamespace(
        action=ChatAction.VERIFIED_QUOTE_SEARCH,
        uses_rag_answer_path=True,
        confidence=0.9,
        reason="strict quote intent",
        user_visible_status="",
        quote_finder_hint=False,
        quote_finder_hint_topic=None,
    )


def _base_session_and_doc(document_id, session_id, *, demo_slug=None):
    session_obj = SimpleNamespace(
        id=session_id, document_id=document_id, collection_id=None, title=None, domain_mode=None,
    )
    doc_obj = SimpleNamespace(id=document_id, demo_slug=demo_slug, custom_instructions=None, page_count=10)
    return session_obj, doc_obj


def _never_called(*_a, **_k):
    raise AssertionError("normal LLM path must not run for a routed quote search")


class TestAuthedRoutingEmitsArtifact:
    @pytest.mark.asyncio
    async def test_authed_single_doc_strict_intent_runs_quote_search_and_emits_artifact(
        self, monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        session_id = uuid.uuid4()
        document_id = uuid.uuid4()
        user_id = uuid.uuid4()
        ledger_id = uuid.uuid4()
        chunk_id = uuid.uuid4()
        session_obj, doc_obj = _base_session_and_doc(document_id, session_id)
        db = _make_db(session_obj, doc_obj, execute_side_effect=[_ScalarOneResult(session_obj)])

        monkeypatch.setattr(chat_service_module.action_planner, "plan", AsyncMock(return_value=_quote_action_plan()))
        monkeypatch.setattr(chat_service_module.credit_service, "get_estimated_cost", lambda _mode: 15)
        monkeypatch.setattr(chat_service_module.credit_service, "debit_credits", AsyncMock(return_value=ledger_id))
        reconcile_mock = AsyncMock()
        record_usage_mock = AsyncMock()
        monkeypatch.setattr(chat_service_module.credit_service, "reconcile_credits", reconcile_mock)
        monkeypatch.setattr(chat_service_module.credit_service, "record_usage", record_usage_mock)
        monkeypatch.setattr(chat_service_module.credit_service, "calculate_cost", lambda *_a, **_k: 6)
        monkeypatch.setattr(chat_service_module, "_get_llm_client", _never_called)


exec
/bin/zsh -lc 'git show 2d4e01a''^:backend/tests/test_quote_intent_routing.py | tail -n 80' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
                db=db,
                user=SimpleNamespace(id=user_id, plan="pro"),
                mode="balanced",
            )
        ]

        quote_search_mock.assert_not_awaited()  # never auto-routed/billed
        assert events[-1]["event"] == "done"
        assert events[-1]["data"]["quote_finder_hint"] is True
        assert events[-1]["data"]["quote_finder_topic"] == message

    @pytest.mark.asyncio
    async def test_ordinary_message_carries_no_hint_in_done_event(
        self, monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """The hint fields are always PRESENT (stable shape for the
        frontend) but False/None for a message that never matched the
        strict trigger at all."""
        session_id = uuid.uuid4()
        document_id = uuid.uuid4()
        user_id = uuid.uuid4()
        ledger_id = uuid.uuid4()
        chunk_id = uuid.uuid4()
        message = "What are the key terms of this agreement?"
        session_obj = SimpleNamespace(
            id=session_id, document_id=document_id, collection_id=None, title=None, domain_mode=None,
        )
        doc_obj = SimpleNamespace(id=document_id, demo_slug=None, custom_instructions=None)
        db = _make_db(
            session_obj, doc_obj,
            execute_side_effect=[
                _ScalarOneResult(session_obj),
                _MessagesResult([SimpleNamespace(role="user", content=message)]),
            ],
        )
        fake_retrieval = SimpleNamespace(
            retrieved=[{
                "chunk_id": chunk_id, "document_id": document_id,
                "text": "The agreement's key terms are listed below.", "page": 1, "page_end": 1,
                "bboxes": [], "section_title": "Terms", "score": 0.9,
            }],
            strategy="semantic_top_k", evaluation=None, plan=None,
        )
        create = AsyncMock(
            return_value=_FakeStream([
                _FakeChunk("The key terms are as follows.[1]"),
                _FakeChunk(None, finish_reason="stop", usage=SimpleNamespace(prompt_tokens=100, completion_tokens=20)),
            ])
        )
        fake_client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))

        monkeypatch.setattr(
            chat_service_module.query_router, "route",
            lambda *_a, **_k: SimpleNamespace(primary_intent=QueryIntent.LOCAL_QA),
        )
        monkeypatch.setattr(chat_service_module.credit_service, "get_estimated_cost", lambda _mode: 5)
        monkeypatch.setattr(chat_service_module.credit_service, "debit_credits", AsyncMock(return_value=ledger_id))
        monkeypatch.setattr(
            chat_service_module.corrective_retrieval_service, "retrieve_single",
            AsyncMock(return_value=fake_retrieval),
        )
        monkeypatch.setattr(chat_service_module, "_get_llm_client", lambda _model: fake_client)
        monkeypatch.setattr(chat_service_module.credit_service, "calculate_cost", lambda *_a, **_k: 4)
        monkeypatch.setattr(chat_service_module.credit_service, "reconcile_credits", AsyncMock())
        monkeypatch.setattr(chat_service_module.credit_service, "record_usage", AsyncMock())

        events = [
            event
            async for event in chat_service_module.chat_service.chat_stream(
                session_id=session_id,
                user_message=message,
                db=db,
                user=SimpleNamespace(id=user_id, plan="pro"),
                mode="balanced",
            )
        ]

        assert events[-1]["event"] == "done"
        assert events[-1]["data"]["quote_finder_hint"] is False
        assert events[-1]["data"]["quote_finder_topic"] is None

exec
/bin/zsh -lc 'git show --format=fuller --no-ext-diff --stat 2d4e01a && git show --format=fuller --no-ext-diff --stat bb79453' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
commit 2d4e01a75cbcaeede81f45adc8f82f6e7451bea7
Author:     Yijie Ma <mayijie@Mac.fritz.box>
AuthorDate: Mon Aug 3 23:46:15 2026 +0200
Commit:     Yijie Ma <mayijie@Mac.fritz.box>
CommitDate: Mon Aug 3 23:46:15 2026 +0200

    fix(chat): sync persisted domain_mode on ALL successful early returns
    
    Codex P1 review (P3, backend hazard): chat_stream's "omitted domain_mode
    clears the persisted ChatSession.domain_mode" logic only ran inline in
    the main RAG path (~2081, now via _sync_session_domain_mode). Two
    successful early-return paths skipped it entirely — tool actions
    (~1611-1624) and strict Quote Finder routing (its success return at
    ~1809-1824) — both returning before the main RAG path's system-prompt-
    building section ever ran. A session that once had domain_mode="legal"
    persisted could keep that stale value after a later omitted-mode message
    that happened to route to one of those branches, making the documented
    "omitted clears it" invariant false for those paths.
    
    Not a security bypass — downstream-harmless today, since chat_stream
    always uses the per-request `domain_mode` argument directly (never
    re-reads session_obj.domain_mode to decide behavior) and continuation
    doesn't reload it either. This is metadata correctness / honoring the
    invariant.
    
    Extracted the 3-line sync (`if domain_mode != session_obj.domain_mode:
    session_obj.domain_mode = domain_mode; await db.commit()`) into a shared
    _sync_session_domain_mode() helper and called it at all three successful
    terminal points: the tool-action branch (before dispatching to
    _tool_action_stream), the strict Quote Finder success path (right after
    `settled = True`, before the artifact/token/done yields), and the
    existing main RAG path call site (unchanged logic, now via the shared
    helper). Deliberately NOT hoisted to the top of the function — scoped
    precisely to the successful paths Codex flagged, not to failure/rejection
    paths (SESSION_NOT_FOUND, MODE_NOT_ALLOWED, INSUFFICIENT_CREDITS, etc.),
    which were not part of the finding and are left untouched.
    
    Two new tests seed session_obj.domain_mode = "legal" (simulating a stale
    prior value), send a message with NO domain_mode, and assert the session
    row ends up domain_mode=None for both previously-skipped paths. Both
    call sites independently mutation-tested — disabling either reproduces
    the exact stale-metadata bug and only the corresponding test catches it.
    
    Full suite 788 passed / 26 skipped (was 786), ruff clean, 23 real-Postgres
    integration tests passing (unchanged — no schema touched).
    
    Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

 backend/app/services/chat_service.py       |  43 ++++++++++--
 backend/tests/test_quote_intent_routing.py | 102 +++++++++++++++++++++++++++++
 2 files changed, 141 insertions(+), 4 deletions(-)
commit bb794530efb211878808952c8fd19162727ac793
Author:     Yijie Ma <mayijie@Mac.fritz.box>
AuthorDate: Mon Aug 3 23:44:24 2026 +0200
Commit:     Yijie Ma <mayijie@Mac.fritz.box>
CommitDate: Mon Aug 3 23:44:24 2026 +0200

    fix: Pro-tier document cap dead-end + openPaywall comment accuracy (Codex P1)
    
    FIX-1 (P2): targetPlan()'s ternary only special-cased plan==="plus"→"pro";
    every other plan, including "pro" itself, fell back to "plus". The new
    layout-translation DOCUMENT_LIMIT_REACHED surfaces (DocumentReaderPageClient,
    ChatArtifactCard) made this reachable in practice — layout_translations.py's
    _assert_document_capacity legitimately emits plan:"pro" when a Pro user hits
    the document cap, which was rendering a "Downgrade to Plus" billing link.
    Added targetPlanOrNone(), scoped to DOCUMENT_LIMIT_REACHED only (not the
    other three targetPlan() callers, which weren't audited here), returning
    undefined for plan:"pro" — the CODE_TABLE entry then swaps in top-tier
    copy ("...delete a document to free up space", no upgrade mention) and
    omits the cta. Both consuming surfaces already render title/body
    unconditionally and cta only when present, so no component changes were
    needed — the fix is entirely in errorCopy.ts. New string × 11 locales.
    
    FIX-2 (P3): corrected openPaywall's doc comment, which claimed all
    non-402 plan-limit 403s use inline CTA only — DOMAIN_MODE_REQUIRES_PLUS
    is an intentional exception on the chat SSE path (hardcoded into
    useChatStream's trigger list, not via this flag, precisely to avoid the
    trap this comment used to set for a future generic consumer) because that
    surface's error renderer has no inline-CTA path, unlike the REST surfaces.
    
    Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

 frontend/src/i18n/locales/ar.json |  1 +
 frontend/src/i18n/locales/de.json |  1 +
 frontend/src/i18n/locales/en.json |  1 +
 frontend/src/i18n/locales/es.json |  1 +
 frontend/src/i18n/locales/fr.json |  1 +
 frontend/src/i18n/locales/hi.json |  1 +
 frontend/src/i18n/locales/it.json |  1 +
 frontend/src/i18n/locales/ja.json |  1 +
 frontend/src/i18n/locales/ko.json |  1 +
 frontend/src/i18n/locales/pt.json |  1 +
 frontend/src/i18n/locales/zh.json |  1 +
 frontend/src/lib/errorCopy.ts     | 49 ++++++++++++++++++++++++++++++++-------
 12 files changed, 52 insertions(+), 8 deletions(-)

exec
/bin/zsh -lc "ls -l .collab/reviews/2026-08-03-p1-hygiene-codex-r2.md && sed -n '1,220p' .collab/reviews/2026-08-03-p1-hygiene-codex-r2.md" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
-rw-r--r--@ 1 mayijie  staff  925914 Aug  3 23:51 .collab/reviews/2026-08-03-p1-hygiene-codex-r2.md
Reading prompt from stdin...
2026-08-03T21:48:36.807713Z ERROR codex_core::session::session: failed to load skill /Users/mayijie/Projects/Code/010_DocTalk/.agents/skills/deploy/SKILL.md: missing YAML frontmatter delimited by ---
2026-08-03T21:48:36.807740Z ERROR codex_core::session::session: failed to load skill /Users/mayijie/Projects/Code/010_DocTalk/.agents/skills/codex-implement/SKILL.md: missing YAML frontmatter delimited by ---
OpenAI Codex v0.144.0
--------
workdir: /Users/mayijie/Projects/Code/010_DocTalk
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR]
reasoning effort: xhigh
reasoning summaries: none
session id: 019fc999-a200-7882-828e-bf64f904ce2d
--------
user
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

codex
I’ll inspect only `e499bc7..HEAD`, read the scoped frontend/backend rules, trace every `DOCUMENT_LIMIT_REACHED` consumer and every successful `send_message_stream` terminal branch, then run focused tests or static checks where they sharpen the verdict.
  → Read scoped rules and inspect the two fix commits/diff
  • Trace DOCUMENT_LIMIT_REACHED rendering and plan-target logic
  • Trace all successful streaming terminal paths and sync semantics
  • Run focused verification and issue the batch verdict
exec
/bin/zsh -lc "sed -n '1,240p' .claude/rules/frontend.md" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "sed -n '1,280p' .claude/rules/backend.md" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
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
- **Editorial marketing layer**: the entire public marketing surface (unauthenticated `/`, `use-cases/*`, `compare/*`, `alternatives/*`, `features/*`, `tools/*`, `pricing`, `trust`, `demo`) uses a SEPARATE scoped editorial design system — `frontend/src/app/editorial.css` (every rule under `.dt-editorial`), a warm-paper palette (`--ed-paper`/`--ed-ink`/`--ed-signal` terracotta `#b0472f`/`--ed-ochre`) with Newsreader serif + IBM Plex Mono fonts, **light-only**. It does NOT use the zinc/blue app palette. **Design decision locked 2026-05-20**: the product runs on TWO surface treatments (editorial marketing terracotta+warm-paper vs functional app zinc+blue) sharing one token base (logo, body font Inter, spacing scale, micro-interactions). A blue-accent unification was tried and reverted because the warm-paper terracotta identity is load-bearing. Do not re-propose merging the accents. Marketing pages compose the shared editorial kit in `frontend/src/components/marketing/` (`MarketingShell`, `EditorialMarketingHeader`, `EdPageHero`, `EdSection`, `EdProse`, `EdFeatureList`, `EdCardGrid`, `EdStepRow`, `EdFaqList`, `EdCtaBanner`, `EdComparisonTable`, `EdInlineCell`, `EdRelatedLinks`, `EdCheckList`, `EdChoiceList`) — `MarketingShell` supplies the `.dt-editorial` root, so kit components never add it themselves. Keep editorial styles scoped under `.dt-editorial`; do not let them leak into the functional app UI, and do not apply the zinc/blue rule to editorial components. Pages still on the zinc/blue app palette: `about`, `contact`, `imprint`, `privacy`, `terms`, `blog/*` (document-diff was editorialized in 2026-05; `DocumentDiffPanel` takes `surface="app"|"editorial"` and is the one sanctioned dual-surface component).
- **De-glass leftovers are a bug class**: commit `0b7404a` flattened the CSS but left dark-glass Tailwind utilities in JSX; ~40 invisible-on-white sites were fixed in v0.23.0. When touching app-surface JSX, any `*-white/NN` or bare `text-white`/`hover:text-white` on a light surface needs a light-mode variant (`dark:` keeps the old value). Theme-inverting solids (`bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900`) are correct as-is.
- **i18n**: Components using `t()` MUST be inside `<LocaleProvider>`. Outside = raw key fallback. Only `en` is statically loaded; other 10 locales lazy-loaded. Localized server pages seed `<LocaleProvider initialLocale initialMessages>` (see `app/[locale]/page.tsx` + `getScopedMessages`) so SSR HTML is translated — a `[locale]` page without seeding ships English first paint (the exact failure the locale-URL program exists to fix).

## Demo Counter & Session Reuse (v0.23.0 — Codex 6-round consensus; do not re-break)
- Contract: `totalUsed = demoMessagesUsed (server count at last restore/create) + (transcript user msgs − demoRestoredUserMsgCount baseline)`. Counters reset ONLY in `useChatSession`'s documentId-keyed effect (NOT `clearDocumentTransientState` — its effect reruns on locale change and wiped the baseline).
- Anonymous demo sessions are reused via `sessionStorage["dt-demo-session:"+docId]` (helper `demoSessionStorage.ts`); pointer cleared only on 404/403; transient adoption failure sets `sessionError` and STOPS (no create fall-through).
- Failed regenerate/continue re-anchors to server truth (`GET messages` → `demo_messages_used`) guarded by sessionId AND `demoAccountingEpoch` (monotonic across `reset()`; bumped at every accounting mutation incl. A→A session switch). Late resolves are dropped, never written.

## Quote Finder UI (M2/M3)
- `QuoteFinderPanel` (reader toolbar entry; anon sees a sign-in CTA instead) + chat `quote_search` artifact + "Try Quote Finder" chip (renders when the SSE `done` event carries `quote_finder_hint`/`quote_finder_topic`; opens the panel with topic prefilled, NEVER auto-submits — searches are billed).
- Trust copy is per-kind and uses the WEAKEST kind present: word-for-word claim only for `page_text` results; `extracted_text` cards carry the amber hyphenation caveat. Do not reintroduce an unconditional verbatim claim.
- Panel resets topic/result/error/loading on every open/retarget with a generation guard (late responses from a prior open are dropped).
- Save button state must not be disabled from a cached count — the cap only blocks genuinely new saves (idempotent re-saves always succeed).

## PDF & Documents
- **react-pdf v9 CJK**: After upgrading react-pdf/pdfjs-dist, MUST re-copy `cmaps/`, `standard_fonts/`, `pdf.worker.min.mjs` to `public/`. Worker loaded from same-origin (not CDN) for CSP compliance
- **bbox coordinates**: Normalized [0,1], top-left origin. Three citation highlight strategies: ① PDF bbox, ② TextViewer text-snippet match, ③ converted PDF fallback to text-snippet when dummy bbox detected. Quote cards reuse the citation jump with chunk-level bboxes and an explicit "highlight location is approximate" label (plan §8.2).

## Subscriptions & Feature Gating
- Free (300/mo) + Plus (3K/mo, $9.99) + Pro (9K/mo, $19.99). Annual = 20% discount
- Visible modes are Flash and Pro. Internal IDs remain `quick` and `balanced`; retired modes such as `thorough` must migrate to Flash.
- Free includes Flash plus a capped number of Pro answers/month. Export: Plus+ (frontend gated). Custom Instructions: Pro (backend gated). Sessions: Free=3/doc (backend gated). Saved quotes: Free=30 active across documents (backend gated; delete frees a slot). Quote searches cost credits like a Pro (balanced) chat message. Domain Mode (legal/academic chat overlay): Plus+ (backend gated at two entry points — `chat.py`'s `chat_stream` and `extractions.py`'s `create_extraction` — both 403 `DOMAIN_MODE_REQUIRES_PLUS`).
- Credit packs: Boost(500/$3.99), Power(2K/$9.99), Ultra(5K/$19.99)
- Cancellation UI must remain self-serve. The cancel form may collect an optional reason, optional feedback, and a refund-review checkbox, but it must not block cancellation on those fields.

 succeeded in 0ms:
---
paths:
  - "backend/**"
---

# Backend Conventions

## Async Safety
- **MinIO calls MUST use `asyncio.to_thread()`** in async endpoints. MinIO client is sync (urllib3). Direct calls block event loop; when MinIO is unreachable, blocks ALL requests for 30+s. Client configured with short timeouts (connect=5s, read=10s, 2 retries)
- **Celery uses sync DB** (`psycopg`), API uses async (`asyncpg`). Never mix.

## Credits & Billing
- **Two-stage debit**: ① Pre-check balance (402 if insufficient) → ② `debit_credits()` pre-debits estimated cost (returns ledger ID) → stream → `reconcile_credits()` UPDATEs same ledger entry to actual cost. Single ledger record per chat. LLM failure → DELETE entry + full refund
- **Durable settlement (v0.24.0, Codex-consensus)**: `credit_ledger.reconciled_at` is the settlement marker. `reconcile_credits()` takes `SELECT ... FOR UPDATE` and ALWAYS stamps `reconciled_at` — including the equal-cost no-op path. Every refund is a single atomic conditional `DELETE ... WHERE reconciled_at IS NULL RETURNING id`; rowcount 0 = money already settled = no refund. ALL final-commit exceptions (not just `CancelledError`) route through the marker resolver; resolver failure must NEVER fall through to a blind refund (leave predebit standing, log `*.unresolved`). Do not reintroduce read-then-act refund logic.
- Quote search billing: `reason="quote_search"`, predebit 15 (balanced estimate), reconcile to actual; verified-empty results charge actual cost. Chat-routed quote searches bill through the chat message's own ledger row (predebit forced to 15 when the strict trigger fires, regardless of selected mode) — never a second row.
- **`ChatRequest` exposes only `mode` field** (`quick`/`balanced`; legacy `thorough` is retired). `model` field removed — prevents billing bypass
- Stripe webhook: `checkout.session.completed` for subscriptions only updates plan (no credits); `invoice.payment_succeeded` grants monthly credits (idempotent by invoice.id)
- `POST /api/billing/cancel` is self-serve and records optional `cancel_reason`, `cancel_feedback`, and `refund_requested` metadata in `plan_transitions`. `refund_requested` is an internal review flag; do not issue Stripe refunds from this path unless an explicit refund workflow is added.

## Parse Worker
- `time_limit=600`, `soft_time_limit=540`, `autoretry_for=(Exception,)`, max 2 retries, 60s backoff
- Idempotent re-parse: **delete Qdrant vectors (by `document_id` filter) BEFORE deleting DB pages/chunks**. Ordering matters — a Qdrant outage must leave the existing rows intact (set error + return), else the two stores diverge / data is lost. Then re-index.
- **PDF page text is persisted forward-only (v0.24.0)**: the extract pass stores `page.get_text("text")` per page into `pages.content` (previously NULL for all PDFs). Legacy docs keep NULL until re-parsed. `get_document_text_content` uses page mode ONLY when coverage is complete and consecutive (`1..page_count`, all non-blank); otherwise chunk fallback.
- **OCR trigger = `detect_scanned` (no text layer) OR `detect_low_quality_text` (PDF text layer present but garbled — broken-font cmap, Unicode-aware quality score)**. R2b fix for docs like U13 that have garbage text and so were never detected as "scanned".
- **OCR language is content-based**: `detect_script_osd` runs `tesseract --psm 0` (OSD) on sample pages → `resolve_ocr_languages(locale, script)` returns a NARROW set (script family, ≤3, **no `eng` for non-Latin** — it injects Latin noise). Never the kitchen-sink set (causes cross-script hallucination); locale only refines within a script family. Adopt a low-quality re-OCR only if it beats the text-layer quality. Persist `parse_version`/`parse_method`/`text_quality`/`ocr_languages` on the doc.
- Backfill stale/low-quality docs with `scripts/find_low_quality_docs.py` (skips `parse_version>=current` unless `--force`).

## Verified Quote Pipeline (M2, v0.24.0 — Codex 6-round consensus; do not weaken)
- **The guarantee**: a quote card is NEVER rendered from LLM-emitted text. `verify_quote()` (M1 substrate) gates every proposal; display text is ALWAYS the raw source slice. Flagged-tier (fuzzy 90–95) results are discarded from cards, only counted.
- **Verification source** (`quote_source_service`): all pages in the chunk's range have `Page.content` → per-page verification, kind=`page_text`; else cited chunk ± neighbors, kind=`extracted_text`. Trust labels derive from kind and are honest per-kind (word-for-word claim only for `page_text`).
- **Page attribution derives from the VERIFIED slice** (plan §8.1): multi-page `extracted_text` segments are DISCARDED (`ambiguous_page_range`); `page_text` duplicates emit one card per matching page. Never attribute via majority-bbox voting.
- **Chat routing is deterministic-safe**: auto-route to the billed pipeline ONLY when the strict trigger matches AND zero negation/metalinguistic tokens appear anywhere in the message; otherwise the ordinary RAG path runs with `quote_finder_hint`/`quote_finder_topic` on the SSE `done` event (frontend chip). Guarded triggers FORCE the RAG path — never a tool action. Do not re-attempt regex intent-scope resolution; the policy is adjudicated (asymmetric loss).
- **Saved quotes re-verify server-side**: the save endpoint accepts only `chunk_id + quote_text` and re-derives tier/score/page/kind via `verify_saved_quote()`; client-supplied trust fields would forge "verified" cards. Fabrication = 422 `QUOTE_NOT_VERIFIABLE`. Saved rows snapshot trust fields at save time (survive reparses; `source_chunk_id` is ON DELETE SET NULL).
- Caps: `FREE_SAVED_QUOTES_LIMIT=30` counts ACTIVE rows per user across documents; delete frees a slot; idempotent re-saves are never capped.

## Auth
- **`FOR UPDATE` lock** on verification tokens to prevent TOCTOU
- Internal Auth Adapter API uses `X-Adapter-Secret` header

## Error Handling
- Use `HTTPException` (not `JSONResponse`) for all non-SSE endpoints
- Lifespan pattern (`@asynccontextmanager`) instead of deprecated `@app.on_event`

## Demo System
- 3 seed PDFs auto-deployed at startup from `backend/seed_data/`. Self-healing covers BOTH stores: Qdrant vector loss → full re-seed; missing MinIO objects → `_ensure_demo_files` stats each doc's `storage_key` and re-uploads from seed_data (id/key-preserving). Added after the 2026-08 MinIO-v2 migration silently lost ~106/108 stored files (chat worked, PDF pane didn't). Seed assets are immutable per slug — the stat→put TOCTOU is accepted on that invariant.
- Anonymous limits (v0.23.0): **5 msgs per (IP, document) per 24h** (matches marketing copy), session cap = 500 per doc counted over a **24h rolling window of anonymous sessions only**, 10 req/min/IP, forced DeepSeek V4 Flash. Nightly beat task prunes empty demo sessions >7d (anon AND authed).
- Free-plan authed users get a per-user session cap on demo docs (`FREE_MAX_SESSIONS_PER_DOC`, own sessions only) — closes the row-spam DoS on the anonymous cap.
- Logged-in users accessing demo docs use their credits with no message limit

## Testing
- **Integration tests NEVER touch the shared dev DB.** `tests/conftest.py` forces a scratch `doctalk_test` database (auto-provisioned + migrated) and hard-refuses non-loopback hosts unless `DOCTALK_TEST_DATABASE_URL` is explicitly set. Two dev-DB wipe incidents (2026-08-02: alembic downgrade-base; integration fixtures) led to this — do not weaken it back to setdefault/conditional form. Never run `alembic downgrade` against `doctalk`.

exec
/bin/zsh -lc 'git log --oneline e499bc7..HEAD && git diff --stat e499bc7..HEAD && git diff --name-only e499bc7..HEAD' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
9da2bc4 docs(review): correct P1 r2 request to actual per-branch sync impl (2d4e01a)
2e5066e docs(review): P1 hygiene Codex r2 request
2d4e01a fix(chat): sync persisted domain_mode on ALL successful early returns
bb79453 fix: Pro-tier document cap dead-end + openPaywall comment accuracy (Codex P1)
337f981 docs(review): P1 hygiene Codex r1 (REVISE — Pro dead-end + 2 P3)
 .../2026-08-03-p1-hygiene-codex-r2-request.md      |    18 +
 .collab/reviews/2026-08-03-p1-hygiene-codex-r1.md  | 11959 +++++++++++++++++++
 backend/app/services/chat_service.py               |    43 +-
 backend/tests/test_quote_intent_routing.py         |   102 +
 frontend/src/i18n/locales/ar.json                  |     1 +
 frontend/src/i18n/locales/de.json                  |     1 +
 frontend/src/i18n/locales/en.json                  |     1 +
 frontend/src/i18n/locales/es.json                  |     1 +
 frontend/src/i18n/locales/fr.json                  |     1 +
 frontend/src/i18n/locales/hi.json                  |     1 +
 frontend/src/i18n/locales/it.json                  |     1 +
 frontend/src/i18n/locales/ja.json                  |     1 +
 frontend/src/i18n/locales/ko.json                  |     1 +
 frontend/src/i18n/locales/pt.json                  |     1 +
 frontend/src/i18n/locales/zh.json                  |     1 +
 frontend/src/lib/errorCopy.ts                      |    49 +-
 16 files changed, 12170 insertions(+), 12 deletions(-)
.collab/dialogue/2026-08-03-p1-hygiene-codex-r2-request.md
.collab/reviews/2026-08-03-p1-hygiene-codex-r1.md
backend/app/services/chat_service.py
backend/tests/test_quote_intent_routing.py
frontend/src/i18n/locales/ar.json
frontend/src/i18n/locales/de.json
frontend/src/i18n/locales/en.json
frontend/src/i18n/locales/es.json
frontend/src/i18n/locales/fr.json
frontend/src/i18n/locales/hi.json
frontend/src/i18n/locales/it.json
frontend/src/i18n/locales/ja.json
frontend/src/i18n/locales/ko.json
frontend/src/i18n/locales/pt.json
frontend/src/i18n/locales/zh.json
frontend/src/lib/errorCopy.ts

codex
The changed production surface is narrow: `errorCopy.ts` plus locale strings on the frontend, and `chat_service.py` plus two regression tests on the backend. I’m now tracing callers and control flow beyond the diff so a nearby fast-path cannot hide outside the edited hunks.
exec
/bin/zsh -lc "rg -n \"_sync_session_domain_mode|domain_mode|_tool_action_stream|strict_quote|overview|summar|return|yield\" backend/app/services/chat_service.py backend/app/api backend/app --glob '*.py'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
backend/app/services/chat_service.py:75:    return {"event": event, "data": data}
backend/app/services/chat_service.py:88:    """Log detailed error server-side, return sanitized SSE payload to client."""
backend/app/services/chat_service.py:90:    return sse(event, {"code": code, "message": _USER_SAFE_ERRORS.get(code, "An error occurred.")})
backend/app/services/chat_service.py:112:    return (locale or "").strip().lower().replace("_", "-").split("-")[0]
backend/app/services/chat_service.py:152:    return template.format(**fmt)
backend/app/services/chat_service.py:155:def _is_strict_quote_routed(
backend/app/services/chat_service.py:169:    return (
backend/app/services/chat_service.py:182:        return _LOCALE_LANGUAGE_LABELS[normalized]
backend/app/services/chat_service.py:186:        return "Japanese"
backend/app/services/chat_service.py:188:        return "Korean"
backend/app/services/chat_service.py:190:        return "Chinese"
backend/app/services/chat_service.py:192:        return "Arabic"
backend/app/services/chat_service.py:194:        return "Hindi"
backend/app/services/chat_service.py:195:    return None
backend/app/services/chat_service.py:201:    return (
backend/app/services/chat_service.py:213:    return (
backend/app/services/chat_service.py:218:        "Do not translate, restart, summarize, or switch to English.\n"
backend/app/services/chat_service.py:233:    return _openai_client
backend/app/services/chat_service.py:237:    return model in settings.DEEPSEEK_OFFICIAL_MODELS
backend/app/services/chat_service.py:249:    return _deepseek_client
backend/app/services/chat_service.py:254:        return _get_deepseek_client()
backend/app/services/chat_service.py:255:    return _get_openai_client()
backend/app/services/chat_service.py:270:    return all(isinstance(bb.get(k), (int, float)) for k in ("x", "y", "w", "h"))
backend/app/services/chat_service.py:276:    is_summary = chunk.retrieval_modality == "summary"
backend/app/services/chat_service.py:277:    all_bbs = [] if is_summary else [
backend/app/services/chat_service.py:317:    if not is_summary and claim_text and chunk.text:
backend/app/services/chat_service.py:334:    if is_summary:
backend/app/services/chat_service.py:336:        citation_data["summary_target_sections"] = list(chunk.summary_target_sections)
backend/app/services/chat_service.py:337:        citation_data["summary_model_covered_sections"] = list(chunk.summary_model_covered_sections)
backend/app/services/chat_service.py:338:        citation_data["summary_fallback_sections"] = list(chunk.summary_fallback_sections)

exec
/bin/zsh -lc "rg -n \"bodyTopTier|targetPlanOrNone\" frontend/src && rg -n '\"plan\": plan' backend/app/api/documents.py backend/app/api/layout_translations.py" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
frontend/src/i18n/locales/ar.json:2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "لقد وصلت إلى حد المستندات في خطتك ({limit}). احذف مستندًا لتحرير مساحة.",
frontend/src/i18n/locales/es.json:2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "Has alcanzado el límite de documentos de tu plan ({limit}). Elimina un documento para liberar espacio.",
frontend/src/i18n/locales/ko.json:2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "요금제의 문서 한도({limit})에 도달했습니다. 문서를 삭제해 공간을 확보하세요.",
frontend/src/i18n/locales/en.json:2301:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "You've reached your plan's document limit ({limit}). Delete a document to free up space.",
frontend/src/i18n/locales/ja.json:2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "プランのドキュメント上限（{limit}）に達しました。ドキュメントを削除して空き容量を確保してください。",
frontend/src/i18n/locales/pt.json:2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "Você atingiu o limite de documentos do seu plano ({limit}). Exclua um documento para liberar espaço.",
frontend/src/i18n/locales/de.json:2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "Sie haben das Dokumentenlimit Ihres Tarifs erreicht ({limit}). Löschen Sie ein Dokument, um Platz freizugeben.",
frontend/src/i18n/locales/it.json:2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "Hai raggiunto il limite di documenti del tuo piano ({limit}). Elimina un documento per liberare spazio.",
frontend/src/i18n/locales/fr.json:2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "Vous avez atteint la limite de documents de votre forfait ({limit}). Supprimez un document pour libérer de l'espace.",
frontend/src/i18n/locales/zh.json:2657:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "您已达到套餐的文档数量上限（{limit}）。删除一个文档以释放空间。",
frontend/src/i18n/locales/hi.json:2618:  "errors.DOCUMENT_LIMIT_REACHED.bodyTopTier": "आप अपनी योजना की दस्तावेज़ सीमा ({limit}) तक पहुंच गए हैं। जगह खाली करने के लिए एक दस्तावेज़ हटाएं।",
frontend/src/lib/errorCopy.ts:108:function targetPlanOrNone(detail: Record<string, unknown>): BillingPlanIntent | undefined {
frontend/src/lib/errorCopy.ts:131:    const plan = targetPlanOrNone(d);
frontend/src/lib/errorCopy.ts:138:        : tOr('errors.DOCUMENT_LIMIT_REACHED.bodyTopTier', 'You\'ve reached your plan\'s document limit ({limit}). Delete a document to free up space.', {
backend/app/api/documents.py:231:                "plan": plan,
backend/app/api/documents.py:256:                    "plan": plan,
backend/app/api/documents.py:365:                "plan": plan,
backend/app/api/documents.py:426:                    "plan": plan,
backend/app/api/documents.py:471:                    "plan": plan,
backend/app/api/layout_translations.py:180:                "plan": plan,
backend/app/api/layout_translations.py:218:                "plan": plan,
backend/app/api/layout_translations.py:328:            "plan": plan,

exec
/bin/zsh -lc "git show --no-ext-diff --format= --unified=0 bb79453 -- frontend/src/lib/errorCopy.ts frontend/src/i18n/locales | rg '"'^'"\\+["'^+]'"' | wc -l; git show --no-ext-diff --format= --unified=0 2d4e01a -- backend/app/services/chat_service.py backend/tests/test_quote_intent_routing.py | rg '"'^'"\\+["'^+]'"' | wc -l" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
      51
     126

exec
/bin/zsh -lc "python3 - <<'PY'
import asyncio
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import app.services.chat_service as cs
from app.services.action_planner import ChatAction
from app.services.query_router import QueryIntent
from app.services.quote_search_service import QuoteSearchResult
from test_quote_intent_routing import _ScalarOneResult, _base_session_and_doc, _make_db, _quote_action_plan

async def tool_sync_commit_failure():
    sid, did, uid = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    session, doc = _base_session_and_doc(did, sid)
    session.domain_mode = \"legal\"
    session.title = \"Existing\"
    db = _make_db(session, doc, execute_side_effect=[_ScalarOneResult(session)])
    db.commit = AsyncMock(side_effect=RuntimeError(\"sync commit failed\"))
    plan = SimpleNamespace(action=ChatAction.EXPORT_TABLES, uses_rag_answer_path=False,
        confidence=.9, reason=\"probe\", user_visible_status=\"\", quote_finder_hint=False,
        quote_finder_hint_topic=None)
    with patch.object(cs.action_planner, \"plan\", AsyncMock(return_value=plan)):
        try:
            _ = [e async for e in cs.chat_service.chat_stream(
                sid, \"Export tables\", db, user=SimpleNamespace(id=uid, plan=\"pro\"),
                mode=\"balanced\", domain_mode=None)]
        except RuntimeError as exc:
            return f\"uncaught={exc}; domain_mode={session.domain_mode"'!r}"
    return "unexpectedly caught"

async def failed_tool_still_syncs():
    sid, did, uid = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    session, doc = _base_session_and_doc(did, sid)
    session.domain_mode = "legal"
    session.title = "Existing"
    db = _make_db(session, doc, execute_side_effect=[_ScalarOneResult(session)])
    plan = SimpleNamespace(action=ChatAction.EXPORT_TABLES, uses_rag_answer_path=False,
        confidence=.9, reason="probe", user_visible_status="", quote_finder_hint=False,
        quote_finder_hint_topic=None)
    with patch.object(cs.action_planner, "plan", AsyncMock(return_value=plan)), '"\\
         patch.object(cs.chat_tool_executor, \"execute\", AsyncMock(side_effect=RuntimeError(\"tool failed\"))):
        events = [e async for e in cs.chat_service.chat_stream(
            sid, \"Export tables\", db, user=SimpleNamespace(id=uid, plan=\"pro\"),
            mode=\"balanced\", domain_mode=None)]
    return f\"terminal={events[-1]['event']}:{events[-1]['data']['code']}; domain_mode={session.domain_mode"'!r}; commits={db.commit.await_count}"

async def strict_post_settlement_sync_failure():
    sid, did, uid, ledger = uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    session, doc = _base_session_and_doc(did, sid)
    session.domain_mode = "legal"
    session.title = "Existing"
    db = _make_db(session, doc, execute_side_effect=[_ScalarOneResult(session)])
    db.commit = AsyncMock(side_effect=[None, None, None, RuntimeError("sync commit failed")])
    refund = AsyncMock()
    result = QuoteSearchResult(cards=[], proposed=0, verified=0, discarded=[],
        scanned_chunks=3, usage=(100, 20), model="deepseek-v4-pro")
    with patch.object(cs.action_planner, "plan", AsyncMock(return_value=_quote_action_plan())), '"\\
         patch.object(cs.query_router, \"route\", return_value=SimpleNamespace(primary_intent=QueryIntent.LOCAL_QA)), \\
         patch.object(cs.credit_service, \"get_estimated_cost\", return_value=15), \\
         patch.object(cs.credit_service, \"debit_credits\", AsyncMock(return_value=ledger)), \\
         patch.object(cs.credit_service, \"reconcile_credits\", AsyncMock()), \\
         patch.object(cs.credit_service, \"record_usage\", AsyncMock()), \\
         patch.object(cs.credit_service, \"calculate_cost\", return_value=6), \\
         patch.object(cs.quote_search_service, \"quote_search\", AsyncMock(return_value=result)), \\
         patch.object(cs, \"_refund_predebit\", refund):
        events = [e async for e in cs.chat_service.chat_stream(
            sid, \"Give me a direct quote about termination.\", db,
            user=SimpleNamespace(id=uid, plan=\"pro\"), mode=\"balanced\", domain_mode=None)]
    return f\"terminal={events[-1]['event']}:{events[-1]['data']['code']}; commits={db.commit.await_count}; refund_calls={refund.await_count}\"

async def main():
    print(\"tool_sync_commit_failure\", await tool_sync_commit_failure())
    print(\"failed_tool_still_syncs\", await failed_tool_still_syncs())
    print(\"strict_post_settlement_sync_failure\", await strict_post_settlement_sync_failure())

asyncio.run(main())
PY" in /Users/mayijie/Projects/Code/010_DocTalk/backend/tests
 exited 1 in 0ms:
Traceback (most recent call last):
  File "<stdin>", line 6, in <module>
ModuleNotFoundError: No module named 'app'

exec
/bin/zsh -lc "python3 - <<'PY'
import asyncio
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from test_quote_intent_routing import _ScalarOneResult, _base_session_and_doc, _make_db, _quote_action_plan
import app.services.chat_service as cs
from app.services.action_planner import ChatAction
from app.services.query_router import QueryIntent
from app.services.quote_search_service import QuoteSearchResult

async def tool_sync_commit_failure():
    sid, did, uid = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    session, doc = _base_session_and_doc(did, sid)
    session.domain_mode = \"legal\"
    session.title = \"Existing\"
    db = _make_db(session, doc, execute_side_effect=[_ScalarOneResult(session)])
    db.commit = AsyncMock(side_effect=RuntimeError(\"sync commit failed\"))
    plan = SimpleNamespace(action=ChatAction.EXPORT_TABLES, uses_rag_answer_path=False,
        confidence=.9, reason=\"probe\", user_visible_status=\"\", quote_finder_hint=False,
        quote_finder_hint_topic=None)
    with patch.object(cs.action_planner, \"plan\", AsyncMock(return_value=plan)):
        try:
            _ = [e async for e in cs.chat_service.chat_stream(
                sid, \"Export tables\", db, user=SimpleNamespace(id=uid, plan=\"pro\"),
                mode=\"balanced\", domain_mode=None)]
        except RuntimeError as exc:
            return f\"uncaught={exc}; domain_mode={session.domain_mode"'!r}"
    return "unexpectedly caught"

async def failed_tool_still_syncs():
    sid, did, uid = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    session, doc = _base_session_and_doc(did, sid)
    session.domain_mode = "legal"
    session.title = "Existing"
    db = _make_db(session, doc, execute_side_effect=[_ScalarOneResult(session)])
    plan = SimpleNamespace(action=ChatAction.EXPORT_TABLES, uses_rag_answer_path=False,
        confidence=.9, reason="probe", user_visible_status="", quote_finder_hint=False,
        quote_finder_hint_topic=None)
    with patch.object(cs.action_planner, "plan", AsyncMock(return_value=plan)), '"\\
         patch.object(cs.chat_tool_executor, \"execute\", AsyncMock(side_effect=RuntimeError(\"tool failed\"))):
        events = [e async for e in cs.chat_service.chat_stream(
            sid, \"Export tables\", db, user=SimpleNamespace(id=uid, plan=\"pro\"),
            mode=\"balanced\", domain_mode=None)]
    return f\"terminal={events[-1]['event']}:{events[-1]['data']['code']}; domain_mode={session.domain_mode"'!r}; commits={db.commit.await_count}"

async def strict_post_settlement_sync_failure():
    sid, did, uid, ledger = uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    session, doc = _base_session_and_doc(did, sid)
    session.domain_mode = "legal"
    session.title = "Existing"
    db = _make_db(session, doc, execute_side_effect=[_ScalarOneResult(session)])
    db.commit = AsyncMock(side_effect=[None, None, None, RuntimeError("sync commit failed")])
    refund = AsyncMock()
    result = QuoteSearchResult(cards=[], proposed=0, verified=0, discarded=[],
        scanned_chunks=3, usage=(100, 20), model="deepseek-v4-pro")
    with patch.object(cs.action_planner, "plan", AsyncMock(return_value=_quote_action_plan())), '"\\
         patch.object(cs.query_router, \"route\", return_value=SimpleNamespace(primary_intent=QueryIntent.LOCAL_QA)), \\
         patch.object(cs.credit_service, \"get_estimated_cost\", return_value=15), \\
         patch.object(cs.credit_service, \"debit_credits\", AsyncMock(return_value=ledger)), \\
         patch.object(cs.credit_service, \"reconcile_credits\", AsyncMock()), \\
         patch.object(cs.credit_service, \"record_usage\", AsyncMock()), \\
         patch.object(cs.credit_service, \"calculate_cost\", return_value=6), \\
         patch.object(cs.quote_search_service, \"quote_search\", AsyncMock(return_value=result)), \\
         patch.object(cs, \"_refund_predebit\", refund):
        events = [e async for e in cs.chat_service.chat_stream(
            sid, \"Give me a direct quote about termination.\", db,
            user=SimpleNamespace(id=uid, plan=\"pro\"), mode=\"balanced\", domain_mode=None)]
    return f\"terminal={events[-1]['event']}:{events[-1]['data']['code']}; commits={db.commit.await_count}; refund_calls={refund.await_count}\"

async def main():
    print(\"tool_sync_commit_failure\", await tool_sync_commit_failure())
    print(\"failed_tool_still_syncs\", await failed_tool_still_syncs())
    print(\"strict_post_settlement_sync_failure\", await strict_post_settlement_sync_failure())

asyncio.run(main())
PY" in /Users/mayijie/Projects/Code/010_DocTalk/backend/tests
 exited 1 in 413ms:
Traceback (most recent call last):
  File "<stdin>", line 6, in <module>
  File "/Users/mayijie/Projects/Code/010_DocTalk/backend/tests/test_quote_intent_routing.py", line 32, in <module>
    import app.services.chat_service as chat_service_module  # noqa: E402
  File "/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py", line 19, in <module>
    from app.models.database import AsyncSessionLocal
  File "/Users/mayijie/Projects/Code/010_DocTalk/backend/app/models/database.py", line 21, in <module>
    DATABASE_URL = _get_database_url()
  File "/Users/mayijie/Projects/Code/010_DocTalk/backend/app/models/database.py", line 16, in _get_database_url
    raise RuntimeError("DATABASE_URL is not configured")
RuntimeError: DATABASE_URL is not configured

exec
/bin/zsh -lc "env TESTING=1 DATABASE_URL=postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/doctalk_test python3 - <<'PY'
import asyncio
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from test_quote_intent_routing import _ScalarOneResult, _base_session_and_doc, _make_db, _quote_action_plan
import app.services.chat_service as cs
from app.services.action_planner import ChatAction
from app.services.query_router import QueryIntent
from app.services.quote_search_service import QuoteSearchResult

async def tool_sync_commit_failure():
    sid, did, uid = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    session, doc = _base_session_and_doc(did, sid)
    session.domain_mode = \"legal\"
    session.title = \"Existing\"
    db = _make_db(session, doc, execute_side_effect=[_ScalarOneResult(session)])
    db.commit = AsyncMock(side_effect=RuntimeError(\"sync commit failed\"))
    plan = SimpleNamespace(action=ChatAction.EXPORT_TABLES, uses_rag_answer_path=False,
        confidence=.9, reason=\"probe\", user_visible_status=\"\", quote_finder_hint=False,
        quote_finder_hint_topic=None)
    with patch.object(cs.action_planner, \"plan\", AsyncMock(return_value=plan)):
        try:
            _ = [e async for e in cs.chat_service.chat_stream(
                sid, \"Export tables\", db, user=SimpleNamespace(id=uid, plan=\"pro\"),
                mode=\"balanced\", domain_mode=None)]
        except RuntimeError as exc:
            return f\"uncaught={exc}; domain_mode={session.domain_mode"'!r}"
    return "unexpectedly caught"

async def failed_tool_still_syncs():
    sid, did, uid = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    session, doc = _base_session_and_doc(did, sid)
    session.domain_mode = "legal"
    session.title = "Existing"
    db = _make_db(session, doc, execute_side_effect=[_ScalarOneResult(session)])
    plan = SimpleNamespace(action=ChatAction.EXPORT_TABLES, uses_rag_answer_path=False,
        confidence=.9, reason="probe", user_visible_status="", quote_finder_hint=False,
        quote_finder_hint_topic=None)
    with patch.object(cs.action_planner, "plan", AsyncMock(return_value=plan)), '"\\
         patch.object(cs.chat_tool_executor, \"execute\", AsyncMock(side_effect=RuntimeError(\"tool failed\"))):
        events = [e async for e in cs.chat_service.chat_stream(
            sid, \"Export tables\", db, user=SimpleNamespace(id=uid, plan=\"pro\"),
            mode=\"balanced\", domain_mode=None)]
    return f\"terminal={events[-1]['event']}:{events[-1]['data']['code']}; domain_mode={session.domain_mode"'!r}; commits={db.commit.await_count}"

async def strict_post_settlement_sync_failure():
    sid, did, uid, ledger = uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    session, doc = _base_session_and_doc(did, sid)
    session.domain_mode = "legal"
    session.title = "Existing"
    db = _make_db(session, doc, execute_side_effect=[_ScalarOneResult(session)])
    db.commit = AsyncMock(side_effect=[None, None, None, RuntimeError("sync commit failed")])
    refund = AsyncMock()
    result = QuoteSearchResult(cards=[], proposed=0, verified=0, discarded=[],
        scanned_chunks=3, usage=(100, 20), model="deepseek-v4-pro")
    with patch.object(cs.action_planner, "plan", AsyncMock(return_value=_quote_action_plan())), '"\\
         patch.object(cs.query_router, \"route\", return_value=SimpleNamespace(primary_intent=QueryIntent.LOCAL_QA)), \\
         patch.object(cs.credit_service, \"get_estimated_cost\", return_value=15), \\
         patch.object(cs.credit_service, \"debit_credits\", AsyncMock(return_value=ledger)), \\
         patch.object(cs.credit_service, \"reconcile_credits\", AsyncMock()), \\
         patch.object(cs.credit_service, \"record_usage\", AsyncMock()), \\
         patch.object(cs.credit_service, \"calculate_cost\", return_value=6), \\
         patch.object(cs.quote_search_service, \"quote_search\", AsyncMock(return_value=result)), \\
         patch.object(cs, \"_refund_predebit\", refund):
        events = [e async for e in cs.chat_service.chat_stream(
            sid, \"Give me a direct quote about termination.\", db,
            user=SimpleNamespace(id=uid, plan=\"pro\"), mode=\"balanced\", domain_mode=None)]
    return f\"terminal={events[-1]['event']}:{events[-1]['data']['code']}; commits={db.commit.await_count}; refund_calls={refund.await_count}\"

async def main():
    print(\"tool_sync_commit_failure\", await tool_sync_commit_failure())
    print(\"failed_tool_still_syncs\", await failed_tool_still_syncs())
    print(\"strict_post_settlement_sync_failure\", await strict_post_settlement_sync_failure())

asyncio.run(main())
PY" in /Users/mayijie/Projects/Code/010_DocTalk/backend/tests
 succeeded in 1068ms:
/Users/mayijie/Library/Python/3.9/lib/python/site-packages/urllib3/__init__.py:35: NotOpenSSLWarning: urllib3 v2 only supports OpenSSL 1.1.1+, currently the 'ssl' module is compiled with 'LibreSSL 2.8.3'. See: https://github.com/urllib3/urllib3/issues/3020
  warnings.warn(
SSE error [CHAT_SETUP_ERROR] context={'session_id': '310fe938-6dbd-4d0b-b809-90fc3c344733'}
Traceback (most recent call last):
  File "/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py", line 1330, in _tool_action_stream
    execution = await chat_tool_executor.execute(
  File "/Applications/Xcode.app/Contents/Developer/Library/Frameworks/Python3.framework/Versions/3.9/lib/python3.9/unittest/mock.py", line 2154, in _execute_mock_call
    raise effect
RuntimeError: tool failed
SSE error [QUOTE_SEARCH_ERROR] context={'session_id': '02c679af-1a32-4d68-8eab-1450ff9ba4d5'}
Traceback (most recent call last):
  File "/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py", line 1813, in chat_stream
    await _sync_session_domain_mode(db, session_obj, domain_mode)
  File "/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py", line 978, in _sync_session_domain_mode
    await db.commit()
  File "/Applications/Xcode.app/Contents/Developer/Library/Frameworks/Python3.framework/Versions/3.9/lib/python3.9/unittest/mock.py", line 2163, in _execute_mock_call
    raise result
RuntimeError: sync commit failed
tool_sync_commit_failure uncaught=sync commit failed; domain_mode=None
failed_tool_still_syncs terminal=error:CHAT_SETUP_ERROR; domain_mode=None; commits=2
strict_post_settlement_sync_failure terminal=error:QUOTE_SEARCH_ERROR; commits=4; refund_calls=0

codex
The focused probes confirm the success cases, but also reproduce a new failure-window regression: a tool-action sync commit failure escapes the generator uncaught; a strict Quote Finder sync commit failure happens after answer/billing settlement and returns `QUOTE_SEARCH_ERROR` with no refund or streamed answer. I’m consolidating this as a scoped new-breakage finding and checking that no frontend counterpart changes its severity.
Scoped tracing and adversarial failure-window probes are complete; the fixes close the original findings, but the new sync placement introduces a reproducible backend error path that changes the overall verdict.
  ✓ Read scoped rules and inspect the two fix commits/diff
  ✓ Trace DOCUMENT_LIMIT_REACHED rendering and plan-target logic
  ✓ Trace all successful streaming terminal paths and sync semantics
  → Run focused verification and issue the batch verdict
Verification is complete. The original three r1 findings are addressed, but a reproducible new P2 failure window in the domain-mode sync requires revision.
  ✓ Read scoped rules and inspect the two fix commits/diff
  ✓ Trace DOCUMENT_LIMIT_REACHED rendering and plan-target logic
  ✓ Trace all successful streaming terminal paths and sync semantics
  ✓ Run focused verification and issue the batch verdict
codex
# Overall verdict: REVISE

The three original r1 findings are addressed, but `2d4e01a` introduces a new P2 failure window.

## Per-item verdicts

- **P2 Pro document-cap dead-end — ADDRESSED.** `plan:"pro"` produces top-tier body copy with no CTA in [errorCopy.ts](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/errorCopy.ts:108). All `DOCUMENT_LIMIT_REACHED` producers supply normalized lowercase plans, and all consumers render the CTA conditionally. No remaining Pro→Plus document-limit link found. All 11 locale keys are present and valid.

- **P3 `openPaywall` comment — ADDRESSED.** The comment accurately documents `DOMAIN_MODE_REQUIRES_PLUS` as the `useChatStream`-hardcoded exception while leaving the shared flag unset.

- **P3 stale persisted `domain_mode` — ADDRESSED for successful execution.** The complete success-path inventory is tool action, strict Quote Finder, and main RAG. Summary/overview, page lookup, collection summary, and ordinary QA all remain within main RAG; there is no fourth fast-path. The branches are mutually exclusive, so the sync cannot double-apply. Both focused regression tests pass.

The production 403 gate still executes before entering the service, at [chat.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:399). No gating or prompt-behavior bypass was introduced.

## New breakage

**P2 — early-route synchronization is not transactionally safe.**

At [chat_service.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:1616), the tool-action sync runs before tool execution and outside the branch’s exception boundary:

- If the sync commit fails, the exception escapes the streaming generator without a structured SSE error.
- If tool execution subsequently fails, the request ends with `CHAT_SETUP_ERROR` but the domain metadata was already committed. Thus the claim that synchronization does not run on rejection paths is false.

At [chat_service.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:1813), strict Quote Finder synchronizes after its answer, billing reconciliation, and usage have committed and `settled=True`:

- If this additional commit fails, the request returns `QUOTE_SEARCH_ERROR` before emitting artifact/token/done.
- The answer remains persisted and charged, while the client receives neither the answer nor a refund.

Both failure windows were reproduced with focused injected-failure probes. The appropriate repair is to include the domain-mode assignment in each branch’s existing successful terminal transaction, rather than performing separate pre-execution or post-settlement commits.

No other new breakage was found in `bb79453` or `2d4e01a`. The original P1 gate findings remain closed and bypass-free, but `ba8a141..HEAD` is not ship-ready until this new P2 is fixed.
tokens used
182,692
# Overall verdict: REVISE

The three original r1 findings are addressed, but `2d4e01a` introduces a new P2 failure window.

## Per-item verdicts

- **P2 Pro document-cap dead-end — ADDRESSED.** `plan:"pro"` produces top-tier body copy with no CTA in [errorCopy.ts](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/errorCopy.ts:108). All `DOCUMENT_LIMIT_REACHED` producers supply normalized lowercase plans, and all consumers render the CTA conditionally. No remaining Pro→Plus document-limit link found. All 11 locale keys are present and valid.

- **P3 `openPaywall` comment — ADDRESSED.** The comment accurately documents `DOMAIN_MODE_REQUIRES_PLUS` as the `useChatStream`-hardcoded exception while leaving the shared flag unset.

- **P3 stale persisted `domain_mode` — ADDRESSED for successful execution.** The complete success-path inventory is tool action, strict Quote Finder, and main RAG. Summary/overview, page lookup, collection summary, and ordinary QA all remain within main RAG; there is no fourth fast-path. The branches are mutually exclusive, so the sync cannot double-apply. Both focused regression tests pass.

The production 403 gate still executes before entering the service, at [chat.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/chat.py:399). No gating or prompt-behavior bypass was introduced.

## New breakage

**P2 — early-route synchronization is not transactionally safe.**

At [chat_service.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:1616), the tool-action sync runs before tool execution and outside the branch’s exception boundary:

- If the sync commit fails, the exception escapes the streaming generator without a structured SSE error.
- If tool execution subsequently fails, the request ends with `CHAT_SETUP_ERROR` but the domain metadata was already committed. Thus the claim that synchronization does not run on rejection paths is false.

At [chat_service.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:1813), strict Quote Finder synchronizes after its answer, billing reconciliation, and usage have committed and `settled=True`:

- If this additional commit fails, the request returns `QUOTE_SEARCH_ERROR` before emitting artifact/token/done.
- The answer remains persisted and charged, while the client receives neither the answer nor a refund.

Both failure windows were reproduced with focused injected-failure probes. The appropriate repair is to include the domain-mode assignment in each branch’s existing successful terminal transaction, rather than performing separate pre-execution or post-settlement commits.

No other new breakage was found in `bb79453` or `2d4e01a`. The original P1 gate findings remain closed and bypass-free, but `ba8a141..HEAD` is not ship-ready until this new P2 is fixed.
